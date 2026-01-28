import { createSignal, createResource, Show, For } from 'solid-js';
import {
    Search,
    Filter,
    ShieldCheck,
    RefreshCw,
    UserPlus
} from 'lucide-solid';
import { getAllUsers, resendActivationEmail, manualInviteUser, UserData } from '../../services/firebaseService';
import { contractService } from '../../services/contractService';

// Sub-components
import { UserTableRow } from './users/UserTableRow';
import { UserTableHead } from './users/UserTableHead';
import { ManualInviteModal } from './users/ManualInviteModal';
import { TransferSuccessModal } from './users/TransferSuccessModal';

const AdminUsers = () => {
    const [searchQuery, setSearchQuery] = createSignal('');
    const [statusFilter, setStatusFilter] = createSignal('all');
    const [users, { mutate, refetch }] = createResource(() => getAllUsers());
    const [isInviteModalOpen, setIsInviteModalOpen] = createSignal(false);
    const [isInviting, setIsInviting] = createSignal(false);
    const [resendingEmail, setResendingEmail] = createSignal<string | null>(null);
    const [successModal, setSuccessModal] = createSignal({
        isOpen: false,
        txHash: '',
        recipient: '',
        recipientAddress: '',
        amount: 0
    });

    const filteredUsers = () => {
        if (!users()) return [];
        return users()!.filter(user => {
            const nameMatch = (user.name?.toLowerCase() || '').includes(searchQuery().toLowerCase());
            const emailMatch = user.email.toLowerCase().includes(searchQuery().toLowerCase());
            const addrMatch = (user.walletAddress?.toLowerCase() || '').includes(searchQuery().toLowerCase());
            const matchesSearch = nameMatch || emailMatch || addrMatch;
            const matchesStatus = statusFilter() === 'all' || user.status === statusFilter();
            return matchesSearch && matchesStatus;
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const shortAddress = (addr?: string) => {
        if (!addr || addr === 'Not Created' || !addr.startsWith('0x')) return 'Not Created';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const handleResendEmail = async (email: string) => {
        if (resendingEmail()) return;
        setResendingEmail(email);
        try {
            await resendActivationEmail(email);
            alert('Verification email resent.');
        } catch (e) {
            alert('Failed to resend email');
        } finally {
            setResendingEmail(null);
        }
    };

    const handleInviteSubmit = async (data: { email: string; partnerCode: string; tier: number; amountToken: number }) => {
        if (isInviting()) return;
        setIsInviting(true);
        try {
            await manualInviteUser(data);
            alert('Invitation email sent.');
            setIsInviteModalOpen(false);
            refetch();
        } catch (e) {
            alert('Invitation failed');
        } finally {
            setIsInviting(false);
        }
    };

    const handleSendVCN = async (user: UserData) => {
        const defaultAmount = Math.floor((user.amountToken || 1000) * 0.1);
        const input = prompt(`Enter VCN amount to send to [${user.email}]:`, defaultAmount.toString());

        if (input === null) return;
        const amountStr = input.trim();
        const amount = parseFloat(amountStr);

        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid amount.");
            return;
        }

        try {
            const receipt = await contractService.adminSendVCN(
                user.walletAddress!,
                amountStr
            );
            setSuccessModal({
                isOpen: true,
                txHash: receipt.hash || '',
                recipient: user.email,
                recipientAddress: user.walletAddress!,
                amount: amount
            });
        } catch (e: any) {
            console.error(e);
            alert(`Transfer failed: ${e.message}`);
        }
    };

    return (
        <div class="p-6 max-w-7xl mx-auto text-white">
            <header class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <h1 class="text-4xl font-black italic tracking-tighter mb-2">USER MANAGEMENT</h1>
                    <div class="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        <ShieldCheck class="w-3 h-3 text-cyan-500" />
                        <span>Admin Access Controlled Ledger</span>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <button
                        onClick={() => refetch()}
                        class="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all"
                        title="Refresh"
                    >
                        <RefreshCw class={`w-5 h-5 ${users.loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        class="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-cyan-600/20"
                    >
                        <UserPlus class="w-4 h-4" />
                        Manual Invite
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
                <div class="md:col-span-8 relative group">
                    <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by name, email or address"
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        class="w-full pl-12 pr-4 py-4 bg-[#0B0E14] border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                    />
                </div>
                <div class="md:col-span-4 relative group">
                    <Filter class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-500 transition-colors" />
                    <select
                        value={statusFilter()}
                        onChange={(e) => setStatusFilter(e.currentTarget.value)}
                        class="w-full appearance-none pl-12 pr-4 py-4 bg-[#0B0E14] border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="Registered">Registered</option>
                        <option value="WalletCreated">Wallet Created</option>
                        <option value="VestingDeployed">Vesting Deployed</option>
                        <option value="Pending">Pending</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <UserTableHead />

                {/* Table Body */}
                <div class="divide-y divide-white/5">
                    <Show when={users.loading}>
                        <div class="p-8 text-center text-gray-500">
                            <div class="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
                            Loading users...
                        </div>
                    </Show>

                    <For each={filteredUsers()}>
                        {(user) => (
                            <UserTableRow
                                user={user}
                                onSendVCN={handleSendVCN}
                                onResendEmail={handleResendEmail}
                                resendingEmail={resendingEmail()}
                                copyToClipboard={copyToClipboard}
                                shortAddress={shortAddress}
                            />
                        )}
                    </For>
                </div>
            </div>

            {/* Modals extracted */}
            <ManualInviteModal
                isOpen={isInviteModalOpen()}
                onClose={() => setIsInviteModalOpen(false)}
                onInvite={handleInviteSubmit}
                isInviting={isInviting()}
            />

            <TransferSuccessModal
                isOpen={successModal().isOpen}
                txHash={successModal().txHash}
                recipient={successModal().recipient}
                recipientAddress={successModal().recipientAddress}
                amount={successModal().amount}
                onClose={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
                copyToClipboard={copyToClipboard}
            />
        </div>
    );
};

export default AdminUsers;
