import { createSignal, createResource, For, Show } from 'solid-js';
import { getTokenSaleParticipants, deployVestingStatus } from '../../services/firebaseService';
import { contractService } from '../../services/contractService';

export const ActivateContract = () => {
    const [participants, { refetch }] = createResource(getTokenSaleParticipants);
    const [deployingFor, setDeployingFor] = createSignal<string | null>(null);

    // Filter participants who have created a wallet but don't have vesting deployed yet
    const readyParticipants = () => participants()?.filter(
        p => p.status === 'WalletCreated' && !p.vestingTx
    ) || [];

    const deployedParticipants = () => participants()?.filter(
        p => p.vestingTx
    ) || [];

    // New: Filter for users who are uploaded but haven't created a wallet yet
    const pendingParticipants = () => participants()?.filter(
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
                cliff, // derived from vestingPeriod or fixed? CSV has 'date' & 'vestingPeriod'
                duration,
                Date.now() // Start now? or CSV date? Assuming Start Now for activation
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
            <h2 class="text-xl font-bold text-white mb-6">Activate Vesting Contracts</h2>

            {/* Stats */}
            <div class="grid grid-cols-3 gap-4 mb-8">
                <div class="bg-indigo-900/20 border border-indigo-800 p-4 rounded-xl">
                    <div class="text-indigo-400 text-sm mb-1">Pass KYC/Email</div>
                    <div class="text-2xl font-bold text-white">{participants()?.length || 0}</div>
                </div>
                <div class="bg-green-900/20 border border-green-800 p-4 rounded-xl">
                    <div class="text-green-400 text-sm mb-1">MyPage/Wallet Ready</div>
                    <div class="text-2xl font-bold text-white">
                        {participants()?.filter(p => p.status === 'WalletCreated' || p.status === 'VestingDeployed').length || 0}
                    </div>
                </div>
                <div class="bg-amber-900/20 border border-amber-800 p-4 rounded-xl">
                    <div class="text-amber-400 text-sm mb-1">Waiting Admin Action</div>
                    <div class="text-2xl font-bold text-white">{readyParticipants().length}</div>
                </div>
            </div>

            {/* List: Ready for Deployment */}
            <h3 class="text-lg font-semibold text-white mb-4">Ready for Deployment</h3>
            <div class="overflow-x-auto rounded-xl border border-slate-800 mb-8">
                <table class="w-full text-left bg-[#0B0E14]">
                    <thead class="bg-slate-800 text-slate-400 text-sm uppercase">
                        <tr>
                            <th class="p-4 rounded-tl-xl">Email</th>
                            <th class="p-4">Partner</th>
                            <th class="p-4">Wallet Address</th>
                            <th class="p-4">Amount</th>
                            <th class="p-4 rounded-tr-xl">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                        <For each={readyParticipants()} fallback={
                            <tr><td colspan="5" class="p-8 text-center text-slate-500">No users ready for activation (Wallet not connected).</td></tr>
                        }>
                            {(user) => (
                                <tr class="hover:bg-slate-800/50 transition-colors">
                                    <td class="p-4 text-white">{user.email}</td>
                                    <td class="p-4">{user.partnerCode}</td>
                                    <td class="p-4 font-mono text-sm text-indigo-400">{user.walletAddress}</td>
                                    <td class="p-4">{user.amountToken.toLocaleString()} VCN</td>
                                    <td class="p-4">
                                        <button
                                            class={`px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all ${deployingFor() === user.email
                                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-indigo-500/20'
                                                }`}
                                            onClick={() => handleDeploy(
                                                user.email,
                                                user.walletAddress!,
                                                user.amountToken,
                                                user.unlockRatio,
                                                3, // Default Cliff (3 months - assumption) hardcoded for prototype
                                                user.vestingPeriod // Duration (months)
                                            )}
                                            disabled={deployingFor() === user.email}
                                        >
                                            {deployingFor() === user.email ? 'Deploying...' : 'Deploy Vesting'}
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>

            {/* List: Pending User Action (Waiting for Wallet Creation) */}
            <Show when={pendingParticipants().length > 0}>
                <h3 class="text-lg font-semibold text-white mb-4 text-amber-500 flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Pending User Action (Waiting for Wallet Creation)
                </h3>
                <div class="overflow-x-auto rounded-xl border border-slate-800 mb-8 opacity-80">
                    <table class="w-full text-left bg-[#0B0E14]">
                        <thead class="bg-slate-800 text-slate-400 text-sm uppercase">
                            <tr>
                                <th class="p-4">Email</th>
                                <th class="p-4">Partner</th>
                                <th class="p-4">Amount</th>
                                <th class="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800">
                            <For each={pendingParticipants()}>
                                {(user) => (
                                    <tr class="hover:bg-slate-800/20">
                                        <td class="p-4 text-slate-300">{user.email}</td>
                                        <td class="p-4">{user.partnerCode}</td>
                                        <td class="p-4">{user.amountToken.toLocaleString()} VCN</td>
                                        <td class="p-4 text-amber-500 text-sm font-bold uppercase tracking-wider">
                                            {user.status || 'Pending'}
                                        </td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
            </Show>

            {/* List: Completed */}
            <Show when={deployedParticipants().length > 0}>
                <div class="mt-8">
                    <h3 class="text-lg font-semibold text-white mb-4 text-slate-500">Already Deployed</h3>
                    <div class="overflow-x-auto rounded-xl border border-slate-800 opacity-60">
                        <table class="w-full text-left bg-[#0B0E14]">
                            <thead class="bg-slate-800 text-slate-400 text-sm uppercase">
                                <tr>
                                    <th class="p-4">Email</th>
                                    <th class="p-4">Tx Hash</th>
                                    <th class="p-4">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800">
                                <For each={deployedParticipants()}>
                                    {(user) => (
                                        <tr>
                                            <td class="p-4">{user.email}</td>
                                            <td class="p-4 font-mono text-xs overflow-hidden max-w-[200px] text-ellipsis" title={user.vestingTx}>
                                                {user.vestingTx}
                                            </td>
                                            <td class="p-4 text-green-500">Active</td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>
                </div>
            </Show>
        </div>
    );
};
