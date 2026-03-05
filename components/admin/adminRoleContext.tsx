import { createContext, useContext, createSignal, onMount, onCleanup, JSX } from 'solid-js';
import { onAdminAuthStateChanged, getUserRole } from '../../services/firebaseService';

type AdminRole = 'admin' | 'partner' | 'user';

interface AdminRoleContextType {
    adminRole: () => AdminRole;
    isAdmin: () => boolean;
    roleLoading: () => boolean;
}

const AdminRoleContext = createContext<AdminRoleContextType>();

// Cache key for sessionStorage
const ROLE_CACHE_KEY = 'admin_role_cache';

function getCachedRole(): AdminRole | null {
    try {
        const cached = sessionStorage.getItem(ROLE_CACHE_KEY);
        if (cached) {
            const { role, email, ts } = JSON.parse(cached);
            // Cache valid for 10 minutes
            if (Date.now() - ts < 10 * 60 * 1000) return role;
        }
    } catch { }
    return null;
}

function setCachedRole(role: AdminRole, email: string) {
    try {
        sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ role, email, ts: Date.now() }));
    } catch { }
}

export function AdminRoleProvider(props: { children: JSX.Element }) {
    const cached = getCachedRole();
    const [adminRole, setAdminRole] = createSignal<AdminRole>(cached || 'user');
    const [roleLoading, setRoleLoading] = createSignal(!cached);

    onMount(() => {
        const unsubscribe = onAdminAuthStateChanged(async (user) => {
            if (user?.email) {
                try {
                    const role = await getUserRole(user.email);
                    setAdminRole(role);
                    setCachedRole(role, user.email);
                } catch {
                    setAdminRole('user');
                }
            } else {
                setAdminRole('user');
                try { sessionStorage.removeItem(ROLE_CACHE_KEY); } catch { }
            }
            setRoleLoading(false);
        });

        onCleanup(() => unsubscribe());
    });

    const isAdmin = () => adminRole() === 'admin';

    return (
        <AdminRoleContext.Provider value={{ adminRole, isAdmin, roleLoading }}>
            {props.children}
        </AdminRoleContext.Provider>
    );
}

export function useAdminRole() {
    const context = useContext(AdminRoleContext);
    if (!context) {
        throw new Error('useAdminRole must be used within an AdminRoleProvider');
    }
    return context;
}
