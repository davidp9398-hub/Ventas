/* Ventas · El Mero Mero — service worker (modo sin conexión)
   Guarda la app en el teléfono para que abra aunque no haya internet.
   Los datos del negocio NO se guardan aquí: viajan directo a Supabase. */
var CACHE = 'ventas-v5';
var LIBS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    var c = await caches.open(CACHE);
    await Promise.all(['./', './index.html'].map(function (u) { return c.add(u).catch(function () {}); }));
    await Promise.all(LIBS.map(function (u) { return c.add(new Request(u, {mode: 'no-cors'})).catch(function () {}); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var ks = await caches.keys();
    await Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

function conTiempo(p, ms) {
  return new Promise(function (res, rej) {
    var t = setTimeout(function () { rej(new Error('tiempo agotado')); }, ms);
    p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (url.origin === self.location.origin) {
    /* Archivos de la app: primero la red (así siempre ves la versión más nueva);
       si no hay internet o tarda mucho, se usa la copia guardada. */
    e.respondWith((async function () {
      try {
        var r = await conTiempo(fetch(req), 4000);
        if (r && r.ok) { var c = await caches.open(CACHE); c.put(req, r.clone()); }
        return r;
      } catch (err) {
        var m = await caches.match(req, {ignoreSearch: true});
        if (!m && req.mode === 'navigate') m = await caches.match('./index.html');
        if (m) return m;
        throw err;
      }
    })());
    return;
  }

  if (LIBS.indexOf(req.url) >= 0) {
    /* Librerías: primero la copia guardada. */
    e.respondWith((async function () {
      var m = await caches.match(req);
      if (m) return m;
      var r = await fetch(req);
      var c = await caches.open(CACHE); c.put(req, r.clone());
      return r;
    })());
  }
  /* Todo lo demás (por ejemplo, las llamadas a Supabase) pasa directo y no se guarda. */
});
