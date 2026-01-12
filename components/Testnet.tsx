import { Component, createSignal, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import {
    Network,
    Droplets,
    ArrowRightLeft,
    BookOpen,
    Terminal,
    ExternalLink,
    Cpu,
    ShieldCheck,
    Zap,
    Copy,
    CheckCircle2,
    Download,
    Maximize2
} from 'lucide-solid';

const Testnet: Component = () => {
    const [copied, setCopied] = createSignal<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const networkInfo = [
        { label: 'Network Name', value: 'Vision Testnet v1', id: 'name' },
        { label: 'RPC URL', value: 'http://localhost:8545', id: 'rpc' },
        { label: 'Chain ID', value: '3151909', id: 'chainid' },
        { label: 'Currency Symbol', value: 'VCN', id: 'symbol' },
    ];

    onMount(() => {
        window.scrollTo(0, 0);
    });

    return (
        <div class="min-h-screen bg-[#050505] text-white pt-24 pb-20">
            {/* Hero Section */}
            <div class="relative overflow-hidden py-24 px-4 border-b border-white/5">
                <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.08)_0%,transparent_70%)] animate-pulse" />
                <div class="max-w-6xl mx-auto text-center relative z-10">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6">
                        <Zap class="w-3 h-3" />
                        Sovereign L1 Prototype
                    </div>
                    <h1 class="text-5xl md:text-7xl font-black mb-6 tracking-tight">
                        THE FUTURE OF VISION,<br />
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500">
                            LIVE ON TESTNET
                        </span>
                    </h1>
                    <p class="text-slate-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-light">
                        Join the first agentic AI blockchain ecosystem. Test, build, and innovate on a custom environment designed for autonomous intelligence.
                    </p>
                </div>
            </div>

            <div class="max-w-6xl mx-auto px-4 mt-20">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">

                    {/* Left Column: Network & Faucet */}
                    <div class="lg:col-span-2 space-y-12">

                        {/* Network Configuration */}
                        <section>
                            <h2 class="text-2xl font-bold flex items-center gap-3 mb-8">
                                <Network class="w-6 h-6 text-blue-500" />
                                Network Configuration
                            </h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {networkInfo.map((item) => (
                                    <div class="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-all group">
                                        <div class="flex justify-between items-start mb-2">
                                            <span class="text-xs font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                                            <button
                                                onClick={() => copyToClipboard(item.value, item.id)}
                                                class="text-slate-500 hover:text-white transition-colors"
                                            >
                                                {copied() === item.id ? <CheckCircle2 class="w-4 h-4 text-green-500" /> : <Copy class="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div class="text-lg font-mono text-blue-400 break-all">{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Faucet Guidance */}
                        <section class="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-3xl p-8 md:p-12 relative overflow-hidden group">
                            <div class="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Droplets class="w-32 h-32" />
                            </div>
                            <div class="relative z-10">
                                <h2 class="text-3xl font-black mb-6 flex items-center gap-3">
                                    <Droplets class="w-8 h-8 text-blue-500" />
                                    VCN Faucet
                                </h2>
                                <p class="text-slate-300 text-lg mb-8 leading-relaxed">
                                    To participate in the testnet, you'll need test tokens and gas. Use our CLI-based faucet to fund your developer accounts instantly.
                                </p>

                                <div class="bg-black/40 rounded-2xl p-6 font-mono text-sm border border-white/10 mb-8">
                                    <div class="flex justify-between items-center mb-4 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                                        <span>Terminal Script</span>
                                        <button onClick={() => copyToClipboard('cd blockchain && USER_ADDRESS=YOUR_ADDRESS npx hardhat run scripts/faucet.js --network vision_v1', 'faucet-cmd')}>
                                            {copied() === 'faucet-cmd' ? <CheckCircle2 class="w-3 h-3 text-green-500" /> : <Copy class="w-3 h-3" />}
                                        </button>
                                    </div>
                                    <div class="text-white">
                                        <span class="text-slate-500">$</span> cd blockchain<br />
                                        <span class="text-slate-500">$</span> USER_ADDRESS=<span class="text-yellow-400">0x...</span> npx hardhat run scripts/faucet.js --network vision_v1
                                    </div>
                                </div>

                                <div class="flex flex-wrap gap-4">
                                    <div class="flex items-center gap-2 text-sm text-slate-400">
                                        <ShieldCheck class="w-4 h-4 text-green-500" />
                                        Limit: 100,000 VCN / Request
                                    </div>
                                    <div class="flex items-center gap-2 text-sm text-slate-400">
                                        <ShieldCheck class="w-4 h-4 text-green-500" />
                                        10 ETH for Gas Included
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Cross-chain Test */}
                        <section>
                            <h2 class="text-2xl font-bold flex items-center gap-3 mb-8">
                                <ArrowRightLeft class="w-6 h-6 text-purple-500" />
                                EVM Cross-Chain Test
                            </h2>
                            <div class="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                                <p class="text-slate-400 leading-relaxed">
                                    Vision Chain supports advanced interoperability across EVM ecosystems. You can test asset transfers and message passing between the Vision Testnet and other EVM chains (e.g., Amoy, Sepolia) using our experimental bridge components.
                                </p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                    <div class="p-6 bg-white/[0.03] rounded-2xl border border-white/5">
                                        <h4 class="font-bold mb-2">1. Connect Amoy</h4>
                                        <p class="text-xs text-slate-500 leading-relaxed">Ensure you have test tokens on Polygon Amoy to bridge into Vision Chain.</p>
                                    </div>
                                    <div class="p-6 bg-white/[0.03] rounded-2xl border border-white/5">
                                        <h4 class="font-bold mb-2">2. Deploy Bridge Link</h4>
                                        <p class="text-xs text-slate-500 leading-relaxed">Use our SDK to deploy a cross-chain account factory for automated agent interaction.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                    </div>

                    {/* Right Column: Manual & Resources */}
                    <div class="space-y-12">

                        {/* Developer Manual */}
                        <section class="bg-[#0B0E14] border border-white/5 rounded-3xl p-8 glass-panel shadow-2xl">
                            <h2 class="text-xl font-bold mb-6 flex items-center gap-3">
                                <BookOpen class="w-5 h-5 text-blue-500" />
                                Integration Manual
                            </h2>
                            <ul class="space-y-6">
                                <li class="relative pl-8">
                                    <div class="absolute left-0 top-1 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400">1</div>
                                    <h4 class="text-sm font-bold mb-1">MetaMask Setup</h4>
                                    <p class="text-xs text-slate-500">Go to Settings &gt; Networks &gt; Add Network Manually and enter the configuration details provided.</p>
                                </li>
                                <li class="relative pl-8">
                                    <div class="absolute left-0 top-1 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400">2</div>
                                    <h4 class="text-sm font-bold mb-1">Contract Deployment</h4>
                                    <p class="text-xs text-slate-500">Update your `hardhat.config.js` with the `vision_v1` network and deploy using standard scripts.</p>
                                </li>
                                <li class="relative pl-8">
                                    <div class="absolute left-0 top-1 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400">3</div>
                                    <h4 class="text-sm font-bold mb-1">Agent Interaction</h4>
                                    <p class="text-xs text-slate-500">Connect your autonomous agents to the local node to test identity and liquidity modules.</p>
                                </li>
                            </ul>

                            <div class="mt-8 pt-6 border-t border-white/5 space-y-3">
                                <a
                                    href="/docs/vision-chain-deployment-guide.md"
                                    target="_blank"
                                    class="w-full flex justify-between items-center px-4 py-3 bg-blue-600/10 border border-blue-500/20 rounded-xl transition-all group hover:bg-blue-600/20"
                                >
                                    <div class="flex items-center gap-3">
                                        <Download class="w-4 h-4 text-blue-400" />
                                        <span class="text-xs font-bold uppercase tracking-widest text-blue-400">Deployment Guide</span>
                                    </div>
                                    <ExternalLink class="w-4 h-4 text-blue-500" />
                                </a>
                                <a href="https://github.com/VisionChainNetwork" target="_blank" class="w-full flex justify-between items-center px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all group">
                                    <div class="flex items-center gap-3">
                                        <Terminal class="w-4 h-4 text-slate-400" />
                                        <span class="text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">Github Docs</span>
                                    </div>
                                    <ExternalLink class="w-4 h-4 text-slate-600" />
                                </a>
                            </div>
                        </section>

                        {/* Technical Specs Summary */}
                        <section class="p-8 border border-white/5 rounded-3xl bg-white/[0.02]">
                            <h3 class="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6">Technical Preview</h3>
                            <div class="space-y-4">
                                <div class="flex justify-between items-center text-sm py-3 border-b border-white/5">
                                    <span class="text-slate-500">Virtual Machine</span>
                                    <span class="font-bold flex items-center gap-2">
                                        EVM + Stylus
                                        <Cpu class="w-3 h-3 text-blue-400" />
                                    </span>
                                </div>
                                <div class="flex justify-between items-center text-sm py-3 border-b border-white/5">
                                    <span class="text-slate-500">Block Time</span>
                                    <span class="font-bold font-mono text-blue-400">2.0s</span>
                                </div>
                                <div class="flex justify-between items-center text-sm py-3">
                                    <span class="text-slate-500">Consensus Mode</span>
                                    <span class="font-bold text-slate-300 italic">PoA Simulation</span>
                                </div>
                            </div>
                        </section>

                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div class="max-w-4xl mx-auto px-4 mt-32 text-center pb-20">
                <div class="p-12 rounded-[2rem] bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 border border-white/5">
                    <h2 class="text-3xl font-black mb-6 italic tracking-tight uppercase">Ready to transition to Sovereign L1?</h2>
                    <p class="text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
                        The Testnet v1 is just the beginning. We are preparing the migration to Polygon CDK for full ZK-Rollup performance and Sovereign autonomy.
                    </p>
                    <a href="/adminsystem" class="inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all text-xs">
                        Admin Control Panel
                        <ArrowRightLeft class="w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Testnet;
