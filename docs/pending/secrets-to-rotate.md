# Secrets to rotate

Written 2026-10-19. The repository `jays-visionAI/visionchain` is **public**.

This branch removes the secrets below from the working tree and replaces them
with environment-variable reads or `.example` placeholders. **That does not
un-publish them.** Every value is still in git history (`git log -p`), in any
fork or clone made since, and possibly in caches and search indexes. Rewriting
history (`git filter-repo` plus a force-push) would not reach those copies, and
force-pushing `main` deploys production. So **rotating is the real fix**:
treat each value here as known to everyone, replace it, and move anything it
controls.

No values appear in this file. Addresses were derived from the keys locally;
the on-chain facts are read-only lookups made on 2026-10-19 (native balances
and nonces only; token balances were not checked unless stated).

## What you have to rotate, in order

### 1. The "TSS" / deployer key: `0x6605Acc98E5F9dE16D82885ad84a25D95C94F794` (most urgent)

| Where it was committed | Purpose there | Since |
|---|---|---|
| `services/bridge/.env.example` (`TSS_PRIVATE_KEY`, `CHALLENGER_PRIVATE_KEY`, `FINALIZER_PRIVATE_KEY`, all the same key) | bridge signer / challenger / finalizer | 2026-01-30 |
| `services/bridge/check-balances.cjs` (`TSS_KEY`) | balance check for the TSS signer | 2026-01-31 |
| `blockchain/compile-and-deploy-staking.js` (`PRIVATE_KEY` fallback; the code calls it the TSS wallet) | BridgeStaking deployer | 2026-03-03 |

The same address is labelled **"SangJae Wallet"** in
`components/admin/AdminDeFi.tsx`, used as the `jays` contact in
`scripts/check-voice-intent.mjs`, and has a genesis allocation in
`blockchain/genesis/genesis-vcn-native.json`. It looks like a personal wallet,
not a throwaway, so check every other place you use it.

What it controls today:

- **Sepolia bridge deployment: full control.** `DEFAULT_ADMIN_ROLE` on
  `SRC_INTENT_COMMITMENT` `0x26Ad…Dc0b`, `SRC_MESSAGE_INBOX` `0xd849…7641`,
  `SRC_CHALLENGE_MANAGER` `0x2855…8aD6`, `SRC_EQUALIZER` `0x6e6E…4983` and the
  Sepolia VCN token `0x0775…0d1b`; `MINTER_ROLE` on that token; `TSS_ROLE` on
  the MessageInbox. Anyone can mint Sepolia VCN or reconfigure that bridge.
  I found no path from this to live-chain value in the current code (the
  payout gate in `functions/bridgeGate.js` only accepts locks it reads on
  Vision Chain), but the Sepolia deployment should be treated as compromised.
- Testnet funds: Sepolia ≈ 0.0327 ETH (34 transactions sent), Polygon Amoy
  0.2 POL.
- Nothing on Vision Chain 3151909 (0 VCN, nonce 0, not a Clique signer), and a
  zero native balance on Ethereum, Polygon, Base, Arbitrum, Optimism, BSC and
  Base Sepolia.

To do:

1. Generate a new key. Grant it the roles above on the Sepolia contracts, then
   renounce them from `0x6605…F794`. Do this soon: anyone holding the old key
   can also revoke *your* roles first. If that happens, redeploy the Sepolia
   bridge instead.
2. Move the testnet funds, and anything else this address holds on chains not
   checked here (tokens, NFTs, other networks).
3. Replace the value wherever it is configured: `services/bridge/.env` on any
   machine running the bridge services, Firebase / Cloud Run secrets, GitHub
   Actions secrets.
4. Stop using `0x6605…F794` as a wallet, and update the privileged list in
   `components/admin/AdminDeFi.tsx` if it should no longer be privileged.

### 2. Mainnet-v1 cluster keys and keystore password: `scripts/reset-mainnet-v1.sh`

| Variable | What it is | Address / identity |
|---|---|---|
| `EXECUTOR_PK` | executor (paymaster / AI agent / faucet) for that cluster | `0x1695b3E7421B5A1b76171720Ae29782Bf2209d6F` |
| `NODE1_PK` … `NODE5_PK` | Clique signer keys | `0xB8fe232F6E9De248fDBA4964eC048144C25E4fe0`, `0xEEd8229a360E9152838df766FcF15392024896fc`, `0x255e9E306D1A151f13748976F209FEe5431612cf`, `0xCdE47F7A7C6Db5D234930DFc509F1eA413370099`, `0x0323814dF4F0D1efdA2CD0C3E65C836E1091073F` |
| `NODE1_NK` … `NODE5_NK` | devp2p node keys | the enode IDs are `NODE1_PUB` … `NODE5_PUB` in the same script |
| `PASSWORD` | geth keystore password for all five nodes | (password) |

Committed 2026-04-12. On chain: **none of these six addresses is a signer on
the live chain** (the live Clique set is nine other addresses), and all six
have 0 VCN and nonce 0 on 3151909 and on Sepolia. The script describes a
cluster that is not the live one, so nothing needs moving.

To do: if any server still runs nodes created by this script
(`/home/admin/vision-shared-sequencer/deploy/v1-mainnet`), regenerate their
keys and keystores. Their keystores are encrypted with the leaked password.
Never reuse these keys or this password. If the password is used anywhere
else, change it there too. When you run the script again, export the values;
it now refuses to start without them (see below). After rotating, update
`EXECUTOR_ADDR`, `NODE_ADDRS` and `NODE*_PUB` in the script to match.

### 3. Testnet-v3 node key and keystore password: `scripts/reset-testnet-v3.sh`

| Variable | What it is | Address |
|---|---|---|
| `NODE2_PK` | Clique signer key for node 2 | `0x00d3a8e56106AfbE8feF6482AB95940F38FB5575` |
| `NODE1_PK` | Hardhat/anvil account #0, **public by design** | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| `PASSWORD` | geth keystore password (different from the mainnet-v1 one) | (password) |

Committed 2026-03-29. `0x00d3…5575` is also the account the tracked
`docker-compose.yml` unlocks on node 1. On chain: not a live signer, 0 VCN,
nonce 0. To do: same as item 2. Regenerate any node still using these keys,
and do not reuse the password.

### 4. Android release keystore passwords: `vision-mobile-node/android/gradle.properties`

`VISION_NODE_RELEASE_STORE_PASSWORD` and `VISION_NODE_RELEASE_KEY_PASSWORD`
(alias `vision-node`), committed 2026-02-20. The keystore file itself
(`vision-node-release.keystore`) has **never** been committed (checked through
all of history), so the passwords alone cannot sign an app. To do:

1. Change the password. This keeps the signing key, so app updates still
   install:
   `keytool -storepasswd -keystore vision-mobile-node/android/app/vision-node-release.keystore`
   For a JKS keystore, also run
   `keytool -keypasswd -alias vision-node -keystore …`. For PKCS12 (the
   default since Java 9) the store password covers the key, and `-keypasswd`
   is refused.
2. Put all four `VISION_NODE_RELEASE_*` properties in
   `~/.gradle/gradle.properties`. **Until you do, release builds on this
   machine are not signed**, because there are no such entries there today.
   Debug builds are unaffected.
3. Keep a backup of the keystore somewhere other than this repo.

### 5. DeepSeek API key, in tracked build output

A DeepSeek key (`sk-…`) is inlined in `.output/public/assets/index-DYr5Ysoi.js`
and `.vinxi/build/client/assets/index-DYr5Ysoi.js`, committed 2026-03-05
(`2c6f100`). It is the client-side env fallback from
`getEnvFallbackApiKey` in `services/firebaseService.ts`, baked into the bundle
at build time. It is not in source, and **this branch does not remove it**:
it lives in build output, and untracking `.output/` and `.vinxi/` is a
separate change (see Follow-ups).

To do: revoke it at platform.deepseek.com and issue a new one. Any `VITE_*`
key is shipped to every visitor's browser, so do not set a DeepSeek key as a
`VITE_` variable for production builds. Check the GitHub Actions secrets the
production build uses.

### Already on the list elsewhere

`docs/HANDOFF.md` ("Do these first", item 3) covers every value that was in
`.env.production` / `.env.staging`, untracked in `90acd86`.

## Not secrets (checked, nothing to rotate)

- **Hardhat/anvil account #0** (`0xf39F…2266`) appears in
  `blockchain/scripts/deploy-paymaster-direct.cjs` (now an env var),
  `scripts/reset-testnet-v3.sh` (now an env var),
  `blockchain/scripts/transfer-admin.js` (left as is: a one-off script that
  signs as that public old admin) and `blockchain/scripts/replace-keys.sh`
  (left as is: the key is the search pattern the script replaces). It is
  published by Hardhat, so never fund it.
- Firebase web API keys (`AIza…`) in `config/firebase.config.ts`,
  `google-services.json` and a few scripts are public by design. Protect them
  with Firestore rules and API-key restrictions in the Google Cloud console.
- `vision-mobile-node/android/app/debug.keystore` is the standard Android
  debug keystore.
- Remaining 64-hex values in tracked files are transaction hashes, event
  topics, enode public keys, Clique extradata and library constants.

## Environment variables the edited scripts now read

| Script | Variables |
|---|---|
| `blockchain/compile-and-deploy-staking.js` | `PRIVATE_KEY` (required) |
| `blockchain/scripts/deploy-paymaster-direct.cjs` | `PRIVATE_KEY` (required) |
| `services/bridge/check-balances.cjs` | `TSS_PRIVATE_KEY` (required; read from `services/bridge/.env` like its siblings) |
| `scripts/reset-mainnet-v1.sh` | `GETH_KEYSTORE_PASSWORD`, `EXECUTOR_PK`, `NODE1_PK`…`NODE5_PK`, `NODE1_NK`…`NODE5_NK` (all required; checked before anything is stopped or wiped) |
| `scripts/reset-testnet-v3.sh` | `GETH_KEYSTORE_PASSWORD`, `NODE1_PK`, `NODE2_PK` (required) |
| Android release build | `VISION_NODE_RELEASE_STORE_FILE`, `_KEY_ALIAS`, `_STORE_PASSWORD`, `_KEY_PASSWORD` in `~/.gradle/gradle.properties` |
| `services/schedulerRunner.ts` | `VCN_EXECUTOR_PK` (was `VITE_EXECUTOR_PK`, still accepted as a fallback, with a warning) |

## Follow-ups

- Untrack `.output/` and `.vinxi/`. They are build output, and they still carry
  the DeepSeek key above plus whatever else old builds inlined.
- `scripts/check-staking-status.cjs` and `services/bridge/check-all-balances.cjs`
  still point at `0x746a48E3…`, which has no code. They were outside this
  change.
