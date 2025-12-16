import { createSignal, Show, For, onMount } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { Menu, X, ChevronRight, ChevronDown, LogOut, Lock, Eye, EyeOff } from 'lucide-solid';
import { adminMenuConfig, getIconComponent, getSortedMenuItems, AdminMenuItem } from './adminMenuConfig';

// Simple admin password (임시 비밀번호)
const DEFAULT_PASSWORD = 'visionchain2024';
const AUTH_KEY = 'visionchain_admin_auth';
const PASSWORD_STORAGE_KEY = 'visionchain_admin_password';

// Get current password (from localStorage or default)
const getAdminPassword = (): string => {
    const saved = localStorage.getItem(PASSWORD_STORAGE_KEY);
    return saved || DEFAULT_PASSWORD;
};

interface AdminLayoutProps {
    children?: any;
}

export default function AdminLayout(props: AdminLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);
    const [expandedMenus, setExpandedMenus] = createSignal<Set<string>>(new Set());
    const [isAuthenticated, setIsAuthenticated] = createSignal(false);
    const [password, setPassword] = createSignal('');
    const [showPassword, setShowPassword] = createSignal(false);
    const [authError, setAuthError] = createSignal('');
    const location = useLocation();

    // Check if already authenticated on mount
    onMount(() => {
        const auth = sessionStorage.getItem(AUTH_KEY);
        if (auth === 'true') {
            setIsAuthenticated(true);
        }
    });

    const handleLogin = (e: Event) => {
        e.preventDefault();
        const currentPassword = getAdminPassword();
        if (password() === currentPassword) {
            setIsAuthenticated(true);
            sessionStorage.setItem(AUTH_KEY, 'true');
            setAuthError('');
        } else {
            setAuthError('Invalid password');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem(AUTH_KEY);
    };

    const isActive = (path: string) => {
        if (path === '/admin') {
            return location.pathname === '/admin';
        }
        return location.pathname.startsWith(path);
    };

    const toggleExpanded = (id: string) => {
        setExpandedMenus(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const isExpanded = (id: string) => expandedMenus().has(id);

    // Login Screen
    if (!isAuthenticated()) {
        return (
            <div class="min-h-screen bg-[#050505] flex items-center justify-center p-4">
                <div class="w-full max-w-md">
                    <div class="rounded-2xl bg-white/[0.02] border border-white/10 p-8 backdrop-blur-xl">
                        <div class="text-center mb-8">
                            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
                                <Lock class="w-8 h-8 text-cyan-400" />
                            </div>
                            <h1 class="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                Vision Chain Admin
                            </h1>
                            <p class="text-gray-400 mt-2">Enter password to continue</p>
                        </div>

                        <form onSubmit={handleLogin} class="space-y-4">
                            <div>
                                <label class="text-gray-400 text-sm mb-1 block">Password</label>
                                <div class="relative">
                                    <input
                                        type={showPassword() ? 'text' : 'password'}
                                        value={password()}
                                        onInput={(e) => setPassword(e.currentTarget.value)}
                                        placeholder="Enter admin password"
                                        class="w-full p-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                                        autofocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword())}
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        <Show when={showPassword()} fallback={<Eye class="w-4 h-4" />}>
                                            <EyeOff class="w-4 h-4" />
                                        </Show>
                                    </button>
                                </div>
                            </div>

                            <Show when={authError()}>
                                <div class="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                                    {authError()}
                                </div>
                            </Show>

                            <button
                                type="submit"
                                class="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                            >
                                Login
                            </button>
                        </form>

                        <div class="mt-6 pt-6 border-t border-white/5 text-center">
                            <a href="/" class="text-gray-400 hover:text-cyan-400 text-sm transition-colors">
                                ← Back to Home
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render a single menu item
    const MenuItem = (props: { item: AdminMenuItem; depth?: number }) => {
        const { item, depth = 0 } = props;
        const hasChildren = item.children && item.children.length > 0;
        const Icon = getIconComponent(item.icon);
        const paddingLeft = depth > 0 ? `${16 + depth * 12}px` : '16px';

        return (
            <div>
                <Show when={hasChildren} fallback={
                    <A
                        href={item.path}
                        onClick={() => setIsSidebarOpen(false)}
                        class={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive(item.path)
                            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        style={{ "padding-left": paddingLeft }}
                    >
                        <Icon class={`w-5 h-5 ${isActive(item.path) ? 'text-cyan-400' : 'group-hover:text-cyan-400'}`} />
                        <span class="font-medium">{item.label}</span>
                        <Show when={item.badge}>
                            <span class="ml-auto text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full font-medium">
                                {item.badge}
                            </span>
                        </Show>
                        <Show when={isActive(item.path) && !item.badge}>
                            <ChevronRight class="w-4 h-4 ml-auto" />
                        </Show>
                    </A>
                }>
                    {/* Parent menu with children */}
                    <button
                        onClick={() => toggleExpanded(item.id)}
                        class={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive(item.path)
                            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        style={{ "padding-left": paddingLeft }}
                    >
                        <Icon class={`w-5 h-5 ${isActive(item.path) ? 'text-cyan-400' : 'group-hover:text-cyan-400'}`} />
                        <span class="font-medium">{item.label}</span>
                        <ChevronDown
                            class={`w-4 h-4 ml-auto transition-transform duration-200 ${isExpanded(item.id) ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Children */}
                    <Show when={isExpanded(item.id)}>
                        <div class="mt-1 space-y-1">
                            <For each={item.children}>
                                {(child) => <MenuItem item={child} depth={depth + 1} />}
                            </For>
                        </div>
                    </Show>
                </Show>
            </div>
        );
    };

    const menuItems = getSortedMenuItems();

    return (
        <div class="min-h-screen bg-[#0a0a0f] text-white">
            {/* Mobile Header */}
            <div class="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-4">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen())}
                    class="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <Show when={isSidebarOpen()} fallback={<Menu class="w-5 h-5" />}>
                        <X class="w-5 h-5" />
                    </Show>
                </button>
                <span class="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    Vision Chain Admin
                </span>
                <div class="w-9" />
            </div>

            {/* Sidebar Overlay */}
            <Show when={isSidebarOpen()}>
                <div
                    class="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    onClick={() => setIsSidebarOpen(false)}
                />
            </Show>

            {/* Sidebar */}
            <aside
                class={`fixed top-0 left-0 h-full w-64 bg-[#0d0d14] border-r border-white/5 z-50 transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen() ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Logo */}
                <div class="h-16 flex items-center px-6 border-b border-white/5">
                    <span class="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                        Vision Chain Admin
                    </span>
                </div>

                {/* Navigation */}
                <nav class="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-140px)]">
                    <For each={menuItems}>
                        {(item) => <MenuItem item={item} />}
                    </For>
                </nav>

                {/* Bottom Section */}
                <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
                    <A
                        href="/"
                        class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
                    >
                        <LogOut class="w-5 h-5" />
                        <span class="font-medium">Back to Site</span>
                    </A>
                </div>
            </aside>

            {/* Main Content */}
            <main class="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
                <div class="p-6 lg:p-8">
                    {props.children}
                </div>
            </main>
        </div>
    );
}
