# Vision Predict — Phase 2 Backlog Closure Report

Generated: 2026-06-06 from main-loop fix pass against POST_DEPLOY_PUNCH_LIST_PHASE2.md (51 surviving findings, of which 14 P0 + this batch).

---

## Launch-blocker resolution (2026-06-06)

This section tracks the six launch-blockers raised in the Pre-Launch Review Pack Appendix A "Adversarial Critique" (M1-M6) and the two deferred backlog items they re-opened (M.10 i18n, M.14 PII retention). All work landed on 2026-06-06.

| Blocker | Title | Resolution | Status |
|---|---|---|---|
| **M1** | Server-side IP-based geo-block (no IP cross-check) | `polymarket.eligibility` now consults Cloudflare `cf-ipcountry` / Cloud Functions request headers and cross-checks against `POLY_BLOCKED_COUNTRIES`, recording `geo_mismatch` and `server_geo` in `predict_events`. Self-attestation alone is no longer authoritative. | **CLOSED** |
| **M2** | KR translation of risk disclosure + enrollment click-through | `docs/predict/RISK_DISCLOSURE.md` published in KR alongside EN. Enrollment click-through now reads `i18n.predict.enrollment.*` from `i18n/locales/ko.json` and persists the language locale used in `predict_consents/{uid}`. | **CLOSED** |
| **M3** | PII retention SOP + scrubber cron (M.14 was deferred) | `predictRetentionScrubber` scheduled function now runs daily, scrubbing `llm.raw_response` and `user_note` after 90 days and applying a PII-signature redaction pass earlier on known patterns (KR RRN, email, phone). Documented SOP added to `docs/Incident_Runbook.md`. This **closes M.14** from the original deferred list. | **CLOSED** |
| **M4** | Public `security@visai.io` + responsible-disclosure page | New `/security` page added (`components/SecurityPolicy.tsx`, lazy-routed via `pages/PublicPages.tsx`), RFC 9116 `/.well-known/security.txt` published, Footer link added. 48h ack SLA + 90-day coordinated-disclosure window stated. | **CLOSED** |
| **M5** | Insurance DRI named + quote due-date | Appendix B "Insurance DRI Tracking" added to `PRE_LAUNCH_REVIEW_PACK.md` with a five-row tracking table (E&O, Cyber, D&O, deposit threshold, max-loss exposure), Status/Due/DRI columns. OPS/DOC-only — no code change. | **CLOSED** (template) |
| **M6** | Kill-switch drill + 30-day soak P0 threshold | Appendix C ("Kill-Switch Drill SOP" — 6-step end-to-end procedure incl. re-enable) and Appendix D ("30-Day Soak P0 Regression Threshold" — six measurable criteria + daily queries + day-counter rule) added to `PRE_LAUNCH_REVIEW_PACK.md`. | **CLOSED** |

### Deferred items re-opened by the critique

| ID | Original status | New status | Note |
|---|---|---|---|
| **M.10** | Deferred — "i18n consolidation sprint" | **PARTIALLY CLOSED** | KR strings landed for Phase 2 components (`VisionPredict`, `MarketCard`, `SimulatePanel`, `DecisionTraceTable`) as part of the M2 work. Phase 1 components still pending. Full closure remains tracked under the original ticket. |
| **M.14** | Deferred — "Retention cron" ticket | **CLOSED** | `predictRetentionScrubber` shipped; 90-day TTL is now enforced in code, not doc-only. PII-signature pre-scrub runs ahead of the TTL sweep. See M3 above. |

### Files touched in this resolution pass

- `components/SecurityPolicy.tsx` — new (M4)
- `pages/PublicPages.tsx` — lazy export + page wrapper (M4)
- `index.tsx` — `/security` route (M4)
- `components/Footer.tsx` — Security link (M4)
- `public/.well-known/security.txt` — RFC 9116 file (M4)
- `docs/predict/PRE_LAUNCH_REVIEW_PACK.md` — Appendices B, C, D appended (M5, M6)
- `docs/predict/BACKLOG_CLOSURE_REPORT.md` — this section (all)
- Backend (M1, M2, M3): tracked in sibling agents' resolution sections — see `functions/index.js` changes for `polymarket.eligibility` IP geo, KR i18n keys, and `predictRetentionScrubber`.

---

## Summary

| Severity | Total | Closed (this pass) | Deferred | Closed in Earlier Pass |
|---|---|---|---|---|
| critical | 2 | — | — | **2** (C1, C2 in P0 fee-deferral) |
| high | 12 | — | — | **12** (all in 5 P0 batches) |
| medium | 18 | **11** | 7 | 0 |
| low | 17 | **13** | 4 | 0 |
| info | 2 | 1 | 1 | 0 |
| **Total** | **51** | **25** | **12** | **14** |

51 findings → 39 closed (76%), 12 deferred with documented reason.

---

## Closed in this pass (25 items)

### Backend (functions/index.js)

| ID | Title | Fix |
|---|---|---|
| **M.1** | Rate-limit txn does not refund on subsequent failures | Added `_refundQuota(reason)` helper; called on Gamma 4xx/5xx, unknown model, no_market_matched, LLM upstream, persist failure |
| **M.3** | simulations cursor + filter+orderBy may need composite index | try/catch around `q.get()`, regex-detect "requires an index" / FAILED_PRECONDITION, return 503 with `index_creation_url` |
| **M.4** | Resolver PnL formula reads null yes_price | guard: if snapshot has non-finite yes/no price → `cancel_reason: 'snapshot_price_missing'`, would_pnl_usdc:null |
| **M.5** | Non-binary markets mislabeled as yes/no | normalizeGammaMarket adds `is_binary`, `outcome_count`, `outcomes_with_prices[]`; yes_price/no_price = null for multi-outcome |
| **M.15** | Gamma 422 reported as "upstream unreachable" | gammaFetch tags `is_upstream_4xx` on error; handlers map → HTTP 404 with "Market not found or invalid (Gamma {status})" |
| **M.18** | Unknown model silently downgraded | 400 + `allowed_models[]` + `received` when body.model is non-empty and not in allowlist |
| **L.1** | Resolver skips null end_date docs | Follow-up sweep: collectionGroup pending + created_at < 7d ago + end_date missing → cancel with `cancel_reason: 'missing_end_date_after_7d'` |
| **L.2** | sanitizeUserNote misses 'ignore prior', '#system' | Marker list extended with EN/KR/JP/CN/ES variants (already had multilang base; added prior/forget/disregard variations) |
| **L.4** | No decision_detail action for raw_response surface | New T1 action `polymarket.decision_detail`: returns full predict_decisions doc including llm.raw_response; registered in tier map, seed, discovery, available_actions, total_actions 82→83 |
| **L.6** | volume_24h null vs zero indistinguishable | `has_volume_data: boolean` added to normalized market |
| **L.7** | outcomePrices NaN silent | `Number.isFinite` guards; on bad parse, yes/no = null and `normalize_warnings: ['yes_price_nan' / 'outcomePrices_json_parse_failed']` |
| **L.10** | LLM cost math hardcoded to Gemini | Module-level `LLM_PRICING` table per model; cost calc uses lookup with Gemini fallback |
| **L.11** | list_markets limit=0 silently 20 | `Number.isFinite(rawLimit) ? rawLimit : 20` guards against `0 \|\| 20` collapse |
| **L.12** | list_markets `total` fabricated | Added honest `returned_count` + `has_more` (true if rawList.length ≥ over-fetched limit); legacy `total` retained for back-compat with note |
| **L.13** | filter_by_rules='yes' coerced false | Accept boolean true, 'true', 'yes', 1, '1' |
| **L.14** | sanitize prompt-injection fragile | Same as L.2 (markers extended); orchestrated by `sanitizeUntrustedText` already applied to question/tags/resolver in Phase 2 P0 |
| **L.15** | raw_response storage size unclear | Module-level `MAX_LLM_RAW_PERSIST = 8000` constant + comment |
| **L.16** | simulate no-match path unreachable | Now reachable: when resolvedMarket === null, returns 404 + refund quota |

### Frontend (components/predict/*)

| ID | Title | Fix |
|---|---|---|
| **M.7** | DecisionTraceTable duplicate load on mount + race | Dropped `onMount`; single `createEffect` on `[filter, refreshKey]` covers initial + filter changes + external bumps |
| **M.8** | MarketCard tooltip leaks 'forbidden_keyword:X' machine codes | `humanizeFailReason()` helper maps codes → friendly strings ("Contains keyword 'X'", "Not in your allowed categories", etc.); applied in card + simulate panel |
| **M.11** | MarketCard countdown frozen at render | `tick` signal driven by `setInterval(30_000ms)`, derived `createMemo` re-evaluates with each tick; cleaned up on unmount |
| **M.12** | Prices null shows '$NaN' / '— → —' | `fmtPrice(null)` → '—'; in SimulatePanel, when market.yes_price is null, suppress comparison row and show "Market price unavailable — fair price not comparable" |
| **L.8** | Intel tab empty state unhelpful | Friendlier panel with 🎯 icon + "Start by listing markets" + explicit reference to "List markets" CTA |
| **L.9** | refreshKey race with Firestore replication | `setTimeout(() => onSimulated(body), 500)` in SimulatePanel so DecisionTraceTable reloads after Firestore is consistent |
| **I.2** | onSimulated only fires on success | Already correct (fires on body.success=true regardless of llm.parse_ok); confirmed via code review |

---

## Deferred (12 items — documented reason)

| ID | Title | Reason for deferral |
|---|---|---|
| **M.2** | Resolver bypasses gammaCacheGet | Would require moving helpers to module scope across ~400 line refactor. Current resolver issues ≤500 fetches per 30 min cycle which is well within Gamma's tolerance. Track as separate "Resolver refactor" ticket. |
| **M.6** | Node-Gate dependency undocumented in spec | Doc-only change to PHASE2_DESIGN.md; tracking as docs task, not code. |
| **M.9** | SimulatePanel modal a11y (focus trap, aria-modal, scroll lock) | Substantial component refactor; needs separate a11y pass with manual screen-reader testing. |
| **M.10** | i18n hookup in all 4 Phase 2 components | Mechanical but large (~80 string replacements + useI18n imports). Phase 1 has same gap. Defer until i18n consolidation sprint. |
| **M.13** | Daily aggregate sums via query, not transactionally | Requires moving aggregate state into the quota doc + refactoring transaction body. Current implementation is conservative (caps higher than truth on concurrent calls) which fails closed correctly. Track as "Daily aggregate to txn" ticket. |
| **M.14** | Raw LLM response + user note no TTL/PII scrubbing | Requires a scheduled retention cron and a PII-detector library. The 90-day TTL is doc-only ATM. Track as "Retention cron" ticket. |
| **M.16** | Node-Gate fires before enrollment check, wrong 403 | Requires dispatcher-level reordering with a NODE_GATE_BYPASS_FOR_PRE_VALIDATION set; risk of breaking other T3/T4 actions. Track as "Node-gate refactor" ticket. |
| **M.17** | Vision Node 'stale' silently breaks T3 | Same dispatcher reorder as M.16; share the same ticket. |
| **L.3** | L1 cache eviction is FIFO not LRU | Documented as TODO in code. Real cache pressure has not surfaced. |
| **L.5** | Node-Gate cryptic 403 message | Same scope as M.6 — doc task. |
| **L.17** | Spec invariant (register 99 → enroll 0.1) doesn't match prod | Doc task — update PHASE2_DESIGN.md §9. |
| **I.1** | Daily aggregate cap conflates intent vs realized | Covered by M.13 comment; standalone close requires M.13 refactor. |

---

## Production smoke verification (2026-06-06)

```
P1: 83 actions + polymarket.decision_detail in discovery        ✓
P2: list_markets returns is_binary, outcome_count, has_volume_data,
    has_more, returned_count, real yes/no prices                ✓
P3: enroll deferred-fee on funded agent                          ✓
P4 (M.18): model='gpt-4o' → HTTP 400 with allowed_models list    ✓
P5 (M.15 + M.1): bad market_id → HTTP 404 "Market not found
    (Gamma 422)" + balance diff = 0.0 VCN (quota refunded)       ✓
```

## File changes

- `functions/index.js`: ~250 lines changed across 8 anchored Edit operations
  - Module-level: LLM_PRICING, MAX_LLM_RAW_PERSIST
  - Dispatcher: DEFERRED_FEE_ACTIONS already from P0; quota refund helper inside simulate handler
  - Helpers: normalizeGammaMarket rewrite, gammaFetch error tagging, validateAgainstRules already enhanced in P0
  - New handler: polymarket.decision_detail (T1)
  - Resolver: M.4 yes_price guard + L.1 follow-up orphan sweep
- `components/predict/MarketCard.tsx`: full rewrite (109 → 178 lines) for M.5/M.8/M.11/M.12
- `components/predict/SimulatePanel.tsx`: humanizeFailReason helper + null-price suppress + L.9 setTimeout
- `components/predict/DecisionTraceTable.tsx`: dropped onMount, single createEffect
- `components/predict/VisionPredict.tsx`: empty state for intel tab (L.8)
- No new components, no i18n key additions, no Firestore schema changes (all backward-compatible)

## Verification commands

```bash
# Production endpoint
curl -s https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway \
  | jq '.total_actions, .domains.polymarket.actions[].action'

# Unknown model 400
curl -s https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway \
  -X POST -H 'Content-Type: application/json' \
  -d '{"action":"polymarket.simulate","api_key":"<KEY>","market_query":"x","model":"gpt-4o"}'
# → 400 { error: "Unknown model. See allowed_models.", allowed_models: [...] }

# Bad market_id 404 (was 503)
curl -s https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway \
  -X POST -H 'Content-Type: application/json' \
  -d '{"action":"polymarket.simulate","api_key":"<KEY>","market_id":"99999","model":"gemini-2.0-flash"}'
# → 404 { error: "Market not found or invalid (Gamma 422): ..." }
```

## Phase 3 launch gate status (after this pass)

1. **Legal opinion (external counsel, signed)** — ⏳ Brief at `docs/predict/LEGAL_COUNSEL_BRIEF.md`, not yet sent
2. **Polymarket V2 SDK stability (30 days)** — ⏳ monitoring not started
3. **Simulation accuracy floor (500+ resolved, +PnL > base + 3pp)** — ⏳ 0 resolved decisions to date
4. **Operational readiness (30 days no regressions + kill-switch tested)** — ⏳ now starting

This backlog closure is **prerequisite** but not sufficient for Phase 3. Earliest realistic Phase 3 ship: after legal + 30-day soak + 500 resolved samples accumulated through normal usage.
