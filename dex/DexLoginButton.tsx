import { createSignal, createEffect, Show, onCleanup } from 'solid-js';
import { getFirebaseAuth } from '../services/firebaseService';
import { A } from '@solidjs/router';

// Simple Login/Connect button for DEX header
export default function DexLoginButton() {
    const [user, setUser] = createSignal<any>(null);
    const [loading, setLoading] = createSignal(true);

    createEffect(() => {
        try {
            const auth = getFirebaseAuth();
            const unsubscribe = auth.onAuthStateChanged((u: any) => {
                setUser(u);
                setLoading(false);
            });
            onCleanup(() => unsubscribe());
        } catch {
            setLoading(false);
        }
    });

    return (
        <Show when={!loading()} fallback={<div class="w-24 h-8 bg-white/5 rounded animate-pulse" />}>
            <Show 
                when={user()} 
                fallback={
                    <A href="/login" class="flex items-center justify-center h-[34px] px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[13px] font-semibold transition-colors">
                        Connect Wallet
                    </A>
                }
            >
                <A href="/wallet" class="flex items-center gap-2 h-[34px] px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[13px] font-medium transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span class="max-w-[100px] truncate">{user()?.email?.split('@')[0] || 'My Account'}</span>
                </A>
            </Show>
        </Show>
    );
}
