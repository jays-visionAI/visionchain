import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Menu, X, Wallet } from 'lucide-react';
import Logo from './Logo';

interface NavbarProps {
  onNavigate: (page: 'home' | 'research' | 'technology' | 'privacy' | 'community' | 'academy' | 'developer-community' | 'contact' | 'terms' | 'cookies' | 'token-dynamics', sectionId?: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedNav, setMobileExpandedNav] = useState<string | null>(null);
  
  // Lock scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [mobileMenuOpen]);

  const navItems = [
    { label: 'Home', page: 'home' as const, type: 'link' },
    { label: 'Research', page: 'research' as const, type: 'link' },
    { label: 'Technology', page: 'technology' as const, type: 'link' },
    {
      label: 'Ecosystem',
      type: 'dropdown',
      children: [
        { label: 'Community', page: 'community' },
        { label: 'Academy', page: 'academy' },
        { label: 'Developer Hub', page: 'developer-community' },
        { label: 'Contact Us', page: 'contact' }
      ]
    },
    { 
      label: 'Learn', 
      type: 'dropdown',
      children: [
        { label: 'Newsletter', href: 'https://www.linkedin.com/newsletters/visionchaincollective-7345370837543198720/', target: '_blank' },
        { label: 'Whitepaper', href: 'https://drive.google.com/file/d/1gdZwkZ39ilNVy0dn7YuXYUrmpbnglv0v/view?usp=sharing', target: '_blank' },
        { label: 'Token Dynamics', page: 'token-dynamics' }
      ]
    }
  ];

  const handleNavClick = (e: React.MouseEvent, page: 'home' | 'research' | 'technology' | 'privacy' | 'community' | 'academy' | 'developer-community' | 'contact' | 'terms' | 'cookies' | 'token-dynamics', section?: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onNavigate(page, section);
  };

  return (
    <>
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 w-full z-50 h-[56px] md:h-[44px] bg-[#161617]/80 backdrop-blur-md border-b border-white/[0.08]"
      >
        <div className="max-w-[980px] mx-auto px-4 h-full flex items-center justify-between text-[13px] font-normal tracking-tight text-[#e8e8ed]">
          {/* Logo - click to go home top */}
          <div 
            onClick={(e) => handleNavClick(e, 'home')}
            className="flex-shrink-0 cursor-pointer opacity-90 hover:opacity-100 transition-opacity z-50 relative"
          >
             <Logo className="w-5 h-5 md:w-5 md:h-5" showText={true} />
          </div>

          {/* Centered Links - Desktop */}
          <div className="hidden md:flex items-center gap-8">
             {navItems.map((item) => {
               if (item.type === 'dropdown') {
                 return (
                   <div 
                     key={item.label}
                     className="relative h-full flex items-center"
                     onMouseEnter={() => setHoveredNav(item.label)}
                     onMouseLeave={() => setHoveredNav(null)}
                   >
                     <button 
                       className="text-[#e8e8ed] hover:text-white transition-colors opacity-80 hover:opacity-100 cursor-pointer bg-transparent border-none p-0 font-normal flex items-center gap-1"
                     >
                       {item.label}
                       <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${hoveredNav === item.label ? 'rotate-180' : ''}`} />
                     </button>
                     
                     <AnimatePresence>
                       {hoveredNav === item.label && (
                         <motion.div
                           initial={{ opacity: 0, y: 10, scale: 0.95 }}
                           animate={{ opacity: 1, y: 0, scale: 1 }}
                           exit={{ opacity: 0, y: 5, scale: 0.95 }}
                           transition={{ duration: 0.15, ease: "easeOut" }}
                           className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 py-2 bg-[#1d1d1f] border border-white/10 rounded-xl shadow-xl backdrop-blur-xl overflow-hidden"
                         >
                            <div className="flex flex-col">
                              {item.children?.map((child: any) => {
                                // Logic to determine if it's an internal page link or external href
                                const isInternal = !!child.page;
                                const isBadge = !!child.badge;
                                
                                if (isInternal) {
                                  return (
                                    <button
                                      key={child.label}
                                      onClick={(e) => handleNavClick(e, child.page)}
                                      className="px-4 py-2 text-left text-[#e8e8ed] hover:bg-white/10 hover:text-white transition-colors text-[14px] flex items-center justify-between w-full"
                                    >
                                      <span>{child.label}</span>
                                      {child.badge && (
                                        <span className="text-[9px] uppercase tracking-wide text-blue-400/80 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                                          {child.badge}
                                        </span>
                                      )}
                                    </button>
                                  );
                                }

                                return (
                                  <a 
                                    key={child.label}
                                    href={child.href}
                                    target={child.target}
                                    rel={child.target === '_blank' ? "noopener noreferrer" : undefined}
                                    className={`px-4 py-2 text-left text-[#e8e8ed] hover:bg-white/10 hover:text-white transition-colors text-[14px] flex items-center justify-between w-full ${isBadge ? 'cursor-default opacity-50 hover:bg-transparent hover:text-[#e8e8ed]' : ''}`}
                                    onClick={isBadge ? (e) => e.preventDefault() : undefined}
                                  >
                                    <span>{child.label}</span>
                                    {child.badge && (
                                       <span className="text-[9px] uppercase tracking-wide text-blue-400/80 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                                          {child.badge}
                                       </span>
                                    )}
                                  </a>
                                );
                              })}
                            </div>
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                 );
               }

               return (
                 <button
                   key={item.label} 
                   onClick={(e) => handleNavClick(e, item.page as any)}
                   className="text-[#e8e8ed] hover:text-white transition-colors opacity-80 hover:opacity-100 cursor-pointer bg-transparent border-none p-0 font-normal"
                 >
                   {item.label}
                 </button>
               );
             })}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4 z-50 relative">
             {/* Desktop Connect Button */}
             <a 
               href="https://wallet.visionchain.co/login"
               target="_blank"
               rel="noopener noreferrer"
               className="hidden md:block text-[#2997ff] hover:text-[#58acff] transition-colors cursor-pointer font-medium"
             >
               Connect
             </a>

             {/* Mobile Menu Toggle */}
             <button 
               className="md:hidden p-2 text-[#e8e8ed] hover:text-white hover:bg-white/10 rounded-full transition-colors"
               onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
               aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
             >
               {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
             </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: '100vh' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 w-full bg-[#050505] z-40 pt-[70px] px-6 overflow-y-auto md:hidden border-b border-white/10"
          >
            <div className="flex flex-col gap-1 pb-10">
              {navItems.map((item, index) => {
                if (item.type === 'dropdown') {
                   const isExpanded = mobileExpandedNav === item.label;
                   return (
                     <div key={item.label} className="border-b border-white/10 last:border-0">
                       <button 
                         onClick={() => setMobileExpandedNav(isExpanded ? null : item.label)}
                         className="flex items-center justify-between w-full py-5 text-[18px] font-medium text-[#f5f5f7]"
                       >
                         {item.label}
                         <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                       </button>
                       <AnimatePresence>
                         {isExpanded && (
                           <motion.div
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: 'auto', opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="overflow-hidden"
                           >
                             <div className="flex flex-col pl-4 pb-5 gap-4">
                               {item.children?.map((child: any) => {
                                 const isInternal = !!child.page;
                                 if (isInternal) {
                                     return (
                                        <button 
                                          key={child.label}
                                          onClick={(e) => handleNavClick(e, child.page)}
                                          className="text-[16px] text-[#86868b] hover:text-white transition-colors block text-left w-full flex items-center gap-2"
                                        >
                                          {child.label}
                                          {child.badge && <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{child.badge}</span>}
                                        </button>
                                     )
                                 }
                                 return (
                                   <a 
                                     key={child.label}
                                     href={child.href}
                                     target={child.target}
                                     className={`text-[16px] text-[#86868b] hover:text-white transition-colors block flex items-center gap-2 ${child.badge ? 'opacity-50 pointer-events-none' : ''}`}
                                   >
                                     {child.label}
                                     {child.badge && <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{child.badge}</span>}
                                   </a>
                                 )
                               })}
                             </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </div>
                   )
                }
                
                return (
                   <motion.button
                     key={item.label}
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: index * 0.05 }}
                     onClick={(e) => handleNavClick(e, item.page as any)}
                     className="text-left py-5 text-[18px] font-medium text-[#f5f5f7] border-b border-white/10 last:border-0"
                   >
                     {item.label}
                   </motion.button>
                );
              })}

              {/* Mobile Connect Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-8"
              >
                  <a 
                    href="https://wallet.visionchain.co/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-[#1d1d1f] border border-white/10 text-white rounded-xl font-medium text-[16px] hover:bg-[#2c2c2e] transition-colors"
                  >
                    <Wallet className="w-5 h-5 text-[#2997ff]" />
                    Connect Wallet
                  </a>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;