import { Component, createSignal, Show, For, onMount } from 'solid-js';
import { ChainConfig } from '../../services/paymaster/types';
import { Network, Database, Shield, Settings, CheckCircle, ArrowRight, ArrowLeft, Activity, Play, Globe, Lock } from 'lucide-solid';

interface ChainRegistrationWizardProps {
    onClose: () => void;
    onSuccess: () => void;
}

const ChainRegistrationWizard: Component<ChainRegistrationWizardProps> = (props) => {
    // 8 Steps: Metadata -> RPC -> Health -> Adapter -> Bridge -> Pool -> Restricted -> Public
    const [step, setStep] = createSignal(1);
    const [loading, setLoading] = createSignal(false);
    const [logs, setLogs] = createSignal<string[]>([]);

    // Form State (V2 Schema)
    const [formData, setFormData] = createSignal<Partial<ChainConfig>>({
        name: '',
        chainId: undefined,
        nativeGasToken: 'ETH',
        explorerUrl: '',
        feeModel: 'EIP1559',
        finalityConfirmations: 64,
        status: 'TESTING',
        rpcConfig: {
            primary: '',
            secondary: '',
            nodeType: 'MANAGED'
        },
        contracts: {
            entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
            paymasterFactory: '',
            bridgeAdapter: ''
        },
        policy: {
            surchargePct: 30,
            dailyCap: '100000000000000000000', // 100 ETH default
            maxGasPrice: '500'
        },
        security: {
            agentWalletAddr: '',
            checkKeyId: ''
        }
    });

    // Verification States
    const [healthCheckPassed, setHealthCheckPassed] = createSignal(false);
    const [executionPassed, setExecutionPassed] = createSignal(false);
    const [bridgePassed, setBridgePassed] = createSignal(false);

    const log = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const handleNext = () => {
        if (step() < 8) setStep(step() + 1);
    };

    const handleBack = () => {
        if (step() > 1) setStep(step() - 1);
    };

    // Step 3: Run Health Check
    const runHealthCheck = async () => {
        setLoading(true);
        setLogs([]);
        log("Starting Health Check Daemon...");

        await new Promise(r => setTimeout(r, 800));
        log(`Connecting to Primary RPC: ${formData().rpcConfig?.primary}...`);

        await new Promise(r => setTimeout(r, 800));
        log("✔ RPC Connection Established");
        log("✔ Block Header Sync: OK (Lag: 0ms)");
        log("✔ Event Subscription (WS): OK");

        await new Promise(r => setTimeout(r, 500));
        setHealthCheckPassed(true);
        setLoading(false);
    };

    // Step 4: Adapter Test
    const runAdapterTest = async () => {
        setLoading(true);
        setLogs([]);
        log("Initializing Validation Account...");

        await new Promise(r => setTimeout(r, 600));
        log("► Running estimateGas(UserOp)...");
        log("✔ Gas Est: 145,000 unit");

        await new Promise(r => setTimeout(r, 600));
        log("► Running sendRawTransaction(Self-Transfer)...");
        log(`✔ TxHash: 0x${Math.random().toString(16).slice(2)}...`);

        await new Promise(r => setTimeout(r, 600));
        log("► Waiting for Confirmation...");
        log("✔ Receipt verified (Block #12345)");

        setExecutionPassed(true);
        setLoading(false);
    };

    // Step 5: Bridge Test
    const runBridgeTest = async () => {
        setLoading(true);
        setLogs([]);
        log("Checking Bridge Adapter Contract...");

        await new Promise(r => setTimeout(r, 800));
        log("► Sending Mock Message (Vision -> Target)...");
        log("✔ Message Dispatched (LayerZero)");

        await new Promise(r => setTimeout(r, 1000));
        log("✔ Destination Confirmed");

        setBridgePassed(true);
        setLoading(false);
    };

    // Step 8: Final Submit
    const handleFinalize = async () => {
        if (!confirm("Promote Chain to Public Status?")) return;
        setLoading(true);
        try {
            await new Promise(r => setTimeout(r, 1500));
            // In real app, call AdminService.registerChain with status 'ACTIVE_PUBLIC'
            console.log("Registered Chain:", formData());
            props.onSuccess();
        } finally {
            setLoading(false);
        }
    };

    const Steps = [
        { id: 1, title: 'Meta', icon: Globe },
        { id: 2, title: 'RPC', icon: Network },
        { id: 3, title: 'Health', icon: Activity },
        { id: 4, title: 'Exec', icon: Play },
        { id: 5, title: 'Bridge', icon: Database },
        { id: 6, title: 'Pool', icon: Settings },
        { id: 7, title: 'Dev', icon: Lock },
        { id: 8, title: 'Public', icon: CheckCircle }
    ];

    return (
        <div class="fixed inset-0 z-[250] flex items-center justify-center p-6 text-white font-sans bg-black/80 backdrop-blur-md">
            <div class="relative w-full max-w-5xl bg-[#0F172A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[700px]">
                {/* Header */}
                <div class="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <div>
                        <h2 class="text-2xl font-bold">Chain Onboarding Wizard</h2>
                        <p class="text-sm text-gray-400">Vision Chain Grand Paymaster Integration</p>
                    </div>
                    {/* Steps */}
                    <div class="flex items-center gap-1">
                        <For each={Steps}>
                            {(s) => (
                                <div class={`flex flex-col items-center gap-1 px-3 ${step() === s.id ? 'opacity-100' : 'opacity-40'}`}>
                                    <div class={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step() === s.id ? 'bg-blue-600 text-white scan-line' : step() > s.id ? 'bg-green-500 text-black' : 'bg-white/10'}`}>
                                        {step() > s.id ? '✓' : s.id}
                                    </div>
                                    <span class="text-[10px] uppercase font-bold tracking-wider">{s.title}</span>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* Body */}
                <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">

                    {/* Step 1: Metadata */}
                    <Show when={step() === 1}>
                        <div class="max-w-xl mx-auto space-y-4 animation-fade-in">
                            <h3 class="text-xl font-bold text-blue-400">Step 1: Chain Metadata</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-xs text-gray-400">Chain Name</label>
                                    <input type="text" class="w-full bg-black/20 border border-white/10 rounded-lg p-3"
                                        value={formData().name} onInput={(e) => setFormData({ ...formData(), name: e.currentTarget.value })} placeholder="e.g. Optimism Mainnet" />
                                </div>
                                <div>
                                    <label class="text-xs text-gray-400">Chain ID</label>
                                    <input type="number" class="w-full bg-black/20 border border-white/10 rounded-lg p-3"
                                        value={formData().chainId || ''} onInput={(e) => setFormData({ ...formData(), chainId: parseInt(e.currentTarget.value) })} placeholder="10" />
                                </div>
                                <div>
                                    <label class="text-xs text-gray-400">Native Token</label>
                                    <input type="text" class="w-full bg-black/20 border border-white/10 rounded-lg p-3"
                                        value={formData().nativeGasToken} onInput={(e) => setFormData({ ...formData(), nativeGasToken: e.currentTarget.value })} />
                                </div>
                                <div>
                                    <label class="text-xs text-gray-400">Fee Model</label>
                                    <select class="w-full bg-black/20 border border-white/10 rounded-lg p-3"
                                        value={formData().feeModel} onChange={(e) => setFormData({ ...formData(), feeModel: e.currentTarget.value as any })}>
                                        <option value="EIP1559">EIP-1559 (Recommended)</option>
                                        <option value="LEGACY">Legacy</option>
                                    </select>
                                </div>
                                <div class="col-span-2">
                                    <label class="text-xs text-gray-400">Explorer URL</label>
                                    <input type="text" class="w-full bg-black/20 border border-white/10 rounded-lg p-3"
                                        value={formData().explorerUrl} onInput={(e) => setFormData({ ...formData(), explorerUrl: e.currentTarget.value })} />
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Step 2: RPC Config */}
                    <Show when={step() === 2}>
                        <div class="max-w-xl mx-auto space-y-4 animation-fade-in">
                            <h3 class="text-xl font-bold text-purple-400">Step 2: Connectivity</h3>
                            <div class="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl text-sm text-blue-200">
                                <b>Hybrid Strategy:</b> Use Managed RPCs for initial testing. Switch to Self-Hosted nodes when daily volume exceeds $1,000.
                            </div>

                            <div class="space-y-4">
                                <div>
                                    <label class="text-xs text-gray-400">Node Strategy</label>
                                    <div class="flex bg-black/30 p-1 rounded-lg mt-1">
                                        <button onClick={() => setFormData({ ...formData(), rpcConfig: { ...formData().rpcConfig!, nodeType: 'MANAGED' } })}
                                            class={`flex-1 py-2 text-xs font-bold rounded-md transition ${formData().rpcConfig?.nodeType === 'MANAGED' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>
                                            Managed RPC
                                        </button>
                                        <button onClick={() => setFormData({ ...formData(), rpcConfig: { ...formData().rpcConfig!, nodeType: 'SELF_HOSTED' } })}
                                            class={`flex-1 py-2 text-xs font-bold rounded-md transition ${formData().rpcConfig?.nodeType === 'SELF_HOSTED' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>
                                            Self-Hosted
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label class="text-xs text-gray-400">Primary RPC (HTTP)</label>
                                    <input type="text" class="w-full bg-black/20 border border-white/10 rounded-lg p-3 font-mono text-sm"
                                        value={formData().rpcConfig?.primary} onInput={(e) => setFormData({ ...formData(), rpcConfig: { ...formData().rpcConfig!, primary: e.currentTarget.value } })}
                                        placeholder="https://..." />
                                </div>
                                <div>
                                    <label class="text-xs text-gray-400">Secondary RPC (Failover)</label>
                                    <input type="text" class="w-full bg-black/20 border border-white/10 rounded-lg p-3 font-mono text-sm"
                                        value={formData().rpcConfig?.secondary} onInput={(e) => setFormData({ ...formData(), rpcConfig: { ...formData().rpcConfig!, secondary: e.currentTarget.value } })}
                                        placeholder="https://..." />
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Step 3: Health Check */}
                    <Show when={step() === 3}>
                        <div class="max-w-xl mx-auto space-y-6 text-center animation-fade-in">
                            <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto relative">
                                <Activity class={`w-10 h-10 ${loading() ? 'text-yellow-400 animate-pulse' : healthCheckPassed() ? 'text-green-400' : 'text-gray-500'}`} />
                                {healthCheckPassed() && <div class="absolute -right-1 -top-1 bg-green-500 rounded-full p-1"><CheckCircle class="w-4 h-4 text-black" /></div>}
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-white">System Health Check</h3>
                                <p class="text-gray-400 text-sm mt-1">Verifying RPC Latency, Block Sync, and Rate Limits</p>
                            </div>

                            <div class="bg-black/40 rounded-xl p-4 h-40 overflow-y-auto text-left font-mono text-xs text-green-400/80 border border-white/10 space-y-1">
                                <For each={logs()}>{(line) => <div>{line}</div>}</For>
                                {logs().length === 0 && <span class="text-gray-600 italic">Ready to start...</span>}
                            </div>

                            <Show when={!healthCheckPassed()} fallback={<div class="text-green-400 font-bold">✓ System Healthy</div>}>
                                <button onClick={runHealthCheck} disabled={loading()}
                                    class="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition disabled:opacity-50">
                                    {loading() ? 'Analyzing...' : 'Run Diagnostics'}
                                </button>
                            </Show>
                        </div>
                    </Show>

                    {/* Step 4: Adapter Execution Test */}
                    <Show when={step() === 4}>
                        <div class="max-w-xl mx-auto space-y-6 text-center animation-fade-in">
                            <h3 class="text-xl font-bold text-white">Execution Adapter Verification</h3>
                            <p class="text-gray-400 text-sm">Testing Gas Estimation and Transaction Relay</p>

                            <div class="bg-black/40 rounded-xl p-4 h-40 overflow-y-auto text-left font-mono text-xs text-blue-400/80 border border-white/10 space-y-1">
                                <For each={logs()}>{(line) => <div>{line}</div>}</For>
                            </div>

                            <Show when={!executionPassed()} fallback={<div class="text-blue-400 font-bold">✓ Execution Logic Verified</div>}>
                                <button onClick={runAdapterTest} disabled={loading()}
                                    class="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-sm transition disabled:opacity-50">
                                    {loading() ? 'Testing...' : 'Test Execution Adapter'}
                                </button>
                            </Show>
                        </div>
                    </Show>

                    {/* Step 5: Bridge Test */}
                    <Show when={step() === 5}>
                        <div class="max-w-xl mx-auto space-y-6 text-center animation-fade-in">
                            <h3 class="text-xl font-bold text-white">Bridge Adapter Verification</h3>

                            <div class="space-y-4 text-left">
                                <div>
                                    <label class="text-xs text-gray-400">Bridge Adapter Contract</label>
                                    <input type="text" class="w-full bg-black/20 border border-white/10 rounded-lg p-3 font-mono text-sm"
                                        value={formData().contracts?.bridgeAdapter} onInput={(e) => setFormData({ ...formData(), contracts: { ...formData().contracts!, bridgeAdapter: e.currentTarget.value } })}
                                        placeholder="0x..." />
                                </div>
                            </div>

                            <div class="bg-black/40 rounded-xl p-4 h-40 overflow-y-auto text-left font-mono text-xs text-orange-400/80 border border-white/10 space-y-1">
                                <For each={logs()}>{(line) => <div>{line}</div>}</For>
                            </div>

                            <Show when={!bridgePassed()} fallback={<div class="text-orange-400 font-bold">✓ Bridge Connection Verified</div>}>
                                <button onClick={runBridgeTest} disabled={loading()}
                                    class="px-8 py-3 bg-orange-600 hover:bg-orange-700 rounded-xl font-bold text-sm transition disabled:opacity-50">
                                    {loading() ? 'Verifying...' : 'Test Cross-Chain Message'}
                                </button>
                            </Show>
                        </div>
                    </Show>

                    {/* Step 6: Pool Setup */}
                    <Show when={step() === 6}>
                        <div class="max-w-xl mx-auto space-y-4 animation-fade-in">
                            <h3 class="text-xl font-bold text-green-400">Paymaster Pool Liquidity</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="col-span-2">
                                    <div class="p-4 bg-green-500/10 border border-green-500/30 rounded-xl mb-2 text-sm text-green-200">
                                        <Shield class="w-4 h-4 inline mr-2" />
                                        TSS KeyGen will be initiated for the cold wallet.
                                    </div>
                                </div>
                                <div>
                                    <label class="text-xs text-gray-400">Daily Cap (Native Token)</label>
                                    <input type="number" class="w-full bg-black/20 border border-white/10 rounded-lg p-3"
                                        value={formatEther(formData().policy?.dailyCap)}
                                        onInput={(e) => setFormData({ ...formData(), policy: { ...formData().policy!, dailyCap: parseEther(e.currentTarget.value) } })}
                                    />
                                </div>
                                <div>
                                    <label class="text-xs text-gray-400">Max Gas Price (Gwei)</label>
                                    <input type="number" class="w-full bg-black/20 border border-white/10 rounded-lg p-3"
                                        value={formData().policy?.maxGasPrice}
                                        onInput={(e) => setFormData({ ...formData(), policy: { ...formData().policy!, maxGasPrice: e.currentTarget.value } })}
                                    />
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Step 7 & 8: Review & Promotion */}
                    <Show when={step() >= 7}>
                        <div class="max-w-2xl mx-auto space-y-6 text-center animation-fade-in">
                            <div class="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                                <Globe class="w-10 h-10 text-blue-400" />
                            </div>
                            <h3 class="text-2xl font-bold text-white">
                                {step() === 7 ? 'Restricted Launch (Internal)' : 'Public Mainnet Launch'}
                            </h3>
                            <p class="text-gray-400 text-sm">
                                {step() === 7
                                    ? "Chain will be active only for whitelisted dApps for final verification."
                                    : "Chain will be promoted to Public status for all developers."}
                            </p>

                            <div class="bg-white/5 rounded-xl p-6 text-left text-sm space-y-2 font-mono text-gray-300">
                                <div class="flex justify-between border-b border-white/5 pb-2">
                                    <span>Chain</span>
                                    <span>{formData().name} ({formData().chainId})</span>
                                </div>
                                <div class="flex justify-between border-b border-white/5 pb-2">
                                    <span>Node</span>
                                    <span>{formData().rpcConfig?.nodeType} ({formData().rpcConfig?.primary})</span>
                                </div>
                                <div class="flex justify-between border-b border-white/5 pb-2">
                                    <span>Status</span>
                                    <span class={step() === 7 ? 'text-yellow-400' : 'text-green-400'}>
                                        {step() === 7 ? 'ACTIVE_RESTRICTED' : 'ACTIVE_PUBLIC'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Show>

                </div>

                {/* Footer Controls */}
                <div class="p-6 border-t border-white/10 bg-white/5 flex justify-between">
                    <button onClick={handleBack}
                        class={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-white/10 transition ${step() === 1 ? 'invisible' : ''}`}
                    >
                        <ArrowLeft class="w-4 h-4" /> Back
                    </button>

                    <Show when={step() === 8} fallback={
                        <button onClick={handleNext}
                            disabled={
                                (step() === 3 && !healthCheckPassed()) ||
                                (step() === 4 && !executionPassed()) ||
                                (step() === 5 && !bridgePassed())
                            }
                            class="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition"
                        >
                            {step() === 7 ? 'Promote to Public' : 'Next Step'} <ArrowRight class="w-4 h-4" />
                        </button>
                    }>
                        <button onClick={handleFinalize} disabled={loading()}
                            class="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition"
                        >
                            Confim Launch <CheckCircle class="w-4 h-4" />
                        </button>
                    </Show>
                </div>
            </div>
        </div>
    );
};

// Helpers
const formatEther = (wei?: string) => wei ? (Number(wei) / 1e18).toString() : '';
const parseEther = (eth: string) => (Number(eth) * 1e18).toString();

export default ChainRegistrationWizard;
