import { createSignal, createEffect, Show, For } from 'solid-js';
import type { JSX } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import { ChevronDown, Menu, X, Wallet } from 'lucide-solid';
import Logo from './Logo';
import type { PageType } from '../App';

interface NavbarProps {
  onNavigate: (page: PageType, sectionId?: string) => void;
}

interface NavChild {
  label: string;
  page?: PageType;
  href?: string;
  target?: string;
  badge?: string;
}

interface NavItem {
  label: string;
  page?: PageType;
  type: 'link' | 'dropdown';
  children?: NavChild[];
}

const Navbar = (props: NavbarProps): JSX.Element => {
  const [hoveredNav, setHoveredNav] = createSignal<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const [mobileExpandedNav, setMobileExpandedNav] = createSignal<string | null>(null);

  // Lock scroll when mobile menu is open
  createEffect(() => {
    if (mobileMenuOpen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  });

  const navItems: NavItem[] = [
    { label: 'Home', page: 'home', type: 'link' },
    { label: 'Research', page: 'research', type: 'link' },
    { label: 'Technology', page: 'technology', type: 'link' },
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

  const handleNavClick = (e: MouseEvent, page: PageType, section?: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    props.onNavigate(page, section);
  };

  return (
    <>
      <Motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        class="fixed top-0 left-0 w-full z-50 h-[56px] md:h-[44px] bg-[#161617]/80 backdrop-blur-md border-b border-white/[0.08]"
      >
        <div class="max-w-[980px] mx-auto px-4 h-full flex items-center justify-between text-[13px] font-normal tracking-tight text-[#e8e8ed]">
          {/* Logo - click to go home top */}
          <div
            onClick={(e) => handleNavClick(e, 'home')}
            class="flex-shrink-0 cursor-pointer opacity-90 hover:opacity-100 transition-opacity z-50 relative"
          >
            <Logo class="w-5 h-5 md:w-5 md:h-5" showText={true} />
          </div>

          {/* Centered Links - Desktop */}
          <div class="hidden md:flex items-center gap-8">
            <For each={navItems}>
              {(item) => (
                <Show
                  when={item.type === 'dropdown'}
                  fallback={
                    <button
                      onClick={(e) => handleNavClick(e, item.page!)}
                      class="text-[#e8e8ed] hover:text-white transition-colors opacity-80 hover:opacity-100 cursor-pointer bg-transparent border-none p-0 font-normal"
                    >
                      {item.label}
                    </button>
                  }
                >
                  <div
                    class="relative h-full flex items-center"
                    onMouseEnter={() => setHoveredNav(item.label)}
                    onMouseLeave={() => setHoveredNav(null)}
                  >
                    <button
                      class="text-[#e8e8ed] hover:text-white transition-colors opacity-80 hover:opacity-100 cursor-pointer bg-transparent border-none p-0 font-normal flex items-center gap-1"
                    >
                      {item.label}
                      <ChevronDown class={`w-3 h-3 transition-transform duration-200 ${hoveredNav() === item.label ? 'rotate-180' : ''}`} />
                    </button>

                    <Presence>
                      <Show when={hoveredNav() === item.label}>
                        <Motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.95 }}
                          transition={{ duration: 0.15, easing: "ease-out" }}
                          class="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 py-2 bg-[#1d1d1f] border border-white/10 rounded-xl shadow-xl backdrop-blur-xl overflow-hidden"
                        >
                          <div class="flex flex-col">
                            <For each={item.children}>
                              {(child) => (
                                <Show
                                  when={child.page}
                                  fallback={
                                    <a
                                      href={child.href}
                                      target={child.target}
                                      rel={child.target === '_blank' ? "noopener noreferrer" : undefined}
                                      class={`px-4 py-2 text-left text-[#e8e8ed] hover:bg-white/10 hover:text-white transition-colors text-[14px] flex items-center justify-between w-full ${child.badge ? 'cursor-default opacity-50 hover:bg-transparent hover:text-[#e8e8ed]' : ''}`}
                                      onClick={child.badge ? (e) => e.preventDefault() : undefined}
                                    >
                                      <span>{child.label}</span>
                                      {child.badge && (
                                        <span class="text-[9px] uppercase tracking-wide text-blue-400/80 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                                          {child.badge}
                                        </span>
                                      )}
                                    </a>
                                  }
                                >
                                  <button
                                    onClick={(e) => handleNavClick(e, child.page!)}
                                    class="px-4 py-2 text-left text-[#e8e8ed] hover:bg-white/10 hover:text-white transition-colors text-[14px] flex items-center justify-between w-full"
                                  >
                                    <span>{child.label}</span>
                                    {child.badge && (
                                      <span class="text-[9px] uppercase tracking-wide text-blue-400/80 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                                        {child.badge}
                                      </span>
                                    )}
                                  </button>
                                </Show>
                              )}
                            </For>
                          </div>
                        </Motion.div>
                      </Show>
                    </Presence>
                  </div>
                </Show>
              )}
            </For>
          </div>

          {/* Right Actions */}
          <div class="flex items-center gap-4 z-50 relative">
            {/* Desktop Connect Button */}
            <a
              href="https://wallet.visionchain.co/login"
              target="_blank"
              rel="noopener noreferrer"
              class="hidden md:block text-[#2997ff] hover:text-[#58acff] transition-colors cursor-pointer font-medium"
            >
              Connect
            </a>

            {/* Mobile Menu Toggle */}
            <button
              class="md:hidden p-2 text-[#e8e8ed] hover:text-white hover:bg-white/10 rounded-full transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen())}
              aria-label={mobileMenuOpen() ? "Close menu" : "Open menu"}
            >
              <Show when={mobileMenuOpen()} fallback={<Menu class="w-6 h-6" />}>
                <X class="w-6 h-6" />
              </Show>
            </button>
          </div>
        </div>
      </Motion.nav>

      {/* Mobile Menu Overlay */}
      <Presence>
        <Show when={mobileMenuOpen()}>
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: '100vh' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, easing: [0.22, 1, 0.36, 1] }}
            class="fixed top-0 left-0 w-full bg-[#050505] z-40 pt-[70px] px-6 overflow-y-auto md:hidden border-b border-white/10"
          >
            <div class="flex flex-col gap-1 pb-10">
              <For each={navItems}>
                {(item, index) => (
                  <Show
                    when={item.type === 'dropdown'}
                    fallback={
                      <Motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index() * 0.05 }}
                        onClick={(e) => handleNavClick(e, item.page!)}
                        class="text-left py-5 text-[18px] font-medium text-[#f5f5f7] border-b border-white/10 last:border-0"
                      >
                        {item.label}
                      </Motion.button>
                    }
                  >
                    <div class="border-b border-white/10 last:border-0">
                      <button
                        onClick={() => setMobileExpandedNav(mobileExpandedNav() === item.label ? null : item.label)}
                        class="flex items-center justify-between w-full py-5 text-[18px] font-medium text-[#f5f5f7]"
                      >
                        {item.label}
                        <ChevronDown class={`w-5 h-5 transition-transform duration-300 ${mobileExpandedNav() === item.label ? 'rotate-180' : ''}`} />
                      </button>
                      <Presence>
                        <Show when={mobileExpandedNav() === item.label}>
                          <Motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            class="overflow-hidden"
                          >
                            <div class="flex flex-col pl-4 pb-5 gap-4">
                              <For each={item.children}>
                                {(child) => (
                                  <Show
                                    when={child.page}
                                    fallback={
                                      <a
                                        href={child.href}
                                        target={child.target}
                                        class={`text-[16px] text-[#86868b] hover:text-white transition-colors block flex items-center gap-2 ${child.badge ? 'opacity-50 pointer-events-none' : ''}`}
                                      >
                                        {child.label}
                                        {child.badge && <span class="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{child.badge}</span>}
                                      </a>
                                    }
                                  >
                                    <button
                                      onClick={(e) => handleNavClick(e, child.page!)}
                                      class="text-[16px] text-[#86868b] hover:text-white transition-colors block text-left w-full flex items-center gap-2"
                                    >
                                      {child.label}
                                      {child.badge && <span class="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{child.badge}</span>}
                                    </button>
                                  </Show>
                                )}
                              </For>
                            </div>
                          </Motion.div>
                        </Show>
                      </Presence>
                    </div>
                  </Show>
                )}
              </For>

              {/* Mobile Connect Button */}
              <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                class="mt-8"
              >
                <a
                  href="https://wallet.visionchain.co/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center justify-center gap-2 w-full py-4 bg-[#1d1d1f] border border-white/10 text-white rounded-xl font-medium text-[16px] hover:bg-[#2c2c2e] transition-colors"
                >
                  <Wallet class="w-5 h-5 text-[#2997ff]" />
                  Connect Wallet
                </a>
              </Motion.div>
            </div>
          </Motion.div>
        </Show>
      </Presence>
    </>
  );
};

export default Navbar;