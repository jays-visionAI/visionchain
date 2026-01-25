import { createSignal, Show, For } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Sparkles,
    User,
    Send,
    ArrowUpRight,
    ArrowDownLeft,
    RefreshCw,
    TrendingUp,
    ChevronRight,
    Copy,
    Zap,
    Plus,
    Mic,
    Paperclip
} from 'lucide-solid';

interface WalletDashboardProps {
    messages: () => any[];
    isLoading: () => boolean;
    input: () => string;
    setInput: (val: string) => void;
    handleSend: () => void;
    setActiveView: (view: any) => void;
    setActiveFlow: (flow: any) => void;
    totalValueStr: () => string;
    getAssetData: (symbol: string) => any;
    userProfile: () => any;
    onboardingStep: () => number;
    networkMode: 'mainnet' | 'testnet';
}

export const WalletDashboard = (props: WalletDashboardProps) => {
    return (
        <div class="flex-1 flex overflow-hidden relative">
            {/* Main Chat Area */}
            <div class="flex-1 flex flex-col overflow-hidden relative">

                {/* Messages Area */}
                <div class="flex-1 overflow-y-auto bg-[#0d0d0f]">
                    <Show when={props.messages().length === 0}>
                        {/* Bento Grid Layout - This will scroll if content is long, but normally it's static */}
                        <div class="flex flex-col items-center justify-start px-6 md:px-20 py-12">
                            <Motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, easing: [0.25, 0.1, 0.25, 1] }}
                                class="w-full max-w-5xl"
                            >
                                {/* Welcome Text */}
                                <div class="text-center mb-8">
                                    <h1 class="text-3xl md:text-4xl font-semibold text-white mb-2 tracking-tight">
                                        Welcome to Vision Wallet
                                    </h1>
                                    <p class="text-gray-400 text-base">
                                        Your gateway to the Vision Chain ecosystem
                                    </p>
                                </div>

                                {/* Bento Grid */}
                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min md:auto-rows-[210px]">
                                    {/* Main Banner - Free Tokens */}
                                    <Motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.1 }}
                                        class="col-span-1 md:col-span-2 row-span-2 relative overflow-hidden rounded-[32px] cursor-pointer group min-h-[400px] md:min-h-0"
                                    >
                                        <div class="absolute inset-0 bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-700" />
                                        <div class="absolute inset-0 opacity-40 mix-blend-overlay">
                                            <img src="/bento_free_tokens.png" alt="Free Tokens" class="w-full h-full object-cover" />
                                        </div>
                                        <div class="absolute inset-0 bg-black/20" />
                                        <div class="relative h-full p-8 md:p-10 flex flex-col items-center text-center">
                                            <div class="flex-1 flex flex-col items-center justify-center">
                                                <div class="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-[10px] md:text-sm font-semibold text-white mb-4 md:mb-6 border border-white/20">
                                                    <Sparkles class="w-3.5 h-3.5 md:w-4 h-4 text-cyan-300" />
                                                    Exclusive Reward
                                                </div>
                                                <h2 class="text-3xl md:text-5xl font-bold text-white mb-4 md:mb-6 tracking-tight">Free Tokens</h2>
                                                <p class="text-white/80 text-lg md:text-xl max-w-[320px] leading-relaxed mx-auto mb-6 md:mb-8">
                                                    Claim your VCN airdrop and join the Vision ecosystem.
                                                </p>
                                                <button
                                                    onClick={() => props.setActiveView('campaign')}
                                                    class="px-8 py-4 md:px-10 md:py-5 bg-white text-[#0a84ff] font-bold text-lg md:text-xl rounded-2xl hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-500/40 mb-6 md:mb-8"
                                                >
                                                    Claim Now
                                                </button>
                                            </div>
                                            <div class="flex flex-col items-center mt-auto">
                                                <span class="text-white font-black text-2xl md:text-3xl">100 VCN</span>
                                                <span class="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">Available to claim</span>
                                            </div>
                                        </div>
                                    </Motion.div>

                                    {/* Send Card */}
                                    <Motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        onClick={() => props.setActiveFlow('send')}
                                        class="col-span-1 row-span-1 h-full relative overflow-hidden rounded-3xl cursor-pointer group border border-white/[0.08] hover:border-blue-500/40 transition-all duration-500 shadow-lg hover:shadow-blue-500/10"
                                    >
                                        <div class="absolute inset-0 bg-[#121216]" />
                                        <div class="absolute inset-x-0 bottom-0 top-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                                            <img src="/bento_send.png" alt="Send" class="w-full h-full object-cover" />
                                        </div>
                                        <div class="absolute inset-0 bg-gradient-to-t from-[#121216] via-transparent to-transparent" />
                                        <div class="relative h-full p-6 flex flex-col justify-center items-center text-center min-h-[160px] md:min-h-0">
                                            <div class="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500/30 transition-all duration-500 mb-3 md:mb-4">
                                                <ArrowUpRight class="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                                            </div>
                                            <div>
                                                <h3 class="text-lg md:text-xl font-bold text-white mb-1 md:mb-2 text-center">Send</h3>
                                                <p class="text-[10px] md:text-xs text-gray-400 px-2 leading-tight">Instant transfers anywhere in the world</p>
                                            </div>
                                        </div>
                                    </Motion.div>

                                    {/* Receive Card */}
                                    <Motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.25 }}
                                        onClick={() => props.setActiveFlow('receive')}
                                        class="col-span-1 row-span-1 relative overflow-hidden rounded-3xl cursor-pointer group border border-white/[0.08] hover:border-green-500/40 transition-all duration-500 shadow-lg hover:shadow-green-500/10"
                                    >
                                        <div class="absolute inset-0 bg-[#0a1611]" />
                                        <div class="absolute inset-x-0 bottom-0 top-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                                            <img src="/bento_receive.png" alt="Receive" class="w-full h-full object-cover" />
                                        </div>
                                        <div class="absolute inset-0 bg-gradient-to-t from-[#0a1611] via-transparent to-transparent" />
                                        <div class="relative h-full p-6 flex flex-col justify-center items-center text-center min-h-[160px] md:min-h-0">
                                            <div class="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-green-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-green-500/30 transition-all duration-500 mb-3 md:mb-4">
                                                <ArrowDownLeft class="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                                            </div>
                                            <div>
                                                <h3 class="text-lg md:text-xl font-bold text-white mb-1 md:mb-2 text-center">Receive</h3>
                                                <p class="text-[10px] md:text-xs text-gray-400 px-2 leading-tight">Your secure global digital address</p>
                                            </div>
                                        </div>
                                    </Motion.div>

                                    {/* Swap Card */}
                                    <Motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        onClick={() => props.setActiveFlow('swap')}
                                        class="col-span-1 row-span-1 relative overflow-hidden rounded-3xl cursor-pointer group border border-white/[0.08] hover:border-purple-500/40 transition-all duration-500 shadow-lg hover:shadow-purple-500/10"
                                    >
                                        <div class="absolute inset-0 bg-[#110e1a]" />
                                        <div class="absolute inset-x-0 bottom-0 top-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                                            <img src="/bento_swap.png" alt="Swap" class="w-full h-full object-cover" />
                                        </div>
                                        <div class="absolute inset-0 bg-gradient-to-t from-[#110e1a] via-transparent to-transparent" />
                                        <div class="relative h-full p-6 flex flex-col justify-center items-center text-center min-h-[160px] md:min-h-0">
                                            <div class="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-500/30 transition-all duration-500 mb-3 md:mb-4">
                                                <RefreshCw class="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                                            </div>
                                            <div>
                                                <h3 class="text-lg md:text-xl font-bold text-white mb-1 md:mb-2 text-center">Swap</h3>
                                                <p class="text-[10px] md:text-xs text-gray-400 px-2 leading-tight">Aggregated DEX liquidity for best rates</p>
                                            </div>
                                        </div>
                                    </Motion.div>

                                    {/* Mint Card */}
                                    <Motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.35 }}
                                        onClick={() => props.setActiveView('mint')}
                                        class="col-span-1 row-span-1 relative overflow-hidden rounded-3xl cursor-pointer group border border-white/[0.08] hover:border-cyan-500/40 transition-all duration-500 shadow-lg hover:shadow-cyan-500/10"
                                    >
                                        <div class="absolute inset-0 bg-[#0a1418]" />
                                        <div class="absolute inset-x-0 bottom-0 top-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                                            <img src="/bento_mint.png" alt="Mint" class="w-full h-full object-cover" />
                                        </div>
                                        <div class="absolute inset-0 bg-gradient-to-t from-[#0a1418] via-transparent to-transparent" />
                                        <div class="relative h-full p-6 flex flex-col justify-center items-center text-center min-h-[160px] md:min-h-0">
                                            <div class="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-cyan-500/30 transition-all duration-500 mb-3 md:mb-4">
                                                <Sparkles class="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                                            </div>
                                            <div>
                                                <h3 class="text-lg md:text-xl font-bold text-white mb-1 md:mb-2">Mint</h3>
                                                <p class="text-[10px] md:text-xs text-gray-400 px-2 leading-tight">Create NFTs and digital collectibles</p>
                                            </div>
                                        </div>
                                    </Motion.div>
                                </div>
                            </Motion.div>
                        </div>
                    </Show>

                    <Show when={props.messages().length > 0}>
                        <div class="max-w-3xl mx-auto px-6 pt-24 pb-48 space-y-8">
                            <For each={props.messages()}>
                                {(msg) => (
                                    <Motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        class={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}
                                    >
                                        <Show when={msg.role === 'assistant'}>
                                            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                                                <Sparkles class="w-4 h-4 text-white" />
                                            </div>
                                        </Show>
                                        <div class={`max-w-[75%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                                            <div class={`px-5 py-4 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap shadow-lg ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-md shadow-blue-500/20'
                                                : 'bg-[#18181b] text-gray-200 border border-white/[0.06] rounded-tl-md'
                                                }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                        <Show when={msg.role === 'user'}>
                                            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center flex-shrink-0">
                                                <User class="w-4 h-4 text-white" />
                                            </div>
                                        </Show>
                                    </Motion.div>
                                )}
                            </For>

                            <Show when={props.isLoading()}>
                                <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} class="flex gap-4">
                                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                                        <Sparkles class="w-4 h-4 text-white animate-pulse" />
                                    </div>
                                    <div class="bg-[#18181b] border border-white/[0.06] px-5 py-4 rounded-2xl rounded-tl-md flex items-center gap-2">
                                        <div class="flex gap-1.5">
                                            <span class="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ "animation-delay": "0s" }} />
                                            <span class="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ "animation-delay": "0.15s" }} />
                                            <span class="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ "animation-delay": "0.3s" }} />
                                        </div>
                                    </div>
                                </Motion.div>
                            </Show>
                        </div>
                    </Show>
                </div>

                {/* Input Area - Redesigned Premium Floating Style */}
                <div class="fixed bottom-0 left-[280px] right-[320px] p-8 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/98 to-transparent pt-32 z-30 pointer-events-none">
                    <div class="max-w-4xl mx-auto pointer-events-auto">
                        <div class="relative group">
                            {/* Dynamic Border Glow */}
                            <div class="absolute -inset-[1px] bg-gradient-to-r from-blue-600/30 via-cyan-400/30 to-blue-600/30 rounded-[26px] blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 animate-pulse" />

                            <div class="relative bg-[#0d0d0f] backdrop-blur-3xl border border-white/[0.05] rounded-[26px] shadow-2xl transition-all duration-500 group-focus-within:border-white/[0.08] p-2 flex items-end gap-2">

                                {/* Left Tools (Attachments/Plus) */}
                                <button class="w-11 h-11 flex items-center justify-center rounded-2xl text-gray-500 hover:text-white hover:bg-white/5 transition-all flex-shrink-0 group/btn">
                                    <Plus class="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                                </button>

                                {/* Textarea Area - Removed inner border to solve 'grey box' issue */}
                                <div class="flex-1 px-2 transition-all">
                                    <textarea
                                        class="w-full bg-transparent text-white text-[15px] py-3.5 outline-none resize-none placeholder:text-gray-600 min-h-[44px] max-h-[200px] font-medium leading-relaxed"
                                        placeholder="Consult Vision AI Architect..."
                                        rows={1}
                                        value={props.input()}
                                        onInput={(e) => {
                                            props.setInput(e.currentTarget.value);
                                            e.currentTarget.style.height = 'auto';
                                            e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 200) + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                props.handleSend();
                                            }
                                        }}
                                    />
                                </div>

                                {/* Right Tools */}
                                <div class="flex items-center gap-1.5 pb-0.5 pr-1">
                                    <button class="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all flex-shrink-0">
                                        <Mic class="w-4.5 h-4.5" />
                                    </button>

                                    <button
                                        onClick={props.handleSend}
                                        disabled={props.isLoading() || !props.input().trim()}
                                        class={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-300 ${(!props.input().trim() || props.isLoading())
                                            ? 'bg-white/5 text-white/10 grayscale cursor-not-allowed'
                                            : 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:scale-105 active:scale-95'
                                            }`}
                                    >
                                        <Send class={`w-5 h-5 ${props.isLoading() ? 'animate-pulse' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Status Footer */}
                        <div class="flex items-center justify-between px-6 mt-4 opacity-40 group-focus-within:opacity-70 transition-opacity">
                            <div class="flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span class="text-[9px] font-black text-white uppercase tracking-[0.2em]">Vision Architect v0.8</span>
                            </div>
                            <span class="text-[9px] font-bold text-gray-400 italic">Always verify critical transactions.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Assets & Campaigns */}
            <div class="w-[320px] h-full border-l border-white/[0.04] bg-[#0c0c0e]/40 backdrop-blur-3xl overflow-y-auto hidden xl:block">
                <div class="p-6 space-y-6">

                    {/* Portfolio Overview */}
                    <div class="relative overflow-hidden group">
                        <div class="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors duration-700" />
                        <div class="flex items-center justify-between mb-4">
                            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Net Worth</div>
                            <div class="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] rounded-full border border-white/[0.06]">
                                <span class={`w-1 h-1 rounded-full ${props.getAssetData('VCN').change24h >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span class={`text-[10px] font-bold ${props.getAssetData('VCN').change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {props.getAssetData('VCN').change24h >= 0 ? '+' : ''}{props.getAssetData('VCN').change24h.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                        <div class="text-3xl font-bold text-white mb-8 tracking-tight font-mono">
                            {props.totalValueStr()}
                        </div>

                        {/* Mini Token List */}
                        <div class="space-y-4">
                            <For each={['VCN']}>
                                {(symbol) => {
                                    const asset = () => props.getAssetData(symbol);
                                    const valueStr = () => (asset().balance * asset().price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

                                    return (
                                        <div class="flex items-center justify-between group/item cursor-pointer">
                                            <div class="flex items-center gap-3">
                                                <div class="relative">
                                                    <Show when={asset().image} fallback={
                                                        <div class={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[11px] shadow-lg ${symbol === 'VCN' ? 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-blue-500/20' :
                                                            symbol === 'ETH' ? 'bg-gradient-to-br from-purple-500 to-indigo-400 shadow-purple-500/20' :
                                                                'bg-gradient-to-br from-green-500 to-emerald-400 shadow-green-500/20'
                                                            }`}>
                                                            {symbol.slice(0, 2)}
                                                        </div>
                                                    }>
                                                        <img src={asset().image!} alt={symbol} class="w-9 h-9 rounded-xl shadow-lg" />
                                                    </Show>
                                                </div>
                                                <div>
                                                    <div class="text-[14px] font-semibold text-white group-hover/item:text-blue-400 transition-colors uppercase tracking-wide">{symbol}</div>
                                                    <div class="text-[11px] text-gray-500 font-medium tracking-tight">Active Portfolio</div>
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <div class="text-[14px] font-bold text-white tabular-nums">{valueStr()}</div>
                                                <div class={`text-[10px] font-bold ${asset().change24h > 0 ? 'text-green-400' : asset().change24h < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                                    {asset().change24h > 0 ? '+' : ''}{asset().change24h.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>

                    <div class="h-px bg-white/[0.04] w-full" />

                    {/* Rewards Section */}
                    <div class="space-y-5">
                        <div class="flex items-center justify-between px-1">
                            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Live Rewards</span>
                            <div class="flex gap-1">
                                <div class="w-1 h-1 rounded-full bg-cyan-400" />
                                <div class="w-1 h-1 rounded-full bg-cyan-400/40" />
                            </div>
                        </div>

                        {/* Reward Cards */}
                        <div class="space-y-3">
                            <div
                                onClick={() => props.setActiveView('campaign')}
                                class="relative overflow-hidden p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] rounded-2xl transition-all duration-500 group cursor-pointer"
                            >
                                <div class="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                                <div class="flex items-center justify-between mb-4">
                                    <div class="flex items-center gap-2">
                                        <div class="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                            <TrendingUp class="w-3.5 h-3.5" />
                                        </div>
                                        <span class="text-[11px] font-bold text-blue-400 uppercase tracking-widest">Staking</span>
                                    </div>
                                    <ChevronRight class="w-3.5 h-3.5 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                </div>
                                <div class="text-[17px] font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">12% APY Yield</div>
                                <p class="text-[12px] text-gray-400 mb-4 font-medium">Auto-compounding rewards</p>
                                <div class="flex items-center gap-2">
                                    <div class="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/10 text-[10px] font-bold text-blue-400">HOT</div>
                                    <span class="text-[10px] text-gray-500 font-bold">New Pool</span>
                                </div>
                            </div>

                            <div
                                onClick={() => props.setActiveView('campaign')}
                                class="relative overflow-hidden p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] rounded-2xl transition-all duration-500 group cursor-pointer"
                            >
                                <div class="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors" />
                                <div class="flex items-center justify-between mb-4">
                                    <div class="flex items-center gap-2">
                                        <div class="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                            <Sparkles class="w-3.5 h-3.5" />
                                        </div>
                                        <span class="text-[11px] font-bold text-purple-400 uppercase tracking-widest">Airdrop</span>
                                    </div>
                                    <ChevronRight class="w-3.5 h-3.5 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                </div>
                                <div class="text-[17px] font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">Season 1 is Live</div>
                                <div class="flex items-center justify-between mt-4">
                                    <div class="flex items-center gap-3 flex-1 mr-4">
                                        <div class="h-1 flex-1 bg-white/[0.04] rounded-full overflow-hidden">
                                            <div class="h-full w-[10%] bg-gradient-to-r from-purple-500 to-indigo-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]" />
                                        </div>
                                        <span class="text-[11px] font-bold text-white/40">1/10</span>
                                    </div>
                                    <span class="text-[11px] font-bold text-purple-400">JOIN NOW</span>
                                </div>
                            </div>

                            {/* Simplified Referral */}
                            <div
                                onClick={() => props.setActiveView('campaign')}
                                class="group cursor-pointer p-4 bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10 rounded-2xl hover:border-orange-500/20 transition-all"
                            >
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Growth</span>
                                    <User class="w-3 h-3 text-orange-400/50" />
                                </div>
                                <div class="text-[15px] font-bold text-white">Invite & Earn 50 VCN</div>
                                <div class="flex items-center justify-between mt-3">
                                    <div class="text-[10px] font-mono text-gray-500 group-hover:text-white transition-colors">VC-7F3A-8B9C</div>
                                    <div class="text-[10px] font-bold text-orange-400">COPY LINK</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Health & User Info */}
                    <div class="grid grid-cols-2 gap-3 pt-4">
                        <div class="col-span-2 p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
                                <User class="w-4 h-4 text-white" />
                            </div>
                            <div class="overflow-hidden">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Logged In As</div>
                                <div class="text-[11px] font-bold text-white truncate w-full" title={props.userProfile().email}>{props.userProfile().email}</div>
                            </div>
                        </div>

                        <div class="p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Network</div>
                            <div class="flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                                <span class="text-[12px] font-bold text-white">Connected</span>
                            </div>
                        </div>
                        <div class="p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Gas Priority</div>
                            <div class="flex items-center gap-2">
                                <Zap class="w-3 h-3 text-amber-400" />
                                <span class="text-[12px] font-bold text-white">0.002 VCN</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
