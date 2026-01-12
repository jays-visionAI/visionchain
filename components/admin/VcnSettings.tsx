import { createSignal, Show } from 'solid-js';
import {
    Lock,
    Shield,
    Mail,
    Check,
    AlertCircle,
    ArrowRight,
    RefreshCw
} from 'lucide-solid';
import { useAuth } from '../auth/authContext';
import { requestPasswordChange, getFirebaseDb } from '../../services/firebaseService';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';

export default function VcnSettings() {
    const auth = useAuth();
    const [step, setStep] = createSignal<'idle' | 'verify' | 'new-password' | 'success'>('idle');
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [verificationCode, setVerificationCode] = createSignal('');
    const [sentCode, setSentCode] = createSignal('');
    const [newPassword, setNewPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');

    const handleRequestCode = async () => {
        setLoading(true);
        setError('');
        try {
            const user = auth.user();
            if (!user || !user.email) throw new Error('User not found');
            const code = await requestPasswordChange(user.email);
            setSentCode(code);
            setStep('verify');
        } catch (err: any) {
            setError('Failed to send verification code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = () => {
        if (verificationCode() === sentCode()) {
            setStep('new-password');
        } else {
            setError('Invalid verification code.');
        }
    };

    const handleUpdatePassword = async (e: Event) => {
        e.preventDefault();
        if (newPassword() !== confirmPassword()) {
            setError('Passwords do not match.');
            return;
        }
        if (newPassword().length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const user = auth.user();
            if (!user) throw new Error('User not found');

            // 1. Update Firebase Auth Password
            await updatePassword(user, newPassword());

            // 2. Update Firestore record
            const db = getFirebaseDb();
            const userRef = doc(db, 'users', user.email!.toLowerCase());
            await updateDoc(userRef, {
                passwordChanged: true
            });

            setStep('success');
        } catch (err: any) {
            console.error('Password update error:', err);
            setError('Failed to update password. You may need to re-login for security.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div class="max-w-2xl mx-auto space-y-8 py-8">
            <div>
                <h1 class="text-3xl font-black text-white uppercase tracking-tight">Security Settings</h1>
                <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Manage your account protection and credentials</p>
            </div>

            <div class="rounded-3xl bg-white/[0.02] border border-white/5 p-8 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-8 opacity-5">
                    <Shield class="w-32 h-32 text-cyan-400" />
                </div>

                <div class="relative z-10 space-y-6">
                    <Show when={step() === 'idle'}>
                        <div class="flex items-center gap-4 mb-4">
                            <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                                <Lock class="w-6 h-6 text-cyan-400" />
                            </div>
                            <div>
                                <h2 class="text-lg font-black text-white uppercase tracking-tight">Change Password</h2>
                                <p class="text-xs text-gray-500 font-medium">Verify your email to set a new secure password</p>
                            </div>
                        </div>
                        <button
                            onClick={handleRequestCode}
                            disabled={loading()}
                            class="w-full sm:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <Show when={loading()} fallback={<Mail class="w-4 h-4" />}>
                                <RefreshCw class="w-4 h-4 animate-spin" />
                            </Show>
                            Send Verification Code
                        </button>
                    </Show>

                    <Show when={step() === 'verify'}>
                        <div class="space-y-4">
                            <h2 class="text-sm font-black text-white uppercase tracking-widest">Verify Email</h2>
                            <p class="text-xs text-gray-400">Enter the 6-digit code sent to {auth.user()?.email}</p>
                            <input
                                type="text"
                                value={verificationCode()}
                                onInput={(e) => setVerificationCode(e.currentTarget.value)}
                                placeholder="000000"
                                maxLength={6}
                                class="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-2xl font-black tracking-[0.5em] text-center text-cyan-400 focus:outline-none focus:border-cyan-500/50"
                            />
                            <button
                                onClick={handleVerifyCode}
                                class="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-cyan-500/20"
                            >
                                Verify & Continue
                            </button>
                            <button onClick={handleRequestCode} class="text-[9px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors block mx-auto">
                                Resend Code
                            </button>
                        </div>
                    </Show>

                    <Show when={step() === 'new-password'}>
                        <form onSubmit={handleUpdatePassword} class="space-y-4">
                            <h2 class="text-sm font-black text-white uppercase tracking-widest">Set New Password</h2>
                            <div>
                                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword()}
                                    onInput={(e) => setNewPassword(e.currentTarget.value)}
                                    placeholder="Minimum 6 characters"
                                    class="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-cyan-500/50"
                                    required
                                />
                            </div>
                            <div>
                                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword()}
                                    onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                                    placeholder="Re-enter password"
                                    class="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-cyan-500/50"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading()}
                                class="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                            >
                                <Show when={loading()} fallback="Update Password">
                                    <RefreshCw class="w-4 h-4 animate-spin" />
                                    Updating...
                                </Show>
                            </button>
                        </form>
                    </Show>

                    <Show when={step() === 'success'}>
                        <div class="text-center py-8">
                            <div class="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                                <Check class="w-8 h-8 text-green-400" />
                            </div>
                            <h2 class="text-xl font-black text-white uppercase tracking-tight">Security Updated</h2>
                            <p class="text-xs text-gray-400 mt-2">Your password has been successfully changed.</p>
                            <button
                                onClick={() => setStep('idle')}
                                class="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Back to Settings
                            </button>
                        </div>
                    </Show>

                    <Show when={error()}>
                        <div class="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl text-red-400 text-[10px] font-bold uppercase tracking-tight">
                            <AlertCircle class="w-4 h-4 flex-shrink-0" />
                            {error()}
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
}
