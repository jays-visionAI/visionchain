import { createContext, useContext, createSignal, onMount, onCleanup, JSX } from 'solid-js';
import type { User } from 'firebase/auth';

// Firebase services are loaded lazily to avoid blocking initial page render (529 KB deferred).
// Static import is replaced with dynamic import() so vendor-firebase only loads when auth initializes.

interface AuthContextType {
    user: () => User | null;
    loading: () => boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, phone?: string, referralCode?: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: JSX.Element }) {
    const [user, setUser] = createSignal<User | null>(null);
    const [loading, setLoading] = createSignal(true);

    // Hold lazy-loaded functions for login/register/logout
    let _userLogin: typeof import('../../services/firebaseService').userLogin | null = null;
    let _userRegister: typeof import('../../services/firebaseService').userRegister | null = null;
    let _userLogout: typeof import('../../services/firebaseService').userLogout | null = null;

    onMount(async () => {
        // Dynamic import – vendor-firebase chunk loads here, not at page load
        const fb = await import('../../services/firebaseService');
        _userLogin = fb.userLogin;
        _userRegister = fb.userRegister;
        _userLogout = fb.userLogout;

        // Listen to standard user auth
        const unsubUser = fb.onUserAuthStateChanged((firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                setLoading(false);
                // Track daily login (fire-and-forget)
                if (firebaseUser.email) {
                    fb.trackUserLogin(firebaseUser.email).catch(() => { });
                }
            } else {
                // If not logged in as user, check if logged in as admin
                const aAuth = fb.getAdminFirebaseAuth();
                if (aAuth.currentUser) {
                    setUser(aAuth.currentUser);
                } else {
                    setUser(null);
                }
                setLoading(false);
            }
        });

        // Also listen to admin auth changes to keep state in sync
        const unsubAdmin = fb.onAdminAuthStateChanged((adminFirebaseUser) => {
            if (adminFirebaseUser && !user()) {
                setUser(adminFirebaseUser);
            } else if (!adminFirebaseUser && user()?.providerId === 'AdminConsole') {
                setUser(null);
            }
        });

        onCleanup(() => {
            unsubUser();
            unsubAdmin();
        });
    });

    const login = async (email: string, password: string) => {
        if (!_userLogin) {
            const fb = await import('../../services/firebaseService');
            _userLogin = fb.userLogin;
        }
        await _userLogin(email, password);
    };

    const register = async (email: string, password: string, phone?: string, referralCode?: string) => {
        if (!_userRegister) {
            const fb = await import('../../services/firebaseService');
            _userRegister = fb.userRegister;
        }
        await _userRegister(email, password, phone, referralCode);
    };

    const logout = async () => {
        if (!_userLogout) {
            const fb = await import('../../services/firebaseService');
            _userLogout = fb.userLogout;
        }
        await _userLogout();
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

