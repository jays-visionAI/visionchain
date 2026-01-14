import { ethers, BrowserProvider, Contract } from 'ethers';
import NodeLicenseABI from './abi/VisionNodeLicense.json';
import MiningPoolABI from './abi/VisionMiningPool.json';
import VCNTokenABI from './abi/VCNToken.json';
import VCNVestingABI from './abi/VCNVesting.json';
import VisionEqualizerABI from './abi/VisionEqualizer.json';
import VisionVaultABI from './abi/VisionVault.json';

const ADDRESSES = {
    // Vision Chain Custom Testnet v1 (Chain ID: 3151909)
    VCN_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    NODE_LICENSE: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    MINING_POOL: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    VCN_VESTING: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",

    // Legacy / Other
    // Vision Chain RPC Endpoint
    RPC_URL: "http://46.224.221.201:8545", // Custom Testnet v1
    LOCAL_RPC: "http://46.224.221.201:8545",
    SEQUENCER_URL: "http://46.224.221.201:3000/rpc/submit",

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
            // Use local RPC if possible, otherwise public testnet
            const rpcUrl = ADDRESSES.LOCAL_RPC;
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            // Validate connection
            try {
                await provider.getNetwork();
                this.provider = provider;
            } catch (e) {
                console.warn("Local RPC failed, falling back to public testnet");
                this.provider = new ethers.JsonRpcProvider(ADDRESSES.RPC_URL);
            }

            this.signer = new ethers.Wallet(privateKey, this.provider);
            const address = await this.signer.getAddress();

            this.initializeContracts(this.signer);

            return address;
        } catch (error) {
            console.error("Failed to connect internal wallet:", error);
            throw error;
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

    async submitToSequencer(signedTx: string, chainId: number = 3151909) {
        try {
            const response = await fetch(ADDRESSES.SEQUENCER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chainId,
                    signedTx,
                    type: 'evm'
                }),
            });

            if (!response.ok) {
                throw new Error(`Sequencer Error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("🚀 Submitted to Sequencer:", data);
            return data;
        } catch (error) {
            console.error("Failed to submit to sequencer:", error);
            throw error;
        }
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
        if (!this.signer) throw new Error("Signer not initialized");

        const amountWei = ethers.parseUnits(amount, 18); // Default to 18 decimals

        if (tokenSymbol === 'ETH') {
            const tx = await this.signer.sendTransaction({
                to,
                value: amountWei
            });
            return await tx.wait();
        } else if (tokenSymbol === 'VCN') {
            if (!this.vcnToken) throw new Error("VCN Token contract not initialized");
            const tx = await this.vcnToken.transfer(to, amountWei);
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

    // --- Admin Functions ---
    async createVestingSchedule(
        beneficiary: string,
        totalAmount: number,
        initialUnlockRatio: number,
        cliffMonths: number,
        vestingMonths: number,
        startTime: number
    ) {
        if (!this.vcnVesting) throw new Error("Contracts not initialized");

        const amountWei = ethers.parseEther(totalAmount.toString());

        const tx = await this.vcnVesting.createVestingSchedule(
            beneficiary,
            amountWei,
            initialUnlockRatio,
            cliffMonths,
            vestingMonths,
            startTime
        );
        return await tx.wait();
    }
}

export const contractService = new ContractService();
