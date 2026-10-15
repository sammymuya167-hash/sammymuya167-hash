// Keep chat pages, identity, APIs and message content out of the service-worker cache.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#24213b"><title>ShadowChat · Offline</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#faf9fd;color:#675075;font-family:system-ui"><main style="max-width:300px;padding:30px;text-align:center"><h1 style="font-size:26px;font-weight:500">A quiet moment offline.</h1><p style="line-height:1.8;font-size:14px;color:#ab94b8">Reconnect to open ShadowChat. Your encrypted device key is still on this browser.</p><a href="/" style="color:#8d6cab">Try again</a></main></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })));
});
