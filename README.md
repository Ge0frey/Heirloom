# Heirloom -- The Bitcoin-Heartbeat Inheritance Vault

**"If your Bitcoin goes silent, your plan speaks."**

Heirloom is a Bitcoin-native inheritance protocol built on Stacks. Vault owners lock sBTC and USDCx into a Clarity smart contract, designate heirs with percentage splits, and maintain a periodic heartbeat signal from their wallet. If the heartbeat stops -- due to incapacitation, death, or any other reason -- the vault enters a grace period and eventually becomes claimable by the designated beneficiaries. No lawyers, no custodians, no seed phrase sharing.

---

## Table of Contents

- [The Problem](#the-problem)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Smart Contract](#smart-contract)
- [Frontend Application](#frontend-application)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Stacks Primitives Used](#stacks-primitives-used)
- [Security Considerations](#security-considerations)
- [License](#license)

---

## The Problem

An estimated 3-4 million Bitcoin are permanently lost. A growing portion of that loss is due to holder death or incapacitation without any succession plan. Existing solutions all require compromises:

- **Seed phrase in a safe** -- exposes full access to a third party.
- **Multisig with family** -- requires technical sophistication from every keyholder.
- **Centralized custody** -- defeats the purpose of self-custody.
- **Lawyers and estate planning** -- slow, expensive, jurisdiction-dependent, and unable to interact with smart contracts.
- **Do nothing** -- the most common approach. The Bitcoin dies with the holder.

Heirloom resolves the core tension: it keeps custody in the owner's hands while making inheritance automatic and trustless.

---

## How It Works

Heirloom introduces **liveness-based asset release** -- a mechanism where vault state is determined by the owner's continued activity, not by a fixed calendar date.

### The Heartbeat

1. The vault owner periodically signs a transaction calling `heartbeat()` on the Heirloom contract.
2. The contract records the timestamp using Clarity 4's `stacks-block-time` keyword and resets the countdown.
3. As long as heartbeats arrive within the configured interval, the vault remains locked.

### Vault Lifecycle

```
CREATED  --deposit-->  ACTIVE  --interval expires-->  GRACE  --grace expires-->  CLAIMABLE  --all claimed-->  DISTRIBUTED
                         ^                              |                           |
                         |          heartbeat()         |        heartbeat()        |
                         +------------------------------+---------------------------+

At any point before DISTRIBUTED, the owner can call emergency-withdraw() --> CANCELLED
```

| State | Description |
|-------|-------------|
| **Active** | Heartbeat timer is running. Vault is locked. |
| **Grace** | Heartbeat interval has elapsed. Grace period countdown begins. Guardian can pause here. |
| **Claimable** | Grace period has elapsed. Heirs can claim their shares. Owner can still heartbeat to recover. |
| **Distributed** | All heirs have claimed (or owner emergency-withdrew). Vault is closed. |

The vault state is **not stored as an enum**. It is computed from `stacks-block-time` and `last-heartbeat` on every read, so it is always current without requiring a separate state-update transaction.

### What Makes This More Than a Dead-Man's Switch

- **Multiple heirs with percentage splits** -- up to 10 beneficiaries, allocated in basis points (10000 = 100%).
- **Multi-asset vaults** -- sBTC (Bitcoin-backed) and USDCx (dollar-stable) in the same vault.
- **Configurable grace period** -- a buffer for missed heartbeats (hospitalization, travel, lost device).
- **Guardian system** -- an optional trusted address that can pause the countdown once during the grace period, adding 30 days.
- **Emergency withdrawal** -- the owner retains full control and can reclaim all assets at any time before distribution.
- **Updateable beneficiaries** -- the owner can change heirs and splits while the vault is active.
- **Vault re-creation** -- after a vault is fully distributed, the owner can create a new vault from the same address.

---

## Architecture

Heirloom consists of two components:

1. **Smart Contract** (`contracts/heirloom-vault.clar`) -- A single Clarity 4 contract that handles all vault logic: creation, deposits, heartbeats, claims, guardian pause, emergency withdrawal, and heir management.

2. **Frontend Application** (`heirloom-app/`) -- A React + TypeScript single-page application that provides the user interface for vault owners and heirs. See [heirloom-app/README.md](heirloom-app/README.md) for frontend-specific documentation.

---

## Smart Contract

### Contract: `heirloom-vault.clar`

Written in Clarity 4 (epoch: latest). Deployed as `heirloom-vault-v10`.

### Data Model

**Vaults** -- One vault per owner (keyed by principal):

| Field | Type | Description |
|-------|------|-------------|
| `heartbeat-interval` | uint | Seconds between required heartbeats |
| `grace-period` | uint | Additional seconds after missed heartbeat before claims open |
| `last-heartbeat` | uint | Timestamp of the most recent heartbeat |
| `sbtc-balance` | uint | sBTC locked in the vault (in satoshis) |
| `usdcx-balance` | uint | USDCx locked in the vault (in micro-units) |
| `guardian` | optional principal | Trusted address that can pause during grace |
| `guardian-pause-used` | bool | Whether the guardian has used their one-time pause |
| `is-distributed` | bool | Whether the vault has been fully distributed or cancelled |
| `heir-count` | uint | Number of registered heirs |
| `claims-count` | uint | Number of heirs who have claimed |
| `created-at` | uint | Vault creation timestamp |

**Heirs** -- Keyed by (owner, heir) pair:

| Field | Type | Description |
|-------|------|-------------|
| `split-bps` | uint | Heir's share in basis points (10000 = 100%) |

**Heir List** -- Ordered list of up to 10 heir addresses per vault owner.

**Heir Claimed** -- Boolean tracking whether each heir has claimed their share.

### Public Functions

#### `create-vault`

```
(create-vault
  (heartbeat-interval uint)
  (grace-period uint)
  (heirs-data (list 10 { heir: principal, split-bps: uint }))
  (guardian (optional principal))
) -> (response bool uint)
```

Creates a new vault for `tx-sender`. Validates that heir splits sum to exactly 10000 basis points and that at least one heir is specified. Allows re-creation if the previous vault is fully distributed. Sets `last-heartbeat` to the current `stacks-block-time`.

#### `deposit-sbtc` / `deposit-usdcx`

```
(deposit-sbtc (amount uint)) -> (response bool uint)
(deposit-usdcx (amount uint)) -> (response bool uint)
```

Transfers SIP-010 tokens from the caller into the vault contract. Uses Clarity 4's `restrict-assets?` with `with-ft` for post-condition enforcement. Updates the vault's tracked balance.

#### `heartbeat`

```
(heartbeat) -> (response bool uint)
```

Resets `last-heartbeat` to the current `stacks-block-time`. Only callable by the vault owner. Works in any non-distributed state (active, grace, or even claimable -- allowing recovery from extended absence if heirs have not yet claimed).

#### `claim`

```
(claim (vault-owner principal)) -> (response bool uint)
```

Called by a registered heir when the vault is in the claimable state (elapsed time exceeds heartbeat-interval + grace-period + any guardian pause bonus). Calculates the heir's proportional share of both sBTC and USDCx, transfers the tokens via `as-contract?`, and marks the heir as claimed. When all heirs have claimed (`claims-count == heir-count`), the vault is automatically marked as distributed.

#### `emergency-withdraw`

```
(emergency-withdraw) -> (response bool uint)
```

Returns all sBTC and USDCx to the vault owner and marks the vault as distributed. Callable at any time before distribution.

#### `guardian-pause`

```
(guardian-pause (vault-owner principal)) -> (response bool uint)
```

Callable only by the registered guardian, only during the grace period, and only once per vault. Extends the effective deadline by 30 days (2,592,000 seconds).

#### `update-heirs`

```
(update-heirs (new-heirs (list 10 { heir: principal, split-bps: uint }))) -> (response bool uint)
```

Replaces the heir list and splits. Validates that splits sum to 10000. Only callable by the vault owner on a non-distributed vault.

### Read-Only Functions

#### `get-vault-status`

```
(get-vault-status (owner principal))
  -> (response {
    state: (string-ascii 12),
    sbtc-balance: uint,
    usdcx-balance: uint,
    last-heartbeat: uint,
    heartbeat-interval: uint,
    grace-period: uint,
    elapsed-seconds: uint,
    seconds-until-grace: uint,
    seconds-until-claimable: uint,
    heir-count: uint,
    claims-count: uint,
    guardian: (optional principal),
    guardian-pause-used: bool,
    is-distributed: bool,
    created-at: uint,
  } uint)
```

Returns the full computed vault state. The `state` field is derived from elapsed time vs. configured intervals -- it is never stale.

#### `get-heir-info`

```
(get-heir-info (owner principal) (heir principal))
  -> (response { split-bps: uint, has-claimed: bool } uint)
```

Returns a specific heir's allocation percentage and claim status.

#### `get-heir-list`

```
(get-heir-list (owner principal))
  -> (response (list 10 principal) uint)
```

Returns the ordered list of heir addresses for a vault.

### Error Codes

| Code | Constant | Meaning |
|------|----------|---------|
| u101 | ERR-NOT-HEIR | Caller is not a registered heir |
| u102 | ERR-NOT-GUARDIAN | Caller is not the vault's guardian |
| u103 | ERR-VAULT-NOT-FOUND | No vault exists for the specified owner |
| u104 | ERR-VAULT-NOT-CLAIMABLE | Vault has not reached claimable state |
| u105 | ERR-ALREADY-CLAIMED | Heir has already claimed their share |
| u106 | ERR-INVALID-SPLITS | Heir splits do not sum to 10000 or no heirs provided |
| u109 | ERR-VAULT-ALREADY-EXISTS | Owner already has an active vault |
| u110 | ERR-VAULT-DISTRIBUTED | Vault has already been distributed |
| u111 | ERR-GUARDIAN-PAUSE-USED | Guardian has already used their one-time pause |
| u112 | ERR-NOT-IN-GRACE | Vault is not in the grace period (guardian-pause requirement) |
| u113 | ERR-NO-BALANCE | Deposit amount must be greater than zero |

### Token References

| Token | Contract | Token Name |
|-------|----------|------------|
| sBTC | `ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token` | sbtc-token |
| USDCx | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` | usdcx-token |

---

## Frontend Application

See [heirloom-app/README.md](heirloom-app/README.md) for detailed frontend documentation.

The frontend is a React + Vite + TypeScript application with Tailwind CSS styling. It provides four main views:

- **Landing page** -- product overview, how it works, and comparison table.
- **Create Vault** -- multi-step wizard for vault creation, heir configuration, and asset deposit.
- **Dashboard** -- vault management with real-time countdown, heartbeat button, heir list, and emergency withdraw.
- **Claim** -- heir portal that auto-discovers available inheritances and enables one-click claiming.

Wallet connectivity is handled via `@stacks/connect` v8 (Leather and Xverse wallets). Contract reads use `fetchCallReadOnlyFunction` from `@stacks/transactions` v7.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Clarinet](https://github.com/hirosystems/clarinet) v2.x or later
- A Stacks wallet (Leather or Xverse) for testnet interaction

### Install Dependencies

```bash
# Smart contract dependencies (root level)
cd heirloom
npm install

# Frontend dependencies
cd heirloom-app
npm install
```

### Run the Frontend

```bash
cd heirloom/heirloom-app
npm run dev
```

The app will be available at `http://localhost:5173`.

### Run Contract Tests

```bash
cd heirloom
npm test
```

---

## Testing

The test suite is located in `tests/heirloom-vault.test.ts` and uses Vitest with the Clarinet SDK's simnet environment.

### Test Coverage

The suite includes 23 tests covering:

- **Vault creation** -- valid creation, invalid split validation, duplicate prevention, guardian support, re-creation after distribution.
- **Deposits** -- sBTC and USDCx deposits with balance tracking.
- **Heartbeat** -- timer reset, non-owner rejection, distributed vault rejection.
- **Claims** -- heir claiming, share calculation, non-heir rejection, double-claim prevention, auto-distribution when all heirs claim.
- **Emergency withdrawal** -- asset return, vault cancellation, post-withdrawal state.
- **Guardian pause** -- grace period extension, non-guardian rejection, double-pause prevention.
- **Heir updates** -- split modification, validation.
- **Status queries** -- computed state verification, heir info, heir list.

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch
```

### Test Accounts

The simnet environment provides pre-funded accounts:

| Account | Role |
|---------|------|
| `deployer` | Contract deployer, vault owner in tests |
| `wallet_1` | Heir 1 (70% split in default config) |
| `wallet_2` | Heir 2 (30% split in default config) |
| `wallet_3` | Guardian |

---

## Deployment

### Simnet (Local Testing)

Clarinet automatically sets up a simnet with the contract and its external dependencies (sBTC, USDCx) cached locally. No configuration needed beyond running `npm test`.

### Testnet

The contract is deployed on Stacks testnet:

- **Deployer:** `STZJWVYSKRYV1XBGS8BZ4F81E32RHBREQSE5WAJM`
- **Contract name:** `heirloom-vault-v10`

To deploy a new version:

```bash
clarinet deployments apply -p deployments/default.testnet-plan.yaml --no-dashboard
```

Note: Stacks does not allow overwriting deployed contracts. Each new version requires a new contract name (e.g., `heirloom-vault-v11`).

### Mainnet

The `settings/Mainnet.toml` file contains a placeholder configuration for mainnet deployment. Update the deployer mnemonic and fee rate before deploying.

---

## Environment Variables

The frontend reads configuration from `heirloom-app/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_NETWORK` | Stacks network (`testnet` or `mainnet`) | `testnet` |
| `VITE_CONTRACT_ADDRESS` | Deployer address | `STZJWVYSKRYV1XBGS8BZ4F81E32RHBREQSE5WAJM` |
| `VITE_CONTRACT_NAME` | Contract name | `heirloom-vault-v10` |
| `VITE_SBTC_CONTRACT` | sBTC contract identifier | `ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token` |
| `VITE_USDCX_CONTRACT` | USDCx contract identifier | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` |

---

## Project Structure

```
heirloom/
  contracts/
    heirloom-vault.clar        # Core vault smart contract (Clarity 4)
  tests/
    heirloom-vault.test.ts     # Contract test suite (23 tests)
  settings/
    Devnet.toml                # Local devnet configuration
    Testnet.toml               # Testnet deployment settings
    Mainnet.toml               # Mainnet deployment settings
  deployments/
    default.simnet-plan.yaml   # Simnet deployment plan
    default.testnet-plan.yaml  # Testnet deployment plan
  heirloom-app/                # React frontend (see heirloom-app/README.md)
    src/
      pages/                   # Route pages (Index, CreateVault, Dashboard, Claim)
      components/              # UI and layout components
      contexts/                # WalletContext, VaultContext
      hooks/                   # Custom React hooks
      lib/                     # Contract interaction layer, utilities
  Clarinet.toml                # Clarinet project configuration
  vitest.config.ts             # Test runner configuration
  package.json                 # Contract-level dependencies
  tsconfig.json                # TypeScript configuration
```

---

## Stacks Primitives Used

| Primitive | How Heirloom Uses It |
|-----------|---------------------|
| **Clarity 4 smart contracts** | Core vault logic, beneficiary registry, heartbeat tracking, claim distribution |
| **`stacks-block-time`** | Timestamp-based heartbeat tracking and expiry calculations |
| **`restrict-assets?` / `with-ft`** | In-contract post-conditions protecting vault assets during deposits |
| **`as-contract?` / `with-ft`** | Contract-authorized token transfers for claims and withdrawals |
| **`current-contract`** | Self-referencing contract principal for receiving deposits |
| **sBTC (SIP-010)** | Primary vault asset -- Bitcoin-backed inheritance |
| **USDCx (SIP-010)** | Stable-value bequest tranche -- dollar-denominated inheritance |
| **`tx-sender` verification** | Owner and heir authentication |
| **Bitcoin finality** | All vault state transitions settle on Bitcoin L1 |
| **@stacks/connect v8** | Frontend wallet connection and transaction signing |
| **@stacks/transactions v7** | Contract reads via `fetchCallReadOnlyFunction` |
| **Clarinet** | Smart contract development, testing, and deployment |

---

## Security Considerations

**Clarity's safety properties** ensure that the deployed contract behaves exactly as written:

- Clarity is interpreted -- what you read on-chain is what executes.
- Clarity is decidable -- you can verify contract behavior before deployment.
- Clarity prevents reentrancy -- critical for a contract that holds user funds.

**Access control** is enforced via `tx-sender` checks:

- Only the vault owner can heartbeat, deposit, withdraw, or update heirs.
- Only registered heirs can claim, and only when the vault is claimable.
- Only the designated guardian can pause, and only once during the grace period.
- The guardian cannot withdraw, claim, heartbeat, or modify the vault in any way.

**Asset protection** uses Clarity 4's `restrict-assets?` to enforce exact transfer amounts as post-conditions within the contract itself.

**Owner recovery** is always possible. The owner can send a heartbeat even after the vault becomes claimable (if heirs have not yet claimed), and can emergency-withdraw at any point before full distribution.

**Known limitation:** If the owner's wallet is compromised, the attacker can send heartbeats (keeping assets locked) or emergency-withdraw (returning assets to the compromised wallet). This is inherent to any wallet-based system and is not specific to Heirloom.

---

## License

ISC
