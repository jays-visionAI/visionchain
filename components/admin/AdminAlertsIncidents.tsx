import { Component, createSignal, onMount, For } from 'solid-js';
import { AlertTriangle, Bell, CheckCircle, Clock, XCircle, ChevronRight } from 'lucide-solid';

type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

interface Alert {
    alertId: string;
    severity: AlertSeverity;
    status: AlertStatus;
    title: string;
    description: string;
    chainId?: number;
    dappId?: string;
    createdAt: string;
    acknowledgedBy?: string;
}

const AdminAlertsIncidents: Component = () => {
    const [alerts, setAlerts] = createSignal<Alert[]>([]);

    onMount(async () => {
        setAlerts([
            { alertId: 'a_001', severity: 'CRITICAL', status: 'ACTIVE', title: 'Bridge Challenge Raised', description: 'TX 0x7f3a...be29 challenged by validator 0x9de2', chainId: 11155111, createdAt: '2026-01-30 09:50:00' },
            { alertId: 'a_002', severity: 'WARNING', status: 'ACKNOWLEDGED', title: 'Challenge Period Expiring', description: '3 bridge transfers finalizing in next 5 minutes', acknowledgedBy: 'admin_jay', createdAt: '2026-01-30 09:45:00' },
            { alertId: 'a_003', severity: 'CRITICAL', status: 'ACTIVE', title: 'Pool Balance Critical', description: 'Sepolia pool below minBalance (0.8 ETH)', chainId: 11155111, createdAt: '2026-01-30 09:40:00' },
            { alertId: 'a_004', severity: 'WARNING', status: 'ACTIVE', title: 'Multiple Pending Bridges', description: '15 transfers pending in challenge period', createdAt: '2026-01-30 09:35:00' },
            { alertId: 'a_005', severity: 'INFO', status: 'RESOLVED', title: 'Bridge Finalization Complete', description: 'Batch of 8 transfers finalized successfully', createdAt: '2026-01-30 09:00:00' },
        ]);
    });

    const getSeverityStyle = (severity: AlertSeverity) => ({
        'CRITICAL': 'bg-red-500/20 text-red-400 border-red-500/30',
        'WARNING': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'INFO': 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }[severity]);

    const getStatusIcon = (status: AlertStatus) => {
        if (status === 'RESOLVED') return <CheckCircle class="w-4 h-4 text-green-400" />;
        if (status === 'ACKNOWLEDGED') return <Clock class="w-4 h-4 text-yellow-400" />;
        return <AlertTriangle class="w-4 h-4 text-red-400 animate-pulse" />;
    };

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header class="flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-500 bg-clip-text text-transparent">
                        Alerts & Incidents
                    </h1>
                    <p class="text-gray-400 mt-2">Real-time system alerts and incident management</p>
                </div>
                <button class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm flex items-center gap-2">
                    <Bell class="w-4 h-4" /> Configure Notifications
                </button>
            </header>

            {/* Summary */}
            <div class="grid grid-cols-4 gap-6">
                <div class="p-6 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div class="text-sm text-red-400">Critical Active</div>
                    <div class="text-3xl font-bold mt-1">{alerts().filter(a => a.severity === 'CRITICAL' && a.status === 'ACTIVE').length}</div>
                </div>
                <div class="p-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <div class="text-sm text-yellow-400">Warnings</div>
                    <div class="text-3xl font-bold mt-1">{alerts().filter(a => a.severity === 'WARNING' && a.status !== 'RESOLVED').length}</div>
                </div>
                <div class="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div class="text-sm text-blue-400">Acknowledged</div>
                    <div class="text-3xl font-bold mt-1">{alerts().filter(a => a.status === 'ACKNOWLEDGED').length}</div>
                </div>
                <div class="p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div class="text-sm text-green-400">Resolved (24h)</div>
                    <div class="text-3xl font-bold mt-1">{alerts().filter(a => a.status === 'RESOLVED').length}</div>
                </div>
            </div>

            {/* Alerts List */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="p-4 border-b border-white/5">
                    <h2 class="text-lg font-bold">Recent Alerts</h2>
                </div>
                <div class="divide-y divide-white/5">
                    <For each={alerts()}>
                        {(alert) => (
                            <div class={`p-4 flex items-center gap-4 hover:bg-white/[0.02] transition cursor-pointer ${alert.status === 'ACTIVE' ? 'bg-white/[0.01]' : ''}`}>
                                {getStatusIcon(alert.status)}
                                <span class={`px-2 py-0.5 text-xs font-bold rounded border ${getSeverityStyle(alert.severity)}`}>
                                    {alert.severity}
                                </span>
                                <div class="flex-1">
                                    <div class="font-bold">{alert.title}</div>
                                    <div class="text-xs text-gray-400">{alert.description}</div>
                                </div>
                                {alert.chainId && <span class="text-xs bg-white/5 px-2 py-1 rounded">Chain {alert.chainId}</span>}
                                {alert.dappId && <span class="text-xs bg-white/5 px-2 py-1 rounded">{alert.dappId}</span>}
                                {alert.acknowledgedBy && <span class="text-xs text-gray-500">by {alert.acknowledgedBy}</span>}
                                <span class="text-xs text-gray-500">{alert.createdAt}</span>
                                <ChevronRight class="w-4 h-4 text-gray-500" />
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
};

export default AdminAlertsIncidents;
