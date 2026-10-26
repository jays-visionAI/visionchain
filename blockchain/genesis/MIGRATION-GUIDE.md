
# Vision Chain v2 Migration Guide
# VCN Native Token Edition

## Overview
This genesis file configures Vision Chain with VCN as the native token (gas currency).

## Chain Configuration
- Chain ID: 3151909
- Native Token: VCN
- Consensus: Clique PoA
- Block Time: 3 seconds

## Pre-funded Accounts
- Total Accounts: 55
- Total Supply: 4,000,000,000 VCN

## Migration Steps

### 1. Stop current chain
```bash
# On server 46.224.221.201
pm2 stop vision-chain
```

### 2. Backup current data
```bash
cp -r /root/vision-chain/data /root/vision-chain/data-backup-$(date +%Y%m%d)
```

### 3. Initialize new chain
```bash
rm -rf /root/vision-chain/data/geth
geth init --datadir /root/vision-chain/data genesis-vcn-native.json
```

### 4. Start new chain
```bash
geth --datadir /root/vision-chain/data \
  --networkid 3151909 \
  --mine --miner.threads 1 \
  --unlock 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --password /root/vision-chain/password.txt
# A sealing signer runs without --http/--ws (geth allows --unlock only then);
# use IPC for admin/clique: geth attach --exec 'clique.getSigners()' /root/vision-chain/data/geth.ipc
# Serve public RPC from a separate node with no keys, behind the method allowlist:
#   --http --http.addr 127.0.0.1 --http.api eth,net,web3   (see docs/pending/rpc-lockdown.md)
```

### 5. Deploy contracts
```bash
cd /path/to/Vision-Chain/blockchain
npx hardhat run scripts/deploy-all.js --network visionV2
```

### 6. Update frontend
- Update contract addresses in services/contractService.ts
- Update any hardcoded addresses

## Verification
1. Check balance: `eth.getBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")`
2. Send test transaction
3. Verify gas is paid in VCN

## Rollback
If issues occur:
```bash
rm -rf /root/vision-chain/data/geth
cp -r /root/vision-chain/data-backup-*/geth /root/vision-chain/data/
pm2 restart vision-chain
```
