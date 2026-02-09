import { createSignal, For, Show, onMount } from 'solid-js';
import { Mail, Eye, Send, RefreshCw, AlertCircle, Check, X, ChevronDown } from 'lucide-solid';
import { getFirebaseDb, getAdminFirebaseAuth } from '../../services/firebaseService';
import { collection, getDocs } from 'firebase/firestore';

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'visionchain-d19ed';

function getAdminCloudFunctionUrl(fnName: string) {
    return `https://us-central1-${PROJECT_ID}.cloudfunctions.net/${fnName}`;
}

async function getAdminToken(): Promise<string> {
    const auth = getAdminFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated as admin');
    return user.getIdToken();
}

interface CategoryStat {
    optedIn: number;
    optedOut: number;
}

interface EmailStats {
    totalUsers: number;
    categoryStats: Record<string, CategoryStat>;
}

// Template definitions with dummy data (rendered client-side)
interface TemplateInfo {
    id: string;
    name: string;
    category: string;
    description: string;
}

const TEMPLATE_LIST: TemplateInfo[] = [
    { id: 'verification', name: 'Device Verification', category: 'security', description: 'Sent when user logs in from a new device' },
    { id: 'suspicious', name: 'Suspicious Activity Alert', category: 'security', description: 'Sent when unusual login behavior is detected' },
    { id: 'passwordReset', name: 'Password Reset Code', category: 'security', description: 'Sent when user requests a password reset' },
    { id: 'passwordChanged', name: 'Password Changed Confirmation', category: 'security', description: 'Sent after password is successfully changed' },
    { id: 'weeklyReport', name: 'Weekly Activity Report', category: 'weeklyReport', description: 'Weekly summary of user activity and portfolio' },
];

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

const CATEGORIES = ['security', 'staking', 'referral', 'bridge', 'weeklyReport', 'lifecycle', 'announcements'];

export default function AdminEmail() {
    const [activeTab, setActiveTab] = createSignal<'dashboard' | 'templates' | 'subscriptions'>('dashboard');
    const [selectedTemplate, setSelectedTemplate] = createSignal<string | null>(null);
    const [stats, setStats] = createSignal<EmailStats | null>(null);
    const [statsLoading, setStatsLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [sendingTest, setSendingTest] = createSignal<string | null>(null);
    const [sendSuccess, setSendSuccess] = createSignal('');
    const [previewHtml, setPreviewHtml] = createSignal<Record<string, string>>({});
    const [previewLoading, setPreviewLoading] = createSignal<string | null>(null);

    onMount(async () => {
        await loadStats();
    });

    // Load stats directly from Firestore (same pattern as other admin components)
    const loadStats = async () => {
        setStatsLoading(true);
        setError('');
        try {
            const db = getFirebaseDb();
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const totalUsers = usersSnapshot.size;

            const categoryStats: Record<string, CategoryStat> = {};
            for (const cat of CATEGORIES) {
                categoryStats[cat] = { optedIn: 0, optedOut: 0 };
            }

            usersSnapshot.forEach((doc) => {
                const prefs = doc.data().emailPreferences || {};
                for (const cat of CATEGORIES) {
                    const isOptedIn = prefs[cat] !== false;
                    if (isOptedIn) {
                        categoryStats[cat].optedIn++;
                    } else {
                        categoryStats[cat].optedOut++;
                    }
                }
            });

            setStats({ totalUsers, categoryStats });
        } catch (err: any) {
            console.error('[AdminEmail] Stats load error:', err);
            setError(err.message || 'Failed to load statistics');
        } finally {
            setStatsLoading(false);
        }
    };

    // Load preview via Cloud Function (only when user clicks)
    const loadPreview = async (templateId: string) => {
        if (previewHtml()[templateId]) return; // Already loaded

        setPreviewLoading(templateId);
        try {
            const token = await getAdminToken();
            const response = await fetch(
                `${getAdminCloudFunctionUrl('adminEmailPreview')}?template=${templateId}`,
                { headers: { 'Authorization': `Bearer ${token}` } },
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setPreviewHtml((prev) => ({ ...prev, [templateId]: data.template.html }));
        } catch (err: any) {
            console.error('[AdminEmail] Preview error:', err);
            setError(err.message || 'Failed to load preview');
            setTimeout(() => setError(''), 5000);
        } finally {
            setPreviewLoading(null);
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

    // Tab config
    const tabs = [
        { id: 'dashboard' as const, label: 'Dashboard', iconSvg: () => <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
        { id: 'templates' as const, label: 'Templates', iconSvg: () => <Eye class="w-4 h-4" /> },
        { id: 'subscriptions' as const, label: 'Subscriptions', iconSvg: () => <Mail class="w-4 h-4" /> },
    ];

    return (
        <div class="space-y-6">
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
                <For each={tabs}>
                    {(tab) => (
                        <button
                            onClick={() => setActiveTab(tab.id)}
                            class={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab() === tab.id
                                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab.iconSvg()}
                            {tab.label}
                        </button>
                    )}
                </For>
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
                        <div class="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    </div>
                </Show>

                <Show when={stats() && !statsLoading()}>
                    {/* Top Stats Cards */}
                    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Total Users</p>
                            <p class="text-3xl font-black text-white">{stats()!.totalUsers.toLocaleString()}</p>
                        </div>
                        <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Email Templates</p>
                            <p class="text-3xl font-black text-cyan-400">{TEMPLATE_LIST.length}</p>
                        </div>
                        <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Categories</p>
                            <p class="text-3xl font-black text-purple-400">{CATEGORIES.length}</p>
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
                <div class="grid grid-cols-1 gap-4">
                    <For each={TEMPLATE_LIST}>
                        {(template) => {
                            const isExpanded = () => selectedTemplate() === template.id;

                            return (
                                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                                    {/* Template Header */}
                                    <div
                                        class="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.01] transition-colors"
                                        onClick={() => {
                                            if (isExpanded()) {
                                                setSelectedTemplate(null);
                                            } else {
                                                setSelectedTemplate(template.id);
                                                loadPreview(template.id);
                                            }
                                        }}
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
                                    <Show when={isExpanded()}>
                                        <div class="border-t border-white/5">
                                            <div class="p-4 bg-white/[0.01]">
                                                <Show when={previewLoading() === template.id}>
                                                    <div class="flex items-center justify-center py-12">
                                                        <div class="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                                                    </div>
                                                </Show>
                                                <Show when={previewHtml()[template.id]}>
                                                    <div class="flex items-center justify-between mb-3">
                                                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email Preview</span>
                                                        <button
                                                            onClick={() => {
                                                                const w = window.open('', '_blank');
                                                                if (w) {
                                                                    w.document.write(previewHtml()[template.id]);
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
                                                            srcdoc={previewHtml()[template.id]}
                                                            class="w-full border-0"
                                                            style={{ height: '600px' }}
                                                            sandbox="allow-same-origin"
                                                            title={`${template.name} preview`}
                                                        />
                                                    </div>
                                                </Show>
                                                <Show when={!previewLoading() && !previewHtml()[template.id]}>
                                                    <div class="text-center py-8 text-gray-500 text-sm">
                                                        Preview could not be loaded. The admin Cloud Functions may need deployment.
                                                    </div>
                                                </Show>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>
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
                                    const pct = getOptInPercentage(stat);

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
                </Show>

                <Show when={!stats() && !statsLoading()}>
                    <div class="text-center py-12">
                        <Mail class="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p class="text-gray-500">No statistics available</p>
                        <button onClick={loadStats} class="mt-3 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-bold hover:bg-cyan-500/30 transition-colors">
                            Load Stats
                        </button>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
