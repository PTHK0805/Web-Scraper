// public/sw.js

const CACHE_NAME = 'media-extractor-cache-v1'; // Example cache name if you add caching later
const START_URL = '/'; // Should match your manifest's start_url

// --- 1. Lifecycle Event: Install ---
// Fired when the service worker is first installed or updated.
self.addEventListener('install', (event) => {
    console.log('SW: Install event');
    // Optional: Pre-cache essential assets for offline use here
    // event.waitUntil(
    //   caches.open(CACHE_NAME).then((cache) => {
    //     console.log('SW: Pre-caching app shell');
    //     return cache.addAll([
    //       START_URL,
    //       '/manifest.json',
    //       '/icons/icon-192x192.png', // Add paths to essential assets
    //       // Add other core CSS, JS, fonts etc.
    //     ]);
    //   })
    // );

    // Optional: Force the waiting service worker to become the active service worker.
    // Use with caution, might disrupt existing tabs if assets change significantly.
    // event.waitUntil(self.skipWaiting());
});

// --- 2. Lifecycle Event: Activate ---
// Fired after installation when the service worker takes control.
// Good place for cleaning up old caches.
self.addEventListener('activate', (event) => {
    console.log('SW: Activate event');
    // Optional: Clean up old caches
    // event.waitUntil(
    //   caches.keys().then((cacheNames) => {
    //     return Promise.all(
    //       cacheNames.map((cacheName) => {
    //         if (cacheName !== CACHE_NAME) { // Delete caches other than the current one
    //           console.log('SW: Deleting old cache:', cacheName);
    //           return caches.delete(cacheName);
    //         }
    //       })
    //     );
    //   })
    // );

    // Optional: Ensures the activated SW takes control of the page immediately.
    event.waitUntil(self.clients.claim());
});

// --- 3. Lifecycle Event: Fetch ---
// Fired for every network request made by pages controlled by the SW.
// **REQUIRED for PWA installability check, even if basic.**
// self.addEventListener('fetch', (event) => {
//     // console.log('SW: Fetching', event.request.url);
//
//     // Example: Basic Cache-First strategy for assets (adapt as needed)
//     // For API calls, you'll likely want Network-First or Network-Only.
//     // if (event.request.method === 'GET') { // Only cache GET requests usually
//     //   event.respondWith(
//     //     caches.match(event.request).then((cachedResponse) => {
//     //       if (cachedResponse) {
//     //         // console.log('SW: Serving from cache:', event.request.url);
//     //         return cachedResponse; // Return cached asset
//     //       }
//     //       // console.log('SW: Fetching from network:', event.request.url);
//     //       return fetch(event.request).then(
//     //         (networkResponse) => {
//     //           // Optional: Cache the new response
//     //           // if (networkResponse && networkResponse.status === 200) {
//     //           //   const responseToCache = networkResponse.clone();
//     //           //   caches.open(CACHE_NAME).then((cache) => {
//     //           //     cache.put(event.request, responseToCache);
//     //           //   });
//     //           // }
//     //           return networkResponse;
//     //         }
//     //       ).catch(error => {
//     //            console.error('SW: Fetch failed; returning offline page instead.', error);
//     //           // Optional: return an offline fallback page/response
//     //           // return caches.match('/offline.html');
//     //         });
//     //     })
//     //   );
//     // } else {
//     // For non-GET requests, just fetch from network
//     event.respondWith(fetch(event.request));
//     // }
//
//     // --- OR: Simplest pass-through fetch handler (meets installability requirement) ---
//     // event.respondWith(fetch(event.request));
//
// });


// --- 4. Push Notification Event ---
self.addEventListener('push', function (event) {
    console.log('SW: Push Received.');
    if (!event.data) {
        console.error('SW: Push event but no data');
        // Optionally show a generic notification
        // const title = "Notification";
        // const options = { body: "You have a new update.", icon: "/icons/icon-192x192.png" };
        // event.waitUntil(self.registration.showNotification(title, options));
        return;
    }

    let data = {};
    try {
        data = event.data.json(); // Assume JSON payload
        console.log('SW: Push data parsed:', data);
    } catch (e) {
        console.error('SW: Failed to parse push data as JSON.', e);
        // Attempt to show notification with raw text data as body
        const title = "Notification";
        const options = {
            body: data.message || "You received a notification.",
            icon: '/web-app-manifest-192x192.png', // Default icon path
            badge: '/icons/badge-72x72.png' // Default badge path
        };
        event.waitUntil(self.registration.showNotification(title, options));
        return;
    }

    const title = data.title || 'Media Extractor'; // Default title
    const options = {
        body: data.message || 'You have a new notification.', // Use 'message' from your example code
        icon: data.icon || '/web-app-manifest-192x192.png', // Ensure this icon exists
        badge: data.badge || '/icons/badge-72x72.png', // Ensure this badge exists
        vibrate: data.vibrate || [100, 50, 100], // Allow overriding vibration
        // 'data' holds custom data for the notification click event
        data: {
            url: data.url || START_URL, // Pass a target URL from payload, default to start_url
            dateOfArrival: Date.now(),
            ...(data.data || {}), // Include any other custom data sent in payload's 'data' field
        },
        // Other potential options from payload:
        // image: data.image,
        // actions: data.actions,
        // tag: data.tag,
        // renotify: data.renotify
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// --- 5. Notification Click Event ---
self.addEventListener('notificationclick', function (event) {
    console.log('SW: Notification click Received.');
    const clickedNotification = event.notification;
    clickedNotification.close(); // Close the notification

    // Get the URL to open from the notification's data property
    const targetUrl = clickedNotification.data?.url || START_URL; // Use data.url or fallback
    console.log("SW: Target URL for click:", targetUrl)

    // Check if a window/tab matching the target URL is already open
    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then(function(windowClients) {
        let matchingClient = null;
        for (let i = 0; i < windowClients.length; i++) {
            const windowClient = windowClients[i];
            // Check if the client URL loosely matches the target URL's origin or path
            // You might need more sophisticated matching depending on your needs
            if (windowClient.url && windowClient.url.startsWith(self.location.origin) && windowClient.url.includes(targetUrl.replace(self.location.origin, ''))) {
                matchingClient = windowClient;
                break;
            }
        }

        // If a matching window is found, focus it
        if (matchingClient) {
            console.log('SW: Focusing existing window:', matchingClient.url);
            return matchingClient.focus();
        } else {
            // Otherwise, open a new window/tab
            console.log('SW: Opening new window:', targetUrl);
            return clients.openWindow(targetUrl);
        }
    });

    event.waitUntil(promiseChain);
});