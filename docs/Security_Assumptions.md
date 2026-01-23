# Security Assumptions & Threat Model (Vision Hybrid Interop)

## 1. Introduction
This document defines the "Rules of Trust" for the Vision Chain Hybrid Bridge. It serves as the source of truth for security audits and architectural decisions.

## 2. Trust Boundaries

### 2.1 LayerZero (Transport Layer)
*   **WE TRUST**:
    *   The LayerZero Endpoint on both Source and Destination chains.
    *   The DVN (Decentralized Verifier Network) configuration chosen by Vision Chain (e.g., Google Cloud + Polyhedra).
    *   That if `lzReceive` is called by the local Endpoint with a specific `srcEID` and `srcAddress`, the message originated from that exact contract on that exact chain.
*   **WE DO NOT TRUST**:
    *   The content of the payload (it must be validated by application logic).
    *   Arbitrary Relayers (anyone can call the transaction, but they cannot forge the proof).

### 2.2 MPC/TSS Cluster (Authorization Layer)
*   **WE TRUST**:
    *   The honesty of a supermajority ($t$ of $n$) of the Vision Validator set.
    *   That the MPC protocol (e.g., GG20 or newer) does not leak the private key shards.
*   **WE DO NOT TRUST**:
    *   Any single Validator node (cannot sign alone).
    *   The off-chain coordinator (can propose invalid batches, but cannot sign them).

### 2.3 Paymaster Policy Server
*   **WE TRUST**:
    *   The Policy Server to rate-limit requests to prevent budget draining ($100/day limit).
*   **DEFENSE IN DEPTH**:
    *   Even if the Policy Server is compromised, the on-chain Paymaster contract enforces a **HARD CAP** (Global Circuit Breaker).

## 3. Threat Model

| Threat Actor | Capabilities | Mitigation Strategy |
| :--- | :--- | :--- |
| **Malicious Relayer** | Can censor txs, reorder txs, or DoS (spam). | **Non-blocking Receive**: Failed txs are just queued. Relayers cannot forge validation proofs. |
| **Compromised Validator (< 1/3)** | Can refuse to sign (liveness issue). | **Redundancy**: System works as long as $2/3$ are honest. |
| **Compromised Validator (> 2/3)** | Can sign invalid withdrawals. | **Rate Limits**: Max withdrawal per hour. **Timelock**: Large withdrawals delayed 24h. |
| **Bridge Exploiter** | Wants to double-spend or mint infinite tokens. | **Equalizer Accounting**: Credit balance checked *before* signing. **Idempotency**: Nonces prevent replay. |
| **User (Gripping)** | Sends failing Gasless txs to drain Paymaster. | **Policy Server**: Bans IP/User. **On-chain**: Only whitelisted targets allowed. |

## 4. Acceptance Criteria for "Secure"
1.  **Source Authentication**: Every message MUST verify `msg.sender == lzEndpoint` AND `_srcAddress == TRUSTED_PEER`.
2.  **Order Invariance**: Messages arriving out of order MUST NOT corrupt the ledger (use strict Noncing).
3.  **Fail-Safe**: If a critical bug is found, the `Security Council` Multisig MUST be able to `Pause()` the system within 5 minutes.
