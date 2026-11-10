/*
 * J.S. — regras do Ciclo menstrual: menstruações registradas, médias, previsões, fases,
 * registro do dia (fluxo, energia, humor, sintomas) e a relação com treino e energia.
 * Sem tela e sem armazenamento: recebe o "state" e pode ser testado no Node.
 *
 * Previsões são estimativas pela média dos ciclos registrados (fase lútea de ~14 dias).
 * Não servem como método anticoncepcional nem substituem a orientação médica.
 */
(function (root, factory) {
  var C = root && root.JSCore ? root.JSCore : (typeof require === 'function' ? require('./core.js') : null);
  var api = factory(C);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSCiclo = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var MIN_CYCLE = 18, MAX_CYCLE = 45, LUTEAL = 14, MAX_PERIOD = 10;

  var PHASES = {
    men: {
      key: 'men', name: 'Menstrual', emoji: '🌸',
      about: 'Dias de menstruação. É comum ter menos energia e cólica nos primeiros dias.',
      treino: 'Se estiver bem, treine normalmente. Com cólica ou cansaço, prefira algo mais leve (caminhada, alongamento, mobilidade) e respeite o descanso.',
      cuidado: 'Água, comida de verdade e sono ajudam. Bolsa de água morna alivia a cólica.'
    },
    fol: {
      key: 'fol', name: 'Folicular', emoji: '🌱',
      about: 'Depois da menstruação o estrogênio sobe e muitas mulheres sentem mais disposição.',
      treino: 'Boa fase para progredir: tente subir um pouco a carga ou as repetições.',
      cuidado: 'Aproveite a energia para os treinos mais puxados da semana.'
    },
    ovu: {
      key: 'ovu', name: 'Ovulatória', emoji: '✨',
      about: 'Perto da ovulação a energia e a força costumam estar no auge.',
      treino: 'Ótima para treinos intensos — capriche no aquecimento e na técnica.',
      cuidado: 'Período fértil estimado: lembre que é só uma estimativa.'
    },
    lut: {
      key: 'lut', name: 'Lútea', emoji: '🌙',
      about: 'Depois da ovulação a progesterona sobe. Perto da menstruação podem vir inchaço, fome maior e cansaço (TPM).',
      treino: 'Mantenha a rotina. Se a energia cair, tudo bem manter as cargas e focar na técnica.',
      cuidado: 'Durma bem, beba bastante água e vá com carinho consigo mesma.'
    }
  };
  var PHASE_ORDER = ['men', 'fol', 'ovu', 'lut'];
  var FLOW = [[1, 'Leve'], [2, 'Médio'], [3, 'Intenso']];
  var ENERGY = [[1, '😴', 'Muito baixa'], [2, '😕', 'Baixa'], [3, '🙂', 'Normal'], [4, '😊', 'Boa'], [5, '🤩', 'Ótima']];
  var MOOD = [[1, '😢', 'Triste'], [2, '😟', 'Pra baixo'], [3, '😐', 'Neutra'], [4, '🙂', 'Bem'], [5, '😄', 'Feliz']];
  var SYMPTOMS = [
    ['colica', 'Cólica'], ['cabeca', 'Dor de cabeça'], ['inchaco', 'Inchaço'], ['seios', 'Seios sensíveis'], ['acne', 'Acne'],
    ['doce', 'Vontade de doce'], ['fome', 'Mais fome'], ['cansaco', 'Cansaço'], ['insonia', 'Insônia'], ['ansiedade', 'Ansiedade'],
    ['irritacao', 'Irritação'], ['tristeza', 'Tristeza'], ['costas', 'Dor nas costas'], ['enjoo', 'Enjoo'], ['libido', 'Libido alta']
  ];
  var SYMPTOM_IDS = SYMPTOMS.map(function (x) { return x[0]; });

  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function avg(list) { return list.reduce(function (a, b) { return a + b; }, 0) / list.length; }
  function uid() { return C.uuid(); }

  function settings(state) {
    var c = (state.settings && state.settings.cycle) || {};
    return {
      cycleLen: clamp(Math.round(Number(c.cycleLen) || 28), 20, 45),
      periodLen: clamp(Math.round(Number(c.periodLen) || 5), 2, MAX_PERIOD),
      remind: c.remind !== false, showInTreino: c.showInTreino !== false
    };
  }
  function periods(state) {
    return (state.cyclePeriods || []).filter(function (p) { return p && C.isDateKey(p.start); })
      .slice().sort(function (a, b) { return cmp(a.start, b.start); });
  }
  function enabled(state) { return (state.cyclePeriods || []).length > 0; }
  function dayLog(state, date) { return (state.cycleDays || {})[date] || null; }

  /* ---------------- Médias ---------------- */

  // Duração dos ciclos (entre um início e o seguinte) e da menstruação, pelos últimos 6.
  function stats(state) {
    var st = settings(state), ps = periods(state), lens = [];
    for (var i = 1; i < ps.length; i++) {
      var d = C.diffDays(ps[i - 1].start, ps[i].start);
      if (d >= MIN_CYCLE && d <= MAX_CYCLE) lens.push(d);
    }
    var recent = lens.slice(-6);
    var plens = ps.filter(function (p) { return p.end; }).map(function (p) { return C.diffDays(p.start, p.end) + 1; })
      .filter(function (n) { return n >= 1 && n <= MAX_PERIOD; }).slice(-6);
    var mn = recent.length ? Math.min.apply(null, recent) : null, mx = recent.length ? Math.max.apply(null, recent) : null;
    return {
      cycleLen: recent.length ? Math.round(avg(recent)) : st.cycleLen,
      periodLen: plens.length ? Math.round(avg(plens)) : st.periodLen,
      measured: recent.length, min: mn, max: mx,
      regular: recent.length >= 3 ? mx - mn <= 7 : null,
      lengths: lens
    };
  }

  // Último dia da menstruação: o marcado; sem marcação, a duração média (ou o último dia com fluxo registrado).
  function periodEnd(state, p, S) {
    if (p.end && p.end >= p.start) return p.end;
    var est = C.addDays(p.start, (S || stats(state)).periodLen - 1);
    var days = state.cycleDays || {}, lim = C.addDays(p.start, MAX_PERIOD - 1);
    Object.keys(days).forEach(function (d) { if (d > est && d <= lim && days[d] && days[d].flow >= 1) est = d; });
    return est;
  }

  /* ---------------- Linha do tempo ---------------- */

  // Inícios previstos depois do último registrado. Atrasada: o próximo passa a ser "a partir de amanhã".
  function predictions(state, today, count, S) {
    S = S || stats(state);
    var ps = periods(state);
    if (!ps.length) return { starts: [], late: 0, expected: null };
    var last = ps[ps.length - 1].start, expected = C.addDays(last, S.cycleLen), late = 0, base = expected;
    if (today && expected <= today) { late = C.diffDays(expected, today); base = C.addDays(today, 1); }
    var out = [];
    for (var k = 0; k < (count || 6); k++) out.push(C.addDays(base, k * S.cycleLen));
    return { starts: out, late: late, expected: expected };
  }
  function predictedStarts(state, today, count) { return predictions(state, today, count).starts; }

  // Tudo sobre um dia: fase, dia do ciclo, menstruação (registrada ou prevista), janela fértil.
  function dayInfo(state, date, today, ctx) {
    ctx = ctx || context(state, today);
    var starts = ctx.starts;
    var i = -1;
    for (var k = 0; k < starts.length; k++) if (starts[k].date <= date) i = k;
    if (i < 0) return null;
    var cur = starts[i], next = starts[i + 1] ? starts[i + 1].date : C.addDays(cur.date, ctx.S.cycleLen);
    var day = C.diffDays(cur.date, date) + 1;
    var pEnd = cur.real ? periodEnd(state, cur.real, ctx.S) : C.addDays(cur.date, ctx.S.periodLen - 1);
    var ov = C.addDays(next, -LUTEAL);
    var phase = date <= pEnd ? 'men' : date < C.addDays(ov, -1) ? 'fol' : date <= C.addDays(ov, 1) ? 'ovu' : 'lut';
    var fertile = date >= C.addDays(ov, -5) && date <= C.addDays(ov, 1);
    return {
      date: date, day: day, cycleLen: C.diffDays(cur.date, next), phase: phase,
      period: phase === 'men', periodReal: phase === 'men' && !!cur.real, periodPredicted: phase === 'men' && !cur.real,
      predicted: !cur.real, fertile: fertile, ovulation: date === ov, ovulationDate: ov, start: cur.date, nextStart: next, periodEnd: pEnd,
      log: dayLog(state, date)
    };
  }

  function context(state, today) {
    var S = stats(state), pr = predictions(state, today, 14, S);
    var starts = periods(state).map(function (p) { return { date: p.start, real: p }; })
      .concat(pr.starts.map(function (d) { return { date: d, real: null }; }));
    return { S: S, pr: pr, starts: starts, today: today };
  }

  // Resumo de hoje para as telas.
  function current(state, today) {
    if (!enabled(state)) return null;
    var ctx = context(state, today), info = dayInfo(state, today, today, ctx);
    if (!info) return null;
    var next = ctx.pr.starts[0];
    var ps = periods(state), last = ps[ps.length - 1];
    var inPeriod = !!(info.periodReal);
    var fert = null;
    // Próxima janela fértil (a atual, se estiver nela).
    var ovNext = C.addDays(ctx.pr.starts[1] || C.addDays(next, ctx.S.cycleLen), -LUTEAL);
    if (info.ovulationDate >= today || info.fertile) fert = { from: C.addDays(info.ovulationDate, -5), to: C.addDays(info.ovulationDate, 1), ov: info.ovulationDate };
    else fert = { from: C.addDays(ovNext, -5), to: C.addDays(ovNext, 1), ov: ovNext };
    return {
      info: info, phase: PHASES[info.phase], stats: ctx.S, late: ctx.pr.late, expected: ctx.pr.expected,
      nextStart: next, daysToNext: C.diffDays(today, next), inPeriod: inPeriod, lastPeriod: last,
      openPeriod: last && !last.end && today >= last.start && today <= C.addDays(last.start, MAX_PERIOD + 4) ? last : null,
      fertile: fert
    };
  }

  // Calendário do mês: um dayInfo por dia (vazio antes do primeiro registro).
  function monthDays(state, mk, today) {
    var r = C.monthRange(mk), out = {}, ctx = context(state, today);
    for (var d = r.from; d <= r.to; d = C.addDays(d, 1)) out[d] = dayInfo(state, d, today, ctx);
    return out;
  }

  /* ---------------- Registros ---------------- */

  function realPeriodOn(state, date, S) {
    S = S || stats(state);
    var ps = periods(state);
    for (var i = ps.length - 1; i >= 0; i--) {
      if (ps[i].start <= date && date <= periodEnd(state, ps[i], S)) return ps[i];
    }
    return null;
  }

  // "Minha menstruação começou" em uma data. Se já existe uma registrada que cobre o dia, usa ela;
  // se a próxima registrada começa 1 a 3 dias depois, antecipa o início dela.
  function startPeriod(state, date, nowISO) {
    if (!C.isDateKey(date)) return null;
    var S = stats(state), have = realPeriodOn(state, date, S);
    if (have) return have;
    var ps = periods(state);
    // Até 3 dias depois do fim de uma registrada (ex.: marcou o fim cedo demais): estende essa.
    var prev = ps.filter(function (p) { return p.start < date && C.diffDays(p.start, date) <= MAX_PERIOD + 2 && C.diffDays(periodEnd(state, p, S), date) <= 3; }).pop();
    if (prev) { if (prev.end && prev.end < date) { prev.end = date; prev.updatedAt = nowISO; } return prev; }
    for (var i = 0; i < ps.length; i++) {
      var d = C.diffDays(date, ps[i].start);
      if (d >= 1 && d <= 3) { ps[i].start = date; if (ps[i].end && ps[i].end < date) ps[i].end = null; ps[i].updatedAt = nowISO; return ps[i]; }
    }
    // A anterior ainda aberta e longe: fecha pela duração média.
    ps.forEach(function (p) { if (!p.end && p.start < date) { var e = periodEnd(state, p, S); p.end = e < date ? e : C.addDays(date, -1); } });
    var np = { id: uid(), start: date, end: null, createdAt: nowISO, updatedAt: nowISO };
    state.cyclePeriods.push(np);
    return np;
  }
  // "Terminou" em uma data (último dia com menstruação).
  function endPeriod(state, id, date, nowISO) {
    var p = (state.cyclePeriods || []).filter(function (x) { return x.id === id; })[0];
    if (!p || !C.isDateKey(date) || date < p.start || C.diffDays(p.start, date) > 14) return null;
    p.end = date; p.updatedAt = nowISO;
    return p;
  }
  function validatePeriod(input) {
    var e = {};
    var v = { start: String(input.start || ''), end: input.end ? String(input.end) : null };
    if (!C.isDateKey(v.start)) e.start = 'Escolha o primeiro dia.';
    if (v.end && !C.isDateKey(v.end)) e.end = 'Data inválida.';
    if (!e.start && v.end && v.end < v.start) e.end = 'O fim precisa ser no mesmo dia ou depois do início.';
    if (!e.start && v.end && C.diffDays(v.start, v.end) > 14) e.end = 'Menstruação de até 15 dias.';
    return { ok: !Object.keys(e).length, errors: e, value: v };
  }
  function savePeriod(state, id, v, nowISO) {
    var others = periods(state).filter(function (p) { return p.id !== id; });
    // Não deixa dois registros começarem muito perto (o mesmo ciclo).
    var clash = others.filter(function (p) { return Math.abs(C.diffDays(p.start, v.start)) < 10; })[0];
    if (clash) return { error: 'Já existe uma menstruação registrada começando em ' + C.formatDateBR(clash.start) + '.' };
    var p = id ? state.cyclePeriods.filter(function (x) { return x.id === id; })[0] : null;
    if (p) { p.start = v.start; p.end = v.end; p.updatedAt = nowISO; }
    else { p = { id: uid(), start: v.start, end: v.end, createdAt: nowISO, updatedAt: nowISO }; state.cyclePeriods.push(p); }
    return { period: p };
  }
  function deletePeriod(state, id) {
    var i = state.cyclePeriods.findIndex(function (p) { return p.id === id; });
    if (i < 0) return;
    var p = state.cyclePeriods[i], end = periodEnd(state, p), days = state.cycleDays || {};
    state.cyclePeriods.splice(i, 1);
    // O fluxo marcado naqueles dias sai junto (o resto do registro do dia fica).
    Object.keys(days).forEach(function (d) {
      if (d >= p.start && d <= end && days[d].flow) { delete days[d].flow; if (!Object.keys(days[d]).length) delete days[d]; }
    });
  }

  // Registro do dia. Valores vazios saem; marcar fluxo fora de uma menstruação registrada começa uma.
  function setDay(state, date, patch, nowISO) {
    if (!C.isDateKey(date)) return null;
    if (!state.cycleDays) state.cycleDays = {};
    var cur = Object.assign({}, state.cycleDays[date] || {}, patch || {});
    if (!(Number(cur.flow) >= 1 && Number(cur.flow) <= 3)) delete cur.flow; else cur.flow = Number(cur.flow);
    ['energy', 'mood'].forEach(function (k) { if (!(Number(cur[k]) >= 1 && Number(cur[k]) <= 5)) delete cur[k]; else cur[k] = Number(cur[k]); });
    cur.symptoms = (Array.isArray(cur.symptoms) ? cur.symptoms : []).filter(function (x, i, a) { return SYMPTOM_IDS.indexOf(x) >= 0 && a.indexOf(x) === i; });
    if (!cur.symptoms.length) delete cur.symptoms;
    var note = String(cur.note == null ? '' : cur.note).trim().slice(0, 300);
    if (note) cur.note = note; else delete cur.note;
    if (Object.keys(cur).length) state.cycleDays[date] = cur; else delete state.cycleDays[date];
    // Só marcar o fluxo agora (não um fluxo antigo do dia) começa uma menstruação.
    if (patch && Number(patch.flow) >= 1 && !realPeriodOn(state, date)) startPeriod(state, date, nowISO);
    return state.cycleDays[date] || null;
  }
  function toggleSymptom(state, date, id, nowISO) {
    var cur = (dayLog(state, date) || {}).symptoms || [];
    var next = cur.indexOf(id) >= 0 ? cur.filter(function (x) { return x !== id; }) : cur.concat([id]);
    return setDay(state, date, { symptoms: next }, nowISO);
  }

  /* ---------------- Treino e energia por fase ---------------- */

  function sessionVolume(s) {
    var v = 0;
    (s.items || []).forEach(function (it) { (it.sets || []).forEach(function (st) { v += (Number(st.load) || 0) * (Number(st.reps) || 0); }); });
    return v;
  }
  // Do primeiro registro até hoje: energia e humor médios, sintomas mais comuns e treinos em cada fase.
  function phaseStats(state, today) {
    var out = {};
    PHASE_ORDER.forEach(function (k) { out[k] = { phase: k, days: 0, energy: [], mood: [], symptoms: {}, workouts: 0, volume: 0 }; });
    var ps = periods(state);
    if (!ps.length) return null;
    var ctx = context(state, today), from = ps[0].start, map = {};
    for (var d = from; d <= today; d = C.addDays(d, 1)) {
      var info = dayInfo(state, d, today, ctx);
      if (!info) continue;
      map[d] = info.phase;
      var o = out[info.phase], lg = info.log;
      o.days++;
      if (lg && lg.energy) o.energy.push(lg.energy);
      if (lg && lg.mood) o.mood.push(lg.mood);
      if (lg && lg.symptoms) lg.symptoms.forEach(function (x) { o.symptoms[x] = (o.symptoms[x] || 0) + 1; });
    }
    (state.workoutSessions || []).forEach(function (s) {
      if (s.status !== 'done' || !map[s.date]) return;
      var o = out[map[s.date]];
      o.workouts++; o.volume += sessionVolume(s);
    });
    return PHASE_ORDER.map(function (k) {
      var o = out[k];
      var top = Object.keys(o.symptoms).sort(function (a, b) { return o.symptoms[b] - o.symptoms[a]; }).slice(0, 3);
      return {
        phase: k, name: PHASES[k].name, days: o.days,
        energy: o.energy.length ? Math.round(avg(o.energy) * 10) / 10 : null, energyCount: o.energy.length,
        mood: o.mood.length ? Math.round(avg(o.mood) * 10) / 10 : null,
        symptoms: top.map(function (x) { return SYMPTOMS[SYMPTOM_IDS.indexOf(x)][1]; }),
        workouts: o.workouts, perWeek: o.days ? Math.round(o.workouts / o.days * 7 * 10) / 10 : null,
        avgVolume: o.workouts ? Math.round(o.volume / o.workouts) : null
      };
    });
  }

  // Histórico de ciclos (mais recente primeiro), com a duração de cada um.
  function history(state) {
    var S = stats(state), ps = periods(state);
    return ps.map(function (p, i) {
      var next = ps[i + 1];
      return { period: p, start: p.start, end: periodEnd(state, p, S), endMarked: !!p.end, days: C.diffDays(p.start, periodEnd(state, p, S)) + 1,
        cycleLen: next ? C.diffDays(p.start, next.start) : null };
    }).reverse();
  }

  return {
    PHASES: PHASES, PHASE_ORDER: PHASE_ORDER, FLOW: FLOW, ENERGY: ENERGY, MOOD: MOOD, SYMPTOMS: SYMPTOMS, LUTEAL: LUTEAL,
    settings: settings, periods: periods, enabled: enabled, dayLog: dayLog, stats: stats, periodEnd: periodEnd,
    predictions: predictions, predictedStarts: predictedStarts, dayInfo: dayInfo, current: current, monthDays: monthDays,
    realPeriodOn: realPeriodOn, startPeriod: startPeriod, endPeriod: endPeriod, validatePeriod: validatePeriod,
    savePeriod: savePeriod, deletePeriod: deletePeriod, setDay: setDay, toggleSymptom: toggleSymptom,
    phaseStats: phaseStats, history: history
  };
});
