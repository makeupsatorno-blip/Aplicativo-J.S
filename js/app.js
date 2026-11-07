/* J.S. — inicialização, navegação entre telas, instalação e service worker */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, ui = JS.ui;
  var VERSION = '1.4.0';
  var lastToday = null;
  var deferredInstall = null;

  function route() {
    var r = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return JS.telas[r] ? r : 'inicio';
  }

  function go(r) {
    if (route() === r) { render(); window.scrollTo(0, 0); }
    else location.hash = '#/' + r;
  }

  var TAB_ORDER = ['inicio', 'rotina', 'autocuidado', 'alimentacao', 'financeiro'];
  var lastRoute = null;

  // Direção da animação ao trocar de tela: segue a posição das abas.
  function routeEnter(from, to) {
    var a = TAB_ORDER.indexOf(from), b = TAB_ORDER.indexOf(to);
    if (from == null || a < 0 || b < 0) return 'route:up';
    return b > a ? 'route:r' : 'route:l';
  }

  // opts.enter: animação de entrada ("view", "view:l", "view:r"); trocar de tela anima sozinho.
  function render(opts) {
    opts = opts || {};
    var r = route(), tela = JS.telas[r];
    var main = document.getElementById('main');
    var enter = opts.enter || (r !== lastRoute ? routeEnter(lastRoute, r) : null);
    var routeChanged = r !== lastRoute;
    lastRoute = r;
    try { main.innerHTML = tela.render(new Date()); }
    catch (e) {
      console.error(e);
      main.innerHTML = '<div class="card warn"><strong>Não foi possível montar esta tela.</strong><p class="muted small">' + ui.esc(e.message) + '</p></div>';
    }
    document.title = r === 'inicio' ? 'J.S.' : tela.title + ' • J.S.';
    document.querySelectorAll('[data-route-link]').forEach(function (a) {
      var on = a.dataset.routeLink === r;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var fab = document.getElementById('fab');
    if (tela.fab) {
      var wasHidden = fab.hidden;
      fab.hidden = false; fab.setAttribute('aria-label', tela.fab.label); fab.title = tela.fab.label; fab.dataset.action = tela.fab.action;
      if (wasHidden || routeChanged) JS.anim.restartClass(fab, 'fab-in');
    } else fab.hidden = true;
    if (tela.after) tela.after(main);
    JS.anim.afterRender(main, enter);
  }

  // Quando vira o dia: gera próximas contas recorrentes e redesenha.
  function checkDay(forceRender) {
    var t = C.toDateKey(new Date());
    if (t !== lastToday) {
      lastToday = t;
      JS.store.update(function (s, n) { R.ensureRecurringBills(s, t, n); });
    } else if (forceRender === true) render();
  }

  function isStandalone() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function install() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall.userChoice.then(function () { deferredInstall = null; render(); }, function () { deferredInstall = null; render(); });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol.indexOf('http') !== 0) return;
    navigator.serviceWorker.register('sw.js').catch(function (err) { console.warn('Service worker não registrado:', err); });
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'navigate' && e.data.route) go(e.data.route);
    });
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el || el.closest('dialog')) return;
      var fn = JS.actions[el.dataset.action];
      if (!fn) return;
      e.preventDefault();
      fn(Object.assign({}, el.dataset), el, e);
    });
    document.addEventListener('change', function (e) {
      var el = e.target.closest('[data-change]');
      if (!el || el.closest('dialog')) return;
      var fn = JS.changes[el.dataset.change];
      if (fn) fn(el, e);
    });
    // Fecha a folha ao tocar fora dela ou com Esc, com a animação de saída.
    var sheet = document.getElementById('sheet'), confirmDlg = document.getElementById('confirm');
    sheet.addEventListener('click', function (e) { if (e.target === sheet) ui.closeSheet(); });
    sheet.addEventListener('cancel', function (e) { e.preventDefault(); ui.closeSheet(); });
    confirmDlg.addEventListener('click', function (e) { if (e.target === confirmDlg) ui.cancelConfirm(); });
    confirmDlg.addEventListener('cancel', function (e) { e.preventDefault(); ui.cancelConfirm(); });
    window.addEventListener('hashchange', function () { ui.closeSheet(); render(); window.scrollTo(0, 0); });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; render(); });
    window.addEventListener('appinstalled', function () { deferredInstall = null; ui.toast('J.S. instalado na tela inicial!'); render(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkDay(true); });
    setInterval(checkDay, 30000);
  }

  function init() {
    JS.store.load();
    lastToday = C.toDateKey(new Date());
    JS.store.silentUpdate(function (s, n) { R.ensureRecurringBills(s, lastToday, n); });
    JS.store.subscribe(render);
    bindEvents();
    render();
    registerServiceWorker();
    // Avisos e lembretes só depois da intro, para não aparecerem por cima dela.
    JS.intro.whenDone(function () {
      if (JS.store.loadError) ui.toast(JS.store.loadError, { error: true, timeout: 9000 });
      JS.notify.start();
    });
    JS.push.start();
  }

  JS.app = {
    VERSION: VERSION, render: render, go: go, route: route, install: install, isStandalone: isStandalone, isIOS: isIOS,
    canInstall: function () { return !!deferredInstall; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
