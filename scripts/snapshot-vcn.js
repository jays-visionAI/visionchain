/**
 * VCN Token Snapshot Script
 * 
 * Extracts all VCN token balances from Vision Chain for migration
 * to Native VCN chain.
 * 
 * Usage: node scripts/snapshot-vcn.js
 */

import { ethers } from 'ethers';
import fs from 'fs';


// Configuration
const RPC_URL = 'http://46.224.221.201:8545';
const VCN_TOKEN_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const OUTPUT_FILE = './snapshots/vcn-snapshot.json';

// ERC-20 ABI (minimal)
const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];

async function main() {
    console.log('=== VCN Token Snapshot ===\n');

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const vcnToken = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);

    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current Block: ${currentBlock}`);

    // Get total supply
    const totalSupply = await vcnToken.totalSupply();
    console.log(`Total Supply: ${ethers.formatEther(totalSupply)} VCN\n`);

    // Collect all unique addresses from Transfer events
    console.log('Scanning Transfer events...');
    const addresses = new Set();

    // Scan from block 0 to current
    const batchSize = 10000;
    for (let fromBlock = 0; fromBlock <= currentBlock; fromBlock += batchSize) {
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);

        try {
            const events = await vcnToken.queryFilter(
                vcnToken.filters.Transfer(),
                fromBlock,
                toBlock
            );

            events.forEach(event => {
                addresses.add(event.args.from.toLowerCase());
                addresses.add(event.args.to.toLowerCase());
            });

            console.log(`  Blocks ${fromBlock}-${toBlock}: ${events.length} events, ${addresses.size} unique addresses`);
        } catch (e) {
            console.warn(`  Error at blocks ${fromBlock}-${toBlock}: ${e.message}`);
        }
    }

    // Remove zero address
    addresses.delete('0x0000000000000000000000000000000000000000');

    console.log(`\nTotal unique addresses: ${addresses.size}`);

    // Get balances for all addresses
    console.log('\nFetching balances...');
    const balances = {};
    let totalBalanceCheck = BigInt(0);
    let nonZeroCount = 0;

    for (const address of addresses) {
        try {
            const balance = await vcnToken.balanceOf(address);
            if (balance > 0) {
                balances[address] = balance.toString();
                totalBalanceCheck += balance;
                nonZeroCount++;

                const formatted = ethers.formatEther(balance);
                if (parseFloat(formatted) > 100) {
                    console.log(`  ${address}: ${formatted} VCN`);
                }
            }
        } catch (e) {
            console.warn(`  Error fetching balance for ${address}: ${e.message}`);
        }
    }

    console.log(`\nNon-zero balances: ${nonZeroCount}`);
    console.log(`Total balance check: ${ethers.formatEther(totalBalanceCheck)} VCN`);

    // Create snapshot object
    const snapshot = {
        timestamp: new Date().toISOString(),
        blockNumber: currentBlock,
        tokenAddress: VCN_TOKEN_ADDRESS,
        totalSupply: totalSupply.toString(),
        totalSupplyFormatted: ethers.formatEther(totalSupply),
        addressCount: nonZeroCount,
        balances: balances
    };

    // Ensure snapshots directory exists
    if (!fs.existsSync('./snapshots')) {
        fs.mkdirSync('./snapshots', { recursive: true });
    }

    // Save snapshot
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(snapshot, null, 2));
    console.log(`\nSnapshot saved to: ${OUTPUT_FILE}`);

    // Also save Genesis format
    const genesisAlloc = {};
    for (const [address, balance] of Object.entries(balances)) {
        genesisAlloc[address] = {
            balance: '0x' + BigInt(balance).toString(16)
        };
    }

    const genesisFile = './snapshots/genesis-alloc.json';
    fs.writeFileSync(genesisFile, JSON.stringify(genesisAlloc, null, 2));
    console.log(`Genesis allocation saved to: ${genesisFile}`);

    console.log('\n=== Snapshot Complete ===');
}

main().catch(console.error);
