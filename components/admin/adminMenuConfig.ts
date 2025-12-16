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
    Puzzle
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
    Puzzle
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
        path: '/admin',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        category: 'core',
        order: 1
    },
    {
        id: 'users',
        path: '/admin/users',
        label: 'Users',
        icon: 'Users',
        category: 'core',
        order: 2
    },
    {
        id: 'ai-management',
        path: '/admin/ai',
        label: 'AI Management',
        icon: 'Bot',
        category: 'core',
        order: 3
    },

    // ===== DEVELOPER PAGES =====
    {
        id: 'api-docs',
        path: '/admin/api-docs',
        label: 'API Documentation',
        icon: 'Book',
        category: 'developer',
        order: 10,
        children: [
            {
                id: 'api-rest',
                path: '/admin/api-docs/rest',
                label: 'REST API',
                icon: 'Code',
                category: 'developer'
            },
            {
                id: 'api-webhooks',
                path: '/admin/api-docs/webhooks',
                label: 'Webhooks',
                icon: 'Webhook',
                category: 'developer'
            },
            {
                id: 'api-sdk',
                path: '/admin/api-docs/sdk',
                label: 'SDKs',
                icon: 'Terminal',
                category: 'developer'
            }
        ]
    },

    // ===== SETTINGS (always last) =====
    {
        id: 'settings',
        path: '/admin/settings',
        label: 'Settings',
        icon: 'Settings',
        category: 'core',
        order: 999
    }
];

// Helper function to get menu items sorted by order
export const getSortedMenuItems = () => {
    return [...adminMenuConfig].sort((a, b) => (a.order || 0) - (b.order || 0));
};

// Helper function to get icon component by name
export const getIconComponent = (iconName: string) => {
    return iconMap[iconName] || Puzzle;
};
