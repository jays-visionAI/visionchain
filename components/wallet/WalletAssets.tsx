import { createSignal, Show, For } from 'solid-js';
import {
    ArrowUpRight,
    ArrowDownLeft,
    RefreshCw,
    Sparkles,
    Info,
    Wallet as WalletIcon,
    Shield,
    Zap,
    TrendingUp,
    Menu,
    ChevronRight,
} from 'lucide-solid';
import { WalletActivity } from './WalletActivity';

interface WalletAssetsProps {
    totalValueStr: () => string;
    portfolioStats: () => any;
    assetsTab: () => string;
    setAssetsTab: (tab: string) => void;
    getAssetData: (symbol: string) => any;
    startFlow: (flow: string) => void;
    setActiveView: (view: string) => void;
    vcnPurchases: () => any[];
    totalValue: () => number;
    networkMode: 'mainnet' | 'testnet';
}

export const WalletAssets = (props: WalletAssetsProps) => {
    return (
        <div class="flex-1 overflow-y-auto">
            {/* Top Header */}
            <div class="bg-gradient-to-b from-[#0a0a0b] to-[#0d0d0f] border-b border-white/[0.04] relative overflow-hidden">
                {/* Decorative Background Blur */}
                <div class="absolute top-0 right-[20%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

                <div class="max-w-[1440px] mx-auto px-8 py-10 pt-20">
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div class="relative group">
                            <div class="text-[11px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-2">Total Portfolio Value</div>
                            <div class="flex items-baseline gap-4">
                                <span class="text-4xl sm:text-5xl font-bold text-white tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                    {props.totalValueStr()}
                                </span>
                                <div class="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/10">
                                    <TrendingUp class="w-3.5 h-3.5 text-gray-500" />
                                    <span class="text-sm text-gray-500 font-bold">+$0.00 (0.00%)</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                            <button
                                onClick={() => props.startFlow('send')}
                                class="flex items-center gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-2xl transition-all group active:scale-95" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <div class="w-10 h-10 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-all duration-300 shadow-lg shadow-blue-500/5 group-hover:shadow-blue-500/10">
                                    <ArrowUpRight class="w-5 h-5 text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </div>
                                <span class="text-sm font-bold text-white tracking-wide">Send</span>
                            </button>
                            <button
                                onClick={() => props.startFlow('receive')}
                                class="flex items-center gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-2xl transition-all group active:scale-95" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <div class="w-10 h-10 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 flex items-center justify-center transition-all duration-300 shadow-lg shadow-green-500/5 group-hover:shadow-green-500/10">
                                    <ArrowDownLeft class="w-5 h-5 text-green-400 group-hover:-translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />
                                </div>
                                <span class="text-sm font-bold text-white tracking-wide">Receive</span>
                            </button>
                            <button
                                onClick={() => props.startFlow('swap')}
                                class="flex items-center gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-2xl transition-all group active:scale-95" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <div class="w-10 h-10 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center transition-all duration-300 shadow-lg shadow-purple-500/5 group-hover:shadow-purple-500/10">
                                    <RefreshCw class="w-5 h-5 text-purple-400 group-hover:rotate-180 transition-transform duration-700" />
                                </div>
                                <span class="text-sm font-bold text-white tracking-wide">Swap</span>
                            </button>
                            <button
                                onClick={() => props.setActiveView('mint')}
                                class="flex items-center gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-2xl transition-all group active:scale-95" style={{ background: 'rgba(255,255,255,0.03)' }}
                            >
                                <div class="w-10 h-10 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 flex items-center justify-center transition-all duration-300 shadow-lg shadow-cyan-500/5 group-hover:shadow-cyan-500/10">
                                    <Sparkles class="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                                </div>
                                <span class="text-sm font-bold text-white tracking-wide">Mint</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            {/* Main Content */}
            <div class="max-w-[1440px] mx-auto px-8 py-10">
                {/* Token Info Banner */}
                <div class="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3 backdrop-blur-sm">
                    <div class="mt-0.5 p-1.5 bg-blue-500/20 rounded-lg shrink-0">
                        <Info class="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <Show
                            when={props.networkMode === 'testnet'}
                            fallback={
                                <p class="text-xs text-blue-200/80 leading-relaxed">
                                    The <span class="text-white font-bold">'Purchased (VCN)'</span> balance reflects your total token purchase history updated via CSV. <span class="text-white font-bold">'Locked'</span>, <span class="text-white font-bold">'Vesting'</span>, and <span class="text-white font-bold">'Next Unlock'</span> details will be calculated after the vesting contract is officially executed.
                                </p>
                            }
                        >
                            <p class="text-xs text-amber-200/80 leading-relaxed">
                                <span class="text-amber-400 font-bold uppercase tracking-widest mr-2">Testnet Mode Active:</span>
                                You have been allocated <span class="text-white font-bold">10% of your purchased VCN</span> as Testnet Tokens for network validation and node testing. These tokens have no real-world value.
                            </p>
                        </Show>
                    </div>
                </div>

                {/* Stats Row */}
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <div class="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500 shadow-xl">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <WalletIcon class="w-16 h-16 text-blue-400" />
                        </div>
                        <div class="relative">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-inner">
                                    <WalletIcon class="w-5 h-5" />
                                </div>
                                <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Purchased (VCN)</span>
                            </div>
                            <div class="text-3xl font-bold text-white tracking-tight tabular-nums group-hover:text-blue-400 transition-colors">
                                {props.networkMode === 'testnet'
                                    ? (props.portfolioStats().total * 0.1).toLocaleString()
                                    : props.portfolioStats().total.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div class="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-500 shadow-xl">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Shield class="w-16 h-16 text-amber-400" />
                        </div>
                        <div class="relative">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-inner">
                                    <Shield class="w-5 h-5" />
                                </div>
                                <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Locked (VCN)</span>
                            </div>
                            <div class="text-3xl font-bold text-white tracking-tight tabular-nums group-hover:text-amber-400 transition-colors">
                                0
                            </div>
                        </div>
                    </div>

                    <div class="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-500 shadow-xl">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Zap class="w-16 h-16 text-purple-400" />
                        </div>
                        <div class="relative">
                            <div class="flex items-center justify-between mb-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shadow-inner">
                                        <Zap class="w-5 h-5" />
                                    </div>
                                    <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Vesting</span>
                                </div>
                                <span class="text-xs font-bold text-purple-400">0.0%</span>
                            </div>
                            <div class="text-3xl font-bold text-white mb-4 tracking-tight tabular-nums">
                                0 / {props.portfolioStats().total.toFixed(0)}
                            </div>
                            <div class="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                    class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-1000"
                                    style={{ width: `0%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div class="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-500 shadow-xl">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles class="w-16 h-16 text-cyan-400" />
                        </div>
                        <div class="relative">
                            <div class="flex items-center justify-between mb-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shadow-inner">
                                        <Sparkles class="w-5 h-5" />
                                    </div>
                                    <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Next Unlock</span>
                                </div>
                                <span class="text-xs font-bold text-cyan-400 tracking-wide">
                                    N/A
                                </span>
                            </div>
                            <div class="flex items-baseline gap-2 group-hover:text-cyan-400 transition-colors">
                                <div class="text-3xl font-bold text-white tracking-tight group-hover:text-inherit">
                                    0.00
                                </div>
                                <div class="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">VCN</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div class="flex items-center gap-1 mb-8 p-1.5 bg-white/[0.03] backdrop-blur-md rounded-2xl w-fit border border-white/[0.06] shadow-2xl">
                    <button
                        onClick={() => props.setAssetsTab('tokens')}
                        class={`px-8 py-3 rounded-[14px] text-sm font-bold transition-all ${props.assetsTab() === 'tokens'
                            ? 'bg-white/[0.08] text-white shadow-lg shadow-black/20'
                            : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                            }`}
                        style={{ background: props.assetsTab() === 'tokens' ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                    >
                        Assets
                    </button>
                    <button
                        onClick={() => props.setAssetsTab('activity')}
                        class={`px-8 py-3 rounded-[14px] text-sm font-bold transition-all ${props.assetsTab() === 'activity'
                            ? 'bg-white/[0.08] text-white shadow-lg shadow-black/20'
                            : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                            }`}
                        style={{ background: props.assetsTab() === 'activity' ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                    >
                        Activity
                    </button>
                </div>

                {/* Two Column Layout */}
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Holdings or Activity */}
                    <div class="lg:col-span-8 overflow-x-auto">

                        {/* Assets Tab Content */}
                        <Show when={props.assetsTab() === 'tokens'}>
                            <div class="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] rounded-[24px] overflow-hidden shadow-2xl backdrop-blur-sm">
                                {/* Table Header */}
                                <div class="flex items-center px-8 py-4 border-b border-white/[0.04] text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] min-w-[600px] bg-white/[0.01]">
                                    <div class="flex-1 min-w-[200px]">Asset</div>
                                    <div class="w-24 text-right hidden sm:block">Market Price</div>
                                    <div class="w-24 text-right hidden sm:block">24h Change</div>
                                    <div class="w-32 text-right">User Holdings</div>
                                    <div class="w-32 text-right">Total Value</div>
                                </div>

                                {/* Dynamic Token Rows */}
                                <For each={['VCN', 'ETH', 'USDC']}>
                                    {(symbol, index) => {
                                        const asset = () => props.getAssetData(symbol);
                                        const value = () => (asset().balance * asset().price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                                        const isLast = () => index() === 2;

                                        return (
                                            <div class={`flex items-center px-8 py-6 ${!isLast() ? 'border-b border-white/[0.03]' : ''} hover:bg-white/[0.03] transition-all duration-300 cursor-pointer min-w-[600px] group/row`}>
                                                {/* Token Info */}
                                                <div class="flex-1 min-w-[200px] flex items-center gap-4">
                                                    <div class="relative">
                                                        <Show when={asset().image} fallback={
                                                            <div class={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg ${symbol === 'VCN' ? 'bg-gradient-to-br from-blue-500 to-cyan-400' :
                                                                symbol === 'ETH' ? 'bg-gradient-to-br from-purple-500 to-indigo-400' :
                                                                    'bg-gradient-to-br from-green-500 to-emerald-400'
                                                                }`}>
                                                                {symbol.charAt(0)}
                                                            </div>
                                                        }>
                                                            <img src={asset().image!} alt={symbol} class="w-12 h-12 rounded-2xl flex-shrink-0 shadow-lg group-hover/row:scale-105 transition-transform" />
                                                        </Show>
                                                        <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0a0a0b] border-2 border-[#0a0a0b] overflow-hidden">
                                                            <div class={`w-full h-full ${asset().change24h > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                        </div>
                                                    </div>
                                                    <div class="min-w-0">
                                                        <div class="text-[17px] font-bold text-white group-hover/row:text-blue-400 transition-colors uppercase tracking-wide">{symbol}</div>
                                                        <div class="text-[12px] text-gray-500 font-medium truncate tracking-tight">{asset().name}</div>
                                                    </div>
                                                </div>
                                                {/* Price */}
                                                <div class="w-24 text-right hidden sm:block">
                                                    <Show when={!asset().isLoading} fallback={
                                                        <div class="h-5 w-16 bg-white/[0.06] rounded-lg animate-pulse ml-auto" />
                                                    }>
                                                        <span class="text-base font-medium text-white group-hover/row:text-white transition-colors">
                                                            ${asset().price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            {symbol === 'VCN' && <span class="text-[11px] text-gray-500 ml-1">/ VCN</span>}
                                                        </span>
                                                    </Show>
                                                </div>
                                                {/* 24h Change */}
                                                <div class="w-24 text-right hidden sm:block text-right">
                                                    <Show when={!asset().isLoading} fallback={
                                                        <div class="h-5 w-12 bg-white/[0.06] rounded-lg animate-pulse ml-auto" />
                                                    }>
                                                        <div class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[13px] ${asset().change24h > 0 ? 'text-green-400 bg-green-500/5' : asset().change24h < 0 ? 'text-red-400 bg-red-500/5' : 'text-gray-400 bg-gray-500/5'}`}>
                                                            {asset().change24h > 0 ? <TrendingUp class="w-3 h-3" /> : ''}
                                                            {asset().change24h.toFixed(1)}%
                                                        </div>
                                                    </Show>
                                                </div>
                                                {/* Holdings */}
                                                <div class="w-32 text-right">
                                                    <div class="text-[16px] font-bold text-white tabular-nums tracking-wide">{asset().balance.toLocaleString()}</div>
                                                    <div class="text-[11px] text-gray-500 font-bold uppercase tracking-widest">{symbol}</div>
                                                </div>
                                                {/* Value */}
                                                <div class="w-32 text-right">
                                                    <Show when={!asset().isLoading} fallback={
                                                        <div class="h-5 w-20 bg-white/[0.06] rounded-lg animate-pulse ml-auto" />
                                                    }>
                                                        <span class="text-[18px] font-bold text-white tabular-nums drop-shadow-sm">{value()}</span>
                                                    </Show>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </Show>


                        {/* Activity Tab Content */}
                        <Show when={props.assetsTab() === 'activity'}>
                            <WalletActivity purchases={props.vcnPurchases} />
                        </Show>
                    </div>

                    {/* Right Column - Allocation */}
                    <div class="lg:col-span-4 space-y-8">
                        <div class="relative group">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Portfolio Allocation</h3>
                                <div class="p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
                                    <Menu class="w-3.5 h-3.5 text-gray-500" />
                                </div>
                            </div>
                            <div class="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
                                <div class="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                                {/* Donut Chart */}
                                <div class="relative w-48 h-48 mx-auto mb-10">
                                    <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                                        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="12" />
                                        {(() => {
                                            const tv = props.totalValue();
                                            if (tv === 0) return (
                                                <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="12" />
                                            );

                                            let offset = 0;
                                            return ['VCN', 'ETH', 'USDC'].map((symbol, idx) => {
                                                const asset = props.getAssetData(symbol);
                                                const val = asset.balance * asset.price;
                                                const ratio = val / tv;
                                                const dashArray = `${(ratio * 238.7).toFixed(2)} 238.7`;
                                                const currentOffset = offset;
                                                offset -= ratio * 238.7;
                                                const colors = ['#3b82f6', '#8b5cf6', '#10b981'];

                                                if (ratio === 0) return null;

                                                return (
                                                    <circle
                                                        cx="50" cy="50" r="38" fill="none"
                                                        stroke={colors[idx]} stroke-width="12"
                                                        stroke-dasharray={dashArray}
                                                        stroke-dashoffset={currentOffset.toFixed(2)}
                                                        stroke-linecap="butt"
                                                        class="transition-all duration-1000 ease-out"
                                                    />
                                                );
                                            });
                                        })()}
                                    </svg>
                                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total</div>
                                        <div class="text-2xl font-bold text-white tracking-tighter">
                                            {props.totalValue() > 0 ? '100%' : '0%'}
                                        </div>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div class="space-y-4">
                                    {['VCN', 'ETH', 'USDC'].map((symbol, idx) => {
                                        const asset = props.getAssetData(symbol);
                                        const tv = props.totalValue();
                                        const ratio = tv > 0 ? ((asset.balance * asset.price) / tv) * 100 : 0;
                                        const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500'];
                                        const shadowColors = ['rgba(59,130,246,0.5)', 'rgba(139,92,246,0.5)', 'rgba(16,185,129,0.5)'];

                                        return (
                                            <div class="flex items-center justify-between group/item cursor-pointer">
                                                <div class="flex items-center gap-3">
                                                    <div class={`w-3 h-3 rounded-full ${colors[idx]}`} style={{ 'box-shadow': `0 0 8px ${shadowColors[idx]}` }} />
                                                    <span class="text-sm font-bold text-gray-400 group-hover/item:text-white transition-colors">{symbol}</span>
                                                </div>
                                                <div class="text-right">
                                                    <span class="text-sm font-black text-white tabular-nums">{ratio.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div class="space-y-4">
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Earning Opportunities</div>
                            <div class="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => props.startFlow('stake')}
                                    class="w-full flex items-center justify-between p-5 bg-gradient-to-r from-blue-500/5 to-transparent hover:from-blue-500/10 border border-white/[0.06] rounded-[24px] transition-all duration-300 text-left group active:scale-95"
                                    style={{ background: 'linear-gradient(to right, rgba(59,130,246,0.05), transparent)' }}
                                >
                                    <div class="flex items-center gap-4">
                                        <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shadow-xl">
                                            <TrendingUp class="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div class="text-[15px] font-bold text-white group-hover:text-blue-400 transition-colors">Stake VCN Tokens</div>
                                            <div class="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Earn up to 12% APY</div>
                                        </div>
                                    </div>
                                    <ChevronRight class="w-5 h-5 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </button>

                                <button
                                    onClick={() => props.setActiveView('campaign')}
                                    class="w-full flex items-center justify-between p-5 bg-gradient-to-r from-purple-500/5 to-transparent hover:from-purple-500/10 border border-white/[0.06] rounded-[24px] transition-all duration-300 text-left group active:scale-95"
                                    style={{ background: 'linear-gradient(to right, rgba(168,85,247,0.05), transparent)' }}
                                >
                                    <div class="flex items-center gap-4">
                                        <div class="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform shadow-xl">
                                            <Sparkles class="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div class="text-[15px] font-bold text-white group-hover:text-purple-400 transition-colors">Claim Rewards</div>
                                            <div class="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Check for available rewards</div>
                                        </div>
                                    </div>
                                    <ChevronRight class="w-5 h-5 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
