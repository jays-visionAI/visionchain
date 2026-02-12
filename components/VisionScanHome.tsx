import { createSignal, Show, For } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Search,
    TrendingUp,
    Activity,
    Database,
    Layers,
    Download,
    BarChart3,
    Globe,
    XCircle,
    CheckCircle2,
    ArrowRight
} from 'lucide-solid';
import { ethers } from 'ethers';
import LightSpeedBackground from './LightSpeedBackground';
import { getVcnPrice } from '../services/vcnPriceService';

const StatCard = (props: { label: string; value: string; subValue?: string; icon: any }) => (
    <div class="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
        <div class="flex items-center gap-3 text-gray-500 mb-2">
            <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400">
                {props.icon}
            </div>
            <span class="text-[10px] font-black uppercase tracking-widest">{props.label}</span>
        </div>
        <div class="flex items-baseline gap-2">
            <span class="text-xl font-black text-white">{props.value}</span>
            <Show when={props.subValue}>
                <span class="text-[10px] text-green-400 font-bold">{props.subValue}</span>
            </Show>
        </div>
    </div>
);

interface VisionScanHomeProps {
    onSearch: (term: string) => void;
    onViewChange: (view: 'blockchain' | 'accounting') => void;
    currentView: 'blockchain' | 'accounting';
    stats: {
        blockHeight: string;
        gasPrice: string;
    };
    addressBalance: string | null;
    latestTransactions: any[];
    limit: number;
    setLimit: (l: number) => void;
    page: number;
    setPage: (p: number) => void;
    notFoundTerm: string | null;
    setNotFoundTerm: (val: string | null) => void;
}

export default function VisionScanHome(props: VisionScanHomeProps) {
    const [searchTerm, setSearchTerm] = createSignal("");
    const [isExportModalOpen, setIsExportModalOpen] = createSignal(false);
    const [isExporting, setIsExporting] = createSignal(false);
    const [exportJobId, setExportJobId] = createSignal<string | null>(null);

    const handleSearch = () => {
        if (searchTerm().trim()) {
            props.onSearch(searchTerm().trim());
        }
    };

    const runExport = () => {
        setIsExporting(true);
        // Mock Backend Job Creation
        setTimeout(() => {
            setIsExporting(false);
            setExportJobId(`JOB-${Math.floor(Math.random() * 10000)}`);
        }, 2000);
    };

    return (
        <>
            {/* Export Modal (Phase 3) */}
            <Show when={isExportModalOpen()}>
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        class="bg-[#0c0c0c] border border-white/10 rounded-2xl p-8 max-w-md w-full relative"
                    >
                        <button
                            onClick={() => { setIsExportModalOpen(false); setExportJobId(null); }}
                            class="absolute top-4 right-4 text-gray-500 hover:text-white"
                        >
                            <XCircle class="w-5 h-5" />
                        </button>

                        <Show when={!exportJobId()} fallback={
                            <div class="text-center py-8">
                                <div class="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                                    <CheckCircle2 class="w-8 h-8 text-green-500" />
                                </div>
                                <h3 class="text-xl font-black italic text-white mb-2">EXPORT JOB STARTED</h3>
                                <p class="text-xs text-gray-400 mb-6">Your job <span class="text-blue-400 font-mono font-bold">{exportJobId()}</span> is processing.</p>
                                <button
                                    onClick={() => { setIsExportModalOpen(false); setExportJobId(null); }}
                                    class="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        }>
                            <h3 class="text-xl font-black italic text-white mb-6">NEW EXPORT JOB</h3>

                            <div class="space-y-4 mb-8">
                                <div>
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Date Range</label>
                                    <select class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500/50">
                                        <option>Last 30 Days</option>
                                        <option>This Quarter (Q3 2024)</option>
                                        <option>Year to Date</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Journal Rule Version</label>
                                    <div class="px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-400 flex items-center justify-between">
                                        <span>Latest (v1.2.0)</span>
                                        <span class="text-[9px] px-2 py-0.5 bg-blue-500/20 rounded uppercase">Recommended</span>
                                    </div>
                                </div>
                                <div>
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Format</label>
                                    <div class="grid grid-cols-2 gap-3">
                                        <button class="px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-xs font-black text-white hover:bg-white/10 transition-colors text-center">CSV</button>
                                        <button class="px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-black text-gray-500 hover:text-white transition-colors text-center">XLSX (Pro)</button>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={runExport}
                                disabled={isExporting()}
                                class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors flex items-center justify-center gap-2"
                            >
                                {isExporting() ? (
                                    <>
                                        <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Scheduling Job...
                                    </>
                                ) : (
                                    <>
                                        <Download class="w-4 h-4" />
                                        Create Export Job
                                    </>
                                )}
                            </button>
                        </Show>
                    </Motion.div>
                </div>
            </Show>

            {/* Search Hero */}
            <section class="relative px-6 py-24 border-b border-white/5 overflow-hidden">
                <div class="absolute inset-0 opacity-10">
                    <LightSpeedBackground />
                </div>
                <div class="max-w-4xl mx-auto relative z-10 text-center">
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div class="flex flex-col items-center gap-4 mb-6">
                            <h1 class="text-5xl md:text-7xl font-black tracking-tighter italic translate-y-2">VISION SCAN</h1>
                            <div class="flex items-center gap-3">
                                <div class="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest">Testnet v2 Beta</span>
                                </div>
                                <div class="px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
                                    <Globe class="w-3 h-3 text-gray-500" />
                                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Network: rpc.visionchain.co</span>
                                </div>
                            </div>
                        </div>
                        <p class="text-blue-500 font-black tracking-[0.3em] uppercase text-xs mb-10">Accounting-Grade Blockchain Explorer</p>
                    </Motion.div>

                    <div class="relative group mb-10">
                        <div class="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
                        <div class="relative bg-[#0c0c0c] border border-white/10 rounded-2xl flex items-center p-2">
                            <Search class="w-6 h-6 text-gray-500 ml-4" />
                            <input
                                type="text"
                                placeholder="Address / Tx Hash / Block / Token / Domain"
                                value={searchTerm()}
                                onInput={(e) => setSearchTerm(e.currentTarget.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                class="w-full bg-transparent border-none px-4 py-3 text-sm focus:outline-none placeholder-gray-600 font-medium text-white"
                            />
                            <button
                                onClick={handleSearch}
                                class="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors mr-1"
                            >
                                Search
                            </button>
                        </div>

                        {/* Error Message: Address Not Found */}
                        <Show when={props.notFoundTerm}>
                            <Motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                class="mt-4 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between text-left"
                            >
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                        <XCircle class="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 class="text-sm font-black text-white italic uppercase tracking-tight">Address Not Found</h4>
                                        <p class="text-xs text-gray-500 font-medium">The address <span class="text-red-400 font-mono">{props.notFoundTerm?.slice(0, 10)}...</span> has no recorded transactions on Vision Chain.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => props.setNotFoundTerm(null)}
                                    class="text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest px-3 py-1 transition-colors"
                                >
                                    Dismiss
                                </button>
                            </Motion.div>
                        </Show>

                        <Show when={props.addressBalance !== null}>
                            <Motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                class="mt-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-between"
                            >
                                <div class="flex items-center gap-3">
                                    <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Live Testnet Balance</span>
                                </div>
                                <div class="text-xl font-black text-white">{Number(props.addressBalance).toLocaleString()} VCN</div>
                            </Motion.div>
                        </Show>
                    </div>

                    <div class="flex flex-wrap justify-center gap-4">
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            class="px-8 py-3 bg-white hover:bg-gray-200 text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            <Download class="w-4 h-4" />
                            Export Journal
                        </button>
                        <button
                            onClick={() => props.onViewChange('accounting')}
                            class={`px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${props.currentView === 'accounting' ? 'ring-1 ring-blue-500' : ''}`}
                        >
                            <BarChart3 class="w-4 h-4" />
                            Accounting View
                        </button>
                    </div>
                </div>
            </section>

            {/* Network Stats */}
            <div class="max-w-7xl mx-auto px-6 -mt-10 mb-12 relative z-20">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                    <StatCard label="TESTNET VCN INDEX" value={`$${getVcnPrice().toFixed(4)}`} subValue="+12.42%" icon={<TrendingUp class="w-4 h-4 text-green-400" />} />
                    <StatCard label="TESTNET THROUGHPUT" value={`${(142.82 + (Number(props.stats.blockHeight.replace(/,/g, '')) % 50) / 10).toFixed(2)}M`} subValue="LIVE" icon={<Activity class="w-4 h-4 text-blue-400" />} />
                    <StatCard label="v2 BLOCK HEIGHT" value={props.stats.blockHeight} icon={<Database class="w-4 h-4 text-blue-500" />} />
                    <StatCard label="GAS SETTLEMENT (v2)" value={`${props.stats.gasPrice} GWEI`} icon={<Layers class="w-4 h-4 text-blue-500" />} />
                </div>

                {/* Latest Transactions Table */}
                <div class="mb-12">
                    <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <h3 class="text-xl font-black text-white italic flex items-center gap-2">
                            <Activity class="w-5 h-5 text-blue-500" />
                            LATEST NETWORK TRANSACTIONS
                        </h3>

                        {/* Transaction Limit Sorter */}
                        <div class="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                            <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest px-2">Show:</span>
                            <For each={[20, 50, 100]}>
                                {(l) => (
                                    <button
                                        onClick={() => props.setLimit(l)}
                                        class={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${props.limit === l ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        {l}
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>
                    <div class="bg-[#0c0c0c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-widest text-gray-500">
                                    <th class="p-4 font-black">Tx Hash</th>
                                    <th class="p-4 font-black">Type</th>
                                    <th class="p-4 font-black hidden lg:table-cell">From / To</th>
                                    <th class="p-4 font-black text-right">Historical Basis (USD)</th>
                                    <th class="p-4 font-black text-right">Market Value (USD)</th>
                                    <th class="p-4 font-black text-right hidden md:table-cell">Amount</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5">
                                <For each={props.latestTransactions}>
                                    {(tx: any) => {
                                        const amount = parseFloat(tx.value || '0');
                                        const historicalBasis = amount * (4.25 + (parseInt(tx.hash.slice(-1), 16) / 50)); // Pseudo-historical
                                        const marketValue = amount * getVcnPrice();

                                        const getTransactionType = (t: string, m: string) => {
                                            if (t === 'Transfer') return { label: 'Asset', color: 'bg-green-500/10 text-green-400 border-green-500/20' };
                                            if (m?.toLowerCase().includes('swap')) return { label: 'Swap', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
                                            if (m?.toLowerCase().includes('stake')) return { label: 'Stake', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
                                            if (m?.toLowerCase().includes('bridge')) return { label: 'Bridge', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', isBridge: true };
                                            if (m?.toLowerCase().includes('journal')) return { label: 'Accounting', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
                                            return { label: 'Protocol', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
                                        };

                                        const typeInfo = getTransactionType(tx.type, tx.method);

                                        return (
                                            <tr
                                                class="hover:bg-white/5 transition-colors cursor-pointer group"
                                                onClick={() => props.onSearch(tx.hash)}
                                            >
                                                <td class="p-4 font-mono text-xs text-blue-400 group-hover:text-blue-300 transition-colors">
                                                    {tx.hash.slice(0, 10)}...{tx.hash.slice(-4)}
                                                </td>
                                                <td class="p-4">
                                                    <span class={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${typeInfo.color}`}>
                                                        {typeInfo.label}
                                                    </span>
                                                    {/* Bridge Pending Status */}
                                                    <Show when={(typeInfo as any).isBridge && tx.bridgeStatus !== 'FINALIZED' && tx.bridgeStatus !== 'COMPLETED' && tx.bridgeStatus !== 'FULFILLED'}>
                                                        <div class={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold ${tx.bridgeStatus === 'CHALLENGED' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                                                            }`}>
                                                            <span class={`w-1.5 h-1.5 rounded-full animate-pulse ${tx.bridgeStatus === 'CHALLENGED' ? 'bg-red-400' : 'bg-amber-400'
                                                                }`} />
                                                            {tx.bridgeStatus === 'CHALLENGED' ? 'Challenged' : 'Pending'}
                                                        </div>
                                                    </Show>
                                                    <Show when={(typeInfo as any).isBridge && (tx.bridgeStatus === 'FINALIZED' || tx.bridgeStatus === 'COMPLETED' || tx.bridgeStatus === 'FULFILLED')}>
                                                        <div class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-green-500/10 text-green-400">
                                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                                            Completed
                                                        </div>
                                                    </Show>
                                                </td>
                                                <td class="p-4 hidden lg:table-cell">
                                                    <div class="flex items-center gap-2 text-[10px] font-mono text-gray-500">
                                                        <span>{tx.from ? tx.from.slice(0, 6) + '...' + tx.from.slice(-4) : '-'}</span>
                                                        <ArrowRight class="w-3 h-3 text-gray-700" />
                                                        <span>{tx.to ? tx.to.slice(0, 6) + '...' + tx.to.slice(-4) : '-'}</span>
                                                    </div>
                                                </td>
                                                <td class="p-4 text-right">
                                                    <div class="text-xs font-bold text-white">${historicalBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    <div class="text-[9px] text-gray-600 uppercase font-black">Historical Basis</div>
                                                </td>
                                                <td class="p-4 text-right">
                                                    <div class="text-xs font-bold text-blue-400">${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    <div class="text-[9px] text-blue-900 uppercase font-black">Current Market</div>
                                                </td>
                                                <td class="p-4 text-right text-xs font-bold text-gray-400 hidden md:table-cell font-mono">
                                                    {amount.toLocaleString()} VCN
                                                </td>
                                            </tr>
                                        );
                                    }}
                                </For>
                                <Show when={!props.latestTransactions || props.latestTransactions.length === 0}>
                                    <tr>
                                        <td colspan="7" class="p-8 text-center text-gray-500 italic text-sm">
                                            Loading live network data...
                                        </td>
                                    </tr>
                                </Show>
                            </tbody>
                        </table>

                        {/* Pagination Footer */}
                        <div class="px-6 py-4 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
                            <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                Page <span class="text-blue-500">{props.page}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button
                                    onClick={() => props.setPage(Math.max(1, props.page - 1))}
                                    disabled={props.page === 1}
                                    class="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => props.setPage(props.page + 1)}
                                    disabled={!props.latestTransactions || props.latestTransactions.length < props.limit}
                                    class="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Enterprise Footer (Phase 4) */}
                <div class="flex justify-center">
                    <a href="#" class="text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors flex items-center gap-2 group">
                        <Database class="w-3 h-3 text-gray-600 group-hover:text-blue-500 transition-colors" />
                        Enterprise Data Warehouse (BigQuery) →
                    </a>
                </div>
            </div>
        </>
    );
}
