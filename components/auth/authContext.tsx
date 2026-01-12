import { createContext, useContext, createSignal, onMount, onCleanup, JSX } from 'solid-js';
import { User } from 'firebase/auth';
import {
    getFirebaseAuth,
    adminLogin,
    adminRegister,
    adminLogout,
    onAdminAuthStateChanged
} from '../../services/firebaseService';

interface AuthContextType {
    user: () => User | null;
    loading: () => boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: JSX.Element }) {
    const [user, setUser] = createSignal<User | null>(null);
    const [loading, setLoading] = createSignal(true);

    onMount(() => {
        const unsubscribe = onAdminAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });

        onCleanup(() => unsubscribe());
    });

    const login = async (email: string, password: string) => {
        await adminLogin(email, password);
    };

    const register = async (email: string, password: string) => {
        await adminRegister(email, password);
    };

    const logout = async () => {
        await adminLogout();
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {props.children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
