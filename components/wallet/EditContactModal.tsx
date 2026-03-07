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
import { updateContact, Contact, findUserByAddress } from '../../services/firebaseService';

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
    const [manualAddress, setManualAddress] = createSignal('');
    const [manualEmail, setManualEmail] = createSignal('');
    const [isLookingUp, setIsLookingUp] = createSignal(false);
    const [lookupResult, setLookupResult] = createSignal<string | null>(null);
    const [isSaving, setIsSaving] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    // Sync state when contact changes or modal opens
    createEffect(() => {
        if (props.contact && props.isOpen) {
            setName(props.contact.internalName);
            setAlias(props.contact.alias || '');
            setPhone(props.contact.phone);
            setManualAddress(props.contact.address || '');
            setManualEmail(props.contact.email || '');
            setLookupResult(null);
            setError(null);
        }
    });

    const handleLookupByEmail = async () => {
        const email = manualEmail().trim().toLowerCase();
        if (!email || !email.includes('@')) {
            setError('Valid email is required');
            return;
        }
        setIsLookingUp(true);
        setError(null);
        setLookupResult(null);
        try {
            const { searchUserByEmail } = await import('../../services/firebaseService');
            const result = await searchUserByEmail(email);
            if (result && result.address) {
                setManualAddress(result.address);
                setLookupResult(`Found: ${result.name || result.email} (${result.address.substring(0, 10)}...)`);
            } else {
                setLookupResult(null);
                setError('No Vision Chain user found with this email');
            }
        } catch (e) {
            setError('Lookup failed');
            console.error(e);
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleSave = async () => {
        if (!props.contact?.id) return;
        if (!name().trim()) {
            setError('Name is required');
            return;
        }

        const addressVal = manualAddress().trim();
        if (addressVal && !addressVal.startsWith('0x')) {
            setError('Wallet address must start with 0x');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const updateData: any = {
                internalName: name().trim(),
                alias: alias().trim(),
                phone: phone().trim()
            };

            // If user manually entered/looked-up an address, link it
            if (addressVal && addressVal.length >= 42) {
                updateData.address = addressVal;
                updateData.syncStatus = 'verified';
                // Try to find the VID for this address
                try {
                    const user = await findUserByAddress(addressVal);
                    if (user) {
                        updateData.vchainUserUid = user.email || user.vid || '';
                        if (user.email) updateData.email = user.email;
                    }
                } catch { }
            }

            if (manualEmail().trim()) {
                updateData.email = manualEmail().trim().toLowerCase();
            }

            await updateContact(props.userEmail, props.contact.id, updateData);
            props.onSuccess();
            props.onClose();
        } catch (e) {
            setError('Failed to update contact');
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const hasLinkedAddress = () => {
        const addr = manualAddress();
        return addr && addr.startsWith('0x') && addr.length >= 42;
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
                        class="relative w-full max-w-md bg-[#0d0d0f] border border-white/[0.08] rounded-[32px] shadow-3xl overflow-hidden flex flex-col max-h-[90vh]"
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
                        <div class="p-8 space-y-6 overflow-y-auto">
                            <Show when={error()}>
                                <div class="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
                                    <AlertCircle class="w-4 h-4" />
                                    {error()}
                                </div>
                            </Show>

                            <Show when={lookupResult()}>
                                <div class="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold">
                                    <CheckCircle class="w-4 h-4" />
                                    {lookupResult()}
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
                                        class="w-full bg-white/[0.02] border border-white/[0.08] focus:border-blue-500/50 rounded-2xl px-5 py-4 text-white text-sm outline-none transition-all placeholder:text-gray-700 box-border"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Alias / Category</label>
                                    <input
                                        type="text"
                                        value={alias()}
                                        onInput={(e) => setAlias(e.currentTarget.value)}
                                        placeholder="e.g. Work, Family"
                                        class="w-full bg-white/[0.02] border border-white/[0.08] focus:border-blue-500/50 rounded-2xl px-5 py-4 text-white text-sm outline-none transition-all placeholder:text-gray-700 box-border"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={phone()}
                                        onInput={(e) => setPhone(e.currentTarget.value)}
                                        placeholder="010-0000-0000"
                                        class="w-full bg-white/[0.02] border border-white/[0.08] focus:border-blue-500/50 rounded-2xl px-5 py-4 text-white text-sm font-mono outline-none transition-all placeholder:text-gray-700 box-border"
                                    />
                                </div>

                                {/* Manual Link Section */}
                                <div class="pt-2 border-t border-white/[0.06]">
                                    <div class="flex items-center gap-2 mb-3">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-cyan-400">
                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                        </svg>
                                        <span class="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Manual Link</span>
                                        <span class="text-[9px] text-gray-600 ml-1">-- Link by email or wallet address</span>
                                    </div>

                                    <div class="space-y-3">
                                        <div class="space-y-2">
                                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Email</label>
                                            <div class="flex gap-2">
                                                <input
                                                    type="email"
                                                    value={manualEmail()}
                                                    onInput={(e) => setManualEmail(e.currentTarget.value)}
                                                    placeholder="user@example.com"
                                                    class="flex-1 bg-white/[0.02] border border-white/[0.08] focus:border-cyan-500/50 rounded-2xl px-5 py-3 text-white text-sm outline-none transition-all placeholder:text-gray-700 box-border"
                                                />
                                                <button
                                                    onClick={handleLookupByEmail}
                                                    disabled={isLookingUp()}
                                                    class="shrink-0 px-4 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                                                >
                                                    <Show when={isLookingUp()} fallback={
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
                                                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                        </svg>
                                                    }>
                                                        <Loader2 class="w-4 h-4 animate-spin" />
                                                    </Show>
                                                </button>
                                            </div>
                                        </div>

                                        <div class="space-y-2">
                                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Wallet Address</label>
                                            <input
                                                type="text"
                                                value={manualAddress()}
                                                onInput={(e) => setManualAddress(e.currentTarget.value)}
                                                placeholder="0x..."
                                                class={`w-full bg-white/[0.02] border rounded-2xl px-5 py-3 text-sm font-mono outline-none transition-all placeholder:text-gray-700 box-border ${hasLinkedAddress() ? 'border-emerald-500/30 text-emerald-400' : 'border-white/[0.08] focus:border-cyan-500/50 text-white'}`}
                                            />
                                            <Show when={hasLinkedAddress()}>
                                                <div class="flex items-center gap-1.5 pl-1">
                                                    <CheckCircle class="w-3 h-3 text-emerald-400" />
                                                    <span class="text-[9px] font-bold text-emerald-400">Address linked -- this contact can receive transfers</span>
                                                </div>
                                            </Show>
                                        </div>
                                    </div>
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
