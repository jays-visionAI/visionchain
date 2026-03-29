#!/bin/bash
set -e

# ============================================================================
# Vision Chain v3 Testnet Reset Script
# ============================================================================
# Complete chain reset with 5 Clique PoA signers.
# All nodes use Geth-native keystores for reliable mining.
# ============================================================================

PROJECT_DIR="/home/admin/vision-shared-sequencer"
DEPLOY_DIR="$PROJECT_DIR/deploy/v2-testnet"
CHAIN_ID=3151909
PASSWORD="visionchain2026"
GETH_IMAGE="ethereum/client-go:v1.13.15"

# Executor wallet (for Paymaster/AgentGateway - key stored in Firebase Secrets)
EXECUTOR_ADDR="08a1b183a53a0f8f1d875945d504272738e3af34"

# Node 1 uses the Hardhat default key (known PK)
NODE1_PK="ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Nodes 2-5 use known PKs (from previous validator setup)
NODE2_PK="be145d080d2138cdedd09f69abfa026be4ff21fc0d08b715f666211fc40980a1"
NODE3_PK=$(openssl rand -hex 32)
NODE4_PK=$(openssl rand -hex 32)
NODE5_PK=$(openssl rand -hex 32)

echo "============================================"
echo "  Vision Chain v3 Testnet FULL RESET"
echo "============================================"
echo ""

# ==============================
# Step 1: Stop all containers
# ==============================
echo "[1/7] Stopping Docker containers..."
cd "$PROJECT_DIR"
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
sleep 3
echo "  Done."

# ==============================
# Step 2: Clear ALL chain data + keystores
# ==============================
echo "[2/7] Clearing all data..."
for i in 1 2 3 4 5; do
    NODE_DIR="$DEPLOY_DIR/node$i"
    # Remove everything except the directory itself
    docker run --rm -v "$NODE_DIR:/data" alpine sh -c "rm -rf /data/geth /data/keystore /data/nodekey /data/config.toml /data/static-nodes.json /data/genesis.json 2>/dev/null; mkdir -p /data/keystore" 2>/dev/null || true
    echo "$PASSWORD" > "$NODE_DIR/password.txt" 2>/dev/null || \
        docker run --rm -v "$NODE_DIR:/data" alpine sh -c "echo '$PASSWORD' > /data/password.txt"
    echo "  Cleared node$i"
done
echo "  Done."

# ==============================
# Step 3: Import keystores using Geth
# ==============================
echo "[3/7] Generating Geth-native keystores..."

NODE_PKS=("$NODE1_PK" "$NODE2_PK" "$NODE3_PK" "$NODE4_PK" "$NODE5_PK")
NODE_ADDRS=()

for i in 1 2 3 4 5; do
    IDX=$((i-1))
    PK="${NODE_PKS[$IDX]}"
    NODE_DIR="$DEPLOY_DIR/node$i"
    
    # Write PK to temp file
    echo "$PK" > /tmp/node${i}_pk.txt
    echo "$PASSWORD" > /tmp/geth_pw.txt
    
    # Import using Geth (creates native keystore with lowercase "crypto")
    RESULT=$(docker run --rm \
        -v "$NODE_DIR:/root/.ethereum" \
        -v /tmp/node${i}_pk.txt:/tmp/pk.txt \
        -v /tmp/geth_pw.txt:/tmp/pw.txt \
        $GETH_IMAGE \
        account import --password /tmp/pw.txt /tmp/pk.txt 2>&1)
    
    # Extract address from output
    ADDR=$(echo "$RESULT" | grep -oP 'Address: \{([0-9a-fA-F]+)\}' | grep -oP '[0-9a-fA-F]{40}')
    if [ -z "$ADDR" ]; then
        # Fallback: read from keystore filename
        ADDR=$(docker run --rm -v "$NODE_DIR:/data:ro" alpine ls /data/keystore/ | head -1 | grep -oP '[0-9a-f]{40}$')
    fi
    NODE_ADDRS+=("$ADDR")
    echo "  Node $i: 0x$ADDR"
done

rm -f /tmp/node*_pk.txt /tmp/geth_pw.txt

echo "  Done."

# ==============================
# Step 4: Create Genesis
# ==============================
echo "[4/7] Creating genesis file..."

# Clique extradata: 32 bytes vanity + N*20 bytes signers + 65 bytes seal
EXTRADATA="0x0000000000000000000000000000000000000000000000000000000000000000"
for addr in "${NODE_ADDRS[@]}"; do
    EXTRADATA="${EXTRADATA}${addr}"
done
EXTRADATA="${EXTRADATA}0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"

cat > "$DEPLOY_DIR/genesis.json" << GENESIS_EOF
{
  "config": {
    "chainId": $CHAIN_ID,
    "homesteadBlock": 0,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0,
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "petersburgBlock": 0,
    "istanbulBlock": 0,
    "berlinBlock": 0,
    "londonBlock": 0,
    "clique": {
      "period": 5,
      "epoch": 30000
    }
  },
  "difficulty": "1",
  "gasLimit": "30000000",
  "extradata": "${EXTRADATA}",
  "alloc": {
    "${NODE_ADDRS[0]}": { "balance": "0x33B2E3C9FD0803CE8000000" },
    "${EXECUTOR_ADDR}": { "balance": "0x84595161401484A000000" },
    "${NODE_ADDRS[1]}": { "balance": "0x3635C9ADC5DEA00000" },
    "${NODE_ADDRS[2]}": { "balance": "0x3635C9ADC5DEA00000" },
    "${NODE_ADDRS[3]}": { "balance": "0x3635C9ADC5DEA00000" },
    "${NODE_ADDRS[4]}": { "balance": "0x3635C9ADC5DEA00000" }
  }
}
GENESIS_EOF

echo "  Genesis created with 5 signers."

# ==============================
# Step 5: Init genesis on all nodes
# ==============================
echo "[5/7] Initializing genesis on all nodes..."

for i in 1 2 3 4 5; do
    NODE_DIR="$DEPLOY_DIR/node$i"
    docker run --rm \
        -v "$NODE_DIR:/root/.ethereum" \
        -v "$DEPLOY_DIR/genesis.json:/tmp/genesis.json:ro" \
        $GETH_IMAGE \
        init /tmp/genesis.json 2>&1 | tail -1
    echo "  Node $i initialized."
done

echo "  Done."

# ==============================
# Step 6: Write docker-compose.yml
# ==============================
echo "[6/7] Writing docker-compose.yml..."

# Get Node 1's enode for bootnodes
NODE1_ENODE_ID=$(docker run --rm \
    -v "$DEPLOY_DIR/node1:/root/.ethereum:ro" \
    --entrypoint sh $GETH_IMAGE \
    -c "cat /root/.ethereum/geth/nodekey" 2>/dev/null || echo "")

cat > "$PROJECT_DIR/docker-compose.yml" << 'COMPOSE_EOF'
services:
  node-1:
    image: ethereum/client-go:v1.13.15
    container_name: vision-node-1
    restart: unless-stopped
    networks:
      vision-net:
        ipv4_address: 172.20.0.11
    ports:
      - "8545:8545"
      - "30303:30303"
    volumes:
      - ./deploy/v2-testnet/node1:/root/.ethereum
    command: >
COMPOSE_EOF

# Append node-1 command (needs variable expansion)
cat >> "$PROJECT_DIR/docker-compose.yml" << COMPOSE_NODE1
      --networkid $CHAIN_ID --http --http.addr "0.0.0.0" --http.port 8545 --http.api "eth,net,web3,admin,debug,clique,miner" --http.corsdomain "*" --allow-insecure-unlock --unlock "0x${NODE_ADDRS[0]}" --password /root/.ethereum/password.txt --mine --miner.etherbase "0x${NODE_ADDRS[0]}" --nat extip:172.20.0.11 --maxpeers 25
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '0.5'
COMPOSE_NODE1

# Nodes 2-5
PORTS_RPC=(8546 8547 8548 8549)
PORTS_P2P=(30304 30305 30306 30307)
IPS=("172.20.0.12" "172.20.0.13" "172.20.0.14" "172.20.0.15")

for j in 0 1 2 3; do
    NODE_NUM=$((j+2))
    ADDR="${NODE_ADDRS[$((j+1))]}"
    
    cat >> "$PROJECT_DIR/docker-compose.yml" << COMPOSE_NODE
  
  node-${NODE_NUM}:
    image: ethereum/client-go:v1.13.15
    container_name: vision-node-${NODE_NUM}
    restart: unless-stopped
    networks:
      vision-net:
        ipv4_address: ${IPS[$j]}
    ports:
      - "${PORTS_RPC[$j]}:8545"
      - "${PORTS_P2P[$j]}:30303"
    volumes:
      - ./deploy/v2-testnet/node${NODE_NUM}:/root/.ethereum
    command: >
      --networkid $CHAIN_ID --http --http.addr "0.0.0.0" --http.port 8545 --http.api "eth,net,web3,admin,clique,miner" --http.corsdomain "*" --allow-insecure-unlock --unlock "0x${ADDR}" --password /root/.ethereum/password.txt --mine --miner.etherbase "0x${ADDR}" --nat extip:${IPS[$j]} --maxpeers 25
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '0.5'
COMPOSE_NODE
done

# Kafka & Zookeeper
cat >> "$PROJECT_DIR/docker-compose.yml" << 'COMPOSE_INFRA'

  zookeeper:
    image: confluentinc/cp-zookeeper:7.0.1
    container_name: vision-zookeeper
    restart: unless-stopped
    networks:
      vision-net:
        ipv4_address: 172.20.0.21
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:7.0.1
    container_name: vision-kafka
    restart: unless-stopped
    networks:
      vision-net:
        ipv4_address: 172.20.0.22
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://46.224.221.201:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

networks:
  vision-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
COMPOSE_INFRA

echo "  docker-compose.yml written."

# ==============================
# Step 7: Start all containers + verify
# ==============================
echo "[7/7] Starting containers..."
cd "$PROJECT_DIR"
docker compose up -d
sleep 15

echo ""
echo "============================================"
echo "  VERIFICATION"
echo "============================================"
echo ""

echo "Containers:"
docker ps --format '  {{.Names}}: {{.Status}}' | grep vision | sort
echo ""

# Wait for nodes to start mining
echo "Waiting for nodes to start mining..."
sleep 15

# Get Node 1 enode for peer additions
NODE1_ENODE=$(curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' http://172.20.0.11:8545 2>/dev/null | grep -oP '"enode":"[^"]+' | sed 's/"enode":"//')
echo "Node 1 enode: ${NODE1_ENODE:-UNKNOWN}"

# Add Node 1 as peer to all other nodes
if [ -n "$NODE1_ENODE" ]; then
    echo ""
    echo "Adding Node 1 as peer to all nodes..."
    for port in 8546 8547 8548 8549; do
        curl -s -X POST -H "Content-Type: application/json" \
            -d "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addPeer\",\"params\":[\"$NODE1_ENODE\"],\"id\":1}" \
            http://172.20.0.11:$port 2>/dev/null | head -1
    done
    sleep 5
fi

echo ""
echo "Block number (should be > 0):"
for port in 8545 8546 8547 8548 8549; do
    BLOCK=$(curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://172.20.0.11:$port 2>/dev/null)
    MINING=$(curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_mining","params":[],"id":1}' http://172.20.0.11:$port 2>/dev/null)
    echo "  Port $port: $BLOCK mining=$MINING"
done

echo ""
echo "Clique signers:"
curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"clique_getSigners","params":[],"id":1}' http://172.20.0.11:8545

echo ""
echo ""
echo "Peer count:"
curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' http://172.20.0.11:8545

echo ""
echo ""
echo "============================================"
echo "  RESET COMPLETE"
echo "============================================"
echo ""
echo "Node addresses:"
for i in 1 2 3 4 5; do
    echo "  Node $i: 0x${NODE_ADDRS[$((i-1))]}"
done
echo "  Executor: 0x${EXECUTOR_ADDR}"
echo ""
echo "NEXT STEPS:"
echo "  1. Deploy VCNToken contract: npx hardhat run scripts/deploy.js --network visionchain"
echo "  2. Deploy VCNPaymaster contract"
echo "  3. Deploy BridgeStaking contract"
echo "  4. Restore user balances from snapshot"
echo "  5. Update .env + Cloud Function configs with new contract addresses"
echo "  6. Redeploy Cloud Functions"
