import { Show, For } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import {
    Sparkles,
    PieChart,
    Camera,
    Zap,
    Plus,
    Users,
    User,
    Settings,
    Wallet as WalletIcon,
    Copy,
    Check,
    LogOut,
    X,
    Clock
} from 'lucide-solid';

export type ViewType = 'chat' | 'assets' | 'campaign' | 'mint' | 'profile' | 'settings' | 'contacts' | 'nodes' | 'history';

interface WalletSidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    activeView: string;
    setActiveView: (view: string) => void;
    onboardingStep: number;
    userProfile: { email: string };
    shortAddress: string;
    copyAddress: () => void;
    copied: boolean;
    onLogout: () => void;
    isAdmin?: boolean;
    networkMode: 'mainnet' | 'testnet';
    setNetworkMode: (mode: 'mainnet' | 'testnet') => void;
}

export const WalletSidebar = (props: WalletSidebarProps) => {
    const allMenuItems = [
        { id: 'chat' as ViewType, label: 'Chat', icon: Sparkles },
        { id: 'assets' as ViewType, label: 'My Assets', icon: PieChart },
        { id: 'nodes' as ViewType, label: 'Nodes', icon: Camera },
        { id: 'campaign' as ViewType, label: 'Campaign', icon: Zap },
        { id: 'mint' as ViewType, label: 'Mint', icon: Plus },
        { id: 'contacts' as ViewType, label: 'Address Book', icon: Users },
        { id: 'history' as ViewType, label: 'History', icon: Clock },
        { id: 'profile' as ViewType, label: 'Profile', icon: User },
        { id: 'settings' as ViewType, label: 'Settings', icon: Settings },
    ];

    const menuItems = () => allMenuItems;

    return (
        <Presence>
            <Show when={props.sidebarOpen}>
                <Motion.aside
                    initial={{ x: -280, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -280, opacity: 0 }}
                    transition={{ duration: 0.4, easing: [0.25, 1, 0.5, 1] }}
                    class="fixed lg:hidden inset-y-0 left-0 z-40 w-[280px] bg-[#0c0c0e] border-r border-white/10 shadow-2xl safe-area-left flex flex-col"
                >
                    {/* Reuse content for mobile sidebar */}
                    <SidebarContent {...props} menuItems={menuItems()} />
                </Motion.aside>
            </Show>

            {/* Desktop Sidebar - Always Visible */}
            <div class="hidden lg:flex fixed inset-y-0 left-0 z-30 w-[280px] bg-[#0c0c0e] border-r border-white/10 flex-col">
                <SidebarContent {...props} menuItems={menuItems()} isDesktop />
            </div>
        </Presence>
    );
};

// Internal Component to avoid duplication between Mobile/Desktop wrapper
const SidebarContent = (props: WalletSidebarProps & { menuItems: any[], isDesktop?: boolean }) => {
    return (
        <>
            {/* Header */}
            <div class={`${props.isDesktop ? 'h-[88px] pt-4' : 'h-[110px] pt-10'} shrink-0 flex items-center px-8 border-b border-white/[0.06] relative z-20 bg-[#0c0c0e]/80 backdrop-blur-xl`}>
                <div class="flex flex-col">
                    <span class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Vision Chain
                    </span>
                    <button
                        onClick={() => props.setNetworkMode(props.networkMode === 'mainnet' ? 'testnet' : 'mainnet')}
                        class={`mt-0.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all self-start ${props.networkMode === 'testnet'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                            : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                            }`}
                    >
                        <div class={`w-1 h-1 rounded-full animate-pulse ${props.networkMode === 'testnet' ? 'bg-amber-400' : 'bg-green-400'}`} />
                        {props.networkMode === 'testnet' ? 'Testnet 전환됨' : 'Mainnet'}
                    </button>
                </div>
                <Show when={!props.isDesktop}>
                    <button
                        onClick={() => props.setSidebarOpen(false)}
                        class="ml-auto p-2 text-gray-400 hover:text-white"
                    >
                        <X class="w-5 h-5" />
                    </button>
                </Show>
            </div>

            {/* Navigation */}
            <nav class="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                <For each={props.menuItems}>
                    {(item) => (
                        <button
                            onClick={() => {
                                if (props.onboardingStep === 0) {
                                    props.setActiveView(item.id);
                                    if (!props.isDesktop) props.setSidebarOpen(false);
                                }
                            }}
                            disabled={props.onboardingStep > 0 && item.id !== 'profile'}
                            class={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all group border-none cursor-pointer ${props.activeView === item.id
                                ? 'bg-white/[0.08] text-white shadow-lg shadow-black/20'
                                : 'text-gray-400 hover:bg-white/[0.04] hover:text-white bg-transparent'
                                } ${props.onboardingStep > 0 && item.id !== 'profile' ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                            <div class={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${props.activeView === item.id
                                ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20'
                                : 'bg-white/[0.03] group-hover:bg-white/[0.06]'
                                }`}
                            >
                                <item.icon class={`w-4 h-4 ${props.activeView === item.id ? 'text-cyan-400' : ''}`} />
                            </div>
                            <span class="font-medium text-[14px]">{item.label}</span>
                            <Show when={props.activeView === item.id}>
                                <div class="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            </Show>
                        </button>
                    )}
                </For>
            </nav>

            {/* Wallet Card / User Info */}
            <div class="p-4 border-t border-white/[0.06] mt-auto shrink-0 bg-[#0c0c0e] relative z-20">
                <div class="relative overflow-hidden p-4 bg-gradient-to-br from-white/[0.04] to-white/[0.02] rounded-2xl border border-white/[0.06]">
                    <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl" />
                    <div class="relative flex items-center gap-3">
                        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <WalletIcon class="w-5 h-5 text-white" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Logged in as</div>
                            <div class="text-[12px] font-bold text-white truncate mb-1" title={props.userProfile.email}>
                                {props.userProfile.email || 'Loading...'}
                            </div>
                            <div class="flex items-center gap-1.5 pt-1.5 border-t border-white/10">
                                <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                <span class="text-[11px] text-gray-400 font-mono">{props.shortAddress || 'Not Created'}</span>
                                <Show when={props.shortAddress}>
                                    <button onClick={props.copyAddress} class="p-1 hover:bg-white/10 rounded-md transition-colors ml-auto">
                                        <Show when={props.copied} fallback={<Copy class="w-3 h-3 text-gray-500" />}>
                                            <Check class="w-3 h-3 text-green-400" />
                                        </Show>
                                    </button>
                                </Show>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={props.onLogout}
                        class="w-full flex items-center justify-center gap-2 mt-4 px-4 py-2.5 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-500/80 hover:text-red-500 transition-all duration-300 group"
                    >
                        <LogOut class="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span class="font-bold text-[11px] uppercase tracking-wider">Logout Session</span>
                    </button>
                </div>
            </div>
        </>
    );
};
