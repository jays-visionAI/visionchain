/**
 * Vision Product Intelligence System (VPIS) - Type Definitions
 *
 * Core schemas for conversation analysis, answer evaluation,
 * bug/feature extraction, clustering, and admin decision workflows.
 */

// ── Intent Categories ──────────────────────────────────────────────────────

export type IntentCategory =
  | 'feature_existence'
  | 'usage_help'
  | 'error_resolution'
  | 'account_security'
  | 'portfolio_trading'
  | 'policy_permissions'
  | 'feature_request'
  | 'bug_report'
  | 'general_exploration'
  | 'other';

// ── Error Types ────────────────────────────────────────────────────────────

export type AnswerErrorType =
  | 'nonexistent_feature_claim'
  | 'missing_required_step'
  | 'outdated_ui_reference'
  | 'vague_answer'
  | 'hallucinated_policy'
  | 'incomplete_resolution'
  | 'wrong_capability_boundary'
  | 'language_mismatch';

// ── Fixed Taxonomy Tags ────────────────────────────────────────────────────

export type FixedTag =
  | 'wallet' | 'bridge' | 'trading' | 'portfolio' | 'chatbot'
  | 'admin' | 'reporting' | 'docs' | 'permissions' | 'performance'
  | 'ui' | 'transaction' | 'onboarding' | 'quant' | 'disk'
  | 'game_center' | 'staking' | 'agent' | 'market' | 'notification';

// ── Phase 1: Data Collection ───────────────────────────────────────────────

export interface ConversationTurn {
  id: string;
  conversationId: string;
  userId: string;
  turnIndex: number;
  userMessage: string;
  assistantMessage: string;
  timestamp: string;
  botType: 'intent' | 'helpdesk';
  channel: 'web' | 'mobile' | 'api';
  locale: string;

  // Enrichment
  detectedIntent?: IntentCategory;
  toolsInvoked?: string[];
  relatedFeature?: string;
  userReaction?: 'followup' | 'satisfied' | 'abandoned' | 'escalated';

  // Analysis status
  analysisStatus: 'pending' | 'analyzed' | 'failed';
  analysisJobId?: string;

  piiMasked: boolean;
  createdAt: string;
}

export interface FeatureCatalogEntry {
  name: string;
  status: 'live' | 'beta' | 'hidden' | 'deprecated';
  uiPath: string;
  description: string;
  permissions: string[];
  relatedFaqIds: string[];
}

export interface PolicyEntry {
  name: string;
  content: string;
  version: string;
}

export interface FeatureCatalogSnapshot {
  id: string;
  version: string;
  snapshotDate: string;
  features: FeatureCatalogEntry[];
  policies: PolicyEntry[];
  releaseVersion: string;
  createdAt: string;
}

export interface AnalysisJob {
  id: string;
  jobType: 'daily_audit' | 'reanalysis' | 'manual';
  targetDateFrom: string;
  targetDateTo: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  turnsProcessed: number;
  turnsTotal: number;
  errorCount: number;
  errorLog: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  createdBy: string;
}

// ── Phase 2: Answer Evaluation ─────────────────────────────────────────────

export interface QualityScores {
  intentMatch: number;
  relevance: number;
  specificity: number;
  clarity: number;
  actionability: number;
  completionQuality: number;
}

export interface FeatureAccuracy {
  featureAccuracy: number;
  policyAccuracy: number;
  uiFlowAccuracy: number;
  overclaimRisk: boolean;
  outdatedKnowledgeRisk: boolean;
}

export interface AnswerEvaluation {
  id: string;
  turnId: string;
  conversationId: string;
  jobId: string;

  detectedIntent: IntentCategory;
  intentConfidence: number;

  scores: QualityScores;
  overallScore: number;

  featureAccuracy: FeatureAccuracy;

  errorTypes: AnswerErrorType[];
  errorSeverity: 'none' | 'low' | 'medium' | 'high' | 'critical';

  evaluatorModel: string;
  evaluationPromptVersion: string;
  rawEvaluationResponse: string;

  createdAt: string;
}

export interface DailyReportSummary {
  totalConversations: number;
  totalTurns: number;
  overallAvgScore: number;
  intentMatchAvg: number;
  featureAccuracyAvg: number;
  errorRate: number;
  criticalErrorCount: number;
  highSeverityCount: number;
}

export interface DailyReport {
  id: string;
  reportDate: string;
  jobId: string;

  summary: DailyReportSummary;

  scoresByCategory: Record<IntentCategory, {
    count: number;
    avgScore: number;
    errorRate: number;
  }>;

  topFailedAnswers: {
    turnId: string;
    userMessage: string;
    score: number;
    errorTypes: string[];
  }[];

  repeatedErrorPatterns: {
    errorType: string;
    count: number;
    exampleTurnIds: string[];
  }[];

  createdAt: string;
}

// ── Phase 3: Bug/Feature Extraction ────────────────────────────────────────

export type ExtractedItemType =
  | 'bug_report'
  | 'feature_request'
  | 'ux_improvement'
  | 'doc_request'
  | 'admin_request';

export type ItemWorkflowStatus =
  | 'new' | 'reviewing' | 'accepted' | 'rejected'
  | 'planned' | 'in_progress' | 'shipped' | 'closed' | 'duplicate';

export interface PriorityFactors {
  frequency?: number;
  growth?: number;
  businessImpact?: number;
  severity?: number;
  coreFlowImpact?: boolean;
  trustRisk?: boolean;
}

export interface ExtractedItem {
  id: string;
  turnId: string;
  conversationId: string;
  userId: string;
  jobId: string;

  itemType: ExtractedItemType;
  signalType: 'explicit' | 'implicit';
  confidence: number;

  normalizedSummary: string;
  primaryCategory: string;
  subcategory: string;
  painPoint: string;
  expectedBehavior?: string;
  observedBehavior?: string;
  requestedOutcome?: string;
  rootCauseCandidate?: string;

  fixedTags: FixedTag[];
  semanticTags: string[];

  priorityScore: number;
  priorityFactors: PriorityFactors;

  clusterId?: string;

  status: ItemWorkflowStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  linkedAction?: string;

  createdAt: string;
}

export interface IssueCluster {
  id: string;
  clusterTitle: string;
  representativeSummary: string;
  itemType: 'bug_report' | 'feature_request' | 'mixed';
  memberCount: number;
  memberIds: string[];

  tags: string[];
  relatedFeatures: string[];

  trendScore: number;
  firstSeenDate: string;
  lastSeenDate: string;

  priorityScore: number;

  status: 'active' | 'resolved' | 'duplicate' | 'deferred';

  createdAt: string;
  updatedAt: string;
}

// ── Phase 5: Action Workflow ───────────────────────────────────────────────

export type ActionType =
  | 'backlog_item'
  | 'bug_ticket'
  | 'faq_draft'
  | 'doc_update'
  | 'prompt_fix'
  | 'release_note';

export interface VpisAction {
  id: string;
  sourceType: 'extracted_item' | 'cluster' | 'evaluation';
  sourceId: string;

  actionType: ActionType;

  draftContent: {
    title: string;
    body: string;
    metadata: Record<string, string>;
  };

  status: 'draft' | 'reviewed' | 'approved' | 'applied' | 'rejected';
  reviewedBy?: string;
  reviewNote?: string;
  appliedAt?: string;

  createdAt: string;
}

// ── Phase 7: Alerts ────────────────────────────────────────────────────────

export type AlertType =
  | 'p1_bug_spike'
  | 'feature_inquiry_surge'
  | 'hallucination_spike'
  | 'post_release_confusion';

export interface VpisAlert {
  id: string;
  alertType: AlertType;
  severity: 'warning' | 'critical';
  message: string;
  relatedClusterId?: string;
  triggeredAt: string;
  acknowledgedBy?: string;
}
