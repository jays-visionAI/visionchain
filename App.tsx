import React, { useState } from 'react';
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
import { Sparkles } from 'lucide-react';

function App() {
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'research' | 'technology' | 'privacy' | 'community' | 'academy' | 'developer-community' | 'contact' | 'terms' | 'cookies' | 'token-dynamics'>('home');

  const handleNavigation = (page: 'home' | 'research' | 'technology' | 'privacy' | 'community' | 'academy' | 'developer-community' | 'contact' | 'terms' | 'cookies' | 'token-dynamics', sectionId?: string) => {
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
    <div className="bg-[#050505] min-h-screen text-white selection:bg-blue-500/30 selection:text-blue-200 relative overflow-hidden">
      
      <div className="relative z-10">
        <Navbar onNavigate={handleNavigation} />
        
        <main>
          {currentPage === 'home' && (
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
          )}

          {currentPage === 'research' && (
            <div id="research">
              <Research />
            </div>
          )}

          {currentPage === 'technology' && (
            <div id="technology">
              <Technology />
            </div>
          )}

          {currentPage === 'token-dynamics' && (
            <div id="token-dynamics">
               <TokenDynamics />
            </div>
          )}

          {currentPage === 'community' && (
            <div id="community">
              <Community />
            </div>
          )}

          {currentPage === 'academy' && (
            <div id="academy">
               <Academy />
            </div>
          )}

          {currentPage === 'developer-community' && (
            <div id="developer-community">
               <DeveloperCommunity />
            </div>
          )}

          {currentPage === 'contact' && (
            <div id="contact">
               <ContactUs />
            </div>
          )}

          {currentPage === 'privacy' && (
            <div id="privacy">
               <PrivacyPolicy />
            </div>
          )}

          {currentPage === 'terms' && (
            <div id="terms">
               <TermsOfService />
            </div>
          )}

          {currentPage === 'cookies' && (
            <div id="cookies">
               <CookiePolicy />
            </div>
          )}
        </main>

        <Footer onNavigate={handleNavigation} />
      </div>

      {/* Floating Action Button for AI if modal closed */}
      {!isAIModalOpen && (
        <button 
          onClick={() => setIsAIModalOpen(true)}
          className="fixed bottom-8 right-8 p-4 bg-blue-600 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:scale-110 transition-transform z-40 group"
        >
          <Sparkles className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* AI Hub Modal */}
      <AIChat isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} />
    </div>
  );
}

export default App;