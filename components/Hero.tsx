import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { Wallet } from 'lucide-solid';
import LogoCarousel from './LogoCarousel';
import ParticleNetwork3D from './ParticleNetwork3D';
import CursorLightTrace from './CursorLightTrace';

import { useNavigate } from '@solidjs/router';
import { useAuth } from './auth/authContext';

const Hero = (): JSX.Element => {
  let sectionRef: HTMLElement | undefined;
  const [scrollProgress, setScrollProgress] = createSignal(0);
  const [isReady, setIsReady] = createSignal(false);
  const navigate = useNavigate();
  const auth = useAuth(); // Assuming useAuth provides auth.user()

  onMount(() => {
    // ... existing onMount logic ...
    // Use requestAnimationFrame to ensure DOM is painted before triggering animations
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsReady(true);
      });
    });

    const handleScroll = () => {
      if (!sectionRef) return;
      const rect = sectionRef.getBoundingClientRect();
      const sectionHeight = sectionRef.offsetHeight;
      const viewportHeight = window.innerHeight;

      // Calculate progress from 0 (section top at viewport top) to 1 (section bottom at viewport top)
      const progress = Math.max(0, Math.min(1, -rect.top / (sectionHeight - viewportHeight)));
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    onCleanup(() => {
      window.removeEventListener('scroll', handleScroll);
    });
  });

  // Derived values from scroll progress
  const bgY = () => `${scrollProgress() * 30}%`;
  const opacity = () => 1 - scrollProgress() * 0.8;
  const textScale = () => 1 + scrollProgress() * 0.15;

  const handleConnect = (e: Event) => {
    e.preventDefault();
    if (auth.user()) {
      navigate('/wallet');
    } else {
      navigate('/login');
    }
  };

  return (
    <section
      ref={sectionRef}
      class="relative min-h-[100vh] flex flex-col pt-32 overflow-hidden bg-transparent selection:bg-blue-500/30"
    >
      {/* ... styles ... */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .hero-animate-1 {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .hero-animate-2 {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
          opacity: 0;
        }
        .hero-animate-3 {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
          opacity: 0;
        }
        .hero-animate-4 {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          opacity: 0;
        }
        .hero-bg-animate {
          animation: fadeIn 1.2s ease-out forwards;
          opacity: 0;
        }
        .hero-carousel-animate {
          animation: fadeIn 1s ease-out 0.5s forwards;
          opacity: 0;
        }
      `}</style>

      {/* Background Layer: Gradients & Grid - Slow Parallax */}
      <div
        class={`absolute inset-0 z-0 pointer-events-none ${isReady() ? 'hero-bg-animate' : ''}`}
        style={{
          transform: `translateY(${bgY()})`,
          opacity: isReady() ? undefined : 0,
          '--scroll-opacity': opacity()
        }}
      >
        <div class="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-900/20 blur-[150px] rounded-full animate-pulse duration-[8000ms]" />
        <div class="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/20 blur-[150px] rounded-full animate-pulse duration-[10000ms]" />

        {/* Technical Grid Overlay */}
        <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:128px_128px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
      </div>

      {/* 3D Particle Network Layer - Only render when ready */}
      <Show when={isReady()}>
        <div class="absolute inset-0 z-0 hero-bg-animate" style={{ opacity: opacity() }}>
          <ParticleNetwork3D />
        </div>
      </Show>

      {/* Cursor Follow Light Trace Layer - Only render when ready */}
      <Show when={isReady()}>
        <div class="absolute inset-0 z-0 pointer-events-none hero-bg-animate" style={{ opacity: opacity() }}>
          <CursorLightTrace />
        </div>
      </Show>

      {/* Text Content Container */}
      <div
        class="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center flex-grow justify-center pb-20 mt-10"
      >
        <div class="flex flex-col items-center">
          {/* H1 - Product Name */}
          <h1
            class={`text-4xl md:text-6xl lg:text-7xl font-semibold text-white mb-6 tracking-tighter drop-shadow-2xl ${isReady() ? 'hero-animate-1' : 'opacity-0'}`}
            style={{ transform: `scale(${textScale()})` }}
          >
            Vision Chain.
          </h1>

          {/* H2 - Tagline */}
          <h2
            class={`text-xl md:text-3xl lg:text-4xl font-medium text-[#f5f5f7] mb-8 tracking-tight ${isReady() ? 'hero-animate-2' : 'opacity-0'}`}
          >
            Universal Interoperability. <span class="text-[#86868b]">For the Agentic Economy.</span>
          </h2>

          {/* Description */}
          <p
            class={`text-[#86868b] text-sm md:text-base font-normal max-w-2xl mb-12 leading-relaxed ${isReady() ? 'hero-animate-3' : 'opacity-0'}`}
          >
            The first L1 blockchain engineered to unify fragmented ecosystems. <br class="hidden md:block" />
            Empowering autonomous agents with seamless access to identity, compute, and liquidity across any chain.
          </p>

          {/* Links */}
          <div
            class={`flex flex-col sm:flex-row items-center gap-6 sm:gap-10 text-[15px] md:text-[17px] justify-center ${isReady() ? 'hero-animate-4' : 'opacity-0'}`}
          >
            <button
              onClick={handleConnect}
              class="px-8 py-3 bg-[#f5f5f7] text-black rounded-full font-medium hover:bg-white transition-all hover:scale-105 flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.6)] cursor-pointer"
            >
              <Wallet class="w-4 h-4" />
              Connect
            </button>
          </div>
        </div>

        {/* Spacer */}
        <div class="h-20" />

      </div>

      {/* Carousel at bottom */}
      <div
        class={`w-full relative z-20 mt-auto ${isReady() ? 'hero-carousel-animate' : 'opacity-0'}`}
      >
        <LogoCarousel />
      </div>
    </section>
  );
};

export default Hero;