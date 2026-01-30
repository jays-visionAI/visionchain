import { render } from 'solid-js/web';
import { Router, Route, useLocation } from '@solidjs/router';
import { Show, Suspense } from 'solid-js';
import { AuthProvider, useAuth } from './components/auth/authContext';

// Core layout components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import HomePage from './pages/HomePage';
import * as Public from './pages/PublicPages';
import * as Admin from './pages/AdminPages';
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
  const isAdminRoute = () => location.pathname.startsWith('/admin') || location.pathname.startsWith('/adminsystem');

  return (
    <div class="bg-[#050505] min-h-screen text-white selection:bg-blue-500/30 selection:text-blue-200 relative overflow-hidden">
      <div class="relative z-10">
        <Show when={!isAdminRoute() && !location.pathname.startsWith('/wallet')}>
          <Navbar />
        </Show>
        <main>
          <Suspense fallback={<PageLoader />}>
            {props.children}
          </Suspense>
        </main>
        <Show when={!isAdminRoute() && !location.pathname.startsWith('/wallet')}>
          <Footer />
        </Show>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

render(() => (
  <AuthProvider>
    <Router root={Layout}>
      {/* Auth Routes */}
      <Route path="/login" component={Auth.LoginPage} />
      <Route path="/newlogin" component={Auth.LoginPage} />
      <Route path="/signup" component={Auth.SignupPage} />
      <Route path="/admin-login" component={Auth.AdminLoginPage} />
      <Route path="/activate" component={Auth.ActivatePage} />

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
    </Router>
  </AuthProvider>
), rootElement);