import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import { ExternalLink, RefreshCw, Zap, Box, Tag } from 'lucide-solid';
import { getVcnPrice, initPriceService } from '../../../services/vcnPriceService';

export const DashboardHeader: Component = () => {
    // Mock Ticker Data
    const [blockHeight, setBlockHeight] = createSignal(12458923);
    const [gasPrice, setGasPrice] = createSignal(12); // gwei

    onMount(() => {
        initPriceService();
    });

    // Simulate live updates - slower block height
    const timer = setInterval(() => {
        setBlockHeight(p => p + 1); // Block height increments by 1 every 5 seconds
        setGasPrice(p => Math.max(5, Math.min(20, p + (Math.random() - 0.5) * 2)));
    }, 5000); // Slower - every 5 seconds

    onCleanup(() => clearInterval(timer));

    return (
        <div class="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            {/* Title Section */}
            <div>
                <h1 class="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">Vision Testnet v2</span>
                    <span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">Custom Node</span>
                </h1>
                <p class="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Sovereign L1 Prototype Infrastructure</p>
            </div>

            {/* Ticker / Status Bar */}
            <div class="flex items-center gap-4 bg-[#0B0E14] border border-white/5 rounded-full px-6 py-2 shadow-xl overflow-hidden glass-panel">
                {/* Block Height */}
                <div class="flex items-center gap-2 pr-4 border-r border-white/5">
                    <Box class="w-3.5 h-3.5 text-blue-400" />
                    <div class="flex flex-col">
                        <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Block Height</span>
                        <span class="text-xs font-mono text-white">#{blockHeight().toLocaleString()}</span>
                    </div>
                </div>

                {/* Gas Price */}
                <div class="flex items-center gap-2 pr-4 border-r border-white/5">
                    <Zap class="w-3.5 h-3.5 text-amber-400" />
                    <div class="flex flex-col">
                        <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gas Price</span>
                        <span class="text-xs font-mono text-white">{Math.floor(gasPrice())} Gwei</span>
                    </div>
                </div>

                {/* Token Price - Live from price service */}
                <div class="flex items-center gap-2">
                    <Tag class="w-3.5 h-3.5 text-green-400" />
                    <div class="flex flex-col">
                        <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">VCN Price</span>
                        <span class="text-xs font-mono text-white">${getVcnPrice().toFixed(3)}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div class="flex gap-3">
                <button class="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                    <RefreshCw class="w-5 h-5" />
                </button>
                <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all">
                    Vision Scan
                    <ExternalLink class="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};
