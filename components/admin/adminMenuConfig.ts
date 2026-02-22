import { Component, createSignal } from 'solid-js';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';
import { getFirebaseApp } from '../../services/firebaseService';
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
    LineChart,
    Eye,
    Share2,
    Coins,
    Smartphone,
    Server,
    Globe
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
    LineChart,
    Eye,
    Share2,
    Coins,
    Smartphone,
    Server,
    Globe
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
    {
        id: 'vision-insight',
        path: '/adminsystem/vision-insight',
        label: 'Vision Insight',
        icon: 'Eye',
        badge: 'NEW',
        category: 'custom',
        order: 14,
        requiredRole: 'admin'
    },
    {
        id: 'social-media',
        path: '/adminsystem/social-media',
        label: 'Social Media',
        icon: 'Share2',
        badge: 'NEW',
        category: 'custom',
        order: 15,
        requiredRole: 'admin'
    },
    {
        id: 'api-pricing',
        path: '/adminsystem/api-pricing',
        label: 'API Pricing',
        icon: 'Coins',
        badge: 'NEW',
        category: 'custom',
        order: 16,
        requiredRole: 'admin'
    },
    {
        id: 'vision-nodes',
        path: '/adminsystem/vision-nodes',
        label: 'Vision Nodes',
        icon: 'Globe',
        badge: 'NEW',
        category: 'custom',
        order: 16.5,
        requiredRole: 'admin'
    },
    {
        id: 'mobile-nodes',
        path: '/adminsystem/mobile-nodes',
        label: 'Mobile Nodes',
        icon: 'Smartphone',
        badge: 'NEW',
        category: 'custom',
        order: 17,
        requiredRole: 'admin'
    },
    {
        id: 'node-health',
        path: '/adminsystem/node-health',
        label: 'Node Health',
        icon: 'Server',
        category: 'custom',
        order: 18,
        requiredRole: 'admin'
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

// ---------- Partner Menu Visibility (Firestore-backed) ----------
const PARTNER_MENU_DOC = 'admin_settings/partner_menu_access';

// Reactive signal for partner menu visibility
const [partnerMenuAccess, setPartnerMenuAccess] = createSignal<Record<string, boolean>>({});
const [partnerMenuLoaded, setPartnerMenuLoaded] = createSignal(false);

export const getPartnerMenuAccess = () => partnerMenuAccess();
export const isPartnerMenuLoaded = () => partnerMenuLoaded();

// Load partner menu access settings from Firestore
export const loadPartnerMenuAccess = async () => {
    try {
        const db = getFirestore(getFirebaseApp());
        const snap = await getDoc(doc(db, PARTNER_MENU_DOC));
        if (snap.exists()) {
            setPartnerMenuAccess(snap.data() as Record<string, boolean>);
        }
        setPartnerMenuLoaded(true);
    } catch (e) {
        console.warn('[AdminMenu] Failed to load partner menu access:', e);
        setPartnerMenuLoaded(true);
    }
};

// Save partner menu access settings to Firestore
export const savePartnerMenuAccess = async (access: Record<string, boolean>) => {
    try {
        const db = getFirestore(getFirebaseApp());
        await setDoc(doc(db, PARTNER_MENU_DOC), access);
        setPartnerMenuAccess(access);
    } catch (e) {
        console.error('[AdminMenu] Failed to save partner menu access:', e);
        throw e;
    }
};

// Helper function to get menu items sorted by order, optionally filtered by role
export const getSortedMenuItems = (role?: 'admin' | 'partner' | 'user') => {
    let items = [...adminMenuConfig];
    if (role && role !== 'admin') {
        const access = partnerMenuAccess();
        items = items.filter(item => {
            // Settings is always visible
            if (item.id === 'settings') return true;
            // If the item has requiredRole: 'admin', check if partner access is explicitly granted
            if (item.requiredRole === 'admin') {
                return access[item.id] === true;
            }
            // For items without requiredRole, check if partner access is explicitly denied
            return access[item.id] !== false;
        });
    }
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
};

// Get all menu items that can have their visibility toggled for partners
export const getToggleableMenuItems = () => {
    return adminMenuConfig
        .filter(item => item.id !== 'settings') // Settings is always visible
        .sort((a, b) => (a.order || 0) - (b.order || 0));
};

// Helper function to get icon component by name
export const getIconComponent = (iconName: string) => {
    return iconMap[iconName] || Puzzle;
};
