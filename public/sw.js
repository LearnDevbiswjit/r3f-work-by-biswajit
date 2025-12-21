const CACHE_VERSION = __BUILD_HASH__
const CACHE_NAME = `r3f-cache-${CACHE_VERSION}`

const ASSETS = [
  '/models/desktop/Rock-Product.glb',
  '/models/mobile/Rock-Product.glb',
  '/models/desktop/Cloud.glb',
  '/models/mobile/Cloud.glb',
  '/hdr/ocean.hdr'
]

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))
      )
    )
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  )
})
