import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Layers, Lock, Cpu, ArrowUpRight, ShieldCheck, HardDrive, Activity } from 'lucide-react';

const CardVisual: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case 'depin':
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent z-0" />
          {/* Animated Grid */}
          <div className="absolute inset-0 opacity-[0.15] bg-[linear-gradient(rgba(41,151,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(41,151,255,0.4)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)] animate-[pulse_8s_ease-in-out_infinite]" />
          
          {/* Glowing Nodes */}
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/20 rounded-full blur-[60px] animate-pulse" />
          <div className="absolute bottom-1/3 right-1/3 w-40 h-40 bg-indigo-500/10 rounded-full blur-[80px] animate-pulse delay-1000" />
          
          {/* Floating Particles */}
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_white] animate-[ping_3s_linear_infinite]" />
        </div>
      );
    case 'defi':
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
           <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent z-0" />
           <svg className="absolute bottom-0 left-0 w-full h-2/3 opacity-20" preserveAspectRatio="none">
             <path d="M0,100 C150,80 200,120 400,50 L400,200 L0,200 Z" fill="url(#grad-defi)" />
             <path d="M0,100 C150,80 200,120 400,50" stroke="#34d399" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
             <defs>
               <linearGradient id="grad-defi" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="0%" stopColor="#34d399" stopOpacity="0.5" />
                 <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
               </linearGradient>
             </defs>
           </svg>
        </div>
      );
    case 'dao':
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div className="absolute inset-0 bg-gradient-to-bl from-purple-500/5 to-transparent z-0" />
          {/* Concentric Circles */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 border border-purple-500/20 rounded-full opacity-50" />
          <div className="absolute -right-10 -bottom-10 w-48 h-48 border border-purple-500/20 rounded-full opacity-50" />
          <div className="absolute -right-10 -bottom-10 w-32 h-32 border border-purple-500/20 rounded-full opacity-50" />
        </div>
      );
    case 'identity':
      return (
         <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
            <div className="absolute top-4 right-4 text-amber-500/10">
               <ShieldCheck size={120} strokeWidth={0.5} />
            </div>
         </div>
      );
    case 'compute':
      return (
         <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:linear-gradient(to_bottom_right,black,transparent)]" />
         </div>
      );
    case 'storage':
      return (
         <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent" />
            <div className="absolute bottom-4 right-4 flex gap-1">
               <div className="w-2 h-8 bg-rose-500/20 rounded-full animate-pulse" />
               <div className="w-2 h-12 bg-rose-500/20 rounded-full animate-pulse delay-75" />
               <div className="w-2 h-6 bg-rose-500/20 rounded-full animate-pulse delay-150" />
            </div>
         </div>
      );
    default:
      return null;
  }
};

interface BentoCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  className?: string;
  visual?: string;
  accentColor?: string;
}

const BentoCard: React.FC<BentoCardProps> = ({ title, subtitle, icon, className, visual, accentColor = "text-blue-500" }) => {
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
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`
        relative overflow-hidden rounded-[24px] flex flex-col justify-between group 
        border border-white/5 
        hover:shadow-2xl transition-all duration-300
        ${className}
      `}
    >
      {/* Moving Light Border Effect - Extra Long Tail */}
      <div className="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
         <div className="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
      </div>

      {/* Inner Content Container */}
      <div 
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-full m-[1px] rounded-[23px] bg-[#0c0c0c] p-8 flex flex-col justify-between overflow-hidden z-10"
      >
        {/* Spotlight Effect */}
        <div 
          className="pointer-events-none absolute -inset-px transition duration-300 opacity-0 z-0"
          style={{
            opacity,
            background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
          }}
        />

        {/* Background Visuals */}
        {visual && <CardVisual type={visual} />}
        
        {/* Content Layer */}
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
               <div className={`
                 w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center 
                 text-white/80 group-hover:text-white group-hover:scale-110 group-hover:bg-white/10 
                 transition-all duration-300 shadow-inner
               `}>
                 {icon}
               </div>
               <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                     <ArrowUpRight className="w-4 h-4 text-white/50" />
                  </div>
               </div>
            </div>

            <h3 className="text-2xl font-semibold text-white tracking-tight mb-3 group-hover:text-blue-200 transition-colors">
              {title}
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed font-medium group-hover:text-gray-300 transition-colors max-w-lg">
              {subtitle}
            </p>
          </div>
          
          {/* Bottom Decoration line */}
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mt-6 opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </motion.div>
  );
};

const Applications: React.FC = () => {
  return (
    <section className="bg-[#050505] py-32 border-t border-white/5 relative">
      {/* Subtle Background Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px] opacity-20 pointer-events-none" />

      <div className="max-w-[1200px] mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
           <motion.span 
             initial={{ opacity: 0, y: 10 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="text-blue-500 font-semibold tracking-wide uppercase text-xs mb-3 block"
           >
             Ecosystem Applications
           </motion.span>
           <motion.h2 
             initial={{ opacity: 0, y: 10 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.1 }}
             className="text-4xl md:text-6xl font-semibold text-white tracking-tight mb-6"
           >
             Built for Agents.
           </motion.h2>
           <motion.p 
             initial={{ opacity: 0, y: 10 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.2 }}
             className="text-xl text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed"
           >
             A unified platform powering the next generation of autonomous economic actors. 
             From physical infrastructure to financial derivatives.
           </motion.p>
        </div>

        {/* Top Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Main Large Card (DePIN) - Spans 2 cols */}
          <BentoCard 
            className="lg:col-span-2 min-h-[420px]"
            title="DePIN Infrastructure"
            subtitle="Connect physical hardware to AI logic. Agents can rent, manage, and monetize computational resources in real-time with millisecond latency."
            icon={<Globe className="w-6 h-6" />}
            visual="depin"
          />

          {/* Right Column Stack */}
          <div className="flex flex-col gap-6 h-full">
            <BentoCard 
              className="flex-1 min-h-[200px]"
              title="Data Driven DeFi"
              subtitle="High-frequency settlement layers optimized for bot-to-bot commerce and liquidity."
              icon={<Activity className="w-6 h-6" />}
              visual="defi"
            />
            <BentoCard 
              className="flex-1 min-h-[200px]"
              title="Dynamic DAOs"
              subtitle="Reputation-based governance systems designed specifically for AI agents."
              icon={<Layers className="w-6 h-6" />}
              visual="dao"
            />
          </div>
        </div>
        
        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <BentoCard 
            title="Secure Identity"
            subtitle="Cryptographic provenance (DID) for AI models."
            icon={<Lock className="w-6 h-6" />}
            className="min-h-[260px]"
            visual="identity"
          />
           <BentoCard 
            title="Verifiable Compute"
            subtitle="Zero-knowledge proofs for off-chain workloads."
            icon={<Cpu className="w-6 h-6" />}
            className="min-h-[260px]"
            visual="compute"
          />
           <BentoCard 
            title="Decentralized Storage"
            subtitle="High-availability data layers for model weights."
            icon={<HardDrive className="w-6 h-6" />}
            className="min-h-[260px]"
            visual="storage"
          />
        </div>

      </div>
    </section>
  );
};

export default Applications;