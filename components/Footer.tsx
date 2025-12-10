import React, { useState } from 'react';
import Logo from './Logo';
import { Twitter, Github, Linkedin, Send, Youtube, BookOpen, Check } from 'lucide-react';

interface FooterProps {
  onNavigate?: (page: 'home' | 'research' | 'technology' | 'privacy' | 'community' | 'academy' | 'developer-community' | 'contact' | 'terms' | 'cookies' | 'token-dynamics', sectionId?: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
    
  const handleLinkClick = (e: React.MouseEvent, page: 'home' | 'research' | 'technology' | 'privacy' | 'community' | 'academy' | 'developer-community' | 'contact' | 'terms' | 'cookies' | 'token-dynamics', sectionId?: string) => {
    e.preventDefault();
    if (onNavigate) {
        onNavigate(page, sectionId);
    }
  }

  const handleSubscribe = (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) return;

      const subject = "Newsletter Subscription";
      const body = `Please subscribe the following email to the Vision Chain newsletter:\n\n${email}`;
      const mailtoUrl = `mailto:jp@visai.io?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      window.location.href = mailtoUrl;
      
      setIsSubmitted(true);
      setEmail('');
      
      // Reset success state after a delay
      setTimeout(() => setIsSubmitted(false), 3000);
  };

  return (
    <footer className="bg-[#0b0b0b] text-[#86868b] text-[13px] border-t border-white/5 font-sans">
      <div className="max-w-[980px] mx-auto px-4 py-16">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
            {/* Brand Column */}
            <div className="md:col-span-4 space-y-6">
                <div onClick={(e) => handleLinkClick(e, 'home')} className="cursor-pointer inline-block">
                     <Logo className="w-6 h-6" showText={true} />
                </div>
                <p className="max-w-xs leading-relaxed text-gray-500">
                    The first Agentic AI Blockchain. Empowering autonomous agents with seamless access to identity, compute, and liquidity.
                </p>
                <div className="flex gap-5">
                    <a href="http://t.me/visionchaingroup" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="Telegram"><Send className="w-4 h-4" /></a>
                    <a href="https://x.com/VCN_VisionChain" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="Twitter"><Twitter className="w-4 h-4" /></a>
                    <a href="https://medium.com/@OfficialVisionChain" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="Medium"><BookOpen className="w-4 h-4" /></a>
                    <a href="https://www.linkedin.com/company/visionchain/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="LinkedIn"><Linkedin className="w-4 h-4" /></a>
                    <a href="https://www.youtube.com/@Vision-yw1ww" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="YouTube"><Youtube className="w-4 h-4" /></a>
                    <a href="https://github.com/VisionChainNetwork" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="Github"><Github className="w-4 h-4" /></a>
                </div>
            </div>

            {/* Links Columns */}
            <div className="md:col-span-2 space-y-4">
                <h4 className="text-white font-medium mb-4">Protocol</h4>
                <div className="flex flex-col space-y-3">
                    <button onClick={(e) => handleLinkClick(e, 'technology')} className="text-left hover:text-blue-400 transition-colors">Technology</button>
                    <button onClick={(e) => handleLinkClick(e, 'research')} className="text-left hover:text-blue-400 transition-colors">Research</button>
                    <button onClick={(e) => handleLinkClick(e, 'token-dynamics')} className="text-left hover:text-blue-400 transition-colors">Token Dynamics</button>
                    <a href="https://drive.google.com/file/d/1gdZwkZ39ilNVy0dn7YuXYUrmpbnglv0v/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">Whitepaper</a>
                </div>
            </div>

             <div className="md:col-span-2 space-y-4">
                <h4 className="text-white font-medium mb-4">Ecosystem</h4>
                <div className="flex flex-col space-y-3">
                    <button onClick={(e) => handleLinkClick(e, 'community')} className="text-left hover:text-blue-400 transition-colors">Community</button>
                    <button onClick={(e) => handleLinkClick(e, 'academy')} className="text-left hover:text-blue-400 transition-colors">Academy</button>
                    <button onClick={(e) => handleLinkClick(e, 'developer-community')} className="text-left hover:text-blue-400 transition-colors">Developer Hub</button>
                    <button onClick={(e) => handleLinkClick(e, 'contact')} className="text-left hover:text-blue-400 transition-colors">Contact Us</button>
                </div>
            </div>

            {/* Newsletter Column */}
            <div className="md:col-span-4 space-y-4">
                <h4 className="text-white font-medium mb-4">Stay updated</h4>
                <p className="text-gray-500 mb-4">Get the latest updates on Vision Chain development and ecosystem growth.</p>
                <form onSubmit={handleSubscribe} className="relative max-w-sm">
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email" 
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                    />
                    <button 
                        type="submit"
                        className={`absolute right-1.5 top-1.5 p-1.5 rounded-md text-white transition-colors ${isSubmitted ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                    >
                        {isSubmitted ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                    </button>
                </form>
            </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
           <div>
             <p>© 2025 Vision Chain Foundation. All rights reserved.</p>
           </div>
           <div className="flex gap-8">
             <button onClick={(e) => handleLinkClick(e, 'privacy')} className="hover:text-white transition-colors">Privacy Policy</button>
             <button onClick={(e) => handleLinkClick(e, 'terms')} className="hover:text-white transition-colors">Terms of Service</button>
             <button onClick={(e) => handleLinkClick(e, 'cookies')} className="hover:text-white transition-colors">Cookie Policy</button>
           </div>
        </div>
        
      </div>
    </footer>
  );
};

export default Footer;