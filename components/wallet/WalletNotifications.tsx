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

    const deleteNotification = async (id: string) => {
        if (!auth.user()?.email) return;
        const db = getFirebaseDb();
        const docRef = doc(db, 'users', auth.user().email.toLowerCase(), 'notifications', id);
        await deleteDoc(docRef);
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
        <div class="space-y-8 max-w-4xl mx-auto p-4 custom-scrollbar">
            {/* Header */}
            <div class="flex items-center gap-6">
                <button
                    onClick={() => (window as any).setActiveView?.('chat')}
                    class="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all border border-white/5"
                >
                    <ChevronLeft class="w-6 h-6" />
                </button>
                <div>
                    <h1 class="text-4xl font-bold text-white tracking-tight">Notifications</h1>
                    <p class="text-gray-400 mt-1 font-medium">Stay updated with your account activity.</p>
                </div>
            </div>

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
                        <div class="space-y-4">
                            <Presence>
                                <For each={paginatedNotifications()}>
                                    {(item) => (
                                        <Motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            class={`relative group p-6 rounded-[32px] border transition-all duration-300 ${item.read
                                                ? 'bg-white/[0.01] border-white/5 opacity-60'
                                                : 'bg-gradient-to-br from-white/[0.05] to-transparent border-white/10 shadow-2xl ring-1 ring-white/5'
                                                }`}
                                        >
                                            <div class="flex gap-6">
                                                <div class={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${item.read ? 'bg-white/5' : 'bg-blue-600/10 border border-blue-500/20'
                                                    }`}>
                                                    {getIcon(item.type)}
                                                </div>
                                                <div class="flex-1 min-w-0 pr-12">
                                                    <div class="flex items-center justify-between mb-2">
                                                        <h4 class={`font-black tracking-tight flex items-center gap-2 ${item.read ? 'text-gray-400 text-base' : 'text-white text-lg italic'}`}>
                                                            {item.title}
                                                            <Show when={!item.read}>
                                                                <div class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_#3b82f6]" />
                                                            </Show>
                                                        </h4>
                                                        <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">
                                                            {formatTime(item.timestamp)}
                                                        </span>
                                                    </div>
                                                    <p class={`text-sm leading-relaxed font-medium ${item.read ? 'text-gray-600' : 'text-gray-400'}`}>
                                                        {item.content}
                                                    </p>
                                                    <Show when={item.data?.amount}>
                                                        <div class="mt-4 flex items-center gap-3 px-4 py-2 bg-black/40 border border-white/5 rounded-2xl w-fit">
                                                            <div class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Transaction</span>
                                                            <span class="text-sm font-black text-blue-400">{item.data.amount} {item.data.symbol || 'VCN'}</span>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </div>
                                            <div class="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <Show when={!item.read}>
                                                    <button
                                                        onClick={() => markAsRead(item.id)}
                                                        class="w-10 h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all flex items-center justify-center shadow-lg"
                                                    >
                                                        <Check class="w-5 h-5" />
                                                    </button>
                                                </Show>
                                                <button
                                                    onClick={() => deleteNotification(item.id)}
                                                    class="w-10 h-10 rounded-xl bg-white/5 text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-all border border-white/10 flex items-center justify-center"
                                                >
                                                    <Trash2 class="w-4 h-4" />
                                                </button>
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
    );
}
