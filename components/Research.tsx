import { createSignal } from 'solid-js';
import type { JSX, Component } from 'solid-js';
import { Network, Zap, Scale, BrainCircuit, Layers, ShieldCheck, FileSearch, Timer, ScrollText, EyeOff, Users, Database } from 'lucide-solid';
import ConstellationEffect from './ConstellationEffect';
import { PageHero } from './public/PageHero';
import { SectionHeader } from './public/SectionHeader';
import { FeatureCard } from './public/FeatureCard';
import { InfrastructureCard } from './public/InfrastructureCard';
import { FadeIn } from './public/FadeIn';

const Research = (): JSX.Element => {
  return (
    <section class="bg-black relative overflow-hidden">
      {/* --- HERO SECTION --- */}
      <PageHero
        label="Vision Research Lab"
        icon={<FileSearch class="w-3 h-3" />}
        title={
          <>
            Vision Chain <br class="hidden md:block" />
            <span class="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Research</span>
          </>
        }
        description={
          <>
            Pioneering the theoretical foundations of the Agentic Economy. <br class="hidden md:block" />
            From Post-Quantum security to Autonomous Consensus.
          </>
        }
        background={
          <>
            <div class="absolute inset-0 bg-[linear-gradient(rgba(41,151,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(41,151,255,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)] opacity-30" />
            <ConstellationEffect />
          </>
        }
      />

      {/* --- SECTION 2: RESEARCH THEMES --- */}
      <div class="py-24 px-6 max-w-[1200px] mx-auto">
        <SectionHeader
          centered={false}
          label="Core Themes"
          title="Cryptography for the Next Era."
        />

        <div class="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-fr">
          <FeatureCard
            class="md:col-span-6"
            delay={0.1}
            icon={<Timer />}
            title="Post Quantum Time Locks"
            description="Developing Homomorphic Time Lock Puzzles (HTLPs) resistant to Shor's algorithm, ensuring fair ordering in consensus without relying on centralized timestamps."
          />
          <FeatureCard
            class="md:col-span-6"
            delay={0.2}
            icon={<ScrollText />}
            title="Post Quantum Commitment Schemes"
            description="Lattice-based commitment schemes that allow autonomous agents to commit to values (like auction bids) without revealing them, ensuring secrecy against quantum adversaries."
          />
          <FeatureCard
            class="md:col-span-4"
            delay={0.3}
            icon={<EyeOff />}
            title="Post Quantum Zero Knowledge Proofs"
            description="Next-generation zkSTARKs optimized for lattice cryptography, enabling privacy-preserving verification of agent actions and state transitions."
          />
          <FeatureCard
            class="md:col-span-4"
            delay={0.4}
            icon={<Users />}
            title="Post Quantum Proofs in MPC"
            description="Secure Multi-Party Computation protocols designed to withstand quantum attacks, vital for distributed key generation and threshold signatures among validators."
          />
          <FeatureCard
            class="md:col-span-4"
            delay={0.5}
            icon={<Database />}
            title="Post Quantum Secure Accumulators"
            description="Dynamic accumulators (DASM) based on quantum-hard assumptions for efficient, secure, and compact state management and history verification."
          />
        </div>
      </div>

      {/* --- SECTION 3: DEEP DIVE --- */}
      <div class="bg-[#050505] py-24 px-6 border-t border-white/5">
        <div class="max-w-[1200px] mx-auto">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
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

            <div class="lg:col-span-7 space-y-12">
              {[
                { num: '01', title: 'Proof of Visibility Consensus', content: 'A novel consensus design that reduces blockchain complexity by 70%, combining verifiable delay functions, timelocks, and AI automation. This ensures fairness in block production, scalable performance, and transparent validation.' },
                { num: '02', title: 'Intent Navigation Network (INN)', content: 'Instead of raw transactions, Vision Chain enables users and developers to express intents. The INN (formerly CCIFF) translates these into optimized cross-chain actions, reducing MEV, improving UX, and ensuring policy-aware compliance.' },
                { num: '03', title: 'AI Agentic Orchestration', content: 'Autonomous nodes powered by AI intelligently manage routing, sequencing, and compliance enforcement across chains. This creates a self-regulating execution environment, minimizing inefficiencies and ensuring trustless automation at scale.' }
              ].map((item, idx) => (
                <FadeIn delay={0.1 * (idx + 1)}>
                  <h3 class="text-xl font-semibold text-white mb-3 flex items-center gap-3">
                    <span class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-mono text-blue-400">{item.num}</span>
                    {item.title}
                  </h3>
                  <p class="text-gray-400 leading-relaxed pl-11">{item.content}</p>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 4: INFRASTRUCTURE --- */}
      <div class="py-24 px-6 relative border-t border-white/5">
        <div class="absolute inset-0 bg-blue-900/5" />
        <div class="max-w-[1200px] mx-auto relative z-10">
          <SectionHeader
            centered={false}
            label="Vision Infrastructure"
            title={
              <>
                Blockchain Reimagined with <br />
                <span class="text-blue-400">AI Agentic Infrastructure</span>
              </>
            }
            description="Vision Chain is a next-generation, AI-powered, network-agnostic blockchain designed for intelligent automation and trustless interoperability. Its core architecture integrates AI-driven agents into consensus, compliance, and execution enabling autonomous nodes that validate data, enforce on-chain rules, and coordinate complex workflows."
          />

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