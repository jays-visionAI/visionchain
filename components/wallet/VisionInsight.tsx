import { Component, createSignal, onMount, Show, For, createMemo } from 'solid-js';
import { VisionInsightService, type InsightSnapshot, type AgentViewData, type NewsArticle, type CategoryInfo, type MarketBrief } from '../../services/visionInsightService';

const VisionInsight: Component = () => {
    const [snapshot, setSnapshot] = createSignal<InsightSnapshot | null>(null);
    const [agentData, setAgentData] = createSignal<AgentViewData | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [agentViewActive, setAgentViewActive] = createSignal(false);
    const [activeCategory, setActiveCategory] = createSignal('all');
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

    // Filter news by active category
    const filteredNews = createMemo(() => {
        const feed = snapshot()?.newsFeed || [];
        const cat = activeCategory();
        if (cat === 'all') return feed;
        return feed.filter(a => a.category === cat);
    });

    // Categories from server or fallback
    const categories = createMemo(() => snapshot()?.categories || []);

    // Count articles per category
    const categoryCounts = createMemo(() => {
        const feed = snapshot()?.newsFeed || [];
        const counts: Record<string, number> = { all: feed.length };
        for (const article of feed) {
            counts[article.category] = (counts[article.category] || 0) + 1;
        }
        return counts;
    });

    // ASI gauge
    const asiAngle = createMemo(() => ((snapshot()?.asi?.score || 50) / 100) * 180);
    const asiColor = createMemo(() => {
        const score = snapshot()?.asi?.score || 50;
        if (score >= 75) return '#22c55e';
        if (score >= 60) return '#4ade80';
        if (score >= 45) return '#fbbf24';
        if (score >= 25) return '#f97316';
        return '#ef4444';
    });

    // Sentiment badge
    const sentimentBadge = (label: string) => {
        switch (label) {
            case 'bullish': return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
            case 'bearish': return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
            default: return { color: '#a3a3a3', bg: 'rgba(163,163,163,0.1)' };
        }
    };

    // Severity badge
    const severityBadge = (severity: string) => {
        switch (severity) {
            case 'critical': return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
            case 'warning': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
            default: return { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
        }
    };

    // Category icon SVGs
    const categoryIcon = (catId: string) => {
        switch (catId) {
            case 'all':
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
            case 'bitcoin':
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11.5 4v3m0 10v3m4-16v3m0 10v3" /><path d="M8 8h5.5a2.5 2.5 0 0 1 0 5H8V8z" /><path d="M8 13h6.5a2.5 2.5 0 0 1 0 5H8v-5z" /></svg>;
            case 'ethereum':
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 4,12 12,16 20,12" /><polygon points="4,12 12,22 20,12 12,16" /></svg>;
            case 'defi':
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" /></svg>;
            case 'regulation':
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
            case 'ai_web3':
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20h6v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z" /><line x1="10" y1="22" x2="14" y2="22" /></svg>;
            case 'nft_gaming':
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2" /><line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><circle cx="16" cy="11" r="1" /><circle cx="18" cy="13" r="1" /></svg>;
            case 'altcoin':
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10" /><polyline points="18 14 12 8 6 14" /></svg>;
            case 'korea':
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
            default:
                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /></svg>;
        }
    };

    // Category colors
    const categoryColor = (catId: string) => {
        const colors: Record<string, string> = {
            all: '#a78bfa',
            bitcoin: '#f7931a',
            ethereum: '#627eea',
            defi: '#22c55e',
            regulation: '#ef4444',
            ai_web3: '#06b6d4',
            nft_gaming: '#ec4899',
            altcoin: '#8b5cf6',
            korea: '#3b82f6',
        };
        return colors[catId] || '#888';
    };

    // Time ago formatter
    const timeAgo = (dateStr: string | null) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    };

    const formatValue = (value: number) => {
        if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
    };

    // Source badge color
    const sourceBadgeColor = (sourceId: string) => {
        if (sourceId.startsWith('gnews')) return '#f59e0b';
        const map: Record<string, string> = {
            bitcoinmag: '#f7931a', coindesk: '#0052ff', decrypt: '#00c3a5',
            theblock: '#1a1a2e', cointelegraph: '#22c55e', blockhead: '#8b5cf6',
            coingape: '#3b82f6', decenter: '#ef4444', blockmedia: '#06b6d4',
        };
        return map[sourceId] || '#666';
    };

    // Trading bias config
    const biasConfig = (bias: string) => {
        switch (bias) {
            case 'LONG': return { color: '#22c55e', icon: '↑', bg: 'rgba(34,197,94,0.1)' };
            case 'SHORT': return { color: '#ef4444', icon: '↓', bg: 'rgba(239,68,68,0.1)' };
            default: return { color: '#fbbf24', icon: '↔', bg: 'rgba(251,191,36,0.08)' };
        }
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
                'margin-bottom': '20px',
                'flex-wrap': 'wrap',
                gap: '12px',
            }}>
                <div>
                    <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
                        <h1 style={{
                            'font-size': '22px',
                            'font-weight': '800',
                            margin: '0',
                            'letter-spacing': '-0.5px',
                            background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
                            '-webkit-background-clip': 'text',
                            '-webkit-text-fill-color': 'transparent',
                        }}>Vision Insight</h1>
                        <span style={{
                            'font-size': '9px',
                            'font-weight': '700',
                            color: '#a78bfa',
                            background: 'rgba(167,139,250,0.1)',
                            padding: '3px 8px',
                            'border-radius': '12px',
                            'letter-spacing': '0.5px',
                        }}>LIVE</span>
                    </div>
                    <p style={{
                        margin: '2px 0 0',
                        'font-size': '11px',
                        color: '#555',
                    }}>Real-time Crypto News & Intelligence</p>
                </div>
                <button
                    onClick={toggleAgentView}
                    style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        'border-radius': '10px',
                        border: `1px solid ${agentViewActive() ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        background: agentViewActive() ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.03)',
                        color: agentViewActive() ? '#22d3ee' : '#888',
                        'font-size': '11px',
                        'font-weight': '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                    </svg>
                    API
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
                    <p style={{ color: '#666', 'font-size': '14px' }}>Loading news feeds...</p>
                </div>
            </Show>

            {/* Agent View */}
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

            {/* Main Dashboard */}
            <Show when={!agentViewActive() && !loading() && snapshot()}>
                {/* Compact Market Pulse + ASI */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    'margin-bottom': '16px',
                    'flex-wrap': 'wrap',
                }}>
                    {/* ASI Card */}
                    <div style={{
                        flex: '1',
                        'min-width': '200px',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                        border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '14px',
                        padding: '16px',
                        display: 'flex',
                        'align-items': 'center',
                        gap: '14px',
                    }}>
                        {/* Mini Gauge */}
                        <div style={{ position: 'relative', width: '70px', height: '42px', 'flex-shrink': '0' }}>
                            <svg viewBox="0 0 70 42" style={{ width: '100%', height: '100%' }}>
                                <defs>
                                    <linearGradient id="asiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stop-color="#ef4444" />
                                        <stop offset="50%" stop-color="#fbbf24" />
                                        <stop offset="100%" stop-color="#22c55e" />
                                    </linearGradient>
                                </defs>
                                <path d="M 8 38 A 27 27 0 0 1 62 38" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5" stroke-linecap="round" />
                                <path d="M 8 38 A 27 27 0 0 1 62 38" fill="none" stroke="url(#asiGrad)" stroke-width="5" stroke-linecap="round"
                                    stroke-dasharray={`${(asiAngle() / 180) * 85} 85`} />
                                <line
                                    x1="35" y1="38"
                                    x2={35 + 20 * Math.cos((Math.PI * (180 - asiAngle())) / 180)}
                                    y2={38 - 20 * Math.sin((Math.PI * (180 - asiAngle())) / 180)}
                                    stroke={asiColor()} stroke-width="1.5" stroke-linecap="round" />
                                <circle cx="35" cy="38" r="2" fill={asiColor()} />
                            </svg>
                        </div>
                        <div style={{ flex: '1' }}>
                            <div style={{ display: 'flex', 'align-items': 'baseline', gap: '6px' }}>
                                <span style={{ 'font-size': '22px', 'font-weight': '800', color: asiColor(), 'letter-spacing': '-0.5px' }}>
                                    {snapshot()!.asi.score}
                                </span>
                                <span style={{
                                    'font-size': '10px', 'font-weight': '700', color: asiColor(),
                                    background: `${asiColor()}15`, padding: '1px 6px', 'border-radius': '6px',
                                }}>{snapshot()!.asi.label}</span>
                            </div>
                            <p style={{ margin: '2px 0 0', 'font-size': '10px', color: '#888', 'line-height': '1.3' }}>
                                Agent Sentiment Index
                            </p>
                        </div>
                    </div>

                    {/* Articles Count Card */}
                    <div style={{
                        'min-width': '100px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '14px',
                        padding: '16px',
                        display: 'flex',
                        'flex-direction': 'column',
                        'justify-content': 'center',
                        'align-items': 'center',
                    }}>
                        <div style={{ 'font-size': '22px', 'font-weight': '800', color: '#22d3ee' }}>
                            {snapshot()!.newsFeed?.length || snapshot()!.articlesAnalyzed || 0}
                        </div>
                        <div style={{ 'font-size': '9px', color: '#666', 'text-transform': 'uppercase', 'letter-spacing': '0.5px' }}>
                            Live Articles
                        </div>
                    </div>

                    {/* Whale Flow Card */}
                    <div style={{
                        'min-width': '140px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '14px',
                        padding: '16px',
                        display: 'flex',
                        'flex-direction': 'column',
                        'justify-content': 'center',
                        'align-items': 'center',
                    }}>
                        <div style={{
                            'font-size': '16px', 'font-weight': '800',
                            color: snapshot()!.whaleWatch.flowDirection === 'accumulation' ? '#22c55e' :
                                snapshot()!.whaleWatch.flowDirection === 'distribution' ? '#ef4444' : '#888',
                        }}>
                            {snapshot()!.whaleWatch.netFlow > 0 ? '+' : ''}
                            {formatValue(snapshot()!.whaleWatch.netFlow)}
                        </div>
                        <div style={{
                            'font-size': '9px', 'font-weight': '700', 'text-transform': 'uppercase',
                            color: snapshot()!.whaleWatch.flowDirection === 'accumulation' ? '#22c55e' :
                                snapshot()!.whaleWatch.flowDirection === 'distribution' ? '#ef4444' : '#888',
                        }}>
                            {snapshot()!.whaleWatch.flowDirection}
                        </div>
                        <div style={{ 'font-size': '9px', color: '#555', 'margin-top': '2px' }}>Whale Flow</div>
                    </div>
                </div>

                {/* AI Market Brief */}
                <Show when={snapshot()?.marketBrief}>
                    {(brief) => {
                        const b = brief() as MarketBrief;
                        const bias = biasConfig(b.tradingBias);
                        return (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(34,211,238,0.04))',
                                border: '1px solid rgba(167,139,250,0.15)',
                                'border-radius': '14px',
                                padding: '16px',
                                'margin-bottom': '16px',
                            }}>
                                {/* Header */}
                                <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '12px' }}>
                                    <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2">
                                            <path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20h6v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z" />
                                            <line x1="10" y1="22" x2="14" y2="22" />
                                        </svg>
                                        <span style={{ 'font-size': '12px', 'font-weight': '700', color: '#ddd' }}>AI Market Brief</span>
                                        <span style={{
                                            'font-size': '8px', 'font-weight': '700', color: '#a78bfa',
                                            background: 'rgba(167,139,250,0.12)', padding: '2px 6px', 'border-radius': '6px',
                                        }}>GEMINI</span>
                                    </div>
                                    <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                                        <span style={{
                                            'font-size': '10px', 'font-weight': '800', color: bias.color,
                                            background: bias.bg, padding: '3px 8px', 'border-radius': '8px',
                                        }}>{bias.icon} {b.tradingBias}</span>
                                        <span style={{
                                            'font-size': '9px', color: '#888',
                                        }}>Confidence: {b.confidenceScore}%</span>
                                    </div>
                                </div>

                                {/* Analysis */}
                                <p style={{
                                    margin: '0 0 12px',
                                    'font-size': '13px',
                                    color: '#ccc',
                                    'line-height': '1.55',
                                }}>{b.analysis}</p>

                                {/* Category Highlights */}
                                <Show when={b.categoryHighlights && b.categoryHighlights.length > 0}>
                                    <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px', 'margin-bottom': '12px' }}>
                                        <For each={b.categoryHighlights}>
                                            {(ch) => {
                                                const chSent = sentimentBadge(ch.sentiment);
                                                const chColor = categoryColor(ch.category);
                                                return (
                                                    <div style={{
                                                        flex: '1', 'min-width': '200px',
                                                        padding: '8px 10px',
                                                        background: 'rgba(255,255,255,0.02)',
                                                        'border-radius': '8px',
                                                        border: `1px solid ${chColor}20`,
                                                    }}>
                                                        <div style={{ display: 'flex', 'align-items': 'center', gap: '4px', 'margin-bottom': '4px' }}>
                                                            <span style={{ width: '5px', height: '5px', 'border-radius': '50%', background: chColor }} />
                                                            <span style={{ 'font-size': '9px', 'font-weight': '700', color: chColor, 'text-transform': 'uppercase' }}>
                                                                {categories().find((c: CategoryInfo) => c.id === ch.category)?.label || ch.category}
                                                            </span>
                                                            <span style={{
                                                                'font-size': '8px', color: chSent.color, 'margin-left': 'auto',
                                                                'font-weight': '700',
                                                            }}>{ch.sentiment === 'bullish' ? '↑' : ch.sentiment === 'bearish' ? '↓' : '→'}</span>
                                                        </div>
                                                        <p style={{ margin: '0', 'font-size': '11px', color: '#999', 'line-height': '1.35' }}>{ch.summary}</p>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </Show>

                                {/* Risks & Opportunities row */}
                                <div style={{ display: 'flex', gap: '10px', 'flex-wrap': 'wrap' }}>
                                    <Show when={b.keyRisks && b.keyRisks.length > 0}>
                                        <div style={{ flex: '1', 'min-width': '150px' }}>
                                            <div style={{ display: 'flex', 'align-items': 'center', gap: '4px', 'margin-bottom': '4px' }}>
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                                </svg>
                                                <span style={{ 'font-size': '9px', 'font-weight': '700', color: '#ef4444', 'text-transform': 'uppercase' }}>Risks</span>
                                            </div>
                                            <For each={b.keyRisks}>
                                                {(risk) => <p style={{ margin: '0 0 2px', 'font-size': '10px', color: '#888', 'padding-left': '14px' }}>- {risk}</p>}
                                            </For>
                                        </div>
                                    </Show>
                                    <Show when={b.opportunities && b.opportunities.length > 0}>
                                        <div style={{ flex: '1', 'min-width': '150px' }}>
                                            <div style={{ display: 'flex', 'align-items': 'center', gap: '4px', 'margin-bottom': '4px' }}>
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="12 16 12 12" /><polyline points="8 12 12 8 16 12" />
                                                </svg>
                                                <span style={{ 'font-size': '9px', 'font-weight': '700', color: '#22c55e', 'text-transform': 'uppercase' }}>Opportunities</span>
                                            </div>
                                            <For each={b.opportunities}>
                                                {(opp) => <p style={{ margin: '0 0 2px', 'font-size': '10px', color: '#888', 'padding-left': '14px' }}>- {opp}</p>}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        );
                    }}
                </Show>

                {/* Category Tab Bar */}
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    'margin-bottom': '16px',
                    'overflow-x': 'auto',
                    'padding-bottom': '4px',
                    '-webkit-overflow-scrolling': 'touch',
                    'scrollbar-width': 'none',
                }}>
                    <For each={categories()}>
                        {(cat: CategoryInfo) => {
                            const isActive = () => activeCategory() === cat.id;
                            const color = categoryColor(cat.id);
                            const count = () => categoryCounts()[cat.id] || 0;
                            return (
                                <button
                                    onClick={() => setActiveCategory(cat.id)}
                                    style={{
                                        display: 'flex',
                                        'align-items': 'center',
                                        gap: '5px',
                                        padding: '7px 12px',
                                        'border-radius': '10px',
                                        border: `1px solid ${isActive() ? color + '55' : 'rgba(255,255,255,0.06)'}`,
                                        background: isActive() ? color + '18' : 'rgba(255,255,255,0.02)',
                                        color: isActive() ? color : '#888',
                                        'font-size': '11px',
                                        'font-weight': isActive() ? '700' : '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        'white-space': 'nowrap',
                                        'flex-shrink': '0',
                                    }}
                                >
                                    {categoryIcon(cat.id)}
                                    <span>{cat.label}</span>
                                    <Show when={count() > 0}>
                                        <span style={{
                                            'font-size': '9px',
                                            color: isActive() ? color : '#555',
                                            background: isActive() ? color + '20' : 'rgba(255,255,255,0.04)',
                                            padding: '1px 5px',
                                            'border-radius': '8px',
                                            'font-weight': '700',
                                        }}>{count()}</span>
                                    </Show>
                                </button>
                            );
                        }}
                    </For>
                </div>

                {/* News Feed */}
                <div style={{ 'margin-bottom': '20px' }}>
                    <Show when={filteredNews().length > 0} fallback={
                        <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            'border-radius': '14px',
                            padding: '40px 20px',
                            'text-align': 'center',
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5" style={{ 'margin-bottom': '12px' }}>
                                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                                <line x1="10" y1="6" x2="18" y2="6" /><line x1="10" y1="10" x2="18" y2="10" /><line x1="10" y1="14" x2="14" y2="14" />
                            </svg>
                            <p style={{ color: '#555', 'font-size': '13px', margin: '0' }}>
                                No articles in this category yet. Data collection runs every 2 hours.
                            </p>
                        </div>
                    }>
                        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
                            <For each={filteredNews()}>
                                {(article: NewsArticle) => {
                                    const sent = sentimentBadge(article.sentimentLabel);
                                    const sev = severityBadge(article.severity);
                                    const srcColor = sourceBadgeColor(article.source);
                                    const catColor = categoryColor(article.category);
                                    return (
                                        <a
                                            href={article.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'block',
                                                'text-decoration': 'none',
                                                color: 'inherit',
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                'border-radius': '12px',
                                                padding: '14px 16px',
                                                transition: 'all 0.2s ease',
                                                cursor: 'pointer',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                            }}
                                        >
                                            {/* Top: badges row */}
                                            <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '8px', 'flex-wrap': 'wrap' }}>
                                                {/* Category badge */}
                                                <span style={{
                                                    'font-size': '9px', 'font-weight': '700',
                                                    color: catColor, background: catColor + '15',
                                                    padding: '2px 7px', 'border-radius': '5px',
                                                    'text-transform': 'uppercase', 'letter-spacing': '0.3px',
                                                }}>
                                                    {categories().find((c: CategoryInfo) => c.id === article.category)?.label || article.category}
                                                </span>
                                                {/* Severity badge */}
                                                <Show when={article.severity !== 'info'}>
                                                    <span style={{
                                                        'font-size': '8px', 'font-weight': '800',
                                                        color: sev.color, background: sev.bg,
                                                        padding: '2px 6px', 'border-radius': '4px',
                                                        'text-transform': 'uppercase', 'letter-spacing': '0.5px',
                                                    }}>{article.severity}</span>
                                                </Show>
                                                {/* Sentiment */}
                                                <span style={{
                                                    'font-size': '9px', 'font-weight': '600',
                                                    color: sent.color,
                                                }}>
                                                    {article.sentimentLabel === 'bullish' ? '\u2191' : article.sentimentLabel === 'bearish' ? '\u2193' : '\u2192'} {article.sentimentLabel}
                                                </span>
                                                {/* Time ago */}
                                                <span style={{ 'font-size': '9px', color: '#555', 'margin-left': 'auto' }}>
                                                    {timeAgo(article.publishedAt || article.collectedAt)}
                                                </span>
                                            </div>
                                            {/* Title */}
                                            <p style={{
                                                margin: '0 0 6px',
                                                'font-size': '13px',
                                                'font-weight': '600',
                                                color: '#e5e5e5',
                                                'line-height': '1.45',
                                                display: '-webkit-box',
                                                '-webkit-line-clamp': '2',
                                                '-webkit-box-orient': 'vertical',
                                                overflow: 'hidden',
                                            }}>{article.title}</p>
                                            {/* Bottom: source + impact */}
                                            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                                                <span style={{
                                                    display: 'flex', 'align-items': 'center', gap: '4px',
                                                    'font-size': '10px', color: '#666',
                                                }}>
                                                    <span style={{
                                                        width: '5px', height: '5px', 'border-radius': '50%',
                                                        background: srcColor, 'flex-shrink': '0',
                                                    }} />
                                                    {article.sourceName}
                                                </span>
                                                <Show when={article.language !== 'en'}>
                                                    <span style={{
                                                        'font-size': '8px', 'font-weight': '700',
                                                        color: '#555', background: 'rgba(255,255,255,0.04)',
                                                        padding: '1px 4px', 'border-radius': '3px',
                                                        'text-transform': 'uppercase',
                                                    }}>{article.language}</span>
                                                </Show>
                                                <Show when={article.impactScore >= 60}>
                                                    <span style={{
                                                        'font-size': '9px', color: '#f59e0b', 'margin-left': 'auto',
                                                        display: 'flex', 'align-items': 'center', gap: '3px',
                                                    }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
                                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                        </svg>
                                                        Impact {article.impactScore}
                                                    </span>
                                                </Show>
                                            </div>
                                        </a>
                                    );
                                }}
                            </For>
                        </div>
                    </Show>
                </div>

                {/* Bottom Widgets: Trending + Calendar */}
                <div style={{
                    display: 'grid',
                    'grid-template-columns': 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '12px',
                    'margin-bottom': '16px',
                }}>
                    {/* Trending Keywords */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '14px',
                        padding: '16px',
                    }}>
                        <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '12px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                            </svg>
                            <span style={{ 'font-size': '12px', 'font-weight': '700', color: '#ddd' }}>Trending</span>
                        </div>
                        <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px' }}>
                            <Show when={snapshot()!.narratives.trendingKeywords.length > 0} fallback={
                                <span style={{ 'font-size': '11px', color: '#555' }}>Collecting...</span>
                            }>
                                <For each={snapshot()!.narratives.trendingKeywords}>
                                    {(kw, idx) => (
                                        <span style={{
                                            'font-size': '10px', 'font-weight': '600',
                                            color: idx() < 3 ? '#a78bfa' : '#777',
                                            background: idx() < 3 ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.03)',
                                            padding: '3px 8px', 'border-radius': '16px',
                                            border: `1px solid ${idx() < 3 ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)'}`,
                                        }}>#{kw.keyword}</span>
                                    )}
                                </For>
                            </Show>
                        </div>
                    </div>

                    {/* Economic Calendar */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '14px',
                        padding: '16px',
                    }}>
                        <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '12px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span style={{ 'font-size': '12px', 'font-weight': '700', color: '#ddd' }}>Macro Calendar</span>
                        </div>
                        <Show when={snapshot()!.narratives.calendar.length > 0} fallback={
                            <p style={{ 'font-size': '11px', color: '#555', margin: '0' }}>Configure Finnhub API for events</p>
                        }>
                            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
                                <For each={snapshot()!.narratives.calendar.slice(0, 4)}>
                                    {(event) => (
                                        <div style={{
                                            display: 'flex', 'align-items': 'center', gap: '8px',
                                            padding: '8px', background: 'rgba(255,255,255,0.02)',
                                            'border-radius': '8px', border: '1px solid rgba(255,255,255,0.03)',
                                        }}>
                                            <span style={{
                                                'font-size': '10px', 'font-weight': '800',
                                                color: event.daysUntil <= 2 ? '#ef4444' : event.daysUntil <= 5 ? '#f59e0b' : '#22d3ee',
                                                'min-width': '32px', 'text-align': 'center',
                                            }}>D-{event.daysUntil}</span>
                                            <div style={{ flex: '1', 'min-width': '0' }}>
                                                <div style={{
                                                    'font-size': '11px', 'font-weight': '600', color: '#ccc',
                                                    'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis',
                                                }}>{event.label}</div>
                                            </div>
                                            <span style={{
                                                'font-size': '8px', 'font-weight': '800',
                                                color: event.impact === 'high' ? '#ef4444' : event.impact === 'medium' ? '#f59e0b' : '#555',
                                                'text-transform': 'uppercase',
                                            }}>{event.impact}</span>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>
                </div>

                {/* Last Updated */}
                <Show when={snapshot()!.lastUpdated}>
                    <p style={{
                        'text-align': 'center',
                        margin: '12px 0 0',
                        'font-size': '10px',
                        color: '#333',
                    }}>
                        Last updated: {new Date(snapshot()!.lastUpdated!).toLocaleString()}
                    </p>
                </Show>
            </Show>

            {/* Keyframes */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                div::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default VisionInsight;
