/**
 * GameAudio - Procedural Audio Engine for VCN Game Center
 * 
 * All sounds are synthesized via Web Audio API.
 * Zero external files, zero bundle size impact.
 */

type SFXType =
    // Common
    | 'tick' | 'win' | 'jackpot' | 'tap' | 'break'
    | 'countdown' | 'countdownGo' | 'rankUp' | 'newRecord'
    // Memory Match
    | 'cardFlip' | 'match' | 'matchCombo' | 'miss' | 'perfect'
    // Falling Coins
    | 'coinCatch' | 'starCatch' | 'diamondCatch' | 'bombHit'
    | 'feverStart' | 'feverEnd' | 'timeWarning'
    // Price Predict  
    | 'heartbeat' | 'selectUp' | 'selectDown' | 'correct' | 'wrong' | 'streakFire'
    // Dice Bet
    | 'diceRoll' | 'diceWin' | 'diceLose'
    // Tower Climb
    | 'doorOpen' | 'floorClear' | 'towerFall' | 'towerCashOut'
    // Mine Sweeper
    | 'gemReveal' | 'mineExplode' | 'mineCashOut'
    // Flappy VCN
    | 'flap' | 'pipePass' | 'crash'
    // Crypto Slots
    | 'slotSpin' | 'slotStop' | 'slotWin'
    // Crash Game
    | 'rocketLaunch' | 'rocketCashOut' | 'rocketCrash';

type BGMTheme = 'lobby' | 'memory' | 'falling' | 'predict' | 'fever'
    | 'tower' | 'mine' | 'flappy' | 'slots' | 'crash';

interface BGMState {
    nodes: (OscillatorNode | AudioBufferSourceNode)[];
    gains: GainNode[];
    interval: ReturnType<typeof setInterval> | null;
    theme: BGMTheme | null;
}

// ─── Note Frequencies (Equal Temperament) ─────────────────────────────────
const NOTE: Record<string, number> = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.26, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50, D6: 1174.66, E6: 1318.51,
};

class GameAudioEngine {
    private _ctx: AudioContext | null = null;
    private _bgm: BGMState = { nodes: [], gains: [], interval: null, theme: null };
    private _sfxMuted: boolean = false;
    private _bgmMuted: boolean = false;
    private _sfxVolume: number = 0.12;
    private _bgmVolume: number = 0.08;
    private _coinCatchCount: number = 0; // For rising pitch on sequential catches

    constructor() {
        // Load preferences from localStorage
        try {
            const prefs = localStorage.getItem('vcn_game_audio');
            if (prefs) {
                const p = JSON.parse(prefs);
                this._sfxMuted = p.sfxMuted ?? false;
                this._bgmMuted = p.bgmMuted ?? false;
            }
        } catch { /* ignore */ }
    }

    private _getCtx(): AudioContext {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this._ctx.state === 'suspended') {
            this._ctx.resume().catch(() => { });
        }
        return this._ctx;
    }

    private _savePrefs(): void {
        try {
            localStorage.setItem('vcn_game_audio', JSON.stringify({
                sfxMuted: this._sfxMuted,
                bgmMuted: this._bgmMuted,
            }));
        } catch { /* ignore */ }
    }

    // ─── Public Controls ────────────────────────────────────────────
    get sfxMuted(): boolean { return this._sfxMuted; }
    get bgmMuted(): boolean { return this._bgmMuted; }

    toggleSFX(): boolean {
        this._sfxMuted = !this._sfxMuted;
        this._savePrefs();
        return this._sfxMuted;
    }

    toggleBGM(): boolean {
        this._bgmMuted = !this._bgmMuted;
        if (this._bgmMuted) this.stopBGM();
        this._savePrefs();
        return this._bgmMuted;
    }

    resetCoinCatchCount(): void {
        this._coinCatchCount = 0;
    }

    // ─── SFX Engine ─────────────────────────────────────────────────
    play(type: SFXType): void {
        if (this._sfxMuted) return;
        try {
            const ctx = this._getCtx();
            const now = ctx.currentTime;
            const vol = this._sfxVolume;

            switch (type) {
                // ── Common ──
                case 'tick': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination);
                    o.frequency.value = 800 + Math.random() * 400;
                    o.type = 'sine'; g.gain.setValueAtTime(vol * 0.7, now);
                    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                    o.start(now); o.stop(now + 0.06);
                    break;
                }
                case 'win': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => o.frequency.setValueAtTime(f, now + i * 0.12));
                    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    o.start(now); o.stop(now + 0.4);
                    break;
                }
                case 'jackpot': {
                    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = i < 4 ? 'sine' : 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol, now + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
                        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.25);
                    });
                    break;
                }
                case 'tap': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination);
                    o.frequency.value = 200 + Math.random() * 100; o.type = 'square';
                    g.gain.setValueAtTime(vol * 0.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                    o.start(now); o.stop(now + 0.05);
                    break;
                }
                case 'break': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination);
                    o.type = 'sawtooth'; o.frequency.setValueAtTime(300, now);
                    o.frequency.exponentialRampToValueAtTime(80, now + 0.3);
                    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    o.start(now); o.stop(now + 0.3);
                    break;
                }
                case 'countdown': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    o.frequency.setValueAtTime(440, now);
                    o.frequency.exponentialRampToValueAtTime(880, now + 0.12);
                    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    o.start(now); o.stop(now + 0.15);
                    break;
                }
                case 'countdownGo': {
                    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = i < 2 ? 'sine' : 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 1.2, now + i * 0.08);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
                        o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.15);
                    });
                    break;
                }
                case 'rankUp': {
                    [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                        o.frequency.value = f; g.gain.setValueAtTime(vol, now + i * 0.12);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.2);
                        o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.2);
                    });
                    break;
                }
                case 'newRecord': {
                    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G5].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 1.2, now + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
                        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
                    });
                    break;
                }

                // ── Memory Match ──
                case 'cardFlip': {
                    // White noise burst through bandpass = paper flip
                    const bufferSize = ctx.sampleRate * 0.08;
                    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
                    const src = ctx.createBufferSource(); src.buffer = buffer;
                    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 1.5;
                    const g = ctx.createGain();
                    src.connect(bp); bp.connect(g); g.connect(ctx.destination);
                    g.gain.setValueAtTime(vol * 0.8, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                    src.start(now); src.stop(now + 0.08);
                    break;
                }
                case 'match': {
                    [NOTE.E5, NOTE.G5].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol, now + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
                        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
                    });
                    break;
                }
                case 'matchCombo': {
                    [NOTE.E5, NOTE.G5, NOTE.B5].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 1.2, now + i * 0.08);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
                        o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.2);
                    });
                    break;
                }
                case 'miss': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'square';
                    o.frequency.setValueAtTime(200, now);
                    o.frequency.exponentialRampToValueAtTime(150, now + 0.2);
                    g.gain.setValueAtTime(vol * 0.6, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    o.start(now); o.stop(now + 0.2);
                    break;
                }
                case 'perfect': {
                    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E5, NOTE.C6].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = i < 4 ? 'sine' : 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 1.3, now + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
                        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.25);
                    });
                    break;
                }

                // ── Falling Coins ──
                case 'coinCatch': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    // Rising pitch on sequential catches (resets after 12)
                    const pitch = 800 + (this._coinCatchCount % 12) * 50;
                    this._coinCatchCount++;
                    o.frequency.value = pitch;
                    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    o.start(now); o.stop(now + 0.1);
                    break;
                }
                case 'starCatch': {
                    [NOTE.A5, NOTE.E6].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol, now + i * 0.06);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.12);
                        o.start(now + i * 0.06); o.stop(now + i * 0.06 + 0.12);
                    });
                    break;
                }
                case 'diamondCatch': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    o.frequency.setValueAtTime(1000, now);
                    o.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
                    g.gain.setValueAtTime(vol * 1.3, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    o.start(now); o.stop(now + 0.3);
                    break;
                }
                case 'bombHit': {
                    // Sawtooth sweep down + noise burst
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
                    o.frequency.setValueAtTime(300, now);
                    o.frequency.exponentialRampToValueAtTime(50, now + 0.3);
                    g.gain.setValueAtTime(vol * 1.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    o.start(now); o.stop(now + 0.4);
                    // Noise layer
                    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
                    const ns = ctx.createBufferSource(); ns.buffer = buf;
                    const ng = ctx.createGain(); ns.connect(ng); ng.connect(ctx.destination);
                    ng.gain.setValueAtTime(vol * 0.5, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    ns.start(now); ns.stop(now + 0.15);
                    break;
                }
                case 'feverStart': {
                    [NOTE.C4, NOTE.D4, NOTE.E4, NOTE.F4, NOTE.G4, NOTE.A4, NOTE.B4, NOTE.C5].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 1.2, now + i * 0.05);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.12);
                        o.start(now + i * 0.05); o.stop(now + i * 0.05 + 0.12);
                    });
                    break;
                }
                case 'feverEnd': {
                    [NOTE.G5, NOTE.E5, NOTE.C5].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol, now + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
                        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
                    });
                    break;
                }
                case 'timeWarning': {
                    for (let i = 0; i < 3; i++) {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'square';
                        o.frequency.value = 440;
                        g.gain.setValueAtTime(vol * 0.8, now + i * 0.15);
                        g.gain.setValueAtTime(0, now + i * 0.15 + 0.08);
                        o.start(now + i * 0.15); o.stop(now + i * 0.15 + 0.1);
                    }
                    break;
                }

                // ── Price Predict ──
                case 'heartbeat': {
                    // Low sine pulse like a heartbeat
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    o.frequency.value = 60;
                    g.gain.setValueAtTime(0, now);
                    g.gain.linearRampToValueAtTime(vol * 1.5, now + 0.05);
                    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    o.start(now); o.stop(now + 0.3);
                    // Second beat (softer, delayed)
                    const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
                    o2.connect(g2); g2.connect(ctx.destination); o2.type = 'sine';
                    o2.frequency.value = 55;
                    g2.gain.setValueAtTime(0, now + 0.15);
                    g2.gain.linearRampToValueAtTime(vol * 0.8, now + 0.2);
                    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                    o2.start(now + 0.15); o2.stop(now + 0.45);
                    break;
                }
                case 'selectUp': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                    o.frequency.setValueAtTime(400, now);
                    o.frequency.exponentialRampToValueAtTime(600, now + 0.12);
                    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    o.start(now); o.stop(now + 0.15);
                    break;
                }
                case 'selectDown': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                    o.frequency.setValueAtTime(600, now);
                    o.frequency.exponentialRampToValueAtTime(400, now + 0.12);
                    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    o.start(now); o.stop(now + 0.15);
                    break;
                }
                case 'correct': {
                    [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 1.2, now + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
                        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
                    });
                    break;
                }
                case 'wrong': {
                    [NOTE.E4, NOTE.Eb4].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'square';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 0.7, now + i * 0.12);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.2);
                        o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.2);
                    });
                    break;
                }
                case 'streakFire': {
                    // Noise burst + sine highlight
                    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
                    const ns = ctx.createBufferSource(); ns.buffer = buf;
                    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
                    const ng = ctx.createGain();
                    ns.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
                    ng.gain.setValueAtTime(vol * 0.6, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    ns.start(now); ns.stop(now + 0.1);
                    // Sine accent
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    o.frequency.value = 1000; g.gain.setValueAtTime(vol * 0.8, now);
                    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    o.start(now); o.stop(now + 0.15);
                    break;
                }

                // ── Dice Bet ──
                case 'diceRoll': {
                    // Rapid clicking noise simulating dice rattling
                    for (let i = 0; i < 12; i++) {
                        const delay = i * 0.07 + Math.random() * 0.03;
                        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
                        const d = buf.getChannelData(0);
                        for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1);
                        const src = ctx.createBufferSource(); src.buffer = buf;
                        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
                        bp.frequency.value = 1500 + Math.random() * 2000; bp.Q.value = 3;
                        const g = ctx.createGain();
                        src.connect(bp); bp.connect(g); g.connect(ctx.destination);
                        const dv = vol * (0.4 + (i / 12) * 0.6);
                        g.gain.setValueAtTime(dv, now + delay);
                        g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.03);
                        src.start(now + delay); src.stop(now + delay + 0.04);
                    }
                    // Final impact thud
                    const thud = ctx.createOscillator(); const tg = ctx.createGain();
                    thud.connect(tg); tg.connect(ctx.destination); thud.type = 'sine';
                    thud.frequency.setValueAtTime(120, now + 0.85);
                    thud.frequency.exponentialRampToValueAtTime(50, now + 1.0);
                    tg.gain.setValueAtTime(vol * 1.5, now + 0.85);
                    tg.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
                    thud.start(now + 0.85); thud.stop(now + 1.1);
                    break;
                }
                case 'diceWin': {
                    // Triumphant ascending fanfare
                    const fanfare = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.C6, NOTE.E6];
                    fanfare.forEach((f, i) => {
                        const ow = ctx.createOscillator(); const gw = ctx.createGain();
                        ow.connect(gw); gw.connect(ctx.destination);
                        ow.type = i < 4 ? 'sine' : 'triangle';
                        ow.frequency.value = f;
                        gw.gain.setValueAtTime(vol * 1.5, now + i * 0.1);
                        gw.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
                        ow.start(now + i * 0.1); ow.stop(now + i * 0.1 + 0.3);
                    });
                    // Shimmer noise
                    const shimBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
                    const sd = shimBuf.getChannelData(0);
                    for (let i = 0; i < sd.length; i++) sd[i] = (Math.random() * 2 - 1) * 0.15;
                    const shim = ctx.createBufferSource(); shim.buffer = shimBuf;
                    const shp = ctx.createBiquadFilter(); shp.type = 'highpass'; shp.frequency.value = 6000;
                    const sg = ctx.createGain();
                    shim.connect(shp); shp.connect(sg); sg.connect(ctx.destination);
                    sg.gain.setValueAtTime(vol, now + 0.3);
                    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                    shim.start(now + 0.3); shim.stop(now + 0.8);
                    break;
                }
                case 'diceLose': {
                    // Sad descending tone
                    [NOTE.G4, NOTE.E4, NOTE.C4, NOTE.A3].forEach((f, i) => {
                        const ol = ctx.createOscillator(); const gl = ctx.createGain();
                        ol.connect(gl); gl.connect(ctx.destination); ol.type = 'sine';
                        ol.frequency.value = f;
                        gl.gain.setValueAtTime(vol * 0.8, now + i * 0.15);
                        gl.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);
                        ol.start(now + i * 0.15); ol.stop(now + i * 0.15 + 0.3);
                    });
                    break;
                }

                // ── Tower Climb ──
                case 'doorOpen': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    o.frequency.setValueAtTime(400, now); o.frequency.exponentialRampToValueAtTime(800, now + 0.15);
                    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    o.start(now); o.stop(now + 0.2);
                    break;
                }
                case 'floorClear': {
                    [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol, now + i * 0.08);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
                        o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.15);
                    });
                    break;
                }
                case 'towerFall': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
                    o.frequency.setValueAtTime(600, now); o.frequency.exponentialRampToValueAtTime(60, now + 0.8);
                    g.gain.setValueAtTime(vol * 1.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
                    o.start(now); o.stop(now + 1.0);
                    break;
                }
                case 'towerCashOut': {
                    [NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 1.2, now + i * 0.08);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
                        o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.2);
                    });
                    break;
                }

                // ── Mine Sweeper ──
                case 'gemReveal': {
                    const pitch = 600 + Math.random() * 600;
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    o.frequency.value = pitch;
                    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    o.start(now); o.stop(now + 0.12);
                    break;
                }
                case 'mineExplode': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
                    o.frequency.setValueAtTime(200, now); o.frequency.exponentialRampToValueAtTime(30, now + 0.5);
                    g.gain.setValueAtTime(vol * 2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    o.start(now); o.stop(now + 0.6);
                    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
                    const ns = ctx.createBufferSource(); ns.buffer = buf;
                    const ng = ctx.createGain(); ns.connect(ng); ng.connect(ctx.destination);
                    ng.gain.setValueAtTime(vol, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    ns.start(now); ns.stop(now + 0.3);
                    break;
                }
                case 'mineCashOut': {
                    [NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 1.2, now + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
                        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
                    });
                    break;
                }

                // ── Flappy VCN ──
                case 'flap': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    o.frequency.setValueAtTime(300, now); o.frequency.exponentialRampToValueAtTime(500, now + 0.08);
                    g.gain.setValueAtTime(vol * 0.6, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    o.start(now); o.stop(now + 0.1);
                    break;
                }
                case 'pipePass': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                    o.frequency.value = 880;
                    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                    o.start(now); o.stop(now + 0.08);
                    break;
                }
                case 'crash': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'square';
                    o.frequency.setValueAtTime(400, now); o.frequency.exponentialRampToValueAtTime(80, now + 0.4);
                    g.gain.setValueAtTime(vol * 1.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    o.start(now); o.stop(now + 0.5);
                    break;
                }

                // ── Crypto Slots ──
                case 'slotSpin': {
                    for (let i = 0; i < 8; i++) {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                        o.frequency.value = 300 + (i % 3) * 200;
                        const t = now + i * 0.06;
                        g.gain.setValueAtTime(vol * 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                        o.start(t); o.stop(t + 0.06);
                    }
                    break;
                }
                case 'slotStop': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                    o.frequency.value = 500;
                    g.gain.setValueAtTime(vol * 0.8, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    o.start(now); o.stop(now + 0.1);
                    break;
                }
                case 'slotWin': {
                    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.E5, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
                        o.frequency.value = f; g.gain.setValueAtTime(vol, now + i * 0.08);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.12);
                        o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.12);
                    });
                    break;
                }

                // ── Crash Game ──
                case 'rocketLaunch': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
                    o.frequency.setValueAtTime(80, now); o.frequency.exponentialRampToValueAtTime(400, now + 0.5);
                    g.gain.setValueAtTime(vol * 0.5, now); g.gain.exponentialRampToValueAtTime(vol * 0.3, now + 0.5);
                    g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
                    o.start(now); o.stop(now + 1.0);
                    break;
                }
                case 'rocketCashOut': {
                    [NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6].forEach((f, i) => {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                        o.frequency.value = f; g.gain.setValueAtTime(vol * 1.5, now + i * 0.07);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.2);
                        o.start(now + i * 0.07); o.stop(now + i * 0.07 + 0.2);
                    });
                    break;
                }
                case 'rocketCrash': {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
                    o.frequency.setValueAtTime(500, now); o.frequency.exponentialRampToValueAtTime(40, now + 0.6);
                    g.gain.setValueAtTime(vol * 2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                    o.start(now); o.stop(now + 0.8);
                    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
                    const ns = ctx.createBufferSource(); ns.buffer = buf;
                    const ng = ctx.createGain(); ns.connect(ng); ng.connect(ctx.destination);
                    ng.gain.setValueAtTime(vol * 1.2, now + 0.1); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    ns.start(now + 0.1); ns.stop(now + 0.5);
                    break;
                }
            }
        } catch { /* Audio not supported */ }
    }

    // ─── BGM Engine ─────────────────────────────────────────────────

    startBGM(theme: BGMTheme): void {
        if (this._bgmMuted) return;
        if (this._bgm.theme === theme) return; // Already playing
        this.stopBGM();

        try {
            const ctx = this._getCtx();
            this._bgm.theme = theme;

            switch (theme) {
                case 'lobby': this._bgmLobby(ctx); break;
                case 'memory': this._bgmMemory(ctx); break;
                case 'falling': this._bgmFalling(ctx); break;
                case 'predict': this._bgmPredict(ctx); break;
                case 'fever': this._bgmFever(ctx); break;
                case 'tower': this._bgmTower(ctx); break;
                case 'mine': this._bgmMine(ctx); break;
                case 'flappy': this._bgmFlappy(ctx); break;
                case 'slots': this._bgmSlots(ctx); break;
                case 'crash': this._bgmCrash(ctx); break;
            }
        } catch { /* Audio not supported */ }
    }

    stopBGM(): void {
        const ctx = this._ctx;
        if (ctx) {
            const now = ctx.currentTime;
            // Fade out all BGM gains
            this._bgm.gains.forEach(g => {
                try {
                    g.gain.cancelScheduledValues(now);
                    g.gain.setValueAtTime(g.gain.value, now);
                    g.gain.linearRampToValueAtTime(0, now + 0.5);
                } catch { /* ignore */ }
            });
            // Stop nodes after fade
            setTimeout(() => {
                this._bgm.nodes.forEach(n => { try { n.stop(); } catch { } });
                this._bgm.nodes = [];
                this._bgm.gains = [];
            }, 600);
        }
        if (this._bgm.interval) clearInterval(this._bgm.interval);
        this._bgm.interval = null;
        this._bgm.theme = null;
    }

    setBGMIntensity(level: number): void {
        // 0.0 to 1.0 -- adjust all BGM gain nodes
        const target = this._bgmVolume * (0.5 + level * 1.0);
        const ctx = this._ctx;
        if (!ctx) return;
        const now = ctx.currentTime;
        this._bgm.gains.forEach(g => {
            try {
                g.gain.cancelScheduledValues(now);
                g.gain.linearRampToValueAtTime(target, now + 0.3);
            } catch { }
        });
    }

    // ── BGM Theme: Lobby (Chill Lo-fi) ──
    private _bgmLobby(ctx: AudioContext): void {
        const vol = this._bgmVolume;
        const notes = [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.B4, NOTE.G4, NOTE.E4, NOTE.C4, NOTE.G3];
        const beatDur = 60 / 85; // BPM 85
        let noteIdx = 0;

        const masterGain = ctx.createGain();
        masterGain.gain.value = vol;
        masterGain.connect(ctx.destination);
        this._bgm.gains.push(masterGain);

        const playNote = () => {
            if (this._bgm.theme !== 'lobby') return;
            const now = ctx.currentTime;
            const freq = notes[noteIdx % notes.length];
            noteIdx++;

            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(masterGain); o.type = 'sine';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.6, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 0.9);
            o.start(now); o.stop(now + beatDur);
            this._bgm.nodes.push(o);

            // Soft pad layer
            const pad = ctx.createOscillator(); const pg = ctx.createGain();
            pad.connect(pg); pg.connect(masterGain); pad.type = 'sine';
            pad.frequency.value = freq / 2;
            pg.gain.setValueAtTime(0.3, now);
            pg.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 1.5);
            pad.start(now); pad.stop(now + beatDur * 1.5);
            this._bgm.nodes.push(pad);
        };

        playNote();
        this._bgm.interval = setInterval(playNote, beatDur * 1000);
    }

    // ── BGM Theme: Memory (Music Box) ──
    private _bgmMemory(ctx: AudioContext): void {
        const vol = this._bgmVolume;
        const melody = [NOTE.F4, NOTE.A4, NOTE.C5, NOTE.F5, NOTE.C5, NOTE.A4, NOTE.F4, NOTE.C4,
        NOTE.F4, NOTE.A4, NOTE.C5, NOTE.E5, NOTE.C5, NOTE.A4, NOTE.G4, NOTE.F4];
        const beatDur = 60 / 100; // BPM 100
        let noteIdx = 0;

        const masterGain = ctx.createGain();
        masterGain.gain.value = vol;
        masterGain.connect(ctx.destination);
        this._bgm.gains.push(masterGain);

        const playNote = () => {
            if (this._bgm.theme !== 'memory') return;
            const now = ctx.currentTime;
            const freq = melody[noteIdx % melody.length];
            noteIdx++;

            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(masterGain); o.type = 'triangle';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.5, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 0.7);
            o.start(now); o.stop(now + beatDur * 0.8);
            this._bgm.nodes.push(o);
        };

        playNote();
        this._bgm.interval = setInterval(playNote, beatDur * 1000);
    }

    // ── BGM Theme: Falling (Upbeat Chiptune) ──
    private _bgmFalling(ctx: AudioContext): void {
        const vol = this._bgmVolume;
        const bassLine = [NOTE.A3, NOTE.A3, NOTE.C4, NOTE.C4, NOTE.E3, NOTE.E3, NOTE.G3, NOTE.G3];
        const lead = [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.C5, NOTE.A4];
        let beatDur = 60 / 140; // BPM 140
        let noteIdx = 0;

        const masterGain = ctx.createGain();
        masterGain.gain.value = vol;
        masterGain.connect(ctx.destination);
        this._bgm.gains.push(masterGain);

        const playBeat = () => {
            if (this._bgm.theme !== 'falling' && this._bgm.theme !== 'fever') return;
            const now = ctx.currentTime;
            const idx = noteIdx % bassLine.length;
            noteIdx++;

            // Bass
            const b = ctx.createOscillator(); const bg = ctx.createGain();
            b.connect(bg); bg.connect(masterGain); b.type = 'square';
            b.frequency.value = bassLine[idx];
            bg.gain.setValueAtTime(0.4, now); bg.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 0.8);
            b.start(now); b.stop(now + beatDur);
            this._bgm.nodes.push(b);

            // Lead (every other beat)
            if (idx % 2 === 0) {
                const l = ctx.createOscillator(); const lg = ctx.createGain();
                l.connect(lg); lg.connect(masterGain); l.type = 'sawtooth';
                l.frequency.value = lead[idx];
                lg.gain.setValueAtTime(0.25, now); lg.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 1.5);
                l.start(now); l.stop(now + beatDur * 1.5);
                this._bgm.nodes.push(l);
            }

            // Hi-hat (noise)
            const hatBuf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
            const hd = hatBuf.getChannelData(0);
            for (let i = 0; i < hd.length; i++) hd[i] = (Math.random() * 2 - 1);
            const hat = ctx.createBufferSource(); hat.buffer = hatBuf;
            const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 8000;
            const hg = ctx.createGain();
            hat.connect(hf); hf.connect(hg); hg.connect(masterGain);
            hg.gain.setValueAtTime(0.3, now); hg.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
            hat.start(now); hat.stop(now + 0.02);
        };

        playBeat();
        this._bgm.interval = setInterval(playBeat, beatDur * 1000);
    }

    // ── BGM Theme: Predict (Tense Ambient) ──
    private _bgmPredict(ctx: AudioContext): void {
        const vol = this._bgmVolume;
        const beatDur = 60 / 70; // BPM 70

        const masterGain = ctx.createGain();
        masterGain.gain.value = vol;
        masterGain.connect(ctx.destination);
        this._bgm.gains.push(masterGain);

        // Low drone
        const drone = ctx.createOscillator(); const dg = ctx.createGain();
        drone.connect(dg); dg.connect(masterGain); drone.type = 'sine';
        drone.frequency.value = 55; // Low A
        dg.gain.value = 0.5;
        drone.start();
        this._bgm.nodes.push(drone);
        this._bgm.gains.push(dg);

        // Tick-tock percussion
        let tick = true;
        const playTick = () => {
            if (this._bgm.theme !== 'predict') return;
            const now = ctx.currentTime;
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(masterGain);
            o.type = 'sine';
            o.frequency.value = tick ? 800 : 600;
            tick = !tick;
            g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            o.start(now); o.stop(now + 0.04);
            this._bgm.nodes.push(o);
        };

        playTick();
        this._bgm.interval = setInterval(playTick, beatDur * 500);
    }

    // ── BGM Theme: Fever (High Energy overlay) ──
    private _bgmFever(ctx: AudioContext): void {
        // Start falling BGM at higher intensity first
        this._bgmFalling(ctx);

        const vol = this._bgmVolume;
        const arpNotes = [NOTE.E5, NOTE.G5, NOTE.B5, NOTE.E6, NOTE.B5, NOTE.G5];
        let arpIdx = 0;
        const beatDur = 60 / 160; // BPM 160

        const feverGain = ctx.createGain();
        feverGain.gain.value = vol * 1.5;
        feverGain.connect(ctx.destination);
        this._bgm.gains.push(feverGain);

        const existingInterval = this._bgm.interval;
        // Override the interval with fever tempo
        if (existingInterval) clearInterval(existingInterval);

        const playArp = () => {
            if (this._bgm.theme !== 'fever') return;
            const now = ctx.currentTime;
            const freq = arpNotes[arpIdx % arpNotes.length];
            arpIdx++;

            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(feverGain); o.type = 'triangle';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.6, now); g.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 0.6);
            o.start(now); o.stop(now + beatDur * 0.7);
            this._bgm.nodes.push(o);
        };

        playArp();
        this._bgm.interval = setInterval(playArp, beatDur * 1000);
    }

    // ── BGM Theme: Tower (Tense Ascending) ──
    private _bgmTower(ctx: AudioContext): void {
        const vol = this._bgmVolume;
        const notes = [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4, NOTE.C4, NOTE.E4, NOTE.G4, NOTE.A4];
        const beatDur = 60 / 110;
        let noteIdx = 0;
        const masterGain = ctx.createGain();
        masterGain.gain.value = vol; masterGain.connect(ctx.destination);
        this._bgm.gains.push(masterGain);
        const playNote = () => {
            if (this._bgm.theme !== 'tower') return;
            const now = ctx.currentTime;
            const freq = notes[noteIdx % notes.length]; noteIdx++;
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(masterGain); o.type = 'triangle';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 0.8);
            o.start(now); o.stop(now + beatDur);
            this._bgm.nodes.push(o);
        };
        playNote();
        this._bgm.interval = setInterval(playNote, beatDur * 1000);
    }

    // ── BGM Theme: Mine (Suspenseful Ambient) ──
    private _bgmMine(ctx: AudioContext): void {
        const vol = this._bgmVolume;
        const masterGain = ctx.createGain();
        masterGain.gain.value = vol; masterGain.connect(ctx.destination);
        this._bgm.gains.push(masterGain);
        const drone = ctx.createOscillator(); const dg = ctx.createGain();
        drone.connect(dg); dg.connect(masterGain); drone.type = 'sine';
        drone.frequency.value = 65; dg.gain.value = 0.4;
        drone.start(); this._bgm.nodes.push(drone); this._bgm.gains.push(dg);
        const notes = [NOTE.E4, NOTE.G4, NOTE.A4, NOTE.B4, NOTE.A4, NOTE.G4];
        let idx = 0;
        const beatDur = 60 / 60;
        const play = () => {
            if (this._bgm.theme !== 'mine') return;
            const now = ctx.currentTime;
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(masterGain); o.type = 'sine';
            o.frequency.value = notes[idx % notes.length]; idx++;
            g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 0.9);
            o.start(now); o.stop(now + beatDur);
            this._bgm.nodes.push(o);
        };
        play();
        this._bgm.interval = setInterval(play, beatDur * 1000);
    }

    // ── BGM Theme: Flappy (Chiptune) ──
    private _bgmFlappy(ctx: AudioContext): void {
        const vol = this._bgmVolume;
        const melody = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.G4];
        const beatDur = 60 / 150;
        let idx = 0;
        const masterGain = ctx.createGain();
        masterGain.gain.value = vol; masterGain.connect(ctx.destination);
        this._bgm.gains.push(masterGain);
        const play = () => {
            if (this._bgm.theme !== 'flappy') return;
            const now = ctx.currentTime;
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(masterGain); o.type = 'square';
            o.frequency.value = melody[idx % melody.length]; idx++;
            g.gain.setValueAtTime(0.35, now); g.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 0.6);
            o.start(now); o.stop(now + beatDur * 0.7);
            this._bgm.nodes.push(o);
        };
        play();
        this._bgm.interval = setInterval(play, beatDur * 1000);
    }

    // ── BGM Theme: Slots (Casino Lounge) ──
    private _bgmSlots(ctx: AudioContext): void {
        const vol = this._bgmVolume;
        const notes = [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.A4, NOTE.G4, NOTE.E4];
        const beatDur = 60 / 120;
        let idx = 0;
        const masterGain = ctx.createGain();
        masterGain.gain.value = vol; masterGain.connect(ctx.destination);
        this._bgm.gains.push(masterGain);
        const play = () => {
            if (this._bgm.theme !== 'slots') return;
            const now = ctx.currentTime;
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(masterGain); o.type = 'sine';
            o.frequency.value = notes[idx % notes.length]; idx++;
            g.gain.setValueAtTime(0.4, now); g.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 0.8);
            o.start(now); o.stop(now + beatDur);
            this._bgm.nodes.push(o);
            // Soft bass
            const b = ctx.createOscillator(); const bg = ctx.createGain();
            b.connect(bg); bg.connect(masterGain); b.type = 'sine';
            b.frequency.value = notes[idx % notes.length] / 2;
            bg.gain.setValueAtTime(0.2, now); bg.gain.exponentialRampToValueAtTime(0.01, now + beatDur);
            b.start(now); b.stop(now + beatDur);
            this._bgm.nodes.push(b);
        };
        play();
        this._bgm.interval = setInterval(play, beatDur * 1000);
    }

    // ── BGM Theme: Crash (Building Tension) ──
    private _bgmCrash(ctx: AudioContext): void {
        const vol = this._bgmVolume;
        const masterGain = ctx.createGain();
        masterGain.gain.value = vol; masterGain.connect(ctx.destination);
        this._bgm.gains.push(masterGain);
        // Rising drone
        const drone = ctx.createOscillator(); const dg = ctx.createGain();
        drone.connect(dg); dg.connect(masterGain); drone.type = 'sawtooth';
        drone.frequency.value = 40; dg.gain.value = 0.25;
        drone.start(); this._bgm.nodes.push(drone); this._bgm.gains.push(dg);
        // Pulse
        let beat = true;
        const beatDur = 60 / 130;
        const play = () => {
            if (this._bgm.theme !== 'crash') return;
            const now = ctx.currentTime;
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(masterGain); o.type = 'sine';
            o.frequency.value = beat ? 220 : 165; beat = !beat;
            g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.01, now + beatDur * 0.4);
            o.start(now); o.stop(now + beatDur * 0.5);
            this._bgm.nodes.push(o);
        };
        play();
        this._bgm.interval = setInterval(play, beatDur * 1000);
    }
}

// ─── Singleton ──────────────────────────────────────────────────────────────
export const GameAudio = new GameAudioEngine();
export type { SFXType, BGMTheme };
