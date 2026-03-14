import { request } from '@stacks/connect';
import {
  Cl,
  fetchCallReadOnlyFunction,
  cvToJSON,
} from '@stacks/transactions';
import {
  CONTRACT_ADDRESS,
  CONTRACT_NAME,
  FULL_CONTRACT_ID,
  NETWORK,
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
  // The contract uses restrict-assets? (Clarity 4) which enforces exact transfer
  // amounts internally, so external post-conditions are redundant.
  // Using 'allow' mode avoids conflicts when the contract function errors
  // before reaching restrict-assets? (e.g. vault-not-found).
  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'deposit-sbtc',
    functionArgs: [Cl.uint(amount)],
    network: NETWORK as 'testnet' | 'mainnet',
    postConditionMode: 'allow',
  });
}

export async function depositUsdcx(amount: number, senderAddress: string) {
  // The contract uses restrict-assets? (Clarity 4) which enforces exact transfer
  // amounts internally, so external post-conditions are redundant.
  return request('stx_callContract', {
    contract: FULL_CONTRACT_ID,
    functionName: 'deposit-usdcx',
    functionArgs: [Cl.uint(amount)],
    network: NETWORK as 'testnet' | 'mainnet',
    postConditionMode: 'allow',
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

// ---- HEIR AUTO-DISCOVERY ----

export interface InheritanceInfo {
  ownerAddress: string;
  vaultState: string;
  sbtcBalance: number;
  usdcxBalance: number;
  splitBps: number;
  hasClaimed: boolean;
  sbtcShare: number;
  usdcxShare: number;
}

function getApiBase(): string {
  return NETWORK === 'mainnet'
    ? 'https://api.hiro.so'
    : 'https://api.testnet.hiro.so';
}

export async function findVaultsForHeir(heirAddress: string): Promise<InheritanceInfo[]> {
  const apiBase = getApiBase();

  try {
    // Fetch recent transactions on the contract to find vault owners
    const response = await fetch(
      `${apiBase}/extended/v1/address/${FULL_CONTRACT_ID}/transactions?limit=50`
    );
    if (!response.ok) return [];
    const data = await response.json();

    // Extract unique vault owners from successful create-vault calls
    const vaultOwners = new Set<string>();
    for (const tx of data.results || []) {
      if (
        tx.tx_type === 'contract_call' &&
        tx.contract_call?.function_name === 'create-vault' &&
        tx.tx_status === 'success'
      ) {
        vaultOwners.add(tx.sender_address);
      }
    }

    // For each owner, check if heirAddress is a registered heir
    const checks = Array.from(vaultOwners).map(async (owner): Promise<InheritanceInfo | null> => {
      try {
        // Skip if the heir is the vault owner themselves
        if (owner === heirAddress) return null;

        const [statusJson, heirInfoJson] = await Promise.all([
          getVaultStatus(owner),
          getHeirInfo(owner, heirAddress),
        ]);

        // Reject error responses (e.g. u101 = not-heir)
        if (statusJson?.success === false) return null;
        if (heirInfoJson?.success === false) return null;

        // Parse vault status
        const tupleWrapper = statusJson?.value;
        const v =
          tupleWrapper?.value &&
          typeof tupleWrapper.value === 'object' &&
          !Array.isArray(tupleWrapper.value) &&
          tupleWrapper.type
            ? tupleWrapper.value
            : tupleWrapper;

        const state = v?.state?.value || v?.state || 'unknown';
        const sbtcBalance = parseInt(v?.['sbtc-balance']?.value ?? v?.['sbtc-balance'] ?? '0');
        const usdcxBalance = parseInt(v?.['usdcx-balance']?.value ?? v?.['usdcx-balance'] ?? '0');
        const isDistributed =
          v?.['is-distributed']?.value === true || v?.['is-distributed'] === true;

        // Parse heir info
        const infoWrapper = heirInfoJson?.value;
        const infoFields =
          infoWrapper?.value &&
          typeof infoWrapper.value === 'object' &&
          infoWrapper.type
            ? infoWrapper.value
            : infoWrapper;
        const splitBps = parseInt(
          infoFields?.['split-bps']?.value ?? infoFields?.['split-bps'] ?? '0'
        );
        const hasClaimed =
          infoFields?.['has-claimed']?.value === true ||
          infoFields?.['has-claimed'] === true;

        // Skip fully distributed vaults where heir already claimed
        if (isDistributed && hasClaimed) return null;

        return {
          ownerAddress: owner,
          vaultState: state,
          sbtcBalance,
          usdcxBalance,
          splitBps,
          hasClaimed,
          sbtcShare: Math.floor((sbtcBalance * splitBps) / 10000),
          usdcxShare: Math.floor((usdcxBalance * splitBps) / 10000),
        };
      } catch {
        return null; // Not a heir for this vault
      }
    });

    const results = await Promise.all(checks);
    return results.filter((r): r is InheritanceInfo => r !== null);
  } catch {
    return [];
  }
}

export async function lookupSingleVault(
  ownerAddress: string,
  heirAddress: string
): Promise<InheritanceInfo | null> {
  try {
    // Cannot be an heir of your own vault
    if (ownerAddress === heirAddress) return null;

    const [statusJson, heirInfoJson] = await Promise.all([
      getVaultStatus(ownerAddress),
      getHeirInfo(ownerAddress, heirAddress),
    ]);

    // Reject error responses (e.g. u101 = not-heir, u103 = vault-not-found)
    if (statusJson?.success === false) return null;
    if (heirInfoJson?.success === false) return null;

    const tupleWrapper = statusJson?.value;
    const v =
      tupleWrapper?.value &&
      typeof tupleWrapper.value === 'object' &&
      !Array.isArray(tupleWrapper.value) &&
      tupleWrapper.type
        ? tupleWrapper.value
        : tupleWrapper;

    const state = v?.state?.value || v?.state || 'unknown';
    const sbtcBalance = parseInt(v?.['sbtc-balance']?.value ?? v?.['sbtc-balance'] ?? '0');
    const usdcxBalance = parseInt(v?.['usdcx-balance']?.value ?? v?.['usdcx-balance'] ?? '0');

    const infoWrapper = heirInfoJson?.value;
    const infoFields =
      infoWrapper?.value &&
      typeof infoWrapper.value === 'object' &&
      infoWrapper.type
        ? infoWrapper.value
        : infoWrapper;
    const splitBps = parseInt(
      infoFields?.['split-bps']?.value ?? infoFields?.['split-bps'] ?? '0'
    );
    const hasClaimed =
      infoFields?.['has-claimed']?.value === true ||
      infoFields?.['has-claimed'] === true;

    return {
      ownerAddress,
      vaultState: state,
      sbtcBalance,
      usdcxBalance,
      splitBps,
      hasClaimed,
      sbtcShare: Math.floor((sbtcBalance * splitBps) / 10000),
      usdcxShare: Math.floor((usdcxBalance * splitBps) / 10000),
    };
  } catch {
    return null;
  }
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
