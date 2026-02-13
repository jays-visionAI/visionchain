import { createSignal, onMount, Show, For, createMemo } from 'solid-js';
import {
    Share2,
    Settings,
    Save,
    Eye,
    EyeOff,
    Plus,
    Trash2,
    Send,
    Clock,
    CheckCircle,
    XCircle,
    RefreshCw,
    ExternalLink,
    Image,
    FileText,
    ChevronDown,
    ChevronUp
} from 'lucide-solid';
import { getFirebaseApp } from '../../services/firebaseService';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const db = getFirestore(getFirebaseApp());
const functions = getFunctions(getFirebaseApp(), 'us-central1');

// ===== Types =====
interface PlatformConfig {
    enabled: boolean;
    [key: string]: any;
}

interface PostTypeConfig {
    enabled: boolean;
    label: string;
    prompt: string;
    imagePrompt: string;
    platforms: string[];
}

interface SocialMediaSettings {
    platforms: {
        twitter: PlatformConfig & {
            apiKey: string;
            apiSecret: string;
            accessToken: string;
            accessTokenSecret: string;
            bearerToken: string;
        };
        linkedin: PlatformConfig & {
            clientId: string;
            clientSecret: string;
            accessToken: string;
            organizationId: string;
        };
    };
    postTypes: Record<string, PostTypeConfig>;
}

interface PostLog {
    id: string;
    postType: string;
    platform: string;
    status: 'success' | 'error';
    content: string;
    imageUrl?: string;
    postUrl?: string;
    error?: string;
    createdAt: string;
    roundId?: number;
}

// ===== Default Settings =====
const DEFAULT_SETTINGS: SocialMediaSettings = {
    platforms: {
        twitter: {
            enabled: false,
            apiKey: '',
            apiSecret: '',
            accessToken: '',
            accessTokenSecret: '',
            bearerToken: ''
        },
        linkedin: {
            enabled: false,
            clientId: '',
            clientSecret: '',
            accessToken: '',
            organizationId: ''
        }
    },
    postTypes: {
        referral_rush_round_end: {
            enabled: true,
            label: 'Referral Rush Round End',
            prompt: `You are a social media manager for Vision Chain, a blockchain project.
Write a tweet announcing the results of Referral Rush Round {{roundNumber}}.

Data:
- Round period: {{startDate}} ~ {{endDate}}
- Total participants: {{totalParticipants}}
- Total new users: {{totalNewUsers}}
- Reward pool: {{rewardPool}} VCN
- Top 3 rankings:
{{rankings}}

Guidelines:
- Keep under 280 characters
- Use professional and exciting tone
- Include #VisionChain #ReferralRush hashtags
- Do NOT use emojis or emoticons
- Write in both English and Korean`,
            imagePrompt: `A futuristic, dark-themed leaderboard banner for "Vision Chain Referral Rush Round {{roundNumber}}".
Dark navy/black background with glowing cyan and purple accents.
Show a podium with top 3 positions glowing.
Include text "ROUND {{roundNumber}} COMPLETE" at the top in bold modern font.
Show stats: "{{totalNewUsers}} New Users" and "{{rewardPool}} VCN Pool".
Premium, high-tech crypto aesthetic. No emojis. 16:9 aspect ratio.`,
            platforms: ['twitter']
        },
        weekly_summary: {
            enabled: false,
            label: 'Weekly Summary',
            prompt: `Write a weekly summary tweet for Vision Chain.
Data: {{data}}
Keep under 280 characters. Professional tone.
#VisionChain`,
            imagePrompt: `A weekly stats infographic for Vision Chain. Dark theme with cyan accents. Modern design. 16:9.`,
            platforms: ['twitter', 'linkedin']
        },
        milestone: {
            enabled: false,
            label: 'Milestone Achievement',
            prompt: `Announce a milestone for Vision Chain: {{milestone}}.
Keep under 280 characters. Celebratory but professional tone.
#VisionChain`,
            imagePrompt: `A celebration banner for Vision Chain milestone: {{milestone}}. Dark theme, glowing effects. 16:9.`,
            platforms: ['twitter', 'linkedin']
        }
    }
};

// ===== Platform Definitions =====
const PLATFORM_FIELDS: Record<string, { label: string; fields: { key: string; label: string; placeholder: string }[] }> = {
    twitter: {
        label: 'X (Twitter)',
        fields: [
            { key: 'apiKey', label: 'API Key', placeholder: 'Enter Twitter API Key' },
            { key: 'apiSecret', label: 'API Secret', placeholder: 'Enter Twitter API Secret' },
            { key: 'accessToken', label: 'Access Token', placeholder: 'Enter Access Token' },
            { key: 'accessTokenSecret', label: 'Access Token Secret', placeholder: 'Enter Access Token Secret' },
            { key: 'bearerToken', label: 'Bearer Token', placeholder: 'Enter Bearer Token' }
        ]
    },
    linkedin: {
        label: 'LinkedIn',
        fields: [
            { key: 'clientId', label: 'Client ID', placeholder: 'Enter LinkedIn Client ID' },
            { key: 'clientSecret', label: 'Client Secret', placeholder: 'Enter LinkedIn Client Secret' },
            { key: 'accessToken', label: 'Access Token', placeholder: 'Enter LinkedIn Access Token' },
            { key: 'organizationId', label: 'Organization ID', placeholder: 'Enter Organization ID (for company pages)' }
        ]
    }
};

export default function AdminSocialMedia() {
    const [activeTab, setActiveTab] = createSignal<'api' | 'posts' | 'history'>('api');
    const [settings, setSettings] = createSignal<SocialMediaSettings>(DEFAULT_SETTINGS);
    const [postLogs, setPostLogs] = createSignal<PostLog[]>([]);
    const [saving, setSaving] = createSignal(false);
    const [statusMsg, setStatusMsg] = createSignal('');
    const [loading, setLoading] = createSignal(true);
    const [showSecrets, setShowSecrets] = createSignal<Record<string, boolean>>({});
    const [testPostLoading, setTestPostLoading] = createSignal<string | null>(null);
    const [expandedPostType, setExpandedPostType] = createSignal<string | null>(null);

    // Load settings from Firestore
    onMount(async () => {
        try {
            const settingsDoc = await getDoc(doc(db, 'settings', 'social_media'));
            if (settingsDoc.exists()) {
                const data = settingsDoc.data() as SocialMediaSettings;
                // Merge with defaults to ensure new fields exist
                setSettings({
                    platforms: {
                        twitter: { ...DEFAULT_SETTINGS.platforms.twitter, ...(data.platforms?.twitter || {}) },
                        linkedin: { ...DEFAULT_SETTINGS.platforms.linkedin, ...(data.platforms?.linkedin || {}) }
                    },
                    postTypes: { ...DEFAULT_SETTINGS.postTypes, ...(data.postTypes || {}) }
                });
            }
            await loadPostHistory();
        } catch (e: any) {
            console.error('Failed to load social media settings:', e);
            showStatus(`Load error: ${e.message}`, true);
        } finally {
            setLoading(false);
        }
    });

    const loadPostHistory = async () => {
        try {
            const q = query(
                collection(db, 'social_posts'),
                orderBy('createdAt', 'desc'),
                limit(50)
            );
            const snap = await getDocs(q);
            setPostLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as PostLog)));
        } catch (e) {
            console.warn('Failed to load post history:', e);
        }
    };

    const showStatus = (msg: string, isError = false) => {
        setStatusMsg(msg);
        setTimeout(() => setStatusMsg(''), isError ? 8000 : 5000);
    };

    // Save API settings
    const saveSettings = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'social_media'), settings(), { merge: true });
            showStatus('Settings saved successfully');
        } catch (e: any) {
            showStatus(`Save error: ${e.message}`, true);
        } finally {
            setSaving(false);
        }
    };

    // Update platform config
    const updatePlatform = (platform: 'twitter' | 'linkedin', field: string, value: any) => {
        setSettings(prev => ({
            ...prev,
            platforms: {
                ...prev.platforms,
                [platform]: { ...prev.platforms[platform], [field]: value }
            }
        }));
    };

    // Update post type config
    const updatePostType = (typeId: string, field: string, value: any) => {
        setSettings(prev => ({
            ...prev,
            postTypes: {
                ...prev.postTypes,
                [typeId]: { ...prev.postTypes[typeId], [field]: value }
            }
        }));
    };

    // Toggle platform for a post type
    const togglePlatformForPost = (typeId: string, platform: string) => {
        const current = settings().postTypes[typeId]?.platforms || [];
        const updated = current.includes(platform)
            ? current.filter((p: string) => p !== platform)
            : [...current, platform];
        updatePostType(typeId, 'platforms', updated);
    };

    // Toggle secret visibility
    const toggleSecret = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Test post
    const sendTestPost = async (typeId: string) => {
        setTestPostLoading(typeId);
        try {
            const fn = httpsCallable(functions, 'postToSocialMedia');
            const result = await fn({ postType: typeId, testMode: true });
            const data = result.data as any;
            if (data.success) {
                showStatus(`Test post sent! ${data.platforms?.join(', ') || ''}`);
                await loadPostHistory();
            } else {
                showStatus(`Post failed: ${data.error || 'Unknown error'}`, true);
            }
        } catch (e: any) {
            showStatus(`Test post error: ${e.message}`, true);
        } finally {
            setTestPostLoading(null);
        }
    };

    // Delete a post log
    const deletePostLog = async (logId: string) => {
        try {
            await deleteDoc(doc(db, 'social_posts', logId));
            setPostLogs(prev => prev.filter(p => p.id !== logId));
            showStatus('Log deleted');
        } catch (e: any) {
            showStatus(`Delete error: ${e.message}`, true);
        }
    };

    // Add new post type
    const addPostType = () => {
        const id = `custom_${Date.now()}`;
        updatePostType(id, 'enabled', false);
        setSettings(prev => ({
            ...prev,
            postTypes: {
                ...prev.postTypes,
                [id]: {
                    enabled: false,
                    label: 'New Post Type',
                    prompt: 'Write a social media post about...',
                    imagePrompt: 'A professional banner image for...',
                    platforms: ['twitter']
                }
            }
        }));
        setExpandedPostType(id);
    };

    // Remove custom post type
    const removePostType = (typeId: string) => {
        if (['referral_rush_round_end', 'weekly_summary', 'milestone'].includes(typeId)) return;
        setSettings(prev => {
            const updated = { ...prev };
            const postTypes = { ...updated.postTypes };
            delete postTypes[typeId];
            updated.postTypes = postTypes;
            return updated;
        });
    };

    // Tab buttons
    const tabs = [
        { id: 'api' as const, label: 'API Settings', icon: Settings },
        { id: 'posts' as const, label: 'Post Types', icon: FileText },
        { id: 'history' as const, label: 'Post History', icon: Clock }
    ];

    if (loading()) {
        return (
            <div class="flex items-center justify-center py-20">
                <div class="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div class="max-w-6xl mx-auto">
            {/* Header */}
            <div class="flex items-center justify-between mb-8">
                <div>
                    <h1 class="text-2xl font-black tracking-tight flex items-center gap-3">
                        <Share2 class="w-7 h-7 text-cyan-400" />
                        Social Media Management
                    </h1>
                    <p class="text-sm text-gray-500 mt-1">API connections, post templates, and auto-posting configuration</p>
                </div>
                <button
                    onClick={saveSettings}
                    disabled={saving()}
                    class="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50"
                >
                    {saving() ? (
                        <RefreshCw class="w-4 h-4 animate-spin" />
                    ) : (
                        <Save class="w-4 h-4" />
                    )}
                    Save All
                </button>
            </div>

            {/* Status Message */}
            <Show when={statusMsg()}>
                <div class={`mb-4 p-3 rounded-xl text-sm font-medium border ${statusMsg().includes('error') || statusMsg().includes('Error') || statusMsg().includes('failed')
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-green-500/10 border-green-500/20 text-green-400'
                    }`}>
                    {statusMsg()}
                </div>
            </Show>

            {/* Tabs */}
            <div class="flex gap-2 mb-6 border-b border-white/5 pb-2">
                <For each={tabs}>
                    {(tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                onClick={() => setActiveTab(tab.id)}
                                class={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab() === tab.id
                                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Icon class="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    }}
                </For>
            </div>

            {/* Tab Content */}
            <Show when={activeTab() === 'api'}>
                <ApiSettingsTab
                    settings={settings()}
                    showSecrets={showSecrets()}
                    onUpdatePlatform={updatePlatform}
                    onToggleSecret={toggleSecret}
                />
            </Show>

            <Show when={activeTab() === 'posts'}>
                <PostTypesTab
                    settings={settings()}
                    expandedPostType={expandedPostType()}
                    testPostLoading={testPostLoading()}
                    onUpdatePostType={updatePostType}
                    onTogglePlatform={togglePlatformForPost}
                    onExpand={setExpandedPostType}
                    onAddPostType={addPostType}
                    onRemovePostType={removePostType}
                    onTestPost={sendTestPost}
                />
            </Show>

            <Show when={activeTab() === 'history'}>
                <PostHistoryTab
                    postLogs={postLogs()}
                    onDelete={deletePostLog}
                    onRefresh={loadPostHistory}
                />
            </Show>
        </div>
    );
}

// ===== API Settings Tab =====
function ApiSettingsTab(props: {
    settings: SocialMediaSettings;
    showSecrets: Record<string, boolean>;
    onUpdatePlatform: (platform: 'twitter' | 'linkedin', field: string, value: any) => void;
    onToggleSecret: (key: string) => void;
}) {
    return (
        <div class="space-y-6">
            <For each={Object.entries(PLATFORM_FIELDS)}>
                {([platformId, platformDef]) => {
                    const config = () => (props.settings.platforms as any)[platformId] || {};
                    return (
                        <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                            <div class="flex items-center justify-between mb-5">
                                <div class="flex items-center gap-3">
                                    <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${platformId === 'twitter'
                                        ? 'bg-sky-500/10 border border-sky-500/20'
                                        : 'bg-blue-600/10 border border-blue-600/20'
                                        }`}>
                                        {platformId === 'twitter' ? (
                                            <svg class="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                            </svg>
                                        ) : (
                                            <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <h3 class="text-lg font-bold text-white">{platformDef.label}</h3>
                                        <p class="text-xs text-gray-500">
                                            {platformId === 'twitter' ? 'Twitter API v2 credentials' : 'LinkedIn Marketing API credentials'}
                                        </p>
                                    </div>
                                </div>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <span class="text-xs font-bold text-gray-500 uppercase">
                                        {config().enabled ? 'Active' : 'Inactive'}
                                    </span>
                                    <div
                                        class={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${config().enabled ? 'bg-cyan-500' : 'bg-gray-700'}`}
                                        onClick={() => props.onUpdatePlatform(platformId as any, 'enabled', !config().enabled)}
                                    >
                                        <div class={`w-5 h-5 rounded-full bg-white transition-transform ${config().enabled ? 'translate-x-5' : ''}`} />
                                    </div>
                                </label>
                            </div>

                            <Show when={config().enabled}>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <For each={platformDef.fields}>
                                        {(field) => {
                                            const fieldKey = `${platformId}_${field.key}`;
                                            const isVisible = () => props.showSecrets[fieldKey];
                                            return (
                                                <div>
                                                    <label class="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                                                        {field.label}
                                                    </label>
                                                    <div class="relative">
                                                        <input
                                                            type={isVisible() ? 'text' : 'password'}
                                                            value={config()[field.key] || ''}
                                                            onInput={(e) => props.onUpdatePlatform(platformId as any, field.key, e.currentTarget.value)}
                                                            placeholder={field.placeholder}
                                                            class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none font-mono pr-10"
                                                        />
                                                        <button
                                                            onClick={() => props.onToggleSecret(fieldKey)}
                                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                                        >
                                                            {isVisible() ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </For>
                                </div>
                            </Show>

                            <Show when={!config().enabled}>
                                <div class="text-center py-6 text-gray-600 text-sm">
                                    Enable this platform to configure API credentials
                                </div>
                            </Show>
                        </div>
                    );
                }}
            </For>
        </div>
    );
}

// ===== Post Types Tab =====
function PostTypesTab(props: {
    settings: SocialMediaSettings;
    expandedPostType: string | null;
    testPostLoading: string | null;
    onUpdatePostType: (typeId: string, field: string, value: any) => void;
    onTogglePlatform: (typeId: string, platform: string) => void;
    onExpand: (typeId: string | null) => void;
    onAddPostType: () => void;
    onRemovePostType: (typeId: string) => void;
    onTestPost: (typeId: string) => void;
}) {
    return (
        <div class="space-y-4">
            <For each={Object.entries(props.settings.postTypes || {})}>
                {([typeId, config]) => {
                    const isExpanded = () => props.expandedPostType === typeId;
                    const isBuiltIn = ['referral_rush_round_end', 'weekly_summary', 'milestone'].includes(typeId);
                    return (
                        <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                            {/* Header */}
                            <button
                                onClick={() => props.onExpand(isExpanded() ? null : typeId)}
                                class="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                            >
                                <div class="flex items-center gap-3">
                                    <div class={`w-3 h-3 rounded-full ${config.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                                    <span class="font-bold text-white">{config.label || typeId}</span>
                                    <Show when={isBuiltIn}>
                                        <span class="text-[9px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded font-bold uppercase">System</span>
                                    </Show>
                                </div>
                                <div class="flex items-center gap-2">
                                    <For each={config.platforms || []}>
                                        {(p) => (
                                            <span class={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${p === 'twitter'
                                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                                : 'bg-blue-600/10 text-blue-400 border border-blue-600/20'
                                                }`}>
                                                {p === 'twitter' ? 'X' : 'LI'}
                                            </span>
                                        )}
                                    </For>
                                    {isExpanded() ? <ChevronUp class="w-4 h-4 text-gray-500" /> : <ChevronDown class="w-4 h-4 text-gray-500" />}
                                </div>
                            </button>

                            {/* Expanded Content */}
                            <Show when={isExpanded()}>
                                <div class="px-5 pb-5 space-y-4 border-t border-white/[0.06] pt-4">
                                    {/* Label & Enable */}
                                    <div class="flex items-center justify-between">
                                        <div class="flex-1 mr-4">
                                            <label class="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Label</label>
                                            <input
                                                type="text"
                                                value={config.label || ''}
                                                onInput={(e) => props.onUpdatePostType(typeId, 'label', e.currentTarget.value)}
                                                class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                                            />
                                        </div>
                                        <div class="flex items-center gap-2 pt-5">
                                            <span class="text-xs font-bold text-gray-500">Enabled</span>
                                            <div
                                                class={`w-11 h-6 rounded-full p-0.5 cursor-pointer transition-colors ${config.enabled ? 'bg-cyan-500' : 'bg-gray-700'}`}
                                                onClick={() => props.onUpdatePostType(typeId, 'enabled', !config.enabled)}
                                            >
                                                <div class={`w-5 h-5 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-5' : ''}`} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Platforms */}
                                    <div>
                                        <label class="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Target Platforms</label>
                                        <div class="flex gap-2">
                                            <For each={['twitter', 'linkedin']}>
                                                {(platform) => {
                                                    const isActive = () => (config.platforms || []).includes(platform);
                                                    return (
                                                        <button
                                                            onClick={() => props.onTogglePlatform(typeId, platform)}
                                                            class={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${isActive()
                                                                ? platform === 'twitter'
                                                                    ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                                                    : 'bg-blue-600/15 text-blue-400 border-blue-600/30'
                                                                : 'bg-white/[0.02] text-gray-600 border-white/[0.06] hover:border-white/10'
                                                                }`}
                                                        >
                                                            {platform === 'twitter' ? 'X (Twitter)' : 'LinkedIn'}
                                                        </button>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </div>

                                    {/* Text Prompt */}
                                    <div>
                                        <label class="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                                            <span class="flex items-center gap-1">
                                                <FileText class="w-3 h-3" />
                                                Text Prompt
                                            </span>
                                        </label>
                                        <p class="text-[11px] text-gray-600 mb-2">
                                            Available variables: {'{{roundNumber}}, {{startDate}}, {{endDate}}, {{totalParticipants}}, {{totalNewUsers}}, {{rewardPool}}, {{rankings}}, {{data}}, {{milestone}}'}
                                        </p>
                                        <textarea
                                            value={config.prompt || ''}
                                            onInput={(e) => props.onUpdatePostType(typeId, 'prompt', e.currentTarget.value)}
                                            rows={8}
                                            class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none font-mono leading-relaxed resize-y"
                                        />
                                    </div>

                                    {/* Image Prompt */}
                                    <div>
                                        <label class="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                                            <span class="flex items-center gap-1">
                                                <Image class="w-3 h-3" />
                                                Image Prompt (NanoBanana 3.0 Pro)
                                            </span>
                                        </label>
                                        <textarea
                                            value={config.imagePrompt || ''}
                                            onInput={(e) => props.onUpdatePostType(typeId, 'imagePrompt', e.currentTarget.value)}
                                            rows={5}
                                            class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none font-mono leading-relaxed resize-y"
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div class="flex items-center justify-between pt-2">
                                        <Show when={!isBuiltIn}>
                                            <button
                                                onClick={() => props.onRemovePostType(typeId)}
                                                class="flex items-center gap-1.5 px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-all"
                                            >
                                                <Trash2 class="w-4 h-4" />
                                                Remove
                                            </button>
                                        </Show>
                                        <Show when={isBuiltIn}>
                                            <div />
                                        </Show>
                                        <button
                                            onClick={() => props.onTestPost(typeId)}
                                            disabled={props.testPostLoading === typeId}
                                            class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50"
                                        >
                                            {props.testPostLoading === typeId ? (
                                                <RefreshCw class="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Send class="w-4 h-4" />
                                            )}
                                            Test Post
                                        </button>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    );
                }}
            </For>

            {/* Add Post Type */}
            <button
                onClick={props.onAddPostType}
                class="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/10 hover:border-cyan-500/30 rounded-2xl text-gray-500 hover:text-cyan-400 transition-all"
            >
                <Plus class="w-5 h-5" />
                <span class="font-bold text-sm">Add Custom Post Type</span>
            </button>
        </div>
    );
}

// ===== Post History Tab =====
function PostHistoryTab(props: {
    postLogs: PostLog[];
    onDelete: (id: string) => void;
    onRefresh: () => void;
}) {
    return (
        <div>
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-white">Recent Posts</h3>
                <button
                    onClick={props.onRefresh}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-all"
                >
                    <RefreshCw class="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            <Show when={props.postLogs.length === 0}>
                <div class="text-center py-16 text-gray-600">
                    <Clock class="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p class="font-medium">No posts yet</p>
                    <p class="text-sm mt-1">Post history will appear here after automated or test posts</p>
                </div>
            </Show>

            <div class="space-y-3">
                <For each={props.postLogs}>
                    {(log) => (
                        <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-2">
                                        {log.status === 'success' ? (
                                            <CheckCircle class="w-4 h-4 text-green-400" />
                                        ) : (
                                            <XCircle class="w-4 h-4 text-red-400" />
                                        )}
                                        <span class={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${log.platform === 'twitter'
                                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                            : 'bg-blue-600/10 text-blue-400 border border-blue-600/20'
                                            }`}>
                                            {log.platform === 'twitter' ? 'X' : 'LinkedIn'}
                                        </span>
                                        <span class="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 rounded-full font-bold">
                                            {log.postType?.replace(/_/g, ' ')}
                                        </span>
                                        <span class="text-xs text-gray-600">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-300 line-clamp-2">
                                        {log.content || log.error || 'No content'}
                                    </p>
                                    <Show when={log.postUrl}>
                                        <a
                                            href={log.postUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mt-2"
                                        >
                                            <ExternalLink class="w-3 h-3" />
                                            View Post
                                        </a>
                                    </Show>
                                </div>
                                <button
                                    onClick={() => props.onDelete(log.id)}
                                    class="text-gray-600 hover:text-red-400 p-1 transition-colors"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}
