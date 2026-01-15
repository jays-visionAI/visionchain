# Vision Chain Testnet Upgrade Roadmap

This document outlines the strategic development plan to upgrade the current **Vision Chain Testnet v2 (Prototype)** to a fully interoperable and robust **Sovereign Layer 1**.

## Current Status (v2)
- **Strengths**: Validated Business Logic (Node Licenses, Mining Pool, Vesting), Fast Iteration.
- **Weaknesses**: Simulated Infrastructure (Hardhat), No Cross-Chain Capability (Isolated).

---

## Phase 1: Interoperability Upgrade (LayerZero Integration)
**Goal**: Enable VCN tokens to move between Vision Chain and other networks (e.g., Ethereum Sepolia, Polygon Amoy) to fulfill the promise of "Interoperability".

### 1.1 Smart Contract Development
- [ ] **Deploy LayerZero Endpoint Mock**: For local/testnet testing without relying on external relayers initially.
- [ ] **Upgrade VCNToken to OFT (Omnichain Fungible Token)**:
    - Retain current logic but inherit from `OFTV2` (LayerZero standard).
    - Allow burning VCN on Source Chain -> Minting on Destination Chain.
- [ ] **Deploy Bridge Contract**: A user interface contract to handle the `send()` function easily.

### 1.2 Frontend Integration
- [ ] **Bridge UI**: Add a "Bridge" tab in the Wallet.
- [ ] **Cross-Chain Transaction Handling**: Update `contractService.ts` to estimate cross-chain gas fees (payable in native ETH/MATIC).

**Timeline**: 3-5 Days
**Outcome**: "Vision Chain is now connected to the world."

---

## Phase 2: Infrastructure Hardening (Engine Swap)
**Goal**: Replace the simulation engine (Hardhat) with a production-grade blockchain client (Geth or Polygon CDK) to match or exceed SimplyFi's infrastructure level.

### 2.1 Server Migration
- [ ] **Upgrade Server**: Scale vertically (Hetzner CPX41 or dedicated) to support heavy cryptography.
- [ ] **Deploy Geth / Polygon CDK Node**:
    - Move away from `hardhat node`.
    - Run a real EVM client with a genesis block containing our pre-deployed contracts.
    - Setup a persistent database (LevelDB/RocksDB) so data survives restarts.

### 2.2 Explorer Upgrade
- [ ] **Deploy Blockscout**: Replace manual console logs with a real Block Explorer UI (view transactions, blocks, internal calls).

**Timeline**: 1-2 Weeks
**Outcome**: "Vision Chain is now a real, persistent blockchain network."

---

## Phase 3: Sovereign L1 Maturity (Decentralization)
**Goal**: Move from a "Single Node" to a "Network".

### 3.1 Validator Expansion
- [ ] **Onboard Key Partners as Validators**: Allow external entities to run nodes and validate blocks.
- [ ] **Implement PoA/PoS Consensus**: Move from "Auto-Mine" to real consensus (e.g., IBFT 2.0).

### 3.2 Data Availability layer
- [ ] **Integrate DA Layer**: For high throughput (optional, depending on load).

**Timeline**: 1 Month+
**Outcome**: "Vision Chain is a decentralized Sovereign Layer 1."
