# Vision Chain — Technical Whitepaper

### AI-Native EVM Layer-1 with Gasless Account Abstraction, Intent-Based Interoperability, and On-Chain DeFi

**Version 2.0 (As-Built) · July 2026**
**Network: Vision Chain v2 Testnet · ChainID `3151909` · Native token: VCN**

---

> **Scope & status.** This whitepaper documents Vision Chain **as it is actually implemented** in the production codebase as of July 2026. Every mechanism, parameter, contract address, and endpoint below is drawn from shipped code and deployment configuration. Forward-looking research concepts described in earlier vision documents (e.g. zero-knowledge aggregation layers, DAG mempools, novel consensus) are **out of scope** here unless they exist in code today. Components that are testnet-only or pilot-stage are labelled as such.

## Disclaimer

This document is provided for technical and informational purposes only. It does not constitute investment advice or a solicitation to buy or sell any asset. VCN is a utility token used to pay for transactions, services, and participation within the Vision Chain ecosystem. The network described herein currently operates as a **v2 testnet**; parameters, addresses, and features are subject to change as the protocol matures toward mainnet. Nothing in this document should be relied upon as a guarantee of future functionality or value.

## Abstract

Vision Chain is an **AI-native, EVM-compatible Layer-1 blockchain** that pairs a Go-Ethereum execution layer with a serverless application backend and a natural-language client to make on-chain activity accessible without the usual friction of gas management, key handling, and cross-chain complexity. The network runs as a Clique proof-of-authority chain (ChainID `3151909`) with VCN as its native, 18-decimal gas and utility token.

The as-built system delivers seven cooperating capabilities:

1. **Gasless account abstraction** — users pay fees in VCN via EIP-2612 permits while a server-side paymaster/relayer sponsors native gas; an ERC-4337 smart-account stack (account + factory + paymaster) is deployed alongside the production meta-transaction path.
2. **A natural-language AI wallet** — transfers, batch and scheduled sends, staking, and bridging are expressed conversationally, backed by a **multi-provider LLM layer** (Google Gemini, DeepSeek, MiniMax) with **server-side key custody** so provider secrets never reach the browser.
3. **An intent-based cross-chain bridge** to Ethereum Sepolia using a commit → lock → release protocol with per-user nonces, expiry, daily caps, optimistic challenge windows, and automated relayers.
4. **Validator staking** that secures the bridge and distributes both fixed-APY and fee-based rewards, with a two-step cooldown and slashing.
5. **Solvent**, an on-chain DeFi suite (spot DEX, perpetuals, lock-settlement vault, and a vUSD unit of account) built on an off-chain-match / on-chain-settle model — currently a testnet pilot.
6. **Vision Predict**, an AI prediction-market engine that couples an LLM decision with a deterministic server-side rule-check and full decision traceability.
7. **A resource-contribution node ecosystem** — desktop and mobile nodes performing chunk storage, block observation, and micro-relay — plus an external **Agent Gateway API** for programmatic, gasless agent participation.

The application tier is a single large **Firebase Cloud Functions** codebase (129 functions) holding all privileged signing keys and orchestrating the chain over a proxied RPC endpoint, with a **SolidJS** client that never touches privileged keys directly. The remainder of this document describes each layer in the order a reader would build it: chain, token, account abstraction, interoperability, staking, DeFi, the AI stack, the client, prediction, nodes, backend, and the cross-cutting security model.

---

## Table of Contents

1. [System Architecture & Technology Stack](#1-system-architecture--technology-stack)
2. [Blockchain Layer (Vision Chain L1)](#2-blockchain-layer-vision-chain-l1)
3. [VCN Token & Economic Model](#3-vcn-token--economic-model)
4. [Account Abstraction & Gasless Transactions (Paymaster)](#4-account-abstraction--gasless-transactions-paymaster)
5. [Cross-Chain Bridge (Intent-Based)](#5-cross-chain-bridge-intent-based)
6. [Validator Staking & Rewards](#6-validator-staking--rewards)
7. [Solvent — DeFi Layer (Gasless Bridge, DEX, Perpetuals)](#7-solvent--defi-layer-gasless-bridge-dex-perpetuals)
8. [AI Infrastructure — Multi-Provider LLM & Server-Side Proxy](#8-ai-infrastructure--multi-provider-llm--server-side-proxy)
9. [AI Intelligence — Intent Parsing, Tools, RAG & Memory](#9-ai-intelligence--intent-parsing-tools-rag--memory)
10. [AI Wallet & Client Architecture](#10-ai-wallet--client-architecture)
11. [Vision Predict — AI Prediction Market Engine](#11-vision-predict--ai-prediction-market-engine)
12. [Node Ecosystem & Agent Platform](#12-node-ecosystem--agent-platform)
13. [Backend Services (Firebase Cloud Functions)](#13-backend-services-firebase-cloud-functions)
14. [Security Model](#14-security-model)

15. [Implementation Status & Roadmap](#15-implementation-status--roadmap)
16. [Appendix — Deployed Addresses & Endpoints](#16-appendix--deployed-addresses--endpoints)

---

## 1. System Architecture & Technology Stack

Vision Chain is an AI-powered, EVM-compatible Layer-1 built on Go-Ethereum (Geth), fronted by a SolidJS single-page application and served by a Firebase Cloud Functions backend. Rather than a single monolith, the as-built system is organized into five cooperating layers, with Google Gemini models woven through the wallet, bridge, prediction, and agent surfaces to provide natural-language and automation capabilities.

### Architecture Overview

```
Vision Chain (as-built)
├── Frontend            SolidJS + Vite + TypeScript SPA  → Cloudflare Pages
├── Backend             Firebase Cloud Functions (Node.js 20, us-central1)
│                        + Firestore (database) + Firebase Auth (email/password)
├── Blockchain L1       Geth EVM, Clique PoA, ChainID 3151909 (v2 testnet)
├── Smart Contracts     Solidity + OpenZeppelin (VCN token, Paymaster,
│                        Bridge, Staking, Solvent DeFi, Node License, Vesting)
└── AI Services         Google Gemini (intent parsing, chat, image, agents)
```

The layers communicate through a consistent pattern: the frontend never talks to the chain directly for privileged actions. Instead it calls Cloud Functions (for example the unified `paymaster` HTTP function and the `agentGateway`), which hold executor keys and relay to the blockchain over RPC. Read paths (balances, transaction history, explorer) go through a Cloudflare-proxied RPC endpoint and Firestore indexes.

### Technology Stack

| Layer | Technology (verified in code) |
|-------|-------------------------------|
| Frontend framework | SolidJS 1.9, `@solidjs/router`, TypeScript 5.8 |
| Build / bundler | Vite 6 (`vite-plugin-solid`), manual-chunk code splitting |
| Charts / UI | ApexCharts, KLineCharts, Lightweight-Charts, Motion, Lucide, Marked, Mermaid |
| Frontend hosting | Cloudflare Pages (Wrangler) |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Database | Firebase Firestore |
| Auth | Firebase Auth (email/password), optional TOTP 2FA |
| AI | Google Gemini via `@google/genai` (2.0/2.5/3.x flash, pro, and image models) |
| Blockchain client | Go-Ethereum (Geth), Clique PoA consensus |
| Contract tooling | Solidity, Hardhat, OpenZeppelin Contracts 5.4, Ethers v6 |
| Web3 client lib | Ethers v6, BIP-39 mnemonic wallets |

### Blockchain L1 & Chain Parameters

The chain is defined by `genesis-vcn-native.json` and runs as a Clique proof-of-authority network. All EVM hard forks through London are enabled from genesis (block 0), so the chain is London/EIP-1559-capable. It is currently operated as the "Vision Chain v2 Testnet," and both the staging and production frontends point at the same shared chain.

| Parameter | Value |
|-----------|-------|
| Chain ID | `3151909` |
| Consensus | Clique PoA (`period: 3`, `epoch: 30000`) |
| Target block time | ~3 seconds |
| Gas limit | `30000000` |
| Hard forks | Homestead → London, all at block 0 |
| Native token | VCN (18 decimals) |
| Genesis signer | `0xf39Fd6…922266` (Clique extradata) |

RPC access is not exposed directly from the Geth node. It is fronted by a Cloudflare-hosted proxy and a block explorer:

| Endpoint | URL |
|----------|-----|
| Primary RPC (proxied) | `https://api.visionchain.co/rpc-proxy` |
| Alternate RPC host | `https://rpc.visionchain.co` (multi-node, e.g. `/node-8`, `/node-9`) |
| Tx submit | `https://api.visionchain.co/rpc/submit` |
| Block explorer (VisionScan) | `https://www.visionchain.co/visionscan` |

### Smart Contracts (deployed, v2 testnet)

Core contracts are deployed and referenced from the frontend environment files:

```
VCNToken (ERC-20 + EIP-2612):  0xf8a2F49C782447a8660554F7c3274cbd765b1963
VCNPaymaster (gasless exec):   0x28F40F9Da1c6D3c38fFDC1Fba80364B6bb21A1E3
BridgeStaking:                 0x009326c391012593Aeca601B09c02545E00Aa818
VisionBridgeSecure:            0x610178dA211FEF7D417bC0e6FeD39F05609AD788
```

The `blockchain/contracts` tree also includes the cross-chain bridge (`VisionBridgeNative`, `IntentCommitment`, `MessageInbox`), the Sepolia-side token (`VCNTokenSepolia`), vesting (`VCNVestingNative`), mining rewards (`VisionMiningPoolNative`), validator node licenses (`VisionNodeLicenseNative`), and the Solvent DeFi suite (`SolventPerp`, `SolventLockSettlement`/`Vault`/`Registry`, `SolventReserve`, `VisionStableUSD`, `DEXSettlement`). The Solvent contracts are deployed on chain (chainId 3151909) but remain early-stage: the vUSD stablecoin is recorded as a `pilot-unbacked` phase and the reserve self-test uses a mock USDT, so this surface should be treated as testnet/pilot only.

### Backend & AI Services

The backend is a single large Cloud Functions codebase (`functions/index.js`) exporting HTTP, callable, and scheduled functions in region `us-central1`. Key functions include the unified `paymaster` (gasless transfer / bridge / stake / timelock executor), the scheduled `bridgeRelayer` and `secureBridgeRelayer`, `checkBridgeCompletion`, `scheduledTransferTrigger`, `walletAiChat`, `agentGateway` and `agentExecutor`, plus prediction-market resolvers (`predictResolutionResolver`, `predictRetentionScrubber`) and email/reporting jobs. Executor and relayer private keys are injected as Cloud Functions secrets rather than shipped to the client.

AI is provided by Google Gemini through the `@google/genai` SDK. The codebase references a range of models depending on task — `gemini-2.5-flash` and `gemini-2.0-flash` for fast chat/intent parsing, `gemini-2.5-pro`/`gemini-3-pro` for heavier reasoning, and image models (`gemini-3-pro-image`, `gemini-3.1-flash-image`) for the Mint studio.

### Deployment Topology

Deployment is split into two Firebase projects with a shared blockchain. Frontend builds are mode-selected via Vite (`build:staging` / `build:production`) and hosted on Cloudflare Pages; environment is also auto-detected at runtime from the hostname.

| Environment | Frontend URL | Firebase project | Chain |
|-------------|--------------|------------------|-------|
| Staging | `staging.visionchain.co` | `visionchain-staging` | 3151909 (shared testnet) |
| Production | `visionchain.co` | `visionchain-d19ed` | 3151909 (shared testnet) |

A secondary Firestore project (`visionchain-5bd81`) is referenced for server-side transaction indexing. Because the L1 is shared across environments, staging and production differ mainly in their Firebase/Firestore backends and AI configuration, not in chain state.

### Major Product Surfaces

The SolidJS router exposes the following top-level surfaces:

- **AI Wallet** (`/wallet`) — chat-driven wallet with natural-language transfers, batch/scheduled sends, and cross-chain bridging.
- **Bridge** (`/bridge`) — Vision Chain ↔ Ethereum Sepolia, intent-based commit/lock/release relayed by Cloud Functions.
- **Staking** (`/staking`) — validator/bridge staking (`ValidatorStaking`) with reward distribution and unstaking cooldown.
- **Paymaster** (`/paymaster`) — gasless-transaction service where fees are paid in VCN via EIP-2612 permits.
- **Solvent DeFi** — on-chain spot DEX, perpetuals, lock-settlement vault, vUSD stablecoin and reserve (pilot/testnet).
- **Vision Predict** (`/predict`) — AI prediction markets with automated resolution and decision-trace UI.
- **Mint Studio** (`/mint`) — Gemini image-generation studio.
- **Agent Gateway** (`/agent`) — external-agent registration and API access backed by the `agentGateway` Cloud Function.
- **Vision Node** — downloadable/mobile node clients (`vision-node`, `vision-mobile-node`) plus admin node-health and license management.
- **VisionScan** (`/visionscan`) — the block explorer.
- **Admin Dashboard** (`/adminsystem/*`) — network, user, DeFi, AI, reward, email, and node management consoles.

---

## 2. Blockchain Layer (Vision Chain L1)

Vision Chain's base layer is an EVM-compatible Layer 1 built on **go-ethereum (Geth)**, operated as a permissioned Proof-of-Authority network. The implementation in the repository is a testnet/prototype deployment: a fixed set of Geth sealer nodes, a Kafka-backed shared sequencer service, an Nginx + application-level RPC proxy, and a SolidJS block explorer called **VisionScan**. This section documents what is actually built rather than the longer-term "sovereign L1 / Proof-of-Visibility" roadmap referenced in older planning documents.

### Client and Chain Parameters

The network runs the stock Ethereum client image `ethereum/client-go:v1.13.15`. Chain parameters are defined by two committed genesis files (`blockchain/genesis/genesis-vcn-native.json` and `mainnet-deploy/genesis.json`), which agree on the core identifiers:

| Parameter | Value | Source |
| :--- | :--- | :--- |
| Client | Geth `v1.13.15` | `docker-compose.yml` |
| Chain ID / networkid | `3151909` | genesis + node flags |
| Native gas token | `VCN` | testnet spec |
| Consensus engine | Clique (PoA) | genesis `config.clique` |
| Block period (native genesis) | `3` seconds | genesis |
| Block period (mainnet-deploy genesis) | `5` seconds | genesis |
| Clique epoch | `30000` | genesis |
| Gas limit | `30,000,000` (`0x1c9c380`) | genesis |
| Difficulty | `1` | genesis |

All hard forks through **London are activated at block 0** (`homestead` … `berlin`, `londonBlock: 0`), so the chain runs an EIP-1559 fee market on a pre-Shanghai EVM (no Shanghai/Cancun configuration is present, i.e. no PUSH0 or withdrawals semantics). The native token VCN is the gas currency; the genesis `alloc` pre-funds roughly fifty accounts, led by the well-known development address `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`, which is also encoded as the sole Clique signer in the native genesis `extradata` and used as the primary sealer/etherbase.

> Note on status: the block time is enforced by the Clique `period` (3s in the native genesis, 5s in the mainnet-deploy genesis). The `Vision_Testnet_Spec.md` "mental model" of a 2-second block time and a 1,000,000,000 VCN supply is aspirational and does not match the committed genesis values. A placeholder genesis embedded in the cluster bootstrap script additionally uses `chainId: 1337` and an 8M gas limit, and parts of the sequencer service hardcode a `chainId: 1337` ethers provider — remnants of an earlier local Hardhat configuration that are inconsistent with the `3151909` production genesis.

### Consensus and Node Topology

Consensus is Clique Proof-of-Authority with block sealing rotated among a fixed validator set. The reference deployment (`docker-compose.yml`) provisions a **five-node cluster** on a private `172.20.0.0/16` bridge network:

- **node-1** — bootnode and primary sealer, exposing RPC on `8545` and P2P on `30303`, mining under etherbase `0xf39F…2266`.
- **node-2 … node-5** — additional sealers ("validators"), each mining under its own unlocked etherbase, connecting to node-1 via a static `enode://…@172.20.0.11:30303` bootnode entry. Their RPC ports are mapped to `8546–8549` and P2P to `30304–30307`.

Each node runs with `--mine`, HTTP-RPC enabled (`eth,net,web3,admin,debug,clique`), `--http.corsdomain "*"`, `--allow-insecure-unlock`, `--maxpeers 25`, and resource caps of 2 GB RAM / 0.5 CPU. The same Compose file also stands up **Zookeeper and Kafka** (`confluentinc/cp-*:7.0.1`) that back the shared sequencer described below.

### Deployment Automation

Two shell scripts drive rollout:

1. `deploy_cluster.sh` / `scripts/deploy_vision_cluster.sh` — installs Docker/Compose if missing, creates per-node data and keystore directories under `deploy/v2-testnet/`, runs `geth init` against the genesis for each of the five nodes (wiping prior chaindata to avoid genesis mismatch), then `docker-compose up -d`. It prints the five local RPC endpoints (`http://localhost:8545`–`8549`).
2. `deploy_sequencer.sh` — rsyncs the shared-sequencer and traffic-generator sources to the production host (`admin@46.224.221.201`), installs production dependencies, and launches three long-running processes under **PM2**: `vision-api` (`server.js`), `vision-engine` (`sequencer-engine.js`), and `vision-traffic` (a load generator).

### Shared Sequencer

The sequencer (`blockchain/engine/vision-shared-sequencer/`) is a Kafka-based ordering service, not a modification of the Geth consensus itself. Its two components:

- **API (`server.js`)** — an Express service on port `3000`. It accepts transactions at `POST /rpc/submit`, tagging each with a `chainId`, `signedTx`, `type`, and VisionScan `metadata`, and publishes them to the Kafka topic `shared-sequencer-input`. It also exposes the explorer API (`/api/transactions`), a gasless paymaster relayer (`/rpc/paymaster/transfer`), a manual JSON-RPC proxy (`/rpc-proxy`), and `/health`.
- **Engine (`sequencer-engine.js`)** — a Kafka consumer that buffers submissions into a per-`chainId` in-memory mempool and flushes a batch every **500 ms** (`BATCH_INTERVAL_MS`) to a `chain-{chainId}-batches` topic, persisting an index row to a local **SQLite** database. Batches carry a placeholder `sequencerSignature` ("mock-sig-by-vision-sequencer") labelled as Proof-of-Authority.

This service is explicitly prototype-grade: transaction hashes are mocked for the non-EVM demo path, and durable transaction records for the explorer are written to **Firestore** (Firebase project `visionchain-d19ed`) rather than being derived solely from chain state.

### RPC Proxy and Security

Public RPC is fronted by **two proxy layers**. `setup_rpc_secure.sh` provisions **Nginx** as a TLS-terminating reverse proxy with Let's Encrypt/Certbot certificates, routing an RPC domain (e.g. `rpc.visionchain.co`) to the Geth node on `127.0.0.1:8545` and an API domain (e.g. `api.visionchain.co`) to the sequencer API on `127.0.0.1:3000`, with permissive CORS (`Access-Control-Allow-Origin: *`) and OPTIONS preflight handling. Deployment guidance specifies opening only ports 80/443 and never exposing `8545` directly. Inside the API, `server.js` additionally implements an application-level `/rpc-proxy` that forwards JSON-RPC POST bodies to the local Geth instance and normalizes CORS — this is the endpoint the front end actually consumes.

### VisionScan Block Explorer

**VisionScan** (`components/VisionScan.tsx`, `VisionScanHome.tsx`) is the network's block explorer, implemented as a SolidJS front end. It talks to the L1 through `https://api.visionchain.co/rpc-proxy` using ethers.js, polling live **block height** (`getBlockNumber`) and **gas price** (`getFeeData`) every 10 seconds, and reads VCN balances via ERC-20 `balanceOf` against the token contract `0xf8a2F49C782447a8660554F7c3274cbd765b1963` (18 decimals). Transaction data is served primarily from the Firestore `transactions` collection with the sequencer API as fallback and a direct RPC lookup for un-indexed hashes.

Distinctively, VisionScan defaults to an **accounting** view mode alongside a raw **blockchain** view: indexed transactions carry accounting metadata (journal entries, tax category, debit/credit net effect, confidence and trust status), reflecting the platform's bookkeeping focus. The explorer also includes mock detection for BTC and Solana address formats, though only EVM balances are read on-chain.

> The `vision-node` package in the repository is a separate **decentralized storage node** (chunked, SHA-256 content-addressed storage earning VCN rewards) and is distinct from the Geth sealer nodes that produce the L1 blocks; it does not participate in Clique consensus.

---

## 3. VCN Token & Economic Model

Vision Chain's economy is denominated in **VCN**. VCN plays a dual role in the implemented system: it is the network's native gas currency (defined in the chain genesis) and it is also represented by a canonical ERC-20 contract deployed on the v2 testnet. Around this core token sit a set of economic contracts — vesting, a native mining pool, a node-license NFT, a USD-pegged settlement stablecoin, and a wrapped-VCN adapter — plus an off-chain Reward Points program. This section describes each component strictly as it exists in the codebase, including where a contract is live on the v2 testnet versus only present as a local build/deployment artifact.

### The VCN ERC-20 (`VCNToken.sol`)

The canonical token is an OpenZeppelin-based ERC-20 combining `ERC20`, `ERC20Burnable`, `ERC20Permit` (EIP-2612) and `AccessControl`.

| Property | Value |
| :--- | :--- |
| Name / Symbol | `Vision Chain Token` / `VCN` |
| Decimals | 18 (OZ default) |
| EIP-2612 Permit | Yes — gasless approvals via signed `permit()` |
| `MAX_SUPPLY` | 10,000,000,000 VCN (10 billion) |
| Constructor mint | 4,000,000,000 VCN to the default admin |
| Minting | `mint()` gated by `MINTER_ROLE`, capped at `MAX_SUPPLY` |
| Burning | `ERC20Burnable` (`burn` / `burnFrom`) |
| Deployed (v2 testnet) | `0xf8a2F49C782447a8660554F7c3274cbd765b1963` (chainId 3151909) |

The `ERC20Permit` extension lets holders authorize transfers with an off-chain signature, which pairs with the network's paymaster/account-abstraction layer to enable gasless approvals. Roles are the standard `DEFAULT_ADMIN_ROLE` and `MINTER_ROLE`.

VCN is simultaneously the native gas token: the genesis config (`genesis-vcn-native.json`, chainId 3151909, Clique/PoA, 3-second period, 30M gas limit) allocates native VCN balances directly, and the testnet spec lists `VCN` as the network currency symbol. The `*Native`-suffixed economic contracts described below transact in this native balance via `msg.value` rather than through the ERC-20 interface.

### Cross-chain VCN (`VCNTokenSepolia.sol`)

A separate ERC-20 (`ERC20` + `ERC20Burnable` + `AccessControl`, name `VCN (Sepolia)`) represents VCN on Sepolia/Ethereum for bridging. It exposes `bridgeMint(to, amount, bridgeId)` gated by `BRIDGE_ROLE` and a permissionless `bridgeBurn(amount, bridgeId)`, emitting `BridgeMint` / `BridgeBurn` events. The intended invariant is supply conservation: VCN is locked on Vision Chain and minted on Sepolia, then burned on Sepolia and unlocked on Vision Chain. Note this variant does **not** include `ERC20Permit` and its `mint()` has no on-chain max-supply cap.

### Vesting (`VCNVestingNative.sol`)

Vesting is implemented for **native** VCN (payouts are native transfers, and the contract is funded via its `receive()` function). Each beneficiary has a single `VestingSchedule` created by `OPERATOR_ROLE` with:

- `initialUnlockRatio` — a percentage (0–100) released immediately at start.
- `cliffMonths` — cliff duration, computed as `cliffMonths * 30 days`.
- `vestingMonths` — linear vesting after the cliff, computed as `vestingMonths * 30 days`, released in monthly (30-day) intervals.

`availableToClaim()` computes vested amount as the initial unlock plus per-interval linear release after the cliff; `claim()` is `nonReentrant` and transfers native VCN. An admin-only `convertToNode()` terminates a schedule (emitting `ConvertedToNode` / `VestingTerminated`) so remaining locked value can be redirected toward node participation. Concrete per-recipient amounts and ratios are parameters supplied at schedule creation, not hard-coded constants.

### Mining Pool (`VisionMiningPoolNative.sol`)

The mining pool pays validators/node operators in native VCN and encodes an emission schedule directly in its rule set:

- **Total mining supply:** `TOTAL_MINING_SUPPLY` = 10,000,000,000 VCN, intended over 20 years.
- **Stage 1 allocation:** 50% (5,000,000,000 VCN); `dailyCap` = stage allocation ÷ 365.
- **Halving trigger (whichever first):** 365 days elapsed since the stage start, **or** 250 new paid validator nodes activated in the stage (`NODE_GROWTH_TRIGGER`). On halving, any unmined remainder of the stage is added to `burnedSupply` and the next stage's allocation is halved.
- **Per-node daily reward:** `dailyCap × (nodeMultiplier / totalNetworkHashPower) × (AOR / 100)`, where AOR (daily operating/availability rate, 0–100) is submitted per node by a trusted `oracleAddress`. Rewards are keyed to node-license token IDs; `claimReward()` is `nonReentrant`, re-checks halving conditions, and enforces the stage supply ceiling and pool balance.

### Node License NFT (`VisionNodeLicenseNative.sol`)

Node licenses are ERC-721 tokens (`VisionNodeLicense` / `VNODE`) that gate mining eligibility and carry a reward multiplier. Three tiers are implemented:

| Tier | Max supply | Multiplier | Price (native VCN) | Issuance |
| :--- | :--- | :--- | :--- | :--- |
| Founder | 12 | 30× | not for sale | admin `distributeFounderNode()` |
| Enterprise | 500 | 12× | 500,000 VCN | `purchaseLicense()` |
| Validator | 5,000 | 1× | 70,000 VCN | `purchaseLicense()` |

`purchaseLicense()` is `payable`: it forwards the price to the `treasury`, refunds any excess, and mints the NFT bound to a node UUID. Operators call `activateNode()` / `deactivateNode()`; the mining pool reads each token's tier multiplier and active flag when computing rewards. Prices are adjustable by the owner via `setPrice()`.

### Vision USD Stablecoin (`VisionStableUSD.sol`)

`vUSD` (`Vision USD`) is a USD-pegged, 18-decimal settlement asset for the on-chain Solvent DEX. It extends `ERC20`, `ERC20Burnable`, `ERC20Pausable`, `ERC20Permit` and `AccessControl` with `MINTER_ROLE`, `PAUSER_ROLE` and `ATTESTOR_ROLE`. Issuance is controlled (only the treasury/minter can mint), and it includes a proof-of-reserves surface: `declareReserves()` publishes attested backing and `collateralizationBps()` returns reserves ÷ supply in basis points (10000 = 1:1). The contract documents a two-phase lifecycle — Phase 1 pilot (unbacked) and Phase 2 backed 1:1 by custodied USDT. On the v2 testnet it is deployed at `0xD0BB17B69801b9a76caD1aA0e0710B8b01625D10` in the `pilot-unbacked` phase with an initial mint of 10,000,000 vUSD.

### Wrapped VCN (`WrappedVCN.sol`)

`wVCN` (`Wrapped Vision Chain Token`) is a WETH-style wrapper (`ERC20` + `ERC20Burnable` + `ERC20Permit`) so ERC-20-only contracts can hold native VCN. Users `deposit()` native VCN to mint wVCN 1:1, `withdraw()` to redeem, and the `receive()` fallback auto-wraps incoming native VCN. No deployment record for wVCN was found in the v2 testnet artifacts, so it should be treated as available in source but not confirmed deployed.

### Reward Points (RP) — off-chain incentive layer

The **RP (Reward Points)** system is implemented off-chain in the backend (`functions/index.js`), not as an on-chain token. Balances live in Firestore (`user_reward_points`, with `rp_history` logs) and per-action amounts are configurable via `config/rp_rewards`, falling back to code defaults such as: referral 10 RP, level-up 100 RP, agent transfer/batch 5 RP, staking deposit 20 RP, staking compound 25 RP, bridge initiate 15 RP, NFT mint 30 RP, referral inviter/invitee 50/25 RP, and daily mobile-node 5 RP. RP awards propagate up a two-tier referral tree (Tier 1 ≈ 10%, Tier 2 ≈ 2%, both configurable), with loop-prevention that skips re-propagating referral-derived award types.

### Implementation status summary

- **Live on the v2 testnet (chainId 3151909):** the VCN ERC-20 (`0xf8a2…1963`), the paymaster and bridge-staking contracts, and `vUSD` (`0xD0BB…5D10`, pilot/unbacked).
- **Present but recorded only against local/Hardhat deployment addresses** (`deployed-addresses.json` uses the well-known deterministic Hardhat addresses): `VCNVestingNative`, `VisionNodeLicenseNative`, `VisionMiningPoolNative`. These are functional and locally deployed, but not confirmed on the live testnet.
- **In source, no deployment artifact found:** `WrappedVCN`, `VCNTokenSepolia` (the latter depends on the cross-chain bridge deployment).
- **Off-chain:** the RP incentive program.

Note also that three distinct supply figures appear in the code and are not fully reconciled into a single tokenomics model: the ERC-20's 10B `MAX_SUPPLY` (4B pre-minted), the mining pool's 10B emission schedule over 20 years, and the testnet genesis "initial supply" of 1B native VCN. Each is faithfully implemented in its own artifact.

---

## 4. Account Abstraction & Gasless Transactions (Paymaster)

Vision Chain lets end users transact without holding native gas. The platform ships two distinct-but-complementary mechanisms: a set of ERC-4337 smart-account and paymaster contracts, and — the path actually used in production today — an EIP-2612 permit + sponsored-relayer flow implemented as a Firebase Cloud Function. Both are grounded in the same on-chain primitive: the VCN token implements OpenZeppelin `ERC20Permit`, so allowances can be granted with an off-chain signature instead of a gas-paying `approve` transaction.

### On-chain ERC-4337 components

The `blockchain/contracts` directory contains a complete, EntryPoint-compatible account-abstraction stack built on the `@account-abstraction` library:

- **`VCNAccount`** — an ERC-4337 smart-contract wallet (`BaseAccount`, UUPS-upgradeable, `TokenCallbackHandler`). It validates UserOperations by ECDSA-recovering the owner from the signed `userOpHash`, and exposes `execute` / `executeBatch`, callable only by the owner or the EntryPoint. It targets EntryPoint v0.6 semantics (`UserOperation` calldata).
- **`VCNAccountFactory`** — deploys `VCNAccount` instances as `ERC1967Proxy` clones via `CREATE2`. `createAccount(owner, salt)` is idempotent, and `getAddress(owner, salt)` returns the counterfactual address so accounts can be funded before deployment.
- **`VCNPaymasterV2`** — a production-grade `BasePaymaster` wired to **EntryPoint v0.7** (`0x0000000071727de22e5e9d8baf0edac6f37a0521`). It parses the standard `paymasterAndData` layout (`validUntil`, `validAfter`, signature), verifies an off-chain `verifyingSigner`, enforces a per-user daily gas limit (default 0.5 ETH-equivalent) and a 500 gwei max fee, and forwards received native funds to the EntryPoint's `depositTo`. Deployment scripts (`deploy_paymaster_v2.js`, `deploy-paymaster-direct.cjs`) set the deployer as both owner and verifying signer and pre-fund the paymaster.
- **`VCNPaymaster`** — an early, simplified paymaster whose `_validatePaymasterUserOp` unconditionally returns success; effectively a stub.
- **`VCNPaymasterNative`** — a standalone `Ownable`/`ReentrancyGuard` paymaster for the native-VCN model. It manages user deposits, a sponsored-gas pool, MPC (`m`-of-`n`) signer verification, whitelisted target contracts, and a per-user daily gas cap (default 0.1 VCN).

> Implementation status: these contracts compile and are deployable, but the live user-facing gasless experience does **not** route UserOperations through a bundler/EntryPoint. `VCNPaymasterV2` additionally ships in an "adaptive/discovery" mode where an invalid paymaster signature is currently logged rather than rejected — this must be hardened before mainnet. The active production mechanism is the permit-relayer described below.

### Production gasless flow: EIP-2612 permit + sponsored relayer

The gasless UX that the wallet, bridge, and staking UIs invoke is the unified **`paymaster`** HTTPS Cloud Function (`onRequest`, `functions/index.js`), reachable at `https://paymaster-sapjcm3s5a-uc.a.run.app` (and the equivalent `.../cloudfunctions.net/paymaster`). The model is a meta-transaction relay:

1. The user signs an **EIP-712 `Permit`** off-chain in their wallet. Domain: `{ name: "Vision Chain Token", version: "1", chainId: 3151909, verifyingContract: <VCN token> }`; the `spender` is the paymaster executor wallet and `value` is `amount + fee`. No gas is spent by the user.
2. The frontend POSTs `{ type, user, recipient, amount, fee, deadline, signature, ... }` to the `paymaster` endpoint.
3. The Cloud Function connects to Vision Chain (explicit network `chainId 3151909` to avoid an ethers v6 `eth_chainId` hang), loads the executor wallet from the `VCN_EXECUTOR_PK` secret, and — under a Firestore distributed lock (`_system/paymaster_lock`, 120 s TTL) with nonce-gap detection/auto-fill — submits `permit(user, executor, amount+fee, deadline, v, r, s)` followed by `transferFrom(...)`.
4. The **executor wallet pays the native gas**; the user pays a service fee denominated in VCN (default **1 VCN**). Confirmed transactions are indexed to Firestore.

Because the fee and transfer are pulled from the user's balance via the permit-granted allowance, the user never needs native gas — the executor EOA fronts it.

### Supported gasless operations

The single `paymaster` endpoint routes on a `type` field:

| `type` | Behavior |
|--------|----------|
| `transfer` | Immediate `permit` → `transferFrom(user → recipient, amount)`; default fee 1 VCN. |
| `timelock` | Persists a signed job to Firestore `scheduledTransfers` with `unlockTime`; a scheduler executes it later. Emits a user notification. |
| `batch` | One permit for `sum(amounts) + fee`, then multiple `transferFrom` calls to each recipient. |
| `bridge` | `permit` → `transferFrom` total to executor → `commitIntent(recipient, amount, destChainId)` on the IntentCommitment contract; bridges VCN toward Ethereum/Sepolia. Fee 1 VCN, forwarded to the staking reward pool. |
| `staking` | `stake` / `unstake` / `withdraw` / `claim` executed on the user's behalf via `stakeFor` / `requestUnstakeFor` / `withdrawFor` / `claimRewardsFor`; the 1 VCN fee is forwarded to the staking pool via `depositFees`. |
| `agent_execution` | Gasless execution path for agent accounts. |
| `admin_transfer` | Foundation-wallet → user distribution (no permit/fee). |
| `sepolia_transfer` | Sponsored transfer on Ethereum Sepolia (uses `SEPOLIA_RELAYER_PK`). |
| `health`, `flush_nonce` | Operational endpoints (RPC diagnostics; clear stuck executor nonces). |

### Deployed parameters (v2 Testnet)

```
Chain ID:               3151909 (Vision Chain v2 Testnet)
Native / fee token:     VCN
VCN Token (ERC20Permit):0xf8a2F49C782447a8660554F7c3274cbd765b1963
Deployed Paymaster:     0x28F40F9Da1c6D3c38fFDC1Fba80364B6bb21A1E3  (VITE_PAYMASTER_ADDRESS)
Paymaster executor/spender (EOA that pays gas):
                        0x805E8DB0175aeC75d2e2852aD14092466C281e3b
EntryPoint (for VCNPaymasterV2): 0x0000000071727de22e5e9d8baf0edac6f37a0521 (v0.7)
BridgeStaking:          0x009326c391012593Aeca601B09c02545E00Aa818
VisionBridgeSecure:     0x610178dA211FEF7D417bC0e6FeD39F05609AD788
Cloud Function:         https://paymaster-sapjcm3s5a-uc.a.run.app
Default service fee:    1 VCN per sponsored op
```

Note: the repository labels the deployed `0x28F40F9…` contract inconsistently (as `VCNPaymasterNative` in the README address block and `VCNPaymasterV2.sol` in the contract table). It is referenced by the frontend as the on-chain paymaster/pool, while actual gas sponsorship for transfers, staking, and bridging is performed by the executor EOA through the Cloud Function.

### "Grand Paymaster" roadmap layer

The `docs/GRAND_PAYMASTER_PRD_V1.1_KO.md`, `PAYMASTER_IMPLEMENTATION_PLAN_KO.md`, and `PAYMASTER_ADMIN_MANUAL_KO.md` describe a broader multi-chain sponsorship platform — Admin/Developer consoles, per-dApp sponsor pools and caps, a Quote→Deduct→Execute→Settle fee engine, TSS/MPC signing, an autonomous agent-node state machine (`NORMAL`/`SAFE_MODE`/`THROTTLED`/`PAUSED`), and orchestrated rebalancing. The current codebase realizes this as UI plus service scaffolding (`src/services/paymaster/` contains `ChainAdapter.ts`, `NonceManager.ts`, and `types.ts`) with mock bridge adapters and simulated timelocks/health checks; several capabilities (e.g., explorer indexing endpoints) are explicitly marked as future work. It should be read as a roadmap around the working permit-relayer core, not as shipped mainnet infrastructure.

---

## 5. Cross-Chain Bridge (Intent-Based)

Vision Chain implements a native cross-chain bridge that moves VCN between Vision Chain and Ethereum Sepolia. The current design is an **intent-based commit/lock/release** bridge: a user first commits a signed *intent* on-chain, then locks native VCN against that intent, and an automated relayer releases (mints or unlocks) the equivalent VCN on the destination chain after a challenge window. The bridge is testnet-only and, on the live execution path, semi-custodial — an operator relayer and admin custody wallet perform the destination-chain settlement while the on-chain contracts enforce intent integrity, rate limits, and supply accounting.

### Contract architecture

The active bridge is a three-contract suite on Vision Chain, plus an ERC-20 VCN token on the Sepolia side:

- **`IntentCommitment`** — records a user's bridge intent before any funds move. The intent hash is `keccak256(sender, recipient, amount, nonce, expiry, destChainId)`. It enforces per-user nonces, a 24-hour validity/expiry window (`intentValidityPeriod`), a `maxDailyCommits` limit (default 10 per address/day), and min/max amounts (0.1 VCN to 1,000,000 VCN). `verifyAndUseIntent(...)` (restricted to `OPERATOR_ROLE`) marks an intent consumed, preventing replay.
- **`VisionBridgeSecure`** — the lock/release vault. `lockVCN(intentHash, recipient, destChainId)` is `payable`, verifies the committed intent, records a `LockRecord`, and tracks supply conservation (`totalLocked` vs `totalUnlocked`). It enforces a per-user daily lock cap (100,000 VCN), a global daily limit (10,000,000 VCN), and per-tx bounds (1 VCN to 1,000,000 VCN). Releases via `unlockVCN(...)` are gated on `TSS_ROLE` and require at least 3 signatures (a 3/5 threshold model). It also provides user-initiated emergency recovery: `requestRecovery` (allowed 24 h after lock) followed by `executeRecovery` after a `recoveryDelay` of 7 days.
- **`MessageInbox`** — an optimistic settlement state machine. A TSS operator calls `submitPending(...)` to register a destination message; the message becomes finalizable only after a challenge period, and challengers may dispute it. Challenge periods are amount-tiered (10 minutes for small, 30 minutes for medium, 2 hours for large transfers), and challengers must post a bond (0.1 VCN).
- **`VCNToken` (Sepolia)** — the Ethereum-side representation, described below.

A legacy `VisionBridgeNative` contract also exists, implementing a simpler N-of-M relayer multisig (`lockVCN` / `unlockVCN` with `requiredSignatures` ECDSA relayer signatures and per-day volume limits). The intent-based `VisionBridgeSecure` suite supersedes it for new flows.

> Note: an architecture decision record (ADR-001) proposes a hybrid LayerZero + MPC-TSS transport. That transport is **not** present in the deployed contracts; the implemented bridge is a custom intent-commit + relayer design with an optimistic `MessageInbox`.

### Forward bridge: Vision Chain → Ethereum Sepolia

The forward path is orchestrated by the Firebase `paymaster` function (gasless for the user) and completed by the scheduled `bridgeRelayer`:

1. The user signs an EIP-712 permit authorizing the paymaster to pull `amount + fee` VCN.
2. The paymaster executes the permit and a single `transferFrom` for `amount + fee`, then calls `commitIntent(recipient, amount, dstChainId)` and `lockVCN(intentHash, recipient, dstChainId)`, funding the lock from the admin balance. The bridge record is written to Firestore with status `LOCKED`.
3. The `bridgeRelayer` (every 2 minutes) picks up locked/committed bridges past the challenge cutoff and calls `bridgeMint(recipient, amount, bridgeId)` on the Sepolia VCN token, minting VCN 1:1 to the recipient. Status advances to `COMPLETED` and completion notifications (in-app + email) are sent.

### Reverse bridge: Ethereum Sepolia → Vision Chain

The reverse path (`handleReverseBridge`) burns/locks on Sepolia and releases on Vision Chain:

1. The user signs an EIP-712 permit on the Sepolia VCN token.
2. The Sepolia relayer executes the permit, collects the fee, and `transferFrom`s the bridge amount into relayer custody (the lock leg on Sepolia).
3. The admin wallet then sends the equivalent VCN on Vision Chain to the recipient (ERC-20 `transfer`, falling back to native VCN). A `reverseBridgeTransactions` ledger record is written; if the Vision-side transfer fails after the Sepolia lock, the event is recorded to `reverseBridgeFailures` for manual resolution.

### Automated relayers and challenge period

Bridge automation runs as scheduled Firebase Cloud Functions:

| Function | Trigger | Role |
|---|---|---|
| `bridgeRelayer` | every 2 minutes (Asia/Seoul) | Processes `COMMITTED`/`LOCKED`/`PENDING` bridges past the challenge cutoff; mints on Sepolia or unlocks on Vision Chain; retries recently `FAILED` bridges within 1 hour |
| `checkBridgeCompletion` | every 5 minutes | Confirms destination settlement after a 10-minute challenge window and marks records `FINALIZED` |
| `checkBridgeStatus` | HTTP (manual) | Returns bridge status by `txHash` |
| `updateBridgeLimits` | HTTP (admin) | Calls `setLimits(...)` on `VisionBridgeSecure` to adjust min/max and daily caps |

The challenge/commitment period is currently short for testnet: the relayer uses `CHALLENGE_PERIOD_MINUTES = 2` (with an in-code note that production targets ~15 minutes), while the completion checker enforces a 10-minute window. On the paymaster lock path the `challengeEndTime` is presently set to the current time ("Testnet: immediate — no challenge logic yet"), so the optimistic dispute machinery in `MessageInbox` and the standalone `BridgeChallenger`/`BridgeFinalizer`/`BridgeTSSSigner` daemons exist in code but are not yet the enforced hot path. These TSS/challenger services poll on intervals (e.g. 30 s) and target `submitPending`/`finalize`/`submitChallenge`.

### Bridge fees and validator rewards

The default bridge fee is **1 VCN** per transfer. On the forward path, after collecting `amount + fee`, the paymaster forwards the fee to the `BridgeStaking` contract via `approve` + `depositFees`. In `BridgeStakingNative`, `depositFees` (restricted to the bridge) credits a `feePool` and increments `accRewardPerShare` pro-rata across staked validators, so bridge fees accrue as staking rewards on top of the contract's fixed-APY reward pool (`targetAPY` in basis points, capped at 50%). On the reverse path, the 1 VCN fee is collected by the Sepolia relayer to cover Ethereum gas. Fee forwarding to staking is best-effort ("fire-and-forget") and does not block settlement.

### The Sepolia-side VCN token

The Ethereum representation is a standard `ERC20` + `ERC20Burnable` token named "VCN (Sepolia)" with symbol `VCN`, keeping a consistent ticker across chains. It uses `AccessControl` with `MINTER_ROLE` and `BRIDGE_ROLE`. The relayer holds `BRIDGE_ROLE` and calls `bridgeMint(to, amount, bridgeId)` when VCN is bridged in; users call `bridgeBurn(amount, bridgeId)` when bridging back. Supply is conserved: VCN locked on Vision Chain is minted on Sepolia, and burned/locked on Sepolia is unlocked on Vision Chain.

### Deployed addresses (testnet)

The live frontend and the committed `deployed-bridge-secure.json` reference the following Vision Chain testnet deployment:

| Component | Address |
|---|---|
| IntentCommitment | `0x7F5883b2F48D87b3C15cACb8764A00291A58ce78` |
| MessageInbox | `0x785bcD75294b45D855883B75CdDE3e3bA237EF40` |
| VisionBridgeSecure | `0xFDA890183E1e18eE7b02A94d9DF195515D914655` |
| Bridge admin | `0xd4FeD8Fe5946aDA714bb664D6B5F2C954acf6B15` |
| Native bridge custody (relayer) | `0x28F40F9Da1c6D3c38fFDC1Fba80364B6bb21A1E3` |
| BridgeStaking (fee sink, V3) | `0x009326c391012593Aeca601B09c02545E00Aa818` |
| VCN token (Ethereum Sepolia) | `0x07755968236333B5f8803E9D0fC294608B200d1b` |

Chains involved are Vision Chain (labeled "v2 Testnet," chain ID 3151909 in the client; the deployment artifact records chain ID 1337) and Ethereum Sepolia (11155111). The bridge UI scaffolds additional targets — Polygon Amoy (80002) and Base Sepolia (84532) — but their VCN token addresses are empty/TODO, so those routes are not yet live. Backend paymaster code references a separate local deployment snapshot for the intent/bridge contracts, reflecting that these addresses are testnet artifacts under active iteration.

### Implementation status

- **Working (testnet):** intent commit → lock → relayer release for VCN in both directions; gasless UX via EIP-712 permit + paymaster; on-chain intent replay protection, rate limits, and supply accounting; bridge-fee routing into validator staking rewards; Sepolia VCN mint/burn.
- **Partial / not yet enforced:** the optimistic challenge/dispute flow (`MessageInbox`, challenger/finalizer/TSS daemons) and full 3/5 TSS-signed unlocks are implemented in code but the production hot path uses a short (2-minute) window and admin/relayer custody rather than fully trust-minimized settlement. Effective decentralization of releases is therefore still limited on testnet.

---

## 6. Validator Staking & Rewards

Vision Chain secures its cross-chain bridge with an economic-security layer: validators lock VCN into the `BridgeStaking` contract, earn rewards funded by a foundation subsidy pool and by bridge transaction fees, and forfeit half of their stake if slashed for misbehavior. This section describes the deployed staking contract, the reward mechanics, the gasless user flow, and the off-chain Reward Points (RP) incentive layer — strictly as implemented.

### Deployed contract and core parameters

The production staking contract is `BridgeStaking` (ERC-20 variant, tagged "V3 — with stakeFor"), deployed on Vision Chain v2. Its parameters are hard-coded constants:

| Item | Value |
| --- | --- |
| Network / chainId | Vision Chain v2 / `3151909` |
| BridgeStaking (V3) | `0x009326c391012593Aeca601B09c02545E00Aa818` |
| Staking token (VCN) | `0xf8a2F49C782447a8660554F7c3274cbd765b1963` |
| `MINIMUM_STAKE` | 100 VCN (`100 * 1e18`) |
| `COOLDOWN_PERIOD` | 7 days |
| `SLASH_PERCENTAGE` | 50% |
| `MAX_APY` | 5000 basis points (50% cap) |

The same address is recorded in the repo's deployment manifest, README, function config, and the front-end component, giving a consistent single source of truth.

A sibling contract, `BridgeStakingNative`, implements the identical design using the native gas token (`msg.value`) instead of an ERC-20 transfer, with a higher `MINIMUM_STAKE` of 10,000 VCN. It exists in source but is not listed among the deployed Vision Chain v2 addresses; the live system uses the ERC-20 `BridgeStaking`.

### Staking, unstaking, and slashing

`BridgeStaking` is an `Ownable`, `ReentrancyGuard`-protected contract that tracks each validator in a `ValidatorInfo` struct (staked amount, unstake request time, unstake amount, reward debt, pending rewards, active flag). Two parallel entry-point families exist:

- **Self-service (user-signed):** `stake`, `requestUnstake`, `withdraw`, `cancelUnstake`, `claimRewards`.
- **Delegated (owner-only, relayer/Paymaster pattern):** `stakeFor(beneficiary, amount)`, `requestUnstakeFor(beneficiary, amount)`, `withdrawFor(beneficiary)`, `claimRewardsFor(beneficiary)`. In `stakeFor`, tokens are assumed to have already been moved into the contract by the Paymaster, so no `transferFrom` occurs; the beneficiary — not the caller — is registered as the validator and receives withdrawals and rewards.

Staking flow: a deposit that brings a validator to at least `MINIMUM_STAKE` auto-activates them (`ValidatorActivated`). Unstaking is a two-step, cooldown-gated process — `requestUnstake` records the amount and timestamp and starts the 7-day `COOLDOWN_PERIOD`; `withdraw` succeeds only after `unstakeRequestTime + COOLDOWN_PERIOD`. Partial unstakes are rejected if they would leave a non-zero balance below `MINIMUM_STAKE`; a full unstake deactivates the validator. A pending unstake can be reversed with `cancelUnstake`.

Slashing is enforced by `slash(validator, challenger)`, callable only by the registered `bridge` address. It forfeits the validator's pending rewards, removes 50% of their stake, deactivates them if the remainder falls below the minimum, and transfers the slashed VCN to the challenger who raised the valid challenge.

### Reward distribution: dual pools and fixed APY

Rewards are sourced from two on-chain pools and distributed through a standard `accRewardPerShare` accumulator (scaled by `PRECISION = 1e18`):

1. **Reward pool (subsidy):** foundation pre-funding added via `fundRewardPool` (owner-only), drained gradually according to a configurable target APY.
2. **Fee pool:** bridge revenue deposited by `depositFees`, callable only by the bridge. Fees are immediately distributed to stakers by incrementing `accRewardPerShare` by `amount * PRECISION / totalStaked`.

The fixed-APY accrual, computed in `_updateRewards`, releases from the reward pool per unit time:

```
apyReward = totalStaked * targetAPY * timeDelta / (365 days * 10000)
```

The amount is capped by the remaining `rewardPool` balance, so accrual naturally halts when the subsidy is exhausted. Rewards are updated before any stake/unstake/claim/slash state change to keep accounting exact. `pendingReward(account)` projects unrealized APY plus fee share for the UI, and `getRewardInfo` exposes pool balances, target APY, total staked, and total rewards paid. `claimRewards` transfers accrued VCN and resets the validator's reward debt.

### Admin-configurable APY and pool funding

APY and funding are operated through owner-gated on-chain setters and two Cloud Functions:

- `setTargetAPY(apyBasisPoints)` (owner-only, must be ≤ `MAX_APY`) sets the annual rate in basis points (e.g. 1200 = 12%).
- `adminSetAPY` (HTTPS function, guarded by `ADMIN_SECRET`) accepts a percentage between 1 and 50, converts it to basis points, calls `setTargetAPY`, and logs the transaction to `admin_apy_logs`.
- `adminFundPool` (HTTPS function, `ADMIN_SECRET`-guarded) checks the admin VCN balance, approves the contract if needed, calls `fundRewardPool`, and logs to `admin_fund_logs`. `withdrawRewardPool` allows the owner to reclaim unspent subsidy.

The staking UI advertises an indicative 12–20% APY range; the enforced on-chain value is whatever `targetAPY` is currently set to, plus any fee-pool distributions on top.

### Gasless user experience (Paymaster)

The `ValidatorStaking` component never requires the user to hold gas. For staking, it signs an EIP-712 `Permit` (domain chainId `3151909`) authorizing the Paymaster admin to pull the stake amount plus a 1 VCN service fee, then POSTs the signed permit to the Paymaster API with `stakeAction: "stake"`. Unstake, withdraw, and claim actions likewise call the Paymaster, which relays them on-chain through the `stakeFor` / `requestUnstakeFor` / `withdrawFor` / `claimRewardsFor` delegated methods. (Note: a success link in the component still points at a Sepolia explorer — a testnet artifact — although the operative chainId is Vision Chain v2.)

### Reward Points (RP) incentive layer

Separate from on-chain VCN yield, Vision Chain runs an off-chain RP loyalty system. RP amounts live in the Firestore document `config/rp_rewards` and are admin-configurable, merged over code defaults and cached (5-minute TTL) on both client and server. Interactive wallet staking awards `staking_deposit = 10` RP per stake.

The programmatic **Agent API** grants a distinct, higher RP tier per action. These match the values called out for this section:

| Action | RP | Config key |
| --- | --- | --- |
| Token transfer | 5 | `agent_transfer_send` |
| Unstake | 5 | `agent_staking_unstake` |
| Claim rewards | 10 | `agent_staking_claim` |
| Stake | 20 | `agent_staking_deposit` |
| New agent (referred invitee) | 25 | `agent_referral_invitee` |
| Referral (inviter) | 50 | `agent_referral_inviter` |

Additional agent tiers include withdraw (10), compound (25), bridge initiate (15), and NFT mint (30). RP also propagates up a two-tier referral tree (tier-1 10%, tier-2 2%). RP is awarded fire-and-forget after a successful staking transaction, so it never blocks the on-chain flow.

### Off-chain node reward settlement (distinct system)

The `services/reward/` engine is a separate, off-chain settlement pipeline for node-operator rewards — not the bridge-staking APY. Governed by `seed-policy-v1.json`, it splits a reward budget across an allocation pool (40%), usage pool (35%), and quality pool (25%), with quality weighted by uptime (50%), audit score (30%), and latency (20%), subject to an uptime cutoff of 0.90, audit cutoff of 0.95, and a $1.00 minimum payout. It is documented here only to distinguish it from validator staking rewards.

---

## 7. Solvent — DeFi Layer (Gasless Bridge, DEX, Perpetuals)

Solvent is Vision Chain's DeFi layer: a set of Solidity contracts plus a browser bridge that let a signature-only Vision wallet trade spot, pre-TGE lock tokens, and perpetuals without holding native gas or running a node. Every Solvent contract follows one deliberate pattern — **off-chain matching, on-chain batch settlement** — and every trading venue settles into internal balance ledgers rather than moving ERC-20s per fill. All contracts described here are deployed to the Vision Chain testnet (`visionV2`, chainId `3151909`) from a single operator wallet that holds admin, settler, oracle, and fee-collector roles; the layer is functional but explicitly pre-production.

### Settlement asset: vUSD and the reserve

The quote/collateral asset across Solvent is **Vision USD (vUSD)** (`VisionStableUSD`), an 18-decimal, `ERC20Permit`-enabled, pausable, burnable USD-pegged token. Issuance is gated by `MINTER_ROLE` (treasury), and reserves are published on-chain via `declareReserves` / `collateralizationBps`. The deployed instance is in its **Phase-1 "pilot-unbacked"** state (10M pre-minted), clearly labelled as not backed by real reserves yet.

`SolventReserve` is the Phase-2 redeemer that enforces 1:1 backing: `mint(usdtAmount)` pulls USDT and mints vUSD; `redeem(vusdAmount)` burns vUSD and returns USDT. It scales across the decimal gap (`scale = 10^(18-6) = 1e12`) and re-publishes vUSD's on-chain reserves on every mint/redeem. The deployed reserve is wired to a 6-decimal **mock** USDT for self-test; production requires substituting real bridged USDT. `MockUSDT` (symbol `mUSDT`, 6 decimals, owner-mintable, 100M supply) is testnet-only.

### Spot DEX (`DEXSettlement`)

`DEXSettlement` is the hybrid spot venue. Users `deposit` base (VCN) and quote (USDT/vUSD) tokens into an internal `balances[user][token]` ledger; an off-chain engine matches orders; the holder of `SETTLER_ROLE` calls `settleBatch(round, trades[])` once per cycle. Each `Trade` moves base seller→buyer and quote buyer→seller entirely within internal balances (no per-fill ERC-20 transfers), routing maker/taker fees to a fee collector. Withdrawals are always user-initiated. Batches are monotonic by `round` and capped at 200 trades. There is no on-chain matching or AMM curve — price discovery is off-chain by design. Deployed as `SpotDex`.

### Solvent Lock market (Registry / Vault / Settlement)

The Lock market is an OTC venue for **pre-TGE, VC-issued lock tokens** with linear (cliff + linear) vesting. It is three wired contracts:

- **`SolventLockRegistry`** — an `ISSUER_ROLE`-gated registry. On `registerLockToken`, it escrows the issuer's full underlying supply into the Vault and records the vesting schedule + credits the issuer's tradable balance in Settlement. Admin flips `setTradingEnabled` per lock. Full-supply escrow at registration is a locked design decision.
- **`SolventLockVault`** — pure custody with per-lock escrow accounting. `REGISTRY_ROLE` deposits at registration; only `SETTLER_ROLE` (the Settlement contract) may `release` underlying on claim, and never more than was escrowed for that lock.
- **`SolventLockSettlement`** — mirrors the DEX pattern (off-chain match → `settleBatch`) but adds a **Synthetix-style vesting ledger**. Lock balances are internal-only (no external lock ERC-20). On every balance change (buy/sell/claim) it crystallizes the holder's accrued entitlement at the current vested fraction and resets their checkpoint, so a seller and a later buyer cannot double-claim the same vested slice. `claim(lockId)` withdraws accrued underlying via the Vault. The quote side (vUSD/USDT) settles in the same contract; batches are capped at 200 trades.

### Perpetuals (`SolventPerp`)

`SolventPerp` is a cross-margin perpetual-futures settlement contract in the same family. Traders deposit a single quote collateral (vUSD); the off-chain engine matches, and `SETTLER_ROLE` pushes fills via `settleBatch`. An `ORACLE_ROLE` posts `markPrice` per market; positions carry signed size and a weighted-average entry price. Reducing/closing realizes PnL into collateral; both sides must pass the **initial-margin** check after each fill, and `withdraw` re-checks initial margin on declared held markets. `liquidate` closes an account at mark once it breaches **maintenance margin**, paying the liquidator a penalty from remaining collateral.

The deployed market (`id 1`) uses `maintenanceMarginBps = 500` (5%) and `initialMarginBps = 1000` (10%, i.e. 10x max leverage), with `markPrice = 100e18`. The contract's own header documents its **MVP limits**: single oracle mark price, no funding-rate curve (funding is applied externally via `applyFunding`), no insurance fund or auto-deleveraging, and linear maintenance margin — all flagged as required before real money. Position math and the liquidation gate are unit-tested.

### Gasless bridge (`signTypedData` permit + `sendTransaction`)

The bridge is a self-contained hosted page (`solvent-wallet-bridge.html`) that the external Solvent app embeds in an iframe and drives via `postMessage` under a strict origin allowlist (namespace `solvent-wallet`). It reads the Vision wallet's encrypted mnemonic from `localStorage`, decrypts it locally (PBKDF2 100k / SHA-256 → AES-GCM) with the user's password, and keeps the key in memory with a 10-minute idle auto-lock. The key never leaves the device. It exposes four actions:

1. `getAddress` — return the wallet address.
2. `signMessage` — EIP-191 `personal_sign` for SIWE login (may proceed silently once unlocked).
3. `signTypedData` — EIP-712 typed-data signing, used for **EIP-2612 permits** (gasless approvals); always requires an explicit on-screen confirm showing spender + amount.
4. `sendTransaction` — sign and broadcast a tx via the Vision Chain RPC proxy (this path pays VCN gas); also confirm-gated.

The gasless deposit itself is completed by `SolventLockSettlement.depositQuoteWithPermit(owner, amount, deadline, v, r, s)`: the user signs an EIP-2612 permit off-chain (no gas), and a relayer/settler submits the transaction. Funds are pulled from and credited to `owner` only, so a relayer cannot divert them, and the call is front-run tolerant (it proceeds if the resulting allowance already covers `amount`). An end-to-end script demonstrates a wallet that starts and ends with **zero VCN** logging in (SIWE), depositing (permit), trading, and settling on-chain without ever sending a transaction — the settler pays all gas. The matching/settlement backend that fronts these flows runs off-chain (referenced as `solvent-backend.fly.dev`) and is not part of this repository.

### Implementation status

- **Implemented and deployed (testnet `visionV2`):** vUSD, SolventReserve (mock-USDT self-test), DEXSettlement/SpotDex, the full Lock market (Registry + Vault + Settlement), SolventPerp (one market), and the gasless bridge + permit deposit path.
- **Pilot / partial:** vUSD is unbacked pilot issuance; the reserve uses mock USDT; a single operator holds all privileged roles.
- **Design-stage only:** SolventPerp funding curve, insurance fund, and ADL; production-grade oracle. The market-making/strategy engine and admin cockpit described in `SOTA-TRADING-ARCHITECTURE.md` are design documents, not settlement-contract code.

---

## 8. AI Infrastructure — Multi-Provider LLM & Server-Side Proxy

Vision Chain's conversational and generative AI (the in-app "Vision AI" assistant) is built on a provider-agnostic abstraction layer that fronts several third-party large-language-model (LLM) APIs. The design goals visible in the codebase are twofold: (1) let administrators swap models and rotate API keys without redeploying the app, and (2) keep raw provider keys off the client entirely by routing untrusted (wallet) users through a server-side Cloud Function proxy.

### Provider abstraction

Every backend implements a common `AIProvider` interface (`generateText`, optional `generateTextStream`, `generateImage`, `generateSpeech`). A `ProviderFactory` instantiates and registers the concrete providers and owns a single `LLMRouter`. Three providers are actually implemented and registered:

| Provider ID | Class | Endpoint | Notes |
|---|---|---|---|
| `gemini` | `GeminiProvider` | Google `@google/genai` SDK (`generateContent`) | Text, vision (image input), image generation, TTS, audio transcription |
| `deepseek` | `DeepSeekProvider` | `https://api.deepseek.com/chat/completions` | OpenAI-compatible; supports streaming |
| `minimax` | `MinimaxProvider` | `https://api.minimax.io/v1/chat/completions` | OpenAI-compatible; supports streaming |

The `AIProviderID` union and the admin key schema also list `openai` and `anthropic`, and the model→provider resolver recognizes `gpt`/`claude`, but no `OpenAIProvider` or `AnthropicProvider` class exists on the client and neither is registered in the factory. Server-side, the proxy can call OpenAI via its OpenAI-compatible URL, but Anthropic has no configured endpoint, so those two are best described as reserved/partial rather than fully wired.

### Model → provider routing

Routing is name-based. `getProviderFromModel(modelName)` (mirrored server-side by `providerFromModel`) does substring matching: a model id containing `deepseek` → `deepseek`, `minimax` → `minimax`, `gpt`/`openai` → `openai`, `claude` → `anthropic`, `gemini` → `gemini`. The server proxy defaults unknown models to `deepseek`.

The `LLMRouter` adds behavioral routing on top of provider selection:

1. **Image present** → route to the configured `visionModel` (a Gemini model) using the Gemini key, regardless of the primary text provider.
2. **Text only** → call the configured primary provider/model.
3. **Primary failure fallback** → if the primary is DeepSeek and it throws, the router falls back to Gemini. The `GeminiProvider` itself also self-heals, retrying on `gemini-2.5-flash` when a requested Gemini model returns 404/429/400.
4. **Streaming** is only wired through the router for DeepSeek; other providers fall back to non-streaming (the MiniMax provider implements a stream method that the router does not currently invoke).

### Admin-managed models and keys

Models and keys are configured at runtime through the admin console (`AdminAIManagement`), which is organized into tabs including **API Keys** (`ApiKeysTab`) and **Model Settings** (`ModelSettingsTab`). The Model Settings tab exposes separate intent-bot and helpdesk-bot configurations, plus image and voice settings. The model dropdowns reference current-generation (2026) ids:

- **DeepSeek (text):** `deepseek-v4-flash`, `deepseek-v4-pro`, plus legacy `deepseek-chat` / `deepseek-reasoner`
- **MiniMax (text):** `MiniMax-M3` (flagship), `MiniMax-M2.5`, `MiniMax-M2.1`, `MiniMax-M2`
- **Gemini (text/vision):** `gemini-3.5-flash`, `gemini-2.5-pro`, `gemini-3.1-flash-lite`
- **Image:** `gemini-3.1-flash-image` (Nano Banana 2), `gemini-3-pro-image` (Nano Banana Pro), `imagen-3.0-generate-002`
- **Voice:** Gemini STT models plus TTS voices (`Kore`, `Fenrir`, `Aoide`)

The default chatbot configuration seeds `deepseek-v4-flash` as the intent/helpdesk text model with `gemini-3.5-flash` as the vision model. These settings live in Firestore at `settings/chatbot`; if the document is missing, `getChatbotSettings` self-heals by writing the defaults.

API keys are stored in the Firestore collection **`settings/api_keys/keys`**, one document per key (`saveApiKey` writes id `key_<timestamp>`). Each `ApiKeyData` record carries `name`, `provider`, `key`, `isActive`, `isValid`, optional `lastTested`, and `createdAt`. The admin form lets an operator add a key (choosing Google Gemini, DeepSeek, or MiniMax), toggle active/inactive, and delete keys; the table renders masked values only.

### Key resolution and the environment-fallback chain

On the client, `getActiveGlobalApiKey(provider)` reads `settings/api_keys/keys` and selects the first document that is `isActive`, not soft-deleted, matches the provider, and is not explicitly `isValid === false` (a missing `isValid` is treated as valid for backward compatibility). If the collection is empty, no key matches, or the read is denied (non-admin wallet users cannot read the secret collection), it falls back to a build-time environment variable — `VITE_DEEPSEEK_API_KEY`, `VITE_MINIMAX_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_OPENAI_API_KEY`, or `VITE_ANTHROPIC_API_KEY`.

The server side mirrors this with a hardened variant. `getApiKeyFromFirestore(provider)` reads the same collection via the Firebase Admin SDK (which bypasses client security rules), caches the result for five minutes, matches on `provider` + `isActive !== false`, and tolerates multiple field names (`value` / `apiKey` / `key`). Callers then chain to a `process.env.<PROVIDER>_API_KEY` fallback.

### Server-side proxy: `walletAiChat`

The central privacy mechanism is the `walletAiChat` callable Cloud Function — described in-code as "Blueforge-style," where keys never reach the client. The decision of proxy-vs-direct is made in the client AI service: when a usable key is resolved locally (typically admin sessions), it calls providers directly through the router and can run the Gemini tool-execution loop; when no client key is available, it invokes `cloudGenerateText`, which calls `walletAiChat` and returns plain text (the tool loop is skipped on this path).

```
Client (wallet user)                 walletAiChat (Cloud Function)
--------------------                 -----------------------------
prompt + system + model      ──►     verify Firebase Auth (reject if none)
(+ optional imageBase64)             provider = providerFromModel(model)
Firebase Auth token          ──►     key = getApiKeyFromFirestore(provider)
                                           ?? process.env.<PROVIDER>_API_KEY
                                     call provider (Gemini REST or
                                       OpenAI-compatible chat endpoint)
assistant text               ◄──     { text, provider, model }
```

Function configuration (from its `onCall` options): `cors: true`, `maxInstances: 20`, `timeoutSeconds: 120`, `memory: "512MiB"`. It requires authentication (unauthenticated requests throw), requires a non-empty `prompt`, and defaults `model` to `deepseek-chat`, `temperature` to `0.7`, and `maxTokens` to `2048`. Gemini requests go to the `generativelanguage.googleapis.com` REST endpoint with the key as a query parameter; DeepSeek, MiniMax, and OpenAI go to their OpenAI-compatible chat endpoints with a Bearer header. If no key can be resolved, it returns a `failed-precondition` error pointing the operator to Admin → AI Management → API Keys.

A separate internal helper, `callLLM(model, systemPrompt, userPrompt)`, is used by non-chat backend features (market briefs, translations, evaluators). It resolves keys through the same `getApiKeyFromFirestore` + env chain but only supports a fixed set of models (`gemini-2.0-flash`, `gemini-3-flash-preview`, `deepseek-chat`) and is distinct from the general-purpose `walletAiChat` proxy.

### Implementation status

- Gemini, DeepSeek, and MiniMax are fully implemented client and server side; OpenAI is callable only through the server proxy; Anthropic is nominal (typed and key-storable, but no endpoint wired).
- The proxy path returns plain text only — client-side Gemini function-calling/tools run only when a direct key is present.
- The admin "Usage Stats" tab is populated with placeholder/mock figures, not live telemetry, so no usage metrics should be treated as measured.

---

## 9. AI Intelligence — Intent Parsing, Tools, RAG & Memory

Vision Chain ships two distinct AI layers. The first is a deterministic **intent parser** that turns natural-language wallet commands into structured, executable actions. The second is a **conversational assistant** ("Vision AI") built on a provider-agnostic router, a Gemini function-calling loop, injected market/user memory, and a per-user Retrieval-Augmented Generation (RAG) pipeline over Vision Disk files. This section describes what is implemented today.

### Natural-language intent parsing for wallet actions

Wallet commands are parsed by a rule-based engine (`IntentParserService`), not an LLM. `parseIntent(input, locale)` returns a typed `UserIntent` with one of the actions `TRANSFER`, `BRIDGE`, `SWAP_AND_SEND`, `SCHEDULE_TRANSFER`, or `UNKNOWN`, plus extracted parameters (`to`, `token`, `amount`, `sourceChain`, `destinationChain`, `scheduleTime`), a `confidence` score, and a human-readable `explanation`.

Parsing is driven by localized keyword lists and regular-expression tables in `AI_LOCALIZATION` (English, Korean, and Japanese configurations). The engine:

- Detects bridge, scheduled-transfer, and send intents by keyword, then applies ordered regex patterns to extract fields.
- Handles both **forward bridges** (Vision Chain → Sepolia/Ethereum) and **reverse bridges** (Sepolia → Vision Chain), defaulting the counterpart chain to `SEPOLIA`/`VISION` where the direction is implied. This reflects the testnet topology (Ethereum is mapped to Sepolia).
- Assigns fixed confidence values (typically 0.9–0.95 on a clean match) and returns a localized clarification message on `UNKNOWN`.

Because the parser is deterministic and offline, wallet actions do not depend on an external model being reachable.

### The conversational assistant and multi-turn tool loop

The assistant is exposed via `generateText` and `generateTextStream`, each supporting two bot profiles (`intent`, `helpdesk`). A provider factory registers three back ends — **Gemini**, **DeepSeek**, and **MiniMax** — behind an `LLMRouter`. Defaults resolve to `deepseek-chat` for text and `gemini-2.5-flash` for vision; the router sends any image input to the vision model and falls back from DeepSeek to Gemini on error.

Two execution paths exist:

1. **Direct provider path** — used when a client holds an API key (e.g., admin sessions). Only this path runs the Gemini function-calling loop.
2. **Server proxy path** — the default for non-admin wallet users. The client sends only the prompt, system prompt, and model to the `walletAiChat` Cloud Function, which resolves the key server-side and calls Gemini (`generateContent`) or an OpenAI-compatible endpoint (DeepSeek/MiniMax/OpenAI). The raw key never reaches the browser. This path returns plain text and **does not** execute the tool loop.

When a Gemini response contains `functionCall` parts, the loop executes each tool, appends the `functionResponse`, and re-invokes the model with the tool declarations attached — repeating up to **five** iterations. Implemented tools:

| Tool | Purpose | Backing service |
|------|---------|-----------------|
| `get_current_price`, `get_historical_price`, `get_chart_data` | Live/historical crypto prices and chart summaries | CoinGecko via `marketDataService` |
| `get_trending_coins`, `get_global_market` | Trending list and global market stats | `marketDataService` |
| `search_defi_pools`, `analyze_protocol_risk` | DeFi yields and protocol risk | `defiService` |
| `search_user_contacts` | Fuzzy contact lookup (name → VID/address) | `firebaseService` |
| `get_cex_portfolio` | Aggregated CEX holdings, P&L, allocation | `cexService` |
| `create_agent`, `check_agent_balance` | Register/fund an agent, read balance/RP | `agentGateway` Cloud Function |
| `search_market_news` | Historical Vision Insight article search | `marketMemory` |
| `list_user_disk_files`, `share_disk_file` | Search and share Vision Disk files | `diskService` |

A large dynamic system prompt enforces response language (ten languages, with an explicit override hierarchy), a `<think>` reasoning block, mandatory tool usage for price queries, a `vision-chart` rendering convention, and domain knowledge blocks (Agent API, Quant Engine, Reward Points, Vision Disk).

### Market intelligence and memory injection

Every request is augmented with context assembled at prompt-build time:

- **Live market block.** `getMarketIntelligenceBlock` fetches a Vision Insight snapshot (`getVisionInsight` Cloud Function, cached ~5 minutes) and formats the Adaptive Sentiment Index (ASI score/label/trend), the AI market brief (analysis, trading bias, confidence, key risks, opportunities, category highlights), trending keywords, alpha alerts, and upcoming events into a labeled block.
- **Market memory.** `getMarketMemoryContext` ingests Vision Insight news into the Firestore `ai_memory` collection (deduplicated by article ID, plus a daily `ai_market_snapshots` doc). Retrieval here is **keyword- and metadata-based, not vector-based**: it extracts a date range and coin/topic keywords from the query, runs a Firestore query with date/category/sentiment filters, then applies client-side keyword filtering (Firestore has no native full-text search). `search_market_news` reuses the same store.
- **User memory.** Per-user personalization lives at `users/{email}/ai_memory/profile` (preferred name, investment style, risk tolerance, interests, favorite coins, confirmed language, and up to 20 FIFO conversation notes). It is cached for 10 minutes and rendered into a `[USER MEMORY]` block; `extractAndStoreMemory` mines each turn for name, language (script-ratio detection), and repeated coin interests.
- **CEX portfolio.** When portfolio keywords are present (and action keywords are not), connected-exchange data is auto-fetched and injected as a `[CEX PORTFOLIO DATA]` block for analysis.

### RAG pipeline over Vision Disk (embeddings and vector search)

A separate, per-user RAG system indexes Vision Disk files. It is implemented as Cloud Functions and stores vectors in Firestore (the distributed-node vector storage described in the memory architecture doc remains a plan, not shipped):

1. **`aiRequestIndexing`** creates an `ai_index_jobs` record with staged progress (parse → chunk → embed → keyword/vector index).
2. **`aiProcessIngestion`** parses supported file types, performs heading/paragraph-aware chunking (~2,000 chars for Korean, ~4,000 for other languages), and enriches chunks with a summary and keywords via DeepSeek, writing to `ai_chunks`.
3. **`aiGenerateEmbeddings`** produces **dual embeddings** — OpenAI `text-embedding-3-small` (1536-dim) into `ai_embeddings_openai` and Gemini `text-embedding-004` (768-dim) into `ai_embeddings_gemini`.
4. **`aiRetrieve`** performs hybrid retrieval: cosine similarity over the chosen embedding collection combined with keyword scoring over chunk text/keywords, fused at **0.7 vector / 0.3 keyword** and tagged `hybrid`/`vector`/`keyword`, with metadata filters (file IDs, language, tags).
5. **`disk.query`** exposes the same semantic search to external agents through the Agent Gateway (T3 tier, 0.5 VCN per call), using an embedding + cosine (similarity threshold 0.3) with a keyword fallback.
6. **`aiCreateContextCache`** creates a Gemini cached-content resource (default `gemini-2.0-flash`, 3600s TTL) from indexed chunks; **`aiMemoryStore`** provides CRUD over long-term memories (`ai_memories`, classified episodic/semantic/procedural via DeepSeek, keyword-relevance search); **`aiMemoryConsolidate`** merges or prunes old/low-importance memories.

Embedding generation depends on `OPENAI_API_KEY`/`GEMINI_API_KEY` being configured; when absent, retrieval degrades gracefully to keyword search.

### Vision Insight analytics

Vision Insight is the analytics surface feeding the assistant. The wallet component renders the ASI gauge, category-filtered news feed, market brief, alpha alerts, and an agent view, all sourced from the `getVisionInsight` Cloud Function via `VisionInsightService`. An admin counterpart (`AdminVisionInsight`) manages the same intelligence pipeline. The snapshot both powers the UI and is folded into the assistant's system prompt so answers can cite live sentiment and news.

---

## 10. AI Wallet & Client Architecture

The Vision Chain wallet is a browser-native, AI-driven Web3 client. It is delivered as a single-page application in which users manage assets, transfer value, bridge across chains, schedule payments, and stake — primarily by talking to an in-app assistant in natural language rather than filling in forms. The entire client is built on SolidJS with no external state-management library, and it installs as a Progressive Web App on mobile.

### Single-Page Application (SolidJS + Vite)

The client is a SolidJS SPA compiled with Vite (`vite-plugin-solid`, ES2020 target). Routing is handled by `@solidjs/router`, with the wallet mounted under the `/wallet/*` route and its sub-views (`assets`, `send`, `nodes`, `contacts`, `settings`, `referral`, etc.) navigated client-side. The Vite build aggressively code-splits: each heavy wallet view (`WalletDashboard`, `WalletSend`, `WalletDisk`, `WalletAssets`, the game center, insight/market modules) is emitted as its own lazy chunk, and vendor libraries (`ethers`, `firebase`, charting, `bip39`, crypto primitives) are split into dedicated bundles so the initial wallet shell stays light.

The core controller (`components/Wallet.tsx`) is a large orchestrator component that owns the wallet's signals and wires together the sidebar, view header, flow modals, and the AI chat surface. Data services live under `services/` (transfers, contracts, AI, Firebase), and internationalization is provided by an `I18nProvider` context mounted at the application root.

### Conversational Wallet: Natural-Language Intents

The wallet's primary interaction model is a chat view labeled **Vision AI**. A user types (or dictates) a request such as "send 10 VCN to @jays" or "bridge 100 VCN to Ethereum," and the assistant resolves it into an executable on-chain action. Three complementary parsing layers exist in the codebase:

- **LLM pipeline (primary in-app path).** `Wallet.tsx` assembles a rich prompt containing the user's identity, live wallet context, holdings, and an enforced address book, then streams a response through `services/ai`. The model is instructed to append a JSON action block to its reply. Recognized intents are `send`, `schedule`, `multi` (batch), `bridge`, and `navigate`. The streamed text is typed out with a thinking-step animation, and an "early intent detection" heuristic short-circuits the typing effect as soon as a valid action JSON is detected. The default text model is `deepseek-chat` with streaming; image/multimodal requests route to `gemini-2.5-flash`, and DeepSeek failures fall back to Gemini. For non-admin wallet users, the LLM call is proxied server-side (`walletAiChat` Cloud Function) so provider API keys never reach the browser.
- **Deterministic parser.** `services/intentParserService.ts` provides a regex/keyword parser that classifies input as `TRANSFER`, `BRIDGE`, `SWAP_AND_SEND`, or `SCHEDULE_TRANSFER`, and `services/actionResolver.ts` turns that intent into a concrete transaction (populated calldata, bridge steps, or a time-lock call).
- **Voice parser.** `services/voiceIntentService.ts` extracts intents from speech transcripts, with a phonetic-correction layer that maps Korean/Japanese spoken renderings of crypto terms (e.g. 비씨엔 → VCN, 이더리움 → Ethereum) back to canonical symbols. Voice capture uses `MediaRecorder` with Gemini transcription and a Web Speech API fallback (with quota back-off).

Recipients expressed as names or `@handles` are resolved against the user's contacts/address book before any transaction is built; unresolved or invalid addresses are rejected.

### Intent → Confirmation → Paymaster Execution

Actions are never executed silently. Once an intent is parsed, the wallet opens a confirmation flow (pre-filling amount, recipient, and token, then advancing to a review step), and requires the user to enter their wallet password. The password decrypts the locally stored mnemonic, from which the signer's private key is derived on demand.

Execution is **gasless from the user's perspective**, routed through a paymaster. `services/transferService.ts` signs an EIP-712 `Permit` (spender = the paymaster executor, deadline one hour) authorizing the transfer amount plus a **1 VCN** service fee, then calls the Agent Gateway Cloud Function (`transfer.send`), which submits the transaction on the user's behalf. Bridges follow the same signed-permit → gateway pattern (`bridge.initiate`), and the client tracks returned `tx_hash`, `bridge_id`, and fee metadata. Key chain parameters used by the client are Vision Chain ID `3151909` and Ethereum Sepolia `11155111`; the wallet currently targets testnet.

### Batch and Scheduled / Time-Locked Transfers

- **Batch transfers.** The send view supports a `batch` mode, and the AI `multi` intent produces a reviewable list of transactions. `sendBatchTransfer` executes recipients sequentially, signing an individual permit per transfer and pausing ~3 seconds between sends to allow nonce/chain-state propagation, returning a per-recipient success/failure summary.
- **Scheduled transfers.** Two mechanisms exist. The gateway path (`transfer.scheduled`) registers a `time_after` condition and executes server-side at the appointed time — no upfront permit needed. The on-chain path in `actionResolver` encodes a `scheduleTransferNative(to, unlockTime)` call to a TimeLock contract (`0x3677…b8fb`), locking native value until the unlock time. The resolver applies cost-control policy: a minimum transfer of 0.1 VCN, a minimum schedule duration, and per-user daily/hourly quotas.

`resolveSwapAndSend` (swap-then-pay) is present but stubbed with placeholder router calldata, so swap-and-send is not yet a live on-chain path.

### Client-Side Key Custody & Security

Key material is generated and encrypted entirely in the browser (`services/walletService.ts`):

- A **15-word mnemonic** (160-bit entropy) is generated via `ethers`, with a uniqueness check on the words.
- The mnemonic is encrypted with **AES-256-GCM**; the key is derived from the user's password using **PBKDF2 (SHA-256, 100,000 iterations)** with a fixed application salt and a fresh 12-byte IV per encryption.
- The ciphertext is base64-encoded and stored in `localStorage`, scoped per user identifier. An optional encrypted cloud backup (`CloudWalletService`) can also persist the mnemonic under the same password.
- The private key is never stored — it is re-derived from the decrypted mnemonic only at signing time. If no local ciphertext is found, the wallet operates read-only until the user restores from their 15-word recovery phrase.

### Multi-Language Support

The UI internationalization layer registers four locales — English (`en`), Korean (`ko`), Japanese (`jp`), and Thai (`th`) — with locale auto-detection from `localStorage` and browser language, English fallback, and `{{param}}` interpolation. The deterministic intent parser ships localized keyword/regex grammars for English, Korean, and Japanese. Separately, the AI assistant enforces a response language (derived from user memory or browser locale) across a broader set including Chinese, Spanish, French, German, Portuguese, and Vietnamese, treating response-language fidelity as a top-priority instruction.

### State Management

State is managed entirely with SolidJS primitives — `createSignal`, `createMemo`, `createEffect`, and `createContext` — with no Redux/Zustand/MobX-style dependency. Cross-cutting concerns (authentication, i18n) are exposed through context providers, while `Wallet.tsx` holds the bulk of wallet-view signals locally.

### Mobile Experience (PWA)

The wallet is a Progressive Web App (`manifest.json`: name "Vision Chain Wallet", short name "Vision Wallet", `standalone` display, portrait orientation, `start_url` `/wallet`). A service worker (`/sw.js`) is registered for offline/asset caching and update handling. The client detects install eligibility via `beforeinstallprompt` on Android and shows a dedicated iOS "Add to Home Screen" modal (since iOS Safari suppresses the native prompt), plus Apple mobile web-app meta tags for a full-screen, app-like presentation. Voice input, portrait-first layouts, and the chat-first flow make the mobile experience the wallet's intended primary surface.

---

## 11. Vision Predict — AI Prediction Market Engine

Vision Predict is Vision Chain's autonomous AI agent for prediction markets, built against Polymarket's public data surface. It is shipped as an explicitly labeled **EXPERIMENTAL · BETA · SANDBOX** product and is **non-custodial** — the user keeps their own wallet, sets their own risk rules, and bears their own risk. The product is delivered as a SolidJS front end (`components/predict/VisionPredict.tsx`) routed at `/predict`, with all logic executed server-side through the `agentGateway` Cloud Function. Every action is dispatched by an `action` field plus an agent `api_key`, so Vision Predict is usable both from the console UI and directly as an agent API.

The engine is delivered in phases. **Phase 1 (live)** is enrollment plus risk-rule configuration. **Phase 2 (live)** adds read-only Polymarket market intelligence and a closed-loop AI **simulation** with full decision traceability. **Phase 3 (not implemented)** would add real on-chain betting via `polymarket.place_bet`; there is no such handler in the codebase today. Vision Predict therefore places **no real bets** — it is decision-only.

### Enrollment and guardrails (Phase 1)

The console walks the user through a four-step gate: eligibility → risk rules → strategy → activate. Key server actions:

- **`polymarket.eligibility`** — a default-deny gate requiring a 2-letter country code and self-attestation of age-18 and non-US status. A server-side IP/geo derivation cross-checks and can override the self-attestation on the block path (fail-closed).
- **`polymarket.enroll`** (tier T2, 0.1 VCN) — persists the user's risk rules and records the user's own **Polygon wallet address** (USDC, chainId 137). It creates an `authority.grant` scoped to `polymarket.bet` but explicitly **does not place bets**. Vision Predict never requests the user's private key.
- **`polymarket.config` / `update_rules` / `pause` / `resume`** — manage the enrolled agent.

Risk rules captured per agent: `max_bet_usdc`, `daily_loss_cap_usdc`, `daily_bet_count`, `allowed_categories`, `forbidden_keywords`, and a `time_window` (start/end hour + IANA timezone). These are the guardrails the deterministic rule-check enforces at decision time.

### Market intelligence (Phase 2)

`polymarket.list_markets` (T1, free) reads live markets from Polymarket's **Gamma API** (`gamma-api.polymarket.com`), ordered by `volume24hr`, `liquidity`, or a `competitive` score and optionally filtered to the agent's allowed categories. Markets are normalized into an internal shape that distinguishes binary (yes/no) from multi-outcome markets and surfaces `yes_price`, `no_price`, `volume_24h`, `liquidity`, `end_date`, and tags. The console renders these as selectable market cards.

### Closed-loop simulation: `polymarket.simulate` (T3, 0.5 VCN)

This is the core of the engine. For a selected market it runs a full LLM-decision → deterministic rule-check → persist loop, and **charges 0.5 VCN**, but performs **no Polymarket write**. Flow:

1. **Preconditions** — requires an enrolled, `active` agent and an operator feature flag (`system_config/predict`). A per-agent rate limit of **30 simulations/hour (rolling) and 200/day** is enforced via a per-UTC-date `predict_quota` document; the quota is refunded on any downstream failure so a failed call consumes neither a slot nor VCN.
2. **Market resolution** — by `market_id` or free-text `market_query` (the highest-`volume_24h` match) against Gamma.
3. **Prompt construction** — a fixed system prompt instructs the model to emit strict JSON and to abstain (`skip`) when information is thin or the edge is under 5 cents. The user prompt injects the market, the user's rules, and an optional low-trust `note`. Untrusted text (the note and attacker-controllable market fields such as question/tags/resolver) is defended against prompt injection via NFKC normalization, zero-width/bidi stripping, marker filtering (multilingual), length clamping, and `[[BEGIN_LOW_TRUST]]…[[END_LOW_TRUST]]` delimiters.
4. **LLM call** — via `callLLM`, supporting `gemini-2.0-flash` (default), `gemini-3-flash-preview`, and `deepseek-chat`. Gemini runs through Google's Generative Language API; DeepSeek through its OpenAI-compatible endpoint. Both use `temperature: 0.3`, `max output tokens: 1024`, and a 30s timeout. Unknown models are rejected.
5. **Parse + rule-check** — the model returns `rationale`, `evidence[]`, `confidence_0_1`, `fair_price_yes`, `decision` (`bet_yes`/`bet_no`/`skip`), `decision_reason`, `suggested_size_usdc`, and `skip_reasons[]`. The server then runs **`validateAgainstRules`**, a deterministic override that can force the decision to `skip`.

#### Deterministic rule-check (server-side override)

The LLM is treated as adversarial: its suggestion is advisory, and the server has final say. Any failing check forces `final_decision = skip`, `final_size_usdc = 0`. Checks include:

| # | Check |
|---|-------|
| 1 | Market tags overlap the agent's `allowed_categories` |
| 2 | Market question contains no `forbidden_keywords` |
| 3 | Suggested size ≤ `max_bet_usdc` |
| 4 | Current hour inside `time_window` (evaluated in the configured IANA timezone) |
| 5 | Daily aggregate + new size ≤ `daily_loss_cap_usdc` |
| 6 | Market `end_date` more than 1h in the future |
| 7 | Thin edge: `|fair_price_yes − yes_price| < 0.05` ⇒ skip |
| 8 | Near-resolution (<24h) size capped at 1 USDC |

An unparseable LLM response also forces a skip and is logged.

### Decision traceability: `predict_decisions`

Every simulation is persisted to `agents/{id}/predict_decisions/{decision_id}` as an immutable audit record containing the market snapshot; the LLM block (model, `sha256` prompt hash, raw response capped at 8000 chars, latency, and an `estimated_cost_usd` derived from an internal per-model pricing table); the parsed `llm_decision`; the `rule_check` result; a `resolution` block; and `charged_vcn`. Two read actions expose this ledger: **`polymarket.simulations`** (paginated history with paper PnL) and **`polymarket.decision_detail`** (full record including the raw LLM response for transparency). The `DecisionTraceTable` UI renders each row with the LLM decision, the final (post-rule-check) decision, size, status, and paper PnL, filterable by all/pending/resolved/skip.

#### Paper PnL, not real PnL

A scheduled resolver (`predictResolutionResolver`, every 30 minutes) reads Gamma for markets that have ended and back-fills `resolution.would_pnl_usdc` — a **hypothetical "would-have" PnL** assuming a 2% fee, with **no token movement**. The UI labels this explicitly as *paper* PnL. A daily sweep scrubs the raw LLM response and user note after a PII-retention window.

### Wallet integration and fee mechanics

Vision Predict touches two wallets, neither for betting:

- **User's Polygon wallet** — recorded non-custodially at enrollment for future (Phase 3) use; the agent holds only an `authority.grant` scoped to `polymarket.bet`, which no code exercises.
- **Agent's VCN wallet** — pays the API fee. The 0.5 VCN fee for `simulate` is a **deferred, on-chain ERC-20 transfer** from the agent wallet to the operator's executor wallet, charged **only after** the LLM returns and the decision is persisted. Balance is pre-checked (HTTP 402 on insufficient funds); every earlier failure path leaves the user uncharged and refunds the quota slot. (A parse failure still charges, since an LLM call was consumed.)

### Implementation status summary

- **Live:** eligibility gating, enrollment/risk rules, read-only market intelligence, LLM-driven closed-loop simulation with deterministic override, decision traceability, paper-PnL resolution.
- **Simulation-only / not built:** on-chain bet placement (`polymarket.place_bet`) is deferred to Phase 3 and is not present in the codebase. Vision Predict currently generates and records decisions but executes **no real trades**.

---

## 12. Node Ecosystem & Agent Platform

Vision Chain's participation layer is built from three implemented components: a desktop **Vision Node** for distributed storage, a **mobile resource-contribution node** for lightweight network participation, and an **Agent Gateway** that lets AI agents and hosted automations transact on-chain. All three converge on a shared backend Cloud Function (`agentGateway`) and a set of Solidity contracts that record node participation, storage proofs, rewards, and agent identity.

### The Vision Node (Distributed Storage)

The Vision Node is a TypeScript CLI (`vision-node`, built with Commander.js) that turns a machine into a content-addressed storage provider. It exposes the commands `init`, `start`, `stop`, `status`, `config`, and a `storage` sub-command group (`stats`, `put`, `get`, `ls`, `rm`). A process lock enforces one node per machine.

- **Registration.** `init` collects an email, storage allocation (e.g., `50GB`), and node class, then calls the backend `mobile_node.register` action with `device_type: desktop`. The backend returns an `api_key`, `node_id`, and `wallet_address`, which are persisted in the local config directory (`~/.visionnode`). Node class is auto-detected as `lite`, `standard`, or `full`.
- **Storage engine.** Files are split into chunks, each identified by a SHA-256 hash; the service returns a `file_key`, a CID, a Merkle root, and chunk count. Uploads, downloads, listing, and deletion are all local operations over this engine.
- **Chunk Registry client.** Running alongside heartbeats (every 60 seconds), this client (1) registers locally held chunks with the backend in batches of 100 (`storage_node.register_chunks`), (2) pulls replication assignments for under-replicated chunks and fetches them from a staging area (`storage_node.get_assignments`, `fetch_chunk`, `chunk_stored`), and (3) answers storage-proof challenges by reading the requested byte range at a given offset and returning its SHA-256 hash (`storage_node.proof_challenge`, `proof_response`).
- **Local Agent API.** The node runs an Express router under `/agent/v1/` for programmatic control by AI agents, secured with a Bearer token (the node's API key, or `vision-agent-local` from localhost). Endpoints cover node control, storage, heartbeat, P2P, and chunk-registry sync, plus a public `GET /agent/v1/actions` discovery route.

Daemon/background mode is not yet implemented; the node currently runs in the foreground.

### Mobile Resource-Contribution Nodes

The mobile node (`vision-mobile-node`, React Native for Android and iOS, registered via `mobile_node.register` with `device_type: android|pwa`) lets everyday devices contribute to network security and storage. Its services are network-aware and battery-conscious:

- **Heartbeat.** Sends periodic signals with an interval that adapts to connectivity. Contribution weight is `0.01x` on WiFi (`wifi_full`) and `0.005x` on cellular (`cellular_min`); offline contributes nothing.
- **Block Observer.** Connects to a Vision Chain RPC over WebSocket and independently validates new block headers, checking parent-hash continuity, timestamp monotonicity, and block-number continuity. Attestations are batched and submitted for a weight bonus. Full Clique PoA signature recovery is not yet implemented — the current signer check only confirms that the block's `miner` field is a valid, non-zero address.
- **Micro Relay.** On WiFi, polls the backend for pending relay tasks (`mobile_node.relay_poll`) and forwards transactions/messages to Authority Nodes, earning additional weight. This is the Phase 1 HTTP-polling implementation; WebSocket P2P relay is noted as future work.
- **Chunk Sync + Storage.** On WiFi, syncs with the chunk registry every 2 minutes: registers local chunks (`chunk.register`, batches of 200) and fetches up to five under-replicated chunks per cycle (`chunk.assignments`, `chunk.fetch_staging`). Credentials and settings are held in device storage (default 10 GB allocation).

### Storage Contracts and the Reward Model

Four Solidity contracts (Solidity `^0.8.20`, OpenZeppelin, executor-gated) anchor node participation on-chain:

| Contract | Role |
|---|---|
| `StorageRegistry` | Registry of storage nodes (`nodeId`, operator, capacity/used GB, node class, status, proof counts) and per-`fileKey` Merkle roots; `Pausable`. |
| `StorageProof` | Challenge lifecycle: backend issues challenges (offset, `readBytes`, 5-minute expiry, max 10 per batch), nodes submit proof hashes, and results are verified against an expected hash. Tracks pass/fail counts and success rate in basis points. |
| `StorageRewards` | Accrues native VCN rewards per node and pays `claimReward()` from an owner-funded pool. |
| `VisionAgentSBT` | Non-transferable agent identity token (see below). |

The reward formula in `StorageRewards` combines a base rate of `1 VCN/day`, a node-class weight, a storage bonus (100 bp per GB), and a proof-success bonus (up to 500 bp), scaled by the uptime fraction. Misbehaving nodes can be slashed (default 50% of pending rewards) with a 7-day cooldown. Rewards are claimed to a node's registered wallet.

### The Agent Gateway API

`agentGateway` is a single HTTP Cloud Function that exposes a self-describing manifest ("59 actions across 15 domains") for the Vision Chain L1 (`chain_id 3151909`, token `VCN`, 18 decimals, **gasless** — gas is sponsored by a platform executor wallet). Authentication accepts `Authorization: Bearer <api_key>`, `x-api-key`, or an `api_key` in the POST body; user-linked calls may use a Firebase ID token.

Registration (`system.register`) provisions, in one call:

1. A Firebase Auth user for the owner email (created passwordless if new).
2. A fresh EVM wallet (private key stored server-side, encrypted) plus an API key and referral code.
3. Initial funding of **100 VCN** from the faucet, less a **1 VCN** SBT minting fee (net ~99 VCN transferred).
4. Asynchronous minting of a `VisionAgentSBT` identity token.

Registration is rate-limited to 3 agents per email and 5 registrations per IP per hour. Beyond registration, agents can call `wallet.balance` and `wallet.tx_history`, `transfer.send`/`transfer.batch`/`transfer.conditional` (all gasless, max 10,000 VCN per send), the full `staking.*` set (deposit, request/withdraw unstake, claim, compound, APY), `bridge.*`, and `nft.mint`. Actions carry tiered VCN costs (T1 free through T4 at 1.0 VCN).

### Agent Identity and Hosting

`VisionAgentSBT` is an **EIP-5192 SoulBound Token** (ERC-721, name "Vision Agent Identity", symbol "VASBT"). Transfers and burns are blocked in `_update`, `locked()` always returns true, and `tokenURI` returns on-chain base64-encoded JSON (agent name, platform, mint timestamp) — no IPFS dependency. Names are unique, one SBT is allowed per wallet, minting is minter-restricted, and identities can be revoked while preserving the on-chain record.

The **Agent Hosting** surface lets an owner deploy an autonomous agent from the wallet UI. Hosting configuration stores an LLM model, system prompt, an interval trigger (5/30/60/1440 minutes), a list of allowed actions, and a per-action VCN cap. A scheduled backend function (`agentExecutor`, every 5 minutes) runs all agents with hosting enabled, executing their configured on-chain actions (balance monitor, auto-transfer, auto-stake, conditional unstake, network/staking monitors) and growth actions (referral outreach, social/content generation, community engagement). Reasoning is powered by an LLM router with `deepseek-chat` as the default and Gemini models (`gemini-2.0-flash`, `gemini-3-flash-preview`) also supported.

A complementary `TimeLockAgent` contract supports scheduled native-VCN transfers: funds are deposited with an `unlockTime`, released by an executor after unlock, cancellable before unlock, and refundable after a 7-day grace period if never executed.

---

## 13. Backend Services (Firebase Cloud Functions)

Vision Chain's off-chain backend is a single Firebase Cloud Functions (2nd generation) codebase. All server logic lives in one module (`functions/index.js`) that exports **129 functions** and runs on the **Node.js 20** runtime, built on `firebase-functions ^7.x`, `firebase-admin ^13.x`, and `ethers 6.16.0`. A single `admin.initializeApp()` provides the Admin SDK, and `const db = admin.firestore()` is the shared Firestore handle used across every function. There is no separate microservice tier: the Cloud Functions layer is simultaneously the gasless relayer, the cross-chain bridge operator, the scheduled automation engine, the auth/wallet backend, and the AI proxy.

### Trigger types and security model

Functions use three v2 trigger primitives, which also define their security posture:

- **`onCall` (~73 functions)** — Callable endpoints invoked from the authenticated client SDK. Every sensitive callable begins by checking `request.auth` and throwing `HttpsError("unauthenticated", ...)` when it is missing. The user's identity is always taken from the verified Firebase Auth token (`request.auth.token.email`, lowercased) rather than any client-supplied field.
- **`onRequest` (~27 functions)** — Raw HTTPS endpoints, all declared `invoker: "public"` with `cors: true`. These cover the gasless relayer, manual bridge/relayer triggers, status/health endpoints, and admin/email tooling; they enforce method checks and their own internal validation rather than Firebase Auth.
- **`onSchedule` (~26 functions)** — Cron/interval jobs for automation (relayers, reports, agent execution, billing, news, trading).

Secrets are attached **inline** on each function via the `secrets: [...]` option (Firebase Secret Manager), not through `defineSecret`. The recurring secrets are `VCN_EXECUTOR_PK` (relayer/executor private key), `SEPOLIA_RELAYER_PK`, `VCN_SEPOLIA_ADDRESS`, and the email pair `EMAIL_USER` / `EMAIL_APP_PASSWORD`. Because the Admin SDK bypasses Firestore security rules, admin-managed data such as AI provider API keys (`settings/api_keys/keys`) and user profiles are read server-side without exposing them to clients.

The functions connect to Vision Chain via `RPC_URL = https://rpc.visionchain.co` (chain ID **3151909**, 5-second block period) with a direct-IP fallback, and to Ethereum **Sepolia** (chain ID 11155111) for the bridge. Contract addresses are hard-coded constants (VCN token `0xf8a2F49C782447a8660554F7c3274cbd765b1963`, bridge/staking `0x009326c391012593Aeca601B09c02545E00Aa818`, Agent SBT `0x52D6e11B4ae4d1D51Df35BF839Baa8711C3702a7`, plus storage registry/proof/rewards contracts).

### Function categories

| Category | Representative functions | Trigger | Notes |
|---|---|---|---|
| Gasless execution | `paymaster` (+ aliases `paymasterTransfer`, `paymasterTimeLock`, `bridgeWithPaymaster`), `updateBridgeLimits`, `adminSetAPY`, `adminFundPool` | onRequest | Meta-tx relayer; executor wallet pays gas |
| Bridge relayers | `bridgeRelayer`, `secureBridgeRelayer`, `checkBridgeCompletion`, `triggerBridgeRelayer`, `triggerSecureBridgeRelayer`, `getBridgeStatus`, `checkBridgeStatus` | onSchedule / onRequest | Vision Chain ↔ Sepolia, optimistic challenge window |
| Scheduled automation | `scheduledTransferTrigger`, `conditionalTransferMonitor`, `agentExecutor`, `executorMonitor`, `weeklyActivityReport`, `inactivityNudge`, `dripEmailProcessor`, `dailyRPDigest`, `weeklyRPSummary`, `scheduledNodeHealthCheck` | onSchedule | Interval- and cron-based jobs |
| Wallet / Auth | `updateWalletAddress`, `saveWalletToCloud`, `loadWalletFromCloud`, `checkCloudWallet`, `verifyDeviceCode` | onCall | Envelope-encrypted cloud wallet sync |
| Email | `notifyWelcome`, `notifyReferralSignup`, `requestPasswordReset`/`verifyResetCode`/`completePasswordReset`, `sendAdminBroadcast`, `sendAgentSetupEmail`, `updateEmailPreferences` | onRequest / onCall | Nodemailer over Gmail/Workspace SMTP |
| 2FA / TOTP | `setupTOTP`, `enableTOTP`, `verifyTOTP`, `getTOTPStatus`, `disableTOTP` | onCall | otplib + QR, secret encrypted at rest |
| CEX portfolio | `registerCexApiKey`, `deleteCexApiKey`, `listCexApiKeys`, `syncCexPortfolio`, `getCexPortfolio`, `getAdminCexStats` | onCall | 15 exchanges, region `asia-northeast3` |
| AI | `walletAiChat`, `agentGateway`, `getVisionInsight`, `generateInsightSnapshot`, `ai*` knowledge suite | onCall / onRequest / onSchedule | Server-side LLM proxy + RAG |

### Gasless execution (paymaster)

The `paymaster` function is the account-abstraction/meta-transaction relayer. Clients POST a signed intent; the server's executor wallet (loaded from `VCN_EXECUTOR_PK`) submits the on-chain transaction and pays gas. A single handler dispatches on a `type` field — `transfer`, `timelock`, `bridge`, and staking actions (`stake`/`unstake`/`withdraw`/`claim`) — plus operational modes `health`, `flush_nonce`, `reverse_bridge_info`, and `admin_transfer`. The exports `paymasterTransfer`, `paymasterTimeLock`, and `bridgeWithPaymaster` are aliases pointing at the same handler. To survive the Cloud Functions environment, it pins an explicit `ethers.Network` (avoiding a known `eth_chainId` hang), fails over between primary and fallback RPC, and uses a Firestore distributed lock plus nonce recovery to serialize concurrent submissions.

### Bridge relayers

Three functions operate the VCN bridge between Vision Chain and Sepolia:

- **`bridgeRelayer`** (every 2 minutes, `Asia/Seoul`) scans `COMMITTED` records in `bridgeTransactions` and `PENDING` `Bridge` transactions, releasing funds once the optimistic challenge period elapses (`CHALLENGE_PERIOD_MINUTES`, set to 2 for testing with a documented 15-minute production target).
- **`secureBridgeRelayer`** (every 2 minutes) drives the "secure/optimistic" path via a MessageInbox, advancing state `PENDING → SUBMITTED → …` across the challenge window.
- **`checkBridgeCompletion`** (every 5 minutes) reconciles pending bridges against the Sepolia equalizer/token contract.

Manual `onRequest` counterparts (`triggerBridgeRelayer`, `triggerSecureBridgeRelayer`, `getBridgeStatus`, `checkBridgeStatus`) allow operator-initiated runs and status inspection.

### Scheduled automation

`scheduledTransferTrigger` runs **every 1 minute**, executing due scheduled/recurring transfers and self-healing by reclaiming jobs stuck in `EXECUTING` past their `lockExpiresAt`. `agentExecutor` runs every 5 minutes, iterating agents with `hosting.enabled`, honoring each agent's interval, checking the on-chain VCN balance and auto-pausing agents that fall below the minimum. `generateInsightSnapshot` runs every 6 hours to compute a market/sentiment snapshot from collected `blockyNews` articles. `weeklyActivityReport` (Mondays 00:00 UTC) and `inactivityNudge` (Mondays 00:30 UTC) send lifecycle emails to wallet users. Additional cron jobs handle drip email, node health, RP digests, trading engines, disk billing, and content publishing.

### Wallet, auth and 2FA

Cloud wallet sync uses **envelope encryption**: the client uploads an already password-encrypted wallet (AES-256-GCM), and `saveWalletToCloud` applies a second server-side AES-256-GCM layer before writing to `wallets_encrypted` (version 2), enforcing a minimum password strength. `loadWalletFromCloud` layers on defenses — rate limiting (5 attempts / 15 min), TOTP 2FA verification, device-fingerprint checks that require email verification for new devices, and IP-anomaly logging. The server master key is read from `WALLET_ENCRYPTION_KEY`, with a hard-coded fallback constant present in the source (noted here as a hardening item). TOTP setup uses `otplib` with issuer "Vision Chain" and stores the secret encrypted at rest in `security_totp`.

### CEX portfolio and AI

The CEX suite (`asia-northeast3`, VPC connector in production) validates and stores per-user exchange API keys under `users/{email}/cex_credentials` (max 9), supporting **15 exchanges** — upbit, bithumb, binance, bybit, bitget, okx, kucoin, mexc, bitkub, coinbase, bitflyer, gmo, coincheck, coinone, and crypto.com — and syncs aggregated balances.

`walletAiChat` is the newest AI entry point: an authenticated server-side LLM proxy so provider keys never reach the browser. It maps the requested model to a provider (`deepseek`, `minimax`, `openai`, `anthropic`, `gemini`), resolves the active key from Firestore (Admin SDK) with an environment-variable fallback, and calls the provider (Gemini native — including optional image input — or OpenAI-compatible chat completions), defaulting to `deepseek-chat`. A broader `ai*` suite (`aiRequestIndexing`, `aiProcessIngestion`, `aiGenerateEmbeddings`, `aiRetrieve`, `aiCreateContextCache`, `aiMemoryStore`, `aiOrchestrate`, and others) implements a retrieval/memory knowledge platform, while `agentGateway` provides the agent runtime endpoint.

---

## 14. Security Model

Vision Chain's security model is a layered, defense-in-depth design that spans four boundaries: client-side key custody, an authenticated cloud-sync and 2FA tier backed by Cloud Functions, server-held operational signing keys, and on-chain bridge safeguards. This section describes what is actually implemented today and is candid about the trust assumptions and the components that remain testnet-grade or documented-but-not-yet-live.

### Client-Side Key Custody and Encryption

Wallets are non-custodial at the seed level. `WalletService` generates a 15-word mnemonic from 160 bits of entropy (`ethers.randomBytes(20)`) and derives a standard EOA from it. The seed is encrypted entirely in the browser using the WebCrypto API:

- **Cipher:** AES-256-GCM with a random 12-byte IV per encryption.
- **Key derivation:** PBKDF2 over the user password, SHA-256, 100,000 iterations.
- **Storage:** the ciphertext lives in `localStorage`, keyed per user identifier (`vcn_wallet_<b64(id)>`), alongside a non-sensitive address hint.

Two honest caveats apply. The PBKDF2 salt is a single hard-coded constant (`vcn-platform-v1`) shared across all users rather than a per-wallet random salt, which weakens resistance to precomputation. Custody therefore reduces to the strength of the user password plus device-local storage integrity; there is no hardware-backed keystore.

### Cloud Sync: Envelope Encryption

Users may back up the encrypted wallet to Firestore. The `saveWalletToCloud` callable applies a second, server-side AES-256-GCM layer (`serverEncrypt`) over the already client-encrypted blob before writing it to the `wallets_encrypted` collection (schema `version: 2`). Recovery requires both the server master key and the user password, so a Firestore-only compromise does not expose seeds. A minimum password policy is enforced server-side for cloud sync (at least 10 characters and 3 of 4 character classes).

The server master key is read from the `WALLET_ENCRYPTION_KEY` environment variable, but the code falls back to a hard-coded default string if that variable is unset — this default MUST be overridden with a real secret in any production deployment, otherwise the server layer provides no real protection.

### TOTP Two-Factor Authentication

2FA is implemented server-side against Google Authenticator (RFC 6238 TOTP) and gates cloud wallet restore. The relevant callables are `setupTOTP`, `enableTOTP`, `verifyTOTP`, `getTOTPStatus`, and `disableTOTP`, all requiring an authenticated Firebase session. Key properties:

- A per-user secret and `otpauth://` URI (issuer "Vision Chain") are generated; the secret is stored in the `security_totp` collection **encrypted at rest** with `serverEncrypt`, and is only marked `enabled` after the user proves possession with a valid 6-digit code.
- Eight one-time **backup codes** (`crypto.randomBytes(4)` hex) are generated on enable, stored encrypted, and individually marked `used` on redemption.
- When 2FA is enabled, `loadWalletFromCloud` refuses to return the wallet blob until a valid TOTP or backup code is supplied.
- Abuse controls: setup attempts capped at 10; verification guarded by a shared rate limiter (5 attempts per 15-minute window in `security_rate_limits`), with all outcomes written to a security event log and confirmation/alert emails sent.

Cloud restore additionally performs device-fingerprint tracking (`security_devices`) and IP-anomaly checks to flag access from new devices.

### Server-Held Signing Keys

Gasless and cross-chain operations rely on server-custodied hot wallets, injected as Firebase Function secrets rather than committed to source:

| Secret | Role |
| :--- | :--- |
| `VCN_EXECUTOR_PK` | Vision Chain executor/paymaster wallet — pays gas and submits transfers, bridge commits, staking, and admin operations |
| `SEPOLIA_RELAYER_PK` | Sepolia-side relayer wallet for the testnet bridge path |

These are declared in each function's `secrets: [...]` array and loaded from `process.env`; the executor key has a legacy `EXECUTOR_PK` fallback. This is an explicit trust assumption: the Paymaster/relayer is a **trusted server** holding hot keys. It pays gas on users' behalf and can move the assets those keys control, so its compromise is a defined SEV-1/SEV-2 scenario mitigated by pausing and key rotation rather than prevented cryptographically. The documented MPC/TSS threshold-signing cluster that would remove this single-key trust is described in the security upgrade report as a future step, not a currently live component.

### Firestore Security Model and the Server-Proxy Change

Administrative capabilities are gated by an `isAdmin` check that consults user role fields plus `admin_emails`/`admin_uids` documents. Sensitive material is segregated by collection and, where applicable, encrypted with dedicated master keys (for example, CEX API keys use a separate AES-256-GCM key from wallet encryption).

LLM/provider API keys live in an admin-managed collection (`settings/api_keys/keys`). A recent hardening change (`walletAiChat`) introduced an **authenticated server-side AI proxy**: the Cloud Function resolves the provider key server-side (Firestore admin keys, then environment fallback) and performs the LLM call, so ordinary wallet users no longer need any client-side access to secret keys. Admin sessions retain the direct provider path; non-admin clients fall back to the proxy. This removes the prior failure mode where regular/mobile users required client key access to use AI features.

### Bridge Intent Commitment and Challenge Security

The bridge enforces user intent on-chain before funds move. `IntentCommitment.sol` records an intent hash `keccak256(sender, recipient, amount, nonce, expiry, destChainId)` with:

- **Replay protection** via monotonic per-user nonces and one-time `used`/`cancelled` flags.
- **Staleness protection** via a 24-hour validity window (`intentValidityPeriod`).
- **Rate/abuse limits**: max 10 commits per user per day, amount bounds (0.1 VCN min, 1M VCN max), and cross-chain-only enforcement.
- `AccessControl` (`OPERATOR_ROLE`), `ReentrancyGuard`, and `Pausable`.

`VisionBridgeSecure.sol` layers an optimistic model on top: intent commitment, a challenge period before mint, supply conservation (tracking `totalLocked` vs. minted), per-address and global daily limits, emergency pause, and a `TSS_ROLE` intended for 3/5 threshold operations. The Paymaster `handleBridge` flow executes permit → `transferFrom` → `commitIntent` → `lockVCN`, paying gas from the executor key. These are Vision Chain v2 **testnet** contracts; the TSS multisig and LayerZero mainnet transport in the threat model remain target-state rather than deployed.

### Transport Hardening: CSP and frame-ancestors

The Solvent wallet bridge (`/solvent-wallet-bridge.html`) is an embeddable signing surface with a password prompt, making clickjacking a concern. `public/_headers` restricts it with a `Content-Security-Policy: frame-ancestors` **allowlist** of known Solvent origins (production, staging Pages, GitHub Pages, and localhost dev), and applies `X-Content-Type-Options: nosniff` globally. The bridge page itself derives an AES-GCM key from the wallet password (PBKDF2, 100,000 iterations), validates the parent `postMessage` origin, requires **explicit on-screen confirmation** for any permit (`signTypedData`) or `sendTransaction` — showing spender/amount/to/data so users are not blind-signing — and auto-locks the decrypted key after 10 minutes of inactivity.

### Incident Response

Operational security is codified in the Incident Runbook with severity tiers (SEV-1 to SEV-3) and playbooks: immediate pause of the equalizer/bridge and paymaster, deny-listing abusive addresses, TSS key rotation, and LayerZero failover to manual relay, backed by a Security Council multisig and mandatory post-mortems. These are documented procedures that depend on the pausable contracts described above; some reference operational Hardhat scripts.

---

## 15. Implementation Status & Roadmap

Vision Chain is a working system operated as a shared **v2 testnet** across staging (`visionchain-staging`) and production (`visionchain-d19ed`) environments. The two environments differ in their Firebase/Firestore backends and AI configuration, not in chain state. The table below summarizes the maturity of each surface as implemented today.

| Surface | Status | Notes |
|---|---|---|
| AI Wallet (send / batch / schedule / bridge) | **Operational** | Natural-language client over a proxied RPC + paymaster |
| Gasless Paymaster (transfer / stake / bridge / timelock) | **Operational** | EIP-712 permit → Cloud Function relayer; 1 VCN service fee |
| Cross-Chain Bridge (Vision ↔ Sepolia) | **Operational (testnet)** | Intent commit/lock/release + optimistic challenge |
| Validator Staking & Rewards | **Operational** | 100 VCN minimum, 7-day cooldown, fixed-APY + fee pool |
| Multi-Provider AI + Server Proxy | **Operational** | Gemini / DeepSeek / MiniMax; keys held server-side |
| ERC-4337 Account Abstraction (account/factory/paymaster) | **Deployed, not yet the primary path** | Production gasless flow uses the meta-transaction relayer |
| Solvent DeFi (DEX / Perp / Vault / vUSD) | **Pilot / testnet only** | vUSD is `pilot-unbacked`; reserve self-tests against MockUSDT |
| Vision Predict | **Beta / sandbox** | Closed-loop simulation; no on-chain bets placed |
| Mobile / Resource-Contribution Nodes | **Phase 1** | Block observation + micro-relay + chunk sync; light verification |
| Vision Node CLI + Agent Gateway API | **Operational** | Gasless agent registration, balance, transfer, staking |

### Known hardening items

In the spirit of an honest technical record, the following are explicitly tracked rather than assumed complete:

- **Server master key.** Cloud wallet backup encryption falls back to a hard-coded default when `WALLET_ENCRYPTION_KEY` is unset; this **must** be overridden with a secret in production.
- **AI proxy metering.** The authenticated `walletAiChat` proxy has no per-user rate limiting or spend quota yet; a credit/quota layer is the natural next step (mirroring the metered model used elsewhere in the ecosystem).
- **Solvent backing.** vUSD is a pilot unit of account with no live collateral backing; the reserve module is wired but exercised against a mock stablecoin.
- **Bridge decentralization.** Relaying is currently performed by trusted Cloud Function relayers holding executor/relayer keys; challenge-period security is optimistic rather than proof-based.

### Near-term direction

The engineering trajectory implied by the current codebase points to: migrating the shared testnet toward a hardened, broader-validator mainnet; promoting the ERC-4337 path to a first-class bundler/EntryPoint flow; adding usage metering and streaming to the server-side AI proxy; graduating Solvent's vUSD to a collateral-backed model with a live reserve; and deepening the mobile node's verification (full Clique signer verification, incentivized storage proofs). These are directional observations grounded in the present architecture, not commitments.

---

## 16. Appendix — Deployed Addresses & Endpoints

**Vision Chain v2 Testnet — ChainID `3151909` (Clique PoA, ~3s blocks, 30M gas limit, VCN native gas).**

### Core contracts

| Contract | Address |
|---|---|
| VCNToken (ERC-20 + EIP-2612 Permit) | `0xf8a2F49C782447a8660554F7c3274cbd765b1963` |
| VCNPaymaster (gasless executor) | `0x28F40F9Da1c6D3c38fFDC1Fba80364B6bb21A1E3` |
| BridgeStaking (V3, `stakeFor`) | `0x009326c391012593Aeca601B09c02545E00Aa818` |
| VisionBridgeSecure | `0x610178dA211FEF7D417bC0e6FeD39F05609AD788` |
| DEXSettlement (SpotDex) | `0xb8123Aa334925c416Eb7c703C8aa48991c304f96` |

Additional deployed contracts include `VisionBridgeNative` / `IntentCommitment` / `MessageInbox` (bridge), `VCNTokenSepolia` (Sepolia-side token), `VCNVestingNative`, `VisionMiningPoolNative`, `VisionNodeLicenseNative`, and the Solvent suite (`SolventPerp`, `SolventLockSettlement` / `Vault` / `Registry`, `SolventReserve`, `VisionStableUSD`).

### Endpoints

| Purpose | URL |
|---|---|
| Primary RPC (proxied) | `https://api.visionchain.co/rpc-proxy` |
| Alternate RPC host (multi-node) | `https://rpc.visionchain.co` |
| Transaction submit | `https://api.visionchain.co/rpc/submit` |
| Block explorer (VisionScan) | `https://www.visionchain.co/visionscan` |
| Agent Gateway API | `https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway` |
| Production app | `https://visionchain.co` |
| Staging app | `https://staging.visionchain.co` |

---

*This document is a living technical record generated from the Vision Chain codebase. Addresses and parameters reflect the v2 testnet deployment and will be revised as the network progresses toward mainnet.*
