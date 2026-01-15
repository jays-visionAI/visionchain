# Vision Chain 2.0: Network-Agnostic AI-Native L1
## Infrastructure & Developer Guideline (v2 Beta)

This document outlines the deployment and integration protocols for **Vision Chain 2.0**, featuring the high-speed Kafka-based sequencing engine, enterprise accounting metadata (VisionScan Beta), and automated stress testing modules.

---

## 🏗 v2 Architecture Overview

Vision Chain 2.0 moves beyond traditional L2 models to a **Network-Agnostic** liquid settlement layer:
1.  **API Gateway (Ingestion)**: Receives signed transactions.
2.  **Redpanda/Kafka (Ordering)**: Microsecond latency message queue for global transaction sequencing.
3.  **Vision-Sequencer (Execution)**: Consumes batches from Kafka, executes state changes, and commits blocks.
4.  **Metadata Vault (SQLite)**: Persistent storage for enterprise accounting metadata.

---

## 1. Core Infrastructure Deployment

### A. Shared Sequencer Engine (Remote Server)
The engine is deployed on dedicated Linux infrastructure (`46.224.221.201`).

*   **Deployment Script**: `deploy_sequencer.sh`
*   **Action**: Syncs source code for the API and Engine, installs production dependencies, and manages services via PM2.
*   **Command**:
    ```bash
    ./deploy_sequencer.sh
    ```

### B. Frontend & Explorer (Cloudflare Pages)
The unified interface (Wallet + VisionScan + TrafficSim) is deployed via CI/CD.

*   **Host**: `https://www.visionchain.co`
*   **Build Preset**: Vite + Solid.js
*   **Key Routes**:
    *   `/visionscan`: V2 Accounting Explorer (Live Data via Sequencer API)
    *   `/trafficsim`: Developer Simulation Hub

---

## 2. Shared Sequencer API (v2)

Developers can interact directly with the sequester for high-throughput applications.

### Submit Transaction
*   **Endpoint**: `POST /rpc/submit`
*   **Payload**:
    ```json
    {
      "chainId": 1001,
      "signedTx": "0x...",
      "type": "A110",
      "metadata": {
        "method": "Swap",
        "taxCategory": "Taxable"
      }
    }
    ```

### Query Live Transactions (VisionScan Backend)
*   **Endpoint**: `GET /api/transactions?limit=50&type=All`

---

## 3. Automated Stress Testing: Traffic Generator (v2)

A new independent module for simulating mass adoption and verifying accounting logic.

*   **Module Path**: `services/traffic-generator/`
*   **Deployment**:
    1.  Configure a funded **Master Faucet Key** in `.env`.
    2.  The `deploy_sequencer.sh` script will automatically upload and start the `vision-traffic` service on the remote server.
*   **Monitoring**: Access the **Admin Traffic HQ** at `/adminsystem/traffic` to manage the bot lifecycle.

---

## 4. VisionScan Beta: Accounting Integration

VisionScan v2 is designed for "Audit-Grade" transparency.
*   **Classification Codes**: Transactions are tagged with codes like `A110` (Asset Transfer), `S200` (Swap), etc.
*   **Audit Evidence**: Every transaction processed by the v2 engine generates a journal entry preview (Dr/Cr) and cryptographic evidence stored in the metadata vault.

---

**Release Version**: 2.0.0-beta.5
**Last Updated**: 2026-01-15
**Maintainers**: Vision Chain Engineering Team
