import { createSignal, onMount, Show, For } from 'solid-js';
import { collection, query, orderBy, getDocs, getFirestore } from 'firebase/firestore';
import { getFirebaseApp } from '../../services/firebaseService';

interface DailyTip {
    id: string;
    title: string;
    body: string;
    targetView: string;
    order: number;
    enabled: boolean;
}

interface DailyTipCardProps {
    setActiveView: (view: string) => void;
}

export function DailyTipCard(props: DailyTipCardProps) {
    const [tips, setTips] = createSignal<DailyTip[]>([]);
    const [currentIndex, setCurrentIndex] = createSignal(0);
    const [loading, setLoading] = createSignal(true);

    onMount(async () => {
        try {
            const db = getFirestore(getFirebaseApp());
            const q = query(
                collection(db, 'daily_tips'),
                orderBy('order', 'asc')
            );
            const snapshot = await getDocs(q);
            const loaded: DailyTip[] = [];
            snapshot.forEach(doc => {
                const data = doc.data() as DailyTip;
                if (data.enabled) {
                    loaded.push({ id: doc.id, ...data });
                }
            });
            setTips(loaded);

            // Set initial index based on today's date (day-based rotation)
            if (loaded.length > 0) {
                const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
                setCurrentIndex(daysSinceEpoch % loaded.length);
            }
        } catch (e) {
            console.error('[DailyTipCard] Failed to load tips:', e);
        } finally {
            setLoading(false);
        }
    });

    const currentTip = () => tips()[currentIndex()];

    const goNext = (e: Event) => {
        e.stopPropagation();
        const len = tips().length;
        if (len > 0) setCurrentIndex((currentIndex() + 1) % len);
    };

    const goPrev = (e: Event) => {
        e.stopPropagation();
        const len = tips().length;
        if (len > 0) setCurrentIndex((currentIndex() - 1 + len) % len);
    };

    // Lightbulb SVG icon
    const LightbulbIcon = () => (
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
        </svg>
    );

    // Arrow SVG icons
    const ChevronLeftIcon = () => (
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6" />
        </svg>
    );

    const ChevronRightIcon = () => (
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 18 6-6-6-6" />
        </svg>
    );

    const ArrowRightIcon = () => (
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    );

    return (
        <Show when={!loading() && tips().length > 0 && currentTip()}>
            <div class="w-full rounded-2xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-purple-500/30">
                {/* Header Row */}
                <div class="flex items-center justify-between px-4 pt-3 pb-1">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                            <LightbulbIcon />
                        </div>
                        <span class="text-[11px] font-black text-purple-400 uppercase tracking-widest">Did you know?</span>
                    </div>
                    {/* Nav Controls */}
                    <div class="flex items-center gap-1">
                        <button
                            onClick={goPrev}
                            class="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors active:scale-90"
                        >
                            <ChevronLeftIcon />
                        </button>
                        <span class="text-[10px] font-bold text-gray-500 tabular-nums min-w-[32px] text-center">
                            {currentIndex() + 1}/{tips().length}
                        </span>
                        <button
                            onClick={goNext}
                            class="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors active:scale-90"
                        >
                            <ChevronRightIcon />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div class="px-4 pb-3 pt-1">
                    <p class="text-[13px] font-bold text-gray-100 leading-relaxed mb-0.5">
                        {currentTip()!.title}
                    </p>
                    <Show when={currentTip()!.body}>
                        <p class="text-[11px] text-gray-400 leading-relaxed">
                            {currentTip()!.body}
                        </p>
                    </Show>

                    {/* Go Button */}
                    <div class="flex justify-end mt-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const view = currentTip()!.targetView;
                                if (view) props.setActiveView(view);
                            }}
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 text-purple-300 text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95"
                        >
                            Go
                            <ArrowRightIcon />
                        </button>
                    </div>
                </div>
            </div>
        </Show>
    );
}
