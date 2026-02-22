import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { getFirebaseApp } from '../../services/firebaseService';

const db = getFirestore(getFirebaseApp());

interface NodeOverviewStats {
    totalNodes: number;
    activeNodes: number;
    onlineNow: number;
    totalUptimeHours: number;
    totalRewardsDistributed: number;
    totalRewardsPending: number;
    totalHeartbeats: number;
    totalStorageGB: number;
    totalChunks: number;
    avgProofSuccessRate: number;
    byType: { mobile: number; desktop: number; agent: number; lite: number; standard: number; full: number };
    byPlatform: { android: number; ios: number; pwa: number; windows: number; macos: number; linux: number; other: number };
    byStatus: { active: number; inactive: number; suspended: number };
}

interface NodeRow {
    id: string;
    email: string;
    type: 'mobile' | 'desktop';
    nodeClass: string;
    platform: string;
    client: string;        // CLI, App, PWA
    status: string;        // derived from heartbeat recency
    firestoreStatus: string; // raw status from Firestore
    currentMode: string;
    uptimeSeconds: number;
    heartbeatCount: number;
    streakDays: number;
    pendingReward: number;
    totalEarned: number;
    claimedReward: number;
    storageUsedMB: number;
    storageMaxGB: number;
    chunkCount: number;
    proofsPassed: number;
    proofsFailed: number;
    lastHeartbeat: any;
    createdAt: any;
    isOnline: boolean;
}

export default function AdminVisionNodes() {
    const [stats, setStats] = createSignal<NodeOverviewStats>({
        totalNodes: 0, activeNodes: 0, onlineNow: 0, totalUptimeHours: 0,
        totalRewardsDistributed: 0, totalRewardsPending: 0, totalHeartbeats: 0,
        totalStorageGB: 0, totalChunks: 0, avgProofSuccessRate: 0,
        byType: { mobile: 0, desktop: 0, agent: 0, lite: 0, standard: 0, full: 0 },
        byPlatform: { android: 0, ios: 0, pwa: 0, windows: 0, macos: 0, linux: 0, other: 0 },
        byStatus: { active: 0, inactive: 0, suspended: 0 },
    });
    const [nodes, setNodes] = createSignal<NodeRow[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [filter, setFilter] = createSignal<'all' | 'mobile' | 'desktop' | 'online'>('all');
    const [sortField, setSortField] = createSignal<string>('totalEarned');
    const [sortDir, setSortDir] = createSignal<'asc' | 'desc'>('desc');
    const [searchQuery, setSearchQuery] = createSignal('');

    const TEN_MIN = 10 * 60 * 1000;
    const THIRTY_MIN = 30 * 60 * 1000;

    const formatUptime = (seconds: number) => {
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
        return `${(seconds / 86400).toFixed(1)}d`;
    };

    const formatVCN = (val: number) => {
        if (val === 0) return '0';
        if (val < 0.01) return '<0.01';
        return val.toFixed(2);
    };

    const formatStorage = (mb: number) => {
        if (mb < 1) return `${Math.round(mb * 1024)}KB`;
        if (mb < 1024) return `${mb.toFixed(1)}MB`;
        return `${(mb / 1024).toFixed(2)}GB`;
    };

    /** Get timestamp in ms from a Firestore or plain date value */
    const toMs = (ts: any): number => {
        if (!ts) return 0;
        if (typeof ts === 'number') return ts;
        if (ts.toDate) return ts.toDate().getTime();
        if (ts.seconds) return ts.seconds * 1000;
        return new Date(ts).getTime() || 0;
    };

    /** Determine device type grouping */
    const classifyType = (deviceType: string): 'mobile' | 'desktop' => {
        const dt = (deviceType || '').toLowerCase();
        if (dt === 'desktop' || dt === 'cli') return 'desktop';
        return 'mobile';
    };

    /** Determine platform from device_type + platform fields */
    const classifyPlatform = (deviceType: string, platformField: string): string => {
        const dt = (deviceType || '').toLowerCase();
        const pf = (platformField || '').toLowerCase();

        if (dt === 'desktop' || dt === 'cli') {
            if (pf.includes('darwin') || pf.includes('mac')) return 'macOS';
            if (pf.includes('win')) return 'Windows';
            if (pf.includes('linux')) return 'Linux';
            return 'Desktop';
        }
        if (dt === 'android') return 'Android';
        if (dt === 'pwa') return 'PWA';
        if (dt === 'ios') return 'iOS';
        return dt || 'Unknown';
    };

    /** Determine client type */
    const classifyClient = (deviceType: string): string => {
        const dt = (deviceType || '').toLowerCase();
        if (dt === 'desktop' || dt === 'cli') return 'CLI';
        if (dt === 'android') return 'App';
        if (dt === 'pwa') return 'PWA';
        if (dt === 'ios') return 'App';
        return 'Unknown';
    };

    /** Determine platform key for stats counting */
    const platformKey = (platform: string): keyof typeof stats extends never ? string : string => {
        const p = platform.toLowerCase();
        if (p === 'android') return 'android';
        if (p === 'ios') return 'ios';
        if (p === 'pwa') return 'pwa';
        if (p === 'macos') return 'macos';
        if (p === 'windows') return 'windows';
        if (p === 'linux') return 'linux';
        return 'other';
    };

    const fetchAllNodes = async () => {
        setLoading(true);
        try {
            const allNodes: NodeRow[] = [];
            const byType = { mobile: 0, desktop: 0, agent: 0, lite: 0, standard: 0, full: 0 };
            const byPlatform = { android: 0, ios: 0, pwa: 0, windows: 0, macos: 0, linux: 0, other: 0 };
            const byStatus = { active: 0, inactive: 0, suspended: 0 };
            let totalUptime = 0, totalEarned = 0, totalPending = 0, totalHB = 0;
            let totalStorageMB = 0, totalChunks = 0, onlineCount = 0, activeCount = 0;
            let proofPassTotal = 0, proofFailTotal = 0;
            const now = Date.now();

            // 1. Fetch mobile_nodes (includes both mobile AND desktop CLI nodes)
            const mobileSnap = await getDocs(collection(db, 'mobile_nodes'));
            mobileSnap.forEach((doc) => {
                const d = doc.data();
                const hbTime = toMs(d.last_heartbeat);
                const online = hbTime > (now - TEN_MIN);
                if (online) onlineCount++;

                const deviceType = d.device_type || 'pwa';
                const nodeType = classifyType(deviceType);
                const platform = classifyPlatform(deviceType, d.platform || '');
                const client = classifyClient(deviceType);
                const nodeClass = d.node_class || 'lite';

                // Determine active/inactive based on heartbeat recency, not just Firestore field
                const firestoreStatus = d.status || 'active';
                let derivedStatus: string;
                if (firestoreStatus === 'suspended') {
                    derivedStatus = 'suspended';
                } else if (hbTime > (now - THIRTY_MIN)) {
                    derivedStatus = 'active';
                } else if (hbTime > 0) {
                    derivedStatus = 'inactive';
                } else {
                    // Never sent heartbeat
                    derivedStatus = 'inactive';
                }

                if (derivedStatus === 'active') { activeCount++; byStatus.active++; }
                else if (derivedStatus === 'suspended') byStatus.suspended++;
                else byStatus.inactive++;

                // Type counting
                if (nodeType === 'desktop') byType.desktop++;
                else byType.mobile++;

                // Node class counting
                if (nodeClass === 'lite') byType.lite++;
                else if (nodeClass === 'standard') byType.standard++;
                else if (nodeClass === 'full') byType.full++;
                if (nodeClass === 'agent') byType.agent++;

                // Platform counting
                const pk = platformKey(platform);
                (byPlatform as any)[pk] = ((byPlatform as any)[pk] || 0) + 1;

                const pending = parseFloat(d.pending_reward || '0') || 0;
                const earned = parseFloat(d.total_earned || '0') || 0;
                const claimed = parseFloat(d.claimed_reward || '0') || 0;
                totalUptime += d.total_uptime_seconds || 0;
                totalEarned += earned;
                totalPending += pending;
                totalHB += d.heartbeat_count || 0;

                // Storage max from config (stored during registration for desktop nodes)
                const storageMaxGB = d.storage_max_gb || 0;
                if (storageMaxGB > 0) totalStorageMB += storageMaxGB * 1024;

                allNodes.push({
                    id: doc.id, email: d.email || '', type: nodeType,
                    nodeClass, platform, client,
                    status: derivedStatus, firestoreStatus,
                    currentMode: d.current_mode || 'offline',
                    uptimeSeconds: d.total_uptime_seconds || 0,
                    heartbeatCount: d.heartbeat_count || 0, streakDays: d.streak_days || 0,
                    pendingReward: pending, totalEarned: earned, claimedReward: claimed,
                    storageUsedMB: 0, storageMaxGB,
                    chunkCount: 0, proofsPassed: 0, proofsFailed: 0,
                    lastHeartbeat: d.last_heartbeat, createdAt: d.created_at, isOnline: online,
                });
            });

            // 2. Fetch vision_nodes (dedicated desktop node collection, if exists)
            try {
                const visionSnap = await getDocs(collection(db, 'vision_nodes'));
                visionSnap.forEach((doc) => {
                    const d = doc.data();
                    byType.desktop++;
                    const nodeClass = d.node_class || 'standard';
                    if (nodeClass === 'lite') byType.lite++;
                    else if (nodeClass === 'standard') byType.standard++;
                    else if (nodeClass === 'full') byType.full++;
                    if (nodeClass === 'agent') byType.agent++;

                    const plat = (d.platform || '').toLowerCase();
                    if (plat.includes('win')) byPlatform.windows++;
                    else if (plat.includes('darwin') || plat.includes('mac')) byPlatform.macos++;
                    else if (plat.includes('linux')) byPlatform.linux++;
                    else byPlatform.other++;

                    const hbTime = toMs(d.last_heartbeat);
                    const online = hbTime > (now - TEN_MIN);
                    if (online) onlineCount++;

                    const firestoreStatus = d.status || 'inactive';
                    let derivedStatus: string;
                    if (firestoreStatus === 'suspended') {
                        derivedStatus = 'suspended';
                    } else if (hbTime > (now - THIRTY_MIN)) {
                        derivedStatus = 'active';
                    } else if (hbTime > 0) {
                        derivedStatus = 'inactive';
                    } else {
                        derivedStatus = 'inactive';
                    }

                    if (derivedStatus === 'active') { activeCount++; byStatus.active++; }
                    else if (derivedStatus === 'suspended') byStatus.suspended++;
                    else byStatus.inactive++;

                    const pending = parseFloat(d.pending_reward || '0') || 0;
                    const earned = parseFloat(d.total_earned || '0') || 0;
                    const claimed = parseFloat(d.claimed_reward || '0') || 0;
                    totalUptime += d.total_uptime_seconds || 0;
                    totalEarned += earned;
                    totalPending += pending;
                    totalHB += d.heartbeat_count || 0;

                    const storageMB = (d.storage_used_bytes || 0) / (1024 * 1024);
                    totalStorageMB += storageMB;
                    const chunks = d.chunk_count || 0;
                    totalChunks += chunks;

                    const pp = d.proof_stats?.total_passed || 0;
                    const pf = d.proof_stats?.total_failed || 0;
                    proofPassTotal += pp;
                    proofFailTotal += pf;

                    const storageMaxGB = d.storage_max_gb || 0;

                    allNodes.push({
                        id: doc.id, email: d.email || '', type: 'desktop',
                        nodeClass, platform: classifyPlatform('desktop', d.platform || ''),
                        client: 'CLI',
                        status: derivedStatus, firestoreStatus,
                        currentMode: d.mode || 'full',
                        uptimeSeconds: d.total_uptime_seconds || 0,
                        heartbeatCount: d.heartbeat_count || 0, streakDays: d.streak_days || 0,
                        pendingReward: pending, totalEarned: earned, claimedReward: claimed,
                        storageUsedMB: storageMB, storageMaxGB,
                        chunkCount: chunks, proofsPassed: pp, proofsFailed: pf,
                        lastHeartbeat: d.last_heartbeat, createdAt: d.created_at, isOnline: online,
                    });
                });
            } catch (e) {
                console.warn('[AdminVisionNodes] vision_nodes collection not found or empty');
            }

            const totalProofs = proofPassTotal + proofFailTotal;
            setStats({
                totalNodes: allNodes.length, activeNodes: activeCount, onlineNow: onlineCount,
                totalUptimeHours: Math.round(totalUptime / 3600),
                totalRewardsDistributed: totalEarned, totalRewardsPending: totalPending,
                totalHeartbeats: totalHB, totalStorageGB: totalStorageMB / 1024,
                totalChunks, avgProofSuccessRate: totalProofs > 0 ? Math.round((proofPassTotal / totalProofs) * 100) : 0,
                byType, byPlatform, byStatus,
            });

            setNodes(allNodes);
        } catch (e) {
            console.error('[AdminVisionNodes] Failed to fetch:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: string) => {
        if (sortField() === field) {
            setSortDir(sortDir() === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const filteredNodes = createMemo(() => {
        let list = nodes();
        const f = filter();
        const q = searchQuery().toLowerCase();

        if (f === 'mobile') list = list.filter(n => n.type === 'mobile');
        else if (f === 'desktop') list = list.filter(n => n.type === 'desktop');
        else if (f === 'online') list = list.filter(n => n.isOnline);

        if (q) {
            list = list.filter(n =>
                n.id.toLowerCase().includes(q) ||
                n.email.toLowerCase().includes(q) ||
                n.platform.toLowerCase().includes(q) ||
                n.nodeClass.toLowerCase().includes(q)
            );
        }

        const sf = sortField();
        const sd = sortDir();
        list = [...list].sort((a, b) => {
            const aVal = (a as any)[sf] ?? 0;
            const bVal = (b as any)[sf] ?? 0;
            const av = typeof aVal === 'number' ? aVal : 0;
            const bv = typeof bVal === 'number' ? bVal : 0;
            return sd === 'desc' ? bv - av : av - bv;
        });

        return list;
    });

    const timeAgo = (ts: any) => {
        const ms = toMs(ts);
        if (!ms) return 'Never';
        const diff = Date.now() - ms;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    onMount(() => { fetchAllNodes(); });

    const SortHeader = (props: { field: string; label: string }) => (
        <th
            class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 cursor-pointer hover:text-gray-300 select-none"
            onClick={() => handleSort(props.field)}
        >
            {props.label}
            <Show when={sortField() === props.field}>
                <span class="ml-1">{sortDir() === 'desc' ? '\u25BC' : '\u25B2'}</span>
            </Show>
        </th>
    );

    // Stat card component
    const StatCard = (props: { icon: string; label: string; value: string | number; sub?: string; color?: string }) => (
        <div class="bg-[#0c0c18] border border-white/5 rounded-xl p-5">
            <div class="flex items-center gap-3 mb-2">
                <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${props.color || 'bg-blue-500/10'}`}>
                    <svg class={`w-5 h-5 ${props.color?.includes('green') ? 'text-green-400' : props.color?.includes('purple') ? 'text-purple-400' : props.color?.includes('amber') ? 'text-amber-400' : props.color?.includes('cyan') ? 'text-cyan-400' : props.color?.includes('rose') ? 'text-rose-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        {props.icon === 'nodes' && <><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>}
                        {props.icon === 'online' && <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33" /></>}
                        {props.icon === 'active' && <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>}
                        {props.icon === 'reward' && <><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 100 4h4a2 2 0 010 4H8" /><line x1="12" y1="6" x2="12" y2="8" /><line x1="12" y1="16" x2="12" y2="18" /></>}
                        {props.icon === 'storage' && <><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></>}
                        {props.icon === 'heartbeat' && <><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></>}
                        {props.icon === 'shield' && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>}
                        {props.icon === 'uptime' && <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>}
                    </svg>
                </div>
                <div>
                    <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">{props.label}</div>
                    <div class="text-2xl font-black text-white">{props.value}</div>
                </div>
            </div>
            <Show when={props.sub}>
                <div class="text-[10px] font-medium text-gray-600 mt-1">{props.sub}</div>
            </Show>
        </div>
    );

    /** Badge colors for node type */
    const typeBadge = (node: NodeRow) => {
        if (node.type === 'desktop') {
            return { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'DESKTOP' };
        }
        return { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'MOBILE' };
    };

    /** Badge colors for node class */
    const classBadge = (cls: string) => {
        if (cls === 'full') return { bg: 'bg-amber-500/10', text: 'text-amber-400' };
        if (cls === 'standard') return { bg: 'bg-purple-500/10', text: 'text-purple-300' };
        if (cls === 'agent') return { bg: 'bg-cyan-500/10', text: 'text-cyan-400' };
        return { bg: 'bg-gray-500/10', text: 'text-gray-400' };
    };

    return (
        <div class="space-y-6">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-black tracking-tight">Vision Nodes</h1>
                    <p class="text-sm text-gray-500 mt-1">All node types: Mobile, Desktop, Agent -- unified overview</p>
                </div>
                <button
                    onClick={fetchAllNodes}
                    disabled={loading()}
                    class="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                >
                    {loading() ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {/* Overview Stats */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon="nodes" label="Total Nodes" value={stats().totalNodes}
                    sub={`Mobile: ${stats().byType.mobile} | Desktop: ${stats().byType.desktop}`} color="bg-blue-500/10" />
                <StatCard icon="active" label="Active" value={stats().activeNodes}
                    sub={`${stats().totalNodes > 0 ? Math.round((stats().activeNodes / stats().totalNodes) * 100) : 0}% of total (heartbeat < 30min)`} color="bg-green-500/10" />
                <StatCard icon="online" label="Online Now" value={stats().onlineNow}
                    sub="Heartbeat within 10min" color="bg-green-500/10" />
                <StatCard icon="reward" label="Total Distributed" value={`${formatVCN(stats().totalRewardsDistributed)} VCN`}
                    sub={`Pending: ${formatVCN(stats().totalRewardsPending)} VCN`} color="bg-amber-500/10" />
            </div>

            {/* Second row: Storage & Infrastructure */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon="storage" label="Network Storage" value={`${stats().totalStorageGB.toFixed(2)} GB`}
                    sub={`${stats().totalChunks.toLocaleString()} chunks`} color="bg-cyan-500/10" />
                <StatCard icon="shield" label="Proof Success" value={`${stats().avgProofSuccessRate}%`}
                    sub="Weighted average" color="bg-purple-500/10" />
                <StatCard icon="heartbeat" label="Total Heartbeats" value={stats().totalHeartbeats.toLocaleString()}
                    sub="Across all nodes" color="bg-rose-500/10" />
                <StatCard icon="uptime" label="Total Uptime" value={`${stats().totalUptimeHours.toLocaleString()}h`}
                    sub="Cumulative network hours" color="bg-blue-500/10" />
            </div>

            {/* Node Class & Platform Breakdown */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* By Node Class */}
                <div class="bg-[#0c0c18] border border-white/5 rounded-xl p-5">
                    <div class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Node Class Distribution</div>
                    <div class="space-y-3">
                        <For each={[
                            { label: 'Lite', count: stats().byType.lite, color: 'bg-blue-500' },
                            { label: 'Standard', count: stats().byType.standard, color: 'bg-purple-500' },
                            { label: 'Full', count: stats().byType.full, color: 'bg-amber-500' },
                            { label: 'Agent', count: stats().byType.agent, color: 'bg-cyan-500' },
                        ]}>
                            {(item) => (
                                <div class="flex items-center gap-3">
                                    <div class="w-16 text-xs font-semibold text-gray-400">{item.label}</div>
                                    <div class="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            class={`h-full rounded-full ${item.color} transition-all duration-500`}
                                            style={{ width: `${stats().totalNodes > 0 ? (item.count / stats().totalNodes) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <div class="w-12 text-right text-xs font-bold text-gray-300">{item.count}</div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* By Platform */}
                <div class="bg-[#0c0c18] border border-white/5 rounded-xl p-5">
                    <div class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Platform Distribution</div>
                    <div class="space-y-3">
                        <For each={[
                            { label: 'Android', count: stats().byPlatform.android, color: 'bg-green-500' },
                            { label: 'PWA', count: stats().byPlatform.pwa, color: 'bg-blue-500' },
                            { label: 'macOS', count: stats().byPlatform.macos, color: 'bg-gray-400' },
                            { label: 'Windows', count: stats().byPlatform.windows, color: 'bg-cyan-500' },
                            { label: 'Linux', count: stats().byPlatform.linux, color: 'bg-amber-500' },
                            { label: 'Other', count: stats().byPlatform.other, color: 'bg-gray-600' },
                        ]}>
                            {(item) => (
                                <div class="flex items-center gap-3">
                                    <div class="w-16 text-xs font-semibold text-gray-400">{item.label}</div>
                                    <div class="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            class={`h-full rounded-full ${item.color} transition-all duration-500`}
                                            style={{ width: `${stats().totalNodes > 0 ? (item.count / stats().totalNodes) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <div class="w-12 text-right text-xs font-bold text-gray-300">{item.count}</div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </div>

            {/* Status Overview */}
            <div class="bg-[#0c0c18] border border-white/5 rounded-xl p-5">
                <div class="flex items-center justify-between mb-4">
                    <div class="text-xs font-bold uppercase tracking-widest text-gray-400">Node Status</div>
                    <div class="flex gap-6">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-green-500" />
                            <span class="text-xs font-semibold text-gray-400">Active: {stats().byStatus.active}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-gray-500" />
                            <span class="text-xs font-semibold text-gray-400">Inactive: {stats().byStatus.inactive}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-red-500" />
                            <span class="text-xs font-semibold text-gray-400">Suspended: {stats().byStatus.suspended}</span>
                        </div>
                    </div>
                </div>
                <div class="h-4 bg-white/5 rounded-full overflow-hidden flex">
                    <div class="bg-green-500 transition-all duration-500" style={{ width: `${stats().totalNodes > 0 ? (stats().byStatus.active / stats().totalNodes) * 100 : 0}%` }} />
                    <div class="bg-gray-500 transition-all duration-500" style={{ width: `${stats().totalNodes > 0 ? (stats().byStatus.inactive / stats().totalNodes) * 100 : 0}%` }} />
                    <div class="bg-red-500 transition-all duration-500" style={{ width: `${stats().totalNodes > 0 ? (stats().byStatus.suspended / stats().totalNodes) * 100 : 0}%` }} />
                </div>
            </div>

            {/* Filter & Search */}
            <div class="flex flex-wrap items-center gap-3">
                <div class="flex bg-[#0c0c18] border border-white/5 rounded-xl overflow-hidden">
                    {(['all', 'mobile', 'desktop', 'online'] as const).map(f => (
                        <button
                            onClick={() => setFilter(f)}
                            class={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${filter() === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {f === 'all' ? `All (${nodes().length})` :
                                f === 'mobile' ? `Mobile (${stats().byType.mobile})` :
                                    f === 'desktop' ? `Desktop (${stats().byType.desktop})` :
                                        `Online (${stats().onlineNow})`}
                        </button>
                    ))}
                </div>
                <div class="flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="Search by ID, email, platform, or class..."
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        class="w-full px-4 py-2 text-sm bg-[#0c0c18] border border-white/5 rounded-xl text-gray-300 placeholder-gray-600 focus:outline-none focus:border-white/20"
                    />
                </div>
            </div>

            {/* Node Table */}
            <div class="bg-[#0c0c18] border border-white/5 rounded-xl overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-white/5">
                                <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Node</th>
                                <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Type / Class</th>
                                <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Platform</th>
                                <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Status</th>
                                <SortHeader field="uptimeSeconds" label="Uptime" />
                                <SortHeader field="heartbeatCount" label="HB" />
                                <SortHeader field="totalEarned" label="Earned" />
                                <SortHeader field="pendingReward" label="Pending" />
                                <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Storage</th>
                                <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Last HB</th>
                            </tr>
                        </thead>
                        <tbody>
                            <Show when={!loading()} fallback={
                                <tr><td colspan="10" class="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
                            }>
                                <For each={filteredNodes()}>
                                    {(node) => {
                                        const tb = typeBadge(node);
                                        const cb = classBadge(node.nodeClass);
                                        return (
                                            <tr class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                <td class="px-3 py-3">
                                                    <div class="flex items-center gap-2">
                                                        <div class={`w-2 h-2 rounded-full flex-shrink-0 ${node.isOnline ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-gray-600'}`} />
                                                        <div>
                                                            <div class="text-xs font-semibold text-gray-200 truncate max-w-[130px]">{node.id}</div>
                                                            <div class="text-[10px] text-gray-600 truncate max-w-[130px]">{node.email || '-'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="px-3 py-3">
                                                    <span class={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${tb.bg} ${tb.text}`}>
                                                        {tb.label}
                                                    </span>
                                                    <span class={`inline-block ml-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${cb.bg} ${cb.text}`}>
                                                        {node.nodeClass}
                                                    </span>
                                                </td>
                                                <td class="px-3 py-3">
                                                    <div class="text-xs text-gray-300">{node.platform}</div>
                                                    <div class="text-[10px] text-gray-600">{node.client}</div>
                                                </td>
                                                <td class="px-3 py-3">
                                                    <span class={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${node.status === 'active' ? 'bg-green-500/10 text-green-400' : node.status === 'suspended' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                                        {node.status}
                                                    </span>
                                                </td>
                                                <td class="px-3 py-3 text-xs text-gray-400 font-mono">{formatUptime(node.uptimeSeconds)}</td>
                                                <td class="px-3 py-3 text-xs text-gray-400 font-mono">{node.heartbeatCount.toLocaleString()}</td>
                                                <td class="px-3 py-3 text-xs text-green-400 font-mono font-semibold">{formatVCN(node.totalEarned)}</td>
                                                <td class="px-3 py-3 text-xs text-amber-400 font-mono">{formatVCN(node.pendingReward)}</td>
                                                <td class="px-3 py-3 text-xs text-cyan-400 font-mono">
                                                    {node.storageMaxGB > 0 ? `${node.storageMaxGB}GB` : node.storageUsedMB > 0 ? formatStorage(node.storageUsedMB) : '-'}
                                                </td>
                                                <td class="px-3 py-3 text-xs text-gray-500">{timeAgo(node.lastHeartbeat)}</td>
                                            </tr>
                                        );
                                    }}
                                </For>
                                <Show when={filteredNodes().length === 0}>
                                    <tr><td colspan="10" class="px-4 py-12 text-center text-gray-600">No nodes found</td></tr>
                                </Show>
                            </Show>
                        </tbody>
                    </table>
                </div>
                <div class="px-4 py-3 border-t border-white/5 text-[10px] text-gray-600 font-semibold">
                    Showing {filteredNodes().length} of {nodes().length} nodes
                </div>
            </div>
        </div>
    );
}
