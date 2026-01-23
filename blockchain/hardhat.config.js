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
    networks: {
        hardhat: {
            chainId: 3151909
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
        // Vision Chain Custom Testnet v2 (New)
        vision_v2: {
            url: "https://rpc.visionchain.co",
            chainId: 1337,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
        // Ethereum Sepolia Testnet
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        }
    },
};
