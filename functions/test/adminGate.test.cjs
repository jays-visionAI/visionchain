/**
 * Tests for the admin gate.
 *
 * Admin used to be a field on the caller's own users document, which the
 * caller could write. The cases that matter are therefore the ones where a
 * caller holds everything that USED to make them an admin — `role: "admin"`,
 * `isAdmin: true`, an `admins` document — and is still refused, and the one
 * real admin (the custom claim) who is let through.
 *
 * Firebase is faked; no node_modules are needed.
 *
 * Run: node functions/test/adminGate.test.cjs
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { isAdminToken, createAdminGate } = require("../adminGate");

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Decoded tokens keyed by the raw ID token string a client would send. */
const TOKENS = {
  "admin-token": { uid: "a1", email: "jays@visai.io", admin: true },
  "role-token": { uid: "u1", email: "u1@example.com", role: "admin", isAdmin: true },
  "plain-token": { uid: "u2", email: "u2@example.com" },
};
const gate = createAdminGate({
  HttpsError,
  verifyIdToken: async (t) => {
    if (!TOKENS[t]) throw new Error("auth/argument-error");
    return TOKENS[t];
  },
});

/** A minimal Express-style response that records what was sent. */
function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// --- isAdminToken ---
test("the admin claim is an admin", () => assert.equal(isAdminToken({ admin: true }), true));
test("no token is not an admin", () => assert.equal(isAdminToken(undefined), false));
test("an empty token is not an admin", () => assert.equal(isAdminToken({}), false));
test("role: admin in a token is not an admin", () => assert.equal(isAdminToken({ role: "admin" }), false));
test("isAdmin: true in a token is not an admin", () => assert.equal(isAdminToken({ isAdmin: true }), false));
test("admin: 'true' (a string) is not an admin", () => assert.equal(isAdminToken({ admin: "true" }), false));
test("admin: 1 is not an admin", () => assert.equal(isAdminToken({ admin: 1 }), false));

// --- assertAdminCaller (callables) ---
const rejects = async (p, code) => {
  await assert.rejects(p, (e) => e instanceof HttpsError && e.code === code);
};
test("callable: no auth is unauthenticated", () => rejects(gate.assertAdminCaller({}), "unauthenticated"));
test("callable: a signed-in user is refused", () =>
  rejects(gate.assertAdminCaller({ auth: { uid: "u2", token: TOKENS["plain-token"] } }), "permission-denied"));
test("callable: a user whose token says role/isAdmin is refused", () =>
  rejects(gate.assertAdminCaller({ auth: { uid: "u1", token: TOKENS["role-token"] } }), "permission-denied"));
test("callable: the claim without an email is refused", () =>
  rejects(gate.assertAdminCaller({ auth: { uid: "a1", token: { admin: true } } }), "permission-denied"));
test("callable: the admin claim passes and returns the lowercased email", async () => {
  const email = await gate.assertAdminCaller({ auth: { uid: "a1", token: { email: "Jays@Visai.io", admin: true } } });
  assert.equal(email, "jays@visai.io");
});

// --- verifyAdminRequest (onRequest) ---
const http = async (authorization) => {
  const res = fakeRes();
  const out = await gate.verifyAdminRequest({ headers: authorization === undefined ? {} : { authorization } }, res);
  return { out, res };
};
test("http: no Authorization header is 401", async () => {
  const { out, res } = await http(undefined);
  assert.equal(out, null);
  assert.equal(res.statusCode, 401);
});
test("http: a non-Bearer header is 401", async () => {
  const { out, res } = await http("Basic admin-token");
  assert.equal(out, null);
  assert.equal(res.statusCode, 401);
});
test("http: an unverifiable token is 401", async () => {
  const { out, res } = await http("Bearer forged");
  assert.equal(out, null);
  assert.equal(res.statusCode, 401);
});
test("http: a signed-in user is 403", async () => {
  const { out, res } = await http("Bearer plain-token");
  assert.equal(out, null);
  assert.equal(res.statusCode, 403);
});
test("http: a user whose token says role/isAdmin is 403", async () => {
  const { out, res } = await http("Bearer role-token");
  assert.equal(out, null);
  assert.equal(res.statusCode, 403);
});
test("http: the admin claim passes, and nothing is sent", async () => {
  const { out, res } = await http("Bearer admin-token");
  assert.equal(out.uid, "a1");
  assert.equal(res.statusCode, null);
});

// --- nothing in index.js still asks Firestore who is an admin ---
test("index.js has no Firestore-based admin check left", () => {
  const src = readFileSync(join(__dirname, "..", "index.js"), "utf8")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l)) // ignore comments
    .join("\n");
  const banned = [
    /\.role\s*[!=]==?\s*["']admin["']/,
    /\.isAdmin\s*[!=]==?\s*true/,
    /collection\(\s*["']admins["']\s*\)/,
  ];
  for (const re of banned) assert.equal(re.test(src), false, `index.js still matches ${re}`);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of cases) {
    try {
      await fn();
      console.log(`  ok   ${name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${name}\n       ${e.message}`);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} admin gate checks passed`);
  process.exit(failed ? 1 : 0);
})();
