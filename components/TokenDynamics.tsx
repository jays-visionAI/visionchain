import type { JSX } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Coins, PieChart, Zap, ShieldCheck, Users } from 'lucide-solid';

interface DistributionRowProps {
  label: string;
  percentage: number;
  color: string;
}

const DistributionRow = (props: DistributionRowProps): JSX.Element => (
  <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded-lg transition-colors">
    <div class="flex items-center gap-3">
      <div class={`w-3 h-3 rounded-full ${props.color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`} />
      <span class="text-gray-300 text-sm font-medium">{props.label}</span>
    </div>
    <span class="text-white font-mono font-medium">{props.percentage}%</span>
  </div>
);

const TokenDynamics = (): JSX.Element => {
  return (
    <section class="bg-black min-h-screen relative overflow-hidden">
      {/* Hero */}
      <div class="relative pt-32 pb-20 px-6 border-b border-white/5">
        {/* Background Grid */}
        <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)] opacity-20" />

        <div class="max-w-[1200px] mx-auto text-center relative z-10">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
              <Coins class="w-3 h-3" />
              <span>VAI Tokenomics</span>
            </div>
            <h1 class="text-5xl md:text-7xl font-semibold text-white tracking-tight mb-6">
              Token <br class="hidden md:block" /> Dynamics
            </h1>
            <p class="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              The economic fuel of the Vision Chain ecosystem. Designed for sustainability, security, and agentic utility.
            </p>
          </Motion.div>
        </div>
      </div>

      {/* Stats Grid */}
      <div class="max-w-[1200px] mx-auto px-6 py-24">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            inView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            class="p-8 rounded-3xl bg-[#0c0c0c] border border-white/10 text-center hover:border-blue-500/30 transition-colors"
          >
            <div class="text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest">Ticker Symbol</div>
            <div class="text-5xl font-bold text-white tracking-tight">$VAI</div>
          </Motion.div>
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            inView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            class="p-8 rounded-3xl bg-[#0c0c0c] border border-white/10 text-center hover:border-blue-500/30 transition-colors"
          >
            <div class="text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest">Total Supply</div>
            <div class="text-5xl font-bold text-blue-400 tracking-tight">10B</div>
          </Motion.div>
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            inView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            class="p-8 rounded-3xl bg-[#0c0c0c] border border-white/10 text-center hover:border-blue-500/30 transition-colors"
          >
            <div class="text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest">Network Utility</div>
            <div class="text-xl font-medium text-white mt-3 text-white/90">Gas • Staking • Governance</div>
          </Motion.div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Utility */}
          <div class="space-y-12">
            <Motion.h2
              initial={{ opacity: 0 }}
              inView={{ opacity: 1 }}
              class="text-3xl font-semibold text-white"
            >
              Utility & Value Capture
            </Motion.h2>

            <Motion.div
              initial={{ opacity: 0, x: -20 }}
              inView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              class="flex gap-6 group"
            >
              <div class="w-14 h-14 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center text-blue-400 flex-shrink-0 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-all">
                <Zap class="w-7 h-7" />
              </div>
              <div>
                <h3 class="text-xl font-medium text-white mb-2">Network Gas</h3>
                <p class="text-gray-400 leading-relaxed">VAI is used to pay for computation and storage. With AI Agent swarms processing high-frequency transactions, demand correlates directly with network usage.</p>
              </div>
            </Motion.div>

            <Motion.div
              initial={{ opacity: 0, x: -20 }}
              inView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              class="flex gap-6 group"
            >
              <div class="w-14 h-14 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center text-purple-400 flex-shrink-0 group-hover:bg-purple-500/10 group-hover:border-purple-500/30 transition-all">
                <ShieldCheck class="w-7 h-7" />
              </div>
              <div>
                <h3 class="text-xl font-medium text-white mb-2">Validator Staking</h3>
                <p class="text-gray-400 leading-relaxed">Validators must stake VAI to participate in Proof of Visibility consensus. Malicious behavior results in slashing, ensuring economic security.</p>
              </div>
            </Motion.div>

            <Motion.div
              initial={{ opacity: 0, x: -20 }}
              inView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              class="flex gap-6 group"
            >
              <div class="w-14 h-14 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center text-emerald-400 flex-shrink-0 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-all">
                <Users class="w-7 h-7" />
              </div>
              <div>
                <h3 class="text-xl font-medium text-white mb-2">Governance</h3>
                <p class="text-gray-400 leading-relaxed">Token holders steer the protocol's future, voting on parameter updates, upgrades, and treasury allocations.</p>
              </div>
            </Motion.div>
          </div>

          {/* Distribution */}
          <Motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            inView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            class="p-8 md:p-10 rounded-[32px] bg-[#0f0f0f] border border-white/10 relative overflow-hidden"
          >
            <div class="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div class="flex items-center gap-3 mb-8 relative z-10">
              <PieChart class="w-6 h-6 text-blue-400" />
              <h3 class="text-2xl font-semibold text-white">Token Distribution</h3>
            </div>

            <div class="space-y-1 relative z-10">
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
          </Motion.div>
        </div>
      </div>
    </section>
  );
};

export default TokenDynamics;