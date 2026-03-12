import { createSignal, Show, For, onMount, createMemo, onCleanup, Accessor } from 'solid-js';
import type { JSX } from 'solid-js';
import { WalletViewHeader } from './WalletViewHeader';
import { MemoryMatchGame } from './MemoryMatchGame';
import { FallingCoinsGame } from './FallingCoinsGame';
import { PricePredictGame } from './PricePredictGame';
import { DiceBetGame } from './DiceBetGame';
import { TowerClimbGame } from './TowerClimbGame';
import { MineSweeperGame } from './MineSweeperGame';
import { FlappyVCNGame } from './FlappyVCNGame';
import { CryptoSlotsGame } from './CryptoSlotsGame';
import { CrashGame } from './CrashGame';
import { useI18n } from '../../i18n/i18nContext';
import { addRewardPoints, getRPConfig, getFirebaseAuth } from '../../services/firebaseService';
import { getFirebaseDb } from '../../services/firebaseService';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, increment as firestoreIncrement, arrayRemove } from 'firebase/firestore';

// ─── Props ──────────────────────────────────────────────────────────────────
interface GameCenterProps {
    userProfile: Accessor<{ referralCode: string; email: string; referralCount?: number;[k: string]: any }>;
    onNavigate?: (view: string) => void;
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
    game: 'spin' | 'block' | 'scratch' | 'memory' | 'falling' | 'predict' | 'tower' | 'mine' | 'flappy' | 'slots' | 'crash';
}

interface DailyGameData {
    date: string;
    spinsUsed: number;
    blocksUsed: number;
    scratchCards: number;
    memoryUsed: number;
    fallingUsed: number;
    predictUsed: number;
    towerUsed: number;
    mineUsed: number;
    flappyUsed: number;
    slotsUsed: number;
    crashUsed: number;
    totalVCN: number;
    totalRP: number;
    bestBlockTime: number;
    bestMemoryTime: number;
    bestFallingScore: number;
    bestPredictStreak: number;
    bestTowerFloor: number;
    bestMineReveals: number;
    bestFlappyScore: number;
    games: GamePlayRecord[];
}

// ─── Default Constants (overridden by RPConfig) ────────────────────────────
const DEFAULT_DAILY_SPINS = 3;
const DEFAULT_DAILY_BLOCKS = 2;
const DEFAULT_DAILY_SCRATCH = 3;
const DEFAULT_DAILY_MEMORY = 3;
const DEFAULT_DAILY_FALLING = 3;
const DEFAULT_DAILY_PREDICT = 3;
const DEFAULT_DAILY_TOWER = 3;
const DEFAULT_DAILY_MINE = 3;
const DEFAULT_DAILY_FLAPPY = 3;
const DEFAULT_DAILY_SLOTS = 5;
const DEFAULT_DAILY_CRASH = 3;

// Scratch Card reward tiers
interface ScratchReward {
    label: string;
    vcn: number;
    rp: number;
    tier: 'common' | 'rare' | 'epic' | 'legendary';
    probability: number;
}
const SCRATCH_REWARDS: ScratchReward[] = [
    { label: '0.1 VCN', vcn: 0.1, rp: 2, tier: 'common', probability: 0.35 },
    { label: '0.5 VCN', vcn: 0.5, rp: 3, tier: 'common', probability: 0.25 },
    { label: '1.0 VCN', vcn: 1.0, rp: 5, tier: 'rare', probability: 0.18 },
    { label: '2.0 VCN', vcn: 2.0, rp: 8, tier: 'rare', probability: 0.10 },
    { label: '5.0 VCN', vcn: 5.0, rp: 15, tier: 'epic', probability: 0.07 },
    { label: '10 VCN', vcn: 10.0, rp: 30, tier: 'epic', probability: 0.03 },
    { label: 'JACKPOT', vcn: 25.0, rp: 50, tier: 'legendary', probability: 0.02 },
];
function pickScratchReward(): ScratchReward {
    const r = Math.random();
    let cum = 0;
    for (const reward of SCRATCH_REWARDS) {
        cum += reward.probability;
        if (r <= cum) return reward;
    }
    return SCRATCH_REWARDS[0];
}

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

// Heart Button Component for game cards
const HeartBtn = (p: { gameName: string; hearts: Record<string, number>; hearted: Set<string>; onToggle: (n: string) => void }) => (
    <button
        onClick={(e) => { e.stopPropagation(); p.onToggle(p.gameName); }}
        class="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] transition-all z-10"
        style="touch-action: manipulation;"
    >
        <svg viewBox="0 0 24 24" class={`w-3.5 h-3.5 transition-all ${p.hearted.has(p.gameName) ? 'text-red-400 scale-110' : 'text-gray-600'}`}
            fill={p.hearted.has(p.gameName) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span class={`text-[10px] font-bold tabular-nums ${p.hearted.has(p.gameName) ? 'text-red-400' : 'text-gray-600'}`}>
            {p.hearts[p.gameName] || 0}
        </span>
    </button>
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
    const [activeGame, setActiveGame] = createSignal<'spin' | 'block' | 'scratch' | 'memory' | 'falling' | 'predict' | 'tower' | 'mine' | 'flappy' | 'slots' | 'crash' | null>(null);
    const [dailyData, setDailyData] = createSignal<DailyGameData>({
        date: getTodayStr(),
        spinsUsed: 0,
        blocksUsed: 0,
        scratchCards: 0,
        memoryUsed: 0,
        fallingUsed: 0,
        predictUsed: 0,
        towerUsed: 0,
        mineUsed: 0,
        flappyUsed: 0,
        slotsUsed: 0,
        crashUsed: 0,
        totalVCN: 0,
        totalRP: 0,
        bestBlockTime: 0,
        bestMemoryTime: 0,
        bestFallingScore: 0,
        bestPredictStreak: 0,
        bestTowerFloor: 0,
        bestMineReveals: 0,
        bestFlappyScore: 0,
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
    const [blockMaxHP, setBlockMaxHP] = createSignal(50);
    const [blockType, setBlockType] = createSignal<'bronze' | 'silver' | 'gold'>('bronze');
    const [blockCracks, setBlockCracks] = createSignal(0);
    const [blockBroken, setBlockBroken] = createSignal(false);
    const [blockShake, setBlockShake] = createSignal(false);
    const [blockParticles, setBlockParticles] = createSignal<{ x: number; y: number; id: number }[]>([]);
    const [blockReward, setBlockReward] = createSignal<{ vcn: number; rp: number } | null>(null);
    const [blockStartTime, setBlockStartTime] = createSignal(0);
    const [blockElapsed, setBlockElapsed] = createSignal(0);
    const [bestTime, setBestTime] = createSignal(0);
    const [isNewRecord, setIsNewRecord] = createSignal(false);
    const [combo, setCombo] = createSignal(0);
    const [lastTapTime, setLastTapTime] = createSignal(0);

    // Dice Bet state
    const [diceBetPending, setDiceBetPending] = createSignal<{ rpAmount: number; gameName: string } | null>(null);

    // Scratch Card state
    const [scratchReward, setScratchReward] = createSignal<ScratchReward | null>(null);
    const [scratchRevealed, setScratchRevealed] = createSignal(false);
    const [scratchProgress, setScratchProgress] = createSignal(0);
    let scratchCanvasRef: HTMLCanvasElement | undefined;
    let scratchCtx: CanvasRenderingContext2D | null = null;
    let isScratchingRef = false;

    // RPConfig loaded values
    const [maxSpins, setMaxSpins] = createSignal(DEFAULT_DAILY_SPINS);
    const [maxBlocks, setMaxBlocks] = createSignal(DEFAULT_DAILY_BLOCKS);
    const [maxScratch, setMaxScratch] = createSignal(DEFAULT_DAILY_SCRATCH);
    const [maxMemory, setMaxMemory] = createSignal(DEFAULT_DAILY_MEMORY);
    const [maxFalling, setMaxFalling] = createSignal(DEFAULT_DAILY_FALLING);
    const [maxPredict, setMaxPredict] = createSignal(DEFAULT_DAILY_PREDICT);
    const [maxTower, setMaxTower] = createSignal(DEFAULT_DAILY_TOWER);
    const [maxMine, setMaxMine] = createSignal(DEFAULT_DAILY_MINE);
    const [maxFlappy, setMaxFlappy] = createSignal(DEFAULT_DAILY_FLAPPY);
    const [maxSlots, setMaxSlots] = createSignal(DEFAULT_DAILY_SLOTS);
    const [maxCrash, setMaxCrash] = createSignal(DEFAULT_DAILY_CRASH);

    const spinsRemaining = createMemo(() => Math.max(0, maxSpins() - dailyData().spinsUsed));
    const blocksRemaining = createMemo(() => Math.max(0, maxBlocks() - dailyData().blocksUsed));
    const scratchRemaining = createMemo(() => Math.max(0, maxScratch() - dailyData().scratchCards));
    const memoryRemaining = createMemo(() => Math.max(0, maxMemory() - dailyData().memoryUsed));
    const fallingRemaining = createMemo(() => Math.max(0, maxFalling() - dailyData().fallingUsed));
    const predictRemaining = createMemo(() => Math.max(0, maxPredict() - dailyData().predictUsed));
    const towerRemaining = createMemo(() => Math.max(0, maxTower() - dailyData().towerUsed));
    const mineRemaining = createMemo(() => Math.max(0, maxMine() - dailyData().mineUsed));
    const flappyRemaining = createMemo(() => Math.max(0, maxFlappy() - dailyData().flappyUsed));
    const slotsRemaining = createMemo(() => Math.max(0, maxSlots() - dailyData().slotsUsed));
    const crashRemaining = createMemo(() => Math.max(0, maxCrash() - dailyData().crashUsed));

    // Heart system
    const [gameHearts, setGameHearts] = createSignal<Record<string, number>>({});
    const [userHearted, setUserHearted] = createSignal<Set<string>>(new Set());

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
                if (!d.bestBlockTime) d.bestBlockTime = 0;
                if (!d.memoryUsed) d.memoryUsed = 0;
                if (!d.bestMemoryTime) d.bestMemoryTime = 0;
                if (!d.fallingUsed) d.fallingUsed = 0;
                if (!d.bestFallingScore) d.bestFallingScore = 0;
                if (!d.predictUsed) d.predictUsed = 0;
                if (!d.bestPredictStreak) d.bestPredictStreak = 0;
                if (!d.towerUsed) d.towerUsed = 0;
                if (!d.mineUsed) d.mineUsed = 0;
                if (!d.flappyUsed) d.flappyUsed = 0;
                if (!d.slotsUsed) d.slotsUsed = 0;
                if (!d.crashUsed) d.crashUsed = 0;
                if (!d.bestTowerFloor) d.bestTowerFloor = 0;
                if (!d.bestMineReveals) d.bestMineReveals = 0;
                if (!d.bestFlappyScore) d.bestFlappyScore = 0;
                setDailyData(d);
                if (d.bestBlockTime > 0) setBestTime(d.bestBlockTime);
            } else {
                setDailyData({
                    date: today,
                    spinsUsed: 0,
                    blocksUsed: 0,
                    scratchCards: 0,
                    memoryUsed: 0,
                    fallingUsed: 0,
                    predictUsed: 0,
                    towerUsed: 0,
                    mineUsed: 0,
                    flappyUsed: 0,
                    slotsUsed: 0,
                    crashUsed: 0,
                    totalVCN: 0,
                    totalRP: 0,
                    bestBlockTime: 0,
                    bestMemoryTime: 0,
                    bestFallingScore: 0,
                    bestPredictStreak: 0,
                    bestTowerFloor: 0,
                    bestMineReveals: 0,
                    bestFlappyScore: 0,
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

    const allPlaysUsed = createMemo(() => spinsRemaining() <= 0 && blocksRemaining() <= 0 && scratchRemaining() <= 0 && memoryRemaining() <= 0 && fallingRemaining() <= 0 && predictRemaining() <= 0 && towerRemaining() <= 0 && mineRemaining() <= 0 && flappyRemaining() <= 0 && slotsRemaining() <= 0 && crashRemaining() <= 0);

    // Fullscreen immersive mode for ALL games
    const isFullscreenGame = createMemo(() => {
        return activeGame() !== null;
    });

    onMount(() => {
        loadDailyData();
        // Load RPConfig for game settings
        getRPConfig().then(cfg => {
            if (cfg.game_daily_spins) setMaxSpins(cfg.game_daily_spins);
            if (cfg.game_daily_blocks) setMaxBlocks(cfg.game_daily_blocks);
            if (cfg.game_daily_scratch) setMaxScratch(cfg.game_daily_scratch as number);
            if (cfg.game_daily_memory) setMaxMemory(cfg.game_daily_memory);
            if (cfg.game_daily_falling) setMaxFalling(cfg.game_daily_falling);
            if (cfg.game_daily_predict) setMaxPredict(cfg.game_daily_predict);
            if (cfg.game_daily_tower) setMaxTower(cfg.game_daily_tower);
            if (cfg.game_daily_mine) setMaxMine(cfg.game_daily_mine);
            if (cfg.game_daily_flappy) setMaxFlappy(cfg.game_daily_flappy);
            if (cfg.game_daily_slots) setMaxSlots(cfg.game_daily_slots);
            if (cfg.game_daily_crash) setMaxCrash(cfg.game_daily_crash);
        }).catch(() => { });
        loadGameHearts();
    });

    // ─── Heart System ───────────────────────────────────────────────
    const loadGameHearts = async () => {
        try {
            const db = getFirebaseDb();
            const heartsRef = doc(db, 'game_hearts', 'global');
            const snap = await getDoc(heartsRef);
            if (snap.exists()) {
                const data = snap.data();
                const counts: Record<string, number> = {};
                Object.keys(data.games || {}).forEach(k => {
                    counts[k] = data.games[k]?.count || 0;
                });
                setGameHearts(counts);
            }
            // Load user's hearts
            const auth = getFirebaseAuth();
            const user = auth.currentUser;
            if (user?.email) {
                const userHeartsRef = doc(db, 'game_hearts_users', user.email.toLowerCase());
                const userSnap = await getDoc(userHeartsRef);
                if (userSnap.exists()) {
                    setUserHearted(new Set<string>((userSnap.data().games || []) as string[]));
                }
            }
        } catch (e) {
            console.error('[Hearts] Failed to load:', e);
        }
    };

    const toggleGameHeart = async (gameName: string) => {
        try {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;
            if (!user?.email) return;

            const db = getFirebaseDb();
            const email = user.email.toLowerCase();
            const hearted = userHearted();
            const isHearted = hearted.has(gameName);

            // Update global count
            const heartsRef = doc(db, 'game_hearts', 'global');
            const snap = await getDoc(heartsRef);
            if (snap.exists()) {
                await updateDoc(heartsRef, {
                    [`games.${gameName}.count`]: firestoreIncrement(isHearted ? -1 : 1),
                });
            } else {
                await setDoc(heartsRef, {
                    games: { [gameName]: { count: 1 } },
                });
            }

            // Update user's hearts
            const userHeartsRef = doc(db, 'game_hearts_users', email);
            const userSnap = await getDoc(userHeartsRef);
            if (userSnap.exists()) {
                if (isHearted) {
                    await updateDoc(userHeartsRef, { games: arrayRemove(gameName) });
                } else {
                    await updateDoc(userHeartsRef, { games: arrayUnion(gameName) });
                }
            } else {
                await setDoc(userHeartsRef, { games: [gameName] });
            }

            // Update local state
            const newHearted = new Set(hearted);
            if (isHearted) {
                newHearted.delete(gameName);
                setGameHearts(prev => ({ ...prev, [gameName]: Math.max(0, (prev[gameName] || 0) - 1) }));
            } else {
                newHearted.add(gameName);
                setGameHearts(prev => ({ ...prev, [gameName]: (prev[gameName] || 0) + 1 }));
            }
            setUserHearted(newHearted);
        } catch (e) {
            console.error('[Hearts] Toggle failed:', e);
        }
    };

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
            // Trigger dice bet for RP (VCN is awarded immediately)
            awardRewards(segment.vcn, 0, 'Lucky Spin');
            if (segment.rp > 0) {
                setDiceBetPending({ rpAmount: segment.rp, gameName: 'Lucky Spin' });
            }
        }, 4000);
    };

    // ─── Block Breaker Logic ────────────────────────────────────────
    const startBlock = () => {
        if (blocksRemaining() <= 0) return;
        const types = [
            { type: 'bronze' as const, hp: 40, prob: 0.6 },
            { type: 'silver' as const, hp: 50, prob: 0.3 },
            { type: 'gold' as const, hp: 60, prob: 0.1 },
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
        setBlockStartTime(Date.now());
        setBlockElapsed(0);
        setIsNewRecord(false);
        setCombo(0);
        setLastTapTime(0);
        setActiveGame('block');
    };

    const handleBlockTap = () => {
        if (blockBroken() || blockHP() <= 0) return;

        const now = Date.now();
        // Combo: taps within 300ms count as combo
        if (lastTapTime() > 0 && now - lastTapTime() < 300) {
            setCombo(prev => Math.min(prev + 1, 20));
        } else {
            setCombo(0);
        }
        setLastTapTime(now);

        // Damage: 1 base + combo bonus every 5 combo
        const damage = 1 + Math.floor(combo() / 5);
        const newHP = Math.max(0, blockHP() - damage);
        setBlockHP(newHP);
        setBlockCracks(prev => prev + damage);
        setBlockShake(true);

        // Sound with rising pitch as HP decreases
        const progress = 1 - (newHP / blockMaxHP());
        try {
            const ctx = SFX._getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 150 + progress * 400 + combo() * 10;
            osc.type = combo() >= 5 ? 'triangle' : 'square';
            const t = ctx.currentTime;
            gain.gain.setValueAtTime(0.06 + combo() * 0.005, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc.start(t); osc.stop(t + 0.06);
        } catch { }

        // Haptic feedback on mobile
        try { navigator.vibrate?.(combo() >= 5 ? [15, 5, 15] : [10]); } catch { }

        setTimeout(() => setBlockShake(false), 80);

        // Particle effect
        const id = now + Math.random();
        const x = 50 + (Math.random() - 0.5) * 40;
        const y = 50 + (Math.random() - 0.5) * 40;
        setBlockParticles(prev => [...prev, { x, y, id }]);
        setTimeout(() => setBlockParticles(prev => prev.filter(p => p.id !== id)), 600);

        if (newHP <= 0) {
            // Block broken!
            setBlockBroken(true);
            SFX.play('break');
            try { navigator.vibrate?.([30, 20, 50]); } catch { }

            const elapsed = (Date.now() - blockStartTime()) / 1000;
            setBlockElapsed(elapsed);

            // Check daily best time
            let recordBonus = false;
            if (bestTime() === 0 || elapsed < bestTime()) {
                setBestTime(elapsed);
                setIsNewRecord(true);
                recordBonus = true;
            }

            const rewards = {
                bronze: { vcn: 0.5 + Math.random() * 0.5, rp: 5 },
                silver: { vcn: 1.5 + Math.random() * 1.5, rp: 10 },
                gold: { vcn: 4.0 + Math.random() * 4.0, rp: 20 },
            };
            let reward = { vcn: parseFloat(rewards[blockType()].vcn.toFixed(1)), rp: rewards[blockType()].rp };
            // 10% bonus for new record
            if (recordBonus) {
                reward = { vcn: parseFloat((reward.vcn * 1.1).toFixed(1)), rp: Math.round(reward.rp * 1.1) };
            }
            setBlockReward(reward);

            // Generate celebration particles
            const particles = Array.from({ length: 20 }, (_, i) => ({
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
            const newBest = recordBonus ? elapsed : prev.bestBlockTime;
            const updated: DailyGameData = {
                ...prev,
                blocksUsed: prev.blocksUsed + 1,
                totalVCN: prev.totalVCN + reward.vcn,
                totalRP: prev.totalRP + reward.rp,
                bestBlockTime: newBest || elapsed,
                games: [...prev.games, record],
            };
            setDailyData(updated);
            saveDailyData(updated);
            // Trigger dice bet for RP (VCN is awarded immediately)
            awardRewards(reward.vcn, 0, 'Block Breaker');
            if (reward.rp > 0) {
                setDiceBetPending({ rpAmount: reward.rp, gameName: 'Block Breaker' });
            }
        }
    };

    // ─── Scratch Card Logic ─────────────────────────────────────────
    const startScratch = () => {
        if (scratchRemaining() <= 0) return;
        const reward = pickScratchReward();
        setScratchReward(reward);
        setScratchRevealed(false);
        setScratchProgress(0);
        isScratchingRef = false;
        setActiveGame('scratch');

        // Initialize canvas after render
        setTimeout(() => {
            if (!scratchCanvasRef) return;
            const canvas = scratchCanvasRef;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            scratchCtx = ctx;

            // Set canvas resolution
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * 2;
            canvas.height = rect.height * 2;
            ctx.scale(2, 2);

            // Draw scratch coating
            const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
            gradient.addColorStop(0, '#6D28D9');
            gradient.addColorStop(0.5, '#A855F7');
            gradient.addColorStop(1, '#EC4899');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, rect.width, rect.height);

            // Add shimmer pattern
            ctx.globalAlpha = 0.15;
            for (let i = 0; i < 20; i++) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(
                    Math.random() * rect.width,
                    Math.random() * rect.height,
                    2 + Math.random() * 6,
                    0, Math.PI * 2
                );
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Add "SCRATCH HERE" text
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `bold ${rect.width * 0.08}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SCRATCH HERE', rect.width / 2, rect.height / 2);
        }, 50);
    };

    const handleScratchMove = (clientX: number, clientY: number) => {
        if (!scratchCanvasRef || !scratchCtx || scratchRevealed()) return;
        const rect = scratchCanvasRef.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        scratchCtx.globalCompositeOperation = 'destination-out';
        scratchCtx.beginPath();
        scratchCtx.arc(x, y, 20, 0, Math.PI * 2);
        scratchCtx.fill();

        // Calculate scratch progress
        const imageData = scratchCtx.getImageData(0, 0, scratchCanvasRef.width, scratchCanvasRef.height);
        let cleared = 0;
        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] === 0) cleared++;
        }
        const progress = cleared / (imageData.data.length / 4);
        setScratchProgress(progress);

        // Auto-reveal at 60%
        if (progress >= 0.6 && !scratchRevealed()) {
            revealScratchCard();
        }
    };

    const revealScratchCard = () => {
        if (scratchRevealed()) return;
        setScratchRevealed(true);

        const reward = scratchReward();
        if (!reward) return;

        // Clear canvas with animation
        if (scratchCanvasRef && scratchCtx) {
            scratchCtx.globalCompositeOperation = 'destination-out';
            const rect = scratchCanvasRef.getBoundingClientRect();
            scratchCtx.fillStyle = '#000';
            scratchCtx.fillRect(0, 0, rect.width, rect.height);
        }

        // Play sound
        if (reward.tier === 'legendary') {
            SFX.play('jackpot');
            if (gameContainerRef) launchConfetti(gameContainerRef);
        } else if (reward.tier === 'epic') {
            SFX.play('jackpot');
        } else {
            SFX.play('win');
        }

        // Save game data
        const prev = dailyData();
        const record: GamePlayRecord = {
            score: 0, vcn: reward.vcn, rp: reward.rp,
            timestamp: new Date().toISOString(), game: 'scratch'
        };
        const updated: DailyGameData = {
            ...prev,
            scratchCards: prev.scratchCards + 1,
            totalVCN: prev.totalVCN + reward.vcn,
            totalRP: prev.totalRP + reward.rp,
            games: [...prev.games, record],
        };
        setDailyData(updated);
        saveDailyData(updated);
        // Trigger dice bet for RP (VCN is awarded immediately)
        awardRewards(reward.vcn, 0, `Scratch Card (${reward.tier})`);
        if (reward.rp > 0) {
            setDiceBetPending({ rpAmount: reward.rp, gameName: `Scratch Card (${reward.tier})` });
        }
    };

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div ref={gameContainerRef}
            class={isFullscreenGame()
                ? 'fixed inset-0 z-40 bg-[#09090b] flex flex-col overflow-hidden'
                : 'p-4 lg:p-8 pb-32 relative'
            }
            style={isFullscreenGame() ? 'touch-action: none;' : ''}
        >
            <div class={isFullscreenGame()
                ? 'flex-1 flex flex-col min-h-0'
                : 'max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700'
            }>

                {/* Header */}
                <WalletViewHeader
                    tag="MINI GAME"
                    title="Game"
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

                {/* Daily Leaderboard Banner */}
                <Show when={activeGame() === null}>
                    <button
                        onClick={() => props.onNavigate?.('quest/game_daily')}
                        class="group w-full relative overflow-hidden rounded-2xl border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 text-left"
                    >
                        <div class="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/8 to-amber-500/5 group-hover:from-amber-500/10 group-hover:via-orange-500/15 group-hover:to-amber-500/10 transition-all duration-500" />
                        <div class="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all" />
                        <div class="relative p-4 sm:p-5 flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 24 24" class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                                        <path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" />
                                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                    </svg>
                                </div>
                                <div>
                                    <div class="text-sm sm:text-base font-black text-white uppercase italic tracking-tight">Daily Game Leaderboard</div>
                                    <div class="text-[10px] sm:text-xs text-gray-500 font-medium">See how you rank among today's players</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-amber-400" fill="currentColor"><polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" /></svg>
                                    <span class="text-[10px] font-black text-amber-400 uppercase tracking-widest">Live</span>
                                </div>
                                <svg viewBox="0 0 24 24" class="w-5 h-5 text-gray-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </button>
                </Show>

                {/* Game Cards */}
                <Show when={activeGame() === null}>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                                    <HeartBtn gameName="spin" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
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
                                    <HeartBtn gameName="block" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>

                        {/* Scratch Card */}
                        <button
                            onClick={() => scratchRemaining() > 0 && startScratch()}
                            class={`group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-purple-500/30 transition-all duration-300 text-left ${scratchRemaining() <= 0 ? 'opacity-60' : ''}`}
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                            disabled={scratchRemaining() <= 0}
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 group-hover:from-purple-500/15 group-hover:to-pink-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <ScratchIcon class="w-7 h-7 text-purple-400" />
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Scratch Card</h3>
                                <p class="text-xs text-gray-500 mb-4">Scratch to reveal rewards</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${scratchRemaining() > 0 ? 'bg-purple-500/15 text-purple-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {scratchRemaining()}/{maxScratch()} left
                                    </span>
                                    <HeartBtn gameName="scratch" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>

                        {/* Price Predict Card */}
                        <button
                            onClick={() => predictRemaining() > 0 && setActiveGame('predict')}
                            class={`group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-indigo-500/30 transition-all duration-300 text-left ${predictRemaining() <= 0 ? 'opacity-60' : ''}`}
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                            disabled={predictRemaining() <= 0}
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 group-hover:from-indigo-500/15 group-hover:to-violet-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 24 24" class="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <path d="M3 17l4-4 4 4 4-8 4 4" />
                                        <circle cx="19" cy="13" r="2" />
                                        <path d="M19 13v4" stroke-dasharray="2 2" />
                                    </svg>
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Price Predict</h3>
                                <p class="text-xs text-gray-500 mb-4">Predict UP or DOWN</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${predictRemaining() > 0 ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {predictRemaining()}/{maxPredict()} left
                                    </span>
                                    <HeartBtn gameName="predict" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>

                        {/* Falling Coins Card */}
                        <button
                            onClick={() => fallingRemaining() > 0 && setActiveGame('falling')}
                            class={`group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-rose-500/30 transition-all duration-300 text-left ${fallingRemaining() <= 0 ? 'opacity-60' : ''}`}
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                            disabled={fallingRemaining() <= 0}
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-pink-500/5 group-hover:from-rose-500/15 group-hover:to-pink-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-rose-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 24 24" class="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <circle cx="12" cy="6" r="3" />
                                        <circle cx="6" cy="14" r="2" />
                                        <circle cx="18" cy="12" r="2.5" />
                                        <path d="M12 9v4M6 16v3M18 14.5v4" stroke-dasharray="2 2" />
                                    </svg>
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Falling Coins</h3>
                                <p class="text-xs text-gray-500 mb-4">Catch coins, avoid bombs!</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${fallingRemaining() > 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {fallingRemaining()}/{maxFalling()} left
                                    </span>
                                    <HeartBtn gameName="falling" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>

                        {/* Memory Match Card */}
                        <button
                            onClick={() => memoryRemaining() > 0 && setActiveGame('memory')}
                            class={`group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-emerald-500/30 transition-all duration-300 text-left ${memoryRemaining() <= 0 ? 'opacity-60' : ''}`}
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                            disabled={memoryRemaining() <= 0}
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 group-hover:from-emerald-500/15 group-hover:to-teal-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 24 24" class="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="3" y="3" width="8" height="8" rx="1.5" />
                                        <rect x="13" y="3" width="8" height="8" rx="1.5" />
                                        <rect x="3" y="13" width="8" height="8" rx="1.5" />
                                        <rect x="13" y="13" width="8" height="8" rx="1.5" />
                                        <path d="M7 7h0M17 7h0M7 17h0" stroke-width="3" stroke-linecap="round" opacity="0.5" />
                                    </svg>
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Memory Match</h3>
                                <p class="text-xs text-gray-500 mb-4">Match crypto card pairs</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${memoryRemaining() > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {memoryRemaining()}/{maxMemory()} left
                                    </span>
                                    <HeartBtn gameName="memory" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>

                        {/* ═══ Tower Climb Card ═══ */}
                        <button
                            onClick={() => towerRemaining() > 0 && setActiveGame('tower')}
                            class={`group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-emerald-500/30 transition-all duration-300 text-left ${towerRemaining() <= 0 ? 'opacity-60' : ''}`}
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                            disabled={towerRemaining() <= 0}
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 group-hover:from-emerald-500/15 group-hover:to-cyan-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 24 24" class="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <path d="M3 21h18M5 21V7l7-4 7 4v14" />
                                        <rect x="9" y="13" width="6" height="8" rx="1" />
                                        <path d="M9 9h6" />
                                    </svg>
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Tower Climb</h3>
                                <p class="text-xs text-gray-500 mb-4">100 floors, pick the right door!</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${towerRemaining() > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {towerRemaining()}/{maxTower()} left
                                    </span>
                                    <HeartBtn gameName="tower" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>

                        {/* ═══ Mine Sweeper Card ═══ */}
                        <button
                            onClick={() => mineRemaining() > 0 && setActiveGame('mine')}
                            class={`group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-red-500/30 transition-all duration-300 text-left ${mineRemaining() <= 0 ? 'opacity-60' : ''}`}
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                            disabled={mineRemaining() <= 0}
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 group-hover:from-red-500/15 group-hover:to-orange-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 24 24" class="w-7 h-7 text-red-400" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <circle cx="12" cy="12" r="7" />
                                        <circle cx="12" cy="12" r="3" />
                                        <line x1="12" y1="3" x2="12" y2="5" />
                                        <line x1="12" y1="19" x2="12" y2="21" />
                                        <line x1="3" y1="12" x2="5" y2="12" />
                                        <line x1="19" y1="12" x2="21" y2="12" />
                                    </svg>
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Mine Sweeper</h3>
                                <p class="text-xs text-gray-500 mb-4">Find gems, avoid 20 mines!</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${mineRemaining() > 0 ? 'bg-red-500/15 text-red-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {mineRemaining()}/{maxMine()} left
                                    </span>
                                    <HeartBtn gameName="mine" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>

                        {/* ═══ Flappy VCN Card ═══ */}
                        <button
                            onClick={() => flappyRemaining() > 0 && setActiveGame('flappy')}
                            class={`group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-amber-500/30 transition-all duration-300 text-left ${flappyRemaining() <= 0 ? 'opacity-60' : ''}`}
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                            disabled={flappyRemaining() <= 0}
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-green-500/5 group-hover:from-amber-500/15 group-hover:to-green-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-amber-500/20 to-green-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 32 32" class="w-7 h-7">
                                        <circle cx="16" cy="16" r="12" fill="#F59E0B" />
                                        <circle cx="16" cy="16" r="9" fill="#FBBF24" />
                                        <text x="16" y="20" text-anchor="middle" fill="#92400E" font-size="12" font-weight="bold">V</text>
                                    </svg>
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Flappy VCN</h3>
                                <p class="text-xs text-gray-500 mb-4">Tap to fly through pipes!</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${flappyRemaining() > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {flappyRemaining()}/{maxFlappy()} left
                                    </span>
                                    <HeartBtn gameName="flappy" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>

                        {/* ═══ Crypto Slots Card ═══ */}
                        <button
                            onClick={() => slotsRemaining() > 0 && setActiveGame('slots')}
                            class={`group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-yellow-500/30 transition-all duration-300 text-left ${slotsRemaining() <= 0 ? 'opacity-60' : ''}`}
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                            disabled={slotsRemaining() <= 0}
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-red-500/5 group-hover:from-yellow-500/15 group-hover:to-red-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-yellow-500/20 to-red-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 24 24" class="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="2" y="4" width="20" height="16" rx="3" />
                                        <line x1="9" y1="4" x2="9" y2="20" />
                                        <line x1="15" y1="4" x2="15" y2="20" />
                                        <circle cx="6" cy="12" r="2" opacity="0.5" />
                                        <circle cx="12" cy="12" r="2" opacity="0.5" />
                                        <circle cx="18" cy="12" r="2" opacity="0.5" />
                                    </svg>
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Crypto Slots</h3>
                                <p class="text-xs text-gray-500 mb-4">Match crypto symbols!</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${slotsRemaining() > 0 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {slotsRemaining()}/{maxSlots()} left
                                    </span>
                                    <HeartBtn gameName="slots" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>

                        {/* ═══ Crash Game Card ═══ */}
                        <button
                            onClick={() => crashRemaining() > 0 && setActiveGame('crash')}
                            class={`group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-red-500/30 transition-all duration-300 text-left ${crashRemaining() <= 0 ? 'opacity-60' : ''}`}
                            style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
                            disabled={crashRemaining() <= 0}
                        >
                            <div class="absolute inset-0 bg-gradient-to-br from-red-500/5 to-amber-500/5 group-hover:from-red-500/15 group-hover:to-amber-500/15 transition-all duration-500" />
                            <div class="absolute -top-8 -right-8 w-32 h-32 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all" />
                            <div class="relative p-6">
                                <div class="w-14 h-14 mb-4 bg-gradient-to-br from-red-500/20 to-amber-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 24 24" class="w-7 h-7" fill="none">
                                        <path d="M12 2L8 10h8L12 2z" fill="#F59E0B" />
                                        <path d="M8 10l-2 8h12l-2-8H8z" fill="#EF4444" />
                                        <path d="M6 18l2 4h8l2-4H6z" fill="#DC2626" />
                                        <circle cx="12" cy="8" r="1.5" fill="white" />
                                    </svg>
                                </div>
                                <h3 class="text-lg font-black text-white mb-1">Crash Game</h3>
                                <p class="text-xs text-gray-500 mb-4">Cash out before crash!</p>
                                <div class="flex items-center justify-between">
                                    <span class={`text-xs font-bold px-2.5 py-1 rounded-lg ${crashRemaining() > 0 ? 'bg-red-500/15 text-red-400' : 'bg-gray-500/15 text-gray-500'}`}>
                                        {crashRemaining()}/{maxCrash()} left
                                    </span>
                                    <HeartBtn gameName="crash" hearts={gameHearts()} hearted={userHearted()} onToggle={toggleGameHeart} />
                                </div>
                            </div>
                        </button>
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
                            {/* Block type + timer row */}
                            <div class="flex items-center gap-3 mb-4">
                                <span class={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg ${blockType() === 'gold' ? 'bg-amber-500/20 text-amber-400' : blockType() === 'silver' ? 'bg-gray-300/20 text-gray-300' : 'bg-orange-800/20 text-orange-400'}`}>
                                    {blockType()} block
                                </span>
                                <Show when={!blockBroken() && blockStartTime() > 0}>
                                    <span class="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg">
                                        {((Date.now() - blockStartTime()) / 1000).toFixed(1)}s
                                    </span>
                                </Show>
                                <Show when={combo() >= 3}>
                                    <span class={`text-xs font-black px-2.5 py-1 rounded-lg animate-pulse ${combo() >= 10 ? 'bg-red-500/20 text-red-400' : combo() >= 5 ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
                                        COMBO x{combo()}
                                    </span>
                                </Show>
                                <Show when={bestTime() > 0}>
                                    <span class="text-[10px] font-bold text-gray-600 bg-white/5 px-2 py-1 rounded-lg">
                                        Best: {bestTime().toFixed(1)}s
                                    </span>
                                </Show>
                            </div>

                            {/* HP Bar */}
                            <div class="w-72 mb-6">
                                <div class="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                    <span>HP {Math.round((1 - blockHP() / blockMaxHP()) * 100)}%</span>
                                    <span>{blockHP()}/{blockMaxHP()}</span>
                                </div>
                                <div class="h-3 bg-black/40 rounded-full overflow-hidden border border-white/[0.06]">
                                    <div
                                        class={`h-full transition-all duration-100 rounded-full ${blockHP() / blockMaxHP() > 0.5 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : blockHP() / blockMaxHP() > 0.25 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-red-500 to-rose-400'}`}
                                        style={{ width: `${(blockHP() / blockMaxHP()) * 100}%` }}
                                    />
                                </div>
                                <Show when={combo() >= 5}>
                                    <div class="text-[9px] text-amber-400 mt-1 text-center font-bold">Combo x{combo()} = {1 + Math.floor(combo() / 5)}x damage!</div>
                                </Show>
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
                                    {/* Crack lines - adjusted for 50HP */}
                                    <Show when={!blockBroken()}>
                                        <svg viewBox="0 0 100 100" class="w-full h-full absolute inset-0" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="1.5">
                                            <Show when={blockCracks() >= 10}>
                                                <path d="M50 20 L45 40 L55 50 L48 65" />
                                            </Show>
                                            <Show when={blockCracks() >= 20}>
                                                <path d="M30 50 L45 48 L55 55 L70 45" />
                                            </Show>
                                            <Show when={blockCracks() >= 30}>
                                                <path d="M40 80 L50 60 L60 70 L55 35 L65 25" />
                                                <path d="M25 35 L40 45 L50 40" />
                                            </Show>
                                            <Show when={blockCracks() >= 40}>
                                                <path d="M20 65 L35 55 L45 70 L55 45 L75 60" />
                                                <path d="M60 80 L55 65 L65 55 L50 30" />
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
                                    <div class={`text-xs font-black uppercase tracking-widest mb-2 ${blockType() === 'gold' ? 'text-amber-400' : blockType() === 'silver' ? 'text-gray-300' : 'text-orange-400'}`}>
                                        {blockType() === 'gold' ? 'GOLD BLOCK MINED!' : blockType() === 'silver' ? 'SILVER BLOCK MINED!' : 'BLOCK MINED!'}
                                    </div>
                                    {/* Time + Record */}
                                    <div class="flex items-center justify-center gap-3 mb-3">
                                        <span class="text-sm font-mono font-bold text-cyan-400">{blockElapsed().toFixed(1)}s</span>
                                        <Show when={isNewRecord()}>
                                            <span class="text-[10px] font-black text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full animate-bounce">NEW RECORD! +10% BONUS</span>
                                        </Show>
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
                                    <div class="flex items-center justify-center gap-3 mt-4">
                                        <button onClick={startBlock} disabled={blocksRemaining() <= 0}
                                            class={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${blocksRemaining() > 0 ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>
                                            {blocksRemaining() > 0 ? `Mine Again (${blocksRemaining()} left)` : 'No blocks left'}
                                        </button>
                                        <Show when={blocksRemaining() <= 0}>
                                            <button onClick={handleInviteFriend} class="px-5 py-2.5 bg-emerald-500/15 text-emerald-400 text-sm font-bold rounded-xl hover:bg-emerald-500/25 active:scale-95 transition-all" style="touch-action: manipulation;">
                                                {inviteCopied() ? 'Copied!' : 'Invite Friend'}
                                            </button>
                                        </Show>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* ═══════════════════ SCRATCH CARD GAME ═══════════════════ */}
                <Show when={activeGame() === 'scratch'}>
                    <div class="space-y-6">
                        <button onClick={() => { setActiveGame(null); setScratchReward(null); setScratchRevealed(false); }} class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2" style="touch-action: manipulation;">
                            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                            Back to games
                        </button>

                        <div class="flex flex-col items-center">
                            <div class="text-xs font-black text-purple-400 uppercase tracking-widest mb-4">
                                Scratch Card
                            </div>

                            {/* Scratch Card Area */}
                            <div class="relative w-80 h-48 rounded-2xl overflow-hidden border-2 border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.2)] mb-6">
                                {/* Reward underneath */}
                                <div class="absolute inset-0 bg-[#111113] flex flex-col items-center justify-center">
                                    <Show when={scratchReward()}>
                                        {(() => {
                                            const r = scratchReward()!;
                                            const tierColors = {
                                                common: 'text-gray-300',
                                                rare: 'text-blue-400',
                                                epic: 'text-purple-400',
                                                legendary: 'text-amber-400',
                                            };
                                            const tierBgs = {
                                                common: 'bg-gray-500/10',
                                                rare: 'bg-blue-500/10',
                                                epic: 'bg-purple-500/10',
                                                legendary: 'bg-amber-500/10',
                                            };
                                            return (
                                                <div class="text-center">
                                                    <div class={`text-[10px] font-black uppercase tracking-widest mb-2 ${tierColors[r.tier]}`}>{r.tier}</div>
                                                    <div class="flex items-center justify-center gap-2 mb-2">
                                                        <VCNCoinIcon class="w-8 h-8" />
                                                        <span class={`text-4xl font-black ${tierColors[r.tier]}`}>{r.label}</span>
                                                    </div>
                                                    <div class={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg ${tierBgs[r.tier]}`}>
                                                        <svg viewBox="0 0 24 24" class="w-4 h-4 text-purple-400" fill="currentColor">
                                                            <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                                        </svg>
                                                        <span class="text-sm font-bold text-purple-400">+{r.rp} RP</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </Show>
                                </div>

                                {/* Scratch Canvas on top */}
                                <canvas
                                    ref={scratchCanvasRef}
                                    class="absolute inset-0 w-full h-full cursor-pointer"
                                    style="touch-action: none;"
                                    onMouseDown={() => { isScratchingRef = true; }}
                                    onMouseUp={() => { isScratchingRef = false; }}
                                    onMouseLeave={() => { isScratchingRef = false; }}
                                    onMouseMove={(e) => { if (isScratchingRef) handleScratchMove(e.clientX, e.clientY); }}
                                    onTouchStart={(e) => { e.preventDefault(); isScratchingRef = true; const t = e.touches[0]; handleScratchMove(t.clientX, t.clientY); }}
                                    onTouchEnd={() => { isScratchingRef = false; }}
                                    onTouchMove={(e) => { e.preventDefault(); if (isScratchingRef) { const t = e.touches[0]; handleScratchMove(t.clientX, t.clientY); } }}
                                />
                            </div>

                            {/* Progress indicator */}
                            <Show when={!scratchRevealed()}>
                                <div class="w-80 mb-4">
                                    <div class="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                        <span>Scratch progress</span>
                                        <span>{Math.round(scratchProgress() * 100)}%</span>
                                    </div>
                                    <div class="h-2 bg-black/40 rounded-full overflow-hidden border border-white/[0.06]">
                                        <div
                                            class="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-200"
                                            style={{ width: `${Math.min(100, scratchProgress() * 167)}%` }}
                                        />
                                    </div>
                                    <div class="text-[9px] text-gray-600 mt-1 text-center">Scratch 60% to reveal your reward</div>
                                </div>
                            </Show>

                            {/* Revealed result */}
                            <Show when={scratchRevealed() && scratchReward()}>
                                <div class="p-6 bg-[#111113]/80 border border-white/[0.08] rounded-2xl text-center animate-in fade-in zoom-in-95 duration-500 w-full max-w-sm">
                                    {(() => {
                                        const r = scratchReward()!;
                                        const tierColors = {
                                            common: 'text-gray-300',
                                            rare: 'text-blue-400',
                                            epic: 'text-purple-400',
                                            legendary: 'text-amber-400',
                                        };
                                        return (
                                            <>
                                                <div class={`text-xs font-black uppercase tracking-widest mb-3 ${tierColors[r.tier]}`}>
                                                    {r.tier === 'legendary' ? 'JACKPOT!' : r.tier === 'epic' ? 'AMAZING!' : r.tier === 'rare' ? 'NICE!' : 'You Won!'}
                                                </div>
                                                <div class="flex items-center justify-center gap-6">
                                                    <div class="flex items-center gap-2">
                                                        <VCNCoinIcon class="w-8 h-8" />
                                                        <span class="text-3xl font-black text-amber-400">+{r.vcn}</span>
                                                        <span class="text-sm text-gray-500 font-bold">VCN</span>
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <svg viewBox="0 0 24 24" class="w-6 h-6 text-purple-400" fill="currentColor">
                                                            <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
                                                        </svg>
                                                        <span class="text-3xl font-black text-purple-400">+{r.rp}</span>
                                                        <span class="text-sm text-gray-500 font-bold">RP</span>
                                                    </div>
                                                </div>
                                                <div class="flex items-center justify-center gap-3 mt-4">
                                                    <button onClick={startScratch} disabled={scratchRemaining() <= 0}
                                                        class={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${scratchRemaining() > 0 ? 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                                                        style="touch-action: manipulation; min-height: 44px;">
                                                        {scratchRemaining() > 0 ? `Scratch Again (${scratchRemaining()} left)` : 'No cards left'}
                                                    </button>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* ═══════════════════ MEMORY MATCH GAME ═══════════════════ */}
                <Show when={activeGame() === 'memory'}>
                    <MemoryMatchGame
                        onBack={() => setActiveGame(null)}
                        onComplete={(result) => {
                            const prev = dailyData();
                            const record: GamePlayRecord = {
                                score: result.time, vcn: result.vcn, rp: result.rp,
                                timestamp: new Date().toISOString(), game: 'memory'
                            };
                            const newBest = prev.bestMemoryTime === 0 || result.time < prev.bestMemoryTime
                                ? result.time : prev.bestMemoryTime;
                            const updated: DailyGameData = {
                                ...prev,
                                memoryUsed: prev.memoryUsed + 1,
                                totalVCN: prev.totalVCN + result.vcn,
                                totalRP: prev.totalRP + result.rp,
                                bestMemoryTime: newBest,
                                games: [...prev.games, record],
                            };
                            setDailyData(updated);
                            saveDailyData(updated);
                            awardRewards(result.vcn, 0, `Memory Match (${result.grade})`);
                            if (result.rp > 0) {
                                setDiceBetPending({ rpAmount: result.rp, gameName: `Memory Match (${result.grade})` });
                            }
                        }}
                    />
                </Show>

                {/* ═══════════════════ FALLING COINS GAME ═══════════════════ */}
                <Show when={activeGame() === 'falling'}>
                    <FallingCoinsGame
                        onBack={() => setActiveGame(null)}
                        onComplete={(result) => {
                            const prev = dailyData();
                            const record: GamePlayRecord = {
                                score: result.score, vcn: result.vcn, rp: result.rp,
                                timestamp: new Date().toISOString(), game: 'falling'
                            };
                            const newBest = result.score > prev.bestFallingScore
                                ? result.score : prev.bestFallingScore;
                            const updated: DailyGameData = {
                                ...prev,
                                fallingUsed: prev.fallingUsed + 1,
                                totalVCN: prev.totalVCN + result.vcn,
                                totalRP: prev.totalRP + result.rp,
                                bestFallingScore: newBest,
                                games: [...prev.games, record],
                            };
                            setDailyData(updated);
                            saveDailyData(updated);
                            awardRewards(result.vcn, 0, `Falling Coins (${result.grade})`);
                            if (result.rp > 0) {
                                setDiceBetPending({ rpAmount: result.rp, gameName: `Falling Coins (${result.grade})` });
                            }
                        }}
                    />
                </Show>

                {/* ═══════════════════ PRICE PREDICT GAME ═══════════════════ */}
                <Show when={activeGame() === 'predict'}>
                    <PricePredictGame
                        onBack={() => setActiveGame(null)}
                        onComplete={(result) => {
                            const prev = dailyData();
                            const record: GamePlayRecord = {
                                score: result.streak, vcn: result.vcn, rp: result.rp,
                                timestamp: new Date().toISOString(), game: 'predict'
                            };
                            const newBest = result.streak > prev.bestPredictStreak
                                ? result.streak : prev.bestPredictStreak;
                            const isFirstPlay = prev.games.filter(g => g.game === 'predict').length === 0;
                            const updated: DailyGameData = {
                                ...prev,
                                predictUsed: isFirstPlay ? prev.predictUsed + 1 : prev.predictUsed,
                                totalVCN: prev.totalVCN + result.vcn,
                                totalRP: prev.totalRP + result.rp,
                                bestPredictStreak: newBest,
                                games: [...prev.games, record],
                            };
                            setDailyData(updated);
                            saveDailyData(updated);
                            awardRewards(result.vcn, 0, `Price Predict (${result.correct ? 'Correct' : 'Wrong'})`);
                            if (result.rp > 0) {
                                setDiceBetPending({ rpAmount: result.rp, gameName: `Price Predict` });
                            }
                        }}
                    />
                </Show>

                {/* ═══════════════════ TOWER CLIMB GAME ═══════════════════ */}
                <Show when={activeGame() === 'tower'}>
                    <TowerClimbGame
                        onBack={() => setActiveGame(null)}
                        onComplete={(result) => {
                            const prev = dailyData();
                            const record: GamePlayRecord = {
                                score: result.floor, vcn: result.vcn, rp: result.rp,
                                timestamp: new Date().toISOString(), game: 'tower'
                            };
                            const updated: DailyGameData = {
                                ...prev,
                                towerUsed: prev.towerUsed + 1,
                                totalVCN: prev.totalVCN + result.vcn,
                                totalRP: prev.totalRP + result.rp,
                                bestTowerFloor: Math.max(prev.bestTowerFloor, result.floor),
                                games: [...prev.games, record],
                            };
                            setDailyData(updated);
                            saveDailyData(updated);
                            if (result.vcn > 0) awardRewards(result.vcn, 0, `Tower Climb (F${result.floor})`);
                            if (result.rp > 0) {
                                setDiceBetPending({ rpAmount: result.rp, gameName: 'Tower Climb' });
                            }
                        }}
                    />
                </Show>

                {/* ═══════════════════ MINE SWEEPER GAME ═══════════════════ */}
                <Show when={activeGame() === 'mine'}>
                    <MineSweeperGame
                        onBack={() => setActiveGame(null)}
                        onComplete={(result) => {
                            const prev = dailyData();
                            const record: GamePlayRecord = {
                                score: result.revealed, vcn: result.vcn, rp: result.rp,
                                timestamp: new Date().toISOString(), game: 'mine'
                            };
                            const updated: DailyGameData = {
                                ...prev,
                                mineUsed: prev.mineUsed + 1,
                                totalVCN: prev.totalVCN + result.vcn,
                                totalRP: prev.totalRP + result.rp,
                                bestMineReveals: Math.max(prev.bestMineReveals, result.revealed),
                                games: [...prev.games, record],
                            };
                            setDailyData(updated);
                            saveDailyData(updated);
                            if (result.vcn > 0) awardRewards(result.vcn, 0, `Mine Sweeper (${result.revealed} gems)`);
                            if (result.rp > 0) {
                                setDiceBetPending({ rpAmount: result.rp, gameName: 'Mine Sweeper' });
                            }
                        }}
                    />
                </Show>

                {/* ═══════════════════ FLAPPY VCN GAME ═══════════════════ */}
                <Show when={activeGame() === 'flappy'}>
                    <FlappyVCNGame
                        onBack={() => setActiveGame(null)}
                        onComplete={(result) => {
                            const prev = dailyData();
                            const record: GamePlayRecord = {
                                score: result.score, vcn: result.vcn, rp: result.rp,
                                timestamp: new Date().toISOString(), game: 'flappy'
                            };
                            const updated: DailyGameData = {
                                ...prev,
                                flappyUsed: prev.flappyUsed + 1,
                                totalVCN: prev.totalVCN + result.vcn,
                                totalRP: prev.totalRP + result.rp,
                                bestFlappyScore: Math.max(prev.bestFlappyScore, result.score),
                                games: [...prev.games, record],
                            };
                            setDailyData(updated);
                            saveDailyData(updated);
                            awardRewards(result.vcn, 0, `Flappy VCN (${result.score} pipes)`);
                            if (result.rp > 0) {
                                setDiceBetPending({ rpAmount: result.rp, gameName: 'Flappy VCN' });
                            }
                        }}
                    />
                </Show>

                {/* ═══════════════════ CRYPTO SLOTS GAME ═══════════════════ */}
                <Show when={activeGame() === 'slots'}>
                    <CryptoSlotsGame
                        onBack={() => setActiveGame(null)}
                        onComplete={(result) => {
                            const prev = dailyData();
                            const record: GamePlayRecord = {
                                score: result.match, vcn: result.vcn, rp: result.rp,
                                timestamp: new Date().toISOString(), game: 'slots'
                            };
                            const updated: DailyGameData = {
                                ...prev,
                                slotsUsed: prev.slotsUsed + 1,
                                totalVCN: prev.totalVCN + result.vcn,
                                totalRP: prev.totalRP + result.rp,
                                games: [...prev.games, record],
                            };
                            setDailyData(updated);
                            saveDailyData(updated);
                            awardRewards(result.vcn, 0, `Crypto Slots (${result.jackpot ? 'JACKPOT' : result.match + ' match'})`);
                            if (result.rp > 0) {
                                setDiceBetPending({ rpAmount: result.rp, gameName: 'Crypto Slots' });
                            }
                        }}
                    />
                </Show>

                {/* ═══════════════════ CRASH GAME ═══════════════════ */}
                <Show when={activeGame() === 'crash'}>
                    <CrashGame
                        onBack={() => setActiveGame(null)}
                        onComplete={(result) => {
                            const prev = dailyData();
                            const record: GamePlayRecord = {
                                score: Math.round(result.multiplier * 100), vcn: result.vcn, rp: result.rp,
                                timestamp: new Date().toISOString(), game: 'crash'
                            };
                            const updated: DailyGameData = {
                                ...prev,
                                crashUsed: prev.crashUsed + 1,
                                totalVCN: prev.totalVCN + result.vcn,
                                totalRP: prev.totalRP + result.rp,
                                games: [...prev.games, record],
                            };
                            setDailyData(updated);
                            saveDailyData(updated);
                            if (result.vcn > 0) awardRewards(result.vcn, 0, `Crash Game (x${result.multiplier.toFixed(2)})`);
                            if (result.rp > 0) {
                                setDiceBetPending({ rpAmount: result.rp, gameName: 'Crash Game' });
                            }
                        }}
                    />
                </Show>

                {/* ═══════════════════ DICE BET OVERLAY ═══════════════════ */}
                <Show when={diceBetPending() !== null}>
                    {(() => {
                        const bet = diceBetPending()!;
                        return (
                            <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 px-4">
                                <div class="w-full max-w-sm">
                                    <DiceBetGame
                                        rpAmount={bet.rpAmount}
                                        onSkip={() => {
                                            // Award original RP
                                            awardRewards(0, bet.rpAmount, bet.gameName);
                                            setDiceBetPending(null);
                                        }}
                                        onResult={(finalRP) => {
                                            // Award modified RP (0 if lost, multiplied if won)
                                            if (finalRP > 0) {
                                                awardRewards(0, finalRP, `Dice Bet x${Math.round(finalRP / bet.rpAmount)} (${bet.gameName})`);
                                            }
                                            setDiceBetPending(null);
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })()}
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
                                        <div class={`w-8 h-8 rounded-lg flex items-center justify-center ${g.game === 'spin' ? 'bg-cyan-500/15' : g.game === 'block' ? 'bg-amber-500/15' : g.game === 'memory' ? 'bg-emerald-500/15' : g.game === 'falling' ? 'bg-rose-500/15' : g.game === 'predict' ? 'bg-indigo-500/15' : 'bg-purple-500/15'}`}>
                                            {g.game === 'spin' && <SpinWheelIcon class="w-4 h-4 text-cyan-400" />}
                                            {g.game === 'block' && <BlockIcon class="w-4 h-4 text-amber-400" />}
                                            {g.game === 'memory' && (
                                                <svg viewBox="0 0 24 24" class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.5">
                                                    <rect x="3" y="3" width="8" height="8" rx="1.5" />
                                                    <rect x="13" y="3" width="8" height="8" rx="1.5" />
                                                    <rect x="3" y="13" width="8" height="8" rx="1.5" />
                                                    <rect x="13" y="13" width="8" height="8" rx="1.5" />
                                                </svg>
                                            )}
                                            {g.game === 'falling' && (
                                                <svg viewBox="0 0 24 24" class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" stroke-width="1.5">
                                                    <circle cx="12" cy="6" r="3" /><path d="M12 9v6" stroke-dasharray="2 2" />
                                                </svg>
                                            )}
                                            {g.game === 'predict' && (
                                                <svg viewBox="0 0 24 24" class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="1.5">
                                                    <path d="M3 17l4-4 4 4 4-8 4 4" />
                                                </svg>
                                            )}
                                            {g.game === 'scratch' && <ScratchIcon class="w-4 h-4 text-purple-400" />}
                                        </div>
                                        <div class="flex-1">
                                            <span class="text-xs font-bold text-white capitalize">{g.game === 'spin' ? 'Lucky Spin' : g.game === 'block' ? 'Block Breaker' : g.game === 'memory' ? 'Memory Match' : g.game === 'falling' ? 'Falling Coins' : g.game === 'predict' ? 'Price Predict' : g.game === 'tower' ? 'Tower Climb' : g.game === 'mine' ? 'Mine Sweeper' : g.game === 'flappy' ? 'Flappy VCN' : g.game === 'slots' ? 'Crypto Slots' : g.game === 'crash' ? 'Crash Game' : 'Scratch Card'}</span>
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
