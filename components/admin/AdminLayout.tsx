import { createSignal, Show, For, onMount } from 'solid-js';
import { A, useLocation, useNavigate } from '@solidjs/router';
import { Menu, X, ChevronRight, ChevronDown, LogOut, Shield, Activity, Globe } from 'lucide-solid';
import { adminMenuConfig, getIconComponent, getSortedMenuItems, AdminMenuItem } from './adminMenuConfig';
import { useAuth } from '../auth/authContext';

interface AdminLayoutProps {
    children?: any;
}

export default function AdminLayout(props: AdminLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);
    const [expandedMenus, setExpandedMenus] = createSignal<Set<string>>(new Set());
    const location = useLocation();
    const navigate = useNavigate();
    const auth = useAuth();

    // Redirect to login if not authenticated
    onMount(() => {
        if (!auth.loading() && !auth.user()) {
            navigate('/login', { replace: true });
        }
    });

    // Watch for auth state changes
    const checkAuth = () => {
        if (!auth.loading() && !auth.user()) {
            navigate('/login', { replace: true });
        }
    };

    // Check auth on every render
    if (!auth.loading() && !auth.user()) {
        navigate('/login', { replace: true });
        return null;
    }

    const handleLogout = async () => {
        await auth.logout();
        navigate('/login', { replace: true });
    };

    const isActive = (path: string) => {
        if (path === '/adminsystem') {
            return location.pathname === '/adminsystem';
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
                        class={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive(item.path)
                            ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/5 text-cyan-400'
                            : 'text-gray-400/80 hover:text-white hover:bg-white/[0.03]'
                            }`}
                        style={{ "padding-left": paddingLeft }}
                    >
                        <Show when={isActive(item.path)}>
                            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-cyan-500 rounded-r-full shadow-[0_0_12px_rgba(6,182,212,0.5)]" />
                        </Show>
                        <Icon class={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${isActive(item.path) ? 'text-cyan-400' : 'group-hover:text-cyan-400'}`} />
                        <span class="font-bold text-[13px] tracking-tight">{item.label}</span>
                        <Show when={item.badge}>
                            <span class="ml-auto text-[9px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-md font-black uppercase tracking-tighter">
                                {item.badge}
                            </span>
                        </Show>
                        <Show when={isActive(item.path) && !item.badge}>
                            <div class="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
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
        <Show
            when={!auth.loading()}
            fallback={
                <div class="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                    <div class="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                </div>
            }
        >
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
                    class={`fixed top-0 left-0 h-full w-64 bg-[#08080c]/80 backdrop-blur-2xl border-r border-white/5 z-50 transform transition-all duration-500 lg:translate-x-0 ${isSidebarOpen() ? 'translate-x-0 shadow-2xl shadow-cyan-500/10' : '-translate-x-full'
                        }`}
                >
                    {/* Glowing Accent */}
                    <div class="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />

                    {/* Logo Section */}
                    <div class="h-20 flex items-center px-6 relative overflow-hidden">
                        <div class="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent opacity-50" />
                        <div class="relative flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                <Shield class="w-5 h-5 text-white" />
                            </div>
                            <span class="text-lg font-black tracking-tight bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent italic uppercase">
                                Vision<span class="text-cyan-400">HQ</span>
                            </span>
                        </div>
                    </div>

                    {/* Navigation Container */}
                    <div class="px-3 py-4 overflow-y-auto h-[calc(100vh-220px)] custom-scrollbar">
                        <div class="mb-4 px-3 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Management</div>
                        <nav class="space-y-1.5 px-1">
                            <For each={menuItems}>
                                {(item) => <MenuItem item={item} />}
                            </For>
                        </nav>
                    </div>

                    {/* Bottom Utility Section */}
                    <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5 bg-[#08080c]/40 backdrop-blur-md">
                        {/* System Status Indicator */}
                        <div class="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">System Status</span>
                                <div class="flex items-center gap-1.5">
                                    <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span class="text-[10px] font-bold text-green-400 uppercase">Online</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <Activity class="w-3.5 h-3.5 text-cyan-400 opacity-50" />
                                <div class="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                    <div class="h-full w-[85%] bg-gradient-to-r from-cyan-500 to-blue-500" />
                                </div>
                            </div>
                        </div>

                        <A
                            href="/"
                            class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
                        >
                            <Globe class="w-5 h-5 group-hover:text-cyan-400" />
                            <span class="font-medium text-sm">Public Website</span>
                            <ChevronRight class="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                        </A>

                        <button
                            onClick={handleLogout}
                            class="w-full flex items-center gap-3 px-4 py-3 mt-1 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all duration-300"
                        >
                            <LogOut class="w-5 h-5" />
                            <span class="font-medium text-sm">Logout Session</span>
                        </button>
                    </div>
                </aside>


                {/* Main Content */}
                <main class="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
                    <div class="p-6 lg:p-8">
                        {props.children}
                    </div>
                </main>
            </div>
        </Show>
    );
}
