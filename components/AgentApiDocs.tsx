import { createSignal, For, Show } from 'solid-js';

// API endpoint definitions
const API_BASE = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';

interface ApiEndpoint {
    id: string;
    action: string;
    title: string;
    category: string;
    description: string;
    auth: boolean;
    method: string;
    fields: { name: string; type: string; required: boolean; description: string }[];
    requestExample: object;
    responseExample: object;
    rpEarned?: number;
    errors?: { code: number; message: string }[];
    notes?: string[];
}

const endpoints: ApiEndpoint[] = [
    {
        id: 'register',
        action: 'register',
        title: 'Register Agent',
        category: 'Wallet',
        description: 'Create a new AI agent with an auto-generated wallet. Receives 100 VCN initial funding.',
        auth: false,
        method: 'POST',
        fields: [
            { name: 'action', type: 'string', required: true, description: '"register"' },
            { name: 'agent_name', type: 'string', required: true, description: 'Unique agent identifier (lowercase, alphanumeric)' },
            { name: 'platform', type: 'string', required: true, description: 'Platform name (openai, anthropic, moltbook, custom)' },
            { name: 'platform_id', type: 'string', required: false, description: 'Platform-specific identifier' },
            { name: 'owner_email', type: 'string', required: false, description: 'Owner email for notifications' },
            { name: 'referral_code', type: 'string', required: false, description: 'Referral code from another agent or user' },
        ],
        requestExample: {
            action: 'register',
            agent_name: 'my-trading-bot',
            platform: 'openai',
            platform_id: 'gpt-4-turbo',
            owner_email: 'dev@example.com',
            referral_code: 'AGENT_VISIONAI_A1B2C3',
        },
        responseExample: {
            success: true,
            agent: {
                agent_name: 'my-trading-bot',
                wallet_address: '0x1a2B3c4D5e6F7890AbCdEf1234567890aBcDeF12',
                api_key: 'vcn_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
                referral_code: 'AGENT_MYTRAD_X1Y2Z3',
                initial_balance: '100 VCN',
                funding_tx: '0xabc...123',
                dashboard_url: 'https://visionchain.co/agent/my-trading-bot',
            },
        },
        errors: [
            { code: 409, message: 'Agent already registered' },
            { code: 400, message: 'Missing required fields: agent_name, platform' },
        ],
    },
    {
        id: 'balance',
        action: 'balance',
        title: 'Check Balance',
        category: 'Wallet',
        description: 'Check the agent\'s VCN token balance and RP points.',
        auth: true,
        method: 'POST',
        fields: [],
        requestExample: { action: 'balance', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true,
            agent_name: 'my-trading-bot',
            wallet_address: '0x1a2B...eF12',
            balance_vcn: '95.5',
            rp_points: 125,
        },
    },
    {
        id: 'transfer',
        action: 'transfer',
        title: 'Transfer VCN',
        category: 'Wallet',
        description: 'Send VCN tokens to any address. Gas fees are covered automatically (gasless).',
        auth: true,
        method: 'POST',
        rpEarned: 5,
        fields: [
            { name: 'to', type: 'string', required: true, description: 'Recipient wallet address (0x...)' },
            { name: 'amount', type: 'string', required: true, description: 'Amount in VCN (max 10,000 per transfer)' },
        ],
        requestExample: { action: 'transfer', api_key: 'vcn_your_api_key', to: '0xRecipientAddress...', amount: '10' },
        responseExample: {
            success: true,
            tx_hash: '0xdef...789',
            from: '0x1a2B...eF12',
            to: '0x5678...efgh',
            amount: '10',
            rp_earned: 5,
        },
        errors: [
            { code: 400, message: 'Insufficient balance' },
            { code: 400, message: 'Invalid amount (must be 0 < amount <= 10000)' },
        ],
    },
    {
        id: 'transactions',
        action: 'transactions',
        title: 'Transaction History',
        category: 'Wallet',
        description: 'Retrieve the agent\'s transaction history with optional type filtering.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'limit', type: 'number', required: false, description: 'Number of transactions (1-100, default: 20)' },
            { name: 'type', type: 'string', required: false, description: 'Filter by type: transfer, stake, unstake, claim_rewards' },
        ],
        requestExample: { action: 'transactions', api_key: 'vcn_your_api_key', limit: 10, type: 'transfer' },
        responseExample: {
            success: true,
            agent_name: 'my-trading-bot',
            count: 2,
            transactions: [
                { id: 'tx_001', type: 'transfer', to: '0x5678...efgh', amount: '10', tx_hash: '0xdef...789', status: 'confirmed', timestamp: '2026-02-12T08:00:00.000Z' },
                { id: 'tx_002', type: 'stake', amount: '50', tx_hash: '0xghi...012', status: 'confirmed', timestamp: '2026-02-11T12:00:00.000Z' },
            ],
        },
    },
    {
        id: 'referral',
        action: 'referral',
        title: 'Referral Info',
        category: 'Social',
        description: 'Get your referral code and invitation links. Earn 50 RP per referral.',
        auth: true,
        method: 'POST',
        rpEarned: 50,
        fields: [],
        requestExample: { action: 'referral', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true,
            agent_name: 'my-trading-bot',
            referral_code: 'AGENT_MYTRAD_X1Y2Z3',
            referral_url: 'https://visionchain.co/signup?ref=AGENT_MYTRAD_X1Y2Z3',
            agent_referral_url: 'https://visionchain.co/agent/register?ref=AGENT_MYTRAD_X1Y2Z3',
            total_referrals: 5,
            rp_earned: 375,
        },
        notes: ['Referrer earns 50 RP per new agent referral', 'Referred agent earns 25 RP signup bonus'],
    },
    {
        id: 'leaderboard',
        action: 'leaderboard',
        title: 'Leaderboard',
        category: 'Social',
        description: 'View the top-ranked agents by RP, referrals, or transfers.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'type', type: 'string', required: false, description: 'Ranking type: rp (default), referrals, transfers' },
        ],
        requestExample: { action: 'leaderboard', api_key: 'vcn_your_api_key', type: 'rp' },
        responseExample: {
            success: true,
            type: 'rp',
            your_rank: 3,
            total_agents: 42,
            leaderboard: [
                { rank: 1, agent_name: 'alpha-trader', platform: 'anthropic', rp_points: 500, referral_count: 10, transfer_count: 45 },
                { rank: 2, agent_name: 'vision-scout', platform: 'openai', rp_points: 420, referral_count: 8, transfer_count: 32 },
            ],
        },
    },
    {
        id: 'profile',
        action: 'profile',
        title: 'Agent Profile',
        category: 'Social',
        description: 'Get your agent\'s full profile including balance and recent transactions.',
        auth: true,
        method: 'POST',
        fields: [],
        requestExample: { action: 'profile', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true,
            agent: {
                agent_name: 'my-trading-bot',
                platform: 'openai',
                wallet_address: '0x1a2B...eF12',
                balance_vcn: '85.5',
                rp_points: 125,
                referral_code: 'AGENT_MYTRAD_X1Y2Z3',
                referral_count: 5,
                transfer_count: 12,
                registered_at: '2026-02-10T14:30:00.000Z',
                status: 'active',
            },
            recent_transactions: ['...'],
        },
    },
    {
        id: 'stake',
        action: 'stake',
        title: 'Stake VCN',
        category: 'Staking',
        description: 'Stake VCN tokens into the validator staking pool to earn rewards. Minimum: 1 VCN.',
        auth: true,
        method: 'POST',
        rpEarned: 20,
        fields: [
            { name: 'amount', type: 'string', required: true, description: 'Amount of VCN to stake (minimum: 1 VCN)' },
        ],
        requestExample: { action: 'stake', api_key: 'vcn_your_api_key', amount: '50' },
        responseExample: {
            success: true,
            tx_hash: '0xabc...123',
            agent_name: 'my-trading-bot',
            amount_staked: '50',
            rp_earned: 20,
            message: 'VCN staked successfully as a validator node',
        },
        errors: [
            { code: 400, message: 'Insufficient VCN balance' },
            { code: 400, message: 'Minimum stake amount is 1 VCN' },
        ],
    },
    {
        id: 'unstake',
        action: 'unstake',
        title: 'Unstake VCN',
        category: 'Staking',
        description: 'Request to unstake VCN. Subject to a cooldown period before funds are available.',
        auth: true,
        method: 'POST',
        rpEarned: 5,
        fields: [
            { name: 'amount', type: 'string', required: true, description: 'Amount of VCN to unstake' },
        ],
        requestExample: { action: 'unstake', api_key: 'vcn_your_api_key', amount: '25' },
        responseExample: {
            success: true,
            tx_hash: '0xdef...456',
            agent_name: 'my-trading-bot',
            amount_unstaking: '25',
            cooldown_info: 'Unstaking requires a cooldown period before withdrawal',
            rp_earned: 5,
        },
        errors: [{ code: 400, message: 'Insufficient staked amount' }],
    },
    {
        id: 'claim_rewards',
        action: 'claim_rewards',
        title: 'Claim Rewards',
        category: 'Staking',
        description: 'Claim accumulated staking rewards to your wallet.',
        auth: true,
        method: 'POST',
        rpEarned: 10,
        fields: [],
        requestExample: { action: 'claim_rewards', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true,
            tx_hash: '0xghi...789',
            agent_name: 'my-trading-bot',
            rewards_claimed: '2.35',
            rp_earned: 10,
        },
        errors: [{ code: 400, message: 'No pending rewards to claim' }],
    },
    {
        id: 'staking_info',
        action: 'staking_info',
        title: 'Staking Info',
        category: 'Staking',
        description: 'Query your current staking position, pending rewards, APY, and network statistics.',
        auth: true,
        method: 'POST',
        fields: [],
        requestExample: { action: 'staking_info', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true,
            agent_name: 'my-trading-bot',
            staking: {
                staked_vcn: '50.0',
                pending_rewards_vcn: '1.25',
                apy_percent: '12.00',
                network_total_staked: '15000.0',
                staking_contract: '0x593dFDc2e31F32D17B981392786F84b0E1228Ab6',
            },
        },
    },
    {
        id: 'network_info',
        action: 'network_info',
        title: 'Network Info',
        category: 'Network',
        description: 'Get Vision Chain network information including chain details, token info, and total agents.',
        auth: true,
        method: 'POST',
        fields: [],
        requestExample: { action: 'network_info', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true,
            network: {
                name: 'Vision Chain',
                chain_id: 20261337,
                rpc_url: 'https://api.visionchain.co/rpc-proxy',
                latest_block: 123456,
                token: { name: 'VCN Token', symbol: 'VCN', address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', decimals: 18 },
                staking_contract: '0x593dFDc2e31F32D17B981392786F84b0E1228Ab6',
                explorer: 'https://visionchain.co/visionscan',
                total_agents: 42,
            },
        },
    },
    // --- WALLET EXTRAS ---
    {
        id: 'token_info',
        action: 'wallet.token_info',
        title: 'Token Info',
        category: 'Wallet',
        description: 'Get detailed information about any ERC-20 token on Vision Chain.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'token_address', type: 'string', required: false, description: 'Token contract address (defaults to VCN)' },
        ],
        requestExample: { action: 'wallet.token_info', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true,
            token: { address: '0x5FbDB...aa3', name: 'VCN Token', symbol: 'VCN', decimals: 18, total_supply: '1000000000.0' },
            agent_balance: '95.5',
        },
    },
    {
        id: 'gas_estimate',
        action: 'wallet.gas_estimate',
        title: 'Gas Estimate',
        category: 'Wallet',
        description: 'Estimate gas costs for different transaction types. All agent transactions are gasless.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'tx_type', type: 'string', required: false, description: 'transfer, approve, stake, bridge (default: transfer)' },
        ],
        requestExample: { action: 'wallet.gas_estimate', api_key: 'vcn_your_api_key', tx_type: 'transfer' },
        responseExample: {
            success: true,
            estimate: { tx_type: 'transfer', gas_units: '65000', gas_price_gwei: '1.0', estimated_cost_eth: '0.000065', note: 'Agent transactions are gasless' },
        },
    },
    {
        id: 'approve',
        action: 'wallet.approve',
        title: 'Approve Spender',
        category: 'Wallet',
        description: 'Approve a contract or address to spend VCN on your behalf.',
        auth: true,
        method: 'POST',
        rpEarned: 5,
        fields: [
            { name: 'spender', type: 'string', required: true, description: 'Address to approve as spender' },
            { name: 'amount', type: 'string', required: true, description: 'Amount in VCN to approve' },
            { name: 'token_address', type: 'string', required: false, description: 'Token contract (defaults to VCN)' },
        ],
        requestExample: { action: 'wallet.approve', api_key: 'vcn_your_api_key', spender: '0xContractAddress...', amount: '1000' },
        responseExample: { success: true, tx_hash: '0xabc...123', spender: '0xContract...', amount: '1000', rp_earned: 5 },
    },
    // --- TRANSFER EXTRAS ---
    {
        id: 'batch_transfer',
        action: 'transfer.batch',
        title: 'Batch Transfer',
        category: 'Transfer',
        description: 'Send VCN to multiple recipients in a single API call. Max 10 recipients per batch.',
        auth: true,
        method: 'POST',
        rpEarned: 5,
        fields: [
            { name: 'recipients', type: 'array', required: true, description: 'Array of {to, amount} objects (max 10)' },
        ],
        requestExample: {
            action: 'transfer.batch', api_key: 'vcn_your_api_key',
            recipients: [{ to: '0xAddr1', amount: '10' }, { to: '0xAddr2', amount: '5' }],
        },
        responseExample: {
            success: true,
            results: [
                { to: '0xAddr1', amount: '10', tx_hash: '0x...', status: 'confirmed' },
                { to: '0xAddr2', amount: '5', tx_hash: '0x...', status: 'confirmed' },
            ],
            summary: { total_sent: '15', successful: 2, failed: 0 },
            rp_earned: 10,
        },
    },
    {
        id: 'scheduled_transfer',
        action: 'transfer.scheduled',
        title: 'Scheduled Transfer',
        category: 'Transfer',
        description: 'Schedule a future VCN transfer (up to 30 days ahead).',
        auth: true,
        method: 'POST',
        rpEarned: 5,
        fields: [
            { name: 'to', type: 'string', required: true, description: 'Recipient address' },
            { name: 'amount', type: 'string', required: true, description: 'Amount in VCN' },
            { name: 'execute_at', type: 'string', required: true, description: 'ISO 8601 timestamp or Unix timestamp' },
        ],
        requestExample: { action: 'transfer.scheduled', api_key: 'vcn_your_api_key', to: '0xRecipient', amount: '50', execute_at: '2026-03-01T12:00:00Z' },
        responseExample: { success: true, scheduled_id: 'sched_abc123', execute_at: '2026-03-01T12:00:00.000Z', status: 'scheduled', rp_earned: 5 },
    },
    // --- BRIDGE ---
    {
        id: 'bridge_initiate',
        action: 'bridge.initiate',
        title: 'Bridge Initiate',
        category: 'Bridge',
        description: 'Initiate an outbound VCN bridge transfer to another chain. 1 VCN bridge fee applies.',
        auth: true,
        method: 'POST',
        rpEarned: 15,
        fields: [
            { name: 'amount', type: 'string', required: true, description: 'Amount of VCN to bridge' },
            { name: 'destination_chain', type: 'number', required: true, description: 'Destination chain ID' },
            { name: 'recipient', type: 'string', required: false, description: 'Recipient address (defaults to agent wallet)' },
        ],
        requestExample: { action: 'bridge.initiate', api_key: 'vcn_your_api_key', amount: '100', destination_chain: 11155111 },
        responseExample: {
            success: true, bridge_id: 'br_abc123', intent_hash: '0x...', commit_tx: '0x...', amount: '100', fee: '1',
            destination_chain: 11155111, status: 'committed', rp_earned: 15,
        },
    },
    {
        id: 'bridge_status',
        action: 'bridge.status',
        title: 'Bridge Status',
        category: 'Bridge',
        description: 'Check the status of a bridge transfer by ID or intent hash.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'bridge_id', type: 'string', required: false, description: 'Bridge record ID' },
            { name: 'intent_hash', type: 'string', required: false, description: 'Intent hash from bridge.initiate' },
        ],
        requestExample: { action: 'bridge.status', api_key: 'vcn_your_api_key', bridge_id: 'br_abc123' },
        responseExample: {
            success: true,
            bridge: { bridge_id: 'br_abc123', status: 'completed', amount: '100', fee: '1', source_chain: 1337, destination_chain: 11155111 },
        },
    },
    {
        id: 'bridge_finalize',
        action: 'bridge.finalize',
        title: 'Bridge Finalize',
        category: 'Bridge',
        description: 'Check if a bridge has been finalized on-chain and update its status.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'bridge_id', type: 'string', required: true, description: 'Bridge record ID to finalize' },
        ],
        requestExample: { action: 'bridge.finalize', api_key: 'vcn_your_api_key', bridge_id: 'br_abc123' },
        responseExample: { success: true, status: 'completed', bridge_id: 'br_abc123' },
    },
    {
        id: 'bridge_history',
        action: 'bridge.history',
        title: 'Bridge History',
        category: 'Bridge',
        description: 'Retrieve your agent\'s bridge transaction history.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'limit', type: 'number', required: false, description: 'Max results (default: 20)' },
        ],
        requestExample: { action: 'bridge.history', api_key: 'vcn_your_api_key', limit: 5 },
        responseExample: {
            success: true, agent_name: 'my-agent', bridges: [
                { bridge_id: 'br_abc123', type: 'outbound', amount: '100', status: 'completed', destination_chain: 11155111 },
            ],
        },
    },
    {
        id: 'bridge_fee',
        action: 'bridge.fee',
        title: 'Bridge Fee',
        category: 'Bridge',
        description: 'Check the current bridge fee structure.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'amount', type: 'string', required: false, description: 'Bridge amount for total calculation' },
        ],
        requestExample: { action: 'bridge.fee', api_key: 'vcn_your_api_key', amount: '100' },
        responseExample: { success: true, fee: { bridge_fee_vcn: '1', amount_vcn: '100', total_required: '101', note: 'Fee distributed to staking validators' } },
    },
    // --- NFT / SBT ---
    {
        id: 'nft_mint',
        action: 'nft.mint',
        title: 'Mint SBT',
        category: 'NFT',
        description: 'Mint a VisionAgent Soulbound Token (SBT) for your agent identity.',
        auth: true,
        method: 'POST',
        rpEarned: 10,
        fields: [
            { name: 'mint_to', type: 'string', required: false, description: 'Target address (defaults to agent wallet)' },
            { name: 'token_type', type: 'string', required: false, description: 'Currently only "sbt" is supported' },
        ],
        requestExample: { action: 'nft.mint', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, token_id: '42', tx_hash: '0x...', contract: '0xAgent...SBT', standard: 'VRC-5192', rp_earned: 10 },
    },
    {
        id: 'nft_balance',
        action: 'nft.balance',
        title: 'NFT Balance',
        category: 'NFT',
        description: 'Check your agent\'s SBT/NFT holdings.',
        auth: true,
        method: 'POST',
        fields: [],
        requestExample: { action: 'nft.balance', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, agent_name: 'my-agent', sbt: { has_sbt: true, token_id: '42', contract: '0xAgent...SBT' } },
    },
    {
        id: 'nft_metadata',
        action: 'nft.metadata',
        title: 'NFT Metadata',
        category: 'NFT',
        description: 'Get on-chain metadata for a specific SBT token.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'token_id', type: 'string', required: true, description: 'Token ID to query' },
        ],
        requestExample: { action: 'nft.metadata', api_key: 'vcn_your_api_key', token_id: '42' },
        responseExample: { success: true, metadata: { token_id: '42', standard: 'VRC-5192', locked: true, owner: '0xAgent...' } },
    },
    // --- AUTHORITY ---
    {
        id: 'authority_grant',
        action: 'authority.grant',
        title: 'Grant Authority',
        category: 'Authority',
        description: 'Delegate specific permissions to another address with optional limits and expiry.',
        auth: true,
        method: 'POST',
        rpEarned: 5,
        fields: [
            { name: 'delegate_to', type: 'string', required: true, description: 'Address to delegate authority to' },
            { name: 'permissions', type: 'array', required: true, description: 'Array: transfer, stake, unstake, claim, bridge, approve' },
            { name: 'limits', type: 'object', required: false, description: '{ max_amount_per_tx, max_daily_amount }' },
            { name: 'expires_at', type: 'string', required: false, description: 'ISO 8601 timestamp (default: 30 days)' },
        ],
        requestExample: {
            action: 'authority.grant', api_key: 'vcn_your_api_key',
            delegate_to: '0xTrustedAddress', permissions: ['transfer', 'stake'],
            limits: { max_daily_amount: '1000' },
        },
        responseExample: { success: true, delegation_id: 'del_abc123', delegate_to: '0xTrusted...', permissions: ['transfer', 'stake'], status: 'active' },
    },
    {
        id: 'authority_revoke',
        action: 'authority.revoke',
        title: 'Revoke Authority',
        category: 'Authority',
        description: 'Revoke a delegation by ID or all delegations to a specific address.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'delegation_id', type: 'string', required: false, description: 'Specific delegation to revoke' },
            { name: 'delegate_to', type: 'string', required: false, description: 'Revoke all delegations to this address' },
        ],
        requestExample: { action: 'authority.revoke', api_key: 'vcn_your_api_key', delegation_id: 'del_abc123' },
        responseExample: { success: true, revoked_count: 1 },
    },
    {
        id: 'authority_status',
        action: 'authority.status',
        title: 'Authority Status',
        category: 'Authority',
        description: 'List all active delegations for your agent.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'delegate_to', type: 'string', required: false, description: 'Filter by delegate address' },
        ],
        requestExample: { action: 'authority.status', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true, active_delegations: 2,
            delegations: [{ delegation_id: 'del_abc123', delegate_to: '0xTrusted...', permissions: ['transfer'], status: 'active' }],
        },
    },
    {
        id: 'authority_usage',
        action: 'authority.usage',
        title: 'Authority Usage',
        category: 'Authority',
        description: 'Check usage statistics for a specific delegation.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'delegation_id', type: 'string', required: true, description: 'Delegation ID to check usage for' },
        ],
        requestExample: { action: 'authority.usage', api_key: 'vcn_your_api_key', delegation_id: 'del_abc123' },
        responseExample: {
            success: true, delegation_id: 'del_abc123',
            usage: { tx_count: 5, total_amount_used: '150.0', remaining_daily_limit: '850.0' },
        },
    },
    // --- PIPELINE ---
    {
        id: 'pipeline_create',
        action: 'pipeline.create',
        title: 'Create Pipeline',
        category: 'Pipeline',
        description: 'Create an automated multi-step action pipeline. Max 10 steps, 20 pipelines per agent.',
        auth: true,
        method: 'POST',
        rpEarned: 10,
        fields: [
            { name: 'name', type: 'string', required: true, description: 'Pipeline name' },
            { name: 'steps', type: 'array', required: true, description: 'Array of {action, params} objects (max 10)' },
            { name: 'trigger', type: 'string', required: false, description: 'manual (default) or cron' },
            { name: 'schedule_cron', type: 'string', required: false, description: 'Cron expression for scheduled execution' },
        ],
        requestExample: {
            action: 'pipeline.create', api_key: 'vcn_your_api_key', name: 'Daily Rewards',
            steps: [{ action: 'claim_rewards', params: {} }, { action: 'stake', params: { amount: '10' } }],
        },
        responseExample: { success: true, pipeline_id: 'pip_abc123', name: 'Daily Rewards', steps: 2, trigger: 'manual', status: 'active' },
    },
    {
        id: 'pipeline_execute',
        action: 'pipeline.execute',
        title: 'Execute Pipeline',
        category: 'Pipeline',
        description: 'Execute a pipeline, running all steps sequentially. Supports conditional logic between steps.',
        auth: true,
        method: 'POST',
        rpEarned: 10,
        fields: [
            { name: 'pipeline_id', type: 'string', required: true, description: 'Pipeline ID to execute' },
        ],
        requestExample: { action: 'pipeline.execute', api_key: 'vcn_your_api_key', pipeline_id: 'pip_abc123' },
        responseExample: {
            success: true, pipeline_id: 'pip_abc123', total_steps: 2, executed: 2, skipped: 0,
            results: [{ step: 0, action: 'claim_rewards', status: 'success' }, { step: 1, action: 'stake', status: 'success' }],
        },
    },
    {
        id: 'pipeline_list',
        action: 'pipeline.list',
        title: 'List Pipelines',
        category: 'Pipeline',
        description: 'List all your agent\'s pipelines with run statistics.',
        auth: true,
        method: 'POST',
        fields: [],
        requestExample: { action: 'pipeline.list', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true, total: 2,
            pipelines: [{ pipeline_id: 'pip_abc123', name: 'Daily Rewards', steps: 2, trigger: 'manual', status: 'active', run_count: 5 }],
        },
    },
    {
        id: 'pipeline_delete',
        action: 'pipeline.delete',
        title: 'Delete Pipeline',
        category: 'Pipeline',
        description: 'Permanently delete a pipeline.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'pipeline_id', type: 'string', required: true, description: 'Pipeline ID to delete' },
        ],
        requestExample: { action: 'pipeline.delete', api_key: 'vcn_your_api_key', pipeline_id: 'pip_abc123' },
        responseExample: { success: true, pipeline_id: 'pip_abc123', deleted: true },
    },
    // --- WEBHOOK ---
    {
        id: 'webhook_subscribe',
        action: 'webhook.subscribe',
        title: 'Subscribe Webhook',
        category: 'Webhook',
        description: 'Subscribe to real-time event notifications via webhook. Max 20 subscriptions per agent.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'event', type: 'string', required: true, description: 'Event type: transfer.received, staking.reward_earned, bridge.completed, etc.' },
            { name: 'callback_url', type: 'string', required: true, description: 'URL to receive webhook POST requests' },
            { name: 'filters', type: 'object', required: false, description: 'Optional event filters' },
        ],
        requestExample: {
            action: 'webhook.subscribe', api_key: 'vcn_your_api_key',
            event: 'transfer.received', callback_url: 'https://myserver.com/webhook',
        },
        responseExample: {
            success: true, subscription_id: 'wh_abc123', event: 'transfer.received',
            callback_url: 'https://myserver.com/webhook', secret: 'hmac_secret_for_verification', status: 'active',
        },
        notes: ['Webhook payloads are signed with HMAC-SHA256', 'Failed deliveries retry 3 times with exponential backoff'],
    },
    {
        id: 'webhook_unsubscribe',
        action: 'webhook.unsubscribe',
        title: 'Unsubscribe Webhook',
        category: 'Webhook',
        description: 'Remove a webhook subscription.',
        auth: true,
        method: 'POST',
        fields: [
            { name: 'subscription_id', type: 'string', required: true, description: 'Subscription ID to remove' },
        ],
        requestExample: { action: 'webhook.unsubscribe', api_key: 'vcn_your_api_key', subscription_id: 'wh_abc123' },
        responseExample: { success: true, subscription_id: 'wh_abc123', deleted: true },
    },
    {
        id: 'webhook_list',
        action: 'webhook.list',
        title: 'List Webhooks',
        category: 'Webhook',
        description: 'List all active webhook subscriptions.',
        auth: true,
        method: 'POST',
        fields: [],
        requestExample: { action: 'webhook.list', api_key: 'vcn_your_api_key' },
        responseExample: {
            success: true, total: 1,
            webhooks: [{ subscription_id: 'wh_abc123', event: 'transfer.received', callback_url: 'https://myserver.com/webhook', status: 'active' }],
        },
    },
    // --- WEBHOOK EXTRAS ---
    {
        id: 'webhook_test', action: 'webhook.test', title: 'Test Webhook', category: 'Webhook',
        description: 'Send a test event to verify your webhook endpoint is working.', auth: true, method: 'POST',
        fields: [{ name: 'subscription_id', type: 'string', required: true, description: 'Subscription to test' }],
        requestExample: { action: 'webhook.test', api_key: 'vcn_your_api_key', subscription_id: 'wh_abc123' },
        responseExample: { success: true, test_event_sent: true, subscription_id: 'wh_abc123' },
    },
    {
        id: 'webhook_logs', action: 'webhook.logs', title: 'Webhook Logs', category: 'Webhook',
        description: 'View webhook delivery history and status.', auth: true, method: 'POST',
        fields: [{ name: 'limit', type: 'number', required: false, description: 'Max results (default: 20)' }],
        requestExample: { action: 'webhook.logs', api_key: 'vcn_your_api_key', limit: 20 },
        responseExample: { success: true, total: 5, logs: [{ event: 'transfer.received', status: 'delivered', timestamp: '2026-02-14T10:00:00Z' }] },
    },
    // --- SYSTEM EXTRAS ---
    {
        id: 'delete_agent', action: 'system.delete_agent', title: 'Delete Agent', category: 'System',
        description: 'Delete your agent permanently. This action cannot be undone.', auth: true, method: 'POST',
        fields: [],
        requestExample: { action: 'system.delete_agent', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, message: 'Agent deleted successfully' },
    },
    // --- TRANSFER EXTRAS ---
    {
        id: 'transfer_conditional', action: 'transfer.conditional', title: 'Conditional Transfer', category: 'Transfer',
        description: 'Create a transfer that executes when a condition is met (balance threshold or time-based trigger).', auth: true, method: 'POST', rpEarned: 5,
        fields: [
            { name: 'to', type: 'string', required: true, description: 'Recipient address' },
            { name: 'amount', type: 'string', required: true, description: 'Amount in VCN' },
            { name: 'condition', type: 'object', required: true, description: '{ type: balance_above|balance_below|time_after, value: string }' },
        ],
        requestExample: { action: 'transfer.conditional', api_key: 'vcn_your_api_key', to: '0xRecipient', amount: '50', condition: { type: 'balance_above', value: '100' } },
        responseExample: { success: true, condition_id: 'cond_xyz789', to: '0xRecipient', amount: '50', condition: { type: 'balance_above', value: '100' }, status: 'watching' },
    },
    {
        id: 'transfer_sepolia', action: 'transfer.sepolia', title: 'Sepolia Transfer', category: 'Transfer',
        description: 'Transfer VCN on Ethereum Sepolia (cross-chain). Requires an EIP-712 permit signature for Sepolia VCN. A 1 VCN fee is collected for gas sponsorship.', auth: true, method: 'POST',
        fields: [
            { name: 'to', type: 'string', required: true, description: 'Recipient address on Sepolia' },
            { name: 'amount', type: 'string', required: true, description: 'Amount of VCN to transfer' },
            { name: 'signature', type: 'string', required: true, description: 'EIP-712 permit signature for Sepolia VCN (authorizing amount + 1 VCN fee)' },
            { name: 'deadline', type: 'number', required: true, description: 'Permit deadline (Unix timestamp)' },
        ],
        requestExample: {
            action: 'transfer.sepolia', api_key: 'vcn_your_api_key',
            to: '0xRecipientAddress...', amount: '10',
            signature: '0xPermitSignature...', deadline: 1740200000,
        },
        responseExample: {
            success: true, tx_hash: '0xsepoliatx...abc', from: '0xYourAddress', to: '0xRecipient',
            amount: '10', fee: { charged: true, amount_vcn: '1.0', method: 'sepolia_permit' },
        },
        errors: [
            { code: 400, message: 'Insufficient Sepolia VCN balance' },
            { code: 400, message: 'Permit failed: invalid signature' },
            { code: 500, message: 'SEPOLIA_RELAYER_PK not configured' },
        ],
        notes: [
            'Sepolia VCN contract: 0x07755968236333B5f8803E9D0fC294608B200d1b',
            'Requires EIP-712 permit signed on Sepolia (chainId: 11155111)',
            '1 VCN fee is deducted for gas sponsorship on Sepolia',
        ],
    },
    // --- STAKING EXTRAS ---
    {
        id: 'staking_withdraw', action: 'staking.withdraw', title: 'Withdraw Unstaked', category: 'Staking',
        description: 'Withdraw VCN after cooldown period has passed.', auth: true, method: 'POST', rpEarned: 5,
        fields: [],
        requestExample: { action: 'staking.withdraw', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, tx_hash: '0xwithdraw...abc', withdrawn_amount: '25.0', rp_earned: 5 },
    },
    {
        id: 'staking_compound', action: 'staking.compound', title: 'Compound Rewards', category: 'Staking',
        description: 'Claim rewards and re-stake in a single atomic operation.', auth: true, method: 'POST', rpEarned: 15,
        fields: [],
        requestExample: { action: 'staking.compound', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, claimed_amount: '1.25', restaked_amount: '1.25', steps: [{ step: 'claim', tx_hash: '0x...' }, { step: 'restake', tx_hash: '0x...' }], rp_earned: 15 },
    },
    {
        id: 'staking_rewards', action: 'staking.rewards', title: 'Pending Rewards', category: 'Staking',
        description: 'Query pending unclaimed staking rewards.', auth: true, method: 'POST',
        fields: [],
        requestExample: { action: 'staking.rewards', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, rewards: { pending_vcn: '1.25', can_claim: true, can_compound: true, staked_vcn: '50.0' } },
    },
    {
        id: 'staking_apy', action: 'staking.apy', title: 'APY Info', category: 'Staking',
        description: 'Get current network APY and reward pool statistics.', auth: true, method: 'POST',
        fields: [],
        requestExample: { action: 'staking.apy', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, apy: { current_apy_percent: '12.00', reward_pool_vcn: '5000.0', total_staked_vcn: '15000.0', validator_count: 150 } },
    },
    {
        id: 'staking_cooldown', action: 'staking.cooldown', title: 'Cooldown Status', category: 'Staking',
        description: 'Check remaining cooldown time for pending unstake.', auth: true, method: 'POST',
        fields: [],
        requestExample: { action: 'staking.cooldown', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, cooldown: { has_pending_unstake: true, unstake_amount_vcn: '25.0', unlock_time: '2026-02-17T12:00:00Z', can_withdraw: false, cooldown_period: '7 days' } },
    },
    // --- AUTHORITY EXTRAS ---
    {
        id: 'authority_audit', action: 'authority.audit', title: 'Authority Audit', category: 'Authority',
        description: 'Get audit trail of grant/revoke actions.', auth: true, method: 'POST',
        fields: [{ name: 'limit', type: 'number', required: false, description: 'Max results (default: 20)' }],
        requestExample: { action: 'authority.audit', api_key: 'vcn_your_api_key', limit: 20 },
        responseExample: { success: true, total: 3, audit_log: [{ action: 'grant', delegation_id: 'del_abc123', timestamp: '2026-02-14T10:00:00Z' }] },
    },
    // --- SETTLEMENT ---
    {
        id: 'settlement_set_wallet', action: 'settlement.set_wallet', title: 'Set Settlement Wallet', category: 'Settlement',
        description: 'Register a settlement wallet address for receiving payouts.', auth: true, method: 'POST',
        fields: [
            { name: 'wallet_address', type: 'string', required: true, description: 'Valid Ethereum address' },
            { name: 'label', type: 'string', required: false, description: 'Human-readable label' },
        ],
        requestExample: { action: 'settlement.set_wallet', api_key: 'vcn_your_api_key', wallet_address: '0xSettlement...', label: 'Revenue Wallet' },
        responseExample: { success: true, agent_name: 'my-agent', settlement_wallet: '0xSettlement...', label: 'Revenue Wallet' },
    },
    {
        id: 'settlement_get_wallet', action: 'settlement.get_wallet', title: 'Get Settlement Wallet', category: 'Settlement',
        description: 'Query current settlement wallet configuration.', auth: true, method: 'POST',
        fields: [],
        requestExample: { action: 'settlement.get_wallet', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, settlement_wallet: '0xSettlement...', label: 'Revenue Wallet', is_configured: true, agent_wallet: '0xAgent...' },
    },
    // --- NODE ---
    {
        id: 'node_register', action: 'node.register', title: 'Register Node', category: 'Node',
        description: 'Register your Vision Node. Required to access T3/T4 tier actions.', auth: true, method: 'POST',
        fields: [
            { name: 'version', type: 'string', required: true, description: 'Node software version' },
            { name: 'os', type: 'string', required: false, description: 'Operating system' },
            { name: 'arch', type: 'string', required: false, description: 'CPU architecture' },
            { name: 'capabilities', type: 'array', required: false, description: 'rpc_cache, tx_relay, bridge_relay' },
        ],
        requestExample: { action: 'node.register', api_key: 'vcn_your_api_key', version: '0.1.0', os: 'darwin', arch: 'arm64' },
        responseExample: { success: true, node_id: 'vn_agent123_170795520', status: 'active', tier_access: 'T1 + T2 + T3 + T4 (full access)' },
    },
    {
        id: 'node_heartbeat', action: 'node.heartbeat', title: 'Node Heartbeat', category: 'Node',
        description: 'Send a heartbeat every 5 minutes to maintain active node status.', auth: true, method: 'POST',
        fields: [],
        requestExample: { action: 'node.heartbeat', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, node_id: 'vn_agent123_170795520', status: 'active', next_heartbeat_before: '2026-02-14T10:10:00Z' },
    },
    {
        id: 'node_status', action: 'node.status', title: 'Node Status', category: 'Node',
        description: 'Check your node\'s current status and tier access level.', auth: true, method: 'POST',
        fields: [],
        requestExample: { action: 'node.status', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, node_id: 'vn_agent123_170795520', status: 'active', tier_access: 'T1-T4', last_heartbeat: '2026-02-14T10:05:00Z' },
    },
    {
        id: 'node_peers', action: 'node.peers', title: 'List Node Peers', category: 'Node',
        description: 'List active nodes in the network (anonymized).', auth: true, method: 'POST',
        fields: [],
        requestExample: { action: 'node.peers', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, total_active: 25, peers: [{ node_id: 'vn_xxx', status: 'active', capabilities: ['rpc_cache'] }] },
    },
    // --- STORAGE ---
    {
        id: 'storage_set', action: 'storage.set', title: 'Store Value', category: 'Storage',
        description: 'Store a key-value pair (max 10KB per value, 1000 keys per agent).', auth: true, method: 'POST',
        fields: [
            { name: 'key', type: 'string', required: true, description: '1-128 chars, alphanumeric + underscore' },
            { name: 'value', type: 'any', required: true, description: 'String, number, or JSON (max 10KB)' },
        ],
        requestExample: { action: 'storage.set', api_key: 'vcn_your_api_key', key: 'last_buy_price', value: 0.05 },
        responseExample: { success: true, key: 'last_buy_price', stored: true },
    },
    {
        id: 'storage_get', action: 'storage.get', title: 'Get Value', category: 'Storage',
        description: 'Retrieve a stored value by key.', auth: true, method: 'POST',
        fields: [{ name: 'key', type: 'string', required: true, description: 'Key to retrieve' }],
        requestExample: { action: 'storage.get', api_key: 'vcn_your_api_key', key: 'last_buy_price' },
        responseExample: { success: true, key: 'last_buy_price', value: 0.05 },
    },
    {
        id: 'storage_list', action: 'storage.list', title: 'List Keys', category: 'Storage',
        description: 'List all stored keys for your agent.', auth: true, method: 'POST',
        fields: [],
        requestExample: { action: 'storage.list', api_key: 'vcn_your_api_key' },
        responseExample: { success: true, total: 3, keys: ['last_buy_price', 'strategy_config', 'alert_threshold'] },
    },
    {
        id: 'storage_delete', action: 'storage.delete', title: 'Delete Key', category: 'Storage',
        description: 'Delete a stored key.', auth: true, method: 'POST',
        fields: [{ name: 'key', type: 'string', required: true, description: 'Key to delete' }],
        requestExample: { action: 'storage.delete', api_key: 'vcn_your_api_key', key: 'last_buy_price' },
        responseExample: { success: true, key: 'last_buy_price', deleted: true },
    },
    // --- HOSTING ---
    {
        id: 'hosting_configure', action: 'hosting.configure', title: 'Configure Hosting', category: 'Hosting',
        description: 'Configure your agent\'s autonomous hosting settings (model, system prompt, enabled actions).', auth: true, method: 'POST',
        fields: [
            { name: 'model', type: 'string', required: false, description: 'LLM model (default: gemini-2.0-flash)' },
            { name: 'system_prompt', type: 'string', required: false, description: 'Custom system prompt' },
            { name: 'enabled_actions', type: 'array', required: false, description: 'Actions the agent can use autonomously' },
        ],
        requestExample: { action: 'hosting.configure', api_key: 'vcn_your_api_key', model: 'gemini-2.0-flash', enabled_actions: ['wallet.balance', 'transfer.send'] },
        responseExample: { success: true, hosting: { model: 'gemini-2.0-flash', enabled_actions: ['wallet.balance', 'transfer.send'], status: 'configured' } },
    },
    {
        id: 'hosting_toggle', action: 'hosting.toggle', title: 'Toggle Hosting', category: 'Hosting',
        description: 'Enable or disable your agent\'s autonomous hosting.', auth: true, method: 'POST',
        fields: [{ name: 'enabled', type: 'boolean', required: true, description: 'true to enable, false to disable' }],
        requestExample: { action: 'hosting.toggle', api_key: 'vcn_your_api_key', enabled: true },
        responseExample: { success: true, hosting_enabled: true, message: 'Agent hosting enabled' },
    },
    {
        id: 'hosting_logs', action: 'hosting.logs', title: 'Hosting Logs', category: 'Hosting',
        description: 'Get execution logs for your hosted agent.', auth: true, method: 'POST',
        fields: [{ name: 'limit', type: 'number', required: false, description: 'Max logs (default: 20)' }],
        requestExample: { action: 'hosting.logs', api_key: 'vcn_your_api_key', limit: 20 },
        responseExample: { success: true, total: 5, logs: [{ action: 'wallet.balance', result: 'success', timestamp: '2026-02-14T10:00:00Z' }] },
    },
];

const categories = ['System', 'Wallet', 'Transfer', 'Staking', 'Bridge', 'NFT', 'Authority', 'Settlement', 'Node', 'Storage', 'Pipeline', 'Webhook', 'Hosting', 'Social', 'Network'];

const rpTable = [
    { action: 'Approve Spender', rp: 3 },
    { action: 'Transfer VCN', rp: 5 },
    { action: 'Batch Transfer', rp: '5/recipient' },
    { action: 'Unstake VCN', rp: 5 },
    { action: 'Withdraw Unstaked', rp: 5 },
    { action: 'Claim Rewards', rp: 10 },
    { action: 'Mint SBT', rp: 10 },
    { action: 'Create Pipeline', rp: 10 },
    { action: 'Execute Pipeline', rp: 10 },
    { action: 'Compound Rewards', rp: 15 },
    { action: 'Bridge Initiate', rp: 15 },
    { action: 'Stake VCN', rp: 20 },
    { action: 'Batch Transfer (50)', rp: 20 },
    { action: 'New Agent Bonus', rp: 25 },
    { action: 'NFT Mint', rp: 30 },
    { action: 'Refer Agent', rp: 50 },
];

export default function AgentApiDocs() {
    const [activeEndpoint, setActiveEndpoint] = createSignal('register');
    const [activeCategory, setActiveCategory] = createSignal('Wallet');
    const [copiedText, setCopiedText] = createSignal('');

    const currentEndpoint = () => endpoints.find(e => e.id === activeEndpoint())!;

    const copyCode = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(id);
        setTimeout(() => setCopiedText(''), 2000);
    };

    const curlExample = (ep: ApiEndpoint) => {
        return `curl -X POST ${API_BASE} \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(ep.requestExample, null, 2)}'`;
    };

    const pythonExample = (ep: ApiEndpoint) => {
        const params = Object.entries(ep.requestExample)
            .filter(([k]) => k !== 'action' && k !== 'api_key')
            .map(([k, v]) => `    "${k}": ${JSON.stringify(v)}`)
            .join(',\n');
        const hasParams = params.length > 0;
        return `import requests

url = "${API_BASE}"
payload = {
    "action": "${ep.action}",
    "api_key": "vcn_your_api_key"${hasParams ? ',\n' + params : ''}
}

response = requests.post(url, json=payload)
print(response.json())`;
    };

    const jsExample = (ep: ApiEndpoint) => {
        const params = Object.entries(ep.requestExample)
            .filter(([k]) => k !== 'action' && k !== 'api_key')
            .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
            .join(',\n');
        const hasParams = params.length > 0;
        return `const response = await fetch("${API_BASE}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "${ep.action}",
    api_key: "vcn_your_api_key"${hasParams ? ',\n' + params : ''}
  })
});
const data = await response.json();
console.log(data);`;
    };

    const [codeTab, setCodeTab] = createSignal<'curl' | 'python' | 'javascript'>('curl');

    const getCodeExample = () => {
        const ep = currentEndpoint();
        switch (codeTab()) {
            case 'curl': return curlExample(ep);
            case 'python': return pythonExample(ep);
            case 'javascript': return jsExample(ep);
        }
    };

    return (
        <div class="min-h-screen bg-[#06060a] text-white">
            {/* SVG Icon definitions */}
            <svg class="hidden">
                <defs>
                    <symbol id="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </symbol>
                    <symbol id="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                    </symbol>
                    <symbol id="icon-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </symbol>
                    <symbol id="icon-unlock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </symbol>
                    <symbol id="icon-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                    </symbol>
                    <symbol id="icon-external" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    </symbol>
                    <symbol id="icon-zap" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                    </symbol>
                </defs>
            </svg>

            <div class="flex min-h-screen">
                {/* Sidebar */}
                <aside class="w-72 bg-[#08080e] border-r border-white/5 flex flex-col fixed h-full overflow-y-auto z-20">
                    {/* Logo */}
                    <div class="p-6 border-b border-white/5">
                        <a href="/" class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs mb-4">
                            <svg class="w-3.5 h-3.5"><use href="#icon-arrow-left" /></svg>
                            Back to Vision Chain
                        </a>
                        <h1 class="text-xl font-black tracking-tight">
                            Agent <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">API</span>
                        </h1>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">v2.0 Documentation</div>
                    </div>

                    {/* Navigation */}
                    <nav class="flex-1 p-4 space-y-6">
                        <For each={categories}>
                            {(cat) => (
                                <div>
                                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-3">{cat}</div>
                                    <div class="space-y-0.5">
                                        <For each={endpoints.filter(e => e.category === cat)}>
                                            {(ep) => (
                                                <button
                                                    onClick={() => { setActiveEndpoint(ep.id); setActiveCategory(ep.category); }}
                                                    class={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all group ${activeEndpoint() === ep.id
                                                        ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/5 text-white border-l-2 border-cyan-400'
                                                        : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                                                        }`}
                                                >
                                                    <span class="font-semibold">{ep.title}</span>
                                                    <Show when={ep.rpEarned}>
                                                        <span class="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">+{ep.rpEarned} RP</span>
                                                    </Show>
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            )}
                        </For>

                        {/* Quick Links */}
                        <div class="border-t border-white/5 pt-4">
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-3">Resources</div>
                            <a href="/agent" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
                                <svg class="w-3.5 h-3.5"><use href="#icon-external" /></svg>
                                Agent Dashboard
                            </a>
                            <a href="/visionscan" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
                                <svg class="w-3.5 h-3.5"><use href="#icon-external" /></svg>
                                VisionScan Explorer
                            </a>
                            <a href="/skill.md" target="_blank" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
                                <svg class="w-3.5 h-3.5"><use href="#icon-external" /></svg>
                                skill.md (AI Onboarding)
                            </a>
                        </div>
                    </nav>

                    {/* Footer */}
                    <div class="p-4 border-t border-white/5 text-[10px] text-gray-600 uppercase tracking-widest text-center">
                        Vision Chain &copy; 2026
                    </div>
                </aside>

                {/* Main Content */}
                <main class="flex-1 ml-72 p-8 lg:p-12 max-w-5xl">
                    {/* Endpoint Header */}
                    <div class="mb-8">
                        <div class="flex items-center gap-3 mb-3">
                            <span class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{currentEndpoint().category}</span>
                            <Show when={currentEndpoint().auth}>
                                <span class="flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                    <svg class="w-3 h-3"><use href="#icon-lock" /></svg>
                                    Auth Required
                                </span>
                            </Show>
                            <Show when={!currentEndpoint().auth}>
                                <span class="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    <svg class="w-3 h-3"><use href="#icon-unlock" /></svg>
                                    Public
                                </span>
                            </Show>
                        </div>
                        <h2 class="text-3xl font-black tracking-tight mb-2">{currentEndpoint().title}</h2>
                        <p class="text-gray-400 text-sm leading-relaxed max-w-2xl">{currentEndpoint().description}</p>
                        <Show when={currentEndpoint().rpEarned}>
                            <div class="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                <svg class="w-4 h-4 text-purple-400"><use href="#icon-zap" /></svg>
                                <span class="text-xs font-bold text-purple-400">+{currentEndpoint().rpEarned} RP per action</span>
                            </div>
                        </Show>
                    </div>

                    {/* Endpoint URL */}
                    <div class="mb-8 bg-[#0c0c14] border border-white/5 rounded-xl p-4">
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">POST</span>
                            <code class="text-sm text-gray-300 font-mono break-all">{API_BASE}</code>
                            <button
                                onClick={() => copyCode(API_BASE, 'url')}
                                class="ml-auto p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5 flex-shrink-0"
                            >
                                <Show when={copiedText() === 'url'} fallback={<svg class="w-4 h-4"><use href="#icon-copy" /></svg>}>
                                    <svg class="w-4 h-4 text-emerald-400"><use href="#icon-check" /></svg>
                                </Show>
                            </button>
                        </div>
                    </div>

                    {/* Parameters */}
                    <Show when={currentEndpoint().fields.length > 0}>
                        <div class="mb-8">
                            <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Parameters</h3>
                            <div class="bg-[#0c0c14] border border-white/5 rounded-xl overflow-hidden">
                                <div class="grid grid-cols-[1.2fr_0.8fr_0.6fr_2fr] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                                    <div>Name</div>
                                    <div>Type</div>
                                    <div>Required</div>
                                    <div>Description</div>
                                </div>
                                <For each={currentEndpoint().fields}>
                                    {(field) => (
                                        <div class="grid grid-cols-[1.2fr_0.8fr_0.6fr_2fr] gap-4 px-5 py-3 border-b border-white/[0.03] text-sm">
                                            <code class="text-cyan-400 text-xs font-mono">{field.name}</code>
                                            <span class="text-gray-500 text-xs">{field.type}</span>
                                            <span class={`text-xs font-bold ${field.required ? 'text-amber-400' : 'text-gray-600'}`}>
                                                {field.required ? 'Yes' : 'No'}
                                            </span>
                                            <span class="text-gray-400 text-xs">{field.description}</span>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>

                    {/* Code Examples */}
                    <div class="mb-8">
                        <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Code Examples</h3>
                        <div class="bg-[#0c0c14] border border-white/5 rounded-xl overflow-hidden">
                            {/* Language tabs */}
                            <div class="flex items-center gap-1 p-2 border-b border-white/5 bg-white/[0.02]">
                                <For each={['curl', 'python', 'javascript'] as const}>
                                    {(lang) => (
                                        <button
                                            onClick={() => setCodeTab(lang)}
                                            class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${codeTab() === lang
                                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                                : 'text-gray-500 hover:text-white'
                                                }`}
                                        >
                                            {lang === 'curl' ? 'cURL' : lang === 'python' ? 'Python' : 'JavaScript'}
                                        </button>
                                    )}
                                </For>
                                <button
                                    onClick={() => copyCode(getCodeExample(), 'code')}
                                    class="ml-auto p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                >
                                    <Show when={copiedText() === 'code'} fallback={<svg class="w-4 h-4"><use href="#icon-copy" /></svg>}>
                                        <svg class="w-4 h-4 text-emerald-400"><use href="#icon-check" /></svg>
                                    </Show>
                                </button>
                            </div>
                            <pre class="p-5 text-xs text-gray-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">{getCodeExample()}</pre>
                        </div>
                    </div>

                    {/* Response */}
                    <div class="mb-8">
                        <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Response Example</h3>
                        <div class="bg-[#0c0c14] border border-white/5 rounded-xl overflow-hidden">
                            <div class="flex items-center justify-between p-3 border-b border-white/5 bg-white/[0.02]">
                                <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">200 OK</span>
                                <button
                                    onClick={() => copyCode(JSON.stringify(currentEndpoint().responseExample, null, 2), 'response')}
                                    class="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                >
                                    <Show when={copiedText() === 'response'} fallback={<svg class="w-4 h-4"><use href="#icon-copy" /></svg>}>
                                        <svg class="w-4 h-4 text-emerald-400"><use href="#icon-check" /></svg>
                                    </Show>
                                </button>
                            </div>
                            <pre class="p-5 text-xs text-emerald-300/80 font-mono leading-relaxed overflow-x-auto whitespace-pre">{JSON.stringify(currentEndpoint().responseExample, null, 2)}</pre>
                        </div>
                    </div>

                    {/* Errors */}
                    <Show when={currentEndpoint().errors && currentEndpoint().errors!.length > 0}>
                        <div class="mb-8">
                            <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Error Responses</h3>
                            <div class="space-y-2">
                                <For each={currentEndpoint().errors}>
                                    {(err) => (
                                        <div class="flex items-center gap-3 bg-[#0c0c14] border border-red-500/10 rounded-xl px-5 py-3">
                                            <span class="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">{err.code}</span>
                                            <span class="text-xs text-gray-400">{err.message}</span>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>

                    {/* Notes */}
                    <Show when={currentEndpoint().notes && currentEndpoint().notes!.length > 0}>
                        <div class="mb-8 bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-5">
                            <h3 class="text-xs font-black uppercase tracking-widest text-cyan-400 mb-3">Notes</h3>
                            <ul class="space-y-1.5">
                                <For each={currentEndpoint().notes}>
                                    {(note) => (
                                        <li class="text-sm text-gray-400 flex items-start gap-2">
                                            <span class="text-cyan-400 mt-0.5">-</span>
                                            {note}
                                        </li>
                                    )}
                                </For>
                            </ul>
                        </div>
                    </Show>

                    {/* RP Points Table (show at bottom) */}
                    <div class="mt-12 pt-8 border-t border-white/5">
                        <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">RP Reward System</h3>
                        <div class="bg-[#0c0c14] border border-white/5 rounded-xl overflow-hidden">
                            <For each={rpTable}>
                                {(row) => (
                                    <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.03]">
                                        <span class="text-sm text-gray-300">{row.action}</span>
                                        <span class="text-sm font-bold text-purple-400">+{row.rp} RP</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Error Codes Reference */}
                    <div class="mt-8">
                        <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">HTTP Status Codes</h3>
                        <div class="bg-[#0c0c14] border border-white/5 rounded-xl overflow-hidden">
                            {[
                                { code: 200, label: 'Success', color: 'text-emerald-400 bg-emerald-500/10' },
                                { code: 201, label: 'Created (register)', color: 'text-emerald-400 bg-emerald-500/10' },
                                { code: 400, label: 'Bad request (missing/invalid fields)', color: 'text-amber-400 bg-amber-500/10' },
                                { code: 401, label: 'Unauthorized (missing/invalid API key)', color: 'text-red-400 bg-red-500/10' },
                                { code: 409, label: 'Conflict (agent name already taken)', color: 'text-orange-400 bg-orange-500/10' },
                                { code: 500, label: 'Internal server error', color: 'text-red-400 bg-red-500/10' },
                            ].map(item => (
                                <div class="flex items-center gap-3 px-5 py-3 border-b border-white/[0.03]">
                                    <span class={`text-[10px] font-bold px-2 py-1 rounded ${item.color}`}>{item.code}</span>
                                    <span class="text-xs text-gray-400">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
