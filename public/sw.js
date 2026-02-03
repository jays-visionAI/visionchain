// Service Worker for Vision Chain PWA
// Version: 1.0.0 - Cache control for proper data fetching

const CACHE_NAME = 'vision-chain-v1';
const STATIC_ASSETS = [
    '/pwa-icon-192.png',
    '/pwa-icon-512.png',
    '/apple-touch-icon.png'
];

// Install event - cache static assets only
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control of all clients immediately
    self.clients.claim();
});

// Fetch event - Network First strategy for everything except static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // API calls (RPC, Firebase, etc.) - ALWAYS network first, no cache
    if (
        url.hostname.includes('api.visionchain.co') ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('firebase.googleapis.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firestore.') ||
        url.pathname.includes('/rpc') ||
        url.pathname.includes('/api/')
    ) {
        // Network only for API requests - never cache
        event.respondWith(
            fetch(event.request).catch(() => {
                // Return error response if network fails
                return new Response(JSON.stringify({ error: 'Network unavailable' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Static assets (images, icons) - Cache first
    if (STATIC_ASSETS.some(asset => url.pathname.includes(asset))) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || fetch(event.request);
            })
        );
        return;
    }

    // HTML and JS files - Network first, fallback to cache
    // This ensures users always get the latest version
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone the response because it can only be consumed once
                const responseClone = response.clone();

                // Only cache successful responses
                if (response.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }

                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Return offline fallback for HTML
                    if (event.request.headers.get('accept')?.includes('text/html')) {
                        return new Response('Offline - Please check your connection', {
                            status: 503,
                            headers: { 'Content-Type': 'text/html' }
                        });
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    // Force refresh - clear all caches
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }).then(() => {
            event.source?.postMessage({ type: 'CACHE_CLEARED' });
        });
    }
});
