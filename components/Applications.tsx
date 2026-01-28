import { createSignal, Show, Switch, Match, For } from 'solid-js';
import type { JSX } from 'solid-js';
import { Globe, Layers, Lock, Cpu, ArrowUpRight, ShieldCheck, HardDrive, Activity, BookOpen } from 'lucide-solid';
import { A } from '@solidjs/router';
import { SectionHeader } from './public/SectionHeader';
import { FeatureCard } from './public/FeatureCard';
import { FadeIn } from './public/FadeIn';

const CardVisual = (props: { type: string }): JSX.Element => {
  return (
    <Switch fallback={null}>
      <Match when={props.type === 'depin'}>
        <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div class="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent z-0" />
          <div class="absolute inset-0 opacity-[0.15] bg-[linear-gradient(rgba(41,151,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(41,151,255,0.4)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)] animate-[pulse_8s_ease-in-out_infinite]" />
          <div class="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/20 rounded-full blur-[60px] animate-pulse" />
          <div class="absolute bottom-1/3 right-1/3 w-40 h-40 bg-indigo-500/10 rounded-full blur-[80px] animate-pulse delay-1000" />
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

const Applications = (): JSX.Element => {
  return (
    <section class="bg-[#050505] py-32 border-t border-white/5 relative">
      <div class="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px] opacity-20 pointer-events-none" />

      <div class="max-w-[1200px] mx-auto px-6 relative z-10">
        <SectionHeader
          label="Ecosystem Applications"
          title="Built for Agents."
          description="A unified platform powering the next generation of autonomous economic actors. From physical infrastructure to financial derivatives."
        />

        {/* Top Grid */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <FeatureCard
            class="lg:col-span-2 min-h-[420px]"
            title="DePIN Infrastructure"
            description="Connect physical hardware to AI logic. Agents can rent, manage, and monetize computational resources in real-time with millisecond latency."
            icon={<Globe class="w-6 h-6" />}
            visual={<CardVisual type="depin" />}
          />

          <div class="flex flex-col gap-6 h-full">
            <FeatureCard
              class="flex-1 min-h-[200px]"
              title="Data Driven DeFi"
              description="High-frequency settlement layers optimized for bot-to-bot commerce and liquidity."
              icon={<Activity class="w-6 h-6" />}
              visual={<CardVisual type="defi" />}
            />
            <FeatureCard
              class="flex-1 min-h-[200px]"
              title="Dynamic DAOs"
              description="Reputation-based governance systems designed specifically for AI agents."
              icon={<Layers class="w-6 h-6" />}
              visual={<CardVisual type="dao" />}
            />
          </div>
        </div>

        {/* Bottom Row */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <FeatureCard
            title="Secure Identity"
            description="Cryptographic provenance (DID) for AI models."
            icon={<Lock class="w-6 h-6" />}
            class="min-h-[260px]"
            visual={<CardVisual type="identity" />}
          />
          <FeatureCard
            title="Verifiable Compute"
            description="Zero-knowledge proofs for off-chain workloads."
            icon={<Cpu class="w-6 h-6" />}
            class="min-h-[260px]"
            visual={<CardVisual type="compute" />}
          />
          <FeatureCard
            title="Decentralized Storage"
            description="High-availability data layers for model weights."
            icon={<HardDrive class="w-6 h-6" />}
            class="min-h-[260px]"
            visual={<CardVisual type="storage" />}
          />
        </div>

        {/* Developer & Testing Section */}
        <div class="mt-32 pt-20 border-t border-white/5">
          <div class="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
            <SectionHeader
              class="mb-0 !text-left"
              centered={false}
              label="Developer Hub"
              title="Labs & Testing."
              description="Advanced environment for stress testing, auditing, and simulating mass economic interactions before mainnet deployment."
            />
            <div class="flex items-center gap-4 mb-4">
              <a
                href="/docs/vision-chain-testnet-developer-manual.md"
                target="_blank"
                class="px-8 py-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-2xl flex items-center gap-3 transition-all group"
              >
                <BookOpen class="w-4 h-4 text-blue-400" />
                <span class="text-xs font-bold text-blue-400 uppercase tracking-widest">View Manual</span>
              </a>
              <A href="/trafficsim" class="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 transition-all group">
                <span class="text-sm font-bold text-white uppercase tracking-widest">Enter Developer Console</span>
                <ArrowUpRight class="w-4 h-4 text-blue-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </A>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <A href="/trafficsim" class="group block">
              <div class="bg-gradient-to-br from-blue-600/20 to-transparent border border-blue-500/20 rounded-[40px] p-10 h-full hover:border-blue-500/40 transition-all">
                <div class="flex justify-between items-start mb-10">
                  <div class="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <Activity class="w-8 h-8" />
                  </div>
                  <span class="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest">Independent Module</span>
                </div>
                <h3 class="text-3xl font-black italic text-white mb-4 group-hover:text-blue-300 transition-colors">TRAFFIC SIMULATOR</h3>
                <p class="text-gray-400 font-medium leading-relaxed mb-8">
                  Generate high-frequency synthetic transactions, manage randomized wallet generations, and stress test the cross-chain equalizer logic under extreme conditions.
                </p>
                <div class="flex items-center gap-2 text-blue-500 font-bold uppercase text-xs tracking-widest">
                  Launch Sim Dashboard
                  <ArrowUpRight class="w-4 h-4" />
                </div>
              </div>
            </A>

            <div class="bg-white/[0.02] border border-white/5 rounded-[40px] p-10 h-full flex flex-col justify-center relative overflow-hidden group">
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div class="relative z-10">
                <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 mb-10">
                  <ShieldCheck class="w-8 h-8" />
                </div>
                <h3 class="text-3xl font-black italic text-white/40 mb-4 tracking-tighter uppercase line-through decoration-blue-500/50">Audit Protocol</h3>
                <p class="text-gray-600 font-medium leading-relaxed italic">
                  Advanced automated audit compliance module. (Coming soon to Phase 6)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Applications;