import { lazy, Suspense } from 'solid-js';

// Admin components (lazy-loaded)
export const AdminLayout = lazy(() => import('../components/admin/AdminLayout'));
export const AdminDashboard = lazy(() => import('../components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
export const AdminUsers = lazy(() => import('../components/admin/AdminUsers'));
export const AdminSettings = lazy(() => import('../components/admin/AdminSettings'));
export const AdminAIManagement = lazy(() => import('../components/admin/AdminAIManagement'));
export const AdminApiDocs = lazy(() => import('../components/admin/AdminApiDocs'));
export const AdminWallet = lazy(() => import('../components/admin/AdminWallet'));
export const AdminCampaign = lazy(() => import('../components/admin/AdminCampaign'));
export const AdminActivity = lazy(() => import('../components/admin/AdminActivity'));
export const AdminDocuments = lazy(() => import('../components/admin/AdminDocuments'));
export const AdminReferrals = lazy(() => import('../components/admin/AdminReferrals'));
export const AdminVCNDistribution = lazy(() => import('../components/admin/AdminVCNDistribution'));
export const AdminTraffic = lazy(() => import('../components/admin/AdminTraffic'));
export const VcnSettings = lazy(() => import('../components/admin/VcnSettings'));
export const PaymasterAdmin = lazy(() => import('../components/admin/PaymasterAdmin'));
export const AdminDeFi = lazy(() => import('../components/admin/AdminDeFi'));
export const AdminAnnouncements = lazy(() => import('../components/admin/AdminAnnouncements').then(m => ({ default: m.AdminAnnouncements })));
export const AdminBridgeNetworks = lazy(() => import('../components/admin/AdminBridgeNetworks'));
export const AdminEmail = lazy(() => import('../components/admin/AdminEmail'));
export const AdminCexPortfolio = lazy(() => import('../components/admin/AdminCexPortfolio'));
export const AdminVisionInsight = lazy(() => import('../components/admin/AdminVisionInsight'));
export const AdminSocialMedia = lazy(() => import('../components/admin/AdminSocialMedia'));
export const AdminApiPricing = lazy(() => import('../components/admin/AdminApiPricing'));
export const AdminMobileNodes = lazy(() => import('../components/admin/AdminMobileNodes'));
export const AdminNodeHealth = lazy(() => import('../components/admin/AdminNodeHealth'));


// Loading spinner component
export function PageLoader() {
    return (
        <div class="min-h-screen flex items-center justify-center">
            <div class="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
    );
}

// Admin Page wrapper components
export function AdminDashboardPage() {
    document.title = 'Dashboard | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminDashboard />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminUsersPage() {
    document.title = 'User Management | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminUsers />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminSettingsPage() {
    document.title = 'Settings | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminSettings />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminAIManagementPage() {
    document.title = 'AI Management | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminAIManagement />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminApiDocsPage() {
    document.title = 'API Documentation | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminApiDocs />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminWalletPage() {
    document.title = 'Protocol Wallet | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminWallet />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminCampaignPage() {
    document.title = 'Campaign Management | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminCampaign />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminActivityPage() {
    document.title = 'System Activity | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminActivity />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminDocumentsPage() {
    document.title = 'Newsletter & Documents | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminDocuments />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminReferralsPage() {
    document.title = 'Referral Management | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminReferrals />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminVCNDistributionPage() {
    document.title = 'VCN Distribution | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminVCNDistribution />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminTrafficPage() {
    document.title = 'Traffic Analytics | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminTraffic />
            </AdminLayout>
        </Suspense>
    );
}

export function VcnSettingsPage() {
    document.title = 'VCN Settings | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <VcnSettings />
            </AdminLayout>
        </Suspense>
    );
}

export function PaymasterAdminPage() {
    document.title = 'Paymaster Management | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <PaymasterAdmin />
            </AdminLayout>
        </Suspense>
    );
}
export function AdminDeFiPage() {
    document.title = 'De-Fi Management | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminDeFi />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminAnnouncementsPage() {
    document.title = 'System Announcements | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminAnnouncements />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminBridgeNetworksPage() {
    document.title = 'Bridge Networks | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminBridgeNetworks />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminEmailPage() {
    document.title = 'Email Management | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminEmail />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminCexPortfolioPage() {
    document.title = 'CEX Portfolio | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminCexPortfolio />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminVisionInsightPage() {
    document.title = 'Vision Insight | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminVisionInsight />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminSocialMediaPage() {
    document.title = 'Social Media | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminSocialMedia />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminApiPricingPage() {
    document.title = 'API Pricing | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminApiPricing />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminMobileNodesPage() {
    document.title = 'Mobile Nodes | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminMobileNodes />
            </AdminLayout>
        </Suspense>
    );
}

export function AdminNodeHealthPage() {
    document.title = 'Node Health | Admin';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLayout>
                <AdminNodeHealth />
            </AdminLayout>
        </Suspense>
    );
}
