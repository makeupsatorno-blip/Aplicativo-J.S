/* J.S. — Painel inicial */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, ui = JS.ui, esc = ui.esc;
  var dismissedBackup = false;
  var lastPct = null; // a barra de progresso cresce do valor anterior até o novo

  function greeting(now) {
    var h = now.getHours();
    return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  function card(title, inner, opts) {
    opts = opts || {};
    return '<section class="card ' + (opts.cls || '') + '"><div class="card-head"><h2>' + (opts.icon ? ui.icon(opts.icon, 18) : '') + esc(title) + '</h2>' + (opts.extra || '') + '</div>' + inner + '</section>';
  }
  function link(label, route) {
    return '<button type="button" class="link" data-action="go" data-route="' + route + '">' + esc(label) + ui.icon('right', 16) + '</button>';
  }

  function render(now) {
    var s = JS.store.state, d = R.dashboard(s, now), today = d.today;
    var name = (s.settings.name || '').trim();
    var html = '<section class="hero"><p class="eyebrow">J.S. • SEU ESPAÇO</p>' +
      '<h1>' + esc(greeting(now)) + (name ? ', ' + esc(name) : '') + ' <span class="wave" aria-hidden="true">🌷</span></h1>' +
      '<p class="muted">' + esc(C.formatDateLong(today)) + '</p></section>';

    if (JS.app.canInstall()) {
      html += '<div class="banner"><span class="banner-ic">' + ui.icon('phone', 20) + '</span><div><strong>Instale o J.S.</strong><p>Abra direto da tela inicial, como um aplicativo.</p></div>' +
        '<button type="button" class="btn primary small" data-action="install">Instalar</button></div>';
    }
    var lb = s.settings.lastBackupAt;
    if (!dismissedBackup && R.hasAnyData(s) && (!lb || C.diffDays(C.toDateKey(new Date(lb)), today) >= 14)) {
      html += '<div class="banner soft"><span class="banner-ic">' + ui.icon('shield', 20) + '</span><div><strong>' + (lb ? 'Hora de um novo backup' : 'Faça um backup') + '</strong>' +
        '<p>Seus dados ficam só neste aparelho. Guarde uma cópia.</p></div>' +
        '<div class="banner-actions"><button type="button" class="btn primary small" data-action="backup-export">Fazer backup</button>' +
        '<button type="button" class="btn ghost small" data-action="backup-dismiss">Depois</button></div></div>';
    }

    // Hoje
    var total = d.todayTasks.length;
    var pending = d.todayTasks.filter(function (o) { return !o.done; });
    var pct = total ? Math.round(d.doneCount / total * 100) : 0;
    var fromPct = lastPct == null ? 0 : lastPct;
    lastPct = pct;
    var todayInner = total
      ? '<div class="progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Tarefas de hoje concluídas"><span style="width:' + fromPct + '%" data-progress-to="' + pct + '"></span></div>' +
        (pending.length ? pending.slice(0, 5).map(function (o) { return JS.render.taskItem(o, now); }).join('') : '<p class="done-msg">Tudo feito por hoje! ✨</p>') +
        (pending.length > 5 ? '<p class="muted small">+ ' + (pending.length - 5) + ' tarefa(s)</p>' : '')
      : '<p class="muted small">Nenhuma tarefa para hoje.</p>';
    html += card('Hoje', todayInner + link('Ver rotina', 'rotina'), {
      icon: 'list', extra: total ? '<span class="count">' + d.doneCount + ' de ' + total + '</span>' : ''
    });

    // Atrasadas
    var nOver = d.overdueTasks.length + d.overdueBills.length + d.overdueHair.length;
    if (nOver) {
      html += card('Pendências atrasadas',
        d.overdueTasks.slice(0, 4).map(function (o) { return JS.render.taskItem(o, now, { showDate: true }); }).join('') +
        d.overdueBills.slice(0, 4).map(function (b) { return JS.render.billItem(b, now, { compact: true }); }).join('') +
        d.overdueHair.slice(0, 3).map(function (e) { return JS.render.hairItem(e, now); }).join(''),
        { cls: 'warn', icon: 'alert', extra: '<span class="count danger">' + nOver + '</span>' });
    }

    // Autocuidado e refeição
    var hair = d.hairToday[0] || d.nextHair;
    var hairTxt = hair
      ? '<strong>' + esc(R.hairName(hair)) + '</strong><span>' + esc(hair.date === today ? 'Hoje' + (hair.time ? ' às ' + hair.time : '') : C.formatDayLabel(hair.date, today) + (hair.time ? ' • ' + hair.time : '')) + '</span>'
      : '<strong>Nada planejado</strong><span>Monte seu cronograma</span>';
    var meal = d.nextMeal;
    var mealTxt = meal
      ? '<strong>' + esc(meal.meal.name) + '</strong><span>' + esc((meal.date === today ? 'Hoje' : C.formatDayLabel(meal.date, today)) + ' às ' + meal.time) + '</span>'
      : '<strong>Sem horários</strong><span>Cadastre suas refeições</span>';
    html += '<div class="grid2">' +
      '<button type="button" class="mini-card m-hair" data-action="go" data-route="autocuidado"><span class="mini-label">' + ui.icon('flower', 16) + (d.hairToday.length ? 'Autocuidado hoje' : 'Próximo autocuidado') + '</span>' + hairTxt + '</button>' +
      '<button type="button" class="mini-card m-meal" data-action="go" data-route="alimentacao"><span class="mini-label">' + ui.icon('utensils', 16) + 'Próxima refeição</span>' + mealTxt + '</button>' +
      '</div>';

    // Contas próximas
    html += card('Contas nos próximos 7 dias',
      (d.billsSoon.length ? d.billsSoon.slice(0, 5).map(function (b) { return JS.render.billItem(b, now, { compact: true }); }).join('')
        : '<p class="muted small">Nenhuma conta vencendo nos próximos dias.</p>') + link('Ver financeiro', 'financeiro'),
      { icon: 'wallet' });

    // Próximos dias
    if (d.upcomingTasks.length) {
      html += card('Próximos dias', d.upcomingTasks.map(function (o) { return JS.render.taskItem(o, now, { showDate: true }); }).join('') + link('Ver agenda', 'agenda'), { icon: 'calendar' });
    }

    // Adicionar rápido
    html += '<section class="quick"><h2>Adicionar</h2><div class="quick-grid">' +
      quick('task', 'list', 'Tarefa') + quick('meal', 'utensils', 'Refeição') + quick('hair', 'flower', 'Tratamento') + quick('bill', 'wallet', 'Conta') +
      '</div></section>';
    return html;
  }

  function quick(kind, iconName, label) {
    return '<button type="button" class="quick-btn q-' + kind + '" data-action="quick-add" data-kind="' + kind + '">' + ui.icon(iconName, 22) + '<span>' + esc(label) + '</span></button>';
  }

  JS.actions['go'] = function (d) { JS.app.go(d.route); };
  JS.actions['quick-add'] = function (d) { if (JS.forms[d.kind]) JS.forms[d.kind](); };
  JS.actions['backup-dismiss'] = function (d, el) {
    JS.anim.removeThen(el, '.banner', function () { dismissedBackup = true; JS.app.render(); });
  };

  JS.telas.inicio = { title: 'Início', render: render };
})();
