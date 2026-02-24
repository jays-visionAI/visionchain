import { lazy, Suspense } from 'solid-js';

// MM Admin components (lazy-loaded)
export const MMAdminLogin = lazy(() => import('../components/mm-admin/MMAdminLogin'));
export const MMAdminLayout = lazy(() => import('../components/mm-admin/MMAdminLayout'));
export const MMAdminDashboard = lazy(() => import('../components/mm-admin/MMAdminDashboard'));

function PageLoader() {
    return (
        <div style={{ "min-height": "100vh", display: "flex", "align-items": "center", "justify-content": "center", background: "#0a0808" }}>
            <div style={{ width: "48px", height: "48px", border: "4px solid rgba(245,158,11,0.2)", "border-top-color": "#f59e0b", "border-radius": "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

export function MMAdminLoginPage() {
    document.title = 'MM Control | Login';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLogin />
        </Suspense>
    );
}

export function MMAdminDashboardPage() {
    document.title = 'Dashboard | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <MMAdminDashboard />
            </MMAdminLayout>
        </Suspense>
    );
}

// Placeholder pages for future sub-sections
export function MMAdminPricePage() {
    document.title = 'Price Direction | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <div style={{ padding: "40px 0", "text-align": "center", color: "rgba(255,255,255,0.3)" }}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <path d="M8 36l8-8 6 6 18-18" stroke="rgba(245,158,11,0.4)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M30 16h10v10" stroke="rgba(245,158,11,0.4)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <h2 style={{ "font-size": "18px", "font-weight": "800", "margin-top": "16px", color: "rgba(255,255,255,0.5)" }}>Price Direction Control</h2>
                    <p style={{ "font-size": "13px", "margin-top": "8px" }}>Set trend mode, target price, and phase controls</p>
                    <p style={{ "font-size": "11px", "margin-top": "4px", "font-style": "italic" }}>Coming soon</p>
                </div>
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminSpreadPage() {
    document.title = 'Spread & Layers | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <div style={{ padding: "40px 0", "text-align": "center", color: "rgba(255,255,255,0.3)" }}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <path d="M24 6L6 16l18 10 18-10L24 6z" stroke="rgba(245,158,11,0.4)" stroke-width="3" stroke-linejoin="round" />
                        <path d="M6 24l18 10 18-10" stroke="rgba(245,158,11,0.3)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M6 32l18 10 18-10" stroke="rgba(245,158,11,0.2)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <h2 style={{ "font-size": "18px", "font-weight": "800", "margin-top": "16px", color: "rgba(255,255,255,0.5)" }}>Spread & Layer Config</h2>
                    <p style={{ "font-size": "13px", "margin-top": "8px" }}>Configure bid/ask spread and order layers</p>
                    <p style={{ "font-size": "11px", "margin-top": "4px", "font-style": "italic" }}>Coming soon</p>
                </div>
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminInventoryPage() {
    document.title = 'Inventory | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <div style={{ padding: "40px 0", "text-align": "center", color: "rgba(255,255,255,0.3)" }}>
                    <h2 style={{ "font-size": "18px", "font-weight": "800", color: "rgba(255,255,255,0.5)" }}>Inventory Management</h2>
                    <p style={{ "font-size": "13px", "margin-top": "8px" }}>Target ratios, skew intensity, auto-rebalancing</p>
                    <p style={{ "font-size": "11px", "margin-top": "4px", "font-style": "italic" }}>Coming soon</p>
                </div>
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminRiskPage() {
    document.title = 'Risk Controls | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <div style={{ padding: "40px 0", "text-align": "center", color: "rgba(255,255,255,0.3)" }}>
                    <h2 style={{ "font-size": "18px", "font-weight": "800", color: "rgba(255,255,255,0.5)" }}>Risk Controls</h2>
                    <p style={{ "font-size": "13px", "margin-top": "8px" }}>Kill switch, circuit breaker, loss limits</p>
                    <p style={{ "font-size": "11px", "margin-top": "4px", "font-style": "italic" }}>Coming soon</p>
                </div>
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminAgentsPage() {
    document.title = 'MM Agents | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <div style={{ padding: "40px 0", "text-align": "center", color: "rgba(255,255,255,0.3)" }}>
                    <h2 style={{ "font-size": "18px", "font-weight": "800", color: "rgba(255,255,255,0.5)" }}>MM Agent Management</h2>
                    <p style={{ "font-size": "13px", "margin-top": "8px" }}>Create, configure, and monitor MM agents</p>
                    <p style={{ "font-size": "11px", "margin-top": "4px", "font-style": "italic" }}>Coming soon</p>
                </div>
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminLogPage() {
    document.title = 'Activity Log | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <div style={{ padding: "40px 0", "text-align": "center", color: "rgba(255,255,255,0.3)" }}>
                    <h2 style={{ "font-size": "18px", "font-weight": "800", color: "rgba(255,255,255,0.5)" }}>Activity Log</h2>
                    <p style={{ "font-size": "13px", "margin-top": "8px" }}>Configuration changes and engine events</p>
                    <p style={{ "font-size": "11px", "margin-top": "4px", "font-style": "italic" }}>Coming soon</p>
                </div>
            </MMAdminLayout>
        </Suspense>
    );
}
