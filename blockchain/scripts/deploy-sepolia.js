/**
 * VCN Token Deployment to Sepolia
 * 
 * Deploys VCN token for cross-chain bridging on Sepolia testnet.
 * 
 * Usage: node scripts/deploy-sepolia.js
 * 
 * Required: SEPOLIA_PRIVATE_KEY environment variable
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - Use public Sepolia RPC endpoints
const SEPOLIA_RPC_URLS = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.drpc.org',
    'https://1rpc.io/sepolia',
    'https://eth-sepolia.public.blastapi.io'
];
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || SEPOLIA_RPC_URLS[0];

// REQUIRED: Set your private key via environment variable
// DO NOT use default test keys - they are public and insecure!
const ADMIN_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;

if (!ADMIN_PRIVATE_KEY) {
    console.error("\n ERROR: SEPOLIA_PRIVATE_KEY environment variable is required!");
    console.error("\n Usage:");
    console.error("   export SEPOLIA_PRIVATE_KEY='0xYOUR_PRIVATE_KEY'");
    console.error("   node scripts/deploy-sepolia.js\n");
    process.exit(1);
}


// Load artifact
function loadArtifact(contractName) {
    const artifactPath = path.join(__dirname, '../artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact not found: ${artifactPath}`);
    }
    return JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
}

async function main() {
    console.log("\n=== VCN Token Deployment to Sepolia ===\n");

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

    console.log("Deployer:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Deployer ETH Balance:", ethers.formatEther(balance), "ETH\n");

    if (balance < ethers.parseEther("0.01")) {
        console.error("ERROR: Insufficient ETH for deployment. Need at least 0.01 ETH on Sepolia.");
        console.log("\nGet Sepolia ETH from:");
        console.log("  - https://sepoliafaucet.com");
        console.log("  - https://faucet.sepolia.io");
        console.log("  - https://www.alchemy.com/faucets/ethereum-sepolia");
        process.exit(1);
    }

    const chainId = (await provider.getNetwork()).chainId;
    console.log("Chain ID:", chainId.toString(), "\n");

    if (chainId !== 11155111n) {
        console.error("ERROR: Not connected to Sepolia. Expected chain ID 11155111.");
        process.exit(1);
    }

    // Deploy VCNToken
    console.log("Deploying VCNToken (VCN on Sepolia)...");
    const vcnArtifact = loadArtifact('VCNToken');
    const VCNFactory = new ethers.ContractFactory(vcnArtifact.abi, vcnArtifact.bytecode, wallet);

    // Admin and Bridge Relayer are same for now (can be changed later)
    const vcn = await VCNFactory.deploy(wallet.address, wallet.address);
    await vcn.waitForDeployment();

    const vcnAddress = await vcn.getAddress();
    console.log("VCN Token (Sepolia):", vcnAddress);

    // Summary
    console.log("\n=== Deployment Summary ===");
    console.log({
        network: "Sepolia",
        chainId: 11155111,
        VCN_TOKEN: vcnAddress,
        name: "VCN (Sepolia)",
        symbol: "VCN",
        admin: wallet.address
    });

    // Save to file
    const outputPath = path.join(__dirname, '../deployed-addresses-sepolia.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        VCN_TOKEN: vcnAddress,
        ADMIN: wallet.address,
        DEPLOYED_AT: new Date().toISOString()
    }, null, 2));
    console.log(`\nSaved to: ${outputPath}`);

    console.log("\n=== Next Steps ===");
    console.log("1. Update Bridge Relayer to mint VCN when locking on Vision Chain");
    console.log("2. Grant BRIDGE_ROLE to the relayer address");
    console.log("3. Test bridging flow");

    return vcnAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error);
        process.exit(1);
    });
