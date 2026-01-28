import { createSignal, createEffect, createMemo, For, Show } from 'solid-js';
import { Users, TrendingUp, DollarSign, Calendar, Search, ArrowRight, UserPlus, Calculator, Trophy } from 'lucide-solid';
import { getFirebaseDb, UserData, ReferralConfig, getReferralConfig } from '../../services/firebaseService';
import { collection, query, getDocs, limit, where, orderBy, doc, updateDoc, setDoc } from 'firebase/firestore';

export default function AdminReferrals() {
    const [users, setUsers] = createSignal<UserData[]>([]);
    const [rewards, setRewards] = createSignal<any[]>([]);
    const [config, setConfig] = createSignal<ReferralConfig | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [showConfigModal, setShowConfigModal] = createSignal(false);
    const [configTab, setConfigTab] = createSignal<'general' | 'levels' | 'ranks' | 'simulation'>('general');

    // Form States
    const [newTier1, setNewTier1] = createSignal(0.10);
    const [newTier2, setNewTier2] = createSignal(0.02);
    const [newBaseXp, setNewBaseXp] = createSignal(1.0);
    const [newXpPerLevel, setNewXpPerLevel] = createSignal(0.05);
    const [lvlThresholds, setLvlThresholds] = createSignal<any[]>([]);
    const [ranks, setRanks] = createSignal<any[]>([]);

    const simulationData = createMemo(() => {
        const data = [];
        let cumulativeInvites = 0;
        const sortedRanks = [...ranks()].sort((a, b) => b.minLvl - a.minLvl);

        for (let l = 1; l <= 100; l++) {
            // Find current rank
            const rank = sortedRanks.find(r => l >= r.minLvl)
                || { name: 'None', color: 'text-gray-500' };

            // Find invites needed to get to the NEXT level (the requirement at current level)
            const threshold = lvlThresholds().find(t => l >= t.minLevel && l <= t.maxLevel);
            const invitesToNext = threshold ? threshold.invitesPerLevel : 0;

            // Reward Calculation
            const currentMultiplier = newBaseXp() + (l - 1) * newXpPerLevel();
            const r1 = (newTier1() * currentMultiplier * 100).toFixed(2) + '%';
            const r2 = (newTier2() * currentMultiplier * 100).toFixed(2) + '%';

            data.push({
                level: l,
                rankName: rank.name,
                rankColor: rank.color,
                invitesToNext,
                cumulative: cumulativeInvites,
                reward1: r1,
                reward2: r2
            });

            cumulativeInvites += invitesToNext;
        }
        return data;
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const db = getFirebaseDb();

            // 1. Fetch Users with most referrals
            const usersRef = collection(db, 'users');
            const userQ = query(usersRef, orderBy('referralCount', 'desc'), limit(10));
            const userSnap = await getDocs(userQ);
            setUsers(userSnap.docs.map(d => d.data() as UserData));

            // 2. Fetch Recent Rewards
            const rewardsRef = collection(db, 'referral_rewards');
            const rewardsQ = query(rewardsRef, orderBy('timestamp', 'desc'), limit(20));
            const rewardsSnap = await getDocs(rewardsQ);
            setRewards(rewardsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // 3. Fetch Config
            const cfg = await getReferralConfig();
            setConfig(cfg);
            setNewTier1(cfg.tier1Rate);
            setNewTier2(cfg.tier2Rate);
            setNewBaseXp(cfg.baseXpMultiplier || 1.0);
            setNewXpPerLevel(cfg.xpMultiplierPerLevel || 0.05);
            setLvlThresholds(JSON.parse(JSON.stringify(cfg.levelThresholds || [])));
            setRanks(JSON.parse(JSON.stringify(cfg.ranks || [])));

        } catch (e) {
            console.error("Failed to fetch referral data:", e);
        } finally {
            setLoading(false);
        }
    };

    createEffect(() => {
        fetchData();
    });

    const updateConfig = async () => {
        try {
            const db = getFirebaseDb();
            const cfgRef = doc(db, 'referral_configs', 'global');
            const newCfg = {
                tier1Rate: newTier1(),
                tier2Rate: newTier2(),
                enabledEvents: config()?.enabledEvents || ['subscription', 'token_sale', 'staking'],
                baseXpMultiplier: newBaseXp(),
                xpMultiplierPerLevel: newXpPerLevel(),
                levelThresholds: lvlThresholds(),
                ranks: ranks()
            };
            await setDoc(cfgRef, newCfg);
            setConfig(newCfg as any);
            setShowConfigModal(false);
            alert("Referral configuration updated successfully!");
        } catch (e) {
            alert("Failed to update config");
        }
    };

    const handleThresholdChange = (index: number, field: string, value: number) => {
        const next = [...lvlThresholds()];
        next[index] = { ...next[index], [field]: value };
        setLvlThresholds(next);
    };

    const handleRankChange = (index: number, field: string, value: string | number) => {
        const next = [...ranks()];
        next[index] = { ...next[index], [field]: value };
        setRanks(next);
    };

    const filteredUsers = () => {
        if (!searchQuery()) return users();
        return users().filter(u =>
            u.email.toLowerCase().includes(searchQuery().toLowerCase()) ||
            u.referralCode?.toLowerCase().includes(searchQuery().toLowerCase())
        );
    };

    return (
        <div class="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 class="text-3xl font-black text-white tracking-tight mb-2 uppercase italic flex items-center gap-3">
                        <UserPlus class="w-8 h-8 text-cyan-400" />
                        Referral <span class="text-cyan-400">Engine</span>
                    </h2>
                    <p class="text-gray-500 font-medium">Manage multi-tier rewards and gamified level system</p>
                </div>
                <div class="flex items-center gap-4">
                    <button
                        onClick={() => setShowConfigModal(true)}
                        class="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 transition-all group"
                    >
                        <Calculator class="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span class="font-bold text-sm text-white">System Settings</span>
                    </button>
                    <button
                        onClick={fetchData}
                        class="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all"
                    >
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp class="w-16 h-16 text-cyan-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Growth Multiplier</div>
                    <div class="text-4xl font-black text-white mb-2">{(config()?.tier1Rate || 0) * 100}%</div>
                    <div class="text-sm font-medium text-cyan-400/80 italic">Tier 1 Direct Reward Rate</div>
                </div>
                <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Trophy class="w-16 h-16 text-blue-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Max Level</div>
                    <div class="text-4xl font-black text-white mb-2">100</div>
                    <div class="text-sm font-medium text-blue-400/80 italic">RP System Active</div>
                </div>
                <div class="bg-gradient-to-br from-cyan-600/10 to-blue-600/10 border border-cyan-500/20 rounded-[32px] p-8 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
                        <DollarSign class="w-16 h-16 text-cyan-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Reward Pool</div>
                    <div class="text-4xl font-black text-white mb-2">ACTIVE</div>
                    <div class="text-sm font-medium text-white/50 italic">Processing automated rewards</div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Referrers */}
                <div class="space-y-6">
                    <div class="flex items-center justify-between px-2">
                        <h3 class="text-xl font-black text-white italic tracking-tight">TOP <span class="text-cyan-400">NETWORKERS</span></h3>
                        <div class="relative">
                            <input
                                type="text"
                                placeholder="Search user..."
                                value={searchQuery()}
                                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                class="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/50 transition-all font-medium"
                            />
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        </div>
                    </div>

                    <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] overflow-hidden shadow-2xl">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-white/[0.05] bg-white/[0.02]">
                                        <th class="px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">User / Code</th>
                                        <th class="px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Referrals</th>
                                        <th class="px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Total Rewards</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-white/[0.02]">
                                    <For each={filteredUsers()}>
                                        {(user) => (
                                            <tr class="hover:bg-white/[0.03] transition-colors group">
                                                <td class="px-6 py-4">
                                                    <div class="flex items-center gap-3">
                                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center text-xs font-black text-cyan-400 group-hover:scale-110 transition-transform">
                                                            {user.email.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div class="text-[13px] font-bold text-white">{user.email}</div>
                                                            <div class="text-[10px] font-black text-cyan-500/60 font-mono tracking-tighter">{user.referralCode}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="px-6 py-4 text-center">
                                                    <span class="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs font-black">
                                                        {user.referralCount || 0}
                                                    </span>
                                                </td>
                                                <td class="px-6 py-4 text-right">
                                                    <div class="text-[13px] font-black text-white">{(user.totalRewardsVCN || 0).toLocaleString()} VCN</div>
                                                    <div class="text-[10px] font-bold text-gray-500">${(user.totalRewardsUSD || 0).toLocaleString()}</div>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Recent Rewards */}
                <div class="space-y-6">
                    <h3 class="text-xl font-black text-white italic tracking-tight">RECENT <span class="text-blue-400">DISTRIBUTIONS</span></h3>

                    <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-2 overflow-hidden shadow-2xl">
                        <div class="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            <For each={rewards()}>
                                {(reward) => (
                                    <div class="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:bg-white/[0.04] transition-all group">
                                        <div class="flex items-center justify-between mb-3">
                                            <div class="flex items-center gap-2">
                                                <span class={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${reward.tier === 1 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20' : 'bg-blue-500/20 text-blue-400 border border-blue-500/20'}`}>
                                                    Tier {reward.tier}
                                                </span>
                                                <span class="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{new Date(reward.timestamp).toLocaleString()}</span>
                                            </div>
                                            <div class="text-green-400 font-black text-sm">
                                                +{reward.amount.toFixed(2)} {reward.currency}
                                            </div>
                                        </div>
                                        <div class="flex items-center justify-between gap-4">
                                            <div class="flex items-center gap-2 flex-1 min-w-0">
                                                <div class="text-[11px] font-bold text-gray-400 truncate">{reward.userId}</div>
                                                <ArrowRight class="w-3 h-3 text-gray-700 shrink-0" />
                                                <div class="text-[11px] font-bold text-white truncate">{reward.fromUserId}</div>
                                            </div>
                                            <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest bg-black/40 px-2 py-1 rounded">
                                                {reward.event}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </div>
            </div>

            {/* Config Modal */}
            <Show when={showConfigModal()}>
                <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowConfigModal(false)} />
                    <div class="relative w-full max-w-4xl bg-[#111113] border border-white/[0.08] rounded-[40px] p-10 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div class="flex items-center justify-between mb-8">
                            <div class="flex items-center gap-4">
                                <div class="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                    <Calculator class="w-8 h-8 text-cyan-400" />
                                </div>
                                <div>
                                    <h3 class="text-2xl font-black text-white italic tracking-tight uppercase">Engine <span class="text-cyan-400">Settings</span></h3>
                                    <p class="text-gray-500 text-xs font-medium">Fine-tune reward rates and level progression</p>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div class="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                                <button
                                    onClick={() => setConfigTab('general')}
                                    class={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${configTab() === 'general' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                >
                                    General
                                </button>
                                <button
                                    onClick={() => setConfigTab('levels')}
                                    class={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${configTab() === 'levels' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Levels
                                </button>
                                <button
                                    onClick={() => setConfigTab('ranks')}
                                    class={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${configTab() === 'ranks' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Ranks
                                </button>
                                <button
                                    onClick={() => setConfigTab('simulation')}
                                    class={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${configTab() === 'simulation' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Simulation
                                </button>
                            </div>
                        </div>

                        <div class="space-y-8">
                            {/* General Tab */}
                            <Show when={configTab() === 'general'}>
                                <div class="grid grid-cols-2 gap-8">
                                    <div class="space-y-3">
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Tier 1 Rate (Direct)</label>
                                        <input
                                            type="number" step="0.01" value={newTier1()}
                                            onInput={(e) => setNewTier1(parseFloat(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-cyan-500/50 transition-all font-mono"
                                        />
                                    </div>
                                    <div class="space-y-3">
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Tier 2 Rate (Indirect)</label>
                                        <input
                                            type="number" step="0.01" value={newTier2()}
                                            onInput={(e) => setNewTier2(parseFloat(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-blue-400 outline-none focus:border-blue-500/50 transition-all font-mono"
                                        />
                                    </div>
                                    <div class="space-y-3">
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Base XP Multiplier</label>
                                        <input
                                            type="number" step="0.1" value={newBaseXp()}
                                            onInput={(e) => setNewBaseXp(parseFloat(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-cyan-500/50 transition-all font-mono"
                                        />
                                    </div>
                                    <div class="space-y-3">
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Bonus per Level (e.g. 0.05x)</label>
                                        <input
                                            type="number" step="0.01" value={newXpPerLevel()}
                                            onInput={(e) => setNewXpPerLevel(parseFloat(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-green-400 outline-none focus:border-green-500/50 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </Show>

                            {/* Levels Tab */}
                            <Show when={configTab() === 'levels'}>
                                <div class="bg-black/20 border border-white/5 rounded-[24px] overflow-hidden">
                                    <table class="w-full text-left">
                                        <thead>
                                            <tr class="bg-white/5">
                                                <th class="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Min Lvl</th>
                                                <th class="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Max Lvl</th>
                                                <th class="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Invites Per Lvl</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-white/5">
                                            <For each={lvlThresholds()}>
                                                {(row, i) => (
                                                    <tr>
                                                        <td class="px-6 py-4"><input type="number" class="bg-transparent text-white font-bold w-full outline-none" value={row.minLevel} onInput={(e) => handleThresholdChange(i(), 'minLevel', parseInt(e.currentTarget.value))} /></td>
                                                        <td class="px-6 py-4"><input type="number" class="bg-transparent text-white font-bold w-full outline-none" value={row.maxLevel} onInput={(e) => handleThresholdChange(i(), 'maxLevel', parseInt(e.currentTarget.value))} /></td>
                                                        <td class="px-6 py-4 text-cyan-400"><input type="number" class="bg-transparent text-cyan-400 font-black w-full outline-none" value={row.invitesPerLevel} onInput={(e) => handleThresholdChange(i(), 'invitesPerLevel', parseInt(e.currentTarget.value))} /></td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="text-[10px] text-gray-600 italic mt-4">* Example: If "Invites Per Lvl" is 2, user needs 2 successful referrals to advance 1 level in that range.</p>
                            </Show>

                            {/* Ranks Tab */}
                            <Show when={configTab() === 'ranks'}>
                                <div class="bg-black/20 border border-white/5 rounded-[24px] overflow-hidden">
                                    <div class="max-h-[400px] overflow-y-auto custom-scrollbar">
                                        <table class="w-full text-left">
                                            <thead>
                                                <tr class="bg-white/5 sticky top-0 z-10">
                                                    <th class="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Min Lvl</th>
                                                    <th class="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Rank Name</th>
                                                    <th class="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Color Class</th>
                                                    <th class="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Icon</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-white/5">
                                                <For each={ranks()}>
                                                    {(row, i) => (
                                                        <tr>
                                                            <td class="px-6 py-4"><input type="number" class="bg-transparent text-white font-bold w-full outline-none" value={row.minLvl} onInput={(e) => handleRankChange(i(), 'minLvl', parseInt(e.currentTarget.value))} /></td>
                                                            <td class="px-6 py-4"><input type="text" class="bg-transparent text-white font-bold w-full outline-none uppercase italic" value={row.name} onInput={(e) => handleRankChange(i(), 'name', e.currentTarget.value)} /></td>
                                                            <td class="px-6 py-4"><input type="text" class="bg-transparent text-gray-400 text-xs w-full outline-none" value={row.color} onInput={(e) => handleRankChange(i(), 'color', e.currentTarget.value)} /></td>
                                                            <td class="px-6 py-4"><input type="text" class="bg-transparent text-gray-400 text-xs w-full outline-none" value={row.iconName} onInput={(e) => handleRankChange(i(), 'iconName', e.currentTarget.value)} /></td>
                                                        </tr>
                                                    )}
                                                </For>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </Show>

                            {/* Simulation Tab */}
                            <Show when={configTab() === 'simulation'}>
                                <div class="bg-black/20 border border-white/5 rounded-[24px] overflow-hidden">
                                    <div class="max-h-[500px] overflow-y-auto custom-scrollbar">
                                        <table class="w-full text-left border-collapse">
                                            <thead>
                                                <tr class="bg-white/5 sticky top-0 z-10">
                                                    <th class="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest">Level</th>
                                                    <th class="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest">Rank</th>
                                                    <th class="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest text-center">Invites Needed</th>
                                                    <th class="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest text-center">Cumulative</th>
                                                    <th class="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest text-right text-cyan-400">Reward 1</th>
                                                    <th class="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest text-right text-blue-400">Reward 2</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-white/5 font-mono">
                                                <For each={simulationData()}>
                                                    {(row) => (
                                                        <tr class="hover:bg-white/[0.02] transition-colors">
                                                            <td class="px-4 py-3 text-xs font-bold text-white">Lvl {row.level}</td>
                                                            <td class="px-4 py-3 text-[10px] font-bold uppercase italic">
                                                                <span class={row.rankColor}>{row.rankName}</span>
                                                            </td>
                                                            <td class="px-4 py-3 text-xs text-center text-gray-400">+{row.invitesToNext}</td>
                                                            <td class="px-4 py-3 text-xs text-center font-black text-white">{row.cumulative}</td>
                                                            <td class="px-4 py-3 text-xs text-right font-black text-cyan-400">{row.reward1}</td>
                                                            <td class="px-4 py-3 text-xs text-right font-black text-blue-400">{row.reward2}</td>
                                                        </tr>
                                                    )}
                                                </For>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </Show>

                            <div class="flex gap-4 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => setShowConfigModal(false)}
                                    class="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={updateConfig}
                                    class="flex-[2] py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black rounded-2xl shadow-xl shadow-cyan-500/20 transition-all uppercase tracking-widest text-xs"
                                >
                                    Save System Configuration
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}
