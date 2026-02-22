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
    UserPlus,
    Settings,
    Wallet as WalletIcon,
    Copy,
    Check,
    LogOut,
    X,
    Clock,
    Bell,
    ArrowLeftRight,
    Shield,
    BarChart3,
    Bot
} from 'lucide-solid';
import { VisionLogo } from './VisionLogo';
import { VisionFullLogo } from './VisionFullLogo';

export type ViewType = 'chat' | 'assets' | 'campaign' | 'mint' | 'profile' | 'settings' | 'contacts' | 'nodes' | 'notifications' | 'referral' | 'history' | 'quest' | 'bridge' | 'staking' | 'cex' | 'agent' | 'insight';

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
    unreadCount: number;
}

export const WalletSidebar = (props: WalletSidebarProps) => {
    const AiChatIcon = (props: { class?: string }) => (
        <svg viewBox="0 0 24 24" fill="currentColor" class={props.class} xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM12 6L13.5 9.5L17 11L13.5 12.5L12 16L10.5 12.5L7 11L10.5 9.5L12 6Z" />
        </svg>
    );

    const allMenuItems = [
        { id: 'chat' as ViewType, label: 'Chat', icon: AiChatIcon },
        { id: 'assets' as ViewType, label: 'My Assets', icon: PieChart },
        { id: 'cex' as ViewType, label: 'CEX Portfolio', icon: BarChart3 },
        { id: 'bridge' as ViewType, label: 'Bridge', icon: ArrowLeftRight },
        { id: 'staking' as ViewType, label: 'Earn', icon: Shield },
        { id: 'agent' as ViewType, label: 'Agent', icon: Bot },
        {
            id: 'insight' as ViewType, label: 'Vision Insight', icon: (props: any) => (
                <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" opacity="0.3" />
                    <circle cx="12" cy="12" r="6" opacity="0.5" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                    <line x1="12" y1="2" x2="12" y2="5" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="5" y2="12" />
                    <line x1="19" y1="12" x2="22" y2="12" />
                </svg>
            )
        },
        { id: 'nodes' as ViewType, label: 'Nodes', icon: Camera },
        { id: 'referral' as ViewType, label: 'Referral', icon: UserPlus },
        { id: 'quest' as ViewType, label: 'Quest', icon: Zap },
        { id: 'mint' as ViewType, label: 'Mint', icon: Plus },
        { id: 'contacts' as ViewType, label: 'Contacts', icon: Users },
        { id: 'history' as ViewType, label: 'History', icon: Clock },
        { id: 'profile' as ViewType, label: 'Profile', icon: User },
        { id: 'notifications' as ViewType, label: 'Notification', icon: Bell },
        { id: 'settings' as ViewType, label: 'Settings', icon: Settings },
    ];

    const menuItems = () => allMenuItems;

    return (
        <>
            {/* Mobile Sidebar - Backdrop and Drawer */}
            <Presence>
                <Show when={props.sidebarOpen}>
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={() => props.setSidebarOpen(false)}
                        class="fixed lg:hidden inset-0 z-[70] bg-black/60 backdrop-blur-md"
                    />
                </Show>
            </Presence>

            <Presence>
                <Show when={props.sidebarOpen}>
                    <Motion.aside
                        initial={{ x: -280 }}
                        animate={{ x: 0 }}
                        exit={{ x: -280 }}
                        transition={{ duration: 0.4, easing: [0.25, 1, 0.5, 1] }}
                        class="fixed lg:hidden inset-y-0 left-0 z-[80] w-[280px] bg-[#0c0c0e] border-r border-white/10 shadow-2xl flex flex-col"
                    >
                        <SidebarContent {...props} menuItems={menuItems()} />
                    </Motion.aside>
                </Show>
            </Presence>

            {/* Desktop Sidebar - Always Visible */}
            <div class="hidden lg:flex fixed inset-y-0 left-0 z-30 w-[280px] bg-[#0c0c0e] border-r border-white/10 flex-col">
                <SidebarContent {...props} menuItems={menuItems()} isDesktop />
            </div>
        </>
    );
};

// Internal Component to avoid duplication between Mobile/Desktop wrapper
const SidebarContent = (props: WalletSidebarProps & { menuItems: any[], isDesktop?: boolean }) => {
    // Check if running as iOS PWA (standalone mode)
    const isIOSPWA = typeof window !== 'undefined' &&
        (window.navigator as any).standalone === true;

    return (
        <>
            {/* Header - Extra padding for iOS PWA safe area */}
            <div
                class={`${props.isDesktop ? 'h-[88px] pt-4' : 'h-auto'} shrink-0 flex items-center px-8 border-b border-white/[0.06] relative z-20 bg-[#0c0c0e]/80 backdrop-blur-xl`}
                style={!props.isDesktop ? { 'padding-top': isIOSPWA ? 'max(env(safe-area-inset-top, 20px), 48px)' : '24px', 'padding-bottom': '16px' } : {}}
            >
                <div class="flex flex-col gap-1">
                    <div class="flex items-center mb-1">
                        <VisionFullLogo class="scale-110 origin-left" />
                    </div>
                    <button
                        onClick={() => props.setNetworkMode(props.networkMode === 'mainnet' ? 'testnet' : 'mainnet')}
                        class={`mt-0.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all self-start ${props.networkMode === 'testnet'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                            : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                            }`}
                    >
                        <div class={`w-1 h-1 rounded-full animate-pulse ${props.networkMode === 'testnet' ? 'bg-amber-400' : 'bg-green-400'}`} />
                        {props.networkMode === 'testnet' ? 'Testnet' : 'Mainnet'}
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
                            <Show when={item.id === 'notifications' && props.unreadCount > 0}>
                                <div class="ml-auto min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse border border-red-400/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                                    {props.unreadCount > 99 ? '99+' : props.unreadCount}
                                </div>
                            </Show>
                            <Show when={props.activeView === item.id && (item.id !== 'notifications' || props.unreadCount === 0)}>
                                <div class="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            </Show>
                        </button>
                    )}
                </For>
            </nav>
            {/* User Info Section */}
            <div class="p-4 mt-auto border-t border-white/[0.06] bg-gradient-to-t from-black/20 to-transparent">
                <div class="bg-white/[0.03] rounded-[24px] p-4 border border-white/[0.06] relative overflow-hidden group/card shadow-xl">
                    {/* Background Glow */}
                    <div class="absolute -right-4 -top-4 w-16 h-16 bg-cyan-500/10 rounded-full blur-2xl group-hover/card:bg-cyan-500/20 transition-all duration-500" />

                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-[#1a1a1e] border border-white/10 flex items-center justify-center relative overflow-hidden">
                            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
                            <User class="w-5 h-5 text-gray-400 group-hover/card:text-cyan-400 transition-colors" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-[13px] font-black text-white truncate uppercase italic tracking-tight">
                                {props.userProfile?.email?.split('@')[0] || <span class="text-red-400">NO DATA</span>}
                            </div>
                            <div class="text-[10px] font-bold text-gray-500 truncate flex items-center gap-1">
                                <span class="w-1 h-1 rounded-full bg-green-500" /> Secured VID
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            props.copyAddress();
                        }}
                        class="w-full h-10 flex items-center justify-between gap-3 px-3.5 bg-black/40 hover:bg-black/60 rounded-xl border border-white/5 transition-all group/btn active:scale-95"
                    >
                        <div class="flex items-center gap-2 min-w-0">
                            <WalletIcon class="w-4 h-4 text-gray-500 group-hover/btn:text-cyan-400 transition-colors" />
                            <span class="text-[11px] font-mono text-gray-500 group-hover/btn:text-white transition-colors truncate">
                                {props.shortAddress || '0x000...000'}
                            </span>
                        </div>
                        <div class="shrink-0">
                            <Show when={props.copied} fallback={
                                <Copy class="w-3.5 h-3.5 text-gray-600 group-hover/btn:text-white transition-all transform group-hover/btn:rotate-12" />
                            }>
                                <Check class="w-3.5 h-3.5 text-cyan-400 scale-110" />
                            </Show>
                        </div>
                    </button>
                </div>
            </div>
        </>
    );
};
