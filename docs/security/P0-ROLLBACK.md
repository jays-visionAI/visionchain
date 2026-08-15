# P0 rollback — reward ledger lock

The P0 change (commit `fa69333`) made RP server-authoritative and published a
Firestore ruleset for the first time. This is the runbook if it goes wrong.

## What was deployed, in order

1. `functions:agentGateway`, `functions:dailyRPDigest` — adds `rp.award`,
   `game.start`, the `ADMIN_ONLY_ACTIONS` gate and `rp_daily_stats`.
   Backward compatible: the old client kept working against it.
2. `functions:delete backfillRP` — public endpoint with a plaintext admin key.
3. Client (`git push origin main` → Cloudflare) — the browser stops writing
   the reward ledgers and calls `rp.award` / `game.start` instead.
4. `firestore:rules` — blocks direct client writes to the reward ledgers.

Step 4 is the only one that can break the app for users, and only for clients
still running pre-step-3 JavaScript.

## Tripwire

`rp_daily_stats/{YYYY-MM-DD}` is written daily by `dailyRPDigest`
(12:00 UTC / 21:00 KST). Check `issued` the morning after the rules deploy:

- **A drop to ~0** means a write path was missed — some award now fails
  silently. Roll back the rules (below), then find the path.
- **A drop of roughly 30–60%** is expected and is not a regression: it is the
  daily caps and the removed per-play ceilings doing their job.
- **`top1PctShare` above 0.20** means issuance is concentrated in a handful of
  accounts — investigate before raising any reward value.

Also watch browser consoles / Sentry for `[RP] award rejected` and
`[gateway] … -> 403`.

## Rolling back the rules

`docs/security/firestore.rules.pre-p0.bak` is the exact ruleset that was live
before P0, exported from the Rules REST API. To restore it:

```sh
cp docs/security/firestore.rules.pre-p0.bak firestore.rules
npx firebase-tools deploy --only firestore:rules --project visionchain-d19ed
```

This takes effect within seconds and restores the previous behaviour —
including the permissive catch-all, so it re-opens the minting hole. Treat it
as a stop-the-bleeding measure, not a resting state.

Rolling back the rules alone is safe: the new client works fine under the old
permissive rules (it just calls the server instead of writing directly).

## Rolling back further

- **Client**: `git revert fa69333` and push. The old client needs the old
  rules, so revert the rules first.
- **Functions**: `git revert fa69333` then redeploy `agentGateway`. Note this
  restores the `game.submit` endpoint that accepted a client-supplied reward
  (~43,000 RP/day for anyone with a Firebase token) and re-opens the
  unauthenticated settlement actions. Only do this with the rules rolled back
  too, and treat it as an emergency.
- `backfillRP` is deleted and intentionally not restorable; a backfill should
  be a reviewed migration script, not a live public endpoint.

## Known gaps left open (deliberate, not oversights)

- `users/{email}` cross-user writes — signup updates the *referrer's*
  document (`referralCount`) and their contacts subcollection from the new
  user's session. Closing this requires moving referral registration
  server-side. Not an RP-minting path.
- `transactions/{txId}` is `allow read, write: if true` (no auth at all),
  inherited from the previous ruleset. Blockchain sync depends on it; needs
  its own review.
- The dice double-or-nothing multiplier is disabled — it was computed in the
  browser. A win pays the round's server roll until the multiplier moves into
  `game.start`.
