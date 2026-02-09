/**
 * Direct Deployment Script (No Hardhat Network)
 * Uses ethers.js directly to deploy to Vision Chain
 * 
 * Usage: node scripts/deploy-direct.js
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const RPC_URL = 'http://46.224.221.201:8545';
const ADMIN_PRIVATE_KEY = process.env.VISION_ADMIN_PK;

// Read compiled artifacts
function loadArtifact(contractName) {
    // Check blockchain/artifacts first, then root artifacts
    let artifactPath = path.join(__dirname, '../artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
        // Try root level (hardhat sometimes puts them there)
        artifactPath = path.join(__dirname, '../../artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);
    }
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact not found for ${contractName}`);
    }
    return JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
}


async function main() {
    console.log("\n=== Vision Chain v2 Direct Deployment ===");
    console.log("Native VCN Edition\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

    console.log("Deployer:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Deployer VCN Balance:", ethers.formatEther(balance), "VCN\n");

    const chainId = (await provider.getNetwork()).chainId;
    console.log("Chain ID:", chainId.toString(), "\n");

    const deployedAddresses = {};

    // 1. Deploy VCNVestingNative
    console.log("1. Deploying VCNVestingNative...");
    const vestingArtifact = loadArtifact('VCNVestingNative');
    const VestingFactory = new ethers.ContractFactory(vestingArtifact.abi, vestingArtifact.bytecode, wallet);
    const vesting = await VestingFactory.deploy(wallet.address);
    await vesting.waitForDeployment();
    deployedAddresses.VCN_VESTING = await vesting.getAddress();
    console.log("   VCNVestingNative:", deployedAddresses.VCN_VESTING);

    // 2. Deploy VisionNodeLicenseNative
    console.log("2. Deploying VisionNodeLicenseNative...");
    const nodeLicenseArtifact = loadArtifact('VisionNodeLicenseNative');
    const NodeLicenseFactory = new ethers.ContractFactory(nodeLicenseArtifact.abi, nodeLicenseArtifact.bytecode, wallet);
    const nodeLicense = await NodeLicenseFactory.deploy(wallet.address);
    await nodeLicense.waitForDeployment();
    deployedAddresses.NODE_LICENSE = await nodeLicense.getAddress();
    console.log("   VisionNodeLicenseNative:", deployedAddresses.NODE_LICENSE);

    // 3. Deploy VisionMiningPoolNative
    console.log("3. Deploying VisionMiningPoolNative...");
    const miningPoolArtifact = loadArtifact('VisionMiningPoolNative');
    const MiningPoolFactory = new ethers.ContractFactory(miningPoolArtifact.abi, miningPoolArtifact.bytecode, wallet);
    const miningPool = await MiningPoolFactory.deploy(deployedAddresses.NODE_LICENSE, wallet.address);
    await miningPool.waitForDeployment();
    deployedAddresses.MINING_POOL = await miningPool.getAddress();
    console.log("   VisionMiningPoolNative:", deployedAddresses.MINING_POOL);

    // 4. Deploy VisionBridgeNative
    console.log("4. Deploying VisionBridgeNative...");
    const bridgeArtifact = loadArtifact('VisionBridgeNative');
    const BridgeFactory = new ethers.ContractFactory(bridgeArtifact.abi, bridgeArtifact.bytecode, wallet);
    const bridge = await BridgeFactory.deploy([wallet.address], 1); // 1 relayer, 1 required signature
    await bridge.waitForDeployment();
    deployedAddresses.VISION_BRIDGE = await bridge.getAddress();
    console.log("   VisionBridgeNative:", deployedAddresses.VISION_BRIDGE);

    // 5. Deploy VCNPaymasterNative
    console.log("5. Deploying VCNPaymasterNative...");
    const paymasterArtifact = loadArtifact('VCNPaymasterNative');
    const PaymasterFactory = new ethers.ContractFactory(paymasterArtifact.abi, paymasterArtifact.bytecode, wallet);
    const paymaster = await PaymasterFactory.deploy([wallet.address], 1); // 1 signer, 1 required signature
    await paymaster.waitForDeployment();
    deployedAddresses.VCN_PAYMASTER = await paymaster.getAddress();
    console.log("   VCNPaymasterNative:", deployedAddresses.VCN_PAYMASTER);

    // Summary
    console.log("\n=== Deployment Summary ===");
    console.log(JSON.stringify(deployedAddresses, null, 2));

    // Save to file
    const outputPath = path.join(__dirname, '../deployed-addresses.json');
    fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));
    console.log(`\nSaved to: ${outputPath}`);

    console.log("\n=== Update services/contractService.ts ===");
    console.log("const ADDRESSES = {");
    console.log(`    // Vision Chain v2 - VCN Native (Chain ID: ${chainId})`);
    for (const [key, value] of Object.entries(deployedAddresses)) {
        console.log(`    ${key}: "${value}",`);
    }
    console.log("};");

    return deployedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error);
        process.exit(1);
    });
