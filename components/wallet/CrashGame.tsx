import { createSignal, Show, onMount, onCleanup, createMemo } from 'solid-js';
import { GameAudio } from '../../services/game/GameAudio';

// ─── Types ──────────────────────────────────────────────────────────────────
interface CrashGameProps {
    onComplete: (result: { vcn: number; rp: number; multiplier: number; cashedOut: boolean }) => void;
    onBack: () => void;
}

const BASE_VCN = 1.0;
const BASE_RP = 5;
const MAX_MULTIPLIER = 100;

// Generate crash point using exponential distribution (house edge ~3%)
function generateCrashPoint(): number {
    const houseEdge = 0.03;
    const r = Math.random();
    if (r < houseEdge) return 1.0; // Instant crash
    const crashAt = 1 / (1 - r);
    return Math.min(MAX_MULTIPLIER, +crashAt.toFixed(2));
}

// ─── Main Component ─────────────────────────────────────────────────────────
export const CrashGame = (props: CrashGameProps) => {
    let canvasRef: HTMLCanvasElement | undefined;
    let animFrameId = 0;

    const [phase, setPhase] = createSignal<'ready' | 'flying' | 'crashed' | 'cashout'>('ready');
    const [multiplier, setMultiplier] = createSignal(1.0);
    const [crashPoint, setCrashPoint] = createSignal(0);
    const [cashedOutAt, setCashedOutAt] = createSignal(0);

    let startTime = 0;
    let crashPt = 0;
    let canvasW = 0;
    let canvasH = 0;

    const currentVCN = createMemo(() => +(BASE_VCN * cashedOutAt()).toFixed(2));
    const currentRP = createMemo(() => Math.round(BASE_RP * cashedOutAt()));

    onMount(() => { GameAudio.startBGM('crash'); });
    onCleanup(() => {
        cancelAnimationFrame(animFrameId);
        GameAudio.stopBGM();
    });

    const initCanvas = () => {
        if (!canvasRef) return;
        const rect = canvasRef.getBoundingClientRect();
        canvasW = rect.width;
        canvasH = rect.height;
        canvasRef.width = canvasW;
        canvasRef.height = canvasH;
    };

    const startGame = () => {
        initCanvas();
        crashPt = generateCrashPoint();
        setCrashPoint(crashPt);
        setMultiplier(1.0);
        setCashedOutAt(0);
        startTime = Date.now();
        setPhase('flying');
        GameAudio.play('rocketLaunch');
        animFrameId = requestAnimationFrame(gameLoop);
    };

    const gameLoop = () => {
        if (phase() !== 'flying') return;
        if (!canvasRef) return;
        const ctx = canvasRef.getContext('2d');
        if (!ctx) return;

        const elapsed = (Date.now() - startTime) / 1000;
        // Multiplier grows exponentially
        const mult = +(1 + elapsed * elapsed * 0.15).toFixed(2);
        setMultiplier(mult);

        // Check crash
        if (mult >= crashPt) {
            crash();
            return;
        }

        // Increase BGM tension
        GameAudio.setBGMIntensity(Math.min(1, mult / 10));

        // Draw
        ctx.clearRect(0, 0, canvasW, canvasH);

        // Background
        const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
        bg.addColorStop(0, '#0a0a1a');
        bg.addColorStop(1, '#1a0a2e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Stars
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let i = 0; i < 30; i++) {
            const x = (i * 137 + elapsed * 30) % canvasW;
            const y = (i * 97 + elapsed * 10) % canvasH;
            ctx.fillRect(x, y, 1.5, 1.5);
        }

        // Graph line
        const graphPadding = 60;
        const graphW = canvasW - graphPadding * 2;
        const graphH = canvasH - graphPadding * 2;

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 5; i++) {
            const y = graphPadding + graphH - (graphH * i / 5);
            ctx.beginPath(); ctx.moveTo(graphPadding, y); ctx.lineTo(graphPadding + graphW, y); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`x${(i * 2).toFixed(0)}`, graphPadding - 5, y + 3);
        }

        // Curve
        const maxDisplay = Math.max(mult * 1.5, 5);
        ctx.beginPath();
        ctx.moveTo(graphPadding, graphPadding + graphH);

        const steps = 50;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * elapsed;
            const m = 1 + t * t * 0.15;
            const x = graphPadding + (t / elapsed) * graphW;
            const y = graphPadding + graphH - ((m - 1) / (maxDisplay - 1)) * graphH;
            ctx.lineTo(x, Math.max(graphPadding, y));
        }

        const gradient = ctx.createLinearGradient(0, graphPadding + graphH, 0, graphPadding);
        gradient.addColorStop(0, mult > 5 ? '#EF4444' : '#22C55E');
        gradient.addColorStop(1, mult > 5 ? '#F97316' : '#22D3EE');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Glow effect along curve
        ctx.strokeStyle = mult > 5 ? 'rgba(239,68,68,0.2)' : 'rgba(34,211,238,0.2)';
        ctx.lineWidth = 8;
        ctx.stroke();

        // Rocket at end of curve
        const rocketX = graphPadding + graphW;
        const rocketY = graphPadding + graphH - ((mult - 1) / (maxDisplay - 1)) * graphH;

        // Rocket trail
        ctx.beginPath();
        ctx.arc(rocketX, Math.max(graphPadding, rocketY), 4, 0, Math.PI * 2);
        ctx.fillStyle = mult > 5 ? '#EF4444' : '#22D3EE';
        ctx.fill();

        // Rocket SVG equivalent
        ctx.save();
        ctx.translate(rocketX, Math.max(graphPadding + 15, rocketY));
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(0, -12); ctx.lineTo(8, 4); ctx.lineTo(-8, 4); ctx.closePath();
        ctx.fill();
        // Flame
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(-4, 4); ctx.lineTo(4, 4); ctx.lineTo(0, 12 + Math.random() * 6); ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Multiplier display (big center text)
        ctx.fillStyle = mult > 5 ? '#EF4444' : '#22D3EE';
        ctx.font = `bold ${Math.min(56, 36 + mult * 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`x${mult.toFixed(2)}`, canvasW / 2, canvasH / 2 - 20);

        // Shadow
        ctx.fillStyle = mult > 5 ? 'rgba(239,68,68,0.1)' : 'rgba(34,211,238,0.1)';
        ctx.font = `bold ${Math.min(56, 36 + mult * 2)}px sans-serif`;
        ctx.fillText(`x${mult.toFixed(2)}`, canvasW / 2 + 2, canvasH / 2 - 18);

        animFrameId = requestAnimationFrame(gameLoop);
    };

    const cashOut = () => {
        if (phase() !== 'flying') return;
        cancelAnimationFrame(animFrameId);
        GameAudio.play('rocketCashOut');
        GameAudio.stopBGM();
        try { navigator.vibrate?.([20]); } catch { }

        setCashedOutAt(multiplier());
        setPhase('cashout');

        const mult = multiplier();
        if (mult >= 10) {
            GameAudio.play('jackpot');
        }

        props.onComplete({
            vcn: +(BASE_VCN * mult).toFixed(2),
            rp: Math.round(BASE_RP * mult),
            multiplier: mult,
            cashedOut: true,
        });
    };

    const crash = () => {
        cancelAnimationFrame(animFrameId);
        GameAudio.play('rocketCrash');
        GameAudio.stopBGM();
        try { navigator.vibrate?.([50, 30, 80]); } catch { }

        setMultiplier(crashPt);
        setPhase('crashed');

        // Draw crashed state
        if (canvasRef) {
            const ctx = canvasRef.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'rgba(239,68,68,0.1)';
                ctx.fillRect(0, 0, canvasW, canvasH);
                ctx.fillStyle = '#EF4444';
                ctx.font = 'bold 48px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('CRASHED!', canvasW / 2, canvasH / 2 - 20);
                ctx.fillStyle = '#9CA3AF';
                ctx.font = '16px sans-serif';
                ctx.fillText(`at x${crashPt.toFixed(2)}`, canvasW / 2, canvasH / 2 + 20);
            }
        }

        props.onComplete({ vcn: 0, rp: 0, multiplier: crashPt, cashedOut: false });
    };

    return (
        <div class="flex flex-col h-full" style="padding-top: env(safe-area-inset-top, 0px);">
            <button onClick={() => { cancelAnimationFrame(animFrameId); GameAudio.stopBGM(); props.onBack(); }}
                class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2 px-4 shrink-0"
                style="touch-action: manipulation;">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to games
            </button>

            <Show when={phase() === 'ready'}>
                <div class="flex-1 flex flex-col items-center justify-center gap-6 px-4">
                    <div class="w-20 h-20 bg-gradient-to-br from-red-500/20 to-amber-500/20 rounded-3xl flex items-center justify-center">
                        <svg viewBox="0 0 24 24" class="w-12 h-12" fill="none">
                            <path d="M12 2L8 10h8L12 2z" fill="#F59E0B" />
                            <path d="M8 10l-2 8h12l-2-8H8z" fill="#EF4444" />
                            <path d="M6 18l2 4h8l2-4H6z" fill="#DC2626" />
                            <circle cx="12" cy="8" r="1.5" fill="white" />
                        </svg>
                    </div>
                    <h2 class="text-2xl font-black text-white">Crash Game</h2>
                    <p class="text-sm text-gray-500 text-center max-w-xs">
                        Watch the rocket fly and cash out before it crashes!<br />
                        The longer you wait, the bigger the multiplier.
                    </p>
                    <button onClick={startGame}
                        class="px-8 py-3.5 bg-gradient-to-r from-red-500 to-amber-500 text-white font-black rounded-2xl hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] active:scale-95 transition-all text-lg"
                        style="touch-action: manipulation; min-height: 52px;">
                        LAUNCH!
                    </button>
                </div>
            </Show>

            <Show when={phase() === 'flying' || phase() === 'crashed' || phase() === 'cashout'}>
                <div class="flex-1 flex flex-col min-h-0 px-2 pb-2 relative">
                    <canvas
                        ref={canvasRef}
                        class="flex-1 w-full rounded-2xl border border-white/[0.06]"
                    />

                    {/* Cash Out button overlay */}
                    <Show when={phase() === 'flying'}>
                        <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                            <button onClick={cashOut}
                                class="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-black text-xl rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_50px_rgba(34,197,94,0.6)] active:scale-95 transition-all animate-pulse"
                                style="touch-action: manipulation; min-height: 60px;">
                                CASH OUT x{multiplier().toFixed(2)}
                            </button>
                        </div>
                    </Show>

                    {/* Crashed overlay */}
                    <Show when={phase() === 'crashed'}>
                        <div class="absolute inset-2 bg-black/40 rounded-2xl flex items-center justify-center z-10">
                            <div class="text-center">
                                <div class="text-4xl font-black text-red-400 mb-2">CRASHED!</div>
                                <div class="text-sm text-gray-400">at x{crashPoint().toFixed(2)}</div>
                                <div class="text-sm text-gray-600 mt-2">All rewards lost!</div>
                                <button onClick={() => { GameAudio.stopBGM(); props.onBack(); }}
                                    class="mt-6 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400"
                                    style="touch-action: manipulation;">
                                    Done
                                </button>
                            </div>
                        </div>
                    </Show>

                    {/* Cash out result */}
                    <Show when={phase() === 'cashout'}>
                        <div class="absolute inset-2 bg-black/40 rounded-2xl flex items-center justify-center z-10">
                            <div class="text-center p-8">
                                <div class="text-xl font-black text-green-400 mb-1">CASHED OUT!</div>
                                <div class="text-4xl font-black text-white mb-4">x{cashedOutAt().toFixed(2)}</div>
                                <div class="flex items-center gap-6 justify-center px-6 py-4 bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-amber-500/10 rounded-2xl border border-white/[0.06] mb-4">
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
                                    class="px-6 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400"
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

export default CrashGame;
