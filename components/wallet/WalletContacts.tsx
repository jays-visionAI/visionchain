import { createSignal, Show, For, onMount, createEffect } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Plus,
    Smartphone,
    Search,
    User,
    Mail,
    Phone,
    Copy,
    Check,
    Star,
    Zap,
    ChevronRight,
    ExternalLink,
    RefreshCw,
    Loader2,
    AlertCircle
} from 'lucide-solid';
import { getUserContacts, Contact, normalizePhoneNumber, searchUserByPhone } from '../../services/firebaseService';
import { AddContactModal } from './AddContactModal';

interface WalletContactsProps {
    userProfile: () => any;
    startFlow: (flow: string) => void;
    setRecipientAddress: (addr: string) => void;
}

export const WalletContacts = (props: WalletContactsProps) => {
    const [contacts, setContacts] = createSignal<Contact[]>([]);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [isModalOpen, setIsModalOpen] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(true);
    const [copiedId, setCopiedId] = createSignal<string | null>(null);

    const loadContacts = async () => {
        setIsLoading(true);
        try {
            const data = await getUserContacts(props.userProfile().email);
            setContacts(data);
        } catch (e) {
            console.error("Failed to load contacts:", e);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        loadContacts();
    });

    const filteredContacts = () => {
        const query = searchQuery().toLowerCase().trim();
        if (!query) return contacts();
        return contacts().filter(c =>
            c.internalName.toLowerCase().includes(query) ||
            c.phone.includes(query) ||
            c.email.toLowerCase().includes(query)
        );
    };

    const copyAddress = (address: string, id: string) => {
        navigator.clipboard.writeText(address);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const invitationCount = () => contacts().filter(c => c.vchainUserUid).length;

    return (
        <div class="flex-1 overflow-y-auto p-4 lg:p-8">
            <div class="max-w-5xl mx-auto space-y-8">

                {/* Header Section */}
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 class="text-4xl font-black text-white mb-2 tracking-tight">Address Book</h2>
                        <p class="text-gray-500 font-medium">Manage your network and map identifiers to Vision IDs.</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button
                            class="flex items-center gap-2 px-5 py-3 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] rounded-2xl transition-all font-bold text-sm text-gray-300 active:scale-95 group"
                        >
                            <Smartphone class="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                            Import Mobile
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            class="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-2xl hover:bg-white/90 transition-all font-black text-sm active:scale-95 shadow-xl shadow-white/5"
                        >
                            <Plus class="w-4 h-4" />
                            Add Contact
                        </button>
                    </div>
                </div>

                {/* Campaign Banner - Premium Design */}
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    class="relative overflow-hidden group rounded-[32px]"
                >
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-500/20 to-indigo-600/20 blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-1000" />
                    <div class="relative bg-[#0d0d0f] border border-white/[0.08] p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 rounded-[24px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/20 relative group-hover:rotate-6 transition-transform">
                                <Zap class="w-8 h-8 text-white fill-white/20" />
                                <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-[#0d0d0f] animate-pulse" />
                            </div>
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[9px] font-black text-blue-400 uppercase tracking-widest">Active Campaign</span>
                                </div>
                                <h3 class="text-2xl font-black text-white">Invite Friends & Get 50 VCN Each</h3>
                                <p class="text-sm text-gray-500 mt-1">Both you and your friend receive a welcome bonus upon VID creation.</p>
                            </div>
                        </div>

                        <div class="flex items-center gap-12 px-10 py-4 bg-white/[0.02] rounded-[24px] border border-white/[0.04]">
                            <div class="text-center">
                                <div class="text-3xl font-black text-white tabular-nums">{(invitationCount() * 50).toLocaleString()}</div>
                                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">VCN Earned</div>
                            </div>
                            <div class="h-10 w-px bg-white/[0.06]" />
                            <div class="text-center">
                                <div class="text-3xl font-black text-white tabular-nums">{invitationCount()}</div>
                                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">VID Linked</div>
                            </div>
                        </div>
                    </div>
                </Motion.div>

                {/* Sub-Header & Search */}
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                    <div class="flex items-center gap-6">
                        <button class="relative py-2 text-sm font-bold text-white tracking-tight">
                            All Contacts
                            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                        </button>
                        <button class="py-2 text-sm font-bold text-gray-500 hover:text-white transition-colors tracking-tight">
                            Favorites
                        </button>
                        <button class="py-2 text-sm font-bold text-gray-500 hover:text-white transition-colors tracking-tight">
                            Recently Added
                        </button>
                    </div>

                    <div class="relative w-full md:w-[320px]">
                        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search names, phone or email..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            class="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] focus:border-blue-500/50 rounded-2xl pl-11 pr-4 py-3 text-sm text-white outline-none transition-all placeholder:text-gray-600"
                        />
                    </div>
                </div>

                {/* Contacts List Grid */}
                <div class="relative min-h-[400px]">
                    <Show when={isLoading()}>
                        <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <Loader2 class="w-8 h-8 text-blue-500 animate-spin" />
                            <span class="text-sm font-bold text-gray-600 uppercase tracking-widest">Loading Address Book...</span>
                        </div>
                    </Show>

                    <Show when={!isLoading() && contacts().length === 0}>
                        <div class="flex flex-col items-center justify-center py-20 bg-white/[0.01] border border-dashed border-white/[0.06] rounded-[32px]">
                            <div class="w-20 h-20 rounded-[28px] bg-white/[0.02] flex items-center justify-center mb-6">
                                <User class="w-10 h-10 text-gray-700" />
                            </div>
                            <h3 class="text-xl font-bold text-white mb-2">No Contacts Yet</h3>
                            <p class="text-gray-500 text-sm max-w-xs text-center leading-relaxed font-medium">
                                Start building your network by adding contacts one by one or importing from CSV.
                            </p>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                class="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                            >
                                Get Started
                            </button>
                        </div>
                    </Show>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <For each={filteredContacts()}>
                            {(contact) => (
                                <Motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    class="relative group"
                                >
                                    <div class="relative bg-[#0d0d0f] border border-white/[0.06] group-hover:border-blue-500/30 rounded-[24px] p-5 transition-all duration-300 overflow-hidden">
                                        {/* Linked status indicator bg */}
                                        <Show when={contact.vchainUserUid}>
                                            <div class="absolute -right-12 -top-12 w-24 h-24 bg-green-500/5 rounded-full blur-2xl group-hover:bg-green-500/10 transition-all" />
                                        </Show>

                                        <div class="flex items-start justify-between gap-4">
                                            <div class="flex items-center gap-4">
                                                <div class="relative">
                                                    <div class={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-2xl transition-all ${contact.vchainUserUid
                                                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20'
                                                        : 'bg-gradient-to-br from-gray-800 to-gray-900 border border-white/[0.04]'
                                                        }`}>
                                                        {contact.internalName.charAt(0)}
                                                    </div>
                                                    <Show when={contact.vchainUserUid}>
                                                        <div class="absolute -bottom-1 -right-1 p-1.5 bg-[#0d0d0f] rounded-lg border border-white/[0.08]">
                                                            <div class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#10b981]" />
                                                        </div>
                                                    </Show>
                                                </div>

                                                <div class="min-w-0">
                                                    <div class="flex items-center gap-2 mb-1">
                                                        <span class="text-lg font-bold text-white truncate max-w-[140px] md:max-w-none">{contact.internalName}</span>
                                                        <Show when={contact.vchainUserUid}>
                                                            <div class="px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[9px] font-black text-green-400 uppercase tracking-widest">Linked VID</div>
                                                        </Show>
                                                    </div>
                                                    <div class="flex flex-col gap-1">
                                                        <div class="flex items-center gap-2 text-[11px] font-medium text-gray-500">
                                                            <Phone class="w-3 h-3" />
                                                            {contact.phone}
                                                        </div>
                                                        <Show when={contact.email}>
                                                            <div class="flex items-center gap-2 text-[11px] font-medium text-gray-500">
                                                                <Mail class="w-3 h-3" />
                                                                {contact.email}
                                                            </div>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </div>

                                            <button class="p-2 text-gray-700 hover:text-yellow-400 hover:bg-yellow-400/5 rounded-xl transition-all">
                                                <Star class={`w-4 h-4 ${false ? 'fill-yellow-400' : ''}`} />
                                            </button>
                                        </div>

                                        {/* Action Area */}
                                        <div class="mt-6 pt-5 border-t border-white/[0.04] flex items-center justify-between">
                                            <Show
                                                when={contact.address}
                                                fallback={
                                                    <div class="flex items-center gap-2 px-3 py-1.5 bg-orange-500/5 border border-orange-500/10 rounded-lg">
                                                        <AlertCircle class="w-3.5 h-3.5 text-orange-400/50" />
                                                        <span class="text-[10px] font-bold text-orange-400/60 uppercase tracking-widest">Unregistered / Pending</span>
                                                    </div>
                                                }
                                            >
                                                <div class="flex items-center gap-2 max-w-[140px] md:max-w-none group/addr cursor-pointer" onClick={() => copyAddress(contact.address!, contact.id!)}>
                                                    <div class="p-1.5 bg-white/5 rounded-lg text-gray-400 group-hover/addr:text-white transition-colors">
                                                        <Show when={copiedId() === contact.id} fallback={<Copy class="w-3 h-3" />}>
                                                            <Check class="w-3 h-3 text-green-400" />
                                                        </Show>
                                                    </div>
                                                    <span class="text-[11px] font-mono text-gray-500 truncate group-hover/addr:text-gray-300 transition-colors">{contact.address}</span>
                                                </div>
                                            </Show>

                                            <Show when={contact.address}>
                                                <button
                                                    onClick={() => {
                                                        props.setRecipientAddress(contact.address!);
                                                        props.startFlow('send');
                                                    }}
                                                    class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/10 active:scale-95"
                                                >
                                                    Send Asset
                                                </button>
                                            </Show>
                                        </div>
                                    </div>
                                </Motion.div>
                            )}
                        </For>
                    </div>
                </div>

                {/* Footer Info */}
                <div class="pt-8 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span class="text-[11px] font-black text-gray-600 uppercase tracking-widest">Vision ID Resolver v1.0 Active</span>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] font-bold text-gray-500 uppercase">VID Node:</span>
                            <span class="text-[11px] font-black text-white px-2 py-0.5 bg-white/5 rounded-md">VCN-RESOLVER-01</span>
                        </div>
                    </div>
                </div>
            </div>

            <AddContactModal
                isOpen={isModalOpen()}
                onClose={() => setIsModalOpen(false)}
                userEmail={props.userProfile().email}
                onSuccess={loadContacts}
            />
        </div>
    );
};
