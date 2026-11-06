// Testes das regras de negócio do J.S. — rode com:  node --test testes/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const R = require('../js/regras.js');

const NOW_ISO = '2026-11-06T10:00:00.000Z';
const at = (date, time) => C.combine(date, time || '00:00');

function task(state, extra) {
  const r = R.validateTask(Object.assign({ title: 'Tarefa', category: 'Pessoal', priority: 'normal' }, extra));
  assert.ok(r.ok, JSON.stringify(r.errors));
  return R.createTask(state, r.value, NOW_ISO);
}
function bill(state, extra) {
  const r = R.validateBill(Object.assign({ title: 'Aluguel', amount: '1.500,00', category: 'Moradia', reminderDaysBefore: '1', reminderTime: '09:00' }, extra));
  assert.ok(r.ok, JSON.stringify(r.errors));
  return R.createBill(state, r.value, NOW_ISO);
}

/* ---------------- Dinheiro ---------------- */

test('converte valores digitados para centavos inteiros', () => {
  const casos = {
    '10': 1000, '10,5': 1050, '10,50': 1050, '0,01': 1, ',5': 50, '1.234,56': 123456, '1234,56': 123456,
    '1234.56': 123456, '1,234.56': 123456, 'R$ 99,90': 9990, '1.234': 123400, '12.5': 1250, '1.234.567,89': 123456789
  };
  for (const [entrada, esperado] of Object.entries(casos)) assert.equal(C.parseMoneyToCents(entrada), esperado, entrada);
  for (const invalido of ['', 'abc', '-5', '1,234', '1.2.3', '.', ',', '10,999']) assert.equal(C.parseMoneyToCents(invalido), null, invalido);
});

test('formata centavos em reais', () => {
  assert.equal(C.formatCents(123456).replace(/\s/g, ' '), 'R$ 1.234,56');
  assert.equal(C.centsToInput(9990), '99,90');
});

/* ---------------- Datas ---------------- */

test('soma meses preservando o dia original', () => {
  assert.equal(C.addMonths('2026-01-31', 1, 31), '2026-02-28');
  assert.equal(C.addMonths('2026-02-28', 1, 31), '2026-03-31');
  assert.equal(C.addMonths('2028-01-31', 1, 31), '2028-02-29');
  assert.equal(C.addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(C.addYears('2028-02-29', 1), '2029-02-28');
  assert.equal(C.diffDays('2026-11-06', '2026-11-10'), 4);
  assert.equal(C.diffDays('2026-12-31', '2027-01-01'), 1);
  assert.ok(C.isDateKey('2026-02-28') && !C.isDateKey('2026-02-30') && !C.isDateKey('06/11/2026'));
});

/* ---------------- Tarefas ---------------- */

test('valida tarefa: título obrigatório e lembrete exige horário', () => {
  assert.equal(R.validateTask({ title: '  ' }).errors.title, 'Informe o título.');
  assert.ok(R.validateTask({ title: 'x', dueDate: '2026-11-06', reminderMinutes: '15' }).errors.reminderMinutes);
  assert.ok(R.validateTask({ title: 'x', recurrence: 'daily' }).errors.recurrence);
  assert.ok(R.validateTask({ title: 'x', dueDate: '2026-11-06', dueTime: '08:00', reminderMinutes: '15' }).ok);
});

test('recorrência diária, semanal, dias úteis e mensal', () => {
  const s = R.emptyState();
  const diaria = task(s, { title: 'Diária', dueDate: '2026-11-02', recurrence: 'daily' });
  const semanal = task(s, { title: 'Semanal', dueDate: '2026-11-02', recurrence: 'weekly' }); // segunda
  const uteis = task(s, { title: 'Úteis', dueDate: '2026-11-02', recurrence: 'weekdays' });
  const mensal = task(s, { title: 'Mensal', dueDate: '2026-01-31', recurrence: 'monthly' });
  const conta = (id, from, to) => R.taskOccurrences(s, from, to).filter(o => o.task.id === id).map(o => o.date);
  assert.equal(conta(diaria.id, '2026-11-01', '2026-11-08').length, 7);
  assert.deepEqual(conta(semanal.id, '2026-11-01', '2026-11-30'), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  assert.equal(conta(uteis.id, '2026-11-02', '2026-11-08').length, 5);
  assert.deepEqual(conta(mensal.id, '2026-02-01', '2026-04-30'), ['2026-02-28', '2026-03-31', '2026-04-30']);
});

test('concluir uma ocorrência não conclui as próximas', () => {
  const s = R.emptyState();
  const t = task(s, { dueDate: '2026-11-02', recurrence: 'daily' });
  R.setTaskDone(s, t.id, '2026-11-03', true, NOW_ISO);
  const occ = R.taskOccurrences(s, '2026-11-02', '2026-11-05');
  assert.deepEqual(occ.map(o => o.done), [false, true, false, false]);
});

test('tarefa atrasada: data passada ou horário de hoje já passou', () => {
  const s = R.emptyState();
  task(s, { title: 'Ontem', dueDate: '2026-11-05' });
  task(s, { title: 'Hoje cedo', dueDate: '2026-11-06', dueTime: '08:00' });
  task(s, { title: 'Hoje tarde', dueDate: '2026-11-06', dueTime: '18:00' });
  task(s, { title: 'Hoje sem hora', dueDate: '2026-11-06' });
  const atrasadas = R.overdueTasks(s, at('2026-11-06', '10:00')).map(o => o.task.title);
  assert.deepEqual(atrasadas, ['Ontem', 'Hoje cedo']);
});

test('recorrente esquecida só conta como atrasada nos últimos 7 dias', () => {
  const s = R.emptyState();
  task(s, { dueDate: '2026-01-01', recurrence: 'daily' });
  const atrasadas = R.overdueTasks(s, at('2026-11-06', '10:00'));
  assert.equal(atrasadas.length, R.RECURRING_OVERDUE_LOOKBACK);
});

test('adiar ocorrência recorrente cria tarefa avulsa e mantém a série', () => {
  const s = R.emptyState();
  const t = task(s, { title: 'Academia', dueDate: '2026-11-02', dueTime: '07:00', recurrence: 'daily' });
  R.postponeTask(s, t.id, '2026-11-04', '2026-11-04', '19:00', NOW_ISO);
  const dia4 = R.taskOccurrences(s, '2026-11-04', '2026-11-04');
  assert.equal(dia4.length, 1);
  assert.equal(dia4[0].time, '19:00');
  assert.notEqual(dia4[0].task.id, t.id);
  assert.equal(R.taskOccurrences(s, '2026-11-05', '2026-11-05')[0].task.id, t.id);
});

test('editar "esta e as próximas" divide a série sem mexer no passado', () => {
  const s = R.emptyState();
  const t = task(s, { title: 'Antigo', dueDate: '2026-11-01', recurrence: 'daily' });
  const v = R.validateTask({ title: 'Novo', category: 'Pessoal', dueDate: '2026-11-05', recurrence: 'daily' }).value;
  R.updateTask(s, t.id, v, 'future', '2026-11-05', NOW_ISO);
  const titulos = R.taskOccurrences(s, '2026-11-03', '2026-11-06').map(o => o.task.title);
  assert.deepEqual(titulos, ['Antigo', 'Antigo', 'Novo', 'Novo']);
});

test('editar "somente esta" altera uma ocorrência só', () => {
  const s = R.emptyState();
  const t = task(s, { title: 'Série', dueDate: '2026-11-01', recurrence: 'daily' });
  const v = R.validateTask({ title: 'Exceção', category: 'Pessoal', dueDate: '2026-11-03', recurrence: 'daily' }).value;
  R.updateTask(s, t.id, v, 'this', '2026-11-03', NOW_ISO);
  const titulos = R.taskOccurrences(s, '2026-11-02', '2026-11-04').map(o => o.task.title);
  assert.deepEqual(titulos, ['Série', 'Exceção', 'Série']);
  assert.equal(R.taskOccurrences(s, '2026-11-05', '2026-11-10').filter(o => o.task.title === 'Exceção').length, 0);
});

test('excluir série remove a tarefa e suas ocorrências', () => {
  const s = R.emptyState();
  const t = task(s, { dueDate: '2026-11-01', recurrence: 'daily' });
  R.setTaskDone(s, t.id, '2026-11-02', true, NOW_ISO);
  R.deleteTaskSeries(s, t.id);
  assert.equal(s.tasks.length, 0);
  assert.equal(Object.keys(s.taskOcc).length, 0);
});

/* ---------------- Autocuidado ---------------- */

test('cronograma capilar segue os dias e a sequência escolhidos', () => {
  const r = R.planHairSchedule({ startDate: '2026-11-02', weekdays: [2, 6], weeks: 2, time: '20:00', sequence: ['hydration', 'nutrition', 'reconstruction'] });
  assert.ok(r.ok);
  assert.deepEqual(r.value.map(e => e.date + ':' + e.type), [
    '2026-11-03:hydration', '2026-11-07:nutrition', '2026-11-10:reconstruction', '2026-11-14:hydration'
  ]);
  assert.ok(R.planHairSchedule({ startDate: '2026-11-02', weekdays: [], weeks: 2, sequence: ['hydration'] }).errors.weekdays);
});

test('reprogramar e concluir mantém a data planejada original', () => {
  const s = R.emptyState();
  const e = R.createHairEvent(s, R.validateHair({ type: 'hydration', date: '2026-11-06', time: '20:00' }).value, NOW_ISO);
  R.rescheduleHairEvent(s, e.id, '2026-11-08', '19:00', NOW_ISO);
  R.completeHairEvent(s, e.id, { products: 'Máscara X' }, NOW_ISO);
  assert.equal(e.originalDate, '2026-11-06');
  assert.equal(e.date, '2026-11-08');
  assert.equal(e.status, 'completed');
  assert.equal(R.hairHistory(s).length, 1);
});

/* ---------------- Alimentação ---------------- */

test('refeições respeitam dias da semana, pausa e exceções', () => {
  const s = R.emptyState();
  const m = R.createMeal(s, R.validateMeal({ type: 'lunch', time: '12:00', weekdays: ['1', '2', '3', '4', '5'], reminderEnabled: 'on' }).value, NOW_ISO);
  assert.equal(m.name, 'Almoço');
  assert.equal(R.mealOccurrencesOn(s, '2026-11-07').length, 0); // sábado
  R.setMealException(s, m.id, '2026-11-06', { time: '13:30' });
  assert.equal(R.mealOccurrencesOn(s, '2026-11-06')[0].time, '13:30');
  assert.equal(R.mealOccurrencesOn(s, '2026-11-05')[0].time, '12:00'); // a série não mudou
  R.setMealEnabled(s, m.id, false, NOW_ISO);
  assert.equal(R.mealOccurrencesOn(s, '2026-11-05').length, 0);
});

test('próxima refeição', () => {
  const s = R.emptyState();
  R.createMeal(s, R.validateMeal({ type: 'breakfast', time: '07:00', weekdays: [0, 1, 2, 3, 4, 5, 6] }).value, NOW_ISO);
  R.createMeal(s, R.validateMeal({ type: 'lunch', time: '12:00', weekdays: [0, 1, 2, 3, 4, 5, 6] }).value, NOW_ISO);
  assert.equal(R.nextMeal(s, at('2026-11-06', '10:00')).meal.name, 'Almoço');
  const amanha = R.nextMeal(s, at('2026-11-06', '20:00'));
  assert.equal(amanha.meal.name, 'Café da manhã');
  assert.equal(amanha.date, '2026-11-07');
});

/* ---------------- Financeiro ---------------- */

test('conta guarda o valor em centavos', () => {
  const s = R.emptyState();
  const b = bill(s, { amount: '89,90', dueDate: '2026-11-10' });
  assert.equal(b.amountCents, 8990);
  assert.ok(Number.isInteger(b.amountCents));
  assert.ok(R.validateBill({ title: 'x', amount: 'abc', dueDate: '2026-11-10' }).errors.amount);
});

test('pagar conta mensal cria o próximo vencimento uma única vez', () => {
  const s = R.emptyState();
  const b = bill(s, { dueDate: '2026-11-10', recurrence: 'monthly' });
  R.payBill(s, b.id, { amountCents: 150000, paidAt: '2026-11-06' }, '2026-11-06', NOW_ISO);
  R.ensureRecurringBills(s, '2026-11-06', NOW_ISO);
  R.ensureRecurringBills(s, '2026-11-06', NOW_ISO);
  assert.deepEqual(s.bills.map(x => x.dueDate).sort(), ['2026-11-10', '2026-12-10']);
  assert.equal(s.payments.length, 1);
  assert.equal(b.status, 'paid');
});

test('conta recorrente vencida e não paga aparece atrasada e o próximo mês existe', () => {
  const s = R.emptyState();
  const b = bill(s, { dueDate: '2026-10-10', recurrence: 'monthly' });
  R.ensureRecurringBills(s, '2026-11-06', NOW_ISO);
  assert.equal(R.billStatus(b, '2026-11-06'), 'overdue');
  assert.deepEqual(s.bills.map(x => x.dueDate).sort(), ['2026-10-10', '2026-11-10']);
  assert.equal(R.overdueBills(s, '2026-11-06').length, 1);
});

test('mensal no dia 31 respeita meses curtos', () => {
  const s = R.emptyState();
  const b = bill(s, { dueDate: '2027-01-31', recurrence: 'monthly' });
  R.payBill(s, b.id, { amountCents: 1, paidAt: '2027-01-31' }, '2027-01-31', NOW_ISO);
  const fev = s.bills.find(x => x.dueDate === '2027-02-28');
  assert.ok(fev);
  R.payBill(s, fev.id, { amountCents: 1, paidAt: '2027-02-28' }, '2027-02-28', NOW_ISO);
  assert.ok(s.bills.find(x => x.dueDate === '2027-03-31'));
});

test('editar o valor futuro não altera pagamentos anteriores', () => {
  const s = R.emptyState();
  const b = bill(s, { dueDate: '2026-11-10', recurrence: 'monthly' });
  R.payBill(s, b.id, { amountCents: 150000, paidAt: '2026-11-08' }, '2026-11-08', NOW_ISO);
  const dez = s.bills.find(x => x.dueDate === '2026-12-10');
  const v = R.validateBill({ title: 'Aluguel', amount: '1.650,00', category: 'Moradia', dueDate: '2026-12-10', recurrence: 'monthly', reminderDaysBefore: '1' }).value;
  R.updateBill(s, dez.id, v, true, NOW_ISO);
  assert.equal(dez.amountCents, 165000);
  assert.equal(s.payments[0].amountCents, 150000);
  assert.equal(R.billPaidCents(s, b.id), 150000);
});

test('reabrir conta estorna o pagamento mas mantém o histórico', () => {
  const s = R.emptyState();
  const b = bill(s, { dueDate: '2026-11-10' });
  R.payBill(s, b.id, { amountCents: 150000, paidAt: '2026-11-06' }, '2026-11-06', NOW_ISO);
  R.reopenBill(s, b.id, NOW_ISO);
  assert.equal(b.status, 'pending');
  assert.equal(s.payments.length, 1);
  assert.equal(s.payments[0].voided, true);
  assert.equal(R.billPaidCents(s, b.id), 0);
  assert.equal(R.deleteBill(s, b.id), false, 'conta com histórico não pode ser excluída');
});

test('cancelar "esta e as próximas" encerra a recorrência', () => {
  const s = R.emptyState();
  const b = bill(s, { dueDate: '2026-11-10', recurrence: 'monthly' });
  R.cancelBill(s, b.id, 'future', NOW_ISO);
  R.ensureRecurringBills(s, '2026-12-20', NOW_ISO);
  assert.equal(s.bills.length, 1);
  assert.equal(b.status, 'cancelled');
});

test('resumo mensal soma previsto, pago, pendente e atrasado', () => {
  const s = R.emptyState();
  const a = bill(s, { title: 'Luz', amount: '100,00', dueDate: '2026-11-02' });   // atrasada
  const b = bill(s, { title: 'Água', amount: '50,00', dueDate: '2026-11-20' });   // pendente
  const c = bill(s, { title: 'Net', amount: '120,00', dueDate: '2026-11-15' });   // paga com valor diferente
  const d = bill(s, { title: 'Cancelada', amount: '999,00', dueDate: '2026-11-15' });
  bill(s, { title: 'Outro mês', amount: '10,00', dueDate: '2026-12-01' });
  R.payBill(s, c.id, { amountCents: 11500, paidAt: '2026-11-05' }, '2026-11-06', NOW_ISO);
  R.cancelBill(s, d.id, 'this', NOW_ISO);
  const r = R.monthSummary(s, '2026-11', null, '2026-11-06');
  assert.equal(r.expected, 27000);
  assert.equal(r.paid, 11500);
  assert.equal(r.pending, 5000);
  assert.equal(r.overdue, 10000);
  assert.equal(R.monthSummary(s, '2026-11', 'Moradia', '2026-11-06').count, 3);
  assert.ok(a && b);
});

/* ---------------- Lembretes ---------------- */

test('lembretes: chave idempotente, antecedência e sem duplicidade', () => {
  const s = R.emptyState();
  const t = task(s, { title: 'Dentista', dueDate: '2026-11-06', dueTime: '14:00', reminderMinutes: '30' });
  bill(s, { title: 'Luz', dueDate: '2026-11-07', reminderDaysBefore: '1', reminderTime: '13:00' });
  bill(s, { title: 'Velho', dueDate: '2026-11-07', reminderDaysBefore: '1', reminderTime: '09:00' }); // fora da janela de 2h
  const now = at('2026-11-06', '13:31');
  const lista = R.computeReminders(s, now);
  const lembTarefa = lista.find(r => r.type === 'task');
  assert.equal(lembTarefa.key, 'task:' + t.id + ':2026-11-06T13:30');
  const due = R.dueReminders(lista, now, {});
  assert.deepEqual(due.map(r => r.type).sort(), ['bill', 'task']);
  assert.equal(due.find(r => r.type === 'bill').title, 'Luz vence em 1 dia.');
  const fired = {};
  due.forEach(r => { fired[r.key] = now.toISOString(); });
  assert.equal(R.dueReminders(lista, now, fired).length, 0);
});

test('lembrete some quando a tarefa é concluída ou o módulo é desligado', () => {
  const s = R.emptyState();
  const t = task(s, { title: 'Remédio', dueDate: '2026-11-06', dueTime: '08:00', reminderMinutes: '0' });
  assert.equal(R.computeReminders(s, at('2026-11-06', '08:00')).length, 1);
  R.setTaskDone(s, t.id, '2026-11-06', true, NOW_ISO);
  assert.equal(R.computeReminders(s, at('2026-11-06', '08:00')).length, 0);
  R.setTaskDone(s, t.id, '2026-11-06', false, NOW_ISO);
  s.settings.notifications.task = false;
  assert.equal(R.computeReminders(s, at('2026-11-06', '08:00')).length, 0);
});

test('valor da conta não aparece na notificação por padrão', () => {
  const s = R.emptyState();
  bill(s, { title: 'Cartão', amount: '2.000,00', dueDate: '2026-11-06', reminderDaysBefore: '0' });
  const r = R.computeReminders(s, at('2026-11-06', '09:00'))[0];
  assert.equal(r.title, 'Hoje vence: Cartão');
  assert.ok(!/2\.000/.test(r.body));
});

/* ---------------- Migração / backup ---------------- */

test('migração preenche campos ausentes e recusa versão futura', () => {
  const m = R.migrate({ tasks: [{ id: 'a', title: 'x' }, { semId: true }], settings: { name: 'Ju' } });
  assert.equal(m.tasks.length, 1);
  assert.equal(m.settings.name, 'Ju');
  assert.equal(m.settings.notifications.bill, true);
  assert.deepEqual(m.bills, []);
  assert.throws(() => R.migrate({ schemaVersion: 99 }));
  assert.throws(() => R.migrate('texto'));
});
