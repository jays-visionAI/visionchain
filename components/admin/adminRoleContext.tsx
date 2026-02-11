import { createContext, useContext, createSignal, onMount, onCleanup, JSX } from 'solid-js';
import { onAdminAuthStateChanged, getUserRole } from '../../services/firebaseService';

type AdminRole = 'admin' | 'partner' | 'user';

interface AdminRoleContextType {
    adminRole: () => AdminRole;
    isAdmin: () => boolean;
    roleLoading: () => boolean;
}

const AdminRoleContext = createContext<AdminRoleContextType>();

export function AdminRoleProvider(props: { children: JSX.Element }) {
    const [adminRole, setAdminRole] = createSignal<AdminRole>('user');
    const [roleLoading, setRoleLoading] = createSignal(true);

    onMount(() => {
        const unsubscribe = onAdminAuthStateChanged(async (user) => {
            if (user?.email) {
                try {
                    const role = await getUserRole(user.email);
                    setAdminRole(role);
                } catch {
                    setAdminRole('user');
                }
            } else {
                setAdminRole('user');
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
