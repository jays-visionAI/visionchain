/**
 * User Manual Content - English
 * All translatable body text for the User Guide, organized by section ID.
 */
export const en: Record<string, any> = {
  // ─── Getting Started ───
  'gs-overview': {
    title: 'Welcome to Vision Chain',
    desc: 'Vision Chain is an AI-powered blockchain ecosystem. This manual will guide you through every feature of the Vision Chain Wallet.',
    features: [
      { n: 'AI Chat', d: 'Talk to Vision AI for transactions, questions, and blockchain operations' },
      { n: 'Multi-Chain', d: 'Manage assets across Vision Chain, Ethereum, Polygon, and Base' },
      { n: 'Gasless', d: 'All transactions are gasless through the Vision Paymaster system' },
    ],
    quickNavTitle: 'Quick Navigation',
    quickNav: [
      { t: 'New User?', d: 'Start with Account Creation & Login' },
      { t: 'Have an Account?', d: 'Learn about the AI Chat interface' },
      { t: 'Want to Send?', d: 'Go to Send & Receive guide' },
      { t: 'Need Security?', d: 'Check Settings & 2FA setup' },
    ],
  },
  'gs-signup': {
    title: 'Account Creation & Login',
    desc: 'Create your Vision Chain account to access the wallet and all features.',
    steps: [
      { title: 'Visit visionchain.co', desc: 'Navigate to the main website and click "Launch App" or go directly to visionchain.co/wallet.' },
      { title: 'Click Sign Up', desc: 'On the login page, tap "Sign Up" to create a new account.' },
      { title: 'Enter Your Details', desc: 'Provide your email, username, and a strong password. Optionally enter a referral code if invited by a friend.' },
      { title: 'Verify Email', desc: 'Check your inbox for a verification email and click the activation link.' },
      { title: 'Login', desc: 'Return to the login page and sign in with your credentials. You will be directed to the AI Chat screen.' },
    ],
    tip: 'If you have a referral code from a friend, enter it during signup to receive bonus VCN tokens. Both you and your referrer will earn rewards.',
  },
  'gs-wallet': {
    title: 'Wallet Setup',
    desc: 'Your blockchain wallet is automatically created upon first login. A seed phrase is generated for backup and recovery.',
    steps: [
      { title: 'Auto-Generation', desc: 'Upon first login, a wallet is automatically generated with a unique address. No manual setup required.' },
      { title: 'Seed Phrase Backup', desc: 'Navigate to Settings > Wallet Backup. Write down your 12-word seed phrase and store it securely offline.' },
      { title: 'Set Wallet Password', desc: 'Create a separate wallet password for transaction signing. This is different from your login password.' },
      { title: 'Cloud Sync (Optional)', desc: 'Enable Cloud Sync in Settings to backup your encrypted wallet to Vision Cloud for recovery across devices.' },
    ],
    warning: 'Your seed phrase is the only way to recover your wallet if you lose access. Never share it with anyone. Vision Chain support will never ask for your seed phrase.',
  },
  'gs-navigation': {
    title: 'Interface Overview',
    desc: 'Learn how to navigate the Vision Chain wallet across desktop and mobile.',
    mobileNavTitle: 'Mobile Navigation',
    mobileNav: [
      { label: 'Hamburger Menu', desc: 'Tap the menu icon at top-left to open the sidebar with all features' },
      { label: 'Chat History', desc: 'Tap the clock icon at top-right to view and switch between AI chat sessions' },
      { label: 'Bottom Input', desc: 'The chat input area at the bottom expands when tapped. Supports text and voice input' },
      { label: 'Agent Desk', desc: 'Shows active AI agents and background tasks above the input area' },
    ],
    desktopNavTitle: 'Desktop Navigation',
    desktopNavDesc: 'On desktop, a full sidebar is always visible on the left with all feature categories. The chat input area is fixed at the bottom of the main content area with an expanded Agent Desk panel above it.',
    sidebarTitle: 'Sidebar Menu Items',
    sidebarItems: [
      { n: 'Chat', d: 'AI-powered assistant for all operations' },
      { n: 'My Assets', d: 'View portfolio, balances, and token list' },
      { n: 'Quant', d: 'Connected exchange portfolios & trading engine' },
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
    ],
  },

  // ─── AI Chat ───
  'chat-overview': {
    title: 'AI Chat Interface',
    desc: 'Vision AI is your intelligent assistant for all blockchain operations. Simply type or speak to send tokens, check balances, or get answers.',
    features: [
      { t: 'Natural Language', d: 'Type commands like "Send 100 VCN to John" and the AI will handle the transaction flow' },
      { t: 'Multi-Language', d: 'Supports Korean and English with automatic language detection' },
      { t: 'Context Aware', d: 'The AI remembers conversation context and can reference previous actions' },
      { t: 'Smart Suggestions', d: 'Quick action buttons appear on the welcome screen for common operations' },
    ],
    tip: 'The AI Chat is the default landing screen after login. You can access all wallet features through natural language commands without navigating menus.',
  },
  'chat-quick': {
    title: 'Quick Actions',
    desc: 'Pre-defined action buttons on the welcome screen for instant access to common features.',
    actions: [
      { n: 'Learn about Vision Chain', d: 'Get an overview of the Vision Chain ecosystem', t: 'chat' },
      { n: 'Receive VCN Gift', d: 'Request an airdrop of VCN tokens', t: 'chat' },
      { n: 'Invite Friends', d: 'Get your referral link and invite others', t: 'chat' },
      { n: 'Send VCN', d: 'Opens the Send flow directly', t: 'flow' },
    ],
    directFlow: 'Direct Flow',
    aiChat: 'AI Chat',
    note: 'Quick Actions are configurable by administrators. The buttons shown may vary based on active campaigns and promotions.',
  },
  'chat-voice': {
    title: 'Voice Input',
    desc: 'Use your voice to interact with Vision AI. Supports Korean and English with real-time transcription.',
    steps: [
      { title: 'Tap the Microphone', desc: 'In the chat input area, tap the microphone icon to start recording.' },
      { title: 'Speak Clearly', desc: 'Speak your command in Korean or English. The AI will automatically detect the language.' },
      { title: 'Review & Send', desc: 'The transcribed text appears in the input field. Review and tap send, or edit before sending.' },
    ],
    tip: 'Voice input supports phonetic matching for contact names. You can say "Send 100 VCN to Sangkyun" and the AI will find the closest matching contact even with Korean pronunciation variations.',
  },
  'chat-intent': {
    title: 'AI Intent Commands',
    desc: 'The AI understands natural language intents and can execute complex blockchain operations.',
    tableHeaders: ['Command Example', 'Action'],
    commands: [
      { cmd: '"Send 100 VCN to John"', act: 'Opens send flow with pre-filled recipient and amount' },
      { cmd: '"What is my balance?"', act: 'Shows your current VCN and ETH balances' },
      { cmd: '"Bridge 50 VCN to Ethereum"', act: 'Initiates a cross-chain bridge transaction' },
      { cmd: '"Stake 200 VCN"', act: 'Navigates to staking with pre-filled amount' },
      { cmd: '"Show my transaction history"', act: 'Displays recent transactions' },
      { cmd: '"How do I invite friends?"', act: 'Explains the referral program' },
      { cmd: '"Navigate to settings"', act: 'Opens the Settings page' },
    ],
  },
  'chat-history': {
    title: 'Chat History & Sessions',
    desc: 'Access previous conversations and switch between chat sessions.',
    steps: [
      { title: 'Open Chat History', desc: 'On mobile, tap the clock icon at top-right. On desktop, the history panel is in the sidebar.' },
      { title: 'Browse Sessions', desc: 'View all previous chat sessions sorted by date. Each session shows the first message as a title.' },
      { title: 'Switch Sessions', desc: 'Tap any session to load that conversation. Your current session is auto-saved.' },
      { title: 'New Conversation', desc: 'Tap "New Chat" to start a fresh conversation. Previous sessions remain accessible.' },
    ],
  },
  'chat-agent-desk': {
    title: 'Agent Desk',
    desc: 'Monitor background AI agents and batch operations from the Agent Desk panel above the chat input.',
    body: 'The Agent Desk shows all currently active AI agents, pending transactions, and background tasks. Each agent chip displays its status, progress, and allows you to view details or dismiss completed tasks.',
    statuses: [
      { s: 'Running', d: 'Agent is actively executing actions', c: 'text-emerald-400 bg-emerald-500/10' },
      { s: 'Pending', d: 'Waiting for user approval or blockchain confirmation', c: 'text-amber-400 bg-amber-500/10' },
      { s: 'Completed', d: 'Task finished successfully, can be dismissed', c: 'text-blue-400 bg-blue-500/10' },
      { s: 'Error', d: 'Task failed, tap to see details', c: 'text-red-400 bg-red-500/10' },
    ],
  },
  'chat-tips': {
    title: 'Daily Tips',
    desc: 'The \'Did You Know?\' card on the welcome screen shows daily tips and insights about Vision Chain features.',
    body: 'A rotating tip card appears at the top of the welcome screen. Navigate through tips using the arrow buttons. Tap "GO" to jump to the relevant feature mentioned in the tip.',
    tip: 'Daily tips are updated regularly by administrators. They cover new features, best practices, and ecosystem news.',
  },

  // ─── Send & Receive ───
  'send-basic': {
    title: 'Sending Tokens',
    desc: 'Send VCN, ETH, or other supported tokens to any wallet address or contact.',
    flowTitle: 'Send Flow',
    flowSteps: [
      { label: 'Select Token', sub: 'VCN or ETH' },
      { label: 'Recipient', sub: 'Address or contact' },
      { label: 'Amount', sub: 'Enter value' },
      { label: 'Review', sub: 'Check details' },
      { label: 'Sign', sub: 'Wallet password', color: '#10b981' },
    ],
    prerequisites: ['Wallet setup complete', 'Sufficient token balance for the transfer', 'Recipient wallet address or saved contact'],
    steps: [
      { title: 'Start Send Flow', desc: 'Tap "Send" from the Assets page, use the quick action button, or type "Send" in the AI Chat.' },
      { title: 'Select Token', desc: 'Choose the token you want to send (VCN or ETH).' },
      { title: 'Choose Recipient', desc: 'Select a contact from your list, or enter a wallet address manually.' },
      { title: 'Enter Amount', desc: 'Type the amount to send. The USD equivalent is shown in real-time.' },
      { title: 'Review & Confirm', desc: 'Review the transaction details including recipient, amount, and estimated gas.' },
      { title: 'Enter Wallet Password', desc: 'Enter your wallet password to sign and submit the transaction.' },
    ],
    warning: 'Always double-check the recipient address before confirming. Blockchain transactions are irreversible and cannot be refunded.',
    tip: 'You can also say "Send 100 VCN to John" in the AI Chat. The AI will find the matching contact and pre-fill the transaction details for you.',
  },
  'send-contact': {
    title: 'Contact-based Transfer',
    desc: 'Send tokens to saved contacts by name instead of entering wallet addresses manually.',
    body: 'When you start a send flow, your saved contacts appear for quick selection. You can search by name, and the AI Chat also supports phonetic name matching for voice commands.',
    steps: [
      { title: 'Open Send Flow', desc: 'Start a send transaction using any method (button, chat, or quick action).' },
      { title: 'Search Contact', desc: 'Type a name in the recipient field to filter your contacts.' },
      { title: 'Select Contact', desc: 'Tap the contact to auto-fill their wallet address.' },
      { title: 'Continue', desc: 'Enter the amount and complete the transaction as normal.' },
    ],
  },
  'send-scheduled': {
    title: 'Scheduled Transfer (TimeLock)',
    desc: 'Schedule transfers for future execution using the TimeLock Agent.',
    body: 'The TimeLock Agent allows you to schedule token transfers that execute automatically after a specified delay. This is useful for recurring payments, vesting schedules, or delayed transactions.',
    note: 'Scheduled transfers require sufficient balance at the time of execution, not at the time of scheduling.',
  },
  'send-batch': {
    title: 'Batch Transfer',
    desc: 'Send tokens to multiple recipients at once. Ideal for payroll, airdrops, or community distributions.',
    steps: [
      { title: 'Select Multiple Recipients', desc: 'In the send flow, tap "Multi-send" to enable batch mode. Select contacts or enter multiple addresses.' },
      { title: 'Set Amounts', desc: 'Enter individual amounts for each recipient, or set a uniform amount for all.' },
      { title: 'Review Batch', desc: 'A summary shows all recipients and amounts. Review carefully before confirming.' },
      { title: 'Execute', desc: 'Confirm and sign the batch transaction. Each transfer is executed sequentially.' },
    ],
  },
  'receive-tokens': {
    title: 'Receiving Tokens',
    desc: 'Share your wallet address or QR code to receive tokens from others.',
    steps: [
      { title: 'Go to Receive', desc: 'Navigate to Assets > Receive, or say "How do I receive tokens?" in the AI Chat.' },
      { title: 'Copy Address', desc: 'Tap the copy button to copy your wallet address to the clipboard.' },
      { title: 'Share QR Code', desc: 'Show the QR code to the sender. They can scan it with any compatible wallet.' },
    ],
    tip: 'Your wallet address is the same across all supported networks on Vision Chain. For receiving on other chains (Ethereum, Polygon), use the same address.',
  },

  // ─── Assets ───
  'assets-dashboard': {
    title: 'Portfolio Dashboard',
    desc: 'View your complete portfolio at a glance, including total value, token breakdown, and recent activity.',
    body: 'The Portfolio Dashboard is your central hub for monitoring all on-chain assets. It displays your total portfolio value in USD, individual token balances, and a visual breakdown of your holdings.',
    items: [
      { n: 'Total Value', d: 'Combined USD value of all tokens across all chains' },
      { n: 'Token List', d: 'Individual balances for VCN, ETH, and other tokens with real-time prices' },
      { n: 'Price Change', d: '24-hour percentage change for each token displayed in green/red' },
      { n: 'Quick Actions', d: 'Send, Receive, and Bridge buttons for instant access' },
    ],
  },
  'assets-tokens': {
    title: 'Token List & Balances',
    desc: 'Detailed view of all tokens in your wallet with real-time pricing.',
    body: 'Your wallet automatically detects and displays all ERC-20 tokens held in your address. The primary tokens are VCN (Vision Chain native token) and ETH (for gas on Ethereum-compatible chains).',
    tableHeaders: ['Token', 'Description', 'Usage'],
    tokens: [
      { t: 'VCN', d: 'Vision Chain native token', u: 'Transactions, staking, governance' },
      { t: 'ETH', d: 'Ethereum / gas token', u: 'Gas fees on Ethereum/Sepolia' },
      { t: 'MATIC', d: 'Polygon network token', u: 'Cross-chain operations' },
    ],
  },
  'assets-multichain': {
    title: 'Multi-Chain Balances',
    desc: 'View and manage assets across Vision Chain, Ethereum Sepolia, Polygon, and Base networks.',
    body: 'Vision Chain Wallet supports multiple blockchain networks. Your wallet address works across all supported chains, and you can switch between them to view balances on each network.',
    tip: 'Use the Cross-Chain Bridge to move tokens between Vision Chain and Ethereum. Your wallet address remains the same across all networks.',
  },
  'assets-history': {
    title: 'Transaction History',
    desc: 'View all past transactions including sends, receives, bridge transfers, and staking operations.',
    body: 'The transaction history shows a chronological list of all on-chain activity associated with your wallet. Each entry displays the transaction type, amount, counterparty, timestamp, and confirmation status.',
    statuses: [
      { s: 'Confirmed', d: 'Transaction finalized on-chain', c: 'text-emerald-400 bg-emerald-500/10' },
      { s: 'Pending', d: 'Awaiting blockchain confirmation', c: 'text-amber-400 bg-amber-500/10' },
      { s: 'Failed', d: 'Transaction reverted or rejected', c: 'text-red-400 bg-red-500/10' },
    ],
  },

  // ─── Bridge ───
  'bridge-overview': {
    title: 'Cross-Chain Bridge Overview',
    desc: 'Transfer tokens between Vision Chain and Ethereum securely using the Vision Bridge.',
    features: [
      { t: 'Bi-directional', d: 'Transfer VCN between Vision Chain and Ethereum Sepolia in both directions' },
      { t: 'Secure', d: 'Multi-signature TSS (Threshold Signature Scheme) validation for all bridge transactions' },
      { t: 'Low Cost', d: 'Gasless on Vision Chain side. Only Ethereum gas fees apply for outbound transfers' },
      { t: 'Fast', d: 'Bridge transfers typically complete within 2-5 minutes after blockchain confirmations' },
    ],
    warning: 'Bridge transactions are cross-chain and may take several minutes. Do not close the app while a bridge transfer is in progress.',
  },
  'bridge-forward': {
    title: 'Vision to Ethereum',
    desc: 'Bridge VCN tokens from Vision Chain to Ethereum Sepolia.',
    prerequisites: ['VCN balance on Vision Chain', 'Connected to Vision Chain network'],
    steps: [
      { title: 'Open Bridge', desc: 'Navigate to Bridge from the sidebar menu or say "Bridge" in the AI Chat.' },
      { title: 'Select Direction', desc: 'Choose "Vision Chain -> Ethereum" as the bridge direction.' },
      { title: 'Enter Amount', desc: 'Specify the amount of VCN to bridge. Minimum and maximum limits are shown.' },
      { title: 'Review & Confirm', desc: 'Review the bridge fee, estimated time, and destination. Confirm the transaction.' },
      { title: 'Wait for Confirmation', desc: 'The bridge processes in stages: lock on Vision Chain, validate via TSS, mint on Ethereum.' },
    ],
  },
  'bridge-reverse': {
    title: 'Ethereum to Vision',
    desc: 'Bridge tokens from Ethereum back to Vision Chain.',
    prerequisites: ['VCN balance on Ethereum Sepolia', 'ETH for gas fees on Ethereum'],
    steps: [
      { title: 'Open Bridge', desc: 'Navigate to Bridge and select "Ethereum -> Vision Chain".' },
      { title: 'Enter Amount', desc: 'Specify the amount to bridge back to Vision Chain.' },
      { title: 'Approve Token', desc: 'Approve the bridge contract to spend your tokens (first time only).' },
      { title: 'Confirm Bridge', desc: 'Sign the transaction. ETH gas fee applies on the Ethereum side.' },
      { title: 'Wait for Completion', desc: 'Tokens are burned on Ethereum and unlocked on Vision Chain after TSS validation.' },
    ],
  },
  'bridge-monitor': {
    title: 'Bridge Transaction Monitoring',
    desc: 'Track the status of your bridge transfers in real-time.',
    body: 'All bridge transactions are tracked with a multi-stage progress indicator. You can view the status of each stage: submission, confirmation, TSS validation, and completion.',
    note: 'Bridge transactions are processed automatically. If a bridge transfer appears stuck for more than 30 minutes, contact support with your transaction hash.',
  },

  // ─── Staking ───
  'staking-overview': {
    title: 'Staking Overview',
    desc: 'Stake VCN tokens as a Bridge Validator to earn rewards from bridge fees and subsidy pools. All staking transactions are gasless.',
    features: [
      { t: 'Annual APY 12-20%', d: 'Rewards are dynamically calculated based on total network stake, bridge volume, and subsidy pool balance. The actual APY is displayed in real-time on the staking page.' },
      { t: 'Dual Reward Source', d: 'Validators earn from two pools: (1) Bridge Fee Pool - 1% of every bridge transaction, and (2) Subsidy Pool - additional VCN rewards distributed over time.' },
      { t: 'Gasless Staking', d: 'All staking operations use the Vision Paymaster system and EIP-2612 Permit signatures. You never pay gas fees - only a 1 VCN service fee per stake transaction.' },
      { t: '50% Slashing Risk', d: 'Validators who submit invalid bridge proofs may lose 50% of their staked amount. This protects the integrity of cross-chain transactions.' },
    ],
    dashboardStatsTitle: 'Dashboard Stats',
    dashboardStatsDesc: 'When you open the Staking page, a stats bar at the top shows the following network-wide information:',
    dashboardStats: [
      { n: 'Total Staked', d: 'The total amount of VCN staked across all validators network-wide' },
      { n: 'Active Validators', d: 'Number of validators currently running and validating bridge transactions (shown with a green pulse indicator)' },
      { n: 'Minimum Stake', d: 'The minimum amount required to become a validator: 100 VCN' },
      { n: 'Cooldown Period', d: 'Number of days your tokens are locked after requesting unstake: 7 days' },
      { n: 'Slash Rate', d: 'Percentage of stake that can be slashed for invalid proofs: 50% (shown in red)' },
    ],
    balancePanelTitle: 'Your Staking Balance Panel',
    balancePanelDesc: 'Below the stats bar, your personal staking information is displayed in an amber-highlighted panel:',
    balancePanel: [
      { n: 'Your VCN Balance', d: 'Available VCN in your wallet that can be staked' },
      { n: 'Your Staked Amount', d: 'VCN currently locked in the staking contract (shown in amber)' },
      { n: 'Pending Unstake', d: 'If you have requested an unstake, shows amount and time remaining (e.g., "3d 12h remaining")' },
      { n: 'Pending Rewards', d: 'Unclaimed VCN rewards with current APY percentage. A green "Claim" button appears next to the amount' },
    ],
  },
  'staking-how': {
    title: 'How to Stake VCN',
    desc: 'Detailed step-by-step guide to staking VCN as a Bridge Validator.',
    prerequisites: ['Minimum 100 VCN in your wallet (plus 1 VCN service fee)', 'Wallet password set up (used to sign the EIP-712 Permit)', 'Logged in to Vision Chain wallet'],
    steps: [
      { title: 'Open the Staking Page', desc: 'From the sidebar menu, tap "Earn" to navigate to the Validator Staking page. The page displays network stats, your balance, and the staking form.' },
      { title: 'Check the "Stake" Tab', desc: 'The staking form has three tabs: Stake, Unstake, and Withdraw. Make sure you are on the "Stake" tab (highlighted in amber). If not, tap it to switch.' },
      { title: 'Enter Stake Amount', desc: 'Type the amount of VCN you wish to stake in the input field. The minimum is 100 VCN (displayed as placeholder text "Min: 100 VCN"). You can tap the "MAX" button to stake your entire available balance.' },
      { title: 'Click "Stake VCN"', desc: 'Tap the amber "STAKE VCN" button at the bottom of the form. This begins the staking process.' },
      { title: 'Enter Wallet Password', desc: 'A modal popup titled "Spending Password Required" appears. Enter your wallet password (the one you set during wallet setup, not your login password) and tap "Confirm".' },
      { title: 'Wait for EIP-712 Permit Signing', desc: 'The button changes to "Approving..." while your wallet signs an EIP-712 typed data permit. This is a gasless signature that authorizes the Paymaster to transfer VCN (stake amount + 1 VCN fee) on your behalf.' },
      { title: 'Transaction Processing', desc: 'After signing, the button changes to "Staking..." while the Paymaster submits the transaction on-chain. The Paymaster pays the gas fee, you pay only the 1 VCN service fee via the permit.' },
      { title: 'Confirmation', desc: 'On success, a green success indicator appears with the transaction hash. Your "Your Staked Amount" updates, your VCN Balance decreases, and you are now an Active Validator. Rewards begin accumulating immediately.' },
    ],
    warning: 'The minimum stake is 100 VCN. If you try to stake less, an error message appears: "Minimum stake is 100 VCN". Each staking transaction charges a 1 VCN service fee to the Paymaster.',
    tip: 'After staking, your status changes to "Active Validator" and you begin earning rewards proportional to your stake. The rewards come from bridge transaction fees (1% of each bridge transfer) and the subsidy pool.',
  },
  'staking-rewards': {
    title: 'Rewards, Unstaking & Withdrawal',
    desc: 'Comprehensive guide to claiming rewards, requesting unstake, and withdrawing your tokens.',
    claimingTitle: 'Claiming Rewards',
    claimingDesc: 'Rewards accumulate continuously as long as you are an Active Validator. They are visible in the "Pending Rewards" row of your balance panel.',
    claimingSteps: [
      { title: 'Check Pending Rewards', desc: 'Look at the "Pending Rewards" line in the amber balance panel. It shows the exact VCN amount with up to 4 decimal places, along with the current APY percentage.' },
      { title: 'Tap "Claim"', desc: 'The green "Claim" button appears next to your pending rewards. Tap it to claim. The button is disabled (grayed out) if you have no rewards to claim.' },
      { title: 'Transaction Processing', desc: 'The claim transaction is submitted via the Paymaster (gasless). The button shows a spinner while processing.' },
      { title: 'Rewards Added to Balance', desc: 'On success, your VCN wallet balance increases by the claimed amount. The pending rewards counter resets to 0 and begins accumulating again immediately.' },
    ],
    claimingTip: 'Claiming rewards is gasless and has no fee. You can claim as often as you want, but since each claim is a transaction, it is practical to let rewards accumulate before claiming.',
    unstakeTitle: 'Requesting Unstake',
    unstakeDesc: 'Unstaking is a two-step process: first you request unstake (which starts a 7-day cooldown), then you withdraw after the cooldown period.',
    unstakeSteps: [
      { title: 'Switch to "Unstake" Tab', desc: 'In the staking form, tap the "Unstake" tab. The label shows your maximum unstakeable amount (e.g., "Unstake Amount (Max: 1,000 VCN)").' },
      { title: 'Enter Unstake Amount', desc: 'Type the amount to unstake. You can tap "MAX" to unstake everything. Important: if you partially unstake, the remaining amount must be either 0 or at least 100 VCN (the minimum stake). Otherwise you will see an error: "Remaining stake would be below minimum 100 VCN."' },
      { title: 'Tap "Request Unstake"', desc: 'Tap the amber button. The transaction is submitted via Paymaster (gasless).' },
      { title: 'Cooldown Begins', desc: 'On success, a new "Pending Unstake" row appears in your balance panel showing the amount and a countdown timer (e.g., "7d 0h remaining"). Your staked amount decreases accordingly.' },
    ],
    unstakeWarning: 'During the 7-day cooldown period, your unstaking tokens do NOT earn rewards. You cannot cancel an unstake request. Make sure you are ready to wait before proceeding.',
    unstakeNote: 'If you unstake your entire balance, you will no longer be an Active Validator and will stop earning rewards. You can re-stake at any time with the minimum 100 VCN.',
    withdrawTitle: 'Withdrawing After Cooldown',
    withdrawDesc: 'After the 7-day cooldown period is complete, a third "Withdraw" tab appears in the staking form.',
    withdrawSteps: [
      { title: 'Wait for Cooldown', desc: 'Monitor the countdown timer in the "Pending Unstake" row. When it changes to "Ready to withdraw", the 7-day period is complete.' },
      { title: 'Switch to "Withdraw" Tab', desc: 'A green "Withdraw" tab appears automatically in the form tabs when your cooldown is complete. Tap it.' },
      { title: 'Tap "Withdraw"', desc: 'Tap the green "WITHDRAW" button. The Paymaster handles the gasless withdrawal.' },
      { title: 'Tokens Returned', desc: 'Your VCN balance increases by the withdrawn amount. The "Pending Unstake" row disappears. The process is complete.' },
    ],
    validatorTableTitle: 'Validator Table',
    validatorTableDesc: 'At the bottom of the page, a table shows the top 5 active validators with their shortened addresses and staked amounts. This gives you a sense of the network\'s validator distribution.',
  },

  // ─── Labels for shared UI components ───
  _labels: {
    tip: 'TIP',
    warning: 'WARNING',
    note: 'NOTE',
    prerequisites: 'PREREQUISITES',
    backToHome: 'Back to Home',
    versionLabel: 'Vision Chain User Manual v1.0',
  },
};
