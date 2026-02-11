# Vision Chain

**AI-Powered EVM Blockchain with Gasless Transactions & Cross-Chain Bridge**

Vision Chain is a purpose-built EVM-compatible blockchain featuring a native AI wallet, gasless transactions via Paymaster, cross-chain bridging to Ethereum Sepolia, and an intent-based transaction system powered by Gemini AI.

---

## Architecture Overview

```
Vision Chain Ecosystem
├── Frontend (SolidJS + Vite)          → AI Wallet, Bridge UI, Explorer
├── Cloud Functions (Firebase)         → Paymaster, Bridge Relayer, Auth
├── Blockchain (Geth-based EVM)        → Custom L1 Chain (ChainID: 1337)
├── Smart Contracts (Solidity)         → VCN Token, Bridge, Staking, Paymaster
└── AI Services (Gemini)              → Intent Parsing, Chat, Image Gen
```

### Key Components

| Component | Description |
|-----------|-------------|
| **AI Wallet** | Chat-based wallet with natural language transaction execution |
| **Paymaster** | Gasless transaction system - users pay fees in VCN tokens |
| **Cross-Chain Bridge** | Vision Chain <-> Ethereum Sepolia with intent-based architecture |
| **Bridge Staking** | Validator staking for bridge security with reward distribution |
| **VisionScan** | Block explorer for Vision Chain transactions |
| **Admin Dashboard** | Network management, user analytics, and system controls |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SolidJS, TypeScript, Vite |
| Styling | Vanilla CSS, Motion (animations) |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Email/Password) |
| AI | Google Gemini API |
| Blockchain | Go-Ethereum (Geth), Hardhat |
| Smart Contracts | Solidity, OpenZeppelin |
| Hosting | Cloudflare Pages |
| Charts | ApexCharts |

---

## Project Structure

```
Vision-Chain/
├── components/              # SolidJS UI components
│   ├── Wallet.tsx           # Core AI wallet (main controller)
│   ├── Bridge.tsx           # Cross-chain bridge interface
│   ├── ValidatorStaking.tsx # Bridge staking UI
│   ├── VisionScan.tsx       # Block explorer
│   ├── admin/               # Admin dashboard components
│   ├── wallet/              # Wallet sub-components
│   ├── chat/                # Chat interface components
│   └── auth/                # Authentication components
│
├── services/                # Business logic & API services
│   ├── ai/                  # AI text/image generation (Gemini)
│   ├── bridge/              # Bridge service layer
│   ├── paymaster/           # Paymaster service layer
│   ├── contractService.ts   # Smart contract interactions
│   ├── firebaseService.ts   # Firestore CRUD operations
│   ├── walletService.ts     # Local wallet management
│   └── vcnPriceService.ts   # VCN price feed
│
├── functions/               # Firebase Cloud Functions
│   └── index.js             # Paymaster, Bridge Relayer, Auth, Email
│
├── blockchain/              # On-chain infrastructure
│   ├── contracts/           # Solidity smart contracts
│   ├── scripts/             # Deployment & utility scripts
│   ├── engine/              # Geth node configuration
│   └── genesis/             # Genesis block configuration
│
├── deploy/                  # Deployment configurations
├── docs/                    # Documentation
├── i18n/                    # Internationalization (ko/en)
└── public/                  # Static assets
```

---

## Smart Contracts

All contracts are deployed on Vision Chain v2 Testnet (ChainID: 1337).

| Contract | Description |
|----------|-------------|
| `VCNToken.sol` | ERC-20 token with EIP-2612 Permit (gasless approvals) |
| `VCNTokenSepolia.sol` | VCN token on Ethereum Sepolia |
| `VisionBridgeNative.sol` | Cross-chain bridge with intent commitment |
| `BridgeStaking.sol` | Validator staking with stakeFor/unstakeFor support |
| `VCNPaymasterV2.sol` | Gasless transaction executor |
| `VCNVestingNative.sol` | Token vesting schedule |
| `VisionMiningPoolNative.sol` | Mining reward distribution |
| `VisionNodeLicenseNative.sol` | Validator node license NFT |
| `IntentCommitment.sol` | Bridge intent commitment with challenge period |

### Deployed Addresses (v2 Testnet)

```
IntentCommitment:    0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
VisionBridgeSecure:  0x610178dA211FEF7D417bC0e6FeD39F05609AD788
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)

### 1. Install Dependencies

```bash
npm install
cd functions && npm install && cd ..
cd blockchain && npm install && cd ..
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Required environment variables:

```env
# AI
GEMINI_API_KEY=your_gemini_api_key

# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Blockchain RPC
VITE_RPC_URL=https://testnet.visionchain.co
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Run Staging Build

```bash
npm run dev:staging
```

---

## Deployment

### Frontend (Cloudflare Pages)

| Environment | Branch | URL |
|-------------|--------|-----|
| Staging | `staging` | https://staging.visionchain.co |
| Production | `main` | https://visionchain.co |

```bash
# Deploy to staging
git push origin main:staging

# Deploy to production (after staging test)
git push origin main
```

### Cloud Functions (Firebase)

```bash
# Staging
firebase deploy --only functions --project visionchain-staging

# Production
firebase deploy --only functions --project visionchain-d19ed
```

---

## Key Features

### AI-Powered Wallet
- Natural language commands: *"Send 100 VCN to Alice"*, *"Bridge 50 VCN to Sepolia"*
- Intent parsing with Gemini AI for transaction execution
- Batch transfers, scheduled transfers, cross-chain bridging via chat
- Multi-language support (Korean / English)

### Gasless Transactions (Paymaster)
- Users sign EIP-2612 Permit off-chain
- Paymaster executes transactions and pays gas fees
- Users only pay a VCN token fee (no ETH needed)
- Supports: transfers, bridges, staking, time-locked transfers

### Cross-Chain Bridge
- **Forward Bridge**: Vision Chain -> Ethereum Sepolia
- **Reverse Bridge**: Ethereum Sepolia -> Vision Chain
- Intent-based architecture with commit/lock/release flow
- Automated Bridge Relayer (runs every 2 minutes)
- Bridge fees forwarded to staking validators

### Validator Staking
- Stake VCN to secure the bridge
- Earn rewards from bridge transaction fees
- 7-day unstaking cooldown period
- Admin-configurable APY

---

## Cloud Functions Reference

| Function | Type | Description |
|----------|------|-------------|
| `paymaster` | HTTP | Unified gasless tx executor (transfer, bridge, stake, timelock) |
| `bridgeRelayer` | Scheduled | Processes committed bridge intents every 2 min |
| `secureBridgeRelayer` | Scheduled | Enhanced bridge relayer with verification |
| `checkBridgeCompletion` | Scheduled | Monitors and completes Sepolia transfers |
| `scheduledTransferTrigger` | Scheduled | Executes time-locked transfers |
| `weeklyActivityReport` | Scheduled | Sends weekly email reports |
| `inactivityNudge` | Scheduled | Sends nudge emails to inactive users |

---

## Development Notes

- **State Management**: SolidJS signals and stores (no external state library)
- **Wallet Security**: Client-side encrypted private keys with AES-256, mnemonic backup
- **API Pattern**: Frontend -> Firebase Cloud Function -> Blockchain RPC
- **Bridge Flow**: Permit sign -> Paymaster API -> commitIntent -> lockVCN -> Relayer -> Sepolia mint

---

## License

Proprietary - Antigravity / Vision AI
