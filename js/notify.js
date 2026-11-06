/*
 * J.S. — lembretes.
 * Enquanto o app está aberto (ou recém-minimizado), confere a cada 20 segundos
 * se algum lembrete chegou e mostra a notificação. Nada é agendado no sistema:
 * por isso editar, concluir ou excluir já "cancela" o aviso automaticamente.
 * Limitação da web: com o app totalmente fechado, o navegador não executa o
 * código, e o aviso aparece quando o app for aberto (se tiver até 2 horas).
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  var R = window.JSRegras;
  var timer = null;

  function supported() { return 'Notification' in window; }
  function permission() { return supported() ? Notification.permission : 'unsupported'; }

  function request() {
    if (!supported()) return Promise.resolve('unsupported');
    try {
      var p = Notification.requestPermission();
      return p && p.then ? p : Promise.resolve(Notification.permission);
    } catch (e) { return Promise.resolve(Notification.permission); }
  }

  function show(title, body, tag, route) {
    var opts = { body: body, tag: tag, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { route: route || 'inicio' } };
    function fallback() { try { new Notification(title, opts); } catch (e) { /* Android exige service worker */ } }
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      return navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg && reg.showNotification) return reg.showNotification(title, opts);
        fallback();
      }).catch(fallback);
    }
    fallback();
    return Promise.resolve();
  }

  function check() {
    var state = JS.store.state;
    if (!state) return;
    var now = new Date();
    var due = R.dueReminders(R.computeReminders(state, now), now, state.firedReminders);
    if (!due.length) return;
    JS.store.silentUpdate(function (s) {
      due.forEach(function (r) { s.firedReminders[r.key] = now.toISOString(); });
      R.pruneFired(s.firedReminders, now, 14);
    });
    var inFront = document.visibilityState === 'visible' && document.hasFocus();
    due.forEach(function (r) {
      if (inFront || permission() !== 'granted') JS.ui.toast(r.title, { timeout: 6000 });
      else show(r.title, r.body, r.key, r.route);
    });
  }

  function start() {
    if (timer) return;
    check();
    timer = setInterval(check, 20000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
  }

  var askedThisSession = false, warnedDenied = false;
  var ASK_AGAIN_DAYS = 7;
  // Pede permissão no contexto: só quando a usuária cria um lembrete. Se ela disser
  // "Agora não", o J.S. não pergunta de novo por 7 dias (dá para ativar em Configurações).
  function askIfNeeded() {
    var p = permission();
    if (p === 'default') {
      var dismissed = JS.store.state.settings.notifPromptDismissedAt;
      if (askedThisSession || (dismissed && Date.now() - new Date(dismissed).getTime() < ASK_AGAIN_DAYS * 86400000)) return Promise.resolve();
      askedThisSession = true;
      return JS.ui.confirm({
        title: 'Receber lembretes?',
        message: 'Para avisar no horário que você escolheu, o J.S. precisa da permissão de notificações deste navegador.',
        confirmLabel: 'Permitir', cancelLabel: 'Agora não'
      }).then(function (ok) {
        if (!ok) {
          JS.store.silentUpdate(function (s, n) { s.settings.notifPromptDismissedAt = n; });
          JS.ui.toast('Tudo bem. Você pode ativar depois em Configurações.');
          return;
        }
        return request().then(function (res) {
          if (res === 'granted') JS.ui.toast('Pronto! Os lembretes vão aparecer como notificação.');
          else JS.ui.toast('Cadastro salvo, mas as notificações foram bloqueadas. Os avisos aparecerão só dentro do app.', { timeout: 6000 });
          JS.app.render();
        });
      });
    }
    if (p === 'denied' && !warnedDenied) {
      warnedDenied = true;
      JS.ui.toast('Cadastro salvo. As notificações estão bloqueadas neste navegador; os avisos aparecerão só dentro do app.', { timeout: 6000 });
    }
    return Promise.resolve();
  }

  JS.notify = { supported: supported, permission: permission, request: request, show: show, check: check, start: start, askIfNeeded: askIfNeeded };
})();
