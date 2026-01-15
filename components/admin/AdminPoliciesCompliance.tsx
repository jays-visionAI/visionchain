import { Component, createSignal, onMount, For } from 'solid-js';
import { Shield, Ban, CheckCircle, Download, Plus, Search } from 'lucide-solid';

interface PolicyEntry {
    id: string;
    type: 'DENYLIST' | 'ALLOWLIST' | 'KYC_REQUIRED';
    targetType: 'DAPP' | 'USER' | 'ADDRESS';
    targetId: string;
    reason: string;
    addedBy: string;
    addedAt: string;
    expiresAt?: string;
}

const AdminPoliciesCompliance: Component = () => {
    const [policies, setPolicies] = createSignal<PolicyEntry[]>([]);
    const [filter, setFilter] = createSignal<string>('ALL');

    onMount(async () => {
        setPolicies([
            { id: 'p_001', type: 'DENYLIST', targetType: 'DAPP', targetId: 'dapp_malicious', reason: 'Spam attack detected', addedBy: 'admin_jay', addedAt: '2026-01-10' },
            { id: 'p_002', type: 'DENYLIST', targetType: 'ADDRESS', targetId: '0xabc...123', reason: 'OFAC sanctioned', addedBy: 'compliance_bot', addedAt: '2026-01-05' },
            { id: 'p_003', type: 'ALLOWLIST', targetType: 'DAPP', targetId: 'dapp_trusted', reason: 'Partner verification', addedBy: 'admin_jay', addedAt: '2026-01-01' },
            { id: 'p_004', type: 'KYC_REQUIRED', targetType: 'USER', targetId: 'user_highvalue', reason: 'High-value transaction pattern', addedBy: 'fraud_detector', addedAt: '2026-01-12', expiresAt: '2026-02-12' },
        ]);
    });

    const getTypeStyle = (type: string) => ({
        'DENYLIST': 'bg-red-500/20 text-red-400',
        'ALLOWLIST': 'bg-green-500/20 text-green-400',
        'KYC_REQUIRED': 'bg-yellow-500/20 text-yellow-400'
    }[type] || 'bg-gray-500/20 text-gray-400');

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header class="flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                        Policies & Compliance
                    </h1>
                    <p class="text-gray-400 mt-2">Manage denylist, allowlist, and compliance rules</p>
                </div>
                <div class="flex gap-3">
                    <button class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm flex items-center gap-2">
                        <Download class="w-4 h-4" /> Export Audit Log
                    </button>
                    <button class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl text-sm flex items-center gap-2">
                        <Plus class="w-4 h-4" /> Add Policy
                    </button>
                </div>
            </header>

            {/* Filter Tabs */}
            <div class="flex gap-2">
                {['ALL', 'DENYLIST', 'ALLOWLIST', 'KYC_REQUIRED'].map(f => (
                    <button
                        onClick={() => setFilter(f)}
                        class={`px-4 py-2 rounded-lg text-sm font-bold transition ${filter() === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        {f.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div class="flex items-center gap-2 bg-white/5 px-4 py-3 rounded-xl w-full max-w-md">
                <Search class="w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search by target ID, reason, or admin..." class="bg-transparent text-sm flex-1 outline-none" />
            </div>

            {/* Policies Table */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-white/5 text-left text-xs text-gray-400 uppercase">
                        <tr>
                            <th class="p-4">Type</th>
                            <th class="p-4">Target</th>
                            <th class="p-4">Target ID</th>
                            <th class="p-4">Reason</th>
                            <th class="p-4">Added By</th>
                            <th class="p-4">Added At</th>
                            <th class="p-4">Expires</th>
                            <th class="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <For each={policies().filter(p => filter() === 'ALL' || p.type === filter())}>
                            {(policy) => (
                                <tr class="hover:bg-white/[0.02]">
                                    <td class="p-4">
                                        <span class={`px-2 py-1 text-xs font-bold rounded ${getTypeStyle(policy.type)}`}>
                                            {policy.type === 'DENYLIST' && <Ban class="w-3 h-3 inline mr-1" />}
                                            {policy.type === 'ALLOWLIST' && <CheckCircle class="w-3 h-3 inline mr-1" />}
                                            {policy.type === 'KYC_REQUIRED' && <Shield class="w-3 h-3 inline mr-1" />}
                                            {policy.type}
                                        </span>
                                    </td>
                                    <td class="p-4 text-gray-400">{policy.targetType}</td>
                                    <td class="p-4 font-mono text-xs">{policy.targetId}</td>
                                    <td class="p-4">{policy.reason}</td>
                                    <td class="p-4 text-gray-400">{policy.addedBy}</td>
                                    <td class="p-4 text-gray-500">{policy.addedAt}</td>
                                    <td class="p-4 text-gray-500">{policy.expiresAt || '-'}</td>
                                    <td class="p-4">
                                        <button class="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 rounded-lg">Edit</button>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminPoliciesCompliance;
