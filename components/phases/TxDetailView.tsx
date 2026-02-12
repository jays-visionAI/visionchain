import { createSignal, Show, For } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    CheckCircle2,
    Copy,
    ArrowRightLeft,
    ScrollText,
    Activity,
    Code,
    X,
    ShieldCheck,
    FileText,
    Globe,
    ArrowRight
} from 'lucide-solid';

interface TxDetailProps {
    tx: any;
    onClose: () => void;
    onViewPacket: (packetId: string) => void;
    view: 'blockchain' | 'accounting';
}

export default function TxDetailView(props: TxDetailProps) {
    const [activeTab, setActiveTab] = createSignal<'overview' | 'logs' | 'trace' | 'state' | 'accounting'>('overview');
    const [copied, setCopied] = createSignal(false);

    const handleCopy = () => {
        if (!props.tx.hash) return;
        navigator.clipboard.writeText(props.tx.hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Cross-chain Detection - includes bridge transactions
    const isCrossChain = props.tx.method === 'Hub Transfer' || props.tx.type === 'LayerZero' || props.tx.type === 'Bridge' || props.tx.to?.startsWith('bridge:');
    const isBridgeTx = props.tx.type === 'Bridge' || props.tx.to?.startsWith('bridge:');
    const bridgeDestination = isBridgeTx ? (props.tx.to?.replace('bridge:', '') || props.tx.metadata?.destinationChain || 'Unknown') : '';
    const mockPacketId = props.tx.hash || "0xpacket...123";

    return (
        <Motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            class="bg-[#0c0c0c] border border-white/10 rounded-2xl overflow-hidden sticky top-24"
        >
            <div class="p-6 border-b border-white/5 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <ShieldCheck class="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 class="text-lg font-black italic tracking-tight">TRANSACTION</h2>
                        <p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Details & Audit</p>
                    </div>
                </div>
                <button
                    onClick={props.onClose}
                    class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                    <X class="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Tabs */}
            <div class="px-6 border-b border-white/5 flex gap-4 overflow-x-auto no-scrollbar">
                {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'logs', label: 'Logs' },
                    { id: 'trace', label: 'Trace' },
                    { id: 'state', label: 'State' },
                    { id: 'accounting', label: 'Accounting' }
                ].map((t) => (
                    <button
                        onClick={() => setActiveTab(t.id as any)}
                        class={`py-4 text-[9px] font-black uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeTab() === t.id ? 'text-blue-500' : 'text-gray-500 hover:text-white'}`}
                    >
                        {t.label}
                        {activeTab() === t.id && <Motion.div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                    </button>
                ))}
            </div>

            <div class="p-6 max-h-[calc(100vh-250px)] overflow-y-auto">
                <Show when={activeTab() === 'overview'}>
                    <div class="space-y-6">
                        <div class="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                            <div class="flex flex-col gap-1 mb-4">
                                <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Hash</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] font-mono text-blue-400 break-all">{props.tx.hash}</span>
                                    <button
                                        onClick={handleCopy}
                                        class="text-gray-500 hover:text-white transition-colors p-1"
                                    >
                                        <Show when={copied()} fallback={<Copy class="w-3 h-3" />}>
                                            <CheckCircle2 class="w-3 h-3 text-green-400" />
                                        </Show>
                                    </button>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Status</span>
                                    <span class="text-[9px] font-black text-green-400 uppercase flex items-center gap-1">
                                        <CheckCircle2 class="w-3 h-3" /> {props.tx.trustStatus === 'tagged' ? 'Success' : 'Verified'}
                                    </span>
                                </div>
                                <div>
                                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Time</span>
                                    <span class="text-[9px] font-bold text-white">{props.tx.time}</span>
                                </div>
                            </div>
                        </div>

                        {/* Dual Value Section (Accounting) */}
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-blue-600/5 border border-blue-600/10 rounded-xl p-4">
                                <span class="text-[8px] font-black text-blue-500 uppercase tracking-widest block mb-2">Value at Confirmation</span>
                                <div class="text-lg font-black text-white">{Number(props.tx.value).toLocaleString()} VCN</div>
                                <div class="text-[10px] text-gray-500 font-mono mt-1">${(Number(props.tx.value) * 4.25).toLocaleString()} USD (Historical)</div>
                            </div>
                            <div class="bg-emerald-600/5 border border-emerald-600/10 rounded-xl p-4">
                                <span class="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-2">Current Market Value</span>
                                <div class="text-lg font-black text-white">{Number(props.tx.value).toLocaleString()} VCN</div>
                                <div class="text-[10px] text-gray-500 font-mono mt-1">${(Number(props.tx.value) * 4.876).toLocaleString()} USD (Mark-to-Market)</div>
                            </div>
                        </div>

                        {/* Cross-chain Section (Phase 2) */}
                        <Show when={isCrossChain}>
                            <div class={`bg-gradient-to-r ${isBridgeTx ? 'from-purple-900/20 to-indigo-900/20 border-purple-500/30' : 'from-purple-900/10 to-blue-900/10 border-purple-500/20'} border rounded-xl p-5 relative overflow-hidden group`}>
                                <div class="absolute right-0 top-0 p-4 opacity-10">
                                    <Globe class="w-16 h-16 text-purple-400" />
                                </div>
                                <div class="relative z-10">
                                    <div class="flex items-center gap-2 mb-3">
                                        <Globe class="w-4 h-4 text-purple-400" />
                                        <h4 class="text-[10px] font-black text-purple-300 uppercase tracking-widest">
                                            {isBridgeTx ? 'Cross-Chain Bridge' : 'Cross-Chain Transaction'}
                                        </h4>
                                    </div>
                                    <div class="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5 mb-3">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-bold text-gray-400">Src: Vision Chain</span>
                                            <ArrowRight class="w-3 h-3 text-purple-500" />
                                            <span class="text-xs font-bold text-white uppercase">{isBridgeTx ? `Dst: ${bridgeDestination}` : 'Dst: Vision Chain'}</span>
                                        </div>
                                        <span class={`px-2 py-1 text-[9px] font-black uppercase rounded ${(props.tx.bridgeStatus === 'FINALIZED' || props.tx.bridgeStatus === 'COMPLETED' || props.tx.bridgeStatus === 'FULFILLED')
                                            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                            : props.tx.bridgeStatus === 'CHALLENGED'
                                                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse'
                                            }`}>
                                            {(props.tx.bridgeStatus === 'FINALIZED' || props.tx.bridgeStatus === 'COMPLETED' || props.tx.bridgeStatus === 'FULFILLED') ? 'Completed' : props.tx.bridgeStatus === 'CHALLENGED' ? 'Challenged' : 'Pending'}
                                        </span>
                                    </div>
                                    <Show when={props.tx.challengeEndTime}>
                                        <div class="text-[9px] text-gray-500 mb-2">
                                            Challenge Period Ends: {new Date(props.tx.challengeEndTime).toLocaleString()}
                                        </div>
                                    </Show>
                                    <button
                                        onClick={() => props.onViewPacket(mockPacketId)}
                                        class="text-[10px] font-black underline text-purple-400 hover:text-white transition-colors"
                                    >
                                        View Packet Lifecycle
                                    </button>
                                </div>
                            </div>
                        </Show>

                        {/* Transfers Section Placeholder */}
                        <div class="border border-white/5 rounded-xl p-4">
                            <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Token Transfers (On-chain Record)</h4>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-400">
                                        <FileText class="w-4 h-4" />
                                    </div>
                                    <div class="text-[10px]">
                                        <div class="font-bold text-white">VCN Asset Transfer</div>
                                        <div class="text-gray-500 font-mono">{props.tx.from?.slice(0, 8)}... → {props.tx.to?.slice(0, 8)}...</div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-[11px] font-black text-white">{Number(props.tx.value).toLocaleString()} VCN</div>
                                    <div class="text-[9px] text-gray-500 uppercase tracking-widest">Verified Log</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>

                <Show when={activeTab() === 'logs'}>
                    <div class="space-y-4">
                        <div class="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[10px] font-black text-gray-400 uppercase">Log #1 (TRANSFER)</span>
                                <span class="text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded">Decoded</span>
                            </div>
                            <div class="font-mono text-[10px] text-gray-400 space-y-1">
                                <div>From: <span class="text-blue-400">{props.tx.from}</span></div>
                                <div>To: <span class="text-blue-400">{props.tx.to}</span></div>
                                <div>Value: <span class="text-white">{Number(props.tx.value).toLocaleString()} VCN</span></div>
                            </div>
                        </div>
                        <div class="p-4 bg-white/[0.02] border border-white/5 rounded-xl opacity-50">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[10px] font-black text-gray-400 uppercase">Input Data</span>
                            </div>
                            <div class="font-mono text-[10px] text-gray-500 break-all">
                                0xa9059cbb000000000000000000000000{props.tx.to?.slice(2)}...
                            </div>
                        </div>
                    </div>
                </Show>

                <Show when={activeTab() === 'trace'}>
                    <div class="p-4 bg-white/[0.02] border border-white/5 rounded-xl h-64 flex items-center justify-center text-gray-500 text-xs italic">
                        Call Trace Tree Visualization (Phase 1)
                    </div>
                </Show>

                <Show when={activeTab() === 'accounting'}>
                    <div class="space-y-4">
                        {/* Disclaimer Banner (Phase 3) */}
                        <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
                            <ShieldCheck class="w-5 h-5 text-yellow-500 mt-0.5" />
                            <div>
                                <h4 class="text-xs font-black text-yellow-500 uppercase tracking-widest mb-1">Audit-Ready Journaling Support</h4>
                                <p class="text-[10px] text-gray-400 leading-relaxed">
                                    These journal entries are aligned with GAAP/IFRS principles but do not constitute legal financial advice.
                                    Generated via <strong>Rule Engine v1.2.0</strong> based on on-chain evidence.
                                </p>
                            </div>
                        </div>

                        <div class="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                            <div class="px-4 py-3 bg-white/[0.02] border-b border-white/5 flex justify-between items-center">
                                <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Journal Entry #14283</span>
                                <div class="flex gap-2">
                                    <span class="px-2 py-0.5 bg-blue-500/10 text-[8px] text-blue-400 rounded font-black">COST BASIS</span>
                                    <span class="px-2 py-0.5 bg-emerald-500/10 text-[8px] text-emerald-400 rounded font-black">MTM READY</span>
                                </div>
                            </div>
                            <div class="p-6 font-mono text-xs space-y-4">
                                <div class="grid grid-cols-2 gap-8">
                                    <div class="space-y-3">
                                        <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest border-b border-white/5 pb-1">Historical Basis</div>
                                        <div class="flex justify-between items-center group">
                                            <div class="text-green-400 font-bold">DR Asset</div>
                                            <div class="text-white">${(Number(props.tx.value) * 4.25).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                        </div>
                                        <div class="flex justify-between items-center group">
                                            <div class="text-orange-400 font-bold italic pl-4">CR Funds</div>
                                            <div class="text-white">${(Number(props.tx.value) * 4.25).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    </div>
                                    <div class="space-y-3 border-l border-white/10 pl-8">
                                        <div class="text-[9px] font-black text-blue-500 uppercase tracking-widest border-b border-white/5 pb-1">Mark-to-Market</div>
                                        <div class="flex justify-between items-center group">
                                            <div class="text-blue-400 font-bold">Current value</div>
                                            <div class="text-white">${(Number(props.tx.value) * 4.876).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                        </div>
                                        <div class="flex justify-between items-center group">
                                            <div class="text-purple-400 font-bold italic">Unrealized P/L</div>
                                            <div class="text-green-400">+${(Number(props.tx.value) * (4.876 - 4.25)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="px-4 py-2 bg-blue-500/5 text-[8px] font-black text-blue-400 uppercase tracking-widest text-right">
                                Generated via Accounting Rule: {props.tx.type === 'Transfer' ? 'ASSET_TRANSFER_V2' : 'CONTRACT_CALL_V1'}
                            </div>
                        </div>
                    </div>
                </Show>
            </div>
        </Motion.div>
    );
}
