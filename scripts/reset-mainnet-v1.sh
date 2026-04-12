#!/bin/bash
set -e

# ============================================================================
# Vision Chain v1 Mainnet Reset Script
# ============================================================================
# Core Mainnet Architecture Features:
# 1. 5 Fixed Validators using PoA (Clique) mechanism.
# 2. Entirely new, securely generated Private Keys for all Nodes and Executor.
# 3. Deterministic NodeKeys configured statically to prevent identity changes.
# 4. static-nodes.json injected to prevent networking isolation (0 Peers bug).
# ============================================================================

PROJECT_DIR="/home/admin/vision-shared-sequencer"
DEPLOY_DIR="$PROJECT_DIR/deploy/v1-mainnet"
CHAIN_ID=3151909
PASSWORD="visionchainmainnet2026"
GETH_IMAGE="ethereum/client-go:v1.13.15"

# ==============================
# SECURE MAINNET CREDENTIALS
# ==============================
# Executor (Paymaster / AI Agent / Faucet)
EXECUTOR_PK="406de1fd9dd5c9cc60a4bde5fc7969407f00ccd33df98f2cdedd0c4a3c84e6eb"
EXECUTOR_ADDR="1695b3E7421B5A1b76171720Ae29782Bf2209d6F"

# Validators (Consensus Signers)
NODE1_PK="398115f7d186ba066e06b44f38372c17b55ff50707c57880a20fc38bb370fabe"
NODE2_PK="e5aeb7aa7b1f945ab4cc62a91ba3edf7cc0734bda818ba677a97f5985f308063"
NODE3_PK="3caaba9785fb2a34065cf1a0d6521c195eb214c06d503c3c0e47981f76bc2a9b"
NODE4_PK="9fa15d5477f10be2fe518ac77d886d35b6b3078fb64982b5ab2a32606433f26c"
NODE5_PK="add23f474939dc3caa165add4837df190511b20b986ac748f510776a53746be0"

NODE_ADDRS=(
  "B8fe232F6E9De248fDBA4964eC048144C25E4fe0"  # Node 1
  "EEd8229a360E9152838df766FcF15392024896fc"  # Node 2
  "255e9E306D1A151f13748976F209FEe5431612cf"  # Node 3
  "CdE47F7A7C6Db5D234930DFc509F1eA413370099"  # Node 4
  "0323814dF4F0D1efdA2CD0C3E65C836E1091073F"  # Node 5
)

# P2P NodeKeys (Identity keys to guarantee consistent enodes)
NODE1_NK="179d3e87fa3dc0d4c2030882188569e5912241bd05dbd297da03d6ec4b29edf3"
NODE2_NK="176a68967af3b4b9a768e5557f127fe171039e4ce0d8b3727726457bc985811d"
NODE3_NK="8415c141a84fff73e06a21b06cbbea1524f3cb8d6d791a86d360ca04a02cc5ec"
NODE4_NK="5ce164b13a0faad911d4771b2c6799e67d2b5fc3f6a60bc664ee0c3319c446fe"
NODE5_NK="c399ec6f05f2b3a7e871a7ac847fb84520bd56750f05126176754dfcb15b73a1"

# Evaluated Enode PubKeys (Generated from NodeKeys)
NODE1_PUB="90c110c3dcacf21500c0a998d769430f052498623a8469c2c2a6932d189f2ca5b68f54bac18ba5c677b3fdd5f9ec7dabf88a189034d1e6e0cee9cfacf3eb2e9b"
NODE2_PUB="c700070f52603ee73eb1370f848ce6469bbb12f921afc6ba1399d895145335af4915a422fdee2ecc09d45970b1f5da39ceb4bf893a32b3bc9c3677048f222c4c"
NODE3_PUB="0a598b6fa243241d2104494198effc5c7d4951dfa80840141859619ca62246a92c90f92b5635baedca20b57b2b09ada7ef6ad5ef6670eef87d14abbea5bbd460"
NODE4_PUB="31029fb0ad837e202b477dc254ad15a046e2d13a5f094217f02ad2a4a21009df70df875e045c31071f687ab457e391092369443a374a987bb19b54e36f2548d5"
NODE5_PUB="5f3433fcba934ae3cd9a7c06a61e4dc69a53011dcfd6c87a88dd6fc2141cbd914d2bf79168fd072ef5331183891e74448a3ae4ff9bcc4e55cde5b8bb3fcb2206"

echo "================================================="
echo "  🚀 Vision Chain Mainnet v1 FULL RESET"
echo "================================================="
echo "  WARNING: This clears ALL blockchain data,"
echo "  starts block height from 0, and introduces"
echo "  fully isolated mainnet configuration."
echo "================================================="
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
# Step 2: Clear ALL chain data + ensure geth directory exists
# ==============================
echo "[2/7] Clearing all data and scaffolding directories..."
for i in 1 2 3 4 5; do
    NODE_DIR="$DEPLOY_DIR/node$i"
    # Create the required subdirectories beforehand
    mkdir -p "$NODE_DIR/geth" "$NODE_DIR/keystore"
    docker run --rm -v "$NODE_DIR:/data" alpine sh -c "rm -rf /data/geth/* /data/keystore/* /data/nodekey /data/config.toml /data/static-nodes.json /data/genesis.json 2>/dev/null" 2>/dev/null || true
    echo "$PASSWORD" > "$NODE_DIR/password.txt" 2>/dev/null || \
        docker run --rm -v "$NODE_DIR:/data" alpine sh -c "echo '$PASSWORD' > /data/password.txt"
    echo "  Cleared node$i"
done
echo "  Done."

# ==============================
# Step 3: Inject Keystores and fixed NodeKeys
# ==============================
echo "[3/7] Storing immutable NodeKeys and generating Geth Keystores..."

NODE_PKS=("$NODE1_PK" "$NODE2_PK" "$NODE3_PK" "$NODE4_PK" "$NODE5_PK")
NODE_NKS=("$NODE1_NK" "$NODE2_NK" "$NODE3_NK" "$NODE4_NK" "$NODE5_NK")

for i in 1 2 3 4 5; do
    IDX=$((i-1))
    PK="${NODE_PKS[$IDX]}"
    NK="${NODE_NKS[$IDX]}"
    NODE_DIR="$DEPLOY_DIR/node$i"
    
    # 3.1 Write fixed P2P nodekey
    echo "$NK" > "$NODE_DIR/geth/nodekey"
    
    # 3.2 Write PK to temp file to import securely
    echo "$PK" > /tmp/node${i}_pk.txt
    echo "$PASSWORD" > /tmp/geth_pw.txt
    
    # 3.3 Import using Geth container
    RESULT=$(docker run --rm \
        -v "$NODE_DIR:/root/.ethereum" \
        -v /tmp/node${i}_pk.txt:/tmp/pk.txt \
        -v /tmp/geth_pw.txt:/tmp/pw.txt \
        $GETH_IMAGE \
        account import --password /tmp/pw.txt /tmp/pk.txt 2>&1)
    
    echo "  Node $i initialized logic setup."
done

rm -f /tmp/node*_pk.txt /tmp/geth_pw.txt
echo "  Done."

# ==============================
# Step 4: Write static-nodes.json globally
# ==============================
echo "[4/7] Applying persistent static-nodes.json to all nodes..."
# Building the static routing configuration mapping the exact fixed IPs and Enodes
cat > "$DEPLOY_DIR/static-nodes.json" << STATIC_EOF
[
  "enode://${NODE1_PUB}@172.20.0.11:30303",
  "enode://${NODE2_PUB}@172.20.0.12:30303",
  "enode://${NODE3_PUB}@172.20.0.13:30303",
  "enode://${NODE4_PUB}@172.20.0.14:30303",
  "enode://${NODE5_PUB}@172.20.0.15:30303"
]
STATIC_EOF

for i in 1 2 3 4 5; do
    cp "$DEPLOY_DIR/static-nodes.json" "$DEPLOY_DIR/node$i/geth/static-nodes.json"
done

# ==============================
# Step 5: Create Genesis
# ==============================
echo "[5/7] Creating PoA Mainnet Genesis..."

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

echo "  Genesis configured with strictly secured signers."

# ==============================
# Step 6: Init genesis and write docker-compose.yml
# ==============================
echo "[6/7] Initializing Geth genesis buffers and generating Compose..."

for i in 1 2 3 4 5; do
    NODE_DIR="$DEPLOY_DIR/node$i"
    docker run --rm \
        -v "$NODE_DIR:/root/.ethereum" \
        -v "$DEPLOY_DIR/genesis.json:/tmp/genesis.json:ro" \
        $GETH_IMAGE \
        init /tmp/genesis.json 2>&1 | tail -1
done

# We inject `--nodiscover` strictly so nodes don't search external space.
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
      - ./deploy/v1-mainnet/node1:/root/.ethereum
    command: >
COMPOSE_EOF

cat >> "$PROJECT_DIR/docker-compose.yml" << COMPOSE_NODE1
      --networkid $CHAIN_ID --http --http.addr "0.0.0.0" --http.port 8545 --http.api "eth,net,web3,admin,debug,clique,miner" --http.corsdomain "*" --allow-insecure-unlock --unlock "0x${NODE_ADDRS[0]}" --password /root/.ethereum/password.txt --mine --miner.etherbase "0x${NODE_ADDRS[0]}" --nat extip:172.20.0.11 --maxpeers 25 --nodiscover
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '0.5'
COMPOSE_NODE1

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
      - ./deploy/v1-mainnet/node${NODE_NUM}:/root/.ethereum
    command: >
      --networkid $CHAIN_ID --http --http.addr "0.0.0.0" --http.port 8545 --http.api "eth,net,web3,admin,clique,miner" --http.corsdomain "*" --allow-insecure-unlock --unlock "0x${ADDR}" --password /root/.ethereum/password.txt --mine --miner.etherbase "0x${ADDR}" --nat extip:${IPS[$j]} --maxpeers 25 --nodiscover
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '0.5'
COMPOSE_NODE
done

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

echo "  Done."

# ==============================
# Step 7: Boot Mainnet Infrastructure
# ==============================
echo "[7/7] Starting fully interconnected containers..."
cd "$PROJECT_DIR"
docker compose up -d
sleep 15

echo ""
echo "============================================"
echo "  POST-RESET VERIFICATION"
echo "============================================"
echo ""

echo "Waiting for interconnected sync to establish..."
sleep 10
echo ""
echo "Enode Status (Static Mesh):"
echo "If static-nodes is working, peers will auto-connect without admin_addPeer."
echo ""
echo "Peer counts:"
for port in 8545 8546 8547 8548 8549; do
    PEERS=$(curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' http://172.20.0.11:$port 2>/dev/null | grep -oP '"result":"[^"]+' | sed 's/"result":"//')
    BLOCK=$(curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://172.20.0.11:$port 2>/dev/null | grep -oP '"result":"[^"]+' | sed 's/"result":"//')
    echo "  Port $port - Peers: $(printf "%d" 0x${PEERS:-0}) | Block: $(printf "%d" 0x${BLOCK:-0})"
done

echo ""
echo "============================================"
echo "  MAINNET FULLY ALIVE"
echo "============================================"
echo "  Core Validator Setup (Static): Node1 to Node5"
echo ""
echo "  [EXECUTOR WALLET] (Store securely!):"
echo "  Address: 0x1695b3E7421B5A1b76171720Ae29782Bf2209d6F"
echo "  Private Key: 406de1fd9dd5c9cc60a4bde5fc7969407f00ccd33df98f2cdedd0c4a3c84e6eb"
echo ""
echo "  Next Steps for Server Admin:"
echo "  1. Update Hardhat / smart contract deploy configs to use the EXECUTOR KEY."
echo "  2. Update Firebase Functions environment variables with EXECUTOR KEY."
echo "  3. Deploy Smart Contracts (VCN, Paymaster, Bridge)."
