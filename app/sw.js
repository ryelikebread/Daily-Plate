// Service worker: caches the app's own files so it opens offline,
// and opens the diary when a reminder notification is clicked.
const CACHE = 'daily-plate-v15';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'db.js', 'lookup.js', 'sync.js', 'scanner.js', 'vendor/zxing.min.js', 'nutrients.js', 'nutrient-info.js', 'report.js', 'starter-foods.js', 'manifest.webmanifest', 'icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // Precache every file together, bypassing the browser's HTTP cache, so a new
// version is never a mix of old and new files. If any file fails, the install fails
// and the old version keeps running.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // online lookups go straight to the network
  // network first (always revalidated, never the browser's stale HTTP cache) so updates
  // show up at once; the cache is the offline fallback
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./#diary');
  }));
});
