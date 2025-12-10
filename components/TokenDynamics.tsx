import React from 'react';
import { motion } from 'framer-motion';
import { Coins, PieChart, Zap, ShieldCheck, Users } from 'lucide-react';

const DistributionRow = ({ label, percentage, color }: { label: string; percentage: number; color: string }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded-lg transition-colors">
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`} />
      <span className="text-gray-300 text-sm font-medium">{label}</span>
    </div>
    <span className="text-white font-mono font-medium">{percentage}%</span>
  </div>
);

const TokenDynamics: React.FC = () => {
  return (
    <section className="bg-black min-h-screen relative overflow-hidden">
      {/* Hero */}
      <div className="relative pt-32 pb-20 px-6 border-b border-white/5">
         {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)] opacity-20" />
        
        <div className="max-w-[1200px] mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
              <Coins className="w-3 h-3" />
              <span>VAI Tokenomics</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-semibold text-white tracking-tight mb-6">
              Token <br className="hidden md:block"/> Dynamics
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              The economic fuel of the Vision Chain ecosystem. Designed for sustainability, security, and agentic utility.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-8 rounded-3xl bg-[#0c0c0c] border border-white/10 text-center hover:border-blue-500/30 transition-colors"
            >
                <div className="text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest">Ticker Symbol</div>
                <div className="text-5xl font-bold text-white tracking-tight">$VAI</div>
            </motion.div>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-8 rounded-3xl bg-[#0c0c0c] border border-white/10 text-center hover:border-blue-500/30 transition-colors"
            >
                <div className="text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest">Total Supply</div>
                <div className="text-5xl font-bold text-blue-400 tracking-tight">10B</div>
            </motion.div>
             <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-8 rounded-3xl bg-[#0c0c0c] border border-white/10 text-center hover:border-blue-500/30 transition-colors"
            >
                <div className="text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest">Network Utility</div>
                <div className="text-xl font-medium text-white mt-3 text-white/90">Gas • Staking • Governance</div>
            </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Utility */}
            <div className="space-y-12">
                <motion.h2 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    className="text-3xl font-semibold text-white"
                >
                    Utility & Value Capture
                </motion.h2>
                
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex gap-6 group"
                >
                    <div className="w-14 h-14 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center text-blue-400 flex-shrink-0 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-all">
                        <Zap className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-medium text-white mb-2">Network Gas</h3>
                        <p className="text-gray-400 leading-relaxed">VAI is used to pay for computation and storage. With AI Agent swarms processing high-frequency transactions, demand correlates directly with network usage.</p>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex gap-6 group"
                >
                    <div className="w-14 h-14 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center text-purple-400 flex-shrink-0 group-hover:bg-purple-500/10 group-hover:border-purple-500/30 transition-all">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-medium text-white mb-2">Validator Staking</h3>
                        <p className="text-gray-400 leading-relaxed">Validators must stake VAI to participate in Proof of Visibility consensus. Malicious behavior results in slashing, ensuring economic security.</p>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex gap-6 group"
                >
                    <div className="w-14 h-14 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center text-emerald-400 flex-shrink-0 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-all">
                        <Users className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-medium text-white mb-2">Governance</h3>
                        <p className="text-gray-400 leading-relaxed">Token holders steer the protocol's future, voting on parameter updates, upgrades, and treasury allocations.</p>
                    </div>
                </motion.div>
            </div>

            {/* Distribution */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="p-8 md:p-10 rounded-[32px] bg-[#0f0f0f] border border-white/10 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="flex items-center gap-3 mb-8 relative z-10">
                    <PieChart className="w-6 h-6 text-blue-400" />
                    <h3 className="text-2xl font-semibold text-white">Token Distribution</h3>
                </div>
                
                <div className="space-y-1 relative z-10">
                    <DistributionRow label="Ecosystem Reserve" percentage={60} color="bg-blue-600" />
                    <DistributionRow label="Founders" percentage={10} color="bg-purple-500" />
                    <DistributionRow label="Marketing" percentage={5} color="bg-pink-500" />
                    <DistributionRow label="Partnership & Listing" percentage={5} color="bg-orange-500" />
                    <DistributionRow label="Private Sale" percentage={5} color="bg-yellow-500" />
                    <DistributionRow label="VC" percentage={4} color="bg-emerald-500" />
                    <DistributionRow label="Strategic Sale" percentage={3} color="bg-cyan-500" />
                    <DistributionRow label="Public Sale" percentage={3} color="bg-indigo-500" />
                    <DistributionRow label="Team" percentage={3} color="bg-red-500" />
                    <DistributionRow label="Advisors" percentage={2} color="bg-gray-500" />
                </div>
            </motion.div>
        </div>
      </div>
    </section>
  );
};

export default TokenDynamics;