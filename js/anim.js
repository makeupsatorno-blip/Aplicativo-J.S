/*
 * J.S. — animações do app.
 * - enter: entrada de tela (desliza na direção da aba) e cascata dos cartões/itens.
 * - mark: efeito num elemento depois do próximo desenho da tela (ex.: o ✓ que acabou de ser marcado).
 * - petals / celebrate: chuva de pétalas.
 * - removeThen: o item encolhe e sai antes de ser apagado.
 * - countUp e progress: números e barras que crescem até o valor.
 * No modo "menos animação" (classe reduce-motion no <html>), tudo vira só esmaecimento
 * e as pétalas não aparecem.
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  var root = document.documentElement;
  var pending = [];
  var enterTimer = null;
  var ENTER_CLASSES = ['enter-route', 'enter-view', 'dir-l', 'dir-r', 'dir-up'];

  function reduced() { return root.classList.contains('reduce-motion'); }

  function restartClass(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // enter: "route:l" | "route:r" | "route:up" | "view" | "view:l" | "view:r"
  function afterRender(main, enter) {
    if (enter) {
      clearTimeout(enterTimer);
      ENTER_CLASSES.forEach(function (c) { main.classList.remove(c); });
      void main.offsetWidth;
      var p = enter.split(':');
      main.classList.add(p[0] === 'route' ? 'enter-route' : 'enter-view');
      if (p[1]) main.classList.add('dir-' + p[1]);
      enterTimer = setTimeout(function () { ENTER_CLASSES.forEach(function (c) { main.classList.remove(c); }); }, 1000);
      countUp(main);
    }
    progress(main);
    var list = pending;
    pending = [];
    list.forEach(function (m) {
      setTimeout(function () {
        var sel = typeof m.selector === 'function' ? m.selector() : m.selector;
        var els = sel ? Array.prototype.slice.call(document.querySelectorAll(sel)) : [];
        if (m.closest) els = els.map(function (e) { return e.closest(m.closest) || e; });
        els.forEach(function (el) {
          if (m.cls) {
            restartClass(el, m.cls);
            setTimeout(function () { el.classList.remove(m.cls); }, m.ms || 1400);
          }
        });
        if (m.run) m.run(els);
      }, m.delay || 0);
    });
  }

  // Agenda um efeito para depois do próximo desenho da tela.
  function mark(selector, cls, opts) {
    opts = opts || {};
    pending.push({ selector: selector, cls: cls, closest: opts.closest, run: opts.run, delay: opts.delay, ms: opts.ms });
  }

  /* ---------------- Pétalas ---------------- */

  var COLORS = ['#F5D5E1', '#D98EAA', '#B96788', '#C9B3DE', '#E9AFC4', '#FCEBF1'];
  function layer() {
    var l = document.getElementById('fx');
    if (!l) { l = document.createElement('div'); l.id = 'fx'; l.setAttribute('aria-hidden', 'true'); document.body.appendChild(l); }
    return l;
  }
  function petals(x, y, opts) {
    if (reduced() || !Element.prototype.animate) return;
    opts = opts || {};
    var n = opts.count || 12, spread = opts.spread || 100, fall = opts.fall || 60;
    var l = layer();
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i');
      p.className = 'fx-petal';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = COLORS[i % COLORS.length];
      l.appendChild(p);
      var a = Math.random() * Math.PI * 2, d = spread * (0.45 + Math.random() * 0.55), rot = Math.random() * 360 - 180;
      var dx = Math.cos(a) * d, dy = Math.sin(a) * d - spread * 0.25;
      p.animate([
        { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) scale(1) rotate(' + rot.toFixed(0) + 'deg)', opacity: 0.95, offset: 0.5 },
        { transform: 'translate(calc(-50% + ' + (dx * 1.25).toFixed(1) + 'px), calc(-50% + ' + (dy + fall).toFixed(1) + 'px)) scale(.75) rotate(' + (rot * 1.7).toFixed(0) + 'deg)', opacity: 0 }
      ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = (function (el) { return function () { el.remove(); }; })(p);
    }
  }
  function petalsFrom(el, opts) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    petals(r.left + r.width / 2, r.top + r.height / 2, opts);
  }
  function celebrate() {
    var w = window.innerWidth, h = window.innerHeight;
    petals(w * 0.5, h * 0.3, { count: 22, spread: Math.min(220, w * 0.5), fall: 140 });
    setTimeout(function () { petals(w * 0.25, h * 0.38, { count: 10, spread: 120, fall: 120 }); petals(w * 0.75, h * 0.38, { count: 10, spread: 120, fall: 120 }); }, 180);
  }

  /* ---------------- Sair, contar, crescer ---------------- */

  // Encolhe e desliza o(s) item(ns) para fora; depois executa fn (que apaga de verdade).
  // target: seletor CSS (todos os que casarem) ou um elemento.
  function removeThen(target, closest, fn) {
    var els = !target ? [] : typeof target === 'string' ? Array.prototype.slice.call(document.querySelectorAll(target)) : [target];
    if (closest) els = els.map(function (e) { return e.closest(closest) || e; });
    els = els.filter(function (e, i, a) { return a.indexOf(e) === i; });
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    if (!els.length || reduced() || !Element.prototype.animate) { go(); return; }
    els.forEach(function (el) {
      var cs = getComputedStyle(el), h = el.getBoundingClientRect().height;
      el.style.overflow = 'hidden';
      el.animate([
        { height: h + 'px', opacity: 1, transform: 'none', marginBottom: cs.marginBottom },
        { height: h + 'px', opacity: 0, transform: 'translateX(48px)', marginBottom: cs.marginBottom, offset: 0.55 },
        { height: '0px', opacity: 0, transform: 'translateX(48px)', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' }
      ], { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = go;
    });
    setTimeout(go, 600);
  }

  // Valores em reais contam de 0 até o total ao abrir a tela.
  function countUp(main) {
    if (reduced()) return;
    var C = window.JSCore;
    main.querySelectorAll('[data-count-cents]').forEach(function (el) {
      var to = Number(el.dataset.countCents);
      if (!to) return;
      var t0 = performance.now(), dur = 750;
      el.textContent = C.formatCents(0);
      (function step(t) {
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = C.formatCents(Math.round(to * e));
        if (p < 1 && el.isConnected) requestAnimationFrame(step);
      })(t0);
    });
  }

  // Barras com data-progress-to crescem do valor anterior até o novo.
  function progress(main) {
    main.querySelectorAll('[data-progress-to]').forEach(function (el) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.width = el.dataset.progressTo + '%'; }); });
    });
  }

  /* ---------------- Começar: contagem 3-2-1 e faíscas ---------------- */

  // Contagem antes do treino (toque pula). No modo "menos animação", vai direto.
  function countdown(done) {
    if (reduced()) { done(); return; }
    var ov = document.createElement('div');
    ov.className = 'countdown';
    ov.setAttribute('role', 'status');
    ov.innerHTML = '<div class="cd-ring"></div><div class="cd-ring r2"></div><strong class="cd-num"></strong><span class="cd-sub">Prepare-se</span>';
    document.body.appendChild(ov);
    var num = ov.querySelector('.cd-num'), steps = ['3', '2', '1', 'Vai!'], i = 0, finished = false, timer = null;
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      ov.classList.add('out');
      setTimeout(function () { ov.remove(); }, 320);
      done();
    }
    function next() {
      if (i >= steps.length) { finish(); return; }
      num.textContent = steps[i];
      restartClass(num, 'tick');
      if (window.JSToque) window.JSToque.beep(i < 3 ? 660 : 990, i < 3 ? 110 : 260);
      if (i === 3) { ov.classList.add('go'); petals(window.innerWidth / 2, window.innerHeight / 2, { count: 16, spread: 160, fall: 80 }); }
      i++;
      timer = setTimeout(next, i === steps.length ? 520 : 620);
    }
    ov.addEventListener('click', finish);
    next();
  }

  // Faíscas coloridas saindo de um elemento (começar tarefa).
  var SPARK = ['#B96788', '#2A78D6', '#C98500', '#D98EAA', '#8F6BB3'];
  function sparks(el) {
    if (!el || reduced() || !Element.prototype.animate) return;
    var r = el.getBoundingClientRect(), l = layer();
    var cx = r.left + 30, cy = r.top + r.height / 2;
    for (var i = 0; i < 14; i++) {
      var s = document.createElement('i');
      s.className = 'fx-spark';
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      s.style.background = SPARK[i % SPARK.length];
      l.appendChild(s);
      var a = (i / 14) * Math.PI * 2 + Math.random() * 0.4, d = 40 + Math.random() * 50;
      s.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + (Math.cos(a) * d).toFixed(1) + 'px), calc(-50% + ' + (Math.sin(a) * d).toFixed(1) + 'px)) scale(.2)', opacity: 0 }
      ], { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = (function (e) { return function () { e.remove(); }; })(s);
    }
  }

  JS.anim = {
    reduced: reduced, afterRender: afterRender, mark: mark, petals: petals, petalsFrom: petalsFrom,
    celebrate: celebrate, removeThen: removeThen, countUp: countUp, restartClass: restartClass,
    countdown: countdown, sparks: sparks
  };
})();
