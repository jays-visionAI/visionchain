import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { getDailyActivityRecords, getPageActivityRecords, DailyActivityRecord, PageActivityRecord, getAllUsers } from '../../services/firebaseService';

// Menu labels
const MENU_LABELS: Record<string, string> = {
    assets: 'Assets (Home)',
    chat: 'AI Chat',
    send: 'Send',
    staking: 'Staking',
    quest: 'Quest',
    referral: 'Referral',
    contacts: 'Contacts',
    cex: 'CEX Portfolio',
    nodes: 'Nodes',
    disk: 'Disk Storage',
    market: 'Vision Market',
    insight: 'Vision Insight',
    profile: 'Profile',
    settings: 'Settings',
    agent: 'AI Agent',
    bridge: 'Bridge',
    history: 'History',
    notifications: 'Notifications',
};

export default function AdminUserAnalytics() {
    const [dailyRecords, setDailyRecords] = createSignal<DailyActivityRecord[]>([]);
    const [pageRecords, setPageRecords] = createSignal<PageActivityRecord[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [selectedDay, setSelectedDay] = createSignal<DailyActivityRecord | null>(null);
    const [viewMode, setViewMode] = createSignal<'daily' | 'weekly'>('daily');
    const [totalUsers, setTotalUsers] = createSignal(0);

    const loadData = async () => {
        setLoading(true);
        try {
            const [daily, pages, users] = await Promise.all([
                getDailyActivityRecords(30),
                getPageActivityRecords(7),
                getAllUsers(1000),
            ]);
            setDailyRecords(daily);
            setPageRecords(pages);
            setTotalUsers(users.length);
        } catch (e) {
            console.error('[UserAnalytics] Load failed:', e);
        } finally {
            setLoading(false);
        }
    };

    onMount(loadData);

    // Today's DAU
    const todayDAU = () => dailyRecords()[0]?.count || 0;
    const todayUsers = () => dailyRecords()[0]?.users || [];

    // Weekly active users (unique across 7 days)
    const weeklyActive = createMemo(() => {
        const last7 = dailyRecords().slice(0, 7);
        const uniqueEmails = new Set<string>();
        last7.forEach(r => r.users.forEach(u => uniqueEmails.add(u)));
        return {
            count: uniqueEmails.size,
            users: Array.from(uniqueEmails).sort(),
        };
    });

    // Monthly active users (unique across 30 days)
    const monthlyActive = createMemo(() => {
        const uniqueEmails = new Set<string>();
        dailyRecords().forEach(r => r.users.forEach(u => uniqueEmails.add(u)));
        return uniqueEmails.size;
    });

    // DAU trend (last 7 days for chart)
    const dauChart = () => dailyRecords().slice(0, 7).reverse();

    // Aggregate page visits over 7 days
    const aggregatedPages = createMemo(() => {
        const pageMap = new Map<string, { visits: number; uniqueVisitors: number }>();
        const last7 = pageRecords().slice(0, 7);

        for (const record of last7) {
            for (const [page, count] of Object.entries(record.pages)) {
                const existing = pageMap.get(page) || { visits: 0, uniqueVisitors: 0 };
                existing.visits += count;
                pageMap.set(page, existing);
            }
            for (const [page, visitors] of Object.entries(record.visitors)) {
                const existing = pageMap.get(page) || { visits: 0, uniqueVisitors: 0 };
                const uniqueSet = new Set(visitors);
                existing.uniqueVisitors = Math.max(existing.uniqueVisitors, uniqueSet.size);
                pageMap.set(page, existing);
            }
        }

        return Array.from(pageMap.entries())
            .map(([page, stats]) => ({ page, label: MENU_LABELS[page] || page, ...stats }))
            .sort((a, b) => b.visits - a.visits);
    });

    // Retention / engagement analysis
    const engagementAnalysis = createMemo(() => {
        const total = totalUsers();
        const dau = todayDAU();
        const wau = weeklyActive().count;
        const mau = monthlyActive();

        const dauRate = total > 0 ? ((dau / total) * 100).toFixed(1) : '0';
        const wauRate = total > 0 ? ((wau / total) * 100).toFixed(1) : '0';
        const mauRate = total > 0 ? ((mau / total) * 100).toFixed(1) : '0';

        // Stickiness = DAU / MAU
        const stickiness = mau > 0 ? ((dau / mau) * 100).toFixed(1) : '0';

        // Pages with zero visits = potential problem areas
        const allPages = Object.keys(MENU_LABELS);
        const visitedPages = new Set(aggregatedPages().map(p => p.page));
        const unusedPages = allPages.filter(p => !visitedPages.has(p));

        // Top pages vs bottom pages
        const topPages = aggregatedPages().slice(0, 3);
        const bottomPages = aggregatedPages().filter(p => p.visits > 0).slice(-3);

        return {
            dauRate, wauRate, mauRate, stickiness,
            unusedPages, topPages, bottomPages,
        };
    });

    return (
        <div class="p-6 space-y-6 max-w-7xl">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-white">User Analytics</h1>
                    <p class="text-sm text-gray-400 mt-1">User activity analysis and engagement insights</p>
                </div>
                <button
                    onClick={loadData}
                    disabled={loading()}
                    class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
                >
                    <Show when={loading()}>
                        <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </Show>
                    {loading() ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {/* Loading */}
            <Show when={loading()}>
                <div class="p-12 text-center">
                    <div class="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto" />
                    <p class="text-gray-500 text-sm mt-3">Loading analytics...</p>
                </div>
            </Show>

            <Show when={!loading()}>
                {/* KPI Cards */}
                <div class="grid grid-cols-5 gap-4">
                    <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                        <div class="text-3xl font-black text-white">{todayDAU()}</div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">DAU (Today)</div>
                        <div class="text-[10px] text-purple-400 mt-1">{engagementAnalysis().dauRate}% of total</div>
                    </div>
                    <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                        <div class="text-3xl font-black text-blue-400">{weeklyActive().count}</div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">WAU (7 Days)</div>
                        <div class="text-[10px] text-blue-400 mt-1">{engagementAnalysis().wauRate}% of total</div>
                    </div>
                    <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                        <div class="text-3xl font-black text-green-400">{monthlyActive()}</div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">MAU (30 Days)</div>
                        <div class="text-[10px] text-green-400 mt-1">{engagementAnalysis().mauRate}% of total</div>
                    </div>
                    <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                        <div class="text-3xl font-black text-amber-400">{totalUsers()}</div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Total Users</div>
                    </div>
                    <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                        <div class="text-3xl font-black text-cyan-400">{engagementAnalysis().stickiness}%</div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Stickiness</div>
                        <div class="text-[10px] text-gray-600 mt-1">DAU / MAU ratio</div>
                    </div>
                </div>

                {/* DAU Chart + Engagement Analysis */}
                <div class="grid grid-cols-3 gap-6">
                    {/* DAU Bar Chart */}
                    <div class="col-span-2 bg-[#111113] border border-white/5 rounded-xl p-5">
                        <h2 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Daily Active Users (Last 7 Days)</h2>
                        <div class="flex items-end gap-3 h-48">
                            <For each={dauChart()}>
                                {(item) => {
                                    const maxVal = Math.max(...dauChart().map(d => d.value), 1);
                                    const isSelected = selectedDay()?.date === item.date;
                                    return (
                                        <div
                                            class="flex-1 flex flex-col items-center gap-2 cursor-pointer group"
                                            onClick={() => setSelectedDay(isSelected ? null : item)}
                                        >
                                            <span class="text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {item.count}
                                            </span>
                                            <div
                                                class={`w-full rounded-t-lg transition-all duration-300 ${isSelected ? 'bg-purple-400' : 'bg-indigo-500 hover:bg-indigo-400'}`}
                                                style={{ height: `${Math.max((item.count / maxVal) * 100, 4)}%` }}
                                            />
                                            <span class="text-[10px] font-bold text-slate-500">{item.date.slice(5)}</span>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>

                    {/* Engagement Issues */}
                    <div class="bg-[#111113] border border-white/5 rounded-xl p-5">
                        <h2 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Usage Analysis</h2>
                        <div class="space-y-4">
                            {/* Stickiness */}
                            <div>
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-gray-500">Stickiness (DAU/MAU)</span>
                                    <span class="text-white font-bold">{engagementAnalysis().stickiness}%</span>
                                </div>
                                <div class="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                    <div
                                        class={`h-full rounded-full transition-all ${parseFloat(engagementAnalysis().stickiness) > 20 ? 'bg-green-500' : parseFloat(engagementAnalysis().stickiness) > 10 ? 'bg-amber-500' : 'bg-red-500'}`}
                                        style={{ width: `${Math.min(parseFloat(engagementAnalysis().stickiness), 100)}%` }}
                                    />
                                </div>
                                <p class="text-[10px] text-gray-600 mt-1">
                                    {parseFloat(engagementAnalysis().stickiness) > 20 ? 'Healthy engagement' : parseFloat(engagementAnalysis().stickiness) > 10 ? 'Moderate - need improvement' : 'Low - action needed'}
                                </p>
                            </div>

                            {/* Unused Features */}
                            <Show when={engagementAnalysis().unusedPages.length > 0}>
                                <div>
                                    <div class="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">
                                        <svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                        Unused Features (7 days)
                                    </div>
                                    <div class="flex flex-wrap gap-1">
                                        <For each={engagementAnalysis().unusedPages}>
                                            {(page) => (
                                                <span class="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold">
                                                    {MENU_LABELS[page] || page}
                                                </span>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            {/* Top Features */}
                            <Show when={engagementAnalysis().topPages.length > 0}>
                                <div>
                                    <div class="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-2">Top Features</div>
                                    <For each={engagementAnalysis().topPages}>
                                        {(p) => (
                                            <div class="flex justify-between text-xs py-1">
                                                <span class="text-gray-400">{p.label}</span>
                                                <span class="text-white font-mono">{p.visits}</span>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* Tab: Daily / Weekly Login Users */}
                <div class="bg-[#111113] border border-white/5 rounded-xl overflow-hidden">
                    <div class="px-5 py-3 border-b border-white/5 flex items-center gap-4">
                        <button
                            onClick={() => { setViewMode('daily'); setSelectedDay(dailyRecords()[0] || null); }}
                            class={`text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ${viewMode() === 'daily' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-white'}`}
                        >
                            Daily Login ({todayDAU()})
                        </button>
                        <button
                            onClick={() => setViewMode('weekly')}
                            class={`text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ${viewMode() === 'weekly' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-white'}`}
                        >
                            Weekly Login ({weeklyActive().count})
                        </button>

                        <Show when={viewMode() === 'daily'}>
                            <div class="flex gap-2 ml-auto">
                                <For each={dailyRecords().slice(0, 7)}>
                                    {(record) => (
                                        <button
                                            onClick={() => setSelectedDay(record)}
                                            class={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${selectedDay()?.date === record.date ? 'bg-purple-500/20 text-purple-400' : 'text-gray-600 hover:text-gray-400'}`}
                                        >
                                            {record.date.slice(5)}
                                            <span class="ml-1 text-gray-600">({record.count})</span>
                                        </button>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>

                    {/* User List */}
                    <div class="max-h-[400px] overflow-y-auto">
                        <Show when={viewMode() === 'daily'}>
                            <Show when={selectedDay()}>
                                <div class="px-5 py-3 bg-purple-500/5 border-b border-white/5">
                                    <span class="text-xs font-bold text-purple-400">{selectedDay()!.date}</span>
                                    <span class="text-xs text-gray-500 ml-2">{selectedDay()!.count} users logged in</span>
                                </div>
                                <Show when={selectedDay()!.users.length === 0}>
                                    <div class="p-8 text-center text-gray-600 text-sm">No login activity recorded for this date.</div>
                                </Show>
                                <table class="w-full">
                                    <thead>
                                        <tr class="border-b border-white/5 text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                            <th class="px-5 py-3 text-left w-12">#</th>
                                            <th class="px-5 py-3 text-left">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={selectedDay()!.users}>
                                            {(email, idx) => (
                                                <tr class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                    <td class="px-5 py-2.5 text-[12px] text-gray-600">{idx() + 1}</td>
                                                    <td class="px-5 py-2.5 text-[13px] text-gray-300 font-mono">{email}</td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </Show>
                            <Show when={!selectedDay()}>
                                <div class="p-8 text-center text-gray-600 text-sm">Select a date above to view logged-in users.</div>
                            </Show>
                        </Show>

                        <Show when={viewMode() === 'weekly'}>
                            <div class="px-5 py-3 bg-blue-500/5 border-b border-white/5">
                                <span class="text-xs font-bold text-blue-400">Last 7 Days</span>
                                <span class="text-xs text-gray-500 ml-2">{weeklyActive().count} unique users</span>
                            </div>
                            <table class="w-full">
                                <thead>
                                    <tr class="border-b border-white/5 text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                        <th class="px-5 py-3 text-left w-12">#</th>
                                        <th class="px-5 py-3 text-left">Email</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={weeklyActive().users}>
                                        {(email, idx) => (
                                            <tr class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                <td class="px-5 py-2.5 text-[12px] text-gray-600">{idx() + 1}</td>
                                                <td class="px-5 py-2.5 text-[13px] text-gray-300 font-mono">{email}</td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </Show>
                    </div>
                </div>

                {/* Menu Visit Analytics */}
                <div class="bg-[#111113] border border-white/5 rounded-xl overflow-hidden">
                    <div class="px-5 py-3 border-b border-white/5 flex items-center gap-3">
                        <svg class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4z" />
                        </svg>
                        <h2 class="text-sm font-black text-white uppercase tracking-wide">Menu Visit Analytics (Last 7 Days)</h2>
                    </div>
                    <Show when={aggregatedPages().length === 0}>
                        <div class="p-8 text-center text-gray-600 text-sm">No page visit data yet. Activity tracking will begin collecting data now.</div>
                    </Show>
                    <Show when={aggregatedPages().length > 0}>
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/5 text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                    <th class="px-5 py-3 text-left w-12">#</th>
                                    <th class="px-5 py-3 text-left">Menu</th>
                                    <th class="px-5 py-3 text-center w-32">Total Visits</th>
                                    <th class="px-5 py-3 text-center w-32">Unique Visitors</th>
                                    <th class="px-5 py-3 text-left">Distribution</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={aggregatedPages()}>
                                    {(item, idx) => {
                                        const maxVisits = Math.max(...aggregatedPages().map(p => p.visits), 1);
                                        return (
                                            <tr class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                <td class="px-5 py-3 text-[12px] text-gray-600">{idx() + 1}</td>
                                                <td class="px-5 py-3">
                                                    <span class="text-[13px] font-bold text-gray-100">{item.label}</span>
                                                    <span class="text-[10px] text-gray-600 ml-2 font-mono">/{item.page}</span>
                                                </td>
                                                <td class="px-5 py-3 text-center">
                                                    <span class="text-[13px] font-black text-white">{item.visits.toLocaleString()}</span>
                                                </td>
                                                <td class="px-5 py-3 text-center">
                                                    <span class="text-[13px] font-bold text-purple-400">{item.uniqueVisitors}</span>
                                                </td>
                                                <td class="px-5 py-3">
                                                    <div class="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            class="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all"
                                                            style={{ width: `${(item.visits / maxVisits) * 100}%` }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }}
                                </For>
                            </tbody>
                        </table>
                    </Show>
                </div>

                {/* Diagnostics: Why users don't use VisionChain effectively */}
                <div class="bg-[#111113] border border-white/5 rounded-xl p-5">
                    <div class="flex items-start gap-3 mb-4">
                        <svg class="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <div class="flex-1">
                            <h2 class="text-sm font-black text-white uppercase tracking-wide mb-3">Engagement Diagnostic</h2>

                            <div class="grid grid-cols-2 gap-4">
                                {/* Return Rate Issue */}
                                <div class="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Return Rate</div>
                                    <div class="text-lg font-black text-white mb-1">{engagementAnalysis().dauRate}%</div>
                                    <p class="text-[11px] text-gray-500">
                                        {parseFloat(engagementAnalysis().dauRate) < 5
                                            ? 'Very low - Most users register but do not return. Consider push notifications, daily rewards, or onboarding improvements.'
                                            : parseFloat(engagementAnalysis().dauRate) < 15
                                                ? 'Below average - Users explore but do not form habits. Enhance AI chat suggestions and Quest visibility.'
                                                : 'Healthy return rate. Focus on deepening engagement per session.'}
                                    </p>
                                </div>

                                {/* Feature Discoverability */}
                                <div class="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Feature Discovery</div>
                                    <div class="text-lg font-black text-white mb-1">
                                        {Object.keys(MENU_LABELS).length - engagementAnalysis().unusedPages.length} / {Object.keys(MENU_LABELS).length}
                                    </div>
                                    <p class="text-[11px] text-gray-500">
                                        {engagementAnalysis().unusedPages.length > 5
                                            ? 'Many features go unused. Users may not know they exist. Consider guided tours, tooltips, or AI-driven recommendations.'
                                            : engagementAnalysis().unusedPages.length > 2
                                                ? 'Some features are underutilized. Highlight them in Daily Tips or Quest completions.'
                                                : 'Good coverage. Most features are being explored.'}
                                    </p>
                                </div>

                                {/* Session Depth */}
                                <div class="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Session Depth</div>
                                    <Show when={pageRecords().length > 0 && todayDAU() > 0}>
                                        <div class="text-lg font-black text-white mb-1">
                                            {Math.round((pageRecords()[0]?.totalVisits || 0) / Math.max(todayDAU(), 1))} pages/user
                                        </div>
                                    </Show>
                                    <Show when={todayDAU() === 0}>
                                        <div class="text-lg font-black text-gray-600 mb-1">N/A</div>
                                    </Show>
                                    <p class="text-[11px] text-gray-500">
                                        Average pages visited per user per day. Higher values indicate deeper engagement. Target: 3+ pages per session.
                                    </p>
                                </div>

                                {/* Weekly Retention */}
                                <div class="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Stickiness Index</div>
                                    <div class="text-lg font-black text-white mb-1">{engagementAnalysis().stickiness}%</div>
                                    <p class="text-[11px] text-gray-500">
                                        {parseFloat(engagementAnalysis().stickiness) < 10
                                            ? 'Low stickiness indicates users visit occasionally but do not develop daily habits. Implement daily login rewards, streak bonuses, or personalized AI insights.'
                                            : parseFloat(engagementAnalysis().stickiness) < 25
                                                ? 'Moderate stickiness. Users return weekly but not daily. Consider daily rewards or push notifications.'
                                                : 'Strong stickiness. Users are forming good habits.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}
