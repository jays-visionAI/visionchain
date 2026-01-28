import { Component, Show } from 'solid-js';
import { CheckCircle, Copy, ExternalLink } from 'lucide-solid';

interface TransferSuccessModalProps {
    isOpen: boolean;
    txHash: string;
    recipient: string;
    recipientAddress: string;
    amount: number;
    onClose: () => void;
    copyToClipboard: (text: string) => void;
}

export const TransferSuccessModal: Component<TransferSuccessModalProps> = (props) => {
    return (
        <Show when={props.isOpen}>
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                <div class="w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
                    <div class="bg-gradient-to-b from-green-500/10 to-transparent p-10 flex flex-col items-center text-center">
                        <div class="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                            <CheckCircle class="w-10 h-10 text-green-500" />
                        </div>
                        <h2 class="text-3xl font-black italic mb-2 text-white">TRANSFER SUCCESS</h2>
                        <p class="text-gray-400 font-medium">Internal VCN Distribution Complete</p>
                    </div>

                    <div class="px-8 pb-10 space-y-6">
                        <div class="space-y-4">
                            <div class="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Recipient</div>
                                <div class="text-sm font-bold text-white uppercase">{props.recipient}</div>
                                <div class="text-[10px] font-mono text-cyan-500/60 mt-0.5">{props.recipientAddress}</div>
                            </div>
                            <div class="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Amount Sent</div>
                                <div class="text-xl font-black text-cyan-400">{props.amount.toLocaleString()} VCN</div>
                            </div>
                            <div class="p-4 bg-white/[0.03] border border-white/5 rounded-2xl relative group">
                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Transaction ID (TxHash)</div>
                                <div class="flex items-center gap-2">
                                    <code class="text-[11px] font-mono text-gray-400 break-all flex-1">{props.txHash}</code>
                                    <button
                                        onClick={() => props.copyToClipboard(props.txHash)}
                                        class="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors shrink-0"
                                    >
                                        <Copy class="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-col gap-3 pt-2">
                            <a
                                href={`/visionscan?tx=${props.txHash}&to=${props.recipientAddress}&amount=${props.amount}&method=Asset%20Transfer`}
                                target="_blank"
                                class="w-full py-4 bg-white text-black font-black rounded-2xl text-center text-xs uppercase tracking-[0.2em] hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                            >
                                <ExternalLink class="w-4 h-4" />
                                View on VisionScan
                            </a>
                            <button
                                onClick={props.onClose}
                                class="w-full py-3 bg-white/5 text-gray-500 font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Show>
    );
};
