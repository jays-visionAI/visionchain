/**
 * VPIS Evaluator Module - Phase 2
 *
 * LLM-based answer quality evaluation engine.
 * Chains:
 *   1. Intent Classification
 *   2. Quality Scoring (6 dimensions)
 *   3. Feature Accuracy Check (against catalog)
 *   4. Error Classification + Severity
 *   5. Daily Report Aggregation
 *
 * Usage: Import and spread into functions/index.js
 *   const vpisEval = require("./vpisEvaluator");
 *   Object.assign(exports, vpisEval);
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const COLLECTIONS = {
  turns: "vpis_conversation_turns",
  catalog: "vpis_feature_catalog",
  jobs: "vpis_analysis_jobs",
  evaluations: "vpis_answer_evaluations",
  reports: "vpis_daily_reports",
};

// ── LLM Helper ─────────────────────────────────────────────────────────────

let _genAI = null;

/**
 * Get or create GoogleGenerativeAI instance
 * @return {object} GoogleGenerativeAI instance
 */
function getGenAI() {
  if (!_genAI) {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) throw new Error("[VPIS] GEMINI_API_KEY not configured");
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

/**
 * Call Gemini with structured JSON output
 * @param {string} systemPrompt - System instruction
 * @param {string} userPrompt - User content
 * @param {string} modelName - Model to use
 * @return {object} Parsed JSON response
 */
async function callLLMForJSON(systemPrompt, userPrompt, modelName = "gemini-2.5-flash") {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    console.error("[VPIS] Failed to parse LLM JSON:", text.substring(0, 200));
    throw new Error("LLM returned non-JSON response");
  }
}

// ── Evaluation Prompts ─────────────────────────────────────────────────────

const PROMPT_VERSION = "v1.0";

/**
 * Build the evaluation prompt for a batch of turns
 * @param {Array} turns - Array of turn objects
 * @param {object} catalog - Feature catalog snapshot
 * @return {{system: string, user: string}} Prompt pair
 */
function buildEvaluationPrompt(turns, catalog) {
  const featureList = (catalog?.features || [])
    .map((f) => `- ${f.name} [${f.status}]: ${f.description} (path: ${f.uiPath})`)
    .join("\n");

  const policyList = (catalog?.policies || [])
    .map((p) => `- ${p.name}: ${p.content}`)
    .join("\n");

  const system = `You are a chatbot answer quality auditor for VisionChain, a blockchain wallet and DeFi platform.

Your job is to evaluate each user-assistant conversation turn for:
1. Intent Classification - What the user is actually asking
2. Quality Scoring - How well the assistant answered (1-5 scale per dimension)
3. Feature Accuracy - Whether the answer correctly represents actual product features
4. Error Detection - Any errors or issues in the answer

## CURRENT PRODUCT FEATURES:
${featureList || "No feature catalog available"}

## CURRENT POLICIES:
${policyList || "No policy catalog available"}

## SCORING GUIDE (1-5):
1 = Completely wrong/irrelevant
2 = Mostly wrong, some relevance
3 = Partially correct, missing key info
4 = Mostly correct, minor issues
5 = Excellent, fully accurate and helpful

## INTENT CATEGORIES:
feature_existence, usage_help, error_resolution, account_security,
portfolio_trading, policy_permissions, feature_request, bug_report,
general_exploration, other

## ERROR TYPES:
nonexistent_feature_claim, missing_required_step, outdated_ui_reference,
vague_answer, hallucinated_policy, incomplete_resolution,
wrong_capability_boundary, language_mismatch

## OUTPUT FORMAT:
Return a JSON array with one evaluation object per turn:
[
  {
    "turnIndex": 0,
    "detectedIntent": "usage_help",
    "intentConfidence": 0.9,
    "scores": {
      "intentMatch": 4,
      "relevance": 5,
      "specificity": 3,
      "clarity": 4,
      "actionability": 4,
      "completionQuality": 3
    },
    "featureAccuracy": {
      "featureAccuracy": 5,
      "policyAccuracy": 5,
      "uiFlowAccuracy": 4,
      "overclaimRisk": false,
      "outdatedKnowledgeRisk": false
    },
    "errorTypes": [],
    "errorSeverity": "none"
  }
]

errorSeverity values: none, low, medium, high, critical
- none: no errors
- low: minor inaccuracy, not harmful
- medium: wrong info that could confuse
- high: significantly wrong, could cause user to take wrong action
- critical: dangerous misinformation (wrong wallet, wrong amounts, security risk)`;

  const turnData = turns.map((t, i) => {
    return `--- TURN ${i} ---
USER: ${t.userMessage}
ASSISTANT: ${t.assistantMessage}
LOCALE: ${t.locale || "unknown"}
TOOLS_USED: ${(t.toolsInvoked || []).join(", ") || "none"}`;
  }).join("\n\n");

  const user = `Evaluate the following ${turns.length} conversation turn(s):\n\n${turnData}`;

  return { system, user };
}

// ── Core Evaluation Logic ──────────────────────────────────────────────────

/**
 * Evaluate a batch of turns using LLM
 * @param {Array} turns - Turns to evaluate
 * @param {object} catalog - Feature catalog
 * @param {string} jobId - Analysis job ID
 * @return {number} Number of evaluations created
 */
async function evaluateTurnBatch(turns, catalog, jobId) {
  const { system, user } = buildEvaluationPrompt(turns, catalog);

  const evaluations = await callLLMForJSON(system, user);

  if (!Array.isArray(evaluations)) {
    console.error("[VPIS] LLM returned non-array:", typeof evaluations);
    return 0;
  }

  const batch = db.batch();
  let count = 0;

  for (const eval_ of evaluations) {
    const turnIndex = eval_.turnIndex;
    if (turnIndex === undefined || turnIndex >= turns.length) continue;

    const turn = turns[turnIndex];
    const scores = eval_.scores || {};

    // Calculate weighted overall score
    const weights = {
      intentMatch: 0.2,
      relevance: 0.2,
      specificity: 0.15,
      clarity: 0.15,
      actionability: 0.15,
      completionQuality: 0.15,
    };

    let overallScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      overallScore += (scores[key] || 3) * weight;
    }

    const evalRef = db.collection(COLLECTIONS.evaluations).doc();
    batch.set(evalRef, {
      turnId: turn.id,
      conversationId: turn.conversationId,
      jobId: jobId,
      detectedIntent: eval_.detectedIntent || "other",
      intentConfidence: eval_.intentConfidence || 0.5,
      scores: {
        intentMatch: scores.intentMatch || 3,
        relevance: scores.relevance || 3,
        specificity: scores.specificity || 3,
        clarity: scores.clarity || 3,
        actionability: scores.actionability || 3,
        completionQuality: scores.completionQuality || 3,
      },
      overallScore: Math.round(overallScore * 100) / 100,
      featureAccuracy: {
        featureAccuracy: eval_.featureAccuracy?.featureAccuracy || 3,
        policyAccuracy: eval_.featureAccuracy?.policyAccuracy || 3,
        uiFlowAccuracy: eval_.featureAccuracy?.uiFlowAccuracy || 3,
        overclaimRisk: eval_.featureAccuracy?.overclaimRisk || false,
        outdatedKnowledgeRisk: eval_.featureAccuracy?.outdatedKnowledgeRisk || false,
      },
      errorTypes: eval_.errorTypes || [],
      errorSeverity: eval_.errorSeverity || "none",
      evaluatorModel: "gemini-2.5-flash",
      evaluationPromptVersion: PROMPT_VERSION,
      rawEvaluationResponse: JSON.stringify(eval_),
      createdAt: new Date().toISOString(),
    });

    // Update turn analysis status
    const turnRef = db.collection(COLLECTIONS.turns).doc(turn.id);
    batch.update(turnRef, {
      analysisStatus: "analyzed",
      detectedIntent: eval_.detectedIntent || "other",
    });

    count++;
  }

  if (count > 0) await batch.commit();
  return count;
}

// ── Daily Report Generation ────────────────────────────────────────────────

/**
 * Generate a daily summary report from evaluations
 * @param {string} jobId - Analysis job ID
 * @param {string} reportDate - YYYY-MM-DD
 */
async function generateDailyReport(jobId, reportDate) {
  // Get all evaluations for this job
  const evalsSnap = await db
    .collection(COLLECTIONS.evaluations)
    .where("jobId", "==", jobId)
    .get();

  if (evalsSnap.empty) {
    console.log("[VPIS] No evaluations found for report generation.");
    return;
  }

  const evaluations = evalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const total = evaluations.length;

  // Calculate summary
  let overallSum = 0;
  let intentMatchSum = 0;
  let featureAccSum = 0;
  let errorCount = 0;
  let criticalCount = 0;
  let highCount = 0;

  // Category breakdown
  const categoryData = {};

  for (const eval_ of evaluations) {
    overallSum += eval_.overallScore || 0;
    intentMatchSum += eval_.scores?.intentMatch || 0;
    featureAccSum += eval_.featureAccuracy?.featureAccuracy || 0;

    if (eval_.errorSeverity !== "none") errorCount++;
    if (eval_.errorSeverity === "critical") criticalCount++;
    if (eval_.errorSeverity === "high") highCount++;

    // Categories
    const cat = eval_.detectedIntent || "other";
    if (!categoryData[cat]) {
      categoryData[cat] = { count: 0, scoreSum: 0, errorCount: 0 };
    }
    categoryData[cat].count++;
    categoryData[cat].scoreSum += eval_.overallScore || 0;
    if (eval_.errorSeverity !== "none") categoryData[cat].errorCount++;
  }

  const scoresByCategory = {};
  for (const [cat, data] of Object.entries(categoryData)) {
    scoresByCategory[cat] = {
      count: data.count,
      avgScore: Math.round((data.scoreSum / data.count) * 100) / 100,
      errorRate: Math.round((data.errorCount / data.count) * 100) / 100,
    };
  }

  // Top failed answers
  const sorted = [...evaluations].sort((a, b) => (a.overallScore || 0) - (b.overallScore || 0));
  const topFailed = sorted.slice(0, 20).map((e) => ({
    turnId: e.turnId,
    userMessage: "", // Will be populated from turn data if needed
    score: e.overallScore,
    errorTypes: e.errorTypes || [],
  }));

  // Populate userMessage for top failed
  for (const item of topFailed) {
    try {
      const turnSnap = await db.collection(COLLECTIONS.turns).doc(item.turnId).get();
      if (turnSnap.exists) {
        item.userMessage = (turnSnap.data().userMessage || "").substring(0, 200);
      }
    } catch {/* ignore */}
  }

  // Repeated error patterns
  const errorCounts = {};
  for (const eval_ of evaluations) {
    for (const errType of (eval_.errorTypes || [])) {
      if (!errorCounts[errType]) {
        errorCounts[errType] = { count: 0, exampleTurnIds: [] };
      }
      errorCounts[errType].count++;
      if (errorCounts[errType].exampleTurnIds.length < 5) {
        errorCounts[errType].exampleTurnIds.push(eval_.turnId);
      }
    }
  }

  const repeatedErrorPatterns = Object.entries(errorCounts)
    .map(([errorType, data]) => ({
      errorType,
      count: data.count,
      exampleTurnIds: data.exampleTurnIds,
    }))
    .sort((a, b) => b.count - a.count);

  // Get unique conversations count
  const uniqueConvs = new Set(evaluations.map((e) => e.conversationId));

  // Save report
  await db.collection(COLLECTIONS.reports).add({
    reportDate,
    jobId,
    summary: {
      totalConversations: uniqueConvs.size,
      totalTurns: total,
      overallAvgScore: Math.round((overallSum / total) * 100) / 100,
      intentMatchAvg: Math.round((intentMatchSum / total) * 100) / 100,
      featureAccuracyAvg: Math.round((featureAccSum / total) * 100) / 100,
      errorRate: Math.round((errorCount / total) * 100) / 100,
      criticalErrorCount: criticalCount,
      highSeverityCount: highCount,
    },
    scoresByCategory,
    topFailedAnswers: topFailed,
    repeatedErrorPatterns,
    createdAt: new Date().toISOString(),
  });

  console.log(`[VPIS] Daily report generated: ${reportDate}. ${total} evaluations, ${errorCount} errors.`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Cloud Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run answer evaluation on pending turns.
 * Triggered daily after ingestion (04:30 UTC) or manually.
 */
const vpisEvaluateAnswers = onSchedule(
  {
    schedule: "30 4 * * *",
    timeZone: "UTC",
    memory: "1GiB",
    timeoutSeconds: 540,
    region: "us-central1",
  },
  async () => {
    console.log("[VPIS] Starting answer evaluation...");
    await runEvaluation("system");
  }
);

/**
 * Admin-triggered manual evaluation of pending turns.
 */
const vpisManualEvaluate = onCall(
  { memory: "1GiB", timeoutSeconds: 540, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { jobId } = request.data;
    const result = await runEvaluation(
      request.auth.token.email || "admin",
      jobId
    );
    return result;
  }
);

/**
 * Core evaluation runner
 * @param {string} triggeredBy - Who triggered the evaluation
 * @param {string} specificJobId - Optional: only evaluate turns from this job
 */
async function runEvaluation(triggeredBy, specificJobId = null) {
  // Get latest feature catalog
  const catalogSnap = await db
    .collection(COLLECTIONS.catalog)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  const catalog = catalogSnap.empty ? null : catalogSnap.docs[0].data();

  // Get pending turns
  let turnsQuery = db
    .collection(COLLECTIONS.turns)
    .where("analysisStatus", "==", "pending");

  if (specificJobId) {
    turnsQuery = turnsQuery.where("analysisJobId", "==", specificJobId);
  }

  const turnsSnap = await turnsQuery.limit(500).get();

  if (turnsSnap.empty) {
    console.log("[VPIS] No pending turns to evaluate.");
    return { success: true, evaluated: 0 };
  }

  const turns = turnsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`[VPIS] Evaluating ${turns.length} pending turns...`);

  // Create or find analysis job
  let jobId = specificJobId;
  if (!jobId) {
    const jobRef = await db.collection(COLLECTIONS.jobs).add({
      jobType: "daily_audit",
      targetDateFrom: new Date(Date.now() - 86400000).toISOString(),
      targetDateTo: new Date().toISOString(),
      status: "running",
      turnsProcessed: 0,
      turnsTotal: turns.length,
      errorCount: 0,
      errorLog: [],
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: triggeredBy,
    });
    jobId = jobRef.id;
  }

  let totalEvaluated = 0;
  let errorCount = 0;
  const errorLog = [];

  // Process in batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < turns.length; i += BATCH_SIZE) {
    const batch = turns.slice(i, i + BATCH_SIZE);

    try {
      const evaluated = await evaluateTurnBatch(batch, catalog, jobId);
      totalEvaluated += evaluated;
      console.log(`[VPIS] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${evaluated}/${batch.length} evaluated.`);

      // Rate limit: wait 1s between batches
      if (i + BATCH_SIZE < turns.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`[VPIS] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err.message);
      errorCount++;
      errorLog.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message}`);

      // Mark failed turns
      const failBatch = db.batch();
      for (const turn of batch) {
        failBatch.update(db.collection(COLLECTIONS.turns).doc(turn.id), {
          analysisStatus: "failed",
        });
      }
      await failBatch.commit();
    }
  }

  // Update job status
  await db.collection(COLLECTIONS.jobs).doc(jobId).update({
    status: errorCount > 0 && totalEvaluated === 0 ? "failed" : "completed",
    turnsProcessed: totalEvaluated,
    errorCount,
    errorLog,
    completedAt: new Date().toISOString(),
  });

  // Generate daily report
  const today = new Date().toISOString().split("T")[0];
  try {
    await generateDailyReport(jobId, today);
  } catch (reportErr) {
    console.error("[VPIS] Report generation failed:", reportErr.message);
  }

  console.log(`[VPIS] Evaluation complete: ${totalEvaluated}/${turns.length} turns, ${errorCount} errors.`);
  return { success: true, jobId, evaluated: totalEvaluated, errors: errorCount };
}

/**
 * Get evaluation details for a specific turn (admin use).
 */
const vpisGetEvaluation = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { turnId, evaluationId } = request.data;

    if (evaluationId) {
      const evalSnap = await db.collection(COLLECTIONS.evaluations).doc(evaluationId).get();
      if (!evalSnap.exists) throw new HttpsError("not-found", "Evaluation not found.");
      return { evaluation: { id: evalSnap.id, ...evalSnap.data() } };
    }

    if (turnId) {
      const evalSnap = await db
        .collection(COLLECTIONS.evaluations)
        .where("turnId", "==", turnId)
        .limit(1)
        .get();

      if (evalSnap.empty) throw new HttpsError("not-found", "No evaluation for this turn.");
      const d = evalSnap.docs[0];
      
      // Also get the turn data
      const turnSnap = await db.collection(COLLECTIONS.turns).doc(turnId).get();

      return {
        evaluation: { id: d.id, ...d.data() },
        turn: turnSnap.exists ? { id: turnSnap.id, ...turnSnap.data() } : null,
      };
    }

    throw new HttpsError("invalid-argument", "turnId or evaluationId required.");
  }
);

/**
 * Get daily reports list with optional date range (admin use).
 */
const vpisGetReports = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { dateFrom, dateTo, limitCount } = request.data || {};

    let q = db.collection(COLLECTIONS.reports).orderBy("reportDate", "desc");

    if (dateFrom) q = q.where("reportDate", ">=", dateFrom);
    if (dateTo) q = q.where("reportDate", "<=", dateTo);
    q = q.limit(limitCount || 30);

    const snap = await q.get();
    return {
      reports: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  vpisEvaluateAnswers,
  vpisManualEvaluate,
  vpisGetEvaluation,
  vpisGetReports,
};
