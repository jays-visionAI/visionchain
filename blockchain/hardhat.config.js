require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    paths: {
        sources: "./contracts",
        artifacts: "./artifacts",
        cache: "./cache"
    },
    networks: {
        hardhat: {
            chainId: 1337
        },
        // Polygon Amoy Testnet
        amoy: {
            url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
        // Vision Chain Testnet
        vision_testnet: {
            url: "https://tdstest.visionchain.bk.simplyfi.tech/rpc",
            chainId: 3151908,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            gasPrice: "auto"
        },
        // Vision Chain Custom Testnet v2 (Correct)
        vision_v2: {
            url: "https://api.visionchain.co/rpc-proxy",
            chainId: 1337,
            accounts: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"], // Admin Key
            gasPrice: 1000000000, // 1 gwei
            gas: 8000000
        },
        // Ethereum Sepolia Testnet
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        }
    },
};
