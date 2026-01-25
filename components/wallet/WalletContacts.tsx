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
import { getUserContacts, Contact, normalizePhoneNumber, searchUserByPhone, syncUserContacts } from '../../services/firebaseService';
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
    const [isSyncing, setIsSyncing] = createSignal(false);
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

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const updatedCount = await syncUserContacts(props.userProfile().email);
            if (updatedCount > 0) {
                await loadContacts();
            }
            alert(`${updatedCount} contacts synced with Vision Chain ID.`);
        } catch (e) {
            console.error("Sync failed:", e);
        } finally {
            setIsSyncing(false);
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
            (c.email && c.email.toLowerCase().includes(query))
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
            <div class="max-w-6xl mx-auto space-y-8">

                {/* Header Section */}
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 class="text-4xl font-black text-white mb-2 tracking-tight">Address Book</h2>
                        <p class="text-gray-500 font-medium text-sm">Manage your network and map identifiers to Vision IDs.</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button
                            onClick={handleSync}
                            disabled={isSyncing()}
                            class="flex items-center gap-2 px-5 py-3 bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 text-blue-400 rounded-2xl transition-all font-bold text-sm active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw class={`w-4 h-4 ${isSyncing() ? 'animate-spin' : ''}`} />
                            {isSyncing() ? 'Syncing...' : 'Sync Contacts'}
                        </button>
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

                {/* Campaign Banner */}
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    class="relative overflow-hidden group rounded-[32px]"
                >
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-cyan-500/10 to-indigo-600/10 blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-1000" />
                    <div class="relative bg-[#0d0d0f]/50 backdrop-blur-sm border border-white/[0.08] p-8 flex flex-col md:flex-row items-center justify-between gap-8">
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

                {/* Search & Tabs */}
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-white/5">
                    <div class="flex items-center gap-8">
                        <button class="relative py-4 text-sm font-bold text-white">
                            All Contacts
                            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                        </button>
                        <button class="py-4 text-sm font-bold text-gray-500 hover:text-white transition-colors">
                            Favorites
                        </button>
                        <button class="py-4 text-sm font-bold text-gray-500 hover:text-white transition-colors">
                            Recently Added
                        </button>
                    </div>

                    <div class="relative w-full md:w-[360px]">
                        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                        <input
                            type="text"
                            placeholder="Search names, phone or email..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            class="w-full bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] focus:border-blue-500/50 rounded-2xl pl-11 pr-4 py-3 text-sm text-white outline-none transition-all placeholder:text-gray-600"
                        />
                    </div>
                </div>

                {/* Contact List View */}
                <div class="bg-white/[0.01] border border-white/[0.06] rounded-[32px] overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="text-left border-b border-white/[0.04]">
                                    <th class="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Name</th>
                                    <th class="px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Contact Info</th>
                                    <th class="px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Vision ID / Address</th>
                                    <th class="px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                                    <th class="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <Show when={isLoading()}>
                                    <tr>
                                        <td colspan="5" class="px-8 py-20 text-center">
                                            <Loader2 class="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                                            <span class="text-sm font-bold text-gray-600 uppercase tracking-widest">Loading Address Book...</span>
                                        </td>
                                    </tr>
                                </Show>

                                <Show when={!isLoading() && contacts().length === 0}>
                                    <tr>
                                        <td colspan="5" class="px-8 py-20 text-center">
                                            <div class="w-16 h-16 rounded-2xl bg-white/[0.02] flex items-center justify-center mx-auto mb-4">
                                                <User class="w-8 h-8 text-gray-700" />
                                            </div>
                                            <h3 class="text-lg font-bold text-white mb-1">No Contacts Found</h3>
                                            <p class="text-gray-500 text-sm">Add some contacts to get started.</p>
                                        </td>
                                    </tr>
                                </Show>

                                <For each={filteredContacts()}>
                                    {(contact) => (
                                        <tr class="group hover:bg-white/[0.02] transition-colors border-b border-white/[0.02] last:border-0 text-white">
                                            <td class="px-8 py-4">
                                                <div class="flex items-center gap-4">
                                                    <div class={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xl transition-transform group-hover:scale-110 ${contact.vchainUserUid
                                                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                                                            : 'bg-gray-800 border border-white/5'
                                                        }`}>
                                                        {contact.internalName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div class="font-bold text-white">{contact.internalName}</div>
                                                        <Show when={contact.vchainUserUid}>
                                                            <div class="text-[9px] font-black text-blue-400/80 uppercase tracking-tighter mt-0.5">Verified Network Member</div>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="px-6 py-4">
                                                <div class="space-y-1">
                                                    <div class="flex items-center gap-2 text-xs font-medium text-gray-400">
                                                        <Phone class="w-3 h-3 opacity-50" />
                                                        {contact.phone}
                                                    </div>
                                                    <Show when={contact.email}>
                                                        <div class="flex items-center gap-2 text-xs font-medium text-gray-400">
                                                            <Mail class="w-3 h-3 opacity-50" />
                                                            {contact.email}
                                                        </div>
                                                    </Show>
                                                </div>
                                            </td>
                                            <td class="px-6 py-4">
                                                <Show when={contact.address} fallback={<span class="text-xs font-mono text-gray-600">Wait for sync...</span>}>
                                                    <div class="flex items-center gap-2 group/addr cursor-pointer" onClick={() => copyAddress(contact.address!, contact.id!)}>
                                                        <span class="text-xs font-mono text-blue-400 group-hover/addr:text-blue-300 transition-colors bg-blue-400/5 px-2 py-1 rounded-md border border-blue-400/10">
                                                            {contact.address?.substring(0, 10)}...{contact.address?.substring(contact.address.length - 8)}
                                                        </span>
                                                        <Show when={copiedId() === contact.id} fallback={<Copy class="w-3 h-3 text-gray-600 group-hover/addr:text-white" />}>
                                                            <Check class="w-3 h-3 text-green-400" />
                                                        </Show>
                                                    </div>
                                                </Show>
                                            </td>
                                            <td class="px-6 py-4">
                                                <Show when={contact.vchainUserUid} fallback={
                                                    <div class="inline-flex items-center gap-1.5 px-2 py-1 bg-orange-500/5 border border-orange-500/10 rounded-md">
                                                        <div class="w-1 h-1 rounded-full bg-orange-500" />
                                                        <span class="text-[9px] font-black text-orange-400/60 uppercase tracking-widest">Pending</span>
                                                    </div>
                                                }>
                                                    <div class="inline-flex items-center gap-1.5 px-2 py-1 bg-green-500/5 border border-green-500/10 rounded-md">
                                                        <div class="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_#10b981]" />
                                                        <span class="text-[9px] font-black text-green-400 uppercase tracking-widest">Registered</span>
                                                    </div>
                                                </Show>
                                            </td>
                                            <td class="px-8 py-4 text-right">
                                                <div class="flex items-center justify-end gap-2">
                                                    <Show when={contact.address}>
                                                        <button
                                                            onClick={() => {
                                                                props.setRecipientAddress(contact.address!);
                                                                props.startFlow('send');
                                                            }}
                                                            class="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/10 active:scale-95"
                                                            title="Send Asset"
                                                        >
                                                            <Zap class="w-4 h-4" />
                                                        </button>
                                                    </Show>
                                                    <button class="p-2 bg-white/[0.03] hover:bg-white/[0.08] text-gray-500 hover:text-yellow-500 rounded-xl transition-all">
                                                        <Star class="w-4 h-4" />
                                                    </button>
                                                    <button class="p-2 bg-white/[0.03] hover:bg-white/[0.08] text-gray-500 hover:text-white rounded-xl transition-all">
                                                        <ChevronRight class="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Info */}
                <div class="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span class="text-[11px] font-black text-gray-600 uppercase tracking-widest">Security Focused: Data is encrypted on-chain</span>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] font-bold text-gray-500 uppercase">Resolver:</span>
                            <span class="text-[11px] font-black text-white px-2 py-0.5 bg-white/5 rounded-md">VCN-RESOLVER-STABLE</span>
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
