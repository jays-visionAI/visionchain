#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Vision Chain: Verify All 5 Validators Are Sealing
# Run AFTER docker compose restart
# ═══════════════════════════════════════════════════════════

HOST="46.224.221.201"

echo "=== Checking all 5 nodes ==="
for PORT in 8545 8546 8547 8548 8549; do
  BLOCK=$(curl -s -X POST http://$HOST:$PORT -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>/dev/null | \
    python3 -c "import sys,json; print(int(json.load(sys.stdin)['result'],16))" 2>/dev/null)

  SYNC=$(curl -s -X POST http://$HOST:$PORT -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['result'])" 2>/dev/null)

  MINE=$(curl -s -X POST http://$HOST:$PORT -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_mining","params":[],"id":1}' 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['result'])" 2>/dev/null)

  PEERS=$(curl -s -X POST http://$HOST:$PORT -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' 2>/dev/null | \
    python3 -c "import sys,json; print(int(json.load(sys.stdin)['result'],16))" 2>/dev/null)

  STATUS="OK"
  [ "$MINE" != "True" ] && STATUS="NOT MINING"
  [ "$SYNC" != "False" ] && STATUS="SYNCING"

  echo "Node :$PORT | Block: $BLOCK | Mining: $MINE | Peers: $PEERS | $STATUS"
done

echo ""
echo "=== Clique Signers ==="
curl -s -X POST http://$HOST:8545 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"clique_getSigners","params":[],"id":1}' | python3 -m json.tool

echo ""
echo "=== Clique Status (last 64 blocks) ==="
curl -s -X POST http://$HOST:8545 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"clique_status","params":[],"id":1}' | python3 -m json.tool

echo ""
echo "=== Block Production (last 5 blocks - check miner rotation) ==="
LATEST=$(curl -s -X POST http://$HOST:8545 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | \
  python3 -c "import sys,json; print(int(json.load(sys.stdin)['result'],16))")

for i in 0 1 2 3 4; do
  BN=$((LATEST - i))
  BN_HEX=$(printf "0x%x" $BN)
  MINER=$(curl -s -X POST http://$HOST:8545 -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBlockByNumber\",\"params\":[\"$BN_HEX\",false],\"id\":1}" | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['result']['miner'])" 2>/dev/null)
  echo "  Block $BN -> Miner: $MINER"
done
