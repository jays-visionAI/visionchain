import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { getRPConfig, updateRPConfig, RPConfig, getFirebaseDb } from '../../services/firebaseService';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

// RP action definitions with labels and categories
const RP_ACTION_DEFS: { key: keyof RPConfig; label: string; category: string; description: string }[] = [
    // User Actions
    { key: 'referral', label: 'Referral', category: 'User Actions', description: 'Invite a new user' },
    { key: 'levelup', label: 'Level Up', category: 'User Actions', description: 'Every 10th level milestone' },
    { key: 'daily_login', label: 'Daily Login', category: 'User Actions', description: 'First login of the day' },
    { key: 'profile_update', label: 'Profile Update', category: 'User Actions', description: 'Update profile info' },
    { key: 'ai_chat', label: 'AI Chat', category: 'User Actions', description: 'Each AI conversation' },
    { key: 'transfer_send', label: 'Transfer Send', category: 'User Actions', description: 'Send VCN transfer' },
    { key: 'staking_deposit', label: 'Staking Deposit', category: 'User Actions', description: 'Stake VCN tokens' },
    { key: 'mobile_node_daily', label: 'Mobile Node', category: 'User Actions', description: 'Daily mobile node uptime reward' },
    // Disk & Market
    { key: 'disk_upload', label: 'Disk Upload', category: 'Disk & Market', description: 'Upload file to Disk' },
    { key: 'disk_download', label: 'Disk Download', category: 'Disk & Market', description: 'Download file from Disk' },
    { key: 'market_purchase', label: 'Market Purchase', category: 'Disk & Market', description: 'Buy from Vision Market' },
    { key: 'market_publish', label: 'Market Publish', category: 'Disk & Market', description: 'Publish file to Market' },
    // Agent Actions
    { key: 'agent_create', label: 'Agent Create', category: 'Agent Actions', description: 'Create a new AI agent' },
    { key: 'agent_transfer_send', label: 'Agent Transfer', category: 'Agent API', description: 'Agent API transfer.send' },
    { key: 'agent_transfer_batch', label: 'Agent Batch TX', category: 'Agent API', description: 'Agent API transfer.batch' },
    { key: 'agent_staking_deposit', label: 'Agent Staking', category: 'Agent API', description: 'Agent API staking.deposit' },
    { key: 'agent_staking_unstake', label: 'Agent Unstake', category: 'Agent API', description: 'Agent API staking.unstake' },
    { key: 'agent_staking_claim', label: 'Agent Claim', category: 'Agent API', description: 'Agent API staking.claim' },
    { key: 'agent_staking_withdraw', label: 'Agent Withdraw', category: 'Agent API', description: 'Agent API staking.withdraw' },
    { key: 'agent_staking_compound', label: 'Agent Compound', category: 'Agent API', description: 'Agent API staking.compound' },
    { key: 'agent_bridge_initiate', label: 'Agent Bridge', category: 'Agent API', description: 'Agent API bridge.initiate' },
    { key: 'agent_nft_mint', label: 'Agent NFT Mint', category: 'Agent API', description: 'Agent API nft.mint' },
    { key: 'agent_referral_inviter', label: 'Agent Ref Inviter', category: 'Agent API', description: 'Agent API referral inviter bonus' },
    { key: 'agent_referral_invitee', label: 'Agent Ref Invitee', category: 'Agent API', description: 'Agent API referral invitee bonus' },
    // CEX & Quant
    { key: 'cex_connect', label: 'CEX Connect', category: 'CEX & Quant', description: 'Connect a CEX exchange' },
    { key: 'quant_strategy_setup', label: 'Quant Strategy', category: 'CEX & Quant', description: 'Setup a Quant Engine strategy' },
    // Referral RP Propagation (rates, not fixed amounts -- stored as decimals)
    { key: 'referral_rp_tier1_rate', label: 'Tier 1 RP Rate', category: 'Referral RP Propagation', description: 'Direct referrer gets this % of earned RP (0.10 = 10%)' },
    { key: 'referral_rp_tier2_rate', label: 'Tier 2 RP Rate', category: 'Referral RP Propagation', description: 'Grand referrer gets this % of earned RP (0.02 = 2%)' },
    // Referral Rush Leaderboard Rewards
    { key: 'rush_1st', label: '1st Place', category: 'Referral Rush', description: 'Season winner bonus RP' },
    { key: 'rush_2nd', label: '2nd Place', category: 'Referral Rush', description: 'Runner-up bonus RP' },
    { key: 'rush_3rd', label: '3rd Place', category: 'Referral Rush', description: 'Bronze finisher bonus RP' },
    { key: 'rush_top10', label: 'Top 10', category: 'Referral Rush', description: 'Top 10 finisher bonus RP' },
    { key: 'rush_top50', label: 'Top 50', category: 'Referral Rush', description: 'Top 50 finisher bonus RP' },
];

// Action type display colors
const ACTION_COLORS: Record<string, string> = {
    daily_login: '#22c55e', referral: '#10b981', levelup: '#eab308',
    staking_deposit: '#a855f7', transfer_send: '#f59e0b', profile_update: '#9ca3af',
    ai_chat: '#06b6d4', disk_upload: '#3b82f6', disk_download: '#60a5fa',
    market_purchase: '#f43f5e', market_publish: '#ec4899', agent_create: '#14b8a6',
    cex_connect: '#f97316', quant_strategy_setup: '#6366f1', mobile_node_daily: '#8b5cf6',
    referral_tier1_rp: '#34d399', referral_tier2_rp: '#6ee7b7',
    storage_contribution: '#7c3aed',
};

interface TodayActionStat {
    type: string;
    label: string;
    users: number;
    totalRP: number;
    color: string;
}

export default function AdminRPConfig() {
    const [config, setConfig] = createSignal<RPConfig | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [dirty, setDirty] = createSignal(false);
    const [saveSuccess, setSaveSuccess] = createSignal(false);

    // Today's distribution stats
    const [todayStats, setTodayStats] = createSignal<TodayActionStat[]>([]);
    const [statsLoading, setStatsLoading] = createSignal(false);
    const [statsLastRefresh, setStatsLastRefresh] = createSignal<Date | null>(null);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const cfg = await getRPConfig();
            setConfig({ ...cfg });
        } catch (e) {
            console.error('[AdminRPConfig] Failed to load:', e);
        } finally {
            setLoading(false);
        }
    };

    const loadTodayStats = async () => {
        setStatsLoading(true);
        try {
            const db = getFirebaseDb();
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayISO = todayStart.toISOString();

            const rpRef = collection(db, 'rp_history');
            const q = query(rpRef, where('timestamp', '>=', todayISO), orderBy('timestamp', 'desc'));
            const snap = await getDocs(q);

            // Aggregate by type
            const typeMap: Record<string, { users: Set<string>; totalRP: number }> = {};
            snap.forEach(d => {
                const e = d.data();
                const t = e.type || 'unknown';
                if (!typeMap[t]) typeMap[t] = { users: new Set(), totalRP: 0 };
                typeMap[t].users.add(e.userId || '');
                typeMap[t].totalRP += e.amount || 0;
            });

            // Build label map from RP_ACTION_DEFS
            const labelMap: Record<string, string> = {};
            RP_ACTION_DEFS.forEach(d => { labelMap[d.key] = d.label; });
            const extraLabels: Record<string, string> = {
                referral_tier1_rp: 'Referral T1 RP',
                referral_tier2_rp: 'Referral T2 RP',
                storage_contribution: 'Storage Contribution',
            };

            const stats: TodayActionStat[] = Object.entries(typeMap)
                .map(([type, data]) => ({
                    type,
                    label: labelMap[type] || extraLabels[type] || type,
                    users: data.users.size,
                    totalRP: data.totalRP,
                    color: ACTION_COLORS[type] || '#6b7280',
                }))
                .sort((a, b) => b.totalRP - a.totalRP);

            setTodayStats(stats);
            setStatsLastRefresh(new Date());
        } catch (e) {
            console.error('[AdminRPConfig] Failed to load today stats:', e);
        } finally {
            setStatsLoading(false);
        }
    };

    onMount(() => {
        loadConfig();
        loadTodayStats();
    });

    const handleChange = (key: keyof RPConfig, value: number) => {
        const current = config();
        if (!current) return;
        setConfig({ ...current, [key]: value });
        setDirty(true);
        setSaveSuccess(false);
    };

    const handleSave = async () => {
        const cfg = config();
        if (!cfg) return;
        setSaving(true);
        try {
            await updateRPConfig(cfg);
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            console.error('[AdminRPConfig] Save failed:', e);
            alert('Failed to save RP config: ' + (e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('Reset all RP values to defaults? This will overwrite the current configuration.')) return;
        setLoading(true);
        try {
            await updateRPConfig({} as RPConfig);
            await loadConfig();
            setDirty(false);
        } finally {
            setLoading(false);
        }
    };

    // Group actions by category
    const categories = () => {
        const cats = new Map<string, typeof RP_ACTION_DEFS>();
        for (const def of RP_ACTION_DEFS) {
            if (!cats.has(def.category)) cats.set(def.category, []);
            cats.get(def.category)!.push(def);
        }
        return Array.from(cats.entries());
    };

    const totalRPPerCycle = () => {
        const cfg = config();
        if (!cfg) return 0;
        return RP_ACTION_DEFS.reduce((sum, def) => sum + (cfg[def.key] || 0), 0);
    };

    const todayTotalRP = createMemo(() => todayStats().reduce((s, a) => s + a.totalRP, 0));

    // Unique users across all actions (deduplicated)
    const todayUniqueActions = createMemo(() => todayStats().reduce((s, a) => s + a.users, 0));

    return (
        <div class="p-6 space-y-6 max-w-6xl">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-white">RP Rewards Config</h1>
                    <p class="text-sm text-gray-400 mt-1">Manage Reward Points granted per user action</p>
                </div>
                <div class="flex items-center gap-3">
                    <Show when={saveSuccess()}>
                        <span class="text-xs font-bold text-green-400 flex items-center gap-1.5">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                            Saved
                        </span>
                    </Show>
                    <button
                        onClick={handleReset}
                        disabled={loading() || saving()}
                        class="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Reset to Defaults
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!dirty() || saving() || loading()}
                        class="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
                    >
                        <Show when={saving()}>
                            <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </Show>
                        {saving() ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div class="grid grid-cols-4 gap-4">
                <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                    <div class="text-2xl font-black text-white">{RP_ACTION_DEFS.length}</div>
                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Total Actions</div>
                </div>
                <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                    <div class="text-2xl font-black text-purple-400">{categories().length}</div>
                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Categories</div>
                </div>
                <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                    <div class="text-2xl font-black text-green-400">{totalRPPerCycle()}</div>
                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Total RP (All Actions)</div>
                </div>
                <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                    <div class="text-2xl font-black" classList={{ 'text-amber-400': dirty(), 'text-gray-500': !dirty() }}>
                        {dirty() ? 'Unsaved' : 'Synced'}
                    </div>
                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Status</div>
                </div>
            </div>

            {/* ═══ Today's RP Distribution ═══ */}
            <div class="bg-[#111113] border border-white/5 rounded-xl overflow-hidden">
                <div class="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full bg-cyan-500" />
                        <h2 class="text-sm font-black text-white uppercase tracking-wide">Today's RP Distribution</h2>
                        <div class="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
                            <div class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span class="text-[8px] font-black text-green-400 uppercase tracking-widest">Live</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <Show when={statsLastRefresh()}>
                            <span class="text-[10px] text-gray-600">
                                {statsLastRefresh()!.toLocaleTimeString()}
                            </span>
                        </Show>
                        <button
                            onClick={loadTodayStats}
                            disabled={statsLoading()}
                            class="px-3 py-1.5 text-[10px] font-bold text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-all uppercase tracking-widest flex items-center gap-1.5"
                        >
                            <svg class={`w-3 h-3 ${statsLoading() ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>

                <Show when={!statsLoading()} fallback={
                    <div class="p-8 text-center">
                        <div class="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
                    </div>
                }>
                    <Show when={todayStats().length > 0} fallback={
                        <div class="p-8 text-center text-gray-600 text-sm">No RP distributed today yet</div>
                    }>
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    <th class="px-5 py-3 text-left">Action</th>
                                    <th class="px-5 py-3 text-center w-28">Users</th>
                                    <th class="px-5 py-3 text-right w-32">RP Distributed</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={todayStats()}>
                                    {(stat) => (
                                        <tr class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                            <td class="px-5 py-3">
                                                <div class="flex items-center gap-2.5">
                                                    <div class="w-2 h-2 rounded-full flex-shrink-0" style={`background: ${stat.color}`} />
                                                    <span class="text-[13px] font-bold text-gray-100">{stat.label}</span>
                                                    <code class="text-[9px] font-mono text-gray-600 bg-white/[0.03] px-1.5 py-0.5 rounded">{stat.type}</code>
                                                </div>
                                            </td>
                                            <td class="px-5 py-3 text-center">
                                                <span class="text-sm font-bold text-gray-300">{stat.users}</span>
                                            </td>
                                            <td class="px-5 py-3 text-right">
                                                <span class="text-sm font-black" style={`color: ${stat.color}`}>+{stat.totalRP.toLocaleString()}</span>
                                            </td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                            <tfoot>
                                <tr class="border-t border-white/10 bg-white/[0.02]">
                                    <td class="px-5 py-3">
                                        <span class="text-[13px] font-black text-white uppercase tracking-wide">Total</span>
                                        <span class="text-[10px] text-gray-600 ml-2">{todayStats().length} action types</span>
                                    </td>
                                    <td class="px-5 py-3 text-center">
                                        <span class="text-sm font-bold text-white">{todayUniqueActions()}</span>
                                    </td>
                                    <td class="px-5 py-3 text-right">
                                        <span class="text-base font-black text-cyan-400">+{todayTotalRP().toLocaleString()}</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </Show>
                </Show>
            </div>

            {/* Loading State */}
            <Show when={loading()}>
                <div class="p-12 text-center">
                    <div class="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto" />
                    <p class="text-gray-500 text-sm mt-3">Loading RP config...</p>
                </div>
            </Show>

            {/* Config Tables */}
            <Show when={!loading() && config()}>
                <For each={categories()}>
                    {([category, defs]) => (
                        <div class="bg-[#111113] border border-white/5 rounded-xl overflow-hidden">
                            <div class="px-5 py-3 border-b border-white/5 flex items-center gap-3">
                                <div class="w-2 h-2 rounded-full bg-purple-500" />
                                <h2 class="text-sm font-black text-white uppercase tracking-wide">{category}</h2>
                                <span class="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-md">
                                    {defs.length} actions
                                </span>
                            </div>
                            <table class="w-full">
                                <thead>
                                    <tr class="border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        <th class="px-5 py-3 text-left">Action</th>
                                        <th class="px-5 py-3 text-left">Description</th>
                                        <th class="px-5 py-3 text-left w-24">Config Key</th>
                                        <th class="px-5 py-3 text-center w-32">RP Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={defs}>
                                        {(def) => (
                                            <tr class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                <td class="px-5 py-3">
                                                    <span class="text-[13px] font-bold text-gray-100">{def.label}</span>
                                                </td>
                                                <td class="px-5 py-3">
                                                    <span class="text-[12px] text-gray-500">{def.description}</span>
                                                </td>
                                                <td class="px-5 py-3">
                                                    <code class="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{def.key}</code>
                                                </td>
                                                <td class="px-5 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={10000}
                                                        value={config()![def.key] ?? 0}
                                                        onInput={(e) => handleChange(def.key, parseInt(e.currentTarget.value) || 0)}
                                                        class="w-20 bg-[#0a0a0b] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white text-center outline-none focus:border-purple-500/50 transition-colors font-bold"
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    )}
                </For>
            </Show>

            {/* Info Card */}
            <div class="bg-[#111113] border border-white/5 rounded-xl p-5">
                <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <div>
                        <h3 class="text-sm font-bold text-white mb-1">Configuration Notes</h3>
                        <ul class="text-xs text-gray-400 space-y-1 list-disc list-inside">
                            <li>Changes are saved to Firestore <code class="text-purple-400">config/rp_rewards</code> and cached for 5 minutes.</li>
                            <li>Setting an action to <strong class="text-white">0 RP</strong> disables the reward for that action.</li>
                            <li>Agent API actions are granted server-side in <code class="text-purple-400">functions/index.js</code>.</li>
                            <li>User actions are granted client-side in the respective frontend components.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
