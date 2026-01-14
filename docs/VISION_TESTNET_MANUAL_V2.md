# Vision Chain Testnet v2 User Manual

**Version:** 2.0 (Public Beta)  
**Date:** 2026-01-15  
**Status:** Live

---

## 1. Introduction

Welcome to the **Vision Chain Testnet v2**. This environment allows developers and users to explore the **AI-Native Layer 1** capabilities, including the high-throughput Kafka-based Shared Sequencer and the unique "Equalizer" interoperability model.

**What's New in v2:**
*   **Public Access:** Now accessible via public RPC (`46.224.221.201`).
*   **Shared Sequencer:** Sub-second transaction ordering via Redpanda.
*   **AI Oracle:** Dynamic tokenomics driven by network usage and node health.

---

## 2. Network Configuration (MetaMask)

To interact with the testnet, add the following custom network to your wallet (e.g., MetaMask).

| Parameter | Value |
| :--- | :--- |
| **Network Name** | `Vision Testnet v2` |
| **RPC URL** | `http://46.224.221.201:8545` |
| **Chain ID** | `3151909` |
| **Currency Symbol** | `VCN` |
| **Block Explorer** | *(Coming Soon)* |

> **Note:** Since this is a custom testnet, MetaMask might warn that the Chain ID doesn't match a known network. This is normal.

---

## 3. Getting Testnet Funds (Faucet)

Currently, the VCN Faucet is operated via a **Command Line Interface (CLI)** to prevent spam.

### Prerequisites
*   Node.js & NPM installed
*   Git

### Steps
1.  **Clone the Repository** (If you haven't already):
    ```bash
    git clone https://github.com/VisionChainNetwork/vision-chain.git
    cd vision-chain/blockchain
    ```

2.  **Run the Faucet Script**:
    Replace `YOUR_WALLET_ADDRESS` with your actual Ethereum address (0x...).
    ```bash
    USER_ADDRESS=YOUR_WALLET_ADDRESS npx hardhat run scripts/faucet.js --network vision_v1
    ```

3.  **Confirmation**:
    You should see a success message indicating that **100,000 VCN** and **10 ETH** (for gas) have been sent to your address.

---

## 4. Developer Guide: Deploying Contracts

Vision Chain is fully **EVM-compatible**, so you can use standard tools like **Hardhat**, **Foundry**, or **Remix**.

### Hardhat Configuration
Update your `hardhat.config.js` to include the Vision Testnet:

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.28",
  networks: {
    vision_v1: {
      url: "http://46.224.221.201:8545",
      chainId: 3151909,
      accounts: ["YOUR_PRIVATE_KEY"] // Do not share this key!
    }
  }
};
```

### Deployment Example
Deploy a standard ERC-20 or any solidity contract:

```bash
npx hardhat run scripts/deploy.js --network vision_v1
```

---

## 5. Advanced Features

### The Equalizer (Cross-Chain Sync)
Vision Chain allows you to "teleport" assets from other chains without wrapping/burning.
*   **Concept:** Lock asset on Chain A -> Agents detect event -> Sequencer credits Chain B.
*   **Test Contract:** `VisionEqualizer` (Address: `0x5FbDB2315678afecb367f032d93F642f64180aa3`)

### High-Speed Sequencer
For automated agents requiring sub-second latency, submit signed transactions directly to the Sequencer API instead of the standard RPC.
*   **Endpoint:** `POST http://46.224.221.201:3000/rpc/submit`
*   **Payload:** `{ "verified": true, "signedTx": "0x...", "chainId": 3151909 }`

---

## 6. Support

If you encounter issues, please check:
1.  **Server Status:** Verify the RPC URL is reachable.
2.  **Discord:** Join the #dev-testnet channel.
3.  **Logs:** Check your terminal output for revert reasons.

*Happy Building!*
