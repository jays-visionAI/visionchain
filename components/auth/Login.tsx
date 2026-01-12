import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
    Lock,
    Mail,
    Eye,
    EyeOff,
    AlertCircle,
    ArrowLeft
} from 'lucide-solid';
import { useAuth } from './authContext';
import { getUserRole } from '../../services/firebaseService';

export default function Login() {
    const [email, setEmail] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [showPassword, setShowPassword] = createSignal(false);
    const [error, setError] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);

    const auth = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const emailVal = email().toLowerCase().trim();
        const pwdVal = password();

        try {
            // 1. Try normal login
            await auth.login(emailVal, pwdVal);

            // 2. Check User Role from Firestore
            try {
                const role = await getUserRole(emailVal);

                if (role === 'admin' || role === 'partner') {
                    // Admin and Partner both access the Admin System 
                    // (Partners will see restricted view later)
                    navigate('/adminsystem', { replace: true });
                } else {
                    navigate('/wallet', { replace: true });
                }
            } catch (roleErr) {
                console.error("Role check failed:", roleErr);
                // Fallback to Wallet
                navigate('/wallet', { replace: true });
            }

        } catch (err: any) {
            console.error('Login error:', err);

            // Error mapping
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                setError('존재하지 않는 계정이거나 정보가 일치하지 않습니다.');
            } else if (err.code === 'auth/wrong-password') {
                setError('비밀번호가 올바르지 않습니다.');
            } else if (err.code === 'auth/invalid-email') {
                setError('유효하지 않은 이메일 형식입니다.');
            } else {
                setError('로그인에 실패했습니다. 다시 시도해주세요.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div class="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5" />
            <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
            <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

            <div class="w-full max-w-md relative z-10">
                <div class="rounded-3xl bg-white/[0.02] border border-white/10 p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div class="text-center mb-8">
                        <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6 border border-cyan-500/20">
                            <Lock class="w-10 h-10 text-cyan-400" />
                        </div>
                        <h1 class="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                            Vision Chain
                        </h1>
                        <p class="text-[10px] text-gray-500 mt-2 font-black uppercase tracking-[0.2em]">Token Platform Access</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} class="space-y-5">
                        {/* Email Input */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block font-medium">이메일</label>
                            <div class="relative">
                                <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="email"
                                    value={email()}
                                    onInput={(e) => setEmail(e.currentTarget.value)}
                                    placeholder="your@email.com"
                                    class="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-all box-border"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block font-medium">비밀번호</label>
                            <div class="relative">
                                <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type={showPassword() ? 'text' : 'password'}
                                    value={password()}
                                    onInput={(e) => setPassword(e.currentTarget.value)}
                                    placeholder="비밀번호 입력"
                                    class="w-full p-4 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-all box-border"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword())}
                                    class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                >
                                    <Show when={showPassword()} fallback={<Eye class="w-5 h-5" />}>
                                        <EyeOff class="w-5 h-5" />
                                    </Show>
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        <Show when={error()}>
                            <div class="flex items-center gap-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                <AlertCircle class="w-5 h-5 flex-shrink-0" />
                                <span>{error()}</span>
                            </div>
                        </Show>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading()}
                            class="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Show when={isLoading()} fallback="로그인">
                                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                로그인 중...
                            </Show>
                        </button>

                        <div class="text-center mt-4">
                            <button
                                type="button"
                                onClick={async () => {
                                    setIsLoading(true);
                                    try {
                                        await auth.register(email(), password());
                                        navigate('/admin', { replace: true });
                                    } catch (err: any) {
                                        setError(err.message);
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                class="text-xs text-gray-500 hover:text-white underline"
                            >
                                (Dev) Create Account
                            </button>
                        </div>
                    </form>

                    {/* Back Link */}
                    <div class="mt-8 pt-6 border-t border-white/5 text-center">
                        <a
                            href="/"
                            class="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 text-sm transition-colors"
                        >
                            <ArrowLeft class="w-4 h-4" />
                            홈으로 돌아가기
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
