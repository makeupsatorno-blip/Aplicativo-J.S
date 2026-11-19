// Testes da versão 2.7: recordes pessoais, meta de proteína e refeições salvas.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const R = require('../js/regras.js');
const T = require('../js/regras-treino.js');
const N = require('../js/regras-nutricao.js');

const NOW = '2026-11-10T12:00:00.000Z';
const iso = (min) => new Date(Date.parse(NOW) + min * 60000).toISOString();

/* ---------------- Recordes pessoais ---------------- */

// Faz um treino de um exercício com as séries [[carga, reps], ...] numa data.
function train(s, date, sets, opts) {
  opts = opts || {};
  const ex = opts.ex || 'ex:leg-press';
  let x = T.startSession(s, date, null, iso(Date.parse(date) / 60000 % 100000));
  const it = T.addSessionExercise(s, x.id, ex);
  sets.forEach(([load, reps], k) => {
    T.setItemValues(s, x.id, it.id, { load, reps });
    T.logSet(s, x.id, it.id, iso(1 + k));
  });
  if (!opts.active) T.finishSession(s, x.id, iso(30));
  return { session: x, item: it };
}

test('recordes: o primeiro treino não conta; mais carga e mais repetições com a mesma carga contam', () => {
  const s = R.emptyState();
  train(s, '2026-11-01', [[80, 10]]);                       // 1ª vez: sem recorde
  const t2 = train(s, '2026-11-04', [[80, 12], [90, 8]]);   // 80x12 = mais reps com 80; 90 = carga
  train(s, '2026-11-07', [[85, 10]]);                       // abaixo do recorde de carga e sem histórico com 85
  const rec = T.exerciseRecords(s, 'ex:leg-press');
  assert.deepEqual(rec.events.map((e) => [e.date, e.kind, e.load, e.reps]), [['2026-11-04', 'reps', 80, 12], ['2026-11-04', 'carga', 90, 8]]);
  assert.equal(rec.events[0].prevReps, 10);
  assert.equal(rec.events[1].prevLoad, 80);
  assert.deepEqual(rec.best, { load: 90, reps: 8, date: '2026-11-04' });
  assert.equal(T.exerciseBest(s, 'ex:leg-press').load, 90);
  // resumo do 2º treino: um recorde por exercício, o de carga vale mais
  const sum = T.sessionSummary(s, t2.session);
  assert.equal(sum.prs.length, 1);
  assert.equal(sum.prs[0].kind, 'carga');
  assert.equal(sum.prs[0].load, 90);
  assert.equal(sum.prs[0].prev, 80);
  assert.equal(sum.prs[0].count, 2);
  assert.equal(T.sessionSummary(s, T.doneSessions(s)[2]).prs.length, 0);
});

test('recordes: série igual ou menor, série sem repetição e carga zero', () => {
  const s = R.emptyState();
  train(s, '2026-11-01', [[50, 10]]);
  train(s, '2026-11-03', [[50, 10], [45, 12], [50, 0]]);  // igual, menor e sem repetição: nada
  assert.equal(T.exerciseRecords(s, 'ex:leg-press').events.length, 0);
  // peso do corpo (carga 0): mais repetições conta
  train(s, '2026-11-01', [[0, 10]], { ex: 'ex:flexao' });
  train(s, '2026-11-05', [[0, 12]], { ex: 'ex:flexao' });
  const e = T.exerciseRecords(s, 'ex:flexao').events;
  assert.deepEqual(e.map((x) => [x.kind, x.reps, x.prevReps]), [['reps', 12, 10]]);
});

test('recordes: treino em andamento conta e cada série tem que superar a anterior', () => {
  const s = R.emptyState();
  train(s, '2026-11-01', [[60, 8]]);
  const a = train(s, '2026-11-08', [[65, 8], [65, 8], [70, 6]], { active: true });
  assert.equal(T.recordOf(s, a.session.id, a.item.id, 0).kind, 'carga');   // 65 > 60
  assert.equal(T.recordOf(s, a.session.id, a.item.id, 1), null);           // 65 de novo: não supera o novo recorde
  assert.equal(T.recordOf(s, a.session.id, a.item.id, 2).load, 70);
  assert.equal(T.exerciseBest(s, 'ex:leg-press').load, 70);
  // apagar o treino desfaz os recordes (são calculados do histórico)
  T.discardSession(s, a.session.id);
  assert.equal(T.exerciseRecords(s, 'ex:leg-press').events.length, 0);
});

test('recordes: ordem pela data do treino, não pela hora em que foi registrado', () => {
  const s = R.emptyState();
  train(s, '2026-11-08', [[70, 8]]);
  train(s, '2026-11-02', [[60, 8]]);   // treino antigo registrado depois: é o 1º, não bate nada
  train(s, '2026-11-05', [[65, 8]]);   // bate o de 60, mas fica abaixo do de 70 (que é mais novo)
  const e = T.exerciseRecords(s, 'ex:leg-press').events;
  assert.deepEqual(e.map((x) => [x.date, x.load]), [['2026-11-05', 65], ['2026-11-08', 70]]);
});

test('recordes recentes: um por exercício, só dos últimos dias, e contagem total', () => {
  const s = R.emptyState();
  train(s, '2026-10-01', [[60, 8]]);
  train(s, '2026-11-02', [[65, 8]]);
  train(s, '2026-11-08', [[70, 8]]);
  train(s, '2026-10-01', [[20, 10]], { ex: 'ex:supino-reto' });
  train(s, '2026-11-09', [[25, 10]], { ex: 'ex:supino-reto' });
  const r = T.recentRecords(s, '2026-11-10', 30, 5);
  assert.equal(r.total, 3);
  assert.equal(r.exercises, 2);
  assert.deepEqual(r.list.map((e) => [e.exerciseId, e.load]), [['ex:supino-reto', 25], ['ex:leg-press', 70]]);
  assert.equal(T.recentRecords(s, '2026-11-10', 5, 5).list.length, 2);       // 5 dias: 08 e 09
  assert.equal(T.recentRecords(s, '2026-12-30', 30, 5).list.length, 0);      // nada nos últimos 30 dias
  assert.equal(T.recentRecords(s, '2026-11-10', 30, 1).list.length, 1);      // limite
});

test('estatísticas da semana continuam iguais (sem recordes no caminho)', () => {
  const s = R.emptyState();
  train(s, '2026-11-02', [[60, 10], [60, 10]]);
  train(s, '2026-11-04', [[70, 10]]);
  const w = T.weeklyStats(s, '2026-11-07', 1)[0]; // sábado: a semana vai de 01 a 07/11
  assert.equal(w.count, 2);
  assert.equal(w.volume, 60 * 10 * 2 + 700);
});

/* ---------------- Meta de proteína ---------------- */

test('proteína: meta definida, automática pelo peso (g/kg) e sem peso', () => {
  const s = R.emptyState();
  assert.equal(N.proteinTarget(s), null);                                   // sem peso nem meta
  s.bodyRecords.push({ id: 'b', date: '2026-11-01', weightKg: 62.4 });
  assert.deepEqual(N.proteinTarget(s), { value: 100, source: 'peso', kg: 62.4, perKg: 1.6 }); // 62,4 × 1,6 = 99,8 → 100
  s.settings.nutrition.proteinPerKg = 2.0;
  assert.equal(N.proteinTarget(s).value, 125);                              // 124,8 → 125
  s.settings.nutrition.proteinPerKg = 7;                                    // valor fora da lista: volta ao padrão
  assert.equal(N.proteinTarget(s).perKg, 1.6);
  s.settings.nutrition.proteinTarget = 110;
  assert.deepEqual(N.proteinTarget(s), { value: 110, source: 'manual' });
  s.settings.nutrition.proteinTarget = 5;                                   // inválida: usa a automática
  assert.equal(N.proteinTarget(s).source, 'peso');
  // validação do formulário
  assert.equal(N.validateProtein({ proteinTarget: '', proteinPerKg: '1.8' }).value.proteinTarget, null);
  assert.equal(N.validateProtein({ proteinTarget: '95', proteinPerKg: '1.8' }).value.proteinPerKg, 1.8);
  assert.ok(N.validateProtein({ proteinTarget: '900' }).errors.proteinTarget);
  assert.ok(N.validateProtein({ proteinTarget: '10' }).errors.proteinTarget);
});

test('proteína do dia: total, quanto falta e quanto veio de cada refeição', () => {
  const s = R.emptyState();
  s.settings.nutrition.proteinTarget = 100;
  const frango = N.search(s, 'frango', 1)[0], ovo = N.search(s, 'ovo', 1)[0];
  N.addFoodLog(s, { date: '2026-11-10', meal: 'breakfast', foodId: ovo.id, grams: 100 }, NOW);
  N.addFoodLog(s, { date: '2026-11-10', meal: 'lunch', foodId: frango.id, grams: 150 }, NOW);
  const r = N.proteinReport(s, '2026-11-10');
  const total = N.dayLog(s, '2026-11-10').total.prot;
  assert.ok(Math.abs(r.eaten - total) < 1e-9 && r.eaten > 20);
  assert.equal(r.left, Math.round(100 - r.eaten));
  assert.equal(r.reached, false);
  assert.deepEqual(r.meals.map((m) => m.meal), ['breakfast', 'lunch']);
  assert.equal(r.pct, Math.round(r.eaten));
  s.settings.nutrition.proteinTarget = 20;
  assert.equal(N.proteinReport(s, '2026-11-10').reached, true);
  assert.equal(N.proteinReport(s, '2026-11-10').pct, 100);
  assert.equal(N.proteinReport(s, '2026-11-09').eaten, 0);
});

/* ---------------- Refeições salvas ---------------- */

function foods(s) { return { ovo: N.search(s, 'ovo', 1)[0], pao: N.search(s, 'pão', 1)[0], banana: N.search(s, 'banana', 1)[0] }; }

test('refeições salvas: validar, criar, editar, excluir e limites', () => {
  const s = R.emptyState(), f = foods(s);
  assert.ok(N.validateSavedMeal({ name: '', meal: 'breakfast', items: [] }).errors.name);
  assert.ok(N.validateSavedMeal({ name: 'Meu café', meal: 'breakfast', items: [] }).errors.items);
  assert.ok(N.validateSavedMeal({ name: 'x', meal: 'breakfast', items: [{ foodId: f.ovo.id, grams: 0 }, { foodId: '', grams: 50 }] }).errors.items);
  const v = N.validateSavedMeal({ name: '  Meu café da manhã  ', meal: 'breakfast', items: [{ foodId: f.ovo.id, grams: '100,5' }, { foodId: f.pao.id, grams: 50 }] });
  assert.equal(v.ok, true);
  assert.equal(v.value.name, 'Meu café da manhã');
  assert.equal(v.value.items[0].grams, 100.5);
  assert.equal(N.validateSavedMeal({ name: 'x', meal: 'inventado', items: v.value.items }).value.meal, 'other');
  const m = N.createSavedMeal(s, v.value, NOW);
  assert.equal(s.savedMeals.length, 1);
  assert.equal(m.uses, 0);
  const v2 = N.validateSavedMeal({ name: 'Café reforçado', meal: 'breakfast', items: [{ foodId: f.banana.id, grams: 80 }] });
  N.updateSavedMeal(s, m.id, v2.value, NOW);
  assert.equal(s.savedMeals[0].name, 'Café reforçado');
  assert.equal(s.savedMeals[0].items.length, 1);
  N.deleteSavedMeal(s, m.id);
  assert.equal(s.savedMeals.length, 0);
  // limite de refeições salvas
  for (let i = 0; i < N.SAVED_MAX; i++) assert.ok(N.createSavedMeal(s, v.value, NOW));
  assert.equal(N.createSavedMeal(s, v.value, NOW), null);
  // limite de alimentos por refeição
  const many = Array.from({ length: 50 }, () => ({ foodId: f.ovo.id, grams: 10 }));
  assert.equal(N.validateSavedMeal({ name: 'x', meal: 'lunch', items: many }).value.items.length, N.SAVED_ITEMS_MAX);
});

test('refeições salvas: totais, adicionar ao diário num toque, desfazer e ordem das sugestões', () => {
  const s = R.emptyState(), f = foods(s);
  const cafe = N.createSavedMeal(s, N.validateSavedMeal({ name: 'Meu café', meal: 'breakfast', items: [{ foodId: f.ovo.id, grams: 100 }, { foodId: f.pao.id, grams: 50 }] }).value, NOW);
  const lanche = N.createSavedMeal(s, N.validateSavedMeal({ name: 'Meu lanche', meal: 'afternoon_snack', items: [{ foodId: f.banana.id, grams: 100 }] }).value, NOW);
  const t = N.savedMealTotals(s, cafe);
  const esperado = N.scale(f.ovo.per100, 100).kcal + N.scale(f.pao.per100, 50).kcal;
  assert.ok(Math.abs(t.kcal - esperado) < 1e-9);
  assert.equal(t.count, 2);
  assert.equal(t.missing, 0);
  // adicionar: vai para a refeição pedida (ou a da refeição salva)
  const r = N.applySavedMeal(s, cafe.id, '2026-11-10', 'breakfast', iso(5));
  assert.equal(r.logs.length, 2);
  assert.equal(N.dayLog(s, '2026-11-10').count, 2);
  assert.equal(cafe.uses, 1);
  assert.equal(cafe.lastUsedAt, iso(5));
  const r2 = N.applySavedMeal(s, lanche.id, '2026-11-10', null, iso(6));
  assert.equal(r2.meal, 'afternoon_snack');
  assert.equal(N.dayLog(s, '2026-11-10').meals.length, 2);
  assert.equal(N.applySavedMeal(s, 'nao-existe', '2026-11-10', 'lunch', NOW), null);
  // ordem: as do tipo da refeição primeiro; depois as mais usadas
  assert.deepEqual(N.savedMealsFor(s, 'afternoon_snack').map((m) => m.name), ['Meu lanche', 'Meu café']);
  assert.deepEqual(N.savedMealsFor(s, 'breakfast').map((m) => m.name), ['Meu café', 'Meu lanche']);
  // alimento que deixou de existir (alimento criado e depois apagado): pula e avisa
  const custom = N.createCustomFood(s, N.validateCustomFood({ name: 'Bolo da vó', kcal: '300', carb: '40', prot: '5', lip: '10' }).value, NOW);
  const m3 = N.createSavedMeal(s, N.validateSavedMeal({ name: 'Com bolo', meal: 'lunch', items: [{ foodId: custom.id, grams: 100 }, { foodId: f.ovo.id, grams: 50 }] }).value, NOW);
  s.customFoods = [];
  assert.equal(N.savedMealTotals(s, m3).missing, 1);
  const r3 = N.applySavedMeal(s, m3.id, '2026-11-11', 'lunch', NOW);
  assert.equal(r3.logs.length, 1);
  assert.equal(r3.missing, 1);
});

test('refeições salvas: salvar o que está no Diário e seguir no backup', () => {
  const s = R.emptyState(), f = foods(s);
  N.addFoodLog(s, { date: '2026-11-10', meal: 'breakfast', foodId: f.ovo.id, grams: 120 }, NOW);
  N.addFoodLog(s, { date: '2026-11-10', meal: 'breakfast', foodId: f.pao.id, grams: 50 }, NOW);
  N.addFoodLog(s, { date: '2026-11-10', meal: 'lunch', foodId: f.banana.id, grams: 100 }, NOW);
  const items = N.savedItemsFromDay(s, '2026-11-10', 'breakfast');
  assert.deepEqual(items, [{ foodId: f.ovo.id, grams: 120 }, { foodId: f.pao.id, grams: 50 }]);
  N.createSavedMeal(s, N.validateSavedMeal({ name: 'Meu café', meal: 'breakfast', items }).value, NOW);
  // passa pela migração (backup/restaurar/transferir) sem perder nada e limpa itens inválidos
  const back = R.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(back.savedMeals.length, 1);
  assert.equal(back.savedMeals[0].items.length, 2);
  const sujo = R.migrate({ schemaVersion: 2, savedMeals: [{ id: 'a', name: 'X', items: [{ foodId: 'z', grams: 10 }, { foodId: '', grams: 5 }, { foodId: 'y', grams: 0 }, null] }, { nome: 'sem id' }, 3] });
  assert.equal(sujo.savedMeals.length, 1);
  assert.deepEqual(sujo.savedMeals[0].items, [{ foodId: 'z', grams: 10 }]);
  assert.deepEqual(R.migrate({ schemaVersion: 2 }).savedMeals, []);
  assert.equal(R.migrate({ schemaVersion: 2 }).settings.nutrition.proteinPerKg, 1.6);
  assert.equal(R.hasAnyData(R.migrate({ schemaVersion: 2, savedMeals: [{ id: 'a', name: 'X', items: [] }] })), true);
});
