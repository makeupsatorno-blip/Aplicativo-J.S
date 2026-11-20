// Testes da versão 2.8 — Bem-estar: registro de sono e rotina de skincare (inclui os lembretes de skincare).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const R = require('../js/regras.js');
const T = require('../js/regras-treino.js');
const B = require('../js/regras-bemestar.js');

const NOW = '2026-11-20T12:00:00.000Z';
const TODAY = '2026-11-20';

/* ======================= Sono ======================= */

test('sono: validar horas direto, vírgula, limites, dia e qualidade', () => {
  assert.deepEqual(B.validateSleep({ date: TODAY, hours: '7,5' }).value, { date: TODAY, hours: 7.5, quality: null, bed: null, wake: null });
  assert.equal(B.validateSleep({ date: TODAY, hours: 8 }).ok, true);
  assert.equal(B.validateSleep({ date: TODAY, hours: 0 }).ok, true);
  assert.equal(B.validateSleep({ date: TODAY, hours: 16 }).ok, true);
  assert.ok(B.validateSleep({ date: TODAY, hours: 17 }).errors.hours);
  assert.ok(B.validateSleep({ date: TODAY, hours: -1 }).errors.hours);
  assert.ok(B.validateSleep({ date: TODAY, hours: '' }).errors.hours);
  assert.ok(B.validateSleep({ date: TODAY, hours: 'abc' }).errors.hours);
  assert.ok(B.validateSleep({ date: 'x', hours: 7 }).errors.date);
  assert.ok(B.validateSleep({ date: '2026-11-25', hours: 7, today: TODAY }).errors.date);
  assert.equal(B.validateSleep({ date: '2026-11-25', hours: 7 }).ok, true); // sem "today" não compara
  assert.equal(B.validateSleep({ date: TODAY, hours: 7, quality: '4' }).value.quality, 4);
  assert.equal(B.validateSleep({ date: TODAY, hours: 7, quality: '' }).value.quality, null);
  assert.ok(B.validateSleep({ date: TODAY, hours: 7, quality: 9 }).errors.quality);
});

test('sono: "dormi às / acordei às" calcula as horas, inclusive passando da meia-noite', () => {
  assert.equal(B.validateSleep({ date: TODAY, bed: '23:00', wake: '07:00' }).value.hours, 8);
  assert.equal(B.validateSleep({ date: TODAY, bed: '23:30', wake: '06:15' }).value.hours, 6.8); // 6 h 45 -> 6,8
  assert.equal(B.validateSleep({ date: TODAY, bed: '01:00', wake: '08:30' }).value.hours, 7.5);  // mesmo dia
  assert.equal(B.validateSleep({ date: TODAY, bed: '23:00', wake: '07:00' }).value.bed, '23:00');
  // os horários mandam (as horas digitadas são ignoradas)
  assert.equal(B.validateSleep({ date: TODAY, hours: 3, bed: '22:00', wake: '06:00' }).value.hours, 8);
  assert.ok(B.validateSleep({ date: TODAY, bed: '23:00', wake: '23:00' }).errors.wake);       // iguais
  assert.ok(B.validateSleep({ date: TODAY, bed: '23:00' }).errors.bed);                        // falta um
  assert.ok(B.validateSleep({ date: TODAY, bed: '25:00', wake: '07:00' }).errors.bed);         // hora inválida
  assert.ok(B.validateSleep({ date: TODAY, bed: '02:00', wake: '23:00' }).errors.wake);        // 21 h: confira
});

test('sono: salvar substitui o registro do mesmo dia, desfazer e excluir', () => {
  const s = R.emptyState();
  const a = B.saveSleep(s, { date: '2026-11-19', hours: 7 }, NOW);
  assert.equal(a.ok, true);
  assert.equal(a.previous, null);
  assert.equal(s.extras.sono.logs.length, 1);
  assert.equal(s.extras.sono.goalHours, 8);
  B.saveSleep(s, { date: '2026-11-18', hours: 6 }, NOW);
  assert.deepEqual(s.extras.sono.logs.map((l) => l.date), ['2026-11-18', '2026-11-19']); // ordenado
  const b = B.saveSleep(s, { date: '2026-11-19', hours: 8.5, quality: 5 }, '2026-11-20T13:00:00.000Z');
  assert.equal(s.extras.sono.logs.length, 2);                      // não duplica
  assert.equal(b.log.id, a.log.id);                                // mantém o id
  assert.equal(b.log.createdAt, NOW);
  assert.equal(b.previous.hours, 7);
  // desfazer: volta ao que era
  B.restoreSleep(s, b.log.id, b.previous);
  assert.equal(B.sleepOn(s, '2026-11-19').hours, 7);
  // desfazer o primeiro salvamento: some
  const c = B.saveSleep(s, { date: '2026-11-17', hours: 5 }, NOW);
  B.restoreSleep(s, c.log.id, c.previous);
  assert.equal(B.sleepOn(s, '2026-11-17'), null);
  // excluir e recolocar
  const gone = B.deleteSleep(s, a.log.id);
  assert.equal(gone.hours, 7);
  assert.equal(B.sleepOn(s, '2026-11-19'), null);
  assert.equal(B.deleteSleep(s, 'nao-existe'), null);
  B.putSleep(s, gone);
  assert.equal(B.sleepOn(s, '2026-11-19').hours, 7);
  // salvamento inválido não mexe em nada
  const bad = B.saveSleep(s, { date: TODAY, hours: 99 }, NOW);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.hours);
  assert.equal(s.extras.sono.logs.length, 2);
});

test('sono: média, estatísticas da semana, dívida de sono e meta', () => {
  const s = R.emptyState();
  assert.equal(B.sleepAvg(s, '2026-11-14', TODAY), null);
  assert.equal(B.goalHours(s), 8);
  [['2026-11-15', 7], ['2026-11-17', 6], ['2026-11-19', 9], ['2026-11-20', 8]].forEach(([d, h]) => B.saveSleep(s, { date: d, hours: h, quality: d === '2026-11-19' ? 5 : null }, NOW));
  assert.equal(B.sleepAvg(s, '2026-11-14', TODAY), 7.5);
  assert.equal(B.sleepAvg(s, '2026-11-18', TODAY), 8.5);
  const st = B.sleepStats(s, TODAY, 7);
  assert.equal(st.days.length, 7);
  assert.equal(st.days[0].date, '2026-11-14');
  assert.equal(st.days[6].date, TODAY);
  assert.equal(st.count, 4);
  assert.equal(st.metCount, 2);                       // 9 h e 8 h
  assert.equal(st.avg, 7.5);
  assert.deepEqual(st.best, { date: '2026-11-19', hours: 9 });
  assert.deepEqual(st.worst, { date: '2026-11-17', hours: 6 });
  assert.equal(st.balance, 2);                        // (1) + (2) + (-1) + 0
  assert.equal(st.debt, 2);
  assert.equal(st.avgQuality, 5);
  assert.equal(st.days[2].hours, null);               // 16/11 sem registro
  assert.equal(st.days[2].met, null);
  // noites longas compensam: dívida nunca negativa
  const s2 = R.emptyState();
  B.saveSleep(s2, { date: '2026-11-19', hours: 10 }, NOW);
  assert.equal(B.sleepStats(s2, TODAY).debt, 0);
  assert.equal(B.sleepStats(s2, TODAY).balance, -2);
  // meta
  assert.equal(B.setSleepGoal(s, '7,5'), 7.5);
  assert.equal(B.goalHours(s), 7.5);
  assert.equal(B.setSleepGoal(s, 7.8), 8);            // arredonda para meia hora
  assert.equal(B.setSleepGoal(s, 3), null);
  assert.equal(B.setSleepGoal(s, 13), null);
  assert.equal(B.setSleepGoal(s, 'x'), null);
  assert.equal(B.goalHours(s), 8);
  assert.equal(B.sleepStats(s, TODAY).metCount, 2);   // com meta 8
});

test('sono: dados estranhos no estado não quebram as leituras', () => {
  const s = R.emptyState();
  s.extras = { sono: { goalHours: 'x', logs: [null, 3, { date: 'ruim', hours: 7 }, { date: TODAY, hours: 'abc' }, { date: TODAY, hours: 7 }] } };
  assert.equal(B.goalHours(s), 8);
  assert.equal(B.sleepLogs(s).length, 1);
  assert.equal(B.sleepOn(s, TODAY).hours, 7);
  assert.equal(B.sleepStats(s, TODAY).count, 1);
  assert.equal(B.latestSleep(s, TODAY).date, TODAY);
  assert.equal(B.latestSleep({ extras: {} }, TODAY), null);
  assert.equal(B.sleepOn({}, TODAY), null);
  // ler não cria nada
  const vazio = R.emptyState();
  B.sleepStats(vazio, TODAY); B.skincareDay(vazio, TODAY); B.wellbeingActive(vazio, TODAY);
  assert.deepEqual(vazio.extras, {});
});

test('sono × energia: só compara com pelo menos 5 dias de cada lado', () => {
  const s = R.emptyState();
  let d = '2026-11-01';
  const put = (hours, energy) => { B.saveSleep(s, { date: d, hours }, NOW); s.cycleDays = s.cycleDays || {}; s.cycleDays[d] = { energy }; d = C.addDays(d, 1); };
  for (let i = 0; i < 4; i++) put(8, 4);
  for (let i = 0; i < 5; i++) put(6, 3);
  assert.equal(B.sleepVsEnergy(s, TODAY), null);                    // 4 de um lado
  put(8.5, 5);                                                       // agora 5 e 5
  const r = B.sleepVsEnergy(s, TODAY);
  assert.deepEqual([r.comMeta.n, r.abaixo.n], [5, 5]);
  assert.equal(r.comMeta.mediaEnergia, 4.2);                         // (4*4 + 5) / 5
  assert.equal(r.abaixo.mediaEnergia, 3);
  assert.equal(r.diff, 1.2);
  assert.equal(r.threshold, 8);
  // outro corte
  assert.equal(B.sleepVsEnergy(s, TODAY, { threshold: 6 }), null);   // todos ficam acima: abaixo = 0
  // dia sem energia registrada não entra
  delete s.cycleDays['2026-11-01'];
  assert.equal(B.sleepVsEnergy(s, TODAY), null);
});

test('sono × recordes: dias de treino com recorde após noites na meta e abaixo dela', () => {
  const s = R.emptyState();
  const p = T.createPlan(s, T.validatePlan({ name: 'A', items: [{ exerciseId: 'ex:leg-press', sets: 1, reps: '10', load: 50, restSec: 0 }] }).value, NOW);
  for (let i = 0; i < 8; i++) {
    const day = C.addDays('2026-11-01', i), x = T.startSession(s, day, p.id, NOW);
    T.setItemValues(s, x.id, x.items[0].id, { load: 50 + i * 5 });                 // carga sobe todo dia: recorde a partir do 2º
    T.logSet(s, x.id, x.items[0].id, NOW);
    T.finishSession(s, x.id, NOW);
    B.saveSleep(s, { date: day, hours: i < 4 ? 8 : 6 }, NOW);
  }
  const r = B.sleepVsRecords(s);
  assert.deepEqual(r.comMeta, { dias: 4, comRecorde: 3 });
  assert.deepEqual(r.abaixo, { dias: 4, comRecorde: 4 });
  s.extras.sono.logs = s.extras.sono.logs.slice(0, 6);                             // pouco dado: sem conclusão
  assert.equal(B.sleepVsRecords(s), null);
});

/* ======================= Skincare ======================= */

test('skincare: começar com os passos sugeridos e editar (adicionar, renomear, mover, remover)', () => {
  const s = R.emptyState();
  assert.equal(B.skincareActive(s), false);
  B.startSkincare(s);
  assert.equal(B.skincareActive(s), true);
  let cfg = B.skincareConfig(s);
  assert.deepEqual(cfg.steps.manha.map((x) => x.name), ['Limpar', 'Hidratar', 'Protetor solar']);
  assert.deepEqual(cfg.steps.noite.map((x) => x.name), ['Demaquilar', 'Limpar', 'Sérum', 'Hidratante']);
  assert.deepEqual(cfg.reminders, { manha: null, noite: null });
  // começar de novo não apaga o que já existe
  B.renameStep(s, 'manha', 'protetor', 'FPS 50');
  B.startSkincare(s);
  assert.equal(B.skincareConfig(s).steps.manha[2].name, 'FPS 50');
  // adicionar
  const novo = B.addStep(s, 'noite', '  Vitamina C  ');
  assert.equal(novo.name, 'Vitamina C');
  assert.equal(B.skincareConfig(s).steps.noite.length, 5);
  assert.equal(B.addStep(s, 'noite', '   '), null);
  assert.equal(B.addStep(s, 'tarde', 'x'), null);
  assert.equal(B.addStep(s, 'manha', 'x'.repeat(50)).name.length, 30);
  // limite por período
  for (let i = 0; i < 20; i++) B.addStep(s, 'noite', 'extra ' + i);
  assert.equal(B.skincareConfig(s).steps.noite.length, 12);
  assert.equal(B.addStep(s, 'noite', 'mais um'), null);
  // mover
  assert.equal(B.moveStep(s, 'manha', 'hidratar-m', -1), true);
  assert.deepEqual(B.skincareConfig(s).steps.manha.map((x) => x.id).slice(0, 2), ['hidratar-m', 'limpar-m']);
  assert.equal(B.moveStep(s, 'manha', 'hidratar-m', -1), false);   // já é o primeiro
  assert.equal(B.moveStep(s, 'manha', 'inexistente', 1), false);
  // remover
  assert.equal(B.removeStep(s, 'manha', 'limpar-m'), true);
  assert.equal(B.removeStep(s, 'manha', 'limpar-m'), false);
  assert.equal(B.skincareConfig(s).steps.manha.length, 3);
  // restaurar padrão mantém lembretes e histórico
  B.setReminder(s, 'noite', '21:00'); B.toggleStep(s, TODAY, 'noite', 'serum', NOW);
  B.resetSteps(s);
  assert.equal(B.skincareConfig(s).steps.noite.length, 4);
  assert.equal(B.skincareConfig(s).reminders.noite, '21:00');
  assert.deepEqual(s.extras.skincare.logs[TODAY].noite, ['serum']);
});

test('skincare: lembretes (horário válido, vazio apaga) e configuração completa', () => {
  const s = R.emptyState();
  B.startSkincare(s);
  assert.equal(B.setReminder(s, 'manha', '07:30'), true);
  assert.equal(B.setReminder(s, 'manha', '7h'), false);
  assert.equal(B.setReminder(s, 'tarde', '07:30'), false);
  assert.equal(B.skincareConfig(s).reminders.manha, '07:30');
  assert.equal(B.setReminder(s, 'manha', ''), true);
  assert.equal(B.skincareConfig(s).reminders.manha, null);
  // configuração completa: linhas sem nome saem, ids existentes ficam, novos ganham id
  const v = B.validateSkincareConfig({
    steps: { manha: [{ id: 'limpar-m', name: ' Limpar ' }, { id: null, name: 'Tônico' }, { id: 'x', name: '  ' }], noite: [{ id: 'serum', name: 'Sérum' }] },
    reminders: { manha: '08:00', noite: '' }
  });
  assert.equal(v.ok, true);
  assert.deepEqual(v.value.steps.manha.map((x) => x.name), ['Limpar', 'Tônico']);
  assert.equal(v.value.steps.manha[0].id, 'limpar-m');
  assert.ok(v.value.steps.manha[1].id && v.value.steps.manha[1].id !== 'limpar-m');
  assert.deepEqual(v.value.reminders, { manha: '08:00', noite: null });
  assert.ok(B.validateSkincareConfig({ steps: { manha: [{ name: 'x'.repeat(31) }] } }).errors.steps);
  assert.ok(B.validateSkincareConfig({ steps: { manha: Array.from({ length: 13 }, (_, i) => ({ name: 'p' + i })) } }).errors.steps);
  assert.ok(B.validateSkincareConfig({ reminders: { noite: '99:99' } }).errors.rem_noite);
  const r = B.setSkincareConfig(s, { steps: { manha: [{ name: 'Só um passo' }], noite: [] }, reminders: { manha: '06:45' } });
  assert.equal(r.ok, true);
  assert.deepEqual(B.skincareConfig(s).steps.noite, []);
  assert.equal(B.skincareConfig(s).steps.manha[0].name, 'Só um passo');
  const bad = B.setSkincareConfig(s, { reminders: { manha: 'xx' } });
  assert.equal(bad.ok, false);
  assert.equal(B.skincareConfig(s).reminders.manha, '06:45');        // não mudou
});

test('skincare: marcar passos, dia completo, período completo e desfazer', () => {
  const s = R.emptyState();
  B.startSkincare(s);
  assert.deepEqual(B.toggleStep(s, TODAY, 'manha', 'limpar-m', NOW), { done: true });
  assert.deepEqual(B.toggleStep(s, TODAY, 'manha', 'hidratar-m', NOW), { done: true });
  let d = B.skincareDay(s, TODAY);
  assert.deepEqual([d.manha.done, d.manha.total, d.noite.done, d.noite.total], [2, 3, 0, 4]);
  assert.equal(d.complete, false);
  assert.equal(d.active, true);
  assert.equal(B.periodComplete(s, TODAY, 'manha'), false);
  B.toggleStep(s, TODAY, 'manha', 'protetor', NOW);
  assert.equal(B.periodComplete(s, TODAY, 'manha'), true);
  assert.equal(B.skincareDay(s, TODAY).complete, false);              // falta a noite
  // desmarcar
  assert.deepEqual(B.toggleStep(s, TODAY, 'manha', 'protetor', NOW), { done: false });
  assert.equal(B.periodComplete(s, TODAY, 'manha'), false);
  // inválidos
  assert.equal(B.toggleStep(s, TODAY, 'manha', 'nao-existe', NOW), null);
  assert.equal(B.toggleStep(s, TODAY, 'tarde', 'limpar-m', NOW), null);
  assert.equal(B.toggleStep(s, 'ontem', 'manha', 'limpar-m', NOW), null);
  // marcar o período todo e desfazer
  const prev = B.markPeriod(s, TODAY, 'noite');
  assert.deepEqual(prev, []);
  assert.equal(B.periodComplete(s, TODAY, 'noite'), true);
  B.setPeriodDone(s, TODAY, 'noite', prev);
  assert.equal(B.skincareDay(s, TODAY).noite.done, 0);
  // logs vazios são limpos
  B.toggleStep(s, '2026-11-01', 'manha', 'limpar-m', NOW); B.toggleStep(s, '2026-11-01', 'manha', 'limpar-m', NOW);
  assert.equal(s.extras.skincare.logs['2026-11-01'], undefined);
  // passo removido deixa de contar (e não vira "feito" fantasma)
  B.removeStep(s, 'manha', 'limpar-m');
  assert.deepEqual([B.skincareDay(s, TODAY).manha.done, B.skincareDay(s, TODAY).manha.total], [1, 2]);
});

test('skincare: só com manhã (ou só com noite) o dia completa com o período que existe', () => {
  const s = R.emptyState();
  B.setSkincareConfig(s, { steps: { manha: [{ id: 'a', name: 'Limpar' }, { id: 'b', name: 'Hidratar' }], noite: [] } });
  assert.equal(B.skincareDay(s, TODAY).complete, false);
  B.toggleStep(s, TODAY, 'manha', 'a', NOW); B.toggleStep(s, TODAY, 'manha', 'b', NOW);
  assert.equal(B.skincareDay(s, TODAY).complete, true);
  assert.equal(B.periodComplete(s, TODAY, 'noite'), false);          // sem passos não é "completo"
  const vazio = R.emptyState();
  assert.equal(B.skincareDay(vazio, TODAY).complete, false);
  assert.equal(B.skincareDay(vazio, TODAY).active, false);
});

test('skincare: sequência de dias (hoje aberto não quebra) e semana', () => {
  const s = R.emptyState();
  B.setSkincareConfig(s, { steps: { manha: [{ id: 'a', name: 'Limpar' }], noite: [{ id: 'b', name: 'Hidratar' }] } });
  const full = (d) => { B.toggleStep(s, d, 'manha', 'a', NOW); B.toggleStep(s, d, 'noite', 'b', NOW); };
  assert.equal(B.skincareStreak(s, TODAY), 0);
  full('2026-11-19'); full('2026-11-18'); full('2026-11-17');
  assert.equal(B.skincareStreak(s, TODAY), 3);                       // hoje ainda aberto: conta desde ontem
  B.toggleStep(s, TODAY, 'manha', 'a', NOW);                         // hoje pela metade: segue sem quebrar
  assert.equal(B.skincareStreak(s, TODAY), 3);
  B.toggleStep(s, TODAY, 'noite', 'b', NOW);                         // hoje completo: soma
  assert.equal(B.skincareStreak(s, TODAY), 4);
  full('2026-11-15');                                                // buraco em 16/11: não conta antes dele
  assert.equal(B.skincareStreak(s, TODAY), 4);
  B.toggleStep(s, '2026-11-18', 'noite', 'b', NOW);                  // quebra no meio (18/11 incompleto)
  assert.equal(B.skincareStreak(s, TODAY), 2);
  const w = B.skincareWeek(s, TODAY);
  assert.equal(w.length, 7);
  assert.equal(w[6].date, TODAY);
  assert.equal(w[6].isToday, true);
  assert.equal(w[0].date, '2026-11-14');
  assert.equal(w.map((x) => (x.complete ? 'C' : x.partial ? 'P' : '-')).join(''), '-C-CPCC');   // 14..20/11: completo, parcial ou nada
});

test('bem-estar: quem usa sono ou skincare (para o cartão do Início)', () => {
  const s = R.emptyState();
  assert.deepEqual(B.wellbeingActive(s, TODAY), { sono: false, skincare: false, any: false });
  B.saveSleep(s, { date: '2026-11-05', hours: 7 }, NOW);              // 15 dias atrás: não conta
  assert.equal(B.wellbeingActive(s, TODAY).sono, false);
  B.saveSleep(s, { date: '2026-11-07', hours: 7 }, NOW);              // 13 dias atrás: conta
  assert.equal(B.wellbeingActive(s, TODAY).sono, true);
  const k = R.emptyState();
  B.startSkincare(k);
  assert.deepEqual(B.wellbeingActive(k, TODAY), { sono: false, skincare: true, any: true });
});

/* ======================= Lembretes de skincare ======================= */

function skincareState() {
  const s = R.emptyState();
  B.startSkincare(s);
  B.setReminder(s, 'manha', '07:30');
  B.setReminder(s, 'noite', '21:00');
  return s;
}
const skin = (list) => list.filter((r) => r.type === 'skincare');

test('lembretes de skincare: manhã e noite, todo dia, no horário escolhido', () => {
  const s = skincareState();
  const list = skin(R.computeReminders(s, C.combine(TODAY, '06:00')));
  assert.deepEqual(list.map((r) => r.key), [
    'skincare:manha:2026-11-19T07:30', 'skincare:noite:2026-11-19T21:00', 'skincare:manha:2026-11-20T07:30', 'skincare:noite:2026-11-20T21:00',
    'skincare:manha:2026-11-21T07:30', 'skincare:noite:2026-11-21T21:00', 'skincare:manha:2026-11-22T07:30', 'skincare:noite:2026-11-22T21:00']);
  assert.equal(list[2].title, 'Hora do skincare da manhã 🌿');
  assert.equal(list[3].title, 'Hora do skincare da noite 🌿');
  assert.equal(list[2].route, 'autocuidado');
  assert.ok(list[2].body.indexOf('3 passos: Limpar, Hidratar, Protetor solar') === 0);
  assert.equal(list[3].body.indexOf('4 passos: Demaquilar'), 0);
  assert.equal(C.toTimeKey(list[2].at), '07:30');
});

test('lembretes de skincare: pula o período que já foi feito naquele dia', () => {
  const s = skincareState();
  B.markPeriod(s, TODAY, 'manha');
  let keys = skin(R.computeReminders(s, C.combine(TODAY, '06:00'))).map((r) => r.key);
  assert.ok(keys.indexOf('skincare:manha:2026-11-20T07:30') < 0);                // manhã de hoje feita: sem aviso
  assert.ok(keys.indexOf('skincare:noite:2026-11-20T21:00') >= 0);               // noite ainda vale
  assert.ok(keys.indexOf('skincare:manha:2026-11-21T07:30') >= 0);               // amanhã vale
  B.markPeriod(s, TODAY, 'noite');
  keys = skin(R.computeReminders(s, C.combine(TODAY, '06:00'))).map((r) => r.key);
  assert.equal(keys.filter((k) => k.indexOf('2026-11-20') > 0).length, 0);
  // desmarcar um passo volta a avisar
  B.toggleStep(s, TODAY, 'noite', 'serum', NOW);
  keys = skin(R.computeReminders(s, C.combine(TODAY, '06:00'))).map((r) => r.key);
  assert.ok(keys.indexOf('skincare:noite:2026-11-20T21:00') >= 0);
});

test('lembretes de skincare: desligado, sem horário, sem passos e só um período', () => {
  const s = skincareState();
  s.settings.notifications.skincare = false;
  assert.equal(skin(R.computeReminders(s, C.combine(TODAY, '06:00'))).length, 0);
  const t = skincareState();
  B.setReminder(t, 'manha', null);
  const so = skin(R.computeReminders(t, C.combine(TODAY, '06:00')));
  assert.ok(so.length > 0 && so.every((r) => r.key.indexOf('skincare:noite:') === 0));
  const u = skincareState();
  B.setSkincareConfig(u, { steps: { manha: [], noite: [{ name: 'Hidratar' }] }, reminders: { manha: '07:00', noite: '22:00' } });
  const un = skin(R.computeReminders(u, C.combine(TODAY, '06:00')));
  assert.ok(un.length > 0 && un.every((r) => r.key.indexOf('skincare:noite:') === 0));    // manhã sem passos: não avisa
  assert.equal(un[0].body, '1 passo: Hidratar');
  assert.equal(skin(R.computeReminders(R.emptyState(), C.combine(TODAY, '06:00'))).length, 0);
  // o interruptor existe nos padrões e nas migrações antigas
  assert.equal(R.emptyState().settings.notifications.skincare, true);
  assert.equal(R.emptyState().settings.notifications.sono, true);
  assert.equal(R.migrate({ schemaVersion: 2, settings: { notifications: { task: false } } }).settings.notifications.skincare, true);
});

test('lembretes de skincare: o servidor recebe só 14 dias à frente e nada de data única', () => {
  const s = skincareState();
  const now = C.combine(TODAY, '06:00');
  const fut = skin(R.futureReminders(s, now));
  const last = fut[fut.length - 1];
  assert.equal(fut.length, 30);                                                 // hoje + 14 dias, manhã e noite
  assert.ok(C.diffDays(TODAY, C.toDateKey(last.at)) <= 14);
  assert.equal(skin(R.upcomingReminders(s, now, 2)).length, 4);
});

test('migração mantém o que foi guardado em extras (sono e skincare)', () => {
  const s = skincareState();
  B.saveSleep(s, { date: TODAY, hours: 7.5, quality: 4 }, NOW);
  const back = R.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(B.sleepOn(back, TODAY).hours, 7.5);
  assert.equal(B.skincareConfig(back).steps.manha.length, 3);
  assert.equal(B.skincareConfig(back).reminders.noite, '21:00');
  assert.equal(R.hasAnyData(R.emptyState()), false);
});
