/*
 * J.S. — regras do Corpo: registros de bioimpedância e medidas, evolução e indicações.
 * As faixas de referência mostradas são gerais (OMS para IMC; ACE para % de gordura)
 * e servem só de orientação — não substituem avaliação profissional.
 */
(function (root, factory) {
  var req = typeof require === 'function';
  var C = root && root.JSCore ? root.JSCore : (req ? require('./core.js') : null);
  var R = root && root.JSRegras ? root.JSRegras : (req ? require('./regras.js') : null);
  var api = factory(C, R);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSCorpo = api;
})(typeof self !== 'undefined' ? self : this, function (C, R) {
  'use strict';

  // good: direção que costuma ser desejada ('up', 'down' ou 'neutral', quando depende do objetivo).
  var FIELDS = [
    { key: 'weightKg', label: 'Peso', unit: 'kg', good: 'neutral', min: 20, max: 400, step: 0.1 },
    { key: 'fatPct', label: 'Gordura corporal', unit: '%', good: 'down', min: 2, max: 75, step: 0.1 },
    { key: 'muscleKg', label: 'Massa muscular', unit: 'kg', good: 'up', min: 5, max: 150, step: 0.1 },
    { key: 'leanKg', label: 'Massa magra', unit: 'kg', good: 'up', min: 10, max: 200, step: 0.1 },
    { key: 'waterPct', label: 'Água corporal', unit: '%', good: 'up', min: 20, max: 80, step: 0.1 },
    { key: 'visceral', label: 'Gordura visceral', unit: 'nível', good: 'down', min: 1, max: 60, step: 0.5 },
    { key: 'bmrKcal', label: 'Metabolismo basal', unit: 'kcal', good: 'neutral', min: 600, max: 5000, step: 1 },
    { key: 'boneKg', label: 'Massa óssea', unit: 'kg', good: 'neutral', min: 0.5, max: 10, step: 0.1 },
    { key: 'proteinPct', label: 'Proteína', unit: '%', good: 'up', min: 5, max: 40, step: 0.1 },
    { key: 'metabolicAge', label: 'Idade metabólica', unit: 'anos', good: 'down', min: 10, max: 100, step: 1 }
  ];
  var MEASURES = [
    { key: 'waistCm', label: 'Cintura', unit: 'cm' }, { key: 'abdomenCm', label: 'Abdômen', unit: 'cm' },
    { key: 'hipCm', label: 'Quadril', unit: 'cm' }, { key: 'chestCm', label: 'Busto/peito', unit: 'cm' },
    { key: 'armCm', label: 'Braço', unit: 'cm' }, { key: 'thighCm', label: 'Coxa', unit: 'cm' },
    { key: 'calfCm', label: 'Panturrilha', unit: 'cm' }
  ].map(function (m) { return Object.assign({ good: 'neutral', min: 10, max: 250, step: 0.1 }, m); });
  var ALL = FIELDS.concat(MEASURES);

  function field(key) { for (var i = 0; i < ALL.length; i++) if (ALL[i].key === key) return ALL[i]; return null; }
  function num(v) {
    if (v === '' || v == null) return null;
    var n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }
  function round(n, step) { var d = step < 1 ? (String(step).split('.')[1] || '').length : 0; return Number(n.toFixed(d)); }

  function validateRecord(input) {
    var e = {}, v = { date: String(input.date || ''), notes: String(input.notes || '').trim().slice(0, 300) || null };
    if (!C.isDateKey(v.date)) e.date = 'Escolha a data da medição.';
    var any = false;
    ALL.forEach(function (f) {
      var n = num(input[f.key]);
      if (n === null) { v[f.key] = null; return; }
      if (Number.isNaN(n) || n < f.min || n > f.max) { e[f.key] = 'Valor entre ' + f.min + ' e ' + f.max + '.'; return; }
      v[f.key] = round(n, f.step);
      any = true;
    });
    if (!any && !Object.keys(e).length) e.weightKg = 'Preencha pelo menos um valor.';
    return { ok: !Object.keys(e).length, errors: e, value: v };
  }

  function createRecord(state, v, nowISO) {
    var r = Object.assign({ id: C.uuid(), createdAt: nowISO, updatedAt: nowISO }, v);
    state.bodyRecords.push(r);
    return r;
  }
  function updateRecord(state, id, v, nowISO) {
    var r = R.byId(state.bodyRecords, id);
    if (!r) return null;
    Object.assign(r, v, { updatedAt: nowISO });
    return r;
  }
  function deleteRecord(state, id) { R.removeById(state.bodyRecords, id); }

  function sorted(state) {
    return state.bodyRecords.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt < b.createdAt ? -1 : 1); });
  }
  function series(state, key) {
    return sorted(state).filter(function (r) { return r[key] != null; }).map(function (r) { return { date: r.date, value: r[key] }; });
  }
  // Último valor de cada campo e a diferença para a medição anterior que tinha esse campo.
  function latest(state) {
    var out = {};
    ALL.forEach(function (f) {
      var s = series(state, f.key);
      if (!s.length) return;
      var last = s[s.length - 1], prev = s.length > 1 ? s[s.length - 2] : null;
      var delta = prev ? round(last.value - prev.value, f.step) : null;
      out[f.key] = {
        value: last.value, date: last.date, prev: prev, delta: delta,
        tone: delta == null || delta === 0 || f.good === 'neutral' ? 'neutral' : ((delta > 0) === (f.good === 'up') ? 'good' : 'bad')
      };
    });
    return out;
  }

  function bmi(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    var m = heightCm / 100;
    return Math.round(weightKg / (m * m) * 10) / 10;
  }
  // Classificação da OMS para adultos.
  function bmiClass(v) {
    if (v == null) return null;
    if (v < 18.5) return { label: 'Abaixo do peso', tone: 'warn' };
    if (v < 25) return { label: 'Peso adequado', tone: 'good' };
    if (v < 30) return { label: 'Sobrepeso', tone: 'warn' };
    return { label: 'Obesidade', tone: 'bad' };
  }

  // Faixas gerais de % de gordura (American Council on Exercise).
  var FAT_REF = {
    f: [[10, 13, 'Essencial'], [14, 20, 'Atleta'], [21, 24, 'Boa forma'], [25, 31, 'Média'], [32, 100, 'Acima da média']],
    m: [[2, 5, 'Essencial'], [6, 13, 'Atleta'], [14, 17, 'Boa forma'], [18, 24, 'Média'], [25, 100, 'Acima da média']]
  };
  function fatClass(pct, sex) {
    if (pct == null) return null;
    var ref = FAT_REF[sex === 'm' ? 'm' : 'f'];
    for (var i = 0; i < ref.length; i++) if (pct < ref[i][1] + 1) return { label: ref[i][2], index: i, ref: ref };
    return { label: ref[ref.length - 1][2], index: ref.length - 1, ref: ref };
  }

  // Indicação de massa muscular: proporção do peso, índice por altura e se está ganhando ou perdendo.
  function muscleIndicator(state, today) {
    var s = series(state, 'muscleKg');
    if (!s.length) return null;
    var last = s[s.length - 1];
    var w = series(state, 'weightKg').filter(function (x) { return x.date <= last.date; });
    var weight = w.length ? w[w.length - 1].value : null;
    var h = state.settings.body && state.settings.body.heightCm;
    var from = C.addDays(today || last.date, -90);
    var recent = s.filter(function (x) { return x.date >= from; });
    var base = recent.length > 1 ? recent[0] : (s.length > 1 ? s[s.length - 2] : null);
    var change = base ? Math.round((last.value - base.value) * 10) / 10 : null;
    var days = base ? C.diffDays(base.date, last.date) : null;
    return {
      kg: last.value, date: last.date,
      pctOfWeight: weight ? Math.round(last.value / weight * 1000) / 10 : null,
      perHeight: h ? Math.round(last.value / Math.pow(h / 100, 2) * 10) / 10 : null,
      change: change, days: days,
      status: change == null ? 'first' : change >= 0.3 ? 'gaining' : change <= -0.3 ? 'losing' : 'stable'
    };
  }

  // Metabolismo basal estimado (Mifflin-St Jeor) quando a balança não informa.
  function estimateBmr(weightKg, heightCm, age, sex) {
    if (!weightKg || !heightCm || !age) return null;
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161));
  }

  return {
    FIELDS: FIELDS, MEASURES: MEASURES, ALL: ALL, FAT_REF: FAT_REF, field: field,
    validateRecord: validateRecord, createRecord: createRecord, updateRecord: updateRecord, deleteRecord: deleteRecord,
    sorted: sorted, series: series, latest: latest, bmi: bmi, bmiClass: bmiClass, fatClass: fatClass,
    muscleIndicator: muscleIndicator, estimateBmr: estimateBmr
  };
});
