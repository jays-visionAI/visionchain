#!/bin/bash

# Vision Chain Multi-Node Cluster Setup Script (5 Nodes)
# This script prepares the directory structure and initial configuration for 5 nodes.

BASE_DIR="./deploy/v2-testnet"
mkdir -p $BASE_DIR

echo "--- Initializing Vision Chain 5-Node Cluster Environment ---"

# 1. Create Directories
for i in {1..5}
do
    echo "Creating directory for Node $i..."
    mkdir -p "$BASE_DIR/node$i/data"
    mkdir -p "$BASE_DIR/node$i/keystore"
done

# 2. Prepare Genesis File
# In a real scenario, we would use a specific genesis.json for v2-testnet.
# For now, we'll place a placeholder or use an existing one if available.
cat <<EOF > "$BASE_DIR/genesis.json"
{
  "config": {
    "chainId": 3151909,
    "homesteadBlock": 0,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0,
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "petersburgBlock": 0,
    "istanbulBlock": 0,
    "clique": {
      "period": 5,
      "epoch": 30000
    }
  },
  "difficulty": "1",
  "gasLimit": "8000000",
  "extraData": "0x0000000000000000000000000000000000000000000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb922660000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "alloc": {
    "f39Fd6e51aad88F6F4ce6aB8827279cffFb92266": {
      "balance": "1000000000000000000000000"
    }
  }
}
EOF

echo "Copying genesis.json to all nodes..."
for i in {1..5}
do
    cp "$BASE_DIR/genesis.json" "$BASE_DIR/node$i/"
done

# 3. Generating Node Keys (Mocking for local setup)
# In production, keys would be generated via 'geth account new' or 'bootnode -genkey'.
for i in {1..5}
do
    touch "$BASE_DIR/node$i/nodekey"
    echo "Node $i keys initialized (placeholder)."
done

echo "--- Setup Complete! ---"
echo "Root Directory: $BASE_DIR"
echo "Next step: Run 'docker-compose up -d' in the base directory."
