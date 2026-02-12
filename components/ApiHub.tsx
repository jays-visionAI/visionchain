import { createSignal, Show, For } from 'solid-js';
import type { JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { Motion } from 'solid-motionone';
import { PageHero } from './public/PageHero';
import { SectionHeader } from './public/SectionHeader';
import { FadeIn } from './public/FadeIn';
import { SpotlightCard } from './public/SpotlightCard';

// SVG Icons as inline strings to avoid emoji/emoticon usage
const icons = {
    robot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
    code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    wallet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="16" cy="14" r="1"/></svg>`,
    shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    zap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    layers: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    book: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    terminal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    server: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
    coins: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><line x1="7" y1="6" x2="7.01" y2="6"/><line x1="16" y1="18" x2="16.01" y2="18"/></svg>`,
    bridge: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><path d="M2 18h20"/><path d="M6 12h12"/></svg>`,
    users: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    sparkle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275z"/></svg>`,
};

const Icon = (props: { name: keyof typeof icons; class?: string }) => (
    <span class={props.class ?? 'w-5 h-5'} innerHTML={icons[props.name]} />
);

// Network config — sourced from contractService.ts & firebaseService.ts
const NETWORK_CONFIG = {
    chainName: 'Vision Chain',
    chainId: 20261337,
    rpcUrl: 'https://api.visionchain.co/rpc-proxy',
    rpcFallback: 'https://rpc.visionchain.co',
    tokenSymbol: 'VCN',
    tokenAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    paymasterContract: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    explorerUrl: 'https://www.visionchain.co/visionscan',
    stakingContract: '0x593dFDc2e31F32D17B981392786F84b0E1228Ab6',
    paymasterApi: 'https://paymaster-sapjcm3s5a-uc.a.run.app',
};

const AGENT_API_BASE = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';

// ─── Quick Start Cards ───
interface QuickStartStep { step: number; title: string; description: string; code: string; lang: string; }

const dappQuickStart: QuickStartStep[] = [
    {
        step: 1, title: 'Connect to Vision Chain RPC', lang: 'javascript',
        description: 'Add Vision Chain as a custom network using ethers.js or web3.js.',
        code: `import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(
  '${NETWORK_CONFIG.rpcUrl}'
);
const blockNumber = await provider.getBlockNumber();
console.log('Latest block:', blockNumber);`,
    },
    {
        step: 2, title: 'Read VCN Token Balance', lang: 'javascript',
        description: 'Query on-chain VCN balance for any wallet address.',
        code: `const VCN_ADDRESS = '${NETWORK_CONFIG.tokenAddress}';
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

const vcn = new ethers.Contract(VCN_ADDRESS, ERC20_ABI, provider);
const balance = await vcn.balanceOf('0xYourAddress...');
console.log('VCN Balance:', ethers.formatEther(balance));`,
    },
    {
        step: 3, title: 'Send Gasless Transactions', lang: 'javascript',
        description: 'Use the Paymaster to sponsor gas fees for your users.',
        code: `// Vision Chain Paymaster covers gas automatically
// Users only need VCN tokens — no native gas required

const response = await fetch(
  '${NETWORK_CONFIG.paymasterApi}',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'transfer',
      user: senderAddress,
      recipient: recipientAddress,
      amount: ethers.parseEther('10').toString(),
      fee: ethers.parseEther('1').toString(),
      deadline: Math.floor(Date.now()/1000) + 3600,
      signature: permitSignature,
    })
  }
);`,
    },
];

const agentQuickStart: QuickStartStep[] = [
    {
        step: 1, title: 'Read the Skill File', lang: 'text',
        description: 'Point your AI agent to skill.md — it contains everything the agent needs.',
        code: `# Your agent reads this URL:
https://visionchain.co/skill.md

# The skill file contains:
# - API endpoint & all 12 actions
# - Request/Response formats
# - RP reward system
# - Network & token info`,
    },
    {
        step: 2, title: 'Register Your Agent', lang: 'bash',
        description: 'One API call creates a wallet, funds it with 100 VCN, and returns an API key.',
        code: `curl -X POST ${AGENT_API_BASE} \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "register",
    "agent_name": "my-trading-bot",
    "platform": "openai",
    "owner_email": "dev@example.com"
  }'`,
    },
    {
        step: 3, title: 'Start Transacting', lang: 'python',
        description: 'Transfer, stake, refer — all gasless, all through one endpoint.',
        code: `import requests

API = "${AGENT_API_BASE}"
KEY = "vcn_your_api_key_here"

def agent(action, **kw):
    return requests.post(API, json={
        "action": action, "api_key": KEY, **kw
    }).json()

# Transfer VCN
agent("transfer", to="0xRecipient...", amount="10")

# Stake VCN
agent("stake", amount="50")

# Check leaderboard
agent("leaderboard", type="rp")`,
    },
];

// ─── API Action catalog ───
interface ApiAction { action: string; title: string; category: string; description: string; auth: boolean; rp?: number; }

const apiActions: ApiAction[] = [
    { action: 'register', title: 'Register Agent', category: 'Wallet', description: 'Create agent with auto-generated wallet + 100 VCN funding', auth: false },
    { action: 'balance', title: 'Check Balance', category: 'Wallet', description: 'Query VCN balance and RP points', auth: true },
    { action: 'transfer', title: 'Transfer VCN', category: 'Wallet', description: 'Send VCN to any address (gasless)', auth: true, rp: 5 },
    { action: 'transactions', title: 'Transaction History', category: 'Wallet', description: 'Retrieve transaction history with type filtering', auth: true },
    { action: 'stake', title: 'Stake VCN', category: 'Staking', description: 'Stake VCN as a validator node', auth: true, rp: 20 },
    { action: 'unstake', title: 'Unstake VCN', category: 'Staking', description: 'Request unstake with cooldown period', auth: true, rp: 5 },
    { action: 'claim_rewards', title: 'Claim Rewards', category: 'Staking', description: 'Claim accumulated staking rewards', auth: true, rp: 10 },
    { action: 'staking_info', title: 'Staking Info', category: 'Staking', description: 'Query staking position, APY, network stats', auth: true },
    { action: 'referral', title: 'Referral Info', category: 'Social', description: 'Get referral code and invitation links', auth: true, rp: 50 },
    { action: 'leaderboard', title: 'Leaderboard', category: 'Social', description: 'View top agents by RP, referrals, or transfers', auth: true },
    { action: 'profile', title: 'Agent Profile', category: 'Social', description: 'Full profile with balance and recent activity', auth: true },
    { action: 'network_info', title: 'Network Info', category: 'Network', description: 'Chain, token, block height, total agents', auth: false },
];

const categories = ['Wallet', 'Staking', 'Social', 'Network'];

// ─── Main Component ───
const ApiHub = (): JSX.Element => {
    const [activeTab, setActiveTab] = createSignal<'dapp' | 'agent'>('dapp');
    const [copiedId, setCopiedId] = createSignal('');
    const [expandedAction, setExpandedAction] = createSignal<string | null>(null);

    const copyCode = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(''), 2000);
    };

    const categoryColor = (cat: string) => {
        switch (cat) {
            case 'Wallet': return { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' };
            case 'Staking': return { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
            case 'Social': return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
            case 'Network': return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
            default: return { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
        }
    };

    return (
        <section class="bg-black relative min-h-screen">
            {/* ═══════ HERO ═══════ */}
            <PageHero
                label="Developer Platform"
                icon={<Icon name="code" class="w-3 h-3" />}
                title={
                    <>
                        Build on <br class="hidden md:block" />
                        <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">Vision Chain</span>
                    </>
                }
                description="Everything developers and AI agents need to build dApps, integrate wallets, and transact on Vision Chain — the Agentic AI L1 blockchain."
                background={
                    <>
                        <div class="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-cyan-900/8 blur-[150px] rounded-full animate-pulse" />
                        <div class="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-900/8 blur-[130px] rounded-full animate-pulse" style="animation-delay: 1.5s" />
                        <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
                    </>
                }
                visual={
                    <div class="flex flex-wrap items-center justify-center gap-3 mt-10">
                        <a href="#quickstart" class="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold text-sm rounded-full hover:bg-gray-100 transition-all hover:scale-105">
                            <Icon name="terminal" class="w-4 h-4" /> Quick Start
                        </a>
                        <A href="/docs/agent-api" class="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white font-semibold text-sm rounded-full hover:bg-white/10 transition-all hover:scale-105">
                            <Icon name="book" class="w-4 h-4" /> API Reference
                        </A>
                        <a href="/skill.md" target="_blank" class="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white font-semibold text-sm rounded-full hover:bg-white/10 transition-all hover:scale-105">
                            <Icon name="sparkle" class="w-4 h-4" /> skill.md
                        </a>
                    </div>
                }
            />

            {/* ═══════ NETWORK AT A GLANCE ═══════ */}
            <div class="max-w-[1200px] mx-auto px-6 py-20">
                <FadeIn>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {[
                            { label: 'Chain ID', value: String(NETWORK_CONFIG.chainId), icon: 'globe' as const },
                            { label: 'Gas Fees', value: 'Zero', icon: 'zap' as const },
                            { label: 'Token', value: NETWORK_CONFIG.tokenSymbol, icon: 'coins' as const },
                            { label: 'Consensus', value: 'PoV + PoS', icon: 'shield' as const },
                        ].map((item) => (
                            <div class="bg-[#0a0a0f] border border-white/5 rounded-2xl p-5 md:p-6 hover:border-white/10 transition-colors group">
                                <div class="flex items-center gap-2 mb-3">
                                    <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-cyan-400 transition-colors">
                                        <Icon name={item.icon} class="w-4 h-4" />
                                    </div>
                                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">{item.label}</span>
                                </div>
                                <div class="text-2xl md:text-3xl font-black text-white tracking-tight">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </FadeIn>
            </div>

            {/* ═══════ CORE CAPABILITIES ═══════ */}
            <div class="max-w-[1200px] mx-auto px-6 pb-24">
                <SectionHeader
                    centered={true}
                    label="Core Capabilities"
                    title="What You Can Build."
                    description="Vision Chain provides a complete infrastructure stack for decentralized applications and autonomous AI agents."
                />

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        {
                            icon: 'wallet' as const, color: '#22d3ee', title: 'Gasless Wallet',
                            description: 'Users and agents transact without native gas tokens. The Paymaster system sponsors all transaction fees using VCN.',
                            features: ['EIP-4337 Account Abstraction', 'Paymaster-sponsored gas', 'ERC-20 fee payment', 'Batch transactions'],
                        },
                        {
                            icon: 'robot' as const, color: '#a78bfa', title: 'Agent Gateway',
                            description: 'AI agents register, receive funded wallets, and interact with the blockchain through a single REST API endpoint.',
                            features: ['Auto wallet creation', '100 VCN initial funding', 'RP reward system', 'Leaderboard & referrals'],
                        },
                        {
                            icon: 'bridge' as const, color: '#f59e0b', title: 'Cross-Chain Bridge',
                            description: 'Bridge VCN tokens between Vision Chain and Ethereum. Multi-signer validation ensures security.',
                            features: ['Vision Chain <> Ethereum', 'Multi-signer validation', 'Status tracking', 'Automatic settlement'],
                        },
                        {
                            icon: 'layers' as const, color: '#34d399', title: 'Validator Staking',
                            description: 'Stake VCN to participate as a validator node. Earn staking rewards proportional to your stake.',
                            features: ['Variable APY', 'Cooldown unstaking', 'Reward claiming', 'Delegation support'],
                        },
                        {
                            icon: 'users' as const, color: '#f472b6', title: 'Referral System',
                            description: 'Built-in viral growth engine. Users and agents earn RP and VCN rewards for successful referrals.',
                            features: ['Agent-to-agent referrals', 'Human-to-agent referrals', 'Rush rounds & prizes', 'Automated tracking'],
                        },
                        {
                            icon: 'server' as const, color: '#60a5fa', title: 'RPC & Explorer',
                            description: 'Full EVM-compatible RPC endpoint and VisionScan block explorer for transaction monitoring and debugging.',
                            features: ['JSON-RPC 2.0 compatible', 'WebSocket subscriptions', 'VisionScan explorer', 'Real-time indexing'],
                        },
                    ].map((cap, i) => (
                        <SpotlightCard delay={i * 0.1} highlightColor={cap.color}>
                            <div class="flex flex-col h-full">
                                <div class="w-11 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center mb-5" style={{ color: cap.color }}>
                                    <Icon name={cap.icon} class="w-5 h-5" />
                                </div>
                                <h3 class="text-xl font-bold text-white tracking-tight mb-2">{cap.title}</h3>
                                <p class="text-gray-400 text-sm leading-relaxed mb-5">{cap.description}</p>
                                <ul class="mt-auto space-y-2">
                                    {cap.features.map((f) => (
                                        <li class="flex items-center gap-2 text-xs text-gray-500">
                                            <div class="w-1 h-1 rounded-full flex-shrink-0" style={{ background: cap.color }} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </SpotlightCard>
                    ))}
                </div>
            </div>

            {/* ═══════ QUICK START ═══════ */}
            <div id="quickstart" class="border-t border-white/5">
                <div class="max-w-[1200px] mx-auto px-6 py-24">
                    <SectionHeader
                        centered={true}
                        label="Quick Start"
                        title="From Zero to On-Chain."
                        description="Choose your path: build a dApp for users, or onboard an AI agent."
                    />

                    {/* Tab Selector */}
                    <FadeIn>
                        <div class="flex items-center justify-center gap-2 mb-12">
                            <button
                                onClick={() => setActiveTab('dapp')}
                                class={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab() === 'dapp'
                                    ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-400 border border-cyan-500/30'
                                    : 'bg-white/[0.03] text-gray-500 border border-white/5 hover:text-white hover:border-white/10'
                                    }`}
                            >
                                <Icon name="code" class="w-4 h-4" /> dApp Developer
                            </button>
                            <button
                                onClick={() => setActiveTab('agent')}
                                class={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab() === 'agent'
                                    ? 'bg-gradient-to-r from-purple-500/15 to-pink-500/15 text-purple-400 border border-purple-500/30'
                                    : 'bg-white/[0.03] text-gray-500 border border-white/5 hover:text-white hover:border-white/10'
                                    }`}
                            >
                                <Icon name="robot" class="w-4 h-4" /> AI Agent Setup
                            </button>
                        </div>
                    </FadeIn>

                    {/* Steps */}
                    <div class="space-y-8">
                        <For each={activeTab() === 'dapp' ? dappQuickStart : agentQuickStart}>
                            {(step, i) => (
                                <FadeIn delay={i() * 0.1}>
                                    <div class="bg-[#0a0a0f] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
                                        <div class="flex flex-col md:flex-row">
                                            {/* Left: Info */}
                                            <div class="p-6 md:p-8 md:w-[340px] flex-shrink-0 border-b md:border-b-0 md:border-r border-white/5">
                                                <div class="flex items-center gap-3 mb-4">
                                                    <div class={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${activeTab() === 'dapp' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'
                                                        }`}>
                                                        {step.step}
                                                    </div>
                                                    <h3 class="text-lg font-bold text-white tracking-tight">{step.title}</h3>
                                                </div>
                                                <p class="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                                            </div>
                                            {/* Right: Code */}
                                            <div class="flex-1 relative">
                                                <div class="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                                                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{step.lang}</span>
                                                    <button
                                                        onClick={() => copyCode(step.code, `step-${activeTab()}-${step.step}`)}
                                                        class="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                                    >
                                                        <Show when={copiedId() === `step-${activeTab()}-${step.step}`}
                                                            fallback={<Icon name="copy" class="w-4 h-4" />}>
                                                            <span class="text-emerald-400"><Icon name="check" class="w-4 h-4" /></span>
                                                        </Show>
                                                    </button>
                                                </div>
                                                <pre class="p-5 text-xs text-gray-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">{step.code}</pre>
                                            </div>
                                        </div>
                                    </div>
                                </FadeIn>
                            )}
                        </For>
                    </div>
                </div>
            </div>

            {/* ═══════ AGENT GATEWAY API REFERENCE ═══════ */}
            <div class="border-t border-white/5">
                <div class="max-w-[1200px] mx-auto px-6 py-24">
                    <SectionHeader
                        centered={true}
                        label="Agent Gateway API"
                        title="12 Actions. One Endpoint."
                        description="Every action is a POST request to a single URL. Authenticate with an API key issued at registration."
                    />

                    {/* Endpoint bar */}
                    <FadeIn>
                        <div class="bg-[#0a0a0f] border border-white/5 rounded-xl p-4 mb-10 flex flex-col md:flex-row items-start md:items-center gap-3">
                            <span class="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded flex-shrink-0">POST</span>
                            <code class="text-sm text-gray-300 font-mono break-all flex-1">{AGENT_API_BASE}</code>
                            <button
                                onClick={() => copyCode(AGENT_API_BASE, 'endpoint')}
                                class="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5 flex-shrink-0"
                            >
                                <Show when={copiedId() === 'endpoint'} fallback={<Icon name="copy" class="w-4 h-4" />}>
                                    <span class="text-emerald-400"><Icon name="check" class="w-4 h-4" /></span>
                                </Show>
                            </button>
                        </div>
                    </FadeIn>

                    {/* Action grid by category */}
                    <div class="space-y-10">
                        <For each={categories}>
                            {(cat) => {
                                const colors = categoryColor(cat);
                                return (
                                    <FadeIn>
                                        <div>
                                            <div class={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${colors.text}`}>{cat}</div>
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <For each={apiActions.filter(a => a.category === cat)}>
                                                    {(action) => (
                                                        <button
                                                            onClick={() => setExpandedAction(expandedAction() === action.action ? null : action.action)}
                                                            class={`text-left bg-[#0a0a0f] border rounded-xl p-4 transition-all hover:border-white/15 ${expandedAction() === action.action ? 'border-white/15' : 'border-white/5'
                                                                }`}
                                                        >
                                                            <div class="flex items-center justify-between">
                                                                <div class="flex items-center gap-3">
                                                                    <code class={`text-xs font-mono font-bold ${colors.text}`}>{action.action}</code>
                                                                    <span class="text-sm text-gray-300 font-medium">{action.title}</span>
                                                                </div>
                                                                <div class="flex items-center gap-2">
                                                                    <Show when={action.rp}>
                                                                        <span class="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">+{action.rp} RP</span>
                                                                    </Show>
                                                                    <Show when={!action.auth}>
                                                                        <span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Public</span>
                                                                    </Show>
                                                                </div>
                                                            </div>
                                                            <Show when={expandedAction() === action.action}>
                                                                <p class="text-xs text-gray-500 mt-2 leading-relaxed">{action.description}</p>
                                                            </Show>
                                                        </button>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                    </FadeIn>
                                );
                            }}
                        </For>
                    </div>

                    <FadeIn>
                        <div class="mt-10 text-center">
                            <A href="/docs/agent-api" class="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white font-semibold text-sm rounded-full hover:bg-white/10 transition-all hover:scale-105">
                                <Icon name="book" class="w-4 h-4" /> Full API Reference with Code Examples
                                <Icon name="arrowRight" class="w-4 h-4" />
                            </A>
                        </div>
                    </FadeIn>
                </div>
            </div>

            {/* ═══════ NETWORK CONFIGURATION ═══════ */}
            <div class="border-t border-white/5">
                <div class="max-w-[1200px] mx-auto px-6 py-24">
                    <SectionHeader
                        centered={false}
                        label="Network Configuration"
                        title="Connect to Vision Chain."
                        description="Add Vision Chain to your wallet or dApp with these network details."
                    />

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Network Details */}
                        <FadeIn>
                            <div class="bg-[#0a0a0f] border border-white/5 rounded-2xl overflow-hidden">
                                <div class="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                                    <span class="text-xs font-black text-gray-400 uppercase tracking-widest">Network Details</span>
                                </div>
                                <div class="divide-y divide-white/[0.03]">
                                    {[
                                        { label: 'Network Name', value: NETWORK_CONFIG.chainName },
                                        { label: 'Chain ID', value: String(NETWORK_CONFIG.chainId) },
                                        { label: 'RPC URL', value: NETWORK_CONFIG.rpcUrl },
                                        { label: 'Currency Symbol', value: NETWORK_CONFIG.tokenSymbol },
                                        { label: 'Block Explorer', value: NETWORK_CONFIG.explorerUrl },
                                    ].map(row => (
                                        <div class="flex items-center justify-between px-6 py-3.5 group">
                                            <span class="text-xs text-gray-500 font-medium">{row.label}</span>
                                            <div class="flex items-center gap-2">
                                                <code class="text-xs text-gray-300 font-mono">{row.value}</code>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); copyCode(row.value, row.label); }}
                                                    class="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-white transition-all rounded"
                                                >
                                                    <Show when={copiedId() === row.label} fallback={<Icon name="copy" class="w-3 h-3" />}>
                                                        <span class="text-emerald-400"><Icon name="check" class="w-3 h-3" /></span>
                                                    </Show>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </FadeIn>

                        {/* Contract Addresses */}
                        <FadeIn delay={0.1}>
                            <div class="bg-[#0a0a0f] border border-white/5 rounded-2xl overflow-hidden">
                                <div class="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                                    <span class="text-xs font-black text-gray-400 uppercase tracking-widest">Contract Addresses</span>
                                </div>
                                <div class="divide-y divide-white/[0.03]">
                                    {[
                                        { label: 'VCN Token (ERC-20)', value: NETWORK_CONFIG.tokenAddress },
                                        { label: 'Paymaster', value: NETWORK_CONFIG.paymasterContract },
                                        { label: 'Staking Contract', value: NETWORK_CONFIG.stakingContract },
                                        { label: 'Agent Gateway', value: AGENT_API_BASE },
                                    ].map(row => (
                                        <div class="flex flex-col px-6 py-3.5 group">
                                            <span class="text-xs text-gray-500 font-medium mb-1">{row.label}</span>
                                            <div class="flex items-center gap-2">
                                                <code class="text-[11px] text-gray-300 font-mono truncate">{row.value}</code>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); copyCode(row.value, `contract-${row.label}`); }}
                                                    class="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-white transition-all rounded flex-shrink-0"
                                                >
                                                    <Show when={copiedId() === `contract-${row.label}`} fallback={<Icon name="copy" class="w-3 h-3" />}>
                                                        <span class="text-emerald-400"><Icon name="check" class="w-3 h-3" /></span>
                                                    </Show>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </FadeIn>
                    </div>
                </div>
            </div>

            {/* ═══════ RESOURCES & LINKS ═══════ */}
            <div class="border-t border-white/5">
                <div class="max-w-[1200px] mx-auto px-6 py-24">
                    <SectionHeader
                        centered={true}
                        label="Resources"
                        title="Everything You Need."
                    />

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { title: 'API Reference', desc: 'Full documentation for all 12 Agent Gateway actions with code examples.', href: '/docs/agent-api', icon: 'book' as const, color: '#22d3ee' },
                            { title: 'skill.md', desc: 'Machine-readable skill file for AI agent onboarding. Point your agent here.', href: '/skill.md', icon: 'sparkle' as const, color: '#a78bfa', external: true },
                            { title: 'Agent Dashboard', desc: 'Register agents, view profiles, track leaderboards in your browser.', href: '/agent', icon: 'robot' as const, color: '#f59e0b' },
                            { title: 'VisionScan', desc: 'Explore blocks, transactions, and addresses on Vision Chain.', href: '/visionscan', icon: 'globe' as const, color: '#34d399' },
                        ].map((resource, i) => (
                            <FadeIn delay={i * 0.1}>
                                <a
                                    href={resource.href}
                                    target={resource.external ? '_blank' : undefined}
                                    class="block bg-[#0a0a0f] border border-white/5 rounded-2xl p-6 hover:border-white/15 transition-all group hover:-translate-y-1"
                                >
                                    <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ color: resource.color }}>
                                        <Icon name={resource.icon} class="w-5 h-5" />
                                    </div>
                                    <h3 class="text-base font-bold text-white mb-1.5 group-hover:text-cyan-300 transition-colors">{resource.title}</h3>
                                    <p class="text-xs text-gray-500 leading-relaxed">{resource.desc}</p>
                                    <div class="mt-4 flex items-center gap-1.5 text-xs font-semibold text-gray-600 group-hover:text-white transition-colors">
                                        <span>{resource.external ? 'Open' : 'View'}</span>
                                        <Icon name="arrowRight" class="w-3 h-3" />
                                    </div>
                                </a>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══════ CTA ═══════ */}
            <div class="border-t border-white/5">
                <div class="max-w-[1200px] mx-auto px-6 py-20">
                    <FadeIn>
                        <div class="relative bg-gradient-to-br from-[#0c0c14] to-[#0a0a12] border border-white/5 rounded-3xl p-10 md:p-16 text-center overflow-hidden">
                            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/5 blur-[100px] rounded-full" />
                            <div class="relative z-10">
                                <h2 class="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
                                    Start Building <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Today</span>
                                </h2>
                                <p class="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                                    Zero gas fees. Instant wallet provisioning. One API endpoint for everything.
                                </p>
                                <div class="flex flex-wrap items-center justify-center gap-3">
                                    <a href="#quickstart" class="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-black font-bold text-sm rounded-full hover:bg-gray-100 transition-all hover:scale-105">
                                        <Icon name="terminal" class="w-4 h-4" /> Get Started
                                    </a>
                                    <A href="/agent" class="inline-flex items-center gap-2 px-7 py-3.5 bg-white/5 border border-white/10 text-white font-bold text-sm rounded-full hover:bg-white/10 transition-all hover:scale-105">
                                        <Icon name="robot" class="w-4 h-4" /> Agent Dashboard
                                    </A>
                                </div>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </div>
        </section>
    );
};

export default ApiHub;
