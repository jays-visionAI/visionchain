const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    // TODO: Paste user's address here when provided
    // For now, we'll just transfer to a dummy address or log instructions
    const USER_ADDRESS = process.env.USER_ADDRESS;

    if (!USER_ADDRESS) {
        console.log("Error: USER_ADDRESS environment variable not set.");
        console.log("Usage: USER_ADDRESS=0x... npx hardhat run scripts/faucet.js --network localhost");
        return;
    }

    // Address of VCNToken from deployment (Vision Testnet v2)
    const VCN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    const token = await hre.ethers.getContractAt("VCNToken", VCN_TOKEN_ADDRESS);

    // Amount: 100,000 VCN
    const amount = hre.ethers.parseEther("100000");

    console.log(`Sending 100,000 VCN to ${USER_ADDRESS}...`);

    const tx = await token.transfer(USER_ADDRESS, amount);
    await tx.wait();

    console.log(`Successfully sent ${hre.ethers.formatEther(amount)} VCN to ${USER_ADDRESS}`);

    // Send some ETH for gas
    const ethAmount = hre.ethers.parseEther("10.0");
    const ethTx = await deployer.sendTransaction({
        to: USER_ADDRESS,
        value: ethAmount
    });
    await ethTx.wait();
    console.log(`Also sent 10 ETH for Gas to ${USER_ADDRESS}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
