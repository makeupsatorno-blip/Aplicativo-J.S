// Testes da versão 2: treino, corpo, nutrição, toque atrás, tarefa em andamento e migração.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const R = require('../js/regras.js');
const T = require('../js/regras-treino.js');
const B = require('../js/regras-corpo.js');
const N = require('../js/regras-nutricao.js');
const Q = require('../js/toque.js');

const NOW = '2026-11-08T10:00:00.000Z';
function iso(min) { return new Date(Date.parse(NOW) + min * 60000).toISOString(); }
function plan(s, name, items) {
  const r = T.validatePlan({ name, items });
  assert.ok(r.ok, JSON.stringify(r.errors));
  return T.createPlan(s, r.value, NOW);
}

/* ---------------- Migração ---------------- */

test('migração v1 -> v2 mantém os dados e cria as estruturas novas', () => {
  const v1 = { schemaVersion: 1, settings: { name: 'Julia', notifications: { task: false } }, tasks: [{ id: 't1', title: 'Aula' }], hairEvents: [], meals: [], bills: [], payments: [] };
  const s = R.migrate(v1);
  assert.equal(s.schemaVersion, 2);
  assert.equal(s.tasks.length, 1);
  assert.equal(s.settings.notifications.task, false);
  assert.equal(s.settings.notifications.hair, true);
  assert.deepEqual(s.workoutPlans, []);
  assert.deepEqual(s.workout.week, { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
  assert.equal(s.settings.backTap.enabled, true);
  assert.equal(s.settings.body.sex, 'f');
  assert.throws(() => R.migrate({ schemaVersion: 3 }), /mais nova/);
});

/* ---------------- Treino ---------------- */

test('ficha: validação, semana fixa e troca só no dia', () => {
  const s = R.emptyState();
  assert.equal(T.validatePlan({ name: '', items: [] }).ok, false);
  const pernas = plan(s, 'Treino A — Pernas', [{ exerciseId: 'ex:leg-press', sets: '4', reps: '10-12', load: '80', restSec: '90' }]);
  const bracos = plan(s, 'Treino B — Braços', [{ exerciseId: 'ex:rosca-direta', sets: 3, reps: '12', load: '8,5', restSec: 60 }]);
  assert.equal(bracos.items[0].load, 8.5);
  const terca = '2026-11-10'; // terça-feira
  assert.equal(C.weekday(terca), 2);
  T.setWeekPlan(s, 2, pernas.id);
  assert.equal(T.planForDate(s, terca).plan.id, pernas.id);
  assert.equal(T.planForDate(s, '2026-11-17').plan.id, pernas.id, 'toda terça');
  T.setDayPlan(s, terca, bracos.id); // nesta terça, braço
  assert.equal(T.planForDate(s, terca).plan.id, bracos.id);
  assert.equal(T.planForDate(s, terca).changed, true);
  assert.equal(T.planForDate(s, '2026-11-17').plan.id, pernas.id, 'a próxima terça continua perna');
  T.setDayPlan(s, '2026-11-17', 'rest');
  assert.equal(T.planForDate(s, '2026-11-17').rest, true);
  T.setDayPlan(s, terca, null);
  assert.equal(T.planForDate(s, terca).plan.id, pernas.id, 'volta ao padrão');
  T.deletePlan(s, pernas.id);
  assert.equal(s.workout.week[2], null);
  assert.equal(T.planForDate(s, terca).plan, null);
});

test('execução: séries por toque, troca de exercício, fim atualiza a carga da ficha', () => {
  const s = R.emptyState();
  const p = plan(s, 'A', [
    { exerciseId: 'ex:supino-reto', sets: 2, reps: '10', load: 20, restSec: 60 },
    { exerciseId: 'ex:remada-baixa', sets: 1, reps: '12', load: 30, restSec: 0 }
  ]);
  const x = T.startSession(s, '2026-11-08', p.id, NOW);
  assert.ok(x);
  assert.equal(T.startSession(s, '2026-11-08', p.id, NOW), null, 'só um treino por vez');
  const sup = x.items[0];
  assert.equal(sup.reps, 10);
  T.setItemValues(s, x.id, sup.id, { load: 22.5 });
  T.logSet(s, x.id, sup.id, iso(2), 'toque');
  assert.equal(T.currentItem(x).id, sup.id, 'continua no supino até terminar as séries');
  T.logSet(s, x.id, sup.id, iso(4), 'toque-atras');
  assert.equal(T.currentItem(x).exerciseId, 'ex:remada-baixa', 'terminou: vai para o próximo');
  assert.deepEqual(sup.sets.map(z => z.load), [22.5, 22.5]);
  assert.equal(sup.sets[1].via, 'toque-atras');
  T.undoLastSet(s, x.id, sup.id);
  assert.equal(sup.sets.length, 1);
  T.logSet(s, x.id, sup.id, iso(5), 'toque');
  const rem = x.items[1];
  T.logSet(s, x.id, rem.id, iso(8), 'toque');
  const sum = T.finishSession(s, x.id, iso(30));
  assert.equal(sum.sets, 3);
  assert.equal(sum.volume, 22.5 * 10 * 2 + 30 * 12);
  assert.equal(sum.minutes, 30);
  assert.equal(p.items[0].load, 22.5, 'a ficha sugere a última carga usada');
  assert.equal(T.activeSession(s), null);
  assert.equal(T.lastLoad(s, 'ex:supino-reto'), 22.5);
});

test('evolução: compara a carga com o treino anterior e marca recorde', () => {
  const s = R.emptyState();
  const p = plan(s, 'A', [{ exerciseId: 'ex:leg-press', sets: 1, reps: '10', load: 80, restSec: 0 }]);
  [['2026-11-01', 80], ['2026-11-04', 90], ['2026-11-07', 85]].forEach(([d, load], i) => {
    const x = T.startSession(s, d, p.id, iso(i * 1000));
    T.setItemValues(s, x.id, x.items[0].id, { load });
    T.logSet(s, x.id, x.items[0].id, iso(i * 1000 + 1));
    T.finishSession(s, x.id, iso(i * 1000 + 20));
  });
  const tr = T.exerciseTrend(s, 'ex:leg-press');
  assert.equal(tr.count, 3);
  assert.equal(tr.direction, 'down');
  assert.equal(tr.delta, -5);
  assert.equal(tr.best, 90);
  assert.equal(tr.sinceFirst, 5);
  const second = T.doneSessions(s)[1];
  assert.equal(T.sessionSummary(s, second).prs.length, 1, 'o 2º treino bateu recorde');
  const weeks = T.weeklyStats(s, '2026-11-08', 2);
  assert.equal(weeks[0].count + weeks[1].count, 3);
  const cal = T.monthCalendar(s, '2026-11');
  assert.equal(cal['2026-11-04'].done.length, 1);
});

test('lembrete de treino só nos dias com ficha e some depois de treinar', () => {
  const s = R.emptyState();
  const p = plan(s, 'Pernas', [{ exerciseId: 'ex:leg-press', sets: 3, reps: '10', load: 80, restSec: 60 }]);
  T.setWeekPlan(s, 1, p.id); // segunda
  s.workout.reminderTime = '18:00';
  const now = new Date(2026, 10, 8, 9, 0); // domingo
  let list = R.computeReminders(s, now).filter(r => r.type === 'workout');
  assert.equal(list.length, 1);
  assert.equal(C.toDateKey(list[0].at), '2026-11-09');
  assert.equal(list[0].route, 'treino');
  const x = T.startSession(s, '2026-11-09', p.id, NOW);
  T.logSet(s, x.id, x.items[0].id, NOW);
  T.finishSession(s, x.id, NOW);
  list = R.computeReminders(s, now).filter(r => r.type === 'workout');
  assert.equal(list.length, 0);
});

/* ---------------- Tarefa em andamento ---------------- */

test('começar tarefa: em andamento, concluir guarda quanto tempo levou', () => {
  const s = R.emptyState();
  const t = R.createTask(s, R.validateTask({ title: 'Estudar', dueDate: '2026-11-08' }).value, NOW);
  assert.ok(R.startTask(s, t.id, '2026-11-08', iso(0)));
  let o = R.taskOccurrences(s, '2026-11-08', '2026-11-08')[0];
  assert.equal(o.doing, true);
  assert.equal(o.done, false);
  R.setTaskDone(s, t.id, '2026-11-08', true, iso(25));
  o = R.taskOccurrences(s, '2026-11-08', '2026-11-08')[0];
  assert.equal(o.done, true);
  assert.equal(o.startedAt, iso(0));
  R.setTaskDone(s, t.id, '2026-11-08', false, iso(26));
  o = R.taskOccurrences(s, '2026-11-08', '2026-11-08')[0];
  assert.equal(o.doing, true, 'desfazer volta para em andamento');
  R.stopTask(s, t.id, '2026-11-08');
  o = R.taskOccurrences(s, '2026-11-08', '2026-11-08')[0];
  assert.equal(o.doing, false);
});

/* ---------------- Corpo ---------------- */

test('bioimpedância: validação, diferenças e indicação de massa muscular', () => {
  const s = R.emptyState();
  s.settings.body.heightCm = 165;
  assert.equal(B.validateRecord({ date: '2026-11-01' }).ok, false, 'precisa de pelo menos um valor');
  assert.equal(B.validateRecord({ date: '2026-11-01', fatPct: '90' }).ok, false);
  B.createRecord(s, B.validateRecord({ date: '2026-09-10', weightKg: '62,4', fatPct: '27', muscleKg: '24.1' }).value, NOW);
  B.createRecord(s, B.validateRecord({ date: '2026-11-01', weightKg: '61.8', fatPct: '25.5', muscleKg: '25' }).value, NOW);
  const L = B.latest(s);
  assert.equal(L.weightKg.value, 61.8);
  assert.equal(L.fatPct.delta, -1.5);
  assert.equal(L.fatPct.tone, 'good', 'gordura caiu = bom');
  assert.equal(L.muscleKg.tone, 'good', 'músculo subiu = bom');
  assert.equal(L.weightKg.tone, 'neutral');
  const mi = B.muscleIndicator(s, '2026-11-08');
  assert.equal(mi.status, 'gaining');
  assert.equal(mi.change, 0.9);
  assert.equal(mi.pctOfWeight, 40.5);
  assert.equal(mi.perHeight, 9.2);
  assert.equal(B.bmi(61.8, 165), 22.7);
  assert.equal(B.bmiClass(22.7).label, 'Peso adequado');
  assert.equal(B.fatClass(25.5, 'f').label, 'Média');
  assert.equal(B.fatClass(22, 'f').label, 'Boa forma');
});

/* ---------------- Nutrição ---------------- */

test('TACO: busca sem acento e nutrientes pela quantidade', () => {
  const s = R.emptyState();
  assert.equal(N.count, 597);
  const ovo = N.search(s, 'ovo cozido')[0];
  assert.equal(ovo.name, 'Ovo, de galinha, inteiro, cozido/10minutos');
  assert.equal(ovo.per100.kcal, 146);
  const n = N.scale(ovo.per100, 50);
  assert.equal(n.kcal, 73);
  assert.equal(Math.round(n.prot * 100) / 100, 6.65);
  assert.ok(N.search(s, 'feijao carioca').some(f => f.name === 'Feijão, carioca, cozido'), 'acha sem acento');
  const leite = N.foodByName('Leite, de vaca, integral');
  assert.equal(leite.per100.kcal, null, 'valor não analisado fica vazio, nunca zero');
});

test('diário: soma por refeição e no dia; soma parcial é marcada', () => {
  const s = R.emptyState();
  const ovo = N.foodByName('Ovo, de galinha, inteiro, cozido/10minutos');
  const banana = N.foodByName('Banana, prata, crua');
  const leite = N.foodByName('Leite, de vaca, integral');
  [[ovo, 100, 'breakfast'], [banana, 80, 'breakfast'], [leite, 200, 'breakfast'], [ovo, 50, 'dinner']].forEach(([f, g, m]) => {
    const r = N.validateFoodLog({ date: '2026-11-08', meal: m, foodId: f.id, grams: g });
    assert.ok(r.ok);
    N.addFoodLog(s, r.value, NOW);
  });
  assert.equal(N.validateFoodLog({ date: '2026-11-08', meal: 'lunch', foodId: ovo.id, grams: 0 }).ok, false);
  const dl = N.dayLog(s, '2026-11-08');
  assert.deepEqual(dl.meals.map(m => m.meal), ['breakfast', 'dinner']);
  assert.equal(Math.round(dl.meals[0].total.kcal), 146 + Math.round(98 * 0.8));
  assert.equal(dl.meals[0].total.partial.kcal, true, 'o leite não tem kcal analisada');
  assert.equal(Math.round(dl.total.kcal), Math.round(146 + 78.4 + 73));
  const sp = N.macroSplit(dl.total);
  assert.equal(sp.prot + sp.carb + sp.lip >= 99, true);
});

test('meta de calorias e cardápio ajustado à meta', () => {
  const s = R.emptyState();
  assert.equal(N.kcalTarget(s, '2026-11-08'), null);
  B.createRecord(s, B.validateRecord({ date: '2026-11-01', weightKg: 60, bmrKcal: 1300 }).value, NOW);
  const t = N.kcalTarget(s, '2026-11-08');
  assert.equal(t.source, 'bioimpedancia');
  assert.equal(t.value, Math.round(1300 * 1.55 / 10) * 10);
  s.settings.nutrition.kcalTarget = 1800;
  assert.deepEqual(N.kcalTarget(s), { value: 1800, source: 'manual' });
  const m = N.suggestMenu(s, '2026-11-08');
  assert.equal(m.meals.length, 4, 'sem horários: 4 refeições padrão');
  const total = m.meals.reduce((a, x) => a + x.total.kcal, 0);
  assert.ok(Math.abs(total - 1800) < 120, 'perto da meta: ' + Math.round(total));
  const m2 = N.suggestMenu(s, '2026-11-08', { lunch: 1 });
  assert.notEqual(m2.meals[1].option, m.meals[1].option, '"outra opção" muda o almoço');
  assert.equal(m2.meals[0].option, m.meals[0].option, 'e não mexe no café');
  // todas as opções de cardápio existem na tabela
  ['breakfast', 'lunch', 'dinner', 'afternoon_snack'].forEach(k => assert.ok(N.templatesFor(k).length >= 6, k));
});

/* ---------------- Toque atrás ---------------- */

function simulate(gen, threshold) {
  const d = Q.createDetector({ threshold: threshold || 2.2 }), evs = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let i = 0; i < 300; i++) {
    const t = i * 16, s = gen(t, rnd);
    if (s.touch) d.touch(t);
    const r = d.feed(Object.assign({ t, linear: true }, s));
    if (r.event) evs.push(r.event);
  }
  return evs;
}
const knock = (t, at) => { const dt = t - at; return dt < 0 || dt > 64 ? 0 : [5, -3, 1.5, -0.6, 0.2][Math.floor(dt / 16)] || 0; };

test('toque atrás: duas batidas = toque duplo; parado, uma batida ou andando não contam', () => {
  const quiet = (rnd) => ({ x: rnd() * 0.3, y: rnd() * 0.3 });
  assert.deepEqual(simulate((t, r) => Object.assign(quiet(r), { z: r() * 0.3 })), []);
  assert.deepEqual(simulate((t, r) => Object.assign(quiet(r), { z: r() * 0.3 + knock(t, 1008) + knock(t, 1264) })), ['tap', 'double']);
  assert.deepEqual(simulate((t, r) => Object.assign(quiet(r), { z: r() * 0.3 + knock(t, 1008) })), ['tap']);
  assert.deepEqual(simulate((t, r) => Object.assign(quiet(r), { z: r() * 0.3 + knock(t, 1008) + knock(t, 1904) })), ['tap', 'tap'], 'longe demais');
  assert.deepEqual(simulate((t, r) => ({ x: 0, y: 3 * Math.sin(t / 90), z: 3 * Math.sin(t / 110) + knock(t, 1008) + knock(t, 1264) })), [], 'celular em movimento');
  assert.deepEqual(simulate((t, r) => Object.assign(quiet(r), { touch: t === 992, z: knock(t, 1008) + knock(t, 1264) })), [], 'toque na tela');
  assert.deepEqual(simulate((t, r) => Object.assign(quiet(r), { z: knock(t, 1008) + knock(t, 1264) + knock(t, 2400) + knock(t, 2656) })), ['tap', 'double', 'tap', 'double']);
});

test('toque atrás: sem aceleração limpa (com gravidade) também funciona', () => {
  const d = Q.createDetector({ threshold: 2.2 }), evs = [];
  for (let i = 0; i < 300; i++) {
    const t = i * 16;
    const r = d.feed({ t, x: 0.1, y: 0.2, z: 9.81 + knock(t, 1504) + knock(t, 1760), linear: false });
    if (r.event) evs.push(r.event);
  }
  assert.deepEqual(evs, ['tap', 'double']);
});

test('toque atrás: calibração e sensibilidade', () => {
  assert.equal(Q.calibrationThreshold([], [0.1]), null);
  const th = Q.calibrationThreshold([6, 5, 7, 6.5], [0.1, 0.12, 0.2, 0.15]);
  assert.equal(th, 3.13);
  const peaks = Q.findPeaks([{ t: 0, score: 0.1 }, { t: 16, score: 5 }, { t: 32, score: 3 }, { t: 300, score: 6 }, { t: 316, score: 1 }, { t: 800, score: 0.1 }], 1);
  assert.deepEqual(peaks, [5, 6]);
  assert.equal(Q.thresholdFor({ threshold: 3, sensitivity: 3 }), 3);
  assert.ok(Q.thresholdFor({ threshold: 3, sensitivity: 5 }) < 3, 'mais sensível = limite menor');
  assert.equal(Q.thresholdFor({}), Q.DEFAULT_THRESHOLD);
});

test('carga por série (pirâmide): cada série começa com o peso dela e a ficha aprende o que foi usado', () => {
  const s = R.emptyState();
  const r = T.validatePlan({ name: 'Pirâmide', items: [{ exerciseId: 'ex:supino-reto', sets: 3, reps: '12-8', loads: ['20', '22,5', ''], restSec: 60 }] });
  assert.ok(r.ok);
  assert.deepEqual(r.value.items[0].loads, [20, 22.5, 22.5], 'série vazia repete a anterior');
  const p = T.createPlan(s, r.value, NOW);
  p.items[0].loads = [20, 22.5, 25];
  const x = T.startSession(s, '2026-11-08', p.id, NOW);
  const it = x.items[0];
  assert.equal(it.load, 20, '1ª série começa com 20 kg');
  T.logSet(s, x.id, it.id, iso(1));
  assert.equal(it.load, 22.5, '2ª série já vem com 22,5 kg');
  T.setItemValues(s, x.id, it.id, { load: 24 }); // ajustou na hora
  T.logSet(s, x.id, it.id, iso(3));
  assert.equal(it.load, 25, '3ª série vem com 25 kg');
  T.logSet(s, x.id, it.id, iso(5));
  assert.deepEqual(it.sets.map(z => z.load), [20, 24, 25]);
  T.finishSession(s, x.id, iso(30));
  assert.deepEqual(p.items[0].loads, [20, 24, 25], 'a ficha guarda a carga usada em cada série');
  // ficha antiga (sem carga por série) continua funcionando com a mesma carga em todas
  const old = T.createPlan(s, { name: 'Antiga', color: T.PLAN_COLORS[0], items: [{ id: 'i1', exerciseId: 'ex:leg-press', sets: 2, reps: '10', load: 80, restSec: 0 }] }, NOW);
  assert.deepEqual(T.itemLoads(old.items[0]), [80, 80]);
});

test('registro rápido: usa o exercício atual, registra séries seguidas e corrige uma série', () => {
  const s = R.emptyState();
  const p = plan(s, 'Peito', [{ exerciseId: 'ex:supino-reto', sets: 4, reps: '10', load: 60, restSec: 60 }, { exerciseId: 'ex:crucifixo', sets: 3, reps: '12', load: 12, restSec: 45 }]);
  T.startSession(s, '2026-11-08', p.id, NOW);
  // contexto que o atalho do iPhone recebe
  let ctx = T.quickContext(s, '2026-11-08', 2.5);
  assert.equal(ctx.ativo, true);
  assert.equal(ctx.exercicio, 'Supino reto');
  assert.equal(ctx.serie, 1);
  assert.equal(ctx.peso, 60);
  assert.equal(ctx.passo, 2.5);
  assert.deepEqual(ctx.opcoes.map(o => o.id), ['ex:supino-reto', 'ex:crucifixo']);
  // séries consecutivas no exercício atual (sem dizer qual)
  let r = T.quickSet(s, { load: 60, reps: 10 }, iso(1));
  assert.equal(r.serie, 1);
  r = T.quickSet(s, { load: 62.5, reps: 9 }, iso(3));
  assert.equal(r.serie, 2);
  assert.equal(T.quickContext(s, '2026-11-08').serie, 3);
  // corrigir a série 1
  r = T.quickSet(s, { exerciseId: 'ex:supino-reto', load: 57.5, reps: 10, serie: 1 }, iso(4));
  assert.equal(r.corrected, true);
  const sets = T.activeSession(s).items[0].sets;
  assert.deepEqual(sets.map(x => [x.load, x.reps]), [[57.5, 10], [62.5, 9]]);
  // outro exercício que não estava no treino entra no treino
  r = T.quickSet(s, { exerciseId: 'ex:rosca-direta', load: 10, reps: 12, via: 'atalho' }, iso(6));
  assert.equal(T.activeSession(s).items.length, 3);
  assert.equal(r.item.sets[0].via, 'atalho');
  assert.equal(T.currentItem(T.activeSession(s)).exerciseId, 'ex:rosca-direta', 'vira o exercício atual');
  // histórico e último uso
  assert.deepEqual(T.lastSet(s, 'ex:supino-reto'), { load: 62.5, reps: 9, date: '2026-11-08', at: iso(3) });
  assert.equal(T.exerciseSets(s, 'ex:supino-reto')[0].sets.length, 2);
});

test('registro rápido sem treino em andamento: começa um treino e usa o último peso como sugestão', () => {
  const s = R.emptyState();
  const p = plan(s, 'Pernas', [{ exerciseId: 'ex:leg-press', sets: 3, reps: '10', load: 80, restSec: 60 }]);
  T.setWeekPlan(s, C.weekday('2026-11-08'), p.id);
  let ctx = T.quickContext(s, '2026-11-08');
  assert.equal(ctx.ativo, false);
  assert.equal(ctx.treino, 'Pernas', 'mostra a ficha do dia');
  assert.equal(ctx.exercicio, 'Leg press 45°');
  const r = T.quickSet(s, { exerciseId: 'ex:leg-press', load: 90, reps: 10, planId: p.id, date: '2026-11-08' }, NOW);
  assert.equal(r.started, true, 'começou um treino');
  assert.equal(T.activeSession(s).planName, 'Pernas');
  assert.equal(T.activeSession(s).items[0].sets[0].load, 90);
  ctx = T.quickContext(s, '2026-11-08');
  assert.equal(ctx.serie, 2);
  assert.equal(ctx.peso, 90, 'sugere o peso que acabou de usar');
});

test('tarefa toda semana nos dias marcados (ex.: segunda e quarta)', () => {
  const s = R.emptyState();
  const r = R.validateTask({ title: 'Pilates', dueDate: '2026-11-08', dueTime: '07:00', weekdays: ['1', '3'], recurrence: 'none' });
  assert.ok(r.ok);
  assert.equal(r.value.recurrence, 'weekly', 'marcar dias liga a repetição semanal');
  assert.deepEqual(r.value.weekdays, [1, 3]);
  const t = R.createTask(s, r.value, NOW);
  assert.deepEqual(R.taskOccurrences(s, '2026-11-08', '2026-11-21').map(o => o.date), ['2026-11-09', '2026-11-11', '2026-11-16', '2026-11-18']);
  // "Toda semana" sem dia marcado: usa o dia da semana da data
  assert.deepEqual(R.validateTask({ title: 'Feira', dueDate: '2026-11-10', recurrence: 'weekly' }).value.weekdays, [2]);
  // editar para só segunda
  R.updateTask(s, t.id, R.validateTask({ title: 'Pilates', dueDate: '2026-11-08', dueTime: '07:00', weekdays: '1', recurrence: 'weekly' }).value, 'all', null, NOW);
  assert.deepEqual(R.taskOccurrences(s, '2026-11-08', '2026-11-21').map(o => o.date), ['2026-11-09', '2026-11-16']);
  // trocar para "todo dia" limpa os dias marcados
  R.updateTask(s, t.id, R.validateTask({ title: 'Pilates', dueDate: '2026-11-09', recurrence: 'daily' }).value, 'all', null, NOW);
  assert.equal(s.tasks[0].weekdays, null);
});
