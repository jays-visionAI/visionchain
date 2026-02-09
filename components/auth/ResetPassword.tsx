import { createSignal, Show, Switch, Match } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
    Lock,
    Mail,
    Eye,
    EyeOff,
    AlertCircle,
    ArrowLeft,
    CheckCircle,
    Shield,
    KeyRound,
} from 'lucide-solid';
import {
    requestPasswordReset,
    verifyPasswordResetCode,
    completePasswordReset,
} from '../../services/firebaseService';

type Step = 'email' | 'code' | 'totp' | 'password' | 'done';

export default function ResetPassword() {
    const navigate = useNavigate();

    // State
    const [step, setStep] = createSignal<Step>('email');
    const [email, setEmail] = createSignal('');
    const [code, setCode] = createSignal('');
    const [totpCode, setTotpCode] = createSignal('');
    const [useBackupCode, setUseBackupCode] = createSignal(false);
    const [newPassword, setNewPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [showPassword, setShowPassword] = createSignal(false);
    const [error, setError] = createSignal('');
    const [success, setSuccess] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
    const [totpRequired, setTotpRequired] = createSignal(false);

    // Step 1: Request reset code
    const handleRequestCode = async (e: Event) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await requestPasswordReset(email());
            setSuccess('Verification code sent to your email.');
            setStep('code');
        } catch (err: any) {
            setError(err.message || 'Failed to send reset code.');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verify code
    const handleVerifyCode = async (e: Event) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            const result = await verifyPasswordResetCode(email(), code());
            setTotpRequired(result.totpRequired);

            if (result.totpRequired) {
                setStep('totp');
                setSuccess('Code verified. Please enter your Google Authenticator code.');
            } else {
                setStep('password');
                setSuccess('Code verified. Please enter your new password.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to verify code.');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2.5: TOTP verification -> proceed to password
    const handleTotpVerify = (e: Event) => {
        e.preventDefault();
        setError('');

        if (!totpCode() || totpCode().length < 6) {
            setError('Please enter a valid 6-character code.');
            return;
        }

        setStep('password');
        setSuccess('Authenticator verified. Please enter your new password.');
    };

    // Step 3: Complete reset
    const handleCompleteReset = async (e: Event) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword().length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        if (newPassword() !== confirmPassword()) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);

        try {
            await completePasswordReset(
                email(),
                code(),
                newPassword(),
                totpRequired() ? totpCode() : undefined,
                totpRequired() ? useBackupCode() : undefined,
            );
            setStep('done');
            setSuccess('Password changed successfully!');
        } catch (err: any) {
            setError(err.message || 'Failed to reset password.');
        } finally {
            setIsLoading(false);
        }
    };

    // Step indicator
    const StepIndicator = () => {
        const steps: { key: Step; label: string }[] = [
            { key: 'email', label: 'Email' },
            { key: 'code', label: 'Verify' },
            ...(totpRequired() ? [{ key: 'totp' as Step, label: '2FA' }] : []),
            { key: 'password', label: 'Reset' },
        ];

        const currentIndex = () => {
            const s = step();
            if (s === 'done') return steps.length;
            return steps.findIndex((st) => st.key === s);
        };

        return (
            <div class="flex items-center justify-center gap-2 mb-8">
                {steps.map((s, i) => (
                    <div class="flex items-center gap-2">
                        <div
                            class={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < currentIndex()
                                    ? 'bg-cyan-500 text-white'
                                    : i === currentIndex()
                                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                                        : 'bg-white/5 text-gray-600 border border-white/10'
                                }`}
                        >
                            {i < currentIndex() ? (
                                <CheckCircle class="w-4 h-4" />
                            ) : (
                                i + 1
                            )}
                        </div>
                        <span
                            class={`text-xs hidden sm:block ${i <= currentIndex() ? 'text-gray-300' : 'text-gray-600'
                                }`}
                        >
                            {s.label}
                        </span>
                        {i < steps.length - 1 && (
                            <div
                                class={`w-8 h-px ${i < currentIndex() ? 'bg-cyan-500/50' : 'bg-white/10'
                                    }`}
                            />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div class="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div class="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-cyan-500/5" />
            <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
            <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

            <div class="w-full max-w-md relative z-10">
                <div class="rounded-3xl bg-white/[0.02] border border-white/10 p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div class="text-center mb-6">
                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                            <KeyRound class="w-8 h-8 text-amber-400" />
                        </div>
                        <h1 class="text-2xl font-bold text-white">Reset Password</h1>
                        <p class="text-xs text-gray-500 mt-1.5 uppercase tracking-widest font-semibold">Account Recovery</p>
                    </div>

                    {/* Step Indicator */}
                    <Show when={step() !== 'done'}>
                        <StepIndicator />
                    </Show>

                    {/* Error */}
                    <Show when={error()}>
                        <div class="flex items-center gap-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                            <AlertCircle class="w-5 h-5 flex-shrink-0" />
                            <span>{error()}</span>
                        </div>
                    </Show>

                    {/* Success */}
                    <Show when={success() && step() !== 'done'}>
                        <div class="flex items-center gap-3 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-5">
                            <CheckCircle class="w-5 h-5 flex-shrink-0" />
                            <span>{success()}</span>
                        </div>
                    </Show>

                    <Switch>
                        {/* Step 1: Email */}
                        <Match when={step() === 'email'}>
                            <form onSubmit={handleRequestCode} class="space-y-5">
                                <p class="text-gray-400 text-sm mb-4">
                                    Enter your email address and we'll send you a verification code to reset your password.
                                </p>
                                <div>
                                    <label class="text-gray-400 text-sm mb-2 block font-medium">Email</label>
                                    <div class="relative">
                                        <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                        <input
                                            type="email"
                                            value={email()}
                                            onInput={(e) => setEmail(e.currentTarget.value)}
                                            placeholder="your@email.com"
                                            class="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] transition-all box-border"
                                            required
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading()}
                                    class="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Show when={isLoading()} fallback="Send Verification Code">
                                        <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Sending...
                                    </Show>
                                </button>
                            </form>
                        </Match>

                        {/* Step 2: Verify Code */}
                        <Match when={step() === 'code'}>
                            <form onSubmit={handleVerifyCode} class="space-y-5">
                                <p class="text-gray-400 text-sm mb-4">
                                    Enter the 6-digit code sent to <span class="text-cyan-400 font-medium">{email()}</span>
                                </p>
                                <div>
                                    <label class="text-gray-400 text-sm mb-2 block font-medium">Verification Code</label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={code()}
                                        onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, ''))}
                                        placeholder="000000"
                                        class="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white text-center text-2xl font-mono tracking-[0.5em] placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] transition-all box-border"
                                        required
                                        autofocus
                                    />
                                    <p class="text-gray-600 text-xs mt-2">Code expires in 15 minutes</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading() || code().length !== 6}
                                    class="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Show when={isLoading()} fallback="Verify Code">
                                        <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Verifying...
                                    </Show>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setStep('email'); setError(''); setSuccess(''); }}
                                    class="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                                >
                                    Resend code
                                </button>
                            </form>
                        </Match>

                        {/* Step 2.5: TOTP Verification */}
                        <Match when={step() === 'totp'}>
                            <form onSubmit={handleTotpVerify} class="space-y-5">
                                <div class="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-2">
                                    <Shield class="w-5 h-5 text-amber-400 flex-shrink-0" />
                                    <p class="text-amber-200 text-sm">
                                        Your account has 2-Factor Authentication enabled.
                                    </p>
                                </div>
                                <div>
                                    <label class="text-gray-400 text-sm mb-2 block font-medium">
                                        {useBackupCode() ? 'Backup Code' : 'Google Authenticator Code'}
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={useBackupCode() ? 8 : 6}
                                        value={totpCode()}
                                        onInput={(e) => setTotpCode(e.currentTarget.value)}
                                        placeholder={useBackupCode() ? 'XXXXXXXX' : '000000'}
                                        class="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white text-center text-2xl font-mono tracking-[0.3em] placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] transition-all box-border"
                                        required
                                        autofocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={totpCode().length < 6}
                                    class="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Verify
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUseBackupCode(!useBackupCode())}
                                    class="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                                >
                                    {useBackupCode() ? 'Use Authenticator App instead' : 'Use Backup Code instead'}
                                </button>
                            </form>
                        </Match>

                        {/* Step 3: New Password */}
                        <Match when={step() === 'password'}>
                            <form onSubmit={handleCompleteReset} class="space-y-5">
                                <div>
                                    <label class="text-gray-400 text-sm mb-2 block font-medium">New Password</label>
                                    <div class="relative">
                                        <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                        <input
                                            type={showPassword() ? 'text' : 'password'}
                                            value={newPassword()}
                                            onInput={(e) => setNewPassword(e.currentTarget.value)}
                                            placeholder="Enter new password (min 8 chars)"
                                            class="w-full p-4 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] transition-all box-border"
                                            required
                                            minLength={8}
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

                                <div>
                                    <label class="text-gray-400 text-sm mb-2 block font-medium">Confirm Password</label>
                                    <div class="relative">
                                        <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                        <input
                                            type={showPassword() ? 'text' : 'password'}
                                            value={confirmPassword()}
                                            onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                                            placeholder="Re-enter your new password"
                                            class="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] transition-all box-border"
                                            required
                                            minLength={8}
                                        />
                                    </div>
                                </div>

                                {/* Password strength hints */}
                                <div class="text-xs text-gray-600 space-y-1">
                                    <div class={newPassword().length >= 8 ? 'text-emerald-500' : ''}>
                                        {newPassword().length >= 8 ? '\u2713' : '\u2022'} At least 8 characters
                                    </div>
                                    <div class={newPassword() && newPassword() === confirmPassword() ? 'text-emerald-500' : ''}>
                                        {newPassword() && newPassword() === confirmPassword() ? '\u2713' : '\u2022'} Passwords match
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading() || newPassword().length < 8 || newPassword() !== confirmPassword()}
                                    class="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Show when={isLoading()} fallback="Reset Password">
                                        <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Resetting...
                                    </Show>
                                </button>
                            </form>
                        </Match>

                        {/* Done */}
                        <Match when={step() === 'done'}>
                            <div class="text-center space-y-6">
                                <div class="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto border border-emerald-500/30">
                                    <CheckCircle class="w-10 h-10 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 class="text-xl font-bold text-white mb-2">Password Changed</h2>
                                    <p class="text-gray-400 text-sm">
                                        Your password has been successfully reset.
                                        You can now log in with your new password.
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate('/login', { replace: true })}
                                    class="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                                >
                                    Go to Login
                                </button>
                            </div>
                        </Match>
                    </Switch>

                    {/* Back Link */}
                    <Show when={step() !== 'done'}>
                        <div class="mt-8 pt-6 border-t border-white/5 text-center">
                            <a
                                href="/login"
                                class="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 text-sm transition-colors"
                            >
                                <ArrowLeft class="w-4 h-4" />
                                Back to Login
                            </a>
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
}
