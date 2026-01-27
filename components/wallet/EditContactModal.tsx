import { createSignal, Show, onMount, createEffect } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import {
    X,
    CheckCircle,
    AlertCircle,
    UserCircle,
    Loader2,
    Save,
    Trash2
} from 'lucide-solid';
import { updateContact, Contact } from '../../services/firebaseService';

interface EditContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
    contact: Contact | null;
    onSuccess: () => void;
}

export const EditContactModal = (props: EditContactModalProps) => {
    const [name, setName] = createSignal('');
    const [alias, setAlias] = createSignal('');
    const [phone, setPhone] = createSignal('');
    const [isSaving, setIsSaving] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    // Sync state when contact changes or modal opens
    createEffect(() => {
        if (props.contact && props.isOpen) {
            setName(props.contact.internalName);
            setAlias(props.contact.alias || '');
            setPhone(props.contact.phone);
        }
    });

    const handleSave = async () => {
        if (!props.contact?.id) return;
        if (!name().trim()) {
            setError('Name is required');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            await updateContact(props.userEmail, props.contact.id, {
                internalName: name().trim(),
                alias: alias().trim(),
                phone: phone().trim()
            });
            props.onSuccess();
            props.onClose();
        } catch (e) {
            setError('Failed to update contact');
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Presence>
            <Show when={props.isOpen && props.contact}>
                <div class="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={props.onClose}
                        class="absolute inset-0 bg-black/90 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        class="relative w-full max-w-md bg-[#0d0d0f] border border-white/[0.08] rounded-[32px] shadow-3xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div class="px-8 py-6 border-b border-white/[0.06] flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <UserCircle class="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 class="text-lg font-bold text-white tracking-tight italic uppercase">Edit Contact</h2>
                                    <p class="text-[10px] text-gray-500 font-black uppercase tracking-widest">Update local identifiers</p>
                                </div>
                            </div>
                            <button
                                onClick={props.onClose}
                                class="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-500 hover:text-white"
                            >
                                <X class="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div class="p-8 space-y-6">
                            <Show when={error()}>
                                <div class="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
                                    <AlertCircle class="w-4 h-4" />
                                    {error()}
                                </div>
                            </Show>

                            <div class="space-y-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Display Name</label>
                                    <input
                                        type="text"
                                        value={name()}
                                        onInput={(e) => setName(e.currentTarget.value)}
                                        placeholder="e.g. John Doe"
                                        class="w-full bg-white/[0.02] border border-white/[0.08] focus:border-blue-500/50 rounded-2xl px-5 py-4 text-white text-sm outline-none transition-all placeholder:text-gray-700"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Alias / Category</label>
                                    <input
                                        type="text"
                                        value={alias()}
                                        onInput={(e) => setAlias(e.currentTarget.value)}
                                        placeholder="e.g. Work, Family"
                                        class="w-full bg-white/[0.02] border border-white/[0.08] focus:border-blue-500/50 rounded-2xl px-5 py-4 text-white text-sm outline-none transition-all placeholder:text-gray-700"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={phone()}
                                        onInput={(e) => setPhone(e.currentTarget.value)}
                                        placeholder="010-0000-0000"
                                        class="w-full bg-white/[0.02] border border-white/[0.08] focus:border-blue-500/50 rounded-2xl px-5 py-4 text-white text-sm font-mono outline-none transition-all placeholder:text-gray-700"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div class="px-8 py-6 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-end gap-4">
                            <button
                                onClick={props.onClose}
                                class="px-6 py-3 text-xs font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving()}
                                class="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                            >
                                <Show when={isSaving()} fallback={<Save class="w-3.5 h-3.5" />}>
                                    <Loader2 class="w-3.5 h-3.5 animate-spin" />
                                </Show>
                                Save Changes
                            </button>
                        </div>
                    </Motion.div>
                </div>
            </Show>
        </Presence>
    );
};
