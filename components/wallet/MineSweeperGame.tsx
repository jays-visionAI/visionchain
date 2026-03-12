import { createSignal, Show, For, onMount, onCleanup, createMemo } from 'solid-js';
import { GameAudio } from '../../services/game/GameAudio';

// ─── Types ──────────────────────────────────────────────────────────────────
interface MineSweeperProps {
    onComplete: (result: { vcn: number; rp: number; revealed: number; grade: string }) => void;
    onBack: () => void;
}

type CellState = 'hidden' | 'revealed' | 'mine' | 'exploded';

interface Cell {
    id: number;
    isMine: boolean;
    state: CellState;
}

const GRID_SIZE = 10;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const MINE_COUNT = 20;
const SAFE_CELLS = TOTAL_CELLS - MINE_COUNT;
const BASE_VCN = 0.5;
const BASE_RP = 3;

function getGrade(revealed: number): string {
    if (revealed >= 60) return 'S';
    if (revealed >= 40) return 'A';
    if (revealed >= 25) return 'B';
    if (revealed >= 10) return 'C';
    return 'D';
}

function getMultiplier(revealed: number): number {
    return +(1 + revealed * 0.15).toFixed(2);
}

// ─── Gem SVG ────────────────────────────────────────────────────────────────
const GemSVG = (p: { size?: string }) => (
    <svg viewBox="0 0 24 24" class={p.size || 'w-5 h-5'} fill="none">
        <polygon points="12,2 22,9 18,22 6,22 2,9" fill="#22D3EE" opacity="0.3" />
        <polygon points="12,2 22,9 18,22 6,22 2,9" fill="none" stroke="#22D3EE" stroke-width="1.5" />
        <polygon points="12,5 18,9 15,19 9,19 6,9" fill="#67E8F9" opacity="0.4" />
    </svg>
);

const MineSVG = () => (
    <svg viewBox="0 0 24 24" class="w-5 h-5">
        <circle cx="12" cy="12" r="7" fill="#EF4444" />
        <circle cx="12" cy="12" r="4" fill="#7F1D1D" />
        <line x1="12" y1="3" x2="12" y2="5" stroke="#EF4444" stroke-width="2" />
        <line x1="12" y1="19" x2="12" y2="21" stroke="#EF4444" stroke-width="2" />
        <line x1="3" y1="12" x2="5" y2="12" stroke="#EF4444" stroke-width="2" />
        <line x1="19" y1="12" x2="21" y2="12" stroke="#EF4444" stroke-width="2" />
    </svg>
);

// ─── Main Component ─────────────────────────────────────────────────────────
export const MineSweeperGame = (props: MineSweeperProps) => {
    const [cells, setCells] = createSignal<Cell[]>([]);
    const [phase, setPhase] = createSignal<'ready' | 'playing' | 'exploded' | 'cashout'>('ready');
    const [revealedCount, setRevealedCount] = createSignal(0);
    const [lastRevealId, setLastRevealId] = createSignal(-1);

    const multiplier = createMemo(() => getMultiplier(revealedCount()));
    const currentVCN = createMemo(() => +(BASE_VCN * multiplier()).toFixed(2));
    const currentRP = createMemo(() => Math.round(BASE_RP * multiplier()));
    const safeRemaining = createMemo(() => SAFE_CELLS - revealedCount());
    const dangerPct = createMemo(() => {
        const hidden = TOTAL_CELLS - revealedCount();
        return hidden > 0 ? Math.round((MINE_COUNT / hidden) * 100) : 100;
    });

    onMount(() => { GameAudio.startBGM('mine'); });
    onCleanup(() => { GameAudio.stopBGM(); });

    const initGrid = () => {
        const grid: Cell[] = Array.from({ length: TOTAL_CELLS }, (_, i) => ({
            id: i, isMine: false, state: 'hidden' as CellState,
        }));
        // Place mines
        const indices = Array.from({ length: TOTAL_CELLS }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        for (let i = 0; i < MINE_COUNT; i++) {
            grid[indices[i]].isMine = true;
        }
        setCells(grid);
        setRevealedCount(0);
        setPhase('playing');
    };

    const handleCellClick = (cell: Cell) => {
        if (phase() !== 'playing' || cell.state !== 'hidden') return;

        if (cell.isMine) {
            // BOOM!
            GameAudio.play('mineExplode');
            try { navigator.vibrate?.([50, 30, 80]); } catch { }

            // Reveal all mines
            setCells(prev => prev.map(c => ({
                ...c,
                state: c.isMine ? (c.id === cell.id ? 'exploded' : 'mine') : c.state,
            })));
            setPhase('exploded');
            GameAudio.stopBGM();

            setTimeout(() => {
                props.onComplete({ vcn: 0, rp: 0, revealed: revealedCount(), grade: 'FAIL' });
            }, 800);
        } else {
            // Safe!
            GameAudio.play('gemReveal');
            try { navigator.vibrate?.([8]); } catch { }

            setCells(prev => prev.map(c =>
                c.id === cell.id ? { ...c, state: 'revealed' } : c
            ));
            const newCount = revealedCount() + 1;
            setRevealedCount(newCount);
            setLastRevealId(cell.id);

            // Check if all safe cells revealed
            if (newCount >= SAFE_CELLS) {
                handleCashOut();
            }

            // Increase tension in BGM
            GameAudio.setBGMIntensity(newCount / SAFE_CELLS);
        }
    };

    const handleCashOut = () => {
        GameAudio.play('mineCashOut');
        GameAudio.stopBGM();
        setPhase('cashout');

        // Reveal all mines gently
        setCells(prev => prev.map(c => ({
            ...c, state: c.isMine ? 'mine' : c.state,
        })));

        const grade = getGrade(revealedCount());
        props.onComplete({ vcn: currentVCN(), rp: currentRP(), revealed: revealedCount(), grade });
    };

    return (
        <div class="flex flex-col h-full" style="padding-top: env(safe-area-inset-top, 0px);">
            <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
                class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2 px-4 shrink-0"
                style="touch-action: manipulation;">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to games
            </button>

            {/* Ready */}
            <Show when={phase() === 'ready'}>
                <div class="flex-1 flex flex-col items-center justify-center gap-6 px-4">
                    <div class="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-3xl flex items-center justify-center">
                        <MineSVG />
                    </div>
                    <h2 class="text-2xl font-black text-white">Mine Sweeper</h2>
                    <p class="text-sm text-gray-500 text-center max-w-xs">
                        Tap cells to reveal gems. Avoid the {MINE_COUNT} hidden mines!<br />
                        Each gem increases your multiplier. Cash out anytime.
                    </p>

                    {/* How to Play */}
                    <div class="w-full max-w-xs space-y-2">
                        <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">How to Play</div>
                        <div class="grid grid-cols-3 gap-2">
                            <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div class="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z" /><path d="M15 15l5 5" /></svg>
                                </div>
                                <div class="text-[9px] text-gray-400 text-center font-bold leading-tight">Tap cells to reveal gems</div>
                            </div>
                            <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div class="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                                </div>
                                <div class="text-[9px] text-gray-400 text-center font-bold leading-tight">Avoid mines or lose all!</div>
                            </div>
                            <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div class="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l2 2" /></svg>
                                </div>
                                <div class="text-[9px] text-gray-400 text-center font-bold leading-tight">Cash out anytime!</div>
                            </div>
                        </div>
                    </div>

                    <button onClick={initGrid}
                        class="px-8 py-3.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-black rounded-2xl hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] active:scale-95 transition-all text-lg"
                        style="touch-action: manipulation; min-height: 52px;">
                        START GAME
                    </button>
                </div>
            </Show>

            {/* Playing */}
            <Show when={phase() === 'playing' || phase() === 'exploded' || phase() === 'cashout'}>
                <div class="flex-1 flex flex-col min-h-0 px-2">
                    {/* HUD */}
                    <div class="flex items-center justify-between px-3 py-2 bg-[#111113]/60 rounded-xl border border-white/[0.04] mb-2 shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="text-center">
                                <div class="text-[9px] text-gray-600 font-bold">REVEALED</div>
                                <div class="text-lg font-black text-cyan-400 tabular-nums">{revealedCount()}/{SAFE_CELLS}</div>
                            </div>
                            <div class="w-px h-8 bg-white/10" />
                            <div class="text-center">
                                <div class="text-[9px] text-gray-600 font-bold">MULTIPLIER</div>
                                <div class="text-lg font-black text-amber-400">x{multiplier()}</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="text-right">
                                <div class="text-[9px] text-gray-600 font-bold">DANGER</div>
                                <div class={`text-sm font-black ${dangerPct() > 50 ? 'text-red-400' : dangerPct() > 30 ? 'text-amber-400' : 'text-green-400'}`}>
                                    {dangerPct()}%
                                </div>
                            </div>
                            <Show when={phase() === 'playing' && revealedCount() > 0}>
                                <button onClick={handleCashOut}
                                    class="px-3 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl text-xs font-black text-green-400 hover:bg-green-500/30 active:scale-95 transition-all"
                                    style="touch-action: manipulation;">
                                    CASH OUT<br /><span class="text-[9px] font-bold">{currentVCN()} VCN</span>
                                </button>
                            </Show>
                        </div>
                    </div>

                    {/* Grid */}
                    <div class="flex-1 flex items-center justify-center p-1">
                        <div class="grid gap-[2px] w-full max-w-sm aspect-square"
                            style={{ 'grid-template-columns': `repeat(${GRID_SIZE}, 1fr)` }}>
                            <For each={cells()}>
                                {(cell) => (
                                    <button
                                        onClick={() => handleCellClick(cell)}
                                        disabled={cell.state !== 'hidden' || phase() !== 'playing'}
                                        class={`aspect-square rounded-sm sm:rounded transition-all duration-200 flex items-center justify-center text-[10px] font-bold
                                            ${cell.state === 'hidden' ? 'bg-[#1a1a2e] hover:bg-[#252540] active:scale-90 cursor-pointer border border-white/[0.06]' : ''}
                                            ${cell.state === 'revealed' ? 'bg-cyan-500/10 border border-cyan-500/20' : ''}
                                            ${cell.state === 'mine' ? 'bg-red-500/10 border border-red-500/20' : ''}
                                            ${cell.state === 'exploded' ? 'bg-red-500/30 border-2 border-red-500/50 animate-pulse' : ''}
                                        `}
                                        style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                                    >
                                        <Show when={cell.state === 'revealed'}>
                                            <GemSVG size="w-3 h-3 sm:w-4 sm:h-4" />
                                        </Show>
                                        <Show when={cell.state === 'mine' || cell.state === 'exploded'}>
                                            <svg viewBox="0 0 24 24" class="w-3 h-3 sm:w-4 sm:h-4">
                                                <circle cx="12" cy="12" r="6" fill="#EF4444" />
                                                <circle cx="12" cy="12" r="3" fill="#7F1D1D" />
                                            </svg>
                                        </Show>
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Exploded / Cashout overlay */}
                    <Show when={phase() === 'exploded'}>
                        <div class="absolute inset-0 bg-black/50 flex items-center justify-center z-10 animate-in fade-in duration-300">
                            <div class="text-center p-8">
                                <div class="text-5xl font-black text-red-400 mb-4">BOOM!</div>
                                <div class="text-sm text-gray-400">Hit a mine after {revealedCount()} reveals</div>
                                <div class="text-sm text-gray-600 mt-2">All rewards lost!</div>
                                <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
                                    class="mt-6 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400"
                                    style="touch-action: manipulation;">
                                    Done
                                </button>
                            </div>
                        </div>
                    </Show>

                    <Show when={phase() === 'cashout'}>
                        <div class="absolute inset-0 bg-black/50 flex items-center justify-center z-10 animate-in fade-in duration-300">
                            <div class="text-center p-8">
                                <div class="text-5xl font-black text-green-400 mb-2">{getGrade(revealedCount())}</div>
                                <div class="text-sm text-gray-500 mb-4">{revealedCount()} gems found at x{multiplier()}</div>
                                <div class="flex items-center gap-6 justify-center px-6 py-4 bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-amber-500/10 rounded-2xl border border-white/[0.06]">
                                    <div class="flex items-center gap-2">
                                        <svg viewBox="0 0 24 24" class="w-6 h-6" fill="none">
                                            <circle cx="12" cy="12" r="10" fill="#F59E0B" opacity="0.2" />
                                            <circle cx="12" cy="12" r="8" stroke="#F59E0B" stroke-width="1.5" />
                                            <text x="12" y="16" text-anchor="middle" fill="#F59E0B" font-size="10" font-weight="bold">V</text>
                                        </svg>
                                        <span class="text-2xl font-black text-amber-400">+{currentVCN()}</span>
                                        <span class="text-xs text-amber-400/60 font-bold">VCN</span>
                                    </div>
                                    <div class="w-px h-8 bg-white/10" />
                                    <div class="flex items-center gap-2">
                                        <svg viewBox="0 0 24 24" class="w-5 h-5 text-purple-400" fill="currentColor">
                                            <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                        </svg>
                                        <span class="text-2xl font-black text-purple-400">+{currentRP()}</span>
                                        <span class="text-xs text-purple-400/60 font-bold">RP</span>
                                    </div>
                                </div>
                                <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
                                    class="mt-6 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400"
                                    style="touch-action: manipulation;">
                                    Done
                                </button>
                            </div>
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

export default MineSweeperGame;
