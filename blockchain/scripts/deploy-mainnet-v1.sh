#!/bin/bash

#
# Vision Chain Mainnet Deployment Script
# Runs on the SERVER after uploading files from generate-keys.js
#
# Usage: bash /home/admin/vision-mainnet-deploy/deploy-mainnet-v1.sh
#

set -e

DEPLOY_SRC="/home/admin/vision-mainnet-deploy"
CHAIN_DIR="/home/admin/vision-shared-sequencer"
TESTNET_DIR="$CHAIN_DIR/deploy/v2-testnet"
GETH_IMAGE="ethereum/client-go:v1.13.15"

echo "=========================================================="
echo "   Vision Chain Mainnet Deployment"
echo "   Server-side script - no private keys on this server"
echo "=========================================================="
echo ""

# ─── Pre-flight Checks ───────────────────────────────────────
echo "[Pre-flight] Checking required files..."

REQUIRED_FILES=(
  "$DEPLOY_SRC/genesis.json"
  "$DEPLOY_SRC/static-nodes.json"
  "$DEPLOY_SRC/docker-compose.yml"
  "$DEPLOY_SRC/password.txt"
  "$DEPLOY_SRC/rpc-node/config.toml"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required file: $f"
    exit 1
  fi
done

for i in 1 2 3 4 5; do
  if [ ! -d "$DEPLOY_SRC/node${i}/keystore" ]; then
    echo "ERROR: Missing keystore directory: $DEPLOY_SRC/node${i}/keystore"
    exit 1
  fi
  if [ ! -f "$DEPLOY_SRC/node${i}/geth/nodekey" ]; then
    echo "ERROR: Missing nodekey: $DEPLOY_SRC/node${i}/geth/nodekey"
    exit 1
  fi
  if [ ! -f "$DEPLOY_SRC/node${i}/config.toml" ]; then
    echo "ERROR: Missing config.toml: $DEPLOY_SRC/node${i}/config.toml"
    exit 1
  fi
done

echo "  All required files present."
echo ""

# ─── Safety Check ────────────────────────────────────────────
echo "[WARNING] This will DESTROY all existing chain data."
echo "  - All blocks will be lost"
echo "  - All deployed contracts will be lost"
echo "  - All account balances will be reset"
echo ""
read -p "Type 'RESET' to proceed: " CONFIRM
if [ "$CONFIRM" != "RESET" ]; then
  echo "Aborted."
  exit 1
fi
echo ""

# ─── Step 1: Stop containers ────────────────────────────────
echo "[Step 1/8] Stopping all containers..."
cd "$CHAIN_DIR"
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
echo "  Done."
echo ""

# ─── Step 2: Clean existing chain data ──────────────────────
echo "[Step 2/8] Cleaning existing chain data..."
for i in 1 2 3 4 5; do
  NODE_DIR="$TESTNET_DIR/node${i}"
  if [ -d "$NODE_DIR" ]; then
    # Remove chain data but preserve directory structure
    rm -rf "$NODE_DIR/geth/chaindata" 2>/dev/null
    rm -rf "$NODE_DIR/geth/lightchaindata" 2>/dev/null
    rm -rf "$NODE_DIR/geth/nodes" 2>/dev/null
    rm -rf "$NODE_DIR/geth/blobpool" 2>/dev/null
    rm -f  "$NODE_DIR/geth/LOCK" 2>/dev/null
    rm -f  "$NODE_DIR/geth/transactions.rlp" 2>/dev/null
    rm -rf "$NODE_DIR/keystore" 2>/dev/null
    rm -f  "$NODE_DIR/geth/nodekey" 2>/dev/null
    rm -f  "$NODE_DIR/geth.ipc" 2>/dev/null
    echo "  Node $i: cleaned"
  fi
done
RPC_DIR="$TESTNET_DIR/rpc-node"
if [ -d "$RPC_DIR" ]; then
  rm -rf "$RPC_DIR/geth" 2>/dev/null
  rm -f  "$RPC_DIR/geth.ipc" 2>/dev/null
  echo "  RPC node: cleaned"
fi
echo ""

# ─── Step 3: Deploy keystore + nodekey files ─────────────────
echo "[Step 3/8] Deploying keystores and nodekeys..."
for i in 1 2 3 4 5; do
  NODE_DIR="$TESTNET_DIR/node${i}"
  mkdir -p "$NODE_DIR/keystore"
  mkdir -p "$NODE_DIR/geth"
  mkdir -p "$NODE_DIR/data"

  # Copy keystore files
  cp "$DEPLOY_SRC/node${i}/keystore/"* "$NODE_DIR/keystore/"
  chmod 600 "$NODE_DIR/keystore/"*

  # Copy nodekey
  cp "$DEPLOY_SRC/node${i}/geth/nodekey" "$NODE_DIR/geth/nodekey"
  chmod 600 "$NODE_DIR/geth/nodekey"

  # Copy password
  cp "$DEPLOY_SRC/password.txt" "$NODE_DIR/password.txt"
  chmod 600 "$NODE_DIR/password.txt"

  # Copy config.toml (P2P static peers - replaces deprecated static-nodes.json)
  cp "$DEPLOY_SRC/node${i}/config.toml" "$NODE_DIR/config.toml"

  echo "  Node $i: keystore + nodekey + config.toml deployed"
done
# Public RPC node: no keystore, no password, never seals
mkdir -p "$TESTNET_DIR/rpc-node"
cp "$DEPLOY_SRC/rpc-node/config.toml" "$TESTNET_DIR/rpc-node/config.toml"
echo "  RPC node: config.toml deployed"
echo ""

# ─── Step 4: Deploy genesis.json ─────────────────────────────
echo "[Step 4/8] Deploying genesis.json..."
cp "$DEPLOY_SRC/genesis.json" "$TESTNET_DIR/genesis.json"
for i in 1 2 3 4 5; do
  cp "$DEPLOY_SRC/genesis.json" "$TESTNET_DIR/node${i}/genesis.json"
done
cp "$DEPLOY_SRC/genesis.json" "$TESTNET_DIR/rpc-node/genesis.json"
echo "  Done."
echo ""

# ─── Step 5: Initialize geth for each node ──────────────────
echo "[Step 5/8] Initializing geth for each node..."
for i in 1 2 3 4 5; do
  NODE_DIR="$TESTNET_DIR/node${i}"
  echo "  Initializing Node $i..."
  docker run --rm \
    -v "$NODE_DIR:/root/.ethereum" \
    "$GETH_IMAGE" \
    init /root/.ethereum/genesis.json
done
echo "  Initializing RPC node..."
docker run --rm \
  -v "$TESTNET_DIR/rpc-node:/root/.ethereum" \
  "$GETH_IMAGE" \
  init /root/.ethereum/genesis.json
echo "  All nodes initialized."
echo ""

# ─── Step 6: Deploy static-nodes.json (for reference) ──────────
echo "[Step 6/8] Deploying static-nodes.json (reference only)..."
cp "$DEPLOY_SRC/static-nodes.json" "$TESTNET_DIR/static-nodes.json" 2>/dev/null || true
echo "  Done (note: Geth v1.13+ uses config.toml instead)."
echo ""

# ─── Step 7: Update docker-compose.yml ───────────────────────
echo "[Step 7/8] Updating docker-compose.yml..."
cp "$DEPLOY_SRC/docker-compose.yml" "$CHAIN_DIR/docker-compose.yml"
echo "  Done."
echo ""

# ─── Step 8: Start containers ────────────────────────────────
echo "[Step 8/8] Starting all containers..."
cd "$CHAIN_DIR"
docker compose up -d
echo ""

# ─── Verification ────────────────────────────────────────────
echo "=========================================================="
echo "  Waiting 30 seconds for nodes to start..."
echo "=========================================================="
sleep 30

echo ""
# Signers serve no HTTP; query them over IPC. Only the RPC node has HTTP (loopback).
ipc() {
  docker exec "vision-node-$1" geth attach --exec "$2" /root/.ethereum/geth.ipc 2>/dev/null || echo "FAIL"
}

echo "--- Peer Count (signers also see the RPC node) ---"
ALL_PEERS_OK=true
for i in 1 2 3 4 5; do
  PEERS=$(ipc "$i" net.peerCount)
  echo "  node-$i: $PEERS peers"
  if ! [ "$PEERS" -ge 4 ] 2>/dev/null; then
    ALL_PEERS_OK=false
  fi
done

echo ""
echo "--- Mining Status ---"
for i in 1 2 3 4 5; do
  echo "  node-$i: mining=$(ipc "$i" eth.mining)"
done

echo ""
echo "--- Block Height ---"
for i in 1 2 3 4 5; do
  echo "  node-$i: block $(ipc "$i" eth.blockNumber)"
done

echo ""
echo "--- Clique Signers ---"
ipc 1 "clique.getSigners().join('\\n')"

echo ""
echo "--- Public RPC node (127.0.0.1:8555, expect only eth/net/rpc/web3) ---"
for m in eth_blockNumber rpc_modules; do
  curl -s -X POST -H "Content-Type: application/json" \
    --data "{\"jsonrpc\":\"2.0\",\"method\":\"$m\",\"params\":[],\"id\":1}" \
    http://127.0.0.1:8555 || echo "FAIL"
  echo ""
done

echo ""
if [ "$ALL_PEERS_OK" = true ]; then
  echo "=========================================================="
  echo "  SUCCESS: All 5 nodes are connected and mining!"
  echo "=========================================================="
else
  echo "=========================================================="
  echo "  WARNING: Some nodes may not have full peer connections yet."
  echo "  Wait 60 more seconds and check again:"
  echo '  for i in 1 2 3 4 5; do'
  echo '    docker exec vision-node-$i geth attach --exec net.peerCount /root/.ethereum/geth.ipc'
  echo '  done'
  echo "=========================================================="
fi

echo ""
echo "--- Next Steps ---"
echo "1. Deploy contracts (VCNToken, Paymaster, BridgeStaking)"
echo "2. Restore snapshot (54 user balances)"
echo "3. Update .env files with new contract addresses"
echo "4. Register Executor key in Firebase Secrets"
