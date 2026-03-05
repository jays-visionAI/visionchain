import { render } from 'solid-js/web';
import { Router, Route, Navigate, useLocation } from '@solidjs/router';
import { Show, Suspense } from 'solid-js';
import { AuthProvider, useAuth } from './components/auth/authContext';
import { I18nProvider } from './i18n/i18nContext';
import { isProduction } from './services/envConfig';

// Core layout components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import EnvironmentBadge from './components/EnvironmentBadge';

// Pages
import HomePage from './pages/HomePage';
import * as Public from './pages/PublicPages';
import * as Admin from './pages/AdminPages';
import * as TradingAdmin from './pages/TradingAdminPages';
import * as Auth from './pages/AuthPages';
import ValidatorStaking from './components/ValidatorStaking';

// Loading spinner component
function PageLoader() {
  return (
    <div class="min-h-screen flex items-center justify-center">
      <div class="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

// Layout wrapper for all pages
function Layout(props: { children?: any }) {
  const location = useLocation();

  // Hide Navbar, Footer, and AI button for Admin pages
  const isAdminRoute = () => location.pathname.startsWith('/admin') || location.pathname.startsWith('/adminsystem') || location.pathname.startsWith('/docs') || location.pathname.startsWith('/trading-login') || location.pathname.startsWith('/trading-admin') || location.pathname.startsWith('/mm-admin') || location.pathname.startsWith('/mm-login');
  const isDexRoute = () => location.pathname.startsWith('/dex');

  return (
    <div class="bg-[#050505] min-h-screen text-white selection:bg-blue-500/30 selection:text-blue-200 relative overflow-hidden">
      <div class="relative z-10">
        <Show when={!isAdminRoute() && !isDexRoute() && !location.pathname.startsWith('/wallet')}>
          <Navbar />
        </Show>
        <main>
          <Suspense fallback={<PageLoader />}>
            {props.children}
          </Suspense>
        </main>
        <Show when={!isAdminRoute() && !isDexRoute() && !location.pathname.startsWith('/wallet')}>
          <Footer />
        </Show>
      </div>
      {/* Environment indicator badge (only shows in staging/dev) */}
      <EnvironmentBadge />
    </div>
  );
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

render(() => (
  <AuthProvider>
    <I18nProvider>
      <Router root={Layout}>
        {/* Auth Routes */}
        <Route path="/login" component={Auth.LoginPage} />
        <Route path="/newlogin" component={Auth.LoginPage} />
        <Route path="/signup" component={Auth.SignupPage} />
        <Route path="/admin-login" component={Auth.AdminLoginPage} />
        <Route path="/activate" component={Auth.ActivatePage} />
        <Route path="/reset-password" component={Auth.ResetPasswordPage} />

        {/* Public Routes */}
        <Route path="/" component={HomePage} />
        <Route path="/research" component={Public.ResearchPage} />
        <Route path="/technology" component={Public.TechnologyPage} />
        <Route path="/community" component={Public.CommunityPage} />
        <Route path="/academy" component={Public.AcademyPage} />
        <Route path="/developer-community" component={Public.DeveloperCommunityPage} />
        <Route path="/contact" component={Public.ContactPage} />
        <Route path="/privacy" component={Public.PrivacyPage} />
        <Route path="/terms" component={Public.TermsPage} />
        <Route path="/cookies" component={Public.CookiesPage} />
        <Route path="/wallet/*" component={Public.WalletPage} />
        <Route path="/trafficsim" component={Public.TrafficSimulatorPage} />
        <Route path="/visionscan" component={Public.VisionScanPage} />
        <Route path="/testnet" component={Public.TestnetPage} />
        <Route path="/bridge" component={Public.BridgePage} />
        <Route path="/staking" component={ValidatorStaking} />
        <Route path="/paymaster" component={Public.PaymasterPage} />
        <Route path="/agent" component={Public.AgentGatewayPage} />
        <Route path="/agent/*" component={Public.AgentGatewayPage} />
        <Route path="/api" component={Public.ApiHubPage} />
        <Route path="/docs/agent-api" component={Public.AgentApiDocsPage} />
        {!isProduction() && (
          <>
            <Route path="/dex" component={Public.DEXMarketsPage} />
            <Route path="/dex/:pair" component={Public.TradingTerminalPage} />
          </>
        )}

        {/* Studio / Tools Routes */}
        <Route path="/mint" component={Public.MintStudioPage} />

        {/* Admin Routes */}
        <Route path="/adminsystem" component={Admin.AdminDashboardPage} />
        <Route path="/adminsystem/users" component={Admin.AdminUsersPage} />
        <Route path="/adminsystem/wallet" component={Admin.AdminWalletPage} />
        <Route path="/adminsystem/campaigns" component={Admin.AdminCampaignPage} />
        <Route path="/adminsystem/activity" component={Admin.AdminActivityPage} />
        <Route path="/adminsystem/vcn" component={Admin.AdminVCNDistributionPage} />
        <Route path="/adminsystem/vcn-settings" component={Admin.AdminSettingsPage} />
        <Route path="/adminsystem/traffic" component={Admin.AdminTrafficPage} />
        <Route path="/adminsystem/documents" component={Admin.AdminDocumentsPage} />
        <Route path="/adminsystem/referrals" component={Admin.AdminReferralsPage} />
        <Route path="/adminsystem/defi" component={Admin.AdminDeFiPage} />
        <Route path="/adminsystem/ai" component={Admin.AdminAIManagementPage} />
        <Route path="/adminsystem/api-docs" component={Admin.AdminApiDocsPage} />
        <Route path="/adminsystem/api-docs/*" component={Admin.AdminApiDocsPage} />
        <Route path="/adminsystem/settings" component={Admin.AdminSettingsPage} />
        <Route path="/adminsystem/paymaster" component={Admin.PaymasterAdminPage} />
        <Route path="/adminsystem/announcements" component={Admin.AdminAnnouncementsPage} />
        <Route path="/adminsystem/bridge-networks" component={Admin.AdminBridgeNetworksPage} />
        <Route path="/adminsystem/email" component={Admin.AdminEmailPage} />
        <Route path="/adminsystem/cex-portfolio" component={Admin.AdminCexPortfolioPage} />
        <Route path="/adminsystem/vision-insight" component={Admin.AdminVisionInsightPage} />
        <Route path="/adminsystem/social-media" component={Admin.AdminSocialMediaPage} />
        <Route path="/adminsystem/api-pricing" component={Admin.AdminApiPricingPage} />
        <Route path="/adminsystem/vision-nodes" component={Admin.AdminVisionNodesPage} />
        <Route path="/adminsystem/node-health" component={Admin.AdminNodeHealthPage} />
        <Route path="/adminsystem/daily-tips" component={Admin.AdminDailyTipsPage} />
        <Route path="/adminsystem/rp-config" component={Admin.AdminRPConfigPage} />

        {/* Trading Admin Routes (Separate system) */}
        <Route path="/trading-login" component={TradingAdmin.TradingAdminLoginPage} />
        <Route path="/trading-admin" component={TradingAdmin.TradingAdminDashboardPage} />
        <Route path="/trading-admin/action" component={TradingAdmin.TradingAdminActionPage} />
        <Route path="/trading-admin/price" component={TradingAdmin.TradingAdminPricePage} />
        <Route path="/trading-admin/spread" component={TradingAdmin.TradingAdminSpreadPage} />
        <Route path="/trading-admin/inventory" component={TradingAdmin.TradingAdminInventoryPage} />
        <Route path="/trading-admin/risk" component={TradingAdmin.TradingAdminRiskPage} />
        <Route path="/trading-admin/agents" component={TradingAdmin.TradingAdminAgentsPage} />
        <Route path="/trading-admin/log" component={TradingAdmin.TradingAdminLogPage} />

        {/* Legacy redirects: /mm-admin -> /trading-admin */}
        <Route path="/mm-login" component={() => <Navigate href="/trading-login" />} />
        <Route path="/mm-admin" component={() => <Navigate href="/trading-admin" />} />
        <Route path="/mm-admin/action" component={() => <Navigate href="/trading-admin/action" />} />
        <Route path="/mm-admin/price" component={() => <Navigate href="/trading-admin/price" />} />
        <Route path="/mm-admin/spread" component={() => <Navigate href="/trading-admin/spread" />} />
        <Route path="/mm-admin/inventory" component={() => <Navigate href="/trading-admin/inventory" />} />
        <Route path="/mm-admin/risk" component={() => <Navigate href="/trading-admin/risk" />} />
        <Route path="/mm-admin/agents" component={() => <Navigate href="/trading-admin/agents" />} />
        <Route path="/mm-admin/log" component={() => <Navigate href="/trading-admin/log" />} />

      </Router>
    </I18nProvider>
  </AuthProvider>
), rootElement);