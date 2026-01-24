import { For, Show } from 'solid-js';
import { Coins, Send, AlertCircle } from 'lucide-solid';
import { VcnPurchase } from '../../../services/firebaseService';

interface EcosystemTabProps {
    purchases: () => VcnPurchase[];
    isDistributing: () => boolean;
    onDistribute: () => Promise<void>;
}

export function EcosystemTab(props: EcosystemTabProps) {
    return (
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <Coins class="w-5 h-5 text-amber-400" />
                    Ecosystem Distribution
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
                            <th class="p-4 text-gray-400 font-medium">User Email</th>
                            <th class="p-4 text-gray-400 font-medium">Wallet Address</th>
                            <th class="p-4 text-gray-400 font-medium">Mainnet VCN</th>
                            <th class="p-4 text-gray-400 font-medium">Testnet Allocation (10%)</th>
                            <th class="p-4 text-gray-400 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={props.purchases()}>
                            {(p) => (
                                <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                    <td class="p-4 text-white font-medium">{p.email}</td>
                                    <td class="p-4 tabular-nums">
                                        <Show when={p.walletAddress} fallback={
                                            <span class="text-red-500/50 italic text-xs">Not Linked</span>
                                        }>
                                            <code class="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">
                                                {p.walletAddress!.slice(0, 10)}...{p.walletAddress!.slice(-8)}
                                            </code>
                                        </Show>
                                    </td>
                                    <td class="p-4 text-white font-bold">{p.amount.toLocaleString()}</td>
                                    <td class="p-4 text-amber-400 font-black tabular-nums">{(p.amount * 0.1).toLocaleString()}</td>
                                    <td class="p-4">
                                        <Show when={p.walletAddress} fallback={
                                            <span class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-500 font-black uppercase tracking-widest">Wait Wallet</span>
                                        }>
                                            <span class="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-500 font-black uppercase tracking-widest">Ready</span>
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
                    <p class="font-black text-amber-500 mb-1 uppercase tracking-widest text-[11px]">Admin Compliance Notice</p>
                    Distribution is strictly for **Testnet VCN** as part of the PoV validation phase. Tokens are sent directly from the locked Admin Treasury. Please ensure the target users have at least one valid VCN purchase linked to their account.
                </div>
            </div>
        </div>
    );
}
