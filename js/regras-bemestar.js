/*
 * J.S. — regras de Bem-estar: registro de sono e rotina de skincare.
 * Módulo puro (sem tela e sem armazenamento): recebe o "state" e roda no navegador (window.JSBemestar) e no Node (testes).
 *
 * Dados (dentro de state.extras, que vai junto no backup e na passagem para outro aparelho):
 *   extras.sono     = { goalHours, logs: [{ id, date, hours, quality, bed, wake, createdAt }] }
 *                     date = dia em que acordou; um registro por dia (salvar de novo no mesmo dia substitui).
 *   extras.skincare = { steps: { manha: [{ id, name }], noite: [...] },
 *                       reminders: { manha: 'HH:MM'|null, noite: 'HH:MM'|null },
 *                       logs: { 'AAAA-MM-DD': { manha: [idPassoFeito], noite: [...] } } }
 *
 * As funções de leitura nunca alteram o estado. Valores do sono são "referência geral", não orientação médica.
 */
(function (root, factory) {
  var C = root && root.JSCore ? root.JSCore : (typeof require === 'function' ? require('./core.js') : null);
  var api = factory(C, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSBemestar = api;
})(typeof self !== 'undefined' ? self : this, function (C, root) {
  'use strict';

  var DEFAULT_GOAL = 8, MIN_GOAL = 4, MAX_GOAL = 12;
  var MIN_PAIRS = 5;               // dias com sono E energia de cada lado para comparar
  var PERIODS = ['manha', 'noite'];
  var PERIOD_NAME = { manha: 'Manhã', noite: 'Noite' };
  var MAX_STEPS = 12, NAME_MAX = 30;
  var QUALITY = [[1, '😫', 'Péssima'], [2, '😕', 'Ruim'], [3, '😐', 'Regular'], [4, '🙂', 'Boa'], [5, '😌', 'Ótima']];

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function round2(n) { return Math.round(n * 100) / 100; }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function uid() { return C.uuid().slice(0, 8); }
  function parseNum(v) {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    var s = String(v).trim().replace(',', '.');
    return s === '' ? NaN : Number(s);
  }
  function minutes(t) { var p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function avg(list) { return list.reduce(function (a, b) { return a + b; }, 0) / list.length; }

  /* ======================= Sono ======================= */

  function sonoRaw(state) { return state && isObj(state.extras) && isObj(state.extras.sono) ? state.extras.sono : {}; }
  function ensureSono(state) {
    if (!isObj(state.extras)) state.extras = {};
    var e = state.extras.sono;
    if (!isObj(e)) e = state.extras.sono = {};
    if (!Array.isArray(e.logs)) e.logs = [];
    var g = Number(e.goalHours);
    if (!(g >= MIN_GOAL && g <= MAX_GOAL)) e.goalHours = DEFAULT_GOAL;
    return e;
  }
  function goalHours(state) {
    var g = Number(sonoRaw(state).goalHours);
    return g >= MIN_GOAL && g <= MAX_GOAL ? g : DEFAULT_GOAL;
  }
  // Registros válidos, do dia mais antigo para o mais novo (ignora lixo sem quebrar).
  function sleepLogs(state) {
    var raw = sonoRaw(state);
    return (Array.isArray(raw.logs) ? raw.logs : []).filter(function (l) {
      return isObj(l) && C.isDateKey(l.date) && isFinite(Number(l.hours)) && Number(l.hours) >= 0;
    }).sort(function (a, b) { return cmp(a.date, b.date); });
  }
  function sleepOn(state, date) {
    var list = sleepLogs(state);
    for (var i = list.length - 1; i >= 0; i--) if (list[i].date === date) return list[i];
    return null;
  }
  // Último registro até hoje (para "noite passada").
  function latestSleep(state, today) {
    var list = sleepLogs(state);
    for (var i = list.length - 1; i >= 0; i--) if (!today || list[i].date <= today) return list[i];
    return null;
  }
  function sleepAvg(state, from, to) {
    var hs = sleepLogs(state).filter(function (l) { return l.date >= from && l.date <= to; }).map(function (l) { return Number(l.hours); });
    return hs.length ? round2(avg(hs)) : null;
  }

  // Últimos "days" dias (padrão 7) terminando hoje: horas por dia, média, melhor/pior noite e a "dívida de sono"
  // (soma de meta − horas, só dos dias registrados; nunca negativa — noites longas compensam as curtas).
  function sleepStats(state, today, days) {
    days = days || 7;
    var goal = goalHours(state), list = [], hs = [], balance = 0, met = 0, qs = [], best = null, worst = null;
    for (var i = days - 1; i >= 0; i--) {
      var d = C.addDays(today, -i), l = sleepOn(state, d), h = l ? Number(l.hours) : null;
      list.push({ date: d, hours: h, quality: l ? l.quality : null, id: l ? l.id : null, met: h == null ? null : h >= goal - 1e-9 });
      if (h == null) continue;
      hs.push(h); balance += goal - h;
      if (h >= goal - 1e-9) met++;
      if (l.quality) qs.push(Number(l.quality));
      if (!best || h > best.hours) best = { date: d, hours: h };
      if (!worst || h < worst.hours) worst = { date: d, hours: h };
    }
    return {
      goal: goal, days: list, count: hs.length, metCount: met, avg: hs.length ? round2(avg(hs)) : null,
      best: best, worst: worst, avgQuality: qs.length ? round1(avg(qs)) : null,
      balance: round1(balance), debt: Math.max(0, round1(balance))
    };
  }

  // Valida o que a usuária digitou. Aceita as horas direto OU "dormi às / acordei às" (atravessa a meia-noite).
  function validateSleep(input) {
    input = input || {};
    var e = {}, v = { date: String(input.date || '') };
    if (!C.isDateKey(v.date)) e.date = 'Escolha o dia em que você acordou.';
    else if (input.today && v.date > input.today) e.date = 'Escolha um dia até hoje.';
    var bed = input.bed ? String(input.bed).trim() : '', wake = input.wake ? String(input.wake).trim() : '', hours = null;
    if (bed || wake) {
      if (!bed || !wake) e.bed = 'Informe os dois horários (dormi e acordei) ou use as horas.';
      else if (!C.isTimeKey(bed)) e.bed = 'Horário inválido.';
      else if (!C.isTimeKey(wake)) e.wake = 'Horário inválido.';
      else {
        var diff = (minutes(wake) - minutes(bed) + 1440) % 1440;
        if (diff === 0) e.wake = 'Dormiu e acordou no mesmo horário? Confira os horários.';
        else if (diff / 60 > 16) e.wake = 'Mais de 16 horas de sono? Confira os horários.';
        else hours = round1(diff / 60);
      }
      v.bed = bed || null; v.wake = wake || null;
    } else {
      var n = parseNum(input.hours);
      if (isNaN(n)) e.hours = 'Informe quantas horas você dormiu.';
      else if (n < 0 || n > 16) e.hours = 'Entre 0 e 16 horas.';
      else hours = round1(n);
      v.bed = null; v.wake = null;
    }
    v.hours = hours;
    var raw = input.quality;
    if (raw == null || raw === '') v.quality = null;
    else {
      var q = Math.round(Number(raw));
      if (q >= 1 && q <= 5) v.quality = q; else { e.quality = 'Escolha de 1 a 5.'; v.quality = null; }
    }
    return { ok: !Object.keys(e).length, errors: e, value: v };
  }

  function sortLogs(e) { e.logs.sort(function (a, b) { return cmp(a.date, b.date); }); }
  // Salva (substitui o registro do mesmo dia). Devolve { ok, errors, log, previous } — "previous" serve para desfazer.
  function saveSleep(state, input, nowISO) {
    var r = validateSleep(input);
    if (!r.ok) return { ok: false, errors: r.errors, log: null, previous: null };
    var e = ensureSono(state), prev = null;
    for (var i = e.logs.length - 1; i >= 0; i--) {
      if (isObj(e.logs[i]) && e.logs[i].date === r.value.date) { prev = Object.assign({}, e.logs[i]); e.logs.splice(i, 1); }
    }
    var log = { id: prev && prev.id ? prev.id : uid(), date: r.value.date, hours: r.value.hours, quality: r.value.quality, bed: r.value.bed, wake: r.value.wake, createdAt: prev && prev.createdAt ? prev.createdAt : nowISO };
    e.logs.push(log);
    sortLogs(e);
    return { ok: true, errors: {}, log: log, previous: prev };
  }
  function putSleep(state, log) {
    if (!isObj(log) || !C.isDateKey(log.date)) return null;
    var e = ensureSono(state);
    e.logs = e.logs.filter(function (l) { return !(isObj(l) && l.date === log.date); });
    e.logs.push(Object.assign({}, log));
    sortLogs(e);
    return log;
  }
  function deleteSleep(state, id) {
    var e = ensureSono(state), i = e.logs.findIndex(function (l) { return isObj(l) && l.id === id; });
    if (i < 0) return null;
    return e.logs.splice(i, 1)[0];
  }
  // Desfaz um salvamento: tira o registro novo e devolve o anterior (se havia).
  function restoreSleep(state, logId, previous) {
    deleteSleep(state, logId);
    if (previous) putSleep(state, previous);
  }
  function setSleepGoal(state, hours) {
    var n = parseNum(hours);
    if (isNaN(n)) return null;
    n = Math.round(n * 2) / 2;
    if (!(n >= MIN_GOAL && n <= MAX_GOAL)) return null;
    ensureSono(state).goalHours = n;
    return n;
  }

  // Energia (1–5, registrada em Ciclo/Treino) nos dias em que bateu a meta de sono × nos outros.
  // Só devolve resultado com pelo menos MIN_PAIRS dias de cada lado; é correlação, não causa.
  function sleepVsEnergy(state, today, opts) {
    var thr = opts && Number(opts.threshold) > 0 ? Number(opts.threshold) : goalHours(state);
    var days = state && isObj(state.cycleDays) ? state.cycleDays : {}, a = [], b = [];
    sleepLogs(state).forEach(function (l) {
      if (today && l.date > today) return;
      var en = days[l.date] ? Number(days[l.date].energy) : NaN;
      if (!(en >= 1 && en <= 5)) return;
      (Number(l.hours) >= thr - 1e-9 ? a : b).push(en);
    });
    if (a.length < MIN_PAIRS || b.length < MIN_PAIRS) return null;
    var ma = round1(avg(a)), mb = round1(avg(b));
    return { threshold: thr, comMeta: { n: a.length, mediaEnergia: ma }, abaixo: { n: b.length, mediaEnergia: mb }, diff: round1(ma - mb) };
  }

  // Dias de treino com recorde pessoal depois de noites com a meta batida × abaixo dela (precisa do módulo de treino).
  function sleepVsRecords(state, opts) {
    var T = root && root.JSTreino ? root.JSTreino : (typeof require === 'function' ? safeRequire('./regras-treino.js') : null);
    if (!T || !T.exerciseRecords) return null;
    var thr = opts && Number(opts.threshold) > 0 ? Number(opts.threshold) : goalHours(state);
    var sess = (state.workoutSessions || []).filter(function (s) { return s.status === 'done'; });
    var trainDays = {}, ids = {};
    sess.forEach(function (s) { trainDays[s.date] = true; s.items.forEach(function (it) { if (it.sets && it.sets.length) ids[it.exerciseId] = true; }); });
    var prDays = {};
    Object.keys(ids).forEach(function (id) { T.exerciseRecords(state, id).events.forEach(function (ev) { prDays[ev.date] = true; }); });
    var hi = { dias: 0, comRecorde: 0 }, lo = { dias: 0, comRecorde: 0 };
    Object.keys(trainDays).forEach(function (d) {
      var l = sleepOn(state, d);
      if (!l) return;
      var side = Number(l.hours) >= thr - 1e-9 ? hi : lo;
      side.dias++; if (prDays[d]) side.comRecorde++;
    });
    if (hi.dias < 4 || lo.dias < 4) return null;
    return { threshold: thr, comMeta: hi, abaixo: lo };
  }
  function safeRequire(p) { try { return require(p); } catch (e) { return null; } }

  /* ======================= Skincare ======================= */

  function defaultSteps() {
    return {
      manha: [{ id: 'limpar-m', name: 'Limpar' }, { id: 'hidratar-m', name: 'Hidratar' }, { id: 'protetor', name: 'Protetor solar' }],
      noite: [{ id: 'demaquilar', name: 'Demaquilar' }, { id: 'limpar-n', name: 'Limpar' }, { id: 'serum', name: 'Sérum' }, { id: 'hidratar-n', name: 'Hidratante' }]
    };
  }
  function cleanSteps(list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).filter(function (s) {
      if (!isObj(s) || typeof s.id !== 'string' || !s.id || typeof s.name !== 'string' || !s.name.trim() || seen[s.id]) return false;
      seen[s.id] = true; return true;
    }).map(function (s) { return { id: s.id, name: s.name }; });
  }
  function timeOrNull(t) { return typeof t === 'string' && C.isTimeKey(t) ? t : null; }
  // Visão normalizada (não altera o estado).
  function skincareView(state) {
    var e = state && isObj(state.extras) && isObj(state.extras.skincare) ? state.extras.skincare : {};
    var st = isObj(e.steps) ? e.steps : {}, rem = isObj(e.reminders) ? e.reminders : {};
    return {
      steps: { manha: cleanSteps(st.manha), noite: cleanSteps(st.noite) },
      reminders: { manha: timeOrNull(rem.manha), noite: timeOrNull(rem.noite) },
      logs: isObj(e.logs) ? e.logs : {}
    };
  }
  function ensureSkincare(state) {
    if (!isObj(state.extras)) state.extras = {};
    var e = state.extras.skincare;
    if (!isObj(e)) e = state.extras.skincare = {};
    var v = skincareView(state);
    e.steps = v.steps; e.reminders = v.reminders;
    if (!isObj(e.logs)) e.logs = {};
    return e;
  }
  function skincareActive(state) { var v = skincareView(state); return v.steps.manha.length + v.steps.noite.length > 0; }
  function inPeriods(per) { return PERIODS.indexOf(per) >= 0; }

  // Começa com os passos sugeridos (só se ainda não há passos).
  function startSkincare(state) {
    var e = ensureSkincare(state);
    if (!e.steps.manha.length && !e.steps.noite.length) e.steps = defaultSteps();
    return e.steps;
  }
  function resetSteps(state) { var e = ensureSkincare(state); e.steps = defaultSteps(); return e.steps; }
  function addStep(state, per, name) {
    var nm = String(name == null ? '' : name).trim().slice(0, NAME_MAX);
    if (!inPeriods(per) || !nm) return null;
    var e = ensureSkincare(state);
    if (e.steps[per].length >= MAX_STEPS) return null;
    var s = { id: uid(), name: nm };
    e.steps[per].push(s);
    return s;
  }
  function renameStep(state, per, id, name) {
    var nm = String(name == null ? '' : name).trim().slice(0, NAME_MAX);
    if (!inPeriods(per) || !nm) return null;
    var e = ensureSkincare(state), s = e.steps[per].filter(function (x) { return x.id === id; })[0];
    if (!s) return null;
    s.name = nm;
    return s;
  }
  function removeStep(state, per, id) {
    if (!inPeriods(per)) return false;
    var e = ensureSkincare(state), i = e.steps[per].findIndex(function (x) { return x.id === id; });
    if (i < 0) return false;
    e.steps[per].splice(i, 1);
    return true;
  }
  function moveStep(state, per, id, delta) {
    if (!inPeriods(per)) return false;
    var e = ensureSkincare(state), l = e.steps[per], i = l.findIndex(function (x) { return x.id === id; }), j = i + (delta < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= l.length) return false;
    var t = l[i]; l[i] = l[j]; l[j] = t;
    return true;
  }
  function setReminder(state, per, time) {
    if (!inPeriods(per)) return false;
    var t = time == null || time === '' ? null : String(time);
    if (t != null && !C.isTimeKey(t)) return false;
    ensureSkincare(state).reminders[per] = t;
    return true;
  }
  // Valida a edição completa (nomes, ordem, lembretes). Linhas sem nome são descartadas.
  function validateSkincareConfig(cfg) {
    cfg = cfg || {};
    var e = {}, steps = { manha: [], noite: [] }, rem = { manha: null, noite: null }, seen = {};
    PERIODS.forEach(function (per) {
      var list = isObj(cfg.steps) && Array.isArray(cfg.steps[per]) ? cfg.steps[per] : [];
      list.forEach(function (s) {
        var nm = String(s && s.name != null ? s.name : '').trim();
        if (!nm) return;
        if (nm.length > NAME_MAX) { e.steps = 'Cada passo pode ter até ' + NAME_MAX + ' letras.'; return; }
        var id = s && typeof s.id === 'string' && s.id && !seen[s.id] ? s.id : uid();
        seen[id] = true;
        steps[per].push({ id: id, name: nm });
      });
      if (steps[per].length > MAX_STEPS) e.steps = 'Use até ' + MAX_STEPS + ' passos em cada período.';
      var t = isObj(cfg.reminders) ? cfg.reminders[per] : null;
      if (t != null && t !== '') { if (C.isTimeKey(String(t))) rem[per] = String(t); else e['rem_' + per] = 'Horário inválido.'; }
    });
    return { ok: !Object.keys(e).length, errors: e, value: { steps: steps, reminders: rem } };
  }
  function setSkincareConfig(state, cfg) {
    var r = validateSkincareConfig(cfg);
    if (!r.ok) return r;
    var e = ensureSkincare(state);
    e.steps = r.value.steps; e.reminders = r.value.reminders;
    return r;
  }

  function doneIds(v, date, per) {
    var l = isObj(v.logs[date]) ? v.logs[date][per] : null;
    return Array.isArray(l) ? l : [];
  }
  // Marca/desmarca um passo no dia. Devolve { done } ou null se o passo/dia/período não existe.
  function toggleStep(state, date, per, stepId, nowISO) {
    if (!inPeriods(per) || !C.isDateKey(date)) return null;
    var e = ensureSkincare(state);
    if (!e.steps[per].some(function (s) { return s.id === stepId; })) return null;
    if (!isObj(e.logs[date])) e.logs[date] = {};
    var day = e.logs[date], list = Array.isArray(day[per]) ? day[per].slice() : [], i = list.indexOf(stepId), done;
    if (i >= 0) { list.splice(i, 1); done = false; } else { list.push(stepId); done = true; }
    if (list.length) day[per] = list; else delete day[per];
    if (!Object.keys(day).length) delete e.logs[date];
    void nowISO;
    return { done: done };
  }
  // Marca todos os passos do período (atalho do Início). Devolve a lista anterior, para desfazer com setPeriodDone.
  function markPeriod(state, date, per) {
    if (!inPeriods(per) || !C.isDateKey(date)) return null;
    var e = ensureSkincare(state), prev = doneIds(e, date, per).slice();
    setPeriodDone(state, date, per, e.steps[per].map(function (s) { return s.id; }));
    return prev;
  }
  function setPeriodDone(state, date, per, ids) {
    if (!inPeriods(per) || !C.isDateKey(date)) return false;
    var e = ensureSkincare(state);
    if (!isObj(e.logs[date])) e.logs[date] = {};
    var day = e.logs[date];
    if (ids && ids.length) day[per] = ids.slice(); else delete day[per];
    if (!Object.keys(day).length) delete e.logs[date];
    return true;
  }

  function periodStatus(v, date, per) {
    var steps = v.steps[per], ids = doneIds(v, date, per);
    var done = steps.filter(function (s) { return ids.indexOf(s.id) >= 0; }).length;
    return { done: done, total: steps.length, ids: ids.filter(function (id) { return steps.some(function (s) { return s.id === id; }); }) };
  }
  // Como está o dia: passos feitos por período; "complete" = todos os períodos que têm passos estão completos.
  function skincareDay(state, date) {
    var v = skincareView(state), m = periodStatus(v, date, 'manha'), n = periodStatus(v, date, 'noite');
    var active = m.total + n.total > 0;
    var complete = active && (m.total === 0 || m.done === m.total) && (n.total === 0 || n.done === n.total);
    return { manha: m, noite: n, complete: complete, active: active };
  }
  function periodComplete(state, date, per) {
    if (!inPeriods(per)) return false;
    var p = periodStatus(skincareView(state), date, per);
    return p.total > 0 && p.done === p.total;
  }
  // Dias seguidos com a rotina completa. Se hoje ainda está aberto, não quebra a sequência (conta a partir de ontem).
  function skincareStreak(state, today) {
    var d = today, n = 0;
    if (!skincareDay(state, today).complete) d = C.addDays(today, -1);
    for (var i = 0; i < 400; i++) {
      if (!skincareDay(state, d).complete) break;
      n++; d = C.addDays(d, -1);
    }
    return n;
  }
  // Os últimos 7 dias (do mais antigo para hoje).
  function skincareWeek(state, today) {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = C.addDays(today, -i), day = skincareDay(state, d);
      out.push({ date: d, isToday: i === 0, active: day.active, complete: day.complete, partial: !day.complete && (day.manha.done + day.noite.done) > 0, manha: day.manha, noite: day.noite });
    }
    return out;
  }

  // Quem usa o quê (para o cartão compacto do Início não aparecer à toa).
  function wellbeingActive(state, today) {
    var from = C.addDays(today, -13);
    var sono = sleepLogs(state).some(function (l) { return l.date >= from && l.date <= today; });
    var skincare = skincareActive(state);
    return { sono: sono, skincare: skincare, any: sono || skincare };
  }

  return {
    DEFAULT_GOAL: DEFAULT_GOAL, MIN_GOAL: MIN_GOAL, MAX_GOAL: MAX_GOAL, MIN_PAIRS: MIN_PAIRS, MAX_STEPS: MAX_STEPS, NAME_MAX: NAME_MAX,
    PERIODS: PERIODS, PERIOD_NAME: PERIOD_NAME, QUALITY: QUALITY,
    // sono
    goalHours: goalHours, sleepLogs: sleepLogs, sleepOn: sleepOn, latestSleep: latestSleep, sleepAvg: sleepAvg, sleepStats: sleepStats,
    validateSleep: validateSleep, saveSleep: saveSleep, putSleep: putSleep, deleteSleep: deleteSleep, restoreSleep: restoreSleep,
    setSleepGoal: setSleepGoal, sleepVsEnergy: sleepVsEnergy, sleepVsRecords: sleepVsRecords,
    // skincare
    defaultSteps: defaultSteps, skincareConfig: skincareView, skincareActive: skincareActive, startSkincare: startSkincare, resetSteps: resetSteps,
    addStep: addStep, renameStep: renameStep, removeStep: removeStep, moveStep: moveStep, setReminder: setReminder,
    validateSkincareConfig: validateSkincareConfig, setSkincareConfig: setSkincareConfig,
    toggleStep: toggleStep, markPeriod: markPeriod, setPeriodDone: setPeriodDone,
    skincareDay: skincareDay, periodComplete: periodComplete, skincareStreak: skincareStreak, skincareWeek: skincareWeek,
    wellbeingActive: wellbeingActive
  };
});
