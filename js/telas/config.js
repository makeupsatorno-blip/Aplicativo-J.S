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

  // Itens com horário que ainda não têm lembrete (criados antes do lembrete vir ligado por padrão).
  function missingReminders() {
    var s = JS.store.state, today = C.toDateKey(new Date());
    var tasks = s.tasks.filter(function (t) {
      return t.status !== 'cancelled' && t.dueDate && t.dueTime && t.reminderMinutes == null &&
        ((t.recurrence || 'none') !== 'none' ? (!t.endDate || t.endDate >= today) : t.dueDate >= today);
    });
    var hair = s.hairEvents.filter(function (e) { return R.hairPending(e) && e.time && e.reminderMinutes == null && e.date >= today; });
    return { tasks: tasks, hair: hair, total: tasks.length + hair.length };
  }
  JS.missingReminders = missingReminders;
  function missingBlock() {
    var m = missingReminders();
    if (!m.total) return '';
    return '<div class="banner soft compact-banner"><span class="banner-ic">' + ui.icon('belloff', 20) + '</span><div><strong>' + m.total +
      (m.total === 1 ? ' item com horário está sem lembrete' : ' itens com horário estão sem lembrete') + '</strong>' +
      '<p>Tarefas avisam 15 min antes; tratamentos, na hora.</p></div>' +
      '<button type="button" class="btn primary small" data-action="reminders-fix">Ligar todos</button></div>';
  }

  // Avisos com o app fechado (servidor de push).
  function pushBlock() {
    var P = JS.push, p = P.info(), why = P.unavailableReason();
    var html = '<div class="sub-block"><h3>' + ui.icon('phone', 16) + 'Avisos com o app fechado</h3>';
    if (P.active()) {
      html += '<p class="ok-line">' + ui.icon('check', 16) + ' Ligado neste aparelho</p>' +
        '<p class="muted small">' + (p.lastSyncAt ? (p.count || 0) + ' lembrete(s) agendado(s) no servidor • atualizado em ' + esc(C.formatTimestamp(p.lastSyncAt)) : 'Sincronizando…') + '</p>' +
        (p.lastError ? '<p class="hint warn-text">' + ui.icon('alert', 14) + ' ' + esc(p.lastError) + '</p>' : '') +
        '<div class="btn-col"><button type="button" class="btn soft" data-action="push-test">' + ui.icon('bell', 18) + 'Enviar teste pelo servidor</button>' +
        '<button type="button" class="btn ghost" data-action="push-off">Desligar e apagar do servidor</button></div>';
    } else if (why) {
      html += '<p class="hint">' + esc(why) + '</p>';
    } else {
      html += '<p class="hint">Sem isto, os avisos só aparecem com o J.S. aberto ou recém-minimizado. Ligado, um servidor manda cada lembrete na hora, mesmo com o app fechado.</p>' +
        '<button type="button" class="btn primary full" data-action="push-on">Ligar avisos com o app fechado</button>';
    }
    html += '<p class="hint">Privacidade: quando ligado, os títulos e horários dos lembretes futuros (com data marcada, em qualquer data até 2 anos; os que se repetem, 90 dias à frente, renovados ao abrir o app; sem valores de contas, a menos que você ligue acima) vão para um servidor que só os usa para enviar o aviso. Desligar apaga esses dados do servidor.</p></div>';
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
      '<button type="button" class="btn soft full" data-action="intro-play">' + ui.icon('sparkle', 18) + 'Ver a intro agora</button>' +
      '<div class="version-row"><span class="muted small">Versão instalada: <strong>' + esc(JS.app.VERSION) + '</strong></span>' +
      '<button type="button" class="btn ghost small" data-action="app-update">' + ui.icon('download', 16) + 'Procurar atualização</button></div></section>';

    html += '<section class="card"><div class="card-head"><h2>' + ui.icon('bell', 18) + 'Notificações</h2>' + ui.tag(pt[0], pt[1]) + '</div>' +
      (perm === 'default' ? '<button type="button" class="btn primary full" data-action="notif-enable">Ativar notificações</button>' : '') +
      (perm === 'denied' ? '<p class="hint">Para liberar, toque no cadeado ao lado do endereço (ou em Configurações do site) e permita notificações.</p>' : '') +
      (perm === 'granted' ? '<button type="button" class="btn soft full" data-action="notif-test">Enviar notificação de teste</button>' : '') +
      missingBlock() +
      sw('task', 'Rotina', n.task !== false, 'Tarefas com horário', 'cfg-notif') +
      sw('hair', 'Cronograma capilar', n.hair !== false, 'Tratamentos capilares', 'cfg-notif') +
      sw('meal', 'Alimentação', n.meal !== false, 'Horários de refeição', 'cfg-notif') +
      sw('bill', 'Financeiro', n.bill !== false, 'Vencimento de contas', 'cfg-notif') +
      sw('workout', 'Treino', n.workout !== false, 'No horário escolhido em Treino → Semana', 'cfg-notif') +
      sw('showAmounts', 'Mostrar valor das contas', !!st.showAmountsInNotifications, 'Por privacidade, vem desligado: o valor não aparece na tela bloqueada.', 'cfg-amounts') +
      pushBlock() +
      '</section>';

    var bt = st.backTap || {};
    var Tq = window.JSToque;
    html += '<section class="card" id="cfg-backtap"><div class="card-head"><h2>' + ui.icon('dumbbell', 18) + 'Treino: toque atrás</h2>' + ui.tag(bt.enabled ? 'Ligado' : 'Desligado', bt.enabled ? 'success' : 'muted') + '</div>' +
      '<p class="hint top">Durante o treino, com o J.S. aberto, bata 2 vezes na parte de trás do celular para registrar a série (o descanso começa sozinho). Funciona no Android e no iPhone.</p>' +
      sw('backTap', 'Registrar série com 2 batidas atrás', !!bt.enabled, Tq && !Tq.supported() ? 'Este aparelho/navegador não tem sensor de movimento.' : 'Usa o sensor de movimento só durante o treino.', 'cfg-backtap') +
      '<div class="field"><label for="cfg-bt-sens">Sensibilidade</label><select id="cfg-bt-sens" data-change="cfg-bt-sens">' +
      [[1, 'Baixa (precisa bater mais forte)'], [2, 'Média-baixa'], [3, 'Média'], [4, 'Média-alta'], [5, 'Alta (batidas leves)']].map(function (o) {
        return '<option value="' + o[0] + '"' + (Number(bt.sensitivity || 3) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select><p class="hint">' + (bt.threshold ? 'Calibrado para as suas batidas.' : 'Ainda não calibrado: use o teste abaixo para ajustar ao seu celular.') + '</p></div>' +
      '<button type="button" class="btn soft full" data-action="bt-calibrate">' + ui.icon('phone', 18) + 'Testar e calibrar o toque atrás</button>' +
      '<button type="button" class="btn ghost full" data-action="bt-help">Com o app fechado (atalhos do celular)</button></section>';

    html += '<section class="card"><div class="card-head"><h2>' + ui.icon('utensils', 18) + 'Alimentação</h2></div>' +
      '<button type="button" class="week-row plain" data-action="nutri-settings"><span class="wd-name">Meta de calorias</span><span class="week-plan">' +
      (st.nutrition && st.nutrition.kcalTarget ? JS.graf.fmtNum(st.nutrition.kcalTarget, 0) + ' kcal' : 'Automática') + '</span>' + ui.icon('right', 16) + '</button>' +
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
      '<p class="hint">Remove todas as tarefas, tratamentos, refeições, contas, treinos, medições e alimentos registrados deste aparelho.</p>' +
      '<button type="button" class="btn danger full" data-action="data-reset">' + ui.icon('trash', 18) + 'Apagar todos os dados</button></section>';

    html += '<p class="about">J.S. • Julia Satorno • versão ' + esc(JS.app.VERSION) + '<br>Sem login: seus dados ficam no seu aparelho.</p>';
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
      var resumo = test.tasks.length + ' tarefas, ' + test.hairEvents.length + ' tratamentos, ' + test.meals.length + ' horários de refeição, ' + test.bills.length + ' contas, ' +
        test.workoutPlans.length + ' fichas de treino, ' + test.bodyRecords.length + ' medições e ' + test.foodLogs.length + ' alimentos registrados';
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
  JS.changes['cfg-backtap'] = function (el) {
    var on = el.checked;
    // No iPhone, pede a permissão do sensor já neste toque.
    if (on && window.JSToque && JSToque.needsPermission()) JSToque.requestPermission().then(function (r) { JS.sessaoPerm = r; });
    JS.store.update(function (s) { s.settings.backTap.enabled = on; });
    ui.toast(on ? 'Toque atrás ligado para os treinos.' : 'Toque atrás desligado.');
  };
  JS.changes['cfg-bt-sens'] = function (el) { JS.store.update(function (s) { s.settings.backTap.sensitivity = Number(el.value) || 3; }); ui.toast('Sensibilidade salva.'); };

  /* ---------------- Toque atrás: teste e calibração ---------------- */

  // 1) 2 s parado (mede o "ruído"); 2) a pessoa bate 2 vezes atrás, algumas vezes; 3) o limite
  // fica no meio do caminho entre o ruído e as batidas. Depois, um teste ao vivo.
  JS.actions['bt-calibrate'] = function () {
    var Tq = window.JSToque;
    if (!Tq || !Tq.supported()) { ui.toast('Este aparelho não tem sensor de movimento.', { error: true }); return; }
    Tq.unlockAudio();
    Tq.requestPermission().then(function (perm) {
      JS.sessaoPerm = perm;
      if (perm !== 'granted') { ui.toast('Sem permissão para o sensor de movimento.', { error: true }); return; }
      var phase = 'rest', rest = [], samples = [], t0 = performance.now(), lis = null, timer = null, hits = 0;
      var body = '<p class="bt-step" data-step>Deixe o celular parado na mão por 2 segundos…</p>' +
        '<div class="bt-meter"><span data-meter></span><i data-line></i></div>' +
        '<p class="hint" data-info>Medindo o movimento parado.</p>' +
        '<div class="bt-result" data-result hidden></div>';
      var form = ui.openSheet({
        title: 'Toque atrás', subtitle: 'Teste e calibração', body: body, submitLabel: 'Pronto', cancelLabel: 'Cancelar',
        onSubmit: function () { stop(); },
        onOpen: function (f) { f.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', stop); }); }
      });
      var meter = form.querySelector('[data-meter]'), line = form.querySelector('[data-line]'), step = form.querySelector('[data-step]'), info = form.querySelector('[data-info]'), res = form.querySelector('[data-result]');
      function stop() { if (lis) lis.stop(); lis = null; clearTimeout(timer); }
      function show(score, th) {
        var max = Math.max(6, th * 2.2);
        meter.style.width = Math.min(100, score / max * 100) + '%';
        if (th) line.style.left = Math.min(100, th / max * 100) + '%';
      }
      lis = Tq.listen({
        threshold: 999,
        onNoSensor: function () { step.textContent = 'Nenhum dado do sensor chegou. Este aparelho pode não ter acelerômetro.'; },
        onSample: function (r) {
          var t = performance.now() - t0;
          if (phase === 'rest') {
            rest.push(r.score); show(r.score, 0);
            if (t > 2000) {
              phase = 'taps'; t0 = performance.now();
              step.textContent = 'Agora bata 2 vezes atrás do celular (toc-toc), 3 vezes, com uma pausa entre elas.';
              info.textContent = 'Batidas firmes com a ponta do dedo, como no treino.';
              Tq.beep(880, 120);
            }
          } else if (phase === 'taps') {
            samples.push({ t: t, score: r.score }); show(r.score, 0);
            if (t > 7000) finishCal();
          } else if (phase === 'test') {
            show(r.score, lis.detector.threshold);
          }
        },
        onDouble: function () {
          if (phase !== 'test') return;
          hits++;
          Tq.confirmSet();
          res.innerHTML = '<p class="ok-line">' + ui.icon('check', 18) + ' Toque duplo reconhecido! (' + hits + ')</p>';
          JS.anim.restartClass(res, 'pop-in');
        }
      });
      function finishCal() {
        var noise = Tq.median(rest) * 3;
        var peaks = Tq.findPeaks(samples, Math.max(0.8, noise));
        var th = Tq.calibrationThreshold(peaks, rest);
        if (!th || peaks.length < 2) {
          phase = 'test';
          step.textContent = 'Não percebi batidas suficientes. Tente bater um pouco mais forte, ou aumente a sensibilidade.';
          var cur = Tq.thresholdFor(JS.store.state.settings.backTap);
          lis.setThreshold(cur);
          info.textContent = 'Teste ao vivo com o ajuste atual: bata 2 vezes atrás.';
          res.hidden = false;
          return;
        }
        JS.store.silentUpdate(function (s) { s.settings.backTap.threshold = th; s.settings.backTap.enabled = true; });
        phase = 'test';
        var eff = Tq.thresholdFor(JS.store.state.settings.backTap);
        lis.setThreshold(eff);
        step.textContent = 'Calibrado! Agora teste: bata 2 vezes atrás do celular.';
        info.textContent = peaks.length + ' batidas percebidas. A barra precisa passar da linha para contar.';
        res.hidden = false;
        res.innerHTML = '<p class="muted small">Esperando o toque duplo…</p>';
        Tq.beep(990, 160);
      }
    });
  };

  JS.actions['bt-help'] = function () {
    var body = '<p>O J.S. reconhece as 2 batidas pelo sensor enquanto está <strong>aberto</strong> no treino (a tela fica acesa durante o treino).</p>' +
      '<h3 class="form-sub">Android</h3><p>Alguns celulares têm toque atrás próprio, que pode <strong>abrir o J.S.</strong> direto no treino em andamento:</p>' +
      '<ul class="help-list"><li><strong>Samsung:</strong> app Good Lock → módulo RegiStar → Back-Tap → Abrir app → J.S.</li>' +
      '<li><strong>Google Pixel:</strong> Configurações → Sistema → Gestos → Toque rápido → Abrir app → J.S.</li>' +
      '<li><strong>Outros:</strong> procure "toque duplo atrás" ou "back tap" nas configurações.</li></ul>' +
      '<h3 class="form-sub">iPhone</h3><p>Ajustes → Acessibilidade → Toque → <strong>Tocar Atrás</strong>. Com o J.S. aberto no treino, use as 2 batidas normalmente.</p>' +
      '<p class="hint">Com o app totalmente fechado, nenhum site instalado consegue ouvir o sensor; por isso o atalho do celular serve para abrir o J.S. no treino.</p>';
    ui.openSheet({ title: 'Toque atrás com o app fechado', body: body });
  };
  JS.changes['cfg-intro'] = function (el) {
    JS.store.update(function (s) { s.settings.intro = el.checked; });
    ui.toast(el.checked ? 'A intro vai aparecer ao abrir o app.' : 'Intro desligada.');
  };
  JS.actions['intro-play'] = function () { JS.intro.play(true); };
  JS.actions['reminders-fix'] = function () {
    var m = missingReminders();
    var taskIds = m.tasks.map(function (t) { return t.id; }), hairIds = m.hair.map(function (e) { return e.id; });
    JS.store.update(function (s, n) {
      s.tasks.forEach(function (t) { if (taskIds.indexOf(t.id) >= 0) { t.reminderMinutes = 15; t.updatedAt = n; } });
      s.hairEvents.forEach(function (e) { if (hairIds.indexOf(e.id) >= 0) { e.reminderMinutes = 0; e.updatedAt = n; } });
    });
    ui.toast('Lembrete ligado em ' + m.total + (m.total === 1 ? ' item.' : ' itens.'));
    JS.notify.askIfNeeded();
  };
  JS.actions['app-update'] = function (d, el) {
    busy(el, true, 'Procurando…');
    JS.app.checkForUpdate(true).then(function (r) {
      busy(el, false);
      if (r === 'nova') ui.toast('Versão nova encontrada. Instalando…');
      else if (r === 'atual') ui.toast('Você já está na versão mais nova (' + JS.app.VERSION + ').');
      else if (r === 'sem-service-worker') ui.toast('Abra o J.S. pelo endereço publicado para receber atualizações.');
      else ui.toast('Não foi possível procurar agora. Confira a internet.', { error: true });
    });
  };

  function busy(el, on, label) {
    if (!el) return;
    el.disabled = on;
    if (on) { el.dataset.label = el.textContent; el.textContent = label; } else if (el.dataset.label) el.textContent = el.dataset.label;
  }
  JS.actions['push-on'] = function (d, el) {
    busy(el, true, 'Ligando…');
    JS.push.enable().then(function () { ui.toast('Pronto! Os avisos vão chegar mesmo com o app fechado.'); })
      .catch(function (e) { ui.toast(e.message, { error: true, timeout: 7000 }); })
      .then(function () { busy(el, false); JS.app.render(); });
  };
  JS.actions['push-off'] = function () {
    ui.confirm({ title: 'Desligar avisos com o app fechado?', message: 'Os lembretes deste aparelho serão apagados do servidor. Os avisos com o app aberto continuam.', confirmLabel: 'Desligar' })
      .then(function (ok) { if (ok) JS.push.disable().then(function () { ui.toast('Avisos com o app fechado desligados.'); JS.app.render(); }); });
  };
  JS.actions['push-test'] = function (d, el) {
    busy(el, true, 'Enviando…');
    JS.push.test().then(function () { ui.toast('Teste enviado pelo servidor. Feche o app para ver chegar.', { timeout: 6000 }); })
      .catch(function (e) { ui.toast(e.message, { error: true, timeout: 7000 }); })
      .then(function () { busy(el, false); });
  };
  JS.changes['cfg-animations'] = function (el) {
    JS.store.update(function (s) { s.settings.animations = el.checked ? 'on' : 'auto'; });
    document.documentElement.classList.toggle('reduce-motion', systemReducesMotion() && !el.checked);
    ui.toast(el.checked ? 'Animações ligadas. Toque em "Ver a intro agora".' : 'Animações seguindo o sistema.');
  };

  function systemReducesMotion() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

  JS.telas.config = { title: 'Configurações', render: render, after: after };
})();
