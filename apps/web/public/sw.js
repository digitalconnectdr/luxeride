// ── Service Worker mínimo: instalabilidad PWA + fallback offline ──────────────
// Conservador: NO cachea agresivamente (evita servir builds viejos). Solo guarda
// una página /offline y la usa cuando una navegación falla por falta de red.

const CACHE = 'luxeride-shell-v1'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL).catch(() => {})) // fallo transitorio no bloquea el SW
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Solo intervenimos navegaciones (documentos). El resto pasa directo a la red.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    )
  }
})
