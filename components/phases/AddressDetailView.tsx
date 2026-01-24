import { createSignal, Show, For } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Wallet,
    ShieldAlert,
    History,
    FileText,
    ArrowDownLeft,
    ArrowUpRight,
    Coins,
    Vote,
    AlertTriangle,
    CheckCircle2,
    X,
    BarChart3,
    Code,
    Activity
} from 'lucide-solid';

import ContractVerifyView from './ContractVerifyView';

interface AddressDetailProps {
    address: string;
    balance: string | null;
    transactions: any[];
    onViewTx: (tx: any) => void;
    onClose: () => void;
    chainType?: 'evm' | 'btc' | 'sol';
}

export default function AddressDetailView(props: AddressDetailProps) {
    const [activeTab, setActiveTab] = createSignal<'transactions' | 'approvals' | 'assets' | 'analytics' | 'contract'>('transactions');

    // Chain specific UI Logic
    const isEVM = () => !props.chainType || props.chainType === 'evm';

    // Mock Portfolio Data (Phase 4)
    const portfolioData = [
        { label: 'VCN', value: 75, color: 'bg-blue-500' },
        { label: 'Stablecoins', value: 15, color: 'bg-green-500' },
        { label: 'NFTs', value: 10, color: 'bg-purple-500' }
    ];

    // Mock Approvals Data
    const mockApprovals = [
        { token: 'USDT', spender: 'Uniswap V3 Router', amount: 'Unlimited', risk: 'high', time: '2d ago' },
        { token: 'WETH', spender: '0x88...2938 (Unknown)', amount: 'Unlimited', risk: 'critical', time: '5d ago' },
        { token: 'DAI', spender: 'Curve Pool', amount: '500.00', risk: 'low', time: '10d ago' },
    ];

    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            class=" max-w-7xl mx-auto px-6 pb-32"
        >
            {/* Header */}
            <div class="flex items-center justify-between mb-8 mt-8">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 border border-blue-600/30">
                        <Wallet class="w-6 h-6" />
                    </div>
                    <div>
                        <h1 class="text-2xl font-black italic tracking-tighter text-white">ADDRESS DETAILS</h1>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-sm font-mono text-gray-400">{props.address}</span>
                            <span class={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${props.chainType === 'btc' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                                    props.chainType === 'sol' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' :
                                        'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                }`}>
                                {props.chainType === 'btc' ? 'Bitcoin' : props.chainType === 'sol' ? 'Solana' : 'EOA'}
                            </span>
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

            {/* Stats Cards */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Total Balance</span>
                    <span class="text-2xl font-black text-white">{Number(props.balance || 0).toLocaleString()} VCN</span>
                </div>
                <div class="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Token Value</span>
                    <span class="text-2xl font-black text-white">$0.00</span>
                </div>
                <div class="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Transactions</span>
                    <span class="text-2xl font-black text-white">{props.transactions.length}</span>
                </div>
            </div>

            {/* Usage Warning (Phase 1) */}
            <div class="mb-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-orange-400 mt-0.5" />
                <div>
                    <h4 class="text-sm font-bold text-orange-400 mb-1">High Risk Approvals Detected</h4>
                    <p class="text-xs text-orange-300/80">
                        This address has unlimited token approvals for unknown contracts. Review the <strong>Approvals</strong> tab immediately.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div class="flex gap-4 border-b border-white/5 mb-8 overflow-x-auto">
                {[
                    { id: 'transactions', label: 'Transactions', icon: History },
                    { id: 'approvals', label: 'Token Approvals', icon: ShieldAlert },
                    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                    { id: 'contract', label: 'Contract', icon: Code },
                    { id: 'assets', label: 'Assets', icon: Coins }
                ].map((t) => (
                    <button
                        onClick={() => setActiveTab(t.id as any)}
                        class={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab() === t.id ? 'text-blue-500' : 'text-gray-500 hover:text-white'}`}
                    >
                        <t.icon class="w-4 h-4" />
                        {t.label}
                        {activeTab() === t.id && <Motion.div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                    </button>
                ))}
            </div>

            <Show when={activeTab() === 'transactions'}>
                <div class="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden mb-8">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-[10px] font-black uppercase tracking-widest bg-white/[0.01] text-gray-600 border-b border-white/5">
                                <th class="px-6 py-4">TX Hash</th>
                                <th class="px-6 py-4">Method</th>
                                <th class="px-6 py-4">Block</th>
                                <th class="px-6 py-4">From/To</th>
                                <th class="px-6 py-4">Value</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            <For each={props.transactions}>
                                {(tx) => (
                                    <tr onClick={() => props.onViewTx(tx)} class="hover:bg-white/[0.02] cursor-pointer transition-colors">
                                        <td class="px-6 py-4 text-xs font-mono text-blue-400">{tx.hash.slice(0, 10)}...</td>
                                        <td class="px-6 py-4">
                                            <span class="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-gray-300">{tx.method}</span>
                                        </td>
                                        <td class="px-6 py-4 text-xs text-gray-400">182931</td>
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-2">
                                                <span class={`p-1 rounded ${tx.direction === 'in' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                                    {tx.direction === 'in' ? <ArrowDownLeft class="w-3 h-3" /> : <ArrowUpRight class="w-3 h-3" />}
                                                </span>
                                                <span class="text-xs text-white">{tx.counterparty}</span>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 text-xs font-bold text-white">{tx.value}</td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
            </Show>

            <Show when={activeTab() === 'approvals'}>
                <div class="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-[10px] font-black uppercase tracking-widest bg-white/[0.01] text-gray-600 border-b border-white/5">
                                <th class="px-6 py-4">Token</th>
                                <th class="px-6 py-4">Spender</th>
                                <th class="px-6 py-4">Amount</th>
                                <th class="px-6 py-4">Risk Level</th>
                                <th class="px-6 py-4">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            <For each={mockApprovals}>
                                {(approval) => (
                                    <tr class="hover:bg-white/[0.02] transition-colors">
                                        <td class="px-6 py-4 text-xs font-bold text-white">{approval.token}</td>
                                        <td class="px-6 py-4 text-xs font-mono text-gray-400">{approval.spender}</td>
                                        <td class="px-6 py-4 text-xs text-gray-300">{approval.amount}</td>
                                        <td class="px-6 py-4">
                                            <span class={`px-2 py-1 rounded text-[9px] font-black uppercase ${approval.risk === 'critical' ? 'bg-red-500/20 text-red-500' : approval.risk === 'high' ? 'bg-orange-500/20 text-orange-500' : 'bg-green-500/20 text-green-500'}`}>
                                                {approval.risk}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4">
                                            <button class="text-[10px] font-bold text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1 rounded hover:bg-red-500/10 transition-colors">
                                                Revoke
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
            </Show>

            <Show when={activeTab() === 'analytics'}>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                        <h4 class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Portfolio Distribution</h4>

                        <div class="flex h-4 rounded-full overflow-hidden mb-4">
                            <For each={portfolioData}>
                                {(item) => <div class={`${item.color}`} style={{ width: `${item.value}%` }} />}
                            </For>
                        </div>
                        <div class="flex flex-wrap gap-4">
                            <For each={portfolioData}>
                                {(item) => (
                                    <div class="flex items-center gap-2">
                                        <div class={`w-2 h-2 rounded-full ${item.color}`} />
                                        <span class="text-xs font-bold text-gray-400">{item.label} ({item.value}%)</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                    <div class="bg-white/[0.02] border border-white/5 p-6 rounded-2xl flex items-center justify-center">
                        <div class="text-center">
                            <Activity class="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p class="text-xs text-gray-500 font-bold">Historical Net Worth Chart</p>
                            <p class="text-[10px] text-gray-600">(Coming in Phase 4.1)</p>
                        </div>
                    </div>
                </div>
            </Show>

            <Show when={activeTab() === 'contract'}>
                <ContractVerifyView />
            </Show>

            <Show when={activeTab() === 'assets'}>
                <div class="p-8 text-center text-gray-500 italic">
                    Asset Holdings (Coming in Phase 1 Part 2)
                </div>
            </Show>

            {/* Governance Tab (Removed in Phase 4 cleanup or define properly) */}
            <Show when={false}>
                <div class="p-8 text-center text-gray-500 italic">
                    Governance History (Coming in Phase 2)
                </div>
            </Show>
        </Motion.div>
    );
}
