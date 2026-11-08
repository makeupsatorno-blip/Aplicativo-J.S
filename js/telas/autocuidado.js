/* J.S. — Cronograma capilar */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, ui = JS.ui, esc = ui.esc;
  var view = { showAll: false };
  var TYPE_CLASS = { hydration: 'h-hyd', nutrition: 'h-nut', reconstruction: 'h-rec', custom: 'h-cus' };

  function hairItem(e, now) {
    var today = C.toDateKey(now);
    var overdue = R.hairPending(e) && e.date < today;
    var meta = [C.formatDayLabel(e.date, today) + (Math.abs(C.diffDays(today, e.date)) <= 1 ? ' • ' + C.formatDayMonth(e.date) : ''), e.time].filter(Boolean);
    var flags = (e.status === 'postponed' && e.originalDate ? ui.tag('Adiado de ' + C.formatDayMonth(e.originalDate), 'soft') : '') +
      (overdue ? ui.tag('Atrasado', 'danger') : '') +
      (e.status === 'completed' ? ui.tag('Realizado', 'success') : '');
    return '<div class="item hair ' + (TYPE_CLASS[e.type] || '') + (overdue ? ' overdue' : '') + '">' +
      '<button type="button" class="item-main" data-action="hair-menu" data-id="' + esc(e.id) + '">' +
      '<span class="item-title"><span class="dot" aria-hidden="true"></span>' + esc(R.hairName(e)) + '</span>' +
      '<span class="item-meta">' + meta.map(esc).join(' • ') + (e.reminderMinutes != null && e.time ? ' <span class="item-icons">' + ui.icon('bell', 14) + '</span>' : '') + '</span>' +
      (flags ? '<span class="item-flags">' + flags + '</span>' : '') +
      '</button></div>';
  }

  function historyItem(e) {
    var planned = e.originalDate || e.date;
    return '<div class="item hair history ' + (TYPE_CLASS[e.type] || '') + '">' +
      '<button type="button" class="item-main" data-action="hair-menu" data-id="' + esc(e.id) + '">' +
      '<span class="item-title"><span class="dot" aria-hidden="true"></span>' + esc(R.hairName(e)) + '</span>' +
      '<span class="item-meta">Feito em ' + esc(C.formatTimestamp(e.completedAt)) + ' • planejado para ' + esc(C.formatDayMonth(planned)) + '</span>' +
      (e.products ? '<span class="item-note"><strong>Produtos:</strong> ' + esc(e.products) + '</span>' : '') +
      (e.notes ? '<span class="item-note">' + esc(e.notes) + '</span>' : '') +
      '</button></div>';
  }

  function render(now) {
    var s = JS.store.state;
    var up = R.hairUpcoming(s), hist = R.hairHistory(s);
    var shown = view.showAll ? up : up.slice(0, 10);
    var html = '<h1 class="page-title">Cronograma capilar</h1><p class="page-sub">Hidratação, nutrição e reconstrução, do seu jeito.</p>' +
      '<div class="btn-row"><button type="button" class="btn soft" data-action="hair-new">' + ui.icon('plus', 18) + 'Tratamento</button>' +
      '<button type="button" class="btn soft" data-action="hair-plan">' + ui.icon('sparkle', 18) + 'Gerar cronograma</button></div>';
    html += ui.section('Próximos',
      up.length ? shown.map(function (e) { return hairItem(e, now); }).join('') +
        (up.length > shown.length ? '<button type="button" class="btn ghost full" data-action="hair-all">Ver todos (' + up.length + ')</button>' : '')
        : ui.empty('flower', 'Nenhum tratamento planejado.', { label: 'Planejar tratamento', attrs: 'data-action="hair-new"' }),
      up.length ? '<span class="count">' + up.length + '</span>' : '');
    html += ui.section('Histórico',
      hist.length ? hist.slice(0, 30).map(historyItem).join('') : '<p class="muted small">Os tratamentos que você registrar como feitos aparecem aqui, com produtos e observações.</p>',
      hist.length ? '<span class="count">' + hist.length + '</span>' : '');
    html += '<p class="note">O J.S. não recomenda tratamentos nem produtos: você escolhe o cronograma e a frequência.</p>';
    return html;
  }

  /* ---------------- Formulários ---------------- */

  function typeOptions() { return ui.entries(C.HAIR_TYPES); }
  function reminderOptions() { return C.REMINDER_OPTIONS; }

  function bindCustomToggle(form, selectName) {
    var sel = form.elements[selectName];
    var field = form.querySelector('[data-field="customName"]');
    function upd() {
      var list = Array.prototype.slice.call(form.querySelectorAll('select[name^="' + selectName + '"]'));
      field.hidden = !list.some(function (x) { return x.value === 'custom'; });
    }
    form.querySelectorAll('select[name^="' + selectName + '"]').forEach(function (x) { x.addEventListener('change', upd); });
    if (sel || field) upd();
  }

  function openHairForm(e, preset) {
    var today = C.toDateKey(new Date());
    var v = e || Object.assign({ type: 'hydration', customName: '', date: today, time: '', products: '', notes: '', reminderMinutes: null }, preset || {});
    var locked = e && e.status === 'completed';
    // Tudo com horário avisa: tratamento com hora e sem lembrete já abre com "Na hora".
    if (!locked && v.time && v.reminderMinutes == null) v = Object.assign({}, v, { reminderMinutes: 0 });
    var body =
      ui.select({ label: 'Tipo', name: 'type', options: typeOptions(), value: v.type }) +
      ui.input({ label: 'Nome do tratamento', name: 'customName', value: v.customName, placeholder: 'Ex.: Umectação', attrs: 'maxlength="60"' }) +
      '<div class="row2">' + ui.input({ label: 'Data', name: 'date', type: 'date', value: v.date, attrs: locked ? 'disabled' : '' }) +
      ui.input({ label: 'Hora', name: 'time', type: 'time', value: v.time || '', attrs: locked ? 'disabled' : '' }) + '</div>' +
      (locked ? '<p class="hint">Tratamento já realizado: a data planejada fica guardada no histórico.</p>'
        : ui.select({ label: 'Lembrete', name: 'reminderMinutes', options: reminderOptions(), value: v.reminderMinutes, hint: 'O lembrete precisa de horário.' })) +
      ui.textarea({ label: 'Produtos (opcional)', name: 'products', value: v.products, placeholder: 'Ex.: máscara, óleo...', attrs: 'maxlength="500"' }) +
      ui.textarea({ label: 'Observações (opcional)', name: 'notes', value: v.notes, attrs: 'maxlength="1000"' });
    ui.openSheet({
      title: e ? 'Editar tratamento' : 'Novo tratamento', body: body, submitLabel: e ? 'Salvar' : 'Adicionar',
      onOpen: function (form) { bindCustomToggle(form, 'type'); JS.bindDefaultReminder(form, 'time', 0); },
      onSubmit: function (input) {
        if (locked) { input.date = e.date; input.time = e.time; input.reminderMinutes = e.reminderMinutes; }
        var r = R.validateHair(input);
        if (!r.ok) return { errors: r.errors };
        var saved = null;
        JS.anim.mark(function () { return saved && itemSel(saved.id); }, e ? 'flash' : 'is-new', { closest: '.item', delay: 180 });
        JS.store.update(function (s, n) { saved = e ? R.updateHairEvent(s, e.id, r.value, n) : R.createHairEvent(s, r.value, n); });
        ui.toast(e ? 'Tratamento atualizado.' : 'Tratamento planejado.');
        return { reminder: r.value.reminderMinutes != null };
      },
      afterClose: function (res) { if (res && res.reminder) JS.notify.askIfNeeded(); }
    });
  }

  function completeForm(e) {
    var now = new Date();
    var body = '<div class="row2">' + ui.input({ label: 'Dia em que fez', name: 'date', type: 'date', value: C.toDateKey(now) }) +
      ui.input({ label: 'Hora', name: 'time', type: 'time', value: C.toTimeKey(now) }) + '</div>' +
      ui.textarea({ label: 'Produtos usados (opcional)', name: 'products', value: e.products, attrs: 'maxlength="500"' }) +
      ui.textarea({ label: 'Como foi? (opcional)', name: 'notes', value: e.notes, attrs: 'maxlength="1000"' });
    ui.openSheet({
      title: 'Registrar como feito', subtitle: R.hairName(e), body: body, submitLabel: 'Registrar',
      onSubmit: function (v) {
        var err = {};
        if (!C.isDateKey(v.date)) err.date = 'Escolha o dia.';
        if (!C.isTimeKey(v.time)) err.time = 'Escolha a hora.';
        if (Object.keys(err).length) return { errors: err };
        // Depois que a folha fecha: o item aparece no histórico com brilho e solta pétalas.
        JS.anim.mark(itemSel(e.id), 'is-new', {
          closest: '.item', delay: 240,
          run: function (els) { if (els[0]) { els[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); JS.anim.petalsFrom(els[0], { count: 14, spread: 110 }); } }
        });
        JS.store.update(function (s, n) {
          R.completeHairEvent(s, e.id, {
            completedAt: C.combine(v.date, v.time).toISOString(),
            products: (v.products || '').trim() || null, notes: (v.notes || '').trim() || null
          }, n);
        });
        ui.toast('Registrado no histórico. 🌷');
      }
    });
  }

  function rescheduleForm(e) {
    var body = '<div class="row2">' + ui.input({ label: 'Nova data', name: 'date', type: 'date', value: e.date }) +
      ui.input({ label: 'Hora', name: 'time', type: 'time', value: e.time || '' }) + '</div>' +
      '<p class="hint">A data original fica registrada.</p>';
    ui.openSheet({
      title: 'Reprogramar', subtitle: R.hairName(e), body: body, submitLabel: 'Reprogramar',
      onSubmit: function (v) {
        var err = {};
        if (!C.isDateKey(v.date)) err.date = 'Escolha a nova data.';
        if (v.time && !C.isTimeKey(v.time)) err.time = 'Horário inválido.';
        if (Object.keys(err).length) return { errors: err };
        JS.anim.mark(itemSel(e.id), 'flash', { closest: '.item', delay: 180 });
        JS.store.update(function (s, n) { R.rescheduleHairEvent(s, e.id, v.date, v.time || null, n); });
        ui.toast('Tratamento reprogramado.');
      }
    });
  }

  function planForm() {
    var today = C.toDateKey(new Date());
    var seqOpts = [['', '—']].concat(typeOptions());
    var body =
      '<p class="hint top">Escolha os dias e a ordem dos tratamentos. A sequência se repete até o fim do período.</p>' +
      ui.weekdays({ label: 'Dias da semana', name: 'weekdays', value: [] }) +
      '<div class="row2">' + ui.input({ label: 'Começar em', name: 'startDate', type: 'date', value: today }) +
      ui.select({ label: 'Por quantas semanas', name: 'weeks', value: 4, options: [1, 2, 3, 4, 6, 8, 10, 12].map(function (n) { return [n, n + (n === 1 ? ' semana' : ' semanas')]; }) }) + '</div>' +
      '<div class="field" data-field="sequence"><span class="label">Sequência</span><div class="seq">' +
      [1, 2, 3, 4].map(function (i) {
        return '<select name="seq' + i + '" aria-label="Tratamento ' + i + '">' + seqOpts.map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (i === 1 && o[0] === 'hydration' ? ' selected' : '') + '>' + i + '. ' + esc(o[1]) + '</option>';
        }).join('') + '</select>';
      }).join('') + '</div><p class="err" role="alert"></p></div>' +
      ui.input({ label: 'Nome do personalizado', name: 'customName', placeholder: 'Ex.: Umectação', attrs: 'maxlength="60"' }) +
      '<div class="row2">' + ui.input({ label: 'Hora', name: 'time', type: 'time', value: '' }) +
      ui.select({ label: 'Lembrete', name: 'reminderMinutes', options: reminderOptions(), value: null }) + '</div>' +
      '<p class="preview" id="plan-preview">Escolha os dias da semana.</p>';

    function collect(v) {
      return {
        startDate: v.startDate, weekdays: v.weekdays, weeks: v.weeks, time: v.time, reminderMinutes: v.reminderMinutes,
        customName: v.customName, sequence: [v.seq1, v.seq2, v.seq3, v.seq4].filter(Boolean)
      };
    }
    ui.openSheet({
      title: 'Gerar cronograma', body: body, submitLabel: 'Criar tratamentos',
      onOpen: function (form) {
        bindCustomToggle(form, 'seq');
        JS.bindDefaultReminder(form, 'time', 0);
        function preview() {
          var r = R.planHairSchedule(collect(ui.formValues(form)));
          var el = form.querySelector('#plan-preview');
          if (!r.ok) { el.textContent = r.errors.weekdays || r.errors.sequence || r.errors.startDate || 'Complete os campos.'; return; }
          var counts = {};
          r.value.forEach(function (e) { var k = e.type === 'custom' ? (e.customName || 'Personalizado') : C.HAIR_TYPES[e.type]; counts[k] = (counts[k] || 0) + 1; });
          el.textContent = 'Serão criados ' + r.value.length + ' tratamentos: ' + Object.keys(counts).map(function (k) { return counts[k] + ' de ' + k.toLowerCase(); }).join(', ') +
            (r.value.length ? '. De ' + C.formatDayMonth(r.value[0].date) + ' a ' + C.formatDayMonth(r.value[r.value.length - 1].date) + '.' : '.');
        }
        form.addEventListener('input', preview);
        form.addEventListener('change', preview);
        preview();
      },
      onSubmit: function (v) {
        var r = R.planHairSchedule(collect(v));
        if (!r.ok) return { errors: r.errors };
        if (!r.value.length) return { errors: { weekdays: 'Nenhum dia escolhido cai dentro do período.' } };
        var ids = [];
        JS.anim.mark(function () { return ids.map(function (id) { return itemSel(id); }).join(','); }, 'is-new', { closest: '.item', delay: 180 });
        JS.store.update(function (s, n) { r.value.forEach(function (e) { ids.push(R.createHairEvent(s, e, n).id); }); });
        ui.toast(r.value.length + ' tratamentos adicionados ao cronograma.');
        return { reminder: v.reminderMinutes !== '' && v.reminderMinutes != null };
      },
      afterClose: function (res) { if (res && res.reminder) JS.notify.askIfNeeded(); }
    });
  }

  function hairMenu(id) {
    var s = JS.store.state, e = R.byId(s.hairEvents, id);
    if (!e) return;
    var today = C.toDateKey(new Date());
    var pending = R.hairPending(e);
    var sub = [C.HAIR_STATUS[e.status], C.formatDayLabel(e.date, today) + ' (' + C.formatDayMonth(e.date) + ')', e.time].filter(Boolean).join(' • ');
    var detail = (e.originalDate ? '<p class="muted">Planejado originalmente para ' + esc(C.formatDateBR(e.originalDate)) + (e.originalTime ? ' às ' + esc(e.originalTime) : '') + '</p>' : '') +
      (e.completedAt ? '<p class="muted">Feito em ' + esc(C.formatTimestamp(e.completedAt)) + '</p>' : '') +
      (e.products ? '<p><strong>Produtos:</strong> ' + esc(e.products) + '</p>' : '') +
      (e.notes ? '<p>' + esc(e.notes) + '</p>' : '');
    ui.actionSheet({
      title: R.hairName(e), subtitle: sub, detail: detail,
      actions: pending ? [
        { label: 'Registrar como feito', icon: 'check', run: function () { completeForm(e); } },
        { label: 'Reprogramar', icon: 'clock', run: function () { rescheduleForm(e); } },
        { label: 'Editar', icon: 'edit', run: function () { openHairForm(e); } },
        { label: 'Excluir', icon: 'trash', danger: true, run: function () { remove(e); } }
      ] : [
        { label: 'Editar produtos e observações', icon: 'edit', run: function () { openHairForm(e); } },
        { label: 'Desfazer registro', icon: 'undo', run: function () {
          JS.anim.mark(itemSel(e.id), 'flash', { closest: '.item' });
          JS.store.update(function (st, n) { R.undoHairCompletion(st, e.id, n); });
          ui.toast('Registro desfeito.');
        } },
        { label: 'Excluir do histórico', icon: 'trash', danger: true, run: function () { remove(e); } }
      ]
    });
  }

  function remove(e) {
    ui.confirm({
      title: 'Excluir tratamento?', confirmLabel: 'Excluir', danger: true,
      message: e.status === 'completed' ? 'Este registro sairá do histórico. Isso não pode ser desfeito.' : '"' + R.hairName(e) + '" será excluído do cronograma.'
    }).then(function (ok) {
      if (ok) JS.anim.removeThen(itemSel(e.id), '.item', function () { JS.store.update(function (s) { R.deleteHairEvent(s, e.id); }); ui.toast('Tratamento excluído.'); });
    });
  }

  function itemSel(id) { return '[data-action="hair-menu"][data-id="' + id + '"]'; }

  JS.actions['hair-new'] = function () { openHairForm(null); };
  JS.actions['hair-plan'] = planForm;
  JS.actions['hair-menu'] = function (d) { hairMenu(d.id); };
  JS.actions['hair-all'] = function () { view.showAll = true; JS.app.render({ enter: 'view' }); };

  JS.forms.hair = function (preset) { openHairForm(null, preset); };
  JS.render.hairItem = hairItem;
  JS.telas.autocuidado = { title: 'Cronograma capilar', render: render, fab: { label: 'Novo tratamento', action: 'hair-new' } };
})();
