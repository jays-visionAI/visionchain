const hre = require('hardhat'); async function main() { const f = await hre.ethers.getContractFactory('BridgeStaking'); console.log(f.bytecode.slice(0,100)); } main();
