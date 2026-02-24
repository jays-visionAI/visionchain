import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { getUserRole, adminLogin } from '../../services/firebaseService';

export default function MMAdminLogin() {
    const [email, setEmail] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [showPassword, setShowPassword] = createSignal(false);
    const [error, setError] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const emailVal = email().toLowerCase().trim();
        const pwdVal = password();

        try {
            await adminLogin(emailVal, pwdVal);
            const role = await getUserRole(emailVal);
            if (role === 'admin') {
                navigate('/mm-admin', { replace: true });
            } else {
                setError('Access denied. Only admin accounts can access MM Control.');
            }
        } catch (err: any) {
            console.error('MM Admin Login error:', err);
            setError('Authentication failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div class="mm-login-root">
            {/* Background effects */}
            <div class="mm-login-bg-glow" />
            <div class="mm-login-bg-grid" />
            <div class="mm-login-bg-line-top" />
            <div class="mm-login-bg-line-bottom" />

            <div class="mm-login-container">
                {/* Outer glow */}
                <div class="mm-login-glow-ring" />

                <div class="mm-login-card">
                    {/* Accent bar */}
                    <div class="mm-login-accent-bar" />

                    {/* Header */}
                    <div class="mm-login-header">
                        <div class="mm-login-icon-wrap">
                            <div class="mm-login-icon">
                                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                                    <rect x="4" y="8" width="32" height="24" rx="4" stroke="white" stroke-width="2" fill="none" />
                                    <path d="M10 20h3l2-6 3 12 3-8 2 4h3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                                    <circle cx="32" cy="12" r="4" fill="#f59e0b" stroke="white" stroke-width="1.5" />
                                </svg>
                            </div>
                            <div class="mm-login-icon-badge">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" fill="#f59e0b" />
                                </svg>
                            </div>
                        </div>

                        <h1 class="mm-login-title">
                            MM<span class="mm-login-title-accent">Control</span>
                        </h1>
                        <div class="mm-login-subtitle-wrap">
                            <div class="mm-login-hr" />
                            <span class="mm-login-subtitle">Market Maker Operations</span>
                            <div class="mm-login-hr" />
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} class="mm-login-form">
                        <div class="mm-login-fields">
                            {/* Email */}
                            <div class="mm-login-field-group">
                                <label class="mm-login-label">Operator ID</label>
                                <div class="mm-login-input-wrap">
                                    <div class="mm-login-input-icon">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5" />
                                            <path d="M2 5l6 4 6-4" stroke="currentColor" stroke-width="1.5" />
                                        </svg>
                                    </div>
                                    <input
                                        type="email"
                                        value={email()}
                                        onInput={(e) => setEmail(e.currentTarget.value)}
                                        placeholder="operator@visiondex.io"
                                        class="mm-login-input"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div class="mm-login-field-group">
                                <label class="mm-login-label">Access Key</label>
                                <div class="mm-login-input-wrap">
                                    <div class="mm-login-input-icon">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <rect x="4" y="7" width="8" height="7" rx="2" stroke="currentColor" stroke-width="1.5" />
                                            <path d="M6 7V5a2 2 0 114 0v2" stroke="currentColor" stroke-width="1.5" />
                                        </svg>
                                    </div>
                                    <input
                                        type={showPassword() ? 'text' : 'password'}
                                        value={password()}
                                        onInput={(e) => setPassword(e.currentTarget.value)}
                                        placeholder="••••••••"
                                        class="mm-login-input"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword())}
                                        class="mm-login-eye-btn"
                                    >
                                        <Show when={showPassword()} fallback={
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.5" />
                                                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5" />
                                            </svg>
                                        }>
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.5" />
                                                <path d="M3 13L13 3" stroke="currentColor" stroke-width="1.5" />
                                            </svg>
                                        </Show>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Error */}
                        <Show when={error()}>
                            <div class="mm-login-error">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <circle cx="8" cy="8" r="7" stroke="#ef4444" stroke-width="1.5" />
                                    <path d="M8 5v4M8 11h.01" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" />
                                </svg>
                                <span>{error()}</span>
                            </div>
                        </Show>

                        {/* Submit */}
                        <button type="submit" disabled={isLoading()} class="mm-login-submit">
                            <div class="mm-login-submit-shine" />
                            <div class="mm-login-submit-content">
                                <Show when={isLoading()} fallback={
                                    <>
                                        <span>Connect to MM Ops</span>
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                        </svg>
                                    </>
                                }>
                                    <div class="mm-login-spinner" />
                                    <span>Authenticating...</span>
                                </Show>
                            </div>
                        </button>
                    </form>

                    {/* Footer */}
                    <div class="mm-login-footer">
                        <a href="/" class="mm-login-back">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M9 6H3M5 3L2 6l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            Back to Main
                        </a>
                        <span class="mm-login-version">VisionDEX MM v1.0</span>
                    </div>
                </div>

                {/* Status */}
                <div class="mm-login-status">
                    <div class="mm-login-status-left">
                        <div class="mm-login-status-dot" />
                        <span>Trading Engine: Active</span>
                    </div>
                    <span class="mm-login-status-enc">Session: Encrypted</span>
                </div>
            </div>

            <style>{`
                .mm-login-root {
                    min-height: 100vh;
                    background: #0a0808;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                    position: relative;
                    overflow: hidden;
                }
                .mm-login-bg-glow {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, rgba(245,158,11,0.04) 0%, transparent 70%);
                }
                .mm-login-bg-grid {
                    position: absolute;
                    inset: 0;
                    opacity: 0.015;
                    background-image: radial-gradient(#fff 1px, transparent 1px);
                    background-size: 30px 30px;
                }
                .mm-login-bg-line-top {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: linear-gradient(to right, transparent, rgba(245,158,11,0.25), transparent);
                }
                .mm-login-bg-line-bottom {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: linear-gradient(to right, transparent, rgba(217,119,6,0.2), transparent);
                }
                .mm-login-container {
                    width: 100%;
                    max-width: 440px;
                    position: relative;
                }
                .mm-login-glow-ring {
                    position: absolute;
                    inset: -4px;
                    background: linear-gradient(to bottom right, rgba(245,158,11,0.15), rgba(255,255,255,0.03), rgba(217,119,6,0.15));
                    border-radius: 32px;
                    filter: blur(20px);
                    opacity: 0.5;
                }
                .mm-login-card {
                    position: relative;
                    background: rgba(15,12,10,0.85);
                    backdrop-filter: blur(40px);
                    border: 1px solid rgba(245,158,11,0.12);
                    border-radius: 32px;
                    padding: 40px;
                    box-shadow: 0 25px 50px rgba(0,0,0,0.5);
                    overflow: hidden;
                }
                .mm-login-accent-bar {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 120px;
                    height: 3px;
                    background: linear-gradient(to right, #f59e0b, #d97706);
                    border-radius: 0 0 4px 4px;
                    box-shadow: 0 0 15px rgba(245,158,11,0.6);
                }
                .mm-login-header {
                    text-align: center;
                    margin-bottom: 36px;
                }
                .mm-login-icon-wrap {
                    display: inline-block;
                    position: relative;
                    margin-bottom: 20px;
                }
                .mm-login-icon {
                    width: 72px;
                    height: 72px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 30px rgba(245,158,11,0.3);
                    animation: mmFloat 3s ease-in-out infinite;
                }
                .mm-login-icon-badge {
                    position: absolute;
                    bottom: -6px;
                    right: -6px;
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    background: #0a0808;
                    border: 1px solid rgba(245,158,11,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .mm-login-title {
                    font-size: 36px;
                    font-weight: 900;
                    font-style: italic;
                    letter-spacing: -0.05em;
                    text-transform: uppercase;
                    color: white;
                    margin-bottom: 6px;
                }
                .mm-login-title-accent {
                    color: #f59e0b;
                }
                .mm-login-subtitle-wrap {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .mm-login-hr {
                    width: 24px;
                    height: 1px;
                    background: rgba(245,158,11,0.3);
                }
                .mm-login-subtitle {
                    font-size: 9px;
                    font-weight: 900;
                    color: #f59e0b;
                    text-transform: uppercase;
                    letter-spacing: 0.3em;
                }
                .mm-login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    padding: 0 16px;
                }
                .mm-login-fields {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .mm-login-field-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .mm-login-label {
                    font-size: 9px;
                    font-weight: 900;
                    color: rgba(255,255,255,0.35);
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                    margin-left: 4px;
                }
                .mm-login-input-wrap {
                    position: relative;
                }
                .mm-login-input-icon {
                    position: absolute;
                    left: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: rgba(255,255,255,0.3);
                    pointer-events: none;
                    transition: color 0.2s;
                }
                .mm-login-input-wrap:focus-within .mm-login-input-icon {
                    color: #f59e0b;
                }
                .mm-login-input {
                    width: 100%;
                    background: rgba(0,0,0,0.4);
                    border: 1px solid rgba(245,158,11,0.1);
                    border-radius: 16px;
                    padding: 14px 16px 14px 44px;
                    font-size: 13px;
                    font-weight: 700;
                    color: white;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    box-sizing: border-box;
                }
                .mm-login-input::placeholder {
                    color: rgba(255,255,255,0.15);
                }
                .mm-login-input:focus {
                    border-color: rgba(245,158,11,0.4);
                    box-shadow: 0 0 0 3px rgba(245,158,11,0.08);
                }
                .mm-login-eye-btn {
                    position: absolute;
                    right: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.3);
                    cursor: pointer;
                    padding: 4px;
                    transition: color 0.2s;
                }
                .mm-login-eye-btn:hover {
                    color: white;
                }
                .mm-login-error {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(239,68,68,0.08);
                    border: 1px solid rgba(239,68,68,0.15);
                    border-radius: 16px;
                    padding: 10px 14px;
                    animation: mmShake 0.2s ease-in-out 2;
                }
                .mm-login-error span {
                    font-size: 11px;
                    font-weight: 700;
                    color: #ef4444;
                    text-transform: uppercase;
                }
                .mm-login-submit {
                    width: 100%;
                    padding: 14px;
                    border-radius: 16px;
                    background: linear-gradient(to right, #f59e0b, #d97706);
                    color: white;
                    font-weight: 900;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(245,158,11,0.2);
                    transition: box-shadow 0.3s, transform 0.15s;
                    position: relative;
                    overflow: hidden;
                }
                .mm-login-submit:hover {
                    box-shadow: 0 4px 30px rgba(245,158,11,0.4);
                    transform: scale(1.02);
                }
                .mm-login-submit:active {
                    transform: scale(0.97);
                }
                .mm-login-submit:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .mm-login-submit-shine {
                    position: absolute;
                    inset: 0;
                    background: rgba(255,255,255,0.1);
                    transform: translateY(100%);
                    transition: transform 0.3s;
                }
                .mm-login-submit:hover .mm-login-submit-shine {
                    transform: translateY(0);
                }
                .mm-login-submit-content {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }
                .mm-login-spinner {
                    width: 18px;
                    height: 18px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                .mm-login-footer {
                    margin-top: 32px;
                    padding-top: 24px;
                    border-top: 1px solid rgba(245,158,11,0.08);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .mm-login-back {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 10px;
                    font-weight: 700;
                    color: rgba(255,255,255,0.35);
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    text-decoration: none;
                    transition: color 0.2s;
                }
                .mm-login-back:hover {
                    color: white;
                }
                .mm-login-version {
                    font-size: 9px;
                    font-weight: 900;
                    color: rgba(255,255,255,0.2);
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                }
                .mm-login-status {
                    margin-top: 20px;
                    padding: 0 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .mm-login-status-left {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .mm-login-status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #22c55e;
                    animation: pulse 2s ease-in-out infinite;
                }
                .mm-login-status-left span,
                .mm-login-status-enc {
                    font-size: 9px;
                    font-weight: 900;
                    color: rgba(255,255,255,0.25);
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                }
                @keyframes mmFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                @keyframes mmShake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
}
