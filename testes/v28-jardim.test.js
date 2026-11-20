// Testes da versão 2.8 (frente A): Jardim da Julia, Resumo semanal e cartões para compartilhar.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const R = require('../js/regras.js');
const T = require('../js/regras-treino.js');
const N = require('../js/regras-nutricao.js');
const J = require('../js/jardim.js');
const Rz = require('../js/telas/resumo.js');
const K = require('../js/cartoes.js');

const NOW = '2026-11-20T12:00:00.000Z';
const TODAY = '2026-11-20';                 // sexta-feira; a semana (dom a sáb) começa em 15/11
const iso = (min) => new Date(Date.parse(NOW) + min * 60000).toISOString();
const back = (n) => C.addDays(TODAY, -n);

// Treino de um exercício na data, com as séries [[carga, reps], ...].
function train(s, date, sets, ex) {
  const x = T.startSession(s, date, null, iso(Date.parse(date) / 60000 % 100000));
  const it = T.addSessionExercise(s, x.id, ex || 'ex:leg-press');
  sets.forEach(([load, reps], k) => { T.setItemValues(s, x.id, it.id, { load, reps }); T.logSet(s, x.id, it.id, iso(1 + k)); });
  T.finishSession(s, x.id, iso(30));
  return x;
}
const agua = (s, d, ml) => R.addWater(s, d, ml, NOW);
const comida = (s, d, q, g, meal) => N.addFoodLog(s, { date: d, meal: meal || 'lunch', foodId: N.search(s, q, 1)[0].id, grams: g }, NOW);
function tarefa(s, d, titulo, feita) {
  const t = R.createTask(s, { title: titulo, dueDate: d, category: 'Pessoal', priority: 'normal', recurrence: 'none' }, NOW);
  if (feita) R.setTaskDone(s, t.id, d, true, NOW);
  return t;
}
const ids = (h) => h.map((x) => x.id);
const feito = (h, id) => h.filter((x) => x.id === id)[0].feito;

/* ---------------- Hábitos do dia ---------------- */

test('hábitos: só entram os que a usuária usa; dia sem nada não tem hábitos', () => {
  const s = R.emptyState();
  assert.deepEqual(J.habitosDoDia(s, TODAY, TODAY), []);
  assert.equal(J.nivelDoDia(s, TODAY, TODAY), null);
  assert.deepEqual(J.habitosDoDia(s, C.addDays(TODAY, 3), TODAY), []);   // dia futuro
});

test('hábitos: treino feito, treino planejado (aberto) e descanso planejado não penaliza', () => {
  const s = R.emptyState();
  const p = T.createPlan(s, T.validatePlan({ name: 'A', items: [{ exerciseId: 'ex:leg-press', sets: 2, reps: '10', load: 50, restSec: 0 }] }).value, NOW);
  T.setWeekPlan(s, C.weekday(back(2)), p.id);            // anteontem tinha ficha
  T.setWeekPlan(s, C.weekday(back(1)), null);
  T.setDayPlan(s, back(1), 'rest');                       // ontem: descanso marcado
  train(s, back(3), [[50, 10]]);                          // treino livre feito, sem ficha
  assert.deepEqual(ids(J.habitosDoDia(s, back(1), TODAY)), []);                      // descanso: nenhum hábito, nada a cobrar
  const h2 = J.habitosDoDia(s, back(2), TODAY);
  assert.deepEqual(ids(h2), ['treino']);
  assert.equal(feito(h2, 'treino'), false);              // ficha do dia, não treinou
  assert.equal(feito(J.habitosDoDia(s, back(3), TODAY), 'treino'), true);
  assert.match(h2[0].detalhe, /Treino de A/);
  // quem nunca treinou (ou parou há mais de 14 dias) não é cobrada pela ficha da semana
  const novo = R.emptyState();
  const pn = T.createPlan(novo, T.validatePlan({ name: 'A', items: [{ exerciseId: 'ex:leg-press', sets: 2, reps: '10', load: 50, restSec: 0 }] }).value, NOW);
  for (let wd = 0; wd < 7; wd++) T.setWeekPlan(novo, wd, pn.id);
  assert.deepEqual(ids(J.habitosDoDia(novo, back(2), TODAY)), []);
  assert.deepEqual(ids(J.habitosDoDia(novo, TODAY, TODAY)), []);
  train(novo, back(20), [[50, 10]]);
  assert.deepEqual(ids(J.habitosDoDia(novo, back(2), TODAY)), []);            // passaram 18 dias
  assert.deepEqual(ids(J.habitosDoDia(novo, back(10), TODAY)), ['treino']);   // 10 dias depois do treino: a ficha volta a valer
});

test('hábitos: água e proteína só valem depois de usadas; metas batidas', () => {
  const s = R.emptyState();
  s.bodyRecords.push({ id: 'b', date: back(40), weightKg: 60 });   // meta de proteína automática (96 → 95 g) e de água (2100)
  assert.deepEqual(ids(J.habitosDoDia(s, TODAY, TODAY)), []);
  agua(s, back(1), 2200);                                            // usou água ontem
  comida(s, back(1), 'frango', 600);                                 // 600 g passam de 90% da meta
  const goalP = N.proteinTarget(s).value, dia = N.dayLog(s, back(1)).total.prot;
  assert.ok(dia >= 0.9 * goalP, 'frango suficiente para a meta: ' + dia + ' / ' + goalP);
  const h = J.habitosDoDia(s, back(1), TODAY);
  assert.deepEqual(ids(h), ['agua', 'proteina']);
  assert.equal(feito(h, 'agua'), true);
  assert.equal(feito(h, 'proteina'), true);
  const hoje = J.habitosDoDia(s, TODAY, TODAY);                      // hoje ainda sem nada, mas os hábitos já estão ativos
  assert.deepEqual(ids(hoje), ['agua', 'proteina']);
  assert.equal(feito(hoje, 'agua'), false);
  assert.match(hoje[0].detalhe, /0 ml de/);
  // 15 dias sem usar: o hábito se aposenta sozinho
  assert.deepEqual(ids(J.habitosDoDia(s, C.addDays(back(1), 16), C.addDays(back(1), 20))), []);
});

test('hábitos: tarefas (80%), skincare e sono pelo contrato dos dados', () => {
  const s = R.emptyState();
  tarefa(s, back(1), 'a', true); tarefa(s, back(1), 'b', true); tarefa(s, back(1), 'c', true); tarefa(s, back(1), 'd', true); tarefa(s, back(1), 'e', false); // 4 de 5 = 80%
  tarefa(s, back(2), 'x', true); tarefa(s, back(2), 'y', false);                                                                                         // 1 de 2
  let h = J.habitosDoDia(s, back(1), TODAY);
  assert.equal(feito(h, 'tarefas'), true);
  assert.equal(h[0].detalhe, '4 de 5 tarefas');
  assert.equal(feito(J.habitosDoDia(s, back(2), TODAY), 'tarefas'), false);
  s.extras.skincare = { steps: { manha: [{ id: 'm1', name: 'Limpar' }], noite: [{ id: 'n1', name: 'Hidratar' }, { id: 'n2', name: 'Sérum' }] },
    logs: { [back(1)]: { manha: ['m1'], noite: ['n1', 'n2'] }, [back(2)]: { manha: ['m1'], noite: ['n1'] } } };
  s.extras.sono = { goalHours: 8, logs: [{ id: 'a', date: back(1), hours: 8.5 }, { id: 'b', date: back(2), hours: 6.5 }] };
  h = J.habitosDoDia(s, back(1), TODAY);
  assert.deepEqual(ids(h), ['tarefas', 'skincare', 'sono']);
  assert.equal(feito(h, 'skincare'), true);
  assert.equal(feito(h, 'sono'), true);
  h = J.habitosDoDia(s, back(2), TODAY);
  assert.equal(feito(h, 'skincare'), false);
  assert.equal(h.filter((x) => x.id === 'skincare')[0].detalhe, 'Manhã 1/1 • Noite 1/2');
  assert.equal(feito(h, 'sono'), false);
  assert.match(h.filter((x) => x.id === 'sono')[0].detalhe, /6h30 de sono \(meta 8h\)/);
  // meta de sono do usuário
  s.extras.sono.goalHours = 6;
  assert.equal(feito(J.habitosDoDia(s, back(2), TODAY), 'sono'), true);
});

test('leitura de sono e skincare: sem dados, dados malformados e o contrato da outra frente', () => {
  const s = R.emptyState();
  assert.equal(J.leitura.sleepOn(s, TODAY), null);
  assert.equal(J.leitura.sleepAvg(s, back(7), TODAY), null);
  assert.equal(J.leitura.sleepGoal(s), 8);
  assert.equal(J.leitura.skincareDay(s, TODAY).active, false);
  s.extras.sono = 'quebrado'; s.extras.skincare = { steps: 5 };
  assert.equal(J.leitura.sleepOn(s, TODAY), null);
  assert.equal(J.leitura.skincareDay(s, TODAY).active, false);
  s.extras.sono = { goalHours: 99, logs: [{ id: 'a', date: back(1), hours: 7 }, { id: 'b', date: back(2), hours: 8 }] };
  assert.equal(J.leitura.sleepGoal(s), 8);                                  // meta absurda volta ao padrão
  assert.equal(J.leitura.sleepAvg(s, back(7), TODAY), 7.5);
});

/* ---------------- Nível, sequência e semanas ---------------- */

test('nível da flor pelas frações de hábitos feitos', () => {
  const h = (feitos, total) => Array.from({ length: total }, (_, i) => ({ id: 'x' + i, feito: i < feitos }));
  assert.equal(J.nivelDoDia([]), null);
  assert.equal(J.nivelDoDia(h(0, 3)), 0);   // semente
  assert.equal(J.nivelDoDia(h(1, 3)), 1);   // 33%: broto
  assert.equal(J.nivelDoDia(h(1, 2)), 2);   // 50%: botão
  assert.equal(J.nivelDoDia(h(2, 3)), 2);   // 67%: botão
  assert.equal(J.nivelDoDia(h(3, 4)), 3);   // 75%: aberta
  assert.equal(J.nivelDoDia(h(4, 4)), 4);   // 100%: florada
  assert.equal(J.nivelDoDia(h(1, 1)), 4);
  assert.equal(J.NOMES.length, 5);
});

// Um dia "florido" (nível ≥ 2): treino livre feito + água na meta (2/2 hábitos = 100%).
function diaFlorido(s, d) { train(s, d, [[50, 10]]); agua(s, d, 3000); }
function diaFraco(s, d) { agua(s, d, 100); }            // água ativa, meta não batida, sem treino: nível 0

test('sequência: dias seguidos com nível ≥ 2; hoje aberto não quebra; dia sem hábito é pulado', () => {
  const s = R.emptyState();
  assert.equal(J.sequencia(s, TODAY), 0);
  diaFlorido(s, back(3)); diaFlorido(s, back(2)); diaFlorido(s, back(1));
  assert.equal(J.sequencia(s, TODAY), 3);                  // hoje ainda sem nada (aberto): não zera
  diaFlorido(s, TODAY);
  assert.equal(J.sequencia(s, TODAY), 4);                  // hoje florido soma
  // ontem fraco quebra
  const s2 = R.emptyState();
  diaFlorido(s2, back(4)); diaFlorido(s2, back(3)); diaFraco(s2, back(2)); diaFlorido(s2, back(1));
  assert.equal(J.sequencia(s2, TODAY), 1);
  assert.equal(J.melhorSequencia(s2, TODAY), 2);
  // dias sem nenhum hábito ativo não contam e não quebram: só treinos livres de vez em quando (sem água, comida, tarefas)
  const s3 = R.emptyState();
  train(s3, back(5), [[50, 10]]); train(s3, back(3), [[50, 10]]); train(s3, back(1), [[50, 10]]);
  assert.deepEqual(ids(J.habitosDoDia(s3, back(2), TODAY)), []);
  assert.equal(J.sequencia(s3, TODAY), 3);                 // os dias vazios no meio são pulados
  // quem parou de usar um hábito há mais de 14 dias volta a ter dias sem hábito (não conta nem quebra)
  const s5 = R.emptyState();
  diaFlorido(s5, back(80)); diaFlorido(s5, back(79));
  assert.equal(J.sequencia(s5, TODAY), 0);                 // a água ficou ativa por 14 dias sem uso (flor 0) e quebrou
  // hoje fraco (aberto) não quebra
  const s4 = R.emptyState();
  diaFlorido(s4, back(1)); diaFraco(s4, TODAY);
  assert.equal(J.nivelDoDia(s4, TODAY, TODAY), 0);
  assert.equal(J.sequencia(s4, TODAY), 1);
});

test('semanas floridas: semana (dom a sáb) com pelo menos 5 dias de flor aberta', () => {
  const s = R.emptyState();
  const semAnt = C.addDays(J.inicioSemana(TODAY), -7);   // 08/11 a 14/11
  for (let i = 0; i < 5; i++) diaFlorido(s, C.addDays(semAnt, i));
  diaFlorido(s, C.addDays(J.inicioSemana(TODAY), 0)); diaFlorido(s, C.addDays(J.inicioSemana(TODAY), 1));   // semana atual: só 2
  const wk = J.semanas(s, TODAY, 3);
  assert.equal(wk.length, 3);
  assert.deepEqual(wk.map((w) => w.inicio), [C.addDays(semAnt, -7), semAnt, J.inicioSemana(TODAY)]);
  assert.deepEqual(wk.map((w) => w.floresceu), [false, true, false]);
  assert.equal(wk[2].dias.length, 7);
  assert.equal(wk[2].dias[6].futuro, true);               // sábado ainda não chegou
  assert.equal(J.semanasFloridas(s, TODAY), 1);
});

/* ---------------- Conquistas ---------------- */

test('conquistas: calculadas do histórico, com progresso e "novo" até serem vistas', () => {
  const s = R.emptyState();
  let c = J.conquistas(s, TODAY);
  assert.equal(c.filter((x) => x.feito).length, 0);
  assert.equal(c.filter((x) => x.id === 'agua-7')[0].progresso, '0 de 7');
  train(s, back(9), [[40, 10]]); train(s, back(5), [[45, 10]]);          // 2º treino bate o recorde de carga
  for (let i = 1; i <= 7; i++) agua(s, back(i), 3000);                   // 7 dias seguidos de meta de água
  c = J.conquistas(s, TODAY);
  const by = (id) => c.filter((x) => x.id === id)[0];
  assert.equal(by('primeiro-treino').feito, true);
  assert.equal(by('treinos-10').feito, false);
  assert.equal(by('treinos-10').progresso, '2 de 10');
  assert.equal(by('primeiro-recorde').feito, true);
  assert.equal(by('agua-7').feito, true);
  assert.equal(by('agua-7').novo, true);
  // vistas: deixam de ser novas
  s.extras.jardim = { vistos: { 'agua-7': TODAY } };
  assert.equal(J.conquistas(s, TODAY).filter((x) => x.id === 'agua-7')[0].novo, false);
  assert.equal(J.conquistas(s, TODAY).filter((x) => x.id === 'primeiro-treino')[0].novo, true);
  // 7 dias seguidos exige dias consecutivos
  const s2 = R.emptyState();
  [1, 2, 3, 5, 6, 7, 8].forEach((i) => agua(s2, back(i), 3000));
  assert.equal(J.conquistas(s2, TODAY).filter((x) => x.id === 'agua-7')[0].feito, false);
  assert.equal(J.conquistas(s2, TODAY).filter((x) => x.id === 'agua-7')[0].atual, 4);
  // ciclos acompanhados
  s2.cyclePeriods = [{ id: '1', start: '2026-08-01' }, { id: '2', start: '2026-08-30' }, { id: '3', start: '2026-09-28' }];
  assert.equal(J.conquistas(s2, TODAY).filter((x) => x.id === 'ciclos-3')[0].feito, true);
});

test('frases do jardim são gentis e determinísticas', () => {
  const h = (feitos, total) => ({ feitos, total });
  const proibidas = /falh|culp|fracass|preguiç|atras|péssim|horr/i;
  [[h(0, 3), false], [h(1, 3), false], [h(3, 3), false], [null, false], [h(0, 3), true]].forEach(([hoje, fraca]) => {
    ['2026-11-19', '2026-11-20', '2026-11-21'].forEach((k) => {
      const f = J.fraseDoDia(hoje, fraca, k);
      assert.ok(f.length > 10);
      assert.doesNotMatch(f, proibidas);
      assert.equal(f, J.fraseDoDia(hoje, fraca, k));        // mesma chave, mesma frase
    });
  });
  assert.match(J.fraseDoDia(h(3, 3), false, 'x'), /flor|florido|completo/i);
});

/* ---------------- Resumo semanal ---------------- */

function semanaCheia() {
  const s = R.emptyState();
  s.bodyRecords.push({ id: 'b0', date: '2026-11-10', weightKg: 62 }, { id: 'b1', date: '2026-11-18', weightKg: 61.4 });   // peso: antes e dentro da semana
  const p = T.createPlan(s, T.validatePlan({ name: 'A', items: [{ exerciseId: 'ex:leg-press', sets: 2, reps: '10', load: 50, restSec: 0 }] }).value, NOW);
  [1, 3, 5].forEach((wd) => T.setWeekPlan(s, wd, p.id));       // seg, qua e sex: 3 treinos planejados
  train(s, '2026-11-02', [[50, 10]]);                          // antes da semana (histórico)
  train(s, '2026-11-16', [[55, 10], [55, 10]]);                // seg 16: bate recorde (55 > 50)
  train(s, '2026-11-18', [[55, 12]]);                          // qua 18: mais reps com 55 kg
  agua(s, '2026-11-16', 3000); agua(s, '2026-11-17', 500);
  comida(s, '2026-11-16', 'frango', 250); comida(s, '2026-11-17', 'arroz', 150);
  tarefa(s, '2026-11-17', 't1', true); tarefa(s, '2026-11-17', 't2', true); tarefa(s, '2026-11-18', 't3', false);
  return s;
}

test('resumo: treinos, recordes, alimentação, água, peso e tarefas da semana', () => {
  const s = semanaCheia();
  const w = Rz.semana(s, '2026-11-15', TODAY);
  assert.equal(w.vazia, false);
  assert.equal(w.atual, true);
  assert.equal(w.decorridos, 6);                              // domingo a sexta
  assert.equal(w.treino.feitos, 2);
  assert.equal(w.treino.dias, 2);
  assert.equal(w.treino.planejados, 3);
  assert.equal(w.treino.series, 3);
  assert.equal(w.treino.volume, 55 * 10 * 2 + 55 * 12);
  assert.equal(w.treino.recordes.length, 1);                  // um por exercício: o de carga vale mais que o de repetições
  assert.deepEqual([w.treino.recordes[0].kind, w.treino.recordes[0].load], ['carga', 55]);
  assert.equal(w.alimentacao.dias, 2);
  assert.ok(w.alimentacao.protMedia > 0);
  assert.equal(w.alimentacao.protMeta, N.proteinTarget(s).value);
  assert.equal(w.agua.dias, 2);
  assert.equal(w.agua.diasMeta, 1);
  assert.equal(w.peso.atual, 61.4);
  assert.equal(w.peso.variacao, -0.6);                        // 61,4 − 62 (última pesagem antes da semana)
  assert.deepEqual([w.tarefas.total, w.tarefas.feitas, w.tarefas.pct], [3, 2, 67]);
  assert.equal(w.sono, null);
  assert.equal(w.skincare, null);
  assert.equal(w.jardim.niveis.length, 7);
  assert.equal(w.jardim.niveis[6], null);                     // sábado: futuro
  // semana antiga sem nada (a de 08/11 tem só a pesagem de 10/11)
  const v = Rz.semana(s, '2026-10-25', TODAY);
  assert.equal(v.treino.feitos, 0);                           // só há treinos planejados (seg, qua e sex): nada feito
  assert.equal(v.treino.planejados, 3);
  assert.equal(v.vazia, true);
  assert.equal(Rz.semana(s, '2026-11-29', TODAY).futura, true);
});

test('resumo: sono, skincare e ciclo entram quando há dados', () => {
  const s = semanaCheia();
  s.extras.sono = { goalHours: 8, logs: [{ id: 'a', date: '2026-11-16', hours: 7 }, { id: 'b', date: '2026-11-17', hours: 8 }] };
  s.extras.skincare = { steps: { manha: [{ id: 'm', name: 'Limpar' }], noite: [] }, logs: { '2026-11-16': { manha: ['m'] }, '2026-11-17': { manha: [] } } };
  s.cyclePeriods = [{ id: 'p', start: '2026-11-12', end: '2026-11-16' }];
  s.cycleDays = { '2026-11-16': { energy: 4 }, '2026-11-17': { energy: 2 } };
  const w = Rz.semana(s, '2026-11-15', TODAY);
  assert.equal(w.sono.media, 7.5);
  assert.equal(w.sono.noites, 2);
  assert.deepEqual([w.skincare.dias, w.skincare.completos], [1, 1]);
  assert.ok(w.ciclo.fases.length >= 1);
  assert.equal(w.ciclo.energia, 3);
});

test('resumo: texto carinhoso, determinístico e sem culpa', () => {
  const s = semanaCheia();
  const w = Rz.semana(s, '2026-11-15', TODAY), t1 = Rz.texto(w), t2 = Rz.texto(Rz.semana(s, '2026-11-15', TODAY));
  assert.equal(t1.paragrafo, t2.paragrafo);                   // mesma semana, mesmo texto
  assert.match(t1.paragrafo, /2 (vezes|treinos)|2 treinos/);
  assert.match(t1.paragrafo, /recorde/);
  assert.ok(t1.destaques.length >= 2 && t1.destaques.length <= 5);
  assert.ok(t1.destaques.every((d) => d.icone && d.texto));
  const proibidas = /falh|culp|fracass|preguiç|péssim|horr|você precisa|deveria/i;
  assert.doesNotMatch(t1.paragrafo, proibidas);
  // semana sem treino planejado cumprido: gentil
  const fraca = R.emptyState();
  fraca.workout.week[1] = null;
  const pl = T.createPlan(fraca, T.validatePlan({ name: 'A', items: [{ exerciseId: 'ex:leg-press', sets: 2, reps: '10', load: 50, restSec: 0 }] }).value, NOW);
  T.setWeekPlan(fraca, 1, pl.id); agua(fraca, '2026-11-09', 200);
  const tf = Rz.texto(Rz.semana(fraca, '2026-11-08', TODAY));
  assert.doesNotMatch(tf.paragrafo, proibidas);
  assert.match(tf.paragrafo, /folha em branco|outra hora/);
  // semana vazia e semana futura
  assert.match(Rz.texto(Rz.semana(R.emptyState(), '2026-11-08', TODAY)).paragrafo, /ainda não tem registros|nada registrado/);
  assert.match(Rz.texto(Rz.semana(s, '2026-11-29', TODAY)).paragrafo, /ainda não chegou/);
  // semana atual em andamento com treino planejado e ainda sem treino: "ainda dá tempo"
  const inicio = R.emptyState();
  const pi = T.createPlan(inicio, T.validatePlan({ name: 'A', items: [{ exerciseId: 'ex:leg-press', sets: 2, reps: '10', load: 50, restSec: 0 }] }).value, NOW);
  T.setWeekPlan(inicio, 5, pi.id); T.setWeekPlan(inicio, 6, pi.id);
  assert.match(Rz.texto(Rz.semana(inicio, '2026-11-15', TODAY)).paragrafo, /ainda dá tempo/);
});

test('resumo: períodos e dados do cartão (sem peso, ciclo ou sono)', () => {
  assert.equal(Rz.periodo('2026-11-15'), '15 a 21 de novembro');
  assert.equal(Rz.periodo('2026-10-25'), '25 a 31 de outubro');
  assert.equal(Rz.periodo('2026-10-29'), '29 out a 4 nov');
  const s = semanaCheia();
  s.extras.sono = { logs: [{ date: '2026-11-16', hours: 7 }] };
  s.cyclePeriods = [{ id: 'p', start: '2026-11-12', end: '2026-11-16' }];
  const w = Rz.semana(s, '2026-11-15', TODAY), c = Rz.paraCartao(w, Rz.texto(w));
  assert.equal(c.periodo, '15 a 21 de novembro');
  assert.ok(c.itens.length >= 3 && c.itens.length <= 6);
  assert.deepEqual(c.itens[0], { valor: '2', rotulo: 'treinos' });
  const json = JSON.stringify(c);
  assert.doesNotMatch(json, /61[,.]4|peso|sono|fase|energia|menstru/i);
  assert.equal(c.niveis.length, 7);
});

/* ---------------- Cartões ---------------- */

test('cartões: conteúdo de cada tipo', () => {
  const r = K.descrever('recorde', { name: 'Agachamento livre', kind: 'carga', load: 47, reps: 8, prevLoad: 45 });
  assert.deepEqual([r.kicker, r.titulo, r.grande, r.sub, r.icone], ['Novo recorde!', 'Agachamento livre', '47 kg × 8', 'antes: 45 kg', 'trofeu']);
  assert.match(r.alt, /Novo recorde! Agachamento livre: 47 kg × 8, antes: 45 kg\./);
  assert.equal(K.descrever('recorde', { name: 'Supino', kind: 'carga', load: 22.5, reps: 8, prevLoad: 0 }).grande, '22,5 kg × 8');
  assert.equal(K.descrever('recorde', { name: 'Supino', kind: 'carga', load: 22.5, reps: 8, prevLoad: 0 }).sub, 'a maior carga até agora');
  const rr = K.descrever('recorde', { name: 'Flexão', kind: 'reps', load: 0, reps: 14, prevReps: 12 });
  assert.equal(rr.grande, '14 repetições');
  assert.equal(rr.sub, 'com 0 kg • antes: 12');
  const sm = K.descrever('semana', { periodo: '15 a 21 de novembro', frase: 'Um passinho de cada vez.', itens: Array.from({ length: 9 }, (_, i) => ({ valor: String(i), rotulo: 'x' })), niveis: [0, 1, 2, 3, 4, null, 2, 4] });
  assert.equal(sm.itens.length, 6);                          // no máximo 6
  assert.equal(sm.niveis.length, 7);
  assert.equal(sm.titulo, '15 a 21 de novembro');
  const jd = K.descrever('jardim', { sequencia: 12, melhor: 20, semanasFloridas: 3, niveis: new Array(20).fill(2) });
  assert.equal(jd.titulo, '12 dias de sequência');
  assert.deepEqual(jd.itens.map((i) => i.rotulo), ['semanas floridas', 'melhor sequência']);
  assert.equal(jd.niveis.length, 14);
  assert.equal(K.descrever('jardim', { sequencia: 1, semanasFloridas: 1 }).titulo, '1 dia de sequência');
  assert.equal(K.descrever('jardim', { sequencia: 0, semanasFloridas: 0 }).titulo, 'Meu jardim está florescendo');
  const cq = K.descrever('conquista', { titulo: 'Semana hidratada 💧', texto: 'Sete dias 🌸 seguidos' });
  assert.deepEqual([cq.kicker, cq.titulo, cq.frase], ['Nova conquista', 'Semana hidratada', 'Sete dias seguidos']);   // sem emojis (o canvas pode não ter a fonte)
  assert.equal(K.descrever('desconhecido', { titulo: 'Oi' }).titulo, 'Oi');
  assert.equal(K.descrever('recorde', {}).titulo, 'Exercício');
});

test('cartões: quebra de linhas', () => {
  const medir = (t) => t.length * 10;
  assert.deepEqual(K.quebrar(medir, 'um dois três quatro cinco seis sete', 100), ['um dois', 'três', 'quatro', 'cinco seis', 'sete']);
  assert.deepEqual(K.quebrar(medir, '', 100), []);
  assert.deepEqual(K.quebrar(medir, 'curto', 100), ['curto']);
  const longa = K.quebrar(medir, 'supercalifragilistico', 100);       // palavra maior que a linha é partida
  assert.ok(longa.length >= 2 && longa.every((l) => medir(l) <= 100), JSON.stringify(longa));
  assert.equal(longa.join(''), 'supercalifragilistico');
});
