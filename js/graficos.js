/*
 * J.S. — gráficos em SVG, sem bibliotecas.
 * As telas geram um "lugar" para o gráfico (chart(spec)) com a tabela equivalente embaixo;
 * depois do desenho da tela, mountAll() monta o SVG na largura real (celular, tablet).
 * Regras visuais: linhas de 2px, barras de no máximo 24px com ponta arredondada, grade fina,
 * rótulos só no último valor, dica (tooltip) ao tocar/passar o mouse e tabela para ler sem cor.
 * Cores: tokens do css/style.css (--ser1 rosa, --ser2 lavanda, --ser3 âmbar), que mudam com a paleta e o tema escuro.
 * Cores antigas em hexadecimal que as telas passarem são traduzidas para os tokens (paint).
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  var SERIES = ['var(--ser1)', 'var(--ser2)', 'var(--ser3)'];
  var INK = 'var(--text)', MUTED = 'var(--muted)', GRID = 'var(--chart-grid)', AXIS = 'var(--chart-axis)', SURFACE = 'var(--surface)';
  var LEGACY = {
    '#A0526D': 'var(--ser1)', '#2A78D6': 'var(--ser2)', '#C98500': 'var(--ser3)', '#8F6BB3': 'var(--m-hair)',
    '#3B6FD0': 'var(--m-work)', '#1E8A70': 'var(--m-body)', '#6250D6': 'var(--m-chart)', '#C2622D': 'var(--m-kcal)', '#3F8C86': 'var(--m-meal)'
  };
  function paint(c) { return c == null ? c : (LEGACY[String(c).toUpperCase()] || c); }
  var NS = 'http://www.w3.org/2000/svg';

  function esc(s) { return JS.ui.esc(s); }
  function fmtNum(v, dec) {
    if (v == null || !Number.isFinite(v)) return '—';
    return Number(v.toFixed(dec == null ? 1 : dec)).toLocaleString('pt-BR', { maximumFractionDigits: dec == null ? 1 : dec });
  }
  function valueText(spec, v) {
    if (spec.prefix === 'R$') return v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return fmtNum(v, spec.dec) + (spec.unit ? ' ' + spec.unit : '');
  }

  // Marcação inicial (string): o gráfico em si é montado depois, na largura real.
  function chart(spec) {
    var h = spec.height || 180;
    var legend = '';
    if (spec.type === 'heat') {
      legend = '<div class="chart-legend heat-legend"><span>menos</span>' + HEAT.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '<span>mais</span></div>';
    }
    if (spec.type === 'stack' && spec.series) {
      legend = '<div class="chart-legend">' + spec.series.map(function (s, i) {
        return '<span><i style="background:' + paint(s.color || SERIES[i]) + '"></i>' + esc(s.name) + '</span>';
      }).join('') + '</div>';
    }
    return '<figure class="chart-fig">' + legend +
      '<div class="chart" style="height:' + (h / 16) + 'rem" data-spec="' + esc(JSON.stringify(spec)) + '" role="img" aria-label="' + esc(spec.title || 'Gráfico') + '"></div>' +
      table(spec) + '</figure>';
  }

  function table(spec) {
    var head, rows;
    if (spec.type === 'stack') {
      head = '<tr><th>' + esc(spec.xLabel || 'Dia') + '</th>' + spec.series.map(function (s) { return '<th>' + esc(s.name) + '</th>'; }).join('') + '</tr>';
      rows = spec.points.map(function (p) { return '<tr><td>' + esc(p.label) + '</td>' + p.parts.map(function (v) { return '<td>' + esc(valueText(spec, v)) + '</td>'; }).join('') + '</tr>'; });
    } else {
      head = '<tr><th>' + esc(spec.xLabel || '') + '</th><th>' + esc(spec.yLabel || 'Valor') + '</th></tr>';
      rows = spec.points.map(function (p) { return '<tr><td>' + esc(p.label) + '</td><td>' + esc(valueText(spec, p.v)) + '</td></tr>'; });
    }
    return '<details class="chart-table"><summary>Ver em tabela</summary><table>' + head + rows.join('') + '</table></details>';
  }

  /* ---------------- Escalas ---------------- */

  function niceStep(range, count) {
    var raw = range / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }
  // intOnly: contagens (treinos, tarefas) nunca têm marcação "0,5".
  function ticks(min, max, count, intOnly) {
    if (min === max) { max = min + 1; }
    var step = niceStep(max - min, count);
    if (intOnly) step = Math.max(1, Math.round(step));
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (var v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
    out.step = step;
    return out;
  }
  // Casas decimais pelo passo da escala (evita "62, 62, 62" quando o passo é 0,25).
  function tickText(v, step) {
    var a = Math.abs(v);
    if (a >= 10000) return fmtNum(v / 1000, a >= 100000 ? 0 : 1) + ' mil';
    var dec = !step || step >= 1 ? 0 : step >= 0.1 ? (Math.round(step * 10) === step * 10 ? 1 : 2) : 2;
    return fmtNum(v, dec);
  }

  // fill/stroke com var(--token) vão no style (atributo de SVG não entende var()).
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'fill' || k === 'stroke') { v = paint(v); if (String(v).indexOf('var(') === 0) { e.style[k] = v; return; } }
      e.setAttribute(k, v);
    });
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, attrs) {
    var t = el('text', Object.assign({ x: x, y: y, fill: MUTED, 'font-size': 11 }, attrs || {}), parent);
    t.textContent = s;
    return t;
  }
  // Barra com ponta arredondada (4px) e base reta.
  function barPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return '';
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }

  // Linha suave que não "inventa" picos entre os pontos (curva monótona de Fritsch-Carlson).
  function smoothPath(xs, ys) {
    var n = xs.length;
    if (n < 3) return xs.map(function (x, i) { return (i ? 'L' : 'M') + x.toFixed(1) + ',' + ys[i].toFixed(1); }).join('');
    var dx = [], m = [], t = [], i;
    for (i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; m[i] = dx[i] ? (ys[i + 1] - ys[i]) / dx[i] : 0; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { var k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    var d = 'M' + xs[0].toFixed(1) + ',' + ys[0].toFixed(1);
    for (i = 0; i < n - 1; i++) {
      var h = dx[i] / 3;
      d += 'C' + (xs[i] + h).toFixed(1) + ',' + (ys[i] + t[i] * h).toFixed(1) + ' ' + (xs[i + 1] - h).toFixed(1) + ',' + (ys[i + 1] - t[i + 1] * h).toFixed(1) +
        ' ' + xs[i + 1].toFixed(1) + ',' + ys[i + 1].toFixed(1);
    }
    return d;
  }

  // Anima só na primeira montagem (não ao girar a tela) e nunca no modo "menos animação".
  var firstMount = false;
  function animating() { return firstMount && !document.documentElement.classList.contains('reduce-motion') && !!Element.prototype.animate; }

  /* ---------------- Montagem ---------------- */

  // Escala da tela (1rem em relação a 16px): o gráfico é desenhado em "px de projeto" e ampliado junto
  // com o resto do app (tablet, computador, Configurações → Tamanho da tela).
  var K = 1;
  function uiScale() { return (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16; }

  function mount(box) {
    var spec;
    try { spec = JSON.parse(box.dataset.spec); } catch (e) { return; }
    var k = uiScale();
    var W = Math.max(220, Math.round(box.clientWidth / k)), H = (box.clientHeight / k) || spec.height || 180;
    var key = W + '|' + k;
    if (box._w === key) return;
    firstMount = box._w == null;
    box._w = key;
    K = k;
    box.innerHTML = '';
    if (spec.type !== 'heat' && (!spec.points || !spec.points.length)) { box.innerHTML = '<p class="chart-empty">Sem dados ainda.</p>'; return; }
    var svg = el('svg', { width: Math.round(W * k), height: Math.round(H * k), viewBox: '0 0 ' + W + ' ' + H, focusable: 'false' }, box);
    svg.setAttribute('tabindex', '0');
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    box.appendChild(tip);
    var draw = spec.type === 'line' ? drawLine : spec.type === 'hbars' ? drawHBars : spec.type === 'heat' ? drawHeat : drawBars;
    var api = draw(svg, spec, W, H);
    bindHover(box, svg, tip, spec, api, k);
  }

  // Calendário de constância: uma coluna por semana (dom-sáb), cada quadradinho é um dia.
  var HEAT = ['var(--heat0)', 'var(--heat1)', 'var(--heat2)', 'var(--heat3)'];
  function drawHeat(svg, spec, W, H) {
    var weeks = spec.weeks || [], left = 26, top = 16;
    var fit = Math.max(4, Math.floor((W - left - 4) / 11)); // no celular, 12 meses não cabem: mostra as semanas mais recentes
    if (weeks.length > fit) weeks = weeks.slice(-fit);
    var nW = weeks.length;
    var cell = Math.max(8, Math.min(30, Math.floor((W - left - 4) / Math.max(1, nW)) - 4)), gap = 4;
    // A altura acompanha o tamanho dos quadradinhos (poucas semanas = quadrados maiores).
    var needH = top + 7 * (cell + gap);
    svg.setAttribute('height', Math.round(needH * K)); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + needH);
    if (svg.parentNode) svg.parentNode.style.height = (needH / 16) + 'rem';
    var cells = [];
    ['', 'S', '', 'Q', '', 'S', ''].forEach(function (l, r) { if (l) text(svg, 0, top + r * (cell + gap) + cell - 2, l, { 'font-size': 10 }); });
    var lastLabel = -99;
    weeks.forEach(function (w, c) {
      var x = left + c * (cell + gap);
      if (w.label && c - lastLabel >= 3) { text(svg, x, 11, w.label, { 'font-size': 10 }); lastLabel = c; }
      w.days.forEach(function (d, r) {
        if (!d) return;
        var y = top + r * (cell + gap);
        var lvl = d.future ? -1 : Math.min(3, d.v || 0);
        var rect = el('rect', { x: x, y: y, width: cell, height: cell, rx: Math.min(6, cell / 4), fill: lvl < 0 ? 'var(--heat-future)' : HEAT[lvl] }, svg);
        if (d.today) rect.style.stroke = INK, rect.setAttribute('stroke-width', 1.5);
        if (animating() && lvl > 0) rect.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: c * 18, easing: 'ease-out', fill: 'backwards' });
        if (!d.future) cells.push({ x: x, y: y, s: cell, d: d, rect: rect });
      });
    });
    return {
      hit: function (px, py) {
        for (var i = 0; i < cells.length; i++) { var c = cells[i]; if (px >= c.x - 1.5 && px <= c.x + c.s + 1.5 && py >= c.y - 1.5 && py <= c.y + c.s + 1.5) return i; }
        return -1;
      },
      count: cells.length,
      show: function (i) {
        var c = cells[i];
        cells.forEach(function (o) { o.rect.removeAttribute('opacity'); });
        return { x: c.x + c.s / 2, y: c.y, rows: [{ value: c.d.text || (c.d.v ? c.d.v + (c.d.v === 1 ? ' treino' : ' treinos') : 'sem treino'), name: '', color: HEAT[Math.min(3, c.d.v || 0)] }], title: c.d.tip };
      },
      hide: function () {}
    };
  }

  // Minilinha de tendência para os números do topo (sem eixos; o último ponto em destaque).
  function spark(values, color) {
    if (!values || !values.length) return '';
    var v = values.filter(function (x) { return x != null && isFinite(x); });
    if (v.length < 2) return '';
    var W = 84, H = 26, min = Math.min.apply(null, v), max = Math.max.apply(null, v), rng = max - min || 1;
    var xs = values.map(function (x, i) { return 2 + i * (W - 6) / (values.length - 1); });
    var pts = [];
    values.forEach(function (x, i) { if (x != null && isFinite(x)) pts.push([xs[i], H - 4 - (x - min) / rng * (H - 8)]); });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('');
    var last = pts[pts.length - 1];
    return '<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + d + '" fill="none" style="stroke:var(--spark-line)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3" style="fill:' + paint(color || SERIES[0]) + ';stroke:var(--surface)" stroke-width="1.5"/></svg>';
  }

  function frame(spec, W, H, vals, zero) {
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (spec.goal != null) { min = Math.min(min, spec.goal); max = Math.max(max, spec.goal); }
    if (zero) min = Math.min(0, min);
    else { var pad = (max - min) * 0.15 || Math.abs(max) * 0.05 || 1; min -= pad; max += pad; }
    var t = ticks(min, max, 4, spec.dec === 0 && Math.abs(max) < 50);
    var left = 8 + Math.max.apply(null, t.map(function (v) { return tickText(v, t.step).length; })) * 6.4;
    var f = { t: t, left: left, right: 14, top: 14, bottom: 24, step: t.step };
    f.pw = W - f.left - f.right; f.ph = H - f.top - f.bottom;
    f.lo = t[0]; f.hi = t[t.length - 1];
    f.y = function (v) { return f.top + f.ph - (v - f.lo) / (f.hi - f.lo || 1) * f.ph; };
    return f;
  }
  function gridAndAxis(svg, f, labels, xs, W) {
    var g = el('g', {}, svg);
    f.t.forEach(function (v) {
      var y = Math.round(f.y(v)) + 0.5;
      el('line', { x1: f.left, x2: W - f.right, y1: y, y2: y, stroke: v === 0 ? AXIS : GRID, 'stroke-width': 1 }, g);
      text(g, f.left - 6, y + 3.5, tickText(v, f.step), { 'text-anchor': 'end' });
    });
    // Rótulos do eixo X sem encavalar: sempre o último; para trás, só com espaço suficiente.
    var n = labels.length, minGap = 50, shown = [];
    var lastX = Infinity;
    for (var i = n - 1; i >= 0; i--) {
      if (i === n - 1 || lastX - xs[i] >= minGap) { shown.push(i); lastX = xs[i]; }
    }
    shown.forEach(function (i) {
      var x = xs[i], anchor = 'middle';
      if (n > 1 && i === n - 1 && x + 22 > W - f.right + 10) anchor = 'end';
      if (n > 1 && i === shown[shown.length - 1] && x - 22 < f.left - 8) anchor = 'start';
      text(g, anchor === 'end' ? Math.min(x + 6, W - 2) : x, f.top + f.ph + 16, labels[i], { 'text-anchor': anchor });
    });
  }
  function goalLine(svg, spec, f, W) {
    if (spec.goal == null) return;
    var y = Math.round(f.y(spec.goal)) + 0.5;
    el('line', { x1: f.left, x2: W - f.right, y1: y, y2: y, stroke: MUTED, 'stroke-width': 1 }, svg);
    text(svg, W - f.right, y - 4, (spec.goalLabel || 'Meta') + ' ' + tickText(spec.goal, 1), { 'text-anchor': 'end', fill: INK, 'font-weight': 600 });
  }

  function drawLine(svg, spec, W, H) {
    var pts = spec.points, color = paint(spec.color || SERIES[0]);
    var f = frame(spec, W, H, pts.map(function (p) { return p.v; }), !!spec.zero);
    var n = pts.length;
    var xs = pts.map(function (p, i) { return n === 1 ? f.left + f.pw / 2 : f.left + i * f.pw / (n - 1); });
    gridAndAxis(svg, f, pts.map(function (p) { return p.label; }), xs, W);
    goalLine(svg, spec, f, W);
    var d = smoothPath(xs, pts.map(function (p) { return f.y(p.v); }));
    if (n > 1) {
      var area = el('path', { d: d + 'L' + xs[n - 1].toFixed(1) + ',' + (f.top + f.ph) + 'L' + xs[0].toFixed(1) + ',' + (f.top + f.ph) + 'Z', fill: color, 'fill-opacity': 0.1 }, svg);
      var line = el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'chart-line' }, svg);
      if (animating()) {
        // A linha se desenha da esquerda para a direita e a área aparece em seguida.
        var len = line.getTotalLength ? line.getTotalLength() : 0;
        if (len) {
          line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
          line.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' })
            .onfinish = function () { line.style.strokeDasharray = ''; line.style.strokeDashoffset = ''; };
        }
        area.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 400, fill: 'backwards' });
      }
    }
    // Pontos pequenos quando há poucos; o último sempre, com o valor ao lado.
    pts.forEach(function (p, i) {
      if (n > 12 && i !== n - 1) return;
      el('circle', { cx: xs[i], cy: f.y(p.v), r: i === n - 1 ? 4.5 : 3.5, fill: color, stroke: SURFACE, 'stroke-width': 2 }, svg);
    });
    var lx = xs[n - 1], ly = f.y(pts[n - 1].v);
    var label = text(svg, lx - 8, ly - 10, valueText(spec, pts[n - 1].v), { 'text-anchor': 'end', fill: INK, 'font-weight': 700, 'font-size': 12 });
    if (ly - 10 < 10) label.setAttribute('y', ly + 20);
    var cross = el('line', { y1: f.top, y2: f.top + f.ph, stroke: MUTED, 'stroke-width': 1, visibility: 'hidden' }, svg);
    var dot = el('circle', { r: 5, fill: color, stroke: SURFACE, 'stroke-width': 2, visibility: 'hidden' }, svg);
    return {
      xs: xs,
      show: function (i) {
        cross.setAttribute('x1', xs[i]); cross.setAttribute('x2', xs[i]); cross.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', xs[i]); dot.setAttribute('cy', f.y(pts[i].v)); dot.setAttribute('visibility', 'visible');
        return { x: xs[i], y: f.y(pts[i].v), rows: [{ value: valueText(spec, pts[i].v), name: spec.yLabel || '', color: color }], title: pts[i].tip || pts[i].label };
      },
      hide: function () { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); }
    };
  }

  function drawBars(svg, spec, W, H) {
    var pts = spec.points, stack = spec.type === 'stack';
    var totals = pts.map(function (p) { return stack ? p.parts.reduce(function (a, b) { return a + (b || 0); }, 0) : (p.v || 0); });
    var f = frame(spec, W, H, totals.concat([0]), true);
    var n = pts.length, band = f.pw / n, bw = Math.min(24, Math.max(4, band * 0.62));
    var xs = pts.map(function (p, i) { return f.left + band * i + band / 2; });
    gridAndAxis(svg, f, pts.map(function (p) { return p.label; }), xs, W);
    var bars = el('g', {}, svg);
    var marks = [];
    pts.forEach(function (p, i) {
      var x = xs[i] - bw / 2, g = el('g', { class: 'bar' }, bars);
      if (stack) {
        var acc = 0, parts = p.parts, topIdx = -1;
        parts.forEach(function (v, k) { if (v > 0) topIdx = k; });
        parts.forEach(function (v, k) {
          if (!(v > 0)) return;
          var y0 = f.y(acc), y1 = f.y(acc + v);
          var h = Math.max(0, y0 - y1 - (k < topIdx ? 2 : 0)); // 2px de respiro entre as partes
          var color = spec.series[k].color || SERIES[k];
          if (k === topIdx) el('path', { d: barPath(x, y1, bw, h, 4), fill: color }, g);
          else el('rect', { x: x, y: y1 + 2, width: bw, height: Math.max(0, h), fill: color }, g);
          acc += v;
        });
      } else if (p.v > 0) {
        el('path', { d: barPath(x, f.y(p.v), bw, f.y(0) - f.y(p.v), 4), fill: p.color || spec.color || SERIES[0] }, g);
      }
      if (animating()) {
        // As barras crescem a partir da base, uma depois da outra.
        g.style.transformBox = 'fill-box'; g.style.transformOrigin = '50% 100%';
        g.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 520, delay: Math.min(i * 22, 500), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      }
      marks.push(g);
    });
    goalLine(svg, spec, f, W);
    // Valor só no último (ou no destacado).
    var li = spec.labelIndex != null ? spec.labelIndex : n - 1;
    if (totals[li] > 0) text(svg, xs[li], f.y(totals[li]) - 6, valueText(spec, totals[li]), { 'text-anchor': li === n - 1 && n > 3 ? 'end' : 'middle', fill: INK, 'font-weight': 700, 'font-size': 12, dx: li === n - 1 && n > 3 ? bw / 2 : 0 });
    return {
      xs: xs,
      show: function (i) {
        marks.forEach(function (m, k) { m.setAttribute('opacity', k === i ? 1 : 0.55); });
        var rows = stack
          ? spec.series.map(function (s, k) { return { value: valueText(spec, pts[i].parts[k]), name: s.name, color: s.color || SERIES[k] }; }).reverse()
          : [{ value: valueText(spec, pts[i].v), name: spec.yLabel || '', color: spec.color || SERIES[0] }];
        return { x: xs[i], y: f.y(totals[i]), rows: rows, title: pts[i].tip || pts[i].label };
      },
      hide: function () { marks.forEach(function (m) { m.removeAttribute('opacity'); }); }
    };
  }

  // Barras deitadas (categorias): nome à esquerda, valor na ponta.
  function drawHBars(svg, spec, W, H) {
    var pts = spec.points, n = pts.length;
    var max = Math.max.apply(null, pts.map(function (p) { return p.v || 0; })) || 1;
    var labelW = Math.min(W * 0.38, 8 + Math.max.apply(null, pts.map(function (p) { return String(p.label).length; })) * 6.6);
    var valW = 8 + Math.max.apply(null, pts.map(function (p) { return valueText(spec, p.v).length; })) * 6.8;
    var row = (H - 8) / n, bh = Math.min(18, row * 0.6), pw = W - labelW - valW - 8;
    var marks = [], ys = [];
    pts.forEach(function (p, i) {
      var y = 4 + row * i + (row - bh) / 2, w = Math.max(p.v > 0 ? 2 : 0, (p.v || 0) / max * pw);
      ys.push(y + bh / 2);
      var g = el('g', { class: 'bar' }, svg);
      text(g, labelW - 8, y + bh / 2 + 4, p.label, { 'text-anchor': 'end', fill: INK, 'font-size': 12 });
      if (w > 0) {
        var r = Math.min(4, bh / 2, w);
        el('path', { d: 'M' + labelW + ',' + y + 'H' + (labelW + w - r) + 'Q' + (labelW + w) + ',' + y + ' ' + (labelW + w) + ',' + (y + r) + 'V' + (y + bh - r) + 'Q' + (labelW + w) + ',' + (y + bh) + ' ' + (labelW + w - r) + ',' + (y + bh) + 'H' + labelW + 'Z', fill: spec.color || SERIES[0] }, g);
      }
      text(g, labelW + w + 6, y + bh / 2 + 4, valueText(spec, p.v), { fill: INK, 'font-size': 12, 'font-weight': 600 });
      marks.push(g);
    });
    el('line', { x1: labelW + 0.5, x2: labelW + 0.5, y1: 2, y2: H - 2, stroke: AXIS }, svg);
    return {
      xs: null, ys: ys,
      show: function (i) {
        marks.forEach(function (m, k) { m.setAttribute('opacity', k === i ? 1 : 0.55); });
        return { x: labelW + (pts[i].v || 0) / max * pw, y: ys[i] - 10, rows: [{ value: valueText(spec, pts[i].v), name: '', color: spec.color || SERIES[0] }], title: pts[i].tip || pts[i].label };
      },
      hide: function () { marks.forEach(function (m) { m.removeAttribute('opacity'); }); }
    };
  }

  /* ---------------- Dica ao tocar / passar o mouse / teclado ---------------- */

  // k: escala da tela. O toque chega em px da tela; o desenho está em px de projeto (divide por k).
  function bindHover(box, svg, tip, spec, api, k) {
    k = k || 1;
    var cur = -1, n = api.count != null ? api.count : spec.points.length;
    function nearest(evt) {
      var r = svg.getBoundingClientRect();
      if (api.hit) return api.hit((evt.clientX - r.left) / k, (evt.clientY - r.top) / k);
      if (api.xs) {
        var x = (evt.clientX - r.left) / k, best = 0;
        api.xs.forEach(function (v, i) { if (Math.abs(v - x) < Math.abs(api.xs[best] - x)) best = i; });
        return best;
      }
      var y = (evt.clientY - r.top) / k, b = 0;
      api.ys.forEach(function (v, i) { if (Math.abs(v - y) < Math.abs(api.ys[b] - y)) b = i; });
      return b;
    }
    function show(i) {
      cur = i;
      var info = api.show(i);
      tip.innerHTML = '';
      var t = document.createElement('div'); t.className = 'tip-title'; t.textContent = info.title; tip.appendChild(t);
      info.rows.forEach(function (r) {
        var row = document.createElement('div'); row.className = 'tip-row';
        var k = document.createElement('i'); k.style.background = paint(r.color); row.appendChild(k);
        var v = document.createElement('strong'); v.textContent = r.value; row.appendChild(v);
        if (r.name) { var s = document.createElement('span'); s.textContent = r.name; row.appendChild(s); }
        tip.appendChild(row);
      });
      tip.hidden = false;
      var bw = box.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
      var ix = info.x * k, iy = info.y * k;
      var left = Math.min(Math.max(4, ix - tw / 2), bw - tw - 4);
      var top = iy - th - 12 * k;
      if (top < -6 * k) top = iy + 14 * k;
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    }
    function hide() { cur = -1; tip.hidden = true; api.hide(); }
    box._hide = hide;
    function at(e) { var i = nearest(e); if (i < 0) hide(); else show(i); }
    svg.addEventListener('pointermove', at);
    svg.addEventListener('pointerdown', at);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
    svg.addEventListener('blur', hide);
    svg.addEventListener('focus', function () { if (n) show(n - 1); });
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); show(Math.max(0, (cur < 0 ? n : cur) - 1)); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); show(Math.min(n - 1, cur + 1)); }
      else if (e.key === 'Escape') hide();
    });
  }

  function mountAll(root) {
    (root || document).querySelectorAll('.chart[data-spec]').forEach(mount);
  }
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { mountAll(document); }, 150);
  });
  // Toque fora de um gráfico esconde as dicas abertas.
  document.addEventListener('pointerdown', function (e) {
    var inside = e.target.closest && e.target.closest('.chart');
    document.querySelectorAll('.chart').forEach(function (b) { if (b !== inside && b._hide) b._hide(); });
  }, true);

  JS.graf = { chart: chart, mountAll: mountAll, spark: spark, paint: paint, SERIES: SERIES, HEAT: HEAT, fmtNum: fmtNum };
})();
