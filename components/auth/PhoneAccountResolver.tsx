import { createSignal, Show, For, createEffect } from 'solid-js';
import { Shield, ChevronRight, AlertTriangle, CheckCircle, Archive, Star } from 'lucide-solid';
import { getDuplicatePhoneAccounts, resolvePhoneAccounts } from '../../services/firebaseService';

interface DuplicateAccount {
    email: string;
    name: string;
    address: string;
    phone: string;
    isPhonePrimary?: boolean;
    accountStatus?: string;
    createdAt?: string;
}

interface PhoneAccountResolverProps {
    userEmail: string;
    onResolved: () => void;
}

export default function PhoneAccountResolver(props: PhoneAccountResolverProps) {
    const [accounts, setAccounts] = createSignal<DuplicateAccount[]>([]);
    const [selectedPrimary, setSelectedPrimary] = createSignal('');
    const [accountDecisions, setAccountDecisions] = createSignal<Record<string, 'secondary' | 'archive'>>({});
    const [step, setStep] = createSignal<'loading' | 'select' | 'confirm' | 'processing' | 'done'>('loading');
    const [error, setError] = createSignal('');

    createEffect(async () => {
        if (!props.userEmail) return;
        try {
            const dupes = await getDuplicatePhoneAccounts(props.userEmail);
            if (dupes.length === 0) {
                // No duplicates, just unblock and continue
                props.onResolved();
                return;
            }
            setAccounts(dupes);
            // Pre-select current login account as primary
            setSelectedPrimary(props.userEmail.toLowerCase());
            // Default others to 'secondary'
            const decisions: Record<string, 'secondary' | 'archive'> = {};
            for (const a of dupes) {
                if (a.email.toLowerCase() !== props.userEmail.toLowerCase()) {
                    decisions[a.email.toLowerCase()] = 'secondary';
                }
            }
            setAccountDecisions(decisions);
            setStep('select');
        } catch (e) {
            console.error('[PhoneAccountResolver] Load error:', e);
            setError('계정 정보를 불러오는데 실패했습니다.');
        }
    });

    const formatPhone = (phone: string): string => {
        const digits = phone.replace(/\D/g, '');
        if (digits.startsWith('82') && digits.length >= 11) {
            const local = '0' + digits.slice(2);
            return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
        }
        return phone;
    };

    const shortenAddress = (addr: string): string => {
        if (!addr || addr.length < 10) return addr || 'N/A';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const toggleDecision = (email: string) => {
        const current = accountDecisions()[email.toLowerCase()];
        setAccountDecisions(prev => ({
            ...prev,
            [email.toLowerCase()]: current === 'secondary' ? 'archive' : 'secondary'
        }));
    };

    const handleConfirm = async () => {
        setStep('processing');
        setError('');

        try {
            const primary = selectedPrimary();
            const decisions = accountDecisions();
            const secondaryEmails = Object.entries(decisions)
                .filter(([_, d]) => d === 'secondary')
                .map(([e]) => e);
            const archiveEmails = Object.entries(decisions)
                .filter(([_, d]) => d === 'archive')
                .map(([e]) => e);

            // Generate group ID from phone
            const phone = accounts()[0]?.phone?.replace(/\D/g, '') || 'unknown';
            const phoneOwnerGroup = `group_${phone}`;

            const success = await resolvePhoneAccounts(primary, secondaryEmails, archiveEmails, phoneOwnerGroup);

            if (success) {
                setStep('done');
                setTimeout(() => props.onResolved(), 2000);
            } else {
                setError('처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
                setStep('confirm');
            }
        } catch (e: any) {
            setError(e.message || '처리 중 오류가 발생했습니다.');
            setStep('confirm');
        }
    };

    return (
        <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div class="w-full max-w-lg rounded-3xl bg-[#0f0f12] border border-white/10 overflow-hidden shadow-2xl">
                {/* Header */}
                <div class="p-6 pb-4 border-b border-white/5 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Shield class="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h2 class="text-lg font-bold text-white">Account Verification Required</h2>
                            <p class="text-xs text-gray-400">계정 확인이 필요합니다</p>
                        </div>
                    </div>
                    <p class="text-sm text-gray-300 leading-relaxed">
                        동일한 전화번호로 등록된 복수의 계정이 발견되었습니다.
                        <span class="text-amber-400 font-medium"> 주 계정을 지정</span>해 주세요.
                        주 계정은 전화번호 검색 시 매칭되는 대표 계정입니다.
                    </p>
                </div>

                {/* Content */}
                <div class="p-6 max-h-[60vh] overflow-y-auto">
                    <Show when={step() === 'loading'}>
                        <div class="flex items-center justify-center py-12">
                            <div class="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                            <span class="ml-3 text-gray-400">계정 정보를 불러오는 중...</span>
                        </div>
                    </Show>

                    <Show when={step() === 'select' || step() === 'confirm'}>
                        {/* Phone info */}
                        <div class="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                            <svg class="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                            </svg>
                            <span class="text-sm text-gray-400">{formatPhone(accounts()[0]?.phone || '')}</span>
                            <span class="ml-auto text-xs text-gray-500">{accounts().length}개 계정</span>
                        </div>

                        {/* Account list */}
                        <div class="space-y-3">
                            <For each={accounts()}>
                                {(acct) => {
                                    const isCurrent = () => acct.email.toLowerCase() === props.userEmail.toLowerCase();
                                    const isPrimary = () => acct.email.toLowerCase() === selectedPrimary().toLowerCase();
                                    const decision = () => isPrimary() ? 'primary' : (accountDecisions()[acct.email.toLowerCase()] || 'secondary');

                                    return (
                                        <div
                                            class={`relative rounded-2xl border transition-all cursor-pointer ${isPrimary()
                                                ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20'
                                                : decision() === 'archive'
                                                    ? 'bg-red-500/5 border-red-500/20 opacity-60'
                                                    : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                                                }`}
                                            onClick={() => {
                                                if (step() === 'select') {
                                                    setSelectedPrimary(acct.email.toLowerCase());
                                                    // Reset all others to secondary
                                                    const decisions: Record<string, 'secondary' | 'archive'> = {};
                                                    for (const a of accounts()) {
                                                        if (a.email.toLowerCase() !== acct.email.toLowerCase()) {
                                                            decisions[a.email.toLowerCase()] = accountDecisions()[a.email.toLowerCase()] || 'secondary';
                                                        }
                                                    }
                                                    setAccountDecisions(decisions);
                                                }
                                            }}
                                        >
                                            <div class="p-4">
                                                <div class="flex items-start justify-between">
                                                    <div class="flex-1 min-w-0">
                                                        <div class="flex items-center gap-2 mb-1">
                                                            <Show when={isPrimary()}>
                                                                <Star class="w-4 h-4 text-amber-400 fill-amber-400" />
                                                            </Show>
                                                            <span class={`text-sm font-semibold truncate ${isPrimary() ? 'text-amber-300' : 'text-white'}`}>
                                                                {acct.email}
                                                            </span>
                                                            <Show when={isCurrent()}>
                                                                <span class="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 rounded-full">
                                                                    CURRENT
                                                                </span>
                                                            </Show>
                                                        </div>
                                                        <div class="flex items-center gap-3 text-xs text-gray-500">
                                                            <span class="font-mono">{shortenAddress(acct.address)}</span>
                                                            <Show when={acct.createdAt}>
                                                                <span>{new Date(acct.createdAt!).toLocaleDateString('ko-KR')}</span>
                                                            </Show>
                                                        </div>
                                                    </div>

                                                    {/* Status badges */}
                                                    <div class="flex items-center gap-2 ml-3">
                                                        <Show when={isPrimary()}>
                                                            <span class="px-3 py-1 text-[11px] font-bold bg-amber-500/20 text-amber-400 rounded-full">
                                                                PRIMARY
                                                            </span>
                                                        </Show>
                                                        <Show when={!isPrimary()}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleDecision(acct.email);
                                                                }}
                                                                class={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${decision() === 'archive'
                                                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                                                    : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
                                                                    }`}
                                                            >
                                                                {decision() === 'archive' ? 'ARCHIVE' : 'KEEP'}
                                                            </button>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>

                        {/* Legend */}
                        <div class="mt-4 space-y-2 px-2">
                            <div class="flex items-start gap-2">
                                <Star class="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                <p class="text-xs text-gray-400">
                                    <span class="text-amber-400 font-medium">PRIMARY</span> -- 전화번호 검색 시 이 계정의 지갑으로 송금됩니다
                                </p>
                            </div>
                            <div class="flex items-start gap-2">
                                <CheckCircle class="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                                <p class="text-xs text-gray-400">
                                    <span class="text-cyan-400 font-medium">KEEP</span> -- 보조 계정으로 유지합니다 (이메일/주소로만 송금 가능)
                                </p>
                            </div>
                            <div class="flex items-start gap-2">
                                <Archive class="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                                <p class="text-xs text-gray-400">
                                    <span class="text-red-400 font-medium">ARCHIVE</span> -- 이 계정을 비활성화합니다 (로그인 차단)
                                </p>
                            </div>
                        </div>

                        {/* Error */}
                        <Show when={error()}>
                            <div class="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                <AlertTriangle class="w-4 h-4 text-red-400 flex-shrink-0" />
                                <span class="text-xs text-red-400">{error()}</span>
                            </div>
                        </Show>
                    </Show>

                    <Show when={step() === 'processing'}>
                        <div class="flex flex-col items-center justify-center py-12">
                            <div class="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
                            <p class="text-gray-400 text-sm">계정을 설정하는 중...</p>
                        </div>
                    </Show>

                    <Show when={step() === 'done'}>
                        <div class="flex flex-col items-center justify-center py-12">
                            <div class="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                                <CheckCircle class="w-8 h-8 text-green-400" />
                            </div>
                            <h3 class="text-lg font-bold text-white mb-2">설정 완료</h3>
                            <p class="text-sm text-gray-400 text-center">
                                주 계정이 설정되었습니다.<br />
                                잠시 후 자동으로 이동합니다.
                            </p>
                        </div>
                    </Show>
                </div>

                {/* Footer */}
                <Show when={step() === 'select' || step() === 'confirm'}>
                    <div class="p-6 pt-4 border-t border-white/5">
                        <Show when={step() === 'select'}>
                            <button
                                onClick={() => setStep('confirm')}
                                disabled={!selectedPrimary()}
                                class="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:shadow-lg hover:shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                선택 확인
                                <ChevronRight class="w-4 h-4" />
                            </button>
                        </Show>
                        <Show when={step() === 'confirm'}>
                            <div class="mb-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                <p class="text-xs text-amber-300 font-medium mb-1">확인해 주세요:</p>
                                <p class="text-xs text-gray-400">
                                    <span class="text-white">{selectedPrimary()}</span>을(를) 주 계정으로 설정합니다.
                                    {Object.values(accountDecisions()).filter(d => d === 'archive').length > 0 &&
                                        ` ${Object.values(accountDecisions()).filter(d => d === 'archive').length}개 계정이 비활성화됩니다.`}
                                </p>
                            </div>
                            <div class="flex gap-3">
                                <button
                                    onClick={() => setStep('select')}
                                    class="flex-1 py-3.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-sm hover:bg-white/10 transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    class="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:shadow-lg hover:shadow-amber-500/20 transition-all"
                                >
                                    Confirm
                                </button>
                            </div>
                        </Show>
                    </div>
                </Show>
            </div>
        </div>
    );
}
