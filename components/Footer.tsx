import { createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import Logo from './Logo';
import { Twitter, Github, Linkedin, Send, Youtube, BookOpen, Check } from 'lucide-solid';
import type { PageType } from '../App';

interface FooterProps {
  onNavigate?: (page: PageType, sectionId?: string) => void;
}

const Footer = (props: FooterProps): JSX.Element => {
  const [email, setEmail] = createSignal('');
  const [isSubmitted, setIsSubmitted] = createSignal(false);

  const handleLinkClick = (e: MouseEvent, page: PageType, sectionId?: string) => {
    e.preventDefault();
    if (props.onNavigate) {
      props.onNavigate(page, sectionId);
    }
  }

  const handleSubscribe = (e: SubmitEvent) => {
    e.preventDefault();
    if (!email()) return;

    const subject = "Newsletter Subscription";
    const body = `Please subscribe the following email to the Vision Chain newsletter:\n\n${email()}`;
    const mailtoUrl = `mailto:jp@visai.io?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;

    setIsSubmitted(true);
    setEmail('');

    // Reset success state after a delay
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  return (
    <footer class="bg-[#0b0b0b] text-[#86868b] text-[13px] border-t border-white/5 font-sans">
      <div class="max-w-[980px] mx-auto px-4 py-16">

        <div class="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          {/* Brand Column */}
          <div class="md:col-span-4 space-y-6">
            <div onClick={(e) => handleLinkClick(e, 'home')} class="cursor-pointer inline-block">
              <Logo class="w-6 h-6" showText={true} />
            </div>
            <p class="max-w-xs leading-relaxed text-gray-500">
              The first Agentic AI Blockchain. Empowering autonomous agents with seamless access to identity, compute, and liquidity.
            </p>
            <div class="flex gap-5">
              <a href="http://t.me/visionchaingroup" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-white transition-colors" aria-label="Telegram"><Send class="w-4 h-4" /></a>
              <a href="https://x.com/VCN_VisionChain" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-white transition-colors" aria-label="Twitter"><Twitter class="w-4 h-4" /></a>
              <a href="https://medium.com/@OfficialVisionChain" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-white transition-colors" aria-label="Medium"><BookOpen class="w-4 h-4" /></a>
              <a href="https://www.linkedin.com/company/visionchain/" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-white transition-colors" aria-label="LinkedIn"><Linkedin class="w-4 h-4" /></a>
              <a href="https://www.youtube.com/@Vision-yw1ww" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-white transition-colors" aria-label="YouTube"><Youtube class="w-4 h-4" /></a>
              <a href="https://github.com/VisionChainNetwork" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-white transition-colors" aria-label="Github"><Github class="w-4 h-4" /></a>
            </div>
          </div>

          {/* Links Columns */}
          <div class="md:col-span-2 space-y-4">
            <h4 class="text-white font-medium mb-4">Protocol</h4>
            <div class="flex flex-col space-y-3">
              <button onClick={(e) => handleLinkClick(e, 'technology')} class="text-left hover:text-blue-400 transition-colors">Technology</button>
              <button onClick={(e) => handleLinkClick(e, 'research')} class="text-left hover:text-blue-400 transition-colors">Research</button>
              <button onClick={(e) => handleLinkClick(e, 'token-dynamics')} class="text-left hover:text-blue-400 transition-colors">Token Dynamics</button>
              <a href="https://drive.google.com/file/d/1gdZwkZ39ilNVy0dn7YuXYUrmpbnglv0v/view?usp=sharing" target="_blank" rel="noopener noreferrer" class="hover:text-blue-400 transition-colors">Whitepaper</a>
            </div>
          </div>

          <div class="md:col-span-2 space-y-4">
            <h4 class="text-white font-medium mb-4">Ecosystem</h4>
            <div class="flex flex-col space-y-3">
              <button onClick={(e) => handleLinkClick(e, 'community')} class="text-left hover:text-blue-400 transition-colors">Community</button>
              <button onClick={(e) => handleLinkClick(e, 'academy')} class="text-left hover:text-blue-400 transition-colors">Academy</button>
              <button onClick={(e) => handleLinkClick(e, 'developer-community')} class="text-left hover:text-blue-400 transition-colors">Developer Hub</button>
              <button onClick={(e) => handleLinkClick(e, 'contact')} class="text-left hover:text-blue-400 transition-colors">Contact Us</button>
            </div>
          </div>

          {/* Newsletter Column */}
          <div class="md:col-span-4 space-y-4">
            <h4 class="text-white font-medium mb-4">Stay updated</h4>
            <p class="text-gray-500 mb-4">Get the latest updates on Vision Chain development and ecosystem growth.</p>
            <form onSubmit={handleSubscribe} class="relative max-w-sm">
              <input
                type="email"
                required
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                placeholder="Enter your email"
                class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
              />
              <button
                type="submit"
                class={`absolute right-1.5 top-1.5 p-1.5 rounded-md text-white transition-colors ${isSubmitted() ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                <Show when={isSubmitted()} fallback={<Send class="w-3 h-3" />}>
                  <Check class="w-3 h-3" />
                </Show>
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div class="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p>© 2025 Vision Chain Foundation. All rights reserved.</p>
          </div>
          <div class="flex gap-8">
            <button onClick={(e) => handleLinkClick(e, 'privacy')} class="hover:text-white transition-colors">Privacy Policy</button>
            <button onClick={(e) => handleLinkClick(e, 'terms')} class="hover:text-white transition-colors">Terms of Service</button>
            <button onClick={(e) => handleLinkClick(e, 'cookies')} class="hover:text-white transition-colors">Cookie Policy</button>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;