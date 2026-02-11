import { createSignal, For, Show, onMount } from 'solid-js';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
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
    ChevronDown,
    LogOut,
    Search,
    Clock,
    Cloud,
    RefreshCw,
} from 'lucide-solid';
import { getUserPreset, saveUserPreset, getUserData, updateUserData, getEmailPreferences, updateEmailPreferences } from '../../services/firebaseService';
import type { EmailCategory } from '../../services/firebaseService';
import { CloudWalletService, calculatePasswordStrength } from '../../services/cloudWalletService';
import { WalletService } from '../../services/walletService';
import { countries, Country } from './CountryData';
import { useAuth } from '../auth/authContext';
import { WalletViewHeader } from './WalletViewHeader';
import { useI18n } from '../../i18n/i18nContext';

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
    const { t, locale, setLocale, availableLocales } = useI18n();
    const [activeTab, setActiveTab] = createSignal('general');
    const [emailNotifications, setEmailNotifications] = createSignal(true);
    const [pushNotifications, setPushNotifications] = createSignal(false);
    const [twoFactorAuth, setTwoFactorAuth] = createSignal(true);
    const [darkMode, setDarkMode] = createSignal(true);
    const [showResponseTime, setShowResponseTime] = createSignal(false); // Default Off
    const [phone, setPhone] = createSignal('');
    const [selectedCountry, setSelectedCountry] = createSignal<Country>(countries.find(c => c.code === 'KR') || countries[0]);
    const [isSavingPhone, setIsSavingPhone] = createSignal(false);
    const [phoneSuccess, setPhoneSuccess] = createSignal(false);
    const [showCountryDropdown, setShowCountryDropdown] = createSignal(false);
    const [countrySearchTerm, setCountrySearchTerm] = createSignal("");

    // Password state
    const [currentPassword, setCurrentPassword] = createSignal('');
    const [newPassword, setNewPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [showCurrentPassword, setShowCurrentPassword] = createSignal(false);
    const [showNewPassword, setShowNewPassword] = createSignal(false);
    const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);
    const [passwordError, setPasswordError] = createSignal('');
    const [passwordSuccess, setPasswordSuccess] = createSignal(false);
    const [passwordLoading, setPasswordLoading] = createSignal(false);

    // Cloud Sync state
    const [cloudSyncStatus, setCloudSyncStatus] = createSignal<'none' | 'synced' | 'error'>('none');
    const [cloudSyncPassword, setCloudSyncPassword] = createSignal('');
    const [cloudSyncLoading, setCloudSyncLoading] = createSignal(false);
    const [cloudSyncError, setCloudSyncError] = createSignal('');

    // TOTP 2FA state
    const [totpEnabled, setTotpEnabled] = createSignal(false);
    const [totpSetupMode, setTotpSetupMode] = createSignal(false);
    const [totpQrCode, setTotpQrCode] = createSignal('');
    const [totpSecret, setTotpSecret] = createSignal('');
    const [totpCode, setTotpCode] = createSignal('');
    const [totpLoading, setTotpLoading] = createSignal(false);
    const [totpError, setTotpError] = createSignal('');
    const [totpSuccess, setTotpSuccess] = createSignal('');
    const [backupCodes, setBackupCodes] = createSignal<string[]>([]);
    const [showBackupCodes, setShowBackupCodes] = createSignal(false);
    const [backupCodesRemaining, setBackupCodesRemaining] = createSignal(0);
    const [totpDisableMode, setTotpDisableMode] = createSignal(false);
    const [totpDisableCode, setTotpDisableCode] = createSignal('');

    // Email preferences state
    const [emailCategories, setEmailCategories] = createSignal<EmailCategory[]>([]);
    const [emailPrefs, setEmailPrefs] = createSignal<Record<string, boolean>>({});
    const [emailPrefsLoading, setEmailPrefsLoading] = createSignal(false);
    const [emailPrefsError, setEmailPrefsError] = createSignal('');
    const [emailPrefsSaving, setEmailPrefsSaving] = createSignal<string | null>(null);
    const [emailPrefsLoaded, setEmailPrefsLoaded] = createSignal(false);

    // Load email preferences when notifications tab becomes active
    const loadEmailPreferences = async () => {
        const userEmail = auth.user()?.email;
        if (!userEmail || emailPrefsLoaded()) return;

        setEmailPrefsLoading(true);
        setEmailPrefsError('');
        try {
            const data = await getEmailPreferences(userEmail);
            setEmailCategories(data.categories);
            setEmailPrefs(data.preferences);
            setEmailPrefsLoaded(true);
        } catch (err: any) {
            console.error('[EmailPrefs] Load failed:', err);
            setEmailPrefsError(err.message || 'Failed to load email preferences');
        } finally {
            setEmailPrefsLoading(false);
        }
    };

    const handleToggleEmailPref = async (key: string, value: boolean) => {
        const userEmail = auth.user()?.email;
        if (!userEmail) return;

        // Optimistic update
        const prev = { ...emailPrefs() };
        setEmailPrefs({ ...prev, [key]: value });
        setEmailPrefsSaving(key);

        try {
            const result = await updateEmailPreferences(userEmail, { ...prev, [key]: value });
            setEmailPrefs(result.preferences);
        } catch (err: any) {
            // Revert on error
            setEmailPrefs(prev);
            setEmailPrefsError(err.message || 'Failed to update preference');
            setTimeout(() => setEmailPrefsError(''), 3000);
        } finally {
            setEmailPrefsSaving(null);
        }
    };

    // Category icon mapping
    const getCategoryIcon = (key: string) => {
        const icons: Record<string, () => any> = {
            security: () => <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
            staking: () => <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>,
            referral: () => <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
            bridge: () => <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
            weeklyReport: () => <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
            lifecycle: () => <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
            announcements: () => <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
        };
        return icons[key] || icons.announcements;
    };

    const handleChangePassword = async (e: Event) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess(false);

        // Validate current password is provided
        if (!currentPassword()) {
            setPasswordError(t('settings.password.enterCurrent'));
            return;
        }

        // Validate new password
        if (newPassword().length < 8) {
            setPasswordError(t('settings.password.tooShort'));
            return;
        }

        // Validate confirmation
        if (newPassword() !== confirmPassword()) {
            setPasswordError(t('settings.password.mismatch'));
            return;
        }

        // Prevent same password
        if (currentPassword() === newPassword()) {
            setPasswordError(t('settings.password.samePassword'));
            return;
        }

        setPasswordLoading(true);
        try {
            const user = auth.user();
            if (!user || !user.email) {
                throw new Error('User not found. Please re-login and try again.');
            }

            // Step 1: Re-authenticate with current password
            const credential = EmailAuthProvider.credential(user.email, currentPassword());
            await reauthenticateWithCredential(user, credential);

            // Step 2: Update to new password
            await updatePassword(user, newPassword());

            // Success
            setPasswordSuccess(true);

            // Reset form
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            // Hide success after 5 seconds
            setTimeout(() => setPasswordSuccess(false), 5000);
        } catch (err: any) {
            console.error('[ChangePassword] Error:', err);
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setPasswordError(t('settings.password.wrongPassword'));
            } else if (err.code === 'auth/too-many-requests') {
                setPasswordError(t('settings.password.tooManyAttempts'));
            } else if (err.code === 'auth/requires-recent-login') {
                setPasswordError(t('settings.password.requiresRelogin'));
            } else if (err.code === 'auth/weak-password') {
                setPasswordError(t('settings.password.weakPassword'));
            } else {
                setPasswordError(err.message || t('settings.password.generic'));
            }
        } finally {
            setPasswordLoading(false);
        }
    };

    // Cloud Sync Handler
    const handleCloudSync = async () => {
        if (!cloudSyncPassword()) {
            setCloudSyncError('Please enter your wallet password');
            return;
        }

        const strength = calculatePasswordStrength(cloudSyncPassword());
        if (!strength.isStrongEnough) {
            setCloudSyncError('Password not strong enough for cloud sync. Minimum: 10 chars + 3 of (upper/lower/number/special)');
            return;
        }

        try {
            setCloudSyncLoading(true);
            setCloudSyncError('');

            const userEmail = auth.user()?.email;
            if (!userEmail) {
                throw new Error('User not logged in');
            }

            const result = await CloudWalletService.syncLocalToCloud(cloudSyncPassword(), userEmail);

            if (result.success) {
                setCloudSyncStatus('synced');
                setCloudSyncPassword('');
            } else {
                setCloudSyncError(result.error || 'Failed to sync wallet');
                setCloudSyncStatus('error');
            }
        } catch (err: any) {
            console.error('[CloudSync] Error:', err);
            setCloudSyncError(err.message || 'An error occurred');
            setCloudSyncStatus('error');
        } finally {
            setCloudSyncLoading(false);
        }
    };

    // TOTP 2FA Handlers
    const handleSetupTOTP = async () => {
        try {
            setTotpLoading(true);
            setTotpError('');

            const result = await CloudWalletService.setupTOTP();

            if (result.success && result.qrCode && result.secret) {
                setTotpQrCode(result.qrCode);
                setTotpSecret(result.secret);
                setTotpSetupMode(true);
            } else {
                setTotpError(result.error || 'Failed to setup 2FA');
            }
        } catch (err: any) {
            console.error('[TOTP] Setup error:', err);
            setTotpError(err.message || 'An error occurred');
        } finally {
            setTotpLoading(false);
        }
    };

    const handleEnableTOTP = async () => {
        if (totpCode().length !== 6) {
            setTotpError('Please enter a 6-digit code');
            return;
        }

        try {
            setTotpLoading(true);
            setTotpError('');

            const result = await CloudWalletService.enableTOTP(totpCode());

            if (result.success && result.backupCodes) {
                setBackupCodes(result.backupCodes);
                setShowBackupCodes(true);
                setTotpEnabled(true);
                setTotpSetupMode(false);
                setTotpCode('');
                setTotpSuccess('2FA enabled successfully! Save your backup codes.');
                setBackupCodesRemaining(result.backupCodes.length);
            } else {
                setTotpError(result.error || 'Invalid code');
            }
        } catch (err: any) {
            console.error('[TOTP] Enable error:', err);
            setTotpError(err.message || 'An error occurred');
        } finally {
            setTotpLoading(false);
        }
    };

    const handleDisableTOTP = async () => {
        if (totpDisableCode().length < 6) {
            setTotpError('Please enter a valid code');
            return;
        }

        try {
            setTotpLoading(true);
            setTotpError('');

            const result = await CloudWalletService.disableTOTP(totpDisableCode());

            if (result.success) {
                setTotpEnabled(false);
                setTotpDisableMode(false);
                setTotpDisableCode('');
                setTotpSuccess('2FA has been disabled');
                setBackupCodesRemaining(0);
                setTimeout(() => setTotpSuccess(''), 3000);
            } else {
                setTotpError(result.error || 'Invalid code');
            }
        } catch (err: any) {
            console.error('[TOTP] Disable error:', err);
            setTotpError(err.message || 'An error occurred');
        } finally {
            setTotpLoading(false);
        }
    };

    const loadTOTPStatus = async () => {
        try {
            const status = await CloudWalletService.getTOTPStatus();
            setTotpEnabled(status.enabled);
            setBackupCodesRemaining(status.backupCodesRemaining);
        } catch (err) {
            console.warn('[TOTP] Status check failed:', err);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const tabs = [
        { id: 'general', label: t('settings.tabs.general'), icon: Settings },
        { id: 'presets', label: t('settings.tabs.presets'), icon: Globe },
        { id: 'notifications', label: t('settings.tabs.notifications'), icon: Bell },
        { id: 'security', label: t('settings.tabs.security'), icon: Shield },
        { id: 'password', label: t('settings.tabs.password'), icon: Lock },
    ];

    // Preset State
    const [primaryAsset, setPrimaryAsset] = createSignal('VCN');
    const [secondaryAsset, setSecondaryAsset] = createSignal('USDC');
    const [preferredChain, setPreferredChain] = createSignal('Vision Chain');
    const [presetLoading, setPresetLoading] = createSignal(false);

    const auth = useAuth();

    // Load preset on mount
    onMount(async () => {
        // Load showResponseTime from localStorage (default: false)
        const savedShowResponseTime = localStorage.getItem('visionhub_show_response_time');
        if (savedShowResponseTime !== null) {
            setShowResponseTime(savedShowResponseTime === 'true');
        }

        // 1. Detect Country from Locale
        const userLocale = navigator.language || 'en-US';
        const regionCode = userLocale.split('-')[1] || userLocale.toUpperCase();

        let initialCountry = countries.find(c => c.code === regionCode) || countries.find(c => c.code === 'US') || countries[0];

        // 2. Load User Data
        if (auth.user()?.email) {
            const preset = await getUserPreset(auth.user().email);
            if (preset) {
                setPrimaryAsset(preset.primaryAsset);
                setSecondaryAsset(preset.secondaryAsset);
                setPreferredChain(preset.preferredChain);
            }

            const userData = await getUserData(auth.user().email);
            if (userData?.phone) {
                // Parse E.164 format
                const savedPhone = userData.phone;
                // Try to find matching country code
                const matchedCountry = countries.find(c => savedPhone.startsWith(c.dialCode));
                if (matchedCountry) {
                    initialCountry = matchedCountry;
                    setPhone(savedPhone.replace(matchedCountry.dialCode, ''));
                } else {
                    setPhone(savedPhone);
                }
            }

            // Check cloud sync status
            try {
                const cloudCheck = await CloudWalletService.hasCloudWallet();
                if (cloudCheck.exists) {
                    setCloudSyncStatus('synced');
                }
            } catch (e) {
                console.warn('[Settings] Failed to check cloud sync status:', e);
            }

            // Check TOTP 2FA status
            await loadTOTPStatus();
        }

        setSelectedCountry(initialCountry);
    });

    // Save showResponseTime to localStorage when changed
    const handleShowResponseTimeChange = (value: boolean) => {
        setShowResponseTime(value);
        localStorage.setItem('visionhub_show_response_time', String(value));

        // Dispatch custom event for same-tab sync (StorageEvent only works cross-tab)
        window.dispatchEvent(new CustomEvent('settingsChanged', {
            detail: {
                key: 'visionhub_show_response_time',
                value: String(value)
            }
        }));
    };

    const handleSavePhone = async () => {
        if (!auth.user()?.email) return;
        setIsSavingPhone(true);
        setPhoneSuccess(false);

        // Format to E.164
        const formattedPhone = `${selectedCountry().dialCode}${phone().replace(/^0+/, '')}`; // Remove leading zeros for E.164

        try {
            await updateUserData(auth.user().email, { phone: formattedPhone });
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
                    <span class="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('common.backToAssets')}</span>
                </div>
            </Show>

            <WalletViewHeader
                tag={t('settings.tag')}
                title={t('settings.title')}
                titleAccent={t('settings.titleAccent')}
                description={t('settings.description')}
                icon={Settings}
            />

            {/* Tabs */}
            <div class="flex overflow-x-auto gap-2 border-b border-white/10 pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <For each={tabs}>
                    {(tab) => (
                        <button
                            onClick={() => setActiveTab(tab.id)}
                            class={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap shrink-0 ${activeTab() === tab.id
                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
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
                        <h2 class="text-lg font-semibold text-white">{t('settings.general.title')}</h2>
                    </div>
                    <div class="divide-y divide-white/5">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex items-start gap-4">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Moon class="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p class="text-white font-medium">{t('settings.general.darkMode')}</p>
                                    <p class="text-gray-400 text-sm mt-0.5">{t('settings.general.darkModeDesc')}</p>
                                </div>
                            </div>
                            <Toggle checked={darkMode()} onChange={setDarkMode} />
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex items-start gap-4">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Clock class="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p class="text-white font-medium">{t('settings.general.showResponseTime')}</p>
                                    <p class="text-gray-400 text-sm mt-0.5">{t('settings.general.showResponseTimeDesc')}</p>
                                </div>
                            </div>
                            <Toggle checked={showResponseTime()} onChange={handleShowResponseTimeChange} />
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex items-start gap-4">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Globe class="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p class="text-white font-medium">{t('settings.general.language')}</p>
                                    <p class="text-gray-400 text-sm mt-0.5">{t('settings.general.languageDesc')}</p>
                                </div>
                            </div>
                            <select
                                value={locale()}
                                onChange={(e) => setLocale(e.currentTarget.value)}
                                class="appearance-none px-4 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                            >
                                <For each={availableLocales}>
                                    {(loc) => (
                                        <option value={loc.code}>{loc.native} ({loc.label})</option>
                                    )}
                                </For>
                            </select>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors border-t border-white/5">
                            <div class="flex items-start gap-4 flex-1">
                                <div class="p-2 rounded-lg bg-white/5">
                                    <Smartphone class="w-5 h-5 text-gray-400" />
                                </div>
                                <div class="flex-1">
                                    <p class="text-white font-medium">{t('settings.general.phoneNumber')}</p>
                                    <p class="text-gray-400 text-sm mt-0.5">{t('settings.general.phoneNumberDesc')}</p>

                                    <div class="mt-4 flex flex-col sm:flex-row gap-3 max-w-lg w-full">
                                        {/* Country Selector */}
                                        <div class="relative w-full sm:w-[220px]">
                                            <button
                                                onClick={() => setShowCountryDropdown(!showCountryDropdown())}
                                                class="w-full flex items-center justify-between px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white hover:bg-white/[0.08] transition-colors"
                                            >
                                                <div class="flex items-center gap-3 overflow-hidden">
                                                    <img src={selectedCountry().flag} class="w-5 h-3.5 object-cover rounded-sm border border-white/10" alt="" />
                                                    <span class="text-sm font-bold truncate">{selectedCountry().name}</span>
                                                </div>
                                                <div class="flex items-center gap-2 shrink-0">
                                                    <span class="text-[10px] font-black text-gray-500">{selectedCountry().dialCode}</span>
                                                    <ChevronDown class={`w-3 h-3 text-gray-500 transition-transform ${showCountryDropdown() ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>

                                            <Show when={showCountryDropdown()}>
                                                <div class="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1c] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden min-w-[280px]">
                                                    <div class="p-3 border-b border-white/10 flex items-center gap-2 bg-white/[0.02]">
                                                        <Search class="w-3.5 h-3.5 text-gray-500" />
                                                        <input
                                                            type="text"
                                                            placeholder={t('settings.general.searchCountry')}
                                                            onInput={(e) => setCountrySearchTerm(e.currentTarget.value)}
                                                            class="w-full bg-transparent text-xs outline-none text-white"
                                                            autofocus
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div class="max-h-[240px] overflow-y-auto custom-scrollbar">
                                                        <For each={countries
                                                            .filter(c =>
                                                                c.name.toLowerCase().includes(countrySearchTerm().toLowerCase()) ||
                                                                c.dialCode.includes(countrySearchTerm())
                                                            )
                                                            .sort((a, b) => a.name.localeCompare(b.name))}>
                                                            {(country) => (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedCountry(country);
                                                                        setShowCountryDropdown(false);
                                                                        setCountrySearchTerm("");
                                                                    }}
                                                                    class={`w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/[0.03] last:border-0 ${country.code === selectedCountry().code ? 'bg-blue-500/10' : ''}`}
                                                                >
                                                                    <div class="flex items-center gap-3">
                                                                        <img src={country.flag} class="w-5 h-3.5 object-cover rounded-sm border border-white/10" alt="" />
                                                                        <span class="text-[13px] font-medium text-gray-200">{country.name}</span>
                                                                    </div>
                                                                    <div class="flex items-center gap-2">
                                                                        <span class="text-[11px] font-mono text-gray-500">{country.dialCode}</span>
                                                                        <Show when={country.code === selectedCountry().code}>
                                                                            <Check class="w-3.5 h-3.5 text-blue-500" />
                                                                        </Show>
                                                                    </div>
                                                                </button>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>
                                                <div class="fixed inset-0 z-40" onClick={() => { setShowCountryDropdown(false); setCountrySearchTerm(""); }} />
                                            </Show>
                                        </div>

                                        {/* Phone Input Area */}
                                        <div class="flex flex-col sm:flex-row gap-2 w-full">
                                            <input
                                                type="tel"
                                                value={phone()}
                                                onInput={(e) => setPhone(e.currentTarget.value.replace(/[^0-9]/g, ''))}
                                                placeholder="01012345678"
                                                class="flex-1 px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 text-sm font-mono placeholder-gray-600 sm:min-w-0"
                                            />
                                            <button
                                                onClick={handleSavePhone}
                                                disabled={isSavingPhone() || !phone()}
                                                class={`w-full sm:w-auto h-[46px] sm:h-auto px-4 sm:px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${phoneSuccess()
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

                            {/* Logout Section */}
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                                <div class="flex items-start gap-4">
                                    <div class="p-2 rounded-lg bg-red-500/10">
                                        <LogOut class="w-5 h-5 text-red-500" />
                                    </div>
                                    <div>
                                        <p class="text-white font-medium">{t('settings.general.sessionManagement')}</p>
                                        <p class="text-gray-400 text-sm mt-0.5">{t('settings.general.sessionManagementDesc')}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (confirm(t('settings.general.logoutConfirm'))) {
                                            await auth.logout();
                                            window.location.href = 'https://www.visionchain.co';
                                        }
                                    }}
                                    class="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap"
                                >
                                    {t('settings.general.logoutButton')}
                                </button>
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
                        <h2 class="text-lg font-semibold text-white">{t('settings.presets.title')}</h2>
                    </div>
                    <div class="p-6 space-y-6">
                        <p class="text-gray-400 text-sm">
                            {t('settings.presets.description')}
                        </p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Primary Asset */}
                            <div>
                                <label class="text-white font-medium block mb-2">{t('settings.presets.primaryAsset')}</label>
                                <select
                                    value={primaryAsset()}
                                    onChange={(e) => setPrimaryAsset(e.currentTarget.value)}
                                    class="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                >
                                    <option value="VCN">VCN (Vision Chain)</option>
                                    <option value="USDC">USDC</option>
                                    <option value="USDT">USDT</option>
                                    <option value="ETH">Ethereum</option>
                                    <option value="WBTC">Wrapped BTC</option>
                                </select>
                            </div>

                            {/* Secondary Asset */}
                            <div>
                                <label class="text-white font-medium block mb-2">{t('settings.presets.secondaryAsset')}</label>
                                <select
                                    value={secondaryAsset()}
                                    onChange={(e) => setSecondaryAsset(e.currentTarget.value)}
                                    class="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                >
                                    <option value="USDC">USDC</option>
                                    <option value="VCN">VCN (Vision Chain)</option>
                                    <option value="USDT">USDT</option>
                                    <option value="ETH">Ethereum</option>
                                </select>
                            </div>

                            {/* Preferred Network */}
                            <div class="md:col-span-2">
                                <label class="text-white font-medium block mb-2">{t('settings.presets.preferredNetwork')}</label>
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
                                class="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 whitespace-nowrap"
                            >
                                {presetLoading() ? t('settings.presets.savingButton') : <><Save class="w-4 h-4" /> {t('settings.presets.saveButton')}</>}
                            </button>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Notifications Tab */}
            <Show when={activeTab() === 'notifications'}>
                {(() => { loadEmailPreferences(); return null; })()}
                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                    <div class="flex items-center justify-between p-6 border-b border-white/5">
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded-xl bg-cyan-500/20">
                                <Bell class="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h2 class="text-lg font-semibold text-white">{t('settings.notifications.emailPreferences')}</h2>
                                <p class="text-gray-500 text-xs mt-0.5">{t('settings.notifications.emailPreferencesDesc')}</p>
                            </div>
                        </div>
                        <Show when={emailPrefsLoading()}>
                            <div class="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                        </Show>
                    </div>

                    {/* Error */}
                    <Show when={emailPrefsError()}>
                        <div class="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
                            <AlertCircle class="w-4 h-4 text-red-400 flex-shrink-0" />
                            <span class="text-red-400 text-sm">{emailPrefsError()}</span>
                        </div>
                    </Show>

                    {/* Categories */}
                    <div class="divide-y divide-white/5">
                        <For each={emailCategories()}>
                            {(category) => {
                                const IconComponent = getCategoryIcon(category.key);
                                const isLocked = category.locked === true;
                                const isEnabled = () => emailPrefs()[category.key] !== false;
                                const isSaving = () => emailPrefsSaving() === category.key;

                                return (
                                    <div class={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 transition-colors ${isLocked ? 'bg-white/[0.01]' : 'hover:bg-white/[0.01]'}`}>
                                        <div class="flex items-start gap-4 flex-1 min-w-0">
                                            <div class={`p-2 rounded-lg shrink-0 ${isLocked
                                                ? 'bg-amber-500/10'
                                                : isEnabled()
                                                    ? 'bg-cyan-500/10'
                                                    : 'bg-white/5'
                                                }`}>
                                                <div class={isLocked ? 'text-amber-400' : isEnabled() ? 'text-cyan-400' : 'text-gray-500'}>
                                                    {IconComponent()}
                                                </div>
                                            </div>
                                            <div class="min-w-0">
                                                <div class="flex items-center gap-2">
                                                    <p class="text-white font-medium">{category.label}</p>
                                                    <Show when={isLocked}>
                                                        <span class="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-black rounded uppercase tracking-wider flex items-center gap-1">
                                                            <Lock class="w-2.5 h-2.5" />
                                                            Required
                                                        </span>
                                                    </Show>
                                                    <Show when={isSaving()}>
                                                        <div class="w-3.5 h-3.5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                                                    </Show>
                                                </div>
                                                <p class="text-gray-500 text-sm mt-0.5">{category.description}</p>
                                            </div>
                                        </div>
                                        <div class="shrink-0">
                                            <Show
                                                when={!isLocked}
                                                fallback={
                                                    <div class="w-12 h-6 rounded-full bg-amber-500/30 flex items-center justify-end px-1 cursor-not-allowed" title="Security emails cannot be disabled">
                                                        <div class="w-4 h-4 rounded-full bg-amber-400 shadow-lg" />
                                                    </div>
                                                }
                                            >
                                                <Toggle
                                                    checked={isEnabled()}
                                                    onChange={(val) => handleToggleEmailPref(category.key, val)}
                                                />
                                            </Show>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>

                    {/* Empty state */}
                    <Show when={!emailPrefsLoading() && emailCategories().length === 0 && !emailPrefsError()}>
                        <div class="p-12 text-center">
                            <Mail class="w-10 h-10 text-gray-600 mx-auto mb-3" />
                            <p class="text-gray-500 text-sm">No email categories available</p>
                        </div>
                    </Show>

                    {/* Push notifications section */}
                    <Show when={emailCategories().length > 0}>
                        <div class="border-t border-white/5">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                                <div class="flex items-start gap-4">
                                    <div class="p-2 rounded-lg bg-white/5">
                                        <Smartphone class="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div>
                                        <p class="text-white font-medium">{t('settings.notifications.pushNotifications')}</p>
                                        <p class="text-gray-500 text-sm mt-0.5">{t('settings.notifications.pushNotificationsDesc')}</p>
                                    </div>
                                </div>
                                <div class="w-12 h-6 rounded-full bg-white/5 flex items-center px-1 cursor-not-allowed opacity-50" title="Coming soon">
                                    <div class="w-4 h-4 rounded-full bg-gray-600 shadow-lg" />
                                </div>
                            </div>
                        </div>
                    </Show>
                </div>
            </Show>

            {/* Security Tab */}
            <Show when={activeTab() === 'security'}>
                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                    <div class="flex items-center gap-3 p-6 border-b border-white/5">
                        <div class="p-2 rounded-xl bg-cyan-500/20">
                            <Shield class="w-5 h-5 text-cyan-400" />
                        </div>
                        <h2 class="text-lg font-semibold text-white">{t('settings.security.title')}</h2>
                    </div>
                    <div class="divide-y divide-white/5">
                        {/* Two-Factor Authentication Section */}
                        <div class="p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div class="flex items-start gap-4">
                                    <div class={`p-2 rounded-lg ${totpEnabled() ? 'bg-green-500/10' : 'bg-white/5'}`}>
                                        <Key class={`w-5 h-5 ${totpEnabled() ? 'text-green-400' : 'text-gray-400'}`} />
                                    </div>
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2">
                                            <p class="text-white font-medium">{t('settings.security.twoFactor')}</p>
                                            <Show when={totpEnabled()}>
                                                <span class="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full uppercase">Active</span>
                                            </Show>
                                        </div>
                                        <p class="text-gray-400 text-sm mt-0.5">
                                            Use Google Authenticator for additional security when restoring your wallet from cloud.
                                        </p>
                                        <Show when={totpEnabled() && backupCodesRemaining() > 0}>
                                            <p class="text-amber-400 text-xs mt-1">
                                                {backupCodesRemaining()} backup codes remaining
                                            </p>
                                        </Show>
                                    </div>
                                </div>
                            </div>

                            {/* Success/Error Messages */}
                            <Show when={totpSuccess()}>
                                <div class="mt-4 ml-0 sm:ml-14 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2">
                                    <Check class="w-4 h-4 text-green-400" />
                                    <span class="text-green-400 text-sm">{totpSuccess()}</span>
                                </div>
                            </Show>
                            <Show when={totpError()}>
                                <div class="mt-4 ml-0 sm:ml-14 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
                                    <AlertCircle class="w-4 h-4 text-red-400" />
                                    <span class="text-red-400 text-sm">{totpError()}</span>
                                </div>
                            </Show>

                            {/* 2FA Setup Flow */}
                            <div class="mt-4 ml-0 sm:ml-14 space-y-4">
                                <Show when={!totpEnabled() && !totpSetupMode()}>
                                    <button
                                        onClick={handleSetupTOTP}
                                        disabled={totpLoading()}
                                        class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:scale-[1.02] active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Show when={totpLoading()} fallback={<><Shield class="w-4 h-4" /> {t('settings.security.totpEnable')}</>}>
                                            <RefreshCw class="w-4 h-4 animate-spin" /> Setting up...
                                        </Show>
                                    </button>
                                </Show>

                                {/* QR Code Setup Mode */}
                                <Show when={totpSetupMode()}>
                                    <div class="p-6 bg-white/[0.03] rounded-2xl border border-white/10 space-y-6">
                                        <div class="text-center space-y-4">
                                            <h3 class="text-lg font-bold text-white">{t('settings.security.totpScanQR')}</h3>
                                            <p class="text-gray-400 text-sm">Open Google Authenticator and scan this QR code</p>

                                            {/* QR Code */}
                                            <div class="inline-block p-4 bg-white rounded-2xl">
                                                <img src={totpQrCode()} alt="2FA QR Code" class="w-48 h-48" />
                                            </div>

                                            {/* Manual Entry Secret */}
                                            <div class="p-4 bg-black/30 rounded-xl border border-white/10">
                                                <p class="text-gray-500 text-[10px] uppercase tracking-widest mb-2">Manual Entry Code</p>
                                                <div class="flex items-center justify-center gap-2">
                                                    <code class="text-cyan-400 font-mono text-sm tracking-wider">{totpSecret()}</code>
                                                    <button
                                                        onClick={() => {
                                                            copyToClipboard(totpSecret());
                                                            setTotpSuccess('Secret copied!');
                                                            setTimeout(() => setTotpSuccess(''), 2000);
                                                        }}
                                                        class="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                                    >
                                                        <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Verification Code Input */}
                                        <div class="space-y-3">
                                            <label class="text-gray-400 text-sm block">{t('settings.security.totpEnterCode')}</label>
                                            <input
                                                type="text"
                                                value={totpCode()}
                                                onInput={(e) => setTotpCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                                                placeholder="000000"
                                                maxLength={6}
                                                class="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-center text-2xl font-mono tracking-[0.3em] placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                                            />
                                        </div>

                                        <div class="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => {
                                                    setTotpSetupMode(false);
                                                    setTotpQrCode('');
                                                    setTotpSecret('');
                                                    setTotpCode('');
                                                    setTotpError('');
                                                }}
                                                class="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-all"
                                            >
                                                {t('common.cancel')}
                                            </button>
                                            <button
                                                onClick={handleEnableTOTP}
                                                disabled={totpCode().length !== 6 || totpLoading()}
                                                class="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:scale-[1.02] active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Show when={totpLoading()} fallback={<><Check class="w-4 h-4" /> Verify & Enable</>}>
                                                    <RefreshCw class="w-4 h-4 animate-spin" /> Verifying...
                                                </Show>
                                            </button>
                                        </div>
                                    </div>
                                </Show>

                                {/* Backup Codes Display */}
                                <Show when={showBackupCodes() && backupCodes().length > 0}>
                                    <div class="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/30 space-y-4">
                                        <div class="flex items-start gap-3">
                                            <AlertCircle class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                            <div>
                                                <h3 class="text-amber-400 font-bold">{t('settings.security.totpBackupCodes')}</h3>
                                                <p class="text-amber-300/70 text-sm mt-1">
                                                    {t('settings.security.totpBackupCodesWarning')}
                                                </p>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <For each={backupCodes()}>
                                                {(code) => (
                                                    <div class="p-2 bg-black/30 rounded-lg text-center">
                                                        <code class="text-white font-mono text-sm">{code}</code>
                                                    </div>
                                                )}
                                            </For>
                                        </div>

                                        <div class="flex flex-col sm:flex-row gap-2">
                                            <button
                                                onClick={() => {
                                                    copyToClipboard(backupCodes().join('\n'));
                                                    setTotpSuccess('Backup codes copied!');
                                                    setTimeout(() => setTotpSuccess(''), 2000);
                                                }}
                                                class="flex-1 px-4 py-2 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                                            >
                                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                Copy All
                                            </button>
                                            <button
                                                onClick={() => setShowBackupCodes(false)}
                                                class="flex-1 px-4 py-2 bg-amber-500/20 text-amber-400 font-medium rounded-xl hover:bg-amber-500/30 transition-all"
                                            >
                                                I've Saved My Codes
                                            </button>
                                        </div>
                                    </div>
                                </Show>

                                {/* 2FA Enabled - Show Disable Option */}
                                <Show when={totpEnabled() && !totpSetupMode() && !showBackupCodes()}>
                                    <Show when={!totpDisableMode()}>
                                        <button
                                            onClick={() => setTotpDisableMode(true)}
                                            class="w-full sm:w-auto px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-400 font-bold rounded-xl hover:bg-red-500/20 transition-all"
                                        >
                                            {t('settings.security.totpDisable')}
                                        </button>
                                    </Show>

                                    <Show when={totpDisableMode()}>
                                        <div class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-4">
                                            <p class="text-red-400 text-sm">Enter your authenticator code or backup code to disable 2FA:</p>
                                            <div class="flex flex-col sm:flex-row gap-3">
                                                <input
                                                    type="text"
                                                    value={totpDisableCode()}
                                                    onInput={(e) => setTotpDisableCode(e.currentTarget.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                                                    placeholder="Enter code"
                                                    class="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-center tracking-wider placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                                                />
                                                <button
                                                    onClick={handleDisableTOTP}
                                                    disabled={totpDisableCode().length < 6 || totpLoading()}
                                                    class="px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Show when={totpLoading()} fallback="Disable">
                                                        <RefreshCw class="w-4 h-4 animate-spin" />
                                                    </Show>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setTotpDisableMode(false);
                                                        setTotpDisableCode('');
                                                        setTotpError('');
                                                    }}
                                                    class="px-4 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all"
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    </Show>
                                </Show>
                            </div>
                        </div>

                        {/* Cloud Wallet Sync */}
                        <div class="p-6 hover:bg-white/[0.01] transition-colors">
                            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div class="flex items-start gap-4">
                                    <div class="p-2 rounded-lg bg-blue-500/10">
                                        <Cloud class="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p class="text-white font-medium">{t('settings.security.cloudSync')}</p>
                                        <p class="text-gray-400 text-sm mt-0.5">
                                            Backup your wallet to the cloud for cross-browser access.
                                            Your wallet is protected by double encryption.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Cloud Sync Form */}
                            <div class="mt-4 ml-0 sm:ml-14 space-y-4">
                                <Show when={cloudSyncStatus() === 'synced'}>
                                    <div class="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
                                        <Check class="w-5 h-5 text-green-400" />
                                        <div>
                                            <p class="text-green-400 font-medium">{t('settings.security.cloudSynced')}</p>
                                            <p class="text-green-300/60 text-xs">You can access your wallet from any browser</p>
                                        </div>
                                    </div>
                                </Show>

                                <Show when={cloudSyncStatus() !== 'synced'}>
                                    <div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                        <p class="text-amber-400 text-sm mb-3">
                                            Enter your wallet password to backup to cloud:
                                        </p>
                                        <div class="flex flex-col sm:flex-row gap-3">
                                            <input
                                                type="password"
                                                value={cloudSyncPassword()}
                                                onInput={(e) => setCloudSyncPassword(e.currentTarget.value)}
                                                placeholder="Wallet password"
                                                class="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                                            />
                                            <button
                                                onClick={handleCloudSync}
                                                disabled={!cloudSyncPassword() || cloudSyncLoading()}
                                                class="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl hover:scale-[1.02] active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                                            >
                                                <Show when={cloudSyncLoading()} fallback={<><Cloud class="w-4 h-4" /> Sync to Cloud</>}>
                                                    <RefreshCw class="w-4 h-4 animate-spin" /> Syncing...
                                                </Show>
                                            </button>
                                        </div>

                                        {/* Password Strength */}
                                        <Show when={cloudSyncPassword()}>
                                            {(() => {
                                                const strength = calculatePasswordStrength(cloudSyncPassword());
                                                return (
                                                    <div class="mt-3">
                                                        <div class="flex gap-1 mb-1">
                                                            {[1, 2, 3, 4].map((i) => (
                                                                <div class={`h-1 flex-1 rounded-full ${i <= strength.score ? (strength.isStrongEnough ? 'bg-green-500' : 'bg-amber-500') : 'bg-white/10'}`} />
                                                            ))}
                                                        </div>
                                                        <p class={`text-xs ${strength.isStrongEnough ? 'text-green-400' : 'text-amber-400'}`}>
                                                            {strength.isStrongEnough
                                                                ? 'Password is strong enough for cloud sync'
                                                                : `Password needs: ${strength.length < 10 ? '10+ chars, ' : ''}${strength.score < 3 ? '3+ of (upper/lower/number/special)' : ''}`}
                                                        </p>
                                                    </div>
                                                );
                                            })()}
                                        </Show>

                                        {/* Error */}
                                        <Show when={cloudSyncError()}>
                                            <div class="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                                <p class="text-red-400 text-sm">{cloudSyncError()}</p>
                                            </div>
                                        </Show>
                                    </div>
                                </Show>
                            </div>
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
                        <h2 class="text-lg font-semibold text-white">{t('settings.password.title')}</h2>
                    </div>
                    <form onSubmit={handleChangePassword} class="p-6 space-y-6">
                        {/* Current Password */}
                        <div>
                            <label class="text-gray-400 text-sm mb-2 block">{t('settings.password.currentPassword')}</label>
                            <div class="relative">
                                <input
                                    type={showCurrentPassword() ? 'text' : 'password'}
                                    value={currentPassword()}
                                    onInput={(e) => setCurrentPassword(e.currentTarget.value)}
                                    placeholder={t('settings.password.currentPasswordPlaceholder')}
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
                            <label class="text-gray-400 text-sm mb-2 block">{t('settings.password.newPassword')}</label>
                            <div class="relative">
                                <input
                                    type={showNewPassword() ? 'text' : 'password'}
                                    value={newPassword()}
                                    onInput={(e) => setNewPassword(e.currentTarget.value)}
                                    placeholder={t('settings.password.newPasswordPlaceholder')}
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
                            <label class="text-gray-400 text-sm mb-2 block">{t('settings.password.confirmPassword')}</label>
                            <div class="relative">
                                <input
                                    type={showConfirmPassword() ? 'text' : 'password'}
                                    value={confirmPassword()}
                                    onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                                    placeholder={t('settings.password.confirmPasswordPlaceholder')}
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
                                {t('settings.password.success')}
                            </div>
                        </Show>

                        <button
                            type="submit"
                            disabled={passwordLoading()}
                            class="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Show when={passwordLoading()} fallback={<><Save class="w-4 h-4" /> {t('settings.password.changeButton')}</>}>
                                <RefreshCw class="w-4 h-4 animate-spin" /> {t('settings.password.changing')}
                            </Show>
                        </button>
                    </form>
                </div>
            </Show>
        </div>
    );
}
