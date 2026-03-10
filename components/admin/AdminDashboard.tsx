import { Component, createSignal, onCleanup, For, Show, onMount, createMemo } from 'solid-js';
import { ethers } from 'ethers';
import { getAllUsers, getDefiConfig, getFirebaseDb } from '../../services/firebaseService';
import { collection, query, where, getDocs, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import {
    Activity,
    Server,
    Wallet,
    Layers,
    ArrowRight,
    Search,
    ShieldCheck,
    Cpu,
    Database,
    Clock,
    Zap,
    Bot,
    Users,
    Smartphone,
    HardDrive,
    Award,
    TrendingUp,
    Gift,
    ArrowUpRight
} from 'lucide-solid';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { MetricCard } from './dashboard/MetricCard';
import {
    TPSGauge,
    NodeHealthChart,
    ActivityChart,
    TVLPieChart,
    NodeDistributionChart,
    ResourceMetricGroup,
    EconomicMetricGroup
} from './dashboard/DashboardCharts';
import { MaxTPSSection } from './dashboard/MaxTPSSection';
import { RecentTransactionsTable } from './dashboard/RecentTransactionsTable';
import { Coins } from 'lucide-solid';

// Use a mock provider or dynamic provider to avoid blocking on load
const RPC_NODES = [
    "https://api.visionchain.co/rpc-proxy",
    "https://rpc.visionchain.co",
    "https://api.visionchain.co"
];

let dashboardProvider: ethers.JsonRpcProvider | null = null;
const getDashboardProvider = () => {
    if (dashboardProvider) return dashboardProvider;

    // Try primary rpc-proxy first (normalized CORS)
    try {
        dashboardProvider = new ethers.JsonRpcProvider(RPC_NODES[0], undefined, { staticNetwork: true });
        return dashboardProvider;
    } catch (e) {
        console.warn("Primary RPC failed:", e);
        return null;
    }
};

export const AdminDashboard: Component = () => {
    const [tps, setTps] = createSignal(4850); // Mock initial TPS
    const [gpuTflops, setGpuTflops] = createSignal(0);
    const [storageTb, setStorageTb] = createSignal(0);
    const [wallets, setWallets] = createSignal(0);
    const [humanCount, setHumanCount] = createSignal(0);
    const [agentCount, setAgentCount] = createSignal(0);
    const [blockTime, setBlockTime] = createSignal(1.2); // Static realistic block time
    const [tvl, setTvl] = createSignal(0);
    const [vcnDistributed, setVcnDistributed] = createSignal(0);
    const [vcnBurned, setVcnBurned] = createSignal(0);
    const [apr, setApr] = createSignal(0);
    const [dauData, setDauData] = createSignal<{ day: string; value: number }[]>([]);
    const [wauData, setWauData] = createSignal<{ day: string; value: number }[]>([]);
    const [mauData, setMauData] = createSignal<{ day: string; value: number }[]>([]);
    const [activeUserTab, setActiveUserTab] = createSignal<'dau' | 'wau' | 'mau'>('dau');
    const [nodeData, setNodeData] = createSignal({
        authority: 5, // 5 Nodes in cluster
        consensus: 0,
        agent: 0,
        edge: 0
    });
    const [recentTransactions, setRecentTransactions] = createSignal<any[]>([]);
    const [paymasterBal, setPaymasterBal] = createSignal("0");
    const [gaslessCount, setGaslessCount] = createSignal(0);
    // Vision Nodes (all types)
    const [totalNodes, setTotalNodes] = createSignal(0);
    const [desktopNodes, setDesktopNodes] = createSignal(0);
    const [mobileNodes, setMobileNodes] = createSignal(0);
    const [onlineNodes, setOnlineNodes] = createSignal(0);
    const [totalStorageGB, setTotalStorageGB] = createSignal(0);
    const [activeStorageGB, setActiveStorageGB] = createSignal(0);
    const [nodeClassBreakdown, setNodeClassBreakdown] = createSignal({ lite: 0, standard: 0, full: 0 });

    // RP Activity
    const [rpTodayTotal, setRpTodayTotal] = createSignal(0);
    const [rpTodayUsers, setRpTodayUsers] = createSignal(0);
    const [rpTodayEvents, setRpTodayEvents] = createSignal(0);
    const [rpTopAction, setRpTopAction] = createSignal<[string, number]>(['--', 0]);
    const [rpRecentFeed, setRpRecentFeed] = createSignal<any[]>([]);


    const fetchRecentTransactions = async () => {
        try {
            const db = getFirebaseDb();
            const results: any[] = [];

            // 1. Fetch from 'transactions' collection (direct chain tx records)
            try {
                const txRef = collection(db, 'transactions');
                const txQuery = query(txRef, orderBy('timestamp', 'desc'), limit(15));
                const txSnap = await getDocs(txQuery);
                txSnap.forEach((doc) => {
                    const d = doc.data();
                    results.push({
                        hash: (d.hash || doc.id).slice(0, 10) + '...',
                        type: d.type || 'Transfer',
                        from: d.from_addr ? (d.from_addr.slice(0, 6) + '...' + d.from_addr.slice(-4)) : 'Unknown',
                        to: d.to_addr ? (d.to_addr.slice(0, 6) + '...' + d.to_addr.slice(-4)) : 'Unknown',
                        amount: d.value ? (parseFloat(d.value) > 1e15 ? (parseFloat(d.value) / 1e18).toFixed(2) : d.value) : '0',
                        time: Math.max(0, Math.floor((Date.now() - (d.timestamp || Date.now())) / 60000)),
                        _ts: d.timestamp || 0,
                    });
                });
            } catch (e) {
                console.warn('[Dashboard] transactions collection fetch failed:', e);
            }

            // 2. Fetch from 'scheduledTransfers' (agent / timelock transfers with SENT status)
            try {
                const stRef = collection(db, 'scheduledTransfers');
                const stQuery = query(stRef, where('status', '==', 'SENT'), limit(15));
                const stSnap = await getDocs(stQuery);
                stSnap.forEach((doc) => {
                    const d = doc.data();
                    const ts = d.executedAt ? new Date(d.executedAt).getTime() : (d.timestamp || Date.now());
                    // Normalize amount from possible wei
                    let amt = d.amount || '0';
                    if (typeof amt === 'string' && amt.length > 15 && !amt.includes('.')) {
                        try { amt = (Number(BigInt(amt)) / 1e18).toFixed(2); } catch { /* keep */ }
                    }
                    results.push({
                        hash: (d.txHash || d.executionTx || doc.id).slice(0, 10) + '...',
                        type: d.type === 'BATCH' ? 'Batch Transfer' : 'Time Lock',
                        from: d.userEmail ? d.userEmail.split('@')[0] : 'Agent',
                        to: d.recipient ? (d.recipient.slice(0, 6) + '...' + d.recipient.slice(-4)) : 'Unknown',
                        amount: amt,
                        time: Math.max(0, Math.floor((Date.now() - ts) / 60000)),
                        _ts: ts,
                    });
                });
            } catch (e) {
                console.warn('[Dashboard] scheduledTransfers fetch failed:', e);
            }

            // 3. Deduplicate by hash, sort by timestamp desc, take top 10
            const seen = new Set<string>();
            const unique = results.filter(r => {
                if (seen.has(r.hash)) return false;
                seen.add(r.hash);
                return true;
            });
            unique.sort((a, b) => (b._ts || 0) - (a._ts || 0));
            setRecentTransactions(unique.slice(0, 10));
        } catch (error) {
            console.error("Failed to fetch dashboard transactions:", error);
            setRecentTransactions([]);
        }
    };

    const fetchPaymasterStats = async () => {
        try {
            const p = getDashboardProvider();
            if (!p) return;

            const balance = await p.getBalance("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
            setPaymasterBal(ethers.formatEther(balance));
        } catch (e) {
            console.log("Failed to fetch paymaster stats (RPC might be down)");
        }
    };

    // Remove simulation timer
    // const timer = setInterval(() => { ... }, 2000);
    // onCleanup(() => clearInterval(timer));

    const fetchUserStats = async () => {
        try {
            const users = await getAllUsers(500);
            setHumanCount(users.length);

            // Fetch agent count from Firestore
            const db = getFirebaseDb();
            const agentsRef = collection(db, 'agents');
            const agentsSnap = await getCountFromServer(agentsRef);
            const agentTotal = agentsSnap.data().count;
            setAgentCount(agentTotal);

            setWallets(users.length + agentTotal);
        } catch (e) {
            console.error("Failed to fetch user stats for dashboard:", e);
        }
    };

    const fetchTVLData = async () => {
        try {
            const config = await getDefiConfig();
            // TVL in VCN, convert to millions USD (assuming $0.3 per VCN)
            const tvlUsd = (config.totalVcnLocked || 0) * 0.3 / 1000000;
            setTvl(tvlUsd);
            setApr(config.stakingApr || 0);
        } catch (e) {
            console.error("Failed to fetch TVL:", e);
        }
    };

    const fetchDAUData = async () => {
        try {
            const db = getFirebaseDb();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const result: { day: string; value: number }[] = [];

            // Fetch last 7 days of actual login activity from user_activity_daily
            const now = new Date();
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
                const dateStr = kst.toISOString().split('T')[0];
                const dayName = days[date.getDay()];

                try {
                    const snap = await getDocs(query(collection(db, 'user_activity_daily'), where('date', '==', dateStr)));
                    let count = 0;
                    snap.forEach(d => { count = d.data().count || 0; });
                    result.push({ day: dayName, value: count });
                } catch {
                    result.push({ day: dayName, value: 0 });
                }
            }

            setDauData(result);
        } catch (e) {
            console.error("Failed to fetch DAU data:", e);
            setDauData([
                { day: 'Mon', value: 0 },
                { day: 'Tue', value: 0 },
                { day: 'Wed', value: 0 },
                { day: 'Thu', value: 0 },
                { day: 'Fri', value: 0 },
                { day: 'Sat', value: 0 },
                { day: 'Sun', value: 0 },
            ]);
        }
    };

    const fetchWAUData = async () => {
        try {
            const db = getFirebaseDb();
            const result: { day: string; value: number }[] = [];
            const now = new Date();

            // Fetch last 4 weeks of WAU
            for (let w = 3; w >= 0; w--) {
                const weekEnd = new Date(now);
                weekEnd.setDate(weekEnd.getDate() - w * 7);
                const weekStart = new Date(weekEnd);
                weekStart.setDate(weekStart.getDate() - 6);

                const uniqueUsers = new Set<string>();

                for (let d = 0; d < 7; d++) {
                    const date = new Date(weekStart);
                    date.setDate(date.getDate() + d);
                    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
                    const dateStr = kst.toISOString().split('T')[0];

                    try {
                        const snap = await getDocs(query(collection(db, 'user_activity_daily'), where('date', '==', dateStr)));
                        snap.forEach(doc => {
                            const data = doc.data();
                            const users = data.users || [];
                            users.forEach((u: string) => uniqueUsers.add(u));
                            // Fallback: if no users array, use count
                            if (!users.length && data.count) {
                                uniqueUsers.add(`anon_${dateStr}_${data.count}`);
                            }
                        });
                    } catch { /* skip */ }
                }

                const kstEnd = new Date(weekEnd.getTime() + 9 * 60 * 60 * 1000);
                const label = `W${kstEnd.getMonth() + 1}/${kstEnd.getDate()}`;
                result.push({ day: label, value: uniqueUsers.size || 0 });
            }

            setWauData(result);
        } catch (e) {
            console.error('Failed to fetch WAU data:', e);
            setWauData([{ day: 'W1', value: 0 }, { day: 'W2', value: 0 }, { day: 'W3', value: 0 }, { day: 'W4', value: 0 }]);
        }
    };

    const fetchMAUData = async () => {
        try {
            const db = getFirebaseDb();
            const result: { day: string; value: number }[] = [];
            const now = new Date();
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            // Fetch last 6 months
            for (let m = 5; m >= 0; m--) {
                const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
                const yearMonth = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
                const label = months[targetDate.getMonth()];

                try {
                    // Try monthly aggregate first
                    const snap = await getDocs(query(collection(db, 'user_activity_monthly'), where('month', '==', yearMonth)));
                    let count = 0;
                    snap.forEach(doc => { count = doc.data().count || 0; });

                    if (count === 0) {
                        // Fallback: sum daily counts for the month
                        const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
                        const uniqueUsers = new Set<string>();
                        for (let d = 1; d <= daysInMonth; d++) {
                            const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
                            try {
                                const daySnap = await getDocs(query(collection(db, 'user_activity_daily'), where('date', '==', dateStr)));
                                daySnap.forEach(doc => {
                                    const data = doc.data();
                                    if (data.count) uniqueUsers.add(`d_${dateStr}_${data.count}`);
                                });
                            } catch { /* skip */ }
                        }
                        count = uniqueUsers.size;
                    }

                    result.push({ day: label, value: count });
                } catch {
                    result.push({ day: label, value: 0 });
                }
            }

            setMauData(result);
        } catch (e) {
            console.error('Failed to fetch MAU data:', e);
            setMauData([]);
        }
    };

    const fetchNodeStats = async () => {
        try {
            const db = getFirebaseDb();
            const now = Date.now();
            const tenMinAgo = new Date(now - 10 * 60 * 1000);
            let total = 0, desktop = 0, mobile = 0, online = 0;
            let storageTotal = 0, storageActive = 0;
            const classCounts = { lite: 0, standard: 0, full: 0 };

            // 1. mobile_nodes (includes mobile + desktop CLI/App nodes)
            const mobileSnap = await getDocs(collection(db, 'mobile_nodes'));
            mobileSnap.forEach((doc) => {
                const d = doc.data();
                total++;
                const deviceType = (d.device_type || 'pwa').toLowerCase();
                if (deviceType === 'desktop' || deviceType === 'desktop_app' || deviceType === 'desktop_cli') {
                    desktop++;
                } else {
                    mobile++;
                }
                // Node class
                const cls = (d.node_class || 'lite').toLowerCase();
                if (cls === 'standard') classCounts.standard++;
                else if (cls === 'full') classCounts.full++;
                else classCounts.lite++;
                // Storage
                const maxGB = parseFloat(d.storage_max_gb || '0') || 0;
                storageTotal += maxGB;
                // Online check
                let hbTime = 0;
                if (d.last_heartbeat) {
                    if (d.last_heartbeat.toDate) hbTime = d.last_heartbeat.toDate().getTime();
                    else if (d.last_heartbeat.seconds) hbTime = d.last_heartbeat.seconds * 1000;
                    else hbTime = new Date(d.last_heartbeat).getTime();
                }
                if (hbTime > tenMinAgo.getTime()) {
                    online++;
                    storageActive += maxGB;
                }
            });

            // 2. vision_nodes (dedicated desktop node collection)
            try {
                const visionSnap = await getDocs(collection(db, 'vision_nodes'));
                visionSnap.forEach((doc) => {
                    const d = doc.data();
                    total++;
                    desktop++;
                    const cls = (d.node_class || 'standard').toLowerCase();
                    if (cls === 'standard') classCounts.standard++;
                    else if (cls === 'full') classCounts.full++;
                    else classCounts.lite++;
                    const maxGB = parseFloat(d.storage_max_gb || '0') || 0;
                    storageTotal += maxGB;
                    let hbTime = 0;
                    if (d.last_heartbeat) {
                        if (d.last_heartbeat.toDate) hbTime = d.last_heartbeat.toDate().getTime();
                        else if (d.last_heartbeat.seconds) hbTime = d.last_heartbeat.seconds * 1000;
                        else hbTime = new Date(d.last_heartbeat).getTime();
                    }
                    if (hbTime > tenMinAgo.getTime()) {
                        online++;
                        storageActive += maxGB;
                    }
                });
            } catch { /* vision_nodes may not exist */ }

            setTotalNodes(total);
            setDesktopNodes(desktop);
            setMobileNodes(mobile);
            setOnlineNodes(online);
            setTotalStorageGB(storageTotal);
            setActiveStorageGB(storageActive);
            setNodeClassBreakdown(classCounts);
            // Update the Resource Metric storage display (convert GB to TB)
            setStorageTb(parseFloat((storageTotal / 1024).toFixed(2)));
        } catch (e) {
            console.error('Failed to fetch node stats:', e);
        }
    };

    // Fetch real data on mount & Simulate TPS
    const fetchRPActivity = async () => {
        try {
            const db = getFirebaseDb();
            const rpRef = collection(db, 'rp_history');
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayISO = todayStart.toISOString();

            // Fetch today's events
            const todayQuery = query(rpRef, where('timestamp', '>=', todayISO), orderBy('timestamp', 'desc'));
            const todaySnap = await getDocs(todayQuery);
            const events = todaySnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

            const totalRP = events.reduce((s: number, e: any) => s + (e.amount || 0), 0);
            const uniqueUsers = new Set(events.map((e: any) => e.userId)).size;
            setRpTodayTotal(totalRP);
            setRpTodayUsers(uniqueUsers);
            setRpTodayEvents(events.length);

            // Top action
            const counts: Record<string, number> = {};
            events.forEach((e: any) => { counts[e.type] = (counts[e.type] || 0) + 1; });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            setRpTopAction(sorted.length > 0 ? sorted[0] as [string, number] : ['--', 0]);

            // Recent feed (latest 8)
            const recentQuery = query(rpRef, orderBy('timestamp', 'desc'), limit(8));
            const recentSnap = await getDocs(recentQuery);
            setRpRecentFeed(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error('[Dashboard] RP Activity fetch failed:', e);
        }
    };

    const rpActionLabel = (type: string) => {
        const map: Record<string, string> = {
            daily_login: 'Login', disk_upload: 'Upload', disk_download: 'Download',
            transfer_send: 'Transfer', staking_deposit: 'Staking', profile_update: 'Profile',
            ai_chat: 'AI Chat', cex_connect: 'CEX', quant_strategy_setup: 'Quant',
            market_publish: 'Publish', market_purchase: 'Purchase', agent_create: 'Agent',
            referral_tier1_rp: 'Ref T1', referral_tier2_rp: 'Ref T2',
            referral: 'Referral', levelup: 'Level Up', mobile_node_daily: 'Node',
        };
        return map[type] || type;
    };

    const rpActionColor = (type: string) => {
        const map: Record<string, string> = {
            daily_login: 'text-green-400', staking_deposit: 'text-purple-400',
            transfer_send: 'text-amber-400', cex_connect: 'text-orange-400',
            quant_strategy_setup: 'text-indigo-400', disk_upload: 'text-blue-400',
            ai_chat: 'text-cyan-400', referral_tier1_rp: 'text-emerald-400',
            referral_tier2_rp: 'text-emerald-300', mobile_node_daily: 'text-violet-400',
        };
        return map[type] || 'text-gray-400';
    };

    const rpAvgPerUser = createMemo(() => {
        const users = rpTodayUsers();
        return users > 0 ? Math.round(rpTodayTotal() / users) : 0;
    });

    onMount(() => {
        // Fetch all data on mount
        fetchRecentTransactions();
        fetchPaymasterStats();
        fetchUserStats();
        fetchTVLData();
        fetchDAUData();
        fetchWAUData();
        fetchMAUData();
        fetchNodeStats();
        fetchRPActivity();

        // Refresh only fast-changing data every 30s (was 5s - too aggressive)
        // User stats and TVL change infrequently, no need to poll
        const dataInterval = setInterval(() => {
            fetchRecentTransactions();
            fetchPaymasterStats();
        }, 30000);

        // Mock TPS Simulation (cosmetic only, slowed from 2s to 10s)
        const tpsInterval = setInterval(() => {
            setTps(prev => {
                const fluctuation = (Math.random() - 0.5) * 150;
                return Math.floor(Math.max(4500, Math.min(5200, prev + fluctuation)));
            });
        }, 10000);

        onCleanup(() => {
            clearInterval(dataInterval);
            clearInterval(tpsInterval);
        });
    });

    return (
        <div class="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-10 font-sans">
            <DashboardHeader />

            {/* Main Grid Layout */}
            <div class="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">

                {/* LEFT COLUMN: Node & Resource Status */}
                <div class="xl:col-span-1 space-y-6">
                    {/* Active Nodes Taxonomy */}
                    <MetricCard
                        title="Active Network Nodes"
                        value={nodeData().authority + nodeData().consensus + nodeData().agent + nodeData().edge}
                        subValue="Live"
                        trend={2.4}
                        icon={Server}
                        color="blue"
                    >
                        <div class="mt-4">
                            <NodeDistributionChart data={nodeData()} />
                        </div>
                    </MetricCard>

                    {/* Network Health */}
                    <MetricCard
                        title="Operational Health"
                        value="99.9%"
                        subValue="Uptime"
                        icon={ShieldCheck}
                        color="green"
                    >
                        <div class="mt-4">
                            <NodeHealthChart />
                            <p class="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-wider">Stability Index: Optimal</p>
                        </div>
                    </MetricCard>

                    <MetricCard
                        title="Total Accounts"
                        value={wallets().toLocaleString()}
                        trend={5.8}
                        icon={Users}
                        color="blue"
                    >
                        <div class="mt-4 space-y-3">
                            {/* Human Accounts */}
                            <div>
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-slate-500 flex items-center gap-1">
                                        <Wallet class="w-3 h-3" /> Human
                                    </span>
                                    <span class="text-white font-mono">{humanCount().toLocaleString()}</span>
                                </div>
                                <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <div class="bg-blue-500 h-full rounded-full transition-all" style={`width: ${wallets() > 0 ? (humanCount() / wallets() * 100) : 0}%`} />
                                </div>
                            </div>
                            {/* Agent Accounts */}
                            <div>
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-slate-500 flex items-center gap-1">
                                        <Bot class="w-3 h-3" /> AI Agent
                                    </span>
                                    <span class="text-cyan-400 font-mono">{agentCount().toLocaleString()}</span>
                                </div>
                                <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <div class="bg-cyan-500 h-full rounded-full transition-all" style={`width: ${wallets() > 0 ? (agentCount() / wallets() * 100) : 0}%`} />
                                </div>
                            </div>
                        </div>
                    </MetricCard>

                    {/* Vision Nodes (All Types) */}
                    <MetricCard
                        title="Vision Nodes"
                        value={totalNodes()}
                        subValue="Total Registered"
                        icon={HardDrive}
                        color="cyan"
                    >
                        <div class="mt-4 space-y-3">
                            {/* Online / Offline */}
                            <div>
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-slate-500 flex items-center gap-1">
                                        <svg class="w-2.5 h-2.5 text-green-400" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" /></svg>
                                        Online Now
                                    </span>
                                    <span class="text-green-400 font-mono">{onlineNodes()}</span>
                                </div>
                                <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <div class="bg-green-500 h-full rounded-full transition-all" style={`width: ${totalNodes() > 0 ? (onlineNodes() / totalNodes() * 100) : 0}%`} />
                                </div>
                            </div>
                            {/* Desktop vs Mobile */}
                            <div class="flex gap-4">
                                <div class="flex-1">
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-slate-500 flex items-center gap-1">
                                            <Server class="w-3 h-3" /> Desktop
                                        </span>
                                        <span class="text-purple-400 font-mono">{desktopNodes()}</span>
                                    </div>
                                    <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                        <div class="bg-purple-500 h-full rounded-full transition-all" style={`width: ${totalNodes() > 0 ? (desktopNodes() / totalNodes() * 100) : 0}%`} />
                                    </div>
                                </div>
                                <div class="flex-1">
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-slate-500 flex items-center gap-1">
                                            <Smartphone class="w-3 h-3" /> Mobile
                                        </span>
                                        <span class="text-blue-400 font-mono">{mobileNodes()}</span>
                                    </div>
                                    <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                        <div class="bg-blue-500 h-full rounded-full transition-all" style={`width: ${totalNodes() > 0 ? (mobileNodes() / totalNodes() * 100) : 0}%`} />
                                    </div>
                                </div>
                            </div>
                            {/* Storage Committed */}
                            <div class="pt-2 border-t border-white/5">
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-slate-500 flex items-center gap-1">
                                        <Database class="w-3 h-3" /> Storage Committed
                                    </span>
                                    <span class="text-cyan-400 font-mono">
                                        {totalStorageGB() >= 1024 ? `${(totalStorageGB() / 1024).toFixed(2)} TB` : `${totalStorageGB().toFixed(1)} GB`}
                                    </span>
                                </div>
                                <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <div class="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all" style={`width: ${totalStorageGB() > 0 ? Math.min((activeStorageGB() / totalStorageGB() * 100), 100) : 0}%`} />
                                </div>
                                <div class="flex justify-between text-[9px] text-slate-600 mt-0.5">
                                    <span>Active: {activeStorageGB() >= 1024 ? `${(activeStorageGB() / 1024).toFixed(2)} TB` : `${activeStorageGB().toFixed(1)} GB`}</span>
                                    <span>{totalStorageGB() > 0 ? Math.round(activeStorageGB() / totalStorageGB() * 100) : 0}% utilization</span>
                                </div>
                            </div>
                            {/* Node Class Distribution */}
                            <div class="pt-2 border-t border-white/5">
                                <div class="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">Node Classes</div>
                                <div class="flex gap-2">
                                    <div class="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
                                        <div class="text-sm font-black text-white">{nodeClassBreakdown().lite}</div>
                                        <div class="text-[8px] font-bold uppercase tracking-wider text-gray-500">Lite</div>
                                    </div>
                                    <div class="flex-1 bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2 text-center">
                                        <div class="text-sm font-black text-indigo-300">{nodeClassBreakdown().standard}</div>
                                        <div class="text-[8px] font-bold uppercase tracking-wider text-indigo-500">Standard</div>
                                    </div>
                                    <div class="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
                                        <div class="text-sm font-black text-white">{nodeClassBreakdown().full}</div>
                                        <div class="text-[8px] font-bold uppercase tracking-wider text-gray-500">Full</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </MetricCard>

                    {/* Economy & Staking */}
                    <MetricCard
                        title="Economy & Staking"
                        value={`${apr().toFixed(1)}% `}
                        subValue="Est. APR"
                        trend={0.5}
                        icon={Coins}
                        color="green"
                    >
                        <div class="mt-4">
                            <EconomicMetricGroup distributed={Math.floor(vcnDistributed())} burned={Math.floor(vcnBurned())} />
                            <p class="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-wider">Deflationary Pressure: Moderate</p>
                        </div>
                    </MetricCard>

                    {/* Block Time */}
                    <MetricCard
                        title="Avg Block Time"
                        value={`${blockTime().toFixed(2)} s`}
                        icon={Layers}
                        color="amber"
                        class="border-amber-500/10"
                    >
                        <p class="text-[10px] text-slate-500 mt-2">Consistent performance within expected limits.</p>
                    </MetricCard>
                </div>

                {/* CENTER COLUMN: TPS Gauge (Hero) */}
                <div class="xl:col-span-2 flex flex-col gap-6">
                    <div class="flex-1 bg-[#0B0E14] border border-white/5 rounded-3xl p-8 relative overflow-hidden flex flex-col items-center justify-center shadow-2xl">
                        <div class="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

                        <div class="relative z-10 text-center mb-6">
                            <h2 class="text-sm font-black text-cyan-400 uppercase tracking-[0.2em] mb-2">Real-time Performance</h2>
                            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                                <div class="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                Live Network
                            </div>
                        </div>

                        <div class="w-full max-w-md aspect-square relative -my-10">
                            <TPSGauge value={tps()} max={100000} />

                            {/* Central Stats Overlay */}
                            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-12">
                                <span class="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Peak TPS</span>
                                <span class="text-lg font-mono text-white">99,842</span>
                            </div>
                        </div>
                    </div>

                    {/* Resource Hero Section: GPU & Storage */}
                    <div class="space-y-4">
                        <div class="flex justify-between items-center px-2">
                            <h3 class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Contributed Resources</h3>
                            <div class="flex items-center gap-2 text-[10px] font-bold text-blue-400">
                                <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                Monitoring dApp SLA
                            </div>
                        </div>
                        <ResourceMetricGroup gpuTflops={gpuTflops()} storageTb={storageTb()} />
                    </div>

                    {/* User Activity Trends: DAU / WAU / MAU */}
                    <div class="bg-[#13161F] border border-white/5 rounded-2xl p-6">
                        {/* Header with Tabs */}
                        <div class="flex justify-between items-center mb-4">
                            <div class="flex items-center gap-2">
                                {/* Tab Switcher */}
                                <div class="flex bg-white/[0.04] rounded-lg p-0.5">
                                    {(['dau', 'wau', 'mau'] as const).map(tab => (
                                        <button
                                            onClick={() => setActiveUserTab(tab)}
                                            class={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${activeUserTab() === tab
                                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                                    : 'text-slate-600 hover:text-slate-400 border border-transparent'
                                                }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                                {/* Current value */}
                                <Show when={activeUserTab() === 'dau' && dauData().length > 0}>
                                    <span class="text-lg font-black text-white ml-2">{dauData()[dauData().length - 1]?.value || 0}</span>
                                    <span class="text-[10px] text-slate-600 font-bold">today</span>
                                </Show>
                                <Show when={activeUserTab() === 'wau' && wauData().length > 0}>
                                    <span class="text-lg font-black text-white ml-2">{wauData()[wauData().length - 1]?.value || 0}</span>
                                    <span class="text-[10px] text-slate-600 font-bold">this week</span>
                                </Show>
                                <Show when={activeUserTab() === 'mau' && mauData().length > 0}>
                                    <span class="text-lg font-black text-white ml-2">{mauData()[mauData().length - 1]?.value || 0}</span>
                                    <span class="text-[10px] text-slate-600 font-bold">this month</span>
                                </Show>
                            </div>
                            <a href="/adminsystem/user-analytics" class="text-xs text-blue-400 hover:text-white transition-colors">View Report</a>
                        </div>
                        {/* Chart Area */}
                        <div class="h-44">
                            <Show when={activeUserTab() === 'dau'}>
                                <ActivityChart data={dauData()} color="#6366f1" gradientId="dauGrad" />
                            </Show>
                            <Show when={activeUserTab() === 'wau'}>
                                <ActivityChart data={wauData()} color="#06b6d4" gradientId="wauGrad" />
                            </Show>
                            <Show when={activeUserTab() === 'mau'}>
                                <ActivityChart data={mauData()} color="#a855f7" gradientId="mauGrad" />
                            </Show>
                        </div>
                        {/* Bottom Labels */}
                        <div class="flex justify-between mt-2 text-[9px] font-bold text-slate-700">
                            <span>{activeUserTab() === 'dau' ? 'Last 7 Days' : activeUserTab() === 'wau' ? 'Last 4 Weeks' : 'Last 6 Months'}</span>
                            <span class="flex items-center gap-1">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3 text-green-500">
                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                    <polyline points="17 6 23 6 23 12" />
                                </svg>
                                Active User Trends
                            </span>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: TVL & DeFi */}
                <div class="xl:col-span-1 space-y-6">
                    {/* Paymaster / Gasless Relayer Monitor */}
                    <MetricCard
                        title="Gasless Paymaster"
                        value={`${Number(paymasterBal()).toFixed(1)} POL`}
                        subValue="Relayer Pool"
                        trend={0.0}
                        icon={Zap} // Need to import Zap
                        color="amber"
                        class="border-amber-500/10"
                    >
                        <div class="mt-4 space-y-3">
                            <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <span>Relayed Txs (24h)</span>
                                <span class="text-white">{gaslessCount()}</span>
                            </div>
                            <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-amber-500 h-full w-[45%]" />
                            </div>
                            <p class="text-[9px] text-amber-500/80 font-mono mt-1">
                                Target: 0x7099...79C8
                            </p>
                        </div>
                    </MetricCard>

                    {/* TVL Hero */}
                    <MetricCard
                        title="Total Value Locked"
                        value={`$${tvl().toFixed(1)} M`}
                        trend={1.2}
                        icon={Activity}
                        color="purple"
                        class="bg-gradient-to-br from-[#13161F] to-[#1e1b4b]"
                    >
                        <div class="mt-6">
                            <TVLPieChart tvlValue={tvl()} />
                        </div>
                    </MetricCard>

                    {/* Max Performance Section */}
                    <MaxTPSSection />
                </div>
            </div>

            {/* RP Activity Section */}
            <div class="mb-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <h3 class="text-xs font-black text-slate-500 uppercase tracking-widest">Today's RP Activity</h3>
                        <div class="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
                            <div class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span class="text-[8px] font-black text-green-400 uppercase tracking-widest">Live</span>
                        </div>
                    </div>
                    <a href="/adminsystem/activity" class="text-xs text-blue-400 hover:text-white transition-colors flex items-center gap-1">
                        Full Feed <ArrowRight class="w-3 h-3" />
                    </a>
                </div>

                {/* KPI Row */}
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div class="bg-[#13161F] border border-white/5 rounded-xl p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <Zap class="w-3.5 h-3.5 text-cyan-400" />
                            <span class="text-[9px] font-black text-gray-600 uppercase tracking-widest">RP Issued</span>
                        </div>
                        <div class="text-xl font-black text-white">{rpTodayTotal().toLocaleString()}</div>
                        <div class="text-[9px] text-gray-600 mt-0.5">{rpTodayEvents()} events</div>
                    </div>
                    <div class="bg-[#13161F] border border-white/5 rounded-xl p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <Users class="w-3.5 h-3.5 text-green-400" />
                            <span class="text-[9px] font-black text-gray-600 uppercase tracking-widest">Active Users</span>
                        </div>
                        <div class="text-xl font-black text-white">{rpTodayUsers()}</div>
                        <div class="text-[9px] text-gray-600 mt-0.5">earned RP today</div>
                    </div>
                    <div class="bg-[#13161F] border border-white/5 rounded-xl p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <TrendingUp class="w-3.5 h-3.5 text-purple-400" />
                            <span class="text-[9px] font-black text-gray-600 uppercase tracking-widest">Avg / User</span>
                        </div>
                        <div class="text-xl font-black text-white">{rpAvgPerUser()}</div>
                        <div class="text-[9px] text-gray-600 mt-0.5">RP per user</div>
                    </div>
                    <div class="bg-[#13161F] border border-white/5 rounded-xl p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <Award class="w-3.5 h-3.5 text-amber-400" />
                            <span class="text-[9px] font-black text-gray-600 uppercase tracking-widest">Top Action</span>
                        </div>
                        <div class="text-lg font-black text-white">{rpActionLabel(rpTopAction()[0])}</div>
                        <div class="text-[9px] text-gray-600 mt-0.5">{rpTopAction()[1]} events</div>
                    </div>
                </div>

                {/* Mini Feed */}
                <div class="bg-[#13161F] border border-white/5 rounded-xl overflow-hidden">
                    <div class="divide-y divide-white/[0.03]">
                        <For each={rpRecentFeed()}>
                            {(event: any) => (
                                <div class="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                    <div class="w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                                        <ArrowUpRight class={`w-3 h-3 ${rpActionColor(event.type)}`} />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <span class="text-xs font-bold text-white">{event.userId?.split('@')[0] || '?'}</span>
                                        <span class={`ml-2 text-[9px] font-black uppercase tracking-wider ${rpActionColor(event.type)}`}>{rpActionLabel(event.type)}</span>
                                    </div>
                                    <span class="text-xs font-black text-cyan-400">+{event.amount}</span>
                                    <span class="text-[9px] text-gray-600 w-14 text-right">
                                        {(() => {
                                            try {
                                                const diff = Math.floor((Date.now() - new Date(event.timestamp).getTime()) / 60000);
                                                if (diff < 1) return 'now';
                                                if (diff < 60) return `${diff}m`;
                                                return `${Math.floor(diff / 60)}h`;
                                            } catch { return ''; }
                                        })()}
                                    </span>
                                </div>
                            )}
                        </For>
                    </div>
                    <Show when={rpRecentFeed().length === 0}>
                        <div class="px-4 py-6 text-center text-gray-600 text-xs">No recent RP activity</div>
                    </Show>
                </div>
            </div>

            {/* Bottom Section: Recent Transactions Table */}
            <RecentTransactionsTable transactions={recentTransactions()} />
        </div>
    );
};

