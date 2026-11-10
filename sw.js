/*
 * J.S. — service worker: deixa o app abrir sem internet e trata o toque nas notificações.
 * Estratégia "rede primeiro": com internet, sempre pega a versão mais nova;
 * sem internet (ou rede muito lenta), usa a cópia guardada.
 * Ao publicar uma versão nova, aumente o número em VERSION.
 */
var VERSION = 'js-v2.6.1';
var ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css', './css/v2.css', './css/v26.css', './icons/favicon.svg',
  './fonts/nunito-latin.woff2', './fonts/cormorant-garamond-italic-latin.woff2',
  './js/config.js', './js/intro.js', './js/core.js', './js/regras.js', './js/ui.js', './js/anim.js', './js/store.js',
  './js/notify.js', './js/push.js', './js/app.js', './js/graficos.js', './js/toque.js',
  './js/regras-treino.js', './js/regras-corpo.js', './js/regras-nutricao.js', './js/regras-ciclo.js', './js/fotos.js',
  './js/dados/exercicios.js', './js/exanim.js', './js/dados/animacoes.js', './js/dados/treinos.js', './js/dados/alimentos.js', './js/dados/cardapios.js',
  './js/telas/inicio.js', './js/telas/rotina.js', './js/telas/autocuidado.js', './js/telas/alimentacao.js',
  './js/telas/financeiro.js', './js/telas/agenda.js', './js/telas/config.js',
  './js/telas/treino.js', './js/telas/sessao.js', './js/telas/corpo.js', './js/telas/graficos.js', './js/telas/mais.js', './js/telas/ciclo.js', './js/telas/busca.js', './js/registro.js', './rapido.html',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/badge-96.png'
];

self.addEventListener('install', function (event) {
  // Se o cache falhar (ex.: sem espaço), instala mesmo assim: notificações e push
  // continuam funcionando, e o cache se completa com o uso (estratégia "rede primeiro").
  // cache: 'reload' busca direto no servidor, sem a cópia de 10 min que o GitHub Pages
  // manda o navegador guardar; assim a versão nova não fica com arquivos antigos.
  event.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  })
    .catch(function (err) { console.warn('Cache offline incompleto:', err && err.message); })
    .then(function () { return self.skipWaiting(); }));
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
    // no-cache: sempre confere com o servidor (resposta rápida "304" quando nada mudou).
    var fresh = req.mode === 'navigate'
      ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      : fetch(new Request(req, { cache: 'no-cache' }));
    fresh.then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      done(res);
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (r) { if (!settled) { settled = true; resolve(r || Response.error()); } });
    });
  }));
});

// Aviso vindo do servidor (js-push), mesmo com o app fechado.
// A "tag" é a mesma do aviso local: o celular mostra uma notificação só por lembrete.
self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  var opts = { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { route: d.route || 'inicio' } };
  if (d.tag) opts.tag = d.tag;
  event.waitUntil(self.registration.showNotification(d.title || 'J.S.', opts));
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
