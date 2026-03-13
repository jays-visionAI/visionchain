import { createSignal, createMemo, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { A } from '@solidjs/router';

// ─── SVG Icons ───
const svg = {
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    chevDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    chevRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
};
const I = (p: { d: keyof typeof svg; c?: string }) => <span class={p.c ?? 'w-4 h-4 inline-block'} innerHTML={svg[p.d]} />;

// ─── Section Definitions ───
interface Section { id: string; title: string; icon: string; children: { id: string; title: string }[]; }

const sections: Section[] = [
    {
        id: 'getting-started', title: 'Getting Started', icon: '1',
        children: [
            { id: 'gs-overview', title: 'Overview' },
            { id: 'gs-signup', title: 'Account Creation & Login' },
            { id: 'gs-wallet', title: 'Wallet Setup' },
            { id: 'gs-navigation', title: 'Interface Overview' },
        ]
    },
    {
        id: 'ai-chat', title: 'AI Chat', icon: '2',
        children: [
            { id: 'chat-overview', title: 'Chat Interface' },
            { id: 'chat-quick', title: 'Quick Actions' },
            { id: 'chat-voice', title: 'Voice Input' },
            { id: 'chat-intent', title: 'AI Commands' },
            { id: 'chat-history', title: 'Chat History' },
            { id: 'chat-agent-desk', title: 'Agent Desk' },
            { id: 'chat-tips', title: 'Daily Tips' },
        ]
    },
    {
        id: 'assets', title: 'My Assets', icon: '3',
        children: [
            { id: 'assets-dashboard', title: 'Portfolio Dashboard' },
            { id: 'assets-tokens', title: 'Token List & Balances' },
            { id: 'assets-multichain', title: 'Multi-Chain Balances' },
            { id: 'assets-history', title: 'Transaction History' },
        ]
    },
    {
        id: 'send-receive', title: 'Send & Receive', icon: '4',
        children: [
            { id: 'send-basic', title: 'Sending Tokens' },
            { id: 'send-contact', title: 'Contact-based Transfer' },
            { id: 'send-scheduled', title: 'Scheduled Transfer' },
            { id: 'send-batch', title: 'Batch Transfer' },
            { id: 'receive-tokens', title: 'Receiving Tokens' },
        ]
    },
    {
        id: 'bridge', title: 'Cross-Chain Bridge', icon: '5',
        children: [
            { id: 'bridge-overview', title: 'Bridge Overview' },
            { id: 'bridge-forward', title: 'Vision to Ethereum' },
            { id: 'bridge-reverse', title: 'Ethereum to Vision' },
            { id: 'bridge-monitor', title: 'Transaction Monitoring' },
        ]
    },
    {
        id: 'staking', title: 'Staking & Earn', icon: '6',
        children: [
            { id: 'staking-overview', title: 'Staking Overview' },
            { id: 'staking-how', title: 'How to Stake' },
            { id: 'staking-rewards', title: 'Rewards & Unstaking' },
        ]
    },
    {
        id: 'agent', title: 'AI Agent', icon: '7',
        children: [
            { id: 'agent-overview', title: 'What is Agent Hosting?' },
            { id: 'agent-create', title: 'Creating an Agent' },
            { id: 'agent-actions', title: 'Action Types' },
            { id: 'agent-manage', title: 'Managing Agents' },
            { id: 'agent-logs', title: 'Logs & Monitoring' },
        ]
    },
    {
        id: 'insight', title: 'Vision Insight', icon: '8',
        children: [
            { id: 'insight-overview', title: 'Intelligence Dashboard' },
            { id: 'insight-news', title: 'AI News Feed' },
            { id: 'insight-signals', title: 'Trading Signals' },
        ]
    },
    {
        id: 'cex', title: 'CEX Portfolio', icon: '9',
        children: [
            { id: 'cex-connect', title: 'Connecting Exchanges' },
            { id: 'cex-exchanges', title: 'Supported Exchanges' },
            { id: 'cex-portfolio', title: 'Portfolio Overview' },
            { id: 'cex-quant', title: 'Quant Engine (BETA)' },
            { id: 'cex-security', title: 'Security & IP Whitelist' },
        ]
    },
    {
        id: 'disk', title: 'Vision Disk', icon: '10',
        children: [
            { id: 'disk-overview', title: 'Cloud Storage Overview' },
            { id: 'disk-upload', title: 'Upload & Download' },
            { id: 'disk-folders', title: 'Folder Management' },
            { id: 'disk-share', title: 'Sharing & Publishing' },
            { id: 'disk-encryption', title: 'Encryption & Passkey' },
            { id: 'disk-ai-memory', title: 'AI Memory & Indexing' },
            { id: 'disk-chatbot', title: 'AI Chat File Sharing' },
            { id: 'disk-plans', title: 'Storage Plans' },
        ]
    },
    {
        id: 'nodes', title: 'Nodes', icon: '11',
        children: [
            { id: 'nodes-overview', title: 'Vision Node Overview' },
            { id: 'nodes-purchase', title: 'Purchasing Nodes' },
            { id: 'nodes-install', title: 'Installation Guide' },
        ]
    },
    {
        id: 'mint', title: 'Token Minting', icon: '12',
        children: [
            { id: 'mint-overview', title: 'Mint Studio' },
            { id: 'mint-create', title: 'Creating a Token' },
        ]
    },
    {
        id: 'social', title: 'Social Features', icon: '13',
        children: [
            { id: 'contacts-manage', title: 'Contacts Management' },
            { id: 'referral-program', title: 'Referral Program' },
            { id: 'quest-campaign', title: 'Quests & Campaigns' },
        ]
    },
    {
        id: 'settings', title: 'Settings & Security', icon: '14',
        children: [
            { id: 'settings-profile', title: 'Profile Management' },
            { id: 'settings-2fa', title: '2FA Setup' },
            { id: 'settings-backup', title: 'Wallet Backup & Restore' },
            { id: 'settings-language', title: 'Language Settings' },
            { id: 'settings-notifications', title: 'Notification Settings' },
        ]
    },
    {
        id: 'faq', title: 'Troubleshooting', icon: '15',
        children: [
            { id: 'faq-login', title: 'Login Issues' },
            { id: 'faq-tx', title: 'Transaction Failures' },
            { id: 'faq-bridge', title: 'Bridge Issues' },
            { id: 'faq-contact', title: 'Contact Support' },
        ]
    },
    {
        id: 'feedback', title: 'Feedback & Reports', icon: '16',
        children: [
            { id: 'feedback-overview', title: 'Feedback System' },
            { id: 'feedback-bugs', title: 'Bug Reports' },
            { id: 'feedback-features', title: 'Feature Suggestions' },
            { id: 'feedback-business', title: 'Business Proposals' },
            { id: 'feedback-tips', title: 'Effective Feedback' },
        ]
    },
];

// ─── SVG Flow Diagrams ───

/** Reusable horizontal flow with labeled nodes and arrows */
const FlowDiagram = (p: { steps: { label: string; sub?: string; color?: string }[]; title?: string }) => {
    const nodeW = 120, nodeH = 52, gap = 36, arrowW = 24;
    const totalW = p.steps.length * (nodeW + gap) - gap + 40;
    const totalH = nodeH + 50;
    return (
        <div class="my-6 overflow-x-auto">
            <Show when={p.title}><div class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{p.title}</div></Show>
            <svg viewBox={`0 0 ${totalW} ${totalH}`} class="w-full max-h-24" style="min-width:480px">
                <For each={p.steps}>{(step, i) => {
                    const x = () => 20 + i() * (nodeW + gap);
                    const y = 12;
                    const col = step.color || '#22d3ee';
                    return (
                        <>
                            <rect x={x()} y={y} width={nodeW} height={nodeH} rx="12" fill="none" stroke={col} stroke-width="1.5" opacity="0.4" />
                            <rect x={x()} y={y} width={nodeW} height={nodeH} rx="12" fill={col} opacity="0.06" />
                            <text x={x() + nodeW / 2} y={y + (step.sub ? 20 : 26)} text-anchor="middle" fill="white" font-size="11" font-weight="700">{step.label}</text>
                            <Show when={step.sub}>
                                <text x={x() + nodeW / 2} y={y + 36} text-anchor="middle" fill="#94a3b8" font-size="9">{step.sub}</text>
                            </Show>
                            <Show when={i() < p.steps.length - 1}>
                                <line x1={x() + nodeW + 4} y1={y + nodeH / 2} x2={x() + nodeW + gap - 4} y2={y + nodeH / 2} stroke="#334155" stroke-width="1.5" />
                                <polygon points={`${x() + nodeW + gap - 4},${y + nodeH / 2} ${x() + nodeW + gap - 12},${y + nodeH / 2 - 4} ${x() + nodeW + gap - 12},${y + nodeH / 2 + 4}`} fill="#334155" />
                            </Show>
                            <text x={x() + nodeW / 2} y={totalH - 4} text-anchor="middle" fill="#475569" font-size="9" font-weight="700">{i() + 1}</text>
                        </>
                    );
                }}</For>
            </svg>
        </div>
    );
};

/** Interface layout SVG showing sidebar + main areas */
const LayoutDiagram = () => (
    <div class="my-6 overflow-x-auto">
        <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Desktop Layout</div>
        <svg viewBox="0 0 560 220" class="w-full" style="min-width:400px;max-height:220px">
            {/* Outer frame */}
            <rect x="10" y="10" width="540" height="200" rx="12" fill="none" stroke="#1e293b" stroke-width="1.5" />
            {/* Sidebar */}
            <rect x="10" y="10" width="120" height="200" rx="12" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
            <text x="70" y="36" text-anchor="middle" fill="#22d3ee" font-size="10" font-weight="800">SIDEBAR</text>
            {['Chat', 'Assets', 'Bridge', 'Earn', 'Agent', 'Disk', 'Settings'].map((item, i) => (
                <>
                    <rect x="22" y={50 + i * 22} width="96" height="16" rx="4" fill={i === 0 ? '#22d3ee' : 'transparent'} opacity={i === 0 ? 0.15 : 1} />
                    <text x="32" y={62 + i * 22} fill={i === 0 ? '#22d3ee' : '#64748b'} font-size="9" font-weight={i === 0 ? '700' : '400'}>{item}</text>
                </>
            ))}
            {/* Main Chat Area */}
            <rect x="140" y="10" width="410" height="150" rx="0" fill="#050508" />
            <text x="345" y="36" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="700">AI CHAT AREA</text>
            {/* Chat bubbles */}
            <rect x="160" y="50" width="160" height="24" rx="8" fill="#1e293b" />
            <text x="170" y="66" fill="#94a3b8" font-size="9">Send 100 VCN to John</text>
            <rect x="340" y="50" width="190" height="36" rx="8" fill="#0e3a4a" />
            <text x="350" y="66" fill="#22d3ee" font-size="9">Preparing send flow...</text>
            <text x="350" y="80" fill="#64748b" font-size="8">Token: VCN | Amount: 100</text>
            {/* Agent Desk */}
            <rect x="140" y="160" width="410" height="20" rx="0" fill="#0c0c16" stroke="#1e293b" stroke-width="0.5" />
            <text x="160" y="174" fill="#475569" font-size="8" font-weight="700">AGENT DESK</text>
            <rect x="230" y="164" width="60" height="12" rx="6" fill="#059669" opacity="0.15" />
            <text x="245" y="173" fill="#34d399" font-size="7">Running</text>
            {/* Input bar */}
            <rect x="140" y="180" width="410" height="30" rx="0" fill="#0a0a12" stroke="#1e293b" stroke-width="0.5" />
            <rect x="155" y="186" width="320" height="18" rx="8" fill="#1e293b" />
            <text x="170" y="198" fill="#475569" font-size="9">Type a message...</text>
            <circle cx="510" cy="195" r="8" fill="#22d3ee" opacity="0.15" />
            <text x="510" y="199" text-anchor="middle" fill="#22d3ee" font-size="10">M</text>
        </svg>
    </div>
);

/** Bridge bidirectional flow */
const BridgeDiagram = () => (
    <div class="my-6 overflow-x-auto">
        <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Bridge Architecture</div>
        <svg viewBox="0 0 520 120" class="w-full" style="min-width:400px;max-height:120px">
            {/* Vision Chain */}
            <rect x="10" y="25" width="130" height="70" rx="14" fill="#0e3a4a" stroke="#22d3ee" stroke-width="1.5" opacity="0.8" />
            <text x="75" y="52" text-anchor="middle" fill="#22d3ee" font-size="12" font-weight="800">Vision Chain</text>
            <text x="75" y="72" text-anchor="middle" fill="#64748b" font-size="9">Lock / Unlock VCN</text>
            {/* Arrows */}
            <line x1="148" y1="50" x2="204" y2="50" stroke="#334155" stroke-width="1.5" />
            <polygon points="204,50 196,46 196,54" fill="#334155" />
            <line x1="316" y1="70" x2="148" y2="70" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 3" />
            <polygon points="148,70 156,66 156,74" fill="#334155" />
            {/* TSS Validator */}
            <rect x="208" y="15" width="100" height="90" rx="14" fill="#1a0a2e" stroke="#a78bfa" stroke-width="1.5" opacity="0.8" />
            <text x="258" y="42" text-anchor="middle" fill="#a78bfa" font-size="10" font-weight="800">TSS</text>
            <text x="258" y="56" text-anchor="middle" fill="#a78bfa" font-size="10" font-weight="800">Validator</text>
            <text x="258" y="78" text-anchor="middle" fill="#64748b" font-size="8">Multi-sig</text>
            <text x="258" y="90" text-anchor="middle" fill="#64748b" font-size="8">Verification</text>
            {/* Arrows */}
            <line x1="316" y1="50" x2="372" y2="50" stroke="#334155" stroke-width="1.5" />
            <polygon points="372,50 364,46 364,54" fill="#334155" />
            {/* Ethereum */}
            <rect x="380" y="25" width="130" height="70" rx="14" fill="#1a1a2e" stroke="#818cf8" stroke-width="1.5" opacity="0.8" />
            <text x="445" y="52" text-anchor="middle" fill="#818cf8" font-size="12" font-weight="800">Ethereum</text>
            <text x="445" y="72" text-anchor="middle" fill="#64748b" font-size="9">Mint / Burn wVCN</text>
        </svg>
    </div>
);

/** Staking lifecycle diagram */
const StakingDiagram = () => (
    <div class="my-6 overflow-x-auto">
        <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Staking Lifecycle</div>
        <svg viewBox="0 0 600 110" class="w-full" style="min-width:500px;max-height:110px">
            {[
                { x: 10, label: 'Available', sub: 'VCN in wallet', col: '#22d3ee' },
                { x: 130, label: 'Staked', sub: 'Earning rewards', col: '#f59e0b' },
                { x: 250, label: 'Unstaking', sub: '7-day cooldown', col: '#ef4444' },
                { x: 370, label: 'Withdrawable', sub: 'Ready to claim', col: '#10b981' },
                { x: 490, label: 'Available', sub: 'Back in wallet', col: '#22d3ee' },
            ].map((n, i) => (
                <>
                    <rect x={n.x} y="15" width="110" height="54" rx="12" fill="none" stroke={n.col} stroke-width="1.5" opacity="0.5" />
                    <rect x={n.x} y="15" width="110" height="54" rx="12" fill={n.col} opacity="0.06" />
                    <text x={n.x + 55} y="38" text-anchor="middle" fill="white" font-size="11" font-weight="700">{n.label}</text>
                    <text x={n.x + 55} y="54" text-anchor="middle" fill="#94a3b8" font-size="8">{n.sub}</text>
                    {i < 4 && (
                        <>
                            <line x1={n.x + 114} y1="42" x2={n.x + 126} y2="42" stroke="#334155" stroke-width="1.5" />
                            <polygon points={`${n.x + 126},42 ${n.x + 120},38 ${n.x + 120},46`} fill="#334155" />
                        </>
                    )}
                </>
            ))}
            {/* Labels under arrows */}
            {['Stake', 'Request', 'Wait 7d', 'Withdraw'].map((label, i) => (
                <text x={130 * i + 120} y="92" text-anchor="middle" fill="#475569" font-size="8" font-weight="600">{label}</text>
            ))}
            {/* Reward arrow loop */}
            <path d="M185,15 L185,5 Q185,0 195,0 L245,0 Q255,0 255,5 L255,15" fill="none" stroke="#f59e0b" stroke-width="1" opacity="0.5" stroke-dasharray="3 2" />
            <text x="222" y="8" text-anchor="middle" fill="#f59e0b" font-size="7" opacity="0.7">Claim Rewards</text>
        </svg>
    </div>
);

/** Feedback pipeline diagram */
const FeedbackDiagram = () => (
    <FlowDiagram
        title="VPIS Feedback Pipeline"
        steps={[
            { label: 'Detect', sub: 'AI auto-scan', color: '#22d3ee' },
            { label: 'Classify', sub: 'Bug / Feature / Biz', color: '#a78bfa' },
            { label: 'Group', sub: 'Cluster similar', color: '#f59e0b' },
            { label: 'Prioritize', sub: 'Score & rank', color: '#f97316' },
            { label: 'Review', sub: 'Team action', color: '#10b981' },
        ]}
    />
);

// ─── Content Renderer ───
// Content pages are defined as functions returning JSX

// Helper Components
const Tip = (p: { children: JSX.Element }) => (
    <div class="bg-cyan-500/5 border border-cyan-500/15 rounded-xl p-5 my-4">
        <h4 class="text-xs font-black uppercase tracking-widest text-cyan-400 mb-2">TIP</h4>
        <div class="text-sm text-gray-400">{p.children}</div>
    </div>
);
const Warning = (p: { children: JSX.Element }) => (
    <div class="bg-red-500/5 border border-red-500/15 rounded-xl p-5 my-4">
        <h4 class="text-xs font-black uppercase tracking-widest text-red-400 mb-2">WARNING</h4>
        <div class="text-sm text-gray-400">{p.children}</div>
    </div>
);
const Note = (p: { children: JSX.Element }) => (
    <div class="bg-amber-500/5 border border-amber-500/15 rounded-xl p-5 my-4">
        <h4 class="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">NOTE</h4>
        <div class="text-sm text-gray-400">{p.children}</div>
    </div>
);
const StepList = (p: { steps: { title: string; desc: string }[] }) => (
    <div class="space-y-3 my-4">
        <For each={p.steps}>{(step, i) => (
            <div class="flex gap-4 items-start bg-[#0a0a12] border border-white/5 rounded-xl p-4">
                <div class="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-sm font-black flex-shrink-0">{i() + 1}</div>
                <div><div class="text-sm font-bold text-white">{step.title}</div><div class="text-xs text-gray-400 mt-0.5">{step.desc}</div></div>
            </div>
        )}</For>
    </div>
);
const Prerequisites = (p: { items: string[] }) => (
    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5 my-4">
        <h4 class="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">PREREQUISITES</h4>
        <ul class="space-y-1.5 text-sm text-gray-400">
            <For each={p.items}>{(item) => <li class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0" />{item}</li>}</For>
        </ul>
    </div>
);
const SectionHeader = (p: { title: string; desc: string }) => (
    <div class="mb-6">
        <h2 class="text-3xl font-black tracking-tight mb-3">{p.title}</h2>
        <p class="text-gray-400 leading-relaxed max-w-2xl">{p.desc}</p>
    </div>
);

// ─── Content Pages ───
function getContent(id: string, onNavigate?: (id: string) => void): JSX.Element {
    switch (id) {
        // ─── Getting Started ───
        case 'gs-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Welcome to Vision Chain" desc="Vision Chain is an AI-powered blockchain ecosystem. This manual will guide you through every feature of the Vision Chain Wallet." />
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { n: 'AI Chat', d: 'Talk to Vision AI for transactions, questions, and blockchain operations' },
                        { n: 'Multi-Chain', d: 'Manage assets across Vision Chain, Ethereum, Polygon, and Base' },
                        { n: 'Gasless', d: 'All transactions are gasless through the Vision Paymaster system' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.n}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
                <div>
                    <h3 class="text-lg font-bold text-white mb-4">Quick Navigation</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { t: 'New User?', d: 'Start with Account Creation & Login', s: 'gs-signup' },
                            { t: 'Have an Account?', d: 'Learn about the AI Chat interface', s: 'chat-overview' },
                            { t: 'Want to Send?', d: 'Go to Send & Receive guide', s: 'send-basic' },
                            { t: 'Need Security?', d: 'Check Settings & 2FA setup', s: 'settings-2fa' },
                        ].map(n => (
                            <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-4 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => onNavigate?.(n.s)}>
                                <div class="text-sm font-bold text-cyan-400">{n.t}</div>
                                <div class="text-xs text-gray-500 mt-0.5">{n.d}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
        case 'gs-signup': return (
            <div class="space-y-6">
                <SectionHeader title="Account Creation & Login" desc="Create your Vision Chain account to access the wallet and all features." />
                <StepList steps={[
                    { title: 'Visit visionchain.co', desc: 'Navigate to the main website and click "Launch App" or go directly to visionchain.co/wallet.' },
                    { title: 'Click Sign Up', desc: 'On the login page, tap "Sign Up" to create a new account.' },
                    { title: 'Enter Your Details', desc: 'Provide your email, username, and a strong password. Optionally enter a referral code if invited by a friend.' },
                    { title: 'Verify Email', desc: 'Check your inbox for a verification email and click the activation link.' },
                    { title: 'Login', desc: 'Return to the login page and sign in with your credentials. You will be directed to the AI Chat screen.' },
                ]} />
                <Tip><>If you have a referral code from a friend, enter it during signup to receive bonus VCN tokens. Both you and your referrer will earn rewards.</></Tip>
            </div>
        );
        case 'gs-wallet': return (
            <div class="space-y-6">
                <SectionHeader title="Wallet Setup" desc="Your blockchain wallet is automatically created upon first login. A seed phrase is generated for backup and recovery." />
                <StepList steps={[
                    { title: 'Auto-Generation', desc: 'Upon first login, a wallet is automatically generated with a unique address. No manual setup required.' },
                    { title: 'Seed Phrase Backup', desc: 'Navigate to Settings > Wallet Backup. Write down your 12-word seed phrase and store it securely offline.' },
                    { title: 'Set Wallet Password', desc: 'Create a separate wallet password for transaction signing. This is different from your login password.' },
                    { title: 'Cloud Sync (Optional)', desc: 'Enable Cloud Sync in Settings to backup your encrypted wallet to Vision Cloud for recovery across devices.' },
                ]} />
                <Warning><>Your seed phrase is the only way to recover your wallet if you lose access. Never share it with anyone. Vision Chain support will never ask for your seed phrase.</></Warning>
            </div>
        );
        case 'gs-navigation': return (
            <div class="space-y-6">
                <SectionHeader title="Interface Overview" desc="Learn how to navigate the Vision Chain wallet across desktop and mobile." />
                <LayoutDiagram />
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Mobile Navigation</h3>
                    <div class="space-y-2">
                        {[
                            { label: 'Hamburger Menu', desc: 'Tap the menu icon at top-left to open the sidebar with all features' },
                            { label: 'Chat History', desc: 'Tap the clock icon at top-right to view and switch between AI chat sessions' },
                            { label: 'Bottom Input', desc: 'The chat input area at the bottom expands when tapped. Supports text and voice input' },
                            { label: 'Agent Desk', desc: 'Shows active AI agents and background tasks above the input area' },
                        ].map(item => (
                            <div class="flex gap-3 items-start bg-[#0a0a12] border border-white/5 rounded-xl p-4">
                                <div class="text-xs font-bold text-cyan-400 w-28 flex-shrink-0">{item.label}</div>
                                <div class="text-xs text-gray-400">{item.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Desktop Navigation</h3>
                    <p class="text-sm text-gray-400">On desktop, a full sidebar is always visible on the left with all feature categories. The chat input area is fixed at the bottom of the main content area with an expanded Agent Desk panel above it.</p>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Sidebar Menu Items</h3>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                        {[
                            { n: 'Chat', d: 'AI-powered assistant for all operations' },
                            { n: 'My Assets', d: 'View portfolio, balances, and token list' },
                            { n: 'CEX Portfolio', d: 'Connected exchange portfolios' },
                            { n: 'Bridge', d: 'Cross-chain asset transfer' },
                            { n: 'Earn', d: 'Staking and reward programs' },
                            { n: 'Agent', d: 'AI agent hosting and automation' },
                            { n: 'Vision Insight', d: 'Market intelligence and AI analysis' },
                            { n: 'Disk', d: 'Encrypted cloud storage' },
                            { n: 'Nodes', d: 'Vision Node management' },
                            { n: 'Referral', d: 'Invite friends and earn rewards' },
                            { n: 'Mint', d: 'Create custom tokens' },
                            { n: 'Contacts', d: 'Manage your contacts' },
                            { n: 'Settings', d: 'Account and security settings' },
                        ].map(item => (
                            <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                                <span class="text-sm font-medium text-white">{item.n}</span>
                                <span class="text-xs text-gray-500">{item.d}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );

        // ─── AI Chat ───
        case 'chat-overview': return (
            <div class="space-y-6">
                <SectionHeader title="AI Chat Interface" desc="Vision AI is your intelligent assistant for all blockchain operations. Simply type or speak to send tokens, check balances, or get answers." />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'Natural Language', d: 'Type commands like "Send 100 VCN to John" and the AI will handle the transaction flow' },
                        { t: 'Multi-Language', d: 'Supports Korean and English with automatic language detection' },
                        { t: 'Context Aware', d: 'The AI remembers conversation context and can reference previous actions' },
                        { t: 'Smart Suggestions', d: 'Quick action buttons appear on the welcome screen for common operations' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
                <Tip><>The AI Chat is the default landing screen after login. You can access all wallet features through natural language commands without navigating menus.</></Tip>
            </div>
        );
        case 'chat-quick': return (
            <div class="space-y-6">
                <SectionHeader title="Quick Actions" desc="Pre-defined action buttons on the welcome screen for instant access to common features." />
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Learn about Vision Chain', d: 'Get an overview of the Vision Chain ecosystem', t: 'chat' },
                        { n: 'Receive VCN Gift', d: 'Request an airdrop of VCN tokens', t: 'chat' },
                        { n: 'Invite Friends', d: 'Get your referral link and invite others', t: 'chat' },
                        { n: 'Send VCN', d: 'Opens the Send flow directly', t: 'flow' },
                    ].map(a => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <div><span class="text-sm text-white font-medium">{a.n}</span><span class="text-xs text-gray-500 ml-2">{a.d}</span></div>
                            <span class={`text-[9px] font-bold px-2 py-0.5 rounded ${a.t === 'flow' ? 'text-blue-400 bg-blue-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>{a.t === 'flow' ? 'Direct Flow' : 'AI Chat'}</span>
                        </div>
                    ))}
                </div>
                <Note><>Quick Actions are configurable by administrators. The buttons shown may vary based on active campaigns and promotions.</></Note>
            </div>
        );
        case 'chat-voice': return (
            <div class="space-y-6">
                <SectionHeader title="Voice Input" desc="Use your voice to interact with Vision AI. Supports Korean and English with real-time transcription." />
                <StepList steps={[
                    { title: 'Tap the Microphone', desc: 'In the chat input area, tap the microphone icon to start recording.' },
                    { title: 'Speak Clearly', desc: 'Speak your command in Korean or English. The AI will automatically detect the language.' },
                    { title: 'Review & Send', desc: 'The transcribed text appears in the input field. Review and tap send, or edit before sending.' },
                ]} />
                <Tip><>Voice input supports phonetic matching for contact names. You can say "Send 100 VCN to Sangkyun" and the AI will find the closest matching contact even with Korean pronunciation variations.</></Tip>
            </div>
        );
        case 'chat-intent': return (
            <div class="space-y-6">
                <SectionHeader title="AI Intent Commands" desc="The AI understands natural language intents and can execute complex blockchain operations." />
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-[1.5fr_2fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                        <div>Command Example</div><div>Action</div>
                    </div>
                    {[
                        { cmd: '"Send 100 VCN to John"', act: 'Opens send flow with pre-filled recipient and amount' },
                        { cmd: '"What is my balance?"', act: 'Shows your current VCN and ETH balances' },
                        { cmd: '"Bridge 50 VCN to Ethereum"', act: 'Initiates a cross-chain bridge transaction' },
                        { cmd: '"Stake 200 VCN"', act: 'Navigates to staking with pre-filled amount' },
                        { cmd: '"Show my transaction history"', act: 'Displays recent transactions' },
                        { cmd: '"How do I invite friends?"', act: 'Explains the referral program' },
                        { cmd: '"Navigate to settings"', act: 'Opens the Settings page' },
                    ].map(r => (
                        <div class="grid grid-cols-[1.5fr_2fr] gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                            <code class="text-cyan-400 text-xs">{r.cmd}</code>
                            <span class="text-gray-400 text-xs">{r.act}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'chat-history': return (
            <div class="space-y-6">
                <SectionHeader title="Chat History & Sessions" desc="Access previous conversations and switch between chat sessions." />
                <StepList steps={[
                    { title: 'Open Chat History', desc: 'On mobile, tap the clock icon at top-right. On desktop, the history panel is in the sidebar.' },
                    { title: 'Browse Sessions', desc: 'View all previous chat sessions sorted by date. Each session shows the first message as a title.' },
                    { title: 'Switch Sessions', desc: 'Tap any session to load that conversation. Your current session is auto-saved.' },
                    { title: 'New Conversation', desc: 'Tap "New Chat" to start a fresh conversation. Previous sessions remain accessible.' },
                ]} />
            </div>
        );
        case 'chat-agent-desk': return (
            <div class="space-y-6">
                <SectionHeader title="Agent Desk" desc="Monitor background AI agents and batch operations from the Agent Desk panel above the chat input." />
                <p class="text-sm text-gray-400">The Agent Desk shows all currently active AI agents, pending transactions, and background tasks. Each agent chip displays its status, progress, and allows you to view details or dismiss completed tasks.</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { s: 'Running', d: 'Agent is actively executing actions', c: 'text-emerald-400 bg-emerald-500/10' },
                        { s: 'Pending', d: 'Waiting for user approval or blockchain confirmation', c: 'text-amber-400 bg-amber-500/10' },
                        { s: 'Completed', d: 'Task finished successfully, can be dismissed', c: 'text-blue-400 bg-blue-500/10' },
                        { s: 'Error', d: 'Task failed, tap to see details', c: 'text-red-400 bg-red-500/10' },
                    ].map(s => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class={`text-[10px] font-bold px-2 py-1 rounded ${s.c}`}>{s.s}</span>
                            <span class="text-xs text-gray-400">{s.d}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'chat-tips': return (
            <div class="space-y-6">
                <SectionHeader title="Daily Tips" desc="The 'Did You Know?' card on the welcome screen shows daily tips and insights about Vision Chain features." />
                <p class="text-sm text-gray-400">A rotating tip card appears at the top of the welcome screen. Navigate through tips using the arrow buttons. Tap "GO" to jump to the relevant feature mentioned in the tip.</p>
                <Tip><>Daily tips are updated regularly by administrators. They cover new features, best practices, and ecosystem news.</></Tip>
            </div>
        );

        // ─── Send & Receive ───
        case 'send-basic': return (
            <div class="space-y-6">
                <SectionHeader title="Sending Tokens" desc="Send VCN, ETH, or other supported tokens to any wallet address or contact." />
                <FlowDiagram title="Send Flow" steps={[
                    { label: 'Select Token', sub: 'VCN or ETH' },
                    { label: 'Recipient', sub: 'Address or contact' },
                    { label: 'Amount', sub: 'Enter value' },
                    { label: 'Review', sub: 'Check details' },
                    { label: 'Sign', sub: 'Wallet password', color: '#10b981' },
                ]} />
                <Prerequisites items={['Wallet setup complete', 'Sufficient token balance for the transfer', 'Recipient wallet address or saved contact']} />
                <StepList steps={[
                    { title: 'Start Send Flow', desc: 'Tap "Send" from the Assets page, use the quick action button, or type "Send" in the AI Chat.' },
                    { title: 'Select Token', desc: 'Choose the token you want to send (VCN or ETH).' },
                    { title: 'Choose Recipient', desc: 'Select a contact from your list, or enter a wallet address manually.' },
                    { title: 'Enter Amount', desc: 'Type the amount to send. The USD equivalent is shown in real-time.' },
                    { title: 'Review & Confirm', desc: 'Review the transaction details including recipient, amount, and estimated gas.' },
                    { title: 'Enter Wallet Password', desc: 'Enter your wallet password to sign and submit the transaction.' },
                ]} />
                <Warning><>Always double-check the recipient address before confirming. Blockchain transactions are irreversible and cannot be refunded.</></Warning>
                <Tip><>You can also say "Send 100 VCN to John" in the AI Chat. The AI will find the matching contact and pre-fill the transaction details for you.</></Tip>
            </div>
        );
        case 'send-contact': return (
            <div class="space-y-6">
                <SectionHeader title="Contact-based Transfer" desc="Send tokens to saved contacts by name instead of entering wallet addresses manually." />
                <p class="text-sm text-gray-400">When you start a send flow, your saved contacts appear for quick selection. You can search by name, and the AI Chat also supports phonetic name matching for voice commands.</p>
                <StepList steps={[
                    { title: 'Open Send Flow', desc: 'Start a send transaction using any method (button, chat, or quick action).' },
                    { title: 'Search Contact', desc: 'Type a name in the recipient field to filter your contacts.' },
                    { title: 'Select Contact', desc: 'Tap the contact to auto-fill their wallet address.' },
                    { title: 'Continue', desc: 'Enter the amount and complete the transaction as normal.' },
                ]} />
            </div>
        );
        case 'send-scheduled': return (
            <div class="space-y-6">
                <SectionHeader title="Scheduled Transfer (TimeLock)" desc="Schedule transfers for future execution using the TimeLock Agent." />
                <p class="text-sm text-gray-400">The TimeLock Agent allows you to schedule token transfers that execute automatically after a specified delay. This is useful for recurring payments, vesting schedules, or delayed transactions.</p>
                <Note><>Scheduled transfers require sufficient balance at the time of execution, not at the time of scheduling.</></Note>
            </div>
        );
        case 'send-batch': return (
            <div class="space-y-6">
                <SectionHeader title="Batch Transfer" desc="Send tokens to multiple recipients at once. Ideal for payroll, airdrops, or community distributions." />
                <StepList steps={[
                    { title: 'Select Multiple Recipients', desc: 'In the send flow, tap "Multi-send" to enable batch mode. Select contacts or enter multiple addresses.' },
                    { title: 'Set Amounts', desc: 'Enter individual amounts for each recipient, or set a uniform amount for all.' },
                    { title: 'Review Batch', desc: 'A summary shows all recipients and amounts. Review carefully before confirming.' },
                    { title: 'Execute', desc: 'Confirm and sign the batch transaction. Each transfer is executed sequentially.' },
                ]} />
            </div>
        );
        case 'receive-tokens': return (
            <div class="space-y-6">
                <SectionHeader title="Receiving Tokens" desc="Share your wallet address or QR code to receive tokens from others." />
                <StepList steps={[
                    { title: 'Go to Receive', desc: 'Navigate to Assets > Receive, or say "How do I receive tokens?" in the AI Chat.' },
                    { title: 'Copy Address', desc: 'Tap the copy button to copy your wallet address to the clipboard.' },
                    { title: 'Share QR Code', desc: 'Show the QR code to the sender. They can scan it with any compatible wallet.' },
                ]} />
                <Tip><>Your wallet address is the same across all supported networks on Vision Chain. For receiving on other chains (Ethereum, Polygon), use the same address.</></Tip>
            </div>
        );

        // ─── Assets ───
        case 'assets-dashboard': return (
            <div class="space-y-6">
                <SectionHeader title="Portfolio Dashboard" desc="View your complete portfolio at a glance, including total value, token breakdown, and recent activity." />
                <p class="text-sm text-gray-400">The Portfolio Dashboard is your central hub for monitoring all on-chain assets. It displays your total portfolio value in USD, individual token balances, and a visual breakdown of your holdings.</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Total Value', d: 'Combined USD value of all tokens across all chains' },
                        { n: 'Token List', d: 'Individual balances for VCN, ETH, and other tokens with real-time prices' },
                        { n: 'Price Change', d: '24-hour percentage change for each token displayed in green/red' },
                        { n: 'Quick Actions', d: 'Send, Receive, and Bridge buttons for instant access' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-500">{item.d}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'assets-tokens': return (
            <div class="space-y-6">
                <SectionHeader title="Token List & Balances" desc="Detailed view of all tokens in your wallet with real-time pricing." />
                <p class="text-sm text-gray-400">Your wallet automatically detects and displays all ERC-20 tokens held in your address. The primary tokens are VCN (Vision Chain native token) and ETH (for gas on Ethereum-compatible chains).</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-3 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Token</div><div>Description</div><div>Usage</div></div>
                    {[
                        { t: 'VCN', d: 'Vision Chain native token', u: 'Transactions, staking, governance' },
                        { t: 'ETH', d: 'Ethereum / gas token', u: 'Gas fees on Ethereum/Sepolia' },
                        { t: 'MATIC', d: 'Polygon network token', u: 'Cross-chain operations' },
                    ].map(r => (
                        <div class="grid grid-cols-3 gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                            <span class="text-white font-medium">{r.t}</span>
                            <span class="text-gray-400 text-xs">{r.d}</span>
                            <span class="text-gray-500 text-xs">{r.u}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'assets-multichain': return (
            <div class="space-y-6">
                <SectionHeader title="Multi-Chain Balances" desc="View and manage assets across Vision Chain, Ethereum Sepolia, Polygon, and Base networks." />
                <p class="text-sm text-gray-400">Vision Chain Wallet supports multiple blockchain networks. Your wallet address works across all supported chains, and you can switch between them to view balances on each network.</p>
                <Tip><>Use the Cross-Chain Bridge to move tokens between Vision Chain and Ethereum. Your wallet address remains the same across all networks.</></Tip>
            </div>
        );
        case 'assets-history': return (
            <div class="space-y-6">
                <SectionHeader title="Transaction History" desc="View all past transactions including sends, receives, bridge transfers, and staking operations." />
                <p class="text-sm text-gray-400">The transaction history shows a chronological list of all on-chain activity associated with your wallet. Each entry displays the transaction type, amount, counterparty, timestamp, and confirmation status.</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { s: 'Confirmed', d: 'Transaction finalized on-chain', c: 'text-emerald-400 bg-emerald-500/10' },
                        { s: 'Pending', d: 'Awaiting blockchain confirmation', c: 'text-amber-400 bg-amber-500/10' },
                        { s: 'Failed', d: 'Transaction reverted or rejected', c: 'text-red-400 bg-red-500/10' },
                    ].map(s => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class={`text-[10px] font-bold px-2 py-1 rounded ${s.c}`}>{s.s}</span>
                            <span class="text-xs text-gray-400">{s.d}</span>
                        </div>
                    ))}
                </div>
            </div>
        );

        // ─── Bridge ───
        case 'bridge-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Cross-Chain Bridge Overview" desc="Transfer tokens between Vision Chain and Ethereum securely using the Vision Bridge." />
                <BridgeDiagram />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'Bi-directional', d: 'Transfer VCN between Vision Chain and Ethereum Sepolia in both directions' },
                        { t: 'Secure', d: 'Multi-signature TSS (Threshold Signature Scheme) validation for all bridge transactions' },
                        { t: 'Low Cost', d: 'Gasless on Vision Chain side. Only Ethereum gas fees apply for outbound transfers' },
                        { t: 'Fast', d: 'Bridge transfers typically complete within 2-5 minutes after blockchain confirmations' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
                <Warning><>Bridge transactions are cross-chain and may take several minutes. Do not close the app while a bridge transfer is in progress.</></Warning>
            </div>
        );
        case 'bridge-forward': return (
            <div class="space-y-6">
                <SectionHeader title="Vision to Ethereum" desc="Bridge VCN tokens from Vision Chain to Ethereum Sepolia." />
                <Prerequisites items={['VCN balance on Vision Chain', 'Connected to Vision Chain network']} />
                <StepList steps={[
                    { title: 'Open Bridge', desc: 'Navigate to Bridge from the sidebar menu or say "Bridge" in the AI Chat.' },
                    { title: 'Select Direction', desc: 'Choose "Vision Chain -> Ethereum" as the bridge direction.' },
                    { title: 'Enter Amount', desc: 'Specify the amount of VCN to bridge. Minimum and maximum limits are shown.' },
                    { title: 'Review & Confirm', desc: 'Review the bridge fee, estimated time, and destination. Confirm the transaction.' },
                    { title: 'Wait for Confirmation', desc: 'The bridge processes in stages: lock on Vision Chain, validate via TSS, mint on Ethereum.' },
                ]} />
            </div>
        );
        case 'bridge-reverse': return (
            <div class="space-y-6">
                <SectionHeader title="Ethereum to Vision" desc="Bridge tokens from Ethereum back to Vision Chain." />
                <Prerequisites items={['VCN balance on Ethereum Sepolia', 'ETH for gas fees on Ethereum']} />
                <StepList steps={[
                    { title: 'Open Bridge', desc: 'Navigate to Bridge and select "Ethereum -> Vision Chain".' },
                    { title: 'Enter Amount', desc: 'Specify the amount to bridge back to Vision Chain.' },
                    { title: 'Approve Token', desc: 'Approve the bridge contract to spend your tokens (first time only).' },
                    { title: 'Confirm Bridge', desc: 'Sign the transaction. ETH gas fee applies on the Ethereum side.' },
                    { title: 'Wait for Completion', desc: 'Tokens are burned on Ethereum and unlocked on Vision Chain after TSS validation.' },
                ]} />
            </div>
        );
        case 'bridge-monitor': return (
            <div class="space-y-6">
                <SectionHeader title="Bridge Transaction Monitoring" desc="Track the status of your bridge transfers in real-time." />
                <p class="text-sm text-gray-400">All bridge transactions are tracked with a multi-stage progress indicator. You can view the status of each stage: submission, confirmation, TSS validation, and completion.</p>
                <Note><>Bridge transactions are processed automatically. If a bridge transfer appears stuck for more than 30 minutes, contact support with your transaction hash.</></Note>
            </div>
        );

        // ─── Staking ───
        case 'staking-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Staking Overview" desc="Stake VCN tokens as a Bridge Validator to earn rewards from bridge fees and subsidy pools. All staking transactions are gasless." />
                <StakingDiagram />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'Annual APY 12-20%', d: 'Rewards are dynamically calculated based on total network stake, bridge volume, and subsidy pool balance. The actual APY is displayed in real-time on the staking page.' },
                        { t: 'Dual Reward Source', d: 'Validators earn from two pools: (1) Bridge Fee Pool - 1% of every bridge transaction, and (2) Subsidy Pool - additional VCN rewards distributed over time.' },
                        { t: 'Gasless Staking', d: 'All staking operations use the Vision Paymaster system and EIP-2612 Permit signatures. You never pay gas fees - only a 1 VCN service fee per stake transaction.' },
                        { t: '50% Slashing Risk', d: 'Validators who submit invalid bridge proofs may lose 50% of their staked amount. This protects the integrity of cross-chain transactions.' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
                <h3 class="text-lg font-bold text-white mt-6 mb-3">Dashboard Stats</h3>
                <p class="text-sm text-gray-400 mb-3">When you open the Staking page, a stats bar at the top shows the following network-wide information:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Total Staked', d: 'The total amount of VCN staked across all validators network-wide' },
                        { n: 'Active Validators', d: 'Number of validators currently running and validating bridge transactions (shown with a green pulse indicator)' },
                        { n: 'Minimum Stake', d: 'The minimum amount required to become a validator: 100 VCN' },
                        { n: 'Cooldown Period', d: 'Number of days your tokens are locked after requesting unstake: 7 days' },
                        { n: 'Slash Rate', d: 'Percentage of stake that can be slashed for invalid proofs: 50% (shown in red)' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[60%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>
                <h3 class="text-lg font-bold text-white mt-6 mb-3">Your Staking Balance Panel</h3>
                <p class="text-sm text-gray-400 mb-3">Below the stats bar, your personal staking information is displayed in an amber-highlighted panel:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Your VCN Balance', d: 'Available VCN in your wallet that can be staked' },
                        { n: 'Your Staked Amount', d: 'VCN currently locked in the staking contract (shown in amber)' },
                        { n: 'Pending Unstake', d: 'If you have requested an unstake, shows amount and time remaining (e.g., "3d 12h remaining")' },
                        { n: 'Pending Rewards', d: 'Unclaimed VCN rewards with current APY percentage. A green "Claim" button appears next to the amount' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[60%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'staking-how': return (
            <div class="space-y-6">
                <SectionHeader title="How to Stake VCN" desc="Detailed step-by-step guide to staking VCN as a Bridge Validator." />
                <Prerequisites items={['Minimum 100 VCN in your wallet (plus 1 VCN service fee)', 'Wallet password set up (used to sign the EIP-712 Permit)', 'Logged in to Vision Chain wallet']} />
                <StepList steps={[
                    { title: 'Open the Staking Page', desc: 'From the sidebar menu, tap "Earn" to navigate to the Validator Staking page. The page displays network stats, your balance, and the staking form.' },
                    { title: 'Check the "Stake" Tab', desc: 'The staking form has three tabs: Stake, Unstake, and Withdraw. Make sure you are on the "Stake" tab (highlighted in amber). If not, tap it to switch.' },
                    { title: 'Enter Stake Amount', desc: 'Type the amount of VCN you wish to stake in the input field. The minimum is 100 VCN (displayed as placeholder text "Min: 100 VCN"). You can tap the "MAX" button to stake your entire available balance.' },
                    { title: 'Click "Stake VCN"', desc: 'Tap the amber "STAKE VCN" button at the bottom of the form. This begins the staking process.' },
                    { title: 'Enter Wallet Password', desc: 'A modal popup titled "Spending Password Required" appears. Enter your wallet password (the one you set during wallet setup, not your login password) and tap "Confirm".' },
                    { title: 'Wait for EIP-712 Permit Signing', desc: 'The button changes to "Approving..." while your wallet signs an EIP-712 typed data permit. This is a gasless signature that authorizes the Paymaster to transfer VCN (stake amount + 1 VCN fee) on your behalf.' },
                    { title: 'Transaction Processing', desc: 'After signing, the button changes to "Staking..." while the Paymaster submits the transaction on-chain. The Paymaster pays the gas fee, you pay only the 1 VCN service fee via the permit.' },
                    { title: 'Confirmation', desc: 'On success, a green success indicator appears with the transaction hash. Your "Your Staked Amount" updates, your VCN Balance decreases, and you are now an Active Validator. Rewards begin accumulating immediately.' },
                ]} />
                <Warning><>The minimum stake is 100 VCN. If you try to stake less, an error message appears: "Minimum stake is 100 VCN". Each staking transaction charges a 1 VCN service fee to the Paymaster.</></Warning>
                <Tip><>After staking, your status changes to "Active Validator" and you begin earning rewards proportional to your stake. The rewards come from bridge transaction fees (1% of each bridge transfer) and the subsidy pool.</></Tip>
            </div>
        );
        case 'staking-rewards': return (
            <div class="space-y-6">
                <SectionHeader title="Rewards, Unstaking & Withdrawal" desc="Comprehensive guide to claiming rewards, requesting unstake, and withdrawing your tokens." />

                <h3 class="text-lg font-bold text-white mb-3">Claiming Rewards</h3>
                <p class="text-sm text-gray-400 mb-3">Rewards accumulate continuously as long as you are an Active Validator. They are visible in the "Pending Rewards" row of your balance panel.</p>
                <StepList steps={[
                    { title: 'Check Pending Rewards', desc: 'Look at the "Pending Rewards" line in the amber balance panel. It shows the exact VCN amount with up to 4 decimal places, along with the current APY percentage.' },
                    { title: 'Tap "Claim"', desc: 'The green "Claim" button appears next to your pending rewards. Tap it to claim. The button is disabled (grayed out) if you have no rewards to claim.' },
                    { title: 'Transaction Processing', desc: 'The claim transaction is submitted via the Paymaster (gasless). The button shows a spinner while processing.' },
                    { title: 'Rewards Added to Balance', desc: 'On success, your VCN wallet balance increases by the claimed amount. The pending rewards counter resets to 0 and begins accumulating again immediately.' },
                ]} />
                <Tip><>Claiming rewards is gasless and has no fee. You can claim as often as you want, but since each claim is a transaction, it is practical to let rewards accumulate before claiming.</></Tip>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Requesting Unstake</h3>
                <p class="text-sm text-gray-400 mb-3">Unstaking is a two-step process: first you request unstake (which starts a 7-day cooldown), then you withdraw after the cooldown period.</p>
                <StepList steps={[
                    { title: 'Switch to "Unstake" Tab', desc: 'In the staking form, tap the "Unstake" tab. The label shows your maximum unstakeable amount (e.g., "Unstake Amount (Max: 1,000 VCN)").' },
                    { title: 'Enter Unstake Amount', desc: 'Type the amount to unstake. You can tap "MAX" to unstake everything. Important: if you partially unstake, the remaining amount must be either 0 or at least 100 VCN (the minimum stake). Otherwise you will see an error: "Remaining stake would be below minimum 100 VCN."' },
                    { title: 'Tap "Request Unstake"', desc: 'Tap the amber button. The transaction is submitted via Paymaster (gasless).' },
                    { title: 'Cooldown Begins', desc: 'On success, a new "Pending Unstake" row appears in your balance panel showing the amount and a countdown timer (e.g., "7d 0h remaining"). Your staked amount decreases accordingly.' },
                ]} />
                <Warning><>During the 7-day cooldown period, your unstaking tokens do NOT earn rewards. You cannot cancel an unstake request. Make sure you are ready to wait before proceeding.</></Warning>
                <Note><>If you unstake your entire balance, you will no longer be an Active Validator and will stop earning rewards. You can re-stake at any time with the minimum 100 VCN.</></Note>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Withdrawing After Cooldown</h3>
                <p class="text-sm text-gray-400 mb-3">After the 7-day cooldown period is complete, a third "Withdraw" tab appears in the staking form.</p>
                <StepList steps={[
                    { title: 'Wait for Cooldown', desc: 'Monitor the countdown timer in the "Pending Unstake" row. When it changes to "Ready to withdraw", the 7-day period is complete.' },
                    { title: 'Switch to "Withdraw" Tab', desc: 'A green "Withdraw" tab appears automatically in the form tabs when your cooldown is complete. Tap it.' },
                    { title: 'Tap "Withdraw"', desc: 'Tap the green "WITHDRAW" button. The Paymaster handles the gasless withdrawal.' },
                    { title: 'Tokens Returned', desc: 'Your VCN balance increases by the withdrawn amount. The "Pending Unstake" row disappears. The process is complete.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Validator Table</h3>
                <p class="text-sm text-gray-400">At the bottom of the page, a table shows the top 5 active validators with their shortened addresses and staked amounts. This gives you a sense of the network's validator distribution.</p>
            </div>
        );

        // ─── Agent ───
        case 'agent-overview': return (
            <div class="space-y-6">
                <SectionHeader title="What is Agent Hosting?" desc="AI Agent Hosting lets you deploy autonomous AI-powered bots on Vision Chain that execute actions on your behalf -- from automated transfers to social media content generation." />
                <p class="text-sm text-gray-400">Each agent gets its own dedicated wallet address, API key, and VCN balance. Agents are powered by the ZYNK AI Router (DeepSeek model) and execute at intervals you configure. You earn Reward Points (RP) for creating agents.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: '7 On-chain Actions', d: 'Balance Monitor, Auto Transfer, Auto Stake, Conditional Unstake, Network Monitor, Staking Dashboard, and Leaderboard Tracker' },
                        { t: '5 Growth Actions', d: 'Referral Outreach, Social Promotion, Content Creator, Invite Distribution, and Community Engagement' },
                        { t: 'Cost Tiers', d: 'Actions have three cost levels: Read-only (0.05 VCN), Medium (0.1 VCN), and Write (0.5 VCN) per execution' },
                        { t: 'Flexible Scheduling', d: 'Run agents every 5 min (~7.2 VCN/mo), 30 min (~1.2 VCN/mo), hourly (~0.6 VCN/mo), or daily (~0.05 VCN/mo)' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
                <h3 class="text-lg font-bold text-white mt-6 mb-3">Agent Dashboard Tabs</h3>
                <p class="text-sm text-gray-400 mb-3">The Agent page has three tabs at the top:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Overview', d: 'Shows your registered agents with status badges (Active/Paused/Setup), VCN balance, execution count, and action buttons' },
                        { n: 'Setup', d: 'The 4-step agent creation wizard: Name > Select Action > Configure Settings > Schedule & Deploy' },
                        { n: 'Logs', d: 'Detailed execution history with timestamps, action types, results, and VCN costs for the last 50 executions' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[60%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'agent-create': return (
            <div class="space-y-6">
                <SectionHeader title="Creating an Agent" desc="Step-by-step guide through the 4-step agent creation wizard." />
                <FlowDiagram title="Agent Creation Wizard" steps={[
                    { label: 'Name', sub: 'Register agent', color: '#22d3ee' },
                    { label: 'Action', sub: 'Select type', color: '#a78bfa' },
                    { label: 'Configure', sub: 'Set parameters', color: '#f59e0b' },
                    { label: 'Deploy', sub: 'Schedule & go', color: '#10b981' },
                ]} />
                <Prerequisites items={['Logged in to Vision Chain wallet', 'No existing agent (one agent per account initially)']} />

                <h3 class="text-lg font-bold text-white mb-3">Step 1: Name Your Agent</h3>
                <StepList steps={[
                    { title: 'Open Agent Hosting', desc: 'From the sidebar menu, tap "Agent" to open the Agent Hosting page.' },
                    { title: 'Click "Create Your First Agent"', desc: 'If you have no agents, the Overview tab shows an empty state with a prominent "Create Your First Agent" button. Click it.' },
                    { title: 'Enter Agent Name', desc: 'Type a unique name for your agent (e.g., "Balance Watcher", "Auto Staker"). This name is displayed on your dashboard and in logs.' },
                    { title: 'Click "Register & Continue"', desc: 'The system registers your agent via the Agent Gateway API. On success, your agent receives a dedicated wallet address and 100 VCN initial balance, and you move to Step 2.' },
                ]} />
                <Tip><>You earn Reward Points (RP) for creating your first agent. The amount is configured by administrators.</></Tip>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Step 2: Select Action</h3>
                <p class="text-sm text-gray-400 mb-3">A grid of action cards appears, organized by category. Each card shows the action name, description, cost tier badge (green/amber/red), and VCN cost per execution. Select one action:</p>
                <StepList steps={[
                    { title: 'Browse Actions', desc: 'Cards are organized into "On-chain" (blue border) and "Growth" (purple border) categories. Each shows a cost badge: Read-only (green, 0.05 VCN), Medium (amber, 0.1 VCN), or Write (red, 0.5 VCN).' },
                    { title: 'Tap an Action Card', desc: 'Click any action to select it. The selected card highlights with a cyan border. A detailed description of what the agent will do appears.' },
                    { title: 'Click "Configure Action"', desc: 'Proceed to the action-specific settings screen.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Step 3: Configure Action Settings</h3>
                <p class="text-sm text-gray-400 mb-3">Each action has its own set of configuration fields. For example, "Auto Transfer" has: Recipient Address, Amount per Transfer, Daily Limit, Transfer Condition, and Minimum Balance to Keep. Fill in each field according to your requirements.</p>
                <StepList steps={[
                    { title: 'Fill Settings Fields', desc: 'Each field has a label, description, and helper text. Numeric fields show min/max ranges and units. Select fields offer dropdown options. Toggle fields are on/off switches.' },
                    { title: 'Review System Prompt', desc: 'A pre-filled system prompt appears at the bottom based on your selected action. You can edit this to customize the agent behavior further.' },
                    { title: 'Click "Set Schedule"', desc: 'Move to the final step to choose execution frequency.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Step 4: Schedule & Deploy</h3>
                <StepList steps={[
                    { title: 'Choose Execution Interval', desc: 'Select from 4 options: Every 5 min, Every 30 min, Every hour, or Once daily. Each shows estimated monthly VCN cost.' },
                    { title: 'Set Max VCN Per Action', desc: 'Set the maximum VCN the agent can spend in a single execution (safety limit). Default is 5 VCN.' },
                    { title: 'Review Monthly Cost Estimate', desc: 'A summary shows your estimated monthly VCN cost based on interval and action cost tier.' },
                    { title: 'Click "Deploy Agent"', desc: 'The system saves your configuration and activates the agent. It immediately begins executing at your chosen interval.' },
                ]} />
                <Warning><>Agents spend real VCN from their dedicated wallet. Start with conservative settings (longer intervals, lower limits) and monitor the execution logs before increasing frequency or budgets.</></Warning>
            </div>
        );
        case 'agent-actions': return (
            <div class="space-y-6">
                <SectionHeader title="Available Action Types" desc="Complete reference of all 12 agent actions with their costs, settings, and use cases." />

                <h3 class="text-lg font-bold text-cyan-400 mb-3">On-chain Actions (7)</h3>
                <div class="space-y-3">
                    {[
                        { n: 'Balance Monitor', cost: '0.05 VCN (Read)', d: 'Watches your agent wallet balance and alerts when it drops below a threshold. Settings: Alert Threshold (VCN amount), Alert Method (Log or Webhook).' },
                        { n: 'Auto Transfer', cost: '0.5 VCN (Write)', d: 'Automatically sends VCN to a specified address on each execution. Settings: Recipient Address, Amount per Transfer, Daily Limit, Transfer Condition (always or above-balance), Minimum Balance to Keep.' },
                        { n: 'Auto Stake', cost: '0.5 VCN (Write)', d: 'Automatically stakes VCN for rewards. Settings: Stake Mode (fixed amount or percentage), Stake Amount/Percentage, Auto-Compound toggle, Minimum Balance to Keep.' },
                        { n: 'Conditional Unstake', cost: '0.5 VCN (Write)', d: 'Unstakes VCN when conditions are met (e.g., APY drops below target). Settings: Unstake Amount (full or partial), Trigger Condition (every execution or APY-based), Target APY Threshold.' },
                        { n: 'Network Monitor', cost: '0.05 VCN (Read)', d: 'Monitors Vision Chain health and block production. Settings: Block Delay Alert threshold (seconds).' },
                        { n: 'Staking Dashboard', cost: '0.05 VCN (Read)', d: 'Tracks your staking position and pending rewards. Settings: Auto-Claim Alert Threshold (VCN, 0 to disable).' },
                        { n: 'Leaderboard Tracker', cost: '0.05 VCN (Read)', d: 'Tracks the RP leaderboard and reports your ranking. No configuration needed.' },
                    ].map(item => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-sm font-bold text-white">{item.n}</span>
                                <span class="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">{item.cost}</span>
                            </div>
                            <p class="text-xs text-gray-400">{item.d}</p>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-purple-400 mt-8 mb-3">Growth Actions (5)</h3>
                <div class="space-y-3">
                    {[
                        { n: 'Referral Outreach', cost: '0.1 VCN (Medium)', d: 'Generates and distributes referral link content for selected channels. Settings: Target Channels (Twitter, Telegram, Discord, Email), Custom Message template, Max Outreach per Day.' },
                        { n: 'Social Promotion', cost: '0.1 VCN (Medium)', d: 'Creates social media posts about Vision Chain. Settings: Topic Focus (General, Staking, Agents, Bridge), Tone & Style (Professional, Casual, Hype, Educational), Custom Hashtags.' },
                        { n: 'Content Creator', cost: '0.05 VCN (Read)', d: 'Generates long-form content like threads and articles. Settings: Content Type (Twitter Thread, Blog Article, Newsletter), Target Platform (Twitter, Medium, Blog).' },
                        { n: 'Invite Distribution', cost: '0.1 VCN (Medium)', d: 'Crafts personalized invitation messages for different audiences. Settings: Target Audience (General, Developers, Investors, DeFi Users), Custom Invite Message, Daily Invite Limit.' },
                        { n: 'Community Engagement', cost: '0.1 VCN (Medium)', d: 'Prepares talking points for community channels. Settings: Channels (Discord, Telegram, Twitter), Focus Topics (Staking FAQ, Network Updates, Onboarding, Technical), Engagement Style.' },
                    ].map(item => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-sm font-bold text-white">{item.n}</span>
                                <span class="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{item.cost}</span>
                            </div>
                            <p class="text-xs text-gray-400">{item.d}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'agent-manage': return (
            <div class="space-y-6">
                <SectionHeader title="Managing Your Agent" desc="Detailed guide to the agent Overview dashboard -- monitoring status, toggling, and deleting agents." />
                <p class="text-sm text-gray-400 mb-3">The Overview tab shows each registered agent as a card with the following information:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Agent Name', d: 'Your agent name with a status badge (Active = green pulse, Paused = amber, Setup = gray)' },
                        { n: 'Agent Wallet', d: 'The dedicated wallet address assigned to your agent. Tap the copy icon to copy it to clipboard' },
                        { n: 'API Key', d: 'Your unique API key for programmatic access. Shown partially masked with a copy button' },
                        { n: 'VCN Balance', d: 'Current VCN balance in the agent wallet. This is the fuel for agent operations' },
                        { n: 'Executions', d: 'Total number of times the agent has executed its action since creation' },
                        { n: 'Total VCN Spent', d: 'Cumulative VCN spent across all executions' },
                        { n: 'Last Execution', d: 'Timestamp of the most recent execution (or "Never" if not yet run)' },
                        { n: 'Selected Action', d: 'The action type currently configured (e.g., "Auto Transfer", "Balance Monitor")' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[55%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>
                <h3 class="text-lg font-bold text-white mt-6 mb-3">Agent Controls</h3>
                <StepList steps={[
                    { title: 'Pause / Resume', desc: 'Tap the Play/Pause button on the agent card. When paused, the agent stops executing but retains its configuration and balance. Resume to start executing again at the configured interval.' },
                    { title: 'Delete Agent', desc: 'Tap the trash icon. A confirmation dialog appears: "Are you sure? This will permanently delete the agent and cannot be undone." Tap "Delete" to confirm. The agent is removed, its API key is invalidated, and your local storage is cleared.' },
                    { title: 'Top Up Balance', desc: 'Transfer VCN to the agent wallet address shown on the card. The agent needs VCN to pay for executions. If balance reaches zero, the agent status changes to "insufficient_balance".' },
                ]} />
                <Warning><>Deleting an agent is permanent and cannot be undone. Any remaining VCN in the agent wallet should be transferred out before deletion. The API key becomes immediately invalid.</></Warning>
            </div>
        );
        case 'agent-logs': return (
            <div class="space-y-6">
                <SectionHeader title="Execution Logs & Monitoring" desc="Understand your agent's activity through detailed execution logs." />
                <p class="text-sm text-gray-400 mb-3">Switch to the "Logs" tab on the Agent page to view the execution history. Logs are loaded from the Agent Gateway API and show the last 50 executions.</p>
                <h3 class="text-lg font-bold text-white mb-3">Log Entry Fields</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Timestamp', d: 'Date and time of execution in your local timezone' },
                        { n: 'Action', d: 'The action type that was executed (e.g., "balance", "transfer", "stake")' },
                        { n: 'Status', d: 'Success (green checkmark) or Error (red X). Error entries include the error message' },
                        { n: 'Result', d: 'Detailed output from the execution -- for example, balance amounts, transfer hashes, or generated content' },
                        { n: 'VCN Cost', d: 'The VCN amount charged for this execution' },
                        { n: 'Duration', d: 'How long the execution took in milliseconds' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[55%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>
                <h3 class="text-lg font-bold text-white mt-6 mb-3">Monitoring Best Practices</h3>
                <StepList steps={[
                    { title: 'Check Logs After First Execution', desc: 'After deploying, wait for the first execution interval and check logs to confirm the agent is working correctly.' },
                    { title: 'Watch for Error Patterns', desc: 'If you see repeated errors (red X), the agent may have misconfigured settings or insufficient balance. Review the error message for details.' },
                    { title: 'Monitor VCN Burn Rate', desc: 'Compare "Total VCN Spent" against your budget expectations. Adjust interval frequency if spending is too high.' },
                    { title: 'Review Generated Content', desc: 'For Growth actions (Social Promotion, Content Creator), review the generated content in log results to ensure quality and accuracy before sharing.' },
                ]} />
                <Tip><>If your agent shows "insufficient_balance" status, it means the agent wallet ran out of VCN. Transfer more VCN to the agent wallet address and resume the agent.</></Tip>
            </div>
        );

        // ─── Insight ───
        case 'insight-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Vision Insight Dashboard" desc="AI-curated market intelligence powered by Gemini AI, aggregating news from 10+ sources with real-time sentiment analysis." />
                <p class="text-sm text-gray-400">Vision Insight collects crypto news every 2 hours from sources like CoinDesk, CoinTelegraph, Bitcoin Magazine, Decrypt, The Block, and Korean outlets (Decenter, BlockMedia). Each article is analyzed by Gemini AI for sentiment, impact score, and category.</p>
                <h3 class="text-lg font-bold text-white mt-6 mb-3">Dashboard Components</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Agent Sentiment Index (ASI)', d: 'A 0-100 gauge showing overall market sentiment. Colors range from red (bearish, 0-25) through amber (neutral, 45-60) to green (bullish, 75-100). Updated with each data refresh.' },
                        { n: 'Live Articles Count', d: 'Total number of articles currently loaded in the feed, displayed as a cyan number.' },
                        { n: 'Whale Flow', d: 'Net whale wallet flow direction: "accumulation" (green, buying) or "distribution" (red, selling) with dollar amount.' },
                        { n: 'AI Market Brief', d: 'Gemini AI-generated analysis with trading bias (LONG/SHORT/NEUTRAL), confidence score, category highlights, key risks, and opportunities.' },
                        { n: 'Category Tabs', d: 'Horizontally scrollable filter tabs: All, Bitcoin, Ethereum, DeFi, Regulation, AI & Web3, NFT & Gaming, Altcoin, Korea. Each shows article count badge.' },
                        { n: 'News Feed', d: 'Scrollable list of articles with title, sentiment badge, severity level, source, time ago, and impact score (60+ highlighted in amber).' },
                        { n: 'Trending Keywords', d: 'Top trending terms extracted from articles. Top 3 highlighted in purple.' },
                        { n: 'Macro Calendar', d: 'Upcoming economic events (FOMC, CPI, etc.) with days-until countdown and impact level (high/medium/low).' },
                    ].map(item => (
                        <div class="flex items-start gap-3 px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white min-w-[180px] flex-shrink-0">{item.n}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>
                <Tip><>Tap the "API" button in the top-right corner to toggle Agent Data Stream view, which shows the raw JSON data that AI agents can consume programmatically.</></Tip>
            </div>
        );
        case 'insight-news': return (
            <div class="space-y-6">
                <SectionHeader title="Reading the News Feed" desc="Step-by-step guide to navigating and using the AI-curated news feed." />
                <StepList steps={[
                    { title: 'Open Vision Insight', desc: 'From the sidebar menu, tap "Insight" to open the Vision Insight page. Data loads automatically from the server.' },
                    { title: 'Browse the AI Market Brief', desc: 'At the top, the AI Market Brief card (purple border) shows the Gemini-generated analysis. Read the trading bias (LONG/SHORT/NEUTRAL with confidence %) and the written analysis paragraph.' },
                    { title: 'Filter by Category', desc: 'Scroll the horizontal category tabs to filter articles. Each tab shows the number of articles in that category. Tap a category to filter; tap "All" to show everything.' },
                    { title: 'Read Article Cards', desc: 'Each article card shows: category badge (color-coded), severity badge (critical=red, warning=amber), sentiment arrow (up=bullish, down=bearish, right=neutral), time since publication, title (2-line truncated), source name with color dot, language badge if non-English, and impact score (60+ = star icon).' },
                    { title: 'Open Full Article', desc: 'Tap any article card to open the full article in a new browser tab. The link goes to the original source.' },
                    { title: 'Check Trending & Calendar', desc: 'Scroll down to see Trending Keywords (purple tags) and Macro Calendar (upcoming economic events with D-countdown and impact severity).' },
                ]} />
                <Note><>Articles are collected every 2 hours. If a category shows "No articles in this category yet", data collection is still in progress. The "Last updated" timestamp at the bottom shows when data was last refreshed.</></Note>
            </div>
        );
        case 'insight-signals': return (
            <div class="space-y-6">
                <SectionHeader title="AI Market Brief & Trading Signals" desc="Understanding the Gemini AI-generated market analysis and trading signals." />
                <p class="text-sm text-gray-400 mb-3">The AI Market Brief is the centerpiece of Vision Insight. It is generated by Gemini AI analyzing all collected articles and market data.</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Trading Bias', d: 'LONG (green, bullish), SHORT (red, bearish), or NEUTRAL (amber). Shown with confidence percentage.' },
                        { n: 'Analysis Text', d: 'A paragraph summarizing the current market situation, key drivers, and outlook.' },
                        { n: 'Category Highlights', d: 'Per-category sentiment summaries (e.g., "Bitcoin: bullish - ETF inflows continue").' },
                        { n: 'Key Risks', d: 'Red-flagged risk factors identified from current news (e.g., "Regulatory crackdown in EU").' },
                        { n: 'Opportunities', d: 'Green-flagged opportunities identified from current news (e.g., "DeFi TVL growth accelerating").' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[60%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>
                <Warning><>The AI Market Brief and trading signals are for informational purposes only and do not constitute financial advice. Always do your own research before making investment decisions. Past AI analysis accuracy does not guarantee future results.</></Warning>
            </div>
        );

        // ─── CEX Portfolio ───
        case 'cex-connect': return (
            <div class="space-y-6">
                <SectionHeader title="Connecting Your Exchange" desc="Link your centralized exchange account to Vision Chain using API credentials. Vision Chain supports 15 exchanges across Korea, Japan, USA, and global markets." />

                <Prerequisites items={[
                    'An active, verified account on a supported exchange (identity verification completed)',
                    'API Key and Secret Key generated from the exchange (read-only / balance inquiry permission)',
                    'Passphrase (required only for Bitget, OKX, KuCoin, and Crypto.com)',
                    'Server IP address whitelisted in your exchange API settings (varies by exchange)',
                    'PC or desktop browser recommended for initial API key setup on most exchanges',
                ]} />

                <h3 class="text-lg font-bold text-white mt-6 mb-3">Step-by-Step Connection Guide</h3>
                <StepList steps={[
                    { title: 'Navigate to CEX Portfolio', desc: 'Open the sidebar menu and tap "CEX Portfolio". If you have no exchanges connected yet, you will see the empty state with quick-connect cards for Upbit and Binance.' },
                    { title: 'Open the "Add Exchange" Modal', desc: 'Tap the "+" button in the header (or one of the quick-connect exchange cards). A modal will appear showing all 15 supported exchanges arranged in a 3-column grid.' },
                    { title: 'Select Your Exchange', desc: 'Tap on the exchange you want to connect. The selected exchange will be highlighted with a cyan border. Exchanges are sorted by region and popularity.' },
                    { title: 'Enter API Key', desc: 'Paste your API Key (also called "Access Key" on some exchanges) into the first credential field. This key is a public identifier and does not grant access alone.' },
                    { title: 'Enter Secret Key', desc: 'Paste your Secret Key into the password field. You can toggle visibility using the eye icon. This key is shown only once during creation on most exchanges -- store it securely.' },
                    { title: 'Enter Passphrase (if required)', desc: 'For Bitget, OKX, KuCoin, and Crypto.com, an additional "Passphrase" field appears automatically. Enter the passphrase you set during API key creation on the exchange. This cannot be recovered if lost.' },
                    { title: 'Optional: Add a Label', desc: 'Give this connection a descriptive name (e.g., "My Main Binance" or "Upbit Trading Account"). This helps identify connections when you have multiple exchanges or accounts.' },
                    { title: 'Click "Connect"', desc: 'The system sends a test API call to verify your credentials. If successful, your exchange will appear in the connected exchanges list and portfolio data will sync automatically within a few seconds.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-6 mb-3">API Authentication Types</h3>
                <div class="space-y-3">
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <h4 class="text-sm font-bold text-white mb-2">2-Field Authentication (API Key + Secret)</h4>
                        <p class="text-xs text-gray-400 mb-2">Used by: Upbit, Bithumb, Coinone, Binance, Bybit, MEXC, Coinbase, bitFlyer, GMO Coin, Coincheck, Bitkub</p>
                        <p class="text-xs text-gray-500">Standard API authentication requiring an API Key (public) and Secret Key (private). The Secret Key is encrypted on our server and never stored in plaintext or sent to the client after initial registration.</p>
                    </div>
                    <div class="bg-[#0a0a12] border border-amber-500/10 rounded-xl p-5">
                        <h4 class="text-sm font-bold text-amber-400 mb-2">3-Field Authentication (API Key + Secret + Passphrase)</h4>
                        <p class="text-xs text-gray-400 mb-2">Used by: Bitget, OKX, KuCoin, Crypto.com</p>
                        <p class="text-xs text-gray-500">These exchanges require an additional passphrase that acts as a third layer of security. The passphrase is set by you during API key creation on the exchange website and must be entered exactly as created. If you forget your passphrase, you will need to create a new API key on the exchange.</p>
                    </div>
                </div>

                <h3 class="text-lg font-bold text-white mt-6 mb-3">IP Whitelist Setup</h3>
                <p class="text-sm text-gray-400 mb-3">Most exchanges require (or strongly recommend) restricting API access to specific IP addresses. Vision Chain provides a static server IP for this purpose.</p>
                <StepList steps={[
                    { title: 'View the Server IP', desc: 'Tap the "?" help icon on the CEX Portfolio page. The IP Setup Guide modal will display the static server IP address prominently at the top.' },
                    { title: 'Copy the IP Address', desc: 'Tap the "Copy" button next to the IP address. The IP will be copied to your clipboard.' },
                    { title: 'Add to Exchange API Settings', desc: 'Go to your exchange\'s API management page. Find the IP whitelist or IP restriction section for your API key. Paste the copied IP address and save.' },
                    { title: 'Verify Connection', desc: 'Return to Vision Chain and connect your exchange. If the IP is correctly whitelisted, the verification test will succeed immediately.' },
                ]} />

                <Warning><>Only use read-only API keys. Never enable trading, withdrawal, or transfer permissions. Vision Chain only reads balance and ticker data. Never executes trades or withdrawals on your behalf. Your funds remain fully under your control at all times.</></Warning>

                <h3 class="text-lg font-bold text-white mt-6 mb-3">Troubleshooting</h3>
                <div class="space-y-3">
                    {[
                        { q: 'Connection fails with "Invalid API Key"', a: 'Double-check that you copied the full API Key and Secret Key without trailing spaces. Some exchanges display keys in multiple lines -- make sure you copy the complete string.' },
                        { q: 'Connection fails with "IP not whitelisted"', a: 'Ensure you added the correct server IP to your exchange API settings. Some exchanges take 1-2 minutes for IP whitelist changes to propagate.' },
                        { q: 'Connection fails with "Permission denied"', a: 'Your API key may not have the required read/balance permissions. Re-create the API key on the exchange with at least "Read" or "Balance Inquiry" permission enabled.' },
                        { q: 'Passphrase error on Bitget/OKX/KuCoin', a: 'The passphrase must match exactly (case-sensitive) what you set during API key creation. If unsure, create a new API key with a known passphrase.' },
                    ].map(item => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-4">
                            <h4 class="text-xs font-bold text-red-400 mb-1">{item.q}</h4>
                            <p class="text-[11px] text-gray-400">{item.a}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'cex-exchanges': return (
            <div class="space-y-6">
                <SectionHeader title="Supported Exchanges" desc="Vision Chain supports 15 centralized exchanges across Korea, Japan, USA, and global markets. Each exchange uses read-only API access for portfolio tracking." />

                {/* Full Exchange Compatibility Table */}
                <h3 class="text-lg font-bold text-white mb-3">Exchange Compatibility Matrix</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/[0.06] text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        <div class="col-span-3">Exchange</div>
                        <div class="col-span-2">Region</div>
                        <div class="col-span-2">Base CCY</div>
                        <div class="col-span-2">Spot</div>
                        <div class="col-span-3">Passphrase</div>
                    </div>
                    {[
                        { n: 'Upbit', r: 'Korea', b: 'KRW', p: false },
                        { n: 'Bithumb', r: 'Korea', b: 'KRW', p: false },
                        { n: 'Coinone', r: 'Korea', b: 'KRW', p: false },
                        { n: 'Binance', r: 'Global', b: 'USDT', p: false },
                        { n: 'Bybit', r: 'Global', b: 'USDT', p: false },
                        { n: 'Bitget', r: 'Global', b: 'USDT', p: true },
                        { n: 'OKX', r: 'Global', b: 'USDT', p: true },
                        { n: 'KuCoin', r: 'Global', b: 'USDT', p: true },
                        { n: 'MEXC', r: 'Global', b: 'USDT', p: false },
                        { n: 'Coinbase', r: 'USA', b: 'USD', p: false },
                        { n: 'Crypto.com', r: 'Global', b: 'USDT', p: true },
                        { n: 'bitFlyer', r: 'Japan', b: 'JPY', p: false },
                        { n: 'GMO Coin', r: 'Japan', b: 'JPY', p: false },
                        { n: 'Coincheck', r: 'Japan', b: 'JPY', p: false },
                        { n: 'Bitkub', r: 'Thailand', b: 'THB', p: false },
                    ].map(ex => (
                        <div class="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02]">
                            <span class="col-span-3 text-sm font-bold text-white">{ex.n}</span>
                            <span class="col-span-2 text-xs text-gray-400">{ex.r}</span>
                            <span class="col-span-2 text-xs text-cyan-400 font-mono">{ex.b}</span>
                            <span class="col-span-2 text-xs text-green-400">Yes</span>
                            <span class="col-span-3 text-xs text-gray-400">{ex.p ? 'Required' : 'Not needed'}</span>
                        </div>
                    ))}
                </div>

                {/* Regional Breakdown */}
                <h3 class="text-lg font-bold text-white mt-8 mb-3">Exchange Details by Region</h3>

                {/* Korean Exchanges */}
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5 space-y-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-cyan-400 uppercase tracking-widest px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">Korea</span>
                        <span class="text-sm font-bold text-white">Korean Exchanges (KRW)</span>
                    </div>
                    {[
                        { name: 'Upbit', url: 'upbit.com/mypage/open_api_management', notes: 'Largest Korean exchange by volume. API key generation requires 2FA (OTP). IP whitelisting is mandatory. Only read-only (balance inquiry) permissions should be granted. API keys expire after 90 days by default.' },
                        { name: 'Bithumb', url: 'bithumb.com/api_support/management_api', notes: 'Second-largest Korean exchange. API key is generated from the API Management page. Requires identity verification (Level 2+). IP whitelist must include our server IP. Read permission only required.' },
                        { name: 'Coinone', url: 'coinone.co.kr/developer/app', notes: 'Korean exchange supporting KRW trading pairs. API keys are created via the Developer App menu. Requires OAuth2-style app creation. Select "Account" scope for balance reading. No passphrase needed.' },
                    ].map(ex => (
                        <div class="pl-3 border-l-2 border-cyan-500/20 space-y-1">
                            <div class="text-sm font-bold text-white">{ex.name}</div>
                            <p class="text-xs text-gray-400 leading-relaxed">{ex.notes}</p>
                            <a href={`https://${ex.url}`} target="_blank" rel="noopener" class="text-[10px] text-cyan-400 hover:underline">{ex.url}</a>
                        </div>
                    ))}
                </div>

                {/* Global Exchanges */}
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5 space-y-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-green-400 uppercase tracking-widest px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">Global</span>
                        <span class="text-sm font-bold text-white">Global Exchanges (USDT)</span>
                    </div>
                    {[
                        { name: 'Binance', notes: 'World\'s largest exchange. Navigate to API Management under Account settings. Create a new API key with "Read Only" access. Restrict to our server IP. No passphrase required. API keys can be set to never expire.' },
                        { name: 'Bybit', notes: 'Major derivatives and spot exchange. Create API key from Account & Security > API Management. Enable "Read-Only" permissions. IP restriction is recommended. Supports both Unified and Standard accounts.' },
                        { name: 'Bitget', notes: 'Requires API Key + Secret Key + Passphrase (3-field auth). The passphrase is set during API creation and cannot be recovered later. Enable "Read" permission only. IP whitelist required for security.' },
                        { name: 'OKX', notes: 'Requires API Key + Secret Key + Passphrase (3-field auth). Create from Account > API under "Trade" section. Select "Read" permission. Passphrase must be 8-32 characters. Supports sub-accounts.' },
                        { name: 'KuCoin', notes: 'Requires API Key + Secret Key + Passphrase (3-field auth). Navigate to API Management in account settings. Set a trading passphrase during creation. Select "General" permission for balance reading.' },
                        { name: 'MEXC', notes: 'Go to Account > API Management to create keys. Grant "Read" permission only. IP restriction available. No passphrase needed. Keys support both spot and futures reading.' },
                        { name: 'Crypto.com', notes: 'Requires API Key + Secret Key + Passphrase (3-field auth). Go to Settings > API Keys in the Crypto.com Exchange (not the Crypto.com App). Read-only access recommended.' },
                    ].map(ex => (
                        <div class="pl-3 border-l-2 border-green-500/20 space-y-1">
                            <div class="text-sm font-bold text-white">{ex.name}</div>
                            <p class="text-xs text-gray-400 leading-relaxed">{ex.notes}</p>
                        </div>
                    ))}
                </div>

                {/* US & Japan & Thailand */}
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5 space-y-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-purple-400 uppercase tracking-widest px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg">US / Japan / Thailand</span>
                        <span class="text-sm font-bold text-white">Regional Exchanges (USD / JPY / THB)</span>
                    </div>
                    {[
                        { name: 'Coinbase', ccy: 'USD', notes: 'Largest US exchange. Uses Coinbase Advanced Trade API. Create API key from Settings > API. Select "View" permission for portfolio data. No passphrase needed. Portfolio values are quoted in USD and converted to KRW using real-time CoinGecko rates.' },
                        { name: 'bitFlyer', ccy: 'JPY', notes: 'Japan\'s leading exchange. API key created from bitFlyer Lightning under API settings. Provides balance inquiry and ticker data in JPY. IP whitelist supported. Values auto-converted to KRW via JPY/KRW exchange rate.' },
                        { name: 'GMO Coin', ccy: 'JPY', notes: 'Japanese exchange operated by GMO Internet Group. API key from Account > API settings. Read-only permission for asset balances. JPY values are converted to KRW using real-time exchange rates from CoinGecko.' },
                        { name: 'Coincheck', ccy: 'JPY', notes: 'Japanese exchange with simple API setup. Create keys from Settings > API. Supports balance reading and order book data. All JPY-denominated values are automatically converted to KRW.' },
                        { name: 'Bitkub', ccy: 'THB', notes: 'Thailand\'s largest exchange. API keys from Bitkub.com under API Key menu. Thai Baht (THB) values are converted to KRW using CoinGecko exchange rates. Read-only access only.' },
                    ].map(ex => (
                        <div class="pl-3 border-l-2 border-purple-500/20 space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-bold text-white">{ex.name}</span>
                                <span class="text-[9px] font-mono text-purple-400 px-1.5 py-0.5 bg-purple-500/10 rounded">{ex.ccy}</span>
                            </div>
                            <p class="text-xs text-gray-400 leading-relaxed">{ex.notes}</p>
                        </div>
                    ))}
                </div>

                {/* Multi-Currency Conversion */}
                <h3 class="text-lg font-bold text-white mt-8 mb-3">Multi-Currency Conversion Engine</h3>
                <p class="text-sm text-gray-400 mb-4">All portfolio values are automatically converted to KRW and USD using real-time exchange rates fetched from CoinGecko. The conversion pipeline works as follows:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'KRW-based exchanges', d: 'Upbit, Bithumb, Coinone: Prices are natively in KRW. No conversion needed for KRW display. USD value = KRW value / USD_KRW rate.' },
                        { n: 'USDT-based exchanges', d: 'Binance, Bybit, OKX, Bitget, KuCoin, MEXC, Crypto.com: Prices in USDT. KRW value = USDT price x USDT_KRW rate (fetched from CoinGecko tether price in KRW).' },
                        { n: 'USD-based exchanges', d: 'Coinbase: Prices in USD. KRW value = USD price x USD_KRW rate. USD_KRW rate is fetched from CoinGecko USD-KRW pair.' },
                        { n: 'JPY-based exchanges', d: 'bitFlyer, GMO, Coincheck: Prices in JPY. KRW value = JPY price x JPY_KRW rate. The JPY_KRW rate is derived from CoinGecko API.' },
                        { n: 'THB-based exchanges', d: 'Bitkub: Prices in THB. KRW value = THB price x THB_KRW rate. Exchange rates are cached for 5 minutes to minimize API calls.' },
                    ].map(item => (
                        <div class="flex items-start gap-3 px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-bold text-white whitespace-nowrap min-w-[180px]">{item.n}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>
                <Tip><>You can connect multiple exchanges simultaneously. Assets with the same symbol from different exchanges are aggregated into a single row with source exchange badges. The toggle switch at the top lets you view values in either KRW or USD.</></Tip>
            </div>
        );
        case 'cex-portfolio': return (
            <div class="space-y-6">
                <SectionHeader title="Portfolio Overview" desc="A unified view of all your crypto holdings across connected exchanges, with real-time valuation, charts, and P&L tracking." />

                <p class="text-sm text-gray-400 mb-3">After connecting at least one exchange, you will see the Portfolio dashboard as the default view. The page is organized into three main sections: Summary Cards, Asset Allocation Chart, and Asset List.</p>

                <h3 class="text-lg font-bold text-white mt-4 mb-3">Dashboard Layout</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Tab Navigation', d: 'At the top of the page, two tabs are available: "Portfolio" (default, showing your assets) and "Quant" (BETA, for strategy trading). The Portfolio tab is active by default.' },
                        { n: 'Total Portfolio Value', d: 'Displays the combined value of all connected exchange assets. Shown in KRW by default with a toggle button to switch to USD. Updates on each sync.' },
                        { n: 'P&L Indicator', d: 'Shows the percentage change since the last sync. Green arrow and text for positive returns, red for negative. Calculated by comparing current total value vs. previous snapshot.' },
                        { n: 'Connected Exchanges', d: 'A horizontal list of all connected exchanges with their individual total values. Each shows the exchange label, masked API key (last 4 characters), and a sync/delete action.' },
                        { n: 'Donut Chart', d: 'Interactive SVG pie chart showing asset allocation by percentage. Each coin gets a unique color segment. The center displays the total portfolio value. Segment labels show coin name and percentage.' },
                        { n: 'Asset Table', d: 'Scrollable list of all assets sorted by value (descending). Each row shows: coin name with icon, balance quantity, current price, total value (KRW/USD), P&L percentage, and source exchange badge.' },
                        { n: 'Exchange Source Badge', d: 'A small icon or letter badge next to each asset indicating which exchange holds it. If the same coin exists on multiple exchanges, all badges are shown.' },
                        { n: 'Coin Icons', d: 'Automatically loaded from CoinGecko CDN based on the coin symbol. If an icon is not found, a fallback letter avatar (first letter of coin name) is displayed.' },
                    ].map(item => (
                        <div class="flex items-start gap-3 px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-bold text-white whitespace-nowrap min-w-[180px]">{item.n}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-6 mb-3">Syncing Portfolio Data</h3>
                <p class="text-sm text-gray-400 mb-3">Portfolio data is fetched from each exchange via their official REST APIs through our Cloud Functions server. Here is how the sync process works:</p>
                <StepList steps={[
                    { title: 'Manual Sync', desc: 'Tap the "Sync" button (refresh icon) at the top-right of the page. The system calls each connected exchange\'s API in parallel to fetch latest balances and ticker data. A loading spinner shows while syncing.' },
                    { title: 'Data Processing', desc: 'For each exchange, the server fetches: (1) Account balances for all coins, (2) Current ticker prices for all held assets, (3) Average buy prices where available. Values are then converted to KRW using the multi-currency conversion engine.' },
                    { title: 'Snapshot Storage', desc: 'Each sync creates a portfolio snapshot saved to Firestore with a timestamp. This allows historical tracking and P&L comparisons over time.' },
                    { title: 'Last Synced Timestamp', desc: 'The "Last synced" text at the bottom of the page shows the exact time of the most recent successful sync. This helps you know how fresh the data is.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-6 mb-3">Managing Connected Exchanges</h3>
                <div class="space-y-3">
                    {[
                        { n: 'Adding More Exchanges', d: 'You can connect up to 15 different exchanges (and multiple accounts on the same exchange). Each connection is independent with its own API credentials.' },
                        { n: 'Removing an Exchange', d: 'Tap the trash icon next to any connected exchange. A confirmation dialog appears. Upon confirmation, the encrypted API credentials are permanently deleted from our server. The API key on the exchange remains active until you revoke it manually.' },
                        { n: 'Labeling Connections', d: 'Each connection can have an optional label (e.g., "Main Trading" or "Long-term Hold"). This is helpful when connecting multiple accounts from the same exchange.' },
                        { n: 'Re-syncing Individual Exchanges', d: 'The sync button refreshes all connected exchanges at once. Individual exchange sync is not currently supported -- all exchanges sync together.' },
                    ].map(item => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-4">
                            <h4 class="text-sm font-bold text-white mb-1">{item.n}</h4>
                            <p class="text-xs text-gray-400">{item.d}</p>
                        </div>
                    ))}
                </div>

                <Tip><>Sync your portfolio regularly, especially before and after major trades. Portfolio snapshots are compared to calculate P&L, so more frequent syncs give more accurate performance tracking. Exchange rate data is cached for 5 minutes to minimize external API calls.</></Tip>
            </div>
        );
        case 'cex-quant': return (
            <div class="space-y-6">
                <SectionHeader title="Quant Engine - Strategy Settings" desc="Configure and deploy automated trading strategies on your connected exchanges. The Quant Engine provides 6 research-backed strategy templates with full parameter control." />
                <Note><>Quant Engine is currently in BETA. Connect at least one exchange via CEX Portfolio to access Quant features. Access it by switching to the "Quant" tab in the CEX Portfolio page.</></Note>

                <h3 class="text-lg font-bold text-white mt-4 mb-3">How to Access</h3>
                <StepList steps={[
                    { title: 'Open CEX Portfolio', desc: 'Navigate to CEX Portfolio from the sidebar. You must have at least one exchange connected.' },
                    { title: 'Switch to Quant Tab', desc: 'At the top of the page, tap the "Quant" tab (with the BETA badge). The tab navigation shows "Portfolio" and "Quant" side by side.' },
                    { title: 'Browse Strategy Templates', desc: 'The Quant Engine displays 6 pre-built strategy template cards. Each card shows the strategy name, category, risk level, recommended assets, and 30-day average return.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Available Strategy Templates (6 Modules)</h3>
                <p class="text-sm text-gray-400 mb-4">Each strategy is designed for explainability, controllability, and risk engine compatibility. Below are the details for all 6 built-in strategies:</p>

                {/* Strategy 1 */}
                <div class="bg-[#0a0a12] border border-green-500/10 rounded-xl p-5 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-sm font-black text-white">Module 1: Conservative Trend Core</h4>
                            <span class="text-[10px] text-gray-500">Category: Trend Following</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg">LOW RISK</span>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">Time-series momentum strategy using EMA crossover with volume and volatility filters. Enters only when the long-term trend is confirmed (price above 200 EMA) and market conditions are favorable. Designed for capital preservation with moderate upside capture.</p>
                    <div class="grid grid-cols-2 gap-2 text-[10px]">
                        <div class="text-gray-500"><span class="text-white font-bold">Entry:</span> EMA 20/50 crossover + 200 EMA trend + volume confirmation</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Exit:</span> 4% stop-loss, 8% take-profit, 2.5% trailing stop</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Best in:</span> Strong trending markets with clear momentum</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Weak in:</span> Choppy sideways markets with frequent whipsaws</div>
                    </div>
                </div>

                {/* Strategy 2 */}
                <div class="bg-[#0a0a12] border border-yellow-500/10 rounded-xl p-5 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-sm font-black text-white">Module 2: Bollinger Mean Reversion Guarded</h4>
                            <span class="text-[10px] text-gray-500">Category: Mean Reversion</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg">MEDIUM RISK</span>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">Enters when price bounces back from the lower Bollinger Band with RSI recovery confirmation. A trend filter prevents entries during strong downtrends. Includes partial exit at the mid-band and full exit at the upper band.</p>
                    <div class="grid grid-cols-2 gap-2 text-[10px]">
                        <div class="text-gray-500"><span class="text-white font-bold">Entry:</span> Bollinger lower band reentry + RSI oversold recovery</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Exit:</span> 3% stop-loss, band-based partial exit</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Best in:</span> Range-bound markets with clear support/resistance</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Weak in:</span> Strong directional trends breaking bands</div>
                    </div>
                </div>

                {/* Strategy 3 */}
                <div class="bg-[#0a0a12] border border-yellow-500/10 rounded-xl p-5 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-sm font-black text-white">Module 3: RSI Reversal Filtered</h4>
                            <span class="text-[10px] text-gray-500">Category: Mean Reversion</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg">MEDIUM RISK</span>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">A safer version of the classic RSI strategy. Never enters on RSI signal alone -- requires MACD histogram improvement or short-term price recovery as confirmation. Includes scale-in logic and consecutive loss auto-pause (3 losses triggers cooldown).</p>
                    <div class="grid grid-cols-2 gap-2 text-[10px]">
                        <div class="text-gray-500"><span class="text-white font-bold">Entry:</span> RSI below 28 then cross above 32 + MACD improving</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Exit:</span> 2.8% stop-loss, 5.5% take-profit</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Best in:</span> Markets with periodic oversold bounces</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Weak in:</span> Persistent downtrend with extended oversold RSI</div>
                    </div>
                </div>

                {/* Strategy 4 */}
                <div class="bg-[#0a0a12] border border-orange-500/10 rounded-xl p-5 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-sm font-black text-white">Module 4: Donchian Breakout Swing</h4>
                            <span class="text-[10px] text-gray-500">Category: Breakout</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg">MEDIUM-HIGH</span>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">Captures strong breakouts above N-period highs with volume confirmation. Only enters long when the market is above the long-term 200 EMA trend. ATR-based dynamic stops provide adaptive risk management that adjusts to current volatility conditions.</p>
                    <div class="grid grid-cols-2 gap-2 text-[10px]">
                        <div class="text-gray-500"><span class="text-white font-bold">Entry:</span> 20-period Donchian high breakout + volume 1.3x + EMA 200</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Exit:</span> 1.8x ATR stop-loss, 2.0x ATR trailing stop</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Best in:</span> Markets transitioning from consolidation to trends</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Weak in:</span> Low-volume consolidation with false breakouts</div>
                    </div>
                </div>

                {/* Strategy 5 */}
                <div class="bg-[#0a0a12] border border-cyan-500/10 rounded-xl p-5 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-sm font-black text-white">Module 5: Multi-Factor Quant Guard</h4>
                            <span class="text-[10px] text-cyan-400 font-bold">FLAGSHIP STRATEGY</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg">MEDIUM RISK</span>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">Vision Chain's flagship strategy combining trend, momentum, volume, and volatility filters. Requires all 6 conditions to confirm before entry, significantly reducing false signals. Features ATR-based dynamic exit management for both stop-loss and profit-taking.</p>
                    <div class="grid grid-cols-2 gap-2 text-[10px]">
                        <div class="text-gray-500"><span class="text-white font-bold">Entry:</span> 200 EMA + EMA cross + RSI 40 + MACD + volume + ATR filter</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Exit:</span> 1.6x ATR stop, 3.0x ATR profit, 2% trailing</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Best in:</span> Clear trend recovery after pullbacks</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Weak in:</span> Rapid reversals without pullback patterns</div>
                    </div>
                </div>

                {/* Strategy 6 */}
                <div class="bg-[#0a0a12] border border-blue-500/10 rounded-xl p-5 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-sm font-black text-white">Module 6: Volatility Target Overlay</h4>
                            <span class="text-[10px] text-gray-500">Category: Risk Overlay</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg">LOW RISK</span>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">Not a signal generator -- this is a protective risk control layer that sits on top of all other strategies. Adjusts position sizes based on realized volatility (20-period window). Enforces drawdown kill switches: 3% daily and 7% weekly loss limits. Applied by default to all active strategies.</p>
                    <div class="grid grid-cols-2 gap-2 text-[10px]">
                        <div class="text-gray-500"><span class="text-white font-bold">Low volatility:</span> 100% position size allowed</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Mid volatility:</span> Reduced to 70% position size</div>
                        <div class="text-gray-500"><span class="text-white font-bold">High volatility:</span> Reduced to 40% position size</div>
                        <div class="text-gray-500"><span class="text-white font-bold">Extreme:</span> All positions paused (0% allocation)</div>
                    </div>
                </div>

                {/* Parameter Configuration */}
                <h3 class="text-lg font-bold text-white mt-8 mb-3">Configuring Strategy Parameters</h3>
                <p class="text-sm text-gray-400 mb-3">Each strategy has tunable parameters organized into 4 groups. You can adjust these when deploying or editing a strategy agent:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Entry Parameters', d: 'Control when a trade is opened: EMA periods, RSI thresholds, Bollinger lengths, Donchian periods. Higher values = fewer but more reliable signals.' },
                        { n: 'Filter Parameters', d: 'Additional confirmation requirements: minimum volume ratio, trend filter EMA, ATR ceiling. These reduce false signals but may miss some opportunities.' },
                        { n: 'Exit Parameters', d: 'Define how trades are closed: stop-loss % or ATR multiple, take-profit target, trailing stop distance. Tighter stops reduce losses but increase the chance of premature exit.' },
                        { n: 'Risk Parameters', d: 'Position sizing and loss limits: maximum position % of portfolio, daily/weekly drawdown kill switches, maximum simultaneous positions, maximum correlated positions.' },
                    ].map(item => (
                        <div class="flex items-start gap-3 px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-bold text-white whitespace-nowrap min-w-[160px]">{item.n}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>

                {/* Agent Deployment */}
                <h3 class="text-lg font-bold text-white mt-8 mb-3">Deploying a Quant Agent</h3>
                <StepList steps={[
                    { title: 'Select a Strategy', desc: 'Tap on any strategy card to view its full details including entry/exit rules, risk parameters, recommended assets, and historical performance.' },
                    { title: 'Choose Target Assets', desc: 'Select which trading pairs to apply the strategy to (e.g., KRW-BTC, KRW-ETH). You can select multiple assets. The recommended assets for each strategy are pre-highlighted.' },
                    { title: 'Tune Parameters', desc: 'Adjust the strategy parameters using the slider controls. Each parameter shows its current value, min/max range, and step size. Default values are optimized for general use.' },
                    { title: 'Review & Deploy', desc: 'Review all settings on the confirmation screen. The agent will start monitoring the market and generating signals based on your configuration. No actual trades are executed without explicit approval.' },
                    { title: 'Monitor Active Agents', desc: 'View all running agents in the Quant dashboard. Each agent shows: current status (active/paused), cumulative P&L, number of signals generated, and last signal time.' },
                ]} />

                <Warning><>Quant strategies involve market risk. Past performance and 30-day average returns shown on strategy cards do not guarantee future results. The Volatility Target Overlay (Module 6) is applied by default to protect against extreme drawdowns. Always start with conservative parameter settings and small position sizes.</></Warning>
            </div>
        );
        case 'cex-security': return (
            <div class="space-y-6">
                <SectionHeader title="Security & IP Whitelist" desc="How your exchange API credentials are protected, the data flow architecture, and best practices for secure API usage." />

                <h3 class="text-lg font-bold text-white mb-3">Data Flow Architecture</h3>
                <p class="text-sm text-gray-400 mb-3">Understanding how your API credentials are handled at each stage:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Step 1: Registration', d: 'When you enter API credentials, they are sent over HTTPS to our Cloud Function endpoint. The Secret Key and Passphrase are immediately encrypted using AES-256 before storage.' },
                        { n: 'Step 2: Storage', d: 'Encrypted credentials are stored in Firebase Firestore under your user account. The encryption key is managed by Google Cloud KMS. Only the Cloud Function service account can decrypt.' },
                        { n: 'Step 3: Sync Request', d: 'When you tap "Sync", the Cloud Function decrypts your credentials server-side, calls the exchange API to fetch balances, and returns only the portfolio data (never the raw credentials) to your browser.' },
                        { n: 'Step 4: Client Display', d: 'Your browser only receives asset data (coin names, balances, prices). The Secret Key is never sent back to the client -- it is shown as partially masked (e.g., ****abcd) in the UI.' },
                    ].map(item => (
                        <div class="flex items-start gap-3 px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-bold text-white whitespace-nowrap min-w-[140px]">{item.n}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-6 mb-3">IP Whitelisting Explained</h3>
                <div class="bg-[#0a0a12] border border-cyan-500/10 rounded-xl p-5 space-y-3">
                    <p class="text-xs text-gray-400 leading-relaxed">IP whitelisting is the most important security measure for API key protection. When you restrict your API key to our server's static IP address, only our server can make API calls using your credentials. Even if someone obtains your API Key and Secret Key, they cannot use them from any other IP address.</p>
                    <p class="text-xs text-gray-400 leading-relaxed">Vision Chain operates from a single static IP address for all exchange API calls. This address is displayed in the "IP Setup Guide" modal (tap the "?" icon on the CEX Portfolio page). The IP is permanent and does not change.</p>
                    <p class="text-xs text-gray-400 leading-relaxed">Some exchanges (like Upbit) require IP whitelisting as mandatory. Others (like Binance) strongly recommend it but allow unrestricted access. We recommend always enabling IP restriction regardless of whether the exchange requires it.</p>
                </div>

                <h3 class="text-lg font-bold text-white mt-6 mb-3">Frequently Asked Questions</h3>
                <div class="space-y-3">
                    {[
                        { q: 'How are my API keys stored?', a: 'API credentials are encrypted using AES-256 and stored in Firebase Firestore. The Secret Key is never displayed in full after initial entry -- it is partially masked with asterisks. The encryption key is managed by Google Cloud KMS and is not accessible to application code.' },
                        { q: 'Can Vision Chain trade on my behalf?', a: 'No. The system only uses read-only API access to fetch balances and ticker prices. It cannot and will not execute any trades, withdrawals, or account changes. We recommend only granting "Read" or "Balance Inquiry" permissions when creating API keys.' },
                        { q: 'What is IP whitelisting?', a: 'Exchanges allow you to restrict API access to specific IP addresses. By whitelisting only our server IP, you ensure that even if someone obtains your API key, they cannot use it from a different server. This is the single most effective security measure.' },
                        { q: 'How do I disconnect an exchange?', a: 'Tap the trash icon next to a connected exchange. A confirmation dialog appears. After confirming, the API credentials are permanently deleted from our server (not recoverable). The exchange-side API key remains valid until you revoke it on the exchange website.' },
                        { q: 'What if my API key expires?', a: 'Some exchanges rotate API keys periodically (e.g., Upbit defaults to 90-day expiration). If sync fails due to an expired key, delete the old connection and add a new one with freshly generated API credentials from the exchange.' },
                        { q: 'Which exchanges need a passphrase?', a: 'Bitget, OKX, KuCoin, and Crypto.com require a passphrase in addition to API Key and Secret Key. This passphrase is set by you during API key creation on the exchange and is stored encrypted alongside the Secret Key.' },
                        { q: 'What happens if Vision Chain servers are compromised?', a: 'Even in the worst case, your API keys only have read-only access. An attacker could see your balance data but cannot move any funds. Additionally, IP whitelisting means your keys cannot be used from any other server.' },
                        { q: 'Can I connect multiple accounts from the same exchange?', a: 'Yes. You can connect multiple API keys from the same exchange (e.g., two Binance accounts). Each connection is independent and can have its own label for identification.' },
                    ].map(item => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <h4 class="text-sm font-bold text-white mb-1">{item.q}</h4>
                            <p class="text-xs text-gray-400 leading-relaxed">{item.a}</p>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-6 mb-3">Security Best Practices Checklist</h3>
                <div class="bg-[#0a0a12] border border-green-500/10 rounded-xl p-5">
                    {[
                        'Always use read-only API keys -- never enable trading or withdrawal permissions',
                        'Whitelist our server IP on every exchange that supports it',
                        'Set API key expiration dates where available (e.g., Upbit allows 90-day rotation)',
                        'Revoke API keys on the exchange website if you stop using the CEX Portfolio feature',
                        'Never share your API keys, Secret Keys, or Passphrases with anyone',
                        'Use a unique API key for Vision Chain -- do not reuse keys used by other services',
                        'Periodically review your connected exchanges and remove any no longer needed',
                        'Enable 2FA/OTP on your exchange account for API key management access',
                    ].map(item => (
                        <div class="flex items-start gap-2 py-1.5">
                            <svg class="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            <span class="text-xs text-gray-400">{item}</span>
                        </div>
                    ))}
                </div>
            </div>
        );

        // ─── Disk ───
        case 'disk-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Vision Disk - Encrypted Cloud Storage" desc="Store, share, and manage files with end-to-end encryption powered by your wallet private key and EIP-2612 gasless payments." />
                <p class="text-sm text-gray-400">Vision Disk encrypts files locally in your browser using AES-GCM with a key derived from your wallet private key. Encrypted data is stored on Vision Cloud, and file metadata is anchored on-chain. Only you can decrypt your files.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'AES-GCM Encryption', d: 'Files are encrypted client-side before upload using AES-256-GCM. The encryption key is derived from your passphrase, so only you can decrypt.' },
                        { t: 'Gasless Payments', d: 'Storage subscriptions use EIP-2612 Permit signatures. You sign a permit, and the Paymaster executes the VCN transfer on-chain without you paying gas.' },
                        { t: 'Drag & Drop Upload', d: 'Drag files directly onto the Disk page or click the upload area to select files. Multiple file upload supported.' },
                        { t: 'File Operations', d: 'Rename, move, delete, publish/unpublish, and download files. Context menu available via right-click or long-press.' },
                        { t: 'AI Memory Storage', d: 'Every file is enriched with AI-compatible metadata: language detection, source type classification, tags, abstracts, and content hashing for deduplication and retrieval.' },
                        { t: 'Model Compatibility', d: 'Files are structured for seamless integration with OpenAI, Gemini, and other AI models. The indexing pipeline extracts text, generates embeddings, and prepares retrieval-ready data.' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
                <Note><>Your wallet must be unlocked (password entered) to upload or download files, since encryption/decryption requires your private key.</></Note>
            </div>
        );
        case 'disk-upload': return (
            <div class="space-y-6">
                <SectionHeader title="Uploading & Downloading Files" desc="Step-by-step guide to uploading encrypted files and downloading them on any device." />
                <Prerequisites items={['Active Disk subscription (or free tier)', 'Wallet unlocked with password', 'Sufficient storage quota remaining']} />
                <h3 class="text-lg font-bold text-white mb-3">Uploading Files</h3>
                <StepList steps={[
                    { title: 'Open Vision Disk', desc: 'From the sidebar menu, tap "Disk". Your file browser loads showing current folder contents.' },
                    { title: 'Drag & Drop or Click Upload', desc: 'Either drag files onto the upload zone (dashed border area) or click the upload area and select files from the file picker. Multiple files can be uploaded at once.' },
                    { title: 'Encryption & Upload Progress', desc: 'Each file is encrypted locally with AES-GCM, then uploaded to Vision Cloud. A progress bar shows the upload status for each file.' },
                    { title: 'Verify Upload', desc: 'Once complete, the file appears in your current folder with its name, size, type icon, and upload timestamp.' },
                ]} />
                <h3 class="text-lg font-bold text-white mt-8 mb-3">Downloading Files</h3>
                <StepList steps={[
                    { title: 'Locate the File', desc: 'Navigate to the folder containing the file you want to download.' },
                    { title: 'Click the Download Button', desc: 'Right-click (or long-press on mobile) and select "Download" from the context menu. Or click the download icon.' },
                    { title: 'Decryption & Download', desc: 'The encrypted file is fetched from Vision Cloud, decrypted locally using your private key, and saved to your device as the original file.' },
                ]} />
                <Tip><>You earn +3 RP for each file upload and +1 RP for each download. Uploads trigger gasless VCN transactions if your subscription includes on-chain metadata anchoring.</></Tip>
            </div>
        );
        case 'disk-folders': return (
            <div class="space-y-6">
                <SectionHeader title="Folder & File Management" desc="Complete guide to organizing files with folders, batch operations, and context menus." />
                <h3 class="text-lg font-bold text-white mb-3">Create Folders</h3>
                <StepList steps={[
                    { title: 'Click "New Folder"', desc: 'Tap the "New Folder" button in the toolbar. A dialog asks for the folder name.' },
                    { title: 'Enter Folder Name', desc: 'Type a name and click "Create". The folder appears in your current directory.' },
                    { title: 'Navigate Into Folder', desc: 'Click on a folder to open it. Breadcrumbs at the top show your current path (e.g., "Home / Documents / Projects").' },
                ]} />
                <h3 class="text-lg font-bold text-white mt-8 mb-3">File Context Menu</h3>
                <p class="text-sm text-gray-400 mb-3">Right-click any file or folder (long-press on mobile) to open the context menu with these options:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Download', d: 'Decrypt and save the file to your device' },
                        { n: 'Rename', d: 'Change the file or folder name' },
                        { n: 'Move', d: 'Move to a different folder (folder picker appears)' },
                        { n: 'Publish', d: 'Make the file publicly accessible via a generated link' },
                        { n: 'Unpublish', d: 'Revoke public access (file becomes private again)' },
                        { n: 'Delete', d: 'Permanently delete the file or folder' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>
                <h3 class="text-lg font-bold text-white mt-8 mb-3">Batch Operations</h3>
                <StepList steps={[
                    { title: 'Select Multiple Files', desc: 'Click the checkbox on each file/folder you want to select. A selection bar appears at the top showing count.' },
                    { title: 'Batch Move', desc: 'Click "Move" to move all selected items to a target folder.' },
                    { title: 'Batch Delete', desc: 'Click "Delete" to permanently remove all selected files. A confirmation dialog appears.' },
                    { title: 'Clear Selection', desc: 'Click "Clear" or tap outside to deselect all items.' },
                ]} />
            </div>
        );
        case 'disk-share': return (
            <div class="space-y-6">
                <SectionHeader title="Sharing & Publishing Files" desc="Share files with specific users or make them publicly accessible. Encrypted files can be shared with passwords automatically delivered to recipients." />
                <h3 class="text-lg font-bold text-white mb-3">Publishing a File (Public Link)</h3>
                <StepList steps={[
                    { title: 'Right-Click the File', desc: 'Open the context menu on the file you want to share.' },
                    { title: 'Select "Publish"', desc: 'The file is marked as public. A globe icon appears next to the filename, and a public URL is generated.' },
                    { title: 'Copy the Public Link', desc: 'The URL is shown in a green info bar. Copy it and share with anyone -- they can download the file without a Vision Chain account.' },
                    { title: 'Unpublish', desc: 'To revoke access, right-click and select "Unpublish". The public link immediately stops working.' },
                ]} />
                <p class="text-sm text-gray-400 mt-4">Published files are indicated by a green globe icon and "Public" badge. The public link format is: <code class="text-cyan-400 text-xs">https://api.visionchain.co/disk/public/[fileId]</code></p>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Sharing with Specific Users</h3>
                <StepList steps={[
                    { title: 'Open Share Modal', desc: 'Right-click a file and select "Share", or click the share icon. The share modal opens showing your contacts.' },
                    { title: 'Search for Recipient', desc: 'Type a name or email to filter contacts. The list shows matching users registered on Vision Chain.' },
                    { title: 'Confirm Sharing', desc: 'Select a contact. A confirmation screen appears showing the file name, recipient name, and email. For encrypted files, a notice warns that the encryption password will be shared with the recipient.' },
                    { title: 'Share Executed', desc: 'Click "Share" to confirm. A success screen shows "sharing complete" with auto-close after 2 seconds. The recipient receives an email and in-app notification.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Encrypted File Sharing</h3>
                <p class="text-sm text-gray-400 mb-3">When sharing an encrypted file, the encryption password is automatically included with the share. The recipient can open the file without needing to know the password separately.</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Password Auto-Delivery', d: 'The encryption password is securely stored in the share record and delivered to the recipient automatically' },
                        { n: 'Auto-Decrypt on Open', d: 'When the recipient opens your shared file from their "Shared with me" tab, the password is applied automatically for decryption' },
                        { n: 'Passkey Integration', d: 'Recipients can save the shared password with biometric authentication (fingerprint/Face ID) for future quick access' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[55%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Viewing Shared Files</h3>
                <p class="text-sm text-gray-400 mb-3">Files shared with you appear in the "Shared" tab of Vision Disk.</p>
                <StepList steps={[
                    { title: 'Open Shared Tab', desc: 'In Vision Disk, switch to the "Shared" tab to see files others have shared with you.' },
                    { title: 'View File Details', desc: 'Each shared file shows the sender\'s name, share date, and file type. Click the eye icon to preview.' },
                    { title: 'Auto-Decryption', desc: 'If the shared file is encrypted and the sender included the password, it automatically decrypts when you open it.' },
                ]} />
                <Warning><>Published files are accessible to anyone with the link. Only publish files you intend to share publicly. For private sharing, use the contact-based sharing method instead.</></Warning>
            </div>
        );
        case 'disk-encryption': return (
            <div class="space-y-6">
                <SectionHeader title="Encryption & Passkey (Biometric)" desc="Vision Disk uses AES-GCM encryption to protect your files. Passkey integration allows you to unlock encrypted files with fingerprint or Face ID instead of typing passwords." />

                <h3 class="text-lg font-bold text-white mb-3">How Encryption Works</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Algorithm', d: 'AES-256-GCM (Advanced Encryption Standard, Galois/Counter Mode)' },
                        { n: 'Key Derivation', d: 'PBKDF2 from your passphrase with random salt (stored in metadata)' },
                        { n: 'Encryption Location', d: 'Client-side only. Files are encrypted in your browser before upload' },
                        { n: 'Password Storage', d: 'Vision Chain does NOT store your encryption password. Only you know it' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[55%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Passkey (Biometric Authentication)</h3>
                <p class="text-sm text-gray-400 mb-3">On devices with fingerprint or Face ID, you can save your encryption password with biometric authentication for quick unlock.</p>
                <StepList steps={[
                    { title: 'Enter Password', desc: 'The first time you access an encrypted file, you enter your encryption password manually in the password modal.' },
                    { title: 'Save with Biometrics', desc: 'After entering the password, a prompt asks: "Save this password with biometrics (fingerprint/Face ID) for quick unlock next time?" Tap "OK" to register.' },
                    { title: 'Biometric Registration', desc: 'Your device prompts for fingerprint or Face ID. Once verified, the password is securely stored on your device using WebAuthn.' },
                    { title: 'Quick Unlock', desc: 'Next time the password modal appears, an "Unlock with Biometrics" button is shown at the top. Tap it and verify with fingerprint/Face ID to instantly unlock.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Devices Without Biometrics</h3>
                <p class="text-sm text-gray-400">Older smartphones without fingerprint or Face ID sensors will not see the biometric option. On these devices, you must enter the encryption password manually each time you access encrypted files. The "Unlock with Biometrics" button only appears on devices that support WebAuthn platform authentication.</p>

                <Tip><>Your passkey is stored locally on your device only. If you switch devices, you will need to enter the password manually once and register a new passkey on the new device.</></Tip>
                <Warning><>If you forget your encryption password and don't have a passkey saved, your encrypted files cannot be recovered. Vision Chain does not have access to your password.</></Warning>
            </div>
        );
        case 'disk-ai-memory': return (
            <div class="space-y-6">
                <SectionHeader title="AI Memory & Indexing" desc="Vision Disk serves as a persistent memory layer for AI. Every uploaded file is enriched with structured metadata, enabling AI models to search, retrieve, and reason over your personal data." />

                <h3 class="text-lg font-bold text-white mb-3">Why Disk as AI Memory?</h3>
                <p class="text-sm text-gray-400 mb-3">Traditional cloud storage stores files as opaque blobs. Vision Disk goes further by treating every file as a structured knowledge unit that AI can understand, index, and retrieve. This enables your chatbot to find documents, answer questions from your files, and share them intelligently.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'Structured Metadata', d: 'Each file has language, source type, tags, abstract, and content hash -- not just a filename and size' },
                        { t: 'AI-Ready Indexing', d: 'Files go through an indexing pipeline that extracts text, generates summaries, and prepares embeddings for vector search' },
                        { t: 'Version Tracking', d: 'Every file version is tracked with content hashing (SHA-256) and parent version linking for change detection' },
                        { t: 'Multi-Model Support', d: 'Data structures are compatible with OpenAI, Gemini, and other AI models for seamless retrieval-augmented generation (RAG)' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">AI Storage Data Structure</h3>
                <p class="text-sm text-gray-400 mb-3">Each file in Vision Disk carries the following AI-specific metadata fields that extend the standard file properties:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-[1fr_1fr_2fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                        <div>Field</div><div>Type</div><div>Description</div>
                    </div>
                    {[
                        { f: 'language', t: 'ISO 639-1', d: 'Detected language (e.g., "ko", "en"). Used for language-specific search and translation.' },
                        { f: 'tags', t: 'string[]', d: 'Auto-generated or user-defined tags for categorization and filtered search.' },
                        { f: 'sourceType', t: 'enum', d: 'File classification: document, image, audio, video, chat_log, code, data, or other.' },
                        { f: 'abstract', t: 'string', d: 'AI-generated summary of document content. Used by chatbot for file search and context.' },
                        { f: 'parsedTextUri', t: 'URI', d: 'Link to extracted plain text from documents (PDF, DOCX, etc.) for full-text search.' },
                        { f: 'transcriptUri', t: 'URI', d: 'Link to auto-generated transcript for audio/video files.' },
                        { f: 'contentHash', t: 'SHA-256', d: 'Hash of raw file content for deduplication and change detection across versions.' },
                        { f: 'version', t: 'number', d: 'File version number. Incremented on each update for version history tracking.' },
                        { f: 'parentVersionId', t: 'string', d: 'Link to previous version for version chain reconstruction.' },
                        { f: 'indexingStatus', t: 'enum', d: 'Pipeline status: none, queued, processing, indexed, or error.' },
                        { f: 'memoryEligibility', t: 'boolean', d: 'Whether this file qualifies as AI memory (e.g., text-based, non-trivial content).' },
                        { f: 'modelCompatibility', t: 'enum', d: 'Target AI model: openai, gemini, or both. Determines embedding format.' },
                    ].map(r => (
                        <div class="grid grid-cols-[1fr_1fr_2fr] gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                            <code class="text-cyan-400 text-xs">{r.f}</code>
                            <span class="text-gray-400 text-xs">{r.t}</span>
                            <span class="text-gray-400 text-xs">{r.d}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Indexing Pipeline</h3>
                <p class="text-sm text-gray-400 mb-3">When a file is uploaded, it enters an indexing pipeline that prepares it for AI retrieval:</p>
                <StepList steps={[
                    { title: 'Upload & Metadata Extraction', desc: 'File is uploaded and basic metadata is extracted: size, type, MIME type. Language is auto-detected from filename and content.' },
                    { title: 'Source Type Classification', desc: 'The file is classified based on MIME type: documents (PDF, DOCX), images (JPG, PNG), audio (MP3, WAV), video (MP4), code files, data files (CSV, JSON), or chat logs.' },
                    { title: 'Text Extraction', desc: 'For documents, text is extracted and stored at parsedTextUri. For audio/video, a transcript is generated at transcriptUri. Images may get OCR text extraction.' },
                    { title: 'Abstract Generation', desc: 'AI generates a brief summary (abstract) of the document content. This is used by the chatbot for file search results.' },
                    { title: 'Tag Auto-Generation', desc: 'AI analyzes content and assigns relevant tags for categorization. Users can also add custom tags.' },
                    { title: 'Content Hashing', desc: 'SHA-256 hash is computed for deduplication. If an identical file already exists, the system links to the existing version.' },
                    { title: 'Memory Eligibility Check', desc: 'Files with extractable text content are marked as memory-eligible, making them available for AI retrieval and chatbot context.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-8 mb-3">How AI Uses Your Files</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Chatbot File Search', d: 'The AI chatbot searches files by name, tags, abstract, and folder to help you find and share documents' },
                        { n: 'Context-Aware Answers', d: 'When indexed, file contents can be referenced by AI to answer questions about your documents' },
                        { n: 'Smart Sharing', d: 'When you ask the chatbot to share a file, it uses metadata (tags, abstract) to find the best match' },
                        { n: 'Version Intelligence', d: 'AI tracks file versions and can identify the latest version of a document automatically' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[55%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>

                <Tip><>Files with sourceType "document", "code", or "data" are automatically marked as memory-eligible. Image and video files become eligible only if text extraction (OCR/transcript) is successful.</></Tip>
                <Note><>The indexing pipeline runs asynchronously after upload. You can check a file's indexing status in its metadata. Most files are indexed within seconds.</></Note>
            </div>
        );
        case 'disk-chatbot': return (
            <div class="space-y-6">
                <SectionHeader title="AI Chat File Sharing" desc="Use the AI chatbot to search your Disk files and share them with other users through natural language commands." />

                <h3 class="text-lg font-bold text-white mb-3">Searching Files via Chat</h3>
                <p class="text-sm text-gray-400 mb-3">You can ask the AI chatbot to find files in your Vision Disk using natural language:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-[1.5fr_2fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                        <div>Command Example</div><div>What Happens</div>
                    </div>
                    {[
                        { cmd: '"Show my disk files"', act: 'Lists all files in your Disk with names, sizes, and types' },
                        { cmd: '"Find the contract file in Documents folder"', act: 'Searches the Documents folder for files matching "contract"' },
                        { cmd: '"What files do I have?"', act: 'Shows a numbered list of your files for selection' },
                    ].map(r => (
                        <div class="grid grid-cols-[1.5fr_2fr] gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                            <code class="text-cyan-400 text-xs">{r.cmd}</code>
                            <span class="text-gray-400 text-xs">{r.act}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Sharing Files via Chat</h3>
                <p class="text-sm text-gray-400 mb-3">After finding a file, you can share it with another user through the chatbot:</p>
                <StepList steps={[
                    { title: 'Request File Sharing', desc: 'Say something like "Share the proposal document with jihyun@email.com" or "Send the contract file to Park Jihyun".' },
                    { title: 'File Search', desc: 'The chatbot searches your Disk for matching files and presents a numbered list if multiple matches are found.' },
                    { title: 'Select File', desc: 'Choose the correct file by number or confirm the single match.' },
                    { title: 'Recipient Confirmation', desc: 'The chatbot confirms the recipient and file, then shows a contact list if the name is ambiguous.' },
                    { title: 'Share Executed', desc: 'The file is shared with the recipient. They receive an in-app notification and email. For encrypted files, the password is included automatically.' },
                ]} />
                <Tip><>The chatbot understands both Korean and English commands. You can mix languages freely, e.g., "Documents 폴더의 계약서 파일을 jihyun에게 공유해줘".</></Tip>
            </div>
        );
        case 'disk-plans': return (
            <div class="space-y-6">
                <SectionHeader title="Storage Subscription Plans" desc="Choose a storage plan paid with VCN tokens via gasless EIP-2612 Permit signatures." />
                <p class="text-sm text-gray-400 mb-3">Vision Disk subscriptions are managed through on-chain VCN payments. The payment flow uses EIP-2612 Permit: you sign an off-chain message authorizing the transfer, and the Paymaster executes the transaction on-chain.</p>
                <StepList steps={[
                    { title: 'View Plans', desc: 'On the Disk page, if you have no subscription, a "Subscribe" section shows available plans.' },
                    { title: 'Select a Plan', desc: 'Browse the available storage tiers. Each shows storage capacity, price in VCN, and features included.' },
                    { title: 'Sign Permit', desc: 'Click "Subscribe". Your wallet prompts you to enter your password to sign an EIP-2612 Permit for the VCN payment amount.' },
                    { title: 'Payment Processing', desc: 'The signed permit is sent to the Paymaster API, which executes the VCN transfer on-chain. No gas fees required from you.' },
                    { title: 'Start Using Disk', desc: 'Once payment is confirmed, your subscription activates immediately and you can start uploading files.' },
                ]} />
                <h3 class="text-lg font-bold text-white mt-6 mb-3">Cancel Subscription</h3>
                <p class="text-sm text-gray-400 mb-3">You can cancel your subscription at any time. Your files remain accessible until the subscription period ends. After expiration, files are retained but you cannot upload new files until you renew.</p>
                <Tip><>Storage plan payments are gasless -- the Paymaster covers all on-chain transaction fees. You only pay the VCN subscription price.</></Tip>
            </div>
        );

        // ─── Nodes ───
        case 'nodes-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Vision Node Overview" desc="Run a Vision Node to support the network, validate transactions, and earn VCN + RP rewards." />
                <p class="text-sm text-gray-400">Vision Chain is a 5-node Proof-of-Authority (PoA) network. You can participate by running a full Validator Node, an Enterprise Node, or a lightweight Mobile Node directly in your browser.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'Validator Node', d: 'Full Geth node participating in IBFT 2.0 consensus. Validates blocks, earns highest VCN rewards. Requires dedicated server hardware (4+ CPU, 8GB+ RAM, 200GB+ SSD).' },
                        { t: 'Enterprise Node', d: 'High-capacity node for enterprise applications. Includes SLA, dedicated support, custom API endpoints, and priority block processing.' },
                        { t: 'Mobile Node (PWA)', d: 'Lightweight browser-based node. Earns +5 RP per day just by staying online. Dashboard shows node status, uptime, peers, and daily earnings. Accessible from the "Nodes" sidebar menu.' },
                        { t: 'Desktop App', d: 'Standalone desktop application for macOS (.dmg) and Windows (.exe). Provides a local node dashboard at http://localhost:9090 with storage, peer, and reward monitoring.' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
                <h3 class="text-lg font-bold text-white mt-6 mb-3">Mobile Node Dashboard</h3>
                <p class="text-sm text-gray-400 mb-3">The Mobile Node page (accessible from sidebar "Nodes") shows:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Node Status', d: 'Active (green pulse) or Offline. Shows uptime counter and last sync timestamp.' },
                        { n: 'Peer Count', d: 'Number of connected peers in the Vision Chain P2P network.' },
                        { n: 'Block Height', d: 'Current block number synced from the network.' },
                        { n: 'Daily RP Earnings', d: '+5 RP per day credited automatically while the Mobile Node tab is active.' },
                        { n: 'Cumulative Stats', d: 'Total uptime hours, total RP earned, and days active since first activation.' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[55%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>
                <Tip><>The Mobile Node earns you passive RP just by keeping the page open. It is the lowest barrier way to contribute to the network and earn rewards.</></Tip>
            </div>
        );
        case 'nodes-purchase': return (
            <div class="space-y-6">
                <SectionHeader title="Purchasing a Node" desc="Step-by-step guide to purchasing Validator or Enterprise node tiers." />
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-4 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Tier</div><div>Price</div><div>Hardware</div><div>Benefits</div></div>
                    {[
                        { t: 'Validator', p: '$10,000 USD', h: '4 CPU, 8GB RAM, 200GB SSD', b: 'Block validation, highest VCN rewards, governance voting' },
                        { t: 'Enterprise', p: '$100,000 USD', h: '8 CPU, 32GB RAM, 1TB SSD', b: 'Enterprise SLA, custom APIs, dedicated support, priority processing' },
                    ].map(r => (
                        <div class="grid grid-cols-4 gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                            <span class="text-white font-medium">{r.t}</span>
                            <span class="text-cyan-400 text-xs font-bold">{r.p}</span>
                            <span class="text-gray-500 text-xs">{r.h}</span>
                            <span class="text-gray-400 text-xs">{r.b}</span>
                        </div>
                    ))}
                </div>
                <StepList steps={[
                    { title: 'Contact Vision Chain Team', desc: 'Node purchases require identity verification and hardware review. Contact the team via support@visionchain.co or through the community channels.' },
                    { title: 'Hardware Setup', desc: 'Prepare your dedicated server according to the minimum specifications for your chosen tier.' },
                    { title: 'Payment & Registration', desc: 'Complete payment via approved methods. Your node address is registered in the validator set by the network administrators.' },
                    { title: 'Node Configuration', desc: 'Receive your genesis.json, static-nodes.json, and node key. Configure your Geth node with IBFT 2.0 consensus settings.' },
                    { title: 'Go Live', desc: 'Start your node and verify it syncs with the network. Monitor peer connections and block production through the node dashboard.' },
                ]} />
                <Note><>Mobile Nodes are free and require no purchase. Simply open the Nodes page in your browser to start earning RP passively.</></Note>
            </div>
        );
        case 'nodes-install': return (
            <div class="space-y-6">
                <SectionHeader title="Installation Guide" desc="Install the Vision Node desktop application or run via CLI on your server." />
                <h3 class="text-lg font-bold text-white mb-3">macOS / Linux (CLI)</h3>
                <StepList steps={[
                    { title: 'Run Install Script', desc: 'Open Terminal and run the following command:' },
                ]} />
                <code class="text-xs text-cyan-400 bg-black/30 rounded-lg px-4 py-3 block font-mono break-all border border-white/5">curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-macos.sh | bash</code>
                <StepList steps={[
                    { title: 'Verify Installation', desc: 'The script installs Geth, configures the Vision Chain genesis block, and starts the node service. Check status with: systemctl status vision-node (Linux) or the process list (macOS).' },
                    { title: 'Access Dashboard', desc: 'Open http://localhost:9090 in your browser to view the node dashboard with status, peers, blocks, and storage metrics.' },
                ]} />
                <h3 class="text-lg font-bold text-white mt-8 mb-3">Desktop App</h3>
                <StepList steps={[
                    { title: 'Download', desc: 'Visit the Vision Node downloads page. Select your platform: macOS (.dmg) or Windows (.exe).' },
                    { title: 'Install', desc: 'macOS: Open the .dmg and drag to Applications. Windows: Run the .exe installer and follow prompts.' },
                    { title: 'Launch', desc: 'Open "Vision Node" from your Applications. The app starts the node and opens the dashboard automatically.' },
                    { title: 'Monitor', desc: 'The desktop app shows node status, peer connections, block height, storage usage, and VCN rewards in a visual dashboard.' },
                ]} />
                <Tip><>After installation, the node dashboard is accessible at http://localhost:9090. RPC endpoint runs on port 8545. WebSocket on port 8546.</></Tip>
            </div>
        );

        // ─── Mint ───
        case 'mint-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Mint Studio" desc="Create and deploy custom ERC-20 tokens on Vision Chain and other supported networks with a no-code wizard." />
                <p class="text-sm text-gray-400">Mint Studio provides a guided interface for deploying tokens without writing any Solidity code. You configure the token parameters, and the system deploys a verified smart contract on your behalf.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'No-Code Deployment', d: 'Fill in a form -- no Solidity or developer tools needed. The contract is deployed and verified automatically.' },
                        { t: 'Multi-Chain Support', d: 'Deploy on Vision Chain (gasless via Paymaster), Ethereum, Polygon, Base, and more.' },
                        { t: 'Token Types', d: 'Standard ERC-20 with configurable properties: mintable, burnable, pausable, capped supply.' },
                        { t: 'Gasless on Vision Chain', d: 'Deployment on Vision Chain uses the Paymaster system, so you only pay VCN deployment fee with no ETH gas required.' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'mint-create': return (
            <div class="space-y-6">
                <SectionHeader title="Creating a Token" desc="Step-by-step guide through the Mint Studio token creation wizard." />
                <Prerequisites items={['VCN balance for deployment fees', 'Wallet unlocked with password', 'Token name and symbol decided']} />
                <StepList steps={[
                    { title: 'Open Mint Studio', desc: 'From the sidebar menu, tap "Mint" to open the Mint Studio page.' },
                    { title: 'Enter Token Name', desc: 'Type your token name (e.g., "My Community Token"). This is the full display name shown on explorers and wallets.' },
                    { title: 'Enter Token Symbol', desc: 'Enter a 3-5 character ticker symbol (e.g., "MCT"). Must be unique and is displayed next to balances.' },
                    { title: 'Set Initial Supply', desc: 'Enter the initial token supply (e.g., 1,000,000). Choose whether the supply is fixed or mintable (owner can create more).' },
                    { title: 'Configure Properties', desc: 'Toggle optional properties: Mintable (owner can mint more), Burnable (holders can burn tokens), Pausable (owner can pause transfers).' },
                    { title: 'Select Target Networks', desc: 'Choose which networks to deploy on. Vision Chain deployment is gasless. Other chains require native gas tokens (ETH, MATIC, etc.).' },
                    { title: 'Review & Deploy', desc: 'Review all settings on the confirmation screen. Click "Deploy" and enter your wallet password to sign the deployment transaction.' },
                    { title: 'Verify Deployment', desc: 'After deployment, the contract address is displayed. You can view it on the block explorer. The token is automatically added to your wallet.' },
                ]} />
                <Note><>Token deployment costs are paid in VCN on Vision Chain. For multi-chain deployment, you need native gas tokens on each target chain. Each network deployment is independent.</></Note>
            </div>
        );

        // ─── Social ───
        case 'contacts-manage': return (
            <div class="space-y-6">
                <SectionHeader title="Contacts Management" desc="Save, edit, and organize frequently used wallet addresses with phonetic search and VNS lookup." />
                <StepList steps={[
                    { title: 'Open Contacts', desc: 'From the sidebar menu, tap "Contacts" to view your address book.' },
                    { title: 'Add New Contact', desc: 'Tap "Add Contact". Fill in: Name (required), Wallet Address (0x...), Email (optional), Phone (optional), and Notes.' },
                    { title: 'Phone Sync', desc: 'Tap "Sync Phone" to import contacts from your device. The system uses phonetic matching to find friends who may already be on Vision Chain.' },
                    { title: 'VNS Lookup', desc: 'Search by Vision Name Service (VNS) to find contacts by their human-readable name (e.g., "alice.vision") instead of a hex address.' },
                    { title: 'Edit a Contact', desc: 'Tap any contact row to open the edit modal. Change any field and tap "Save".' },
                    { title: 'Delete a Contact', desc: 'In the edit modal, tap "Delete Contact". A confirmation dialog appears before permanent deletion.' },
                    { title: 'Use in Send Flow', desc: 'When sending VCN, your contacts appear in the recipient field. Tap a contact name to auto-fill their address -- no manual copy needed.' },
                ]} />
                <h3 class="text-lg font-bold text-white mt-6 mb-3">Phonetic Search</h3>
                <p class="text-sm text-gray-400">The contact search supports cross-language phonetic matching. For example, searching for a Korean name will match the English phonetic equivalent and vice versa. This is especially useful for voice-input scenarios where names may be transcribed differently.</p>
                <Tip><>Saved contacts appear automatically in the send flow, making transfers faster and reducing address errors. Star your most-used contacts for quick access.</></Tip>
            </div>
        );
        case 'referral-program': return (
            <div class="space-y-6">
                <SectionHeader title="Referral Program & Marketing" desc="Complete guide to the referral system -- links, levels, direct/indirect rewards, daily rounds, and the Referral Rush leaderboard." />

                <h3 class="text-lg font-bold text-white mb-3">Your Referral Link & Code</h3>
                <p class="text-sm text-gray-400 mb-3">Each user receives a unique referral code at signup. Your referral link is:</p>
                <code class="text-xs text-cyan-400 bg-black/30 rounded-lg px-4 py-3 block font-mono break-all border border-white/5">https://visionchain.co/signup?ref=YOUR_CODE</code>
                <StepList steps={[
                    { title: 'Find Your Link', desc: 'Open "Referral" from the sidebar. Your unique referral link and code are displayed at the top of the page.' },
                    { title: 'Copy Link', desc: 'Tap the copy icon next to the URL to copy it to clipboard.' },
                    { title: 'Share via Native Share', desc: 'Tap "Share Link" to use your device native share menu (SMS, WhatsApp, Telegram, Email, etc.).' },
                    { title: 'Copy Code Only', desc: 'Your short referral code (e.g., "ABC123") is also shown. Recipients can enter this code during signup instead of using the link.' },
                ]} />

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Referral Level System</h3>
                <p class="text-sm text-gray-400 mb-3">Your referral level is calculated using a triangular number formula: Level L requires L*(L-1)/2 total referrals. This means later levels require progressively more referrals, rewarding sustained effort.</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-3 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Level</div><div>Total Referrals Needed</div><div>New Referrals for This Level</div></div>
                    {[
                        { l: 'Level 1', r: '0', n: '0 (starting level)' },
                        { l: 'Level 2', r: '1', n: '1' },
                        { l: 'Level 5', r: '10', n: '4' },
                        { l: 'Level 10', r: '45', n: '9' },
                        { l: 'Level 20', r: '190', n: '19' },
                        { l: 'Level 50', r: '1,225', n: '49' },
                        { l: 'Level 100 (max)', r: '4,950', n: '99' },
                    ].map(r => (
                        <div class="grid grid-cols-3 gap-4 px-5 py-2.5 border-b border-white/[0.03] text-sm">
                            <span class="text-white font-medium">{r.l}</span>
                            <span class="text-cyan-400 text-xs font-bold">{r.r}</span>
                            <span class="text-gray-400 text-xs">{r.n}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Rank System</h3>
                <p class="text-sm text-gray-400 mb-3">As your level increases, you unlock ranks with visual badges, icons, and gradient colors displayed on your Referral page. Ranks are configured by administrators and can include:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Novice', d: 'Starting rank. Gray badge.' },
                        { n: 'Scout', d: 'Earned early. Blue badge with Users icon.' },
                        { n: 'Warrior', d: 'Mid-level. Green badge with Award icon.' },
                        { n: 'Elite', d: 'Advanced. Purple badge with Star icon.' },
                        { n: 'Champion', d: 'High level. Gold badge with Crown icon.' },
                        { n: 'Legend', d: 'Top ranks. Red-orange badge with Trophy icon.' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Direct & Indirect Referral Activity</h3>
                <p class="text-sm text-gray-400 mb-3">When someone signs up using your referral link, they become your <strong class="text-white">direct referral</strong>. Your Referral page shows a table of all your direct referrals with:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Identity', d: 'Name/email with initials avatar' },
                        { n: 'Contact Info', d: 'Phone and email of the referred user' },
                        { n: 'Status', d: 'Verified (green pulse) or Pending (yellow). Verified means wallet created.' },
                        { n: 'Rewards Generated', d: 'Total VCN rewards attributed to this referral' },
                        { n: 'Join Date', d: 'When the referred user signed up' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">Referral Rush (Daily Rounds)</h3>
                <p class="text-sm text-gray-400 mb-3">Vision Chain runs a "Referral Rush" competition with 24-hour daily rounds. Each round has a reward pool of 1,000 VCN distributed based on contribution rate:</p>
                <StepList steps={[
                    { title: 'Rounds Start Daily at 00:00 UTC', desc: 'A new round begins automatically every day. The round number increments from the epoch date (Feb 9, 2026).' },
                    { title: 'Invite During the Round', desc: 'Each referral you bring during a round counts toward your contribution rate for that round.' },
                    { title: 'Contribution Rate = Your Invites / Total Invites', desc: 'Your share of the reward pool is proportional to your contribution. e.g., 10 invites out of 50 total = 20% = 200 VCN.' },
                    { title: 'Check Leaderboard', desc: 'The leaderboard shows all participants ranked by invite count, with estimated rewards.' },
                    { title: 'Claim After Round Ends', desc: 'Once a round completes (24 hours), rewards are finalized and can be claimed.' },
                ]} />
                <Tip><>Each referral also earns you +10 RP instantly and contributes to your Level. Every 10th level milestone (Level 10, 20, 30...) earns a bonus +100 RP.</></Tip>
                <Warning><>Referral link integrity is tracked via security measures. Fraudulent or self-referral activity may be detected and result in rewards being revoked.</></Warning>
            </div>
        );
        case 'quest-campaign': return (
            <div class="space-y-6">
                <SectionHeader title="Reward Points (RP) System" desc="Complete guide to earning, tracking, and spending Reward Points across all Vision Chain activities." />
                <p class="text-sm text-gray-400 mb-3">Reward Points (RP) are earned by performing various actions within the Vision Chain ecosystem. RP values are admin-configurable and may change. The current default values are shown below.</p>

                <h3 class="text-lg font-bold text-amber-400 mb-3">User Action RP Rewards</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-3 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Action</div><div>RP Amount</div><div>Details</div></div>
                    {[
                        { a: 'Referral Signup', rp: '+10 RP', d: 'Each time someone signs up using your referral link' },
                        { a: 'Level Up Bonus', rp: '+100 RP', d: 'Every 10th level milestone (Level 10, 20, 30... up to 100)' },
                        { a: 'Daily Login', rp: '+5 RP', d: 'Login once per day (KST timezone, de-duplicated)' },
                        { a: 'Mobile Node', rp: '+5 RP', d: 'Keep Mobile Node page active per day' },
                        { a: 'Agent Create', rp: '+15 RP', d: 'Create your first AI agent' },
                        { a: 'Staking Deposit', rp: '+10 RP', d: 'Each time you stake VCN' },
                        { a: 'Market Purchase', rp: '+10 RP', d: 'Purchase an item on the marketplace' },
                        { a: 'Market Publish', rp: '+5 RP', d: 'Publish an item to the marketplace' },
                        { a: 'Transfer Send', rp: '+3 RP', d: 'Send VCN to another wallet' },
                        { a: 'Disk Upload', rp: '+3 RP', d: 'Upload a file to Vision Disk' },
                        { a: 'Profile Update', rp: '+2 RP', d: 'Update your profile (name, photo, etc.)' },
                        { a: 'AI Chat', rp: '+1 RP', d: 'Send a message to the AI chatbot' },
                        { a: 'Disk Download', rp: '+1 RP', d: 'Download a file from Vision Disk' },
                    ].map(r => (
                        <div class="grid grid-cols-3 gap-4 px-5 py-2.5 border-b border-white/[0.03] text-sm">
                            <span class="text-white font-medium text-xs">{r.a}</span>
                            <span class="text-amber-400 text-xs font-bold">{r.rp}</span>
                            <span class="text-gray-400 text-[11px]">{r.d}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-cyan-400 mt-8 mb-3">Agent API Action RP Rewards</h3>
                <p class="text-sm text-gray-400 mb-3">When AI agents perform on-chain actions via the Agent API, both the agent owner and related parties earn RP:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { a: 'Agent Referral (Inviter)', rp: '+50 RP', d: 'Agent invites someone and they sign up' },
                        { a: 'Agent NFT Mint', rp: '+30 RP', d: 'Agent mints an NFT on-chain' },
                        { a: 'Agent Referral (Invitee)', rp: '+25 RP', d: 'Being invited by an agent' },
                        { a: 'Agent Staking (Deposit)', rp: '+20 RP', d: 'Agent stakes VCN automatically' },
                        { a: 'Agent Staking (Compound)', rp: '+25 RP', d: 'Agent auto-compounds staking rewards' },
                        { a: 'Agent Bridge', rp: '+15 RP', d: 'Agent initiates a cross-chain bridge transfer' },
                        { a: 'Agent Staking (Claim/Withdraw)', rp: '+10 RP', d: 'Agent claims rewards or withdraws stake' },
                        { a: 'Agent Transfer (Send/Batch)', rp: '+5 RP', d: 'Agent sends VCN to an address' },
                        { a: 'Agent Unstake', rp: '+5 RP', d: 'Agent requests unstake' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.a}</span>
                            <div class="text-right">
                                <span class="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">{item.rp}</span>
                                <span class="text-xs text-gray-500 ml-2">{item.d}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">RP Dashboard</h3>
                <p class="text-sm text-gray-400 mb-3">Your RP summary is shown on the Referral page in three cards:</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Total Earned', d: 'Cumulative RP earned across all actions since account creation.' },
                        { n: 'Available', d: 'RP that can be claimed/converted to VCN (totalRP - claimedRP).' },
                        { n: 'Claimed', d: 'RP already converted to VCN tokens.' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-400 max-w-[60%] text-right">{item.d}</span>
                        </div>
                    ))}
                </div>

                <h3 class="text-lg font-bold text-white mt-8 mb-3">RP History</h3>
                <p class="text-sm text-gray-400 mb-3">Below the RP summary, a detailed activity log shows your recent 20 RP events with:</p>
                <StepList steps={[
                    { title: 'Event Icon', desc: 'Amber icon for referral RP, purple icon for level-up bonuses.' },
                    { title: 'Event Type', desc: 'Shows "Referral Bonus" or "Level-up Bonus" with the source (e.g., referred user email or "Reached LVL 10").' },
                    { title: 'RP Amount', desc: 'The RP earned for this event (e.g., +10 RP, +100 RP).' },
                    { title: 'Date', desc: 'When the RP was earned.' },
                ]} />
                <Note><>RP amounts are configured by administrators and may change. The values shown in this guide reflect current defaults. Check the Referral page for the most up-to-date values.</></Note>
            </div>
        );

        // ─── Settings ───
        case 'settings-profile': return (
            <div class="space-y-6">
                <SectionHeader title="Profile Management" desc="Update your display name, email, and profile picture." />
                <StepList steps={[
                    { title: 'Open Settings', desc: 'Navigate to "Settings" from the sidebar menu.' },
                    { title: 'Edit Profile', desc: 'Tap your profile section to update display name and profile picture.' },
                    { title: 'Change Password', desc: 'Tap "Change Password" to update your login password. You will need your current password.' },
                    { title: 'Save Changes', desc: 'All changes are saved automatically when you navigate away.' },
                ]} />
            </div>
        );
        case 'settings-2fa': return (
            <div class="space-y-6">
                <SectionHeader title="2FA Setup (Two-Factor Authentication)" desc="Add an extra layer of security with TOTP-based two-factor authentication." />
                <Prerequisites items={['An authenticator app (Google Authenticator, Authy, etc.)']} />
                <StepList steps={[
                    { title: 'Open Security Settings', desc: 'Navigate to Settings > Security > Two-Factor Authentication.' },
                    { title: 'Scan QR Code', desc: 'Open your authenticator app and scan the displayed QR code.' },
                    { title: 'Enter Verification Code', desc: 'Type the 6-digit code from your authenticator to verify setup.' },
                    { title: 'Save Backup Codes', desc: 'Store the backup recovery codes securely in case you lose your authenticator device.' },
                ]} />
                <Warning><>Once enabled, 2FA is required for login and large transactions. If you lose access to your authenticator, use backup codes to recover. Store backup codes securely offline.</></Warning>
                <Note><>Transactions above a certain threshold will automatically require 2FA verification for additional security.</></Note>
            </div>
        );
        case 'settings-backup': return (
            <div class="space-y-6">
                <SectionHeader title="Wallet Backup & Restore" desc="Backup your wallet using seed phrase or cloud sync, and restore on a new device." />
                <div class="space-y-4">
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <h4 class="text-sm font-bold text-white mb-2">Seed Phrase Backup</h4>
                        <p class="text-xs text-gray-400">Your 12-word seed phrase is the master key to your wallet. Write it down on paper and store in a safe location. Never store it digitally or take screenshots.</p>
                    </div>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <h4 class="text-sm font-bold text-white mb-2">Cloud Sync</h4>
                        <p class="text-xs text-gray-400">Enable Cloud Sync to back up your encrypted wallet to Vision Cloud. Your wallet is encrypted with your password before upload. Useful for seamless access across devices.</p>
                    </div>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <h4 class="text-sm font-bold text-white mb-2">Restore Wallet</h4>
                        <p class="text-xs text-gray-400">To restore your wallet on a new device, enter your 12-word seed phrase or log in with Cloud Sync enabled. Your balances and transaction history will be recovered automatically.</p>
                    </div>
                </div>
                <Warning><>Never share your seed phrase. Vision Chain support will never ask for it. Anyone with your seed phrase can access your funds.</></Warning>
            </div>
        );
        case 'settings-language': return (
            <div class="space-y-6">
                <SectionHeader title="Language Settings" desc="Switch the app language between Korean and English." />
                <StepList steps={[
                    { title: 'Open Settings', desc: 'Navigate to "Settings" from the sidebar menu.' },
                    { title: 'Select Language', desc: 'Tap "Language" and choose between Korean or English.' },
                    { title: 'Auto-Apply', desc: 'The interface updates immediately. AI Chat will also respond in your selected language.' },
                ]} />
                <Tip><>The AI Chat supports both Korean and English regardless of your language setting. You can type in either language and the AI will respond accordingly.</></Tip>
            </div>
        );
        case 'settings-notifications': return (
            <div class="space-y-6">
                <SectionHeader title="Notification Settings" desc="Configure in-app and email notification preferences." />
                <p class="text-sm text-gray-400">Manage which notifications you receive and how they are delivered. In-app notifications show as badges on the bell icon. Email notifications can be enabled for important events like large transactions and security alerts.</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Transaction Alerts', d: 'Notified when tokens are sent or received' },
                        { n: 'Security Alerts', d: 'Login from new device, password changes' },
                        { n: 'Staking Updates', d: 'Reward claims, unstake completions' },
                        { n: 'Campaign Notifications', d: 'New quests, referral signups' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-500">{item.d}</span>
                        </div>
                    ))}
                </div>
            </div>
        );

        // ─── FAQ ───
        case 'faq-login': return (
            <div class="space-y-6">
                <SectionHeader title="Login Issues" desc="Troubleshooting common login problems." />
                <div class="space-y-3">
                    {[
                        { q: 'Forgot password?', a: 'Use the "Reset Password" link on the login page. A reset email will be sent to your registered email address.' },
                        { q: 'Email not verified?', a: 'Check your spam folder for the verification email. You can request a new one from the login page.' },
                        { q: '2FA code not working?', a: 'Ensure your authenticator app time is synced. If locked out, use your backup recovery codes.' },
                        { q: 'Account locked?', a: 'After multiple failed login attempts, your account may be temporarily locked. Wait 15 minutes or contact support.' },
                    ].map(item => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <h4 class="text-sm font-bold text-white mb-1">{item.q}</h4>
                            <p class="text-xs text-gray-400">{item.a}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'faq-tx': return (
            <div class="space-y-6">
                <SectionHeader title="Transaction Failures" desc="Common transaction issues and how to resolve them." />
                <div class="space-y-3">
                    {[
                        { q: 'Insufficient balance', a: 'Ensure you have enough tokens for the transfer amount. VCN transactions are gasless, but ETH may be needed for other chains.' },
                        { q: 'Transaction pending too long', a: 'Vision Chain transactions confirm within seconds. If stuck, check the blockchain explorer for status.' },
                        { q: 'Wrong recipient address', a: 'Blockchain transactions are irreversible. Always double-check addresses. Use contacts to avoid manual entry errors.' },
                        { q: 'Wallet password incorrect', a: 'Your wallet password is separate from your login password. If forgotten, you can restore your wallet using your seed phrase.' },
                    ].map(item => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <h4 class="text-sm font-bold text-white mb-1">{item.q}</h4>
                            <p class="text-xs text-gray-400">{item.a}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'faq-bridge': return (
            <div class="space-y-6">
                <SectionHeader title="Bridge Issues" desc="Troubleshooting cross-chain bridge problems." />
                <div class="space-y-3">
                    {[
                        { q: 'Bridge transfer stuck?', a: 'Bridge transfers typically complete within 2-5 minutes. If stuck for over 30 minutes, contact support with your transaction hash.' },
                        { q: 'Tokens not received?', a: 'Check the destination chain in your wallet. Bridged tokens may appear after a few minutes due to block confirmations.' },
                        { q: 'Bridge fee too high?', a: 'Bridge fees include Ethereum gas costs. Try during off-peak hours when gas prices are lower.' },
                    ].map(item => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <h4 class="text-sm font-bold text-white mb-1">{item.q}</h4>
                            <p class="text-xs text-gray-400">{item.a}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'faq-contact': return (
            <div class="space-y-6">
                <SectionHeader title="Contact Support" desc="Get help from the Vision Chain support team." />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'AI Chat', d: 'Ask Vision AI for help directly in the wallet chat. It can resolve most common issues instantly.' },
                        { t: 'Email', d: 'Contact support@visionchain.co for account and technical issues.' },
                        { t: 'Community', d: 'Join the Vision Chain community channels for peer support and discussions.' },
                        { t: 'Developer Hub', d: 'For API and integration questions, visit the Developer Hub documentation.' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
            </div>
        );

        // ─── Feedback & Reports ───
        case 'feedback-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Feedback System" desc="Vision AI now features an intelligent feedback system that channels your voice directly into product improvement. Report bugs, suggest features, or submit business proposals through natural conversation." />
                <FeedbackDiagram />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'Bug Reports', d: 'Describe issues you encounter and AI automatically classifies severity and routes to the development team' },
                        { t: 'Feature Suggestions', d: 'Share improvement ideas. Similar requests from multiple users are grouped and prioritized automatically' },
                        { t: 'Business Proposals', d: 'Submit partnership, listing, or collaboration proposals directly through the chatbot' },
                        { t: 'Auto-Classification', d: 'AI detects, categorizes, and prioritizes all feedback using the Vision Product Intelligence System (VPIS)' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">How It Works</h3>
                    <StepList steps={[
                        { title: 'Auto-Detection', desc: 'AI automatically detects bug reports, feature requests, and business proposals from your conversation.' },
                        { title: 'Structuring', desc: 'Detected content is organized by category, severity, and related features.' },
                        { title: 'Grouping', desc: 'Similar requests from multiple users are clustered to identify patterns and demand.' },
                        { title: 'Prioritization', desc: 'Frequency, impact, and urgency are combined to determine priority rankings.' },
                        { title: 'Team Review', desc: 'The operations team reviews classified items and takes appropriate action.' },
                    ]} />
                </div>
                <Tip><>No special form or command is needed. Simply talk to the chatbot as you normally would, and the AI will automatically detect and process your feedback.</></Tip>
            </div>
        );
        case 'feedback-bugs': return (
            <div class="space-y-6">
                <SectionHeader title="Bug Reports" desc="Report issues you encounter while using Vision Chain. The AI automatically classifies the problem, assesses severity, and routes it to the development team." />
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Example Conversations</h3>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                        <div class="grid grid-cols-[1.5fr_2fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                            <div>You Say</div><div>AI Detects</div>
                        </div>
                        {[
                            { cmd: '"The send button doesn\'t respond when I click it"', act: 'UI bug, Send feature, severity: High' },
                            { cmd: '"Tokens haven\'t arrived after bridge transfer. 3 hours now"', act: 'Bridge issue, pending transaction, severity: Critical' },
                            { cmd: '"Portfolio page shows my balance as 0"', act: 'Display bug, Assets feature, severity: High' },
                            { cmd: '"The app freezes when I open transaction history"', act: 'Performance bug, History feature, severity: Medium' },
                            { cmd: '"Staking rewards show wrong APY percentage"', act: 'Data bug, Staking feature, severity: Medium' },
                        ].map(r => (
                            <div class="grid grid-cols-[1.5fr_2fr] gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                                <code class="text-cyan-400 text-xs">{r.cmd}</code>
                                <span class="text-gray-400 text-xs">{r.act}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">What AI Collects</h3>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                        {[
                            { n: 'Context', d: 'Which feature and action triggered the issue' },
                            { n: 'Expected vs Actual', d: 'What should have happened vs what actually occurred' },
                            { n: 'Severity', d: 'Automatically assessed as Critical, High, Medium, or Low' },
                            { n: 'Feature Tags', d: 'Related features are automatically tagged (e.g., wallet, bridge, staking)' },
                        ].map(item => (
                            <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                                <span class="text-sm font-medium text-white">{item.n}</span>
                                <span class="text-xs text-gray-500">{item.d}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <Note><>Bug reports are reviewed within 0-48 hours depending on severity. Critical issues are escalated immediately to the development team.</></Note>
            </div>
        );
        case 'feedback-features': return (
            <div class="space-y-6">
                <SectionHeader title="Feature Suggestions" desc="Share your ideas for new features or improvements. Similar requests from multiple users are automatically grouped, and the most requested features are reviewed first." />
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Example Conversations</h3>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                        <div class="grid grid-cols-[1.5fr_2fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                            <div>You Say</div><div>AI Categorizes As</div>
                        </div>
                        {[
                            { cmd: '"Chart colors are hard to see in dark mode"', act: 'UX improvement, UI/Portfolio, priority by frequency' },
                            { cmd: '"Add recurring schedule option for transfers"', act: 'Feature request, Send/Receive, linked to TimeLock' },
                            { cmd: '"Let me download staking rewards as CSV"', act: 'Feature request, Staking/Reporting, data export' },
                            { cmd: '"QR code scanning for quick mobile transfers"', act: 'Feature request, Send/Receive, mobile UX' },
                            { cmd: '"Add price alerts for my watched tokens"', act: 'Feature request, Notifications, market data' },
                        ].map(r => (
                            <div class="grid grid-cols-[1.5fr_2fr] gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                                <code class="text-cyan-400 text-xs">{r.cmd}</code>
                                <span class="text-gray-400 text-xs">{r.act}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Processing Pipeline</h3>
                    <StepList steps={[
                        { title: 'AI Structures Your Request', desc: 'The AI normalizes and categorizes your suggestion with relevant tags and feature associations.' },
                        { title: 'Automatic Grouping', desc: 'Similar requests from different users are clustered together to measure demand.' },
                        { title: 'Priority Scoring', desc: 'Each request receives a priority score based on frequency, business impact, and urgency.' },
                        { title: 'Roadmap Review', desc: 'The operations team reviews high-priority items weekly and determines roadmap inclusion.' },
                    ]} />
                </div>
                <Tip><>The more specific your suggestion, the faster it can be evaluated. Include details about what problem it would solve and how you envision it working.</></Tip>
            </div>
        );
        case 'feedback-business': return (
            <div class="space-y-6">
                <SectionHeader title="Business Proposals" desc="Submit partnership, listing, collaboration, or marketing proposals directly through the chatbot." />
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Example Conversations</h3>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                        {[
                            { cmd: '"We\'d like to discuss listing VCN on our exchange"', act: 'Exchange listing inquiry, routed to business team' },
                            { cmd: '"Interested in DeFi protocol integration partnership"', act: 'Technical partnership, routed to dev relations' },
                            { cmd: '"Propose co-hosting a booth at blockchain conference"', act: 'Marketing collaboration, routed to marketing team' },
                            { cmd: '"Want to run a joint community event"', act: 'Community partnership, routed to community team' },
                            { cmd: '"Our fund is interested in VCN token investment"', act: 'Investment inquiry, routed to business development' },
                        ].map(r => (
                            <div class="flex items-start gap-4 px-5 py-3 border-b border-white/[0.03]">
                                <code class="text-cyan-400 text-xs flex-1">{r.cmd}</code>
                                <span class="text-gray-400 text-xs flex-1">{r.act}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">Response Timeline</div>
                    {[
                        { n: 'Initial Acknowledgment', d: 'Immediate AI confirmation that your proposal has been received' },
                        { n: 'Team Review', d: '3-5 business days for a team member to review your proposal' },
                        { n: 'Follow-up Contact', d: 'If applicable, a team representative will reach out via your provided contact info' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.n}</span>
                            <span class="text-xs text-gray-500">{item.d}</span>
                        </div>
                    ))}
                </div>
                <Tip><>Include your contact information (email or messaging handle) in your proposal for a direct follow-up from the relevant team.</></Tip>
            </div>
        );
        case 'feedback-tips': return (
            <div class="space-y-6">
                <SectionHeader title="Tips for Effective Feedback" desc="Get the most out of the feedback system by following these best practices." />
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { n: 'Be Specific', d: '"Send button loading forever after click" is better than "it doesn\'t work"' },
                        { n: 'Provide Context', d: 'Mention which page, what action you were performing, and when the issue occurred' },
                        { n: 'Describe Expected Result', d: 'Frame as "When I did X, I expected Y, but Z happened" for clarity' },
                        { n: 'Mention Frequency', d: 'Indicate if the issue happens every time, intermittently, or was a one-time occurrence' },
                        { n: 'Include Device Info', d: 'Mention if you are on mobile or desktop, and which browser you are using' },
                    ].map(item => (
                        <div class="flex items-start gap-4 px-5 py-4 border-b border-white/[0.03]">
                            <span class="text-sm font-bold text-cyan-400 w-40 flex-shrink-0">{item.n}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">FAQ</h3>
                    <div class="space-y-3">
                        {[
                            { q: 'Do I need a special command to submit feedback?', a: 'No. Simply talk to the chatbot naturally. The AI automatically detects and processes bug reports, feature requests, and proposals.' },
                            { q: 'How do I know my feedback was received?', a: 'The AI sends a confirmation message when it detects actionable feedback in your conversation.' },
                            { q: 'Is my personal information collected?', a: 'Personal identifiers (email, phone, wallet address) are automatically masked during analysis. Only the technical context needed for resolution is retained.' },
                            { q: 'Can I submit feedback in Korean?', a: 'Yes. The system supports both Korean and English. Use whichever language is more comfortable for you.' },
                        ].map(faq => (
                            <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-4">
                                <div class="text-sm font-bold text-white mb-1">{faq.q}</div>
                                <div class="text-xs text-gray-500">{faq.a}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );

        // ─── Default fallback ───
        default: {
            const allChildren = sections.flatMap(s => s.children);
            const child = allChildren.find(c => c.id === id);
            const parent = sections.find(s => s.children.some(c => c.id === id));
            return (
                <div class="space-y-6">
                    <SectionHeader title={child?.title || id} desc={`This section is part of "${parent?.title || 'Unknown'}". Content is being prepared.`} />
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-8 text-center">
                        <div class="text-gray-500 text-sm">This guide section is coming soon.</div>
                        <div class="text-gray-600 text-xs mt-2">Check back for updates or contact support for assistance.</div>
                    </div>
                </div>
            );
        }
    }
}

// ─── Main Component ───
export default function UserManual(): JSX.Element {
    const [active, setActive] = createSignal('gs-overview');
    const [query, setQuery] = createSignal('');
    const [mobileOpen, setMobileOpen] = createSignal(false);
    const [expanded, setExpanded] = createSignal<Record<string, boolean>>({ 'getting-started': true });

    const toggleSection = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const navigate = (id: string) => {
        setActive(id);
        setMobileOpen(false);
        // Auto-expand parent section
        const parent = sections.find(s => s.children.some(c => c.id === id));
        if (parent) setExpanded(prev => ({ ...prev, [parent.id]: true }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const filteredSections = createMemo(() => {
        const q = query().toLowerCase();
        if (!q) return sections;
        return sections.map(s => ({
            ...s,
            children: s.children.filter(c => c.title.toLowerCase().includes(q) || s.title.toLowerCase().includes(q))
        })).filter(s => s.children.length > 0);
    });

    // Current section title
    const currentTitle = createMemo(() => {
        for (const s of sections) {
            const child = s.children.find(c => c.id === active());
            if (child) return `${s.title} / ${child.title}`;
        }
        return 'User Manual';
    });

    // ─── Sidebar ───
    const Sidebar = () => (
        <div class="flex flex-col h-full">
            {/* Header */}
            <div class="px-5 py-6 border-b border-white/[0.06]">
                <A href="/" class="flex items-center gap-2 text-white hover:text-cyan-400 transition-colors mb-4">
                    <I d="arrow" c="w-4 h-4 inline-block" />
                    <span class="text-xs font-bold uppercase tracking-widest">Back to Home</span>
                </A>
                <h1 class="text-xl font-black text-white tracking-tight">User Manual</h1>
                <p class="text-[11px] text-gray-500 mt-1">Vision Chain Wallet Guide</p>
            </div>

            {/* Search */}
            <div class="px-4 py-3 border-b border-white/[0.06]">
                <div class="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-2">
                    <I d="search" c="w-3.5 h-3.5 inline-block text-gray-500 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={query()}
                        onInput={(e) => setQuery(e.currentTarget.value)}
                        class="bg-transparent text-sm text-white placeholder:text-gray-600 outline-none w-full"
                    />
                </div>
            </div>

            {/* Navigation */}
            <div class="flex-1 overflow-y-auto py-2">
                <For each={filteredSections()}>
                    {(section) => (
                        <div>
                            <button
                                onClick={() => toggleSection(section.id)}
                                class="w-full flex items-center justify-between px-5 py-2.5 text-left hover:bg-white/[0.03] transition-colors group"
                            >
                                <div class="flex items-center gap-2.5">
                                    <span class="w-5 h-5 rounded bg-white/[0.06] text-[9px] font-black text-gray-400 flex items-center justify-center">{section.icon}</span>
                                    <span class="text-[13px] font-semibold text-gray-300 group-hover:text-white transition-colors">{section.title}</span>
                                </div>
                                <I d={expanded()[section.id] ? 'chevDown' : 'chevRight'} c="w-3 h-3 inline-block text-gray-600" />
                            </button>
                            <Show when={expanded()[section.id]}>
                                <div class="ml-7 border-l border-white/[0.06]">
                                    <For each={section.children}>
                                        {(child) => (
                                            <button
                                                onClick={() => navigate(child.id)}
                                                class={`w-full text-left px-4 py-2 text-[12px] transition-colors block ${active() === child.id
                                                    ? 'text-cyan-400 bg-cyan-500/5 border-l-2 border-cyan-400 -ml-px font-semibold'
                                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                                                    }`}
                                            >
                                                {child.title}
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );

    return (
        <div class="min-h-screen bg-[#050505] text-white flex">
            {/* Desktop Sidebar */}
            <div class="hidden lg:flex w-72 flex-shrink-0 border-r border-white/[0.06] bg-[#0a0a0c] fixed top-0 left-0 bottom-0 z-40">
                <Sidebar />
            </div>

            {/* Mobile Header */}
            <div class="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-[#0a0a0c]/95 backdrop-blur-md border-b border-white/[0.06] flex items-center justify-between px-4">
                <button onClick={() => setMobileOpen(!mobileOpen())} class="p-2 text-gray-400 hover:text-white">
                    <I d={mobileOpen() ? 'x' : 'menu'} c="w-5 h-5 inline-block" />
                </button>
                <span class="text-xs font-bold text-gray-300 truncate max-w-[60%]">{currentTitle()}</span>
                <A href="/" class="p-2 text-gray-400 hover:text-white"><I d="arrow" c="w-4 h-4 inline-block" /></A>
            </div>

            {/* Mobile Sidebar Overlay */}
            <Show when={mobileOpen()}>
                <div class="lg:hidden fixed inset-0 z-40">
                    <div class="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
                    <div class="absolute left-0 top-0 bottom-0 w-72 bg-[#0a0a0c] border-r border-white/[0.06] overflow-y-auto pt-14">
                        <Sidebar />
                    </div>
                </div>
            </Show>

            {/* Content */}
            <div class="flex-1 lg:ml-72">
                <div class="max-w-3xl mx-auto px-6 py-12 lg:py-16 pt-20 lg:pt-16">
                    {/* Breadcrumb */}
                    <div class="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-8">
                        {currentTitle()}
                    </div>

                    {/* Content */}
                    {getContent(active(), navigate)}

                    {/* Footer nav */}
                    <div class="mt-16 pt-8 border-t border-white/[0.06] flex items-center justify-between">
                        <A href="/" class="text-xs text-gray-500 hover:text-white transition-colors">
                            <I d="arrow" c="w-3 h-3 inline-block mr-1" /> Back to Home
                        </A>
                        <span class="text-[10px] text-gray-700">Vision Chain User Manual v1.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
