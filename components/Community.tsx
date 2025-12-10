import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Twitter, Linkedin, Youtube, Send, BookOpen, MessageSquare, Github, Globe } from 'lucide-react';

const socials = [
  {
    name: "Telegram",
    description: "Join our official chat for real-time updates and community discussion.",
    icon: Send,
    url: "http://t.me/visionchaingroup",
    color: "group-hover:text-[#229ED9]",
    bg: "group-hover:bg-[#229ED9]/10"
  },
  {
    name: "Twitter",
    description: "Follow us for the latest announcements and ecosystem news.",
    icon: Twitter,
    url: "https://x.com/VCN_VisionChain", 
    color: "group-hover:text-[#1DA1F2]",
    bg: "group-hover:bg-[#1DA1F2]/10"
  },
  {
    name: "Medium",
    description: "Read our in-depth articles, research papers, and development updates.",
    icon: BookOpen,
    url: "https://medium.com/@OfficialVisionChain",
    color: "group-hover:text-white",
    bg: "group-hover:bg-white/10"
  },
  {
    name: "LinkedIn",
    description: "Connect with our professional network and job opportunities.",
    icon: Linkedin,
    url: "https://www.linkedin.com/company/visionchain/",
    color: "group-hover:text-[#0A66C2]",
    bg: "group-hover:bg-[#0A66C2]/10"
  },
  {
    name: "YouTube",
    description: "Watch tutorials, keynotes, and technical breakdowns.",
    icon: Youtube,
    url: "https://www.youtube.com/@Vision-yw1ww",
    color: "group-hover:text-[#FF0000]",
    bg: "group-hover:bg-[#FF0000]/10"
  },
  {
    name: "GitHub",
    description: "Explore our open-source repositories and contribute to the network.",
    icon: Github,
    url: "https://github.com/VisionChainNetwork",
    color: "group-hover:text-white",
    bg: "group-hover:bg-white/10"
  }
];

const SocialCard: React.FC<{ social: typeof socials[0], idx: number }> = ({ social, idx }) => {
  const divRef = useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
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
        transition={{ duration: 0.5, delay: idx * 0.1 }}
        className="group relative rounded-3xl overflow-hidden border border-white/5 hover:-translate-y-1 transition-transform duration-300"
    >
        {/* Moving Light Border Effect */}
        <div className="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
           <div className="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
        </div>

        <a
            ref={divRef}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="block relative h-full m-[1px] rounded-[23px] bg-[#111] p-6 z-10 overflow-hidden"
        >
            {/* Spotlight Effect */}
            <div 
              className="pointer-events-none absolute -inset-px transition duration-300 opacity-0 z-0"
              style={{
                opacity,
                background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
              }}
            />

            <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 mb-4 transition-colors duration-300 ${social.color} ${social.bg} relative z-10`}>
                <social.icon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-white transition-colors relative z-10">{social.name}</h3>
            <p className="text-gray-400 text-xs leading-relaxed group-hover:text-gray-300 transition-colors relative z-10">
                {social.description}
            </p>
        </a>
    </motion.div>
  );
};

const Community: React.FC = () => {
  return (
    <section className="bg-black min-h-screen pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-[#0a1a30] via-[#050505] to-[#050505] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)] opacity-20 pointer-events-none" />
        
        <div className="max-w-[1200px] mx-auto relative z-10">
            {/* Hero Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-center mb-20"
            >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
                    <Globe className="w-3 h-3" />
                    <span>Global Ecosystem</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-semibold text-white tracking-tight mb-6">
                    Join the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Visionaries.</span>
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                    Connect with a decentralized network of developers, validators, and researchers building the first Agentic AI Blockchain.
                </p>
            </motion.div>

            {/* Main Content Flow */}
            <div className="flex flex-col gap-16 mb-24">
                
                {/* Section 1: Connect (Socials) */}
                <div className="space-y-8">
                    <div>
                        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                            Connect
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {socials.map((social, idx) => (
                                <SocialCard key={social.name} social={social} idx={idx} />
                            ))}
                        </div>
                    </div>
                </div>

            </div>

        </div>
    </section>
  );
};

export default Community;