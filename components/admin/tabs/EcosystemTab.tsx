import { For, Show, createSignal, onMount } from 'solid-js';
import { Coins, Send, AlertCircle, ExternalLink, Zap, ShieldCheck } from 'lucide-solid';
import { VcnPurchase } from '../../../services/firebaseService';
import { contractService } from '../../../services/contractService';

interface EcosystemTabProps {
    purchases: () => VcnPurchase[];
    isDistributing: () => boolean;
    onDistribute: () => Promise<void>;
    txHashes: () => Record<string, string>;
}

export function EcosystemTab(props: EcosystemTabProps) {
    const [paymasterBal, setPaymasterBal] = createSignal<string>("0.00");
    const [isChecking, setIsChecking] = createSignal(false);

    const refreshPaymaster = async () => {
        setIsChecking(true);
        try {
            const bal = await contractService.getPaymasterBalance();
            setPaymasterBal(bal);
        } catch (e) {
            console.error("Failed to check paymaster:", e);
        } finally {
            setIsChecking(false);
        }
    };

    onMount(() => {
        refreshPaymaster();
    });

    return (
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Paymaster Header Card */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2 p-6 rounded-[32px] bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/20 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center gap-2 text-blue-400 mb-2">
                            <Zap class="w-4 h-4" />
                            <span class="text-[10px] font-black uppercase tracking-[0.2em]">Gasless Relay Status</span>
                        </div>
                        <h3 class="text-2xl font-black text-white italic">AA PAYMASTER CORE</h3>
                        <p class="text-xs text-gray-500 mt-1">Global pool for sponsoring user transaction fees.</p>
                    </div>
                    <div class="mt-6 flex items-center gap-4">
                        <div class="px-4 py-2 bg-black/40 rounded-xl border border-white/5">
                            <span class="text-[10px] text-gray-500 font-bold block mb-1">BALANCE</span>
                            <span class="text-xl font-mono font-black text-blue-400">{Number(paymasterBal()).toFixed(4)} POL</span>
                        </div>
                        <button
                            onClick={refreshPaymaster}
                            disabled={isChecking()}
                            class="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-colors"
                        >
                            <ShieldCheck class={`w-5 h-5 ${isChecking() ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div class="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                    <div class="space-y-4">
                        <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <span>Relay Health</span>
                            <span class="text-green-400">Optimal</span>
                        </div>
                        <div class="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div class="h-full w-[92%] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        </div>
                        <p class="text-[10px] text-gray-500 leading-relaxed">
                            Currently facilitating 142.5 tx/min without user gas interaction.
                        </p>
                    </div>
                    <button class="w-full py-3 bg-white/[0.03] border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-blue-600 hover:text-white transition-all">
                        Test Relay Logic
                    </button>
                </div>
            </div>

            <div class="flex items-center justify-between pt-4">
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <Coins class="w-5 h-5 text-amber-400" />
                    User Distribution (TxID Tracked)
                </h2>
                <button
                    onClick={() => props.onDistribute()}
                    disabled={props.isDistributing() || props.purchases().length === 0}
                    class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
                >
                    <Send class={`w-4 h-4 ${props.isDistributing() ? 'animate-pulse' : ''}`} />
                    {props.isDistributing() ? 'Distributing...' : 'Distribute Testnet VCN (10%)'}
                </button>
            </div>

            <div class="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
                <table class="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr class="border-b border-white/10 bg-white/5">
                            <th class="p-4 text-gray-400 font-medium text-[11px] uppercase tracking-wider">User Account</th>
                            <th class="p-4 text-gray-400 font-medium text-[11px] uppercase tracking-wider">Mainnet VCN</th>
                            <th class="p-4 text-gray-400 font-medium text-[11px] uppercase tracking-wider">Testnet Allot.</th>
                            <th class="p-4 text-gray-400 font-medium text-[11px] uppercase tracking-wider">Status</th>
                            <th class="p-4 text-gray-400 font-medium text-[11px] uppercase tracking-wider">Last TxID</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={props.purchases()}>
                            {(p) => (
                                <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                    <td class="p-4">
                                        <div class="flex flex-col">
                                            <span class="text-white font-medium text-xs">{p.email}</span>
                                            <Show when={p.walletAddress}>
                                                <code class="text-[9px] text-gray-500 font-mono mt-0.5">{p.walletAddress}</code>
                                            </Show>
                                        </div>
                                    </td>
                                    <td class="p-4 text-white font-bold">{p.amount.toLocaleString()}</td>
                                    <td class="p-4 text-amber-400 font-black tabular-nums">{(p.amount * 0.1).toLocaleString()}</td>
                                    <td class="p-4">
                                        <Show when={p.walletAddress} fallback={
                                            <span class="px-2 py-0.5 rounded text-[9px] bg-red-500/10 text-red-500 font-black uppercase tracking-widest">No Wallet</span>
                                        }>
                                            <span class="px-2 py-0.5 rounded text-[9px] bg-green-500/10 text-green-400 font-black uppercase tracking-widest border border-green-500/20">Ready</span>
                                        </Show>
                                    </td>
                                    <td class="p-4">
                                        <Show when={props.txHashes()[p.email]} fallback={
                                            <span class="text-gray-600 italic text-[10px]">No recent Tx</span>
                                        }>
                                            <a
                                                href={`/visionscan?tx=${props.txHashes()[p.email]}`}
                                                target="_blank"
                                                class="flex items-center gap-1.5 text-blue-400 hover:text-cyan-400 transition-colors group"
                                            >
                                                <span class="font-mono text-xs">{props.txHashes()[p.email].slice(0, 10)}...</span>
                                                <ExternalLink class="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            </a>
                                        </Show>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
                <Show when={props.purchases().length === 0}>
                    <div class="p-20 text-center text-gray-500 italic">No purchase records found in database.</div>
                </Show>
            </div>

            <div class="p-5 bg-amber-500/5 border border-amber-500/10 rounded-[24px] flex gap-4 items-start">
                <div class="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertCircle class="w-6 h-6 text-amber-400" />
                </div>
                <div class="text-[13px] text-amber-400/80 leading-relaxed">
                    <p class="font-black text-amber-500 mb-1 uppercase tracking-widest text-[11px]">Paymaster Distribution Control</p>
                    All distribution transactions are processed through the official <span class="text-white font-bold">Admin Relayer</span>. Ensure the Paymaster Pool has enough POL for gas to avoid transaction failures.
                </div>
            </div>
        </div>
    );
}
