/**
 * transferService.ts
 * 
 * Unified Transfer Service - Routes all VCN transfers through the Agent Gateway API.
 * Replaces direct contractService.sendGaslessTokens / sendTokens calls.
 * 
 * Architecture:
 *   Frontend (sign permit) → Agent Gateway API (transfer.send) → Paymaster (execute)
 */

import { ethers } from 'ethers';
import { getFirebaseAuth } from './firebaseService';
import VCNTokenABI from './abi/VCNToken.json';
import { contractService } from './contractService';

// Agent Gateway API endpoints (auto-detect environment)
const getGatewayUrl = (): string => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname.includes('staging')) {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
};

// Contract addresses (must match contractService)
const VCN_TOKEN = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const PAYMASTER_ADMIN = '0x08A1B183a53a0f8f1D875945D504272738E3AF34'; // Executor wallet (matches server VCN_EXECUTOR_PK)
const CHAIN_ID = 3151909;
const RPC_URL = 'https://api.visionchain.co/rpc-proxy';

// ============================================
// Types
// ============================================

export interface TransferRequest {
    type: 'send' | 'batch' | 'scheduled' | 'bridge' | 'bridge_finalize' | 'bridge_reverse' | 'bridge_reverse_prepare';
    to?: string;
    amount?: string;
    token?: string; // 'VCN' | 'ETH'
    recipients?: Array<{ to: string; amount: string }>;
    executeAt?: string; // ISO 8601 for scheduled
    destinationChain?: number; // Chain ID for bridge
    bridgeId?: string; // For bridge.finalize
}

export interface TransferResult {
    success: boolean;
    txHash?: string;
    from?: string;
    to?: string;
    amount?: string;
    error?: string;
    scheduleId?: string;
    bridgeId?: string;
    intentHash?: string;
    status?: string;
    fee?: {
        charged: boolean;
        amount_vcn: string;
        method: string;
    };
    batchResults?: Array<{ to: string; amount: string; tx_hash: string; status: string }>;
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Get Firebase ID token for the currently authenticated user.
 */
async function getFirebaseIdToken(): Promise<string> {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated. Please log in first.');
    }
    return user.getIdToken(/* forceRefresh */ true);
}

/**
 * Sign an EIP-712 Permit for the Paymaster.
 * @param totalVcn - Total VCN amount to authorize (including fee)
 */
async function signPermit(
    signer: any,
    totalVcn: string
): Promise<{ signature: string; deadline: number; totalWei: string }> {
    const userAddress = await signer.getAddress();

    const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
    const vcnContract = new ethers.Contract(VCN_TOKEN, VCNTokenABI.abi, rpcProvider);

    const totalAmount = ethers.parseUnits(totalVcn, 18);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    const [tokenName, nonce] = await Promise.all([
        vcnContract.name(),
        vcnContract.nonces(userAddress),
    ]);

    const domain = {
        name: tokenName,
        version: '1',
        chainId: CHAIN_ID,
        verifyingContract: VCN_TOKEN,
    };

    const types = {
        Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
    };

    const values = {
        owner: userAddress,
        spender: PAYMASTER_ADMIN,
        value: totalAmount,
        nonce: nonce,
        deadline: deadline,
    };

    const signature = await signer.signTypedData(domain, types, values);

    return { signature, deadline, totalWei: totalAmount.toString() };
}

/**
 * Call the Agent Gateway API with Firebase Auth.
 */
async function callGateway(action: string, params: Record<string, any>): Promise<any> {
    const idToken = await getFirebaseIdToken();
    const url = getGatewayUrl();

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            action,
            ...params,
        }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error || `Gateway request failed: ${response.statusText}`);
    }

    return data;
}

// ============================================
// Public API
// ============================================

/**
 * Execute a single VCN transfer via the Agent Gateway API.
 */
export async function sendTransfer(
    to: string,
    amount: string,
    signer?: any
): Promise<TransferResult> {
    const activeSigner = signer || contractService.getSigner();
    if (!activeSigner) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
    }

    try {
        // Sign permit for (amount + 1 VCN fee)
        const fee = '1.0';
        const totalVcn = (parseFloat(amount) + parseFloat(fee)).toString();
        const permit = await signPermit(activeSigner, totalVcn);
        const fromAddress = await activeSigner.getAddress();

        const result = await callGateway('transfer.send', {
            to,
            amount,
            from: fromAddress,
            signature: permit.signature,
            deadline: permit.deadline,
            fee: ethers.parseUnits(fee, 18).toString(),
        });

        return {
            success: true,
            txHash: result.tx_hash,
            from: result.from,
            to: result.to,
            amount: result.amount,
            fee: result.fee,
        };
    } catch (error: any) {
        console.error('[TransferService] sendTransfer failed:', error);
        return { success: false, error: error.message || 'Transfer failed' };
    }
}

/**
 * Schedule a future VCN transfer via the Agent Gateway API.
 * No permit needed -- the transfer is executed server-side at the scheduled time.
 */
export async function scheduleTransfer(
    to: string,
    amount: string,
    executeAt: string | number, // ISO 8601 string or unix timestamp
): Promise<TransferResult> {
    try {
        const result = await callGateway('transfer.scheduled', {
            to,
            amount,
            execute_at: executeAt,
        });

        return {
            success: true,
            scheduleId: result.schedule_id,
            to: result.to,
            amount: result.amount,
            status: result.status,
        };
    } catch (error: any) {
        console.error('[TransferService] scheduleTransfer failed:', error);
        return { success: false, error: error.message || 'Schedule failed' };
    }
}

/**
 * Initiate a cross-chain bridge via the Agent Gateway API.
 * Signs a permit for (amount + 1 VCN bridge fee).
 */
export async function initiateBridge(
    amount: string,
    destinationChain: number,
    recipient?: string,
    signer?: any
): Promise<TransferResult> {
    const activeSigner = signer || contractService.getSigner();
    if (!activeSigner) {
        throw new Error('Wallet not connected.');
    }

    try {
        // Bridge fee = 1 VCN
        const totalVcn = (parseFloat(amount) + 1).toString();
        const permit = await signPermit(activeSigner, totalVcn);
        const fromAddress = await activeSigner.getAddress();

        const params: Record<string, any> = {
            amount,
            destination_chain: destinationChain,
            from: fromAddress,
            signature: permit.signature,
            deadline: permit.deadline,
        };
        if (recipient) params.recipient = recipient;

        const result = await callGateway('bridge.initiate', params);

        return {
            success: true,
            bridgeId: result.bridge_id,
            intentHash: result.intent_hash,
            txHash: result.commit_tx,
            amount: result.amount,
            status: result.status,
            fee: { charged: true, amount_vcn: result.fee || '1', method: 'bridge_fee' },
        };
    } catch (error: any) {
        console.error('[TransferService] initiateBridge failed:', error);
        return { success: false, error: error.message || 'Bridge initiation failed' };
    }
}

/**
 * Check/finalize bridge status.
 */
export async function finalizeBridge(bridgeId: string): Promise<TransferResult> {
    try {
        const result = await callGateway('bridge.finalize', { bridge_id: bridgeId });
        return {
            success: true,
            bridgeId: result.bridge_id,
            status: result.status,
        };
    } catch (error: any) {
        console.error('[TransferService] finalizeBridge failed:', error);
        return { success: false, error: error.message || 'Bridge finalize failed' };
    }
}

/**
 * Prepare for reverse bridge (Sepolia -> Vision Chain).
 * Sponsors Sepolia ETH gas if needed.
 */
export async function reverseBridgePrepare(): Promise<{
    success: boolean;
    relayerAddress?: string;
    vcnSepoliaAddress?: string;
    gasRefillTx?: string;
    error?: string;
}> {
    try {
        const result = await callGateway('bridge.reverse_prepare', {});
        return {
            success: true,
            relayerAddress: result.relayer_address,
            vcnSepoliaAddress: result.vcn_sepolia_address,
            gasRefillTx: result.gas_refill_tx,
        };
    } catch (error: any) {
        console.error('[TransferService] reverseBridgePrepare failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Execute reverse bridge: Sepolia VCN -> Vision Chain VCN.
 * Requires either a Sepolia permit signature or pre-existing allowance.
 */
export async function reverseBridge(
    amount: string,
    options?: {
        recipient?: string;
        signature?: string;
        deadline?: number;
    }
): Promise<TransferResult> {
    try {
        const params: Record<string, any> = { amount };
        if (options?.recipient) params.recipient = options.recipient;
        if (options?.signature) params.signature = options.signature;
        if (options?.deadline) params.deadline = options.deadline;

        const result = await callGateway('bridge.reverse', params);

        return {
            success: true,
            txHash: result.vision_tx,
            amount: result.amount,
            status: result.status,
            fee: { charged: true, amount_vcn: result.fee || '1', method: 'reverse_bridge_fee' },
        };
    } catch (error: any) {
        console.error('[TransferService] reverseBridge failed:', error);
        return { success: false, error: error.message || 'Reverse bridge failed' };
    }
}

/**
 * Transfer VCN on Sepolia via the Agent Gateway API.
 * The caller must provide a pre-signed EIP-712 permit for Sepolia VCN
 * (the permit is on a different chain so transferService cannot sign it internally).
 */
export async function sepoliaTransfer(
    to: string,
    amount: string,
    signature: string,
    deadline: number,
): Promise<TransferResult> {
    try {
        const result = await callGateway('transfer.sepolia', {
            to,
            amount,
            signature,
            deadline,
        });

        return {
            success: true,
            txHash: result.tx_hash,
            from: result.from,
            to: result.to,
            amount: result.amount,
            fee: result.fee,
        };
    } catch (error: any) {
        console.error('[TransferService] sepoliaTransfer failed:', error);
        return { success: false, error: error.message || 'Sepolia transfer failed' };
    }
}

/**
 * Execute a batch of VCN transfers.
 */
export async function sendBatchTransfer(
    recipients: Array<{ to: string; amount: string }>,
    signer?: any,
    onProgress?: (current: number, total: number, lastResult: TransferResult) => void
): Promise<{ results: TransferResult[]; summary: { total: number; success: number; failed: number } }> {
    const activeSigner = signer || contractService.getSigner();
    if (!activeSigner) {
        throw new Error('Wallet not connected.');
    }

    const results: TransferResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i++) {
        const { to, amount } = recipients[i];
        const result = await sendTransfer(to, amount, activeSigner);
        results.push(result);

        if (result.success) successCount++;
        else failedCount++;

        if (onProgress) onProgress(i + 1, recipients.length, result);

        // Wait between transfers for nonce stability
        if (i < recipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    return {
        results,
        summary: { total: recipients.length, success: successCount, failed: failedCount },
    };
}

/**
 * Check wallet balance via Agent Gateway.
 */
export async function getBalance(): Promise<{ balance: string; walletAddress: string }> {
    const result = await callGateway('wallet.balance', {});
    return { balance: result.balance_vcn, walletAddress: result.wallet_address };
}

/**
 * Unified transfer entry point. Handles routing based on request type.
 */
export async function executeTransfer(
    request: TransferRequest,
    signer?: any
): Promise<TransferResult> {
    switch (request.type) {
        case 'send':
            if (!request.to || !request.amount) {
                return { success: false, error: 'Missing "to" or "amount" for send transfer' };
            }
            return sendTransfer(request.to, request.amount, signer);

        case 'batch':
            if (!request.recipients || request.recipients.length === 0) {
                return { success: false, error: 'Missing "recipients" for batch transfer' };
            }
            const batchResult = await sendBatchTransfer(request.recipients, signer);
            return {
                success: batchResult.summary.failed === 0,
                batchResults: batchResult.results.map(r => ({
                    to: r.to || '',
                    amount: r.amount || '',
                    tx_hash: r.txHash || '',
                    status: r.success ? 'confirmed' : 'failed',
                })),
            };

        case 'scheduled':
            if (!request.to || !request.amount || !request.executeAt) {
                return { success: false, error: 'Missing "to", "amount", or "executeAt" for scheduled transfer' };
            }
            return scheduleTransfer(request.to, request.amount, request.executeAt);

        case 'bridge':
            if (!request.amount || !request.destinationChain) {
                return { success: false, error: 'Missing "amount" or "destinationChain" for bridge' };
            }
            return initiateBridge(request.amount, request.destinationChain, request.to, signer);

        case 'bridge_finalize':
            if (!request.bridgeId) {
                return { success: false, error: 'Missing "bridgeId" for bridge finalize' };
            }
            return finalizeBridge(request.bridgeId);

        case 'bridge_reverse_prepare':
            const prep = await reverseBridgePrepare();
            return { success: prep.success, error: prep.error, status: prep.success ? 'prepared' : 'failed' };

        case 'bridge_reverse':
            if (!request.amount) {
                return { success: false, error: 'Missing "amount" for reverse bridge' };
            }
            return reverseBridge(request.amount, { recipient: request.to });

        default:
            return { success: false, error: `Unknown transfer type: ${request.type}` };
    }
}

