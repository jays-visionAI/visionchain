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

    // Mock Cross-chain Detection (Phase 2)
    const isCrossChain = props.tx.method === 'Hub Transfer' || props.tx.type === 'LayerZero';
    const mockPacketId = "0xpacket...123";

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
                                    <button class="text-gray-500 hover:text-white"><Copy class="w-3 h-3" /></button>
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
                        <div class="bg-blue-600/5 border border-blue-600/10 rounded-xl p-5">
                            <div class="flex justify-between items-center mb-4">
                                <span class="text-[9px] font-black text-blue-500 uppercase tracking-widest">Value</span>
                                <span class="text-xl font-black text-white">{Number(props.tx.value).toLocaleString()} VCN</span>
                            </div>
                        </div>
                        {/* Cross-chain Section (Phase 2) */}
                        <Show when={isCrossChain}>
                            <div class="bg-gradient-to-r from-purple-900/10 to-blue-900/10 border border-purple-500/20 rounded-xl p-5 relative overflow-hidden group">
                                <div class="absolute right-0 top-0 p-4 opacity-10">
                                    <Globe class="w-16 h-16 text-purple-400" />
                                </div>
                                <div class="relative z-10">
                                    <div class="flex items-center gap-2 mb-3">
                                        <Globe class="w-4 h-4 text-purple-400" />
                                        <h4 class="text-[10px] font-black text-purple-300 uppercase tracking-widest">Cross-Chain Transaction</h4>
                                    </div>
                                    <div class="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5 mb-3">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-bold text-gray-400">Src: Ethereum</span>
                                            <ArrowRight class="w-3 h-3 text-gray-600" />
                                            <span class="text-xs font-bold text-white">Dst: Vision Chain</span>
                                        </div>
                                        <span class="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase rounded animate-pulse">Inflight</span>
                                    </div>
                                    <button
                                        onClick={() => props.onViewPacket(mockPacketId)}
                                        class="text-[10px] font-black underline text-purple-400 hover:text-white transition-colors"
                                    >
                                        View Packet Lifecycle →
                                    </button>
                                </div>
                            </div>
                        </Show>

                        {/* Transfers Section Placeholder */}
                        <div class="border border-white/5 rounded-xl p-4">
                            <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Token Transfers (ERC-20)</h4>
                            <div class="text-[10px] text-gray-500 italic">No token transfers in this transaction.</div>
                        </div>
                    </div>
                </Show>

                <Show when={activeTab() === 'logs'}>
                    <div class="space-y-4">
                        <div class="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[10px] font-black text-gray-400 uppercase">Log #1 (Transfer)</span>
                                <span class="text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded">Decoded</span>
                            </div>
                            <div class="font-mono text-[10px] text-gray-400 space-y-1">
                                <div>From: <span class="text-blue-400">0x1234...5678</span></div>
                                <div>To: <span class="text-blue-400">0x8765...4321</span></div>
                                <div>Value: <span class="text-white">100.00 USDT</span></div>
                            </div>
                        </div>
                        <div class="p-4 bg-white/[0.02] border border-white/5 rounded-xl opacity-50">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[10px] font-black text-gray-400 uppercase">Input Data</span>
                            </div>
                            <div class="font-mono text-[10px] text-gray-500 break-all">
                                0xa9059cbb000000000000000000000000...
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

                        <div class="bg-white/[0.02] border border-white/5 rounded-xl text-center overflow-hidden">
                            <div class="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex justify-between items-center text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                <span>Entry #14283</span>
                                <span>Rule: TRANSFER_V1</span>
                            </div>
                            <div class="p-4 font-mono text-xs space-y-2">
                                <div class="flex justify-between items-center group cursor-pointer hover:bg-white/5 p-2 rounded">
                                    <div class="text-green-400 font-black">DR Asset (VCN)</div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-white">1,000.00</span>
                                        <span class="px-1.5 py-0.5 bg-blue-500/10 text-[8px] text-blue-400 rounded opacity-0 group-hover:opacity-100 transition-opacity">Evidence #L1</span>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center group cursor-pointer hover:bg-white/5 p-2 rounded">
                                    <div class="text-orange-400 font-black">CR Liability (User Funds)</div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-white">1,000.00</span>
                                        <span class="px-1.5 py-0.5 bg-blue-500/10 text-[8px] text-blue-400 rounded opacity-0 group-hover:opacity-100 transition-opacity">Evidence #L1</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>
            </div>
        </Motion.div>
    );
}
