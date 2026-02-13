import { Component, createSignal, onMount, Show, For, createMemo } from 'solid-js';
import { VisionInsightService, type InsightSnapshot, type AgentViewData } from '../../services/visionInsightService';

const VisionInsight: Component = () => {
    const [snapshot, setSnapshot] = createSignal<InsightSnapshot | null>(null);
    const [agentData, setAgentData] = createSignal<AgentViewData | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [agentViewActive, setAgentViewActive] = createSignal(false);
    const [error, setError] = createSignal('');

    onMount(async () => {
        try {
            const data = await VisionInsightService.fetchSnapshot();
            setSnapshot(data);
        } catch (e: any) {
            setError(e.message || 'Failed to load insight data');
        } finally {
            setLoading(false);
        }
    });

    const toggleAgentView = async () => {
        if (!agentViewActive() && !agentData()) {
            const data = await VisionInsightService.fetchAgentViewData();
            setAgentData(data);
        }
        setAgentViewActive(!agentViewActive());
    };

    // ASI gauge angle calculation (0-180 degrees for semi-circle)
    const asiAngle = createMemo(() => {
        const score = snapshot()?.asi?.score || 50;
        return (score / 100) * 180;
    });

    // ASI gauge color based on score
    const asiColor = createMemo(() => {
        const score = snapshot()?.asi?.score || 50;
        if (score >= 75) return '#22c55e'; // Green - Extreme Greed
        if (score >= 60) return '#4ade80'; // Light green - Greed
        if (score >= 45) return '#fbbf24'; // Yellow - Neutral
        if (score >= 25) return '#f97316'; // Orange - Fear
        return '#ef4444'; // Red - Extreme Fear
    });

    // Severity badge colors
    const severityConfig = (severity: string) => {
        switch (severity) {
            case 'critical':
                return { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: 'CRITICAL' };
            case 'warning':
                return { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', label: 'WARNING' };
            default:
                return { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', label: 'INFO' };
        }
    };

    // Impact direction config
    const impactConfig = (direction: string) => {
        switch (direction) {
            case 'bullish':
                return { color: '#22c55e', label: 'Bullish', arrow: '\u2191' };
            case 'bearish':
                return { color: '#ef4444', label: 'Bearish', arrow: '\u2193' };
            default:
                return { color: '#a3a3a3', label: 'Neutral', arrow: '\u2192' };
        }
    };

    // Format large numbers
    const formatValue = (value: number) => {
        if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
    };

    return (
        <div style={{
            'min-height': '100%',
            background: '#0a0a0b',
            color: '#ffffff',
            padding: '20px',
            'font-family': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'space-between',
                'margin-bottom': '24px',
                'flex-wrap': 'wrap',
                gap: '12px',
            }}>
                <div>
                    <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
                        <h1 style={{
                            'font-size': '24px',
                            'font-weight': '800',
                            margin: '0',
                            'letter-spacing': '-0.5px',
                            background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
                            '-webkit-background-clip': 'text',
                            '-webkit-text-fill-color': 'transparent',
                        }}>Vision Insight</h1>
                        <span style={{
                            'font-size': '10px',
                            'font-weight': '700',
                            color: '#a78bfa',
                            background: 'rgba(167,139,250,0.1)',
                            padding: '3px 8px',
                            'border-radius': '12px',
                            'letter-spacing': '0.5px',
                        }}>Powered by Blocky</span>
                    </div>
                    <p style={{
                        margin: '4px 0 0',
                        'font-size': '12px',
                        color: '#666',
                    }}>AI-Powered Crypto Intelligence</p>
                </div>
                {/* Agent View Toggle */}
                <button
                    onClick={toggleAgentView}
                    style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        'border-radius': '10px',
                        border: `1px solid ${agentViewActive() ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        background: agentViewActive() ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.03)',
                        color: agentViewActive() ? '#22d3ee' : '#888',
                        'font-size': '12px',
                        'font-weight': '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                    </svg>
                    Agent View
                </button>
            </div>

            {/* Loading State */}
            <Show when={loading()}>
                <div style={{
                    display: 'flex',
                    'flex-direction': 'column',
                    'align-items': 'center',
                    'justify-content': 'center',
                    height: '400px',
                    gap: '16px',
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid rgba(34,211,238,0.2)',
                        'border-top-color': '#22d3ee',
                        'border-radius': '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    <p style={{ color: '#666', 'font-size': '14px' }}>Loading intelligence data...</p>
                </div>
            </Show>

            {/* Agent View - JSON Display */}
            <Show when={agentViewActive() && !loading()}>
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(34,211,238,0.2)',
                    'border-radius': '16px',
                    padding: '24px',
                    'font-family': "'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    'font-size': '12px',
                    'line-height': '1.6',
                    'overflow-x': 'auto',
                    'white-space': 'pre-wrap',
                    'word-break': 'break-all',
                    color: '#22d3ee',
                }}>
                    <div style={{ 'margin-bottom': '12px', display: 'flex', 'align-items': 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        <span style={{ 'font-weight': '700', 'letter-spacing': '1px' }}>AGENT DATA STREAM</span>
                    </div>
                    {JSON.stringify(agentData() || snapshot(), null, 2)}
                </div>
            </Show>

            {/* Main Dashboard - Human UI */}
            <Show when={!agentViewActive() && !loading() && snapshot()}>
                {/* Market Pulse Strip */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    border: '1px solid rgba(255,255,255,0.06)',
                    'border-radius': '20px',
                    padding: '24px',
                    'margin-bottom': '20px',
                    display: 'flex',
                    'align-items': 'center',
                    gap: '24px',
                    'flex-wrap': 'wrap',
                }}>
                    {/* ASI Gauge */}
                    <div style={{
                        position: 'relative',
                        width: '140px',
                        height: '80px',
                        'flex-shrink': '0',
                    }}>
                        <svg viewBox="0 0 140 80" style={{ width: '100%', height: '100%' }}>
                            {/* Background arc */}
                            <path
                                d="M 15 75 A 55 55 0 0 1 125 75"
                                fill="none"
                                stroke="rgba(255,255,255,0.06)"
                                stroke-width="10"
                                stroke-linecap="round"
                            />
                            {/* Gradient arc - Fear to Greed */}
                            <defs>
                                <linearGradient id="asiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stop-color="#ef4444" />
                                    <stop offset="25%" stop-color="#f97316" />
                                    <stop offset="50%" stop-color="#fbbf24" />
                                    <stop offset="75%" stop-color="#4ade80" />
                                    <stop offset="100%" stop-color="#22c55e" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M 15 75 A 55 55 0 0 1 125 75"
                                fill="none"
                                stroke="url(#asiGradient)"
                                stroke-width="10"
                                stroke-linecap="round"
                                stroke-dasharray={`${(asiAngle() / 180) * 173} 173`}
                            />
                            {/* Needle */}
                            <line
                                x1="70"
                                y1="75"
                                x2={70 + 45 * Math.cos((Math.PI * (180 - asiAngle())) / 180)}
                                y2={75 - 45 * Math.sin((Math.PI * (180 - asiAngle())) / 180)}
                                stroke={asiColor()}
                                stroke-width="2"
                                stroke-linecap="round"
                            />
                            <circle cx="70" cy="75" r="4" fill={asiColor()} />
                        </svg>
                    </div>
                    {/* ASI Score + Info */}
                    <div style={{ flex: '1', 'min-width': '200px' }}>
                        <div style={{ display: 'flex', 'align-items': 'baseline', gap: '8px', 'margin-bottom': '4px' }}>
                            <span style={{
                                'font-size': '32px',
                                'font-weight': '800',
                                color: asiColor(),
                                'letter-spacing': '-1px',
                            }}>{snapshot()!.asi.score}</span>
                            <span style={{ 'font-size': '14px', color: '#888' }}>/100</span>
                            <span style={{
                                'font-size': '12px',
                                'font-weight': '700',
                                color: asiColor(),
                                background: `${asiColor()}15`,
                                padding: '2px 8px',
                                'border-radius': '8px',
                            }}>{snapshot()!.asi.label}</span>
                        </div>
                        <p style={{
                            margin: '0 0 6px',
                            'font-size': '13px',
                            color: '#ccc',
                            'line-height': '1.4',
                        }}>{snapshot()!.asi.summary}</p>
                        <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                            <span style={{ 'font-size': '10px', color: '#666', 'text-transform': 'uppercase', 'letter-spacing': '1px' }}>AGENT SENTIMENT INDEX</span>
                            <Show when={snapshot()!.asi.trend !== 'STABLE'}>
                                <span style={{
                                    'font-size': '11px',
                                    'font-weight': '700',
                                    color: snapshot()!.asi.trend === 'BULLISH' ? '#22c55e' : '#ef4444',
                                }}>
                                    {snapshot()!.asi.trend === 'BULLISH' ? '\u2191' : '\u2193'}
                                    {' '}vs prev
                                </span>
                            </Show>
                        </div>
                    </div>
                    {/* Articles Count */}
                    <div style={{
                        'text-align': 'right',
                        'flex-shrink': '0',
                    }}>
                        <div style={{ 'font-size': '20px', 'font-weight': '700', color: '#22d3ee' }}>
                            {snapshot()!.articlesAnalyzed}
                        </div>
                        <div style={{ 'font-size': '10px', color: '#666', 'text-transform': 'uppercase', 'letter-spacing': '0.5px' }}>
                            Articles Analyzed
                        </div>
                    </div>
                </div>

                {/* 3-Column Widget Grid */}
                <div style={{
                    display: 'grid',
                    'grid-template-columns': 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px',
                    'margin-bottom': '20px',
                }}>
                    {/* === Alpha Alert Module === */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '16px',
                        padding: '20px',
                    }}>
                        <div style={{
                            display: 'flex',
                            'align-items': 'center',
                            gap: '8px',
                            'margin-bottom': '16px',
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <h3 style={{ margin: '0', 'font-size': '14px', 'font-weight': '700', color: '#fff' }}>Alpha Alert</h3>
                            <span style={{ 'font-size': '10px', color: '#666', 'margin-left': 'auto' }}>Top Impact</span>
                        </div>

                        <Show when={snapshot()!.alphaAlerts.length > 0} fallback={
                            <p style={{ color: '#555', 'font-size': '13px', 'text-align': 'center', padding: '20px 0' }}>No alerts yet. Collecting data...</p>
                        }>
                            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
                                <For each={snapshot()!.alphaAlerts}>
                                    {(alert) => {
                                        const sev = severityConfig(alert.severity);
                                        const imp = impactConfig(alert.impactDirection);
                                        return (
                                            <div style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.04)',
                                                'border-radius': '12px',
                                                padding: '14px',
                                            }}>
                                                <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '8px' }}>
                                                    <span style={{
                                                        'font-size': '9px',
                                                        'font-weight': '800',
                                                        color: sev.text,
                                                        background: sev.bg,
                                                        padding: '2px 6px',
                                                        'border-radius': '4px',
                                                        'letter-spacing': '0.5px',
                                                    }}>{sev.label}</span>
                                                    <span style={{
                                                        'font-size': '9px',
                                                        'font-weight': '700',
                                                        color: imp.color,
                                                    }}>{imp.arrow} {imp.label}</span>
                                                </div>
                                                <p style={{
                                                    margin: '0 0 8px',
                                                    'font-size': '13px',
                                                    'font-weight': '600',
                                                    color: '#eee',
                                                    'line-height': '1.4',
                                                }}>{alert.headline}</p>
                                                <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
                                                    <span style={{ 'font-size': '10px', color: '#666' }}>{alert.source}</span>
                                                    <Show when={alert.url}>
                                                        <a
                                                            href={alert.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                'font-size': '10px',
                                                                color: '#a78bfa',
                                                                'text-decoration': 'none',
                                                                'font-weight': '600',
                                                            }}
                                                        >View in Blocky</a>
                                                    </Show>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </Show>
                    </div>

                    {/* === Whale Watch Module === */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '16px',
                        padding: '20px',
                    }}>
                        <div style={{
                            display: 'flex',
                            'align-items': 'center',
                            gap: '8px',
                            'margin-bottom': '16px',
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="12" x2="16" y2="12" />
                            </svg>
                            <h3 style={{ margin: '0', 'font-size': '14px', 'font-weight': '700', color: '#fff' }}>Whale Watch</h3>
                            <span style={{ 'font-size': '10px', color: '#666', 'margin-left': 'auto' }}>24h Flow</span>
                        </div>

                        {/* Net Flow Direction */}
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            'border-radius': '12px',
                            padding: '14px',
                            'margin-bottom': '12px',
                            'text-align': 'center',
                        }}>
                            <div style={{
                                'font-size': '11px',
                                color: '#888',
                                'text-transform': 'uppercase',
                                'letter-spacing': '1px',
                                'margin-bottom': '6px',
                            }}>Net Flow</div>
                            <div style={{
                                'font-size': '20px',
                                'font-weight': '800',
                                color: snapshot()!.whaleWatch.flowDirection === 'accumulation' ? '#22c55e' :
                                    snapshot()!.whaleWatch.flowDirection === 'distribution' ? '#ef4444' : '#888',
                            }}>
                                {snapshot()!.whaleWatch.netFlow > 0 ? '+' : ''}
                                {formatValue(snapshot()!.whaleWatch.netFlow)}
                            </div>
                            <div style={{
                                'font-size': '11px',
                                'font-weight': '700',
                                color: snapshot()!.whaleWatch.flowDirection === 'accumulation' ? '#22c55e' :
                                    snapshot()!.whaleWatch.flowDirection === 'distribution' ? '#ef4444' : '#888',
                                'text-transform': 'uppercase',
                            }}>
                                {snapshot()!.whaleWatch.flowDirection}
                            </div>
                        </div>

                        {/* Flow Bar */}
                        <div style={{ 'margin-bottom': '12px' }}>
                            <div style={{ display: 'flex', 'justify-content': 'space-between', 'margin-bottom': '6px' }}>
                                <span style={{ 'font-size': '10px', color: '#22c55e' }}>Outflow {formatValue(snapshot()!.whaleWatch.exchangeOutflow)}</span>
                                <span style={{ 'font-size': '10px', color: '#ef4444' }}>Inflow {formatValue(snapshot()!.whaleWatch.exchangeInflow)}</span>
                            </div>
                            <div style={{ display: 'flex', height: '6px', 'border-radius': '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                                {(() => {
                                    const total = snapshot()!.whaleWatch.exchangeInflow + snapshot()!.whaleWatch.exchangeOutflow;
                                    const outPct = total > 0 ? (snapshot()!.whaleWatch.exchangeOutflow / total) * 100 : 50;
                                    return (
                                        <>
                                            <div style={{ width: `${outPct}%`, background: '#22c55e', transition: 'width 0.5s ease' }} />
                                            <div style={{ width: `${100 - outPct}%`, background: '#ef4444', transition: 'width 0.5s ease' }} />
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Agent Activity */}
                        <Show when={snapshot()!.whaleWatch.topAgentMoves?.length > 0}>
                            <div style={{ 'border-top': '1px solid rgba(255,255,255,0.04)', 'padding-top': '12px' }}>
                                <div style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', 'letter-spacing': '0.5px', 'margin-bottom': '8px' }}>
                                    Agent Activity
                                </div>
                                <For each={snapshot()!.whaleWatch.topAgentMoves.slice(0, 3)}>
                                    {(move) => (
                                        <div style={{
                                            display: 'flex',
                                            'align-items': 'center',
                                            gap: '6px',
                                            'font-size': '11px',
                                            'margin-bottom': '4px',
                                            color: '#aaa',
                                        }}>
                                            <span style={{
                                                width: '6px',
                                                height: '6px',
                                                'border-radius': '50%',
                                                background: move.action === 'stake' ? '#22c55e' : '#22d3ee',
                                                'flex-shrink': '0',
                                            }} />
                                            <span style={{ 'font-weight': '600', color: '#ddd' }}>{move.agentName}</span>
                                            <span>{move.action === 'stake' ? 'staked' : 'transferred'}</span>
                                            <span style={{ color: '#22d3ee', 'font-weight': '600' }}>{move.amount} VCN</span>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>

                        <Show when={snapshot()!.whaleWatch.dataSource === 'placeholder'}>
                            <p style={{ 'font-size': '10px', color: '#444', 'text-align': 'center', margin: '12px 0 0' }}>
                                Configure Whale Alert API for live data
                            </p>
                        </Show>
                    </div>

                    {/* === Narrative & Calendar Module === */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '16px',
                        padding: '20px',
                    }}>
                        <div style={{
                            display: 'flex',
                            'align-items': 'center',
                            gap: '8px',
                            'margin-bottom': '16px',
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <h3 style={{ margin: '0', 'font-size': '14px', 'font-weight': '700', color: '#fff' }}>Narrative & Calendar</h3>
                        </div>

                        {/* Trending Keywords */}
                        <div style={{ 'margin-bottom': '16px' }}>
                            <div style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', 'letter-spacing': '0.5px', 'margin-bottom': '10px' }}>
                                Trending
                            </div>
                            <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px' }}>
                                <Show when={snapshot()!.narratives.trendingKeywords.length > 0} fallback={
                                    <span style={{ 'font-size': '12px', color: '#555' }}>Collecting keywords...</span>
                                }>
                                    <For each={snapshot()!.narratives.trendingKeywords}>
                                        {(kw, idx) => (
                                            <span style={{
                                                'font-size': '11px',
                                                'font-weight': '600',
                                                color: idx() < 3 ? '#a78bfa' : '#888',
                                                background: idx() < 3 ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.04)',
                                                padding: '4px 10px',
                                                'border-radius': '20px',
                                                border: `1px solid ${idx() < 3 ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                            }}>
                                                #{kw.keyword}
                                            </span>
                                        )}
                                    </For>
                                </Show>
                            </div>
                        </div>

                        {/* Macro Economic Calendar */}
                        <div>
                            <div style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', 'letter-spacing': '0.5px', 'margin-bottom': '10px' }}>
                                US Macro Calendar
                            </div>
                            <Show when={snapshot()!.narratives.calendar.length > 0} fallback={
                                <p style={{ 'font-size': '12px', color: '#555', margin: '0' }}>
                                    Configure Finnhub API for economic events
                                </p>
                            }>
                                <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
                                    <For each={snapshot()!.narratives.calendar}>
                                        {(event) => (
                                            <div style={{
                                                display: 'flex',
                                                'align-items': 'center',
                                                gap: '10px',
                                                padding: '10px',
                                                background: 'rgba(255,255,255,0.02)',
                                                'border-radius': '8px',
                                                border: '1px solid rgba(255,255,255,0.04)',
                                            }}>
                                                <span style={{
                                                    'font-size': '11px',
                                                    'font-weight': '800',
                                                    color: event.daysUntil <= 2 ? '#ef4444' : event.daysUntil <= 5 ? '#f59e0b' : '#22d3ee',
                                                    'min-width': '42px',
                                                    'text-align': 'center',
                                                    'flex-shrink': '0',
                                                }}>
                                                    D-{event.daysUntil}
                                                </span>
                                                <div style={{ flex: '1', 'min-width': '0' }}>
                                                    <div style={{
                                                        'font-size': '12px',
                                                        'font-weight': '600',
                                                        color: '#ddd',
                                                        'white-space': 'nowrap',
                                                        overflow: 'hidden',
                                                        'text-overflow': 'ellipsis',
                                                    }}>{event.label}</div>
                                                    <div style={{ 'font-size': '10px', color: '#666' }}>{event.date}</div>
                                                </div>
                                                <span style={{
                                                    'font-size': '8px',
                                                    'font-weight': '800',
                                                    color: event.impact === 'high' ? '#ef4444' : event.impact === 'medium' ? '#f59e0b' : '#666',
                                                    'text-transform': 'uppercase',
                                                    'letter-spacing': '0.5px',
                                                }}>
                                                    {event.impact}
                                                </span>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* Blocky CTA Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(34,211,238,0.08))',
                    border: '1px solid rgba(167,139,250,0.15)',
                    'border-radius': '16px',
                    padding: '24px',
                    'text-align': 'center',
                }}>
                    <p style={{
                        margin: '0 0 12px',
                        'font-size': '14px',
                        color: '#ccc',
                    }}>Want real-time feeds and deep analysis?</p>
                    <button style={{
                        padding: '12px 28px',
                        'border-radius': '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
                        color: '#000',
                        'font-size': '13px',
                        'font-weight': '800',
                        cursor: 'pointer',
                        'letter-spacing': '0.5px',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 30px rgba(167,139,250,0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        Open Full Blocky Terminal
                    </button>
                    <p style={{
                        margin: '12px 0 0',
                        'font-size': '11px',
                        color: '#666',
                    }}>Subscribe to Blocky Premium with VCN and earn +10 Vision Score</p>
                </div>

                {/* Last Updated */}
                <Show when={snapshot()!.lastUpdated}>
                    <p style={{
                        'text-align': 'center',
                        margin: '16px 0 0',
                        'font-size': '10px',
                        color: '#444',
                    }}>
                        Last updated: {new Date(snapshot()!.lastUpdated!).toLocaleString()}
                    </p>
                </Show>
            </Show>

            {/* Global animation keyframes */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default VisionInsight;
