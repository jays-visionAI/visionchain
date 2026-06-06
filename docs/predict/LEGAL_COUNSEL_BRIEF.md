# Legal Brief: Vision Predict (Beta) — Request for Binding Opinion

**To:** [External Counsel — KR-licensed; with EU / US / UK / JP / SG reference network]
**From:** Vision Chain Foundation / VisionAI (operator of the VisionChain L1 and `agentGateway` service)
**Date:** 2026-06-05
**Re:** Multi-jurisdictional legal characterization of "Vision Predict" — a non-custodial AI-agent layer that can, when explicitly authorized by an end user, transact on the Polymarket prediction-market protocol.
**Classification:** Privileged & Confidential — Attorney Work Product Requested
**Phase Status:** Phase 1 (enrollment + authority-grant + risk-rule capture) is live in production. **No live betting yet.** Phase 3 (live betting) is gated on the opinion this brief requests.

---

## 1. Product Description

Vision Predict is a **configurable autonomous trading sandbox** layered on the VisionChain L1 and the `agentGateway` (a Firebase Functions dispatcher behind `https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway`). Users enroll a self-custodied wallet, sign an on-chain `authority.grant` scope (modeled after EIP-style delegations / Soul-Bound Token receipts) that defines the agent's operating envelope, and supply natural-language plus structured **risk rules** (e.g., max stake per market, daily loss cap, allowed market categories, blackout windows). When live (Phase 3), the agent reads public Polymarket order-book state, evaluates user-defined rules, and — *only within the granted scope and only from the user's own wallet* — may submit signed transactions to the Polymarket protocol. Vision Chain **never** takes custody of user funds, never holds positions on its books, never operates a matching engine, never sets odds, and earns no rake/spread; revenue is a flat T2 gas fee of 0.1 VCN per dispatched action, denominated in the network's native token and unrelated to bet outcome. Phase 1 (currently shipped) provides only enrollment, scope capture, and disclosure — no order submission paths are wired.

## 2. Operator Profile

- **Operating entity:** Korea-based company (VisionAI / Vision Chain Foundation). Engineering, product, and infrastructure operations are primarily located in the Republic of Korea. Final corporate structure for the Phase 3 launch vehicle is **an open question** (see §8).
- **Product surface:** Global web application; Solid.js frontend; backend on Google Cloud Functions (us-central1). Single global endpoint; no per-region deployment today.
- **Architecture (relevant to liability surface):**
  - **L1:** VisionChain EVM. User wallets sign all transactions client-side.
  - **Agent gateway:** A stateless action dispatcher (giant if/else router) authenticating via `api_key` (body), Bearer header, or `x-api-key` header. Actions are tiered T1 (free) / T2 (0.1 VCN deducted on-chain from the *agent* wallet, not from user position).
  - **Authority model:** `authority.grant` records a scope on-chain (SBT-style, non-transferable) describing what the agent may do; the user retains the private key and can revoke at any time.
  - **Discovery/discoverability:** A `polymarket` discovery block is exposed in the gateway's capability catalog; six `polymarket.*` action handlers exist in code; the predict surface is gated server-side by `isPredictEnabled()` and helper consts `POLY_BLOCKED_COUNTRIES`, `POLY_TOS_URL`, `POLY_DISCLAIMER`, plus a `normalizeRules()` validator.
- **Counterparty:** Polymarket (Polygon-based CLOB; UMA-resolved outcomes). Vision Chain has **no** commercial relationship, API agreement, or affiliate arrangement with Polymarket; the agent interacts with Polymarket's public smart contracts on the same terms as any other wallet.
- **User identity:** KYC tier is currently the same tier used for other VisionChain regulated actions (identity-verified). KYC vendor selection for Phase 3 is open (see §8).
- **Marketing posture (decided):** "Configurable autonomous trading sandbox." Explicitly **not** marketed as a make-money product, profit-generation service, or gambling product. Three risks have been pre-identified as must-mitigate: (i) geographic compliance gate, (ii) protocol-version brittleness on the Polymarket side, (iii) honest PnL framing.

## 3. Legal Questions

For each question please provide: (a) short answer, (b) reasoning with statute/case citations, (c) confidence level, (d) recommended mitigation if the answer is adverse, (e) what facts would flip your conclusion.

### Korea (primary)

**Q1.** Does operating an AI-agent service that, on behalf of an authenticated user, places prediction-market bets using the *user's own non-custodial wallet* and *user-defined risk rules* — where the operator (i) never holds funds, (ii) never sets odds, (iii) never collects rake, (iv) charges only a flat protocol gas fee unrelated to outcome — constitute "providing gambling services" or "speculative-act operation" (사행행위) under the **Act on Special Cases concerning the Regulation of Speculative Acts (사행행위 등 규제 및 처벌 특례법)**?
- *Fact pattern:* User signs a scope grant; agent reads public on-chain markets; agent submits a signed tx from the user's wallet; Vision Chain logs the dispatch and charges 0.1 VCN to its own relay wallet. No outcome-based fees, no pooled funds, no house position.

**Q2.** Does the SBT-style `authority.grant` model — where the *user* is unambiguously the principal and the agent is a bounded automation — materially change the analysis under **Criminal Act Article 246 (도박)** and Article 247 (도박장 개설)? Specifically, does running a *dispatcher that can refuse, throttle, or filter* user-initiated transactions constitute "opening a gambling place" (도박장 개설) under Art. 247, or does the non-custodial / user-authority structure defeat that element?

**Q3.** If a Korean-resident user who passed our KYC circumvents Polymarket's own geo-block (e.g., VPN to a non-blocked country) and uses our agent to place a bet, is Vision Chain exposed to (a) aiding-and-abetting liability under Art. 246, (b) operator liability under the Speculative Acts Act, or (c) administrative penalty? What is the standard of "knew or should have known"?

**Q4.** If we **explicitly disable the service for KR users** (IP block + KYC nationality block + on-chain wallet attestation), does the mere fact that the service is **developed, hosted-of-record, and operated from Korea** for *non-KR* users trigger operator liability under Korean law? In particular: does extraterritorial reach of Art. 246/247 attach when the operator/developer is in KR but no KR user is served?

**Q5.** Does **Polymarket's Terms of Service** clause restricting "agents developed by persons in restricted jurisdictions" (see Materials, §4) operate as an enforceable contractual bar against our team — i.e., are we a "developer" within the meaning of that clause regardless of whether we hold a Polymarket account, and what is the consequence of breach (mere TOS violation vs. tortious interference vs. CFAA-style unauthorized access exposure in the US)?

**Q6.** What concrete **disclosures, disclaimers, age-gates, capability ceilings, and product framing** would, in your opinion, support a defensible classification of Vision Predict as a **"research tool / general-purpose automation framework"** rather than a "gambling operator" — under both KR law and the comparator jurisdictions in Q7–Q10? Please specify language we can lift verbatim into Terms and UI copy.

### Comparator jurisdictions

**Q7. EU.** Would Vision Predict likely be classified under **MiCA** (as a crypto-asset service), **AMLD5/6** (as a virtual-asset service provider / obliged entity), and/or **national gambling acts** in **Germany (GlüStV 2021), France (ANJ regime), and the Netherlands (Ksa / Wok)**? Where MiCA and a national gambling act could both apply, what is the dominant characterization and what is the licensing path of least resistance?

**Q8. UK.** Does the **Gambling Act 2005** apply to our agent layer? Specifically, are we "providing facilities for gambling" (s. 5) or "facilitating remote gambling" by virtue of operating a dispatcher that can submit Polymarket orders on a UK user's behalf? What is the Gambling Commission's posture on non-custodial agents as of your latest read?

**Q9. Japan.** Does **Penal Code Article 185 / 186 (賭博・常習賭博)** apply to a user transacting on Polymarket via our agent? Does the crypto/smart-contract layer alter the analysis (i.e., is there precedent that the JFSA / METI / NPA treats crypto-mediated prediction markets as gambling per se)? Is there a meaningful "no consideration / no prize" defense available?

**Q10. Singapore.** How do the **MAS Payment Services Act (Digital Token Service)** regime and the **Gambling Control Act 2022** interact for this product? Is there an exemption path under the "skill-predominant" or "financial instrument" carve-outs?

### Cross-cutting

**Q11. Geofencing standard.** What is the **minimum geofencing posture** that supports a good-faith compliance defense across the above jurisdictions? Please rank and recommend among:
1. IP block only,
2. IP block + user attestation (click-through),
3. IP block + KYC nationality/residency check,
4. IP + KYC + ongoing residency re-verification + wallet-screening (chain-analysis attestation that the wallet was not previously used from a restricted jurisdiction),
5. (4) + active VPN/proxy detection.

State which tier is the **floor** (below which liability is materially elevated) and which is the **recommended target** for a Korea-incorporated operator.

**Q12. Operator structure.** Would standing up a non-KR operating subsidiary (e.g., Cayman, BVI, Panama, Abu Dhabi Global Market, Liechtenstein) materially reduce KR criminal exposure for the Korean parent and its officers, or is the Korean nexus (employees, development, decision-making) sufficient under KR conflict-of-laws to retain jurisdiction regardless?

**Q13. Officer/director personal liability.** Under KR law, do directors and officers of the KR parent face personal criminal exposure under Art. 246/247 distinct from corporate exposure, and is D&O insurance reasonably obtainable for this product profile?

**Q14. Polymarket-side enforcement.** What is the realistic enforcement path Polymarket itself could take against us (smart-contract blocklist, TOS suit, US CFTC referral given the 2022 KalshiEX / Polymarket history)? Please advise on the Polystrat case analogue (see Materials).

## 4. Materials Enclosed

1. **Polymarket Terms of Service** — current URL stored in code as `POLY_TOS_URL` (please confirm version at time of review).
2. **Vision Chain Terms of Service (draft)** including the in-product `POLY_DISCLAIMER` text shown at enrollment and on every dispatch confirmation screen.
3. **`authority.grant` schema** and `normalizeRules()` validator (source-level documentation of what an agent can and cannot do once enrolled).
4. **Action handler catalog** — the six `polymarket.*` handlers in `functions/index.js` (gateway dispatcher source), with the `ACTION_TIER_MAP` showing fee tiering.
5. **Discovery block** — the `polymarket: { ... }` capability descriptor exposed to clients (this is what a third-party agent developer would see).
6. **Deep-research dossier** — bullet-point evidence of **10+ government-level bans, restrictions, or enforcement actions against Polymarket / prediction markets** (US CFTC, France ANJ, Singapore, Taiwan, Belgium, Thailand, Poland, Australia, etc. — full list provided as appendix).
7. **Polystrat case analogue** — public summary of the Polystrat enforcement matter as the closest factual precedent for a third-party tooling provider on Polymarket.
8. **Vision Predict frontend wizard** — `components/predict/VisionPredict.tsx` (4-step enrollment + console) — exhibits the actual disclosures the user sees.
9. **i18n disclosures** — `i18n/locales/{en,ko}.json` `predict.*` keys (the literal user-facing language, EN + KO).
10. **Architecture memo** — one-pager on Firebase Functions gateway, `isPredictEnabled()` kill switch, T1/T2 fee model.
11. **Marketing posture statement** — internal one-pager confirming the "sandbox, not make-money" framing and prohibited marketing terms.

## 5. Requested Deliverable

1. **Binding opinion letter** addressed to Vision Chain Foundation (and any non-KR operating subsidiary we form), covering Q1–Q14 with confidence levels and citations, in a form suitable for sharing with (a) our auditor, (b) prospective banking partners, (c) prospective investors under NDA.
2. **Recommended risk-mitigation steps**, prioritized P0 / P1 / P2, mapped to product changes (UI copy, geo-block tier, KYC tier, on-chain attestation, terms changes, kill-switch SLA).
3. **Two jurisdiction lists**:
   - **MUST EXCLUDE** — geos where, in your opinion, launching Phase 3 creates unacceptable criminal or licensing exposure regardless of mitigations.
   - **MAY EXCLUDE / WATCH** — geos where mitigations make launch defensible but a regulatory shift is plausible within 12 months.
4. **Review cadence** recommendation — i.e., how often the opinion must be refreshed (quarterly? on Polymarket TOS change? on any KR enforcement action?) and what triggers a mandatory re-review.
5. **Reg-engagement strategy** — your view on whether to proactively engage the Korean FSC / NPA / MOIS / KCGB before Phase 3 launch, or to launch geofenced and respond to inquiries reactively.
6. **Template responses** for the three most likely inbound regulator questions, so we can answer within 24h without re-engaging counsel.

## 6. Timeline

- **Phase 1 (enrollment + authority + disclosures):** **Live in production today (2026-06-05).**
- **Phase 2 (paper-trading / simulation against real Polymarket prices, no on-chain orders):** planned within 30 days of Phase 1.
- **Phase 3 (live order submission):** **target launch date is the constraint that drives this engagement.** We are holding Phase 3 behind the `isPredictEnabled()` server flag pending receipt of your opinion.
- **Requested:** preliminary verbal read within **2 weeks**; full written binding opinion within **6 weeks**; if blockers are identified, written interim guidance within **3 weeks** so we can re-scope.

## 7. Budget Envelope

We are requesting an **estimate** rather than proposing a cap. Please provide:
- A blended hourly or fixed-fee proposal covering Q1–Q14 with the KR analysis as the lead workstream.
- A separate line item for each comparator jurisdiction (EU consolidated; UK; JP; SG) so we can scope down if needed.
- A retainer proposal for the post-launch **review cadence** in §5.4.
- Out-of-pocket and local-counsel pass-through assumptions.

For internal planning we have reserved an initial envelope appropriate to a multi-jurisdiction product opinion of this complexity, and are prepared to discuss scope adjustment to fit your standard engagement model.

---

*Prepared by:* Vision Chain Foundation, Legal & Product
*Primary contact:* jays@visai.io
*Technical contact (for materials in §4 items 3–5, 8–9):* engineering@visai.io
