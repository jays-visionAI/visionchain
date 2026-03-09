import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import {
    Activity,
    Clock,
    Search,
    Filter,
    Users,
    Zap,
    ArrowUpRight,
    TrendingUp,
    Award,
    RefreshCw
} from 'lucide-solid';
import { getFirebaseDb } from '../../services/firebaseService';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';

// RP action type display config
const RP_ACTION_META: Record<string, { label: string; color: string; bgColor: string }> = {
    daily_login: { label: 'Daily Login', color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/20' },
    disk_upload: { label: 'Disk Upload', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20' },
    disk_download: { label: 'Disk Download', color: 'text-blue-300', bgColor: 'bg-blue-400/10 border-blue-400/20' },
    transfer_send: { label: 'Transfer', color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20' },
    staking_deposit: { label: 'Staking', color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20' },
    profile_update: { label: 'Profile Update', color: 'text-gray-400', bgColor: 'bg-gray-500/10 border-gray-500/20' },
    ai_chat: { label: 'AI Chat', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10 border-cyan-500/20' },
    cex_connect: { label: 'CEX Connect', color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/20' },
    quant_strategy_setup: { label: 'Quant Strategy', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10 border-indigo-500/20' },
    market_publish: { label: 'Market Publish', color: 'text-pink-400', bgColor: 'bg-pink-500/10 border-pink-500/20' },
    market_purchase: { label: 'Market Purchase', color: 'text-rose-400', bgColor: 'bg-rose-500/10 border-rose-500/20' },
    agent_create: { label: 'Agent Create', color: 'text-teal-400', bgColor: 'bg-teal-500/10 border-teal-500/20' },
    referral: { label: 'Referral', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
    referral_tier1_rp: { label: 'Referral T1', color: 'text-emerald-300', bgColor: 'bg-emerald-400/10 border-emerald-400/20' },
    referral_tier2_rp: { label: 'Referral T2', color: 'text-emerald-200', bgColor: 'bg-emerald-300/10 border-emerald-300/20' },
    levelup: { label: 'Level Up', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/20' },
    mobile_node_daily: { label: 'Node Daily', color: 'text-violet-400', bgColor: 'bg-violet-500/10 border-violet-500/20' },
};

const getActionMeta = (type: string) => RP_ACTION_META[type] || { label: type, color: 'text-gray-400', bgColor: 'bg-gray-500/10 border-gray-500/20' };

interface RPRecord {
    id: string;
    userId: string;
    type: string;
    amount: number;
    source: string;
    timestamp: string;
}

export default function AdminActivity() {
    const [loading, setLoading] = createSignal(true);
    const [recentEvents, setRecentEvents] = createSignal<RPRecord[]>([]);
    const [todayEvents, setTodayEvents] = createSignal<RPRecord[]>([]);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [filterType, setFilterType] = createSignal<string>('all');
    const [lastRefresh, setLastRefresh] = createSignal(new Date());

    // Load data
    const loadData = async () => {
        setLoading(true);
        try {
            const db = getFirebaseDb();
            const rpRef = collection(db, 'rp_history');

            // 1. Recent 200 events (for feed)
            const recentQuery = query(rpRef, orderBy('timestamp', 'desc'), limit(200));
            const recentSnap = await getDocs(recentQuery);
            const events: RPRecord[] = recentSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as RPRecord));
            setRecentEvents(events);

            // 2. Today's events
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayISO = todayStart.toISOString();
            const todayFiltered = events.filter(e => e.timestamp >= todayISO);

            // If we still need more today events (in case the 200 limit wasn't enough)
            if (todayFiltered.length >= 199) {
                const todayQuery = query(rpRef, where('timestamp', '>=', todayISO), orderBy('timestamp', 'desc'));
                const todaySnap = await getDocs(todayQuery);
                setTodayEvents(todaySnap.docs.map(d => ({ id: d.id, ...d.data() } as RPRecord)));
            } else {
                setTodayEvents(todayFiltered);
            }

            setLastRefresh(new Date());
        } catch (e) {
            console.error('[AdminActivity] Failed to load:', e);
        } finally {
            setLoading(false);
        }
    };

    onMount(loadData);

    // KPI computations
    const todayTotalRP = createMemo(() => todayEvents().reduce((sum, e) => sum + (e.amount || 0), 0));
    const todayActiveUsers = createMemo(() => new Set(todayEvents().map(e => e.userId)).size);
    const todayAvgRP = createMemo(() => {
        const users = todayActiveUsers();
        return users > 0 ? Math.round(todayTotalRP() / users) : 0;
    });
    const topAction = createMemo(() => {
        const counts: Record<string, number> = {};
        todayEvents().forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0] : ['--', 0];
    });

    // Action heatmap data
    const actionBreakdown = createMemo(() => {
        const counts: Record<string, { count: number; totalRP: number }> = {};
        todayEvents().forEach(e => {
            if (!counts[e.type]) counts[e.type] = { count: 0, totalRP: 0 };
            counts[e.type].count++;
            counts[e.type].totalRP += e.amount || 0;
        });
        return Object.entries(counts)
            .map(([type, data]) => ({ type, ...data }))
            .sort((a, b) => b.count - a.count);
    });

    const maxActionCount = createMemo(() => {
        const items = actionBreakdown();
        return items.length > 0 ? items[0].count : 1;
    });

    // Filtered feed
    const filteredEvents = createMemo(() => {
        let events = recentEvents();
        if (filterType() !== 'all') {
            events = events.filter(e => e.type === filterType());
        }
        if (searchQuery().length >= 2) {
            const q = searchQuery().toLowerCase();
            events = events.filter(e =>
                e.userId.toLowerCase().includes(q) ||
                e.source.toLowerCase().includes(q) ||
                e.type.toLowerCase().includes(q)
            );
        }
        return events.slice(0, 100);
    });

    // All action types seen
    const actionTypes = createMemo(() => {
        const types = new Set(recentEvents().map(e => e.type));
        return Array.from(types).sort();
    });

    const formatTime = (ts: string) => {
        try {
            const d = new Date(ts);
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin < 1) return 'just now';
            if (diffMin < 60) return `${diffMin}m ago`;
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `${diffHr}h ago`;
            const diffDay = Math.floor(diffHr / 24);
            return `${diffDay}d ago`;
        } catch {
            return ts;
        }
    };

    const formatTimeFull = (ts: string) => {
        try {
            return new Date(ts).toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return ts;
        }
    };

    return (
        <div class="space-y-8">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-black text-white uppercase tracking-tight">Activity Feed</h1>
                    <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">
                        Real-time RP Reward Activity &middot; Last refreshed {lastRefresh().toLocaleTimeString()}
                    </p>
                </div>
                <button
                    onClick={loadData}
                    disabled={loading()}
                    class="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all uppercase tracking-widest"
                >
                    <RefreshCw class={`w-3.5 h-3.5 ${loading() ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Today RP Issued */}
                <div class="bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/10 rounded-2xl p-5">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                            <Zap class="w-4 h-4 text-cyan-400" />
                        </div>
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Today RP Issued</span>
                    </div>
                    <div class="text-2xl font-black text-white">{todayTotalRP().toLocaleString()}</div>
                    <div class="text-[10px] text-gray-500 mt-1">{todayEvents().length} events</div>
                </div>

                {/* Active Users */}
                <div class="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/10 rounded-2xl p-5">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                            <Users class="w-4 h-4 text-green-400" />
                        </div>
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Users</span>
                    </div>
                    <div class="text-2xl font-black text-white">{todayActiveUsers()}</div>
                    <div class="text-[10px] text-gray-500 mt-1">unique users today</div>
                </div>

                {/* Avg RP/User */}
                <div class="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/10 rounded-2xl p-5">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                            <TrendingUp class="w-4 h-4 text-purple-400" />
                        </div>
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Avg RP / User</span>
                    </div>
                    <div class="text-2xl font-black text-white">{todayAvgRP()}</div>
                    <div class="text-[10px] text-gray-500 mt-1">per active user</div>
                </div>

                {/* Top Action */}
                <div class="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/10 rounded-2xl p-5">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Award class="w-4 h-4 text-amber-400" />
                        </div>
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Top Action</span>
                    </div>
                    <div class="text-lg font-black text-white">{getActionMeta(topAction()[0] as string).label}</div>
                    <div class="text-[10px] text-gray-500 mt-1">{topAction()[1]} events today</div>
                </div>
            </div>

            {/* Action Heatmap */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <div class="p-5 border-b border-white/5">
                    <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest">Today's Action Breakdown</h3>
                </div>
                <div class="p-5">
                    <Show when={actionBreakdown().length > 0} fallback={
                        <div class="text-center py-8 text-gray-600 text-sm">No activity recorded today</div>
                    }>
                        <div class="space-y-3">
                            <For each={actionBreakdown()}>
                                {(item) => {
                                    const meta = getActionMeta(item.type);
                                    const pct = Math.max(2, (item.count / maxActionCount()) * 100);
                                    return (
                                        <div class="flex items-center gap-3">
                                            <div class="w-28 shrink-0">
                                                <span class={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                                            </div>
                                            <div class="flex-1 h-6 bg-white/[0.03] rounded-lg overflow-hidden relative">
                                                <div
                                                    class="h-full rounded-lg transition-all duration-500 opacity-30"
                                                    style={`width: ${pct}%; background: currentColor;`}
                                                    classList={{ [meta.color]: true }}
                                                />
                                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-white">
                                                    {item.count}
                                                </span>
                                            </div>
                                            <div class="w-16 text-right">
                                                <span class="text-xs font-mono text-gray-500">+{item.totalRP}</span>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </Show>
                </div>
            </div>

            {/* Real-time Feed */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <div class="p-5 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest">Recent Activity</h3>
                        <div class="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                            <div class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span class="text-[9px] font-black text-green-400 uppercase tracking-widest">Live</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 w-full sm:w-auto">
                        {/* Search */}
                        <div class="relative flex-1 sm:flex-initial">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search user, action..."
                                value={searchQuery()}
                                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                class="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 w-full sm:w-56"
                            />
                        </div>
                        {/* Type Filter */}
                        <select
                            value={filterType()}
                            onChange={(e) => setFilterType(e.currentTarget.value)}
                            class="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                        >
                            <option value="all">All Actions</option>
                            <For each={actionTypes()}>
                                {(type) => <option value={type}>{getActionMeta(type).label}</option>}
                            </For>
                        </select>
                    </div>
                </div>

                <div class="divide-y divide-white/[0.03] max-h-[600px] overflow-y-auto custom-scrollbar">
                    <Show when={!loading()} fallback={
                        <div class="flex items-center justify-center py-16">
                            <RefreshCw class="w-5 h-5 text-gray-600 animate-spin" />
                        </div>
                    }>
                        <Show when={filteredEvents().length > 0} fallback={
                            <div class="flex flex-col items-center justify-center py-16 text-center">
                                <Activity class="w-8 h-8 text-gray-700 mb-3" />
                                <div class="text-sm font-bold text-gray-500">No activity found</div>
                                <div class="text-xs text-gray-600 mt-1">
                                    {searchQuery() || filterType() !== 'all' ? 'Try adjusting your filters' : 'RP events will appear here as users interact'}
                                </div>
                            </div>
                        }>
                            <For each={filteredEvents()}>
                                {(event) => {
                                    const meta = getActionMeta(event.type);
                                    return (
                                        <div class="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                                            {/* Action Badge */}
                                            <div class={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${meta.bgColor}`}>
                                                <ArrowUpRight class={`w-3.5 h-3.5 ${meta.color}`} />
                                            </div>

                                            {/* Details */}
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-2 mb-0.5">
                                                    <span class="text-xs font-bold text-white truncate">
                                                        {event.userId.split('@')[0]}
                                                    </span>
                                                    <span class={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${meta.bgColor} ${meta.color}`}>
                                                        {meta.label}
                                                    </span>
                                                </div>
                                                <p class="text-[11px] text-gray-500 truncate">{event.source}</p>
                                            </div>

                                            {/* RP Amount */}
                                            <div class="text-right shrink-0">
                                                <div class="text-sm font-black text-cyan-400">+{event.amount}</div>
                                                <div class="text-[10px] text-gray-600" title={formatTimeFull(event.timestamp)}>
                                                    {formatTime(event.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </Show>
                    </Show>
                </div>

                {/* Footer */}
                <Show when={filteredEvents().length > 0}>
                    <div class="px-5 py-3 border-t border-white/5 flex items-center justify-between">
                        <span class="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                            Showing {filteredEvents().length} of {recentEvents().length} events
                        </span>
                        <span class="text-[10px] text-gray-600">
                            Total RP in view: {filteredEvents().reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}
                        </span>
                    </div>
                </Show>
            </div>
        </div>
    );
}
