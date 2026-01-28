import { createSignal, Show, For } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import {
    Plus,
    Zap,
    Sparkles,
    Globe,
    Shield,
    RefreshCw,
    Check,
    ArrowLeft
} from 'lucide-solid';

import { WalletViewHeader } from './WalletViewHeader';

interface WalletMintProps {
    mintStep: () => number;
    setMintStep: (step: number) => void;
    tokenName: () => string;
    setTokenName: (name: string) => void;
    tokenSymbol: () => string;
    setTokenSymbol: (symbol: string) => void;
    tokenType: () => string;
    setTokenType: (type: string) => void;
    tokenSupply: () => string;
    setTokenSupply: (supply: string) => void;
    mintingNetworks: () => string[];
    setMintingNetworks: (networks: any) => void;
    handleMint: () => void;
    isMinting: () => boolean;
    mintedSuccess: () => boolean;
    setMintedSuccess: (success: boolean) => void;
    mintProgress: () => number;
    setActiveView: (view: any) => void;
}

export const WalletMint = (props: WalletMintProps) => {
    return (
        <div class="flex-1 overflow-y-auto relative h-full custom-scrollbar p-4 lg:p-8">
            {/* Decorative Background Blur */}
            <div class="absolute top-0 right-[15%] w-[450px] h-[450px] bg-cyan-500/5 rounded-full blur-[130px] pointer-events-none" />

            <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative min-h-full flex flex-col">
                <div class="flex items-center gap-4 mb-2 lg:hidden">
                    <button
                        onClick={() => props.setActiveView('assets')}
                        class="p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft class="w-5 h-5" />
                    </button>
                    <span class="text-sm font-bold text-gray-500 uppercase tracking-widest">Back to Assets</span>
                </div>
                <WalletViewHeader
                    tag="Asset Generation"
                    title="TOKEN"
                    titleAccent="MINT"
                    description="Create new tokens and cross-chain assets powered by Vision Interoperability."
                    rightElement={
                        <div class="flex items-center gap-3">
                            <For each={[1, 2, 3]}>
                                {(step) => (
                                    <button
                                        onClick={() => props.setMintStep(step)}
                                        class={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all ${props.mintStep() === step ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                    >
                                        {step}
                                    </button>
                                )}
                            </For>
                        </div>
                    }
                />

                <div class="grid grid-cols-1 xl:grid-cols-12 gap-10 flex-1">
                    {/* Left Side: Configuration Form */}
                    <div class="xl:col-span-7 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">

                        {/* Step 1: Identity */}
                        <Show when={props.mintStep() === 1}>
                            <div class="space-y-6">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Token Identity</label>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div class="relative group">
                                            <input
                                                type="text"
                                                placeholder="Token Name (e.g. Vision Gold)"
                                                class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                                                value={props.tokenName()}
                                                onInput={(e) => props.setTokenName(e.currentTarget.value)}
                                            />
                                        </div>
                                        <div class="relative group">
                                            <input
                                                type="text"
                                                placeholder="Symbol (e.g. VGOLD)"
                                                class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600 uppercase"
                                                value={props.tokenSymbol()}
                                                onInput={(e) => props.setTokenSymbol(e.currentTarget.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="space-y-4">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Asset Type</label>
                                    <div class="flex gap-4">
                                        <button
                                            onClick={() => props.setTokenType('fungible')}
                                            class={`flex-1 p-5 rounded-2xl border transition-all flex flex-col items-center gap-3 ${props.tokenType() === 'fungible' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/5' : 'bg-[#111113] border-white/10 text-gray-500 hover:border-white/20'}`}
                                        >
                                            <Zap class="w-6 h-6" />
                                            <span class="font-bold">Fungible (ERC-20)</span>
                                        </button>
                                        <button
                                            onClick={() => props.setTokenType('nft')}
                                            class={`flex-1 p-5 rounded-2xl border transition-all flex flex-col items-center gap-3 ${props.tokenType() === 'nft' ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/5' : 'bg-[#111113] border-white/10 text-gray-500 hover:border-white/20'}`}
                                        >
                                            <Sparkles class="w-6 h-6" />
                                            <span class="font-bold">NFT (ERC-721)</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => props.setMintStep(2)}
                                    class="w-full py-5 bg-gradient-to-r from-cyan-600 to-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/20 hover:scale-[1.02] transition-all active:scale-95"
                                >
                                    Next: Configuration
                                </button>
                            </div>
                        </Show>

                        {/* Step 2: Configuration */}
                        <Show when={props.mintStep() === 2}>
                            <div class="space-y-6">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Total Supply</label>
                                    <input
                                        type="number"
                                        class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all"
                                        value={props.tokenSupply()}
                                        onInput={(e) => props.setTokenSupply(e.currentTarget.value)}
                                    />
                                </div>

                                <div class="space-y-4">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Advanced Settings</label>
                                    <div class="space-y-4">
                                        <div class="relative group">
                                            <textarea
                                                placeholder="Description (Optional)"
                                                class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600 resize-none h-24"
                                            />
                                        </div>

                                        <Show when={props.tokenType() === 'nft'}>
                                            <div class="grid grid-cols-2 gap-4">
                                                <div class="relative group">
                                                    <input
                                                        type="number"
                                                        placeholder="Royalty %"
                                                        class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                                                    />
                                                </div>
                                                <div class="relative group">
                                                    <input
                                                        type="text"
                                                        placeholder="Metadata CID"
                                                        class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                                                    />
                                                </div>
                                            </div>
                                        </Show>

                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div class="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between group/toggle cursor-pointer hover:border-white/10 transition-colors">
                                                <div class="flex flex-col">
                                                    <span class="text-sm font-bold text-gray-300">Mintable</span>
                                                    <span class="text-[10px] text-gray-500 uppercase font-black">Allow future supply</span>
                                                </div>
                                                <div class="w-10 h-5 bg-cyan-500 rounded-full relative shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                                                    <div class="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                                                </div>
                                            </div>
                                            <div class="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between group/toggle cursor-pointer hover:border-white/10 transition-colors">
                                                <div class="flex flex-col">
                                                    <span class="text-sm font-bold text-gray-300">Burnable</span>
                                                    <span class="text-[10px] text-gray-500 uppercase font-black">Enable token burning</span>
                                                </div>
                                                <div class="w-10 h-5 bg-white/10 rounded-full relative">
                                                    <div class="absolute left-0.5 top-0.5 w-4 h-4 bg-white/30 rounded-full shadow-sm" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex gap-4">
                                    <button onClick={() => props.setMintStep(1)} class="px-8 py-5 bg-white/5 text-gray-400 font-bold rounded-2xl hover:bg-white/10 transition-all">Back</button>
                                    <button
                                        onClick={() => props.setMintStep(3)}
                                        class="flex-1 py-5 bg-gradient-to-r from-cyan-600 to-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/20 hover:scale-[1.02] transition-all active:scale-95"
                                    >
                                        Next: Select Networks
                                    </button>
                                </div>
                            </div>
                        </Show>

                        {/* Step 3: Network Selection */}
                        <Show when={props.mintStep() === 3}>
                            <div class="space-y-6">
                                <div class="space-y-4">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Target Networks (Cross-Chain)</label>
                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <For each={[
                                            { name: 'Ethereum', color: 'from-blue-600 to-indigo-500' },
                                            { name: 'Solana', color: 'from-purple-500 to-emerald-400' },
                                            { name: 'Base', color: 'from-blue-400 to-blue-600' },
                                            { name: 'Polygon', color: 'from-purple-600 to-pink-500' },
                                            { name: 'Arbitrum', color: 'from-blue-500 to-cyan-400' },
                                            { name: 'Binance', color: 'from-amber-400 to-amber-600' }
                                        ]}>
                                            {(network) => (
                                                <button
                                                    onClick={() => {
                                                        if (props.mintingNetworks().includes(network.name)) {
                                                            props.setMintingNetworks((prev: any[]) => prev.filter(n => n !== network.name));
                                                        } else {
                                                            props.setMintingNetworks((prev: any[]) => [...prev, network.name]);
                                                        }
                                                    }}
                                                    class={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group relative overflow-hidden ${props.mintingNetworks().includes(network.name) ? 'bg-white/5 border-white/20 text-white' : 'bg-[#111113] border-white/10 text-gray-500 hover:border-white/20'}`}
                                                >
                                                    <Show when={props.mintingNetworks().includes(network.name)}>
                                                        <div class={`absolute inset-0 bg-gradient-to-br ${network.color} opacity-10`} />
                                                    </Show>
                                                    <Globe class={`w-5 h-5 transition-colors ${props.mintingNetworks().includes(network.name) ? 'text-white' : 'group-hover:text-gray-300'}`} />
                                                    <span class="text-xs font-bold">{network.name}</span>
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>

                                <div class="bg-blue-500/5 border border-blue-500/10 p-5 rounded-2xl">
                                    <div class="flex gap-3">
                                        <Shield class="w-5 h-5 text-blue-400 shrink-0" />
                                        <p class="text-xs text-blue-300 leading-relaxed font-medium">Vision Chain will automatically handle the cross-chain interoperability proofs. One mint covers all selected networks.</p>
                                    </div>
                                </div>

                                <div class="flex gap-4">
                                    <button onClick={() => props.setMintStep(2)} class="px-8 py-5 bg-white/5 text-gray-400 font-bold rounded-2xl hover:bg-white/10 transition-all">Back</button>
                                    <button
                                        onClick={props.handleMint}
                                        disabled={props.isMinting() || !props.tokenName()}
                                        class="flex-1 py-5 bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/30 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Show when={props.isMinting()} fallback={props.mintedSuccess() ? "Mint Complete" : "Launch Token"}>
                                            <div class="flex flex-col items-center gap-1.5">
                                                <div class="flex items-center justify-center gap-3">
                                                    <RefreshCw class="w-4 h-4 animate-spin text-white/80" />
                                                    <span class="text-sm tracking-wide">Launching Studio...</span>
                                                </div>
                                                <div class="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <div class="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all duration-300" style={{ width: `${props.mintProgress()}%` }} />
                                                </div>
                                            </div>
                                        </Show>
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </div>

                    {/* Right Side: Live Preview */}
                    <div class="xl:col-span-5 relative">
                        <div class="sticky top-10 space-y-6">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Token Preview</label>

                            {/* Premium Token Card */}
                            <div class="relative group">
                                {/* Glow Effect */}
                                <div class={`absolute inset-0 bg-gradient-to-br transition-all duration-700 blur-[40px] opacity-20 ${props.tokenType() === 'fungible' ? 'from-cyan-500 to-emerald-500' : 'from-purple-500 to-pink-500'}`} />

                                <div class="relative bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden aspect-[4/5] flex flex-col">
                                    {/* Card Background Pattern */}
                                    <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ "background-image": "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", "background-size": "24px 24px" }} />

                                    <div class="flex justify-between items-start mb-12">
                                        <div class={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${props.tokenType() === 'fungible' ? 'bg-gradient-to-br from-cyan-500 to-emerald-400' : 'bg-gradient-to-br from-purple-500 to-pink-400'}`}>
                                            <Show when={props.tokenType() === 'fungible'} fallback={<Sparkles class="w-7 h-7 text-white" />}>
                                                <Zap class="w-7 h-7 text-white" />
                                            </Show>
                                        </div>
                                        <div class="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                            <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                            <span class="text-[10px] font-bold text-white uppercase tracking-tighter">Verified Standard</span>
                                        </div>
                                    </div>

                                    <div class="flex-1 space-y-2">
                                        <div class="text-[11px] font-black text-white/30 uppercase tracking-[0.2em]">Asset Name</div>
                                        <h3 class="text-3xl font-bold text-white tracking-tight truncate">{props.tokenName() || 'Vision Asset'}</h3>
                                        <div class="flex items-center gap-3">
                                            <span class={`text-sm font-bold px-2 py-0.5 rounded ${props.tokenType() === 'fungible' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                {props.tokenSymbol() || 'SYMBOL'}
                                            </span>
                                            <span class="text-xs text-gray-500 font-medium font-mono">{(Number(props.tokenSupply()) || 0).toLocaleString()} Initial Supply</span>
                                        </div>
                                    </div>

                                    <div class="pt-8 mt-8 border-t border-white/5 space-y-4">
                                        <div class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Distribution Networks</div>
                                        <div class="flex flex-wrap gap-2">
                                            <For each={props.mintingNetworks()}>
                                                {(network) => (
                                                    <span class="px-3 py-1.5 bg-white/5 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5">
                                                        <div class="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                                        {network}
                                                    </span>
                                                )}
                                            </For>
                                        </div>
                                    </div>

                                    {/* Watermark */}
                                    <div class="absolute bottom-8 right-8 text-[10px] font-black text-white/10 uppercase tracking-widest rotate-90 origin-bottom-right">
                                        Minted via Vision Chain
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Success Message UI */}
                <Presence>
                    <Show when={props.mintedSuccess()}>
                        <div class="fixed inset-0 z-[100] flex items-center justify-center px-4 p-4">
                            <Motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                class="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                onClick={() => props.setMintedSuccess(false)}
                            />
                            <Motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                class="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 p-6 rounded-[24px] flex flex-col items-center text-center gap-4 relative overflow-hidden group/success"
                            >
                                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/success:translate-x-full transition-transform duration-1000" />
                                <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                                    <Check class="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h4 class="text-white font-bold text-lg">Mint Successful!</h4>
                                    <p class="text-green-400/80 text-sm">{props.tokenSymbol() || 'Asset'} is now live on {props.mintingNetworks().length} networks.</p>
                                </div>
                                <div class="flex gap-2 w-full mt-2 relative z-10">
                                    <button class="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all border border-white/5">View Explorer</button>
                                    <button
                                        onClick={() => {
                                            props.setMintedSuccess(false);
                                            props.setTokenName('');
                                            props.setTokenSymbol('');
                                            props.setMintStep(1);
                                            props.setTokenSupply('1000000');
                                            props.setMintingNetworks(['Ethereum']);
                                        }}
                                        class="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-green-500/20"
                                    >
                                        New Mint
                                    </button>
                                </div>
                            </Motion.div>
                        </div>
                    </Show>
                </Presence>

                {/* My Collections Section */}
                <div class="mt-20 pt-10 border-t border-white/[0.04] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h3 class="text-2xl font-bold text-white tracking-tight mb-1">My Collections</h3>
                            <p class="text-gray-500 text-sm">Manage and track your deployed assets across all chains</p>
                        </div>
                        <button class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition-all border border-white/5">View Full History</button>
                    </div>

                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <For each={[] as any[]}>
                            {(collection) => (
                                <div class="bg-[#111113] border border-white/[0.06] rounded-[24px] overflow-hidden group hover:border-white/20 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/5 transition-all duration-500 cursor-pointer flex flex-col">
                                    <div class={`h-32 bg-gradient-to-br ${collection.color} p-6 flex items-end relative overflow-hidden`}>
                                        <div class="absolute top-4 left-4 px-2 py-0.5 bg-black/20 backdrop-blur-md rounded text-[8px] font-black text-white/90 uppercase tracking-widest">{collection.date}</div>
                                        <div class="absolute top-4 right-4 text-[10px] font-black text-white/40 uppercase tracking-widest">{collection.type}</div>
                                        <div class="absolute -right-8 -bottom-8 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700" />
                                        <Sparkles class="w-8 h-8 text-white/50 group-hover:scale-110 group-hover:text-white transition-all duration-700" />
                                    </div>
                                    <div class="p-5 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h4 class="font-bold text-base text-white mb-1 group-hover:text-cyan-400 transition-colors">{collection.name}</h4>
                                            <div class="flex items-center gap-2 mb-4">
                                                <span class="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Chain Status:</span>
                                                <div class="flex items-center gap-1">
                                                    <div class="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    <span class="text-[10px] text-green-500/80 font-bold">Synced</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex items-center justify-between border-t border-white/5 pt-4">
                                            <span class="text-xs text-gray-500 font-medium">{collection.items} Items</span>
                                            <div class="flex -space-x-1.5">
                                                <div class="w-5 h-5 rounded-full border border-[#111113] bg-blue-500 flex items-center justify-center text-[7px] font-black text-white shadow-sm" title="Ethereum">ETH</div>
                                                <div class="w-5 h-5 rounded-full border border-[#111113] bg-[#14F195] flex items-center justify-center text-[7px] font-black text-black shadow-sm" title="Solana">SOL</div>
                                                <div class="w-5 h-5 rounded-full border border-[#111113] bg-[#0052FF] flex items-center justify-center text-[7px] font-black text-white shadow-sm" title="Base">B</div>
                                                <div class="w-5 h-5 rounded-full border border-[#111113] bg-gray-700 flex items-center justify-center text-[7px] font-black text-white shadow-sm">+2</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </div>
        </div>
    );
};
