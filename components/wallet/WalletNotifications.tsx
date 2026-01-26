import { createSignal, For, Show, onMount } from 'solid-js';
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
    Globe
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

    onMount(() => {
        if (!auth.user()?.email) return;

        const db = getFirebaseDb();
        const notificationsRef = collection(db, 'users', auth.user().email.toLowerCase(), 'notifications');
        const q = query(notificationsRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Notification[] = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() } as Notification);
            });
            setNotifications(list);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching notifications:", error);
            setIsLoading(false);
        });

        return unsubscribe;
    });

    const markAsRead = async (id: string) => {
        if (!auth.user()?.email) return;
        const db = getFirebaseDb();
        const docRef = doc(db, 'users', auth.user().email.toLowerCase(), 'notifications', id);
        await updateDoc(docRef, { read: true });
    };

    const markAllAsRead = async () => {
        if (!auth.user()?.email) return;
        const db = getFirebaseDb();
        const batch = writeBatch(db);

        notifications().filter(n => !n.read).forEach(n => {
            const docRef = doc(db, 'users', auth.user().email.toLowerCase(), 'notifications', n.id);
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

    const filteredNotifications = () => {
        if (filter() === 'unread') {
            return notifications().filter(n => !n.read);
        }
        return notifications();
    };

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'transfer_received': return <ArrowDownLeft class="w-4 h-4 text-green-400" />;
            case 'transfer_scheduled': return <Clock class="w-4 h-4 text-blue-400" />;
            case 'system_announcement': return <Megaphone class="w-4 h-4 text-purple-400" />;
            case 'alert': return <AlertCircle class="w-4 h-4 text-amber-400" />;
            default: return <Info class="w-4 h-4 text-gray-400" />;
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div class="space-y-8 max-w-4xl mx-auto">
            {/* Header */}
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-bold text-white">Notifications</h1>
                    <p class="text-gray-400 mt-1">Stay updated with your account activity.</p>
                </div>
                <div class="flex items-center gap-2">
                    <button
                        onClick={markAllAsRead}
                        disabled={!notifications().some(n => !n.read)}
                        class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-0"
                    >
                        Mark all as read
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div class="flex gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-[18px] w-fit">
                <button
                    onClick={() => setFilter('all')}
                    class={`px-6 py-2 rounded-[14px] text-sm font-bold transition-all ${filter() === 'all' ? 'bg-white/10 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter('unread')}
                    class={`px-6 py-2 rounded-[14px] text-sm font-bold transition-all flex items-center gap-2 ${filter() === 'unread' ? 'bg-white/10 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Unread
                    <Show when={notifications().filter(n => !n.read).length > 0}>
                        <span class="w-5 h-5 rounded-full bg-cyan-500 text-black text-[10px] flex items-center justify-center">
                            {notifications().filter(n => !n.read).length}
                        </span>
                    </Show>
                </button>
            </div>

            {/* List */}
            <div class="space-y-3">
                <Show when={!isLoading()} fallback={
                    <div class="py-20 flex flex-col items-center justify-center space-y-4">
                        <div class="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                        <p class="text-gray-500 font-medium">Syncing notifications...</p>
                    </div>
                }>
                    <Show when={filteredNotifications().length > 0} fallback={
                        <div class="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.02] border border-white/5 rounded-[32px]">
                            <div class="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center">
                                <Bell class="w-8 h-8 text-gray-600" />
                            </div>
                            <div>
                                <h3 class="text-white font-bold text-lg">All caught up!</h3>
                                <p class="text-gray-500 max-w-[240px] mt-1">No new notifications to show at the moment.</p>
                            </div>
                        </div>
                    }>
                        <Presence>
                            <For each={filteredNotifications()}>
                                {(item) => (
                                    <Motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        class={`relative group p-5 rounded-[24px] border transition-all ${item.read
                                            ? 'bg-white/[0.01] border-white/5'
                                            : 'bg-white/[0.04] border-white/10 shadow-lg shadow-black/20'
                                            }`}
                                    >
                                        <div class="flex gap-4">
                                            <div class={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${item.read ? 'bg-white/5' : 'bg-gradient-to-br from-white/10 to-white/5'
                                                }`}>
                                                {getIcon(item.type)}
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center justify-between mb-1">
                                                    <h4 class={`font-bold truncate ${item.read ? 'text-gray-300' : 'text-white text-lg'}`}>
                                                        {item.title}
                                                    </h4>
                                                    <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider shrink-0">
                                                        {formatTime(item.timestamp)}
                                                    </span>
                                                </div>
                                                <p class={`text-sm leading-relaxed ${item.read ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {item.content}
                                                </p>

                                                <Show when={item.data?.amount}>
                                                    <div class="mt-3 flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg w-fit">
                                                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Amount</span>
                                                        <span class="text-sm font-bold text-cyan-400">{item.data.amount} {item.data.symbol || 'VCN'}</span>
                                                    </div>
                                                </Show>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div class="absolute right-4 bottom-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Show when={!item.read}>
                                                <button
                                                    onClick={() => markAsRead(item.id)}
                                                    class="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-all border border-green-500/20"
                                                    title="Mark as read"
                                                >
                                                    <Check class="w-4 h-4" />
                                                </button>
                                            </Show>
                                            <button
                                                onClick={() => deleteNotification(item.id)}
                                                class="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all border border-white/10 hover:border-red-500/20"
                                                title="Delete"
                                            >
                                                <Trash2 class="w-4 h-4" />
                                            </button>
                                        </div>

                                        <Show when={!item.read}>
                                            <div class="absolute top-4 left-4 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                                        </Show>
                                    </Motion.div>
                                )}
                            </For>
                        </Presence>
                    </Show>
                </Show>
            </div>

            {/* System Status Footer */}
            <div class="p-6 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-[32px] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                        <Globe class="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <div class="text-white font-bold">Native Sync Engine</div>
                        <div class="text-xs text-gray-500">Connected to Vision Chain Notification Node</div>
                    </div>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
                    <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span class="text-[10px] font-black text-green-500 uppercase tracking-widest">Active & Secure</span>
                </div>
            </div>
        </div>
    );
}
