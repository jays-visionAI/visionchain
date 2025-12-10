import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Network, Zap, Scale, BrainCircuit, Layers, ShieldCheck, FileSearch, Timer, ScrollText, EyeOff, Users, Database } from 'lucide-react';
import ConstellationEffect from './ConstellationEffect';

const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

const ResearchCard: React.FC<{ title: string; content: string; icon: React.ReactNode; delay?: number; className?: string }> = ({ title, content, icon, delay, className }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const div = divRef.current;
    const rect = div.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <FadeIn delay={delay} className={`h-full ${className || ''}`}>
      <div className="relative h-full rounded-3xl overflow-hidden group border border-white/5 hover:border-white/10 transition-colors">
        
        {/* Moving Light Border Effect */}
        <div className="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
           <div className="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
        </div>

        {/* Content Container */}
        <div 
          ref={divRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative h-full m-[1px] rounded-[23px] bg-[#111] p-8 transition-colors z-10 overflow-hidden flex flex-col justify-between"
        >
          {/* Spotlight Effect */}
          <div 
            className="pointer-events-none absolute -inset-px transition duration-300 opacity-0 z-0"
            style={{
              opacity,
              background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
              {icon}
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{content}</p>
          </div>
        </div>
      </div>
    </FadeIn>
  );
};

const InfrastructureCard: React.FC<{ 
    title: string; 
    description: string; 
    icon: any; 
    state: string; 
    colorClass: string; 
    delay?: number 
}> = ({ title, description, icon: Icon, state, colorClass, delay = 0 }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const div = divRef.current;
    const rect = div.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="relative rounded-3xl overflow-hidden group border border-white/10 hover:border-white/20 h-full shadow-lg transition-all"
    >
      {/* Moving Light Border Effect */}
      <div className="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
         <div className="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
      </div>

      <div 
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-full m-[1px] rounded-[23px] bg-[#0c0c0c] p-8 flex flex-col justify-between z-10 overflow-hidden"
      >
        {/* Spotlight Effect */}
        <div 
          className="pointer-events-none absolute -inset-px transition duration-300 opacity-0 z-0"
          style={{
            opacity,
            background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(41, 151, 255, 0.1), transparent 40%)`
          }}
        />
        
        {/* Hover Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10">
             <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300 border border-white/5">
                <Icon className={`w-7 h-7 ${colorClass}`} />
             </div>
             <h3 className="text-2xl font-semibold text-white mb-4">{title}</h3>
             <p className="text-gray-400 leading-relaxed text-base">
               {description}
             </p>
        </div>

        <div className="relative z-10 mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
             <span className={`text-sm font-mono ${colorClass} opacity-90 font-medium`}>{state}</span>
             <div className={`w-2 h-2 rounded-full ${colorClass.replace('text-', 'bg-')} animate-pulse`} />
        </div>
      </div>
    </motion.div>
  );
};

const Research: React.FC = () => {
  return (
    <section className="bg-black relative overflow-hidden">
      
      {/* --- HERO SECTION --- */}
      <div className="relative pt-32 pb-24 px-6 border-b border-white/5 overflow-hidden">
        {/* Background Grid - Lower opacity so particles pop */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(41,151,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(41,151,255,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)] opacity-30" />
        
        {/* Constellation Effect (Stars Connecting) */}
        <div className="absolute inset-0 z-0">
            <ConstellationEffect />
        </div>

        <div className="max-w-[1200px] mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
              <FileSearch className="w-3 h-3" />
              <span>Vision Research Lab</span>
            </div>
            <h1 className="text-5xl md:text-8xl font-semibold text-white tracking-tighter mb-8">
              Vision Chain <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Research</span>
            </h1>
            <p className="text-[#86868b] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Pioneering the theoretical foundations of the Agentic Economy. <br className="hidden md:block"/> From Post-Quantum security to Autonomous Consensus.
            </p>
          </motion.div>
        </div>
      </div>

      {/* --- SECTION 2: RESEARCH THEMES --- */}
      <div className="py-24 px-6 max-w-[1200px] mx-auto">
        <div className="mb-16">
          <FadeIn>
            <span className="text-blue-500 font-semibold tracking-wide uppercase text-xs mb-3 block">Core Themes</span>
            <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tight max-w-4xl leading-[1.1]">
              Cryptography for the Next Era.
            </h2>
          </FadeIn>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-fr">
          <ResearchCard 
            className="md:col-span-6"
            delay={0.1}
            icon={<Timer />}
            title="Post Quantum Time Locks"
            content="Developing Homomorphic Time Lock Puzzles (HTLPs) resistant to Shor's algorithm, ensuring fair ordering in consensus without relying on centralized timestamps."
          />
          <ResearchCard 
            className="md:col-span-6"
            delay={0.2}
            icon={<ScrollText />}
            title="Post Quantum Commitment Schemes"
            content="Lattice-based commitment schemes that allow autonomous agents to commit to values (like auction bids) without revealing them, ensuring secrecy against quantum adversaries."
          />
          <ResearchCard 
            className="md:col-span-4"
            delay={0.3}
            icon={<EyeOff />}
            title="Post Quantum Zero Knowledge Proofs"
            content="Next-generation zkSTARKs optimized for lattice cryptography, enabling privacy-preserving verification of agent actions and state transitions."
          />
          <ResearchCard 
            className="md:col-span-4"
            delay={0.4}
            icon={<Users />}
            title="Post Quantum Proofs in MPC"
            content="Secure Multi-Party Computation protocols designed to withstand quantum attacks, vital for distributed key generation and threshold signatures among validators."
          />
          <ResearchCard 
            className="md:col-span-4"
            delay={0.5}
            icon={<Database />}
            title="Post Quantum Secure Accumulators"
            content="Dynamic accumulators (DASM) based on quantum-hard assumptions for efficient, secure, and compact state management and history verification."
          />
        </div>
      </div>

      {/* --- SECTION 3: DEEP DIVE --- */}
      <div className="bg-[#050505] py-24 px-6 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
            
            {/* Left Col: Main Thesis */}
            <div className="lg:col-span-5">
              <FadeIn>
                 <h2 className="text-3xl md:text-4xl font-semibold text-white mb-6">Vision Chain Research</h2>
                 <p className="text-gray-400 text-lg leading-relaxed mb-8">
                   Blockchain systems face critical challenges in complexity, fragmentation, and inefficiency. Vision Chain addresses these by aligning consensus, computation, and automation with real-world requirements. 
                 </p>
                 <p className="text-gray-400 text-lg leading-relaxed">
                   Our goal is to ensure seamless interoperability, fairness in execution, and enterprise-ready performance.
                 </p>
                 <div className="mt-8 h-[1px] w-24 bg-blue-500/50" />
              </FadeIn>
            </div>

            {/* Right Col: Specifics */}
            <div className="lg:col-span-7 space-y-12">
              <FadeIn delay={0.1}>
                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-mono text-blue-400">01</span>
                  Proof of Visibility Consensus
                </h3>
                <p className="text-gray-400 leading-relaxed pl-11">
                  A novel consensus design that reduces blockchain complexity by 70%, combining verifiable delay functions, timelocks, and AI automation. This ensures fairness in block production, scalable performance, and transparent validation.
                </p>
              </FadeIn>

              <FadeIn delay={0.2}>
                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-mono text-blue-400">02</span>
                  Intent Navigation Network (INN)
                </h3>
                <p className="text-gray-400 leading-relaxed pl-11">
                  Instead of raw transactions, Vision Chain enables users and developers to express intents. The INN (formerly CCIFF) translates these into optimized cross-chain actions, reducing MEV, improving UX, and ensuring policy-aware compliance.
                </p>
              </FadeIn>

              <FadeIn delay={0.3}>
                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-mono text-blue-400">03</span>
                  AI Agentic Orchestration
                </h3>
                <p className="text-gray-400 leading-relaxed pl-11">
                  Autonomous nodes powered by AI intelligently manage routing, sequencing, and compliance enforcement across chains. This creates a self-regulating execution environment, minimizing inefficiencies and ensuring trustless automation at scale.
                </p>
              </FadeIn>
            </div>

          </div>
        </div>
      </div>

      {/* --- SECTION 4: INFRASTRUCTURE --- */}
      <div className="py-24 px-6 relative border-t border-white/5">
        <div className="absolute inset-0 bg-blue-900/5" />
        <div className="max-w-[1200px] mx-auto relative z-10">
          <FadeIn>
            <span className="text-blue-500 font-semibold tracking-wide uppercase text-xs mb-3 block text-left">
              Vision Infrastructure
            </span>
            <h2 className="text-3xl md:text-5xl font-semibold text-white text-left mb-6">
              Blockchain Reimagined with <br/><span className="text-blue-400">AI Agentic Infrastructure</span>
            </h2>
            <p className="text-left text-gray-400 max-w-3xl text-lg mb-16 leading-relaxed">
              Vision Chain is a next-generation, AI-powered, network-agnostic blockchain designed for intelligent automation and trustless interoperability. Its core architecture integrates AI-driven agents into consensus, compliance, and execution enabling autonomous nodes that validate data, enforce on-chain rules, and coordinate complex workflows.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <InfrastructureCard 
              title="Agent-Powered Consensus"
              description="Consensus is no longer a passive process. Vision Chain’s Proof of Visibility leverages autonomous agents to validate fairness, sequence blocks, and enforce compliance—reducing complexity by 70% while ensuring transparent, tamper-proof finality."
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