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

// ─── Character SVG ──────────────────────────────────────────────────────────
const ClimberSVG = (p: { falling?: boolean }) => (
    <svg viewBox="0 0 40 60" class={`w-10 h-15 ${p.falling ? 'animate-spin' : ''}`}>
        {/* Head */}
        <circle cx="20" cy="10" r="8" fill="#FBBF24" />
        <circle cx="17" cy="8" r="1.5" fill="#1a1a2e" />
        <circle cx="23" cy="8" r="1.5" fill="#1a1a2e" />
        <path d="M17 13 Q20 16 23 13" fill="none" stroke="#1a1a2e" stroke-width="1" />
        {/* Body */}
        <rect x="14" y="18" width="12" height="18" rx="3" fill="#3B82F6" />
        {/* Arms */}
        <line x1="14" y1="22" x2="5" y2="18" stroke="#FBBF24" stroke-width="3" stroke-linecap="round" />
        <line x1="26" y1="22" x2="35" y2="18" stroke="#FBBF24" stroke-width="3" stroke-linecap="round" />
        {/* Legs */}
        <line x1="16" y1="36" x2="12" y2="50" stroke="#1E3A5F" stroke-width="3" stroke-linecap="round" />
        <line x1="24" y1="36" x2="28" y2="50" stroke="#1E3A5F" stroke-width="3" stroke-linecap="round" />
        {/* Boots */}
        <rect x="9" y="48" width="6" height="4" rx="2" fill="#92400E" />
        <rect x="25" y="48" width="6" height="4" rx="2" fill="#92400E" />
    </svg>
);

// ─── Door SVG ───────────────────────────────────────────────────────────────
const DoorSVG = (p: { index: number; zone: Zone; state: 'closed' | 'opening' | 'safe' | 'trap'; onClick: () => void }) => {
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
    const [phase, setPhase] = createSignal<'ready' | 'playing' | 'choosing' | 'climbing' | 'falling' | 'cashout' | 'done'>('ready');
    const [currentFloor, setCurrentFloor] = createSignal(0);
    const [doorStates, setDoorStates] = createSignal<('closed' | 'opening' | 'safe' | 'trap')[]>([]);
    const [safeIndex, setSafeIndices] = createSignal<number[]>([]);
    const [characterY, setCharacterY] = createSignal(0);
    const [showReward, setShowReward] = createSignal(false);

    onMount(() => { GameAudio.startBGM('tower'); });
    onCleanup(() => { GameAudio.stopBGM(); });

    const currentZone = () => getZone(currentFloor() + 1);
    const accumulatedRewards = () => calcRewards(currentFloor());

    const startGame = () => {
        setCurrentFloor(0);
        setPhase('choosing');
        setupFloor();
    };

    const setupFloor = () => {
        const nextFloor = currentFloor() + 1;
        const zone = getZone(nextFloor);
        const states: ('closed')[] = Array(zone.doors).fill('closed');
        setDoorStates(states);

        // Determine safe doors
        const indices = Array.from({ length: zone.doors }, (_, i) => i);
        const shuffled = indices.sort(() => Math.random() - 0.5);
        setSafeIndices(shuffled.slice(0, zone.safe));
    };

    const chooseDoor = (index: number) => {
        if (phase() !== 'choosing') return;
        setPhase('choosing'); // Lock

        GameAudio.play('doorOpen');

        const isSafe = safeIndex().includes(index);

        // Reveal chosen door
        const newStates = [...doorStates()];
        newStates[index] = isSafe ? 'safe' : 'trap';
        setDoorStates(newStates);

        setTimeout(() => {
            // Reveal all doors
            const zone = getZone(currentFloor() + 1);
            const allRevealed = Array.from({ length: zone.doors }, (_, i) =>
                safeIndex().includes(i) ? 'safe' as const : 'trap' as const
            );
            setDoorStates(allRevealed);

            if (isSafe) {
                GameAudio.play('floorClear');
                try { navigator.vibrate?.([15]); } catch { }
                setPhase('climbing');

                // Climbing animation
                setTimeout(() => {
                    const nextFloor = currentFloor() + 1;
                    setCurrentFloor(nextFloor);

                    if (nextFloor >= 100) {
                        // REACHED THE TOP!
                        handleCashOut();
                    } else {
                        setPhase('choosing');
                        setupFloor();
                    }
                }, 600);
            } else {
                // FALL!
                GameAudio.play('towerFall');
                try { navigator.vibrate?.([50, 30, 80]); } catch { }
                setPhase('falling');

                setTimeout(() => {
                    setPhase('done');
                    setShowReward(true);
                    GameAudio.stopBGM();
                    props.onComplete({ vcn: 0, rp: 0, floor: currentFloor(), grade: 'FAIL' });
                }, 1200);
            }
        }, 500);
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
            <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
                class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2 px-4 shrink-0"
                style="touch-action: manipulation;">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to games
            </button>

            {/* Ready */}
            <Show when={phase() === 'ready'}>
                <div class="flex-1 flex flex-col items-center justify-center gap-6 px-4">
                    <div class="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-3xl flex items-center justify-center">
                        <svg viewBox="0 0 24 24" class="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M3 21h18M5 21V7l7-4 7 4v14" />
                            <rect x="9" y="13" width="6" height="8" rx="1" />
                            <path d="M9 9h6" />
                        </svg>
                    </div>
                    <h2 class="text-2xl font-black text-white">Tower Climb</h2>
                    <p class="text-sm text-gray-500 text-center max-w-xs">
                        Choose the right door on each floor to climb higher!<br />
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
            <Show when={phase() !== 'ready' && phase() !== 'done'}>
                <div class="flex-1 flex flex-col min-h-0 px-4">
                    {/* HUD */}
                    <div class="flex items-center justify-between px-4 py-2.5 bg-[#111113]/60 rounded-xl border border-white/[0.04] mb-3 shrink-0">
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
                        <div class="flex items-center gap-3">
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
                    <div class="flex-1 relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-white/[0.06]"
                        style={{ background: `linear-gradient(to top, ${currentZone().color}20, #09090b)` }}>

                        {/* Floor progress */}
                        <div class="absolute left-3 top-3 bottom-3 w-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div class="absolute bottom-0 w-full bg-gradient-to-t rounded-full transition-all duration-500"
                                style={{ height: `${currentFloor()}%`, background: `linear-gradient(to top, ${currentZone().accent}, ${currentZone().accent}40)` }} />
                        </div>

                        {/* Character */}
                        <div class={`transition-all duration-500 ${phase() === 'falling' ? 'translate-y-40 opacity-0 rotate-180' : phase() === 'climbing' ? '-translate-y-3' : ''}`}>
                            <ClimberSVG falling={phase() === 'falling'} />
                        </div>

                        {/* Floor label */}
                        <div class="text-xs font-black tracking-widest" style={{ color: currentZone().accent }}>
                            FLOOR {currentFloor() + 1}
                        </div>

                        {/* Doors */}
                        <Show when={phase() === 'choosing' || phase() === 'climbing'}>
                            <div class="flex items-center justify-center gap-3">
                                <For each={doorStates()}>
                                    {(state, i) => (
                                        <DoorSVG
                                            index={i()}
                                            zone={currentZone()}
                                            state={state}
                                            onClick={() => chooseDoor(i())}
                                        />
                                    )}
                                </For>
                            </div>
                            <div class="text-[10px] text-gray-600 mt-2">
                                Choose a door! {currentZone().safe} of {currentZone().doors} are safe
                            </div>
                        </Show>

                        {/* Falling text */}
                        <Show when={phase() === 'falling'}>
                            <div class="text-4xl font-black text-red-400 animate-pulse">WRONG DOOR!</div>
                            <div class="text-sm text-gray-500">You fell from floor {currentFloor()}...</div>
                        </Show>

                        {/* Cash out celebration */}
                        <Show when={phase() === 'cashout'}>
                            <div class="text-4xl font-black text-green-400 animate-pulse">CASHED OUT!</div>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* Result */}
            <Show when={phase() === 'done' || phase() === 'cashout'}>
                <Show when={showReward()}>
                    <div class="flex-1 flex flex-col items-center justify-center gap-6 px-4 animate-in fade-in zoom-in-75 duration-500">
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

                        <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
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
