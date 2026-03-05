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
            { id: 'cex-portfolio', title: 'Portfolio Overview' },
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
];

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
                <SectionHeader title="Staking Overview" desc="Stake VCN tokens to earn rewards and participate in network validation." />
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { n: 'Earn Rewards', d: 'Receive VCN rewards proportional to your stake' },
                        { n: 'Secure Network', d: 'Your stake helps secure the Vision Chain network' },
                        { n: 'Flexible Plans', d: 'Choose from various staking durations and APY rates' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.n}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'staking-how': return (
            <div class="space-y-6">
                <SectionHeader title="How to Stake VCN" desc="Step-by-step guide to staking your VCN tokens." />
                <Prerequisites items={['VCN tokens in your wallet', 'Wallet password set up']} />
                <StepList steps={[
                    { title: 'Navigate to Staking', desc: 'Open "Earn" from the sidebar menu.' },
                    { title: 'Choose Amount', desc: 'Enter the amount of VCN you want to stake. Minimum stake requirements are displayed.' },
                    { title: 'Select Duration', desc: 'Choose a staking plan. Longer durations offer higher APY rates.' },
                    { title: 'Confirm Stake', desc: 'Review the terms and confirm. Enter your wallet password to sign.' },
                    { title: 'Start Earning', desc: 'Rewards begin accumulating immediately. View them in the staking dashboard.' },
                ]} />
                <Note><>Staked tokens are locked for the selected duration. You can unstake early, but a cooldown period of 7 days applies before withdrawal.</></Note>
            </div>
        );
        case 'staking-rewards': return (
            <div class="space-y-6">
                <SectionHeader title="Rewards & Unstaking" desc="Claim your staking rewards and manage unstaking." />
                <StepList steps={[
                    { title: 'View Rewards', desc: 'The staking dashboard shows your pending (unclaimed) rewards in real-time.' },
                    { title: 'Claim Rewards', desc: 'Tap "Claim" to transfer pending rewards to your wallet balance.' },
                    { title: 'Compound (Optional)', desc: 'Use "Compound" to automatically re-stake your claimed rewards for higher returns.' },
                    { title: 'Unstake', desc: 'Tap "Unstake" to begin the withdrawal process. A 7-day cooldown period starts.' },
                    { title: 'Withdraw', desc: 'After the cooldown, tap "Withdraw" to return your tokens to your wallet.' },
                ]} />
                <Warning><>Unstaking initiates a 7-day cooldown. Your tokens remain locked during this period and do not earn rewards.</></Warning>
            </div>
        );

        // ─── Agent ───
        case 'agent-overview': return (
            <div class="space-y-6">
                <SectionHeader title="What is Agent Hosting?" desc="AI Agent Hosting lets you create autonomous agents that perform on-chain actions on your behalf." />
                <p class="text-sm text-gray-400">Agents are AI-powered bots that can execute blockchain operations automatically. They can transfer tokens, monitor prices, execute trading strategies, and more -- all without manual intervention.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'On-chain Actions', d: 'Transfer, stake, bridge, and interact with smart contracts automatically' },
                        { t: 'Growth Actions', d: 'Referral management, community engagement, and social media posting' },
                        { t: 'Custom Prompts', d: 'Define agent behavior using natural language system prompts' },
                        { t: 'Scheduling', d: 'Set agents to run at specific intervals or triggered by conditions' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'agent-create': return (
            <div class="space-y-6">
                <SectionHeader title="Creating an Agent" desc="Create a new AI agent and configure its behavior." />
                <StepList steps={[
                    { title: 'Open Agent Hosting', desc: 'Navigate to "Agent" from the sidebar menu.' },
                    { title: 'Tap Create Agent', desc: 'Click the "Create Agent" button to start the setup wizard.' },
                    { title: 'Name Your Agent', desc: 'Give your agent a unique name (e.g., "Trading Bot Alpha").' },
                    { title: 'Select Action Type', desc: 'Choose between On-chain actions (transfers, staking) or Growth actions (referrals, social).' },
                    { title: 'Configure Prompt', desc: 'Write a system prompt that defines how your agent should behave and make decisions.' },
                    { title: 'Set VCN Budget', desc: 'Allocate VCN tokens for the agent to use in its operations.' },
                    { title: 'Activate', desc: 'Review settings and activate the agent. It will begin executing based on your configuration.' },
                ]} />
                <Tip><>Start with a small VCN budget and conservative settings. Monitor the agent's execution logs before scaling up.</></Tip>
            </div>
        );
        case 'agent-actions': return (
            <div class="space-y-6">
                <SectionHeader title="Action Types" desc="Agents can perform two categories of actions." />
                <div class="space-y-4">
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <h4 class="text-sm font-bold text-cyan-400 mb-2">On-chain Actions</h4>
                        <ul class="space-y-1.5 text-xs text-gray-400">
                            <li>- Token transfers to specified addresses or contacts</li>
                            <li>- Staking and reward claiming automation</li>
                            <li>- Bridge transfers between chains</li>
                            <li>- Smart contract interactions</li>
                            <li>- Conditional transfers (trigger-based)</li>
                        </ul>
                    </div>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <h4 class="text-sm font-bold text-purple-400 mb-2">Growth Actions</h4>
                        <ul class="space-y-1.5 text-xs text-gray-400">
                            <li>- Referral link distribution and tracking</li>
                            <li>- Community engagement and outreach</li>
                            <li>- Social media content posting</li>
                            <li>- Campaign participation automation</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
        case 'agent-manage': return (
            <div class="space-y-6">
                <SectionHeader title="Managing Agents" desc="Start, pause, edit, and delete your AI agents." />
                <p class="text-sm text-gray-400">The Agent dashboard shows all your created agents with their current status. You can manage each agent individually.</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { a: 'Start', d: 'Activate a paused agent to resume operations' },
                        { a: 'Pause', d: 'Temporarily stop an agent without deleting it' },
                        { a: 'Edit', d: 'Modify agent configuration, prompts, or budget' },
                        { a: 'Delete', d: 'Permanently remove an agent and return remaining budget' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <span class="text-sm font-medium text-white">{item.a}</span>
                            <span class="text-xs text-gray-400">{item.d}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'agent-logs': return (
            <div class="space-y-6">
                <SectionHeader title="Logs & Monitoring" desc="View detailed execution logs for each agent." />
                <p class="text-sm text-gray-400">Every action performed by your agent is logged with timestamps, action type, parameters, results, and VCN cost. Use these logs to monitor performance and debug issues.</p>
                <Tip><>Review agent logs regularly. If an agent is making unexpected decisions, adjust its system prompt or reduce its budget and action permissions.</></Tip>
            </div>
        );

        // ─── Insight ───
        case 'insight-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Vision Insight Dashboard" desc="AI-curated market intelligence with real-time analysis of crypto markets and Vision Chain ecosystem." />
                <p class="text-sm text-gray-400">Vision Insight aggregates data from multiple sources including market feeds, social media, and on-chain analytics to provide actionable intelligence. Content is curated and analyzed by AI to highlight the most relevant information.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { n: 'AI Analysis', d: 'Machine-learning powered market sentiment analysis' },
                        { n: 'Real-time Feed', d: 'Continuously updated news and market data' },
                        { n: 'Categories', d: 'Filter by market, technology, regulation, and more' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.n}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'insight-news': return (
            <div class="space-y-6">
                <SectionHeader title="AI News Feed" desc="Browse AI-curated news articles with sentiment analysis and impact assessment." />
                <p class="text-sm text-gray-400">Each news article in the feed includes an AI-generated summary, sentiment score (bullish/bearish/neutral), relevance rating, and source attribution. Articles are refreshed multiple times per day.</p>
                <Tip><>Use category filters to focus on topics that matter to your investment strategy. The AI learns from your reading patterns to improve curation over time.</></Tip>
            </div>
        );
        case 'insight-signals': return (
            <div class="space-y-6">
                <SectionHeader title="Trading Signals" desc="AI-generated trading signals based on technical analysis, sentiment, and on-chain data." />
                <Warning><>Trading signals are for informational purposes only and do not constitute financial advice. Always do your own research before making investment decisions.</></Warning>
            </div>
        );

        // ─── CEX Portfolio ───
        case 'cex-connect': return (
            <div class="space-y-6">
                <SectionHeader title="Connecting Exchanges" desc="Link your centralized exchange accounts to view all your crypto holdings in one place." />
                <Prerequisites items={['Exchange account on Upbit or Bithumb', 'API keys generated from the exchange']} />
                <StepList steps={[
                    { title: 'Open CEX Portfolio', desc: 'Navigate to "CEX Portfolio" from the sidebar menu.' },
                    { title: 'Add Exchange', desc: 'Tap "Add Exchange" and select your exchange (Upbit or Bithumb).' },
                    { title: 'Enter API Keys', desc: 'Input your API Key and Secret Key generated from the exchange settings.' },
                    { title: 'Whitelist IP', desc: 'Add the displayed server IP to your exchange API whitelist for security.' },
                    { title: 'Connect', desc: 'Tap "Connect" to verify and sync your portfolio data.' },
                ]} />
                <Warning><>Only use read-only API keys. Do not grant trading or withdrawal permissions to protect your funds.</></Warning>
            </div>
        );
        case 'cex-portfolio': return (
            <div class="space-y-6">
                <SectionHeader title="Portfolio Overview" desc="View aggregated portfolio data across all connected exchanges." />
                <p class="text-sm text-gray-400">The CEX Portfolio page displays a unified view of all your exchange holdings. A donut chart shows asset allocation, and detailed tables list each coin with its balance, value, and 24h change.</p>
                <Tip><>Tap "Sync" to fetch the latest balances from your connected exchanges. Data is cached to reduce API calls.</></Tip>
            </div>
        );
        case 'cex-security': return (
            <div class="space-y-6">
                <SectionHeader title="Security & IP Whitelist" desc="Secure your exchange API connections." />
                <p class="text-sm text-gray-400">Your API keys are encrypted and stored securely. The system uses read-only API access and never performs trades or withdrawals on your behalf.</p>
                <Note><>Always use read-only API keys. The IP whitelist ensures that only our server can access your exchange data. You can disconnect an exchange at any time by deleting the API credentials.</></Note>
            </div>
        );

        // ─── Disk ───
        case 'disk-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Vision Disk - Encrypted Cloud Storage" desc="Store files securely on the blockchain with end-to-end encryption powered by your wallet keys." />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'End-to-End Encrypted', d: 'Files are encrypted with your wallet keys before upload. Only you can decrypt them.' },
                        { t: 'Blockchain-anchored', d: 'File metadata and integrity proofs are stored on Vision Chain' },
                        { t: 'Gasless Operations', d: 'Upload, download, and manage files without paying gas fees via EIP-2612 Permits' },
                        { t: 'Shareable', d: 'Publish files with public links or share with specific wallet addresses' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'disk-upload': return (
            <div class="space-y-6">
                <SectionHeader title="Upload & Download Files" desc="Upload files to Vision Disk and download them on any device." />
                <StepList steps={[
                    { title: 'Open Vision Disk', desc: 'Navigate to "Disk" from the sidebar menu.' },
                    { title: 'Upload File', desc: 'Tap the upload button and select a file from your device. Files are automatically encrypted.' },
                    { title: 'Wait for Processing', desc: 'The file is encrypted, chunked, and uploaded. Progress is shown in real-time.' },
                    { title: 'Download', desc: 'To download, simply click on any file in your Disk. It will be decrypted and saved to your device.' },
                ]} />
                <Note><>Maximum file size depends on your storage plan. Files are automatically chunked for reliable upload of large files.</></Note>
            </div>
        );
        case 'disk-folders': return (
            <div class="space-y-6">
                <SectionHeader title="Folder Management" desc="Organize your files with folders, move, rename, and delete." />
                <p class="text-sm text-gray-400">Create folders to organize your encrypted files. You can move files between folders, rename them, and perform batch operations (select multiple files for move or delete).</p>
                <StepList steps={[
                    { title: 'Create Folder', desc: 'Tap "New Folder" and enter a name.' },
                    { title: 'Move Files', desc: 'Long-press or select files, then use "Move to" to organize.' },
                    { title: 'Batch Delete', desc: 'Select multiple files and tap "Delete" for batch removal.' },
                ]} />
            </div>
        );
        case 'disk-share': return (
            <div class="space-y-6">
                <SectionHeader title="Sharing & Publishing" desc="Share files with others via public links or direct wallet-to-wallet sharing." />
                <StepList steps={[
                    { title: 'Select a File', desc: 'Open the file details in Vision Disk.' },
                    { title: 'Tap Share/Publish', desc: 'Choose to create a public link or share with a specific wallet address.' },
                    { title: 'Copy Link', desc: 'For public sharing, copy the generated link and send it to recipients.' },
                ]} />
                <Warning><>Published files are accessible to anyone with the link. Make sure you do not share sensitive information publicly.</></Warning>
            </div>
        );
        case 'disk-plans': return (
            <div class="space-y-6">
                <SectionHeader title="Storage Plans" desc="Choose a storage plan that fits your needs. Pay with VCN tokens." />
                <p class="text-sm text-gray-400">Vision Disk offers tiered storage plans paid with VCN tokens. Each plan includes a storage quota, upload limits, and access to advanced features like version history and team sharing.</p>
                <Tip><>Storage payments use gasless EIP-2612 Permit signatures, so you don't need ETH for gas to purchase or upgrade your plan.</></Tip>
            </div>
        );

        // ─── Nodes ───
        case 'nodes-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Vision Node Overview" desc="Run a Vision Node to support the network and earn VCN rewards." />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'Validator Node', d: 'Full node that participates in block validation. Requires dedicated hardware.' },
                        { t: 'Enterprise Node', d: 'High-capacity node for enterprise-grade applications with premium support.' },
                        { t: 'Mobile Node', d: 'Lightweight node that runs in your browser (PWA). Earn VCN by staying online.' },
                        { t: 'Desktop App', d: 'Download the Vision Node desktop app for macOS, Windows, or Linux.' },
                    ].map(c => (
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'nodes-purchase': return (
            <div class="space-y-6">
                <SectionHeader title="Purchasing Nodes" desc="Purchase a Vision Node tier to unlock additional earning potential." />
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-3 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Tier</div><div>Price</div><div>Benefits</div></div>
                    {[
                        { t: 'Validator', p: '$10,000 USD', b: 'Block validation, highest rewards' },
                        { t: 'Enterprise', p: '$100,000 USD', b: 'Enterprise support, SLA, custom APIs' },
                    ].map(r => (
                        <div class="grid grid-cols-3 gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                            <span class="text-white font-medium">{r.t}</span>
                            <span class="text-gray-400 text-xs">{r.p}</span>
                            <span class="text-gray-500 text-xs">{r.b}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'nodes-install': return (
            <div class="space-y-6">
                <SectionHeader title="Installation Guide" desc="Install the Vision Node desktop application on your system." />
                <div class="space-y-4">
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <h4 class="text-sm font-bold text-white mb-2">macOS (CLI)</h4>
                        <code class="text-xs text-cyan-400 bg-black/30 rounded-lg px-3 py-2 block font-mono break-all">curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-macos.sh | bash</code>
                    </div>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <h4 class="text-sm font-bold text-white mb-2">Desktop App</h4>
                        <p class="text-xs text-gray-400">Download the latest release from the Vision Node downloads page. Available for macOS (.dmg) and Windows (.exe).</p>
                    </div>
                </div>
                <Tip><>After installation, the node dashboard is accessible at http://localhost:9090. Use this to monitor node status, storage, and rewards.</></Tip>
            </div>
        );

        // ─── Mint ───
        case 'mint-overview': return (
            <div class="space-y-6">
                <SectionHeader title="Mint Studio" desc="Create and deploy custom tokens on Vision Chain with the Mint Studio." />
                <p class="text-sm text-gray-400">Mint Studio provides a no-code interface for deploying ERC-20 tokens on Vision Chain and other supported networks. Configure your token's name, symbol, total supply, and properties through a guided wizard.</p>
            </div>
        );
        case 'mint-create': return (
            <div class="space-y-6">
                <SectionHeader title="Creating a Token" desc="Step-by-step guide to minting a custom token." />
                <Prerequisites items={['VCN balance for deployment fees', 'Wallet password configured']} />
                <StepList steps={[
                    { title: 'Open Mint Studio', desc: 'Navigate to "Mint" from the sidebar menu.' },
                    { title: 'Token Details', desc: 'Enter your token name, symbol (3-5 characters), and select the token type.' },
                    { title: 'Set Supply', desc: 'Define the initial token supply and whether it is mintable or fixed.' },
                    { title: 'Select Networks', desc: 'Choose which networks to deploy on (Vision Chain, Ethereum, Polygon, Base).' },
                    { title: 'Deploy', desc: 'Review all settings, confirm deployment, and sign the transaction.' },
                ]} />
                <Note><>Token deployment costs are paid in VCN. Multi-network deployment incurs additional gas costs on each target chain.</></Note>
            </div>
        );

        // ─── Social ───
        case 'contacts-manage': return (
            <div class="space-y-6">
                <SectionHeader title="Contacts Management" desc="Save, edit, and organize your frequently used wallet addresses." />
                <StepList steps={[
                    { title: 'Add Contact', desc: 'Tap "Add Contact" and enter a name and wallet address. Optionally add email, phone, and notes.' },
                    { title: 'Phone Sync', desc: 'Import contacts from your phone to quickly find friends who use Vision Chain.' },
                    { title: 'VNS Lookup', desc: 'Search by Vision Name Service (VNS) to find contacts by their human-readable names.' },
                    { title: 'Edit / Delete', desc: 'Tap any contact to edit details or swipe to delete.' },
                    { title: 'Favorites', desc: 'Star contacts to pin them at the top for quick access during transfers.' },
                ]} />
                <Tip><>Saved contacts appear automatically in the send flow, making transfers faster and reducing address errors.</></Tip>
            </div>
        );
        case 'referral-program': return (
            <div class="space-y-6">
                <SectionHeader title="Referral Program" desc="Invite friends to Vision Chain and earn VCN rewards for each signup." />
                <StepList steps={[
                    { title: 'Get Your Code', desc: 'Navigate to "Referral" from sidebar. Your unique referral code and link are displayed.' },
                    { title: 'Share', desc: 'Copy your referral link or code and share it via social media, messaging, or email.' },
                    { title: 'Track Progress', desc: 'View how many friends have signed up, your current level, and earned rewards.' },
                    { title: 'Claim Rewards', desc: 'Referral rewards are automatically credited to your wallet. Check the reward history for details.' },
                ]} />
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-3 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Level</div><div>Referrals</div><div>Benefits</div></div>
                    {[
                        { l: 'Starter', r: '0-4', b: 'Basic referral link' },
                        { l: 'Advocate', r: '5-19', b: 'Enhanced rewards, badge' },
                        { l: 'Ambassador', r: '20-49', b: 'Premium multiplier' },
                        { l: 'Champion', r: '50+', b: 'Highest rewards, exclusive access' },
                    ].map(r => (
                        <div class="grid grid-cols-3 gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                            <span class="text-white font-medium">{r.l}</span>
                            <span class="text-gray-400 text-xs">{r.r}</span>
                            <span class="text-gray-500 text-xs">{r.b}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'quest-campaign': return (
            <div class="space-y-6">
                <SectionHeader title="Quests & Campaigns" desc="Complete quests to earn Reward Points (RP) and unlock exclusive benefits." />
                <p class="text-sm text-gray-400">Vision Chain runs periodic campaigns with quests that reward users for engaging with the ecosystem. Quests range from simple actions (first transfer, first stake) to advanced challenges (referral milestones, bridge usage).</p>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[
                        { q: 'First Transfer', d: 'Send your first VCN transaction', r: '+50 RP' },
                        { q: 'Stake Champion', d: 'Stake at least 100 VCN', r: '+100 RP' },
                        { q: 'Bridge Explorer', d: 'Complete a cross-chain bridge transfer', r: '+150 RP' },
                        { q: 'Social Butterfly', d: 'Invite 5 friends via referral', r: '+250 RP' },
                    ].map(item => (
                        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                            <div><span class="text-sm text-white font-medium">{item.q}</span><span class="text-xs text-gray-500 ml-2">{item.d}</span></div>
                            <span class="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded">{item.r}</span>
                        </div>
                    ))}
                </div>
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
