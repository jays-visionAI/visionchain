import { createSignal, For, Show, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownLeft,
    RefreshCw,
    Database,
    Layers,
    FileText,
    Download,
    Eye,
    ChevronRight,
    TrendingUp,
    ShieldCheck,
    Clock,
    Hash,
    LineChart,
    Globe,
    Activity,
    Calendar,
    User,
    ArrowRightLeft,
    Settings2,
    Shield,
    AlertCircle,
    CheckCircle2,
    Info,
    ExternalLink,
    Split,
    ArrowRight,
    X,
    Maximize2,
    BarChart3
} from 'lucide-solid';
import { ethers } from 'ethers';
import LightSpeedBackground from './LightSpeedBackground';

// Mock Blockchain Data
const latestBlocks = [
    { number: '18,482,931', miner: 'Vision Node #4', txs: 142, time: '12s ago', reward: '2.14 VCN' },
    { number: '18,482,930', miner: 'Starlight Prime', txs: 89, time: '24s ago', reward: '1.98 VCN' },
    { number: '18,482,929', miner: 'Vision Node #12', txs: 215, time: '36s ago', reward: '3.42 VCN' },
];

const mockTransactions = [
    {
        hash: '0x3a2b...f910',
        type: 'S200',
        method: 'Swap',
        from: '0x7F3A...BE29',
        to: 'Uniswap V3',
        value: '14.5 ETH',
        time: '2m ago',
        status: 'completed',
        asset: 'ETH/USDC',
        direction: 'out',
        counterparty: 'Uniswap',
        timestamp: new Date().getTime() - 120000,
        confidence: 98,
        trustStatus: 'tagged',
        path: ['Ethereum', 'Vision Chain'],
        accountingBasis: 'Accrual',
        taxCategory: 'Taxable',
        netEffect: [
            { asset: 'ETH', amount: '+14.5', type: 'debit' },
            { asset: 'USDC', amount: '-29,400', type: 'credit' }
        ],
        journalEntries: [
            { account: 'DigitalAssets:ETH', amount: '14.50', type: 'Dr' },
            { account: 'DigitalAssets:USDC', amount: '29,400.00', type: 'Cr' },
            { account: 'Expense:Gas', amount: '0.0042', type: 'Dr' },
            { account: 'Cash:Native', amount: '0.0042', type: 'Cr' }
        ],
        fees: { gas: 0.0042, protocol: 0 }
    },
    {
        hash: '0x9dE2...4A1B',
        type: 'A110',
        method: 'Transfer',
        from: 'Binance',
        to: '0x3C1F...8B02',
        value: '50,000 VCN',
        time: '5m ago',
        status: 'completed',
        asset: 'VCN',
        direction: 'in',
        counterparty: 'Binance',
        timestamp: new Date().getTime() - 300000,
        confidence: 95,
        trustStatus: 'attested',
        path: ['Vision Chain'],
        accountingBasis: 'Cash',
        taxCategory: 'Tax-Exempt',
        netEffect: [
            { asset: 'VCN', amount: '+50,000', type: 'debit' }
        ],
        journalEntries: [
            { account: 'DigitalAssets:VCN', amount: '50,000.00', type: 'Dr' },
            { account: 'Equity:Revenue', amount: '50,000.00', type: 'Cr' }
        ],
        fees: { gas: 0.0001, protocol: 0 }
    },
    {
        hash: '0x1A2B...3C4D',
        type: 'R500',
        method: 'Claim',
        from: 'Staking Pool',
        to: '0x5E6F...7G8H',
        value: '1,200 VCN',
        time: '12m ago',
        status: 'completed',
        asset: 'VCN',
        direction: 'in',
        counterparty: 'Staking Pool',
        timestamp: new Date().getTime() - 720000,
        confidence: 85,
        trustStatus: 'inferred',
        path: ['Vision Chain'],
        accountingBasis: 'Accrual',
        taxCategory: 'Taxable',
        netEffect: [
            { asset: 'VCN', amount: '+1,200', type: 'debit' }
        ],
        journalEntries: [
            { account: 'DigitalAssets:VCN', amount: '1,200.00', type: 'Dr' },
            { account: 'Revenue:Rewards', amount: '1,200.00', type: 'Cr' }
        ],
        fees: { gas: 0.0002, protocol: 0 }
    },
    {
        hash: '0x5E6F...7G8H',
        type: 'B410',
        method: 'Bridge In',
        from: 'Arbitrum',
        to: 'Vision Gateway',
        value: '2.5 ETH',
        time: '18m ago',
        status: 'processing',
        asset: 'ETH',
        direction: 'in',
        counterparty: 'Arbitrum',
        timestamp: new Date().getTime() - 1080000,
        confidence: 99,
        trustStatus: 'tagged',
        path: ['Arbitrum', 'Vision Chain'],
        accountingBasis: 'Accrual',
        taxCategory: 'Non-Taxable',
        netEffect: [
            { asset: 'ETH', amount: '+2.5', type: 'debit' }
        ],
        journalEntries: [
            { account: 'DigitalAssets:ETH', amount: '2.50', type: 'Dr' },
            { account: 'Bridge:Transit', amount: '2.50', type: 'Cr' }
        ],
        fees: { gas: 0.0015, protocol: 0.0005 }
    },
    {
        hash: '0xBE29...7F3A',
        type: 'D600',
        method: 'Stake',
        from: '0x7F3A...BE29',
        to: 'Vision Staking',
        value: '10,000 VCN',
        time: '25m ago',
        status: 'completed',
        asset: 'VCN',
        direction: 'out',
        counterparty: 'Vision Staking',
        timestamp: new Date().getTime() - 1500000,
        confidence: 99,
        trustStatus: 'tagged',
        path: ['Vision Chain'],
        accountingBasis: 'Cash',
        taxCategory: 'Non-Taxable',
        netEffect: [
            { asset: 'VCN', amount: '-10,000', type: 'credit' }
        ],
        journalEntries: [
            { account: 'Asset:StakedVCN', amount: '10,000.00', type: 'Dr' },
            { account: 'DigitalAssets:VCN', amount: '10,000.00', type: 'Cr' }
        ],
        fees: { gas: 0.0002, protocol: 0 }
    }
];

const StatCard = (props: { label: string; value: string; subValue?: string; icon: JSX.Element }) => (
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

export default function VisionScan() {
    const [view, setView] = createSignal<'blockchain' | 'accounting'>('accounting');
    const [typeFilter, setTypeFilter] = createSignal('All');
    const [periodFilter, setPeriodFilter] = createSignal('All Time');
    const [directionFilter, setDirectionFilter] = createSignal('All');
    const [counterpartyFilter, setCounterpartyFilter] = createSignal('All');
    const [basisFilter, setBasisFilter] = createSignal('All');
    const [taxFilter, setTaxFilter] = createSignal('All');
    const [confidenceThreshold, setConfidenceThreshold] = createSignal(0);
    const [isExporting, setIsExporting] = createSignal(false);
    const [isExportModalOpen, setIsExportModalOpen] = createSignal(false);
    const [selectedTx, setSelectedTx] = createSignal<any>(null);
    const [drawerTab, setDrawerTab] = createSignal<'overview' | 'accounting' | 'path' | 'evidence' | 'audit'>('overview');

    // Live Blockchain State
    const [blockHeight, setBlockHeight] = createSignal<string>('0');
    const [gasPrice, setGasPrice] = createSignal<string>('0');
    const [blocks, setBlocks] = createSignal<any[]>([]);
    const [isLive, setIsLive] = createSignal(false);

    const provider = new ethers.JsonRpcProvider("http://localhost:8545");

    const fetchLiveStats = async () => {
        try {
            const height = await provider.getBlockNumber();
            setBlockHeight(height.toLocaleString());

            const feeData = await provider.getFeeData();
            if (feeData.gasPrice) {
                setGasPrice((Number(ethers.formatUnits(feeData.gasPrice, 'gwei'))).toFixed(2));
            }

            // Fetch last 5 blocks
            const blockPromises = [];
            for (let i = 0; i < 5; i++) {
                blockPromises.push(provider.getBlock(height - i));
            }
            const blockResults = await Promise.all(blockPromises);
            setBlocks(blockResults.map(b => ({
                number: b?.number.toLocaleString(),
                miner: 'Vision Node',
                txs: b?.transactions.length,
                time: 'Just now',
                reward: '2.0 VCN'
            })));
            setIsLive(true);
        } catch (error) {
            console.error("RPC Connection Error:", error);
            setIsLive(false);
        }
    };

    // Polling for live data
    let timer: any;
    const startPolling = () => {
        fetchLiveStats();
        timer = setInterval(fetchLiveStats, 3000); // 3s block time simulation
    };

    startPolling();

    const handleExport = () => {
        setIsExportModalOpen(true);
    };

    const runExport = () => {
        setIsExporting(true);
        setTimeout(() => {
            setIsExporting(false);
            setIsExportModalOpen(false);
        }, 2000);
    };

    const filteredTransactions = createMemo(() => {
        return mockTransactions.filter(tx => {
            const matchesType = typeFilter() === 'All' || tx.type === typeFilter();
            const matchesDirection = directionFilter() === 'All' || tx.direction === directionFilter().toLowerCase();
            const matchesCounterparty = counterpartyFilter() === 'All' || tx.counterparty === counterpartyFilter();
            const matchesBasis = basisFilter() === 'All' || tx.accountingBasis === basisFilter();
            const matchesTax = taxFilter() === 'All' || tx.taxCategory === taxFilter();
            const matchesConfidence = tx.confidence >= confidenceThreshold();

            // Period filtering logic
            let matchesPeriod = true;
            const now = new Date().getTime();
            if (periodFilter() === 'Last 24h') {
                matchesPeriod = (now - tx.timestamp) <= 24 * 60 * 60 * 1000;
            } else if (periodFilter() === 'Last 7d') {
                matchesPeriod = (now - tx.timestamp) <= 7 * 24 * 60 * 60 * 1000;
            } else if (periodFilter() === 'Last 30d') {
                matchesPeriod = (now - tx.timestamp) <= 30 * 24 * 60 * 60 * 1000;
            }

            return matchesType && matchesDirection && matchesCounterparty && matchesPeriod && matchesBasis && matchesTax && matchesConfidence;
        });
    });

    return (
        <div class="bg-black min-h-screen text-white pt-20">
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
                        <h1 class="text-5xl md:text-7xl font-black tracking-tighter mb-4 italic translate-y-2">VISION SCAN</h1>
                        <p class="text-blue-500 font-black tracking-[0.3em] uppercase text-xs mb-10">Accounting-Grade Blockchain Explorer</p>
                    </Motion.div>

                    <div class="relative group mb-10">
                        <div class="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
                        <div class="relative bg-[#0c0c0c] border border-white/10 rounded-2xl flex items-center p-2">
                            <Search class="w-6 h-6 text-gray-500 ml-4" />
                            <input
                                type="text"
                                placeholder="Address / Tx Hash / Block / Token / Domain"
                                class="w-full bg-transparent border-none px-4 py-3 text-sm focus:outline-none placeholder-gray-600 font-medium"
                            />
                            <button class="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors mr-1">
                                Search
                            </button>
                        </div>
                    </div>

                    <div class="flex flex-wrap justify-center gap-4">
                        <button
                            onClick={handleExport}
                            class="px-8 py-3 bg-white hover:bg-gray-200 text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            <Download class="w-4 h-4" />
                            Export Journal
                        </button>
                        <button
                            onClick={() => setView('accounting')}
                            class="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            <BarChart3 class="w-4 h-4" />
                            Accounting View
                        </button>
                    </div>
                </div>
            </section>

            {/* Network Stats */}
            <div class="max-w-7xl mx-auto px-6 -mt-10 mb-12 relative z-20">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="VCN INDEX" value="$4.8219" subValue="+12.42%" icon={<TrendingUp class="w-4 h-4" />} />
                    <StatCard label="NETWORK THROUGHPUT" value="142.82M" subValue="14.2 TPS" icon={<Activity class="w-4 h-4" />} />
                    <StatCard label="BLOCK HEIGHT" value={blockHeight()} icon={<Database class="w-4 h-4 text-secondary-500" />} />
                    <StatCard label="GAS SETTLEMENT" value={`${gasPrice()} GWEI`} icon={<Layers class="w-4 h-4 text-blue-500" />} />
                </div>
            </div>

            <main class="max-w-7xl mx-auto px-6 pb-32">
                {/* View Mode Toggle */}
                <div class="flex items-center justify-center mb-12">
                    <div class="bg-white/5 border border-white/10 p-1 rounded-2xl flex gap-1">
                        <button
                            onClick={() => setView('blockchain')}
                            class={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view() === 'blockchain' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
                        >
                            Blockchain View
                        </button>
                        <button
                            onClick={() => setView('accounting')}
                            class={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view() === 'accounting' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
                        >
                            Accounting View
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Main Content Area */}
                    <div class="lg:col-span-8 space-y-6">
                        {/* Advanced Filters */}
                        <div class="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-8">
                            <div class="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                                <Filter class="w-4 h-4 text-blue-500" />
                                <span class="text-[10px] font-black uppercase tracking-widest italic">Accounting Filters Panel</span>
                            </div>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Clock class="w-3 h-3" /> Period
                                    </label>
                                    <select
                                        value={periodFilter()}
                                        onChange={(e) => setPeriodFilter(e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        {['All Time', 'Last 24h', 'Last 7d', 'Last 30d'].map(f => (
                                            <option value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <User class="w-3 h-3" /> Counterparty
                                    </label>
                                    <select
                                        value={counterpartyFilter()}
                                        onChange={(e) => setCounterpartyFilter(e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        {['All', 'Binance', 'Uniswap', 'Curve', 'Arbitrum', 'Optimism'].map(f => (
                                            <option value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <LineChart class="w-3 h-3" /> Basis
                                    </label>
                                    <select
                                        value={basisFilter()}
                                        onChange={(e) => setBasisFilter(e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        {['All', 'Cash', 'Accrual'].map(f => (
                                            <option value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Shield class="w-3 h-3" /> confidence
                                    </label>
                                    <select
                                        value={confidenceThreshold()}
                                        onChange={(e) => setConfidenceThreshold(Number(e.currentTarget.value))}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        <option value="0">All Confidence</option>
                                        <option value="70">≥ 70%</option>
                                        <option value="90">≥ 90%</option>
                                        <option value="99">≥ 99%</option>
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Settings2 class="w-3 h-3" /> Type
                                    </label>
                                    <select
                                        value={typeFilter()}
                                        onChange={(e) => setTypeFilter(e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        {['All', 'A110', 'S200', 'B410', 'R500', 'D600'].map(f => (
                                            <option value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <ArrowRightLeft class="w-3 h-3" /> Direction
                                    </label>
                                    <select
                                        value={directionFilter()}
                                        onChange={(e) => setDirectionFilter(e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        {['All', 'In', 'Out'].map(f => (
                                            <option value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Globe class="w-3 h-3" /> Tax Category
                                    </label>
                                    <select
                                        value={taxFilter()}
                                        onChange={(e) => setTaxFilter(e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        {['All', 'Taxable', 'Non-Taxable', 'Tax-Exempt'].map(f => (
                                            <option value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Layers class="w-3 h-3" /> Asset Class
                                    </label>
                                    <select
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        {['All', 'Token', 'NFT', 'Gas'].map(f => (
                                            <option value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                            <div class="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div class="flex items-center gap-3">
                                    <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${view() === 'accounting' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                        <Activity class="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 class="font-black italic text-sm tracking-tight">TRANSACTION JOURNAL</h3>
                                        <div class="flex items-center gap-2">
                                            <span class={`text-[9px] font-black uppercase tracking-widest ${view() === 'accounting' ? 'text-blue-500' : 'text-gray-500'}`}>
                                                {view() === 'accounting' ? 'Accounting Ledger Mode' : 'On-Chain Explorer Mode'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                        {filteredTransactions().length} Records
                                    </div>
                                    <div class={`px-3 py-1.5 border rounded-lg text-[9px] font-black uppercase tracking-widest ${isLive() ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                        {isLive() ? 'Live' : 'Offline'}
                                    </div>
                                </div>
                            </div>

                            <div class="overflow-x-auto">
                                <table class="w-full text-left">
                                    <thead>
                                        <tr class={`text-[10px] font-black uppercase tracking-widest border-b border-white/5 transition-colors duration-500 ${view() === 'accounting' ? 'bg-blue-500/5 text-blue-400/70' : 'bg-white/[0.01] text-gray-600'}`}>
                                            <th class="px-6 py-4">TX Hash</th>
                                            <Show when={view() === 'blockchain'}>
                                                <th class="px-6 py-4">Type</th>
                                                <th class="px-6 py-4">Direction</th>
                                                <th class="px-6 py-4">Counterparty</th>
                                                <th class="px-6 py-4">Value</th>
                                                <th class="px-6 py-4">Age</th>
                                            </Show>
                                            <Show when={view() === 'accounting'}>
                                                <th class="px-6 py-4">Taxonomy & Entity</th>
                                                <th class="px-6 py-4">GL Impact (Dr/Cr)</th>
                                                <th class="px-6 py-4">Audit Status</th>
                                                <th class="px-6 py-4">Confidence</th>
                                                <th class="px-6 py-4">Ledger Path</th>
                                            </Show>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/5">
                                        <For each={filteredTransactions()}>
                                            {(tx) => (
                                                <tr
                                                    onClick={() => setSelectedTx(tx)}
                                                    class="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                                                >
                                                    <td class="px-6 py-4">
                                                        <div class="flex items-center gap-3">
                                                            <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                                <FileText class="w-4 h-4" />
                                                            </div>
                                                            <span class="text-xs font-mono text-blue-400 group-hover:text-blue-300 transition-colors">{tx.hash}</span>
                                                        </div>
                                                    </td>

                                                    <Show when={view() === 'blockchain'}>
                                                        <td class="px-6 py-4">
                                                            <span class="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-black text-gray-400 uppercase">{tx.type}</span>
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <span class={`flex items-center gap-1.5 text-[9px] font-black uppercase ${tx.direction === 'in' ? 'text-green-400' : 'text-orange-400'}`}>
                                                                {tx.direction === 'in' ? <ArrowDownLeft class="w-3 h-3" /> : <ArrowUpRight class="w-3 h-3" />}
                                                                {tx.direction}
                                                            </span>
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <span class="text-xs font-bold text-white">{tx.counterparty}</span>
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <div class="flex flex-col">
                                                                <span class="text-xs font-black text-white">{tx.value}</span>
                                                                <span class="text-[9px] text-gray-500 font-bold uppercase">{tx.asset}</span>
                                                            </div>
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <span class="text-[10px] font-bold text-gray-500 uppercase">{tx.time}</span>
                                                        </td>
                                                    </Show>

                                                    <Show when={view() === 'accounting'}>
                                                        <td class="px-6 py-4">
                                                            <div class="flex flex-col gap-1">
                                                                <div class="flex items-center gap-2">
                                                                    <span class="text-[9px] font-black px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded">{tx.type}</span>
                                                                    <span class="text-xs font-black text-white italic">{tx.method}</span>
                                                                </div>
                                                                <span class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Entity: {tx.counterparty}</span>
                                                            </div>
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <div class="flex flex-col gap-1">
                                                                <For each={tx.netEffect}>
                                                                    {(effect: any) => (
                                                                        <div class="flex items-center gap-2">
                                                                            <span class={`text-[8px] font-black uppercase px-1 rounded ${effect.type === 'debit' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                                                                {effect.type === 'debit' ? 'DR' : 'CR'}
                                                                            </span>
                                                                            <span class={`text-[10px] font-mono font-black ${effect.type === 'debit' ? 'text-green-400' : 'text-orange-400'}`}>
                                                                                {effect.amount} {effect.asset}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </For>
                                                            </div>
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <div class="flex items-center gap-1.5">
                                                                <div class={`w-2 h-2 rounded-full shadow-[0_0_8px] ${tx.trustStatus === 'tagged' ? 'bg-green-500 shadow-green-500/50' :
                                                                    tx.trustStatus === 'attested' ? 'bg-yellow-500 shadow-yellow-500/50' :
                                                                        tx.trustStatus === 'inferred' ? 'bg-blue-500 shadow-blue-500/50' : 'bg-red-500 shadow-red-500/50'
                                                                    }`} />
                                                                <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                                                    {tx.trustStatus === 'tagged' ? 'On-Chain Tagged' :
                                                                        tx.trustStatus === 'attested' ? 'Multi-Sig Attested' :
                                                                            tx.trustStatus === 'inferred' ? 'Explorer Inferred' : 'Consensus Conflict'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <div class="w-24 space-y-1.5">
                                                                <div class="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-tighter">
                                                                    <span>Scoring</span>
                                                                    <span class={tx.confidence > 90 ? 'text-green-400' : 'text-yellow-400'}>{tx.confidence}%</span>
                                                                </div>
                                                                <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                                    <div
                                                                        class={`h-full transition-all duration-1000 ${tx.confidence > 90 ? 'bg-green-500' : tx.confidence > 80 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                                                                        style={{ width: `${tx.confidence}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <div class="flex items-center gap-1">
                                                                <For each={tx.path}>
                                                                    {(chain, i) => (
                                                                        <>
                                                                            <span class="text-[9px] font-black px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-gray-400 whitespace-nowrap">{chain as string}</span>
                                                                            <Show when={i() < tx.path.length - 1}>
                                                                                <ChevronRight class="w-2 h-2 text-gray-600" />
                                                                            </Show>
                                                                        </>
                                                                    )}
                                                                </For>
                                                            </div>
                                                        </td>
                                                    </Show>
                                                </tr>
                                            )}
                                        </For>
                                        <Show when={filteredTransactions().length === 0}>
                                            <tr>
                                                <td colspan="6" class="px-6 py-20 text-center text-gray-500 font-bold italic text-sm">
                                                    No transactions match the selected filters.
                                                </td>
                                            </tr>
                                        </Show>
                                    </tbody>
                                </table>
                            </div>
                            <div class="p-4 bg-white/[0.01] text-center border-t border-white/5">
                                <button class="text-[10px] font-black text-gray-500 hover:text-blue-500 uppercase tracking-widest transition-colors">View All Transactions</button>
                            </div>
                        </div>
                    </div>

                    {/* Stats/Blocks Sidebar */}
                    <div class="lg:col-span-4 space-y-6">
                        {/* Latest Blocks */}
                        <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                            <div class="p-6 border-b border-white/5">
                                <h3 class="font-bold flex items-center gap-3 italic text-xs">
                                    <Database class="w-4 h-4 text-purple-500" />
                                    LATEST BLOCKS
                                </h3>
                            </div>
                            <div class="divide-y divide-white/5">
                                <For each={blocks().length > 0 ? blocks() : latestBlocks}>
                                    {(block) => (
                                        <div class="p-4 hover:bg-white/[0.02] transition-colors">
                                            <div class="flex justify-between items-center mb-1">
                                                <span class="text-xs font-mono text-blue-400 font-bold">#{block.number}</span>
                                                <span class="text-[9px] text-gray-500 font-bold uppercase">{block.time}</span>
                                            </div>
                                            <div class="flex justify-between items-center">
                                                <div class="flex flex-col">
                                                    <span class="text-[10px] text-gray-400 font-bold italic">By {block.miner}</span>
                                                    <span class="text-[9px] text-blue-500/70">{block.txs} txn in 1s</span>
                                                </div>
                                                <div class="px-2 py-1 bg-white/5 rounded text-[9px] font-black text-white">{block.reward}</div>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                            <div class="p-4 bg-white/[0.01] text-center border-t border-white/5">
                                <button class="text-[10px] font-black text-gray-500 hover:text-purple-500 uppercase tracking-widest transition-colors">View All Blocks</button>
                            </div>
                        </div>

                        {/* Accounting Features Promo */}
                        <div class="p-6 rounded-2xl bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 relative overflow-hidden group">
                            <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <ShieldCheck class="w-16 h-16 text-blue-400" />
                            </div>
                            <h4 class="text-sm font-black uppercase tracking-widest mb-3 italic">Enterprise Ready</h4>
                            <p class="text-xs text-gray-400 leading-relaxed mb-6">
                                Vision Scan turns high-speed blockchain activity into accounting-grade journal entries.
                            </p>
                            <ul class="space-y-3 mb-6">
                                <li class="flex items-center gap-3 text-[10px] font-bold text-gray-300">
                                    <div class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    GAAP/IFRS Compliant Exports
                                </li>
                                <li class="flex items-center gap-3 text-[10px] font-bold text-gray-300">
                                    <div class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    Taxonomy Coding (A100-G700)
                                </li>
                                <li class="flex items-center gap-3 text-[10px] font-bold text-gray-300">
                                    <div class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    Cross-Chain Normalization
                                </li>
                            </ul>
                            <button class="w-full py-3 bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                                Request ERP Key
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Transaction Classification & Accounting Drawer */}
            <Show when={selectedTx()}>
                <div class="fixed inset-0 z-[100] flex justify-end">
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedTx(null)}
                        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <Motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ duration: 0.4, easing: [0.22, 1, 0.36, 1] }}
                        class="relative w-full max-w-xl bg-[#0c0c0c] border-l border-white/10 h-full overflow-y-auto"
                    >
                        <div class="p-8">
                            <div class="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                                        <ShieldCheck class="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 class="text-xl font-black italic tracking-tight">AUDIT CONSOLE</h2>
                                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Transaction Classification & Journal</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedTx(null)}
                                    class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                                >
                                    <X class="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            <div class="flex items-center gap-6 mb-8 border-b border-white/5">
                                {['overview', 'accounting', 'path', 'evidence', 'audit'].map((t: any) => (
                                    <button
                                        onClick={() => setDrawerTab(t)}
                                        class={`pb-4 text-[9px] font-black uppercase tracking-widest transition-colors relative ${drawerTab() === t ? 'text-blue-500' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        {t.replace('-', ' ')}
                                        {drawerTab() === t && <Motion.div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                                    </button>
                                ))}
                            </div>

                            <div class="space-y-8">
                                <Show when={drawerTab() === 'overview'}>
                                    {/* TX Header */}
                                    <div class="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                                        <div class="flex justify-between items-start mb-4">
                                            <div class="flex flex-col gap-1">
                                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Transaction Hash</span>
                                                <span class="text-xs font-mono text-blue-400">{selectedTx().hash}</span>
                                            </div>
                                            <button class="text-gray-500 hover:text-white transition-colors">
                                                <ExternalLink class="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="flex flex-col gap-1">
                                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</span>
                                                <span class="text-[10px] font-black text-green-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <CheckCircle2 class="w-3.5 h-3.5" />
                                                    {selectedTx().trustStatus === 'tagged' ? 'On-chain Tagged' : 'Verified'}
                                                </span>
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Timestamp</span>
                                                <span class="text-[10px] font-black text-white uppercase tracking-widest">{selectedTx().time}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section A: Classification */}
                                    <div>
                                        <div class="flex items-center gap-2 mb-4">
                                            <Layers class="w-4 h-4 text-purple-500" />
                                            <h3 class="text-[11px] font-black uppercase tracking-widest italic">A. Transaction Classification</h3>
                                        </div>
                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="bg-white/5 border border-white/5 p-4 rounded-xl">
                                                <span class="text-[9px] text-gray-500 font-black uppercase mb-1 block">Method / Type</span>
                                                <span class="text-xs font-black text-white">{selectedTx().method} ({selectedTx().type})</span>
                                            </div>
                                            <div class="bg-white/5 border border-white/5 p-4 rounded-xl">
                                                <span class="text-[9px] text-gray-500 font-black uppercase mb-1 block">Classification Source</span>
                                                <span class="text-xs font-black text-white uppercase italic">{selectedTx().trustStatus}</span>
                                            </div>
                                        </div>
                                        <div class="mt-4 bg-white/5 border border-white/5 p-4 rounded-xl">
                                            <div class="flex justify-between items-center mb-2">
                                                <span class="text-[9px] text-gray-500 font-black uppercase">Confidence Score</span>
                                                <span class="text-xs font-black text-blue-400">{selectedTx().confidence}%</span>
                                            </div>
                                            <div class="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                                                <div
                                                    class="h-full bg-blue-600 transition-all duration-1000"
                                                    style={{ width: `${selectedTx().confidence}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </Show>

                                <Show when={drawerTab() === 'accounting'}>
                                    {/* Section B: Journal Preview */}
                                    <div>
                                        <div class="flex items-center gap-2 mb-4">
                                            <FileText class="w-4 h-4 text-green-500" />
                                            <h3 class="text-[11px] font-black uppercase tracking-widest italic">B. Accounting Journal Preview</h3>
                                        </div>
                                        <div class="bg-black/40 border border-white/10 rounded-2xl overflow-hidden font-mono text-[10px]">
                                            <table class="w-full text-left">
                                                <thead>
                                                    <tr class="bg-white/5 border-b border-white/10 text-gray-500 font-black uppercase tracking-widest">
                                                        <th class="px-4 py-3">Account Header</th>
                                                        <th class="px-4 py-3 text-right">Debit</th>
                                                        <th class="px-4 py-3 text-right">Credit</th>
                                                    </tr>
                                                </thead>
                                                <tbody class="divide-y divide-white/5">
                                                    <For each={selectedTx().journalEntries}>
                                                        {(entry: any) => (
                                                            <tr>
                                                                <td class="px-4 py-3 text-white">{entry.account}</td>
                                                                <td class="px-4 py-3 text-right text-green-400">{entry.type === 'Dr' ? entry.amount : '-'}</td>
                                                                <td class="px-4 py-3 text-right text-orange-400">{entry.type === 'Cr' ? entry.amount : '-'}</td>
                                                            </tr>
                                                        )}
                                                    </For>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Section C: Fees & Costs */}
                                    <div class="mt-8">
                                        <div class="flex items-center gap-2 mb-4">
                                            <Activity class="w-4 h-4 text-orange-500" />
                                            <h3 class="text-[11px] font-black uppercase tracking-widest italic">C. Fees & Costs</h3>
                                        </div>
                                        <div class="space-y-3">
                                            <div class="flex justify-between items-center px-4 py-3 bg-white/5 border border-white/5 rounded-xl">
                                                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gas (Network) Fee</span>
                                                <span class="text-xs font-black text-white">{selectedTx().fees.gas} ETH</span>
                                            </div>
                                            <div class="flex justify-between items-center px-4 py-3 bg-white/5 border border-white/5 rounded-xl">
                                                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Protocol Service Fee</span>
                                                <span class="text-xs font-black text-white">{selectedTx().fees.protocol} ETH</span>
                                            </div>
                                        </div>
                                    </div>
                                </Show>

                                <Show when={drawerTab() === 'path'}>
                                    <div>
                                        <div class="flex items-center gap-2 mb-6">
                                            <Globe class="w-4 h-4 text-blue-500" />
                                            <h3 class="text-[11px] font-black uppercase tracking-widest italic">Cross-Chain Route</h3>
                                        </div>
                                        <div class="relative pl-8 space-y-12">
                                            <div class="absolute left-3.5 top-2 bottom-2 w-px bg-gradient-to-b from-blue-600 via-purple-600 to-indigo-600 opacity-30" />

                                            {selectedTx().path.map((chain: string, i: number) => (
                                                <div class="relative">
                                                    <div class="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-black border-2 border-blue-500 z-10" />
                                                    <div class="bg-white/5 border border-white/5 p-4 rounded-2xl">
                                                        <div class="flex justify-between items-center mb-1">
                                                            <span class="text-[10px] font-black text-blue-400 uppercase">{chain}</span>
                                                            <span class="text-[8px] text-gray-500 font-bold uppercase">{i === 0 ? 'Origin' : i === selectedTx().path.length - 1 ? 'Settlement' : 'Relay'}</span>
                                                        </div>
                                                        <span class="text-[11px] font-black text-white italic">{i === 0 ? 'Transaction Initiation' : i === selectedTx().path.length - 1 ? 'Final State Updates' : 'Cross-Chain Message'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Show>

                                <Show when={drawerTab() === 'evidence'}>
                                    <div class="space-y-6">
                                        <div class="bg-blue-600/5 border border-blue-600/10 rounded-2xl p-6">
                                            <div class="flex items-center gap-3 mb-4">
                                                <Shield class="w-5 h-5 text-blue-500" />
                                                <span class="text-xs font-black text-white uppercase tracking-widest italic">Cryptographic Proof</span>
                                            </div>
                                            <div class="space-y-4">
                                                <div class="flex flex-col gap-1.5">
                                                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Evidence Hash (CID)</span>
                                                    <span class="text-[10px] font-mono text-gray-400 break-all bg-black/40 p-3 rounded-lg border border-white/5">
                                                        QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco
                                                    </span>
                                                </div>
                                                <div class="flex flex-col gap-1.5">
                                                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Signers</span>
                                                    <div class="flex flex-wrap gap-2">
                                                        <span class="px-2 py-1 bg-white/5 rounded text-[8px] font-mono text-gray-400">0x71...29</span>
                                                        <span class="px-2 py-1 bg-white/5 rounded text-[8px] font-mono text-gray-400">0x42...f0</span>
                                                        <span class="px-2 py-1 bg-white/5 rounded text-[8px] font-mono text-gray-400">0xEE...11</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Show>

                                <Show when={drawerTab() === 'audit'}>
                                    <div class="space-y-4">
                                        {[
                                            { action: 'Classification Inferred', time: '2m ago', user: 'System (AI Indexer)' },
                                            { action: 'Protocol Attestation', time: '1m ago', user: 'Vision Node #4' },
                                            { action: 'Finality Confirmed', time: '1m ago', user: 'Vision Chain' },
                                            { action: 'Journal Export Created', time: 'Just now', user: 'User (You)' }
                                        ].map((log) => (
                                            <div class="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                                <div class="flex flex-col">
                                                    <span class="text-xs font-black text-white italic">{log.action}</span>
                                                    <span class="text-[9px] text-gray-500 font-bold uppercase">{log.user}</span>
                                                </div>
                                                <span class="text-[9px] text-gray-500 font-bold uppercase">{log.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Show>

                                <div class="pt-8 grid grid-cols-2 gap-4">
                                    <button class="py-4 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                                        <Info class="w-3.5 h-3.5" />
                                        Full Report
                                    </button>
                                    <button
                                        onClick={handleExport}
                                        class="py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                    >
                                        <Download class="w-3.5 h-3.5" />
                                        Export
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Motion.div>
                </div>
            </Show>
            {/* Enterprise Export Modal */}
            <Show when={isExportModalOpen()}>
                <div class="fixed inset-0 z-[200] flex items-center justify-center p-6">
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsExportModalOpen(false)}
                        class="absolute inset-0 bg-black/90 backdrop-blur-md"
                    />
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        class="relative w-full max-w-2xl bg-[#0c0c0c] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl shadow-blue-600/10"
                    >
                        <div class="p-10">
                            <div class="flex items-center justify-between mb-10">
                                <div class="flex items-center gap-4">
                                    <div class="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
                                        <Download class="w-6 h-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <h2 class="text-2xl font-black italic tracking-tight">EXPORT JOURNAL</h2>
                                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">GAAP / IFRS-Ready Enterprise Exports</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsExportModalOpen(false)}
                                    class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                                >
                                    <X class="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                {[
                                    { title: 'CSV General Ledger', desc: 'Standard spreadsheet format for general accounting.', icon: <FileText class="w-5 h-5 text-gray-400" /> },
                                    { title: 'XBRL-GL', desc: 'Interactive financial reporting format (XML).', icon: <Database class="w-5 h-5 text-blue-500" /> },
                                    { title: 'JSON-LD', desc: 'Semantic-web ready auditable records.', icon: <Layers class="w-5 h-5 text-purple-500" /> },
                                    { title: 'ERP Direct Sync', desc: 'Secure API bridge to NetSuite, SAP, or QuickBooks.', icon: <RefreshCw class="w-5 h-5 text-green-500" /> }
                                ].map((opt) => (
                                    <button class="flex items-start gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-left hover:bg-white/5 hover:border-blue-500/30 transition-all group">
                                        <div class="mt-1">{opt.icon}</div>
                                        <div>
                                            <h4 class="text-sm font-black italic uppercase mb-1 group-hover:text-blue-400 transition-colors">{opt.title}</h4>
                                            <p class="text-[10px] text-gray-500 leading-normal">{opt.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div class="bg-blue-600/5 border border-blue-600/10 rounded-2xl p-6 mb-10">
                                <div class="flex items-center gap-3 mb-3">
                                    <Shield class="w-4 h-4 text-blue-500" />
                                    <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest">Audit Evidence Included</span>
                                </div>
                                <p class="text-[10px] text-gray-400 leading-normal">
                                    All exports include cryptographically signed evidence hashes, schema versions, and trust provenance metadata for regulators and independent auditors.
                                </p>
                            </div>

                            <button
                                onClick={runExport}
                                disabled={isExporting()}
                                class="w-full py-5 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                <Show when={isExporting()} fallback={<Download class="w-4 h-4" />}>
                                    <RefreshCw class="w-4 h-4 animate-spin" />
                                </Show>
                                {isExporting() ? 'Generating Audit Package...' : 'Generate & Download Audit Package'}
                            </button>
                        </div>
                    </Motion.div>
                </div>
            </Show>
        </div>
    );
}
