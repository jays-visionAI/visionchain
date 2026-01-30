import { createSignal, For, Show } from 'solid-js';
import {
    Activity,
    Clock,
    Search,
    Filter,
    User,
    Terminal,
    Shield,
    Zap,
    ArrowUpRight,
    ArrowDownLeft,
    AlertTriangle,
    CheckCircle
} from 'lucide-solid';

// Mock Audit Log Data
const auditLogs = [
    { id: 'log_01', user: 'System', action: 'Bridge Challenge Raised: TX 0x7f3a...be29', target: 'Bridge', level: 'danger', time: '1 min ago' },
    { id: 'log_02', user: 'Admin (jipark)', action: 'Bridge Transfer Finalized: 5,000 VCN to Sepolia', target: 'Bridge', level: 'success', time: '5 min ago' },
    { id: 'log_03', user: 'System', action: 'Automated Wallet Sync Completed', target: 'Liquidity', level: 'success', time: '15 min ago' },
    { id: 'log_04', user: 'Moderator (sarah)', action: 'Bridge Challenge Period Extended: TX 0x3c1f...8b02', target: 'Bridge', level: 'warning', time: '1 hour ago' },
    { id: 'log_05', user: 'Admin (jipark)', action: 'Emergency Shutdown Bridge Node #2', target: 'Network', level: 'danger', time: '3 hours ago' },
    { id: 'log_06', user: 'System', action: 'Bridge Transfer Reverted: Invalid Merkle Proof', target: 'Bridge', level: 'danger', time: '5 hours ago' },
];

export default function AdminActivity() {
    return (
        <div class="space-y-8">
            {/* Header */}
            <div>
                <h1 class="text-3xl font-black text-white uppercase tracking-tight">Activity Log</h1>
                <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">System-wide Audit Trails & Security Logs</p>
            </div>

            {/* Log Explorer */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <div class="p-6 border-b border-white/5 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search actions, users..."
                                class="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 w-64"
                            />
                        </div>
                        <div class="h-8 w-[1px] bg-white/10" />
                        <div class="flex gap-2">
                            <span class="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-[9px] font-black text-cyan-400 uppercase cursor-pointer">All Levels</span>
                            <span class="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-gray-500 uppercase cursor-pointer hover:border-white/20 transition-colors">Critical Only</span>
                        </div>
                    </div>
                </div>

                <div class="divide-y divide-white/5">
                    <For each={auditLogs}>
                        {(log) => (
                            <div class="p-5 flex items-start gap-5 hover:bg-white/[0.01] transition-colors group">
                                <div class={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center border ${log.level === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                    log.level === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                                        log.level === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                            'bg-cyan-500/10 border-cyan-500/20 text-cyan-500'
                                    }`}>
                                    <Show when={log.level === 'danger'}><AlertTriangle class="w-4 h-4" /></Show>
                                    <Show when={log.level === 'warning'}><Shield class="w-4 h-4" /></Show>
                                    <Show when={log.level === 'success'}><CheckCircle class="w-4 h-4" /></Show>
                                    <Show when={log.level === 'info'}><Terminal class="w-4 h-4" /></Show>
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center gap-3 mb-1">
                                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">{log.user}</span>
                                        <div class="w-1 h-1 rounded-full bg-white/10" />
                                        <span class="text-[10px] font-black text-white/50 uppercase tracking-widest">{log.target}</span>
                                    </div>
                                    <p class="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{log.action}</p>
                                </div>
                                <div class="text-right">
                                    <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                        <Clock class="w-3.5 h-3.5" />
                                        {log.time}
                                    </div>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
}
