/* eslint-disable */
/**
 * One-shot seeder: ensure config/api_pricing.{tiers,service_tiers} contains
 * polymarket.* entries so the agentGateway fee middleware actually deducts
 * fees per the documented tier (per audit finding [BE high]:
 * "polymarket.enroll never actually charges 0.1 VCN").
 *
 * Idempotent: only fills missing keys; never overwrites operator-set values.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/application_default_credentials.json \
 *   node functions/scripts/seed_polymarket_pricing.cjs visionchain-staging
 *   node functions/scripts/seed_polymarket_pricing.cjs visionchain-d19ed
 *
 * Requires firebase-admin available under functions/node_modules (already is).
 */
const admin = require("../node_modules/firebase-admin");

const PROJECT = process.argv[2];
if (!PROJECT) {
  console.error("Usage: node seed_polymarket_pricing.cjs <projectId>");
  process.exit(2);
}

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

const POLYMARKET_TIER_MAP = {
  "polymarket.eligibility": "T1",
  "polymarket.config": "T1",
  "polymarket.enroll": "T2",
  "polymarket.update_rules": "T2",
  "polymarket.pause": "T1",
  "polymarket.resume": "T1",
};

const TIER_DEFAULTS = {
  T1: { cost_vcn: "0", description: "Read-only / free" },
  T2: { cost_vcn: "0.1", description: "Basic write" },
  T3: { cost_vcn: "0.5", description: "Complex on-chain" },
  T4: { cost_vcn: "1.0", description: "Premium multi-step" },
};

(async () => {
  const ref = db.collection("config").doc("api_pricing");
  const snap = await ref.get();
  const cur = snap.exists ? snap.data() : {};
  const tiers = cur.tiers || {};
  const serviceTiers = cur.service_tiers || {};

  let addedTiers = 0;
  for (const [id, def] of Object.entries(TIER_DEFAULTS)) {
    if (!tiers[id]) {
      tiers[id] = def;
      addedTiers++;
    }
  }

  let addedSvc = 0;
  let alreadyHad = 0;
  for (const [action, tier] of Object.entries(POLYMARKET_TIER_MAP)) {
    if (!serviceTiers[action]) {
      serviceTiers[action] = tier;
      addedSvc++;
    } else {
      alreadyHad++;
    }
  }

  if (addedTiers === 0 && addedSvc === 0) {
    console.log(`[${PROJECT}] no-op: all polymarket.* entries already present (${alreadyHad} keys verified).`);
    process.exit(0);
  }

  await ref.set({
    tiers,
    service_tiers: serviceTiers,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_by: "seed_polymarket_pricing",
  }, { merge: true });

  console.log(`[${PROJECT}] seeded: tiers_added=${addedTiers} service_tiers_added=${addedSvc} (already_present=${alreadyHad}).`);
  console.log(`[${PROJECT}] final polymarket.* tier mapping:`);
  for (const action of Object.keys(POLYMARKET_TIER_MAP)) {
    console.log(`  ${action} -> ${serviceTiers[action]} (${tiers[serviceTiers[action]] ? tiers[serviceTiers[action]].cost_vcn : "?"} VCN)`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(`[${PROJECT}] seed failed:`, e.message);
  process.exit(1);
});
