import { Component } from 'solid-js';
import {
    LayoutDashboard,
    Users,
    Settings,
    Bot,
    Book,
    Code,
    Webhook,
    Database,
    FileText,
    Terminal,
    Shield,
    Puzzle,
    Wallet,
    Trophy,
    Activity,
    Folder,
    UserPlus,
    Zap,
    Megaphone,
    Network,
    Mail,
    LineChart
} from 'lucide-solid';


// Icon mapping for dynamic icon resolution
export const iconMap: Record<string, Component<{ class?: string }>> = {
    LayoutDashboard,
    Users,
    Settings,
    Bot,
    Book,
    Code,
    Webhook,
    Database,
    FileText,
    Terminal,
    Shield,
    Puzzle,
    Wallet,
    Trophy,
    Activity,
    Folder,
    UserPlus,
    Zap,
    Megaphone,
    Network,
    Mail,
    LineChart
};

// Menu item interface with optional children for sub-menus
export interface AdminMenuItem {
    id: string;
    path: string;
    label: string;
    icon: string;
    category: 'core' | 'developer' | 'custom';
    order?: number;
    children?: AdminMenuItem[];
    badge?: string;
    disabled?: boolean;
    /** If set, only users with this role can see this menu item */
    requiredRole?: 'admin';
}

/**
 * Admin Menu Configuration
 * 
 * Developers can extend this configuration by adding new menu items.
 * 
 * Categories:
 * - 'core': Built-in admin pages (Dashboard, Users, Settings)
 * - 'developer': Developer tools (API Docs, Webhooks, etc.)
 * - 'custom': Custom pages added by developers
 * 
 * Example: Adding a new page
 * {
 *   id: 'my-custom-page',
 *   path: '/admin/my-custom-page',
 *   label: 'My Custom Page',
 *   icon: 'Puzzle',
 *   category: 'custom',
 *   order: 100
 * }
 */
export const adminMenuConfig: AdminMenuItem[] = [
    // ===== CORE PAGES =====
    {
        id: 'dashboard',
        path: '/adminsystem',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        category: 'core',
        order: 1
    },
    {
        id: 'users',
        path: '/adminsystem/users',
        label: 'Users',
        icon: 'Users',
        category: 'core',
        order: 2
    },
    {
        id: 'ai-management',
        path: '/adminsystem/ai',
        label: 'AI Management',
        icon: 'Bot',
        category: 'core',
        order: 3
    },
    {
        id: 'referrals',
        path: '/adminsystem/referrals',
        label: 'Referral Engine',
        icon: 'UserPlus',
        badge: 'NEW',
        category: 'core',
        order: 4
    },
    {
        id: 'defi',
        path: '/adminsystem/defi',
        label: 'De-Fi Management',
        icon: 'Zap',
        badge: 'NEW',
        category: 'core',
        order: 5,
        requiredRole: 'admin'
    },
    {
        id: 'wallet-management',
        path: '/adminsystem/wallet',
        label: 'Wallet Control',
        icon: 'Wallet',
        category: 'core',
        order: 6,
        requiredRole: 'admin'
    },
    {
        id: 'campaign-management',
        path: '/adminsystem/campaigns',
        label: 'Campaigns',
        icon: 'Trophy',
        category: 'core',
        order: 7
    },
    {
        id: 'system-activity',
        path: '/adminsystem/activity',
        label: 'Activity Log',
        icon: 'Activity',
        category: 'core',
        order: 8
    },
    {
        id: 'vcn-distribution',
        path: '/adminsystem/vcn',
        label: 'VCN Distribution',
        icon: 'Activity',
        category: 'core',
        order: 9,
        requiredRole: 'admin'
    },
    {
        id: 'documents',
        path: '/adminsystem/documents',
        label: 'Documents',
        icon: 'Folder',
        category: 'core',
        order: 10
    },
    {
        id: 'announcements',
        path: '/adminsystem/announcements',
        label: 'Announcements',
        icon: 'Megaphone',
        badge: 'NEW',
        category: 'core',
        order: 11
    },
    {
        id: 'vcn-settings',
        path: '/adminsystem/vcn-settings',
        label: 'Security Settings',
        icon: 'Shield',
        category: 'custom',
        order: 10,
        requiredRole: 'admin'
    },
    {
        id: 'paymaster',
        path: '/adminsystem/paymaster',
        label: 'Paymaster Ops',
        icon: 'Database',
        category: 'custom',
        order: 9,
        requiredRole: 'admin'
    },
    {
        id: 'bridge-networks',
        path: '/adminsystem/bridge-networks',
        label: 'Bridge Networks',
        icon: 'Network',
        badge: 'NEW',
        category: 'custom',
        order: 11
    },
    {
        id: 'email-management',
        path: '/adminsystem/email',
        label: 'Email Management',
        icon: 'Mail',
        badge: 'NEW',
        category: 'custom',
        order: 12
    },
    {
        id: 'cex-portfolio',
        path: '/adminsystem/cex-portfolio',
        label: 'CEX Portfolio',
        icon: 'LineChart',
        badge: 'NEW',
        category: 'custom',
        order: 13
    },

    // ===== DEVELOPER PAGES =====
    {
        id: 'api-docs',
        path: '/adminsystem/api-docs',
        label: 'API Documentation',
        icon: 'Book',
        category: 'developer',
        order: 10,
        children: [
            {
                id: 'api-rest',
                path: '/adminsystem/api-docs/rest',
                label: 'REST API',
                icon: 'Code',
                category: 'developer'
            },
            {
                id: 'api-webhooks',
                path: '/adminsystem/api-docs/webhooks',
                label: 'Webhooks',
                icon: 'Webhook',
                category: 'developer'
            },
            {
                id: 'api-sdk',
                path: '/adminsystem/api-docs/sdk',
                label: 'SDKs',
                icon: 'Terminal',
                category: 'developer'
            }
        ]
    },
    {
        id: 'traffic-mgmt',
        path: '/adminsystem/traffic',
        label: 'Traffic Simulation',
        icon: 'Activity',
        category: 'developer',
        order: 11,
        requiredRole: 'admin'
    },
    // ===== SETTINGS (always last) =====
    {
        id: 'settings',
        path: '/adminsystem/settings',
        label: 'Settings',
        icon: 'Settings',
        category: 'core',
        order: 999
    }
];

// Helper function to get menu items sorted by order, optionally filtered by role
export const getSortedMenuItems = (role?: 'admin' | 'partner' | 'user') => {
    let items = [...adminMenuConfig];
    if (role && role !== 'admin') {
        items = items.filter(item => !item.requiredRole);
    }
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
};

// Helper function to get icon component by name
export const getIconComponent = (iconName: string) => {
    return iconMap[iconName] || Puzzle;
};
