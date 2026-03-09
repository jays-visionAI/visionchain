import { createSignal, lazy, Suspense } from 'solid-js';
import { AdminTabs } from './AdminTabs';

const Announcements = lazy(() => import('./AdminAnnouncements').then(m => ({ default: m.AdminAnnouncements })));
const DailyTips = lazy(() => import('./AdminDailyTips'));

const TABS = [
    {
        id: 'announcements',
        label: 'Announcements',
        icon: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
        ),
    },
    {
        id: 'tips',
        label: 'Daily Tips',
        icon: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <line x1="9" y1="18" x2="15" y2="18" /><line x1="10" y1="22" x2="14" y2="22" />
                <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
            </svg>
        ),
    },
];

export default function AdminContentHub() {
    const [activeTab, setActiveTab] = createSignal('announcements');

    return (
        <div class="p-6 max-w-7xl">
            <AdminTabs tabs={TABS} activeTab={activeTab()} onTabChange={setActiveTab} />
            <Suspense fallback={
                <div class="p-12 flex justify-center">
                    <div class="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
            }>
                {activeTab() === 'announcements' && <Announcements />}
                {activeTab() === 'tips' && <DailyTips />}
            </Suspense>
        </div>
    );
}
