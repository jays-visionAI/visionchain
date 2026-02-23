import { createSignal, For, Show, onMount } from 'solid-js';
import { Check, Plus } from 'lucide-solid';
import { WalletViewHeader } from './WalletViewHeader';
import { MobileNodeDashboard } from './MobileNodeDashboard';
import { useI18n } from '../../i18n/i18nContext';

interface WalletNodesProps {
    userNodes: any[];
    claimNodeRewards: () => void;
    purchaseNode: (tier: string) => void;
    userEmail?: string;
}

// Constants for Pricing
const VCN_PRICE = 0.375;
const VALIDATOR_PRICE_USD = 10000;
const ENTERPRISE_PRICE_USD = 100000;

// Download URLs - pinned to node-v1.0.0 release
const DOWNLOAD_URLS = {
    mac_arm64: 'https://github.com/jays-visionAI/visionchain/releases/download/node-v1.0.0/VisionNode-arm64.dmg',
    mac_x64: 'https://github.com/jays-visionAI/visionchain/releases/download/node-v1.0.0/VisionNode-x64.dmg',
    windows: 'https://github.com/jays-visionAI/visionchain/releases/download/node-v1.0.0/VisionNode-Setup.exe',
};

const CLI_CMD = 'curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-macos.sh | bash';

function detectIsIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function detectIsAndroid(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent || '');
}

export const WalletNodes = (props: WalletNodesProps) => {
    const { t } = useI18n();
    const [isIOS, setIsIOS] = createSignal(false);
    const [isAndroid, setIsAndroid] = createSignal(false);
    const [showCLI, setShowCLI] = createSignal(false);
    const [copied, setCopied] = createSignal(false);
    const [activeTab, setActiveTab] = createSignal<'dashboard' | 'leaderboard'>('dashboard');

    const validatorPriceVCN = Math.ceil(VALIDATOR_PRICE_USD / VCN_PRICE);
    const enterprisePriceVCN = Math.ceil(ENTERPRISE_PRICE_USD / VCN_PRICE);

    onMount(() => {
        setIsIOS(detectIsIOS());
        setIsAndroid(detectIsAndroid());
    });

    function copyCommand() {
        navigator.clipboard.writeText(CLI_CMD);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    // -- SVG Icons --
    const downloadSvg = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );

    const appleSvg = () => (
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
    );

    const windowsSvg = () => (
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path d="M3 12V6.75l6-1.32v6.48L3 12zm6.73-1.12v-5.8l8.27-1.83v7.63l-8.27.01zM3 13.08l6 .09v6.22l-6-1.31V13.08zm6.73 .1l8.27.14v7.54l-8.27-1.84V13.18z" />
        </svg>
    );

    const terminalSvg = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-5 h-5">
            <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
        </svg>
    );

    const copySvg = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
    );

    const checkSvg = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );

    const storageSvg = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8">
            <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
    );

    const shieldSvg = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );

    return (
        <div class="flex-1 overflow-y-auto relative h-full custom-scrollbar p-4 lg:p-8">
            {/* Decorative Background Blur */}
            <div class="absolute top-0 right-[25%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />

            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
                <WalletViewHeader
                    tag={t('nodes.tag')}
                    title={t('nodes.title')}
                    titleAccent={t('nodes.titleAccent')}
                    description={t('nodes.description')}
                    rightElement={
                        <div class="flex items-center gap-3">
                            <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span class="text-sm font-black text-emerald-400 uppercase tracking-widest">{t('nodes.networkOptimal')}</span>
                        </div>
                    }
                />

                <div class="space-y-10">

                    {/* ═══════════════════════════════════════════════════ */}
                    {/* SECTION 1: Mobile Node (Lite) - Always visible      */}
                    {/* ═══════════════════════════════════════════════════ */}
                    <div>
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-cyan-400">
                                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                                </svg>
                            </div>
                            <h3 class="text-lg font-bold text-white">Mobile Node (Lite)</h3>
                        </div>

                        {/* Always-visible info notice */}
                        <div class="flex items-start gap-3 px-5 py-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl mb-4">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-cyan-400 shrink-0 mt-0.5">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <div class="text-sm text-gray-400 leading-relaxed">
                                <span class="text-white font-semibold">iOS</span> -- Open this page on your iPhone or iPad to run a Lite Node directly in the browser.
                                <span class="mx-1.5 text-gray-600">|</span>
                                <span class="text-white font-semibold">Android</span> -- Open this page on your Android device to download the dedicated APK for background mining.
                            </div>
                        </div>

                        {/* Android: APK Download */}
                        <Show when={isAndroid()}>
                            <div class="bg-gradient-to-r from-[#111113] to-[#0f1117] border border-white/[0.06] rounded-[28px] p-6 relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-500 mb-4">
                                <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div class="relative z-10 flex flex-col sm:flex-row items-center gap-5">
                                    <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                                        <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-emerald-400">
                                            <path d="M17.523 2.236a.5.5 0 0 0-.858.514l1.083 1.808A7.456 7.456 0 0 0 12 2.5a7.456 7.456 0 0 0-5.748 2.058l1.083-1.808a.5.5 0 0 0-.858-.514L5.05 4.96A7.97 7.97 0 0 0 4 9h16a7.97 7.97 0 0 0-1.05-4.04l-1.427-2.724zM9 7.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm6 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM4 10h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8z" />
                                        </svg>
                                    </div>
                                    <div class="flex-1 text-center sm:text-left">
                                        <h3 class="text-lg font-bold text-white mb-1">Android Mobile Node</h3>
                                        <p class="text-sm text-gray-400 leading-relaxed">
                                            Install the dedicated Android app for background mining with higher rewards and better uptime stability.
                                        </p>
                                        <div class="flex flex-wrap justify-center sm:justify-start gap-3 mt-3">
                                            <div class="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>
                                                Background Mining
                                            </div>
                                            <div class="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>
                                                Higher Rewards
                                            </div>
                                            <div class="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>
                                                Auto Reconnect
                                            </div>
                                        </div>
                                    </div>
                                    <a
                                        href="https://github.com/jays-visionAI/visionchain/releases/latest/download/visionchain-node-v1.0.2.apk"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="shrink-0 flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                    >
                                        {downloadSvg()}
                                        Download APK
                                    </a>
                                </div>
                            </div>
                        </Show>

                        {/* iOS: Web-based Mobile Node Dashboard */}
                        <Show when={isIOS()}>
                            <MobileNodeDashboard userEmail={props.userEmail} />
                        </Show>
                    </div>

                    {/* ═══════════════════════════════════════════════════ */}
                    {/* SECTION 2: Distributed Storage Node                */}
                    {/* ═══════════════════════════════════════════════════ */}
                    <div>
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                {storageSvg()}
                            </div>
                            <h3 class="text-lg font-bold text-white">Distributed Storage Node</h3>
                        </div>

                        <div class="bg-gradient-to-br from-[#111113] to-[#0d0d15] border border-white/[0.06] rounded-[28px] p-6 relative overflow-hidden">
                            <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-cyan-500/3 pointer-events-none" />

                            <div class="relative z-10">
                                <p class="text-sm text-gray-400 leading-relaxed mb-6">
                                    Share your storage and earn VCN rewards. Download the desktop app or install via CLI.
                                </p>

                                {/* Download Buttons Row */}
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                    {/* macOS */}
                                    <a
                                        href={DOWNLOAD_URLS.mac_arm64}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="flex items-center gap-3 px-5 py-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-indigo-500/30 rounded-2xl transition-all group"
                                    >
                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                                            {appleSvg()}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="text-sm font-bold text-white">macOS</div>
                                            <div class="text-[10px] text-gray-500">Apple Silicon / Intel</div>
                                        </div>
                                        <div class="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {downloadSvg()}
                                        </div>
                                    </a>

                                    {/* Windows */}
                                    <a
                                        href={DOWNLOAD_URLS.windows}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="flex items-center gap-3 px-5 py-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-blue-500/30 rounded-2xl transition-all group"
                                    >
                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center shrink-0">
                                            {windowsSvg()}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="text-sm font-bold text-white">Windows</div>
                                            <div class="text-[10px] text-gray-500">Windows 10+ (.exe)</div>
                                        </div>
                                        <div class="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {downloadSvg()}
                                        </div>
                                    </a>

                                    {/* CLI */}
                                    <button
                                        onClick={() => setShowCLI(!showCLI())}
                                        class="flex items-center gap-3 px-5 py-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-emerald-500/30 rounded-2xl transition-all group text-left"
                                    >
                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center shrink-0">
                                            {terminalSvg()}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="text-sm font-bold text-white">CLI</div>
                                            <div class="text-[10px] text-gray-500">macOS / Linux</div>
                                        </div>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-gray-500 transition-transform" style={`transform:rotate(${showCLI() ? '180' : '0'}deg)`}>
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </button>
                                </div>

                                {/* CLI Installation Guide (collapsible) */}
                                <Show when={showCLI()}>
                                    <div class="mt-2 p-4 bg-black/30 border border-white/[0.06] rounded-2xl">
                                        <p class="text-xs text-gray-400 mb-3 font-medium">Quick install (one command):</p>
                                        <div class="flex items-center gap-2 bg-[#0a0a12] border border-white/[0.08] rounded-xl px-4 py-3 overflow-x-auto">
                                            <code class="text-[11px] text-indigo-300 font-mono whitespace-nowrap flex-1">{CLI_CMD}</code>
                                            <button
                                                onClick={copyCommand}
                                                class="shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                                title="Copy"
                                            >
                                                <Show when={copied()} fallback={<span class="text-gray-500">{copySvg()}</span>}>
                                                    <span class="text-emerald-400">{checkSvg()}</span>
                                                </Show>
                                            </button>
                                        </div>
                                        <p class="text-xs text-gray-500 mt-3">Then run:</p>
                                        <div class="bg-[#0a0a12] border border-white/[0.08] rounded-xl px-4 py-3 mt-1">
                                            <code class="text-[11px] text-gray-400 font-mono leading-6 block">
                                                vision-node init --email you@example.com --class standard{'\n'}
                                                vision-node start
                                            </code>
                                        </div>
                                    </div>
                                </Show>

                                {/* Node Class Badges */}
                                <div class="flex flex-wrap gap-3 mt-4">
                                    <div class="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                                        <div class="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lite 100MB-1GB</span>
                                    </div>
                                    <div class="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/[0.06] border border-indigo-500/20 rounded-lg">
                                        <div class="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                        <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Standard 1-100GB</span>
                                        <span class="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold">Recommended</span>
                                    </div>
                                    <div class="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                                        <div class="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full 100GB-1TB</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════ */}
                    {/* SECTION 3: Validator Node Purchase                 */}
                    {/* ═══════════════════════════════════════════════════ */}
                    <div>
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                {shieldSvg()}
                            </div>
                            <h3 class="text-lg font-bold text-white">Validator Node</h3>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Validator Tier */}
                            <div class="bg-[#111113] border border-white/[0.06] rounded-3xl p-8 hover:border-emerald-500/30 transition-all flex flex-col">
                                <div class="flex justify-between items-start mb-6">
                                    <div class="px-3 py-1 bg-emerald-500/10 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                        {t('nodes.mostPopular')}
                                    </div>
                                    <div class="text-right">
                                        <div class="text-2xl font-bold text-white">{validatorPriceVCN.toLocaleString()} VCN</div>
                                        <div class="text-xs text-gray-500">Fixed ${VALIDATOR_PRICE_USD.toLocaleString()}</div>
                                    </div>
                                </div>

                                <h4 class="text-2xl font-bold text-white mb-4">{t('nodes.validatorNode')}</h4>
                                <p class="text-gray-400 text-sm mb-8 leading-relaxed">
                                    {t('nodes.validatorNodeDesc')}
                                </p>

                                <div class="space-y-3 mb-8 flex-1">
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-emerald-500" />
                                        <span>{t('nodes.miningMultiplier1x')}</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-emerald-500" />
                                        <span>{t('nodes.halvingTrigger')}</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-emerald-500" />
                                        <span>{t('nodes.standardHardware')}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => props.purchaseNode('Validator')}
                                    class="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all hover:border-emerald-500/50">
                                    {t('nodes.purchaseLicense')}
                                </button>
                            </div>

                            {/* Enterprise Tier */}
                            <div class="bg-[#111113] border border-white/[0.06] rounded-3xl p-8 hover:border-purple-500/30 transition-all flex flex-col relative overflow-hidden">
                                {/* Badge */}
                                <div class="absolute -right-12 top-6 bg-purple-600 w-40 h-8 flex items-center justify-center rotate-45 text-[10px] font-bold text-white uppercase tracking-widest shadow-lg">
                                    {t('nodes.highPerf')}
                                </div>

                                <div class="flex justify-between items-start mb-6">
                                    <div class="px-3 py-1 bg-purple-500/10 rounded-lg text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                        {t('nodes.enterprise')}
                                    </div>
                                    <div class="text-right">
                                        <div class="text-2xl font-bold text-white">{enterprisePriceVCN.toLocaleString()} VCN</div>
                                        <div class="text-xs text-gray-500">Fixed ${ENTERPRISE_PRICE_USD.toLocaleString()}</div>
                                    </div>
                                </div>

                                <h4 class="text-2xl font-bold text-white mb-4">{t('nodes.enterpriseNode')}</h4>
                                <p class="text-gray-400 text-sm mb-8 leading-relaxed">
                                    {t('nodes.enterpriseNodeDesc')}
                                </p>

                                <div class="space-y-3 mb-8 flex-1">
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-purple-500" />
                                        <span>{t('nodes.miningMultiplier12x')}</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-purple-500" />
                                        <span>{t('nodes.aiTaskPriority')}</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-purple-500" />
                                        <span>{t('nodes.networkRequired')}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => props.purchaseNode('Enterprise')}
                                    class="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20">
                                    {t('nodes.purchaseLicense')}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
