import { createSignal, lazy, Suspense } from 'solid-js';
import { AdminTabs } from './AdminTabs';

const Users = lazy(() => import('./AdminUsers'));
const Analytics = lazy(() => import('./AdminUserAnalytics'));

const TABS = [
    {
        id: 'users',
        label: 'User Management',
        icon: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
    {
        id: 'analytics',
        label: 'Analytics',
        icon: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
        ),
    },
];

export default function AdminUsersHub() {
    const [activeTab, setActiveTab] = createSignal('users');

    return (
        <div class="p-6 max-w-7xl">
            <AdminTabs tabs={TABS} activeTab={activeTab()} onTabChange={setActiveTab} />
            <Suspense fallback={
                <div class="p-12 flex justify-center">
                    <div class="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
            }>
                {activeTab() === 'users' && <Users />}
                {activeTab() === 'analytics' && <Analytics />}
            </Suspense>
        </div>
    );
}
