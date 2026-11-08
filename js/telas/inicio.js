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
    var miss = JS.missingReminders ? JS.missingReminders() : { total: 0 };
    if (miss.total) {
      html += '<div class="banner"><span class="banner-ic">' + ui.icon('belloff', 20) + '</span><div><strong>' + miss.total +
        (miss.total === 1 ? ' item com horário está sem lembrete' : ' itens com horário estão sem lembrete') + '</strong>' +
        '<p>Sem lembrete, você não é avisada.</p></div>' +
        '<button type="button" class="btn primary small" data-action="reminders-fix">Ligar todos</button></div>';
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
    var pending = d.todayTasks.filter(function (o) { return !o.done && o.doing; }).concat(d.todayTasks.filter(function (o) { return !o.done && !o.doing; }));
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

    // Treino, calorias, cronograma capilar e refeição
    var T = window.JSTreino, N = window.JSNutri;
    var act = T.activeSession(s), wp = T.planForDate(s, today);
    var doneW = s.workoutSessions.some(function (x) { return x.date === today && x.status === 'done'; });
    var wTxt = act ? '<strong>Em andamento</strong><span>' + esc(act.planName) + ' • continuar</span>'
      : wp.plan ? '<strong>' + esc(wp.plan.name) + '</strong><span>' + (doneW ? 'Feito hoje ✓' : wp.plan.items.length + ' exercícios • iniciar') + '</span>'
        : wp.rest ? '<strong>Descanso</strong><span>Recupere as energias</span>'
          : s.workoutPlans.length ? '<strong>Sem ficha hoje</strong><span>Escolha uma ficha</span>' : '<strong>Monte sua ficha</strong><span>Exercícios, séries e carga</span>';
    var dl = N.dayLog(s, today), target = N.kcalTarget(s, today);
    var kTxt = '<strong>' + JS.graf.fmtNum(dl.total.kcal || 0, 0) + (target ? ' / ' + JS.graf.fmtNum(target.value, 0) : '') + ' kcal</strong><span>' +
      (dl.count ? dl.count + (dl.count === 1 ? ' alimento registrado' : ' alimentos registrados') : 'Registre o que comeu') + '</span>';
    var hair = d.hairToday[0] || d.nextHair;
    var hairTxt = hair
      ? '<strong>' + esc(R.hairName(hair)) + '</strong><span>' + esc(hair.date === today ? 'Hoje' + (hair.time ? ' às ' + hair.time : '') : C.formatDayLabel(hair.date, today) + (hair.time ? ' • ' + hair.time : '')) + '</span>'
      : '<strong>Nada planejado</strong><span>Monte seu cronograma</span>';
    var meal = d.nextMeal;
    var mealTxt = meal
      ? '<strong>' + esc(meal.meal.name) + '</strong><span>' + esc((meal.date === today ? 'Hoje' : C.formatDayLabel(meal.date, today)) + ' às ' + meal.time) + '</span>'
      : '<strong>Sem horários</strong><span>Cadastre suas refeições</span>';
    html += '<div class="grid2 mini-grid">' +
      '<button type="button" class="mini-card m-work' + (act ? ' live' : '') + '" data-action="go" data-route="' + (act ? 'sessao' : 'treino') + '"><span class="mini-label">' + ui.icon('dumbbell', 16) + 'Treino de hoje</span>' + wTxt + '</button>' +
      '<button type="button" class="mini-card m-kcal" data-action="go" data-route="alimentacao"><span class="mini-label">' + ui.icon('flame', 16) + 'Calorias hoje</span>' + kTxt +
      (target ? '<span class="mini-bar"><i style="width:' + Math.min(100, Math.round((dl.total.kcal || 0) / target.value * 100)) + '%"></i></span>' : '') + '</button>' +
      '<button type="button" class="mini-card m-hair" data-action="go" data-route="autocuidado"><span class="mini-label">' + ui.icon('flower', 16) + (d.hairToday.length ? 'Capilar hoje' : 'Próximo capilar') + '</span>' + hairTxt + '</button>' +
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
    html += '<section class="quick"><h2>Adicionar</h2><div class="quick-grid six">' +
      quick('task', 'list', 'Tarefa') + quick('food', 'utensils', 'Alimento') + quick('workout', 'dumbbell', 'Treino') +
      quick('hair', 'flower', 'Tratamento') + quick('bill', 'wallet', 'Conta') + quick('body', 'body', 'Medição') +
      '</div></section>';
    return html;
  }

  function quick(kind, iconName, label) {
    return '<button type="button" class="quick-btn q-' + kind + '" data-action="quick-add" data-kind="' + kind + '">' + ui.icon(iconName, 22) + '<span>' + esc(label) + '</span></button>';
  }

  JS.actions['go'] = function (d) { JS.app.go(d.route); };
  JS.actions['quick-add'] = function (d) {
    if (d.kind === 'workout') {
      var s = JS.store.state, T = window.JSTreino, today = C.toDateKey(new Date());
      if (T.activeSession(s)) { JS.app.go('sessao'); return; }
      var p = T.planForDate(s, today);
      if (p.plan) { JS.startWorkout(p.plan.id); return; }
      if (!s.workoutPlans.length) { JS.forms.plan(); return; }
      JS.app.go('treino');
      return;
    }
    if (JS.forms[d.kind]) JS.forms[d.kind]();
  };
  JS.actions['backup-dismiss'] = function (d, el) {
    JS.anim.removeThen(el, '.banner', function () { dismissedBackup = true; JS.app.render(); });
  };

  JS.telas.inicio = { title: 'Início', render: render };
})();
