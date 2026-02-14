import { Component, createSignal, onMount, For, Show, createEffect } from 'solid-js';
import {
    Coins,
    Save,
    RefreshCw,
    ChevronDown,
    AlertCircle,
    Check,
    Layers,
    Settings2,
    Zap,
    Wallet,
    ArrowRightLeft,
    Lock,
    Users,
    Server,
    Globe,
} from 'lucide-solid';
import { getFirebaseDb } from '../../services/firebaseService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAdminRole } from './adminRoleContext';

// ─── Types ───────────────────────────────────────────────────
interface PricingTier {
    name: string;
    cost_vcn: string;
    description: string;
    color: string;
}

interface PricingConfig {
    tiers: Record<string, PricingTier>;
    service_tiers: Record<string, string>;
    updated_at?: any;
    updated_by?: string;
}

// ─── Default Configuration ──────────────────────────────────
const DEFAULT_TIERS: Record<string, PricingTier> = {
    T1: { name: 'Free', cost_vcn: '0', description: 'Read-only queries with no cost', color: '#6EE7B7' },
    T2: { name: 'Basic', cost_vcn: '0.1', description: 'Simple write operations', color: '#93C5FD' },
    T3: { name: 'Standard', cost_vcn: '0.5', description: 'Complex operations with on-chain interaction', color: '#C4B5FD' },
    T4: { name: 'Premium', cost_vcn: '1.0', description: 'High-value transactions and multi-step operations', color: '#FCA5A5' },
};

const DEFAULT_SERVICE_TIERS: Record<string, string> = {
    // system
    'system.register': 'T1',
    'system.network_info': 'T1',
    'system.delete_agent': 'T2',
    // wallet
    'wallet.balance': 'T1',
    'wallet.tx_history': 'T1',
    // transfer
    'transfer.send': 'T2',
    // staking
    'staking.deposit': 'T3',
    'staking.request_unstake': 'T3',
    'staking.claim': 'T3',
    'staking.position': 'T1',
    // social
    'social.referral': 'T1',
    'social.leaderboard': 'T1',
    'social.profile': 'T1',
    // hosting
    'hosting.configure': 'T2',
    'hosting.toggle': 'T2',
    'hosting.logs': 'T1',
};

// Domain metadata for grouping and display
const DOMAIN_META: Record<string, { label: string; iconKey: string; color: string }> = {
    system: { label: 'System', iconKey: 'settings', color: '#94A3B8' },
    wallet: { label: 'Wallet', iconKey: 'wallet', color: '#6EE7B7' },
    transfer: { label: 'Transfer', iconKey: 'transfer', color: '#93C5FD' },
    staking: { label: 'Staking', iconKey: 'staking', color: '#C4B5FD' },
    social: { label: 'Social', iconKey: 'social', color: '#FDE68A' },
    hosting: { label: 'Hosting', iconKey: 'hosting', color: '#F9A8D4' },
};

const DomainIcon: Component<{ domain: string; class?: string }> = (props) => {
    const icons: Record<string, Component<{ class?: string }>> = {
        system: Settings2,
        wallet: Wallet,
        transfer: ArrowRightLeft,
        staking: Lock,
        social: Users,
        hosting: Server,
    };
    const Icon = icons[props.domain] || Globe;
    return <Icon class={props.class} />;
};

// ─── Main Component ─────────────────────────────────────────
const AdminApiPricing: Component = () => {
    const { isAdmin } = useAdminRole();
    const [activeTab, setActiveTab] = createSignal<'tiers' | 'services'>('tiers');
    const [tiers, setTiers] = createSignal<Record<string, PricingTier>>(DEFAULT_TIERS);
    const [serviceTiers, setServiceTiers] = createSignal<Record<string, string>>(DEFAULT_SERVICE_TIERS);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [saveSuccess, setSaveSuccess] = createSignal(false);
    const [error, setError] = createSignal('');
    const [hasChanges, setHasChanges] = createSignal(false);
    const [lastSaved, setLastSaved] = createSignal('');

    // Load config from Firestore
    const loadConfig = async () => {
        setLoading(true);
        try {
            const db = getFirebaseDb();
            const configRef = doc(db, 'config', 'api_pricing');
            const snap = await getDoc(configRef);
            if (snap.exists()) {
                const data = snap.data() as PricingConfig;
                if (data.tiers) setTiers(data.tiers);
                if (data.service_tiers) setServiceTiers({ ...DEFAULT_SERVICE_TIERS, ...data.service_tiers });
                if (data.updated_at) {
                    const ts = data.updated_at.toDate?.() || new Date(data.updated_at);
                    setLastSaved(ts.toLocaleString('ko-KR'));
                }
            }
        } catch (err: any) {
            console.error('[AdminApiPricing] Load failed:', err);
            setError('Failed to load pricing config');
        } finally {
            setLoading(false);
        }
    };

    // Save config to Firestore
    const saveConfig = async () => {
        if (!isAdmin()) { alert('Admin access required'); return; }
        setSaving(true);
        setError('');
        setSaveSuccess(false);
        try {
            const db = getFirebaseDb();
            const configRef = doc(db, 'config', 'api_pricing');
            const { serverTimestamp } = await import('firebase/firestore');
            await setDoc(configRef, {
                tiers: tiers(),
                service_tiers: serviceTiers(),
                updated_at: serverTimestamp(),
                updated_by: 'admin',
            });
            setSaveSuccess(true);
            setHasChanges(false);
            setLastSaved(new Date().toLocaleString('ko-KR'));
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            console.error('[AdminApiPricing] Save failed:', err);
            setError(err.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    // Update tier field
    const updateTier = (tierId: string, field: keyof PricingTier, value: string) => {
        setTiers(prev => ({
            ...prev,
            [tierId]: { ...prev[tierId], [field]: value }
        }));
        setHasChanges(true);
    };

    // Update service tier assignment
    const updateServiceTier = (service: string, tierId: string) => {
        setServiceTiers(prev => ({ ...prev, [service]: tierId }));
        setHasChanges(true);
    };

    // Group services by domain
    const groupedServices = () => {
        const groups: Record<string, string[]> = {};
        Object.keys(serviceTiers()).forEach(service => {
            const domain = service.split('.')[0];
            if (!groups[domain]) groups[domain] = [];
            groups[domain].push(service);
        });
        return groups;
    };

    onMount(() => {
        loadConfig();
        // Force loading complete after 5s
        setTimeout(() => { if (loading()) setLoading(false); }, 5000);
    });

    return (
        <div class="space-y-6 p-6 text-white min-h-screen">
            {/* Header */}
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 class="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-3">
                        <Coins class="w-8 h-8 text-amber-400" />
                        API Pricing Control
                    </h1>
                    <p class="text-gray-400 mt-1">
                        Configure tier pricing and service cost assignments for the Agent Gateway
                    </p>
                    <Show when={lastSaved()}>
                        <p class="text-xs text-gray-500 mt-1">Last saved: {lastSaved()}</p>
                    </Show>
                </div>
                <div class="flex items-center gap-3">
                    <button
                        onClick={loadConfig}
                        class="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm flex items-center gap-2"
                    >
                        <RefreshCw class="w-4 h-4" />
                        Reload
                    </button>
                    <button
                        onClick={saveConfig}
                        disabled={saving() || !hasChanges()}
                        class={`px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition ${hasChanges()
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20'
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        <Show when={saving()} fallback={
                            <Show when={saveSuccess()} fallback={<><Save class="w-4 h-4" /> Save Changes</>}>
                                <Check class="w-4 h-4" /> Saved
                            </Show>
                        }>
                            <RefreshCw class="w-4 h-4 animate-spin" /> Saving...
                        </Show>
                    </button>
                </div>
            </header>

            {/* Error */}
            <Show when={error()}>
                <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3">
                    <AlertCircle class="w-5 h-5 shrink-0" />
                    {error()}
                </div>
            </Show>

            {/* Tabs */}
            <div class="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('tiers')}
                    class={`px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab() === 'tiers'
                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Layers class="w-4 h-4" />
                    Tier Definitions
                </button>
                <button
                    onClick={() => setActiveTab('services')}
                    class={`px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab() === 'services'
                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Zap class="w-4 h-4" />
                    Service Pricing
                </button>
            </div>

            {/* Loading state */}
            <Show when={loading()}>
                <div class="flex items-center justify-center py-20">
                    <div class="w-10 h-10 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                </div>
            </Show>

            {/* Tab Content */}
            <Show when={!loading()}>
                {/* Tab 1: Tier Definitions */}
                <Show when={activeTab() === 'tiers'}>
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                        <For each={Object.entries(tiers())}>
                            {([tierId, tier]) => (
                                <div
                                    class="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden transition-all hover:border-white/20"
                                    style={{ "border-top": `3px solid ${tier.color}` }}
                                >
                                    {/* Tier header */}
                                    <div class="p-5 pb-3">
                                        <div class="flex items-center justify-between mb-4">
                                            <span
                                                class="text-xs font-bold px-2.5 py-1 rounded-md"
                                                style={{ background: `${tier.color}20`, color: tier.color }}
                                            >
                                                {tierId}
                                            </span>
                                            <div class="flex items-center gap-1.5">
                                                <Coins class="w-4 h-4 text-amber-400" />
                                                <span class="text-xl font-bold text-white">{tier.cost_vcn}</span>
                                                <span class="text-xs text-gray-500">VCN</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Editable fields */}
                                    <div class="px-5 pb-5 space-y-3">
                                        <div>
                                            <label class="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Tier Name</label>
                                            <input
                                                type="text"
                                                value={tier.name}
                                                onInput={(e) => updateTier(tierId, 'name', e.currentTarget.value)}
                                                class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-amber-500/50 focus:outline-none transition"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-xs text-gray-500 uppercase tracking-wider mb-1 block">VCN Cost per Call</label>
                                            <input
                                                type="text"
                                                value={tier.cost_vcn}
                                                onInput={(e) => updateTier(tierId, 'cost_vcn', e.currentTarget.value)}
                                                class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:border-amber-500/50 focus:outline-none transition"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
                                            <textarea
                                                value={tier.description}
                                                onInput={(e) => updateTier(tierId, 'description', e.currentTarget.value)}
                                                rows={2}
                                                class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm resize-none focus:border-amber-500/50 focus:outline-none transition"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Accent Color</label>
                                            <div class="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={tier.color}
                                                    onInput={(e) => updateTier(tierId, 'color', e.currentTarget.value)}
                                                    class="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                                                />
                                                <span class="text-xs text-gray-500 font-mono">{tier.color}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>

                    {/* Summary Cards */}
                    <div class="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <For each={Object.entries(tiers())}>
                            {([tierId, tier]) => {
                                const count = () => Object.values(serviceTiers()).filter(t => t === tierId).length;
                                return (
                                    <div class="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm" style={{ color: tier.color }}>{tier.name}</span>
                                            <span class="text-2xl font-bold text-white">{count()}</span>
                                        </div>
                                        <p class="text-xs text-gray-500 mt-1">services assigned</p>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </Show>

                {/* Tab 2: Service-to-Tier Mapping */}
                <Show when={activeTab() === 'services'}>
                    <div class="space-y-6">
                        <For each={Object.entries(groupedServices())}>
                            {([domain, services]) => {
                                const meta = DOMAIN_META[domain] || { label: domain, color: '#94A3B8' };
                                return (
                                    <div class="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                                        {/* Domain header */}
                                        <div
                                            class="px-5 py-3 flex items-center gap-3 border-b border-white/5"
                                            style={{ background: `${meta.color}08` }}
                                        >
                                            <DomainIcon domain={domain} class="w-5 h-5" />
                                            <h3 class="text-sm font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                                                {meta.label}
                                            </h3>
                                            <span class="text-xs text-gray-600 ml-auto">{services.length} services</span>
                                        </div>

                                        {/* Service rows */}
                                        <div class="divide-y divide-white/5">
                                            <For each={services}>
                                                {(service) => {
                                                    const currentTier = () => serviceTiers()[service] || 'T1';
                                                    const tierData = () => tiers()[currentTier()];
                                                    return (
                                                        <div class="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition">
                                                            <div class="flex items-center gap-3 min-w-0">
                                                                <code class="text-sm font-mono text-gray-300">
                                                                    {service}
                                                                </code>
                                                            </div>
                                                            <div class="flex items-center gap-4 shrink-0">
                                                                {/* VCN cost badge */}
                                                                <div class="flex items-center gap-1.5 min-w-[80px] justify-end">
                                                                    <Coins class="w-3.5 h-3.5 text-amber-400" />
                                                                    <span class="text-sm font-mono font-semibold" style={{ color: tierData()?.color || '#fff' }}>
                                                                        {tierData()?.cost_vcn || '0'}
                                                                    </span>
                                                                    <span class="text-xs text-gray-600">VCN</span>
                                                                </div>
                                                                {/* Tier selector */}
                                                                <div class="relative">
                                                                    <select
                                                                        value={currentTier()}
                                                                        onChange={(e) => updateServiceTier(service, e.currentTarget.value)}
                                                                        class="appearance-none pl-3 pr-8 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer focus:outline-none"
                                                                        style={{
                                                                            background: `${tierData()?.color || '#94A3B8'}15`,
                                                                            color: tierData()?.color || '#94A3B8',
                                                                            "border-color": `${tierData()?.color || '#94A3B8'}40`,
                                                                        }}
                                                                    >
                                                                        <For each={Object.entries(tiers())}>
                                                                            {([id, t]) => (
                                                                                <option value={id} style={{ background: '#1E293B', color: '#fff' }}>
                                                                                    {id} - {t.name} ({t.cost_vcn} VCN)
                                                                                </option>
                                                                            )}
                                                                        </For>
                                                                    </select>
                                                                    <ChevronDown class="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>

                        {/* Revenue estimate */}
                        <div class="p-5 rounded-xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20">
                            <h3 class="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                                <Coins class="w-4 h-4" />
                                Pricing Summary
                            </h3>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <For each={Object.entries(tiers())}>
                                    {([tierId, tier]) => {
                                        const count = () => Object.values(serviceTiers()).filter(t => t === tierId).length;
                                        return (
                                            <div class="text-center">
                                                <p class="text-xs text-gray-500 mb-1">{tier.name} ({tierId})</p>
                                                <p class="text-lg font-bold" style={{ color: tier.color }}>{tier.cost_vcn} VCN</p>
                                                <p class="text-xs text-gray-600">{count()} services</p>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

export default AdminApiPricing;
