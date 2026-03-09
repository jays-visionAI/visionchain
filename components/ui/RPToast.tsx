import { createSignal, For, onMount, onCleanup, Show } from 'solid-js';

/**
 * RP Toast Notification System
 * 
 * Event-driven: any code can call showRPToast() to display a toast.
 * addRewardPoints in firebaseService.ts fires this after successful RP award.
 * 
 * Usage:
 *   import { showRPToast } from './RPToast';
 *   showRPToast(10, 'staking_deposit', 'Staked VCN');
 * 
 * Mount <RPToastContainer /> once at the app root level.
 */

// ── Toast Event Bus ──

interface RPToastEvent {
    id: number;
    amount: number;
    type: string;
    label: string;
    visible: boolean;
}

let _toastId = 0;
const _listeners: Array<(event: RPToastEvent) => void> = [];

const ACTION_LABELS: Record<string, string> = {
    daily_login: 'Daily Login',
    disk_upload: 'File Uploaded',
    disk_download: 'File Downloaded',
    transfer_send: 'VCN Sent',
    staking_deposit: 'Staked VCN',
    profile_update: 'Profile Updated',
    ai_chat: 'AI Chat',
    cex_connect: 'CEX Connected',
    quant_strategy_setup: 'Quant Strategy Created',
    market_publish: 'Published to Market',
    market_purchase: 'Market Purchase',
    agent_create: 'Agent Created',
    referral: 'Referral Reward',
    levelup: 'Level Up!',
    mobile_node_daily: 'Node Reward',
    referral_tier1_rp: 'Referral Bonus',
    referral_tier2_rp: 'Referral Bonus',
};

/**
 * Show an RP toast notification.
 * Call this from anywhere -- no context needed.
 */
export function showRPToast(amount: number, type: string, source?: string) {
    if (amount <= 0) return;
    const event: RPToastEvent = {
        id: ++_toastId,
        amount,
        type,
        label: source || ACTION_LABELS[type] || type,
        visible: true,
    };
    _listeners.forEach(fn => fn(event));
}

function subscribe(fn: (event: RPToastEvent) => void) {
    _listeners.push(fn);
    return () => {
        const idx = _listeners.indexOf(fn);
        if (idx >= 0) _listeners.splice(idx, 1);
    };
}

// ── Toast UI Component ──

const TOAST_DURATION = 2500; // ms visible
const TOAST_ANIMATION = 400; // ms for enter/exit

export function RPToastContainer() {
    const [toasts, setToasts] = createSignal<RPToastEvent[]>([]);

    onMount(() => {
        const unsub = subscribe((event) => {
            setToasts(prev => [...prev.slice(-2), event]); // max 3 stacked

            // Start exit after duration
            setTimeout(() => {
                setToasts(prev => prev.map(t =>
                    t.id === event.id ? { ...t, visible: false } : t
                ));
                // Remove from DOM after exit animation
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== event.id));
                }, TOAST_ANIMATION);
            }, TOAST_DURATION);
        });

        onCleanup(unsub);
    });

    const actionColor = (type: string) => {
        const map: Record<string, string> = {
            daily_login: '#22c55e',
            staking_deposit: '#a855f7',
            transfer_send: '#f59e0b',
            cex_connect: '#f97316',
            quant_strategy_setup: '#6366f1',
            disk_upload: '#3b82f6',
            ai_chat: '#06b6d4',
            market_publish: '#ec4899',
            market_purchase: '#f43f5e',
            agent_create: '#14b8a6',
            referral: '#10b981',
            referral_tier1_rp: '#34d399',
            referral_tier2_rp: '#6ee7b7',
            levelup: '#eab308',
            mobile_node_daily: '#8b5cf6',
        };
        return map[type] || '#06b6d4';
    };

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                'z-index': '99999',
                display: 'flex',
                'flex-direction': 'column-reverse',
                gap: '8px',
                'pointer-events': 'none',
            }}
        >
            <For each={toasts()}>
                {(toast) => {
                    const color = actionColor(toast.type);
                    return (
                        <div
                            style={{
                                'pointer-events': 'auto',
                                'min-width': '220px',
                                'max-width': '320px',
                                padding: '12px 16px',
                                background: 'rgba(10, 10, 20, 0.92)',
                                'backdrop-filter': 'blur(16px)',
                                '-webkit-backdrop-filter': 'blur(16px)',
                                border: `1px solid ${color}33`,
                                'border-radius': '14px',
                                'box-shadow': `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}15`,
                                display: 'flex',
                                'align-items': 'center',
                                gap: '12px',
                                cursor: 'default',
                                transition: `all ${TOAST_ANIMATION}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                                transform: toast.visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.95)',
                                opacity: toast.visible ? '1' : '0',
                            }}
                        >
                            {/* RP Icon */}
                            <div
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    'border-radius': '10px',
                                    background: `${color}15`,
                                    border: `1px solid ${color}30`,
                                    display: 'flex',
                                    'align-items': 'center',
                                    'justify-content': 'center',
                                    'flex-shrink': '0',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                    <polyline points="17 6 23 6 23 12" />
                                </svg>
                            </div>

                            {/* Content */}
                            <div style={{ flex: '1', 'min-width': '0' }}>
                                <div style={{
                                    display: 'flex',
                                    'align-items': 'baseline',
                                    gap: '6px',
                                    'margin-bottom': '2px',
                                }}>
                                    <span style={{
                                        'font-size': '18px',
                                        'font-weight': '900',
                                        color: color,
                                        'letter-spacing': '-0.5px',
                                    }}>
                                        +{toast.amount}
                                    </span>
                                    <span style={{
                                        'font-size': '11px',
                                        'font-weight': '800',
                                        color: 'rgba(255,255,255,0.5)',
                                        'text-transform': 'uppercase',
                                        'letter-spacing': '0.5px',
                                    }}>
                                        RP
                                    </span>
                                </div>
                                <div style={{
                                    'font-size': '11px',
                                    'font-weight': '600',
                                    color: 'rgba(255,255,255,0.45)',
                                    'white-space': 'nowrap',
                                    overflow: 'hidden',
                                    'text-overflow': 'ellipsis',
                                }}>
                                    {toast.label}
                                </div>
                            </div>

                            {/* Accent line */}
                            <div style={{
                                width: '3px',
                                height: '28px',
                                'border-radius': '2px',
                                background: `linear-gradient(to bottom, ${color}, transparent)`,
                                'flex-shrink': '0',
                                opacity: '0.6',
                            }} />
                        </div>
                    );
                }}
            </For>
        </div>
    );
}
