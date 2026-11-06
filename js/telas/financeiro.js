/* J.S. — Financeiro (contas, vencimentos e pagamentos; sem integração bancária) */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, ui = JS.ui, esc = ui.esc;
  var view = { month: null, category: '' };
  var STATUS_KIND = { pending: 'soft', paid: 'success', overdue: 'danger', cancelled: 'muted' };

  function billItem(b, now, opts) {
    var s = JS.store.state, today = C.toDateKey(now);
    var st = R.billStatus(b, today);
    var paid = st === 'paid' ? R.billPaidCents(s, b.id) : null;
    var meta = [C.formatDayMonth(b.dueDate)];
    if (st === 'pending' || st === 'overdue') meta.push(C.dueLabel(b.dueDate, today));
    if (st === 'paid' && b.paidAt) meta.push('paga em ' + C.formatDayMonth(b.paidAt));
    if (!opts || !opts.compact) meta.push(b.category);
    return '<div class="item bill st-' + st + '">' +
      '<button type="button" class="item-main" data-action="bill-menu" data-id="' + esc(b.id) + '">' +
      '<span class="item-row"><span class="item-title">' + esc(b.title) + '</span><span class="amount">' + esc(C.formatCents(b.amountCents)) + '</span></span>' +
      '<span class="item-row"><span class="item-meta">' + meta.map(esc).join(' • ') + (b.recurrence !== 'once' ? ' <span class="item-icons">' + ui.icon('repeat', 14) + '</span>' : '') + '</span>' +
      ui.tag(C.BILL_STATUS[st], STATUS_KIND[st]) + '</span>' +
      (paid != null && paid !== b.amountCents ? '<span class="item-note">Valor pago: ' + esc(C.formatCents(paid)) + '</span>' : '') +
      '</button></div>';
  }

  function render(now) {
    var s = JS.store.state, today = C.toDateKey(now), current = C.monthOf(today);
    if (!view.month) view.month = current;
    var sum = R.monthSummary(s, view.month, view.category || null, today);
    var bills = R.billsInMonth(s, view.month, view.category || null);
    var html = '<h1 class="page-title">Financeiro</h1>' + ui.monthNav(view.month, 'fin-month') +
      '<div class="field compact"><select data-change="fin-category" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>' +
      C.BILL_CATEGORIES.map(function (c) { return '<option' + (c === view.category ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div class="summary">' +
      stat('Previsto', sum.expected, sum.count + (sum.count === 1 ? ' conta' : ' contas'), '') +
      stat('Pago', sum.paid, sum.countPaid + (sum.countPaid === 1 ? ' paga' : ' pagas'), 'ok') +
      stat('Pendente', sum.pending, sum.countPending + ' a vencer', '') +
      stat('Atrasado', sum.overdue, sum.countOverdue + (sum.countOverdue === 1 ? ' conta' : ' contas'), sum.overdue ? 'bad' : '') +
      '</div>';

    if (view.month >= current) {
      var older = R.overdueBills(s, today).filter(function (b) { return C.monthOf(b.dueDate) < view.month && (!view.category || b.category === view.category); });
      if (older.length) html += ui.section('Em atraso de meses anteriores', older.map(function (b) { return billItem(b, now); }).join(''), '<span class="count danger">' + older.length + '</span>');
    }
    html += ui.section('Contas do mês',
      bills.length ? bills.map(function (b) { return billItem(b, now); }).join('')
        : ui.empty('wallet', view.category ? 'Nenhuma conta de ' + view.category + ' neste mês.' : 'Nenhuma conta neste mês.', { label: 'Nova conta', attrs: 'data-action="bill-new"' }));

    var pays = s.payments.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }).slice(0, 8);
    if (pays.length) {
      html += ui.section('Pagamentos recentes', pays.map(function (p) {
        var b = R.byId(s.bills, p.billId);
        return '<div class="item log' + (p.voided ? ' voided' : '') + '"><span class="item-main static">' +
          '<span class="item-row"><span class="item-title">' + esc(b ? b.title : p.billTitle || 'Conta') + '</span><span class="amount">' + esc(C.formatCents(p.amountCents)) + '</span></span>' +
          '<span class="item-meta">Pago em ' + esc(C.formatDateBR(p.paidAt)) + (p.notes ? ' • ' + esc(p.notes) : '') + (p.voided ? ' • estornado' : '') + '</span></span></div>';
      }).join(''));
    }
    html += '<p class="note">O J.S. só organiza suas contas. Ele não faz pagamentos nem acessa bancos.</p>';
    return html;
  }

  function stat(label, cents, sub, kind) {
    return '<div class="stat ' + kind + '"><span class="stat-label">' + esc(label) + '</span><strong data-count-cents="' + cents + '">' + esc(C.formatCents(cents)) + '</strong><span class="stat-sub">' + esc(sub) + '</span></div>';
  }

  /* ---------------- Formulários ---------------- */

  function openBillForm(b, preset) {
    var today = C.toDateKey(new Date());
    var v = b || Object.assign({ title: '', amountCents: null, category: 'Moradia', dueDate: today, recurrence: 'once', paymentMethod: null, notes: '', reminderDaysBefore: 1, reminderTime: '09:00' }, preset || {});
    var hasFuture = b && b.seriesId && R.seriesBills(JS.store.state, b.seriesId).some(function (o) { return o.id !== b.id && o.status === 'pending' && o.dueDate > b.dueDate; });
    var body =
      ui.input({ label: 'Nome da conta', name: 'title', value: v.title, required: true, placeholder: 'Ex.: Aluguel, Internet, Cartão', attrs: 'maxlength="80"' }) +
      '<div class="row2">' + ui.input({ label: 'Valor (R$)', name: 'amount', value: v.amountCents != null ? C.centsToInput(v.amountCents) : '', placeholder: '0,00', attrs: 'inputmode="decimal"' }) +
      ui.input({ label: 'Vencimento', name: 'dueDate', type: 'date', value: v.dueDate }) + '</div>' +
      '<div class="row2">' + ui.select({ label: 'Repetição', name: 'recurrence', options: ui.entries(C.BILL_RECURRENCES), value: v.recurrence }) +
      ui.select({ label: 'Categoria', name: 'category', options: ui.plain(C.BILL_CATEGORIES), value: v.category }) + '</div>' +
      ui.select({ label: 'Forma de pagamento (opcional)', name: 'paymentMethod', options: [[null, '—']].concat(ui.plain(C.PAYMENT_METHODS)), value: v.paymentMethod }) +
      '<div class="row2">' + ui.select({ label: 'Aviso', name: 'reminderDaysBefore', options: C.BILL_REMINDER_DAYS, value: v.reminderDaysBefore }) +
      ui.input({ label: 'Horário do aviso', name: 'reminderTime', type: 'time', value: v.reminderTime || '09:00' }) + '</div>' +
      ui.textarea({ label: 'Observações (opcional)', name: 'notes', value: v.notes, attrs: 'maxlength="500"' }) +
      (hasFuture ? ui.checkbox({ label: 'Aplicar às próximas', hint: 'Atualiza nome, valor, categoria e aviso das próximas contas pendentes desta série. Pagamentos já feitos não mudam.', name: 'applyToFuture', checked: true }) : '');
    ui.openSheet({
      title: b ? 'Editar conta' : 'Nova conta', body: body, submitLabel: b ? 'Salvar' : 'Adicionar',
      onSubmit: function (input) {
        var r = R.validateBill(input);
        if (!r.ok) return { errors: r.errors };
        var today2 = C.toDateKey(new Date());
        if (!b) view.month = C.monthOf(r.value.dueDate); // mostra o mês da conta nova
        var saved = null;
        JS.anim.mark(function () { return saved && itemSel(saved.id); }, b ? 'flash' : 'is-new', { closest: '.item', delay: 180 });
        JS.store.update(function (s, n) {
          saved = b ? R.updateBill(s, b.id, r.value, input.applyToFuture === true, n) : R.createBill(s, r.value, n);
          R.ensureRecurringBills(s, today2, n);
        });
        ui.toast(b ? 'Conta atualizada.' : 'Conta adicionada.');
        return { reminder: r.value.reminderDaysBefore != null };
      },
      afterClose: function (res) { if (res && res.reminder) JS.notify.askIfNeeded(); }
    });
  }

  function payForm(b) {
    var today = C.toDateKey(new Date());
    var body = '<div class="row2">' + ui.input({ label: 'Valor pago (R$)', name: 'amount', value: C.centsToInput(b.amountCents), attrs: 'inputmode="decimal"' }) +
      ui.input({ label: 'Data do pagamento', name: 'paidAt', type: 'date', value: today }) + '</div>' +
      ui.input({ label: 'Observação (opcional)', name: 'notes', placeholder: 'Ex.: pago no Pix', attrs: 'maxlength="300"' }) +
      (b.recurrence !== 'once' ? '<p class="hint">A próxima conta desta série será criada automaticamente.</p>' : '');
    ui.openSheet({
      title: 'Marcar como paga', subtitle: b.title + ' • ' + C.formatCents(b.amountCents), body: body, submitLabel: 'Confirmar pagamento',
      onSubmit: function (input) {
        var r = R.validatePayment(input, today);
        if (!r.ok) return { errors: r.errors };
        JS.anim.mark(itemSel(b.id), 'flash-ok', { closest: '.item', delay: 200, ms: 1500 });
        JS.store.update(function (s, n) { R.payBill(s, b.id, r.value, C.toDateKey(new Date()), n); });
        ui.toast('Pagamento registrado.');
      }
    });
  }

  function paymentsSheet(b) {
    var s = JS.store.state;
    var list = R.billPayments(s, b.id);
    var body = list.length ? list.map(function (p) {
      return '<div class="item log' + (p.voided ? ' voided' : '') + '"><span class="item-main static">' +
        '<span class="item-row"><span class="item-title">' + esc(C.formatCents(p.amountCents)) + '</span><span class="item-meta">' + esc(C.formatDateBR(p.paidAt)) + '</span></span>' +
        '<span class="item-meta">Registrado em ' + esc(C.formatTimestamp(p.createdAt)) + (p.voided ? ' • estornado em ' + esc(C.formatTimestamp(p.voidedAt)) : '') + '</span>' +
        (p.notes ? '<span class="item-note">' + esc(p.notes) + '</span>' : '') + '</span></div>';
    }).join('') : '<p class="muted">Nenhum pagamento registrado.</p>';
    ui.openSheet({ title: 'Pagamentos', subtitle: b.title, body: body });
  }

  function cancelFlow(b) {
    var p = b.seriesId && b.recurrence !== 'once'
      ? ui.choose({
        title: 'Cancelar conta', message: '"' + b.title + '" se repete. O que você quer cancelar?',
        options: [{ label: 'Somente esta', value: 'this', primary: true }, { label: 'Esta e as próximas', value: 'future', danger: true }]
      })
      : ui.confirm({ title: 'Cancelar conta?', message: 'Ela continua no histórico como cancelada e sai dos totais.', confirmLabel: 'Cancelar conta', cancelLabel: 'Voltar', danger: true })
        .then(function (ok) { return ok ? 'this' : null; });
    p.then(function (scope) {
      if (!scope) return;
      JS.anim.mark(itemSel(b.id), 'flash', { closest: '.item' });
      JS.store.update(function (s, n) { R.cancelBill(s, b.id, scope, n); R.ensureRecurringBills(s, C.toDateKey(new Date()), n); });
      ui.toast(scope === 'future' ? 'Recorrência encerrada.' : 'Conta cancelada.');
    });
  }

  function billMenu(id) {
    var s = JS.store.state, b = R.byId(s.bills, id);
    if (!b) return;
    var today = C.toDateKey(new Date());
    var st = R.billStatus(b, today);
    var hasPays = s.payments.some(function (p) { return p.billId === id; });
    var sub = C.formatCents(b.amountCents) + ' • vence ' + C.formatDateBR(b.dueDate) + ' • ' + C.BILL_STATUS[st];
    var detail = '<p class="muted">' + esc([b.category, C.BILL_RECURRENCES[b.recurrence], b.paymentMethod].filter(Boolean).join(' • ')) + '</p>' +
      (b.reminderDaysBefore != null ? '<p class="muted">' + ui.icon('bell', 14) + ' Aviso: ' + esc(C.BILL_REMINDER_DAYS.filter(function (o) { return o[0] === b.reminderDaysBefore; }).map(function (o) { return o[1]; })[0] || '') + ' às ' + esc(b.reminderTime) + '</p>' : '') +
      (b.notes ? '<p>' + esc(b.notes) + '</p>' : '');
    ui.actionSheet({
      title: b.title, subtitle: sub, detail: detail,
      actions: [
        b.status === 'pending' ? { label: 'Marcar como paga', icon: 'check', run: function () { payForm(b); } } : null,
        b.status === 'paid' ? { label: 'Reabrir (estornar pagamento)', icon: 'undo', run: function () {
          ui.confirm({ title: 'Reabrir conta?', message: 'O pagamento continua no histórico, marcado como estornado.', confirmLabel: 'Reabrir' })
            .then(function (ok) { if (ok) { JS.anim.mark(itemSel(id), 'flash', { closest: '.item' }); JS.store.update(function (st2, n) { R.reopenBill(st2, id, n); }); ui.toast('Conta reaberta.'); } });
        } } : null,
        b.status !== 'cancelled' ? { label: 'Editar', icon: 'edit', run: function () { openBillForm(b); } } : null,
        hasPays ? { label: 'Ver pagamentos', icon: 'receipt', run: function () { paymentsSheet(b); } } : null,
        b.status === 'pending' ? { label: 'Cancelar conta', icon: 'x', run: function () { cancelFlow(b); } } : null,
        b.status === 'cancelled' ? { label: 'Reativar conta', icon: 'undo', run: function () { JS.anim.mark(itemSel(id), 'flash', { closest: '.item' }); JS.store.update(function (st2, n) { R.restoreBill(st2, id, n); }); ui.toast('Conta reativada.'); } } : null,
        !hasPays ? { label: 'Excluir', icon: 'trash', danger: true, run: function () {
          ui.confirm({ title: 'Excluir conta?', message: '"' + b.title + '" será excluída. Isso não pode ser desfeito.', confirmLabel: 'Excluir', danger: true })
            .then(function (ok) {
              if (ok) JS.anim.removeThen(itemSel(id), '.item', function () { JS.store.update(function (st2) { R.deleteBill(st2, id); }); ui.toast('Conta excluída.'); });
            });
        } } : null
      ]
    });
  }

  JS.actions['fin-month'] = function (d) {
    view.month = C.addMonthKey(view.month, Number(d.delta));
    JS.app.render({ enter: 'view:' + (Number(d.delta) > 0 ? 'r' : 'l') });
  };
  JS.changes['fin-category'] = function (el) { view.category = el.value; JS.app.render({ enter: 'view' }); };

  function itemSel(id) { return '[data-action="bill-menu"][data-id="' + id + '"]'; }
  JS.actions['bill-new'] = function () { openBillForm(null); };
  JS.actions['bill-menu'] = function (d) { billMenu(d.id); };

  JS.forms.bill = function (preset) { openBillForm(null, preset); };
  JS.render.billItem = billItem;
  JS.telas.financeiro = { title: 'Financeiro', render: render, fab: { label: 'Nova conta', action: 'bill-new' } };
})();
