/*
 * J.S. — versões do dia e lixeira (recuperar o que foi apagado). Tudo LOCAL, sem servidor.
 *
 * O app guarda no próprio aparelho (IndexedDB "js-versoes") uma foto comprimida dos dados por dia
 * (14 dias) e uma "cópia de segurança" antes de restaurar, importar ou apagar tudo (30 dias).
 * Comparando uma foto com os dados de hoje, aparece o que existia e sumiu, e dá para recuperar item
 * por item (sem duplicar) ou voltar o app inteiro para aquele dia. As fotos do corpo não entram.
 * Os snapshots só existem neste aparelho: não vão para o backup em arquivo, nem para a transferência,
 * nem para o backup automático.
 *
 * Duas partes: funções puras (diff, recuperar, retenção, repositório com backend plugável), que rodam
 * no navegador e no Node (testes/v28-dados.test.js), e a interface (Configurações) em initUI.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSVersoes = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var G = typeof globalThis !== 'undefined' ? globalThis : root;
  var req = typeof require === 'function';
  var C = root.JSCore || (req ? require('./core.js') : null);
  var R = root.JSRegras || (req ? (function () { try { return require('./regras.js'); } catch (e) { return null; } })() : null);

  var DAY_DAYS = 14, SEG_DAYS = 30, SEG_MAX = 10, MAX_BYTES = 25 * 1024 * 1024, REFRESH_MS = 30 * 60000;

  /* ================= O que conta como "apagado" ================= */

  function fd(d) { return d && C.isDateKey(d) ? C.formatDateBR(d) : ''; }
  function plural(n, um, vrios) { return n + ' ' + (n === 1 ? um : vrios); }
  function setsOf(s) { return (s.items || []).reduce(function (a, it) { return a + (it.sets || []).length; }, 0); }
  function money(c) { return C.formatCents ? C.formatCents(c || 0) : String(c); }
  function hairName(e) { return R && R.hairName ? R.hairName(e) : (e.name || e.type || 'Tratamento'); }

  // key = coleção em state; keep = só considera estes itens da foto; title/sub = texto para a usuária.
  var COLS = [
    { key: 'tasks', label: 'Tarefas', title: function (t) { return t.title || 'Tarefa'; },
      sub: function (t) { return (t.dueDate ? 'para ' + fd(t.dueDate) + (t.dueTime ? ' às ' + t.dueTime : '') : 'sem data') + (t.recurrence && t.recurrence !== 'none' ? ' • repete' : ''); } },
    { key: 'workoutSessions', label: 'Treinos feitos', keep: function (s) { return s.status === 'done'; },
      title: function (s) { return (s.planName || 'Treino') + ' — ' + fd(s.date); }, sub: function (s) { return plural(setsOf(s), 'série', 'séries'); } },
    { key: 'workoutPlans', label: 'Fichas de treino', title: function (p) { return p.name || 'Ficha'; }, sub: function (p) { return plural((p.items || []).length, 'exercício', 'exercícios'); } },
    { key: 'exercises', label: 'Exercícios criados', title: function (e) { return e.name || 'Exercício'; }, sub: function () { return ''; } },
    { key: 'savedMeals', label: 'Refeições salvas', title: function (m) { return m.name || 'Refeição'; }, sub: function (m) { return plural((m.items || []).length, 'alimento', 'alimentos'); } },
    { key: 'foodLogs', label: 'Alimentos do diário', title: function (l) { return String(l.name || 'Alimento').split(',')[0]; },
      sub: function (l) { return (l.grams ? l.grams + ' g • ' : '') + fd(l.date) + (l.meal && C.MEAL_TYPES && C.MEAL_TYPES[l.meal] ? ' • ' + C.MEAL_TYPES[l.meal] : ''); } },
    { key: 'customFoods', label: 'Alimentos cadastrados', title: function (f) { return f.name || 'Alimento'; }, sub: function () { return ''; } },
    { key: 'meals', label: 'Horários de refeição', title: function (m) { return m.name || 'Refeição'; }, sub: function (m) { return m.time || ''; } },
    { key: 'bills', label: 'Contas', title: function (b) { return b.title || 'Conta'; }, sub: function (b) { return money(b.amountCents) + ' • vence ' + fd(b.dueDate); } },
    { key: 'bodyRecords', label: 'Medições do corpo', title: function (r) { return 'Medição de ' + fd(r.date); }, sub: function (r) { return r.weightKg ? r.weightKg + ' kg' : ''; } },
    { key: 'hairEvents', label: 'Tratamentos capilares', title: hairName, sub: function (e) { return fd(e.date) + (e.time ? ' às ' + e.time : ''); } },
    { key: 'cyclePeriods', label: 'Menstruações registradas', title: function (p) { return 'Menstruação de ' + fd(p.start); }, sub: function (p) { return p.end ? 'até ' + fd(p.end) : ''; } }
  ];
  function col(key) { for (var i = 0; i < COLS.length; i++) if (COLS[i].key === key) return COLS[i]; return null; }

  // Itens que existiam em "old" e não existem mais em "cur": [{ key, label, items: [{ id, title, sub, raw }] }]
  function diff(old, cur) {
    var out = [];
    old = old || {}; cur = cur || {};
    COLS.forEach(function (c) {
      var have = {};
      (cur[c.key] || []).forEach(function (x) { if (x && x.id) have[x.id] = true; });
      var items = (old[c.key] || []).filter(function (x) { return x && x.id && !have[x.id] && (!c.keep || c.keep(x)); })
        .map(function (x) { return { id: x.id, key: c.key, title: c.title(x), sub: c.sub(x), raw: x }; });
      if (items.length) out.push({ key: c.key, label: c.label, items: items });
    });
    return out;
  }
  function total(groups) { return groups.reduce(function (a, g) { return a + g.items.length; }, 0); }

  // Traz um item de volta (com o id original). Não duplica. Devolve true se reinseriu.
  function recover(state, key, item, old) {
    var c = col(key);
    if (!c || !item || !item.id) return false;
    if (!Array.isArray(state[key])) state[key] = [];
    if (state[key].some(function (x) { return x && x.id === item.id; })) return false;
    state[key].push(JSON.parse(JSON.stringify(item)));
    old = old || {};
    // o que "pertence" ao item e fica em outro lugar
    if (key === 'tasks' && old.taskOcc) {
      if (!state.taskOcc) state.taskOcc = {};
      Object.keys(old.taskOcc).forEach(function (k) { if (k.indexOf(item.id + '|') === 0 && !state.taskOcc[k]) state.taskOcc[k] = JSON.parse(JSON.stringify(old.taskOcc[k])); });
    }
    if (key === 'bills' && Array.isArray(old.payments)) {
      if (!Array.isArray(state.payments)) state.payments = [];
      old.payments.forEach(function (p) { if (p && p.billId === item.id && !state.payments.some(function (x) { return x.id === p.id; })) state.payments.push(JSON.parse(JSON.stringify(p))); });
    }
    if (key === 'meals' && old.mealExceptions) {
      if (!state.mealExceptions) state.mealExceptions = {};
      Object.keys(old.mealExceptions).forEach(function (k) { if (k.indexOf(item.id + '|') === 0 && !state.mealExceptions[k]) state.mealExceptions[k] = JSON.parse(JSON.stringify(old.mealExceptions[k])); });
    }
    return true;
  }

  // Contagens para mostrar na lista de versões.
  function counts(d) {
    d = d || {};
    var n = function (k) { return Array.isArray(d[k]) ? d[k].length : 0; };
    return { treinos: (d.workoutSessions || []).filter(function (s) { return s && s.status === 'done'; }).length, fichas: n('workoutPlans'), tarefas: n('tasks'), alimentos: n('foodLogs'), contas: n('bills'), medicoes: n('bodyRecords') };
  }
  function countsText(c) {
    var p = [];
    if (c.treinos) p.push(plural(c.treinos, 'treino', 'treinos'));
    if (c.tarefas) p.push(plural(c.tarefas, 'tarefa', 'tarefas'));
    if (c.alimentos) p.push(plural(c.alimentos, 'alimento', 'alimentos'));
    if (c.contas) p.push(plural(c.contas, 'conta', 'contas'));
    if (c.medicoes) p.push(plural(c.medicoes, 'medição', 'medições'));
    return p.length ? p.join(' • ') : 'sem dados';
  }

  /* ================= Compressão ================= */

  function concat(list) {
    var n = list.reduce(function (a, x) { return a + x.length; }, 0), out = new Uint8Array(n), o = 0;
    list.forEach(function (x) { out.set(x, o); o += x.length; });
    return out;
  }
  function viaStream(bytes, Stream, mode) {
    var s = new Blob([bytes]).stream().pipeThrough(new Stream(mode));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  // Primeiro byte: 0 = texto puro, 1 = gzip.
  function pack(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof G.CompressionStream === 'undefined') return Promise.resolve(concat([new Uint8Array([0]), bytes]));
    return viaStream(bytes, G.CompressionStream, 'gzip').then(function (z) { return concat([new Uint8Array([1]), z]); });
  }
  function unpack(bytes) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var raw = bytes[0] === 0 ? Promise.resolve(bytes.slice(1)) : viaStream(bytes.slice(1), G.DecompressionStream, 'gzip');
    return raw.then(function (b) { return JSON.parse(new TextDecoder().decode(b)); });
  }

  /* ================= Retenção ================= */

  // Quais versões apagar: fotos do dia com mais de 14 dias; de segurança com mais de 30 dias ou além das 10
  // mais novas; e, passando do limite de espaço, as mais antigas (nunca a "do dia" mais nova).
  function pruneIds(metas, today, o) {
    o = o || {};
    var dayDays = o.dayDays || DAY_DAYS, segDays = o.segDays || SEG_DAYS, segMax = o.segMax || SEG_MAX, maxBytes = o.maxBytes || MAX_BYTES;
    var del = {};
    var byAtDesc = function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; };
    metas.forEach(function (m) {
      var age = C.diffDays(m.date, today);
      if (m.kind === 'dia' && age > dayDays) del[m.id] = true;
      if (m.kind === 'seguranca' && age > segDays) del[m.id] = true;
    });
    metas.filter(function (m) { return m.kind === 'seguranca' && !del[m.id]; }).sort(byAtDesc).slice(segMax).forEach(function (m) { del[m.id] = true; });
    var rest = metas.filter(function (m) { return !del[m.id]; });
    var newestDia = rest.filter(function (m) { return m.kind === 'dia'; }).sort(byAtDesc)[0];
    var sum = rest.reduce(function (a, m) { return a + (m.size || 0); }, 0);
    rest.sort(function (a, b) { return -byAtDesc(a, b); }).forEach(function (m) {
      if (sum <= maxBytes || (newestDia && m.id === newestDia.id)) return;
      del[m.id] = true; sum -= m.size || 0;
    });
    return Object.keys(del);
  }

  /* ================= Repositório (backend plugável: IndexedDB no app, memória nos testes) ================= */

  function memoryBackend() {
    var metas = {}, datas = {};
    return {
      metaAll: function () { return Promise.resolve(Object.keys(metas).map(function (k) { return metas[k]; })); },
      put: function (meta, data) { metas[meta.id] = meta; datas[meta.id] = data; return Promise.resolve(); },
      getData: function (id) { return Promise.resolve(datas[id] || null); },
      del: function (id) { delete metas[id]; delete datas[id]; return Promise.resolve(); }
    };
  }

  function createRepo(backend, opts) {
    opts = opts || {};
    var cache = {}; // id -> dados já abertos (evita descomprimir de novo)
    function metaList() {
      return backend.metaAll().then(function (l) { return l.slice().sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; }); });
    }
    function load(id) {
      if (cache[id]) return Promise.resolve(cache[id]);
      return backend.getData(id).then(function (bytes) { return bytes ? unpack(bytes) : null; }).then(function (d) { if (d) cache[id] = d; return d; });
    }
    function put(kind, id, dados, reason, today, nowISO) {
      return pack(dados).then(function (bytes) {
        var meta = { id: id, kind: kind, date: today, at: nowISO, reason: reason || '', size: bytes.length, counts: counts(dados) };
        delete cache[id];
        return backend.put(meta, bytes).then(function () { cache[id] = dados; return meta; });
      });
    }
    function prune(today) {
      return metaList().then(function (metas) {
        var ids = pruneIds(metas, today, opts);
        return Promise.all(ids.map(function (id) { delete cache[id]; return backend.del(id); })).then(function () { return ids; });
      });
    }
    return {
      list: metaList, load: load, prune: prune,
      // Foto do dia: tira na primeira vez do dia. Nas próximas, só atualiza se NADA foi apagado desde a foto
      // (assim a foto continua protegendo o que foi apagado hoje, e ganha o que foi criado).
      ensureDaily: function (dados, today, nowISO, force) {
        var id = 'dia-' + today;
        return metaList().then(function (metas) {
          var mine = metas.filter(function (m) { return m.id === id; })[0];
          if (!mine) return put('dia', id, dados, 'foto do dia', today, nowISO).then(function () { return prune(today); }).then(function () { return 'nova'; });
          if (!force && Date.parse(nowISO) - Date.parse(mine.at) < REFRESH_MS) return 'recente';
          return load(id).then(function (old) {
            if (!old) return put('dia', id, dados, 'foto do dia', today, nowISO).then(function () { return 'nova'; });
            if (diff(old, dados).length) return 'protegendo'; // algo foi apagado: mantém a foto como está
            if (JSON.stringify(old) === JSON.stringify(dados)) return 'igual';
            return put('dia', id, dados, 'foto do dia', today, nowISO).then(function () { return 'atualizada'; });
          });
        });
      },
      security: function (dados, reason, today, nowISO) {
        return put('seguranca', 'seg-' + Date.parse(nowISO) + '-' + Math.floor(Math.random() * 1000), dados, reason, today, nowISO).then(function (m) { return prune(today).then(function () { return m; }); });
      },
      // Tudo que sumiu nos últimos "days" dias (a foto mais nova que ainda tem o item vale).
      // opts.id: só uma versão.
      recoverable: function (cur, nowISO, days, onlyId) {
        var limit = Date.parse(nowISO) - (days || 7) * 86400000;
        return metaList().then(function (metas) {
          var pick = onlyId ? metas.filter(function (m) { return m.id === onlyId; }) : metas.filter(function (m) { return Date.parse(m.at) >= limit; });
          var seen = {}, groups = {}, order = [];
          return pick.reduce(function (chain, m) {
            return chain.then(function () {
              return load(m.id).then(function (old) {
                if (!old) return;
                diff(old, cur).forEach(function (g) {
                  g.items.forEach(function (it) {
                    var k = g.key + '|' + it.id;
                    if (seen[k]) return;
                    seen[k] = true;
                    it.snapId = m.id; it.snapAt = m.at; it.snapDate = m.date; it.old = old;
                    if (!groups[g.key]) { groups[g.key] = { key: g.key, label: g.label, items: [] }; order.push(g.key); }
                    groups[g.key].items.push(it);
                  });
                });
              });
            });
          }, Promise.resolve()).then(function () {
            var out = COLS.filter(function (c) { return groups[c.key]; }).map(function (c) { return groups[c.key]; });
            return { groups: out, total: total(out) };
          });
        });
      },
      clearCache: function () { cache = {}; }
    };
  }

  var api = {
    COLS: COLS, DAY_DAYS: DAY_DAYS, SEG_DAYS: SEG_DAYS, SEG_MAX: SEG_MAX, MAX_BYTES: MAX_BYTES, REFRESH_MS: REFRESH_MS,
    diff: diff, total: total, recover: recover, counts: counts, countsText: countsText, pack: pack, unpack: unpack,
    pruneIds: pruneIds, memoryBackend: memoryBackend, createRepo: createRepo
  };

  /* ================= Interface (só no navegador) ================= */
  if (root.JS && root.document && root.JS.ui && root.JS.store) initUI(api, root);
  return api;

  /* ---- interface ---- */
  function initUI(api, root) {
    var JS = root.JS, ui = JS.ui, esc = ui.esc, Rg = root.JSRegras, Cc = root.JSCore;
    var repoP = null, badge = { total: 0, at: 0, busy: false }, started = false, changeTimer = null;

    ui.addIcons({
      history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'
    });

    function available() { return !!root.indexedDB && typeof root.Blob === 'function'; }
    function today() { return Cc.toDateKey(new Date()); }
    function nowISO() { return new Date().toISOString(); }
    function dadosNow() { return JS.store.exportData().dados; } // sem push/atalho/avisos já mostrados

    /* ---- IndexedDB ---- */
    function idbBackend(db) {
      function tx(stores, mode, fn) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(stores, mode), out = fn(t);
          t.oncomplete = function () { resolve(out && 'result' in out ? out.result : undefined); };
          t.onerror = t.onabort = function () { reject(t.error || new Error('Sem espaço para guardar a versão.')); };
        });
      }
      return {
        metaAll: function () { return tx(['meta'], 'readonly', function (t) { return t.objectStore('meta').getAll(); }).then(function (l) { return l || []; }); },
        put: function (meta, data) { return tx(['meta', 'data'], 'readwrite', function (t) { t.objectStore('meta').put(meta); t.objectStore('data').put(data, meta.id); }); },
        getData: function (id) { return tx(['data'], 'readonly', function (t) { return t.objectStore('data').get(id); }); },
        del: function (id) { return tx(['meta', 'data'], 'readwrite', function (t) { t.objectStore('meta').delete(id); t.objectStore('data').delete(id); }); }
      };
    }
    function getRepo() {
      if (!available()) return Promise.reject(new Error('Este navegador não permite guardar versões.'));
      if (repoP) return repoP;
      repoP = new Promise(function (resolve, reject) {
        var rq = root.indexedDB.open('js-versoes', 1);
        rq.onupgradeneeded = function () {
          if (!rq.result.objectStoreNames.contains('meta')) rq.result.createObjectStore('meta', { keyPath: 'id' });
          if (!rq.result.objectStoreNames.contains('data')) rq.result.createObjectStore('data');
        };
        rq.onsuccess = function () { resolve(api.createRepo(idbBackend(rq.result))); };
        rq.onerror = function () { reject(rq.error || new Error('Não consegui abrir as versões.')); };
      });
      repoP.catch(function () { repoP = null; });
      return repoP;
    }

    /* ---- cópia de segurança antes de coisas que substituem os dados ---- */
    // Fotografa os dados de forma síncrona (antes da troca) e grava em seguida, sem atrasar quem chamou.
    function safety(reason) {
      try {
        var s = JS.store.state;
        if (!s || !Rg.hasAnyData(s)) return;
        var dados = JSON.parse(JSON.stringify(dadosNow())), d = today(), n = nowISO();
        getRepo().then(function (r) { return r.security(dados, reason, d, n); }).then(function () { badge.at = 0; }, function () { /* sem espaço ou sem IndexedDB */ });
      } catch (e) { /* nunca atrapalha o fluxo principal */ }
    }
    if (!JS.store.__versoes) {
      var origImport = JS.store.importData, origReset = JS.store.reset;
      JS.store.importData = function () { safety('antes de restaurar ou importar dados'); return origImport.apply(JS.store, arguments); };
      JS.store.reset = function () { safety('antes de apagar tudo'); return origReset.apply(JS.store, arguments); };
      JS.store.__versoes = true;
    }

    /* ---- foto do dia ---- */
    function daily(force) {
      if (!available() || !JS.store.state) return Promise.resolve();
      return getRepo().then(function (r) { return r.ensureDaily(JSON.parse(JSON.stringify(dadosNow())), today(), nowISO(), force); }).then(function (res) {
        if (res === 'nova' || res === 'atualizada') badge.at = 0;
      }, function () { /* ignora */ });
    }
    function refreshBadge() {
      if (!available() || badge.busy || !JS.store.state) return;
      if (Date.now() - badge.at < 60000) return;
      badge.busy = true;
      getRepo().then(function (r) { return r.recoverable(dadosNow(), nowISO(), 7); }).then(function (res) {
        var changed = res.total !== badge.total;
        badge.total = res.total; badge.at = Date.now(); badge.busy = false;
        if (changed) refreshCard();
      }, function () { badge.busy = false; badge.at = Date.now(); });
    }

    /* ---- cartão em Configurações ---- */
    function cardHtml() {
      var h = '<section class="card vs-card" id="cfg-versoes"><div class="card-head"><h2>' + ui.icon('history', 18) + 'Versões e lixeira</h2>' +
        (badge.total ? ui.tag(badge.total + (badge.total === 1 ? ' item' : ' itens'), 'soft') : '') + '</div>';
      if (!available()) return h + '<p class="hint top">Este navegador não deixa o J.S. guardar versões dos seus dados.</p></section>';
      return h + '<p class="hint top">O J.S. guarda uma foto dos seus dados por dia, <strong>só neste aparelho</strong>, por 14 dias. Apagou algo sem querer? Dá para recuperar. Nada disso vai para o servidor.</p>' +
        '<div class="btn-col"><button type="button" class="btn primary" data-action="vs-trash">' + ui.icon('undo', 18) + 'Recuperar o que foi apagado' + (badge.total ? ' (' + badge.total + ')' : '') + '</button>' +
        '<button type="button" class="btn soft" data-action="vs-list">' + ui.icon('history', 18) + 'Ver versões e voltar no tempo</button></div></section>';
    }
    function refreshCard() {
      var el = root.document.getElementById('cfg-versoes');
      if (!el) return;
      var t = root.document.createElement('div');
      t.innerHTML = cardHtml();
      if (t.firstElementChild) el.replaceWith(t.firstElementChild);
    }
    JS.slots.add('config.secoes', function () { refreshBadge(); return cardHtml(); }, 20);

    /* ---- "Recuperar o que foi apagado" ---- */
    function snapLabel(m) {
      var d = Cc.toDateKey(new Date()), age = Cc.diffDays(m.date, d);
      var when = age === 0 ? 'hoje' : age === 1 ? 'ontem' : Cc.formatDayMonth(m.date);
      return m.kind === 'seguranca' ? 'cópia de segurança de ' + when : 'foto de ' + when;
    }
    function trashBody(res) {
      if (!res.total) return '<div class="empty vs-empty"><p>Nada apagado por aqui. Tudo o que estava nas versões guardadas ainda está no app. 🌷</p></div>';
      var h = '<p class="hint top">Itens que existiam numa versão guardada e não estão mais no app. Toque em <strong>Recuperar</strong> para trazer de volta (sem duplicar).</p>' +
        '<button type="button" class="btn primary full" data-rec-all>' + ui.icon('undo', 18) + 'Recuperar tudo (' + res.total + ')</button>';
      var idx = 0;
      res.groups.forEach(function (g) {
        h += '<p class="stat-label vs-group">' + esc(g.label) + ' (' + g.items.length + ')</p>';
        g.items.slice(0, 40).forEach(function (it) {
          h += '<div class="vs-item"><span class="vs-main"><strong>' + esc(it.title) + '</strong><small>' + esc((it.sub ? it.sub + ' • ' : '') + 'da ' + snapLabel({ date: it.snapDate, kind: it.snapId.indexOf('seg-') === 0 ? 'seguranca' : 'dia' })) + '</small></span>' +
            '<button type="button" class="btn small soft" data-rec="' + (g.key + '|' + it.id) + '">Recuperar</button></div>';
          idx++;
        });
        if (g.items.length > 40) h += '<p class="muted small">+ ' + (g.items.length - 40) + ' mais (recupere os de cima e abra de novo).</p>';
      });
      return h;
    }
    function trashSheet(onlyId) {
      getRepo().then(function (r) { return r.recoverable(dadosNow(), nowISO(), 7, onlyId); }).then(function (res) {
        ui.openSheet({
          title: 'Recuperar o que foi apagado', subtitle: onlyId ? 'Só desta versão' : 'Últimos 7 dias', body: '<div data-vs-body>' + trashBody(res) + '</div>',
          onOpen: function (form) {
            var box = form.querySelector('[data-vs-body]');
            function find(k) {
              for (var i = 0; i < res.groups.length; i++) for (var j = 0; j < res.groups[i].items.length; j++) { var it = res.groups[i].items[j]; if (res.groups[i].key + '|' + it.id === k) return { g: res.groups[i], i: j, it: it }; }
              return null;
            }
            function drop(f) { f.g.items.splice(f.i, 1); if (!f.g.items.length) res.groups = res.groups.filter(function (x) { return x !== f.g; }); res.total = api.total(res.groups); }
            form.addEventListener('click', function (e) {
              var one = e.target.closest('[data-rec]'), all = e.target.closest('[data-rec-all]');
              if (!one && !all) return;
              e.preventDefault();
              var n = 0;
              JS.store.update(function (s) {
                if (one) { var f = find(one.dataset.rec); if (f && api.recover(s, f.g.key, f.it.raw, f.it.old)) { n++; drop(f); } else if (f) drop(f); }
                else res.groups.slice().forEach(function (g) { g.items.slice().forEach(function (it) { if (api.recover(s, g.key, it.raw, it.old)) n++; }); });
              });
              if (all) { res.groups = []; res.total = 0; }
              box.innerHTML = trashBody(res);
              badge.at = 0; badge.total = res.total;
              ui.toast(n ? (n === 1 ? 'Recuperado.' : n + ' itens recuperados.') + ' 🌷' : 'Esse item já estava de volta.');
              refreshCard();
            });
          }
        });
      }, function (e) { ui.toast(e.message || 'Não consegui abrir as versões.', { error: true }); });
    }

    /* ---- lista de versões ---- */
    function restoreAll(id) {
      ui.confirm({ title: 'Voltar o app inteiro?', message: 'Tudo o que está no app agora será substituído pelo que havia nessa versão. Eu guardo antes uma cópia de segurança do estado de agora, então dá para desfazer.', confirmLabel: 'Continuar', danger: true }).then(function (ok) {
        if (!ok) return null;
        // Espera o primeiro aviso terminar de fechar: com "reduzir movimento" ligado, o fechamento é imediato e o
        // evento "close" dele chegaria no segundo aviso, que se resolveria sozinho como "cancelado".
        return new Promise(function (r) { setTimeout(r, 320); }).then(function () {
          return ui.confirm({ title: 'Tem certeza?', message: 'Treinos, tarefas, refeições e tudo mais voltam ao que eram nessa versão.', confirmLabel: 'Voltar no tempo', danger: true });
        });
      }).then(function (ok) {
        if (!ok) return;
        return getRepo().then(function (r) { return r.load(id); }).then(function (dados) {
          if (!dados) { ui.toast('Não achei essa versão.', { error: true }); return; }
          JS.store.importData({ app: 'J.S.', tipo: 'backup', versao: Rg.SCHEMA_VERSION, exportadoEm: nowISO(), dados: JSON.parse(JSON.stringify(dados)) });
          JS.store.update(function (s, n) { Rg.ensureRecurringBills(s, today(), n); });
          badge.at = 0;
          JS.app.go('inicio');
          ui.toast('Pronto: o app voltou a essa versão. A cópia de agora está em "Ver versões".', { timeout: 6000 });
        });
      }).catch(function (e) { ui.toast('Não consegui voltar: ' + (e && e.message), { error: true }); });
    }
    function listSheet() {
      getRepo().then(function (r) { return r.list(); }).then(function (metas) {
        var rows = metas.map(function (m) {
          return '<div class="vs-ver"><span class="vs-main"><strong>' + esc(m.kind === 'seguranca' ? 'Cópia de segurança' : 'Foto do dia') + ' • ' + esc(Cc.formatDateBR(m.date)) + '</strong>' +
            '<small>' + esc(m.kind === 'seguranca' ? m.reason + ' • ' : '') + esc(api.countsText(m.counts || {})) + '</small></span>' +
            '<span class="vs-btns"><button type="button" class="btn small soft" data-trash="' + esc(m.id) + '">Ver apagados</button>' +
            '<button type="button" class="btn small ghost" data-back="' + esc(m.id) + '">Voltar tudo</button></span></div>';
        }).join('');
        ui.openSheet({
          title: 'Versões guardadas', subtitle: metas.length + (metas.length === 1 ? ' versão' : ' versões') + ' neste aparelho',
          body: (rows || '<div class="empty vs-empty"><p>Ainda não há versões. A primeira é feita ao abrir o app.</p></div>') +
            '<p class="hint">A foto do dia fica 14 dias; a cópia de segurança (antes de restaurar ou apagar tudo), 30 dias. Ocupam pouco espaço e ficam só neste aparelho.</p>',
          onOpen: function (form) {
            form.addEventListener('click', function (e) {
              var t = e.target.closest('[data-trash]'), b = e.target.closest('[data-back]');
              if (t) { e.preventDefault(); ui.closeSheet(); setTimeout(function () { trashSheet(t.dataset.trash); }, 260); }
              else if (b) { e.preventDefault(); ui.closeSheet(); setTimeout(function () { restoreAll(b.dataset.back); }, 260); }
            });
          }
        });
      }, function (e) { ui.toast(e.message || 'Não consegui abrir as versões.', { error: true }); });
    }
    JS.actions['vs-trash'] = function () { trashSheet(null); };
    JS.actions['vs-list'] = listSheet;

    /* ---- início (depois da intro, em ocioso: não atrasa a abertura) ---- */
    function start() {
      if (started) return;
      started = true;
      if (!available()) return;
      daily(false).then(refreshBadge);
      JS.store.subscribe(function () {
        clearTimeout(changeTimer);
        changeTimer = setTimeout(function () { daily(false); badge.at = 0; }, 5 * 60000);
      });
      root.document.addEventListener('visibilitychange', function () {
        if (root.document.visibilityState === 'hidden') daily(false);
        else if (Cc.toDateKey(new Date()) !== lastDay) { lastDay = Cc.toDateKey(new Date()); daily(false); }
      });
    }
    var lastDay = Cc.toDateKey(new Date());
    function boot() { JS.intro.whenDone(function () { (root.requestIdleCallback ? root.requestIdleCallback.bind(root) : function (f) { setTimeout(f, 1500); })(start); }); }
    if (JS.intro && JS.intro.whenDone) {
      if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot); else boot();
    }

    JS.versoes = { available: available, snapshot: function (why) { safety(why || 'cópia manual'); }, daily: daily, recoverableCount: function () { return badge.total; } };
  }
});
