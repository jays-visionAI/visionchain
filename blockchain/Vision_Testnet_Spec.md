# Vision Chain Testnet v2 Specification

This document defines the technical parameters for the custom Vision Chain Testnet (v2), which serves as the foundation for the Sovereign Layer 1.

## Network Parameters

| Parameter | Value | Description |
| :--- | :--- | :--- |
| **Network Name** | Vision Chain Testnet v2 | The official name of the network. |
| **Chain ID** | `3151909` | Unique identifier (one higher than SimplyFi for distinction). |
| **Currency Symbol** | `VCN` | The native gas token of the network. |
| **RPC URL** | `http://localhost:8545` | (Prototype) Local endpoint for development. |
| **Block Explorer** | `Blockscout` (Planned) | Real-time transaction monitoring. |

## Genesis Configuration (Mental Model)

- **Initial Supply**: 1,000,000,000 VCN
- **Block Time**: 2 seconds (Fast throughput)
- **Gas Limit**: 30,000,000 (standard high-performance)
- **Consensus**: PoA (Proof of Authority) for v2 Testnet.

## Roadmap to Sovereign L1

1. **Hardhat Prototype**: Functional simulation of the VCN gas economy.
2. **Polygon CDK Setup**: Deployment of a dedicated ZK-Rollup/Sovereign chain.
3. **Mainnet Transition**: Sovereign L1 with PoV (Proof of Visibility).
