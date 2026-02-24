import { lazy, Suspense } from 'solid-js';

// Trading Admin components (lazy-loaded)
const TradingAdminLogin = lazy(() => import('../components/trading-admin/TradingAdminLogin'));
const TradingAdminLayout = lazy(() => import('../components/trading-admin/TradingAdminLayout'));
const TradingAdminDashboard = lazy(() => import('../components/trading-admin/TradingAdminDashboard'));
const TradingPriceDirection = lazy(() => import('../components/trading-admin/TradingPriceDirection'));
const TradingSpreadLayers = lazy(() => import('../components/trading-admin/TradingSpreadLayers'));
const TradingInventory = lazy(() => import('../components/trading-admin/TradingInventory'));
const TradingRiskControls = lazy(() => import('../components/trading-admin/TradingRiskControls'));
const TradingAgents = lazy(() => import('../components/trading-admin/TradingAgents'));
const TradingActivityLog = lazy(() => import('../components/trading-admin/TradingActivityLog'));
const TradingMarketAction = lazy(() => import('../components/trading-admin/TradingMarketAction'));

function PageLoader() {
    return (
        <div style={{ "min-height": "100vh", display: "flex", "align-items": "center", "justify-content": "center", background: "#0a0808" }}>
            <div style={{ width: "48px", height: "48px", border: "4px solid rgba(245,158,11,0.2)", "border-top-color": "#f59e0b", "border-radius": "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

export function TradingAdminLoginPage() {
    document.title = 'Trading Control | Login';
    return (
        <Suspense fallback={<PageLoader />}>
            <TradingAdminLogin />
        </Suspense>
    );
}

export function TradingAdminDashboardPage() {
    document.title = 'Dashboard | Trading Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <TradingAdminLayout>
                <TradingAdminDashboard />
            </TradingAdminLayout>
        </Suspense>
    );
}

export function TradingAdminPricePage() {
    document.title = 'Price Direction | Trading Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <TradingAdminLayout>
                <TradingPriceDirection />
            </TradingAdminLayout>
        </Suspense>
    );
}

export function TradingAdminSpreadPage() {
    document.title = 'Spread & Layers | Trading Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <TradingAdminLayout>
                <TradingSpreadLayers />
            </TradingAdminLayout>
        </Suspense>
    );
}

export function TradingAdminInventoryPage() {
    document.title = 'Inventory | Trading Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <TradingAdminLayout>
                <TradingInventory />
            </TradingAdminLayout>
        </Suspense>
    );
}

export function TradingAdminRiskPage() {
    document.title = 'Risk Controls | Trading Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <TradingAdminLayout>
                <TradingRiskControls />
            </TradingAdminLayout>
        </Suspense>
    );
}

export function TradingAdminAgentsPage() {
    document.title = 'Trading Agents | Trading Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <TradingAdminLayout>
                <TradingAgents />
            </TradingAdminLayout>
        </Suspense>
    );
}

export function TradingAdminLogPage() {
    document.title = 'Activity Log | Trading Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <TradingAdminLayout>
                <TradingActivityLog />
            </TradingAdminLayout>
        </Suspense>
    );
}

export function TradingAdminActionPage() {
    document.title = 'Market Operations | Trading Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <TradingAdminLayout>
                <TradingMarketAction />
            </TradingAdminLayout>
        </Suspense>
    );
}
