import React, { createContext, useContext, useState, useCallback } from "react";

export interface Heir {
  address: string;
  label: string;
  splitBps: number; // basis points, 10000 = 100%
}

export interface VaultData {
  heartbeatInterval: number; // days
  gracePeriod: number; // days
  heirs: Heir[];
  guardian: string | null;
  sbtcDeposit: number;
  usdcxDeposit: number;
  createdAt: Date;
  lastHeartbeat: Date;
  status: "active" | "grace" | "claimable" | "distributed";
}

interface VaultState {
  vault: VaultData | null;
  createVault: (data: VaultData) => void;
  sendHeartbeat: () => void;
  clearVault: () => void;
}

const VaultContext = createContext<VaultState | null>(null);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vault, setVault] = useState<VaultData | null>(null);

  const createVault = useCallback((data: VaultData) => {
    setVault(data);
  }, []);

  const sendHeartbeat = useCallback(() => {
    setVault((prev) =>
      prev ? { ...prev, lastHeartbeat: new Date(), status: "active" } : null
    );
  }, []);

  const clearVault = useCallback(() => {
    setVault(null);
  }, []);

  return (
    <VaultContext.Provider value={{ vault, createVault, sendHeartbeat, clearVault }}>
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
};
