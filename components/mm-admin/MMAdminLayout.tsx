import { createSignal, createMemo, Show, For, onMount, onCleanup } from 'solid-js';
import { A, useLocation, useNavigate } from '@solidjs/router';
import { onAdminAuthStateChanged, adminLogout, getUserRole } from '../../services/firebaseService';
import type { User } from 'firebase/auth';

interface MMAdminLayoutProps {
    children?: any;
}

export default function MMAdminLayout(props: MMAdminLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = createSignal(false);
    const [adminUser, setAdminUser] = createSignal<User | null>(null);
    const [loading, setLoading] = createSignal(true);
    const location = useLocation();
    const navigate = useNavigate();

    onMount(() => {
        const unsubscribe = onAdminAuthStateChanged(async (user) => {
            if (!user) {
                navigate('/mm-login', { replace: true });
                setLoading(false);
                return;
            }
            // Verify admin role
            const role = await getUserRole(user.email || '');
            if (role !== 'admin') {
                await adminLogout();
                navigate('/mm-login', { replace: true });
                setLoading(false);
                return;
            }
            setAdminUser(user);
            setLoading(false);
        });
        onCleanup(() => unsubscribe());
    });

    const handleLogout = async () => {
        await adminLogout();
        navigate('/mm-login', { replace: true });
    };

    const isActive = (path: string) => {
        if (path === '/mm-admin') return location.pathname === '/mm-admin';
        return location.pathname.startsWith(path);
    };

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', path: '/mm-admin', icon: 'dashboard' },
        { id: 'price', label: 'Price Direction', path: '/mm-admin/price', icon: 'trending' },
        { id: 'spread', label: 'Spread & Layers', path: '/mm-admin/spread', icon: 'layers' },
        { id: 'inventory', label: 'Inventory', path: '/mm-admin/inventory', icon: 'inventory' },
        { id: 'risk', label: 'Risk Controls', path: '/mm-admin/risk', icon: 'shield' },
        { id: 'agents', label: 'MM Agents', path: '/mm-admin/agents', icon: 'bot' },
        { id: 'log', label: 'Activity Log', path: '/mm-admin/log', icon: 'log' },
    ];

    const getIcon = (icon: string) => {
        switch (icon) {
            case 'dashboard':
                return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" /><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" /><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" /><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" /></svg>;
            case 'trending':
                return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14l4-4 3 3 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /><path d="M12 6h4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>;
            case 'layers':
                return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L2 6l7 4 7-4-7-4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /><path d="M2 9l7 4 7-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /><path d="M2 12l7 4 7-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>;
            case 'inventory':
                return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5" /><path d="M9 5v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>;
            case 'shield':
                return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L3 5v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5L9 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /><path d="M6.5 9l2 2 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>;
            case 'bot':
                return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="5" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5" /><circle cx="7" cy="10" r="1.5" fill="currentColor" /><circle cx="11" cy="10" r="1.5" fill="currentColor" /><path d="M9 2v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><circle cx="9" cy="2" r="1" fill="currentColor" /></svg>;
            case 'log':
                return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.5" /><path d="M6 6h6M6 9h6M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>;
            default:
                return null;
        }
    };

    return (
        <Show
            when={!loading()}
            fallback={
                <div class="mm-layout-loading">
                    <div class="mm-layout-spinner" />
                </div>
            }
        >
            <div class="mm-layout-root">
                {/* Mobile header */}
                <div class="mm-layout-mobile-header">
                    <button onClick={() => setSidebarOpen(!sidebarOpen())} class="mm-layout-hamburger">
                        <Show when={sidebarOpen()} fallback={
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="white" stroke-width="1.5" stroke-linecap="round" /></svg>
                        }>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="white" stroke-width="1.5" stroke-linecap="round" /></svg>
                        </Show>
                    </button>
                    <span class="mm-layout-mobile-title">MM<span style="color:#f59e0b">Control</span></span>
                    <div style="width:36px" />
                </div>

                {/* Sidebar overlay */}
                <Show when={sidebarOpen()}>
                    <div class="mm-layout-overlay" onClick={() => setSidebarOpen(false)} />
                </Show>

                {/* Sidebar */}
                <aside class={`mm-layout-sidebar ${sidebarOpen() ? 'open' : ''}`}>
                    <div class="mm-layout-sidebar-inner">
                        {/* Top accent */}
                        <div class="mm-sidebar-accent-line" />

                        {/* Logo */}
                        <div class="mm-sidebar-logo-section">
                            <div class="mm-sidebar-logo-bg" />
                            <div class="mm-sidebar-logo-content">
                                <div class="mm-sidebar-logo-icon">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <rect x="2" y="4" width="16" height="12" rx="2" stroke="white" stroke-width="1.5" />
                                        <path d="M5 10h2l1-3 1.5 6 1.5-4 1 2h2" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </div>
                                <span class="mm-sidebar-logo-text">
                                    MM<span style="color:#f59e0b">Control</span>
                                </span>
                            </div>
                        </div>

                        {/* Navigation */}
                        <div class="mm-sidebar-nav">
                            <div class="mm-sidebar-section-label">Operations</div>
                            <nav class="mm-sidebar-nav-items">
                                <For each={menuItems}>
                                    {(item) => (
                                        <A
                                            href={item.path}
                                            onClick={() => setSidebarOpen(false)}
                                            class={`mm-sidebar-item ${isActive(item.path) ? 'active' : ''}`}
                                        >
                                            <Show when={isActive(item.path)}>
                                                <div class="mm-sidebar-item-indicator" />
                                            </Show>
                                            <span class="mm-sidebar-item-icon">{getIcon(item.icon)}</span>
                                            <span class="mm-sidebar-item-label">{item.label}</span>
                                            <Show when={isActive(item.path)}>
                                                <div class="mm-sidebar-item-dot" />
                                            </Show>
                                        </A>
                                    )}
                                </For>
                            </nav>
                        </div>

                        {/* Bottom */}
                        <div class="mm-sidebar-bottom">
                            {/* Engine status */}
                            <div class="mm-sidebar-status-card">
                                <div class="mm-sidebar-status-header">
                                    <span class="mm-sidebar-status-label">Engine Status</span>
                                    <div class="mm-sidebar-status-indicator">
                                        <div class="mm-sidebar-status-dot-green" />
                                        <span class="mm-sidebar-status-text">Live</span>
                                    </div>
                                </div>
                                <div class="mm-sidebar-status-bar-wrap">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <path d="M2 7h2l1-3 1.5 6 1.5-4 1 2h2" stroke="#f59e0b" stroke-width="1" stroke-linecap="round" opacity="0.5" />
                                    </svg>
                                    <div class="mm-sidebar-status-bar">
                                        <div class="mm-sidebar-status-bar-fill" />
                                    </div>
                                </div>
                            </div>

                            <div class="mm-sidebar-role-badge">MM Operator</div>

                            <button onClick={handleLogout} class="mm-sidebar-logout">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <path d="M7 2H4a2 2 0 00-2 2v10a2 2 0 002 2h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                    <path d="M11 12l4-3-4-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                    <path d="M15 9H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                </svg>
                                <span>End Session</span>
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main content */}
                <main class="mm-layout-main">
                    <div class="mm-layout-content">
                        {props.children}
                    </div>
                </main>
            </div>

            <style>{`
                .mm-layout-root {
                    min-height: 100vh;
                    background: #0a0808;
                    color: white;
                }
                .mm-layout-loading {
                    min-height: 100vh;
                    background: #0a0808;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .mm-layout-spinner {
                    width: 48px;
                    height: 48px;
                    border: 4px solid rgba(245,158,11,0.2);
                    border-top-color: #f59e0b;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                /* Mobile Header */
                .mm-layout-mobile-header {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 56px;
                    background: rgba(10,8,8,0.95);
                    backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(245,158,11,0.08);
                    z-index: 50;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 16px;
                }
                .mm-layout-hamburger {
                    padding: 8px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.05);
                    border: none;
                    cursor: pointer;
                    color: white;
                }
                .mm-layout-mobile-title {
                    font-size: 18px;
                    font-weight: 900;
                    font-style: italic;
                    text-transform: uppercase;
                    letter-spacing: -0.03em;
                }
                .mm-layout-overlay {
                    display: none;
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                    z-index: 40;
                }

                /* Sidebar */
                .mm-layout-sidebar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    height: 100%;
                    width: 240px;
                    background: rgba(12,10,8,0.85);
                    backdrop-filter: blur(40px);
                    border-right: 1px solid rgba(245,158,11,0.08);
                    z-index: 50;
                    transform: translateX(0);
                    transition: transform 0.4s ease;
                }
                .mm-layout-sidebar-inner {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .mm-sidebar-accent-line {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 1px;
                    height: 100%;
                    background: linear-gradient(to bottom, transparent, rgba(245,158,11,0.15), transparent);
                }
                .mm-sidebar-logo-section {
                    height: 68px;
                    display: flex;
                    align-items: center;
                    padding: 0 20px;
                    position: relative;
                    overflow: hidden;
                }
                .mm-sidebar-logo-bg {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to right, rgba(245,158,11,0.04), transparent);
                    opacity: 0.5;
                }
                .mm-sidebar-logo-content {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .mm-sidebar-logo-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 12px rgba(245,158,11,0.2);
                }
                .mm-sidebar-logo-text {
                    font-size: 16px;
                    font-weight: 900;
                    font-style: italic;
                    text-transform: uppercase;
                    letter-spacing: -0.03em;
                    color: white;
                }
                .mm-sidebar-nav {
                    flex: 1;
                    min-height: 0;
                    overflow-y: auto;
                    padding: 12px 10px;
                }
                .mm-sidebar-section-label {
                    padding: 0 12px;
                    margin-bottom: 12px;
                    font-size: 9px;
                    font-weight: 900;
                    color: rgba(255,255,255,0.25);
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                }
                .mm-sidebar-nav-items {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .mm-sidebar-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 12px;
                    color: rgba(255,255,255,0.45);
                    text-decoration: none;
                    transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                    font-size: 13px;
                    font-weight: 700;
                }
                .mm-sidebar-item:hover {
                    color: white;
                    background: rgba(255,255,255,0.03);
                }
                .mm-sidebar-item.active {
                    color: #f59e0b;
                    background: linear-gradient(to right, rgba(245,158,11,0.1), rgba(217,119,6,0.03));
                }
                .mm-sidebar-item-indicator {
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 3px;
                    height: 18px;
                    background: #f59e0b;
                    border-radius: 0 3px 3px 0;
                    box-shadow: 0 0 10px rgba(245,158,11,0.5);
                }
                .mm-sidebar-item-icon {
                    display: flex;
                    align-items: center;
                    transition: transform 0.2s;
                }
                .mm-sidebar-item:hover .mm-sidebar-item-icon {
                    transform: scale(1.1);
                }
                .mm-sidebar-item-label {
                    letter-spacing: -0.01em;
                }
                .mm-sidebar-item-dot {
                    margin-left: auto;
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background: #f59e0b;
                    box-shadow: 0 0 6px rgba(245,158,11,0.8);
                }

                /* Bottom */
                .mm-sidebar-bottom {
                    flex-shrink: 0;
                    padding: 14px;
                    border-top: 1px solid rgba(245,158,11,0.06);
                    background: rgba(12,10,8,0.4);
                }
                .mm-sidebar-status-card {
                    margin-bottom: 12px;
                    padding: 10px 12px;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.04);
                }
                .mm-sidebar-status-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                .mm-sidebar-status-label {
                    font-size: 9px;
                    font-weight: 900;
                    color: rgba(255,255,255,0.3);
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                }
                .mm-sidebar-status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .mm-sidebar-status-dot-green {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #22c55e;
                    animation: pulse 2s ease-in-out infinite;
                }
                .mm-sidebar-status-text {
                    font-size: 9px;
                    font-weight: 900;
                    color: #22c55e;
                    text-transform: uppercase;
                }
                .mm-sidebar-status-bar-wrap {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .mm-sidebar-status-bar {
                    flex: 1;
                    height: 4px;
                    background: rgba(255,255,255,0.04);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .mm-sidebar-status-bar-fill {
                    height: 100%;
                    width: 85%;
                    background: linear-gradient(to right, #f59e0b, #d97706);
                    border-radius: 4px;
                }
                .mm-sidebar-role-badge {
                    margin-bottom: 10px;
                    padding: 8px 14px;
                    border-radius: 8px;
                    text-align: center;
                    font-size: 9px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                    color: #f59e0b;
                    background: rgba(245,158,11,0.08);
                    border: 1px solid rgba(245,158,11,0.15);
                }
                .mm-sidebar-logout {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 12px;
                    background: none;
                    border: none;
                    color: rgba(239,68,68,0.6);
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .mm-sidebar-logout:hover {
                    color: #ef4444;
                    background: rgba(239,68,68,0.05);
                }

                /* Main */
                .mm-layout-main {
                    margin-left: 240px;
                    min-height: 100vh;
                }
                .mm-layout-content {
                    padding: 24px 28px;
                }

                @media (max-width: 1024px) {
                    .mm-layout-mobile-header {
                        display: flex;
                    }
                    .mm-layout-overlay {
                        display: block;
                    }
                    .mm-layout-sidebar {
                        transform: translateX(-100%);
                    }
                    .mm-layout-sidebar.open {
                        transform: translateX(0);
                        box-shadow: 0 0 40px rgba(245,158,11,0.1);
                    }
                    .mm-layout-main {
                        margin-left: 0;
                        padding-top: 56px;
                    }
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </Show>
    );
}
