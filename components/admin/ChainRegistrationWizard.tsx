import { Component, createSignal, Show, For } from 'solid-js';
import { ChainConfig } from '../../services/paymaster/types';
import { AdminService } from '../../services/admin/AdminService';
import { Network, Database, Shield, Settings, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-solid';

interface ChainRegistrationWizardProps {
    onClose: () => void;
    onSuccess: () => void;
}

const ChainRegistrationWizard: Component<ChainRegistrationWizardProps> = (props) => {
    const [step, setStep] = createSignal(1);
    const [loading, setLoading] = createSignal(false);

    // Form State
    const [formData, setFormData] = createSignal<Partial<ChainConfig>>({
        status: 'Testing', // Default to Testing
        compatibility: { eip1559: true, blockTimeSec: 2, confirmations: 64, bridgeAdapter: '' },
        contracts: { entryPoint: '', paymaster: '' },
        security: { agentWalletAddr: '', checkKeyId: '' },
        policy: { surchargePct: 30, dailyCap: '100000000000000000000', maxGasPrice: '500' }
    });

    const [networkType, setNetworkType] = createSignal<'Testnet' | 'Mainnet'>('Testnet');

    // Mock verification state
    const [rpcVerified, setRpcVerified] = createSignal(false);
    const [walletGenerated, setWalletGenerated] = createSignal(false);
    const [tssKeyId, setTssKeyId] = createSignal('');

    const handleNext = () => {
        if (step() < 5) setStep(step() + 1);
    };

    const handleBack = () => {
        if (step() > 1) setStep(step() - 1);
    };

    const handleRpcVerify = async () => {
        setLoading(true);
        // Mock RPC check
        setTimeout(() => {
            setRpcVerified(true);
            setLoading(false);
            alert("RPC Connected Successfully! Chain ID Verified.");
        }, 1000);
    };

    const generateWallet = () => {
        const mockAddr = "0x" + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
        setFormData({
            ...formData(),
            security: { ...formData().security!, agentWalletAddr: mockAddr }
        });
        setWalletGenerated(true);
        alert("New Agent Wallet Generated! (Mock)");
    };

    const generateTssKey = () => {
        const mockKeyId = "tss-key-" + Math.floor(Math.random() * 10000);
        setTssKeyId(mockKeyId);
        setFormData({
            ...formData(),
            security: { ...formData().security!, checkKeyId: mockKeyId }
        });
        alert(`TSS Key Generation Started... Key ID: ${mockKeyId}`);
    };

    const handleSubmit = async () => {
        if (!confirm("Confirm Chain Registration?")) return;
        setLoading(true);
        try {
            // Mock Saving
            await new Promise(r => setTimeout(r, 2000));
            // Actual implementation would need AdminService.registerChain(formData())
            console.log("Registered Chain:", formData());
            props.onSuccess();
        } catch (e) {
            alert("Registration Failed");
        } finally {
            setLoading(false);
        }
    };

    const Steps = [
        { id: 1, title: 'Identity', icon: Network },
        { id: 2, title: 'Bridge', icon: Database },
        { id: 3, title: 'Security', icon: Shield },
        { id: 4, title: 'Config', icon: Settings },
        { id: 5, title: 'Review', icon: CheckCircle }
    ];

    return (
        <div class="fixed inset-0 z-[250] flex items-center justify-center p-6 text-white font-sans">
            <div class="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={props.onClose} />

            <div class="relative w-full max-w-4xl bg-[#0F172A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
                {/* Header */}
                <div class="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <div>
                        <h2 class="text-2xl font-bold">New Chain Registration</h2>
                        <p class="text-sm text-gray-400">Grand Paymaster Network Extension Wizard</p>
                    </div>

                    {/* Step Indicator */}
                    <div class="flex items-center gap-2">
                        <For each={Steps}>
                            {(s) => (
                                <div class={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${step() === s.id ? 'bg-blue-600 text-white' : step() > s.id ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-500'}`}>
                                    <s.icon class="w-3 h-3" />
                                    <span>{s.title}</span>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* Content Body */}
                <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <Show when={step() === 1}>
                        <div class="space-y-6 max-w-2xl mx-auto animation-fade-in">
                            <h3 class="text-xl font-bold text-blue-400 mb-4">Network Identity</h3>

                            {/* Network Type Selector */}
                            <div class="flex p-1 bg-white/5 rounded-xl border border-white/10 mb-6">
                                <button onClick={() => setNetworkType('Testnet')}
                                    class={`flex-1 py-2 text-xs font-bold rounded-lg transition ${networkType() === 'Testnet' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Testnet (Recommended)
                                </button>
                                <button onClick={() => setNetworkType('Mainnet')}
                                    class={`flex-1 py-2 text-xs font-bold rounded-lg transition ${networkType() === 'Mainnet' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Mainnet
                                </button>
                            </div>

                            <Show when={networkType() === 'Mainnet'}>
                                <div class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                                    <Shield class="w-5 h-5 text-red-500" />
                                    <div class="text-xs text-red-300">
                                        <b>Warning:</b> Direct Mainnet registration is discouraged.<br />
                                        Please verify compatibility on Testnet first.
                                    </div>
                                </div>
                            </Show>

                            <div class="grid grid-cols-2 gap-6">
                                <div class="col-span-1">
                                    <label class="block text-xs text-gray-400 mb-1">Chain ID (Decimal)</label>
                                    <input type="number"
                                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition"
                                        placeholder="e.g. 1"
                                        value={formData().chainId || ''}
                                        onInput={(e) => setFormData({ ...formData(), chainId: parseInt(e.currentTarget.value) })}
                                    />
                                </div>
                                <div class="col-span-1">
                                    <label class="block text-xs text-gray-400 mb-1">Chain Name</label>
                                    <input type="text"
                                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition"
                                        placeholder="e.g. Ethereum Mainnet"
                                        value={formData().name || ''}
                                        onInput={(e) => setFormData({ ...formData(), name: e.currentTarget.value })}
                                    />
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-xs text-gray-400 mb-1">RPC URL (HTTP)</label>
                                    <div class="flex gap-2">
                                        <input type="text"
                                            class="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition"
                                            placeholder="https://mainnet.infura.io/v3/..."
                                            value={formData().rpcUrl || ''}
                                            onInput={(e) => setFormData({ ...formData(), rpcUrl: e.currentTarget.value })}
                                        />
                                        <button onClick={handleRpcVerify} class={`px-4 rounded-lg font-bold text-sm ${rpcVerified() ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                            {loading() ? '...' : rpcVerified() ? 'Verified' : 'Verify'}
                                        </button>
                                    </div>
                                </div>
                                <div class="col-span-1">
                                    <label class="block text-xs text-gray-400 mb-1">Native Token Symbol</label>
                                    <input type="text"
                                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition"
                                        placeholder="ETH"
                                        value={formData().nativeGasToken || ''}
                                        onInput={(e) => setFormData({ ...formData(), nativeGasToken: e.currentTarget.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </Show>

                    <Show when={step() === 2}>
                        <div class="space-y-6 max-w-2xl mx-auto animation-fade-in">
                            <h3 class="text-xl font-bold text-purple-400 mb-4">Cross-Chain Compatibility</h3>
                            <div class="grid grid-cols-2 gap-6">
                                <div class="col-span-2 p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                                    <div>
                                        <div class="font-bold text-sm">EIP-1559 Support</div>
                                        <div class="text-xs text-gray-400">Type 2 Transactions (BaseFee + PriorityFee)</div>
                                    </div>
                                    <input type="checkbox" checked={formData().compatibility?.eip1559} class="w-5 h-5 accent-blue-500"
                                        onChange={(e) => setFormData({ ...formData(), compatibility: { ...formData().compatibility!, eip1559: e.currentTarget.checked } })}
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-400 mb-1">Avg Block Time (sec)</label>
                                    <input type="number"
                                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition"
                                        value={formData().compatibility?.blockTimeSec}
                                        onInput={(e) => setFormData({ ...formData(), compatibility: { ...formData().compatibility!, blockTimeSec: parseInt(e.currentTarget.value) } })}
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-400 mb-1">Bridge Adapter (Contract)</label>
                                    <input type="text"
                                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition font-mono text-sm"
                                        placeholder="0x..."
                                        value={formData().compatibility?.bridgeAdapter}
                                        onInput={(e) => setFormData({ ...formData(), compatibility: { ...formData().compatibility!, bridgeAdapter: e.currentTarget.value } })}
                                    />
                                </div>
                            </div>
                        </div>
                    </Show>

                    <Show when={step() === 3}>
                        <div class="space-y-6 max-w-2xl mx-auto animation-fade-in">
                            <h3 class="text-xl font-bold text-red-400 mb-4">Security & Key Management</h3>

                            <div class="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mb-6">
                                <h4 class="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                                    <Shield class="w-4 h-4" /> Critical Security Setup
                                </h4>
                                <p class="text-xs text-gray-300 leading-relaxed">
                                    The Agent Wallet is a hot wallet for daily operations.
                                    The TSS Key is for cold storage and high-value authorization.
                                    <br /><b>Warning:</b> Ensure secure backup of the generated Agent Key.
                                </p>
                            </div>

                            <div class="space-y-4">
                                <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div>
                                        <div class="text-sm font-bold text-gray-300">Agent Wallet (Hot)</div>
                                        <div class="text-xs font-mono text-gray-500 mt-1">{formData().security?.agentWalletAddr || 'Not Generated'}</div>
                                    </div>
                                    <button onClick={generateWallet} disabled={walletGenerated()} class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition">
                                        {walletGenerated() ? 'Generated' : 'Generate New'}
                                    </button>
                                </div>

                                <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div>
                                        <div class="text-sm font-bold text-gray-300">TSS Owner Key (Cold)</div>
                                        <div class="text-xs font-mono text-gray-500 mt-1">{tssKeyId() ? `Key ID: ${tssKeyId()}` : 'Not Initialized'}</div>
                                    </div>
                                    <button onClick={generateTssKey} disabled={!!tssKeyId()} class="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-lg text-xs font-bold transition">
                                        {tssKeyId() ? 'Initialized' : 'Init TSS KeyGen'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Show>

                    <Show when={step() === 4}>
                        <div class="space-y-6 max-w-2xl mx-auto animation-fade-in">
                            <h3 class="text-xl font-bold text-green-400 mb-4">Paymaster Configuration</h3>
                            <div class="grid grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-xs text-gray-400 mb-1">EntryPoint Contract</label>
                                    <input type="text"
                                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition font-mono text-sm"
                                        placeholder="0x5FF1..."
                                        value={formData().contracts?.entryPoint}
                                        onInput={(e) => setFormData({ ...formData(), contracts: { ...formData().contracts!, entryPoint: e.currentTarget.value } })}
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-400 mb-1">Paymaster Factory</label>
                                    <input type="text"
                                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition font-mono text-sm"
                                        placeholder="0x..."
                                        value={formData().contracts?.paymaster}
                                        onInput={(e) => setFormData({ ...formData(), contracts: { ...formData().contracts!, paymaster: e.currentTarget.value } })}
                                    />
                                </div>
                                <div class="col-span-1">
                                    <label class="block text-xs text-gray-400 mb-1">Surcharge (%)</label>
                                    <input type="number"
                                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition"
                                        value={formData().policy?.surchargePct}
                                        onInput={(e) => setFormData({ ...formData(), policy: { ...formData().policy!, surchargePct: parseInt(e.currentTarget.value) } })}
                                    />
                                </div>
                                <div class="col-span-1">
                                    <label class="block text-xs text-gray-400 mb-1">Max Gas Price (Gwei)</label>
                                    <input type="number"
                                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition"
                                        value={formData().policy?.maxGasPrice}
                                        onInput={(e) => setFormData({ ...formData(), policy: { ...formData().policy!, maxGasPrice: e.currentTarget.value } })}
                                    />
                                </div>
                            </div>
                        </div>
                    </Show>

                    <Show when={step() === 5}>
                        <div class="space-y-6 max-w-2xl mx-auto animation-fade-in text-center">
                            <div class="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle class="w-8 h-8 text-blue-400" />
                            </div>
                            <h3 class="text-2xl font-bold text-white mb-2">Ready to Register?</h3>
                            <p class="text-gray-400 text-sm mb-8">
                                You are about to add <b>{formData().name} (ID: {formData().chainId})</b> to the Grand Paymaster Network.
                                <br />Double check the configuration below.
                            </p>

                            <div class="bg-white/5 rounded-xl p-6 text-left text-sm space-y-2 font-mono text-gray-300">
                                <div class="flex justify-between border-b border-white/5 pb-2">
                                    <span>RPC URL</span>
                                    <span>{formData().rpcUrl}</span>
                                </div>
                                <div class="flex justify-between border-b border-white/5 pb-2">
                                    <span>Wallet</span>
                                    <span>{formData().security?.agentWalletAddr?.slice(0, 10)}...</span>
                                </div>
                                <div class="flex justify-between border-b border-white/5 pb-2">
                                    <span>Bridge</span>
                                    <span>{formData().compatibility?.bridgeAdapter ? 'Configured' : 'None'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Policy</span>
                                    <span>{formData().policy?.surchargePct}% Surcharge</span>
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

                    <Show when={step() < 5} fallback={
                        <button onClick={handleSubmit} disabled={loading()}
                            class="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                        >
                            {loading() ? 'Registering...' : 'Finalize Registration'}
                            <CheckCircle class="w-4 h-4" />
                        </button>
                    }>
                        <button onClick={handleNext}
                            class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 transition"
                        >
                            Next Step <ArrowRight class="w-4 h-4" />
                        </button>
                    </Show>
                </div>
            </div>
        </div>
    );
};

export default ChainRegistrationWizard;
