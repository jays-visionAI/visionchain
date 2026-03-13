/**
 * VPIS Extractor Module - Phase 3
 *
 * Bug/Feature Request extraction + LLM-based semantic clustering.
 *
 * Chains after Phase 2 evaluation:
 *   1. Detect bug reports & feature requests from conversation turns
 *   2. Normalize + tag each item
 *   3. Cluster similar items together
 *   4. Calculate priority scores
 *
 * Usage: Import and spread into functions/index.js
 *   const vpisExtractor = require("./vpisExtractor");
 *   Object.assign(exports, vpisExtractor);
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
  jobs: "vpis_analysis_jobs",
};

// ── LLM Helper (shared pattern) ───────────────────────────────────────────

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

async function callLLMForJSON(systemPrompt, userPrompt, modelName = "gemini-2.5-flash") {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    console.error("[VPIS-Extract] Failed to parse JSON:", text.substring(0, 300));
    throw new Error("LLM returned non-JSON response");
  }
}

// ── Extraction Prompts ─────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are a product intelligence analyst for VisionChain, a blockchain wallet and DeFi platform.

Analyze each conversation turn and extract any bug reports and/or feature requests the user is expressing.

DETECTION SIGNALS:
- Explicit bug: "안돼요", "오류", "에러", "안 됨", "doesn't work", "broken", "error", "bug", "crash"
- Implicit bug: frustrated repeated questions, workarounds, "이상한 ~", "왜 ~?"
- Explicit request: "추가해줘", "만들어줘", "있었으면", "add", "want", "wish", "would be nice"
- Implicit request: "~ 되나요?", "~ 할 수 있나요?", "can I ~?", "is it possible to ~?"
- UX issue: "어디서 ~?", "찾을 수가 없어", "못 찾겠어", "confusing", "can't find"
- Doc request: "문서", "가이드", "설명서", "documentation", "guide", "how-to"

FIXED TAXONOMY TAGS:
wallet, bridge, trading, portfolio, chatbot, admin, reporting, docs,
permissions, performance, ui, transaction, onboarding, quant, disk,
game_center, staking, agent, market, notification

OUTPUT FORMAT:
Return a JSON array (can be empty if no items detected):
[
  {
    "turnIndex": 0,
    "itemType": "bug_report",
    "signalType": "explicit",
    "confidence": 0.9,
    "normalizedSummary": "Send button unresponsive when amount field is empty",
    "primaryCategory": "wallet",
    "subcategory": "send",
    "painPoint": "User cannot complete send transaction",
    "expectedBehavior": "Send button should show validation error",
    "observedBehavior": "Button does not respond to clicks",
    "requestedOutcome": null,
    "rootCauseCandidate": "Missing input validation on send form",
    "fixedTags": ["wallet", "transaction", "ui"],
    "semanticTags": ["send-button-unresponsive", "missing-validation"]
  }
]

itemType values: bug_report, feature_request, ux_improvement, doc_request, admin_request
signalType: explicit (user directly stated it) or implicit (inferred from context)
confidence: 0.0 to 1.0

IMPORTANT:
- Only extract genuine signals, not casual conversation
- For bugs: fill expectedBehavior and observedBehavior
- For requests: fill requestedOutcome
- normalizedSummary should be a clear, actionable one-liner in English
- Return empty array [] if no items detected`;

// ── Clustering Prompt ──────────────────────────────────────────────────────

function buildClusteringPrompt(newItems, existingClusters) {
  const clusterList = existingClusters.map((c) =>
    `[${c.id}] ${c.clusterTitle}: ${c.representativeSummary} (tags: ${c.tags.join(", ")})`
  ).join("\n");

  const system = `You are a clustering engine for product intelligence items (bugs and feature requests).

Given NEW items and EXISTING clusters, assign each new item to an existing cluster OR recommend creating a new cluster.

EXISTING CLUSTERS:
${clusterList || "(none)"}

OUTPUT FORMAT:
Return a JSON array with one assignment per new item:
[
  {
    "itemIndex": 0,
    "action": "assign_existing",
    "clusterId": "abc123",
    "reason": "Same issue as existing cluster about send button"
  },
  {
    "itemIndex": 1,
    "action": "create_new",
    "suggestedTitle": "Dark mode contrast issues in portfolio view",
    "suggestedSummary": "Multiple users report poor contrast and readability in dark mode for portfolio charts",
    "reason": "No existing cluster matches this UI visibility issue"
  }
]

action values: assign_existing, create_new
For assign_existing: provide clusterId from the existing clusters list
For create_new: provide suggestedTitle and suggestedSummary

RULES:
- Be conservative: only cluster truly similar items together
- Different categories should NOT be in the same cluster
- If unsure, create a new cluster rather than forcing a match`;

  return system;
}

// ── Priority Score Calculation ──────────────────────────────────────────────

function calculatePriorityScore(item, clusterMemberCount = 1) {
  let score = 0;

  // Base: confidence
  score += (item.confidence || 0.5) * 10;

  // Frequency (cluster size bonus)
  score += Math.min(clusterMemberCount * 5, 30);

  // Signal type: explicit signals are more reliable
  if (item.signalType === "explicit") score += 10;

  // Item type weighting
  if (item.itemType === "bug_report") score += 15;
  else if (item.itemType === "feature_request") score += 10;
  else if (item.itemType === "ux_improvement") score += 8;

  // Core flow impact
  const coreFlows = ["wallet", "transaction", "bridge", "staking"];
  if (coreFlows.some((f) => (item.fixedTags || []).includes(f))) {
    score += 10;
  }

  // Trust risk (security-related)
  const trustTags = ["permissions", "transaction", "staking"];
  if (trustTags.some((f) => (item.fixedTags || []).includes(f))) {
    score += 5;
  }

  return Math.min(Math.round(score), 100);
}

// ── Core Extraction Logic ──────────────────────────────────────────────────

async function extractFromTurnBatch(turns, jobId) {
  const turnData = turns
    .map((t, i) => `--- TURN ${i} ---\nUSER: ${t.userMessage}\nASSISTANT: ${t.assistantMessage}\nLOCALE: ${t.locale || "unknown"}`)
    .join("\n\n");

  const userPrompt = `Extract bug reports and feature requests from these ${turns.length} conversation turns:\n\n${turnData}`;

  const items = await callLLMForJSON(EXTRACTION_SYSTEM, userPrompt);

  if (!Array.isArray(items) || items.length === 0) return 0;

  const batch = db.batch();
  let count = 0;

  for (const item of items) {
    const turnIndex = item.turnIndex;
    if (turnIndex === undefined || turnIndex >= turns.length) continue;

    const turn = turns[turnIndex];
    const priorityScore = calculatePriorityScore(item);

    const itemRef = db.collection(COLLECTIONS.items).doc();
    batch.set(itemRef, {
      turnId: turn.id,
      conversationId: turn.conversationId,
      userId: turn.userId,
      jobId: jobId,
      itemType: item.itemType || "bug_report",
      signalType: item.signalType || "implicit",
      confidence: item.confidence || 0.5,
      normalizedSummary: item.normalizedSummary || "",
      primaryCategory: item.primaryCategory || "other",
      subcategory: item.subcategory || "",
      painPoint: item.painPoint || "",
      expectedBehavior: item.expectedBehavior || null,
      observedBehavior: item.observedBehavior || null,
      requestedOutcome: item.requestedOutcome || null,
      rootCauseCandidate: item.rootCauseCandidate || null,
      fixedTags: item.fixedTags || [],
      semanticTags: item.semanticTags || [],
      priorityScore: priorityScore,
      priorityFactors: {
        frequency: 1,
        growth: 0,
        businessImpact: priorityScore > 50 ? 3 : priorityScore > 30 ? 2 : 1,
        severity: item.itemType === "bug_report" ? 3 : 1,
        coreFlowImpact: ["wallet", "transaction", "bridge"].some((t) =>
          (item.fixedTags || []).includes(t)
        ),
        trustRisk: ["permissions", "transaction"].some((t) =>
          (item.fixedTags || []).includes(t)
        ),
      },
      clusterId: null,
      status: "new",
      createdAt: new Date().toISOString(),
    });

    count++;
  }

  if (count > 0) await batch.commit();
  return count;
}

// ── Core Clustering Logic ──────────────────────────────────────────────────

async function clusterNewItems() {
  // Get unclustered items
  const itemsSnap = await db
    .collection(COLLECTIONS.items)
    .where("clusterId", "==", null)
    .where("status", "==", "new")
    .limit(100)
    .get();

  if (itemsSnap.empty) {
    console.log("[VPIS-Cluster] No unclustered items.");
    return 0;
  }

  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Get existing active clusters
  const clustersSnap = await db
    .collection(COLLECTIONS.clusters)
    .where("status", "==", "active")
    .limit(100)
    .get();

  const existingClusters = clustersSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  // Build item descriptions for LLM
  const itemDescriptions = items
    .map((item, i) =>
      `[${i}] ${item.itemType}: ${item.normalizedSummary} (category: ${item.primaryCategory}, tags: ${(item.fixedTags || []).join(", ")})`
    )
    .join("\n");

  const systemPrompt = buildClusteringPrompt(items, existingClusters);
  const userPrompt = `Assign these ${items.length} new items to clusters:\n\n${itemDescriptions}`;

  const assignments = await callLLMForJSON(systemPrompt, userPrompt);

  if (!Array.isArray(assignments)) return 0;

  let clustered = 0;
  const newClusters = {};

  for (const assignment of assignments) {
    const itemIndex = assignment.itemIndex;
    if (itemIndex === undefined || itemIndex >= items.length) continue;

    const item = items[itemIndex];

    if (assignment.action === "assign_existing" && assignment.clusterId) {
      // Assign to existing cluster
      await db.collection(COLLECTIONS.items).doc(item.id).update({
        clusterId: assignment.clusterId,
      });

      // Update cluster
      const clusterRef = db.collection(COLLECTIONS.clusters).doc(assignment.clusterId);
      const clusterSnap = await clusterRef.get();
      if (clusterSnap.exists) {
        const clusterData = clusterSnap.data();
        await clusterRef.update({
          memberCount: (clusterData.memberCount || 0) + 1,
          memberIds: admin.firestore.FieldValue.arrayUnion(item.id),
          lastSeenDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Recalculate priority
          priorityScore: Math.max(
            clusterData.priorityScore || 0,
            item.priorityScore || 0
          ),
        });
      }
      clustered++;
    } else if (assignment.action === "create_new") {
      // Create new cluster
      const clusterKey = assignment.suggestedTitle || `Cluster ${itemIndex}`;

      // Avoid creating duplicate clusters for same suggested title
      if (!newClusters[clusterKey]) {
        const clusterRef = await db.collection(COLLECTIONS.clusters).add({
          clusterTitle: assignment.suggestedTitle || item.normalizedSummary,
          representativeSummary: assignment.suggestedSummary || item.painPoint || item.normalizedSummary,
          itemType: item.itemType || "bug_report",
          memberCount: 1,
          memberIds: [item.id],
          tags: item.fixedTags || [],
          relatedFeatures: item.primaryCategory ? [item.primaryCategory] : [],
          trendScore: 0,
          firstSeenDate: new Date().toISOString(),
          lastSeenDate: new Date().toISOString(),
          priorityScore: item.priorityScore || 0,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        newClusters[clusterKey] = clusterRef.id;

        await db.collection(COLLECTIONS.items).doc(item.id).update({
          clusterId: clusterRef.id,
        });
      } else {
        // Same title, merge into already-created cluster
        const existingClusterId = newClusters[clusterKey];
        await db.collection(COLLECTIONS.items).doc(item.id).update({
          clusterId: existingClusterId,
        });

        const clusterRef = db.collection(COLLECTIONS.clusters).doc(existingClusterId);
        await clusterRef.update({
          memberCount: admin.firestore.FieldValue.increment(1),
          memberIds: admin.firestore.FieldValue.arrayUnion(item.id),
          updatedAt: new Date().toISOString(),
        });
      }
      clustered++;
    }
  }

  console.log(`[VPIS-Cluster] Clustered ${clustered}/${items.length} items. ${Object.keys(newClusters).length} new clusters created.`);
  return clustered;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cloud Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract bugs/feature requests from evaluated turns.
 * Runs daily after evaluation (05:00 UTC).
 */
const vpisExtractItems = onSchedule(
  {
    schedule: "0 5 * * *",
    timeZone: "UTC",
    memory: "1GiB",
    timeoutSeconds: 540,
    region: "us-central1",
  },
  async () => {
    console.log("[VPIS] Starting extraction...");
    await runExtraction("system");
  }
);

/**
 * Admin-triggered manual extraction.
 */
const vpisManualExtract = onCall(
  { memory: "1GiB", timeoutSeconds: 540, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const result = await runExtraction(request.auth.token.email || "admin");
    return result;
  }
);

/**
 * Core extraction runner
 */
async function runExtraction(triggeredBy) {
  // Get analyzed turns that haven't been extracted yet
  const turnsSnap = await db
    .collection(COLLECTIONS.turns)
    .where("analysisStatus", "==", "analyzed")
    .limit(500)
    .get();

  if (turnsSnap.empty) {
    console.log("[VPIS-Extract] No analyzed turns to process.");
    return { success: true, extracted: 0, clustered: 0 };
  }

  const turns = turnsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Only process turns that have evaluations with errors or low scores
  // (optimization: skip clearly good answers)
  const turnsToExtract = [];
  for (const turn of turns) {
    const evalSnap = await db
      .collection(COLLECTIONS.evaluations)
      .where("turnId", "==", turn.id)
      .limit(1)
      .get();

    if (!evalSnap.empty) {
      const eval_ = evalSnap.docs[0].data();
      // Extract from: low score, has errors, or intent is bug/feature
      if (
        eval_.overallScore < 4.0 ||
        eval_.errorSeverity !== "none" ||
        eval_.detectedIntent === "bug_report" ||
        eval_.detectedIntent === "feature_request"
      ) {
        turnsToExtract.push(turn);
      }
    } else {
      // No evaluation - extract anyway
      turnsToExtract.push(turn);
    }
  }

  console.log(`[VPIS-Extract] ${turnsToExtract.length}/${turns.length} turns qualify for extraction.`);

  if (turnsToExtract.length === 0) {
    return { success: true, extracted: 0, clustered: 0 };
  }

  // Create job
  const jobRef = await db.collection(COLLECTIONS.jobs).add({
    jobType: "manual",
    targetDateFrom: new Date(Date.now() - 86400000).toISOString(),
    targetDateTo: new Date().toISOString(),
    status: "running",
    turnsProcessed: 0,
    turnsTotal: turnsToExtract.length,
    errorCount: 0,
    errorLog: [],
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: triggeredBy,
  });

  let totalExtracted = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < turnsToExtract.length; i += BATCH_SIZE) {
    const batch = turnsToExtract.slice(i, i + BATCH_SIZE);
    try {
      const count = await extractFromTurnBatch(batch, jobRef.id);
      totalExtracted += count;

      // Rate limit
      if (i + BATCH_SIZE < turnsToExtract.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`[VPIS-Extract] Batch failed:`, err.message);
    }
  }

  // Run clustering on newly extracted items
  let clustered = 0;
  try {
    clustered = await clusterNewItems();
  } catch (err) {
    console.error("[VPIS-Cluster] Clustering failed:", err.message);
  }

  await jobRef.update({
    status: "completed",
    turnsProcessed: turnsToExtract.length,
    completedAt: new Date().toISOString(),
  });

  console.log(`[VPIS-Extract] Complete: ${totalExtracted} items extracted, ${clustered} clustered.`);
  return { success: true, extracted: totalExtracted, clustered };
}

/**
 * Manual clustering trigger (for re-clustering).
 */
const vpisRecluster = onCall(
  { memory: "512MiB", timeoutSeconds: 300, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const clustered = await clusterNewItems();
    return { success: true, clustered };
  }
);

/**
 * Get extracted items with filters (admin use).
 */
const vpisGetExtractedItems = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { itemType, status, primaryCategory, clusterId, limitCount } = request.data || {};

    let q = db.collection(COLLECTIONS.items);
    if (itemType) q = q.where("itemType", "==", itemType);
    if (status) q = q.where("status", "==", status);
    if (primaryCategory) q = q.where("primaryCategory", "==", primaryCategory);
    if (clusterId) q = q.where("clusterId", "==", clusterId);
    q = q.limit(limitCount || 50);

    const snap = await q.get();
    return {
      items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

/**
 * Get issue clusters with filters (admin use).
 */
const vpisGetClusters = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { status, itemType, limitCount } = request.data || {};

    let q = db.collection(COLLECTIONS.clusters);
    if (status) q = q.where("status", "==", status);
    if (itemType) q = q.where("itemType", "==", itemType);
    q = q.limit(limitCount || 50);

    const snap = await q.get();
    return {
      clusters: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

/**
 * Update an extracted item status (admin decision).
 */
const vpisUpdateItemStatus = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { itemId, status, linkedAction, reviewNote } = request.data;
    if (!itemId || !status) {
      throw new HttpsError("invalid-argument", "itemId and status required.");
    }

    const validStatuses = [
      "new", "reviewing", "accepted", "rejected",
      "planned", "in_progress", "shipped", "closed", "duplicate",
    ];
    if (!validStatuses.includes(status)) {
      throw new HttpsError("invalid-argument", `Invalid status: ${status}`);
    }

    const updates = {
      status,
      reviewedBy: request.auth.token.email || "admin",
      reviewedAt: new Date().toISOString(),
    };
    if (linkedAction) updates.linkedAction = linkedAction;
    if (reviewNote) updates.reviewNote = reviewNote;

    await db.collection(COLLECTIONS.items).doc(itemId).update(updates);
    return { success: true };
  }
);

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  vpisExtractItems,
  vpisManualExtract,
  vpisRecluster,
  vpisGetExtractedItems,
  vpisGetClusters,
  vpisUpdateItemStatus,
};
