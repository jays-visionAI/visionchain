import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
    Lock,
    Mail,
    Eye,
    EyeOff,
    AlertCircle,
    UserPlus,
    ArrowLeft
} from 'lucide-solid';
import { useAuth } from './authContext';

export default function Signup() {
    const [email, setEmail] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [showPassword, setShowPassword] = createSignal(false);
    const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);
    const [error, setError] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);

    const [isSuccess, setIsSuccess] = createSignal(false);

    const auth = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setError('');

        // Validation
        const emailVal = email().toLowerCase().trim();
        const pwdVal = password();
        const confirmPwdVal = confirmPassword();

        if (pwdVal !== confirmPwdVal) {
            setError('Passwords do not match.');
            return;
        }

        if (pwdVal.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setIsLoading(true);

        try {
            await auth.register(emailVal, pwdVal);
            setIsSuccess(true);
            // Optional: Auto redirect after few seconds
            setTimeout(() => {
                navigate('/wallet', { replace: true });
            }, 5000);
        } catch (err: any) {
            console.error('Signup error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Email already in use.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email format.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak.');
            } else if (err.code === 'auth/api-key-not-valid' || err.code === 'auth/invalid-api-key') {
                setError('Configuration Error: Invalid Firebase API Key. Please check your .env file and restart the server.');
            } else {
                setError(err.message || 'Signup failed.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess()) {
        return (
            <div class="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" />
                <div class="w-full max-w-md relative z-10">
                    <div class="rounded-3xl bg-white/[0.02] border border-white/10 p-8 backdrop-blur-xl shadow-2xl text-center">
                        <div class="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
                            <Mail class="w-10 h-10 text-green-400" />
                        </div>
                        <h2 class="text-2xl font-bold text-white mb-4">Check Your Inbox</h2>
                        <p class="text-gray-400 mb-8">
                            We've sent a verification link to <span class="text-white font-medium">{email()}</span>.<br />
                            Please verify your email to secure your account.
                        </p>
                        <button
                            onClick={() => navigate('/wallet', { replace: true })}
                            class="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all"
                        >
                            Continue to Wallet
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div class="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div class="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" />
            <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
            <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

            <div class="w-full max-w-md relative z-10">
                <div class="rounded-3xl bg-white/[0.02] border border-white/10 p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div class="text-center mb-8">
                        <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6 border border-purple-500/20">
                            <UserPlus class="w-10 h-10 text-purple-400" />
                        </div>
                        <h1 class="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                            Join Vision Chain
                        </h1>
                        <p class="text-[10px] text-gray-500 mt-2 font-black uppercase tracking-[0.2em]">Create New Account</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} class="space-y-5">
                        {/* Email Input */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block font-medium">Email</label>
                            <div class="relative">
                                <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="email"
                                    value={email()}
                                    onInput={(e) => setEmail(e.currentTarget.value)}
                                    placeholder="your@email.com"
                                    class="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-all box-border"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block font-medium">Password</label>
                            <div class="relative">
                                <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type={showPassword() ? 'text' : 'password'}
                                    value={password()}
                                    onInput={(e) => setPassword(e.currentTarget.value)}
                                    placeholder="Enter your password"
                                    class="w-full p-4 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-all box-border"
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

                        {/* Confirm Password Input */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block font-medium">Confirm Password</label>
                            <div class="relative">
                                <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type={showConfirmPassword() ? 'text' : 'password'}
                                    value={confirmPassword()}
                                    onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                                    placeholder="Re-enter your password"
                                    class="w-full p-4 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-all box-border"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword())}
                                    class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                >
                                    <Show when={showConfirmPassword()} fallback={<Eye class="w-5 h-5" />}>
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
                            class="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Show when={isLoading()} fallback="Sign Up">
                                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </Show>
                        </button>
                    </form>

                    {/* Back Link */}
                    <div class="mt-8 pt-6 border-t border-white/5 text-center">
                        <p class="text-gray-400 text-sm mb-2">Already have an account?</p>
                        <a
                            href="/login"
                            class="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm transition-colors"
                        >
                            Log in
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
