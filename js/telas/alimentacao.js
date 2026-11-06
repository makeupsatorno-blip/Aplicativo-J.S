/* J.S. — Alimentação (lembretes de horários; não prescreve dieta) */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, ui = JS.ui, esc = ui.esc;

  function weekdayLetters(days) {
    return '<span class="wd-mini">' + [0, 1, 2, 3, 4, 5, 6].map(function (d) {
      return '<span class="' + (days.indexOf(d) >= 0 ? 'on' : '') + '" aria-hidden="true">' + C.WEEKDAY_LETTERS[d] + '</span>';
    }).join('') + '</span>';
  }

  function todayItem(o, now, showCheck) {
    var m = o.meal, nowT = C.toTimeKey(now), isToday = o.date === C.toDateKey(now);
    var state = o.done ? ui.tag('Feita', 'success') : o.skipped ? ui.tag('Pulada hoje', 'soft')
      : o.changed ? ui.tag('Só hoje: ' + o.time + ' (normal ' + o.originalTime + ')', 'soft')
        : (isToday && o.time < nowT ? ui.tag('Horário passou', 'muted') : '');
    var ids = ' data-id="' + esc(m.id) + '" data-date="' + esc(o.date) + '"';
    return '<div class="item meal' + (o.done ? ' done' : '') + (o.skipped ? ' skipped' : '') + '">' +
      '<span class="time-badge">' + esc(o.time) + '</span>' +
      '<button type="button" class="item-main" data-action="meal-today"' + ids + '>' +
      '<span class="item-title">' + esc(m.name) + '</span>' +
      '<span class="item-meta">' + esc(C.MEAL_TYPES[m.type] || '') + (m.description ? ' • ' + esc(m.description) : '') + '</span>' +
      (state ? '<span class="item-flags">' + state + '</span>' : '') + '</button>' +
      (showCheck && !o.skipped ? '<button type="button" class="check' + (o.done ? ' on' : '') + '" data-action="meal-done"' + ids +
        ' aria-label="' + (o.done ? 'Desmarcar' : 'Marcar como feita') + ': ' + esc(m.name) + '">' + ui.icon('check', 16) + '</button>' : '') +
      '</div>';
  }

  function scheduleItem(m) {
    return '<div class="item meal' + (m.enabled ? '' : ' paused') + '">' +
      '<span class="time-badge">' + esc(m.time) + '</span>' +
      '<button type="button" class="item-main" data-action="meal-menu" data-id="' + esc(m.id) + '">' +
      '<span class="item-title">' + esc(m.name) + '</span>' +
      '<span class="item-meta">' + weekdayLetters(m.weekdays) + (m.reminderEnabled ? '' : ' <span class="item-icons" title="Sem lembrete">' + ui.icon('belloff', 14) + '</span>') + '</span>' +
      (m.enabled ? '' : '<span class="item-flags">' + ui.tag('Pausada', 'soft') + '</span>') +
      '</button></div>';
  }

  function render(now) {
    var s = JS.store.state, today = C.toDateKey(now);
    var history = s.settings.mealHistory !== false;
    var todayList = R.mealOccurrencesOn(s, today);
    var all = s.meals.slice().sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
    var html = '<h1 class="page-title">Alimentação</h1><p class="page-sub">Seus horários de refeição e lembretes.</p>';
    html += ui.section('Hoje',
      todayList.length ? todayList.map(function (o) { return todayItem(o, now, history); }).join('')
        : (all.length ? '<p class="muted small">Nenhuma refeição marcada para hoje.</p>'
          : ui.empty('utensils', 'Cadastre seus horários de refeição para receber lembretes.', { label: 'Novo horário', attrs: 'data-action="meal-new"' })));
    if (all.length) html += ui.section('Meus horários', all.map(scheduleItem).join(''), '<span class="count">' + all.length + '</span>');
    if (history) {
      var logs = s.mealLogs.slice().sort(function (a, b) { return a.completedAt < b.completedAt ? 1 : -1; }).slice(0, 15);
      if (logs.length) {
        html += ui.section('Histórico', logs.map(function (l) {
          return '<div class="item log"><span class="item-main static"><span class="item-title">' + esc(l.mealName) + '</span>' +
            '<span class="item-meta">' + esc(C.formatDayLabel(l.date, today)) + ' • feita às ' + esc(C.toTimeKey(new Date(l.completedAt))) + '</span></span></div>';
        }).join(''));
      }
    }
    html += '<p class="note">O J.S. só lembra dos horários que você escolher. Ele não sugere dieta nem calorias.</p>';
    return html;
  }

  /* ---------------- Formulários ---------------- */

  function openMealForm(m) {
    var v = m || { name: '', type: 'breakfast', time: '', weekdays: [0, 1, 2, 3, 4, 5, 6], description: '', reminderEnabled: true };
    var body =
      ui.select({ label: 'Tipo', name: 'type', options: ui.entries(C.MEAL_TYPES), value: v.type }) +
      ui.input({ label: 'Nome', name: 'name', value: v.name, placeholder: C.MEAL_TYPES[v.type], attrs: 'maxlength="60"', hint: 'Se deixar em branco, usamos o tipo.' }) +
      ui.input({ label: 'Horário', name: 'time', type: 'time', value: v.time, required: true }) +
      ui.weekdays({ label: 'Dias da semana', name: 'weekdays', value: v.weekdays }) +
      ui.chips([{ label: 'Todos os dias', attrs: 'data-wd="all"' }, { label: 'Seg. a sex.', attrs: 'data-wd="week"' }, { label: 'Fim de semana', attrs: 'data-wd="weekend"' }]) +
      ui.textarea({ label: 'Descrição (opcional)', name: 'description', value: v.description, attrs: 'maxlength="500"' }) +
      ui.checkbox({ label: 'Lembrete', hint: 'Avisar no horário da refeição', name: 'reminderEnabled', checked: v.reminderEnabled });
    ui.openSheet({
      title: m ? 'Editar horário' : 'Novo horário de refeição', body: body, submitLabel: m ? 'Salvar' : 'Adicionar',
      onOpen: function (form) {
        var typeSel = form.elements.type, nameIn = form.elements.name;
        typeSel.addEventListener('change', function () { nameIn.placeholder = C.MEAL_TYPES[typeSel.value]; });
        var sets = { all: [0, 1, 2, 3, 4, 5, 6], week: [1, 2, 3, 4, 5], weekend: [0, 6] };
        form.querySelectorAll('[data-wd]').forEach(function (b) {
          b.addEventListener('click', function () {
            var set = sets[b.dataset.wd];
            form.querySelectorAll('input[name="weekdays"]').forEach(function (cb) { cb.checked = set.indexOf(Number(cb.value)) >= 0; });
          });
        });
      },
      onSubmit: function (input) {
        var r = R.validateMeal(input);
        if (!r.ok) return { errors: r.errors };
        var saved = null;
        JS.anim.mark(function () { return saved && itemSel(saved.id); }, m ? 'flash' : 'is-new', { closest: '.item', delay: 180 });
        JS.store.update(function (s, n) { saved = m ? R.updateMeal(s, m.id, r.value, n) : R.createMeal(s, r.value, n); });
        ui.toast(m ? 'Horário atualizado.' : 'Horário adicionado.');
        return { reminder: r.value.reminderEnabled };
      },
      afterClose: function (res) { if (res && res.reminder) JS.notify.askIfNeeded(); }
    });
  }

  function exceptionForm(m, date) {
    var tomorrow = C.addDays(C.toDateKey(new Date()), 1);
    var body = ui.input({ label: 'Dia', name: 'date', type: 'date', value: date || tomorrow }) +
      '<div class="field" data-field="kind"><span class="label">Neste dia</span><div class="radio-list">' +
      '<label class="radio"><input type="radio" name="kind" value="skip" checked><span>Pular esta refeição</span></label>' +
      '<label class="radio"><input type="radio" name="kind" value="time"><span>Usar outro horário</span></label></div><p class="err"></p></div>' +
      ui.input({ label: 'Outro horário', name: 'time', type: 'time', value: m.time }) +
      '<p class="hint">Só esse dia muda; o horário fixo continua igual.</p>';
    ui.openSheet({
      title: 'Exceção para um dia', subtitle: m.name + ' • ' + m.time, body: body, submitLabel: 'Salvar exceção',
      onSubmit: function (v) {
        var e = {};
        if (!C.isDateKey(v.date)) e.date = 'Escolha o dia.';
        if (v.kind === 'time' && !C.isTimeKey(v.time)) e.time = 'Escolha o horário.';
        if (Object.keys(e).length) return { errors: e };
        JS.anim.mark(itemSel(m.id), 'flash', { closest: '.item', delay: 180 });
        JS.store.update(function (s) { R.setMealException(s, m.id, v.date, v.kind === 'skip' ? { skip: true } : { time: v.time }); });
        ui.toast('Exceção salva para ' + C.formatDateBR(v.date) + '.');
      }
    });
  }

  function timeTodayForm(m, date) {
    var body = ui.input({ label: 'Horário só hoje', name: 'time', type: 'time', value: m.time });
    ui.openSheet({
      title: 'Mudar horário de hoje', subtitle: m.name, body: body, submitLabel: 'Salvar',
      onSubmit: function (v) {
        if (!C.isTimeKey(v.time)) return { errors: { time: 'Escolha o horário.' } };
        JS.anim.mark(itemSel(m.id), 'flash', { closest: '.item', delay: 180 });
        JS.store.update(function (s) { R.setMealException(s, m.id, date, { time: v.time }); });
        ui.toast('Horário de hoje alterado.');
      }
    });
  }

  function todayMenu(id, date) {
    var s = JS.store.state, m = R.byId(s.meals, id);
    if (!m) return;
    var o = R.mealOccurrencesOn(s, date).filter(function (x) { return x.meal.id === id; })[0];
    if (!o) return mealMenu(id);
    var history = s.settings.mealHistory !== false;
    var hasEx = o.skipped || o.changed;
    ui.actionSheet({
      title: m.name, subtitle: C.formatDayLabel(date, C.toDateKey(new Date())) + ' • ' + o.time,
      actions: [
        history && !o.skipped ? { label: o.done ? 'Desmarcar como feita' : 'Marcar como feita', icon: o.done ? 'undo' : 'check', run: function () { toggleDone(id, date); } } : null,
        !o.skipped ? { label: 'Pular hoje', icon: 'skip', run: function () { JS.anim.mark(itemSel(id), 'flash', { closest: '.item' }); JS.store.update(function (st) { R.setMealException(st, id, date, { skip: true }); }); ui.toast('Refeição pulada hoje.'); } } : null,
        !o.skipped ? { label: 'Mudar o horário só hoje', icon: 'clock', run: function () { timeTodayForm(m, date); } } : null,
        hasEx ? { label: 'Voltar ao normal hoje', icon: 'undo', run: function () { JS.anim.mark(itemSel(id), 'flash', { closest: '.item' }); JS.store.update(function (st) { R.clearMealException(st, id, date); }); ui.toast('Horário normal restaurado.'); } } : null,
        { label: 'Editar horário fixo', icon: 'edit', run: function () { openMealForm(m); } }
      ]
    });
  }

  function mealMenu(id) {
    var s = JS.store.state, m = R.byId(s.meals, id);
    if (!m) return;
    var days = m.weekdays.length === 7 ? 'Todos os dias' : m.weekdays.map(function (d) { return C.WEEKDAY_SHORT[d]; }).join(', ');
    ui.actionSheet({
      title: m.name, subtitle: m.time + ' • ' + days + (m.enabled ? '' : ' • Pausada'),
      detail: m.description ? '<p>' + esc(m.description) + '</p>' : '',
      actions: [
        { label: 'Editar', icon: 'edit', run: function () { openMealForm(m); } },
        { label: m.enabled ? 'Pausar' : 'Reativar', icon: m.enabled ? 'pause' : 'play', run: function () {
          JS.anim.mark(itemSel(id), 'flash', { closest: '.item' });
          JS.store.update(function (st, n) { R.setMealEnabled(st, id, !m.enabled, n); });
          ui.toast(m.enabled ? 'Horário pausado.' : 'Horário reativado.');
        } },
        { label: 'Exceção para um dia', icon: 'calendar', run: function () { exceptionForm(m); } },
        { label: 'Excluir', icon: 'trash', danger: true, run: function () {
          ui.confirm({ title: 'Excluir horário?', message: '"' + m.name + '" será excluído. O histórico de refeições feitas continua guardado.', confirmLabel: 'Excluir', danger: true })
            .then(function (ok) {
              if (ok) JS.anim.removeThen(itemSel(id), '.item', function () { JS.store.update(function (st) { R.deleteMeal(st, id); }); ui.toast('Horário excluído.'); });
            });
        } }
      ]
    });
  }

  function toggleDone(id, date) {
    var s = JS.store.state;
    var done = s.mealLogs.some(function (l) { return l.mealId === id && l.date === date; });
    JS.anim.mark('[data-action="meal-done"][data-id="' + id + '"][data-date="' + date + '"]', 'pop', { ms: 700 });
    JS.store.update(function (st, n) { if (done) R.unlogMeal(st, id, date); else R.logMeal(st, id, date, n); });
    if (!done) ui.toast('Refeição registrada.');
  }

  // Seletor dos itens de um horário (na lista de hoje e em "Meus horários").
  function itemSel(id) { return '[data-action="meal-today"][data-id="' + id + '"], [data-action="meal-menu"][data-id="' + id + '"]'; }

  JS.actions['meal-new'] = function () { openMealForm(null); };
  JS.actions['meal-menu'] = function (d) { mealMenu(d.id); };
  JS.actions['meal-today'] = function (d) { todayMenu(d.id, d.date); };
  JS.actions['meal-done'] = function (d) { toggleDone(d.id, d.date); };

  JS.forms.meal = function () { openMealForm(null); };
  JS.render.mealItem = function (o, now) { return todayItem(o, now, false); };
  JS.telas.alimentacao = { title: 'Alimentação', render: render, fab: { label: 'Novo horário de refeição', action: 'meal-new' } };
})();
