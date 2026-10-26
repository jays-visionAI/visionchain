# Pending: lock down the nodes' RPC — runbook

Written 2026-10-22. Nothing here is applied. You apply it by hand on the two
hosts; this branch only changes the repo's copies of the node and proxy config.

**Do not push this file to the public repo before Stage 1 is done.** It
describes a hole that is open as of writing.

- S1 = `46.224.221.201` (Germany): signers node-1..5, nginx for
  `rpc.visionchain.co` / `api.visionchain.co`, the sequencer (pm2 `vision-api`).
- S2 = `135.181.87.25` (Finland): signers node-6..9.

## What is wrong

Measured 2026-10-20 and again 2026-10-22, read-only (`rpc_modules`,
`eth_chainId`, `eth_blockNumber`, `eth_coinbase`, `clique_getSigners`,
`clique_getSnapshot`, `clique_proposals`):

| Endpoint | Modules anyone on the internet can call |
|---|---|
| `https://rpc.visionchain.co` (node-1) | admin, clique, debug, eth, miner, net, rpc, txpool, web3 |
| `https://rpc.visionchain.co/node-2` … `/node-5` | same |
| `https://rpc.visionchain.co/node-6` … `/node-9` | admin, clique, eth, miner, net, **personal**, rpc, txpool, web3 |
| `https://api.visionchain.co/rpc-proxy` (sequencer → node-1) | same as node-1, batches pass through |
| `http://46.224.221.201:3000/rpc-proxy` (sequencer, no nginx) | same; port 3000 answers from the internet |

All nine nodes are the chain's Clique signers and run with `--unlock` and
`--allow-insecure-unlock`. So anyone can, today:

- vote signers in or out (`clique_propose` on 5 of 9 nodes takes the chain);
- stop sealing (`miner_stop`), rewind a node (`debug_setHead`), stop its RPC
  (`admin_stopHTTP`), add peers of their choosing (`admin_addPeer`);
- sign with the unlocked signer keys (`eth_sendTransaction`, `eth_sign`, and
  `personal_*` on node-6..9).

Also found:

- The geth ports 8545–8549 on both hosts do **not** answer from the internet
  (firewalled), so the hole is the two HTTPS proxies and port 3000.
- `rpc.visionchain.co` returns `Access-Control-Allow-Origin` twice (nginx and
  geth both add it). Browsers reject that, which is why the web app uses
  `api.visionchain.co/rpc-proxy`.
- `ws.rpc.visionchain.co` points straight at S1 (not Cloudflare) and returns
  502. Nothing serves WebSocket today.
- geth 1.13 **ignores `static-nodes.json`** ("deprecated and ignored"; only
  `[Node.P2P] StaticNodes` in `config.toml` counts). S1's `config.toml` lists
  only the five S1 nodes, so the S1↔S2 links come from discovery or from
  `admin_addPeer`, which the `nodeHealth` Cloud Function calls through the
  public `/node-N` URLs every hour. Once admin is closed, a restarted node may
  not find the other host. Stage 2 fixes that before any restart.

## Target

```
internet ─ Cloudflare ─ nginx (S1) ─┬─ rpc.visionchain.co  → rpc-gateway :8600 ─┐
                                    └─ api…/rpc-proxy      → sequencer  :3000 ─┤  same method allowlist
                                                                               ▼
                                         rpc-node (S1, no keys, never seals, eth/net/web3,
                                                   127.0.0.1:8555 only)
                                                   │ P2P
                         node-1..5 (S1), node-6..9 (S2): no HTTP, no WS, IPC only
```

- **Signers serve no HTTP or WS.** geth (1.13.15 `cmd/geth/main.go`) exits with
  "Account unlock with HTTP access is forbidden!" when `--unlock` is combined
  with any HTTP/WS listener, unless `--allow-insecure-unlock` is set. A signer
  must stay unlocked to seal, so the only way to drop that flag is to drop HTTP.
  admin/clique/miner stay reachable over IPC from the host:
  `docker exec vision-node-1 geth attach --exec 'clique.getSigners()' /root/.ethereum/geth.ipc`.
- **Public RPC comes from `rpc-node`**, a non-signing node with no keystore,
  `--http.api eth,net,web3`, published on `127.0.0.1:8555` only.
- **Both public proxies check every JSON-RPC method** against
  `blockchain/engine/vision-shared-sequencer/rpc-allowlist.js`: the `eth_*`
  read set, filters, `eth_sendRawTransaction`, `net_version`, `net_listening`,
  `net_peerCount`, `web3_clientVersion`, `web3_sha3`, `rpc_modules`. Everything
  else gets JSON-RPC error `-32601 method not allowed` and never reaches geth.
  A batch is forwarded only if every call in it is allowed. The body that
  reaches geth is re-serialized from what was checked, so duplicate JSON keys
  can't smuggle a method past the check.
- **No `/node-N` paths** once the signers have no HTTP.

## What changed in the repo

| File | Change |
|---|---|
| `blockchain/engine/vision-shared-sequencer/rpc-allowlist.js` | new: the allowlist, batch handling, rate-limited refusal log |
| `blockchain/engine/vision-shared-sequencer/rpc-gateway.js` | new: zero-dependency proxy for `rpc.visionchain.co` (`/` and optional `/node-N`), owns CORS |
| `blockchain/engine/vision-shared-sequencer/rpc-gateway.example.json` | new: Stage 1 config (copy the upstreams from your live nginx) |
| `blockchain/engine/vision-shared-sequencer/server.js` | `/rpc-proxy` uses the allowlist; geth URL from `GETH_RPC_URL` (default unchanged); optional `HOST` |
| `blockchain/engine/vision-shared-sequencer/test/rpc-lockdown.test.js` | new: 14 tests (`npm test` there; the `/rpc-proxy` test needs the sequencer's node_modules plus `firebase-admin`) |
| `blockchain/scripts/generate-keys.js`, `blockchain/scripts/deploy-mainnet-v1.sh` | the generator of the live S1 layout: signers without HTTP, `rpc-node` service, IPC checks |
| `docker-compose.yml`, `scripts/reset-mainnet-v1.sh`, `scripts/reset-testnet-v3.sh` | same layout; reset scripts write `config.toml` instead of the ignored `static-nodes.json` |
| `scripts/import-signer.sh` | no HTTP, `clique.propose` over IPC |
| `setup_rpc_secure.sh` | RPC vhost → rpc-gateway, `location = /` only, no duplicate CORS |
| `deploy_cluster.sh` | refuses to run unless `I_UNDERSTAND_THIS_WIPES_THE_CHAIN=yes` (it overwrites the live compose and its helper deletes chain data) |
| `scripts/generate-genesis-vcn.js`, `blockchain/genesis/MIGRATION-GUIDE.md` | sample command without HTTP on the signer |

## The nine signers

No network-facts document exists on this branch, so this list is
from read-only calls on 2026-10-22 (block ≈ 3,336,300): `clique_getSigners`
returned exactly these nine, and `eth_coinbase` on each node gave the mapping.

| Node | Host | Signer | Origin |
|---|---|---|---|
| node-1 | S1 | `0x9dc230e29bbad7b690a6abd36bc999733a16e1ff` | genesis |
| node-2 | S1 | `0x43e24a2f5586c2d958d88d540a2bedca4b114dec` | genesis |
| node-3 | S1 | `0x38b490736f97101a2c6c45d1297e7cc676fb1759` | genesis |
| node-4 | S1 | `0xfa20126414873d31b217db0b7bb5ff2bcca0d707` | genesis |
| node-5 | S1 | `0x78dc3d610376f98061c999562c835c4acacef5b4` | genesis |
| node-6 | S2 | `0xc22fe6964f8917d7eaacedf8bc9730c69978c035` | voted in |
| node-7 | S2 | `0x9656fb5a210e57c6f005ebca104cacab12bc9d80` | voted in |
| node-8 | S2 | `0x0b289e511df2e7863a9b4e4160a72b56c68927c3` | voted in |
| node-9 | S2 | `0xf9e8ae4836b74edbbd541ff8d24b65f2efd76477` | voted in |

Genesis: `mainnet-deploy/genesis.json` (five signers, chain id 3151909); block 0
hash `0xf9f69e38671f82c239a5bfd5a30870e8dac53321a6587085657a0a509f1d3e2c`.

## Rules for every step

With 9 signers, a signer may seal at most one of any 5 consecutive blocks
(`floor(9/2)+1`). The chain keeps going while at least 5 signers are up **and
connected to each other**; below that it stops. So:

1. **Never more than one signer down at a time.** Restart one, check, then the next.
2. **Check between steps** (helpers below). Go on only if: the head is less
   than 15 s old, `clique.getSigners()` is the 9 above, the node you touched
   is back at the head with ≥ 8 peers, and it has sealed a block since its
   restart.
3. If a check fails, roll back that one step and stop.

Paste these helpers into the shell on each host:

```bash
# JS against a node's IPC (works without HTTP)
ipc() { docker exec "$1" geth attach --exec "$2" /root/.ethereum/geth.ipc; }

# head age, signer count, peers, and who sealed how many of the last 64 blocks
chaincheck() {
  ipc "$1" 'var h = eth.blockNumber, b = eth.getBlock(h), st = clique.status();
    JSON.stringify({head: h, ageSec: Math.floor(Date.now() / 1000) - b.timestamp,
      signers: clique.getSigners().length, peers: net.peerCount,
      inturnPct: st.inturnPercent, sealedLast64: st.sealerActivity})'
}

# last block >= FROM sealed by SIGNER, or -1
sealedsince() {  # sealedsince <container> <signer address> <from block>
  ipc "$1" "var me = '$(echo "$2" | tr 'A-F' 'a-f')', hit = -1;
    for (var n = $3; n <= eth.blockNumber; n++) {
      if (clique.getSigner(eth.getBlock(n).hash).toLowerCase() == me) { hit = n; } }
    hit"
}
```

Expected `chaincheck` today: `ageSec` < 15, `signers` 9, `peers` 8 (9 on S1
once rpc-node runs), all nine addresses in `sealedLast64` with about 7 each.

---

## Stage 0 — record and audit (read-only, both hosts)

1. Back up what you are about to change. S1's layout (compose file, service
   names `node-1..5`, data in `deploy/v2-testnet/nodeN/`, `config.toml` in each
   datadir, HTTP modules `admin,debug,clique,miner,txpool`) matches what
   `blockchain/scripts/generate-keys.js` + `deploy-mainnet-v1.sh` produce, and
   this runbook assumes it. If the `docker inspect` output below says otherwise,
   follow what it says.

   ```bash
   # S1
   sudo cp -a /etc/nginx ~/nginx-backup-$(date +%F)
   cd /home/admin/vision-shared-sequencer
   cp docker-compose.yml docker-compose.yml.bak-$(date +%F)
   cp server.js server.js.bak-$(date +%F)
   # both hosts: how every geth container is started today
   for c in $(docker ps --format '{{.Names}}' | grep -E 'vision-node|geth' | sort -V); do
     docker inspect "$c" --format '{{.Name}} {{json .Config.Cmd}} {{json .HostConfig.PortBindings}} {{json .Mounts}}'
   done > ~/rpc-lockdown-containers-$(date +%F).txt
   ```

   On S2, also find out how node-6..9 are started (a compose file? `docker run`?).
   `docker inspect <name> --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'`
   prints the compose directory if there is one.

2. See which nginx site serves `rpc.visionchain.co` and where `/node-N` go:

   ```bash
   sudo nginx -T 2>/dev/null | grep -nE 'server_name|location|proxy_pass|add_header'
   ```

3. **Signer votes** — see [Have votes already been cast?](#have-votes-already-been-cast)
   and run that check now. If it shows anything unexpected, finish Stage 1
   first (it closes the door), then deal with it.

## Stage 1 — filter the public proxies (no geth restart) — S1

This alone closes the hole from the internet. Nothing on the chain restarts.

1. Copy the files from this branch to S1 (from your machine, repo root):

   ```bash
   scp -i ./vision_key \
     blockchain/engine/vision-shared-sequencer/{rpc-allowlist.js,rpc-gateway.js,rpc-gateway.example.json,server.js} \
     admin@46.224.221.201:/home/admin/vision-shared-sequencer/
   ```

2. On S1, write the gateway config from the example. Keep `"upstream":
   "http://127.0.0.1:8545"` (node-1, as nginx does today) and make each
   `nodeRoutes` entry the same upstream your nginx uses for that `/node-N`
   (step 0.2). The example assumes S1 nodes on `127.0.0.1:8546-8549` and S2
   nodes on `135.181.87.25:8545-8548`.

   ```bash
   cd /home/admin/vision-shared-sequencer
   cp rpc-gateway.example.json rpc-gateway.json && nano rpc-gateway.json
   pm2 start rpc-gateway.js --name vision-rpc-gateway -- rpc-gateway.json && pm2 save
   ```

3. Test it locally before nginx points at it:

   ```bash
   g() { curl -s -X POST -H 'Content-Type: application/json' -d "$2" "http://127.0.0.1:8600$1"; echo; }
   g /       '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'   # result
   g /       '{"jsonrpc":"2.0","id":1,"method":"admin_nodeInfo","params":[]}'    # -32601
   g /node-6 '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'   # result
   g /node-6 '{"jsonrpc":"2.0","id":1,"method":"clique_getSigners","params":[]}' # -32601
   ```

4. nginx: in the `server { … }` block for `rpc.visionchain.co` (keep its
   `listen`/`ssl`/certbot lines), replace all `location` blocks with the ones
   below, and delete any `add_header 'Access-Control-…'` lines in that block
   (rpc-gateway answers CORS; two copies break browsers).

   ```nginx
   client_max_body_size 1m;

   location = / {
       proxy_pass http://127.0.0.1:8600;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_read_timeout 60s;
   }

   # Stage 1 only: per-node paths, same allowlist. Delete in Stage 5.
   location ~ ^/node-[2-9]$ {
       proxy_pass http://127.0.0.1:8600;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_read_timeout 60s;
   }

   location / {
       return 404;
   }
   ```

   For `ws.rpc.visionchain.co` (if it has a server block), make every location
   `return 404;`. Nothing serves WebSocket, and a future geth WS port must not be
   published through it unfiltered.

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. Restart the sequencer with the new `server.js` (it still talks to
   `127.0.0.1:8545` until Stage 3). First check S1 was running the same
   `server.js` as the repo, so you only bring in this change:

   ```bash
   diff server.js.bak-<date> server.js     # only the rpc-proxy / GETH_RPC_URL / HOST hunks
   pm2 restart vision-api && pm2 logs vision-api --lines 20 --nostream
   ```

6. Run the [verification list](#verification-from-outside) from your own
   machine (the "after Stage 1" column).

7. Watch for legitimate callers that now get refused, for a day:

   ```bash
   pm2 logs vision-rpc-gateway --lines 100 --nostream | grep refused
   pm2 logs vision-api --lines 300 --nostream | grep refused
   ```

   Expected refusals: `admin_addPeer` (Cloud Function `nodeHealth`),
   `clique_getSigners` (admin dashboard). See [Callers](#callers-that-change).

**Rollback Stage 1:** copy the site file you edited back from
`~/nginx-backup-<date>/sites-available/` and `sudo nginx -t && sudo systemctl reload nginx`;
`pm2 delete vision-rpc-gateway`; `cp server.js.bak-<date> server.js && pm2 restart vision-api`.

## Stage 2 — pin peers in config.toml (files only) — S1 and S2

Files only: a running node reads `config.toml` at start, so nothing changes
until each node's restart in Stage 4. That restart is exactly when it needs
the full peer list.

1. Collect every node's identity, on each host:

   ```bash
   for c in $(docker ps --format '{{.Names}}' | grep -E '^vision-node-' | sort -V); do
     enode=$(ipc "$c" admin.nodeInfo.enode | tr -d '"')
     ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$c")
     port=$(docker port "$c" 30303/tcp | head -1 | sed 's/.*://')
     echo "$c ${enode%%@*} docker=$ip:30303 public=$port"
   done
   ```

   (`functions/index.js` `NODE_ENDPOINTS` has the enodes as of April; the IPC
   output is the authority.)

2. Write one list per host. Peers on the **same** host by docker IP
   (`enode://<id>@172.20.0.1x:30303`), peers on the **other** host by public IP
   and published port (`enode://<id>@135.181.87.25:30303` …). On S1 the result
   looks like:

   ```toml
   [Node.P2P]
   MaxPeers = 25
   NoDiscovery = true
   StaticNodes = [
     "enode://<node-1 id>@172.20.0.11:30303",
     "enode://<node-2 id>@172.20.0.12:30303",
     "enode://<node-3 id>@172.20.0.13:30303",
     "enode://<node-4 id>@172.20.0.14:30303",
     "enode://<node-5 id>@172.20.0.15:30303",
     "enode://<node-6 id>@135.181.87.25:30303",
     "enode://<node-7 id>@135.181.87.25:30304",
     "enode://<node-8 id>@135.181.87.25:30305",
     "enode://<node-9 id>@135.181.87.25:30306"
   ]
   TrustedNodes = [ ...the same nine strings... ]
   ```

   Keep any other keys the existing file has. If an S2 node currently runs
   with discovery (no `--nodiscover`), leave `NoDiscovery` out of its file.

3. Put it in place. S1: `deploy/v2-testnet/node{1..5}/config.toml` (each
   datadir is mounted at `/root/.ethereum`). S2: each node's datadir; if S2's
   containers don't pass `--config /root/.ethereum/config.toml` yet, Stage 4
   adds it.

4. Check the file parses without touching the running node (same image,
   throwaway container):

   ```bash
   docker run --rm -v "$PWD/deploy/v2-testnet/node2/config.toml:/c.toml:ro" \
     ethereum/client-go:v1.13.15 --config /c.toml dumpconfig | grep -A3 StaticNodes
   ```

5. The P2P ports must stay open between the hosts (S1 30303–30307 tcp+udp from
   S2's IP; S2 30303–30306 from S1's IP). They are today, since cross-host
   peers exist.

## Stage 3 — the public RPC node — S1

1. Disk: `du -sh deploy/v2-testnet/node1/geth` and `df -h .`; rpc-node needs about
   as much as one signer.

2. Prepare and initialize it with the live genesis:

   ```bash
   cd /home/admin/vision-shared-sequencer
   mkdir -p deploy/v2-testnet/rpc-node
   cp deploy/v2-testnet/genesis.json deploy/v2-testnet/rpc-node/genesis.json   # the file deploy-mainnet-v1.sh installed
   sha256sum deploy/v2-testnet/rpc-node/genesis.json   # compare with mainnet-deploy/genesis.json in the repo
   cp <the S1 config.toml from Stage 2> deploy/v2-testnet/rpc-node/config.toml
   docker run --rm -v "$PWD/deploy/v2-testnet/rpc-node:/root/.ethereum" \
     ethereum/client-go:v1.13.15 init /root/.ethereum/genesis.json
   ```

3. Add the service to the live `docker-compose.yml` (next to the signers; same
   `vision-net` network):

   ```yaml
     rpc-node:
       image: ethereum/client-go:v1.13.15
       container_name: vision-rpc-node
       restart: unless-stopped
       networks:
         vision-net:
           ipv4_address: 172.20.0.31
       ports:
         - "127.0.0.1:8555:8545"
       volumes:
         - ./deploy/v2-testnet/rpc-node:/root/.ethereum
       command: >
         --config /root/.ethereum/config.toml
         --networkid 3151909
         --http --http.addr "0.0.0.0" --http.port 8545
         --http.api "eth,net,web3"
         --http.vhosts "localhost,rpc-node"
         --nat extip:172.20.0.31
         --maxpeers 25
       deploy:
         resources:
           limits:
             memory: 2G
             cpus: "0.5"
   ```

   ```bash
   docker compose config >/dev/null && docker compose up -d --no-deps rpc-node
   ```

4. Check the genesis matches, then wait for it to sync:

   ```bash
   r() { curl -s -X POST -H 'Content-Type: application/json' -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":$2}" http://127.0.0.1:8555; echo; }
   r eth_getBlockByNumber '["0x0",false]' | grep -o '"hash":"[^"]*"'
   # must be 0xf9f69e38671f82c239a5bfd5a30870e8dac53321a6587085657a0a509f1d3e2c — if not, stop and remove it
   r rpc_modules '[]'        # {"eth","net","rpc","web3"} only
   r net_peerCount '[]'      # 0x9 once it has dialled all signers
   r eth_syncing '[]'        # false when done; compare eth_blockNumber with chaincheck vision-node-1
   ```

5. Switch the public traffic to it:

   ```bash
   # gateway: "upstream": "http://127.0.0.1:8555"
   nano rpc-gateway.json && pm2 restart vision-rpc-gateway
   # sequencer (server.js reads .env through dotenv)
   echo 'GETH_RPC_URL=http://127.0.0.1:8555' >> .env && pm2 restart vision-api
   ```

   Find anything else on S1 that still uses node-1's HTTP before Stage 4 takes
   it away: `sudo ss -tnp | grep ':8545 '` (look at the client processes, e.g.
   `vision-traffic`, cron jobs) and point them at `127.0.0.1:8555`.

6. **Send one real transaction** through `api.visionchain.co/rpc-proxy` (e.g.
   a small transfer in the wallet) and check it is mined within a few blocks.
   `functions/index.js` (comment at the RPC routing section) records that
   transactions once got stuck when the RPC endpoint was not a sealer; that was
   a peering problem, and rpc-node with 9 static peers should not have it.
   If a transaction sits in rpc-node's pool, check `r net_peerCount '[]'`.

**Rollback Stage 3:** `"upstream": "http://127.0.0.1:8545"` + `pm2 restart vision-rpc-gateway`;
remove the `GETH_RPC_URL` line from `.env` + `pm2 restart vision-api`;
`docker compose stop rpc-node`.

## Stage 4 — signers without HTTP, one at a time — S1, then S2

Order: node-2, node-3, node-4, node-5, node-1 (S1), then node-6, 7, 8, 9 (S2).

0. Once, before the first node: set `"nodeRoutes": {}` in `rpc-gateway.json` and
   `pm2 restart vision-rpc-gateway` (the per-node paths go away with the
   signers' HTTP; the gateway answers 404 for them).

For each node N:

1. Pick a reference node that is not N: `REF=vision-node-1` (`vision-node-2`
   when N is 1; an S2 container on S2, names as `docker ps` shows them).
   `chaincheck $REF` — all green per the rules above.

2. Edit **only node-N's** service in the live compose file:
   - delete the RPC port line (`- "854x:8545"`); keep the P2P lines;
   - in `command:` delete every `--http…`, `--ws…`, `--graphql` and
     `--allow-insecure-unlock`;
   - keep `--unlock`, `--password`, `--mine`, `--miner.etherbase`, `--nat`,
     `--maxpeers`, `--nodiscover`; make sure `--config /root/.ethereum/config.toml` is there;
   - if it has a `healthcheck` that curls `localhost:8545`, change it to
     `test: ["CMD", "geth", "attach", "--exec", "eth.blockNumber", "/root/.ethereum/geth.ipc"]`.

   For S1 the result looks like (node-2):

   ```yaml
       ports:
         - "30304:30303"
         - "30304:30303/udp"
       volumes:
         - ./deploy/v2-testnet/node2:/root/.ethereum
       command: >
         --config /root/.ethereum/config.toml
         --networkid 3151909
         --unlock "0x43e24a2f5586c2d958d88d540a2bedca4b114dec"
         --password /root/.ethereum/password.txt
         --mine --miner.etherbase "0x43e24a2f5586c2d958d88d540a2bedca4b114dec"
         --nat extip:172.20.0.12
         --maxpeers 25
   ```

   If S2 uses `docker run` instead of compose, recreate the container with the
   arguments saved in Stage 0 minus the same flags and port.

3. Restart just that node and check it:

   ```bash
   H=$(ipc $REF eth.blockNumber)
   docker compose up -d --no-deps node-N
   sleep 20
   docker logs --tail 30 vision-node-N             # no "Account unlock with HTTP access is forbidden!"
   ipc vision-node-N 'JSON.stringify({head: eth.blockNumber, peers: admin.peers.length, mining: eth.mining})'
   sealedsince $REF <node-N signer> "$H"           # repeat until it prints a block number (≤ ~2 min)
   chaincheck $REF
   ```

   - "Account unlock with HTTP access is forbidden!" means an `--http`/`--ws`
     flag is still there; geth exits. Fix the command and `up` again.
   - Fewer than 8 peers: its `config.toml` is wrong or not loaded. You can
     unblock it live with `ipc vision-node-N "admin.addTrustedPeer('enode://…')"`
     for each missing peer, then fix the file.
   - Not sealing within ~3 minutes, or `chaincheck` not green: roll back this
     node (put its old service block back from `docker-compose.yml.bak-<date>`,
     `docker compose up -d --no-deps node-N`) and stop.

4. Next node.

After node-9: S2's 8545–8548 have nothing behind them; remove those ports
from S2's firewall rules too.

## Stage 5 — clean up and verify

1. nginx: delete the `location ~ ^/node-[2-9]$` block, `sudo nginx -t && sudo systemctl reload nginx`.
2. Drop the stale local proposals on node-1..5 (see below) — over IPC:

   ```bash
   for n in 1 2 3 4 5; do for a in 0xc22fe6964f8917d7eaacedf8bc9730c69978c035 0x9656fb5a210e57c6f005ebca104cacab12bc9d80 \
       0x0b289e511df2e7863a9b4e4160a72b56c68927c3 0xf9e8ae4836b74edbbd541ff8d24b65f2efd76477; do
     ipc vision-node-$n "clique.discard('$a')"; done; ipc vision-node-$n 'JSON.stringify(clique.proposals)'; done
   ```

3. On S1: `sudo ss -ltnp | grep -E ':(854[5-9]|8555|8600) '` shows only
   `127.0.0.1:8555` (docker-proxy for rpc-node) and `127.0.0.1:8600` (gateway).
4. Optional: keep port 3000 off the internet with `HOST=127.0.0.1` in the
   sequencer's `.env` (`pm2 restart vision-api`). Check first that
   nothing calls `http://46.224.221.201:3000` directly (the traffic generator's
   `.env.example` does).
5. Run the full [verification list](#verification-from-outside).

---

## Have votes already been cast?

Anyone could call `clique_propose` on any signer, so assume votes may have
been cast and check.

How Clique voting works: each signer keeps a local list of **proposals**
(`clique.proposals`). Every block it seals carries one of them as a **vote**
(header `miner` = the address, `nonce` = `0xffffffffffffffff` to add,
`0x0000000000000000` to drop; a block without a vote has `miner` = 0x0). A vote
**passes** when more than half of the current signers (5 of 9) have voted the
same way. All pending votes are cleared at each epoch checkpoint (every 30000
blocks, about 41.7 hours). `clique.getSnapshot()` shows the votes counted so
far in this epoch (`votes`) and per-address totals (`tally`).

Run on each host, for each signer, over IPC:

```bash
for c in $(docker ps --format '{{.Names}}' | grep -E '^vision-node-' | sort -V); do
  echo "== $c"
  ipc "$c" 'var s = clique.getSnapshot();
    JSON.stringify({signers: clique.getSigners(), proposals: clique.proposals,
      snapshot: {number: s.number, votes: s.votes, tally: s.tally}})'
done
```

What it showed on 2026-10-22 through the then-public endpoints (block ≈ 3,336,313):

- `signers`: the nine in [the table](#the-nine-signers), on every node.
- `snapshot.votes` `[]` and `tally` `{}` on every node: no vote in flight.
- `proposals` on **node-1..5**: the four S2 signers (node-6..9), all `true`.
  These are leftovers from when S2 was voted in. They are inert: a signer
  never casts a vote to add an address that is already a signer. But if one of
  those four is ever dropped on purpose, nodes 1–5 would immediately vote it
  back in, so Stage 5 discards them. `proposals` on node-6..9: `{}`.
- Header scan (read-only `eth_getBlockByNumber`, node-1's view): all 36,549
  blocks from 3,300,000 (an epoch checkpoint, 2026-10-20 09:31 UTC) to
  3,336,548 (2026-10-22 ≈ 12:15 UTC) have `miner` = 0x0 and `nonce` = 0: **no
  vote was cast in that window.** Votes from before 3,300,000 were cleared at
  that checkpoint, and the signer set shows none of them changed who signs.
  Re-run the check on the hosts: this was the state on 2026-10-22, not after.

How to read your result:

- **An address in `getSigners()` that is not in the table:** someone voted in a
  signer. Treat it as an incident: run `clique.propose('<addr>', false)` on all
  honest signers (it needs 5 votes), and don't run Stage 4 until it is gone.
- **One of the nine missing:** it was voted out; re-add with
  `clique.propose('<addr>', true)` on the others.
- **A proposal you don't recognise on some node:** `ipc <node> "clique.discard('<addr>')"`
  on that node. Do this right after Stage 1 (before it, it can be re-added).
- **Votes in `snapshot.votes`:** shows who voted for what in this epoch. Each
  voter keeps voting until you discard the proposal on that node; the count
  resets at the next checkpoint (`number` rounded up to a multiple of 30000).

To scan headers for votes yourself (current epoch; widen `from` as needed):

```bash
ipc vision-node-1 'var h = eth.blockNumber, from = h - (h % 30000), out = [];
  for (var n = from; n <= h; n++) { var b = eth.getBlock(n);
    if (b.miner != "0x0000000000000000000000000000000000000000") out.push([n, b.miner, b.nonce]); }
  JSON.stringify({from: from, to: h, votes: out})'
```

## Callers that change

From `git grep 'rpc.visionchain.co/node-'` and the RPC method names in the code:

| Caller | Calls | After Stage 1 | After Stage 4 | What it needs |
|---|---|---|---|---|
| `functions/index.js` `getNodeStatuses` (`nodeHealth` GET, hourly `scheduledNodeHealthCheck`) | `eth_blockNumber`, `net_peerCount`, `eth_mining` on `/` and `/node-2..9` | works (all three allowed) | `/node-2..9` 404 → nodes 2–9 show offline; the `node-1` row is rpc-node (`mining: false`) | per-signer health without per-node HTTP: e.g. who sealed recent blocks (`clique_getSigner` logic over `eth_getBlockByNumber`), or a host-side IPC exporter — follow-up |
| `functions/index.js` `forceSyncNodes` (`nodeHealth` POST `force_sync`, and the hourly check when peers are low) | `admin_addPeer` on every node through the public URLs | refused, returns 0 added; harmless | same | nothing; Stage 2 makes peering static. Delete the function in a follow-up |
| `components/admin/AdminDashboard.tsx` `fetchValidatorNodes` | `clique_getSigners` via `api.visionchain.co/rpc-proxy` | refused → "authority" shows 0 | same (rpc-node has no clique) | the signer count from somewhere else (e.g. last checkpoint header's extraData) — follow-up |
| `functions/index.js` `RPC_URL`, oracle, relayer (`contract.on` → filters), traffic generator | `eth_*`, filters, `eth_sendRawTransaction` | works | works via rpc-node | — |
| `scripts/node-health-check.cjs` | `clique_getSigners`, `clique_getSnapshot` via rpc-proxy | refused | refused | run its checks on a host over IPC |
| `scripts/node-health-monitor.cjs`, `propose-validators.sh`, `verify-validators.sh` | admin/clique on `46.224.221.201:854x` | already unreachable from outside | no HTTP at all | IPC on the host (`ipc` helper) |
| vision-node apps (`wss://ws.rpc.visionchain.co`) | WebSocket | already 502 | — | a WS endpoint would need its own frame filter |
| `docs/Vision_Chain_Technical_Whitepaper.md` lines ~110 and ~193 | names `/node-8`, `/node-9` as alternate RPC; describes the old flags | — | stale | update after the rollout |

## Verification from outside

From any machine that is not S1 or S2. **Negative tests use read-only methods
only** (never `miner_stop`, `eth_sendTransaction`, `clique_propose` — if a
filter were broken they would do damage).

```bash
RPC=https://rpc.visionchain.co; API=https://api.visionchain.co/rpc-proxy; DIRECT=http://46.224.221.201:3000/rpc-proxy
j() { curl -s -m 10 -X POST -H 'Content-Type: application/json' -d "$2" "$1"; echo; }
for U in $RPC $API $DIRECT; do
  echo "== $U"
  j $U '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
  j $U '{"jsonrpc":"2.0","id":1,"method":"rpc_modules","params":[]}'
  j $U '{"jsonrpc":"2.0","id":1,"method":"admin_nodeInfo","params":[]}'
  j $U '{"jsonrpc":"2.0","id":1,"method":"clique_getSigners","params":[]}'
  j $U '{"jsonrpc":"2.0","id":1,"method":"personal_listAccounts","params":[]}'
  j $U '{"jsonrpc":"2.0","id":1,"method":"eth_accounts","params":[]}'
  j $U '{"jsonrpc":"2.0","id":1,"method":"txpool_status","params":[]}'
  j $U '[{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]},{"jsonrpc":"2.0","id":2,"method":"admin_nodeInfo","params":[]}]'
done
j $RPC/node-6 '{"jsonrpc":"2.0","id":1,"method":"admin_nodeInfo","params":[]}'
curl -s -m 10 -D - -o /dev/null -X POST -H 'Origin: https://example.com' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' $RPC | grep -ci '^access-control-allow-origin'
for hp in 46.224.221.201:854{5,6,7,8,9} 135.181.87.25:854{5,6,7,8}; do
  curl -s -m 5 -o /dev/null -w "$hp %{http_code}\n" -X POST http://$hp || echo "$hp no answer"
done
```

| Check | Now (2026-10-22) | After Stage 1 | After Stage 4 |
|---|---|---|---|
| `eth_chainId` | `0x301825` | `0x301825` | `0x301825` |
| `rpc_modules` | admin, clique, debug, miner, txpool, … | unchanged (it is the node's own view; calls are filtered) | `{"eth","net","rpc","web3"}` only |
| `admin_nodeInfo`, `clique_getSigners`, `personal_listAccounts`, `eth_accounts`, `txpool_status` | answered | error `-32601 method not allowed: …` | same |
| batch with `admin_nodeInfo` | both answered | both entries are errors, nothing forwarded | same |
| `/node-6` `admin_nodeInfo` | answered | `-32601` | HTTP 404 |
| `$DIRECT` (port 3000) | answered, unfiltered | filtered like `$API` | no answer once `HOST=127.0.0.1` (Stage 5.4) |
| `Access-Control-Allow-Origin` count on `$RPC` | 2 | 1 | 1 |
| direct `:854x` on both hosts | no answer | no answer | no answer (nothing listening) |

On the hosts after Stage 4, IPC still works and HTTP is gone:
`ipc vision-node-1 'admin.nodeInfo.name'` answers;
`docker exec vision-node-1 wget -qO- http://127.0.0.1:8545` fails (connection refused).

## Not in this change

- **Kafka `9092` and Zookeeper `2181` on S1 answer from the internet.** Anyone
  can produce into `shared-sequencer-input` or read it. Firewall them to S1
  (and whoever legitimately produces).
- Sequencer port 3000 also serves unauthenticated `/api/transactions/index`
  (writes Firestore) and `/rpc/paymaster/transfer`. `HOST=127.0.0.1` (Stage 5.4)
  plus nginx route review would cover it.
- `firebase-admin` is required by `server.js` but missing from the sequencer's
  `package.json`; it only works on S1 because it is installed there some other way.
- If WebSocket RPC is wanted later: `--ws --ws.api eth,net,web3` on rpc-node
  only, and a frame-level filter in front; never on a signer.
