// Authenticated agentGateway client.
//
// P0 SECURITY: the settlement/ops gateway actions (reward_engine.run,
// revenue.set, snapshot.approve, payout.generate, fx_rate.set, abuse.*, …)
// used to be listed in the server's `skipAgentAuth` array, i.e. callable by
// anyone with curl and no credential at all. They are now behind an admin gate
// (Firebase ID token + email whitelist) plus a general "some credential"
// check. Every caller therefore has to attach the signed-in user's ID token.
//
// The admin console and the node reward panels previously sent
// `{ 'Content-Type': 'application/json' }` and nothing else, so they must go
// through here or they will start getting 401/403.

import { ENV } from './envConfig';

// NOTE: firebaseService imports THIS module (addRewardPoints -> rp.award), so
// the auth handle is pulled in lazily at call time rather than at module
// evaluation. A static import here would close a cycle and leave one of the
// two modules half-initialised depending on which is loaded first.

export const gatewayUrl = (): string =>
    ENV === 'staging'
        ? 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway'
        : 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';

/** Current user's Firebase ID token, or '' when signed out. Never throws. */
export async function idToken(): Promise<string> {
    try {
        const { getFirebaseAuth } = await import('./firebaseService');
        const user = getFirebaseAuth()?.currentUser;
        return user ? await user.getIdToken() : '';
    } catch {
        return '';
    }
}

/**
 * POST an action to agentGateway with the caller's Firebase ID token attached.
 * `apiKey` is for node clients that authenticate with a `vcn_*` key instead.
 */
export async function gatewayCall<T = any>(
    action: string,
    body: Record<string, unknown> = {},
    opts: { apiKey?: string } = {},
): Promise<T> {
    const payload: Record<string, unknown> = { action, ...body };
    if (opts.apiKey) payload.api_key = opts.apiKey;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // A node api_key is its own credential; don't shadow it with a user token.
    if (!opts.apiKey) {
        const token = await idToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(gatewayUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    // Surface auth failures as data rather than throwing, so existing callers
    // that only check `data.success` degrade to "no data" instead of crashing.
    if (res.status === 401 || res.status === 403) {
        let msg = res.status === 401 ? 'Sign-in required' : 'Not authorized';
        try {
            msg = (await res.json())?.error || msg;
        } catch { /* non-JSON body */ }
        console.warn(`[gateway] ${action} -> ${res.status}: ${msg}`);
        return { success: false, error: msg } as T;
    }
    return res.json() as Promise<T>;
}
