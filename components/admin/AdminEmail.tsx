import { createSignal, For, Show, onMount } from 'solid-js';
import { Mail, Eye, Send, RefreshCw, AlertCircle, Check, X, ChevronDown, BarChart3 } from 'lucide-solid';
import { getAdminFirebaseAuth } from '../../services/firebaseService';

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'visionchain-testnet';

function getAdminCloudFunctionUrl(fnName: string) {
    return `https://us-central1-${PROJECT_ID}.cloudfunctions.net/${fnName}`;
}

async function getAdminToken(): Promise<string> {
    const auth = getAdminFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated as admin');
    return user.getIdToken();
}

interface TemplateInfo {
    id: string;
    name: string;
    category: string;
    description: string;
    html?: string;
}

interface CategoryStat {
    optedIn: number;
    optedOut: number;
}

interface EmailStats {
    totalUsers: number;
    categoryStats: Record<string, CategoryStat>;
    recentPasswordResets: number;
    dripQueue: { pending: number; sent: number; skipped: number };
}

// Category display info
const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
    security: { label: 'Security Alerts', color: 'amber' },
    staking: { label: 'Staking', color: 'cyan' },
    referral: { label: 'Referral', color: 'purple' },
    bridge: { label: 'Bridge', color: 'blue' },
    weeklyReport: { label: 'Weekly Report', color: 'green' },
    lifecycle: { label: 'Onboarding', color: 'pink' },
    announcements: { label: 'Announcements', color: 'orange' },
};

export default function AdminEmail() {
    const [activeTab, setActiveTab] = createSignal<'dashboard' | 'templates' | 'subscriptions'>('dashboard');
    const [templates, setTemplates] = createSignal<TemplateInfo[]>([]);
    const [allTemplates, setAllTemplates] = createSignal<Record<string, TemplateInfo>>({});
    const [selectedTemplate, setSelectedTemplate] = createSignal<string | null>(null);
    const [stats, setStats] = createSignal<EmailStats | null>(null);
    const [loading, setLoading] = createSignal(false);
    const [statsLoading, setStatsLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [sendingTest, setSendingTest] = createSignal<string | null>(null);
    const [sendSuccess, setSendSuccess] = createSignal('');

    // Load data on mount
    onMount(async () => {
        await Promise.all([loadTemplates(), loadStats()]);
    });

    const loadTemplates = async () => {
        setLoading(true);
        setError('');
        try {
            const token = await getAdminToken();
            const response = await fetch(getAdminCloudFunctionUrl('adminEmailPreview'), {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setTemplates(data.templates);
            setAllTemplates(data.allTemplates);
        } catch (err: any) {
            setError(err.message || 'Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        setStatsLoading(true);
        try {
            const token = await getAdminToken();
            const response = await fetch(getAdminCloudFunctionUrl('adminEmailStats'), {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStats(data);
        } catch (err: any) {
            console.error('[AdminEmail] Stats error:', err);
        } finally {
            setStatsLoading(false);
        }
    };

    const handleSendTest = async (templateId: string) => {
        setSendingTest(templateId);
        setSendSuccess('');
        try {
            const token = await getAdminToken();
            const response = await fetch(getAdminCloudFunctionUrl('adminSendTestEmail'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ templateId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setSendSuccess(data.message);
            setTimeout(() => setSendSuccess(''), 5000);
        } catch (err: any) {
            setError(err.message || 'Failed to send test email');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSendingTest(null);
        }
    };

    const getCategoryBadge = (category: string) => {
        const info = CATEGORY_INFO[category];
        if (!info) return <span class="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-[10px] font-bold rounded-full uppercase">{category}</span>;

        const colors: Record<string, string> = {
            amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
            purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            green: 'bg-green-500/20 text-green-400 border-green-500/30',
            pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
            orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        };

        return (
            <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border ${colors[info.color] || ''}`}>
                {info.label}
            </span>
        );
    };

    const getOptInPercentage = (cat: CategoryStat) => {
        const total = cat.optedIn + cat.optedOut;
        if (total === 0) return 0;
        return Math.round((cat.optedIn / total) * 100);
    };

    return (
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <div class="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
                        <Mail class="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <h1 class="text-2xl font-black text-white tracking-tight">Email Management</h1>
                        <p class="text-gray-500 text-sm">Template preview, subscription stats, and test delivery</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div class="flex gap-2 border-b border-white/10 pb-4">
                {[
                    { id: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
                    { id: 'templates' as const, label: 'Templates', icon: Eye },
                    { id: 'subscriptions' as const, label: 'Subscriptions', icon: Mail },
                ].map((tab) => (
                    <button
                        onClick={() => setActiveTab(tab.id)}
                        class={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab() === tab.id
                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <tab.icon class="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Alert messages */}
            <Show when={error()}>
                <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
                    <AlertCircle class="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span class="text-red-400 text-sm">{error()}</span>
                    <button onClick={() => setError('')} class="ml-auto p-1 hover:bg-white/10 rounded-lg">
                        <X class="w-3 h-3 text-red-400" />
                    </button>
                </div>
            </Show>

            <Show when={sendSuccess()}>
                <div class="p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2">
                    <Check class="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span class="text-green-400 text-sm">{sendSuccess()}</span>
                </div>
            </Show>

            {/* ==================== DASHBOARD TAB ==================== */}
            <Show when={activeTab() === 'dashboard'}>
                <Show when={statsLoading()}>
                    <div class="flex items-center justify-center py-12">
                        <div class="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    </div>
                </Show>

                <Show when={stats() && !statsLoading()}>
                    {/* Top Stats Cards */}
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Total Users</p>
                            <p class="text-3xl font-black text-white">{stats()!.totalUsers.toLocaleString()}</p>
                        </div>
                        <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Password Resets (24h)</p>
                            <p class="text-3xl font-black text-cyan-400">{stats()!.recentPasswordResets}</p>
                        </div>
                        <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Drip Queue Pending</p>
                            <p class="text-3xl font-black text-amber-400">{stats()!.dripQueue.pending}</p>
                        </div>
                        <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Drip Emails Sent</p>
                            <p class="text-3xl font-black text-green-400">{stats()!.dripQueue.sent}</p>
                        </div>
                    </div>

                    {/* Subscription Overview */}
                    <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                        <div class="flex items-center justify-between p-6 border-b border-white/5">
                            <h2 class="text-lg font-bold text-white">Subscription Overview</h2>
                            <button
                                onClick={loadStats}
                                class="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                            >
                                <RefreshCw class={`w-4 h-4 ${statsLoading() ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        <div class="divide-y divide-white/5">
                            <For each={Object.entries(stats()!.categoryStats)}>
                                {([key, stat]) => {
                                    const info = CATEGORY_INFO[key];
                                    const pct = getOptInPercentage(stat);
                                    const barColors: Record<string, string> = {
                                        amber: 'from-amber-500 to-amber-600',
                                        cyan: 'from-cyan-500 to-cyan-600',
                                        purple: 'from-purple-500 to-purple-600',
                                        blue: 'from-blue-500 to-blue-600',
                                        green: 'from-green-500 to-green-600',
                                        pink: 'from-pink-500 to-pink-600',
                                        orange: 'from-orange-500 to-orange-600',
                                    };

                                    return (
                                        <div class="p-5 hover:bg-white/[0.01] transition-colors">
                                            <div class="flex items-center justify-between mb-3">
                                                <div class="flex items-center gap-3">
                                                    <span class="text-white font-medium">{info?.label || key}</span>
                                                    <Show when={key === 'security'}>
                                                        <span class="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-black rounded uppercase">
                                                            Locked
                                                        </span>
                                                    </Show>
                                                </div>
                                                <div class="flex items-center gap-4 text-sm">
                                                    <span class="text-green-400 font-mono">{stat.optedIn} in</span>
                                                    <span class="text-gray-500 font-mono">{stat.optedOut} out</span>
                                                    <span class="text-white font-bold w-12 text-right">{pct}%</span>
                                                </div>
                                            </div>
                                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    class={`h-full rounded-full bg-gradient-to-r ${barColors[info?.color || 'cyan'] || 'from-gray-500 to-gray-600'} transition-all duration-700`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>
                </Show>
            </Show>

            {/* ==================== TEMPLATES TAB ==================== */}
            <Show when={activeTab() === 'templates'}>
                <Show when={loading()}>
                    <div class="flex items-center justify-center py-12">
                        <div class="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    </div>
                </Show>

                <Show when={!loading()}>
                    <div class="grid grid-cols-1 gap-4">
                        <For each={templates()}>
                            {(template) => {
                                const isExpanded = () => selectedTemplate() === template.id;
                                const templateData = () => allTemplates()[template.id];

                                return (
                                    <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                                        {/* Template Header */}
                                        <div
                                            class="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.01] transition-colors"
                                            onClick={() => setSelectedTemplate(isExpanded() ? null : template.id)}
                                        >
                                            <div class="flex items-center gap-4">
                                                <div class="p-2 rounded-lg bg-white/5">
                                                    <Mail class="w-5 h-5 text-gray-400" />
                                                </div>
                                                <div>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-white font-semibold">{template.name}</span>
                                                        {getCategoryBadge(template.category)}
                                                    </div>
                                                    <p class="text-gray-500 text-sm mt-0.5">{template.description}</p>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSendTest(template.id);
                                                    }}
                                                    disabled={sendingTest() === template.id}
                                                    class="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-gray-300 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-40"
                                                    title="Send test email to your admin email"
                                                >
                                                    <Show
                                                        when={sendingTest() !== template.id}
                                                        fallback={<RefreshCw class="w-3 h-3 animate-spin" />}
                                                    >
                                                        <Send class="w-3 h-3" />
                                                    </Show>
                                                    Test Send
                                                </button>
                                                <ChevronDown class={`w-4 h-4 text-gray-500 transition-transform ${isExpanded() ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>

                                        {/* Template Preview */}
                                        <Show when={isExpanded() && templateData()?.html}>
                                            <div class="border-t border-white/5">
                                                <div class="p-4 bg-white/[0.01]">
                                                    <div class="flex items-center justify-between mb-3">
                                                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email Preview</span>
                                                        <button
                                                            onClick={() => {
                                                                const w = window.open('', '_blank');
                                                                if (w) {
                                                                    w.document.write(templateData()!.html!);
                                                                    w.document.close();
                                                                }
                                                            }}
                                                            class="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                                                        >
                                                            <Eye class="w-3 h-3" />
                                                            Open in New Tab
                                                        </button>
                                                    </div>
                                                    <div class="rounded-xl overflow-hidden border border-white/10 bg-white">
                                                        <iframe
                                                            srcdoc={templateData()!.html}
                                                            class="w-full border-0"
                                                            style={{ height: '600px' }}
                                                            sandbox="allow-same-origin"
                                                            title={`${template.name} preview`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </Show>
                                    </div>
                                );
                            }}
                        </For>
                    </div>

                    <Show when={templates().length === 0 && !error()}>
                        <div class="text-center py-12">
                            <Mail class="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p class="text-gray-500">No templates available</p>
                        </div>
                    </Show>
                </Show>
            </Show>

            {/* ==================== SUBSCRIPTIONS TAB ==================== */}
            <Show when={activeTab() === 'subscriptions'}>
                <Show when={stats()}>
                    <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                        <div class="flex items-center justify-between p-6 border-b border-white/5">
                            <div>
                                <h2 class="text-lg font-bold text-white">User Subscription Breakdown</h2>
                                <p class="text-gray-500 text-sm mt-0.5">
                                    {stats()!.totalUsers.toLocaleString()} total users
                                </p>
                            </div>
                            <button
                                onClick={loadStats}
                                disabled={statsLoading()}
                                class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-gray-300 hover:text-white transition-all flex items-center gap-2 disabled:opacity-40"
                            >
                                <RefreshCw class={`w-4 h-4 ${statsLoading() ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/5">
                            <For each={Object.entries(stats()!.categoryStats)}>
                                {([key, stat]) => {
                                    const info = CATEGORY_INFO[key];
                                    const pct = getOptInPercentage(stat);
                                    const total = stat.optedIn + stat.optedOut;

                                    return (
                                        <div class="p-6 hover:bg-white/[0.01] transition-colors">
                                            <div class="flex items-center justify-between mb-4">
                                                <div class="flex items-center gap-2">
                                                    {getCategoryBadge(key)}
                                                    <Show when={key === 'security'}>
                                                        <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                        </svg>
                                                    </Show>
                                                </div>
                                                <span class="text-2xl font-black text-white">{pct}%</span>
                                            </div>

                                            {/* Progress bar */}
                                            <div class="h-3 bg-white/5 rounded-full overflow-hidden mb-3">
                                                <div
                                                    class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>

                                            <div class="flex justify-between text-xs">
                                                <span class="text-green-400 font-mono">
                                                    <svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                    {stat.optedIn} opted in
                                                </span>
                                                <span class="text-gray-500 font-mono">
                                                    {stat.optedOut} opted out
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>

                    {/* Drip Queue Stats */}
                    <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                        <div class="p-6 border-b border-white/5">
                            <h2 class="text-lg font-bold text-white">Drip Campaign Queue</h2>
                            <p class="text-gray-500 text-sm mt-0.5">Onboarding email automation status</p>
                        </div>
                        <div class="grid grid-cols-3 divide-x divide-white/5">
                            <div class="p-6 text-center">
                                <p class="text-3xl font-black text-amber-400">{stats()!.dripQueue.pending}</p>
                                <p class="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Pending</p>
                            </div>
                            <div class="p-6 text-center">
                                <p class="text-3xl font-black text-green-400">{stats()!.dripQueue.sent}</p>
                                <p class="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Sent</p>
                            </div>
                            <div class="p-6 text-center">
                                <p class="text-3xl font-black text-gray-400">{stats()!.dripQueue.skipped}</p>
                                <p class="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Skipped</p>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
