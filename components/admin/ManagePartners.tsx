import { createSignal, createResource, For, Show } from 'solid-js';
import { getPartners, savePartner, deletePartner, Partner } from '../../services/firebaseService';
import { Plus, Trash2, Edit2 } from 'lucide-solid';

export const ManagePartners = () => {
    const [partners, { refetch }] = createResource(getPartners);
    const [isModalOpen, setIsModalOpen] = createSignal(false);
    const [editingPartner, setEditingPartner] = createSignal<Partial<Partner>>({});

    const handleSave = async () => {
        const p = editingPartner();
        if (!p.code || !p.name) return;

        await savePartner({
            code: p.code,
            name: p.name,
            country: p.country,
            remark: p.remark
        });

        setIsModalOpen(false);
        setEditingPartner({});
        refetch();
    };

    const handleDelete = async (code: string) => {
        if (confirm(`Delete partner ${code}?`)) {
            await deletePartner(code);
            refetch();
        }
    };

    const openEdit = (partner: Partner) => {
        setEditingPartner({ ...partner });
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingPartner({ code: '', name: '', country: '', remark: '' });
        setIsModalOpen(true);
    };

    return (
        <div class="space-y-6">
            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-xl font-bold text-white">Partner Management</h2>
                </div>
                <button
                    onClick={openNew}
                    class="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                    <Plus class="w-4 h-4" />
                    Add Partner
                </button>
            </div>

            <div class="bg-[#0B0E14] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                <table class="w-full text-left">
                    <thead class="bg-white/5 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                        <tr>
                            <th class="p-4">#</th>
                            <th class="p-4">Partner Code</th>
                            <th class="p-4">Registration Date</th>
                            <th class="p-4">Country</th>
                            <th class="p-4">Remark</th>
                            <th class="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <For each={partners()}>
                            {(partner, i) => (
                                <tr class="hover:bg-white/5 transition-colors">
                                    <td class="p-4 text-gray-600 font-mono text-xs">{i() + 1}</td>
                                    <td class="p-4">
                                        <span class="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[10px] font-black uppercase tracking-widest">
                                            {partner.code}
                                        </span>
                                    </td>
                                    <td class="p-4 text-gray-300 text-xs">{new Date(partner.createdAt).toLocaleDateString()}</td>
                                    <td class="p-4 text-gray-300 text-xs">{partner.country || '-'}</td>
                                    <td class="p-4 text-gray-400 text-xs italic">{partner.remark || '-'}</td>
                                    <td class="p-4 text-right flex items-center justify-end gap-2">
                                        <button onClick={() => openEdit(partner)} class="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                            <Edit2 class="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(partner.code)} class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </For>
                        <Show when={!partners()?.length}>
                            <tr><td colspan="6" class="p-8 text-center text-gray-500 text-xs uppercase tracking-widest">No partners found</td></tr>
                        </Show>
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <Show when={isModalOpen()}>
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div class="bg-[#0B0E14] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
                        <h3 class="text-lg font-bold text-white mb-6 uppercase tracking-tight">
                            {editingPartner().createdAt ? 'Edit Partner' : 'Add New Partner'}
                        </h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Partner Code</label>
                                <input
                                    type="text"
                                    value={editingPartner().code || ''}
                                    onInput={(e) => setEditingPartner({ ...editingPartner(), code: e.currentTarget.value.toUpperCase() })}
                                    disabled={!!editingPartner().createdAt}
                                    class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-blue-500 outline-none disabled:opacity-50"
                                    placeholder="e.g. KR001"
                                />
                            </div>
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Partner Name</label>
                                <input
                                    type="text"
                                    value={editingPartner().name || ''}
                                    onInput={(e) => setEditingPartner({ ...editingPartner(), name: e.currentTarget.value })}
                                    class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-blue-500 outline-none"
                                    placeholder="e.g. Samsung"
                                />
                            </div>
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Country</label>
                                <input
                                    type="text"
                                    value={editingPartner().country || ''}
                                    onInput={(e) => setEditingPartner({ ...editingPartner(), country: e.currentTarget.value })}
                                    class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-blue-500 outline-none"
                                    placeholder="e.g. South Korea"
                                />
                            </div>
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Remark</label>
                                <input
                                    type="text"
                                    value={editingPartner().remark || ''}
                                    onInput={(e) => setEditingPartner({ ...editingPartner(), remark: e.currentTarget.value })}
                                    class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-blue-500 outline-none"
                                    placeholder="Optional notes"
                                />
                            </div>
                        </div>
                        <div class="flex gap-3 mt-8">
                            <button onClick={() => setIsModalOpen(false)} class="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg shadow-blue-500/20">
                                Save Partner
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};
