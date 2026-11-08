/* J.S. — Agenda: calendário único com tarefas, tratamentos, refeições e contas */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, ui = JS.ui, esc = ui.esc;
  var view = { month: null, selected: null, filters: { task: true, hair: true, meal: true, bill: true } };
  var MODS = [['task', 'Rotina'], ['hair', 'Capilar'], ['meal', 'Alimentação'], ['bill', 'Financeiro']];

  function render(now) {
    var s = JS.store.state, today = C.toDateKey(now);
    if (!view.month) view.month = C.monthOf(today);
    if (!view.selected || C.monthOf(view.selected) !== view.month) view.selected = C.monthOf(today) === view.month ? today : view.month + '-01';
    var marks = R.agendaMarkers(s, view.month);
    var r = C.monthRange(view.month);
    var offset = C.weekday(r.from);

    var html = '<h1 class="page-title">Agenda</h1>' + ui.monthNav(view.month, 'agenda-month') +
      '<div class="filters" role="group" aria-label="Filtrar por módulo">' + MODS.map(function (m) {
        var on = view.filters[m[0]];
        return '<button type="button" class="filter f-' + m[0] + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-action="agenda-filter" data-k="' + m[0] + '"><span class="dot"></span>' + esc(m[1]) + '</button>';
      }).join('') + '</div>';

    html += '<div class="cal" role="grid"><div class="cal-head">' + C.WEEKDAY_LETTERS.map(function (l, i) { return '<span aria-label="' + C.WEEKDAY_SHORT[i] + '">' + l + '</span>'; }).join('') + '</div><div class="cal-grid">';
    for (var i = 0; i < offset; i++) html += '<span class="cal-cell empty"></span>';
    for (var d = r.from; d <= r.to; d = C.addDays(d, 1)) {
      var m = marks[d] || {};
      var dots = MODS.filter(function (x) { return view.filters[x[0]] && m[x[0]]; }).map(function (x) { return '<i class="d-' + x[0] + '"></i>'; }).join('');
      html += '<button type="button" class="cal-cell' + (d === today ? ' today' : '') + (d === view.selected ? ' sel' : '') + '" data-action="agenda-day" data-date="' + d + '" aria-label="' + esc(C.formatDateLong(d)) + '">' +
        '<span class="n">' + Number(d.slice(8)) + '</span><span class="dots">' + dots + '</span></button>';
    }
    html += '</div></div>';

    var a = R.agendaForDate(s, view.selected);
    var parts = '';
    if (view.filters.task && a.tasks.length) parts += ui.section('Rotina', a.tasks.map(function (o) { return JS.render.taskItem(o, now); }).join(''));
    if (view.filters.hair && a.hair.length) parts += ui.section('Cronograma capilar', a.hair.map(function (e) { return JS.render.hairItem(e, now); }).join(''));
    if (view.filters.meal && a.meals.length) parts += ui.section('Alimentação', a.meals.map(function (o) { return JS.render.mealItem(o, now); }).join(''));
    if (view.filters.bill && a.bills.length) parts += ui.section('Financeiro', a.bills.map(function (b) { return JS.render.billItem(b, now, { compact: true }); }).join(''));
    html += '<div class="day-detail"><h2 class="day-title">' + esc(C.formatDateLong(view.selected)) + '</h2>' +
      (parts || '<p class="muted small">Nada marcado neste dia.</p>') +
      '<button type="button" class="btn soft full" data-action="task-new" data-date="' + view.selected + '">' + ui.icon('plus', 18) + 'Tarefa neste dia</button></div>';
    return html;
  }

  JS.actions['agenda-month'] = function (d) {
    view.month = C.addMonthKey(view.month, Number(d.delta));
    view.selected = null;
    JS.app.render({ enter: 'view:' + (Number(d.delta) > 0 ? 'r' : 'l') });
  };
  JS.actions['agenda-day'] = function (d) {
    if (view.selected === d.date) return;
    view.selected = d.date;
    JS.anim.mark('.cal-cell.sel', 'pop', { ms: 500 });
    JS.anim.mark('.day-detail', 'fade-up', { ms: 500 });
    JS.app.render();
  };
  JS.actions['agenda-filter'] = function (d) {
    view.filters[d.k] = !view.filters[d.k];
    JS.anim.mark('.day-detail', 'fade-up', { ms: 500 });
    JS.app.render();
  };

  JS.telas.agenda = { title: 'Agenda', render: render };
})();
