import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Code, Cpu, Zap, ArrowRight, CheckCircle, Lock, Trophy, Lightbulb, Github } from 'lucide-react';
import ParticleNetwork3D from './ParticleNetwork3D';

const FeatureCard = ({ title, desc, icon: Icon, delay }: { title: string, desc: string, icon: any, delay: number }) => {
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
      transition={{ delay, duration: 0.5 }}
      className="relative rounded-2xl overflow-hidden group border border-white/5"
    >
      {/* Moving Light Border Effect - Extra Long Tail */}
      <div className="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
         <div className="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
      </div>

      <div
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative m-[1px] rounded-[15px] bg-[#111] p-6 z-10 overflow-hidden"
      >
        {/* Spotlight Effect */}
        <div 
            className="pointer-events-none absolute -inset-px transition duration-300 opacity-0 z-0"
            style={{
            opacity,
            background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
            }}
        />

        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 mb-4 group-hover:text-blue-400 transition-colors">
            <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            
            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-gray-600">
            <Lock className="w-3 h-3" />
            <span>Coming Soon</span>
            </div>
        </div>
      </div>
    </motion.div>
  );
}

const DeveloperCommunity: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // Construct email content
      const subject = "Join Developer Waitlist";
      const body = `Please add me to the Vision Chain Developer Hub waitlist.\n\nMy Email: ${email}`;
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
    <section className="bg-black min-h-screen pt-32 pb-24 px-6 relative overflow-hidden flex flex-col items-center">
      {/* Background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
         <ParticleNetwork3D />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black pointer-events-none" />

      <div className="max-w-6xl mx-auto w-full relative z-10 flex flex-col items-center text-center">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-16 max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
            <Terminal className="w-3 h-3" />
            <span>Developer Hub</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold text-white tracking-tight mb-6">
            Preparing the <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Builder's Forge.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            We are currently finalizing the comprehensive suite of SDKs, API references, and validator documentation for the Vision Chain mainnet.
          </p>
        </motion.div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full mb-20 text-left">
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
          <FeatureCard 
            title="Global Hackathons" 
            desc="Participate in seasonal coding challenges to build the next generation of agentic dApps and win prizes."
            icon={Trophy}
            delay={0.5}
          />
          <FeatureCard 
            title="Ideathon Grants" 
            desc="Submit proposals for innovative use cases. Selected ideas receive funding to kickstart development."
            icon={Lightbulb}
            delay={0.6}
          />
        </div>

        {/* Github Integration */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-full max-w-4xl mb-24 relative group"
        >
             <div className="absolute inset-0 bg-gradient-to-r from-gray-800/20 to-gray-900/20 rounded-3xl blur-xl transition-opacity opacity-0 group-hover:opacity-100" />
             <div className="relative bg-[#0c0c0c] border border-white/10 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 overflow-hidden">
                 
                 {/* Background decoration */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                 <div className="flex-1 text-left z-10">
                     <div className="flex items-center gap-3 mb-4 text-white">
                         <Github className="w-8 h-8" />
                         <h2 className="text-3xl font-semibold">Open Source</h2>
                     </div>
                     <p className="text-gray-400 text-lg leading-relaxed mb-6">
                         Dive into the codebase. Explore our repositories, contribute to the protocol, and build on transparent foundations.
                     </p>
                     <div className="flex gap-4 text-sm font-mono text-gray-500">
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400" /> JavaScript</span>
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400" /> TypeScript</span>
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400" /> Rust</span>
                     </div>
                 </div>

                 <a 
                    href="https://github.com/VisionChainNetwork" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-transform hover:scale-105 flex items-center gap-2 z-10 whitespace-nowrap"
                 >
                    <Github className="w-5 h-5" />
                    Visit GitHub
                 </a>
             </div>
        </motion.div>

        {/* Whitelist Form */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="w-full max-w-md p-8 rounded-3xl bg-[#111] border border-white/10 relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <h3 className="text-2xl font-semibold text-white mb-2">Request Early Access</h3>
            <p className="text-gray-400 text-sm mb-6">
                Join the whitelist to get notified immediately when the Developer Hub goes live.
            </p>

            {submitted ? (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-4 text-green-400"
                >
                    <CheckCircle className="w-12 h-12 mb-2" />
                    <span className="font-medium">Opening Email Client...</span>
                </motion.div>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full bg-[#0c0c0c] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        required
                    />
                    <button 
                        type="submit"
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 group"
                    >
                        Join Waitlist
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </form>
            )}
        </motion.div>

      </div>
    </section>
  );
};

export default DeveloperCommunity;