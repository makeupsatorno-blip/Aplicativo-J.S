/*
 * J.S. — passar os dados para outro aparelho, sem arquivo.
 * Quem envia gera um código (12 letras/números). Do código saem, no próprio aparelho, a chave
 * (AES-GCM 256) e o id usado no servidor; o código nunca sai do aparelho. Tudo é comprimido,
 * cifrado e enviado em pedaços para o servidor de avisos (js-push), que guarda só o conteúdo
 * cifrado por até 30 minutos e apaga quando o outro aparelho recebe.
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  // Endereço lido na hora (js/config.js carrega depois deste arquivo).
  function api() { return ((window.JS_CONFIG || {}).pushApi || '').replace(/\/+$/, ''); }
  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // sem I, L, O, U (não confunde)
  var CODE_LEN = 12, PART = 1000000, ITER = 150000;

  function available() { return !!(api() && window.crypto && crypto.subtle && window.fetch); }

  function newCode() {
    var b = new Uint8Array(CODE_LEN), s = '';
    crypto.getRandomValues(b);
    for (var i = 0; i < CODE_LEN; i++) s += ALPHA[b[i] & 31];
    return s;
  }
  // Aceita minúsculas, espaços, traços e as letras parecidas (O→0, I/L→1, U→V).
  function normalize(code) {
    return String(code || '').toUpperCase().replace(/[\s\-.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  }
  function valid(code) { var c = normalize(code); return c.length === CODE_LEN && c.split('').every(function (ch) { return ALPHA.indexOf(ch) >= 0; }); }
  function pretty(code) { var c = normalize(code); return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8); }

  function hex(bytes) { return Array.prototype.map.call(bytes, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  // Código → { key (AES-GCM), id (64 hex) } com PBKDF2 (o mesmo nos dois aparelhos).
  function derive(code) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(normalize(code)), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('js-transferencia-v1'), iterations: ITER }, base, 512);
    }).then(function (bits) {
      var all = new Uint8Array(bits);
      return crypto.subtle.importKey('raw', all.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']).then(function (key) {
        return { key: key, id: hex(all.slice(32, 64)) };
      });
    });
  }

  function streamBytes(bytes, Stream, mode) {
    var s = new Blob([bytes]).stream().pipeThrough(new Stream(mode));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function compress(bytes) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(concat([new Uint8Array([0]), bytes]));
    return streamBytes(bytes, CompressionStream, 'gzip').then(function (z) { return concat([new Uint8Array([1]), z]); });
  }
  function decompress(bytes) {
    if (bytes[0] === 0) return Promise.resolve(bytes.slice(1));
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Atualize o navegador deste aparelho para receber.'));
    return streamBytes(bytes.slice(1), DecompressionStream, 'gzip');
  }
  function concat(list) {
    var n = list.reduce(function (a, x) { return a + x.length; }, 0), out = new Uint8Array(n), o = 0;
    list.forEach(function (x) { out.set(x, o); o += x.length; });
    return out;
  }
  function toB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function call(route, body) {
    return fetch(api() + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.error || 'erro'); e.code = j.error; e.status = r.status; throw e; }
          return j;
        });
      }, function () { var e = new Error('Sem internet. Conecte o aparelho e tente de novo.'); e.code = 'offline'; throw e; });
  }

  // Tudo que o backup leva (sem o que é só deste aparelho) + as fotos, se pedir.
  function pack(withPhotos) {
    var data = JS.store.exportData();
    data.tipo = 'transferencia';
    if (!withPhotos || !JS.fotos || !JS.fotos.supported()) return Promise.resolve(data);
    return JS.fotos.exportAll().then(function (f) { if (f.length) data.fotos = f; return data; });
  }

  // Envia e devolve o código. onProgress(0..1, texto).
  function send(opts) {
    opts = opts || {};
    var prog = opts.onProgress || function () {};
    var code = newCode(), d;
    prog(0.05, 'Preparando seus dados…');
    return Promise.all([pack(opts.photos), derive(code)]).then(function (r) {
      d = r[1];
      prog(0.2, 'Protegendo com o código…');
      return compress(new TextEncoder().encode(JSON.stringify(r[0])));
    }).then(function (z) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, d.key, z).then(function (c) { return toB64(concat([iv, new Uint8Array(c)])); });
    }).then(function (b64) {
      var parts = [];
      for (var i = 0; i < b64.length; i += PART) parts.push(b64.slice(i, i + PART));
      if (parts.length > 60) throw new Error('Os dados ficaram grandes demais (muitas fotos). Tente sem as fotos.');
      var chain = Promise.resolve();
      parts.forEach(function (p, i) {
        chain = chain.then(function () {
          prog(0.25 + 0.7 * i / parts.length, parts.length > 1 ? 'Enviando… (' + (i + 1) + ' de ' + parts.length + ')' : 'Enviando…');
          return call('transfer-put', { id: d.id, part: i, parts: parts.length, data: p });
        });
      });
      return chain.then(function () { prog(1, 'Pronto'); return { code: code, bytes: b64.length, parts: parts.length }; });
    }).catch(function (e) {
      if (e.code === 'ocupado') throw new Error('O servidor está ocupado agora. Tente de novo em alguns minutos.');
      throw e;
    });
  }

  // Baixa e abre (sem aplicar). Devolve { obj, id }.
  function receive(code, onProgress) {
    var prog = onProgress || function () {};
    if (!valid(code)) return Promise.reject(new Error('O código tem 12 letras e números (ex.: K7P2-9QXM-4TZB).'));
    var d;
    prog(0.05, 'Procurando seus dados…');
    return derive(code).then(function (x) {
      d = x;
      return call('transfer-get', { id: d.id, part: 0 });
    }).then(function (first) {
      var list = [first.data], chain = Promise.resolve();
      for (var i = 1; i < first.parts; i++) {
        (function (k) {
          chain = chain.then(function () {
            prog(0.1 + 0.7 * k / first.parts, 'Baixando… (' + (k + 1) + ' de ' + first.parts + ')');
            return call('transfer-get', { id: d.id, part: k }).then(function (r) { list[k] = r.data; });
          });
        })(i);
      }
      return chain.then(function () { return list.join(''); });
    }).then(function (b64) {
      prog(0.85, 'Abrindo…');
      var all = fromB64(b64);
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, d.key, all.slice(12)).catch(function () {
        throw new Error('Não foi possível abrir: confira o código.');
      });
    }).then(function (plain) { return decompress(new Uint8Array(plain)); }).then(function (bytes) {
      var obj = JSON.parse(new TextDecoder().decode(bytes));
      if (!obj || obj.app !== 'J.S.' || !obj.dados) throw new Error('O código não trouxe dados do J.S.');
      prog(1, 'Pronto');
      return { obj: obj, id: d.id };
    }).catch(function (e) {
      if (e.code === 'nao-encontrado') throw new Error('Código não encontrado. Ele vale por 30 minutos e só uma vez: gere outro no aparelho antigo.');
      if (e.code === 'incompleto') throw new Error('O outro aparelho ainda está enviando. Espere terminar e tente de novo.');
      throw e;
    });
  }

  // Aplica neste aparelho (substitui os dados) e apaga do servidor.
  function apply(res) {
    JS.store.importData(res.obj);
    var done = call('transfer-done', { id: res.id }).catch(function () { /* vence sozinho em 30 min */ });
    var photos = Array.isArray(res.obj.fotos) && res.obj.fotos.length && JS.fotos ? JS.fotos.importAll(res.obj.fotos) : Promise.resolve(0);
    return Promise.all([photos, done]).then(function (r) { return { photos: r[0] }; });
  }

  JS.transfer = { available: available, normalize: normalize, valid: valid, pretty: pretty, newCode: newCode, derive: derive, send: send, receive: receive, apply: apply };
})();
