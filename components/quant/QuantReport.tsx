/**
 * Vision Quant Engine - Performance Report
 *
 * Professional-grade trading performance reports modeled after
 * institutional asset management report formats.
 *
 * Supports: Weekly / Monthly / Annual report periods.
 */

import { createSignal, Show, For, onMount, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import {
    TrendingUp,
    TrendingDown,
    X,
    ChevronLeft,
    Download,
    Calendar,
    BarChart3,
    Activity,
    Shield,
    AlertTriangle,
    ArrowRight,
    ArrowUpRight,
    ArrowDownRight,
    Target,
    Zap,
    Clock,
    Info,
} from 'lucide-solid';
import type {
    PerformanceReport,
    ReportPeriod,
    DailyPnL,
    AssetPerformance,
    StrategyPerformance,
    DrawdownEvent,
    TradeRecord,
    RiskMetrics,
    MonthlyReturn,
} from '../../services/quant/types';

// ─── SVG Icons ─────────────────────────────────────────────────────────────

const ReportIcon = () => (
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
);

const ChartLineIcon = () => (
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-9" />
    </svg>
);

// ─── Demo Data Generator ───────────────────────────────────────────────────

function generateDemoReport(period: ReportPeriod): PerformanceReport {
    const now = new Date();
    let startDate: Date;
    let days: number;

    switch (period) {
        case 'weekly':
            startDate = new Date(now.getTime() - 7 * 86400000);
            days = 7;
            break;
        case 'monthly':
            startDate = new Date(now.getTime() - 30 * 86400000);
            days = 30;
            break;
        case 'annual':
            startDate = new Date(now.getTime() - 365 * 86400000);
            days = 365;
            break;
    }

    // Generate daily PnL
    let cumPnl = 0;
    let cumReturn = 0;
    let portfolioVal = 10000000;
    const baseVal = portfolioVal;
    let btcReturn = 0;
    const dailyPnl: DailyPnL[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate.getTime() + i * 86400000);
        const dailyReturn = (Math.random() - 0.47) * 2.5; // slightly positive bias
        const pnl = portfolioVal * (dailyReturn / 100);
        cumPnl += pnl;
        portfolioVal += pnl;
        cumReturn = ((portfolioVal - baseVal) / baseVal) * 100;
        btcReturn += (Math.random() - 0.48) * 1.8;
        dailyPnl.push({
            date: d.toISOString().split('T')[0],
            pnl, pnlPercent: dailyReturn,
            cumulativePnl: cumPnl,
            cumulativeReturn: cumReturn,
            portfolioValue: portfolioVal,
            benchmark: btcReturn,
        });
    }

    // Generate trades
    const assets = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE'];
    const strategies = ['MACD Crossover', 'RSI Mean Reversion', 'Bollinger Breakout'];
    const trades: TradeRecord[] = [];
    const numTrades = period === 'weekly' ? 18 : period === 'monthly' ? 64 : 312;
    for (let i = 0; i < numTrades; i++) {
        const asset = assets[Math.floor(Math.random() * assets.length)];
        const side = Math.random() > 0.5 ? 'buy' : 'sell';
        const pnl = (Math.random() - 0.45) * 500000;
        trades.push({
            id: `T${String(i + 1).padStart(4, '0')}`,
            asset,
            side: side as 'buy' | 'sell',
            price: asset === 'BTC' ? 65000000 + Math.random() * 5000000 : 3500000 + Math.random() * 500000,
            quantity: Math.random() * 0.5,
            value: 500000 + Math.random() * 2000000,
            fee: 500 + Math.random() * 2000,
            pnl,
            pnlPercent: (pnl / 1000000) * 100,
            strategy: strategies[Math.floor(Math.random() * strategies.length)],
            timestamp: new Date(startDate.getTime() + Math.random() * days * 86400000).toISOString(),
            holdingPeriod: Math.random() * 72,
        });
    }

    const winTrades = trades.filter(t => t.pnl > 0);
    const loseTrades = trades.filter(t => t.pnl <= 0);
    const totalFees = trades.reduce((s, t) => s + t.fee, 0);

    // Asset performance
    const assetPerf: AssetPerformance[] = assets.map(a => {
        const at = trades.filter(t => t.asset === a);
        const wins = at.filter(t => t.pnl > 0);
        return {
            asset: a,
            trades: at.length,
            winRate: at.length > 0 ? (wins.length / at.length) * 100 : 0,
            totalPnl: at.reduce((s, t) => s + t.pnl, 0),
            totalReturn: (Math.random() - 0.4) * 15,
            avgHoldingPeriod: 12 + Math.random() * 36,
            bestTrade: Math.max(...at.map(t => t.pnl), 0),
            worstTrade: Math.min(...at.map(t => t.pnl), 0),
            sharpeRatio: 0.5 + Math.random() * 2,
            allocation: 100 / assets.length,
        };
    });

    // Strategy performance
    const stratPerf: StrategyPerformance[] = strategies.map((s, i) => {
        const st = trades.filter(t => t.strategy === s);
        const wins = st.filter(t => t.pnl > 0);
        const avgW = wins.length > 0 ? wins.reduce((acc, t) => acc + t.pnl, 0) / wins.length : 0;
        const loses = st.filter(t => t.pnl <= 0);
        const avgL = loses.length > 0 ? Math.abs(loses.reduce((acc, t) => acc + t.pnl, 0) / loses.length) : 1;
        return {
            strategyId: `s${i}`,
            strategyName: s,
            trades: st.length,
            winRate: st.length > 0 ? (wins.length / st.length) * 100 : 0,
            totalPnl: st.reduce((acc, t) => acc + t.pnl, 0),
            totalReturn: (Math.random() - 0.4) * 10,
            profitFactor: avgL > 0 ? avgW / avgL : 0,
            avgWin: avgW,
            avgLoss: avgL,
            maxConsecutiveWins: 3 + Math.floor(Math.random() * 5),
            maxConsecutiveLosses: 2 + Math.floor(Math.random() * 3),
            signalsGenerated: st.length + Math.floor(Math.random() * 10),
            signalsExecuted: st.length,
            signalsSkipped: Math.floor(Math.random() * 10),
        };
    });

    // Drawdowns
    const drawdowns: DrawdownEvent[] = [
        { startDate: dailyPnl[Math.floor(days * 0.2)]?.date || '', endDate: dailyPnl[Math.floor(days * 0.25)]?.date || '', depth: -3.2, duration: Math.ceil(days * 0.05), recovery: Math.ceil(days * 0.03), peakValue: baseVal * 1.02, troughValue: baseVal * 0.988 },
        { startDate: dailyPnl[Math.floor(days * 0.6)]?.date || '', endDate: dailyPnl[Math.floor(days * 0.68)]?.date || '', depth: -5.1, duration: Math.ceil(days * 0.08), recovery: Math.ceil(days * 0.05), peakValue: baseVal * 1.05, troughValue: baseVal * 0.999 },
    ];

    // Monthly returns (for annual)
    const monthlyReturns: MonthlyReturn[] = [];
    if (period === 'annual') {
        for (let m = 0; m < 12; m++) {
            monthlyReturns.push({ year: now.getFullYear(), month: m + 1, return: (Math.random() - 0.42) * 8, trades: 20 + Math.floor(Math.random() * 30) });
        }
    } else if (period === 'monthly') {
        for (let w = 0; w < 4; w++) {
            monthlyReturns.push({ year: now.getFullYear(), month: now.getMonth() + 1, return: (Math.random() - 0.42) * 4, trades: 10 + Math.floor(Math.random() * 15) });
        }
    }

    const risk: RiskMetrics = {
        sharpeRatio: 1.2 + Math.random() * 0.8,
        sortinoRatio: 1.5 + Math.random() * 1.0,
        calmarRatio: 0.8 + Math.random() * 1.2,
        maxDrawdown: -5.1,
        maxDrawdownDuration: Math.ceil(days * 0.08),
        volatility: 12 + Math.random() * 8,
        beta: 0.6 + Math.random() * 0.4,
        alpha: 2 + Math.random() * 5,
        var95: -(1 + Math.random() * 2),
        var99: -(2 + Math.random() * 3),
        winRate: trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0,
        profitFactor: loseTrades.length > 0 ? Math.abs(winTrades.reduce((s, t) => s + t.pnl, 0) / loseTrades.reduce((s, t) => s + t.pnl, 0)) : 0,
        avgWinLossRatio: loseTrades.length > 0 ? (winTrades.reduce((s, t) => s + t.pnl, 0) / (winTrades.length || 1)) / (Math.abs(loseTrades.reduce((s, t) => s + t.pnl, 0)) / (loseTrades.length || 1)) : 0,
        expectancy: trades.reduce((s, t) => s + t.pnl, 0) / (trades.length || 1),
        kellyFraction: 0.15 + Math.random() * 0.15,
    };

    const sortedDaily = [...dailyPnl].sort((a, b) => b.pnl - a.pnl);

    return {
        reportId: `RPT-${Date.now()}`,
        userId: 'user@example.com',
        period,
        startDate: startDate.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        generatedAt: now.toISOString(),
        currency: 'KRW',
        summary: {
            startingCapital: baseVal,
            endingCapital: portfolioVal,
            netPnl: cumPnl,
            totalReturn: cumReturn,
            annualizedReturn: cumReturn * (365 / days),
            totalTrades: trades.length,
            winningTrades: winTrades.length,
            losingTrades: loseTrades.length,
            winRate: trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0,
            bestDay: sortedDaily[0] ? { date: sortedDaily[0].date, pnl: sortedDaily[0].pnl, pnlPercent: sortedDaily[0].pnlPercent } : { date: '', pnl: 0, pnlPercent: 0 },
            worstDay: sortedDaily[sortedDaily.length - 1] ? { date: sortedDaily[sortedDaily.length - 1].date, pnl: sortedDaily[sortedDaily.length - 1].pnl, pnlPercent: sortedDaily[sortedDaily.length - 1].pnlPercent } : { date: '', pnl: 0, pnlPercent: 0 },
            avgDailyReturn: cumReturn / days,
            totalFees,
            netAfterFees: cumPnl - totalFees,
        },
        dailyPnl,
        trades,
        assetPerformance: assetPerf,
        strategyPerformance: stratPerf,
        riskMetrics: risk,
        drawdowns,
        monthlyReturns,
        benchmarks: {
            btcReturn: btcReturn,
            ethReturn: btcReturn * 0.8 + (Math.random() - 0.5) * 5,
            marketAvg: btcReturn * 0.6,
            outperformance: cumReturn - btcReturn,
        },
    };
}

// ─── Formatting Helpers ────────────────────────────────────────────────────

const fmtKrw = (v: number) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 100000000) return `${sign}\u20a9${(abs / 100000000).toFixed(2)}\uc5b5`;
    if (abs >= 10000) return `${sign}\u20a9${(abs / 10000).toFixed(0)}\ub9cc`;
    return `${sign}\u20a9${Math.round(abs).toLocaleString()}`;
};

const fmtPct = (v: number, decimals = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;
const fmtNum = (v: number, d = 2) => v.toFixed(d);
const pnlColor = (v: number) => v >= 0 ? 'text-emerald-400' : 'text-red-400';
const pnlBg = (v: number) => v >= 0 ? 'bg-emerald-500/8 border-emerald-500/15' : 'bg-red-500/8 border-red-500/15';

// ─── Section Components ────────────────────────────────────────────────────

/** Report header with branding */
const ReportHeader = (props: { report: PerformanceReport }) => {
    const r = () => props.report;
    const periodLabel = () => {
        switch (r().period) {
            case 'weekly': return 'Weekly Performance Report';
            case 'monthly': return 'Monthly Performance Report';
            case 'annual': return 'Annual Performance Report';
        }
    };

    return (
        <div class="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0a0a0c] via-[#111118] to-[#0a0a0c]">
            {/* Decorative grid */}
            <div class="absolute inset-0 opacity-[0.03]" style={`background-image: linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 40px 40px;`} />
            <div class="relative p-6 sm:p-8">
                <div class="flex items-start justify-between mb-6">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <div class="w-1 h-6 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
                            <span class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">Vision Quant Engine</span>
                        </div>
                        <h1 class="text-xl sm:text-2xl font-black text-white tracking-tight">{periodLabel()}</h1>
                        <p class="text-xs text-gray-500 mt-1">{r().startDate} ~ {r().endDate}</p>
                    </div>
                    <div class="text-right">
                        <div class="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Report ID</div>
                        <div class="text-[10px] font-mono text-gray-400">{r().reportId}</div>
                        <div class="text-[9px] text-gray-600 mt-1">Generated {new Date(r().generatedAt).toLocaleString()}</div>
                    </div>
                </div>

                {/* Hero KPIs */}
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div class="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                        <div class="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Net P&L</div>
                        <div class={`text-lg sm:text-xl font-black ${pnlColor(r().summary.netPnl)}`}>{fmtKrw(r().summary.netPnl)}</div>
                        <div class={`text-[10px] font-bold mt-0.5 ${pnlColor(r().summary.totalReturn)}`}>{fmtPct(r().summary.totalReturn)}</div>
                    </div>
                    <div class="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                        <div class="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Win Rate</div>
                        <div class="text-lg sm:text-xl font-black text-white">{r().summary.winRate.toFixed(1)}%</div>
                        <div class="text-[10px] text-gray-500 mt-0.5">{r().summary.winningTrades}W / {r().summary.losingTrades}L</div>
                    </div>
                    <div class="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                        <div class="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Sharpe Ratio</div>
                        <div class={`text-lg sm:text-xl font-black ${r().riskMetrics.sharpeRatio >= 1 ? 'text-emerald-400' : r().riskMetrics.sharpeRatio >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>{fmtNum(r().riskMetrics.sharpeRatio)}</div>
                        <div class="text-[10px] text-gray-500 mt-0.5">Risk-adjusted return</div>
                    </div>
                    <div class="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                        <div class="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Max Drawdown</div>
                        <div class="text-lg sm:text-xl font-black text-red-400">{fmtPct(r().riskMetrics.maxDrawdown)}</div>
                        <div class="text-[10px] text-gray-500 mt-0.5">{r().riskMetrics.maxDrawdownDuration}d recovery</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/** Equity curve visualization */
const EquityCurve = (props: { data: DailyPnL[] }) => {
    const maxReturn = createMemo(() => Math.max(...props.data.map(d => d.cumulativeReturn), ...props.data.map(d => d.benchmark), 1));
    const minReturn = createMemo(() => Math.min(...props.data.map(d => d.cumulativeReturn), ...props.data.map(d => d.benchmark), -1));
    const range = createMemo(() => maxReturn() - minReturn() || 1);

    const toY = (val: number) => {
        return 100 - ((val - minReturn()) / range()) * 100;
    };

    const portfolioPath = createMemo(() => {
        if (props.data.length === 0) return '';
        const step = 100 / Math.max(props.data.length - 1, 1);
        return props.data.map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${toY(d.cumulativeReturn).toFixed(2)}`).join(' ');
    });

    const benchmarkPath = createMemo(() => {
        if (props.data.length === 0) return '';
        const step = 100 / Math.max(props.data.length - 1, 1);
        return props.data.map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${toY(d.benchmark).toFixed(2)}`).join(' ');
    });

    const zeroY = createMemo(() => toY(0));
    const lastPort = createMemo(() => props.data.length > 0 ? props.data[props.data.length - 1].cumulativeReturn : 0);
    const lastBench = createMemo(() => props.data.length > 0 ? props.data[props.data.length - 1].benchmark : 0);

    return (
        <div class="p-5 bg-[#0c0c0e] rounded-2xl border border-white/[0.04]">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <ChartLineIcon />
                    Equity Curve
                </h3>
                <div class="flex items-center gap-4 text-[10px]">
                    <div class="flex items-center gap-1.5">
                        <div class="w-3 h-0.5 bg-cyan-400 rounded" />
                        <span class={pnlColor(lastPort())}>Portfolio {fmtPct(lastPort())}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <div class="w-3 h-0.5 bg-gray-500 rounded" style="opacity:0.5" />
                        <span class="text-gray-500">BTC {fmtPct(lastBench())}</span>
                    </div>
                </div>
            </div>
            <div class="relative" style="padding-bottom: 35%;">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full">
                    {/* Grid lines */}
                    <line x1="0" y1={zeroY()} x2="100" y2={zeroY()} stroke="rgba(255,255,255,0.06)" stroke-width="0.2" stroke-dasharray="1,1" />
                    <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.03)" stroke-width="0.15" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.03)" stroke-width="0.15" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.03)" stroke-width="0.15" />
                    {/* Benchmark */}
                    <path d={benchmarkPath()} fill="none" stroke="rgba(107,114,128,0.3)" stroke-width="0.4" />
                    {/* Portfolio */}
                    <path d={portfolioPath()} fill="none" stroke={lastPort() >= 0 ? '#34d399' : '#f87171'} stroke-width="0.6" />
                    {/* Fill under portfolio */}
                    <path d={`${portfolioPath()} L100,${zeroY()} L0,${zeroY()} Z`} fill={lastPort() >= 0 ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)'} />
                </svg>
            </div>
            {/* Y-axis labels */}
            <div class="flex items-center justify-between mt-2 text-[9px] text-gray-600 font-mono">
                <span>{props.data[0]?.date || ''}</span>
                <span>{props.data[Math.floor(props.data.length / 2)]?.date || ''}</span>
                <span>{props.data[props.data.length - 1]?.date || ''}</span>
            </div>
        </div>
    );
};

/** Executive summary KPI grid */
const ExecutiveSummary = (props: { report: PerformanceReport }) => {
    const r = () => props.report;
    const s = () => r().summary;

    const kpis = createMemo(() => [
        { label: 'Starting Capital', value: fmtKrw(s().startingCapital), sub: '', color: 'text-white' },
        { label: 'Ending Capital', value: fmtKrw(s().endingCapital), sub: fmtPct(s().totalReturn), color: pnlColor(s().totalReturn) },
        { label: 'Annualized Return', value: fmtPct(s().annualizedReturn), sub: '', color: pnlColor(s().annualizedReturn) },
        { label: 'Total Trades', value: s().totalTrades.toString(), sub: `${s().winningTrades}W ${s().losingTrades}L`, color: 'text-white' },
        { label: 'Avg Daily Return', value: fmtPct(s().avgDailyReturn, 3), sub: '', color: pnlColor(s().avgDailyReturn) },
        { label: 'Total Fees', value: fmtKrw(s().totalFees), sub: '', color: 'text-amber-400' },
        { label: 'Best Day', value: fmtKrw(s().bestDay.pnl), sub: `${s().bestDay.date} (${fmtPct(s().bestDay.pnlPercent)})`, color: 'text-emerald-400' },
        { label: 'Worst Day', value: fmtKrw(s().worstDay.pnl), sub: `${s().worstDay.date} (${fmtPct(s().worstDay.pnlPercent)})`, color: 'text-red-400' },
    ]);

    return (
        <div>
            <h3 class="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <BarChart3 class="w-4 h-4 text-cyan-400" />
                Executive Summary
            </h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <For each={kpis()}>
                    {(kpi) => (
                        <div class="p-3 bg-white/[0.015] rounded-xl border border-white/[0.04]">
                            <div class="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">{kpi.label}</div>
                            <div class={`text-sm font-black ${kpi.color}`}>{kpi.value}</div>
                            <Show when={kpi.sub}>
                                <div class="text-[9px] text-gray-500 mt-0.5">{kpi.sub}</div>
                            </Show>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

/** Risk metrics panel */
const RiskPanel = (props: { metrics: RiskMetrics }) => {
    const m = () => props.metrics;
    const riskItems = createMemo(() => [
        { label: 'Sharpe Ratio', value: fmtNum(m().sharpeRatio), desc: 'Risk-adjusted return', good: m().sharpeRatio >= 1 },
        { label: 'Sortino Ratio', value: fmtNum(m().sortinoRatio), desc: 'Downside risk-adjusted', good: m().sortinoRatio >= 1.5 },
        { label: 'Calmar Ratio', value: fmtNum(m().calmarRatio), desc: 'Return / Max DD', good: m().calmarRatio >= 1 },
        { label: 'Max Drawdown', value: fmtPct(m().maxDrawdown), desc: `${m().maxDrawdownDuration}d duration`, good: m().maxDrawdown > -10 },
        { label: 'Volatility (Ann.)', value: fmtPct(m().volatility), desc: 'Annualized std dev', good: m().volatility < 20 },
        { label: 'Beta (vs BTC)', value: fmtNum(m().beta), desc: 'Market sensitivity', good: m().beta < 1 },
        { label: 'Alpha (vs BTC)', value: fmtPct(m().alpha), desc: 'Excess return', good: m().alpha > 0 },
        { label: 'VaR 95%', value: fmtPct(m().var95), desc: 'Daily worst-case', good: m().var95 > -3 },
        { label: 'VaR 99%', value: fmtPct(m().var99), desc: '1% tail risk', good: m().var99 > -5 },
        { label: 'Profit Factor', value: fmtNum(m().profitFactor), desc: 'Gross profit / loss', good: m().profitFactor > 1.5 },
        { label: 'Win/Loss Ratio', value: fmtNum(m().avgWinLossRatio), desc: 'Avg win / avg loss', good: m().avgWinLossRatio > 1 },
        { label: 'Kelly Fraction', value: fmtPct(m().kellyFraction * 100, 1), desc: 'Optimal bet size', good: m().kellyFraction > 0.1 },
    ]);

    return (
        <div>
            <h3 class="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield class="w-4 h-4 text-cyan-400" />
                Risk Analytics
            </h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <For each={riskItems()}>
                    {(item) => (
                        <div class="p-3 bg-white/[0.015] rounded-xl border border-white/[0.04]">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{item.label}</span>
                                <div class={`w-1.5 h-1.5 rounded-full ${item.good ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            </div>
                            <div class="text-sm font-black text-white">{item.value}</div>
                            <div class="text-[9px] text-gray-600 mt-0.5">{item.desc}</div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

/** Asset attribution table */
const AssetAttribution = (props: { data: AssetPerformance[] }) => {
    const sorted = createMemo(() => [...props.data].sort((a, b) => b.totalPnl - a.totalPnl));

    return (
        <div>
            <h3 class="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target class="w-4 h-4 text-cyan-400" />
                Asset Attribution
            </h3>
            <div class="overflow-x-auto">
                <table class="w-full text-[11px]">
                    <thead>
                        <tr class="border-b border-white/[0.06]">
                            <th class="text-left py-2.5 px-3 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Asset</th>
                            <th class="text-right py-2.5 px-3 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Trades</th>
                            <th class="text-right py-2.5 px-3 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Win Rate</th>
                            <th class="text-right py-2.5 px-3 text-[9px] font-bold text-gray-500 uppercase tracking-wider">P&L</th>
                            <th class="text-right py-2.5 px-3 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Return</th>
                            <th class="text-right py-2.5 px-3 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Sharpe</th>
                            <th class="text-right py-2.5 px-3 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Alloc</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={sorted()}>
                            {(a) => (
                                <tr class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                    <td class="py-2.5 px-3 font-bold text-white">{a.asset}</td>
                                    <td class="py-2.5 px-3 text-right text-gray-400">{a.trades}</td>
                                    <td class="py-2.5 px-3 text-right">
                                        <span class={a.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>{a.winRate.toFixed(1)}%</span>
                                    </td>
                                    <td class={`py-2.5 px-3 text-right font-bold ${pnlColor(a.totalPnl)}`}>{fmtKrw(a.totalPnl)}</td>
                                    <td class={`py-2.5 px-3 text-right font-bold ${pnlColor(a.totalReturn)}`}>{fmtPct(a.totalReturn)}</td>
                                    <td class="py-2.5 px-3 text-right text-gray-400">{fmtNum(a.sharpeRatio)}</td>
                                    <td class="py-2.5 px-3 text-right text-gray-400">{a.allocation.toFixed(1)}%</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/** Strategy breakdown table */
const StrategyBreakdown = (props: { data: StrategyPerformance[] }) => {
    return (
        <div>
            <h3 class="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap class="w-4 h-4 text-cyan-400" />
                Strategy Breakdown
            </h3>
            <div class="space-y-3">
                <For each={props.data}>
                    {(s) => (
                        <div class="p-4 bg-white/[0.015] rounded-xl border border-white/[0.04]">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <div class="text-xs font-black text-white">{s.strategyName}</div>
                                    <div class="text-[10px] text-gray-500">{s.trades} trades | {s.signalsGenerated} signals ({s.signalsSkipped} skipped)</div>
                                </div>
                                <span class={`text-sm font-black ${pnlColor(s.totalPnl)}`}>{fmtKrw(s.totalPnl)}</span>
                            </div>
                            <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                <div>
                                    <div class="text-[9px] text-gray-600">Win Rate</div>
                                    <div class={`text-[11px] font-bold ${s.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{s.winRate.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div class="text-[9px] text-gray-600">Profit Factor</div>
                                    <div class={`text-[11px] font-bold ${s.profitFactor >= 1.5 ? 'text-emerald-400' : s.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>{fmtNum(s.profitFactor)}</div>
                                </div>
                                <div>
                                    <div class="text-[9px] text-gray-600">Return</div>
                                    <div class={`text-[11px] font-bold ${pnlColor(s.totalReturn)}`}>{fmtPct(s.totalReturn)}</div>
                                </div>
                                <div>
                                    <div class="text-[9px] text-gray-600">Avg Win</div>
                                    <div class="text-[11px] font-bold text-emerald-400">{fmtKrw(s.avgWin)}</div>
                                </div>
                                <div>
                                    <div class="text-[9px] text-gray-600">Avg Loss</div>
                                    <div class="text-[11px] font-bold text-red-400">{fmtKrw(-s.avgLoss)}</div>
                                </div>
                                <div>
                                    <div class="text-[9px] text-gray-600">Max Consec. Loss</div>
                                    <div class="text-[11px] font-bold text-white">{s.maxConsecutiveLosses}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

/** Drawdown analysis */
const DrawdownAnalysis = (props: { events: DrawdownEvent[] }) => {
    return (
        <div>
            <h3 class="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle class="w-4 h-4 text-red-400" />
                Drawdown Analysis
            </h3>
            <div class="space-y-2">
                <For each={props.events}>
                    {(dd, i) => (
                        <div class="p-4 bg-red-500/[0.03] rounded-xl border border-red-500/10">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-white">Drawdown #{i() + 1}</span>
                                <span class="text-sm font-black text-red-400">{fmtPct(dd.depth)}</span>
                            </div>
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                                <div>
                                    <div class="text-gray-600">Period</div>
                                    <div class="text-gray-300 font-bold">{dd.startDate} ~ {dd.endDate || 'ongoing'}</div>
                                </div>
                                <div>
                                    <div class="text-gray-600">Duration</div>
                                    <div class="text-gray-300 font-bold">{dd.duration} days</div>
                                </div>
                                <div>
                                    <div class="text-gray-600">Recovery</div>
                                    <div class={`font-bold ${dd.recovery ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {dd.recovery ? `${dd.recovery} days` : 'Not recovered'}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-gray-600">Peak-to-Trough</div>
                                    <div class="text-gray-300 font-bold">{fmtKrw(dd.peakValue)} {'\u2192'} {fmtKrw(dd.troughValue)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

/** Benchmark comparison */
const BenchmarkComparison = (props: { report: PerformanceReport }) => {
    const r = () => props.report;
    const items = createMemo(() => [
        { label: 'Portfolio', value: r().summary.totalReturn, primary: true },
        { label: 'BTC', value: r().benchmarks.btcReturn, primary: false },
        { label: 'ETH', value: r().benchmarks.ethReturn, primary: false },
        { label: 'Market Avg', value: r().benchmarks.marketAvg, primary: false },
    ]);

    const maxAbs = createMemo(() => Math.max(...items().map(i => Math.abs(i.value)), 1));

    return (
        <div>
            <h3 class="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity class="w-4 h-4 text-cyan-400" />
                Benchmark Comparison
            </h3>
            <div class="p-4 bg-white/[0.015] rounded-xl border border-white/[0.04] space-y-3">
                <For each={items()}>
                    {(item) => {
                        const barWidth = () => Math.abs(item.value) / maxAbs() * 100;
                        return (
                            <div class="flex items-center gap-3">
                                <span class={`text-[10px] font-bold w-16 flex-shrink-0 ${item.primary ? 'text-cyan-400' : 'text-gray-500'}`}>{item.label}</span>
                                <div class="flex-1 flex items-center gap-2 h-5">
                                    <div class="flex-1 relative h-2 bg-white/[0.03] rounded-full overflow-hidden">
                                        <div
                                            class={`absolute top-0 h-full rounded-full transition-all ${item.value >= 0 ? 'bg-emerald-500/50 left-1/2' : 'bg-red-500/50 right-1/2'}`}
                                            style={`width: ${barWidth() / 2}%`}
                                        />
                                        <div class="absolute left-1/2 top-0 w-px h-full bg-white/10" />
                                    </div>
                                </div>
                                <span class={`text-xs font-black w-16 text-right ${pnlColor(item.value)}`}>{fmtPct(item.value)}</span>
                            </div>
                        );
                    }}
                </For>
                <div class="pt-3 border-t border-white/[0.04] flex items-center justify-between">
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Outperformance vs BTC</span>
                    <span class={`text-sm font-black ${pnlColor(r().benchmarks.outperformance)}`}>{fmtPct(r().benchmarks.outperformance)}</span>
                </div>
            </div>
        </div>
    );
};

/** Monthly return heatmap (for annual reports) */
const MonthlyHeatmap = (props: { data: MonthlyReturn[] }) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const getColor = (ret: number) => {
        if (ret >= 5) return 'bg-emerald-500/40 text-emerald-300';
        if (ret >= 2) return 'bg-emerald-500/20 text-emerald-400';
        if (ret >= 0) return 'bg-emerald-500/8 text-emerald-400/70';
        if (ret >= -2) return 'bg-red-500/8 text-red-400/70';
        if (ret >= -5) return 'bg-red-500/20 text-red-400';
        return 'bg-red-500/40 text-red-300';
    };

    return (
        <div>
            <h3 class="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar class="w-4 h-4 text-cyan-400" />
                Monthly Returns
            </h3>
            <div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                <For each={props.data}>
                    {(m) => (
                        <div class={`p-3 rounded-xl text-center border border-white/[0.04] ${getColor(m.return)}`}>
                            <div class="text-[9px] font-bold uppercase tracking-wider opacity-60 mb-1">{months[m.month - 1]}</div>
                            <div class="text-sm font-black">{fmtPct(m.return, 1)}</div>
                            <div class="text-[8px] opacity-50 mt-0.5">{m.trades}t</div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

/** Recent trade log */
const TradeLog = (props: { trades: TradeRecord[]; limit?: number }) => {
    const limit = () => props.limit || 20;
    const sorted = createMemo(() =>
        [...props.trades].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit())
    );

    return (
        <div>
            <h3 class="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock class="w-4 h-4 text-cyan-400" />
                Trade Log
                <span class="text-[9px] font-normal text-gray-600 ml-1">(latest {limit()} of {props.trades.length})</span>
            </h3>
            <div class="overflow-x-auto">
                <table class="w-full text-[10px]">
                    <thead>
                        <tr class="border-b border-white/[0.06]">
                            <th class="text-left py-2 px-2 text-[8px] font-bold text-gray-500 uppercase tracking-wider">Time</th>
                            <th class="text-left py-2 px-2 text-[8px] font-bold text-gray-500 uppercase tracking-wider">Asset</th>
                            <th class="text-center py-2 px-2 text-[8px] font-bold text-gray-500 uppercase tracking-wider">Side</th>
                            <th class="text-right py-2 px-2 text-[8px] font-bold text-gray-500 uppercase tracking-wider">Value</th>
                            <th class="text-right py-2 px-2 text-[8px] font-bold text-gray-500 uppercase tracking-wider">P&L</th>
                            <th class="text-left py-2 px-2 text-[8px] font-bold text-gray-500 uppercase tracking-wider">Strategy</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={sorted()}>
                            {(t) => (
                                <tr class="border-b border-white/[0.02] hover:bg-white/[0.015] transition-colors">
                                    <td class="py-1.5 px-2 text-gray-500 font-mono">{new Date(t.timestamp).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td class="py-1.5 px-2 font-bold text-white">{t.asset}</td>
                                    <td class="py-1.5 px-2 text-center">
                                        <span class={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${t.side === 'buy' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                            {t.side}
                                        </span>
                                    </td>
                                    <td class="py-1.5 px-2 text-right text-gray-400">{fmtKrw(t.value)}</td>
                                    <td class={`py-1.5 px-2 text-right font-bold ${pnlColor(t.pnl)}`}>{fmtKrw(t.pnl)}</td>
                                    <td class="py-1.5 px-2 text-gray-500">{t.strategy}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/** Disclaimer / footer */
const ReportDisclaimer = () => (
    <div class="p-4 bg-white/[0.01] rounded-xl border border-white/[0.04]">
        <div class="flex items-start gap-2">
            <Info class="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
            <div class="text-[9px] text-gray-600 leading-relaxed space-y-1">
                <p><span class="font-bold text-gray-500">Disclaimer:</span> This report is generated automatically by Vision Quant Engine and is provided for informational purposes only. Past performance does not guarantee future results. All trading involves risk, including the possibility of loss of principal. The metrics shown are based on historical data and may not reflect actual market conditions. Vision Chain assumes no responsibility for trading decisions made based on this report.</p>
                <p class="font-bold text-gray-500">Confidential - For authorized account holder only.</p>
            </div>
        </div>
    </div>
);

// ─── Main Component ────────────────────────────────────────────────────────

interface QuantReportProps {
    onBack?: () => void;
}

const QuantReport = (props: QuantReportProps): JSX.Element => {
    const [period, setPeriod] = createSignal<ReportPeriod>('weekly');
    const [report, setReport] = createSignal<PerformanceReport | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);

    const loadReport = (p: ReportPeriod) => {
        setIsLoading(true);
        setPeriod(p);
        // Simulate async load
        setTimeout(() => {
            setReport(generateDemoReport(p));
            setIsLoading(false);
        }, 400);
    };

    onMount(() => loadReport('weekly'));

    return (
        <div class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8">
            <div class="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Back + Period Selector */}
                <div class="flex items-center justify-between">
                    <Show when={props.onBack}>
                        <button
                            onClick={props.onBack}
                            class="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-white transition-colors"
                        >
                            <ChevronLeft class="w-4 h-4" />
                            Back to Quant Engine
                        </button>
                    </Show>
                    <div class="flex items-center gap-1 bg-[#111113]/60 rounded-xl p-1 border border-white/[0.04] ml-auto">
                        {(['weekly', 'monthly', 'annual'] as ReportPeriod[]).map(p => (
                            <button
                                onClick={() => loadReport(p)}
                                class={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${period() === p
                                    ? 'bg-white/[0.08] text-white shadow-lg'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                                    }`}
                            >
                                {p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : 'Annual'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Loading */}
                <Show when={isLoading()}>
                    <div class="flex flex-col items-center justify-center py-20">
                        <div class="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mb-3" />
                        <span class="text-xs text-gray-500">Generating {period()} report...</span>
                    </div>
                </Show>

                {/* Report Content */}
                <Show when={!isLoading() && report()}>
                    {(() => {
                        const r = report()!;
                        return (
                            <div class="space-y-6">
                                {/* Header */}
                                <ReportHeader report={r} />

                                {/* Equity Curve */}
                                <EquityCurve data={r.dailyPnl} />

                                {/* Executive Summary */}
                                <ExecutiveSummary report={r} />

                                {/* Benchmark Comparison */}
                                <BenchmarkComparison report={r} />

                                {/* Risk Analytics */}
                                <RiskPanel metrics={r.riskMetrics} />

                                {/* Asset Attribution */}
                                <AssetAttribution data={r.assetPerformance} />

                                {/* Strategy Breakdown */}
                                <StrategyBreakdown data={r.strategyPerformance} />

                                {/* Drawdown Analysis */}
                                <DrawdownAnalysis events={r.drawdowns} />

                                {/* Monthly Heatmap (for annual/monthly) */}
                                <Show when={r.monthlyReturns.length > 0}>
                                    <MonthlyHeatmap data={r.monthlyReturns} />
                                </Show>

                                {/* Trade Log */}
                                <TradeLog trades={r.trades} limit={period() === 'weekly' ? 18 : 25} />

                                {/* Disclaimer */}
                                <ReportDisclaimer />
                            </div>
                        );
                    })()}
                </Show>
            </div>
        </div>
    );
};

export default QuantReport;
