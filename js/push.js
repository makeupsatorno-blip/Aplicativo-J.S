/*
 * J.S. — avisos com o app fechado (Web Push).
 * Quando ligado, o app envia ao servidor (supabase/functions/js-push) a inscrição de push
 * deste aparelho e os lembretes dos próximos 14 dias: título, texto e horário. O servidor
 * confere a cada minuto e manda a notificação na hora, mesmo com o app fechado.
 * O app sincroniza de novo sempre que algo muda, ao abrir e a cada 6 horas.
 * Os avisos locais (js/notify.js) continuam funcionando; os dois usam a mesma
 * etiqueta (tag), então o celular mostra só uma notificação por lembrete.
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  var R = window.JSRegras, C = window.JSCore;
  var API = ((window.JS_CONFIG || {}).pushApi || '').replace(/\/+$/, '');
  var DAYS = 14, MAX = 400;
  var syncTimer = null, syncing = null;

  function configured() { return !!API; }
  function secureOrigin() { return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'; }
  function supported() {
    return configured() && secureOrigin() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function info() { return (JS.store.state && JS.store.state.settings.push) || { enabled: false }; }
  function active() { var p = info(); return !!(p.enabled && p.deviceId && p.token); }

  // Por que não dá para ligar aqui (ou null se dá).
  function unavailableReason() {
    if (!configured()) return 'O servidor de avisos ainda não foi configurado.';
    if (!secureOrigin()) return 'Abra o J.S. pelo endereço publicado (https) para usar este recurso.';
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? 'No iPhone, instale o J.S. na tela de início (Compartilhar > Adicionar à Tela de Início) e abra por lá.'
        : 'Este navegador não suporta avisos com o app fechado.';
    }
    return null;
  }

  function randomToken() {
    var b = new Uint8Array(32);
    crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  function b64urlToBytes(s) {
    var pad = '='.repeat((4 - s.length % 4) % 4);
    var raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function sameKey(sub, keyBytes) {
    var k = sub && sub.options && sub.options.applicationServerKey;
    if (!k) return false;
    var a = new Uint8Array(k);
    if (a.length !== keyBytes.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== keyBytes[i]) return false;
    return true;
  }

  var MESSAGES = {
    'invalid-device': 'Identificação do aparelho inválida.', forbidden: 'Este aparelho não foi reconhecido pelo servidor.',
    'unknown-device': 'O servidor não conhece este aparelho; ative de novo.', 'invalid-subscription': 'Inscrição de push inválida.',
    'save-failed': 'O servidor não conseguiu salvar agora.', 'send-failed': 'O serviço de notificações recusou o envio.',
    'server-error': 'Erro no servidor de avisos.'
  };
  function call(path, body) {
    return fetch(API + '/' + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(MESSAGES[j.error] || ('Servidor respondeu ' + r.status + '.'));
        return j;
      });
    }, function () { throw new Error('Sem conexão com o servidor de avisos.'); });
  }

  function savePush(patch) {
    JS.store.silentUpdate(function (s) { s.settings.push = Object.assign({}, s.settings.push || {}, patch); });
  }

  function remindersPayload() {
    return R.upcomingReminders(JS.store.state, new Date(), DAYS).slice(0, MAX).map(function (r) {
      return { key: r.key, at: r.at.toISOString(), title: r.title, body: r.body, route: r.route };
    });
  }

  function syncNow() {
    if (!active() || !supported()) return Promise.resolve();
    if (syncing) return syncing;
    syncing = navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription();
    }).then(function (sub) {
      if (!sub) throw new Error('A inscrição deste aparelho expirou. Desligue e ligue de novo.');
      var p = info();
      var tz = '';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* sem fuso */ }
      return call('sync', { deviceId: p.deviceId, token: p.token, subscription: sub.toJSON(), reminders: remindersPayload(), tz: tz });
    }).then(function (res) {
      savePush({ lastSyncAt: new Date().toISOString(), lastError: null, count: res.count || 0 });
    }).catch(function (e) {
      savePush({ lastError: e.message });
    }).then(function () { syncing = null; refreshConfig(); });
    return syncing;
  }

  function scheduleSync() {
    if (!active()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 2500);
  }

  function enable() {
    var why = unavailableReason();
    if (why) return Promise.reject(new Error(why));
    return JS.notify.request().then(function (perm) {
      if (perm !== 'granted') throw new Error('As notificações não foram permitidas neste navegador.');
      return Promise.all([navigator.serviceWorker.ready, call('public-key')]);
    }).then(function (res) {
      var reg = res[0], key = b64urlToBytes(res[1].publicKey);
      return reg.pushManager.getSubscription().then(function (sub) {
        if (sub && !sameKey(sub, key)) return sub.unsubscribe().then(function () { return null; });
        return sub;
      }).then(function (sub) {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      });
    }).then(function () {
      var p = info();
      savePush({ enabled: true, deviceId: p.deviceId || C.uuid(), token: p.token || randomToken(), lastError: null });
      return syncNow();
    }).then(function () {
      var p = info();
      if (p.lastError) throw new Error(p.lastError);
    });
  }

  function disable() {
    var p = info();
    var server = p.deviceId && p.token ? call('unsubscribe', { deviceId: p.deviceId, token: p.token }).catch(function () {}) : Promise.resolve();
    var local = 'serviceWorker' in navigator && secureOrigin()
      ? navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) { return sub && sub.unsubscribe(); }).catch(function () {})
      : Promise.resolve();
    return Promise.all([server, local]).then(function () {
      JS.store.silentUpdate(function (s) { s.settings.push = { enabled: false }; });
      refreshConfig();
    });
  }

  function test() {
    var p = info();
    return syncNow().then(function () { return call('test', { deviceId: p.deviceId, token: p.token }); });
  }

  // Oferece ligar os avisos com o app fechado, logo depois que a usuária permite notificações.
  function offer() {
    if (active() || unavailableReason() || info().offeredAt) return Promise.resolve();
    savePush({ offeredAt: new Date().toISOString() });
    return JS.ui.confirm({
      title: 'Avisar mesmo com o app fechado?',
      message: 'Para isso, os títulos e horários dos seus lembretes dos próximos 14 dias vão para um servidor seguro, que só os usa para mandar o aviso na hora. Você pode desligar quando quiser em Configurações.',
      confirmLabel: 'Ligar', cancelLabel: 'Agora não'
    }).then(function (ok) {
      if (!ok) return;
      return enable().then(function () { JS.ui.toast('Pronto! Os avisos vão chegar mesmo com o app fechado.'); })
        .catch(function (e) { JS.ui.toast(e.message, { error: true, timeout: 6000 }); });
    });
  }

  function refreshConfig() { if (JS.app && JS.app.route() === 'config') JS.app.render(); }

  function start() {
    JS.store.subscribe(scheduleSync);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') scheduleSync(); });
    setInterval(syncNow, 6 * 3600 * 1000);
    syncNow();
  }

  JS.push = {
    configured: configured, supported: supported, active: active, info: info, unavailableReason: unavailableReason,
    enable: enable, disable: disable, test: test, syncNow: syncNow, offer: offer, start: start
  };
})();
