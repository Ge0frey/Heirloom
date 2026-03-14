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
  // cvToJSON wraps ResponseOk as { success: true, type, value: cvToJSON(inner) }
  // and ResponseErr as { success: false, type, value: cvToJSON(err-value) }
  // Reject error responses (e.g. u103 = vault not found)
  if (json?.success === false) return null;
  const tupleWrapper = json?.value;
  if (!tupleWrapper) return null;
  // Handle both possible shapes: tupleWrapper could be { type, value: {...} } or flat fields
  const v = tupleWrapper.value && typeof tupleWrapper.value === "object" && !Array.isArray(tupleWrapper.value) && tupleWrapper.type
    ? tupleWrapper.value
    : tupleWrapper;
  return {
    state: v.state?.value || v.state || "active",
    sbtcBalance: parseInt(v["sbtc-balance"]?.value ?? v["sbtc-balance"] ?? "0"),
    usdcxBalance: parseInt(v["usdcx-balance"]?.value ?? v["usdcx-balance"] ?? "0"),
    lastHeartbeat: parseInt(v["last-heartbeat"]?.value ?? v["last-heartbeat"] ?? "0"),
    heartbeatInterval: parseInt(v["heartbeat-interval"]?.value ?? v["heartbeat-interval"] ?? "0"),
    gracePeriod: parseInt(v["grace-period"]?.value ?? v["grace-period"] ?? "0"),
    elapsedSeconds: parseInt(v["elapsed-seconds"]?.value ?? v["elapsed-seconds"] ?? "0"),
    secondsUntilGrace: parseInt(v["seconds-until-grace"]?.value ?? v["seconds-until-grace"] ?? "0"),
    secondsUntilClaimable: parseInt(v["seconds-until-claimable"]?.value ?? v["seconds-until-claimable"] ?? "0"),
    heirCount: parseInt(v["heir-count"]?.value ?? v["heir-count"] ?? "0"),
    guardian: v.guardian?.value?.value ?? v.guardian?.value ?? null,
    guardianPauseUsed: v["guardian-pause-used"]?.value === true || v["guardian-pause-used"] === true,
    isDistributed: v["is-distributed"]?.value === true || v["is-distributed"] === true,
    createdAt: parseInt(v["created-at"]?.value ?? v["created-at"] ?? "0"),
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
      // cvToJSON: ResponseOk → { value: cvToJSON(List) } → { value: { type, value: [...] } }
      const heirListJson = await getHeirList(stxAddress);
      const heirListInner = heirListJson?.value;
      const heirListArray = Array.isArray(heirListInner)
        ? heirListInner
        : Array.isArray(heirListInner?.value)
          ? heirListInner.value
          : [];
      const heirAddresses: string[] =
        heirListArray.map((h: any) => h.value ?? h) || [];

      // Fetch individual heir info
      // cvToJSON: ResponseOk wrapping Tuple → info.value may be { type, value: { fields } }
      const heirs: Heir[] = await Promise.all(
        heirAddresses.map(async (addr, i) => {
          try {
            const info = await getHeirInfo(stxAddress, addr);
            const infoWrapper = info?.value;
            const infoFields = infoWrapper?.value && typeof infoWrapper.value === "object" && infoWrapper.type
              ? infoWrapper.value
              : infoWrapper;
            return {
              address: addr,
              label: `Heir ${i + 1}`,
              splitBps: parseInt(infoFields?.["split-bps"]?.value ?? infoFields?.["split-bps"] ?? "0"),
              hasClaimed: infoFields?.["has-claimed"]?.value === true || infoFields?.["has-claimed"] === true,
            };
          } catch {
            return { address: addr, label: `Heir ${i + 1}`, splitBps: 0 };
          }
        })
      );

      // If vault is distributed or all heirs have claimed, treat as no vault
      // so the owner can create a new one
      const allClaimed = heirs.length > 0 && heirs.every(h => h.hasClaimed);
      if (parsed.isDistributed || allClaimed) {
        setVault(null);
        return;
      }

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
