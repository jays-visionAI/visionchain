/* eslint-disable */
/**
 * Grant or revoke the `admin` custom claim — the only thing the server now
 * accepts as admin (isAdminToken in functions/index.js).
 *
 * Admin used to be `role: "admin"` on the caller's own users document, which
 * that caller could write. So run this BEFORE deploying the functions that
 * check the claim, or every admin is locked out of the admin callables until
 * it is run.
 *
 * Usage (from the repo root, with Application Default Credentials for the
 * project, e.g. `gcloud auth application-default login`):
 *
 *   node functions/scripts/grant-admin-claims.cjs visionchain-d19ed
 *       Lists everyone the old checks treated as an admin and changes
 *       nothing. Prints the --grant command to run next.
 *
 *   node functions/scripts/grant-admin-claims.cjs visionchain-d19ed --grant a@x.com,b@y.com
 *       Sets `admin: true` on exactly those accounts (other claims are kept)
 *       and mirrors `role: "admin"` onto their users document for display.
 *
 *   node functions/scripts/grant-admin-claims.cjs visionchain-d19ed --revoke a@x.com
 *       Removes the claim, resets `role: "admin"` to "user" on their users
 *       document, and revokes their refresh tokens (signs them out).
 *
 * READ THE LIST BEFORE GRANTING. Until the rules fix is deployed any
 * signed-in user can write `role: "admin"` on their own document or create an
 * `admins/{id}` document, so a candidate below may be someone who promoted
 * themselves. Grant only the accounts you recognise.
 *
 * A granted admin sees the claim after their ID token refreshes: sign out and
 * back in (the admin console and the wallet are separate sessions), or wait
 * up to an hour. A revoked one keeps an already-issued ID token until it
 * expires, up to an hour.
 *
 * Requires firebase-admin under functions/node_modules (already there).
 */
const admin = require("../node_modules/firebase-admin");

const [PROJECT, MODE, LIST] = process.argv.slice(2);
const USAGE = "Usage: node grant-admin-claims.cjs <projectId> [--grant|--revoke email,email,...]";
if (!PROJECT || PROJECT.startsWith("--") || (MODE && !["--grant", "--revoke"].includes(MODE)) || (MODE && !LIST)) {
  console.error(USAGE);
  process.exit(2);
}

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const auth = admin.auth();

const parseEmails = (s) => [...new Set(s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))];

/** @return {Promise<import('firebase-admin').auth.UserRecord|null>} */
async function lookup(idOrEmail) {
  try {
    return idOrEmail.includes("@") ? await auth.getUserByEmail(idOrEmail) : await auth.getUser(idOrEmail);
  } catch (e) {
    if (e.code === "auth/user-not-found") return null;
    throw e;
  }
}

/**
 * Everyone an old admin check would have accepted, keyed by lowercased email
 * (or by uid when an `admins` document names a uid with no Auth user).
 */
async function candidates() {
  const found = new Map();
  const add = (key, source) => {
    const k = key.toLowerCase();
    if (!found.has(k)) found.set(k, new Set());
    found.get(k).add(source);
  };

  const byRole = await db.collection("users").where("role", "==", "admin").get();
  byRole.forEach((d) => add(d.id, "users.role=admin"));
  const byFlag = await db.collection("users").where("isAdmin", "==", true).get();
  byFlag.forEach((d) => add(d.id, "users.isAdmin=true"));
  const admins = await db.collection("admins").get();
  for (const d of admins.docs) {
    if (d.id.includes("@")) {
      add(d.id, "admins/{email}");
    } else {
      const u = await lookup(d.id);
      add(u?.email || d.id, "admins/{uid}");
    }
  }

  // Accounts that already carry the claim (e.g. from an earlier run).
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      if (u.customClaims?.admin === true) add(u.email || u.uid, "claim already set");
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return found;
}

async function list() {
  const found = await candidates();
  if (found.size === 0) {
    console.log("No admin candidates found. Grant explicitly with --grant <email>.");
    return;
  }
  console.log(`Admin candidates in ${PROJECT} (nothing has been changed):\n`);
  const grantable = [];
  for (const [key, sources] of [...found].sort()) {
    const u = await lookup(key);
    const claim = u?.customClaims?.admin === true;
    console.log(`  ${key}`);
    console.log(`      sources:     ${[...sources].join(", ")}`);
    if (!u) {
      console.log("      auth user:   NONE — nothing to grant");
      continue;
    }
    console.log(`      uid:         ${u.uid}`);
    console.log(`      verified:    ${u.emailVerified}   providers: ${u.providerData.map((p) => p.providerId).join(", ") || "(none)"}`);
    console.log(`      created:     ${u.metadata.creationTime}   last sign-in: ${u.metadata.lastSignInTime || "never"}`);
    console.log(`      admin claim: ${claim ? "YES" : "no"}${u.disabled ? "   (account DISABLED)" : ""}`);
    if (!claim && u.email) grantable.push(u.email.toLowerCase());
  }
  console.log("\nAny of these may have promoted themselves while the users document was self-writable.");
  if (grantable.length) {
    console.log("Remove anyone you do not recognise from this command, then run it:\n");
    console.log(`  node functions/scripts/grant-admin-claims.cjs ${PROJECT} --grant ${grantable.join(",")}`);
  }
  console.log("\nAnyone left with role=admin but no claim has no admin power after the deploy; clear the stale role with --revoke <email>.");
}

async function grant(emails) {
  const known = await candidates();
  for (const email of emails) {
    const u = await lookup(email);
    if (!u) {
      console.log(`  SKIP ${email}: no Auth user with that email`);
      continue;
    }
    if (!known.has(email)) console.log(`  note ${email}: not an existing admin candidate — granting because you named it`);
    await auth.setCustomUserClaims(u.uid, { ...(u.customClaims || {}), admin: true });
    const ref = db.collection("users").doc(email);
    if ((await ref.get()).exists) await ref.update({ role: "admin" });
    console.log(`  GRANTED ${email} (uid ${u.uid})`);
  }
  console.log("\nEach granted admin must sign out and back in (admin console and wallet) to pick up the claim.");
}

async function revoke(emails) {
  for (const email of emails) {
    const u = await lookup(email);
    if (u) {
      const { admin: _dropped, ...rest } = u.customClaims || {};
      await auth.setCustomUserClaims(u.uid, rest);
      await auth.revokeRefreshTokens(u.uid);
    }
    const ref = db.collection("users").doc(email);
    const snap = await ref.get();
    if (snap.exists && (snap.data().role === "admin" || snap.data().isAdmin === true)) {
      await ref.update({ role: "user", isAdmin: admin.firestore.FieldValue.delete() });
    }
    console.log(`  REVOKED ${email}${u ? ` (uid ${u.uid}, signed out)` : " (no Auth user; users document only)"}`);
  }
  console.log("\nAn ID token already issued keeps working until it expires (up to an hour).");
}

(async () => {
  if (!MODE) await list();
  else if (MODE === "--grant") await grant(parseEmails(LIST));
  else await revoke(parseEmails(LIST));
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
