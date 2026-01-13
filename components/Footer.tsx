import { createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { A } from '@solidjs/router';
import Logo from './Logo';
import { Twitter, Github, Linkedin, Send, Youtube, BookOpen, Check } from 'lucide-solid';
import { useAuth } from './auth/authContext';
import { useNavigate } from '@solidjs/router';

const Footer = (): JSX.Element => {
  const [email, setEmail] = createSignal('');
  const [isSubmitted, setIsSubmitted] = createSignal(false);

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

  const { user } = useAuth();
  const navigate = useNavigate();

  const handleWalletClick = (e: MouseEvent) => {
    e.preventDefault();
    if (!user()) {
      navigate('/login');
    } else {
      navigate('/wallet');
    }
  };

  return (
    <footer class="bg-[#0b0b0b] text-[#86868b] text-[13px] border-t border-white/5 font-sans">
      <div class="max-w-[980px] mx-auto px-4 py-16">

        <div class="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          {/* Brand Column */}
          <div class="md:col-span-4 space-y-6">
            <A href="/" class="cursor-pointer inline-block">
              <Logo class="w-6 h-6" showText={true} />
            </A>
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
              <A href="/technology" class="text-[#86868b] hover:text-white transition-colors">Technology</A>
              <A href="/research" class="text-[#86868b] hover:text-white transition-colors">Research</A>
              <a href="https://drive.google.com/file/d/1j1Zxg1LbKiZnJTOMUkbMjn7eQLFFRk5f/view?usp=sharing" target="_blank" rel="noopener noreferrer" class="text-[#86868b] hover:text-white transition-colors">Token Dynamics</a>
              <a href="https://drive.google.com/file/d/1gdZwkZ39ilNVy0dn7YuXYUrmpbnglv0v/view?usp=sharing" target="_blank" rel="noopener noreferrer" class="text-[#86868b] hover:text-white transition-colors">Whitepaper</a>
              <a
                href="/wallet"
                onClick={handleWalletClick}
                class="text-[#86868b] hover:text-white transition-colors cursor-pointer"
              >
                Wallet
              </a>
              <A href="/testnet" class="text-[#86868b] hover:text-white transition-colors">Testnet</A>
              <A href="/visionscan" class="text-[#86868b] hover:text-white transition-colors">Vision Scan</A>
            </div>
          </div>

          <div class="md:col-span-2 space-y-4">
            <h4 class="text-white font-medium mb-4">Ecosystem</h4>
            <div class="flex flex-col space-y-3">
              <A href="/community" class="text-[#86868b] hover:text-white transition-colors">Community</A>
              <A href="/academy" class="text-[#86868b] hover:text-white transition-colors">Academy</A>
              <A href="/developer-community" class="text-[#86868b] hover:text-white transition-colors">Developer Hub</A>
              <A href="/contact" class="text-[#86868b] hover:text-white transition-colors">Contact Us</A>
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
            <A href="/privacy" class="text-[#86868b] hover:text-white transition-colors">Privacy Policy</A>
            <A href="/terms" class="text-[#86868b] hover:text-white transition-colors">Terms of Service</A>
            <A href="/cookies" class="text-[#86868b] hover:text-white transition-colors">Cookie Policy</A>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;