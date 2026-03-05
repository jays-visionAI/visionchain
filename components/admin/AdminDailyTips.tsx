import { createSignal, onMount, For, Show } from 'solid-js';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, getFirestore, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from '../../services/firebaseService';

interface DailyTip {
    id: string;
    title: string;
    body: string;
    targetView: string;
    order: number;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
}

const TARGET_VIEW_OPTIONS = [
    { value: 'quest', label: 'Quest' },
    { value: 'referral', label: 'Referral' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'cex', label: 'CEX Portfolio' },
    { value: 'nodes', label: 'Nodes' },
    { value: 'disk', label: 'Disk' },
    { value: 'market', label: 'Market' },
    { value: 'insight', label: 'Vision Insight' },
    { value: 'chat', label: 'Chat' },
    { value: 'assets', label: 'Assets' },
    { value: 'profile', label: 'Profile' },
    { value: 'settings', label: 'Settings' },
    { value: 'staking', label: 'Staking' },
    { value: 'send', label: 'Send' },
    { value: 'bridge', label: 'Bridge' },
];

export default function AdminDailyTips() {
    const [tips, setTips] = createSignal<DailyTip[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [showModal, setShowModal] = createSignal(false);
    const [editingTip, setEditingTip] = createSignal<DailyTip | null>(null);
    const [deleteTarget, setDeleteTarget] = createSignal<DailyTip | null>(null);
    const [saving, setSaving] = createSignal(false);

    // Form state
    const [formTitle, setFormTitle] = createSignal('');
    const [formBody, setFormBody] = createSignal('');
    const [formTargetView, setFormTargetView] = createSignal('quest');
    const [formOrder, setFormOrder] = createSignal(1);
    const [formEnabled, setFormEnabled] = createSignal(true);

    const db = () => getFirestore(getFirebaseApp());

    const loadTips = async () => {
        setLoading(true);
        try {
            const q = query(collection(db(), 'daily_tips'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            const loaded: DailyTip[] = [];
            snapshot.forEach(d => {
                loaded.push({ id: d.id, ...d.data() } as DailyTip);
            });
            setTips(loaded);
        } catch (e) {
            console.error('[AdminDailyTips] Failed to load:', e);
        } finally {
            setLoading(false);
        }
    };

    onMount(loadTips);

    const openCreate = () => {
        setEditingTip(null);
        setFormTitle('');
        setFormBody('');
        setFormTargetView('quest');
        setFormOrder(tips().length + 1);
        setFormEnabled(true);
        setShowModal(true);
    };

    const openEdit = (tip: DailyTip) => {
        setEditingTip(tip);
        setFormTitle(tip.title);
        setFormBody(tip.body);
        setFormTargetView(tip.targetView);
        setFormOrder(tip.order);
        setFormEnabled(tip.enabled);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formTitle().trim()) return;
        setSaving(true);
        try {
            const now = Date.now();
            const existing = editingTip();
            const tipId = existing?.id || `tip_${now}`;
            const data: Omit<DailyTip, 'id'> = {
                title: formTitle().trim(),
                body: formBody().trim(),
                targetView: formTargetView(),
                order: formOrder(),
                enabled: formEnabled(),
                createdAt: existing?.createdAt || now,
                updatedAt: now,
            };
            await setDoc(doc(db(), 'daily_tips', tipId), data);
            setShowModal(false);
            await loadTips();
        } catch (e) {
            console.error('[AdminDailyTips] Save failed:', e);
            alert('Failed to save tip.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const target = deleteTarget();
        if (!target) return;
        setSaving(true);
        try {
            await deleteDoc(doc(db(), 'daily_tips', target.id));
            setDeleteTarget(null);
            await loadTips();
        } catch (e) {
            console.error('[AdminDailyTips] Delete failed:', e);
            alert('Failed to delete tip.');
        } finally {
            setSaving(false);
        }
    };

    const toggleEnabled = async (tip: DailyTip) => {
        try {
            await setDoc(doc(db(), 'daily_tips', tip.id), {
                ...tip,
                enabled: !tip.enabled,
                updatedAt: Date.now(),
            });
            await loadTips();
        } catch (e) {
            console.error('[AdminDailyTips] Toggle failed:', e);
        }
    };

    const [seeding, setSeeding] = createSignal(false);

    const DEFAULT_TIPS = [
        { id: 'tip_1', title: 'Did you know you have a referral code? Join the Referral Rush quest!', body: '', targetView: 'quest', order: 1 },
        { id: 'tip_2', title: 'Did you know you get rewards for inviting with your referral code?', body: 'Invite friends and earn rewards together.', targetView: 'referral', order: 2 },
        { id: 'tip_3', title: 'Did you know you earn RP rewards for participating in Vision Chain testing?', body: '', targetView: 'quest', order: 3 },
        { id: 'tip_4', title: 'Did you know RP can be exchanged for VCN?', body: 'Convert your earned RP into VCN tokens through activities.', targetView: 'quest', order: 4 },
        { id: 'tip_5', title: 'Your referral code earns you rewards from both direct and indirect members\' activity.', body: '', targetView: 'referral', order: 5 },
        { id: 'tip_6', title: 'What activities earn RP rewards?', body: 'Check out the various reward activities in the Quest menu.', targetView: 'quest', order: 6 },
        { id: 'tip_7', title: 'Did you know you can send coins by name after adding contacts?', body: 'Send easily by name instead of complex wallet addresses.', targetView: 'contacts', order: 7 },
        { id: 'tip_8', title: 'Did you know Vision Chain connects with centralized exchanges like Upbit and Bithumb?', body: '', targetView: 'cex', order: 8 },
        { id: 'tip_9', title: 'Did you know you can earn revenue by running a node on your device?', body: 'Install a Vision Node and earn rewards for contributing to the network.', targetView: 'nodes', order: 9 },
        { id: 'tip_10', title: 'Did you know you can encrypt and store your important files on Disk?', body: '', targetView: 'disk', order: 10 },
        { id: 'tip_11', title: 'Did you know you can upload content to Disk and sell it on Market?', body: 'Monetize your digital content.', targetView: 'market', order: 11 },
        { id: 'tip_12', title: 'Did you know you can upload your mnemonic recovery phrase to the cloud?', body: 'Safely back up your recovery phrase in Settings.', targetView: 'settings', order: 12 },
        { id: 'tip_13', title: 'Transaction history follows corporate accounting standards with 100% chart-of-accounts coverage.', body: '', targetView: 'assets', order: 13 },
        { id: 'tip_14', title: 'Vision Insight delivers daily crypto market news updates to keep you informed.', body: '', targetView: 'insight', order: 14 },
        { id: 'tip_15', title: 'Ask Vision AI in Chat how to use Vision Chain!', body: 'Let AI manage your portfolio and investment strategy.', targetView: 'chat', order: 15 },
    ];

    const seedDefaultTips = async () => {
        if (!confirm('Seed 15 default tips? This will not overwrite existing tips with the same IDs.')) return;
        setSeeding(true);
        try {
            const now = Date.now();
            for (const tip of DEFAULT_TIPS) {
                const { id, ...data } = tip;
                await setDoc(doc(db(), 'daily_tips', id), { ...data, enabled: true, createdAt: now, updatedAt: now });
            }
            await loadTips();
        } catch (e) {
            console.error('[AdminDailyTips] Seed failed:', e);
            alert('Seed failed: ' + (e as Error).message);
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div class="p-6 space-y-6 max-w-6xl">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-white">Daily Tips</h1>
                    <p class="text-sm text-gray-400 mt-1">Manage daily tips shown to wallet users on the chat screen</p>
                </div>
                <button
                    onClick={openCreate}
                    class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
                >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add Tip
                </button>
            </div>

            {/* Stats */}
            <div class="grid grid-cols-3 gap-4">
                <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                    <div class="text-2xl font-black text-white">{tips().length}</div>
                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Total Tips</div>
                </div>
                <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                    <div class="text-2xl font-black text-green-400">{tips().filter(t => t.enabled).length}</div>
                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Active</div>
                </div>
                <div class="bg-[#111113] border border-white/5 rounded-xl p-4">
                    <div class="text-2xl font-black text-gray-500">{tips().filter(t => !t.enabled).length}</div>
                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Disabled</div>
                </div>
            </div>

            {/* Tips Table */}
            <div class="bg-[#111113] border border-white/5 rounded-xl overflow-hidden">
                <Show when={loading()}>
                    <div class="p-12 text-center">
                        <div class="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto" />
                        <p class="text-gray-500 text-sm mt-3">Loading tips...</p>
                    </div>
                </Show>

                <Show when={!loading() && tips().length === 0}>
                    <div class="p-12 text-center">
                        <svg class="w-12 h-12 text-gray-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                            <path d="M9 18h6" /><path d="M10 22h4" />
                        </svg>
                        <p class="text-gray-500 text-sm font-bold">No tips yet</p>
                        <p class="text-gray-600 text-xs mt-1">Click "Add Tip" to create your first daily tip.</p>
                        <button
                            onClick={seedDefaultTips}
                            disabled={seeding()}
                            class="mt-4 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 mx-auto"
                        >
                            <Show when={seeding()}>
                                <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </Show>
                            {seeding() ? 'Seeding...' : 'Seed Default Tips (15)'}
                        </button>
                    </div>
                </Show>

                <Show when={!loading() && tips().length > 0}>
                    <table class="w-full">
                        <thead>
                            <tr class="border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                <th class="px-4 py-3 text-left w-12">#</th>
                                <th class="px-4 py-3 text-left">Title</th>
                                <th class="px-4 py-3 text-left w-32">Target</th>
                                <th class="px-4 py-3 text-center w-20">Status</th>
                                <th class="px-4 py-3 text-right w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={tips()}>
                                {(tip) => (
                                    <tr class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                        <td class="px-4 py-3 text-[12px] font-bold text-gray-500">{tip.order}</td>
                                        <td class="px-4 py-3">
                                            <div class="text-[13px] font-bold text-gray-100 truncate max-w-[400px]">{tip.title}</div>
                                            <Show when={tip.body}>
                                                <div class="text-[11px] text-gray-500 truncate max-w-[400px] mt-0.5">{tip.body}</div>
                                            </Show>
                                        </td>
                                        <td class="px-4 py-3">
                                            <span class="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md uppercase">
                                                {tip.targetView}
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            <button
                                                onClick={() => toggleEnabled(tip)}
                                                class={`w-10 h-5 rounded-full relative transition-colors ${tip.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                            >
                                                <div class={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${tip.enabled ? 'left-5' : 'left-0.5'}`} />
                                            </button>
                                        </td>
                                        <td class="px-4 py-3 text-right">
                                            <div class="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openEdit(tip)}
                                                    class="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                                                    title="Edit"
                                                >
                                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(tip)}
                                                    class="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Delete"
                                                >
                                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </Show>
            </div>

            {/* Create/Edit Modal */}
            <Show when={showModal()}>
                <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div class="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div class="p-5 border-b border-white/5">
                            <h3 class="text-lg font-bold text-white">{editingTip() ? 'Edit Tip' : 'New Tip'}</h3>
                        </div>
                        <div class="p-5 space-y-4">
                            {/* Title */}
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Title *</label>
                                <input
                                    type="text"
                                    value={formTitle()}
                                    onInput={(e) => setFormTitle(e.currentTarget.value)}
                                    placeholder="Enter tip title..."
                                    class="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/50 transition-colors"
                                />
                            </div>
                            {/* Body */}
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Body (optional)</label>
                                <textarea
                                    value={formBody()}
                                    onInput={(e) => setFormBody(e.currentTarget.value)}
                                    placeholder="Additional description..."
                                    rows={2}
                                    class="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/50 transition-colors resize-none"
                                />
                            </div>
                            {/* Target View */}
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Target View</label>
                                <select
                                    value={formTargetView()}
                                    onChange={(e) => setFormTargetView(e.currentTarget.value)}
                                    class="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50 transition-colors"
                                >
                                    <For each={TARGET_VIEW_OPTIONS}>
                                        {(opt) => <option value={opt.value}>{opt.label}</option>}
                                    </For>
                                </select>
                            </div>
                            {/* Order + Enabled Row */}
                            <div class="flex gap-4">
                                <div class="flex-1">
                                    <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Order</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={formOrder()}
                                        onInput={(e) => setFormOrder(parseInt(e.currentTarget.value) || 1)}
                                        class="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50 transition-colors"
                                    />
                                </div>
                                <div class="flex-1">
                                    <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Enabled</label>
                                    <button
                                        onClick={() => setFormEnabled(!formEnabled())}
                                        class={`w-full py-2.5 rounded-xl text-sm font-bold border transition-colors ${formEnabled()
                                            ? 'bg-green-500/15 border-green-500/30 text-green-400'
                                            : 'bg-gray-500/15 border-gray-500/30 text-gray-400'}`}
                                    >
                                        {formEnabled() ? 'Active' : 'Disabled'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        {/* Modal Actions */}
                        <div class="p-5 border-t border-white/5 flex justify-end gap-2">
                            <button
                                onClick={() => setShowModal(false)}
                                class="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving() || !formTitle().trim()}
                                class="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
                            >
                                <Show when={saving()}>
                                    <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                </Show>
                                {editingTip() ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Delete Confirmation */}
            <Show when={deleteTarget()}>
                <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
                    <div class="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                <svg class="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-white">Delete Tip</h3>
                                <p class="text-xs text-gray-500">This action cannot be undone.</p>
                            </div>
                        </div>
                        <p class="text-sm text-gray-300 mb-5 bg-white/[0.03] border border-white/5 rounded-xl p-3">
                            "{deleteTarget()!.title}"
                        </p>
                        <div class="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                class="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={saving()}
                                class="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}
