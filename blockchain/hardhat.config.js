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
        sources: __dirname + "/contracts",
        artifacts: __dirname + "/artifacts",
        cache: __dirname + "/cache"
    },
    networks: {
        hardhat: {
            chainId: 1337
        },
        // Polygon Amoy Testnet (old config)
        amoy: {
            url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
        // Polygon Amoy Testnet (new - for VCN Token deployment)
        polygon_amoy: {
            url: "https://polygon-amoy-bor-rpc.publicnode.com",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 80002,
            gasPrice: "auto"
        },
        // Base Sepolia Testnet (for VCN Token deployment)
        base_sepolia: {
            url: "https://base-sepolia-rpc.publicnode.com",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 84532,
            gasPrice: "auto"
        },
        // Vision Chain Testnet (old)
        visionTestnet: {
            url: "https://tdstest.visionchain.bk.simplyfi.tech/rpc",
            chainId: 3151908,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            gasPrice: "auto"
        },
        // Vision Chain Custom Testnet v2 (Current)
        visionV2: {
            url: "https://api.visionchain.co/rpc-proxy",
            chainId: 3151909,
            accounts: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"], // Admin Key
            gasPrice: 1000000000, // 1 gwei
            gas: 8000000
        },
        // Ethereum Sepolia Testnet
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "https://rpc.ankr.com/eth_sepolia",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 11155111
        }
    },
};
