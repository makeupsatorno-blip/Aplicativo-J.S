/*
 * J.S. — leitura de código de barras e busca de alimento embalado.
 *
 * Fluxo: câmera (só onde o navegador tem BarcodeDetector, ex.: Chrome no Android) ou números digitados
 * → valida o dígito verificador → procura nos alimentos próprios já cadastrados com esse código →
 * se não houver, consulta o Open Food Facts (serviço público) → vira um "alimento próprio" (por 100 g)
 * e abre a tabela nutricional para registrar no Diário.
 *
 * Privacidade: a ÚNICA coisa enviada é o número do código, para o Open Food Facts, e só depois de a usuária
 * tocar em "Buscar". As respostas ficam guardadas no aparelho (localStorage) por 30 dias.
 *
 * A parte pura (validação, conversão, consulta com fetch/armazenamento injetáveis) roda no Node para testes.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSBarras = api;
  if (root.JS && root.JS.ui && root.document) api.install(root.JS, root.JSCore, root.JSNutri);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var API = 'https://world.openfoodfacts.org/api/v2/product/';
  var FIELDS = 'product_name,brands,nutriments,serving_size,serving_quantity';
  var CACHE_KEY = 'js-barras-cache', CACHE_MAX = 60, CACHE_TTL = 30 * 86400000, TIMEOUT_MS = 10000;

  /* ---------------- Código ---------------- */

  function digits(code) { return String(code == null ? '' : code).replace(/\D/g, ''); }
  // Dígito verificador GS1 (EAN-8, UPC-A de 12, EAN-13 e GTIN-14): pesos 3,1,3,1... da direita para a esquerda.
  function checkDigitOk(d) {
    var sum = 0, w = 3;
    for (var i = d.length - 2; i >= 0; i--, w = 4 - w) sum += Number(d.charAt(i)) * w;
    return (10 - sum % 10) % 10 === Number(d.charAt(d.length - 1));
  }
  // { ok, code (formato usado na consulta: UPC-A de 12 vira EAN-13 com 0 na frente), error }
  function validate(input) {
    var d = digits(input);
    if (!d) return { ok: false, error: 'Digite os números do código de barras.' };
    if ([8, 12, 13, 14].indexOf(d.length) < 0) return { ok: false, error: 'O código tem 8, 12, 13 ou 14 números. Confira o que digitou.' };
    if (!checkDigitOk(d)) return { ok: false, error: 'Esse número não parece um código de barras válido. Confira o último dígito.' };
    return { ok: true, code: d.length === 12 ? '0' + d : d };
  }

  /* ---------------- Open Food Facts → alimento ---------------- */

  function num(v) {
    if (v == null || v === '') return null;
    var n = Number(String(v).replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : null;
  }
  function r1(n) { return n == null ? null : Math.round(n * 10) / 10; }

  // Resposta da API → { status: 'found' | 'incomplete' | 'notfound', name, per100, serving, missing }.
  //  - "incomplete": faltou energia ou algum macro (a usuária completa à mão antes de salvar).
  function fromOff(json, code) {
    var p = json && json.product;
    if (!p || (json.status !== undefined && String(json.status) !== '1')) return { status: 'notfound' };
    var nu = p.nutriments || {};
    var kcal = num(nu['energy-kcal_100g']);
    if (kcal == null) { var kj = num(nu['energy_100g']); if (kj != null) kcal = kj / 4.184; }
    var sodiumG = num(nu['sodium_100g']);
    if (sodiumG == null) { var salt = num(nu['salt_100g']); if (salt != null) sodiumG = salt * 0.4; }
    var per100 = {
      kcal: r1(kcal), carb: r1(num(nu['carbohydrates_100g'])), prot: r1(num(nu['proteins_100g'])), lip: r1(num(nu['fat_100g'])),
      gsat: r1(num(nu['saturated-fat_100g'])), fibra: r1(num(nu['fiber_100g'])), sodio: sodiumG == null ? null : Math.round(sodiumG * 1000)
    };
    var productName = String(p.product_name || '').trim(), brand = String(p.brands || '').split(',')[0].trim();
    var name = (productName || ('Produto ' + (code || ''))).trim();
    if (brand && name.toLowerCase().indexOf(brand.toLowerCase()) < 0) name += ' (' + brand + ')';
    // Porção do rótulo: serving_quantity (g) ou "30 g" em serving_size.
    var sg = num(p.serving_quantity), st = String(p.serving_size || '').trim();
    if (!(sg > 0)) { var m = /(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(st); sg = m ? num(m[1]) : null; }
    var serving = sg > 0 && sg <= 3000 ? { grams: r1(sg), text: st || (r1(sg) + ' g') } : null;
    var missing = ['kcal', 'carb', 'prot', 'lip'].filter(function (k) { return per100[k] == null; });
    return { status: missing.length ? 'incomplete' : 'found', name: name.slice(0, 80), productName: productName, brand: brand, per100: per100, serving: serving, missing: missing };
  }
  // Valores para N.validateCustomFood (e para o formulário "Cadastrar alimento").
  function toCustomInput(res, code) {
    var o = { name: res.name || '', barcode: code || res.code || '' };
    Object.keys(res.per100 || {}).forEach(function (k) { if (res.per100[k] != null) o[k] = res.per100[k]; });
    return o;
  }

  /* ---------------- Cache local ---------------- */

  function defaultStorage() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } }
  function cacheRead(st) { try { return JSON.parse(st.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function cacheGet(st, code, now) {
    st = st || defaultStorage();
    if (!st) return null;
    var e = cacheRead(st)[code];
    return e && (now || Date.now()) - e.at < CACHE_TTL ? e.res : null;
  }
  function cacheSet(st, code, res, now) {
    st = st || defaultStorage();
    if (!st) return;
    try {
      var all = cacheRead(st);
      all[code] = { at: now || Date.now(), res: res };
      Object.keys(all).sort(function (a, b) { return all[b].at - all[a].at; }).slice(CACHE_MAX).forEach(function (k) { delete all[k]; });
      st.setItem(CACHE_KEY, JSON.stringify(all));
    } catch (e) { /* sem espaço: segue sem cache */ }
  }

  /* ---------------- Consulta ---------------- */

  // opts: { fetch, storage, now, timeoutMs }. Sempre resolve: { status: 'found'|'incomplete'|'notfound'|'invalid'|'error', ... }.
  function lookup(input, opts) {
    opts = opts || {};
    var v = validate(input);
    if (!v.ok) return Promise.resolve({ status: 'invalid', error: v.error });
    var cached = cacheGet(opts.storage, v.code, opts.now);
    if (cached) return Promise.resolve(Object.assign({ fromCache: true, code: v.code }, cached));
    var f = opts.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!f) return Promise.resolve({ status: 'error', error: 'sem-rede', code: v.code });
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null, timer = null;
    var request = f(API + encodeURIComponent(v.code) + '.json?fields=' + FIELDS, { headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (r.status === 404) return { status: 'notfound' };
        if (!r.ok) throw new Error('http-' + r.status);
        return r.json().then(function (j) { return fromOff(j, v.code); });
      });
    var timeout = new Promise(function (_, reject) { timer = setTimeout(function () { if (ctrl) ctrl.abort(); reject(new Error('tempo-esgotado')); }, opts.timeoutMs || TIMEOUT_MS); });
    return Promise.race([request, timeout]).then(function (res) {
      clearTimeout(timer);
      res.code = v.code;
      if (res.status === 'found' || res.status === 'incomplete') cacheSet(opts.storage, v.code, res, opts.now);
      return res;
    }, function (e) {
      clearTimeout(timer);
      return { status: 'error', error: (e && e.message) || 'erro', code: v.code };
    });
  }

  /* ---------------- Tela (só no navegador) ---------------- */

  function install(JS, C, N) {
    var ui = JS.ui, esc = ui.esc;
    if (ui.addIcons) ui.addIcons({ barcode: '<path d="M3 5v14"/><path d="M6 5v14"/><path d="M10 5v14"/><path d="M13 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/>' });
    var cam = null;

    function stopCam() {
      if (!cam) return;
      cam.stopped = true;
      try { cam.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* já parou */ }
      cam = null;
    }
    function camSupported() { return !!(window.BarcodeDetector && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

    // Abre a câmera (só depois de um toque) e procura códigos EAN/UPC no vídeo.
    function startCam(form, onCode) {
      var box = form.querySelector('.scan-cam'), video = box.querySelector('video'), msg = form.querySelector('[data-cam-msg]');
      msg.textContent = 'Abrindo a câmera…'; box.hidden = false;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (stream) {
        if (!form.isConnected) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        stopCam();
        cam = { stream: stream, stopped: false };
        var me = cam;
        video.srcObject = stream;
        var p = video.play(); if (p && p.catch) p.catch(function () { /* o usuário toca para iniciar */ });
        msg.textContent = 'Aponte para as barras do produto.';
        var detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
        (function tick() {
          if (me.stopped || !form.isConnected) { stopCam(); return; }
          if (video.readyState < 2) { setTimeout(tick, 200); return; }
          detector.detect(video).then(function (found) {
            var hit = found.map(function (x) { return x.rawValue; }).filter(function (c) { return validate(c).ok; })[0];
            if (hit && !me.stopped) { stopCam(); box.hidden = true; onCode(hit); } else setTimeout(tick, 250);
          }, function () { setTimeout(tick, 400); });
        })();
      }, function () {
        box.hidden = true;
        msg.textContent = '';
        form.querySelector('[data-status]').textContent = 'Não consegui abrir a câmera (a permissão foi negada?). Digite o número do código.';
      });
    }

    // Registra o produto como alimento próprio e abre a tabela nutricional para adicionar ao Diário.
    function addFromResult(res, meal, date) {
      var r = N.validateCustomFood(toCustomInput(res, res.code));
      if (!r.ok) { JS.customFoodForm(meal, { name: res.name, barcode: res.code, per100: res.per100, servingGrams: res.serving && res.serving.grams, notice: 'Complete o que faltou para salvar.' }); return; }
      var food = null;
      JS.store.silentUpdate(function (st, n) {
        food = N.createCustomFood(st, r.value, n);
        if (res.serving) N.addPortion(st, food.id, '1 porção (' + String(res.serving.grams).replace('.', ',') + ' g)', res.serving.grams);
      });
      JS.foodInfo(food.id, { meal: meal || undefined, date: date || undefined, grams: res.serving ? res.serving.grams : 100, fromSearch: !meal });
    }

    function open(opts) {
      opts = opts || {};
      var meal = opts.meal || null, date = opts.date || null, supported = camSupported();
      var body = (supported
        ? '<div class="scan-cam" hidden><video playsinline muted aria-label="Câmera"></video><span class="scan-frame" aria-hidden="true"></span></div><p class="hint scan-cam-msg" data-cam-msg aria-live="polite"></p>' +
          '<button type="button" class="btn soft full" data-cam-on>' + ui.icon('camera', 18) + 'Usar a câmera</button>'
        : '<p class="hint top scan-note">Neste aparelho a leitura pela câmera não está disponível. Digite os números que ficam embaixo das barras.</p>') +
        ui.input({ label: 'Número do código de barras', name: 'code', placeholder: 'Ex.: 7891000100103', attrs: 'inputmode="numeric" autocomplete="off" maxlength="20" enterkeyhint="search"', hint: 'Os 13 (ou 8) números embaixo das barras.' }) +
        '<p class="hint scan-privacy">' + ui.icon('shield', 14) + ' O número do código é enviado ao Open Food Facts, um serviço público; nada mais sai do seu aparelho.</p>' +
        '<div class="scan-status" data-status role="status" aria-live="polite"></div>' +
        '<button type="button" class="btn ghost full" data-manual>Cadastrar à mão</button>';
      ui.openSheet({
        title: 'Código de barras', subtitle: 'Achar um alimento embalado', body: body, submitLabel: 'Buscar',
        onOpen: function (form) {
          var status = form.querySelector('[data-status]');
          var on = form.querySelector('[data-cam-on]');
          if (on) on.addEventListener('click', function () { startCam(form, function (code) { form.elements.code.value = code; form.requestSubmit(); }); });
          form.querySelector('[data-manual]').addEventListener('click', function () {
            stopCam();
            JS.customFoodForm(meal, { barcode: validate(form.elements.code.value).ok ? validate(form.elements.code.value).code : '' });
          });
          form.elements.code.addEventListener('input', function () { status.textContent = ''; });
          var sheet = document.getElementById('sheet');
          sheet.addEventListener('close', stopCam, { once: true });
          if (!supported) setTimeout(function () { form.elements.code.focus(); }, 250);
        },
        onSubmit: function (v, form) {
          var chk = validate(v.code);
          if (!chk.ok) return { errors: { code: chk.error } };
          stopCam();
          var status = form.querySelector('[data-status]');
          var known = N.findByBarcode(JS.store.state, chk.code);
          if (known) return { known: known };
          status.textContent = 'Procurando no Open Food Facts…';
          return lookup(chk.code).then(function (res) {
            if (res.status === 'found' || res.status === 'incomplete') return { res: res };
            status.textContent = '';
            if (res.status === 'notfound') return { errors: { code: 'Não achei esse produto no Open Food Facts. Você pode cadastrar à mão (toque em "Cadastrar à mão").' } };
            return { errors: { code: 'Não consegui falar com o Open Food Facts agora (sem internet?). Tente de novo ou cadastre à mão.' } };
          });
        },
        afterClose: function (res) {
          if (!res) return;
          if (res.known) { ui.toast('Você já cadastrou: ' + res.known.name); JS.foodInfo(res.known.id, { meal: meal || undefined, date: date || undefined, fromSearch: !meal }); return; }
          if (res.res && res.res.status === 'found') { addFromResult(res.res, meal, date); return; }
          if (res.res) {
            JS.customFoodForm(meal, { name: res.res.name, barcode: res.res.code, per100: res.res.per100, servingGrams: res.res.serving && res.res.serving.grams,
              notice: 'O Open Food Facts não tem todos os valores deste produto. Confira o rótulo e complete o que faltou (' + res.res.missing.map(function (k) { return { kcal: 'calorias', carb: 'carboidratos', prot: 'proteínas', lip: 'gorduras' }[k]; }).join(', ') + ').' });
          }
        }
      });
    }

    JS.barras = { open: open, lookup: lookup, validate: validate };
    JS.actions['barcode-open'] = function (d) { open({ meal: d && d.meal || null, date: d && d.date || null }); };
    if (JS.search && JS.search.shortcuts) {
      JS.search.shortcuts.push(['Ler código de barras', 'codigo barras escanear leitor produto rotulo embalado mercado', 'barcode', { action: 'barcode-open' }]);
    }
    void C; void esc;
  }

  return {
    API: API, FIELDS: FIELDS, digits: digits, validate: validate, fromOff: fromOff, toCustomInput: toCustomInput,
    cacheGet: cacheGet, cacheSet: cacheSet, lookup: lookup, install: install
  };
});
