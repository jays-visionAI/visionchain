import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import {
    Search,
    Filter,
    MoreVertical,
    Shield,
    ShieldCheck,
    Clock,
    CheckCircle,
    XCircle,
    Star,
    AlertCircle,
    Mail,
    RefreshCw,
    UserPlus,
    X,
    Send,
    Copy,
    ExternalLink
} from 'lucide-solid';
import { getAllUsers, resendActivationEmail, manualInviteUser } from '../../services/firebaseService';
import { contractService } from '../../services/contractService';

const statusStyles = {
    Pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    Registered: 'bg-green-500/10 text-green-500 border-green-500/20',
    WalletCreated: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    VestingDeployed: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    pending: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
};

const AdminUsers = () => {
    const [searchQuery, setSearchQuery] = createSignal('');
    const [statusFilter, setStatusFilter] = createSignal('all');
    const [users, { mutate, refetch }] = createResource(() => getAllUsers());
    const [isInviteModalOpen, setIsInviteModalOpen] = createSignal(false);
    const [inviteEmail, setInviteEmail] = createSignal('');
    const [invitePartnerCode, setInvitePartnerCode] = createSignal('');
    const [inviteTier, setInviteTier] = createSignal(1);
    const [inviteAmount, setInviteAmount] = createSignal(1000);
    const [isInviting, setIsInviting] = createSignal(false);
    const [resendingEmail, setResendingEmail] = createSignal<string | null>(null);
    const [successModal, setSuccessModal] = createSignal({
        isOpen: false,
        txHash: '',
        recipient: '',
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
            alert('인증 이메일이 재전송되었습니다.');
        } catch (e) {
            alert('이메일 재전송 실패');
        } finally {
            setResendingEmail(null);
        }
    };

    const handleManualInvite = async (e: Event) => {
        e.preventDefault();
        if (isInviting()) return;
        setIsInviting(true);
        try {
            await manualInviteUser({
                email: inviteEmail(),
                partnerCode: invitePartnerCode() || 'DIRECT',
                tier: inviteTier(),
                amountToken: inviteAmount()
            });
            alert('초대 메일이 발송되었습니다.');
            setIsInviteModalOpen(false);
            refetch();
        } catch (e) {
            alert('초대 실패');
        } finally {
            setIsInviting(false);
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
                        title="새로고침"
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
                        placeholder="이름, 이메일 또는 지갑 주소검색"
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        class="w-full pl-12 pr-4 py-4 bg-[#0B0E14] border border-white/10 rounded-2xl text-sm focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                    />
                </div>
                <div class="md:col-span-4 relative group">
                    <Filter class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-500 transition-colors" />
                    <select
                        value={statusFilter()}
                        onChange={(e) => setStatusFilter(e.currentTarget.value)}
                        class="w-full appearance-none pl-12 pr-4 py-4 bg-[#0B0E14] border border-white/10 rounded-2xl text-sm focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
                    >
                        <option value="all">모든 상태</option>
                        <option value="Registered">가입 완료</option>
                        <option value="WalletCreated">지갑 생성됨</option>
                        <option value="VestingDeployed">베스팅 배포됨</option>
                        <option value="Pending">대기 중</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                {/* Table Header */}
                <div class="hidden md:grid grid-cols-12 gap-4 p-4 bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <div class="col-span-2">User Info</div>
                    <div class="col-span-2">Reg Status</div>
                    <div class="col-span-1">Wallet</div>
                    <div class="col-span-3">Wallet Address</div>
                    <div class="col-span-1">Vesting</div>
                    <div class="col-span-1">Joined</div>
                    <div class="col-span-2 text-right pr-4">Action</div>
                </div>

                {/* Table Body */}
                <div class="divide-y divide-white/5">
                    <Show when={users.loading}>
                        <div class="p-8 text-center text-gray-500">
                            <div class="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
                            Loading users...
                        </div>
                    </Show>

                    <For each={filteredUsers()}>
                        {(user) => {
                            const isRegistered = user.status === 'Registered' || user.status === 'WalletCreated' || user.status === 'VestingDeployed';
                            const hasWallet = (user.walletAddress && user.walletAddress.length > 20) || user.status === 'WalletCreated' || user.status === 'VestingDeployed';

                            return (
                                <div class="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-white/[0.03] transition-colors items-center">
                                    {/* User Info */}
                                    <div class="md:col-span-2 flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 font-black border border-cyan-500/10 text-xs">
                                            {user.name ? user.name.charAt(0) : '?'}
                                        </div>
                                        <div class="min-w-0">
                                            <p class="text-white font-black text-xs truncate uppercase tracking-tight leading-none mb-1">{user.name || 'Unknown'}</p>
                                            <p class="text-gray-500 text-[9px] truncate font-bold uppercase tracking-widest leading-none">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Registration Status */}
                                    <div class="md:col-span-2 flex items-center">
                                        <Show when={isRegistered} fallback={
                                            <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-500/10 text-[9px] font-black text-yellow-500 uppercase tracking-widest border border-yellow-500/20 whitespace-nowrap">
                                                <Clock class="w-3 h-3" />
                                                Pending
                                            </span>
                                        }>
                                            <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 text-[9px] font-black text-green-500 uppercase tracking-widest border border-green-500/20 whitespace-nowrap">
                                                <CheckCircle class="w-3 h-3" />
                                                Registered
                                            </span>
                                        </Show>
                                    </div>

                                    {/* Wallet Status */}
                                    <div class="md:col-span-1 flex items-center">
                                        <Show when={hasWallet} fallback={
                                            <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-500/10 text-[9px] font-black text-gray-500 uppercase tracking-widest border border-gray-500/20">
                                                <XCircle class="w-3 h-3" />
                                                None
                                            </span>
                                        }>
                                            <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 text-[9px] font-black text-blue-500 uppercase tracking-widest border border-blue-500/20">
                                                <Shield class="w-3 h-3" />
                                                Active
                                            </span>
                                        </Show>
                                    </div>

                                    {/* Wallet Address */}
                                    <div class="md:col-span-3 flex items-center">
                                        <Show when={hasWallet && user.walletAddress && user.walletAddress !== 'Not Created'} fallback={
                                            <span class="text-[9px] font-bold text-gray-700 uppercase tracking-widest italic">Address Missing</span>
                                        }>
                                            <div class="flex items-center gap-2 group/addr">
                                                <span class="text-[11px] font-mono text-cyan-400 group-hover:text-cyan-300 transition-colors">
                                                    {shortAddress(user.walletAddress)}
                                                </span>
                                                <div class="flex items-center gap-1 opacity-0 group-hover/addr:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => copyToClipboard(user.walletAddress!)}
                                                        class="p-1 hover:bg-white/10 rounded-md text-gray-500 hover:text-white transition-colors"
                                                        title="Copy Address"
                                                    >
                                                        <Copy class="w-3 h-3" />
                                                    </button>
                                                    <a
                                                        href={`https://visionscan.org/address/${user.walletAddress}`}
                                                        target="_blank"
                                                        class="p-1 hover:bg-white/10 rounded-md text-gray-500 hover:text-white transition-colors"
                                                        title="View on Explorer"
                                                    >
                                                        <ExternalLink class="w-3 h-3" />
                                                    </a>
                                                </div>
                                            </div>
                                        </Show>
                                    </div>

                                    {/* Vesting Status */}
                                    <div class="md:col-span-1 flex items-center">
                                        <Show when={user.status === 'VestingDeployed'} fallback={
                                            <span class="text-[9px] font-bold text-gray-600 uppercase tracking-widest">N/A</span>
                                        }>
                                            <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/10 text-[9px] font-black text-purple-400 uppercase tracking-widest border border-purple-500/20">
                                                <Star class="w-3 h-3" />
                                                Deployed
                                            </span>
                                        </Show>
                                    </div>

                                    {/* Join Date */}
                                    <div class="md:col-span-1 flex items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        {user.joinDate || '-'}
                                    </div>

                                    {/* Actions */}
                                    <div class="md:col-span-2 flex items-center justify-end gap-1.5">
                                        <Show when={hasWallet && user.walletAddress && user.walletAddress !== 'Not Created'}>
                                            <button
                                                onClick={async () => {
                                                    const defaultAmount = Math.floor((user.amountToken || 1000) * 0.1);
                                                    const input = prompt(`[${user.email}] 에게 보낼 VCN 수량을 입력하세요:`, defaultAmount.toString());

                                                    if (input === null) return;
                                                    const amountStr = input.trim();
                                                    const amount = parseFloat(amountStr);

                                                    if (isNaN(amount) || amount <= 0) {
                                                        alert("유효한 수량을 입력해주세요.");
                                                        return;
                                                    }

                                                    try {
                                                        const receipt = await contractService.adminSendVCN(
                                                            user.walletAddress!,
                                                            amountStr
                                                        );
                                                        setSuccessModal({
                                                            isOpen: true,
                                                            txHash: receipt.hash || receipt.transactionHash || '',
                                                            recipient: user.email,
                                                            amount: amount
                                                        });
                                                    } catch (e: any) {
                                                        console.error(e);
                                                        alert(`전송 실패: ${e.message}`);
                                                    }
                                                }}
                                                class="px-2 py-1 bg-cyan-600/10 hover:bg-cyan-600 text-cyan-400 hover:text-white rounded-lg transition-all border border-cyan-500/20 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
                                            >
                                                <Send class="w-2.5 h-2.5" />
                                                Send VCN
                                            </button>
                                        </Show>

                                        <Show when={!isRegistered}>
                                            <button
                                                onClick={() => handleResendEmail(user.email)}
                                                disabled={resendingEmail() === user.email}
                                                class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                                                title="Resend Invitation"
                                            >
                                                <Show when={resendingEmail() === user.email} fallback={<Mail class="w-4 h-4" />}>
                                                    <RefreshCw class="w-4 h-4 animate-spin" />
                                                </Show>
                                            </button>
                                        </Show>
                                        <button class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-600 hover:text-white">
                                            <MoreVertical class="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </div>

            {/* Manual Invite Modal */}
            <Show when={isInviteModalOpen()}>
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div class="w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-3xl p-8">
                        <div class="flex items-center justify-between mb-8">
                            <h2 class="text-2xl font-black italic">INVITE USER</h2>
                            <button onClick={() => setIsInviteModalOpen(false)} class="text-gray-500 hover:text-white">
                                <X class="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleManualInvite} class="space-y-6">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={inviteEmail()}
                                    onInput={(e) => setInviteEmail(e.currentTarget.value)}
                                    class="w-full px-4 py-3 bg-black border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Partner Code</label>
                                <input
                                    type="text"
                                    placeholder="DIRECT"
                                    value={invitePartnerCode()}
                                    onInput={(e) => setInvitePartnerCode(e.currentTarget.value)}
                                    class="w-full px-4 py-3 bg-black border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tier</label>
                                    <select
                                        value={inviteTier()}
                                        onChange={(e) => setInviteTier(Number(e.currentTarget.value))}
                                        class="w-full px-4 py-3 bg-black border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500"
                                    >
                                        <option value={1}>Tier 1</option>
                                        <option value={2}>Tier 2</option>
                                        <option value={3}>Tier 3</option>
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">VCN Amount</label>
                                    <input
                                        type="number"
                                        value={inviteAmount()}
                                        onInput={(e) => setInviteAmount(Number(e.currentTarget.value))}
                                        class="w-full px-4 py-3 bg-black border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isInviting()}
                                class="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                            >
                                <Show when={isInviting()}>
                                    <RefreshCw class="w-4 h-4 animate-spin mx-auto" />
                                </Show>
                                <Show when={!isInviting()}>Send Invitation</Show>
                            </button>
                        </form>
                    </div>
                </div>
            </Show>
            {/* Success Modal */}
            <Show when={successModal().isOpen}>
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div class="w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
                        <div class="bg-gradient-to-b from-green-500/10 to-transparent p-10 flex flex-col items-center text-center">
                            <div class="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                <CheckCircle class="w-10 h-10 text-green-500" />
                            </div>
                            <h2 class="text-3xl font-black italic mb-2 text-white">TRANSFER SUCCESS</h2>
                            <p class="text-gray-400 font-medium">Internal VCN Distribution Complete</p>
                        </div>

                        <div class="px-8 pb-10 space-y-6">
                            <div class="space-y-4">
                                <div class="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Recipient</div>
                                    <div class="text-sm font-bold text-white uppercase">{successModal().recipient}</div>
                                </div>
                                <div class="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Amount Sent</div>
                                    <div class="text-xl font-black text-cyan-400">{successModal().amount.toLocaleString()} VCN</div>
                                </div>
                                <div class="p-4 bg-white/[0.03] border border-white/5 rounded-2xl relative group">
                                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Transaction ID (TxHash)</div>
                                    <div class="flex items-center gap-2">
                                        <code class="text-[11px] font-mono text-gray-400 break-all flex-1">{successModal().txHash}</code>
                                        <button
                                            onClick={() => copyToClipboard(successModal().txHash)}
                                            class="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors shrink-0"
                                        >
                                            <Copy class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="flex flex-col gap-3 pt-2">
                                <a
                                    href={`/visionscan?tx=${successModal().txHash}`}
                                    target="_blank"
                                    class="w-full py-4 bg-white text-black font-black rounded-2xl text-center text-xs uppercase tracking-[0.2em] hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <ExternalLink class="w-4 h-4" />
                                    View on VisionScan
                                </a>
                                <button
                                    onClick={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
                                    class="w-full py-3 bg-white/5 text-gray-500 font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default AdminUsers;
