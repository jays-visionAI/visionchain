import { Component, createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import {
    Network,
    Plus,
    Pencil,
    Trash2,
    Save,
    X,
    Check,
    AlertCircle,
    Loader2,
    GripVertical,
    ExternalLink,
    Globe,
    Zap
} from 'lucide-solid';
import {
    BridgeNetwork,
    subscribeToBridgeNetworks,
    saveBridgeNetwork,
    deleteBridgeNetwork,
    initializeBridgeNetworks
} from '../../services/firebaseService';

// Network icon SVGs
const networkIcons: Record<string, string> = {
    vision: '/icons/vision-chain.svg',
    ethereum: '/icons/ethereum.svg',
    polygon: '/icons/polygon.svg',
    base: '/icons/base.svg',
    arbitrum: '/icons/arbitrum.svg',
    optimism: '/icons/optimism.svg',
};

const AdminBridgeNetworks: Component = () => {
    const [networks, setNetworks] = createSignal<BridgeNetwork[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [editingId, setEditingId] = createSignal<string | null>(null);
    const [showAddForm, setShowAddForm] = createSignal(false);
    const [error, setError] = createSignal('');
    const [success, setSuccess] = createSignal('');

    // Form state
    const [formData, setFormData] = createSignal<Partial<BridgeNetwork>>({
        name: '',
        chainId: 0,
        rpcUrl: '',
        explorerUrl: '',
        vcnTokenAddress: '',
        icon: 'ethereum',
        enabled: false,
        order: 0
    });

    let unsubscribe: (() => void) | null = null;

    onMount(async () => {
        // Initialize default networks if collection is empty
        await initializeBridgeNetworks();

        // Subscribe to networks
        unsubscribe = subscribeToBridgeNetworks((networkList) => {
            setNetworks(networkList);
            setLoading(false);
        });
    });

    onCleanup(() => {
        if (unsubscribe) unsubscribe();
    });

    const resetForm = () => {
        setFormData({
            name: '',
            chainId: 0,
            rpcUrl: '',
            explorerUrl: '',
            vcnTokenAddress: '',
            icon: 'ethereum',
            enabled: false,
            order: networks().length
        });
        setEditingId(null);
        setShowAddForm(false);
    };

    const handleEdit = (network: BridgeNetwork) => {
        setFormData({ ...network });
        setEditingId(network.id || null);
        setShowAddForm(true);
    };

    const handleSave = async () => {
        const data = formData();

        if (!data.name || !data.chainId || !data.rpcUrl) {
            setError('Name, Chain ID, and RPC URL are required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            await saveBridgeNetwork({
                id: editingId() || undefined,
                name: data.name!,
                chainId: data.chainId!,
                rpcUrl: data.rpcUrl!,
                explorerUrl: data.explorerUrl || '',
                vcnTokenAddress: data.vcnTokenAddress || '',
                icon: data.icon || 'ethereum',
                enabled: data.enabled || false,
                order: data.order || 0
            });

            setSuccess(editingId() ? 'Network updated successfully' : 'Network added successfully');
            setTimeout(() => setSuccess(''), 3000);
            resetForm();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (networkId: string) => {
        if (!confirm('Are you sure you want to delete this network?')) return;

        try {
            await deleteBridgeNetwork(networkId);
            setSuccess('Network deleted successfully');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleToggleEnabled = async (network: BridgeNetwork) => {
        try {
            await saveBridgeNetwork({
                ...network,
                enabled: !network.enabled
            });
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div class="space-y-6">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-black tracking-tight">Bridge Networks</h1>
                    <p class="text-sm text-gray-400 mt-1">Manage cross-chain bridge supported networks</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                >
                    <Plus class="w-4 h-4" />
                    Add Network
                </button>
            </div>

            {/* Success/Error Messages */}
            <Show when={success()}>
                <div class="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                    <Check class="w-5 h-5 text-green-400" />
                    <span class="text-green-400 text-sm font-medium">{success()}</span>
                </div>
            </Show>
            <Show when={error()}>
                <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                    <AlertCircle class="w-5 h-5 text-red-400" />
                    <span class="text-red-400 text-sm font-medium">{error()}</span>
                    <button onClick={() => setError('')} class="ml-auto text-red-400 hover:text-red-300">
                        <X class="w-4 h-4" />
                    </button>
                </div>
            </Show>

            {/* Add/Edit Form */}
            <Show when={showAddForm()}>
                <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-lg font-bold">{editingId() ? 'Edit Network' : 'Add New Network'}</h2>
                        <button onClick={resetForm} class="text-gray-400 hover:text-white">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name */}
                        <div>
                            <label class="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Network Name *</label>
                            <input
                                type="text"
                                value={formData().name || ''}
                                onInput={(e) => setFormData({ ...formData(), name: e.currentTarget.value })}
                                placeholder="Ethereum Sepolia"
                                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* Chain ID */}
                        <div>
                            <label class="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Chain ID *</label>
                            <input
                                type="number"
                                value={formData().chainId || ''}
                                onInput={(e) => setFormData({ ...formData(), chainId: parseInt(e.currentTarget.value) || 0 })}
                                placeholder="11155111"
                                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* RPC URL */}
                        <div class="md:col-span-2">
                            <label class="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">RPC URL *</label>
                            <input
                                type="text"
                                value={formData().rpcUrl || ''}
                                onInput={(e) => setFormData({ ...formData(), rpcUrl: e.currentTarget.value })}
                                placeholder="https://ethereum-sepolia-rpc.publicnode.com"
                                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* Explorer URL */}
                        <div>
                            <label class="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Explorer URL</label>
                            <input
                                type="text"
                                value={formData().explorerUrl || ''}
                                onInput={(e) => setFormData({ ...formData(), explorerUrl: e.currentTarget.value })}
                                placeholder="https://sepolia.etherscan.io"
                                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* VCN Token Address */}
                        <div>
                            <label class="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">VCN Token Address</label>
                            <input
                                type="text"
                                value={formData().vcnTokenAddress || ''}
                                onInput={(e) => setFormData({ ...formData(), vcnTokenAddress: e.currentTarget.value })}
                                placeholder="0x..."
                                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-mono focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* Icon */}
                        <div>
                            <label class="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Icon</label>
                            <select
                                value={formData().icon || 'ethereum'}
                                onChange={(e) => setFormData({ ...formData(), icon: e.currentTarget.value })}
                                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500"
                            >
                                <option value="vision">Vision Chain</option>
                                <option value="ethereum">Ethereum</option>
                                <option value="polygon">Polygon</option>
                                <option value="base">Base</option>
                                <option value="arbitrum">Arbitrum</option>
                                <option value="optimism">Optimism</option>
                            </select>
                        </div>

                        {/* Order */}
                        <div>
                            <label class="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Display Order</label>
                            <input
                                type="number"
                                value={formData().order || 0}
                                onInput={(e) => setFormData({ ...formData(), order: parseInt(e.currentTarget.value) || 0 })}
                                placeholder="0"
                                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* Enabled Toggle */}
                        <div class="md:col-span-2 flex items-center gap-3">
                            <button
                                onClick={() => setFormData({ ...formData(), enabled: !formData().enabled })}
                                class={`relative w-12 h-6 rounded-full transition-colors ${formData().enabled ? 'bg-green-500' : 'bg-gray-600'
                                    }`}
                            >
                                <div class={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${formData().enabled ? 'left-7' : 'left-1'
                                    }`} />
                            </button>
                            <span class="text-sm font-medium">
                                {formData().enabled ? 'Enabled' : 'Disabled'}
                            </span>
                            <span class="text-xs text-gray-500">
                                (Disabled networks show as "Coming Soon")
                            </span>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div class="flex gap-3 mt-6 pt-6 border-t border-white/5">
                        <button
                            onClick={handleSave}
                            disabled={saving()}
                            class="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50"
                        >
                            {saving() ? <Loader2 class="w-4 h-4 animate-spin" /> : <Save class="w-4 h-4" />}
                            {editingId() ? 'Update Network' : 'Add Network'}
                        </button>
                        <button
                            onClick={resetForm}
                            class="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </Show>

            {/* Networks List */}
            <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div class="p-4 border-b border-white/[0.06]">
                    <h2 class="font-bold">Configured Networks</h2>
                </div>

                <Show when={loading()}>
                    <div class="p-8 flex items-center justify-center">
                        <Loader2 class="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                </Show>

                <Show when={!loading() && networks().length === 0}>
                    <div class="p-8 text-center">
                        <Network class="w-12 h-12 mx-auto text-gray-600 mb-3" />
                        <p class="text-gray-400">No networks configured</p>
                        <button
                            onClick={() => setShowAddForm(true)}
                            class="mt-4 text-purple-400 hover:text-purple-300 text-sm font-medium"
                        >
                            Add your first network
                        </button>
                    </div>
                </Show>

                <Show when={!loading() && networks().length > 0}>
                    <div class="divide-y divide-white/[0.06]">
                        <For each={networks()}>
                            {(network) => (
                                <div class="p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                    {/* Drag Handle */}
                                    <GripVertical class="w-4 h-4 text-gray-600 cursor-grab" />

                                    {/* Network Icon */}
                                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                                        <Zap class="w-5 h-5 text-purple-400" />
                                    </div>

                                    {/* Network Info */}
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold">{network.name}</span>
                                            <span class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${network.enabled
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {network.enabled ? 'Active' : 'Disabled'}
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                            <span>Chain ID: {network.chainId}</span>
                                            <span class="truncate max-w-[200px]">{network.rpcUrl}</span>
                                        </div>
                                    </div>

                                    {/* VCN Token */}
                                    <Show when={network.vcnTokenAddress}>
                                        <div class="hidden md:block text-xs text-gray-500 font-mono max-w-[120px] truncate">
                                            {network.vcnTokenAddress?.slice(0, 10)}...
                                        </div>
                                    </Show>

                                    {/* Order */}
                                    <div class="text-xs text-gray-500">
                                        #{network.order}
                                    </div>

                                    {/* Actions */}
                                    <div class="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggleEnabled(network)}
                                            class={`p-2 rounded-lg transition-colors ${network.enabled
                                                    ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                                    : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
                                                }`}
                                            title={network.enabled ? 'Disable' : 'Enable'}
                                        >
                                            <Check class="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(network)}
                                            class="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil class="w-4 h-4" />
                                        </button>
                                        <Show when={network.explorerUrl}>
                                            <a
                                                href={network.explorerUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                                                title="Open Explorer"
                                            >
                                                <ExternalLink class="w-4 h-4" />
                                            </a>
                                        </Show>
                                        <button
                                            onClick={() => network.id && handleDelete(network.id)}
                                            class="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 class="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </div>

            {/* Info Card */}
            <div class="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6">
                <h3 class="font-bold text-blue-400 mb-2">How Bridge Networks Work</h3>
                <ul class="text-sm text-gray-400 space-y-1">
                    <li>- **Enabled** networks appear as selectable options in the Bridge UI</li>
                    <li>- **Disabled** networks show as "Coming Soon"</li>
                    <li>- **VCN Token Address** is required for destination chains (where VCN is bridged to)</li>
                    <li>- **Order** determines the display sequence (lower numbers first)</li>
                    <li>- Changes are reflected in real-time on the Bridge page</li>
                </ul>
            </div>
        </div>
    );
};

export default AdminBridgeNetworks;
