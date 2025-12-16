import { createSignal, For } from 'solid-js';
import {
    Settings,
    Bell,
    Shield,
    Globe,
    Moon,
    Mail,
    Smartphone,
    Key,
    Save
} from 'lucide-solid';

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

export default function AdminSettings() {
    const [emailNotifications, setEmailNotifications] = createSignal(true);
    const [pushNotifications, setPushNotifications] = createSignal(false);
    const [twoFactorAuth, setTwoFactorAuth] = createSignal(true);
    const [darkMode, setDarkMode] = createSignal(true);

    const settingsSections = [
        {
            title: 'General',
            icon: Settings,
            settings: [
                {
                    label: 'Dark Mode',
                    description: 'Enable dark theme across the admin panel',
                    icon: Moon,
                    value: darkMode,
                    onChange: setDarkMode,
                },
                {
                    label: 'Language',
                    description: 'Choose your preferred language',
                    icon: Globe,
                    type: 'select',
                    options: ['English', 'Korean', 'Japanese', 'Chinese'],
                },
            ],
        },
        {
            title: 'Notifications',
            icon: Bell,
            settings: [
                {
                    label: 'Email Notifications',
                    description: 'Receive important updates via email',
                    icon: Mail,
                    value: emailNotifications,
                    onChange: setEmailNotifications,
                },
                {
                    label: 'Push Notifications',
                    description: 'Get instant notifications on your device',
                    icon: Smartphone,
                    value: pushNotifications,
                    onChange: setPushNotifications,
                },
            ],
        },
        {
            title: 'Security',
            icon: Shield,
            settings: [
                {
                    label: 'Two-Factor Authentication',
                    description: 'Add an extra layer of security to your account',
                    icon: Key,
                    value: twoFactorAuth,
                    onChange: setTwoFactorAuth,
                },
            ],
        },
    ];

    return (
        <div class="space-y-8">
            {/* Header */}
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-bold text-white">Settings</h1>
                    <p class="text-gray-400 mt-1">Manage your admin preferences.</p>
                </div>
                <button class="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300">
                    <Save class="w-4 h-4" />
                    Save Changes
                </button>
            </div>

            {/* Settings Sections */}
            <div class="space-y-6">
                <For each={settingsSections}>
                    {(section) => (
                        <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                            {/* Section Header */}
                            <div class="flex items-center gap-3 p-6 border-b border-white/5">
                                <div class="p-2 rounded-xl bg-cyan-500/20">
                                    <section.icon class="w-5 h-5 text-cyan-400" />
                                </div>
                                <h2 class="text-lg font-semibold text-white">{section.title}</h2>
                            </div>

                            {/* Settings List */}
                            <div class="divide-y divide-white/5">
                                <For each={section.settings}>
                                    {(setting) => (
                                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-white/[0.01] transition-colors">
                                            <div class="flex items-start gap-4">
                                                <div class="p-2 rounded-lg bg-white/5">
                                                    <setting.icon class="w-5 h-5 text-gray-400" />
                                                </div>
                                                <div>
                                                    <p class="text-white font-medium">{setting.label}</p>
                                                    <p class="text-gray-400 text-sm mt-0.5">{setting.description}</p>
                                                </div>
                                            </div>

                                            {setting.type === 'select' ? (
                                                <select class="appearance-none px-4 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer">
                                                    <For each={setting.options}>
                                                        {(option) => <option value={option}>{option}</option>}
                                                    </For>
                                                </select>
                                            ) : (
                                                <Toggle
                                                    checked={setting.value?.() ?? false}
                                                    onChange={setting.onChange ?? (() => { })}
                                                />
                                            )}
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    )}
                </For>
            </div>

            {/* Danger Zone */}
            <div class="rounded-2xl bg-red-500/5 border border-red-500/20 overflow-hidden">
                <div class="flex items-center gap-3 p-6 border-b border-red-500/20">
                    <div class="p-2 rounded-xl bg-red-500/20">
                        <Shield class="w-5 h-5 text-red-400" />
                    </div>
                    <h2 class="text-lg font-semibold text-white">Danger Zone</h2>
                </div>

                <div class="p-6">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p class="text-white font-medium">Delete Account</p>
                            <p class="text-gray-400 text-sm mt-0.5">Permanently delete your admin account and all data</p>
                        </div>
                        <button class="px-5 py-2.5 bg-red-500/20 text-red-400 font-medium rounded-xl border border-red-500/30 hover:bg-red-500/30 transition-colors">
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
