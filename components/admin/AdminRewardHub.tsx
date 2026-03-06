import { createSignal, onMount, Show, lazy, Suspense } from 'solid-js';
import { RefreshCw } from 'lucide-solid';

const AdminRewardPolicy = lazy(() => import('./AdminRewardPolicy'));
const AdminRewardSettlement = lazy(() => import('./AdminRewardSettlement'));
const AdminRewardOps = lazy(() => import('./AdminRewardOps'));

type TabId = 'policy' | 'settlement' | 'ops';

const TABS: { id: TabId; label: string; desc: string }[] = [
    { id: 'policy', label: 'Policy', desc: 'Reward policy parameters' },
    { id: 'settlement', label: 'Settlement', desc: 'Revenue, snapshots, payouts' },
    { id: 'ops', label: 'Operations', desc: 'Reports, abuse, bootstrap' },
];

export default function AdminRewardHub() {
    const [activeTab, setActiveTab] = createSignal<TabId>('policy');

    return (
        <div class="max-w-6xl mx-auto">
            {/* Header */}
            <div class="mb-6">
                <h1 class="text-3xl font-bold text-white tracking-tight">Reward Engine</h1>
                <p class="text-gray-400 mt-1">Distributed storage node reward management</p>
            </div>

            {/* Tab Navigation */}
            <div class="flex gap-1 mb-8 bg-[#0d0d10] rounded-xl p-1 border border-white/5">
                {TABS.map(tab => (
                    <button
                        onClick={() => setActiveTab(tab.id)}
                        class={`flex-1 py-3 px-4 rounded-lg transition-all ${activeTab() === tab.id
                                ? 'bg-white/10 text-white shadow-lg'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                            }`}
                    >
                        <div class="text-xs font-black uppercase tracking-widest">{tab.label}</div>
                        <div class="text-[10px] text-gray-500 mt-0.5 hidden md:block">{tab.desc}</div>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <Suspense fallback={<div class="p-12 text-center"><RefreshCw class="w-6 h-6 text-gray-500 animate-spin mx-auto" /></div>}>
                <Show when={activeTab() === 'policy'}>
                    <AdminRewardPolicy />
                </Show>
                <Show when={activeTab() === 'settlement'}>
                    <AdminRewardSettlement />
                </Show>
                <Show when={activeTab() === 'ops'}>
                    <AdminRewardOps />
                </Show>
            </Suspense>
        </div>
    );
}
