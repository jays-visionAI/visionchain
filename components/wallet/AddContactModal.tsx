import { createSignal, Show, For, onMount, Index } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import {
    X,
    Plus,
    Trash2,
    Upload,
    FileText,
    CheckCircle,
    AlertCircle,
    UserPlus,
    Loader2
} from 'lucide-solid';
import Papa from 'papaparse';
import { saveUserContacts, Contact } from '../../services/firebaseService';

interface AddContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
    onSuccess: () => void;
}

interface NewContactEntry {
    internalName: string;
    phone: string;
    email: string;
}

export const AddContactModal = (props: AddContactModalProps) => {
    const [entries, setEntries] = createSignal<NewContactEntry[]>(
        Array(5).fill(null).map(() => ({ internalName: '', phone: '', email: '' }))
    );
    const [isSaving, setIsSaving] = createSignal(false);
    const [isDragging, setIsDragging] = createSignal(false);
    const [uploadStatus, setUploadStatus] = createSignal<{ type: 'success' | 'error', message: string } | null>(null);

    const addRow = () => {
        setEntries([...entries(), { internalName: '', phone: '', email: '' }]);
    };

    const removeRow = (index: number) => {
        if (entries().length <= 1) return;
        setEntries(entries().filter((_, i) => i !== index));
    };

    const updateEntry = (index: number, field: keyof NewContactEntry, value: string) => {
        const newEntries = [...entries()];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setEntries(newEntries);
    };

    const handleFileUpload = (file: File) => {
        if (!file.name.endsWith('.csv')) {
            setUploadStatus({ type: 'error', message: 'Please upload a CSV file.' });
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedData = results.data as any[];
                const newEntries: NewContactEntry[] = parsedData.map(row => ({
                    internalName: row.name || row.Name || row.internalName || '',
                    phone: row.phone || row.Phone || row.tel || '',
                    email: row.email || row.Email || ''
                })).filter(e => e.internalName || e.phone || e.email);

                if (newEntries.length > 0) {
                    setEntries([...newEntries]);
                    setUploadStatus({ type: 'success', message: `Successfully loaded ${newEntries.length} contacts.` });
                } else {
                    setUploadStatus({ type: 'error', message: 'No valid contact data found in file.' });
                }
            },
            error: (err) => {
                setUploadStatus({ type: 'error', message: 'Failed to parse file.' });
            }
        });
    };

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer?.files[0];
        if (file) handleFileUpload(file);
    };

    const handleSave = async () => {
        const validEntries = entries().filter(e => e.internalName || e.phone || e.email);
        if (validEntries.length === 0) return;

        setIsSaving(true);
        try {
            await saveUserContacts(props.userEmail, validEntries);
            props.onSuccess();
            props.onClose();
            setEntries(Array(5).fill(null).map(() => ({ internalName: '', phone: '', email: '' })));
        } catch (e) {
            setUploadStatus({ type: 'error', message: 'Failed to save contacts to server.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Presence>
            <Show when={props.isOpen}>
                <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={props.onClose}
                        class="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        class="relative w-full max-w-4xl bg-[#0d0d0f] border border-white/[0.08] rounded-[32px] shadow-3xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div class="px-8 py-6 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.01]">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <UserPlus class="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 class="text-xl font-bold text-white">Add New Contacts</h2>
                                    <p class="text-xs text-gray-500 font-medium">Bulk add or import from CSV file</p>
                                </div>
                            </div>
                            <button
                                onClick={props.onClose}
                                class="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-500 hover:text-white"
                            >
                                <X class="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content Scroll Area */}
                        <div class="flex-1 overflow-y-auto p-8 space-y-8">

                            {/* Drag & Drop Area */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={onDrop}
                                class={`relative group border-2 border-dashed rounded-[24px] p-8 transition-all duration-300 flex flex-col items-center justify-center gap-4 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-500/5' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                                    }`}
                            >
                                <input
                                    type="file"
                                    accept=".csv"
                                    class="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => {
                                        const file = e.currentTarget.files?.[0];
                                        if (file) handleFileUpload(file);
                                    }}
                                />
                                <div class={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isDragging ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400 group-hover:text-white'}`}>
                                    <Upload class="w-7 h-7" />
                                </div>
                                <div class="text-center">
                                    <p class="text-[15px] font-bold text-white mb-1">Drag & Drop CSV File</p>
                                    <p class="text-xs text-gray-500 font-medium tracking-tight">Support auto-detection for Name, Phone, and Email columns</p>
                                </div>
                            </div>

                            {/* Status Message */}
                            <Show when={uploadStatus()}>
                                <Motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    class={`p-4 rounded-2xl border flex items-center gap-3 ${uploadStatus()?.type === 'success'
                                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                                        }`}
                                >
                                    <Show when={uploadStatus()?.type === 'success'} fallback={<AlertCircle class="w-5 h-5" />}>
                                        <CheckCircle class="w-5 h-5" />
                                    </Show>
                                    <span class="text-sm font-bold">{uploadStatus()?.message}</span>
                                </Motion.div>
                            </Show>

                            {/* Input Grid */}
                            <div class="space-y-4">
                                <div class="grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    <div class="col-span-4">Internal Name</div>
                                    <div class="col-span-4">Phone Number</div>
                                    <div class="col-span-3">Email Address</div>
                                    <div class="col-span-1"></div>
                                </div>

                                <div class="space-y-1">
                                    <Index each={entries()}>
                                        {(entry, index) => (
                                            <div class="grid grid-cols-12 gap-3 items-center group/row py-1 transition-colors hover:bg-white/[0.01] rounded-xl px-2">
                                                <div class="col-span-4">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. 홍길동 사장님"
                                                        value={entry().internalName}
                                                        onInput={(e) => updateEntry(index, 'internalName', e.currentTarget.value)}
                                                        class="w-full bg-white/[0.03] border border-white/[0.06] focus:border-blue-500/50 focus:bg-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
                                                    />
                                                </div>
                                                <div class="col-span-4">
                                                    <input
                                                        type="tel"
                                                        placeholder="010-1234-5678"
                                                        value={entry().phone}
                                                        onInput={(e) => updateEntry(index, 'phone', e.currentTarget.value)}
                                                        class="w-full bg-white/[0.03] border border-white/[0.06] focus:border-blue-500/50 focus:bg-white/[0.08] rounded-xl px-4 py-3 text-white text-sm font-mono outline-none transition-all"
                                                    />
                                                </div>
                                                <div class="col-span-3">
                                                    <input
                                                        type="email"
                                                        placeholder="user@example.com"
                                                        value={entry().email}
                                                        onInput={(e) => updateEntry(index, 'email', e.currentTarget.value)}
                                                        class="w-full bg-white/[0.03] border border-white/[0.06] focus:border-blue-500/50 focus:bg-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
                                                    />
                                                </div>
                                                <div class="col-span-1 flex justify-end">
                                                    <button
                                                        onClick={() => removeRow(index)}
                                                        class="p-2 text-gray-700 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover/row:opacity-100"
                                                    >
                                                        <Trash2 class="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </Index>
                                </div>

                                <button
                                    onClick={addRow}
                                    class="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-white/[0.05] hover:border-blue-500/30 hover:bg-blue-500/5 rounded-2xl text-gray-500 hover:text-blue-400 transition-all font-bold text-sm group"
                                >
                                    <Plus class="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    Add Another Entry
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div class="px-8 py-6 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
                            <div class="flex items-center gap-2 text-gray-500">
                                <FileText class="w-4 h-4" />
                                <span class="text-xs font-bold leading-none">{entries().filter(e => e.internalName || e.phone).length} potential contacts ready</span>
                            </div>
                            <div class="flex items-center gap-4">
                                <button
                                    onClick={props.onClose}
                                    class="px-6 py-3 text-gray-400 hover:text-white font-bold text-sm transition-colors"
                                >
                                    Discard Change
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving() || entries().filter(e => e.internalName || e.phone).length === 0}
                                    class={`px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-3 shadow-xl transition-all ${isSaving() || entries().filter(e => e.internalName || e.phone).length === 0
                                        ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                                        : 'bg-white text-black hover:scale-105 active:scale-95'
                                        }`}
                                >
                                    <Show when={isSaving()} fallback={<CheckCircle class="w-4 h-4" />}>
                                        <Loader2 class="w-4 h-4 animate-spin" />
                                    </Show>
                                    Save Contacts to VID
                                </button>
                            </div>
                        </div>
                    </Motion.div>
                </div>
            </Show>
        </Presence>
    );
};
