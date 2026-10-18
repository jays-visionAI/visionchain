/**
 * Tests for the Agent Gateway policy: SBT-bound keys (R-GW-1), the declared
 * action scope (R-GW-2), the alias table pricing depends on, and the catalog
 * counts the discovery document and public/openapi.json publish.
 *
 * The chain and Firestore are fakes. The alias and catalog checks read the
 * real index.js and openapi.json, so a handler that starts accepting a new
 * alias, or a catalog entry added without the OpenAPI document, fails here.
 *
 * Run: node functions/test/agentGatewayPolicy.test.cjs
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ACTION_ALIASES,
  canonicalizeAction,
  HOSTED_LOOP_ACTIONS,
  SCOPE_ALWAYS_ALLOWED,
  resolveDeclaredScope,
  isActionInScope,
  normalizeDeclaredActions,
  hostedLoopActions,
  createAgentIdentityGate,
} = require("../agentGatewayPolicy");
const { AGENT_CATALOG_DOMAINS, summarizeCatalog } = require("../agentCatalog");

const INDEX_SOURCE = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
const OPENAPI = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "public", "openapi.json"), "utf8"));
const CATALOG = summarizeCatalog(AGENT_CATALOG_DOMAINS);

const WALLET = "0x6605Acc98E5F9dE16D82885ad84a25D95C94F794";
const silent = { log() {}, warn() {}, error() {} };

/** An agent document as authenticateAgent returns it. */
function agentDoc(over = {}) {
  return {
    id: "alpha",
    agentName: "alpha",
    platform: "openai",
    walletAddress: WALLET,
    status: "active",
    sbtStatus: "completed",
    sbtTokenId: 7,
    ...over,
  };
}

/** The chain as the gate sees it: one wallet's identity, and a switch to make reads fail. */
function fakeChain({ tokenId = 7n, name = "alpha", revoked = false } = {}) {
  const chain = {
    tokenId, name, revoked,
    reads: 0,
    down: false,
    async readIdentity() {
      chain.reads++;
      if (chain.down) throw new Error("ECONNREFUSED rpc.visionchain.co");
      return { tokenId: chain.tokenId, name: chain.name, revoked: chain.revoked };
    },
  };
  return chain;
}

/** Firestore as the gate sees it: a mint claim per agent and an update log. */
function fakeStore() {
  const store = {
    claims: new Map(),
    writes: [],
    async claimMintAttempt(agentId, nowMs, retryMs) {
      const last = store.claims.get(agentId) || 0;
      if (last && nowMs - last < retryMs) return { claimed: false, retryAfterMs: retryMs - (nowMs - last) };
      store.claims.set(agentId, nowMs);
      return { claimed: true, retryAfterMs: 0 };
    },
    async recordIdentity(agentId, fields) {
      store.writes.push({ agentId, ...fields });
    },
  };
  return store;
}

function gate({ chain = fakeChain(), store = fakeStore(), mint, clock = { t: 1000000 } } = {}) {
  const mints = [];
  const g = createAgentIdentityGate({
    readIdentity: chain.readIdentity,
    mintIdentity: async (agent) => {
      mints.push(agent.id);
      if (mint) return mint(agent);
      chain.tokenId = 30n;
      return { tokenId: 30, txHash: "0xmint" };
    },
    claimMintAttempt: store.claimMintAttempt,
    recordIdentity: store.recordIdentity,
    now: () => clock.t,
    ttlMs: 1000,
    mintRetryMs: 5000,
    log: silent,
  });
  return { g, chain, store, mints, clock };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

test("every alias a handler accepts canonicalises to the name it is served as", () => {
  const pairs = [];
  // `action === "a" || action === "b"`, in either order, plus the four-way
  // conditional transfer line.
  const re = /action === "([a-z_.]+)" \|\|\s*action === "([a-z_.]+)"/g;
  let m;
  while ((m = re.exec(INDEX_SOURCE)) !== null) pairs.push([m[1], m[2]]);
  assert.ok(pairs.length >= 40, `expected the gateway's alias lines, found ${pairs.length}`);
  const missing = [];
  for (const [a, b] of pairs) {
    const [legacy, canonical] = a.includes(".") && !b.includes(".") ? [b, a] : [a, b];
    if (!legacy.includes(".") && canonical.includes(".")) {
      if (canonicalizeAction(legacy) !== canonicalizeAction(canonical)) missing.push(`${legacy} -> ${canonical}`);
    }
  }
  assert.deepEqual(missing, [], `aliases priced as unknown (free, no node gate): ${missing.join(", ")}`);
});

test("transfer.scheduled is priced and scoped as transfer.conditional, as the catalog documents", () => {
  for (const name of ["transfer.scheduled", "scheduled_transfer", "conditional_transfer"]) {
    assert.equal(canonicalizeAction(name), "transfer.conditional");
  }
});

test("canonicalizeAction does not resolve Object.prototype keys", () => {
  assert.equal(canonicalizeAction("constructor"), "constructor");
  assert.equal(canonicalizeAction("__proto__"), "__proto__");
  assert.equal(canonicalizeAction(undefined), "");
});

test("the request handler no longer keeps its own short alias table", () => {
  assert.ok(!/const ACTION_CANONICAL = \{/.test(INDEX_SOURCE));
  assert.ok(/const canonicalAction = canonicalizeAction\(action\);/.test(INDEX_SOURCE));
});

// ---------------------------------------------------------------------------
// R-GW-2: declared scope
// ---------------------------------------------------------------------------

test("an agent that never configured hosting is unrestricted", () => {
  assert.equal(resolveDeclaredScope(undefined), null);
  assert.equal(resolveDeclaredScope({ enabled: true, llm_model: "deepseek-chat" }), null);
  assert.ok(isActionInScope(null, "transfer.batch"));
  assert.ok(isActionInScope(null, "bridge.initiate"));
});

test("an empty declaration counts as undeclared, not as 'nothing allowed'", () => {
  assert.equal(resolveDeclaredScope({ allowed_actions: [] }), null);
  assert.equal(resolveDeclaredScope({ allowed_actions: ["", null] }), null);
});

test("a declared agent may call what it declared and nothing else", () => {
  const scope = resolveDeclaredScope({ allowed_actions: ["balance"] });
  assert.ok(isActionInScope(scope, "wallet.balance"));
  assert.ok(!isActionInScope(scope, "transfer.send"));
  assert.ok(!isActionInScope(scope, canonicalizeAction("transfer")), "the legacy alias is held to the same scope");
  assert.ok(!isActionInScope(scope, "polymarket.simulate"));
  assert.ok(!isActionInScope(scope, "nonexistent.action"));
});

test("declaring transfer grants transfer.send, not every transfer action", () => {
  const scope = resolveDeclaredScope({ allowed_actions: ["transfer"] });
  assert.ok(isActionInScope(scope, "transfer.send"));
  assert.ok(!isActionInScope(scope, "transfer.batch"));
  assert.ok(!isActionInScope(scope, "transfer.conditional"));
});

test("gateway names and domain wildcards can be declared", () => {
  const scope = resolveDeclaredScope({ allowed_actions: ["content_create", "disk.write", "polymarket.*"] });
  assert.ok(isActionInScope(scope, "disk.write"));
  assert.ok(!isActionInScope(scope, "disk.delete"));
  assert.ok(isActionInScope(scope, "polymarket.simulate"));
  assert.ok(isActionInScope(scope, "polymarket.enroll"));
  assert.ok(!isActionInScope(scope, "staking.deposit"));
});

test("a loop-only skill grants no gateway action", () => {
  const scope = resolveDeclaredScope({ allowed_actions: ["content_create"] });
  assert.ok(scope, "it is still a declaration");
  assert.ok(!isActionInScope(scope, "wallet.balance"));
});

test("identity and hosting management stay callable under any declaration", () => {
  const scope = resolveDeclaredScope({ allowed_actions: ["content_create"] });
  // What components/wallet/AgentHosting.tsx calls with the agent's key.
  for (const action of ["profile", "configure_hosting", "toggle_hosting", "delete_agent", "hosting_logs"]) {
    assert.ok(isActionInScope(scope, canonicalizeAction(action)), action);
  }
  for (const action of SCOPE_ALWAYS_ALLOWED) assert.ok(isActionInScope(scope, action), action);
});

test("hosting.configure accepts loop names, gateway names, aliases and known wildcards", () => {
  const known = [...CATALOG.actions, "transfer.sepolia"];
  const { accepted, rejected } = normalizeDeclaredActions(
    ["balance", "disk.write", "nft_mint", "polymarket.*", "balance", "foo", "foo.*", "wallet.nope", 42],
    known,
  );
  assert.deepEqual(accepted, ["balance", "disk.write", "nft_mint", "polymarket.*"]);
  assert.deepEqual(rejected, ["foo", "foo.*", "wallet.nope", "42"]);
});

test("every name the hosting UI offers is accepted", () => {
  const { rejected } = normalizeDeclaredActions([...HOSTED_LOOP_ACTIONS], CATALOG.actions);
  assert.deepEqual(rejected, []);
});

test("the hosted loop is offered only what it can execute", () => {
  assert.deepEqual(
    hostedLoopActions({ allowed_actions: ["balance", "disk.write", "polymarket.*", "transfer", "community_engage"] }),
    ["balance", "transfer", "community_engage"],
  );
  assert.deepEqual(hostedLoopActions(undefined), []);
});

// ---------------------------------------------------------------------------
// R-GW-1: identity gate
// ---------------------------------------------------------------------------

test("a live agent whose wallet holds an SBT is allowed, and the answer is cached", async () => {
  const { g, chain } = gate();
  const first = await g.check(agentDoc());
  assert.equal(first.ok, true);
  assert.equal(first.tokenId, 7n);
  const second = await g.check(agentDoc());
  assert.equal(second.ok, true);
  assert.equal(second.source, "cache");
  assert.equal(chain.reads, 1, "one chain read per TTL, not per request");
});

test("the cache expires, so a revocation made on chain is seen within the TTL", async () => {
  const { g, chain, store, clock } = gate();
  assert.equal((await g.check(agentDoc())).ok, true);
  chain.revoked = true;
  clock.t += 500;
  assert.equal((await g.check(agentDoc())).ok, true, "still inside the TTL");
  clock.t += 600;
  const after = await g.check(agentDoc());
  assert.equal(after.ok, false);
  assert.equal(after.status, 403);
  assert.equal(after.body.code, "agent_identity_revoked");
  assert.ok(store.writes.some((w) => w.sbtStatus === "revoked"), "revocation recorded in Firestore");
});

test("a revocation is permanent: refused afterwards without reading the chain", async () => {
  const { g, chain, clock } = gate({ chain: fakeChain({ revoked: true }) });
  assert.equal((await g.check(agentDoc())).ok, false);
  const reads = chain.reads;
  chain.down = true;
  clock.t += 10000;
  const again = await g.check(agentDoc());
  assert.equal(again.ok, false);
  assert.equal(again.body.code, "agent_identity_revoked");
  assert.equal(chain.reads, reads);
});

test("a Firestore revocation is refused without a chain read", async () => {
  const { g, chain } = gate();
  const r = await g.check(agentDoc({ sbtStatus: "revoked" }));
  assert.equal(r.ok, false);
  assert.equal(r.body.code, "agent_identity_revoked");
  assert.equal(chain.reads, 0);
});

test("an agent that is not active is refused", async () => {
  const { g } = gate();
  const r = await g.check(agentDoc({ status: "deleted" }));
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "agent_inactive");
});

test("legacy agents without a status field are not refused for it", async () => {
  const { g } = gate();
  assert.equal((await g.check(agentDoc({ status: undefined }))).ok, true);
});

test("an agent whose mint failed gets its SBT minted, then is allowed", async () => {
  const { g, mints, store } = gate({ chain: fakeChain({ tokenId: 0n }) });
  const r = await g.check(agentDoc({ sbtStatus: "failed", sbtTokenId: null }));
  assert.equal(r.ok, true);
  assert.equal(r.source, "minted");
  assert.deepEqual(mints, ["alpha"]);
  assert.ok(store.writes.some((w) => w.sbtStatus === "completed" && w.sbtTokenId === 30));
});

test("a key is refused while another request holds the mint claim", async () => {
  const store = fakeStore();
  store.claims.set("alpha", 1000000 - 1000);
  const { g, mints } = gate({ chain: fakeChain({ tokenId: 0n }), store });
  const r = await g.check(agentDoc({ sbtStatus: "pending", sbtTokenId: null }));
  assert.equal(r.ok, false);
  assert.equal(r.body.code, "agent_identity_pending");
  assert.equal(r.body.retry_after_seconds, 4);
  assert.deepEqual(mints, [], "no second mint");
});

test("a failed mint refuses the key and is recorded", async () => {
  const { g, store } = gate({
    chain: fakeChain({ tokenId: 0n }),
    mint: async () => {
      throw new Error("nonce too low");
    },
  });
  const r = await g.check(agentDoc({ sbtStatus: "pending", sbtTokenId: null }));
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "agent_identity_missing");
  assert.ok(store.writes.some((w) => w.sbtStatus === "failed" && /nonce too low/.test(w.sbtError)));
});

test("a mint that lost a race to another mint is not a failure", async () => {
  const chain = fakeChain({ tokenId: 0n });
  const { g } = gate({
    chain,
    mint: async () => {
      chain.tokenId = 31n; // the other mint landed
      throw new Error("execution reverted: AlreadyHasSBT()");
    },
  });
  const r = await g.check(agentDoc({ sbtStatus: "pending", sbtTokenId: null }));
  assert.equal(r.ok, true);
  assert.equal(r.tokenId, 31n);
});

test("a pending Firestore record is corrected when the chain shows the token", async () => {
  const { g, mints, store } = gate();
  const r = await g.check(agentDoc({ sbtStatus: "pending", sbtTokenId: null }));
  assert.equal(r.ok, true);
  assert.deepEqual(mints, []);
  assert.ok(store.writes.some((w) => w.sbtStatus === "completed" && w.sbtTokenId === 7));
});

test("chain down, no cache: a completed Firestore record is trusted", async () => {
  const chain = fakeChain();
  chain.down = true;
  const { g } = gate({ chain });
  const r = await g.check(agentDoc());
  assert.equal(r.ok, true);
  assert.equal(r.source, "firestore");
});

test("chain down, no cache, no completed record: refused as unverifiable (503)", async () => {
  const chain = fakeChain();
  chain.down = true;
  const { g, mints } = gate({ chain });
  for (const over of [{ sbtStatus: "pending", sbtTokenId: null }, { sbtStatus: "completed", sbtTokenId: null }, { sbtStatus: "failed" }]) {
    const r = await g.check(agentDoc(over));
    assert.equal(r.ok, false, JSON.stringify(over));
    assert.equal(r.status, 503);
    assert.equal(r.body.code, "agent_identity_unverifiable");
  }
  assert.deepEqual(mints, [], "never mints on an unread chain");
});

test("chain down after a good answer: the stale answer is used", async () => {
  const { g, chain, clock } = gate();
  assert.equal((await g.check(agentDoc({ sbtStatus: "pending", sbtTokenId: null }))).ok, true);
  chain.down = true;
  clock.t += 10000;
  const r = await g.check(agentDoc({ sbtStatus: "pending", sbtTokenId: null }));
  assert.equal(r.ok, true);
  assert.equal(r.source, "stale-cache");
});

test("an agent with no wallet is refused", async () => {
  const { g } = gate();
  const r = await g.check(agentDoc({ walletAddress: "" }));
  assert.equal(r.ok, false);
  assert.equal(r.body.code, "agent_identity_missing");
});

test("the gateway checks identity on the API-key path before anything else runs", () => {
  const authAt = INDEX_SOURCE.indexOf("agent = await authenticateAgent(apiKeyParam);");
  const gateAt = INDEX_SOURCE.indexOf("await agentIdentityGate.check(agent)");
  const feeAt = INDEX_SOURCE.indexOf("const feeRes = await _runFeeDeduction();");
  assert.ok(authAt > 0 && gateAt > authAt && feeAt > gateAt);
});

test("registration mints the SBT before it responds with the key", () => {
  const regAt = INDEX_SOURCE.indexOf("// --- REGISTER (system.register) ---");
  const mintAt = INDEX_SOURCE.indexOf("await mintAgentSbt(wallet.address", regAt);
  const respondAt = INDEX_SOURCE.indexOf("res.status(201).json(", regAt);
  assert.ok(regAt > 0 && mintAt > regAt && respondAt > mintAt);
});

// ---------------------------------------------------------------------------
// Catalog and OpenAPI
// ---------------------------------------------------------------------------

test("the catalog has no duplicate actions and every action sits in its own domain", () => {
  assert.equal(new Set(CATALOG.actions).size, CATALOG.actions.length);
  for (const [domain, def] of Object.entries(AGENT_CATALOG_DOMAINS)) {
    for (const entry of def.actions) assert.equal(entry.action.split(".")[0], domain, entry.action);
  }
});

test("the discovery description is derived from the catalog, not written by hand", () => {
  assert.ok(!/\d+ actions across \d+ domains\."/.test(INDEX_SOURCE), "no hard-coded count in index.js");
  assert.ok(INDEX_SOURCE.includes("${catalogSummary.totalActions} actions across ${catalogSummary.totalDomains} domains"));
});

test("openapi.json documents every catalog action, and its counts match", () => {
  const documented = Object.keys(OPENAPI["x-actions"]);
  const missing = CATALOG.actions.filter((a) => !documented.includes(a));
  assert.deepEqual(missing, [], "catalog actions missing from public/openapi.json");
  const extra = documented.filter((a) => !CATALOG.actions.includes(a));
  for (const a of extra) {
    assert.ok(CATALOG.actions.includes(canonicalizeAction(a)), `${a} is in openapi.json but not served by the catalog`);
  }
  const counts = `${CATALOG.totalActions} actions across ${CATALOG.totalDomains} domains`;
  assert.ok(OPENAPI.info.description.includes(counts), OPENAPI.info.description);
  const text = JSON.stringify(OPENAPI);
  assert.ok(!/\b59 actions\b/.test(text) && !/\b15 domains\b/.test(text), "stale counts left in openapi.json");
});

test("hosting.configure documents the parameter the handler reads", () => {
  const entry = AGENT_CATALOG_DOMAINS.hosting.actions.find((a) => a.action === "hosting.configure");
  assert.ok("allowed_actions" in entry.params);
  assert.ok("llm_model" in entry.params);
  const props = OPENAPI["x-actions"]["hosting.configure"].request.properties;
  assert.ok("allowed_actions" in props && "llm_model" in props);
});

test("ACTION_ALIASES only maps to names the gateway serves", () => {
  const served = new Set([...CATALOG.actions, "transfer.sepolia", "bridge.reverse", "bridge.reverse_prepare"]);
  for (const [alias, canonical] of Object.entries(ACTION_ALIASES)) {
    assert.ok(served.has(canonical), `${alias} -> ${canonical}`);
  }
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok   ${name}`);
    } catch (err) {
      failed++;
      console.log(`  FAIL ${name}\n       ${err.message.split("\n").join("\n       ")}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} agent gateway policy checks passed`);
  process.exit(failed ? 1 : 0);
})();
