import { Show, For } from 'solid-js';
import { Plus } from 'lucide-solid';

interface WalletActivityProps {
    purchases: () => any[];
}

export const WalletActivity = (props: WalletActivityProps) => {
    return (
        <div class="space-y-3">
            <Show when={props.purchases().length === 0}>
                <div class="py-20 text-center bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                    <div class="text-gray-500 font-medium">No activities found</div>
                </div>
            </Show>
            <For each={props.purchases().slice().reverse()}>
                {(p) => {
                    const date = new Date(p.createdAt).toLocaleDateString();
                    return (
                        <div class="flex items-center justify-between py-4 px-5 bg-[#111114] border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer group">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Plus class="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-white underline-offset-4 group-hover:underline">VCN Purchased</div>
                                    <div class="text-xs text-gray-500">From Vision Chain • {date}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-sm font-medium text-blue-400">+{p.amount.toLocaleString()} VCN</div>
                                <div class="text-xs text-gray-500">Status: {p.status}</div>
                            </div>
                        </div>
                    );
                }}
            </For>
        </div>
    );
};
