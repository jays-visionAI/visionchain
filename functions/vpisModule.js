/**
 * VPIS Cloud Functions Module
 *
 * Provides the following Cloud Functions:
 * - vpisIngestConversations: Daily batch ingestion of conversations -> turns
 * - vpisSnapshotCatalog: Create feature catalog snapshot
 * - vpisManualIngest: Admin-triggered re-ingestion for date range
 * - vpisGetDashboardData: Fetch aggregated dashboard data
 *
 * Usage: Import and spread into the main exports in functions/index.js
 *   const vpis = require("./vpisModule");
 *   module.exports = { ...vpis, ...otherFunctions };
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Ensure admin is initialized (may already be in index.js)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ── Constants ──────────────────────────────────────────────────────────────

const COLLECTIONS = {
  conversations: "conversations",
  turns: "vpis_conversation_turns",
  catalog: "vpis_feature_catalog",
  jobs: "vpis_analysis_jobs",
  evaluations: "vpis_answer_evaluations",
  reports: "vpis_daily_reports",
  items: "vpis_extracted_items",
  clusters: "vpis_issue_clusters",
  actions: "vpis_actions",
};

// ── PII Masking ────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  { regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g, replacement: "[PHONE]" },
  { regex: /01[0-9]-?\d{3,4}-?\d{4}/g, replacement: "[PHONE]" },
  { regex: /0x[a-fA-F0-9]{40}/g, replacement: "[WALLET_ADDR]" },
  { regex: /vcn_[a-zA-Z0-9]{20,}/g, replacement: "[API_KEY]" },
];

/**
 * Mask PII from text
 * @param {string} text - Input text
 * @return {string} Masked text
 */
function maskPII(text) {
  let masked = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    masked = masked.replace(new RegExp(regex.source, regex.flags), replacement);
  }
  return masked;
}

// ── Language Detection ─────────────────────────────────────────────────────

/**
 * Detect primary language of text
 * @param {string} text - Input text
 * @return {string} ISO language code
 */
function detectLocale(text) {
  const clean = text.replace(/[\s\d]/g, "").replace(/[^\p{L}]/gu, "");
  if (clean.length < 2) return "en";

  const korean = (clean.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) || []).length;
  const total = clean.length;

  if (total === 0) return "en";
  if (korean / total > 0.3) return "ko";
  return "en";
}

// ── Tool Detection ─────────────────────────────────────────────────────────

const TOOL_PATTERNS = [
  { name: "get_current_price", pattern: /current price|실시간 가격|현재 가격/i },
  { name: "get_historical_price", pattern: /historical price|과거 가격/i },
  { name: "get_chart_data", pattern: /chart data|차트/i },
  { name: "get_trending_coins", pattern: /trending|인기|트렌딩/i },
  { name: "get_global_market", pattern: /global market|시장 전체/i },
  { name: "search_defi_pools", pattern: /defi pool|DeFi|디파이/i },
  { name: "search_user_contacts", pattern: /contact|연락처/i },
  { name: "get_cex_portfolio", pattern: /portfolio|포트폴리오|거래소/i },
  { name: "create_agent", pattern: /agent.*creat|에이전트.*생성/i },
  { name: "search_market_news", pattern: /market news|시장 뉴스/i },
  { name: "list_user_disk_files", pattern: /disk file|디스크|파일 목록/i },
  { name: "share_disk_file", pattern: /share file|파일 공유/i },
];

/**
 * Detect which AI tools were likely invoked
 * @param {string} assistantMsg - Assistant's response
 * @return {string[]} Tool names
 */
function detectToolsInvoked(assistantMsg) {
  const tools = [];
  for (const { name, pattern } of TOOL_PATTERNS) {
    if (pattern.test(assistantMsg)) {
      tools.push(name);
    }
  }
  return tools;
}

// ── Feature Detection ──────────────────────────────────────────────────────

const FEATURE_KEYWORDS = {
  wallet_send: ["send", "보내", "전송", "transfer"],
  wallet_receive: ["receive", "받기", "수신"],
  bridge: ["bridge", "브릿지", "크로스체인"],
  staking: ["staking", "스테이킹", "validator"],
  disk: ["disk", "디스크", "파일", "file", "upload"],
  ai_chatbot: ["chatbot", "챗봇", "AI", "assistant"],
  quant_engine: ["quant", "퀀트", "strategy", "전략"],
  cex_portfolio: ["portfolio", "포트폴리오", "upbit", "bithumb"],
  game_center: ["game", "게임", "play", "spin"],
  vision_market: ["market", "마켓", "price", "가격"],
  vision_insight: ["insight", "인사이트", "news", "뉴스"],
  agent_gateway: ["agent", "에이전트", "api key"],
  mint_studio: ["mint", "NFT", "민팅"],
  vision_scan: ["scan", "explorer", "탐색기"],
};

/**
 * Estimate which feature a conversation is about
 * @param {string} userMsg - User's message
 * @return {string|undefined} Feature name
 */
function detectRelatedFeature(userMsg) {
  const lower = userMsg.toLowerCase();
  let bestMatch = undefined;
  let bestScore = 0;

  for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = feature;
    }
  }
  return bestMatch;
}

// ── User Reaction Detection ────────────────────────────────────────────────

/**
 * Detect user reaction based on conversation flow
 * @param {number} turnIndex - Current turn index
 * @param {number} totalTurns - Total turns in conversation
 * @param {string} nextUserMsg - Next user message (if exists)
 * @return {string} Reaction type
 */
function detectUserReaction(turnIndex, totalTurns, nextUserMsg) {
  if (turnIndex === totalTurns - 1) {
    // Last turn - could be satisfied or abandoned
    return "satisfied";
  }

  if (nextUserMsg) {
    const lower = nextUserMsg.toLowerCase();
    // Check for dissatisfaction signals
    const frustrationPatterns = [
      /안돼|안되|못해|아니|다시|그게 아니/,
      /doesn't work|not working|wrong|no|again|that's not/i,
      /왜|어떻게|뭐|이상한/,
      /why|how|what|weird|broken/i,
    ];

    if (frustrationPatterns.some((p) => p.test(lower))) {
      return "followup";
    }
    return "followup";
  }

  return "satisfied";
}

// ═══════════════════════════════════════════════════════════════════════════
// Cloud Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Daily scheduled ingestion of conversations into normalized turns.
 * Runs at 04:00 UTC every day.
 */
const vpisIngestConversations = onSchedule(
  {
    schedule: "0 4 * * *",
    timeZone: "UTC",
    memory: "512MiB",
    timeoutSeconds: 540,
    region: "us-central1",
  },
  async () => {
    console.log("[VPIS] Starting daily conversation ingestion...");

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    await ingestConversationsForRange(
      yesterday.toISOString(),
      todayStart.toISOString(),
      "system"
    );
  }
);

/**
 * Admin-triggered manual ingestion for a specific date range.
 */
const vpisManualIngest = onCall(
  { memory: "512MiB", timeoutSeconds: 540, region: "us-central1" },
  async (request) => {
    // Verify admin
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { dateFrom, dateTo } = request.data;
    if (!dateFrom || !dateTo) {
      throw new HttpsError("invalid-argument", "dateFrom and dateTo required.");
    }

    const jobId = await ingestConversationsForRange(
      dateFrom,
      dateTo,
      request.auth.token.email || "admin"
    );

    return { success: true, jobId };
  }
);

/**
 * Core ingestion logic: process conversations in date range.
 * @param {string} dateFrom - Start date ISO
 * @param {string} dateTo - End date ISO
 * @param {string} createdBy - Who triggered the job
 * @return {string} Job ID
 */
async function ingestConversationsForRange(dateFrom, dateTo, createdBy) {
  // Create analysis job
  const jobRef = await db.collection(COLLECTIONS.jobs).add({
    jobType: "daily_audit",
    targetDateFrom: dateFrom,
    targetDateTo: dateTo,
    status: "running",
    turnsProcessed: 0,
    turnsTotal: 0,
    errorCount: 0,
    errorLog: [],
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: createdBy,
  });

  const jobId = jobRef.id;
  let turnsProcessed = 0;
  let turnsTotal = 0;
  let errorCount = 0;
  const errorLog = [];

  try {
    // Query conversations updated in the date range
    const convSnapshot = await db
      .collection(COLLECTIONS.conversations)
      .where("updatedAt", ">=", dateFrom)
      .where("updatedAt", "<", dateTo)
      .get();

    if (convSnapshot.empty) {
      // Also try createdAt for conversations that were never updated
      const convSnapshot2 = await db
        .collection(COLLECTIONS.conversations)
        .where("createdAt", ">=", dateFrom)
        .where("createdAt", "<", dateTo)
        .get();

      if (convSnapshot2.empty) {
        console.log("[VPIS] No conversations found for date range.");
        await jobRef.update({
          status: "completed",
          completedAt: new Date().toISOString(),
        });
        return jobId;
      }

      // Process these conversations
      turnsTotal = await processConversations(convSnapshot2, jobId);
    } else {
      turnsTotal = await processConversations(convSnapshot, jobId);
    }

    turnsProcessed = turnsTotal;

    await jobRef.update({
      status: "completed",
      turnsProcessed,
      turnsTotal,
      errorCount,
      completedAt: new Date().toISOString(),
    });

    console.log(`[VPIS] Ingestion complete: ${turnsProcessed}/${turnsTotal} turns.`);
  } catch (error) {
    console.error("[VPIS] Ingestion failed:", error);
    errorCount++;
    errorLog.push(error.message || String(error));

    await jobRef.update({
      status: "failed",
      errorCount,
      errorLog,
      completedAt: new Date().toISOString(),
    });
  }

  return jobId;
}

/**
 * Process a batch of conversations into normalized turns.
 * @param {FirebaseFirestore.QuerySnapshot} convSnapshot - Conversations
 * @param {string} jobId - Analysis job ID
 * @return {number} Total turns processed
 */
async function processConversations(convSnapshot, jobId) {
  let totalTurns = 0;
  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH = 450; // Firestore batch limit is 500

  for (const convDoc of convSnapshot.docs) {
    const conv = convDoc.data();
    const messages = conv.messages || [];

    // Pair user-assistant messages into turns
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      const nextMsg = messages[i + 1];

      if (msg.role === "user" && nextMsg.role === "assistant") {
        const turnIndex = Math.floor(i / 2);
        const userMsg = msg.text || "";
        const assistantMsg = nextMsg.text || "";

        // Detect next user message for reaction analysis
        const nextUserMsg =
          i + 2 < messages.length && messages[i + 2].role === "user"
            ? messages[i + 2].text
            : null;

        const totalConvTurns = Math.floor(messages.length / 2);

        const turnRef = db.collection(COLLECTIONS.turns).doc();
        batch.set(turnRef, {
          conversationId: convDoc.id,
          userId: conv.userId || "",
          turnIndex: turnIndex,
          userMessage: maskPII(userMsg),
          assistantMessage: maskPII(assistantMsg),
          timestamp: msg.timestamp || conv.createdAt || new Date().toISOString(),
          botType: conv.botType || "helpdesk",
          channel: "web",
          locale: detectLocale(userMsg),
          detectedIntent: null, // Will be filled in Phase 2
          toolsInvoked: detectToolsInvoked(assistantMsg),
          relatedFeature: detectRelatedFeature(userMsg),
          userReaction: detectUserReaction(turnIndex, totalConvTurns, nextUserMsg),
          analysisStatus: "pending",
          analysisJobId: jobId,
          piiMasked: true,
          createdAt: new Date().toISOString(),
        });

        batchCount++;
        totalTurns++;

        // Commit batch if approaching limit
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  return totalTurns;
}

/**
 * Create a feature catalog snapshot (admin-triggered).
 */
const vpisSnapshotCatalog = onCall(
  { memory: "256MiB", timeoutSeconds: 60, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { features, policies, releaseVersion } = request.data;

    if (!features || !Array.isArray(features)) {
      throw new HttpsError("invalid-argument", "features array required.");
    }

    const now = new Date();
    const version = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;

    const docRef = await db.collection(COLLECTIONS.catalog).add({
      version,
      snapshotDate: now.toISOString(),
      features,
      policies: policies || [],
      releaseVersion: releaseVersion || "current",
      createdAt: now.toISOString(),
    });

    return { success: true, snapshotId: docRef.id, version };
  }
);

/**
 * Fetch aggregated dashboard data for the admin UI.
 */
const vpisGetDashboardData = onCall(
  { memory: "256MiB", timeoutSeconds: 30, region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { type, dateRange, filters } = request.data;

    switch (type) {
      case "summary": {
        // Get latest daily report
        const reportsSnap = await db
          .collection(COLLECTIONS.reports)
          .orderBy("reportDate", "desc")
          .limit(7)
          .get();

        return {
          reports: reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        };
      }

      case "jobs": {
        const jobsSnap = await db
          .collection(COLLECTIONS.jobs)
          .orderBy("createdAt", "desc")
          .limit(20)
          .get();

        return {
          jobs: jobsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        };
      }

      case "clusters": {
        let q = db.collection(COLLECTIONS.clusters);
        if (filters?.status) {
          q = q.where("status", "==", filters.status);
        }
        const clustersSnap = await q.limit(50).get();

        return {
          clusters: clustersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        };
      }

      default:
        throw new HttpsError("invalid-argument", `Unknown type: ${type}`);
    }
  }
);

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  vpisIngestConversations,
  vpisManualIngest,
  vpisSnapshotCatalog,
  vpisGetDashboardData,
};
