/**
 * Admin gate.
 *
 * Admin is the `admin: true` custom claim on the caller's Firebase ID token.
 * Only the Admin SDK can set it (scripts/grant-admin-claims.cjs), so a client
 * cannot grant it to itself. Every admin check on the server goes through
 * this module.
 *
 * P0 SECURITY: admin used to be `role === "admin"` (or `isAdmin === true`) on
 * the caller's own users document, or the mere existence of an `admins/{id}`
 * document. firestore.rules let a signed-in user write any field of their own
 * users document, and its catch-all let them write `admins` and everyone
 * else's users documents too, so any account could make itself an admin and
 * call every admin endpoint — adminFundPool, which spends the executor
 * wallet, and nodeHealth, which sends admin_addPeer to the validators,
 * included.
 *
 * It lives in its own file so it can be tested without loading index.js
 * (which initialises Firebase and registers every function on require). See
 * test/adminGate.test.cjs.
 */

/**
 * Whether a Firebase-verified ID token belongs to an admin.
 *
 * @param {object|undefined} token a verified ID token (request.auth.token in
 *   a callable, or the result of admin.auth().verifyIdToken)
 * @return {boolean} true only for the admin claim
 */
function isAdminToken(token) {
  return token?.admin === true;
}

/**
 * @param {object} deps
 * @param {Function} deps.HttpsError firebase-functions' HttpsError
 * @param {function(string): Promise<object>} deps.verifyIdToken verifies a
 *   Firebase ID token and resolves to its decoded claims
 * @return {{isAdminToken: Function, assertAdminCaller: Function, verifyAdminRequest: Function}}
 */
function createAdminGate({ HttpsError, verifyIdToken }) {
  /**
   * Admin gate for callables: a Firebase-verified ID token carrying the admin
   * claim.
   *
   * @param {object} request the callable request
   * @return {Promise<string>} the caller's lowercased email
   */
  async function assertAdminCaller(request) {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
    const email = request.auth.token?.email?.toLowerCase();
    if (!email || !isAdminToken(request.auth.token)) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }
    return email;
  }

  /**
   * Admin gate for onRequest endpoints: `Authorization: Bearer <ID token>`
   * carrying the admin claim. Sends the 401/403 itself.
   *
   * @param {object} req the HTTP request
   * @param {object} res the HTTP response
   * @return {Promise<object|null>} the decoded token, or null once it has
   *   responded
   */
  async function verifyAdminRequest(req, res) {
    const header = req.headers?.authorization || "";
    const idToken = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!idToken) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return null;
    }
    if (!isAdminToken(decoded)) {
      res.status(403).json({ error: "Admin access required" });
      return null;
    }
    return decoded;
  }

  return { isAdminToken, assertAdminCaller, verifyAdminRequest };
}

module.exports = { isAdminToken, createAdminGate };
