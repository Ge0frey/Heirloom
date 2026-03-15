export const NETWORK = import.meta.env.VITE_NETWORK || 'testnet';
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
export const CONTRACT_NAME = import.meta.env.VITE_CONTRACT_NAME || 'heirloom-vault';
export const SBTC_CONTRACT = import.meta.env.VITE_SBTC_CONTRACT || 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token';
export const SBTC_TOKEN_NAME = 'sbtc-token';
export const USDCX_CONTRACT = import.meta.env.VITE_USDCX_CONTRACT || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx';
export const USDCX_TOKEN_NAME = 'usdcx-token';

export const FULL_CONTRACT_ID = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

export const BASIS_POINTS = 10000;

export function explorerTxUrl(txId: string): string {
  return NETWORK === 'mainnet'
    ? `https://explorer.stacks.co/txid/${txId}`
    : `https://explorer.stacks.co/txid/${txId}?chain=testnet`;
}
