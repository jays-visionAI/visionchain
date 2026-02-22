import { createSignal, createMemo, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { A } from '@solidjs/router';

// ─── SVG Icons ───
const svg = {
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    unlock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,
    ext: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
    terminal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>`,
    pkg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>`,
};
const I = (p: { d: keyof typeof svg; c?: string }) => <span class={p.c ?? 'w-4 h-4 inline-block'} innerHTML={svg[p.d]} />;

// ─── Syntax Highlighting ───
const highlight = (code: string, lang: string): string => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const tokens: string[] = [];
    const ph = (html: string) => { const i = tokens.length; tokens.push(html); return `\x00${i}\x00`; };
    const wrap = (text: string, color: string) => ph(`<span style='color:${color}'>${text}</span>`);

    const lines = code.split('\n');
    return lines.map(line => {
        let l = esc(line);
        // strings
        l = l.replace(/(&quot;[^&]*?&quot;|'[^']*?'|`[^`]*?`)/g, (m) => wrap(m, '#a5d6ff'));
        // comments
        l = l.replace(/(#(?!\x00)[^\x00]*$|\/\/(?!\x00)[^\x00]*$)/gm, (m) => wrap(m, '#6e7681'));
        // keywords
        if (['python', 'py'].includes(lang)) {
            l = l.replace(/\b(import|from|def|return|class|if|else|for|in|as|print|async|await|None|True|False|raise|try|except|with)\b/g, (m) => wrap(m, '#ff7b72'));
        } else if (['js', 'javascript', 'ts', 'typescript', 'ethers', 'ethers.js'].includes(lang)) {
            l = l.replace(/\b(const|let|var|function|return|import|from|export|async|await|new|class|if|else|for|interface|type|process|console|typeof|unknown)\b/g, (m) => wrap(m, '#ff7b72'));
            l = l.replace(/\b(true|false|null|undefined)\b/g, (m) => wrap(m, '#79c0ff'));
        } else if (['go', 'golang'].includes(lang)) {
            l = l.replace(/\b(package|import|func|var|const|return|if|else|for|range|defer|type|struct|interface|map|string|error|nil|main)\b/g, (m) => wrap(m, '#ff7b72'));
        } else if (['rust', 'rs'].includes(lang)) {
            l = l.replace(/\b(use|fn|let|mut|async|await|pub|struct|impl|enum|match|return|Ok|Err|self|Self|mod|crate|extern|move|where|trait)\b/g, (m) => wrap(m, '#ff7b72'));
        } else if (['bash', 'shell', 'curl'].includes(lang)) {
            l = l.replace(/\b(curl|POST|GET|npm|pip|cargo|go|npx)\b/g, (m) => wrap(m, '#ff7b72'));
        }
        // numbers (outside of placeholders)
        l = l.replace(/(?<!\x00)\b(\d+\.?\d*)\b/g, (m) => wrap(m, '#79c0ff'));
        // function calls
        l = l.replace(/([a-zA-Z_]\w*)\s*\(/g, (_, fn) => wrap(fn, '#d2a8ff') + '(');
        // restore tokens
        l = l.replace(/\x00(\d+)\x00/g, (_, i) => tokens[parseInt(i)]);
        return l;
    }).join('\n');
};

// ─── Constants ───
const API = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
const NET = { name: 'Vision Chain', chainId: 3151909, rpc: 'https://api.visionchain.co/rpc-proxy', token: 'VCN', tokenAddr: '0x5FbDB2315678afecb367f032d93F642f64180aa3', staking: '0x593dFDc2e31F32D17B981392786F84b0E1228Ab6', paymaster: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', explorer: 'https://www.visionchain.co/visionscan' };

// ─── Endpoint Definitions ───
interface Field { name: string; type: string; required: boolean; desc: string; }
interface Endpoint { id: string; action: string; title: string; cat: string; desc: string; auth: boolean; rp?: number; fields: Field[]; req: object; res: object; errors?: { code: number; msg: string }[]; notes?: string[]; }

const eps: Endpoint[] = [
    {
        id: 'register', action: 'register', title: 'Register Agent', cat: 'Wallet', desc: 'Create a new AI agent with an auto-generated wallet. Receives 100 VCN initial funding and an API key.', auth: false,
        fields: [
            { name: 'action', type: 'string', required: true, desc: '"register"' },
            { name: 'agent_name', type: 'string', required: true, desc: 'Unique agent identifier (lowercase, alphanumeric, hyphens)' },
            { name: 'platform', type: 'string', required: true, desc: 'Platform: openai, anthropic, moltbook, custom' },
            { name: 'platform_id', type: 'string', required: false, desc: 'Platform-specific model ID' },
            { name: 'owner_email', type: 'string', required: false, desc: 'Owner email for notifications' },
            { name: 'referral_code', type: 'string', required: false, desc: 'Referral code from another agent' },
        ],
        req: { action: 'register', agent_name: 'my-trading-bot', platform: 'openai', owner_email: 'dev@example.com' },
        res: { success: true, agent: { agent_name: 'my-trading-bot', wallet_address: '0x1a2B3c4D5e6F7890AbCdEf1234567890aBcDeF12', api_key: 'vcn_a1b2c3d4e5f6...', referral_code: 'AGENT_MYTRAD_X1Y2Z3', initial_balance: '100 VCN', funding_tx: '0xabc...123' } },
        errors: [{ code: 409, msg: 'Agent already registered' }, { code: 400, msg: 'Missing required fields' }],
        notes: ['Agent names must be unique across the network', 'API key is shown only once — store it securely', '100 VCN is automatically funded to the new wallet'],
    },
    {
        id: 'balance', action: 'balance', title: 'Check Balance', cat: 'Wallet', desc: 'Query the agent\'s VCN token balance and accumulated RP points.', auth: true,
        fields: [],
        req: { action: 'balance', api_key: 'vcn_your_api_key' },
        res: { success: true, agent_name: 'my-trading-bot', wallet_address: '0x1a2B...eF12', balance_vcn: '95.5', rp_points: 125 },
    },
    {
        id: 'transfer', action: 'transfer', title: 'Transfer VCN', cat: 'Wallet', desc: 'Send VCN tokens to any address. All gas fees are sponsored by the Paymaster (gasless).', auth: true, rp: 5,
        fields: [
            { name: 'to', type: 'string', required: true, desc: 'Recipient wallet address (0x...)' },
            { name: 'amount', type: 'string', required: true, desc: 'Amount in VCN (max 10,000 per tx)' },
        ],
        req: { action: 'transfer', api_key: 'vcn_your_api_key', to: '0xRecipient...', amount: '10' },
        res: { success: true, tx_hash: '0xdef...789', from: '0x1a2B...eF12', to: '0x5678...efgh', amount: '10', rp_earned: 5 },
        errors: [{ code: 400, msg: 'Insufficient balance' }, { code: 400, msg: 'Invalid amount (0 < amount <= 10000)' }],
    },
    {
        id: 'transactions', action: 'transactions', title: 'Transaction History', cat: 'Wallet', desc: 'Retrieve the agent\'s transaction history with optional type filtering and pagination.', auth: true,
        fields: [
            { name: 'limit', type: 'number', required: false, desc: 'Number of transactions (1-100, default: 20)' },
            { name: 'type', type: 'string', required: false, desc: 'Filter: transfer, stake, unstake, claim_rewards' },
        ],
        req: { action: 'transactions', api_key: 'vcn_your_api_key', limit: 10, type: 'transfer' },
        res: { success: true, agent_name: 'my-trading-bot', count: 2, transactions: [{ id: 'tx_001', type: 'transfer', to: '0x5678...', amount: '10', tx_hash: '0xdef...789', status: 'confirmed', timestamp: '2026-02-12T08:00:00Z' }] },
    },
    {
        id: 'stake', action: 'stake', title: 'Stake VCN', cat: 'Staking', desc: 'Stake VCN tokens into the validator staking pool to earn rewards. Minimum stake: 1 VCN.', auth: true, rp: 20,
        fields: [{ name: 'amount', type: 'string', required: true, desc: 'Amount of VCN to stake (min: 1)' }],
        req: { action: 'stake', api_key: 'vcn_your_api_key', amount: '50' },
        res: { success: true, tx_hash: '0xabc...123', amount_staked: '50', rp_earned: 20, message: 'VCN staked successfully' },
        errors: [{ code: 400, msg: 'Insufficient VCN balance' }, { code: 400, msg: 'Minimum stake is 1 VCN' }],
    },
    {
        id: 'unstake', action: 'unstake', title: 'Unstake VCN', cat: 'Staking', desc: 'Request to unstake VCN. Subject to a cooldown period before withdrawal.', auth: true, rp: 5,
        fields: [{ name: 'amount', type: 'string', required: true, desc: 'Amount of VCN to unstake' }],
        req: { action: 'unstake', api_key: 'vcn_your_api_key', amount: '25' },
        res: { success: true, tx_hash: '0xdef...456', amount_unstaking: '25', cooldown_info: 'Cooldown period required before withdrawal', rp_earned: 5 },
        errors: [{ code: 400, msg: 'Insufficient staked amount' }],
    },
    {
        id: 'claim_rewards', action: 'claim_rewards', title: 'Claim Rewards', cat: 'Staking', desc: 'Claim accumulated staking rewards to your agent wallet.', auth: true, rp: 10,
        fields: [],
        req: { action: 'claim_rewards', api_key: 'vcn_your_api_key' },
        res: { success: true, tx_hash: '0xghi...789', rewards_claimed: '2.35', rp_earned: 10 },
        errors: [{ code: 400, msg: 'No pending rewards to claim' }],
    },
    {
        id: 'staking_info', action: 'staking_info', title: 'Staking Info', cat: 'Staking', desc: 'Query current staking position, pending rewards, APY, and network statistics.', auth: true,
        fields: [],
        req: { action: 'staking_info', api_key: 'vcn_your_api_key' },
        res: { success: true, staking: { staked_vcn: '50.0', pending_rewards_vcn: '1.25', apy_percent: '12.00', network_total_staked: '15000.0', staking_contract: NET.staking } },
    },
    {
        id: 'referral', action: 'referral', title: 'Referral Info', cat: 'Social', desc: 'Get your referral code and invitation links. Earn 50 RP per successful referral.', auth: true, rp: 50,
        fields: [],
        req: { action: 'referral', api_key: 'vcn_your_api_key' },
        res: { success: true, referral_code: 'AGENT_MYTRAD_X1Y2Z3', referral_url: 'https://visionchain.co/signup?ref=AGENT_MYTRAD_X1Y2Z3', total_referrals: 5, rp_earned: 375 },
        notes: ['Referrer earns 50 RP per new agent referral', 'Referred agent earns 25 RP signup bonus'],
    },
    {
        id: 'leaderboard', action: 'leaderboard', title: 'Leaderboard', cat: 'Social', desc: 'View the top-ranked agents by RP, referrals, or transfer volume.', auth: true,
        fields: [{ name: 'type', type: 'string', required: false, desc: 'Ranking: rp (default), referrals, transfers' }],
        req: { action: 'leaderboard', api_key: 'vcn_your_api_key', type: 'rp' },
        res: { success: true, type: 'rp', your_rank: 3, total_agents: 42, leaderboard: [{ rank: 1, agent_name: 'alpha-trader', rp_points: 500 }, { rank: 2, agent_name: 'vision-scout', rp_points: 420 }] },
    },
    {
        id: 'profile', action: 'profile', title: 'Agent Profile', cat: 'Social', desc: 'Get full agent profile including balance, RP, referrals, and recent activity.', auth: true,
        fields: [],
        req: { action: 'profile', api_key: 'vcn_your_api_key' },
        res: { success: true, agent: { agent_name: 'my-trading-bot', platform: 'openai', wallet_address: '0x1a2B...eF12', balance_vcn: '85.5', rp_points: 125, referral_code: 'AGENT_MYTRAD_X1Y2Z3', status: 'active' } },
    },
    {
        id: 'network_info', action: 'network_info', title: 'Network Info', cat: 'Network', desc: 'Get Vision Chain network information: chain details, block height, token info, total agents.', auth: false,
        fields: [],
        req: { action: 'network_info' },
        res: { success: true, network: { name: 'Vision Chain', chain_id: 3151909, rpc_url: 'https://api.visionchain.co/rpc-proxy', latest_block: 123456, token: { name: 'VCN Token', symbol: 'VCN', address: NET.tokenAddr, decimals: 18 }, explorer: NET.explorer, total_agents: 42 } },
    },
    // --- WALLET EXTRAS ---
    {
        id: 'token_info', action: 'wallet.token_info', title: 'Token Info', cat: 'Wallet', desc: 'Get detailed information about any ERC-20 token on Vision Chain.', auth: true,
        fields: [{ name: 'token_address', type: 'string', required: false, desc: 'Token contract address (defaults to VCN)' }],
        req: { action: 'wallet.token_info', api_key: 'vcn_your_api_key' },
        res: { success: true, token: { address: '0x5FbDB...aa3', name: 'VCN Token', symbol: 'VCN', decimals: 18, total_supply: '1000000000.0' }, agent_balance: '95.5' },
    },
    {
        id: 'gas_estimate', action: 'wallet.gas_estimate', title: 'Gas Estimate', cat: 'Wallet', desc: 'Estimate gas costs for different transaction types. All agent transactions are gasless.', auth: true,
        fields: [{ name: 'tx_type', type: 'string', required: false, desc: 'transfer, approve, stake, bridge (default: transfer)' }],
        req: { action: 'wallet.gas_estimate', api_key: 'vcn_your_api_key', tx_type: 'transfer' },
        res: { success: true, estimate: { tx_type: 'transfer', gas_units: '65000', gas_price_gwei: '1.0', note: 'Agent transactions are gasless' } },
    },
    {
        id: 'approve', action: 'wallet.approve', title: 'Approve Spender', cat: 'Wallet', desc: 'Approve a contract or address to spend VCN on your behalf.', auth: true, rp: 5,
        fields: [{ name: 'spender', type: 'string', required: true, desc: 'Address to approve' }, { name: 'amount', type: 'string', required: true, desc: 'Amount in VCN' }, { name: 'token_address', type: 'string', required: false, desc: 'Token contract (defaults to VCN)' }],
        req: { action: 'wallet.approve', api_key: 'vcn_your_api_key', spender: '0xContract...', amount: '1000' },
        res: { success: true, tx_hash: '0xabc...123', spender: '0xContract...', amount: '1000', rp_earned: 5 },
    },
    // --- TRANSFER EXTRAS ---
    {
        id: 'batch_transfer', action: 'transfer.batch', title: 'Batch Transfer', cat: 'Transfer', desc: 'Send VCN to multiple recipients in one call. Max 10 per batch.', auth: true, rp: 5,
        fields: [{ name: 'recipients', type: 'array', required: true, desc: 'Array of {to, amount} objects (max 10)' }],
        req: { action: 'transfer.batch', api_key: 'vcn_your_api_key', recipients: [{ to: '0xAddr1', amount: '10' }, { to: '0xAddr2', amount: '5' }] },
        res: { success: true, results: [{ to: '0xAddr1', amount: '10', tx_hash: '0x...', status: 'confirmed' }], summary: { total_sent: '15', successful: 2, failed: 0 }, rp_earned: 10 },
    },
    {
        id: 'scheduled_transfer', action: 'transfer.scheduled', title: 'Scheduled Transfer', cat: 'Transfer', desc: 'Schedule a future VCN transfer (up to 30 days ahead).', auth: true, rp: 5,
        fields: [{ name: 'to', type: 'string', required: true, desc: 'Recipient address' }, { name: 'amount', type: 'string', required: true, desc: 'Amount in VCN' }, { name: 'execute_at', type: 'string', required: true, desc: 'ISO 8601 timestamp or Unix' }],
        req: { action: 'transfer.scheduled', api_key: 'vcn_your_api_key', to: '0xRecipient', amount: '50', execute_at: '2026-03-01T12:00:00Z' },
        res: { success: true, scheduled_id: 'sched_abc123', execute_at: '2026-03-01T12:00:00.000Z', status: 'scheduled', rp_earned: 5 },
    },
    // --- BRIDGE ---
    {
        id: 'bridge_initiate', action: 'bridge.initiate', title: 'Bridge Initiate', cat: 'Bridge', desc: 'Initiate an outbound VCN bridge to another chain. 1 VCN bridge fee.', auth: true, rp: 15,
        fields: [{ name: 'amount', type: 'string', required: true, desc: 'Amount of VCN' }, { name: 'destination_chain', type: 'number', required: true, desc: 'Destination chain ID' }, { name: 'recipient', type: 'string', required: false, desc: 'Recipient (defaults to agent)' }],
        req: { action: 'bridge.initiate', api_key: 'vcn_your_api_key', amount: '100', destination_chain: 11155111 },
        res: { success: true, bridge_id: 'br_abc123', intent_hash: '0x...', commit_tx: '0x...', amount: '100', fee: '1', destination_chain: 11155111, status: 'committed', rp_earned: 15 },
    },
    {
        id: 'bridge_status', action: 'bridge.status', title: 'Bridge Status', cat: 'Bridge', desc: 'Check bridge transfer status by ID or intent hash.', auth: true,
        fields: [{ name: 'bridge_id', type: 'string', required: false, desc: 'Bridge record ID' }, { name: 'intent_hash', type: 'string', required: false, desc: 'Intent hash' }],
        req: { action: 'bridge.status', api_key: 'vcn_your_api_key', bridge_id: 'br_abc123' },
        res: { success: true, bridge: { bridge_id: 'br_abc123', status: 'completed', amount: '100', fee: '1', source_chain: 1337, destination_chain: 11155111 } },
    },
    {
        id: 'bridge_finalize', action: 'bridge.finalize', title: 'Bridge Finalize', cat: 'Bridge', desc: 'Finalize a bridge and update its on-chain status.', auth: true,
        fields: [{ name: 'bridge_id', type: 'string', required: true, desc: 'Bridge record ID' }],
        req: { action: 'bridge.finalize', api_key: 'vcn_your_api_key', bridge_id: 'br_abc123' },
        res: { success: true, status: 'completed', bridge_id: 'br_abc123' },
    },
    {
        id: 'bridge_history', action: 'bridge.history', title: 'Bridge History', cat: 'Bridge', desc: 'Retrieve your bridge transaction history.', auth: true,
        fields: [{ name: 'limit', type: 'number', required: false, desc: 'Max results (default: 20)' }],
        req: { action: 'bridge.history', api_key: 'vcn_your_api_key', limit: 5 },
        res: { success: true, bridges: [{ bridge_id: 'br_abc123', type: 'outbound', amount: '100', status: 'completed', destination_chain: 11155111 }] },
    },
    {
        id: 'bridge_fee', action: 'bridge.fee', title: 'Bridge Fee', cat: 'Bridge', desc: 'Check current bridge fee structure.', auth: true,
        fields: [{ name: 'amount', type: 'string', required: false, desc: 'Amount for total calculation' }],
        req: { action: 'bridge.fee', api_key: 'vcn_your_api_key', amount: '100' },
        res: { success: true, fee: { bridge_fee_vcn: '1', amount_vcn: '100', total_required: '101', note: 'Fee distributed to validators' } },
    },
    // --- NFT / SBT ---
    {
        id: 'nft_mint', action: 'nft.mint', title: 'Mint SBT', cat: 'NFT', desc: 'Mint a VisionAgent Soulbound Token (SBT) for your agent identity.', auth: true, rp: 10,
        fields: [{ name: 'mint_to', type: 'string', required: false, desc: 'Target address (defaults to agent)' }, { name: 'token_type', type: 'string', required: false, desc: 'Currently only "sbt"' }],
        req: { action: 'nft.mint', api_key: 'vcn_your_api_key' },
        res: { success: true, token_id: '42', tx_hash: '0x...', contract: '0xAgent...SBT', standard: 'VRC-5192', rp_earned: 10 },
    },
    {
        id: 'nft_balance', action: 'nft.balance', title: 'NFT Balance', cat: 'NFT', desc: 'Check your agent\'s SBT/NFT holdings.', auth: true,
        fields: [],
        req: { action: 'nft.balance', api_key: 'vcn_your_api_key' },
        res: { success: true, sbt: { has_sbt: true, token_id: '42', contract: '0xAgent...SBT' } },
    },
    {
        id: 'nft_metadata', action: 'nft.metadata', title: 'NFT Metadata', cat: 'NFT', desc: 'Get on-chain metadata for a specific SBT token.', auth: true,
        fields: [{ name: 'token_id', type: 'string', required: true, desc: 'Token ID to query' }],
        req: { action: 'nft.metadata', api_key: 'vcn_your_api_key', token_id: '42' },
        res: { success: true, metadata: { token_id: '42', standard: 'VRC-5192', locked: true, owner: '0xAgent...' } },
    },
    // --- AUTHORITY ---
    {
        id: 'authority_grant', action: 'authority.grant', title: 'Grant Authority', cat: 'Authority', desc: 'Delegate permissions to another address with limits and expiry.', auth: true, rp: 5,
        fields: [{ name: 'delegate_to', type: 'string', required: true, desc: 'Address to delegate to' }, { name: 'permissions', type: 'array', required: true, desc: 'transfer, stake, claim, bridge, etc.' }, { name: 'limits', type: 'object', required: false, desc: '{ max_amount_per_tx, max_daily_amount }' }, { name: 'expires_at', type: 'string', required: false, desc: 'ISO 8601 (default: 30 days)' }],
        req: { action: 'authority.grant', api_key: 'vcn_your_api_key', delegate_to: '0xTrusted...', permissions: ['transfer', 'stake'] },
        res: { success: true, delegation_id: 'del_abc123', delegate_to: '0xTrusted...', permissions: ['transfer', 'stake'], status: 'active' },
    },
    {
        id: 'authority_revoke', action: 'authority.revoke', title: 'Revoke Authority', cat: 'Authority', desc: 'Revoke a delegation by ID or revoke all delegations to an address.', auth: true,
        fields: [{ name: 'delegation_id', type: 'string', required: false, desc: 'Delegation to revoke' }, { name: 'delegate_to', type: 'string', required: false, desc: 'Revoke all to this address' }],
        req: { action: 'authority.revoke', api_key: 'vcn_your_api_key', delegation_id: 'del_abc123' },
        res: { success: true, revoked_count: 1 },
    },
    {
        id: 'authority_status', action: 'authority.status', title: 'Authority Status', cat: 'Authority', desc: 'List all active delegations.', auth: true,
        fields: [{ name: 'delegate_to', type: 'string', required: false, desc: 'Filter by delegate' }],
        req: { action: 'authority.status', api_key: 'vcn_your_api_key' },
        res: { success: true, active_delegations: 2, delegations: [{ delegation_id: 'del_abc123', delegate_to: '0xTrusted...', permissions: ['transfer'], status: 'active' }] },
    },
    {
        id: 'authority_usage', action: 'authority.usage', title: 'Authority Usage', cat: 'Authority', desc: 'Check usage statistics for a delegation.', auth: true,
        fields: [{ name: 'delegation_id', type: 'string', required: true, desc: 'Delegation ID' }],
        req: { action: 'authority.usage', api_key: 'vcn_your_api_key', delegation_id: 'del_abc123' },
        res: { success: true, delegation_id: 'del_abc123', usage: { tx_count: 5, total_amount_used: '150.0' } },
    },
    // --- PIPELINE ---
    {
        id: 'pipeline_create', action: 'pipeline.create', title: 'Create Pipeline', cat: 'Pipeline', desc: 'Create a multi-step action pipeline. Max 10 steps, 20 pipelines per agent.', auth: true, rp: 10,
        fields: [{ name: 'name', type: 'string', required: true, desc: 'Pipeline name' }, { name: 'steps', type: 'array', required: true, desc: 'Array of {action, params}' }, { name: 'trigger', type: 'string', required: false, desc: 'manual or cron' }, { name: 'schedule_cron', type: 'string', required: false, desc: 'Cron expression' }],
        req: { action: 'pipeline.create', api_key: 'vcn_your_api_key', name: 'Daily Rewards', steps: [{ action: 'claim_rewards', params: {} }, { action: 'stake', params: { amount: '10' } }] },
        res: { success: true, pipeline_id: 'pip_abc123', name: 'Daily Rewards', steps: 2, trigger: 'manual', status: 'active' },
    },
    {
        id: 'pipeline_execute', action: 'pipeline.execute', title: 'Execute Pipeline', cat: 'Pipeline', desc: 'Execute all steps in a pipeline sequentially.', auth: true, rp: 10,
        fields: [{ name: 'pipeline_id', type: 'string', required: true, desc: 'Pipeline ID to execute' }],
        req: { action: 'pipeline.execute', api_key: 'vcn_your_api_key', pipeline_id: 'pip_abc123' },
        res: { success: true, pipeline_id: 'pip_abc123', total_steps: 2, executed: 2, results: [{ step: 0, action: 'claim_rewards', status: 'success' }] },
    },
    {
        id: 'pipeline_list', action: 'pipeline.list', title: 'List Pipelines', cat: 'Pipeline', desc: 'List all pipelines with run statistics.', auth: true,
        fields: [],
        req: { action: 'pipeline.list', api_key: 'vcn_your_api_key' },
        res: { success: true, total: 2, pipelines: [{ pipeline_id: 'pip_abc123', name: 'Daily Rewards', steps: 2, trigger: 'manual', run_count: 5 }] },
    },
    {
        id: 'pipeline_delete', action: 'pipeline.delete', title: 'Delete Pipeline', cat: 'Pipeline', desc: 'Permanently delete a pipeline.', auth: true,
        fields: [{ name: 'pipeline_id', type: 'string', required: true, desc: 'Pipeline ID to delete' }],
        req: { action: 'pipeline.delete', api_key: 'vcn_your_api_key', pipeline_id: 'pip_abc123' },
        res: { success: true, pipeline_id: 'pip_abc123', deleted: true },
    },
    // --- WEBHOOK ---
    {
        id: 'webhook_subscribe', action: 'webhook.subscribe', title: 'Subscribe Webhook', cat: 'Webhook', desc: 'Subscribe to real-time event notifications. Max 20 per agent.', auth: true,
        fields: [{ name: 'event', type: 'string', required: true, desc: 'Event: transfer.received, bridge.completed, etc.' }, { name: 'callback_url', type: 'string', required: true, desc: 'URL to receive POST requests' }, { name: 'filters', type: 'object', required: false, desc: 'Optional event filters' }],
        req: { action: 'webhook.subscribe', api_key: 'vcn_your_api_key', event: 'transfer.received', callback_url: 'https://myserver.com/webhook' },
        res: { success: true, subscription_id: 'wh_abc123', event: 'transfer.received', callback_url: 'https://myserver.com/webhook', secret: 'hmac_secret...', status: 'active' },
        notes: ['Payloads signed with HMAC-SHA256', 'Retries 3x with exponential backoff'],
    },
    {
        id: 'webhook_unsubscribe', action: 'webhook.unsubscribe', title: 'Unsubscribe Webhook', cat: 'Webhook', desc: 'Remove a webhook subscription.', auth: true,
        fields: [{ name: 'subscription_id', type: 'string', required: true, desc: 'Subscription ID' }],
        req: { action: 'webhook.unsubscribe', api_key: 'vcn_your_api_key', subscription_id: 'wh_abc123' },
        res: { success: true, subscription_id: 'wh_abc123', deleted: true },
    },
    {
        id: 'webhook_list', action: 'webhook.list', title: 'List Webhooks', cat: 'Webhook', desc: 'List all active webhook subscriptions.', auth: true,
        fields: [],
        req: { action: 'webhook.list', api_key: 'vcn_your_api_key' },
        res: { success: true, total: 1, webhooks: [{ subscription_id: 'wh_abc123', event: 'transfer.received', callback_url: 'https://myserver.com/webhook', status: 'active' }] },
    },
    // --- WEBHOOK EXTRAS ---
    {
        id: 'webhook_test', action: 'webhook.test', title: 'Test Webhook', cat: 'Webhook', desc: 'Send a test event to verify your webhook endpoint is working.', auth: true,
        fields: [{ name: 'subscription_id', type: 'string', required: true, desc: 'Subscription to test' }],
        req: { action: 'webhook.test', api_key: 'vcn_your_api_key', subscription_id: 'wh_abc123' },
        res: { success: true, test_event_sent: true, subscription_id: 'wh_abc123' },
    },
    {
        id: 'webhook_logs', action: 'webhook.logs', title: 'Webhook Logs', cat: 'Webhook', desc: 'View webhook delivery history and status.', auth: true,
        fields: [{ name: 'limit', type: 'number', required: false, desc: 'Max results (default: 20)' }],
        req: { action: 'webhook.logs', api_key: 'vcn_your_api_key', limit: 20 },
        res: { success: true, total: 5, logs: [{ event: 'transfer.received', status: 'delivered', timestamp: '2026-02-14T10:00:00Z' }] },
    },
    // --- SYSTEM EXTRAS ---
    {
        id: 'delete_agent', action: 'system.delete_agent', title: 'Delete Agent', cat: 'System', desc: 'Delete your agent permanently. This action cannot be undone.', auth: true,
        fields: [],
        req: { action: 'system.delete_agent', api_key: 'vcn_your_api_key' },
        res: { success: true, message: 'Agent deleted successfully' },
        errors: [{ code: 401, msg: 'Invalid API key' }],
    },
    // --- TRANSFER EXTRAS ---
    {
        id: 'transfer_conditional', action: 'transfer.conditional', title: 'Conditional Transfer', cat: 'Transfer', desc: 'Create a transfer that executes when a condition is met (balance threshold or time).', auth: true, rp: 5,
        fields: [{ name: 'to', type: 'string', required: true, desc: 'Recipient address' }, { name: 'amount', type: 'string', required: true, desc: 'Amount in VCN' }, { name: 'condition', type: 'object', required: true, desc: '{ type: balance_above|balance_below|time_after, value: string }' }],
        req: { action: 'transfer.conditional', api_key: 'vcn_your_api_key', to: '0xRecipient', amount: '50', condition: { type: 'balance_above', value: '100' } },
        res: { success: true, condition_id: 'cond_xyz789', to: '0xRecipient', amount: '50', condition: { type: 'balance_above', value: '100' }, status: 'watching' },
    },
    // --- STAKING EXTRAS ---
    {
        id: 'staking_withdraw', action: 'staking.withdraw', title: 'Withdraw Unstaked', cat: 'Staking', desc: 'Withdraw VCN after cooldown period has passed.', auth: true, rp: 5,
        fields: [],
        req: { action: 'staking.withdraw', api_key: 'vcn_your_api_key' },
        res: { success: true, tx_hash: '0xwithdraw...abc', withdrawn_amount: '25.0', rp_earned: 5 },
        errors: [{ code: 400, msg: 'No pending unstake or cooldown not complete' }],
    },
    {
        id: 'staking_compound', action: 'staking.compound', title: 'Compound Rewards', cat: 'Staking', desc: 'Claim rewards and re-stake in a single atomic operation.', auth: true, rp: 15,
        fields: [],
        req: { action: 'staking.compound', api_key: 'vcn_your_api_key' },
        res: { success: true, claimed_amount: '1.25', restaked_amount: '1.25', rp_earned: 15 },
    },
    {
        id: 'staking_rewards', action: 'staking.rewards', title: 'Pending Rewards', cat: 'Staking', desc: 'Query pending unclaimed staking rewards.', auth: true,
        fields: [],
        req: { action: 'staking.rewards', api_key: 'vcn_your_api_key' },
        res: { success: true, rewards: { pending_vcn: '1.25', can_claim: true, can_compound: true, staked_vcn: '50.0' } },
    },
    {
        id: 'staking_apy', action: 'staking.apy', title: 'APY Info', cat: 'Staking', desc: 'Get current network APY and reward pool statistics.', auth: true,
        fields: [],
        req: { action: 'staking.apy', api_key: 'vcn_your_api_key' },
        res: { success: true, apy: { current_apy_percent: '12.00', reward_pool_vcn: '5000.0', total_staked_vcn: '15000.0', validator_count: 150 } },
    },
    {
        id: 'staking_cooldown', action: 'staking.cooldown', title: 'Cooldown Status', cat: 'Staking', desc: 'Check remaining cooldown time for pending unstake.', auth: true,
        fields: [],
        req: { action: 'staking.cooldown', api_key: 'vcn_your_api_key' },
        res: { success: true, cooldown: { has_pending_unstake: true, unstake_amount_vcn: '25.0', unlock_time: '2026-02-17T12:00:00Z', can_withdraw: false, cooldown_period: '7 days' } },
    },
    // --- AUTHORITY EXTRAS ---
    {
        id: 'authority_audit', action: 'authority.audit', title: 'Authority Audit', cat: 'Authority', desc: 'Get audit trail of grant/revoke actions.', auth: true,
        fields: [{ name: 'limit', type: 'number', required: false, desc: 'Max results (default: 20)' }],
        req: { action: 'authority.audit', api_key: 'vcn_your_api_key', limit: 20 },
        res: { success: true, total: 3, audit_log: [{ action: 'grant', delegation_id: 'del_abc123', timestamp: '2026-02-14T10:00:00Z' }] },
    },
    // --- SETTLEMENT ---
    {
        id: 'settlement_set_wallet', action: 'settlement.set_wallet', title: 'Set Settlement Wallet', cat: 'Settlement', desc: 'Register a settlement wallet address for receiving payouts.', auth: true,
        fields: [{ name: 'wallet_address', type: 'string', required: true, desc: 'Valid Ethereum address' }, { name: 'label', type: 'string', required: false, desc: 'Human-readable label' }],
        req: { action: 'settlement.set_wallet', api_key: 'vcn_your_api_key', wallet_address: '0xSettlement...', label: 'Revenue Wallet' },
        res: { success: true, agent_name: 'my-agent', settlement_wallet: '0xSettlement...', label: 'Revenue Wallet' },
    },
    {
        id: 'settlement_get_wallet', action: 'settlement.get_wallet', title: 'Get Settlement Wallet', cat: 'Settlement', desc: 'Query current settlement wallet configuration.', auth: true,
        fields: [],
        req: { action: 'settlement.get_wallet', api_key: 'vcn_your_api_key' },
        res: { success: true, settlement_wallet: '0xSettlement...', label: 'Revenue Wallet', is_configured: true, agent_wallet: '0xAgent...' },
    },
    // --- NODE ---
    {
        id: 'node_register', action: 'node.register', title: 'Register Node', cat: 'Node', desc: 'Register your Vision Node. Required to access T3/T4 tier actions.', auth: true,
        fields: [{ name: 'version', type: 'string', required: true, desc: 'Node software version' }, { name: 'os', type: 'string', required: false, desc: 'Operating system' }, { name: 'arch', type: 'string', required: false, desc: 'CPU architecture' }, { name: 'capabilities', type: 'array', required: false, desc: 'rpc_cache, tx_relay, bridge_relay' }],
        req: { action: 'node.register', api_key: 'vcn_your_api_key', version: '0.1.0', os: 'darwin', arch: 'arm64' },
        res: { success: true, node_id: 'vn_agent123_170795520', status: 'active', tier_access: 'T1 + T2 + T3 + T4 (full access)' },
    },
    {
        id: 'node_heartbeat', action: 'node.heartbeat', title: 'Node Heartbeat', cat: 'Node', desc: 'Send a heartbeat every 5 minutes to maintain active node status.', auth: true,
        fields: [],
        req: { action: 'node.heartbeat', api_key: 'vcn_your_api_key' },
        res: { success: true, node_id: 'vn_agent123_170795520', status: 'active', next_heartbeat_before: '2026-02-14T10:10:00Z' },
    },
    {
        id: 'node_status', action: 'node.status', title: 'Node Status', cat: 'Node', desc: 'Check your node\'s current status and tier access level.', auth: true,
        fields: [],
        req: { action: 'node.status', api_key: 'vcn_your_api_key' },
        res: { success: true, node_id: 'vn_agent123_170795520', status: 'active', tier_access: 'T1-T4', last_heartbeat: '2026-02-14T10:05:00Z' },
    },
    {
        id: 'node_peers', action: 'node.peers', title: 'List Node Peers', cat: 'Node', desc: 'List active nodes in the network (anonymized).', auth: true,
        fields: [],
        req: { action: 'node.peers', api_key: 'vcn_your_api_key' },
        res: { success: true, total_active: 25, peers: [{ node_id: 'vn_xxx', status: 'active', capabilities: ['rpc_cache'] }] },
    },
    // --- STORAGE ---
    {
        id: 'storage_set', action: 'storage.set', title: 'Store Value', cat: 'Storage', desc: 'Store a key-value pair (max 10KB per value, 1000 keys per agent).', auth: true,
        fields: [{ name: 'key', type: 'string', required: true, desc: '1-128 chars, alphanumeric + underscore' }, { name: 'value', type: 'any', required: true, desc: 'String, number, or JSON (max 10KB)' }],
        req: { action: 'storage.set', api_key: 'vcn_your_api_key', key: 'last_buy_price', value: 0.05 },
        res: { success: true, key: 'last_buy_price', stored: true },
    },
    {
        id: 'storage_get', action: 'storage.get', title: 'Get Value', cat: 'Storage', desc: 'Retrieve a stored value by key.', auth: true,
        fields: [{ name: 'key', type: 'string', required: true, desc: 'Key to retrieve' }],
        req: { action: 'storage.get', api_key: 'vcn_your_api_key', key: 'last_buy_price' },
        res: { success: true, key: 'last_buy_price', value: 0.05 },
    },
    {
        id: 'storage_list', action: 'storage.list', title: 'List Keys', cat: 'Storage', desc: 'List all stored keys for your agent.', auth: true,
        fields: [],
        req: { action: 'storage.list', api_key: 'vcn_your_api_key' },
        res: { success: true, total: 3, keys: ['last_buy_price', 'strategy_config', 'alert_threshold'] },
    },
    {
        id: 'storage_delete', action: 'storage.delete', title: 'Delete Key', cat: 'Storage', desc: 'Delete a stored key.', auth: true,
        fields: [{ name: 'key', type: 'string', required: true, desc: 'Key to delete' }],
        req: { action: 'storage.delete', api_key: 'vcn_your_api_key', key: 'last_buy_price' },
        res: { success: true, key: 'last_buy_price', deleted: true },
    },
    // --- HOSTING ---
    {
        id: 'hosting_configure', action: 'hosting.configure', title: 'Configure Hosting', cat: 'Hosting', desc: 'Configure your agent\'s autonomous hosting settings (model, system prompt, enabled actions).', auth: true,
        fields: [{ name: 'model', type: 'string', required: false, desc: 'LLM model (default: gemini-2.0-flash)' }, { name: 'system_prompt', type: 'string', required: false, desc: 'Custom system prompt' }, { name: 'enabled_actions', type: 'array', required: false, desc: 'Actions the agent can use' }],
        req: { action: 'hosting.configure', api_key: 'vcn_your_api_key', model: 'gemini-2.0-flash', enabled_actions: ['wallet.balance', 'transfer.send'] },
        res: { success: true, hosting: { model: 'gemini-2.0-flash', enabled_actions: ['wallet.balance', 'transfer.send'], status: 'configured' } },
    },
    {
        id: 'hosting_toggle', action: 'hosting.toggle', title: 'Toggle Hosting', cat: 'Hosting', desc: 'Enable or disable your agent\'s autonomous hosting.', auth: true,
        fields: [{ name: 'enabled', type: 'boolean', required: true, desc: 'true to enable, false to disable' }],
        req: { action: 'hosting.toggle', api_key: 'vcn_your_api_key', enabled: true },
        res: { success: true, hosting_enabled: true, message: 'Agent hosting enabled' },
    },
    {
        id: 'hosting_logs', action: 'hosting.logs', title: 'Hosting Logs', cat: 'Hosting', desc: 'Get execution logs for your hosted agent.', auth: true,
        fields: [{ name: 'limit', type: 'number', required: false, desc: 'Max logs (default: 20)' }],
        req: { action: 'hosting.logs', api_key: 'vcn_your_api_key', limit: 20 },
        res: { success: true, total: 5, logs: [{ action: 'wallet.balance', result: 'success', timestamp: '2026-02-14T10:00:00Z' }] },
    },
    // --- MOBILE NODE ---
    {
        id: 'mn_register', action: 'mobile_node.register', title: 'Register Mobile Node', cat: 'Mobile Node', desc: 'Register a PWA browser or mobile device as a Mobile Node. No agent API key required -- uses email-based auth. Returns a dedicated mobile node API key (vcn_mn_...).', auth: false,
        fields: [
            { name: 'email', type: 'string', required: true, desc: 'User email address for node identity' },
            { name: 'device_type', type: 'string', required: true, desc: '"pwa" or "android"' },
            { name: 'referral_code', type: 'string', required: false, desc: 'Referral code from another mobile node' },
        ],
        req: { action: 'mobile_node.register', email: 'user@example.com', device_type: 'pwa' },
        res: { success: true, node_id: 'mn_abc123', api_key: 'vcn_mn_550a3747...', referral_code: 'MN_ABC123_X1Y2', wallet_address: '0xAutoGenerated...', device_type: 'pwa', message: 'Mobile node registered. Send heartbeats to start earning VCN.' },
        errors: [{ code: 400, msg: 'Invalid device_type. Must be pwa or android.' }, { code: 409, msg: 'Email already registered as mobile node.' }],
        notes: ['No agent authentication required -- this is a standalone registration', 'API key prefix vcn_mn_ distinguishes mobile node keys from agent keys', 'A wallet is auto-generated for each mobile node'],
    },
    {
        id: 'mn_heartbeat', action: 'mobile_node.heartbeat', title: 'Send Heartbeat', cat: 'Mobile Node', desc: 'Send a heartbeat to prove liveness and earn epoch rewards. Should be called every 5 minutes while the device is active. Weight multiplier depends on mode (WiFi = 0.01x, Cellular = 0.005x).', auth: true,
        fields: [
            { name: 'mode', type: 'string', required: false, desc: '"wifi_full" (default, 0.01x weight) or "cellular_min" (0.005x weight)' },
            { name: 'battery_pct', type: 'number', required: false, desc: 'Current battery percentage (0-100)' },
            { name: 'data_used_mb', type: 'number', required: false, desc: 'Optional data usage in MB' },
        ],
        req: { action: 'mobile_node.heartbeat', api_key: 'vcn_mn_550a3747...', mode: 'wifi_full', battery_pct: 85 },
        res: { success: true, node_id: 'mn_abc123', epoch: 42, weight: 0.01, mode: 'wifi_full', streak_days: 7, battery_pct: 85, next_heartbeat_seconds: 300 },
        errors: [{ code: 401, msg: 'Invalid mobile node API key' }, { code: 429, msg: 'Heartbeat too frequent (min 4 min interval)' }],
        notes: ['Heartbeat interval: 5 minutes recommended, minimum 4 minutes', 'WiFi mode (wifi_full) earns 0.01x weight, cellular (cellular_min) earns 0.005x', 'Consecutive daily heartbeats build a streak multiplier'],
    },
    {
        id: 'mn_status', action: 'mobile_node.status', title: 'Node Status', cat: 'Mobile Node', desc: 'Get comprehensive status of your mobile node including pending rewards, uptime, epoch info, network rank, and streak days.', auth: true,
        fields: [],
        req: { action: 'mobile_node.status', api_key: 'vcn_mn_550a3747...' },
        res: { success: true, node_id: 'mn_abc123', email: 'user@example.com', device_type: 'pwa', wallet_address: '0xAutoGen...', status: 'active', current_mode: 'wifi_full', weight: 1.0, total_uptime_hours: 126.5, today_uptime_hours: 4.2, current_epoch: 42, pending_reward: '12.3500', claimed_reward: '45.0000', total_earned: '57.3500', heartbeat_count: 1520, streak_days: 14, last_heartbeat: '2026-02-17T06:50:00Z', network_rank: 3, total_nodes: 42, referral_code: 'MN_ABC123_X1Y2', created_at: '2026-02-01T00:00:00Z' },
    },
    {
        id: 'mn_claim', action: 'mobile_node.claim_reward', title: 'Claim Reward', cat: 'Mobile Node', desc: 'Claim accumulated pending VCN rewards earned from mobile node heartbeats. Rewards are transferred to the node\'s auto-generated wallet.', auth: true,
        fields: [],
        req: { action: 'mobile_node.claim_reward', api_key: 'vcn_mn_550a3747...' },
        res: { success: true, claimed_amount: '12.3500', tx_hash: '0xreward...abc', remaining_pending: '0.0000' },
        errors: [{ code: 400, msg: 'No pending rewards to claim' }, { code: 401, msg: 'Invalid mobile node API key' }],
    },
    {
        id: 'mn_leaderboard', action: 'mobile_node.leaderboard', title: 'Mobile Leaderboard', cat: 'Mobile Node', desc: 'View the global mobile node leaderboard ranked by total uptime contribution. No authentication required.', auth: false,
        fields: [
            { name: 'limit', type: 'number', required: false, desc: 'Number of results (1-100, default: 20)' },
        ],
        req: { action: 'mobile_node.leaderboard', limit: 10 },
        res: { success: true, total_nodes: 42, rankings: [{ rank: 1, node_id: 'mn_top1', device_type: 'pwa', total_uptime_hours: 720.5, total_earned: '250.0000', heartbeat_count: 8640, streak_days: 30 }, { rank: 2, node_id: 'mn_top2', device_type: 'android', total_uptime_hours: 680.2, total_earned: '230.5000', heartbeat_count: 8162, streak_days: 28 }] },
        notes: ['Public endpoint -- no API key required', 'Rankings update after each epoch'],
    },
    // --- VISION NODE LOCAL API ---
    {
        id: 'vn_actions', action: 'GET /agent/v1/actions', title: 'List Actions', cat: 'Vision Node', desc: 'Auto-discovery endpoint listing all available Vision Node API actions. No authentication required.', auth: false,
        fields: [],
        req: {},
        res: { success: true, version: '1.0.0', actions: [{ method: 'POST', path: '/agent/v1/node/status', description: 'Get current node status' }] },
        notes: ['Base URL: http://localhost:9090', 'No Bearer token required for this endpoint', 'Returns all available actions with method, path, and description'],
    },
    {
        id: 'vn_node_status', action: 'POST /agent/v1/node/status', title: 'Node Status', cat: 'Vision Node', desc: 'Get comprehensive node status including uptime, heartbeat, system resources, and storage statistics.', auth: true,
        fields: [],
        req: {},
        res: { success: true, isRunning: true, nodeId: 'mn_4447f5224bc4927f', nodeClass: 'full', email: 'user@example.com', uptimeSeconds: 3600, heartbeat: { isRunning: true, totalHeartbeats: 12, weight: 1.0 }, system: { hostname: 'my-node', platform: 'darwin', arch: 'arm64', cpus: 10, totalMemoryMB: 16384, freeMemoryMB: 8000 }, storage: { path: '~/.visionnode/storage', maxGB: 100, usedBytes: 0, totalChunks: 0, totalFiles: 0, usagePercent: 0 } },
        notes: ['Auth: Bearer token in Authorization header', 'Bearer token is the node API key or "vision-agent-local"'],
    },
    {
        id: 'vn_node_start', action: 'POST /agent/v1/node/start', title: 'Start Node', cat: 'Vision Node', desc: 'Start the Vision Node and all services (heartbeat, storage, dashboard).', auth: true,
        fields: [],
        req: {},
        res: { success: true, message: 'Node started' },
        errors: [{ code: 500, msg: 'Failed to start node' }],
    },
    {
        id: 'vn_node_stop', action: 'POST /agent/v1/node/stop', title: 'Stop Node', cat: 'Vision Node', desc: 'Gracefully stop the Vision Node and all services.', auth: true,
        fields: [],
        req: {},
        res: { success: true, message: 'Node stopped' },
    },
    {
        id: 'vn_node_config', action: 'POST /agent/v1/node/config', title: 'Node Config', cat: 'Vision Node', desc: 'Get or update node configuration. Pass a "set" object with key-value pairs to update settings.', auth: true,
        fields: [
            { name: 'set', type: 'object', required: false, desc: 'Key-value pairs to update: storageMaxGB, heartbeatIntervalMs, dashboardPort, p2pPort, nodeClass, environment' },
        ],
        req: { set: { storageMaxGB: 200 } },
        res: { success: true, updated: ['storageMaxGB'], rejected: [], config: { nodeId: 'mn_abc', nodeClass: 'full', storageMaxGB: 200 } },
        notes: ['Only allowlisted keys can be updated: storageMaxGB, heartbeatIntervalMs, dashboardPort, p2pPort, nodeClass, environment', 'Sensitive fields like apiKey are never exposed'],
    },
    {
        id: 'vn_storage_upload', action: 'POST /agent/v1/storage/upload', title: 'Upload Data', cat: 'Vision Node', desc: 'Upload data to the node\'s local distributed storage. Data must be base64-encoded. Files are automatically chunked, hashed, and assigned a CID.', auth: true,
        fields: [
            { name: 'data', type: 'string', required: true, desc: 'Base64-encoded file data' },
            { name: 'metadata', type: 'object', required: false, desc: 'Optional metadata key-value pairs' },
        ],
        req: { data: 'SGVsbG8gV29ybGQ=', metadata: { source: 'agent' } },
        res: { success: true, file_key: 'file_c2df782428d3', cid: 'vcn://1cda25e4f184...', merkle_root: '1cda25e4f184...', total_size: 11, chunk_count: 1 },
        notes: ['Max upload size: 50MB per request', 'Files automatically chunked into 1MB pieces', 'Each chunk is SHA-256 hashed, Merkle tree root computed as CID'],
    },
    {
        id: 'vn_storage_download', action: 'POST /agent/v1/storage/download', title: 'Download Data', cat: 'Vision Node', desc: 'Download a file by its file_key. Returns base64-encoded data.', auth: true,
        fields: [
            { name: 'file_key', type: 'string', required: true, desc: 'File key returned from upload' },
        ],
        req: { file_key: 'file_c2df782428d3' },
        res: { success: true, data: 'SGVsbG8gV29ybGQ=', size: 11 },
        errors: [{ code: 404, msg: 'File not found' }],
    },
    {
        id: 'vn_storage_delete', action: 'POST /agent/v1/storage/delete', title: 'Delete File', cat: 'Vision Node', desc: 'Delete a stored file by file_key.', auth: true,
        fields: [
            { name: 'file_key', type: 'string', required: true, desc: 'File key to delete' },
        ],
        req: { file_key: 'file_c2df782428d3' },
        res: { success: true, message: 'File deleted' },
    },
    {
        id: 'vn_storage_list', action: 'POST /agent/v1/storage/list', title: 'List Files', cat: 'Vision Node', desc: 'List all files stored on this node with metadata.', auth: true,
        fields: [],
        req: {},
        res: { success: true, count: 2, files: [{ file_key: 'file_abc123', merkle_root: '1cda...', total_size: 1024, chunk_count: 1, created_at: 1708000000000 }] },
    },
    {
        id: 'vn_storage_stats', action: 'POST /agent/v1/storage/stats', title: 'Storage Stats', cat: 'Vision Node', desc: 'Get storage engine statistics: total chunks, files, usage percentage, and capacity.', auth: true,
        fields: [],
        req: {},
        res: { success: true, totalChunks: 15, totalSizeBytes: 5242880, maxSizeBytes: 107374182400, usagePercent: 0.005, totalFiles: 3 },
    },
    {
        id: 'vn_heartbeat_stats', action: 'POST /agent/v1/heartbeat/stats', title: 'Heartbeat Stats', cat: 'Vision Node', desc: 'Get heartbeat service statistics including total beats, weight multiplier, and pending reward.', auth: true,
        fields: [],
        req: {},
        res: { success: true, isRunning: true, lastHeartbeat: 1708000000000, totalHeartbeats: 288, consecutiveFailures: 0, weight: 1.0, pendingReward: 12.35, uptimeHours: 24 },
    },
    {
        id: 'vn_heartbeat_beat', action: 'POST /agent/v1/heartbeat/beat', title: 'Force Heartbeat', cat: 'Vision Node', desc: 'Force an immediate heartbeat to the Vision Chain backend. Useful for testing or ensuring node is marked active.', auth: true,
        fields: [],
        req: {},
        res: { success: true, message: 'Heartbeat sent', totalHeartbeats: 289, weight: 1.0, pendingReward: 12.39 },
        errors: [{ code: 500, msg: 'Heartbeat failed' }],
    },
];

const cats = ['System', 'Wallet', 'Transfer', 'Staking', 'Bridge', 'NFT', 'Authority', 'Settlement', 'Node', 'Mobile Node', 'Vision Node', 'Storage', 'Pipeline', 'Webhook', 'Hosting', 'Social', 'Network'];
const guideSections = ['overview', 'authentication', 'quickstart', 'sdks', 'rate-limits', 'errors', 'network', 'webhooks', 'rp-system', 'mobile-node', 'vision-node'];
const guideLabels: Record<string, string> = { overview: 'Overview', authentication: 'Authentication', quickstart: 'Quick Start', sdks: 'SDKs & Install', 'rate-limits': 'Rate Limits', errors: 'Error Codes', network: 'Network Config', webhooks: 'Webhooks', 'rp-system': 'RP Rewards', 'mobile-node': 'Mobile Node', 'vision-node': 'Vision Node' };

// ─── Code generators ───
type Lang = 'curl' | 'python' | 'js' | 'ts' | 'go' | 'rust' | 'ethers';
const LANGS: Lang[] = ['curl', 'python', 'js', 'ts', 'go', 'rust', 'ethers'];
const LANG_LABELS: Record<Lang, string> = { curl: 'cURL', python: 'Python', js: 'JavaScript', ts: 'TypeScript', go: 'Go', rust: 'Rust', ethers: 'ethers.js' };

const curl = (e: Endpoint) => `curl -X POST ${API} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(e.req, null, 2)}'`;

const py = (e: Endpoint) => { const p = Object.entries(e.req).filter(([k]) => k !== 'action' && k !== 'api_key').map(([k, v]) => `    "${k}": ${JSON.stringify(v)}`).join(',\n'); return `import requests\n\nres = requests.post("${API}", json={\n    "action": "${e.action}",\n    "api_key": "vcn_your_api_key"${p ? ',\n' + p : ''}\n})\nprint(res.json())`; };

const js = (e: Endpoint) => { const p = Object.entries(e.req).filter(([k]) => k !== 'action' && k !== 'api_key').map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join(',\n'); return `const res = await fetch("${API}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    action: "${e.action}",\n    api_key: "vcn_your_api_key"${p ? ',\n' + p : ''}\n  })\n});\nconst data = await res.json();\nconsole.log(data);`; };

const ts = (e: Endpoint) => { const p = Object.entries(e.req).filter(([k]) => k !== 'action' && k !== 'api_key').map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join(',\n'); return `interface VCNResponse {\n  success: boolean;\n  [key: string]: unknown;\n}\n\nconst res = await fetch("${API}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    action: "${e.action}",\n    api_key: process.env.VCN_API_KEY${p ? ',\n' + p : ''}\n  })\n});\nconst data: VCNResponse = await res.json();`; };

const goGen = (e: Endpoint) => { const body = JSON.stringify(e.req, null, 2).replace(/"/g, '\\"'); return `package main\n\nimport (\n  "bytes"\n  "encoding/json"\n  "fmt"\n  "net/http"\n  "io"\n)\n\nfunc main() {\n  payload := map[string]interface{}{\n    "action":  "${e.action}",\n    "api_key": "vcn_your_api_key",${Object.entries(e.req).filter(([k]) => k !== 'action' && k !== 'api_key').map(([k, v]) => `\n    "${k}":    ${JSON.stringify(v)},`).join('')}\n  }\n  body, _ := json.Marshal(payload)\n  resp, err := http.Post(\n    "${API}",\n    "application/json",\n    bytes.NewBuffer(body),\n  )\n  if err != nil {\n    panic(err)\n  }\n  defer resp.Body.Close()\n  result, _ := io.ReadAll(resp.Body)\n  fmt.Println(string(result))\n}`; };

const rustGen = (e: Endpoint) => { const fields = Object.entries(e.req).map(([k, v]) => `    json!("${k}": ${JSON.stringify(v)})`).join(',\n'); return `use reqwest;\nuse serde_json::json;\n\n#[tokio::main]\nasync fn main() -> Result<(), Box<dyn std::error::Error>> {\n    let client = reqwest::Client::new();\n    let res = client\n        .post("${API}")\n        .json(&json!({\n            "action": "${e.action}",\n            "api_key": "vcn_your_api_key"${Object.entries(e.req).filter(([k]) => k !== 'action' && k !== 'api_key').map(([k, v]) => `,\n            "${k}": ${JSON.stringify(v)}`).join('')}\n        }))\n        .send()\n        .await?;\n    let body = res.text().await?;\n    println!("{}", body);\n    Ok(())\n}`; };

const ethersGen = (e: Endpoint) => `import { ethers } from "ethers";\n\n// Direct on-chain interaction with Vision Chain\nconst provider = new ethers.JsonRpcProvider("${NET.rpc}");\nconst wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);\n\n// VCN Token contract\nconst vcnToken = new ethers.Contract(\n  "${NET.tokenAddr}",\n  ["function transfer(address to, uint256 amount)",\n   "function balanceOf(address) view returns (uint256)",\n   "function approve(address spender, uint256 amount)"],\n  wallet\n);\n\n// Check balance\nconst balance = await vcnToken.balanceOf(wallet.address);\nconsole.log("Balance:", ethers.formatEther(balance), "VCN");\n\n// Transfer VCN\nconst tx = await vcnToken.transfer(\n  "0xRecipient...",\n  ethers.parseEther("10")\n);\nawait tx.wait();\nconsole.log("TX:", tx.hash);`;

const codeForLang = (e: Endpoint, l: Lang): string => {
    switch (l) {
        case 'curl': return curl(e);
        case 'python': return py(e);
        case 'js': return js(e);
        case 'ts': return ts(e);
        case 'go': return goGen(e);
        case 'rust': return rustGen(e);
        case 'ethers': return ethersGen(e);
    }
};

// ─── Component ───
export default function DevDocs(): JSX.Element {
    const [active, setActive] = createSignal('overview');
    const [lang, setLang] = createSignal<Lang>('curl');
    const [copied, setCopied] = createSignal('');
    const [query, setQuery] = createSignal('');
    const [mobileOpen, setMobileOpen] = createSignal(false);

    const [tryParams, setTryParams] = createSignal<Record<string, string>>({});
    const [tryResult, setTryResult] = createSignal<string>('');
    const [tryLoading, setTryLoading] = createSignal(false);

    const isGuide = () => guideSections.includes(active());
    const currentEp = () => eps.find(e => e.id === active());

    const filteredEps = createMemo(() => {
        const q = query().toLowerCase();
        if (!q) return eps;
        return eps.filter(e => e.title.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q));
    });

    const copy = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(''), 2000); };
    const code = (e: Endpoint) => codeForLang(e, lang());

    const navigate = (id: string) => { setActive(id); setMobileOpen(false); };

    // ─── Render helpers ───
    const CopyBtn = (props: { text: string; id: string; cls?: string }) => (
        <button onClick={() => copy(props.text, props.id)} class={`p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5 flex-shrink-0 ${props.cls ?? ''}`}>
            <Show when={copied() === props.id} fallback={<I d="copy" c="w-3.5 h-3.5 inline-block" />}><span class="text-emerald-400"><I d="check" c="w-3.5 h-3.5 inline-block" /></span></Show>
        </button>
    );

    const CodeBlock = (props: { code: string; id: string; label?: string; color?: string }) => (
        <div class="bg-[#0d1117] border border-white/[0.06] rounded-xl overflow-hidden shadow-lg shadow-black/20">
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <div class="flex items-center gap-2">
                    <div class="flex gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-red-500/60" /><div class="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /><div class="w-2.5 h-2.5 rounded-full bg-green-500/60" /></div>
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">{props.label ?? 'code'}</span>
                </div>
                <CopyBtn text={props.code} id={props.id} />
            </div>
            <div class="relative">
                <div class="absolute left-0 top-0 bottom-0 w-10 bg-white/[0.01] border-r border-white/[0.04] flex flex-col items-end pt-4 pr-2 text-[10px] text-gray-600 font-mono leading-relaxed select-none">
                    <For each={props.code.split('\n')}>{(_, i) => <div>{i() + 1}</div>}</For>
                </div>
                <pre class="p-4 pl-12 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre" innerHTML={highlight(props.code, props.label ?? '')} />
            </div>
        </div>
    );

    const InfoRow = (props: { label: string; value: string; mono?: boolean }) => (
        <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03] group">
            <span class="text-xs text-gray-500">{props.label}</span>
            <div class="flex items-center gap-2">
                <code class={`text-xs ${props.mono ? 'font-mono' : ''} text-gray-300`}>{props.value}</code>
                <CopyBtn text={props.value} id={`info-${props.label}`} cls="opacity-0 group-hover:opacity-100" />
            </div>
        </div>
    );

    // ─── Guide pages ───
    const renderGuide = () => {
        const s = active();
        if (s === 'overview') return renderOverview();
        if (s === 'authentication') return renderAuth();
        if (s === 'quickstart') return renderQuickstart();
        if (s === 'sdks') return renderSDKs();
        if (s === 'rate-limits') return renderRateLimits();
        if (s === 'errors') return renderErrors();
        if (s === 'network') return renderNetwork();
        if (s === 'webhooks') return renderWebhooks();
        if (s === 'rp-system') return renderRP();
        if (s === 'mobile-node') return renderMobileNode();
        if (s === 'vision-node') return renderVisionNode();
        return null;
    };

    const renderOverview = () => (
        <div class="space-y-8">
            <div>
                <h2 class="text-3xl font-black tracking-tight mb-3">Vision Chain Developer API</h2>
                <p class="text-gray-400 leading-relaxed max-w-2xl">The Agent Gateway API provides a single REST endpoint for AI agents and developers to interact with Vision Chain. All 60 actions are accessible via <code class="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded text-xs">POST</code> requests to one URL.</p>
            </div>
            <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
                <span class="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded">BASE URL</span>
                <code class="text-sm text-gray-300 font-mono break-all flex-1">{API}</code>
                <CopyBtn text={API} id="base-url" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[{ n: '59', l: 'API Actions', d: 'Wallet, Staking, Bridge, NFT, Node, Storage, Pipeline, Hosting' }, { n: '0', l: 'Gas Fees', d: 'All transactions are gasless' }, { n: '100', l: 'VCN Funded', d: 'Auto-funded on registration' }].map(c => (
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <div class="text-3xl font-black text-white mb-1">{c.n}</div>
                        <div class="text-sm font-bold text-gray-300 mb-1">{c.l}</div>
                        <div class="text-xs text-gray-500">{c.d}</div>
                    </div>
                ))}
            </div>
            <div>
                <h3 class="text-lg font-bold text-white mb-4">How It Works</h3>
                <div class="space-y-3">
                    {[
                        { s: '1', t: 'Register', d: 'Call register to create an agent. You receive a wallet address, API key, and 100 VCN.' },
                        { s: '2', t: 'Authenticate', d: 'Include your api_key in every subsequent request for authenticated actions.' },
                        { s: '3', t: 'Transact', d: 'Transfer, stake, claim rewards, refer agents — all gasless through one endpoint.' },
                        { s: '4', t: 'Earn RP', d: 'Every action earns Reputation Points. Climb the leaderboard and unlock rewards.' },
                    ].map(step => (
                        <div class="flex gap-4 items-start bg-[#0a0a12] border border-white/5 rounded-xl p-4">
                            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-sm font-black flex-shrink-0">{step.s}</div>
                            <div><div class="text-sm font-bold text-white">{step.t}</div><div class="text-xs text-gray-400 mt-0.5">{step.d}</div></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderAuth = () => (
        <div class="space-y-8">
            <div><h2 class="text-3xl font-black tracking-tight mb-3">Authentication</h2><p class="text-gray-400 leading-relaxed max-w-2xl">Most API actions require authentication via an API key. The key is issued once during agent registration and must be included in the request body.</p></div>
            <div class="bg-amber-500/5 border border-amber-500/15 rounded-xl p-5">
                <h4 class="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Important</h4>
                <ul class="space-y-1.5 text-sm text-gray-400"><li>- Your API key is shown <strong class="text-white">only once</strong> at registration. Store it securely.</li><li>- Never expose your API key in client-side code or public repositories.</li><li>- If compromised, contact support to rotate your key.</li></ul>
            </div>
            <div><h3 class="text-lg font-bold text-white mb-3">Request Format</h3><p class="text-sm text-gray-400 mb-4">Include <code class="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded text-xs">api_key</code> in the JSON body of every authenticated request:</p>
                <CodeBlock code={`{\n  "action": "balance",\n  "api_key": "vcn_a1b2c3d4e5f6..."\n}`} id="auth-example" label="json" color="text-cyan-300/80" />
            </div>
            <div><h3 class="text-lg font-bold text-white mb-3">Public vs Authenticated</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    {[{ a: 'register', auth: false }, { a: 'network_info', auth: false }, { a: 'balance', auth: true }, { a: 'transfer', auth: true }, { a: 'stake', auth: true }, { a: 'referral', auth: true }].map(r => (
                        <div class="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.03]">
                            <code class="text-xs text-gray-300 font-mono">{r.a}</code>
                            <span class={`text-[9px] font-bold px-2 py-0.5 rounded ${r.auth ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>{r.auth ? 'Auth Required' : 'Public'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderQuickstart = () => (
        <div class="space-y-8">
            <div><h2 class="text-3xl font-black tracking-tight mb-3">Quick Start</h2><p class="text-gray-400 leading-relaxed max-w-2xl">Get your agent running on Vision Chain in under 2 minutes.</p></div>
            <div><h3 class="text-sm font-bold text-white mb-3">Step 1 -- Register your agent</h3>
                <CodeBlock code={`curl -X POST ${API} \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "action": "register",\n    "agent_name": "my-first-agent",\n    "platform": "openai",\n    "owner_email": "dev@example.com"\n  }'`} id="qs-1" label="bash" />
            </div>
            <div class="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-5">
                <h4 class="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">Response</h4>
                <p class="text-sm text-gray-400">You'll receive a <code class="text-cyan-400 text-xs">wallet_address</code>, <code class="text-cyan-400 text-xs">api_key</code>, and <code class="text-cyan-400 text-xs">100 VCN</code> funding.</p>
            </div>
            <div><h3 class="text-sm font-bold text-white mb-3">Step 2 -- Check your balance</h3>
                <CodeBlock code={`curl -X POST ${API} \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"balance","api_key":"vcn_your_api_key"}'`} id="qs-2" label="bash" />
            </div>
            <div><h3 class="text-sm font-bold text-white mb-3">Step 3 -- Send your first transfer</h3>
                <CodeBlock code={`curl -X POST ${API} \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "action": "transfer",\n    "api_key": "vcn_your_api_key",\n    "to": "0xRecipientAddress...",\n    "amount": "5"\n  }'`} id="qs-3" label="bash" />
            </div>
            <div><h3 class="text-sm font-bold text-white mb-3">Step 4 -- Stake and earn rewards</h3>
                <CodeBlock code={`curl -X POST ${API} \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"stake","api_key":"vcn_your_api_key","amount":"50"}'`} id="qs-4" label="bash" />
            </div>
            <div><h3 class="text-sm font-bold text-white mb-3">Python</h3>
                <CodeBlock code={`import requests\n\nAPI = "${API}"\n\ndef agent(action, **kw):\n    return requests.post(API, json={\n        "action": action, "api_key": "vcn_your_api_key", **kw\n    }).json()\n\n# Register\nresult = agent("register", agent_name="my-bot", platform="openai")\nprint("API Key:", result["agent"]["api_key"])\n\n# Check balance\nprint(agent("balance"))\n\n# Transfer\nprint(agent("transfer", to="0xRecipient...", amount="10"))\n\n# Stake\nprint(agent("stake", amount="50"))\n\n# Check leaderboard\nprint(agent("leaderboard", type="rp"))`} id="qs-py" label="python" />
            </div>
            <div><h3 class="text-sm font-bold text-white mb-3">TypeScript</h3>
                <CodeBlock code={`const API = "${API}";\n\ninterface VCNResponse { success: boolean; [key: string]: unknown; }\n\nasync function agent(action: string, params: Record<string, unknown> = {}): Promise<VCNResponse> {\n  const res = await fetch(API, {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({ action, api_key: process.env.VCN_API_KEY, ...params })\n  });\n  return res.json() as Promise<VCNResponse>;\n}\n\n// Register\nconst reg = await agent("register", { agent_name: "my-bot", platform: "openai" });\nconsole.log("API Key:", (reg as any).agent.api_key);\n\n// Transfer\nawait agent("transfer", { to: "0xRecipient...", amount: "10" });\n\n// Stake\nawait agent("stake", { amount: "50" });`} id="qs-ts" label="typescript" />
            </div>
            <div><h3 class="text-sm font-bold text-white mb-3">Go</h3>
                <CodeBlock code={`package main\n\nimport (\n  "bytes"\n  "encoding/json"\n  "fmt"\n  "io"\n  "net/http"\n)\n\nconst api = "${API}"\n\nfunc agentCall(action string, extra map[string]interface{}) (map[string]interface{}, error) {\n  payload := map[string]interface{}{\n    "action":  action,\n    "api_key": "vcn_your_api_key",\n  }\n  for k, v := range extra {\n    payload[k] = v\n  }\n  body, _ := json.Marshal(payload)\n  resp, err := http.Post(api, "application/json", bytes.NewBuffer(body))\n  if err != nil {\n    return nil, err\n  }\n  defer resp.Body.Close()\n  raw, _ := io.ReadAll(resp.Body)\n  var result map[string]interface{}\n  json.Unmarshal(raw, &result)\n  return result, nil\n}\n\nfunc main() {\n  // Register\n  res, _ := agentCall("register", map[string]interface{}{\n    "agent_name": "my-bot",\n    "platform":   "openai",\n  })\n  fmt.Println(res)\n\n  // Transfer\n  res, _ = agentCall("transfer", map[string]interface{}{\n    "to": "0xRecipient...", "amount": "10",\n  })\n  fmt.Println("TX:", res)\n}`} id="qs-go" label="go" />
            </div>
            <div><h3 class="text-sm font-bold text-white mb-3">ethers.js (Direct On-Chain)</h3>
                <CodeBlock code={`import { ethers } from "ethers";\n\n// Connect to Vision Chain\nconst provider = new ethers.JsonRpcProvider("${NET.rpc}");\nconst wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);\n\n// VCN Token contract\nconst vcn = new ethers.Contract(\n  "${NET.tokenAddr}",\n  [\n    "function transfer(address to, uint256 amount) returns (bool)",\n    "function balanceOf(address owner) view returns (uint256)",\n    "function approve(address spender, uint256 amount) returns (bool)",\n    "function allowance(address owner, address spender) view returns (uint256)"\n  ],\n  wallet\n);\n\n// Check balance\nconst balance = await vcn.balanceOf(wallet.address);\nconsole.log("Balance:", ethers.formatEther(balance), "VCN");\n\n// Transfer tokens\nconst tx = await vcn.transfer("0xRecipient...", ethers.parseEther("10"));\nawait tx.wait();\nconsole.log("TX Hash:", tx.hash);\n\n// Approve staking contract\nconst approveTx = await vcn.approve(\n  "${NET.staking}",\n  ethers.parseEther("50")\n);\nawait approveTx.wait();`} id="qs-ethers" label="ethers.js" />
            </div>
        </div>
    );

    const renderRateLimits = () => (
        <div class="space-y-8">
            <div><h2 class="text-3xl font-black tracking-tight mb-3">Rate Limits</h2><p class="text-gray-400 leading-relaxed max-w-2xl">The API enforces rate limits to ensure fair usage and network stability.</p></div>
            <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                <div class="grid grid-cols-3 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Tier</div><div>Limit</div><div>Window</div></div>
                {[{ t: 'Default', l: '60 requests', w: 'per minute' }, { t: 'Registered Agent', l: '120 requests', w: 'per minute' }, { t: 'Transfer', l: '10 per agent', w: 'per minute' }, { t: 'Register', l: '5 per IP', w: 'per hour' }].map(r => (
                    <div class="grid grid-cols-3 gap-4 px-5 py-3 border-b border-white/[0.03] text-sm"><span class="text-white font-medium">{r.t}</span><span class="text-gray-400">{r.l}</span><span class="text-gray-500">{r.w}</span></div>
                ))}
            </div>
            <div class="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-5"><h4 class="text-xs font-black text-cyan-400 mb-2">RESPONSE HEADERS</h4><p class="text-sm text-gray-400">Rate limit info is included in response headers: <code class="text-cyan-400 text-xs">X-RateLimit-Remaining</code>, <code class="text-cyan-400 text-xs">X-RateLimit-Reset</code></p></div>
        </div>
    );

    const renderErrors = () => (
        <div class="space-y-8">
            <div><h2 class="text-3xl font-black tracking-tight mb-3">Error Codes</h2><p class="text-gray-400 leading-relaxed max-w-2xl">The API uses standard HTTP status codes. Error responses include a JSON body with details.</p></div>
            <CodeBlock code={`{\n  "success": false,\n  "error": "Insufficient VCN balance",\n  "code": 400\n}`} id="err-example" label="Error Response" color="text-red-300/80" />
            <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                <div class="grid grid-cols-[80px_1fr_2fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Code</div><div>Status</div><div>Description</div></div>
                {[
                    { c: 200, s: 'OK', d: 'Request successful', cl: 'text-emerald-400 bg-emerald-500/10' },
                    { c: 201, s: 'Created', d: 'Agent registered successfully', cl: 'text-emerald-400 bg-emerald-500/10' },
                    { c: 400, s: 'Bad Request', d: 'Missing or invalid parameters', cl: 'text-amber-400 bg-amber-500/10' },
                    { c: 401, s: 'Unauthorized', d: 'Missing or invalid API key', cl: 'text-red-400 bg-red-500/10' },
                    { c: 404, s: 'Not Found', d: 'Agent not found', cl: 'text-red-400 bg-red-500/10' },
                    { c: 409, s: 'Conflict', d: 'Agent name already taken', cl: 'text-orange-400 bg-orange-500/10' },
                    { c: 429, s: 'Too Many Requests', d: 'Rate limit exceeded', cl: 'text-amber-400 bg-amber-500/10' },
                    { c: 500, s: 'Server Error', d: 'Internal server error', cl: 'text-red-400 bg-red-500/10' },
                ].map(e => (
                    <div class="grid grid-cols-[80px_1fr_2fr] gap-4 px-5 py-3 border-b border-white/[0.03] text-sm items-center">
                        <span class={`text-[10px] font-bold px-2 py-1 rounded text-center ${e.cl}`}>{e.c}</span>
                        <span class="text-white font-medium">{e.s}</span>
                        <span class="text-gray-400 text-xs">{e.d}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderNetwork = () => (
        <div class="space-y-8">
            <div><h2 class="text-3xl font-black tracking-tight mb-3">Network Configuration</h2><p class="text-gray-400 leading-relaxed max-w-2xl">Essential parameters for connecting to Vision Chain.</p></div>
            <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                <div class="px-5 py-3 bg-white/[0.03] border-b border-white/5"><span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Network Details</span></div>
                <InfoRow label="Network Name" value={NET.name} /><InfoRow label="Chain ID" value={String(NET.chainId)} mono /><InfoRow label="RPC URL" value={NET.rpc} mono /><InfoRow label="Currency Symbol" value={NET.token} /><InfoRow label="Block Explorer" value={NET.explorer} mono />
            </div>
            <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                <div class="px-5 py-3 bg-white/[0.03] border-b border-white/5"><span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contract Addresses</span></div>
                <InfoRow label="VCN Token (ERC-20)" value={NET.tokenAddr} mono /><InfoRow label="Paymaster" value={NET.paymaster} mono /><InfoRow label="Bridge Staking" value={NET.staking} mono />
            </div>
            <div><h3 class="text-lg font-bold text-white mb-3">Add to MetaMask</h3>
                <CodeBlock code={`await window.ethereum.request({\n  method: 'wallet_addEthereumChain',\n  params: [{\n    chainId: '0x${NET.chainId.toString(16)}',\n    chainName: '${NET.name}',\n    nativeCurrency: { name: 'VCN', symbol: 'VCN', decimals: 18 },\n    rpcUrls: ['${NET.rpc}'],\n    blockExplorerUrls: ['${NET.explorer}']\n  }]\n});`} id="metamask" label="javascript" />
            </div>
        </div>
    );

    const renderRP = () => (
        <div class="space-y-8">
            <div><h2 class="text-3xl font-black tracking-tight mb-3">RP Reward System</h2><p class="text-gray-400 leading-relaxed max-w-2xl">Reputation Points (RP) are earned by performing actions on Vision Chain. RP determines your rank on the leaderboard.</p></div>
            <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                <div class="grid grid-cols-2 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Action</div><div>RP Earned</div></div>
                {[{ a: 'Approve Spender', r: 3 }, { a: 'Transfer VCN', r: 5 }, { a: 'Batch Transfer', r: '5/ea' }, { a: 'Unstake VCN', r: 5 }, { a: 'Withdraw Unstaked', r: 5 }, { a: 'Claim Rewards', r: 10 }, { a: 'Mint SBT', r: 10 }, { a: 'Create Pipeline', r: 10 }, { a: 'Execute Pipeline', r: 10 }, { a: 'Compound Rewards', r: 15 }, { a: 'Bridge Initiate', r: 15 }, { a: 'Stake VCN', r: 20 }, { a: 'Batch Transfer (50)', r: 20 }, { a: 'NFT Mint', r: 30 }, { a: 'New Agent Signup Bonus', r: 25 }, { a: 'Refer Another Agent', r: 50 }].map(r => (
                    <div class="grid grid-cols-2 gap-4 px-5 py-3 border-b border-white/[0.03]"><span class="text-sm text-gray-300">{r.a}</span><span class="text-sm font-bold text-purple-400">+{r.r} RP</span></div>
                ))}
            </div>
            <div class="bg-purple-500/5 border border-purple-500/10 rounded-xl p-5"><h4 class="text-xs font-black text-purple-400 mb-2">Leaderboard</h4><p class="text-sm text-gray-400">Use the <button onClick={() => setActive('leaderboard')} class="text-cyan-400 hover:underline cursor-pointer">leaderboard</button> action to check your rank. Top agents earn additional rewards during Rush Rounds.</p></div>
        </div>
    );

    const renderSDKs = () => (
        <div class="space-y-8">
            <div>
                <h2 class="text-3xl font-black tracking-tight mb-3">SDKs & Installation</h2>
                <p class="text-gray-400 leading-relaxed max-w-2xl">Vision Chain provides REST API access in every language. Below are recommended libraries and install commands for each supported language.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { lang: 'Python', ver: '3.8+', icon: 'python', install: 'pip install requests', dep: 'requests', color: 'from-yellow-500/10 to-blue-500/10', border: 'border-yellow-500/20' },
                    { lang: 'JavaScript', ver: 'ES2020+', icon: 'js', install: 'npm install node-fetch', dep: 'fetch (built-in) or node-fetch', color: 'from-yellow-400/10 to-yellow-600/10', border: 'border-yellow-400/20' },
                    { lang: 'TypeScript', ver: '4.5+', icon: 'ts', install: 'npm install typescript @types/node', dep: 'Built-in fetch + type definitions', color: 'from-blue-400/10 to-blue-600/10', border: 'border-blue-400/20' },
                    { lang: 'Go', ver: '1.20+', icon: 'go', install: 'go mod init myagent', dep: 'net/http (standard library)', color: 'from-cyan-400/10 to-cyan-600/10', border: 'border-cyan-400/20' },
                    { lang: 'Rust', ver: '1.70+', icon: 'rs', install: 'cargo add reqwest serde_json tokio --features reqwest/json,tokio/full', dep: 'reqwest + serde_json + tokio', color: 'from-orange-400/10 to-red-500/10', border: 'border-orange-400/20' },
                    { lang: 'ethers.js', ver: 'v6', icon: 'ethers', install: 'npm install ethers@6', dep: 'Direct on-chain contract calls', color: 'from-purple-400/10 to-indigo-500/10', border: 'border-purple-400/20' },
                ].map(s => (
                    <div class={`bg-gradient-to-br ${s.color} border ${s.border} rounded-xl p-5 space-y-3`}>
                        <div class="flex items-center justify-between">
                            <h4 class="text-sm font-black text-white">{s.lang}</h4>
                            <span class="text-[9px] font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded">{s.ver}</span>
                        </div>
                        <div class="bg-black/30 rounded-lg px-3 py-2 font-mono text-xs text-cyan-300 flex items-center gap-2">
                            <I d="terminal" c="w-3 h-3 inline-block text-gray-500 flex-shrink-0" />
                            <code class="break-all">{s.install}</code>
                            <CopyBtn text={s.install} id={`sdk-${s.lang}`} />
                        </div>
                        <p class="text-[11px] text-gray-500">{s.dep}</p>
                    </div>
                ))}
            </div>
            <div>
                <h3 class="text-lg font-bold text-white mb-4">Language Feature Matrix</h3>
                <div class="bg-[#0d1117] border border-white/[0.06] rounded-xl overflow-hidden">
                    <div class="grid grid-cols-[1.5fr_repeat(6,1fr)] gap-0 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">
                        <div>Feature</div><div>Python</div><div>JS</div><div>TS</div><div>Go</div><div>Rust</div><div>ethers</div>
                    </div>
                    {[
                        { f: 'REST API calls', v: [1, 1, 1, 1, 1, 0] },
                        { f: 'Type safety', v: [0, 0, 1, 1, 1, 1] },
                        { f: 'Async support', v: [1, 1, 1, 1, 1, 1] },
                        { f: 'On-chain direct', v: [0, 0, 0, 0, 0, 1] },
                        { f: 'Contract interaction', v: [0, 0, 0, 0, 0, 1] },
                        { f: 'Zero dependencies', v: [0, 1, 0, 1, 0, 0] },
                    ].map(r => (
                        <div class="grid grid-cols-[1.5fr_repeat(6,1fr)] gap-0 px-4 py-2.5 border-b border-white/[0.03] text-xs">
                            <span class="text-gray-400">{r.f}</span>
                            <For each={r.v}>{v => <span innerHTML={v ? `<span class="text-emerald-400">${svg.check.replace('currentColor', '#34d399')}</span>` : '<span class="text-gray-700">--</span>'} class="w-4 h-4" />}</For>
                        </div>
                    ))}
                </div>
            </div>
            <div class="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-5">
                <h4 class="text-xs font-black text-cyan-400 mb-2">ETHERS.JS: ON-CHAIN VS API</h4>
                <p class="text-sm text-gray-400">The <strong class="text-white">ethers.js</strong> examples interact directly with Vision Chain smart contracts via RPC. This is different from the REST API -- use ethers.js when you need direct contract calls, token approvals, or custom transaction construction. For standard agent operations (register, transfer, stake), the REST API is recommended.</p>
            </div>
        </div>
    );

    const renderWebhooks = () => (
        <div class="space-y-8">
            <div>
                <h2 class="text-3xl font-black tracking-tight mb-3">Webhooks & Events</h2>
                <p class="text-gray-400 leading-relaxed max-w-2xl">Subscribe to real-time events from Vision Chain. Webhooks deliver push notifications to your endpoint when on-chain or agent events occur.</p>
            </div>
            <div><h3 class="text-lg font-bold text-white mb-3">Register a Webhook</h3>
                <CodeBlock code={`curl -X POST ${API} \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "webhook_subscribe",
    "api_key": "vcn_your_api_key",
    "url": "https://your-server.com/webhook",
    "events": ["transfer.received", "stake.completed", "reward.claimed"]
  }'`} id="wh-register" label="bash" />
            </div>
            <div><h3 class="text-lg font-bold text-white mb-4">Available Events</h3>
                <div class="bg-[#0d1117] border border-white/[0.06] rounded-xl overflow-hidden">
                    <div class="grid grid-cols-[1.5fr_2fr_0.6fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Event</div><div>Description</div><div>Payload</div></div>
                    {[
                        { e: 'transfer.sent', d: 'VCN transfer initiated by your agent', p: 'tx_hash, amount, to' },
                        { e: 'transfer.received', d: 'VCN received by your agent wallet', p: 'tx_hash, amount, from' },
                        { e: 'stake.completed', d: 'Staking transaction confirmed', p: 'tx_hash, amount' },
                        { e: 'unstake.initiated', d: 'Unstake request submitted', p: 'tx_hash, amount, cooldown_until' },
                        { e: 'unstake.ready', d: 'Cooldown period ended, ready to withdraw', p: 'amount' },
                        { e: 'reward.claimed', d: 'Staking rewards claimed', p: 'tx_hash, amount' },
                        { e: 'rp.earned', d: 'Reputation points earned', p: 'rp_amount, action, total_rp' },
                        { e: 'referral.signup', d: 'New agent signed up via your referral', p: 'agent_name, rp_earned' },
                    ].map(r => (
                        <div class="grid grid-cols-[1.5fr_2fr_0.6fr] gap-4 px-5 py-2.5 border-b border-white/[0.03] text-xs">
                            <code class="text-cyan-400 font-mono text-[11px]">{r.e}</code>
                            <span class="text-gray-400">{r.d}</span>
                            <span class="text-gray-600 text-[10px]">{r.p}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div><h3 class="text-lg font-bold text-white mb-3">Webhook Payload Format</h3>
                <CodeBlock code={`{
  "event": "transfer.received",
  "timestamp": "2026-02-13T05:49:10Z",
  "agent_name": "my-trading-bot",
  "data": {
    "tx_hash": "0xdef...789",
    "amount": "10",
    "from": "0x5678...efgh"
  },
  "signature": "sha256=a1b2c3d4e5f6..."
}`} id="wh-payload" label="json" />
            </div>
            <div><h3 class="text-lg font-bold text-white mb-3">Verify Webhook Signature</h3>
                <CodeBlock code={`import hmac, hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)`} id="wh-verify" label="python" />
            </div>
            <div class="bg-amber-500/5 border border-amber-500/15 rounded-xl p-5">
                <h4 class="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Retry Policy</h4>
                <ul class="space-y-1.5 text-sm text-gray-400">
                    <li>- Failed deliveries are retried <strong class="text-white">3 times</strong> with exponential backoff (5s, 30s, 5min).</li>
                    <li>- Your endpoint must return <code class="text-cyan-400 text-xs">200 OK</code> within <strong class="text-white">10 seconds</strong>.</li>
                    <li>- After 3 failures, the webhook is disabled and you'll receive an email notification.</li>
                </ul>
            </div>
        </div>
    );

    const renderMobileNode = () => (
        <div class="space-y-8">
            <div>
                <h2 class="text-3xl font-black tracking-tight mb-3">Mobile Node & Ecosystem Impact</h2>
                <p class="text-gray-400 leading-relaxed max-w-2xl">Mobile Nodes transform everyday devices -- phones, tablets, and browsers -- into active participants of the Vision Chain network. This section explains how they strengthen the ecosystem and why they matter.</p>
            </div>

            {/* Core Concept */}
            <div class="bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 border border-cyan-500/10 rounded-xl p-6 space-y-4">
                <h3 class="text-lg font-bold text-white">What is a Mobile Node?</h3>
                <p class="text-sm text-gray-400 leading-relaxed">A Mobile Node is a lightweight, browser-based (PWA) or mobile-app-based node that contributes to Vision Chain's decentralized infrastructure simply by staying online. Unlike traditional validator nodes that require dedicated hardware, Mobile Nodes run passively in a browser tab or mobile app, sending periodic heartbeats to prove liveness.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    {[
                        { t: 'Zero Setup', d: 'No downloads, no hardware. Register with email and start earning in seconds.' },
                        { t: 'Passive Income', d: 'Earn VCN rewards automatically while browsing or keeping your phone unlocked.' },
                        { t: 'WiFi or Cellular', d: 'Works on any connection. WiFi earns 0.01x weight, cellular at efficient mode (0.005x).' },
                    ].map(c => (
                        <div class="bg-black/20 border border-white/5 rounded-xl p-4">
                            <div class="text-sm font-bold text-white mb-1">{c.t}</div>
                            <div class="text-xs text-gray-500">{c.d}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Ecosystem Impact */}
            <div>
                <h3 class="text-lg font-bold text-white mb-4">Ecosystem Impact</h3>
                <div class="space-y-4">
                    {[
                        { n: '1', t: 'Decentralized Edge Infrastructure', d: 'Mobile Nodes form a geographically distributed mesh of always-online endpoints. As the node count grows, this edge network can serve as a foundation for decentralized data relay, content caching, and censorship-resistant access points -- reducing reliance on centralized cloud providers.' },
                        { n: '2', t: 'Network Resilience & Liveness', d: 'Every heartbeat from a Mobile Node acts as a liveness proof, contributing to the network\'s health metrics. A larger pool of active nodes makes the network more resilient against localized outages. The heartbeat system ensures only genuinely active devices earn rewards, preventing sybil farming.' },
                        { n: '3', t: 'Token Distribution & Velocity', d: 'Mobile Nodes provide an organic, merit-based mechanism for distributing VCN to a broad user base. Unlike airdrops or ICOs, rewards are earned through sustained participation, creating genuine token holders with aligned incentives. This drives healthy token velocity as users stake, transfer, and interact with the ecosystem.' },
                        { n: '4', t: 'User Acquisition Flywheel', d: 'The referral code system embedded in Mobile Nodes creates a viral growth loop: each node operator can invite others via their unique referral code, and both parties benefit. This turns every Mobile Node user into a network ambassador, driving organic growth without paid acquisition.' },
                        { n: '5', t: 'Data & Intelligence Layer', d: 'Aggregated (anonymized) metadata from heartbeats -- device types, network modes, geographic distribution, peak activity hours -- provides valuable intelligence for optimizing network parameters, predicting demand, and planning infrastructure scaling.' },
                    ].map(step => (
                        <div class="flex gap-4 items-start bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-sm font-black flex-shrink-0">{step.n}</div>
                            <div>
                                <div class="text-sm font-bold text-white mb-1">{step.t}</div>
                                <div class="text-xs text-gray-400 leading-relaxed">{step.d}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reward Mechanics */}
            <div>
                <h3 class="text-lg font-bold text-white mb-4">Reward Mechanics</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                    <div class="grid grid-cols-[1.2fr_2fr_0.8fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Factor</div><div>Description</div><div>Impact</div></div>
                    {[
                        { f: 'Base Heartbeat', d: 'VCN reward per valid heartbeat (every 5 min)', i: '+VCN per beat' },
                        { f: 'WiFi Mode', d: 'Full-bandwidth mode on WiFi connection', i: '0.01x weight' },
                        { f: 'Cellular Mode', d: 'Reduced-bandwidth mode on cellular data', i: '0.005x weight' },
                        { f: 'Daily Streak', d: 'Consecutive days with at least 1 heartbeat', i: 'Streak bonus' },
                        { f: 'Epoch Accumulation', d: 'Rewards accumulate per epoch, claimable anytime', i: 'Compound' },
                        { f: 'Referral Bonus', d: 'Invite new nodes via your referral code', i: '+VCN per ref' },
                    ].map(r => (
                        <div class="grid grid-cols-[1.2fr_2fr_0.8fr] gap-4 px-5 py-3 border-b border-white/[0.03] text-xs">
                            <span class="text-white font-medium">{r.f}</span>
                            <span class="text-gray-400">{r.d}</span>
                            <span class="text-cyan-400 font-bold">{r.i}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Architecture Diagram */}
            <div>
                <h3 class="text-lg font-bold text-white mb-4">Architecture</h3>
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-6">
                    <div class="flex flex-wrap justify-center gap-4 text-xs">
                        {[
                            { label: 'PWA / Mobile App', sub: 'Visibility API + Timer', color: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/20' },
                            { label: 'Heartbeat Engine', sub: 'Every 5 min', color: 'from-purple-500/20 to-indigo-500/20', border: 'border-purple-500/20' },
                            { label: 'Agent Gateway', sub: 'mobile_node.* endpoints', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/20' },
                            { label: 'Firestore', sub: 'mobile_nodes collection', color: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/20' },
                            { label: 'Epoch Processor', sub: 'Reward calculation', color: 'from-pink-500/20 to-red-500/20', border: 'border-pink-500/20' },
                        ].map((node, i) => (
                            <div class="flex items-center gap-3">
                                <div class={`bg-gradient-to-br ${node.color} border ${node.border} rounded-xl px-4 py-3 text-center min-w-[140px]`}>
                                    <div class="text-white font-bold text-xs">{node.label}</div>
                                    <div class="text-gray-500 text-[10px] mt-0.5">{node.sub}</div>
                                </div>
                                <Show when={i < 4}>
                                    <svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </Show>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Start */}
            <div>
                <h3 class="text-lg font-bold text-white mb-3">Quick Start (cURL)</h3>
                <CodeBlock code={`# 1. Register a mobile node\ncurl -X POST ${API} \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"mobile_node.register","email":"user@example.com","device_type":"pwa"}'\n\n# 2. Send heartbeat (use the vcn_mn_ key from registration)\ncurl -X POST ${API} \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"mobile_node.heartbeat","api_key":"vcn_mn_your_key","mode":"wifi_full"}'\n\n# 3. Check status\ncurl -X POST ${API} \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"mobile_node.status","api_key":"vcn_mn_your_key"}'\n\n# 4. Claim rewards\ncurl -X POST ${API} \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"mobile_node.claim_reward","api_key":"vcn_mn_your_key"}'\n\n# 5. Check leaderboard (public)\ncurl -X POST ${API} \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"mobile_node.leaderboard","limit":10}'`} id="mn-quickstart" label="bash" />
            </div>

            {/* Vision */}
            <div class="bg-gradient-to-r from-cyan-500/5 to-purple-500/5 border border-cyan-500/10 rounded-xl p-6">
                <h4 class="text-xs font-black uppercase tracking-widest text-cyan-400 mb-3">The Bigger Picture</h4>
                <p class="text-sm text-gray-400 leading-relaxed">Mobile Nodes represent Vision Chain's commitment to true decentralization. By turning every browser tab and mobile device into a network participant, we're building infrastructure that scales with its community rather than its cloud budget. Every heartbeat you send strengthens the network, earns you VCN, and moves us closer to a world where blockchain infrastructure is powered by the people who use it.</p>
            </div>
        </div>
    );

    const renderVisionNode = () => (
        <div class="space-y-8">
            <div>
                <h2 class="text-3xl font-black tracking-tight mb-3">Vision Node Local API</h2>
                <p class="text-gray-400 leading-relaxed max-w-2xl">Vision Node is a desktop CLI node that runs locally on your machine. It provides a REST API at <code class="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded text-xs">localhost:9090</code> for programmatic control by AI agents.</p>
            </div>

            <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
                <span class="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded">BASE URL</span>
                <code class="text-sm text-gray-300 font-mono break-all flex-1">http://localhost:9090/agent/v1</code>
                <CopyBtn text="http://localhost:9090/agent/v1" id="vn-base-url" />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[{ n: '11', l: 'API Endpoints', d: 'Node control, Storage, Heartbeat' }, { n: '9090', l: 'Default Port', d: 'Dashboard + API on same port' }, { n: '50MB', l: 'Upload Limit', d: 'Per request, auto-chunked' }].map(c => (
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-5">
                        <div class="text-3xl font-black text-white mb-1">{c.n}</div>
                        <div class="text-sm font-bold text-gray-300 mb-1">{c.l}</div>
                        <div class="text-xs text-gray-500">{c.d}</div>
                    </div>
                ))}
            </div>

            <div class="bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 border border-emerald-500/10 rounded-xl p-6 space-y-4">
                <h3 class="text-lg font-bold text-white">Architecture</h3>
                <p class="text-sm text-gray-400 leading-relaxed">Vision Node runs as a local process with an Express server hosting both the web dashboard (HTML/CSS/JS) and the Agent REST API. The dashboard provides real-time monitoring via SVG gauges and SSE, while the API enables programmatic control.</p>
                <div class="flex flex-wrap justify-center gap-4 text-xs mt-4">
                    {[
                        { label: 'Vision Node CLI', sub: 'init / start / stop', color: 'from-emerald-500/20 to-green-500/20', border: 'border-emerald-500/20' },
                        { label: 'Express Server', sub: 'Port 9090', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/20' },
                        { label: 'Agent API', sub: '/agent/v1/*', color: 'from-purple-500/20 to-indigo-500/20', border: 'border-purple-500/20' },
                        { label: 'Storage Engine', sub: 'SQLite + Chunks', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/20' },
                        { label: 'Vision Chain', sub: 'Heartbeat + Rewards', color: 'from-pink-500/20 to-red-500/20', border: 'border-pink-500/20' },
                    ].map((node, i) => (
                        <div class="flex items-center gap-3">
                            <div class={`bg-gradient-to-br ${node.color} border ${node.border} rounded-xl px-4 py-3 text-center min-w-[130px]`}>
                                <div class="text-white font-bold text-xs">{node.label}</div>
                                <div class="text-gray-500 text-[10px] mt-0.5">{node.sub}</div>
                            </div>
                            <Show when={i < 4}>
                                <svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </Show>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 class="text-lg font-bold text-white mb-3">Authentication</h3>
                <p class="text-sm text-gray-400 mb-4">Vision Node API uses Bearer token authentication. Include the token in the <code class="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded text-xs">Authorization</code> header.</p>
                <CodeBlock code={`curl -X POST http://localhost:9090/agent/v1/node/status \\
  -H "Authorization: Bearer vision-agent-local" \\
  -H "Content-Type: application/json"`} id="vn-auth-example" label="bash" />
            </div>

            <div class="bg-amber-500/5 border border-amber-500/15 rounded-xl p-5">
                <h4 class="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Auth Tokens</h4>
                <ul class="space-y-1.5 text-sm text-gray-400"><li>- The node's <strong class="text-white">API key</strong> from config (set during <code class="text-cyan-400 text-xs">vision-node init</code>)</li><li>- The local agent key: <code class="text-cyan-400 text-xs">vision-agent-local</code></li><li>- The discovery endpoint <code class="text-cyan-400 text-xs">GET /agent/v1/actions</code> requires <strong class="text-white">no auth</strong></li></ul>
            </div>

            <div>
                <h3 class="text-lg font-bold text-white mb-3">Quick Start</h3>
                <CodeBlock code={`# 1. Install and initialize\nnpm install -g @visionchain/node\nvision-node init\n\n# 2. Start the node (dashboard + API)\nvision-node start\n\n# 3. Discover available endpoints\ncurl http://localhost:9090/agent/v1/actions\n\n# 4. Check node status\ncurl -X POST http://localhost:9090/agent/v1/node/status \\
  -H "Authorization: Bearer vision-agent-local"\n\n# 5. Upload data (base64 encoded)\ncurl -X POST http://localhost:9090/agent/v1/storage/upload \\
  -H "Authorization: Bearer vision-agent-local" \\
  -H "Content-Type: application/json" \\
  -d '{"data": "SGVsbG8gV29ybGQ=", "metadata": {"source": "agent"}}'\n\n# 6. List stored files\ncurl -X POST http://localhost:9090/agent/v1/storage/list \\
  -H "Authorization: Bearer vision-agent-local"\n\n# 7. Force a heartbeat\ncurl -X POST http://localhost:9090/agent/v1/heartbeat/beat \\
  -H "Authorization: Bearer vision-agent-local"`} id="vn-quickstart" label="bash" />
            </div>

            <div class="bg-gradient-to-r from-emerald-500/5 to-purple-500/5 border border-emerald-500/10 rounded-xl p-6">
                <h4 class="text-xs font-black uppercase tracking-widest text-emerald-400 mb-3">What Vision Node Does</h4>
                <p class="text-sm text-gray-400 leading-relaxed">Vision Node turns your desktop into a full participant of the Vision Chain distributed storage network. It stores data chunks locally, sends heartbeats to earn VCN rewards, and exposes a REST API so AI agents can programmatically store and retrieve data. The web dashboard at localhost:9090 provides real-time monitoring with gauges, charts, and network contribution visualization.</p>
            </div>
        </div>
    );

    const renderEndpoint = () => {
        const ep = currentEp();
        if (!ep) return null;
        return (
            <div class="space-y-8">
                <div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{ep.cat}</span>
                        <span class={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${ep.auth ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'}`}>
                            <I d={ep.auth ? 'lock' : 'unlock'} c="w-3 h-3 inline-block" />{ep.auth ? 'Auth Required' : 'Public'}
                        </span>
                    </div>
                    <h2 class="text-3xl font-black tracking-tight mb-2">{ep.title}</h2>
                    <p class="text-gray-400 text-sm leading-relaxed max-w-2xl">{ep.desc}</p>
                    <Show when={ep.rp}><div class="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg"><I d="zap" c="w-4 h-4 inline-block text-purple-400" /><span class="text-xs font-bold text-purple-400">+{ep.rp} RP per action</span></div></Show>
                </div>

                {/* Endpoint URL */}
                <div class="bg-[#0a0a12] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                    <span class="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">POST</span>
                    <code class="text-sm text-gray-300 font-mono break-all flex-1">{API}</code>
                    <CopyBtn text={API} id="ep-url" />
                </div>

                {/* Parameters */}
                <Show when={ep.fields.length > 0}>
                    <div>
                        <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Parameters</h3>
                        <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                            <div class="grid grid-cols-[1.2fr_0.8fr_0.6fr_2fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500"><div>Name</div><div>Type</div><div>Required</div><div>Description</div></div>
                            <For each={ep.fields}>{f => (
                                <div class="grid grid-cols-[1.2fr_0.8fr_0.6fr_2fr] gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                                    <code class="text-cyan-400 text-xs font-mono">{f.name}</code>
                                    <span class="text-gray-500 text-xs">{f.type}</span>
                                    <span class={`text-xs font-bold ${f.required ? 'text-amber-400' : 'text-gray-600'}`}>{f.required ? 'Yes' : 'No'}</span>
                                    <span class="text-gray-400 text-xs">{f.desc}</span>
                                </div>
                            )}</For>
                        </div>
                    </div>
                </Show>

                {/* Code Examples */}
                <div>
                    <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Code Examples</h3>
                    <div class="bg-[#0d1117] border border-white/[0.06] rounded-xl overflow-hidden shadow-lg shadow-black/20">
                        <div class="flex items-center gap-1 p-2 border-b border-white/[0.06] bg-white/[0.02] overflow-x-auto">
                            <For each={LANGS}>{l => (
                                <button onClick={() => setLang(l)} class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${lang() === l ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-white'}`}>{LANG_LABELS[l]}</button>
                            )}</For>
                            <CopyBtn text={code(ep)} id="ep-code" cls="ml-auto" />
                        </div>
                        <div class="relative">
                            <div class="absolute left-0 top-0 bottom-0 w-10 bg-white/[0.01] border-r border-white/[0.04] flex flex-col items-end pt-5 pr-2 text-[10px] text-gray-600 font-mono leading-relaxed select-none">
                                <For each={code(ep).split('\n')}>{(_, i) => <div>{i() + 1}</div>}</For>
                            </div>
                            <pre class="p-5 pl-12 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre" innerHTML={highlight(code(ep), lang())} />
                        </div>
                    </div>
                </div>

                {/* Interactive Try It */}
                <div>
                    <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                        <I d="play" c="w-4 h-4 inline-block text-emerald-400" />API Playground
                    </h3>
                    <div class="bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/15 rounded-xl overflow-hidden">
                        <div class="p-5 space-y-4">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">API Key</label>
                                    <input type="text" placeholder="vcn_your_api_key" class="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/30" />
                                </div>
                                <For each={ep.fields}>{f => (
                                    <div>
                                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                            {f.name} {f.required && <span class="text-amber-400">*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={String((ep.req as Record<string, unknown>)[f.name] ?? f.desc)}
                                            value={tryParams()[f.name] ?? ''}
                                            onInput={e => setTryParams(prev => ({ ...prev, [f.name]: e.currentTarget.value }))}
                                            class="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/30"
                                        />
                                    </div>
                                )}</For>
                            </div>
                            <div class="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setTryLoading(true);
                                        const payload = { action: ep.action, api_key: 'vcn_demo_key', ...Object.fromEntries(Object.entries(tryParams()).filter(([, v]) => v)) };
                                        setTryResult(JSON.stringify(ep.res, null, 2));
                                        setTimeout(() => setTryLoading(false), 800);
                                    }}
                                    class="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-all"
                                >
                                    <I d={tryLoading() ? 'terminal' : 'play'} c="w-3.5 h-3.5 inline-block" />
                                    {tryLoading() ? 'Sending...' : 'Send Request'}
                                </button>
                                <span class="text-[10px] text-gray-600">Simulated response (demo mode)</span>
                            </div>
                        </div>
                        <Show when={tryResult()}>
                            <div class="border-t border-white/[0.06] bg-black/20 p-5">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">200 OK</span>
                                    <CopyBtn text={tryResult()} id="try-res" />
                                </div>
                                <pre class="text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre" innerHTML={highlight(tryResult(), 'json')} />
                            </div>
                        </Show>
                    </div>
                </div>

                {/* Response */}
                <div>
                    <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Response</h3>
                    <div class="bg-[#0a0a12] border border-white/5 rounded-xl overflow-hidden">
                        <div class="flex items-center justify-between p-3 border-b border-white/5 bg-white/[0.02]">
                            <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">200 OK</span>
                            <CopyBtn text={JSON.stringify(ep.res, null, 2)} id="ep-res" />
                        </div>
                        <pre class="p-5 text-xs text-emerald-300/80 font-mono leading-relaxed overflow-x-auto whitespace-pre">{JSON.stringify(ep.res, null, 2)}</pre>
                    </div>
                </div>

                {/* Errors */}
                <Show when={ep.errors && ep.errors.length > 0}>
                    <div><h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Error Responses</h3>
                        <div class="space-y-2"><For each={ep.errors}>{e => (<div class="flex items-center gap-3 bg-[#0a0a12] border border-red-500/10 rounded-xl px-5 py-3"><span class="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">{e.code}</span><span class="text-xs text-gray-400">{e.msg}</span></div>)}</For></div>
                    </div>
                </Show>

                {/* Notes */}
                <Show when={ep.notes && ep.notes.length > 0}>
                    <div class="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-5">
                        <h4 class="text-xs font-black uppercase tracking-widest text-cyan-400 mb-3">Notes</h4>
                        <ul class="space-y-1.5"><For each={ep.notes}>{n => (<li class="text-sm text-gray-400 flex items-start gap-2"><span class="text-cyan-400 mt-0.5">-</span>{n}</li>)}</For></ul>
                    </div>
                </Show>
            </div>
        );
    };

    // ─── Layout ───
    return (
        <div class="min-h-screen bg-[#06060a] text-white font-sans">
            {/* Mobile header */}
            <div class="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#06060a]/95 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <h1 class="text-lg font-black">API <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Docs</span></h1>
                <button onClick={() => setMobileOpen(!mobileOpen())} class="p-2 text-gray-400"><I d={mobileOpen() ? 'x' : 'menu'} c="w-5 h-5 inline-block" /></button>
            </div>

            <div class="flex">
                {/* Sidebar */}
                <aside class={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-[#08080e] border-r border-white/5 flex flex-col z-40 overflow-y-auto transition-transform lg:translate-x-0 ${mobileOpen() ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div class="p-6 border-b border-white/5">
                        <a href="/" class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs mb-4"><I d="arrow" c="w-3.5 h-3.5 inline-block" />Back to Vision Chain</a>
                        <h1 class="text-xl font-black tracking-tight">Vision Chain <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">API</span></h1>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">v2.0 Developer Docs</div>
                    </div>

                    {/* Search */}
                    <div class="px-4 pt-4">
                        <div class="relative">
                            <I d="search" c="w-3.5 h-3.5 inline-block absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input type="text" placeholder="Search actions..." value={query()} onInput={e => setQuery(e.currentTarget.value)} class="w-full bg-white/5 border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/30" />
                        </div>
                    </div>

                    <nav class="flex-1 p-4 space-y-5 overflow-y-auto">
                        {/* Guides */}
                        <div>
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-3">Getting Started</div>
                            <div class="space-y-0.5">
                                <For each={guideSections}>{s => (
                                    <button onClick={() => navigate(s)} class={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-all ${active() === s ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/5 text-white border-l-2 border-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'}`}>{guideLabels[s]}</button>
                                )}</For>
                            </div>
                        </div>

                        {/* API Endpoints */}
                        <For each={cats}>{cat => (
                            <div>
                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-3">{cat}</div>
                                <div class="space-y-0.5">
                                    <For each={filteredEps().filter(e => e.cat === cat)}>{ep => (
                                        <button onClick={() => navigate(ep.id)} class={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${active() === ep.id ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/5 text-white border-l-2 border-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'}`}>
                                            <span class="font-semibold">{ep.title}</span>
                                            <Show when={ep.rp}><span class="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">+{ep.rp}</span></Show>
                                        </button>
                                    )}</For>
                                </div>
                            </div>
                        )}</For>

                        {/* Resources */}
                        <div class="border-t border-white/5 pt-4">
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-3">Resources</div>
                            <a href="/api" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]"><I d="ext" c="w-3.5 h-3.5 inline-block" />API Hub</a>
                            <a href="/agent" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]"><I d="ext" c="w-3.5 h-3.5 inline-block" />Agent Dashboard</a>
                            <a href="/visionscan" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]"><I d="ext" c="w-3.5 h-3.5 inline-block" />VisionScan</a>
                            <a href="/skill.md" target="_blank" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]"><I d="ext" c="w-3.5 h-3.5 inline-block" />skill.md</a>
                        </div>
                    </nav>

                    <div class="p-4 border-t border-white/5 text-[10px] text-gray-600 uppercase tracking-widest text-center">Vision Chain &copy; 2026</div>
                </aside>

                {/* Overlay for mobile */}
                <Show when={mobileOpen()}><div class="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileOpen(false)} /></Show>

                {/* Main Content */}
                <main class="flex-1 min-h-screen lg:ml-0 pt-16 lg:pt-0">
                    <div class="max-w-4xl mx-auto p-6 lg:p-12">
                        {isGuide() ? renderGuide() : renderEndpoint()}
                    </div>
                </main>
            </div>
        </div>
    );
}
