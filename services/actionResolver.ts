import { contractService } from './contractService';
import { UserIntent } from './intentParserService';
import { ethers } from 'ethers';
import { resolveRecipient } from './firebaseService';

export interface ProposedAction {
    type: 'TRANSACTION' | 'MESSAGE' | 'ERROR';
    summary: string;
    data?: any; // Populated Transaction or arbitrary data
    visualization?: {
        type: 'TRANSFER' | 'BRIDGE' | 'SWAP' | 'SCHEDULE';
        asset: string;
        amount: string;
        fromChain?: string;
        toChain?: string;
        recipient?: string;
        scheduleTime?: string;
    };
}

export class ActionResolverService {

    TIMELOCK_ADDRESS = "0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb";
    TIMELOCK_ABI = [
        "function scheduleTransferNative(address to, uint256 unlockTime) external payable returns (uint256)"
    ];

    constructor() { }

    /**
     * Resolves a parsed UserIntent into a concrete Action.
     */
    async resolve(intent: UserIntent, userAddress: string, userEmail?: string): Promise<ProposedAction> {
        try {
            switch (intent.action) {
                case 'TRANSFER':
                    return this.resolveTransfer(intent, userAddress, userEmail);
                case 'BRIDGE':
                    return this.resolveBridge(intent, userAddress);
                case 'SWAP_AND_SEND':
                    return this.resolveSwapAndSend(intent, userAddress);
                case 'SCHEDULE_TRANSFER':
                    return this.resolveScheduledTransfer(intent, userAddress, userEmail);
                case 'UNKNOWN':
                    return {
                        type: 'MESSAGE',
                        summary: intent.explanation
                    };
                default:
                    return {
                        type: 'ERROR',
                        summary: `Unsupported action type: ${intent.action}`
                    };
            }
        } catch (error: any) {
            console.error("Action Resolution Error:", error);
            return {
                type: 'ERROR',
                summary: `Failed to prepare transaction: ${error.message}`
            };
        }
    }

    private async resolveTransfer(intent: UserIntent, userAddress: string, userEmail?: string): Promise<ProposedAction> {
        const { to, amount, token } = intent.params;

        if (!to || !amount || !token) throw new Error("Missing parameters for Transfer");

        // 1. Resolve Recipient (Handle -> Address, Name -> Address, or direct Address)
        const resolved = await resolveRecipient(to, userEmail);
        if (!resolved) {
            throw new Error(`Recipient "${to}" not found. Please provide a valid address or contact name.`);
        }
        const recipientAddr = resolved.address;

        // 2. Validate Address (Prevent ENS resolution errors)
        if (!ethers.isAddress(recipientAddr)) {
            throw new Error(`Recipient "${to}" resolved to an invalid address: ${recipientAddr}. Please use a valid wallet address or registered contact.`);
        }

        // 3. Prepare Transaction Data (Don't sign yet)
        // We use VCN Token contract
        const vcnContract = (contractService as any).getVcnTokenContract();
        const amountWei = ethers.parseUnits(amount, 18);

        const txData = await vcnContract.transfer.populateTransaction(recipientAddr, amountWei);

        return {
            type: 'TRANSACTION',
            summary: `Transfer ${amount} ${token} to ${to}`,
            data: {
                to: txData.to,
                data: txData.data,
                value: "0"
            },
            visualization: {
                type: 'TRANSFER',
                asset: token,
                amount: amount,
                recipient: to
            }
        };
    }

    private async resolveScheduledTransfer(intent: UserIntent, userAddress: string, userEmail?: string): Promise<ProposedAction> {
        const { to, amount, token, scheduleTime } = intent.params;
        if (!to || !amount || !scheduleTime) throw new Error("Missing params for Scheduled Transfer");

        // --- Chunk 6: Cost Control Policy Checks ---
        // 1. Minimum Amount Check (Min: 0.1 VCN)
        if (parseFloat(amount) < 0.1) {
            return {
                type: 'ERROR',
                summary: "Cost Control: Minimum scheduled transfer amount is 0.1 VCN."
            };
        }

        // 2. Calculate Unlock Time & Check Minimum Duration (Min: 2 minutes)
        // scheduleTime format: "30 mins", "1 hour"
        const now = Math.floor(Date.now() / 1000);
        let durationSeconds = 0;

        const numeric = parseInt(scheduleTime.match(/\d+/)?.[0] || "0");
        if (scheduleTime.includes('min')) durationSeconds = numeric * 60;
        else if (scheduleTime.includes('hour') || scheduleTime.includes('h')) durationSeconds = numeric * 3600;
        else durationSeconds = numeric;

        if (durationSeconds < 300) { // 5 minutes
            return {
                type: 'ERROR',
                summary: "Cost Control: Minimum schedule duration is 5 minutes."
            };
        }

        // 3. Quota Check (Simulation using LocalStorage)
        // In Prod: Check Firebase/Auth User metadata
        const today = new Date().toISOString().split('T')[0];
        const dailyKey = `quota_day_${userAddress}_${today}`;
        const hourlyKey = `quota_hour_${userAddress}_${new Date().getHours()}`;

        const dailyCount = parseInt(localStorage.getItem(dailyKey) || '0');
        const hourlyCount = parseInt(localStorage.getItem(hourlyKey) || '0');

        if (dailyCount >= 20) {
            return {
                type: 'ERROR',
                summary: "Daily Quota Exceeded (20/day). Please try again tomorrow."
            };
        }
        if (hourlyCount >= 5) {
            return {
                type: 'ERROR',
                summary: "Hourly Quota Exceeded (5/hour). Please try again later."
            };
        }

        // Increment Quota (Optimistic)
        // Ideally this should happen AFTER tx confirmation, but for cost control acting early is safer for MVP
        localStorage.setItem(dailyKey, (dailyCount + 1).toString());
        localStorage.setItem(hourlyKey, (hourlyCount + 1).toString());

        const unlockTime = now + durationSeconds;

        // 4. Resolve Recipient
        const resolved = await resolveRecipient(to, userEmail);
        if (!resolved) {
            throw new Error(`Recipient "${to}" not found. Please provide a valid address or contact name.`);
        }
        const recipientAddr = resolved.address;

        // 5. Validate Address (Prevent ENS resolution errors)
        if (!ethers.isAddress(recipientAddr)) {
            throw new Error(`Recipient "${to}" resolved to an invalid address: ${recipientAddr}. Please use a valid wallet address or registered contact.`);
        }

        // 6. Prepare TimeLock Contract Call
        // This is a Native Transfer schedule, so we send Value with the call
        const iface = new ethers.Interface(this.TIMELOCK_ABI);
        const data = iface.encodeFunctionData("scheduleTransferNative", [recipientAddr, unlockTime]);
        const amountWei = ethers.parseEther(amount);

        return {
            type: 'TRANSACTION',
            summary: `Schedule transfer of ${amount} ${token || 'VCN'} to ${to} in ${scheduleTime}`,
            data: {
                to: this.TIMELOCK_ADDRESS,
                data: data,
                value: amountWei.toString() // Native value to lock
            },
            visualization: {
                type: 'SCHEDULE',
                asset: token || 'VCN',
                amount: amount,
                recipient: to,
                scheduleTime: scheduleTime
            }
        };
    }

    private async resolveBridge(intent: UserIntent, userAddress: string): Promise<ProposedAction> {
        const { amount, token, destinationChain, to } = intent.params;
        if (!amount || !destinationChain) throw new Error("Missing Bridge params");

        // Resolve recipient if specified (e.g., contact name -> address)
        let bridgeRecipient = userAddress;
        let recipientLabel = '';
        if (to) {
            const resolved = await resolveRecipient(to);
            if (!resolved) {
                throw new Error(`Recipient "${to}" not found. Please provide a valid address or contact name.`);
            }
            bridgeRecipient = resolved.address;
            recipientLabel = to;
            if (!ethers.isAddress(bridgeRecipient)) {
                throw new Error(`Recipient "${to}" resolved to an invalid address: ${bridgeRecipient}.`);
            }
        }

        // Vision Chain - Secure Bridge (Phase 1) Contracts
        const INTENT_COMMITMENT_ADDRESS = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
        const VISION_BRIDGE_SECURE_ADDRESS = '0x610178dA211FEF7D417bC0e6FeD39F05609AD788';

        // Chain IDs
        const VISION_CHAIN_ID = 1337;
        const SEPOLIA_CHAIN_ID = 11155111;

        // Normalize destination chain name to Sepolia for all Ethereum-related keywords
        const chainUpper = destinationChain.toUpperCase();
        const ethereumKeywords = [
            'ETHEREUM', 'ETH', 'SEPOLIA', 'ERC-20', 'ERC20', 'MAINNET',
            '이더리움', '이더', '세폴리아', '이더계열'
        ];

        const dstChainId = ethereumKeywords.some(kw => chainUpper.includes(kw))
            ? SEPOLIA_CHAIN_ID
            : 137; // Polygon placeholder

        // Build bridge data for 2-step secure bridge
        const amountWei = ethers.parseEther(amount);

        // ABIs for secure bridge
        const INTENT_COMMITMENT_ABI = [
            "function commitIntent(address recipient, uint256 amount, uint256 destChainId) external returns (bytes32)",
            "function userNonces(address) view returns (uint256)"
        ];

        const BRIDGE_SECURE_ABI = [
            "function lockVCN(bytes32 intentHash, address recipient, uint256 destChainId) payable"
        ];

        const summary = recipientLabel
            ? `Bridge ${amount} VCN from Vision Chain to ${destinationChain} for ${recipientLabel}`
            : `Bridge ${amount} VCN from Vision Chain to ${destinationChain}`;

        return {
            type: 'TRANSACTION',
            summary,
            data: {
                bridgeType: 'SECURE_BRIDGE_V1',
                step1: {
                    contractAddress: INTENT_COMMITMENT_ADDRESS,
                    abi: INTENT_COMMITMENT_ABI,
                    method: 'commitIntent',
                    args: [bridgeRecipient, amountWei.toString(), dstChainId]
                },
                step2: {
                    contractAddress: VISION_BRIDGE_SECURE_ADDRESS,
                    abi: BRIDGE_SECURE_ABI,
                    method: 'lockVCN',
                    value: amountWei.toString()
                },
                recipient: bridgeRecipient,
                amount: amountWei.toString(),
                dstChainId: dstChainId
            },
            visualization: {
                type: 'BRIDGE',
                asset: token || 'VCN',
                amount: amount,
                fromChain: 'Vision Chain',
                toChain: destinationChain,
                recipient: recipientLabel || undefined
            }
        };
    }

    private async resolveSwapAndSend(intent: UserIntent, userAddress: string): Promise<ProposedAction> {
        // This simulates the complex "Universal Resolver" scenario
        // In reality, this would be a multicall or router contract call
        return {
            type: 'TRANSACTION',
            summary: `Swap ${intent.params.amount} ${intent.params.token} to WBTC & Send to ${intent.params.to}`,
            data: {
                to: "0xRouterAddress...", // Mock
                data: "0x...", // Mock calldata
                value: "0"
            },
            visualization: {
                type: 'SWAP',
                asset: 'WBTC', // Resulting asset
                amount: '0.00xxx', // AI would estimate this
                recipient: intent.params.to
            }
        };
    }
}

export const actionResolver = new ActionResolverService();
