#!/usr/bin/env node

/**
 * Vision Chain Mainnet Key Generator
 * 
 * Runs LOCALLY (on your Mac) to generate all keys and config files.
 * Only encrypted keystores and config files are uploaded to the server.
 * Private keys NEVER touch the server.
 * 
 * Usage: node blockchain/scripts/generate-keys.js
 */

const { ethers } = require("ethers");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ─── Configuration ───────────────────────────────────────────────
const CHAIN_ID = 3151909;
const NETWORK_ID = 3151909;
const BLOCK_PERIOD = 5; // seconds
const CLIQUE_EPOCH = 30000;
const GAS_LIMIT = "30000000";
const NUM_NODES = 5;
const SERVER_IP = "46.224.221.201";

// Initial allocations (in ether)
const SIGNER_ALLOC = "1000000"; // 1M VCN per signer
const EXECUTOR_ALLOC = "10000000"; // 10M VCN for executor (paymaster funding, etc.)

// Docker internal IPs
const NODE_IPS = [
  "172.20.0.11",
  "172.20.0.12",
  "172.20.0.13",
  "172.20.0.14",
  "172.20.0.15",
];

const OUTPUT_DIR = path.join(__dirname, "..", "mainnet-deploy");

// ─── Helper Functions ────────────────────────────────────────────

function generatePrivateKey() {
  return crypto.randomBytes(32).toString("hex");
}

function privateKeyToAddress(privateKey) {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}

function privateKeyToPublicKey(privateKey) {
  // For enode, we need the uncompressed public key without the 0x04 prefix
  const signingKey = new ethers.SigningKey("0x" + privateKey);
  const publicKey = signingKey.publicKey;
  // publicKey is 0x04... (uncompressed, 65 bytes = 130 hex chars + 0x prefix)
  // enode ID is the public key without the 04 prefix
  return publicKey.slice(4); // remove "0x04"
}

function toChecksumAddress(address) {
  return ethers.getAddress(address);
}

function etherToWei(ether) {
  return ethers.parseEther(ether);
}

function etherToHexWei(ether) {
  const wei = ethers.parseEther(ether);
  return "0x" + wei.toString(16);
}

// ─── Clique ExtraData Encoding ───────────────────────────────────

function encodeCliqueExtraData(signerAddresses) {
  // Sort addresses (lowercase, no 0x) in ascending order
  const sorted = signerAddresses
    .map((a) => a.toLowerCase().replace("0x", ""))
    .sort();

  // 32 bytes vanity (zeros)
  const vanity = "0".repeat(64);
  // Concatenated signer addresses (20 bytes each)
  const signers = sorted.join("");
  // 65 bytes signature placeholder (zeros)
  const seal = "0".repeat(130);

  return "0x" + vanity + signers + seal;
}

// ─── Genesis Generation ─────────────────────────────────────────

function generateGenesis(signerAddresses, executorAddress) {
  const alloc = {};

  // Allocate to signers
  for (const addr of signerAddresses) {
    alloc[addr.toLowerCase().replace("0x", "")] = {
      balance: etherToHexWei(SIGNER_ALLOC),
    };
  }

  // Allocate to executor
  alloc[executorAddress.toLowerCase().replace("0x", "")] = {
    balance: etherToHexWei(EXECUTOR_ALLOC),
  };

  return {
    config: {
      chainId: CHAIN_ID,
      homesteadBlock: 0,
      eip150Block: 0,
      eip155Block: 0,
      eip158Block: 0,
      byzantiumBlock: 0,
      constantinopleBlock: 0,
      petersburgBlock: 0,
      istanbulBlock: 0,
      berlinBlock: 0,
      londonBlock: 0,
      clique: {
        period: BLOCK_PERIOD,
        epoch: CLIQUE_EPOCH,
      },
    },
    difficulty: "1",
    gasLimit: GAS_LIMIT,
    extradata: encodeCliqueExtraData(signerAddresses),
    alloc,
  };
}

// ─── Static Nodes Generation ────────────────────────────────────

function generateStaticNodes(nodePublicKeys) {
  return nodePublicKeys.map(
    (pubkey, i) => `enode://${pubkey}@${NODE_IPS[i]}:30303`
  );
}

// ─── Config TOML Generation (replaces deprecated static-nodes.json) ─

function generateConfigToml(staticNodes) {
  const quoted = staticNodes.map((n) => `"${n}"`).join(", ");
  return `[Node.P2P]
StaticNodes = [${quoted}]
MaxPeers = 25
NoDiscovery = true
`;
}

// ─── Docker Compose Generation ──────────────────────────────────

function generateDockerCompose(signerAddresses) {
  const nodeServices = {};

  for (let i = 0; i < NUM_NODES; i++) {
    const nodeNum = i + 1;
    const ip = NODE_IPS[i];
    const rpcPort = 8545 + i;
    const p2pPort = 30303 + i;
    const address = signerAddresses[i];

    nodeServices[`node-${nodeNum}`] = {
      image: "ethereum/client-go:v1.13.15",
      container_name: `vision-node-${nodeNum}`,
      restart: "unless-stopped",
      networks: {
        "vision-net": {
          ipv4_address: ip,
        },
      },
      ports: [`${rpcPort}:8545`, `${p2pPort}:30303`, `${p2pPort}:30303/udp`],
      volumes: [
        `./deploy/v2-testnet/node${nodeNum}:/root/.ethereum`,
        "./deploy/v2-testnet/static-nodes.json:/root/.ethereum/static-nodes.json:ro",
      ],
      command: [
        "--networkid",
        String(NETWORK_ID),
        "--nodiscover",
        "--http",
        "--http.addr",
        "0.0.0.0",
        "--http.port",
        "8545",
        "--http.api",
        "eth,net,web3,admin,debug,clique,miner,txpool",
        "--http.corsdomain",
        "*",
        "--allow-insecure-unlock",
        "--unlock",
        address,
        "--password",
        "/root/.ethereum/password.txt",
        "--mine",
        "--miner.etherbase",
        address,
        "--nat",
        `extip:${ip}`,
        "--maxpeers",
        "25",
      ].join(" "),
      deploy: {
        resources: {
          limits: {
            memory: "2G",
            cpus: "0.5",
          },
        },
      },
      healthcheck: {
        test: [
          "CMD-SHELL",
          `curl -sf -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545 || exit 1`,
        ],
        interval: "30s",
        timeout: "10s",
        retries: 3,
        start_period: "30s",
      },
    };
  }

  // Build YAML manually for clean formatting
  let yaml = `services:\n`;

  for (let i = 0; i < NUM_NODES; i++) {
    const nodeNum = i + 1;
    const ip = NODE_IPS[i];
    const rpcPort = 8545 + i;
    const p2pPort = 30303 + i;
    const address = signerAddresses[i];

    yaml += `\n  # Node ${nodeNum}: Validator ${nodeNum} (Sealer)\n`;
    yaml += `  node-${nodeNum}:\n`;
    yaml += `    image: ethereum/client-go:v1.13.15\n`;
    yaml += `    container_name: vision-node-${nodeNum}\n`;
    yaml += `    restart: unless-stopped\n`;
    yaml += `    networks:\n`;
    yaml += `      vision-net:\n`;
    yaml += `        ipv4_address: ${ip}\n`;
    yaml += `    ports:\n`;
    yaml += `      - "${rpcPort}:8545"\n`;
    yaml += `      - "${p2pPort}:30303"\n`;
    yaml += `      - "${p2pPort}:30303/udp"\n`;
    yaml += `    volumes:\n`;
    yaml += `      - ./deploy/v2-testnet/node${nodeNum}:/root/.ethereum\n`;
    yaml += `    command: >\n`;
    yaml += `      --config /root/.ethereum/config.toml\n`;
    yaml += `      --networkid ${NETWORK_ID}\n`;
    yaml += `      --http --http.addr "0.0.0.0" --http.port 8545\n`;
    yaml += `      --http.api "eth,net,web3,admin,debug,clique,miner,txpool"\n`;
    yaml += `      --http.corsdomain "*"\n`;
    yaml += `      --allow-insecure-unlock\n`;
    yaml += `      --unlock "${address}"\n`;
    yaml += `      --password /root/.ethereum/password.txt\n`;
    yaml += `      --mine --miner.etherbase "${address}"\n`;
    yaml += `      --nat extip:${ip}\n`;
    yaml += `      --maxpeers 25\n`;
    yaml += `    deploy:\n`;
    yaml += `      resources:\n`;
    yaml += `        limits:\n`;
    yaml += `          memory: 2G\n`;
    yaml += `          cpus: "0.5"\n`;
    yaml += `    healthcheck:\n`;
    yaml += `      test: ["CMD-SHELL", "curl -sf -X POST -H 'Content-Type: application/json' --data '{\\\"jsonrpc\\\":\\\"2.0\\\",\\\"method\\\":\\\"eth_blockNumber\\\",\\\"params\\\":[],\\\"id\\\":1}' http://localhost:8545 || exit 1"]\n`;
    yaml += `      interval: 30s\n`;
    yaml += `      timeout: 10s\n`;
    yaml += `      retries: 3\n`;
    yaml += `      start_period: 30s\n`;
  }

  // Kafka & Zookeeper (kept for compatibility)
  yaml += `\n  # Kafka & Zookeeper for Shared Sequencer\n`;
  yaml += `  zookeeper:\n`;
  yaml += `    image: confluentinc/cp-zookeeper:7.0.1\n`;
  yaml += `    container_name: vision-zookeeper\n`;
  yaml += `    restart: unless-stopped\n`;
  yaml += `    networks:\n`;
  yaml += `      vision-net:\n`;
  yaml += `        ipv4_address: 172.20.0.21\n`;
  yaml += `    ports:\n`;
  yaml += `      - "2181:2181"\n`;
  yaml += `    environment:\n`;
  yaml += `      ZOOKEEPER_CLIENT_PORT: 2181\n`;
  yaml += `      ZOOKEEPER_TICK_TIME: 2000\n`;
  yaml += `\n  kafka:\n`;
  yaml += `    image: confluentinc/cp-kafka:7.0.1\n`;
  yaml += `    container_name: vision-kafka\n`;
  yaml += `    restart: unless-stopped\n`;
  yaml += `    networks:\n`;
  yaml += `      vision-net:\n`;
  yaml += `        ipv4_address: 172.20.0.22\n`;
  yaml += `    depends_on:\n`;
  yaml += `      - zookeeper\n`;
  yaml += `    ports:\n`;
  yaml += `      - "9092:9092"\n`;
  yaml += `    environment:\n`;
  yaml += `      KAFKA_BROKER_ID: 1\n`;
  yaml += `      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181\n`;
  yaml += `      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://${SERVER_IP}:9092\n`;
  yaml += `      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT\n`;
  yaml += `      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT\n`;
  yaml += `      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1\n`;

  // Network
  yaml += `\nnetworks:\n`;
  yaml += `  vision-net:\n`;
  yaml += `    driver: bridge\n`;
  yaml += `    ipam:\n`;
  yaml += `      config:\n`;
  yaml += `        - subnet: 172.20.0.0/16\n`;

  return yaml;
}

// ─── Keystore Generation ─────────────────────────────────────────

async function createKeystore(privateKey, password) {
  const wallet = new ethers.Wallet(privateKey);
  const keystoreJson = await wallet.encrypt(password);
  return {
    json: keystoreJson,
    address: wallet.address,
  };
}

// ─── Prompt Helper ──────────────────────────────────────────────

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("==========================================================");
  console.log("   Vision Chain Mainnet Key Generator");
  console.log("   Local execution only - keys never touch the server");
  console.log("==========================================================\n");

  // Create output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    const answer = await prompt(
      `[WARNING] ${OUTPUT_DIR} already exists. Overwrite? (yes/no): `
    );
    if (answer.toLowerCase() !== "yes") {
      console.log("Aborted.");
      process.exit(1);
    }
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1: Generate strong keystore password
  console.log("[Step 1/11] Generating keystore password...");
  const keystorePassword = crypto.randomBytes(32).toString("base64");
  fs.writeFileSync(path.join(OUTPUT_DIR, "password.txt"), keystorePassword);
  console.log("  -> password.txt created\n");

  // Step 2: Generate 5 Signer Private Keys
  console.log("[Step 2/11] Generating 5 signer private keys...");
  const signerKeys = [];
  const signerAddresses = [];
  for (let i = 0; i < NUM_NODES; i++) {
    const pk = generatePrivateKey();
    const addr = privateKeyToAddress(pk);
    signerKeys.push(pk);
    signerAddresses.push(addr);
    console.log(`  Node ${i + 1}: ${addr}`);
  }
  console.log("");

  // Step 3: Generate Executor Private Key
  console.log("[Step 3/11] Generating executor private key...");
  const executorKey = generatePrivateKey();
  const executorAddress = privateKeyToAddress(executorKey);
  console.log(`  Executor: ${executorAddress}\n`);

  // Step 4: Generate 5 NodeKeys
  console.log("[Step 4/11] Generating 5 P2P node keys...");
  const nodeKeys = [];
  const nodePublicKeys = [];
  for (let i = 0; i < NUM_NODES; i++) {
    const nk = generatePrivateKey();
    const pubkey = privateKeyToPublicKey(nk);
    nodeKeys.push(nk);
    nodePublicKeys.push(pubkey);
    console.log(`  Node ${i + 1} enode: ${pubkey.slice(0, 16)}...`);
  }
  console.log("");

  // Step 5: Create encrypted keystore files
  console.log("[Step 5/11] Creating encrypted keystores (this may take a moment)...");
  for (let i = 0; i < NUM_NODES; i++) {
    const nodeDir = path.join(OUTPUT_DIR, `node${i + 1}`, "keystore");
    fs.mkdirSync(nodeDir, { recursive: true });

    const { json, address } = await createKeystore(
      signerKeys[i],
      keystorePassword
    );
    const filename = `UTC--${new Date().toISOString().replace(/:/g, "-")}--${address.toLowerCase().replace("0x", "")}`;
    fs.writeFileSync(path.join(nodeDir, filename), json);
    console.log(`  Node ${i + 1}: keystore created for ${address}`);
  }
  console.log("");

  // Step 6: Write NodeKey files
  console.log("[Step 6/11] Writing nodekey files...");
  for (let i = 0; i < NUM_NODES; i++) {
    const gethDir = path.join(OUTPUT_DIR, `node${i + 1}`, "geth");
    fs.mkdirSync(gethDir, { recursive: true });
    fs.writeFileSync(path.join(gethDir, "nodekey"), nodeKeys[i]);
    console.log(`  Node ${i + 1}: nodekey written`);
  }
  console.log("");

  // Step 7: Generate config.toml for each node (replaces deprecated static-nodes.json)
  console.log("[Step 7/11] Generating config.toml for each node...");
  const staticNodes = generateStaticNodes(nodePublicKeys);
  const configToml = generateConfigToml(staticNodes);
  for (let i = 0; i < NUM_NODES; i++) {
    const nodeDir = path.join(OUTPUT_DIR, `node${i + 1}`);
    fs.writeFileSync(path.join(nodeDir, "config.toml"), configToml);
    console.log(`  Node ${i + 1}: config.toml created`);
  }
  // Also save static-nodes.json for reference
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "static-nodes.json"),
    JSON.stringify(staticNodes, null, 2)
  );
  console.log("  -> config.toml + static-nodes.json created\n");

  // Step 8: Generate genesis.json
  console.log("[Step 8/11] Generating genesis.json...");
  const genesis = generateGenesis(signerAddresses, executorAddress);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "genesis.json"),
    JSON.stringify(genesis, null, 2)
  );
  console.log("  -> genesis.json created\n");

  // Step 9: Generate docker-compose.yml
  console.log("[Step 9/11] Generating docker-compose.yml...");
  const dockerCompose = generateDockerCompose(signerAddresses);
  fs.writeFileSync(path.join(OUTPUT_DIR, "docker-compose.yml"), dockerCompose);
  console.log("  -> docker-compose.yml created\n");

  // Step 10: Save keys backup
  console.log("[Step 10/11] Saving keys backup...");
  let backup = "";
  backup += "=== VISION CHAIN MAINNET KEYS BACKUP ===\n";
  backup += `Generated: ${new Date().toISOString()}\n`;
  backup += `Chain ID: ${CHAIN_ID}\n`;
  backup += `Keystore Password: ${keystorePassword}\n`;
  backup += "\n--- SIGNER KEYS (Node Validators) ---\n";
  for (let i = 0; i < NUM_NODES; i++) {
    backup += `\nNode ${i + 1}:\n`;
    backup += `  Address:     ${signerAddresses[i]}\n`;
    backup += `  Private Key: 0x${signerKeys[i]}\n`;
    backup += `  NodeKey:     ${nodeKeys[i]}\n`;
    backup += `  Enode:       enode://${nodePublicKeys[i]}@${NODE_IPS[i]}:30303\n`;
  }
  backup += "\n--- EXECUTOR KEY (Paymaster / Agent) ---\n";
  backup += `  Address:     ${executorAddress}\n`;
  backup += `  Private Key: 0x${executorKey}\n`;
  backup += "\n=== END OF BACKUP ===\n";

  const backupPath = path.join(OUTPUT_DIR, "keys-backup.txt");
  fs.writeFileSync(backupPath, backup);
  fs.chmodSync(backupPath, 0o600);

  console.log("  -> keys-backup.txt created (chmod 600)\n");

  // Print backup to screen
  console.log("==========================================================");
  console.log("  CRITICAL: SAVE THE FOLLOWING TO 1PASSWORD");
  console.log("==========================================================");
  console.log(backup);
  console.log("==========================================================\n");

  // Step 11: Prompt to delete backup
  const answer = await prompt(
    "Have you saved the keys to 1Password? Type 'DELETE' to remove keys-backup.txt: "
  );
  if (answer === "DELETE") {
    fs.unlinkSync(backupPath);
    console.log("\n  -> keys-backup.txt DELETED");
  } else {
    console.log(
      "\n  -> keys-backup.txt kept. DELETE IT MANUALLY after saving!"
    );
    console.log(`     rm ${backupPath}`);
  }

  // Summary
  console.log("\n==========================================================");
  console.log("  Generation Complete!");
  console.log("==========================================================");
  console.log(`\nOutput directory: ${OUTPUT_DIR}`);
  console.log("\nFiles created:");
  console.log("  - password.txt (keystore encryption password)");
  console.log("  - genesis.json (5-signer Clique genesis)");
  console.log("  - static-nodes.json (reference)");
  console.log("  - docker-compose.yml (updated node config)");
  for (let i = 1; i <= NUM_NODES; i++) {
    console.log(`  - node${i}/keystore/UTC--... (encrypted keystore)`);
    console.log(`  - node${i}/geth/nodekey (P2P identity)`);
    console.log(`  - node${i}/config.toml (P2P static peers)`);
  }

  console.log("\n--- Next Steps ---");
  console.log("1. Upload to server:");
  console.log(
    `   rsync -avz -e "ssh -i ./vision_key" blockchain/mainnet-deploy/ root@${SERVER_IP}:/home/admin/vision-mainnet-deploy/`
  );
  console.log("2. Run deployment script on server:");
  console.log(
    `   ssh -i ./vision_key root@${SERVER_IP} "cd /home/admin/vision-shared-sequencer && bash /home/admin/vision-mainnet-deploy/deploy-mainnet-v1.sh"`
  );
  console.log(
    `\n3. Register Executor key in Firebase Secrets:`
  );
  console.log(`   Address: ${executorAddress}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
