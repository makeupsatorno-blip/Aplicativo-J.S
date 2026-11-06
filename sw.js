/*
 * J.S. — service worker: deixa o app abrir sem internet e trata o toque nas notificações.
 * Estratégia "rede primeiro": com internet, sempre pega a versão mais nova;
 * sem internet (ou rede muito lenta), usa a cópia guardada.
 * Ao publicar uma versão nova, aumente o número em VERSION.
 */
var VERSION = 'js-v1.3.0';
var ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css', './icons/favicon.svg',
  './js/intro.js', './js/core.js', './js/regras.js', './js/ui.js', './js/anim.js', './js/store.js', './js/notify.js', './js/app.js',
  './js/telas/inicio.js', './js/telas/rotina.js', './js/telas/autocuidado.js', './js/telas/alimentacao.js',
  './js/telas/financeiro.js', './js/telas/agenda.js', './js/telas/config.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/badge-96.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined);
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(new Promise(function (resolve) {
    var settled = false;
    function done(r) { if (!settled && r) { settled = true; resolve(r); } }
    // Rede lenta: depois de 4 s, responde com a cópia guardada (se houver).
    var timer = setTimeout(function () { fromCache(req).then(done); }, 4000);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      done(res);
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (r) { if (!settled) { settled = true; resolve(r || Response.error()); } });
    });
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var route = (event.notification.data && event.notification.data.route) || 'inicio';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) { list[i].postMessage({ type: 'navigate', route: route }); return list[i].focus(); }
    }
    return self.clients.openWindow('./#/' + route);
  }));
});
