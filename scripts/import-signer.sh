#!/bin/bash
# Import new signer key to Vision Chain node and replace Hardhat #0 signer
# Usage: bash scripts/import-signer.sh

set -e

SSH_KEY="/Users/sangjaeseo/Antigravity/Vision-Chain/vision_key"
SERVER="admin@46.224.221.201"
NEW_ADMIN="0xd4FeD8Fe5946aDA714bb664D6B5F2C954acf6B15"
OLD_SIGNER="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

# Docker config (from docker inspect)
VOLUME="/home/admin/vision-shared-sequencer/deploy/v2-testnet/node1"
NETWORK="vision-shared-sequencer_vision-net"
IMAGE="ethereum/client-go:v1.13.15"

echo "=== Vision Chain Signer Replacement ==="
echo ""
echo "New Signer: $NEW_ADMIN"
echo "Old Signer: $OLD_SIGNER (Hardhat #0 - will be removed)"
echo ""

# Read private key securely (hidden input)
echo -n "Enter the private key for $NEW_ADMIN (input hidden): "
read -s ADMIN_PK
echo ""

# Remove 0x prefix if present
ADMIN_PK="${ADMIN_PK#0x}"

if [ ${#ADMIN_PK} -lt 64 ]; then
    echo "ERROR: Key too short. Need 64 hex characters."
    exit 1
fi

echo ""
echo "[1/5] Importing key to vision-node-1..."
ssh -i "$SSH_KEY" "$SERVER" "
docker exec vision-node-1 sh -c 'printf \"$ADMIN_PK\" > /tmp/nk && geth account import --password /root/.ethereum/password.txt /tmp/nk 2>&1; rm -f /tmp/nk'
"

echo ""
echo "[2/5] Verifying accounts..."
ssh -i "$SSH_KEY" "$SERVER" "docker exec vision-node-1 geth account list"

echo ""
echo "[3/5] Adding password for new account..."
# The password file needs one line per account
ssh -i "$SSH_KEY" "$SERVER" "
CURRENT_PW=\$(cat $VOLUME/password.txt)
echo \"\$CURRENT_PW\" > ${VOLUME}/password2.txt
echo \"\$CURRENT_PW\" >> ${VOLUME}/password2.txt
mv ${VOLUME}/password2.txt ${VOLUME}/password.txt
echo 'Password file updated with 2 entries'
"

echo ""
echo "[4/5] Restarting node-1 with both signers..."
ssh -i "$SSH_KEY" "$SERVER" "
docker stop vision-node-1 && sleep 2 && \
docker rm vision-node-1 && \
docker run -d --name vision-node-1 \
  --network $NETWORK \
  --ip 172.20.0.11 \
  -p 8545:8545 \
  -p 30303:30303 \
  -v $VOLUME:/root/.ethereum \
  $IMAGE \
  --networkid 3151909 \
  --http --http.addr 0.0.0.0 --http.port 8545 \
  --http.api eth,net,web3,admin,debug,clique \
  --allow-insecure-unlock \
  --unlock '$OLD_SIGNER,$NEW_ADMIN' \
  --password /root/.ethereum/password.txt \
  --mine \
  --miner.etherbase $NEW_ADMIN \
  --nat extip:172.20.0.11
"

echo ""
echo "Waiting 15s for node to start and sync..."
sleep 15

echo ""
echo "[5/5] Checking chain status..."
ssh -i "$SSH_KEY" "$SERVER" "
echo 'Block number:' && \
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' && echo '' && \
echo 'Signers:' && \
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{\"jsonrpc\":\"2.0\",\"method\":\"clique_getSigners\",\"params\":[],\"id\":2}' && echo '' && \
echo '' && \
echo 'Proposing removal of old signer...' && \
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{\"jsonrpc\":\"2.0\",\"method\":\"clique_propose\",\"params\":[\"$OLD_SIGNER\", false],\"id\":3}' && echo '' && \
sleep 10 && \
echo '' && \
echo 'Final signers:' && \
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{\"jsonrpc\":\"2.0\",\"method\":\"clique_getSigners\",\"params\":[],\"id\":4}'
"

echo ""
echo "=== Complete ==="

unset ADMIN_PK
