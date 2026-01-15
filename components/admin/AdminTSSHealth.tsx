import { Component, createSignal, onMount, For } from 'solid-js';
import { Key, Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-solid';

interface TSSNode {
    nodeId: string;
    name: string;
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    lastHeartbeat: string;
    role: 'SIGNER' | 'BACKUP';
    keyShards: number;
}

interface KeySet {
    keyId: string;
    purpose: string;
    threshold: string;
    activeSigners: number;
    totalSigners: number;
    lastRotation: string;
    nextRotation: string;
}

const AdminTSSHealth: Component = () => {
    const [nodes, setNodes] = createSignal<TSSNode[]>([]);
    const [keySets, setKeySets] = createSignal<KeySet[]>([]);

    onMount(async () => {
        setNodes([
            { nodeId: 'tss_node_1', name: 'TSS Signer A (Primary)', status: 'HEALTHY', lastHeartbeat: '2s ago', role: 'SIGNER', keyShards: 2 },
            { nodeId: 'tss_node_2', name: 'TSS Signer B', status: 'HEALTHY', lastHeartbeat: '3s ago', role: 'SIGNER', keyShards: 2 },
            { nodeId: 'tss_node_3', name: 'TSS Signer C', status: 'DEGRADED', lastHeartbeat: '45s ago', role: 'SIGNER', keyShards: 2 },
            { nodeId: 'tss_node_4', name: 'TSS Backup D', status: 'HEALTHY', lastHeartbeat: '1s ago', role: 'BACKUP', keyShards: 1 },
            { nodeId: 'tss_node_5', name: 'TSS Backup E', status: 'DOWN', lastHeartbeat: '5m ago', role: 'BACKUP', keyShards: 0 },
        ]);
        setKeySets([
            { keyId: 'master_vault_key', purpose: 'Grand Vault Operations', threshold: '3-of-5', activeSigners: 4, totalSigners: 5, lastRotation: '2026-01-01', nextRotation: '2026-04-01' },
            { keyId: 'eth_gas_key', purpose: 'Ethereum Gas Account', threshold: '2-of-3', activeSigners: 3, totalSigners: 3, lastRotation: '2026-01-10', nextRotation: '2026-04-10' },
            { keyId: 'polygon_gas_key', purpose: 'Polygon Gas Account', threshold: '2-of-3', activeSigners: 3, totalSigners: 3, lastRotation: '2026-01-10', nextRotation: '2026-04-10' },
        ]);
    });

    const getStatusIcon = (status: string) => {
        if (status === 'HEALTHY') return <CheckCircle class="w-4 h-4 text-green-400" />;
        if (status === 'DEGRADED') return <AlertTriangle class="w-4 h-4 text-yellow-400" />;
        return <XCircle class="w-4 h-4 text-red-400" />;
    };

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header>
                <h1 class="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    TSS / KeyOps Health
                </h1>
                <p class="text-gray-400 mt-2">Threshold Signature Scheme node & key management</p>
            </header>

            {/* Summary */}
            <div class="grid grid-cols-4 gap-6">
                <div class="p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div class="text-sm text-green-400">Healthy Nodes</div>
                    <div class="text-3xl font-bold mt-1">3 / 5</div>
                </div>
                <div class="p-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <div class="text-sm text-yellow-400">Degraded</div>
                    <div class="text-3xl font-bold mt-1">1</div>
                </div>
                <div class="p-6 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div class="text-sm text-red-400">Down</div>
                    <div class="text-3xl font-bold mt-1">1</div>
                </div>
                <div class="p-6 rounded-xl bg-white/5 border border-white/10">
                    <div class="text-sm text-gray-400">Active Key Sets</div>
                    <div class="text-3xl font-bold mt-1">3</div>
                </div>
            </div>

            {/* Nodes */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 class="text-lg font-bold flex items-center gap-2"><Shield class="w-5 h-5" /> TSS Nodes</h2>
                    <button class="text-xs text-gray-400 hover:text-white flex items-center gap-1"><RefreshCw class="w-3 h-3" /> Refresh</button>
                </div>
                <div class="divide-y divide-white/5">
                    <For each={nodes()}>
                        {(node) => (
                            <div class="p-4 flex items-center gap-6">
                                {getStatusIcon(node.status)}
                                <div class="flex-1">
                                    <div class="font-bold">{node.name}</div>
                                    <div class="text-xs text-gray-500">{node.nodeId}</div>
                                </div>
                                <div class="text-xs text-gray-400">{node.role}</div>
                                <div class="text-xs text-gray-400">Shards: {node.keyShards}</div>
                                <div class="text-xs text-gray-500">Last: {node.lastHeartbeat}</div>
                                <span class={`px-2 py-1 text-xs font-bold rounded-md ${node.status === 'HEALTHY' ? 'bg-green-500/20 text-green-400' :
                                        node.status === 'DEGRADED' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                    }`}>{node.status}</span>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* Key Sets */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="p-4 border-b border-white/5">
                    <h2 class="text-lg font-bold flex items-center gap-2"><Key class="w-5 h-5" /> Key Sets</h2>
                </div>
                <table class="w-full text-sm">
                    <thead class="bg-white/5 text-left text-xs text-gray-400 uppercase">
                        <tr>
                            <th class="p-4">Key ID</th>
                            <th class="p-4">Purpose</th>
                            <th class="p-4">Threshold</th>
                            <th class="p-4">Active Signers</th>
                            <th class="p-4">Last Rotation</th>
                            <th class="p-4">Next Rotation</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <For each={keySets()}>
                            {(key) => (
                                <tr class="hover:bg-white/[0.02]">
                                    <td class="p-4 font-mono text-xs">{key.keyId}</td>
                                    <td class="p-4">{key.purpose}</td>
                                    <td class="p-4 font-bold text-blue-400">{key.threshold}</td>
                                    <td class="p-4">
                                        <span class={key.activeSigners >= parseInt(key.threshold.split('-')[0]) ? 'text-green-400' : 'text-red-400'}>
                                            {key.activeSigners} / {key.totalSigners}
                                        </span>
                                    </td>
                                    <td class="p-4 text-gray-500">{key.lastRotation}</td>
                                    <td class="p-4 text-gray-500">{key.nextRotation}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminTSSHealth;
