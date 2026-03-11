export const NETWORK = import.meta.env.VITE_NETWORK || 'testnet';
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
export const CONTRACT_NAME = import.meta.env.VITE_CONTRACT_NAME || 'heirloom-vault';
export const SBTC_CONTRACT = import.meta.env.VITE_SBTC_CONTRACT;

export const FULL_CONTRACT_ID = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

export const BASIS_POINTS = 10000;

export const EXPLORER_URL = NETWORK === 'mainnet'
  ? 'https://explorer.stacks.co'
  : 'https://explorer.stacks.co/?chain=testnet';

export function explorerTxUrl(txId: string): string {
  return NETWORK === 'mainnet'
    ? `https://explorer.stacks.co/txid/${txId}`
    : `https://explorer.stacks.co/txid/${txId}?chain=testnet`;
}
