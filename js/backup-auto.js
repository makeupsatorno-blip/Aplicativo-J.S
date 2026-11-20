/*
 * J.S. — backup automático cifrado.
 *
 * O aparelho gera um "código de recuperação" (16 letras/números) que só fica nele (localStorage, nunca
 * no state: o state vai para backups e transferências). Do código saem, no próprio aparelho, a chave
 * (AES-GCM 256, PBKDF2) e o id usado no servidor. Os dados são comprimidos, cifrados e enviados em
 * pedaços para a função js-push (rotas backup-*); o servidor só guarda conteúdo cifrado, tamanho e data.
 * Fica o último backup e 1 por dia nos últimos 7 dias. Sem o código, ninguém recupera.
 *
 * Este arquivo tem duas partes: as funções puras (código, cifra, decisão de quando fazer backup),
 * que rodam no navegador e no Node (testes/v28-dados.test.js), e a interface (Configurações, Início),
 * que só liga quando existe window.JS. Só aparece se JS_CONFIG.backup === true (js/config.js).
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSBackupAuto = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var G = typeof globalThis !== 'undefined' ? globalThis : root;

  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // sem I, L, O, U (não confunde)
  var CODE_LEN = 16, PART = 1000000, ITER = 150000, SALT = 'js-backup-v1';
  var MAX_B64 = 16000000;                          // ~12 MB cifrados: acima disso as fotos ficam de fora
  var MS_H = 3600000;
  var OPEN_AFTER_MS = 20 * MS_H, DEBOUNCE_MS = 10 * 60000, MIN_GAP_MS = 3 * MS_H, RETRY_MS = 15 * 60000;
  var STALE_MS = 7 * 24 * MS_H, LIST_EVERY_MS = 7 * 24 * MS_H, CHECK_THROTTLE_MS = 30 * 60000;

  /* ================= Funções puras ================= */

  function subtle() { return G.crypto && G.crypto.subtle; }

  function newCode() {
    var b = new Uint8Array(CODE_LEN), s = '';
    G.crypto.getRandomValues(b);
    for (var i = 0; i < CODE_LEN; i++) s += ALPHA[b[i] & 31];
    return s;
  }
  // Aceita minúsculas, espaços, traços e letras parecidas (O→0, I/L→1, U→V).
  function normalize(code) {
    return String(code || '').toUpperCase().replace(/[\s\-.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  }
  function valid(code) { var c = normalize(code); return c.length === CODE_LEN && c.split('').every(function (ch) { return ALPHA.indexOf(ch) >= 0; }); }
  function pretty(code) { var c = normalize(code); return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8, 12) + '-' + c.slice(12); }

  function hex(bytes) { return Array.prototype.map.call(bytes, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  function randomHex(n) { var b = new Uint8Array(n); G.crypto.getRandomValues(b); return hex(b); }

  // Código → { key (AES-GCM), id (64 hex) } com PBKDF2 (o mesmo em qualquer aparelho).
  function derive(code) {
    var enc = new TextEncoder();
    return subtle().importKey('raw', enc.encode(normalize(code)), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SALT), iterations: ITER }, base, 512);
    }).then(function (bits) {
      var all = new Uint8Array(bits);
      return subtle().importKey('raw', all.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']).then(function (key) {
        return { key: key, id: hex(all.slice(32, 64)) };
      });
    });
  }

  function concat(list) {
    var n = list.reduce(function (a, x) { return a + x.length; }, 0), out = new Uint8Array(n), o = 0;
    list.forEach(function (x) { out.set(x, o); o += x.length; });
    return out;
  }
  function streamBytes(bytes, Stream, mode) {
    var s = new Blob([bytes]).stream().pipeThrough(new Stream(mode));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  // Primeiro byte: 0 = sem compressão, 1 = gzip.
  function compress(bytes) {
    if (typeof G.CompressionStream === 'undefined') return Promise.resolve(concat([new Uint8Array([0]), bytes]));
    return streamBytes(bytes, G.CompressionStream, 'gzip').then(function (z) { return concat([new Uint8Array([1]), z]); });
  }
  function decompress(bytes) {
    if (bytes[0] === 0) return Promise.resolve(bytes.slice(1));
    if (typeof G.DecompressionStream === 'undefined') return Promise.reject(new Error('Atualize o navegador deste aparelho para restaurar.'));
    return streamBytes(bytes.slice(1), G.DecompressionStream, 'gzip');
  }
  function toB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return G.btoa(s);
  }
  function fromB64(s) {
    var bin = G.atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // objeto → { b64, bytes } (iv + cifra, em base64)
  function encrypt(obj, code) {
    return Promise.all([derive(code), Promise.resolve(new TextEncoder().encode(JSON.stringify(obj)))]).then(function (r) {
      return compress(r[1]).then(function (z) {
        var iv = G.crypto.getRandomValues(new Uint8Array(12));
        return subtle().encrypt({ name: 'AES-GCM', iv: iv }, r[0].key, z).then(function (c) {
          var all = concat([iv, new Uint8Array(c)]);
          return { b64: toB64(all), bytes: all.length };
        });
      });
    });
  }
  // base64 → objeto. Código errado (ou dados adulterados): erro com .code = 'codigo'.
  function decrypt(b64, code) {
    return derive(code).then(function (d) {
      var all = fromB64(b64);
      return subtle().decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, d.key, all.slice(12)).catch(function () {
        var e = new Error('Não foi possível abrir o backup: confira o código.'); e.code = 'codigo'; throw e;
      });
    }).then(function (plain) { return decompress(new Uint8Array(plain)); })
      .then(function (bytes) { return JSON.parse(new TextDecoder().decode(bytes)); });
  }
  function split(b64, size) {
    var out = [], n = size || PART;
    for (var i = 0; i < b64.length; i += n) out.push(b64.slice(i, i + n));
    return out.length ? out : [''];
  }

  function sha256(text) {
    return subtle().digest('SHA-256', new TextEncoder().encode(text)).then(function (b) { return hex(new Uint8Array(b)); });
  }
  // O que conta como "mudou": tudo menos a data do último backup (que o próprio backup atualiza).
  function hashText(dados, photosFp) {
    var d = Object.assign({}, dados);
    d.settings = Object.assign({}, dados && dados.settings);
    delete d.settings.lastBackupAt;
    return JSON.stringify(d) + (photosFp ? '|fotos:' + photosFp : '');
  }

  // Resumo do que há dentro de um backup (para a usuária conferir antes de restaurar).
  function summarize(dados, fotos) {
    dados = dados || {};
    var len = function (k) { return Array.isArray(dados[k]) ? dados[k].length : 0; };
    return {
      treinos: (dados.workoutSessions || []).filter(function (s) { return s && s.status === 'done'; }).length,
      fichas: len('workoutPlans'), tarefas: len('tasks'), refeicoesSalvas: len('savedMeals'), alimentos: len('foodLogs'),
      contas: len('bills'), medicoes: len('bodyRecords'), ciclos: len('cyclePeriods'), tratamentos: len('hairEvents'),
      fotos: Array.isArray(fotos) ? fotos.length : 0
    };
  }
  function summaryText(sm) {
    var parts = [];
    function add(n, um, vrios) { if (n) parts.push(n + ' ' + (n === 1 ? um : vrios)); }
    add(sm.treinos, 'treino feito', 'treinos feitos'); add(sm.fichas, 'ficha', 'fichas'); add(sm.tarefas, 'tarefa', 'tarefas');
    add(sm.refeicoesSalvas, 'refeição salva', 'refeições salvas'); add(sm.alimentos, 'alimento registrado', 'alimentos registrados');
    add(sm.contas, 'conta', 'contas'); add(sm.medicoes, 'medição', 'medições'); add(sm.ciclos, 'ciclo', 'ciclos');
    add(sm.tratamentos, 'tratamento capilar', 'tratamentos capilares'); add(sm.fotos, 'foto do corpo', 'fotos do corpo');
    return parts.length ? parts.join(', ') : 'nenhum dado';
  }

  // Quando fazer backup. est: { on, lastOkAt (ms), lastErrorAt (ms) }. trigger: abrir | voltar | mudanca | manual.
  // changed: o app tem mudança desde o último backup (aqui assumimos que sim; o hash confirma depois).
  function decide(est, now, trigger, lastChangeAt) {
    if (!est || !est.on) return { run: false, why: 'desligado' };
    if (trigger === 'manual') return { run: true, why: 'manual' };
    if (est.lastErrorAt && now - est.lastErrorAt < RETRY_MS) return { run: false, wait: RETRY_MS - (now - est.lastErrorAt), why: 'erro-recente' };
    if (!est.lastOkAt) return { run: true, why: 'primeiro' };
    var sinceOk = now - est.lastOkAt;
    if (trigger === 'abrir' || trigger === 'voltar') {
      if (sinceOk >= OPEN_AFTER_MS) return { run: true, why: '20h' };
      // Mudou há pouco: deixa para o temporizador de mudança (mínimo de 3 h entre envios).
      return { run: false, wait: Math.max(MIN_GAP_MS - sinceOk, 0) + DEBOUNCE_MS, why: 'cedo' };
    }
    var sinceChange = lastChangeAt ? now - lastChangeAt : DEBOUNCE_MS;
    if (sinceOk >= MIN_GAP_MS && sinceChange >= DEBOUNCE_MS) return { run: true, why: 'mudanca' };
    return { run: false, wait: Math.max(MIN_GAP_MS - sinceOk, DEBOUNCE_MS - sinceChange, 1000), why: 'espera' };
  }
  function stale(est, now) { return !!(est && est.on && est.lastOkAt && now - est.lastOkAt > STALE_MS); }

  function kb(bytes) { return bytes >= 1048576 ? (Math.round(bytes / 104857.6) / 10).toString().replace('.', ',') + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'; }
  // "hoje 14:32", "ontem 09:10", "19/11 14:32"
  function when(iso, nowDate) {
    var d = new Date(iso), n = nowDate || new Date();
    if (isNaN(d.getTime())) return '';
    var p = function (x) { return String(x).padStart(2, '0'); }, hm = p(d.getHours()) + ':' + p(d.getMinutes());
    var day = function (x) { return x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate(); };
    var y = new Date(n.getTime()); y.setDate(y.getDate() - 1);
    if (day(d) === day(n)) return 'hoje ' + hm;
    if (day(d) === day(y)) return 'ontem ' + hm;
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + hm;
  }

  var api = {
    ALPHA: ALPHA, CODE_LEN: CODE_LEN, PART: PART, MAX_B64: MAX_B64,
    OPEN_AFTER_MS: OPEN_AFTER_MS, DEBOUNCE_MS: DEBOUNCE_MS, MIN_GAP_MS: MIN_GAP_MS, RETRY_MS: RETRY_MS, STALE_MS: STALE_MS,
    newCode: newCode, normalize: normalize, valid: valid, pretty: pretty, derive: derive, randomHex: randomHex,
    encrypt: encrypt, decrypt: decrypt, split: split, sha256: sha256, hashText: hashText,
    summarize: summarize, summaryText: summaryText, decide: decide, stale: stale, kb: kb, when: when
  };

  /* ================= Interface (só no navegador) ================= */
  if (root.JS && root.document && root.JS.ui) initUI(api, root);
  return api;

  /* ---- interface ---- */
  function initUI(api, root) {
  var JS = root.JS, ui = JS.ui, esc = ui.esc;
  var LS_CODE = 'js-backup-codigo', LS_EST = 'js-backup-estado';
  var running = false, timer = null, lastChangeAt = 0, lastCheckAt = 0, dismissedStale = false, started = false;

  ui.addIcons({
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8"/><path d="m16 7 3 3"/><path d="m18.5 4.5 3 3"/>'
  });

  /* ---------- Armazenamento local (só neste aparelho) ---------- */
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { root.localStorage.removeItem(k); } catch (e) { /* sem armazenamento */ } }
  function getCode() { var c = lsGet(LS_CODE); return c && api.valid(c) ? api.normalize(c) : null; }
  function setCode(c) { lsSet(LS_CODE, api.normalize(c)); }
  function getEst() { try { return JSON.parse(lsGet(LS_EST) || 'null') || { on: false }; } catch (e) { return { on: false }; } }
  function setEst(patch) { var e = Object.assign(getEst(), patch); lsSet(LS_EST, JSON.stringify(e)); return e; }

  function apiUrl() { return ((root.JS_CONFIG || {}).pushApi || '').replace(/\/+$/, ''); }
  function available() { return !!((root.JS_CONFIG || {}).backup === true && apiUrl() && root.crypto && root.crypto.subtle && root.fetch); }

  function call(route, body) {
    return root.fetch(apiUrl() + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.error || 'erro'); e.code = j.error; e.status = r.status; throw e; }
          return j;
        });
      }, function () { var e = new Error('Sem internet.'); e.code = 'offline'; throw e; });
  }
  function errText(e) {
    if (!e) return 'Algo deu errado.';
    if (e.code === 'offline') return 'Sem internet. Tento de novo sozinho mais tarde.';
    if (e.code === 'limite-diario') return 'Limite de envios de hoje atingido. Tento de novo amanhã.';
    if (e.code === 'ocupado') return 'O servidor está ocupado agora. Tento de novo mais tarde.';
    if (e.code === 'grande') return e.message;
    return e.message && e.message !== 'erro' ? e.message : 'Não consegui falar com o servidor.';
  }

  /* ---------- Montar o que vai no backup ---------- */
  function photoFingerprint() {
    if (!JS.fotos || !JS.fotos.supported()) return Promise.resolve('');
    return JS.fotos.list().then(function (l) { return l.map(function (r) { return r.id + ':' + (r.full && r.full.size); }).join(','); }).catch(function () { return ''; });
  }
  function buildPayload(withPhotos) {
    var data = JS.store.exportData();
    return (withPhotos ? photoFingerprint() : Promise.resolve('')).then(function (fp) {
      return api.sha256(api.hashText(data.dados, fp)).then(function (hash) { return { data: data, hash: hash, fp: fp }; });
    });
  }

  /* ---------- Enviar ---------- */
  function upload(code, b64, meta, dia, onProgress) {
    var prog = onProgress || function () {}, id, up = api.randomHex(16), parts = api.split(b64);
    return api.derive(code).then(function (d) {
      id = d.id;
      var chain = Promise.resolve(), last = null;
      parts.forEach(function (p, i) {
        chain = chain.then(function () {
          prog((i + 1) / parts.length);
          return call('backup-put', { id: id, up: up, part: i, parts: parts.length, data: p, dia: dia, meta: meta }).then(function (r) { last = r; });
        });
      });
      return chain.then(function () {
        if (!last || last.done !== true) { var e = new Error('O envio ficou incompleto. Tento de novo mais tarde.'); e.code = 'incompleto'; throw e; }
        return last;
      });
    });
  }

  function runBackup(trigger, onProgress) {
    var est = getEst(), code = getCode();
    if (!available() || !est.on || !code) return Promise.resolve({ skipped: 'desligado' });
    if (running) return Promise.resolve({ skipped: 'ocupado' });
    if (!JS.store.state) return Promise.resolve({ skipped: 'sem-dados' });
    running = true;
    setEst({ lastTryAt: Date.now() });
    var withPhotos = !!est.photos && !!JS.fotos && JS.fotos.supported();
    var photosSkipped = false, payload;
    return buildPayload(withPhotos).then(function (p) {
      payload = p;
      if (trigger !== 'manual' && p.hash === est.lastHash) return { skipped: 'sem-mudanca' };
      if (trigger === 'manual' && p.hash === est.lastHash && est.lastOkAt && Date.now() - est.lastOkAt < 24 * 3600000) return { skipped: 'sem-mudanca' };
      var pack = p.data;
      var photos = withPhotos ? JS.fotos.exportAll() : Promise.resolve([]);
      return photos.then(function (fotos) {
        if (fotos.length) pack = Object.assign({}, pack, { fotos: fotos });
        return api.encrypt(pack, code).then(function (enc) {
          if (enc.b64.length > api.MAX_B64 && fotos.length) {
            photosSkipped = true; // fotos grandes demais: manda só os dados
            return api.encrypt(p.data, code);
          }
          return enc;
        });
      }).then(function (enc) {
        if (enc.b64.length > api.MAX_B64) { var e = new Error('Os dados ficaram grandes demais para o backup automático.'); e.code = 'grande'; throw e; }
        var meta = 'v=' + (JS.app && JS.app.VERSION || '') + ';f=' + (withPhotos && !photosSkipped ? 1 : 0);
        var dia = root.JSCore ? root.JSCore.toDateKey(new Date()) : null;
        return upload(code, enc.b64, meta, dia, onProgress).then(function () { return { ok: true, bytes: enc.bytes }; });
      });
    }).then(function (res) {
      running = false;
      if (res.ok) {
        setEst({ lastOkAt: Date.now(), lastHash: payload.hash, lastBytes: res.bytes, lastErrorAt: null, lastError: null, photosSkipped: photosSkipped });
        // Conta como backup feito (some o lembrete de "faça um backup" do Início). Sem emitir: não redesenha a tela.
        JS.store.silentUpdate(function (s, n) { s.settings.lastBackupAt = n; });
      }
      refreshCard();
      return res;
    }, function (e) {
      running = false;
      setEst({ lastErrorAt: Date.now(), lastError: errText(e) });
      refreshCard();
      armTimer(api.RETRY_MS);
      return { error: e };
    });
  }

  /* ---------- Quando ---------- */
  function armTimer(ms) {
    clearTimeout(timer);
    timer = setTimeout(function () { check('mudanca'); }, Math.min(Math.max(ms, 5000), 3 * 3600000));
  }
  function check(trigger) {
    var est = getEst(), now = Date.now();
    if (!available() || !est.on || !getCode()) return;
    if (trigger !== 'mudanca' && now - lastCheckAt < 30 * 60000 && lastCheckAt) return;
    var d = api.decide(est, now, trigger, lastChangeAt);
    if (d.run) {
      lastCheckAt = now;
      (root.requestIdleCallback ? root.requestIdleCallback.bind(root) : function (f) { setTimeout(f, 50); })(function () { runBackup(trigger); });
    } else if (d.wait) armTimer(d.wait);
  }
  function weeklyList() {
    var est = getEst(), code = getCode();
    if (!available() || !est.on || !code) return;
    if (est.lastListAt && Date.now() - est.lastListAt < 7 * 24 * 3600000) return;
    api.derive(code).then(function (d) { return call('backup-list', { id: d.id }); }).then(function () { setEst({ lastListAt: Date.now() }); }, function () { /* tenta na próxima */ });
  }

  /* ---------- Cartão em Configurações ---------- */
  function sw(name, label, checked, hint, change) {
    return '<label class="switch-row"><span class="switch-text"><strong>' + esc(label) + '</strong>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</span>' +
      '<input type="checkbox" class="switch" data-change="' + change + '" name="' + name + '"' + (checked ? ' checked' : '') + '></label>';
  }
  function cardHtml() {
    if (!available()) return '';
    var est = getEst(), code = getCode(), on = !!(est.on && code), now = Date.now();
    var h = '<section class="card bk-card" id="cfg-backup-auto"><div class="card-head"><h2>' + ui.icon('cloud', 18) + 'Backup automático</h2>' + ui.tag(on ? 'Ligado' : 'Desligado', on ? 'success' : 'muted') + '</div>';
    if (!on) {
      return h + '<p class="hint top">O J.S. guarda sozinho uma cópia dos seus dados num servidor, cifrada no seu aparelho. Se você perder ou trocar de celular, é só digitar o seu código de recuperação.</p>' +
        '<ul class="bk-points">' +
        '<li>' + ui.icon('check', 14) + '<span><strong>Vai:</strong> treinos, fichas, alimentação, água, ciclo, rotina, contas, medições e o resto.</span></li>' +
        '<li>' + ui.icon('alert', 14) + '<span><strong>Não vai:</strong> as fotos do corpo (são grandes), a menos que você ligue "Incluir fotos".</span></li>' +
        '<li>' + ui.icon('shield', 14) + '<span>Cifrado aqui no aparelho: o servidor <strong>não consegue ler</strong> nada.</span></li>' +
        '<li>' + ui.icon('key', 14) + '<span>Sem o código <strong>ninguém recupera</strong> o backup. Anote num lugar seguro.</span></li></ul>' +
        '<div class="btn-col"><button type="button" class="btn primary" data-action="bkauto-on">' + ui.icon('cloud', 18) + 'Ligar o backup automático</button>' +
        '<button type="button" class="btn soft" data-action="bkauto-restore">' + ui.icon('download', 18) + 'Já tenho um código: restaurar</button></div></section>';
    }
    var status = est.lastOkAt ? 'Último backup: <strong>' + esc(api.when(new Date(est.lastOkAt).toISOString())) + '</strong>' + (est.lastBytes ? ' • ' + esc(api.kb(est.lastBytes)) + ' (cifrado)' : '')
      : (running ? 'Fazendo o primeiro backup…' : 'Ainda sem backup concluído.');
    h += '<p class="bk-status" data-bk-status>' + status + '</p>';
    if (est.lastErrorAt && (!est.lastOkAt || est.lastErrorAt > est.lastOkAt)) h += '<p class="hint warn-text">' + ui.icon('alert', 14) + ' ' + esc(est.lastError || 'Não consegui enviar o último backup.') + ' Tento de novo sozinho.</p>';
    if (api.stale(est, now)) h += '<p class="hint warn-text">' + ui.icon('alert', 14) + ' Faz mais de 7 dias que não há backup novo. Toque em "Fazer agora".</p>';
    if (est.photosSkipped) h += '<p class="hint">As fotos do corpo ficaram de fora do último backup (passaram de ~12 MB). Use o backup em arquivo para elas.</p>';
    h += sw('bkPhotos', 'Incluir as fotos do corpo', !!est.photos, 'Até ~12 MB cifrados. Se passar, o backup segue sem as fotos.', 'bkauto-fotos') +
      '<div class="btn-col"><button type="button" class="btn primary" data-action="bkauto-now">' + ui.icon('upload', 18) + 'Fazer backup agora</button>' +
      '<button type="button" class="btn soft" data-action="bkauto-versions">' + ui.icon('history', 18) + 'Ver versões e restaurar</button>' +
      '<button type="button" class="btn soft" data-action="bkauto-code">' + ui.icon('key', 18) + 'Mostrar meu código</button>' +
      '<button type="button" class="btn ghost danger-text" data-action="bkauto-off">Desligar e apagar do servidor</button></div>' +
      '<p class="hint">Quando faz: ao abrir o app (se passou 1 dia e algo mudou), e depois de mudanças. Fica o último e 1 por dia nos últimos 7 dias.</p></section>';
    return h;
  }
  function refreshCard() {
    var el = root.document.getElementById('cfg-backup-auto');
    if (!el) return;
    var t = root.document.createElement('div');
    t.innerHTML = cardHtml();
    if (t.firstElementChild) el.replaceWith(t.firstElementChild);
  }
  JS.slots.add('config.secoes', cardHtml, 10);

  /* ---------- Banners no Início ---------- */
  JS.slots.add('inicio.topo', function (s) {
    if (!available()) return '';
    var R = root.JSRegras, est = getEst(), now = Date.now(), html = '';
    if (!R.hasAnyData(s) && !est.on) {
      html += '<div class="banner soft bk-banner"><span class="banner-ic">' + ui.icon('cloud', 20) + '</span><div><strong>Tem um backup automático?</strong>' +
        '<p>Digite o seu código de recuperação e traga tudo de volta.</p></div>' +
        '<div class="banner-actions"><button type="button" class="btn primary small" data-action="bkauto-restore">Restaurar backup automático</button></div></div>';
    }
    if (api.stale(est, now) && !dismissedStale) {
      html += '<div class="banner soft bk-banner"><span class="banner-ic">' + ui.icon('cloud', 20) + '</span><div><strong>Faz mais de 7 dias sem backup</strong>' +
        '<p>O backup automático não conseguiu enviar. Confira a internet.</p></div>' +
        '<div class="banner-actions"><button type="button" class="btn primary small" data-action="bkauto-now">Fazer agora</button>' +
        '<button type="button" class="btn ghost small" data-action="bkauto-stale-dismiss">Depois</button></div></div>';
    }
    return html;
  }, 20);
  JS.actions['bkauto-stale-dismiss'] = function (d, el) {
    JS.anim.removeThen(el, '.banner', function () { dismissedStale = true; JS.app.render(); });
  };

  /* ---------- Ligar ---------- */
  function copyText(text, msg) {
    var ok = function () { ui.toast(msg || 'Copiado.'); };
    if (root.navigator.clipboard && root.navigator.clipboard.writeText) root.navigator.clipboard.writeText(text).then(ok, function () { ui.toast(text); });
    else ui.toast(text);
  }
  function codeBlock(code) {
    return '<p class="bk-label">Seu código de recuperação</p><p class="bk-code" data-bk-code aria-label="Código: ' + esc(api.pretty(code).split('').join(' ')) + '">' + esc(api.pretty(code)) + '</p>' +
      '<button type="button" class="btn soft full" data-copy>' + ui.icon('copy', 18) + 'Copiar código</button>';
  }
  function bindCopy(form, code) {
    var b = form.querySelector('[data-copy]');
    if (b) b.addEventListener('click', function () { copyText(api.pretty(code), 'Código copiado.'); });
  }

  function turnOn() {
    var code = api.newCode();
    var body = '<p>Este é o seu <strong>código de recuperação</strong>. Ele é a única chave dos seus backups: <strong>sem ele ninguém consegue recuperar os dados</strong>, nem o servidor, nem eu.</p>' +
      codeBlock(code) +
      '<p class="hint">Anote no papel, mande para você mesma ou guarde num gerenciador de senhas. Não compartilhe com ninguém.</p>' +
      ui.checkbox({ label: 'Anotei o código num lugar seguro', hint: 'Só depois de marcar dá para ligar.', name: 'ok' });
    ui.openSheet({
      title: 'Ligar o backup automático', body: body, submitLabel: 'Ligar o backup',
      onOpen: function (form) { bindCopy(form, code); },
      onSubmit: function (v) {
        if (!v.ok) return { errors: { ok: 'Marque depois de anotar o código.' } };
        if (!lsSet(LS_CODE, code)) return { errors: { ok: 'Este navegador não deixou guardar o código. Tente de novo.' } };
        lastCheckAt = 0;
        setEst({ on: true, photos: false, lastOkAt: null, lastHash: null, lastErrorAt: null, lastError: null, onSince: Date.now() });
        return { ok: true };
      },
      afterClose: function (r) {
        if (!r || !r.ok) return;
        refreshCard();
        ui.toast('Backup ligado. Fazendo o primeiro agora…', { timeout: 2500 });
        runBackup('manual').then(reportRun);
      }
    });
  }
  function reportRun(res) {
    if (res && res.ok) ui.toast('Backup feito (' + api.kb(res.bytes) + ', cifrado).');
    else if (res && res.skipped === 'sem-mudanca') ui.toast('Nada mudou desde o último backup' + (getEst().lastOkAt ? ' (' + api.when(new Date(getEst().lastOkAt).toISOString()) + ')' : '') + '.');
    else if (res && res.skipped === 'ocupado') ui.toast('Já estou fazendo um backup. Aguarde um instante.');
    else if (res && res.error) ui.toast(errText(res.error), { error: true, timeout: 5500 });
  }

  JS.actions['bkauto-on'] = turnOn;
  JS.actions['bkauto-now'] = function () {
    ui.toast('Fazendo backup…', { timeout: 1800 });
    runBackup('manual').then(reportRun);
  };
  JS.changes['bkauto-fotos'] = function (el) {
    var on = el.checked;
    setEst({ photos: on, lastHash: null }); // muda o conteúdo: o próximo backup envia de novo
    ui.toast(on ? 'As fotos do corpo vão no próximo backup (se couberem em ~12 MB).' : 'As fotos do corpo não vão mais no backup automático.');
    if (on) runBackup('manual').then(reportRun);
  };
  JS.actions['bkauto-code'] = function () {
    var code = getCode();
    if (!code) return;
    ui.confirm({ title: 'Mostrar o código?', message: 'Quem tiver este código e este app consegue restaurar os seus dados. Mostre só se estiver sozinha.', confirmLabel: 'Mostrar' }).then(function (ok) {
      if (!ok) return;
      ui.openSheet({ title: 'Seu código de recuperação', body: codeBlock(code) + '<p class="hint">Guarde num lugar seguro. Sem ele ninguém recupera o backup.</p>', onOpen: function (form) { bindCopy(form, code); } });
    });
  };
  JS.actions['bkauto-off'] = function () {
    ui.confirm({ title: 'Desligar e apagar do servidor?', message: 'Os backups guardados no servidor serão apagados e o backup automático para. Os dados deste aparelho não mudam. O código deixa de servir.', confirmLabel: 'Desligar e apagar', danger: true }).then(function (ok) {
      if (!ok) return;
      var code = getCode();
      var done = function () { lsDel(LS_CODE); lsDel(LS_EST); clearTimeout(timer); refreshCard(); JS.app.render(); ui.toast('Backup automático desligado e apagado do servidor.'); };
      if (!code) { done(); return; }
      api.derive(code).then(function (d) { return call('backup-delete', { id: d.id }); }).then(done, function (e) {
        ui.toast(errText(e) + ' Não desliguei: tente de novo.', { error: true, timeout: 5500 });
      });
    });
  };

  /* ---------- Restaurar ---------- */
  function askCode(prefill, keepDefault) {
    var body = '<p class="hint top">Digite o seu código de recuperação (16 letras e números, como <strong>K7P2-9QXM-4TZB-3HNA</strong>). Dá para digitar em minúsculas e sem traços.</p>' +
      ui.input({ label: 'Código de recuperação', name: 'code', value: prefill ? api.pretty(prefill) : '', placeholder: 'XXXX-XXXX-XXXX-XXXX',
        attrs: 'autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="24" enterkeyhint="go"' }) +
      ui.checkbox({ label: 'Continuar fazendo backup com este código neste aparelho', hint: 'Recomendado se este é o seu celular novo.', name: 'keep', checked: keepDefault !== false }) +
      '<p class="muted small" data-bk-st></p>';
    ui.openSheet({
      title: 'Restaurar backup automático', body: body, submitLabel: 'Procurar backups',
      onOpen: function (form) { if (!prefill) setTimeout(function () { form.elements.code.focus(); }, 250); },
      onSubmit: function (v, form) {
        if (!api.valid(v.code)) return { errors: { code: 'O código tem 16 letras e números, como K7P2-9QXM-4TZB-3HNA.' } };
        var st = form.querySelector('[data-bk-st]'), code = api.normalize(v.code);
        st.textContent = 'Procurando seus backups…';
        return findBackups(code).then(function (heads) {
          if (!heads.length) { st.textContent = ''; return { errors: { code: 'Não achei nenhum backup com este código. Confira as letras e os números.' } }; }
          return { code: code, keep: !!v.keep, heads: heads };
        }, function (e) { st.textContent = ''; return { errors: { code: errText(e) } }; });
      },
      afterClose: function (r) { if (r && r.heads) versionsSheet(r.code, r.heads, r.keep); }
    });
  }
  function findBackups(code) {
    return api.derive(code).then(function (d) { return call('backup-list', { id: d.id }); }).then(function (r) { return r.backups || []; });
  }
  function slotLabel(h) {
    if (h.slot === 'ultimo') return 'Último backup';
    var m = /^dia-(\d{4})-(\d{2})-(\d{2})$/.exec(h.slot);
    return m ? 'Dia ' + m[3] + '/' + m[2] : h.slot;
  }
  function versionsSheet(code, heads, keep) {
    var rows = heads.map(function (h) {
      return '<button type="button" class="bk-ver" data-slot="' + esc(h.slot) + '"><span class="bk-ver-main"><strong>' + esc(slotLabel(h)) + '</strong>' +
        '<small>' + esc(api.when(h.created_at)) + ' • ' + esc(api.kb(h.size || 0)) + (/f=1/.test(h.meta || '') ? ' • com fotos' : '') + '</small></span>' + ui.icon('right', 16) + '</button>';
    }).join('');
    ui.openSheet({
      title: 'Escolha a versão', subtitle: heads.length + (heads.length === 1 ? ' backup encontrado' : ' backups encontrados'),
      body: '<div class="bk-vers">' + rows + '</div><p class="muted small" data-bk-st aria-live="polite"></p><p class="hint">Antes de trazer, mostro o que há dentro e você confirma.</p>',
      onOpen: function (form) {
        var st = form.querySelector('[data-bk-st]'), busy = false;
        form.addEventListener('click', function (e) {
          var b = e.target.closest('[data-slot]');
          if (!b || busy) return;
          e.preventDefault(); busy = true;
          form.querySelectorAll('[data-slot]').forEach(function (x) { x.disabled = true; });
          var head = heads.filter(function (h) { return h.slot === b.dataset.slot; })[0];
          download(code, head, function (p, t) { st.textContent = t; }).then(function (obj) {
            ui.closeSheet();
            setTimeout(function () { confirmRestore(obj, { code: code, keep: keep, head: head }); }, 260);
          }, function (err) {
            busy = false; st.textContent = errText(err);
            form.querySelectorAll('[data-slot]').forEach(function (x) { x.disabled = false; });
          });
        });
      }
    });
  }
  function download(code, head, onProgress) {
    var prog = onProgress || function () {}, id;
    prog(0.05, 'Baixando…');
    return api.derive(code).then(function (d) {
      id = d.id;
      var list = [], chain = Promise.resolve();
      for (var i = 0; i < head.parts; i++) {
        (function (k) {
          chain = chain.then(function () {
            prog(k / head.parts, 'Baixando… (' + (k + 1) + ' de ' + head.parts + ')');
            return call('backup-get', { id: id, slot: head.slot, part: k }).then(function (r) { list[k] = r.data; });
          });
        })(i);
      }
      return chain.then(function () { return list.join(''); });
    }).then(function (b64) {
      prog(0.9, 'Abrindo…');
      return api.decrypt(b64, code);
    }).then(function (obj) {
      if (!obj || obj.app !== 'J.S.' || !obj.dados) throw new Error('Este backup não é do J.S.');
      return obj;
    });
  }
  function confirmRestore(obj, opts) {
    var R = root.JSRegras, cur = JS.store.state, sm = api.summarize(obj.dados, obj.fotos), has = R.hasAnyData(cur);
    ui.confirm({
      title: 'Restaurar este backup?',
      message: 'Backup de ' + (opts.head ? api.when(opts.head.created_at) : 'data desconhecida') + ' com ' + api.summaryText(sm) + '.' +
        (has ? ' O que está neste aparelho agora será substituído (guardo antes uma cópia de segurança, que dá para recuperar em Versões e lixeira).' : ''),
      confirmLabel: 'Restaurar', danger: has
    }).then(function (ok) {
      if (!ok) { ui.toast('Nada mudou.'); return; }
      try {
        JS.store.importData(obj); // a cópia de segurança local é feita por js/versoes.js
      } catch (e) { ui.toast('Não consegui restaurar: ' + e.message, { error: true, timeout: 6000 }); return; }
      JS.store.update(function (s, n) { R.ensureRecurringBills(s, root.JSCore.toDateKey(new Date()), n); });
      var photos = Array.isArray(obj.fotos) && obj.fotos.length && JS.fotos ? JS.fotos.importAll(obj.fotos) : Promise.resolve(0);
      photos.then(function (n) {
        if (opts.keep && opts.code) {
          setCode(opts.code);
          buildPayload(!!getEst().photos).then(function (p) {
            setEst({ on: true, lastHash: p.hash, lastOkAt: opts.head ? new Date(opts.head.created_at).getTime() : Date.now(), lastErrorAt: null, lastError: null });
            refreshCard();
          });
        }
        JS.app.go('inicio');
        ui.toast('Pronto! Seus dados voltaram 🌷 ' + api.summaryText(sm) + (n ? ' (fotos incluídas)' : '') + '.', { timeout: 7000 });
      });
    });
  }
  JS.actions['bkauto-restore'] = function () { askCode(getCode(), true); };
  JS.actions['bkauto-versions'] = function () {
    var code = getCode();
    if (!code) return askCode(null, true);
    ui.toast('Procurando versões…', { timeout: 1500 });
    findBackups(code).then(function (heads) {
      if (!heads.length) { ui.toast('Ainda não há backups no servidor. Toque em "Fazer backup agora".'); return; }
      versionsSheet(code, heads, true);
    }, function (e) { ui.toast(errText(e), { error: true, timeout: 5000 }); });
  };

  /* ---------- Início do app (depois da intro, sem atrasar a abertura) ---------- */
  function start() {
    if (started) return;
    started = true;
    if (!available()) return;
    JS.store.subscribe(function () {
      if (!getEst().on) return;
      lastChangeAt = Date.now();
      armTimer(api.DEBOUNCE_MS);
    });
    root.document.addEventListener('visibilitychange', function () { if (root.document.visibilityState === 'visible') check('voltar'); });
    check('abrir');
    weeklyList();
  }
  function boot() { JS.intro.whenDone(function () { setTimeout(start, 4000); }); }
  if (JS.intro && JS.intro.whenDone) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  JS.backupAuto = { available: available, state: getEst, runNow: function () { return runBackup('manual'); }, check: check };
}
});
