/**
 * Agent Gateway policy: which keys may call, and what they may call.
 *
 * Two rules from the gateway spec that the running code did not enforce
 * (found by reading functions/index.js on 2026-10-18):
 *
 *   R-GW-1  every agent call carries a key bound to an SBT-holding wallet,
 *           and a revoked identity is refused.
 *
 *           `authenticateAgent` was a bare Firestore lookup on
 *           `agents.apiKey`. `system.register` returned the key before the
 *           SBT was minted, the mint ran after the response, and a failed
 *           mint left a key that worked forever.
 *
 *   R-GW-2  an agent cannot call outside the actions it declared at hosting
 *           time.
 *
 *           `hosting.configure` stored `allowed_actions`, but only the
 *           scheduled LLM loop read it. The same agent's API key could call
 *           anything.
 *
 * The fee rule (R-GW-3) stays in index.js because it is interleaved with the
 * on-chain fee transfer; the alias table below is shared with it, because a
 * legacy alias that the pricing table does not know is a free call.
 *
 * It lives in its own file so it can be tested without loading index.js
 * (which initialises Firebase and registers every function on require). See
 * test/agentGatewayPolicy.test.cjs.
 */

// ---------------------------------------------------------------------------
// Action names
// ---------------------------------------------------------------------------

/**
 * Every legacy alias the gateway's handlers accept, mapped to the canonical
 * `domain.method` name that pricing (`config/api_pricing.service_tiers`), the
 * node gate (`ACTION_TIER_MAP`) and the hosting scope are keyed by.
 *
 * This used to be a 15-entry table inside the request handler while the
 * handlers accepted 43 aliases, so `nft_mint`, `bridge_initiate`,
 * `batch_transfer` and the rest were priced as "unknown" (T1, free) and
 * skipped the T3/T4 node gate. test/agentGatewayPolicy.test.cjs reads the
 * dispatch lines in index.js and fails if a handler accepts an alias that is
 * missing here.
 */
const ACTION_ALIASES = Object.freeze({
  // system
  "register": "system.register",
  "network_info": "system.network_info",
  "delete_agent": "system.delete_agent",
  // wallet
  "balance": "wallet.balance",
  "transactions": "wallet.tx_history",
  "token_info": "wallet.token_info",
  "gas_estimate": "wallet.gas_estimate",
  "approve": "wallet.approve",
  // transfer — the catalog documents transfer.scheduled as an alias of
  // transfer.conditional, and one handler serves all four names.
  "transfer": "transfer.send",
  "batch_transfer": "transfer.batch",
  "conditional_transfer": "transfer.conditional",
  "scheduled_transfer": "transfer.conditional",
  "transfer.scheduled": "transfer.conditional",
  "transfer_sepolia": "transfer.sepolia",
  // staking
  "stake": "staking.deposit",
  "unstake": "staking.request_unstake",
  "withdraw_stake": "staking.withdraw",
  "claim_rewards": "staking.claim",
  "compound": "staking.compound",
  "rewards": "staking.rewards",
  "apy": "staking.apy",
  "cooldown": "staking.cooldown",
  "staking_info": "staking.position",
  // bridge
  "bridge_initiate": "bridge.initiate",
  "bridge_status": "bridge.status",
  "bridge_finalize": "bridge.finalize",
  "bridge_history": "bridge.history",
  "bridge_fee": "bridge.fee",
  "bridge_reverse_prepare": "bridge.reverse_prepare",
  "bridge_reverse": "bridge.reverse",
  // nft
  "nft_mint": "nft.mint",
  "nft_balance": "nft.balance",
  "nft_metadata": "nft.metadata",
  // authority
  "authority_grant": "authority.grant",
  "authority_revoke": "authority.revoke",
  "authority_status": "authority.status",
  "authority_usage": "authority.usage",
  "authority_audit": "authority.audit",
  // settlement
  "set_settlement_wallet": "settlement.set_wallet",
  "get_settlement_wallet": "settlement.get_wallet",
  // social
  "referral": "social.referral",
  "leaderboard": "social.leaderboard",
  "profile": "social.profile",
  // hosting
  "configure_hosting": "hosting.configure",
  "toggle_hosting": "hosting.toggle",
  "hosting_logs": "hosting.logs",
});

/**
 * @param {string} action - action name as sent by the caller
 * @return {string} canonical `domain.method` name (or the input, if unknown)
 */
function canonicalizeAction(action) {
  const name = String(action || "");
  return Object.prototype.hasOwnProperty.call(ACTION_ALIASES, name) ? ACTION_ALIASES[name] : name;
}

// ---------------------------------------------------------------------------
// R-GW-2: declared action scope
// ---------------------------------------------------------------------------

/**
 * What the hosted LLM loop (`executeAgentAction` in index.js) can execute.
 * These are the only names `hosting.configure` accepted before scope
 * enforcement existed, so every stored declaration is made of them.
 */
const HOSTED_LOOP_ACTIONS = Object.freeze([
  "balance", "transfer", "stake", "unstake", "network_info", "leaderboard",
  "staking_info", "transactions",
  // Loop-only skills: content the LLM writes. No gateway action behind them.
  "referral_outreach", "social_promo", "content_create", "invite_distribute", "community_engage",
]);

/**
 * Callable whatever the declaration says. Without these an agent with a
 * narrow declaration could not see its own identity, read or change the
 * declaration, stop its hosted loop, or delete itself — and the hosting page
 * (components/wallet/AgentHosting.tsx) calls exactly these with the agent's
 * key. The rest is public, read-only data.
 *
 * Note what this means: the declaration is self-service. A holder of the key
 * can widen it with hosting.configure, which also pauses the hosted loop and
 * stamps `hosting.updated_at`. The rule stops an agent drifting outside what
 * it declared; it is not a defence against a stolen key.
 */
const SCOPE_ALWAYS_ALLOWED = new Set([
  "social.profile",
  "hosting.configure", "hosting.toggle", "hosting.logs",
  "system.delete_agent",
  "system.network_info", "social.leaderboard",
]);

/**
 * The scope an agent's hosting declaration gives its API key.
 *
 * Default, chosen explicitly: an agent that never declared anything — no
 * `hosting` record, or an `allowed_actions` that is missing or empty — is
 * UNRESTRICTED. That is every agent that has not configured hosting, i.e.
 * every plain API integration, and restricting them would refuse every call
 * they make. An empty list is treated as "not declared" rather than "declared
 * nothing" because the discovery catalog told integrators to send
 * `enabled_actions`, which hosting.configure ignored, so the empty lists in
 * Firestore are not choices anyone made.
 *
 * A declared entry is either a hosted-loop name ("transfer"), a canonical
 * gateway action ("disk.write"), or a whole domain ("polymarket.*").
 *
 * @param {object|null|undefined} hosting - `agents/{id}.hosting`
 * @return {null|{declared: string[], actions: Set<string>, domains: Set<string>}}
 *   null when nothing was declared (unrestricted)
 */
function resolveDeclaredScope(hosting) {
  const list = hosting && Array.isArray(hosting.allowed_actions) ? hosting.allowed_actions : [];
  const declared = list.filter((a) => typeof a === "string" && a.length > 0);
  if (declared.length === 0) return null;

  const actions = new Set();
  const domains = new Set();
  for (const entry of declared) {
    if (entry.endsWith(".*")) {
      domains.add(entry.slice(0, -2));
      continue;
    }
    const canonical = canonicalizeAction(entry);
    // Loop-only skills have no gateway action; they grant nothing here.
    if (canonical.includes(".")) actions.add(canonical);
  }
  return { declared, actions, domains };
}

/**
 * @param {null|object} scope - from resolveDeclaredScope
 * @param {string} canonicalAction - canonical action being called
 * @return {boolean} whether the key may call it
 */
function isActionInScope(scope, canonicalAction) {
  if (!scope) return true;
  if (SCOPE_ALWAYS_ALLOWED.has(canonicalAction)) return true;
  if (scope.actions.has(canonicalAction)) return true;
  const domain = String(canonicalAction).split(".")[0];
  return scope.domains.has(domain);
}

/**
 * Validate a declaration sent to hosting.configure.
 *
 * @param {Array} requested - what the caller sent
 * @param {Iterable<string>} knownActions - canonical actions the gateway serves
 * @return {{accepted: string[], rejected: string[]}} accepted keeps the
 *   caller's spelling, so hosted-loop names stay usable by the loop
 */
function normalizeDeclaredActions(requested, knownActions) {
  const known = new Set(knownActions);
  const knownDomains = new Set([...known].map((a) => a.split(".")[0]));
  const accepted = [];
  const rejected = [];
  for (const raw of Array.isArray(requested) ? requested : []) {
    const entry = typeof raw === "string" ? raw.trim() : "";
    let ok = false;
    if (HOSTED_LOOP_ACTIONS.includes(entry)) ok = true;
    else if (entry.endsWith(".*")) ok = knownDomains.has(entry.slice(0, -2));
    else ok = known.has(canonicalizeAction(entry));
    if (ok) {
      if (!accepted.includes(entry)) accepted.push(entry);
    } else {
      rejected.push(String(raw));
    }
  }
  return { accepted, rejected };
}

/**
 * The part of a declaration the hosted LLM loop can act on. A declaration
 * may now name gateway actions the loop has no implementation for; the loop
 * must neither offer those to the model nor try to run them.
 *
 * @param {object} hosting - `agents/{id}.hosting`
 * @return {string[]} hosted-loop action names
 */
function hostedLoopActions(hosting) {
  const list = hosting && Array.isArray(hosting.allowed_actions) ? hosting.allowed_actions : [];
  return list.filter((a) => HOSTED_LOOP_ACTIONS.includes(a));
}

// ---------------------------------------------------------------------------
// R-GW-1: SBT-bound identity
// ---------------------------------------------------------------------------

const IDENTITY_TTL_MS = 5 * 60 * 1000;
const MINT_RETRY_MS = 2 * 60 * 1000;

/**
 * @param {*} value - a token id as Firestore holds it (number, string or null)
 * @return {bigint|null} the id, or null when it is absent or not a positive integer
 */
function toTokenId(value) {
  try {
    const id = BigInt(value);
    return id > 0n ? id : null;
  } catch (_) {
    return null;
  }
}

/**
 * Build the identity check every API-key call goes through.
 *
 * The chain is the authority, not Firestore. The Firestore record
 * (`sbtStatus`, `sbtTokenId`) was written by whichever code path last minted,
 * and `nft.mint` with a `mint_to` marked the CALLER completed for a token it
 * minted to someone else. So the check reads
 * `VisionAgentSBT.getAgentByAddress(wallet)` and `isRevoked(tokenId)`, and
 * keeps the answer per wallet for `ttlMs` so a busy agent costs two eth_calls
 * per instance per five minutes, not two per request.
 *
 *   - status other than "active"           refused (deleted agents also lose
 *                                           their key; this is the backstop)
 *   - Firestore or chain says revoked      refused; revocation is permanent on
 *                                           chain, so it is cached for good
 *   - wallet holds a live SBT              allowed
 *   - wallet holds no SBT                  mint it (the mint registration
 *                                           already paid for), then allowed;
 *                                           refused if the mint fails, with a
 *                                           retry hint. One attempt per agent
 *                                           per `mintRetryMs`, claimed in
 *                                           Firestore so concurrent requests
 *                                           do not mint twice.
 *   - chain unreadable                     allowed only on a known-good answer
 *                                           (this instance's cached one, or a
 *                                           completed Firestore record with a
 *                                           token id); otherwise 503. A
 *                                           revocation is itself a chain write,
 *                                           so "chain down" is not a window in
 *                                           which a new one can land.
 *
 * Revocation made outside the gateway (a direct `revokeIdentity`) takes
 * effect within `ttlMs`. `system.delete_agent` clears the key at once.
 *
 * @param {object} deps
 * @param {function(string): Promise<{tokenId: bigint, name: string, revoked: boolean}>} deps.readIdentity
 * @param {function(object): Promise<{tokenId: number, txHash: string}>} deps.mintIdentity
 * @param {function(string, number, number): Promise<{claimed: boolean, retryAfterMs: number}>} deps.claimMintAttempt
 * @param {function(string, object): Promise<void>} deps.recordIdentity - best-effort Firestore update
 * @param {function(): number} [deps.now]
 * @param {number} [deps.ttlMs]
 * @param {number} [deps.mintRetryMs]
 * @param {object} [deps.log]
 * @return {{check: function(object): Promise<object>}} the gate
 */
function createAgentIdentityGate({
  readIdentity,
  mintIdentity,
  claimMintAttempt,
  recordIdentity,
  now = Date.now,
  ttlMs = IDENTITY_TTL_MS,
  mintRetryMs = MINT_RETRY_MS,
  log = console,
}) {
  const cache = new Map(); // lowercased wallet -> { tokenId, revoked, at }

  const refuse = (status, code, error, extra = {}) => ({ ok: false, status, body: { error, code, ...extra } });
  const revokedResult = (tokenId) => refuse(403, "agent_identity_revoked",
    "This agent's identity (VisionAgentSBT) has been revoked. Its API key no longer authorizes calls.",
    { sbt_token_id: tokenId != null ? String(tokenId) : undefined });

  const remember = (wallet, entry) => cache.set(wallet, { ...entry, at: now() });

  const persist = async (agentId, fields) => {
    try {
      await recordIdentity(agentId, fields);
    } catch (e) {
      log.warn(`[Agent Identity] could not record ${JSON.stringify(fields)} for ${agentId}: ${e.message}`);
    }
  };

  async function mintMissing(agent, wallet) {
    const claim = await claimMintAttempt(agent.id, now(), mintRetryMs);
    if (!claim.claimed) {
      return refuse(403, "agent_identity_pending",
        "This agent has no identity (VisionAgentSBT) yet; one is being minted. Retry shortly.",
        { retry_after_seconds: Math.max(1, Math.ceil(claim.retryAfterMs / 1000)) });
    }
    try {
      const minted = await mintIdentity(agent);
      remember(wallet, { tokenId: BigInt(minted.tokenId), revoked: false });
      await persist(agent.id, { sbtStatus: "completed", sbtTokenId: Number(minted.tokenId), sbtTxHash: minted.txHash, sbtError: null });
      log.log(`[Agent Identity] minted missing SBT for ${agent.id}: token ${minted.tokenId}, tx ${minted.txHash}`);
      return { ok: true, tokenId: BigInt(minted.tokenId), source: "minted" };
    } catch (mintErr) {
      // A concurrent mint (another instance past its own claim, or the
      // registration path) makes ours revert with AlreadyHasSBT. Look again
      // before calling it a failure.
      try {
        const again = await readIdentity(wallet);
        if (again.tokenId > 0n && !again.revoked) {
          remember(wallet, { tokenId: again.tokenId, revoked: false });
          return { ok: true, tokenId: again.tokenId, source: "chain" };
        }
      } catch (_) {
        // fall through to the failure below
      }
      log.error(`[Agent Identity] SBT mint failed for ${agent.id}: ${mintErr.message}`);
      await persist(agent.id, { sbtStatus: "failed", sbtError: String(mintErr.message || mintErr).slice(0, 500) });
      return refuse(403, "agent_identity_missing",
        "This agent's wallet holds no identity (VisionAgentSBT), and minting one failed. Its API key does not authorize calls until it has one.",
        { retry_after_seconds: Math.ceil(mintRetryMs / 1000) });
    }
  }

  async function check(agent) {
    if (agent.status && agent.status !== "active") {
      return refuse(403, "agent_inactive", `This agent is ${agent.status}.`);
    }
    if (agent.sbtStatus === "revoked") return revokedResult(agent.sbtTokenId);
    if (!agent.walletAddress) {
      return refuse(403, "agent_identity_missing", "This agent has no wallet, so it cannot hold an identity.");
    }

    const wallet = String(agent.walletAddress).toLowerCase();
    const cached = cache.get(wallet);
    if (cached && cached.revoked) return revokedResult(cached.tokenId);
    if (cached && now() - cached.at < ttlMs) return { ok: true, tokenId: cached.tokenId, source: "cache" };

    let onChain;
    try {
      onChain = await readIdentity(agent.walletAddress);
    } catch (rpcErr) {
      if (cached) {
        log.warn(`[Agent Identity] chain unreadable for ${agent.id}, using this instance's last answer: ${rpcErr.message}`);
        return { ok: true, tokenId: cached.tokenId, source: "stale-cache" };
      }
      const recorded = agent.sbtStatus === "completed" ? toTokenId(agent.sbtTokenId) : null;
      if (recorded) {
        log.warn(`[Agent Identity] chain unreadable for ${agent.id}, using the completed Firestore record: ${rpcErr.message}`);
        return { ok: true, tokenId: recorded, source: "firestore" };
      }
      return refuse(503, "agent_identity_unverifiable",
        "Could not verify this agent's identity on chain. Nothing was executed; retry shortly.",
        { retryable: true });
    }

    if (onChain.tokenId > 0n && onChain.revoked) {
      remember(wallet, { tokenId: onChain.tokenId, revoked: true });
      await persist(agent.id, { sbtStatus: "revoked", sbtTokenId: Number(onChain.tokenId) });
      return revokedResult(onChain.tokenId);
    }
    if (onChain.tokenId > 0n) {
      remember(wallet, { tokenId: onChain.tokenId, revoked: false });
      if (agent.sbtStatus !== "completed" || String(agent.sbtTokenId) !== String(onChain.tokenId)) {
        await persist(agent.id, { sbtStatus: "completed", sbtTokenId: Number(onChain.tokenId) });
      }
      if (onChain.name && agent.agentName && onChain.name.toLowerCase() !== String(agent.agentName).toLowerCase()) {
        log.warn(`[Agent Identity] ${agent.id}'s wallet holds SBT ${onChain.tokenId} named "${onChain.name}"`);
      }
      return { ok: true, tokenId: onChain.tokenId, source: "chain" };
    }
    return mintMissing(agent, wallet);
  }

  return { check };
}

module.exports = {
  ACTION_ALIASES,
  canonicalizeAction,
  HOSTED_LOOP_ACTIONS,
  SCOPE_ALWAYS_ALLOWED,
  resolveDeclaredScope,
  isActionInScope,
  normalizeDeclaredActions,
  hostedLoopActions,
  IDENTITY_TTL_MS,
  MINT_RETRY_MS,
  createAgentIdentityGate,
};
