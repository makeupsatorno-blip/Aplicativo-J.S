/*
 * J.S. — Registro rápido de treino.
 *  - Telinha compacta (exercício, peso, repetições, série, "Salvar série", "Fechar") que abre:
 *    pelas 2 batidas atrás do celular (sensor, com o app aberto), pelo link #/registro (atalho do
 *    ícone no Android), ao voltar para o app durante o treino (Toque rápido do Android abre o app)
 *    e pelo botão "Registro rápido" no Treino.
 *  - Atalho do iPhone: o Tocar Atrás roda um Atalho que abre a página rapido.html. Como o Safari não
 *    enxerga os dados do app instalado, a página salva no servidor do J.S. e o app importa as séries
 *    quando abre (e manda para lá o exercício atual, para a página abrir preenchida).
 * Os dados do treino continuam no aparelho; no servidor fica só o contexto do atalho e as séries
 * ainda não importadas (apagadas depois da importação).
 */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, T = window.JSTreino, ui = JS.ui, esc = ui.esc;
  var API = (window.JS_CONFIG && window.JS_CONFIG.pushApi) || '';
  var lastCtx = '', ctxTimer = null, pullTimer = null, pulling = false, quick = null;

  function cfg() { return JS.store.state.settings.quick || null; }
  function rnd(bytes) {
    var a = new Uint8Array(bytes);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function post(route, body) {
    return fetch(API + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); });
  }
  function today() { return C.toDateKey(new Date()); }
  function step() { return (JS.store.state.workout && JS.store.state.workout.loadStep) || 1; }

  /* ---------------- Atalho do iPhone (servidor) ---------------- */

  function link() {
    var q = cfg();
    if (!q || !q.enabled) return null;
    return new URL('rapido.html', location.href.split('#')[0]).href + '#d=' + q.deviceId + '&k=' + q.key;
  }
  function enable() {
    if (!API) return Promise.reject(new Error('Servidor não configurado.'));
    var q = { enabled: true, deviceId: C.uuid(), token: rnd(24), key: rnd(18) };
    var ctx = T.quickContext(JS.store.state, today(), step());
    return post('quick-context', { deviceId: q.deviceId, token: q.token, key: q.key, context: ctx }).then(function () {
      JS.store.update(function (s) { s.settings.quick = q; });
      lastCtx = JSON.stringify(ctx);
      return link();
    });
  }
  function disable() {
    var q = cfg();
    var done = function () { JS.store.update(function (s) { delete s.settings.quick; }); };
    if (!q || !q.enabled) { done(); return Promise.resolve(); }
    return post('quick-off', { deviceId: q.deviceId, token: q.token }).catch(function () { /* sem internet: apaga só aqui */ }).then(done);
  }

  // Manda o exercício atual para o servidor (a página do atalho abre preenchida).
  function syncContext(force) {
    var q = cfg();
    if (!q || !q.enabled || !navigator.onLine) return;
    var ctx = T.quickContext(JS.store.state, today(), step()), txt = JSON.stringify(ctx);
    if (!force && txt === lastCtx) return;
    post('quick-context', { deviceId: q.deviceId, token: q.token, context: ctx })
      .then(function (r) { lastCtx = txt; if (r.pending) pull(); })
      .catch(function () { /* tenta de novo na próxima mudança */ });
  }
  function scheduleContext() { clearTimeout(ctxTimer); ctxTimer = setTimeout(syncContext, 1500); }

  // As séries do atalho entraram no treino: vai para o treino em andamento
  // (fecha a intro, se estiver passando; não interrompe uma folha aberta).
  function showSession() {
    if (!T.activeSession(JS.store.state) || JS.app.route() === 'sessao') return;
    if (document.getElementById('sheet').open || document.getElementById('confirm').open) return;
    if (JS.intro && JS.intro.isRunning()) JS.intro.skip();
    JS.app.go('sessao');
  }

  // Busca as séries salvas pelo atalho e coloca no treino (começa um, se não houver).
  function pull() {
    var q = cfg();
    if (!q || !q.enabled || pulling || !navigator.onLine) return Promise.resolve(0);
    pulling = true;
    return post('quick-pull', { deviceId: q.deviceId, token: q.token }).then(function (r) {
      var sets = (r && r.sets) || [];
      if (!sets.length) return 0;
      var plan = T.planForDate(JS.store.state, today()).plan;
      JS.store.update(function (st, n) {
        sets.forEach(function (x) {
          var exId = x.exercise_id || null;
          var inPlan = plan && exId && plan.items.some(function (i) { return i.exerciseId === exId; });
          T.quickSet(st, { exerciseId: exId, load: Number(x.load), reps: Number(x.reps), serie: x.serie, at: x.created_at, via: 'atalho',
            date: C.toDateKey(new Date(x.created_at)), planId: inPlan ? plan.id : null }, n);
        });
      });
      showSession();
      return post('quick-ack', { deviceId: q.deviceId, token: q.token, ids: sets.map(function (x) { return x.id; }) }).then(function () {
        ui.toast(sets.length === 1 ? '1 série do atalho do iPhone foi registrada.' : sets.length + ' séries do atalho do iPhone foram registradas.', { timeout: 4500 });
        return sets.length;
      });
    }).catch(function () { return 0; }).then(function (n) { pulling = false; return n; });
  }

  /* ---------------- Telinha do registro rápido (no app) ---------------- */

  function fmt(v) { return JS.graf.fmtNum(Number(v) || 0, 1); }
  function parse(v) { var n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; }

  // Exercícios para escolher: os do treino em andamento, os da ficha do dia e os feitos recentemente.
  function options() {
    var s = JS.store.state, x = T.activeSession(s), out = [], seen = {};
    function add(id) { if (id && !seen[id]) { seen[id] = 1; out.push({ id: id, name: T.exerciseName(s, id) }); } }
    if (x) x.items.forEach(function (i) { add(i.exerciseId); });
    var p = T.planForDate(s, today()).plan;
    if (p) p.items.forEach(function (i) { add(i.exerciseId); });
    T.doneSessions(s).slice(-8).reverse().forEach(function (d) { d.items.forEach(function (i) { if (i.sets.length) add(i.exerciseId); }); });
    return out;
  }
  // Valores sugeridos para o exercício: do treino em andamento; senão, a última série feita; senão, a ficha.
  function suggestion(exId) {
    var s = JS.store.state, x = T.activeSession(s);
    var it = x && x.items.filter(function (i) { return i.exerciseId === exId; })[0];
    if (it) return { load: it.load, reps: it.reps, serie: it.sets.length + 1, of: it.targetSets };
    var ls = T.lastSet(s, exId);
    var p = T.planForDate(s, today()).plan, pi = p && p.items.filter(function (i) { return i.exerciseId === exId; })[0];
    var loads = pi ? T.itemLoads(pi) : null;
    return { load: ls ? ls.load : loads ? loads[0] : 0, reps: ls ? ls.reps : pi ? (parseInt(pi.reps, 10) || 10) : 10, serie: 1, of: pi ? pi.sets : null };
  }

  // opts: { source: 'toque-atras' | 'link' | 'abrir' | 'botao', exerciseId }
  function open(opts) {
    opts = opts || {};
    var s = JS.store.state, x = T.activeSession(s), cur = T.currentItem(x);
    var list = options();
    var exId = opts.exerciseId || (cur && cur.exerciseId) || (list[0] && list[0].id) || null;
    if (!exId) {
      // Nada para sugerir: escolhe o exercício primeiro.
      JS.openExercisePicker(null, null, function (id) { ui.closeSheet(); setTimeout(function () { open(Object.assign({}, opts, { exerciseId: id })); }, 260); });
      return;
    }
    if (!list.some(function (o) { return o.id === exId; })) list.unshift({ id: exId, name: T.exerciseName(s, exId) });
    var sug = suggestion(exId), st = step();
    if (window.JSToque && opts.source === 'toque-atras') { JSToque.vibrate([30, 40, 30]); JSToque.beep(740, 90); }
    var stepper = function (name, label, value, unit, d, mode, extra, cls) {
      return '<div class="qs-row ' + (cls || '') + '"><span class="qs-label">' + label + '</span><div class="qs-step">' +
        '<button type="button" class="qs-btn" data-q="' + name + '" data-d="-' + d + '" aria-label="Diminuir ' + label.toLowerCase() + '">−</button>' +
        '<label class="qs-val"><input name="' + name + '" type="text" inputmode="' + mode + '" autocomplete="off" value="' + value + '" aria-label="' + label + '"><small' + (name === 'serie' ? ' data-of' : '') + '>' + unit + '</small></label>' +
        '<button type="button" class="qs-btn" data-q="' + name + '" data-d="' + d + '" aria-label="Aumentar ' + label.toLowerCase() + '">+</button></div>' + (extra || '') + '</div>';
    };
    var body = '<div class="quick-set">' +
      '<p class="qs-kicker">' + esc(x ? x.planName : (T.planForDate(s, today()).plan || {}).name || 'Treino livre') + (x ? '' : ' • começa ao salvar') + '</p>' +
      '<label class="qs-exlabel">Exercício<select name="ex" class="qs-select">' + list.map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.id === exId ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') +
      '<option value="__outro">Outro exercício…</option></select></label>' +
      stepper('load', 'Peso utilizado', fmt(sug.load), 'kg', st, 'decimal',
        '<div class="quick-chips qs-chips">' + [-5, -2.5, 2.5, 5].map(function (d) { return '<button type="button" class="chip" data-q="load" data-d="' + d + '">' + (d > 0 ? '+' : '−') + fmt(Math.abs(d)) + ' kg</button>'; }).join('') + '</div>') +
      '<div class="qs-two">' + stepper('reps', 'Repetições', sug.reps, 'rep.', 1, 'numeric', '', 'sm') + stepper('serie', 'Série', sug.serie, sug.of ? 'de ' + sug.of : '', 1, 'numeric', '', 'sm') + '</div>' +
      '<p class="qs-last" data-last></p>' +
      (opts.source === 'toque-atras' ? '<p class="qs-hint">' + ui.icon('phone', 14) + ' Bata 2 vezes atrás de novo para salvar.</p>' : '') + '</div>';
    var form = ui.openSheet({
      title: 'Registro rápido', body: body, submitLabel: 'Salvar série', cancelLabel: 'Fechar',
      onOpen: function (fm) {
        var lastEl = fm.querySelector('[data-last]');
        function showLast(id) {
          var ls = T.lastSet(JS.store.state, id), hist = T.exerciseTrend(JS.store.state, id);
          lastEl.textContent = ls ? 'Última: ' + JS.kg(ls.load) + ' × ' + ls.reps + (hist ? ' • maior carga: ' + JS.kg(hist.best) : '') : 'Primeira vez neste exercício.';
        }
        showLast(exId);
        fm.querySelectorAll('[data-q]').forEach(function (b) {
          b.addEventListener('click', function () {
            var inp = fm.elements[b.dataset.q], v = Math.max(b.dataset.q === 'serie' ? 1 : 0, Math.round(((parse(inp.value) || 0) + Number(b.dataset.d)) * 10) / 10);
            inp.value = b.dataset.q === 'load' ? fmt(v) : String(Math.round(v));
            JS.anim.restartClass(inp.closest('.qs-val'), 'bump');
          });
        });
        fm.elements.ex.addEventListener('change', function () {
          var id = fm.elements.ex.value;
          if (id === '__outro') {
            JS.openExercisePicker(null, null, function (pid) { ui.closeSheet(); setTimeout(function () { open(Object.assign({}, opts, { exerciseId: pid })); }, 260); });
            return;
          }
          var sg = suggestion(id);
          fm.elements.load.value = fmt(sg.load); fm.elements.reps.value = sg.reps; fm.elements.serie.value = sg.serie;
          fm.querySelector('[data-of]').textContent = sg.of ? 'de ' + sg.of : '';
          showLast(id);
        });
      },
      onSubmit: function (v, fm) { return save(fm, opts); }
    });
    quick = { confirm: function () { if (form && form.isConnected) form.requestSubmit(); } };
    document.getElementById('sheet').addEventListener('close', function () { quick = null; }, { once: true });
  }

  function save(fm, opts) {
    var exId = fm.elements.ex.value, load = parse(fm.elements.load.value), reps = parse(fm.elements.reps.value), serie = parse(fm.elements.serie.value);
    var e = {};
    if (!(load >= 0 && load <= 999)) e.load = 'Peso inválido.';
    if (!(reps >= 0 && reps <= 999)) e.reps = 'Repetições inválidas.';
    if (!(serie >= 1 && serie <= 50)) e.serie = 'Série inválida.';
    if (!exId || exId === '__outro') e.ex = 'Escolha o exercício.';
    if (Object.keys(e).length) { ui.toast(e[Object.keys(e)[0]], { error: true }); return false; }
    var s = JS.store.state, x = T.activeSession(s), cur = T.currentItem(x);
    var via = opts.source === 'toque-atras' ? 'toque-atras' : 'registro';
    quick = null;
    // Próxima série do exercício atual do treino: usa o registro normal (aviso, descanso, fim do treino).
    if (x && cur && cur.exerciseId === exId && serie === cur.sets.length + 1 && JS.registerSet) {
      JS.store.silentUpdate(function (st) { T.setItemValues(st, x.id, cur.id, { load: load, reps: reps }); });
      setTimeout(function () { JS.registerSet(via, true); }, 60);
      return;
    }
    var p = T.planForDate(s, today()).plan;
    var inPlan = p && p.items.some(function (i) { return i.exerciseId === exId; });
    var res = null;
    JS.store.update(function (st, n) { res = T.quickSet(st, { exerciseId: exId, load: load, reps: reps, serie: serie, via: via, planId: inPlan ? p.id : null, date: today() }, n); });
    if (!res) return;
    if (window.JSToque) JSToque.confirmSet();
    ui.toast((res.corrected ? '✓ Série ' + res.serie + ' corrigida: ' : '✓ Série ' + res.serie + ' salva: ') + JS.kg(load) + ' × ' + reps + (res.started ? ' • treino começou' : ''));
    if (res.started && JS.app.route() !== 'sessao') setTimeout(function () { JS.app.go('sessao'); }, 250);
  }

  function isOpen() { return !!quick && document.getElementById('sheet').open; }

  /* ---------------- Link #/registro e início ---------------- */

  // Tela "registro": só redireciona para o treino e abre a telinha (usada pelo atalho do ícone).
  JS.telas.registro = {
    title: 'Registro rápido', render: function () { return ''; },
    enter: function () {
      setTimeout(function () {
        var act = T.activeSession(JS.store.state);
        if (JS.treinoView) JS.treinoView.mode = 'hoje';
        history.replaceState(null, '', '#/' + (act ? 'sessao' : 'treino'));
        JS.app.render();
        setTimeout(function () { open({ source: 'link' }); }, 200);
      }, 0);
    }
  };

  function start() {
    JS.store.subscribe(scheduleContext);
    // Abriu o app durante o treino (ex.: pelo Toque rápido do Android): abre a telinha.
    if (window.JS_OPENED_TARGET === 'sessao' && JS.store.state.settings.quickOnOpen !== false) setTimeout(function () { open({ source: 'abrir' }); }, 450);
    if (cfg() && cfg().enabled) { syncContext(true); pull(); }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { pull(); syncContext(); }
    });
    clearInterval(pullTimer);
    pullTimer = setInterval(function () { if (document.visibilityState === 'visible' && cfg() && cfg().enabled) pull(); }, 30000);
  }

  JS.registro = { open: open, isOpen: isOpen, confirm: function () { if (quick) quick.confirm(); }, enable: enable, disable: disable, link: link, pull: pull, syncContext: syncContext, start: start };
  JS.openQuickRegister = open;
})();
