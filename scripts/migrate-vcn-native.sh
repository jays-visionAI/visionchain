#!/bin/bash
# Vision Chain v2 Migration Script
# VCN Native Token Edition
#
# This script migrates all 5 nodes to use VCN as native token
# 
# Usage: bash migrate-vcn-native.sh

set -e

echo "=== Vision Chain v2 Migration ==="
echo "VCN Native Token Edition"
echo ""

# Configuration
DEPLOY_DIR="/home/admin/vision-shared-sequencer/deploy/v2-testnet"
GENESIS_SOURCE="/home/admin/genesis-vcn-native.json"
BACKUP_DIR="/home/admin/backup-$(date +%Y%m%d-%H%M%S)"

# Safety check
if [ ! -f "$GENESIS_SOURCE" ]; then
    echo "ERROR: Genesis file not found at $GENESIS_SOURCE"
    exit 1
fi

echo "Step 1: Creating backup..."
mkdir -p $BACKUP_DIR
cp -r $DEPLOY_DIR $BACKUP_DIR/
echo "  Backup created at: $BACKUP_DIR"

echo ""
echo "Step 2: Stopping all Docker containers..."
cd /home/admin/vision-shared-sequencer
docker compose down || docker-compose down || echo "No docker-compose found, checking containers..."

# Stop individual containers if compose failed
docker stop vision-node-1-new vision-node-2 vision-node-3 vision-node-4 vision-node-5 2>/dev/null || true

echo ""
echo "Step 3: Updating genesis files for all nodes..."

# Update chainId to 1337 to match frontend
# Keep same alloc structure but add snapshot balances
for node in node1 node2 node3 node4 node5; do
    if [ -d "$DEPLOY_DIR/$node" ]; then
        echo "  Updating $node genesis..."
        cp $GENESIS_SOURCE $DEPLOY_DIR/$node/genesis.json
        
        # Clear old chain data
        rm -rf $DEPLOY_DIR/$node/geth 2>/dev/null || true
        rm -rf $DEPLOY_DIR/$node/clique 2>/dev/null || true
    fi
done

# Update main genesis
cp $GENESIS_SOURCE $DEPLOY_DIR/genesis.json

echo ""
echo "Step 4: Re-initializing all nodes..."

# Initialize each node with new genesis
for node in node1 node2 node3 node4 node5; do
    if [ -d "$DEPLOY_DIR/$node" ]; then
        echo "  Initializing $node..."
        docker run --rm \
            -v $DEPLOY_DIR/$node:/data \
            ethereum/client-go:stable \
            init --datadir /data /data/genesis.json 2>&1 | tail -3
    fi
done

echo ""
echo "Step 5: Starting Docker containers..."
cd /home/admin/vision-shared-sequencer
docker compose up -d || docker-compose up -d

echo ""
echo "Step 6: Waiting for nodes to sync..."
sleep 10

echo ""
echo "Step 7: Verifying..."
CHAIN_ID=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    http://localhost:8545 | grep -o '"result":"[^"]*"' | cut -d'"' -f4)

echo "  Chain ID: $CHAIN_ID"

BLOCK=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://localhost:8545 | grep -o '"result":"[^"]*"' | cut -d'"' -f4)

echo "  Block Number: $BLOCK"

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Next steps:"
echo "1. Verify user balances on frontend"
echo "2. Redeploy smart contracts"
echo "3. Update contract addresses in frontend"
