/* J.S. — Rotina / tarefas */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, ui = JS.ui, esc = ui.esc;
  var view = { mode: 'hoje', month: null };
  var DEFAULT_REMINDER = 15; // minutos antes (tarefas com horário avisam por padrão)

  // Ao preencher a hora, liga o lembrete padrão; ao apagar a hora, desliga.
  // Se a pessoa mexer no lembrete, a escolha dela é respeitada.
  function bindDefaultReminder(form, timeName, minutes) {
    var time = form.elements[timeName], rem = form.elements.reminderMinutes;
    if (!time || !rem) return;
    var touched = false;
    rem.addEventListener('change', function () { touched = true; });
    function apply() {
      if (touched) return;
      rem.value = time.value ? String(minutes) : '';
    }
    time.addEventListener('input', apply);
    time.addEventListener('change', apply);
  }
  JS.bindDefaultReminder = bindDefaultReminder;

  function isRecurring(t) { return t.recurrence && t.recurrence !== 'none'; }

  function minutesBetween(a, b) {
    var m = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
    return m < 1 ? 'menos de 1 min' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + C.pad(m % 60) + ' min';
  }
  function sinceLabel(iso) { return minutesBetween(iso, new Date().toISOString()); }
  // Atualiza o "há quanto tempo" das tarefas em andamento sem redesenhar a tela.
  setInterval(function () {
    document.querySelectorAll('[data-since]').forEach(function (el) { el.textContent = sinceLabel(el.dataset.since); });
  }, 30000);

  // "Começar agora": a tarefa fica em andamento com cronômetro, com uma animação de largada.
  function startTask(id, date) {
    var s = JS.store.state, t = R.byId(s.tasks, id);
    if (!t) return;
    var sel = itemSel(id, date || '');
    var el = document.querySelector(sel);
    var item = el && el.closest('.item');
    if (item) JS.anim.sparks(item);
    JS.anim.mark(sel, 'starting', { closest: '.item', ms: 1300 });
    JS.store.update(function (st, n) { R.startTask(st, id, date || null, n); });
    if (window.JSToque) { JSToque.unlockAudio(); JSToque.beep(660, 90); JSToque.beep(990, 140, 0.1); JSToque.vibrate(40); }
    ui.toast('Começou: ' + t.title + '. Bora! ⏱');
  }

  function taskItem(o, now, opts) {
    var t = o.task, today = C.toDateKey(now);
    var overdue = !o.done && o.date && R.isPast(o.date, o.time, now);
    var meta = [];
    if (opts && opts.showDate && o.date) meta.push(C.formatDayLabel(o.date, today));
    if (o.time) meta.push(o.time);
    meta.push(t.category);
    var doing = o.doing && !o.done;
    var flags = (doing ? '<span class="tag doing-tag"><i class="pulse-dot"></i>Em andamento • <span data-since="' + esc(o.startedAt) + '">' + sinceLabel(o.startedAt) + '</span></span>' : '') +
      (o.done && o.startedAt && o.completedAt ? ui.tag('Feita em ' + minutesBetween(o.startedAt, o.completedAt), 'success') : '') +
      (t.priority === 'high' ? ui.tag('Alta', 'high') : '') + (overdue && !doing ? ui.tag('Atrasada', 'danger') : '');
    var icons = (isRecurring(t) ? ui.icon('repeat', 14) : '') + (t.reminderMinutes != null && o.time ? ui.icon('bell', 14) : '');
    var ids = ' data-id="' + esc(t.id) + '" data-date="' + esc(o.date || '') + '"';
    return '<div class="item task' + (o.done ? ' done' : '') + (overdue ? ' overdue' : '') + (doing ? ' doing' : '') + '">' +
      '<button type="button" class="check' + (o.done ? ' on' : '') + '" data-action="task-toggle"' + ids +
      ' aria-label="' + (o.done ? 'Desmarcar' : 'Concluir') + ': ' + esc(t.title) + '">' + ui.icon('check', 16) + '</button>' +
      '<button type="button" class="item-main" data-action="task-menu"' + ids + '>' +
      '<span class="item-title"><span class="tt">' + esc(t.title) + '</span></span>' +
      '<span class="item-meta">' + meta.map(esc).join(' • ') + (icons ? ' <span class="item-icons">' + icons + '</span>' : '') + '</span>' +
      (flags ? '<span class="item-flags">' + flags + '</span>' : '') +
      '</button>' +
      (!o.done && !doing && o.date === today ? '<button type="button" class="start-mini" data-action="task-start"' + ids + ' aria-label="Começar agora: ' + esc(t.title) + '" title="Começar agora">' + ui.icon('play', 14) + '</button>' : '') +
      '</div>';
  }

  function groups(occ, now) {
    var today = C.toDateKey(now), by = {}, order = [];
    occ.forEach(function (o) { if (!by[o.date]) { by[o.date] = []; order.push(o.date); } by[o.date].push(o); });
    return order.map(function (d) {
      var label = C.formatDayLabel(d, today);
      if (label === 'Hoje' || label === 'Amanhã' || label === 'Ontem') label += ' • ' + C.formatDayMonth(d);
      var done = by[d].filter(function (o) { return o.done; }).length;
      return ui.section(label, by[d].map(function (o) { return taskItem(o, now); }).join(''), '<span class="count">' + done + '/' + by[d].length + '</span>');
    }).join('');
  }

  var ADD_BTN = { label: 'Nova tarefa', attrs: 'data-action="task-new"' };

  function render(now) {
    var s = JS.store.state, today = C.toDateKey(now);
    if (!view.month) view.month = C.monthOf(today);
    var html = '<h1 class="page-title">Minha rotina</h1>' +
      ui.segmented([['hoje', 'Hoje'], ['semana', '7 dias'], ['mes', 'Mês'], ['semdata', 'Sem data']], view.mode, 'rotina-mode');

    if (view.mode === 'hoje') {
      var overdue = R.overdueTasks(s, now).filter(function (o) { return o.date < today; });
      var list = R.taskOccurrences(s, today, today);
      var ordered = list.filter(function (o) { return !o.done; }).concat(list.filter(function (o) { return o.done; }));
      var done = list.length - list.filter(function (o) { return !o.done; }).length;
      if (overdue.length) html += ui.section('Atrasadas', overdue.map(function (o) { return taskItem(o, now, { showDate: true }); }).join(''), '<span class="count danger">' + overdue.length + '</span>');
      html += ui.section(C.formatDateLong(today),
        list.length ? ordered.map(function (o) { return taskItem(o, now); }).join('') : ui.empty('list', 'Nada para hoje. Que tal planejar o dia?', ADD_BTN),
        list.length ? '<span class="count">' + done + '/' + list.length + '</span>' : '');
    } else if (view.mode === 'semana') {
      var week = R.taskOccurrences(s, today, C.addDays(today, 6));
      html += week.length ? groups(week, now) : ui.empty('calendar', 'Nenhuma tarefa nos próximos 7 dias.', ADD_BTN);
    } else if (view.mode === 'mes') {
      var r = C.monthRange(view.month);
      var month = R.taskOccurrences(s, r.from, r.to);
      html += ui.monthNav(view.month, 'rotina-month') +
        (month.length ? groups(month, now) : ui.empty('calendar', 'Nenhuma tarefa neste mês.', ADD_BTN));
    } else {
      var und = R.undatedTasks(s);
      html += und.length ? ui.section('Sem data', und.map(function (o) { return taskItem(o, now); }).join(''))
        : ui.empty('list', 'Tarefas sem data aparecem aqui. Elas não geram lembrete até você definir um horário.', ADD_BTN);
    }
    return html;
  }

  /* ---------------- Formulários ---------------- */

  function openTaskForm(t, occDate, preset) {
    var today = C.toDateKey(new Date());
    var v = t ? Object.assign({}, t, { dueDate: occDate || t.dueDate })
      : Object.assign({ title: '', description: '', category: 'Pessoal', priority: 'normal', dueDate: today, dueTime: '', recurrence: 'none', reminderMinutes: null }, preset || {});
    // Tudo com horário avisa: tarefa antiga com hora e sem lembrete já abre com o padrão sugerido.
    if (v.dueTime && v.reminderMinutes == null) v.reminderMinutes = DEFAULT_REMINDER;
    var recurring = t && isRecurring(t);
    var body =
      ui.input({ label: 'Título', name: 'title', value: v.title, required: true, placeholder: 'Ex.: Consulta no dentista', attrs: 'maxlength="120"' }) +
      '<div class="row2">' + ui.input({ label: 'Data', name: 'dueDate', type: 'date', value: v.dueDate || '' }) +
      ui.input({ label: 'Hora', name: 'dueTime', type: 'time', value: v.dueTime || '' }) + '</div>' +
      ui.chips([{ label: 'Hoje', attrs: 'data-set-date="0"' }, { label: 'Amanhã', attrs: 'data-set-date="1"' }, { label: 'Sem data', attrs: 'data-set-date="none"' }]) +
      ui.select({ label: 'Repetição', name: 'recurrence', options: ui.entries(C.TASK_RECURRENCES), value: v.recurrence }) +
      ui.select({ label: 'Lembrete', name: 'reminderMinutes', options: C.REMINDER_OPTIONS, value: v.reminderMinutes, hint: 'O lembrete precisa de data e hora.' }) +
      '<div class="row2">' + ui.select({ label: 'Categoria', name: 'category', options: ui.plain(C.TASK_CATEGORIES), value: v.category }) +
      ui.select({ label: 'Prioridade', name: 'priority', options: ui.entries(C.PRIORITIES), value: v.priority }) + '</div>' +
      ui.textarea({ label: 'Descrição (opcional)', name: 'description', value: v.description, attrs: 'maxlength="1000"' });

    ui.openSheet({
      title: t ? 'Editar tarefa' : 'Nova tarefa', body: body, submitLabel: t ? 'Salvar' : 'Adicionar',
      onOpen: function (form) {
        bindDefaultReminder(form, 'dueTime', DEFAULT_REMINDER);
        form.querySelectorAll('[data-set-date]').forEach(function (b) {
          b.addEventListener('click', function () {
            var x = b.dataset.setDate, el = form.elements;
            if (x === 'none') { el.dueDate.value = ''; el.dueTime.value = ''; el.recurrence.value = 'none'; el.reminderMinutes.value = ''; }
            else el.dueDate.value = C.addDays(C.toDateKey(new Date()), Number(x));
          });
        });
      },
      onSubmit: function (input) {
        var r = R.validateTask(input);
        if (!r.ok) return { errors: r.errors };
        var hasReminder = r.value.reminderMinutes != null;
        if (!t) {
          var created = null;
          JS.anim.mark(function () { return created && itemSel(created.id); }, 'is-new', { closest: '.item', delay: 180 });
          JS.store.update(function (s, n) { created = R.createTask(s, r.value, n); });
          ui.toast('Tarefa adicionada.');
          return { reminder: hasReminder };
        }
        var ask = recurring && occDate
          ? ui.choose({
            title: 'Alterar tarefa repetida', message: 'Esta tarefa se repete. O que você quer alterar?',
            options: [{ label: 'Somente esta', value: 'this', primary: true }, { label: 'Esta e as próximas', value: 'future' }]
          })
          : Promise.resolve('all');
        return ask.then(function (scope) {
          if (!scope) return false;
          var changed = null;
          JS.anim.mark(function () { return changed && itemSel(changed.id); }, 'flash', { closest: '.item', delay: 180 });
          JS.store.update(function (s, n) { changed = R.updateTask(s, t.id, r.value, scope, occDate, n); });
          ui.toast('Tarefa atualizada.');
          return { reminder: hasReminder };
        });
      },
      afterClose: function (res) { if (res && res.reminder) JS.notify.askIfNeeded(); }
    });
  }

  function postponeForm(t, date) {
    var today = C.toDateKey(new Date());
    var body = '<div class="row2">' + ui.input({ label: 'Nova data', name: 'date', type: 'date', value: C.addDays(today, 1) }) +
      ui.input({ label: 'Hora', name: 'time', type: 'time', value: t.dueTime || '' }) + '</div>' +
      ui.chips([{ label: 'Amanhã', attrs: 'data-days="1"' }, { label: 'Em 2 dias', attrs: 'data-days="2"' }, { label: 'Próxima semana', attrs: 'data-days="7"' }]) +
      (isRecurring(t) ? '<p class="hint">Só esta ocorrência muda. As próximas continuam no horário de sempre.</p>' : '');
    ui.openSheet({
      title: 'Adiar tarefa', subtitle: t.title, body: body, submitLabel: 'Adiar',
      onOpen: function (form) {
        form.querySelectorAll('[data-days]').forEach(function (b) {
          b.addEventListener('click', function () { form.elements.date.value = C.addDays(C.toDateKey(new Date()), Number(b.dataset.days)); });
        });
      },
      onSubmit: function (v) {
        var e = {};
        if (!C.isDateKey(v.date)) e.date = 'Escolha a nova data.';
        if (v.time && !C.isTimeKey(v.time)) e.time = 'Horário inválido.';
        if (Object.keys(e).length) return { errors: e };
        JS.store.update(function (s, n) { R.postponeTask(s, t.id, date, v.date, v.time || null, n); });
        ui.toast('Adiada para ' + C.formatDayLabel(v.date, C.toDateKey(new Date())).toLowerCase() + '.');
      }
    });
  }

  function deleteTaskFlow(t, date) {
    if (isRecurring(t) && date) {
      ui.choose({
        title: 'Excluir tarefa repetida', message: '"' + t.title + '" se repete. O que você quer excluir?',
        options: [{ label: 'Somente esta ocorrência', value: 'this', primary: true }, { label: 'Toda a série', value: 'all', danger: true }]
      }).then(function (c) {
        if (c === 'this') JS.anim.removeThen(itemSel(t.id, date), '.item', function () { JS.store.update(function (s) { R.skipTaskOccurrence(s, t.id, date); }); ui.toast('Ocorrência excluída.'); });
        if (c === 'all') JS.anim.removeThen(itemSel(t.id), '.item', function () { JS.store.update(function (s) { R.deleteTaskSeries(s, t.id); }); ui.toast('Série excluída.'); });
      });
      return;
    }
    ui.confirm({ title: 'Excluir tarefa?', message: '"' + t.title + '" será excluída. Isso não pode ser desfeito.', confirmLabel: 'Excluir', danger: true })
      .then(function (ok) {
        if (ok) JS.anim.removeThen(itemSel(t.id), '.item', function () { JS.store.update(function (s) { R.deleteTask(s, t.id); }); ui.toast('Tarefa excluída.'); });
      });
  }

  // Seletor do item de uma tarefa (e de uma ocorrência, se a data for informada).
  function itemSel(id, date) {
    return '[data-action="task-menu"][data-id="' + id + '"]' + (date !== undefined ? '[data-date="' + (date || '') + '"]' : '');
  }

  function taskMenu(id, date) {
    var s = JS.store.state, t = R.byId(s.tasks, id);
    if (!t) return;
    var today = C.toDateKey(new Date());
    var o = s.taskOcc[R.occKey(id, date)];
    var done = !!(o && o.status === 'done');
    var doing = !!(o && o.status === 'doing');
    var sub = [date ? C.formatDayLabel(date, today) + ' (' + C.formatDayMonth(date) + ')' : 'Sem data',
      date && t.dueTime ? t.dueTime : null, isRecurring(t) ? C.TASK_RECURRENCES[t.recurrence] : null, t.category].filter(Boolean).join(' • ');
    var detail = (t.description ? '<p>' + esc(t.description) + '</p>' : '') +
      (t.reminderMinutes != null && t.dueTime ? '<p class="muted">' + ui.icon('bell', 14) + ' Lembrete: ' + esc(C.minutesLabel(t.reminderMinutes)) + '</p>' : '') +
      (done && o.completedAt ? '<p class="muted">' + ui.icon('check', 14) + ' Concluída em ' + esc(C.formatTimestamp(o.completedAt)) + (o.startedAt ? ' (levou ' + esc(minutesBetween(o.startedAt, o.completedAt)) + ')' : '') + '</p>' : '') +
      (doing ? '<p class="muted">' + ui.icon('clock', 14) + ' Em andamento há ' + esc(sinceLabel(o.startedAt)) + '</p>' : '');
    ui.actionSheet({
      title: t.title, subtitle: sub, detail: detail,
      actions: [
        !done && !doing ? { label: 'Começar agora', icon: 'play', run: function () { startTask(id, date); } } : null,
        { label: done ? 'Marcar como pendente' : 'Concluir', icon: done ? 'undo' : 'check', run: function () { toggle({ id: id, date: date || '' }); } },
        doing ? { label: 'Parar (voltar para pendente)', icon: 'pause', run: function () { JS.store.update(function (st) { R.stopTask(st, id, date || null); }); ui.toast('Tarefa voltou para pendente.'); } } : null,
        date && t.dueTime && t.reminderMinutes == null ? { label: 'Avisar 15 min antes', icon: 'bell', run: function () {
          JS.anim.mark(itemSel(t.id), 'flash', { closest: '.item' });
          JS.store.update(function (s, n) { var x = R.byId(s.tasks, t.id); if (x) { x.reminderMinutes = DEFAULT_REMINDER; x.updatedAt = n; } });
          ui.toast('Lembrete ligado: 15 min antes.');
          JS.notify.askIfNeeded();
        } } : null,
        { label: 'Editar', icon: 'edit', run: function () { openTaskForm(t, date); } },
        date && !done ? { label: 'Adiar', icon: 'clock', run: function () { postponeForm(t, date); } } : null,
        { label: 'Excluir', icon: 'trash', danger: true, run: function () { deleteTaskFlow(t, date); } }
      ]
    });
  }

  function toggle(d, btn) {
    var s = JS.store.state, t = R.byId(s.tasks, d.id);
    if (!t) return;
    var date = d.date || null;
    var o = s.taskOcc[R.occKey(d.id, date)];
    var wasDone = !!(o && o.status === 'done');
    var checkSel = '[data-action="task-toggle"][data-id="' + d.id + '"][data-date="' + (d.date || '') + '"]';

    function save() {
      JS.store.update(function (st, n) { R.setTaskDone(st, d.id, date, !wasDone, n); });
      if (wasDone) return;
      var today = C.toDateKey(new Date());
      var list = R.taskOccurrences(JS.store.state, today, today);
      if (date === today && list.length && list.every(function (x) { return x.done; })) {
        JS.anim.celebrate();
        var name = (JS.store.state.settings.name || '').trim();
        ui.toast('Tudo feito por hoje' + (name ? ', ' + name : '') + '! ✨');
        JS.anim.mark('.done-msg', 'pop-in', { ms: 800 });
        JS.app.render();
      } else {
        var oc = JS.store.state.taskOcc[R.occKey(d.id, date)];
        ui.toast('Concluída: ' + t.title + (oc && oc.startedAt ? ' (em ' + minutesBetween(oc.startedAt, oc.completedAt) + ')' : ''), {
          actionLabel: 'Desfazer',
          onAction: function () { JS.store.update(function (st, n) { R.setTaskDone(st, d.id, date, false, n); }); }
        });
      }
    }

    // No painel, a tarefa concluída sai da lista: anima o ✓ no lugar e depois a desliza para fora.
    if (!wasDone && btn && JS.app.route() === 'inicio' && !JS.anim.reduced()) {
      var item = btn.closest('.item');
      btn.classList.add('on');
      JS.anim.restartClass(btn, 'pop');
      if (item) { item.classList.add('done'); JS.anim.restartClass(item, 'just-done'); }
      setTimeout(function () { JS.anim.removeThen(item, null, save); }, 480);
      return;
    }
    JS.anim.mark(checkSel, 'pop', { ms: 700 });
    if (!wasDone) JS.anim.mark(checkSel, 'just-done', { closest: '.item', ms: 900 });
    save();
  }

  JS.actions['rotina-mode'] = function (d) {
    var order = ['hoje', 'semana', 'mes', 'semdata'];
    var dir = order.indexOf(d.mode) > order.indexOf(view.mode) ? 'r' : 'l';
    if (d.mode === view.mode) return;
    view.mode = d.mode;
    JS.app.render({ enter: 'view:' + dir });
  };
  JS.actions['rotina-month'] = function (d) {
    view.month = C.addMonthKey(view.month, Number(d.delta));
    JS.app.render({ enter: 'view:' + (Number(d.delta) > 0 ? 'r' : 'l') });
  };
  JS.actions['task-new'] = function (d) { openTaskForm(null, null, d && d.date ? { dueDate: d.date } : null); };
  JS.actions['task-toggle'] = toggle;
  JS.actions['task-menu'] = function (d) { taskMenu(d.id, d.date || null); };
  JS.actions['task-start'] = function (d) { startTask(d.id, d.date || null); };

  JS.forms.task = function (preset) { openTaskForm(null, null, preset); };
  JS.render.taskItem = taskItem;
  JS.telas.rotina = { title: 'Rotina', render: render, fab: { label: 'Nova tarefa', action: 'task-new' } };
})();
