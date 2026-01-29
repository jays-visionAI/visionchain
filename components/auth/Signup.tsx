import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import {
    Lock,
    Mail,
    Eye,
    EyeOff,
    AlertCircle,
    UserPlus,
    ArrowLeft,
    Phone,
    ChevronDown,
    Check,
    Search
} from 'lucide-solid';
import { useAuth } from './authContext';
import { countries, Country } from '../wallet/CountryData';
import { Motion } from 'solid-motionone';

export default function Signup() {
    const [searchParams] = useSearchParams();
    const [email, setEmail] = createSignal('');
    const [phone, setPhone] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [showPassword, setShowPassword] = createSignal(false);
    const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);
    const [error, setError] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
    const [referralCode, setReferralCode] = createSignal(
        typeof searchParams.ref === 'string' ? searchParams.ref : ''
    );
    const [isSuccess, setIsSuccess] = createSignal(false);

    // Country code state
    const getDefaultCountry = () => {
        const locale = typeof navigator !== 'undefined' ? navigator.language : 'ko-KR';
        const code = (locale.split('-')[1] || '').toUpperCase();
        return countries.find(c => c.code === code) || countries.find(c => c.code === 'KR') || countries[0];
    };
    const [selectedCountry, setSelectedCountry] = createSignal<Country>(getDefaultCountry());
    const [showCountryPicker, setShowCountryPicker] = createSignal(false);
    const [countrySearch, setCountrySearch] = createSignal('');

    const filteredCountries = () => countries
        .filter(c =>
            c.name.toLowerCase().includes(countrySearch().toLowerCase()) ||
            c.dialCode.includes(countrySearch()) ||
            c.code.toLowerCase().includes(countrySearch().toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name));

    const auth = useAuth();
    const navigate = useNavigate();

    onMount(() => {
        const ref = searchParams.ref;
        if (ref && typeof ref === 'string') {
            setReferralCode(ref);
        }
    });

    // Convert phone to E.164 format
    const formatPhoneToE164 = (phoneNum: string, country: Country): string => {
        let cleanPhone = phoneNum.replace(/\D/g, '');
        // Remove leading zero for international format
        if (cleanPhone.startsWith('0')) {
            cleanPhone = cleanPhone.slice(1);
        }
        return `${country.dialCode}${cleanPhone}`;
    };

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

        const phoneVal = phone().trim();
        if (!phoneVal) {
            setError('Phone number is required for user identification.');
            return;
        }

        // Convert to E.164 format before sending to registration
        const e164Phone = formatPhoneToE164(phoneVal, selectedCountry());

        setIsLoading(true);

        try {
            await auth.register(emailVal, pwdVal, e164Phone, referralCode());
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

            <div class="w-full max-w-[480px] relative z-10">
                <div class="rounded-[32px] bg-white/[0.03] border border-white/10 p-10 backdrop-blur-2xl shadow-2xl overflow-hidden">
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
                                    class="w-full py-4 pl-14 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.08] transition-all transition-shadow focus:ring-1 focus:ring-purple-500/20 box-border"
                                />
                            </div>
                        </div>

                        {/* Phone Input with Country Selector */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block font-medium">Phone Number</label>
                            <div class="flex gap-2">
                                {/* Country Code Selector */}
                                <div class="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowCountryPicker(!showCountryPicker())}
                                        class="flex items-center gap-2 px-3 py-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all min-w-[100px]"
                                    >
                                        <img src={selectedCountry().flag} class="w-5 h-3.5 object-cover rounded-sm" alt="" />
                                        <span class="text-xs font-bold text-gray-400">{selectedCountry().dialCode}</span>
                                        <ChevronDown class={`w-3 h-3 text-gray-500 transition-transform ${showCountryPicker() ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Country Dropdown */}
                                    <Show when={showCountryPicker()}>
                                        <div class="fixed inset-0 z-[50]" onClick={() => setShowCountryPicker(false)} />
                                        <Motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            class="absolute top-full left-0 mt-2 w-72 bg-[#1a1a1c] border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden"
                                        >
                                            <div class="p-3 border-b border-white/10 flex items-center gap-2 bg-white/[0.02]">
                                                <Search class="w-3.5 h-3.5 text-gray-500" />
                                                <input
                                                    type="text"
                                                    placeholder="Search country..."
                                                    value={countrySearch()}
                                                    onInput={(e) => setCountrySearch(e.currentTarget.value)}
                                                    class="w-full bg-transparent text-xs outline-none text-white"
                                                    autofocus
                                                />
                                            </div>
                                            <div class="max-h-[240px] overflow-y-auto custom-scrollbar">
                                                <For each={filteredCountries()}>
                                                    {(c) => (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedCountry(c);
                                                                setShowCountryPicker(false);
                                                                setCountrySearch('');
                                                            }}
                                                            class={`w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors ${c.code === selectedCountry().code ? 'bg-purple-500/10' : ''}`}
                                                        >
                                                            <div class="flex items-center gap-3">
                                                                <img src={c.flag} class="w-5 h-3.5 object-cover rounded-sm border border-white/10" alt="" />
                                                                <span class="text-[13px] font-medium text-gray-200">{c.name}</span>
                                                            </div>
                                                            <div class="flex items-center gap-2">
                                                                <span class="text-[11px] font-mono text-gray-500">{c.dialCode}</span>
                                                                <Show when={c.code === selectedCountry().code}>
                                                                    <Check class="w-3.5 h-3.5 text-purple-500" />
                                                                </Show>
                                                            </div>
                                                        </button>
                                                    )}
                                                </For>
                                            </div>
                                        </Motion.div>
                                    </Show>
                                </div>

                                {/* Phone Number Input */}
                                <div class="relative flex-1">
                                    <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        type="tel"
                                        value={phone()}
                                        onInput={(e) => setPhone(e.currentTarget.value)}
                                        placeholder="1012345678"
                                        class="w-full py-4 pl-14 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.08] transition-all transition-shadow focus:ring-1 focus:ring-purple-500/20 box-border"
                                        required
                                    />
                                </div>
                            </div>
                            <p class="text-[10px] text-gray-500 mt-2 ml-1">Used to map your account with Vision ID Address Book.</p>
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
                                    class="w-full py-4 pl-14 pr-12 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.08] transition-all transition-shadow focus:ring-1 focus:ring-purple-500/20 box-border"
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
                                    class="w-full py-4 pl-14 pr-12 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.08] transition-all transition-shadow focus:ring-1 focus:ring-purple-500/20 box-border"
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

                        {/* Referral Code (Optional) */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block font-medium">Referral Code (Optional)</label>
                            <div class="relative">
                                <UserPlus class={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${searchParams.ref ? 'text-purple-500/50' : 'text-gray-500'}`} />
                                <input
                                    type="text"
                                    value={referralCode()}
                                    onInput={(e) => setReferralCode(e.currentTarget.value)}
                                    placeholder="Enter referral code"
                                    disabled={!!searchParams.ref}
                                    class={`w-full py-4 pl-14 pr-4 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all transition-shadow focus:ring-1 focus:ring-purple-500/20 box-border ${searchParams.ref
                                        ? 'bg-purple-500/10 cursor-not-allowed opacity-70'
                                        : 'bg-white/5 focus:bg-white/[0.08]'
                                        }`}
                                />
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
                    <div class="mt-10 pt-8 border-t border-white/5 text-center">
                        <p class="text-gray-500 text-sm mb-3">Already have an account?</p>
                        <a
                            href="/login"
                            class="inline-flex items-center gap-2 px-8 py-3 rounded-xl border border-white/10 text-cyan-400 hover:text-cyan-300 hover:bg-white/5 font-semibold text-sm transition-all"
                        >
                            Log in
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

