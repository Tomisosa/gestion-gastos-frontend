const CACHE_NAME = 'finty-cache-v1';

// 1. Cuando se instala la app, guardamos lo básico en la memoria del celular
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                './',
                './index.html',
                './css/styles.css',
                './finty-logo.png'
            ]);
        })
    );
});

// 2. LA MAGIA QUE PIDE PWABUILDER: El evento "fetch"
// Intenta buscar en internet. Si no hay internet, muestra lo guardado en caché.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});