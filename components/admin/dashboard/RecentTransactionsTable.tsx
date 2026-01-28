import { Component, For, Show } from 'solid-js';
import { Search } from 'lucide-solid';

interface RecentTransactionsTableProps {
    transactions: any[];
}

export const RecentTransactionsTable: Component<RecentTransactionsTableProps> = (props) => {
    return (
        <div class="bg-[#13161F] border border-white/5 rounded-2xl overflow-hidden">
            <div class="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 class="text-xs font-black text-slate-500 uppercase tracking-widest">Recent Transactions</h3>
                <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search TxHash / Block"
                        class="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 w-64 transition-all"
                    />
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-white/[0.02] text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <th class="p-4 pl-6">Tx Hash</th>
                            <th class="p-4">Type</th>
                            <th class="p-4">From</th>
                            <th class="p-4">To</th>
                            <th class="p-4">Amount</th>
                            <th class="p-4">Status</th>
                            <th class="p-4 text-right pr-6">Time</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <Show when={props.transactions.length > 0} fallback={
                            <tr>
                                <td colspan="7" class="p-20 text-center text-slate-500 text-sm">
                                    No recent transactions found
                                </td>
                            </tr>
                        }>
                            <For each={props.transactions}>
                                {(tx: any) => (
                                    <tr class="hover:bg-white/[0.02] transition-colors group">
                                        <td class="p-4 pl-6 font-mono text-xs text-blue-400 group-hover:text-cyan-400 cursor-pointer">{tx.hash}</td>
                                        <td class="p-4">
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-slate-300">
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td class="p-4 font-mono text-xs text-slate-400">{tx.from}</td>
                                        <td class="p-4 font-mono text-xs text-slate-400">{tx.to}</td>
                                        <td class="p-4 text-xs font-bold text-white">{tx.amount} VCN</td>
                                        <td class="p-4">
                                            <span class="text-[10px] font-bold uppercase tracking-wider text-green-400">Success</span>
                                        </td>
                                        <td class="p-4 text-right pr-6 text-xs text-slate-500">{tx.time} min ago</td>
                                    </tr>
                                )}
                            </For>
                        </Show>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
