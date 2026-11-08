/*
 * J.S. — desenhos animados da execução dos exercícios (funcionam sem internet).
 * Cada exercício (js/dados/animacoes.js) descreve 2 ou mais posições do corpo: posição do quadril,
 * inclinação do tronco e o alvo das mãos e dos pés. Cotovelos e joelhos são calculados
 * (cinemática inversa de dois segmentos), então os membros nunca "esticam" e o movimento é natural.
 * Vista "side" (de lado, olhando para a direita) ou "front" (de frente, espelhada).
 */
(function (root) {
  'use strict';
  var L = { torso: 40, neck: 11, ua: 22, fa: 20, th: 28, sh: 27, ft: 9, sw: 10, hw: 7 };
  var COL = { body: '#A0526D', far: '#D9A1B7', metal: '#8F8088', plate: '#5F4F59', pad: '#E7D6DE', padEdge: '#D2BEC7', floor: '#E6DADF', cable: '#9A8A92' };

  function dir(a) { var r = a * Math.PI / 180; return [Math.cos(r), -Math.sin(r)]; }
  function add(p, a, len) { var d = dir(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; }
  function ang(p, q) { return Math.atan2(-(q[1] - p[1]), q[0] - p[0]) * 180 / Math.PI; }
  function dist(p, q) { return Math.sqrt((q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1])); }
  function mirror(cx, v) { return [2 * cx - v[0], v[1]]; }

  // Dois segmentos (braço/perna): alvo {t:[x,y], b:±1} por cinemática inversa, ou ângulos {a:[a1,a2]}.
  function limb(base, spec, la, lb, defBend) {
    if (!spec) spec = { a: [-90, -90] };
    if (spec.t) {
      var d = Math.min(Math.max(dist(base, spec.t), Math.abs(la - lb) + 0.01), la + lb - 0.01);
      var th = ang(base, spec.t);
      var al = Math.acos((la * la + d * d - lb * lb) / (2 * la * d)) * 180 / Math.PI;
      var j = add(base, th + (spec.b != null ? spec.b : defBend) * al, la);
      return [base, j, add(j, ang(j, spec.t), lb)];
    }
    var j2 = add(base, spec.a[0], la);
    return [base, j2, add(j2, spec.a[1], lb)];
  }
  function mirrorSpec(cx, spec) {
    if (!spec) return spec;
    if (spec.t) return { t: mirror(cx, spec.t), b: -(spec.b != null ? spec.b : 1) };
    return { a: [180 - spec.a[0], 180 - spec.a[1]] };
  }

  // Posição -> pontos do esqueleto.
  function solve(spec, pose) {
    var l = Object.assign({}, L, spec.l || {}, pose.l || {});
    var P = pose.p, t = pose.t != null ? pose.t : 90;
    var neck = add(P, t, l.torso), head = add(neck, t + (pose.hd || 0), l.neck);
    var s = { pelvis: P, neck: neck, head: head, l: l, front: spec.view === 'front', pose: pose };
    if (s.front) {
      var cx = P[0];
      var shR = [neck[0] + l.sw, neck[1] + 2], shL = mirror(cx, shR), hiR = [P[0] + l.hw, P[1]], hiL = mirror(cx, hiR);
      s.armN = limb(shR, pose.an, l.ua, l.fa, -1); s.armF = limb(shL, pose.af || mirrorSpec(cx, pose.an), l.ua, l.fa, 1);
      s.legN = limb(hiR, pose.ln, l.th, l.sh, 1); s.legF = limb(hiL, pose.lf || mirrorSpec(cx, pose.ln), l.th, l.sh, -1);
      s.shoulders = [shL, shR]; s.hips = [hiL, hiR];
      s.footN = add(s.legN[2], pose.fn != null ? pose.fn : -80, l.ft * 0.6);
      s.footF = add(s.legF[2], 180 - (pose.fn != null ? pose.fn : -80), l.ft * 0.6);
    } else {
      s.armN = limb(neck, pose.an, l.ua, l.fa, -1); s.armF = limb(neck, pose.af || pose.an, l.ua, l.fa, -1);
      s.legN = limb(P, pose.ln, l.th, l.sh, 1); s.legF = limb(P, pose.lf || pose.ln, l.th, l.sh, 1);
      s.footN = add(s.legN[2], pose.fn != null ? pose.fn : 0, l.ft);
      s.footF = add(s.legF[2], pose.ff != null ? pose.ff : (pose.fn != null ? pose.fn : 0), l.ft);
    }
    s.pts = {
      hn: s.armN[2], hf: s.armF[2], en: s.armN[1], ef: s.armF[1], kn: s.legN[1], kf: s.legF[1], an: s.legN[2], af: s.legF[2],
      neck: neck, pelvis: P, head: head, mh: [(s.armN[2][0] + s.armF[2][0]) / 2, (s.armN[2][1] + s.armF[2][1]) / 2], tn: s.footN, tf: s.footF
    };
    return s;
  }

  /* ---------------- Interpolação ---------------- */

  function lerp(a, b, k) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
    if (Array.isArray(a) && Array.isArray(b)) return a.map(function (x, i) { return lerp(x, b[i], k); });
    if (a && b && typeof a === 'object') {
      var o = {};
      Object.keys(a).forEach(function (key) { o[key] = key in b ? lerp(a[key], b[key], k) : a[key]; });
      Object.keys(b).forEach(function (key) { if (!(key in o)) o[key] = b[key]; });
      return o;
    }
    return k < 0.5 ? a : b;
  }
  function ease(k) { return 0.5 - Math.cos(Math.PI * k) / 2; }

  // phase 0..1 -> posição. "pp": vai (42%), segura, volta (42%), segura. "loop": passa por todas as posições.
  function poseAt(spec, phase) {
    var F = spec.frames;
    if (spec.mode === 'loop') {
      var n = F.length, x = phase * n, i = Math.floor(x) % n, k = x - Math.floor(x);
      return lerp(F[i], F[(i + 1) % n], spec.linear ? k : ease(k));
    }
    var A = F[0], B = F[1];
    if (phase < 0.42) return lerp(A, B, ease(phase / 0.42));
    if (phase < 0.5) return B;
    if (phase < 0.92) return lerp(B, A, ease((phase - 0.5) / 0.42));
    return A;
  }

  /* ---------------- Desenho ---------------- */

  function f(n) { return Math.round(n * 10) / 10; }
  function ln(a, b, w, c, op) { return '<line x1="' + f(a[0]) + '" y1="' + f(a[1]) + '" x2="' + f(b[0]) + '" y2="' + f(b[1]) + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"' + (op ? ' opacity="' + op + '"' : '') + '/>'; }
  function poly(pts, w, c, fill) { return '<polyline points="' + pts.map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join(' ') + '" fill="' + (fill || 'none') + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
  function circ(p, r, c, stroke) { return '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + r + '" fill="' + c + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="1.5"' : '') + '/>'; }

  function point(s, ref, d) {
    var p = typeof ref === 'string' ? s.pts[ref] : ref;
    return d ? [p[0] + d[0], p[1] + d[1]] : p;
  }

  function prop(pr, s) {
    var c = pr.c;
    switch (pr.k) {
      case 'floor': return ln([4, pr.y], [196, pr.y], 2, COL.floor);
      case 'line': return poly(pr.pts, pr.w || 3, c || COL.metal);
      case 'pad': // estofado (banco, encosto): faixa grossa entre dois pontos fixos, com pés até o chão
        return (pr.legs ? pr.legs.map(function (x) { return ln([x, Math.max(pr.a[1], pr.b[1])], [x, pr.floor || 120], 3, COL.metal); }).join('') : '') +
          ln(pr.a, pr.b, pr.w || 8, COL.padEdge) + ln(pr.a, pr.b, (pr.w || 8) - 3, COL.pad);
      case 'rect': return '<rect x="' + pr.x + '" y="' + pr.y + '" width="' + pr.w + '" height="' + pr.h + '" rx="' + (pr.r || 2) + '" fill="' + (c || COL.pad) + '" stroke="' + COL.padEdge + '" stroke-width="1"/>';
      case 'seg': { // estofado que acompanha o corpo (ex.: encosto do hack)
        var a = point(s, pr.a, pr.off), b = point(s, pr.b, pr.off);
        return ln(a, b, pr.w || 8, COL.padEdge) + ln(a, b, (pr.w || 8) - 3, COL.pad);
      }
      case 'plate': { var p = point(s, pr.at, pr.d); return circ(p, pr.r || 10, COL.plate) + circ(p, 2.4, COL.metal); }
      case 'db': {
        var q = point(s, pr.at, pr.d);
        if (pr.v) return ln([q[0], q[1] - 7], [q[0], q[1] + 7], 3, COL.metal) + ln([q[0], q[1] - 8], [q[0], q[1] - 4], 7, COL.plate) + ln([q[0], q[1] + 4], [q[0], q[1] + 8], 7, COL.plate);
        if (pr.h) return ln([q[0] - 7, q[1]], [q[0] + 7, q[1]], 3, COL.metal) + ln([q[0] - 8, q[1]], [q[0] - 4, q[1]], 7, COL.plate) + ln([q[0] + 4, q[1]], [q[0] + 8, q[1]], 7, COL.plate);
        return circ(q, pr.r || 5.5, COL.plate);
      }
      case 'cable': { var to = point(s, pr.to, pr.d); return ln(pr.from, to, 1.6, COL.cable) + circ(pr.from, 4, '#fff', COL.metal); }
      case 'handle': { var h = point(s, pr.at, pr.d), hl = (pr.len || 12) / 2; return pr.v ? ln([h[0], h[1] - hl], [h[0], h[1] + hl], 3, COL.metal) : ln([h[0] - hl, h[1]], [h[0] + hl, h[1]], 3, COL.metal); }
      case 'rope': { var r = point(s, pr.at), sp = pr.spread || 4; return ln(r, [r[0] - sp, r[1] + 8], 3, COL.plate) + ln(r, [r[0] + sp, r[1] + 8], 3, COL.plate); }
      case 'roll': { var o = point(s, pr.at, pr.d); return circ(o, pr.r || 5, COL.pad, COL.padEdge); }
      case 'sled': { // plataforma do leg press, perpendicular à perna
        var an = s.pts.an, axis = ang(s.pelvis, an), cen = add(pr.at === 'tn' ? s.pts.tn : an, axis, 4);
        return ln(add(cen, axis + 90, 12), add(cen, axis - 90, 12), 5, COL.metal);
      }
      case 'bar': { // alavanca presa num ponto fixo (ex.: remada cavalinho)
        var bt = point(s, pr.to, pr.d); return ln(pr.from, bt, pr.w || 5, COL.metal) + circ(pr.from, 3.5, COL.metal);
      }
      case 'jrope': { // corda de pular: curva de uma mão à outra, passando por cima da cabeça ou por baixo dos pés
        var h1 = s.pts.hn, h2 = s.pts.hf, cy = s.pose.rope != null ? s.pose.rope : 130;
        return '<path d="M' + f(h1[0]) + ',' + f(h1[1]) + ' Q' + f((h1[0] + h2[0]) / 2) + ',' + f(cy) + ' ' + f(h2[0]) + ',' + f(h2[1]) + '" fill="none" stroke="' + COL.plate + '" stroke-width="2"/>';
      }
      case 'crank': { var e = point(s, pr.at); return ln(pr.c, e, 3, COL.metal) + circ(pr.c, 3, COL.metal); }
      case 'wheel': return circ([pr.x, pr.y], pr.r, 'none', COL.metal).replace('fill="none"', 'fill="#F4EEF1"') + circ([pr.x, pr.y], 3, COL.metal);
      case 'arrow': { // seta indicando o sentido do movimento (fixa)
        var a1 = pr.from, a2 = pr.to, aa = ang(a2, a1);
        return ln(a1, a2, 2, '#C9A3B4') + ln(a2, add(a2, aa + 28, 6), 2, '#C9A3B4') + ln(a2, add(a2, aa - 28, 6), 2, '#C9A3B4');
      }
    }
    return '';
  }

  function figure(s, ghost) {
    var c = ghost ? '#EBD4DE' : COL.body, cf = ghost ? '#F3E4EA' : COL.far, out = '';
    var W = { torso: 10, ua: 7, fa: 6, th: 9, sh: 8, ft: 5 };
    function arm(a, col) { return ln(a[0], a[1], W.ua, col) + ln(a[1], a[2], W.fa, col) + circ(a[2], 3.6, col); }
    function leg(g, foot, col) { return ln(g[0], g[1], W.th, col) + ln(g[1], g[2], W.sh, col) + ln(g[2], foot, W.ft, col); }
    if (s.front) {
      out += leg(s.legF, s.footF, c) + leg(s.legN, s.footN, c);
      out += ln(s.hips[0], s.hips[1], 9, c) + ln(s.shoulders[0], s.shoulders[1], 9, c);
      out += ln([s.pelvis[0], s.pelvis[1]], [s.neck[0], s.neck[1] + 2], 14, c);
      out += arm(s.armF, c) + arm(s.armN, c) + circ(s.head, 8, c);
      return out;
    }
    out += arm(s.armF, cf) + leg(s.legF, s.footF, cf);
    out += ln(s.pelvis, s.neck, W.torso, c) + circ(s.head, 8, c);
    out += leg(s.legN, s.footN, c) + arm(s.armN, c);
    return out;
  }

  function render(spec, pose, ghostPose) {
    var s = solve(spec, pose), back = '', front = '';
    (spec.props || []).forEach(function (pr) { if (pr.front) front += prop(pr, s); else back += prop(pr, s); });
    var ghost = ghostPose ? figure(solve(spec, ghostPose), true) : '';
    return back + ghost + figure(s, false) + front;
  }

  // vb: quadro maior para exercícios em que o corpo sobe (ex.: escada, panturrilha).
  function svgOpen(cls, spec) { return '<svg class="' + (cls || 'exa') + '" viewBox="' + ((spec && spec.vb) || '0 0 200 125') + '" role="img" aria-hidden="true">'; }

  // Desenho parado: posição inicial com a posição final "fantasma" atrás (dá para entender o movimento).
  function still(spec, cls) {
    if (!spec) return '';
    var last = spec.mode === 'loop' ? spec.frames[Math.floor(spec.frames.length / 2)] : spec.frames[1];
    return svgOpen(cls, spec) + render(spec, spec.frames[0], last) + '</svg>';
  }

  // Animação em loop dentro de um elemento. Para sozinha quando o elemento sai da tela.
  function play(el, spec) {
    if (!el || !spec) return { stop: function () {} };
    var reduced = document.documentElement.classList.contains('reduce-motion');
    el.innerHTML = svgOpen('exa', spec);
    var svg = el.firstChild, dur = (spec.dur || 2.6) * 1000, t0 = performance.now(), raf = 0, stopped = false;
    if (reduced) { el.innerHTML = still(spec); return { stop: function () {} }; }
    function frame(now) {
      if (stopped || !svg.isConnected) return;
      var phase = ((now - t0) % dur) / dur;
      svg.innerHTML = render(spec, poseAt(spec, phase));
      raf = requestAnimationFrame(frame);
    }
    svg.innerHTML = render(spec, spec.frames[0]); // primeiro quadro já na hora
    raf = requestAnimationFrame(frame);
    return { stop: function () { stopped = true; cancelAnimationFrame(raf); } };
  }

  var api = { still: still, play: play, solve: solve, poseAt: poseAt, render: render, L: L };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSExAnim = api;
})(typeof self !== 'undefined' ? self : this);
