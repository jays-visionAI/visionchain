#!/bin/bash

# ==============================================================================
# Vision Chain v2.0 - One-Click 5-Node Cluster Deployment Script
# ==============================================================================
# This script automates:
# 1. Docker & Docker Compose installation (if missing on Ubuntu/Debian)
# 2. Directory and Configuration setup
# 3. Genesis initialization
# 4. Starting the 5-node cluster via Docker Compose
# ==============================================================================

set -e

echo "🚀 Starting Vision Chain 5-Node Cluster Deployment..."

# 1. Check for Docker
if ! [ -x "$(command -v docker)" ]; then
    echo "⚠️ Docker is not installed. Attempting to install..."
    sudo apt-get update
    sudo apt-get install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    echo "✅ Docker installed successfully."
fi

# 2. Check for Docker Compose
if ! [ -x "$(command -v docker-compose)" ]; then
    echo "⚠️ Docker Compose is not installed. Attempting to install..."
    sudo apt-get install -y docker-compose
    echo "✅ Docker Compose installed successfully."
fi

# 3. Setup Project Structure
DEPLOY_ROOT="./deploy/v2-testnet"
echo "📂 Setting up project structure in $DEPLOY_ROOT..."

# Run the existing setup script if present, otherwise recreate logic
if [ -f "scripts/setup_multi_node.sh" ]; then
    bash scripts/setup_multi_node.sh
else
    mkdir -p $DEPLOY_ROOT
    for i in {1..5}; do
        mkdir -p "$DEPLOY_ROOT/node$i/data"
        mkdir -p "$DEPLOY_ROOT/node$i/keystore"
    done
    
    # Genesis Placeholder
    cat <<EOF > "$DEPLOY_ROOT/genesis.json"
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
  "alloc": {}
}
EOF
    for i in {1..5}; do cp "$DEPLOY_ROOT/genesis.json" "$DEPLOY_ROOT/node$i/"; done
fi

# 4. Start the Cluster
echo "⚡ Starting 5-Node Cluster via Docker Compose..."
sudo docker-compose up -d

echo "📊 Waiting for Node-1 to initialize..."
sleep 5

# 5. Output Verification
echo "✅ Deployment Complete!"
echo "--------------------------------------------------------"
echo "RPC Endpoints:"
echo "Node 1: http://localhost:8545"
echo "Node 2: http://localhost:8546"
echo "Node 3: http://localhost:8547"
echo "Node 4: http://localhost:8548"
echo "Node 5: http://localhost:8549"
echo "--------------------------------------------------------"
echo "Check logs: sudo docker-compose logs -f node-1"
