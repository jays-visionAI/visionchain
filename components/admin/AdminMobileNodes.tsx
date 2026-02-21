import { createSignal, onMount, For, Show } from 'solid-js';
import { collection, getDocs, query, orderBy, limit, where, Timestamp, getFirestore } from 'firebase/firestore';
import { getFirebaseApp } from '../../services/firebaseService';

const db = getFirestore(getFirebaseApp());

interface MobileNodeStats {
    totalNodes: number;
    activeNodes: number;
    onlineNow: number;
    totalUptimeHours: number;
    totalRewardsEarned: string;
    totalRewardsPending: string;
    totalRewardsClaimed: string;
    totalHeartbeats: number;
    deviceBreakdown: { android: number; pwa: number; other: number };
}

interface MobileNodeRow {
    id: string;
    email: string;
    device_type: string;
    status: string;
    current_mode: string;
    total_uptime_seconds: number;
    today_uptime_seconds: number;
    heartbeat_count: number;
    streak_days: number;
    pending_reward: string;
    claimed_reward: string;
    total_earned: string;
    last_heartbeat: any;
    created_at: any;
}

export default function AdminMobileNodes() {
    const [stats, setStats] = createSignal<MobileNodeStats>({
        totalNodes: 0, activeNodes: 0, onlineNow: 0,
        totalUptimeHours: 0, totalRewardsEarned: '0', totalRewardsPending: '0', totalRewardsClaimed: '0',
        totalHeartbeats: 0, deviceBreakdown: { android: 0, pwa: 0, other: 0 },
    });
    const [nodes, setNodes] = createSignal<MobileNodeRow[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [sortField, setSortField] = createSignal<'total_earned' | 'total_uptime_seconds' | 'heartbeat_count' | 'streak_days' | 'last_heartbeat'>('total_earned');
    const [sortDir, setSortDir] = createSignal<'asc' | 'desc'>('desc');

    const fiveMinAgo = () => new Date(Date.now() - 5 * 60 * 1000);

    const formatUptime = (seconds: number) => {
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
        return `${(seconds / 86400).toFixed(1)}d`;
    };

    const formatVCN = (val: string | number) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num) || num === 0) return '0';
        if (num < 0.01) return '<0.01';
        return num.toFixed(2);
    };

    const fetchNodes = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'mobile_nodes'));
            const allNodes: MobileNodeRow[] = [];
            let totalUptime = 0;
            let totalEarned = 0;
            let totalPending = 0;
            let totalClaimed = 0;
            let totalHeartbeats = 0;
            let activeCount = 0;
            let onlineCount = 0;
            const devices = { android: 0, pwa: 0, other: 0 };

            snap.forEach((doc) => {
                const d = doc.data();
                const node: MobileNodeRow = {
                    id: doc.id,
                    email: d.email || '',
                    device_type: d.device_type || 'unknown',
                    status: d.status || 'unknown',
                    current_mode: d.current_mode || 'offline',
                    total_uptime_seconds: d.total_uptime_seconds || 0,
                    today_uptime_seconds: d.today_uptime_seconds || 0,
                    heartbeat_count: d.heartbeat_count || 0,
                    streak_days: d.streak_days || 0,
                    pending_reward: d.pending_reward || '0',
                    claimed_reward: d.claimed_reward || '0',
                    total_earned: d.total_earned || '0',
                    last_heartbeat: d.last_heartbeat,
                    created_at: d.created_at,
                };
                allNodes.push(node);

                totalUptime += node.total_uptime_seconds;
                totalEarned += parseFloat(node.total_earned) || 0;
                totalPending += parseFloat(node.pending_reward) || 0;
                totalClaimed += parseFloat(node.claimed_reward) || 0;
                totalHeartbeats += node.heartbeat_count;

                if (node.status === 'active') activeCount++;

                // Check if online (heartbeat within last 5 min)
                if (node.last_heartbeat) {
                    const hbTime = node.last_heartbeat.toDate ? node.last_heartbeat.toDate() : new Date(node.last_heartbeat);
                    if (hbTime > fiveMinAgo()) onlineCount++;
                }

                if (node.device_type === 'android') devices.android++;
                else if (node.device_type === 'pwa') devices.pwa++;
                else devices.other++;
            });

            setStats({
                totalNodes: allNodes.length,
                activeNodes: activeCount,
                onlineNow: onlineCount,
                totalUptimeHours: Math.round(totalUptime / 3600),
                totalRewardsEarned: totalEarned.toFixed(2),
                totalRewardsPending: totalPending.toFixed(2),
                totalRewardsClaimed: totalClaimed.toFixed(2),
                totalHeartbeats,
                deviceBreakdown: devices,
            });

            // Sort
            allNodes.sort((a, b) => {
                const field = sortField();
                let aVal: number, bVal: number;
                if (field === 'total_earned') {
                    aVal = parseFloat(a.total_earned) || 0;
                    bVal = parseFloat(b.total_earned) || 0;
                } else if (field === 'last_heartbeat') {
                    aVal = a.last_heartbeat?.toDate?.()?.getTime() || a.last_heartbeat?.getTime?.() || 0;
                    bVal = b.last_heartbeat?.toDate?.()?.getTime() || b.last_heartbeat?.getTime?.() || 0;
                } else {
                    aVal = (a as any)[field] || 0;
                    bVal = (b as any)[field] || 0;
                }
                return sortDir() === 'desc' ? bVal - aVal : aVal - bVal;
            });

            setNodes(allNodes);
        } catch (e) {
            console.error('[AdminMobileNodes] Failed to fetch:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: typeof sortField extends () => infer T ? T : never) => {
        if (sortField() === field) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(() => field);
            setSortDir('desc');
        }
        // Re-sort existing data
        setNodes(prev => {
            const sorted = [...prev];
            sorted.sort((a, b) => {
                let aVal: number, bVal: number;
                if (field === 'total_earned') {
                    aVal = parseFloat(a.total_earned) || 0;
                    bVal = parseFloat(b.total_earned) || 0;
                } else if (field === 'last_heartbeat') {
                    aVal = a.last_heartbeat?.toDate?.()?.getTime() || 0;
                    bVal = b.last_heartbeat?.toDate?.()?.getTime() || 0;
                } else {
                    aVal = (a as any)[field] || 0;
                    bVal = (b as any)[field] || 0;
                }
                return sortDir() === 'desc' ? bVal - aVal : aVal - bVal;
            });
            return sorted;
        });
    };

    const isOnline = (node: MobileNodeRow) => {
        if (!node.last_heartbeat) return false;
        const hbTime = node.last_heartbeat.toDate ? node.last_heartbeat.toDate() : new Date(node.last_heartbeat);
        return hbTime > fiveMinAgo();
    };

    const timeAgo = (ts: any) => {
        if (!ts) return 'Never';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const diff = Date.now() - d.getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    onMount(() => {
        fetchNodes();
    });

    const SortIcon = (props: { field: string }) => (
        <Show when={sortField() === props.field}>
            <span class="ml-1 text-[10px]">{sortDir() === 'desc' ? '\u25BC' : '\u25B2'}</span>
        </Show>
    );

    return (
        <div class="space-y-6">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-black tracking-tight">Mobile Nodes</h1>
                    <p class="text-sm text-gray-500 mt-1">Android & PWA node aggregation dashboard</p>
                </div>
                <button
                    onClick={fetchNodes}
                    disabled={loading()}
                    class="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                >
                    {loading() ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {/* Stats Cards */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Registered */}
                <div class="bg-[#0c0c18] border border-white/5 rounded-xl p-5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Registered</div>
                            <div class="text-2xl font-black text-white">{stats().totalNodes}</div>
                        </div>
                    </div>
                    <div class="flex gap-3 text-[10px] font-bold text-gray-500">
                        <span>Android: {stats().deviceBreakdown.android}</span>
                        <span>PWA: {stats().deviceBreakdown.pwa}</span>
                    </div>
                </div>

                {/* Online Now */}
                <div class="bg-[#0c0c18] border border-white/5 rounded-xl p-5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke-width="2" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Online Now</div>
                            <div class="text-2xl font-black text-green-400">{stats().onlineNow}</div>
                        </div>
                    </div>
                    <div class="text-[10px] font-bold text-gray-500">
                        Active: {stats().activeNodes} / {stats().totalNodes}
                    </div>
                </div>

                {/* Total Uptime */}
                <div class="bg-[#0c0c18] border border-white/5 rounded-xl p-5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Uptime</div>
                            <div class="text-2xl font-black text-white">{stats().totalUptimeHours.toLocaleString()}<span class="text-sm text-gray-500 ml-1">hrs</span></div>
                        </div>
                    </div>
                    <div class="text-[10px] font-bold text-gray-500">
                        {stats().totalHeartbeats.toLocaleString()} heartbeats
                    </div>
                </div>

                {/* VCN Rewards */}
                <div class="bg-[#0c0c18] border border-white/5 rounded-xl p-5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total VCN Earned</div>
                            <div class="text-2xl font-black text-amber-400">{stats().totalRewardsEarned}</div>
                        </div>
                    </div>
                    <div class="flex gap-3 text-[10px] font-bold text-gray-500">
                        <span>Pending: {stats().totalRewardsPending}</span>
                        <span>Claimed: {stats().totalRewardsClaimed}</span>
                    </div>
                </div>
            </div>

            {/* Node Table */}
            <div class="bg-[#0c0c18] border border-white/5 rounded-xl overflow-hidden">
                <div class="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 class="font-bold text-sm">All Nodes ({nodes().length})</h3>
                </div>

                <Show when={!loading()} fallback={
                    <div class="p-12 flex items-center justify-center">
                        <div class="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                }>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">
                                    <th class="text-left px-4 py-3">Node</th>
                                    <th class="text-left px-4 py-3">Device</th>
                                    <th class="text-center px-4 py-3">Status</th>
                                    <th class="text-right px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('total_uptime_seconds')}>
                                        Uptime<SortIcon field="total_uptime_seconds" />
                                    </th>
                                    <th class="text-right px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('heartbeat_count')}>
                                        Heartbeats<SortIcon field="heartbeat_count" />
                                    </th>
                                    <th class="text-right px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('streak_days')}>
                                        Streak<SortIcon field="streak_days" />
                                    </th>
                                    <th class="text-right px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('total_earned')}>
                                        Earned<SortIcon field="total_earned" />
                                    </th>
                                    <th class="text-right px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('last_heartbeat')}>
                                        Last Seen<SortIcon field="last_heartbeat" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <Show when={nodes().length > 0} fallback={
                                    <tr><td colspan="8" class="text-center py-12 text-gray-500">No mobile nodes registered yet</td></tr>
                                }>
                                    <For each={nodes()}>
                                        {(node) => (
                                            <tr class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                <td class="px-4 py-3">
                                                    <div class="font-bold text-white text-xs">{node.email || node.id.slice(0, 12)}</div>
                                                    <div class="text-[10px] text-gray-500 font-mono">{node.id.slice(0, 16)}...</div>
                                                </td>
                                                <td class="px-4 py-3">
                                                    <span class={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${node.device_type === 'android' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                                                        }`}>
                                                        {node.device_type}
                                                    </span>
                                                </td>
                                                <td class="px-4 py-3 text-center">
                                                    <span class={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${isOnline(node)
                                                        ? 'bg-green-500/10 text-green-400'
                                                        : node.status === 'active'
                                                            ? 'bg-amber-500/10 text-amber-400'
                                                            : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                        <span class={`w-1.5 h-1.5 rounded-full ${isOnline(node) ? 'bg-green-400 animate-pulse' : node.status === 'active' ? 'bg-amber-400' : 'bg-red-400'
                                                            }`} />
                                                        {isOnline(node) ? 'Online' : node.status === 'active' ? 'Idle' : 'Offline'}
                                                    </span>
                                                </td>
                                                <td class="px-4 py-3 text-right">
                                                    <span class="text-white font-bold text-xs">{formatUptime(node.total_uptime_seconds)}</span>
                                                    <div class="text-[10px] text-gray-500">Today: {formatUptime(node.today_uptime_seconds)}</div>
                                                </td>
                                                <td class="px-4 py-3 text-right font-bold text-xs text-gray-300">{node.heartbeat_count.toLocaleString()}</td>
                                                <td class="px-4 py-3 text-right">
                                                    <span class="font-bold text-xs text-white">{node.streak_days}d</span>
                                                </td>
                                                <td class="px-4 py-3 text-right">
                                                    <span class="font-bold text-xs text-amber-400">{formatVCN(node.total_earned)}</span>
                                                    <Show when={parseFloat(node.pending_reward) > 0}>
                                                        <div class="text-[10px] text-gray-500">+{formatVCN(node.pending_reward)} pending</div>
                                                    </Show>
                                                </td>
                                                <td class="px-4 py-3 text-right text-[11px] text-gray-400">{timeAgo(node.last_heartbeat)}</td>
                                            </tr>
                                        )}
                                    </For>
                                </Show>
                            </tbody>
                        </table>
                    </div>
                </Show>
            </div>
        </div>
    );
}
