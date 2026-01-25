import { createSignal, Show, For, onMount, createEffect } from 'solid-js';
import { getVcnPrice, getVcnPriceSettings, updateVcnPriceSettings, getVcnPriceHistory, initPriceService } from '../../services/vcnPriceService';
import { Motion } from 'solid-motionone';
import {
    TrendingUp,
    Settings2,
    Key,
    Plus,
    Trash2,
    Copy,
    CheckCircle2,
    X,
    Shield
} from 'lucide-solid';

interface AccountingSettingsProps {
    onClose: () => void;
}

export default function AccountingSettingsView(props: AccountingSettingsProps) {
    const [apiKeys, setApiKeys] = createSignal([
        { id: 'key_1', name: 'Netsuite ERP', prefix: 'vk_live_...', created: '2023-10-15', lastUsed: '2 mins ago' },
        { id: 'key_2', name: 'Internal Audit Tool', prefix: 'vk_live_...', created: '2023-11-02', lastUsed: '5 days ago' }
    ]);
    const [isGenerating, setIsGenerating] = createSignal(false);
    const [priceInput, setPriceInput] = createSignal({
        min: '0',
        max: '0',
        period: '60',
        range: '5'
    });

    const PriceChart = () => {
        const history = getVcnPriceHistory();
        if (history.length < 2) return <div class="h-16 flex items-center justify-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">Warming Up Engine...</div>;

        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = Math.max(0.0001, max - min);

        const points = history.map((p, i) => {
            const x = (i / (history.length - 1)) * 100;
            const y = 100 - ((p - min) / range) * 100;
            return `${x},${y}`;
        }).join(' ');

        return (
            <div class="h-20 w-full relative group">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full opacity-60 group-hover:opacity-100 transition-opacity">
                    <defs>
                        <linearGradient id="priceGradientAcc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2" />
                            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
                        </linearGradient>
                    </defs>
                    <path
                        d={`M 0 100 L ${points} L 100 100 Z`}
                        fill="url(#priceGradientAcc)"
                    />
                    <polyline
                        fill="none"
                        stroke="#3b82f6"
                        stroke-width="1.5"
                        points={points}
                        stroke-linejoin="round"
                    />
                </svg>
            </div>
        );
    };

    onMount(() => {
        initPriceService();
    });

    // Automatically sync Firebase settings to input fields when they load/change
    createEffect(() => {
        const settings = getVcnPriceSettings();
        setPriceInput({
            min: settings.minPrice.toString(),
            max: settings.maxPrice.toString(),
            period: settings.volatilityPeriod?.toString() || '60',
            range: settings.volatilityRange?.toString() || '5'
        });
    });

    const handleUpdatePriceRange = async () => {
        const min = parseFloat(priceInput().min.replace(',', '.'));
        const max = parseFloat(priceInput().max.replace(',', '.'));
        const period = parseInt(priceInput().period);
        const rangePerc = parseFloat(priceInput().range);

        if (isNaN(min) || isNaN(max) || isNaN(period) || isNaN(rangePerc)) {
            alert("Please enter valid numeric values");
            return;
        }

        await updateVcnPriceSettings({
            minPrice: min,
            maxPrice: max,
            volatilityPeriod: period,
            volatilityRange: rangePerc
        });
        alert("VCN Price Strategy Updated");
    };

    const generateKey = () => {
        setIsGenerating(true);
        setTimeout(() => {
            setApiKeys([...apiKeys(), {
                id: `key_${Math.random()}`,
                name: 'New Read-Only Key',
                prefix: 'vk_live_...',
                created: 'Just now',
                lastUsed: 'Never'
            }]);
            setIsGenerating(false);
        }, 1500);
    };

    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            class="max-w-4xl mx-auto px-6 pb-32 pt-8"
        >
            {/* Header */}
            <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 border border-white/10">
                        <Settings2 class="w-6 h-6" />
                    </div>
                    <div>
                        <h1 class="text-2xl font-black italic tracking-tighter text-white">ACCOUNTING SETTINGS</h1>
                        <p class="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Manage API Keys & Integrations</p>
                    </div>
                </div>
                <button
                    onClick={props.onClose}
                    class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                    <X class="w-4 h-4" /> Close
                </button>
            </div>

            {/* VCN Price Management Module */}
            <div class="bg-[#0c0c0c] border border-white/10 rounded-2xl overflow-hidden mb-8">
                <div class="p-6 border-b border-white/10">
                    <h3 class="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp class="w-4 h-4 text-emerald-500" />
                        VCN Price Management
                    </h3>
                    <p class="text-[10px] text-gray-500 mt-1">Simulate market volatility with smooth chart-like fluctuations.</p>
                </div>
                <div class="p-6">
                    <div class="mb-6">
                        <PriceChart />
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="space-y-4">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Min Price (USD)</label>
                                    <input
                                        type="text"
                                        inputmode="decimal"
                                        value={priceInput().min}
                                        onInput={(e) => setPriceInput({ ...priceInput(), min: e.currentTarget.value })}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
                                        placeholder="0.0000"
                                    />
                                </div>
                                <div>
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Max Price (USD)</label>
                                    <input
                                        type="text"
                                        inputmode="decimal"
                                        value={priceInput().max}
                                        onInput={(e) => setPriceInput({ ...priceInput(), max: e.currentTarget.value })}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
                                        placeholder="0.0000"
                                    />
                                </div>
                                <div>
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Period (Sec)</label>
                                    <input
                                        type="number"
                                        value={priceInput().period}
                                        onInput={(e) => setPriceInput({ ...priceInput(), period: e.currentTarget.value })}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
                                        placeholder="60"
                                    />
                                </div>
                                <div>
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Range (%)</label>
                                    <input
                                        type="text"
                                        inputmode="decimal"
                                        value={priceInput().range}
                                        onInput={(e) => setPriceInput({ ...priceInput(), range: e.currentTarget.value })}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
                                        placeholder="5.00"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleUpdatePriceRange}
                                class="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-colors"
                            >
                                Update Range & Bounds
                            </button>
                        </div>

                        <div class="bg-blue-600/5 border border-blue-600/10 rounded-2xl p-6 flex flex-col items-center justify-center">
                            <span class="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Live Simulated Price</span>
                            <div class="text-4xl font-black text-white tracking-tighter mb-1">
                                ${getVcnPrice().toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span class="text-[9px] font-black text-green-500 uppercase tracking-widest">Active Smoothing Engine</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* API Keys Section */}
            <div class="bg-[#0c0c0c] border border-white/10 rounded-2xl overflow-hidden mb-8">
                <div class="p-6 border-b border-white/10 flex justify-between items-center">
                    <div>
                        <h3 class="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Key class="w-4 h-4 text-blue-500" />
                            ERP Read-Only Keys
                        </h3>
                        <p class="text-[10px] text-gray-500 mt-1">Manage API keys for automated journal ingestion.</p>
                    </div>
                    <button
                        onClick={generateKey}
                        disabled={isGenerating()}
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {isGenerating() ? 'Generating...' : <><Plus class="w-3 h-3" /> Generate Key</>}
                    </button>
                </div>

                <div class="divide-y divide-white/5">
                    <For each={apiKeys()}>
                        {(key) => (
                            <div class="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                <div class="flex items-center gap-4">
                                    <div class="bg-white/5 p-2 rounded-lg">
                                        <Shield class="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div>
                                        <div class="font-bold text-sm text-white mb-1">{key.name}</div>
                                        <div class="flex items-center gap-3">
                                            <code class="px-2 py-0.5 bg-black border border-white/10 rounded text-[10px] font-mono text-gray-400">{key.prefix}••••••••</code>
                                            <span class="text-[10px] text-gray-600 font-bold uppercase tracking-wider">Created: {key.created}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-4">
                                    <div class="text-right hidden md:block">
                                        <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Last Used</div>
                                        <div class="text-xs font-bold text-white">{key.lastUsed}</div>
                                    </div>
                                    <button class="text-gray-500 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-lg">
                                        <Trash2 class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* Information Card */}
            <div class="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 flex gap-4">
                <div class="p-2 bg-blue-500/20 rounded-lg h-fit">
                    <Shield class="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h4 class="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Security Note</h4>
                    <p class="text-[10px] text-gray-400 leading-relaxed">
                        These keys provide <strong>Read-Only access</strong> to VisionScan's Journaling Engine. They cannot execute transactions or modify accounting rules.
                        For write access (e.g. Rule Deployment), please use the Admin CLI.
                    </p>
                </div>
            </div>

        </Motion.div>
    );
}
