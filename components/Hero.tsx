import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Wallet } from 'lucide-react';
import LogoCarousel from './LogoCarousel';
import ParticleNetwork3D from './ParticleNetwork3D';
import CursorLightTrace from './CursorLightTrace';

const Hero: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  // Parallax effects for background layers
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const textScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.15]);

  return (
    <section 
      ref={ref} 
      className="relative min-h-[100vh] flex flex-col pt-32 overflow-hidden bg-transparent selection:bg-blue-500/30"
    >
      {/* Background Layer: Gradients & Grid - Slow Parallax */}
      <motion.div style={{ y: bgY, opacity }} className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-900/20 blur-[150px] rounded-full animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/20 blur-[150px] rounded-full animate-pulse duration-[10000ms]" />
        
        {/* Technical Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:128px_128px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
      </motion.div>

      {/* 3D Particle Network Layer */}
      <motion.div style={{ opacity }} className="absolute inset-0 z-0">
         <ParticleNetwork3D />
      </motion.div>

      {/* Cursor Follow Light Trace Layer */}
      <motion.div style={{ opacity }} className="absolute inset-0 z-0 pointer-events-none">
         <CursorLightTrace />
      </motion.div>

      {/* Text Content Container */}
      <div 
        className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center flex-grow justify-center pb-20 mt-10" 
      >
        <div className="flex flex-col items-center">
            {/* H1 - Product Name */}
            <motion.h1 
              style={{ scale: textScale }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-6xl lg:text-7xl font-semibold text-white mb-6 tracking-tighter drop-shadow-2xl"
            >
              Vision Chain.
            </motion.h1>

            {/* H2 - Tagline */}
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-xl md:text-3xl lg:text-4xl font-medium text-[#f5f5f7] mb-8 tracking-tight"
            >
              Universal Interoperability. <span className="text-[#86868b]">For the Agentic Economy.</span>
            </motion.h2>

            {/* Description */}
            <motion.p
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
               className="text-[#86868b] text-sm md:text-base font-normal max-w-2xl mb-12 leading-relaxed"
            >
               The first L1 blockchain engineered to unify fragmented ecosystems. <br className="hidden md:block" />
               Empowering autonomous agents with seamless access to identity, compute, and liquidity across any chain.
            </motion.p>

            {/* Links */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 text-[15px] md:text-[17px] justify-center"
            >
               <a 
                 href="https://wallet.visionchain.co/login"
                 target="_blank"
                 rel="noopener noreferrer"
                 className="px-8 py-3 bg-[#f5f5f7] text-black rounded-full font-medium hover:bg-white transition-all hover:scale-105 flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.6)] cursor-pointer"
               >
                 <Wallet className="w-4 h-4" />
                 Connect
               </a>
            </motion.div>
        </div>

        {/* Spacer */}
        <div className="h-20" />

      </div>

      {/* Carousel at bottom */}
      <motion.div 
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         transition={{ delay: 1, duration: 1 }}
         className="w-full relative z-20 mt-auto"
      >
        <LogoCarousel />
      </motion.div>
    </section>
  );
};

export default Hero;