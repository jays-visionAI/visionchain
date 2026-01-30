import { Component, createSignal, For, Show } from 'solid-js';
import {
    ArrowRightLeft,
    ArrowDown,
    Zap,
    ShieldCheck,
    Clock,
    ExternalLink,
    History,
    Settings2,
    Info,
    CheckCircle2,
    AlertCircle
} from 'lucide-solid';
import { Motion } from 'solid-motionone';

interface Transaction {
    id: string;
    from: string;
    to: string;
    amount: string;
    asset: string;
    status: 'Pending' | 'Challenged' | 'Finalized' | 'Reverted' | 'Processing' | 'Success';
    time: string;
    hash: string;
    timeRemaining?: number;  // seconds remaining in challenge period
    intentHash?: string;
}

const Bridge: Component = () => {
    const [fromNetwork, setFromNetwork] = createSignal('Ethereum Sepolia');
    const [toNetwork, setToNetwork] = createSignal('Vision Testnet v2');
    const [amount, setAmount] = createSignal('');
    const [selectedAsset, setSelectedAsset] = createSignal('VCN');
    const [isBridging, setIsBridging] = createSignal(false);
    const [step, setStep] = createSignal(1); // 1: Input, 2: Review, 3: Success

    const [transactions] = createSignal<Transaction[]>([
        { id: '1', from: 'Ethereum Sepolia', to: 'Vision Testnet v2', amount: '250.00', asset: 'VCN', status: 'Success', time: '10 mins ago', hash: '0x3a...f42' },
        { id: '2', from: 'Vision Testnet v2', to: 'Ethereum Sepolia', amount: '12.50', asset: 'ETH', status: 'Processing', time: '2 mins ago', hash: '0x1c...a9b' },
    ]);

    const handleSwitch = () => {
        const temp = fromNetwork();
        setFromNetwork(toNetwork());
        setToNetwork(temp);
    };

    const handleBridge = async () => {
        setIsBridging(true);
        // Simulate bridge delay
        setTimeout(() => {
            setIsBridging(false);
            setStep(3);
        }, 3000);
    };

    return (
        <div class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8">
            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <div class="text-center mb-12">
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 class="text-4xl md:text-6xl font-black italic tracking-tighter mb-4">VISION BRIDGE</h1>
                        <p class="text-slate-400 font-medium uppercase tracking-[0.2em] text-[10px]">
                            Seamless Asset Migration • High-Throughput Liquidity
                        </p>
                    </Motion.div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">

                    {/* Main Bridge UI */}
                    <div class="lg:col-span-3 space-y-6">
                        <div class="bg-[#111113]/40 border border-white/[0.06] rounded-[32px] p-8 shadow-2xl relative overflow-hidden group">
                            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                            <Show when={step() === 1 || step() === 2}>
                                {/* Swap Interface */}
                                <div class="relative z-10 space-y-4">

                                    {/* From Network */}
                                    <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 transition-all focus-within:border-blue-500/50">
                                        <div class="flex justify-between items-center mb-3">
                                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">From Network</span>
                                            <span class="text-[10px] font-bold text-blue-400">Balance: 12,450.00 {selectedAsset()}</span>
                                        </div>
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/20">
                                                <Zap class="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div class="flex-1">
                                                <div class="text-lg font-black italic uppercase tracking-tight">{fromNetwork()}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Switch Button */}
                                    <div class="flex justify-center -my-6 relative z-20">
                                        <button
                                            onClick={handleSwitch}
                                            class="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 hover:scale-110 active:scale-95 transition-all border-4 border-[#0c0c0c]"
                                        >
                                            <ArrowDown class="w-5 h-5 text-white" />
                                        </button>
                                    </div>

                                    {/* To Network */}
                                    <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 transition-all">
                                        <div class="flex justify-between items-center mb-3">
                                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">To Network</span>
                                        </div>
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center border border-purple-500/20">
                                                <Zap class="w-5 h-5 text-purple-400" />
                                            </div>
                                            <div class="flex-1">
                                                <div class="text-lg font-black italic uppercase tracking-tight">{toNetwork()}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Asset & Amount */}
                                    <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mt-4">
                                        <div class="flex justify-between items-center mb-4">
                                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount to Bridge</span>
                                            <div class="flex gap-2">
                                                <button class="px-2 py-1 bg-white/5 rounded text-[8px] font-bold hover:bg-white/10">25%</button>
                                                <button class="px-2 py-1 bg-white/5 rounded text-[8px] font-bold hover:bg-white/10">50%</button>
                                                <button class="px-2 py-1 bg-white/5 rounded text-[8px] font-bold hover:bg-white/10">MAX</button>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-4">
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={amount()}
                                                onInput={(e) => setAmount(e.currentTarget.value)}
                                                class="bg-transparent border-none text-3xl font-black focus:outline-none w-full placeholder-slate-700"
                                            />
                                            <div class="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                                                <div class="w-5 h-5 rounded-full bg-blue-500" />
                                                <span class="font-bold text-sm tracking-tight">{selectedAsset()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary & Action */}
                                    <div class="pt-4 space-y-4">
                                        <div class="flex justify-between items-center text-[11px] text-slate-500 font-medium px-2">
                                            <span>Bridge Fee (Est.)</span>
                                            <span class="text-slate-300">0.0001 ETH</span>
                                        </div>
                                        <div class="flex justify-between items-center text-[11px] text-slate-500 font-medium px-2">
                                            <span>Estimated Arrival</span>
                                            <span class="text-slate-300">~2-3 Minutes</span>
                                        </div>

                                        <button
                                            onClick={handleBridge}
                                            disabled={!amount() || isBridging()}
                                            class="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                                        >
                                            <Show when={isBridging()} fallback={<ArrowRightLeft class="w-4 h-4" />}>
                                                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            </Show>
                                            {isBridging() ? 'INITIATING BRIDGE...' : 'START BRIDGE TRANSFER'}
                                        </button>
                                    </div>
                                </div>
                            </Show>

                            <Show when={step() === 3}>
                                {/* Success Interface */}
                                <div class="relative z-10 py-12 text-center space-y-6">
                                    <div class="w-20 h-20 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle2 class="w-10 h-10 text-green-500" />
                                    </div>
                                    <h2 class="text-3xl font-black italic tracking-tight">TRANSFER INITIATED!</h2>
                                    <p class="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                                        Your {amount()} {selectedAsset()} is on its way to {toNetwork()}. You can track the status below.
                                    </p>
                                    <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 max-w-xs mx-auto text-xs font-mono text-blue-400 break-all">
                                        Tx: 0x4f...a82d
                                    </div>
                                    <button
                                        onClick={() => setStep(1)}
                                        class="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all"
                                    >
                                        New Transfer
                                    </button>
                                </div>
                            </Show>
                        </div>

                        {/* Info Section */}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="bg-white/[0.03] border border-white/5 p-6 rounded-2xl space-y-3">
                                <div class="flex items-center gap-3 text-cyan-400">
                                    <ShieldCheck class="w-5 h-5" />
                                    <span class="text-[11px] font-black uppercase tracking-widest">Secure Lock-and-Mint</span>
                                </div>
                                <p class="text-[11px] text-slate-500 leading-relaxed font-medium">Assets are cryptographically locked on the source chain and minted as canonical tokens on Vision v2.</p>
                            </div>
                            <div class="bg-white/[0.03] border border-white/5 p-6 rounded-2xl space-y-3">
                                <div class="flex items-center gap-3 text-purple-400">
                                    <Zap class="w-5 h-5" />
                                    <span class="text-[11px] font-black uppercase tracking-widest">Instant Finality</span>
                                </div>
                                <p class="text-[11px] text-slate-500 leading-relaxed font-medium">Powered by Kafka Engine v2, cross-chain verification happens inside the sequencer enclave for micro-second proof.</p>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar: History & Activity */}
                    <div class="lg:col-span-2 space-y-6">

                        {/* Status Card */}
                        <div class="bg-blue-600/10 border border-blue-500/20 rounded-[32px] p-8">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest">Network Status</span>
                            </div>
                            <div class="text-2xl font-black italic mb-2 tracking-tight">BRIDGE OPERATIONAL</div>
                            <p class="text-xs text-blue-400/60 font-medium">L1-L2 Relay sync is healthy. Current average latency: 134ms.</p>
                        </div>

                        {/* Recent History */}
                        <div class="bg-[#0c0c0c] border border-white/10 rounded-[32px] p-8">
                            <div class="flex items-center justify-between mb-8">
                                <div class="flex items-center gap-3">
                                    <History class="w-5 h-5 text-slate-400" />
                                    <h3 class="text-sm font-black italic tracking-widest uppercase">Your Activity</h3>
                                </div>
                                <button class="text-[10px] font-bold text-slate-500 hover:text-white transition-colors">Clear</button>
                            </div>
                            <div class="space-y-6">
                                <For each={transactions()}>
                                    {(tx) => {
                                        const statusColors: Record<string, string> = {
                                            'Pending': 'bg-yellow-500/10 text-yellow-400',
                                            'Challenged': 'bg-red-500/10 text-red-400',
                                            'Finalized': 'bg-green-500/10 text-green-400',
                                            'Reverted': 'bg-red-500/10 text-red-400',
                                            'Processing': 'bg-blue-500/10 text-blue-400',
                                            'Success': 'bg-green-500/10 text-green-500'
                                        };
                                        const barColors: Record<string, string> = {
                                            'Pending': 'bg-yellow-500 animate-pulse',
                                            'Challenged': 'bg-red-500 animate-pulse',
                                            'Finalized': 'bg-green-500',
                                            'Reverted': 'bg-red-500',
                                            'Processing': 'bg-blue-500 animate-pulse',
                                            'Success': 'bg-green-500'
                                        };
                                        return (
                                            <div class="flex items-start gap-4 group">
                                                <div class={`w-1 h-10 rounded-full ${barColors[tx.status] || 'bg-gray-500'}`} />
                                                <div class="flex-1 min-w-0">
                                                    <div class="flex justify-between items-start mb-1">
                                                        <span class="text-xs font-black italic tracking-tight uppercase">{tx.amount} {tx.asset}</span>
                                                        <div class="flex items-center gap-2">
                                                            <Show when={tx.status === 'Pending' && tx.timeRemaining}>
                                                                <span class="text-[9px] font-mono text-yellow-400">
                                                                    <Clock class="w-3 h-3 inline mr-1" />
                                                                    {Math.floor((tx.timeRemaining || 0) / 60)}m {(tx.timeRemaining || 0) % 60}s
                                                                </span>
                                                            </Show>
                                                            <span class={`text-[9px] font-bold px-1.5 py-0.5 rounded ${statusColors[tx.status]}`}>
                                                                {tx.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div class="text-[10px] text-slate-500 font-medium truncate mb-1">
                                                        {tx.from} ➔ {tx.to}
                                                    </div>
                                                    <div class="flex items-center gap-3 text-[10px] text-slate-600">
                                                        <span>{tx.time}</span>
                                                        <a href="#" class="hover:text-blue-400 flex items-center gap-1">
                                                            {tx.hash} <ExternalLink class="w-2.5 h-2.5" />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Bridge;
