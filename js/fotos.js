/*
 * J.S. — fotos de evolução do corpo.
 * Ficam só neste aparelho (IndexedDB do navegador), nunca vão para servidor.
 * Cada foto é reduzida (até 1600 px, JPEG) e ganha uma miniatura para a grade.
 * Entram no backup em arquivo (Configurações → Backup), em base64.
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  var DB = 'js-fotos', STORE = 'fotos', VER = 1;
  var FULL = 1600, THUMB = 360;
  var POSES = { frente: 'Frente', lado: 'Lado', costas: 'Costas', outra: 'Outra' };
  var dbp = null, cache = null, urls = {};

  function supported() { return typeof indexedDB !== 'undefined'; }
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!supported()) { reject(new Error('Este navegador não permite guardar fotos.')); return; }
      var rq = indexedDB.open(DB, VER);
      rq.onupgradeneeded = function () { if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE, { keyPath: 'id' }); };
      rq.onsuccess = function () { resolve(rq.result); };
      rq.onerror = function () { reject(rq.error || new Error('Não foi possível abrir as fotos.')); };
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode), st = t.objectStore(STORE), out;
        out = fn(st);
        t.oncomplete = function () { resolve(out && 'result' in out ? out.result : out); };
        t.onerror = function () { reject(t.error || new Error('Erro ao salvar a foto.')); };
        t.onabort = function () { reject(t.error || new Error('Sem espaço para salvar a foto.')); };
      });
    });
  }

  // Todas as fotos (sem ler os bytes: os Blobs só são carregados quando usados), mais recentes primeiro.
  function list() {
    if (cache) return Promise.resolve(cache);
    return tx('readonly', function (st) { return st.getAll(); }).then(function (all) {
      cache = (all || []).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1); });
      return cache;
    });
  }
  function count() { return list().then(function (l) { return l.length; }).catch(function () { return 0; }); }
  function get(id) { return list().then(function (l) { return l.filter(function (x) { return x.id === id; })[0] || null; }); }
  function put(rec) { cache = null; return tx('readwrite', function (st) { st.put(rec); }).then(function () { return rec; }); }
  function update(id, patch) {
    return get(id).then(function (r) { if (!r) return null; return put(Object.assign({}, r, patch, { updatedAt: new Date().toISOString() })); });
  }
  function remove(id) {
    cache = null;
    ['full', 'thumb'].forEach(function (k) { if (urls[id + k]) { URL.revokeObjectURL(urls[id + k]); delete urls[id + k]; } });
    return tx('readwrite', function (st) { st.delete(id); });
  }
  function clear() {
    cache = null;
    Object.keys(urls).forEach(function (k) { URL.revokeObjectURL(urls[k]); });
    urls = {};
    return tx('readwrite', function (st) { st.clear(); }).catch(function () {});
  }
  // Endereço temporário (blob:) para mostrar a foto ou a miniatura.
  function url(rec, kind) {
    var k = rec.id + kind;
    if (!urls[k]) urls[k] = URL.createObjectURL(rec[kind] || rec.full);
    return urls[k];
  }

  /* ---------------- Preparar a imagem ---------------- */

  function loadImage(blob) {
    return new Promise(function (resolve, reject) {
      var u = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { resolve({ img: img, done: function () { URL.revokeObjectURL(u); } }); };
      img.onerror = function () { URL.revokeObjectURL(u); reject(new Error('Não foi possível abrir esta imagem.')); };
      img.src = u;
    });
  }
  function resize(img, max, quality) {
    var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return new Promise(function (resolve, reject) {
      cv.toBlob(function (b) { if (b) resolve({ blob: b, w: cv.width, h: cv.height }); else reject(new Error('Não foi possível preparar a foto.')); }, 'image/jpeg', quality);
    });
  }
  // Arquivo escolhido → { full, thumb, w, h } pronto para salvar.
  function prepare(file) {
    if (!file || !/^image\//.test(file.type || 'image/')) return Promise.reject(new Error('Escolha uma imagem.'));
    return loadImage(file).then(function (o) {
      return Promise.all([resize(o.img, FULL, 0.85), resize(o.img, THUMB, 0.78)]).then(function (r) {
        o.done();
        return { full: r[0].blob, thumb: r[1].blob, w: r[0].w, h: r[0].h };
      }, function (e) { o.done(); throw e; });
    });
  }
  function add(prep, meta) {
    var now = new Date().toISOString();
    var rec = { id: (window.JSCore && JSCore.uuid()) || String(Date.now()), date: meta.date, pose: POSES[meta.pose] ? meta.pose : 'frente',
      note: String(meta.note || '').trim().slice(0, 200) || null, w: prep.w, h: prep.h, full: prep.full, thumb: prep.thumb, createdAt: now, updatedAt: now };
    return put(rec);
  }

  /* ---------------- Backup ---------------- */

  function toDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function fromDataURL(s) {
    var m = /^data:([^;,]+);base64,(.*)$/.exec(String(s || ''));
    if (!m) return null;
    var bin = atob(m[2]), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: m[1] });
  }
  function exportAll() {
    return list().then(function (l) {
      return Promise.all(l.map(function (r) {
        return Promise.all([toDataURL(r.full), toDataURL(r.thumb || r.full)]).then(function (d) {
          return { id: r.id, date: r.date, pose: r.pose, note: r.note, w: r.w, h: r.h, createdAt: r.createdAt, full: d[0], thumb: d[1] };
        });
      }));
    }).catch(function () { return []; });
  }
  // Substitui as fotos deste aparelho pelas do backup.
  function importAll(arr) {
    if (!Array.isArray(arr)) return Promise.resolve(0);
    return clear().then(function () {
      var recs = arr.map(function (x) {
        var full = fromDataURL(x && x.full);
        if (!full || !x.date) return null;
        return { id: String(x.id || Date.now() + Math.random()), date: String(x.date).slice(0, 10), pose: POSES[x.pose] ? x.pose : 'outra', note: x.note || null,
          w: Number(x.w) || 0, h: Number(x.h) || 0, full: full, thumb: fromDataURL(x.thumb) || full, createdAt: x.createdAt || new Date().toISOString() };
      }).filter(Boolean);
      return tx('readwrite', function (st) { recs.forEach(function (r) { st.put(r); }); }).then(function () { cache = null; return recs.length; });
    });
  }

  JS.fotos = {
    POSES: POSES, supported: supported, list: list, count: count, get: get, update: update, remove: remove, clear: clear,
    url: url, prepare: prepare, add: add, exportAll: exportAll, importAll: importAll,
    invalidate: function () { cache = null; }
  };
})();
