/*
 * J.S. — "toque atrás": reconhece duas batidas na parte de trás do celular pelo sensor de movimento
 * (acelerômetro), enquanto o J.S. está aberto. Funciona no Android (Chrome) e no iPhone (Safari),
 * que pede permissão para usar o sensor.
 *
 * Como reconhece: cada batida dá um "tranco" curto, principalmente no eixo que atravessa a tela (z).
 * Uma batida vale quando o tranco passa do limite E o celular estava parado logo antes
 * (a mediana do movimento recente é baixa); duas batidas entre 110 e 650 ms viram um "toque duplo".
 * Toques na tela também dão tranco, por isso são ignorados por 400 ms depois de encostar na tela.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSToque = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_THRESHOLD = 2.2;                       // m/s², antes de calibrar
  var SENSITIVITY = { 1: 1.6, 2: 1.28, 3: 1, 4: 0.8, 5: 0.62 }; // 1 = menos sensível, 5 = mais

  function median(list) {
    if (!list.length) return 0;
    var a = list.slice().sort(function (x, y) { return x - y; });
    var m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function quantile(list, q) {
    if (!list.length) return 0;
    var a = list.slice().sort(function (x, y) { return x - y; });
    return a[Math.min(a.length - 1, Math.floor(q * a.length))];
  }

  // Detector puro (testável): recebe amostras { t (ms), x, y, z, linear } e devolve
  // { score, base, event: null | 'tap' | 'double' }.
  function createDetector(opts) {
    opts = opts || {};
    var threshold = opts.threshold || DEFAULT_THRESHOLD;
    var MIN_GAP = 80, MIN_SECOND = 110, MAX_GAP = 650, LOCKOUT = 900, TOUCH_GUARD = 400, WARMUP = 400, QUIET = 0.4;
    var lp = null, hist = [], lastPeak = -1e9, firstTap = 0, lockUntil = 0, lastTouch = -1e9, startT = null;

    function feed(s) {
      var t = s.t;
      if (startT == null) startT = t;
      var hx, hy, hz;
      if (s.linear) { hx = s.x; hy = s.y; hz = s.z; }
      else {
        // Sem aceleração "limpa": tira a gravidade com um filtro passa-alta simples.
        if (!lp) lp = { x: s.x, y: s.y, z: s.z };
        lp.x += (s.x - lp.x) * 0.2; lp.y += (s.y - lp.y) * 0.2; lp.z += (s.z - lp.z) * 0.2;
        hx = s.x - lp.x; hy = s.y - lp.y; hz = s.z - lp.z;
      }
      var score = Math.abs(hz) + 0.35 * (Math.abs(hx) + Math.abs(hy));
      while (hist.length && hist[0].t < t - 700) hist.shift();
      var recent = [];
      for (var i = 0; i < hist.length; i++) if (hist[i].t <= t - 100) recent.push(hist[i].v);
      var base = median(recent);
      hist.push({ t: t, v: score });

      var ev = null;
      if (firstTap && t - firstTap > MAX_GAP) firstTap = 0;
      var ready = t - startT >= WARMUP && t >= lockUntil && t - lastTouch > TOUCH_GUARD;
      if (score >= threshold) {
        if (ready && base < threshold * QUIET && t - lastPeak >= MIN_GAP) {
          if (firstTap && t - firstTap >= MIN_SECOND) { firstTap = 0; lockUntil = t + LOCKOUT; ev = 'double'; }
          else if (!firstTap) { firstTap = t; ev = 'tap'; }
        }
        lastPeak = t; // o "tremido" da mesma batida não conta como segunda batida
      }
      return { score: score, base: base, event: ev };
    }
    return {
      feed: feed,
      touch: function (t) { lastTouch = t; firstTap = 0; },
      setThreshold: function (v) { if (v > 0) threshold = v; },
      get threshold() { return threshold; }
    };
  }

  // Calibração: com os picos das batidas da usuária e o "ruído" com o celular parado,
  // escolhe um limite entre os dois (metade do pico típico, bem acima do ruído).
  function calibrationThreshold(peaks, restScores) {
    if (!peaks.length) return null;
    var noise = quantile(restScores || [], 0.95);
    var t = Math.max(median(peaks) * 0.5, noise * 3, 0.5);
    return Math.round(t * 100) / 100;
  }
  // Picos separados (uma batida = maior valor dentro de 120 ms).
  function findPeaks(samples, minScore) {
    var peaks = [], cur = null;
    samples.forEach(function (s) {
      if (s.score < minScore) { if (cur && s.t - cur.t > 120) { peaks.push(cur.score); cur = null; } return; }
      if (!cur || s.t - cur.t > 120) { if (cur) peaks.push(cur.score); cur = { t: s.t, score: s.score }; }
      else if (s.score > cur.score) cur.score = s.score;
    });
    if (cur) peaks.push(cur.score);
    return peaks;
  }

  function thresholdFor(backTap) {
    backTap = backTap || {};
    var base = backTap.threshold || DEFAULT_THRESHOLD;
    return Math.round(base * (SENSITIVITY[backTap.sensitivity] || 1) * 100) / 100;
  }

  /* ---------------- No navegador ---------------- */

  var hasWindow = typeof window !== 'undefined';
  function supported() { return hasWindow && 'DeviceMotionEvent' in window; }
  function needsPermission() { return supported() && typeof window.DeviceMotionEvent.requestPermission === 'function'; }
  // No iPhone precisa ser chamado dentro de um toque da usuária.
  function requestPermission() {
    if (!needsPermission()) return Promise.resolve(supported() ? 'granted' : 'unsupported');
    try { return window.DeviceMotionEvent.requestPermission().catch(function () { return 'denied'; }); }
    catch (e) { return Promise.resolve('denied'); }
  }

  // opts: threshold, onDouble(), onTap(), onSample(resultado), onNoSensor()
  function listen(opts) {
    var det = createDetector({ threshold: opts.threshold });
    var got = false;
    function now() { return (hasWindow && window.performance) ? performance.now() : Date.now(); }
    function onMotion(e) {
      var a = e.acceleration, linear = !!(a && a.x != null && a.z != null);
      if (!linear) a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      got = true;
      var r = det.feed({ t: now(), x: a.x || 0, y: a.y || 0, z: a.z || 0, linear: linear });
      if (opts.onSample) opts.onSample(r);
      if (r.event === 'double' && opts.onDouble) opts.onDouble();
      else if (r.event === 'tap' && opts.onTap) opts.onTap();
    }
    function onTouch() { det.touch(now()); }
    window.addEventListener('devicemotion', onMotion);
    document.addEventListener('pointerdown', onTouch, true);
    document.addEventListener('touchstart', onTouch, { capture: true, passive: true });
    var timer = setTimeout(function () { if (!got && opts.onNoSensor) opts.onNoSensor(); }, 2500);
    return {
      detector: det,
      setThreshold: det.setThreshold,
      receiving: function () { return got; },
      stop: function () {
        clearTimeout(timer);
        window.removeEventListener('devicemotion', onMotion);
        document.removeEventListener('pointerdown', onTouch, true);
        document.removeEventListener('touchstart', onTouch, { capture: true, passive: true });
      }
    };
  }

  /* ---------------- Retorno: vibração e bipe ---------------- */

  var audio = null;
  // Precisa de um toque da usuária para liberar o som (chamado ao iniciar o treino).
  function unlockAudio() {
    try {
      var AC = hasWindow && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return;
      if (!audio) audio = new AC();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
  }
  function beep(freq, ms, when) {
    if (!audio) return;
    try {
      var t = audio.currentTime + (when || 0);
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = freq || 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (ms || 120) / 1000);
      o.connect(g); g.connect(audio.destination);
      o.start(t); o.stop(t + (ms || 120) / 1000 + 0.02);
    } catch (e) { /* sem som */ }
  }
  function vibrate(pattern) { try { if (hasWindow && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* sem vibração */ } }
  // Série registrada: dois bipes curtos subindo + vibração dupla.
  function confirmSet() { vibrate([35, 60, 35]); beep(880, 90); beep(1320, 120, 0.11); }
  // Fim do descanso: três bipes.
  function restOver() { vibrate([200, 100, 200]); beep(988, 160); beep(988, 160, 0.25); beep(1480, 260, 0.5); }

  return {
    DEFAULT_THRESHOLD: DEFAULT_THRESHOLD, SENSITIVITY: SENSITIVITY,
    createDetector: createDetector, calibrationThreshold: calibrationThreshold, findPeaks: findPeaks,
    thresholdFor: thresholdFor, median: median,
    supported: supported, needsPermission: needsPermission, requestPermission: requestPermission, listen: listen,
    unlockAudio: unlockAudio, beep: beep, vibrate: vibrate, confirmSet: confirmSet, restOver: restOver
  };
});
