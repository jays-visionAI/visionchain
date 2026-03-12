import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import { GameAudio } from '../../services/game/GameAudio';

// ─── Types ──────────────────────────────────────────────────────────────────
interface FlappyVCNProps {
    onComplete: (result: { vcn: number; rp: number; score: number; grade: string }) => void;
    onBack: () => void;
}

const GRAVITY = 0.4;
const FLAP_FORCE = -6;
const PIPE_GAP = 120;
const PIPE_WIDTH = 50;
const PIPE_SPEED = 2.5;
const BIRD_SIZE = 28;

const GRADE_TABLE = [
    { minScore: 30, grade: 'S', label: 'Legend', vcn: 5.0, rp: 40 },
    { minScore: 20, grade: 'A', label: 'Expert', vcn: 3.0, rp: 25 },
    { minScore: 10, grade: 'B', label: 'Good', vcn: 1.5, rp: 12 },
    { minScore: 5, grade: 'C', label: 'Normal', vcn: 0.5, rp: 5 },
    { minScore: 0, grade: 'D', label: 'Try Again', vcn: 0.1, rp: 2 },
];

interface Pipe { x: number; gapY: number; passed: boolean; }

// ─── Main Component ─────────────────────────────────────────────────────────
export const FlappyVCNGame = (props: FlappyVCNProps) => {
    let canvasRef: HTMLCanvasElement | undefined;
    let animFrameId = 0;

    const [phase, setPhase] = createSignal<'ready' | 'playing' | 'dead' | 'done'>('ready');
    const [score, setScore] = createSignal(0);
    const [result, setResult] = createSignal<{ vcn: number; rp: number; grade: string; label: string } | null>(null);

    let birdY = 0;
    let birdVel = 0;
    let pipes: Pipe[] = [];
    let frameCount = 0;
    let canvasW = 0;
    let canvasH = 0;
    let graceFrames = 0; // Skip collision detection for first N frames

    onMount(() => { GameAudio.startBGM('flappy'); });
    onCleanup(() => {
        cancelAnimationFrame(animFrameId);
        GameAudio.stopBGM();
    });

    const initCanvas = () => {
        if (!canvasRef) return false;
        const rect = canvasRef.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return false; // Canvas not rendered yet
        canvasW = rect.width;
        canvasH = rect.height;
        canvasRef.width = canvasW;
        canvasRef.height = canvasH;
        return true;
    };

    const startGame = () => {
        setPhase('playing');
        setScore(0);
        pipes = [];
        frameCount = 0;
        graceFrames = 45; // ~0.75 seconds of invincibility
        birdVel = FLAP_FORCE * 0.5; // Gentle initial upward push

        // Defer game loop start to next frame so the canvas element is in the DOM
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!initCanvas()) {
                    // Still not ready, try one more time
                    requestAnimationFrame(() => {
                        initCanvas();
                        birdY = canvasH / 2;
                        animFrameId = requestAnimationFrame(gameLoop);
                    });
                    return;
                }
                birdY = canvasH / 2;
                animFrameId = requestAnimationFrame(gameLoop);
            });
        });
    };

    const flap = () => {
        if (phase() === 'ready') {
            startGame();
            return;
        }
        if (phase() !== 'playing') return;
        birdVel = FLAP_FORCE;
        GameAudio.play('flap');
        try { navigator.vibrate?.([5]); } catch { }
    };

    const gameLoop = () => {
        if (phase() !== 'playing') return;
        if (!canvasRef) return;
        const ctx = canvasRef.getContext('2d');
        if (!ctx) return;

        frameCount++;

        // Grace period countdown
        if (graceFrames > 0) graceFrames--;

        // Physics
        birdVel += GRAVITY;
        birdY += birdVel;

        // Clamp bird during grace period (don't let it fly off screen while invincible)
        if (graceFrames > 0) {
            birdY = Math.max(BIRD_SIZE, Math.min(canvasH - BIRD_SIZE, birdY));
        }

        // Spawn pipes (delay first pipe to after grace period)
        if (frameCount > 60 && frameCount % 90 === 0) {
            const gapY = 80 + Math.random() * (canvasH - 160 - PIPE_GAP);
            pipes.push({ x: canvasW, gapY, passed: false });
        }

        // Move pipes
        pipes = pipes.filter(p => p.x + PIPE_WIDTH > -10);
        for (const pipe of pipes) {
            pipe.x -= PIPE_SPEED;
            // Score
            if (!pipe.passed && pipe.x + PIPE_WIDTH < 60) {
                pipe.passed = true;
                setScore(s => s + 1);
                GameAudio.play('pipePass');
            }
        }

        // Collision detection (SKIP during grace period)
        const birdX = 60;
        const birdR = BIRD_SIZE / 2;

        if (graceFrames <= 0) {
            // Floor/ceiling
            if (birdY - birdR <= 0 || birdY + birdR >= canvasH) {
                die();
                return;
            }

            // Pipes
            for (const pipe of pipes) {
                if (birdX + birdR > pipe.x && birdX - birdR < pipe.x + PIPE_WIDTH) {
                    if (birdY - birdR < pipe.gapY || birdY + birdR > pipe.gapY + PIPE_GAP) {
                        die();
                        return;
                    }
                }
            }
        }

        // Draw
        ctx.clearRect(0, 0, canvasW, canvasH);

        // Background gradient
        const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
        bg.addColorStop(0, '#0a0a1a');
        bg.addColorStop(1, '#1a1a3e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let y = 0; y < canvasH; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasW, y); ctx.stroke();
        }

        // Pipes
        for (const pipe of pipes) {
            // Top pipe
            const pipeGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
            pipeGrad.addColorStop(0, '#16a34a');
            pipeGrad.addColorStop(0.5, '#22c55e');
            pipeGrad.addColorStop(1, '#16a34a');
            ctx.fillStyle = pipeGrad;
            ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapY);
            // Cap
            ctx.fillStyle = '#15803d';
            ctx.fillRect(pipe.x - 4, pipe.gapY - 12, PIPE_WIDTH + 8, 12);

            // Bottom pipe
            ctx.fillStyle = pipeGrad;
            ctx.fillRect(pipe.x, pipe.gapY + PIPE_GAP, PIPE_WIDTH, canvasH - pipe.gapY - PIPE_GAP);
            ctx.fillStyle = '#15803d';
            ctx.fillRect(pipe.x - 4, pipe.gapY + PIPE_GAP, PIPE_WIDTH + 8, 12);
        }

        // Bird (VCN coin)
        ctx.save();
        ctx.translate(birdX, birdY);
        const angle = Math.max(-0.5, Math.min(birdVel * 0.05, 1));
        ctx.rotate(angle);

        // Coin body
        ctx.beginPath();
        ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#F59E0B';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, BIRD_SIZE / 2 - 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FBBF24';
        ctx.fill();
        // V label
        ctx.fillStyle = '#92400E';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('V', 0, 1);

        ctx.restore();

        // Score display
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${score()}`, canvasW / 2, 40);

        animFrameId = requestAnimationFrame(gameLoop);
    };

    const die = () => {
        cancelAnimationFrame(animFrameId);
        GameAudio.play('crash');
        GameAudio.stopBGM();
        try { navigator.vibrate?.([30, 20, 50]); } catch { }
        setPhase('dead');

        const s = score();
        const gradeInfo = GRADE_TABLE.find(g => s >= g.minScore) || GRADE_TABLE[GRADE_TABLE.length - 1];
        setResult({ vcn: gradeInfo.vcn, rp: gradeInfo.rp, grade: gradeInfo.grade, label: gradeInfo.label });

        if (gradeInfo.grade === 'S') {
            GameAudio.play('jackpot');
        } else if (gradeInfo.grade !== 'D') {
            GameAudio.play('win');
        }

        props.onComplete({ vcn: gradeInfo.vcn, rp: gradeInfo.rp, score: s, grade: gradeInfo.grade });
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
                    <div class="w-20 h-20 bg-gradient-to-br from-amber-500/20 to-green-500/20 rounded-3xl flex items-center justify-center">
                        <svg viewBox="0 0 32 32" class="w-12 h-12">
                            <circle cx="16" cy="16" r="14" fill="#F59E0B" />
                            <circle cx="16" cy="16" r="11" fill="#FBBF24" />
                            <text x="16" y="21" text-anchor="middle" fill="#92400E" font-size="14" font-weight="bold">V</text>
                        </svg>
                    </div>
                    <h2 class="text-2xl font-black text-white">Flappy VCN</h2>
                    <p class="text-sm text-gray-500 text-center max-w-xs">
                        Tap to fly! Navigate through pipes to earn VCN.<br />
                        The further you go, the bigger the reward.
                    </p>

                    {/* How to Play */}
                    <div class="w-full max-w-xs space-y-2">
                        <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">How to Play</div>
                        <div class="grid grid-cols-3 gap-2">
                            <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div class="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z" /><path d="M15 15l5 5" /></svg>
                                </div>
                                <div class="text-[9px] text-gray-400 text-center font-bold leading-tight">Tap screen to flap up</div>
                            </div>
                            <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16M14 6v12" /><path d="M20 6v12" /></svg>
                                </div>
                                <div class="text-[9px] text-gray-400 text-center font-bold leading-tight">Fly through pipe gaps</div>
                            </div>
                            <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div class="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" /></svg>
                                </div>
                                <div class="text-[9px] text-gray-400 text-center font-bold leading-tight">More pipes = more VCN!</div>
                            </div>
                        </div>
                    </div>

                    <button onClick={flap}
                        class="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-green-500 text-white font-black rounded-2xl hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all text-lg"
                        style="touch-action: manipulation; min-height: 52px;">
                        TAP TO START
                    </button>
                </div>
            </Show>

            <Show when={phase() === 'playing' || phase() === 'dead'}>
                <div class="flex-1 flex flex-col min-h-0 px-2 pb-2">
                    <canvas
                        ref={canvasRef}
                        class="flex-1 w-full rounded-2xl border border-white/[0.06] cursor-pointer"
                        style="touch-action: manipulation;"
                        onClick={flap}
                        onTouchStart={(e) => { e.preventDefault(); flap(); }}
                    />
                </div>
            </Show>

            <Show when={phase() === 'dead' && result()}>
                <div class="absolute inset-0 bg-black/60 flex items-center justify-center z-10 animate-in fade-in duration-300">
                    <div class="text-center p-8 bg-[#111113]/90 rounded-3xl border border-white/[0.08] max-w-sm mx-4">
                        <div class={`text-5xl font-black mb-2 ${result()!.grade === 'S' ? 'text-amber-400' : result()!.grade === 'A' ? 'text-cyan-400' : 'text-gray-400'}`}>
                            {result()!.grade}
                        </div>
                        <div class="text-sm text-gray-500 font-bold mb-4">{result()!.label}</div>
                        <div class="text-4xl font-black text-white mb-4">{score()} pipes</div>

                        <div class="flex items-center gap-6 justify-center px-4 py-3 bg-gradient-to-r from-amber-500/10 to-cyan-500/10 rounded-xl border border-white/[0.06] mb-4">
                            <div class="flex items-center gap-2">
                                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none">
                                    <circle cx="12" cy="12" r="10" fill="#F59E0B" opacity="0.2" />
                                    <circle cx="12" cy="12" r="8" stroke="#F59E0B" stroke-width="1.5" />
                                    <text x="12" y="16" text-anchor="middle" fill="#F59E0B" font-size="10" font-weight="bold">V</text>
                                </svg>
                                <span class="text-xl font-black text-amber-400">+{result()!.vcn}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <svg viewBox="0 0 24 24" class="w-4 h-4 text-purple-400" fill="currentColor">
                                    <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                </svg>
                                <span class="text-xl font-black text-purple-400">+{result()!.rp}</span>
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
    );
};

export default FlappyVCNGame;
