/**
 * VPIS Action Drafter Module - Phase 5
 *
 * Decision workflow + LLM-based action draft generation.
 * Generates actionable drafts from extracted items and clusters:
 *   - backlog_item: Feature request → product backlog entry
 *   - bug_ticket: Bug report → structured bug ticket
 *   - faq_draft: Frequent question → FAQ entry
 *   - doc_update: Missing/outdated docs → documentation update
 *   - prompt_fix: Chatbot error → system prompt patch
 *   - release_note: Shipped feature → release note draft
 *
 * All drafts require admin approval before any action is taken.
 *
 * Usage: Import and spread into functions/index.js
 *   const vpisActions = require("./vpisActionDrafter");
 *   Object.assign(exports, vpisActions);
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const COLLECTIONS = {
  items: "vpis_extracted_items",
  clusters: "vpis_issue_clusters",
  evaluations: "vpis_answer_evaluations",
  turns: "vpis_conversation_turns",
  actions: "vpis_actions",
  reports: "vpis_daily_reports",
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

async function callLLMForJSON(systemPrompt, userPrompt, modelName = "gemini-2.5-flash") {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: modelName,
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
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    console.error("[VPIS-Action] Failed to parse JSON:", text.substring(0, 300));
    throw new Error("LLM returned non-JSON response");
  }
}

async function callLLMForText(systemPrompt, userPrompt, modelName = "gemini-2.5-flash") {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
    },
  });

  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

// ── Draft Generation Prompts ───────────────────────────────────────────────

const DRAFT_SYSTEM_PROMPT = `You are a product operations assistant for VisionChain, a blockchain wallet and DeFi platform.

Your role is to generate actionable drafts from analyzed user feedback. These drafts will be reviewed by an admin before any action is taken.

IMPORTANT RULES:
1. Write in English with clear, professional language
2. Focus on actionable, specific content
3. Include relevant data points (user count, frequency, severity)
4. For code/prompt changes, provide exact before/after suggestions
5. Keep titles concise but descriptive
6. Body should be in markdown format

OUTPUT FORMAT (JSON):
{
  "title": "Concise, actionable title",
  "body": "Detailed markdown body with sections",
  "metadata": {
    "priority": "P1|P2|P3|P4",
    "category": "string",
    "estimatedEffort": "small|medium|large",
    "impactedFeatures": ["feature1", "feature2"],
    "userImpact": "high|medium|low"
  }
}`;

function buildDraftPrompt(actionType, sourceData) {
  const templates = {
    backlog_item: `Generate a product backlog item (user story format) from this feature request data:

SOURCE DATA:
${JSON.stringify(sourceData, null, 2)}

REQUIREMENTS:
- Title: "[VPIS] {clear feature description}"
- Body must include:
  - User Story: "As a [user type], I want [goal], so that [reason]"
  - Pain Point summary from user conversations
  - Acceptance Criteria (3-5 specific, testable items)
  - Related Features/Dependencies
  - Frequency: how many users requested this
  - Priority recommendation with justification`,

    bug_ticket: `Generate a structured bug ticket from this bug report data:

SOURCE DATA:
${JSON.stringify(sourceData, null, 2)}

REQUIREMENTS:
- Title: "[BUG-VPIS] {clear bug description}"
- Body must include:
  - Summary
  - Steps to Reproduce (inferred from user conversations)
  - Expected Behavior
  - Observed Behavior
  - Severity Assessment (Critical/High/Medium/Low)
  - Affected Flow/Feature
  - User Count (how many users reported this)
  - Root Cause Candidate (if available)
  - Suggested Fix Direction`,

    faq_draft: `Generate a FAQ entry from this frequently asked question data:

SOURCE DATA:
${JSON.stringify(sourceData, null, 2)}

REQUIREMENTS:
- Title: Clear question that users would search for
- Body must include:
  - Question (in both Korean and English)
  - Answer (clear, step-by-step, in both Korean and English)
  - Related Features
  - Screenshot/UI path hints
  - Common Follow-up Questions`,

    doc_update: `Generate a documentation update draft from this data:

SOURCE DATA:
${JSON.stringify(sourceData, null, 2)}

REQUIREMENTS:
- Title: "[DOC] {what needs to be updated}"
- Body must include:
  - Current Documentation Issue
  - Suggested Update (exact text)
  - Affected Documentation Page/Section
  - Reason for Update
  - User Impact if not updated`,

    prompt_fix: `Generate a chatbot system prompt improvement from this error pattern data:

SOURCE DATA:
${JSON.stringify(sourceData, null, 2)}

REQUIREMENTS:
- Title: "[PROMPT] Fix: {error pattern description}"
- Body must include:
  - Current Error Pattern (with examples)
  - Root Cause Analysis
  - Suggested System Prompt Addition (exact text to add)
  - Expected Impact
  - Test Cases (3+ example queries and expected responses)
  - Rollback Plan`,

    release_note: `Generate a release note item from this shipped feature/fix data:

SOURCE DATA:
${JSON.stringify(sourceData, null, 2)}

REQUIREMENTS:
- Title: Brief user-facing description
- Body must include:
  - What Changed (1-2 sentences, user-friendly)
  - Why (user pain point that prompted this)
  - How to Use (if applicable)
  - Before/After comparison`,
  };

  return templates[actionType] || templates.backlog_item;
}

// ── Core Draft Generation ──────────────────────────────────────────────────

/**
 * Generate action draft for a single extracted item
 */
async function generateDraftForItem(item, actionType) {
  // Enrich with turn data if available
  let turnData = null;
  if (item.turnId) {
    try {
      const turnSnap = await db.collection(COLLECTIONS.turns).doc(item.turnId).get();
      if (turnSnap.exists) {
        const t = turnSnap.data();
        turnData = {
          userMessage: (t.userMessage || "").substring(0, 500),
          assistantMessage: (t.assistantMessage || "").substring(0, 500),
          locale: t.locale,
        };
      }
    } catch {/* ignore */}
  }

  // Enrich with cluster data if assigned
  let clusterData = null;
  if (item.clusterId) {
    try {
      const clusterSnap = await db.collection(COLLECTIONS.clusters).doc(item.clusterId).get();
      if (clusterSnap.exists) {
        const c = clusterSnap.data();
        clusterData = {
          clusterTitle: c.clusterTitle,
          memberCount: c.memberCount,
          priorityScore: c.priorityScore,
          tags: c.tags,
          relatedFeatures: c.relatedFeatures,
        };
      }
    } catch {/* ignore */}
  }

  // Enrich with evaluation data
  let evalData = null;
  if (item.turnId) {
    try {
      const evalSnap = await db.collection(COLLECTIONS.evaluations)
        .where("turnId", "==", item.turnId)
        .limit(1)
        .get();
      if (!evalSnap.empty) {
        const e = evalSnap.docs[0].data();
        evalData = {
          overallScore: e.overallScore,
          errorTypes: e.errorTypes,
          errorSeverity: e.errorSeverity,
          detectedIntent: e.detectedIntent,
        };
      }
    } catch {/* ignore */}
  }

  const sourceData = {
    item: {
      normalizedSummary: item.normalizedSummary,
      itemType: item.itemType,
      primaryCategory: item.primaryCategory,
      subcategory: item.subcategory,
      painPoint: item.painPoint,
      expectedBehavior: item.expectedBehavior,
      observedBehavior: item.observedBehavior,
      requestedOutcome: item.requestedOutcome,
      rootCauseCandidate: item.rootCauseCandidate,
      fixedTags: item.fixedTags,
      priorityScore: item.priorityScore,
      confidence: item.confidence,
      signalType: item.signalType,
    },
    conversation: turnData,
    cluster: clusterData,
    evaluation: evalData,
  };

  const userPrompt = buildDraftPrompt(actionType, sourceData);
  const draft = await callLLMForJSON(DRAFT_SYSTEM_PROMPT, userPrompt);

  return {
    sourceType: "extracted_item",
    sourceId: item.id,
    actionType,
    draftContent: {
      title: draft.title || `[VPIS] ${item.normalizedSummary}`,
      body: draft.body || "",
      metadata: draft.metadata || {},
    },
    status: "draft",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate action draft for a cluster (aggregated)
 */
async function generateDraftForCluster(cluster, actionType) {
  // Get top member items
  const membersSnap = await db.collection(COLLECTIONS.items)
    .where("clusterId", "==", cluster.id)
    .limit(10)
    .get();

  const memberSummaries = membersSnap.docs.map((d) => {
    const data = d.data();
    return {
      summary: data.normalizedSummary,
      painPoint: data.painPoint,
      category: data.primaryCategory,
      priority: data.priorityScore,
    };
  });

  const sourceData = {
    cluster: {
      clusterTitle: cluster.clusterTitle,
      representativeSummary: cluster.representativeSummary,
      itemType: cluster.itemType,
      memberCount: cluster.memberCount,
      priorityScore: cluster.priorityScore,
      tags: cluster.tags,
      relatedFeatures: cluster.relatedFeatures,
      trendScore: cluster.trendScore,
      firstSeenDate: cluster.firstSeenDate,
      lastSeenDate: cluster.lastSeenDate,
    },
    topMembers: memberSummaries,
  };

  const userPrompt = buildDraftPrompt(actionType, sourceData);
  const draft = await callLLMForJSON(DRAFT_SYSTEM_PROMPT, userPrompt);

  return {
    sourceType: "cluster",
    sourceId: cluster.id,
    actionType,
    draftContent: {
      title: draft.title || `[VPIS] ${cluster.clusterTitle}`,
      body: draft.body || "",
      metadata: {
        ...(draft.metadata || {}),
        memberCount: String(cluster.memberCount),
        priorityScore: String(cluster.priorityScore),
      },
    },
    status: "draft",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Auto-determine action type based on item/cluster type
 */
function inferActionType(itemOrCluster) {
  const type = itemOrCluster.itemType || "bug_report";
  switch (type) {
    case "bug_report": return "bug_ticket";
    case "feature_request": return "backlog_item";
    case "ux_improvement": return "backlog_item";
    case "doc_request": return "doc_update";
    case "admin_request": return "backlog_item";
    default: return "backlog_item";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cloud Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Auto-generate drafts for high-priority accepted items.
 * Runs daily after extraction (05:30 UTC).
 */
const vpisGenerateDrafts = onSchedule(
  {
    schedule: "30 5 * * *",
    timeZone: "UTC",
    memory: "1GiB",
    timeoutSeconds: 540,
    region: "us-central1",
  },
  async () => {
    console.log("[VPIS-Action] Starting auto draft generation...");
    await runDraftGeneration("system");
  }
);

/**
 * Core draft generation runner.
 * Targets: accepted items and high-priority clusters without existing drafts.
 */
async function runDraftGeneration(triggeredBy) {
  let generated = 0;

  // 1. Generate drafts for accepted items without actions
  const acceptedSnap = await db.collection(COLLECTIONS.items)
    .where("status", "==", "accepted")
    .limit(30)
    .get();

  for (const doc_ of acceptedSnap.docs) {
    const item = { id: doc_.id, ...doc_.data() };

    // Check if draft already exists for this item
    const existingSnap = await db.collection(COLLECTIONS.actions)
      .where("sourceId", "==", item.id)
      .where("sourceType", "==", "extracted_item")
      .limit(1)
      .get();

    if (!existingSnap.empty) continue;

    try {
      const actionType = inferActionType(item);
      const draft = await generateDraftForItem(item, actionType);
      await db.collection(COLLECTIONS.actions).add(draft);
      generated++;

      // Rate limit
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[VPIS-Action] Draft failed for item ${item.id}:`, err.message);
    }
  }

  // 2. Generate drafts for high-priority clusters without actions
  const clustersSnap = await db.collection(COLLECTIONS.clusters)
    .where("status", "==", "active")
    .limit(20)
    .get();

  for (const doc_ of clustersSnap.docs) {
    const cluster = { id: doc_.id, ...doc_.data() };
    if ((cluster.priorityScore || 0) < 40) continue;
    if ((cluster.memberCount || 0) < 3) continue;

    // Check if draft already exists
    const existingSnap = await db.collection(COLLECTIONS.actions)
      .where("sourceId", "==", cluster.id)
      .where("sourceType", "==", "cluster")
      .limit(1)
      .get();

    if (!existingSnap.empty) continue;

    try {
      const actionType = inferActionType(cluster);
      const draft = await generateDraftForCluster(cluster, actionType);
      await db.collection(COLLECTIONS.actions).add(draft);
      generated++;

      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[VPIS-Action] Draft failed for cluster ${cluster.id}:`, err.message);
    }
  }

  // 3. Auto-generate prompt_fix drafts for recurring error patterns
  const reportsSnap = await db.collection(COLLECTIONS.reports)
    .orderBy("reportDate", "desc")
    .limit(1)
    .get();

  if (!reportsSnap.empty) {
    const latestReport = reportsSnap.docs[0].data();
    const patterns = latestReport.repeatedErrorPatterns || [];

    for (const pattern of patterns) {
      if (pattern.count < 5) continue;

      // Check if prompt_fix already exists for this error type
      const existingSnap = await db.collection(COLLECTIONS.actions)
        .where("actionType", "==", "prompt_fix")
        .where("status", "in", ["draft", "reviewed", "approved"])
        .limit(1)
        .get();

      // Simple check: if any prompt_fix exists, skip
      if (!existingSnap.empty) continue;

      try {
        // Get example turns for this error
        const exampleTurns = [];
        for (const turnId of (pattern.exampleTurnIds || []).slice(0, 3)) {
          const turnSnap = await db.collection(COLLECTIONS.turns).doc(turnId).get();
          if (turnSnap.exists) {
            const t = turnSnap.data();
            exampleTurns.push({
              userMessage: (t.userMessage || "").substring(0, 300),
              assistantMessage: (t.assistantMessage || "").substring(0, 300),
            });
          }
        }

        const sourceData = {
          errorType: pattern.errorType,
          occurrenceCount: pattern.count,
          exampleConversations: exampleTurns,
        };

        const userPrompt = buildDraftPrompt("prompt_fix", sourceData);
        const draft = await callLLMForJSON(DRAFT_SYSTEM_PROMPT, userPrompt);

        await db.collection(COLLECTIONS.actions).add({
          sourceType: "evaluation",
          sourceId: `error_pattern_${pattern.errorType}`,
          actionType: "prompt_fix",
          draftContent: {
            title: draft.title || `[PROMPT] Fix: ${pattern.errorType}`,
            body: draft.body || "",
            metadata: {
              ...(draft.metadata || {}),
              errorType: pattern.errorType,
              occurrenceCount: String(pattern.count),
            },
          },
          status: "draft",
          createdAt: new Date().toISOString(),
        });
        generated++;
      } catch (err) {
        console.error(`[VPIS-Action] Prompt fix draft failed:`, err.message);
      }
    }
  }

  console.log(`[VPIS-Action] Generated ${generated} drafts.`);
  return { success: true, generated };
}

/**
 * Admin: Manually generate a draft for a specific item or cluster.
 */
const vpisCreateDraft = onCall(
  { memory: "512MiB", timeoutSeconds: 120, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { sourceType, sourceId, actionType } = request.data;
    if (!sourceType || !sourceId) {
      throw new HttpsError("invalid-argument", "sourceType and sourceId required.");
    }

    let draft;

    if (sourceType === "extracted_item") {
      const itemSnap = await db.collection(COLLECTIONS.items).doc(sourceId).get();
      if (!itemSnap.exists) throw new HttpsError("not-found", "Item not found.");
      const item = { id: itemSnap.id, ...itemSnap.data() };
      const type = actionType || inferActionType(item);
      draft = await generateDraftForItem(item, type);
    } else if (sourceType === "cluster") {
      const clusterSnap = await db.collection(COLLECTIONS.clusters).doc(sourceId).get();
      if (!clusterSnap.exists) throw new HttpsError("not-found", "Cluster not found.");
      const cluster = { id: clusterSnap.id, ...clusterSnap.data() };
      const type = actionType || inferActionType(cluster);
      draft = await generateDraftForCluster(cluster, type);
    } else {
      throw new HttpsError("invalid-argument", "sourceType must be extracted_item or cluster.");
    }

    draft.createdBy = request.auth.token.email || "admin";
    const ref = await db.collection(COLLECTIONS.actions).add(draft);
    return { success: true, actionId: ref.id, draft: draft.draftContent };
  }
);

/**
 * Admin: Review and update an action draft.
 */
const vpisReviewAction = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { actionId, status, reviewNote, editedContent } = request.data;
    if (!actionId || !status) {
      throw new HttpsError("invalid-argument", "actionId and status required.");
    }

    const validStatuses = ["draft", "reviewed", "approved", "applied", "rejected"];
    if (!validStatuses.includes(status)) {
      throw new HttpsError("invalid-argument", `Invalid status: ${status}`);
    }

    const actionRef = db.collection(COLLECTIONS.actions).doc(actionId);
    const actionSnap = await actionRef.get();
    if (!actionSnap.exists) throw new HttpsError("not-found", "Action not found.");

    const updates = {
      status,
      reviewedBy: request.auth.token.email || "admin",
      reviewedAt: new Date().toISOString(),
    };

    if (reviewNote) updates.reviewNote = reviewNote;
    if (editedContent) {
      // Allow admin to edit the draft content before approving
      updates.draftContent = editedContent;
    }
    if (status === "applied") {
      updates.appliedAt = new Date().toISOString();
    }

    await actionRef.update(updates);

    // If approved/applied, update the source item status
    const actionData = actionSnap.data();
    if (status === "approved" || status === "applied") {
      if (actionData.sourceType === "extracted_item") {
        try {
          await db.collection(COLLECTIONS.items).doc(actionData.sourceId).update({
            status: status === "applied" ? "shipped" : "planned",
            linkedAction: actionId,
          });
        } catch {/* source might not exist */}
      } else if (actionData.sourceType === "cluster") {
        try {
          await db.collection(COLLECTIONS.clusters).doc(actionData.sourceId).update({
            status: status === "applied" ? "resolved" : "active",
          });
        } catch {/* source might not exist */}
      }
    }

    return { success: true };
  }
);

/**
 * Admin: Get action drafts with filters.
 */
const vpisGetActions = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { status, actionType, sourceType, limitCount } = request.data || {};

    let q = db.collection(COLLECTIONS.actions).orderBy("createdAt", "desc");
    if (status) q = q.where("status", "==", status);
    if (actionType) q = q.where("actionType", "==", actionType);
    if (sourceType) q = q.where("sourceType", "==", sourceType);
    q = q.limit(limitCount || 50);

    const snap = await q.get();
    return {
      actions: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

/**
 * Admin: Delete an action draft.
 */
const vpisDeleteAction = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { actionId } = request.data;
    if (!actionId) throw new HttpsError("invalid-argument", "actionId required.");

    await db.collection(COLLECTIONS.actions).doc(actionId).delete();
    return { success: true };
  }
);

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  vpisGenerateDrafts,
  vpisCreateDraft,
  vpisReviewAction,
  vpisGetActions,
  vpisDeleteAction,
};
