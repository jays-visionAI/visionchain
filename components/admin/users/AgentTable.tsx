import { createSignal, createResource, Show, For } from 'solid-js';
import { Search, RefreshCw, Trash2, Copy, ExternalLink } from 'lucide-solid';
import { getAllAgents, deleteAgent, AgentData } from '../../../services/firebaseService';
import { useAdminRole } from '../adminRoleContext';

export default function AgentTable() {
    const { isAdmin } = useAdminRole();
    const [searchQuery, setSearchQuery] = createSignal('');
    const [platformFilter, setPlatformFilter] = createSignal('all');
    const [agents, { refetch }] = createResource(() => getAllAgents());
    const [copiedField, setCopiedField] = createSignal<string | null>(null);

    const filteredAgents = () => {
        if (!agents()) return [];
        return agents()!.filter(agent => {
            const nameMatch = agent.agent_name.toLowerCase().includes(searchQuery().toLowerCase());
            const platformIdMatch = (agent.platform_id || '').toLowerCase().includes(searchQuery().toLowerCase());
            const emailMatch = (agent.owner_email || '').toLowerCase().includes(searchQuery().toLowerCase());
            const addrMatch = agent.wallet_address.toLowerCase().includes(searchQuery().toLowerCase());
            const matchesSearch = nameMatch || platformIdMatch || emailMatch || addrMatch;
            const matchesPlatform = platformFilter() === 'all' || agent.platform === platformFilter();
            return matchesSearch && matchesPlatform;
        });
    };

    const copyToClipboard = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const shortAddress = (addr: string) => {
        if (!addr || !addr.startsWith('0x')) return '-';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const shortApiKey = (key: string) => {
        if (!key) return '-';
        return `${key.slice(0, 8)}...${key.slice(-4)}`;
    };

    const handleDelete = async (agentName: string) => {
        if (!isAdmin()) { alert('Admin access required.'); return; }
        if (!confirm(`Delete agent "${agentName}"? This action cannot be undone.`)) return;
        try {
            await deleteAgent(agentName);
            refetch();
        } catch (e: any) {
            alert(`Failed to delete: ${e.message}`);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
        } catch { return dateStr; }
    };

    const uniquePlatforms = () => {
        if (!agents()) return [];
        const platforms = new Set(agents()!.map(a => a.platform));
        return Array.from(platforms).sort();
    };

    // Stats
    const totalAgents = () => agents()?.length || 0;
    const totalRP = () => agents()?.reduce((sum, a) => sum + a.rp, 0) || 0;
    const totalReferrals = () => agents()?.reduce((sum, a) => sum + a.referral_count, 0) || 0;
    const totalTransfers = () => agents()?.reduce((sum, a) => sum + a.total_transfers, 0) || 0;

    return (
        <div>
            {/* Stats Overview */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-[#0B0E14] border border-white/5 rounded-2xl p-5">
                    <div class="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total Agents</div>
                    <div class="text-2xl font-black text-white">{totalAgents()}</div>
                </div>
                <div class="bg-[#0B0E14] border border-purple-500/10 rounded-2xl p-5">
                    <div class="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total RP</div>
                    <div class="text-2xl font-black text-purple-400">{totalRP().toLocaleString()}</div>
                </div>
                <div class="bg-[#0B0E14] border border-cyan-500/10 rounded-2xl p-5">
                    <div class="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total Referrals</div>
                    <div class="text-2xl font-black text-cyan-400">{totalReferrals()}</div>
                </div>
                <div class="bg-[#0B0E14] border border-emerald-500/10 rounded-2xl p-5">
                    <div class="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total Transfers</div>
                    <div class="text-2xl font-black text-emerald-400">{totalTransfers()}</div>
                </div>
            </div>

            {/* Search & Filter */}
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
                <div class="md:col-span-8 relative group">
                    <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by name, platform ID, email, or address"
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        class="w-full pl-12 pr-4 py-4 bg-[#0B0E14] border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-gray-600"
                    />
                </div>
                <div class="md:col-span-4 relative">
                    <select
                        value={platformFilter()}
                        onChange={(e) => setPlatformFilter(e.currentTarget.value)}
                        class="w-full appearance-none pl-4 pr-4 py-4 bg-[#0B0E14] border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer"
                    >
                        <option value="all">All Platforms</option>
                        <For each={uniquePlatforms()}>
                            {(platform) => <option value={platform}>{platform}</option>}
                        </For>
                    </select>
                </div>
            </div>

            {/* Agent Table */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                {/* Table Head */}
                <div class="grid grid-cols-[2fr_1fr_1.5fr_1fr_0.8fr_0.8fr_0.8fr_1fr_0.5fr] gap-2 px-6 py-4 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    <div>Agent Name</div>
                    <div>Platform</div>
                    <div>Wallet</div>
                    <div>API Key</div>
                    <div class="text-center">RP</div>
                    <div class="text-center">Referrals</div>
                    <div class="text-center">Transfers</div>
                    <div>Registered</div>
                    <div></div>
                </div>

                {/* Table Body */}
                <div class="divide-y divide-white/5">
                    <Show when={agents.loading}>
                        <div class="p-8 text-center text-gray-500">
                            <div class="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-2" />
                            Loading agents...
                        </div>
                    </Show>

                    <Show when={!agents.loading && filteredAgents().length === 0}>
                        <div class="p-12 text-center text-gray-500">
                            <div class="text-4xl mb-4 opacity-30">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 9h.01" /><path d="M15 9h.01" /><path d="M9 15c.83.67 1.83 1 3 1s2.17-.33 3-1" /></svg>
                            </div>
                            <p class="text-sm">No agents found</p>
                            <p class="text-xs text-gray-600 mt-1">Agents will appear here after registration</p>
                        </div>
                    </Show>

                    <For each={filteredAgents()}>
                        {(agent) => (
                            <div class="grid grid-cols-[2fr_1fr_1.5fr_1fr_0.8fr_0.8fr_0.8fr_1fr_0.5fr] gap-2 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors group">
                                {/* Agent Name */}
                                <div>
                                    <div class="text-sm font-bold text-white truncate">{agent.agent_name}</div>
                                    <Show when={agent.owner_email}>
                                        <div class="text-[10px] text-gray-500 truncate">{agent.owner_email}</div>
                                    </Show>
                                </div>

                                {/* Platform */}
                                <div>
                                    <span class={`inline-block px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${agent.platform === 'moltbook' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                            agent.platform === 'openclaw' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                                'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                        }`}>
                                        {agent.platform}
                                    </span>
                                    <Show when={agent.platform_id}>
                                        <div class="text-[10px] text-gray-600 mt-1 truncate">{agent.platform_id}</div>
                                    </Show>
                                </div>

                                {/* Wallet */}
                                <div class="flex items-center gap-1.5">
                                    <span
                                        class="text-xs font-mono text-gray-400 cursor-pointer hover:text-white transition-colors"
                                        onClick={() => copyToClipboard(agent.wallet_address, `wallet-${agent.agent_name}`)}
                                        title={agent.wallet_address}
                                    >
                                        {shortAddress(agent.wallet_address)}
                                    </span>
                                    <Show when={copiedField() === `wallet-${agent.agent_name}`}>
                                        <span class="text-[9px] text-emerald-400 font-bold">Copied</span>
                                    </Show>
                                    <Show when={copiedField() !== `wallet-${agent.agent_name}`}>
                                        <Copy class="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-white transition-all" onClick={() => copyToClipboard(agent.wallet_address, `wallet-${agent.agent_name}`)} />
                                    </Show>
                                </div>

                                {/* API Key */}
                                <div class="flex items-center gap-1.5">
                                    <span
                                        class="text-xs font-mono text-gray-500 cursor-pointer hover:text-white transition-colors"
                                        onClick={() => copyToClipboard(agent.api_key, `api-${agent.agent_name}`)}
                                        title="Click to copy full API key"
                                    >
                                        {shortApiKey(agent.api_key)}
                                    </span>
                                    <Show when={copiedField() === `api-${agent.agent_name}`}>
                                        <span class="text-[9px] text-emerald-400 font-bold">Copied</span>
                                    </Show>
                                </div>

                                {/* RP */}
                                <div class="text-center">
                                    <span class="text-sm font-bold text-purple-400">{agent.rp}</span>
                                </div>

                                {/* Referrals */}
                                <div class="text-center">
                                    <span class="text-sm font-bold text-cyan-400">{agent.referral_count}</span>
                                </div>

                                {/* Transfers */}
                                <div class="text-center">
                                    <span class="text-sm font-bold text-emerald-400">{agent.total_transfers}</span>
                                </div>

                                {/* Registered Date */}
                                <div class="text-xs text-gray-500">
                                    {formatDate(agent.created_at)}
                                </div>

                                {/* Actions */}
                                <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <a
                                        href={`/visionscan?address=${agent.wallet_address}`}
                                        target="_blank"
                                        class="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                        title="View on VisionScan"
                                    >
                                        <ExternalLink class="w-3.5 h-3.5" />
                                    </a>
                                    <Show when={isAdmin()}>
                                        <button
                                            onClick={() => handleDelete(agent.agent_name)}
                                            class="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                                            title="Delete Agent"
                                        >
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                    </Show>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* Footer Info */}
            <div class="flex items-center justify-between mt-4 text-[10px] text-gray-600 uppercase tracking-wider">
                <span>Showing {filteredAgents().length} of {totalAgents()} agents</span>
                <button
                    onClick={() => refetch()}
                    class="flex items-center gap-1 hover:text-gray-400 transition-colors"
                >
                    <RefreshCw class="w-3 h-3" />
                    Refresh
                </button>
            </div>
        </div>
    );
}
