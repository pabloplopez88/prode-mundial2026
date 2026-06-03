const CACHE_NAME = 'prode-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (!e.request.url.startsWith(self.location.origin)) return
  e.respondWith(
    fetch(e.request).then(response => {
      const clone = response.clone()
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
      return response
    }).catch(() => caches.match(e.request))
  )
})
