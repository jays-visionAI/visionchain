/**
 * Genesis Generator for Vision Chain v2
 * 
 * Creates a new genesis file with VCN as the native token
 * using the snapshot data for pre-funded accounts.
 * 
 * Usage: node scripts/generate-genesis-vcn.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load snapshot
const snapshotPath = path.join(__dirname, '../snapshots/genesis-alloc.json');
const allocData = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

// Vision Chain v2 Configuration
const CHAIN_ID = 1337;  // Keep same chain ID for compatibility
const CHAIN_NAME = 'Vision Chain';
const NATIVE_TOKEN_NAME = 'Vision Chain Token';
const NATIVE_TOKEN_SYMBOL = 'VCN';
const NATIVE_TOKEN_DECIMALS = 18;

// Genesis Configuration
const genesis = {
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
        // Clique PoA consensus
        clique: {
            period: 3,  // 3 second block time
            epoch: 30000
        }
    },
    difficulty: "1",
    gasLimit: "30000000",
    // Validator/Signer address (Admin)
    extradata: "0x0000000000000000000000000000000000000000000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb922660000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    alloc: {}
};

// Add snapshot balances to genesis
console.log('=== Generating VCN Native Genesis ===\n');
console.log(`Chain ID: ${CHAIN_ID}`);
console.log(`Native Token: ${NATIVE_TOKEN_SYMBOL}\n`);

let totalAccounts = 0;
let totalBalance = BigInt(0);

for (const [address, data] of Object.entries(allocData)) {
    // Ensure address is checksummed properly (lowercase)
    const addr = address.toLowerCase().replace('0x', '');
    genesis.alloc[addr] = {
        balance: data.balance
    };
    totalAccounts++;
    totalBalance += BigInt(data.balance);
}

console.log(`Total Accounts: ${totalAccounts}`);
console.log(`Total VCN Supply: ${(Number(totalBalance) / 1e18).toLocaleString()} VCN`);

// Add some ETH to admin for deployment gas (will be removed in production)
// This is only for contract deployment during migration
genesis.alloc['f39fd6e51aad88f6f4ce6ab8827279cfffb92266'] = {
    balance: genesis.alloc['f39fd6e51aad88f6f4ce6ab8827279cfffb92266'].balance
};

// Output directory
const outputDir = path.join(__dirname, '../blockchain/genesis');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Save genesis file
const genesisPath = path.join(outputDir, 'genesis-vcn-native.json');
fs.writeFileSync(genesisPath, JSON.stringify(genesis, null, 2));
console.log(`\nGenesis file saved to: ${genesisPath}`);

// Create migration guide
const migrationGuide = `
# Vision Chain v2 Migration Guide
# VCN Native Token Edition

## Overview
This genesis file configures Vision Chain with VCN as the native token (gas currency).

## Chain Configuration
- Chain ID: ${CHAIN_ID}
- Native Token: ${NATIVE_TOKEN_SYMBOL}
- Consensus: Clique PoA
- Block Time: 3 seconds

## Pre-funded Accounts
- Total Accounts: ${totalAccounts}
- Total Supply: ${(Number(totalBalance) / 1e18).toLocaleString()} VCN

## Migration Steps

### 1. Stop current chain
\`\`\`bash
# On server 46.224.221.201
pm2 stop vision-chain
\`\`\`

### 2. Backup current data
\`\`\`bash
cp -r /root/vision-chain/data /root/vision-chain/data-backup-$(date +%Y%m%d)
\`\`\`

### 3. Initialize new chain
\`\`\`bash
rm -rf /root/vision-chain/data/geth
geth init --datadir /root/vision-chain/data genesis-vcn-native.json
\`\`\`

### 4. Start new chain
\`\`\`bash
geth --datadir /root/vision-chain/data \\
  --networkid ${CHAIN_ID} \\
  --http --http.addr 0.0.0.0 --http.port 8545 \\
  --http.api eth,net,web3,personal,debug \\
  --http.corsdomain "*" \\
  --ws --ws.addr 0.0.0.0 --ws.port 8546 \\
  --ws.api eth,net,web3 \\
  --mine --miner.threads 1 \\
  --unlock 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \\
  --password /root/vision-chain/password.txt \\
  --allow-insecure-unlock
\`\`\`

### 5. Deploy contracts
\`\`\`bash
cd /path/to/Vision-Chain/blockchain
npx hardhat run scripts/deploy-all.js --network visionV2
\`\`\`

### 6. Update frontend
- Update contract addresses in services/contractService.ts
- Update any hardcoded addresses

## Verification
1. Check balance: \`eth.getBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")\`
2. Send test transaction
3. Verify gas is paid in VCN

## Rollback
If issues occur:
\`\`\`bash
rm -rf /root/vision-chain/data/geth
cp -r /root/vision-chain/data-backup-*/geth /root/vision-chain/data/
pm2 restart vision-chain
\`\`\`
`;

const guidePath = path.join(outputDir, 'MIGRATION-GUIDE.md');
fs.writeFileSync(guidePath, migrationGuide);
console.log(`Migration guide saved to: ${guidePath}`);

console.log('\n=== Genesis Generation Complete ===');
console.log('\nNext steps:');
console.log('1. Review genesis-vcn-native.json');
console.log('2. Follow MIGRATION-GUIDE.md');
console.log('3. Test on local node first');
