import { createSignal, For, Show, onMount, createEffect } from 'solid-js';
import {
    Bell,
    Check,
    Info,
    AlertCircle,
    ArrowDownLeft,
    Clock,
    Trash2,
    CheckCircle2,
    Calendar,
    Megaphone,
    Globe,
    ChevronLeft
} from 'lucide-solid';
import { Motion, Presence } from 'solid-motionone';
import { useAuth } from '../auth/authContext';
import { getFirebaseDb } from '../../services/firebaseService';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    doc,
    deleteDoc,
    writeBatch
} from 'firebase/firestore';

import { WalletViewHeader } from './WalletViewHeader';

export interface Notification {
    id: string;
    type: 'transfer_received' | 'transfer_scheduled' | 'system_announcement' | 'alert';
    title: string;
    content: string;
    timestamp: string;
    read: boolean;
    data?: any;
}

export function WalletNotifications() {
    const auth = useAuth();
    const [notifications, setNotifications] = createSignal<Notification[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [filter, setFilter] = createSignal<'all' | 'unread'>('all');
    const [displayLimit, setDisplayLimit] = createSignal(20);
    const [selectedNotification, setSelectedNotification] = createSignal<Notification | null>(null);

    createEffect(() => {
        const email = auth.user()?.email;
        if (!email) {
            setIsLoading(false);
            return;
        }

        const db = getFirebaseDb();
        const notificationsRef = collection(db, 'users', email.toLowerCase(), 'notifications');
        const q = query(notificationsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Notification[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                list.push({
                    id: doc.id,
                    type: data.type || 'alert',
                    title: data.title || 'Notification',
                    content: data.content || '',
                    timestamp: data.timestamp,
                    read: !!data.read,
                    data: data.data || {}
                } as Notification);
            });

            list.sort((a, b) => {
                const getVal = (v: any) => {
                    if (!v) return 0;
                    if (typeof v === 'object' && v.toMillis) return v.toMillis();
                    if (typeof v === 'object' && v.seconds) return v.seconds * 1000;
                    return new Date(v).getTime();
                };
                return getVal(b.timestamp) - getVal(a.timestamp);
            });

            setNotifications(list);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching notifications:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    });

    const markAsRead = async (id: string) => {
        if (!auth.user()?.email) return;
        const db = getFirebaseDb();
        const docRef = doc(db, 'users', auth.user().email.toLowerCase(), 'notifications', id);
        await updateDoc(docRef, { read: true });
    };

    const markAllAsRead = async () => {
        const email = auth.user()?.email;
        if (!email) return;
        const db = getFirebaseDb();
        const batch = writeBatch(db);
        notifications().filter(n => !n.read).forEach(n => {
            const docRef = doc(db, 'users', email.toLowerCase(), 'notifications', n.id);
            batch.update(docRef, { read: true });
        });
        await batch.commit();
    };

    const deleteNotification = async (id: string, e?: Event) => {
        if (e) e.stopPropagation();
        if (!auth.user()?.email) return;
        const db = getFirebaseDb();
        const docRef = doc(db, 'users', auth.user().email.toLowerCase(), 'notifications', id);
        await deleteDoc(docRef);
        if (selectedNotification()?.id === id) {
            setSelectedNotification(null);
        }
    };

    const deleteAllNotifications = async () => {
        const email = auth.user()?.email;
        if (!email || !confirm("Are you sure you want to delete all notifications?")) return;
        const db = getFirebaseDb();
        const batch = writeBatch(db);
        notifications().forEach(n => {
            const docRef = doc(db, 'users', email.toLowerCase(), 'notifications', n.id);
            batch.delete(docRef);
        });
        await batch.commit();
        setSelectedNotification(null);
    };

    const filteredList = () => {
        const all = notifications();
        if (filter() === 'unread') return all.filter(n => !n.read);
        return all;
    };

    const paginatedNotifications = () => filteredList().slice(0, displayLimit());
    const hasMore = () => filteredList().length > displayLimit();
    const loadMore = () => setDisplayLimit(prev => prev + 20);

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'transfer_received': return <ArrowDownLeft class="w-5 h-5 text-green-400" />;
            case 'transfer_scheduled': return <Clock class="w-5 h-5 text-blue-400" />;
            case 'system_announcement': return <Megaphone class="w-5 h-5 text-purple-400" />;
            case 'alert': return <AlertCircle class="w-5 h-5 text-amber-400" />;
            default: return <Info class="w-5 h-5 text-gray-400" />;
        }
    };

    const formatTime = (ts: any) => {
        if (!ts) return '';
        const date = (ts && typeof ts === 'object' && ts.toDate) ? ts.toDate() : new Date(ts);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (isNaN(date.getTime())) return 'Some time ago';
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <WalletViewHeader
                    tag="Network Alerts"
                    title="PUSH"
                    titleAccent="SYSTEM"
                    description="Real-time updates on your account activity, network status, and governance."
                    rightElement={
                        <div class="flex gap-1.5 p-1 bg-black/20 rounded-xl">
                            <button
                                onClick={() => setFilter('all')}
                                class={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter() === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('unread')}
                                class={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter() === 'unread' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                            >
                                Unread
                            </button>
                        </div>
                    }
                />

                <Show when={!selectedNotification()}>
                    <div class="flex flex-wrap items-center gap-3">
                        <button
                            onClick={deleteAllNotifications}
                            disabled={notifications().length === 0}
                            class="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-0"
                        >
                            Clear All
                        </button>
                        <button
                            onClick={markAllAsRead}
                            disabled={!notifications().some(n => !n.read)}
                            class="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600/10 text-blue-400 hover:text-white hover:bg-blue-600 transition-all disabled:opacity-0"
                        >
                            Mark all as read
                        </button>
                    </div>

                    {/* Filters */}
                    <div class="flex gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-[22px] w-fit">
                        <button
                            onClick={() => { setFilter('all'); setDisplayLimit(20); }}
                            class={`px-8 py-2.5 rounded-[18px] text-sm font-black transition-all uppercase tracking-widest ${filter() === 'all' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => { setFilter('unread'); setDisplayLimit(20); }}
                            class={`px-8 py-2.5 rounded-[18px] text-sm font-black transition-all flex items-center gap-3 uppercase tracking-widest ${filter() === 'unread' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Unread
                            <Show when={notifications().filter(n => !n.read).length > 0}>
                                <span class="px-2 py-0.5 min-w-[20px] rounded-full bg-white/20 text-white text-[10px] flex items-center justify-center font-black">
                                    {notifications().filter(n => !n.read).length}
                                </span>
                            </Show>
                        </button>
                    </div>

                    {/* List */}
                    <div class="space-y-4 pb-12">
                        <Show when={!isLoading()} fallback={
                            <div class="py-32 flex flex-col items-center justify-center space-y-6">
                                <div class="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Syncing notifications...</p>
                            </div>
                        }>
                            <Show when={filteredList().length > 0} fallback={
                                <div class="py-32 flex flex-col items-center justify-center text-center space-y-6 bg-white/[0.01] border border-dashed border-white/10 rounded-[40px]">
                                    <div class="w-20 h-20 rounded-3xl bg-white/[0.03] flex items-center justify-center">
                                        <Bell class="w-10 h-10 text-gray-700" />
                                    </div>
                                    <div>
                                        <h3 class="text-white font-black text-xl uppercase tracking-tight italic">All caught up!</h3>
                                        <p class="text-gray-500 max-w-[280px] mt-2 font-medium">No new notifications to show at the moment.</p>
                                    </div>
                                </div>
                            }>
                                <div class="grid grid-cols-1 gap-4">
                                    <Presence>
                                        <For each={paginatedNotifications()}>
                                            {(item) => (
                                                <Motion.div
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    onClick={() => { setSelectedNotification(item); if (!item.read) markAsRead(item.id); }}
                                                    class={`group relative p-6 rounded-[32px] border transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${item.read
                                                        ? 'bg-white/[0.01] border-white/5'
                                                        : 'bg-gradient-to-br from-white/[0.05] to-transparent border-white/10 shadow-2xl ring-1 ring-white/5'
                                                        }`}
                                                >
                                                    <div class="flex items-center gap-6">
                                                        <div class={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${item.read ? 'bg-white/5' : 'bg-blue-600/10'}`}>
                                                            {getIcon(item.type)}
                                                        </div>
                                                        <div class="flex-1 min-w-0">
                                                            <div class="flex items-center justify-between gap-4 mb-1">
                                                                <h4 class={`font-black uppercase tracking-tight truncate ${item.read ? 'text-gray-500' : 'text-white italic'}`}>
                                                                    {item.title}
                                                                </h4>
                                                                <span class="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] shrink-0">
                                                                    {formatTime(item.timestamp)}
                                                                </span>
                                                            </div>
                                                            <p class="text-xs text-gray-500 font-medium truncate">
                                                                {item.content}
                                                            </p>
                                                        </div>
                                                        <Show when={!item.read}>
                                                            <div class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_#3b82f6]" />
                                                        </Show>
                                                        <div class="ml-4 p-2 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2
                                                                class="w-4 h-4 text-gray-600 hover:text-red-500"
                                                                onClick={(e) => deleteNotification(item.id, e)}
                                                            />
                                                        </div>
                                                    </div>
                                                </Motion.div>
                                            )}
                                        </For>
                                    </Presence>
                                    <Show when={hasMore()}>
                                        <button
                                            onClick={loadMore}
                                            class="w-full py-4 bg-white/[0.02] hover:bg-white/[0.05] border border-dashed border-white/10 rounded-[32px] text-[10px] font-black text-gray-500 hover:text-white transition-all uppercase tracking-[0.3em] group mt-4"
                                        >
                                            Load More
                                        </button>
                                    </Show>
                                </div>
                            </Show>
                        </Show>
                    </div>
                </Show>

                {/* Detail View */}
                <Show when={selectedNotification()}>
                    {(item) => (
                        <Motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            class="space-y-6"
                        >
                            <button
                                onClick={() => setSelectedNotification(null)}
                                class="flex items-center gap-2 text-[10px] font-black text-gray-600 hover:text-white uppercase tracking-[0.2em] transition-colors mb-4"
                            >
                                <ChevronLeft class="w-4 h-4" />
                                Back to notifications
                            </button>

                            <div class="bg-[#111114] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl">
                                <div class="bg-white/[0.02] p-8 border-b border-white/5">
                                    <div class="flex items-center justify-between mb-8">
                                        <div class={`w-16 h-16 rounded-2xl flex items-center justify-center bg-blue-600/10 border border-blue-500/20`}>
                                            {getIcon(item().type)}
                                        </div>
                                        <button
                                            onClick={() => deleteNotification(item().id)}
                                            class="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                                        >
                                            <Trash2 class="w-4 h-4" />
                                            Delete Alert
                                        </button>
                                    </div>
                                    <h2 class="text-3xl lg:text-4xl font-black italic text-white uppercase tracking-tight mb-2">
                                        {item().title}
                                    </h2>
                                    <div class="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-widest">
                                        <Clock class="w-4 h-4" />
                                        {new Date(item().timestamp).toLocaleString()}
                                    </div>
                                </div>

                                <div class="p-8 lg:p-12 space-y-8">
                                    <div class="prose prose-invert max-w-none">
                                        <p class="text-lg lg:text-xl text-gray-400 font-medium leading-relaxed">
                                            {item().content}
                                        </p>
                                    </div>

                                    <Show when={item().data?.amount}>
                                        <div class="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl">
                                            <div class="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Transaction Details</div>
                                            <div class="flex items-end justify-between">
                                                <div>
                                                    <div class="text-4xl font-black text-white italic">
                                                        {item().data.amount} <span class="text-blue-500">{item().data.symbol || 'VCN'}</span>
                                                    </div>
                                                    <div class="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">Confirmed on-chain</div>
                                                </div>
                                                <div class="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                    <ArrowDownLeft class="w-6 h-6 text-blue-400" />
                                                </div>
                                            </div>
                                        </div>
                                    </Show>

                                    <Show when={item().data?.image}>
                                        <div class="rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                                            <img src={item().data.image} alt="Notification attachment" class="w-full h-auto" />
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        </Motion.div>
                    )}
                </Show>

                {/* System Status Footer */}
                <div class="p-8 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-[40px] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-8 mt-12 shadow-2xl">
                    <div class="flex items-center gap-6">
                        <div class="w-14 h-14 rounded-3xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                            <Globe class="w-7 h-7 text-blue-500" />
                        </div>
                        <div>
                            <div class="text-white font-black text-lg tracking-tight italic uppercase">Native Sync Engine</div>
                            <div class="text-xs text-gray-500 font-bold uppercase tracking-widest">Connected • Secure Gateway Active</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 px-6 py-2.5 bg-green-500/5 border border-green-500/10 rounded-full shadow-inner">
                        <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]" />
                        <span class="text-[10px] font-black text-green-500 uppercase tracking-[0.2em]">Secure Gateway Active</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
