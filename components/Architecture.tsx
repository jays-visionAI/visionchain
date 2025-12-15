import { createSignal, For } from 'solid-js';
import type { JSX, Component } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Cpu, Database, Network } from 'lucide-solid';

const colorMap = {
  blue: {
    icon: 'text-blue-400',
    border: 'group-hover:border-blue-500/50',
    glow: 'from-blue-500/10',
    dot: 'bg-blue-400',
    iconBgBorder: 'group-hover:border-blue-500/30'
  },
  purple: {
    icon: 'text-purple-400',
    border: 'group-hover:border-purple-500/50',
    glow: 'from-purple-500/10',
    dot: 'bg-purple-400',
    iconBgBorder: 'group-hover:border-purple-500/30'
  },
  indigo: {
    icon: 'text-indigo-400',
    border: 'group-hover:border-indigo-500/50',
    glow: 'from-indigo-500/10',
    dot: 'bg-indigo-400',
    iconBgBorder: 'group-hover:border-indigo-500/30'
  }
};

interface LayerCardProps {
  title: string;
  subtitle: string;
  icon: Component<{ class?: string }>;
  color: keyof typeof colorMap;
  delay: number;
  features: string[];
}

const LayerCard = (props: LayerCardProps): JSX.Element => {
  const theme = colorMap[props.color];
  const Icon = props.icon;
  let divRef: HTMLDivElement | undefined;
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [opacity, setOpacity] = createSignal(0);

  const handleMouseMove = (e: MouseEvent) => {
    if (!divRef) return;
    const rect = divRef.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      inView={{ opacity: 1 }}
      inViewOptions={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, delay: props.delay }}
      class="relative group z-10"
    >
      {/* Connector Line to Center (Desktop) */}
      <div class="absolute left-1/2 -translate-x-1/2 -top-8 w-[1px] h-8 bg-gradient-to-b from-transparent to-white/20 hidden md:block" />

      <div class="relative rounded-2xl overflow-hidden">
        {/* Moving Light Border Effect */}
        <div class="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
          <div class="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
        </div>

        <div
          ref={divRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          class={`
            relative m-[1px] overflow-hidden rounded-[15px] border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl
            p-6 md:p-8 w-full max-w-2xl mx-auto
            transition-colors duration-500
            ${theme.border}
          `}
        >
          {/* Spotlight Effect */}
          <div
            class="pointer-events-none absolute -inset-px transition duration-300 z-0"
            style={{
              opacity: opacity(),
              background: `radial-gradient(600px circle at ${position().x}px ${position().y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
            }}
          />

          {/* Glow Effect */}
          <div class={`absolute inset-0 bg-gradient-to-r ${theme.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

          <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Icon Box */}
            <div class={`
              w-16 h-16 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center
              group-hover:scale-110 transition-all duration-500
              shadow-lg ${theme.iconBgBorder}
            `}>
              <Icon class={`w-8 h-8 ${theme.icon}`} />
            </div>

            {/* Content */}
            <div class="flex-1 w-full">
              <div class="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-2">
                <h3 class="text-xl md:text-2xl font-semibold text-white tracking-tight">{props.title}</h3>
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5">
                    <div class={`w-1.5 h-1.5 rounded-full ${theme.dot} animate-pulse`} />
                    <span class="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Online</span>
                  </div>
                  <span class="text-[10px] font-mono text-gray-500 border border-white/5 px-2 py-1 rounded-md">V1.0</span>
                </div>
              </div>
              <p class="text-gray-400 text-sm md:text-base font-medium mb-4 leading-relaxed">{props.subtitle}</p>

              {/* Tech Specs / Features */}
              <div class="flex flex-wrap gap-2">
                <For each={props.features}>
                  {(feat) => (
                    <span class="text-[11px] font-mono text-gray-500 bg-white/5 px-2 py-1 rounded border border-white/5 flex items-center gap-1 transition-all duration-300 cursor-default group-hover:text-white group-hover:border-white/30 group-hover:bg-white/10 group-hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                      {feat}
                    </span>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Motion.div>
  );
};

const Architecture = (): JSX.Element => {
  return (
    <section class="bg-[#050505] py-32 relative overflow-hidden border-t border-white/5">
      {/* Background Technical Grid */}
      <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)] opacity-20 pointer-events-none" />

      <div class="max-w-[1200px] mx-auto px-6 relative z-10">

        {/* Header */}
        <div class="text-center mb-24">
          <Motion.div
            initial={{ opacity: 0 }}
            inView={{ opacity: 1 }}
            inViewOptions={{ once: true }}
            class="inline-block mb-4"
          >
            <span class="px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold tracking-wide uppercase">
              System Architecture
            </span>
          </Motion.div>
          <Motion.h2
            initial={{ opacity: 0 }}
            inView={{ opacity: 1 }}
            inViewOptions={{ once: true }}
            transition={{ delay: 0.1 }}
            class="text-4xl md:text-6xl font-semibold text-white tracking-tight mb-6"
          >
            Vertically Integrated Stack.
          </Motion.h2>
          <Motion.p
            initial={{ opacity: 0 }}
            inView={{ opacity: 1 }}
            inViewOptions={{ once: true }}
            transition={{ delay: 0.2 }}
            class="text-xl text-gray-400 max-w-2xl mx-auto"
          >
            Designed from first principles to eliminate bottlenecks between compute, storage, and consensus.
          </Motion.p>
        </div>

        {/* The Diagram Stack */}
        <div class="relative max-w-3xl mx-auto flex flex-col gap-8">

          {/* Central Bus Line Visual (Desktop) */}
          <div class="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] -translate-x-1/2 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent z-0">
            <div class="absolute top-0 left-[-1px] w-[3px] h-32 bg-blue-500/50 blur-[2px] animate-scan" />
          </div>

          {/* Mobile Connecting Line */}
          <div class="md:hidden absolute left-8 top-8 bottom-8 w-[1px] bg-gradient-to-b from-transparent via-blue-500/20 to-transparent z-0" />

          {/* 1. Orchestration Layer (Top) */}
          <LayerCard
            title="Orchestration Layer"
            subtitle="Autonomous agent coordination and intent matching engine. Handles complex workflows."
            icon={Network}
            color="blue"
            delay={0.1}
            features={['Intent Fusion', 'Dutch Auctions', 'Relayer Registry']}
          />

          {/* 2. Storage Layer (Middle) */}
          <LayerCard
            title="Storage Layer"
            subtitle="High-availability data availability sampling with homomorphic hashing for privacy."
            icon={Database}
            color="purple"
            delay={0.15}
            features={['LatticeHash', 'DAS', 'Ephemeral State']}
          />

          {/* 3. Compute Layer (Bottom) */}
          <LayerCard
            title="Compute Layer"
            subtitle="Post-quantum consensus and zero-knowledge execution environment for finality."
            icon={Cpu}
            color="indigo"
            delay={0.2}
            features={['zkVM', 'PoV Consensus', 'Secret Leader Election']}
          />

          {/* 4. Hardware/Foundation (Base) */}
          <Motion.div
            initial={{ opacity: 0, scaleX: 0.8 }}
            inView={{ opacity: 1, scaleX: 1 }}
            inViewOptions={{ once: true }}
            transition={{ delay: 0.25, duration: 0.8 }}
            class="h-1 w-full max-w-md mx-auto bg-gradient-to-r from-transparent via-white/20 to-transparent mt-4"
          />
          <Motion.p
            initial={{ opacity: 0 }}
            inView={{ opacity: 1 }}
            inViewOptions={{ once: true }}
            transition={{ delay: 0.3 }}
            class="text-center text-xs text-gray-400 font-mono uppercase tracking-[0.2em]"
          >
            Physical Infrastructure Layer
          </Motion.p>

        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 4s linear infinite;
        }
      `}</style>
    </section>
  );
};

export default Architecture;