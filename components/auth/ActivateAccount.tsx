import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import {
    Lock,
    Mail,
    Eye,
    EyeOff,
    CheckCircle,
    Key,
    User,
    AlertCircle,
    ArrowLeft
} from 'lucide-solid';
import { useAuth } from './authContext';
import { validateActivationToken, activateAccountWithToken } from '../../services/firebaseService';

export default function ActivateAccount() {
    const [searchParams] = useSearchParams();
    const token = searchParams.token;

    const [email, setEmail] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [partnerCode, setPartnerCode] = createSignal('');

    const [showPassword, setShowPassword] = createSignal(false);
    const [error, setError] = createSignal('');
    const [success, setSuccess] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(false);
    const [isVerifying, setIsVerifying] = createSignal(true);
    const [isValidToken, setIsValidToken] = createSignal(false);

    const auth = useAuth();
    const navigate = useNavigate();

    onMount(async () => {
        if (!token) {
            setError('Activation token missing. Please check the link in your email.');
            setIsVerifying(false);
            return;
        }

        try {
            const validation = await validateActivationToken(token as string);
            if (validation.valid) {
                setEmail(validation.email || '');
                setPartnerCode(validation.partnerCode || '');
                setIsValidToken(true);
            } else {
                setError(validation.error || 'Invalid token.');
            }
        } catch (err) {
            console.error('Token validation error:', err);
            setError('An error occurred while verifying the token.');
        } finally {
            setIsVerifying(false);
        }
    });

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setError('');

        if (password() !== confirmPassword()) {
            setError('Passwords do not match.');
            return;
        }

        if (password().length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setIsLoading(true);

        try {
            await activateAccountWithToken(token as string, password());

            setSuccess(true);
            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 2000);

        } catch (err: any) {
            console.error('Activation error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Email already in use. Please log in.');
            } else {
                setError('Account activation failed: ' + (err.message || 'Unknown error'));
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
                <div class="rounded-3xl bg-white/[0.02] border border-white/10 p-8 backdrop-blur-xl shadow-2xl">

                    <div class="text-center mb-8">
                        <h1 class="text-2xl font-bold text-white mb-2">Account Activation</h1>
                        <p class="text-gray-400 text-sm">Please set your password to start using Vision Chain.</p>
                    </div>

                    <Show when={isVerifying()}>
                        <div class="flex flex-col items-center justify-center py-10">
                            <div class="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
                            <p class="text-gray-400 text-sm">Verifying token information...</p>
                        </div>
                    </Show>

                    <Show when={!isVerifying()}>
                        <Show when={success()}>
                            <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
                                <CheckCircle class="w-12 h-12 text-green-500 mx-auto mb-4" />
                                <p class="text-green-400 font-bold text-lg">Activation Success!</p>
                                <p class="text-green-400/70 text-sm mt-1">Redirecting to login page...</p>
                            </div>
                        </Show>

                        <Show when={!success()}>
                            <Show when={!isValidToken()}>
                                <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
                                    <AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-4" />
                                    <p class="text-red-400 font-bold">{error()}</p>
                                    <a href="/login" class="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm mt-6 transition-colors">
                                        <ArrowLeft class="w-4 h-4" />
                                        Back to Login Page
                                    </a>
                                </div>
                            </Show>

                            <Show when={isValidToken()}>
                                <form onSubmit={handleSubmit} class="space-y-4">
                                    {/* Email (Readonly) */}
                                    <div>
                                        <label class="text-gray-400 text-xs mb-1 block font-medium ml-1 text-cyan-400/70">Registered Email</label>
                                        <div class="relative">
                                            <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/50" />
                                            <input
                                                type="email"
                                                value={email()}
                                                disabled
                                                class="w-full bg-cyan-500/5 border border-cyan-500/20 rounded-xl py-3 pl-10 pr-4 text-cyan-200/50 text-sm cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    {/* Partner Code (Readonly) */}
                                    <div>
                                        <label class="text-gray-400 text-xs mb-1 block font-medium ml-1 text-cyan-400/70">Partner Code</label>
                                        <div class="relative">
                                            <User class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/50" />
                                            <input
                                                type="text"
                                                value={partnerCode()}
                                                disabled
                                                class="w-full bg-cyan-500/5 border border-cyan-500/20 rounded-xl py-3 pl-10 pr-4 text-cyan-200/50 text-sm cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label class="text-gray-400 text-xs mb-1 block font-medium ml-1">New Password</label>
                                        <div class="relative">
                                            <Key class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <input
                                                type={showPassword() ? "text" : "password"}
                                                value={password()}
                                                onInput={(e) => setPassword(e.currentTarget.value)}
                                                class="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-all text-sm"
                                                placeholder="Enter at least 6 characters"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword())}
                                                class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                            >
                                                {showPassword() ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm Password */}
                                    <div>
                                        <label class="text-gray-400 text-xs mb-1 block font-medium ml-1">Confirm Password</label>
                                        <div class="relative">
                                            <Key class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <input
                                                type={showPassword() ? "text" : "password"}
                                                value={confirmPassword()}
                                                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                                                class="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-all text-sm"
                                                placeholder="Re-enter password"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <Show when={error()}>
                                        <div class="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg text-xs">
                                            <AlertCircle class="w-4 h-4 shrink-0" />
                                            <span>{error()}</span>
                                        </div>
                                    </Show>

                                    <button
                                        type="submit"
                                        disabled={isLoading()}
                                        class="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                    >
                                        {isLoading() ? 'Processing...' : 'Complete Activation'}
                                    </button>
                                </form>
                            </Show>
                        </Show>
                    </Show>
                </div>
            </div>
        </div>
    );
}
