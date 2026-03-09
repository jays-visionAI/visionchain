import { createSignal, Show, onMount, onCleanup } from 'solid-js';

/**
 * Milestone Celebration Modal
 * 
 * Event-driven: call showMilestone() from anywhere.
 * Displays a fullscreen celebration overlay when users hit RP milestones.
 * 
 * Usage:
 *   import { showMilestone } from './MilestoneModal';
 *   showMilestone(1000, 'rp', 'You reached 1,000 RP!');
 */

// ── Milestone Event Bus ──

interface MilestoneEvent {
    value: number;
    type: 'rp' | 'streak';
    message: string;
    bonus?: number;
}

const _milestoneListeners: Array<(event: MilestoneEvent) => void> = [];

export function showMilestone(value: number, type: 'rp' | 'streak', message: string, bonus?: number) {
    const event: MilestoneEvent = { value, type, message, bonus };
    _milestoneListeners.forEach(fn => fn(event));
}

function subscribeMilestone(fn: (event: MilestoneEvent) => void) {
    _milestoneListeners.push(fn);
    return () => {
        const idx = _milestoneListeners.indexOf(fn);
        if (idx >= 0) _milestoneListeners.splice(idx, 1);
    };
}

// ── Confetti Particles ──

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
}

function createParticles(count: number): Particle[] {
    const colors = ['#06b6d4', '#a855f7', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#f43f5e', '#eab308'];
    return Array.from({ length: count }, () => ({
        x: Math.random() * 100,
        y: -10 - Math.random() * 30,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 1,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
    }));
}

// ── Modal Component ──

export function MilestoneModal() {
    const [active, setActive] = createSignal<MilestoneEvent | null>(null);
    const [particles, setParticles] = createSignal<Particle[]>([]);
    const [entering, setEntering] = createSignal(false);
    let animFrame: number | null = null;

    onMount(() => {
        const unsub = subscribeMilestone((event) => {
            setActive(event);
            setParticles(createParticles(60));
            setEntering(true);

            // Animate confetti
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                setParticles(prev => prev.map(p => ({
                    ...p,
                    x: p.x + p.vx * 0.3,
                    y: p.y + p.vy * 0.5,
                    rotation: p.rotation + p.rotationSpeed,
                    opacity: Math.max(0, 1 - (elapsed / 4000)),
                })).filter(p => p.y < 110 && p.opacity > 0));

                if (elapsed < 4000) {
                    animFrame = requestAnimationFrame(animate);
                }
            };
            animFrame = requestAnimationFrame(animate);

            // Auto-dismiss after 5s
            setTimeout(() => {
                setEntering(false);
                setTimeout(() => setActive(null), 400);
            }, 5000);
        });

        onCleanup(() => {
            unsub();
            if (animFrame) cancelAnimationFrame(animFrame);
        });
    });

    const milestoneIcon = (type: string) => {
        if (type === 'streak') {
            // Flame SVG
            return (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
            );
        }
        // Trophy SVG
        return (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" /><path d="M10 22V10" /><path d="M14 22V10" />
                <path d="M8 6h8a2 2 0 0 1 2 2v2a6 6 0 0 1-12 0V8a2 2 0 0 1 2-2z" />
            </svg>
        );
    };

    const gradientColor = () => active()?.type === 'streak' ? '#f59e0b' : '#06b6d4';

    return (
        <Show when={active()}>
            {(event) => (
                <div
                    style={{
                        position: 'fixed',
                        inset: '0',
                        'z-index': '100000',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        background: 'rgba(0, 0, 0, 0.85)',
                        'backdrop-filter': 'blur(12px)',
                        transition: `opacity 400ms ease`,
                        opacity: entering() ? '1' : '0',
                        cursor: 'pointer',
                    }}
                    onClick={() => {
                        setEntering(false);
                        setTimeout(() => setActive(null), 400);
                    }}
                >
                    {/* Confetti */}
                    {particles().map(p => (
                        <div
                            style={{
                                position: 'absolute',
                                left: `${p.x}%`,
                                top: `${p.y}%`,
                                width: `${p.size}px`,
                                height: `${p.size}px`,
                                background: p.color,
                                'border-radius': Math.random() > 0.5 ? '50%' : '2px',
                                transform: `rotate(${p.rotation}deg)`,
                                opacity: String(p.opacity),
                                'pointer-events': 'none',
                            }}
                        />
                    ))}

                    {/* Glow ring */}
                    <div
                        style={{
                            position: 'absolute',
                            width: '300px',
                            height: '300px',
                            'border-radius': '50%',
                            background: `radial-gradient(circle, ${gradientColor()}15 0%, transparent 70%)`,
                            animation: 'milestone-pulse 2s ease-in-out infinite',
                        }}
                    />

                    {/* Content */}
                    <div
                        style={{
                            position: 'relative',
                            'text-align': 'center',
                            'max-width': '360px',
                            padding: '0 24px',
                            transition: `all 500ms cubic-bezier(0.16, 1, 0.3, 1)`,
                            transform: entering() ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.9)',
                        }}
                    >
                        {/* Icon */}
                        <div
                            style={{
                                width: '88px',
                                height: '88px',
                                margin: '0 auto 20px',
                                'border-radius': '50%',
                                background: `${gradientColor()}10`,
                                border: `2px solid ${gradientColor()}30`,
                                display: 'flex',
                                'align-items': 'center',
                                'justify-content': 'center',
                                'box-shadow': `0 0 40px ${gradientColor()}20`,
                            }}
                        >
                            {milestoneIcon(event().type)}
                        </div>

                        {/* Label */}
                        <div
                            style={{
                                'font-size': '10px',
                                'font-weight': '900',
                                color: gradientColor(),
                                'text-transform': 'uppercase',
                                'letter-spacing': '3px',
                                'margin-bottom': '8px',
                            }}
                        >
                            {event().type === 'streak' ? 'Streak Milestone' : 'RP Milestone'}
                        </div>

                        {/* Value */}
                        <div
                            style={{
                                'font-size': '56px',
                                'font-weight': '900',
                                color: '#ffffff',
                                'letter-spacing': '-2px',
                                'line-height': '1',
                                'margin-bottom': '8px',
                            }}
                        >
                            {event().type === 'streak'
                                ? `${event().value} Days`
                                : event().value.toLocaleString()
                            }
                        </div>

                        {/* Message */}
                        <div
                            style={{
                                'font-size': '14px',
                                'font-weight': '600',
                                color: 'rgba(255,255,255,0.6)',
                                'margin-bottom': '16px',
                            }}
                        >
                            {event().message}
                        </div>

                        {/* Bonus badge */}
                        <Show when={event().bonus}>
                            <div
                                style={{
                                    display: 'inline-flex',
                                    'align-items': 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    background: `${gradientColor()}15`,
                                    border: `1px solid ${gradientColor()}30`,
                                    'border-radius': '12px',
                                    'margin-bottom': '20px',
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={gradientColor()} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                    <polyline points="17 6 23 6 23 12" />
                                </svg>
                                <span style={{ 'font-size': '14px', 'font-weight': '800', color: gradientColor() }}>
                                    +{event().bonus} Bonus RP
                                </span>
                            </div>
                        </Show>

                        {/* Dismiss hint */}
                        <div
                            style={{
                                'font-size': '10px',
                                color: 'rgba(255,255,255,0.2)',
                                'margin-top': '12px',
                            }}
                        >
                            Tap anywhere to dismiss
                        </div>
                    </div>
                </div>
            )}
        </Show>
    );
}

// CSS Keyframes injection (runs once)
if (typeof document !== 'undefined') {
    const styleId = 'milestone-modal-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes milestone-pulse {
                0%, 100% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.15); opacity: 0.8; }
            }
        `;
        document.head.appendChild(style);
    }
}
