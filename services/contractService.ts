import { ethers, BrowserProvider, Contract } from 'ethers';
import NodeLicenseABI from './abi/VisionNodeLicense.json';
import MiningPoolABI from './abi/VisionMiningPool.json';
import VCNTokenABI from './abi/VCNToken.json';
import VCNVestingABI from './abi/VCNVesting.json';

const ADDRESSES = {
    // Vision Chain Custom Testnet v1 (Chain ID: 3151909)
    VCN_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    NODE_LICENSE: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    MINING_POOL: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    VCN_VESTING: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",

    // Legacy / Other
    VCNVesting: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
};

export class ContractService {
    private provider: BrowserProvider | null = null;
    private signer: any = null;

    // Contracts
    public nodeLicense: Contract | null = null;
    public miningPool: Contract | null = null;
    public vcnToken: Contract | null = null;
    public vcnVesting: Contract | null = null;

    constructor() { }

    async connectWallet(): Promise<string> {
        if (!(window as any).ethereum) {
            throw new Error("No crypto wallet found. Please install MetaMask.");
        }

        this.provider = new BrowserProvider((window as any).ethereum);
        this.signer = await this.provider.getSigner();
        const address = await this.signer.getAddress();

        // Initialize Contracts
        this.nodeLicense = new ethers.Contract(ADDRESSES.NODE_LICENSE, NodeLicenseABI.abi, this.signer);
        this.miningPool = new ethers.Contract(ADDRESSES.MINING_POOL, MiningPoolABI.abi, this.signer);
        this.vcnToken = new ethers.Contract(ADDRESSES.VCN_TOKEN, VCNTokenABI.abi, this.signer);
        this.vcnVesting = new ethers.Contract(ADDRESSES.VCN_VESTING, VCNVestingABI.abi, this.signer);

        return address;
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
