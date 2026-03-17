# Heirloom Frontend

The web application for Heirloom -- The Bitcoin-Heartbeat Inheritance Vault. Built with React, TypeScript, Vite, and Tailwind CSS. Connects to the `heirloom-vault` Clarity smart contract on Stacks via `@stacks/connect` v8 and `@stacks/transactions` v7.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Pages and User Flows](#pages-and-user-flows)
- [Architecture](#architecture)
- [Contract Interaction Layer](#contract-interaction-layer)
- [Wallet Integration](#wallet-integration)
- [Contexts](#contexts)
- [Hooks](#hooks)
- [Components](#components)
- [Styling](#styling)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Tech Stack](#tech-stack)

---

## Getting Started

### Prerequisites

- Node.js v18 or later
- A Stacks wallet browser extension (Leather or Xverse)

### Install and Run

```bash
npm install
npm run dev
```

The development server starts at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

---

## Pages and User Flows

### Landing Page (`/`)

The entry point for new users. Presents the product value proposition and guides visitors toward vault creation or heir claiming.

Sections:
- **Hero** -- headline, tagline, and call-to-action buttons for "Create Vault" and "Claim Inheritance".
- **How It Works** -- four-step visual guide: create vault, deposit assets, maintain heartbeat, heirs claim.
- **Vault Lifecycle** -- state progression visualization showing the five vault states (created, active, grace, claimable, distributed).
- **Why Stacks** -- six feature cards highlighting `stacks-block-time`, `restrict-assets?`, sBTC, USDCx, Bitcoin finality, and Clarity safety.
- **Comparison** -- table comparing Heirloom against alternatives (seed phrase sharing, multisig, centralized custody, Sarcophagus).
- **CTA** -- final call-to-action with links to vault creation and claiming.
- **Footer** -- navigation links and disclaimers.

### Create Vault (`/create`)

A multi-step wizard that walks the vault owner through setup. Each step validates input before allowing progression.

**Step 0 -- Parameters:**
Set the heartbeat interval (1-365 days) and grace period (1-365 days). These define how often the owner must check in and how long heirs must wait after a missed heartbeat.

**Step 1 -- Heirs:**
Add up to 10 beneficiary addresses with percentage allocations. The form enforces that splits sum to exactly 100%. Each heir entry includes a Stacks principal address and a percentage input. An optional guardian address can be set.

**Step 2 -- Deposit:**
Deposit sBTC and/or USDCx into the vault. Displays the user's current token balances. Deposits are optional at creation time and can be made later from the dashboard.

**Step 3 -- Review and Confirm:**
Summary of all vault parameters, heirs, and deposit amounts. On confirmation, the app submits the `create-vault` transaction, waits for on-chain confirmation (polling every 5 seconds), then optionally submits deposit transactions, and redirects to the dashboard.

The creation flow displays transaction hashes with links to the Stacks Explorer for verification.

### Dashboard (`/dashboard`)

The vault owner's management interface. Requires wallet connection and an existing vault.

**Status Banner:**
Displays the current vault state (active, grace, claimable, distributed) with a color-coded indicator. Shows a real-time countdown timer that updates every second, displaying time remaining until the next state transition.

**Heartbeat Button:**
Prominent button to send a heartbeat transaction. Changes to a red/urgent style when the vault enters the grace period.

**Vault Statistics:**
- sBTC and USDCx locked amounts
- Heartbeat interval and grace period
- Creation date
- Last heartbeat timestamp

**Heirs List:**
Table showing each heir's address, percentage allocation, and claim status.

**Guardian Information:**
If a guardian is set, shows the guardian address and whether their pause has been used.

**Emergency Withdraw:**
Button to reclaim all vault assets. Returns all sBTC and USDCx to the owner and permanently closes the vault.

**Post-Distribution:**
When a vault is fully distributed (all heirs claimed or owner withdrew), the dashboard presents a prompt to create a new vault.

### Claim Inheritance (`/claim`)

The heir portal. Designed to be simple enough for non-technical users.

**Auto-Discovery:**
On wallet connection, the app scans recent contract transactions on the Hiro API to discover vaults where the connected address is a registered heir. This runs automatically and displays all found inheritances.

**Vault Cards:**
Each discovered vault shows:
- Vault owner address
- Vault status (active, grace, claimable, distributed)
- Heir's allocation percentage
- Calculated sBTC and USDCx share amounts
- Claim button (enabled only when vault is claimable and heir has not already claimed)

**Manual Lookup:**
A search field allows heirs to look up a specific vault by entering the owner's Stacks address. This is useful when the auto-discovery scan does not find the vault (e.g., the vault was created before the scan window).

**Claim Confirmation:**
After a successful claim transaction, displays the transaction hash with an explorer link.

### 404 Page (`/not-found`)

Simple not-found page with navigation back to the home page.

---

## Architecture

```
src/
  main.tsx               # React entry point, providers setup
  App.tsx                # Route definitions (React Router v6)
  index.css              # Global styles, Tailwind directives, custom classes
  pages/
    Index.tsx            # Landing page
    CreateVault.tsx      # Multi-step vault creation wizard
    Dashboard.tsx        # Vault management dashboard
    Claim.tsx            # Heir claiming portal
    NotFound.tsx         # 404 page
  contexts/
    WalletContext.tsx     # Wallet connection state and methods
    VaultContext.tsx      # Vault state, polling, and contract write methods
  hooks/
    useTokenBalances.ts  # Fetches sBTC and USDCx balances from Hiro API
    use-mobile.tsx       # Responsive breakpoint detection
  lib/
    contracts.ts         # All contract interaction functions
    utils.ts             # Utility functions (className merging)
  components/
    NavBar.tsx           # Top navigation bar with wallet dropdown
    HeroSection.tsx      # Landing page hero
    HowItWorksSection.tsx
    VaultLifecycleSection.tsx
    WhyStacksSection.tsx
    ComparisonSection.tsx
    CTASection.tsx
    FooterSection.tsx
    WalletConnectDialog.tsx  # Wallet selection modal
    ui/
      button.tsx         # Button component with variants
      dialog.tsx         # Radix UI dialog wrapper
      tooltip.tsx        # Radix UI tooltip wrapper
      toast.tsx          # Toast notification component
      toaster.tsx        # Toast container
      sonner.tsx         # Sonner toast integration
```

---

## Contract Interaction Layer

All smart contract interactions are centralized in `src/lib/contracts.ts`.

### Configuration

Contract address, name, and token contracts are read from environment variables (`VITE_CONTRACT_ADDRESS`, `VITE_CONTRACT_NAME`, `VITE_SBTC_CONTRACT`, `VITE_USDCX_CONTRACT`). The network is set by `VITE_NETWORK` (testnet or mainnet).

### Write Functions

Write functions require a connected wallet and produce transactions that the user must sign. They use `request('stx_callContract', ...)` from `@stacks/connect` v8.

| Function | Contract Call | Description |
|----------|-------------|-------------|
| `createVault()` | `create-vault` | Creates a new vault with heirs, intervals, and optional guardian |
| `depositSbtc()` | `deposit-sbtc` | Deposits sBTC into the caller's vault |
| `depositUsdcx()` | `deposit-usdcx` | Deposits USDCx into the caller's vault |
| `sendHeartbeat()` | `heartbeat` | Sends proof-of-life to reset the countdown |
| `claimInheritance()` | `claim` | Heir claims their share from a specific vault |
| `emergencyWithdraw()` | `emergency-withdraw` | Owner reclaims all assets |
| `guardianPause()` | `guardian-pause` | Guardian extends the grace period |
| `updateHeirs()` | `update-heirs` | Owner updates heir list and splits |

### Read Functions

Read functions do not require a wallet connection. They use `fetchCallReadOnlyFunction` from `@stacks/transactions` v7 and return parsed JSON via `cvToJSON`.

| Function | Contract Call | Description |
|----------|-------------|-------------|
| `getVaultStatus()` | `get-vault-status` | Returns full computed vault state |
| `getHeirInfo()` | `get-heir-info` | Returns a heir's split and claim status |
| `getHeirList()` | `get-heir-list` | Returns ordered list of heir addresses |

### Heir Discovery

| Function | Description |
|----------|-------------|
| `findVaultsForHeir()` | Scans recent contract transactions via the Hiro API to find vaults where the caller is a registered heir |
| `lookupSingleVault()` | Checks a specific vault owner to see if the caller is a registered heir |

---

## Wallet Integration

Wallet connectivity uses `@stacks/connect` v8:

- **`connect()`** -- Opens the wallet selection dialog (Leather or Xverse).
- **`disconnect()`** -- Disconnects the wallet.
- **`isConnected()`** -- Checks connection status.
- **`getLocalStorage()`** -- Retrieves the connected address from browser storage.

The `WalletContext` wraps wallet state and exposes `connectWallet()`, `disconnectWallet()`, `isConnected`, and `stxAddress` to the entire component tree.

Supported wallets:
- **Leather** (formerly Hiro Wallet)
- **Xverse**

The network parameter is passed as a string (`'testnet'` or `'mainnet'`), not a network object.

---

## Contexts

### WalletContext

Manages wallet connection lifecycle. Automatically restores the previous session on app load by checking localStorage. Provides the connected STX address to all consumers.

### VaultContext

Manages the owner's vault state. Features:

- **Auto-polling** -- Fetches vault status every 15 seconds (every 5 seconds when waiting for vault creation confirmation).
- **Transaction methods** -- Wraps contract write functions with state management (loading indicators, error handling).
- **Creation tracking** -- Monitors pending creation transactions and transitions to the dashboard when confirmed.
- **Distributed detection** -- Returns null for distributed vaults so the UI can prompt re-creation.

---

## Hooks

### `useTokenBalances(address)`

Fetches the connected user's sBTC and USDCx balances from the Hiro API (`/extended/v1/address/{address}/balances`). Uses TanStack React Query for caching, automatic refetching, and stale-while-revalidate behavior.

### `useIsMobile()`

Returns a boolean indicating whether the viewport width is below the mobile breakpoint (768px). Used for responsive layout decisions.

### `useToast()`

Provides toast notification methods via Sonner integration.

---

## Components

### Layout Components

- **NavBar** -- Sticky top navigation. Shows the Heirloom logo, navigation links (Create Vault, Dashboard, Claim), and a wallet connection button. When connected, displays the user's STX address and token balances in a dropdown. Includes a mobile hamburger menu.
- **HeroSection** -- Landing page hero with headline, subtext, and CTA buttons.
- **HowItWorksSection** -- Four-step visual guide with numbered cards.
- **VaultLifecycleSection** -- Horizontal state progression showing vault states with connecting arrows.
- **WhyStacksSection** -- Grid of feature cards explaining Stacks-specific advantages.
- **ComparisonSection** -- Table comparing Heirloom to alternative inheritance approaches.
- **CTASection** -- Bottom call-to-action with dual buttons.
- **FooterSection** -- Site footer with links and legal disclaimer.

### Dialogs

- **WalletConnectDialog** -- Modal showing Leather and Xverse wallet options with brand icons.

### UI Primitives

All UI primitives are in `src/components/ui/` and wrap Radix UI components with custom styling:

- **Button** -- Supports multiple color variants (lime, orange, cyan, pink, purple, yellow, red) and sizes. Uses the neo-brutalist design language.
- **Dialog** -- Modal dialog with overlay, close button, and content slot.
- **Tooltip** -- Hover tooltip with custom positioning.
- **Toast / Toaster / Sonner** -- Toast notification system.

---

## Styling

The application uses a **neo-brutalist** design language built on Tailwind CSS:

- **Font:** Space Grotesk (loaded via Google Fonts)
- **Borders:** 4px solid black borders (`neo-border`)
- **Shadows:** Offset box shadows in multiple sizes (`neo-shadow-sm`, `neo-shadow`, `neo-shadow-lg`)
- **Cards:** White background with black border and hover lift animation (`neo-card`)
- **Inputs:** Bordered inputs with focus scale transform (`neo-input`)
- **Colors:** Accent palette defined in Tailwind config -- pink, lime, cyan, orange, purple, yellow, red
- **Animations:** Float, pulse-slow, slide-up entrance, shake (error feedback), glow effects

Custom CSS classes are defined in `src/index.css` using Tailwind's `@layer components` directive.

---

## Environment Variables

Create a `.env` file in the `heirloom-app/` directory:

```
VITE_NETWORK=testnet
VITE_CONTRACT_ADDRESS=STZJWVYSKRYV1XBGS8BZ4F81E32RHBREQSE5WAJM
VITE_CONTRACT_NAME=heirloom-vault-v10
VITE_SBTC_CONTRACT=ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token
VITE_USDCX_CONTRACT=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
```

All variables are prefixed with `VITE_` so they are available to the client-side bundle at build time.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run build:dev` | Development build (unminified, with source maps) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint on all source files |
| `npm run test` | Run Vitest test suite once |
| `npm run test:watch` | Run Vitest in watch mode |

---

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 18.3.1 |
| Build Tool | Vite | 5.4.19 |
| Language | TypeScript | 5.8.3 |
| Styling | Tailwind CSS | 3.4.17 |
| Routing | React Router | 6.30.1 |
| Data Fetching | TanStack React Query | 5.83.0 |
| Wallet | @stacks/connect | 8.2.5 |
| Transactions | @stacks/transactions | 7.3.1 |
| UI Primitives | Radix UI (dialog, tooltip, toast) | latest |
| Icons | Lucide React | 0.462.0 |
| Notifications | Sonner | 1.7.4 |
| Testing | Vitest + Testing Library | latest |
