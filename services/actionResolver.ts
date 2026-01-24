import { contractService } from './contractService';
import { UserIntent } from './intentParserService';
import { ethers } from 'ethers';

export interface ProposedAction {
    type: 'TRANSACTION' | 'MESSAGE' | 'ERROR';
    summary: string;
    data?: any; // Populated Transaction or arbitrary data
    visualization?: {
        type: 'TRANSFER' | 'BRIDGE' | 'SWAP';
        asset: string;
        amount: string;
        fromChain?: string;
        toChain?: string;
        recipient?: string;
    };
}

export class ActionResolverService {

    constructor() { }

    /**
     * Resolves a parsed UserIntent into a concrete Action.
     */
    async resolve(intent: UserIntent, userAddress: string): Promise<ProposedAction> {
        try {
            switch (intent.action) {
                case 'TRANSFER':
                    return this.resolveTransfer(intent, userAddress);
                case 'BRIDGE':
                    return this.resolveBridge(intent, userAddress);
                case 'SWAP_AND_SEND':
                    return this.resolveSwapAndSend(intent, userAddress);
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

    private async resolveTransfer(intent: UserIntent, userAddress: string): Promise<ProposedAction> {
        const { to, amount, token } = intent.params;

        if (!to || !amount || !token) throw new Error("Missing parameters for Transfer");

        // 1. Resolve Recipient (Handle -> Address)
        // In a real app, we would query VisionProfileRegistry here.
        // Mocking resolution for demo:
        let recipientAddr = to;
        if (to.startsWith('@')) {
            // Mock: @jays -> 0xf39... (Deployer)
            if (to.toLowerCase() === '@jays') recipientAddr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
            else if (to.toLowerCase() === '@alice') recipientAddr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
            else recipientAddr = "0x0000000000000000000000000000000000000000"; // Unknown handle
        }

        // 2. Prepare Transaction Data (Don't sign yet)
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

    private async resolveBridge(intent: UserIntent, userAddress: string): Promise<ProposedAction> {
        const { amount, token, destinationChain } = intent.params;
        if (!amount || !destinationChain) throw new Error("Missing Bridge params");

        // Using VisionEqualizerV2 for bridging
        // destinationChain (e.g. "ETHEREUM") -> ChainId (e.g. 1 or 101)
        const targetChainId = destinationChain.toUpperCase() === 'ETHEREUM' ? 101 : 137; // Mock IDs

        // 1. Check Allowance logic would go here

        // 2. Prepare requestTSSMigration call
        const equalizer = (contractService as any).visionEqualizer;
        if (!equalizer) throw new Error("Equalizer contract not initialized");

        const txData = await equalizer.requestTSSMigration.populateTransaction(
            1337, // Source: Vision
            targetChainId,
            token || 'VCN',
            ethers.parseEther(amount)
        );

        return {
            type: 'TRANSACTION',
            summary: `Bridge ${amount} ${token} to ${destinationChain}`,
            data: {
                to: txData.to,
                data: txData.data,
                value: "0"
            },
            visualization: {
                type: 'BRIDGE',
                asset: token || 'VCN',
                amount: amount,
                fromChain: 'Vision Chain',
                toChain: destinationChain
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
