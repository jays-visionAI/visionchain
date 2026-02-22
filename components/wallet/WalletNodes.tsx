import { For, Show } from 'solid-js';
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

export const WalletNodes = (props: WalletNodesProps) => {
    const { t } = useI18n();
    // Dynamic Price Calculation
    const validatorPriceVCN = Math.ceil(VALIDATOR_PRICE_USD / VCN_PRICE);
    const enterprisePriceVCN = Math.ceil(ENTERPRISE_PRICE_USD / VCN_PRICE);

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
                    {/* Android Mobile Node Download Banner */}
                    <div class="bg-gradient-to-r from-[#111113] to-[#0f1117] border border-white/[0.06] rounded-[28px] p-6 relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-500">
                        {/* Background Gradient */}
                        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div class="relative z-10 flex flex-col sm:flex-row items-center gap-5">
                            {/* Android Icon */}
                            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                                <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-emerald-400">
                                    <path d="M17.523 2.236a.5.5 0 0 0-.858.514l1.083 1.808A7.456 7.456 0 0 0 12 2.5a7.456 7.456 0 0 0-5.748 2.058l1.083-1.808a.5.5 0 0 0-.858-.514L5.05 4.96A7.97 7.97 0 0 0 4 9h16a7.97 7.97 0 0 0-1.05-4.04l-1.427-2.724zM9 7.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm6 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM4 10h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8z" />
                                </svg>
                            </div>
                            {/* Text Content */}
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
                            {/* Download Button */}
                            <a
                                href="https://github.com/jays-visionAI/visionchain/releases/latest/download/visionchain-node-v1.0.1.apk"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="shrink-0 flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Download APK
                            </a>
                        </div>
                    </div>

                    {/* Mobile Node Dashboard */}
                    <MobileNodeDashboard userEmail={props.userEmail} />
                    {/* Active Nodes List */}
                    <div class="space-y-4">
                        <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">{t('nodes.yourFleet')}</h3>
                        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            <For each={props.userNodes}>
                                {(node) => (
                                    <div class="group bg-[#111113] border border-white/[0.06] hover:border-emerald-500/30 rounded-[32px] p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 relative overflow-hidden">
                                        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div class="relative z-10 space-y-6">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-3">
                                                    <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                                        <div class={`w-2 h-2 rounded-full ${node.status === 'Running' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                                    </div>
                                                    <div>
                                                        <h4 class="font-bold text-white">{node.type} {t('nodes.nodeLabel')}</h4>
                                                        <div class="text-[10px] text-gray-500 font-mono uppercase">{node.id}</div>
                                                    </div>
                                                </div>
                                                <span class={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${node.status === 'Running' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                                    {node.status}
                                                </span>
                                            </div>

                                            <div class="grid grid-cols-2 gap-4">
                                                <div class="p-4 bg-black/20 rounded-2xl border border-white/5">
                                                    <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{t('nodes.dailyReward')}</div>
                                                    <div class="text-lg font-bold text-white">+{node.dailyReward} VCN</div>
                                                </div>
                                                <div class="p-4 bg-black/20 rounded-2xl border border-white/5">
                                                    <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{t('nodes.uptime')}</div>
                                                    <div class="text-lg font-bold text-white">{node.uptime}</div>
                                                </div>
                                            </div>

                                            <div class="flex gap-3">
                                                <button
                                                    onClick={props.claimNodeRewards}
                                                    class="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                                    {t('nodes.claimRewards')}
                                                </button>
                                                <button class="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/5">
                                                    {t('nodes.manage')}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress Bar for daily epoch */}
                                        <div class="h-1 bg-white/5 w-full">
                                            <div class="h-full bg-emerald-500 w-[75%]" />
                                        </div>
                                    </div>
                                )}
                            </For>

                            {/* Purchase New License CTA */}
                            <div
                                onClick={() => document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' })}
                                class="bg-[#111113] border border-white/10 border-dashed rounded-[32px] p-8 flex flex-col items-center justify-center text-center gap-6 group hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all cursor-pointer">
                                <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                    <Plus class="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 class="text-xl font-bold text-white mb-2">{t('nodes.deployNewNode')}</h3>
                                    <p class="text-sm text-gray-500 max-w-xs mx-auto">{t('nodes.deployNewNodeDesc')}</p>
                                </div>
                                <button class="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                                    {t('nodes.viewCatalog')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Node Catalog Section */}
                    <div id="catalog-section" class="border-t border-white/[0.06] pt-12">
                        <h3 class="text-2xl font-bold text-white mb-8 tracking-tight">{t('nodes.nodeLicenseCatalog')}</h3>

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
