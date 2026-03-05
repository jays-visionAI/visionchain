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
function getContent(id: string): JSX.Element {
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
                            <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-4 hover:bg-white/5 transition-colors cursor-pointer" >
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

        // ─── Default fallback for sections not yet written ───
        default: {
            // Find section info
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
                    {getContent(active())}

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
