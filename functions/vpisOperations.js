/**
 * VPIS Operations Module - Phase 7
 *
 * Operational optimization, real-time alerting, cost tracking, and A/B eval:
 *   1. Real-Time Alerting   — monitors for P1 spikes, surges, hallucinations
 *   2. Cost Tracker         — tracks LLM usage and analysis costs
 *   3. A/B Evaluation       — compares prompt/KB versions by metrics
 *   4. Pipeline Health      — monitors daily pipeline execution
 *
 * Schedule:
 *   - Alert check: Every 2 hours
 *   - Cost summary: Daily 07:00 UTC
 *
 * Usage: Import and spread into functions/index.js
 *   const vpisOps = require("./vpisOperations");
 *   Object.assign(exports, vpisOps);
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const COLLECTIONS = {
  turns: "vpis_conversation_turns",
  evaluations: "vpis_answer_evaluations",
  items: "vpis_extracted_items",
  clusters: "vpis_issue_clusters",
  reports: "vpis_daily_reports",
  actions: "vpis_actions",
  alerts: "vpis_alerts",
  costLogs: "vpis_cost_logs",
  improvements: "vpis_improvement_logs",
  abTests: "vpis_ab_tests",
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. REAL-TIME ALERTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Alert thresholds — configurable via Firestore or env vars.
 */
const ALERT_THRESHOLDS = {
  p1_bug_spike: {
    count: 3,
    windowHours: 1,
    severity: "critical",
    message: "P1 bug reports exceeded threshold in the last hour",
  },
  feature_inquiry_surge: {
    multiplier: 10,
    severity: "warning",
    message: "Single feature inquiry count exceeds 10x daily average",
  },
  hallucination_spike: {
    errorRate: 0.2,
    windowHours: 2,
    severity: "critical",
    message: "Overclaim/hallucination rate exceeds 20% in 2 hours",
  },
  post_release_confusion: {
    scoreDropPercent: 50,
    severity: "warning",
    message: "Post-release confusion score increased over 50%",
  },
};

/**
 * Check for alert conditions and create alerts if triggered.
 */
async function checkAlerts() {
  console.log("[Alerts] Running alert check...");
  const now = new Date();
  const alerts = [];

  // ── 1. P1 Bug Spike ─────────────────────────────────────────────────
  try {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const bugSnap = await db.collection(COLLECTIONS.items)
      .where("itemType", "==", "bug_report")
      .where("createdAt", ">=", oneHourAgo)
      .get();

    const criticalBugs = bugSnap.docs.filter((d) => {
      const score = d.data().priorityScore || 0;
      return score >= 70;
    });

    if (criticalBugs.length >= ALERT_THRESHOLDS.p1_bug_spike.count) {
      alerts.push({
        alertType: "p1_bug_spike",
        severity: "critical",
        message: `${criticalBugs.length} critical bug reports in the last hour (threshold: ${ALERT_THRESHOLDS.p1_bug_spike.count})`,
        data: {
          count: criticalBugs.length,
          bugIds: criticalBugs.slice(0, 5).map((d) => d.id),
        },
        triggeredAt: now.toISOString(),
      });
    }
  } catch (err) {
    console.error("[Alerts] P1 bug check failed:", err.message);
  }

  // ── 2. Feature Inquiry Surge ────────────────────────────────────────
  try {
    // Get today's turns grouped by relatedFeature
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const turnsSnap = await db.collection(COLLECTIONS.turns)
      .where("createdAt", ">=", todayStart.toISOString())
      .limit(500)
      .get();

    const featureCounts = {};
    for (const doc_ of turnsSnap.docs) {
      const feat = doc_.data().relatedFeature;
      if (feat) featureCounts[feat] = (featureCounts[feat] || 0) + 1;
    }

    // Get 7-day average per feature
    const reportsSnap = await db.collection(COLLECTIONS.reports)
      .orderBy("reportDate", "desc")
      .limit(7)
      .get();

    const avgDailyTurns = reportsSnap.empty
      ? 50
      : reportsSnap.docs.reduce((s, d) => s + (d.data().summary?.totalTurns || 0), 0) /
        reportsSnap.size;

    const avgPerFeature = avgDailyTurns / Math.max(Object.keys(featureCounts).length, 10);

    for (const [feature, count] of Object.entries(featureCounts)) {
      if (count > avgPerFeature * ALERT_THRESHOLDS.feature_inquiry_surge.multiplier) {
        alerts.push({
          alertType: "feature_inquiry_surge",
          severity: "warning",
          message: `"${feature}" has ${count} inquiries today (avg: ${avgPerFeature.toFixed(0)}, ${ALERT_THRESHOLDS.feature_inquiry_surge.multiplier}x threshold)`,
          data: { feature, count, average: avgPerFeature },
          triggeredAt: now.toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("[Alerts] Feature surge check failed:", err.message);
  }

  // ── 3. Hallucination Spike ──────────────────────────────────────────
  try {
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const recentEvals = await db.collection(COLLECTIONS.evaluations)
      .where("createdAt", ">=", twoHoursAgo)
      .limit(200)
      .get();

    if (recentEvals.size >= 10) {
      const hallucinationTypes = [
        "nonexistent_feature_claim",
        "hallucinated_policy",
        "wrong_capability_boundary",
      ];

      let hallucinationCount = 0;
      for (const doc_ of recentEvals.docs) {
        const types = doc_.data().errorTypes || [];
        if (types.some((t) => hallucinationTypes.includes(t))) {
          hallucinationCount++;
        }
      }

      const rate = hallucinationCount / recentEvals.size;

      if (rate > ALERT_THRESHOLDS.hallucination_spike.errorRate) {
        alerts.push({
          alertType: "hallucination_spike",
          severity: "critical",
          message: `Hallucination rate ${(rate * 100).toFixed(1)}% in last 2h (${hallucinationCount}/${recentEvals.size} evals, threshold: ${(ALERT_THRESHOLDS.hallucination_spike.errorRate * 100)}%)`,
          data: { rate, hallucinationCount, totalEvals: recentEvals.size },
          triggeredAt: now.toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("[Alerts] Hallucination check failed:", err.message);
  }

  // ── 4. Post-Release Confusion ───────────────────────────────────────
  try {
    const reportsSnap = await db.collection(COLLECTIONS.reports)
      .orderBy("reportDate", "desc")
      .limit(3)
      .get();

    if (reportsSnap.size >= 3) {
      const reports = reportsSnap.docs.map((d) => d.data());
      const latest = reports[0].summary;
      const prev = reports[2].summary;

      if (prev.overallAvgScore > 0) {
        const scoreDrop =
          ((prev.overallAvgScore - latest.overallAvgScore) / prev.overallAvgScore) * 100;

        if (scoreDrop > ALERT_THRESHOLDS.post_release_confusion.scoreDropPercent) {
          alerts.push({
            alertType: "post_release_confusion",
            severity: "warning",
            message: `Quality score dropped ${scoreDrop.toFixed(1)}% (${prev.overallAvgScore.toFixed(2)} → ${latest.overallAvgScore.toFixed(2)}) — possible post-release confusion`,
            data: {
              scoreBefore: prev.overallAvgScore,
              scoreAfter: latest.overallAvgScore,
              dropPercent: scoreDrop,
            },
            triggeredAt: now.toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.error("[Alerts] Post-release check failed:", err.message);
  }

  // ── Store alerts (deduplicate by type + 6h window) ──────────────────
  for (const alert of alerts) {
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const dupCheck = await db.collection(COLLECTIONS.alerts)
      .where("alertType", "==", alert.alertType)
      .where("triggeredAt", ">=", sixHoursAgo)
      .limit(1)
      .get();

    if (dupCheck.empty) {
      await db.collection(COLLECTIONS.alerts).add({
        ...alert,
        status: "active",
        createdAt: now.toISOString(),
      });
      console.log(`[Alerts] Created: ${alert.alertType} (${alert.severity})`);
    }
  }

  console.log(`[Alerts] Check complete. ${alerts.length} new conditions detected.`);
  return { checked: 4, triggered: alerts.length, alerts };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. COST TRACKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate daily analysis cost estimate from pipeline execution data.
 * Based on Gemini 2.5 Flash pricing.
 */
async function generateCostSummary() {
  console.log("[Cost] Generating daily cost summary...");

  const today = new Date().toISOString().split("T")[0];

  // Count processed items per collection
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const startIso = todayStart.toISOString();

  const counts = {};
  const collections = [
    { name: "evaluations", col: COLLECTIONS.evaluations },
    { name: "items", col: COLLECTIONS.items },
    { name: "actions", col: COLLECTIONS.actions },
  ];

  for (const { name, col } of collections) {
    try {
      const snap = await db.collection(col)
        .where("createdAt", ">=", startIso)
        .limit(1000)
        .get();
      counts[name] = snap.size;
    } catch {
      counts[name] = 0;
    }
  }

  // Estimate costs (Gemini 2.5 Flash pricing)
  // Input: ~$0.15/1M tokens, Output: ~$0.60/1M tokens
  // Avg tokens per eval: ~2000 input, ~500 output
  // Avg tokens per extraction: ~1500 input, ~800 output
  // Avg tokens per action draft: ~2500 input, ~1000 output
  const COST_PER_EVAL = (2000 * 0.15 + 500 * 0.60) / 1_000_000;
  const COST_PER_EXTRACT = (1500 * 0.15 + 800 * 0.60) / 1_000_000;
  const COST_PER_DRAFT = (2500 * 0.15 + 1000 * 0.60) / 1_000_000;

  const costs = {
    evaluations: counts.evaluations * COST_PER_EVAL,
    extractions: counts.items * COST_PER_EXTRACT,
    drafts: counts.actions * COST_PER_DRAFT,
  };
  costs.total = costs.evaluations + costs.extractions + costs.drafts;

  const costLog = {
    date: today,
    counts,
    costs,
    totalCostUSD: costs.total,
    withinBudget: costs.total <= 5.0, // $5/day target
    createdAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.costLogs).add(costLog);

  console.log(`[Cost] Daily total: $${costs.total.toFixed(4)} (budget: ${costLog.withinBudget ? "OK" : "OVER"})`);
  return costLog;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. A/B EVALUATION FRAMEWORK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare two prompt/KB versions by analyzing tagged conversations.
 */
async function runABComparison(testId, versionA, versionB) {
  console.log(`[A/B] Comparing ${versionA} vs ${versionB}...`);

  // Get evaluations tagged with each version
  // Convention: evaluations store promptVersion in evaluatorModel or a custom field
  const getMetrics = async (version) => {
    const evalsSnap = await db.collection(COLLECTIONS.evaluations)
      .where("evaluationPromptVersion", "==", version)
      .limit(200)
      .get();

    if (evalsSnap.empty) return null;

    const evals = evalsSnap.docs.map((d) => d.data());
    const scores = evals.map((e) => e.overallScore || 0);
    const errorRates = evals.filter((e) => (e.errorTypes || []).length > 0).length / evals.length;
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Score distribution
    const buckets = { excellent: 0, good: 0, fair: 0, poor: 0 };
    for (const s of scores) {
      if (s >= 4) buckets.excellent++;
      else if (s >= 3) buckets.good++;
      else if (s >= 2) buckets.fair++;
      else buckets.poor++;
    }

    return {
      version,
      sampleSize: evals.length,
      avgScore,
      errorRate: errorRates,
      distribution: buckets,
      medianScore: scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] || 0,
    };
  };

  const metricsA = await getMetrics(versionA);
  const metricsB = await getMetrics(versionB);

  if (!metricsA || !metricsB) {
    return {
      testId,
      status: "insufficient_data",
      message: `Need evaluations tagged with both versions. A: ${metricsA?.sampleSize || 0}, B: ${metricsB?.sampleSize || 0}`,
    };
  }

  // Simple significance check (sample size based)
  const minSample = Math.min(metricsA.sampleSize, metricsB.sampleSize);
  const significant = minSample >= 30;

  const delta = {
    avgScore: metricsB.avgScore - metricsA.avgScore,
    errorRate: metricsB.errorRate - metricsA.errorRate,
  };

  const winner =
    delta.avgScore > 0.1 && delta.errorRate < 0
      ? versionB
      : delta.avgScore < -0.1 && delta.errorRate > 0
      ? versionA
      : "inconclusive";

  const abResult = {
    testId,
    versionA: metricsA,
    versionB: metricsB,
    delta,
    winner,
    significant,
    recommendation:
      winner === "inconclusive"
        ? "No clear winner. Consider extending the test period."
        : `${winner} performs better. Score delta: ${delta.avgScore >= 0 ? "+" : ""}${delta.avgScore.toFixed(2)}, Error rate delta: ${delta.errorRate >= 0 ? "+" : ""}${(delta.errorRate * 100).toFixed(1)}pp`,
    createdAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.abTests).doc(testId).set(abResult);
  console.log(`[A/B] ${testId}: Winner = ${winner}`);
  return abResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. PIPELINE HEALTH MONITOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if daily pipeline ran successfully and report health.
 */
async function checkPipelineHealth() {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Check if yesterday's report exists
  const reportSnap = await db.collection(COLLECTIONS.reports)
    .where("reportDate", "==", yesterday)
    .limit(1)
    .get();

  const hasReport = !reportSnap.empty;

  // Check recent turns (last 24h)
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const turnsSnap = await db.collection(COLLECTIONS.turns)
    .where("createdAt", ">=", dayAgo)
    .limit(1)
    .get();

  const hasRecentTurns = !turnsSnap.empty;

  // Check recent evaluations
  const evalsSnap = await db.collection(COLLECTIONS.evaluations)
    .where("createdAt", ">=", dayAgo)
    .limit(1)
    .get();

  const hasRecentEvals = !evalsSnap.empty;

  const health = {
    date: today,
    checks: {
      dailyReport: hasReport,
      ingestionRunning: hasRecentTurns,
      evaluationRunning: hasRecentEvals,
    },
    healthy: hasReport && hasRecentTurns && hasRecentEvals,
    createdAt: new Date().toISOString(),
  };

  // Create alert if unhealthy
  if (!health.healthy) {
    const failedChecks = Object.entries(health.checks)
      .filter(([_, v]) => !v)
      .map(([k]) => k);

    await db.collection(COLLECTIONS.alerts).add({
      alertType: "p1_bug_spike", // reuse alert type, could add pipeline_failure
      severity: "warning",
      message: `Pipeline health check failed: ${failedChecks.join(", ")}`,
      data: health.checks,
      status: "active",
      triggeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }

  return health;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cloud Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Alert check — runs every 2 hours.
 */
const vpisCheckAlerts = onSchedule(
  {
    schedule: "0 */2 * * *",
    timeZone: "UTC",
    memory: "512MiB",
    timeoutSeconds: 120,
    region: "us-central1",
  },
  async () => {
    await checkAlerts();
  }
);

/**
 * Daily cost summary + pipeline health — runs at 07:00 UTC.
 */
const vpisDailyOps = onSchedule(
  {
    schedule: "0 7 * * *",
    timeZone: "UTC",
    memory: "256MiB",
    timeoutSeconds: 60,
    region: "us-central1",
  },
  async () => {
    console.log("[Ops] Running daily operations check...");
    await generateCostSummary();
    await checkPipelineHealth();
  }
);

/**
 * Admin: Get active alerts.
 */
const vpisGetAlerts = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { status, limitCount } = request.data || {};

    let q = db.collection(COLLECTIONS.alerts).orderBy("triggeredAt", "desc");
    if (status) q = q.where("status", "==", status);
    q = q.limit(limitCount || 30);

    const snap = await q.get();
    return { alerts: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

/**
 * Admin: Acknowledge an alert.
 */
const vpisAcknowledgeAlert = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { alertId } = request.data;
    if (!alertId) throw new HttpsError("invalid-argument", "alertId required.");

    await db.collection(COLLECTIONS.alerts).doc(alertId).update({
      status: "acknowledged",
      acknowledgedBy: request.auth.token.email || "admin",
      acknowledgedAt: new Date().toISOString(),
    });

    return { success: true };
  }
);

/**
 * Admin: Get cost logs.
 */
const vpisGetCostLogs = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { limitCount } = request.data || {};

    const snap = await db.collection(COLLECTIONS.costLogs)
      .orderBy("createdAt", "desc")
      .limit(limitCount || 30)
      .get();

    return { logs: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

/**
 * Admin: Run A/B comparison.
 */
const vpisRunABTest = onCall(
  { memory: "512MiB", timeoutSeconds: 120, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { testId, versionA, versionB } = request.data || {};
    if (!testId || !versionA || !versionB) {
      throw new HttpsError(
        "invalid-argument",
        "testId, versionA, versionB required."
      );
    }

    const result = await runABComparison(testId, versionA, versionB);
    return { success: true, result };
  }
);

/**
 * Admin: Get operational dashboard data.
 */
const vpisGetOpsData = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    // Parallel fetch
    const [alertsSnap, costSnap, healthResult] = await Promise.all([
      db.collection(COLLECTIONS.alerts)
        .where("status", "==", "active")
        .orderBy("triggeredAt", "desc")
        .limit(10)
        .get(),
      db.collection(COLLECTIONS.costLogs)
        .orderBy("createdAt", "desc")
        .limit(7)
        .get(),
      checkPipelineHealth(),
    ]);

    return {
      activeAlerts: alertsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      costHistory: costSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      pipelineHealth: healthResult,
    };
  }
);

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  vpisCheckAlerts,
  vpisDailyOps,
  vpisGetAlerts,
  vpisAcknowledgeAlert,
  vpisGetCostLogs,
  vpisRunABTest,
  vpisGetOpsData,
};
