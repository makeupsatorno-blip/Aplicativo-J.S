/* J.S. — Configurações: nome, notificações, instalação, backup e dados */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, ui = JS.ui, esc = ui.esc;

  var PERM_TEXT = {
    granted: ['Ativadas', 'success'], denied: ['Bloqueadas no navegador', 'danger'],
    'default': ['Ainda não ativadas', 'soft'], unsupported: ['Não suportadas aqui', 'muted']
  };

  function sw(name, label, checked, hint, change, extra) {
    return '<label class="switch-row"><span class="switch-text"><strong>' + esc(label) + '</strong>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</span>' +
      '<input type="checkbox" class="switch" data-change="' + change + '"' + (extra || '') + ' name="' + esc(name) + '"' + (checked ? ' checked' : '') + '></label>';
  }

  function installBlock() {
    if (JS.app.isStandalone()) return '<p class="ok-line">' + ui.icon('check', 16) + ' O J.S. está instalado e aberto como aplicativo.</p>';
    var html = '';
    if (JS.app.canInstall()) html += '<button type="button" class="btn primary full" data-action="install">' + ui.icon('phone', 18) + 'Instalar o J.S. neste aparelho</button>';
    if (location.protocol === 'file:') {
      html += '<p class="hint">Você abriu o arquivo direto do computador. Para instalar no celular, o J.S. precisa estar publicado em um endereço https (veja o arquivo README.md).</p>';
    } else if (JS.app.isIOS()) {
      html += '<p class="hint">No iPhone: abra no Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p>';
    } else if (!JS.app.canInstall()) {
      html += '<p class="hint">No Android: abra no Chrome, toque no menu <strong>⋮</strong> e escolha <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).</p>';
    }
    return html;
  }

  function render() {
    var s = JS.store.state, st = s.settings, n = st.notifications;
    var perm = JS.notify.permission();
    var pt = PERM_TEXT[perm] || PERM_TEXT.unsupported;
    var canShare = !!(navigator.canShare && window.File);
    var html = '<h1 class="page-title">Configurações</h1>';

    html += '<section class="card"><div class="card-head"><h2>Você</h2></div>' +
      '<div class="field"><label for="cfg-name">Nome no painel</label><input id="cfg-name" type="text" maxlength="40" value="' + esc(st.name || '') + '" data-change="cfg-name" placeholder="Seu nome"></div></section>';

    html += '<section class="card"><div class="card-head"><h2>' + ui.icon('phone', 18) + 'Aplicativo</h2></div>' + installBlock() +
      sw('intro', 'Intro animada ao abrir', st.intro !== false, 'Mostra a logo animada quando o app abre ou volta depois de 5 minutos fora.', 'cfg-intro') +
      (systemReducesMotion()
        ? sw('animations', 'Animações sempre ligadas', st.animations === 'on', 'Este aparelho está configurado para mostrar menos animações: a intro aparece sem os anéis girando e as pétalas flutuando. Ligue para ver a versão completa.', 'cfg-animations')
        : '') +
      '<button type="button" class="btn soft full" data-action="intro-play">' + ui.icon('sparkle', 18) + 'Ver a intro agora</button></section>';

    html += '<section class="card"><div class="card-head"><h2>' + ui.icon('bell', 18) + 'Notificações</h2>' + ui.tag(pt[0], pt[1]) + '</div>' +
      (perm === 'default' ? '<button type="button" class="btn primary full" data-action="notif-enable">Ativar notificações</button>' : '') +
      (perm === 'denied' ? '<p class="hint">Para liberar, toque no cadeado ao lado do endereço (ou em Configurações do site) e permita notificações.</p>' : '') +
      (perm === 'granted' ? '<button type="button" class="btn soft full" data-action="notif-test">Enviar notificação de teste</button>' : '') +
      sw('task', 'Rotina', n.task !== false, 'Tarefas com horário', 'cfg-notif') +
      sw('hair', 'Autocuidado', n.hair !== false, 'Tratamentos capilares', 'cfg-notif') +
      sw('meal', 'Alimentação', n.meal !== false, 'Horários de refeição', 'cfg-notif') +
      sw('bill', 'Financeiro', n.bill !== false, 'Vencimento de contas', 'cfg-notif') +
      sw('showAmounts', 'Mostrar valor das contas', !!st.showAmountsInNotifications, 'Por privacidade, vem desligado: o valor não aparece na tela bloqueada.', 'cfg-amounts') +
      '<p class="hint">Como funciona: os avisos aparecem enquanto o J.S. está aberto ou em segundo plano. Se o app estiver totalmente fechado, o celular pode não mostrar o aviso na hora; ao abrir, o J.S. mostra o que ficou pendente. Android e iPhone também podem atrasar avisos no modo economia de bateria.</p>' +
      '</section>';

    html += '<section class="card"><div class="card-head"><h2>' + ui.icon('utensils', 18) + 'Alimentação</h2></div>' +
      sw('mealHistory', 'Registrar refeições feitas', st.mealHistory !== false, 'Mostra o botão de marcar como feita e um histórico simples.', 'cfg-mealhistory') + '</section>';

    html += '<section class="card"><div class="card-head"><h2>' + ui.icon('shield', 18) + 'Backup</h2></div>' +
      '<p class="muted small">' + (st.lastBackupAt ? 'Último backup: ' + esc(C.formatTimestamp(st.lastBackupAt)) : 'Nenhum backup feito ainda.') + '</p>' +
      '<p class="hint">Seus dados ficam só neste aparelho, neste navegador. Se você limpar os dados do navegador, trocar de celular ou desinstalar o app, eles se perdem, a menos que exista um backup.</p>' +
      '<div class="btn-col">' +
      '<button type="button" class="btn primary" data-action="backup-export">' + ui.icon('download', 18) + 'Salvar backup (arquivo)</button>' +
      (canShare ? '<button type="button" class="btn soft" data-action="backup-share">' + ui.icon('share', 18) + 'Enviar backup (WhatsApp, e-mail, Drive...)</button>' : '') +
      '<button type="button" class="btn soft" data-action="backup-restore">' + ui.icon('upload', 18) + 'Restaurar de um backup</button>' +
      '</div><input type="file" id="restore-file" accept=".json,.txt,application/json,text/plain" data-change="backup-file" hidden>' +
      '<p class="muted small" id="persist-status"></p></section>';

    html += '<section class="card danger-zone"><div class="card-head"><h2>Apagar dados</h2></div>' +
      '<p class="hint">Remove todas as tarefas, tratamentos, refeições, contas e pagamentos deste aparelho.</p>' +
      '<button type="button" class="btn danger full" data-action="data-reset">' + ui.icon('trash', 18) + 'Apagar todos os dados</button></section>';

    html += '<p class="about">J.S. • Julia Satorno • versão ' + esc(JS.app.VERSION) + '<br>Sem login, sem servidor: tudo fica no seu aparelho.</p>';
    return html;
  }

  function after(main) {
    var el = main.querySelector('#persist-status');
    if (!el || !navigator.storage || !navigator.storage.persisted) return;
    navigator.storage.persisted().then(function (p) {
      el.textContent = p ? 'Armazenamento protegido: o navegador não apaga os dados sozinho.' : 'O navegador pode liberar espaço apagando dados de sites pouco usados. Instalar o app e fazer backups evita perdas.';
    }).catch(function () {});
  }

  /* ---------------- Backup ---------------- */

  function backupBlob() {
    var json = JSON.stringify(JS.store.exportData(), null, 2);
    return new Blob([json], { type: 'application/json' });
  }
  function markBackup() { JS.store.update(function (s, n) { s.settings.lastBackupAt = n; }); }

  function exportBackup() {
    markBackup();
    var name = 'js-backup-' + C.toDateKey(new Date()) + '.json';
    var url = URL.createObjectURL(backupBlob());
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    ui.toast('Backup salvo: ' + name + ' (pasta Downloads).', { timeout: 5000 });
  }

  function shareBackup() {
    // Navegadores só compartilham alguns tipos de arquivo; .txt é aceito em todos.
    var file = new File([backupBlob()], 'js-backup-' + C.toDateKey(new Date()) + '.txt', { type: 'text/plain' });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) { exportBackup(); return; }
    navigator.share({ files: [file], title: 'Backup do J.S.' }).then(function () {
      markBackup(); ui.toast('Backup enviado.');
    }).catch(function (e) { if (e && e.name !== 'AbortError') ui.toast('Não foi possível compartilhar. Use "Salvar backup".', { error: true }); });
  }

  function restoreFromFile(input) {
    var f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { ui.toast('Arquivo grande demais para ser um backup do J.S.', { error: true }); return; }
    f.text().then(function (txt) {
      var obj;
      try { obj = JSON.parse(txt); } catch (e) { throw new Error('O arquivo não é um backup válido.'); }
      if (!obj || obj.app !== 'J.S.' || !obj.dados) throw new Error('Este arquivo não é um backup do J.S.');
      var test = R.migrate(obj.dados);
      var resumo = test.tasks.length + ' tarefas, ' + test.hairEvents.length + ' tratamentos, ' + test.meals.length + ' horários de refeição e ' + test.bills.length + ' contas';
      return ui.confirm({
        title: 'Restaurar backup?',
        message: 'Backup de ' + (obj.exportadoEm ? C.formatTimestamp(obj.exportadoEm) : 'data desconhecida') + ' com ' + resumo + '. Os dados atuais deste aparelho serão substituídos.',
        confirmLabel: 'Restaurar', danger: true
      }).then(function (ok) {
        if (!ok) return;
        JS.store.importData(obj);
        JS.store.update(function (s, n) { R.ensureRecurringBills(s, C.toDateKey(new Date()), n); });
        ui.toast('Backup restaurado.');
      });
    }).catch(function (e) { ui.toast(e.message, { error: true, timeout: 5000 }); });
  }

  JS.actions['backup-export'] = exportBackup;
  JS.actions['backup-share'] = shareBackup;
  JS.actions['backup-restore'] = function () { var el = document.getElementById('restore-file'); if (el) el.click(); };
  JS.changes['backup-file'] = restoreFromFile;

  JS.actions['install'] = function () { JS.app.install(); };
  JS.actions['notif-enable'] = function () {
    JS.notify.request().then(function (p) {
      ui.toast(p === 'granted' ? 'Notificações ativadas.' : 'As notificações não foram permitidas.', { error: p !== 'granted' });
      JS.app.render();
    });
  };
  JS.actions['notif-test'] = function () {
    JS.notify.show('Teste do J.S.', 'As notificações estão funcionando. 🌷', 'teste', 'config');
    ui.toast('Notificação de teste enviada.');
  };
  JS.actions['data-reset'] = function () {
    ui.confirm({ title: 'Apagar todos os dados?', message: 'Tudo o que está neste aparelho será removido. Faça um backup antes, se quiser guardar.', confirmLabel: 'Continuar', danger: true })
      .then(function (ok) {
        if (!ok) return null;
        return ui.confirm({ title: 'Tem certeza?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Apagar tudo', danger: true });
      })
      .then(function (ok) { if (ok) { JS.store.reset(); ui.toast('Dados apagados.'); } });
  };

  JS.changes['cfg-name'] = function (el) {
    var v = el.value.trim().slice(0, 40);
    JS.store.update(function (s) { s.settings.name = v; });
    ui.toast('Nome salvo.');
  };
  JS.changes['cfg-notif'] = function (el) { JS.store.update(function (s) { s.settings.notifications[el.name] = el.checked; }); };
  JS.changes['cfg-amounts'] = function (el) { JS.store.update(function (s) { s.settings.showAmountsInNotifications = el.checked; }); };
  JS.changes['cfg-mealhistory'] = function (el) { JS.store.update(function (s) { s.settings.mealHistory = el.checked; }); };
  JS.changes['cfg-intro'] = function (el) {
    JS.store.update(function (s) { s.settings.intro = el.checked; });
    ui.toast(el.checked ? 'A intro vai aparecer ao abrir o app.' : 'Intro desligada.');
  };
  JS.actions['intro-play'] = function () { JS.intro.play(true); };
  JS.changes['cfg-animations'] = function (el) {
    JS.store.update(function (s) { s.settings.animations = el.checked ? 'on' : 'auto'; });
    document.documentElement.classList.toggle('reduce-motion', systemReducesMotion() && !el.checked);
    ui.toast(el.checked ? 'Animações ligadas. Toque em "Ver a intro agora".' : 'Animações seguindo o sistema.');
  };

  function systemReducesMotion() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

  JS.telas.config = { title: 'Configurações', render: render, after: after };
})();
