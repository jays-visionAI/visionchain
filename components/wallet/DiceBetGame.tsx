import { createSignal, Show, onCleanup } from 'solid-js';
import { GameAudio } from '../../services/game/GameAudio';

// ─── Types ──────────────────────────────────────────────────────────────────
interface DiceBetProps {
    rpAmount: number;        // RP earned from the game
    onResult: (finalRP: number) => void;  // Called with final RP (0 = lost, or multiplied)
    onSkip: () => void;      // Keep original RP
}

// Multiplier map: same number = that number x, except (1,1) = x5, (6,6) = x10
const MULTIPLIERS: Record<number, number> = {
    1: 5, 2: 2, 3: 3, 4: 4, 5: 5, 6: 10,
};

// ─── 3D Dice Face SVG ───────────────────────────────────────────────────────
const DiceDots = (props: { value: number }) => {
    const isSpecial = () => props.value === 6;

    // Dot positions for each face value
    const dots: Record<number, [number, number][]> = {
        1: [[20, 20]],
        2: [[10, 10], [30, 30]],
        3: [[10, 10], [20, 20], [30, 30]],
        4: [[10, 10], [30, 10], [10, 30], [30, 30]],
        5: [[10, 10], [30, 10], [20, 20], [10, 30], [30, 30]],
        6: [[10, 8], [30, 8], [10, 20], [30, 20], [10, 32], [30, 32]],
    };

    return (
        <svg viewBox="0 0 40 40" class="w-full h-full">
            {/* Background */}
            <rect x="0" y="0" width="40" height="40" rx="4" fill={isSpecial() ? '#DC2626' : '#1a1a2e'} />
            <rect x="1" y="1" width="38" height="38" rx="3" fill="none" stroke={isSpecial() ? '#EF4444' : 'rgba(255,255,255,0.1)'} stroke-width="0.5" />
            {/* Dots */}
            {(dots[props.value] || []).map(([cx, cy]) => (
                <circle cx={cx} cy={cy} r="4" fill="white" />
            ))}
        </svg>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export const DiceBetGame = (props: DiceBetProps) => {
    const [phase, setPhase] = createSignal<'offer' | 'rolling' | 'result'>('offer');
    const [dice1, setDice1] = createSignal(1);
    const [dice2, setDice2] = createSignal(1);
    const [isDouble, setIsDouble] = createSignal(false);
    const [multiplier, setMultiplier] = createSignal(0);
    const [rollAngle1, setRollAngle1] = createSignal({ x: 0, y: 0 });
    const [rollAngle2, setRollAngle2] = createSignal({ x: 0, y: 0 });
    const [isRolling, setIsRolling] = createSignal(false);
    const [showParticles, setShowParticles] = createSignal(false);

    let rollInterval: ReturnType<typeof setInterval> | null = null;

    onCleanup(() => {
        if (rollInterval) clearInterval(rollInterval);
    });

    // Face rotation angles for each number
    const faceAngles: Record<number, { x: number; y: number }> = {
        1: { x: 0, y: 0 },
        2: { x: 0, y: 90 },
        3: { x: -90, y: 0 },
        4: { x: 90, y: 0 },
        5: { x: 0, y: -90 },
        6: { x: 180, y: 0 },
    };

    const rollDice = () => {
        setPhase('rolling');
        setIsRolling(true);
        GameAudio.play('diceRoll');
        try { navigator.vibrate?.([30, 20, 30, 20, 50]); } catch { }

        // Random spinning during roll
        let count = 0;
        rollInterval = setInterval(() => {
            count++;
            setRollAngle1({
                x: Math.random() * 720 - 360,
                y: Math.random() * 720 - 360,
            });
            setRollAngle2({
                x: Math.random() * 720 - 360,
                y: Math.random() * 720 - 360,
            });

            if (count >= 12) {
                clearInterval(rollInterval!);
                rollInterval = null;

                // Final values
                const d1 = Math.floor(Math.random() * 6) + 1;
                const d2 = Math.floor(Math.random() * 6) + 1;
                setDice1(d1);
                setDice2(d2);

                // Set final rotation to show correct face
                const angle1 = faceAngles[d1];
                const angle2 = faceAngles[d2];
                setRollAngle1({ x: angle1.x, y: angle1.y });
                setRollAngle2({ x: angle2.x, y: angle2.y });

                setIsRolling(false);

                // Determine result after brief pause
                setTimeout(() => {
                    const double = d1 === d2;
                    setIsDouble(double);

                    if (double) {
                        const mult = MULTIPLIERS[d1];
                        setMultiplier(mult);
                        GameAudio.play('diceWin');
                        setShowParticles(true);
                        setTimeout(() => setShowParticles(false), 2000);
                        try { navigator.vibrate?.([50, 30, 50, 30, 100]); } catch { }
                    } else {
                        setMultiplier(0);
                        GameAudio.play('diceLose');
                        try { navigator.vibrate?.([100]); } catch { }
                    }

                    setPhase('result');
                }, 600);
            }
        }, 80);
    };

    const finalRP = () => isDouble() ? props.rpAmount * multiplier() : 0;

    return (
        <div class="relative">
            {/* Offer Phase */}
            <Show when={phase() === 'offer'}>
                <div class="bg-gradient-to-b from-purple-500/5 to-indigo-500/5 rounded-2xl border border-purple-500/20 p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                    {/* Dice icon */}
                    <div class="flex items-center justify-center gap-2 mb-4">
                        <div class="w-10 h-10">
                            <DiceDots value={6} />
                        </div>
                        <div class="w-10 h-10">
                            <DiceDots value={6} />
                        </div>
                    </div>

                    <h3 class="text-lg font-black text-white mb-2">Double or Nothing!</h3>
                    <p class="text-xs text-gray-400 mb-1">
                        Roll two dice - if both show the same number,
                    </p>
                    <p class="text-xs text-gray-400 mb-4">
                        multiply your RP! (1+1 = <span class="text-cyan-400 font-bold">x5</span>, 6+6 = <span class="text-red-400 font-bold">x10</span>)
                    </p>

                    {/* Stakes */}
                    <div class="bg-[#111113]/60 rounded-xl p-4 mb-5 border border-white/[0.04]">
                        <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">At Stake</div>
                        <div class="flex items-center justify-center gap-2">
                            <svg viewBox="0 0 24 24" class="w-5 h-5 text-purple-400" fill="currentColor">
                                <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                            </svg>
                            <span class="text-3xl font-black text-purple-400">{props.rpAmount}</span>
                            <span class="text-sm text-purple-400/60 font-bold">RP</span>
                        </div>
                    </div>

                    {/* Probability info */}
                    <div class="grid grid-cols-3 gap-2 text-center mb-5">
                        <div class="bg-[#111113]/40 rounded-lg p-2">
                            <div class="text-[9px] text-gray-600 font-bold">WIN CHANCE</div>
                            <div class="text-sm font-black text-green-400">16.7%</div>
                        </div>
                        <div class="bg-[#111113]/40 rounded-lg p-2">
                            <div class="text-[9px] text-gray-600 font-bold">MAX WIN</div>
                            <div class="text-sm font-black text-red-400">x10</div>
                        </div>
                        <div class="bg-[#111113]/40 rounded-lg p-2">
                            <div class="text-[9px] text-gray-600 font-bold">LOSE</div>
                            <div class="text-sm font-black text-gray-500">ALL</div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div class="flex items-center gap-3">
                        <button
                            onClick={() => props.onSkip()}
                            class="flex-1 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors"
                            style="touch-action: manipulation; min-height: 48px;">
                            Keep {props.rpAmount} RP
                        </button>
                        <button
                            onClick={rollDice}
                            class="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] active:scale-95 transition-all"
                            style="touch-action: manipulation; min-height: 48px;">
                            ROLL DICE!
                        </button>
                    </div>
                </div>
            </Show>

            {/* Rolling + Result Phase */}
            <Show when={phase() === 'rolling' || phase() === 'result'}>
                <div class="text-center py-6 animate-in fade-in duration-300">
                    {/* 3D Dice Container */}
                    <div class="flex items-center justify-center gap-8 mb-8" style="perspective: 600px;">
                        {/* Dice 1 */}
                        <div class="w-20 h-20 sm:w-24 sm:h-24 relative" style="perspective: 300px;">
                            <div
                                class={`w-full h-full relative ${isRolling() ? '' : 'transition-transform duration-700 ease-out'}`}
                                style={{
                                    'transform-style': 'preserve-3d',
                                    transform: `rotateX(${rollAngle1().x}deg) rotateY(${rollAngle1().y}deg)`,
                                }}
                            >
                                {/* Face 1 (front) */}
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'translateZ(40px)' }}>
                                    <DiceDots value={1} />
                                </div>
                                {/* Face 6 (back) */}
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateY(180deg) translateZ(40px)' }}>
                                    <DiceDots value={6} />
                                </div>
                                {/* Face 2 (right) */}
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateY(90deg) translateZ(40px)' }}>
                                    <DiceDots value={2} />
                                </div>
                                {/* Face 5 (left) */}
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateY(-90deg) translateZ(40px)' }}>
                                    <DiceDots value={5} />
                                </div>
                                {/* Face 3 (top) */}
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateX(-90deg) translateZ(40px)' }}>
                                    <DiceDots value={3} />
                                </div>
                                {/* Face 4 (bottom) */}
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateX(90deg) translateZ(40px)' }}>
                                    <DiceDots value={4} />
                                </div>
                            </div>
                        </div>

                        {/* Dice 2 */}
                        <div class="w-20 h-20 sm:w-24 sm:h-24 relative" style="perspective: 300px;">
                            <div
                                class={`w-full h-full relative ${isRolling() ? '' : 'transition-transform duration-700 ease-out'}`}
                                style={{
                                    'transform-style': 'preserve-3d',
                                    transform: `rotateX(${rollAngle2().x}deg) rotateY(${rollAngle2().y}deg)`,
                                }}
                            >
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'translateZ(40px)' }}>
                                    <DiceDots value={1} />
                                </div>
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateY(180deg) translateZ(40px)' }}>
                                    <DiceDots value={6} />
                                </div>
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateY(90deg) translateZ(40px)' }}>
                                    <DiceDots value={2} />
                                </div>
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateY(-90deg) translateZ(40px)' }}>
                                    <DiceDots value={5} />
                                </div>
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateX(-90deg) translateZ(40px)' }}>
                                    <DiceDots value={3} />
                                </div>
                                <div class="absolute inset-0 rounded-xl overflow-hidden shadow-lg" style={{ 'backface-visibility': 'hidden', transform: 'rotateX(90deg) translateZ(40px)' }}>
                                    <DiceDots value={4} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rolling text */}
                    <Show when={isRolling()}>
                        <div class="text-lg font-black text-purple-400 animate-pulse mb-4">Rolling...</div>
                    </Show>

                    {/* Result */}
                    <Show when={phase() === 'result'}>
                        <div class="animate-in fade-in zoom-in-95 duration-500 space-y-4">
                            {/* Dice values */}
                            <div class="flex items-center justify-center gap-3 text-2xl font-black">
                                <span class={dice1() === 6 ? 'text-red-400' : 'text-white'}>{dice1()}</span>
                                <span class="text-gray-600">+</span>
                                <span class={dice2() === 6 ? 'text-red-400' : 'text-white'}>{dice2()}</span>
                            </div>

                            {/* Win */}
                            <Show when={isDouble()}>
                                <div class="space-y-3">
                                    <div class={`text-3xl font-black ${dice1() === 6 ? 'text-red-400' : dice1() === 1 ? 'text-cyan-400' : 'text-green-400'}`}>
                                        {dice1() === 6 ? 'JACKPOT!' : dice1() === 1 ? 'LUCKY ONES!' : 'DOUBLE!'}
                                    </div>
                                    <div class={`text-xl font-black ${dice1() === 6 ? 'text-red-400 bg-red-500/10 border-red-500/20' : dice1() === 1 ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' : 'text-green-400 bg-green-500/10 border-green-500/20'} inline-block px-4 py-1.5 rounded-xl border`}>
                                        x{multiplier()}
                                    </div>
                                    <div class="flex items-center justify-center gap-2 mt-4">
                                        <svg viewBox="0 0 24 24" class="w-6 h-6 text-purple-400" fill="currentColor">
                                            <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                        </svg>
                                        <span class="text-xs text-gray-500 line-through mr-1">{props.rpAmount}</span>
                                        <svg viewBox="0 0 24 24" class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                        <span class="text-3xl font-black text-purple-400">{finalRP()}</span>
                                        <span class="text-sm text-purple-400/60 font-bold">RP</span>
                                    </div>
                                </div>
                            </Show>

                            {/* Lose */}
                            <Show when={!isDouble()}>
                                <div class="space-y-3">
                                    <div class="text-3xl font-black text-gray-500">BUST</div>
                                    <div class="text-sm text-gray-600">Different numbers... all RP lost!</div>
                                    <div class="flex items-center justify-center gap-2 mt-2">
                                        <svg viewBox="0 0 24 24" class="w-5 h-5 text-gray-600" fill="currentColor">
                                            <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                        </svg>
                                        <span class="text-2xl font-black text-gray-600 line-through">{props.rpAmount}</span>
                                        <svg viewBox="0 0 24 24" class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                        <span class="text-2xl font-black text-red-500">0 RP</span>
                                    </div>
                                </div>
                            </Show>

                            {/* Continue button */}
                            <button
                                onClick={() => props.onResult(finalRP())}
                                class="mt-4 px-8 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors"
                                style="touch-action: manipulation; min-height: 48px;">
                                Continue
                            </button>
                        </div>
                    </Show>
                </div>
            </Show>

            {/* Win Particles */}
            <Show when={showParticles()}>
                <div class="absolute inset-0 pointer-events-none overflow-hidden">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            class="absolute w-2 h-2 rounded-full animate-dice-particle"
                            style={{
                                left: `${40 + Math.random() * 20}%`,
                                top: '50%',
                                background: ['#A855F7', '#22D3EE', '#F59E0B', '#EF4444', '#22C55E'][i % 5],
                                'animation-delay': `${i * 0.05}s`,
                                '--tx': `${(Math.random() - 0.5) * 200}px`,
                                '--ty': `${-100 - Math.random() * 150}px`,
                            } as any}
                        />
                    ))}
                </div>
            </Show>

            {/* Animations */}
            <style>{`
                @keyframes dice-particle {
                    0% { transform: translate(0, 0) scale(1); opacity: 1; }
                    100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
                }
                .animate-dice-particle {
                    animation: dice-particle 1s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default DiceBetGame;
