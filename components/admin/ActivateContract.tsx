import { createSignal, createResource, For, Show } from 'solid-js';
import { getAllUsers, deployVestingStatus } from '../../services/firebaseService';
import { contractService } from '../../services/contractService';

export const ActivateContract = () => {
    const [participants, { refetch }] = createResource(async () => await getAllUsers(500));
    const [deployingFor, setDeployingFor] = createSignal<string | null>(null);
    const [sendingFor, setSendingFor] = createSignal<string | null>(null);

    // Filter participants who have created a wallet but don't have vesting deployed yet
    const readyParticipants = () => participants()?.filter(
        p => p.status === 'WalletCreated' && !p.vestingTx
    ) || [];

    const deployedParticipants = () => participants()?.filter(
        p => p.vestingTx
    ) || [];

    // Pending or other statuses
    const otherParticipants = () => participants()?.filter(
        p => p.status !== 'WalletCreated' && !p.vestingTx && p.status !== 'VestingDeployed'
    ) || [];

    const handleDeploy = async (email: string, walletAddress: string, amount: number, unlockRatio: number, cliff: number, duration: number) => {
        setDeployingFor(email);
        try {
            // 1. Call Smart Contract
            const tx = await contractService.createVestingSchedule(
                walletAddress,
                amount,
                unlockRatio,
                cliff,
                duration,
                Date.now()
            );

            // 2. Update Firestore
            await deployVestingStatus(email, tx.hash);

            alert(`Successfully deployed vesting for ${email}!`);
            refetch();
        } catch (error: any) {
            console.error(error);
            alert(`Failed to deploy: ${error.message}`);
        } finally {
            setDeployingFor(null);
        }
    };

    return (
        <div class="text-slate-300">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold text-white">Activate Vesting Contracts</h2>
                <button
                    onClick={() => refetch()}
                    class="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-slate-400"
                    title="Refresh Data"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>

            {/* Testnet Distribution Banner */}
            <div class="mb-8 p-6 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/20 rounded-2xl relative overflow-hidden">
                <div class="absolute inset-0 bg-blue-500/5 pattern-grid-lg animate-pulse-slow pointer-events-none" />
                <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h2 class="text-lg font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            Testnet VCN Distribution
                        </h2>
                        <p class="text-xs text-slate-400 font-medium">Automatic 10% allocation for testnet participation</p>
                    </div>

                    <div class="flex items-center gap-8 text-right">
                        <div>
                            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Max Supply (Testnet)</div>
                            <div class="text-xl font-mono text-slate-300">
                                4,000,000,000 <span class="text-xs text-slate-500">VCN</span>
                            </div>
                        </div>
                        <div class="h-8 w-px bg-white/10" />
                        <div>
                            <div class="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Committed / Distributed</div>
                            <div class="text-xl font-mono text-white">
                                {(participants()?.reduce((sum, p) => sum + p.amountToken, 0) || 0).toLocaleString()} <span class="text-xs text-slate-500 font-normal">/</span> <span class="text-blue-400">{(participants()?.reduce((sum, p) => {
                                    if (p.status === 'WalletCreated' || p.vestingTx) return sum + (p.amountToken * 0.1);
                                    return sum;
                                }, 0) || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-indigo-900/20 border border-indigo-800 p-4 rounded-xl">
                    <div class="text-indigo-400 text-sm mb-1">Total Registered</div>
                    <div class="text-3xl font-bold text-white">{participants()?.length || 0}</div>
                </div>
                <div class="bg-amber-900/20 border border-amber-800 p-4 rounded-xl">
                    <div class="text-amber-400 text-sm mb-1">Pending Wallet</div>
                    <div class="text-3xl font-bold text-white">{otherParticipants().length}</div>
                </div>
                <div class="bg-green-900/20 border border-green-800 p-4 rounded-xl">
                    <div class="text-green-400 text-sm mb-1">Ready to Deploy</div>
                    <div class="text-3xl font-bold text-white">{readyParticipants().length}</div>
                </div>
            </div>

            <Show when={participants.loading}>
                <div class="text-center py-12">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
                    <p class="text-slate-400">Loading participants...</p>
                </div>
            </Show>

            <Show when={!participants.loading}>
                {/* 1. Deployment Actions (Priority) */}
                <Show when={readyParticipants().length > 0}>
                    <h3 class="text-lg font-semibold text-white mb-4">Ready for Deployment</h3>
                    <div class="overflow-x-auto rounded-xl border border-green-900/50 mb-10 shadow-lg shadow-green-900/10">
                        <table class="w-full text-left bg-[#0B0E14]">
                            <thead class="bg-green-900/20 text-green-400 text-sm uppercase">
                                <tr>
                                    <th class="p-4">Email</th>
                                    <th class="p-4">Partner</th>
                                    <th class="p-4">Wallet</th>
                                    <th class="p-4">Amount</th>
                                    <th class="p-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800">
                                <For each={readyParticipants()}>
                                    {(user) => (
                                        <tr class="hover:bg-slate-800/50 transition-colors">
                                            <td class="p-4 text-white font-medium">{user.email}</td>
                                            <td class="p-4">{user.partnerCode || 'SELF'}</td>
                                            <td class="p-4 font-mono text-xs text-slate-400">{user.walletAddress}</td>
                                            <td class="p-4">{(user.amountToken || 0).toLocaleString()} VCN</td>
                                            <td class="p-4 text-center space-x-2 flex justify-center">
                                                {/* Testnet Token Button */}
                                                <button
                                                    class={`px-4 py-2 text-white rounded-lg text-xs font-bold shadow-lg transition-all ${sendingFor() === user.email ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
                                                    title="Send 10% Testnet VCN"
                                                    disabled={sendingFor() === user.email}
                                                    onClick={async () => {
                                                        // CRITICAL: Prevent duplicate execution
                                                        if (sendingFor()) {
                                                            console.warn('[ActivateContract] Already sending');
                                                            return;
                                                        }

                                                        const amount = Math.floor((user.amountToken || 1000) * 0.1);
                                                        if (!confirm(`Send ${amount.toLocaleString()} VCN (10%) to ${user.email}?`)) return;

                                                        setSendingFor(user.email);
                                                        try {
                                                            await contractService.adminSendVCN(
                                                                user.walletAddress!,
                                                                amount.toString()
                                                            );
                                                            alert(`Successfully sent ${amount} VCN to ${user.email}`);
                                                        } catch (e: any) {
                                                            console.error(e);
                                                            alert(`Failed: ${e.message}`);
                                                        } finally {
                                                            setSendingFor(null);
                                                        }
                                                    }}
                                                >
                                                    {sendingFor() === user.email ? 'Sending...' : 'Send Token'}
                                                </button>

                                                {/* Deploy Vesting Button */}
                                                <button
                                                    class={`px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all ${deployingFor() === user.email
                                                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                                        : 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/20'
                                                        }`}
                                                    onClick={() => handleDeploy(
                                                        user.email,
                                                        user.walletAddress!,
                                                        user.amountToken || 0,
                                                        user.tier || 1, // Default tier? or unlockRatio. Wait, original used user.unlockRatio.
                                                        3,
                                                        user.tier || 12 // Default vesting period
                                                    )}
                                                    disabled={deployingFor() === user.email}
                                                >
                                                    {deployingFor() === user.email ? 'Deploying...' : 'Deploy Contract'}
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>
                </Show>

                {/* 2. All Other Users (Pending View) - ALWAYS SHOW THIS if no one is ready or just to list everyone */}
                <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-slate-500"></span>
                    Registered Users (Waiting for Wallet Connection)
                </h3>
                <div class="overflow-x-auto rounded-xl border border-slate-800 mb-8">
                    <table class="w-full text-left bg-[#0B0E14]">
                        <thead class="bg-slate-800 text-slate-400 text-sm uppercase">
                            <tr>
                                <th class="p-4">Email</th>
                                <th class="p-4">Partner</th>
                                <th class="p-4 text-right">Amount</th>
                                <th class="p-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800">
                            <For each={participants() ? [...otherParticipants(), ...deployedParticipants()] : []} fallback={
                                <tr><td colspan="4" class="p-8 text-center text-slate-500 italic">No registered users found. Upload CSV first.</td></tr>
                            }>
                                {(user) => (
                                    <tr class="hover:bg-slate-800/20 border-b border-slate-800/50">
                                        <td class="p-4 text-slate-300">{user.email}</td>
                                        <td class="p-4 text-slate-500">{user.partnerCode || 'SELF'}</td>
                                        <td class="p-4 text-right font-mono text-slate-400">{(user.amountToken || 0).toLocaleString()}</td>
                                        <td class="p-4 text-right">
                                            <span class={`text-xs font-bold px-2 py-1 rounded-full ${user.vestingTx ? 'bg-green-900/30 text-green-400' :
                                                user.status === 'WalletCreated' ? 'bg-indigo-900/30 text-indigo-400' :
                                                    'bg-slate-800 text-slate-500'
                                                }`}>
                                                {user.vestingTx ? 'ACTIVE' : (user.status || 'PENDING')}
                                            </span>
                                        </td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
            </Show>
        </div>
    );
};
