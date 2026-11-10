// Testes da versão 2.6: água, ciclo menstrual, séries por grupo muscular, repetir refeição e favoritos.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const R = require('../js/regras.js');
const T = require('../js/regras-treino.js');
const N = require('../js/regras-nutricao.js');
const Cy = require('../js/regras-ciclo.js');

const NOW = '2026-11-10T12:00:00.000Z';
const local = (date, time) => C.combine(date, time).toISOString();

/* ---------------- Migração ---------------- */

test('migração 2.6: estruturas novas, cores antigas das fichas viram as delicadas', () => {
  const s = R.migrate({ schemaVersion: 2, settings: { notifications: { task: false } }, workoutPlans: [{ id: 'p1', name: 'A', color: '#2A78D6', items: [] }, { id: 'p2', name: 'B', color: '#A0526D', items: [] }] });
  assert.deepEqual(s.waterLogs, []);
  assert.deepEqual(s.cyclePeriods, []);
  assert.deepEqual(s.cycleDays, {});
  assert.deepEqual(s.foodFavorites, []);
  assert.equal(s.settings.notifications.task, false);
  assert.equal(s.settings.notifications.water, true);
  assert.equal(s.settings.water.cupMl, 250);
  assert.equal(s.settings.cycle.cycleLen, 28);
  assert.equal(s.workoutPlans[0].color, '#4F6F9A');
  assert.equal(s.workoutPlans[1].color, '#A0526D');
  assert.ok(T.PLAN_COLORS.indexOf(s.workoutPlans[0].color) >= 0);
  // dados inválidos saem
  const s2 = R.migrate({ schemaVersion: 2, waterLogs: [{ id: 'w', date: 'x', ml: 200 }, { id: 'w2', date: '2026-11-10', ml: 200 }], cyclePeriods: [{ id: 'c', start: '2026-11-01', end: '2026-10-01' }], foodFavorites: ['a', 'a', 3] });
  assert.equal(s2.waterLogs.length, 1);
  assert.equal(s2.cyclePeriods.length, 0);
  assert.deepEqual(s2.foodFavorites, ['a']);
});

/* ---------------- Água ---------------- */

test('água: meta automática pelo peso, registro, desfazer e totais', () => {
  const s = R.emptyState();
  assert.deepEqual(R.waterGoal(s), { ml: 2000, source: 'padrao' });
  s.bodyRecords.push({ id: 'b', date: '2026-11-01', weightKg: 62.4 });
  assert.equal(R.waterGoal(s).ml, 2200); // 62,4 × 35 = 2184 → 2200
  s.settings.water.goalMl = 2500;
  assert.equal(R.waterGoal(s).ml, 2500);
  assert.equal(R.addWater(s, '2026-11-10', 5, NOW), null);
  R.addWater(s, '2026-11-10', 250, '2026-11-10T10:00:00.000Z');
  R.addWater(s, '2026-11-10', 500, '2026-11-10T11:00:00.000Z');
  assert.equal(R.waterTotal(s, '2026-11-10'), 750);
  assert.equal(R.undoWater(s, '2026-11-10').ml, 500);
  assert.equal(R.waterTotal(s, '2026-11-10'), 250);
  assert.equal(R.formatMl(1500), '1,5 L');
  assert.equal(R.formatMl(750), '750 ml');
  assert.equal(R.waterDays(s, '2026-11-08', '2026-11-10').length, 3);
  const v = R.validateWaterSettings({ goalMl: '', cupMl: '300', remind: true, every: '90', from: '08:00', to: '07:00' });
  assert.equal(v.ok, false);
  assert.ok(v.errors.to);
  // tamanho do copo digitado: qualquer valor de 30 a 2000 ml
  const v2 = R.validateWaterSettings({ goalMl: '', cupMl: '330', remind: false, every: '120', from: '09:00', to: '21:00' });
  assert.equal(v2.ok, true);
  assert.equal(v2.value.cupMl, 330);
  assert.ok(R.validateWaterSettings({ goalMl: '', cupMl: '10', every: '120', from: '09:00', to: '21:00' }).errors.cupMl);
  assert.ok(R.validateWaterSettings({ goalMl: '', cupMl: '', every: '120', from: '09:00', to: '21:00' }).errors.cupMl);
  s.settings.water.cupMl = 330;
  assert.equal(R.waterCup(s), 330);
  s.settings.water.cupMl = 'x';
  assert.equal(R.waterCup(s), 250);
});

test('água: lembretes no intervalo, param ao bater a meta e pulam se bebeu há pouco', () => {
  const s = R.emptyState();
  s.settings.water = { goalMl: 2000, cupMl: 250, remind: true, every: 120, from: '09:00', to: '21:00' };
  const day = '2026-11-10';
  const now = C.combine(day, '08:00');
  const list = R.computeReminders(s, now).filter((r) => r.type === 'water' && r.key.indexOf(day) > 0);
  assert.equal(list.length, 7); // 9, 11, 13, 15, 17, 19, 21h
  assert.equal(list[0].route, 'alimentacao');
  // bebeu às 10h30: o aviso das 11h (só 30 min depois) não vem
  R.addWater(s, day, 300, local(day, '10:30'));
  const keys = R.computeReminders(s, now).filter((r) => r.type === 'water' && r.key.indexOf(day) > 0).map((r) => r.key.slice(-5));
  assert.ok(keys.indexOf('11:00') < 0, keys.join(','));
  assert.ok(keys.indexOf('13:00') >= 0);
  // bateu a meta: nenhum aviso naquele dia
  R.addWater(s, day, 1800, local(day, '12:00'));
  assert.equal(R.computeReminders(s, now).filter((r) => r.type === 'water' && r.key.indexOf(day) > 0).length, 0);
  // desligado nas notificações: nada
  s.settings.notifications.water = false;
  assert.equal(R.computeReminders(s, now).filter((r) => r.type === 'water').length, 0);
});

test('água: o servidor recebe só 14 dias de lembretes', () => {
  const s = R.emptyState();
  s.settings.water = { goalMl: 2000, cupMl: 250, remind: true, every: 240, from: '09:00', to: '21:00' };
  const now = C.combine('2026-11-10', '08:00');
  const list = R.futureReminders(s, now).filter((r) => r.type === 'water');
  const last = list[list.length - 1];
  assert.ok(list.length > 0);
  assert.ok(C.diffDays('2026-11-10', C.toDateKey(last.at)) <= 14);
});

/* ---------------- Ciclo menstrual ---------------- */

function cycleState() {
  const s = R.emptyState();
  ['2026-08-01', '2026-08-30', '2026-09-28', '2026-10-27'].forEach((d) => Cy.savePeriod(s, null, { start: d, end: C.addDays(d, 4) }, NOW));
  return s;
}

test('ciclo: médias, próxima menstruação, fases e período fértil', () => {
  const s = cycleState();
  const st = Cy.stats(s);
  assert.equal(st.cycleLen, 29);
  assert.equal(st.periodLen, 5);
  assert.equal(st.regular, true);
  const cur = Cy.current(s, '2026-11-10');
  assert.equal(cur.info.day, 15);
  assert.equal(cur.nextStart, '2026-11-25');
  assert.equal(cur.daysToNext, 15);
  assert.equal(cur.late, 0);
  assert.equal(Cy.dayInfo(s, '2026-10-28', '2026-11-10').phase, 'men');
  assert.equal(Cy.dayInfo(s, '2026-11-03', '2026-11-10').phase, 'fol');
  assert.equal(Cy.dayInfo(s, '2026-11-11', '2026-11-10').ovulation, true); // 25/11 − 14
  assert.equal(Cy.dayInfo(s, '2026-11-11', '2026-11-10').phase, 'ovu');
  assert.equal(Cy.dayInfo(s, '2026-11-20', '2026-11-10').phase, 'lut');
  assert.equal(Cy.dayInfo(s, '2026-11-26', '2026-11-10').periodPredicted, true);
  assert.equal(Cy.dayInfo(s, '2026-11-06', '2026-11-10').fertile, true);
  assert.equal(Cy.dayInfo(s, '2026-07-01', '2026-11-10'), null);
  // período fértil: o atual (estamos nele)
  assert.deepEqual(cur.fertile, { from: '2026-11-06', to: '2026-11-12', ov: '2026-11-11' });
  // depois da ovulação, mostra o do próximo ciclo
  assert.equal(Cy.current(s, '2026-11-18').fertile.ov, '2026-12-10');
});

test('ciclo: atraso e previsões depois do atraso', () => {
  const s = cycleState();
  const cur = Cy.current(s, '2026-11-28');
  assert.equal(cur.late, 3);
  assert.equal(cur.info.phase, 'lut');
  assert.equal(cur.nextStart, '2026-11-29');
  assert.deepEqual(Cy.predictedStarts(s, '2026-11-10', 2), ['2026-11-25', '2026-12-24']);
});

test('ciclo: começou/terminou, fluxo marcado vira menstruação e não duplica', () => {
  const s = R.emptyState();
  const p = Cy.startPeriod(s, '2026-11-01', NOW);
  assert.equal(s.cyclePeriods.length, 1);
  assert.equal(Cy.startPeriod(s, '2026-11-03', NOW).id, p.id); // mesma menstruação
  Cy.endPeriod(s, p.id, '2026-11-04', NOW);
  assert.equal(p.end, '2026-11-04');
  // fluxo no dia 6 (logo depois do fim marcado): estende, não cria outra
  Cy.setDay(s, '2026-11-06', { flow: 1 }, NOW);
  assert.equal(s.cyclePeriods.length, 1);
  assert.equal(p.end, '2026-11-06');
  // fluxo 28 dias depois: nova menstruação
  Cy.setDay(s, '2026-11-29', { flow: 2 }, NOW);
  assert.equal(s.cyclePeriods.length, 2);
  // marcou "começou" 2 dias antes da registrada: antecipa o início
  Cy.startPeriod(s, '2026-11-27', NOW);
  assert.equal(s.cyclePeriods.length, 2);
  assert.equal(Cy.periods(s)[1].start, '2026-11-27');
  // registros muito perto não são aceitos
  assert.ok(Cy.savePeriod(s, null, { start: '2026-11-25', end: null }, NOW).error);
  assert.equal(Cy.validatePeriod({ start: '2026-11-10', end: '2026-11-01' }).ok, false);
});

test('ciclo: excluir uma menstruação não volta ao registrar a energia daquele dia', () => {
  const s = R.emptyState();
  Cy.startPeriod(s, '2026-11-10', NOW);
  Cy.setDay(s, '2026-11-10', { flow: 2 }, NOW);
  Cy.deletePeriod(s, s.cyclePeriods[0].id);
  assert.equal(s.cyclePeriods.length, 0);
  assert.equal(s.cycleDays['2026-11-10'], undefined); // o fluxo daquele dia saiu junto
  Cy.setDay(s, '2026-11-10', { energy: 5 }, NOW);
  assert.equal(s.cyclePeriods.length, 0);
});

test('ciclo: registro do dia limpa vazios e sintomas inválidos', () => {
  const s = R.emptyState();
  Cy.setDay(s, '2026-11-10', { energy: 4, mood: 9, symptoms: ['colica', 'xx', 'colica'], note: '  ok  ' }, NOW);
  assert.deepEqual(s.cycleDays['2026-11-10'], { energy: 4, symptoms: ['colica'], note: 'ok' });
  Cy.toggleSymptom(s, '2026-11-10', 'colica', NOW);
  assert.equal(s.cycleDays['2026-11-10'].symptoms, undefined);
  Cy.setDay(s, '2026-11-10', { energy: null, note: '' }, NOW);
  assert.equal(s.cycleDays['2026-11-10'], undefined);
  assert.equal(s.cyclePeriods.length, 0); // sem fluxo, nada de menstruação
});

test('ciclo: energia e treinos por fase', () => {
  const s = cycleState();
  Cy.setDay(s, '2026-10-28', { energy: 2, symptoms: ['colica'] }, NOW);
  Cy.setDay(s, '2026-11-03', { energy: 5 }, NOW);
  Cy.setDay(s, '2026-11-04', { energy: 4 }, NOW);
  s.workoutSessions.push({ id: 'w1', date: '2026-11-03', status: 'done', items: [{ sets: [{ load: 20, reps: 10 }, { load: 20, reps: 10 }] }] });
  s.workoutSessions.push({ id: 'w2', date: '2026-10-28', status: 'done', items: [{ sets: [{ load: 10, reps: 10 }] }] });
  const ps = Cy.phaseStats(s, '2026-11-10');
  const men = ps.find((p) => p.phase === 'men'), fol = ps.find((p) => p.phase === 'fol');
  assert.equal(men.energy, 2);
  assert.deepEqual(men.symptoms, ['Cólica']);
  assert.equal(fol.energy, 4.5);
  assert.equal(fol.workouts, 1);
  assert.equal(fol.avgVolume, 400);
  assert.equal(men.avgVolume, 100);
});

test('ciclo: aviso 2 dias antes da menstruação prevista', () => {
  const s = cycleState();
  const keys = R.futureReminders(s, C.combine('2026-11-10', '08:00')).filter((r) => r.type === 'cycle').map((r) => r.key);
  assert.equal(keys[0], 'cycle:menstruacao:2026-11-23T09:00');
  s.settings.cycle.remind = false;
  assert.equal(R.futureReminders(s, C.combine('2026-11-10', '08:00')).filter((r) => r.type === 'cycle').length, 0);
});

/* ---------------- Treino: séries por grupo muscular ---------------- */

test('séries por grupo muscular: semana atual e a anterior', () => {
  const s = R.emptyState();
  const mk = (date, ex, n, status) => s.workoutSessions.push({ id: C.uuid(), date, status: status || 'done', items: [{ exerciseId: ex, sets: Array.from({ length: n }, () => ({ load: 10, reps: 10 })) }] });
  mk('2026-11-09', 'ex:agachamento-livre', 4);        // esta semana (dom 08 a sáb 14)
  mk('2026-11-10', 'ex:supino-reto', 3, 'active');
  mk('2026-11-03', 'ex:agachamento-livre', 6);        // semana passada
  mk('2026-10-20', 'ex:agachamento-livre', 9);        // fora
  const m = T.weeklyMuscleSets(s, '2026-11-10');
  assert.equal(m.from, '2026-11-08');
  assert.equal(m.total, 7);
  const q = m.groups.find((g) => g.group === 'quadriceps');
  assert.deepEqual([q.sets, q.last], [4, 6]);
  assert.equal(m.groups.find((g) => g.group === 'peito').sets, 3);
});

/* ---------------- Alimentação: favoritos, recentes e repetir ---------------- */

test('favoritos, recentes e repetir refeição de ontem', () => {
  const s = R.emptyState();
  const ovo = N.search(s, 'ovo', 1)[0], ban = N.search(s, 'banana', 1)[0];
  N.addFoodLog(s, { date: '2026-11-09', meal: 'breakfast', foodId: ovo.id, grams: 100 }, NOW);
  N.addFoodLog(s, { date: '2026-11-09', meal: 'breakfast', foodId: ban.id, grams: 80 }, NOW);
  N.addFoodLog(s, { date: '2026-11-09', meal: 'lunch', foodId: ban.id, grams: 120 }, NOW);
  assert.equal(N.toggleFavorite(s, ovo.id), true);
  assert.equal(N.isFavorite(s, ovo.id), true);
  assert.equal(N.favorites(s)[0].grams, 100);
  assert.equal(N.toggleFavorite(s, 'nao-existe'), false);
  assert.equal(N.recentFoods(s, 5).length, 2);
  assert.equal(N.lastMealDay(s, '2026-11-10', 'breakfast'), '2026-11-09');
  assert.equal(N.lastMealDay(s, '2026-11-10', 'dinner'), null);
  const copied = N.copyMeal(s, '2026-11-09', '2026-11-10', 'breakfast', NOW);
  assert.equal(copied.length, 2);
  assert.equal(N.dayLog(s, '2026-11-10').count, 2);
  assert.equal(N.copyMeal(s, '2026-11-09', '2026-11-11', null, NOW).length, 3); // dia inteiro
  assert.equal(N.toggleFavorite(s, ovo.id), false);
});
