/**
 * VPIS (Vision Product Intelligence System) - Service Module Index
 *
 * Re-exports all VPIS types, services, and utilities.
 */

// Types
export type {
  IntentCategory,
  AnswerErrorType,
  FixedTag,
  ConversationTurn,
  FeatureCatalogEntry,
  PolicyEntry,
  FeatureCatalogSnapshot,
  AnalysisJob,
  QualityScores,
  FeatureAccuracy,
  AnswerEvaluation,
  DailyReportSummary,
  DailyReport,
  ExtractedItemType,
  ItemWorkflowStatus,
  PriorityFactors,
  ExtractedItem,
  IssueCluster,
  ActionType,
  VpisAction,
  AlertType,
  VpisAlert,
} from './vpisTypes';

// Service functions
export {
  maskPII,
  createAnalysisJob,
  getAnalysisJobs,
  getAnalysisJob,
  updateAnalysisJob,
  getConversationTurns,
  getLatestFeatureCatalog,
  saveFeatureCatalog,
  getDailyReports,
  getDailyReport,
  getAnswerEvaluations,
  getExtractedItems,
  updateExtractedItem,
  getIssueClusters,
  getClusterById,
  getVpisActions,
  updateVpisAction,
} from './vpisService';

// Feature catalog
export {
  FEATURE_CATALOG,
  POLICY_CATALOG,
  generateCurrentCatalogSnapshot,
} from './featureCatalog';
