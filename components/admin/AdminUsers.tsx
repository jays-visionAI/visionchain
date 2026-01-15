import { createSignal, For, Show, createResource } from 'solid-js';
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
    Send
} from 'lucide-solid';
import { getAllUsers, resendActivationEmail, manualInviteUser } from '../../services/firebaseService';

const statusStyles = {
    active: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
    inactive: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
    WalletCreated: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Shield },
    Registered: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', icon: CheckCircle },
    VestingDeployed: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: Star },
};

const roleStyles = {
    admin: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: ShieldCheck },
    partner: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Shield },
    user: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: Shield },
};

export default function AdminUsers() {
    const [searchQuery, setSearchQuery] = createSignal('');
    const [statusFilter, setStatusFilter] = createSignal('all');
    const [resendingEmail, setResendingEmail] = createSignal<string | null>(null);

    // Manual Invite Modal State
    const [showInviteModal, setShowInviteModal] = createSignal(false);
    const [inviteForm, setInviteForm] = createSignal({
        email: '',
        partnerCode: 'ANTIG',
        amount: 0,
        tier: 0
    });
    const [isInviting, setIsInviting] = createSignal(false);

    // Fetch users
    const [users, { refetch }] = createResource(() => getAllUsers());

    const filteredUsers = () => {
        if (!users()) return [];
        return users()!.filter(user => {
            const matchesSearch =
                (user.name?.toLowerCase() || '').includes(searchQuery().toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery().toLowerCase());
            const matchesStatus = statusFilter() === 'all' || user.status === statusFilter();
            return matchesSearch && matchesStatus;
        });
    };

    const handleResendEmail = async (email: string) => {
        if (resendingEmail()) return;
        setResendingEmail(email);
        try {
            await resendActivationEmail(email, window.location.origin);
            alert(`${email}님께 초대 메일을 다시 보냈습니다.`);
        } catch (err) {
            console.error('Failed to resend email:', err);
            alert('이메일 재전송에 실패했습니다.');
        } finally {
            setResendingEmail(null);
        }
    };

    const handleManualInvite = async (e: Event) => {
        e.preventDefault();
        setIsInviting(true);
        try {
            await manualInviteUser({
                email: inviteForm().email,
                partnerCode: inviteForm().partnerCode,
                amountToken: inviteForm().amount,
                tier: inviteForm().tier
            });
            alert('초대 메일이 전송되었습니다.');
            setShowInviteModal(false);
            setInviteForm({ email: '', partnerCode: 'ANTIG', amount: 0, tier: 0 });
            refetch();
        } catch (err) {
            console.error('Invite error:', err);
            alert('초대 중 오류가 발생했습니다.');
        } finally {
            setIsInviting(false);
        }
    };

    return (
        <div class="space-y-8">
            {/* Header */}
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-bold text-white">Users</h1>
                    <p class="text-gray-400 mt-1">사용자 계정 및 권한을 관리합니다.</p>
                </div>
                <div class="flex items-center gap-3">
                    <button
                        onClick={() => setShowInviteModal(true)}
                        class="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2"
                    >
                        <UserPlus class="w-4 h-4" />
                        Invite User
                    </button>
                    <button
                        onClick={() => refetch()}
                        class="px-5 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-all flex items-center gap-2"
                    >
                        <RefreshCw class="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Invite Modal */}
            <Show when={showInviteModal()}>
                <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />
                    <div class="relative w-full max-w-md bg-[#0F1218] border border-white/10 rounded-3xl p-8 shadow-2xl">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-white">Invite New User</h2>
                            <button onClick={() => setShowInviteModal(false)} class="text-gray-500 hover:text-white transition-colors">
                                <X class="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleManualInvite} class="space-y-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={inviteForm().email}
                                    onInput={(e) => setInviteForm({ ...inviteForm(), email: e.currentTarget.value })}
                                    class="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                                    placeholder="user@example.com"
                                />
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Partner Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={inviteForm().partnerCode}
                                        onInput={(e) => setInviteForm({ ...inviteForm(), partnerCode: e.currentTarget.value })}
                                        class="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tier</label>
                                    <select
                                        value={inviteForm().tier}
                                        onChange={(e) => setInviteForm({ ...inviteForm(), tier: parseInt(e.currentTarget.value) })}
                                        class="w-full bg-[#1A1D24] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
                                    >
                                        <option value="0">Tier 0</option>
                                        <option value="1">Tier 1</option>
                                        <option value="2">Tier 2</option>
                                        <option value="3">Tier 3</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Amount (VCN)</label>
                                <input
                                    type="number"
                                    required
                                    value={inviteForm().amount}
                                    onInput={(e) => setInviteForm({ ...inviteForm(), amount: parseFloat(e.currentTarget.value) || 0 })}
                                    class="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isInviting()}
                                class="w-full mt-4 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Show when={isInviting()}>
                                    <RefreshCw class="w-5 h-5 animate-spin" />
                                </Show>
                                <Show when={!isInviting()}>
                                    <Send class="w-5 h-5" />
                                    Send Invitation Email
                                </Show>
                            </button>
                        </form>
                    </div>
                </div>
            </Show>

            {/* Filters */}
            <div class="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div class="relative flex-1">
                    <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="이름 또는 이메일로 검색..."
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        class="w-full pl-12 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                </div>

                {/* Status Filter */}
                <div class="relative">
                    <Filter class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                        value={statusFilter()}
                        onChange={(e) => setStatusFilter(e.currentTarget.value)}
                        class="appearance-none pl-12 pr-10 py-3 bg-[#0B0E14] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
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
                <div class="hidden md:grid grid-cols-12 gap-4 p-4 bg-white/[0.02] border-b border-white/5 text-sm text-gray-400 font-medium">
                    <div class="col-span-3">User</div>
                    <div class="col-span-2">Registration</div>
                    <div class="col-span-2">Wallet Status</div>
                    <div class="col-span-2">Vesting</div>
                    <div class="col-span-2">Join Date</div>
                    <div class="col-span-1">Action</div>
                </div>

                {/* Table Body */}
                <div class="divide-y divide-white/5">
                    <Show when={users.loading}>
                        <div class="p-8 text-center text-gray-500">
                            <div class="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
                            Loading users...
                        </div>
                    </Show>

                    <Show when={users.error}>
                        <div class="p-12 text-center border-t border-white/5 bg-red-500/5">
                            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                                <AlertCircle class="w-8 h-8 text-red-500" />
                            </div>
                            <h3 class="text-white font-bold mb-2">데이터를 불러올 수 없습니다.</h3>
                            <p class="text-gray-400 text-sm mb-4">
                                {users.error.message.includes('permission')
                                    ? '관리자 권한이 없거나 로그인 세션이 만료되었습니다.'
                                    : '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'}
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                class="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
                            >
                                다시 시도
                            </button>
                        </div>
                    </Show>

                    <For each={filteredUsers()}>
                        {(user) => {
                            const status = statusStyles[user.status as keyof typeof statusStyles] || statusStyles.pending;
                            const isRegistered = user.status === 'Registered' || user.status === 'WalletCreated' || user.status === 'VestingDeployed';
                            const hasWallet = (user.walletAddress && user.walletAddress.length > 10) || user.status === 'WalletCreated' || user.status === 'VestingDeployed';

                            return (
                                <div class="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-white/[0.02] transition-colors items-center">
                                    {/* User Info */}
                                    <div class="md:col-span-3 flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 font-black border border-cyan-500/20">
                                            {user.name ? user.name.charAt(0) : '?'}
                                        </div>
                                        <div class="min-w-0">
                                            <p class="text-white font-black text-sm truncate uppercase tracking-tight">{user.name || 'Unknown'}</p>
                                            <p class="text-gray-500 text-[10px] truncate font-bold uppercase tracking-widest flex items-center gap-1">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Registration Status */}
                                    <div class="md:col-span-2 flex items-center">
                                        <Show when={isRegistered} fallback={
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-[10px] font-black text-yellow-500 uppercase tracking-widest border border-yellow-500/20">
                                                <Clock class="w-3 h-3" />
                                                Pending
                                            </span>
                                        }>
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-[10px] font-black text-green-500 uppercase tracking-widest border border-green-500/20">
                                                <CheckCircle class="w-3 h-3" />
                                                Registered
                                            </span>
                                        </Show>
                                    </div>

                                    {/* Wallet Status */}
                                    <div class="md:col-span-2 flex items-center">
                                        <Show when={hasWallet} fallback={
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-500/10 text-[10px] font-black text-gray-500 uppercase tracking-widest border border-gray-500/20">
                                                <XCircle class="w-3 h-3" />
                                                No Wallet
                                            </span>
                                        }>
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-[10px] font-black text-blue-500 uppercase tracking-widest border border-blue-500/20">
                                                <Shield class="w-3 h-3" />
                                                Created
                                            </span>
                                        </Show>
                                    </div>

                                    {/* Vesting Status */}
                                    <div class="md:col-span-2 flex items-center">
                                        <Show when={user.status === 'VestingDeployed'} fallback={
                                            <span class="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Not Deployed</span>
                                        }>
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-[10px] font-black text-purple-400 uppercase tracking-widest border border-purple-500/20">
                                                <Star class="w-3 h-3" />
                                                Deployed
                                            </span>
                                        </Show>
                                    </div>

                                    {/* Join Date */}
                                    <div class="md:col-span-2 flex items-center text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                        {user.joinDate || '-'}
                                    </div>

                                    {/* Actions */}
                                    <div class="md:col-span-1 flex items-center justify-end gap-2">
                                        <Show when={!isRegistered}>
                                            <button
                                                onClick={() => handleResendEmail(user.email)}
                                                disabled={resendingEmail() === user.email}
                                                class="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors group relative"
                                                title="Resend Invitation"
                                            >
                                                <Show when={resendingEmail() === user.email} fallback={<Mail class="w-4 h-4" />}>
                                                    <RefreshCw class="w-4 h-4 animate-spin" />
                                                </Show>
                                            </button>
                                        </Show>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-500 hover:text-white">
                                            <MoreVertical class="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>

                {/* Empty State */}
                <Show when={!users.loading && filteredUsers().length === 0}>
                    <div class="p-12 text-center border-t border-white/5 bg-white/[0.01]">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                            <Search class="w-8 h-8 text-gray-600" />
                        </div>
                        <p class="text-gray-500 font-medium">검색 결과가 없습니다.</p>
                    </div>
                </Show>
            </div>
        </div>
    );
}
