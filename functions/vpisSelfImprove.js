/**
 * VPIS Self-Improvement Loops Module - Phase 6
 *
 * Automated systems that continuously improve chatbot and product quality:
 *   1. Knowledge Drift Detector  — catalog vs prompt/KB mismatch detection
 *   2. FAQ Auto-Generation       — cluster-driven FAQ drafts
 *   3. Prompt Improvement Engine  — recurring error → prompt patch
 *   4. Release Impact Tracker     — pre/post feature release metrics
 *
 * Schedule: Weekly (Sunday 06:00 UTC) for drift + FAQ + prompt
 *           On-demand for release impact
 *
 * Usage: Import and spread into functions/index.js
 *   const vpisSelfImprove = require("./vpisSelfImprove");
 *   Object.assign(exports, vpisSelfImprove);
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
  actions: "vpis_actions",
  reports: "vpis_daily_reports",
  catalog: "vpis_feature_catalog",
  improvements: "vpis_improvement_logs",
};

// ── LLM Helper ─────────────────────────────────────────────────────────────

let _genAI = null;

function getGenAI() {
  if (!_genAI) {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) throw new Error("[VPIS] GEMINI_API_KEY not configured");
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

async function callLLMForJSON(systemPrompt, userPrompt) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1].trim());
    console.error("[VPIS-Improve] Parse error:", text.substring(0, 200));
    throw new Error("LLM returned non-JSON");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. KNOWLEDGE DRIFT DETECTOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare latest feature catalog against what the chatbot "knows".
 * Detects:
 *   - Live features NOT in system prompt / KB
 *   - Deprecated features STILL in system prompt
 *   - UI path changes not reflected
 *   - New permissions not documented
 */
async function detectKnowledgeDrift() {
  console.log("[Drift] Starting knowledge drift detection...");

  // Get latest catalog snapshot
  const catalogSnap = await db.collection(COLLECTIONS.catalog)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (catalogSnap.empty) {
    console.log("[Drift] No catalog found, skipping.");
    return { drifts: [], skipped: true };
  }

  const catalog = catalogSnap.docs[0].data();

  // Get recent evaluations flagged with knowledge issues
  const evalSnap = await db.collection(COLLECTIONS.evaluations)
    .where("errorTypes", "array-contains-any", [
      "nonexistent_feature_claim",
      "outdated_ui_reference",
      "hallucinated_policy",
      "wrong_capability_boundary",
    ])
    .limit(100)
    .get();

  const knowledgeErrors = evalSnap.docs.map((d) => d.data());

  // Group errors by type and feature
  const errorsByFeature = {};
  for (const e of knowledgeErrors) {
    const key = e.detectedIntent || "unknown";
    if (!errorsByFeature[key]) errorsByFeature[key] = [];
    errorsByFeature[key].push({
      errorTypes: e.errorTypes,
      overallScore: e.overallScore,
    });
  }

  // Ask LLM to detect drift patterns
  const systemPrompt = `You are a knowledge management analyst for VisionChain, a blockchain/DeFi platform.
Analyze the feature catalog against recent chatbot errors to detect knowledge drift.

OUTPUT FORMAT (JSON):
{
  "drifts": [
    {
      "driftType": "missing_feature|deprecated_still_active|ui_path_changed|policy_outdated|permission_mismatch",
      "severity": "critical|high|medium|low",
      "featureName": "string",
      "description": "what is mismatched",
      "suggestedFix": "specific action to correct",
      "affectedErrorCount": number
    }
  ],
  "healthScore": number,
  "summary": "one-line overall assessment"
}`;

  const userPrompt = `CURRENT FEATURE CATALOG (${catalog.features?.length || 0} features):
${JSON.stringify((catalog.features || []).map((f) => ({
    name: f.name,
    status: f.status,
    uiPath: f.uiPath,
    permissions: f.permissions,
  })), null, 2)}

RECENT KNOWLEDGE-RELATED ERRORS (${knowledgeErrors.length} total):
${JSON.stringify(errorsByFeature, null, 2)}

Detect any knowledge drift between the catalog and what the chatbot appears to know (based on the errors).`;

  const result = await callLLMForJSON(systemPrompt, userPrompt);

  // Store drift report
  const driftReport = {
    type: "knowledge_drift",
    runDate: new Date().toISOString(),
    catalogVersion: catalog.version || "unknown",
    drifts: result.drifts || [],
    healthScore: result.healthScore || 0,
    summary: result.summary || "",
    totalErrorsAnalyzed: knowledgeErrors.length,
    createdAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.improvements).add(driftReport);

  // Auto-create action drafts for critical/high drifts
  for (const drift of (result.drifts || []).filter(
    (d) => d.severity === "critical" || d.severity === "high"
  )) {
    const actionType =
      drift.driftType === "policy_outdated" ? "doc_update" : "prompt_fix";

    await db.collection(COLLECTIONS.actions).add({
      sourceType: "evaluation",
      sourceId: `drift_${drift.featureName}_${Date.now()}`,
      actionType,
      draftContent: {
        title: `[DRIFT] ${drift.featureName}: ${drift.driftType}`,
        body: `## Knowledge Drift Detected\n\n**Type:** ${drift.driftType}\n**Severity:** ${drift.severity}\n**Feature:** ${drift.featureName}\n\n### Description\n${drift.description}\n\n### Suggested Fix\n${drift.suggestedFix}\n\n### Impact\n${drift.affectedErrorCount || 0} related chatbot errors detected.`,
        metadata: {
          driftType: drift.driftType,
          severity: drift.severity,
          feature: drift.featureName,
        },
      },
      status: "draft",
      createdAt: new Date().toISOString(),
    });
  }

  console.log(`[Drift] Found ${(result.drifts || []).length} drifts, health=${result.healthScore}`);
  return driftReport;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. FAQ AUTO-GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find high-frequency clusters that don't have existing FAQ actions,
 * and generate FAQ drafts automatically.
 */
async function generateAutoFAQs() {
  console.log("[FAQ] Starting auto FAQ generation...");

  const FAQ_THRESHOLD = 5; // minimum cluster members to trigger FAQ
  let generated = 0;

  // Get active clusters with enough members
  const clustersSnap = await db.collection(COLLECTIONS.clusters)
    .where("status", "==", "active")
    .limit(30)
    .get();

  for (const doc_ of clustersSnap.docs) {
    const cluster = { id: doc_.id, ...doc_.data() };
    if ((cluster.memberCount || 0) < FAQ_THRESHOLD) continue;

    // Check if FAQ already exists for this cluster
    const existingSnap = await db.collection(COLLECTIONS.actions)
      .where("sourceId", "==", cluster.id)
      .where("actionType", "==", "faq_draft")
      .limit(1)
      .get();

    if (!existingSnap.empty) continue;

    // Get sample member items for context
    const membersSnap = await db.collection(COLLECTIONS.items)
      .where("clusterId", "==", cluster.id)
      .limit(5)
      .get();

    const samples = membersSnap.docs.map((d) => {
      const data = d.data();
      return {
        summary: data.normalizedSummary,
        painPoint: data.painPoint,
        category: data.primaryCategory,
      };
    });

    // Get sample conversations
    const turnSamples = [];
    for (const member of membersSnap.docs.slice(0, 3)) {
      const turnId = member.data().turnId;
      if (!turnId) continue;
      try {
        const turnSnap = await db.collection(COLLECTIONS.turns).doc(turnId).get();
        if (turnSnap.exists) {
          const t = turnSnap.data();
          turnSamples.push({
            question: (t.userMessage || "").substring(0, 300),
            answer: (t.assistantMessage || "").substring(0, 300),
          });
        }
      } catch {/* ignore */}
    }

    try {
      const systemPrompt = `You are a FAQ writer for VisionChain, a blockchain wallet and DeFi platform.
Create a comprehensive FAQ entry based on cluster data (frequently asked questions grouped by similarity).
Write in BOTH Korean and English.

OUTPUT FORMAT (JSON):
{
  "title": "Clear question title (English)",
  "body": "Full FAQ markdown with Korean and English Q&A, steps, related features",
  "metadata": {
    "priority": "P1|P2|P3",
    "category": "string",
    "languages": "ko,en",
    "relatedFeatures": "comma-separated"
  }
}`;

      const userPrompt = `CLUSTER: "${cluster.clusterTitle}" (${cluster.memberCount} occurrences)
Summary: ${cluster.representativeSummary}
Tags: ${(cluster.tags || []).join(", ")}
Related Features: ${(cluster.relatedFeatures || []).join(", ")}

SAMPLE USER QUESTIONS:
${JSON.stringify(samples, null, 2)}

SAMPLE CONVERSATIONS:
${JSON.stringify(turnSamples, null, 2)}

Generate a comprehensive FAQ entry for this frequently asked topic.`;

      const faq = await callLLMForJSON(systemPrompt, userPrompt);

      await db.collection(COLLECTIONS.actions).add({
        sourceType: "cluster",
        sourceId: cluster.id,
        actionType: "faq_draft",
        draftContent: {
          title: faq.title || `FAQ: ${cluster.clusterTitle}`,
          body: faq.body || "",
          metadata: {
            ...(faq.metadata || {}),
            memberCount: String(cluster.memberCount),
            autoGenerated: "true",
          },
        },
        status: "draft",
        createdAt: new Date().toISOString(),
      });

      generated++;
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[FAQ] Generation failed for cluster ${cluster.id}:`, err.message);
    }
  }

  const logEntry = {
    type: "faq_auto_generation",
    runDate: new Date().toISOString(),
    generated,
    clustersAnalyzed: clustersSnap.size,
    createdAt: new Date().toISOString(),
  };
  await db.collection(COLLECTIONS.improvements).add(logEntry);

  console.log(`[FAQ] Generated ${generated} FAQ drafts from ${clustersSnap.size} clusters.`);
  return logEntry;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. PROMPT IMPROVEMENT RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze recurring error patterns and generate specific system prompt
 * improvement recommendations.
 */
async function generatePromptImprovements() {
  console.log("[Prompt] Starting prompt improvement analysis...");

  const RECURRENCE_THRESHOLD = 5;
  let generated = 0;

  // Get recent reports to find recurring errors
  const reportsSnap = await db.collection(COLLECTIONS.reports)
    .orderBy("reportDate", "desc")
    .limit(7)
    .get();

  if (reportsSnap.empty) {
    console.log("[Prompt] No reports, skipping.");
    return { generated: 0, skipped: true };
  }

  // Aggregate error patterns across last 7 days
  const errorAggregate = {};
  for (const doc_ of reportsSnap.docs) {
    const report = doc_.data();
    for (const pattern of report.repeatedErrorPatterns || []) {
      if (!errorAggregate[pattern.errorType]) {
        errorAggregate[pattern.errorType] = {
          totalCount: 0,
          days: 0,
          exampleTurnIds: [],
        };
      }
      errorAggregate[pattern.errorType].totalCount += pattern.count;
      errorAggregate[pattern.errorType].days++;
      errorAggregate[pattern.errorType].exampleTurnIds.push(
        ...(pattern.exampleTurnIds || []).slice(0, 2)
      );
    }
  }

  // Filter significant patterns
  const significantErrors = Object.entries(errorAggregate)
    .filter(([_, data]) => data.totalCount >= RECURRENCE_THRESHOLD)
    .sort((a, b) => b[1].totalCount - a[1].totalCount);

  for (const [errorType, errData] of significantErrors) {
    // Check if prompt_fix already exists for this error
    const existingSnap = await db.collection(COLLECTIONS.actions)
      .where("actionType", "==", "prompt_fix")
      .where("status", "in", ["draft", "reviewed", "approved"])
      .limit(10)
      .get();

    // Check if this specific error type already has a fix
    const hasExisting = existingSnap.docs.some((d) => {
      const meta = d.data().draftContent?.metadata || {};
      return meta.errorType === errorType;
    });

    if (hasExisting) continue;

    // Collect example conversations
    const examples = [];
    for (const turnId of errData.exampleTurnIds.slice(0, 5)) {
      try {
        const turnSnap = await db.collection(COLLECTIONS.turns).doc(turnId).get();
        if (turnSnap.exists) {
          const t = turnSnap.data();
          examples.push({
            userMessage: (t.userMessage || "").substring(0, 300),
            assistantMessage: (t.assistantMessage || "").substring(0, 500),
            locale: t.locale,
          });
        }
      } catch {/* ignore */}
    }

    if (examples.length === 0) continue;

    try {
      const systemPrompt = `You are a chatbot prompt engineer for VisionChain.
Analyze recurring error patterns and generate a specific system prompt improvement.

OUTPUT FORMAT (JSON):
{
  "title": "[PROMPT] Fix: specific description",
  "body": "Detailed markdown with: error analysis, root cause, exact prompt text to add/modify, example queries with expected vs current responses, rollback plan",
  "metadata": {
    "errorType": "string",
    "priority": "P1|P2|P3",
    "estimatedImpact": "high|medium|low",
    "promptSection": "system_instruction|tool_descriptions|safety_rules|knowledge_base"
  }
}`;

      const userPrompt = `RECURRING ERROR: "${errorType}"
Total occurrences (7 days): ${errData.totalCount}
Days active: ${errData.days}/7

EXAMPLE CONVERSATIONS WHERE THIS ERROR OCCURS:
${JSON.stringify(examples, null, 2)}

Generate a specific system prompt improvement to fix this recurring error pattern.
Include the EXACT text that should be added or modified in the system prompt.`;

      const fix = await callLLMForJSON(systemPrompt, userPrompt);

      await db.collection(COLLECTIONS.actions).add({
        sourceType: "evaluation",
        sourceId: `prompt_improve_${errorType}_${Date.now()}`,
        actionType: "prompt_fix",
        draftContent: {
          title: fix.title || `[PROMPT] Fix: ${errorType}`,
          body: fix.body || "",
          metadata: {
            ...(fix.metadata || {}),
            errorType,
            totalOccurrences: String(errData.totalCount),
            daysActive: String(errData.days),
            autoGenerated: "true",
          },
        },
        status: "draft",
        createdAt: new Date().toISOString(),
      });

      generated++;
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[Prompt] Fix generation failed for ${errorType}:`, err.message);
    }
  }

  const logEntry = {
    type: "prompt_improvement",
    runDate: new Date().toISOString(),
    generated,
    errorsAnalyzed: significantErrors.length,
    createdAt: new Date().toISOString(),
  };
  await db.collection(COLLECTIONS.improvements).add(logEntry);

  console.log(`[Prompt] Generated ${generated} prompt fixes from ${significantErrors.length} error patterns.`);
  return logEntry;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. RELEASE IMPACT TRACKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare metrics before and after a feature catalog version change
 * to measure release impact on chatbot quality.
 */
async function trackReleaseImpact(catalogVersionBefore, catalogVersionAfter, windowDays = 3) {
  console.log(`[Release] Tracking impact: ${catalogVersionBefore} → ${catalogVersionAfter}`);

  // Get reports before and after
  const allReportsSnap = await db.collection(COLLECTIONS.reports)
    .orderBy("reportDate", "desc")
    .limit(windowDays * 2 + 2)
    .get();

  if (allReportsSnap.size < 4) {
    return {
      type: "release_impact",
      status: "insufficient_data",
      message: "Need at least 4 daily reports for comparison",
    };
  }

  const reports = allReportsSnap.docs.map((d) => d.data());
  const midpoint = Math.floor(reports.length / 2);
  const postRelease = reports.slice(0, midpoint);
  const preRelease = reports.slice(midpoint);

  // Calculate aggregate metrics
  const calcAvg = (arr, getter) => {
    const vals = arr.map(getter).filter((v) => typeof v === "number" && !isNaN(v));
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const pre = {
    avgScore: calcAvg(preRelease, (r) => r.summary?.overallAvgScore),
    errorRate: calcAvg(preRelease, (r) => r.summary?.errorRate),
    featureAccuracy: calcAvg(preRelease, (r) => r.summary?.featureAccuracyAvg),
    criticalErrors: preRelease.reduce((s, r) => s + (r.summary?.criticalErrorCount || 0), 0),
    totalTurns: preRelease.reduce((s, r) => s + (r.summary?.totalTurns || 0), 0),
  };

  const post = {
    avgScore: calcAvg(postRelease, (r) => r.summary?.overallAvgScore),
    errorRate: calcAvg(postRelease, (r) => r.summary?.errorRate),
    featureAccuracy: calcAvg(postRelease, (r) => r.summary?.featureAccuracyAvg),
    criticalErrors: postRelease.reduce((s, r) => s + (r.summary?.criticalErrorCount || 0), 0),
    totalTurns: postRelease.reduce((s, r) => s + (r.summary?.totalTurns || 0), 0),
  };

  const delta = {
    avgScore: post.avgScore - pre.avgScore,
    errorRate: post.errorRate - pre.errorRate,
    featureAccuracy: post.featureAccuracy - pre.featureAccuracy,
    criticalErrors: post.criticalErrors - pre.criticalErrors,
  };

  const scoreImproved = delta.avgScore > 0;
  const errorReduced = delta.errorRate < 0;
  const overallPositive = scoreImproved && errorReduced;

  const impactReport = {
    type: "release_impact",
    runDate: new Date().toISOString(),
    catalogVersionBefore,
    catalogVersionAfter,
    windowDays,
    preRelease: pre,
    postRelease: post,
    delta,
    assessment: overallPositive ? "positive" : scoreImproved || errorReduced ? "mixed" : "negative",
    summary: `Score ${delta.avgScore >= 0 ? "+" : ""}${delta.avgScore.toFixed(2)}, Error rate ${delta.errorRate >= 0 ? "+" : ""}${(delta.errorRate * 100).toFixed(1)}pp, Feature accuracy ${delta.featureAccuracy >= 0 ? "+" : ""}${delta.featureAccuracy.toFixed(2)}`,
    createdAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.improvements).add(impactReport);

  // Generate release note if significant changes
  if (Math.abs(delta.avgScore) > 0.3 || Math.abs(delta.errorRate) > 0.1) {
    await db.collection(COLLECTIONS.actions).add({
      sourceType: "evaluation",
      sourceId: `release_impact_${catalogVersionAfter}`,
      actionType: "release_note",
      draftContent: {
        title: `[RELEASE] Impact Report: ${catalogVersionBefore} → ${catalogVersionAfter}`,
        body: `## Release Impact Report\n\n**Period:** ${windowDays} days pre/post comparison\n\n### Metrics\n| Metric | Before | After | Delta |\n|--------|--------|-------|-------|\n| Avg Score | ${pre.avgScore.toFixed(2)} | ${post.avgScore.toFixed(2)} | ${delta.avgScore >= 0 ? "+" : ""}${delta.avgScore.toFixed(2)} |\n| Error Rate | ${(pre.errorRate * 100).toFixed(1)}% | ${(post.errorRate * 100).toFixed(1)}% | ${delta.errorRate >= 0 ? "+" : ""}${(delta.errorRate * 100).toFixed(1)}pp |\n| Feature Accuracy | ${pre.featureAccuracy.toFixed(2)} | ${post.featureAccuracy.toFixed(2)} | ${delta.featureAccuracy >= 0 ? "+" : ""}${delta.featureAccuracy.toFixed(2)} |\n| Critical Errors | ${pre.criticalErrors} | ${post.criticalErrors} | ${delta.criticalErrors >= 0 ? "+" : ""}${delta.criticalErrors} |\n\n### Assessment: **${impactReport.assessment.toUpperCase()}**\n${impactReport.summary}`,
        metadata: {
          assessment: impactReport.assessment,
          versionBefore: catalogVersionBefore,
          versionAfter: catalogVersionAfter,
        },
      },
      status: "draft",
      createdAt: new Date().toISOString(),
    });
  }

  console.log(`[Release] Impact: ${impactReport.assessment} — ${impactReport.summary}`);
  return impactReport;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cloud Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Weekly self-improvement sweep.
 * Runs: Sunday 06:00 UTC
 * Executes: drift detection, FAQ generation, prompt improvements.
 */
const vpisSelfImprove = onSchedule(
  {
    schedule: "0 6 * * 0",
    timeZone: "UTC",
    memory: "1GiB",
    timeoutSeconds: 540,
    region: "us-central1",
  },
  async () => {
    console.log("[VPIS] Starting weekly self-improvement sweep...");

    const results = {};

    try {
      results.drift = await detectKnowledgeDrift();
    } catch (err) {
      console.error("[VPIS] Drift detection failed:", err.message);
      results.drift = { error: err.message };
    }

    await new Promise((r) => setTimeout(r, 2000));

    try {
      results.faq = await generateAutoFAQs();
    } catch (err) {
      console.error("[VPIS] FAQ generation failed:", err.message);
      results.faq = { error: err.message };
    }

    await new Promise((r) => setTimeout(r, 2000));

    try {
      results.prompt = await generatePromptImprovements();
    } catch (err) {
      console.error("[VPIS] Prompt improvement failed:", err.message);
      results.prompt = { error: err.message };
    }

    // Log overall run
    await db.collection(COLLECTIONS.improvements).add({
      type: "weekly_sweep",
      runDate: new Date().toISOString(),
      results,
      createdAt: new Date().toISOString(),
    });

    console.log("[VPIS] Weekly self-improvement sweep complete:", JSON.stringify(results));
  }
);

/**
 * Admin: Manually trigger self-improvement modules.
 */
const vpisManualImprove = onCall(
  { memory: "1GiB", timeoutSeconds: 300, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { module } = request.data || {};
    const results = {};

    if (!module || module === "drift" || module === "all") {
      try {
        results.drift = await detectKnowledgeDrift();
      } catch (err) {
        results.drift = { error: err.message };
      }
    }

    if (!module || module === "faq" || module === "all") {
      try {
        results.faq = await generateAutoFAQs();
      } catch (err) {
        results.faq = { error: err.message };
      }
    }

    if (!module || module === "prompt" || module === "all") {
      try {
        results.prompt = await generatePromptImprovements();
      } catch (err) {
        results.prompt = { error: err.message };
      }
    }

    return { success: true, results };
  }
);

/**
 * Admin: Trigger release impact tracking.
 */
const vpisTrackReleaseImpact = onCall(
  { memory: "512MiB", timeoutSeconds: 120, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { versionBefore, versionAfter, windowDays } = request.data || {};
    if (!versionBefore || !versionAfter) {
      throw new HttpsError(
        "invalid-argument",
        "versionBefore and versionAfter required."
      );
    }

    const result = await trackReleaseImpact(
      versionBefore,
      versionAfter,
      windowDays || 3
    );

    return { success: true, report: result };
  }
);

/**
 * Admin: Get improvement logs.
 */
const vpisGetImprovementLogs = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { type, limitCount } = request.data || {};

    let q = db.collection(COLLECTIONS.improvements).orderBy("createdAt", "desc");
    if (type) q = q.where("type", "==", type);
    q = q.limit(limitCount || 30);

    const snap = await q.get();
    return {
      logs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  vpisSelfImprove,
  vpisManualImprove,
  vpisTrackReleaseImpact,
  vpisGetImprovementLogs,
};
