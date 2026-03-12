import { createSignal, Show, For, onMount, onCleanup } from 'solid-js';
import { GameAudio } from '../../services/game/GameAudio';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TowerClimbProps {
    onComplete: (result: { vcn: number; rp: number; floor: number; grade: string }) => void;
    onBack: () => void;
}

interface Zone {
    name: string; floors: [number, number]; doors: number; safe: number;
    vcnPerFloor: number; rpPerFloor: number; color: string; accent: string;
}

const ZONES: Zone[] = [
    { name: 'Beginner', floors: [1, 20], doors: 4, safe: 3, vcnPerFloor: 0.05, rpPerFloor: 0.5, color: '#065F46', accent: '#10B981' },
    { name: 'Normal', floors: [21, 40], doors: 3, safe: 2, vcnPerFloor: 0.1, rpPerFloor: 1, color: '#1E40AF', accent: '#3B82F6' },
    { name: 'Hard', floors: [41, 60], doors: 3, safe: 2, vcnPerFloor: 0.2, rpPerFloor: 2, color: '#92400E', accent: '#F59E0B' },
    { name: 'Expert', floors: [61, 80], doors: 2, safe: 1, vcnPerFloor: 0.5, rpPerFloor: 4, color: '#7C2D12', accent: '#F97316' },
    { name: 'Legend', floors: [81, 100], doors: 3, safe: 1, vcnPerFloor: 1.0, rpPerFloor: 8, color: '#7F1D1D', accent: '#EF4444' },
];

function getZone(floor: number): Zone {
    return ZONES.find(z => floor >= z.floors[0] && floor <= z.floors[1]) || ZONES[0];
}

function getGrade(floor: number): string {
    if (floor >= 80) return 'S';
    if (floor >= 60) return 'A';
    if (floor >= 40) return 'B';
    if (floor >= 20) return 'C';
    return 'D';
}

function calcRewards(floor: number): { vcn: number; rp: number } {
    let vcn = 0, rp = 0;
    for (let f = 1; f <= floor; f++) {
        const z = getZone(f);
        vcn += z.vcnPerFloor;
        rp += z.rpPerFloor;
    }
    return { vcn: +vcn.toFixed(2), rp: Math.round(rp) };
}

// ─── Walking Sprite (4 frames) ──────────────────────────────────────────────
const ClimberSprite = (p: { frame: number; falling?: boolean; facingUp?: boolean }) => {
    const f = p.frame % 4;

    // Walking leg positions
    const legs: Record<number, { lx2: number; ly2: number; rx2: number; ry2: number }> = {
        0: { lx2: 13, ly2: 50, rx2: 27, ry2: 50 },
        1: { lx2: 10, ly2: 48, rx2: 30, ry2: 46 },
        2: { lx2: 14, ly2: 50, rx2: 26, ry2: 50 },
        3: { lx2: 18, ly2: 46, rx2: 22, ry2: 48 },
    };
    const leg = legs[f];
    const arms: Record<number, { lx: number; ly: number; rx: number; ry: number }> = {
        0: { lx: 5, ly: 28, rx: 35, ry: 28 },
        1: { lx: 8, ly: 32, rx: 32, ry: 24 },
        2: { lx: 5, ly: 28, rx: 35, ry: 28 },
        3: { lx: 2, ly: 24, rx: 38, ry: 32 },
    };
    const arm = arms[f];

    return (
        <svg viewBox="0 0 40 56" class={`w-10 h-14 ${p.falling ? 'animate-spin' : ''}`}>
            {/* Head */}
            <circle cx="20" cy="10" r="8" fill="#FBBF24" />
            <circle cx="17" cy="8" r="1.5" fill="#1a1a2e" />
            <circle cx="23" cy="8" r="1.5" fill="#1a1a2e" />
            <path d="M17 13 Q20 16 23 13" fill="none" stroke="#1a1a2e" stroke-width="1" />
            {/* Hard hat */}
            <path d="M11 8 Q12 2 20 2 Q28 2 29 8" fill="#F59E0B" stroke="#D97706" stroke-width="0.5" />
            <rect x="10" y="7" width="20" height="3" rx="1" fill="#F59E0B" />
            {/* Body */}
            <rect x="14" y="18" width="12" height="18" rx="3" fill="#3B82F6" />
            <rect x="14" y="30" width="12" height="3" rx="1" fill="#1E3A5F" />
            <rect x="18" y="30" width="4" height="3" rx="0.5" fill="#F59E0B" />
            {/* Arms */}
            <line x1="14" y1="22" x2={arm.lx} y2={arm.ly} stroke="#FBBF24" stroke-width="3" stroke-linecap="round" />
            <line x1="26" y1="22" x2={arm.rx} y2={arm.ry} stroke="#FBBF24" stroke-width="3" stroke-linecap="round" />
            {/* Legs */}
            <line x1="16" y1="36" x2={leg.lx2} y2={leg.ly2} stroke="#1E3A5F" stroke-width="3.5" stroke-linecap="round" />
            <line x1="24" y1="36" x2={leg.rx2} y2={leg.ry2} stroke="#1E3A5F" stroke-width="3.5" stroke-linecap="round" />
            {/* Boots */}
            <circle cx={leg.lx2} cy={leg.ly2 + 1} r="3" fill="#92400E" />
            <circle cx={leg.rx2} cy={leg.ry2 + 1} r="3" fill="#92400E" />
        </svg>
    );
};

// ─── Door SVG ───────────────────────────────────────────────────────────────
const DoorSVG = (p: { index: number; total: number; zone: Zone; state: 'closed' | 'safe' | 'trap'; onClick: () => void; highlight?: boolean }) => {
    const doorColors = ['#6D28D9', '#0891B2', '#B45309', '#DC2626'];
    const color = doorColors[p.index % doorColors.length];
    return (
        <button
            onClick={p.onClick}
            disabled={p.state !== 'closed'}
            class={`relative rounded-xl transition-all duration-300 border-2 
                ${p.state === 'closed' ? 'hover:scale-105 active:scale-95 cursor-pointer border-white/20 hover:border-white/40' : ''}
                ${p.state === 'safe' ? 'border-green-400/60 scale-105' : ''}
                ${p.state === 'trap' ? 'border-red-400/60 scale-95 opacity-60' : ''}
                ${p.highlight ? 'ring-2 ring-yellow-400/60 shadow-[0_0_25px_rgba(250,204,21,0.3)] scale-110 z-10' : ''}
            `}
            style={{
                'touch-action': 'manipulation',
                background: p.state === 'safe' ? '#065F46' : p.state === 'trap' ? '#7F1D1D' : color,
                width: `${Math.min(80, Math.floor(280 / p.total))}px`,
                height: `${Math.min(100, Math.floor(280 / p.total) * 1.3)}px`,
            }}
        >
            <div class="absolute inset-1 rounded-lg border border-white/10 flex items-center justify-center">
                {p.state === 'closed' && (
                    <svg viewBox="0 0 24 24" class="w-5 h-5 text-white/50" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
                        <path d="M12 8v4l3 3" />
                    </svg>
                )}
                {p.state === 'safe' && (
                    <svg viewBox="0 0 24 24" class="w-7 h-7 text-green-400" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M5 12l5 5L19 7" />
                    </svg>
                )}
                {p.state === 'trap' && (
                    <svg viewBox="0 0 24 24" class="w-7 h-7 text-red-400" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                )}
            </div>
            <div class="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white/40">
                {p.index + 1}
            </div>
        </button>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export const TowerClimbGame = (props: TowerClimbProps) => {
    type Phase = 'ready' | 'choosing' | 'walking' | 'entering' | 'transitioning' | 'falling' | 'cashout' | 'done';
    const [phase, setPhase] = createSignal<Phase>('ready');
    const [currentFloor, setCurrentFloor] = createSignal(0);
    const [doorStates, setDoorStates] = createSignal<('closed' | 'safe' | 'trap')[]>([]);
    const [safeIndex, setSafeIndices] = createSignal<number[]>([]);
    const [showReward, setShowReward] = createSignal(false);

    // Animation signals
    const [walkFrame, setWalkFrame] = createSignal(0);
    const [charBottom, setCharBottom] = createSignal(8); // % from bottom of game area
    const [charLeft, setCharLeft] = createSignal(50); // % from left (50 = center)
    const [chosenDoor, setChosenDoor] = createSignal(-1);
    const [charScale, setCharScale] = createSignal(1);
    const [charOpacity, setCharOpacity] = createSignal(1);
    const [floorOpacity, setFloorOpacity] = createSignal(1);
    const [clearText, setClearText] = createSignal('');

    let walkInterval: ReturnType<typeof setInterval> | null = null;

    onMount(() => { GameAudio.startBGM('tower'); });
    onCleanup(() => {
        if (walkInterval) clearInterval(walkInterval);
        GameAudio.stopBGM();
    });

    const currentZone = () => getZone(currentFloor() + 1);
    const accumulatedRewards = () => calcRewards(currentFloor());

    const startGame = () => {
        setCurrentFloor(0);
        resetCharacter();
        setPhase('choosing');
        setupFloor();
    };

    const resetCharacter = () => {
        setCharBottom(8);
        setCharLeft(50);
        setCharScale(1);
        setCharOpacity(1);
        setWalkFrame(0);
        setChosenDoor(-1);
        setClearText('');
        stopWalkAnim();
    };

    const setupFloor = () => {
        const nextFloor = currentFloor() + 1;
        const zone = getZone(nextFloor);
        setDoorStates(Array(zone.doors).fill('closed'));
        const indices = Array.from({ length: zone.doors }, (_, i) => i);
        const shuffled = indices.sort(() => Math.random() - 0.5);
        setSafeIndices(shuffled.slice(0, zone.safe));
        setFloorOpacity(1);
    };

    const startWalkAnim = () => {
        if (walkInterval) clearInterval(walkInterval);
        let frame = 0;
        walkInterval = setInterval(() => { frame++; setWalkFrame(frame); }, 120);
    };

    const stopWalkAnim = () => {
        if (walkInterval) { clearInterval(walkInterval); walkInterval = null; }
        setWalkFrame(0);
    };

    // Calculate door X position (percentage) based on index and count
    const getDoorX = (index: number, total: number): number => {
        if (total === 1) return 50;
        const spacing = Math.min(22, 70 / total);
        const totalWidth = spacing * (total - 1);
        const startX = 50 - totalWidth / 2;
        return startX + index * spacing;
    };

    const chooseDoor = (index: number) => {
        if (phase() !== 'choosing') return;
        const isSafe = safeIndex().includes(index);
        const zone = getZone(currentFloor() + 1);
        const targetX = getDoorX(index, zone.doors);

        setChosenDoor(index);
        setPhase('walking');
        startWalkAnim();
        GameAudio.play('doorOpen');

        // Step 1: Walk horizontally toward door column + walk upward
        setCharLeft(targetX);
        setCharBottom(60); // walk up toward doors

        setTimeout(() => {
            // Step 2: Arrive near door - reveal the chosen door
            stopWalkAnim();
            const newStates = [...doorStates()];
            newStates[index] = isSafe ? 'safe' : 'trap';
            setDoorStates(newStates);

            setTimeout(() => {
                // Reveal all doors
                const allRevealed = Array.from({ length: zone.doors }, (_, i) =>
                    safeIndex().includes(i) ? 'safe' as const : 'trap' as const
                );
                setDoorStates(allRevealed);

                if (isSafe) {
                    // Step 3: Enter the door - character shrinks into door
                    setPhase('entering');
                    GameAudio.play('floorClear');
                    try { navigator.vibrate?.([15]); } catch { }
                    setClearText('CLEAR!');
                    setCharBottom(72);
                    setCharScale(0.2);
                    setCharOpacity(0);

                    setTimeout(() => {
                        // Step 4: Scene transition - fade out, update floor, fade in
                        setPhase('transitioning');
                        setFloorOpacity(0);

                        setTimeout(() => {
                            const nextFloor = currentFloor() + 1;
                            setCurrentFloor(nextFloor);

                            if (nextFloor >= 100) {
                                handleCashOut();
                                return;
                            }

                            // Reset for new floor
                            resetCharacter();
                            setupFloor();

                            // Animate in
                            requestAnimationFrame(() => {
                                setFloorOpacity(1);
                                setPhase('choosing');
                            });
                        }, 500);
                    }, 600);
                } else {
                    // TRAP! Character falls
                    GameAudio.play('towerFall');
                    try { navigator.vibrate?.([50, 30, 80]); } catch { }
                    setPhase('falling');
                    setCharBottom(-20);
                    setCharOpacity(0);

                    setTimeout(() => {
                        setPhase('done');
                        setShowReward(true);
                        GameAudio.stopBGM();
                        props.onComplete({ vcn: 0, rp: 0, floor: currentFloor(), grade: 'FAIL' });
                    }, 1200);
                }
            }, 400);
        }, 800);
    };

    const handleCashOut = () => {
        GameAudio.play('towerCashOut');
        GameAudio.stopBGM();
        setPhase('cashout');
        setShowReward(true);
        const rewards = accumulatedRewards();
        const grade = getGrade(currentFloor());
        props.onComplete({ ...rewards, floor: currentFloor(), grade });
    };

    return (
        <div class="flex flex-col h-full" style="padding-top: env(safe-area-inset-top, 0px);">
            {/* Back */}
            <button onClick={() => { stopWalkAnim(); GameAudio.stopBGM(); props.onBack(); }}
                class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-1.5 px-4 shrink-0"
                style="touch-action: manipulation;">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to games
            </button>

            {/* Ready */}
            <Show when={phase() === 'ready'}>
                <div class="flex-1 flex flex-col items-center justify-center gap-4 px-4 pb-20">
                    <div class="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center">
                        <svg viewBox="0 0 24 24" class="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M3 21h18M5 21V7l7-4 7 4v14" />
                            <rect x="9" y="13" width="6" height="8" rx="1" />
                            <path d="M9 9h6" />
                        </svg>
                    </div>
                    <h2 class="text-2xl font-black text-white">Tower Climb</h2>
                    <p class="text-sm text-gray-500 text-center max-w-xs leading-tight">
                        Choose the right door on each floor to climb higher!
                        Cash out anytime or lose everything if you pick wrong.
                    </p>

                    {/* How to Play */}
                    <div class="w-full max-w-xs space-y-2">
                        <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">How to Play</div>
                        <div class="grid grid-cols-3 gap-2">
                            <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8M8 12h8" /></svg>
                                </div>
                                <div class="text-[9px] text-gray-400 text-center font-bold leading-tight">Tap a door to choose</div>
                            </div>
                            <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div class="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                                </div>
                                <div class="text-[9px] text-gray-400 text-center font-bold leading-tight">Climb floors if safe</div>
                            </div>
                            <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div class="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l2 2" /></svg>
                                </div>
                                <div class="text-[9px] text-gray-400 text-center font-bold leading-tight">Cash out anytime!</div>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-5 gap-1 w-full max-w-xs text-center">
                        {ZONES.map(z => (
                            <div class="p-1.5 rounded-lg bg-[#111113]/60 border border-white/[0.04]">
                                <div class="text-[8px] font-bold" style={{ color: z.accent }}>{z.name}</div>
                                <div class="text-[9px] text-gray-600">F{z.floors[0]}-{z.floors[1]}</div>
                            </div>
                        ))}
                    </div>
                    <button onClick={startGame}
                        class="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-black rounded-2xl hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-95 transition-all text-lg"
                        style="touch-action: manipulation; min-height: 52px;">
                        START CLIMB
                    </button>
                </div>
            </Show>

            {/* Game Play */}
            <Show when={phase() !== 'ready' && phase() !== 'done' && phase() !== 'cashout'}>
                <div class="flex-1 flex flex-col min-h-0 px-3 pb-2">
                    {/* HUD */}
                    <div class="flex items-center justify-between px-3 py-2 bg-[#111113]/60 rounded-xl border border-white/[0.04] mb-2 shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="text-center">
                                <div class="text-[9px] text-gray-600 font-bold">FLOOR</div>
                                <div class="text-2xl font-black text-white tabular-nums">{currentFloor()}</div>
                            </div>
                            <div class="w-px h-8 bg-white/10" />
                            <div class="text-center">
                                <div class="text-[9px] font-bold" style={{ color: currentZone().accent }}>{currentZone().name}</div>
                                <div class="text-xs text-gray-500">{Math.round((currentZone().safe / currentZone().doors) * 100)}% safe</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="text-right">
                                <div class="text-[9px] text-gray-600 font-bold">REWARD</div>
                                <div class="text-sm font-black text-amber-400">{accumulatedRewards().vcn} VCN</div>
                            </div>
                            <Show when={currentFloor() > 0 && phase() === 'choosing'}>
                                <button onClick={handleCashOut}
                                    class="px-3 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl text-xs font-black text-green-400 hover:bg-green-500/30 active:scale-95 transition-all"
                                    style="touch-action: manipulation;">
                                    CASH OUT
                                </button>
                            </Show>
                        </div>
                    </div>

                    {/* Tower Game Area - Doors at top, Character at bottom */}
                    <div class="flex-1 relative overflow-hidden rounded-2xl border border-white/[0.06]"
                        style={{
                            background: `linear-gradient(to top, ${currentZone().color}30, ${currentZone().color}10, #09090b)`,
                            opacity: floorOpacity(),
                            transition: 'opacity 0.5s ease',
                        }}>

                        {/* Floor progress bar - left side */}
                        <div class="absolute left-2 top-2 bottom-2 w-1.5 bg-white/5 rounded-full overflow-hidden z-10">
                            <div class="absolute bottom-0 w-full bg-gradient-to-t rounded-full transition-all duration-700"
                                style={{ height: `${currentFloor()}%`, background: `linear-gradient(to top, ${currentZone().accent}, ${currentZone().accent}40)` }} />
                        </div>

                        {/* Floor number top-right */}
                        <div class="absolute top-3 right-3 z-10 text-right">
                            <div class="text-[10px] text-gray-600 font-bold">NEXT</div>
                            <div class="text-lg font-black" style={{ color: currentZone().accent }}>F{currentFloor() + 1}</div>
                        </div>

                        {/* === DOORS at the TOP === */}
                        <div class="absolute top-6 left-0 right-0 flex items-center justify-center gap-2 sm:gap-3 px-8 z-10">
                            <For each={doorStates()}>
                                {(state, i) => (
                                    <DoorSVG
                                        index={i()}
                                        total={doorStates().length}
                                        zone={currentZone()}
                                        state={state}
                                        onClick={() => chooseDoor(i())}
                                        highlight={chosenDoor() === i() && (phase() === 'walking' || phase() === 'entering')}
                                    />
                                )}
                            </For>
                        </div>

                        {/* Door hint text */}
                        <Show when={phase() === 'choosing'}>
                            <div class="absolute top-[130px] sm:top-[150px] left-0 right-0 text-center z-10">
                                <div class="text-[10px] text-gray-500">
                                    Tap a door! {currentZone().safe} of {currentZone().doors} are safe
                                </div>
                            </div>
                        </Show>

                        {/* Brick/floor lines for atmosphere */}
                        <div class="absolute inset-0 pointer-events-none">
                            {[20, 40, 60, 80].map(y => (
                                <div class="absolute left-0 right-0 border-t border-white/[0.03]" style={{ top: `${y}%` }} />
                            ))}
                        </div>

                        {/* === CHARACTER at the BOTTOM === */}
                        <div
                            class="absolute z-20 transition-all ease-out"
                            style={{
                                bottom: `${charBottom()}%`,
                                left: `${charLeft()}%`,
                                transform: `translateX(-50%) scale(${charScale()})`,
                                opacity: charOpacity(),
                                'transition-duration': phase() === 'walking' ? '800ms' : phase() === 'entering' ? '600ms' : phase() === 'falling' ? '1000ms' : '300ms',
                            }}
                        >
                            <ClimberSprite
                                frame={walkFrame()}
                                falling={phase() === 'falling'}
                            />
                            {/* CLEAR text above character */}
                            <Show when={clearText()}>
                                <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                    <div class="text-sm font-black text-green-400 animate-bounce drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]">
                                        {clearText()}
                                    </div>
                                </div>
                            </Show>
                        </div>

                        {/* Falling overlay */}
                        <Show when={phase() === 'falling'}>
                            <div class="absolute inset-0 bg-red-900/20 flex flex-col items-center justify-center gap-2 z-30 animate-in fade-in duration-500">
                                <div class="text-3xl font-black text-red-400 animate-pulse">WRONG DOOR!</div>
                                <div class="text-sm text-gray-500">Fell from floor {currentFloor()}</div>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* Result */}
            <Show when={phase() === 'done' || phase() === 'cashout'}>
                <Show when={showReward()}>
                    <div class="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-20 animate-in fade-in zoom-in-75 duration-500">
                        <div class={`text-5xl font-black ${phase() === 'cashout' ? 'text-green-400' : 'text-red-400'}`}>
                            {phase() === 'cashout' ? getGrade(currentFloor()) : 'X'}
                        </div>
                        <div class="text-sm text-gray-500 font-bold">
                            {phase() === 'cashout' ? `Safely cashed out at Floor ${currentFloor()}!` : `Fell at Floor ${currentFloor()}`}
                        </div>

                        <div class="text-center p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04] w-full max-w-xs">
                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Highest Floor</div>
                            <div class="text-4xl font-black text-white">{currentFloor()}/100</div>
                        </div>

                        <Show when={phase() === 'cashout'}>
                            <div class="flex items-center gap-6 px-6 py-4 bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-amber-500/10 rounded-2xl border border-white/[0.06]">
                                <div class="flex items-center gap-2">
                                    <svg viewBox="0 0 24 24" class="w-6 h-6" fill="none">
                                        <circle cx="12" cy="12" r="10" fill="#F59E0B" opacity="0.2" />
                                        <circle cx="12" cy="12" r="8" stroke="#F59E0B" stroke-width="1.5" />
                                        <text x="12" y="16" text-anchor="middle" fill="#F59E0B" font-size="10" font-weight="bold">V</text>
                                    </svg>
                                    <span class="text-2xl font-black text-amber-400">+{accumulatedRewards().vcn}</span>
                                    <span class="text-xs text-amber-400/60 font-bold">VCN</span>
                                </div>
                                <div class="w-px h-8 bg-white/10" />
                                <div class="flex items-center gap-2">
                                    <svg viewBox="0 0 24 24" class="w-5 h-5 text-purple-400" fill="currentColor">
                                        <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                    </svg>
                                    <span class="text-2xl font-black text-purple-400">+{accumulatedRewards().rp}</span>
                                    <span class="text-xs text-purple-400/60 font-bold">RP</span>
                                </div>
                            </div>
                        </Show>

                        <Show when={phase() === 'done'}>
                            <div class="text-sm text-gray-600">All rewards lost!</div>
                        </Show>

                        <button onClick={() => { stopWalkAnim(); GameAudio.stopBGM(); props.onBack(); }}
                            class="px-6 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors"
                            style="touch-action: manipulation;">
                            Done
                        </button>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

export default TowerClimbGame;
