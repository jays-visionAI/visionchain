import { For } from 'solid-js';
import {
    Users,
    FolderKanban,
    DollarSign,
    UserPlus,
    TrendingUp,
    TrendingDown,
    Activity,
    Clock
} from 'lucide-solid';

// Mock data for demonstration
const stats = [
    {
        label: 'Total Users',
        value: '12,847',
        change: '+12.5%',
        isPositive: true,
        icon: Users,
        color: 'cyan'
    },
    {
        label: 'Active Projects',
        value: '284',
        change: '+8.2%',
        isPositive: true,
        icon: FolderKanban,
        color: 'purple'
    },
    {
        label: 'Revenue',
        value: '$48,294',
        change: '+23.1%',
        isPositive: true,
        icon: DollarSign,
        color: 'green'
    },
    {
        label: 'New Signups',
        value: '847',
        change: '-3.2%',
        isPositive: false,
        icon: UserPlus,
        color: 'orange'
    },
];

const recentActivity = [
    { id: 1, action: 'New user registered', user: 'john@example.com', time: '2 min ago' },
    { id: 2, action: 'Project created', user: 'sarah@example.com', time: '15 min ago' },
    { id: 3, action: 'Payment received', user: 'mike@example.com', time: '1 hour ago' },
    { id: 4, action: 'Settings updated', user: 'admin@example.com', time: '2 hours ago' },
    { id: 5, action: 'User role changed', user: 'jane@example.com', time: '3 hours ago' },
];

const colorClasses: Record<string, { bg: string; text: string; shadow: string }> = {
    cyan: { bg: 'from-cyan-500/20 to-cyan-600/10', text: 'text-cyan-400', shadow: 'shadow-cyan-500/20' },
    purple: { bg: 'from-purple-500/20 to-purple-600/10', text: 'text-purple-400', shadow: 'shadow-purple-500/20' },
    green: { bg: 'from-green-500/20 to-green-600/10', text: 'text-green-400', shadow: 'shadow-green-500/20' },
    orange: { bg: 'from-orange-500/20 to-orange-600/10', text: 'text-orange-400', shadow: 'shadow-orange-500/20' },
};

export default function AdminDashboard() {
    return (
        <div class="space-y-8">
            {/* Header */}
            <div>
                <h1 class="text-3xl font-bold text-white">Dashboard</h1>
                <p class="text-gray-400 mt-1">Welcome back! Here's what's happening.</p>
            </div>

            {/* Stats Grid */}
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <For each={stats}>
                    {(stat) => {
                        const colors = colorClasses[stat.color];
                        return (
                            <div class={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors.bg} p-6 border border-white/5 shadow-xl ${colors.shadow} group hover:scale-[1.02] transition-transform duration-300`}>
                                {/* Background Glow */}
                                <div class={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${colors.bg} blur-3xl opacity-50`} />

                                <div class="relative">
                                    <div class="flex items-center justify-between mb-4">
                                        <div class={`p-3 rounded-xl bg-white/5 ${colors.text}`}>
                                            <stat.icon class="w-6 h-6" />
                                        </div>
                                        <div class={`flex items-center gap-1 text-sm font-medium ${stat.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                            {stat.isPositive ? <TrendingUp class="w-4 h-4" /> : <TrendingDown class="w-4 h-4" />}
                                            {stat.change}
                                        </div>
                                    </div>

                                    <div class="space-y-1">
                                        <p class="text-3xl font-bold text-white">{stat.value}</p>
                                        <p class="text-gray-400 text-sm">{stat.label}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    }}
                </For>
            </div>

            {/* Content Grid */}
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div class="xl:col-span-2 rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                            <Activity class="w-5 h-5 text-cyan-400" />
                            Recent Activity
                        </h2>
                    </div>

                    <div class="space-y-4">
                        <For each={recentActivity}>
                            {(activity) => (
                                <div class="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                                        <Activity class="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-white font-medium truncate">{activity.action}</p>
                                        <p class="text-gray-400 text-sm truncate">{activity.user}</p>
                                    </div>
                                    <div class="flex items-center gap-1 text-gray-500 text-sm">
                                        <Clock class="w-4 h-4" />
                                        {activity.time}
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* Quick Stats */}
                <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                    <h2 class="text-xl font-semibold text-white mb-6">Performance</h2>

                    <div class="space-y-6">
                        <div class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-400">Server Uptime</span>
                                <span class="text-cyan-400 font-medium">99.9%</span>
                            </div>
                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div class="h-full w-[99.9%] bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                            </div>
                        </div>

                        <div class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-400">API Response</span>
                                <span class="text-green-400 font-medium">45ms</span>
                            </div>
                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div class="h-full w-[85%] bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" />
                            </div>
                        </div>

                        <div class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-400">Storage Used</span>
                                <span class="text-purple-400 font-medium">67%</span>
                            </div>
                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div class="h-full w-[67%] bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                            </div>
                        </div>

                        <div class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-400">Memory Usage</span>
                                <span class="text-orange-400 font-medium">42%</span>
                            </div>
                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div class="h-full w-[42%] bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
