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
    AlertCircle,
    Share2,
    Trash2,
    Edit3
} from 'lucide-solid';
import { getUserContacts, Contact, normalizePhoneNumber, searchUserByPhone, syncUserContacts, deleteContact } from '../../services/firebaseService';
import { AddContactModal } from './AddContactModal';
import { EditContactModal } from './EditContactModal';

import { WalletViewHeader } from './WalletViewHeader';

interface WalletContactsProps {
    userProfile: () => any;
    startFlow: (flow: string) => void;
    setRecipientAddress: (addr: string) => void;
}

export const WalletContacts = (props: WalletContactsProps) => {
    const [contacts, setContacts] = createSignal<Contact[]>([]);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [isModalOpen, setIsModalOpen] = createSignal(false);
    const [isEditModalOpen, setIsEditModalOpen] = createSignal(false);
    const [selectedContact, setSelectedContact] = createSignal<Contact | null>(null);
    const [contactToEdit, setContactToEdit] = createSignal<Contact | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSyncing, setIsSyncing] = createSignal(false);
    const [copiedId, setCopiedId] = createSignal<string | null>(null);
    const [activeTab, setActiveTab] = createSignal<'all' | 'favorites'>('all');

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
            const result = await syncUserContacts(props.userProfile().email);
            if (result.updated > 0 || result.ambiguous > 0) {
                await loadContacts();
            }

            if (result.ambiguous > 0) {
                // Find first ambiguous contact to start resolution process automatically
                const firstAmbiguous = contacts().find(c => c.syncStatus === 'ambiguous');
                if (firstAmbiguous) {
                    setSelectedContact(firstAmbiguous);
                }
            } else if (result.updated > 0) {
                alert(`${result.updated} contacts synced successfully.`);
            } else {
                alert('Everything is up to date.');
            }
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
        let base = contacts();
        if (activeTab() === 'favorites') {
            base = base.filter(c => c.isFavorite);
        }

        const query = searchQuery().toLowerCase().trim();
        if (!query) return base;
        return base.filter(c =>
            c.internalName.toLowerCase().includes(query) ||
            c.phone.includes(query) ||
            (c.email && c.email.toLowerCase().includes(query))
        );
    };

    const toggleFavorite = async (e: MouseEvent, contact: Contact) => {
        e.stopPropagation();
        if (!contact.id) return;

        try {
            const newState = !contact.isFavorite;
            setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, isFavorite: newState } : c));

            const { toggleContactFavorite } = await import('../../services/firebaseService');
            await toggleContactFavorite(props.userProfile().email, contact.id, newState);
        } catch (err) {
            console.error("Toggle favorite failed:", err);
            loadContacts();
        }
    };

    const copyAddress = (address: string, id: string) => {
        navigator.clipboard.writeText(address);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleInvite = (contact: Contact) => {
        const refCode = props.userProfile().referralCode || props.userProfile().email;
        const referralLink = `${window.location.origin}/signup?ref=${refCode}`;
        const message = `[Vision Chain] Join me on the next generation AI blockchain! Create your Vision ID and participate in the ecosystem. Join here: ${referralLink}`;

        if (navigator.share) {
            navigator.share({
                title: 'Join Vision Chain',
                text: message,
                url: referralLink
            }).catch(() => {
                navigator.clipboard.writeText(message);
                alert('Invite message copied to clipboard!');
            });
        } else {
            navigator.clipboard.writeText(message);
            alert('Invite message copied to clipboard!');
        }
    };

    const handleEdit = (contact: Contact) => {
        setContactToEdit(contact);
        setIsEditModalOpen(true);
    };

    const handleDelete = async (contact: Contact) => {
        if (!contact.id) return;
        if (!confirm(`Are you sure you want to delete ${contact.internalName}?`)) return;

        try {
            await deleteContact(props.userProfile().email, contact.id);
            loadContacts();
        } catch (e) {
            console.error("Delete failed:", e);
            alert("Failed to delete contact.");
        }
    };

    const invitationCount = () => contacts().filter(c => c.vchainUserUid).length;

    return (
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                <WalletViewHeader
                    tag="Network Directory"
                    title="CONTACT"
                    titleAccent="LIST"
                    description="Manage your network and map identifiers to Vision IDs for seamless interaction."
                    rightElement={
                        <div class="flex items-center gap-2">
                            <button
                                onClick={() => setIsModalOpen(true)}
                                class="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-lg shadow-blue-500/20 whitespace-nowrap"
                            >
                                <Plus class="w-3.5 h-3.5" />
                                Add Contact
                            </button>
                            <button
                                onClick={handleSync}
                                disabled={isSyncing()}
                                class="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 whitespace-nowrap"
                                title="Sync Contacts"
                            >
                                <RefreshCw class={`w-3.5 h-3.5 ${isSyncing() ? 'animate-spin' : ''}`} />
                                Sync Contact
                            </button>
                        </div>
                    }
                />

                {/* Campaign Banner */}
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    class="relative overflow-hidden group rounded-[32px]"
                >
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-cyan-500/10 to-indigo-600/10 blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-1000" />
                    <div class="relative bg-[#0d0d0f]/50 backdrop-blur-xl border border-white/[0.08] p-6 md:p-8 flex flex-col xl:flex-row items-center justify-between gap-8">
                        <div class="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6">
                            <div class="w-16 h-16 shrink-0 rounded-[24px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/20 relative group-hover:rotate-6 transition-transform">
                                <Zap class="w-8 h-8 text-white fill-white/20" />
                                <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-[#0d0d0f] animate-pulse" />
                            </div>
                            <div>
                                <div class="flex items-center justify-center md:justify-start gap-2 mb-1">
                                    <span class="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[9px] font-black text-blue-400 uppercase tracking-widest">Active Campaign</span>
                                </div>
                                <h3 class="text-xl md:text-2xl font-black text-white leading-tight">Invite Friends & Build Network</h3>
                                <p class="text-sm text-gray-500 mt-1 max-w-sm">Bring your friends to Vision Chain and grow the decentralized future together.</p>
                            </div>
                        </div>

                        <div class="w-full xl:w-auto flex items-center justify-around xl:justify-center gap-6 md:gap-12 px-6 md:px-10 py-5 bg-white/[0.02] rounded-[24px] border border-white/[0.04]">
                            <div class="text-center">
                                <div class="text-2xl md:text-3xl font-black text-white tabular-nums">{(invitationCount() * 0).toLocaleString()}</div>
                                <div class="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">VCN Earned</div>
                            </div>
                            <div class="h-10 w-px bg-white/[0.06]" />
                            <div class="text-center">
                                <div class="text-2xl md:text-3xl font-black text-white tabular-nums">{invitationCount()}</div>
                                <div class="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">VID Linked</div>
                            </div>
                        </div>
                    </div>
                </Motion.div>

                {/* Search & Tabs */}
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-white/5">
                    <div class="flex items-center gap-6 md:gap-8 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                        <button
                            onClick={() => setActiveTab('all')}
                            class={`relative py-4 text-[13px] md:text-sm font-bold transition-colors whitespace-nowrap ${activeTab() === 'all' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            All Contacts
                            <Show when={activeTab() === 'all'}>
                                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                            </Show>
                        </button>
                        <button
                            onClick={() => setActiveTab('favorites')}
                            class={`relative py-4 text-[13px] md:text-sm font-bold transition-colors whitespace-nowrap ${activeTab() === 'favorites' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            Favorites
                            <Show when={activeTab() === 'favorites'}>
                                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                            </Show>
                        </button>
                    </div>

                    <div class="relative w-full md:w-[320px] lg:w-[360px]">
                        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                        <input
                            type="text"
                            placeholder="Search names or identifiers..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            class="w-full bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] focus:border-blue-500/50 rounded-2xl pl-11 pr-4 py-3 text-[13px] md:text-sm text-white outline-none transition-all placeholder:text-gray-600"
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
                                            <span class="text-sm font-bold text-gray-600 uppercase tracking-widest">Loading Contact List...</span>
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
                                                <Show when={contact.address} fallback={
                                                    <Show when={contact.syncStatus === 'ambiguous'} fallback={
                                                        <span class="text-xs font-mono text-gray-600">Wait for sync...</span>
                                                    }>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedContact(contact); }}
                                                            class="text-[10px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-md hover:bg-amber-400/20 transition-all animate-pulse"
                                                        >
                                                            Select Account
                                                        </button>
                                                    </Show>
                                                }>
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
                                                    <Show when={contact.syncStatus === 'ambiguous'} fallback={
                                                        <div class="inline-flex items-center gap-1.5 px-2 py-1 bg-orange-500/5 border border-orange-500/10 rounded-md">
                                                            <div class="w-1 h-1 rounded-full bg-orange-500" />
                                                            <span class="text-[9px] font-black text-orange-400/60 uppercase tracking-widest">Pending</span>
                                                        </div>
                                                    }>
                                                        <div class="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
                                                            <div class="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                                            <span class="text-[9px] font-black text-amber-500 uppercase tracking-widest">Action Required</span>
                                                        </div>
                                                    </Show>
                                                }>
                                                    <div class="inline-flex items-center gap-1.5 px-2 py-1 bg-green-500/5 border border-green-500/10 rounded-md">
                                                        <div class="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_#10b981]" />
                                                        <span class="text-[9px] font-black text-green-400 uppercase tracking-widest">Registered</span>
                                                    </div>
                                                </Show>
                                            </td>
                                            <td class="px-8 py-4 text-right">
                                                <div class="flex items-center justify-end gap-2">
                                                    <Show when={contact.address} fallback={
                                                        <button
                                                            onClick={() => handleInvite(contact)}
                                                            class="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-xl transition-all border border-orange-500/20 active:scale-95 group/invite"
                                                            title="Invite Friend"
                                                        >
                                                            <Share2 class="w-3.5 h-3.5 group-hover/invite:rotate-12 transition-transform" />
                                                            <span class="text-[10px] font-black uppercase tracking-wider">Invite</span>
                                                        </button>
                                                    }>
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
                                                    <button
                                                        onClick={(e) => toggleFavorite(e, contact)}
                                                        class={`p-2 rounded-xl transition-all ${contact.isFavorite ? 'bg-yellow-500/10 text-yellow-500' : 'bg-white/[0.03] hover:bg-white/[0.08] text-gray-500 hover:text-yellow-500'}`}
                                                    >
                                                        <Star class={`w-4 h-4 ${contact.isFavorite ? 'fill-current' : ''}`} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(contact)}
                                                        class="p-2 bg-white/[0.03] hover:bg-white/[0.08] text-gray-500 hover:text-white rounded-xl transition-all"
                                                        title="Edit Contact"
                                                    >
                                                        <Edit3 class="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(contact)}
                                                        class="p-2 bg-white/[0.03] hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-xl transition-all"
                                                        title="Delete Contact"
                                                    >
                                                        <Trash2 class="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </For>
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

            <EditContactModal
                isOpen={isEditModalOpen()}
                onClose={() => { setIsEditModalOpen(false); setContactToEdit(null); }}
                userEmail={props.userProfile().email}
                contact={contactToEdit()}
                onSuccess={loadContacts}
            />

            <SelectionModal
                contact={selectedContact()}
                onClose={() => setSelectedContact(null)}
                userEmail={props.userProfile().email}
                onSuccess={loadContacts}
            />
        </div>
    );
};

const SelectionModal = (props: { contact: Contact | null, onClose: () => void, userEmail: string, onSuccess: () => void }) => {
    const [isSaving, setIsSaving] = createSignal(false);

    const handleSelect = async (match: { vid: string, email: string, address: string }) => {
        if (!props.contact?.id) return;
        setIsSaving(true);
        try {
            const { updateContact } = await import('../../services/firebaseService');
            await updateContact(props.userEmail, props.contact.id, {
                vchainUserUid: match.vid,
                address: match.address,
                email: match.email,
                syncStatus: 'verified',
                potentialMatches: null
            });
            props.onSuccess();
            props.onClose();
        } catch (e) {
            console.error("Failed to select account:", e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Show when={props.contact}>
            <div class="fixed inset-0 z-[130] flex items-center justify-center p-4">
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    class="absolute inset-0 bg-black/90 backdrop-blur-md"
                    onClick={props.onClose}
                />
                <Motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    class="relative w-full max-w-lg bg-[#0d0d0f] border border-white/[0.08] rounded-[32px] p-8 shadow-3xl overflow-hidden"
                >
                    <div class="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[50px] -mr-16 -mt-16" />

                    <div class="relative z-10 text-center mb-8">
                        <div class="w-16 h-16 rounded-[24px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-500">
                            <AlertCircle class="w-8 h-8" />
                        </div>
                        <h3 class="text-2xl font-black text-white italic uppercase tracking-tight">Resolve Ambiguity</h3>
                        <p class="text-sm text-gray-500 mt-2">
                            Multiple accounts found for <span class="text-white font-bold">{props.contact?.internalName}</span> ({props.contact?.phone}).
                            Please select the correct email to link.
                        </p>
                    </div>

                    <div class="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <For each={props.contact?.potentialMatches}>
                            {(match) => (
                                <button
                                    onClick={() => handleSelect(match)}
                                    disabled={isSaving()}
                                    class="w-full flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.06] hover:border-blue-500/50 hover:bg-blue-500/[0.04] rounded-[24px] transition-all group active:scale-[0.98] text-left"
                                >
                                    <div class="flex items-center gap-4">
                                        <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <Mail class="w-5 h-5" />
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="text-[13px] font-black text-white truncate mb-0.5">{match.email}</div>
                                            <div class="flex items-center gap-2">
                                                <span class="text-[10px] font-black text-blue-400/80 uppercase tracking-widest">{match.vid}</span>
                                                <span class="text-[10px] font-mono text-gray-600 truncate max-w-[120px]">{match.address?.substring(0, 10)}...</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-700 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-all">
                                        <ChevronRight class="w-4 h-4" />
                                    </div>
                                </button>
                            )}
                        </For>
                    </div>

                    <button
                        onClick={props.onClose}
                        class="w-full mt-8 py-4 text-xs font-black text-gray-500 hover:text-white uppercase tracking-[0.2em] transition-colors border-t border-white/[0.06]"
                    >
                        Resolve Later
                    </button>
                </Motion.div>
            </div>
        </Show>
    );
};
