import { lazy, Suspense } from 'solid-js';

// MM Admin components (lazy-loaded)
const MMAdminLogin = lazy(() => import('../components/mm-admin/MMAdminLogin'));
const MMAdminLayout = lazy(() => import('../components/mm-admin/MMAdminLayout'));
const MMAdminDashboard = lazy(() => import('../components/mm-admin/MMAdminDashboard'));
const MMPriceDirection = lazy(() => import('../components/mm-admin/MMPriceDirection'));
const MMSpreadLayers = lazy(() => import('../components/mm-admin/MMSpreadLayers'));
const MMInventory = lazy(() => import('../components/mm-admin/MMInventory'));
const MMRiskControls = lazy(() => import('../components/mm-admin/MMRiskControls'));
const MMAgents = lazy(() => import('../components/mm-admin/MMAgents'));
const MMActivityLog = lazy(() => import('../components/mm-admin/MMActivityLog'));

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

export function MMAdminPricePage() {
    document.title = 'Price Direction | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <MMPriceDirection />
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminSpreadPage() {
    document.title = 'Spread & Layers | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <MMSpreadLayers />
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminInventoryPage() {
    document.title = 'Inventory | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <MMInventory />
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminRiskPage() {
    document.title = 'Risk Controls | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <MMRiskControls />
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminAgentsPage() {
    document.title = 'MM Agents | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <MMAgents />
            </MMAdminLayout>
        </Suspense>
    );
}

export function MMAdminLogPage() {
    document.title = 'Activity Log | MM Control';
    return (
        <Suspense fallback={<PageLoader />}>
            <MMAdminLayout>
                <MMActivityLog />
            </MMAdminLayout>
        </Suspense>
    );
}
