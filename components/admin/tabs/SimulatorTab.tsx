import { createSignal, onMount, Show } from 'solid-js';
import { Activity, Shield, Save, CheckCircle2, Lock, AlertTriangle } from 'lucide-solid';
import { getSystemSettings, saveSystemSettings } from '../../../services/firebaseService';

export function SimulatorTab() {
    const [password, setPassword] = createSignal('');
    const [isSaving, setIsSaving] = createSignal(false);
    const [saveSuccess, setSaveSuccess] = createSignal(false);

    onMount(async () => {
        const settings = await getSystemSettings();
        if (settings?.simulatorPassword) {
            setPassword(settings.simulatorPassword);
        }
    });

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await saveSystemSettings({ simulatorPassword: password() });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to save simulator settings:", error);
            alert("Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <Activity class="w-5 h-5 text-indigo-400" />
                    Traffic Simulator Controls
                </h2>
                <button
                    onClick={handleSave}
                    disabled={isSaving()}
                    class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                    <Show when={saveSuccess()} fallback={
                        <>
                            <Save class="w-3.5 h-3.5" />
                            {isSaving() ? 'Saving...' : 'Save Configuration'}
                        </>
                    }>
                        <CheckCircle2 class="w-3.5 h-3.5 text-green-600" />
                        Saved Successfully
                    </Show>
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Password Setting Card */}
                <div class="p-8 rounded-[32px] bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Lock class="w-24 h-24 text-indigo-400" />
                    </div>

                    <div class="relative z-10">
                        <div class="flex items-center gap-2 text-indigo-400 mb-4">
                            <Shield class="w-4 h-4" />
                            <span class="text-[10px] font-black uppercase tracking-[0.2em]">Access Security</span>
                        </div>
                        <h3 class="text-xl font-black text-white italic mb-2 uppercase">Global Simulator Password</h3>
                        <p class="text-xs text-gray-500 mb-6 leading-relaxed">
                            Set a shared password to prevent unauthorized access to the Traffic Simulator.
                            Only users who enter this password will be able to generate synthetic transactions.
                        </p>

                        <div class="relative max-w-sm">
                            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                value={password()}
                                onInput={(e) => setPassword(e.currentTarget.value)}
                                placeholder="Enter public access password..."
                                class="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Status & Load Warning */}
                <div class="p-8 rounded-[32px] bg-white/[0.02] border border-white/10 flex flex-col justify-between">
                    <div class="space-y-4">
                        <div class="flex items-center gap-2 text-amber-500">
                            <AlertTriangle class="w-5 h-5" />
                            <span class="text-[11px] font-black uppercase tracking-widest">Network Safety Warning</span>
                        </div>
                        <p class="text-xs text-gray-400 leading-relaxed italic">
                            Unrestricted access to the simulator can cause artificial congestion on the Kafka-powered Sequencer, potentially delaying real mainnet-bound transactions and node validation processes.
                        </p>
                        <ul class="space-y-2 mt-4">
                            <li class="flex items-center gap-2 text-[10px] text-gray-500 font-bold">
                                <div class="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                Recommended limit: 100 tx/sec per user
                            </li>
                            <li class="flex items-center gap-2 text-[10px] text-gray-500 font-bold">
                                <div class="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                Automatic throttling enabled for IPs without valid password
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
