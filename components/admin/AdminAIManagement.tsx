import { createSignal, For, Show, onMount } from 'solid-js';
import {
    Database,
    MessageSquare,
    Settings2,
    BarChart3,
    Wand2,
    Save,
    RotateCcw,
    Search,
    Eye,
    EyeOff,
    Trash2,
    Bot,
    User,
    Clock,
    TrendingUp,
    Zap,
    Image,
    Mic,
    Volume2,
    ChevronRight,
    AlertCircle,
    Key,
    Plus,
    Check,
    X,
    Power,
    Shield,
    Loader2,
    Coins,
    Send
} from 'lucide-solid';
import {
    getChatbotSettings,
    saveChatbotSettings,
    getApiKeys,
    saveApiKey,
    deleteApiKey as deleteFireKey,
    updateApiKey,
    ApiKeyData,
    BotConfig,
    AiConversation,
    getRecentConversations,
    getVcnPurchases,
    VcnPurchase
} from '../../services/firebaseService';
import { contractService } from '../../services/contractService';

// Tabs configuration
const tabs = [
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare },
    { id: 'models', label: 'Model Settings', icon: Settings2 },
    { id: 'stats', label: 'Usage Stats', icon: BarChart3 },
    { id: 'prompts', label: 'Prompt Tuning', icon: Wand2 },
    { id: 'eco', label: 'Ecosystem', icon: Coins },
];

// Mock data for conversations
const mockConversations = [
    { id: 1, user: 'user_abc123', messages: 8, lastMessage: 'What is Vision Chain?', time: '2 min ago', status: 'completed' },
    { id: 2, user: 'user_def456', messages: 5, lastMessage: 'Explain PoV consensus', time: '15 min ago', status: 'completed' },
    { id: 3, user: 'user_ghi789', messages: 12, lastMessage: 'Generate an image of...', time: '1 hour ago', status: 'completed' },
    { id: 4, user: 'user_jkl012', messages: 3, lastMessage: 'How does INN work?', time: '2 hours ago', status: 'completed' },
];

// Mock usage stats
const mockStats = {
    totalCalls: 12847,
    textCalls: 9234,
    imageCalls: 2891,
    voiceCalls: 722,
    avgResponseTime: '1.2s',
    successRate: 99.2,
    dailyData: [
        { day: 'Mon', calls: 1823 },
        { day: 'Tue', calls: 2156 },
        { day: 'Wed', calls: 1945 },
        { day: 'Thu', calls: 2387 },
        { day: 'Fri', calls: 2102 },
        { day: 'Sat', calls: 1234 },
        { day: 'Sun', calls: 1200 },
    ]
};

// Default knowledge base content
const defaultKnowledge = `You are the official AI Architect for Vision Chain.
Vision Chain is the first Agentic AI Blockchain (Layer 1).
Your goal is to explain Vision Chain's technology, ecosystem, and vision to users based on the official Whitepaper v1.0.

=== CORE IDENTITY ===
- **Name**: Vision Chain
- **Tagline**: Envisioning Economic Ensembles through Cryptographic Convergence.
- **Mission**: A modular blockchain system for efficient, economic cross-chain/cross-rollup ecosystems.

=== KEY FEATURES ===
1. Intent Navigation Network (INN)
2. Proof of Visibility (PoV) Consensus
3. Single Secret Leader Election (SSLE)
4. Cuckoo Hashing based DAG Mempool
5. Zero-Knowledge Sets (ZKS) Interoperability

=== TOKENOMICS ===
- Token: VAI (Native Utility Token)
- Total Supply: 10,000,000,000 (10 Billion)`;

const defaultSystemPrompt = `You are Vision Chain's AI Assistant.
Your goal is to help users understand Vision Chain technology.

Guidelines:
1. Be professional and technical
2. Use markdown formatting when appropriate
3. Cite specific technologies (PoV, INN, SSLE) when relevant
4. Keep responses concise but informative`;

// LocalStorage keys
const STORAGE_KEYS = {
    knowledge: 'visionchain_ai_knowledge',
    prompt: 'visionchain_ai_prompt',
    model: 'visionchain_ai_model',
    voice: 'visionchain_ai_voice',
    ttsVoice: 'visionchain_ai_tts_voice',
    apiKeys: 'visionchain_api_keys'
};

// API Key interface
interface ApiKey {
    id: string;
    name: string;
    key: string;
    provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
    isActive: boolean;
    isValid: boolean | null;
    lastTested: string | null;
    createdAt: string;
}

export default function AdminAIManagement() {
    const [activeTab, setActiveTab] = createSignal('apikeys');
    const [knowledgeContent, setKnowledgeContent] = createSignal('');

    // Split into two bots
    const [intentBot, setIntentBot] = createSignal<BotConfig>({ systemPrompt: '', model: 'gemini-1.5-flash', temperature: 0.7, maxTokens: 2048 });
    const [helpdeskBot, setHelpdeskBot] = createSignal<BotConfig>({ systemPrompt: '', model: 'gemini-1.5-flash', temperature: 0.7, maxTokens: 2048 });
    const [imageSettings, setImageSettings] = createSignal({ model: 'gemini-1.5-pro', quality: 'standard', size: '1k' });
    const [voiceSettings, setVoiceSettings] = createSignal({ model: 'gemini-1.5-flash', ttsVoice: 'Kore', sttModel: 'gemini-1.5-flash' });

    const [isSaving, setIsSaving] = createSignal(false);
    const [saveSuccess, setSaveSuccess] = createSignal(false);
    const [lastSaved, setLastSaved] = createSignal<string | null>(null);

    // API Keys state (fetched from Firebase)
    const [apiKeys, setApiKeys] = createSignal<ApiKeyData[]>([]);
    const [newKeyName, setNewKeyName] = createSignal('');
    const [newKeyValue, setNewKeyValue] = createSignal('');
    const [newKeyProvider, setNewKeyProvider] = createSignal<'gemini' | 'openai' | 'anthropic' | 'deepseek'>('gemini');
    const [showNewKeyValue, setShowNewKeyValue] = createSignal(false);
    const [isTesting, setIsTesting] = createSignal(false);
    const [testResult, setTestResult] = createSignal<{ success: boolean; message: string } | null>(null);

    // Monitoring
    const [realConversations, setRealConversations] = createSignal<AiConversation[]>([]);
    const [isFetchingConvs, setIsFetchingConvs] = createSignal(false);

    // Distribution state
    const [allPurchases, setAllPurchases] = createSignal<VcnPurchase[]>([]);
    const [isDistributing, setIsDistributing] = createSignal(false);

    // Load saved settings on mount from Firebase
    onMount(async () => {
        try {
            const settings = await getChatbotSettings();
            if (settings) {
                setKnowledgeContent(settings.knowledgeBase);
                setIntentBot(settings.intentBot);
                setHelpdeskBot(settings.helpdeskBot);
                if (settings.imageSettings) setImageSettings(settings.imageSettings);
                if (settings.voiceSettings) setVoiceSettings(settings.voiceSettings);
            }

            const keys = await getApiKeys();
            setApiKeys(keys);

            // Fetch recent conversations
            const convs = await getRecentConversations();
            setRealConversations(convs);

            // Fetch all purchases for distribution
            const purchases = await getVcnPurchases();
            setAllPurchases(purchases);
        } catch (error) {
            console.error('Failed to load initial AI settings:', error);
        }
    });

    // Test API key
    const testApiKey = async (key: string, provider: string) => {
        setIsTesting(true);
        setTestResult(null);

        try {
            if (provider === 'gemini') {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
                );
                if (response.ok) {
                    setTestResult({ success: true, message: 'API key is valid!' });
                    return true;
                } else {
                    const error = await response.json();
                    setTestResult({ success: false, message: error.error?.message || 'Invalid API key' });
                    return false;
                }
            }


            if (provider === 'deepseek') {
                const response = await fetch('https://api.deepseek.com/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [{ role: 'user', content: 'Test' }],
                        max_tokens: 1
                    })
                });

                if (response.ok) {
                    setTestResult({ success: true, message: 'DeepSeek API success!' });
                    return true;
                } else {
                    const error = await response.json().catch(() => ({}));
                    setTestResult({ success: false, message: error.error?.message || 'Invalid API Key' });
                    return false;
                }
            }

            // Add other providers later
            setTestResult({ success: false, message: 'Provider not supported yet' });
            return false;
        } catch (error) {
            setTestResult({ success: false, message: 'Connection error. Check your internet.' });
            return false;
        } finally {
            setIsTesting(false);
        }
    };

    const handleDistributeTestnet = async () => {
        const targets = allPurchases().filter(p => p.walletAddress && p.walletAddress.startsWith('0x'));
        if (targets.length === 0) {
            alert("No ready wallets found for distribution.");
            return;
        }

        if (!confirm(`Distribute testnet tokens to ${targets.length} users? (10% of purchased amount)`)) return;

        setIsDistributing(true);
        try {
            for (const target of targets) {
                const amount = (target.amount * 0.1).toFixed(2);
                console.log(`Distributing ${amount} VCN to ${target.walletAddress}...`);
                await contractService.adminSendVCN(target.walletAddress!, amount);
                // Optional: Update Firebase status if needed
            }
            alert("Testnet distribution complete!");
        } catch (err) {
            console.error("Distribution failed:", err);
            alert("Distribution failed. Check console.");
        } finally {
            setIsDistributing(false);
        }
    };

    // Add new API key to Firebase
    const addApiKey = async () => {
        if (!newKeyName() || !newKeyValue()) return;

        const isValid = await testApiKey(newKeyValue(), newKeyProvider());

        await saveApiKey({
            name: newKeyName(),
            key: newKeyValue(),
            provider: newKeyProvider(),
            isActive: isValid && apiKeys().filter(k => k.isActive).length === 0,
            isValid: isValid || false,
        });

        const updatedKeys = await getApiKeys();
        setApiKeys(updatedKeys);

        // Reset form
        setNewKeyName('');
        setNewKeyValue('');
        setTestResult(null);
    };

    // Toggle API key active status in Firebase
    const toggleActiveKey = async (id: string) => {
        const keyToActivate = apiKeys().find(k => k.id === id);
        if (!keyToActivate) return;

        // Deactivate all others, activate this one
        const promises = apiKeys().map(k =>
            updateApiKey(k.id, { isActive: k.id === id })
        );
        await Promise.all(promises);

        const updatedKeys = await getApiKeys();
        setApiKeys(updatedKeys);
    };

    // Delete API key from Firebase
    const deleteApiKeyLocal = async (id: string) => {
        if (confirm('Are you sure you want to delete this key?')) {
            await deleteFireKey(id);
            const updatedKeys = await getApiKeys();
            setApiKeys(updatedKeys);
        }
    };

    // Retest API key
    const retestApiKey = async (id: string) => {
        const key = apiKeys().find(k => k.id === id);
        if (!key) return;

        const isValid = await testApiKey(key.key, key.provider);
        const updatedKeys = apiKeys().map(k =>
            k.id === id ? { ...k, isValid, lastTested: new Date().toISOString() } : k
        );
        setApiKeys(updatedKeys);
        localStorage.setItem(STORAGE_KEYS.apiKeys, JSON.stringify(updatedKeys));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        try {
            await saveChatbotSettings({
                knowledgeBase: knowledgeContent(),
                intentBot: intentBot(),
                helpdeskBot: helpdeskBot(),
                imageSettings: imageSettings(),
                voiceSettings: voiceSettings()
            });

            setLastSaved(new Date().toLocaleTimeString());
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Error saving settings to Firebase.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="space-y-6">
            {/* Header */}
            <div>
                <h1 class="text-3xl font-bold text-white">AI Management</h1>
                <p class="text-gray-400 mt-1">Configure and monitor the Vision AI chatbot system.</p>
            </div>

            {/* Tabs */}
            <div class="flex flex-wrap gap-2 border-b border-white/10 pb-4">
                <For each={tabs}>
                    {(tab) => (
                        <button
                            onClick={() => setActiveTab(tab.id)}
                            class={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab() === tab.id
                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <tab.icon class="w-4 h-4" />
                            <span class="hidden sm:inline">{tab.label}</span>
                        </button>
                    )}
                </For>
            </div>

            {/* Tab Content */}
            <div class="min-h-[500px]">
                {/* API Keys Tab */}
                <Show when={activeTab() === 'apikeys'}>
                    <div class="space-y-6">
                        {/* Header */}
                        <div class="flex items-center justify-between">
                            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                                <Key class="w-5 h-5 text-cyan-400" />
                                API Key Management
                            </h2>
                            <div class="flex items-center gap-2 text-sm">
                                <span class="text-gray-400">Active Key:</span>
                                <Show when={apiKeys().find(k => k.isActive)} fallback={
                                    <span class="text-red-400 flex items-center gap-1">
                                        <X class="w-4 h-4" /> None
                                    </span>
                                }>
                                    <span class="text-green-400 flex items-center gap-1">
                                        <Check class="w-4 h-4" /> {apiKeys().find(k => k.isActive)?.name}
                                    </span>
                                </Show>
                            </div>
                        </div>

                        {/* Add New Key Form */}
                        <div class="rounded-2xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                            <h3 class="text-white font-medium flex items-center gap-2">
                                <Plus class="w-4 h-4 text-cyan-400" />
                                Add New API Key
                            </h3>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="text-gray-400 text-sm mb-1 block">Key Name</label>
                                    <input
                                        type="text"
                                        value={newKeyName()}
                                        onInput={(e) => setNewKeyName(e.currentTarget.value)}
                                        placeholder="e.g. Production Key"
                                        class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>

                                <div>
                                    <label class="text-gray-400 text-sm mb-1 block">Provider</label>
                                    <select
                                        value={newKeyProvider()}
                                        onChange={(e) => setNewKeyProvider(e.currentTarget.value as 'gemini' | 'openai' | 'anthropic' | 'deepseek')}
                                        class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                    >
                                        <option value="gemini">Google Gemini</option>
                                        <option value="deepseek">DeepSeek AI</option>
                                        <option value="openai">OpenAI (GPT)</option>
                                        <option value="anthropic">Anthropic (Claude)</option>
                                    </select>
                                </div>

                                <div>
                                    <label class="text-gray-400 text-sm mb-1 block">API Key</label>
                                    <div class="relative">
                                        <input
                                            type={showNewKeyValue() ? 'text' : 'password'}
                                            value={newKeyValue()}
                                            onInput={(e) => setNewKeyValue(e.currentTarget.value)}
                                            placeholder="Enter your API key"
                                            class="w-full p-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 font-mono text-sm"
                                        />
                                        <button
                                            onClick={() => setShowNewKeyValue(!showNewKeyValue())}
                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                        >
                                            <Show when={showNewKeyValue()} fallback={<Eye class="w-4 h-4" />}>
                                                <EyeOff class="w-4 h-4" />
                                            </Show>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Test Result */}
                            <Show when={testResult()}>
                                <div class={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl ${testResult()?.success
                                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                    }`}>
                                    <Show when={testResult()?.success} fallback={<X class="w-4 h-4" />}>
                                        <Check class="w-4 h-4" />
                                    </Show>
                                    <span>{testResult()?.message}</span>
                                </div>
                            </Show>

                            <div class="flex gap-2">
                                <button
                                    onClick={() => testApiKey(newKeyValue(), newKeyProvider())}
                                    disabled={!newKeyValue() || isTesting()}
                                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                                >
                                    <Show when={isTesting()} fallback={<Shield class="w-4 h-4" />}>
                                        <Loader2 class="w-4 h-4 animate-spin" />
                                    </Show>
                                    {isTesting() ? 'Testing...' : 'Test Key'}
                                </button>
                                <button
                                    onClick={addApiKey}
                                    disabled={!newKeyName() || !newKeyValue() || isTesting()}
                                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
                                >
                                    <Plus class="w-4 h-4" />
                                    Add Key
                                </button>
                            </div>
                        </div>

                        {/* API Keys List */}
                        <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                            <div class="p-4 border-b border-white/5 flex items-center justify-between">
                                <h3 class="text-white font-medium">Saved API Keys</h3>
                                <span class="text-gray-500 text-sm">{apiKeys().length} key(s)</span>
                            </div>

                            <Show when={apiKeys().length === 0}>
                                <div class="p-8 text-center text-gray-500">
                                    <Key class="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>No API keys added yet.</p>
                                    <p class="text-sm mt-1">Add your first API key above to get started.</p>
                                </div>
                            </Show>

                            <div class="divide-y divide-white/5">
                                <For each={apiKeys()}>
                                    {(key) => (
                                        <div class="p-4 hover:bg-white/[0.02] transition-colors">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-4">
                                                    <div class={`p-2 rounded-xl ${key.isActive ? 'bg-green-500/20' : 'bg-white/5'}`}>
                                                        <Key class={`w-5 h-5 ${key.isActive ? 'text-green-400' : 'text-gray-400'}`} />
                                                    </div>
                                                    <div>
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-white font-medium">{key.name}</span>
                                                            <span class={`text-xs px-2 py-0.5 rounded ${key.provider === 'gemini' ? 'bg-blue-500/20 text-blue-400' :
                                                                key.provider === 'openai' ? 'bg-green-500/20 text-green-400' :
                                                                    key.provider === 'deepseek' ? 'bg-blue-600/20 text-blue-300' :
                                                                        'bg-purple-500/20 text-purple-400'
                                                                }`}>
                                                                {key.provider === 'gemini' ? 'Gemini' :
                                                                    key.provider === 'deepseek' ? 'DeepSeek' :
                                                                        key.provider === 'openai' ? 'OpenAI' : 'Anthropic'}
                                                            </span>
                                                            <Show when={key.isActive}>
                                                                <span class="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 flex items-center gap-1">
                                                                    <Power class="w-3 h-3" /> Active
                                                                </span>
                                                            </Show>
                                                        </div>
                                                        <div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                            <span class="font-mono">
                                                                {key.key.substring(0, 8)}...{key.key.substring(key.key.length - 4)}
                                                            </span>
                                                            <span class="flex items-center gap-1">
                                                                <Show when={key.isValid === true}>
                                                                    <Check class="w-3 h-3 text-green-400" />
                                                                    <span class="text-green-400">Valid</span>
                                                                </Show>
                                                                <Show when={key.isValid === false}>
                                                                    <X class="w-3 h-3 text-red-400" />
                                                                    <span class="text-red-400">Invalid</span>
                                                                </Show>
                                                                <Show when={key.isValid === null}>
                                                                    <span class="text-gray-400">Not tested</span>
                                                                </Show>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <button
                                                        onClick={() => retestApiKey(key.id)}
                                                        class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-cyan-400 transition-colors"
                                                        title="Retest key"
                                                    >
                                                        <RotateCcw class="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleActiveKey(key.id)}
                                                        class={`p-2 rounded-lg transition-colors ${key.isActive
                                                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                            : 'hover:bg-white/10 text-gray-400 hover:text-green-400'
                                                            }`}
                                                        title={key.isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        <Power class="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteApiKeyLocal(key.id)}
                                                        class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                                                        title="Delete key"
                                                    >
                                                        <Trash2 class="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>

                        {/* Info */}
                        <div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
                            <AlertCircle class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p class="text-amber-400 font-medium">Important:</p>
                                <ul class="text-amber-400/70 text-sm mt-1 space-y-1">
                                    <li>• Only one API key can be active at a time</li>
                                    <li>• The active key will be used for all AI features</li>
                                    <li>• API keys are stored securely in your browser</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* Prompt Tuning Tab */}
                <Show when={activeTab() === 'prompts'}>
                    <div class="space-y-6">
                        <div class="flex items-center justify-between">
                            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                                <Wand2 class="w-5 h-5 text-cyan-400" />
                                AI System Prompts
                            </h2>
                            <button
                                onClick={handleSave}
                                disabled={isSaving()}
                                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
                            >
                                <Save class="w-4 h-4" />
                                {isSaving() ? 'Saving...' : 'Save All Prompts'}
                            </button>
                        </div>

                        {/* Intent Engine Bot */}
                        <div class="rounded-2xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Bot class="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 class="text-white font-medium">Intent Navigation Engine (Main Wallet Chat)</h3>
                                    <p class="text-gray-500 text-xs text-sm">Analyzes intent for swaps, transfers, and wallet operations.</p>
                                </div>
                            </div>
                            <textarea
                                value={intentBot().systemPrompt}
                                onInput={(e) => setIntentBot({ ...intentBot(), systemPrompt: e.currentTarget.value })}
                                class="w-full h-[200px] bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-gray-300 font-mono resize-none focus:outline-none focus:border-cyan-500/50"
                                placeholder="Enter Intent Engine System Prompt..."
                            />
                        </div>

                        {/* Helpdesk Bot */}
                        <div class="rounded-2xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                    <MessageSquare class="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <h3 class="text-white font-medium">Helpdesk Support Bot (Floating Chat)</h3>
                                    <p class="text-gray-500 text-xs text-sm">Provides general information and support for the landing page.</p>
                                </div>
                            </div>
                            <textarea
                                value={helpdeskBot().systemPrompt}
                                onInput={(e) => setHelpdeskBot({ ...helpdeskBot(), systemPrompt: e.currentTarget.value })}
                                class="w-full h-[200px] bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-gray-300 font-mono resize-none focus:outline-none focus:border-green-500/50"
                                placeholder="Enter Helpdesk System Prompt..."
                            />
                        </div>

                        <Show when={saveSuccess()}>
                            <div class="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
                                <Check class="w-4 h-4" />
                                <span>Prompts synced to all users!</span>
                            </div>
                        </Show>
                    </div>
                </Show>

                {/* Knowledge Base Tab */}
                <Show when={activeTab() === 'knowledge'}>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                                <Database class="w-5 h-5 text-cyan-400" />
                                Knowledge Base Editor
                            </h2>
                            <div class="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving()}
                                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
                                >
                                    <Save class="w-4 h-4" />
                                    {isSaving() ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>

                        <div class="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
                            <textarea
                                value={knowledgeContent()}
                                onInput={(e) => setKnowledgeContent(e.currentTarget.value)}
                                class="w-full h-[400px] bg-transparent p-4 text-sm text-gray-300 font-mono resize-none focus:outline-none"
                                placeholder="Enter global knowledge base content..."
                            />
                        </div>

                        <Show when={saveSuccess()}>
                            <div class="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
                                <Check class="w-4 h-4" />
                                <span>Knowledge base updated globally!</span>
                            </div>
                        </Show>
                    </div>
                </Show>

                {/* Conversations Tab */}
                <Show when={activeTab() === 'conversations'}>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                                <MessageSquare class="w-5 h-5 text-cyan-400" />
                                Recent Conversations
                            </h2>
                            <div class="relative">
                                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search conversations..."
                                    class="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 text-sm"
                                />
                            </div>
                        </div>

                        <div class="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5">
                            <For each={realConversations()}>
                                {(conv) => (
                                    <div class="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between">
                                        <div class="flex items-center gap-4">
                                            <div class={`w-10 h-10 rounded-full flex items-center justify-center ${conv.botType === 'intent' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                                <Bot class="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div class="flex items-center gap-2">
                                                    <span class="text-white font-medium">{conv.userId}</span>
                                                    <span class={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${conv.botType === 'intent' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                                                        {conv.botType}
                                                    </span>
                                                    <span class="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{conv.messages.length} messages</span>
                                                </div>
                                                <p class="text-gray-400 text-sm truncate max-w-md">{conv.lastMessage}</p>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-4">
                                            <span class="text-gray-500 text-[11px] font-mono flex items-center gap-1">
                                                <Clock class="w-3 h-3" />
                                                {new Date(conv.createdAt).toLocaleString()}
                                            </span>
                                            <button class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-cyan-400 transition-colors">
                                                <Eye class="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </For>

                            <Show when={realConversations().length === 0}>
                                <div class="p-10 text-center text-gray-500 italic">
                                    No monitored conversations found yet.
                                </div>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* Model Settings Tab */}
                <Show when={activeTab() === 'models'}>
                    <div class="space-y-6">
                        <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                            <Settings2 class="w-5 h-5 text-cyan-400" />
                            Model Configuration
                        </h2>

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Intent Bot Model */}
                            <div class="rounded-2xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 rounded-xl bg-blue-500/20">
                                        <Bot class="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 class="text-white font-medium">Intent Engine Model</h3>
                                        <p class="text-gray-500 text-sm">Used for complex logic and transactions</p>
                                    </div>
                                </div>
                                <select
                                    value={intentBot().model}
                                    onChange={(e) => setIntentBot({ ...intentBot(), model: e.currentTarget.value })}
                                    class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                >
                                    <option value="gemini-3-pro-preview">Gemini 3.0 Pro</option>
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    <option value="deepseek-chat">DeepSeek Chat</option>
                                </select>
                            </div>

                            {/* Helpdesk Bot Model */}
                            <div class="rounded-2xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 rounded-xl bg-green-500/20">
                                        <MessageSquare class="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <h3 class="text-white font-medium">Helpdesk Bot Model</h3>
                                        <p class="text-gray-500 text-sm">Used for support and landing page chat</p>
                                    </div>
                                </div>
                                <select
                                    value={helpdeskBot().model}
                                    onChange={(e) => setHelpdeskBot({ ...helpdeskBot(), model: e.currentTarget.value })}
                                    class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-green-500/50"
                                >
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                                    <option value="deepseek-chat">DeepSeek Chat</option>
                                </select>
                            </div>

                            {/* Image Model */}
                            <div class="rounded-2xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 rounded-xl bg-purple-500/20">
                                        <Image class="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 class="text-white font-medium">Image Generation</h3>
                                        <p class="text-gray-500 text-sm">Target model for Vision Creator</p>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-3">
                                    <select
                                        value={imageSettings().model}
                                        onChange={(e) => setImageSettings({ ...imageSettings(), model: e.currentTarget.value })}
                                        class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                                    >
                                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    </select>
                                    <select
                                        value={imageSettings().size}
                                        onChange={(e) => setImageSettings({ ...imageSettings(), size: e.currentTarget.value })}
                                        class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                                    >
                                        <option value="1k">Standard (1K)</option>
                                        <option value="2k">High (2K)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Voice Model */}
                            <div class="rounded-2xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 rounded-xl bg-amber-500/20">
                                        <Mic class="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 class="text-white font-medium">Voice & TTS</h3>
                                        <p class="text-gray-500 text-sm">Settings for AI speech synthesis</p>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-3">
                                    <select
                                        value={voiceSettings().model}
                                        onChange={(e) => setVoiceSettings({ ...voiceSettings(), model: e.currentTarget.value })}
                                        class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                                    >
                                        <option value="gemini-1.5-flash">Gemini Flash</option>
                                        <option value="gemini-1.5-pro">Gemini Pro</option>
                                    </select>
                                    <select
                                        value={voiceSettings().ttsVoice}
                                        onChange={(e) => setVoiceSettings({ ...voiceSettings(), ttsVoice: e.currentTarget.value })}
                                        class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                                    >
                                        <option value="Kore">Kore (Balanced)</option>
                                        <option value="Fenrir">Fenrir (Professional)</option>
                                        <option value="Aoide">Aoide (Natural)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving()}
                            class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
                        >
                            <Save class="w-4 h-4" />
                            {isSaving() ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </Show>

                {/* Usage Stats Tab */}
                <Show when={activeTab() === 'stats'}>
                    <div class="space-y-6">
                        <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                            <BarChart3 class="w-5 h-5 text-cyan-400" />
                            Usage Statistics
                        </h2>

                        {/* Stats Cards */}
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div class="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-4">
                                <div class="flex items-center gap-2 text-cyan-400 mb-2">
                                    <Zap class="w-4 h-4" />
                                    <span class="text-xs font-medium">Total API Calls</span>
                                </div>
                                <p class="text-2xl font-bold text-white">{mockStats.totalCalls.toLocaleString()}</p>
                            </div>

                            <div class="rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-4">
                                <div class="flex items-center gap-2 text-blue-400 mb-2">
                                    <MessageSquare class="w-4 h-4" />
                                    <span class="text-xs font-medium">Text Requests</span>
                                </div>
                                <p class="text-2xl font-bold text-white">{mockStats.textCalls.toLocaleString()}</p>
                            </div>

                            <div class="rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-4">
                                <div class="flex items-center gap-2 text-purple-400 mb-2">
                                    <Image class="w-4 h-4" />
                                    <span class="text-xs font-medium">Image Requests</span>
                                </div>
                                <p class="text-2xl font-bold text-white">{mockStats.imageCalls.toLocaleString()}</p>
                            </div>

                            <div class="rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4">
                                <div class="flex items-center gap-2 text-green-400 mb-2">
                                    <Mic class="w-4 h-4" />
                                    <span class="text-xs font-medium">Voice Sessions</span>
                                </div>
                                <p class="text-2xl font-bold text-white">{mockStats.voiceCalls.toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Chart */}
                        <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                            <h3 class="text-white font-medium mb-4">Weekly API Calls</h3>
                            <div class="flex items-end justify-between h-48 gap-2">
                                <For each={mockStats.dailyData}>
                                    {(data) => {
                                        const maxCalls = Math.max(...mockStats.dailyData.map(d => d.calls));
                                        const height = (data.calls / maxCalls) * 100;
                                        return (
                                            <div class="flex-1 flex flex-col items-center gap-2">
                                                <div
                                                    class="w-full bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t-lg transition-all hover:from-cyan-400 hover:to-blue-400"
                                                    style={{ height: `${height}%` }}
                                                />
                                                <span class="text-xs text-gray-500">{data.day}</span>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </div>

                        {/* Performance Metrics */}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                                <div class="flex items-center justify-between">
                                    <span class="text-gray-400">Average Response Time</span>
                                    <span class="text-white font-semibold">{mockStats.avgResponseTime}</span>
                                </div>
                                <div class="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div class="h-full w-[75%] bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                                </div>
                            </div>

                            <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                                <div class="flex items-center justify-between">
                                    <span class="text-gray-400">Success Rate</span>
                                    <span class="text-green-400 font-semibold">{mockStats.successRate}%</span>
                                </div>
                                <div class="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: `${mockStats.successRate}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* Ecosystem & Distribution Tab */}
                <Show when={activeTab() === 'eco'}>
                    <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div class="flex items-center justify-between">
                            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                                <Coins class="w-5 h-5 text-amber-400" />
                                Ecosystem Distribution
                            </h2>
                            <button
                                onClick={handleDistributeTestnet}
                                disabled={isDistributing() || allPurchases().length === 0}
                                class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
                            >
                                <Send class={`w-4 h-4 ${isDistributing() ? 'animate-pulse' : ''}`} />
                                {isDistributing() ? 'Distributing...' : 'Distribute Testnet VCN (10%)'}
                            </button>
                        </div>

                        <div class="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
                            <table class="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr class="border-b border-white/10 bg-white/5">
                                        <th class="p-4 text-gray-400 font-medium">User Email</th>
                                        <th class="p-4 text-gray-400 font-medium">Wallet Address</th>
                                        <th class="p-4 text-gray-400 font-medium">Mainnet VCN</th>
                                        <th class="p-4 text-gray-400 font-medium">Testnet Allocation (10%)</th>
                                        <th class="p-4 text-gray-400 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={allPurchases()}>
                                        {(p) => (
                                            <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                <td class="p-4 text-white font-medium">{p.email}</td>
                                                <td class="p-4 tabular-nums">
                                                    <Show when={p.walletAddress} fallback={
                                                        <span class="text-red-500/50 italic text-xs">Not Linked</span>
                                                    }>
                                                        <code class="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">
                                                            {p.walletAddress!.slice(0, 10)}...{p.walletAddress!.slice(-8)}
                                                        </code>
                                                    </Show>
                                                </td>
                                                <td class="p-4 text-white font-bold">{p.amount.toLocaleString()}</td>
                                                <td class="p-4 text-amber-400 font-black tabular-nums">{(p.amount * 0.1).toLocaleString()}</td>
                                                <td class="p-4">
                                                    <Show when={p.walletAddress} fallback={
                                                        <span class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-500 font-black uppercase tracking-widest">Wait Wallet</span>
                                                    }>
                                                        <span class="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-500 font-black uppercase tracking-widest">Ready</span>
                                                    </Show>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                            <Show when={allPurchases().length === 0}>
                                <div class="p-20 text-center text-gray-500 italic">No purchase records found in database.</div>
                            </Show>
                        </div>

                        <div class="p-5 bg-amber-500/5 border border-amber-500/10 rounded-[24px] flex gap-4 items-start">
                            <div class="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                                <AlertCircle class="w-6 h-6 text-amber-400" />
                            </div>
                            <div class="text-[13px] text-amber-400/80 leading-relaxed">
                                <p class="font-black text-amber-500 mb-1 uppercase tracking-widest text-[11px]">Admin Compliance Notice</p>
                                Distribution is strictly for **Testnet VCN** as part of the PoV validation phase. Tokens are sent directly from the locked Admin Treasury. Please ensure the target users have at least one valid VCN purchase linked to their account.
                            </div>
                        </div>
                    </div>
                </Show>


            </div>
        </div>
    );
}
