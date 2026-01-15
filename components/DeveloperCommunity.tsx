import { createSignal, Show } from 'solid-js';
import type { JSX, Component } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Terminal, Code, Cpu, Zap, ArrowRight, CheckCircle, Lock, Trophy, Lightbulb, Github, CreditCard } from 'lucide-solid';
import ParticleNetwork3D from './ParticleNetwork3D';

interface FeatureCardProps {
  title: string;
  desc: string;
  icon: Component<{ class?: string }>;
  delay: number;
}

const FeatureCard = (props: FeatureCardProps): JSX.Element => {
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
      initial={{ opacity: 0 }}
      inView={{ opacity: 1 }}
      inViewOptions={{ once: true }}
      transition={{ delay: props.delay, duration: 0.5 }}
      class="relative rounded-2xl overflow-hidden group border border-white/5 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Moving Light Border Effect - Extra Long Tail */}
      <div class="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
        <div class="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
      </div>

      <div
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        class="relative m-[1px] rounded-[15px] bg-[#111] p-6 z-10 overflow-hidden"
      >
        {/* Spotlight Effect */}
        <div
          class="pointer-events-none absolute -inset-px transition duration-300 z-0"
          style={{
            opacity: opacity(),
            background: `radial-gradient(600px circle at ${position().x}px ${position().y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
          }}
        />

        <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div class="relative z-10">
          <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 mb-4 group-hover:text-blue-400 transition-colors">
            <Icon class="w-5 h-5" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">{props.title}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">{props.desc}</p>

          <div class="mt-4 flex items-center gap-2 text-xs font-mono text-gray-600">
            <Lock class="w-3 h-3" />
            <span>Coming Soon</span>
          </div>
        </div>
      </div>
    </Motion.div>
  );
}

const DeveloperCommunity = (): JSX.Element => {
  const [email, setEmail] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (email()) {
      // Construct email content
      const subject = "Join Developer Waitlist";
      const body = `Please add me to the Vision Chain Developer Hub waitlist.\n\nMy Email: ${email()}`;
      const mailtoUrl = `mailto:jp@visai.io?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      // Open email client
      window.location.href = mailtoUrl;

      setSubmitted(true);

      // Reset UI after delay
      setTimeout(() => {
        setSubmitted(false);
        setEmail('');
      }, 5000);
    }
  };

  return (
    <section class="bg-black min-h-screen pt-32 pb-24 px-6 relative overflow-hidden flex flex-col items-center">
      {/* Background */}
      <div class="absolute inset-0 opacity-30 pointer-events-none">
        <ParticleNetwork3D />
      </div>
      <div class="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black pointer-events-none" />

      <div class="max-w-6xl mx-auto w-full relative z-10 flex flex-col items-center text-center">

        {/* Header */}
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          class="mb-16 max-w-4xl mx-auto"
        >
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
            <Terminal class="w-3 h-3" />
            <span>Developer Hub</span>
          </div>
          <h1 class="text-5xl md:text-7xl font-semibold text-white tracking-tight mb-6">
            Preparing the <br />
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Builder's Forge.</span>
          </h1>
          <p class="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            We are currently finalizing the comprehensive suite of SDKs, API references, and validator documentation for the Vision Chain mainnet.
          </p>
        </Motion.div>

        {/* Features Preview */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full mb-20 text-left">
          <FeatureCard
            title="Vision SDK"
            desc="Python & Rust libraries for seamless integration of Autonomous Agents with on-chain logic."
            icon={Code}
            delay={0.1}
          />
          <FeatureCard
            title="Validator Node Setup"
            desc="Complete guides for setting up Proof of Visibility nodes and earning rewards."
            icon={Cpu}
            delay={0.2}
          />
          <FeatureCard
            title="Smart Contract Docs"
            desc="Solidity references and pre-built templates for Intent-Centric dApps."
            icon={Terminal}
            delay={0.3}
          />
          <FeatureCard
            title="Relayer API"
            desc="Endpoints for interacting with the Cross Chain Intent Fusion Framework."
            icon={Zap}
            delay={0.4}
          />
          <div class="cursor-pointer" onClick={() => window.location.href = '/paymaster'}>
            <FeatureCard
              title="Gas Abstraction (Paymaster)"
              desc="Onboard users without VCN. Sponsored transactions via ERC-4337 Paymaster integration."
              icon={CreditCard}
              delay={0.5}
            />
          </div>
          <FeatureCard
            title="Global Hackathons"
            desc="Participate in seasonal coding challenges to build the next generation of agentic dApps."
            icon={Trophy}
            delay={0.6}
          />
          <FeatureCard
            title="Ideathon Grants"
            desc="Submit proposals for innovative use cases. Selected ideas receive funding to kickstart development."
            icon={Lightbulb}
            delay={0.6}
          />
        </div>

        {/* Github Integration */}
        <Motion.div
          initial={{ opacity: 0 }}
          inView={{ opacity: 1 }}
          inViewOptions={{ once: true }}
          class="w-full max-w-4xl mb-24 relative group"
        >
          <div class="absolute inset-0 bg-gradient-to-r from-gray-800/20 to-gray-900/20 rounded-3xl blur-xl transition-opacity opacity-0 group-hover:opacity-100" />
          <div class="relative bg-[#0c0c0c] border border-white/10 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 overflow-hidden">

            {/* Background decoration */}
            <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div class="flex-1 text-left z-10">
              <div class="flex items-center gap-3 mb-4 text-white">
                <Github class="w-8 h-8" />
                <h2 class="text-3xl font-semibold">Open Source</h2>
              </div>
              <p class="text-gray-400 text-lg leading-relaxed mb-6">
                Dive into the codebase. Explore our repositories, contribute to the protocol, and build on transparent foundations.
              </p>
              <div class="flex gap-4 text-sm font-mono text-gray-500">
                <span class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-yellow-400" />JavaScript</span>
                <span class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-blue-400" />TypeScript</span>
                <span class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-orange-400" />Rust</span>
              </div>
            </div>

            <a
              href="https://github.com/VisionChainNetwork"
              target="_blank"
              rel="noopener noreferrer"
              class="px-8 py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-transform hover:scale-105 flex items-center gap-2 z-10 whitespace-nowrap"
            >
              <Github class="w-5 h-5" />
              Visit GitHub
            </a>
          </div>
        </Motion.div>

        {/* Whitelist Form */}
        <Motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          inView={{ opacity: 1, scale: 1 }}
          inViewOptions={{ once: true }}
          class="w-full max-w-md p-8 rounded-3xl bg-[#111] border border-white/10 relative overflow-hidden"
        >
          <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <h3 class="text-2xl font-semibold text-white mb-2">Request Early Access</h3>
          <p class="text-gray-400 text-sm mb-6">
            Join the whitelist to get notified immediately when the Developer Hub goes live.
          </p>

          <Show when={submitted()} fallback={
            <form onSubmit={handleSubmit} class="flex flex-col gap-3">
              <input
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                placeholder="Enter your email address"
                class="w-full bg-[#0c0c0c] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
              <button
                type="submit"
                class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 group"
              >
                Join Waitlist
                <ArrowRight class="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          }>
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              class="flex flex-col items-center justify-center py-4 text-green-400"
            >
              <CheckCircle class="w-12 h-12 mb-2" />
              <span class="font-medium">Opening Email Client...</span>
            </Motion.div>
          </Show>
        </Motion.div>

      </div>
    </section>
  );
};

export default DeveloperCommunity;