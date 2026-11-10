/* J.S. — Treino: ficha de hoje, semana fixa, calendário do mês, fichas e evolução de carga */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, T = window.JSTreino, ui = JS.ui, esc = ui.esc;
  var view = { mode: 'hoje', month: null, evoEx: null };
  var MODES = [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['fichas', 'Fichas'], ['evolucao', 'Evolução']];
  var WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
  var WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var REST_OPTIONS = [[0, 'Sem descanso'], [15, '15 s'], [20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '1 min'], [90, '1 min 30'], [120, '2 min'], [150, '2 min 30'], [180, '3 min'], [240, '4 min']];

  function kg(v) { return (v == null ? '—' : JS.graf.fmtNum(v, 1)) + ' kg'; }
  JS.kg = kg;

  /* ---------------- Desenho da execução (funciona sem internet) ---------------- */
  // Biblioteca: desenho animado de cada exercício (js/dados/animacoes.js + js/exanim.js).
  // Exercício criado pela usuária: sem desenho; se ela colocou um link, dá para abrir.
  function exAnim(ex) { return ex && window.JSAnimacoes ? window.JSAnimacoes[String(ex.id).replace(/^ex:/, '')] || null : null; }
  function exThumb(ex) { var a = exAnim(ex); return a ? JSExAnim.still(a, 'exa exa-thumb') : ''; }
  // Lugar do desenho animado (a animação começa depois de entrar na tela, com startDrawings).
  function exPlayer(ex) {
    var a = exAnim(ex);
    if (a) return '<div class="exa-box" data-exa="' + esc(ex.id) + '" aria-label="Desenho animado da execução de ' + esc(ex.name) + '">' + JSExAnim.still(a) + '</div>';
    return ex && ex.videoUrl ? '<a class="btn soft small" href="' + esc(ex.videoUrl) + '" target="_blank" rel="noopener">' + ui.icon('play', 16) + 'Abrir o vídeo que você salvou</a>' : '';
  }
  function startDrawings(rootEl) {
    (rootEl || document).querySelectorAll('.exa-box[data-exa]').forEach(function (box) {
      if (box._exa) return;
      box._exa = JSExAnim.play(box, exAnim({ id: box.dataset.exa }));
    });
  }
  JS.exAnim = exAnim; JS.exPlayer = exPlayer; JS.startDrawings = startDrawings;
  function badge(s, plan) {
    return '<span class="plan-badge" style="--pc:' + esc(plan.color) + '" aria-hidden="true">' + esc(T.planLetter(s, plan)) + '</span>';
  }
  JS.planBadge = badge;
  function duration(min) { return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + C.pad(min % 60) + ' min'; }
  JS.duration = duration;
  function daysOf(s, plan) {
    var d = WEEK_ORDER.filter(function (w) { return s.workout.week[w] === plan.id; }).map(function (w) { return C.WEEKDAY_SHORT[w]; });
    return d.length ? d.join(', ') : 'sem dia fixo';
  }

  // "20 kg" ou, com carga por série, "20/22,5/25 kg".
  function loadsText(it) {
    var loads = T.itemLoads(it);
    if (!loads.length || loads.every(function (x) { return !x; })) return '';
    return ' • ' + (T.samePerSet(loads) ? kg(loads[0]) : loads.map(function (x) { return JS.graf.fmtNum(x, 1); }).join('/') + ' kg');
  }
  function exerciseLine(s, it) {
    var ex = T.exerciseById(s, it.exerciseId);
    return '<div class="ex-row"><span class="ex-name">' + esc(ex ? ex.name : 'Exercício removido') + '</span>' +
      '<span class="ex-meta">' + it.sets + ' × ' + esc(it.reps) + loadsText(it) + '</span></div>';
  }

  /* ---------------- Hoje ---------------- */

  function summaryHtml(sum) {
    return '<div class="sum-grid">' +
      '<div><strong>' + duration(sum.minutes) + '</strong><span>duração</span></div>' +
      '<div><strong>' + sum.sets + '</strong><span>séries</span></div>' +
      '<div><strong>' + JS.graf.fmtNum(sum.volume, 0) + ' kg</strong><span>volume</span></div></div>' +
      (sum.prs.length ? '<p class="pr-line">' + ui.icon('sparkle', 16) + ' Recorde: ' + sum.prs.map(function (p) { return esc(p.name) + ' ' + kg(p.load); }).join(', ') + '</p>' : '');
  }
  JS.workoutSummaryHtml = summaryHtml;

  function renderHoje(s, now) {
    var today = C.toDateKey(now), html = '';
    var act = T.activeSession(s);
    if (act) {
      var nSets = act.items.reduce(function (a, it) { return a + it.sets.length; }, 0);
      html += '<div class="banner live"><span class="banner-ic">' + ui.icon('dumbbell', 20) + '</span><div><strong>Treino em andamento</strong><p>' +
        esc(act.planName) + ' • ' + nSets + (nSets === 1 ? ' série' : ' séries') + '</p></div>' +
        '<button type="button" class="btn primary small" data-action="go" data-route="sessao">Continuar</button></div>';
    }
    html += cycleCard(s, today);
    if (!s.workoutPlans.length) {
      return html + readyCard() + ui.empty('dumbbell', 'Comece por um treino pronto ou monte sua ficha: escolha os exercícios, séries, repetições e carga. Depois é só iniciar e ir marcando por toque.', { label: 'Montar minha primeira ficha', attrs: 'data-action="plan-new"' });
    }
    var p = T.planForDate(s, today);
    var done = s.workoutSessions.filter(function (x) { return x.date === today && x.status === 'done'; });
    var inner;
    if (p.plan) {
      inner = '<div class="plan-head">' + badge(s, p.plan) + '<div><strong>' + esc(p.plan.name) + '</strong><span>' + p.plan.items.length + ' exercícios' +
        (p.changed ? ' • trocado só hoje' : '') + '</span></div></div>' +
        '<div class="ex-list">' + p.plan.items.map(function (it) { return exerciseLine(s, it); }).join('') + '</div>' +
        (act ? '' : '<button type="button" class="btn primary full start-btn" data-action="workout-start" data-plan="' + esc(p.plan.id) + '">' + ui.icon('play', 18) + (done.length ? 'Treinar de novo' : 'Iniciar treino') + '</button>');
    } else if (p.rest) {
      inner = '<p class="rest-msg">Hoje é dia de descanso 😴</p><p class="muted small">Descansar também faz parte do treino.</p>';
    } else {
      inner = '<p class="muted">Nenhuma ficha marcada para ' + esc(WEEKDAY_FULL[C.weekday(today)].toLowerCase()) + '.</p>' +
        '<div class="btn-col"><button type="button" class="btn primary" data-action="workout-day" data-date="' + today + '">Escolher ficha para hoje</button>' +
        '<button type="button" class="btn soft" data-action="treino-semana">Montar a semana</button></div>';
    }
    html += '<section class="card"><div class="card-head"><h2>' + ui.icon('dumbbell', 18) + 'Treino de hoje</h2>' +
      '<button type="button" class="link small-link" data-action="workout-day" data-date="' + today + '">Trocar</button></div>' + inner +
      '<button type="button" class="btn soft full quick-btn-open" data-action="quick-open">' + ui.icon('sparkle', 18) + 'Registro rápido de uma série</button></section>';

    done.forEach(function (x) {
      html += '<section class="card ok-card"><div class="card-head"><h2>' + ui.icon('check', 18) + 'Feito hoje: ' + esc(x.planName) + '</h2></div>' +
        summaryHtml(T.sessionSummary(s, x)) + '<button type="button" class="link" data-action="session-view" data-id="' + esc(x.id) + '">Ver séries' + ui.icon('right', 16) + '</button></section>';
    });

    // Próximos dias
    var next = [];
    for (var i = 1; i <= 6; i++) {
      var d = C.addDays(today, i), pd = T.planForDate(s, d);
      next.push('<button type="button" class="next-day" data-action="workout-day" data-date="' + d + '"><span>' + esc(C.formatDayLabel(d, today)) + '</span>' +
        (pd.plan ? badge(s, pd.plan) + '<strong>' + esc(pd.plan.name) + '</strong>' : '<em>' + (pd.rest ? 'Descanso' : '—') + '</em>') + '</button>');
    }
    html += ui.section('Próximos dias', '<div class="next-days">' + next.join('') + '</div>');

    var wk = T.weeklyStats(s, today, 1)[0];
    html += '<div class="summary"><div class="stat"><span class="stat-label">Nesta semana</span><strong>' + wk.count + (wk.count === 1 ? ' treino' : ' treinos') + '</strong>' +
      '<span class="stat-sub">' + duration(wk.minutes) + '</span></div><div class="stat"><span class="stat-label">Volume da semana</span><strong>' +
      JS.graf.fmtNum(wk.volume, 0) + ' kg</strong><span class="stat-sub">carga × repetições</span></div></div>';
    html += muscleCard(s, today);
    return html;
  }

  /* ---------------- Séries por grupo muscular (semana) ---------------- */

  function muscleCard(s, today) {
    var m = T.weeklyMuscleSets(s, today);
    if (!m.groups.length) return '';
    var max = Math.max.apply(null, m.groups.map(function (g) { return Math.max(g.sets, g.last); }).concat([10]));
    var rows = m.groups.map(function (g) {
      return '<div class="mus-row"><span class="mus-name">' + esc(g.label) + '</span>' +
        '<span class="mus-bar" aria-hidden="true"><i class="mus-last" style="width:' + Math.round(g.last / max * 100) + '%"></i><i class="mus-now" style="width:' + Math.round(g.sets / max * 100) + '%"></i></span>' +
        '<span class="mus-num"><strong>' + g.sets + '</strong><small>' + (g.last ? 'vs. ' + g.last : '') + '</small></span></div>';
    }).join('');
    return '<section class="card muscle-card"><div class="card-head"><h2>' + ui.icon('chart', 18) + 'Séries por grupo muscular</h2><span class="count">' + m.total + ' séries</span></div>' +
      '<p class="muted small mus-legend"><i class="lg-now"></i>esta semana <i class="lg-last"></i>semana passada</p>' + rows +
      '<p class="hint">Referência comum para ganhar músculo: cerca de 10 a 20 séries por semana em cada grupo que você quer desenvolver. Sem pressa: o importante é a constância.</p></section>';
  }

  /* ---------------- Ciclo menstrual + energia do dia ---------------- */

  function cycleCard(s, today) {
    var Cy = window.JSCiclo;
    if (!Cy || !Cy.enabled(s) || !Cy.settings(s).showInTreino) return '';
    var cur = Cy.current(s, today);
    if (!cur) return '';
    var ph = cur.phase, log = Cy.dayLog(s, today) || {};
    var energy = Cy.ENERGY.map(function (e) {
      return '<button type="button" class="emo' + (log.energy === e[0] ? ' on' : '') + '" data-action="cycle-energy" data-v="' + e[0] + '" aria-pressed="' + (log.energy === e[0]) + '" title="' + esc(e[2]) + '"><span aria-hidden="true">' + e[1] + '</span><small>' + esc(e[2]) + '</small></button>';
    }).join('');
    return '<section class="card cycle-today ph-' + ph.key + '"><button type="button" class="cycle-line" data-action="go" data-route="ciclo"><span class="ph-dot" aria-hidden="true"></span>' +
      '<span class="cl-txt"><strong>Fase ' + esc(ph.name.toLowerCase()) + ' • dia ' + cur.info.day + '</strong><small>' + esc(ph.treino) + '</small></span>' + ui.icon('right', 16) + '</button>' +
      '<p class="emo-q">Como está sua energia hoje?</p><div class="emo-row">' + energy + '</div></section>';
  }

  /* ---------------- Semana ---------------- */

  function renderSemana(s) {
    var rows = WEEK_ORDER.map(function (w) {
      var plan = R.byId(s.workoutPlans, s.workout.week[w] || '');
      return '<button type="button" class="week-row" data-action="week-set" data-wd="' + w + '"><span class="wd-name">' + WEEKDAY_FULL[w] + '</span>' +
        (plan ? '<span class="week-plan">' + badge(s, plan) + esc(plan.name) + '</span>' : '<span class="week-plan muted">Descanso</span>') + ui.icon('right', 16) + '</button>';
    }).join('');
    var w = s.workout;
    return ui.section('Ficha de cada dia', '<div class="card flush">' + rows + '</div>' +
      '<p class="hint">Esta é a semana fixa. Para mudar só um dia (ex.: hoje treinar braço em vez de perna), use Trocar em Hoje ou toque no dia em Mês.</p>') +
      ui.section('Preferências', '<div class="card flush">' +
        '<button type="button" class="week-row" data-action="workout-reminder"><span class="wd-name">' + ui.icon('bell', 16) + ' Lembrete do treino</span><span class="week-plan">' + (w.reminderTime ? 'às ' + esc(w.reminderTime) : 'Sem lembrete') + '</span>' + ui.icon('right', 16) + '</button>' +
        '<button type="button" class="week-row" data-action="workout-step"><span class="wd-name">' + ui.icon('plus', 16) + ' Passo da carga (+/−)</span><span class="week-plan">' + JS.graf.fmtNum(w.loadStep || 1, 1) + ' kg</span>' + ui.icon('right', 16) + '</button>' +
        '<button type="button" class="week-row" data-action="go" data-route="config"><span class="wd-name">' + ui.icon('phone', 16) + ' Toque atrás do celular</span><span class="week-plan">' + (s.settings.backTap.enabled ? 'Ligado' : 'Desligado') + '</span>' + ui.icon('right', 16) + '</button>' +
        '</div>');
  }

  /* ---------------- Mês ---------------- */

  function renderMes(s, now) {
    var today = C.toDateKey(now);
    if (!view.month) view.month = C.monthOf(today);
    var cal = T.monthCalendar(s, view.month), r = C.monthRange(view.month);
    var cells = '', lead = C.weekday(r.from);
    for (var i = 0; i < lead; i++) cells += '<span class="cal-cell blank"></span>';
    var doneCount = 0;
    for (var d = r.from; d <= r.to; d = C.addDays(d, 1)) {
      var c = cal[d], did = c.done.length > 0;
      if (did) doneCount++;
      var mark = did ? '<i class="wk-done" aria-hidden="true">' + ui.icon('check', 12) + '</i>'
        : c.plan ? '<i class="wk-plan" style="--pc:' + esc(c.plan.color) + '">' + esc(T.planLetter(s, c.plan)) + '</i>'
          : c.rest ? '<i class="wk-rest">–</i>' : '<i class="wk-none"></i>';
      var label = C.formatDateBR(d) + ': ' + (did ? 'treino feito' : c.plan ? c.plan.name : c.rest ? 'descanso' : 'sem treino');
      cells += '<button type="button" class="cal-cell wk' + (d === today ? ' today' : '') + (c.changed ? ' changed' : '') + (did ? ' did' : '') +
        '" data-action="workout-day" data-date="' + d + '" aria-label="' + esc(label) + '"><span class="n">' + Number(d.slice(8)) + '</span>' + mark + '</button>';
    }
    var legend = s.workoutPlans.map(function (p) { return '<span>' + badge(s, p) + esc(p.name) + '</span>'; }).join('') +
      '<span><i class="wk-done inline">' + ui.icon('check', 11) + '</i>Feito</span><span><i class="wk-rest inline">–</i>Descanso</span>';
    return ui.monthNav(view.month, 'treino-month') +
      '<div class="cal"><div class="cal-head">' + C.WEEKDAY_LETTERS.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>' +
      '<div class="cal-grid">' + cells + '</div></div>' +
      '<div class="cal-legend">' + legend + '</div>' +
      '<p class="hint">' + doneCount + (doneCount === 1 ? ' treino feito' : ' treinos feitos') + ' neste mês. Toque num dia para trocar a ficha só naquele dia.</p>';
  }

  /* ---------------- Fichas ---------------- */

  function renderFichas(s) {
    if (!s.workoutPlans.length) return readyCard() + ui.empty('dumbbell', 'Nenhuma ficha ainda. Use um treino pronto acima ou crie a sua, como "Treino A — Pernas" e "Treino B — Braços".', { label: 'Nova ficha', attrs: 'data-action="plan-new"' });
    return readyCard() + s.workoutPlans.map(function (p) {
      var groups = {};
      p.items.forEach(function (it) { var e = T.exerciseById(s, it.exerciseId); if (e) groups[T.GRUPOS[e.group]] = 1; });
      return '<div class="item plan-item"><button type="button" class="item-main" data-action="plan-menu" data-id="' + esc(p.id) + '">' +
        '<span class="item-title">' + badge(s, p) + esc(p.name) + '</span>' +
        '<span class="item-meta">' + p.items.length + ' exercícios • ' + esc(daysOf(s, p)) + '</span>' +
        '<span class="item-meta">' + esc(Object.keys(groups).join(', ')) + '</span></button></div>';
    }).join('') + '<button type="button" class="btn soft full" data-action="plan-new">' + ui.icon('plus', 18) + 'Nova ficha</button>';
  }

  /* ---------------- Evolução ---------------- */

  function trendTag(tr) {
    if (!tr || tr.direction === 'new') return ui.tag('1º treino', 'muted');
    if (tr.direction === 'up') return '<span class="tag success">' + ui.icon('up', 12) + '+' + JS.graf.fmtNum(tr.delta, 1) + ' kg</span>';
    if (tr.direction === 'down') return '<span class="tag danger">' + ui.icon('down', 12) + JS.graf.fmtNum(tr.delta, 1) + ' kg</span>';
    return ui.tag('= mesma carga', 'muted');
  }
  JS.trendTag = trendTag;

  function renderEvolucao(s) {
    var list = T.trainedExercises(s);
    if (!list.length) return ui.empty('chart', 'Conclua um treino para ver aqui se a carga de cada aparelho está aumentando ou diminuindo.');
    if (!view.evoEx || !list.some(function (x) { return x.id === view.evoEx; })) view.evoEx = list[0].id;
    var cur = list.filter(function (x) { return x.id === view.evoEx; })[0], tr = cur.trend;
    var hist = T.exerciseHistory(s, cur.id);
    var html = ui.select({ label: 'Exercício', name: 'evo', options: list.map(function (x) { return [x.id, x.name]; }), value: cur.id, attrs: 'data-change="evo-ex"' }) +
      '<div class="summary"><div class="stat"><span class="stat-label">Última carga</span><strong>' + kg(tr.last.maxLoad) + '</strong><span class="stat-sub">' + esc(C.formatDateBR(tr.last.date)) + ' • ' + tr.last.reps + ' rep.</span></div>' +
      '<div class="stat"><span class="stat-label">Melhor carga</span><strong>' + kg(tr.best) + '</strong><span class="stat-sub">' + tr.count + (tr.count === 1 ? ' treino' : ' treinos') + '</span></div>' +
      '<div class="stat"><span class="stat-label">Vs. treino anterior</span><strong>' + trendTag(tr) + '</strong></div>' +
      '<div class="stat"><span class="stat-label">Desde o 1º treino</span><strong class="' + (tr.sinceFirst > 0 ? 'up' : tr.sinceFirst < 0 ? 'down' : '') + '">' + (tr.sinceFirst > 0 ? '+' : '') + kg(tr.sinceFirst) + '</strong></div></div>' +
      '<section class="card"><div class="card-head"><h2>Carga máxima por treino</h2></div>' +
      JS.graf.chart({ type: 'line', title: 'Carga máxima por treino em ' + cur.name, unit: 'kg', dec: 1, yLabel: 'Carga máxima', xLabel: 'Data',
        points: hist.map(function (h) { return { label: C.formatDayMonth(h.date), v: h.maxLoad, tip: C.formatDateBR(h.date) + ' • ' + h.sets + ' séries' }; }) }) + '</section>' +
      '<section class="card"><div class="card-head"><h2>Volume por treino</h2></div>' +
      JS.graf.chart({ type: 'bars', title: 'Volume por treino em ' + cur.name, unit: 'kg', dec: 0, yLabel: 'Volume', xLabel: 'Data', height: 150,
        points: hist.map(function (h) { return { label: C.formatDayMonth(h.date), v: h.volume, tip: C.formatDateBR(h.date) }; }) }) + '</section>';
    var hs = T.exerciseSets(s, cur.id, 20), ls = T.lastSet(s, cur.id);
    if (ls) html += '<p class="muted small evo-last">Última série: <strong>' + kg(ls.load) + ' × ' + ls.reps + '</strong> (' + esc(C.formatDateBR(ls.date)) + ')</p>';
    html += ui.section('Histórico de séries', hs.map(function (h) {
      return '<div class="item"><div class="item-main static"><span class="item-row"><span class="item-title">' + esc(C.formatDateBR(h.date)) + (h.active ? ' ' + ui.tag('em andamento', 'soft') : '') + '</span><span class="muted small">' + esc(h.planName) + '</span></span>' +
        '<span class="item-meta hist-sets">' + h.sets.map(function (st2, k) { return '<span class="hs">S' + (k + 1) + ' ' + JS.graf.fmtNum(st2.load, 1) + '×' + st2.reps + (st2.via === 'atalho' ? ' ⌁' : st2.via === 'toque-atras' ? ' ·' : '') + '</span>'; }).join('') + '</span></div></div>';
    }).join('') + '<p class="hint">⌁ = registrada pelo atalho do iPhone • · = pelo toque atrás</p>', '<span class="count">' + hs.length + '</span>');
    html += ui.section('Todos os aparelhos', list.map(function (x) {
      return '<div class="item"><button type="button" class="item-main" data-action="evo-pick" data-id="' + esc(x.id) + '"><span class="item-row"><span class="item-title">' + esc(x.name) + '</span>' + trendTag(x.trend) + '</span>' +
        '<span class="item-meta">' + esc(T.GRUPOS[x.group] || '') + ' • última ' + kg(x.trend.last.maxLoad) + '</span></button></div>';
    }).join(''));
    return html;
  }

  function render(now) {
    var s = JS.store.state;
    var html = '<h1 class="page-title">Treino</h1>' + ui.segmented(MODES, view.mode, 'treino-mode').replace('class="segmented"', 'class="segmented seg5"');
    if (view.mode === 'hoje') html += renderHoje(s, now);
    else if (view.mode === 'semana') html += renderSemana(s);
    else if (view.mode === 'mes') html += renderMes(s, now);
    else if (view.mode === 'fichas') html += renderFichas(s);
    else html += renderEvolucao(s);
    return html;
  }

  /* ---------------- Ações: dia, semana ---------------- */

  function choosePlan(title, message, extra) {
    var s = JS.store.state;
    var opts = s.workoutPlans.map(function (p) { return { label: T.planLetter(s, p) + ' • ' + p.name, value: p.id }; });
    return ui.choose({ title: title, message: message, options: opts.concat(extra || []) });
  }

  function dayMenu(date) {
    var s = JS.store.state, today = C.toDateKey(new Date());
    var p = T.planForDate(s, date);
    var done = s.workoutSessions.filter(function (x) { return x.date === date && x.status === 'done'; });
    var detail = (p.plan ? '<p>' + badge(s, p.plan) + ' ' + esc(p.plan.name) + (p.changed ? ' <span class="tag soft">trocado só neste dia</span>' : '') + '</p>' : '<p class="muted">' + (p.rest ? 'Descanso' : 'Sem ficha') + '</p>') +
      done.map(function (x) { var sm = T.sessionSummary(s, x); return '<p class="ok-line">' + ui.icon('check', 14) + ' Feito: ' + esc(x.planName) + ' • ' + duration(sm.minutes) + ' • ' + sm.sets + ' séries</p>'; }).join('');
    ui.actionSheet({
      title: C.formatDateLong(date), subtitle: C.formatDayLabel(date, today) === 'Hoje' ? 'Hoje' : null, detail: detail,
      actions: [
        date === today && p.plan && !T.activeSession(s) ? { label: 'Iniciar ' + p.plan.name, icon: 'play', run: function () { startWorkout(p.plan.id); } } : null,
        s.workoutPlans.length ? { label: 'Trocar a ficha só neste dia', icon: 'repeat', run: function () {
          choosePlan('Treino de ' + C.formatDayMonth(date), 'Só este dia muda. A semana fixa continua igual.', [{ label: 'Descanso neste dia', value: 'rest' }]).then(function (v) {
            if (!v) return;
            JS.store.update(function (st) { T.setDayPlan(st, date, v); });
            ui.toast(v === 'rest' ? 'Descanso marcado.' : 'Ficha trocada para ' + C.formatDayMonth(date) + '.');
          });
        } } : null,
        p.changed ? { label: 'Voltar à ficha da semana', icon: 'undo', run: function () { JS.store.update(function (st) { T.setDayPlan(st, date, null); }); ui.toast('Voltou ao padrão da semana.'); } } : null,
        done.length ? { label: 'Ver treino feito', icon: 'list', run: function () { sessionView(done[done.length - 1].id); } } : null,
        !s.workoutPlans.length ? { label: 'Criar uma ficha', icon: 'plus', run: function () { openPlanEditor(null); } } : null
      ]
    });
  }

  function startWorkout(planId) {
    var s = JS.store.state;
    if (T.activeSession(s)) { JS.app.go('sessao'); return; }
    // No iPhone a permissão do sensor precisa ser pedida dentro do toque.
    var bt = s.settings.backTap;
    var perm = bt.enabled && window.JSToque && JSToque.needsPermission() ? JSToque.requestPermission() : Promise.resolve('granted');
    window.JSToque && JSToque.unlockAudio();
    perm.then(function (r) {
      JS.sessaoPerm = r;
      JS.anim.countdown(function () {
        JS.store.silentUpdate(function (st, n) { T.startSession(st, C.toDateKey(new Date()), planId, n); });
        JS.app.go('sessao');
      });
    });
  }
  JS.startWorkout = startWorkout;

  function sessionView(id) {
    var s = JS.store.state, x = R.byId(s.workoutSessions, id);
    if (!x) return;
    var sm = T.sessionSummary(s, x);
    var body = summaryHtml(sm) + x.items.map(function (it) {
      return '<div class="sv-ex"><strong>' + esc(it.name) + '</strong>' + (it.sets.length ? '<ol>' + it.sets.map(function (st) {
        return '<li>' + kg(st.load) + ' × ' + st.reps + (st.via === 'toque-atras' ? ' <span class="via" title="Registrada pelo toque atrás">' + ui.icon('phone', 12) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' : '<p class="muted small">Não feito</p>') + '</div>';
    }).join('');
    ui.openSheet({ title: x.planName, subtitle: C.formatDateLong(x.date), body: body + '<button type="button" class="btn danger full" data-del-session>Excluir este registro</button>',
      onOpen: function (form) {
        form.querySelector('[data-del-session]').addEventListener('click', function () {
          ui.closeSheet();
          ui.confirm({ title: 'Excluir treino?', message: 'O registro de ' + C.formatDateBR(x.date) + ' será apagado da evolução.', confirmLabel: 'Excluir', danger: true })
            .then(function (ok) { if (ok) { JS.store.update(function (st) { T.deleteSession(st, id); }); ui.toast('Treino excluído.'); } });
        });
      } });
  }
  JS.sessionView = sessionView;

  /* ---------------- Editor de ficha ---------------- */

  // O rascunho fica em memória enquanto a usuária alterna entre o editor e a lista de exercícios.
  function openPlanEditor(plan, draft) {
    var s = JS.store.state;
    draft = draft || (plan ? JSON.parse(JSON.stringify(plan)) : { name: '', color: T.PLAN_COLORS[s.workoutPlans.length % T.PLAN_COLORS.length], items: [] });
    draft._id = plan ? plan.id : draft._id;
    var colors = '<div class="field" data-field="color"><span class="label">Cor</span><div class="swatches">' + T.PLAN_COLORS.map(function (c) {
      return '<label class="swatch"><input type="radio" name="color" value="' + c + '"' + (draft.color === c ? ' checked' : '') + '><span style="--pc:' + c + '"></span></label>';
    }).join('') + '</div></div>';
    var items = draft.items.map(function (it, i) {
      var ex = T.exerciseById(s, it.exerciseId);
      return '<div class="pe-item" data-i="' + i + '"><div class="pe-top"><strong>' + (i + 1) + '. ' + esc(ex ? ex.name : 'Exercício') + '</strong>' +
        '<span class="pe-tools"><button type="button" class="icon-btn sm" data-move="-1" aria-label="Subir">' + ui.icon('upchev', 16) + '</button>' +
        '<button type="button" class="icon-btn sm" data-move="1" aria-label="Descer">' + ui.icon('downchev', 16) + '</button>' +
        '<button type="button" class="icon-btn sm danger" data-remove aria-label="Remover">' + ui.icon('x', 16) + '</button></span></div>' +
        '<div class="pe-grid three">' +
        '<label>Séries<input type="number" inputmode="numeric" min="1" max="10" name="sets_' + i + '" value="' + esc(it.sets) + '" data-sets></label>' +
        '<label>Repetições<input type="text" inputmode="numeric" maxlength="12" name="reps_' + i + '" value="' + esc(it.reps) + '" placeholder="10 ou 8-12"></label>' +
        '<label>Descanso<select name="rest_' + i + '">' + REST_OPTIONS.map(function (o) { return '<option value="' + o[0] + '"' + (Number(it.restSec) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '</div>' + loadInputs(it, i) + '</div>';
    }).join('');
    var body = ui.input({ label: 'Nome da ficha', name: 'name', value: draft.name, placeholder: 'Ex.: Treino A — Pernas', attrs: 'maxlength="40"' }) + colors +
      '<div class="field" data-field="items"><span class="label">Exercícios</span>' + (items || '<p class="muted small">Nenhum exercício ainda.</p>') +
      '<button type="button" class="btn soft full" data-add-ex>' + ui.icon('plus', 18) + 'Adicionar exercício</button><p class="err" role="alert"></p></div>';
    ui.openSheet({
      title: plan || draft._id ? 'Editar ficha' : 'Nova ficha', body: body, submitLabel: 'Salvar ficha',
      onOpen: function (form) {
        form.querySelector('[data-add-ex]').addEventListener('click', function () { sync(form, draft); openExercisePicker(draft, plan); });
        form.querySelectorAll('.pe-item').forEach(function (row) {
          var i = Number(row.dataset.i);
          row.querySelectorAll('[data-move]').forEach(function (b) {
            b.addEventListener('click', function () {
              sync(form, draft);
              var j = i + Number(b.dataset.move);
              if (j < 0 || j >= draft.items.length) return;
              var t = draft.items[i]; draft.items[i] = draft.items[j]; draft.items[j] = t;
              openPlanEditor(plan, draft);
            });
          });
          row.querySelector('[data-remove]').addEventListener('click', function () { sync(form, draft); draft.items.splice(i, 1); openPlanEditor(plan, draft); });
          row.querySelector('[data-sets]').addEventListener('change', function () {
            var keep = row.querySelector('[data-sets]').value;
            sync(form, draft); draft.items[i].sets = keep;
            openPlanEditor(plan, draft);
          });
          var same = row.querySelector('[data-same-load]');
          if (same) same.addEventListener('click', function () {
            var first = row.querySelector('input[name="load_' + i + '_0"]').value;
            row.querySelectorAll('.pe-load input').forEach(function (inp) { inp.value = first; });
          });
        });
      },
      onSubmit: function (v, form) {
        sync(form, draft);
        var r = T.validatePlan(draft);
        if (!r.ok) return { errors: r.errors };
        var saved = null;
        JS.store.update(function (st, n) { saved = draft._id ? T.updatePlan(st, draft._id, r.value, n) : T.createPlan(st, r.value, n); });
        if (view.mode === 'hoje' || view.mode === 'semana') view.mode = 'fichas';
        ui.toast(draft._id ? 'Ficha salva.' : 'Ficha criada! Agora escolha os dias em Semana.');
        JS.anim.mark('[data-action="plan-menu"][data-id="' + (saved && saved.id) + '"]', 'is-new', { closest: '.item', delay: 160 });
      }
    });
  }

  // Um campo de carga para cada série (S1, S2, S3...). Série em branco repete a anterior.
  function draftLoads(it) {
    var n = Math.min(Math.max(Math.round(Number(it.sets) || 1), 1), 10);
    var src = Array.isArray(it.loads) ? it.loads : [], out = [], prev = it.load != null && it.load !== '' ? it.load : '';
    for (var k = 0; k < n; k++) { if (src[k] != null && src[k] !== '') prev = src[k]; out.push(prev); }
    return out;
  }
  function loadInputs(it, i) {
    var loads = draftLoads(it);
    return '<div class="pe-loads"><span class="pe-loads-label">Carga por série (kg)</span><div class="pe-load-row">' + loads.map(function (v, k) {
      return '<label class="pe-load"><small>S' + (k + 1) + '</small><input type="text" inputmode="decimal" autocomplete="off" name="load_' + i + '_' + k + '" value="' + esc(String(v === '' || v == null ? '' : v).replace('.', ',')) + '" placeholder="' + (k ? '=' : '0') + '" title="' + (k ? 'Vazio = mesma carga da série anterior' : '') + '" aria-label="Carga da série ' + (k + 1) + ' em kg"></label>';
    }).join('') + '</div>' + (loads.length > 1 ? '<button type="button" class="link small-link" data-same-load="' + i + '">Repetir a carga da S1 em todas</button>' : '') + '</div>';
  }

  function sync(form, draft) {
    var el = form.elements;
    draft.name = el.name.value;
    var c = form.querySelector('input[name="color"]:checked');
    if (c) draft.color = c.value;
    draft.items.forEach(function (it, i) {
      if (!el['sets_' + i]) return;
      it.sets = el['sets_' + i].value; it.reps = el['reps_' + i].value; it.restSec = el['rest_' + i].value;
      var loads = [];
      for (var k = 0; el['load_' + i + '_' + k]; k++) loads.push(String(el['load_' + i + '_' + k].value).replace(',', '.'));
      it.loads = loads;
      it.load = loads[0];
    });
  }

  // Lista de exercícios para escolher (busca + grupos). onPick recebe o id escolhido.
  function openExercisePicker(draft, plan, onPick) {
    var s = JS.store.state, group = '';
    var body = '<div class="field"><input type="search" name="q" placeholder="Buscar exercício" autocomplete="off" aria-label="Buscar exercício"></div>' +
      '<div class="quick-chips scroll-chips"><button type="button" class="chip on" data-g="">Todos</button>' +
      Object.keys(T.GRUPOS).map(function (g) { return '<button type="button" class="chip" data-g="' + g + '">' + esc(T.GRUPOS[g]) + '</button>'; }).join('') + '</div>' +
      '<div class="pick-list" role="list"></div>' +
      '<button type="button" class="btn soft full" data-new-ex>' + ui.icon('plus', 18) + 'Criar exercício que não está na lista</button>';
    var back = function () { if (draft) openPlanEditor(plan, draft); };
    ui.openSheet({
      title: 'Escolher exercício', body: body,
      onOpen: function (form) {
        var listEl = form.querySelector('.pick-list'), q = form.elements.q;
        function draw() {
          var term = window.JSNutri ? JSNutri.fold(q.value) : q.value.toLowerCase();
          var items = T.exercises(s).filter(function (e) {
            return (!group || e.group === group) && (!term || (window.JSNutri ? JSNutri.fold(e.name) : e.name.toLowerCase()).indexOf(term) >= 0);
          });
          listEl.innerHTML = items.length ? items.map(function (e) {
            var drawing = exThumb(e);
            var thumb = drawing
              ? '<button type="button" class="pick-thumb" data-prev="' + esc(e.id) + '" aria-label="Ver a execução de ' + esc(e.name) + '">' + drawing + '<span class="pt-play">' + ui.icon('play', 12) + '</span></button>'
              : e.videoUrl
                ? '<a class="pick-thumb none" href="' + esc(e.videoUrl) + '" target="_blank" rel="noopener" aria-label="Abrir o vídeo salvo de ' + esc(e.name) + '"><span class="pt-play">' + ui.icon('play', 16) + '</span></a>'
                : '<span class="pick-thumb none" aria-hidden="true">' + ui.icon('dumbbell', 22) + '</span>';
            return '<div class="pick-row" data-row="' + esc(e.id) + '">' + thumb +
              '<button type="button" class="pick" data-id="' + esc(e.id) + '"><strong>' + esc(e.name) + '</strong><span>' + esc(T.GRUPOS[e.group] || '') + (e.equipment ? ' • ' + esc(e.equipment) : '') + '</span></button></div>';
          }).join('') : '<p class="muted small">Nada encontrado. Crie o exercício abaixo.</p>';
        }
        // Tocar na miniatura abre o desenho animado ali mesmo, com a dica e o botão de escolher.
        function preview(id) {
          var open = listEl.querySelector('.pick-video');
          var same = open && open.dataset.for === id;
          if (open) open.remove();
          listEl.querySelectorAll('.pick-row.open').forEach(function (r) { r.classList.remove('open'); });
          if (same) return;
          var ex = T.exerciseById(s, id), row = listEl.querySelector('[data-row="' + id + '"]');
          if (!ex || !exAnim(ex) || !row) return;
          var box = document.createElement('div');
          box.className = 'pick-video';
          box.dataset.for = id;
          box.innerHTML = exPlayer(ex) + (ex.tips ? '<p class="small">' + esc(ex.tips) + '</p>' : '') +
            '<button type="button" class="btn primary full" data-choose="' + esc(id) + '">' + ui.icon('check', 18) + 'Escolher ' + esc(ex.name) + '</button>';
          row.classList.add('open');
          row.after(box);
          startDrawings(box);
          box.scrollIntoView({ block: 'nearest', behavior: JS.anim.reduced() ? 'auto' : 'smooth' });
        }
        draw();
        q.addEventListener('input', draw);
        form.querySelectorAll('[data-g]').forEach(function (b) {
          b.addEventListener('click', function () {
            group = b.dataset.g;
            form.querySelectorAll('[data-g]').forEach(function (x) { x.classList.toggle('on', x === b); });
            draw();
          });
        });
        listEl.addEventListener('click', function (e) {
          var pv = e.target.closest('[data-prev]');
          if (pv) { e.preventDefault(); preview(pv.dataset.prev); return; }
          var b = e.target.closest('.pick, [data-choose]');
          if (!b) return;
          var id = b.dataset.id || b.dataset.choose;
          if (onPick) { onPick(id); return; }
          var last = T.lastLoad(s, id);
          draft.items.push({ exerciseId: id, sets: 3, reps: '10-12', load: last || '', loads: [], restSec: 60 });
          back();
        });
        form.querySelector('[data-new-ex]').addEventListener('click', function () {
          openExerciseForm(null, function (ex) {
            if (onPick) onPick(ex.id);
            else { draft.items.push({ exerciseId: ex.id, sets: 3, reps: '10-12', load: '', restSec: 60 }); back(); }
          });
        });
      },
      onSubmit: draft ? function () { back(); return false; } : null,
      submitLabel: 'Voltar à ficha', cancelLabel: 'Fechar'
    });
  }
  JS.openExercisePicker = openExercisePicker;

  function openExerciseForm(ex, done) {
    var v = ex || { name: '', group: 'outro', equipment: '', tips: '', videoUrl: '' };
    var body = ui.input({ label: 'Nome', name: 'name', value: v.name, attrs: 'maxlength="60"', placeholder: 'Ex.: Remada cavalinho' }) +
      ui.select({ label: 'Grupo muscular', name: 'group', options: ui.entries(T.GRUPOS), value: v.group }) +
      ui.input({ label: 'Aparelho (opcional)', name: 'equipment', value: v.equipment, attrs: 'maxlength="60"' }) +
      ui.textarea({ label: 'Como executar (opcional)', name: 'tips', value: v.tips, attrs: 'maxlength="500"' }) +
      ui.input({ label: 'Link de vídeo (opcional)', name: 'videoUrl', type: 'url', value: v.videoUrl, placeholder: 'https://...' });
    ui.openSheet({
      title: ex ? 'Editar exercício' : 'Novo exercício', body: body, submitLabel: 'Salvar',
      onSubmit: function (input) {
        var r = T.validateExercise(input);
        if (!r.ok) return { errors: r.errors };
        var saved = null;
        JS.store.silentUpdate(function (st, n) { saved = ex ? T.updateExercise(st, ex.id, r.value, n) : T.createExercise(st, r.value, n); });
        return { ex: saved };
      },
      afterClose: function (res) { if (res && res.ex && done) done(res.ex); }
    });
  }

  function planMenu(id) {
    var s = JS.store.state, p = R.byId(s.workoutPlans, id);
    if (!p) return;
    ui.actionSheet({
      title: p.name, subtitle: p.items.length + ' exercícios • ' + daysOf(s, p),
      detail: '<div class="ex-list">' + p.items.map(function (it) { return exerciseLine(s, it); }).join('') + '</div>',
      actions: [
        T.activeSession(s) ? null : { label: 'Iniciar agora', icon: 'play', run: function () { startWorkout(p.id); } },
        { label: 'Editar', icon: 'edit', run: function () { openPlanEditor(p); } },
        { label: 'Duplicar', icon: 'repeat', run: function () { JS.store.update(function (st, n) { T.duplicatePlan(st, p.id, n); }); ui.toast('Ficha duplicada.'); } },
        { label: 'Excluir', icon: 'trash', danger: true, run: function () {
          ui.confirm({ title: 'Excluir ficha?', message: '"' + p.name + '" sai da semana e do calendário. Os treinos já feitos continuam na evolução.', confirmLabel: 'Excluir', danger: true })
            .then(function (ok) { if (ok) JS.anim.removeThen('[data-action="plan-menu"][data-id="' + id + '"]', '.item', function () { JS.store.update(function (st) { T.deletePlan(st, id); }); ui.toast('Ficha excluída.'); }); });
        } }
      ]
    });
  }

  /* ---------------- Treinos prontos (js/dados/treinos.js) ---------------- */

  var TP = window.JSTreinos || { FICHAS: {}, PROGRAMAS: [], LOCAIS: {} };
  var lib = { filter: '' };

  function readyCard() {
    var n = Object.keys(TP.FICHAS).length;
    if (!n) return '';
    return '<button type="button" class="ready-card" data-action="ready-open">' + ui.icon('sparkle', 22) +
      '<span><strong>Treinos prontos</strong><small>' + n + ' fichas e ' + TP.PROGRAMAS.length + ' semanas completas para adicionar com um toque</small></span>' + ui.icon('right', 18) + '</button>';
  }
  function restText(sec) { var o = REST_OPTIONS.filter(function (x) { return x[0] === sec; })[0]; return o ? o[1] : sec + ' s'; }
  function tplThumbs(tpl, n) {
    var s = JS.store.state;
    return '<span class="tpl-thumbs" aria-hidden="true">' + tpl.items.slice(0, n).map(function (r) {
      var ex = T.exerciseById(s, 'ex:' + r[0]);
      return ex && exAnim(ex) ? '<span class="tpl-th">' + exThumb(ex) + '</span>' : '';
    }).join('') + '</span>';
  }
  function fichaRow(key) {
    var t = TP.FICHAS[key], mine = T.planByName(JS.store.state, t.name);
    return '<button type="button" class="tpl-row" data-tpl="' + esc(key) + '">' + tplThumbs(t, 3) +
      '<span class="tpl-txt"><strong>' + esc(t.name) + '</strong><small>' + esc(t.nivel) + ' • ' + t.items.length + ' exercícios • ~' + t.min + ' min</small>' +
      (mine ? ui.tag('Nas suas fichas', 'success') : '') + '</span>' + ui.icon('right', 16) + '</button>';
  }
  function progRow(p) {
    return '<button type="button" class="tpl-row prog" data-prog="' + esc(p.id) + '"><span class="tpl-days" aria-hidden="true">' + WEEK_ORDER.map(function (w) {
      return '<i' + (p.dias.some(function (d) { return d[0] === w; }) ? ' class="on"' : '') + '>' + WEEKDAY_FULL[w].charAt(0) + '</i>';
    }).join('') + '</span><span class="tpl-txt"><strong>' + esc(p.name) + '</strong><small>' + esc(p.nivel) + ' • ' +
      esc(p.dias.map(function (d) { return C.WEEKDAY_SHORT[d[0]]; }).join(', ')) + '</small></span>' + ui.icon('right', 16) + '</button>';
  }
  // O botão da esquerda da folha vira "Voltar" (em vez de fechar).
  function backButton(form, fn) {
    var b = form.querySelector('.sheet-foot .btn.ghost');
    if (!b) return;
    var nb = b.cloneNode(true);
    nb.removeAttribute('data-close');
    b.replaceWith(nb);
    nb.addEventListener('click', fn);
  }
  // Tocar no desenho abre a animação da execução ali mesmo.
  function bindPreviews(form) {
    form.addEventListener('click', function (e) {
      var pv = e.target.closest('[data-prev]');
      if (!pv) return;
      e.preventDefault();
      var row = pv.closest('.pick-row'), open = form.querySelector('.pick-video'), same = open && open.dataset.for === row.dataset.row;
      if (open) open.remove();
      form.querySelectorAll('.pick-row.open').forEach(function (r) { r.classList.remove('open'); });
      if (same) return;
      var ex = T.exerciseById(JS.store.state, pv.dataset.prev);
      if (!ex) return;
      var box = document.createElement('div');
      box.className = 'pick-video';
      box.dataset.for = row.dataset.row;
      box.innerHTML = exPlayer(ex) + (ex.tips ? '<p class="small">' + esc(ex.tips) + '</p>' : '');
      row.classList.add('open');
      row.after(box);
      startDrawings(box);
      box.scrollIntoView({ block: 'nearest', behavior: JS.anim.reduced() ? 'auto' : 'smooth' });
    });
  }

  function openLibrary() {
    var chips = [['', 'Tudo'], ['semanas', 'Semanas completas']].concat(Object.keys(TP.LOCAIS).map(function (k) { return [k, TP.LOCAIS[k]]; }));
    var body = '<p class="hint top">Uma semana completa já vem com as fichas e os dias montados. Também dá para pegar só uma ficha. Depois de adicionar, você muda o que quiser.</p>' +
      '<div class="quick-chips scroll-chips">' + chips.map(function (c) {
        return '<button type="button" class="chip' + (lib.filter === c[0] ? ' on' : '') + '" data-f="' + c[0] + '">' + esc(c[1]) + '</button>';
      }).join('') + '</div><div class="tpl-list"></div>';
    ui.openSheet({
      title: 'Treinos prontos', body: body,
      onOpen: function (form) {
        var listEl = form.querySelector('.tpl-list');
        function draw() {
          var html = '';
          if (!lib.filter || lib.filter === 'semanas') html += '<h3 class="tpl-h">Semanas completas</h3>' + TP.PROGRAMAS.map(progRow).join('');
          if (lib.filter !== 'semanas') Object.keys(TP.LOCAIS).forEach(function (loc) {
            if (lib.filter && lib.filter !== loc) return;
            var ks = Object.keys(TP.FICHAS).filter(function (k) { return TP.FICHAS[k].local === loc; });
            if (ks.length) html += '<h3 class="tpl-h">' + esc(loc === 'academia' ? 'Fichas para a academia' : TP.LOCAIS[loc]) + '</h3>' + ks.map(fichaRow).join('');
          });
          listEl.innerHTML = html;
        }
        draw();
        form.querySelectorAll('[data-f]').forEach(function (b) {
          b.addEventListener('click', function () {
            lib.filter = b.dataset.f;
            form.querySelectorAll('[data-f]').forEach(function (x) { x.classList.toggle('on', x === b); });
            draw();
          });
        });
        listEl.addEventListener('click', function (e) {
          var b = e.target.closest('[data-tpl], [data-prog]');
          if (!b) return;
          if (b.dataset.tpl) openTemplate(b.dataset.tpl); else openProgram(b.dataset.prog);
        });
      }
    });
  }

  function openTemplate(key, fromProg) {
    var s = JS.store.state, t = TP.FICHAS[key];
    if (!t) return;
    var mine = T.planByName(s, t.name);
    var rows = t.items.map(function (r, i) {
      var ex = T.exerciseById(s, 'ex:' + r[0]);
      var thumb = ex && exAnim(ex)
        ? '<button type="button" class="pick-thumb" data-prev="' + esc(ex.id) + '" aria-label="Ver a execução de ' + esc(ex.name) + '">' + exThumb(ex) + '<span class="pt-play">' + ui.icon('play', 12) + '</span></button>'
        : '<span class="pick-thumb none" aria-hidden="true">' + ui.icon('dumbbell', 22) + '</span>';
      return '<div class="pick-row" data-row="' + i + '">' + thumb + '<div class="pick static"><strong>' + (i + 1) + '. ' + esc(ex ? ex.name : r[0]) + '</strong>' +
        '<span>' + r[1] + (r[1] === 1 ? ' série' : ' séries') + ' × ' + esc(r[2]) + (r[3] ? ' • descanso ' + esc(restText(r[3])) : '') + '</span></div></div>';
    }).join('');
    var body = '<p class="tpl-meta">' + ui.tag(TP.LOCAIS[t.local] || '', 'soft') + ui.tag(t.nivel, 'muted') + '<span class="muted small">~' + t.min + ' min</span></p>' +
      '<div class="pick-list">' + rows + '</div>' +
      '<p class="hint">Toque no desenho para ver a execução. A carga de cada exercício começa com a última que você usou (ou zerada) e dá para ajustar em Editar.</p>';
    ui.openSheet({
      title: t.name, subtitle: t.items.length + ' exercícios', body: body, cancelLabel: 'Voltar',
      submitLabel: mine ? 'Abrir minha ficha' : 'Adicionar ficha',
      onOpen: function (form) { backButton(form, fromProg ? function () { openProgram(fromProg); } : openLibrary); bindPreviews(form); },
      onSubmit: function () {
        if (mine) return { open: mine.id };
        var r = null;
        view.mode = 'fichas';
        JS.store.update(function (st, n) { r = T.addTemplate(st, t, n); });
        return { added: r && r.plan ? r.plan.id : null };
      },
      afterClose: function (res) {
        if (!res) return;
        if (res.open) { if (view.mode !== 'fichas') { view.mode = 'fichas'; JS.app.render(); } planMenu(res.open); return; }
        JS.app.render({ enter: 'view:r' });
        ui.toast('Ficha "' + t.name + '" adicionada! Escolha os dias em Semana.');
        JS.anim.mark('[data-action="plan-menu"][data-id="' + res.added + '"]', 'is-new', { closest: '.item', delay: 160 });
      }
    });
  }

  function openProgram(id) {
    var p = TP.PROGRAMAS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var keys = [];
    p.dias.forEach(function (d) { if (keys.indexOf(d[1]) < 0 && TP.FICHAS[d[1]]) keys.push(d[1]); });
    var week = WEEK_ORDER.map(function (w) {
      var d = p.dias.filter(function (x) { return x[0] === w; })[0], t = d && TP.FICHAS[d[1]];
      return '<div class="tpl-wd' + (t ? ' on' : '') + '"><span>' + esc(C.WEEKDAY_SHORT[w]) + '</span><strong>' + (t ? esc(t.name) : 'Descanso') + '</strong></div>';
    }).join('');
    var body = '<p class="tpl-desc">' + esc(p.desc) + '</p><p class="tpl-meta">' + ui.tag(p.nivel, 'muted') + '</p>' +
      '<h3 class="tpl-h">A semana</h3><div class="tpl-week">' + week + '</div>' +
      '<h3 class="tpl-h">Fichas (' + keys.length + ')</h3>' + keys.map(fichaRow).join('') +
      '<button type="button" class="btn soft full" data-only-add>' + ui.icon('plus', 18) + 'Só adicionar as fichas, sem mudar a semana</button>';
    ui.openSheet({
      title: p.name, subtitle: p.dias.length + ' dias por semana', body: body, submitLabel: 'Usar esta semana', cancelLabel: 'Voltar',
      onOpen: function (form) {
        backButton(form, openLibrary);
        form.querySelectorAll('[data-tpl]').forEach(function (b) { b.addEventListener('click', function () { openTemplate(b.dataset.tpl, id); }); });
        form.querySelector('[data-only-add]').addEventListener('click', function () { ui.closeSheet(); setTimeout(function () { applyProgram(p, false); }, 60); });
      },
      onSubmit: function () { return { use: true }; },
      afterClose: function (r) {
        if (!r || !r.use) return;
        var wk = JS.store.state.workout.week;
        var busy = [0, 1, 2, 3, 4, 5, 6].some(function (w) { return !!wk[w]; });
        (busy ? ui.confirm({ title: 'Trocar a sua semana?', message: 'A semana fixa passa a ser a do "' + p.name + '". Suas fichas atuais continuam salvas.', confirmLabel: 'Usar esta semana' }) : Promise.resolve(true))
          .then(function (ok) { if (ok) applyProgram(p, true); });
      }
    });
  }

  function applyProgram(p, setWeek) {
    var r = null;
    view.mode = setWeek ? 'semana' : 'fichas';
    JS.store.update(function (st, n) { r = T.applyProgram(st, p, TP.FICHAS, n, setWeek); });
    if (JS.app.route() !== 'treino') JS.app.go('treino');
    else JS.app.render({ enter: 'view:r' });
    var news = r.created ? r.created + (r.created === 1 ? ' ficha nova' : ' fichas novas') : 'as fichas já existiam';
    ui.toast(setWeek ? 'Semana "' + p.name + '" montada (' + news + ').' : (r.created ? news.charAt(0).toUpperCase() + news.slice(1) + ' nas suas fichas.' : 'Essas fichas já estavam nas suas fichas.'), { timeout: 4500 });
  }
  JS.openReadyWorkouts = openLibrary;

  /* ---------------- Registros ---------------- */

  JS.actions['ready-open'] = function () { openLibrary(); };
  JS.actions['treino-mode'] = function (d) {
    if (d.mode === view.mode) return;
    var order = MODES.map(function (m) { return m[0]; });
    var dir = order.indexOf(d.mode) > order.indexOf(view.mode) ? 'r' : 'l';
    view.mode = d.mode;
    JS.app.render({ enter: 'view:' + dir });
  };
  JS.actions['treino-month'] = function (d) {
    view.month = C.addMonthKey(view.month, Number(d.delta));
    JS.app.render({ enter: 'view:' + (Number(d.delta) > 0 ? 'r' : 'l') });
  };
  JS.actions['treino-semana'] = function () { view.mode = 'semana'; JS.app.render({ enter: 'view:r' }); };
  JS.actions['plan-new'] = function () { openPlanEditor(null); };
  JS.actions['quick-open'] = function () { JS.openQuickRegister({ source: 'botao' }); };
  JS.actions['plan-menu'] = function (d) { planMenu(d.id); };
  JS.actions['cycle-energy'] = function (d, el) {
    var today = C.toDateKey(new Date()), v = Number(d.v), cur = (window.JSCiclo.dayLog(JS.store.state, today) || {}).energy;
    JS.anim.mark('[data-action="cycle-energy"][data-v="' + v + '"]', 'pop', { ms: 600 });
    JS.store.update(function (st, n) { window.JSCiclo.setDay(st, today, { energy: cur === v ? null : v }, n); });
    if (cur !== v) ui.toast('Energia de hoje: ' + window.JSCiclo.ENERGY[v - 1][2].toLowerCase() + '. Veja a relação com o ciclo em Ciclo.');
    void el;
  };
  JS.actions['workout-day'] = function (d) { dayMenu(d.date); };
  JS.actions['workout-start'] = function (d) { startWorkout(d.plan); };
  JS.actions['session-view'] = function (d) { sessionView(d.id); };
  JS.actions['evo-pick'] = function (d) { view.evoEx = d.id; JS.app.render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  JS.changes['evo-ex'] = function (el) { view.evoEx = el.value; JS.app.render(); };
  JS.actions['week-set'] = function (d) {
    var w = Number(d.wd);
    if (!JS.store.state.workoutPlans.length) { openPlanEditor(null); return; }
    choosePlan(WEEKDAY_FULL[w], 'Qual ficha fica fixa neste dia da semana?', [{ label: 'Descanso', value: 'rest' }]).then(function (v) {
      if (!v) return;
      JS.anim.mark('[data-action="week-set"][data-wd="' + w + '"]', 'flash', { delay: 60 });
      JS.store.update(function (st) { T.setWeekPlan(st, w, v === 'rest' ? null : v); });
    });
  };
  JS.actions['workout-reminder'] = function () {
    var w = JS.store.state.workout;
    ui.openSheet({
      title: 'Lembrete do treino', subtitle: 'Avisa nos dias que têm ficha', body: ui.input({ label: 'Horário', name: 'time', type: 'time', value: w.reminderTime || '' }) +
        '<p class="hint">Deixe em branco para não avisar. O aviso chega mesmo com o app fechado se os avisos estiverem ligados em Configurações.</p>',
      submitLabel: 'Salvar',
      onSubmit: function (v) {
        if (v.time && !C.isTimeKey(v.time)) return { errors: { time: 'Horário inválido.' } };
        JS.store.update(function (st) { st.workout.reminderTime = v.time || null; });
        ui.toast(v.time ? 'Lembrete às ' + v.time + '.' : 'Lembrete desligado.');
        return { ask: !!v.time };
      },
      afterClose: function (r) { if (r && r.ask) JS.notify.askIfNeeded(); }
    });
  };
  JS.actions['workout-step'] = function () {
    ui.choose({ title: 'Passo da carga', message: 'Quanto o + e o − mudam a carga durante o treino.', options: [0.5, 1, 2, 2.5, 5].map(function (v) { return { label: JS.graf.fmtNum(v, 1) + ' kg', value: v }; }) })
      .then(function (v) { if (v) JS.store.update(function (st) { st.workout.loadStep = v; }); });
  };

  JS.forms.plan = function () { openPlanEditor(null); };
  JS.treinoView = view;
  JS.telas.treino = { title: 'Treino', render: render, fab: { label: 'Nova ficha', action: 'plan-new' } };
})();
