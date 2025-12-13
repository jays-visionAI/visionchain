import { createSignal, Show, Switch, Match, For } from 'solid-js';
import type { JSX } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Globe, Layers, Lock, Cpu, ArrowUpRight, ShieldCheck, HardDrive, Activity } from 'lucide-solid';

interface CardVisualProps {
  type: string;
}

const CardVisual = (props: CardVisualProps): JSX.Element => {
  return (
    <Switch fallback={null}>
      <Match when={props.type === 'depin'}>
        <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div class="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent z-0" />
          {/* Animated Grid */}
          <div class="absolute inset-0 opacity-[0.15] bg-[linear-gradient(rgba(41,151,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(41,151,255,0.4)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)] animate-[pulse_8s_ease-in-out_infinite]" />

          {/* Glowing Nodes */}
          <div class="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/20 rounded-full blur-[60px] animate-pulse" />
          <div class="absolute bottom-1/3 right-1/3 w-40 h-40 bg-indigo-500/10 rounded-full blur-[80px] animate-pulse delay-1000" />

          {/* Floating Particles */}
          <div class="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_white] animate-[ping_3s_linear_infinite]" />
        </div>
      </Match>
      <Match when={props.type === 'defi'}>
        <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div class="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent z-0" />
          <svg class="absolute bottom-0 left-0 w-full h-2/3 opacity-20" preserveAspectRatio="none">
            <path d="M0,100 C150,80 200,120 400,50 L400,200 L0,200 Z" fill="url(#grad-defi)" />
            <path d="M0,100 C150,80 200,120 400,50" stroke="#34d399" stroke-width="2" fill="none" vector-effect="non-scaling-stroke" />
            <defs>
              <linearGradient id="grad-defi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#34d399" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#34d399" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </Match>
      <Match when={props.type === 'dao'}>
        <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div class="absolute inset-0 bg-gradient-to-bl from-purple-500/5 to-transparent z-0" />
          {/* Concentric Circles */}
          <div class="absolute -right-10 -bottom-10 w-64 h-64 border border-purple-500/20 rounded-full opacity-50" />
          <div class="absolute -right-10 -bottom-10 w-48 h-48 border border-purple-500/20 rounded-full opacity-50" />
          <div class="absolute -right-10 -bottom-10 w-32 h-32 border border-purple-500/20 rounded-full opacity-50" />
        </div>
      </Match>
      <Match when={props.type === 'identity'}>
        <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div class="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
          <div class="absolute top-4 right-4 text-amber-500/10">
            <ShieldCheck size={120} stroke-width={0.5} />
          </div>
        </div>
      </Match>
      <Match when={props.type === 'compute'}>
        <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent" />
          <div class="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:linear-gradient(to_bottom_right,black,transparent)]" />
        </div>
      </Match>
      <Match when={props.type === 'storage'}>
        <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div class="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent" />
          <div class="absolute bottom-4 right-4 flex gap-1">
            <div class="w-2 h-8 bg-rose-500/20 rounded-full animate-pulse" />
            <div class="w-2 h-12 bg-rose-500/20 rounded-full animate-pulse delay-75" />
            <div class="w-2 h-6 bg-rose-500/20 rounded-full animate-pulse delay-150" />
          </div>
        </div>
      </Match>
    </Switch>
  );
};

interface BentoCardProps {
  title: string;
  subtitle: string;
  icon: JSX.Element;
  class?: string;
  visual?: string;
  accentColor?: string;
}

const BentoCard = (props: BentoCardProps): JSX.Element => {
  let divRef: HTMLDivElement | undefined;
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [opacity, setOpacity] = createSignal(0);

  const handleMouseMove = (e: MouseEvent) => {
    if (!divRef) return;
    const div = divRef;
    const rect = div.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      inView={{ opacity: 1, y: 0 }}
      inViewOptions={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, easing: "ease-out" }}
      class={`
        relative overflow-hidden rounded-[24px] flex flex-col justify-between group 
        border border-white/5 
        hover:shadow-2xl transition-all duration-300 hover:-translate-y-1
        ${props.class ?? ''}
      `}
    >
      {/* Moving Light Border Effect - Extra Long Tail */}
      <div class="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
        <div class="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
      </div>

      {/* Inner Content Container */}
      <div
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        class="relative h-full m-[1px] rounded-[23px] bg-[#0c0c0c] p-8 flex flex-col justify-between overflow-hidden z-10"
      >
        {/* Spotlight Effect */}
        <div
          class="pointer-events-none absolute -inset-px transition duration-300 z-0"
          style={{
            opacity: opacity(),
            background: `radial-gradient(600px circle at ${position().x}px ${position().y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
          }}
        />

        {/* Background Visuals */}
        <Show when={props.visual}>
          <CardVisual type={props.visual!} />
        </Show>

        {/* Content Layer */}
        <div class="relative z-10 flex flex-col h-full justify-between">
          <div>
            {/* Header */}
            <div class="flex justify-between items-start mb-6">
              <div class={`
                 w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center 
                 text-white/80 group-hover:text-white group-hover:scale-110 group-hover:bg-white/10 
                 transition-all duration-300 shadow-inner
               `}>
                {props.icon}
              </div>
              <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
                <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <ArrowUpRight class="w-4 h-4 text-white/50" />
                </div>
              </div>
            </div>

            <h3 class="text-2xl font-semibold text-white tracking-tight mb-3 group-hover:text-blue-200 transition-colors">
              {props.title}
            </h3>
            <p class="text-gray-400 text-sm leading-relaxed font-medium group-hover:text-gray-300 transition-colors max-w-lg">
              {props.subtitle}
            </p>
          </div>

          {/* Bottom Decoration line */}
          <div class="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mt-6 opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Motion.div>
  );
};

const Applications = (): JSX.Element => {
  return (
    <section class="bg-[#050505] py-32 border-t border-white/5 relative">
      {/* Subtle Background Mesh */}
      <div class="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px] opacity-20 pointer-events-none" />

      <div class="max-w-[1200px] mx-auto px-6 relative z-10">
        <div class="text-center mb-20">
          <Motion.span
            initial={{ opacity: 0, y: 10 }}
            inView={{ opacity: 1, y: 0 }}
            inViewOptions={{ once: true }}
            class="text-blue-500 font-semibold tracking-wide uppercase text-xs mb-3 block"
          >
            Ecosystem Applications
          </Motion.span>
          <Motion.h2
            initial={{ opacity: 0, y: 10 }}
            inView={{ opacity: 1, y: 0 }}
            inViewOptions={{ once: true }}
            transition={{ delay: 0.1 }}
            class="text-4xl md:text-6xl font-semibold text-white tracking-tight mb-6"
          >
            Built for Agents.
          </Motion.h2>
          <Motion.p
            initial={{ opacity: 0, y: 10 }}
            inView={{ opacity: 1, y: 0 }}
            inViewOptions={{ once: true }}
            transition={{ delay: 0.2 }}
            class="text-xl text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed"
          >
            A unified platform powering the next generation of autonomous economic actors.
            From physical infrastructure to financial derivatives.
          </Motion.p>
        </div>

        {/* Top Grid */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Main Large Card (DePIN) - Spans 2 cols */}
          <BentoCard
            class="lg:col-span-2 min-h-[420px]"
            title="DePIN Infrastructure"
            subtitle="Connect physical hardware to AI logic. Agents can rent, manage, and monetize computational resources in real-time with millisecond latency."
            icon={<Globe class="w-6 h-6" />}
            visual="depin"
          />

          {/* Right Column Stack */}
          <div class="flex flex-col gap-6 h-full">
            <BentoCard
              class="flex-1 min-h-[200px]"
              title="Data Driven DeFi"
              subtitle="High-frequency settlement layers optimized for bot-to-bot commerce and liquidity."
              icon={<Activity class="w-6 h-6" />}
              visual="defi"
            />
            <BentoCard
              class="flex-1 min-h-[200px]"
              title="Dynamic DAOs"
              subtitle="Reputation-based governance systems designed specifically for AI agents."
              icon={<Layers class="w-6 h-6" />}
              visual="dao"
            />
          </div>
        </div>

        {/* Bottom Row */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BentoCard
            title="Secure Identity"
            subtitle="Cryptographic provenance (DID) for AI models."
            icon={<Lock class="w-6 h-6" />}
            class="min-h-[260px]"
            visual="identity"
          />
          <BentoCard
            title="Verifiable Compute"
            subtitle="Zero-knowledge proofs for off-chain workloads."
            icon={<Cpu class="w-6 h-6" />}
            class="min-h-[260px]"
            visual="compute"
          />
          <BentoCard
            title="Decentralized Storage"
            subtitle="High-availability data layers for model weights."
            icon={<HardDrive class="w-6 h-6" />}
            class="min-h-[260px]"
            visual="storage"
          />
        </div>

      </div>
    </section>
  );
};

export default Applications;