const CACHE_NAME = 'finty-cache-v1';

self.addEventListener('install', (e) => {
    console.log('Finty: Service Worker Instalado');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('Finty: Service Worker Activado');
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Deja pasar todas las peticiones a la API y la web normalmente
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});