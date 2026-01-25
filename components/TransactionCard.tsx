import { ethers } from 'ethers';
import { createSignal, Show } from 'solid-js';
import { contractService } from '../services/contractService';
import { ArrowRight, ArrowUpRight, RefreshCw, Check, X, Zap, Clock } from 'lucide-solid';

interface ProposedAction {
    type: 'TRANSACTION' | 'MESSAGE' | 'ERROR';
    summary: string;
    data?: any;
    visualization?: {
        type: 'TRANSFER' | 'BRIDGE' | 'SWAP' | 'SCHEDULE';
        asset: string;
        amount: string;
        fromChain?: string;
        toChain?: string;
        recipient?: string;
        scheduleTime?: string; // New: "30 mins"
    };
}

interface TransactionCardProps {
    action: ProposedAction;
    onComplete: (txHash: string) => void;
    onCancel: () => void;
    onOptimisticSchedule?: (taskData: any) => void;
}

const TransactionCard = (props: TransactionCardProps) => {
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    const handleConfirm = async () => {
        if (props.action.type !== 'TRANSACTION' || !props.action.data) return;

        setLoading(true);
        setError(null);
        try {
            if (props.action.data.type === 'GASLESS_HANDLER') {
                // Gasless execution
                const { to, amount } = props.action.data;
                const result = await contractService.sendGaslessTokens(to, amount);
                props.onComplete(result.hash || result.transactionHash || "0x00");
                return;
            }

            const signer = (contractService as any).signer; // Accessing internal signer
            if (!signer) throw new Error("Wallet not connected");

            const txResponse = await signer.sendTransaction({
                to: props.action.data.to,
                data: props.action.data.data,
                value: props.action.data.value
            });

            console.log("Transaction sent:", txResponse.hash);
            const receipt = await txResponse.wait();

            // Only for Scheduled Transfers: Parse logs to get Queue ID immediately
            if (props.action.visualization?.type === 'SCHEDULE' && props.onOptimisticSchedule) {
                try {
                    // TimeLockAgent ABI (NativeTransferScheduled event)
                    // event NativeTransferScheduled(bytes32 indexed scheduleId, address indexed sender, address indexed recipient, uint256 amount, uint256 unlockTime);
                    const iface = new ethers.Interface([
                        "event NativeTransferScheduled(bytes32 indexed scheduleId, address indexed sender, address indexed recipient, uint256 amount, uint256 unlockTime)"
                    ]);

                    let scheduleId = '';
                    let unlockTime = 0;

                    for (const log of receipt.logs) {
                        try {
                            const parsed = iface.parseLog(log);
                            if (parsed && parsed.name === 'NativeTransferScheduled') {
                                scheduleId = parsed.args.scheduleId;
                                unlockTime = Number(parsed.args.unlockTime);
                                break;
                            }
                        } catch (e) { continue; }
                    }

                    if (scheduleId) {
                        props.onOptimisticSchedule({
                            id: scheduleId,
                            summary: `${props.action.visualization.amount} ${props.action.visualization.asset} → ${props.action.visualization.recipient?.slice(0, 6)}...`,
                            timeLeft: props.action.visualization.scheduleTime,
                            timestamp: Date.now(),
                            // We can approximate status or assume WAITING
                        });
                    }
                } catch (logErr) {
                    console.warn("Failed to parse schedule logs:", logErr);
                }
            }

            props.onComplete(txResponse.hash);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Transaction failed");
        } finally {
            setLoading(false);
        }
    };

    const viz = () => props.action.visualization;

    return (
        <Show when={props.action.type !== 'MESSAGE' && props.action.type !== 'ERROR'}>
            <div class="p-4 my-2 bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Show when={viz()?.type === 'SCHEDULE'}>
                            <Clock class="w-3 h-3 text-orange-400" />
                        </Show>
                        {viz()?.type} REQUEST
                    </span>
                    <div class="flex gap-2">
                        <Show when={props.action.data?.type === 'GASLESS_HANDLER'}>
                            <div class="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg uppercase tracking-wide flex items-center gap-1">
                                <Zap class="w-3 h-3" /> Gasless
                            </div>
                        </Show>
                        <div class="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded-lg uppercase tracking-wide">
                            Vision AI
                        </div>
                    </div>
                </div>

                <div class="mb-4">
                    <div class="text-2xl font-bold text-white mb-1 flex items-baseline gap-2">
                        {viz()?.amount} <span class="text-lg text-gray-400">{viz()?.asset}</span>
                    </div>

                    <Show when={viz()?.type === 'SCHEDULE'} fallback={
                        <div class="flex items-center text-gray-400 text-xs font-medium">
                            <Show when={viz()?.type === 'BRIDGE'} fallback={
                                <>
                                    <span>To:</span>
                                    <span class="ml-2 font-mono bg-black/30 px-2 py-1 rounded text-gray-300">
                                        {viz()?.recipient || 'Unknown'}
                                    </span>
                                </>
                            }>
                                <div class="flex items-center gap-2">
                                    <span>{viz()?.fromChain}</span>
                                    <ArrowRight class="w-3 h-3" />
                                    <span>{viz()?.toChain}</span>
                                </div>
                            </Show>
                        </div>
                    }>
                        <div class="space-y-2 mt-2">
                            <div class="flex items-center justify-between text-xs p-2 bg-white/5 rounded-lg border border-white/5">
                                <span class="text-gray-400">Recipient</span>
                                <span class="font-mono text-gray-300">{viz()?.recipient}</span>
                            </div>
                            <div class="flex items-center justify-between text-xs p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                <span class="text-orange-400 font-bold">Execution Time</span>
                                <span class="font-mono text-orange-200">In {viz()?.scheduleTime}</span>
                            </div>
                            <p class="text-[10px] text-gray-500 mt-1 pl-1">
                                * Funds will be locked in TimeLock contract until execution.
                            </p>
                        </div>
                    </Show>
                </div>

                <Show when={error()}>
                    <div class="mb-3 p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl flex items-center gap-2">
                        <X class="w-4 h-4 text-red-400" />
                        {error()}
                    </div>
                </Show>

                <div class="flex gap-3">
                    <button
                        onClick={props.onCancel}
                        disabled={loading()}
                        class="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl transition-all border border-white/5"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading()}
                        class="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all border border-transparent shadow-lg shadow-blue-500/20 flex justify-center items-center gap-2"
                    >
                        <Show when={loading()} fallback={
                            <>
                                <span>{viz()?.type === 'SCHEDULE' ? 'Lock & Schedule' : 'Confirm'}</span>
                                <ArrowRight class="w-3 h-3" />
                            </>
                        }>
                            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </Show>
                    </button>
                </div>
            </div>
        </Show>
    );
};

export default TransactionCard;
