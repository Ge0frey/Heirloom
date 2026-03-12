export const NETWORK = import.meta.env.VITE_NETWORK || 'testnet';
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
export const CONTRACT_NAME = import.meta.env.VITE_CONTRACT_NAME || 'heirloom-vault';
export const SBTC_CONTRACT = import.meta.env.VITE_SBTC_CONTRACT || 'ST126WM9ZYGYSNFM2YDV11MS0XMCJ91Q20HPNZY4T.test-sbtc-faucet';
export const USDCX_CONTRACT = import.meta.env.VITE_USDCX_CONTRACT || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx';

export const FULL_CONTRACT_ID = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

export const BASIS_POINTS = 10000;

export function explorerTxUrl(txId: string): string {
  return NETWORK === 'mainnet'
    ? `https://explorer.stacks.co/txid/${txId}`
    : `https://explorer.stacks.co/txid/${txId}?chain=testnet`;
}
