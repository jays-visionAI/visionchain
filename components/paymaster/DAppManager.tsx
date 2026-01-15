import { createSignal, createResource, Show, For } from 'solid-js';
import { DAppService } from '../../services/paymaster/DAppService';
import { DAppPaymasterInstance } from '../../services/paymaster/types';
import { Plus, Settings, ChevronRight, Activity, Shield } from 'lucide-solid';

export const DAppManager = () => {
    // Mock Agent/User ID for MVP
    const MOCK_OWNER_ID = "dev_user_1";

    const [dapps] = createResource(async () => {
        return await DAppService.getInstances(MOCK_OWNER_ID);
    });

    const [isCreating, setIsCreating] = createSignal(false);
    const [newDAppName, setNewDAppName] = createSignal('');

    const handleCreateDApp = async (e: Event) => {
        e.preventDefault();
        try {
            // 1. Register DApp
            const dappId = await DAppService.registerDApp(MOCK_OWNER_ID, newDAppName());

            // 2. Create Default Instance (e.g. for Chain 1)
            await DAppService.createInstance(dappId, 1);

            alert(`DApp "${newDAppName()}" Created! ID: ${dappId}`);
            setIsCreating(false);
            setNewDAppName('');
            // Trigger refetch (resource refresh in Solid slightly differs, but for MVP reload works or manual refetch)
            window.location.reload();
        } catch (err) {
            alert("Error creating DApp: " + err);
        }
    };

    return (
        <div class="mt-12 bg-[#0c0c0c] border border-white/10 rounded-[32px] p-8">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h3 class="text-2xl font-black italic uppercase tracking-tight">Developer Console</h3>
                    <p class="text-slate-400 text-sm font-medium">Manage your Gasless Instances and Policy configs.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    class="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold uppercase tracking-wide transition-all"
                >
                    <Plus class="w-4 h-4" />
                    New DApp
                </button>
            </div>

            <Show when={isCreating()}>
                <div class="mb-8 p-6 bg-white/5 rounded-2xl border border-white/10">
                    <form onSubmit={handleCreateDApp} class="flex gap-4">
                        <input
                            type="text"
                            placeholder="DApp Name (e.g. DeFi Swap Pro)"
                            class="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                            value={newDAppName()}
                            onInput={(e) => setNewDAppName(e.currentTarget.value)}
                            required
                        />
                        <button type="submit" class="px-6 py-3 bg-green-600 rounded-xl font-bold">Confirm</button>
                        <button type="button" onClick={() => setIsCreating(false)} class="px-6 py-3 bg-slate-700 rounded-xl font-bold">Cancel</button>
                    </form>
                </div>
            </Show>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Show when={dapps() && dapps()!.length > 0} fallback={
                    <div class="col-span-2 text-center py-10 text-slate-500">
                        No DApps found. Create your first one to start sponsoring gas!
                    </div>
                }>
                    <For each={dapps()}>
                        {(instance: DAppPaymasterInstance) => (
                            <div class="p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-blue-500/30 transition-all group">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                            <Shield class="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 class="font-bold text-lg">{instance.instanceId}</h4>
                                            <div class="text-[10px] uppercase tracking-widest text-slate-500">Chain ID: {instance.chainId}</div>
                                        </div>
                                    </div>
                                    <div class="px-2 py-1 rounded bg-green-500/10 text-green-500 text-[10px] font-black uppercase">Active</div>
                                </div>

                                <div class="space-y-3 mb-6">
                                    <div class="flex justify-between text-sm">
                                        <span class="text-slate-400">Daily Cap</span>
                                        <span class="font-mono">{formatEth(instance.policy.dailyGasCap)} ETH</span>
                                    </div>
                                    <div class="flex justify-between text-sm">
                                        <span class="text-slate-400">Sponsored (Total)</span>
                                        <span class="font-mono text-blue-400">{formatEth(instance.analytics.totalSponsored)} ETH</span>
                                    </div>
                                    <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div class="bg-blue-500 h-full w-[10%]" />
                                    </div>
                                </div>

                                <div class="flex gap-3">
                                    <button class="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors">
                                        <Settings class="w-3 h-3" /> Config
                                    </button>
                                    <button class="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors">
                                        <Activity class="w-3 h-3" /> Analytics
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </Show>
            </div>
        </div>
    );
};

const formatEth = (val: bigint) => {
    return (Number(val) / 1e18).toFixed(4);
};
