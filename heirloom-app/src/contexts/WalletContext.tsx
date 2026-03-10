import React, { createContext, useContext, useState, useCallback } from "react";

interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletType: "leather" | "xverse" | null;
  sbtcBalance: number;
  usdcxBalance: number;
  connect: (type: "leather" | "xverse") => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

const MOCK_ADDRESSES = {
  leather: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
  xverse: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVGR",
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<"leather" | "xverse" | null>(null);
  const [sbtcBalance] = useState(1.2847);
  const [usdcxBalance] = useState(12500.0);

  const connect = useCallback(async (type: "leather" | "xverse") => {
    // Simulate wallet connection delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setWalletType(type);
    setAddress(MOCK_ADDRESSES[type]);
    setIsConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setWalletType(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ isConnected, address, walletType, sbtcBalance, usdcxBalance, connect, disconnect }}
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