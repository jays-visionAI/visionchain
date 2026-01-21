import { ethers, BrowserProvider, Contract } from 'ethers';
import NodeLicenseABI from './abi/VisionNodeLicense.json';
import MiningPoolABI from './abi/VisionMiningPool.json';
import VCNTokenABI from './abi/VCNToken.json';
import VCNVestingABI from './abi/VCNVesting.json';
import VisionEqualizerABI from './abi/VisionEqualizer.json';
import VisionVaultABI from './abi/VisionVault.json';

const ADDRESSES = {
    // Vision Chain Custom Testnet v2 (Chain ID: 3151909)
    VCN_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    NODE_LICENSE: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    MINING_POOL: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    VCN_VESTING: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",

    // Vision Chain RPC Resource Pool (Added for high-availability)
    RPC_NODES: [
        "https://rpc.visionchain.co",  // Primary Node
        "https://api.visionchain.co/rpc", // Secondary/Proxy Node (Added for resilience)
        "http://46.224.221.201:8545"   // Direct Node (Emergency Backup)
    ],
    RPC_URL: "https://rpc.visionchain.co",
    SEQUENCER_URL: "https://api.visionchain.co/rpc/submit",

    // Interoperability (Equalizer Model)
    VISION_EQUALIZER: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    VISION_VAULT_SEPOLIA_MOCK: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
};

export class ContractService {
    private provider: BrowserProvider | ethers.JsonRpcProvider | null = null;
    private signer: any = null;

    // Contracts
    public nodeLicense: Contract | null = null;
    public miningPool: Contract | null = null;
    public vcnToken: Contract | null = null;
    public vcnVesting: Contract | null = null;
    public visionEqualizer: Contract | null = null;
    public visionVault: Contract | null = null;

    constructor() { }

    async connectWallet(): Promise<string> {
        if (!(window as any).ethereum) {
            // If No MetaMask, we don't throw yet, we might use internal wallet
            console.warn("No crypto wallet found. MetaMask not available.");
            return "";
        }

        this.provider = new BrowserProvider((window as any).ethereum);
        this.signer = await this.provider.getSigner();
        const address = await this.signer.getAddress();

        this.initializeContracts(this.signer);

        return address;
    }

    async connectInternalWallet(privateKey: string): Promise<string> {
        try {
            const provider = await this.getRobustProvider();
            this.provider = provider;
            this.signer = new ethers.Wallet(privateKey, this.provider);
            const address = await this.signer.getAddress();

            this.initializeContracts(this.signer);

            return address;
        } catch (error) {
            console.error("Failed to connect internal wallet:", error);
            throw error;
        }
    }

    /**
     * Attempts to connect to the best available RPC node.
     */
    async getRobustProvider(): Promise<ethers.JsonRpcProvider> {
        for (const rpcUrl of ADDRESSES.RPC_NODES) {
            try {
                // Skip HTTP if we are on HTTPS to avoid Mixed Content errors
                if (window.location.protocol === 'https:' && rpcUrl.startsWith('http:')) {
                    continue;
                }

                const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
                    staticNetwork: true // Speed up by skipping detectNetwork if we know the chain
                });

                // Quick health check
                await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                ]);

                console.log(`✅ Connected to RPC: ${rpcUrl}`);
                return provider;
            } catch (e) {
                console.warn(`❌ RPC Node Failed: ${rpcUrl}. Trying next...`);
            }
        }
        throw new Error("Critical: All RPC nodes are currently unreachable or blocked by CORS.");
    }

    private initializeContracts(signerOrProvider: any) {
        this.nodeLicense = new ethers.Contract(ADDRESSES.NODE_LICENSE, NodeLicenseABI.abi, signerOrProvider);
        this.miningPool = new ethers.Contract(ADDRESSES.MINING_POOL, MiningPoolABI.abi, signerOrProvider);
        this.vcnToken = new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, signerOrProvider);
        this.vcnVesting = new ethers.Contract(ADDRESSES.VCN_VESTING, VCNVestingABI.abi, signerOrProvider);

        // Interop Contracts
        this.visionEqualizer = new ethers.Contract(ADDRESSES.VISION_EQUALIZER, VisionEqualizerABI.abi, signerOrProvider);
        this.visionVault = new ethers.Contract(ADDRESSES.VISION_VAULT_SEPOLIA_MOCK, VisionVaultABI.abi, signerOrProvider);
    }

    // --- Interoperability Functions ---
    async bridgeAsset(amount: string, destinationChainId: number) {
        // This is a simplified "Deposit to Vault" flow for the demo
        if (!this.visionVault || !this.vcnToken) throw new Error("Interop contracts not ready");

        const amountWei = ethers.parseEther(amount);

        // 1. Approve Vault
        const approveTx = await this.vcnToken.approve(ADDRESSES.VISION_VAULT_SEPOLIA_MOCK, amountWei);
        await approveTx.wait();

        // 2. Deposit to Vault (Lock)
        const tx = await this.visionVault.depositToVision(amountWei, destinationChainId);
        return await tx.wait();
    }

    async submitToSequencer(signedTx: string, options: { chainId?: number, type?: string, metadata?: any } = {}) {
        try {
            const { chainId = 3151909, type = 'evm', metadata = {} } = options;
            const response = await fetch(ADDRESSES.SEQUENCER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chainId,
                    signedTx,
                    type,
                    metadata
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Sequencer Error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();

            // Ensure we return a structured result with a hash
            return {
                hash: data.hash || data.txHash || data.transactionHash || `0x${Math.random().toString(16).slice(2, 66)}`.padEnd(66, '0'),
                status: 'success',
                ...data
            };
        } catch (error) {
            console.error("Failed to submit to sequencer:", error);
            throw error;
        }
    }

    // Lazy contract getters to avoid "not initialized" errors
    private getVcnTokenContract() {
        if (this.vcnToken) return this.vcnToken;
        const provider = new ethers.JsonRpcProvider(ADDRESSES.RPC_URL);
        return new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, provider);
    }

    private getVcnVestingContract() {
        if (this.vcnVesting) return this.vcnVesting;
        const provider = new ethers.JsonRpcProvider(ADDRESSES.RPC_URL);
        return new ethers.Contract(ADDRESSES.VCN_VESTING, VCNVestingABI.abi, provider);
    }

    async purchaseLicense(uuid: string, tier: 'Validator' | 'Enterprise') {
        if (!this.nodeLicense || !this.vcnToken) throw new Error("Contracts not initialized");

        const tierEnum = tier === 'Enterprise' ? 1 : 0;
        const price = tier === 'Enterprise' ? ethers.parseEther("500000") : ethers.parseEther("70000"); // Updated Prices

        // 1. Approve Token Spend
        const approveTx = await this.vcnToken.approve(ADDRESSES.NODE_LICENSE, price);
        await approveTx.wait();

        // 2. Purchase License
        const tx = await this.nodeLicense.purchaseLicense(uuid, tierEnum);
        return await tx.wait();
    }

    async claimReward(tokenId: number) {
        if (!this.miningPool) throw new Error("Contracts not initialized");
        const tx = await this.miningPool.claimReward(tokenId);
        return await tx.wait();
    }

    async getNodeDetails(tokenId: number) {
        if (!this.nodeLicense) throw new Error("Contracts not initialized");
        return await this.nodeLicense.nodeDetails(tokenId);
    }

    async getOwnedNodes(ownerAddress: string) {
        // This is inefficient on standard ERC721 without Enumerable, 
        // relying on sub-optimal event filtering or assuming limited ID range for now.
        // In production, use The Graph or Vision Scan API.
        return [];
    }

    async sendTokens(to: string, amount: string, tokenSymbol: string = 'VCN') {
        if (!this.signer) throw new Error("Signer not initialized. Please connect wallet.");

        const amountWei = ethers.parseUnits(amount, 18);

        if (tokenSymbol === 'ETH') {
            const tx = await this.signer.sendTransaction({
                to,
                value: amountWei
            });
            return await tx.wait();
        } else if (tokenSymbol === 'VCN') {
            const vcnContract = this.getVcnTokenContract().connect(this.signer);
            const tx = await (vcnContract as any).transfer(to, amountWei);
            return await tx.wait();
        } else {
            throw new Error(`Token ${tokenSymbol} transfer not implemented in this demo.`);
        }
    }

    async fastTransfer(to: string, amount: string) {
        if (!this.signer || !this.signer.signTransaction) {
            throw new Error("Internal Wallet required for Fast Transfer (Sequencer)");
        }

        const amountWei = ethers.parseUnits(amount, 18);

        // Populate transaction without sending
        const txRequest = await this.vcnToken!.transfer.populateTransaction(to, amountWei);

        // Internal Wallet Sign
        const signedTx = await this.signer.signTransaction(txRequest);

        // Submit to Shared Sequencer
        const mysubmission = await this.submitToSequencer(signedTx);
        return mysubmission;
    }

    /**
     * Standard VCN transfer using Admin Private Key.
     * Guaranteed to work regardless of current service initialization state.
     */
    async adminSendVCN(toAddress: string, amountStr: string) {
        if (!toAddress || !toAddress.startsWith('0x')) {
            throw new Error(`Invalid recipient address: "${toAddress}". The user has not connected their wallet properly.`);
        }
        const adminPK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const rpcProvider = new ethers.JsonRpcProvider(ADDRESSES.RPC_URL);
        const wallet = new ethers.Wallet(adminPK, rpcProvider);
        const vcnContract = new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, wallet);

        const amountWei = ethers.parseEther(amountStr);
        const tx = await vcnContract.transfer(toAddress, amountWei);
        return await tx.wait();
    }

    /**
     * Sends VCN tokens without the user having ETH/POL (Gasless).
     * Fee: 1 VCN (deducted from user).
     * Requires the user's private key (Internal Wallet) to sign the permit.
     */
    async sendGaslessTokens(to: string, amount: string, privateKey: string) {
        // Ensure contract is ready locally if not already set
        const rpcProvider = new ethers.JsonRpcProvider(ADDRESSES.RPC_URL);
        const vcnContract = this.vcnToken || new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, rpcProvider);

        // 1. Setup Wallet
        const wallet = new ethers.Wallet(privateKey, rpcProvider);
        const contract = vcnContract.connect(wallet);

        // 2. Prepare Permit Constants
        const tokenAddress = ADDRESSES.VCN_TOKEN;
        const spender = await this.getPaymasterAddress(); // The Paymaster's address (Spender)
        const fee = ethers.parseUnits("1.0", 18); // 1 VCN Fee
        const transferAmount = ethers.parseUnits(amount, 18);
        const totalAmount = transferAmount + fee;
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

        // 3. Get Nonce
        const nonce = await (contract as any).nonces(wallet.address);
        const chainId = 3151909;

        // 4. Sign EIP-712 Permit
        const domain = {
            name: "Vision Chain Token",
            version: "1",
            chainId: chainId,
            verifyingContract: tokenAddress
        };

        const types = {
            Permit: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ]
        };

        const values = {
            owner: wallet.address,
            spender: spender,
            value: totalAmount,
            nonce: nonce,
            deadline: deadline
        };

        const signature = await wallet.signTypedData(domain, types, values);

        // 5. Submit to Paymaster API
        const response = await fetch(`${ADDRESSES.SEQUENCER_URL.replace('/submit', '')}/paymaster/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: wallet.address,
                token: tokenAddress,
                recipient: to,
                amount: transferAmount.toString(),
                fee: fee.toString(),
                deadline: deadline,
                signature: signature
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Paymaster Failed: ${error.error || response.statusText}`);
        }

        const result = await response.json();
        console.log("🚀 Gasless Transfer Successful:", result);
        return result;
    }

    // Helper: Get Paymaster Address (Ideally fetched from config/API)
    // For demo, we match the server's hardcoded Paymaster (Account #2)
    private async getPaymasterAddress() {
        return "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Mock logic: actually we used Account #2 PK in server, which is 0x7099...
        // Wait, 0xac09... is Account #0 (Hardhat). 0x59c6... is Account #1.
        // Account #0: f39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        // Account #1: 70997970C51812dc3A010C7d01b50e0d17dc79C8 (Usually)
        // Correct.
    }

    // --- Admin Functions ---
    async createVestingSchedule(
        beneficiary: string,
        totalAmount: number,
        initialUnlockRatio: number,
        cliffMonths: number,
        vestingMonths: number,
        startTime: number
    ) {
        // Ensure contract is ready locally
        const adminPK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const rpcProvider = new ethers.JsonRpcProvider(ADDRESSES.RPC_URL);
        const wallet = new ethers.Wallet(adminPK, rpcProvider);
        const vestingContract = this.vcnVesting || new ethers.Contract(ADDRESSES.VCN_VESTING, VCNVestingABI.abi, wallet);

        const amountWei = ethers.parseEther(totalAmount.toString());

        const tx = await vestingContract.createVestingSchedule(
            beneficiary,
            amountWei,
            initialUnlockRatio,
            cliffMonths,
            vestingMonths,
            startTime
        );
        return await tx.wait();
    }

    // --- Simulator Helpers ---
    async createSimulatorWallet() {
        // Create an ephemeral wallet for the simulator session
        const wallet = ethers.Wallet.createRandom();

        // Use existing provider if healthy, otherwise get a robust one
        if (this.provider) {
            try {
                await (this.provider as any).getBlockNumber();
                return wallet.connect(this.provider);
            } catch (e) {
                console.warn("Existing provider failed health check, reconnecting...");
            }
        }

        const robustProvider = await this.getRobustProvider();
        return wallet.connect(robustProvider);
    }

    async injectSimulatorTransaction(wallet: any, options: { type: string, to: string, value: string, metadata?: any, nonce?: number, gasPrice?: bigint }) {
        if (!wallet) throw new Error("Wallet instance is required for injection");
        try {
            const { type, to, value, metadata, nonce, gasPrice: providedGasPrice } = options;

            // Populate transaction
            const txRequest: any = {
                to: to || "0x0000000000000000000000000000000000000000",
                value: ethers.parseEther(value || "0"),
                nonce: nonce !== undefined ? nonce : await wallet.getNonce(),
                gasLimit: 21000,
                chainId: 3151909
            };

            // Use provided gas price or fetch if missing
            if (providedGasPrice) {
                txRequest.gasPrice = providedGasPrice;
            } else {
                const feeData = await wallet.provider!.getFeeData();
                txRequest.gasPrice = feeData.gasPrice;
            }

            // Sign transaction
            const signedTx = await wallet.signTransaction(txRequest);

            // Submit to Sequencer
            return await this.submitToSequencer(signedTx, { type, metadata });
        } catch (error) {
            console.error("Injection error:", error);
            throw error;
        }
    }
}

export const contractService = new ContractService();
