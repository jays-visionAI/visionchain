# AI Intent Scenarios & Capability Matrix

## 1. Core Philosophy: "Receiver-Centric Settlement"
The sender only knows **"Who"** and **"How much value"**. The AI resolves **"Which Chain"**, **"Which Token"**, and **"How to route it"** based on the Receiver's On-chain Profile (Vision ID).

---

## 2. Scenario Classification

### Category A: Direct Settlement (Basic)
1.  **Direct Send**: "Send 10 VCN to @jays."
    - *Resolution*: Resolve @jays -> 0x123... -> Transfer VCN.
2.  **Cross-Chain Bridge**: "Move my assets to Ethereum."
    - *Resolution*: Detect user holds VCN on Vision -> Bridge to ETH on Ethereum.

### Category B: Preference-Based Auto-Swap (Advanced)
*The Killer Feature defined by User.*
3.  **Auto-Settlement**: "Send 100 USDC to @alice."
    - *Context*: @alice has set her preference to **Receive in WBTC**.
    - *AI Resolution*:
        1. Query @alice's Profile -> Preference: WBTC (Vision Chain).
        2. Construct Tx: Sender(USDC) -> Uniswap(Swap to WBTC) -> Receiver(@alice).
    - *User Experience*: "Sending 100 USDC..." -> "Converted to 0.00x WBTC for Alice automatically."

4.  **Cross-Chain Auto-Settlement**: "Pay @bob 50 USD using my Polygon funds."
    - *Context*: @bob is on Vision Chain and wants VCN. Sender is on Polygon.
    - *AI Resolution*:
        1.  Sender (Polygon USDC) -> LayerZero/Stargate -> Vision (USDC).
        2.  Vision (USDC) -> Swap -> Vision (VCN).
        3.  Deposit to @bob.

### Category C: Complex Logic (Expert)
5.  **Multi-Send (Split)**: "Send 100 VCN split equally between @team_alpha."
    - *Resolution*: Query @team_alpha (Group ID) -> Get members -> Batch Transfer.
6.  **Stream Payment**: "Pay @worker 1000 VCN over the next 30 days."
    - *Resolution*: Deploy/Interact with Sablier-style vesting contract.
7.  **Gasless Delegation**: "I have USDC but no ETH for gas. Send this USDC to @charlie."
    - *Resolution*: Use `VCNPaymaster` to pay gas in USDC (via Permit).

---

## 3. Required Architecture Upgrades

To support these "All Possibilities", we need:

1.  **Vision Profile Registry (On-Chain DB)**
    - Map `VID` (@name) -> `Address` + `PreferredChain` + `PreferredToken`.
2.  **Intent Solver (AI Agent)**
    - Instead of hardcoding paths, the AI must **simulate** paths.
    - "Pathfinding": Find the best route (Bridge -> Swap -> Send) to satisfy the Receiver's preference.
3.  **Universal Resolver Contract**
    - A smart contract that can atomically execute [Swap + Bridge + Send] in one transaction.
