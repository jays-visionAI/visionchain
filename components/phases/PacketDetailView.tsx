import { createSignal, Show, For, onMount } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Globe,
    ArrowRight,
    CheckCircle2,
    Clock,
    XCircle,
    Copy,
    Box,
    X,
    Plane,
    Database,
    Shield
} from 'lucide-solid';

interface PacketDetailProps {
    packetId: string;
    onClose: () => void;
}

export default function PacketDetailView(props: PacketDetailProps) {
    // Mock Data for Phase 2
    const packet = {
        id: props.packetId,
        srcChain: 'Ethereum',
        dstChain: 'Vision Chain',
        status: 'Inflight', // Inflight, Delivered, Stored, Failed
        nonce: 142,
        srcTx: '0xabc...123',
        dstTx: null,
        relayer: 'LayerZero Relayer',
        updated: '12s ago'
    };

    // Stepper State
    const steps = [
        { label: 'Source Tx', status: 'completed', time: '12:00:00' },
        { label: 'Guardian Confirmation', status: 'completed', time: '12:00:15' },
        { label: 'Relayer Inflight', status: 'active', time: 'Pending' },
        { label: 'Destination Execution', status: 'waiting', time: '-' }
    ];

    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            class="max-w-4xl mx-auto px-6 pb-32 pt-8"
        >
            {/* Header */}
            <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 border border-purple-600/30">
                        <Globe class="w-6 h-6" />
                    </div>
                    <div>
                        <h1 class="text-2xl font-black italic tracking-tighter text-white">CROSS-CHAIN PACKET</h1>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs font-mono text-gray-400">{props.packetId}</span>
                            <span class="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] font-black text-purple-400 uppercase">LayerZero v2</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={props.onClose}
                    class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                    <X class="w-4 h-4" /> Close
                </button>
            </div>

            {/* Lifecycle Stepper */}
            <div class="bg-white/[0.02] border border-white/5 rounded-2xl p-8 mb-8 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5" />

                <h3 class="relative text-xs font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <Plane class="w-4 h-4" /> Packet Lifecycle
                </h3>

                <div class="relative flex items-center justify-between z-10 px-4">
                    {/* Progress Bar Background */}
                    <div class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-white/10 -z-10 mx-8" />

                    <For each={steps}>
                        {(step, index) => (
                            <div class="flex flex-col items-center gap-3 bg-[#0c0c0c] px-4 py-2 rounded-xl border border-white/5">
                                <div class={`w-10 h-10 rounded-full flex items-center justify-center border-4 ${step.status === 'completed' ? 'bg-green-500 border-[#0c0c0c] text-white' :
                                        step.status === 'active' ? 'bg-blue-500 border-[#0c0c0c] text-white animate-pulse' :
                                            'bg-gray-800 border-[#0c0c0c] text-gray-500'
                                    }`}>
                                    {step.status === 'completed' ? <CheckCircle2 class="w-5 h-5" /> :
                                        step.status === 'active' ? <Plane class="w-5 h-5" /> :
                                            <Clock class="w-5 h-5" />}
                                </div>
                                <div class="text-center">
                                    <div class={`text-[10px] font-black uppercase tracking-widest ${step.status === 'waiting' ? 'text-gray-600' : 'text-white'}`}>
                                        {step.label}
                                    </div>
                                    <div class="text-[9px] font-mono text-gray-500 mt-1">{step.time}</div>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* Details Grid */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <h4 class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Box class="w-3 h-3" /> Path Info
                    </h4>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-400">Source Chain</span>
                            <div class="flex items-center gap-2">
                                <img src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/eth.png`} class="w-4 h-4 rounded-full" />
                                <span class="text-xs font-bold text-white">{packet.srcChain}</span>
                            </div>
                        </div>
                        <div class="flex justify-center">
                            <ArrowRight class="w-4 h-4 text-gray-600 rotate-90 md:rotate-0" />
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-400">Destination Chain</span>
                            <div class="flex items-center gap-2">
                                <div class="w-4 h-4 rounded-full bg-blue-500" />
                                <span class="text-xs font-bold text-white">{packet.dstChain}</span>
                            </div>
                        </div>
                        <div class="flex justify-between items-center pt-2 border-t border-white/5">
                            <span class="text-xs text-gray-400">Nonce</span>
                            <span class="text-xs font-mono text-white">#{packet.nonce}</span>
                        </div>
                    </div>
                </div>

                <div class="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <h4 class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Shield class="w-3 h-3" /> Relayer Info
                    </h4>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-400">Relayer</span>
                            <span class="text-xs font-bold text-purple-400">{packet.relayer}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-400">Fee Paid</span>
                            <span class="text-xs font-mono text-white">0.0025 ETH</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-400">Payload Hash</span>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-mono text-gray-500">0x8a7...b29</span>
                                <Copy class="w-3 h-3 text-gray-600 cursor-pointer hover:text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </Motion.div>
    );
}
