import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
    Shield,
    Lock,
    Mail,
    Eye,
    EyeOff,
    AlertCircle,
    ArrowLeft,
    Cpu,
    Zap,
    Terminal
} from 'lucide-solid';
import { useAuth } from './authContext';
import { getUserRole } from '../../services/firebaseService';

export default function AdminLogin() {
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
            // 1. Authenticate
            await auth.login(emailVal, pwdVal);

            // 2. Strict Role Check
            const role = await getUserRole(emailVal);
            if (role === 'admin' || role === 'partner') {
                navigate('/adminsystem', { replace: true });
            } else {
                // If a normal user tries to access admin login
                await auth.logout();
                setError('Access denied. Please log in with an admin account.');
            }
        } catch (err: any) {
            console.error('Admin Login error:', err);
            setError('Login failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div class="min-h-screen bg-[#08080c] flex items-center justify-center p-4 relative overflow-hidden">
            {/* High-Tech Background Elements */}
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(6,182,212,0.05)_0%,_transparent_70%)]" />
            <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
            <div class="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

            {/* Grid Pattern Overlay */}
            <div class="absolute inset-0 opacity-[0.02]" style={{ "background-image": "radial-gradient(#fff 1px, transparent 1px)", "background-size": "30px 30px" }} />

            <div class="w-full max-w-[440px] relative">
                {/* Decorative Frame */}
                <div class="absolute -inset-1 bg-gradient-to-br from-cyan-500/20 via-white/5 to-blue-600/20 rounded-[32px] blur-xl opacity-50" />

                <div class="relative bg-[#0c0c14]/80 backdrop-blur-3xl border border-white/10 rounded-[32px] p-10 shadow-2xl overflow-hidden">
                    {/* Top Accent Bar */}
                    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-cyan-500 rounded-b-full shadow-[0_0_15px_rgba(6,182,212,0.8)]" />

                    {/* Header */}
                    <div class="text-center mb-10">
                        <div class="relative inline-block mb-6">
                            <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-float">
                                <Shield class="w-10 h-10 text-white" />
                            </div>
                            <div class="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center">
                                <Cpu class="w-4 h-4 text-cyan-400" />
                            </div>
                        </div>

                        <h1 class="text-4xl font-black italic tracking-tighter uppercase text-white mb-2">
                            Vision<span class="text-cyan-400">HQ</span>
                        </h1>
                        <div class="flex items-center justify-center gap-2 mb-1">
                            <div class="h-[1px] w-6 bg-cyan-500/30" />
                            <span class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">Command Center Access</span>
                            <div class="h-[1px] w-6 bg-cyan-500/30" />
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} class="space-y-6">
                        <div class="space-y-4">
                            {/* Admin ID (Email) */}
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Admin Identity</label>
                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Terminal class="w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email()}
                                        onInput={(e) => setEmail(e.currentTarget.value)}
                                        placeholder="ADMIN@VISION.HQ"
                                        class="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder:text-gray-700 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Security Key (Password) */}
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Security Key</label>
                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Lock class="w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword() ? 'text' : 'password'}
                                        value={password()}
                                        onInput={(e) => setPassword(e.currentTarget.value)}
                                        placeholder="••••••••"
                                        class="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-sm font-bold text-white placeholder:text-gray-700 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword())}
                                        class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                    >
                                        <Show when={showPassword()} fallback={<Eye class="w-4 h-4" />}>
                                            <EyeOff class="w-4 h-4" />
                                        </Show>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        <Show when={error()}>
                            <div class="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 animate-shake">
                                <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0" />
                                <span class="text-[11px] font-bold text-red-400 uppercase leading-tight">{error()}</span>
                            </div>
                        </Show>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading()}
                            class="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-[12px] uppercase tracking-[0.2em] shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                        >
                            <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <div class="relative flex items-center justify-center gap-3">
                                <Show when={isLoading()} fallback={
                                    <>
                                        <span>Initialize Session</span>
                                        <Zap class="w-4 h-4" />
                                    </>
                                }>
                                    <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Verifying...</span>
                                </Show>
                            </div>
                        </button>
                    </form>

                    {/* Footer Nav */}
                    <div class="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
                        <a
                            href="/"
                            class="flex items-center gap-2 text-[10px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest"
                        >
                            <ArrowLeft class="w-3 h-3" />
                            Exit to Home
                        </a>
                        <span class="text-[9px] font-black text-gray-700 uppercase tracking-widest">Vision Node v1.4.2</span>
                    </div>
                </div>

                {/* Status Bar */}
                <div class="mt-6 flex items-center justify-between px-6">
                    <div class="flex items-center gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Network Protocol: Secured</span>
                    </div>
                    <span class="text-[9px] font-black text-gray-600 uppercase tracking-widest">ENC: 256-BIT AES</span>
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out 2;
                }
            `}</style>
        </div>
    );
}
