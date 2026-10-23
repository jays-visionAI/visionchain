# Handoff — `main`

Written for the next engineer or agent session picking this up cold. It covers
the `main` branch only. Last updated 2026-10-24.

## State in one paragraph

`main` is **24 commits ahead of `origin/main` (`e7f87f3`, which is also what
GitHub has as of 2026-10-24) and nothing is pushed**.
- Pushing `main` deploys the frontend to production. The workflow is
  `.github/workflows/deploy-production.yml`, which deploys to Cloudflare
  Pages.
- Functions and Firestore rules deploy separately, with the Firebase CLI.
- **The repository is public.** A push also publishes this file and
  `docs/pending/`, which describe holes that stay open until the rules are
  deployed.

So the push is a release decision, taken in the order below.

On 2026-10-24 six fix branches were merged into `main`. There were no
conflicts, and every check in [Verification commands](#verification-commands)
passes on the result.

| branch | fixes |
|---|---|
| `claude/recursing-chaum-17d16b` | `agents` / `fee_reconciliation` open to any signed-in user (a pending rules patch) |
| `claude/pensive-turing-7fbf7d` | any user could make themselves an admin: admin is now a custom claim |
| `claude/peer-bookkeeping-server` | clients wrote other users' documents: referral bookkeeping moves to Cloud Functions |
| `fix/agent-gateway-enforcement` | the agent gateway did not enforce SBT-bound keys, declared scopes or fees |
| `claude/heuristic-faraday-25bc0e` | wrong chain id and addresses, a silent revert; committed keys read from the environment |
| `claude/recursing-torvalds-fa44c5` | public RPC reached admin, clique, miner and node keys (runbook: `docs/pending/rpc-lockdown.md`) |

## Do these first — in this order

0. **The behaviour changes were decided on 2026-10-24:**
   - The agent gateway ships as it is. See
     [The agent gateway did not enforce its own rules](#the-agent-gateway-did-not-enforce-its-own-rules).
     Tell integrators before step 2: agents with revoked SBTs are refused,
     29 aliases that were free become priced, and fees fail closed.
   - A shared phone at signup blocks **only the new account**. The accounts
     already holding the number are recorded in `signup_records`, not
     blocked: there is no SMS check, so blocking them would let anyone freeze
     someone else's transfers.
   - Node purchases credit referral rewards only for a real `LicenseMinted`.
   - `docs/pending/` stays as it is, and the gap between steps 3 and 4 is kept
     short.
1. **Grant the admin claims** (`docs/pending/admin-claims-deploy.md` §1–2).
   This must come before Functions, or every admin is locked out of the admin
   endpoints.
2. **Deploy Functions.** The bridge payout gate, the transfer guards, the admin
   gate, the referral ledger and the gateway enforcement are all server-side
   and inert until then:
   `cd functions && npm test && firebase deploy --only functions`.
   `adminSetAPY` and `adminFundPool` changed from `onRequest` to `onCall`, so
   the old HTTPS URLs stop existing; the admin UI already calls them as
   callables.
3. **Push `main`.** This deploys the frontend.
4. **Apply both rules patches and deploy the rules,** right after the
   frontend is live: the new `users` rules refuse writes the old frontend
   makes. See [Pending: the rules patches](#pending-the-rules-patches). Until
   this step, `transactions` stays writable by anyone and `agents` (with
   plaintext API keys) by any signed-in user, and after step 3 that is
   public knowledge. So keep the gap between 3 and 4 short.

These can run alongside 1–4 and should not wait for them:

5. **Rotate the published secrets.** Follow `docs/pending/secrets-to-rotate.md`
   (the TSS/deployer key `0x6605…F794` first), plus every value that was in
   `.env.production` / `.env.staging`. Untracking them (`90acd86`) did not
   remove them from history.
6. **Lock down the public RPC on the nine nodes:** `docs/pending/rpc-lockdown.md`.
   The reset scripts now read keys and passwords from the environment
   (`GETH_KEYSTORE_PASSWORD`, `EXECUTOR_PK`, `NODE*_PK`, `NODE*_NK`).
7. **Decide on the 40 VCN refund.** Its cause is understood and fixed (see
   below); the refund itself needs a key and is an operational call.

## Pending: the rules patches

Two patches in `docs/pending/`, written but **not applied** — editing
`firestore.rules` is refused by the agent harness as a shared-resource change.
It is not a merge conflict; it needs a human or a session with that
permission. Each patch applies on its own, and both apply in either order
with the same result.

| patch | closes |
|---|---|
| `firestore-transactions.patch` | `transactions` was `allow read, write: if true`: anyone, signed in or not, could write the Bridge work orders the relayers pay out. |
| `firestore-agents.patch` | `agents` and `fee_reconciliation` had no rule, so the catch-all let any signed-in user read and write them. See below. |

```
git apply docs/pending/firestore-transactions.patch docs/pending/firestore-agents.patch
npm i --no-save --legacy-peer-deps @firebase/rules-unit-testing
npx firebase emulators:exec --only firestore --project demo-rules \
  'node scripts/check-firestore-rules.mjs'
firebase deploy --only firestore:rules   # replaces the live ruleset wholesale
```

`scripts/check-firestore-rules.mjs` runs 37 cases against the working tree,
against each pending patch alone, and against all of them. A patch already in
the working tree is detected and skipped. Measured on 2026-10-18:

| ruleset | as intended | transactions | agents |
|---|---|---|---|
| working tree (unpatched) | 13/37 | 5/14 | 8/23 |
| + `firestore-transactions.patch` only | 22/37 | 14/14 | 8/23 |
| + `firestore-agents.patch` only | 28/37 | 5/14 | 23/23 |
| + both | **37/37** | 14/14 | 23/23 |

Unpatched, every `transactions` denial is allowed, including "anonymous creates
a Bridge work order". For `agents`, every denial except the anonymous read is
allowed. Patched, the explorer read, ordinary history writes, the
reverse-bridge receipt, the Agent Desk hide and the admin console's agent
table, count and delete all still work. Six deliberate weakenings of the
agents patch were each caught: no catch-all gate, no gate on the
`{sub=**}` catch-all alone (it matches zero segments, so it covers
`agents/{id}` itself), no subcollection rule, admin write on the fee ledger,
signed-in read of agents, and `fee_reconciliation` left out of the gate. The
script's header explains why rules get verified before deploying: `firebase
deploy --only firestore:rules` replaces the live ruleset in one shot.

### `agents` and `fee_reconciliation` were open to any signed-in user

Every agent document holds a plaintext `apiKey`, which authorises Agent
Gateway calls that move that agent's VCN, and a server-encrypted `privateKey`.
It also holds what the gateway on `fix/agent-gateway-enforcement` now enforces
on that key: `hosting.allowed_actions`, `sbtStatus`, `walletAddress` and
`status`. Any signed-in user could read all of that and rewrite it, plant an
agent with a key of their choosing, or add `authority_delegations`.
`fee_reconciliation`, that branch's ledger of uncollected fees, was open the
same way.

`firestore-agents.patch` makes `agents/{id}` and all its subcollections
admin-only (`isAdmin()`), makes `fee_reconciliation` admin-read and
client-write-never, and closes both to the catch-all. The Cloud Functions
write them through the Admin SDK and are unaffected. The exclusion is a new
`isServerOwned()` predicate beside `hasDedicatedRule()`, because adding the two
collections to `hasDedicatedRule` would edit the same line as the
`transactions` patch.

What the lockdown changes for clients. No end-user feature reads or writes
`agents` from the browser; the wallet's agent screens go through the gateway.
The only client readers are in the admin console, and they now depend on the
**email list in `isAdmin()`**, not on the `role` field that the console's
login checks:

- **Agent table** (`components/admin/users/AgentTable.tsx` →
  `getAllAgents` / `deleteAgent`, on the `AdminConsole` Firebase app). It keeps
  working for `jays@visai.io` and `sangky94@gmail.com`. Other `role: 'admin'`
  accounts, and `partner` accounts that `admin_settings/partner_menu_access`
  shows the Users menu, get a permission error instead of the agent list.
- **Dashboard agent count** (`components/admin/AdminDashboard.tsx`
  `fetchUserStats`). This one reads through the *default* Firebase app, the
  wallet session in the same browser, not the admin session. Unless that
  wallet session is one of the two admin emails, the count is denied, and
  because it shares a `try` block, the wallet total and the 24h/7d growth
  figures stop rendering too. Moving that read to `getAdminFirebaseDb()`
  fixes it.

Deploying the rules does not un-leak anything. Every agent's API key has been
readable by every signed-in user, and the gateway has no key-rotation action
(`system.delete_agent` nulls the key; nothing issues a new one). Rotating
agent keys is an operational decision for after the deploy.

## What was wrong, and where the fix lives

### The bridge paid out on a document anyone could write

Two scheduled relayers (`bridgeRelayer`, `secureBridgeRelayer`) poll the
`transactions` collection for `type == "Bridge"` and pay the document's
`value` to its `recipient` — minting on Sepolia, or sending **native VCN out
of the executor wallet**, which holds ~10M native VCN and ~4e9 VCN tokens and
owns BridgeStaking. Nothing checked the source chain, and the collection was
anonymously writable. The document that actually triggered a payout was
written by the **browser**, keyed by the commit tx hash while the server keyed
its own by the lock tx hash — two work orders for one lock.

Fix: `functions/bridgeGate.js`. Every payout reads the lock transaction on the
source chain and takes the amount and the recipient **from the chain**; the
record's own figures are ignored, because they arrive as wei from one caller,
decimal VCN from another and `"1e+21"` from a third. A claim document keyed by
the lock hash makes one lock pay exactly once, the simulate branches release
the claim, and an unreachable RPC is reported as retryable rather than as a
forgery. The client write is gone from `components/Wallet.tsx`; the gateway
writes the work order itself.

Tests: `cd functions && npm test` — 23 checks, mutation-tested.

### Both bridge entry points took the money and then failed

`handleBridge` and the gateway's `bridge.initiate` did
`permit` + `transferFrom(user → executor, amount + 1 VCN fee)` and **then**
called `commitIntent` on `0x009326c3…`, which is the BridgeStaking contract
and has no such function. The call always reverted, after the money was gone.
That is the mechanism behind the missing 40 VCN.

It cannot be fixed by correcting an address: verified on chain, nothing
implements `commitIntent`, and the lock contract `0x610178dA…` and the
frontend's own intent address `0x7F5883b2…` have no code either. So
`checkBridgeContracts` now refuses before anything moves, returning 503 with
"No VCN was taken".

### Intent-to-transfer sent "later" as "now", with the wrong amount

There are two intent paths. Typed chat goes through the assistant, which emits
a JSON action block. Voice goes through `parseVoiceIntent`, and its result
opens the send confirmation directly.

`parseVoiceIntent` had no notion of a delay, and `extractAmount` takes the
first number in the sentence, so `"30분 뒤에 jays에게 10 VCN 보내줘"` came out
as an **immediate transfer of 30 VCN** — the time value — to a recipient
string that still fuzzy-resolved to the real contact, with the confirmation
modal open. The assistant path mis-scheduled too: its unit test was a
substring check in the wrong order, and `"30 minutes"` contains an `s`, so it
scheduled 30 **seconds** out.

Fixed in `services/voiceIntentService.ts` (delay extracted first and removed
before reading the amount and recipient; `VoiceIntent.delay` added) and
`components/Wallet.tsx` (a delayed utterance goes to the chat input, where the
assistant's schedule intent handles it).

Tests: `npm run check:intent` — 18 checks, mutation-tested.

### An unresolved name reached the chain as an address

Both intent paths fall back to the raw text when a name cannot be resolved
(`resolvedAddress || intent.recipient`, and `resolveSingle`'s
`{ address: rec }`) and nothing downstream checked. `transfer.send` ran the
permit on chain and only then failed inside `transferFrom`. Now the client
refuses before signing and names what it could not resolve, and the gateway
rejects a non-address `to` before anything is signed.

### Any signed-in user could make themselves an admin

Every admin Cloud Function (adminFundPool included) treated a caller as an
admin when their own `users/{email}.role` was `"admin"`, and some also took
`isAdmin: true` or an `admins/{id}` document. The rules let the owner write any
field of that document, and the catch-all, plus `match /users/{email}/{sub=**}`
(in rules v2 `=**` also matches zero segments, so that "subcollections" rule
covered the users document itself), let any signed-in user write anyone's
users document and create `admins` documents. `sendAdminBroadcast` took the
admin's email from the request body with no token at all.

Fix: admin is the `admin` custom claim, checked in one place,
`functions/adminGate.js`, by every admin endpoint; the admin console's login
reads the claim too. `firestore.rules` stops clients granting themselves
`role` / `isAdmin` / `permissions`, stops the catch-all and the subcollection
rule writing users documents, closes `admins`, and accepts the claim in
`isAdmin()`. No client writes another user's users document any more: the
referral count, duplicate-phone flags and referral reward totals that signup
and node purchases wrote there are Cloud Functions (`completeSignup`,
`creditNodePurchaseReferral` in `functions/referralLedger.js`), which derive
each value themselves. The admin-role check mentioned in the next section is
this claim now.

**Deploy order matters** (claims → Functions → frontend → rules): see
`docs/pending/admin-claims-deploy.md`, which also lists the behaviour changes
decided on 2026-10-24 (a shared phone blocks only the new account; node
purchases credit no reward while the license contract is not deployed). Tests:
`node functions/test/adminGate.test.cjs` (19 checks),
`functions/test/referralLedger.test.cjs` (36 cases) and
`scripts/check-firestore-rules-users.mjs` (54 cases, also run with every
pending rules patch applied) under the emulator, all mutation-tested, plus
`scripts/check-referral-flows-e2e.mjs` end to end.

### Admin endpoints guarded by a published string

`adminSetAPY` and `adminFundPool` were `onRequest({ invoker: "public" })`
behind the plaintext `"vision-admin-2026"`, which was hardcoded in the admin UI
and therefore shipped in the public client bundle, and was also the server's
fallback when `ADMIN_SECRET` was unset. `adminFundPool` spends the executor
wallet. Both are now callables behind the same admin-role check the other
admin callables use.

### The agent gateway did not enforce its own rules

Branch `fix/agent-gateway-enforcement`. Found by reading `agentGateway` on
2026-10-18 against the gateway's spec rules.

- **Keys were not bound to an identity (R-GW-1).** `authenticateAgent` was a
  bare `agents.apiKey` lookup; `system.register` returned the key and minted
  the SBT afterwards, so a failed mint left a working key. Now every API-key
  call passes `agentIdentityGate.check` (`functions/agentGatewayPolicy.js`):
  the wallet must hold an unrevoked VisionAgentSBT, read from the chain and
  cached per wallet for 5 minutes. Registration mints before responding. An
  agent with no SBT gets one minted on its next call (one attempt per 2
  minutes, claimed in Firestore). Read-only on 2026-10-18: 29 SBTs issued, 7
  revoked.
- **Hosting declarations were not enforced on the key (R-GW-2).** A
  non-empty `hosting.allowed_actions` now limits the key to those actions plus
  identity and hosting management. Agents that declared nothing are
  unrestricted, explicitly. `hosting.configure` accepts gateway names and
  `domain.*` wildcards, and the `enabled_actions` name the catalog documented.
- **Fees failed open (R-GW-3).** An unreadable balance now returns 503 and a
  failed deduction 402, both before the action runs; a pricing read error no
  longer prices everything at 0. 29 legacy aliases (`nft_mint`,
  `bridge_initiate`, ...) were missing from the pricing alias table, so they
  were priced as unknown (free) and skipped the node gate;
  `transfer.scheduled` is now priced as the `transfer.conditional` it is an
  alias of.
- **Uncollected fees vanished.** The permit transfer's third transaction, and
  a deferred fee that fails after the work is done, now write to
  `fee_reconciliation` (`kind`, `action_executed`, payer, tx hashes). The
  user-mode fee can no longer be set below 1 VCN by the client.

Tests: `cd functions && npm test` — 36 more checks, mutation-tested. The
`agents` collection is still readable and writable by any signed-in user
under the catch-all rule in `firestore.rules`, which includes plaintext
`apiKey`; that is not fixed here and undercuts all of the above.

## Verification commands

| | |
|---|---|
| `cd functions && npm test` | bridge payout gate, 23 checks; agent gateway policy, 36 checks |
| `node functions/test/adminGate.test.cjs` | admin claim gate, 19 checks |
| `npm run check:intent` | voice transfer intent, 18 checks |
| `node scripts/check-firestore-rules.mjs` | `transactions` / `agents` rules under the emulator (see above): 37/37 with both patches |
| `node scripts/check-firestore-rules-users.mjs` | `users` / `admins` rules under the emulator, 54 cases, with and without the patches |
| `node functions/test/referralLedger.test.cjs` | referral ledger under the emulator, 36 cases |
| `scripts/check-referral-flows-e2e.mjs` | signup → activation → node purchase end to end (auth, firestore and functions emulators plus anvil; see its header), 27 checks |
| `cd blockchain/engine/vision-shared-sequencer && npm test` | RPC allowlist, 14 tests; the `/rpc-proxy` one needs `firebase-admin`, which the sequencer's package.json lacks, so set `NODE_PATH=../../../functions/node_modules` |
| `npx tsc --noEmit -p .` | pre-existing errors. **Compare, never expect zero** |
| `npx vite build --mode production` | must finish clean |

The tsc baseline matters and it is not a fixed number: it was 474 on 2026-10-15
and 475 on 2026-10-18 with no source change between them, and 57 on
2026-10-24 with another `node_modules` — the same 57 before and after the
merges — installing a dev
dependency moves it, because most of the errors come from
`vision-mobile-node/src/screens/*` and shift with the type graph. So measure it
twice in the same tree: stash your change, count, unstash, count. Anything
other than "same count" is yours. `components/Wallet.tsx` owns exactly one of
them, in a component prop list, and it predates this work.

## Things that will bite you

- **`npm i` in this repo hits a peer-dependency conflict.** Use
  `--legacy-peer-deps` for anything new.
- **Hardhat artifacts are tracked** (`artifacts/`, `blockchain/artifacts/`), so
  compiling dirties the working tree. `git restore` them rather than committing
  the churn. Build output under `.output/` and `.vinxi/` is tracked too and
  still contains old secrets; it is harmless now but should be untracked.
- **`git commit` commits the whole index.** A `git rm --cached` left staged
  earlier in a session will ride along into an unrelated commit — that happened
  once here and had to be rewritten.
- The repo is **public**. Treat anything committed as published.
- `services/intentParserService.ts` and `services/actionResolver.ts` are **dead
  code** — only the type is imported, no UI calls them. Their regex parser has
  the same class of bug (its error message recommends a phrasing it cannot
  parse). Delete them or wire them; do not "fix" them in place.

## Known-good on-chain facts (read-only, 2026-10-14)

Chain 3151909, `Geth/v1.13.15-stable`, Clique PoA with **9 signers**, **5.0 s**
blocks, gas 1 gwei. `scripts/propose-validators.sh` proposes two addresses that
are **not** in the live signer set, against a hardcoded host, and the cluster
scripts still say 5 nodes — they describe a cluster that is not this one.

Live contracts: VCN token `0xf8a2F49C…`, Paymaster `0x28F40F9D…`, BridgeStaking
`0x009326c3…`, VisionAgentSBT `0x52D6e11B…` ("Vision Agent Identity"/VASBT, 29
issued), and the Solvent set (vUSD `0xD0BB17B6…`, SolventReserve, LockRegistry,
LockVault, Perp, SpotDex).

Not deployed, despite being referenced in code: VCN vesting, NodeLicense,
MessageInbox, VisionBridgeSecure, IntentCommitment, MiningPool, TimeLockAgent.
Every one is a Hardhat/anvil deterministic address. `deployed-*.json` records a
second and `functions/index.js` a third address for some of them; none has
code. So **node licensing and investor vesting do not exist on chain**, which
gates anything that depends on them.
