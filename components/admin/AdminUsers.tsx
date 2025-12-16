import { createSignal, For, Show } from 'solid-js';
import {
    Search,
    Filter,
    MoreVertical,
    Mail,
    Shield,
    ShieldCheck,
    Clock,
    CheckCircle,
    XCircle
} from 'lucide-solid';

// Mock user data
const mockUsers = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'active', joinDate: '2024-01-15' },
    { id: 2, name: 'Sarah Wilson', email: 'sarah@example.com', role: 'User', status: 'active', joinDate: '2024-02-20' },
    { id: 3, name: 'Mike Johnson', email: 'mike@example.com', role: 'User', status: 'pending', joinDate: '2024-03-10' },
    { id: 4, name: 'Emily Brown', email: 'emily@example.com', role: 'Moderator', status: 'active', joinDate: '2024-03-25' },
    { id: 5, name: 'David Lee', email: 'david@example.com', role: 'User', status: 'inactive', joinDate: '2024-04-01' },
    { id: 6, name: 'Jessica Taylor', email: 'jessica@example.com', role: 'User', status: 'active', joinDate: '2024-04-15' },
    { id: 7, name: 'Chris Martinez', email: 'chris@example.com', role: 'User', status: 'active', joinDate: '2024-05-01' },
    { id: 8, name: 'Amanda White', email: 'amanda@example.com', role: 'Moderator', status: 'pending', joinDate: '2024-05-10' },
];

const statusStyles = {
    active: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
    inactive: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
};

const roleStyles = {
    Admin: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: ShieldCheck },
    Moderator: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Shield },
    User: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: Shield },
};

export default function AdminUsers() {
    const [searchQuery, setSearchQuery] = createSignal('');
    const [statusFilter, setStatusFilter] = createSignal('all');

    const filteredUsers = () => {
        return mockUsers.filter(user => {
            const matchesSearch =
                user.name.toLowerCase().includes(searchQuery().toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery().toLowerCase());
            const matchesStatus = statusFilter() === 'all' || user.status === statusFilter();
            return matchesSearch && matchesStatus;
        });
    };

    return (
        <div class="space-y-8">
            {/* Header */}
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-bold text-white">Users</h1>
                    <p class="text-gray-400 mt-1">Manage user accounts and permissions.</p>
                </div>
                <button class="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300">
                    Add User
                </button>
            </div>

            {/* Filters */}
            <div class="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div class="relative flex-1">
                    <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        class="w-full pl-12 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                </div>

                {/* Status Filter */}
                <div class="relative">
                    <Filter class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                        value={statusFilter()}
                        onChange={(e) => setStatusFilter(e.currentTarget.value)}
                        class="appearance-none pl-12 pr-10 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                {/* Table Header */}
                <div class="hidden md:grid grid-cols-12 gap-4 p-4 bg-white/[0.02] border-b border-white/5 text-sm text-gray-400 font-medium">
                    <div class="col-span-4">User</div>
                    <div class="col-span-2">Role</div>
                    <div class="col-span-2">Status</div>
                    <div class="col-span-3">Join Date</div>
                    <div class="col-span-1"></div>
                </div>

                {/* Table Body */}
                <div class="divide-y divide-white/5">
                    <For each={filteredUsers()}>
                        {(user) => {
                            const status = statusStyles[user.status as keyof typeof statusStyles];
                            const role = roleStyles[user.role as keyof typeof roleStyles];

                            return (
                                <div class="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                                    {/* User Info */}
                                    <div class="md:col-span-4 flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div class="min-w-0">
                                            <p class="text-white font-medium truncate">{user.name}</p>
                                            <p class="text-gray-400 text-sm truncate flex items-center gap-1">
                                                <Mail class="w-3 h-3" />
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Role */}
                                    <div class="md:col-span-2 flex items-center">
                                        <span class={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium ${role.bg} ${role.text}`}>
                                            <role.icon class="w-3.5 h-3.5" />
                                            {user.role}
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div class="md:col-span-2 flex items-center">
                                        <span class={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium capitalize ${status.bg} ${status.text}`}>
                                            <status.icon class="w-3.5 h-3.5" />
                                            {user.status}
                                        </span>
                                    </div>

                                    {/* Join Date */}
                                    <div class="md:col-span-3 flex items-center text-gray-400">
                                        <Clock class="w-4 h-4 mr-2" />
                                        {new Date(user.joinDate).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </div>

                                    {/* Actions */}
                                    <div class="md:col-span-1 flex items-center justify-end">
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                                            <MoreVertical class="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>

                {/* Empty State */}
                <Show when={filteredUsers().length === 0}>
                    <div class="p-12 text-center">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                            <Search class="w-8 h-8 text-gray-500" />
                        </div>
                        <p class="text-gray-400">No users found matching your criteria.</p>
                    </div>
                </Show>
            </div>
        </div>
    );
}
