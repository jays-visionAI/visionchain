import { PaymentPreset, getUserPreset, searchUserByPhone } from '../services/firebaseService';
import { contractService } from './contractService';

export interface TransactionPlan {
    type: 'DIRECT_TRANSFER' | 'SWAP_AND_SEND' | 'BRIDGE_AND_SEND';
    sender: string;
    recipient: string;
    recipientVid: string;
    inputAsset: string;
    inputAmount: string; // e.g., '100'
    outputAsset: string;
    outputAmount: string; // e.g., '100' or '12000' (if swapped)
    route: string[]; // e.g. ['Vision Chain', 'Uniswap V3', 'Transfer']
    explanation: string;
}

export class TransactionOptimizerService {

    constructor() { }

    /**
     * The Main Optimizer Function (Step 3)
     * 1. Check Recipient preferences (Step 2)
     * 2. Compare with Sender's Intent
     * 3. Construct the best path
     */
    async optimizeTransaction(
        senderAddress: string,
        recipientIdentifier: string, // phone, email, @handle
        inputAmount: string,
        inputToken: string
    ): Promise<TransactionPlan> {

        console.log(`[Optimizer] Analyzing intent: Send ${inputAmount} ${inputToken} to ${recipientIdentifier}`);

        // Step 2-1: Identify Recipient & VID
        let recipient: { vid: string, email: string, address: string } | null = null;

        // Mocking resolution logic for now (would need regex or lookup service)
        // If starts with @, remove it
        const cleanId = recipientIdentifier.startsWith('@') ? recipientIdentifier.slice(1) : recipientIdentifier;

        // Try searching by phone logic (mocked here or use searchUserByPhone)
        // For this demo, let's assume if it is a phone-like string, we use search
        if (cleanId.match(/^\+?[0-9]{10,15}$/)) {
            recipient = await searchUserByPhone(cleanId);
        } else {
            // Assume it's a VID or Email directly for MVP
            // Or try to fetch preset directly
            recipient = { vid: cleanId, email: cleanId, address: "0xMockAddress..." };
            // In real app, we must resolve address here!
        }

        if (!recipient) {
            throw new Error(`Recipient ${recipientIdentifier} not found in Vision Chain.`);
        }

        console.log(`[Optimizer] Found recipient: ${recipient.vid} (${recipient.address})`);

        // Step 2-2: Get Recipient's Preset Information
        const preset = await getUserPreset(recipient.email);

        // Default values if no preset found
        const preferredPrimary = preset?.primaryAsset || 'VCN';
        const preferredSecondary = preset?.secondaryAsset || 'USDC';
        const preferredChain = preset?.preferredChain || 'Vision Chain';

        console.log(`[Optimizer] Recipient Prefers: ${preferredPrimary} / ${preferredSecondary} on ${preferredChain}`);

        // Step 3: Logic Engine
        // Case A: Perfect Match (Sender has same token as Recipient wants)
        if (inputToken.toUpperCase() === preferredPrimary.toUpperCase()) {
            return {
                type: 'DIRECT_TRANSFER',
                sender: senderAddress,
                recipient: recipient.address,
                recipientVid: recipient.vid,
                inputAsset: inputToken,
                inputAmount: inputAmount,
                outputAsset: inputToken,
                outputAmount: inputAmount,
                route: ['Direct Transfer', preferredChain],
                explanation: `Recipient @${recipient.vid} prefers ${inputToken}. Direct transfer authorized.`
            };
        }

        // Case B: Swap Required (Sender has X, Recipient wants Y)
        // Check if secondary matches?
        if (inputToken.toUpperCase() === preferredSecondary.toUpperCase()) {
            return {
                type: 'DIRECT_TRANSFER',
                sender: senderAddress,
                recipient: recipient.address,
                recipientVid: recipient.vid,
                inputAsset: inputToken,
                inputAmount: inputAmount,
                outputAsset: inputToken,
                outputAmount: inputAmount,
                route: ['Direct Transfer', preferredChain],
                explanation: `Recipient @${recipient.vid} accepts ${inputToken} as secondary preference. Direct transfer optimized.`
            };
        }

        // Case C: Must Swap
        // Simple mock rate calculation
        const rate = (inputToken === 'USDC' && preferredPrimary === 'VCN') ? 12 :
            (inputToken === 'VCN' && preferredPrimary === 'USDC') ? 0.08 : 1;

        const outputAmt = (parseFloat(inputAmount) * rate).toFixed(2);

        return {
            type: 'SWAP_AND_SEND',
            sender: senderAddress,
            recipient: recipient.address,
            recipientVid: recipient.vid,
            inputAsset: inputToken,
            inputAmount: inputAmount,
            outputAsset: preferredPrimary,
            outputAmount: outputAmt,
            route: ['Vision Swap', `Pool ${inputToken}/${preferredPrimary}`, 'Transfer'],
            explanation: `Recipient @${recipient.vid} prefers ${preferredPrimary}. \n\nOptimizer Plan:\n1. Auto-Swap ${inputAmount} ${inputToken} -> ${outputAmt} ${preferredPrimary}\n2. Transfer to ${recipient.address}`
        };
    }
}

export const transactionOptimizer = new TransactionOptimizerService();
