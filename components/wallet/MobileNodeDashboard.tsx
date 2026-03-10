import { createSignal, onMount, onCleanup, Show, For, createEffect } from 'solid-js';

import { ENV } from '../../services/envConfig';

// ---------- API ----------
const getApiUrl = () => {
    if (ENV === 'staging') {
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
    pending_usdt: string;
    pending_rp: number;
    total_usdt_earned: string;
    total_rp_earned: number;
}

interface NodeQuality {
    allocatedGb: number;
    usedGb: number;
    uptimePct: number;
    auditPct: number;
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

// ---------- Version ----------
const NODE_VERSION = '1.1.2-beta';
const CF_BASE = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/nodeDownload';
const DOWNLOAD_URLS: Record<string, string> = {
    mac_arm: `${CF_BASE}?platform=mac_arm64`,
    mac_intel: `${CF_BASE}?platform=mac_x64`,
    windows: `${CF_BASE}?platform=windows`,
    linux: `${CF_BASE}?platform=linux`,
};

const DownloadIcon = (props: { class?: string }) => (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

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

    // Quality / Storage data
    const [nodeQuality, setNodeQuality] = createSignal<NodeQuality | null>(null);
    const [showHowEarn, setShowHowEarn] = createSignal(false);

    // Heartbeat state
    const [isRunning, setIsRunning] = createSignal(false);
    const [sessionUptime, setSessionUptime] = createSignal(0);
    const [lastHeartbeatResult, setLastHeartbeatResult] = createSignal<any>(null);

    // Leaderboard
    const [leaderboard, setLeaderboard] = createSignal<LeaderboardEntry[]>([]);
    const [lbLoading, setLbLoading] = createSignal(false);
    const [showLeaderboard, setShowLeaderboard] = createSignal(false);

    // Claim
    const [claiming, setClaiming] = createSignal(false);
    const [claimResult, setClaimResult] = createSignal('');

    // Version update
    const [latestVersion, setLatestVersion] = createSignal('');
    const [updateAvailable, setUpdateAvailable] = createSignal(false);

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
            fetchQuality();
            checkForUpdate();
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

    // ---------- Quality / Storage ----------
    const fetchQuality = async () => {
        try {
            const result = await api('my_rewards.quality', { node_id: nodeId() });
            if (result.success && result.metrics) {
                setNodeQuality(result.metrics as NodeQuality);
            }
        } catch (_) { /* ignore */ }
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

    // ---------- Version Check ----------
    const checkForUpdate = async () => {
        try {
            const res = await fetch('https://api.github.com/repos/jays-visionAI/visionchain/releases/latest');
            if (res.ok) {
                const data = await res.json();
                const remote = (data.tag_name || '').replace(/^v/, '');
                if (remote && remote !== NODE_VERSION) {
                    setLatestVersion(remote);
                    setUpdateAvailable(true);
                }
            }
        } catch (_) { /* ignore */ }
    };

    const getDownloadUrl = () => {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('mac')) return ua.includes('arm') ? DOWNLOAD_URLS.mac_arm : DOWNLOAD_URLS.mac_intel;
        if (ua.includes('win')) return DOWNLOAD_URLS.windows;
        return DOWNLOAD_URLS.linux;
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

    // ---------- Storage Helpers ----------
    const formatStorage = (gb: number) => {
        if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
        return `${gb.toFixed(2)} GB`;
    };
    const storagePct = () => {
        const q = nodeQuality();
        if (!q || q.allocatedGb <= 0) return 0;
        return Math.min(100, (q.usedGb / q.allocatedGb) * 100);
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
                        <div class="flex items-center gap-2">
                            <h3 class="text-lg font-bold text-white">Mobile Node</h3>
                            <span class="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded-md text-[9px] font-black text-amber-400 uppercase tracking-wider">Beta</span>
                        </div>
                        <p class="text-xs text-gray-500">Distributed File + AI Data Storage</p>
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

            {/* AI Storage Provider Badge */}
            <Show when={registered()}>
                <div class="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-cyan-500/10 border border-indigo-500/20 rounded-2xl p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-white">AI Data Storage Provider</div>
                            <div class="text-[10px] text-gray-400 mt-0.5">Your node stores files, semantic embeddings, and AI memory for AI Agents</div>
                        </div>
                        <div class="flex gap-1.5 flex-shrink-0">
                            <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Files" />
                            <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Embeddings" />
                            <div class="w-2 h-2 rounded-full bg-purple-500 animate-pulse" title="Memory" />
                        </div>
                    </div>
                </div>
            </Show>

            {/* Registration Card */}
            <Show when={!registered()}>
                <div class="bg-[#111113] border border-white/[0.06] rounded-[28px] p-8 space-y-6 relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />
                    <div class="relative z-10 space-y-6">
                        <div class="text-center space-y-2">
                            <h4 class="text-xl font-bold text-white">{props.userEmail ? 'Launch Mobile Node' : 'Start Earning VCN'}</h4>
                            <p class="text-sm text-gray-400 max-w-sm mx-auto">
                                {props.userEmail
                                    ? 'Your mobile node is ready. Tap below to activate and start earning VCN.'
                                    : 'Register your device as a Mobile Node and earn rewards while browsing. No downloads required.'
                                }
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
                                {regLoading() ? 'Launching...' : (props.userEmail ? 'Launch Mobile Node' : 'Register Mobile Node')}
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
                {/* Version Update Banner */}
                <Show when={updateAvailable()}>
                    <div class="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                    <DownloadIcon class="w-4.5 h-4.5 text-amber-400" />
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-white">Update Available</div>
                                    <div class="text-[10px] text-gray-400">v{NODE_VERSION} → v{latestVersion()}</div>
                                </div>
                            </div>
                            <a
                                href={getDownloadUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="px-4 py-2 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-xl hover:bg-amber-500/30 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                                <DownloadIcon class="w-3.5 h-3.5" />
                                Download
                            </a>
                        </div>
                    </div>
                </Show>

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
                                    <span>Hash Rate: <b class="text-cyan-400">{lastHeartbeatResult()?.weight}x</b></span>
                                    <span class="w-1 h-1 rounded-full bg-gray-700" />
                                    <span>Next: <b class="text-white">5 min</b></span>
                                </div>
                            </Show>
                        </div>
                    </div>

                    {/* 3-Type Rewards */}
                    <Show when={nodeStatus()}>
                        <div class="grid grid-cols-3 gap-3">
                            {/* USDT */}
                            <div class="bg-[#111113] border border-emerald-500/10 rounded-2xl p-4 space-y-1">
                                <div class="flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span class="text-[8px] font-black text-emerald-400/80 uppercase tracking-wider">USDT</span>
                                </div>
                                <div class="text-lg font-black text-emerald-400">${parseFloat(nodeStatus()!.pending_usdt || '0').toFixed(6)}</div>
                                <div class="text-[9px] text-gray-500">Storage Usage</div>
                            </div>
                            {/* VCN */}
                            <div class="bg-[#111113] border border-cyan-500/10 rounded-2xl p-4 space-y-1">
                                <div class="flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                                    <span class="text-[8px] font-black text-cyan-400/80 uppercase tracking-wider">VCN</span>
                                </div>
                                <div class="text-lg font-black text-cyan-400">{parseFloat(nodeStatus()!.pending_reward).toFixed(2)}</div>
                                <div class="text-[9px] text-gray-500">Pending</div>
                            </div>
                            {/* RP */}
                            <div class="bg-[#111113] border border-amber-500/10 rounded-2xl p-4 space-y-1">
                                <div class="flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                                    <span class="text-[8px] font-black text-amber-400/80 uppercase tracking-wider">RP</span>
                                </div>
                                <div class="text-lg font-black text-amber-400">{(nodeStatus()!.pending_rp || 0).toLocaleString()}</div>
                                <div class="text-[9px] text-gray-500">Testnet Bonus</div>
                            </div>
                        </div>

                        {/* Total Earned + Uptime + Rank */}
                        <div class="grid grid-cols-3 gap-3">
                            <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-3 space-y-0.5">
                                <div class="text-[8px] font-black text-gray-500 uppercase tracking-wider">Total Earned</div>
                                <div class="text-base font-black text-white">
                                    {parseFloat(nodeStatus()!.total_earned || '0') > 0
                                        ? <>{parseFloat(nodeStatus()!.total_earned).toFixed(2)} <span class="text-[10px] text-gray-500">VCN</span></>
                                        : <span class="text-cyan-400 text-sm">Accumulating<span class="animate-pulse">...</span></span>
                                    }
                                </div>
                                <div class="text-[8px] text-gray-600">{parseFloat(nodeStatus()!.total_earned || '0') <= 0 ? 'Rewards are distributed periodically' : ''}</div>
                            </div>
                            <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-3 space-y-0.5">
                                <div class="text-[8px] font-black text-gray-500 uppercase tracking-wider">Uptime</div>
                                <div class="text-base font-black text-white">{nodeStatus()!.total_uptime_hours.toFixed(1)}<span class="text-[10px] text-gray-500">h</span></div>
                            </div>
                            <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-3 space-y-0.5">
                                <div class="text-[8px] font-black text-gray-500 uppercase tracking-wider">Rank</div>
                                <div class="text-base font-black text-purple-400">#{nodeStatus()!.network_rank} <span class="text-[10px] text-gray-500">/ {nodeStatus()!.total_nodes}</span></div>
                            </div>
                        </div>
                    </Show>

                    {/* Storage Usage Bar */}
                    <Show when={nodeQuality()}>
                        <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                            <div class="flex justify-between items-center">
                                <div class="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Storage Usage</div>
                                <div class="text-xs text-gray-400">{formatStorage(nodeQuality()!.usedGb)} / {formatStorage(nodeQuality()!.allocatedGb)}</div>
                            </div>
                            <div class="h-2.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    class={`h-full rounded-full transition-all duration-700 ${storagePct() > 80 ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}
                                    style={`width: ${Math.max(2, storagePct())}%`}
                                />
                            </div>
                            <div class="text-[10px] text-gray-500">Rewards are based on actual storage used by the network</div>
                        </div>
                    </Show>

                    {/* How You Earn - Collapsible */}
                    <button
                        onClick={() => setShowHowEarn(!showHowEarn())}
                        class="w-full flex items-center justify-between px-4 py-3 bg-[#111113] border border-white/[0.06] rounded-2xl text-left hover:border-white/10 transition-all"
                    >
                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">How You Earn</span>
                        <svg class={`w-4 h-4 text-gray-500 transition-transform ${showHowEarn() ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <Show when={showHowEarn()}>
                        <div class="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-3 -mt-3">
                            <div class="flex items-start gap-3">
                                <div class="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-white">USDT</div>
                                    <div class="text-[10px] text-gray-500 mt-0.5">Monthly reward proportional to actual storage used by the network. More storage used = higher payout.</div>
                                </div>
                            </div>
                            <div class="flex items-start gap-3">
                                <div class="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg class="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-white">VCN Token</div>
                                    <div class="text-[10px] text-gray-500 mt-0.5">Earned continuously based on uptime and heartbeat activity. Keep your node running to maximize VCN rewards.</div>
                                </div>
                            </div>
                            <div class="flex items-start gap-3">
                                <div class="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-white">RP (Reward Points)</div>
                                    <div class="text-[10px] text-gray-500 mt-0.5">Bonus points during testnet phase. Earned from daily streaks and participation. Convertible after mainnet launch.</div>
                                </div>
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

                    {/* Leaderboard Toggle Button */}
                    <button
                        onClick={() => { setShowLeaderboard(!showLeaderboard()); if (!showLeaderboard()) fetchLeaderboard(); }}
                        class={`w-full flex items-center justify-between px-4 py-3 bg-[#111113] border border-white/[0.06] rounded-2xl text-left hover:border-white/10 transition-all ${showLeaderboard() ? 'border-yellow-500/20' : ''}`}
                    >
                        <div class="flex items-center gap-2.5">
                            <TrophyIcon class="w-4 h-4 text-yellow-400" />
                            <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Leaderboard</span>
                        </div>
                        <svg class={`w-4 h-4 text-gray-500 transition-transform ${showLeaderboard() ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {/* Leaderboard Content */}
                    <Show when={showLeaderboard()}>
                        <div class="bg-[#111113] border border-white/[0.06] rounded-[28px] overflow-hidden -mt-3">
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
                </div>
            </Show>
        </div>
    );
};
