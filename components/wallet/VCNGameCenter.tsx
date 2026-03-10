import { createSignal, Show, For, onMount, createMemo, onCleanup, Accessor } from 'solid-js';
import type { JSX } from 'solid-js';
import { WalletViewHeader } from './WalletViewHeader';
import { useI18n } from '../../i18n/i18nContext';
import { addRewardPoints, getRPConfig, getFirebaseAuth } from '../../services/firebaseService';
import { getFirebaseDb } from '../../services/firebaseService';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

// ─── Props ──────────────────────────────────────────────────────────────────
interface GameCenterProps {
    userProfile: Accessor<{ referralCode: string; email: string; referralCount?: number;[k: string]: any }>;
}

// ─── Sound Engine (Web Audio API) ───────────────────────────────────────────
const SFX = {
    _ctx: null as AudioContext | null,
    _getCtx() { if (!this._ctx) this._ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); return this._ctx; },
    play(type: 'tick' | 'win' | 'jackpot' | 'tap' | 'break') {
        try {
            const ctx = this._getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            const now = ctx.currentTime;
            if (type === 'tick') {
                osc.frequency.value = 800 + Math.random() * 400;
                osc.type = 'sine'; gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                osc.start(now); osc.stop(now + 0.06);
            } else if (type === 'win') {
                osc.type = 'sine';
                [523, 659, 784].forEach((f, i) => { osc.frequency.setValueAtTime(f, now + i * 0.12); });
                gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc.start(now); osc.stop(now + 0.4);
            } else if (type === 'jackpot') {
                [523, 659, 784, 1047, 784, 1047].forEach((f, i) => {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = i < 4 ? 'sine' : 'triangle';
                    o.frequency.value = f; g.gain.setValueAtTime(0.12, now + i * 0.1);
                    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
                    o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.25);
                });
                return;
            } else if (type === 'tap') {
                osc.frequency.value = 200 + Math.random() * 100; osc.type = 'square';
                gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.start(now); osc.stop(now + 0.05);
            } else if (type === 'break') {
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
                gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
            }
        } catch { /* Audio not supported */ }
    }
};

// ─── Confetti Particles ─────────────────────────────────────────────────────
function launchConfetti(container: HTMLElement) {
    const colors = ['#EF4444', '#F59E0B', '#22D3EE', '#A855F7', '#10B981', '#F97316', '#EC4899'];
    for (let i = 0; i < 60; i++) {
        const el = document.createElement('div');
        const size = 4 + Math.random() * 6;
        el.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};left:50%;top:50%;pointer-events:none;z-index:50;`;
        container.appendChild(el);
        const angle = Math.random() * Math.PI * 2;
        const velocity = 150 + Math.random() * 250;
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity - 200;
        el.animate([
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 400}px)) scale(0) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], { duration: 1200 + Math.random() * 600, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
        setTimeout(() => el.remove(), 2000);
    }
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface SpinSegment {
    label: string;
    vcn: number;
    rp: number;
    color: string;
    glowColor: string;
    probability: number;
}

interface GamePlayRecord {
    score: number;
    vcn: number;
    rp: number;
    timestamp: string;
    game: 'spin' | 'block' | 'scratch';
}

interface DailyGameData {
    date: string;
    spinsUsed: number;
    blocksUsed: number;
    scratchCards: number;
    totalVCN: number;
    totalRP: number;
    games: GamePlayRecord[];
}

// ─── Default Constants (overridden by RPConfig) ────────────────────────────
const DEFAULT_DAILY_SPINS = 3;
const DEFAULT_DAILY_BLOCKS = 2;

const SPIN_SEGMENTS: SpinSegment[] = [
    { label: '0.1 VCN', vcn: 0.1, rp: 1, color: '#374151', glowColor: '#6B7280', probability: 0.25 },
    { label: '0.5 VCN', vcn: 0.5, rp: 2, color: '#1E40AF', glowColor: '#3B82F6', probability: 0.25 },
    { label: '1.0 VCN', vcn: 1.0, rp: 3, color: '#065F46', glowColor: '#10B981', probability: 0.20 },
    { label: '10 RP', vcn: 0, rp: 10, color: '#6D28D9', glowColor: '#A855F7', probability: 0.10 },
    { label: '2.0 VCN', vcn: 2.0, rp: 5, color: '#92400E', glowColor: '#F59E0B', probability: 0.10 },
    { label: '5.0 VCN', vcn: 5.0, rp: 10, color: '#B45309', glowColor: '#F97316', probability: 0.05 },
    { label: 'JACKPOT', vcn: 10, rp: 50, color: '#DC2626', glowColor: '#EF4444', probability: 0.03 },
    { label: 'MEGA', vcn: 25, rp: 100, color: '#0891B2', glowColor: '#22D3EE', probability: 0.02 },
];

// Weighted random selection
function pickSegment(): number {
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < SPIN_SEGMENTS.length; i++) {
        cumulative += SPIN_SEGMENTS[i].probability;
        if (r <= cumulative) return i;
    }
    return 0;
}

function getTodayStr(): string {
    return new Date().toISOString().split('T')[0];
}

// ─── SVG Icons ──────────────────────────────────────────────────────────────
const GameCenterIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
        <path d="M8 14l-2 4" stroke-dasharray="2 2" />
        <path d="M16 14l2 4" stroke-dasharray="2 2" />
    </svg>
);

const SpinWheelIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="4.93" x2="6.76" y2="6.76" />
        <line x1="17.24" y1="17.24" x2="19.07" y2="19.07" />
        <line x1="4.93" y1="19.07" x2="6.76" y2="17.24" />
        <line x1="17.24" y1="6.76" x2="19.07" y2="4.93" />
    </svg>
);

const BlockIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 12h16" opacity="0.3" />
        <path d="M12 4v16" opacity="0.3" />
        <path d="M7 7l2 2M15 7l2 2M7 15l2 2M15 15l2 2" stroke-width="2" />
    </svg>
);

const ScratchIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h10M7 13h6" stroke-dasharray="3 2" />
        <circle cx="17" cy="13" r="2" fill="currentColor" opacity="0.3" />
    </svg>
);

const VCNCoinIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none">
        <circle cx="12" cy="12" r="10" fill="#F59E0B" opacity="0.2" />
        <circle cx="12" cy="12" r="8" stroke="#F59E0B" stroke-width="1.5" />
        <text x="12" y="16" text-anchor="middle" fill="#F59E0B" font-size="10" font-weight="bold">V</text>
    </svg>
);

// ─── Main Component ─────────────────────────────────────────────────────────
export const VCNGameCenter = (props: GameCenterProps) => {
    const { t } = useI18n();
    let gameContainerRef: HTMLDivElement | undefined;

    // State
    const [activeGame, setActiveGame] = createSignal<'spin' | 'block' | 'scratch' | null>(null);
    const [dailyData, setDailyData] = createSignal<DailyGameData>({
        date: getTodayStr(),
        spinsUsed: 0,
        blocksUsed: 0,
        scratchCards: 0,
        totalVCN: 0,
        totalRP: 0,
        games: [],
    });
    const [isLoading, setIsLoading] = createSignal(true);
    const [showJackpotCeremony, setShowJackpotCeremony] = createSignal(false);
    const [jackpotSegment, setJackpotSegment] = createSignal<SpinSegment | null>(null);
    const [inviteCopied, setInviteCopied] = createSignal(false);

    // Lucky Spin state
    const [isSpinning, setIsSpinning] = createSignal(false);
    const [spinRotation, setSpinRotation] = createSignal(0);
    const [spinResult, setSpinResult] = createSignal<SpinSegment | null>(null);
    const [showResult, setShowResult] = createSignal(false);
    const [resultCountVCN, setResultCountVCN] = createSignal(0);
    const [resultCountRP, setResultCountRP] = createSignal(0);

    // Block Breaker state
    const [blockHP, setBlockHP] = createSignal(0);
    const [blockMaxHP, setBlockMaxHP] = createSignal(8);
    const [blockType, setBlockType] = createSignal<'bronze' | 'silver' | 'gold'>('bronze');
    const [blockCracks, setBlockCracks] = createSignal(0);
    const [blockBroken, setBlockBroken] = createSignal(false);
    const [blockShake, setBlockShake] = createSignal(false);
    const [blockParticles, setBlockParticles] = createSignal<{ x: number; y: number; id: number }[]>([]);
    const [blockReward, setBlockReward] = createSignal<{ vcn: number; rp: number } | null>(null);

    // RPConfig loaded values
    const [maxSpins, setMaxSpins] = createSignal(DEFAULT_DAILY_SPINS);
    const [maxBlocks, setMaxBlocks] = createSignal(DEFAULT_DAILY_BLOCKS);

    const spinsRemaining = createMemo(() => Math.max(0, maxSpins() - dailyData().spinsUsed));
    const blocksRemaining = createMemo(() => Math.max(0, maxBlocks() - dailyData().blocksUsed));

    // ─── Firestore persistence ──────────────────────────────────────
    const loadDailyData = async () => {
        try {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;
            if (!user?.email) return;

            const today = getTodayStr();
            const db = getFirebaseDb();
            const docRef = doc(db, 'mini_game_plays', `${today}_${user.email.toLowerCase()}`);
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                const d = snap.data() as DailyGameData;
                setDailyData(d);
            } else {
                setDailyData({
                    date: today,
                    spinsUsed: 0,
                    blocksUsed: 0,
                    scratchCards: 0,
                    totalVCN: 0,
                    totalRP: 0,
                    games: [],
                });
            }
        } catch (e) {
            console.error('[Game] Failed to load daily data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveDailyData = async (data: DailyGameData) => {
        try {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;
            if (!user?.email) return;

            const db = getFirebaseDb();
            const docRef = doc(db, 'mini_game_plays', `${data.date}_${user.email.toLowerCase()}`);
            await setDoc(docRef, data, { merge: true });
        } catch (e) {
            console.error('[Game] Failed to save daily data:', e);
        }
    };

    const awardRewards = async (vcn: number, rp: number, gameType: string) => {
        try {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;
            if (!user?.email) return;

            if (rp > 0) {
                await addRewardPoints(user.email, rp, 'mini_game', `VCN Game: ${gameType}`);
            }
            // VCN rewards tracked in Firestore for batch processing
        } catch (e) {
            console.error('[Game] Award failed:', e);
        }
    };

    const handleInviteFriend = async () => {
        const refCode = props.userProfile().referralCode || props.userProfile().email;
        const referralUrl = `https://visionchain.co/signup?ref=${refCode}`;
        const message = `[Vision Chain] Play mini-games and earn VCN & RP! Join me: ${referralUrl}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Vision Chain Game', text: message, url: referralUrl });
            } else {
                await navigator.clipboard.writeText(message);
            }
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 3000);
        } catch {
            await navigator.clipboard.writeText(message);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 3000);
        }
    };

    const allPlaysUsed = createMemo(() => spinsRemaining() <= 0 && blocksRemaining() <= 0);

    onMount(() => {
        loadDailyData();
        // Load RPConfig for game settings
        getRPConfig().then(cfg => {
            if (cfg.game_daily_spins) setMaxSpins(cfg.game_daily_spins);
            if (cfg.game_daily_blocks) setMaxBlocks(cfg.game_daily_blocks);
        }).catch(() => { });
    });

    // ─── Lucky Spin Logic ───────────────────────────────────────────
    const handleSpin = () => {
        if (isSpinning() || spinsRemaining() <= 0) return;

        setIsSpinning(true);
        setShowResult(false);
        setSpinResult(null);
        setShowJackpotCeremony(false);

        const winIndex = pickSegment();
        const segmentAngle = 360 / SPIN_SEGMENTS.length;
        const targetAngle = 360 - (winIndex * segmentAngle + segmentAngle / 2);
        const fullSpins = 5 + Math.floor(Math.random() * 3);
        const finalRotation = spinRotation() + fullSpins * 360 + targetAngle - (spinRotation() % 360);

        setSpinRotation(finalRotation);

        // Tick sound during spinning
        let tickCount = 0;
        const tickInterval = setInterval(() => {
            SFX.play('tick');
            tickCount++;
            if (tickCount > 30) clearInterval(tickInterval);
        }, 120);

        // After spin animation completes
        setTimeout(() => {
            clearInterval(tickInterval);
            const segment = SPIN_SEGMENTS[winIndex];
            setSpinResult(segment);
            setIsSpinning(false);

            // Play result sound
            const isJackpot = segment.vcn >= 10;
            if (isJackpot) {
                SFX.play('jackpot');
                setJackpotSegment(segment);
                setShowJackpotCeremony(true);
                if (gameContainerRef) launchConfetti(gameContainerRef);
                setTimeout(() => setShowJackpotCeremony(false), 4000);
            } else {
                SFX.play('win');
            }

            // Animate reward count-up
            const duration = 800;
            const startTime = Date.now();
            const animateCount = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1, elapsed / duration);
                const eased = 1 - Math.pow(1 - progress, 3);
                setResultCountVCN(segment.vcn * eased);
                setResultCountRP(Math.round(segment.rp * eased));
                if (progress < 1) requestAnimationFrame(animateCount);
            };
            animateCount();

            setShowResult(true);

            // Update daily data
            const prev = dailyData();
            const record: GamePlayRecord = {
                score: 0, vcn: segment.vcn, rp: segment.rp,
                timestamp: new Date().toISOString(), game: 'spin'
            };
            const updated: DailyGameData = {
                ...prev,
                spinsUsed: prev.spinsUsed + 1,
                totalVCN: prev.totalVCN + segment.vcn,
                totalRP: prev.totalRP + segment.rp,
                games: [...prev.games, record],
            };
            setDailyData(updated);
            saveDailyData(updated);
            awardRewards(segment.vcn, segment.rp, 'Lucky Spin');
        }, 4000);
    };

    // ─── Block Breaker Logic ────────────────────────────────────────
    const startBlock = () => {
        if (blocksRemaining() <= 0) return;
        const types = [
            { type: 'bronze' as const, hp: 6, prob: 0.6 },
            { type: 'silver' as const, hp: 8, prob: 0.3 },
            { type: 'gold' as const, hp: 10, prob: 0.1 },
        ];
        const r = Math.random();
        let cum = 0;
        let chosen = types[0];
        for (const t of types) {
            cum += t.prob;
            if (r <= cum) { chosen = t; break; }
        }
        setBlockType(chosen.type);
        setBlockMaxHP(chosen.hp);
        setBlockHP(chosen.hp);
        setBlockCracks(0);
        setBlockBroken(false);
        setBlockReward(null);
        setBlockParticles([]);
        setActiveGame('block');
    };

    const handleBlockTap = () => {
        if (blockBroken() || blockHP() <= 0) return;

        const newHP = blockHP() - 1;
        setBlockHP(newHP);
        setBlockCracks(prev => prev + 1);
        setBlockShake(true);
        SFX.play('tap');
        setTimeout(() => setBlockShake(false), 150);

        // Particle effect on tap
        const id = Date.now();
        const x = 50 + (Math.random() - 0.5) * 40;
        const y = 50 + (Math.random() - 0.5) * 40;
        setBlockParticles(prev => [...prev, { x, y, id }]);
        setTimeout(() => setBlockParticles(prev => prev.filter(p => p.id !== id)), 600);

        if (newHP <= 0) {
            // Block broken!
            setBlockBroken(true);
            SFX.play('break');
            const rewards = {
                bronze: { vcn: 0.3 + Math.random() * 0.5, rp: 3 },
                silver: { vcn: 1.0 + Math.random() * 1.5, rp: 7 },
                gold: { vcn: 3.0 + Math.random() * 4.0, rp: 15 },
            };
            const reward = { vcn: parseFloat(rewards[blockType()].vcn.toFixed(1)), rp: rewards[blockType()].rp };
            setBlockReward(reward);

            // Generate celebration particles
            const particles = Array.from({ length: 12 }, (_, i) => ({
                x: 50 + (Math.random() - 0.5) * 80,
                y: 50 + (Math.random() - 0.5) * 80,
                id: Date.now() + i,
            }));
            setBlockParticles(particles);

            // Save
            const prev = dailyData();
            const record: GamePlayRecord = {
                score: blockMaxHP(), vcn: reward.vcn, rp: reward.rp,
                timestamp: new Date().toISOString(), game: 'block'
            };
            const updated: DailyGameData = {
                ...prev,
                blocksUsed: prev.blocksUsed + 1,
                totalVCN: prev.totalVCN + reward.vcn,
                totalRP: prev.totalRP + reward.rp,
                games: [...prev.games, record],
            };
            setDailyData(updated);
            saveDailyData(updated);
            awardRewards(reward.vcn, reward.rp, 'Block Breaker');
        }
    };

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div ref={gameContainerRef} class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8 relative" style="-webkit-overflow-scrolling: touch;">
            <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <WalletViewHeader
                    tag="MINI GAME"
                    title="VCN Game"
                    titleAccent="Center"
                    description="Play daily mini-games to earn VCN and RP rewards. Invite friends for bonus plays!"
                    icon={GameCenterIcon}
                />

                {/* Today's Earnings Banner */}
                <div class="relative overflow-hidden rounded-2xl border border-white/[0.06]">
                    <div class="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-amber-500/10" />
                    <div class="relative p-5 flex items-center justify-between">
                        <div>
                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Today's Earnings</div>
                            <div class="flex items-center gap-4">
                                <div class="flex items-center gap-1.5">
                                    <VCNCoinIcon class="w-5 h-5" />
                                    <span class="text-xl font-black text-amber-400">{dailyData().totalVCN.toFixed(1)}</span>
                                    <span class="text-xs text-gray-500 font-bold">VCN</span>
                                </div>
                                <div class="w-px h-6 bg-white/10" />
                                <div class="flex items-center gap-1.5">
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-purple-400" fill="currentColor">
                                        <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                    </svg>
                                    <span class="text-xl font-black text-purple-400">{dailyData().totalRP}</span>
                                    <span class="text-xs text-gray-500 font-bold">RP</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-[10px] text-gray-600 font-bold">{dailyData().games.length} games today</div>
                        </div>
                    </div>
                </div>

                {/* Game Cards */}
                <Show when={activeGame() === null}>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Lucky Spin Card */}
                        <button
                            onClick={() => setActiveGame('spin')}
                            class="group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-cyan-500/30 transition-all duration-300 text-left"
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 group-hover:from-cyan-500/15 group-hover:to-blue-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <SpinWheelIcon class="w-7 h-7 text-cyan-400" />
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Lucky Spin</h3>
                                <p class="text-xs text-gray-500 mb-4">Spin the wheel for instant rewards</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${spinsRemaining() > 0 ? 'bg-cyan-500/15 text-cyan-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {spinsRemaining()}/{maxSpins()} left
                                    </span>
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-gray-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>

                        {/* Block Breaker Card */}
                        <button
                            onClick={startBlock}
                            class="group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-amber-500/30 transition-all duration-300 text-left"
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 group-hover:from-amber-500/15 group-hover:to-orange-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <BlockIcon class="w-7 h-7 text-amber-400" />
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Block Breaker</h3>
                                <p class="text-xs text-gray-500 mb-4">Mine VCN by breaking blocks</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${blocksRemaining() > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {blocksRemaining()}/{maxBlocks()} left
                                    </span>
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-gray-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>

                        {/* Scratch Card */}
                        <div class="group relative overflow-hidden rounded-2xl border border-white/[0.06] border-dashed opacity-60 text-left">
                            <div class="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-2xl flex items-center justify-center">
                                    <ScratchIcon class="w-7 h-7 text-purple-400" />
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Scratch Card</h3>
                                <p class="text-xs text-gray-500 mb-4">Invite a friend to unlock!</p>
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-400">
                                        Referral Only
                                    </span>
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* Invite Friend CTA -- shown when all plays exhausted */}
                <Show when={allPlaysUsed() && activeGame() === null}>
                    <div class="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10">
                        <div class="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-5" />
                        <div class="relative p-6 text-center">
                            <div class="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">No plays left today</div>
                            <h3 class="text-lg font-black text-white mb-2">Invite a friend for bonus plays!</h3>
                            <p class="text-xs text-gray-400 mb-5">Share your referral link and get extra game plays when they sign up</p>
                            <button
                                onClick={handleInviteFriend}
                                class="inline-flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-black rounded-2xl hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-95 transition-all"
                                style="touch-action: manipulation; -webkit-tap-highlight-color: transparent; min-height: 52px;"
                            >
                                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                                </svg>
                                {inviteCopied() ? 'Link Copied!' : 'Invite & Get Bonus Plays'}
                            </button>
                        </div>
                    </div>
                </Show>

                {/* ═══════════════════ JACKPOT CEREMONY OVERLAY ═══════════════════ */}
                <Show when={showJackpotCeremony() && jackpotSegment()}>
                    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-in fade-in duration-300" onClick={() => setShowJackpotCeremony(false)}>
                        <div class="relative text-center p-8 max-w-sm animate-in zoom-in-75 duration-500">
                            <div class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-red-400 to-amber-400 mb-4 animate-pulse">
                                {jackpotSegment()!.label === 'MEGA' ? 'MEGA WIN!' : 'JACKPOT!'}
                            </div>
                            <div class="flex items-center justify-center gap-4 mb-4">
                                <div class="flex items-center gap-2">
                                    <VCNCoinIcon class="w-10 h-10" />
                                    <span class="text-5xl font-black text-amber-400">+{jackpotSegment()!.vcn}</span>
                                    <span class="text-lg text-amber-400/70 font-bold">VCN</span>
                                </div>
                            </div>
                            <div class="flex items-center justify-center gap-2 mb-6">
                                <svg viewBox="0 0 24 24" class="w-6 h-6 text-purple-400" fill="currentColor"><polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" /></svg>
                                <span class="text-3xl font-black text-purple-400">+{jackpotSegment()!.rp}</span>
                                <span class="text-sm text-purple-400/70 font-bold">RP</span>
                            </div>
                            <div class="text-xs text-gray-500">Tap anywhere to close</div>
                        </div>
                    </div>
                </Show>

                {/* ═══════════════════════ LUCKY SPIN GAME ═══════════════════════ */}
                <Show when={activeGame() === 'spin'}>
                    <div class="space-y-6">
                        {/* Back button */}
                        <button onClick={() => { setActiveGame(null); setShowResult(false); setSpinResult(null); }} class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2" style="touch-action: manipulation;">
                            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                            Back to games
                        </button>

                        <div class="flex flex-col items-center">
                            {/* Spin Wheel - Mobile responsive sizing */}
                            <div class="relative w-[280px] h-[280px] sm:w-80 sm:h-80 mb-6 select-none" style="touch-action: none;">
                                {/* Pointer */}
                                <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
                                    <svg viewBox="0 0 30 20" class="w-8 h-6 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                                        <polygon points="15,20 0,0 30,0" fill="#EF4444" />
                                    </svg>
                                </div>

                                {/* Outer glow ring */}
                                <div class={`absolute inset-0 rounded-full ${isSpinning() ? 'animate-pulse' : ''}`}
                                    style={{ background: 'conic-gradient(from 0deg, rgba(34,211,238,0.2), rgba(168,85,247,0.2), rgba(245,158,11,0.2), rgba(34,211,238,0.2))', filter: 'blur(8px)' }}
                                />

                                {/* Wheel */}
                                <div
                                    class="absolute inset-2 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl"
                                    style={{
                                        transform: `rotate(${spinRotation()}deg)`,
                                        transition: isSpinning() ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                                    }}
                                >
                                    <svg viewBox="0 0 200 200" class="w-full h-full">
                                        <For each={SPIN_SEGMENTS}>
                                            {(seg, i) => {
                                                const angle = 360 / SPIN_SEGMENTS.length;
                                                const startAngle = i() * angle - 90;
                                                const endAngle = startAngle + angle;
                                                const startRad = (startAngle * Math.PI) / 180;
                                                const endRad = (endAngle * Math.PI) / 180;
                                                const x1 = 100 + 100 * Math.cos(startRad);
                                                const y1 = 100 + 100 * Math.sin(startRad);
                                                const x2 = 100 + 100 * Math.cos(endRad);
                                                const y2 = 100 + 100 * Math.sin(endRad);
                                                const largeArc = angle > 180 ? 1 : 0;
                                                const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
                                                const textX = 100 + 60 * Math.cos(midAngle);
                                                const textY = 100 + 60 * Math.sin(midAngle);
                                                const textRotation = (startAngle + endAngle) / 2 + 90;

                                                return (
                                                    <>
                                                        <path
                                                            d={`M100,100 L${x1},${y1} A100,100 0 ${largeArc},1 ${x2},${y2} Z`}
                                                            fill={seg.color}
                                                            stroke="rgba(255,255,255,0.1)"
                                                            stroke-width="0.5"
                                                        />
                                                        <text
                                                            x={textX}
                                                            y={textY}
                                                            text-anchor="middle"
                                                            dominant-baseline="middle"
                                                            fill="white"
                                                            font-size={seg.label === 'JACKPOT' || seg.label === 'MEGA' ? '7' : '8'}
                                                            font-weight="bold"
                                                            transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                                                        >
                                                            {seg.label}
                                                        </text>
                                                    </>
                                                );
                                            }}
                                        </For>
                                        {/* Center circle */}
                                        <circle cx="100" cy="100" r="18" fill="#111113" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
                                        <text x="100" y="103" text-anchor="middle" fill="white" font-size="8" font-weight="bold">VCN</text>
                                    </svg>
                                </div>
                            </div>

                            {/* Spin Button */}
                            <button
                                onClick={handleSpin}
                                disabled={isSpinning() || spinsRemaining() <= 0}
                                class={`w-full max-w-xs px-10 py-4 rounded-2xl text-lg font-black transition-all duration-300 select-none ${isSpinning() || spinsRemaining() <= 0
                                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:scale-105 active:scale-95'
                                    }`}
                                style="touch-action: manipulation; -webkit-tap-highlight-color: transparent; min-height: 56px;"
                            >
                                {isSpinning() ? 'Spinning...' : spinsRemaining() <= 0 ? 'No spins left today' : `SPIN! (${spinsRemaining()} left)`}
                            </button>

                            {/* Result Display */}
                            <Show when={showResult() && spinResult()}>
                                <div class="mt-6 p-6 bg-[#111113]/80 border border-white/[0.08] rounded-2xl text-center animate-in fade-in zoom-in-95 duration-500 w-full max-w-sm">
                                    <div class={`text-xs font-black uppercase tracking-widest mb-3 ${spinResult()!.vcn >= 10 ? 'text-red-400' : spinResult()!.vcn >= 5 ? 'text-amber-400' : 'text-cyan-400'}`}>
                                        {spinResult()!.vcn >= 10 ? 'JACKPOT!' : spinResult()!.vcn >= 5 ? 'GREAT!' : 'You Won!'}
                                    </div>
                                    <div class="flex items-center justify-center gap-6">
                                        <Show when={spinResult()!.vcn > 0}>
                                            <div class="flex items-center gap-2">
                                                <VCNCoinIcon class="w-8 h-8" />
                                                <span class="text-3xl font-black text-amber-400">+{resultCountVCN().toFixed(1)}</span>
                                                <span class="text-sm text-gray-500 font-bold">VCN</span>
                                            </div>
                                        </Show>
                                        <Show when={spinResult()!.rp > 0}>
                                            <div class="flex items-center gap-2">
                                                <svg viewBox="0 0 24 24" class="w-6 h-6 text-purple-400" fill="currentColor">
                                                    <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                                </svg>
                                                <span class="text-3xl font-black text-purple-400">+{resultCountRP()}</span>
                                                <span class="text-sm text-gray-500 font-bold">RP</span>
                                            </div>
                                        </Show>
                                    </div>
                                    <Show when={spinsRemaining() <= 0}>
                                        <button onClick={handleInviteFriend} class="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/15 text-emerald-400 font-bold text-sm rounded-xl hover:bg-emerald-500/25 active:scale-95 transition-all" style="touch-action: manipulation;">
                                            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                                            {inviteCopied() ? 'Link Copied!' : 'Invite Friend for Bonus'}
                                        </button>
                                    </Show>
                                </div>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* ═══════════════════════ BLOCK BREAKER GAME ═══════════════════════ */}
                <Show when={activeGame() === 'block'}>
                    <div class="space-y-6">
                        <button onClick={() => { setActiveGame(null); setBlockBroken(false); setBlockReward(null); }} class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2" style="touch-action: manipulation;">
                            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                            Back to games
                        </button>

                        <div class="flex flex-col items-center">
                            {/* Block type indicator */}
                            <div class="flex items-center gap-2 mb-4">
                                <span class={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg ${blockType() === 'gold' ? 'bg-amber-500/20 text-amber-400' : blockType() === 'silver' ? 'bg-gray-300/20 text-gray-300' : 'bg-orange-800/20 text-orange-400'}`}>
                                    {blockType()} block
                                </span>
                            </div>

                            {/* HP Bar */}
                            <div class="w-64 mb-6">
                                <div class="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                    <span>HP</span>
                                    <span>{blockHP()}/{blockMaxHP()}</span>
                                </div>
                                <div class="h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/[0.06]">
                                    <div
                                        class={`h-full transition-all duration-200 rounded-full ${blockHP() / blockMaxHP() > 0.5 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : blockHP() / blockMaxHP() > 0.25 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-red-500 to-rose-400'}`}
                                        style={{ width: `${(blockHP() / blockMaxHP()) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Block - Larger tap area for mobile */}
                            <div class="relative w-56 h-56 sm:w-48 sm:h-48 mb-6 select-none">
                                {/* Particles */}
                                <For each={blockParticles()}>
                                    {(p) => (
                                        <div
                                            class="absolute w-2 h-2 rounded-full animate-ping"
                                            style={{
                                                left: `${p.x}%`,
                                                top: `${p.y}%`,
                                                background: blockType() === 'gold' ? '#F59E0B' : blockType() === 'silver' ? '#D1D5DB' : '#C2410C',
                                                'animation-duration': '0.6s',
                                            }}
                                        />
                                    )}
                                </For>

                                <button
                                    onClick={handleBlockTap}
                                    disabled={blockBroken()}
                                    class={`w-full h-full rounded-3xl flex items-center justify-center transition-all duration-100 cursor-pointer active:scale-95 relative overflow-hidden select-none ${blockBroken()
                                        ? 'bg-transparent scale-75 opacity-0'
                                        : blockType() === 'gold'
                                            ? 'bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-amber-400/50 shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_40px_rgba(245,158,11,0.5)]'
                                            : blockType() === 'silver'
                                                ? 'bg-gradient-to-br from-gray-300 to-gray-500 border-2 border-gray-300/50 shadow-[0_0_30px_rgba(156,163,175,0.3)] hover:shadow-[0_0_40px_rgba(156,163,175,0.5)]'
                                                : 'bg-gradient-to-br from-orange-700 to-orange-900 border-2 border-orange-600/50 shadow-[0_0_30px_rgba(234,88,12,0.2)] hover:shadow-[0_0_40px_rgba(234,88,12,0.4)]'
                                        }`}
                                    style={{ 'touch-action': 'manipulation', '-webkit-tap-highlight-color': 'transparent', transform: blockShake() ? `translate(${Math.random() > 0.5 ? 3 : -3}px, ${Math.random() > 0.5 ? 2 : -2}px)` : '' }}
                                >
                                    {/* Crack lines */}
                                    <Show when={!blockBroken()}>
                                        <svg viewBox="0 0 100 100" class="w-full h-full absolute inset-0" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="1.5">
                                            <Show when={blockCracks() >= 2}>
                                                <path d="M50 20 L45 40 L55 50 L48 65" />
                                            </Show>
                                            <Show when={blockCracks() >= 4}>
                                                <path d="M30 50 L45 48 L55 55 L70 45" />
                                            </Show>
                                            <Show when={blockCracks() >= 6}>
                                                <path d="M40 80 L50 60 L60 70 L55 35 L65 25" />
                                                <path d="M25 35 L40 45 L50 40" />
                                            </Show>
                                        </svg>
                                        <div class="relative z-10">
                                            <BlockIcon class="w-16 h-16 text-white/80" />
                                            <div class="text-xs font-black text-white/60 mt-1">TAP!</div>
                                        </div>
                                    </Show>
                                </button>
                            </div>

                            {/* Block Result */}
                            <Show when={blockBroken() && blockReward()}>
                                <div class="p-6 bg-[#111113]/80 border border-white/[0.08] rounded-2xl text-center animate-in fade-in zoom-in-95 duration-500 w-full max-w-sm">
                                    <div class={`text-xs font-black uppercase tracking-widest mb-3 ${blockType() === 'gold' ? 'text-amber-400' : blockType() === 'silver' ? 'text-gray-300' : 'text-orange-400'}`}>
                                        {blockType() === 'gold' ? 'GOLD BLOCK MINED!' : blockType() === 'silver' ? 'SILVER BLOCK MINED!' : 'BLOCK MINED!'}
                                    </div>
                                    <div class="flex items-center justify-center gap-6">
                                        <div class="flex items-center gap-2">
                                            <VCNCoinIcon class="w-8 h-8" />
                                            <span class="text-3xl font-black text-amber-400">+{blockReward()!.vcn}</span>
                                            <span class="text-sm text-gray-500 font-bold">VCN</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <svg viewBox="0 0 24 24" class="w-6 h-6 text-purple-400" fill="currentColor">
                                                <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                            </svg>
                                            <span class="text-3xl font-black text-purple-400">+{blockReward()!.rp}</span>
                                            <span class="text-sm text-gray-500 font-bold">RP</span>
                                        </div>
                                    </div>
                                    <button onClick={startBlock} disabled={blocksRemaining() <= 0}
                                        class={`mt-4 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${blocksRemaining() > 0 ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>
                                        {blocksRemaining() > 0 ? `Mine Again (${blocksRemaining()} left)` : 'No blocks left today'}
                                    </button>
                                </div>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* Game History */}
                <Show when={dailyData().games.length > 0 && activeGame() === null}>
                    <div class="bg-[#111113]/60 rounded-2xl border border-white/[0.04] overflow-hidden">
                        <div class="flex items-center justify-between p-4 border-b border-white/[0.04]">
                            <h4 class="text-xs font-black text-gray-500 uppercase tracking-widest">Today's Play History</h4>
                            <span class="text-[10px] text-gray-600">{dailyData().games.length} plays</span>
                        </div>
                        <div class="divide-y divide-white/[0.02]">
                            <For each={dailyData().games.slice().reverse()}>
                                {(g) => (
                                    <div class="flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors">
                                        <div class={`w-8 h-8 rounded-lg flex items-center justify-center ${g.game === 'spin' ? 'bg-cyan-500/15' : g.game === 'block' ? 'bg-amber-500/15' : 'bg-purple-500/15'}`}>
                                            {g.game === 'spin' && <SpinWheelIcon class="w-4 h-4 text-cyan-400" />}
                                            {g.game === 'block' && <BlockIcon class="w-4 h-4 text-amber-400" />}
                                            {g.game === 'scratch' && <ScratchIcon class="w-4 h-4 text-purple-400" />}
                                        </div>
                                        <div class="flex-1">
                                            <span class="text-xs font-bold text-white capitalize">{g.game === 'spin' ? 'Lucky Spin' : g.game === 'block' ? 'Block Breaker' : 'Scratch Card'}</span>
                                            <div class="text-[10px] text-gray-600">{new Date(g.timestamp).toLocaleTimeString()}</div>
                                        </div>
                                        <div class="text-right">
                                            <Show when={g.vcn > 0}>
                                                <div class="text-xs font-bold text-amber-400">+{g.vcn.toFixed(1)} VCN</div>
                                            </Show>
                                            <div class="text-[10px] text-purple-400/70">+{g.rp} RP</div>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>

            </div>
        </div>
    );
};

export default VCNGameCenter;
