# Vision Predict (Beta) — Risk Disclosure & Eligibility

> **Read this page in full before enrolling.** Vision Predict is an **experimental autonomous trading sandbox** built on top of [Polymarket](https://polymarket.com). It is not a financial product, not investment advice, and not a guaranteed source of return. Prediction-market positions can lose **100% of the capital you commit**, and in some jurisdictions the activity itself may be classified as gambling, betting, or an unlicensed derivative. **You are solely responsible for determining whether your use is legal where you live.**

Vision Predict is currently in **Phase 1 (Beta)**: enrollment, risk-rule capture, and `authority.grant` scope only. **No live betting is executed in this phase.** Live order placement will only become available in Phase 3, and only after a separate opt-in and a second risk acknowledgement.

---

## 1. What Vision Predict actually is

Vision Predict is a **configurable, non-custodial agent runtime** that, once Phase 3 ships, can place orders on Polymarket on your behalf according to the rules **you** define. It is best understood as a programmable sandbox:

- **You** set the maximum bet size, daily loss cap, daily order count, allowed categories, forbidden keywords, and trading hours.
- **The agent** scans markets, scores them against your rules, and — only with an explicit `authority.grant` from your wallet — proposes trades.
- **The Polymarket protocol** (not Vision Chain) holds collateral, settles markets, and pays out resolutions.

We do **not** model Vision Predict as a "make money" product. We model it as a research and automation platform. If you are looking for guaranteed returns, please close this page now.

> **No profit guarantee.** Nothing on this page, in the app, in our documentation, or in any communication from Vision Chain constitutes a promise, projection, or warranty of profit. Historical backtests, leaderboard figures, and example agents are illustrative only.

---

## 2. Capital-loss risks

By using Vision Predict in Phase 3, you accept the following:

- **Total loss is possible on every position.** Prediction-market shares that resolve "No" pay zero. There is no stop-loss that can guarantee a price; Polymarket order books can be thin, especially on niche markets.
- **Daily loss caps are not floors.** The `daily_loss_cap_usdc` value you set is a *target* the agent will respect when calculating new orders. Slippage, partial fills, race conditions during a market resolution, and out-of-band Polymarket protocol behaviour can cause realised losses to exceed your cap.
- **Gas, fees, and spread are not refundable.** Network fees, Polymarket relayer fees, and bid-ask spread all accrue against you regardless of outcome.
- **Stale markets and oracle disputes.** Markets can be paused, re-resolved, or invalidated by Polymarket's UMA-based oracle. If your position is in such a market, your capital may be locked for an extended period or returned at an unexpected price.
- **No FDIC, SIPC, or equivalent protection.** Polymarket is not a bank, broker, or insured exchange. Vision Chain is not a bank, broker, or insured exchange.

---

## 3. Regulatory and jurisdictional risk

Prediction markets are regulated very differently around the world. In several jurisdictions, participating in real-money prediction markets is **illegal**, **restricted to licensed operators**, or treated as **gambling**. Polymarket's own Terms of Service prohibit access from a list of countries; national regulators in additional countries have issued orders against Polymarket or unlicensed prediction markets generally.

### Geographic eligibility

> **Your access to Vision Predict may be blocked or limited if you are in, or accessing from, any of the following jurisdictions:**
>
> **United States** (Polymarket TOS prohibits US persons), **France**, **Netherlands**, **Belgium**, **Poland**, **Singapore**, **Taiwan**, **Thailand**, **Indonesia**, **Brazil**, **Spain**, **Portugal**, **Argentina**, **Hungary**, **India**.
>
> This list mirrors Polymarket's own TOS and the additional national-regulator orders issued through 2025–2026. **It is not exhaustive.** Other countries may restrict access at any time. We re-verify this list before each release, but you remain responsible for checking the law in your jurisdiction.

### What we will and will not do at the gate

- We require self-attestation of (a) being **18 years of age or older**, (b) **not being a US person**, and (c) **your country of residence**.
- We refuse enrollment for any country in the block list above.
- We do **not** perform full KYC during enrollment. **You** must not misrepresent your jurisdiction. Misrepresentation may expose you to legal liability and will void any support obligation on our part.
- If the regulatory picture changes in your country, we may pause or disable Vision Predict in your region with little or no notice. See **Section 7** for our notification policy.

### Not financial advice. Not legal advice.

> **Nothing in Vision Predict is financial advice, legal advice, tax advice, or a solicitation.** We do not know your financial situation, your tax residency, or your risk tolerance. If you are unsure whether your use is legal or appropriate, consult a qualified professional in your jurisdiction **before** enrolling.

---

## 4. Technical risk: protocol-version brittleness

Vision Predict is a **client** of the Polymarket protocol. We do not control Polymarket's smart contracts, order book, settlement layer, or oracle. When Polymarket changes, Vision Predict can break.

> **The Polystrat precedent.** In **April 2026**, Polymarket shipped a V2 upgrade to its CLOB and exchange contracts. The widely-used Polystrat third-party bot was non-functional for approximately three weeks until its maintainers shipped a compatible client. Open positions during that window could not be managed through Polystrat and had to be handled manually on Polymarket's native UI.

The same class of failure can happen to Vision Predict. Specifically:

- **Breaking ABI or signature changes** to Polymarket's exchange contracts will render the agent unable to place, cancel, or settle orders until we ship a patch.
- **Order-book API schema changes** can cause the discovery layer to mis-score markets or to score none at all.
- **Oracle-layer changes** (UMA upgrades, dispute-window changes) can affect resolution timing and refund mechanics in ways our risk rules cannot model.
- **Network congestion or RPC failure** on Polygon or any upstream chain can cause orders to be delayed, partially filled, or fail to cancel.

Our mitigations:

- We **version-pin** the Polymarket client and publish the pinned version on the Vision Predict status page.
- We run an integration canary against Polymarket every hour.
- On detection of a protocol-version mismatch, we **auto-pause new orders** for all agents until a human operator clears the canary. Existing positions are left untouched.
- We do **not** promise that pause-and-patch will happen in seconds. The Polystrat incident is our honest baseline expectation: **multi-day downtime is a realistic outcome of a Polymarket protocol upgrade.**

---

## 5. Agent failure modes

Even with a healthy protocol, an autonomous agent can do unexpected things. The known failure modes you are accepting include:

- **Rule mis-specification.** If your `forbidden_keywords` list is empty and your `allowed_categories` is permissive, the agent may bet on markets you would not have bet on personally. Rules are enforced literally, not by intent.
- **Edge-case ordering.** Two market signals arriving in the same scoring window may produce a different outcome than either signal in isolation. Replays of the same input do not guarantee the same output if upstream data has shifted.
- **Latency.** Between the moment the agent scores a market and the moment the order lands, the price can move against you. The agent does not guarantee fills at the price it observed.
- **Compromised credentials.** If your wallet seed or agent API key is leaked, the attacker inherits whatever scope you granted. We provide revocation primitives, but we cannot recover funds already moved.
- **Bugs in our code.** Vision Predict is beta software. We test it, but we cannot promise it is bug-free. Use only capital you can afford to lose entirely.

---

## 6. Honest PnL framing

> **Past peak returns are not predictive of future PnL.** Any figure you see on a Vision Predict leaderboard, example agent, or marketing surface reflects a specific historical window and a specific rule configuration. It does not reflect fees, slippage, taxes, regulatory frictions, or the survivorship bias inherent in any leaderboard. Realised PnL for your agent will almost certainly differ — often materially, often in the negative direction.

We will report PnL the same way we report it to ourselves:

- **Realised PnL only.** Mark-to-market gains on open positions are shown separately and labelled as unrealised.
- **Net of fees and gas.** Headline numbers include all observable on-chain costs.
- **Sample-size context.** PnL displays show the number of resolved markets behind the figure, so you can judge whether a number is meaningful or noise.

If you find a display in the product that does not meet this bar, please report it to us using the contact link at the bottom of this page.

---

## 7. How we'll keep you informed

Vision Predict's safety story depends on you being told quickly when something is wrong. Our commitments:

- **In-app status banner.** The Vision Predict console shows the current health of the Polymarket integration and any active pause.
- **Status page.** A public status page lists the pinned Polymarket protocol version, the last canary check, and any open incidents.
- **Notifications.** If you grant notification scope at enrollment, we will send a notification when:
  - Vision Predict is auto-paused globally;
  - your agent is paused because it tripped one of your own risk rules;
  - your jurisdiction has been added to the block list;
  - we have shipped a breaking change to your agent's behaviour.
- **Auto-pause policy.** On a confirmed protocol-version mismatch, an unhandled oracle event, or a sustained RPC failure, we **pause new order placement** for all agents and notify enrolled users. **Existing positions are not closed automatically.** Closing positions is your decision and may require using Polymarket's native UI.

---

## 8. Custody, keys, and what we will never do

Vision Predict is **non-custodial**. Polymarket holds your collateral on its own contracts; Vision Chain holds your agent's policy document and an authority grant, nothing more.

> **What we will NEVER do:**
>
> - We will **never** custody your USDC, MATIC, or Polymarket shares.
> - We will **never** take an authority grant that exceeds the scope you approved at enrollment.
> - We will **never** place a bet that violates the risk rules you set, except in the case of a confirmed bug, which we will disclose and remediate.
> - We will **never** sell your trading history, your wallet address, or your rule configuration to a third party.
> - We will **never** market Vision Predict as a guaranteed-return product, a yield product, or an investment.
> - We will **never** ask for your wallet seed phrase. Anyone claiming to be Vision Chain support and asking for a seed is an attacker.

The authority grant you sign at enrollment is scoped, revocable, and visible on-chain. You can revoke it at any time from the Vision Predict console or directly from your wallet. Revocation stops new orders immediately; settling or closing existing positions still happens through Polymarket.

---

## 9. Your responsibilities

By enrolling in Vision Predict, you confirm that:

- You are **at least 18 years old**.
- You are **not a US person** and are not accessing the service from a blocked jurisdiction listed in Section 3.
- You have read and agree to **[Polymarket's Terms of Service](https://polymarket.com/tos)** as well as Vision Chain's Terms.
- You understand that Vision Predict is **beta software** and that you may lose **100% of the capital** you commit.
- You will configure your own risk rules and review them periodically.
- You will not rely on Vision Predict as your sole source of trading decisions, financial planning, or income.
- You accept that Vision Chain may pause, restrict, or discontinue Vision Predict in your region at any time.

---

## 10. Contact and updates

If anything on this page is unclear, if you believe a display is misleading, or if you need to report a security issue, contact us at **[predict@visionchain.co](mailto:predict@visionchain.co)**.

This page will be updated whenever the geo-block list, the pinned Polymarket protocol version, or our auto-pause policy changes. The version you are reading reflects the state of Vision Predict at the date below.

---

*Last updated: 2026-06-05*
