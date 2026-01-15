import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { Plus, Settings, Power, AlertCircle, ChevronRight } from 'lucide-solid';

interface PaymasterInstance {
    instanceId: string;
    chainId: number;
    chainName: string;
    sponsorMode: boolean;
    perTxCap: string;
    perUserCap: string;
    dailyCap: string;
    allowedTokens: string[];
    status: 'NORMAL' | 'RESTRICTED' | 'PAUSED';
    statusReason?: string;
}

const DevPaymasterInstances: Component = () => {
    const [instances, setInstances] = createSignal<PaymasterInstance[]>([]);
    const [showCreateModal, setShowCreateModal] = createSignal(false);

    onMount(async () => {
        setInstances([
            { instanceId: 'inst_001', chainId: 1, chainName: 'Ethereum', sponsorMode: true, perTxCap: '0.05 ETH', perUserCap: '0.5 ETH', dailyCap: '10 ETH', allowedTokens: ['USDT', 'USDC', 'VCN'], status: 'NORMAL' },
            { instanceId: 'inst_002', chainId: 137, chainName: 'Polygon', sponsorMode: true, perTxCap: '5 MATIC', perUserCap: '50 MATIC', dailyCap: '500 MATIC', allowedTokens: ['USDT', 'USDC'], status: 'NORMAL' },
            { instanceId: 'inst_003', chainId: 3151909, chainName: 'Vision Chain', sponsorMode: true, perTxCap: '100 VCN', perUserCap: '1000 VCN', dailyCap: '10000 VCN', allowedTokens: ['VCN'], status: 'NORMAL' },
            { instanceId: 'inst_004', chainId: 42161, chainName: 'Arbitrum', sponsorMode: false, perTxCap: '-', perUserCap: '-', dailyCap: '-', allowedTokens: [], status: 'PAUSED', statusReason: 'CAP_EXCEEDED' },
        ]);
    });

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header class="flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold">Paymaster Instances</h1>
                    <p class="text-gray-400 mt-2">Manage sponsorship settings per chain</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold flex items-center gap-2">
                    <Plus class="w-4 h-4" /> Create Instance
                </button>
            </header>

            {/* Instances Grid */}
            <div class="grid grid-cols-2 gap-6">
                <For each={instances()}>
                    {(inst) => (
                        <div class={`p-6 rounded-2xl border transition ${inst.status === 'PAUSED' ? 'bg-red-900/10 border-red-500/30' : 'bg-white/5 border-white/10 hover:border-blue-500/30'}`}>
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h3 class="text-xl font-bold">{inst.chainName}</h3>
                                    <p class="text-xs text-gray-500">{inst.instanceId}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class={`px-2 py-1 text-xs font-bold rounded ${inst.sponsorMode ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                        Sponsor {inst.sponsorMode ? 'ON' : 'OFF'}
                                    </span>
                                    <button class="p-2 hover:bg-white/10 rounded-lg transition">
                                        <Settings class="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            <Show when={inst.status === 'PAUSED'}>
                                <div class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-400">
                                    <AlertCircle class="w-4 h-4" /> {inst.statusReason || 'Instance Paused'}
                                </div>
                            </Show>

                            <div class="grid grid-cols-3 gap-4 text-sm mb-4">
                                <div>
                                    <div class="text-xs text-gray-400">Per-Tx Cap</div>
                                    <div class="font-mono">{inst.perTxCap}</div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-400">Per-User Cap</div>
                                    <div class="font-mono">{inst.perUserCap}</div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-400">Daily Cap</div>
                                    <div class="font-mono">{inst.dailyCap}</div>
                                </div>
                            </div>

                            <div class="mb-4">
                                <div class="text-xs text-gray-400 mb-2">Allowed Tokens</div>
                                <div class="flex gap-2 flex-wrap">
                                    <For each={inst.allowedTokens}>
                                        {(token) => (
                                            <span class="px-2 py-1 text-xs bg-white/5 rounded">{token}</span>
                                        )}
                                    </For>
                                    {inst.allowedTokens.length === 0 && <span class="text-gray-500 text-xs">None</span>}
                                </div>
                            </div>

                            <div class="flex gap-2">
                                <button class="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition flex items-center justify-center gap-1">
                                    <Power class="w-3 h-3" /> {inst.sponsorMode ? 'Disable' : 'Enable'}
                                </button>
                                <button class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition">
                                    View Logs <ChevronRight class="w-3 h-3 inline" />
                                </button>
                            </div>
                        </div>
                    )}
                </For>
            </div>

            {/* Create Modal Placeholder */}
            <Show when={showCreateModal()}>
                <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
                    <div class="bg-[#1E293B] p-8 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h2 class="text-2xl font-bold mb-6">Create Paymaster Instance</h2>
                        <select class="w-full p-3 bg-black/30 border border-white/10 rounded-xl mb-4">
                            <option>Select Chain...</option>
                            <option value="10">Optimism</option>
                            <option value="8453">Base</option>
                        </select>
                        <button class="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold">Create Instance</button>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default DevPaymasterInstances;
