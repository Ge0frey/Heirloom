import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "./WalletContext";
import {
  getVaultStatus,
  getHeirList,
  getHeirInfo,
  createVault as createVaultContract,
  depositSbtc as depositSbtcContract,
  depositUsdcx as depositUsdcxContract,
  sendHeartbeat as sendHeartbeatContract,
  emergencyWithdraw as emergencyWithdrawContract,
} from "@/lib/contracts";

export interface Heir {
  address: string;
  label: string;
  splitBps: number;
  hasClaimed?: boolean;
}

export interface VaultData {
  state: "active" | "grace" | "claimable" | "distributed";
  sbtcBalance: number; // in sats
  usdcxBalance: number; // in micro-units (6 decimals)
  lastHeartbeat: number; // unix timestamp seconds
  heartbeatInterval: number; // seconds
  gracePeriod: number; // seconds
  elapsedSeconds: number;
  secondsUntilGrace: number;
  secondsUntilClaimable: number;
  heirCount: number;
  guardian: string | null;
  guardianPauseUsed: boolean;
  isDistributed: boolean;
  createdAt: number;
  heirs: Heir[];
}

interface VaultState {
  vault: VaultData | null;
  loading: boolean;
  error: string | null;
  pendingTxId: string | null;
  pendingCreate: boolean;
  fetchVault: () => Promise<void>;
  createVaultOnChain: (
    heartbeatInterval: number,
    gracePeriod: number,
    heirs: { address: string; label: string; splitBps: number }[],
    guardian?: string
  ) => Promise<string>;
  depositSbtcOnChain: (amount: number) => Promise<string>;
  depositUsdcxOnChain: (amount: number) => Promise<string>;
  sendHeartbeatOnChain: () => Promise<string>;
  emergencyWithdrawOnChain: () => Promise<string>;
  clearVault: () => void;
}

const VaultContext = createContext<VaultState | null>(null);

function parseVaultStatus(json: any): Omit<VaultData, "heirs"> | null {
  if (!json?.value) return null;
  const v = json.value;
  return {
    state: v.state?.value || "active",
    sbtcBalance: parseInt(v["sbtc-balance"]?.value || "0"),
    usdcxBalance: parseInt(v["usdcx-balance"]?.value || "0"),
    lastHeartbeat: parseInt(v["last-heartbeat"]?.value || "0"),
    heartbeatInterval: parseInt(v["heartbeat-interval"]?.value || "0"),
    gracePeriod: parseInt(v["grace-period"]?.value || "0"),
    elapsedSeconds: parseInt(v["elapsed-seconds"]?.value || "0"),
    secondsUntilGrace: parseInt(v["seconds-until-grace"]?.value || "0"),
    secondsUntilClaimable: parseInt(v["seconds-until-claimable"]?.value || "0"),
    heirCount: parseInt(v["heir-count"]?.value || "0"),
    guardian: v.guardian?.value?.value || null,
    guardianPauseUsed: v["guardian-pause-used"]?.value === true,
    isDistributed: v["is-distributed"]?.value === true,
    createdAt: parseInt(v["created-at"]?.value || "0"),
  };
}

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { stxAddress, isConnected } = useWallet();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);
  const [pendingCreate, setPendingCreate] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVault = useCallback(async () => {
    if (!stxAddress) return;
    try {
      setLoading(true);
      setError(null);
      const statusJson = await getVaultStatus(stxAddress);
      const parsed = parseVaultStatus(statusJson);
      if (!parsed) {
        setVault(null);
        return;
      }

      // Fetch heir list
      const heirListJson = await getHeirList(stxAddress);
      const heirAddresses: string[] =
        heirListJson?.value?.map((h: any) => h.value) || [];

      // Fetch individual heir info
      const heirs: Heir[] = await Promise.all(
        heirAddresses.map(async (addr, i) => {
          try {
            const info = await getHeirInfo(stxAddress, addr);
            return {
              address: addr,
              label: `Heir ${i + 1}`,
              splitBps: parseInt(info?.value?.["split-bps"]?.value || "0"),
              hasClaimed: info?.value?.["has-claimed"]?.value === true,
            };
          } catch {
            return { address: addr, label: `Heir ${i + 1}`, splitBps: 0 };
          }
        })
      );

      setVault({ ...parsed, heirs });
    } catch (err: any) {
      // Vault not found is not an error
      if (err?.message?.includes("u103")) {
        setVault(null);
      } else {
        setError(err?.message || "Failed to fetch vault");
      }
    } finally {
      setLoading(false);
    }
  }, [stxAddress]);

  // Clear pendingCreate once vault is found
  useEffect(() => {
    if (vault) {
      setPendingCreate(false);
    }
  }, [vault]);

  // Auto-poll: 5s when pending creation, 15s otherwise
  useEffect(() => {
    if (isConnected && stxAddress) {
      fetchVault();
      const interval = pendingCreate ? 5000 : 15000;
      pollRef.current = setInterval(fetchVault, interval);
    } else {
      setVault(null);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isConnected, stxAddress, fetchVault, pendingCreate]);

  const createVaultOnChain = useCallback(
    async (
      heartbeatInterval: number,
      gracePeriod: number,
      heirs: { address: string; label: string; splitBps: number }[],
      guardian?: string
    ): Promise<string> => {
      const result = await createVaultContract(
        heartbeatInterval,
        gracePeriod,
        heirs.map((h) => ({ address: h.address, splitBps: h.splitBps })),
        guardian
      );
      const txId = result?.txid || result?.txId || "";
      setPendingTxId(txId);
      setPendingCreate(true);
      return txId;
    },
    []
  );

  const depositSbtcOnChain = useCallback(async (amount: number): Promise<string> => {
    if (!stxAddress) throw new Error("Wallet not connected");
    const result = await depositSbtcContract(amount, stxAddress);
    const txId = result?.txid || result?.txId || "";
    setPendingTxId(txId);
    return txId;
  }, [stxAddress]);

  const depositUsdcxOnChain = useCallback(async (amount: number): Promise<string> => {
    if (!stxAddress) throw new Error("Wallet not connected");
    const result = await depositUsdcxContract(amount, stxAddress);
    const txId = result?.txid || result?.txId || "";
    setPendingTxId(txId);
    return txId;
  }, [stxAddress]);

  const sendHeartbeatOnChain = useCallback(async (): Promise<string> => {
    const result = await sendHeartbeatContract();
    const txId = result?.txid || result?.txId || "";
    setPendingTxId(txId);
    return txId;
  }, []);

  const emergencyWithdrawOnChain = useCallback(async (): Promise<string> => {
    const result = await emergencyWithdrawContract();
    const txId = result?.txid || result?.txId || "";
    setPendingTxId(txId);
    return txId;
  }, []);

  const clearVault = useCallback(() => {
    setVault(null);
    setPendingTxId(null);
    setPendingCreate(false);
    setError(null);
  }, []);

  return (
    <VaultContext.Provider
      value={{
        vault,
        loading,
        error,
        pendingTxId,
        pendingCreate,
        fetchVault,
        createVaultOnChain,
        depositSbtcOnChain,
        depositUsdcxOnChain,
        sendHeartbeatOnChain,
        emergencyWithdrawOnChain,
        clearVault,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
};
