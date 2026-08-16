// Web push registration.
//
// Until now the app could not bring anyone back: `firebase/messaging` was
// never imported, public/sw.js had no push handler, and the settings toggle
// was a disabled "Coming soon". The only outbound channel was Gmail SMTP,
// which does not scale and does not reach a phone. Retention is loop quality
// multiplied by the ability to summon, and the second term was zero — which is
// why the daily hub alone would move D1 and leave D7/D30 flat.
//
// Requires a Web Push certificate (VAPID key pair) from
// Firebase Console → Project settings → Cloud Messaging → Web configuration.
// Without it `getToken` cannot mint a subscription, so every entry point here
// degrades to "unsupported" rather than throwing: the feature stays visibly
// off instead of half-working.

import { getFirebaseApp, getFirebaseAuth, getFirebaseDb } from './firebaseService';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export type PushSupport =
    | 'ready'          // permission granted and a token is registered
    | 'prompt'         // supported, awaiting the user's decision
    | 'denied'         // the user blocked notifications
    | 'unconfigured'   // no VAPID key in this build
    | 'unsupported';   // browser/platform cannot do web push

/** Whether this build+browser can do web push at all. */
export function pushSupport(): PushSupport {
    if (!VAPID_KEY) return 'unconfigured';
    if (typeof window === 'undefined') return 'unsupported';
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return 'unsupported';
    }
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'granted') return 'ready';
    return 'prompt';
}

/**
 * Ask for permission and register an FCM token for the signed-in user.
 * Returns true when a token was stored.
 *
 * Reuses the app's existing service worker registration rather than adding
 * firebase-messaging-sw.js: one worker is easier to reason about, and the
 * server sends data-only messages that public/sw.js renders itself.
 */
export async function enablePush(): Promise<boolean> {
    if (pushSupport() === 'unconfigured' || pushSupport() === 'unsupported') return false;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return false;

        const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
        if (!(await isSupported())) return false;

        const registration = await navigator.serviceWorker.ready;
        const messaging = getMessaging(getFirebaseApp());
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
        });
        if (!token) return false;

        const email = getFirebaseAuth()?.currentUser?.email?.toLowerCase();
        if (!email) return false;

        // Keyed by token, not by user: one account legitimately has several
        // devices, and keying by user would silently unsubscribe the phone the
        // moment the same person enabled push on a laptop.
        await setDoc(doc(getFirebaseDb(), 'fcm_tokens', token), {
            token,
            userId: email,
            platform: navigator.userAgent.slice(0, 200),
            enabled: true,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        localStorage.setItem('vcn_push_token', token);
        return true;
    } catch (e) {
        console.error('[Push] enable failed:', e);
        return false;
    }
}

/** Stop sending to this device. Leaves other devices of the same user alone. */
export async function disablePush(): Promise<void> {
    const token = localStorage.getItem('vcn_push_token');
    if (!token) return;
    try {
        await deleteDoc(doc(getFirebaseDb(), 'fcm_tokens', token));
    } catch (e) {
        console.warn('[Push] disable failed:', e);
    } finally {
        localStorage.removeItem('vcn_push_token');
    }
}

/** True when this device currently has a registered token. */
export function isPushEnabledHere(): boolean {
    return !!localStorage.getItem('vcn_push_token') && Notification?.permission === 'granted';
}
