/*
 * J.S. — regras de Nutrição: busca na Tabela TACO, nutrientes por porção, diário alimentar,
 * meta de calorias e sugestões de cardápio.
 * As sugestões são gerais e não substituem a orientação de uma nutricionista.
 */
(function (root, factory) {
  var req = typeof require === 'function';
  var C = root && root.JSCore ? root.JSCore : (req ? require('./core.js') : null);
  var R = root && root.JSRegras ? root.JSRegras : (req ? require('./regras.js') : null);
  var A = root && root.JSAlimentos ? root.JSAlimentos : (req ? require('./dados/alimentos.js') : null);
  var M = root && root.JSCardapios ? root.JSCardapios : (req ? safeRequire('./dados/cardapios.js') : null);
  function safeRequire(p) { try { return require(p); } catch (e) { return null; } }
  var api = factory(C, R, A, M);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSNutri = api;
})(typeof self !== 'undefined' ? self : this, function (C, R, A, M) {
  'use strict';

  // Nutrientes mostrados (na ordem da tabela nutricional).
  var NUTRIENTS = [
    { key: 'kcal', label: 'Energia', unit: 'kcal', dec: 0 },
    { key: 'carb', label: 'Carboidratos', unit: 'g', dec: 1 },
    { key: 'prot', label: 'Proteínas', unit: 'g', dec: 1 },
    { key: 'lip', label: 'Gorduras totais', unit: 'g', dec: 1 },
    { key: 'gsat', label: 'Gorduras saturadas', unit: 'g', dec: 1 },
    { key: 'fibra', label: 'Fibra alimentar', unit: 'g', dec: 1 },
    { key: 'sodio', label: 'Sódio', unit: 'mg', dec: 0 },
    { key: 'colesterol', label: 'Colesterol', unit: 'mg', dec: 0 },
    { key: 'calcio', label: 'Cálcio', unit: 'mg', dec: 0 },
    { key: 'ferro', label: 'Ferro', unit: 'mg', dec: 1 },
    { key: 'magnesio', label: 'Magnésio', unit: 'mg', dec: 0 },
    { key: 'fosforo', label: 'Fósforo', unit: 'mg', dec: 0 },
    { key: 'potassio', label: 'Potássio', unit: 'mg', dec: 0 },
    { key: 'zinco', label: 'Zinco', unit: 'mg', dec: 1 },
    { key: 'vitc', label: 'Vitamina C', unit: 'mg', dec: 1 },
    { key: 'retinol', label: 'Vitamina A (retinol)', unit: 'µg', dec: 0 },
    { key: 'tiamina', label: 'Tiamina (B1)', unit: 'mg', dec: 2 },
    { key: 'riboflavina', label: 'Riboflavina (B2)', unit: 'mg', dec: 2 },
    { key: 'piridoxina', label: 'Piridoxina (B6)', unit: 'mg', dec: 2 },
    { key: 'niacina', label: 'Niacina (B3)', unit: 'mg', dec: 2 }
  ];
  var MAIN = ['kcal', 'carb', 'prot', 'lip', 'fibra'];
  var ACTIVITY = { sedentaria: ['Sedentária', 1.2], leve: ['Leve (1–3x/semana)', 1.375], moderada: ['Moderada (3–5x/semana)', 1.55], intensa: ['Intensa (6–7x/semana)', 1.725] };
  // Divisão da meta do dia entre as refeições (proporções normalizadas pelas refeições existentes).
  var MEAL_SHARE = { breakfast: 0.22, morning_snack: 0.08, lunch: 0.32, afternoon_snack: 0.1, dinner: 0.23, supper: 0.05, other: 0.08 };
  var MEAL_ORDER = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper', 'other'];

  /* ---------------- Tabela de alimentos ---------------- */

  var FIELDS = A ? A.campos : [];
  var IDX = {};
  FIELDS.forEach(function (f, i) { IDX[f] = i; });
  var byTaco = {}, list = [];
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  (A ? A.itens : []).forEach(function (row) {
    var per100 = {};
    NUTRIENTS.forEach(function (n) { per100[n.key] = IDX[n.key] != null ? row[IDX[n.key]] : null; });
    var f = { id: 'taco:' + row[IDX.id], name: row[IDX.nome], group: A.grupos[row[IDX.grupo]] || '', per100: per100, source: 'TACO' };
    f.key = fold(f.name);
    byTaco[f.id] = f;
    list.push(f);
  });

  function foodById(state, id) {
    if (byTaco[id]) return byTaco[id];
    var c = R.byId((state && state.customFoods) || [], id);
    return c ? { id: c.id, name: c.name, group: 'Meus alimentos', per100: c.per100, source: 'custom', key: fold(c.name) } : null;
  }
  function foodByName(name) {
    var k = fold(name);
    for (var i = 0; i < list.length; i++) if (list[i].key === k) return list[i];
    return null;
  }

  // Busca sem acento, por palavras ("ovo cozido", "arroz integral").
  // Ordena: começa com a busca > primeira palavra igual > nomes curtos (mais genéricos).
  function search(state, query, limit) {
    var q = fold(query);
    if (!q) return [];
    var words = q.split(' ');
    var custom = ((state && state.customFoods) || []).map(function (c) { return foodById(state, c.id); });
    var all = custom.concat(list), out = [];
    all.forEach(function (f) {
      for (var i = 0; i < words.length; i++) if (f.key.indexOf(words[i]) < 0) return;
      var score = (f.key.indexOf(q) === 0 ? 0 : f.key.split(' ')[0] === words[0] ? 1 : 2) * 1000 + f.key.length + (f.source === 'custom' ? -500 : 0);
      out.push({ f: f, s: score });
    });
    out.sort(function (a, b) { return a.s - b.s; });
    return out.slice(0, limit || 30).map(function (x) { return x.f; });
  }

  function scale(per100, grams) {
    var out = {};
    NUTRIENTS.forEach(function (n) {
      var v = per100 ? per100[n.key] : null;
      out[n.key] = v == null ? null : v * grams / 100;
    });
    return out;
  }
  // Soma nutrientes; "partial" marca quando algum alimento não tinha o valor (fica sabendo que é parcial).
  function sum(items) {
    var out = {}, partial = {};
    NUTRIENTS.forEach(function (n) { out[n.key] = null; partial[n.key] = false; });
    items.forEach(function (it) {
      NUTRIENTS.forEach(function (n) {
        var v = it[n.key];
        if (v == null) { partial[n.key] = true; return; }
        out[n.key] = (out[n.key] || 0) + v;
      });
    });
    out.partial = partial;
    return out;
  }
  function fmt(v, key) {
    if (v == null) return '—';
    var n = null;
    for (var i = 0; i < NUTRIENTS.length; i++) if (NUTRIENTS[i].key === key) n = NUTRIENTS[i];
    var dec = n ? n.dec : 1;
    var r = Number(v.toFixed(dec));
    return r.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec });
  }
  // Porcentagem das calorias que vem de carboidratos, proteínas e gorduras (4, 4 e 9 kcal/g).
  function macroSplit(t) {
    var c = (t.carb || 0) * 4, p = (t.prot || 0) * 4, g = (t.lip || 0) * 9, tot = c + p + g;
    if (!tot) return null;
    return { carb: Math.round(c / tot * 100), prot: Math.round(p / tot * 100), lip: Math.round(g / tot * 100) };
  }

  /* ---------------- Alimentos e porções da usuária ---------------- */

  function validateCustomFood(input) {
    var e = {}, per100 = {};
    var name = String(input.name || '').trim().slice(0, 80);
    if (!name) e.name = 'Informe o nome do alimento.';
    NUTRIENTS.forEach(function (n) {
      var raw = input[n.key];
      if (raw === '' || raw == null) { per100[n.key] = null; return; }
      var v = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(v) || v < 0 || v > 10000) e[n.key] = 'Valor inválido.';
      else per100[n.key] = v;
    });
    if (per100.kcal == null && !e.kcal) e.kcal = 'Informe pelo menos as calorias (por 100 g).';
    return { ok: !Object.keys(e).length, errors: e, value: { name: name, per100: per100 } };
  }
  function createCustomFood(state, v, nowISO) {
    var f = { id: 'c:' + C.uuid(), name: v.name, per100: v.per100, createdAt: nowISO, updatedAt: nowISO };
    state.customFoods.push(f);
    return f;
  }
  function portions(state, foodId) { return (state.foodPortions && state.foodPortions[foodId]) || []; }
  function addPortion(state, foodId, label, grams) {
    label = String(label || '').trim().slice(0, 30);
    grams = Number(String(grams).replace(',', '.'));
    if (!label || !(grams > 0 && grams <= 3000)) return false;
    var list = state.foodPortions[foodId] = portions(state, foodId).filter(function (p) { return p.label !== label; });
    list.push({ label: label, grams: Math.round(grams * 10) / 10 });
    return true;
  }
  function removePortion(state, foodId, label) {
    state.foodPortions[foodId] = portions(state, foodId).filter(function (p) { return p.label !== label; });
  }

  /* ---------------- Diário ---------------- */

  function validateFoodLog(input) {
    var e = {};
    var grams = Number(String(input.grams == null ? '' : input.grams).replace(',', '.'));
    var v = { date: String(input.date || ''), meal: C.MEAL_TYPES[input.meal] ? input.meal : 'other', foodId: String(input.foodId || ''), grams: Math.round(grams * 10) / 10 };
    if (!C.isDateKey(v.date)) e.date = 'Data inválida.';
    if (!v.foodId) e.foodId = 'Escolha um alimento.';
    if (!(grams > 0 && grams <= 3000)) e.grams = 'Informe a quantidade em gramas (até 3000 g).';
    return { ok: !Object.keys(e).length, errors: e, value: v };
  }
  function addFoodLog(state, v, nowISO) {
    var f = foodById(state, v.foodId);
    if (!f) return null;
    var l = { id: C.uuid(), date: v.date, meal: v.meal, foodId: v.foodId, name: f.name, grams: v.grams, createdAt: nowISO };
    state.foodLogs.push(l);
    return l;
  }
  function updateFoodLog(state, id, grams, meal) {
    var l = R.byId(state.foodLogs, id);
    if (!l) return null;
    if (grams > 0) l.grams = Math.round(grams * 10) / 10;
    if (meal && C.MEAL_TYPES[meal]) l.meal = meal;
    return l;
  }
  function deleteFoodLog(state, id) { R.removeById(state.foodLogs, id); }

  function logNutrients(state, l) {
    var f = foodById(state, l.foodId);
    return f ? scale(f.per100, l.grams) : scale(null, l.grams);
  }
  // O dia agrupado por refeição (na ordem do dia), com totais de cada refeição e do dia.
  function dayLog(state, date) {
    var groups = {};
    state.foodLogs.filter(function (l) { return l.date === date; }).forEach(function (l) {
      (groups[l.meal] = groups[l.meal] || []).push({ log: l, food: foodById(state, l.foodId), nutr: logNutrients(state, l) });
    });
    var meals = MEAL_ORDER.filter(function (k) { return groups[k]; }).map(function (k) {
      return { meal: k, items: groups[k], total: sum(groups[k].map(function (x) { return x.nutr; })) };
    });
    var all = [];
    meals.forEach(function (m) { m.items.forEach(function (x) { all.push(x.nutr); }); });
    return { date: date, meals: meals, total: sum(all), count: all.length };
  }
  function dailyTotals(state, from, to) {
    var out = [];
    for (var d = from; d <= to; d = C.addDays(d, 1)) { var dl = dayLog(state, d); out.push({ date: d, total: dl.total, count: dl.count }); }
    return out;
  }

  /* ---------------- Meta de calorias ---------------- */

  // Meta definida pela usuária; se não houver, estimativa: metabolismo basal (balança ou
  // fórmula de Mifflin-St Jeor) × nível de atividade.
  function kcalTarget(state, today) {
    var n = state.settings.nutrition || {}, b = state.settings.body || {};
    if (n.kcalTarget) return { value: n.kcalTarget, source: 'manual' };
    var recs = (state.bodyRecords || []).slice().sort(function (a, c) { return a.date < c.date ? 1 : -1; });
    var bmr = null, weight = null;
    recs.forEach(function (r) { if (bmr == null && r.bmrKcal) bmr = r.bmrKcal; if (weight == null && r.weightKg) weight = r.weightKg; });
    var source = 'bioimpedancia';
    if (!bmr && weight && b.heightCm && b.birthYear) {
      var age = Number((today || C.toDateKey(new Date())).slice(0, 4)) - b.birthYear;
      bmr = Math.round(10 * weight + 6.25 * b.heightCm - 5 * age + (b.sex === 'm' ? 5 : -161));
      source = 'formula';
    }
    if (!bmr) return null;
    var f = (ACTIVITY[n.activity] || ACTIVITY.moderada)[1];
    return { value: Math.round(bmr * f / 10) * 10, source: source, bmr: bmr, factor: f };
  }

  /* ---------------- Sugestões de cardápio ---------------- */

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // Refeições do dia: as cadastradas em Horários; se não houver, um dia padrão de 4 refeições.
  function mealsForSuggestions(state, date) {
    var occ = R.mealOccurrencesOn(state, date).filter(function (o) { return !o.skipped; });
    var seen = {}, out = [];
    occ.forEach(function (o) {
      var t = o.meal.type === 'other' ? 'afternoon_snack' : o.meal.type;
      if (seen[t]) return;
      seen[t] = true;
      out.push({ type: t, name: o.meal.name, time: o.time });
    });
    if (!out.length) out = [{ type: 'breakfast' }, { type: 'lunch' }, { type: 'afternoon_snack' }, { type: 'dinner' }];
    return out.map(function (m) { return { type: m.type, name: m.name || C.MEAL_TYPES[m.type], time: m.time || null }; });
  }

  function templatesFor(type) {
    if (!M) return [];
    var key = type === 'morning_snack' || type === 'afternoon_snack' || type === 'supper' ? 'snack' : type;
    return (M.CARDAPIOS[key] || []).map(function (t) {
      return { name: t.nome, items: t.itens.map(function (it) { var f = foodByName(it[0]); return f ? { food: f, grams: it[1], fixed: !!it[2] } : null; }).filter(Boolean) };
    }).filter(function (t) { return t.items.length; });
  }

  // Monta o cardápio do dia: escolhe uma opção por refeição (muda a cada dia e com "outra opção")
  // e ajusta as quantidades para a parte da meta de calorias de cada refeição.
  function suggestMenu(state, date, variants) {
    variants = variants || {};
    var meals = mealsForSuggestions(state, date);
    var target = kcalTarget(state, date);
    var shareTotal = meals.reduce(function (s, m) { return s + (MEAL_SHARE[m.type] || 0.1); }, 0);
    return {
      target: target,
      meals: meals.map(function (m) {
        var tpls = templatesFor(m.type);
        if (!tpls.length) return null;
        var idx = (hash(date + '|' + m.type) + (variants[m.type] || 0)) % tpls.length;
        var tpl = tpls[idx];
        var base = tpl.items.map(function (it) { return scale(it.food.per100, it.grams).kcal || 0; }).reduce(function (a, b) { return a + b; }, 0);
        var goal = target ? target.value * (MEAL_SHARE[m.type] || 0.1) / shareTotal : null;
        var factor = goal && base ? Math.min(1.6, Math.max(0.6, goal / base)) : 1;
        var items = tpl.items.map(function (it) {
          var g = it.fixed ? it.grams : Math.max(5, Math.round(it.grams * factor / 5) * 5);
          return { foodId: it.food.id, name: it.food.name, grams: g, nutr: scale(it.food.per100, g) };
        });
        return { type: m.type, mealName: m.name, time: m.time, option: tpl.name, optionIndex: idx, options: tpls.length, goal: goal ? Math.round(goal) : null,
          items: items, total: sum(items.map(function (x) { return x.nutr; })) };
      }).filter(Boolean)
    };
  }

  return {
    NUTRIENTS: NUTRIENTS, MAIN: MAIN, ACTIVITY: ACTIVITY, MEAL_ORDER: MEAL_ORDER, source: A ? A.fonte : '',
    count: list.length, fold: fold,
    foodById: foodById, foodByName: foodByName, search: search, scale: scale, sum: sum, fmt: fmt, macroSplit: macroSplit,
    validateCustomFood: validateCustomFood, createCustomFood: createCustomFood,
    portions: portions, addPortion: addPortion, removePortion: removePortion,
    validateFoodLog: validateFoodLog, addFoodLog: addFoodLog, updateFoodLog: updateFoodLog, deleteFoodLog: deleteFoodLog,
    logNutrients: logNutrients, dayLog: dayLog, dailyTotals: dailyTotals,
    kcalTarget: kcalTarget, mealsForSuggestions: mealsForSuggestions, templatesFor: templatesFor, suggestMenu: suggestMenu
  };
});
