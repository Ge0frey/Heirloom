import { request } from '@stacks/connect';
import {
  Cl,
  Pc,
  fetchCallReadOnlyFunction,
  cvToJSON,
} from '@stacks/transactions';
import {
  CONTRACT_ADDRESS,
  CONTRACT_NAME,
  FULL_CONTRACT_ID,
  NETWORK,
  SBTC_CONTRACT,
  SBTC_TOKEN_NAME,
  USDCX_CONTRACT,
  USDCX_TOKEN_NAME,
} from '../config/constants';

// ---- WRITE FUNCTIONS (require wallet signature) ----

export async function createVault(
  heartbeatInterval: number,
  gracePeriod: number,
  heirs: { address: string; splitBps: number }[],
  guardian?: string
) {
  const heirsClarity = heirs.map(h =>
    Cl.tuple({
      heir: Cl.principal(h.address),
      'split-bps': Cl.uint(h.splitBps),
    })
  );

  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'create-vault',
    functionArgs: [
      Cl.uint(heartbeatInterval),
      Cl.uint(gracePeriod),
      Cl.list(heirsClarity),
      guardian ? Cl.some(Cl.principal(guardian)) : Cl.none(),
    ],
    network: NETWORK as 'testnet' | 'mainnet',
  });
}

export async function depositSbtc(amount: number, senderAddress: string) {
  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'deposit-sbtc',
    functionArgs: [Cl.uint(amount)],
    network: NETWORK as 'testnet' | 'mainnet',
    postConditions: [
      Pc.principal(senderAddress).willSendEq(amount).ft(SBTC_CONTRACT, SBTC_TOKEN_NAME),
    ],
  });
}

export async function depositUsdcx(amount: number, senderAddress: string) {
  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'deposit-usdcx',
    functionArgs: [Cl.uint(amount)],
    network: NETWORK as 'testnet' | 'mainnet',
    postConditions: [
      Pc.principal(senderAddress).willSendEq(amount).ft(USDCX_CONTRACT, USDCX_TOKEN_NAME),
    ],
  });
}

export async function sendHeartbeat() {
  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'heartbeat',
    functionArgs: [],
    network: NETWORK as 'testnet' | 'mainnet',
  });
}

export async function claimInheritance(vaultOwner: string) {
  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'claim',
    functionArgs: [Cl.principal(vaultOwner)],
    network: NETWORK as 'testnet' | 'mainnet',
    postConditionMode: 'allow',
  });
}

export async function emergencyWithdraw() {
  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'emergency-withdraw',
    functionArgs: [],
    network: NETWORK as 'testnet' | 'mainnet',
    postConditionMode: 'allow',
  });
}

export async function guardianPause(vaultOwner: string) {
  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'guardian-pause',
    functionArgs: [Cl.principal(vaultOwner)],
    network: NETWORK as 'testnet' | 'mainnet',
  });
}

export async function updateHeirs(
  newHeirs: { address: string; splitBps: number }[]
) {
  const heirsClarity = newHeirs.map(h =>
    Cl.tuple({
      heir: Cl.principal(h.address),
      'split-bps': Cl.uint(h.splitBps),
    })
  );

  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'update-heirs',
    functionArgs: [Cl.list(heirsClarity)],
    network: NETWORK as 'testnet' | 'mainnet',
  });
}

// ---- READ-ONLY FUNCTIONS (no wallet needed) ----

export async function getVaultStatus(ownerAddress: string) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-vault-status',
    functionArgs: [Cl.principal(ownerAddress)],
    network: NETWORK as 'testnet' | 'mainnet',
    senderAddress: ownerAddress,
  });

  return cvToJSON(result);
}

export async function getHeirInfo(ownerAddress: string, heirAddress: string) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-heir-info',
    functionArgs: [
      Cl.principal(ownerAddress),
      Cl.principal(heirAddress),
    ],
    network: NETWORK as 'testnet' | 'mainnet',
    senderAddress: heirAddress,
  });

  return cvToJSON(result);
}

export async function getHeirList(ownerAddress: string) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-heir-list',
    functionArgs: [Cl.principal(ownerAddress)],
    network: NETWORK as 'testnet' | 'mainnet',
    senderAddress: ownerAddress,
  });

  return cvToJSON(result);
}
