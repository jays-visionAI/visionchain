/**
 * UserTradePanel - Direct Buy/Sell Trading for logged-in users
 *
 * Features:
 * - Market and Limit order types
 * - Real-time balance display
 * - % presets (25/50/75/100%)
 * - Order cost estimation
 * - Success/error feedback
 * - Disableable via DIRECT_TRADING_DISABLED flag
 */
import { createSignal, createEffect, onMount, Show, onCleanup } from 'solid-js';
import { getFirebaseAuth } from '../services/firebaseService';

// ══════════════════════════════════════════════════════════════════════════
// ★ FEATURE FLAG: Set to true to disable direct trading (show Coming Soon)
// ══════════════════════════════════════════════════════════════════════════
const DIRECT_TRADING_DISABLED = true;

// ─── API ────────────────────────────────────────────────────────────────

function getApiUrl() {
    if (window.location.hostname.includes('staging') || window.location.hostname === 'localhost') {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/tradingArenaAPI';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/tradingArenaAPI';
}

async function tradeApi(action: string, body: Record<string, any> = {}) {
    const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
    });
    return res.json();
}

// ─── SVG Icons ──────────────────────────────────────────────────────────

const WalletIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="3" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.2" />
        <path d="M1 5h12" stroke="currentColor" stroke-width="1.2" />
        <circle cx="10" cy="8" r="1" fill="currentColor" />
    </svg>
);
const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
);
const AlertIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2L1 12h12L7 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
        <path d="M7 6v3M7 10.5v.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </svg>
);
const LockIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.5" />
        <path d="M7 9V7a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="10" cy="13.5" r="1.2" fill="currentColor" />
    </svg>
);
const BotIcon = () => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <rect x="3" y="4" width="8" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2" />
        <circle cx="5.5" cy="7.5" r="0.8" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r="0.8" fill="currentColor" />
        <path d="M7 1.5v2.5M5 4V3M9 4V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </svg>
);

// ─── Component ──────────────────────────────────────────────────────────

export default function UserTradePanel(props: { market: any; onSwitchToAgent?: () => void }) {
    const [uid, setUid] = createSignal<string | null>(null);
    const [balance, setBalance] = createSignal<{ USDT: number; VCN: number } | null>(null);
    const [orderSide, setOrderSide] = createSignal<'buy' | 'sell'>('buy');
    const [orderType, setOrderType] = createSignal<'market' | 'limit'>('market');
    const [amount, setAmount] = createSignal('');
    const [limitPrice, setLimitPrice] = createSignal('');
    const [submitting, setSubmitting] = createSignal(false);
    const [feedback, setFeedback] = createSignal<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [loading, setLoading] = createSignal(true);

    // Auth
    onMount(() => {
        try {
            const auth = getFirebaseAuth();
            const unsub = auth.onAuthStateChanged((user: any) => {
                setUid(user?.uid || null);
                if (user?.uid) loadBalance(user.uid);
                else setLoading(false);
            });
            onCleanup(() => unsub());
        } catch {
            setLoading(false);
        }
    });

    async function loadBalance(userUid: string) {
        try {
            const res = await tradeApi('getUserDexBalance', { uid: userUid });
            if (res.success) {
                setBalance({ USDT: res.USDT, VCN: res.VCN });
            }
        } catch (e) {
            console.warn('[UserTradePanel] balance load err:', e);
        }
        setLoading(false);
    }

    // Current price from market data
    const currentPrice = () => props.market?.lastPrice || 0.10;
    const bestBid = () => props.market?.bestBid || currentPrice();
    const bestAsk = () => props.market?.bestAsk || currentPrice();

    // Compute max amount based on balance and side
    const maxAmount = () => {
        const bal = balance();
        if (!bal) return 0;
        if (orderSide() === 'buy') {
            const price = orderType() === 'limit' && parseFloat(limitPrice())
                ? parseFloat(limitPrice())
                : bestAsk();
            return Math.floor(bal.USDT / (price * 1.0005)); // account for fee
        }
        return Math.floor(bal.VCN);
    };

    // Set amount to a % of max
    function setPercent(pct: number) {
        const max = maxAmount();
        const val = Math.floor(max * pct / 100);
        setAmount(val > 0 ? val.toString() : '');
    }

    // Estimated cost/proceeds
    const estimatedTotal = () => {
        const amt = parseFloat(amount());
        if (!amt) return 0;
        const price = orderType() === 'limit' && parseFloat(limitPrice())
            ? parseFloat(limitPrice())
            : orderSide() === 'buy' ? bestAsk() : bestBid();
        return amt * price;
    };

    const estimatedFee = () => estimatedTotal() * 0.0005; // taker fee

    // Submit order
    async function submitOrder() {
        const u = uid();
        if (!u) return;
        const amt = parseFloat(amount());
        if (!amt || amt < 100) {
            setFeedback({ type: 'error', msg: 'Minimum order is 100 VCN' });
            return;
        }
        if (orderType() === 'limit' && (!parseFloat(limitPrice()) || parseFloat(limitPrice()) <= 0)) {
            setFeedback({ type: 'error', msg: 'Enter a valid limit price' });
            return;
        }

        setSubmitting(true);
        setFeedback(null);
        try {
            const res = await tradeApi('placeUserOrder', {
                uid: u,
                side: orderSide(),
                orderType: orderType(),
                amount: amt,
                price: orderType() === 'limit' ? parseFloat(limitPrice()) : 0,
            });
            if (res.success) {
                if (res.balance) setBalance(res.balance);
                const priceStr = res.price ? res.price.toFixed(4) : limitPrice();
                const fillAmt = res.amount || amt;
                if (res.status === 'pending') {
                    setFeedback({ type: 'success', msg: `Limit order placed: ${fillAmt.toLocaleString()} VCN @ ${priceStr}` });
                } else {
                    setFeedback({
                        type: 'success',
                        msg: `${orderSide() === 'buy' ? 'Bought' : 'Sold'} ${fillAmt.toLocaleString()} VCN @ ${priceStr} ($${res.total?.toFixed(2) || ''})`
                    });
                }
                setAmount('');
                setLimitPrice('');
            } else {
                setFeedback({ type: 'error', msg: res.error || 'Order failed' });
            }
        } catch (e: any) {
            setFeedback({ type: 'error', msg: e.message || 'Network error' });
        }
        setSubmitting(false);

        // Clear feedback after 5s
        setTimeout(() => setFeedback(null), 5000);
    }

    // Auto-clear feedback
    const clearFb = () => setTimeout(() => setFeedback(null), 5000);

    // ── Disabled View ──
    if (DIRECT_TRADING_DISABLED) {
        return (
            <div class="utp-disabled">
                <div class="utp-disabled-inner">
                    <LockIcon />
                    <span class="utp-disabled-title">Direct Trading</span>
                    <span class="utp-disabled-badge">Coming Soon</span>
                    <p class="utp-disabled-desc">
                        Direct buy/sell trading is under development. Use AI Agents to trade automatically.
                    </p>
                    <Show when={props.onSwitchToAgent}>
                        <button class="utp-switch-btn" onClick={props.onSwitchToAgent}>
                            <BotIcon /> Switch to AI Agent
                        </button>
                    </Show>
                </div>
                {/* Show the dimmed UI preview behind */}
                <div class="utp-dimmed-preview">
                    <div class="rs-order-tabs">
                        <button class="rs-order-tab active buy">Buy</button>
                        <button class="rs-order-tab">Sell</button>
                    </div>
                    <div class="rs-type-tabs">
                        <button class="rs-type-tab active">Market</button>
                        <button class="rs-type-tab">Limit</button>
                    </div>
                    <div class="rs-order-form">
                        <div class="rs-input-group">
                            <label>Amount</label>
                            <div class="rs-input-wrapper">
                                <input type="text" placeholder="0.0" class="rs-input" disabled />
                                <span class="rs-input-suffix">VCN</span>
                            </div>
                        </div>
                        <div class="rs-presets">
                            <button class="rs-preset" disabled>25%</button>
                            <button class="rs-preset" disabled>50%</button>
                            <button class="rs-preset" disabled>75%</button>
                            <button class="rs-preset" disabled>100%</button>
                        </div>
                        <button class="rs-submit-btn buy" disabled>Buy VCN</button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Not Logged In ──
    if (!uid()) {
        return (
            <div class="utp-login-required">
                <WalletIcon />
                <p>Login to start trading</p>
                <a href="/wallet" class="utp-login-btn">Go to Wallet</a>
            </div>
        );
    }

    // ── Main Trading Panel ──
    return (
        <div class="utp-container">
            {/* Balance Display */}
            <div class="utp-balance">
                <div class="utp-bal-row">
                    <span class="utp-bal-label"><WalletIcon /> USDT</span>
                    <span class="utp-bal-val">{balance()?.USDT?.toFixed(2) || '---'}</span>
                </div>
                <div class="utp-bal-row">
                    <span class="utp-bal-label"><WalletIcon /> VCN</span>
                    <span class="utp-bal-val">{balance()?.VCN?.toLocaleString() || '---'}</span>
                </div>
            </div>

            {/* Buy / Sell Toggle */}
            <div class="rs-order-tabs">
                <button
                    class={`rs-order-tab ${orderSide() === 'buy' ? 'active buy' : ''}`}
                    onClick={() => { setOrderSide('buy'); setAmount(''); }}
                >Buy</button>
                <button
                    class={`rs-order-tab ${orderSide() === 'sell' ? 'active sell' : ''}`}
                    onClick={() => { setOrderSide('sell'); setAmount(''); }}
                >Sell</button>
            </div>

            {/* Order Type Tabs */}
            <div class="rs-type-tabs">
                <button
                    class={`rs-type-tab ${orderType() === 'market' ? 'active' : ''}`}
                    onClick={() => setOrderType('market')}
                >Market</button>
                <button
                    class={`rs-type-tab ${orderType() === 'limit' ? 'active' : ''}`}
                    onClick={() => setOrderType('limit')}
                >Limit</button>
            </div>

            {/* Order Form */}
            <div class="rs-order-form">
                {/* Limit Price Input */}
                <Show when={orderType() === 'limit'}>
                    <div class="rs-input-group">
                        <label>Price</label>
                        <div class="rs-input-wrapper">
                            <input
                                type="text"
                                placeholder={currentPrice().toFixed(4)}
                                value={limitPrice()}
                                onInput={(e) => setLimitPrice(e.currentTarget.value)}
                                class="rs-input"
                            />
                            <span class="rs-input-suffix">USDT</span>
                        </div>
                    </div>
                </Show>

                {/* Amount Input */}
                <div class="rs-input-group">
                    <div class="utp-amount-header">
                        <label>Amount</label>
                        <span class="utp-max-label" onClick={() => setPercent(100)}>
                            Max: {maxAmount().toLocaleString()} VCN
                        </span>
                    </div>
                    <div class="rs-input-wrapper">
                        <input
                            type="text"
                            placeholder="0"
                            value={amount()}
                            onInput={(e) => setAmount(e.currentTarget.value.replace(/[^0-9.]/g, ''))}
                            class="rs-input"
                        />
                        <span class="rs-input-suffix">VCN</span>
                    </div>
                </div>

                {/* Percent Presets */}
                <div class="rs-presets">
                    <button class="rs-preset" onClick={() => setPercent(25)}>25%</button>
                    <button class="rs-preset" onClick={() => setPercent(50)}>50%</button>
                    <button class="rs-preset" onClick={() => setPercent(75)}>75%</button>
                    <button class="rs-preset" onClick={() => setPercent(100)}>100%</button>
                </div>

                {/* Estimated Cost */}
                <Show when={parseFloat(amount()) > 0}>
                    <div class="utp-estimate">
                        <div class="utp-est-row">
                            <span>{orderSide() === 'buy' ? 'Cost' : 'Proceeds'}</span>
                            <span>{estimatedTotal().toFixed(2)} USDT</span>
                        </div>
                        <div class="utp-est-row sub">
                            <span>Fee (0.05%)</span>
                            <span>{estimatedFee().toFixed(4)} USDT</span>
                        </div>
                    </div>
                </Show>

                {/* Submit Button */}
                <button
                    class={`rs-submit-btn ${orderSide()}`}
                    onClick={submitOrder}
                    disabled={submitting() || !parseFloat(amount())}
                >
                    {submitting()
                        ? 'Placing...'
                        : `${orderSide() === 'buy' ? 'Buy' : 'Sell'} VCN`
                    }
                </button>
            </div>

            {/* Feedback Toast */}
            <Show when={feedback()}>
                {(fb) => (
                    <div class={`utp-feedback ${fb().type}`}>
                        {fb().type === 'success' ? <CheckIcon /> : <AlertIcon />}
                        <span>{fb().msg}</span>
                    </div>
                )}
            </Show>
        </div>
    );
}
