import { lazy, Suspense, JSX } from 'solid-js';

// Auth components
export const Login = lazy(() => import('../components/auth/Login'));
export const Signup = lazy(() => import('../components/auth/Signup'));
export const AdminLogin = lazy(() => import('../components/auth/AdminLogin'));
export const ActivateAccount = lazy(() => import('../components/auth/ActivateAccount'));

// Loading spinner component
function PageLoader() {
    return (
        <div class="min-h-screen flex items-center justify-center">
            <div class="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
    );
}

export function AdminLoginPage() {
    document.title = 'Admin HQ | Vision Chain';
    return (
        <Suspense fallback={<PageLoader />}>
            <AdminLogin />
        </Suspense>
    );
}

export function LoginPage() {
    document.title = 'Login | Vision Chain';
    return (
        <Suspense fallback={<PageLoader />}>
            <Login />
        </Suspense>
    );
}

export function SignupPage() {
    document.title = 'Signup | Vision Chain';
    return (
        <Suspense fallback={<PageLoader />}>
            <Signup />
        </Suspense>
    );
}

export function ActivatePage() {
    document.title = 'Activate Account | Vision Chain';
    return (
        <Suspense fallback={<PageLoader />}>
            <ActivateAccount />
        </Suspense>
    );
}
