import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import {
    RefreshCw,
    Trash2,
    ExternalLink,
    Database,
    Clock,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Play,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    Settings,
    Plus,
    Save,
    Eye,
    Rss,
    Globe
} from 'lucide-solid';
import { getFirebaseApp } from '../../services/firebaseService';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const db = getFirestore(getFirebaseApp());
const functions = getFunctions(getFirebaseApp(), 'us-central1');

// ===== Types =====
interface ArticleDoc {
    title: string;
    url: string;
    source: string;
    sourceName: string;
    category: string;
    sentiment: number;
    sentimentLabel: string;
    impactScore: number;
    severity: string;
    keywords: string[];
    oneLiner: string;
    language: string;
    region: string;
    collectedAt: any;
    publishedAt: any;
}

interface SnapshotDoc {
    id: string;
    createdAt: any;
    asi: {
        score: number;
        label: string;
        trend: string;
        summary: string;
    };
    alphaAlerts: any[];
    articlesAnalyzed: number;
}

interface MetaDoc {
    lastCollectedAt: any;
    articlesCollected: number;
    sourcesAttempted: number;
}

interface ApiKeyEntry {
    provider: string;
    value: string;
    isActive: boolean;
    label?: string;
}

interface CalendarEventManual {
    label: string;
    date: string;
    impact: 'high' | 'medium' | 'low';
    daysUntil?: number;
}

// ===== Fetch Functions =====
async function fetchInsightOverview() {
    // Fetch meta
    let meta: MetaDoc = { lastCollectedAt: null, articlesCollected: 0, sourcesAttempted: 0 };
    try {
        const metaDoc = await getDoc(doc(db, 'blockyNews', 'meta'));
        if (metaDoc.exists()) meta = metaDoc.data() as MetaDoc;
    } catch (e) { /* ignore */ }

    // Fetch recent articles count
    let totalArticles = 0;
    let recentArticles: ArticleDoc[] = [];
    try {
        const articlesQuery = query(
            collection(db, 'blockyNews', 'data', 'articles'),
            orderBy('collectedAt', 'desc'),
            limit(50)
        );
        const snap = await getDocs(articlesQuery);
        totalArticles = snap.size;
        snap.forEach(d => recentArticles.push({ ...d.data() as ArticleDoc }));
    } catch (e) { /* ignore */ }

    // Fetch snapshots
    let snapshots: SnapshotDoc[] = [];
    try {
        const snapshotQuery = query(
            collection(db, 'blockyNews', 'data', 'snapshots'),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snap = await getDocs(snapshotQuery);
        snap.forEach(d => snapshots.push({ id: d.id, ...d.data() as Omit<SnapshotDoc, 'id'> }));
    } catch (e) { /* ignore */ }

    // Fetch API keys for insight-related providers
    let apiKeys: ApiKeyEntry[] = [];
    try {
        const keysSnap = await getDocs(collection(db, 'settings', 'api_keys', 'keys'));
        keysSnap.forEach(d => {
            const data = d.data() as ApiKeyEntry;
            if (['finnhub', 'whale_alert', 'gemini', 'deepseek'].includes(data.provider)) {
                apiKeys.push(data);
            }
        });
    } catch (e) { /* ignore */ }

    return { meta, totalArticles, recentArticles, snapshots, apiKeys };
}

// ===== Helpers =====
function formatTimestamp(ts: any): string {
    if (!ts) return 'N/A';
    try {
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return 'N/A';
    }
}

function timeAgo(ts: any): string {
    if (!ts) return 'Never';
    try {
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    } catch {
        return 'Unknown';
    }
}

function getSentimentColor(label: string): string {
    switch (label) {
        case 'bullish': return '#22c55e';
        case 'bearish': return '#ef4444';
        default: return '#a3a3a3';
    }
}

function getSeverityBg(severity: string): string {
    switch (severity) {
        case 'critical': return 'rgba(239,68,68,0.12)';
        case 'warning': return 'rgba(245,158,11,0.12)';
        default: return 'rgba(59,130,246,0.08)';
    }
}

function getSeverityColor(severity: string): string {
    switch (severity) {
        case 'critical': return '#ef4444';
        case 'warning': return '#f59e0b';
        default: return '#3b82f6';
    }
}

// ===== Component =====
function AdminVisionInsight() {
    const [data, { refetch }] = createResource(fetchInsightOverview);
    const [activeTab, setActiveTab] = createSignal<'overview' | 'articles' | 'snapshots' | 'apikeys' | 'sources'>('overview');
    const [searchQuery, setSearchQuery] = createSignal('');
    const [filterCategory, setFilterCategory] = createSignal('all');
    const [filterSeverity, setFilterSeverity] = createSignal('all');
    const [triggerLoading, setTriggerLoading] = createSignal(false);
    const [statusMsg, setStatusMsg] = createSignal('');

    // New API key form
    const [newKeyProvider, setNewKeyProvider] = createSignal('');
    const [newKeyValue, setNewKeyValue] = createSignal('');
    const [savingKey, setSavingKey] = createSignal(false);

    // Manual calendar event form
    const [newEventLabel, setNewEventLabel] = createSignal('');
    const [newEventDate, setNewEventDate] = createSignal('');
    const [newEventImpact, setNewEventImpact] = createSignal<'high' | 'medium' | 'low'>('medium');

    const categories = ['all', 'market', 'regulation', 'defi', 'layer2', 'bitcoin', 'ethereum', 'ai', 'general'];

    // Filtered articles
    const filteredArticles = () => {
        let articles = data()?.recentArticles || [];
        if (searchQuery()) {
            const q = searchQuery().toLowerCase();
            articles = articles.filter(a =>
                a.title.toLowerCase().includes(q) ||
                a.sourceName.toLowerCase().includes(q) ||
                (a.keywords || []).some(k => k.toLowerCase().includes(q))
            );
        }
        if (filterCategory() !== 'all') {
            articles = articles.filter(a => a.category === filterCategory());
        }
        if (filterSeverity() !== 'all') {
            articles = articles.filter(a => a.severity === filterSeverity());
        }
        return articles;
    };

    // Save API key
    const saveApiKey = async () => {
        if (!newKeyProvider() || !newKeyValue()) return;
        setSavingKey(true);
        try {
            const keyRef = doc(collection(db, 'settings', 'api_keys', 'keys'));
            await setDoc(keyRef, {
                provider: newKeyProvider(),
                value: newKeyValue(),
                isActive: true,
                label: `${newKeyProvider()} API Key`,
                addedAt: Timestamp.now(),
            });
            setNewKeyProvider('');
            setNewKeyValue('');
            setStatusMsg('API key saved successfully.');
            refetch();
        } catch (e: any) {
            setStatusMsg(`Error: ${e.message}`);
        } finally {
            setSavingKey(false);
            setTimeout(() => setStatusMsg(''), 3000);
        }
    };

    // Trigger manual collection
    const triggerCollection = async () => {
        setTriggerLoading(true);
        setStatusMsg('Triggering news collection... (this may take a few minutes)');
        try {
            // We call the callable function to trigger manually
            const fn = httpsCallable(functions, 'getVisionInsight');
            await fn({ format: 'ui' });
            setStatusMsg('Collection triggered. Refresh in a few minutes to see results.');
        } catch (e: any) {
            setStatusMsg(`Trigger error: ${e.message}`);
        } finally {
            setTriggerLoading(false);
            setTimeout(() => setStatusMsg(''), 5000);
        }
    };

    // Delete article
    const deleteArticle = async (url: string) => {
        try {
            // Compute same md5 hash used in backend
            const encoder = new TextEncoder();
            const data = encoder.encode(url);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 20);

            await deleteDoc(doc(db, 'blockyNews', 'data', 'articles', hashHex));
            setStatusMsg('Article deleted.');
            refetch();
        } catch (e: any) {
            setStatusMsg(`Delete error: ${e.message}`);
        }
        setTimeout(() => setStatusMsg(''), 3000);
    };

    // Tab styles
    const tabStyle = (tab: string) => ({
        padding: '8px 16px',
        'border-radius': '8px',
        border: 'none',
        background: activeTab() === tab ? 'rgba(34,211,238,0.12)' : 'transparent',
        color: activeTab() === tab ? '#22d3ee' : '#888',
        'font-size': '13px',
        'font-weight': '700',
        cursor: 'pointer',
        transition: 'all 0.2s',
    });

    return (
        <div style={{ 'min-height': '100vh', color: '#fff' }}>
            {/* Header */}
            <div style={{
                display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                'margin-bottom': '24px', 'flex-wrap': 'wrap', gap: '12px',
            }}>
                <div>
                    <h1 style={{
                        'font-size': '24px', 'font-weight': '800', margin: '0',
                        background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
                        '-webkit-background-clip': 'text', '-webkit-text-fill-color': 'transparent',
                    }}>Vision Insight Admin</h1>
                    <p style={{ margin: '4px 0 0', 'font-size': '12px', color: '#666' }}>Manage news collection, snapshots, and API integrations</p>
                </div>
                <button
                    onClick={() => { refetch(); setStatusMsg('Refreshed.'); setTimeout(() => setStatusMsg(''), 2000); }}
                    style={{
                        display: 'flex', 'align-items': 'center', gap: '6px',
                        padding: '8px 14px', 'border-radius': '8px', border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.03)', color: '#888', cursor: 'pointer',
                        'font-size': '12px', 'font-weight': '600',
                    }}
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Status Message */}
            <Show when={statusMsg()}>
                <div style={{
                    padding: '10px 16px', 'margin-bottom': '16px', 'border-radius': '8px',
                    background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
                    color: '#22d3ee', 'font-size': '12px', 'font-weight': '600',
                }}>{statusMsg()}</div>
            </Show>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', 'margin-bottom': '20px', 'flex-wrap': 'wrap' }}>
                <button onClick={() => setActiveTab('overview')} style={tabStyle('overview')}>Overview</button>
                <button onClick={() => setActiveTab('articles')} style={tabStyle('articles')}>Articles</button>
                <button onClick={() => setActiveTab('snapshots')} style={tabStyle('snapshots')}>Snapshots</button>
                <button onClick={() => setActiveTab('apikeys')} style={tabStyle('apikeys')}>API Keys</button>
                <button onClick={() => setActiveTab('sources')} style={tabStyle('sources')}>Media Sources</button>
            </div>

            {/* Loading */}
            <Show when={data.loading}>
                <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'center', height: '200px' }}>
                    <div style={{
                        width: '32px', height: '32px', border: '3px solid rgba(34,211,238,0.2)',
                        'border-top-color': '#22d3ee', 'border-radius': '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                </div>
            </Show>

            <Show when={!data.loading && data()}>
                {/* ===== OVERVIEW TAB ===== */}
                <Show when={activeTab() === 'overview'}>
                    {/* Stats Grid */}
                    <div style={{
                        display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px', 'margin-bottom': '24px',
                    }}>
                        {/* Total Articles */}
                        <div style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                            'border-radius': '12px', padding: '16px',
                        }}>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '8px' }}>
                                <Database size={14} color="#22d3ee" />
                                <span style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', 'letter-spacing': '1px' }}>Total Articles</span>
                            </div>
                            <div style={{ 'font-size': '28px', 'font-weight': '800', color: '#22d3ee' }}>{data()!.totalArticles}</div>
                        </div>

                        {/* Last Collection */}
                        <div style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                            'border-radius': '12px', padding: '16px',
                        }}>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '8px' }}>
                                <Clock size={14} color="#a78bfa" />
                                <span style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', 'letter-spacing': '1px' }}>Last Collection</span>
                            </div>
                            <div style={{ 'font-size': '16px', 'font-weight': '700', color: '#a78bfa' }}>{timeAgo(data()!.meta.lastCollectedAt)}</div>
                            <div style={{ 'font-size': '10px', color: '#555', 'margin-top': '4px' }}>{data()!.meta.articlesCollected} articles collected</div>
                        </div>

                        {/* Snapshots */}
                        <div style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                            'border-radius': '12px', padding: '16px',
                        }}>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '8px' }}>
                                <Eye size={14} color="#22c55e" />
                                <span style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', 'letter-spacing': '1px' }}>Snapshots</span>
                            </div>
                            <div style={{ 'font-size': '28px', 'font-weight': '800', color: '#22c55e' }}>{data()!.snapshots.length}</div>
                        </div>

                        {/* API Keys */}
                        <div style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                            'border-radius': '12px', padding: '16px',
                        }}>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '8px' }}>
                                <Settings size={14} color="#f59e0b" />
                                <span style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', 'letter-spacing': '1px' }}>API Keys</span>
                            </div>
                            <div style={{ 'font-size': '28px', 'font-weight': '800', color: '#f59e0b' }}>{data()!.apiKeys.length}</div>
                            <div style={{ 'font-size': '10px', color: '#555', 'margin-top': '4px' }}>
                                {data()!.apiKeys.filter(k => k.isActive).length} active
                            </div>
                        </div>
                    </div>

                    {/* Latest ASI Score */}
                    <Show when={data()!.snapshots.length > 0}>
                        <div style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                            'border-radius': '12px', padding: '20px', 'margin-bottom': '20px',
                        }}>
                            <h3 style={{ margin: '0 0 12px', 'font-size': '14px', 'font-weight': '700' }}>Latest Snapshot</h3>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '20px', 'flex-wrap': 'wrap' }}>
                                <div>
                                    <div style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase' }}>ASI Score</div>
                                    <div style={{ 'font-size': '32px', 'font-weight': '800', color: '#22d3ee' }}>
                                        {data()!.snapshots[0].asi?.score || 50}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase' }}>Label</div>
                                    <div style={{ 'font-size': '16px', 'font-weight': '700', color: '#a78bfa' }}>
                                        {data()!.snapshots[0].asi?.label || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase' }}>Trend</div>
                                    <div style={{
                                        'font-size': '14px', 'font-weight': '700',
                                        color: data()!.snapshots[0].asi?.trend === 'BULLISH' ? '#22c55e' :
                                            data()!.snapshots[0].asi?.trend === 'BEARISH' ? '#ef4444' : '#888',
                                    }}>
                                        {data()!.snapshots[0].asi?.trend || 'STABLE'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase' }}>Articles Analyzed</div>
                                    <div style={{ 'font-size': '16px', 'font-weight': '700', color: '#fff' }}>
                                        {data()!.snapshots[0].articlesAnalyzed || 0}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase' }}>Created</div>
                                    <div style={{ 'font-size': '13px', 'font-weight': '600', color: '#aaa' }}>
                                        {formatTimestamp(data()!.snapshots[0].createdAt)}
                                    </div>
                                </div>
                            </div>
                            <Show when={data()!.snapshots[0].asi?.summary}>
                                <p style={{ margin: '12px 0 0', 'font-size': '13px', color: '#aaa', 'font-style': 'italic' }}>
                                    "{data()!.snapshots[0].asi?.summary}"
                                </p>
                            </Show>
                        </div>
                    </Show>

                    {/* Quick Actions */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '12px', padding: '20px',
                    }}>
                        <h3 style={{ margin: '0 0 12px', 'font-size': '14px', 'font-weight': '700' }}>Quick Actions</h3>
                        <div style={{ display: 'flex', gap: '10px', 'flex-wrap': 'wrap' }}>
                            <button
                                onClick={triggerCollection}
                                disabled={triggerLoading()}
                                style={{
                                    display: 'flex', 'align-items': 'center', gap: '6px',
                                    padding: '10px 16px', 'border-radius': '8px', border: 'none',
                                    background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.05))',
                                    color: '#22d3ee', 'font-size': '12px', 'font-weight': '700', cursor: 'pointer',
                                }}
                            >
                                <Play size={14} />
                                {triggerLoading() ? 'Triggering...' : 'Trigger Collection'}
                            </button>
                            <button
                                onClick={() => setActiveTab('apikeys')}
                                style={{
                                    display: 'flex', 'align-items': 'center', gap: '6px',
                                    padding: '10px 16px', 'border-radius': '8px', border: 'none',
                                    background: 'rgba(245,158,11,0.1)',
                                    color: '#f59e0b', 'font-size': '12px', 'font-weight': '700', cursor: 'pointer',
                                }}
                            >
                                <Settings size={14} />
                                Configure API Keys
                            </button>
                        </div>
                    </div>
                </Show>

                {/* ===== ARTICLES TAB ===== */}
                <Show when={activeTab() === 'articles'}>
                    {/* Search & Filters */}
                    <div style={{
                        display: 'flex', gap: '10px', 'margin-bottom': '16px', 'flex-wrap': 'wrap', 'align-items': 'center',
                    }}>
                        <div style={{
                            display: 'flex', 'align-items': 'center', gap: '6px',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                            'border-radius': '8px', padding: '0 10px', flex: '1', 'min-width': '200px',
                        }}>
                            <Search size={14} color="#666" />
                            <input
                                type="text"
                                placeholder="Search articles..."
                                value={searchQuery()}
                                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                style={{
                                    background: 'transparent', border: 'none', outline: 'none',
                                    color: '#fff', 'font-size': '12px', padding: '8px 0', width: '100%',
                                }}
                            />
                        </div>
                        <select
                            value={filterCategory()}
                            onChange={(e) => setFilterCategory(e.currentTarget.value)}
                            style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                'border-radius': '8px', padding: '8px 10px', color: '#fff', 'font-size': '12px',
                            }}
                        >
                            <For each={categories}>
                                {(cat) => <option value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>}
                            </For>
                        </select>
                        <select
                            value={filterSeverity()}
                            onChange={(e) => setFilterSeverity(e.currentTarget.value)}
                            style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                'border-radius': '8px', padding: '8px 10px', color: '#fff', 'font-size': '12px',
                            }}
                        >
                            <option value="all">All Severity</option>
                            <option value="critical">Critical</option>
                            <option value="warning">Warning</option>
                            <option value="info">Info</option>
                        </select>
                    </div>

                    <div style={{ 'font-size': '11px', color: '#666', 'margin-bottom': '12px' }}>
                        Showing {filteredArticles().length} articles
                    </div>

                    {/* Articles Table */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '12px', overflow: 'hidden',
                    }}>
                        <div style={{
                            display: 'grid',
                            'grid-template-columns': '1fr 100px 80px 70px 70px 80px 60px',
                            gap: '0',
                            'font-size': '10px', 'font-weight': '700', color: '#888',
                            'text-transform': 'uppercase', 'letter-spacing': '0.5px',
                            padding: '10px 14px',
                            'border-bottom': '1px solid rgba(255,255,255,0.04)',
                        }}>
                            <span>Title</span>
                            <span>Source</span>
                            <span>Category</span>
                            <span>Sentiment</span>
                            <span>Impact</span>
                            <span>Severity</span>
                            <span>Action</span>
                        </div>
                        <Show when={filteredArticles().length > 0} fallback={
                            <div style={{ padding: '40px', 'text-align': 'center', color: '#555', 'font-size': '13px' }}>
                                No articles found. Run news collection first.
                            </div>
                        }>
                            <For each={filteredArticles()}>
                                {(article) => (
                                    <div style={{
                                        display: 'grid',
                                        'grid-template-columns': '1fr 100px 80px 70px 70px 80px 60px',
                                        gap: '0',
                                        padding: '10px 14px',
                                        'border-bottom': '1px solid rgba(255,255,255,0.02)',
                                        'font-size': '12px',
                                        'align-items': 'center',
                                        transition: 'background 0.15s',
                                    }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{ 'min-width': '0' }}>
                                            <div style={{
                                                'white-space': 'nowrap', overflow: 'hidden',
                                                'text-overflow': 'ellipsis', color: '#ddd', 'font-weight': '600',
                                            }}>{article.title}</div>
                                            <div style={{ 'font-size': '10px', color: '#555', 'margin-top': '2px' }}>
                                                {formatTimestamp(article.collectedAt)}
                                            </div>
                                        </div>
                                        <span style={{ color: '#aaa' }}>{article.sourceName}</span>
                                        <span style={{
                                            'font-size': '10px', color: '#22d3ee',
                                            background: 'rgba(34,211,238,0.08)', padding: '2px 6px',
                                            'border-radius': '4px', 'text-align': 'center',
                                        }}>{article.category}</span>
                                        <span style={{ color: getSentimentColor(article.sentimentLabel), 'font-weight': '700' }}>
                                            {article.sentimentLabel}
                                        </span>
                                        <span style={{ color: '#fff', 'font-weight': '700' }}>{article.impactScore}</span>
                                        <span style={{
                                            'font-size': '9px', 'font-weight': '800',
                                            color: getSeverityColor(article.severity),
                                            background: getSeverityBg(article.severity),
                                            padding: '2px 6px', 'border-radius': '4px',
                                            'text-align': 'center', 'text-transform': 'uppercase',
                                        }}>{article.severity}</span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <Show when={article.url}>
                                                <a href={article.url} target="_blank" rel="noopener noreferrer"
                                                    style={{ color: '#888' }}>
                                                    <ExternalLink size={14} />
                                                </a>
                                            </Show>
                                            <button onClick={() => deleteArticle(article.url)} style={{
                                                background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0',
                                            }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </Show>
                    </div>
                </Show>

                {/* ===== SNAPSHOTS TAB ===== */}
                <Show when={activeTab() === 'snapshots'}>
                    <Show when={data()!.snapshots.length > 0} fallback={
                        <div style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                            'border-radius': '12px', padding: '40px', 'text-align': 'center', color: '#555',
                        }}>No snapshots generated yet.</div>
                    }>
                        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
                            <For each={data()!.snapshots}>
                                {(snap) => (
                                    <div style={{
                                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                        'border-radius': '12px', padding: '16px',
                                    }}>
                                        <div style={{ display: 'flex', 'align-items': 'center', gap: '16px', 'flex-wrap': 'wrap' }}>
                                            <div style={{
                                                'font-size': '12px', 'font-weight': '700', color: '#22d3ee',
                                                background: 'rgba(34,211,238,0.08)', padding: '4px 8px', 'border-radius': '6px',
                                            }}>{snap.id}</div>
                                            <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                                                <span style={{ 'font-size': '10px', color: '#888' }}>ASI:</span>
                                                <span style={{ 'font-size': '16px', 'font-weight': '800', color: '#22d3ee' }}>
                                                    {snap.asi?.score || 50}
                                                </span>
                                                <span style={{ 'font-size': '11px', color: '#a78bfa' }}>{snap.asi?.label}</span>
                                            </div>
                                            <div style={{ 'font-size': '11px', color: '#888' }}>
                                                {snap.articlesAnalyzed} articles | {formatTimestamp(snap.createdAt)}
                                            </div>
                                            <div style={{ 'font-size': '11px', color: '#666' }}>
                                                {snap.alphaAlerts?.length || 0} alerts
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                </Show>

                {/* ===== API KEYS TAB ===== */}
                <Show when={activeTab() === 'apikeys'}>
                    {/* Existing Keys */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '12px', padding: '20px', 'margin-bottom': '16px',
                    }}>
                        <h3 style={{ margin: '0 0 12px', 'font-size': '14px', 'font-weight': '700' }}>Configured Keys</h3>
                        <Show when={data()!.apiKeys.length > 0} fallback={
                            <p style={{ color: '#555', 'font-size': '13px' }}>No API keys configured for Vision Insight. Add keys below.</p>
                        }>
                            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
                                <For each={data()!.apiKeys}>
                                    {(key) => (
                                        <div style={{
                                            display: 'flex', 'align-items': 'center', gap: '12px',
                                            padding: '10px 14px', background: 'rgba(255,255,255,0.02)',
                                            'border-radius': '8px', border: '1px solid rgba(255,255,255,0.04)',
                                        }}>
                                            <div style={{
                                                width: '8px', height: '8px', 'border-radius': '50%',
                                                background: key.isActive ? '#22c55e' : '#ef4444',
                                            }} />
                                            <span style={{ 'font-size': '12px', 'font-weight': '700', color: '#fff', 'min-width': '100px' }}>
                                                {key.provider}
                                            </span>
                                            <span style={{ 'font-size': '11px', color: '#666', flex: '1' }}>
                                                {key.value ? `${key.value.substring(0, 8)}...${key.value.slice(-4)}` : 'No value'}
                                            </span>
                                            <span style={{
                                                'font-size': '9px', 'font-weight': '800', 'text-transform': 'uppercase',
                                                color: key.isActive ? '#22c55e' : '#ef4444',
                                            }}>
                                                {key.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>

                    {/* Add New Key */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '12px', padding: '20px',
                    }}>
                        <h3 style={{ margin: '0 0 12px', 'font-size': '14px', 'font-weight': '700' }}>Add API Key</h3>
                        <p style={{ 'font-size': '11px', color: '#888', 'margin-bottom': '12px' }}>
                            Required: <b style={{ color: '#22d3ee' }}>finnhub</b> (economic calendar), <b style={{ color: '#22d3ee' }}>whale_alert</b> (whale tracking).
                            Optional: gemini, deepseek (AI analysis).
                        </p>
                        <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'align-items': 'flex-end' }}>
                            <div>
                                <label style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', display: 'block', 'margin-bottom': '4px' }}>Provider</label>
                                <select
                                    value={newKeyProvider()}
                                    onChange={(e) => setNewKeyProvider(e.currentTarget.value)}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        'border-radius': '6px', padding: '8px 10px', color: '#fff', 'font-size': '12px',
                                    }}
                                >
                                    <option value="">Select...</option>
                                    <option value="finnhub">Finnhub</option>
                                    <option value="whale_alert">Whale Alert</option>
                                    <option value="gemini">Gemini AI</option>
                                    <option value="deepseek">DeepSeek</option>
                                </select>
                            </div>
                            <div style={{ flex: '1', 'min-width': '200px' }}>
                                <label style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', display: 'block', 'margin-bottom': '4px' }}>API Key</label>
                                <input
                                    type="password"
                                    placeholder="Paste API key here..."
                                    value={newKeyValue()}
                                    onInput={(e) => setNewKeyValue(e.currentTarget.value)}
                                    style={{
                                        width: '100%', 'box-sizing': 'border-box',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        'border-radius': '6px', padding: '8px 10px', color: '#fff', 'font-size': '12px',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                            <button
                                onClick={saveApiKey}
                                disabled={savingKey() || !newKeyProvider() || !newKeyValue()}
                                style={{
                                    display: 'flex', 'align-items': 'center', gap: '6px',
                                    padding: '8px 16px', 'border-radius': '6px', border: 'none',
                                    background: newKeyProvider() && newKeyValue() ? 'linear-gradient(135deg, #22d3ee, #a78bfa)' : 'rgba(255,255,255,0.05)',
                                    color: newKeyProvider() && newKeyValue() ? '#000' : '#666',
                                    'font-size': '12px', 'font-weight': '700', cursor: 'pointer',
                                }}
                            >
                                <Save size={14} />
                                {savingKey() ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </Show>

                {/* ===== MEDIA SOURCES TAB ===== */}
                <Show when={activeTab() === 'sources'}>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        'border-radius': '12px', padding: '20px',
                    }}>
                        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '16px' }}>
                            <Rss size={16} color="#f59e0b" />
                            <h3 style={{ margin: '0', 'font-size': '14px', 'font-weight': '700' }}>Configured Media Sources (10)</h3>
                        </div>

                        {/* Global Sources */}
                        <div style={{ 'margin-bottom': '16px' }}>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '10px' }}>
                                <Globe size={12} color="#22d3ee" />
                                <span style={{ 'font-size': '11px', 'font-weight': '700', color: '#22d3ee', 'text-transform': 'uppercase', 'letter-spacing': '1px' }}>Global (5)</span>
                            </div>
                            <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                                {[
                                    { name: 'CoinTelegraph', lang: 'EN', url: 'cointelegraph.com' },
                                    { name: 'CoinDesk', lang: 'EN', url: 'coindesk.com' },
                                    { name: 'Decrypt', lang: 'EN', url: 'decrypt.co' },
                                    { name: 'The Block', lang: 'EN', url: 'theblock.co' },
                                    { name: 'Bitcoin Magazine', lang: 'EN', url: 'bitcoinmagazine.com' },
                                ].map(s => (
                                    <div style={{
                                        display: 'flex', 'align-items': 'center', gap: '8px',
                                        padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
                                        'border-radius': '8px', border: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                        <div style={{
                                            width: '6px', height: '6px', 'border-radius': '50%', background: '#22c55e',
                                        }} />
                                        <div>
                                            <div style={{ 'font-size': '12px', 'font-weight': '700', color: '#ddd' }}>{s.name}</div>
                                            <div style={{ 'font-size': '10px', color: '#666' }}>{s.url} ({s.lang})</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Asia Sources */}
                        <div>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '10px' }}>
                                <Globe size={12} color="#a78bfa" />
                                <span style={{ 'font-size': '11px', 'font-weight': '700', color: '#a78bfa', 'text-transform': 'uppercase', 'letter-spacing': '1px' }}>Asia (5)</span>
                            </div>
                            <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                                {[
                                    { name: 'DeCenter', lang: 'KO', url: 'decenter.kr', fallback: true },
                                    { name: 'BlockMedia', lang: 'KO', url: 'blockmedia.co.kr', fallback: true },
                                    { name: 'CoinPost', lang: 'JA', url: 'coinpost.jp' },
                                    { name: 'Blockhead', lang: 'EN', url: 'blockhead.co' },
                                    { name: 'CoinGape', lang: 'EN', url: 'coingape.com' },
                                ].map(s => (
                                    <div style={{
                                        display: 'flex', 'align-items': 'center', gap: '8px',
                                        padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
                                        'border-radius': '8px', border: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                        <div style={{
                                            width: '6px', height: '6px', 'border-radius': '50%', background: '#22c55e',
                                        }} />
                                        <div>
                                            <div style={{ 'font-size': '12px', 'font-weight': '700', color: '#ddd' }}>
                                                {s.name}
                                                {(s as any).fallback && (
                                                    <span style={{ 'font-size': '9px', color: '#f59e0b', 'margin-left': '6px' }}>SCRAPE FALLBACK</span>
                                                )}
                                            </div>
                                            <div style={{ 'font-size': '10px', color: '#666' }}>{s.url} ({s.lang})</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                select option { background: #1a1a1d; color: #fff; }
            `}</style>
        </div>
    );
}

export default AdminVisionInsight;
