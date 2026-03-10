import { createSignal, Show, onMount, onCleanup, createMemo } from 'solid-js';
import { GameAudio } from '../../services/game/GameAudio';

// ─── Types ──────────────────────────────────────────────────────────────────
interface PricePredictProps {
    onComplete: (result: { vcn: number; rp: number; streak: number; correct: boolean }) => void;
    onBack: () => void;
    todayBestStreak?: number;
    todayBestBy?: string;
}

type Direction = 'up' | 'down' | null;

interface PricePoint {
    time: number;
    price: number;
}

// ─── Simulated market data generator ────────────────────────────────────────
// Instead of external API, generates realistic-looking price movement
const COINS_LIST = [
    { symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', basePrice: 65000, volatility: 0.003 },
    { symbol: 'ETH', name: 'Ethereum', color: '#627EEA', basePrice: 3200, volatility: 0.004 },
    { symbol: 'SOL', name: 'Solana', color: '#14F195', basePrice: 145, volatility: 0.005 },
];

function generatePriceHistory(basePrice: number, volatility: number, count: number): PricePoint[] {
    const points: PricePoint[] = [];
    let price = basePrice;
    for (let i = 0; i < count; i++) {
        const change = price * volatility * (Math.random() * 2 - 1);
        price += change;
        // Mean reversion tendency
        price += (basePrice - price) * 0.01;
        points.push({ time: i, price });
    }
    return points;
}

function continuePriceMovement(lastPrice: number, basePrice: number, volatility: number, steps: number): PricePoint[] {
    const points: PricePoint[] = [];
    let price = lastPrice;
    for (let i = 0; i < steps; i++) {
        const change = price * volatility * (Math.random() * 2 - 1);
        // Slight momentum + mean reversion
        const momentum = i > 0 && points.length > 0 ? (price - points[points.length - 1].price) * 0.2 : 0;
        price += change + momentum;
        price += (basePrice - price) * 0.005;
        points.push({ time: i, price });
    }
    return points;
}

// ─── SVG Mini chart ─────────────────────────────────────────────────────────
const MiniChart = (props: { data: PricePoint[]; color: string; prediction?: PricePoint[]; predictionColor?: string }) => {
    const points = () => props.data;
    const predPoints = () => props.prediction || [];

    const allPrices = () => {
        const all = [...points().map(p => p.price), ...predPoints().map(p => p.price)];
        return all;
    };
    const minPrice = () => Math.min(...allPrices());
    const maxPrice = () => Math.max(...allPrices());
    const range = () => maxPrice() - minPrice() || 1;

    const totalPoints = () => points().length + predPoints().length;

    const toSVG = (p: PricePoint, idx: number): string => {
        const x = (idx / (totalPoints() - 1 || 1)) * 280 + 10;
        const y = 140 - ((p.price - minPrice()) / range()) * 120;
        return `${x},${y}`;
    };

    const mainPath = () => points().map((p, i) => `${i === 0 ? 'M' : 'L'}${toSVG(p, i)}`).join(' ');

    const predPath = () => {
        if (predPoints().length === 0) return '';
        const offset = points().length - 1;
        const lastMain = toSVG(points()[points().length - 1], offset);
        return `M${lastMain} ` + predPoints().map((p, i) => `L${toSVG(p, offset + 1 + i)}`).join(' ');
    };

    const areaPath = () => {
        const pts = points();
        if (pts.length < 2) return '';
        const first = toSVG(pts[0], 0);
        const last = toSVG(pts[pts.length - 1], pts.length - 1);
        return mainPath() + ` L${last.split(',')[0]},150 L${first.split(',')[0]},150 Z`;
    };

    return (
        <svg viewBox="0 0 300 160" class="w-full h-full" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="10" y1="20" x2="290" y2="20" stroke="rgba(255,255,255,0.03)" />
            <line x1="10" y1="80" x2="290" y2="80" stroke="rgba(255,255,255,0.03)" />
            <line x1="10" y1="140" x2="290" y2="140" stroke="rgba(255,255,255,0.03)" />

            {/* Area fill */}
            <path d={areaPath()} fill={`${props.color}10`} />

            {/* Main line */}
            <path d={mainPath()} fill="none" stroke={props.color} stroke-width="2" stroke-linejoin="round" />

            {/* Prediction line */}
            <Show when={predPoints().length > 0}>
                <path d={predPath()} fill="none" stroke={props.predictionColor || '#9CA3AF'}
                    stroke-width="2" stroke-dasharray="4 3" stroke-linejoin="round" />
            </Show>

            {/* Current price dot */}
            {(() => {
                const last = points()[points().length - 1];
                if (!last) return null;
                const coords = toSVG(last, points().length - 1);
                const [x, y] = coords.split(',').map(Number);
                return (
                    <>
                        <circle cx={x} cy={y} r="4" fill={props.color} />
                        <circle cx={x} cy={y} r="8" fill={props.color} opacity="0.2">
                            <animate attributeName="r" values="6;12;6" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                        </circle>
                    </>
                );
            })()}
        </svg>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export const PricePredictGame = (props: PricePredictProps) => {
    // Game state machine
    const [phase, setPhase] = createSignal<'observe' | 'predict' | 'waiting' | 'result'>('observe');
    const [coin, setCoin] = createSignal(COINS_LIST[0]);
    const [priceHistory, setPriceHistory] = createSignal<PricePoint[]>([]);
    const [futureData, setFutureData] = createSignal<PricePoint[]>([]);
    const [prediction, setPrediction] = createSignal<Direction>(null);
    const [timer, setTimer] = createSignal(5);
    const [isCorrect, setIsCorrect] = createSignal(false);
    const [streak, setStreak] = createSignal(0);
    const [totalPlays, setTotalPlays] = createSignal(0);
    const [totalCorrect, setTotalCorrect] = createSignal(0);
    const [reward, setReward] = createSignal({ vcn: 0, rp: 0 });
    const [priceChange, setPriceChange] = createSignal(0);
    const [showResultOverlay, setShowResultOverlay] = createSignal(false);
    const [gameOver, setGameOver] = createSignal(false);
    const [heartbeatInterval, setHeartbeatInterval] = createSignal<ReturnType<typeof setInterval> | null>(null);

    const MAX_ROUNDS = 5;
    let timerInterval: ReturnType<typeof setInterval> | null = null;
    let observeTimeout: ReturnType<typeof setTimeout> | null = null;

    const currentPrice = () => {
        const h = priceHistory();
        return h.length > 0 ? h[h.length - 1].price : coin().basePrice;
    };

    const formatPrice = (p: number) => {
        if (p >= 1000) return p.toFixed(0);
        if (p >= 1) return p.toFixed(2);
        return p.toFixed(4);
    };

    // ── Initialize Round ──
    const startRound = () => {
        // Pick random coin
        const c = COINS_LIST[Math.floor(Math.random() * COINS_LIST.length)];
        setCoin(c);

        // Generate 60 points of history
        const history = generatePriceHistory(c.basePrice, c.volatility, 60);
        setPriceHistory(history);
        setFutureData([]);
        setPrediction(null);
        setShowResultOverlay(false);

        // Observe phase: 5 seconds
        setPhase('observe');
        setTimer(5);
        GameAudio.startBGM('predict');

        // Auto-advance to predict phase
        observeTimeout = setTimeout(() => {
            setPhase('predict');
            setTimer(5);
            startPredictTimer();
        }, 5000);
    };

    const startPredictTimer = () => {
        timerInterval = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) {
                    clearInterval(timerInterval!);
                    if (!prediction()) {
                        // Timed out - auto fail
                        handlePrediction('up'); // Default to up
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handlePrediction = (dir: Direction) => {
        if (phase() !== 'predict' || prediction()) return;
        if (timerInterval) clearInterval(timerInterval);

        setPrediction(dir);
        if (dir === 'up') GameAudio.play('selectUp');
        else GameAudio.play('selectDown');

        // Waiting phase - 10 seconds countdown
        setPhase('waiting');
        setTimer(10);

        // Start heartbeat
        const hb = setInterval(() => GameAudio.play('heartbeat'), 800);
        setHeartbeatInterval(hb);

        // Generate future movement over 10 seconds
        const lastPrice = currentPrice();
        const future = continuePriceMovement(lastPrice, coin().basePrice, coin().volatility, 20);

        // Simulate revealing future data progressively
        let futureIdx = 0;
        const revealInterval = setInterval(() => {
            futureIdx += 2;
            setFutureData(future.slice(0, futureIdx));
            setTimer(prev => {
                if (prev <= 1) {
                    clearInterval(revealInterval);
                    return 0;
                }
                return prev - 0.5;
            });
        }, 500);

        // After 10 seconds, show result
        setTimeout(() => {
            clearInterval(revealInterval);
            if (hb) clearInterval(hb);
            setHeartbeatInterval(null);
            setFutureData(future);

            const finalPrice = future[future.length - 1].price;
            const change = ((finalPrice - lastPrice) / lastPrice) * 100;
            setPriceChange(change);

            const actualDir = finalPrice > lastPrice ? 'up' : 'down';
            const correct = dir === actualDir;
            setIsCorrect(correct);

            if (correct) {
                const newStreak = streak() + 1;
                setStreak(newStreak);
                setTotalCorrect(prev => prev + 1);
                GameAudio.play('correct');
                if (newStreak >= 3) GameAudio.play('streakFire');
            } else {
                setStreak(0);
                GameAudio.play('wrong');
            }

            setTotalPlays(prev => prev + 1);
            setPhase('result');
            setShowResultOverlay(true);
            GameAudio.stopBGM();

            // Calculate round reward
            const baseVCN = correct ? 0.5 : 0;
            const baseRP = correct ? 5 : 1;
            let multiplier = 1;
            if (correct && Math.abs(change) > 0.5) multiplier = 2;
            if (streak() >= 5) multiplier *= 2;
            else if (streak() >= 3) multiplier *= 1.5;

            const roundReward = {
                vcn: +(baseVCN * multiplier).toFixed(1),
                rp: Math.round(baseRP * multiplier),
            };
            setReward(roundReward);

            // Report to parent
            props.onComplete({
                vcn: roundReward.vcn, rp: roundReward.rp,
                streak: streak(), correct,
            });
        }, 10000);
    };

    const nextRound = () => {
        if (totalPlays() >= MAX_ROUNDS) {
            setGameOver(true);
            return;
        }
        startRound();
    };

    onMount(() => {
        startRound();
    });

    onCleanup(() => {
        if (timerInterval) clearInterval(timerInterval);
        if (observeTimeout) clearTimeout(observeTimeout);
        if (heartbeatInterval()) clearInterval(heartbeatInterval()!);
        GameAudio.stopBGM();
    });

    // ── Render ──
    return (
        <div class="space-y-5">
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
            <Show when={props.todayBestStreak && props.todayBestStreak > 0 && !gameOver()}>
                <div class="flex items-center gap-3 px-4 py-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" />
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                    <span class="text-xs text-amber-400 font-bold">
                        Beat this! {props.todayBestStreak} streak by {props.todayBestBy || 'Unknown'}
                    </span>
                </div>
            </Show>

            <Show when={!gameOver()}>
                {/* Coin Info + Streak */}
                <div class="flex items-center justify-between px-4 py-3 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${coin().color}20` }}>
                            <span class="text-sm font-black" style={{ color: coin().color }}>{coin().symbol.charAt(0)}</span>
                        </div>
                        <div>
                            <div class="text-sm font-black text-white">{coin().symbol}/USD</div>
                            <div class="text-[10px] text-gray-500">{coin().name}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-right">
                            <div class="text-lg font-black text-white tabular-nums">${formatPrice(currentPrice())}</div>
                        </div>
                        <Show when={streak() > 0}>
                            <div class="flex items-center gap-1 px-2 py-1 bg-orange-500/15 rounded-lg">
                                <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-orange-400" fill="currentColor">
                                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                                <span class="text-xs font-black text-orange-400">{streak()}</span>
                            </div>
                        </Show>
                        <div class="text-[10px] text-gray-600 font-bold">{totalPlays()}/{MAX_ROUNDS}</div>
                    </div>
                </div>

                {/* Chart */}
                <div class="relative bg-[#0a0a0b] rounded-2xl border border-white/[0.06] p-4 overflow-hidden" style="min-height: 200px;">
                    {/* Phase indicator */}
                    <div class="absolute top-3 left-3 z-10">
                        <span class={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${phase() === 'observe' ? 'bg-blue-500/15 text-blue-400' : phase() === 'predict' ? 'bg-amber-500/15 text-amber-400' : phase() === 'waiting' ? 'bg-purple-500/15 text-purple-400 animate-pulse' : 'bg-white/5 text-gray-500'}`}>
                            {phase() === 'observe' ? 'Observe...' : phase() === 'predict' ? `Choose! ${timer()}s` : phase() === 'waiting' ? `${timer().toFixed(0)}s` : 'Result'}
                        </span>
                    </div>

                    {/* My prediction arrow */}
                    <Show when={prediction()}>
                        <div class="absolute top-3 right-3 z-10">
                            <span class={`text-xs font-black px-2.5 py-1 rounded-lg ${prediction() === 'up' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                                {prediction() === 'up' ? 'UP' : 'DOWN'}
                                <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 inline-block ml-1" fill="currentColor">
                                    {prediction() === 'up' ? <path d="M7 14l5-5 5 5z" /> : <path d="M7 10l5 5 5-5z" />}
                                </svg>
                            </span>
                        </div>
                    </Show>

                    <div class="w-full" style="height: 180px;">
                        <MiniChart
                            data={priceHistory()}
                            color={coin().color}
                            prediction={futureData()}
                            predictionColor={isCorrect() && phase() === 'result' ? '#22C55E' : phase() === 'result' ? '#EF4444' : '#9CA3AF'}
                        />
                    </div>
                </div>

                {/* Prediction Buttons */}
                <Show when={phase() === 'predict'}>
                    <div class="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                        <button
                            onClick={() => handlePrediction('up')}
                            class="group relative overflow-hidden rounded-2xl border-2 border-green-500/30 hover:border-green-500/60 p-6 text-center transition-all active:scale-95"
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                        >
                            <div class="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent group-hover:from-green-500/20 transition-all" />
                            <div class="relative">
                                <svg viewBox="0 0 24 24" class="w-10 h-10 mx-auto mb-2 text-green-400" fill="currentColor">
                                    <path d="M7 14l5-5 5 5z" />
                                </svg>
                                <div class="text-2xl font-black text-green-400">UP</div>
                                <div class="text-[10px] text-green-400/50 mt-1">Price will rise</div>
                            </div>
                        </button>
                        <button
                            onClick={() => handlePrediction('down')}
                            class="group relative overflow-hidden rounded-2xl border-2 border-red-500/30 hover:border-red-500/60 p-6 text-center transition-all active:scale-95"
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                        >
                            <div class="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent group-hover:from-red-500/20 transition-all" />
                            <div class="relative">
                                <svg viewBox="0 0 24 24" class="w-10 h-10 mx-auto mb-2 text-red-400" fill="currentColor">
                                    <path d="M7 10l5 5 5-5z" />
                                </svg>
                                <div class="text-2xl font-black text-red-400">DOWN</div>
                                <div class="text-[10px] text-red-400/50 mt-1">Price will drop</div>
                            </div>
                        </button>
                    </div>
                </Show>

                {/* Waiting - heartbeat visual */}
                <Show when={phase() === 'waiting'}>
                    <div class="text-center py-4">
                        <div class="text-xs text-gray-500 animate-pulse">Waiting for price movement...</div>
                        <div class="text-3xl font-black text-purple-400 mt-2 tabular-nums">{timer().toFixed(0)}s</div>
                    </div>
                </Show>

                {/* Result Overlay */}
                <Show when={showResultOverlay()}>
                    <div class="animate-in fade-in zoom-in-95 duration-300 space-y-4">
                        {/* Result Banner */}
                        <div class={`text-center p-6 rounded-2xl border ${isCorrect() ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                            <div class={`text-3xl font-black ${isCorrect() ? 'text-green-400' : 'text-red-400'}`}>
                                {isCorrect() ? 'CORRECT!' : 'WRONG'}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">
                                Price changed {priceChange() >= 0 ? '+' : ''}{priceChange().toFixed(3)}%
                            </div>

                            {/* Streak */}
                            <Show when={streak() >= 2 && isCorrect()}>
                                <div class="mt-3 flex items-center justify-center gap-2">
                                    <svg viewBox="0 0 24 24" class="w-5 h-5 text-orange-400" fill="currentColor">
                                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                    </svg>
                                    <span class="text-sm font-black text-orange-400">{streak()} streak!</span>
                                    <Show when={streak() >= 3}>
                                        <span class="text-[10px] font-bold text-orange-400/60">x{streak() >= 5 ? '2.0' : '1.5'} bonus</span>
                                    </Show>
                                </div>
                            </Show>

                            {/* Rewards */}
                            <div class="flex items-center justify-center gap-4 mt-4">
                                <Show when={reward().vcn > 0}>
                                    <div class="flex items-center gap-1.5">
                                        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none">
                                            <circle cx="12" cy="12" r="10" fill="#F59E0B" opacity="0.2" />
                                            <circle cx="12" cy="12" r="8" stroke="#F59E0B" stroke-width="1.5" />
                                            <text x="12" y="16" text-anchor="middle" fill="#F59E0B" font-size="10" font-weight="bold">V</text>
                                        </svg>
                                        <span class="text-lg font-black text-amber-400">+{reward().vcn}</span>
                                    </div>
                                </Show>
                                <div class="flex items-center gap-1.5">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-purple-400" fill="currentColor">
                                        <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                    </svg>
                                    <span class="text-lg font-black text-purple-400">+{reward().rp}</span>
                                </div>
                            </div>
                        </div>

                        {/* Next / Done */}
                        <div class="flex items-center gap-3">
                            <Show when={totalPlays() < MAX_ROUNDS}>
                                <button onClick={nextRound}
                                    class="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg active:scale-95 transition-all"
                                    style="touch-action: manipulation; min-height: 48px;">
                                    Next Round ({MAX_ROUNDS - totalPlays()} left)
                                </button>
                            </Show>
                            <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
                                class="flex-1 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors"
                                style="min-height: 48px;">
                                Done
                            </button>
                        </div>
                    </div>
                </Show>
            </Show>

            {/* Game Over Summary */}
            <Show when={gameOver()}>
                <div class="flex flex-col items-center gap-6 py-8 animate-in fade-in zoom-in-75 duration-500">
                    <div class="text-2xl font-black text-white">Game Complete!</div>

                    <div class="grid grid-cols-3 gap-3 w-full max-w-sm">
                        <div class="text-center p-3 bg-[#111113]/60 rounded-xl border border-white/[0.04]">
                            <div class="text-[10px] text-gray-500 font-bold uppercase mb-1">Rounds</div>
                            <div class="text-xl font-black text-white">{totalPlays()}</div>
                        </div>
                        <div class="text-center p-3 bg-[#111113]/60 rounded-xl border border-white/[0.04]">
                            <div class="text-[10px] text-gray-500 font-bold uppercase mb-1">Correct</div>
                            <div class="text-xl font-black text-green-400">{totalCorrect()}</div>
                        </div>
                        <div class="text-center p-3 bg-[#111113]/60 rounded-xl border border-white/[0.04]">
                            <div class="text-[10px] text-gray-500 font-bold uppercase mb-1">Best Streak</div>
                            <div class="text-xl font-black text-orange-400">{streak()}</div>
                        </div>
                    </div>

                    <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
                        class="px-8 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors">
                        Done
                    </button>
                </div>
            </Show>
        </div>
    );
};

export default PricePredictGame;
