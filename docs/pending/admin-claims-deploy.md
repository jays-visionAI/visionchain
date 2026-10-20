# Pending: admin as a custom claim — deploy order

Nothing here is deployed or pushed. The change spans three things that ship
separately (a one-off script, Cloud Functions, Firestore rules) plus the
frontend, which ships on the next push of `main`. Do them in this order.

## Why the order matters

Admin used to be `users/{email}.role == "admin"` (sometimes also
`isAdmin: true`, or an `admins/{id}` document). Any signed-in user could write
those, so any account could call every admin endpoint, `adminFundPool`
included. Now the server and the admin console accept only the `admin: true`
custom claim on the caller's Firebase ID token, which only the Admin SDK can
set.

So the claims have to exist **before** the Functions that check them, or every
admin is locked out of the admin endpoints until they do.

The referral move (`claude/peer-bookkeeping-server`, on top of this; see
[the section below](#referral-bookkeeping-moved-to-the-server)) adds a second
constraint: its rules refuse the writes today's frontend makes on other users'
documents, and today's signup does not catch that refusal. So the rules go
out **after** the new frontend is live: claims → Functions → frontend → rules.

## 1. Grant the claims (before anything else)

`firebase-admin` comes from `functions/node_modules` (`cd functions && npm ci`
if it is missing). The script uses Application Default Credentials. If it
fails with `invalid_grant` / `invalid_rapt`, run
`gcloud auth application-default login` and try again.

```bash
node functions/scripts/grant-admin-claims.cjs visionchain-d19ed
```

That lists everyone the old checks treated as an admin and **changes
nothing**. For each candidate it shows where the old admin status came from
(`users.role=admin`, `users.isAdmin=true`, `admins/{uid}`, `admins/{email}`),
when the Auth account was created and last signed in, and whether it already
has the claim. It ends by printing the `--grant` command.

**Read that list before granting.** Until the rules below are deployed, any
user can write `role: "admin"` onto their own document, so a candidate may have
promoted themselves. Remove anyone you don't recognise from the printed
command, then run it:

```bash
node functions/scripts/grant-admin-claims.cjs visionchain-d19ed --grant a@x.com,b@y.com
```

Do the same for staging if you use its admin console:
`node functions/scripts/grant-admin-claims.cjs visionchain-staging --grant jays@visai.io`.
This replaces `scripts/promoteAdminStaging.cjs` and `functions/set-admin.js`,
which this branch deletes. They only set `role: "admin"`, and that no longer
grants anything.

For anyone left with `role: "admin"` who should not be an admin:
`... --revoke them@x.com`. That removes the claim, resets `role` to `"user"`,
and signs them out.

## 2. Every granted admin signs out and back in

A claim reaches the client only when the ID token refreshes, so each admin
signs out and back in on **both** the admin console and the wallet, or waits
up to an hour. The two are separate sessions, and `adminSetAPY` /
`adminFundPool` are called with the wallet session's token. The console's
role check force-refreshes its own token, and the wallet token too when it is
the same account, so a fresh console login is usually enough.

## 3. Deploy Functions

```bash
cd functions && npm test && node test/adminGate.test.cjs
npx firebase emulators:exec --only firestore --project demo-referrals \
  'node test/referralLedger.test.cjs'
firebase deploy --only functions
```

Or deploy only the functions this change touches:

```bash
firebase deploy --only functions:adminSetAPY,functions:adminFundPool,functions:sendAdminBroadcast,functions:sendActivationInvitationEmail,functions:adminEmailPreview,functions:adminEmailStats,functions:adminSendTestEmail,functions:nodeHealth,functions:adminRemoveMarketItem,functions:adminBanPublisher,functions:adminGetMarketModeration,functions:setQuantEngineConfig,functions:completeSignup,functions:creditNodePurchaseReferral
```

`functions/package.json`'s `test` script does not include the new tests yet.
The Agent Gateway branch edits that same line, so adding them here would make
the two branches conflict. Add `&& node test/adminGate.test.cjs` once both
have merged. `referralLedger.test.cjs` needs the Firestore emulator, so it
stays a separate command.

## 4. Frontend

`components/auth/AdminLogin.tsx` and `components/admin/adminRoleContext.tsx`
now read the claim. They ship on the next push of `main`, which auto-deploys.
If that push happens before step 1, admins see "Access denied" in the console
until they are granted and sign in again.

The same push ships the client half of the referral move: signup, activation
and node purchases call `completeSignup` / `creditNodePurchaseReferral`
instead of writing other users' documents. If it goes out before step 3, those
calls fail; signup and activation still complete (the call is caught), but the
referrer is not counted and duplicate phones are not flagged for those
accounts, and `completeSignup` only runs within an hour of the account being
created, so they are not recoverable by retrying later.

## 5. Verify, then deploy the rules

Only once the step 4 frontend is live. Today's frontend writes the referrer's
`referralCount` directly in `userRegister` and `activateAccountWithToken`,
with no `try`; under these rules that write is refused and signup throws
after the Auth account exists, leaving an account with no users document.
A tab still running the old bundle hits the same thing, so expect a few of
those around the switch.

```bash
npm i --no-save --legacy-peer-deps @firebase/rules-unit-testing
npx firebase emulators:exec --only firestore --project demo-rules \
  'node scripts/check-firestore-rules-users.mjs && node scripts/check-firestore-rules.mjs'
firebase deploy --only firestore:rules
```

`firebase deploy --only firestore:rules` replaces the live ruleset wholesale.
It ships whatever is in `firestore.rules` at that moment, including any
`docs/pending/*.patch` you have applied by then. The users suite also runs
against the working tree with every pending rules patch applied, which is how
it was checked that this change and those patches land in any order.

Without the referral move, rules could go out right after Functions, or even
before them (the old Functions still read `role`, and real admins still have
it). With it, they wait for the frontend.

The whole flow — the real `services/firebaseService.ts`, these rules, the
Functions and a node purchase on a local chain — can be run end to end on the
emulators with `scripts/check-referral-flows-e2e.mjs` (see its header; it
needs anvil and firebase-tools 14+).

## What changes for whom

- **Admins:** granted via step 1. Admin now means the same thing in the
  Functions, the console and the rules: claim admins can write `config/*` and
  any users document. The rules' old email allowlist (`jays@visai.io`,
  `sangky94@gmail.com`) still counts as admin in the rules as a fallback.
  Remove it once the claims are in. It sits on a line the pending
  transactions patch uses as context, so do that after the patch lands.
- **Partners:** unchanged. `role: "partner"` still comes from the users
  document, and now only an admin can set it. A partner can still create an
  invitation stub for a new address (`manualInviteUser`).
- **Users:** they can no longer set `role`, `isAdmin` or `permissions` on their
  own document (they can only keep or lower them), and can no longer write
  anyone else's users document at all. Nor `referral_configs`,
  `referral_rewards`, `signup_records` or `referral_purchase_claims`.

Endpoint behaviour changes:

- `sendAdminBroadcast` now needs `Authorization: Bearer <admin ID token>`. The
  `adminEmail` field in the body is ignored. No client in this repo calls it,
  so any script that does must send a token.
- `sendActivationInvitationEmail`, `adminEmailPreview`, `adminEmailStats`,
  `adminSendTestEmail` and `nodeHealth` no longer accept `users.isAdmin` or an
  `admins/*` document.
- `setQuantEngineConfig` looked up `users/{uid}`, but users documents are
  keyed by email. So it refused everyone except whoever had created a
  `users/{uid}` document through the catch-all. It now works for claim admins.

## Referral bookkeeping moved to the server

Branch `claude/peer-bookkeeping-server`, cut from this one. Four writes that
signup and referrals did on SOMEONE ELSE's users document from the browser,
which the rules here had kept open to any signed-in user, are now Cloud
Functions (`functions/referralLedger.js`), and the rules allow none of them:

| Was (client) | Now |
|---|---|
| `userRegister` / `activateAccountWithToken`: referrer's `referralCount` + 1 | `completeSignup`: once per account (`signup_records/{email}`), only within an hour of the Auth account's creation, referrer resolved from the referral code on the server |
| `userRegister`: `phoneDuplicateBlocked: true` on accounts sharing the phone | `completeSignup`: phone read from the caller's own stored document |
| `processReferralRewards`: referrers' `totalRewardsVCN`, amount from the browser | `creditNodePurchaseReferral`: once per tx hash (`referral_purchase_claims`); the purchase and tier come from the chain (`LicenseMinted` from the license contract), the buyer is proven by a signature from the buying wallet, the amount is the tier's price |
| `getUserData`: fills a missing `referralCode` on any email | only on the caller's own document (owner write) |

Rules also close `referral_rewards`, `signup_records` and
`referral_purchase_claims` to clients (server ledgers), and make
`referral_configs` admin-write-only, because the server now reads the reward
rates from it and anyone could write it.

Tests: `functions/test/referralLedger.test.cjs` (36 cases, Firestore emulator,
mutation-tested: 16 deliberate breaks, each caught);
`scripts/check-firestore-rules-users.mjs` (54 cases; the four bookkeeping
cases flipped to deny, ten new denials, all ten allowed by 1f1dac0's rules);
`scripts/check-referral-flows-e2e.mjs` (27 checks end to end).

**Decide before deploying — behaviour that changes:**

- **Duplicate-phone flagging starts happening.** It never ran in production:
  `userRegister` searched for the phone *before* creating the account, as a
  signed-out query on `users`, which the rules deny, so it always found
  nothing. On the server it works, so signing up with a phone number another
  account holds now blocks transfers on that account and the new one (Policy
  C, as the code describes it). There is no SMS check at signup, so anyone
  can block someone's transfers by signing up with their number, and the
  blocked user has no working way to clear it (see 8 below). To keep today's
  behaviour, drop the `phoneSharers` call in `completeSignup`. To keep only
  the new account blocked, drop the loop over `sharers`.
- **Node purchases credit no referral reward today.** `NODE_LICENSE`
  (`0xDc64a140…`) has no code on chain 3151909: a "purchase" is a call to an
  empty account, which succeeds and mints nothing. The old client credited
  10% / 2% of the list price for each one anyway. The server credits only a
  purchase with a `LicenseMinted` from that address, so nothing until the
  contract is deployed there (or its new address goes in
  `DEFAULT_NODE_LICENSE_ADDRESSES` and `contractService.ts`).
- **Invitation activation now stores the referrer's email in `referrerId`**
  when the partner code is a referral code (it stored the code, so the
  invitee never appeared in the referrer's list). Partner codes that are not
  referral codes are stored as before.
- **Pre-existing, not changed here:** activation from a signed-out browser
  fails before any of this runs. `validateActivationToken` reads
  `activation_tokens` while signed out, and the catch-all requires sign-in.
  The e2e script shows it and activates from a signed-in browser instead.

Accounts created before this have no `signup_records` entry; their node
purchase rewards go to the `referrerId` on their own document, which they can
edit. That is the old trust level, limited to accounts that predate this.

## Rollback

- Rules: `git show 8de290a:firestore.rules > /tmp/rules.prev`, put that file
  in place of `firestore.rules`, run `firebase deploy --only firestore:rules`,
  then restore the file.
- Functions: redeploy the previous source.
- Claims: harmless to leave. `--revoke` removes them.

## Deliberate deviation from "add `users` to `hasDedicatedRule`"

Both pending rules patches edit the `hasDedicatedRule` line and the catch-all
block (`firestore-transactions.patch` on `main`,
`firestore-agents.patch` on `claude/recursing-chaum-17d16b`). Changing them
here would stop those patches applying. Instead the exclusion is a new
predicate, `isClosedToCatchAllWrites` (`users`, `admins`), which
`isRewardLedger` ORs in; the catch-all already consults that one. Both patches
were checked to apply cleanly on top of this, alone and in either order, and
both suites score the same as on `main`. Fold the predicate into
`hasDedicatedRule` once the patches have landed.

## Not fixed — found while doing this

1. ~~**The cross-user writes kept for signup are still forgeable.**~~ Fixed
   on `claude/peer-bookkeeping-server`: the referral count, phone flags and
   reward totals are Cloud Functions now and the rules allow no client write
   on another user's users document. See
   [Referral bookkeeping moved to the server](#referral-bookkeeping-moved-to-the-server)
   for what changes and the two decisions it needs.
2. **Owners can still write their own `status`, `isVerified`,
   `phoneDuplicateBlocked` / `accountStatus` (self-unblock), referral counters,
   `adminSentTotal` and `walletAddress`.** Signup, activation and wallet
   creation write these from the client today. I did not check whether
   anything server-side trusts them.
3. **`publish_bans` is client-writable** through the catch-all, and the ban
   is only checked in the browser (`services/diskService.ts:1149`). A banned
   publisher can delete their own ban.
4. **`users/{email}/{subcollection}/**` is still writable by any signed-in
   user** (contacts, notifications and everything else under a user,
   including server-written ones such as `disk_files`).
5. **`getFirebaseDb()` returns the admin console's Firestore for all app
   code** whenever an admin console session exists in the same browser, so
   wallet code runs with the admin's identity. Test rules in a clean browser.
6. **The Agent Gateway's admin actions use a third admin source,
   `VCN_ADMIN_EMAILS`, in `functions/index.js`.** Not client-writable, but not
   the claim either. Consider moving it to `isAdminToken` after the gateway
   branch lands, since it edits that area.
7. **`manualInviteUser` has no `isAdmin()` check in the UI**, and
   `/adminsystem/users` has no `requiredRole`. The rules allow partners to
   create invitation stubs, matching what the console lets them do. Decide
   whether partners should.
8. **`resolvePhoneAccounts` writes to the user's other accounts are now
   denied.** The modal that calls it is effectively unreachable today:
   `getUserData` never returns the fields it checks. This matters more once
   duplicate-phone flagging actually runs (referral move above): a blocked
   user has no way in the app to clear the block.
