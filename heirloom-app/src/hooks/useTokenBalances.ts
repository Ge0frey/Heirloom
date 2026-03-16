import { useState, useEffect } from "react";
import {
  NETWORK,
  SBTC_CONTRACT,
  SBTC_TOKEN_NAME,
  USDCX_CONTRACT,
  USDCX_TOKEN_NAME,
} from "@/config/constants";

interface TokenBalances {
  sbtc: number;
  usdcx: number;
  loading: boolean;
}

export function useTokenBalances(address: string | null): TokenBalances {
  const [balances, setBalances] = useState<TokenBalances>({
    sbtc: 0,
    usdcx: 0,
    loading: true,
  });

  useEffect(() => {
    if (!address) {
      setBalances({ sbtc: 0, usdcx: 0, loading: false });
      return;
    }

    const apiBase =
      NETWORK === "mainnet"
        ? "https://api.hiro.so"
        : "https://api.testnet.hiro.so";

    let cancelled = false;

    async function fetchBalances() {
      try {
        const response = await fetch(
          `${apiBase}/extended/v1/address/${address}/balances`
        );
        if (!response.ok) throw new Error("Failed to fetch balances");
        const data = await response.json();

        const ft = data.fungible_tokens || {};
        const sbtcKey = `${SBTC_CONTRACT}::${SBTC_TOKEN_NAME}`;
        const usdcxKey = `${USDCX_CONTRACT}::${USDCX_TOKEN_NAME}`;

        const sbtcRaw = parseInt(ft[sbtcKey]?.balance || "0");
        const usdcxRaw = parseInt(ft[usdcxKey]?.balance || "0");

        if (!cancelled) {
          setBalances({
            sbtc: sbtcRaw / 1e8,
            usdcx: usdcxRaw / 1e6,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setBalances({ sbtc: 0, usdcx: 0, loading: false });
        }
      }
    }

    fetchBalances();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return balances;
}
