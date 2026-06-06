/* eslint-disable */
/**
 * Kill-switch drill helper. Flips system_config/predict.enabled to a target value
 * for a given Firebase project. Idempotent. Use with the SOP in
 * docs/predict/PRE_LAUNCH_REVIEW_PACK.md Appendix C.
 *
 * Usage:
 *   node functions/scripts/kill_switch_drill.cjs visionchain-staging false
 *   node functions/scripts/kill_switch_drill.cjs visionchain-staging true
 */
const admin = require("../node_modules/firebase-admin");

const PROJECT = process.argv[2];
const ENABLED_RAW = process.argv[3];
if (!PROJECT || (ENABLED_RAW !== "true" && ENABLED_RAW !== "false")) {
  console.error("Usage: node kill_switch_drill.cjs <projectId> <true|false>");
  process.exit(2);
}
const enabled = ENABLED_RAW === "true";

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

(async () => {
  const ref = db.collection("system_config").doc("predict");
  const before = await ref.get();
  const prev = before.exists ? before.data() : null;
  await ref.set({
    enabled,
    last_toggled_at: admin.firestore.FieldValue.serverTimestamp(),
    last_toggled_by: "kill_switch_drill.cjs",
    drill_marker: true,
  }, { merge: true });
  console.log(`[${PROJECT}] system_config/predict.enabled = ${enabled} (prev: ${prev && prev.enabled})`);
  process.exit(0);
})().catch((e) => {
  console.error(`[${PROJECT}] failed:`, e.message);
  process.exit(1);
});
