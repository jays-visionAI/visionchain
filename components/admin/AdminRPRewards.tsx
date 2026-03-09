import { createSignal, lazy, Suspense } from 'solid-js';
import { AdminTabs } from './AdminTabs';

const RPConfig = lazy(() => import('./AdminRPConfig'));
const ActivityFeed = lazy(() => import('./AdminActivity'));
const RewardEngine = lazy(() => import('./AdminRewardHub'));

const TABS = [
    {
        id: 'config',
        label: 'RP Config',
        icon: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
        ),
    },
    {
        id: 'activity',
        label: 'Activity Feed',
        icon: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
        ),
    },
    {
        id: 'engine',
        label: 'Reward Engine',
        icon: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v6m0 6v6M4.2 4.2l4.3 4.3m7 7 4.3 4.3M1 12h6m6 0h6M4.2 19.8l4.3-4.3m7-7 4.3-4.3" />
            </svg>
        ),
    },
];

export default function AdminRPRewards() {
    const [activeTab, setActiveTab] = createSignal('config');

    return (
        <div class="p-6 max-w-7xl">
            <AdminTabs tabs={TABS} activeTab={activeTab()} onTabChange={setActiveTab} />
            <Suspense fallback={
                <div class="p-12 flex justify-center">
                    <div class="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
            }>
                {activeTab() === 'config' && <RPConfig />}
                {activeTab() === 'activity' && <ActivityFeed />}
                {activeTab() === 'engine' && <RewardEngine />}
            </Suspense>
        </div>
    );
}
