/*
 * J.S. — execução do treino: exercício atual, carga e repetições por toque (+/−),
 * "Série feita" (botão ou duas batidas atrás do celular), descanso com contagem e resumo no fim.
 * A tela fica acesa durante o treino (quando o aparelho permite).
 */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, T = window.JSTreino, ui = JS.ui, esc = ui.esc;
  var rest = { until: 0, total: 0, itemId: null };
  var ticker = null, listener = null, wakeLock = null, lastSetAt = 0, hintTimer = null;
  var sensor = 'off'; // off | on | perm | none | denied | unsupported
  var autoTried = false;
  var sugIgnored = {}; // "Ignorar" na sugestão de carga: some só neste exercício deste treino

  function session() { return T.activeSession(JS.store.state); }
  function clock(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + C.pad(m) : m) + ':' + C.pad(s);
  }
  function elapsed(x) { return (Date.now() - new Date(x.startedAt).getTime()) / 1000; }

  function sensorChip() {
    var txt, cls = '', btn = '';
    if (sensor === 'on') { cls = 'on'; txt = '<strong>Toque atrás ligado</strong><span>Bata 2 vezes atrás do celular para registrar a série</span>'; }
    else if (sensor === 'perm') { txt = '<strong>Toque atrás</strong><span>Permita o sensor de movimento para usar</span>'; btn = '<button type="button" class="btn small primary" data-action="ses-sensor">Ligar</button>'; }
    else if (sensor === 'denied') { txt = '<strong>Toque atrás bloqueado</strong><span>O sensor não foi permitido. Feche e abra o app para tentar de novo.</span>'; }
    else if (sensor === 'none' || sensor === 'unsupported') { txt = '<strong>Sem sensor de movimento</strong><span>Neste aparelho, use o botão Série feita</span>'; }
    else { txt = '<strong>Toque atrás desligado</strong><span>Dá para ligar em Configurações</span>'; btn = '<button type="button" class="btn small soft" data-action="ses-sensor-on">Ligar</button>'; }
    return '<div class="sensor-chip ' + cls + '" data-sensor><span class="sensor-ic">' + ui.icon('phone', 18) + '<i></i></span><span class="sensor-txt">' + txt + '</span>' + btn + '</div>';
  }

  function render() {
    var s = JS.store.state, x = session();
    if (!x) {
      return '<h1 class="page-title">Treino</h1>' + ui.empty('dumbbell', 'Nenhum treino em andamento.', { label: 'Ir para Treino', attrs: 'data-action="go" data-route="treino"' });
    }
    var it = T.currentItem(x);
    var doneEx = x.items.filter(function (i) { return i.sets.length >= i.targetSets; }).length;
    var nSets = x.items.reduce(function (a, i) { return a + i.sets.length; }, 0);
    var pct = x.items.length ? Math.round(doneEx / x.items.length * 100) : 0;
    var html = '<div class="ses-top"><button type="button" class="icon-btn" data-action="go" data-route="treino" aria-label="Voltar para Treino (o treino continua)">' + ui.icon('left') + '</button>' +
      '<div class="ses-title"><p class="eyebrow">TREINO EM ANDAMENTO</p><h1>' + esc(x.planName) + '</h1></div>' +
      '<div class="ses-clock" aria-label="Tempo de treino"><span data-elapsed>' + clock(elapsed(x)) + '</span><small>' + nSets + (nSets === 1 ? ' série' : ' séries') + '</small></div></div>' +
      '<div class="progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Exercícios concluídos"><span style="width:' + pct + '%"></span></div>' +
      sensorChip();

    if (!it) {
      html += ui.empty('dumbbell', 'Treino livre: adicione o primeiro exercício.', { label: 'Adicionar exercício', attrs: 'data-action="ses-add"' });
    } else {
      var ex = T.exerciseById(s, it.exerciseId) || {};
      var nextNo = it.sets.length + 1, complete = it.sets.length >= it.targetSets;
      var dots = '';
      var rc = T.exerciseRecords(s, it.exerciseId), recSet = {};
      rc.events.forEach(function (e) { if (e.itemId === it.id) recSet[e.setIndex] = e; });
      var totalDots = Math.max(it.targetSets, it.sets.length);
      for (var i = 0; i < totalDots; i++) {
        var st = it.sets[i];
        var planned = it.plannedLoads && !T.samePerSet(it.plannedLoads) ? it.plannedLoads[i] : null;
        dots += st ? '<li class="on' + (recSet[i] ? ' pr' : '') + '" title="' + esc((recSet[i] ? 'Recorde pessoal! ' : '') + JS.kg(st.load) + ' × ' + st.reps) + '"><span>' + (recSet[i] ? ui.icon('trophy', 11) : '') + JS.graf.fmtNum(st.load, 1) + '×' + st.reps + '</span></li>'
          : planned != null ? '<li class="plan" title="Série ' + (i + 1) + ': ' + esc(JS.kg(planned)) + ' planejado"><span>' + JS.graf.fmtNum(planned, 1) + ' kg</span></li>'
            : '<li><span>' + (i + 1) + '</span></li>';
      }
      var resting = rest.until > Date.now() && rest.itemId;
      var step = s.workout.loadStep || 1;
      html += '<section class="ses-card' + (complete ? ' complete' : '') + '" data-item="' + esc(it.id) + '">' +
        '<p class="ses-group">' + esc((T.GRUPOS[ex.group] || '') + (ex.equipment ? ' • ' + ex.equipment : '')) + '</p>' +
        '<h2 class="ses-ex">' + esc(it.name) + '</h2>' +
        '<p class="ses-target">' + (complete ? 'Séries planejadas feitas ✓' : 'Série ' + nextNo + ' de ' + it.targetSets) + ' • meta ' + esc(it.targetReps) + ' repetições</p>' +
        (rc.best && rc.best.load > 0 ? '<p class="ses-record" title="A maior carga que você já fez neste exercício">' + ui.icon('trophy', 14) + 'Seu recorde: <strong>' + JS.kg(rc.best.load) + ' × ' + rc.best.reps + '</strong> • ' + esc(C.formatDayMonth(rc.best.date)) + '</p>' : '') +
        '<ol class="set-dots" aria-label="Séries">' + dots + '</ol>' +
        '<div class="steppers">' +
        stepper('Carga', 'load', JS.graf.fmtNum(it.load, 1), 'kg', step) +
        stepper('Repetições', 'reps', String(it.reps), 'rep.', 1) +
        '</div>' + suggestChip(suggestionFor(s, it)) +
        (resting ? restRing() : '') +
        '<button type="button" class="btn-set" data-action="ses-set">' + ui.icon('check', 26) + '<span>Série feita</span></button>' +
        '<div class="ses-links">' +
        (it.sets.length ? '<button type="button" class="link" data-action="ses-undo">' + ui.icon('undo', 16) + 'Desfazer última</button>' : '<span></span>') +
        '<details class="howto"' + (howtoOpen === it.id ? ' open' : '') + '><summary data-action="ses-howto" data-ex="' + esc(it.exerciseId) + '" data-item="' + esc(it.id) + '">' + ui.icon('play', 14) + 'Como fazer</summary></details>' +
        '</div>' + howtoBody(ex, it) + '</section>';
    }

    if (x.items.length) {
      html += ui.section('Exercícios', x.items.map(function (i, k) {
        var dn = i.sets.length >= i.targetSets;
        return '<button type="button" class="ses-row' + (i === it ? ' current' : '') + (dn ? ' done' : '') + '" data-action="ses-goto" data-i="' + k + '">' +
          '<span class="ses-n">' + (dn ? ui.icon('check', 14) : (k + 1)) + '</span><span class="ses-row-main"><strong>' + esc(i.name) + '</strong>' +
          '<small>' + i.sets.length + '/' + i.targetSets + ' séries • ' + JS.kg(i.load) + ' • ' + esc(i.targetReps) + ' rep.</small></span></button>';
      }).join(''), '<span class="count">' + doneEx + '/' + x.items.length + '</span>');
    }
    html += '<div class="btn-col"><button type="button" class="btn soft" data-action="ses-add">' + ui.icon('plus', 18) + 'Adicionar exercício</button>' +
      '<button type="button" class="btn primary" data-action="ses-finish">' + ui.icon('check', 18) + 'Encerrar treino</button>' +
      '<button type="button" class="btn ghost danger-text" data-action="ses-discard">Descartar treino</button></div>';
    return html;
  }

  /* ---------------- Sugestão de carga do dia ---------------- */

  // Sugestão pelo último treino concluído do exercício (T.suggestLoad). Nunca muda a carga sozinha.
  //  - "subir" e "reduzir": aparecem antes da 1ª série do exercício e somem quando a usuária já usa o valor;
  //  - "manter": dica de "mais 1 repetição", enquanto faltarem séries.
  function suggestionFor(s, it) {
    if (!T.suggestionsEnabled(s) || sugIgnored[it.id]) return null;
    var sg = T.suggestLoad(s, it.exerciseId, { targetReps: it.targetReps, targetSets: it.targetSets });
    if (!sg) return null;
    if (sg.action === 'manter') return it.sets.length >= it.targetSets ? null : sg;
    if (it.sets.length > 0) return null;
    if (sg.load === 0 ? it.reps === sg.reps : it.load === sg.load) return null;
    return sg;
  }
  function suggestChip(sg) {
    if (!sg) return '';
    var icon = sg.action === 'subir' ? 'up' : sg.action === 'reduzir' ? 'down' : 'info';
    var use = sg.action === 'manter' ? '' : '<button type="button" class="btn small primary" data-action="ses-sug-use">Usar</button>';
    return '<div class="sug-chip ' + sg.action + (sg.warn ? ' warn' : '') + '" role="note">' +
      '<span class="sug-ic" aria-hidden="true">' + ui.icon(icon, 16) + '</span>' +
      '<span class="sug-txt"><small class="sug-label">Sugestão de hoje</small><strong>' + esc(sg.headline) + '</strong><small>' + esc(sg.reason) + '</small></span>' +
      '<span class="sug-btns">' + use + '<button type="button" class="btn small ghost" data-action="ses-sug-ignore">Ignorar</button></span></div>';
  }
  JS.actions['ses-sug-use'] = function () {
    var x = session(), it = T.currentItem(x);
    if (!it) return;
    var sg = suggestionFor(JS.store.state, it);
    if (!sg) return;
    var vals = sg.load === 0 ? { reps: sg.reps } : { load: sg.load };
    JS.store.update(function (st) { T.setItemValues(st, x.id, it.id, vals); });
    ui.toast(sg.load === 0 ? 'Meta de hoje: ' + sg.reps + ' repetições em cada série.' : 'Carga de hoje: ' + JS.kg(sg.load) + '.');
  };
  JS.actions['ses-sug-ignore'] = function () {
    var x = session(), it = T.currentItem(x);
    if (!it) return;
    sugIgnored[it.id] = true;
    JS.app.render();
  };

  // "Como fazer": dica + vídeo de execução (o vídeo só carrega quando a usuária abre).
  var howtoOpen = null;
  function howtoBody(ex, it) {
    if (howtoOpen !== it.id) return '';
    var e = ex && ex.id ? ex : { id: it.exerciseId, name: it.name };
    return '<div class="howto-body">' + JS.exPlayer(e) +
      '<p>' + esc((ex && ex.tips) || 'Sem dica cadastrada para este exercício.') + '</p></div>';
  }

  function stepper(label, field, value, unit, step) {
    return '<div class="stepper"><span class="st-label">' + label + '</span><div class="st-row">' +
      '<button type="button" class="st-btn" data-action="ses-step" data-field="' + field + '" data-delta="-' + step + '" aria-label="Diminuir ' + label.toLowerCase() + '">−</button>' +
      '<button type="button" class="st-val" data-action="ses-edit" data-field="' + field + '" aria-label="' + label + ': ' + esc(value) + ' ' + unit + '. Toque para digitar"><strong>' + esc(value) + '</strong><small>' + unit + '</small></button>' +
      '<button type="button" class="st-btn" data-action="ses-step" data-field="' + field + '" data-delta="' + step + '" aria-label="Aumentar ' + label.toLowerCase() + '">+</button></div></div>';
  }

  function restRing() {
    var left = Math.max(0, (rest.until - Date.now()) / 1000), frac = rest.total ? left / rest.total : 0;
    var c = 2 * Math.PI * 34;
    return '<div class="rest" data-rest><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="rest-track"/>' +
      '<circle cx="40" cy="40" r="34" class="rest-bar" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - frac)).toFixed(1) + '"/></svg>' +
      '<div class="rest-info"><span>Descanso</span><strong data-rest-left>' + clock(left) + '</strong></div>' +
      '<div class="rest-btns"><button type="button" class="btn small soft" data-action="ses-rest-add">+15 s</button><button type="button" class="btn small ghost" data-action="ses-rest-skip">Pular</button></div></div>';
  }

  /* ---------------- Relógio, descanso, sensor, tela acesa ---------------- */

  function tick() {
    var x = session();
    if (!x) return;
    var el = document.querySelector('[data-elapsed]');
    if (el) el.textContent = clock(elapsed(x));
    if (rest.until) {
      var left = (rest.until - Date.now()) / 1000;
      var box = document.querySelector('[data-rest]');
      if (box) {
        box.querySelector('[data-rest-left]').textContent = clock(left);
        var bar = box.querySelector('.rest-bar'), c = 2 * Math.PI * 34;
        bar.setAttribute('stroke-dashoffset', (c * (1 - Math.max(0, left) / rest.total)).toFixed(1));
      }
      if (left <= 0) {
        rest.until = 0;
        if (window.JSToque) JSToque.restOver();
        ui.toast('Descanso terminou. Bora para a próxima série!');
        if (JS.app.route() === 'sessao') JS.app.render();
      }
    }
  }

  // O toque atrás fica ouvindo enquanto o app está aberto (em qualquer tela):
  //  - no treino em andamento, 2 batidas registram a série;
  //  - em outra tela, 2 batidas levam ao treino (e, em Treino → Hoje, iniciam o treino do dia).
  function onDouble() {
    if (JS.intro && JS.intro.isRunning()) return;
    // Registro rápido aberto: as 2 batidas de novo salvam a série.
    if (JS.registro && JS.registro.isOpen()) { JS.registro.confirm(); return; }
    if (document.getElementById('sheet').open || document.getElementById('confirm').open || document.querySelector('.countdown')) return;
    var s = JS.store.state, r = JS.app.route();
    if (r === 'sessao') { openQuickSet(); return; }
    if (T.activeSession(s)) { JS.app.go('sessao'); setTimeout(openQuickSet, 250); return; }
    // Em Treino → Hoje com ficha: inicia o treino do dia (como antes). Nas outras telas, sem treino
    // em andamento: abre o registro rápido para escolher o exercício (o treino começa ao salvar).
    var p = T.planForDate(s, C.toDateKey(new Date()));
    if (r === 'treino' && JS.treinoView.mode === 'hoje' && p.plan) { JSToque.vibrate(40); JS.startWorkout(p.plan.id); return; }
    openQuickSet();
  }

  function startSensor() {
    stopSensor();
    var bt = JS.store.state.settings.backTap || {};
    var Tq = window.JSToque;
    if (!bt.enabled) { sensor = 'off'; return; }
    if (!Tq || !Tq.supported()) { sensor = 'unsupported'; return; }
    if (Tq.needsPermission() && JS.sessaoPerm !== 'granted') {
      sensor = JS.sessaoPerm === 'denied' ? 'denied' : 'perm';
      // O Chrome (Android) libera o sensor sem perguntar; o iPhone exige um toque da usuária
      // (iniciar treino, ligar a opção ou o botão "Ligar"). Tenta uma vez sem toque.
      if (!autoTried) {
        autoTried = true;
        Tq.requestPermission().then(function (r) {
          if (r === 'granted') { JS.sessaoPerm = 'granted'; startSensor(); refreshChip(); }
        });
      }
      return;
    }
    listener = Tq.listen({
      threshold: Tq.thresholdFor(bt),
      onDouble: onDouble,
      onTap: tapHint,
      // O sensor demorou a mandar dados: quando chegarem, volta a mostrar "ligado".
      onSample: function () { if (sensor === 'none') { sensor = 'on'; refreshChip(); } },
      onNoSensor: function () { sensor = 'none'; refreshChip(); }
    });
    sensor = 'on';
  }
  function stopSensor() { if (listener) { listener.stop(); listener = null; } }
  function refreshChip() {
    var el = document.querySelector('[data-sensor]');
    if (el) el.outerHTML = sensorChip();
  }
  // Primeira batida reconhecida: mostra que está esperando a segunda.
  function tapHint() {
    var el = document.querySelector('[data-sensor]');
    if (!el) return;
    el.classList.add('half');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { el.classList.remove('half'); }, 650);
  }

  function keepAwake() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () { wakeLock = null; });
  }
  function onVisible() { if (document.visibilityState === 'visible' && JS.app.route() === 'sessao') { keepAwake(); tick(); } }

  function enter() {
    document.body.classList.add('focus-mode');
    clearInterval(ticker);
    ticker = setInterval(tick, 500);
    if (!listener) startSensor();
    refreshChip();
    keepAwake();
    document.addEventListener('visibilitychange', onVisible);
  }
  function leave() {
    document.body.classList.remove('focus-mode');
    clearInterval(ticker); ticker = null;
    if (wakeLock) { try { wakeLock.release(); } catch (e) { /* já liberado */ } wakeLock = null; }
    document.removeEventListener('visibilitychange', onVisible);
  }
  /* ---------------- iPhone: liberar o sensor de movimento ---------------- */
  // O iPhone só libera o sensor dentro de um toque da usuária. Na 1ª vez, o botão "Ativar" pede a
  // permissão; depois, o primeiro toque em qualquer lugar do app (a cada vez que ele abre) religa o
  // toque atrás sozinho, sem perguntar de novo.
  var MOTION_OK = 'js-motion-ok', MOTION_LATER = 'js-motion-depois', gestureTries = 0;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
  function everGranted() { return lsGet(MOTION_OK) === '1'; }
  function needsActivation() {
    var bt = JS.store.state.settings.backTap || {}, Tq = window.JSToque;
    return !!(bt.enabled && Tq && Tq.supported() && Tq.needsPermission() && JS.sessaoPerm !== 'granted');
  }
  function setPerm(r) {
    JS.sessaoPerm = r;
    if (r === 'granted') { lsSet(MOTION_OK, '1'); startSensor(); refreshChip(); }
  }
  // Botões "Ativar": precisa ser chamado dentro do toque.
  function enable() {
    var Tq = window.JSToque;
    if (!Tq || !Tq.supported()) return Promise.resolve('unsupported');
    Tq.unlockAudio();
    if (!(JS.store.state.settings.backTap || {}).enabled) JS.store.silentUpdate(function (st) { st.settings.backTap.enabled = true; });
    return Tq.requestPermission().then(function (r) { setPerm(r); return r; });
  }
  function onGesture() {
    if (gestureTries >= 3 || !everGranted() || !needsActivation()) return;
    gestureTries++;
    window.JSToque.requestPermission().then(function (r) { if (r === 'granted') { setPerm(r); JS.app.render(); } });
  }
  document.addEventListener('touchend', onGesture, true);
  document.addEventListener('click', onGesture, true);
  // Aviso no Início e no Treino (só no iPhone, enquanto o sensor nunca foi liberado neste aparelho).
  function activationBanner() {
    if (!needsActivation() || everGranted()) return '';
    var later = Number(lsGet(MOTION_LATER) || 0);
    if (later && Date.now() - later < 3 * 86400000) return '';
    return '<div class="banner bt-banner"><span class="banner-ic">' + ui.icon('phone', 20) + '</span><div><strong>Ative o toque atrás neste iPhone</strong>' +
      '<p>Com o J.S. aberto, 2 batidas atrás do celular registram a série do treino. O iPhone pede para liberar o sensor de movimento só uma vez.</p></div>' +
      '<div class="banner-actions"><button type="button" class="btn primary small" data-action="bt-enable">Ativar agora</button>' +
      '<button type="button" class="btn ghost small" data-action="bt-later">Agora não</button></div></div>';
  }
  JS.actions['bt-enable'] = function () {
    enable().then(function (r) {
      JS.app.render();
      if (r === 'granted') ui.toast('Pronto! Toque atrás ligado neste iPhone. Bata 2 vezes atrás do celular.', { actionLabel: 'Testar', timeout: 8000, onAction: function () { JS.actions['bt-calibrate'](); } });
      else if (r === 'unsupported') ui.toast('Este aparelho não tem sensor de movimento.', { error: true });
      else ui.toast('O iPhone não liberou o sensor. Feche o J.S. (tire dos apps abertos), abra de novo e toque em Ativar. Se continuar, veja em Ajustes → Apps → Safari se "Movimento e Orientação" está permitido.', { error: true, timeout: 10000 });
    });
  };
  JS.actions['bt-later'] = function (d, el) {
    lsSet(MOTION_LATER, String(Date.now()));
    JS.anim.removeThen(el, '.banner', function () { JS.app.render(); ui.toast('Tudo bem. Dá para ativar em Configurações → Treino: toque atrás.'); });
  };

  // Chamado quando o app abre (depois da intro) e quando a configuração muda.
  JS.backTap = {
    start: startSensor, stop: function () { stopSensor(); sensor = 'off'; }, state: function () { return sensor; },
    enable: enable, setPerm: setPerm, needsActivation: needsActivation, everGranted: everGranted, banner: activationBanner
  };

  /* ---------------- Séries ---------------- */

  function flash(text, sub, pr) {
    var el = document.getElementById('ses-flash');
    if (!el) { el = document.createElement('div'); el.id = 'ses-flash'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.classList.toggle('pr', !!pr);
    el.innerHTML = '<span class="sf-ic">' + ui.icon(pr ? 'trophy' : 'check', 34) + '</span><strong></strong><small></small>';
    el.querySelector('strong').textContent = text;
    el.querySelector('small').textContent = sub || '';
    JS.anim.restartClass(el, 'show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, pr ? 2200 : 1300);
  }

  // via: 'toque' (botão) | 'toque-atras' (sensor) | 'atalho' (iPhone com o app fechado)
  function registerSet(via, force) {
    var x = session(), it = T.currentItem(x);
    if (!x || !it) return;
    if (via === 'toque-atras' && !force && Date.now() - lastSetAt < 1500) return; // evita registrar duas vezes
    lastSetAt = Date.now();
    var no = it.sets.length + 1, wasComplete = it.sets.length >= it.targetSets, doneLoad = it.load, doneReps = it.reps;
    howtoOpen = null; // fecha o vídeo ao registrar a série
    rest = it.restSec > 0 ? { until: Date.now() + it.restSec * 1000, total: it.restSec, itemId: it.id } : { until: 0, total: 0, itemId: null };
    JS.anim.mark('.set-dots li:nth-child(' + no + ')', 'pop', { ms: 700 });
    JS.store.update(function (st, n) { T.logSet(st, x.id, it.id, n, via); });
    if (window.JSToque) JSToque.confirmSet();
    var rec = T.recordOf(JS.store.state, x.id, it.id, no - 1);
    if (rec) {
      flash('Novo recorde! 🏆', it.name + ': ' + JS.prText(rec), true);
      if (window.JSToque) JSToque.vibrate([40, 60, 40, 60, 90]);
      setTimeout(function () { JS.anim.sparks(document.querySelector('.btn-set')); }, 80);
    } else flash('Série ' + no + ' registrada', JS.kg(doneLoad) + ' × ' + doneReps + (via === 'toque-atras' ? ' • pelo toque atrás' : ''));
    var nx = session();
    var allDone = nx && nx.items.length && nx.items.every(function (i) { return i.sets.length >= i.targetSets; });
    if (allDone && !wasComplete) {
      setTimeout(function () {
        ui.choose({ title: 'Todas as séries feitas! 💪', message: 'Quer encerrar o treino agora?', options: [{ label: 'Encerrar treino', value: true, primary: true }], cancelLabel: 'Continuar treinando' })
          .then(function (v) { if (v) finish(); });
      }, 900);
    }
  }
  JS.registerSet = registerSet;

  // Toque atrás: abre o Registro rápido (js/registro.js) no exercício atual.
  function openQuickSet() { JS.openQuickRegister({ source: 'toque-atras' }); }
  JS.openQuickSet = openQuickSet;

  function finish() {
    var x = session();
    if (!x) return;
    var summary = null;
    JS.store.silentUpdate(function (st, n) { summary = T.finishSession(st, x.id, n); });
    rest = { until: 0, total: 0, itemId: null };
    JS.treinoView.mode = 'hoje';
    JS.app.go('treino');
    JS.anim.celebrate();
    ui.openSheet({
      title: 'Treino concluído! 🎉', subtitle: x.planName,
      body: JS.workoutSummaryHtml(summary) + (summary.sets ? '<p class="hint">A ficha agora sugere a última carga usada em cada exercício.</p>' : ''),
      onSubmit: function () { }, submitLabel: 'Fechar', cancelLabel: 'Ver evolução',
      onOpen: function (form) {
        if (JS.bindPrShare) JS.bindPrShare(form);
        var ghost = form.querySelector('.sheet-foot .btn.ghost');
        if (ghost) ghost.addEventListener('click', function () { JS.treinoView.mode = 'evolucao'; setTimeout(function () { JS.app.render({ enter: 'view:r' }); }, 220); });
      }
    });
  }

  JS.actions['ses-set'] = function (d, el) { JS.anim.restartClass(el, 'press'); registerSet('toque'); };
  JS.actions['ses-step'] = function (d) {
    var x = session(), it = T.currentItem(x);
    if (!it) return;
    var v = Math.max(0, Number(it[d.field]) + Number(d.delta));
    var vals = {}; vals[d.field] = v;
    JS.store.update(function (st) { T.setItemValues(st, x.id, it.id, vals); });
    JS.anim.mark('.st-val[data-field="' + d.field + '"]', 'bump', { ms: 400 });
  };
  JS.actions['ses-edit'] = function (d) {
    var x = session(), it = T.currentItem(x);
    if (!it) return;
    var isLoad = d.field === 'load';
    ui.openSheet({
      title: isLoad ? 'Carga' : 'Repetições', subtitle: it.name,
      body: ui.input({ label: isLoad ? 'Carga (kg)' : 'Repetições', name: 'v', type: 'text', value: String(it[d.field]).replace('.', ','), attrs: 'inputmode="' + (isLoad ? 'decimal' : 'numeric') + '" autocomplete="off"' }),
      submitLabel: 'Salvar',
      onOpen: function (form) { setTimeout(function () { form.elements.v.select(); }, 120); },
      onSubmit: function (v) {
        var n = Number(String(v.v).replace(',', '.'));
        if (!(n >= 0 && n <= 999)) return { errors: { v: 'Valor entre 0 e 999.' } };
        var vals = {}; vals[d.field] = n;
        JS.store.update(function (st) { T.setItemValues(st, x.id, it.id, vals); });
      }
    });
  };
  JS.actions['ses-undo'] = function () {
    var x = session(), it = T.currentItem(x);
    if (!it) return;
    JS.store.update(function (st) { T.undoLastSet(st, x.id, it.id); });
    rest = { until: 0, total: 0, itemId: null };
    ui.toast('Última série desfeita.');
  };
  JS.actions['ses-goto'] = function (d) {
    var x = session();
    JS.store.update(function (st) { T.setCurrent(st, x.id, Number(d.i)); });
    window.scrollTo({ top: 0, behavior: JS.anim.reduced() ? 'auto' : 'smooth' });
    JS.anim.mark('.ses-card', 'swap', { ms: 500 });
  };
  JS.actions['ses-howto'] = function (d) {
    howtoOpen = howtoOpen === d.item ? null : d.item;
    JS.app.render();
  };
  JS.actions['ses-rest-add'] = function () { if (rest.until) { rest.until += 15000; rest.total += 15; tick(); } };
  JS.actions['ses-rest-skip'] = function () { rest = { until: 0, total: 0, itemId: null }; JS.app.render(); };
  JS.actions['ses-add'] = function () {
    var x = session();
    JS.openExercisePicker(null, null, function (id) {
      ui.closeSheet();
      JS.store.update(function (st) { T.addSessionExercise(st, x.id, id); });
      JS.anim.mark('.ses-card', 'swap', { ms: 500, delay: 200 });
    });
  };
  JS.actions['ses-finish'] = function () {
    var x = session();
    var pending = x.items.filter(function (i) { return i.sets.length < i.targetSets; }).length;
    ui.confirm({ title: 'Encerrar treino?', message: pending ? pending + (pending === 1 ? ' exercício ainda não terminou' : ' exercícios ainda não terminaram') + '. O que já foi feito fica salvo.' : 'Todas as séries foram feitas.', confirmLabel: 'Encerrar' })
      .then(function (ok) { if (ok) finish(); });
  };
  JS.actions['ses-discard'] = function () {
    ui.confirm({ title: 'Descartar treino?', message: 'As séries deste treino não serão salvas.', confirmLabel: 'Descartar', danger: true })
      .then(function (ok) {
        if (!ok) return;
        var x = session();
        JS.store.silentUpdate(function (st) { T.discardSession(st, x.id); });
        rest = { until: 0, total: 0, itemId: null };
        JS.app.go('treino');
        ui.toast('Treino descartado.');
      });
  };
  JS.actions['ses-sensor'] = function () {
    JSToque.unlockAudio();
    JSToque.requestPermission().then(function (r) {
      setPerm(r);
      startSensor();
      refreshChip();
      if (r === 'granted') ui.toast('Toque atrás ligado. Bata 2 vezes atrás do celular.');
    });
  };
  JS.actions['ses-sensor-on'] = function () {
    JS.store.silentUpdate(function (st) { st.settings.backTap.enabled = true; });
    JS.actions['ses-sensor']();
  };

  JS.telas.sessao = { title: 'Treino em andamento', render: render, enter: enter, leave: leave, after: function (main) { JS.startDrawings(main); } };
})();
