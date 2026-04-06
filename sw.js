/**
 * Service Worker for offline support.
 * Caches app shell on install, then caches remote images as they're viewed.
 */

const CACHE_NAME = "maldives-fish-quiz-v5";
const APP_SHELL = [
    "./",
    "./index.html",
    "./css/style.css",
    "./js/levenshtein.js",
    "./js/images.js",
    "./js/state.js",
    "./js/quiz.js",
    "./js/ui.js",
    "./js/app.js",
    "./data/species.json"
];

// Install: cache app shell
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(APP_SHELL);
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

// Activate: clean old caches
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch: cache-first for images, network-first for app files
self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);

    // For Wikimedia/Wikipedia images: cache-first strategy
    if (url.hostname.includes("wikimedia.org") || url.hostname.includes("wikipedia.org")) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;

                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                }).catch(() => {
                    return new Response("", { status: 404 });
                });
            })
        );
        return;
    }

    // For iNaturalist images: same cache-first strategy
    if (url.hostname.includes("inaturalist.org") || url.hostname.includes("staticflickr.com")) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                }).catch(() => {
                    return new Response("", { status: 404 });
                });
            })
        );
        return;
    }

    // For app shell: network-first with cache fallback
    event.respondWith(
        fetch(event.request).then(response => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clone);
                });
            }
            return response;
        }).catch(() => {
            return caches.match(event.request);
        })
    );
});
