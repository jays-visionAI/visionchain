#!/bin/bash
# Vision Chain v2 Migration Script (Docker Version)
# VCN Native Token Edition
#
# Run with sudo or as root
# Usage: sudo bash migrate-vcn-docker.sh

set -e

echo "=== Vision Chain v2 Migration (Docker) ==="
echo "VCN Native Token Edition"
echo ""

# Configuration  
COMPOSE_DIR="/home/admin/vision-shared-sequencer"
DEPLOY_DIR="$COMPOSE_DIR/deploy/v2-testnet"
GENESIS_SOURCE="/home/admin/genesis-vcn-native.json"
NEW_CHAIN_ID=1337

# Safety check
if [ ! -f "$GENESIS_SOURCE" ]; then
    echo "ERROR: Genesis file not found at $GENESIS_SOURCE"
    exit 1
fi

echo "Step 1: Stopping all Docker containers..."
cd $COMPOSE_DIR
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true

# Also stop any stray containers
docker stop vision-node-1-new vision-node-1 vision-node-2 vision-node-3 vision-node-4 vision-node-5 2>/dev/null || true

echo "  Containers stopped."

echo ""
echo "Step 2: Backing up genesis files..."
mkdir -p /home/admin/backup-genesis-$(date +%Y%m%d)
cp $DEPLOY_DIR/genesis.json /home/admin/backup-genesis-$(date +%Y%m%d)/ 2>/dev/null || true
echo "  Backup created."

echo ""
echo "Step 3: Updating genesis files for all nodes..."
for node in node1 node2 node3 node4 node5; do
    if [ -d "$DEPLOY_DIR/$node" ]; then
        echo "  Updating $node..."
        cp $GENESIS_SOURCE $DEPLOY_DIR/$node/genesis.json
        
        # Clear old chain data (requires root)
        rm -rf $DEPLOY_DIR/$node/geth 2>/dev/null || true
        rm -rf $DEPLOY_DIR/$node/clique 2>/dev/null || true
        rm -rf $DEPLOY_DIR/$node/keystore 2>/dev/null || true
    fi
done

# Update main genesis
cp $GENESIS_SOURCE $DEPLOY_DIR/genesis.json
echo "  Genesis files updated."

echo ""
echo "Step 4: Updating docker-compose.yml networkid..."
sed -i "s/--networkid 3151909/--networkid $NEW_CHAIN_ID/g" $COMPOSE_DIR/docker-compose.yml
echo "  NetworkId updated to $NEW_CHAIN_ID"

echo ""
echo "Step 5: Re-initializing all nodes with new genesis..."
for node in node1 node2 node3 node4 node5; do
    if [ -d "$DEPLOY_DIR/$node" ]; then
        echo "  Initializing $node..."
        docker run --rm \
            -v $DEPLOY_DIR/$node:/root/.ethereum \
            ethereum/client-go:v1.13.15 \
            init /root/.ethereum/genesis.json 2>&1 | tail -1
    fi
done

echo ""
echo "Step 6: Starting Docker containers..."
cd $COMPOSE_DIR
docker compose up -d 2>/dev/null || docker-compose up -d

echo ""
echo "Step 7: Waiting for nodes to start (15 seconds)..."
sleep 15

echo ""
echo "Step 8: Verifying..."
CHAIN_ID=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    http://localhost:8545 2>/dev/null | grep -o '"result":"[^"]*"' | cut -d'"' -f4 || echo "Error")

if [ "$CHAIN_ID" = "0x539" ]; then
    echo "  Chain ID: $CHAIN_ID (1337) - SUCCESS!"
else
    echo "  Chain ID: $CHAIN_ID (expected 0x539)"
    echo "  Warning: Chain ID may not have updated yet. Check manually."
fi

BLOCK=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://localhost:8545 2>/dev/null | grep -o '"result":"[^"]*"' | cut -d'"' -f4 || echo "Error")

echo "  Block Number: $BLOCK"

echo ""
echo "Step 9: Checking account balance..."
ADMIN_BALANCE=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"],"id":1}' \
    http://localhost:8545 2>/dev/null | grep -o '"result":"[^"]*"' | cut -d'"' -f4 || echo "Error")

echo "  Admin Balance: $ADMIN_BALANCE"

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Node Status:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep vision

echo ""
echo "Next steps:"
echo "1. Verify balances via frontend"
echo "2. Redeploy smart contracts"
echo "3. Update contract addresses"
