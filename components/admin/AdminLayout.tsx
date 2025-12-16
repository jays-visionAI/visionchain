import { createSignal, Show, For } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { Menu, X, ChevronRight, ChevronDown, LogOut } from 'lucide-solid';
import { adminMenuConfig, getIconComponent, getSortedMenuItems, AdminMenuItem } from './adminMenuConfig';

interface AdminLayoutProps {
    children?: any;
}

export default function AdminLayout(props: AdminLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);
    const [expandedMenus, setExpandedMenus] = createSignal<Set<string>>(new Set());
    const location = useLocation();

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
