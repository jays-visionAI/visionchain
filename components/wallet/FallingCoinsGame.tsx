import { createSignal, Show, onMount, onCleanup, createMemo } from 'solid-js';
import { GameAudio } from '../../services/game/GameAudio';

// ─── Types ──────────────────────────────────────────────────────────────────
type ObjectType = 'coin' | 'star' | 'diamond' | 'bomb';

interface FallingObject {
    id: number;
    type: ObjectType;
    x: number;      // 0-100 (% of container width)
    y: number;      // 0-100 (% of container height)
    speed: number;   // units per frame
    size: number;    // px
    caught: boolean;
}

interface FallingCoinsProps {
    onComplete: (result: { vcn: number; rp: number; score: number; grade: string; feverCount: number }) => void;
    onBack: () => void;
    todayBest?: number;
    todayBestBy?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const GAME_DURATION = 30; // seconds
const BASKET_WIDTH = 18;  // % of container width
const BASKET_HEIGHT = 8;  // % of container height
const CATCH_TOLERANCE = 4; // extra % tolerance for catching

// Phase config
const PHASES = [
    { start: 0, end: 10, speed: 1.0, bombChance: 0, diamondChance: 0, spawnRate: 600, label: 'Phase 1' },
    { start: 10, end: 20, speed: 1.5, bombChance: 0.15, diamondChance: 0, spawnRate: 450, label: 'Phase 2' },
    { start: 20, end: 30, speed: 2.0, bombChance: 0.25, diamondChance: 0.08, spawnRate: 350, label: 'Phase 3' },
];

const GRADE_TABLE = [
    { minScore: 50, grade: 'S', label: 'Legend', vcn: 5.0, rp: 40 },
    { minScore: 35, grade: 'A', label: 'Expert', vcn: 3.0, rp: 25 },
    { minScore: 20, grade: 'B', label: 'Good', vcn: 1.5, rp: 12 },
    { minScore: 10, grade: 'C', label: 'Normal', vcn: 0.5, rp: 5 },
    { minScore: 0, grade: 'D', label: 'Try Again', vcn: 0.1, rp: 2 },
];

// ─── SVG Icons ──────────────────────────────────────────────────────────────
const CoinSVG = () => (
    <svg viewBox="0 0 32 32" class="w-full h-full drop-shadow-[0_2px_4px_rgba(245,158,11,0.5)]">
        <circle cx="16" cy="16" r="14" fill="#F59E0B" />
        <circle cx="16" cy="16" r="11" fill="#FBBF24" />
        <text x="16" y="21" text-anchor="middle" fill="#92400E" font-size="14" font-weight="bold">V</text>
    </svg>
);

const StarSVG = () => (
    <svg viewBox="0 0 32 32" class="w-full h-full drop-shadow-[0_2px_4px_rgba(168,85,247,0.5)]">
        <polygon points="16,2 20,12 30,12 22,18 25,28 16,22 7,28 10,18 2,12 12,12" fill="#A855F7" />
        <polygon points="16,6 19,13 26,13 20,17 22,24 16,20 10,24 12,17 6,13 13,13" fill="#C084FC" />
    </svg>
);

const DiamondSVG = () => (
    <svg viewBox="0 0 32 32" class="w-full h-full drop-shadow-[0_2px_6px_rgba(34,211,238,0.6)]">
        <polygon points="16,2 28,12 16,30 4,12" fill="#22D3EE" />
        <polygon points="16,4 26,12 16,27 6,12" fill="#67E8F9" />
        <polygon points="16,8 22,12 16,22 10,12" fill="#CFFAFE" opacity="0.5" />
    </svg>
);

const BombSVG = () => (
    <svg viewBox="0 0 32 32" class="w-full h-full drop-shadow-[0_2px_4px_rgba(239,68,68,0.5)]">
        <circle cx="16" cy="18" r="12" fill="#1F2937" />
        <circle cx="16" cy="18" r="10" fill="#374151" />
        <line x1="16" y1="6" x2="16" y2="2" stroke="#F59E0B" stroke-width="2" />
        <circle cx="16" cy="2" r="2" fill="#EF4444">
            <animate attributeName="opacity" values="1;0.3;1" dur="0.3s" repeatCount="indefinite" />
        </circle>
        <text x="16" y="22" text-anchor="middle" fill="#EF4444" font-size="12" font-weight="bold">X</text>
    </svg>
);

const BasketSVG = () => (
    <svg viewBox="0 0 60 30" class="w-full h-full">
        <path d="M5,0 L55,0 L50,28 Q30,32 10,28 Z" fill="url(#basketGrad)" stroke="#F59E0B" stroke-width="1.5" />
        <defs>
            <linearGradient id="basketGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#78350F" />
                <stop offset="100%" stop-color="#451A03" />
            </linearGradient>
        </defs>
        <path d="M10,5 L50,5" stroke="#92400E" stroke-width="1" opacity="0.5" />
        <path d="M12,10 L48,10" stroke="#92400E" stroke-width="1" opacity="0.3" />
    </svg>
);

// ─── Main Component ─────────────────────────────────────────────────────────
export const FallingCoinsGame = (props: FallingCoinsProps) => {
    let containerRef: HTMLDivElement | undefined;
    let animFrameId: number = 0;

    // State
    const [gameState, setGameState] = createSignal<'ready' | 'countdown' | 'playing' | 'done'>('ready');
    const [countdownNum, setCountdownNum] = createSignal(3);
    const [timeLeft, setTimeLeft] = createSignal(GAME_DURATION);
    const [score, setScore] = createSignal(0);
    const [basketX, setBasketX] = createSignal(50); // center
    const [objects, setObjects] = createSignal<FallingObject[]>([]);
    const [consecutiveCatches, setConsecutiveCatches] = createSignal(0);
    const [isFever, setIsFever] = createSignal(false);
    const [feverTimer, setFeverTimer] = createSignal(0);
    const [feverCount, setFeverCount] = createSignal(0);
    const [screenShake, setScreenShake] = createSignal(false);
    const [catchFlash, setCatchFlash] = createSignal<{ x: number; y: number; text: string; color: string } | null>(null);
    const [result, setResult] = createSignal<{ vcn: number; rp: number; score: number; grade: string; label: string } | null>(null);
    const [phaseLabel, setPhaseLabel] = createSignal('');

    let targetBasketX = 50;
    let nextObjId = 0;
    let spawnTimer = 0;
    let lastFrameTime = 0;
    let gameStartTime = 0;

    // ── Start Game ──
    const startGame = () => {
        setGameState('countdown');
        setCountdownNum(3);
        GameAudio.play('countdown');

        let count = 3;
        const countInterval = setInterval(() => {
            count--;
            if (count > 0) {
                setCountdownNum(count);
                GameAudio.play('countdown');
            } else {
                clearInterval(countInterval);
                setCountdownNum(0);
                GameAudio.play('countdownGo');
                setGameState('playing');
                setScore(0);
                setObjects([]);
                setConsecutiveCatches(0);
                setIsFever(false);
                setFeverCount(0);
                setTimeLeft(GAME_DURATION);
                setBasketX(50);
                targetBasketX = 50;
                nextObjId = 0;
                spawnTimer = 0;
                gameStartTime = Date.now();
                lastFrameTime = Date.now();
                GameAudio.resetCoinCatchCount();
                GameAudio.startBGM('falling');
                animFrameId = requestAnimationFrame(gameLoop);
            }
        }, 1000);
    };

    // ── Game Loop ──
    const gameLoop = () => {
        const now = Date.now();
        const dt = (now - lastFrameTime) / 1000;
        lastFrameTime = now;

        const elapsed = (now - gameStartTime) / 1000;
        const remaining = Math.max(0, GAME_DURATION - elapsed);
        setTimeLeft(+remaining.toFixed(1));

        // Time warning
        if (remaining <= 5 && remaining > 4.9 && remaining < 5.1) {
            GameAudio.play('timeWarning');
        }

        if (remaining <= 0) {
            endGame();
            return;
        }

        // Current phase
        const phase = PHASES.find(p => elapsed >= p.start && elapsed < p.end) || PHASES[PHASES.length - 1];
        setPhaseLabel(phase.label);

        // Update BGM intensity based on phase
        const phaseIdx = PHASES.indexOf(phase);
        GameAudio.setBGMIntensity(phaseIdx / (PHASES.length - 1));

        // Spawn objects
        spawnTimer += dt * 1000;
        if (spawnTimer >= phase.spawnRate) {
            spawnTimer = 0;
            spawnObject(phase);
        }

        // Fever timer
        if (isFever()) {
            setFeverTimer(prev => {
                const next = prev - dt;
                if (next <= 0) {
                    setIsFever(false);
                    GameAudio.play('feverEnd');
                    GameAudio.startBGM('falling');
                    return 0;
                }
                return next;
            });
        }

        // Move basket smoothly
        setBasketX(prev => prev + (targetBasketX - prev) * 0.15);

        // Move objects + check collisions
        const basketLeft = basketX() - BASKET_WIDTH / 2 - CATCH_TOLERANCE;
        const basketRight = basketX() + BASKET_WIDTH / 2 + CATCH_TOLERANCE;
        const basketBottom = 12; // basket is 12% above bottom
        const basketTop = 100 - BASKET_HEIGHT - basketBottom;

        setObjects(prev => {
            const updated: FallingObject[] = [];
            for (const obj of prev) {
                if (obj.caught) continue;

                const newY = obj.y + obj.speed * phase.speed * dt * 60;

                // Check if caught by basket
                if (newY >= basketTop && newY <= basketTop + BASKET_HEIGHT + CATCH_TOLERANCE && obj.x >= basketLeft && obj.x <= basketRight) {
                    handleCatch(obj);
                    continue;
                }

                // Off screen
                if (newY > 105) continue;

                updated.push({ ...obj, y: newY });
            }
            return updated;
        });

        animFrameId = requestAnimationFrame(gameLoop);
    };

    // ── Spawn Object ──
    const spawnObject = (phase: typeof PHASES[0]) => {
        const r = Math.random();
        let type: ObjectType = 'coin';
        let size = 28;

        if (r < phase.bombChance) {
            type = 'bomb';
            size = 30;
        } else if (r < phase.bombChance + phase.diamondChance) {
            type = 'diamond';
            size = 22; // Smaller, harder to catch
        } else if (r < phase.bombChance + phase.diamondChance + 0.2) {
            type = 'star';
            size = 24;
        }

        const feverMult = isFever() ? 2 : 1;
        const obj: FallingObject = {
            id: nextObjId++,
            type,
            x: 8 + Math.random() * 84, // 8-92%
            y: -5,
            speed: (0.6 + Math.random() * 0.4) * (type === 'diamond' ? 1.3 : 1),
            size: size,
            caught: false,
        };

        setObjects(prev => [...prev.slice(-14), obj]); // Max 15 objects
    };

    // ── Handle Catch ──
    const handleCatch = (obj: FallingObject) => {
        if (obj.type === 'bomb') {
            setScore(prev => Math.max(0, prev - 5));
            setConsecutiveCatches(0);
            setScreenShake(true);
            setTimeout(() => setScreenShake(false), 500);
            GameAudio.play('bombHit');
            try { navigator.vibrate?.([30, 20, 50]); } catch { }
            setCatchFlash({ x: obj.x, y: 85, text: '-5', color: '#EF4444' });
            setTimeout(() => setCatchFlash(null), 600);
            return;
        }

        let points = 1;
        let sfx: 'coinCatch' | 'starCatch' | 'diamondCatch' = 'coinCatch';
        let flashText = '+1';
        let flashColor = '#F59E0B';

        if (obj.type === 'star') {
            points = 1;
            sfx = 'starCatch';
            flashColor = '#A855F7';
        } else if (obj.type === 'diamond') {
            points = 3;
            sfx = 'diamondCatch';
            flashText = '+3';
            flashColor = '#22D3EE';
        }

        if (isFever()) {
            points *= 2;
            flashText = `+${points}`;
        }

        setScore(prev => prev + points);
        GameAudio.play(sfx);
        try { navigator.vibrate?.([10]); } catch { }

        const newConsec = consecutiveCatches() + 1;
        setConsecutiveCatches(newConsec);

        // Fever trigger at 5 consecutive
        if (newConsec >= 5 && !isFever()) {
            setIsFever(true);
            setFeverTimer(3);
            setFeverCount(prev => prev + 1);
            GameAudio.play('feverStart');
            GameAudio.startBGM('fever');
        }

        setCatchFlash({ x: obj.x, y: 85, text: flashText, color: flashColor });
        setTimeout(() => setCatchFlash(null), 400);
    };

    // ── End Game ──
    const endGame = () => {
        cancelAnimationFrame(animFrameId);
        setGameState('done');
        GameAudio.stopBGM();

        const s = score();
        const gradeInfo = GRADE_TABLE.find(g => s >= g.minScore) || GRADE_TABLE[GRADE_TABLE.length - 1];
        setResult({ vcn: gradeInfo.vcn, rp: gradeInfo.rp, score: s, grade: gradeInfo.grade, label: gradeInfo.label });

        if (gradeInfo.grade === 'S') {
            GameAudio.play('perfect');
        } else {
            GameAudio.play('win');
        }

        props.onComplete({
            vcn: gradeInfo.vcn, rp: gradeInfo.rp, score: s,
            grade: gradeInfo.grade, feverCount: feverCount(),
        });
    };

    // ── Input Handling ──
    const handlePointerMove = (e: PointerEvent | TouchEvent) => {
        if (gameState() !== 'playing' || !containerRef) return;
        const rect = containerRef.getBoundingClientRect();
        let clientX: number;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }
        const pct = ((clientX - rect.left) / rect.width) * 100;
        targetBasketX = Math.max(BASKET_WIDTH / 2 + 2, Math.min(100 - BASKET_WIDTH / 2 - 2, pct));
    };

    onMount(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState() !== 'playing') return;
            if (e.key === 'ArrowLeft') targetBasketX = Math.max(BASKET_WIDTH / 2 + 2, targetBasketX - 5);
            if (e.key === 'ArrowRight') targetBasketX = Math.min(100 - BASKET_WIDTH / 2 - 2, targetBasketX + 5);
        };
        window.addEventListener('keydown', handleKeyDown);
        onCleanup(() => {
            window.removeEventListener('keydown', handleKeyDown);
            cancelAnimationFrame(animFrameId);
            GameAudio.stopBGM();
        });
    });

    // ── Render ──
    return (
        <div class="flex flex-col h-full" style="padding-top: env(safe-area-inset-top, 0px);">
            {/* Back button */}
            <button onClick={() => { GameAudio.stopBGM(); cancelAnimationFrame(animFrameId); props.onBack(); }}
                class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2 px-4 shrink-0"
                style="touch-action: manipulation;">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to games
            </button>

            {/* Beat This Banner */}
            <Show when={props.todayBest && props.todayBest > 0 && gameState() !== 'done'}>
                <div class="flex items-center gap-3 px-4 py-2.5 mx-4 bg-amber-500/5 border border-amber-500/15 rounded-xl shrink-0">
                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" />
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                    <span class="text-xs text-amber-400 font-bold">
                        Beat this! {props.todayBest} pts by {props.todayBestBy || 'Unknown'}
                    </span>
                </div>
            </Show>

            {/* Ready / Countdown */}
            <Show when={gameState() === 'ready' || gameState() === 'countdown'}>
                <div class="flex-1 flex flex-col items-center justify-center gap-6 px-4">
                    <div class="w-20 h-20 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-3xl flex items-center justify-center">
                        <svg viewBox="0 0 32 32" class="w-12 h-12">
                            <circle cx="16" cy="16" r="14" fill="#F59E0B" />
                            <circle cx="16" cy="16" r="11" fill="#FBBF24" />
                            <text x="16" y="21" text-anchor="middle" fill="#92400E" font-size="14" font-weight="bold">V</text>
                        </svg>
                    </div>
                    <h2 class="text-2xl font-black text-white">Falling Coins</h2>
                    <p class="text-sm text-gray-500 text-center max-w-xs">
                        Catch coins and stars, avoid bombs!<br />Move left/right to collect rewards.
                    </p>
                    <Show when={gameState() === 'ready'}>
                        <button onClick={startGame}
                            class="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-2xl hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all text-lg"
                            style="touch-action: manipulation; min-height: 52px;">
                            START GAME
                        </button>
                    </Show>
                    <Show when={gameState() === 'countdown'}>
                        <div class="text-7xl font-black text-amber-400 animate-pulse">{countdownNum()}</div>
                    </Show>
                </div>
            </Show>

            {/* Game Area */}
            <Show when={gameState() === 'playing'}>
                <div class="flex-1 flex flex-col min-h-0 px-2 pb-2">
                    {/* HUD */}
                    <div class="flex items-center justify-between px-4 py-2.5 bg-[#111113]/60 rounded-xl border border-white/[0.04] mb-2 shrink-0">
                        <div class="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                            </svg>
                            <span class={`text-lg font-black tabular-nums ${timeLeft() <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                {timeLeft().toFixed(1)}s
                            </span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-500">Score:</span>
                            <span class="text-lg font-black text-amber-400 tabular-nums">{score()}</span>
                        </div>
                        <Show when={isFever()}>
                            <div class="text-xs font-black text-orange-400 bg-orange-500/15 px-2.5 py-1 rounded-lg animate-pulse">
                                FEVER x2
                            </div>
                        </Show>
                        <Show when={consecutiveCatches() >= 3 && !isFever()}>
                            <div class="text-xs font-bold text-cyan-400">
                                x{consecutiveCatches()} catch
                            </div>
                        </Show>
                        <div class="text-[10px] text-gray-600 font-bold">{phaseLabel()}</div>
                    </div>

                    {/* Play Field */}
                    <div
                        ref={containerRef}
                        class={`relative w-full flex-1 rounded-2xl border overflow-hidden select-none ${isFever() ? 'border-orange-500/40 bg-gradient-to-b from-orange-900/10 to-[#0a0a0b]' : 'border-white/[0.06] bg-[#0a0a0b]'} ${screenShake() ? 'animate-shake' : ''}`}
                        style="touch-action: none; -webkit-user-select: none;"
                        onPointerMove={handlePointerMove}
                        onTouchMove={(e) => { e.preventDefault(); handlePointerMove(e); }}
                    >
                        {/* Falling Objects */}
                        {objects().map(obj => (
                            <div
                                class="absolute transition-none pointer-events-none"
                                style={{
                                    left: `${obj.x}%`,
                                    top: `${obj.y}%`,
                                    width: `${obj.size}px`,
                                    height: `${obj.size}px`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                {obj.type === 'coin' && <CoinSVG />}
                                {obj.type === 'star' && <StarSVG />}
                                {obj.type === 'diamond' && <DiamondSVG />}
                                {obj.type === 'bomb' && <BombSVG />}
                            </div>
                        ))}

                        {/* Catch Flash */}
                        <Show when={catchFlash()}>
                            {(flash) => (
                                <div
                                    class="absolute text-lg font-black pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300"
                                    style={{
                                        left: `${flash().x}%`,
                                        top: `${flash().y}%`,
                                        transform: 'translate(-50%, -50%)',
                                        color: flash().color,
                                        'text-shadow': `0 0 10px ${flash().color}`,
                                    }}
                                >
                                    {flash().text}
                                </div>
                            )}
                        </Show>

                        {/* Basket */}
                        <div
                            class="absolute transition-none"
                            
                            style={{
                                left: `${basketX()}%`,
                                bottom: '12%',
                                width: `${BASKET_WIDTH}%`,
                                height: `${BASKET_HEIGHT}%`,
                                transform: 'translateX(-50%)',
                                'min-width': '60px',
                                'min-height': '30px',
                            }}
                        >
                            <BasketSVG />
                        </div>

                        {/* Fever overlay */}
                        <Show when={isFever()}>
                            <div class="absolute inset-0 pointer-events-none border-2 border-orange-500/30 rounded-2xl">
                                <div class="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent" />
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* Result Screen */}
            <Show when={gameState() === 'done' && result()}>
                {(r) => (
                    <div class="flex-1 flex flex-col items-center justify-center gap-6 px-4 animate-in fade-in zoom-in-75 duration-500">
                        {/* Grade */}
                        <div class="flex flex-col items-center gap-2">
                            <div class={`text-5xl font-black ${r().grade === 'S' ? 'text-amber-400' : r().grade === 'A' ? 'text-cyan-400' : r().grade === 'B' ? 'text-green-400' : 'text-gray-400'}`}>
                                {r().grade}
                            </div>
                            <div class="text-sm text-gray-500 font-bold">{r().label}</div>
                        </div>

                        {/* Score */}
                        <div class="text-center p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04] w-full max-w-xs">
                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Final Score</div>
                            <div class="text-4xl font-black text-white">{r().score}</div>
                        </div>

                        {/* Stats */}
                        <div class="grid grid-cols-2 gap-3 w-full max-w-xs">
                            <div class="text-center p-3 bg-[#111113]/60 rounded-xl border border-white/[0.04]">
                                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Fever</div>
                                <div class="text-lg font-black text-orange-400">{feverCount()}x</div>
                            </div>
                            <div class="text-center p-3 bg-[#111113]/60 rounded-xl border border-white/[0.04]">
                                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Best Catch</div>
                                <div class="text-lg font-black text-cyan-400">x{consecutiveCatches()}</div>
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
                                <span class="text-2xl font-black text-amber-400">+{r().vcn}</span>
                                <span class="text-xs text-amber-400/60 font-bold">VCN</span>
                            </div>
                            <div class="w-px h-8 bg-white/10" />
                            <div class="flex items-center gap-2">
                                <svg viewBox="0 0 24 24" class="w-5 h-5 text-purple-400" fill="currentColor">
                                    <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                </svg>
                                <span class="text-2xl font-black text-purple-400">+{r().rp}</span>
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
                )}
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

export default FallingCoinsGame;
