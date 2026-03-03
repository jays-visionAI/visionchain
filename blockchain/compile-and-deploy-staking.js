/**
 * Compile BridgeStaking.sol with solc and deploy directly to Vision Chain
 * Usage: node compile-and-deploy-staking.js
 */
const { execSync } = require('child_process');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x78ef903e82813aebe7ff3dfb46581520435c70f8b05d8fa1d728a2bebc3179b0';
const RPC_URL = 'https://api.visionchain.co/rpc-proxy';
const VCN_TOKEN = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

function findImports(importPath) {
    const dirs = [
        path.join(__dirname, 'node_modules'),
        path.join(__dirname, 'contracts'),
        __dirname,
    ];
    for (const dir of dirs) {
        const full = path.join(dir, importPath);
        if (fs.existsSync(full)) {
            return { contents: fs.readFileSync(full, 'utf8') };
        }
    }
    return { error: 'File not found: ' + importPath };
}

async function main() {
    console.log('Reading BridgeStaking.sol...');
    const source = fs.readFileSync(path.join(__dirname, 'contracts/BridgeStaking.sol'), 'utf8');

    console.log('Compiling...');
    const input = {
        language: 'Solidity',
        sources: { 'BridgeStaking.sol': { content: source } },
        settings: {
            optimizer: { enabled: true, runs: 200 },
            outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
            evmVersion: 'paris'
        }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

    if (output.errors) {
        const errors = output.errors.filter(e => e.severity === 'error');
        if (errors.length > 0) {
            console.error('Compilation errors:', errors.map(e => e.formattedMessage).join('\n'));
            process.exit(1);
        }
        output.errors.forEach(e => console.warn(e.formattedMessage));
    }

    const contract = output.contracts['BridgeStaking.sol']['BridgeStaking'];
    const abi = contract.abi;
    const bytecode = '0x' + contract.evm.bytecode.object;

    // Verify MINIMUM_STAKE in bytecode (100 VCN = 100 * 1e18 = 0x56BC75E2D63100000)
    // hex for 100 ether
    console.log('Bytecode length:', bytecode.length);
    console.log('Compilation successful!');

    // Check MINIMUM_STAKE value via ABI
    const minStakeEntry = abi.find(e => e.name === 'MINIMUM_STAKE');
    console.log('MINIMUM_STAKE in ABI:', minStakeEntry ? 'found' : 'not found as function');

    // Deploy
    console.log('\nConnecting to Vision Chain...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log('Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(balance), 'VCN');

    if (balance === 0n) {
        console.error('ERROR: Deployer has 0 balance. Cannot pay gas fees.');
        process.exit(1);
    }

    console.log('\nDeploying BridgeStaking (MINIMUM_STAKE = 100 VCN)...');
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const deployedContract = await factory.deploy(VCN_TOKEN, {
        gasLimit: 5000000,
        gasPrice: ethers.parseUnits('1', 'gwei')
    });

    console.log('Tx hash:', deployedContract.deploymentTransaction().hash);
    console.log('Waiting for confirmation...');
    await deployedContract.waitForDeployment();

    const address = await deployedContract.getAddress();
    console.log('\n=== Deployment Complete ===');
    console.log('New BridgeStaking address:', address);
    console.log('VCN Token:', VCN_TOKEN);

    // Verify MINIMUM_STAKE on-chain
    const deployed = new ethers.Contract(address, abi, provider);
    const minStake = await deployed.MINIMUM_STAKE();
    console.log('MINIMUM_STAKE on-chain:', ethers.formatEther(minStake), 'VCN');

    // Set APY 12%
    console.log('\nSetting APY to 12%...');
    const apyTx = await deployed.connect(wallet).setTargetAPY(1200, {
        gasLimit: 100000,
        gasPrice: ethers.parseUnits('1', 'gwei')
    });
    await apyTx.wait();
    console.log('APY set to 12%');

    console.log('\n=== UPDATE THESE FILES ===');
    console.log('1. components/ValidatorStaking.tsx -> BRIDGE_STAKING_ADDRESS =', JSON.stringify(address));
    console.log('2. functions/index.js -> BRIDGE_STAKING_ADDRESS =', JSON.stringify(address));

    // Save to file
    fs.writeFileSync(
        path.join(__dirname, 'deployments/bridge-staking-v4.json'),
        JSON.stringify({ address, minStake: '100', deployedAt: new Date().toISOString() }, null, 2)
    );
    console.log('\nSaved to deployments/bridge-staking-v4.json');
}

main().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
