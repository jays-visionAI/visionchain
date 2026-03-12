import { createSignal, Show, For, onMount, onCleanup } from 'solid-js';
import { GameAudio } from '../../services/game/GameAudio';

// ─── Types ──────────────────────────────────────────────────────────────────
interface CryptoSlotsProps {
    onComplete: (result: { vcn: number; rp: number; match: number; jackpot: boolean }) => void;
    onBack: () => void;
}

interface SlotSymbol {
    id: string; name: string; color: string; bg: string;
}

const SYMBOLS: SlotSymbol[] = [
    { id: 'btc', name: 'BTC', color: '#F7931A', bg: '#F7931A20' },
    { id: 'eth', name: 'ETH', color: '#627EEA', bg: '#627EEA20' },
    { id: 'sol', name: 'SOL', color: '#14F195', bg: '#14F19520' },
    { id: 'vcn', name: 'VCN', color: '#22D3EE', bg: '#22D3EE20' },
    { id: 'bnb', name: 'BNB', color: '#F3BA2F', bg: '#F3BA2F20' },
    { id: 'doge', name: 'DOGE', color: '#C3A634', bg: '#C3A63420' },
];

function randomSymbol(): SlotSymbol {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

// ─── Realistic Crypto Symbol SVGs ───────────────────────────────────────────
const SymbolIcon = (p: { symbol: SlotSymbol; class?: string }) => (
    <div class={`flex items-center justify-center rounded-xl ${p.class || 'w-16 h-16'}`}
        style={{ background: p.symbol.bg }}>
        {p.symbol.id === 'btc' && (
            <svg viewBox="0 0 32 32" class="w-10 h-10">
                <circle cx="16" cy="16" r="14" fill="#F7931A" />
                <path d="M21.2 14.3c.3-2-1.2-3-3.3-3.8l.7-2.7-1.6-.4-.6 2.6c-.4-.1-.9-.2-1.3-.3l.7-2.6-1.7-.4-.7 2.7c-.3-.1-.7-.2-1-.3l-2.3-.6-.4 1.8s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.2c0 0 .1 0 .1 0l-.1 0-1.1 4.5c-.1.2-.3.5-.7.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5c.4.1.8.2 1.2.3l-.7 2.8 1.6.4.7-2.7c.5.1.9.2 1.3.3l-.7 2.7 1.7.4.7-2.8c2.8.5 5 .3 5.9-2.3.7-2-.1-3.2-1.5-3.9 1.1-.3 1.9-1 2.1-2.5zm-3.7 5.3c-.5 2-4 .9-5.1.7l.9-3.7c1.1.3 4.7.8 4.2 3zm.5-5.3c-.5 1.8-3.4.9-4.3.7l.8-3.3c1 .2 4 .6 3.5 2.6z" fill="white" />
            </svg>
        )}
        {p.symbol.id === 'eth' && (
            <svg viewBox="0 0 32 32" class="w-10 h-10">
                <circle cx="16" cy="16" r="14" fill="#627EEA" />
                <path d="M16 4l-8 13 8 4.5 8-4.5L16 4z" fill="white" opacity="0.6" />
                <path d="M16 4v13.5l8-4.5L16 4z" fill="white" opacity="0.8" />
                <path d="M16 23.5l-8-5.5L16 28l8-10-8 5.5z" fill="white" opacity="0.6" />
                <path d="M16 23.5V28l8-10-8 5.5z" fill="white" opacity="0.8" />
            </svg>
        )}
        {p.symbol.id === 'sol' && (
            <svg viewBox="0 0 32 32" class="w-10 h-10">
                <circle cx="16" cy="16" r="14" fill="#0D0D0D" />
                <defs>
                    <linearGradient id="sol-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#00FFA3" />
                        <stop offset="50%" stop-color="#03E1FF" />
                        <stop offset="100%" stop-color="#DC1FFF" />
                    </linearGradient>
                </defs>
                <path d="M8 21.5h13.5l2.5-2.5H10.5L8 21.5z" fill="url(#sol-grad)" />
                <path d="M8 12.5l2.5-2.5H24l-2.5 2.5H8z" fill="url(#sol-grad)" />
                <path d="M8 17h13.5L24 14.5H10.5L8 17z" fill="url(#sol-grad)" />
            </svg>
        )}
        {p.symbol.id === 'vcn' && (
            <svg viewBox="0 0 32 32" class="w-10 h-10">
                <circle cx="16" cy="16" r="14" fill="#0891B2" />
                <circle cx="16" cy="16" r="11" fill="#22D3EE" opacity="0.3" />
                <circle cx="16" cy="16" r="10" stroke="#22D3EE" stroke-width="1.5" fill="none" />
                <text x="16" y="21" text-anchor="middle" fill="white" font-size="13" font-weight="bold">V</text>
                <path d="M16 5a11 11 0 0 1 0 22" stroke="#67E8F9" stroke-width="1" fill="none" opacity="0.5" />
            </svg>
        )}
        {p.symbol.id === 'bnb' && (
            <svg viewBox="0 0 32 32" class="w-10 h-10">
                <circle cx="16" cy="16" r="14" fill="#F3BA2F" />
                <path d="M16 8l-3 3 3 3 3-3-3-3z" fill="white" />
                <path d="M10 14l-3 3 3 3 3-3-3-3z" fill="white" />
                <path d="M22 14l-3 3 3 3 3-3-3-3z" fill="white" />
                <path d="M16 20l-3 3 3 3 3-3-3-3z" fill="white" />
                <path d="M16 14l-3 3 3 3 3-3-3-3z" fill="white" opacity="0.6" />
            </svg>
        )}
        {p.symbol.id === 'doge' && (
            <svg viewBox="0 0 32 32" class="w-10 h-10">
                <circle cx="16" cy="16" r="14" fill="#C3A634" />
                <circle cx="16" cy="16" r="11" fill="#E6C84E" />
                <text x="16" y="22" text-anchor="middle" fill="#8B6914" font-size="16" font-weight="900" font-family="serif">D</text>
                <line x1="14" y1="12" x2="14" y2="22" stroke="#8B6914" stroke-width="1.5" />
            </svg>
        )}
    </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────
export const CryptoSlotsGame = (props: CryptoSlotsProps) => {
    const [phase, setPhase] = createSignal<'ready' | 'spinning' | 'stopping' | 'result'>('ready');
    const [reels, setReels] = createSignal<SlotSymbol[]>([randomSymbol(), randomSymbol(), randomSymbol()]);
    const [spinReels, setSpinReels] = createSignal<SlotSymbol[][]>([[], [], []]);
    const [spinIndex, setSpinIndex] = createSignal([0, 0, 0]);
    const [matchCount, setMatchCount] = createSignal(0);
    const [isJackpot, setIsJackpot] = createSignal(false);
    const [reward, setReward] = createSignal({ vcn: 0, rp: 0 });

    let spinIntervals: (ReturnType<typeof setInterval> | null)[] = [null, null, null];

    onMount(() => { GameAudio.startBGM('slots'); });
    onCleanup(() => {
        spinIntervals.forEach(i => i && clearInterval(i));
        GameAudio.stopBGM();
    });

    const spin = () => {
        if (phase() === 'spinning' || phase() === 'stopping') return;

        // Determine final results
        const finalReels = [randomSymbol(), randomSymbol(), randomSymbol()];
        setReels(finalReels);
        setPhase('spinning');
        GameAudio.play('slotSpin');

        // Create spinning reels (random symbols cycling)
        const newSpinReels: SlotSymbol[][] = [[], [], []];
        for (let r = 0; r < 3; r++) {
            for (let i = 0; i < 20; i++) {
                newSpinReels[r].push(randomSymbol());
            }
            newSpinReels[r].push(finalReels[r]); // Last one is the result
        }
        setSpinReels(newSpinReels);

        // Animate each reel
        const indices = [0, 0, 0];
        setSpinIndex([...indices]);

        for (let r = 0; r < 3; r++) {
            const reelIdx = r;
            let idx = 0;
            spinIntervals[reelIdx] = setInterval(() => {
                idx++;
                indices[reelIdx] = idx;
                setSpinIndex([...indices]);

                if (idx >= newSpinReels[reelIdx].length - 1) {
                    clearInterval(spinIntervals[reelIdx]!);
                    spinIntervals[reelIdx] = null;
                    GameAudio.play('slotStop');
                    try { navigator.vibrate?.([15]); } catch { }

                    // Check if all stopped
                    if (spinIntervals.every(i => i === null)) {
                        setTimeout(() => evaluateResult(finalReels), 300);
                    }
                }
            }, 80 + reelIdx * 30); // Staggered speed
        }
    };

    const evaluateResult = (finalReels: SlotSymbol[]) => {
        setPhase('result');

        const ids = finalReels.map(s => s.id);
        const unique = new Set(ids).size;
        let match = 0;
        let jackpot = false;
        let vcn = 0.05;
        let rp = 1;

        if (unique === 1) {
            // Triple match!
            match = 3;
            if (ids[0] === 'vcn') {
                // VCN JACKPOT!
                jackpot = true;
                vcn = 10.0;
                rp = 50;
                GameAudio.play('jackpot');
            } else {
                vcn = 2.0;
                rp = 15;
                GameAudio.play('slotWin');
            }
        } else if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) {
            // Double match
            match = 2;
            vcn = 0.5;
            rp = 5;
            GameAudio.play('win');
        } else {
            // No match
            match = 0;
            GameAudio.play('diceLose');
        }

        setMatchCount(match);
        setIsJackpot(jackpot);
        setReward({ vcn, rp });

        // 2-second delay so user can see the result before dice bet overlay
        setTimeout(() => {
            props.onComplete({ vcn, rp, match, jackpot });
        }, 2000);
    };

    const currentDisplaySymbol = (reelIdx: number): SlotSymbol => {
        if (phase() === 'spinning' || phase() === 'stopping') {
            const spins = spinReels()[reelIdx];
            const idx = Math.min(spinIndex()[reelIdx], spins.length - 1);
            return spins[idx] || reels()[reelIdx];
        }
        return reels()[reelIdx];
    };

    return (
        <div class="flex flex-col h-full" style="padding-top: env(safe-area-inset-top, 0px);">
            <button onClick={() => { spinIntervals.forEach(i => i && clearInterval(i)); GameAudio.stopBGM(); props.onBack(); }}
                class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2 px-4 shrink-0"
                style="touch-action: manipulation;">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to games
            </button>

            <div class="flex-1 flex flex-col items-center justify-center gap-6 px-4">
                <div class="text-xs font-black text-amber-400 uppercase tracking-widest">Crypto Slots</div>

                {/* Slot Machine Frame */}
                <div class="relative p-6 bg-gradient-to-b from-[#1a1a2e] to-[#111113] rounded-3xl border-2 border-amber-500/20 shadow-[0_0_40px_rgba(245,158,11,0.1)] w-full max-w-sm">
                    {/* Top lights */}
                    <div class="flex justify-center gap-2 mb-4">
                        {[0, 1, 2, 3, 4].map(i => (
                            <div class={`w-3 h-3 rounded-full ${phase() === 'spinning' ? 'animate-pulse' : ''}`}
                                style={{ background: i % 2 === 0 ? '#F59E0B' : '#EF4444', opacity: phase() === 'spinning' ? '1' : '0.3' }} />
                        ))}
                    </div>

                    {/* Reels */}
                    <div class="flex items-center justify-center gap-3 mb-4">
                        <For each={[0, 1, 2]}>
                            {(reelIdx) => (
                                <div class={`relative bg-black/40 rounded-xl border border-white/[0.08] p-3 overflow-hidden
                                    ${phase() === 'spinning' ? 'shadow-[0_0_15px_rgba(245,158,11,0.2)]' : ''}
                                    ${phase() === 'result' && matchCount() === 3 ? 'shadow-[0_0_20px_rgba(245,158,11,0.4)] border-amber-500/40' : ''}
                                `}>
                                    <div class={phase() === 'spinning' && spinIndex()[reelIdx] < (spinReels()[reelIdx]?.length || 0) - 1 ? 'animate-pulse' : ''}>
                                        <SymbolIcon symbol={currentDisplaySymbol(reelIdx)} />
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>

                    {/* Result */}
                    <Show when={phase() === 'result'}>
                        <div class="text-center animate-in fade-in zoom-in-95 duration-300">
                            {isJackpot() ? (
                                <div class="text-2xl font-black text-amber-400 animate-pulse mb-2">VCN JACKPOT!</div>
                            ) : matchCount() === 3 ? (
                                <div class="text-xl font-black text-amber-400 mb-2">TRIPLE MATCH!</div>
                            ) : matchCount() === 2 ? (
                                <div class="text-lg font-black text-cyan-400 mb-2">DOUBLE MATCH!</div>
                            ) : (
                                <div class="text-sm font-bold text-gray-500 mb-2">No match</div>
                            )}

                            <div class="flex items-center justify-center gap-4 mb-4">
                                <div class="flex items-center gap-1.5">
                                    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none">
                                        <circle cx="12" cy="12" r="10" fill="#F59E0B" opacity="0.2" />
                                        <circle cx="12" cy="12" r="8" stroke="#F59E0B" stroke-width="1.5" />
                                        <text x="12" y="16" text-anchor="middle" fill="#F59E0B" font-size="10" font-weight="bold">V</text>
                                    </svg>
                                    <span class="text-xl font-black text-amber-400">+{reward().vcn}</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-purple-400" fill="currentColor">
                                        <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                    </svg>
                                    <span class="text-xl font-black text-purple-400">+{reward().rp}</span>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Spin Button */}
                    <button onClick={phase() === 'result' ? () => { GameAudio.stopBGM(); props.onBack(); } : spin}
                        disabled={phase() === 'spinning'}
                        class={`w-full py-4 rounded-2xl font-black text-lg transition-all
                            ${phase() === 'spinning' ? 'bg-gray-800 text-gray-600 cursor-wait' : ''}
                            ${phase() === 'ready' ? 'bg-gradient-to-r from-amber-500 to-red-500 text-white hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] active:scale-95' : ''}
                            ${phase() === 'result' ? 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-gray-400' : ''}
                        `}
                        style="touch-action: manipulation; min-height: 52px;">
                        {phase() === 'spinning' ? 'SPINNING...' : phase() === 'result' ? 'Done' : 'PULL LEVER'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CryptoSlotsGame;
