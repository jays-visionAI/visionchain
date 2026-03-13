/**
 * VPIS Feature Catalog Definition
 *
 * Master list of VisionChain features for answer accuracy evaluation.
 * This is used by the evaluation engine to check if chatbot answers
 * correctly reference existing features, policies, and UI paths.
 *
 * Update this file whenever features are added, changed, or removed.
 */

import type { FeatureCatalogEntry, PolicyEntry } from './vpisTypes';

export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
  // ── Wallet Core ──────────────────────────────────────────────────────
  {
    name: 'wallet_dashboard',
    status: 'live',
    uiPath: '/wallet',
    description: 'Main wallet dashboard with balance overview, daily tips, announcements, and quick actions.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
  {
    name: 'wallet_send',
    status: 'live',
    uiPath: '/wallet (Send action)',
    description: 'Send VCN, USDC, and other tokens to contacts or wallet addresses. Supports VID (@username) and 0x addresses.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
  {
    name: 'wallet_receive',
    status: 'live',
    uiPath: '/wallet (Receive action)',
    description: 'Receive tokens by sharing wallet address or QR code.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
  {
    name: 'wallet_assets',
    status: 'live',
    uiPath: '/wallet (Assets tab)',
    description: 'View all token balances incl. VCN, USDC. Shows portfolio value and token list.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
  {
    name: 'wallet_contacts',
    status: 'live',
    uiPath: '/wallet (Contacts)',
    description: 'Manage personal contact list with names, emails, VIDs, and wallet addresses.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
  {
    name: 'wallet_settings',
    status: 'live',
    uiPath: '/wallet (Settings)',
    description: 'Account settings: password, 2FA, cloud backup, wallet export, notifications.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
  {
    name: 'wallet_notifications',
    status: 'live',
    uiPath: '/wallet (Notifications)',
    description: 'Transaction notifications, announcements, system alerts.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
  {
    name: 'wallet_activity',
    status: 'live',
    uiPath: '/wallet (Activity)',
    description: 'Transaction history with filtering and search.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
  {
    name: 'wallet_referral',
    status: 'live',
    uiPath: '/wallet (Referral)',
    description: 'Referral program: generate invite codes, track referrals, earn RP rewards.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Bridge ───────────────────────────────────────────────────────────
  {
    name: 'bridge',
    status: 'live',
    uiPath: '/bridge',
    description: 'Cross-chain bridge: transfer tokens between Vision Chain and Ethereum/Sepolia. Forward and reverse bridge supported.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Staking ──────────────────────────────────────────────────────────
  {
    name: 'staking',
    status: 'live',
    uiPath: '/staking',
    description: 'Validator staking: stake VCN tokens with validators for rewards.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Disk ─────────────────────────────────────────────────────────────
  {
    name: 'disk',
    status: 'live',
    uiPath: '/wallet (Disk)',
    description: 'Cloud file storage: upload, organize, share files. Finder-style folder tree. VNET and Private folders. File sharing via email.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── AI Chat ──────────────────────────────────────────────────────────
  {
    name: 'ai_chatbot',
    status: 'live',
    uiPath: '/wallet (Chat input)',
    description: 'AI-powered assistant: crypto prices, portfolio analysis, DeFi research, file management, agent creation, transfer commands.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Quant ────────────────────────────────────────────────────────────
  {
    name: 'quant_engine',
    status: 'live',
    uiPath: '/wallet (Quant)',
    description: 'Quantitative trading engine: strategies, agents, arena, signals, reports. Tabs: Strategies, Agents, Arena, Signals, Reports.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
  {
    name: 'cex_portfolio',
    status: 'live',
    uiPath: '/wallet (Quant > Portfolio)',
    description: 'CEX portfolio view: connect Upbit/Bithumb via API keys, view holdings, P&L, allocation.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Game Center ──────────────────────────────────────────────────────
  {
    name: 'game_center',
    status: 'live',
    uiPath: '/wallet (Game Center)',
    description: 'VCN Game Center: 10 mini-games (Price Predict, MineSweeper, Tower Climb, Crash, Slots, Flappy, Falling Coins, Memory Match, Dice, Block Break). Earn RP rewards.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Market ───────────────────────────────────────────────────────────
  {
    name: 'vision_market',
    status: 'live',
    uiPath: '/wallet (Market)',
    description: 'Crypto market overview: price charts, trending coins, market stats.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Vision Insight ───────────────────────────────────────────────────
  {
    name: 'vision_insight',
    status: 'live',
    uiPath: '/wallet (Insight)',
    description: 'AI-curated market news and analysis with sentiment scoring and impact ratings.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Agent Gateway ────────────────────────────────────────────────────
  {
    name: 'agent_gateway',
    status: 'live',
    uiPath: '/agent',
    description: 'AI agent hosting platform: register agents, manage API keys, fund with VCN. Supports OpenAI, Anthropic, LangChain, custom.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Mint Studio ──────────────────────────────────────────────────────
  {
    name: 'mint_studio',
    status: 'live',
    uiPath: '/mint',
    description: 'NFT minting studio: create and mint NFTs on Vision Chain.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Vision Scan ──────────────────────────────────────────────────────
  {
    name: 'vision_scan',
    status: 'live',
    uiPath: '/visionscan',
    description: 'Blockchain explorer: search transactions, blocks, addresses, contracts.',
    permissions: [],
    relatedFaqIds: [],
  },

  // ── Nodes ────────────────────────────────────────────────────────────
  {
    name: 'vision_nodes',
    status: 'live',
    uiPath: '/wallet (Nodes)',
    description: 'Node operation: run Vision Chain validator nodes, view status and rewards.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },

  // ── Campaign ─────────────────────────────────────────────────────────
  {
    name: 'campaign',
    status: 'live',
    uiPath: '/wallet (Campaign)',
    description: 'Marketing campaigns and promotional events.',
    permissions: ['authenticated'],
    relatedFaqIds: [],
  },
];

export const POLICY_CATALOG: PolicyEntry[] = [
  {
    name: 'password_policy',
    content: 'Minimum 6 characters. Password change requires current password. Cloud backup uses wallet password.',
    version: '2026.03',
  },
  {
    name: '2fa_policy',
    content: '2FA required for recovery. Supports TOTP authenticator apps. Optional for login.',
    version: '2026.03',
  },
  {
    name: 'referral_policy',
    content: 'Users earn RP rewards for successful referrals. Invite codes are unique per user.',
    version: '2026.03',
  },
  {
    name: 'game_policy',
    content: 'Daily play limits per game. RP rewards for gameplay. No real money gambling.',
    version: '2026.03',
  },
  {
    name: 'bridge_policy',
    content: 'Bridge supports Vision Chain <-> Sepolia/Ethereum. Minimum amounts apply. Gas fees required on destination chain.',
    version: '2026.03',
  },
];

/**
 * Generate a feature catalog snapshot for the current state.
 */
export function generateCurrentCatalogSnapshot(): Omit<import('./vpisTypes').FeatureCatalogSnapshot, 'id' | 'createdAt'> {
  const now = new Date();
  return {
    version: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`,
    snapshotDate: now.toISOString(),
    features: FEATURE_CATALOG,
    policies: POLICY_CATALOG,
    releaseVersion: 'current',
  };
}
