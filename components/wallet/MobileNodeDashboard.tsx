import { createSignal, onMount, onCleanup, Show, For, createEffect } from 'solid-js';

// ---------- API ----------
const getApiUrl = () => {
    if (import.meta.env.VITE_CHAIN_ENV === 'staging') {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
};

const api = async (action: string, body: Record<string, unknown> = {}, apiKey?: string) => {
    const payload: Record<string, unknown> = { action, ...body };
    if (apiKey) payload.api_key = apiKey;
    const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return res.json();
};

// ---------- Types ----------
interface NodeStatus {
    node_id: string;
    email: string;
    device_type: string;
    wallet_address: string;
    status: string;
    current_mode: string;
    weight: number;
    total_uptime_hours: number;
    today_uptime_hours: number;
    current_epoch: number;
    pending_reward: string;
    claimed_reward: string;
    total_earned: string;
    heartbeat_count: number;
    streak_days: number;
    last_heartbeat: string;
    network_rank: number;
    total_nodes: number;
    referral_code: string;
    created_at: string;
}

interface LeaderboardEntry {
    rank: number;
    node_id: string;
    device_type: string;
    total_uptime_hours: number;
    total_earned: string;
    heartbeat_count: number;
    streak_days: number;
}

// ---------- SVG Icons ----------
const WifiIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><circle cx="12" cy="20" r="1" />
    </svg>
);

const ActivityIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
);

const AwardIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
);

const PlayIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
);

const PauseIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
);

const TrophyIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
);

const ZapIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

const CopyIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);

const CheckIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const GlobeIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

// ---------- Persistence Keys ----------
const MN_API_KEY = 'mn_api_key';
const MN_NODE_ID = 'mn_node_id';

// ---------- Component ----------
interface MobileNodeDashboardProps {
    userEmail?: string;
}

export const MobileNodeDashboard = (props: MobileNodeDashboardProps) => {
    // Registration state
    const [registered, setRegistered] = createSignal(!!localStorage.getItem(MN_API_KEY));
    const [apiKey, setApiKey] = createSignal(localStorage.getItem(MN_API_KEY) || '');
    const [nodeId, setNodeId] = createSignal(localStorage.getItem(MN_NODE_ID) || '');
    const [regEmail, setRegEmail] = createSignal(props.userEmail || '');
    const [regLoading, setRegLoading] = createSignal(false);
    const [regError, setRegError] = createSignal('');

    // Node status
    const [nodeStatus, setNodeStatus] = createSignal<NodeStatus | null>(null);
    const [statusLoading, setStatusLoading] = createSignal(false);

    // Heartbeat state
    const [isRunning, setIsRunning] = createSignal(false);
    const [sessionUptime, setSessionUptime] = createSignal(0);
    const [lastHeartbeatResult, setLastHeartbeatResult] = createSignal<any>(null);

    // Leaderboard
    const [leaderboard, setLeaderboard] = createSignal<LeaderboardEntry[]>([]);
    const [lbLoading, setLbLoading] = createSignal(false);

    // Claim
    const [claiming, setClaiming] = createSignal(false);
    const [claimResult, setClaimResult] = createSignal('');

    // Tabs
    const [activeTab, setActiveTab] = createSignal<'dashboard' | 'leaderboard'>('dashboard');

    // Referral copy
    const [refCopied, setRefCopied] = createSignal(false);

    // Timer IDs
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let uptimeInterval: ReturnType<typeof setInterval> | null = null;

    // Auto-populate email
    createEffect(() => {
        if (props.userEmail && !regEmail()) {
            setRegEmail(props.userEmail);
        }
    });

    // On mount: if registered, load status + start heartbeat auto
    onMount(() => {
        if (registered()) {
            fetchStatus();
            fetchLeaderboard();
            // Auto-start heartbeat on mount if tab is visible
            if (document.visibilityState === 'visible') {
                startHeartbeat();
            }
        }
    });

    onCleanup(() => {
        stopHeartbeat();
    });

    // -- Visibility API handler --
    const handleVisibility = () => {
        if (document.visibilityState === 'visible' && registered() && !isRunning()) {
            startHeartbeat();
        } else if (document.visibilityState === 'hidden' && isRunning()) {
            stopHeartbeat();
        }
    };

    onMount(() => {
        document.addEventListener('visibilitychange', handleVisibility);
    });
    onCleanup(() => {
        document.removeEventListener('visibilitychange', handleVisibility);
    });

    // ---------- Registration ----------
    const handleRegister = async () => {
        setRegError('');
        setRegLoading(true);
        try {
            const result = await api('mobile_node.register', {
                email: regEmail(),
                device_type: 'pwa',
            });
            if (result.error) {
                setRegError(result.error);
                return;
            }
            localStorage.setItem(MN_API_KEY, result.api_key);
            localStorage.setItem(MN_NODE_ID, result.node_id);
            setApiKey(result.api_key);
            setNodeId(result.node_id);
            setRegistered(true);
            fetchStatus();
            fetchLeaderboard();
            startHeartbeat();
        } catch (e: any) {
            setRegError(e.message || 'Registration failed');
        } finally {
            setRegLoading(false);
        }
    };

    // ---------- Status ----------
    const fetchStatus = async () => {
        setStatusLoading(true);
        try {
            const result = await api('mobile_node.status', {}, apiKey());
            if (result.success) {
                setNodeStatus(result as NodeStatus);
            }
        } catch (_) { /* ignore */ }
        setStatusLoading(false);
    };

    // ---------- Heartbeat Engine ----------
    const sendHeartbeat = async () => {
        try {
            // Check network type
            const conn = (navigator as any).connection;
            const mode = conn && conn.type === 'cellular' ? 'cellular_min' : 'wifi_full';
            const batteryApi = (navigator as any).getBattery;
            let batteryPct: number | undefined;
            if (batteryApi) {
                try {
                    const batt = await batteryApi.call(navigator);
                    batteryPct = Math.round(batt.level * 100);
                } catch (_) { /* ignore */ }
            }

            const result = await api('mobile_node.heartbeat', {
                mode,
                battery_pct: batteryPct,
            }, apiKey());

            if (result.success) {
                setLastHeartbeatResult(result);
                // Refresh full status periodically (every 5th heartbeat or first)
                const prev = nodeStatus();
                if (!prev || (prev.heartbeat_count % 5 === 0)) {
                    fetchStatus();
                }
            }
        } catch (_) { /* ignore */ }
    };

    const startHeartbeat = () => {
        if (isRunning()) return;
        setIsRunning(true);

        // Send first heartbeat immediately
        sendHeartbeat();

        // Then every 5 minutes (300 seconds)
        heartbeatInterval = setInterval(() => {
            sendHeartbeat();
        }, 300_000);

        // Session uptime counter (every second)
        uptimeInterval = setInterval(() => {
            setSessionUptime(prev => prev + 1);
        }, 1000);
    };

    const stopHeartbeat = () => {
        setIsRunning(false);
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        if (uptimeInterval) { clearInterval(uptimeInterval); uptimeInterval = null; }
    };

    // ---------- Claim ----------
    const handleClaim = async () => {
        setClaiming(true);
        setClaimResult('');
        try {
            const result = await api('mobile_node.claim_reward', {}, apiKey());
            if (result.success) {
                setClaimResult(`Claimed ${result.claimed_amount} VCN`);
                fetchStatus();
            } else {
                setClaimResult(result.error || 'Claim failed');
            }
        } catch (e: any) {
            setClaimResult(e.message || 'Claim failed');
        }
        setClaiming(false);
    };

    // ---------- Leaderboard ----------
    const fetchLeaderboard = async () => {
        setLbLoading(true);
        try {
            const result = await api('mobile_node.leaderboard', { limit: 20 });
            if (result.success) {
                setLeaderboard(result.rankings || []);
            }
        } catch (_) { /* ignore */ }
        setLbLoading(false);
    };

    // ---------- Helpers ----------
    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const copyRef = () => {
        const code = nodeStatus()?.referral_code;
        if (code) {
            navigator.clipboard?.writeText(code);
            setRefCopied(true);
            setTimeout(() => setRefCopied(false), 2000);
        }
    };

    // ---------- Render ----------
    return (
        <div class="space-y-6">
            {/* Section Header */}
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center">
                        <WifiIcon class="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white">Mobile Node</h3>
                        <p class="text-xs text-gray-500">Earn VCN by keeping this tab active</p>
                    </div>
                </div>
                <Show when={registered() && isRunning()}>
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                        <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span class="text-xs font-bold text-green-400 uppercase tracking-widest">Active</span>
                    </div>
                </Show>
                <Show when={registered() && !isRunning()}>
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-500/10 border border-gray-500/20">
                        <div class="w-2 h-2 rounded-full bg-gray-500" />
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Idle</span>
                    </div>
                </Show>
            </div>

            {/* Registration Card */}
            <Show when={!registered()}>
                <div class="bg-[#111113] border border-white/[0.06] rounded-[28px] p-8 space-y-6 relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />
                    <div class="relative z-10 space-y-6">
                        <div class="text-center space-y-2">
                            <h4 class="text-xl font-bold text-white">Start Earning VCN</h4>
                            <p class="text-sm text-gray-400 max-w-sm mx-auto">
                                Register your device as a Mobile Node and earn rewards while browsing.
                                No downloads required.
                            </p>
                        </div>

                        <div class="space-y-3 max-w-sm mx-auto">
                            <input
                                type="email"
                                value={regEmail()}
                                onInput={(e) => setRegEmail(e.currentTarget.value)}
                                placeholder="Email address"
                                class="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm outline-none focus:border-cyan-500/50 transition-colors"
                            />
                            <Show when={regError()}>
                                <div class="text-red-400 text-xs px-1">{regError()}</div>
                            </Show>
                            <button
                                onClick={handleRegister}
                                disabled={regLoading() || !regEmail()}
                                class="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40 active:scale-[0.98]"
                            >
                                {regLoading() ? 'Registering...' : 'Register Mobile Node'}
                            </button>
                        </div>

                        {/* Feature pills */}
                        <div class="flex flex-wrap justify-center gap-2">
                            {[
                                { icon: WifiIcon, text: 'WiFi Mining' },
                                { icon: ZapIcon, text: 'Auto Rewards' },
                                { icon: AwardIcon, text: 'Daily Streak' },
                            ].map(f => (
                                <div class="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-full">
                                    <f.icon class="w-3 h-3 text-cyan-400" />
                                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{f.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Show>

            {/* Dashboard (Registered) */}
            <Show when={registered()}>
                {/* Tab Switcher */}
                <div class="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        class={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab() === 'dashboard' ? 'bg-white/10 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => { setActiveTab('leaderboard'); fetchLeaderboard(); }}
                        class={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab() === 'leaderboard' ? 'bg-white/10 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Leaderboard
                    </button>
                </div>

                {/* Dashboard Tab */}
                <Show when={activeTab() === 'dashboard'}>
                    <div class="space-y-6">
                        {/* Main Control Card */}
                        <div class="bg-[#111113] border border-white/[0.06] rounded-[28px] p-6 relative overflow-hidden">
                            <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent pointer-events-none" />
                            <div class="relative z-10 space-y-5">
                                {/* Session Timer */}
                                <div class="text-center space-y-1">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Session Uptime</div>
                                    <div class="text-4xl font-black text-white font-mono tracking-wider">
                                        {formatUptime(sessionUptime())}
                                    </div>
                                </div>

                                {/* Play/Pause Control */}
                                <div class="flex justify-center">
                                    <button
                                        onClick={() => isRunning() ? stopHeartbeat() : startHeartbeat()}
                                        class={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-2xl ${isRunning()
                                            ? 'bg-gradient-to-br from-red-600 to-red-700 shadow-red-500/30 hover:shadow-red-500/50'
                                            : 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/30 hover:shadow-cyan-500/50'
                                            }`}
                                    >
                                        <Show when={isRunning()} fallback={<PlayIcon class="w-6 h-6 text-white ml-0.5" />}>
                                            <PauseIcon class="w-6 h-6 text-white" />
                                        </Show>
                                    </button>
                                </div>

                                {/* Status Info */}
                                <Show when={lastHeartbeatResult()}>
                                    <div class="flex items-center justify-center gap-4 text-xs text-gray-400">
                                        <span>Mode: <b class="text-white">{lastHeartbeatResult()?.mode === 'wifi_full' ? 'WiFi' : 'Cellular'}</b></span>
                                        <span class="w-1 h-1 rounded-full bg-gray-700" />
                                        <span>Weight: <b class="text-cyan-400">{lastHeartbeatResult()?.weight}x</b></span>
                                        <span class="w-1 h-1 rounded-full bg-gray-700" />
                                        <span>Next: <b class="text-white">5 min</b></span>
                                    </div>
                                </Show>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <Show when={nodeStatus()}>
                            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* Pending Reward */}
                                <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-1">
                                    <div class="text-[9px] font-bold text-gray-500 uppercase tracking-[0.15em]">Pending Reward</div>
                                    <div class="text-xl font-black text-cyan-400">{parseFloat(nodeStatus()!.pending_reward).toFixed(4)}</div>
                                    <div class="text-[10px] text-gray-500">VCN</div>
                                </div>
                                {/* Total Earned */}
                                <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-1">
                                    <div class="text-[9px] font-bold text-gray-500 uppercase tracking-[0.15em]">Total Earned</div>
                                    <div class="text-xl font-black text-emerald-400">{parseFloat(nodeStatus()!.total_earned || '0').toFixed(4)}</div>
                                    <div class="text-[10px] text-gray-500">VCN</div>
                                </div>
                                {/* Total Uptime */}
                                <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-1">
                                    <div class="text-[9px] font-bold text-gray-500 uppercase tracking-[0.15em]">Total Uptime</div>
                                    <div class="text-xl font-black text-white">{nodeStatus()!.total_uptime_hours.toFixed(1)}h</div>
                                    <div class="text-[10px] text-gray-500">{nodeStatus()!.heartbeat_count} heartbeats</div>
                                </div>
                                {/* Network Rank */}
                                <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-1">
                                    <div class="text-[9px] font-bold text-gray-500 uppercase tracking-[0.15em]">Network Rank</div>
                                    <div class="text-xl font-black text-purple-400">#{nodeStatus()!.network_rank}</div>
                                    <div class="text-[10px] text-gray-500">of {nodeStatus()!.total_nodes} nodes</div>
                                </div>
                            </div>
                        </Show>

                        {/* Action Buttons */}
                        <Show when={nodeStatus()}>
                            <div class="flex gap-3">
                                <button
                                    onClick={handleClaim}
                                    disabled={claiming() || parseFloat(nodeStatus()!.pending_reward) <= 0}
                                    class="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-30 active:scale-[0.98]"
                                >
                                    {claiming() ? 'Claiming...' : 'Claim Rewards'}
                                </button>
                                <button
                                    onClick={fetchStatus}
                                    disabled={statusLoading()}
                                    class="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/5 disabled:opacity-30"
                                >
                                    {statusLoading() ? '...' : 'Refresh'}
                                </button>
                            </div>
                            <Show when={claimResult()}>
                                <div class={`text-xs text-center px-3 py-2 rounded-lg ${claimResult().startsWith('Claimed') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {claimResult()}
                                </div>
                            </Show>
                        </Show>

                        {/* Node Info Card */}
                        <Show when={nodeStatus()}>
                            <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-5 space-y-4">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">Node Details</div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-gray-400">Node ID</span>
                                        <span class="text-white font-mono text-xs">{nodeId()}</span>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-gray-400">Device</span>
                                        <span class="text-white uppercase text-xs font-bold">{nodeStatus()!.device_type}</span>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-gray-400">Wallet</span>
                                        <span class="text-white font-mono text-xs">{nodeStatus()!.wallet_address.slice(0, 6)}...{nodeStatus()!.wallet_address.slice(-4)}</span>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-gray-400">Referral Code</span>
                                        <div class="flex items-center gap-2">
                                            <span class="text-cyan-400 font-mono text-xs">{nodeStatus()!.referral_code}</span>
                                            <button onClick={copyRef} class="p-1 hover:bg-white/10 rounded transition-colors">
                                                <Show when={refCopied()} fallback={<CopyIcon class="w-3.5 h-3.5 text-gray-400" />}>
                                                    <CheckIcon class="w-3.5 h-3.5 text-green-400" />
                                                </Show>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Show>
                    </div>
                </Show>

                {/* Leaderboard Tab */}
                <Show when={activeTab() === 'leaderboard'}>
                    <div class="bg-[#111113] border border-white/[0.06] rounded-[28px] overflow-hidden">
                        <div class="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                                    <TrophyIcon class="w-4 h-4 text-yellow-400" />
                                </div>
                                <div>
                                    <h4 class="text-sm font-bold text-white">Global Rankings</h4>
                                    <p class="text-[10px] text-gray-500">by total uptime contribution</p>
                                </div>
                            </div>
                            <button onClick={fetchLeaderboard} class="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-widest">
                                {lbLoading() ? '...' : 'Refresh'}
                            </button>
                        </div>

                        <Show when={leaderboard().length > 0} fallback={
                            <div class="p-8 text-center text-gray-500 text-sm">
                                {lbLoading() ? 'Loading...' : 'No nodes in leaderboard yet'}
                            </div>
                        }>
                            <div class="divide-y divide-white/[0.04]">
                                <For each={leaderboard()}>
                                    {(entry) => (
                                        <div class={`flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors ${entry.node_id === nodeId() ? 'bg-cyan-500/5' : ''}`}>
                                            <div class={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${entry.rank === 1 ? 'bg-yellow-500/10 text-yellow-400' :
                                                entry.rank === 2 ? 'bg-gray-400/10 text-gray-300' :
                                                    entry.rank === 3 ? 'bg-amber-600/10 text-amber-500' :
                                                        'bg-white/[0.03] text-gray-500'
                                                }`}>
                                                {entry.rank}
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-2">
                                                    <span class="text-sm font-bold text-white truncate font-mono">{entry.node_id}</span>
                                                    <Show when={entry.node_id === nodeId()}>
                                                        <span class="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[9px] font-bold rounded uppercase tracking-wider">You</span>
                                                    </Show>
                                                </div>
                                                <div class="text-[10px] text-gray-500 uppercase">{entry.device_type}</div>
                                            </div>
                                            <div class="text-right">
                                                <div class="text-sm font-bold text-white">{entry.total_uptime_hours.toFixed(1)}h</div>
                                                <div class="text-[10px] text-gray-500">{entry.heartbeat_count} HB</div>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>
                </Show>
            </Show>
        </div>
    );
};
