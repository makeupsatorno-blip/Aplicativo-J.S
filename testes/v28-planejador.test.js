// Testes da frente "Cardápio da semana, lista de compras e código de barras" (versão 2.8).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const R = require('../js/regras.js');
const N = require('../js/regras-nutricao.js');
const P = require('../js/regras-planejador.js');
const B = require('../js/barras.js');

const NOW = '2026-11-23T12:00:00.000Z';
const MON = '2026-11-23'; // segunda-feira

function food(s, q) { return N.search(s, q, 1)[0]; }
function saved(s, name, meal, items) {
  const r = N.validateSavedMeal({ name, meal, items });
  assert.ok(r.ok, JSON.stringify(r.errors));
  return N.createSavedMeal(s, r.value, NOW);
}
// Estado com 3 refeições salvas: café (ovo 100 + pão 50), almoço (arroz 150 + frango 120), almoço 2 (arroz 100).
function base() {
  const s = R.emptyState();
  const f = { ovo: food(s, 'ovo'), pao: food(s, 'pão'), arroz: food(s, 'arroz'), frango: food(s, 'frango') };
  const cafe = saved(s, 'Meu café', 'breakfast', [{ foodId: f.ovo.id, grams: 100 }, { foodId: f.pao.id, grams: 50 }]);
  const almoco = saved(s, 'Meu almoço', 'lunch', [{ foodId: f.arroz.id, grams: 150 }, { foodId: f.frango.id, grams: 120 }]);
  const almoco2 = saved(s, 'Almoço leve', 'lunch', [{ foodId: f.arroz.id, grams: 100 }]);
  return { s, f, cafe, almoco, almoco2 };
}

/* ---------------- Semana ---------------- */

test('semana vai de segunda a domingo, inclusive quando cruza o mês', () => {
  assert.equal(P.mondayOf('2026-11-23'), '2026-11-23');
  assert.equal(P.mondayOf('2026-11-29'), '2026-11-23'); // domingo
  assert.equal(P.mondayOf('2026-12-01'), '2026-11-30'); // terça de uma semana que começa em novembro
  assert.deepEqual(P.weekDays('2026-11-30'), ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
  assert.equal(P.weekLabel('2026-11-23'), '23 a 29 de nov');
  assert.equal(P.weekLabel('2026-11-30'), '30 nov a 6 dez');
  assert.equal(P.weekLabel('2026-12-28'), '28 dez a 3 jan');
  assert.equal(P.dayName('2026-11-23'), 'Segunda');
  assert.equal(P.dayName('2026-11-29'), 'Domingo');
});

test('dados do plano são revalidados (backup antigo ou editado à mão não quebra)', () => {
  const sujo = { plans: { '2026-11-23': { breakfast: 'a', lunch: '', sabado: 'x', dinner: 5 }, 'xx': { lunch: 'a' }, '2026-11-24': 'oi' },
    checked: { '2026-11-23|taco:1': true, '2026-11-23|taco:2': false, 'sem-barra': true, '2026-11-23|': true }, extra: { '2026-11-23': [{ id: 'e1', name: '  café ', done: true }, { id: '', name: 'x' }, null, { id: 'e2', name: '   ' }], lixo: [] } };
  const c = P.clean(sujo);
  assert.deepEqual(c.plans, { '2026-11-23': { breakfast: 'a' } });
  assert.deepEqual(c.checked, { '2026-11-23|taco:1': true });
  assert.deepEqual(c.extra, { '2026-11-23': [{ id: 'e1', name: 'café', done: true }] });
  assert.deepEqual(P.clean(null), { plans: {}, checked: {}, extra: {} });
  // migração do estado mantém o que é válido
  const m = R.migrate({ schemaVersion: 2, extras: { planejador: sujo } });
  assert.deepEqual(P.read(m).plans, { '2026-11-23': { breakfast: 'a' } });
  assert.deepEqual(R.migrate({ schemaVersion: 2 }).extras, {});
});

test('escolher, trocar e limpar a refeição de um horário', () => {
  const { s, cafe, almoco } = base();
  assert.equal(P.setSlot(s, MON, 'breakfast', cafe.id), true);
  assert.equal(P.setSlot(s, MON, 'breakfast', 'nao-existe'), false);   // refeição que não existe
  assert.equal(P.setSlot(s, MON, 'other', cafe.id), false);            // "outro" não é planejável
  assert.equal(P.setSlot(s, 'ontem', 'lunch', cafe.id), false);
  P.setSlot(s, MON, 'lunch', almoco.id);
  assert.deepEqual(P.planOf(s, MON), { breakfast: cafe.id, lunch: almoco.id });
  P.setSlot(s, MON, 'lunch', null);
  P.setSlot(s, MON, 'breakfast', null);
  assert.deepEqual(P.read(s).plans, {});                               // dia vazio some
});

test('horários do dia: os cadastrados, os que têm plano e os 4 principais, na ordem do dia', () => {
  const { s, cafe } = base();
  assert.deepEqual(P.slotsOfDay(s, MON).map((x) => x.type), ['breakfast', 'lunch', 'afternoon_snack', 'dinner']);
  R.createMeal(s, R.validateMeal({ name: 'Ceia da noite', type: 'supper', time: '22:00', weekdays: [0, 1, 2, 3, 4, 5, 6], reminderEnabled: false }).value, NOW);
  R.createMeal(s, R.validateMeal({ name: 'Algo', type: 'other', time: '15:00', weekdays: [0, 1, 2, 3, 4, 5, 6], reminderEnabled: false }).value, NOW);
  P.setSlot(s, MON, 'morning_snack', cafe.id);
  const slots = P.slotsOfDay(s, MON);
  assert.deepEqual(slots.map((x) => x.type), ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper']);
  assert.equal(slots[5].name, 'Ceia da noite');
  assert.equal(slots[5].time, '22:00');
});

test('totais do dia: soma as refeições e ignora a que foi removida', () => {
  const { s, cafe, almoco } = base();
  P.setSlot(s, MON, 'breakfast', cafe.id);
  P.setSlot(s, MON, 'lunch', almoco.id);
  const esperado = N.savedMealTotals(s, cafe).kcal + N.savedMealTotals(s, almoco).kcal;
  let t = P.dayTotals(s, MON);
  assert.ok(Math.abs(t.kcal - esperado) < 1e-9);
  assert.equal(t.planned, 2);
  assert.equal(t.gone, 0);
  N.deleteSavedMeal(s, almoco.id);                                      // a refeição salva foi apagada
  t = P.dayTotals(s, MON);
  assert.equal(t.planned, 1);
  assert.equal(t.gone, 1);
  assert.ok(Math.abs(t.kcal - N.savedMealTotals(s, cafe).kcal) < 1e-9);
  assert.equal(P.planOf(s, MON).lunch, almoco.id);                      // continua referenciada ("removida")
  assert.equal(P.dayTotals(s, '2026-11-24').planned, 0);
});

/* ---------------- Copiar, repetir, sugerir, limpar ---------------- */

test('copiar dia: sem substituir só preenche vazios; com substituir troca', () => {
  const { s, cafe, almoco, almoco2 } = base();
  P.setSlot(s, MON, 'breakfast', cafe.id);
  P.setSlot(s, MON, 'lunch', almoco.id);
  P.setSlot(s, '2026-11-24', 'lunch', almoco2.id);
  assert.equal(P.copyDay(s, MON, '2026-11-24', false), 1);              // só o café (almoço já tinha)
  assert.deepEqual(P.planOf(s, '2026-11-24'), { breakfast: cafe.id, lunch: almoco2.id });
  assert.equal(P.copyDay(s, MON, '2026-11-24', true), 1);               // troca só o almoço (o café já era igual: não conta)
  assert.deepEqual(P.planOf(s, '2026-11-24'), { breakfast: cafe.id, lunch: almoco.id });
  assert.equal(P.copyDay(s, MON, '2026-11-24', true), 0);               // de novo: nada mudou
  assert.equal(P.copyDay(s, MON, MON, true), 0);                         // para o mesmo dia: nada
});

test('copiar dia para vários dias e repetir a semana passada', () => {
  const { s, cafe, almoco } = base();
  P.setSlot(s, MON, 'breakfast', cafe.id);
  P.setSlot(s, MON, 'lunch', almoco.id);
  assert.equal(P.copyDayTo(s, MON, ['2026-11-24', '2026-11-25', MON], false), 4); // copiar para o próprio dia é ignorado
  assert.deepEqual(P.planOf(s, '2026-11-25'), { breakfast: cafe.id, lunch: almoco.id });
  // repetir semana: 23/11 vira 30/11 (cruza o mês)
  const n = P.repeatWeek(s, MON, '2026-11-30', false);
  assert.equal(n, 6);                                                   // segunda, terça e quarta × 2 horários
  assert.deepEqual(P.planOf(s, '2026-11-30'), { breakfast: cafe.id, lunch: almoco.id });
  assert.deepEqual(P.planOf(s, '2026-12-02'), { breakfast: cafe.id, lunch: almoco.id });
  assert.deepEqual(P.planOf(s, '2026-12-03'), {});
  assert.equal(P.weekHasPlan(s, '2026-11-30'), true);
  assert.equal(P.weekHasPlan(s, '2026-12-07'), false);
});

test('sugerir: preenche vazios com refeições do mesmo tipo em rodízio, sem sobrescrever e sem usar tipo errado', () => {
  const { s, cafe, almoco, almoco2 } = base();
  almoco.uses = 5;                                                       // a mais usada vem primeiro
  P.setSlot(s, '2026-11-24', 'lunch', almoco2.id);                       // já escolhido: não mexe
  const n = P.suggest(s, MON, {});
  const plan = (d) => P.planOf(s, d);
  assert.equal(plan(MON).breakfast, cafe.id);                            // só existe 1 café: repete todo dia
  assert.equal(plan(MON).lunch, almoco.id);                              // 1º do rodízio
  assert.equal(plan('2026-11-24').lunch, almoco2.id);                    // preservado
  assert.equal(plan('2026-11-25').lunch, almoco2.id);                    // rodízio continua no 2º
  assert.equal(plan('2026-11-26').lunch, almoco.id);                     // e volta ao 1º
  assert.equal(plan(MON).afternoon_snack, undefined);                    // não há lanche salvo: não inventa
  assert.equal(plan(MON).dinner, undefined);
  assert.equal(n, 7 + 6);                                                // 7 cafés + 6 almoços novos (um já estava)
  // de novo: nada a preencher
  assert.equal(P.suggest(s, MON, {}), 0);
});

test('sugerir a partir de hoje não mexe nos dias anteriores', () => {
  const { s } = base();
  const n = P.suggest(s, MON, { from: '2026-11-26' });
  assert.deepEqual(P.planOf(s, '2026-11-25'), {});
  assert.ok(P.planOf(s, '2026-11-26').breakfast);
  assert.equal(n, 4 * 2);                                                // quinta a domingo: café e almoço
});

test('limpar a semana e desfazer pelo instantâneo', () => {
  const { s, cafe } = base();
  P.suggest(s, MON, {});
  const snap = P.snapshot(s);
  const total = Object.keys(P.read(s).plans).length;
  assert.ok(total >= 7);
  assert.ok(P.clearWeek(s, MON) >= 7);
  assert.equal(P.weekHasPlan(s, MON), false);
  P.restore(s, snap);
  assert.equal(Object.keys(P.read(s).plans).length, total);
  assert.equal(P.planOf(s, MON).breakfast, cafe.id);
});

/* ---------------- Colocar no Diário ---------------- */

test('colocar o dia no Diário, pular o que já tem alimentos e desfazer', () => {
  const { s, cafe, almoco } = base();
  P.setSlot(s, MON, 'breakfast', cafe.id);
  P.setSlot(s, MON, 'lunch', almoco.id);
  N.addFoodLog(s, { date: MON, meal: 'lunch', foodId: food(s, 'banana').id, grams: 80 }, NOW);   // almoço já tem algo
  assert.deepEqual(P.diaryConflicts(s, MON), ['lunch']);
  const skip = P.applyDay(s, MON, NOW, { skipConflicts: true });
  assert.equal(skip.applied, 1);
  assert.equal(skip.skipped, 1);
  assert.equal(N.dayLog(s, MON).count, 1 + 2);                           // banana + ovo + pão
  P.undoApply(s, skip);
  assert.equal(N.dayLog(s, MON).count, 1);
  assert.equal(cafe.uses, 0);                                            // contagem de uso devolvida
  const all = P.applyDay(s, MON, NOW, {});
  assert.equal(all.applied, 2);
  assert.equal(N.dayLog(s, MON).count, 1 + 2 + 2);
  assert.ok(all.kcal > 0);
  // semana
  P.copyDay(s, MON, '2026-11-24', true);
  const w = P.applyWeek(s, MON, NOW, { skipConflicts: true });
  assert.equal(w.applied, 2 + 0);                                        // segunda já tem tudo; terça entra
  assert.equal(w.skipped, 2);
  // refeição removida do plano: não quebra
  N.deleteSavedMeal(s, almoco.id);
  const gone = P.applyDay(s, '2026-11-24', NOW, {});
  assert.equal(gone.gone, 1);
});

/* ---------------- Lista de compras ---------------- */

test('lista de compras: soma o mesmo alimento de várias refeições e agrupa pelo grupo da TACO', () => {
  const { s, f, cafe, almoco, almoco2 } = base();
  P.setSlot(s, MON, 'breakfast', cafe.id);
  P.setSlot(s, MON, 'lunch', almoco.id);               // arroz 150 + frango 120
  P.setSlot(s, '2026-11-24', 'lunch', almoco2.id);     // arroz 100
  P.setSlot(s, '2026-11-24', 'breakfast', cafe.id);
  const list = P.shoppingList(s, MON);
  const byId = {};
  list.groups.forEach((g) => g.items.forEach((e) => { byId[e.foodId] = e; assert.equal(e.group, g.group); }));
  assert.equal(byId[f.arroz.id].grams, 250);           // 150 + 100
  assert.equal(byId[f.ovo.id].grams, 200);             // 2 cafés
  assert.equal(byId[f.frango.id].grams, 120);
  assert.equal(list.foods, 4);
  assert.equal(list.count, 4);
  assert.equal(list.plannedMeals, 4);
  assert.deepEqual(list.groups.map((g) => g.group), list.groups.map((g) => g.group).slice().sort((a, b) => a.localeCompare(b, 'pt-BR')));
  // dias escolhidos: só terça
  const so = P.shoppingList(s, MON, { days: ['2026-11-24'] });
  assert.equal(so.foods, 3);                           // ovo, pão, arroz
  assert.equal(so.groups.reduce((a, g) => a + g.items.length, 0), 3);
  // dia sem plano
  assert.equal(P.shoppingList(s, '2026-12-07').count, 0);
});

test('lista de compras: arredondamento, kg, unidades pelas porções salvas e texto', () => {
  const { s, f, cafe } = base();
  assert.equal(P.fmtGrams(120), '120 g');
  assert.equal(P.fmtGrams(0.3), '0,3 g');
  assert.equal(P.fmtGrams(1250), '1,25 kg');
  assert.equal(P.fmtGrams(2000), '2 kg');
  // 0,1 + 0,2 não vira 0,30000000000000004
  const m1 = saved(s, 'A', 'dinner', [{ foodId: f.arroz.id, grams: 0.1 }]);
  const m2 = saved(s, 'B', 'supper', [{ foodId: f.arroz.id, grams: 0.2 }]);
  P.setSlot(s, MON, 'dinner', m1.id); P.setSlot(s, MON, 'supper', m2.id);
  assert.equal(P.shoppingList(s, MON).groups[0].items[0].grams, 0.3);
  // unidades: ovo com porção "1 unidade" de 50 g
  P.setSlot(s, MON, 'breakfast', cafe.id);
  P.setSlot(s, '2026-11-24', 'breakfast', cafe.id);
  N.addPortion(s, f.ovo.id, '1 unidade', 50);
  N.addPortion(s, f.ovo.id, '1 colher', 5);
  const ovo = P.shoppingList(s, MON).groups.reduce((a, g) => a.concat(g.items), []).filter((e) => e.foodId === f.ovo.id)[0];
  assert.equal(ovo.grams, 200);
  assert.deepEqual(ovo.units, { n: 4, label: '1 unidade', grams: 50 });  // usa a maior porção que cabe
  assert.equal(P.itemQty(ovo), '200 g (≈ 4 × 1 unidade)');
  const pao = P.shoppingList(s, MON).groups.reduce((a, g) => a.concat(g.items), []).filter((e) => e.foodId === f.pao.id)[0];
  assert.equal(pao.units, null);                                          // sem porção salva
  const txt = P.listText(P.shoppingList(s, MON));
  assert.ok(txt.startsWith('Lista de compras — 23 a 29 de nov'));
  assert.ok(txt.includes('☐ ') && txt.includes('200 g (≈ 4 × 1 unidade)') && txt.endsWith('Feito no J.S.'));
});

test('lista de compras: refeição removida e alimento que não existe mais ficam de fora e são contados', () => {
  const { s, f, cafe, almoco } = base();
  const custom = N.createCustomFood(s, N.validateCustomFood({ name: 'Bolo da vó', kcal: '300', carb: '40', prot: '5', lip: '10' }).value, NOW);
  const bolo = saved(s, 'Lanche com bolo', 'afternoon_snack', [{ foodId: custom.id, grams: 100 }, { foodId: f.ovo.id, grams: 50 }]);
  P.setSlot(s, MON, 'breakfast', cafe.id);
  P.setSlot(s, MON, 'lunch', almoco.id);
  P.setSlot(s, MON, 'afternoon_snack', bolo.id);
  N.deleteSavedMeal(s, almoco.id);          // refeição removida
  s.customFoods = [];                        // alimento removido
  const list = P.shoppingList(s, MON);
  assert.equal(list.missingMeals, 1);
  assert.equal(list.missingFoods, 1);
  assert.equal(list.plannedMeals, 2);
  assert.equal(list.groups.reduce((a, g) => a + g.items.length, 0), 2);  // ovo (café + lanche somam) e pão
  assert.equal(list.groups.reduce((a, g) => g.items.filter((e) => e.foodId === f.ovo.id).concat(a), [])[0].grams, 150);
  // alimento próprio fica no fim ("Meus alimentos")
  const s2 = base();
  const c2 = N.createCustomFood(s2.s, N.validateCustomFood({ name: 'Zebra', kcal: '100' }).value, NOW);
  const m = saved(s2.s, 'Z', 'dinner', [{ foodId: c2.id, grams: 10 }, { foodId: s2.f.arroz.id, grams: 10 }]);
  P.setSlot(s2.s, MON, 'dinner', m.id);
  const groups = P.shoppingList(s2.s, MON).groups.map((g) => g.group);
  assert.equal(groups[groups.length - 1], 'Meus alimentos');
});

test('lista de compras: marcar itens (por semana), extras e "limpar marcados"', () => {
  const { s, f, cafe } = base();
  P.setSlot(s, MON, 'breakfast', cafe.id);
  assert.equal(P.toggleChecked(s, MON, f.ovo.id), true);
  let list = P.shoppingList(s, MON);
  assert.equal(list.checked, 1);
  assert.equal(P.shoppingList(s, '2026-11-30').checked, 0);              // outra semana: marca separada
  const it = P.addExtra(s, MON, '  papel toalha ');
  assert.equal(it.name, 'papel toalha');
  assert.equal(P.addExtra(s, MON, '   '), null);
  P.addExtra(s, MON, 'café');
  assert.equal(P.toggleExtra(s, MON, it.id), true);
  list = P.shoppingList(s, MON);
  assert.equal(list.count, 2 + 2);                                       // ovo, pão + 2 extras
  assert.equal(list.checked, 2);                                         // ovo + papel toalha
  assert.ok(P.listText(list).includes('✔ papel toalha'));
  const n = P.clearMarked(s, MON);
  assert.equal(n, 2);
  list = P.shoppingList(s, MON);
  assert.equal(list.checked, 0);
  assert.deepEqual(list.extras.map((x) => x.name), ['café']);            // o extra marcado saiu
  P.removeExtra(s, MON, list.extras[0].id);
  assert.deepEqual(P.read(s).extra, {});
  // limite de extras
  for (let i = 0; i < P.EXTRA_MAX; i++) assert.ok(P.addExtra(s, MON, 'item ' + i));
  assert.equal(P.addExtra(s, MON, 'a mais'), null);
});

test('limpeza de semanas muito antigas', () => {
  const { s, cafe } = base();
  P.setSlot(s, '2026-01-05', 'breakfast', cafe.id);
  P.setSlot(s, '2026-11-23', 'breakfast', cafe.id);
  P.toggleChecked(s, '2026-01-05', 'taco:1');
  P.addExtra(s, '2026-01-05', 'velho');
  assert.equal(P.prune(s, '2026-11-23'), 3);
  assert.deepEqual(Object.keys(P.read(s).plans), ['2026-11-23']);
  assert.deepEqual(P.read(s).extra, {});
});

/* ---------------- Código de barras ---------------- */

test('código de barras: dígito verificador (EAN-13, EAN-8, UPC-A) e normalização', () => {
  assert.equal(B.validate('7891000100103').ok, true);                    // EAN-13 real
  assert.equal(B.validate('789 1000 100103').code, '7891000100103');     // espaços e traços saem
  assert.equal(B.validate('7891000100104').ok, false);                   // dígito errado
  assert.equal(B.validate('96385074').ok, true);                         // EAN-8
  assert.equal(B.validate('036000291452').code, '0036000291452');        // UPC-A de 12 vira EAN-13
  assert.equal(B.validate('12345').ok, false);
  assert.equal(B.validate('').ok, false);
  assert.ok(B.validate('abc').error);
});

const OFF_FOUND = { code: '7891000100103', status: 1, product: {
  product_name: 'Leite Condensado', brands: 'Moça,Nestlé',
  serving_size: '20 g', serving_quantity: 20,
  nutriments: { 'energy-kcal_100g': 313, carbohydrates_100g: 56.5, proteins_100g: 7.2, fat_100g: 7.5, 'saturated-fat_100g': 4.7, fiber_100g: 0, sodium_100g: 0.1 } } };

test('Open Food Facts → alimento por 100 g (kcal, macros, sódio em mg, porção do rótulo)', () => {
  const r = B.fromOff(OFF_FOUND, '7891000100103');
  assert.equal(r.status, 'found');
  assert.equal(r.name, 'Leite Condensado (Moça)');
  assert.deepEqual(r.per100, { kcal: 313, carb: 56.5, prot: 7.2, lip: 7.5, gsat: 4.7, fibra: 0, sodio: 100 });
  assert.deepEqual(r.serving, { grams: 20, text: '20 g' });
  // vira alimento próprio válido, com o código guardado
  const s = R.emptyState();
  const v = N.validateCustomFood(B.toCustomInput(r, '7891000100103'));
  assert.equal(v.ok, true);
  assert.equal(v.value.barcode, '7891000100103');
  const food2 = N.createCustomFood(s, v.value, NOW);
  assert.equal(food2.barcode, '7891000100103');
  assert.equal(N.findByBarcode(s, '7891000100103').id, food2.id);
  assert.equal(N.findByBarcode(s, '7891000100103').barcode, '7891000100103');
  assert.equal(N.findByBarcode(s, '0000000000000'), null);
  assert.equal(N.findByBarcode(s, ''), null);
});

test('Open Food Facts: energia em kJ, sal no lugar do sódio, porção em texto, e dados que faltam', () => {
  const kj = B.fromOff({ status: 1, product: { product_name: 'Barra', nutriments: { energy_100g: 1500, carbohydrates_100g: 60, proteins_100g: 10, fat_100g: 20, salt_100g: 1 }, serving_size: '1 barra (35,5 g)' } }, '7891000100103');
  assert.equal(kj.status, 'found');
  assert.equal(kj.per100.kcal, 358.5);                                   // 1500 kJ / 4,184
  assert.equal(kj.per100.sodio, 400);                                    // 1 g de sal = 0,4 g de sódio
  assert.deepEqual(kj.serving, { grams: 35.5, text: '1 barra (35,5 g)' });
  const falta = B.fromOff({ status: 1, product: { product_name: 'Sem dados', nutriments: { 'energy-kcal_100g': 120 } } }, '7891000100103');
  assert.equal(falta.status, 'incomplete');
  assert.deepEqual(falta.missing, ['carb', 'prot', 'lip']);
  const semKcal = B.fromOff({ status: 1, product: { product_name: 'X', nutriments: { proteins_100g: 3 } } }, '7891000100103');
  assert.equal(semKcal.status, 'incomplete');
  assert.ok(semKcal.missing.indexOf('kcal') >= 0);
  assert.equal(B.fromOff({ status: 0, status_verbose: 'product not found' }, '1').status, 'notfound');
  assert.equal(B.fromOff({ status: 1 }, '1').status, 'notfound');
  assert.equal(B.fromOff(null, '1').status, 'notfound');
  assert.equal(B.fromOff({ status: 1, product: { nutriments: {} } }, '7891000100103').name, 'Produto 7891000100103');
  // o formulário recebe o que existe e o código
  const input = B.toCustomInput(falta, '7891000100103');
  assert.equal(input.kcal, 120);
  assert.equal(input.carb, undefined);
  assert.equal(input.barcode, '7891000100103');
});

function memoryStorage() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; }

test('consulta ao Open Food Facts: endereço, cache, produto não encontrado, erro e tempo esgotado', async () => {
  const st = memoryStorage();
  const calls = [];
  const ok = (body, status) => (url) => { calls.push(url); return Promise.resolve({ ok: (status || 200) < 400, status: status || 200, json: () => Promise.resolve(body) }); };
  const r1 = await B.lookup('7891000100103', { fetch: ok(OFF_FOUND), storage: st });
  assert.equal(r1.status, 'found');
  assert.equal(r1.code, '7891000100103');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith('https://world.openfoodfacts.org/api/v2/product/7891000100103.json?fields='));
  assert.ok(calls[0].includes('nutriments'));
  // 2ª vez: vem do cache, sem rede
  const r2 = await B.lookup('7891000100103', { fetch: () => { throw new Error('não deveria consultar'); }, storage: st });
  assert.equal(r2.status, 'found');
  assert.equal(r2.fromCache, true);
  assert.equal(r2.name, 'Leite Condensado (Moça)');
  // cache vence depois de 30 dias
  const r2b = await B.lookup('7891000100103', { fetch: ok(OFF_FOUND), storage: st, now: Date.now() + 31 * 86400000 });
  assert.equal(r2b.fromCache, undefined);
  // código inválido: nem consulta
  const bad = await B.lookup('123', { fetch: () => { throw new Error('não deveria consultar'); }, storage: memoryStorage() });
  assert.equal(bad.status, 'invalid');
  // não encontrado (HTTP 404 e status 0) — e não guarda no cache
  const st2 = memoryStorage();
  assert.equal((await B.lookup('7891000100103', { fetch: ok({}, 404), storage: st2 })).status, 'notfound');
  assert.equal((await B.lookup('7891000100103', { fetch: ok({ status: 0 }), storage: st2 })).status, 'notfound');
  assert.equal(st2.getItem('js-barras-cache'), null);
  // erro de servidor, sem internet e tempo esgotado
  assert.equal((await B.lookup('7891000100103', { fetch: ok({}, 500), storage: st2 })).status, 'error');
  assert.equal((await B.lookup('7891000100103', { fetch: () => Promise.reject(new TypeError('Failed to fetch')), storage: st2 })).status, 'error');
  const lento = await B.lookup('7891000100103', { fetch: () => new Promise(() => {}), storage: st2, timeoutMs: 20 });
  assert.equal(lento.status, 'error');
  assert.equal(lento.error, 'tempo-esgotado');
  // produto incompleto também fica no cache (evita consultar de novo)
  const st3 = memoryStorage();
  const inc = await B.lookup('7891000100103', { fetch: ok({ status: 1, product: { product_name: 'Parcial', nutriments: { 'energy-kcal_100g': 90 } } }), storage: st3 });
  assert.equal(inc.status, 'incomplete');
  assert.equal((await B.lookup('7891000100103', { fetch: () => { throw new Error('x'); }, storage: st3 })).fromCache, true);
});

test('cache do código de barras guarda no máximo 60 produtos (os mais recentes)', () => {
  const st = memoryStorage();
  for (let i = 0; i < 70; i++) B.cacheSet(st, 'c' + i, { status: 'found', name: 'p' + i }, 1000 + i);
  const all = JSON.parse(st.getItem('js-barras-cache'));
  assert.equal(Object.keys(all).length, 60);
  assert.ok(all.c69 && !all.c0);
  assert.equal(B.cacheGet(st, 'c69', 2000).name, 'p69');
  assert.equal(B.cacheGet(st, 'nao-tem', 2000), null);
});
