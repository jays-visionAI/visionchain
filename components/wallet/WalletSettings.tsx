import { createSignal, For, Show, onMount } from 'solid-js';
import {
    Settings,
    Bell,
    Shield,
    Globe,
    Moon,
    Mail,
    Smartphone,
    Key,
    Save,
    Lock,
    Eye,
    EyeOff,
    Check,
    AlertCircle,
    ArrowLeft,
    Trash2
} from 'lucide-solid';
import { getUserPreset, saveUserPreset, getUserData, updateUserData, resetUserWallet } from '../../services/firebaseService';
import { useAuth } from '../auth/authContext';
import { WalletViewHeader } from './WalletViewHeader';

// Storage key for user settings (using different key than admin)
const USER_SETTINGS_KEY = 'visionhub_user_settings';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function Toggle(props: ToggleProps) {
    return (
        <button
            onClick={() => props.onChange(!props.checked)}
            class={`relative w-12 h-6 rounded-full transition-colors duration-300 ${props.checked ? 'bg-cyan-500' : 'bg-white/10'
                }`}
        >
            <div
                class={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg transition-transform duration-300 ${props.checked ? 'translate-x-7' : 'translate-x-1'
                    }`}
            />
        </button>
    );
}

export function WalletSettings(props: { onBack?: () => void }) {
    const [activeTab, setActiveTab] = createSignal('general');
    const [emailNotifications, setEmailNotifications] = createSignal(true);
    const [pushNotifications, setPushNotifications] = createSignal(false);
    const [twoFactorAuth, setTwoFactorAuth] = createSignal(true);
    const [darkMode, setDarkMode] = createSignal(true);
    const [phone, setPhone] = createSignal('');
    const [isSavingPhone, setIsSavingPhone] = createSignal(false);
    const [phoneSuccess, setPhoneSuccess] = createSignal(false);

    // Password state
    const [currentPassword, setCurrentPassword] = createSignal('');
    const [newPassword, setNewPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [showCurrentPassword, setShowCurrentPassword] = createSignal(false);
    const [showNewPassword, setShowNewPassword] = createSignal(false);
    const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);
    const [passwordError, setPasswordError] = createSignal('');
    const [passwordSuccess, setPasswordSuccess] = createSignal(false);

    const handleChangePassword = (e: Event) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess(false);

        // Validate new password
        if (newPassword().length < 8) {
            setPasswordError('New password must be at least 8 characters');
            return;
        }

        // Validate confirmation
        if (newPassword() !== confirmPassword()) {
            setPasswordError('Passwords do not match');
            return;
        }

        // Save new password logic would go here
        setPasswordSuccess(true);

        // Reset form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        // Hide success after 3 seconds
        setTimeout(() => setPasswordSuccess(false), 3000);
    };

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'presets', label: 'Payment Presets', icon: Globe },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'password', label: 'Password', icon: Lock },
        { id: 'danger', label: 'Danger Zone', icon: AlertCircle },
    ];

    // Preset State
    const [primaryAsset, setPrimaryAsset] = createSignal('VCN');
    const [secondaryAsset, setSecondaryAsset] = createSignal('USDC');
    const [preferredChain, setPreferredChain] = createSignal('Vision Chain');
    const [presetLoading, setPresetLoading] = createSignal(false);

    // Reset Wallet State
    const [resetConfirmText, setResetConfirmText] = createSignal('');
    const [isResetting, setIsResetting] = createSignal(false);

    const auth = useAuth();

    // Import on demand to avoid cycle, or just import at top if possible
    // We need resetUserWallet from firebaseService
    const { resetUserWallet } = require('../../services/firebaseService');

    // Load preset on mount
    onMount(async () => {
        if (auth.user()?.email) {
            const preset = await getUserPreset(auth.user().email);
            if (preset) {
                setPrimaryAsset(preset.primaryAsset);
                setSecondaryAsset(preset.secondaryAsset);
                setPreferredChain(preset.preferredChain);
            }

            // Load user profile data (like phone)
            const userData = await getUserData(auth.user().email);
            if (userData?.phone) {
                setPhone(userData.phone);
            }
        }
    });

    const handleSavePhone = async () => {
        if (!auth.user()?.email) return;
        setIsSavingPhone(true);
        setPhoneSuccess(false);
        try {
            await updateUserData(auth.user().email, { phone: phone() });
            setPhoneSuccess(true);
            setTimeout(() => setPhoneSuccess(false), 3000);
        } catch (e) {
            console.error(e);
            alert("Failed to save phone number.");
        } finally {
            setIsSavingPhone(false);
        }
    };

    const handleSavePreset = async () => {
        if (!auth.user()?.email) return;
        setPresetLoading(true);
        try {
            await saveUserPreset(auth.user().email, {
                primaryAsset: primaryAsset(),
                secondaryAsset: secondaryAsset(),
                preferredChain: preferredChain()
            });
            alert("Payment preferences updated!");
        } catch (e) {
            console.error(e);
            alert("Failed to save preferences.");
        } finally {
            setPresetLoading(false);
        }
    };

    const handleResetWallet = async () => {
        if (resetConfirmText() !== 'DELETE') return;
        if (!auth.user()?.email) return;

        setIsResetting(true);
        try {
            // 1. Reset on Backend (Archive + Delete fields)
            await resetUserWallet(auth.user().email);

            // 2. Clear Local Storage (Keys)
            // Ideally use a dedicated service method, but here we manually clean known keys
            localStorage.removeItem('vision_wallet_encrypted');
            localStorage.removeItem('vision_wallet_iv');
            localStorage.removeItem('vision_wallet_salt');
            localStorage.removeItem('vision_wallet_address');

            // 3. Force Reload to re-trigger onboarding flow
            window.location.reload();
        } catch (e) {
            console.error("Reset Failed:", e);
            alert("Failed to reset wallet. Please contact support.");
            setIsResetting(false);
        }
    };

    return (
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Show when={props.onBack}>
                <div class="flex items-center gap-4 mb-2 lg:hidden">
                    <button
                        onClick={props.onBack}
                        class="p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft class="w-5 h-5" />
                    </button>
                    <span class="text-sm font-bold text-gray-500 uppercase tracking-widest">Back to Assets</span>
                </div>
            </Show>

            <WalletViewHeader
                tag="Core configuration"
                title="WALLET"
                titleAccent="SETTINGS"
                description="Manage your identity, security protocols, and payment preferences."
                icon={Settings}
            />

            {/* Tabs */}
            <div class="flex overflow-x-auto gap-2 border-b border-white/10 pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <For each={tabs}>
                    {(tab) => (
                        <button
                            onClick={() => setActiveTab(tab.id)}
                            class={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap shrink-0 ${activeTab() === tab.id
                                ? (tab.id === 'danger'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30')
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <tab.icon class="w-4 h-4" />
                            {tab.label}
                        </button>
                    )}
                </For>
            </div>

            {/* General Tab */}
            <Show when={activeTab() === 'general'}>
                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                    <div class="flex items-center gap-3 p-6 border-b border-white/5">
                        <div class="p-2 rounded-xl bg-cyan-500/20">
                            <Settings class="w-5 h-5 text-cyan-400" />
                        </div>
                        <h2 class="text-lg font-semibold text-white">General Settings</h2>
                    </div>
                    <div class="divide-y divide-white/5">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex items-start gap-4">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Moon class="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p class="text-white font-medium">Dark Mode</p>
                                    <p class="text-gray-400 text-sm mt-0.5">Enable dark theme across the dashboard</p>
                                </div>
                            </div>
                            <Toggle checked={darkMode()} onChange={setDarkMode} />
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex items-start gap-4">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Globe class="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p class="text-white font-medium">Language</p>
                                    <p class="text-gray-400 text-sm mt-0.5">Choose your preferred language</p>
                                </div>
                            </div>
                            <select class="appearance-none px-4 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer">
                                <option value="en">English</option>
                                <option value="ko">Korean</option>
                                <option value="ja">Japanese</option>
                                <option value="zh">Chinese</option>
                            </select>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors border-t border-white/5">
                            <div class="flex items-start gap-4 flex-1">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Smartphone class="w-5 h-5 text-gray-400" />
                                </div>
                                <div class="flex-1">
                                    <p class="text-white font-medium">Phone Number</p>
                                    <p class="text-gray-400 text-sm mt-0.5">Used for user identification and VID mapping</p>
                                    <div class="mt-3 flex flex-col sm:flex-row gap-2 max-w-sm w-full">
                                        <input
                                            type="tel"
                                            value={phone()}
                                            onInput={(e) => setPhone(e.currentTarget.value)}
                                            placeholder="010-1234-5678"
                                            class="flex-1 px-4 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 text-sm"
                                        />
                                        <button
                                            onClick={handleSavePhone}
                                            disabled={isSavingPhone()}
                                            class={`px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${phoneSuccess()
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-white/10 text-white hover:bg-white/20'
                                                }`}
                                        >
                                            <Show when={isSavingPhone()} fallback={phoneSuccess() ? <><Check class="w-3 h-3" /> Saved</> : 'Update'}>
                                                <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            </Show>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Presets Tab */}
            <Show when={activeTab() === 'presets'}>
                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                    <div class="flex items-center gap-3 p-6 border-b border-white/5">
                        <div class="p-2 rounded-xl bg-cyan-500/20">
                            <Globe class="w-5 h-5 text-cyan-400" />
                        </div>
                        <h2 class="text-lg font-semibold text-white">Payment Preferences</h2>
                    </div>
                    <div class="p-6 space-y-6">
                        <p class="text-gray-400 text-sm">
                            Configure which assets you prefer to receive. Vision AI will try to auto-swap incoming payments to these preferences.
                        </p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Primary Asset */}
                            <div>
                                <label class="text-white font-medium block mb-2">Primary Asset</label>
                                <select
                                    value={primaryAsset()}
                                    onChange={(e) => setPrimaryAsset(e.currentTarget.value)}
                                    class="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                >
                                    <option value="VCN">VCN (Vision Coin)</option>
                                    <option value="USDC">USDC</option>
                                    <option value="USDT">USDT</option>
                                    <option value="ETH">Ethereum</option>
                                    <option value="WBTC">Wrapped BTC</option>
                                </select>
                            </div>

                            {/* Secondary Asset */}
                            <div>
                                <label class="text-white font-medium block mb-2">Secondary Asset</label>
                                <select
                                    value={secondaryAsset()}
                                    onChange={(e) => setSecondaryAsset(e.currentTarget.value)}
                                    class="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                >
                                    <option value="USDC">USDC</option>
                                    <option value="VCN">VCN (Vision Coin)</option>
                                    <option value="USDT">USDT</option>
                                    <option value="ETH">Ethereum</option>
                                </select>
                            </div>

                            {/* Preferred Network */}
                            <div class="md:col-span-2">
                                <label class="text-white font-medium block mb-2">Preferred Network</label>
                                <div class="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={() => setPreferredChain('Vision Chain')}
                                        class={`flex-1 py-3.5 rounded-xl border font-bold transition-all ${preferredChain() === 'Vision Chain' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        Vision Chain
                                    </button>
                                    <button
                                        onClick={() => setPreferredChain('Ethereum')}
                                        class={`flex-1 py-3.5 rounded-xl border font-bold transition-all ${preferredChain() === 'Ethereum' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        Ethereum
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="pt-4 border-t border-white/5 flex justify-end">
                            <button
                                onClick={handleSavePreset}
                                disabled={presetLoading()}
                                class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
                            >
                                {presetLoading() ? 'Saving...' : <><Save class="w-4 h-4" /> Save Preferences</>}
                            </button>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Notifications Tab */}
            <Show when={activeTab() === 'notifications'}>
                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                    <div class="flex items-center gap-3 p-6 border-b border-white/5">
                        <div class="p-2 rounded-xl bg-cyan-500/20">
                            <Bell class="w-5 h-5 text-cyan-400" />
                        </div>
                        <h2 class="text-lg font-semibold text-white">Notification Settings</h2>
                    </div>
                    <div class="divide-y divide-white/5">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex items-start gap-4">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Mail class="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p class="text-white font-medium">Email Notifications</p>
                                    <p class="text-gray-400 text-sm mt-0.5">Receive important updates via email</p>
                                </div>
                            </div>
                            <Toggle checked={emailNotifications()} onChange={setEmailNotifications} />
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex items-start gap-4">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Smartphone class="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p class="text-white font-medium">Push Notifications</p>
                                    <p class="text-gray-400 text-sm mt-0.5">Get instant notifications on your device</p>
                                </div>
                            </div>
                            <Toggle checked={pushNotifications()} onChange={setPushNotifications} />
                        </div>
                    </div>
                </div>
            </Show>

            {/* Security Tab */}
            <Show when={activeTab() === 'security'}>
                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                    <div class="flex items-center gap-3 p-6 border-b border-white/5">
                        <div class="p-2 rounded-xl bg-cyan-500/20">
                            <Shield class="w-5 h-5 text-cyan-400" />
                        </div>
                        <h2 class="text-lg font-semibold text-white">Security Settings</h2>
                    </div>
                    <div class="divide-y divide-white/5">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex items-start gap-4">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Key class="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p class="text-white font-medium">Two-Factor Authentication</p>
                                    <p class="text-gray-400 text-sm mt-0.5">Add an extra layer of security to your account</p>
                                </div>
                            </div>
                            <Toggle checked={twoFactorAuth()} onChange={setTwoFactorAuth} />
                        </div>
                    </div>
                </div>
            </Show>

            {/* Password Tab */}
            <Show when={activeTab() === 'password'}>
                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                    <div class="flex items-center gap-3 p-6 border-b border-white/5">
                        <div class="p-2 rounded-xl bg-cyan-500/20">
                            <Lock class="w-5 h-5 text-cyan-400" />
                        </div>
                        <h2 class="text-lg font-semibold text-white">Change Password</h2>
                    </div>
                    <form onSubmit={handleChangePassword} class="p-6 space-y-6">
                        {/* Current Password */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block">Current Password</label>
                            <div class="relative">
                                <input
                                    type={showCurrentPassword() ? 'text' : 'password'}
                                    value={currentPassword()}
                                    onInput={(e) => setCurrentPassword(e.currentTarget.value)}
                                    placeholder="Enter current password"
                                    class="w-full p-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword())}
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    <Show when={showCurrentPassword()} fallback={<Eye class="w-4 h-4" />}>
                                        <EyeOff class="w-4 h-4" />
                                    </Show>
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block">New Password</label>
                            <div class="relative">
                                <input
                                    type={showNewPassword() ? 'text' : 'password'}
                                    value={newPassword()}
                                    onInput={(e) => setNewPassword(e.currentTarget.value)}
                                    placeholder="Enter new password (min. 8 characters)"
                                    class="w-full p-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword())}
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    <Show when={showNewPassword()} fallback={<Eye class="w-4 h-4" />}>
                                        <EyeOff class="w-4 h-4" />
                                    </Show>
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block">Confirm New Password</label>
                            <div class="relative">
                                <input
                                    type={showConfirmPassword() ? 'text' : 'password'}
                                    value={confirmPassword()}
                                    onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                                    placeholder="Confirm new password"
                                    class="w-full p-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword())}
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    <Show when={showConfirmPassword()} fallback={<Eye class="w-4 h-4" />}>
                                        <EyeOff class="w-4 h-4" />
                                    </Show>
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        <Show when={passwordError()}>
                            <div class="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                {passwordError()}
                            </div>
                        </Show>

                        {/* Success Message */}
                        <Show when={passwordSuccess()}>
                            <div class="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
                                <Check class="w-4 h-4" />
                                Password changed successfully!
                            </div>
                        </Show>

                        <button
                            type="submit"
                            class="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                        >
                            <Save class="w-4 h-4" />
                            Update Password
                        </button>
                    </form>
                </div>
            </Show>

            {/* Danger Zone Tab */}
            <Show when={activeTab() === 'danger'}>
                <div class="rounded-2xl bg-red-500/[0.05] border border-red-500/20 overflow-hidden">
                    <div class="flex items-center gap-3 p-6 border-b border-red-500/10">
                        <div class="p-2 rounded-xl bg-red-500/10">
                            <AlertCircle class="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h2 class="text-lg font-bold text-red-500">Danger Zone</h2>
                            <p class="text-red-400/80 text-xs">Irreversible actions that affect your assets</p>
                        </div>
                    </div>
                    <div class="p-6 space-y-8">
                        {/* Reset Wallet Action */}
                        <div class="p-6 rounded-2xl border border-red-500/20 bg-black/40">
                            <h3 class="text-white font-bold mb-2">Reset Wallet & Keys</h3>
                            <p class="text-gray-400 text-sm mb-6 leading-relaxed">
                                <strong class="text-red-500">WARNING:</strong> This action will permanently dissociate your current wallet address from this account.
                                <br /><br />
                                • You will <strong>LOSE ACCESS</strong> to any funds (ETH, VCN) and Nodes in the current wallet if you do not have the 12-word recovery phrase backed up.
                                <br />
                                • This cannot be undone by support staff.
                            </p>

                            <div class="space-y-4">
                                <div>
                                    <label class="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 block">Confirmation</label>
                                    <input
                                        type="text"
                                        placeholder="Type DELETE to confirm"
                                        value={resetConfirmText()}
                                        onInput={(e) => setResetConfirmText(e.currentTarget.value)}
                                        class="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-500 placeholder-red-500/30 focus:outline-none focus:border-red-500 font-bold"
                                    />
                                </div>
                                <button
                                    onClick={handleResetWallet}
                                    disabled={resetConfirmText() !== 'DELETE' || isResetting()}
                                    class={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 ${resetConfirmText() === 'DELETE'
                                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
                                        : 'bg-white/5 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    <Show when={isResetting()} fallback={<><Trash2 class="w-4 h-4" /> Reset Wallet Permanently</>}>
                                        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </Show>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}

{/* Presets Tab */ }
<Show when={activeTab() === 'presets'}>
    <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div class="flex items-center gap-3 p-6 border-b border-white/5">
            <div class="p-2 rounded-xl bg-cyan-500/20">
                <Globe class="w-5 h-5 text-cyan-400" />
            </div>
            <h2 class="text-lg font-semibold text-white">Payment Preferences</h2>
        </div>
        <div class="p-6 space-y-6">
            <p class="text-gray-400 text-sm">
                Configure which assets you prefer to receive. Vision AI will try to auto-swap incoming payments to these preferences.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Asset */}
                <div>
                    <label class="text-white font-medium block mb-2">Primary Asset</label>
                    <select
                        value={primaryAsset()}
                        onChange={(e) => setPrimaryAsset(e.currentTarget.value)}
                        class="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                    >
                        <option value="VCN">VCN (Vision Coin)</option>
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                        <option value="ETH">Ethereum</option>
                        <option value="WBTC">Wrapped BTC</option>
                    </select>
                </div>

                {/* Secondary Asset */}
                <div>
                    <label class="text-white font-medium block mb-2">Secondary Asset</label>
                    <select
                        value={secondaryAsset()}
                        onChange={(e) => setSecondaryAsset(e.currentTarget.value)}
                        class="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                    >
                        <option value="USDC">USDC</option>
                        <option value="VCN">VCN (Vision Coin)</option>
                        <option value="USDT">USDT</option>
                        <option value="ETH">Ethereum</option>
                    </select>
                </div>

                {/* Preferred Network */}
                <div class="md:col-span-2">
                    <label class="text-white font-medium block mb-2">Preferred Network</label>
                    <div class="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => setPreferredChain('Vision Chain')}
                            class={`flex-1 py-3.5 rounded-xl border font-bold transition-all ${preferredChain() === 'Vision Chain' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                        >
                            Vision Chain
                        </button>
                        <button
                            onClick={() => setPreferredChain('Ethereum')}
                            class={`flex-1 py-3.5 rounded-xl border font-bold transition-all ${preferredChain() === 'Ethereum' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                        >
                            Ethereum
                        </button>
                    </div>
                </div>
            </div>

            <div class="pt-4 border-t border-white/5 flex justify-end">
                <button
                    onClick={handleSavePreset}
                    disabled={presetLoading()}
                    class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
                >
                    {presetLoading() ? 'Saving...' : <><Save class="w-4 h-4" /> Save Preferences</>}
                </button>
            </div>
        </div>
    </div>
</Show>

{/* Notifications Tab */ }
<Show when={activeTab() === 'notifications'}>
    <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div class="flex items-center gap-3 p-6 border-b border-white/5">
            <div class="p-2 rounded-xl bg-cyan-500/20">
                <Bell class="w-5 h-5 text-cyan-400" />
            </div>
            <h2 class="text-lg font-semibold text-white">Notification Settings</h2>
        </div>
        <div class="divide-y divide-white/5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                <div class="flex items-start gap-4">
                    <div class="p-2 rounded-lg bg-white/5">
                        <Mail class="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                        <p class="text-white font-medium">Email Notifications</p>
                        <p class="text-gray-400 text-sm mt-0.5">Receive important updates via email</p>
                    </div>
                </div>
                <Toggle checked={emailNotifications()} onChange={setEmailNotifications} />
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                <div class="flex items-start gap-4">
                    <div class="p-2 rounded-lg bg-white/5">
                        <Smartphone class="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                        <p class="text-white font-medium">Push Notifications</p>
                        <p class="text-gray-400 text-sm mt-0.5">Get instant notifications on your device</p>
                    </div>
                </div>
                <Toggle checked={pushNotifications()} onChange={setPushNotifications} />
            </div>
        </div>
    </div>
</Show>

{/* Security Tab */ }
<Show when={activeTab() === 'security'}>
    <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div class="flex items-center gap-3 p-6 border-b border-white/5">
            <div class="p-2 rounded-xl bg-cyan-500/20">
                <Shield class="w-5 h-5 text-cyan-400" />
            </div>
            <h2 class="text-lg font-semibold text-white">Security Settings</h2>
        </div>
        <div class="divide-y divide-white/5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                <div class="flex items-start gap-4">
                    <div class="p-2 rounded-lg bg-white/5">
                        <Key class="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                        <p class="text-white font-medium">Two-Factor Authentication</p>
                        <p class="text-gray-400 text-sm mt-0.5">Add an extra layer of security to your account</p>
                    </div>
                </div>
                <Toggle checked={twoFactorAuth()} onChange={setTwoFactorAuth} />
            </div>
        </div>
    </div>
</Show>

{/* Password Tab */ }
<Show when={activeTab() === 'password'}>
    <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div class="flex items-center gap-3 p-6 border-b border-white/5">
            <div class="p-2 rounded-xl bg-cyan-500/20">
                <Lock class="w-5 h-5 text-cyan-400" />
            </div>
            <h2 class="text-lg font-semibold text-white">Change Password</h2>
        </div>
        <form onSubmit={handleChangePassword} class="p-6 space-y-6">
            {/* Current Password */}
            <div>
                <label class="text-gray-400 text-sm mb-2 block">Current Password</label>
                <div class="relative">
                    <input
                        type={showCurrentPassword() ? 'text' : 'password'}
                        value={currentPassword()}
                        onInput={(e) => setCurrentPassword(e.currentTarget.value)}
                        placeholder="Enter current password"
                        class="w-full p-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                    />
                    <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword())}
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                        <Show when={showCurrentPassword()} fallback={<Eye class="w-4 h-4" />}>
                            <EyeOff class="w-4 h-4" />
                        </Show>
                    </button>
                </div>
            </div>

            {/* New Password */}
            <div>
                <label class="text-gray-400 text-sm mb-2 block">New Password</label>
                <div class="relative">
                    <input
                        type={showNewPassword() ? 'text' : 'password'}
                        value={newPassword()}
                        onInput={(e) => setNewPassword(e.currentTarget.value)}
                        placeholder="Enter new password (min. 8 characters)"
                        class="w-full p-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                    />
                    <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword())}
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                        <Show when={showNewPassword()} fallback={<Eye class="w-4 h-4" />}>
                            <EyeOff class="w-4 h-4" />
                        </Show>
                    </button>
                </div>
            </div>

            {/* Confirm Password */}
            <div>
                <label class="text-gray-400 text-sm mb-2 block">Confirm New Password</label>
                <div class="relative">
                    <input
                        type={showConfirmPassword() ? 'text' : 'password'}
                        value={confirmPassword()}
                        onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                        placeholder="Confirm new password"
                        class="w-full p-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword())}
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                        <Show when={showConfirmPassword()} fallback={<Eye class="w-4 h-4" />}>
                            <EyeOff class="w-4 h-4" />
                        </Show>
                    </button>
                </div>
            </div>

            {/* Error Message */}
            <Show when={passwordError()}>
                <div class="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    {passwordError()}
                </div>
            </Show>

            {/* Success Message */}
            <Show when={passwordSuccess()}>
                <div class="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
                    <Check class="w-4 h-4" />
                    Password changed successfully!
                </div>
            </Show>

            <button
                type="submit"
                class="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
            >
                <Save class="w-4 h-4" />
                Update Password
            </button>
        </form>
    </div>
</Show>
        </div >
    );
}
