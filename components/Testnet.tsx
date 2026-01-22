import { Component, createSignal, onMount, Show } from 'solid-js';
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
    Plus,
    CheckCircle2,
    Download,
    Maximize2,
    Activity,
    ArrowUpRight,
    Settings,
    Info,
    AlertCircle
} from 'lucide-solid';

const Testnet: Component = () => {
    const [copied, setCopied] = createSignal<string | null>(null);
    const [rpcStatus, setRpcStatus] = createSignal<'Checking' | 'Online' | 'Offline'>('Checking');

    const checkRpc = async () => {
        try {
            // Check api.visionchain.co root as the primary endpoint
            const response = await fetch('https://api.visionchain.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 })
            });
            if (response.ok) setRpcStatus('Online');
            else setRpcStatus('Offline');
        } catch (e) {
            setRpcStatus('Offline');
        }
    };

    onMount(() => {
        window.scrollTo(0, 0);
        checkRpc();
    });

    const addToMetaMask = async () => {
        if (!(window as any).ethereum) {
            alert('MetaMask is not installed. Please install it to use this feature.');
            return;
        }

        try {
            await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                    {
                        chainId: '0x' + (3151909).toString(16),
                        chainName: 'Vision Testnet v2',
                        nativeCurrency: {
                            name: 'VCN',
                            symbol: 'VCN',
                            decimals: 18,
                        },
                        rpcUrls: ['https://api.visionchain.co'],
                        blockExplorerUrls: ['https://www.visionchain.co/visionscan'],
                    },
                ],
            });
        } catch (error) {
            console.error('Failed to add network to MetaMask:', error);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const networkInfo = [
        { label: 'Network Name', value: 'Vision Testnet v2', id: 'name' },
        { label: 'RPC URL', value: 'https://api.visionchain.co', id: 'rpc' },
        { label: 'Sequencer API', value: 'https://api.visionchain.co/submit', id: 'seq' },
        { label: 'Chain ID', value: '3151909', id: 'chainid' },
        { label: 'Currency Symbol', value: 'VCN', id: 'symbol' },
    ];

    return (
        <div class="min-h-screen bg-[#050505] text-white pt-24 pb-20">
            {/* Hero Section */}
            <div class="relative overflow-hidden py-24 px-4 border-b border-white/5">
                <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.08)_0%,transparent_70%)] animate-pulse" />
                <div class="max-w-6xl mx-auto text-center relative z-10">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6">
                        <Zap class="w-3 h-3" />
                        AI-Native Layer 1 (Kafka Engine v2)
                    </div>
                    <h1 class="text-5xl md:text-7xl font-black mb-6 tracking-tight">
                        THE FUTURE OF VISION,<br />
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500">
                            LIVE ON TESTNET V2
                        </span>
                    </h1>
                    <p class="text-slate-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-light">
                        Join the first agentic AI blockchain ecosystem. Powered by a high-throughput **Shared Sequencer v2** and **AI Oracle** for dynamic tokenomics.
                    </p>
                </div>
            </div>

            <div class="max-w-6xl mx-auto px-4 mt-20">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">

                    {/* Left Column: Network & Faucet */}
                    <div class="lg:col-span-2 space-y-12">

                        {/* Network Configuration */}
                        <section>
                            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                <h2 class="text-2xl font-bold flex items-center gap-3">
                                    <Network class="w-6 h-6 text-blue-500" />
                                    Network Configuration
                                    <div class="flex items-center gap-2 ml-4 px-2 py-1 rounded-full bg-white/5 border border-white/10 shrink-0">
                                        <div class={`w-2 h-2 rounded-full ${rpcStatus() === 'Online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                                            rpcStatus() === 'Offline' ? 'bg-red-500' : 'bg-slate-500 animate-pulse'
                                            }`} />
                                        <span class={`text-[10px] font-bold uppercase tracking-widest ${rpcStatus() === 'Online' ? 'text-green-400' :
                                            rpcStatus() === 'Offline' ? 'text-red-400' : 'text-slate-500'
                                            }`}>
                                            RPC: {rpcStatus()}
                                        </span>
                                    </div>
                                </h2>
                                <div class="flex items-center gap-4">
                                    <Show when={rpcStatus() === 'Offline'}>
                                        <button
                                            onClick={checkRpc}
                                            class="text-[10px] font-black text-blue-500 hover:text-blue-400 underline decoration-dotted underline-offset-4"
                                        >
                                            Retry Connection
                                        </button>
                                    </Show>
                                    <button
                                        onClick={addToMetaMask}
                                        class="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                                    >
                                        <Plus class="w-4 h-4" />
                                        Add to MetaMask
                                    </button>
                                </div>
                            </div>

                            <Show when={rpcStatus() === 'Offline'}>
                                <div class="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
                                    <AlertCircle class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 class="text-sm font-bold text-red-400 mb-1">Connection Issue Detected</h4>
                                        <p class="text-xs text-slate-400 leading-relaxed">
                                            The RPC endpoint is unreachable. This usually happens because:
                                            <br />• Your browser is blocking **HTTP** calls on an **HTTPS** site (Mixed Content).
                                            <br />• The IP Address (`46.224.221.201`) is temporarily restricted by your firewall.
                                            <br /><strong class="text-slate-300">Solution:</strong> Try accessing the RPC URL directly in a new tab, then click "Advanced {"->"} Proceed" to trust the IP.
                                        </p>
                                    </div>
                                </div>
                            </Show>
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
                                    Funds are automatically distributed to validators. For manual requests, rely on the admin panel or CLI.
                                </p>

                                <div class="bg-black/40 rounded-2xl p-6 font-mono text-sm border border-white/10 mb-8">
                                    <div class="flex justify-between items-center mb-4 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                                        <span>Terminal Script (v2)</span>
                                        <button onClick={() => copyToClipboard('cd blockchain && npx hardhat run scripts/faucet.js --network vision_v2', 'faucet-cmd')}>
                                            {copied() === 'faucet-cmd' ? <CheckCircle2 class="w-3 h-3 text-green-500" /> : <Copy class="w-3 h-3" />}
                                        </button>
                                    </div>
                                    <div class="text-white">
                                        <span class="text-slate-500">$</span> cd blockchain<br />
                                        <span class="text-slate-500">$</span> npx hardhat run scripts/faucet.js --network vision_v2
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
                                The Equalizer (v2 State Sync)
                            </h2>
                            <div class="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                                <p class="text-slate-400 leading-relaxed">
                                    Vision Chain uses the <strong>v2 Equalizer Model</strong> for zero-loss interoperability. Assets are locked on satellite chains (e.g., Sepolia) and instantly synced to Vision via the Kafka-powered Sequencer.
                                </p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                    <div class="p-6 bg-white/[0.03] rounded-2xl border border-white/5">
                                        <h4 class="font-bold mb-2">1. Lock on Satellite</h4>
                                        <p class="text-xs text-slate-500 leading-relaxed">Deposit assets into the VisionVault contract on Ethereum Sepolia or other connected chains.</p>
                                    </div>
                                    <div class="p-6 bg-white/[0.03] rounded-2xl border border-white/5">
                                        <h4 class="font-bold mb-2">2. Kafka Sync</h4>
                                        <p class="text-xs text-slate-500 leading-relaxed">The Shared Sequencer v2 ingests the event and credits your account with microsecond latency.</p>
                                    </div>
                                </div>
                                <div class="pt-6">
                                    <A
                                        href="/bridge"
                                        class="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl shadow-purple-500/20 active:scale-95"
                                    >
                                        <ArrowRightLeft class="w-4 h-4" />
                                        Launch Vision Bridge
                                    </A>
                                    <A
                                        href="/paymaster"
                                        class="inline-flex items-center gap-2 px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95"
                                    >
                                        <ShieldCheck class="w-4 h-4 text-orange-400" />
                                        Gasless Hub (Paymaster)
                                    </A>
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
                                    <h4 class="text-sm font-bold mb-1 uppercase tracking-tight">MetaMask Setup (v2)</h4>
                                    <p class="text-xs text-slate-500 leading-relaxed">Add Vision Testnet v2 manually. **Chain ID: 3151909**, RPC: `https://api.visionchain.co`. Use VCN for gas.</p>
                                </li>
                                <li class="relative pl-8">
                                    <div class="absolute left-0 top-1 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400">2</div>
                                    <h4 class="text-sm font-bold mb-1 uppercase tracking-tight">v2 Sequencer API</h4>
                                    <p class="text-xs text-slate-500 leading-relaxed">Bypass mempool for sub-second ingestion. POST signed transactions with **A110/S200 metadata** to the Sequencer URL.</p>
                                </li>
                                <li class="relative pl-8">
                                    <div class="absolute left-0 top-1 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400">3</div>
                                    <h4 class="text-sm font-bold mb-1 uppercase tracking-tight">AI Accounting Audit</h4>
                                    <p class="text-xs text-slate-500 leading-relaxed">Verify transactions on **VisionScan Beta**. View automated journal entries (Dr/Cr) and tax classification generated by AI.</p>
                                </li>
                                <li class="relative pl-8">
                                    <div class="absolute left-0 top-1 w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400">4</div>
                                    <h4 class="text-sm font-bold mb-1 uppercase tracking-tight">Cross-chain Bridge</h4>
                                    <p class="text-xs text-slate-500 leading-relaxed">Simulate asset deposits and withdrawals between external L1 networks and Vision v2 via the **Bridge Dashboard**.</p>
                                </li>
                                <li class="relative pl-8">
                                    <div class="absolute left-0 top-1 w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px] font-bold text-orange-400">5</div>
                                    <h4 class="text-sm font-bold mb-1 uppercase tracking-tight">Gasless Paymaster (AA)</h4>
                                    <p class="text-xs text-slate-500 leading-relaxed">Experience zero-gas transactions. Developers can sponsor their users' gas fees via the **Paymaster Hub**.</p>
                                </li>
                            </ul>

                            <div class="mt-8 pt-6 border-t border-white/5 space-y-3">
                                <a
                                    href="/docs/vision-chain-testnet-developer-manual.md"
                                    target="_blank"
                                    class="w-full flex justify-between items-center px-4 py-3 bg-blue-600/10 border border-blue-500/20 rounded-xl transition-all group hover:bg-blue-600/20"
                                >
                                    <div class="flex items-center gap-3">
                                        <Maximize2 class="w-4 h-4 text-blue-400" />
                                        <span class="text-xs font-bold uppercase tracking-widest text-blue-400">Step-by-Step Manual (EN)</span>
                                    </div>
                                    <ExternalLink class="w-4 h-4 text-blue-500" />
                                </a>
                                <a
                                    href="/docs/vision-chain-testnet-manual-ko.md"
                                    target="_blank"
                                    class="w-full flex justify-between items-center px-4 py-3 bg-white/5 border border-white/10 rounded-xl transition-all group hover:bg-white/10"
                                >
                                    <div class="flex items-center gap-3">
                                        <BookOpen class="w-4 h-4 text-slate-400" />
                                        <span class="text-xs font-bold uppercase tracking-widest text-slate-400">한글 단계별 매뉴얼 (KO)</span>
                                    </div>
                                    <ExternalLink class="w-4 h-4 text-slate-500" />
                                </a>
                            </div>
                        </section>

                        {/* Technical Specs Summary */}
                        <section class="p-8 border border-white/5 rounded-3xl bg-white/[0.02]">
                            <h3 class="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6">Technical Preview V2</h3>
                            <div class="space-y-4">
                                <div class="flex justify-between items-center text-sm py-3 border-b border-white/5">
                                    <span class="text-slate-500">Engine</span>
                                    <span class="font-bold flex items-center gap-2">
                                        Kafka Shared Sequencer v2
                                        <Cpu class="w-3 h-3 text-blue-400" />
                                    </span>
                                </div>
                                <div class="flex justify-between items-center text-sm py-3 border-b border-white/5">
                                    <span class="text-slate-500">Block Time</span>
                                    <span class="font-bold font-mono text-blue-400">Sub-second (Kafka Ordered)</span>
                                </div>
                                <div class="flex justify-between items-center text-sm py-3">
                                    <span class="text-slate-500">Consensus Mode</span>
                                    <span class="font-bold text-slate-300 italic">Sequencer-First Execution</span>
                                </div>
                            </div>
                        </section>

                    </div>
                </div>
            </div>

            {/* Developer & Testing Section (New) */}
            <div class="max-w-6xl mx-auto px-4 mt-32 pt-20 border-t border-white/5">
                <div class="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
                    <div class="max-w-xl">
                        <span class="text-blue-500 font-black tracking-widest uppercase text-[10px] mb-3 block">Developer Hub</span>
                        <h2 class="text-3xl md:text-5xl font-black text-white italic tracking-tighter mb-4">Labs & Testing.</h2>
                        <p class="text-slate-400 font-medium leading-relaxed">
                            Advanced environment for stress testing, auditing, and simulating mass economic interactions
                            before mainnet deployment.
                        </p>
                    </div>
                    <div class="flex items-center gap-4">
                        <a
                            href="/docs/vision-chain-testnet-developer-manual.md"
                            target="_blank"
                            class="px-8 py-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-2xl flex items-center gap-3 transition-all group"
                        >
                            <BookOpen class="w-4 h-4 text-blue-400" />
                            <span class="text-xs font-black text-blue-400 uppercase tracking-widest text-[10px]">Manual (EN)</span>
                        </a>
                        <a
                            href="/docs/vision-chain-testnet-manual-ko.md"
                            target="_blank"
                            class="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 transition-all group"
                        >
                            <span class="text-xs font-black text-white uppercase tracking-widest text-[10px]">한글 매뉴얼 (KO)</span>
                        </a>
                        <A href="/trafficsim" class="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 transition-all group">
                            <span class="text-xs font-black text-white uppercase tracking-widest text-[10px]">Enter Console</span>
                            <ArrowUpRight class="w-4 h-4 text-blue-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </A>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <A href="/trafficsim" class="group block">
                        <div class="bg-gradient-to-br from-blue-600/20 to-transparent border border-blue-500/20 rounded-[40px] p-10 h-full hover:border-blue-500/40 transition-all">
                            <div class="flex justify-between items-start mb-10">
                                <div class="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                    <Activity class="w-8 h-8" />
                                </div>
                                <span class="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest">Independent Module</span>
                            </div>
                            <h3 class="text-3xl font-black italic text-white mb-4 group-hover:text-blue-300 transition-colors uppercase">TRAFFIC SIMULATOR</h3>
                            <p class="text-slate-400 font-medium leading-relaxed mb-8 text-sm">
                                Generate high-frequency synthetic transactions, manage randomized wallet generations,
                                and stress test the cross-chain equalizer logic under extreme conditions v2.
                            </p>
                            <div class="flex items-center gap-2 text-blue-500 font-black uppercase text-[10px] tracking-[0.2em]">
                                Launch Sim Dashboard
                                <ArrowUpRight class="w-4 h-4" />
                            </div>
                        </div>
                    </A>

                    <div class="bg-white/[0.01] border border-white/5 rounded-[40px] p-10 h-full flex flex-col justify-center relative overflow-hidden group">
                        <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div class="relative z-10">
                            <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 mb-10">
                                <ShieldCheck class="w-8 h-8" />
                            </div>
                            <h3 class="text-3xl font-black italic text-white/20 mb-4 tracking-tighter uppercase line-through decoration-blue-500/50">Audit Protocol</h3>
                            <p class="text-gray-600 font-medium leading-relaxed italic text-sm">
                                Advanced automated audit compliance module.
                                (Coming soon to Phase 6)
                            </p>
                        </div>
                    </div>
                </div>
            </div>


            {/* CTA Section */}
            <div class="max-w-4xl mx-auto px-4 mt-32 text-center pb-20">
                <div class="p-12 rounded-[2rem] bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 border border-white/5">
                    <h2 class="text-3xl font-black mb-6 italic tracking-tight uppercase">Ready for the Sovereign AI Web?</h2>
                    <p class="text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
                        The Testnet v2 is the foundation for our upcoming ZK-Autonomy transition. Start building with high-availability accounting today.
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
