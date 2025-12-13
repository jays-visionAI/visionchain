import { createSignal, Show } from 'solid-js';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Stats from './components/Stats';
import Applications from './components/Applications';
import Architecture from './components/Architecture';
import Technology from './components/Technology';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import CookiePolicy from './components/CookiePolicy';
import Footer from './components/Footer';
import AIChat from './components/AIChat';
import Research from './components/Research';
import Community from './components/Community';
import Academy from './components/Academy';
import DeveloperCommunity from './components/DeveloperCommunity';
import ContactUs from './components/ContactUs';
import TokenDynamics from './components/TokenDynamics';
import { Sparkles } from 'lucide-solid';

export type PageType = 'home' | 'research' | 'technology' | 'privacy' | 'community' | 'academy' | 'developer-community' | 'contact' | 'terms' | 'cookies' | 'token-dynamics';

function App() {
  const [isAIModalOpen, setIsAIModalOpen] = createSignal(false);
  const [currentPage, setCurrentPage] = createSignal<PageType>('home');

  const handleNavigation = (page: PageType, sectionId?: string) => {
    setCurrentPage(page);

    // If we are navigating to a section, wait for state update/render then scroll
    if (sectionId) {
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          const offset = 60; // Navbar height + padding
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;
          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });
        }
      }, 100);
    } else {
      // If simply changing page (e.g. to Research, Technology or Home top), scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div class="bg-[#050505] min-h-screen text-white selection:bg-blue-500/30 selection:text-blue-200 relative overflow-hidden">

      <div class="relative z-10">
        <Navbar onNavigate={handleNavigation} />

        <main>
          <Show when={currentPage() === 'home'}>
            <>
              <Hero />

              {/* Stats Section */}
              <Stats />

              {/* Ecosystem Section */}
              <div id="ecosystem">
                <Applications />
              </div>

              {/* Governance/Architecture Section */}
              <div id="governance">
                <Architecture />
              </div>
            </>
          </Show>

          <Show when={currentPage() === 'research'}>
            <div id="research">
              <Research />
            </div>
          </Show>

          <Show when={currentPage() === 'technology'}>
            <div id="technology">
              <Technology />
            </div>
          </Show>

          <Show when={currentPage() === 'token-dynamics'}>
            <div id="token-dynamics">
              <TokenDynamics />
            </div>
          </Show>

          <Show when={currentPage() === 'community'}>
            <div id="community">
              <Community />
            </div>
          </Show>

          <Show when={currentPage() === 'academy'}>
            <div id="academy">
              <Academy />
            </div>
          </Show>

          <Show when={currentPage() === 'developer-community'}>
            <div id="developer-community">
              <DeveloperCommunity />
            </div>
          </Show>

          <Show when={currentPage() === 'contact'}>
            <div id="contact">
              <ContactUs />
            </div>
          </Show>

          <Show when={currentPage() === 'privacy'}>
            <div id="privacy">
              <PrivacyPolicy />
            </div>
          </Show>

          <Show when={currentPage() === 'terms'}>
            <div id="terms">
              <TermsOfService />
            </div>
          </Show>

          <Show when={currentPage() === 'cookies'}>
            <div id="cookies">
              <CookiePolicy />
            </div>
          </Show>
        </main>

        <Footer onNavigate={handleNavigation} />
      </div>

      {/* Floating Action Button for AI if modal closed */}
      <Show when={!isAIModalOpen()}>
        <button
          onClick={() => setIsAIModalOpen(true)}
          class="fixed bottom-8 right-8 p-4 bg-blue-600 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:scale-110 transition-transform z-40 group"
        >
          <Sparkles class="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
        </button>
      </Show>

      {/* AI Hub Modal */}
      <AIChat isOpen={isAIModalOpen()} onClose={() => setIsAIModalOpen(false)} />
    </div>
  );
}

export default App;