import { Component, createSignal, onMount, For, Show, Switch, Match, createMemo } from 'solid-js';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { getFirebaseApp } from '../../services/firebaseService';
import {
  BarChart3,
  FileSearch,
  MessageSquareWarning,
  Lightbulb,
  Bug,
  Network,
  Inbox,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
  ArrowUpRight,
  Target,
  Zap,
  Clock,
  Eye,
  Play,
  ThumbsUp,
  ThumbsDown,
  Link2,
  Tag,
  Layers,
  Search,
  ArrowDown,
  ArrowUp,
  Minus,
} from 'lucide-solid';
import type {
  DailyReport,
  AnalysisJob,
  AnswerEvaluation,
  ExtractedItem,
  IssueCluster,
  ConversationTurn,
} from '../../services/vpis/vpisTypes';

// ── Tab Types ──────────────────────────────────────────────────────────────

type TabId = 'summary' | 'audit' | 'features' | 'bugs' | 'clusters' | 'queue';

interface TabDef {
  id: TabId;
  label: string;
  icon: any;
}

const TABS: TabDef[] = [
  { id: 'summary', label: 'Executive Summary', icon: BarChart3 },
  { id: 'audit', label: 'Answer Audit', icon: FileSearch },
  { id: 'features', label: 'Feature Requests', icon: Lightbulb },
  { id: 'bugs', label: 'Bug Reports', icon: Bug },
  { id: 'clusters', label: 'Cluster Explorer', icon: Network },
  { id: 'queue', label: 'Decision Queue', icon: Inbox },
];

// ── Shared Helpers ─────────────────────────────────────────────────────────

const functions = getFunctions(getFirebaseApp());

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    case 'low': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    default: return 'text-green-400 bg-green-500/10 border-green-500/20';
  }
}

function scoreColor(score: number): string {
  if (score >= 4.0) return 'text-green-400';
  if (score >= 3.0) return 'text-yellow-400';
  if (score >= 2.0) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 4.0) return 'bg-green-500';
  if (score >= 3.0) return 'bg-yellow-500';
  if (score >= 2.0) return 'bg-orange-500';
  return 'bg-red-500';
}

function statusBadge(status: string): string {
  switch (status) {
    case 'new': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'reviewing': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'accepted': return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'planned': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'in_progress': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'shipped': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'duplicate': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    default: return 'bg-white/5 text-gray-400 border-white/10';
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

export const AdminProductIntelligence: Component = () => {
  const [activeTab, setActiveTab] = createSignal<TabId>('summary');
  const [loading, setLoading] = createSignal(false);

  // Data state
  const [reports, setReports] = createSignal<DailyReport[]>([]);
  const [jobs, setJobs] = createSignal<AnalysisJob[]>([]);
  const [evaluations, setEvaluations] = createSignal<AnswerEvaluation[]>([]);
  const [bugItems, setBugItems] = createSignal<ExtractedItem[]>([]);
  const [featureItems, setFeatureItems] = createSignal<ExtractedItem[]>([]);
  const [clusters, setClusters] = createSignal<IssueCluster[]>([]);
  const [queueItems, setQueueItems] = createSignal<ExtractedItem[]>([]);

  // Filters
  const [dateRange, setDateRange] = createSignal('7d');
  const [severityFilter, setSeverityFilter] = createSignal('all');

  // ── Data Fetching ──────────────────────────────────────────────────────

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const getDashboard = httpsCallable(functions, 'vpisGetDashboardData');
      const getReportsCall = httpsCallable(functions, 'vpisGetReports');
      const getExtracted = httpsCallable(functions, 'vpisGetExtractedItems');
      const getClusters = httpsCallable(functions, 'vpisGetClusters');

      const [summaryRes, reportsRes, bugsRes, featuresRes, clustersRes, queueRes] = await Promise.allSettled([
        getDashboard({ type: 'summary' }),
        getReportsCall({ limitCount: 30 }),
        getExtracted({ itemType: 'bug_report', limitCount: 50 }),
        getExtracted({ itemType: 'feature_request', limitCount: 50 }),
        getClusters({ status: 'active', limitCount: 50 }),
        getExtracted({ status: 'new', limitCount: 50 }),
      ]);

      if (summaryRes.status === 'fulfilled') {
        const data = summaryRes.value.data as any;
        if (data?.reports) setReports(data.reports);
      }
      if (reportsRes.status === 'fulfilled') {
        const data = reportsRes.value.data as any;
        if (data?.reports) setReports(data.reports);
      }
      if (bugsRes.status === 'fulfilled') {
        const data = bugsRes.value.data as any;
        if (data?.items) setBugItems(data.items);
      }
      if (featuresRes.status === 'fulfilled') {
        const data = featuresRes.value.data as any;
        if (data?.items) setFeatureItems(data.items);
      }
      if (clustersRes.status === 'fulfilled') {
        const data = clustersRes.value.data as any;
        if (data?.clusters) setClusters(data.clusters);
      }
      if (queueRes.status === 'fulfilled') {
        const data = queueRes.value.data as any;
        if (data?.items) setQueueItems(data.items);
      }
    } catch (err) {
      console.error('[VPIS Dashboard] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerIngestion = async () => {
    try {
      setLoading(true);
      const manualIngest = httpsCallable(functions, 'vpisManualIngest');
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      await manualIngest({ dateFrom: yesterday.toISOString(), dateTo: now.toISOString() });
      await fetchDashboardData();
    } catch (err) {
      console.error('[VPIS] Manual ingest failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerEvaluation = async () => {
    try {
      setLoading(true);
      const manualEval = httpsCallable(functions, 'vpisManualEvaluate');
      await manualEval({});
      await fetchDashboardData();
    } catch (err) {
      console.error('[VPIS] Manual evaluation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerExtraction = async () => {
    try {
      setLoading(true);
      const manualExtract = httpsCallable(functions, 'vpisManualExtract');
      await manualExtract({});
      await fetchDashboardData();
    } catch (err) {
      console.error('[VPIS] Manual extraction failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateItemStatus = async (itemId: string, status: string) => {
    try {
      const updateCall = httpsCallable(functions, 'vpisUpdateItemStatus');
      await updateCall({ itemId, status });
      // Refresh queue
      const getExtracted = httpsCallable(functions, 'vpisGetExtractedItems');
      const res = await getExtracted({ status: 'new', limitCount: 50 });
      const data = res.data as any;
      if (data?.items) setQueueItems(data.items);
    } catch (err) {
      console.error('[VPIS] Update status failed:', err);
    }
  };

  onMount(() => {
    fetchDashboardData();
  });

  // ── Computed ───────────────────────────────────────────────────────────

  const latestReport = createMemo(() => reports().length > 0 ? reports()[0] : null);

  const kpiCards = createMemo(() => {
    const r = latestReport();
    if (!r) return [];
    const s = r.summary;
    return [
      { label: 'Total Conversations', value: s.totalConversations, color: 'blue', icon: MessageSquareWarning },
      { label: 'Answer Success Rate', value: `${((1 - s.errorRate) * 100).toFixed(1)}%`, color: s.errorRate < 0.2 ? 'green' : 'red', icon: CheckCircle },
      { label: 'Feature Accuracy', value: `${(s.featureAccuracyAvg / 5 * 100).toFixed(0)}%`, color: s.featureAccuracyAvg >= 3.5 ? 'green' : 'amber', icon: Target },
      { label: 'Bug Signals', value: bugItems().length, color: 'red', icon: Bug },
      { label: 'Feature Requests', value: featureItems().length, color: 'purple', icon: Lightbulb },
      { label: 'Critical Issues', value: s.criticalErrorCount + s.highSeverityCount, color: 'red', icon: AlertTriangle },
    ];
  });

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div class="min-h-screen bg-[#09090b] text-white font-sans">
      {/* Header */}
      <div class="px-6 pt-6 pb-4">
        <div class="flex items-center justify-between mb-1">
          <div>
            <h1 class="text-2xl font-black tracking-tight">Product Intelligence</h1>
            <p class="text-xs text-slate-500 mt-1">Vision Product Intelligence System (VPIS)</p>
          </div>
          <div class="flex items-center gap-2">
            {/* Pipeline Actions */}
            <button
              onClick={triggerIngestion}
              disabled={loading()}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-400 hover:text-white transition-all disabled:opacity-30"
            >
              <Play class="w-3 h-3" /> Ingest
            </button>
            <button
              onClick={triggerEvaluation}
              disabled={loading()}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-400 hover:text-white transition-all disabled:opacity-30"
            >
              <Zap class="w-3 h-3" /> Evaluate
            </button>
            <button
              onClick={triggerExtraction}
              disabled={loading()}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-400 hover:text-white transition-all disabled:opacity-30"
            >
              <Search class="w-3 h-3" /> Extract
            </button>
            <div class="w-px h-6 bg-white/10" />
            <button
              onClick={fetchDashboardData}
              disabled={loading()}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-xs text-cyan-400 hover:text-cyan-300 transition-all disabled:opacity-30"
            >
              <RefreshCw class={`w-3 h-3 ${loading() ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div class="px-6 border-b border-white/5">
        <div class="flex gap-1 overflow-x-auto pb-px">
          <For each={TABS}>
            {(tab) => (
              <button
                onClick={() => setActiveTab(tab.id)}
                class={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap ${
                  activeTab() === tab.id
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-white/10'
                }`}
              >
                <tab.icon class="w-3.5 h-3.5" />
                {tab.label}
                <Show when={tab.id === 'queue' && queueItems().length > 0}>
                  <span class="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                    {queueItems().length}
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Tab Content */}
      <div class="p-6">
        <Switch>
          <Match when={activeTab() === 'summary'}>
            <ExecutiveSummary
              latestReport={latestReport()}
              reports={reports()}
              kpiCards={kpiCards()}
              loading={loading()}
            />
          </Match>
          <Match when={activeTab() === 'audit'}>
            <AnswerAudit reports={reports()} loading={loading()} />
          </Match>
          <Match when={activeTab() === 'features'}>
            <ItemList items={featureItems()} title="Feature Requests" type="feature" onStatusChange={updateItemStatus} />
          </Match>
          <Match when={activeTab() === 'bugs'}>
            <ItemList items={bugItems()} title="Bug Reports" type="bug" onStatusChange={updateItemStatus} />
          </Match>
          <Match when={activeTab() === 'clusters'}>
            <ClusterExplorer clusters={clusters()} />
          </Match>
          <Match when={activeTab() === 'queue'}>
            <DecisionQueue items={queueItems()} onStatusChange={updateItemStatus} />
          </Match>
        </Switch>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════

// ── KPI Card ───────────────────────────────────────────────────────────────

const KPICard: Component<{ label: string; value: any; color: string; icon: any }> = (props) => {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/10',
    green: 'from-green-500/20 to-green-600/5 border-green-500/10',
    red: 'from-red-500/20 to-red-600/5 border-red-500/10',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/10',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/10',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/10',
  };

  const textColorMap: Record<string, string> = {
    blue: 'text-blue-400', green: 'text-green-400', red: 'text-red-400',
    amber: 'text-amber-400', purple: 'text-purple-400', cyan: 'text-cyan-400',
  };

  return (
    <div class={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorMap[props.color] || colorMap.blue} p-5`}>
      <div class="flex items-start justify-between">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{props.label}</p>
          <p class={`text-3xl font-black font-mono ${textColorMap[props.color] || 'text-white'}`}>{props.value}</p>
        </div>
        <div class={`p-2 rounded-xl bg-white/5 ${textColorMap[props.color] || 'text-white'}`}>
          <props.icon class="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

// ── Executive Summary ─────────────────────────────────────────────────────

const ExecutiveSummary: Component<{
  latestReport: DailyReport | null;
  reports: DailyReport[];
  kpiCards: any[];
  loading: boolean;
}> = (props) => {
  return (
    <div class="space-y-6">
      {/* KPI Grid */}
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <For each={props.kpiCards}>
          {(card) => <KPICard {...card} />}
        </For>
      </div>

      <Show when={!props.latestReport}>
        <div class="flex flex-col items-center justify-center py-20 text-slate-500">
          <BarChart3 class="w-12 h-12 mb-4 opacity-30" />
          <p class="text-sm font-semibold">No reports yet</p>
          <p class="text-xs mt-1">Run the pipeline to generate the first report</p>
        </div>
      </Show>

      <Show when={props.latestReport}>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Score Trend */}
          <div class="rounded-2xl border border-white/5 bg-[#0B0E14] p-6">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp class="w-4 h-4 text-cyan-400" /> Quality Score Trend (7 days)
            </h3>
            <div class="space-y-2">
              <For each={props.reports.slice(0, 7).reverse()}>
                {(report) => (
                  <div class="flex items-center gap-3">
                    <span class="text-[10px] text-slate-500 w-20 font-mono">{report.reportDate}</span>
                    <div class="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
                      <div
                        class={`h-full rounded-full transition-all ${scoreBg(report.summary.overallAvgScore)}`}
                        style={`width: ${(report.summary.overallAvgScore / 5) * 100}%`}
                      />
                    </div>
                    <span class={`text-xs font-mono font-bold w-8 text-right ${scoreColor(report.summary.overallAvgScore)}`}>
                      {report.summary.overallAvgScore.toFixed(1)}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Category Distribution */}
          <div class="rounded-2xl border border-white/5 bg-[#0B0E14] p-6">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Layers class="w-4 h-4 text-purple-400" /> Intent Category Distribution
            </h3>
            <Show when={props.latestReport?.scoresByCategory}>
              <div class="space-y-2">
                <For each={Object.entries(props.latestReport!.scoresByCategory).sort((a, b) => b[1].count - a[1].count)}>
                  {([cat, data]) => (
                    <div class="flex items-center gap-3">
                      <span class="text-[10px] text-slate-400 w-32 truncate font-mono">{cat}</span>
                      <div class="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
                        <div
                          class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                          style={`width: ${Math.min(data.count / (props.latestReport?.summary.totalTurns || 1) * 100 * 3, 100)}%`}
                        />
                      </div>
                      <span class="text-[10px] text-slate-500 font-mono w-8 text-right">{data.count}</span>
                      <span class={`text-[10px] font-mono w-10 text-right ${scoreColor(data.avgScore)}`}>
                        {data.avgScore.toFixed(1)}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Top Failed Answers */}
        <Show when={props.latestReport?.topFailedAnswers && props.latestReport!.topFailedAnswers.length > 0}>
          <div class="rounded-2xl border border-white/5 bg-[#0B0E14] p-6">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle class="w-4 h-4 text-red-400" /> Lowest Scored Answers
            </h3>
            <div class="space-y-2">
              <For each={props.latestReport!.topFailedAnswers.slice(0, 10)}>
                {(item) => (
                  <div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div class={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${scoreBg(item.score)} bg-opacity-20`}>
                      {item.score.toFixed(1)}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs text-white truncate">{item.userMessage || '(no message)'}</p>
                      <div class="flex gap-1 mt-1">
                        <For each={item.errorTypes.slice(0, 3)}>
                          {(err) => (
                            <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">{err}</span>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Repeated Error Patterns */}
        <Show when={props.latestReport?.repeatedErrorPatterns && props.latestReport!.repeatedErrorPatterns.length > 0}>
          <div class="rounded-2xl border border-white/5 bg-[#0B0E14] p-6">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Bug class="w-4 h-4 text-orange-400" /> Repeated Error Patterns
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <For each={props.latestReport!.repeatedErrorPatterns}>
                {(pattern) => (
                  <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-orange-500/20 transition-colors">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-mono text-orange-400">{pattern.errorType}</span>
                      <span class="text-lg font-black text-white font-mono">{pattern.count}</span>
                    </div>
                    <p class="text-[10px] text-slate-500">{pattern.exampleTurnIds.length} examples</p>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

// ── Answer Audit ──────────────────────────────────────────────────────────

const AnswerAudit: Component<{ reports: DailyReport[]; loading: boolean }> = (props) => {
  const [selectedReport, setSelectedReport] = createSignal<DailyReport | null>(null);

  onMount(() => {
    if (props.reports.length > 0) setSelectedReport(props.reports[0]);
  });

  return (
    <div class="space-y-6">
      {/* Report Selector */}
      <div class="flex items-center gap-4">
        <label class="text-xs text-slate-500 font-semibold">Report Date:</label>
        <select
          class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white appearance-none cursor-pointer"
          onChange={(e) => {
            const r = props.reports.find(r => r.reportDate === e.target.value);
            if (r) setSelectedReport(r);
          }}
        >
          <For each={props.reports}>
            {(report) => <option value={report.reportDate}>{report.reportDate}</option>}
          </For>
        </select>
      </div>

      <Show when={selectedReport()} fallback={
        <div class="flex flex-col items-center justify-center py-20 text-slate-500">
          <FileSearch class="w-12 h-12 mb-4 opacity-30" />
          <p class="text-sm font-semibold">No audit reports available</p>
        </div>
      }>
        {(report) => (
          <div class="space-y-6">
            {/* Summary Stats */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="rounded-xl border border-white/5 bg-[#0B0E14] p-4">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Turns Analyzed</p>
                <p class="text-2xl font-black font-mono text-white mt-1">{report().summary.totalTurns}</p>
              </div>
              <div class="rounded-xl border border-white/5 bg-[#0B0E14] p-4">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Avg Score</p>
                <p class={`text-2xl font-black font-mono mt-1 ${scoreColor(report().summary.overallAvgScore)}`}>
                  {report().summary.overallAvgScore.toFixed(2)}
                </p>
              </div>
              <div class="rounded-xl border border-white/5 bg-[#0B0E14] p-4">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Error Rate</p>
                <p class={`text-2xl font-black font-mono mt-1 ${report().summary.errorRate > 0.3 ? 'text-red-400' : 'text-green-400'}`}>
                  {(report().summary.errorRate * 100).toFixed(1)}%
                </p>
              </div>
              <div class="rounded-xl border border-white/5 bg-[#0B0E14] p-4">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Critical + High</p>
                <p class="text-2xl font-black font-mono text-red-400 mt-1">
                  {report().summary.criticalErrorCount + report().summary.highSeverityCount}
                </p>
              </div>
            </div>

            {/* Score Dimensions */}
            <div class="rounded-2xl border border-white/5 bg-[#0B0E14] p-6">
              <h3 class="text-sm font-bold text-white mb-4">Score Breakdown by Category</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="border-b border-white/5">
                      <th class="text-left text-slate-500 font-bold uppercase tracking-wider py-2 px-3">Category</th>
                      <th class="text-right text-slate-500 font-bold uppercase tracking-wider py-2 px-3">Count</th>
                      <th class="text-right text-slate-500 font-bold uppercase tracking-wider py-2 px-3">Avg Score</th>
                      <th class="text-right text-slate-500 font-bold uppercase tracking-wider py-2 px-3">Error Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={Object.entries(report().scoresByCategory).sort((a, b) => b[1].count - a[1].count)}>
                      {([cat, data]) => (
                        <tr class="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td class="py-2.5 px-3 font-mono text-slate-300">{cat}</td>
                          <td class="py-2.5 px-3 text-right font-mono text-white">{data.count}</td>
                          <td class={`py-2.5 px-3 text-right font-mono font-bold ${scoreColor(data.avgScore)}`}>{data.avgScore.toFixed(2)}</td>
                          <td class={`py-2.5 px-3 text-right font-mono ${data.errorRate > 0.3 ? 'text-red-400' : 'text-green-400'}`}>
                            {(data.errorRate * 100).toFixed(1)}%
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

// ── Item List (Feature Requests / Bug Reports) ────────────────────────────

const ItemList: Component<{
  items: ExtractedItem[];
  title: string;
  type: 'feature' | 'bug';
  onStatusChange: (id: string, status: string) => void;
}> = (props) => {
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [categoryFilter, setCategoryFilter] = createSignal('all');

  const filteredItems = createMemo(() => {
    let items = props.items;
    if (categoryFilter() !== 'all') {
      items = items.filter(i => i.primaryCategory === categoryFilter());
    }
    return items.sort((a, b) => b.priorityScore - a.priorityScore);
  });

  const categories = createMemo(() => {
    const cats = new Set(props.items.map(i => i.primaryCategory));
    return Array.from(cats).sort();
  });

  return (
    <div class="space-y-4">
      {/* Filters */}
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500 font-semibold">Category:</span>
        <select
          class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white appearance-none cursor-pointer"
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All ({props.items.length})</option>
          <For each={categories()}>
            {(cat) => <option value={cat}>{cat} ({props.items.filter(i => i.primaryCategory === cat).length})</option>}
          </For>
        </select>
      </div>

      <Show when={filteredItems().length === 0}>
        <div class="flex flex-col items-center justify-center py-20 text-slate-500">
          {props.type === 'bug' ? <Bug class="w-12 h-12 mb-4 opacity-30" /> : <Lightbulb class="w-12 h-12 mb-4 opacity-30" />}
          <p class="text-sm font-semibold">No {props.title.toLowerCase()} detected</p>
          <p class="text-xs mt-1">Run the extraction pipeline to detect signals</p>
        </div>
      </Show>

      <div class="space-y-2">
        <For each={filteredItems()}>
          {(item) => (
            <div class="rounded-xl border border-white/5 bg-[#0B0E14] overflow-hidden hover:border-white/10 transition-colors">
              {/* Header */}
              <button
                class="w-full flex items-center gap-3 p-4 text-left"
                onClick={() => setExpandedId(expandedId() === item.id ? null : item.id)}
              >
                {/* Priority Score */}
                <div class={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black font-mono ${
                  item.priorityScore >= 70 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  item.priorityScore >= 40 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {item.priorityScore}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-white font-semibold truncate">{item.normalizedSummary}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                      {item.primaryCategory}
                    </span>
                    <span class={`text-[10px] px-1.5 py-0.5 rounded border ${statusBadge(item.status)}`}>
                      {item.status}
                    </span>
                    <Show when={item.signalType === 'explicit'}>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                        explicit
                      </span>
                    </Show>
                  </div>
                </div>
                {expandedId() === item.id
                  ? <ChevronDown class="w-4 h-4 text-slate-500" />
                  : <ChevronRight class="w-4 h-4 text-slate-500" />
                }
              </button>

              {/* Expanded Detail */}
              <Show when={expandedId() === item.id}>
                <div class="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                  <div class="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span class="text-slate-500 font-semibold block mb-1">Pain Point</span>
                      <p class="text-slate-300">{item.painPoint || 'N/A'}</p>
                    </div>
                    <Show when={item.expectedBehavior}>
                      <div>
                        <span class="text-slate-500 font-semibold block mb-1">Expected Behavior</span>
                        <p class="text-slate-300">{item.expectedBehavior}</p>
                      </div>
                    </Show>
                    <Show when={item.observedBehavior}>
                      <div>
                        <span class="text-slate-500 font-semibold block mb-1">Observed Behavior</span>
                        <p class="text-slate-300">{item.observedBehavior}</p>
                      </div>
                    </Show>
                    <Show when={item.requestedOutcome}>
                      <div>
                        <span class="text-slate-500 font-semibold block mb-1">Requested Outcome</span>
                        <p class="text-slate-300">{item.requestedOutcome}</p>
                      </div>
                    </Show>
                    <Show when={item.rootCauseCandidate}>
                      <div>
                        <span class="text-slate-500 font-semibold block mb-1">Root Cause Candidate</span>
                        <p class="text-slate-300">{item.rootCauseCandidate}</p>
                      </div>
                    </Show>
                  </div>
                  {/* Tags */}
                  <div class="flex flex-wrap gap-1">
                    <For each={item.fixedTags}>
                      {(tag) => <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{tag}</span>}
                    </For>
                    <For each={item.semanticTags}>
                      {(tag) => <span class="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{tag}</span>}
                    </For>
                  </div>
                  {/* Actions */}
                  <div class="flex gap-2 pt-2">
                    <button onClick={() => props.onStatusChange(item.id, 'accepted')} class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-semibold hover:bg-green-500/20 transition-colors border border-green-500/20">
                      <ThumbsUp class="w-3 h-3" /> Accept
                    </button>
                    <button onClick={() => props.onStatusChange(item.id, 'rejected')} class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20 transition-colors border border-red-500/20">
                      <ThumbsDown class="w-3 h-3" /> Reject
                    </button>
                    <button onClick={() => props.onStatusChange(item.id, 'planned')} class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-semibold hover:bg-cyan-500/20 transition-colors border border-cyan-500/20">
                      <Calendar class="w-3 h-3" /> Plan
                    </button>
                    <button onClick={() => props.onStatusChange(item.id, 'duplicate')} class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-500/10 text-gray-400 text-[10px] font-semibold hover:bg-gray-500/20 transition-colors border border-gray-500/20">
                      <Link2 class="w-3 h-3" /> Duplicate
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

// ── Cluster Explorer ──────────────────────────────────────────────────────

const ClusterExplorer: Component<{ clusters: IssueCluster[] }> = (props) => {
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [typeFilter, setTypeFilter] = createSignal('all');

  const filtered = createMemo(() => {
    let items = props.clusters;
    if (typeFilter() !== 'all') items = items.filter(c => c.itemType === typeFilter());
    return items.sort((a, b) => b.priorityScore - a.priorityScore);
  });

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500 font-semibold">Type:</span>
        <select
          class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white appearance-none cursor-pointer"
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All ({props.clusters.length})</option>
          <option value="bug_report">Bugs ({props.clusters.filter(c => c.itemType === 'bug_report').length})</option>
          <option value="feature_request">Features ({props.clusters.filter(c => c.itemType === 'feature_request').length})</option>
          <option value="mixed">Mixed ({props.clusters.filter(c => c.itemType === 'mixed').length})</option>
        </select>
      </div>

      <Show when={filtered().length === 0}>
        <div class="flex flex-col items-center justify-center py-20 text-slate-500">
          <Network class="w-12 h-12 mb-4 opacity-30" />
          <p class="text-sm font-semibold">No clusters yet</p>
          <p class="text-xs mt-1">Clusters are created when similar items are detected</p>
        </div>
      </Show>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <For each={filtered()}>
          {(cluster) => (
            <div
              class="rounded-2xl border border-white/5 bg-[#0B0E14] p-5 hover:border-white/10 transition-colors cursor-pointer"
              onClick={() => setExpandedId(expandedId() === cluster.id ? null : cluster.id)}
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-bold text-white truncate">{cluster.clusterTitle}</h4>
                  <p class="text-[10px] text-slate-500 mt-1 line-clamp-2">{cluster.representativeSummary}</p>
                </div>
                <div class={`ml-3 w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black font-mono ${
                  cluster.priorityScore >= 70 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  cluster.priorityScore >= 40 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {cluster.priorityScore}
                </div>
              </div>

              <div class="flex items-center gap-2 mb-3">
                <span class={`text-[10px] px-1.5 py-0.5 rounded border ${
                  cluster.itemType === 'bug_report' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  cluster.itemType === 'feature_request' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {cluster.itemType}
                </span>
                <span class="text-[10px] text-slate-500 font-mono">{cluster.memberCount} items</span>
                <Show when={cluster.trendScore > 0}>
                  <span class="flex items-center gap-0.5 text-[10px] text-green-400">
                    <ArrowUpRight class="w-3 h-3" /> trending
                  </span>
                </Show>
              </div>

              <div class="flex flex-wrap gap-1">
                <For each={cluster.tags.slice(0, 5)}>
                  {(tag) => <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">{tag}</span>}
                </For>
              </div>

              <Show when={expandedId() === cluster.id}>
                <div class="mt-3 pt-3 border-t border-white/5 text-xs text-slate-400 space-y-1">
                  <p>First seen: <span class="text-white font-mono">{cluster.firstSeenDate?.split('T')[0] || 'N/A'}</span></p>
                  <p>Last seen: <span class="text-white font-mono">{cluster.lastSeenDate?.split('T')[0] || 'N/A'}</span></p>
                  <p>Related features: <span class="text-cyan-400">{cluster.relatedFeatures.join(', ') || 'N/A'}</span></p>
                  <p>Status: <span class={`px-1.5 py-0.5 rounded border ${statusBadge(cluster.status)}`}>{cluster.status}</span></p>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

// ── Decision Queue ────────────────────────────────────────────────────────

const DecisionQueue: Component<{
  items: ExtractedItem[];
  onStatusChange: (id: string, status: string) => void;
}> = (props) => {
  return (
    <div class="space-y-4">
      <Show when={props.items.length === 0}>
        <div class="flex flex-col items-center justify-center py-20 text-slate-500">
          <Inbox class="w-12 h-12 mb-4 opacity-30" />
          <p class="text-sm font-semibold">Decision queue is empty</p>
          <p class="text-xs mt-1">All items have been reviewed</p>
        </div>
      </Show>

      <div class="space-y-2">
        <For each={props.items.sort((a, b) => b.priorityScore - a.priorityScore)}>
          {(item) => (
            <div class="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-[#0B0E14] hover:border-white/10 transition-colors">
              {/* Priority */}
              <div class={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black font-mono shrink-0 ${
                item.priorityScore >= 70 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                item.priorityScore >= 40 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {item.priorityScore}
              </div>

              {/* Content */}
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class={`text-[10px] px-1.5 py-0.5 rounded border ${
                    item.itemType === 'bug_report' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}>
                    {item.itemType === 'bug_report' ? 'BUG' : 'FEATURE'}
                  </span>
                  <span class="text-[10px] text-slate-500">{item.primaryCategory}/{item.subcategory}</span>
                </div>
                <p class="text-sm text-white font-semibold truncate">{item.normalizedSummary}</p>
                <p class="text-[10px] text-slate-500 mt-0.5 truncate">{item.painPoint}</p>
              </div>

              {/* Quick Actions */}
              <div class="flex gap-1.5 shrink-0">
                <button
                  onClick={() => props.onStatusChange(item.id, 'accepted')}
                  class="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors border border-green-500/20"
                  title="Accept"
                >
                  <ThumbsUp class="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => props.onStatusChange(item.id, 'rejected')}
                  class="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
                  title="Reject"
                >
                  <ThumbsDown class="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => props.onStatusChange(item.id, 'planned')}
                  class="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors border border-cyan-500/20"
                  title="Plan"
                >
                  <Calendar class="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => props.onStatusChange(item.id, 'duplicate')}
                  class="p-2 rounded-lg bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-colors border border-gray-500/20"
                  title="Mark as Duplicate"
                >
                  <Link2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default AdminProductIntelligence;
