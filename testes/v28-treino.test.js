// Testes da versão 2.8 (frente B): sugestão de carga e treino pelo ciclo.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const R = require('../js/regras.js');
const T = require('../js/regras-treino.js');
const Cy = require('../js/regras-ciclo.js');

const NOW = '2026-11-10T12:00:00.000Z';
const iso = (min) => new Date(Date.parse(NOW) + min * 60000).toISOString();
const EX = 'ex:leg-press';

// Treino concluído do exercício com as séries [[carga, reps], ...] numa data.
function train(s, date, sets, o) {
  o = o || {};
  const x = T.startSession(s, date, null, iso(Date.parse(date) / 60000 % 100000));
  const it = T.addSessionExercise(s, x.id, o.ex || EX);
  it.targetReps = o.targetReps || '8-10';
  it.targetSets = o.targetSets || 3;
  sets.forEach(([load, reps], k) => { T.setItemValues(s, x.id, it.id, { load, reps }); T.logSet(s, x.id, it.id, iso(1 + k)); });
  if (!o.active) T.finishSession(s, x.id, iso(30));
  return { session: x, item: it };
}

/* ---------------- Faixa de repetições e passo ---------------- */

test('faixa de repetições: vários formatos', () => {
  assert.deepEqual(T.parseRepRange('8-10'), { min: 8, max: 10 });
  assert.deepEqual(T.parseRepRange('8 a 10'), { min: 8, max: 10 });
  assert.deepEqual(T.parseRepRange('12–15'), { min: 12, max: 15 });   // travessão
  assert.deepEqual(T.parseRepRange('10'), { min: 8, max: 10 });       // um número: piso 2 abaixo
  assert.deepEqual(T.parseRepRange('10 reps'), { min: 8, max: 10 });
  assert.deepEqual(T.parseRepRange('até 12'), { min: 10, max: 12 });
  assert.deepEqual(T.parseRepRange('3'), { min: 1, max: 3 });
  assert.deepEqual(T.parseRepRange(''), { min: 8, max: 10 });
  assert.deepEqual(T.parseRepRange(null), { min: 8, max: 10 });
});

test('passo do aumento: 2,5 kg só com o passo padrão e carga a partir de 20 kg', () => {
  assert.equal(T.loadIncrement(45, 1), 2.5);
  assert.equal(T.loadIncrement(20, 1), 2.5);
  assert.equal(T.loadIncrement(15, 1), 1);
  assert.equal(T.loadIncrement(45, 2), 2);      // passo escolhido pela usuária vale
  assert.equal(T.loadIncrement(45, 0.5), 0.5);
  assert.equal(T.loadIncrement(45, 0), 2.5);    // inválido volta ao padrão
});

/* ---------------- Sugestão de carga ---------------- */

test('sugestão: sem histórico ou só com treino em andamento não há sugestão', () => {
  const s = R.emptyState();
  assert.equal(T.suggestLoad(s, EX), null);
  train(s, '2026-11-08', [[45, 10], [45, 10], [45, 10]], { active: true });   // em andamento não conta
  assert.equal(T.suggestLoad(s, EX), null);
});

test('sugestão: todas as séries no máximo da faixa → subir um passo', () => {
  const s = R.emptyState();
  train(s, '2026-11-05', [[45, 10], [45, 10], [45, 10]]);
  const g = T.suggestLoad(s, EX);
  assert.equal(g.action, 'subir');
  assert.equal(g.load, 47.5);
  assert.equal(g.from, 45);
  assert.equal(g.headline, 'Hoje tente 47,5 kg');
  assert.match(g.reason, /10\/10 repetições.*45 kg/);
  assert.equal(g.warn, false);
  assert.deepEqual(g.basis.repsList, [10, 10, 10]);
  assert.equal(g.basis.targetMax, 10);
  assert.equal(g.basis.date, '2026-11-05');
  // o passo da usuária vale (com 45 kg e passo 2)
  s.workout.loadStep = 2;
  assert.equal(T.suggestLoad(s, EX).load, 47);
  // carga baixa com o passo padrão: sobe 1 kg
  const s2 = R.emptyState();
  train(s2, '2026-11-05', [[12, 10], [12, 10], [12, 10]]);
  assert.equal(T.suggestLoad(s2, EX).load, 13);
});

test('sugestão: ainda não bateu o máximo → manter e tentar mais 1 repetição', () => {
  const s = R.emptyState();
  train(s, '2026-11-05', [[45, 10], [45, 9], [45, 9]]);
  const g = T.suggestLoad(s, EX);
  assert.equal(g.action, 'manter');
  assert.equal(g.load, 45);
  assert.equal(g.headline, 'Mantenha 45 kg');
  assert.match(g.reason, /10\/9\/9/);
  assert.match(g.reason, /mais 1 repetição/);
});

test('sugestão: série incompleta não permite subir', () => {
  const s = R.emptyState();
  train(s, '2026-11-05', [[45, 10], [45, 10]]);          // fez 2 de 3 séries
  const g = T.suggestLoad(s, EX);
  assert.equal(g.action, 'manter');
  assert.match(g.reason, /Faltaram séries.*2 de 3/);
});

test('sugestão: faixa vem da ficha (opts.targetReps) e pode mudar o resultado', () => {
  const s = R.emptyState();
  train(s, '2026-11-05', [[45, 10], [45, 10], [45, 10]], { targetReps: '8-10' });
  assert.equal(T.suggestLoad(s, EX).action, 'subir');
  assert.equal(T.suggestLoad(s, EX, { targetReps: '12-15' }).action, 'manter');   // a ficha agora pede 12 a 15
  assert.equal(T.suggestLoad(s, EX, { targetReps: '10' }).action, 'subir');
  assert.equal(T.suggestLoad(s, EX, { targetSets: 4 }).action, 'manter');         // a ficha agora pede 4 séries
});

test('sugestão: reduzir só depois de 2 treinos seguidos abaixo do mínimo, na mesma carga', () => {
  const s = R.emptyState();
  train(s, '2026-11-01', [[40, 6], [40, 6], [40, 6]]);
  assert.equal(T.suggestLoad(s, EX).action, 'manter');                    // 1 vez só: ainda não
  train(s, '2026-11-05', [[40, 7], [40, 6], [40, 6]]);
  const g = T.suggestLoad(s, EX);
  assert.equal(g.action, 'reduzir');
  assert.equal(g.from, 40);
  assert.equal(g.load, 37.5);                                             // 7,5% a menos, no passo de 2,5
  assert.ok(g.load < g.from);
  assert.match(g.headline, /37,5 kg/);
  // carga diferente no treino anterior: não reduz (acabou de mudar)
  const s2 = R.emptyState();
  train(s2, '2026-11-01', [[45, 6], [45, 6], [45, 6]]);
  train(s2, '2026-11-05', [[40, 6], [40, 6], [40, 6]]);
  assert.equal(T.suggestLoad(s2, EX).action, 'manter');
  // média dentro da faixa no último treino: não reduz
  train(s, '2026-11-08', [[40, 8], [40, 8], [40, 8]]);
  assert.equal(T.suggestLoad(s, EX).action, 'manter');
  // carga pequena e passo 1: sempre reduz pelo menos 1 passo
  const s3 = R.emptyState();
  train(s3, '2026-11-01', [[8, 5], [8, 5], [8, 5]]);
  train(s3, '2026-11-05', [[8, 5], [8, 5], [8, 5]]);
  assert.equal(T.suggestLoad(s3, EX).load, 7);
});

test('sugestão: peso do corpo (carga 0) sugere mais repetições', () => {
  const s = R.emptyState();
  train(s, '2026-11-05', [[0, 12], [0, 12], [0, 12]], { targetReps: '10-12' });
  const g = T.suggestLoad(s, EX);
  assert.equal(g.action, 'subir');
  assert.equal(g.load, 0);
  assert.equal(g.reps, 13);
  assert.match(g.headline, /13 repetições/);
  const s2 = R.emptyState();
  train(s2, '2026-11-05', [[0, 10], [0, 11], [0, 12]], { targetReps: '10-12' });
  const g2 = T.suggestLoad(s2, EX);
  assert.equal(g2.action, 'manter');
  assert.equal(g2.load, 0);
  assert.match(g2.headline, /Mais 1 repetição/);
  // peso do corpo nunca vira "reduzir", mesmo abaixo do mínimo duas vezes
  const s3 = R.emptyState();
  train(s3, '2026-11-01', [[0, 4], [0, 4], [0, 4]], { targetReps: '10-12' });
  train(s3, '2026-11-05', [[0, 4], [0, 4], [0, 4]], { targetReps: '10-12' });
  assert.equal(T.suggestLoad(s3, EX).action, 'manter');
});

test('sugestão: carga diferente em cada série (pirâmide) sobe a série mais pesada', () => {
  const s = R.emptyState();
  train(s, '2026-11-05', [[40, 10], [45, 10], [50, 10]]);
  const g = T.suggestLoad(s, EX);
  assert.equal(g.action, 'subir');
  assert.equal(g.from, 50);
  assert.equal(g.load, 52.5);
  assert.equal(g.basis.mixed, true);
  assert.match(g.reason, /série mais pesada/);
  // alguma série abaixo do máximo: mantém
  const s2 = R.emptyState();
  train(s2, '2026-11-05', [[40, 10], [45, 10], [50, 8]]);
  assert.equal(T.suggestLoad(s2, EX).action, 'manter');
});

test('sugestão: aviso quando o aumento passa de 10% do recorde', () => {
  const s = R.emptyState();
  train(s, '2026-11-05', [[20, 10], [20, 10], [20, 10]]);     // 20 → 22,5 = +12,5% do recorde (20)
  const g = T.suggestLoad(s, EX);
  assert.equal(g.load, 22.5);
  assert.equal(g.warn, true);
  assert.match(g.reason, /Atenção.*10%.*20 kg/);
  const s2 = R.emptyState();
  train(s2, '2026-11-05', [[45, 10], [45, 10], [45, 10]]);    // +5,6%
  assert.equal(T.suggestLoad(s2, EX).warn, false);
});

test('sugestão: séries sem repetição são ignoradas e cada exercício tem a sua', () => {
  const s = R.emptyState();
  train(s, '2026-11-05', [[45, 10], [45, 10], [45, 10], [60, 0]]);   // a de 60 kg sem repetição não conta
  assert.equal(T.suggestLoad(s, EX).from, 45);
  train(s, '2026-11-06', [[20, 8], [20, 8], [20, 8]], { ex: 'ex:supino-reto', targetReps: '6-8' });
  assert.equal(T.suggestLoad(s, 'ex:supino-reto').action, 'subir');
  assert.equal(T.suggestLoad(s, 'ex:agachamento-livre'), null);
});

test('sugestões podem ser desligadas em extras.treino', () => {
  const s = R.emptyState();
  assert.equal(T.suggestionsEnabled(s), true);
  s.extras.treino = { hideSuggestions: true };
  assert.equal(T.suggestionsEnabled(s), false);
  s.extras.treino = { hideSuggestions: false };
  assert.equal(T.suggestionsEnabled(s), true);
  // passa pela migração (backup/transferência) sem perder o ajuste
  s.extras.treino = { hideSuggestions: true };
  assert.equal(R.migrate(JSON.parse(JSON.stringify(s))).extras.treino.hideSuggestions, true);
});

/* ---------------- Treino pelo ciclo ---------------- */

// 5 ciclos de 28 dias terminando perto de 2026-11-10 (hoje, dia 21 do ciclo, fase lútea).
const TODAY = '2026-11-10';
function cycleState() {
  const s = R.emptyState();
  ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23', '2026-10-21'].forEach((d) => Cy.savePeriod(s, null, { start: d, end: C.addDays(d, 4) }, NOW));
  return s;
}
function datesOf(s, phase) {
  const out = [], ctx = null;
  for (let d = '2026-07-01'; d <= TODAY; d = C.addDays(d, 1)) { const i = Cy.dayInfo(s, d, TODAY); if (i && i.phase === phase) out.push(d); }
  return out;
}

test('treino pelo ciclo: sem ciclo registrado não há nada', () => {
  const s = R.emptyState();
  const r = Cy.phaseTrainingInsights(s, TODAY);
  assert.equal(r.enabled, false);
  assert.deepEqual(r.sentences, []);
  assert.deepEqual(Cy.weekAhead(s, TODAY), []);
});

test('treino pelo ciclo: poucos dados não geram frases de energia nem de recordes', () => {
  const s = cycleState();
  datesOf(s, 'lut').slice(0, 3).forEach((d) => Cy.setDay(s, d, { energy: 1 }, NOW));      // só 3 registros
  const r = Cy.phaseTrainingInsights(s, TODAY);
  assert.equal(r.enabled, true);
  assert.equal(r.enough.energy, false);
  assert.equal(r.enough.records, false);
  assert.equal(r.sentences.filter((x) => /^energia|^recordes/.test(x.key)).length, 0);
  assert.equal(r.phases.length, 4);
});

test('treino pelo ciclo: energia mais baixa e mais alta por fase, comparadas com a média geral', () => {
  const s = cycleState();
  const energia = { men: 3, fol: 4, ovu: 5, lut: 2 };
  Object.keys(energia).forEach((p) => datesOf(s, p).forEach((d, i) => { if (i % 2 === 0 || p === 'ovu') Cy.setDay(s, d, { energy: energia[p] }, NOW); }));
  const r = Cy.phaseTrainingInsights(s, TODAY);
  assert.equal(r.enough.energy, true);
  const baixa = r.sentences.find((x) => x.key === 'energia-baixa'), alta = r.sentences.find((x) => x.key === 'energia-alta');
  assert.equal(baixa.phase, 'lut');
  assert.match(baixa.text, /fase lútea.*média 2.*contra \d,\d no geral.*mantenha as cargas e foque na técnica/);
  assert.equal(alta.phase, 'ovu');
  assert.match(alta.text, /fase ovulatória/);
  const lut = r.phases.find((p) => p.phase === 'lut');
  assert.equal(lut.energy, 2);
  assert.ok(lut.energyCount >= 6);
  assert.ok(Math.abs(r.overall.energy - 3.5) < 1.2);
});

test('treino pelo ciclo: recordes concentrados numa fase viram frase, e contam por fase', () => {
  const s = cycleState();
  // 5 treinos na fase ovulatória, cada um mais pesado que o anterior (4 recordes); 4 treinos em outras fases, sempre igual
  const ovu = datesOf(s, 'ovu'), fol = datesOf(s, 'fol');
  train(s, fol[0], [[40, 10], [40, 10], [40, 10]]);                   // 1º treino: sem recorde
  ovu.slice(0, 4).forEach((d, i) => train(s, d, [[42 + i * 2, 8], [42 + i * 2, 8], [42 + i * 2, 8]]));
  const r = Cy.phaseTrainingInsights(s, TODAY);
  assert.equal(r.enough.records, true);
  assert.equal(r.overall.records, 4);
  assert.equal(r.phases.find((p) => p.phase === 'ovu').records, 4);
  const f = r.sentences.find((x) => x.key === 'recordes');
  assert.equal(f.phase, 'ovu');
  assert.match(f.text, /Seus recordes costumam vir na fase ovulatória: 4 de 4 recordes/);
});

test('treino pelo ciclo: sintomas que se repetem na fase viram frase', () => {
  const s = cycleState();
  datesOf(s, 'lut').slice(0, 5).forEach((d) => Cy.setDay(s, d, { symptoms: ['inchaco', 'doce'] }, NOW));
  const r = Cy.phaseTrainingInsights(s, TODAY);
  const f = r.sentences.find((x) => x.key === 'sintomas');
  assert.equal(f.phase, 'lut');
  assert.match(f.text, /fase lútea.*inchaço.*vontade de doce/);
});

test('próximos 7 dias: fase, ficha planejada e dica de cada dia', () => {
  const s = cycleState();
  const p = T.createPlan(s, T.validatePlan({ name: 'Inferior', items: [{ exerciseId: EX, sets: 3, reps: '8-10', load: 40, restSec: 60 }] }).value, NOW);
  T.setWeekPlan(s, C.weekday(TODAY), p.id);                 // terça: hoje
  T.setDayPlan(s, C.addDays(TODAY, 2), 'rest');                // quinta: descanso marcado só nesse dia
  const w = Cy.weekAhead(s, TODAY);
  assert.equal(w.length, 7);
  assert.equal(w[0].date, TODAY);
  assert.equal(w[6].date, C.addDays(TODAY, 6));
  assert.equal(w[0].phase, 'lut');                          // dia 21 do ciclo
  assert.equal(w[0].phaseName, 'Lútea');
  assert.deepEqual(w[0].plan, { id: p.id, name: 'Inferior' });
  assert.equal(w[0].tip, Cy.PHASE_TIPS.lut);
  assert.equal(w[2].rest, true);
  assert.equal(w[2].plan, null);
  w.forEach((d) => assert.ok(['men', 'fol', 'ovu', 'lut'].indexOf(d.phase) >= 0));
  // dicas genéricas, sem prometer nada médico
  Object.keys(Cy.PHASE_TIPS).forEach((k) => assert.ok(!/%|garant|cura|trata/i.test(Cy.PHASE_TIPS[k])));
});
