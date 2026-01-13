import { render } from 'solid-js/web';
import { Router, Route, useLocation } from '@solidjs/router';
import { createSignal, Show, lazy, Suspense } from 'solid-js';
import { AuthProvider } from './components/auth/authContext';

// Core components (loaded immediately for homepage)
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Stats from './components/Stats';
import Applications from './components/Applications';
import Architecture from './components/Architecture';
import Footer from './components/Footer';
import AIChat from './components/AIChat';
import { Sparkles } from 'lucide-solid';

// Lazy-loaded components (loaded only when needed)
const Technology = lazy(() => import('./components/Technology'));
const Research = lazy(() => import('./components/Research'));
const Community = lazy(() => import('./components/Community'));
const Academy = lazy(() => import('./components/Academy'));
const DeveloperCommunity = lazy(() => import('./components/DeveloperCommunity'));
const ContactUs = lazy(() => import('./components/ContactUs'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./components/TermsOfService'));
const CookiePolicy = lazy(() => import('./components/CookiePolicy'));
const Wallet = lazy(() => import('./components/Wallet'));
const VisionScan = lazy(() => import('./components/VisionScan'));
const Testnet = lazy(() => import('./components/Testnet'));

// Auth components
const Login = lazy(() => import('./components/auth/Login'));
const Signup = lazy(() => import('./components/auth/Signup'));
const AdminLogin = lazy(() => import('./components/auth/AdminLogin'));
const ActivateAccount = lazy(() => import('./components/auth/ActivateAccount'));

// Admin components (lazy-loaded)
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import('./components/admin/AdminUsers'));
const AdminSettings = lazy(() => import('./components/admin/AdminSettings'));
const AdminAIManagement = lazy(() => import('./components/admin/AdminAIManagement'));
const AdminApiDocs = lazy(() => import('./components/admin/AdminApiDocs'));
const AdminWallet = lazy(() => import('./components/admin/AdminWallet'));
const AdminCampaign = lazy(() => import('./components/admin/AdminCampaign'));
const AdminActivity = lazy(() => import('./components/admin/AdminActivity'));
const AdminDocuments = lazy(() => import('./components/admin/AdminDocuments'));
const AdminVCNDistribution = lazy(() => import('./components/admin/AdminVCNDistribution'));
const VcnSettings = lazy(() => import('./components/admin/VcnSettings'));

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
  const [isAIModalOpen, setIsAIModalOpen] = createSignal(false);
  const location = useLocation();

  // Hide Navbar, Footer, and AI button for Admin pages
  const isAdminRoute = () => location.pathname.startsWith('/admin') || location.pathname.startsWith('/adminsystem');

  return (
    <div class="bg-[#050505] min-h-screen text-white selection:bg-blue-500/30 selection:text-blue-200 relative overflow-hidden">
      <div class="relative z-10">
        <Show when={!isAdminRoute()}>
          <Navbar />
        </Show>
        <main>
          <Suspense fallback={<PageLoader />}>
            {props.children}
          </Suspense>
        </main>
        <Show when={!isAdminRoute() && location.pathname !== '/wallet'}>
          <Footer />
        </Show>
      </div>

      {/* Floating Action Button for AI - hide for Admin */}
      <Show when={!isAIModalOpen() && !isAdminRoute()}>
        <button
          onClick={() => setIsAIModalOpen(true)}
          class="fixed bottom-8 right-8 p-4 bg-blue-600 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:scale-110 transition-transform z-40 group"
        >
          <Sparkles class="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
        </button>
      </Show>

      <Show when={!isAdminRoute()}>
        <AIChat isOpen={isAIModalOpen()} onClose={() => setIsAIModalOpen(false)} />
      </Show>
    </div>
  );
}

// Page components
function HomePage() {
  document.title = 'Vision Chain | Network Neutral New Age AI L1';
  return (
    <>
      <Hero />
      <Stats />
      <div id="ecosystem"><Applications /></div>
      <div id="governance"><Architecture /></div>
    </>
  );
}

function ResearchPage() {
  document.title = 'Research | Vision Chain';
  return <div id="research"><Research /></div>;
}

function TechnologyPage() {
  document.title = 'Technology | Vision Chain';
  return <div id="technology"><Technology /></div>;
}

function CommunityPage() {
  document.title = 'Community | Vision Chain';
  return <div id="community"><Community /></div>;
}

function AcademyPage() {
  document.title = 'Academy | Vision Chain';
  return <div id="academy"><Academy /></div>;
}

function DeveloperCommunityPage() {
  document.title = 'Developer Hub | Vision Chain';
  return <div id="developer-community"><DeveloperCommunity /></div>;
}

function ContactPage() {
  document.title = 'Contact Us | Vision Chain';
  return <div id="contact"><ContactUs /></div>;
}

function PrivacyPage() {
  document.title = 'Privacy Policy | Vision Chain';
  return <div id="privacy"><PrivacyPolicy /></div>;
}

function TermsPage() {
  document.title = 'Terms of Service | Vision Chain';
  return <div id="terms"><TermsOfService /></div>;
}

function CookiesPage() {
  document.title = 'Cookie Policy | Vision Chain';
  return <div id="cookies"><CookiePolicy /></div>;
}

function WalletPage() {
  document.title = 'Wallet | Vision Chain';
  return <div id="wallet"><Wallet /></div>;
}

function VisionScanPage() {
  document.title = 'Vision Scan | Accounting-Grade Explorer';
  return <div id="vision-scan"><VisionScan /></div>;
}

function TestnetPage() {
  document.title = 'Testnet Hub | Vision Chain';
  return <div id="testnet"><Testnet /></div>;
}

function AdminLoginPage() {
  document.title = 'Admin HQ | Vision Chain';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLogin />
    </Suspense>
  );
}

// Admin Page wrapper components
function AdminDashboardPage() {
  document.title = 'Dashboard | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminDashboard />
      </AdminLayout>
    </Suspense>
  );
}

function AdminUsersPage() {
  document.title = 'Users | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminUsers />
      </AdminLayout>
    </Suspense>
  );
}

function AdminSettingsPage() {
  document.title = 'Settings | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminSettings />
      </AdminLayout>
    </Suspense>
  );
}

function AdminAIManagementPage() {
  document.title = 'AI Management | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminAIManagement />
      </AdminLayout>
    </Suspense>
  );
}

function AdminApiDocsPage() {
  document.title = 'API Documentation | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminApiDocs />
      </AdminLayout>
    </Suspense>
  );
}

function AdminWalletPage() {
  document.title = 'Wallet Control | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminWallet />
      </AdminLayout>
    </Suspense>
  );
}

function AdminCampaignsPage() {
  document.title = 'Campaigns | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminCampaign />
      </AdminLayout>
    </Suspense>
  );
}

function AdminActivityPage() {
  document.title = 'Activity Log | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminActivity />
      </AdminLayout>
    </Suspense>
  );
}

function AdminDocumentsPage() {
  document.title = 'Documents | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminDocuments />
      </AdminLayout>
    </Suspense>
  );
}

function AdminVCNDistributionPage() {
  document.title = 'VCN Distribution | Admin';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <AdminVCNDistribution />
      </AdminLayout>
    </Suspense>
  );
}

function VcnSettingsPage() {
  document.title = 'Security Settings | Vision Chain';
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <VcnSettings />
      </AdminLayout>
    </Suspense>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

render(() => (
  <AuthProvider>
    <Router root={Layout}>
      <Route path="/login" component={() => <Suspense fallback={<PageLoader />}><Login /></Suspense>} />
      <Route path="/newlogin" component={() => <Suspense fallback={<PageLoader />}><Login /></Suspense>} />
      <Route path="/signup" component={() => <Suspense fallback={<PageLoader />}><Signup /></Suspense>} />
      <Route path="/admin-login" component={AdminLoginPage} />
      <Route path="/activate" component={() => <Suspense fallback={<PageLoader />}><ActivateAccount /></Suspense>} />
      <Route path="/" component={HomePage} />
      <Route path="/research" component={ResearchPage} />
      <Route path="/technology" component={TechnologyPage} />
      <Route path="/community" component={CommunityPage} />
      <Route path="/academy" component={AcademyPage} />
      <Route path="/developer-community" component={DeveloperCommunityPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/cookies" component={CookiesPage} />
      <Route path="/wallet" component={WalletPage} />
      <Route path="/visionscan" component={VisionScanPage} />
      <Route path="/testnet" component={TestnetPage} />
      {/* Admin Routes */}
      <Route path="/adminsystem" component={AdminDashboardPage} />
      <Route path="/adminsystem/users" component={AdminUsersPage} />
      <Route path="/adminsystem/wallet" component={AdminWalletPage} />
      <Route path="/adminsystem/campaigns" component={AdminCampaignsPage} />
      <Route path="/adminsystem/activity" component={AdminActivityPage} />
      <Route path="/adminsystem/vcn" component={AdminVCNDistributionPage} />
      <Route path="/adminsystem/vcn-settings" component={AdminSettingsPage} />
      <Route path="/adminsystem/documents" component={AdminDocumentsPage} />
      <Route path="/adminsystem/ai" component={AdminAIManagementPage} />
      <Route path="/adminsystem/api-docs" component={AdminApiDocsPage} />
      <Route path="/adminsystem/api-docs/*" component={AdminApiDocsPage} />
      <Route path="/adminsystem/settings" component={AdminSettingsPage} />
    </Router>
  </AuthProvider>
), rootElement);