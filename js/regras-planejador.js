/*
 * J.S. — regras do cardápio da semana e da lista de compras (módulo puro: roda no navegador e no Node para testes).
 *
 * Dados (state.extras.planejador), sempre revalidados na leitura:
 *   plans:   { 'AAAA-MM-DD': { breakfast: idRefeiçãoSalva, lunch: ..., ... } }
 *   checked: { 'AAAA-MM-DD(segunda da semana)|idAlimento': true }       itens da lista já comprados
 *   extra:   { 'AAAA-MM-DD(segunda da semana)': [{ id, name, done }] }  itens manuais da lista
 * As refeições vêm de state.savedMeals (regras-nutricao.js). Uma refeição salva que foi apagada continua
 * referenciada no plano e aparece como "removida" (não entra nos totais nem na lista).
 */
(function (root, factory) {
  var req = typeof require === 'function';
  var C = root && root.JSCore ? root.JSCore : (req ? require('./core.js') : null);
  var R = root && root.JSRegras ? root.JSRegras : (req ? require('./regras.js') : null);
  var N = root && root.JSNutri ? root.JSNutri : (req ? require('./regras-nutricao.js') : null);
  var api = factory(C, R, N);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSPlanejador = api;
})(typeof self !== 'undefined' ? self : this, function (C, R, N) {
  'use strict';

  // Refeições que podem ser planejadas (na ordem do dia). "Outro" não entra.
  var SLOTS = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'];
  var DEFAULT_SLOTS = ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
  var MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var EXTRA_MAX = 60, KEEP_DAYS = 120;

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function isSlot(k) { return SLOTS.indexOf(k) >= 0; }
  function round1(n) { return Math.round(n * 10) / 10; }

  /* ---------------- Semana ---------------- */

  // Segunda-feira da semana de uma data (a semana do cardápio vai de segunda a domingo).
  function mondayOf(key) { return C.addDays(key, -((C.weekday(key) + 6) % 7)); }
  function weekDays(start) { var out = []; for (var i = 0; i < 7; i++) out.push(C.addDays(start, i)); return out; }
  // "23 a 29 de nov" ou "30 nov a 6 dez".
  function weekLabel(start) {
    var a = start.split('-').map(Number), b = C.addDays(start, 6).split('-').map(Number);
    return a[1] === b[1] ? a[2] + ' a ' + b[2] + ' de ' + MONTHS[b[1] - 1] : a[2] + ' ' + MONTHS[a[1] - 1] + ' a ' + b[2] + ' ' + MONTHS[b[1] - 1];
  }
  function dayName(key) { return WEEKDAY_FULL[C.weekday(key)]; }

  /* ---------------- Dados ---------------- */

  // Reconstrói o objeto guardado, descartando o que não faz sentido (dados antigos, backup editado à mão).
  function clean(raw) {
    var out = { plans: {}, checked: {}, extra: {} };
    if (!isObj(raw)) return out;
    if (isObj(raw.plans)) {
      Object.keys(raw.plans).forEach(function (d) {
        if (!C.isDateKey(d) || !isObj(raw.plans[d])) return;
        var day = {};
        SLOTS.forEach(function (k) { var id = raw.plans[d][k]; if (typeof id === 'string' && id) day[k] = id; });
        if (Object.keys(day).length) out.plans[d] = day;
      });
    }
    if (isObj(raw.checked)) {
      Object.keys(raw.checked).forEach(function (k) {
        var i = k.indexOf('|');
        if (raw.checked[k] === true && i === 10 && C.isDateKey(k.slice(0, 10)) && k.length > 11) out.checked[k] = true;
      });
    }
    if (isObj(raw.extra)) {
      Object.keys(raw.extra).forEach(function (w) {
        if (!C.isDateKey(w) || !Array.isArray(raw.extra[w])) return;
        var list = raw.extra[w].filter(function (x) { return isObj(x) && typeof x.id === 'string' && x.id && typeof x.name === 'string' && x.name.trim(); })
          .slice(0, EXTRA_MAX).map(function (x) { return { id: x.id, name: x.name.trim().slice(0, 60), done: x.done === true }; });
        if (list.length) out.extra[w] = list;
      });
    }
    return out;
  }
  // Leitura sem alterar nada.
  function read(state) { return clean(state && state.extras && state.extras.planejador); }
  // Para alterar: guarda a versão limpa e devolve o objeto guardado.
  function ensure(state) {
    if (!isObj(state.extras)) state.extras = {};
    state.extras.planejador = clean(state.extras.planejador);
    return state.extras.planejador;
  }
  // Tira planos e marcas de semanas muito antigas (para o backup não crescer).
  function prune(state, today) {
    var ex = ensure(state), limit = C.addDays(today, -KEEP_DAYS), n = 0;
    Object.keys(ex.plans).forEach(function (d) { if (d < limit) { delete ex.plans[d]; n++; } });
    Object.keys(ex.checked).forEach(function (k) { if (k.slice(0, 10) < limit) { delete ex.checked[k]; n++; } });
    Object.keys(ex.extra).forEach(function (w) { if (w < limit) { delete ex.extra[w]; n++; } });
    return n;
  }
  function savedMeal(state, id) { return R.byId(state.savedMeals || [], id); }

  /* ---------------- Plano do dia ---------------- */

  // Refeições do dia na tela do cardápio: as cadastradas em Horários (menos "Outro"), as que já têm plano
  // e as 4 principais. Na ordem do dia.
  function slotsOfDay(state, date, ex) {
    var out = [], seen = {};
    R.mealOccurrencesOn(state, date).forEach(function (o) {
      var t = o.meal.type;
      if (o.skipped || seen[t] || !isSlot(t)) return;
      seen[t] = true;
      out.push({ type: t, name: o.meal.name, time: o.time });
    });
    var plan = ((ex || read(state)).plans[date]) || {};
    SLOTS.forEach(function (t) { if (plan[t] && !seen[t]) { seen[t] = true; out.push({ type: t, name: C.MEAL_TYPES[t], time: null }); } });
    DEFAULT_SLOTS.forEach(function (t) { if (!seen[t]) { seen[t] = true; out.push({ type: t, name: C.MEAL_TYPES[t], time: null }); } });
    return out.sort(function (a, b) { return SLOTS.indexOf(a.type) - SLOTS.indexOf(b.type); });
  }
  function planOf(state, date) { return Object.assign({}, read(state).plans[date] || {}); }

  function setSlot(state, date, slot, mealId) {
    if (!C.isDateKey(date) || !isSlot(slot)) return false;
    var ex = ensure(state);
    if (mealId) {
      if (!savedMeal(state, mealId)) return false;
      (ex.plans[date] = ex.plans[date] || {})[slot] = mealId;
    } else if (ex.plans[date]) {
      delete ex.plans[date][slot];
      if (!Object.keys(ex.plans[date]).length) delete ex.plans[date];
    }
    return true;
  }

  // Totais do dia planejado (refeições removidas não contam). "ex" é opcional (evita reler o estado).
  function dayTotals(state, date, ex) {
    var plan = ((ex || read(state)).plans[date]) || {}, rows = [], planned = 0, gone = 0;
    SLOTS.forEach(function (slot) {
      if (!plan[slot]) return;
      var m = savedMeal(state, plan[slot]);
      if (!m) { gone++; return; }
      planned++;
      rows.push(N.savedMealTotals(state, m));
    });
    var t = N.sum(rows);
    return { kcal: t.kcal || 0, prot: t.prot || 0, carb: t.carb || 0, lip: t.lip || 0, fibra: t.fibra || 0, planned: planned, gone: gone };
  }

  /* ---------------- Copiar, repetir, sugerir, limpar ---------------- */

  // Copia o plano de um dia para outro (devolve quantos horários mudaram). Sem "overwrite", o que já está planejado no destino fica como está.
  function copyDay(state, from, to, overwrite) {
    if (from === to) return 0;
    var src = planOf(state, from), n = 0;
    Object.keys(src).forEach(function (slot) {
      var have = planOf(state, to)[slot];
      if (have === src[slot] || (have && !overwrite)) return;   // igual ou já planejado (e sem substituir): não conta
      if (setSlot(state, to, slot, src[slot])) n++;
    });
    return n;
  }
  function copyDayTo(state, from, targets, overwrite) {
    return targets.reduce(function (a, d) { return a + copyDay(state, from, d, overwrite); }, 0);
  }
  // Repete uma semana (segunda a domingo) em outra.
  function repeatWeek(state, fromStart, toStart, overwrite) {
    var n = 0;
    for (var i = 0; i < 7; i++) n += copyDay(state, C.addDays(fromStart, i), C.addDays(toStart, i), overwrite);
    return n;
  }
  function weekHasPlan(state, start) {
    var ex = read(state);
    return weekDays(start).some(function (d) { return !!ex.plans[d]; });
  }
  // Preenche as refeições vazias com refeições salvas do MESMO tipo, em rodízio (as mais usadas primeiro).
  // Nunca mexe no que já foi escolhido. opts.from: não preenche dias anteriores a essa data.
  function suggest(state, start, opts) {
    opts = opts || {};
    var pool = {}, idx = {}, filled = 0;
    SLOTS.forEach(function (t) {
      pool[t] = (state.savedMeals || []).filter(function (m) { return m.meal === t && m.items && m.items.length; })
        .sort(function (a, b) { return (b.uses || 0) - (a.uses || 0) || String(a.name).localeCompare(String(b.name)); });
      idx[t] = 0;
    });
    weekDays(start).forEach(function (d) {
      if (opts.from && d < opts.from) return;
      slotsOfDay(state, d).forEach(function (sl) {
        if (planOf(state, d)[sl.type] || !pool[sl.type] || !pool[sl.type].length) return;
        var m = pool[sl.type][idx[sl.type] % pool[sl.type].length];
        idx[sl.type]++;
        if (setSlot(state, d, sl.type, m.id)) filled++;
      });
    });
    return filled;
  }
  function clearWeek(state, start) {
    var n = 0;
    weekDays(start).forEach(function (d) { Object.keys(planOf(state, d)).forEach(function (slot) { setSlot(state, d, slot, null); n++; }); });
    return n;
  }
  // Guarda e devolve os planos para "Desfazer".
  function snapshot(state) { return JSON.parse(JSON.stringify(read(state))); }
  function restore(state, snap) { state.extras = isObj(state.extras) ? state.extras : {}; state.extras.planejador = clean(snap); }

  /* ---------------- Aplicar ao Diário ---------------- */

  // Refeições planejadas do dia em que o Diário já tem alimentos (para perguntar antes de duplicar).
  function diaryConflicts(state, date) {
    var plan = planOf(state, date);
    return SLOTS.filter(function (slot) {
      return plan[slot] && state.foodLogs.some(function (l) { return l.date === date && l.meal === slot; });
    });
  }
  // Coloca no Diário as refeições planejadas do dia. skipConflicts: pula as que já têm alimento naquela refeição.
  function applyDay(state, date, nowISO, opts) {
    opts = opts || {};
    var plan = planOf(state, date), skip = opts.skipConflicts ? diaryConflicts(state, date) : [];
    var out = { date: date, applied: 0, skipped: skip.length, gone: 0, logs: [], used: [], kcal: 0 };
    SLOTS.forEach(function (slot) {
      var id = plan[slot];
      if (!id || skip.indexOf(slot) >= 0) return;
      var res = N.applySavedMeal(state, id, date, slot, nowISO);
      if (!res) { out.gone++; return; }
      if (res.logs.length) { out.applied++; out.used.push(id); }
      res.logs.forEach(function (l) { out.logs.push(l); out.kcal += N.logNutrients(state, l).kcal || 0; });
    });
    return out;
  }
  function applyWeek(state, start, nowISO, opts) {
    var out = { applied: 0, skipped: 0, gone: 0, logs: [], used: [], kcal: 0 };
    weekDays(start).forEach(function (d) {
      var r = applyDay(state, d, nowISO, opts);
      out.applied += r.applied; out.skipped += r.skipped; out.gone += r.gone; out.kcal += r.kcal;
      out.logs = out.logs.concat(r.logs); out.used = out.used.concat(r.used);
    });
    return out;
  }
  // Desfaz applyDay/applyWeek: tira os alimentos e devolve a contagem de uso das refeições salvas.
  function undoApply(state, res) {
    res.logs.forEach(function (l) { N.deleteFoodLog(state, l.id); });
    res.used.forEach(function (id) { var m = savedMeal(state, id); if (m && m.uses) m.uses--; });
  }

  /* ---------------- Lista de compras ---------------- */

  function checkedKey(start, foodId) { return start + '|' + foodId; }

  // Quantidade em unidades usando uma porção salva do alimento (a maior porção que cabe no total).
  function unitsFor(state, foodId, grams) {
    var best = null;
    N.portions(state, foodId).forEach(function (p) {
      if (!(p.grams >= 5) || p.grams > grams + 1e-9) return;
      if (!best || p.grams > best.grams) best = p;
    });
    if (!best) return null;
    return { n: Math.round(grams / best.grams * 2) / 2, label: best.label, grams: best.grams };
  }
  function groupCmp(a, b) {
    if (a === 'Meus alimentos') return 1;
    if (b === 'Meus alimentos') return -1;
    return a.localeCompare(b, 'pt-BR');
  }

  // Soma os alimentos de todas as refeições planejadas nos dias escolhidos (opts.days; padrão: a semana toda).
  function shoppingList(state, start, opts) {
    opts = opts || {};
    var days = opts.days && opts.days.length ? opts.days : weekDays(start), ex = read(state);
    var tot = {}, plannedMeals = 0, missingMeals = 0, missingFoods = 0;
    days.forEach(function (d) {
      var plan = ex.plans[d] || {};
      SLOTS.forEach(function (slot) {
        if (!plan[slot]) return;
        var m = savedMeal(state, plan[slot]);
        if (!m) { missingMeals++; return; }
        plannedMeals++;
        m.items.forEach(function (it) {
          var f = N.foodById(state, it.foodId);
          if (!f) { missingFoods++; return; }
          var e = tot[it.foodId] || (tot[it.foodId] = { foodId: it.foodId, name: f.name, group: f.group || 'Outros', grams: 0, times: 0 });
          e.grams += Number(it.grams) || 0; e.times++;
        });
      });
    });
    var byGroup = {}, count = 0, checked = 0;
    Object.keys(tot).forEach(function (id) {
      var e = tot[id];
      e.grams = round1(e.grams);
      e.units = unitsFor(state, id, e.grams);
      e.key = checkedKey(start, id);
      e.checked = !!ex.checked[e.key];
      count++; if (e.checked) checked++;
      (byGroup[e.group] = byGroup[e.group] || []).push(e);
    });
    var groups = Object.keys(byGroup).sort(groupCmp).map(function (g) {
      return { group: g, items: byGroup[g].sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); }) };
    });
    var extras = (ex.extra[start] || []).map(function (x) { return Object.assign({}, x); });
    var extrasDone = extras.filter(function (x) { return x.done; }).length;
    return {
      start: start, days: days, groups: groups, extras: extras,
      count: count + extras.length, checked: checked + extrasDone, foods: count,
      plannedMeals: plannedMeals, missingMeals: missingMeals, missingFoods: missingFoods
    };
  }

  function toggleChecked(state, start, foodId) {
    var ex = ensure(state), k = checkedKey(start, foodId);
    if (ex.checked[k]) { delete ex.checked[k]; return false; }
    ex.checked[k] = true;
    return true;
  }
  // "Limpar marcados": desmarca os alimentos da semana e tira da lista os itens manuais já marcados.
  function clearMarked(state, start) {
    var ex = ensure(state), n = 0;
    Object.keys(ex.checked).forEach(function (k) { if (k.slice(0, 10) === start) { delete ex.checked[k]; n++; } });
    if (ex.extra[start]) {
      var keep = ex.extra[start].filter(function (x) { return !x.done; });
      n += ex.extra[start].length - keep.length;
      if (keep.length) ex.extra[start] = keep; else delete ex.extra[start];
    }
    return n;
  }
  function addExtra(state, start, name) {
    name = String(name == null ? '' : name).trim().slice(0, 60);
    if (!name || !C.isDateKey(start)) return null;
    var ex = ensure(state), list = ex.extra[start] || (ex.extra[start] = []);
    if (list.length >= EXTRA_MAX) return null;
    var it = { id: C.uuid(), name: name, done: false };
    list.push(it);
    return it;
  }
  function toggleExtra(state, start, id) {
    var ex = ensure(state), it = (ex.extra[start] || []).filter(function (x) { return x.id === id; })[0];
    if (!it) return null;
    it.done = !it.done;
    return it.done;
  }
  function removeExtra(state, start, id) {
    var ex = ensure(state), list = ex.extra[start] || [];
    var i = list.findIndex(function (x) { return x.id === id; });
    if (i >= 0) list.splice(i, 1);
    if (!list.length) delete ex.extra[start];
  }

  /* ---------------- Texto da lista (compartilhar) ---------------- */

  function fmtGrams(g) {
    g = Number(g) || 0;
    if (g >= 1000) return (Math.round(g / 10) / 100).toString().replace('.', ',') + ' kg';
    return String(round1(g)).replace('.', ',') + ' g';
  }
  function itemQty(e) {
    return fmtGrams(e.grams) + (e.units && e.units.n >= 1 ? ' (≈ ' + String(e.units.n).replace('.', ',') + ' × ' + e.units.label + ')' : '');
  }
  function listText(list) {
    var lines = ['Lista de compras — ' + weekLabel(list.start), ''];
    list.groups.forEach(function (g) {
      lines.push(g.group);
      g.items.forEach(function (e) { lines.push((e.checked ? '✔ ' : '☐ ') + String(e.name).replace(/\s*,\s*/g, ', ') + ' — ' + itemQty(e)); });
      lines.push('');
    });
    if (list.extras.length) {
      lines.push('Outros');
      list.extras.forEach(function (x) { lines.push((x.done ? '✔ ' : '☐ ') + x.name); });
      lines.push('');
    }
    lines.push('Feito no J.S.');
    return lines.join('\n');
  }

  return {
    SLOTS: SLOTS, DEFAULT_SLOTS: DEFAULT_SLOTS, WEEKDAY_FULL: WEEKDAY_FULL, EXTRA_MAX: EXTRA_MAX, KEEP_DAYS: KEEP_DAYS,
    isSlot: isSlot, mondayOf: mondayOf, weekDays: weekDays, weekLabel: weekLabel, dayName: dayName,
    clean: clean, read: read, ensure: ensure, prune: prune,
    slotsOfDay: slotsOfDay, planOf: planOf, setSlot: setSlot, dayTotals: dayTotals,
    copyDay: copyDay, copyDayTo: copyDayTo, repeatWeek: repeatWeek, weekHasPlan: weekHasPlan, suggest: suggest, clearWeek: clearWeek,
    snapshot: snapshot, restore: restore,
    diaryConflicts: diaryConflicts, applyDay: applyDay, applyWeek: applyWeek, undoApply: undoApply,
    checkedKey: checkedKey, unitsFor: unitsFor, shoppingList: shoppingList, toggleChecked: toggleChecked, clearMarked: clearMarked,
    addExtra: addExtra, toggleExtra: toggleExtra, removeExtra: removeExtra,
    fmtGrams: fmtGrams, itemQty: itemQty, listText: listText
  };
});
