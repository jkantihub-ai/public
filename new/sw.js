const CACHE_NAME = 'mantrachat-static-v1';
const ASSETS = [
  './',
  './index.html',
  './main.js',
  './manifest.json',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
});
