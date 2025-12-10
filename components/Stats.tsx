import React, { useEffect, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';

const AnimatedCounter = ({ value, suffix = "" }: { value: number, suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 30, stiffness: 60 });
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        // Intentionally using Math.floor to show integer increment
        ref.current.textContent = Math.floor(latest).toLocaleString() + suffix;
      }
    });
  }, [springValue, suffix]);

  return <span ref={ref} className="text-4xl md:text-6xl font-semibold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 tracking-tight mb-2 tabular-nums">0</span>;
};

const StatItem: React.FC<{ label: string; value: number; suffix?: string; sub?: string }> = ({ label, value, suffix, sub }) => (
  <div className="flex flex-col items-center justify-center p-6 text-center group cursor-default relative z-10">
    <div className="transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1">
      <AnimatedCounter value={value} suffix={suffix} />
    </div>
    <span className="text-[#86868b] font-medium text-lg mt-2 group-hover:text-blue-400 transition-colors duration-300">{label}</span>
    {sub && <span className="text-[#86868b]/60 text-sm mt-1">{sub}</span>}
  </div>
);

const Stats: React.FC = () => {
  return (
    <section className="bg-black py-32 border-t border-white/10 relative overflow-hidden">
      {/* High-tech Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Subtle Top Light Source */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="max-w-[1200px] mx-auto px-6 relative z-10">
         <motion.div 
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ duration: 0.8 }}
           className="text-center mb-20"
         >
            <h3 className="text-4xl md:text-6xl font-semibold text-white tracking-tight drop-shadow-lg">Vision Scale.</h3>
            <p className="mt-6 text-xl text-[#86868b] max-w-2xl mx-auto leading-relaxed">
               Engineered to handle the immense throughput required by autonomous AI agent swarms.
            </p>
         </motion.div>

         <div className="grid grid-cols-2 md:grid-cols-4 gap-y-16 gap-x-8">
            <StatItem value={100} suffix="K+" label="Transactions on Devnet" />
            <StatItem value={1000} suffix="+" label="Smart Accounts" />
            <StatItem value={100} suffix="+" label="Observer Nodes" />
            <StatItem value={100000} suffix="" label="TPS" />
         </div>
      </div>
    </section>
  );
};

export default Stats;