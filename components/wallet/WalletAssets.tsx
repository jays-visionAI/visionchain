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
import { WalletViewHeader } from './WalletViewHeader';
import { WalletActivity } from './WalletActivity';

interface WalletAssetsProps {
    totalValueStr: () => string;
    portfolioStats: () => any;
    getAssetData: (symbol: string) => any;
    startFlow: (flow: string) => void;
    setActiveView: (view: string) => void;
    vcnPurchases: () => any[];
    totalValue: () => number;
    networkMode: 'mainnet' | 'testnet';
    isLocalWalletMissing?: boolean;
    onRestoreWallet?: () => void;
    walletAddress?: () => string; // Added prop
    contacts?: any[];
}

export const WalletAssets = (props: WalletAssetsProps) => {
    const [networkFilter, setNetworkFilter] = createSignal<'all' | 'mainnet' | 'testnet'>('all');

    return (
        <div class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8">
            <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <WalletViewHeader
                    tag="Portfolio Overview"
                    title="MY"
                    titleAccent="ASSETS"
                    description="Manage your digital assets and view your portfolio performance across multiple networks."
                    rightElement={
                        <div class="flex flex-col items-end">
                            <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Total Value</div>
                            <div class="text-2xl font-black text-white tracking-tighter drop-shadow-sm">
                                {(() => {
                                    const vcn = props.getAssetData('VCN');
                                    if (networkFilter() === 'mainnet') {
                                        return (vcn.purchasedBalance * vcn.price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                                    } else if (networkFilter() === 'testnet') {
                                        return (vcn.liquidBalance * vcn.price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                                    }
                                    return props.totalValueStr();
                                })()}
                            </div>
                            <div class={`text-[10px] font-bold ${props.getAssetData('VCN').change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {props.getAssetData('VCN').change24h >= 0 ? '+' : ''}${Math.abs((props.totalValue() * props.getAssetData('VCN').change24h) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({props.getAssetData('VCN').change24h.toFixed(2)}%)
                            </div>
                        </div>
                    }
                />

                {/* Quick Actions Container */}
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111113]/40 p-4 rounded-3xl border border-white/[0.05]">
                    <button
                        onClick={() => props.startFlow('send')}
                        class="flex items-center justify-center gap-2 p-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl transition-all group active:scale-95">
                        <ArrowUpRight class="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        <span class="text-xs font-black text-white uppercase tracking-widest">Send</span>
                    </button>
                    <button
                        onClick={() => props.startFlow('receive')}
                        class="flex items-center justify-center gap-2 p-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl transition-all group active:scale-95">
                        <ArrowDownLeft class="w-4 h-4 text-green-400 group-hover:-translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />
                        <span class="text-xs font-black text-white uppercase tracking-widest">Receive</span>
                    </button>
                    <button
                        onClick={() => props.startFlow('swap')}
                        class="flex items-center justify-center gap-2 p-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl transition-all group active:scale-95">
                        <RefreshCw class="w-4 h-4 text-purple-400 group-hover:rotate-180 transition-transform duration-700" />
                        <span class="text-xs font-black text-white uppercase tracking-widest">Swap</span>
                    </button>
                    <button
                        onClick={() => props.setActiveView('mint')}
                        class="flex items-center justify-center gap-2 p-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl transition-all group active:scale-95">
                        <Sparkles class="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span class="text-xs font-black text-white uppercase tracking-widest">Mint</span>
                    </button>
                </div>
            </div>


            {/* Main Content */}
            <div class="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 md:py-10">
                {/* Wallet Out-of-Sync / Missing Local Data Warning */}
                <Show when={props.isLocalWalletMissing}>
                    <div class="mb-8 p-6 bg-amber-500/10 border border-amber-500/30 rounded-[24px] flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-md shadow-2xl">
                        <div class="flex items-start gap-4">
                            <div class="p-3 bg-amber-500/20 rounded-2xl shadow-inner">
                                <Shield class="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white mb-1">Local Wallet Data Missing</h3>
                                <p class="text-sm text-amber-200/70 leading-relaxed max-w-xl">
                                    Your account address is recognized, but the encrypted key is not found on this device.
                                    You are in <span class="text-white font-bold">view-only mode</span>. To send tokens or stake,
                                    you must restore your wallet using your recovery phrase.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => props.onRestoreWallet?.()}
                            class="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 whitespace-nowrap text-sm"
                        >
                            Restore Wallet
                        </button>
                    </div>
                </Show>

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
                                <span class="text-amber-400 font-bold uppercase tracking-widest mr-2">Testnet Validation:</span>
                                Based on the ecosystem policy, <span class="text-white font-bold">10% of purchased VCN</span> will be distributed as Testnet Tokens for node validation. Updates will be visible in your local wallet once sent by the administrator.
                            </p>
                        </Show>
                    </div>
                </div>

                {/* Stats Row */}
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <div class="bg-gradient-to-br from-black/40 to-transparent border border-white/[0.05] rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500 shadow-2xl">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <WalletIcon class="w-16 h-16 text-blue-400" />
                        </div>
                        <div class="relative">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-inner">
                                    <WalletIcon class="w-5 h-5" />
                                </div>
                                <span class="text-[10px] md:text-[11px] font-bold text-gray-500 uppercase tracking-widest">Purchased (VCN)</span>
                            </div>
                            <div class="text-2xl md:text-3xl font-bold text-white tracking-tight tabular-nums group-hover:text-blue-400 transition-colors">
                                {props.portfolioStats().total.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div class="bg-gradient-to-br from-black/40 to-transparent border border-white/[0.05] rounded-3xl p-6 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-500 shadow-2xl">
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

                    <div class="bg-gradient-to-br from-black/40 to-transparent border border-white/[0.05] rounded-3xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-500 shadow-2xl">
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

                    <div class="bg-gradient-to-br from-black/40 to-transparent border border-white/[0.05] rounded-3xl p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-500 shadow-2xl">
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

                {/* Two Column Layout */}
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Holdings */}
                    <div class="lg:col-span-8">

                        <div class="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] rounded-[24px] overflow-hidden shadow-2xl backdrop-blur-sm">
                            {/* Table Header - Hidden on mobile, visible on sm+ */}
                            <div class="hidden sm:flex items-center px-8 py-4 border-b border-white/[0.04] text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] bg-white/[0.01]">
                                <div class="flex-1">Asset</div>
                                <div class="w-24 text-right hidden lg:block">Market Price</div>
                                <div class="w-24 text-right hidden xl:block">24h Change</div>
                                <div class="w-32 text-right">User Holdings</div>
                                <div class="w-32 text-right">Total Value</div>
                            </div>

                            {/* Dynamic Token Rows */}
                            <For each={[
                                { id: 'vcn_main', symbol: 'VCN', name: 'Purchased (VCN)', network: 'mainnet' },
                                { id: 'vcn_test', symbol: 'VCN', name: 'VCN (Testnet)', network: 'testnet' }
                            ]}>
                                {(item, index) => {
                                    // Visibility Filter
                                    if (networkFilter() !== 'all' && networkFilter() !== item.network) return null;

                                    const asset = () => props.getAssetData(item.symbol);
                                    const isMainnetItem = item.network === 'mainnet';

                                    const displayBalance = () => isMainnetItem ? asset().purchasedBalance : asset().liquidBalance;
                                    const displayValue = () => (displayBalance() * asset().price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

                                    // Styling distinction
                                    const isTestnetStyle = item.network === 'testnet';

                                    return (
                                        <div class={`flex items-center justify-between px-4 sm:px-8 py-5 md:py-6 border-b border-white/[0.03] hover:bg-white/[0.03] transition-all duration-300 cursor-pointer group/row ${isTestnetStyle ? 'bg-amber-500/[0.02]' : ''}`}>
                                            {/* Left side: Token Info */}
                                            <div class="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                                                <div class="relative flex-shrink-0">
                                                    <div class={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-lg ${isTestnetStyle
                                                        ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-500 border border-amber-500/30'
                                                        : 'bg-gradient-to-br from-blue-600 to-cyan-500'
                                                        }`}>
                                                        V
                                                    </div>
                                                    <Show when={isTestnetStyle}>
                                                        <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0a0a0b] flex items-center justify-center">
                                                            <div class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                                                        </div>
                                                    </Show>
                                                </div>
                                                <div class="min-w-0">
                                                    <div class="text-[15px] md:text-[17px] font-bold text-white group-hover/row:text-blue-400 transition-colors uppercase tracking-wide flex items-center gap-2">
                                                        {item.symbol}
                                                        <Show when={isTestnetStyle}>
                                                            <span class="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-500 border border-amber-500/30">TEST</span>
                                                        </Show>
                                                    </div>
                                                    <div class="text-[11px] md:text-[12px] text-gray-500 font-medium truncate tracking-tight">{item.name}</div>
                                                </div>
                                            </div>

                                            {/* Middle columns - Hidden on small mobile */}
                                            <div class="hidden lg:block w-24 text-right">
                                                <span class="text-sm md:text-base font-medium text-white">
                                                    ${asset().price.toFixed(4)}
                                                </span>
                                            </div>
                                            <div class="hidden xl:block w-24 text-right px-2">
                                                <div class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[12px] md:text-[13px] ${asset().change24h > 0 ? 'text-green-400 bg-green-500/5' : 'text-red-400 bg-red-500/5'}`}>
                                                    {asset().change24h.toFixed(1)}%
                                                </div>
                                            </div>

                                            {/* Right side: Holdings & Value */}
                                            <div class="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-0">
                                                {/* User Holdings (hidden label on mobile, or stacked) */}
                                                <div class="w-auto sm:w-32 text-right order-2 sm:order-1">
                                                    <div class="text-[12px] sm:text-[15px] md:text-[16px] font-medium sm:font-bold text-gray-400 sm:text-white tabular-nums tracking-wide">
                                                        <span class="sm:hidden text-[10px] text-gray-600 mr-1">Qty:</span>
                                                        {displayBalance().toLocaleString()}
                                                    </div>
                                                    <div class="hidden sm:block text-[10px] md:text-[11px] text-gray-500 font-bold uppercase tracking-widest">{item.symbol}</div>
                                                </div>

                                                {/* Total Value */}
                                                <div class="w-auto sm:w-32 text-right order-1 sm:order-2">
                                                    <span class={`text-[16px] md:text-[18px] font-bold tabular-nums drop-shadow-sm ${isTestnetStyle ? 'text-amber-500/80' : 'text-white'}`}>
                                                        {displayValue()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
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
                            <div class="bg-gradient-to-br from-black/20 to-transparent border border-white/[0.05] rounded-[32px] p-8 shadow-3xl relative overflow-hidden">
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
                                            return ['VCN'].map((symbol, idx) => {
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
                                    {['VCN'].map((symbol, idx) => {
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
