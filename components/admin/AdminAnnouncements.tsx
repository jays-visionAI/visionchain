import { createSignal, For, Show, createEffect, onCleanup } from 'solid-js';
import {
    Megaphone,
    Plus,
    Edit3,
    Trash2,
    X,
    Save,
    AlertTriangle,
    Info,
    ShieldAlert,
    Wrench,
    Sparkles,
    Eye,
    EyeOff,
    Calendar,
    Clock,
    ExternalLink,
    Check
} from 'lucide-solid';
import {
    GlobalAnnouncement,
    getAllAnnouncementsAdmin,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
} from '../../services/firebaseService';
import { useAuth } from '../auth/authContext';

export function AdminAnnouncements() {
    const auth = useAuth();
    const [announcements, setAnnouncements] = createSignal<GlobalAnnouncement[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isModalOpen, setIsModalOpen] = createSignal(false);
    const [editingId, setEditingId] = createSignal<string | null>(null);
    const [saving, setSaving] = createSignal(false);

    // Form state
    const [formTitle, setFormTitle] = createSignal('');
    const [formContent, setFormContent] = createSignal('');
    const [formType, setFormType] = createSignal<GlobalAnnouncement['type']>('info');
    const [formPriority, setFormPriority] = createSignal<GlobalAnnouncement['priority']>('normal');
    const [formIsActive, setFormIsActive] = createSignal(true);
    const [formActionUrl, setFormActionUrl] = createSignal('');
    const [formActionLabel, setFormActionLabel] = createSignal('');

    // Load announcements
    const loadAnnouncements = async () => {
        setIsLoading(true);
        const data = await getAllAnnouncementsAdmin();
        setAnnouncements(data);
        setIsLoading(false);
    };

    createEffect(() => {
        loadAnnouncements();
    });

    // Reset form
    const resetForm = () => {
        setFormTitle('');
        setFormContent('');
        setFormType('info');
        setFormPriority('normal');
        setFormIsActive(true);
        setFormActionUrl('');
        setFormActionLabel('');
        setEditingId(null);
    };

    // Open modal for new announcement
    const openNewModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    // Open modal for editing
    const openEditModal = (item: GlobalAnnouncement) => {
        setFormTitle(item.title);
        setFormContent(item.content);
        setFormType(item.type);
        setFormPriority(item.priority);
        setFormIsActive(item.isActive);
        setFormActionUrl(item.actionUrl || '');
        setFormActionLabel(item.actionLabel || '');
        setEditingId(item.id!);
        setIsModalOpen(true);
    };

    // Save announcement
    const handleSave = async () => {
        if (!formTitle().trim() || !formContent().trim()) {
            alert('Title and content are required');
            return;
        }

        setSaving(true);
        try {
            const url = formActionUrl().trim();
            const label = formActionLabel().trim();
            const data: Omit<GlobalAnnouncement, 'id' | 'createdAt'> = {
                title: formTitle().trim(),
                content: formContent().trim(),
                type: formType(),
                priority: formPriority(),
                isActive: formIsActive(),
                createdBy: auth.user()?.email || 'admin',
                ...(url ? { actionUrl: url } : {}),
                ...(label ? { actionLabel: label } : {}),
            };

            if (editingId()) {
                await updateAnnouncement(editingId()!, data);
            } else {
                await createAnnouncement(data);
            }

            setIsModalOpen(false);
            resetForm();
            await loadAnnouncements();
        } catch (e) {
            console.error('Save error:', e);
            alert('Failed to save announcement');
        } finally {
            setSaving(false);
        }
    };

    // Delete announcement
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;

        try {
            await deleteAnnouncement(id);
            await loadAnnouncements();
        } catch (e) {
            console.error('Delete error:', e);
            alert('Failed to delete announcement');
        }
    };

    // Toggle active status
    const handleToggleActive = async (item: GlobalAnnouncement) => {
        try {
            await updateAnnouncement(item.id!, { isActive: !item.isActive });
            await loadAnnouncements();
        } catch (e) {
            console.error('Toggle error:', e);
        }
    };

    // Type meta
    const getTypeMeta = (type: GlobalAnnouncement['type']) => {
        switch (type) {
            case 'info':
                return { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Info' };
            case 'warning':
                return { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Warning' };
            case 'critical':
                return { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Critical' };
            case 'maintenance':
                return { icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Maintenance' };
            case 'feature':
                return { icon: Sparkles, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'New Feature' };
            default:
                return { icon: Megaphone, color: 'text-gray-400', bg: 'bg-gray-400/10', label: 'Announcement' };
        }
    };

    // Format date
    const formatDate = (ts: any) => {
        if (!ts) return 'Unknown';
        const date = ts?.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div class="min-h-screen bg-[#0A0A0B] p-6 lg:p-8">
            <div class="max-w-6xl mx-auto">
                {/* Header */}
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 class="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <Megaphone class="w-7 h-7 text-purple-400" />
                            System Announcements
                        </h1>
                        <p class="text-sm text-gray-500 mt-1">Manage global announcements visible to all users</p>
                    </div>
                    <button
                        onClick={openNewModal}
                        class="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all"
                    >
                        <Plus class="w-4 h-4" />
                        New Announcement
                    </button>
                </div>

                {/* Announcements List */}
                <Show when={!isLoading()} fallback={
                    <div class="flex items-center justify-center py-20">
                        <div class="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                }>
                    <div class="space-y-4">
                        <For each={announcements()} fallback={
                            <div class="text-center py-20 text-gray-500">
                                <Megaphone class="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p class="font-bold">No announcements yet</p>
                                <p class="text-sm mt-1">Create your first announcement to get started</p>
                            </div>
                        }>
                            {(item) => {
                                const meta = getTypeMeta(item.type);
                                return (
                                    <div class={`p-6 rounded-2xl border ${item.isActive ? 'bg-white/[0.02] border-white/10' : 'bg-gray-900/50 border-gray-800 opacity-60'}`}>
                                        <div class="flex items-start justify-between gap-4">
                                            <div class="flex items-start gap-4 flex-1">
                                                <div class={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${meta.bg}`}>
                                                    <meta.icon class={`w-6 h-6 ${meta.color}`} />
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span class={`text-[10px] font-black uppercase tracking-widest ${meta.color}`}>
                                                            {meta.label}
                                                        </span>
                                                        <span class={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${item.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                                                            item.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                                                item.priority === 'low' ? 'bg-gray-500/20 text-gray-400' :
                                                                    'bg-blue-500/20 text-blue-400'
                                                            }`}>
                                                            {item.priority}
                                                        </span>
                                                        {!item.isActive && (
                                                            <span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 class="text-lg font-bold text-white mb-1">{item.title}</h3>
                                                    <p class="text-sm text-gray-400 line-clamp-2">{item.content}</p>
                                                    <div class="flex items-center gap-4 mt-3 text-[11px] text-gray-600">
                                                        <span class="flex items-center gap-1">
                                                            <Calendar class="w-3 h-3" />
                                                            {formatDate(item.createdAt)}
                                                        </span>
                                                        <span>by {item.createdBy}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleToggleActive(item)}
                                                    class={`p-2 rounded-lg border transition-all ${item.isActive ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'}`}
                                                    title={item.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    {item.isActive ? <Eye class="w-4 h-4" /> : <EyeOff class="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(item)}
                                                    class="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit3 class="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id!)}
                                                    class="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 class="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </Show>
            </div>

            {/* Modal */}
            <Show when={isModalOpen()}>
                <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div
                        class="bg-[#111] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div class="p-6 border-b border-white/10 flex items-center justify-between">
                            <h2 class="text-xl font-black text-white uppercase tracking-tight">
                                {editingId() ? 'Edit Announcement' : 'New Announcement'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                class="p-2 hover:bg-white/10 rounded-lg transition-all"
                            >
                                <X class="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div class="p-6 space-y-6">
                            {/* Title */}
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    value={formTitle()}
                                    onInput={(e) => setFormTitle(e.currentTarget.value)}
                                    class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                                    placeholder="Announcement title..."
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                                    Content *
                                </label>
                                <textarea
                                    value={formContent()}
                                    onInput={(e) => setFormContent(e.currentTarget.value)}
                                    rows={5}
                                    class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
                                    placeholder="Announcement content..."
                                />
                            </div>

                            {/* Type & Priority */}
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                                        Type
                                    </label>
                                    <select
                                        value={formType()}
                                        onChange={(e) => setFormType(e.currentTarget.value as GlobalAnnouncement['type'])}
                                        class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="info">Info</option>
                                        <option value="warning">Warning</option>
                                        <option value="critical">Critical</option>
                                        <option value="maintenance">Maintenance</option>
                                        <option value="feature">New Feature</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                                        Priority
                                    </label>
                                    <select
                                        value={formPriority()}
                                        onChange={(e) => setFormPriority(e.currentTarget.value as GlobalAnnouncement['priority'])}
                                        class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            {/* Action URL */}
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                                    Action URL (Optional)
                                </label>
                                <input
                                    type="url"
                                    value={formActionUrl()}
                                    onInput={(e) => setFormActionUrl(e.currentTarget.value)}
                                    class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                                    placeholder="https://..."
                                />
                            </div>

                            {/* Action Label */}
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                                    Action Button Label (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formActionLabel()}
                                    onInput={(e) => setFormActionLabel(e.currentTarget.value)}
                                    class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                                    placeholder="Learn More"
                                />
                            </div>

                            {/* Active Toggle */}
                            <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                                <div>
                                    <p class="text-sm font-bold text-white">Active Status</p>
                                    <p class="text-[11px] text-gray-500">When active, this announcement will be visible to all users</p>
                                </div>
                                <button
                                    onClick={() => setFormIsActive(!formIsActive())}
                                    class={`w-14 h-8 rounded-full transition-all relative ${formIsActive() ? 'bg-purple-600' : 'bg-gray-700'}`}
                                >
                                    <div class={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${formIsActive() ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>

                        <div class="p-6 border-t border-white/10 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                class="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving()}
                                class="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                            >
                                {saving() ? (
                                    <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Save class="w-4 h-4" />
                                )}
                                {editingId() ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}
