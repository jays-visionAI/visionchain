#!/bin/bash

# Vision Chain Public Testnet Node Setup Script
# This script prepares the server environment and runs the Hardhat node using PM2.

NODE_DIR=~/vision-chain-node
APP_NAME="vision-testnet"

echo "==== Starting Vision Chain Testnet Node Setup ===="

# 1. Create directory
echo "Creating node directory at $NODE_DIR..."
mkdir -p $NODE_DIR
cd $NODE_DIR

# 2. Check for node_modules and install Hardhat
if [ ! -d "node_modules" ]; then
    echo "Initializing and installing Hardhat..."
    npm init -y
    npm install --save-dev hardhat
else
    echo "Hardhat already installed."
fi

# 3. Create a minimal hardhat.config.js if not exists
if [ ! -f "hardhat.config.js" ]; then
    echo "Creating basic hardhat.config.js..."
    cat <<EOF > hardhat.config.js
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      chainId: 3151909,
      mining: {
        auto: true,
        interval: 1000
      }
    }
  }
};
EOF
fi

# 4. Stop existing instance if any
echo "Stopping existing PM2 process if any..."
pm2 stop $APP_NAME || true
pm2 delete $APP_NAME || true

# 5. Start Hardhat Node with PM2
echo "Starting Hardhat node on 0.0.0.0:8545..."
pm2 start "npx hardhat node --hostname 0.0.0.0" --name $APP_NAME

# 6. Save PM2 list
pm2 save

echo "==== Setup Complete! ===="
echo "Node is running in the background."
echo "Use 'pm2 logs $APP_NAME' to view logs."
echo "Use 'pm2 status' to check state."
echo "=================================================="
