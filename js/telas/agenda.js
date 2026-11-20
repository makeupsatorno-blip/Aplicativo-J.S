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
    if (window.JSIcs) html += '<button type="button" class="btn ghost full agenda-export" data-action="agenda-export">' + ui.icon('share', 18) + 'Exportar para o calendário (Google, Apple)</button>';
    return html;
  }

  /* ---------------- Exportar para o calendário (.ics) ---------------- */

  var EXPORT = [['tarefas', 'Rotina', 'Tarefas com data; as que se repetem viram um evento que se repete'], ['capilar', 'Cronograma capilar', 'Tratamentos pendentes'], ['contas', 'Contas', 'Contas pendentes (o valor só aparece se estiver ligado nas notificações)'],
    ['refeicoes', 'Horários de refeição', 'Os horários cadastrados, repetindo'], ['treinos', 'Treinos planejados', 'A semana fixa de treino']];

  function entregarIcs(texto) {
    var file = new File([texto], 'js-agenda.ics', { type: 'text/calendar' });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: 'Agenda do J.S.' }).then(function () { return 'compartilhado'; }, function (e) { if (e && e.name === 'AbortError') return 'cancelado'; return baixarIcs(file); });
    }
    return Promise.resolve(baixarIcs(file));
  }
  function baixarIcs(file) {
    var url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 6000);
    return 'baixado';
  }

  function exportar() {
    var s = JS.store.state, I = window.JSIcs;
    if (!I) return;
    var todos = I.montar(s, {}, new Date());
    var body = '<p class="hint top">Cria um arquivo .ics com o que está marcado nos próximos 12 meses, para abrir no Google Agenda, no Calendário da Apple ou no do Samsung.</p>' +
      EXPORT.map(function (e) { var n = todos.porTipo[e[0]]; return ui.checkbox({ label: e[1] + ' (' + n + (n === 1 ? ' evento' : ' eventos') + ')', hint: e[2], name: e[0], checked: n > 0 }); }).join('') +
      '<ol class="help-list"><li><strong>Android/Google:</strong> toque no arquivo (ou, no computador, Google Agenda → Configurações → Importar) e escolha a agenda.</li>' +
      '<li><strong>iPhone:</strong> abra o arquivo e toque em <strong>Adicionar tudo</strong>.</li></ol>' +
      '<p class="hint">É uma cópia de hoje: o que você mudar depois no J.S. não muda no calendário. Gere de novo quando quiser atualizar (importar de novo pode duplicar eventos; apague os antigos antes).</p>';
    ui.openSheet({
      title: 'Exportar para o calendário', body: body, submitLabel: 'Gerar arquivo',
      onSubmit: function (v) {
        var op = {}, any = false;
        EXPORT.forEach(function (e) { op[e[0]] = v[e[0]] === true; if (op[e[0]]) any = true; });
        if (!any) return { errors: { tarefas: 'Escolha pelo menos uma opção.' } };
        var res = I.montar(JS.store.state, op, new Date());
        if (!res.total) return { errors: { tarefas: 'Não há nada a exportar nas opções escolhidas.' } };
        JS.agendaIcs = res;
        return entregarIcs(res.texto).then(function (como) { return { como: como, total: res.total }; });
      },
      afterClose: function (r) { if (r && r.como) ui.toast(r.como === 'baixado' ? r.total + ' eventos salvos em js-agenda.ics (pasta Downloads).' : r.como === 'compartilhado' ? 'Arquivo do calendário enviado.' : 'Tudo bem, nada foi enviado.', { timeout: 5000 }); }
    });
  }
  JS.actions['agenda-export'] = exportar;
  if (JS.search && JS.search.shortcuts) JS.search.shortcuts.push(['Exportar agenda para o calendário', 'exportar agenda calendario google apple ics samsung', 'calendar', { action: 'agenda-export' }]);

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
