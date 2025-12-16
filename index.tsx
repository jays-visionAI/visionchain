import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import { createSignal, Show, lazy, Suspense } from 'solid-js';

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

// Admin components (lazy-loaded)
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./components/admin/AdminUsers'));
const AdminSettings = lazy(() => import('./components/admin/AdminSettings'));
const AdminAIManagement = lazy(() => import('./components/admin/AdminAIManagement'));
const AdminApiDocs = lazy(() => import('./components/admin/AdminApiDocs'));

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

  return (
    <div class="bg-[#050505] min-h-screen text-white selection:bg-blue-500/30 selection:text-blue-200 relative overflow-hidden">
      <div class="relative z-10">
        <Navbar />
        <main>
          <Suspense fallback={<PageLoader />}>
            {props.children}
          </Suspense>
        </main>
        <Footer />
      </div>

      {/* Floating Action Button for AI */}
      <Show when={!isAIModalOpen()}>
        <button
          onClick={() => setIsAIModalOpen(true)}
          class="fixed bottom-8 right-8 p-4 bg-blue-600 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:scale-110 transition-transform z-40 group"
        >
          <Sparkles class="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
        </button>
      </Show>

      <AIChat isOpen={isAIModalOpen()} onClose={() => setIsAIModalOpen(false)} />
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

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

render(() => (
  <Router root={Layout}>
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
    {/* Admin Routes */}
    <Route path="/admin" component={AdminDashboardPage} />
    <Route path="/admin/users" component={AdminUsersPage} />
    <Route path="/admin/ai" component={AdminAIManagementPage} />
    <Route path="/admin/api-docs" component={AdminApiDocsPage} />
    <Route path="/admin/api-docs/*" component={AdminApiDocsPage} />
    <Route path="/admin/settings" component={AdminSettingsPage} />
  </Router>
), rootElement);