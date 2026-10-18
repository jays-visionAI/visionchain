/**
 * The Agent Gateway's action catalog, served by `GET /agentGateway`.
 *
 * It is the authoritative list of what the gateway documents. The discovery
 * response derives its counts from it (the hand-written description said "59
 * actions across 15 domains" long after the catalog grew to 83 across 17), and
 * test/agentGatewayPolicy.test.cjs holds public/openapi.json to it.
 *
 * Lives in its own file so the counts and the OpenAPI document can be checked
 * without loading index.js.
 */

/* eslint-disable max-len -- one line per action, moved verbatim from index.js */

const AGENT_CATALOG_DOMAINS = {
  system: {
    actions: [
      {
        action: "system.register", auth: false, tier: "T1", cost: "0", params: { agent_name: "required", platform: "required", owner_email: "required", platform_id: "optional", referral_code: "optional" },
        response: ["agent.wallet_address", "agent.api_key", "agent.referral_code", "agent.sbt", "user.uid", "user.email"], desc: "Register agent, get wallet + API key + SBT",
      },
      { action: "system.network_info", auth: false, tier: "T1", cost: "0", params: {}, response: ["chain_id", "rpc_url", "block_height", "contracts", "token"], desc: "Chain info, contracts, block height" },
      { action: "system.delete_agent", auth: true, tier: "T2", cost: "0.1", params: {}, response: ["deleted"], desc: "Permanently delete agent" },
    ],
  },
  wallet: {
    actions: [
      { action: "wallet.balance", auth: true, tier: "T1", cost: "0", params: {}, response: ["balance", "rp_points", "staking", "wallet_address"], desc: "VCN balance + RP points" },
      { action: "wallet.tx_history", auth: true, tier: "T1", cost: "0", params: { limit: "optional (1-100)", type: "optional (transfer|stake|unstake)" }, response: ["transactions[]", "total"], desc: "Transaction history" },
      { action: "wallet.token_info", auth: true, tier: "T1", cost: "0", params: { token_address: "optional (defaults to VCN)" }, response: ["name", "symbol", "decimals", "total_supply"], desc: "ERC-20 token details" },
      { action: "wallet.gas_estimate", auth: true, tier: "T1", cost: "0", params: { tx_type: "optional (transfer|stake|unstake)" }, response: ["gas_limit", "gas_price", "estimated_cost"], desc: "Gas estimation" },
      { action: "wallet.approve", auth: true, tier: "T3", cost: "0.5", params: { spender: "required", amount: "required", token_address: "optional" }, response: ["tx_hash", "spender", "amount"], desc: "Approve ERC-20 spender" },
    ],
  },
  transfer: {
    actions: [
      { action: "transfer.send", auth: true, tier: "T2", cost: "0.1", params: { to: "required", amount: "required (max 10000)" }, response: ["tx_hash", "from", "to", "amount", "rp_earned"], desc: "Send VCN (gasless)" },
      { action: "transfer.batch", auth: true, tier: "T4", cost: "1.0", params: { transfers: "required (array of {to, amount})" }, response: ["results[]", "total_sent", "rp_earned"], desc: "Batch transfer" },
      // eslint-disable-next-line max-len
      { action: "transfer.conditional", auth: true, tier: "T3", cost: "0.5", params: { to: "required", amount: "required", condition: "required ({type, value})" }, response: ["condition_id", "condition", "status"], desc: "Conditional/scheduled transfer. Conditions: time_after, balance_above, balance_below. transfer.scheduled is an alias." },
    ],
  },
  staking: {
    actions: [
      { action: "staking.deposit", auth: true, tier: "T3", cost: "0.5", params: { amount: "required (min 1)" }, response: ["tx_hash", "staked_amount", "rp_earned"], desc: "Stake VCN" },
      { action: "staking.request_unstake", auth: true, tier: "T3", cost: "0.5", params: { amount: "required" }, response: ["tx_hash", "amount", "cooldown_end"], desc: "Request unstake (starts cooldown)" },
      { action: "staking.withdraw", auth: true, tier: "T3", cost: "0.5", params: {}, response: ["tx_hash", "withdrawn_amount"], desc: "Withdraw after cooldown" },
      { action: "staking.claim", auth: true, tier: "T3", cost: "0.5", params: {}, response: ["tx_hash", "claimed_amount", "rp_earned"], desc: "Claim staking rewards" },
      { action: "staking.compound", auth: true, tier: "T3", cost: "0.5", params: {}, response: ["tx_hash", "claimed", "restaked"], desc: "Claim + re-stake atomically" },
      { action: "staking.rewards", auth: true, tier: "T1", cost: "0", params: {}, response: ["pending_rewards", "last_claim"], desc: "Query pending rewards" },
      { action: "staking.apy", auth: true, tier: "T1", cost: "0", params: {}, response: ["apy_percent", "total_staked", "staker_count"], desc: "Current APY + network stats" },
      { action: "staking.cooldown", auth: true, tier: "T1", cost: "0", params: {}, response: ["in_cooldown", "cooldown_end", "amount"], desc: "Cooldown status" },
      { action: "staking.position", auth: true, tier: "T1", cost: "0", params: {}, response: ["staked", "pending_rewards", "cooldown", "history[]"], desc: "Full staking position" },
    ],
  },
  bridge: {
    actions: [
      { action: "bridge.initiate", auth: true, tier: "T4", cost: "1.0", params: { amount: "required", destination_chain: "required (chainId)", recipient: "optional" }, response: ["bridge_id", "intent_hash", "status", "tx_hash"], desc: "Start cross-chain bridge" },
      { action: "bridge.status", auth: true, tier: "T1", cost: "0", params: { bridge_id: "optional", intent_hash: "optional" }, response: ["bridge_id", "status", "source_tx", "dest_tx", "amount"], desc: "Check bridge status" },
      { action: "bridge.finalize", auth: true, tier: "T3", cost: "0.5", params: { bridge_id: "required" }, response: ["tx_hash", "status", "amount"], desc: "Finalize bridge" },
      { action: "bridge.history", auth: true, tier: "T1", cost: "0", params: {}, response: ["bridges[]", "total"], desc: "Bridge transaction history" },
      { action: "bridge.fee", auth: true, tier: "T1", cost: "0", params: { amount: "optional", destination_chain: "optional" }, response: ["fee_vcn", "fee_percent", "estimated_time"], desc: "Bridge fee estimate" },
    ],
  },
  nft: {
    actions: [
      { action: "nft.mint", auth: true, tier: "T4", cost: "1.0", params: { token_type: "optional (nft|sbt)", mint_to: "optional", metadata: "optional ({name, description, image})" }, response: ["tx_hash", "token_id", "contract_address", "token_uri"], desc: "Mint NFT or SBT" },
      { action: "nft.balance", auth: true, tier: "T1", cost: "0", params: { wallet_address: "optional", contract_address: "optional" }, response: ["nfts[]", "sbts[]", "total"], desc: "NFT/SBT balance" },
      { action: "nft.metadata", auth: true, tier: "T1", cost: "0", params: { token_id: "required", contract_address: "optional" }, response: ["name", "description", "image", "attributes[]"], desc: "Token metadata" },
    ],
  },
  authority: {
    actions: [
      { action: "authority.grant", auth: true, tier: "T2", cost: "0.1", params: { delegate_to: "required", permissions: "required (array)", limits: "optional", expires_at: "optional" }, response: ["delegation_id", "permissions", "expires_at"], desc: "Delegate permissions" },
      { action: "authority.revoke", auth: true, tier: "T2", cost: "0.1", params: { delegation_id: "optional", delegate_to: "optional" }, response: ["revoked", "delegation_id"], desc: "Revoke delegation" },
      { action: "authority.status", auth: true, tier: "T1", cost: "0", params: { delegate_to: "optional" }, response: ["delegations[]", "total"], desc: "List active delegations" },
      { action: "authority.usage", auth: true, tier: "T1", cost: "0", params: { delegation_id: "required" }, response: ["total_calls", "last_used", "actions_used[]"], desc: "Delegation usage stats" },
      { action: "authority.audit", auth: true, tier: "T1", cost: "0", params: { limit: "optional" }, response: ["events[]", "total"], desc: "Audit trail" },
    ],
  },
  settlement: {
    actions: [
      { action: "settlement.set_wallet", auth: true, tier: "T2", cost: "0.1", params: { wallet_address: "required", label: "optional" }, response: ["wallet_address", "label", "updated"], desc: "Set payout wallet" },
      { action: "settlement.get_wallet", auth: true, tier: "T1", cost: "0", params: {}, response: ["wallet_address", "label"], desc: "Get settlement wallet" },
    ],
  },
  node: {
    actions: [
      { action: "node.register", auth: true, tier: "T2", cost: "0.1", params: { version: "required", os: "optional", arch: "optional", capabilities: "optional (array)" }, response: ["node_id", "status", "registered_at"], desc: "Register Vision Node" },
      { action: "node.heartbeat", auth: true, tier: "T1", cost: "0", params: {}, response: ["acknowledged", "next_expected"], desc: "Send heartbeat (every 5 min)" },
      { action: "node.status", auth: true, tier: "T1", cost: "0", params: {}, response: ["node_id", "status", "uptime", "last_heartbeat"], desc: "Node status" },
      { action: "node.peers", auth: true, tier: "T1", cost: "0", params: {}, response: ["peers[]", "total"], desc: "List network peers" },
    ],
  },
  storage: {
    actions: [
      { action: "storage.set", auth: true, tier: "T2", cost: "0.1", params: { key: "required (1-128 chars)", value: "required (max 10KB)" }, response: ["key", "stored", "size_bytes"], desc: "Store key-value" },
      { action: "storage.get", auth: true, tier: "T1", cost: "0", params: { key: "required" }, response: ["key", "value", "updated_at"], desc: "Retrieve value" },
      { action: "storage.list", auth: true, tier: "T1", cost: "0", params: {}, response: ["keys[]", "total"], desc: "List all keys" },
      { action: "storage.delete", auth: true, tier: "T2", cost: "0.1", params: { key: "required" }, response: ["deleted", "key"], desc: "Delete key" },
    ],
  },
  disk: {
    description: "Vision Disk - Distributed storage, semantic search, and long-term memory for AI agents and 3rd party partners.",
    actions: [
      { action: "disk.provision", auth: true, tier: "T2", cost: "0.1", params: { target_agent: "optional", quota_gb: "optional (1-1000, default 5)", tier: "optional (free|standard|premium|enterprise)", features: "optional (array)" }, response: ["disk_id", "tenant", "quota_gb", "tier", "features_enabled", "status"], desc: "Provision disk storage for agent" },
      { action: "disk.write", auth: true, tier: "T2", cost: "0.1", params: { file_name: "required", data: "required (base64)", file_type: "optional", folder: "optional", tags: "optional (array)", source_type: "optional", auto_index: "optional (boolean)" }, response: ["file_id", "name", "size", "chunks", "cid", "content_hash"], desc: "Upload file to Vision Disk" },
      { action: "disk.read", auth: true, tier: "T1", cost: "0", params: { file_id: "required" }, response: ["file_id", "name", "type", "size", "data", "content_hash", "cid"], desc: "Download file from Vision Disk" },
      { action: "disk.list", auth: true, tier: "T1", cost: "0", params: { folder: "optional", search: "optional", source_type: "optional", tags: "optional (array)", limit: "optional (1-200)" }, response: ["total", "files[]"], desc: "List files with filters" },
      { action: "disk.delete", auth: true, tier: "T2", cost: "0.1", params: { file_id: "required" }, response: ["file_id", "name", "deleted_chunks"], desc: "Delete file and its chunks" },
      { action: "disk.query", auth: true, tier: "T3", cost: "0.5", params: { query: "required", model: "optional (gemini|openai)", top_k: "optional (1-20)", filters: "optional ({tags, source_type, date_range})" }, response: ["query", "model", "total_results", "results[]"], desc: "Semantic search across indexed files" },
      { action: "disk.memory", auth: true, tier: "T2", cost: "0.1", params: { operation: "required (create|read|update|delete|list|search)", category: "optional", key: "optional", content: "optional", importance: "optional (0-1)", memory_id: "optional", query: "optional", ttl_days: "optional" }, response: ["memory_id", "category", "content"], desc: "Long-term memory CRUD for AI agents" },
      { action: "disk.usage", auth: true, tier: "T1", cost: "0", params: {}, response: ["tenant", "usage", "quota"], desc: "Storage usage and quota info" },
    ],
  },
  pipeline: {
    actions: [
      { action: "pipeline.create", auth: true, tier: "T2", cost: "0.1", params: { name: "required", steps: "required (array)", trigger: "optional", schedule: "optional" }, response: ["pipeline_id", "name", "steps_count"], desc: "Create multi-step pipeline" },
      { action: "pipeline.execute", auth: true, tier: "T3", cost: "0.5", params: { pipeline_id: "required" }, response: ["execution_id", "results[]", "status"], desc: "Execute pipeline" },
      { action: "pipeline.list", auth: true, tier: "T1", cost: "0", params: {}, response: ["pipelines[]", "total"], desc: "List pipelines" },
      { action: "pipeline.delete", auth: true, tier: "T2", cost: "0.1", params: { pipeline_id: "required" }, response: ["deleted", "pipeline_id"], desc: "Delete pipeline" },
    ],
  },
  webhook: {
    actions: [
      { action: "webhook.subscribe", auth: true, tier: "T2", cost: "0.1", params: { event: "required", callback_url: "required", filters: "optional" }, response: ["subscription_id", "event", "callback_url"], desc: "Subscribe to events" },
      { action: "webhook.unsubscribe", auth: true, tier: "T2", cost: "0.1", params: { subscription_id: "required" }, response: ["unsubscribed", "subscription_id"], desc: "Remove webhook" },
      { action: "webhook.list", auth: true, tier: "T1", cost: "0", params: {}, response: ["webhooks[]", "total"], desc: "List webhooks" },
      { action: "webhook.test", auth: true, tier: "T1", cost: "0", params: { subscription_id: "required" }, response: ["delivered", "response_code"], desc: "Send test event" },
      { action: "webhook.logs", auth: true, tier: "T1", cost: "0", params: { limit: "optional" }, response: ["deliveries[]", "total"], desc: "Delivery history" },
    ],
  },
  hosting: {
    actions: [
      { action: "hosting.configure", auth: true, tier: "T2", cost: "0.1", params: { llm_model: "optional (gemini-2.0-flash|gemini-3-flash-preview|deepseek-chat, default deepseek-chat)", system_prompt: "optional", trigger: "optional ({type: interval, interval_minutes: 5-1440})", allowed_actions: "optional (array; enabled_actions accepted as an alias). Hosted-loop names (balance, transfer, stake, ...), gateway actions (disk.write) or domain wildcards (disk.*). A non-empty list is also this API key's scope: afterwards the key may call only these actions plus social.profile, social.leaderboard, system.network_info, system.delete_agent and hosting.*", max_vcn_per_action: "optional (1-100, default 5)" }, response: ["hosting", "api_scope", "estimated_monthly_cost_vcn"], desc: "Configure agent hosting and declare the agent's actions" },
      { action: "hosting.toggle", auth: true, tier: "T2", cost: "0.1", params: { enabled: "required (boolean)" }, response: ["enabled", "agent_name"], desc: "Enable/disable hosting" },
      { action: "hosting.logs", auth: true, tier: "T1", cost: "0", params: { limit: "optional" }, response: ["logs[]", "total"], desc: "Execution logs" },
    ],
  },
  social: {
    actions: [
      { action: "social.referral", auth: true, tier: "T1", cost: "0", params: {}, response: ["referral_code", "total_referrals", "rewards_earned"], desc: "Referral code + stats" },
      { action: "social.leaderboard", auth: true, tier: "T1", cost: "0", params: { type: "optional (rp|referrals|transfers)" }, response: ["rankings[]", "your_rank", "your_score"], desc: "Top agents" },
      { action: "social.profile", auth: true, tier: "T1", cost: "0", params: {}, response: ["agent_name", "wallet_address", "rp_points", "sbt", "created_at"], desc: "Full agent profile" },
    ],
  },
  mobile_node: {
    description: "Mobile Node (S-M Class) -- earn VCN by contributing network uptime from Android app or PWA.",
    actions: [
      { action: "mobile_node.register", auth: true, tier: "T1", cost: "0", params: { email: "required", device_type: "required (android|pwa)", firebase_id_token: "required (Firebase ID token; email must match)", referral_code: "optional" }, response: ["node_id", "api_key", "wallet_address"], desc: "Register mobile node (requires Firebase auth), get API key + wallet" },
      { action: "mobile_node.heartbeat", auth: true, tier: "T1", cost: "0", params: { mode: "required (wifi_full|cellular_min)", battery_pct: "optional", data_used_mb: "optional" }, response: ["accepted", "epoch", "uptime_today_sec", "pending_reward"], desc: "Send heartbeat (5min WiFi / 30min cellular)" },
      { action: "mobile_node.status", auth: true, tier: "T1", cost: "0", params: {}, response: ["node_id", "device_type", "status", "total_uptime_hours", "current_epoch", "pending_reward", "claimed_reward", "weight", "network_rank", "total_nodes"], desc: "Full node status + rewards" },
      { action: "mobile_node.claim_reward", auth: true, tier: "T1", cost: "0", params: {}, response: ["claimed_amount", "tx_hash", "new_balance"], desc: "Claim pending epoch rewards" },
      { action: "mobile_node.submit_attestation", auth: true, tier: "T1", cost: "0", params: { attestations: "required (array of {block_number, block_hash, signer_valid, parent_hash_valid, timestamp_valid})" }, response: ["attestations_accepted", "bonus_weight"], desc: "Submit block header verification results" },
      { action: "mobile_node.leaderboard", auth: false, tier: "T1", cost: "0", params: { scope: "optional (global|country)", limit: "optional (1-100, default 50)" }, response: ["rankings[]", "total_nodes"], desc: "Node contribution leaderboard" },
    ],
  },
  polymarket: {
    description: "Vision Predict (Beta) -- configurable autonomous AI agent for Polymarket prediction markets. Non-custodial: user keeps wallet, agent acts within delegated authority + risk rules. Phase 1 = enrollment only; live betting (polymarket.place_bet, T3) ships in Phase 3.",
    actions: [
      { action: "polymarket.eligibility", auth: true, tier: "T1", cost: "0", params: { country_code: "optional (ISO-3166-1 alpha-2, e.g. KR)", self_attest_age_18: "optional (boolean)", self_attest_not_us: "optional (boolean)" }, response: ["eligible", "blocked_reason", "blocked_countries[]", "polymarket_tos_url", "disclaimer"], desc: "Check user eligibility against Polymarket TOS, geo-block list, and Vision Predict launch gate. Always call before enroll." },
      { action: "polymarket.config", auth: true, tier: "T1", cost: "0", params: {}, response: ["enrolled", "status (none|active|paused)", "rules", "authority", "created_at"], desc: "Read current Polymarket agent config and risk rules" },
      { action: "polymarket.enroll", auth: true, tier: "T2", cost: "0.1", params: { wallet_address: "required (user's own Polygon wallet)", rules: "required ({max_bet_usdc, daily_loss_cap_usdc, daily_bet_count, allowed_categories[], forbidden_keywords[], time_window})", strategy: "required (preset|custom)", acknowledged_disclaimer: "required (boolean, must be true)" }, response: ["enrollment_id", "authority_grant_id", "status", "rules", "next_step"], desc: "Enroll agent into Vision Predict: persist risk rules and create authority.grant scope=polymarket.bet. Does NOT place bets (Phase 3)." },
      { action: "polymarket.update_rules", auth: true, tier: "T2", cost: "0.1", params: { rules: "required (partial update of {max_bet_usdc, daily_loss_cap_usdc, daily_bet_count, allowed_categories[], forbidden_keywords[], time_window})" }, response: ["rules", "updated_at"], desc: "Update risk rules. Authority.grant is automatically refreshed to match." },
      { action: "polymarket.pause", auth: true, tier: "T1", cost: "0", params: { reason: "optional" }, response: ["status", "paused_at"], desc: "Manually pause agent betting. Outstanding positions are NOT closed." },
      { action: "polymarket.resume", auth: true, tier: "T1", cost: "0", params: {}, response: ["status", "resumed_at"], desc: "Resume after manual pause. Eligibility re-checked at resume time." },
      { action: "polymarket.list_markets", auth: true, tier: "T1", cost: "0", params: { order: "optional (volume24hr|liquidity|competitive, default volume24hr)", tag_id: "optional", limit: "optional (1-100, default 20)", offset: "optional (>=0, default 0)", filter_by_rules: "optional (boolean, default true if enrolled)" }, response: ["markets[]", "count", "total", "from_cache", "cached_age_seconds", "filter_applied"], desc: "List active Polymarket markets via Gamma API (cached). Optionally intersects with the agent's allowed_categories and excludes forbidden_keywords. Read-only." },
      { action: "polymarket.market_detail", auth: true, tier: "T1", cost: "0", params: { market_id: "required (Polymarket market id)" }, response: ["market", "passes_rules", "fail_reasons[]", "from_cache", "cached_age_seconds"], desc: "Fetch a single Polymarket market (cached). Includes rule-pass annotation. Read-only." },
      { action: "polymarket.simulate", auth: true, tier: "T3", cost: "0.5", params: { market_id: "optional (one of market_id or market_query required)", market_query: "optional (free-text)", model: "optional (gemini-2.0-flash|gemini-3-flash-preview|deepseek-chat, default gemini-2.0-flash)", max_size_usdc_hint: "optional", note: "optional (free-form, low-trust, clamped 500 chars)" }, response: ["decision_id", "market_snapshot", "llm", "llm_decision", "rule_check", "charged_vcn"], desc: "Phase 2 closed-loop simulation. Calls Gemini for rationale + decision, runs deterministic rule-check (server-side override), persists to predict_decisions. No on-chain bet. Charges 0.5 VCN." },
      { action: "polymarket.simulations", auth: true, tier: "T1", cost: "0", params: { limit: "optional (1-100, default 25)", cursor: "optional (decision_id of last seen doc)", filter: "optional (all|pending|resolved|skip, default all)" }, response: ["decisions[]", "next_cursor", "total_in_filter"], desc: "Paginated history of past polymarket.simulate decisions, with PnL-if-bet for resolved markets (paper, not real)." },
      { action: "polymarket.decision_detail", auth: true, tier: "T1", cost: "0", params: { decision_id: "required" }, response: ["decision_id", "market_id", "market_snapshot", "llm (incl. raw_response)", "llm_decision", "rule_check", "resolution", "charged_vcn", "created_at"], desc: "Full detail of a single past polymarket.simulate decision, including the LLM raw_response for transparency." },
    ],
  },
};

/**
 * @param {object} domains - AGENT_CATALOG_DOMAINS
 * @return {{totalActions: number, totalDomains: number, actions: string[]}} counts and names
 */
function summarizeCatalog(domains = AGENT_CATALOG_DOMAINS) {
  const actions = [];
  for (const domain of Object.values(domains)) {
    for (const entry of domain.actions || []) actions.push(entry.action);
  }
  return { totalActions: actions.length, totalDomains: Object.keys(domains).length, actions };
}

module.exports = { AGENT_CATALOG_DOMAINS, summarizeCatalog };
