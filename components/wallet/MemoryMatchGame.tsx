import { createSignal, Show, For, onMount, onCleanup, createMemo, Accessor } from 'solid-js';
import { GameAudio } from '../../services/game/GameAudio';

// ─── Types ──────────────────────────────────────────────────────────────────
interface MemoryCard {
    id: number;
    coinId: string;
    flipped: boolean;
    matched: boolean;
}

interface MemoryMatchProps {
    onComplete: (result: { vcn: number; rp: number; time: number; attempts: number; grade: string }) => void;
    onBack: () => void;
    todayBest?: number; // Today's best time from leaderboard
    todayBestBy?: string; // Who holds today's best
}

// ─── Coin Data (12 coins, 10 pairs randomly selected per game) ──────────────
const ALL_COINS = [
    { id: 'btc', name: 'BTC', color: '#F7931A', bg: '#F7931A20' },
    { id: 'eth', name: 'ETH', color: '#627EEA', bg: '#627EEA20' },
    { id: 'sol', name: 'SOL', color: '#14F195', bg: '#14F19520' },
    { id: 'vcn', name: 'VCN', color: '#22D3EE', bg: '#22D3EE20' },
    { id: 'bnb', name: 'BNB', color: '#F3BA2F', bg: '#F3BA2F20' },
    { id: 'xrp', name: 'XRP', color: '#23292F', bg: '#ffffff15' },
    { id: 'doge', name: 'DOGE', color: '#C3A634', bg: '#C3A63420' },
    { id: 'ada', name: 'ADA', color: '#0D1E30', bg: '#3B82F620' },
    { id: 'avax', name: 'AVAX', color: '#E84142', bg: '#E8414220' },
    { id: 'dot', name: 'DOT', color: '#E6007A', bg: '#E6007A20' },
    { id: 'link', name: 'LINK', color: '#2A5ADA', bg: '#2A5ADA20' },
    { id: 'matic', name: 'MATIC', color: '#8247E5', bg: '#8247E520' },
];

const TOTAL_PAIRS = 10; // 20 cards = 10 pairs

// ─── Coin Logo SVGs ─────────────────────────────────────────────────────────
const CoinLogo = (props: { coinId: string; class?: string }) => {
    const coin = ALL_COINS.find(c => c.id === props.coinId);
    if (!coin) return null;

    return (
        <div class={`flex items-center justify-center ${props.class || ''}`}
            style={{ background: coin.bg, 'border-radius': '50%' }}>
            {props.coinId === 'btc' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#F7931A" />
                    <path d="M21.2 14.2c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.7 2.7c-.4-.1-.8-.2-1.3-.3l.7-2.7-1.7-.4-.6 2.7c-.3-.1-.7-.2-1-.3l-2.3-.6-.5 1.8s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.2c0 0 .1 0 .2.1h-.2l-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5c.4.1.8.2 1.2.3l-.7 2.8 1.6.4.7-2.7c.5.1.9.2 1.3.3l-.7 2.7 1.7.4.7-2.8c2.8.5 4.9.3 5.8-2.2.7-2-.1-3.2-1.5-3.9 1.1-.3 1.9-1.1 2.1-2.7zm-3.7 5.2c-.5 2-4 .9-5.1.7l.9-3.7c1.1.3 4.7.8 4.2 3zm.5-5.3c-.5 1.8-3.4.9-4.3.7l.8-3.3c.9.2 4 .6 3.5 2.6z"
                        fill="white" />
                </svg>
            )}
            {props.coinId === 'eth' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#627EEA" />
                    <path d="M16 5l-7.5 12L16 21l7.5-4L16 5z" fill="white" opacity="0.6" />
                    <path d="M16 5v16l7.5-4L16 5z" fill="white" opacity="0.9" />
                    <path d="M16 22.5l-7.5-4.5L16 27l7.5-9L16 22.5z" fill="white" opacity="0.6" />
                    <path d="M16 22.5V27l7.5-9L16 22.5z" fill="white" opacity="0.9" />
                </svg>
            )}
            {props.coinId === 'sol' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="url(#solGrad)" />
                    <defs><linearGradient id="solGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#9945FF" /><stop offset="100%" stop-color="#14F195" />
                    </linearGradient></defs>
                    <path d="M9 20.5h11.5l2.5-2.5H11.5L9 20.5zm0-5h14l-2.5-2.5H9l0 2.5zm14-2.5H11.5L9 10.5h11.5l2.5 2z" fill="white" />
                </svg>
            )}
            {props.coinId === 'vcn' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#0E7490" />
                    <circle cx="16" cy="16" r="10" stroke="#22D3EE" stroke-width="1.5" fill="none" />
                    <text x="16" y="20" text-anchor="middle" fill="#22D3EE" font-size="12" font-weight="bold">V</text>
                </svg>
            )}
            {props.coinId === 'bnb' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#F3BA2F" />
                    <path d="M16 8l-3 3 3 3 3-3-3-3zm-6 6l-3 3 3 3 3-3-3-3zm12 0l-3 3 3 3 3-3-3-3zm-6 6l-3 3 3 3 3-3-3-3z" fill="white" />
                </svg>
            )}
            {props.coinId === 'xrp' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#23292F" />
                    <path d="M11 10h2.5l2.5 4 2.5-4H21l-4 6 4 6h-2.5L16 18l-2.5 4H11l4-6-4-6z" fill="white" />
                </svg>
            )}
            {props.coinId === 'doge' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#C3A634" />
                    <text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold">D</text>
                </svg>
            )}
            {props.coinId === 'ada' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#0D1E30" />
                    <circle cx="16" cy="8" r="2" fill="#3B82F6" />
                    <circle cx="16" cy="24" r="2" fill="#3B82F6" />
                    <circle cx="9" cy="12" r="1.5" fill="#3B82F6" />
                    <circle cx="23" cy="12" r="1.5" fill="#3B82F6" />
                    <circle cx="9" cy="20" r="1.5" fill="#3B82F6" />
                    <circle cx="23" cy="20" r="1.5" fill="#3B82F6" />
                    <circle cx="16" cy="16" r="4" stroke="#3B82F6" stroke-width="1" fill="none" />
                </svg>
            )}
            {props.coinId === 'avax' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#E84142" />
                    <path d="M11 22h3l2-6 2 6h3L16 8 11 22z" fill="white" />
                </svg>
            )}
            {props.coinId === 'dot' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#E6007A" />
                    <circle cx="16" cy="16" r="5" fill="white" />
                    <circle cx="16" cy="7" r="2.5" fill="white" />
                    <circle cx="16" cy="25" r="2.5" fill="white" />
                </svg>
            )}
            {props.coinId === 'link' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#2A5ADA" />
                    <polygon points="16,6 24,11 24,21 16,26 8,21 8,11" fill="none" stroke="white" stroke-width="2" />
                    <polygon points="16,10 20,13 20,19 16,22 12,19 12,13" fill="white" opacity="0.3" />
                </svg>
            )}
            {props.coinId === 'matic' && (
                <svg viewBox="0 0 32 32" class="w-8 h-8">
                    <circle cx="16" cy="16" r="15" fill="#8247E5" />
                    <path d="M20 12l-4-2.5L12 12v5l4 2.5 4-2.5v-5z" fill="white" opacity="0.5" />
                    <path d="M16 14.5l4 2.5v5l-4 2.5-4-2.5v-5l4-2.5z" fill="white" />
                </svg>
            )}
        </div>
    );
};

// ─── Card Back SVG ──────────────────────────────────────────────────────────
const CardBack = () => (
    <div class="w-full h-full rounded-xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/[0.08] flex items-center justify-center relative overflow-hidden">
        <div class="absolute inset-0 opacity-[0.03]" style={{
            'background-image': `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(34,211,238,0.3) 8px, rgba(34,211,238,0.3) 9px)`,
        }} />
        <svg viewBox="0 0 32 32" class="w-8 h-8 text-cyan-500/30">
            <circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="1.5" fill="none" />
            <text x="16" y="20" text-anchor="middle" fill="currentColor" font-size="12" font-weight="bold">V</text>
        </svg>
    </div>
);

// ─── Star Rating SVG ────────────────────────────────────────────────────────
const StarRating = (props: { filled: number; total: number }) => (
    <div class="flex items-center gap-1">
        <For each={Array.from({ length: props.total })}>
            {(_, i) => (
                <svg viewBox="0 0 24 24" class={`w-6 h-6 ${i() < props.filled ? 'text-amber-400' : 'text-gray-700'}`}
                    fill="currentColor">
                    <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                </svg>
            )}
        </For>
    </div>
);

// ─── Grade badge component ──────────────────────────────────────────────────
const GradeBadge = (props: { grade: string }) => {
    const config: Record<string, { label: string; color: string; bg: string; stars: number }> = {
        PERFECT: { label: 'PERFECT', color: 'text-amber-400', bg: 'from-amber-500/20 to-orange-500/20', stars: 3 },
        GREAT: { label: 'GREAT', color: 'text-cyan-400', bg: 'from-cyan-500/20 to-blue-500/20', stars: 2 },
        GOOD: { label: 'GOOD', color: 'text-green-400', bg: 'from-green-500/20 to-emerald-500/20', stars: 1 },
        CLEAR: { label: 'CLEAR', color: 'text-gray-400', bg: 'from-gray-500/20 to-gray-600/20', stars: 0 },
    };
    const c = config[props.grade] || config.CLEAR;
    return (
        <div class="flex flex-col items-center gap-2">
            <StarRating filled={c.stars} total={3} />
            <div class={`text-3xl font-black ${c.color} bg-gradient-to-r ${c.bg} px-6 py-2 rounded-2xl`}>
                {c.label}
            </div>
        </div>
    );
};

// ─── Helper: Shuffle ────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export const MemoryMatchGame = (props: MemoryMatchProps) => {
    // ── State ──
    const [cards, setCards] = createSignal<MemoryCard[]>([]);
    const [flippedIds, setFlippedIds] = createSignal<number[]>([]);
    const [matchedPairs, setMatchedPairs] = createSignal(0);
    const [attempts, setAttempts] = createSignal(0);
    const [combo, setCombo] = createSignal(0);
    const [maxCombo, setMaxCombo] = createSignal(0);
    const [timer, setTimer] = createSignal(0);
    const [isRunning, setIsRunning] = createSignal(false);
    const [isLocked, setIsLocked] = createSignal(true); // Locked during preview
    const [showPreview, setShowPreview] = createSignal(true);
    const [gameOver, setGameOver] = createSignal(false);
    const [grade, setGrade] = createSignal('CLEAR');
    const [reward, setReward] = createSignal({ vcn: 0, rp: 0 });
    const [lastMatchAnim, setLastMatchAnim] = createSignal<string | null>(null);
    const [shakeId, setShakeId] = createSignal<number | null>(null);

    const totalPairs = TOTAL_PAIRS;
    let timerInterval: ReturnType<typeof setInterval> | null = null;
    let startTime = 0;

    // ── Initialize ──
    onMount(() => {
        initGame();
        GameAudio.startBGM('memory');
    });

    onCleanup(() => {
        if (timerInterval) clearInterval(timerInterval);
        GameAudio.stopBGM();
    });

    const initGame = () => {
        // Randomly select 10 coins from 12 (VCN always included)
        const vcnCoin = ALL_COINS.find(c => c.id === 'vcn')!;
        const otherCoins = shuffle(ALL_COINS.filter(c => c.id !== 'vcn'));
        const selectedCoins = [vcnCoin, ...otherCoins.slice(0, TOTAL_PAIRS - 1)];

        // Create pairs
        const pairs: MemoryCard[] = [];
        selectedCoins.forEach((coin, idx) => {
            pairs.push({ id: idx * 2, coinId: coin.id, flipped: false, matched: false });
            pairs.push({ id: idx * 2 + 1, coinId: coin.id, flipped: false, matched: false });
        });
        setCards(shuffle(pairs));
        setFlippedIds([]);
        setMatchedPairs(0);
        setAttempts(0);
        setCombo(0);
        setMaxCombo(0);
        setTimer(0);
        setIsRunning(false);
        setGameOver(false);
        setShowPreview(true);
        setIsLocked(true);

        // Preview: show all cards for 2s (more cards need more memorization time)
        setTimeout(() => {
            setShowPreview(false);
            setIsLocked(false);
            // Start timer
            startTime = Date.now();
            setIsRunning(true);
            timerInterval = setInterval(() => {
                setTimer(+(((Date.now() - startTime) / 1000).toFixed(1)));
            }, 100);
        }, 2000);
    };

    // ── Card Click ──
    const handleCardClick = (card: MemoryCard) => {
        if (isLocked() || card.matched || card.flipped || gameOver()) return;
        if (flippedIds().length >= 2) return;

        GameAudio.play('cardFlip');

        // Flip card
        const newCards = cards().map(c => c.id === card.id ? { ...c, flipped: true } : c);
        setCards(newCards);

        const newFlipped = [...flippedIds(), card.id];
        setFlippedIds(newFlipped);

        if (newFlipped.length === 2) {
            setIsLocked(true);
            setAttempts(a => a + 1);

            const [id1, id2] = newFlipped;
            const card1 = newCards.find(c => c.id === id1)!;
            const card2 = newCards.find(c => c.id === id2)!;

            if (card1.coinId === card2.coinId) {
                // Match!
                const newCombo = combo() + 1;
                setCombo(newCombo);
                if (newCombo > maxCombo()) setMaxCombo(newCombo);

                GameAudio.play(newCombo > 1 ? 'matchCombo' : 'match');
                setLastMatchAnim(card1.coinId);
                setTimeout(() => setLastMatchAnim(null), 600);

                setTimeout(() => {
                    setCards(prev => prev.map(c =>
                        c.coinId === card1.coinId ? { ...c, matched: true } : c
                    ));
                    const newPairs = matchedPairs() + 1;
                    setMatchedPairs(newPairs);
                    setFlippedIds([]);
                    setIsLocked(false);

                    // Increase BGM octave on match
                    GameAudio.setBGMIntensity(newPairs / totalPairs);

                    // Check win
                    if (newPairs >= totalPairs) {
                        endGame();
                    }
                }, 500);
            } else {
                // Miss
                setCombo(0);
                GameAudio.play('miss');

                // Shake animation
                setShakeId(id1);
                setTimeout(() => setShakeId(id2), 50);

                setTimeout(() => {
                    setCards(prev => prev.map(c =>
                        (c.id === id1 || c.id === id2) ? { ...c, flipped: false } : c
                    ));
                    setFlippedIds([]);
                    setIsLocked(false);
                    setShakeId(null);
                }, 800);
            }
        }
    };

    // ── End Game ──
    const endGame = () => {
        if (timerInterval) clearInterval(timerInterval);
        setIsRunning(false);
        setGameOver(true);

        const t = timer();
        const att = attempts();

        // Grade (adjusted for 20 cards = harder)
        let g = 'CLEAR';
        if (t < 30) g = 'PERFECT';
        else if (t < 50) g = 'GREAT';
        else if (t < 80) g = 'GOOD';
        setGrade(g);

        // Reward (higher rewards for harder game)
        const rewards: Record<string, { vcn: number; rp: number }> = {
            PERFECT: { vcn: 4.5, rp: 37 },
            GREAT: { vcn: 2.5, rp: 20 },
            GOOD: { vcn: 1.2, rp: 10 },
            CLEAR: { vcn: 0.5, rp: 4 },
        };
        let r = { ...rewards[g] };

        // Minimum attempts bonus (8 attempts = perfect memory)
        if (att <= totalPairs) {
            r.vcn = +(r.vcn * 1.5).toFixed(1);
            r.rp = Math.round(r.rp * 1.5);
        }

        setReward(r);

        // Sound
        if (g === 'PERFECT') {
            GameAudio.play('perfect');
        } else {
            GameAudio.play('win');
        }

        GameAudio.stopBGM();

        // Callback
        props.onComplete({ vcn: r.vcn, rp: r.rp, time: t, attempts: att, grade: g });
    };

    // ── Render ──
    return (
        <div class="space-y-5 px-4 pb-6">
            {/* Back button */}
            <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
                class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2"
                style="touch-action: manipulation;">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to games
            </button>

            {/* Beat This Banner */}
            <Show when={props.todayBest && props.todayBest > 0 && !gameOver()}>
                <div class="flex items-center gap-3 px-4 py-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" />
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                    <span class="text-xs text-amber-400 font-bold">
                        Beat this! {props.todayBest}s by {props.todayBestBy || 'Unknown'}
                    </span>
                </div>
            </Show>

            {/* HUD */}
            <Show when={!gameOver()}>
                <div class="flex items-center justify-between px-4 py-3 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                    <div class="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                        </svg>
                        <span class="text-lg font-black text-white tabular-nums">{timer().toFixed(1)}s</span>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-xs text-gray-500">
                            <span class="font-bold text-white">{attempts()}</span> attempts
                        </div>
                        <div class="text-xs text-gray-500">
                            <span class="font-bold text-cyan-400">{matchedPairs()}</span>/{totalPairs}
                        </div>
                        <Show when={combo() > 1}>
                            <div class="text-xs font-black text-amber-400 animate-pulse">
                                x{combo()} COMBO
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* Card Grid */}
            <Show when={!gameOver()}>
                <div class="grid grid-cols-5 gap-2 sm:gap-2.5 max-w-lg mx-auto" style="perspective: 1000px;">
                    <For each={cards()}>
                        {(card) => {
                            const isFlipped = () => card.flipped || showPreview() || card.matched;
                            const isMatched = () => card.matched;
                            const isShaking = () => shakeId() === card.id;
                            const isMatchAnim = () => lastMatchAnim() === card.coinId && card.matched;

                            return (
                                <button
                                    onClick={() => handleCardClick(card)}
                                    disabled={isLocked() || card.matched}
                                    class={`relative aspect-square transition-all duration-200
                                        ${isMatched() ? 'opacity-30 scale-90' : 'hover:scale-[1.03] active:scale-95'}
                                        ${isMatchAnim() ? 'ring-2 ring-green-400/50' : ''}
                                        ${isShaking() ? 'animate-shake' : ''}
                                    `}
                                    style={{
                                        'touch-action': 'manipulation',
                                        '-webkit-tap-highlight-color': 'transparent',
                                        'transform-style': 'preserve-3d',
                                    }}
                                >
                                    <div
                                        class="w-full h-full transition-transform duration-300"
                                        style={{
                                            'transform-style': 'preserve-3d',
                                            transform: isFlipped() ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                        }}
                                    >
                                        {/* Front (back of card - VCN logo) */}
                                        <div class="absolute inset-0" style={{ 'backface-visibility': 'hidden' }}>
                                            <CardBack />
                                        </div>
                                        {/* Back (coin face) */}
                                        <div class="absolute inset-0 rounded-xl bg-[#111113] border border-white/[0.08] flex items-center justify-center"
                                            style={{
                                                'backface-visibility': 'hidden',
                                                transform: 'rotateY(180deg)',
                                            }}>
                                            <CoinLogo coinId={card.coinId} class="w-10 h-10 sm:w-12 sm:h-12" />
                                        </div>
                                    </div>
                                </button>
                            );
                        }}
                    </For>
                </div>
            </Show>

            {/* Result Screen */}
            <Show when={gameOver()}>
                <div class="flex flex-col items-center gap-6 py-8 animate-in fade-in zoom-in-75 duration-500">
                    <GradeBadge grade={grade()} />

                    <div class="grid grid-cols-2 gap-4 w-full max-w-xs">
                        <div class="text-center p-3 bg-[#111113]/60 rounded-xl border border-white/[0.04]">
                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Time</div>
                            <div class="text-xl font-black text-white">{timer().toFixed(1)}s</div>
                        </div>
                        <div class="text-center p-3 bg-[#111113]/60 rounded-xl border border-white/[0.04]">
                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Attempts</div>
                            <div class="text-xl font-black text-white">{attempts()}</div>
                        </div>
                        <div class="text-center p-3 bg-[#111113]/60 rounded-xl border border-white/[0.04]">
                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Max Combo</div>
                            <div class="text-xl font-black text-cyan-400">{maxCombo()}</div>
                        </div>
                        <div class="text-center p-3 bg-[#111113]/60 rounded-xl border border-white/[0.04]">
                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Min Attempts</div>
                            <div class="text-xl font-black text-white">
                                {attempts() <= totalPairs ? (
                                    <span class="text-amber-400">PERFECT</span>
                                ) : `${attempts()}/${totalPairs}`}
                            </div>
                        </div>
                    </div>

                    {/* Rewards */}
                    <div class="flex items-center gap-6 px-6 py-4 bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-amber-500/10 rounded-2xl border border-white/[0.06]">
                        <div class="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" class="w-6 h-6" fill="none">
                                <circle cx="12" cy="12" r="10" fill="#F59E0B" opacity="0.2" />
                                <circle cx="12" cy="12" r="8" stroke="#F59E0B" stroke-width="1.5" />
                                <text x="12" y="16" text-anchor="middle" fill="#F59E0B" font-size="10" font-weight="bold">V</text>
                            </svg>
                            <span class="text-2xl font-black text-amber-400">+{reward().vcn}</span>
                            <span class="text-xs text-amber-400/60 font-bold">VCN</span>
                        </div>
                        <div class="w-px h-8 bg-white/10" />
                        <div class="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" class="w-5 h-5 text-purple-400" fill="currentColor">
                                <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                            </svg>
                            <span class="text-2xl font-black text-purple-400">+{reward().rp}</span>
                            <span class="text-xs text-purple-400/60 font-bold">RP</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div class="flex items-center gap-3 w-full max-w-xs">
                        <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
                            class="flex-1 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors">
                            Done
                        </button>
                    </div>
                </div>
            </Show>

            {/* Shake Animation Style */}
            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-4px); }
                    40% { transform: translateX(4px); }
                    60% { transform: translateX(-3px); }
                    80% { transform: translateX(3px); }
                }
                .animate-shake { animation: shake 0.3s ease-in-out; }
            `}</style>
        </div>
    );
};

export default MemoryMatchGame;
