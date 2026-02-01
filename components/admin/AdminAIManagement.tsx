import { createSignal, Show, onMount, lazy, Suspense } from 'solid-js';
import {
    Database,
    MessageSquare,
    Settings2,
    BarChart3,
    Wand2,
    RotateCcw,
    Key,
    Coins,
    Activity,
    Sparkles,
    Brain,
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

// Lazy-loaded tab components for better code-splitting
const ApiKeysTab = lazy(() => import('./tabs/ApiKeysTab').then(m => ({ default: m.ApiKeysTab })));
const KnowledgeTab = lazy(() => import('./tabs/KnowledgeTab').then(m => ({ default: m.KnowledgeTab })));
const ConversationsTab = lazy(() => import('./tabs/ConversationsTab').then(m => ({ default: m.ConversationsTab })));
const ModelSettingsTab = lazy(() => import('./tabs/ModelSettingsTab').then(m => ({ default: m.ModelSettingsTab })));
const UsageStatsTab = lazy(() => import('./tabs/UsageStatsTab').then(m => ({ default: m.UsageStatsTab })));
const EcosystemTab = lazy(() => import('./tabs/EcosystemTab').then(m => ({ default: m.EcosystemTab })));
const SimulatorTab = lazy(() => import('./tabs/SimulatorTab').then(m => ({ default: m.SimulatorTab })));
const PromptsTab = lazy(() => import('./tabs/PromptsTab').then(m => ({ default: m.PromptsTab })));
const QuickActionsTab = lazy(() => import('./tabs/QuickActionsTab').then(m => ({ default: m.default })));
const ProactiveAITab = lazy(() => import('./tabs/ProactiveAITab'));

// Tab loading spinner
function TabLoader() {
    return (
        <div class="flex items-center justify-center py-20">
            <div class="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
    );
}

// Tabs configuration
const tabs = [
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare },
    { id: 'models', label: 'Model Settings', icon: Settings2 },
    { id: 'stats', label: 'Usage Stats', icon: BarChart3 },
    { id: 'prompts', label: 'Prompt Tuning', icon: Wand2 },
    { id: 'quickactions', label: 'Quick Actions', icon: Sparkles },
    { id: 'eco', label: 'Ecosystem', icon: Coins },
    { id: 'simulator', label: 'Simulator', icon: Activity },
    { id: 'proactive', label: 'Proactive AI', icon: Brain },
];

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

const defaultKnowledge = `You are the official AI Architect for Vision Chain.
Vision Chain is the first Agentic AI Blockchain (Layer 1).
Your goal is to explain Vision Chain's technology, ecosystem, and vision to users based on the official Whitepaper v1.0.`;

export default function AdminAIManagement() {
    // Navigation
    const [activeTab, setActiveTab] = createSignal('apikeys');

    // UI States
    const [isSaving, setIsSaving] = createSignal(false);
    const [saveSuccess, setSaveSuccess] = createSignal(false);

    // Global Data States
    const [apiKeys, setApiKeys] = createSignal<ApiKeyData[]>([]);
    const [knowledgeContent, setKnowledgeContent] = createSignal(defaultKnowledge);
    const [intentBot, setIntentBot] = createSignal<BotConfig>({ model: 'gemini-1.5-flash', systemPrompt: '', temperature: 0.7, maxTokens: 2048 });
    const [helpdeskBot, setHelpdeskBot] = createSignal<BotConfig>({ model: 'gemini-1.5-flash', systemPrompt: '', temperature: 0.7, maxTokens: 2048 });
    const [imageSettings, setImageSettings] = createSignal({ model: 'gemini-1.5-pro', size: '1k', quality: 'standard' });
    const [voiceSettings, setVoiceSettings] = createSignal({ model: 'gemini-1.5-flash', ttsVoice: 'Kore', sttModel: 'whisper-1' });
    const [promptTuning, setPromptTuning] = createSignal({
        systemRules: '',
        recipientIntent: '',
        senderIntent: '',
        processingRoute: ''
    });

    // Monitoring & Ecosystem
    const [realConversations, setRealConversations] = createSignal<AiConversation[]>([]);
    const [allPurchases, setAllPurchases] = createSignal<VcnPurchase[]>([]);
    const [isDistributing, setIsDistributing] = createSignal(false);
    const [distTxHashes, setDistTxHashes] = createSignal<Record<string, string>>({});

    // parallel data fetching for speed
    onMount(async () => {
        try {
            const [settings, keys, convs, purchases] = await Promise.all([
                getChatbotSettings(),
                getApiKeys(),
                getRecentConversations(),
                getVcnPurchases()
            ]);

            if (settings) {
                setKnowledgeContent(settings.knowledgeBase || defaultKnowledge);
                setIntentBot(settings.intentBot || intentBot());
                setHelpdeskBot(settings.helpdeskBot || helpdeskBot());
                if (settings.imageSettings) setImageSettings(settings.imageSettings);
                if (settings.voiceSettings) setVoiceSettings(settings.voiceSettings);
                if (settings.promptTuning) setPromptTuning({
                    systemRules: settings.promptTuning.systemRules || '',
                    recipientIntent: settings.promptTuning.recipientIntent || '',
                    senderIntent: settings.promptTuning.senderIntent || '',
                    processingRoute: settings.promptTuning.processingRoute || ''
                });
            }

            setApiKeys(keys);
            setRealConversations(convs);
            setAllPurchases(purchases);
        } catch (error) {
            console.error('Failed to load initial AI settings:', error);
        }
    });

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await saveChatbotSettings({
                knowledgeBase: knowledgeContent(),
                intentBot: intentBot(),
                helpdeskBot: helpdeskBot(),
                imageSettings: imageSettings(),
                voiceSettings: voiceSettings(),
                promptTuning: promptTuning()
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Error saving settings. Please check console.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddKey = async (name: string, value: string, provider: any) => {
        try {
            await saveApiKey({ name, key: value, provider, isActive: true, isValid: true });
            const keys = await getApiKeys();
            setApiKeys(keys);
        } catch (error) {
            alert("Failed to add key");
        }
    };

    const handleDeleteKey = async (id: string) => {
        if (!confirm('Are you sure you want to remove this API key?')) return;
        try {
            await deleteFireKey(id);
            setApiKeys(apiKeys().filter(k => k.id !== id));
        } catch (error) {
            alert("Failed to delete key");
        }
    };

    const handleToggleKey = async (id: string, active: boolean) => {
        try {
            await updateApiKey(id, { isActive: active });
            setApiKeys(apiKeys().map(k => k.id === id ? { ...k, isActive: active } : k));
        } catch (error) {
            alert("Failed to toggle key status");
        }
    };

    const handleDistributeTestnet = async () => {
        // CRITICAL: Prevent duplicate execution
        if (isDistributing()) {
            console.warn('[AdminAI] Distribution already in progress');
            return;
        }

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
                const receipt = await contractService.adminSendVCN(target.walletAddress!, amount);

                // Track TxID
                if (receipt && receipt.hash) {
                    setDistTxHashes(prev => ({ ...prev, [target.email]: receipt.hash }));
                }
            }
            alert("Testnet distribution complete!");
        } catch (err) {
            console.error("Distribution failed:", err);
            alert("Distribution failed. Check console.");
        } finally {
            setIsDistributing(false);
        }
    };

    return (
        <div class="bg-[#0f0f13] border border-white/[0.08] rounded-[32px] overflow-hidden shadow-2xl">
            {/* Sidebar Navigation */}
            <div class="flex border-b border-white/[0.06] bg-white/[0.02]">
                <div class="flex-1 flex items-center gap-1 p-2 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => (
                        <button
                            onClick={() => setActiveTab(tab.id)}
                            class={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${activeTab() === tab.id
                                ? 'bg-white/10 text-cyan-400 shadow-lg'
                                : 'text-gray-500 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <tab.icon class="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div class="p-2 border-l border-white/5 flex items-center">
                    <button class="p-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-2xl transition-all">
                        <RotateCcw class="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Tab Content Area */}
            <div class="p-8 min-h-[600px] relative">
                <Suspense fallback={<TabLoader />}>
                    <Show when={activeTab() === 'apikeys'}>
                        <ApiKeysTab
                            apiKeys={apiKeys}
                            onAddKey={(name: string, key: string, provider: string) => handleAddKey(name, key, provider)}
                            onDeleteKey={(id) => handleDeleteKey(id)}
                            onToggleActive={(id, _, active) => handleToggleKey(id, active)}
                        />
                    </Show>

                    <Show when={activeTab() === 'knowledge'}>
                        <KnowledgeTab
                            content={knowledgeContent}
                            setContent={setKnowledgeContent}
                            onSave={handleSave}
                            isSaving={isSaving}
                            saveSuccess={saveSuccess}
                        />
                    </Show>

                    <Show when={activeTab() === 'conversations'}>
                        <ConversationsTab conversations={realConversations} />
                    </Show>

                    <Show when={activeTab() === 'models'}>
                        <ModelSettingsTab
                            intentBot={intentBot} setIntentBot={setIntentBot}
                            helpdeskBot={helpdeskBot} setHelpdeskBot={setHelpdeskBot}
                            imageSettings={imageSettings} setImageSettings={setImageSettings}
                            voiceSettings={voiceSettings} setVoiceSettings={setVoiceSettings}
                            onSave={handleSave} isSaving={isSaving} saveSuccess={saveSuccess}
                        />
                    </Show>

                    <Show when={activeTab() === 'stats'}>
                        <UsageStatsTab stats={mockStats} />
                    </Show>

                    <Show when={activeTab() === 'eco'}>
                        <EcosystemTab
                            purchases={allPurchases}
                            isDistributing={isDistributing}
                            onDistribute={handleDistributeTestnet}
                            txHashes={distTxHashes}
                        />
                    </Show>

                    <Show when={activeTab() === 'simulator'}>
                        <SimulatorTab />
                    </Show>

                    <Show when={activeTab() === 'prompts'}>
                        <PromptsTab
                            settings={promptTuning}
                            setSettings={setPromptTuning}
                            onSave={handleSave}
                            isSaving={isSaving}
                            saveSuccess={saveSuccess}
                        />
                    </Show>

                    <Show when={activeTab() === 'quickactions'}>
                        <QuickActionsTab />
                    </Show>

                    <Show when={activeTab() === 'proactive'}>
                        <ProactiveAITab />
                    </Show>
                </Suspense>
            </div>
        </div>
    );
}
