import { createSignal } from 'solid-js';
import type { JSX, Component } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Network, Zap, Scale, BrainCircuit, Layers, ShieldCheck, FileSearch, Timer, ScrollText, EyeOff, Users, Database } from 'lucide-solid';
import ConstellationEffect from './ConstellationEffect';

interface FadeInProps {
  children: JSX.Element;
  delay?: number;
  class?: string;
}

const FadeIn = (props: FadeInProps): JSX.Element => (
  <Motion.div
    initial={{ opacity: 0, y: 20 }}
    inView={{ opacity: 1, y: 0 }}
    inViewOptions={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.6, delay: props.delay ?? 0, easing: "ease-out" }}
    class={props.class ?? ""}
  >
    {props.children}
  </Motion.div>
);

interface ResearchCardProps {
  title: string;
  content: string;
  icon: JSX.Element;
  delay?: number;
  class?: string;
}

const ResearchCard = (props: ResearchCardProps): JSX.Element => {
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
    <FadeIn delay={props.delay} class={`h-full ${props.class ?? ''}`}>
      <div class="relative h-full rounded-3xl overflow-hidden group border border-white/5 hover:border-white/10 transition-colors">

        {/* Moving Light Border Effect */}
        <div class="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
          <div class="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
        </div>

        {/* Content Container */}
        <div
          ref={divRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          class="relative h-full m-[1px] rounded-[23px] bg-[#111] p-8 transition-colors z-10 overflow-hidden flex flex-col justify-between"
        >
          {/* Spotlight Effect */}
          <div
            class="pointer-events-none absolute -inset-px transition duration-300 z-0"
            style={{
              opacity: opacity(),
              background: `radial-gradient(600px circle at ${position().x}px ${position().y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
            }}
          />

          <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div class="relative z-10">
            <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
              {props.icon}
            </div>
            <h3 class="text-xl font-semibold text-white mb-3">{props.title}</h3>
            <p class="text-gray-400 text-sm leading-relaxed">{props.content}</p>
          </div>
        </div>
      </div>
    </FadeIn>
  );
};

interface InfrastructureCardProps {
  title: string;
  description: string;
  icon: Component<{ class?: string }>;
  state: string;
  colorClass: string;
  delay?: number;
}

const InfrastructureCard = (props: InfrastructureCardProps): JSX.Element => {
  let divRef: HTMLDivElement | undefined;
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [opacity, setOpacity] = createSignal(0);
  const Icon = props.icon;

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
      inViewOptions={{ once: true }}
      transition={{ duration: 0.6, delay: props.delay ?? 0, easing: "ease-out" }}
      class="relative rounded-3xl overflow-hidden group border border-white/10 hover:border-white/20 h-full shadow-lg transition-all"
    >
      {/* Moving Light Border Effect */}
      <div class="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
        <div class="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
      </div>

      <div
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        class="relative h-full m-[1px] rounded-[23px] bg-[#0c0c0c] p-8 flex flex-col justify-between z-10 overflow-hidden"
      >
        {/* Spotlight Effect */}
        <div
          class="pointer-events-none absolute -inset-px transition duration-300 z-0"
          style={{
            opacity: opacity(),
            background: `radial-gradient(600px circle at ${position().x}px ${position().y}px, rgba(41, 151, 255, 0.1), transparent 40%)`
          }}
        />

        {/* Hover Gradient Overlay */}
        <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {/* Content */}
        <div class="relative z-10">
          <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300 border border-white/5">
            <Icon class={`w-7 h-7 ${props.colorClass}`} />
          </div>
          <h3 class="text-2xl font-semibold text-white mb-4">{props.title}</h3>
          <p class="text-gray-400 leading-relaxed text-base">
            {props.description}
          </p>
        </div>

        <div class="relative z-10 mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
          <span class={`text-sm font-mono ${props.colorClass} opacity-90 font-medium`}>{props.state}</span>
          <div class={`w-2 h-2 rounded-full ${props.colorClass.replace('text-', 'bg-')} animate-pulse`} />
        </div>
      </div>
    </Motion.div>
  );
};

const Research = (): JSX.Element => {
  return (
    <section class="bg-black relative overflow-hidden">

      {/* --- HERO SECTION --- */}
      <div class="relative pt-32 pb-24 px-6 border-b border-white/5 overflow-hidden">
        {/* Background Grid - Lower opacity so particles pop */}
        <div class="absolute inset-0 bg-[linear-gradient(rgba(41,151,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(41,151,255,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)] opacity-30" />

        {/* Constellation Effect (Stars Connecting) */}
        <div class="absolute inset-0 z-0">
          <ConstellationEffect />
        </div>

        <div class="max-w-[1200px] mx-auto text-center relative z-10">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            inView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
              <FileSearch class="w-3 h-3" />
              <span>Vision Research Lab</span>
            </div>
            <h1 class="text-5xl md:text-8xl font-semibold text-white tracking-tighter mb-8">
              Vision Chain <br class="hidden md:block" />
              <span class="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Research</span>
            </h1>
            <p class="text-[#86868b] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Pioneering the theoretical foundations of the Agentic Economy. <br class="hidden md:block" />From Post-Quantum security to Autonomous Consensus.
            </p>
          </Motion.div>
        </div>
      </div>

      {/* --- SECTION 2: RESEARCH THEMES --- */}
      <div class="py-24 px-6 max-w-[1200px] mx-auto">
        <div class="mb-16">
          <FadeIn>
            <span class="text-blue-500 font-semibold tracking-wide uppercase text-xs mb-3 block">Core Themes</span>
            <h2 class="text-3xl md:text-5xl font-semibold text-white tracking-tight max-w-4xl leading-[1.1]">
              Cryptography for the Next Era.
            </h2>
          </FadeIn>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-fr">
          <ResearchCard
            class="md:col-span-6"
            delay={0.1}
            icon={<Timer />}
            title="Post Quantum Time Locks"
            content="Developing Homomorphic Time Lock Puzzles (HTLPs) resistant to Shor's algorithm, ensuring fair ordering in consensus without relying on centralized timestamps."
          />
          <ResearchCard
            class="md:col-span-6"
            delay={0.2}
            icon={<ScrollText />}
            title="Post Quantum Commitment Schemes"
            content="Lattice-based commitment schemes that allow autonomous agents to commit to values (like auction bids) without revealing them, ensuring secrecy against quantum adversaries."
          />
          <ResearchCard
            class="md:col-span-4"
            delay={0.3}
            icon={<EyeOff />}
            title="Post Quantum Zero Knowledge Proofs"
            content="Next-generation zkSTARKs optimized for lattice cryptography, enabling privacy-preserving verification of agent actions and state transitions."
          />
          <ResearchCard
            class="md:col-span-4"
            delay={0.4}
            icon={<Users />}
            title="Post Quantum Proofs in MPC"
            content="Secure Multi-Party Computation protocols designed to withstand quantum attacks, vital for distributed key generation and threshold signatures among validators."
          />
          <ResearchCard
            class="md:col-span-4"
            delay={0.5}
            icon={<Database />}
            title="Post Quantum Secure Accumulators"
            content="Dynamic accumulators (DASM) based on quantum-hard assumptions for efficient, secure, and compact state management and history verification."
          />
        </div>
      </div>

      {/* --- SECTION 3: DEEP DIVE --- */}
      <div class="bg-[#050505] py-24 px-6 border-t border-white/5">
        <div class="max-w-[1200px] mx-auto">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">

            {/* Left Col: Main Thesis */}
            <div class="lg:col-span-5">
              <FadeIn>
                <h2 class="text-3xl md:text-4xl font-semibold text-white mb-6">Vision Chain Research</h2>
                <p class="text-gray-400 text-lg leading-relaxed mb-8">
                  Blockchain systems face critical challenges in complexity, fragmentation, and inefficiency. Vision Chain addresses these by aligning consensus, computation, and automation with real-world requirements.
                </p>
                <p class="text-gray-400 text-lg leading-relaxed">
                  Our goal is to ensure seamless interoperability, fairness in execution, and enterprise-ready performance.
                </p>
                <div class="mt-8 h-[1px] w-24 bg-blue-500/50" />
              </FadeIn>
            </div>

            {/* Right Col: Specifics */}
            <div class="lg:col-span-7 space-y-12">
              <FadeIn delay={0.1}>
                <h3 class="text-xl font-semibold text-white mb-3 flex items-center gap-3">
                  <span class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-mono text-blue-400">01</span>
                  Proof of Visibility Consensus
                </h3>
                <p class="text-gray-400 leading-relaxed pl-11">
                  A novel consensus design that reduces blockchain complexity by 70%, combining verifiable delay functions, timelocks, and AI automation. This ensures fairness in block production, scalable performance, and transparent validation.
                </p>
              </FadeIn>

              <FadeIn delay={0.2}>
                <h3 class="text-xl font-semibold text-white mb-3 flex items-center gap-3">
                  <span class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-mono text-blue-400">02</span>
                  Intent Navigation Network (INN)
                </h3>
                <p class="text-gray-400 leading-relaxed pl-11">
                  Instead of raw transactions, Vision Chain enables users and developers to express intents. The INN (formerly CCIFF) translates these into optimized cross-chain actions, reducing MEV, improving UX, and ensuring policy-aware compliance.
                </p>
              </FadeIn>

              <FadeIn delay={0.3}>
                <h3 class="text-xl font-semibold text-white mb-3 flex items-center gap-3">
                  <span class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-mono text-blue-400">03</span>
                  AI Agentic Orchestration
                </h3>
                <p class="text-gray-400 leading-relaxed pl-11">
                  Autonomous nodes powered by AI intelligently manage routing, sequencing, and compliance enforcement across chains. This creates a self-regulating execution environment, minimizing inefficiencies and ensuring trustless automation at scale.
                </p>
              </FadeIn>
            </div>

          </div>
        </div>
      </div>

      {/* --- SECTION 4: INFRASTRUCTURE --- */}
      <div class="py-24 px-6 relative border-t border-white/5">
        <div class="absolute inset-0 bg-blue-900/5" />
        <div class="max-w-[1200px] mx-auto relative z-10">
          <FadeIn>
            <span class="text-blue-500 font-semibold tracking-wide uppercase text-xs mb-3 block text-left">
              Vision Infrastructure
            </span>
            <h2 class="text-3xl md:text-5xl font-semibold text-white text-left mb-6">
              Blockchain Reimagined with <br /><span class="text-blue-400">AI Agentic Infrastructure</span>
            </h2>
            <p class="text-left text-gray-400 max-w-3xl text-lg mb-16 leading-relaxed">
              Vision Chain is a next-generation, AI-powered, network-agnostic blockchain designed for intelligent automation and trustless interoperability. Its core architecture integrates AI-driven agents into consensus, compliance, and execution enabling autonomous nodes that validate data, enforce on-chain rules, and coordinate complex workflows.
            </p>
          </FadeIn>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <InfrastructureCard
              title="Agent-Powered Consensus"
              description="Consensus is no longer a passive process. Vision Chain's Proof of Visibility leverages autonomous agents to validate fairness, sequence blocks, and enforce compliance—reducing complexity by 70% while ensuring transparent, tamper-proof finality."
              icon={ShieldCheck}
              state="State: Active Validation"
              colorClass="text-emerald-400"
              delay={0.2}
            />

            <InfrastructureCard
              title="Intent Navigation Network (INN)"
              description="Agents translate user intents into optimized cross-chain actions through the INN. By coordinating liquidity, settlement, and routing across multiple networks, they make interoperability seamless and trustless."
              icon={Zap}
              state="State: Interoperability Layer"
              colorClass="text-amber-400"
              delay={0.3}
            />
          </div>

        </div>
      </div>

    </section>
  );
};

export default Research;