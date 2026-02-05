import { createSignal, Show, For } from 'solid-js';
import {
    ArrowDownLeft,
    Copy,
    Check,
    Sparkles,
    ArrowLeft,
    Globe,
    Shield
} from 'lucide-solid';
import { WalletViewHeader } from './WalletViewHeader';

interface WalletReceiveProps {
    onBack: () => void;
    walletAddress: () => string;
    receiveNetwork: () => string;
    setReceiveNetwork: (net: string) => void;
    copyAddress: () => void;
    copied: () => boolean;
}

export const WalletReceive = (props: WalletReceiveProps) => {
    return (
        <div class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8">
            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div class="flex items-center gap-4 mb-2 lg:hidden">
                    <button
                        onClick={props.onBack}
                        class="p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft class="w-5 h-5" />
                    </button>
                    <span class="text-sm font-bold text-gray-500 uppercase tracking-widest">Back to Assets</span>
                </div>

                <WalletViewHeader
                    tag="Inbound Transfers"
                    title="RECEIVE"
                    titleAccent="ASSETS"
                    description="Your permanent on-chain identity. Scan or copy your address to receive tokens from any network."
                    icon={ArrowDownLeft}
                />

                <div class="w-full space-y-8">
                    {/* Network Selector */}
                    <div class="w-full">
                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-4 text-center">Select Destination Network</label>
                        <div class="flex flex-wrap justify-center gap-2">
                            <For each={['Vision Chain', 'Ethereum', 'Polygon', 'Base']}>
                                {(net) => (
                                    <button
                                        onClick={() => props.setReceiveNetwork(net)}
                                        class={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${props.receiveNetwork() === net ? 'bg-green-500/10 border-green-500/50 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'}`}
                                    >
                                        {net}
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* QR Code Section */}
                    <div class="relative group">
                        <div class="absolute -inset-8 bg-green-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <div class="relative bg-white p-8 rounded-[48px] shadow-2xl flex flex-col items-center justify-center transform group-hover:scale-[1.02] transition-transform duration-500">
                            <div class="relative w-56 h-56 p-2 bg-white rounded-2xl flex items-center justify-center">
                                <Show when={props.walletAddress()} fallback={<div class="w-full h-full bg-gray-100 animate-pulse rounded-xl" />}>
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${props.walletAddress()}&margin=10&color=000000&bgcolor=FFFFFF`}
                                        alt="Wallet QR Code"
                                        class="w-full h-full"
                                    />
                                    {/* Central Logo Overlay */}
                                    <div class="absolute inset-0 flex items-center justify-center">
                                        <div class="w-14 h-14 bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center p-2">
                                            <div class="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                                <Sparkles class="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                            <div class="absolute top-6 right-6">
                                <div class="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse" />
                            </div>
                        </div>
                    </div>

                    {/* Address Display */}
                    <div class="w-full space-y-4">
                        <div
                            class="p-6 bg-[#111113] border border-white/10 rounded-[32px] text-center group active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden"
                            onClick={props.copyAddress}
                        >
                            <div class="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">Your Wallet Address</div>
                            <div class="text-white font-mono break-all text-sm lg:text-base tracking-tight leading-relaxed px-4 select-all">{props.walletAddress() || 'Fetching address...'}</div>
                        </div>

                        <button
                            onClick={props.copyAddress}
                            class="w-full py-6 bg-white text-black font-black rounded-2xl transition-all hover:bg-white/90 active:scale-[0.98] flex items-center justify-center gap-3 shadow-2xl shadow-white/5 uppercase tracking-widest text-sm"
                        >
                            <Show when={props.copied()} fallback={<><Copy class="w-5 h-5" /> Copy Your Address</>}>
                                <Check class="w-5 h-5 text-green-600" /> Copied to Clipboard
                            </Show>
                        </button>
                    </div>

                    {/* Safety Warnings */}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <div class="p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-4">
                            <Globe class="w-5 h-5 text-blue-400 shrink-0" />
                            <p class="text-[10px] text-blue-300/80 font-bold uppercase tracking-wider leading-relaxed">
                                Deposits are automatically reconciled across <span class="text-blue-400">Vision Bridge</span> nodes.
                            </p>
                        </div>
                        <div class="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex gap-4">
                            <Shield class="w-5 h-5 text-amber-400 shrink-0" />
                            <p class="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider leading-relaxed text-left">
                                Only send assets supported by <span class="text-amber-400">{props.receiveNetwork()}</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
