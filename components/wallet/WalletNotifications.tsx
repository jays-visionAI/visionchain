import { createSignal, For, Show, createEffect, onCleanup } from 'solid-js';
import {
    Bell,
    Check,
    Info,
    AlertCircle,
    ArrowDownLeft,
    ArrowUpRight,
    Clock,
    Trash2,
    CheckCircle2,
    Calendar,
    Megaphone,
    Globe,
    ChevronLeft,
    ChevronRight,
    Search,
    Inbox,
    MailOpen,
    Filter,
    // Staking icons
    TrendingUp,
    TrendingDown,
    Timer,
    Coins,
    // Referral & Level
    Users,
    UserPlus,
    Award,
    Star,
    // Events & Prizes
    Gift,
    Trophy,
    Medal,
    PartyPopper,
    // System & Security
    Shield,
    ShieldAlert,
    Send,
    Repeat,
    // Announcements
    AlertTriangle,
    Sparkles,
    Wrench,
    ExternalLink
} from 'lucide-solid';
import { Motion, Presence } from 'solid-motionone';
import { useAuth } from '../auth/authContext';
import {
    getFirebaseDb,
    Contact,
    GlobalAnnouncement,
    subscribeToAnnouncements,
    subscribeToReadAnnouncements,
    markAnnouncementRead
} from '../../services/firebaseService';
import {
    collection,
    query,
    onSnapshot,
    updateDoc,
    doc,
    deleteDoc,
    writeBatch,
    getDocs
} from 'firebase/firestore';

import { WalletViewHeader } from './WalletViewHeader';


// Notification types enumeration for better type safety
export type NotificationType =
    // Transfer related
    | 'transfer_received'
    | 'transfer_sent'
    | 'transfer_scheduled'
    // Staking related
    | 'staking_deposit'
    | 'staking_withdrawal'
    | 'staking_pending'
    | 'staking_reward'
    // TimeLock / Scheduled Transfer
    | 'timelock_scheduled'
    | 'timelock_executed'
    | 'timelock_cancelled'
    // Multi-send
    | 'multi_send_complete'
    | 'multi_send_partial'
    // Referral & Level
    | 'referral_signup'
    | 'referral_reward'
    | 'level_up'
    // Events & Prizes
    | 'event_participation'
    | 'event_result'
    | 'prize_winner'
    | 'ranking_update'
    // Bridge
    | 'bridge_finalized'
    | 'bridge_pending'
    | 'challenge_raised'
    // System
    | 'system_announcement'
    | 'system_notice'
    | 'security_alert'
    | 'alert';

export interface NotificationData {
    // Transaction related
    txHash?: string;
    amount?: string;
    token?: string;
    from?: string;
    to?: string;
    // Staking related
    stakingId?: string;
    stakingAmount?: string;
    stakingDuration?: number;
    rewardAmount?: string;
    // Referral related
    referredUser?: string;
    referralLevel?: number;
    bonusAmount?: string;
    // Event/Prize related
    eventId?: string;
    eventName?: string;
    rank?: number;
    prizeAmount?: string;
    // Level up
    previousLevel?: number;
    newLevel?: number;
    // General
    actionUrl?: string;
    expiresAt?: any;
    [key: string]: any;
}

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    content: string;
    timestamp: any;
    read: boolean;
    data?: NotificationData;
    // Enhanced fields
    category?: 'transaction' | 'staking' | 'referral' | 'event' | 'system' | 'security';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    actionable?: boolean;
}

export function WalletNotifications() {
    const auth = useAuth();
    const [notifications, setNotifications] = createSignal<Notification[]>([]);
    const [contacts, setContacts] = createSignal<Contact[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [filter, setFilter] = createSignal<'all' | 'unread'>('all');
    const [selectedId, setSelectedId] = createSignal<string | null>(null);

    // Tab state: 'announcements' | 'notifications'
    const [activeTab, setActiveTab] = createSignal<'announcements' | 'notifications'>('announcements');

    // Announcements state
    const [announcements, setAnnouncements] = createSignal<GlobalAnnouncement[]>([]);
    const [readAnnouncementIds, setReadAnnouncementIds] = createSignal<string[]>([]);
    const [announcementsLoading, setAnnouncementsLoading] = createSignal(true);
    const [selectedAnnouncementId, setSelectedAnnouncementId] = createSignal<string | null>(null);


    // Helper: Resolve wallet address to contact name
    const getContactName = (address: string): string | null => {
        if (!address || !address.startsWith('0x')) return null;
        const contact = contacts().find(c => c.address?.toLowerCase() === address.toLowerCase());
        return contact?.internalName || contact?.email?.split('@')[0] || null;
    };

    // Format value with contact name if available
    const formatWithContactName = (value: string): string => {
        if (!value) return value;
        // Check if value contains an address
        const addressMatch = value.match(/0x[a-fA-F0-9]{40}/);
        if (addressMatch) {
            const address = addressMatch[0];
            const name = getContactName(address);
            if (name) {
                const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
                return value.replace(address, `${name} (${shortAddr})`);
            }
        }
        return value;
    };

    // Load contacts
    createEffect(() => {
        const email = auth.user()?.email;
        if (!email) return;

        const db = getFirebaseDb();
        const contactsRef = collection(db, 'users', email.toLowerCase(), 'contacts');

        const unsubscribe = onSnapshot(query(contactsRef), (snapshot) => {
            const list: Contact[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Contact));
            setContacts(list);
        });

        return () => unsubscribe();
    });

    // Sync Notifications from Firebase
    createEffect(() => {
        const email = auth.user()?.email;
        if (!email) {
            setIsLoading(false);
            return;
        }

        const db = getFirebaseDb();
        const notificationsRef = collection(db, 'users', email.toLowerCase(), 'notifications');

        const unsubscribe = onSnapshot(query(notificationsRef), (snapshot) => {
            const list: Notification[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Notification));

            // Sort by timestamp desc
            list.sort((a, b) => {
                const getVal = (v: any) => {
                    if (!v) return 0;
                    if (v?.toMillis) return v.toMillis();
                    if (v?.seconds) return v.seconds * 1000;
                    return new Date(v).getTime();
                };
                return getVal(b.timestamp) - getVal(a.timestamp);
            });

            setNotifications(list);
            setIsLoading(false);
        }, (error) => {
            console.error("Sync Error:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    });

    // Subscribe to Global Announcements
    createEffect(() => {
        const unsubscribe = subscribeToAnnouncements((list) => {
            setAnnouncements(list);
            setAnnouncementsLoading(false);
        });

        onCleanup(() => unsubscribe());
    });

    // Subscribe to user's read announcements
    createEffect(() => {
        const email = auth.user()?.email;
        if (!email) return;

        const unsubscribe = subscribeToReadAnnouncements(email, (ids) => {
            setReadAnnouncementIds(ids);
        });

        onCleanup(() => unsubscribe());
    });

    // Helper: Check if announcement is read
    const isAnnouncementRead = (id: string): boolean => {
        return readAnnouncementIds().includes(id);
    };

    // Unread announcements count
    const unreadAnnouncementsCount = () => {
        return announcements().filter(a => !isAnnouncementRead(a.id!)).length;
    };

    // Get announcement type meta
    const getAnnouncementMeta = (type: GlobalAnnouncement['type']) => {
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

    // Selected announcement
    const selectedAnnouncement = () => announcements().find(a => a.id === selectedAnnouncementId());

    const markAsRead = async (id: string) => {
        const email = auth.user()?.email;
        if (!email) return;
        const db = getFirebaseDb();
        await updateDoc(doc(db, 'users', email.toLowerCase(), 'notifications', id), { read: true });
    };

    const markAllRead = async () => {
        const email = auth.user()?.email;
        if (!email) return;
        const db = getFirebaseDb();
        const batch = writeBatch(db);
        notifications().filter(n => !n.read).forEach(n => {
            batch.update(doc(db, 'users', email.toLowerCase(), 'notifications', n.id), { read: true });
        });
        await batch.commit();
    };

    const removeNotification = async (id: string) => {
        const email = auth.user()?.email;
        if (!email) return;
        const db = getFirebaseDb();
        await deleteDoc(doc(db, 'users', email.toLowerCase(), 'notifications', id));
        if (selectedId() === id) setSelectedId(null);
    };

    const clearAll = async () => {
        const email = auth.user()?.email;
        if (!email || !confirm("Clear all notifications?")) return;
        const db = getFirebaseDb();
        const batch = writeBatch(db);
        notifications().forEach(n => {
            batch.delete(doc(db, 'users', email.toLowerCase(), 'notifications', n.id));
        });
        await batch.commit();
        setSelectedId(null);
    };

    const filtered = () => {
        if (filter() === 'unread') return notifications().filter(n => !n.read);
        return notifications();
    };

    const selectedItem = () => notifications().find(n => n.id === selectedId());

    const formatTime = (ts: any) => {
        if (!ts) return 'Unknown time';
        const date = ts?.toDate ? ts.toDate() : new Date(ts);
        const diff = Math.floor((Date.now() - date.getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`; // Within a week
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    // Full date/time format for detail view
    const formatFullDate = (ts: any) => {
        if (!ts) return 'Unknown';
        const date = ts?.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getMeta = (type: string) => {
        switch (type) {
            // Transfer related
            case 'transfer_received':
                return { icon: ArrowDownLeft, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Received' };
            case 'transfer_sent':
                return { icon: ArrowUpRight, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Sent' };
            case 'transfer_scheduled':
                return { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Scheduled' };

            // Staking related
            case 'staking_deposit':
                return { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Stake' };
            case 'staking_withdrawal':
                return { icon: TrendingDown, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Unstake' };
            case 'staking_pending':
                return { icon: Timer, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Pending' };
            case 'staking_reward':
                return { icon: Coins, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Reward' };

            // TimeLock / Scheduled Transfer
            case 'timelock_scheduled':
                return { icon: Calendar, color: 'text-indigo-400', bg: 'bg-indigo-400/10', label: 'TimeLock' };
            case 'timelock_executed':
                return { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Executed' };
            case 'timelock_cancelled':
                return { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Cancelled' };

            // Multi-send
            case 'multi_send_complete':
                return { icon: Send, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Multi-Send' };
            case 'multi_send_partial':
                return { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Partial' };

            // Referral & Level
            case 'referral_signup':
                return { icon: UserPlus, color: 'text-teal-400', bg: 'bg-teal-400/10', label: 'Referral' };
            case 'referral_reward':
                return { icon: Gift, color: 'text-pink-400', bg: 'bg-pink-400/10', label: 'Bonus' };
            case 'level_up':
                return { icon: Award, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Level Up' };

            // Events & Prizes
            case 'event_participation':
                return { icon: Star, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Event' };
            case 'event_result':
                return { icon: Medal, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Result' };
            case 'prize_winner':
                return { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Winner' };
            case 'ranking_update':
                return { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Ranking' };

            // Bridge
            case 'bridge_finalized':
                return { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Bridge' };
            case 'bridge_pending':
                return { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Pending' };
            case 'challenge_raised':
                return { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Challenge' };

            // System & Security
            case 'system_announcement':
                return { icon: Megaphone, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Announce' };
            case 'system_notice':
                return { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Notice' };
            case 'security_alert':
                return { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Security' };
            case 'alert':
                return { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Alert' };

            default:
                return { icon: Info, color: 'text-gray-400', bg: 'bg-gray-400/10', label: 'Info' };
        }
    };

    return (
        <div class="flex-1 h-full flex flex-col overflow-hidden bg-[#0A0A0B] max-h-[100dvh]">
            {/* Header Area */}
            <div class="shrink-0">
                <div class="max-w-5xl mx-auto p-4 lg:p-8 pb-0">
                    <WalletViewHeader
                        tag="Communication Hub"
                        title="NOTIFICATION"
                        titleAccent=""
                        description="Stay informed with real-time updates on your assets, security signals, and ecosystem alerts."
                        icon={Bell}
                    />

                    {/* Main Tab Navigation: Announcements vs My Notifications */}
                    <div class="flex bg-white/[0.02] p-1.5 rounded-2xl border border-white/5 mt-4 sm:mt-8 gap-1">
                        <button
                            onClick={() => { setActiveTab('announcements'); setSelectedId(null); setSelectedAnnouncementId(null); }}
                            class={`flex-1 px-2 sm:px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all relative flex items-center justify-center gap-1 sm:gap-2 ${activeTab() === 'announcements' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Megaphone class="w-4 h-4 shrink-0" />
                            <span class="sm:hidden">News</span>
                            <span class="hidden sm:inline">Announcements</span>
                            <Show when={unreadAnnouncementsCount() > 0}>
                                <span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] sm:min-w-[20px] sm:h-5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                    {unreadAnnouncementsCount()}
                                </span>
                            </Show>
                        </button>
                        <button
                            onClick={() => { setActiveTab('notifications'); setSelectedId(null); setSelectedAnnouncementId(null); }}
                            class={`flex-1 px-2 sm:px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all relative flex items-center justify-center gap-1 sm:gap-2 ${activeTab() === 'notifications' ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Bell class="w-4 h-4 shrink-0" />
                            <span class="sm:hidden">Alerts</span>
                            <span class="hidden sm:inline">My Notifications</span>
                            <Show when={notifications().some(n => !n.read)}>
                                <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse" />
                            </Show>
                        </button>
                    </div>

                    {/* Sub-filters for My Notifications tab only */}
                    <Show when={activeTab() === 'notifications'}>
                        <div class="flex flex-wrap items-center justify-between gap-2 mt-3">
                            <div class="flex bg-white/[0.03] p-1 rounded-2xl border border-white/5 w-full sm:w-auto">
                                <button
                                    onClick={() => setFilter('all')}
                                    class={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter() === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                >
                                    All Logs
                                </button>
                                <button
                                    onClick={() => setFilter('unread')}
                                    class={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative ${filter() === 'unread' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Unread
                                    <Show when={notifications().some(n => !n.read)}>
                                        <span class="absolute top-1 right-2 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                                    </Show>
                                </button>
                            </div>

                            <div class="flex items-center gap-2">
                                <button
                                    onClick={markAllRead}
                                    disabled={!notifications().some(n => !n.read)}
                                    class="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all disabled:opacity-30"
                                >
                                    Mark Read
                                </button>
                                <button
                                    onClick={clearAll}
                                    disabled={notifications().length === 0}
                                    class="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 rounded-xl text-[9px] font-black uppercase tracking-wider text-red-400 transition-all disabled:opacity-30"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </Show>
                </div>
            </div>


            {/* List and Detail Layout */}
            <div class="flex-1 flex overflow-hidden relative">
                {/* List View */}
                <div
                    class={`flex-1 flex flex-col overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch transition-all duration-500 ${(activeTab() === 'notifications' ? selectedId() : selectedAnnouncementId()) ? 'hidden lg:flex' : 'flex'}`}
                    style="-webkit-overflow-scrolling: touch;"
                >
                    <div class="max-w-5xl mx-auto w-full px-3 py-2 lg:p-8 lg:pt-4 space-y-2 sm:space-y-3 pb-32">
                        {/* Announcements Tab Content */}
                        <Show when={activeTab() === 'announcements'}>
                            <Show when={!announcementsLoading()} fallback={
                                <div class="flex flex-col items-center justify-center py-20 gap-4">
                                    <div class="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                    <span class="text-[10px] font-black text-gray-600 uppercase tracking-[.2em]">Loading Announcements...</span>
                                </div>
                            }>
                                <For each={announcements()}>
                                    {(item) => {
                                        const meta = getAnnouncementMeta(item.type);
                                        const isRead = isAnnouncementRead(item.id!);
                                        return (
                                            <div
                                                onClick={async () => {
                                                    setSelectedAnnouncementId(item.id!);
                                                    if (!isRead && auth.user()?.email) {
                                                        await markAnnouncementRead(auth.user()!.email!, item.id!);
                                                    }
                                                }}
                                                class={`group relative p-5 rounded-3xl border transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] flex items-center gap-4 ${selectedAnnouncementId() === item.id
                                                    ? 'bg-purple-600/10 border-purple-500/30'
                                                    : isRead ? 'bg-white/[0.01] border-white/5' : 'bg-gradient-to-r from-purple-500/5 to-blue-500/5 border-purple-500/20 ring-1 ring-purple-500/10 shadow-2xl'
                                                    }`}
                                            >
                                                <div class={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${meta.bg}`}>
                                                    <meta.icon class={`w-6 h-6 ${meta.color}`} />
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <div class="flex items-center justify-between mb-1">
                                                        <div class="flex items-center gap-2">
                                                            <span class={`text-[10px] font-black uppercase tracking-widest transition-colors ${isRead ? 'text-gray-600' : 'text-purple-400'}`}>
                                                                {meta.label}
                                                            </span>
                                                            <Show when={item.priority === 'urgent' || item.priority === 'high'}>
                                                                <span class="px-2 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-black uppercase rounded-md">
                                                                    {item.priority}
                                                                </span>
                                                            </Show>
                                                        </div>
                                                        <span class="text-[9px] font-bold text-gray-700">{formatTime(item.createdAt)}</span>
                                                    </div>
                                                    <h4 class={`text-sm font-black truncate uppercase tracking-tight ${isRead ? 'text-gray-500' : 'text-white italic'}`}>
                                                        {item.title}
                                                    </h4>
                                                    <p class="text-[11px] text-gray-600 font-medium truncate mt-0.5">{item.content}</p>
                                                </div>
                                                <div class="shrink-0 transition-transform group-hover:translate-x-1">
                                                    <ChevronRight class={`w-4 h-4 ${selectedAnnouncementId() === item.id ? 'text-purple-400' : 'text-gray-800'}`} />
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>

                                <Show when={announcements().length === 0}>
                                    <div class="flex flex-col items-center justify-center py-24 text-center space-y-6">
                                        <div class="w-24 h-24 bg-white/[0.02] border border-dashed border-white/10 rounded-full flex items-center justify-center">
                                            <Megaphone class="w-10 h-10 text-gray-800" />
                                        </div>
                                        <div>
                                            <p class="text-white font-black italic uppercase tracking-tight">No Announcements</p>
                                            <p class="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-2 px-12 leading-relaxed">All systems operational. No official announcements at this time.</p>
                                        </div>
                                    </div>
                                </Show>
                            </Show>
                        </Show>

                        {/* Notifications Tab Content */}
                        <Show when={activeTab() === 'notifications'}>
                            <Show when={!isLoading()} fallback={
                                <div class="flex flex-col items-center justify-center py-20 gap-4">
                                    <div class="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <span class="text-[10px] font-black text-gray-600 uppercase tracking-[.2em]">Synchronizing Data...</span>
                                </div>
                            }>
                                <For each={filtered()}>
                                    {(item) => {
                                        const meta = getMeta(item.type);
                                        return (
                                            <div
                                                onClick={() => {
                                                    setSelectedId(item.id);
                                                    if (!item.read) markAsRead(item.id);
                                                }}
                                                class={`group relative p-5 rounded-3xl border transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] flex items-center gap-4 ${selectedId() === item.id
                                                    ? 'bg-blue-600/10 border-blue-500/30'
                                                    : item.read ? 'bg-white/[0.01] border-white/5' : 'bg-white/[0.04] border-white/10 ring-1 ring-white/5 shadow-2xl'
                                                    }`}
                                            >
                                                <div class={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${meta.bg}`}>
                                                    <meta.icon class={`w-6 h-6 ${meta.color}`} />
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <div class="flex items-center justify-between mb-1">
                                                        <span class={`text-[10px] font-black uppercase tracking-widest transition-colors ${item.read ? 'text-gray-600' : 'text-blue-400'}`}>
                                                            {meta.label}
                                                        </span>
                                                        <span class="text-[9px] font-bold text-gray-700">{formatTime(item.timestamp)}</span>
                                                    </div>
                                                    <h4 class={`text-sm font-black truncate uppercase tracking-tight ${item.read ? 'text-gray-500' : 'text-white italic'}`}>
                                                        {item.title}
                                                    </h4>
                                                    <p class="text-[11px] text-gray-600 font-medium truncate mt-0.5">{formatWithContactName(item.content)}</p>
                                                </div>
                                                <div class="shrink-0 transition-transform group-hover:translate-x-1">
                                                    <ChevronRight class={`w-4 h-4 ${selectedId() === item.id ? 'text-blue-400' : 'text-gray-800'}`} />
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>

                                <Show when={filtered().length === 0}>
                                    <div class="flex flex-col items-center justify-center py-24 text-center space-y-6">
                                        <div class="w-24 h-24 bg-white/[0.02] border border-dashed border-white/10 rounded-full flex items-center justify-center">
                                            <Inbox class="w-10 h-10 text-gray-800" />
                                        </div>
                                        <div>
                                            <p class="text-white font-black italic uppercase tracking-tight">System Status: Idle</p>
                                            <p class="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-2 px-12 leading-relaxed">No new signals detected in your sector.</p>
                                        </div>
                                    </div>
                                </Show>
                            </Show>
                        </Show>
                    </div>
                </div>


                {/* Detail View Pane */}
                <div
                    class={`flex-[1.2] lg:static fixed inset-0 z-50 bg-[#0A0A0B] flex flex-col transition-all duration-300 transform overflow-y-auto overscroll-contain ${(activeTab() === 'announcements' ? selectedAnnouncementId() : selectedId())
                        ? 'translate-x-0'
                        : 'translate-x-full pointer-events-none lg:translate-x-0 lg:opacity-30 lg:pointer-events-auto'
                        }`}
                    style="-webkit-overflow-scrolling: touch;"
                >
                    {/* Announcement Detail */}
                    <Show when={activeTab() === 'announcements'}>
                        <Show when={selectedAnnouncement()} fallback={
                            <div class="hidden lg:flex flex-col items-center justify-center h-full text-center space-y-6 opacity-30">
                                <Megaphone class="w-16 h-16 text-gray-700" />
                                <p class="text-[11px] font-black text-gray-600 uppercase tracking-[.3em]">Select An Announcement</p>
                            </div>
                        }>
                            {(item) => {
                                const meta = getAnnouncementMeta(item().type);
                                return (
                                    <div class="flex flex-col min-h-full relative">
                                        {/* Mobile Back Button */}
                                        <div class="lg:hidden p-6 absolute top-0 left-0 bg-gradient-to-b from-[#0A0A0B] to-transparent w-full z-10">
                                            <button
                                                onClick={() => setSelectedAnnouncementId(null)}
                                                class="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-black text-[10px] uppercase tracking-widest"
                                            >
                                                <ChevronLeft class="w-4 h-4" /> Back
                                            </button>
                                        </div>

                                        <div class="p-4 lg:p-12 pt-16 lg:pt-12 space-y-8 lg:space-y-12 max-w-2xl mx-auto w-full pb-safe">
                                            <div class="space-y-6">
                                                <div class="flex items-center justify-between">
                                                    <div class={`w-16 h-16 rounded-[28px] flex items-center justify-center ${meta.bg} border-2 border-white/5`}>
                                                        <meta.icon class={`w-8 h-8 ${meta.color}`} />
                                                    </div>
                                                    <div class="flex items-center gap-2 shrink-0">
                                                        <Show when={item().priority === 'urgent' || item().priority === 'high'}>
                                                            <span class="px-2 py-1 bg-red-500/20 text-red-400 text-[9px] font-black uppercase rounded-lg border border-red-500/20 whitespace-nowrap">
                                                                {item().priority}
                                                            </span>
                                                        </Show>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div class="flex flex-wrap items-center gap-3 mb-3">
                                                        <span class={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[.2em] ${meta.bg} ${meta.color} border border-white/5`}>
                                                            {meta.label}
                                                        </span>
                                                        <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[.2em] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                            Official
                                                        </span>
                                                    </div>
                                                    <h2 class="text-2xl sm:text-3xl lg:text-4xl font-black italic text-white leading-[0.95] uppercase tracking-tighter mb-4">
                                                        {item().title}
                                                    </h2>
                                                    <div class="flex flex-col gap-1 border-l-2 border-purple-600/30 pl-4 py-1">
                                                        <p class="text-gray-400 font-medium text-sm">
                                                            {formatFullDate(item().createdAt)}
                                                        </p>
                                                        <p class="text-[10px] text-gray-600 font-medium">
                                                            Posted by: {item().createdBy}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="prose prose-invert max-w-none">
                                                <p class="text-lg lg:text-xl text-gray-400 font-medium leading-[1.6] whitespace-pre-wrap">
                                                    {item().content}
                                                </p>
                                            </div>

                                            <Show when={item().actionUrl}>
                                                <a
                                                    href={item().actionUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all"
                                                >
                                                    <ExternalLink class="w-4 h-4" />
                                                    {item().actionLabel || 'Learn More'}
                                                </a>
                                            </Show>
                                            <div class="h-20 lg:h-0" /> {/* Safe area spacer for mobile */}
                                        </div>
                                    </div>
                                );
                            }}
                        </Show>
                    </Show>

                    {/* Notification Detail */}
                    <Show when={activeTab() === 'notifications'}>
                        <Show when={selectedItem()} fallback={
                            <div class="hidden lg:flex flex-col items-center justify-center h-full text-center space-y-6 opacity-30">
                                <MailOpen class="w-16 h-16 text-gray-700" />
                                <p class="text-[11px] font-black text-gray-600 uppercase tracking-[.3em]">Selection Required For Decryption</p>
                            </div>
                        }>
                            {(item) => {
                                const meta = getMeta(item().type);
                                return (
                                    <div class="flex flex-col min-h-full relative">
                                        {/* Mobile Back Button */}
                                        <div class="lg:hidden p-6 absolute top-0 left-0 bg-gradient-to-b from-[#0A0A0B] to-transparent w-full z-10">
                                            <button
                                                onClick={() => setSelectedId(null)}
                                                class="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-black text-[10px] uppercase tracking-widest"
                                            >
                                                <ChevronLeft class="w-4 h-4" /> Back to logs
                                            </button>
                                        </div>

                                        <div class="p-6 lg:p-12 pt-20 lg:pt-12 space-y-12 max-w-2xl mx-auto w-full">
                                            <div class="space-y-6">
                                                <div class="flex items-center justify-between">
                                                    <div class={`w-16 h-16 rounded-[28px] flex items-center justify-center ${meta.bg} border-2 border-white/5`}>
                                                        <meta.icon class={`w-8 h-8 ${meta.color}`} />
                                                    </div>
                                                    <button
                                                        onClick={() => removeNotification(item().id)}
                                                        class="p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 rounded-2xl text-red-500 transition-all active:scale-95 group"
                                                    >
                                                        <Trash2 class="w-5 h-5 group-hover:shake" />
                                                    </button>
                                                </div>

                                                <div>
                                                    <div class="flex flex-wrap items-center gap-3 mb-3">
                                                        <span class={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[.2em] ${meta.bg} ${meta.color} border border-white/5`}>
                                                            {meta.label}
                                                        </span>
                                                        {item().category && (
                                                            <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[.2em] bg-white/5 text-gray-500 border border-white/5">
                                                                {item().category}
                                                            </span>
                                                        )}
                                                        {item().priority === 'urgent' && (
                                                            <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[.2em] bg-red-500/20 text-red-400 border border-red-500/20">
                                                                Urgent
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h2 class="text-3xl lg:text-4xl font-black italic text-white leading-[0.95] uppercase tracking-tighter mb-4">
                                                        {item().title}
                                                    </h2>
                                                    <div class="flex flex-col gap-1 border-l-2 border-blue-600/30 pl-4 py-1">
                                                        <p class="text-gray-400 font-medium text-sm">
                                                            {formatFullDate(item().timestamp)}
                                                        </p>
                                                        <p class="text-gray-700 font-mono text-[10px] break-all">
                                                            ID: {item().id}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="prose prose-invert max-w-none">
                                                <p class="text-lg lg:text-xl text-gray-400 font-medium leading-[1.6]">
                                                    {formatWithContactName(item().content)}
                                                </p>
                                            </div>

                                            <Show when={item().data}>
                                                <div class="p-8 bg-white/[0.02] border border-white/10 rounded-[40px] space-y-6">
                                                    <div class="text-[10px] font-black text-blue-500 uppercase tracking-[.2em] mb-2 border-b border-white/5 pb-4 flex items-center gap-2">
                                                        <Filter class="w-3 h-3" /> Signal Metadata
                                                    </div>
                                                    <div class="grid grid-cols-1 gap-6">
                                                        <For each={Object.entries(item().data || {})}>
                                                            {([key, val]) => (
                                                                <div class="space-y-1">
                                                                    <p class="text-[9px] font-black text-gray-700 uppercase tracking-widest">{key}</p>
                                                                    <p class="text-sm font-bold text-white font-mono break-all">{formatWithContactName(String(val))}</p>
                                                                </div>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>
                                            </Show>
                                        </div>
                                    </div>
                                );
                            }}
                        </Show>
                    </Show>
                </div>

            </div>
        </div>
    );
}
