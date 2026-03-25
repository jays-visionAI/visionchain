#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Vision Chain: Propose New Clique Signers
# Run BEFORE restarting docker compose (while Node 1 is running)
# ═══════════════════════════════════════════════════════════

HOST="46.224.221.201"
NODE1_PORT=8545

echo "=== Proposing new Clique signers from Node 1 ==="

# Node 2: 0x00d3a8e56106AfbE8feF6482AB95940F38FB5575
echo "Proposing Node 2..."
curl -s -X POST http://$HOST:$NODE1_PORT \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"clique_propose","params":["0x00d3a8e56106AfbE8feF6482AB95940F38FB5575",true],"id":1}'
echo ""

# Node 3: 0x3ee48e2Accb9B1be621ddb87A207ef59B6Ed92FB
echo "Proposing Node 3..."
curl -s -X POST http://$HOST:$NODE1_PORT \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"clique_propose","params":["0x3ee48e2Accb9B1be621ddb87A207ef59B6Ed92FB",true],"id":2}'
echo ""

# Node 4: 0x0c4907791eC700A8988F276179e6e2a8B3006f28
echo "Proposing Node 4..."
curl -s -X POST http://$HOST:$NODE1_PORT \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"clique_propose","params":["0x0c4907791eC700A8988F276179e6e2a8B3006f28",true],"id":3}'
echo ""

# Node 5: 0x691acA3C185aFd0A57CA470D5f176f0559aEef31
echo "Proposing Node 5..."
curl -s -X POST http://$HOST:$NODE1_PORT \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"clique_propose","params":["0x691acA3C185aFd0A57CA470D5f176f0559aEef31",true],"id":4}'
echo ""

echo ""
echo "=== Waiting 30s for proposals to be included in blocks ==="
sleep 30

echo "=== Checking signers ==="
curl -s -X POST http://$HOST:$NODE1_PORT \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"clique_getSigners","params":[],"id":5}' | python3 -m json.tool

echo ""
echo "=== Done! Proceed to restart docker compose ==="
