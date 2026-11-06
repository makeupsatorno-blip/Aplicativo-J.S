/*
 * J.S. — intro animada e interativa ao abrir o app.
 * Baseada na intro do "Meu Financeiro IA": anéis girando, logo "respirando",
 * frases de carregamento com barra de progresso e repetição ao reabrir o app.
 * Interações: tocar solta pétalas (e estende um pouco a intro), a logo se inclina
 * seguindo o dedo/mouse, e "Pular" (ou Esc/Enter) entra direto.
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  var HOLD_MS = 5500;          // duração normal do carregamento
  var FADE_MS = 650;           // saída suave
  var TAP_EXTRA_MS = 1200;     // cada toque garante mais um pouquinho de intro
  var MAX_MS = 10000;          // nunca passa disso
  var RESUME_MS = 5 * 60000;   // voltar ao app depois de 5 min em segundo plano mostra de novo

  var root = document.documentElement;
  var el = document.getElementById('intro');
  if (!el) { JS.intro = { play: function () {}, skip: function () {}, whenDone: function (f) { f(); }, isRunning: function () { return false; } }; return; }
  var template = el.innerHTML;
  // Classe definida no <head>: sistema pediu menos movimento e a usuária não forçou as animações.
  function isReduced() { return root.classList.contains('reduce-motion'); }
  var reduced = isReduced();
  var st = { running: false, start: 0, hold: HOLD_MS, raf: 0, msgs: [], idx: 0, hiddenAt: null, hintGone: false };
  var waiting = [];

  function q(sel) { return el.querySelector(sel); }

  function saved() {
    try {
      var d = JSON.parse(localStorage.getItem('js-app-dados') || '{}');
      var has = ['tasks', 'hairEvents', 'meals', 'bills'].some(function (k) { return Array.isArray(d[k]) && d[k].length; });
      return { settings: d.settings || {}, hasData: has };
    } catch (e) { return { settings: {}, hasData: false }; }
  }

  function messages() {
    var info = saved();
    var name = typeof info.settings.name === 'string' ? info.settings.name.trim() : 'Julia';
    var end = name ? ', ' + name : '';
    return info.hasData
      ? ['Organizando sua rotina…', 'Preparando seu autocuidado…', 'Conferindo suas refeições…', 'Revisando suas contas…', 'Arrumando tudo com carinho…', 'Tudo pronto' + end + ' 🌷']
      : ['Preparando seu espaço…', 'Arrumando a rotina…', 'Separando o autocuidado…', 'Organizando as contas…', 'Deixando tudo com a sua cara…', 'Boas-vindas' + end + ' 🌷'];
  }

  function begin() {
    reduced = isReduced();
    st.running = true;
    st.start = performance.now();
    st.hold = HOLD_MS;
    st.msgs = messages();
    st.idx = 0;
    st.hintGone = false;
    var m = q('.intro-msg');
    if (m) m.textContent = st.msgs[0];
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(tick);
  }

  function tick() {
    var p = Math.min(1, (performance.now() - st.start) / st.hold);
    var bar = q('.intro-bar span');
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    var idx = Math.min(st.msgs.length - 1, Math.floor(p * st.msgs.length));
    if (idx > st.idx) {
      st.idx = idx;
      var m = q('.intro-msg');
      if (m) { m.textContent = st.msgs[idx]; m.classList.remove('swap'); void m.offsetWidth; m.classList.add('swap'); }
    }
    if (p >= 1) { leave(); return; }
    st.raf = requestAnimationFrame(tick);
  }

  // Mostra de novo (ao reabrir o app ou pelo botão em Configurações).
  function play(force) {
    if (!force && saved().settings.intro === false) return;
    el.innerHTML = template;          // reinicia as animações
    el.classList.remove('leaving');
    root.classList.add('intro-on');
    begin();
  }

  function leave() {
    if (!st.running) return;
    st.running = false;
    cancelAnimationFrame(st.raf);
    el.classList.add('leaving');
    setTimeout(function () {
      if (st.running) return;
      root.classList.remove('intro-on');
      el.classList.remove('leaving');
      var list = waiting; waiting = [];
      list.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    }, FADE_MS);
  }

  function whenDone(f) {
    if (!st.running && !root.classList.contains('intro-on')) f();
    else waiting.push(f);
  }

  /* ---------------- Interações ---------------- */

  var COLORS = ['#F5D5E1', '#D98EAA', '#B96788', '#C9B3DE', '#FCEBF1', '#E9AFC4'];
  function burst(x, y) {
    if (!Element.prototype.animate) return;
    for (var i = 0; i < 11; i++) {
      var p = document.createElement('i');
      p.className = 'intro-burst';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = COLORS[i % COLORS.length];
      el.appendChild(p);
      var a = Math.random() * Math.PI * 2, dist = 45 + Math.random() * 95, rot = Math.random() * 360 - 180;
      var dx = Math.cos(a) * dist, dy = Math.sin(a) * dist - 25;
      p.animate([
        { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) scale(1) rotate(' + rot.toFixed(0) + 'deg)', opacity: 0.95, offset: 0.55 },
        { transform: 'translate(calc(-50% + ' + (dx * 1.2).toFixed(1) + 'px), calc(-50% + ' + (dy + 55).toFixed(1) + 'px)) scale(.7) rotate(' + (rot * 1.6).toFixed(0) + 'deg)', opacity: 0 }
      ], { duration: 1100 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = (function (n) { return function () { n.remove(); }; })(p);
    }
    var pop = q('.intro-pop');
    if (pop) pop.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
  }

  function extend() {
    var elapsed = performance.now() - st.start;
    st.hold = Math.min(MAX_MS, Math.max(st.hold, elapsed + TAP_EXTRA_MS));
  }

  function tilt(x, y) {
    if (reduced || !st.running) return;
    var stage = q('.intro-stage');
    if (!stage) return;
    var r = stage.getBoundingClientRect();
    var dx = (x - (r.left + r.width / 2)) / (window.innerWidth / 2);
    var dy = (y - (r.top + r.height / 2)) / (window.innerHeight / 2);
    stage.style.transform = 'perspective(800px) rotateX(' + (-dy * 14).toFixed(2) + 'deg) rotateY(' + (dx * 14).toFixed(2) + 'deg)';
  }
  function untilt() { var s = q('.intro-stage'); if (s) s.style.transform = ''; }

  el.addEventListener('click', function (e) {
    if (e.target.closest('.intro-skip')) leave();
  });
  el.addEventListener('pointerdown', function (e) {
    if (!st.running || e.target.closest('.intro-skip')) return;
    burst(e.clientX, e.clientY);
    tilt(e.clientX, e.clientY);
    extend();
    if (!st.hintGone) { st.hintGone = true; var h = q('.intro-hint'); if (h) h.classList.add('gone'); }
  });
  el.addEventListener('pointermove', function (e) { tilt(e.clientX, e.clientY); });
  el.addEventListener('pointerleave', untilt);
  el.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') untilt(); });
  document.addEventListener('keydown', function (e) {
    if (st.running && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); leave(); }
  });

  // Apps instalados costumam "voltar" em vez de recarregar: mostra de novo depois de um tempo fora.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { st.hiddenAt = Date.now(); return; }
    var since = st.hiddenAt;
    st.hiddenAt = null;
    if (since && Date.now() - since > RESUME_MS && !st.running) play();
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted && !st.running) play(); });

  JS.intro = { play: play, skip: leave, whenDone: whenDone, isRunning: function () { return st.running; } };

  // A intro já está na tela desde a primeira pintura (classe colocada no <head>); só começa a contar.
  if (root.classList.contains('intro-on')) begin();
})();
