# Vision Predict — Post-Deploy Audit Punch List
Generated 2026-06-05 from Workflow `vp-post-deploy-iteration` (207 agents, 66→46 findings after 3-vote verify).

## Summary
- Raw findings: **66**, survived 3-vote verify: **46**, killed: **20**
- By severity: critical=1, high=5, medium=8, low=22, info=10
- By source: BE=8, FE=12, consistency=6, liveprobe=11, UX=9

## CRITICAL (1)
### C.1 [liveprobe] polymarket.eligibility returns eligible:true when no inputs are supplied
**Category:** security · **Final sev:** critical · **Votes:** 2/3

**Description:** The eligibility handler only blocks when (a) cc is non-empty AND in the block list, or (b) self_attest_age_18 is defined and false, or (c) self_attest_not_us is defined and false. If a caller submits {} (no country_code, no self_attest fields) the handler returns eligible:true. This means the official 'gate' green-lights any caller who declines to answer. Combined with the previous finding it makes the compliance posture effectively opt-in.

**Evidence:** functions/index.js lines 17550-17567. Test (no body fields): curl ... -d '{"action":"polymarket.eligibility","api_key":"$KEY"}' -> {"success":true,"eligible":true,"blocked_reason":null,...}. country_code:null and country_code:'' also return eligible:true.

**Fix:** Require country_code, self_attest_age_18, self_attest_not_us to be present; reject with 400 if any are missing. Treat any falsy/missing as ineligible (default-deny), not eligible (default-allow).

---

## HIGH (5)
### H.1 [BE] polymarket.enroll never actually charges 0.1 VCN (fee config uses Firestore service_tiers, not ACTION_TIER_MAP)
**Category:** correctness · **Final sev:** high · **Votes:** 3/3

**Description:** The new ACTION_TIER_MAP entries for polymarket.enroll/update_rules at line 10489-10491 are only used by the Node-Gate (T3/T4 check at line 10495). The actual fee deduction at line 10544-10545 reads from pricingConfig.service_tiers (a Firestore doc at config/api_pricing). No migration/seed code was added for polymarket.* entries in service_tiers, so feeTierId defaults to T1 (`pricingConfig.service_tiers[canonicalAction] || "T1"`) and feeVcn becomes 0. The public discovery doc (line 10005) still advertises cost "0.1" and the auto-injected `fee` block (line 10612) only attaches when `feeVcn > 0`, so enrolling agents pay nothing and the response omits the fee field entirely — silently contradicting the documented price.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/functions/index.js:10544-10549 — `if (pricingConfig && pricingConfig.tiers && pricingConfig.service_tiers) { feeTierId = pricingConfig.service_tiers[canonicalAction] || "T1"; ... feeVcn = parseFloat(tierDef.cost_vcn) || 0; }`. No service_tiers update was deployed.

**Fix:** Either (a) write a one-time migration that adds `polymarket.enroll: "T2"`, `polymarket.update_rules: "T2"`, `polymarket.eligibility: "T1"`, `polymarket.config: "T1"`, `polymarket.pause: "T1"`, `polymarket.resume: "T1"` to `config/api_pricing.service_tiers`, or (b) refactor the fee middleware to fall back to ACTION_TIER_MAP when service_tiers has no entry.

---

### H.2 [BE] POLY_BLOCKED_COUNTRIES omits major restricted jurisdictions explicitly called out in research (UK, DE, RU, IR, CA, AU, ...)
**Category:** security · **Final sev:** high · **Votes:** 2/3

**Description:** The blocklist at line 17492-17496 covers 15 countries but is missing several jurisdictions that Polymarket TOS, OFAC, and national regulators all already require. The brief explicitly highlighted gaps: UK (FCA close-only since late 2023), Germany (BaFin), Russia / Iran / Syria / North Korea / Cuba / Crimea (OFAC sanctions — also prohibited by Polymarket TOS), Ontario / Quebec (CSA enforcement), Australia (close-only). Shipping a public eligibility gate that omits these means non-eligible users get an `eligible: true` response from us, which is a worse compliance posture than not checking at all (we are now actively misrepresenting eligibility).

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/functions/index.js:17492-17496 — only `["US","FR","NL","BE","PL","SG","TW","TH","ID","BR","ES","PT","AR","HU","IN"]`. Note also that input is sliced to 2 chars (line 17550) so the typical 3-letter ISO codes for sanctioned regions are not even matchable.

**Fix:** Move the list to system_config (so it can be updated without redeploy), and add at minimum: GB, DE, RU, IR, SY, KP, CU, CA (or CA-ON / CA-QC handled via subdivision input), AU, and the OFAC-listed regions (Crimea, DNR, LNR). Also expose subdivision-level checks for CA, US states (e.g. KY litigation) and reject unknown country codes rather than letting them pass.

---

### H.3 [FE] checkEligibility skips age18 check (truthy-function reference instead of call)
**Category:** correctness · **Final sev:** high · **Votes:** 2/3

**Description:** The guard `if (!age18 || !notUs || !acknowledged())` uses `age18` (the signal accessor function reference) and `notUs` (also a function reference) directly instead of invoking them. A function reference is always truthy, so `!age18` is always `false`. This means the validation only really checks `acknowledged()` — a user can submit the eligibility request without ticking the age and US‑person boxes, defeating the legal self‑attestation gate that the entire Phase‑1 compliance story depends on.

**Evidence:** components/predict/VisionPredict.tsx:135 — `if (!age18 || !notUs || !acknowledged()) { setError('Please confirm all three statements before continuing.'); return; }`. Compare with line 144 which correctly calls `age18()` and `notUs()` when sending to the API.

**Fix:** Call the accessors: `if (!age18() || !notUs() || !acknowledged())`. Consider also disabling the Continue button until all three are checked to make the contract obvious.

---

### H.4 [consistency] polymarket.enroll synthesizes a fake authority_grant_id instead of calling the real authority.grant codepath -- silent gap with authority.status / .audit / .usage / .revoke
**Category:** correctness · **Final sev:** high · **Votes:** 2/3

**Description:** polymarket.enroll fabricates `authority_grant_id = authgrant_polymarket_<agent>_<ts>` and stores it as a labeled string on `agents/{id}/predict/config.authority`. The real authority subsystem (lines 12175-12231) writes to a separate sub-collection `agents/{id}/authority_delegations` and emits to `authority_audit`. Because we never touched that codepath, polymarket grants are invisible to authority.status, authority.usage, authority.audit, and cannot be revoked via authority.revoke. The handler comment even says 'create authority.grant scope=polymarket.bet' but it doesn't. This breaks the whole 'non-custodial delegated authority' narrative we are marketing.

**Evidence:** functions/index.js:17644 `const authorityGrantId = "authgrant_polymarket_${agent.id}_${Date.now()}";` and 17654-17661 stores a hand-rolled `{grant_id, scope, max_amount_per_tx, max_daily_amount, expires_at, granted_at}` blob on the predict config doc; while the canonical writer at 12198 is `db.collection("agents").doc(agent.id).collection("authority_delegations").add(...)` followed by a write to `authority_audit` at 12209. Discovery at 10005 even advertises 'create authority.grant scope=polymarket.bet' which is false.

**Fix:** Inside polymarket.enroll, after rules validation, perform the same Firestore writes that authority.grant does: create a doc in `authority_delegations` with permissions=['polymarket.bet'], limits={max_amount_per_tx: rules.max_bet_usdc, max_daily_amount: rules.daily_loss_cap_usdc}, expires_at, and mirror to `authority_audit`. Use the returned delegationRef.id as authority_grant_id. On polymarket.update_rules, update the same delegation doc's limits (not just the local predict.authority.* string fields). On polymarket.pause/resume, set delegation status=paused/active in the same collection.

---

### H.5 [liveprobe] UK (and other ISO-3 codes) bypass the geo-block list
**Category:** compliance · **Final sev:** high · **Votes:** 2/3

**Description:** Polymarket TOS treats the United Kingdom as a heavily restricted jurisdiction (Gambling Commission has issued formal warnings). The block list uses ISO alpha-2 ('GB'). Users who supply 'UK' (a common alias / typo) bypass cleanly: slice(0,2).toUpperCase()='UK' which is not in POLY_BLOCKED_COUNTRIES. Same for any non-ISO-alpha-2 surface like 'England', 'UNITED', etc. Also 'KOR' (3-letter) slices to 'KO' and is treated as eligible.

**Evidence:** Test country_code:'UK' -> eligible:true, country_code:'GB' -> eligible:true (GB not currently in block list either). Test country_code:'KOR' -> eligible:true (slice 'KO').

**Fix:** Add 'GB' to POLY_BLOCKED_COUNTRIES if Polymarket TOS still restricts UK persons. Treat any non-2-character country_code as ineligible (400) instead of slicing. Maintain mapping for common aliases ('UK'->'GB') or reject them outright.

---

## MEDIUM (8)
### M.1 [FE] i18n keys defined in en.json/ko.json but never consumed — entire component is hardcoded English
**Category:** i18n · **Final sev:** medium · **Votes:** 2/3

**Description:** The locale files contain a `predict.*` namespace (intro, ackStatement, etc.) but VisionPredict.tsx never imports `useI18n` / `t` (no `i18n` symbol anywhere). Every visible string (`Eligibility check`, `Continue →`, `Enrolled. Live betting is not yet enabled (Phase 3).`, error messages, summary labels, amber banner, etc.) is hardcoded. Korean users hitting `/predict` will see English; worse, the legal self‑attestation statements ("I am NOT a US person…", "I am at least 18 years old…") will not be presented in the user's language, weakening their evidentiary value.

**Evidence:** Grep for `useI18n|i18nContext|t(` in components/predict/VisionPredict.tsx returns zero hits. Hardcoded strings: line 246 `EXPERIMENTAL · BETA · SANDBOX`, line 248 `Vision Predict`, line 281 `Eligibility check`, line 314 `I am at least 18 years old…`, line 336 `Continue →`, line 202 `Enrolled. Live betting is not yet enabled (Phase 3).`. Meanwhile en.json:538 onward defines `predict.gate.intro`, `predict.gate.ackStatement`, etc.

**Fix:** Import `useI18n` (same hook AgentGateway-adjacent components use), pull `const [t] = useI18n()`, and replace literal strings with `t('predict.gate.intro')` etc. Add the missing keys for the labels not yet present (numeric field labels, summary, console).

---

### M.2 [FE] config.enrolled with null rules leaves stale form state — Edit panel pre-fills with defaults (10/50/10), Save quietly overwrites
**Category:** correctness · **Final sev:** medium · **Votes:** 2/3

**Description:** `refreshConfig` only restores `maxBet`/`dailyLoss`/`dailyCount`/`selectedCats`/`forbidden`/hours if `cfg.rules` is truthy (line 118). For an enrolled-but-rules-null state (legitimately produced if a backfill writes the enrollment doc before rules, or if a future schema-migration nulls them), the console renders, the Edit panel shows the *initial* defaults (10 USDC, 50 USDC, 10 bets, Crypto+Tech, 'election, war, death', 0–24), and clicking Save will POST those defaults to `polymarket.update_rules`, silently replacing whatever was server-side. There is no "no rules — please configure" UI path. The console header also reads `config()!.rules?.max_bet_usdc ?? 0`, which will render `$0` next to the editable defaults of `$10`, an obvious inconsistency the user will likely "fix" by hitting Save.

**Evidence:** components/predict/VisionPredict.tsx:115-127 (`if (cfg.rules) { setMaxBet(...)... }` — no else branch) and lines 491-494 (Stat reads `config()!.rules?.max_bet_usdc ?? 0`). Edit panel uses the same `maxBet()` signal at line 507.

**Fix:** Either (a) in the rules-null branch, set the form fields from sensible server-suggested defaults and surface a banner ("Finish setup"), or (b) hide the Edit panel until `config()!.rules` is non-null and force the wizard. Also reject Save when rules are null and prompt the user to enroll fully.

---

### M.3 [FE] validateRules order leaks wrong message when both max-bet=0 and hours are inverted
**Category:** ux · **Final sev:** medium · **Votes:** 2/3

**Description:** `validateRules` checks `dailyLoss() < maxBet()` first, then categories, then `endHour() <= startHour()`. NumField parses with `parseFloat(...) || 0`, so emptying the Max single bet field yields `0`. A daily loss cap of `1` is `>= 0`, so the first check passes silently; the user can submit `max_bet=0` rules. Backend may or may not reject — but the *frontend* never tells the user. Additionally `min={1}` on the input is advisory (the user can paste `0` or `-5`; `parseFloat('-5') || 0` yields `-5` which is `< 1` but not coerced). Daily loss cap is also unbounded against `max_bet * daily_bet_count` — a user can set max_bet=100, count=200, cap=100 and the agent could blow the cap on the first bet.

**Evidence:** components/predict/VisionPredict.tsx:175-180 validateRules; line 557 NumField onInput `parseFloat(e.currentTarget.value) || 0` — accepts negatives, accepts 0, ignores min/max attributes.

**Fix:** Add explicit clamps: `if (maxBet() < 1) return 'Max single bet must be at least 1 USDC.'`, `if (dailyCount() < 1) return ...`, and clamp in NumField: `const n = parseFloat(v); if (!Number.isFinite(n)) return; props.setValue(Math.min(props.max, Math.max(props.min, n)));`. Consider warning when `dailyLoss < maxBet * dailyCount`.

---

### M.4 [consistency] Two actions (polymarket.pause / .resume) where the established pattern is one action with {enabled: bool} (hosting.toggle)
**Category:** consistency · **Final sev:** medium · **Votes:** 2/3

**Description:** hosting.toggle (11387) takes `{ enabled: true|false }` and is a single T2 action. authority.revoke is also a single inverse-action. Vision Predict instead exposes two distinct verbs polymarket.pause and polymarket.resume. This (a) doubles the action surface, (b) splits tier/cost rules (we made both T1=free, even though pause is a write that mutates an authority scope), and (c) makes future client code branch on state. Other write-toggles in the codebase are T2 with a 0.1 VCN fee.

**Evidence:** functions/index.js:9978 discovery for hosting.toggle: `{ enabled: "required (boolean)" }`. Polymarket discovery 10007-10008 declares two separate actions. Tier map 10491 sets both pause/resume to T1 ('cost 0') even though they mutate `agents/{id}/predict/config.status` and an authority scope -- compare to settlement.set_wallet which is T2 for similar magnitude of mutation.

**Fix:** Collapse to a single `polymarket.set_status` (or `polymarket.toggle`) taking `{ enabled: boolean, reason?: string }` at tier T2. Update ACTION_TIER_MAP, the discovery block, the available_actions list, the FE wizard, and i18n keys. If we want backward compatibility with the FE we just shipped, keep pause/resume as aliases in ACTION_CANONICAL pointing to the new action with the bool pre-filled.

---

### M.5 [liveprobe] authority_grant_id returned by enroll is fabricated; no entry in authority delegations
**Category:** correctness · **Final sev:** medium · **Votes:** 3/3

**Description:** polymarket.enroll synthesizes `authority_grant_id = authgrant_polymarket_${agent.id}_${Date.now()}` and stores it in the predict/config doc. The discovery doc and enroll description both claim it 'create[s] authority.grant scope=polymarket.bet'. But the standard authority subsystem (which Phase 3 betting will presumably check) never sees it. authority.status returns 0 delegations for an enrolled agent. This means: (a) the docs are misleading, (b) if Phase 3 wires place_bet to check the canonical delegations collection (as is the safe default) every enrollment will need to be migrated or re-granted, and (c) authority.usage/audit will never show predict activity.

**Evidence:** functions/index.js line 17644: id is just a generated string; persisted only into agents/{id}/predict/config.authority sub-object. After enroll: authority.status with the same api_key returns {"active_delegations":0,"delegations":[]}. The id starts with 'authgrant_' but no authgrant_* document is created in the delegations collection.

**Fix:** Either (a) actually create a row in the canonical authority/delegations collection with scope='polymarket.bet', delegate_to=agent's bet executor, max_amount_per_tx, expires_at — so Phase 3 betting and authority.* introspection share one source of truth — or (b) drop the misleading authority_grant_id and rename to predict_grant_id with a clear 'this is a Vision Predict-scoped permission, not a generic authority delegation' note in the discovery doc.

---

### M.6 [UX] Component never calls useI18n() — Korean/Japanese/Thai users see English only
**Category:** i18n · **Final sev:** medium · **Votes:** 3/3

**Description:** All 40+ predict.* keys exist in en.json, ko.json (and the codebase ships jp/th too) but VisionPredict.tsx never imports useI18n or invokes t(). Every visible string — headings, step labels, checkbox copy, error messages, button labels, summary rows, console copy — is a hardcoded English literal. The locale switcher (used by every other component such as Wallet.tsx, Bridge.tsx, ValidatorStaking.tsx, WalletSettings.tsx) has no effect on this surface. KR users in the target Asia market will read the entire 4-step legal/risk gate in English, which is also a compliance problem (informed consent on US-person and age attestations is supposed to be understood by the user).

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/components/predict/VisionPredict.tsx line 1 imports only solid-js + router; grep for 'useI18n' / 't(' returns zero hits in this file. Strings are inline e.g. line 248 `<h1>Vision Predict</h1>`, line 281 `<h2>Eligibility check</h2>`, line 314 `<span>I am at least 18 years old…</span>`, line 336 `'Checking…' : 'Continue →'`. Meanwhile /Users/sangjaeseo/Antigravity/Vision-Chain/i18n/locales/ko.json line 538-595 already has full Korean translations (e.g. "heading": "자격 확인", "ageStatement": "본인은 만 18세 이상이며…").

**Fix:** Add `import { useI18n } from '../../i18n/i18nContext';` and `const { t } = useI18n();` inside the component, then replace every literal with `t('predict.gate.heading')` etc. The JSON tree is already aligned with intuitive paths (predict.gate.*, predict.rules.*, predict.strategy.*, predict.authority.*, predict.console.*). Also wire the `disclaimer` returned from polymarket.eligibility through t() so server-side English copy doesn't sneak back in.

---

### M.7 [UX] Time window forced to UTC — Asia/Seoul users will set the wrong active hours
**Category:** ux · **Final sev:** medium · **Votes:** 3/3

**Description:** The wizard exposes 'Active from (hour, UTC)' / 'Active until (hour, UTC)' as raw integers and the summary shows '02–10' with the UTC suffix. A user in KST (UTC+9) who wants 'business hours 09:00–18:00 local' must mentally subtract 9 to enter 00–09 UTC, with a date rollover. Empirically, most users will type 9 and 18 anyway, so the agent will trade overnight local time, which is the opposite of what they intended. Worst case (Phase 3): the agent places trades during sleep, hits the daily-loss cap, and the user wakes up to losses. The backend already stores `timezone: 'UTC'` (line 17531 server) and the schema allows arbitrary IANA strings, so the data model supports per-user TZ — just the UI doesn't.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/components/predict/VisionPredict.tsx lines 383-384: `<NumField label="Active from (hour, UTC)" ...>` and line 171: `time_window: { start_hour: startHour(), end_hour: endHour(), timezone: 'UTC' }`. Summary at line 454: `Active hours (UTC): {startHour()}–{endHour()}`.

**Fix:** Capture hours in the user's IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), show local labels like 'Active from 09:00 (Asia/Seoul = 00:00 UTC)', store both `timezone` and the original hours, and convert on the server. At minimum, surface a 'Timezone' dropdown beside the two hour fields and a live-converted '→ 03:00 UTC' helper underneath.

---

### M.8 [UX] Accessibility regressions: no aria-live for banners, labels not associated, focus order/keyboard nav untested
**Category:** a11y · **Final sev:** medium · **Votes:** 2/3

**Description:** Zero aria-* / role= / for= attributes in the entire component. (1) The error and info banners (lines 255-260) appear dynamically but lack `role='alert'` or `aria-live='polite'`, so screen readers do not announce eligibility failures, validation messages, or 'Enrolled' confirmation. (2) The country input (line 297) and forbidden-keywords input (line 373) use sibling `<label>` blocks with no htmlFor/id association — VoiceOver/NVDA will read them as unlabeled fields. (3) The category 'chips' are `<button>` elements with no `aria-pressed` to indicate selected state; sighted users see white-on-black vs gray, screen-reader users get nothing. (4) The strategy cards (lines 565-573) are `<button>` containers with two divs of text but no aria-label or role='radio' / aria-checked, so the radio-style behavior is invisible to AT. (5) The disabled enroll/continue buttons use the `disabled` HTML attribute, which removes them from the tab order; combined with `disabled:opacity-40` the result is invisible to keyboard users who can't see why they're stuck. (6) Color contrast: `text-amber-200/80` on `bg-amber-500/[0.04]` over `#050505` and `text-[#9b9ba0]` (gray) on `bg-white/[0.02]` are borderline WCAG-AA at small font sizes (11–12px used heavily for helper copy).

**Evidence:** grep aria-/role=/for= in /Users/sangjaeseo/Antigravity/Vision-Chain/components/predict/VisionPredict.tsx returns 0 matches. Banners: lines 256, 259 (`<div class="… text-red-300 text-sm">{error()}</div>`). Country label/input split: lines 296-304. Category buttons: lines 357-367 (`active() ? 'border-white bg-white' : ...` only, no aria-pressed). Disabled buttons: lines 333-336 (`disabled={loading() || !apiKey()}`).

**Fix:** Add `role='alert'` + `aria-live='assertive'` to the error banner and `aria-live='polite'` to the info banner. Generate unique ids and use `for={id}` on labels. Convert category chips to `<button aria-pressed={active()}>`. Convert strategy cards to a `role='radiogroup'` with `role='radio' aria-checked={active}` children. Replace `disabled` with `aria-disabled='true'` + an onClick that surfaces the reason (e.g. 'Confirm the three statements first'). Bump the helper-text color from `#9b9ba0` to `#c9c9d0` (contrast ratio ~9:1 instead of ~5:1) and bump 11px text to 12px minimum.

---

## LOW (22)
### L.1 [BE] isPredictEnabled fails OPEN on every read error or missing doc (kill-switch is unreliable for a regulated product)
**Category:** security · **Final sev:** low · **Votes:** 2/3

**Description:** The launch flag at line 17501-17506 returns `true` when the system_config/predict document is missing AND when Firestore throws (catch returns true). For a product gated on TOS/jurisdiction compliance, the correct posture is fail-closed: if Vision Chain operators cannot read the kill-switch doc, no further enrollments / resumes should happen. As written, an admin who deleted the doc to disable the product would actually re-enable it, and a transient Firestore outage during a regulator inquiry would also re-enable enrollments.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/functions/index.js:17501-17506 — `async function isPredictEnabled() { try { const cfg = await db.collection("system_config").doc("predict").get(); return cfg.exists ? (cfg.data().enabled !== false) : true; } catch (_) { return true; } }`

**Fix:** Change defaults to fail-closed: `return cfg.exists ? (cfg.data().enabled === true) : false;` and `catch (_) { return false; }`. Document explicitly that operators must seed `system_config/predict = {enabled: true}` before the product is live.

---

### L.2 [BE] polymarket.enroll uses set({merge: false}), so re-enrolling silently wipes paused_at/pause_reason/resumed_at and resets status to active
**Category:** correctness · **Final sev:** low · **Votes:** 2/3

**Description:** Calling polymarket.enroll a second time replaces the whole config document with merge:false (line 17668). Any agent that was paused (either by user, by an admin compliance action, or by an automated risk trigger) is silently un-paused — status flips back to "active" and paused_at / pause_reason are dropped because they aren't in the payload. There is no idempotency check; an attacker who phishes/leaks a Tier-2 fee from a victim agent could unpause a compliance-paused config simply by re-enrolling.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/functions/index.js:17649-17668 — `payload = { ... status: "active", ... }; await cfgRef.set(payload, { merge: false });` and the payload contains no paused_at, pause_reason, resumed_at fields. There is no `if (existing.exists && existing.data().status === 'paused') return 409` branch.

**Fix:** Either reject re-enrollment when a config already exists (return 409 with hint to use update_rules), or use `set(payload, { merge: true })` and explicitly carry over paused_at, pause_reason, resumed_at, and never overwrite status when it is "paused" (or admin-disabled). Also use a Firestore transaction so two simultaneous enrolls cannot race.

---

### L.3 [BE] ethers.isAddress accepts lowercase non-checksummed addresses; stored wallet_address may not match what Polymarket / authority.grant downstream expect
**Category:** correctness · **Final sev:** low · **Votes:** 2/3

**Description:** `ethers.isAddress` returns true for both checksummed and all-lowercase/all-uppercase 0x-prefixed 40-hex strings. The handler stores the raw user-provided string (after trim) without normalising it (line 17630). Downstream comparisons (Polymarket relay matching, on-chain authority.grant scope, event matching, KYT/AML logs) frequently rely on the EIP-55 checksum form (e.g. graph indexers, Polymarket UMA arbitration) and string equality. Two enrollments with the same address in different cases will be considered distinct in audit logs.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/functions/index.js:17630-17651 — `const walletAddress = String(body.wallet_address || "").trim(); if (!ethers.isAddress(walletAddress)) {...}; ... wallet_address: walletAddress, ...`

**Fix:** Normalize before storing: `const walletAddress = ethers.getAddress(String(body.wallet_address||'').trim());` inside a try/catch that returns 400 on `INVALID_ARGUMENT`. Same normalization should be applied in the audit log and the authority.grant payload.

---

### L.4 [BE] Audit log and config write are not atomic — partial failure leaves enrolled config without audit trail (and a successful config write followed by audit-add failure throws 500 even though enrollment persisted)
**Category:** operability · **Final sev:** low · **Votes:** 3/3

**Description:** Enroll does `await cfgRef.set(payload, { merge: false })` then `await db.collection(...).add({...})` for predict_events (lines 17668-17680). If the predict_events `.add` throws (e.g. Firestore quota / transient), the outer catch returns HTTP 500 with `polymarket.enroll failed: ...` even though the agent IS enrolled and the authority.grant scope is live. The client will retry, which thanks to set({merge:false}) will silently re-enroll (re-issuing a new enrollment_id and authority_grant_id, clobbering paused state — see prior finding) and re-charge the fee. The user-facing UX shows a failed enroll while the backend has an active grant.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/functions/index.js:17668-17680 + outer catch at 17693. Same pattern in update_rules (17716-17723), pause (17744-17746), resume (17770-17772).

**Fix:** Wrap config write + audit-event into a Firestore batched write (`db.batch().set(...).set(...).commit()`) so both succeed or both fail atomically. Alternatively, do the audit `.add` after the response (`res.json(...); db.collection(...).add(...).catch(...)`), trading audit completeness for response stability.

---

### L.5 [FE] Refresh after enrollment does not restore strategy='custom' or selection state
**Category:** correctness · **Final sev:** low · **Votes:** 2/3

**Description:** ConfigResp carries `strategy?: string`, and the backend echoes whatever was stored (`preset` or `custom`). `refreshConfig` updates `walletAddress`, rules, and categories but never calls `setStrategy(cfg.strategy)`. After enrollment, if the user navigates back through the wizard (e.g. the console doesn't show the wizard, but a future Edit→Strategy path or a page reload landing on `strategy` step) the strategy signal still says `'preset'` regardless of what was persisted. Worse, narrowing `strategy` to the literal union `'preset' | 'custom'` means any future server-added strategy id (e.g. `'momentum'`) cannot be represented in the UI at all — the Strategy Stat (line 494) silently shows the new value but the wizard cards can never display it as selected.

**Evidence:** components/predict/VisionPredict.tsx:104-128 (`refreshConfig` — no `setStrategy(...)` call). Type defined at line 92: `createSignal<'preset' | 'custom'>('preset')`. Console reads `config()!.strategy` directly at line 494.

**Fix:** In `refreshConfig`, add `if (cfg.strategy === 'preset' || cfg.strategy === 'custom') setStrategy(cfg.strategy);`. Long-term, widen the signal to `string` and drive the wizard cards from a list.

---

### L.6 [FE] browserCountry() defaults — fallback to language code (e.g. `EN`, `KO`) is mis-typed as a country and will fail backend country check
**Category:** correctness · **Final sev:** low · **Votes:** 2/3

**Description:** `browserCountry()` splits `navigator.language` (e.g. `en-US` → `US`, `ko` → `KO`) and returns `(parts[1] || parts[0] || '').toUpperCase().slice(0, 2)`. When the browser returns a bare language tag like `ko` or `en`, the function returns `KO` or `EN` — neither is an ISO-3166-1 country code. The country field is then pre-filled with `KO` (which happens to be a real country code — North Korea, very likely on POLY_BLOCKED_COUNTRIES) or `EN` (not a country at all). A Korean speaker whose browser sends `ko` rather than `ko-KR` will be auto-flagged as North Korean. A user in `en` (generic) will be auto-flagged as a nonsense country and the eligibility call may pass when it shouldn't, or fail with a confusing message.

**Evidence:** components/predict/VisionPredict.tsx:56-62. Demonstration: `'ko'.split('-')` → `['ko']`, `parts[1]` undefined, falls through to `parts[0]` = `'ko'` → `KO`.

**Fix:** Only return when `parts[1]` exists (i.e. region subtag present): `return (parts[1] || '').toUpperCase().slice(0, 2);` Or use `Intl.Locale(navigator.language).region` (with a try/catch) which returns the actual region or undefined.

---

### L.7 [FE] localStorage 'vcn_agent_api_key' is read synchronously but key may be a stale/rotated/empty string with leading whitespace
**Category:** security · **Final sev:** low · **Votes:** 2/3

**Description:** Both VisionPredict and AgentGateway share the localStorage key `vcn_agent_api_key`. VisionPredict treats `''` and `null` the same (line 47: `localStorage.getItem('vcn_agent_api_key') || ''`), but never validates the format or checks for an expired/revoked key before issuing any of six T1/T2 calls. If the key has been rotated server‑side, the user lands on the eligibility step with no error, ticks the boxes, and only on first POST do they see whatever the backend returns (probably `'invalid_api_key'`). There is no "sign out" / "clear key" UI here either — yet AgentGateway *writes* the key. If a user signed in as Agent A elsewhere, navigates to /predict, they cannot tell which identity will be used.

**Evidence:** components/predict/VisionPredict.tsx:46-54 callApi reads `localStorage.getItem('vcn_agent_api_key') || ''` on *every* call; lines 97-102 onMount reads but never validates.

**Fix:** Show the masked api_key (last 4 chars) and the linked agent name in the page header, plus a `Switch agent` link to /agent. On 401-equivalent errors, clear the key and redirect to /agent. Trim whitespace before storing in AgentGateway.

---

### L.8 [FE] Console branch `Show when={step() === 'console' && config()}` will not re-render when only `config()` updates from null → object if step was already 'console'
**Category:** correctness · **Final sev:** low · **Votes:** 3/3

**Description:** This is fine in Solid (both `step()` and `config()` are tracked inside the `when` thunk), but a more pressing issue is that `step` is only set to `'console'` inside `refreshConfig` *after* `setConfig(cfg)`. Between mount and the first refreshConfig resolution, `step()` is `'gate'` and the eligibility card briefly renders. If the user already has a valid key and is enrolled, they see the eligibility step flash for ~200-800ms while the network request completes, then it swaps to the console. There's no loading skeleton — `loading()` is set, but no UI changes (the eligibility card doesn't show a spinner). This is jarring and breaks the impression of a sandboxed/professional product.

**Evidence:** components/predict/VisionPredict.tsx:97-102 onMount + 104-128 refreshConfig; lines 279-340 eligibility card renders whenever `step()==='gate'`. No initial `loading()` gate around the entire wizard.

**Fix:** Add an initial `bootstrapping` signal set to `true` while the first refreshConfig is in flight; render a centered spinner instead of the wizard during that time. Or set `step` to a new `'loading'` state during bootstrap.

---

### L.9 [FE] Error state is not cleared between successful step transitions — info() and error() can persist into the next step
**Category:** ux · **Final sev:** low · **Votes:** 3/3

**Description:** `setError('')` is called in some handlers but not all. The wizard's local Continue handler (line 390-395) clears `error` but does not clear `info`. `pauseAgent`/`resumeAgent` clear `error` but again leave `info`. After enroll succeeds and the user is bounced to the console, the green "Enrolled. Live betting is not yet enabled (Phase 3)" banner sticks at the top of the dashboard forever (until the page is reloaded or a new info value is set) because nothing clears `info()`. Conversely, if a previous error sat (e.g. "Pause failed") and the user then clicks Resume successfully, the red error banner stays alongside the new green info — contradictory state visible to the user.

**Evidence:** components/predict/VisionPredict.tsx:202-203 setInfo+refreshConfig; refreshConfig at line 106 clears error but never touches info. Lines 226-228 pauseAgent setInfo without clearing prior error.

**Fix:** At the top of every handler, both `setError('')` and `setInfo('')`. Auto-dismiss info banners after 4–5s via `setTimeout(() => setInfo(''), 4000)`. Consider a single `notification` signal of shape `{kind, message}` to avoid contradictory pairs.

---

### L.10 [FE] Eligibility response: when backend returns `eligible: true` after a previous block, prior `eligibility().blocked_countries` UI still rendered until next call — but block list shown next to the country field is sourced from server, so retry with a different country shows previous server response's countries
**Category:** ux · **Final sev:** low · **Votes:** 2/3

**Description:** Lines 305-309 render `eligibility()!.blocked_countries` underneath the country input forever after the first eligibility call. If the user is in KP, gets blocked, then changes the field to KR and hits Continue, the blocked list updates — fine. But if they get blocked, then leave the page and come back via Back from rules→gate, the previous block list is still visible. Worse: when eligibility succeeds, the user is jumped to `'rules'` (line 153) without clearing `eligibility()`, so the next time they Back into gate they see the green-path country with a residual block list. Not security-critical, but signals an unprofessional UX.

**Evidence:** components/predict/VisionPredict.tsx:151-156 — no eligibility reset on Back; line 388 Back button just `setStep('gate')`.

**Fix:** On Back navigation reset relevant transient state (`setEligibility(null)` when going Back to gate).

---

### L.11 [consistency] polymarket write actions return no rp_earned -- inconsistent with every other write domain that has an RP entry
**Category:** consistency · **Final sev:** low · **Votes:** 3/3

**Description:** Every other on-chain or write action in the gateway returns `rp_earned: rpCfg.agent_<action>` (transfer.send 10852, transfer.batch 11786, staking.deposit 11103, staking.unstake 11168, staking.claim 11226, staking.withdraw 11974, staking.compound 12056, bridge.initiate 12744, nft.mint 13185). The RP defaults table (9688-9698) has explicit per-action entries. polymarket.enroll and polymarket.update_rules return no rp_earned, and there is no `agent_polymarket_enroll` / `agent_polymarket_update_rules` in RP_DEFAULTS. For a feature we want users to try, omitting an RP nudge is a missed engagement lever. More importantly it breaks the rule that any T2 write returns rp_earned.

**Evidence:** functions/index.js:9688-9698 RP_DEFAULTS does not include polymarket keys. polymarket.enroll response 17682-17692 returns enrollment_id, status, rules, strategy, wallet_address, next_step, disclaimer -- no rp_earned. Discovery 10005 advertises `response: [..., "next_step"]` with no rp_earned, mirroring the gap. Compare staking.deposit which at 11103 returns rp_earned.

**Fix:** Add `agent_polymarket_enroll: 25` and `agent_polymarket_update_rules: 5` (matching the magnitude of staking_deposit/transfer_send) to RP_DEFAULTS at 9690. In polymarket.enroll, call `rpPoints: admin.firestore.FieldValue.increment(rpCfg.agent_polymarket_enroll)` on the agent doc and return `rp_earned: rpCfg.agent_polymarket_enroll` in the response. Same for update_rules. Add `rp_earned` to the discovery `response` array for both. Decide explicitly whether pause/resume award RP (likely no).

---

### L.12 [consistency] No polymarket.audit action -- other domains expose their per-agent audit stream
**Category:** consistency · **Final sev:** low · **Votes:** 3/3

**Description:** Vision Predict writes a rich event stream to `agents/{id}/predict_events` (enroll, update_rules, pause, resume) but there is no read endpoint to expose it. The authority domain exposes authority.audit (T1) over `authority_audit`. The hosting domain exposes hosting.logs (T1) over `hosting_logs`. Without polymarket.audit, the FE cannot show users their own action history, support cannot debug, and the disclosure narrative ('you can see every change') has no API to back it.

**Evidence:** functions/index.js:12352-12380 implements authority.audit (T1, reads `authority_audit` collection). 11436-11465 implements hosting.logs (T1, reads `hosting_logs`). Polymarket writes events at 17672, 17723, 17746, 17772 but the dispatcher never reads them; no polymarket.audit/.events/.logs exists.

**Fix:** Add `polymarket.audit` (T1, free) action that reads `agents/{id}/predict_events` ordered by `at` desc with a `limit` param capped at 100, mirroring authority.audit's shape. Add to ACTION_TIER_MAP at 10489, the discovery block at 10009, and the available_actions list at 17805.

---

### L.13 [liveprobe] polymarket.enroll has NO geo/age gate, completely bypassing compliance
**Category:** security · **Final sev:** low · **Votes:** 2/3

**Description:** The polymarket.enroll handler never invokes the eligibility logic from polymarket.eligibility. It does not look at country_code, self_attest_age_18, or self_attest_not_us. A user in a fully blocked jurisdiction (US/FR/NL/etc.) can simply skip the eligibility step and call enroll directly, getting status="active" and a working authority object. Since this is the live Phase 1 endpoint that creates the persistent risk-rule config and 30-day grant the future place_bet path will consume, the entire 'geographic compliance gate' MUST-mitigate risk is currently only enforced by the FE wizard, which any API caller can ignore.

**Evidence:** functions/index.js lines 17617-17696 (polymarket.enroll handler). The only gating checks are: launchEnabled, acknowledged_disclaimer===true, ethers.isAddress(walletAddress). No call to body.country_code or self_attest_*. Empirical: POST {action:'polymarket.enroll', api_key, wallet_address:'0x...98', rules:{max_bet_usdc:10}, strategy:'preset', acknowledged_disclaimer:true} (no country_code, no self_attest) returned {success:true, status:'active', enrollment_id:'predict_probe-final-zz5_1780636964847', authority_grant_id:'authgrant_polymarket_probe-final-zz5_1780636964847'}.

**Fix:** In the enroll handler, re-run the same blocked-country / age / not-us checks before persisting. Require country_code, self_attest_age_18=true, self_attest_not_us=true (or a server-side IP geo lookup) and return 403 with the same blocked_reason strings used by polymarket.eligibility. Persist {country_code, attested_at} into the predict config for audit.

---

### L.14 [liveprobe] country_code with number 0 bypasses geo-block
**Category:** security · **Final sev:** low · **Votes:** 2/3

**Description:** String(0).toUpperCase().slice(0,2) is '0', which is truthy in the conditional `cc && POLY_BLOCKED_COUNTRIES.includes(cc)` but '0' is never in the list, so eligible=true. Any non-string country_code (numbers, arrays after String() conversion such as [1,2] -> '1,2'.slice(0,2)='1,') will silently pass.

**Evidence:** functions/index.js line 17550: `const cc = String(body.country_code || "").toUpperCase().slice(0, 2);` Test: country_code:0 -> {"eligible":true,"blocked_reason":null}. Also handled silently: country_code:'ZZ', country_code:'KOR' (slice='KO').

**Fix:** Strictly require typeof body.country_code === 'string' and length === 2 (ISO-3166-1 alpha-2). Reject 3-letter codes and non-strings with 400 'invalid country_code', not a silent allow.

---

### L.15 [liveprobe] Discovery doc lies: 'Eligibility re-checked at resume time'
**Category:** consistency · **Final sev:** low · **Votes:** 2/3

**Description:** The polymarket.resume description in the gateway discovery payload promises 'Eligibility re-checked at resume time.' The handler only verifies isPredictEnabled (the global kill switch). It does not call eligibility, look at the stored country_code/wallet_address, or honor a stale attestation. A user who paused, then moved to a blocked jurisdiction, can resume freely.

**Evidence:** functions/index.js lines 17753-17777. Resume only does: launchEnabled check, then update status='active'. Empirical: enroll without any country_code, pause, then resume -> {"success":true,"status":"active","resumed_at":...}. No geo check happens. Discovery line 10008 explicitly promises the re-check.

**Fix:** Either drop the promise from the discovery description, OR actually re-run the eligibility check at resume. Recommended: require fresh self_attest fields on resume (e.g., require self_attest_not_us:true, self_attest_age_18:true in resume body if attestation is older than 30 days).

---

### L.16 [liveprobe] polymarket.update_rules silently accepts non-object rules (null/string/missing) as no-op
**Category:** correctness · **Final sev:** low · **Votes:** 3/3

**Description:** When rules is null, missing, or a non-object string ('somestring'), the handler does `{...current.rules, ...(body.rules || {})}` which spreads to current rules unchanged, then writes back the same data and returns 200. This isn't dangerous in itself, but the discovery doc says rules is 'required' and the no-op write counts as a T2 billable action. A misbehaving client (forgot to send body.rules) will repeatedly burn 0.1 VCN for nothing AND will not be alerted.

**Evidence:** functions/index.js lines 17699-17728. Test: {action:'polymarket.update_rules', api_key:$KEY} -> success:true with full rules echo. Same for rules:null and rules:'somestring'. Discovery payload at line 10006 marks rules as 'required'.

**Fix:** Validate that body.rules is a non-null object (typeof body.rules === 'object' && body.rules !== null && !Array.isArray(body.rules)) and that at least one of the known fields is present; return 400 otherwise. Reuse normalizeRules' field whitelist.

---

### L.17 [UX] Eligibility gate bypassable — age and US-person checkboxes never actually validated
**Category:** correctness · **Final sev:** low · **Votes:** 2/3

**Description:** The client-side gate at checkEligibility() reads the createSignal accessors `age18` and `notUs` without invoking them. In Solid, the accessor itself is always a truthy function reference, so `!age18` and `!notUs` are always false. The only check that fires is `!acknowledged()`. A user can leave both the age-18 and not-US checkboxes unticked, tick only the third box, and the gate still POSTs self_attest_age_18=false / self_attest_not_us=false to the backend. The backend then treats those as 'value provided but not true' and blocks — but only because they were explicitly sent; if a user never opened those boxes the local error message is misleading and the backend's response surfaces 'Must be 18 or older' instead of the unified 'confirm all three' prompt. More importantly, this is a TOS-compliance gate (Polymarket TOS, age-of-majority attestation) and the front-end is silently letting unchecked states through validation.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/components/predict/VisionPredict.tsx line 135: `if (!age18 || !notUs || !acknowledged()) {` — `age18` and `notUs` are bare signal accessors, not calls. Lines 77-79 declared as `createSignal(false)`. Compare line 143-144 which DO call them: `self_attest_age_18: age18(), self_attest_not_us: notUs()`.

**Fix:** Change line 135 to `if (!age18() || !notUs() || !acknowledged())`. Add an ESLint rule (e.g. solid/reactivity) to catch missing invocations of signal accessors, and add a unit/integration test that submits with each box independently unchecked.

---

### L.18 [UX] Country code accepted as 1 char or silently truncated — 'KOR' typo passes through as 'KO' (not blocked)
**Category:** correctness · **Final sev:** low · **Votes:** 2/3

**Description:** Both client (input maxLength=2) and server (`.slice(0,2)`) accept whatever the user types. There is no minLength or regex validation. Real failure modes: (1) A Korean user types 'KOR' (the ISO-3 code) → sliced to 'KO' which is not in POLY_BLOCKED_COUNTRIES so eligibility returns eligible=true even though South Korea law on prediction-market gambling is unsettled. (2) A user types 'K' (1 char) → cc='K' (1 char) is falsy-as-blocked-test only by membership, passes through. (3) 'USA' → 'US' correctly blocked, but 'USX' → 'US' is blocked which is fine. The asymmetry means typos lean toward FALSE NEGATIVE blocks (lets through who should be blocked), which is the dangerous direction for a compliance gate. There is also no list-membership pre-population (e.g. a `<select>` populated from blocked_countries response or a country picker), so users invent arbitrary strings.

**Evidence:** Client: /Users/sangjaeseo/Antigravity/Vision-Chain/components/predict/VisionPredict.tsx line 297-304: `<input type="text" maxLength={2} ...>` no pattern, no min-length check before submit. Server: /Users/sangjaeseo/Antigravity/Vision-Chain/functions/index.js line 17550: `const cc = String(body.country_code || "").toUpperCase().slice(0, 2);` — slice without length or alpha-only validation. Block list at line 17492 omits 'KO' (Korean ISO-3 prefix collision).

**Fix:** Enforce `/^[A-Z]{2}$/` on both client and server; reject anything that is not exactly two ASCII letters with `Invalid country_code` instead of silently truncating. Better: replace the freeform input with a `<select>` of ISO-3166 alpha-2 codes (or at minimum a datalist of the country names so users can't type the wrong code). Also auto-prefill from a server-side IP-geolocation header (X-Country) rather than relying on `navigator.language`, which only tells you the user's UI language not their physical location.

---

### L.19 [UX] Console: edited risk rules are silently lost on navigation — no dirty-state guard
**Category:** ux · **Final sev:** low · **Votes:** 2/3

**Description:** Once enrolled, refreshConfig() seeds the shared signals (maxBet, dailyLoss, dailyCount, selectedCats, forbidden, startHour, endHour) from the server. The same signals back BOTH the wizard and the console's 'Edit risk rules' panel. If a user opens the console, raises 'Max bet' from 10 to 50 and toggles a category off, then clicks the Navbar logo or back-navigates without pressing Save, those edits live only in memory. Next mount fires refreshConfig which overwrites silently. There is no isDirty tracking, no beforeunload prompt, no visual 'unsaved changes' indicator, and the Save button is not visually elevated when the form differs from the persisted config. Compounding this: if the same user opens the wizard route while enrolled (e.g. by typing /predict in a new tab — the route always renders the same component), the component snaps to step='console' but the signals are pre-seeded from the now-stale localStorage-less in-memory copy.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/components/predict/VisionPredict.tsx lines 82-89 declare signals at module top-level scope; lines 118-125 in refreshConfig overwrite them unconditionally; lines 506-510 and 524-531 (console panel) bind the same signals as the wizard. updateRules() at line 206-219 just POSTs current signal values with no dirty check. No `onCleanup`, no `window.addEventListener('beforeunload', …)`, no comparison with a 'baseline' copy of the rules.

**Fix:** Snapshot the seeded server values into a `baselineRules` signal in refreshConfig; derive `isDirty()` by comparing each editable signal to its baseline. Disable the Save button when not dirty, show a small 'Unsaved changes' chip when dirty, and register a `beforeunload` warning while dirty. Refresh-on-mount should also bail out if isDirty (e.g. show a 'Server has newer rules, discard local edits?' confirmation).

---

### L.20 [UX] Empty-state for missing api_key under-signposted; deep-link to /agent loses return context
**Category:** ux · **Final sev:** low · **Votes:** 2/3

**Description:** When the user lands on /predict without `vcn_agent_api_key` in localStorage, the gate page still renders all checkboxes and the Continue button. The only signal that something is missing is a small amber chip that says 'You need a VisionChain agent api_key. Register an agent first →' tucked between the intro and the country input. The Continue button is disabled but the disabled reason is communicated only by opacity:0.4 (no tooltip, no aria-description, no inline message near the button). Users will tick the three boxes, click the dim button, get no feedback, and bounce. The 'Register an agent first →' link goes to /agent with no `?return=/predict` or session token, so after registering, the user must remember to come back, and on return the api_key is in localStorage but the eligibility page does not auto-advance — they re-tick the three boxes again. Additionally, `onMount` only reads localStorage once; if the user opens /agent in a sibling tab and registers there, this tab will not pick up the new key without a manual refresh.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/components/predict/VisionPredict.tsx lines 97-102 (onMount reads savedKey once); lines 288-293 (amber chip rendered only inside the gate panel, not as a top-level banner); line 333 (`disabled={loading() || !apiKey()}` with no accompanying aria-describedby).

**Fix:** Short-circuit the gate UI when !apiKey(): render a dedicated empty-state card with a single 'Register a Vision Chain agent' CTA, a 60-second explainer of why an api_key is needed, and a return URL parameter (`/agent?return=/predict`). Subscribe to the `storage` event so a key registered in another tab updates this tab automatically. Make the disabled-button reason explicit by rendering helper copy below the button: 'Register an agent to enable Continue'.

---

### L.21 [UX] Back button does not reset error state — stale validation messages persist across steps
**Category:** ux · **Final sev:** low · **Votes:** 3/3

**Description:** The Back buttons at lines 388, 421, 459 only call `setStep(...)`. They don't clear `error()` or `info()`. A user who hits 'Daily loss cap must be at least equal to single max bet.' on the rules step, clicks Back to gate, edits country code, then returns to rules — the red error banner from the previous attempt still shows even though the rules-step inputs are fine now. Same for info() carrying a stale 'Enrolled.' message after subsequent edits.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/components/predict/VisionPredict.tsx lines 388, 421, 459: `onClick={() => setStep('gate')}` (or 'rules' / 'strategy') with no `setError('')` call. Compare line 390-394 (forward Continue button) which does call `setError('')`.

**Fix:** Wrap step changes in a tiny helper `gotoStep(s)` that resets error/info and scrolls to top: `function gotoStep(s){ setError(''); setInfo(''); setStep(s); }`. Use it for every Back/Continue.

---

### L.22 [UX] Progress chips not navigable; current step lacks aria-current and screen-reader context
**Category:** a11y · **Final sev:** low · **Votes:** 2/3

**Description:** The 4-step progress indicator (lines 264-275) is rendered as inert `<div>` chips with only a visual border change for the active step. Sighted users can't click a previous step to jump back (which is unconventional but expected on multi-step wizards). Keyboard users can't tab to them. Screen-reader users hear '1. Eligibility 2. Risk Rules 3. Strategy 4. Activate' with no indication of which step is current. On a 360px viewport, the four chips remain in a single horizontal flex row and start to wrap awkwardly because the chip widths plus gaps exceed ~340px usable width.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/components/predict/VisionPredict.tsx lines 264-275: `<div class="flex items-center gap-2 mb-6 text-[11px] text-[#9b9ba0]">` with `<div class={...}>` per step — no role, no aria-current, no onClick to jump.

**Fix:** Wrap the row in `<nav aria-label='Vision Predict setup steps'>`, render each chip as `<ol><li><a aria-current={step()===id ? 'step' : undefined}>` (with the link only enabled for already-completed steps), and add `flex-wrap` plus a smaller mobile variant (e.g. '1/4 · Eligibility' on `sm:` and full labels on `md:`).

---

## INFO (10)
### I.1 [BE] Country code input is silently truncated to 2 chars and the `cc && body.country_code && !cc` branch is unreachable
**Category:** correctness · **Final sev:** info · **Votes:** 3/3

**Description:** At line 17550, country_code is normalized via `String(body.country_code||"").toUpperCase().slice(0,2)`. For input "USA" (ISO-3166-1 alpha-3), this becomes "US" — and the user is then blocked as "US" even though their intent was "USA" which happens to coincide. For "KOR" → "KO" which is not in the block list (correct outcome for Korean users, but accidental). More importantly, the branch on line 17558 — `else if (body.country_code && !cc)` — can never fire because `cc` is `"".slice(0,2) = ""` only when input is empty/falsy, in which case `body.country_code` is also falsy. So the "Invalid country_code" error path is dead code; truly invalid codes (e.g. `"ZZ"`, `"1234"`) silently pass with `eligible: true`.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/functions/index.js:17550-17560 — `const cc = String(body.country_code || "").toUpperCase().slice(0, 2); ... else if (body.country_code && !cc) { eligible = false; reason = "Invalid country_code."; }`

**Fix:** Validate against an ISO-3166 alpha-2 set (or `/^[A-Z]{2}$/.test(raw.toUpperCase()) && countryList.includes(raw.toUpperCase())`). Reject 3-letter codes explicitly with a hint, and treat unknown 2-letter codes as ineligible (fail-closed) for a TOS-driven gate.

---

### I.2 [BE] enrollment_id and authority_grant_id use Date.now() — colliding for sub-millisecond repeat enrolls and easily predictable by an attacker with agent.id
**Category:** security · **Final sev:** info · **Votes:** 2/3

**Description:** IDs are `predict_${agent.id}_${Date.now()}` and `authgrant_polymarket_${agent.id}_${Date.now()}` (lines 17643-17644). These are entirely predictable given the agent's public name and an approximate timestamp. If Phase 3 uses these IDs in any URL-bearer-or-equivalent context (callback URLs, query parameter unlock, off-chain receipt lookup), an attacker who knows the agent name can guess the authority_grant_id and probe for endpoints. Also, two enrolls in the same millisecond produce identical IDs.

**Evidence:** /Users/sangjaeseo/Antigravity/Vision-Chain/functions/index.js:17643-17644 — `const enrollmentId = `predict_${agent.id}_${Date.now()}`; const authorityGrantId = `authgrant_polymarket_${agent.id}_${Date.now()}`;`

**Fix:** Use `crypto.randomBytes(8).toString('hex')` suffix (already imported as `crypto` in this file) and keep agent.id only for human-readability: `predict_${agent.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`.

---

### I.3 [FE] useNavigate / useLocation imported and called but never used — dead code and unnecessary subscription
**Category:** correctness · **Final sev:** info · **Votes:** 2/3

**Description:** `useNavigate` and `useLocation` are imported from `@solidjs/router` and bound to `navigate` / `location` at component top, but neither variable is referenced anywhere else in the file. Beyond being dead code, `useLocation()` returns a reactive store; in some router versions this subscribes the component to URL changes for no reason. It also inflates the bundle and confuses future maintainers about whether router state matters here.

**Evidence:** components/predict/VisionPredict.tsx:2 imports them; lines 65–66: `const navigate = useNavigate(); const location = useLocation();`. No further occurrences of `navigate(` or `location.` exist in the file (verified by reading the full 583 lines).

**Fix:** Remove the import and the two assignments. If query‑string handoff is intended later (e.g. `?ref=`), wire it through `onMount` like AgentGateway does instead of leaving stub bindings.

---

### I.4 [FE] Race conditions: no in-flight guard on Enroll / Pause / Resume — double-click can double-mutate
**Category:** correctness · **Final sev:** info · **Votes:** 2/3

**Description:** All mutation handlers (`enroll`, `updateRules`, `pauseAgent`, `resumeAgent`) gate the *button* with `disabled={loading()}`, but the buttons in the console for Pause/Resume have no disabled binding at all (lines 483, 486). Even where `disabled` is set, the handler itself does not early-return on `loading() === true`, so any programmatic re-entry (keyboard double‑activate, racing onMount→refreshConfig with a clicked button, future `<form onSubmit>` wrapping) can fire two POSTs. Because Pause/Resume are idempotent it's lower harm; Enroll however is a state-creating call — a double click before the button re-renders disabled can attempt two enrollments, and the user will see whichever error wins.

**Evidence:** components/predict/VisionPredict.tsx:483 `<button onClick={pauseAgent} class="... text-xs">⏸ Pause</button>` (no `disabled`). Line 486 same for Resume. Line 461 enroll button: `disabled={loading()}` but `enroll()` itself (line 182) has no `if (loading()) return;` guard.

**Fix:** Add an `if (loading()) return;` at the top of each async mutation, and add `disabled={loading()}` to the Pause/Resume buttons. Optionally introduce a single `inFlight` signal keyed per-action to avoid global disable bleed.

---

### I.5 [consistency] polymarket.config discovery is mis-marked auth-required while it should clearly state 'enrolled agent required'
**Category:** docs · **Final sev:** info · **Votes:** 2/3

**Description:** polymarket.config returns 400 if the caller is a user (Firebase Auth) rather than an enrolled agent. The discovery just says `auth: true` like every other action, but the same string-matching constraint applies as on enroll/update_rules. Users hitting the action from a Bearer Firebase token will get a confusing 400 'requires an enrolled agent' error despite being authenticated. Other domains that require agent (not user) auth do not explicitly state it either, so this is a pre-existing convention bug, but Polymarket amplifies it because eligibility (T1, no auth gate beyond `auth: true`) and config diverge in failure mode.

**Evidence:** functions/index.js:17584-17586 returns 400 `polymarket.config requires an enrolled agent (use api_key issued by system.register)` if `agent._isUser`. Discovery at 10004 just says `auth: true`.

**Fix:** Either extend polymarket.config to gracefully return `{enrolled: false}` for Firebase-Auth users (consistent with the 'not enrolled' branch at 17589), or add a `requires_agent: true` flag (or string in `desc`) to the discovery entries for actions that require an agent-issued api_key not a user JWT. Same pattern should be considered for enroll/update_rules/pause/resume.

---

### I.6 [consistency] polymarket config stored as agents/{id}/predict/config sub-collection -- differs from hosting which stores config as a field on the agent doc itself
**Category:** consistency-but-intentional-improvement · **Final sev:** info · **Votes:** 3/3

**Description:** hosting stores its entire config as a single embedded field `agents/{id}.hosting` (11367-11369, 11419-11423). polymarket stores it as a sub-document `agents/{id}/predict/config`. The polymarket pattern is actually better: (a) avoids inflating the agent doc beyond 1MB Firestore limit as we layer more domains, (b) keeps reads cheap (we don't load the full agent on every wallet query), and (c) plays nicely with a future predict_positions sub-collection. The cost is one extra Firestore read. Flagging as 'precedent we should adopt going forward' rather than 'inconsistency to fix backward'.

**Evidence:** functions/index.js:11367-11369 hosting writes `db.collection("agents").doc(agent.id).update({ hosting: hostingConfig })`. 17646-17647 predict writes `db.collection("agents").doc(agent.id).collection("predict").doc("config")`.

**Fix:** No change required for Vision Predict. Recommend documenting the convention: 'Going forward, multi-field domain configs go into a sub-collection doc, not an embedded field on the agent doc.' Consider a future migration of hosting to `agents/{id}/hosting/config` for symmetry, behind a long-lived read fallback.

---

### I.7 [liveprobe] Idempotent state transitions are not enforced (pause-already-paused, resume-already-active)
**Category:** consistency · **Final sev:** info · **Votes:** 2/3

**Description:** pause and resume always succeed regardless of current status. Calling pause twice overwrites paused_at with the second timestamp (mutating audit trail). Resuming an already-active agent silently succeeds. This makes the predict_events audit log misleading because each idempotent call is logged as a real state change.

**Evidence:** Test: pause -> {status:paused, paused_at:T1}, pause again -> {status:paused, paused_at:T2 (overwritten)}. resume of an active agent returned {status:active, resumed_at:T}. functions/index.js lines 17730-17777 do not branch on current.status.

**Fix:** In pause: if current.status==='paused' return 200 with {status:'paused', paused_at: existing} and skip the write. In resume: same for 'active'. Optionally return a 409 'no_state_change' to signal idempotency to clients.

---

### I.8 [liveprobe] rules.allowed_categories accepts garbage entries with no string-content validation
**Category:** correctness · **Final sev:** info · **Votes:** 2/3

**Description:** normalizeRules.arr() does `v.map(String).filter(Boolean).slice(0,32)`. This (a) stringifies null to the literal 'null' (passes filter), (b) stringifies numbers to digit strings, (c) does not cap per-entry string length, (d) does not deduplicate. A 1000-char entry is stored intact. A client sending [null, 1, 'OK', 'x'.repeat(1000)] gets back ["null","1","OK","xxx...x"] — 'null' looks like a real category. This pollutes the agent's risk-rule semantics; when Phase 3 reads `allowed_categories.includes(market.category)` the bot could try to match category 'null' or massive strings.

**Evidence:** functions/index.js line 17520: `Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 32) : []`. Test: rules.allowed_categories=[null,1,'OK','x'.repeat(1000)] -> ["null","1","OK","xxxx...(1000 chars)"]. forbidden_keywords gets the same treatment plus toLowerCase.

**Fix:** Tighten: filter to `typeof item === 'string'`, trim, slice to a sensible max (e.g., 64 chars per entry), drop empty / 'null' / 'undefined' literals, and dedupe. Optionally validate against a known category whitelist (Politics, Crypto, Sports, etc.).

---

### I.9 [liveprobe] max_bet_usdc parses scientific-notation strings; weird error message
**Category:** ux · **Final sev:** info · **Votes:** 2/3

**Description:** normalizeRules.num uses parseFloat, so '1e9' becomes 1_000_000_000, well above the daily_loss_cap default of 50. The handler then returns {"error":"daily_loss_cap_usdc must be >= max_bet_usdc"} — confusing for a user who only set max_bet_usdc. Similarly Number.POSITIVE_INFINITY (sent as 1e308) takes the same path. With both fields huge (1e15) values are quietly clamped to (10000, 50000). The clamp ceiling is reasonable but the error message hides the upper bound and the fact that '1e9' was interpreted as a number.

**Evidence:** functions/index.js line 17638. Test rules:{max_bet_usdc:'1e9'} -> {"error":"daily_loss_cap_usdc must be >= max_bet_usdc"}. Test rules:{max_bet_usdc:1e15,daily_loss_cap_usdc:1e15,daily_bet_count:1e15} -> stored as {max_bet_usdc:10000, daily_loss_cap_usdc:50000, daily_bet_count:200}.

**Fix:** Reject non-numeric strings in max_bet_usdc with a clear 400 ('max_bet_usdc must be a number 1-10000'). Surface the clamp ceiling in the response when input exceeded it (so user knows their 1e9 became 10000). Improve the cross-field error: 'daily_loss_cap_usdc (X) must be >= max_bet_usdc (Y)'.

---

### I.10 [liveprobe] Discovery doc claims polymarket.eligibility is auth:true but it's a static read
**Category:** consistency · **Final sev:** info · **Votes:** 3/3

**Description:** Discovery payload marks polymarket.eligibility as auth:true (line 10003) and the API does enforce that. However the handler returns no agent-specific data — just static constants (POLY_BLOCKED_COUNTRIES, POLY_TOS_URL, POLY_DISCLAIMER) and the geo/age decision. Requiring registration just to learn whether your jurisdiction can use the product is a UX wart — new users must register (creating an SBT) before they can find out they're blocked.

**Evidence:** functions/index.js lines 17536-17579. Output contains no agent-specific data. Calling without api_key returns 401 {"error":"Missing api_key or Firebase auth token..."}.

**Fix:** Make polymarket.eligibility auth:false in both the dispatcher and the discovery doc. That allows the FE wizard to gate /predict before pushing the user through registration, and aligns with the public landing page UX.

---

