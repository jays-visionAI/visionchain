# ADR 001: Hybrid Interop Model (LayerZero + Vision Equalizer)

## Status
Accepted

## Context
Vision Chain aims to be a "Sovereign Layer 1" with high interoperability. We need a way to bridge assets (VCN, ETH, MATIC) securely between Vision Chain and other networks (Ethereum, Polygon, Base).
*   **Problem**: Building a custom bridge from scratch (Relayer + Oracle) is high-risk and maintenance-heavy.
*   **Problem**: Using a standard "Mint/Burn" wrapper (like Wrapped VCN) fragments liquidity and relies entirely on external bridge security.

## Decision
We will implement a **Hybrid Interop Model**:
1.  **Transport**: Use **LayerZero** for the "pipes" (messaging).
2.  **Logic**: Use **Vision Equalizer** for the "brains" (accounting).
3.  **Security**: Use **MPC-TSS** for the "keys" (authorization).

## Rationale
*   **Why LayerZero?**: It provides a battle-tested infrastructure (DVNs, Executors) and the OFT standard. We offload the "did this happen on chain A?" proof complexity to them.
*   **Why Vision Equalizer?**: We need custom logic for "Credit-based Mining" and "Tax Accounting". Standard bridges don't support our "Use-it-or-Lose-it" half-life logic. The Equalizer allows us to maintain a Global Ledger state.
*   **Why MPC-TSS?**: A simple multisig on Ethereum is expensive (gas) and limited in signer count. Off-chain MPC allows 250+ validators to participate in a single signature, making the bridge highly decentralized and scalable.

## Consequences
*   **Positive**:
    *   Drastically reduced attack surface (Transport security delegated to LZ).
    *   High customizability (Equalizer can implement any complex DeFi logic).
    *   Gas efficiency (TSS produces 1 signature to verify).
*   **Negative**:
    *   Complexity in key management (Validators need to run TSS software).
    *   Dependency on LayerZero (if LZ goes down, we fallback to manual relay or halt).

## Compliance
This architecture complies with the "Accountable Sovereignty" principle of Vision Chain.
