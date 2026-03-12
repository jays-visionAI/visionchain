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
// Frame 0: Stand  Frame 1: Left step  Frame 2: Stand  Frame 3: Right step
const ClimberSprite = (p: { frame: number; falling?: boolean; direction?: number }) => {
    const f = p.frame % 4;
    const scaleX = (p.direction || 1) > 0 ? 1 : -1;

    // Leg positions per frame for walking animation
    const legs: Record<number, { lx1: number; ly1: number; lx2: number; ly2: number; rx1: number; ry1: number; rx2: number; ry2: number }> = {
        0: { lx1: 16, ly1: 36, lx2: 13, ly2: 50, rx1: 24, ry1: 36, rx2: 27, ry2: 50 }, // Stand
        1: { lx1: 16, ly1: 36, lx2: 8, ly2: 48, rx1: 24, ry1: 36, rx2: 30, ry2: 46 },  // Left forward
        2: { lx1: 16, ly1: 36, lx2: 14, ly2: 50, rx1: 24, ry1: 36, rx2: 26, ry2: 50 }, // Pass
        3: { lx1: 16, ly1: 36, lx2: 22, ly2: 46, rx1: 24, ry1: 36, rx2: 18, ry2: 48 }, // Right forward
    };
    const leg = legs[f];

    // Arm swing matching legs
    const arms: Record<number, { lx: number; ly: number; rx: number; ry: number }> = {
        0: { lx: 5, ly: 28, rx: 35, ry: 28 },
        1: { lx: 8, ly: 32, rx: 32, ry: 24 },
        2: { lx: 5, ly: 28, rx: 35, ry: 28 },
        3: { lx: 2, ly: 24, rx: 38, ry: 32 },
    };
    const arm = arms[f];

    return (
        <svg viewBox="0 0 40 56" class={`w-10 h-14 ${p.falling ? 'animate-spin' : ''}`}
            style={{ transform: `scaleX(${scaleX})` }}>
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
            {/* Belt */}
            <rect x="14" y="30" width="12" height="3" rx="1" fill="#1E3A5F" />
            <rect x="18" y="30" width="4" height="3" rx="0.5" fill="#F59E0B" />
            {/* Arms */}
            <line x1="14" y1="22" x2={arm.lx} y2={arm.ly} stroke="#FBBF24" stroke-width="3" stroke-linecap="round" />
            <line x1="26" y1="22" x2={arm.rx} y2={arm.ry} stroke="#FBBF24" stroke-width="3" stroke-linecap="round" />
            {/* Legs */}
            <line x1={leg.lx1} y1={leg.ly1} x2={leg.lx2} y2={leg.ly2} stroke="#1E3A5F" stroke-width="3.5" stroke-linecap="round" />
            <line x1={leg.rx1} y1={leg.ry1} x2={leg.rx2} y2={leg.ry2} stroke="#1E3A5F" stroke-width="3.5" stroke-linecap="round" />
            {/* Boots */}
            <circle cx={leg.lx2} cy={leg.ly2 + 1} r="3" fill="#92400E" />
            <circle cx={leg.rx2} cy={leg.ry2 + 1} r="3" fill="#92400E" />
        </svg>
    );
};

// ─── Door SVG ───────────────────────────────────────────────────────────────
const DoorSVG = (p: { index: number; zone: Zone; state: 'closed' | 'opening' | 'safe' | 'trap'; onClick: () => void; highlight?: boolean }) => {
    const doorColors = ['#6D28D9', '#0891B2', '#B45309', '#DC2626'];
    const color = doorColors[p.index % doorColors.length];
    return (
        <button
            onClick={p.onClick}
            disabled={p.state !== 'closed'}
            class={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl transition-all duration-300 border-2 
                ${p.state === 'closed' ? 'hover:scale-110 active:scale-95 cursor-pointer border-white/20 hover:border-white/40' : ''}
                ${p.state === 'safe' ? 'border-green-400/60 scale-105' : ''}
                ${p.state === 'trap' ? 'border-red-400/60 scale-95 opacity-60' : ''}
                ${p.state === 'opening' ? 'border-yellow-400/60 animate-pulse' : ''}
                ${p.highlight ? 'ring-2 ring-white/40 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : ''}
            `}
            style={{ 'touch-action': 'manipulation', background: p.state === 'safe' ? '#065F46' : p.state === 'trap' ? '#7F1D1D' : color }}
        >
            {/* Door frame */}
            <div class="absolute inset-1 rounded-lg border border-white/10 flex items-center justify-center">
                {p.state === 'closed' && (
                    <svg viewBox="0 0 24 24" class="w-6 h-6 text-white/40" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
                        <path d="M12 8v4l3 3" />
                    </svg>
                )}
                {p.state === 'safe' && (
                    <svg viewBox="0 0 24 24" class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M5 12l5 5L19 7" />
                    </svg>
                )}
                {p.state === 'trap' && (
                    <svg viewBox="0 0 24 24" class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                )}
            </div>
            {/* Door number */}
            <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/40">
                {p.index + 1}
            </div>
        </button>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export const TowerClimbGame = (props: TowerClimbProps) => {
    type Phase = 'ready' | 'choosing' | 'walking' | 'entering' | 'climbing' | 'falling' | 'cashout' | 'done';
    const [phase, setPhase] = createSignal<Phase>('ready');
    const [currentFloor, setCurrentFloor] = createSignal(0);
    const [doorStates, setDoorStates] = createSignal<('closed' | 'opening' | 'safe' | 'trap')[]>([]);
    const [safeIndex, setSafeIndices] = createSignal<number[]>([]);
    const [showReward, setShowReward] = createSignal(false);

    // Animation signals
    const [walkFrame, setWalkFrame] = createSignal(0);
    const [walkX, setWalkX] = createSignal(0); // percentage offset from center
    const [walkDirection, setWalkDirection] = createSignal(1); // 1=right, -1=left
    const [chosenDoor, setChosenDoor] = createSignal(-1);
    const [charScale, setCharScale] = createSignal(1);
    const [charOpacity, setCharOpacity] = createSignal(1);
    const [sceneSlide, setSceneSlide] = createSignal(0); // 0=normal, 1=slide down, -1=slide from top
    const [sceneOpacity, setSceneOpacity] = createSignal(1);
    const [floorClearText, setFloorClearText] = createSignal('');

    let walkAnimInterval: ReturnType<typeof setInterval> | null = null;

    onMount(() => { GameAudio.startBGM('tower'); });
    onCleanup(() => {
        if (walkAnimInterval) clearInterval(walkAnimInterval);
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
        setWalkX(0);
        setWalkFrame(0);
        setCharScale(1);
        setCharOpacity(1);
        setWalkDirection(1);
        setChosenDoor(-1);
        if (walkAnimInterval) { clearInterval(walkAnimInterval); walkAnimInterval = null; }
    };

    const setupFloor = () => {
        const nextFloor = currentFloor() + 1;
        const zone = getZone(nextFloor);
        const states: ('closed')[] = Array(zone.doors).fill('closed');
        setDoorStates(states);

        const indices = Array.from({ length: zone.doors }, (_, i) => i);
        const shuffled = indices.sort(() => Math.random() - 0.5);
        setSafeIndices(shuffled.slice(0, zone.safe));

        setSceneSlide(0);
        setSceneOpacity(1);
        setFloorClearText('');
    };

    // Start walking sprite animation
    const startWalkAnim = () => {
        if (walkAnimInterval) clearInterval(walkAnimInterval);
        let frame = 0;
        walkAnimInterval = setInterval(() => {
            frame++;
            setWalkFrame(frame);
        }, 120); // ~8fps walk cycle
    };

    const stopWalkAnim = () => {
        if (walkAnimInterval) { clearInterval(walkAnimInterval); walkAnimInterval = null; }
        setWalkFrame(0);
    };

    const chooseDoor = (index: number) => {
        if (phase() !== 'choosing') return;
        setChosenDoor(index);

        const isSafe = safeIndex().includes(index);
        const zone = getZone(currentFloor() + 1);
        const doorCount = zone.doors;

        // Calculate X offset: doors are evenly spaced, character walks to the chosen door
        // Doors span from -1 to 1, character starts at 0
        const doorPosition = ((index - (doorCount - 1) / 2) / Math.max(doorCount - 1, 1)) * 70; // percentage
        const direction = doorPosition >= 0 ? 1 : -1;
        setWalkDirection(direction);

        // Phase 1: Walking toward door
        setPhase('walking');
        startWalkAnim();
        GameAudio.play('doorOpen');

        // Animate walk
        setWalkX(doorPosition);

        setTimeout(() => {
            stopWalkAnim();

            // Reveal chosen door
            const newStates = [...doorStates()];
            newStates[index] = isSafe ? 'safe' : 'trap';
            setDoorStates(newStates);

            if (isSafe) {
                // Phase 2: Entering door
                setPhase('entering');
                setCharScale(0.3);
                setCharOpacity(0);

                setTimeout(() => {
                    // Reveal all doors
                    const allRevealed = Array.from({ length: doorCount }, (_, i) =>
                        safeIndex().includes(i) ? 'safe' as const : 'trap' as const
                    );
                    setDoorStates(allRevealed);

                    GameAudio.play('floorClear');
                    try { navigator.vibrate?.([15]); } catch { }
                    setFloorClearText('CLEAR!');

                    // Phase 3: Scene transition (climb)
                    setTimeout(() => {
                        setPhase('climbing');
                        setSceneSlide(1); // Slide current scene down
                        setSceneOpacity(0);

                        setTimeout(() => {
                            // Update floor
                            const nextFloor = currentFloor() + 1;
                            setCurrentFloor(nextFloor);

                            if (nextFloor >= 100) {
                                handleCashOut();
                                return;
                            }

                            // Prepare new floor (scene comes from top)
                            resetCharacter();
                            setupFloor();
                            setSceneSlide(-1); // Start from above
                            setSceneOpacity(0);

                            // Animate in
                            requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                    setSceneSlide(0);
                                    setSceneOpacity(1);
                                    setPhase('choosing');
                                });
                            });
                        }, 500);
                    }, 400);
                }, 400);
            } else {
                // TRAP! Reveal all doors
                setTimeout(() => {
                    const allRevealed = Array.from({ length: doorCount }, (_, i) =>
                        safeIndex().includes(i) ? 'safe' as const : 'trap' as const
                    );
                    setDoorStates(allRevealed);

                    GameAudio.play('towerFall');
                    try { navigator.vibrate?.([50, 30, 80]); } catch { }
                    setPhase('falling');

                    setTimeout(() => {
                        setPhase('done');
                        setShowReward(true);
                        GameAudio.stopBGM();
                        props.onComplete({ vcn: 0, rp: 0, floor: currentFloor(), grade: 'FAIL' });
                    }, 1200);
                }, 300);
            }
        }, 600); // Walk duration
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
            <button onClick={() => { if (walkAnimInterval) clearInterval(walkAnimInterval); GameAudio.stopBGM(); props.onBack(); }}
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

                    {/* Tower Visual */}
                    <div class="flex-1 relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06]"
                        style={{ background: `linear-gradient(to top, ${currentZone().color}20, #09090b)` }}>

                        {/* Floor progress bar */}
                        <div class="absolute left-3 top-3 bottom-3 w-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div class="absolute bottom-0 w-full bg-gradient-to-t rounded-full transition-all duration-700"
                                style={{ height: `${currentFloor()}%`, background: `linear-gradient(to top, ${currentZone().accent}, ${currentZone().accent}40)` }} />
                        </div>

                        {/* Scene container with slide transition */}
                        <div class="flex flex-col items-center justify-center gap-3 w-full transition-all duration-500 ease-in-out"
                            style={{
                                transform: `translateY(${sceneSlide() * 120}%)`,
                                opacity: sceneOpacity(),
                            }}>

                            {/* Floor label */}
                            <div class="text-xs font-black tracking-widest" style={{ color: currentZone().accent }}>
                                FLOOR {currentFloor() + 1}
                            </div>

                            {/* Character */}
                            <div class="transition-all ease-out relative"
                                style={{
                                    transform: `translateX(${walkX()}%) scale(${charScale()})`,
                                    opacity: charOpacity(),
                                    'transition-duration': phase() === 'walking' ? '600ms' : '400ms',
                                }}>
                                <ClimberSprite
                                    frame={walkFrame()}
                                    falling={phase() === 'falling'}
                                    direction={walkDirection()}
                                />
                                {/* Floor clear text above character */}
                                <Show when={floorClearText()}>
                                    <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-black text-green-400 animate-bounce whitespace-nowrap">
                                        {floorClearText()}
                                    </div>
                                </Show>
                            </div>

                            {/* Doors */}
                            <div class="flex items-center justify-center gap-3">
                                <For each={doorStates()}>
                                    {(state, i) => (
                                        <DoorSVG
                                            index={i()}
                                            zone={currentZone()}
                                            state={state}
                                            onClick={() => chooseDoor(i())}
                                            highlight={chosenDoor() === i() && (phase() === 'walking' || phase() === 'entering')}
                                        />
                                    )}
                                </For>
                            </div>

                            <Show when={phase() === 'choosing'}>
                                <div class="text-[10px] text-gray-600">
                                    Choose a door! {currentZone().safe} of {currentZone().doors} are safe
                                </div>
                            </Show>

                            <Show when={phase() === 'walking'}>
                                <div class="text-[10px] text-amber-400 font-bold animate-pulse">
                                    Walking...
                                </div>
                            </Show>
                        </div>

                        {/* Falling overlay */}
                        <Show when={phase() === 'falling'}>
                            <div class="absolute inset-0 bg-red-900/20 flex flex-col items-center justify-center gap-2 animate-in fade-in duration-300">
                                <div class="text-4xl font-black text-red-400 animate-pulse">WRONG DOOR!</div>
                                <div class="text-sm text-gray-500">You fell from floor {currentFloor()}...</div>
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

                        <button onClick={() => { if (walkAnimInterval) clearInterval(walkAnimInterval); GameAudio.stopBGM(); props.onBack(); }}
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
