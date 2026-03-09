import { createSignal, lazy, Suspense } from 'solid-js';
import { AdminTabs } from './AdminTabs';

const VisionNodes = lazy(() => import('./AdminVisionNodes'));
const NodeHealth = lazy(() => import('./AdminNodeHealth'));

const TABS = [
    {
        id: 'nodes',
        label: 'Vision Nodes',
        icon: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
        ),
    },
    {
        id: 'health',
        label: 'Node Health',
        icon: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
        ),
    },
];

export default function AdminNodesHub() {
    const [activeTab, setActiveTab] = createSignal('nodes');

    return (
        <div class="p-6 max-w-7xl">
            <AdminTabs tabs={TABS} activeTab={activeTab()} onTabChange={setActiveTab} />
            <Suspense fallback={
                <div class="p-12 flex justify-center">
                    <div class="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
            }>
                {activeTab() === 'nodes' && <VisionNodes />}
                {activeTab() === 'health' && <NodeHealth />}
            </Suspense>
        </div>
    );
}
