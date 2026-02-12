import { createSignal, Show, Switch, Match, lazy, Suspense } from 'solid-js';
import {
    FileText,
    Upload,
    Users,
    Activity,
    Megaphone
} from 'lucide-solid';

const UploadCSV = lazy(() => import('./UploadCSV').then(m => ({ default: m.UploadCSV })));
const ActivateContract = lazy(() => import('./ActivateContract'));
const ManagePartners = lazy(() => import('./ManagePartners').then(m => ({ default: m.ManagePartners })));
const Announcement = lazy(() => import('./Announcement').then(m => ({ default: m.Announcement })));

// Helper for loading state
const TabLoading = () => (
    <div class="flex items-center justify-center h-64">
        <div class="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
);

export default function AdminVCNDistribution() {
    const [activeTab, setActiveTab] = createSignal<'upload' | 'contract' | 'partners' | 'announcement'>('upload');

    const TabButton = (props: { id: string, label: string, icon: any, active: boolean, onClick: () => void }) => (
        <button
            onClick={props.onClick}
            class={`relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 min-w-[140px] ${props.active
                ? 'bg-[#1e2330] border-blue-500/30 text-white shadow-lg shadow-blue-900/10'
                : 'bg-[#0B0E14] border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-400'
                }`}
        >
            <props.icon class={`w-6 h-6 mb-2 ${props.active ? 'text-blue-400' : 'opacity-50'}`} />
            <span class="text-[10px] font-bold uppercase tracking-widest">{props.label}</span>
            {props.active && (
                <div class="absolute inset-0 border-2 border-blue-500/20 rounded-xl pointer-events-none" />
            )}
        </button>
    );

    return (
        <div class="space-y-8">
            {/* Header */}
            <div>
                <h1 class="text-2xl font-bold text-white mb-2">VCN Distribution</h1>
                <p class="text-slate-400 text-sm">Manage privileged tasks on VisionChain Vesting service</p>
            </div>

            {/* Navigation Tabs */}
            <div class="flex flex-wrap gap-4">
                <TabButton
                    id="upload"
                    label="Upload CSV"
                    icon={FileText}
                    active={activeTab() === 'upload'}
                    onClick={() => setActiveTab('upload')}
                />
                <TabButton
                    id="contract"
                    label="Activate Contract"
                    icon={Activity}
                    active={activeTab() === 'contract'}
                    onClick={() => setActiveTab('contract')}
                />
                <TabButton
                    id="partners"
                    label="Manage Partners"
                    icon={Users}
                    active={activeTab() === 'partners'}
                    onClick={() => setActiveTab('partners')}
                />
                <TabButton
                    id="announcement"
                    label="Announcement"
                    icon={Megaphone}
                    active={activeTab() === 'announcement'}
                    onClick={() => setActiveTab('announcement')}
                />
            </div>

            {/* Content Area */}
            <div class="min-h-[500px]">
                <Suspense fallback={<TabLoading />}>
                    <Switch>
                        <Match when={activeTab() === 'upload'}>
                            <UploadCSV />
                        </Match>
                        <Match when={activeTab() === 'contract'}>
                            <ActivateContract />
                        </Match>
                        <Match when={activeTab() === 'partners'}>
                            <ManagePartners />
                        </Match>
                        <Match when={activeTab() === 'announcement'}>
                            <Announcement />
                        </Match>
                    </Switch>
                </Suspense>
            </div>
        </div>
    );
}
