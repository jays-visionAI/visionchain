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
firebase deploy --only functions
```

Or deploy only the functions this change touches:

```bash
firebase deploy --only functions:adminSetAPY,functions:adminFundPool,functions:sendAdminBroadcast,functions:sendActivationInvitationEmail,functions:adminEmailPreview,functions:adminEmailStats,functions:adminSendTestEmail,functions:nodeHealth,functions:adminRemoveMarketItem,functions:adminBanPublisher,functions:adminGetMarketModeration,functions:setQuantEngineConfig
```

`functions/package.json`'s `test` script does not include the new test yet.
The Agent Gateway branch edits that same line, so adding it here would make
the two branches conflict. Add `&& node test/adminGate.test.cjs` once both
have merged.

## 4. Verify, then deploy the rules

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

Rules can go out right after Functions. Deploying them before Functions would
not break anything either, since the old Functions still read `role` and real
admins still have it. But Functions-first closes the fund-moving hole sooner.

## 5. Frontend

`components/auth/AdminLogin.tsx` and `components/admin/adminRoleContext.tsx`
now read the claim. They ship on the next push of `main`, which auto-deploys.
If that push happens before step 1, admins see "Access denied" in the console
until they are granted and sign in again. Nothing else breaks.

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
  anyone else's document except for the four narrow bookkeeping writes signup
  and referrals do today.

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

1. **The cross-user writes kept for signup are still forgeable.** Any
   signed-in user can add 1 to anyone's `referralCount`, raise anyone's
   `totalRewardsVCN` / `totalRewardsUSD`, set anyone's
   `phoneDuplicateBlocked: true` (a transfer block, so a griefing tool), and
   fill in a missing `referralCode`. Each is limited to its keys and
   direction, and none can touch a privilege key. They belong in a callable
   (`userRegister`, `activateAccountWithToken`, `processReferralRewards`).
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
   `getUserData` never returns the fields it checks.
