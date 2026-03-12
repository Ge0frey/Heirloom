import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  connect,
  disconnect as stacksDisconnect,
  isConnected as stacksIsConnected,
  getLocalStorage,
} from "@stacks/connect";

interface WalletState {
  isConnected: boolean;
  stxAddress: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [stxAddress, setStxAddress] = useState<string | null>(null);

  // Restore connection on mount
  useEffect(() => {
    if (stacksIsConnected()) {
      const data = getLocalStorage();
      if (data?.addresses) {
        const addr = data.addresses.stx?.[0]?.address || null;
        if (addr) {
          setStxAddress(addr);
          setIsConnected(true);
        }
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      const response = await connect();
      const addr = response.addresses.stx?.[0]?.address || null;
      setStxAddress(addr);
      setIsConnected(true);
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    stacksDisconnect();
    setIsConnected(false);
    setStxAddress(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ isConnected, stxAddress, connectWallet, disconnectWallet }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
