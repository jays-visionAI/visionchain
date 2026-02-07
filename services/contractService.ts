import { ethers, BrowserProvider, Contract } from 'ethers';
import NodeLicenseABI from './abi/VisionNodeLicense.json';
import MiningPoolABI from './abi/VisionMiningPool.json';
import VCNTokenABI from './abi/VCNToken.json';
import VCNVestingABI from './abi/VCNVesting.json';
import VisionEqualizerABI from './abi/VisionEqualizer.json';
import VisionVaultABI from './abi/VisionVault.json';
import { getFirebaseDb } from './firebaseService';
import { doc, setDoc } from 'firebase/firestore';

const ADDRESSES = {
    // Vision Chain v2 - Chain ID: 3151909
    // VCN is now an ERC-20 token deployed on Vision Chain v2

    // Core Contracts (Vision Chain v2) - Deployed 2026-02-06
    VCN_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // VCN ERC-20 Token
    VCN_PAYMASTER: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // VCNPaymasterNative
    PAYMASTER_ADMIN: "0x08A1B183a53a0f8f1D875945D504272738E3AF34", // Production executor wallet for gasless transfers
    BRIDGE_STAKING: "0xc351628EB244ec633d5f21fBD6621e1a683B1181", // BridgeStaking (12% APY)

    // Legacy Core Contracts (old chain)
    VCN_VESTING: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    NODE_LICENSE: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    MINING_POOL: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    VISION_BRIDGE: "0x0165878A594ca255338adfa4d48449f69242Eb8F",

    // Secure Bridge (Phase 1 - Optimistic Security)
    INTENT_COMMITMENT: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
    MESSAGE_INBOX: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
    VISION_BRIDGE_SECURE: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",

    // Sepolia Contracts
    VCN_TOKEN_SEPOLIA: "0xC068eD2b45DbD3894A72F0e4985DF8ba1299AB0f",

    // Legacy (kept for compatibility)
    TIME_LOCK_AGENT: "0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb",
    TIME_LOCK_AGENT_MOCK: "0x5FbDB2315678afecb367f032d93F642f64180aa3",

    // V2 Security Core
    VISION_EQUALIZER: "0x0000000000000000000000000000000000000000", // Pending
    VISION_PROFILE_REGISTRY: "0x0000000000000000000000000000000000000000", // Pending

    // Vision Chain RPC Resource Pool (High Availability)
    RPC_NODES: [
        "https://api.visionchain.co/rpc-proxy", // Resilient Proxy (Primary)
        "https://rpc.visionchain.co",           // Primary Domain
        "https://api.visionchain.co/rpc",       // Direct Node (Load Balanced)
        "https://api.visionchain.co",           // Root API
        "http://127.0.0.1:8545"                 // Local Hardhat Node (Fallback)
    ],
    RPC_URL: "https://api.visionchain.co/rpc-proxy",
    SEQUENCER_URL: "https://api.visionchain.co/rpc/submit",
    // Paymaster API (Unified - Cloud Functions Gen 2 / Cloud Run)
    // Single endpoint supports: type='transfer', type='timelock', type='batch'
    PAYMASTER_URL: "https://paymaster-sapjcm3s5a-uc.a.run.app",

    // Interoperability (Equalizer Model)
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
    public vcnPaymaster: Contract | null = null;

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

    isWalletConnected(): boolean {
        return !!this.signer;
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
        const errors: string[] = [];

        for (const rpcUrl of ADDRESSES.RPC_NODES) {
            try {
                // Skip HTTP if we are on HTTPS to avoid Mixed Content errors
                if (window.location.protocol === 'https:' && rpcUrl.startsWith('http:')) {
                    errors.push(`${rpcUrl}: Skipped (Mixed Content)`);
                    continue;
                }

                const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
                    staticNetwork: true // Speed up by skipping detectNetwork if we know the chain
                });

                // Health check with 8s timeout (increased for mobile networks)
                await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
                ]);

                console.log(`[Success] Connected to RPC: ${rpcUrl}`);
                return provider;
            } catch (e: any) {
                const errorMsg = e.message || 'Unknown error';
                errors.push(`${rpcUrl}: ${errorMsg}`);
                console.warn(`[Failed] RPC Node Failed: ${rpcUrl}. Error: ${errorMsg}`);
            }
        }

        // If all nodes failed, provide detailed error
        console.error('[RPC] All nodes failed:', errors);
        throw new Error(`Unable to connect to blockchain. Please check your internet connection and try again.\n\nTried ${errors.length} node(s).`);
    }

    /**
     * Checks all configured nodes and returns health statistics.
     */
    async getNodeStatus() {
        const results = await Promise.all(ADDRESSES.RPC_NODES.map(async (url) => {
            try {
                // Skip HTTP if on HTTPS
                if (window.location.protocol === 'https:' && url.startsWith('http:')) {
                    return { url, active: false, status: 'BLOCKED_BY_CORS' };
                }

                const provider = new ethers.JsonRpcProvider(url, undefined, { staticNetwork: true });
                const block = await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]) as number;

                return { url, active: true, block, status: 'HEALTHY' };
            } catch (e) {
                return { url, active: false, status: 'DOWN' };
            }
        }));

        return {
            total: ADDRESSES.RPC_NODES.length,
            active: results.filter(r => r.active).length,
            nodes: results
        };
    }

    async getNativeBalance(address: string): Promise<string> {
        const provider = await this.getRobustProvider();
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    }

    async getTokenBalance(address: string, tokenAddress: string = ADDRESSES.VCN_TOKEN): Promise<string> {
        // VCN is now ERC-20 token on Vision Chain v2
        // Only return native balance for zero address
        if (tokenAddress === "0x0000000000000000000000000000000000000000") {
            return this.getNativeBalance(address);
        }

        const provider = await this.getRobustProvider();
        const abi = ["function balance(address account) view returns (uint256)", "function balanceOf(address account) view returns (uint256)"];
        const contract = new ethers.Contract(tokenAddress, abi, provider);
        try {
            // Try balanceOf first
            const balance = await contract.balanceOf(address);
            return ethers.formatUnits(balance, 18);
        } catch (e) {
            try {
                // Fallback to balance()
                const balance = await contract.balance(address);
                return ethers.formatUnits(balance, 18);
            } catch (e2) {
                console.error("Failed to fetch token balance:", e2);
                return "0";
            }
        }
    }


    private initializeContracts(signerOrProvider: any) {
        this.nodeLicense = new ethers.Contract(ADDRESSES.NODE_LICENSE, NodeLicenseABI.abi, signerOrProvider);
        this.miningPool = new ethers.Contract(ADDRESSES.MINING_POOL, MiningPoolABI.abi, signerOrProvider);
        this.vcnToken = new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, signerOrProvider);
        this.vcnVesting = new ethers.Contract(ADDRESSES.VCN_VESTING, VCNVestingABI.abi, signerOrProvider);

        // Interop Contracts
        this.visionEqualizer = new ethers.Contract(ADDRESSES.VISION_EQUALIZER, VisionEqualizerABI.abi, signerOrProvider);
        this.visionVault = new ethers.Contract(ADDRESSES.VISION_VAULT_SEPOLIA_MOCK, VisionVaultABI.abi, signerOrProvider);

        // MPC Paymaster (V2)
        // Using basic ABI for now as full ABI might not be in the frontend yet
        const minimalPaymasterABI = [
            "function validatePaymasterOp(bytes32 opHash, address user, address target, uint256 amount, uint256 validUntil, bytes calldata signature) external"
        ];
        this.vcnPaymaster = new ethers.Contract(ADDRESSES.VCN_PAYMASTER, minimalPaymasterABI, signerOrProvider);
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

    private async getVcnVestingContract() {
        if (this.vcnVesting) return this.vcnVesting;
        const provider = await this.getRobustProvider();
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
        const fromAddress = await this.signer.getAddress();

        if (tokenSymbol === 'ETH') {
            const tx = await this.signer.sendTransaction({
                to,
                value: amountWei
            });
            const receipt = await tx.wait();

            // Index ETH transfer to Firestore
            try {
                const db = getFirebaseDb();
                await setDoc(doc(db, 'transactions', tx.hash), {
                    hash: tx.hash,
                    chainId: 3151909,
                    type: 'Transfer',
                    from_addr: fromAddress.toLowerCase(),
                    to_addr: to.toLowerCase(),
                    value: amount,
                    timestamp: Date.now(),
                    status: 'indexed',
                    metadata: { method: 'ETH Transfer', source: 'user_wallet' }
                });
            } catch (e) { console.warn('[Indexing] ETH transfer indexing failed:', e); }

            return receipt;
        } else if (tokenSymbol === 'VCN') {
            const vcnContract = this.getVcnTokenContract().connect(this.signer);
            const tx = await (vcnContract as any).transfer(to, amountWei);
            const receipt = await tx.wait();

            // Index VCN transfer to Firestore
            try {
                const db = getFirebaseDb();
                await setDoc(doc(db, 'transactions', tx.hash), {
                    hash: tx.hash,
                    chainId: 3151909,
                    type: 'Transfer',
                    from_addr: fromAddress.toLowerCase(),
                    to_addr: to.toLowerCase(),
                    value: amount,
                    timestamp: Date.now(),
                    status: 'indexed',
                    metadata: { method: 'VCN Token Transfer', source: 'user_wallet' }
                });
            } catch (e) { console.warn('[Indexing] VCN transfer indexing failed:', e); }

            return receipt;
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
     * Native VCN transfer using Admin Private Key.
     * Sends VCN Token (ERC-20) to the specified address.
     * Note: This sends VCN Token, not Native VCN.
     */
    async adminSendVCN(toAddress: string, amountStr: string) {
        if (!toAddress || !toAddress.startsWith('0x')) {
            throw new Error(`Invalid recipient address: "${toAddress}". The user has not connected their wallet properly.`);
        }

        const adminPK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const rpcProvider = await this.getRobustProvider();
        const wallet = new ethers.Wallet(adminPK, rpcProvider);
        const adminAddress = await wallet.getAddress();

        // VCN Token Transfer (ERC-20)
        const vcnToken = new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, wallet);
        const amountWei = ethers.parseEther(amountStr);

        const tx = await vcnToken.transfer(toAddress, amountWei);
        console.log(`[Admin] VCN Token Transfer sent: ${tx.hash}`);

        const receipt = await tx.wait();

        // Index transaction directly to Firestore for VisionScan visibility
        // Using client-side Firebase SDK (same project as client)
        try {
            const db = getFirebaseDb();
            await setDoc(doc(db, 'transactions', tx.hash), {
                hash: tx.hash,
                chainId: 3151909,
                type: 'Transfer',
                from_addr: adminAddress.toLowerCase(),
                to_addr: toAddress.toLowerCase(),
                value: amountStr,
                timestamp: Date.now(),
                status: 'indexed',
                metadata: {
                    method: 'Admin VCN Token Transfer',
                    counterparty: toAddress.slice(0, 10) + '...',
                    confidence: 100,
                    trustStatus: 'verified',
                    source: 'admin_panel'
                }
            });
            console.log(`[Admin] Transaction indexed to Firestore: ${tx.hash}`);
        } catch (indexErr) {
            console.warn('[Admin] Transaction indexing failed (non-critical):', indexErr);
        }

        return receipt;
    }

    /**
     * Sends VCN tokens without the user having ETH/POL (Gasless).
     * Fee: 1 VCN (deducted from user).
     * Requires the user's private key (Internal Wallet) to sign the permit.
     */
    /**
     * Sends VCN tokens without the user having ETH/POL (Gasless).
     * Fee: 1 VCN (deducted from user).
     * Uses currently connected signer (Internal or MetaMask) to sign Permit.
     */
    async sendGaslessTokens(to: string, amount: string) {
        if (!this.signer) throw new Error("Wallet not connected");

        // Ensure contract is ready locally if not already set
        const rpcProvider = new ethers.JsonRpcProvider(ADDRESSES.RPC_URL);
        const vcnContract = this.vcnToken || new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, rpcProvider);

        // 1. Get Wallet/Signer Address
        const userAddress = await this.signer.getAddress();
        const contract = vcnContract.connect(this.signer);

        // 2. Prepare Permit Constants
        const tokenAddress = ADDRESSES.VCN_TOKEN;
        const spender = await this.getPaymasterAddress();
        const fee = ethers.parseUnits("1.0", 18); // 1 VCN Fee
        const transferAmount = ethers.parseUnits(amount, 18);
        const totalAmount = transferAmount + fee;
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

        // 3. Get Nonce
        const nonce = await (contract as any).nonces(userAddress);
        const chainId = 3151909; // Vision Chain v2

        // 4. Sign EIP-712 Permit
        // Dynamic name fetching to match on-chain value exactly
        const tokenName = await (contract as any).name();

        const domain = {
            name: tokenName,
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
            owner: userAddress,
            spender: spender,
            value: totalAmount,
            nonce: nonce,
            deadline: deadline
        };

        const signature = await this.signer.signTypedData(domain, types, values);

        // 5. Submit to Unified Paymaster API (Cloud Function)
        const response = await fetch(ADDRESSES.PAYMASTER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'transfer', // Unified Paymaster - immediate transfer
                user: userAddress,
                token: tokenAddress,
                recipient: to,
                amount: transferAmount.toString(),
                fee: fee.toString(),
                deadline: deadline,
                signature: signature
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Paymaster Failed: ${error.error || response.statusText}`);
        }

        const result = await response.json();
        console.log("Gasless Transfer Successful:", result);

        // Index gasless transfer to Firestore
        try {
            const db = getFirebaseDb();
            await setDoc(doc(db, 'transactions', result.txHash || `gasless-${Date.now()}`), {
                hash: result.txHash || `gasless-${Date.now()}`,
                chainId: 3151909,
                type: 'Transfer',
                from_addr: userAddress.toLowerCase(),
                to_addr: to.toLowerCase(),
                value: amount,
                timestamp: Date.now(),
                status: 'indexed',
                metadata: { method: 'Gasless Transfer', source: 'user_wallet', fee: '1.0' }
            });
        } catch (e) { console.warn('[Indexing] Gasless transfer indexing failed:', e); }

        return result;
    }

    // Helper: Returns the deployed VCNPaymasterV2 address
    private async getPaymasterAddress() {
        // Return Admin wallet address for permit signing (not the contract address)
        return ADDRESSES.PAYMASTER_ADMIN;
    }

    async getPaymasterBalance(): Promise<string> {
        const provider = await this.getRobustProvider();
        const balance = await provider.getBalance(ADDRESSES.VCN_PAYMASTER);
        return ethers.formatEther(balance);
    }

    // ============================================
    // GAS ESTIMATION FUNCTIONS
    // ============================================

    /**
     * Estimates gas for a VCN transfer
     */
    async estimateTransferGas(to: string, amount: string): Promise<{
        gasLimit: bigint;
        gasPrice: bigint;
        totalCostVCN: string;
        serviceFee: string;
        totalFee: string;
    }> {
        const provider = await this.getRobustProvider();
        const vcnContract = new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, provider);
        const amountWei = ethers.parseUnits(amount, 18);

        try {
            // Estimate gas using admin address as sender (for simulation)
            const gasLimit = await provider.estimateGas({
                to: ADDRESSES.VCN_TOKEN,
                data: vcnContract.interface.encodeFunctionData('transfer', [to, amountWei]),
                from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" // Admin for estimation
            });

            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");

            const gasCostWei = gasLimit * gasPrice;
            const totalCostVCN = ethers.formatEther(gasCostWei);
            const serviceFee = "1.0"; // Fixed 1 VCN service fee
            const totalFee = (parseFloat(totalCostVCN) + parseFloat(serviceFee)).toFixed(4);

            return { gasLimit, gasPrice, totalCostVCN, serviceFee, totalFee };
        } catch (error) {
            console.warn("Gas estimation failed, using fallback:", error);
            return {
                gasLimit: BigInt(100000),
                gasPrice: ethers.parseUnits("1", "gwei"),
                totalCostVCN: "0.0001",
                serviceFee: "1.0",
                totalFee: "1.0001"
            };
        }
    }

    /**
     * Estimates gas for a Time-lock schedule transaction
     */
    async estimateTimeLockGas(recipient: string, amount: string, delaySeconds: number): Promise<{
        gasLimit: bigint;
        gasPrice: bigint;
        totalCostVCN: string;
        serviceFee: string;
        totalFee: string;
    }> {
        const provider = await this.getRobustProvider();
        const timelockAddress = ADDRESSES.TIME_LOCK_AGENT;
        const abi = ["function scheduleTransferNative(address to, uint256 unlockTime) external payable returns (uint256)"];
        const contract = new ethers.Contract(timelockAddress, abi, provider);

        const amountWei = ethers.parseEther(amount);
        const unlockTime = Math.floor(Date.now() / 1000) + delaySeconds;

        try {
            const gasLimit = await provider.estimateGas({
                to: timelockAddress,
                data: contract.interface.encodeFunctionData('scheduleTransferNative', [recipient, unlockTime]),
                value: amountWei,
                from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" // Admin for estimation
            });

            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");

            const gasCostWei = gasLimit * gasPrice;
            const totalCostVCN = ethers.formatEther(gasCostWei);
            const serviceFee = "1.0"; // Fixed 1 VCN service fee
            const totalFee = (parseFloat(totalCostVCN) + parseFloat(serviceFee)).toFixed(4);

            return { gasLimit, gasPrice, totalCostVCN, serviceFee, totalFee };
        } catch (error) {
            console.warn("TimeLock gas estimation failed, using fallback:", error);
            return {
                gasLimit: BigInt(150000),
                gasPrice: ethers.parseUnits("1", "gwei"),
                totalCostVCN: "0.00015",
                serviceFee: "1.0",
                totalFee: "1.00015"
            };
        }
    }

    /**
     * Estimates gas for a batch of transactions
     */
    async estimateBatchGas(transactions: Array<{ recipient: string; amount: string }>): Promise<{
        perTxGas: string;
        totalGasVCN: string;
        serviceFee: string;
        totalFee: string;
        breakdown: Array<{ recipient: string; amount: string; estimatedGas: string }>;
    }> {
        const provider = await this.getRobustProvider();
        const vcnContract = new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, provider);
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");

        let totalGasLimit = BigInt(0);
        const breakdown: Array<{ recipient: string; amount: string; estimatedGas: string }> = [];

        for (const tx of transactions) {
            try {
                const amountWei = ethers.parseUnits(tx.amount, 18);
                const gasLimit = await provider.estimateGas({
                    to: ADDRESSES.VCN_TOKEN,
                    data: vcnContract.interface.encodeFunctionData('transfer', [tx.recipient, amountWei]),
                    from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
                });
                totalGasLimit += gasLimit;
                breakdown.push({
                    recipient: tx.recipient,
                    amount: tx.amount,
                    estimatedGas: ethers.formatEther(gasLimit * gasPrice)
                });
            } catch (error) {
                // Use fallback for failed estimates
                totalGasLimit += BigInt(100000);
                breakdown.push({
                    recipient: tx.recipient,
                    amount: tx.amount,
                    estimatedGas: "0.0001"
                });
            }
        }

        const totalGasVCN = ethers.formatEther(totalGasLimit * gasPrice);
        const perTxGas = (parseFloat(totalGasVCN) / transactions.length).toFixed(6);
        const serviceFee = (transactions.length * 0.5).toFixed(1); // 0.5 VCN per tx in batch
        const totalFee = (parseFloat(totalGasVCN) + parseFloat(serviceFee)).toFixed(4);

        return { perTxGas, totalGasVCN, serviceFee, totalFee, breakdown };
    }

    // ============================================
    // GASLESS PAYMASTER FUNCTIONS
    // ============================================

    /**
     * Gasless Time-lock scheduling via Paymaster
     * The admin wallet pays gas, user pays service fee in VCN
     */
    async scheduleTimeLockGasless(
        recipient: string,
        amount: string,
        delaySeconds: number,
        userEmail?: string
    ): Promise<{ receipt: any; scheduleId: string; txHash: string }> {
        if (!this.signer) throw new Error("Wallet not connected");

        const userAddress = await this.signer.getAddress();
        const amountWei = ethers.parseEther(amount);
        const unlockTime = Math.floor(Date.now() / 1000) + delaySeconds;

        // 1. Estimate gas and calculate fee
        const gasEstimate = await this.estimateTimeLockGas(recipient, amount, delaySeconds);
        const totalFeeWei = ethers.parseUnits(gasEstimate.totalFee, 18);
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // 2. Sign EIP-712 Permit for fee collection
        const rpcProvider = new ethers.JsonRpcProvider(ADDRESSES.RPC_URL);
        const vcnContract = this.vcnToken || new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, rpcProvider);
        const contract = vcnContract.connect(this.signer);

        const tokenName = await (contract as any).name();
        const nonce = await (contract as any).nonces(userAddress);

        const domain = {
            name: tokenName,
            version: "1",
            chainId: 3151909,
            verifyingContract: ADDRESSES.VCN_TOKEN
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
            owner: userAddress,
            spender: ADDRESSES.VCN_PAYMASTER,
            value: totalFeeWei,
            nonce: nonce,
            deadline: deadline
        };

        const signature = await this.signer.signTypedData(domain, types, values);

        // 3. Submit to Unified Paymaster API (Cloud Run)
        const response = await fetch(ADDRESSES.PAYMASTER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'timelock', // Unified Paymaster - scheduled transfer
                user: userAddress,
                recipient,
                amount: amountWei.toString(),
                unlockTime,
                fee: totalFeeWei.toString(),
                deadline,
                signature,
                userEmail: userEmail || null,
                senderAddress: userAddress,
                gasEstimate: {
                    gasLimit: gasEstimate.gasLimit.toString(),
                    gasPrice: gasEstimate.gasPrice.toString()
                }
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`TimeLock Paymaster Failed: ${error.error || response.statusText}`);
        }

        const result = await response.json();
        console.log("Gasless TimeLock Scheduled:", result);
        return result;
    }

    /**
     * Gasless Batch transfer via Paymaster
     * Executes multiple transfers with admin paying gas
     */
    async sendBatchGasless(
        transactions: Array<{ recipient: string; amount: string; name?: string }>
    ): Promise<{ results: Array<{ recipient: string; status: string; txHash?: string }>; totalFee: string }> {
        if (!this.signer) throw new Error("Wallet not connected");

        const userAddress = await this.signer.getAddress();

        // 1. Estimate total gas
        const gasEstimate = await this.estimateBatchGas(transactions);
        const totalFeeWei = ethers.parseUnits(gasEstimate.totalFee, 18);
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // 2. Sign EIP-712 Permit for fee collection
        const rpcProvider = new ethers.JsonRpcProvider(ADDRESSES.RPC_URL);
        const vcnContract = this.vcnToken || new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, rpcProvider);
        const contract = vcnContract.connect(this.signer);

        const tokenName = await (contract as any).name();
        const nonce = await (contract as any).nonces(userAddress);

        const domain = {
            name: tokenName,
            version: "1",
            chainId: 3151909,
            verifyingContract: ADDRESSES.VCN_TOKEN
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
            owner: userAddress,
            spender: ADDRESSES.VCN_PAYMASTER,
            value: totalFeeWei,
            nonce: nonce,
            deadline: deadline
        };

        const signature = await this.signer.signTypedData(domain, types, values);

        // 3. Calculate total transfer amount
        const totalTransferAmount = transactions.reduce((sum, tx) => {
            return sum + ethers.parseUnits(tx.amount, 18);
        }, BigInt(0));

        // 4. Submit to Paymaster API
        const response = await fetch(`${ADDRESSES.SEQUENCER_URL.replace('/submit', '')}/paymaster/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: userAddress,
                transactions: transactions.map(tx => ({
                    recipient: tx.recipient,
                    amount: ethers.parseUnits(tx.amount, 18).toString(),
                    name: tx.name
                })),
                totalTransferAmount: totalTransferAmount.toString(),
                fee: totalFeeWei.toString(),
                deadline,
                signature,
                gasEstimate: {
                    totalGas: gasEstimate.totalGasVCN,
                    breakdown: gasEstimate.breakdown
                }
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Batch Paymaster Failed: ${error.error || response.statusText}`);
        }

        const result = await response.json();
        console.log("Gasless Batch Transfer Complete:", result);
        return result;
    }

    /**
     * Gets fee quote for any transfer type
     */
    async getFeeQuote(type: 'single' | 'timelock' | 'batch', params: {
        amount?: string;
        recipient?: string;
        delaySeconds?: number;
        transactions?: Array<{ recipient: string; amount: string }>;
    }): Promise<{
        type: string;
        gasCostVCN: string;
        serviceFee: string;
        totalFee: string;
        breakdown?: any;
    }> {
        switch (type) {
            case 'single': {
                const estimate = await this.estimateTransferGas(
                    params.recipient || ethers.ZeroAddress,
                    params.amount || "1"
                );
                return {
                    type: 'single',
                    gasCostVCN: estimate.totalCostVCN,
                    serviceFee: estimate.serviceFee,
                    totalFee: estimate.totalFee
                };
            }
            case 'timelock': {
                const estimate = await this.estimateTimeLockGas(
                    params.recipient || ethers.ZeroAddress,
                    params.amount || "1",
                    params.delaySeconds || 60
                );
                return {
                    type: 'timelock',
                    gasCostVCN: estimate.totalCostVCN,
                    serviceFee: estimate.serviceFee,
                    totalFee: estimate.totalFee
                };
            }
            case 'batch': {
                const estimate = await this.estimateBatchGas(
                    params.transactions || []
                );
                return {
                    type: 'batch',
                    gasCostVCN: estimate.totalGasVCN,
                    serviceFee: estimate.serviceFee,
                    totalFee: estimate.totalFee,
                    breakdown: estimate.breakdown
                };
            }
            default:
                throw new Error(`Unknown transfer type: ${type}`);
        }
    }

    // --- TimeLock Agent Functions ---
    async scheduleTransferNative(recipient: string, amount: string, delaySeconds: number) {
        if (!this.signer) throw new Error("Wallet not connected");

        const timelockAddress = ADDRESSES.TIME_LOCK_AGENT;
        const abi = [
            "function scheduleTransferNative(address to, uint256 unlockTime) external payable returns (uint256)",
            "event TransferScheduled(uint256 indexed scheduleId, address indexed creator, address indexed to, uint256 amount, uint256 unlockTime)"
        ];
        const contract = new ethers.Contract(timelockAddress, abi, this.signer);
        const amountWei = ethers.parseEther(amount);
        const unlockTime = Math.floor(Date.now() / 1000) + delaySeconds;

        const tx = await contract.scheduleTransferNative(recipient, unlockTime, { value: amountWei });
        const receipt = await tx.wait();

        // Parse logs to find the TransferScheduled event
        let scheduleId = null;
        if (receipt && receipt.logs) {
            for (const log of (receipt as any).logs) {
                try {
                    const parsed = contract.interface.parseLog(log);
                    if (parsed?.name === 'TransferScheduled') {
                        scheduleId = parsed.args.scheduleId.toString();
                        break;
                    }
                } catch (e) {
                    // Not our event
                }
            }
        }

        return { receipt, scheduleId };
    }

    async cancelScheduledTransfer(scheduleId: string) {
        if (!this.signer) throw new Error("Wallet not connected");

        const timelockAddress = ADDRESSES.TIME_LOCK_AGENT;
        const abi = ["function cancelTransfer(uint256 scheduleId) external"];
        const contract = new ethers.Contract(timelockAddress, abi, this.signer);

        const tx = await contract.cancelTransfer(scheduleId);
        return await tx.wait();
    }
    async executeScheduledTransfer(scheduleId: string) {
        if (!this.signer) throw new Error("Wallet not connected");

        const timelockAddress = ADDRESSES.TIME_LOCK_AGENT;
        const abi = ["function executeTransfer(uint256 scheduleId) external"];
        const contract = new ethers.Contract(timelockAddress, abi, this.signer);

        const tx = await contract.executeTransfer(scheduleId);
        return await tx.wait();
    }

    async executeBatchJobs(scheduleIds: string[]) {
        if (!this.signer) throw new Error("Wallet not connected");

        const timelockAddress = ADDRESSES.TIME_LOCK_AGENT;
        const abi = ["function executeBatch(uint256[] calldata scheduleIds) external"];
        const contract = new ethers.Contract(timelockAddress, abi, this.signer);

        const tx = await contract.executeBatch(scheduleIds);
        return await tx.wait();
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
        const rpcProvider = await this.getRobustProvider();
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
