/* J.S. — Ciclo menstrual: fase de hoje, previsões, registro do dia, calendário, energia e treino por fase */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, Cy = window.JSCiclo, ui = JS.ui, esc = ui.esc;
  var view = { month: null, date: null };

  function today() { return C.toDateKey(new Date()); }
  function curDate() { return view.date || today(); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function when(n) { return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : 'em ' + n + ' dias'; }

  /* ---------------- Roda do ciclo ---------------- */

  function wheel(cur) {
    var info = cur.info, L = Math.max(info.cycleLen, info.day), R = 80, CIRC = 2 * Math.PI * R, GAP = 2.2;
    var pEnd = C.diffDays(info.start, info.periodEnd) + 1;
    var ovDay = C.diffDays(info.start, info.ovulationDate) + 1;
    var segs = [['men', 1, pEnd], ['fol', pEnd + 1, ovDay - 2], ['ovu', Math.max(pEnd + 1, ovDay - 1), ovDay + 1], ['lut', ovDay + 2, L]];
    var arcs = segs.filter(function (g) { return g[2] >= g[1]; }).map(function (g) {
      var a = (g[1] - 1) / L * CIRC, len = Math.max(0.1, (g[2] - g[1] + 1) / L * CIRC - GAP);
      return '<circle class="cw-arc cw-' + g[0] + '" cx="100" cy="100" r="' + R + '" stroke-dasharray="' + len.toFixed(2) + ' ' + CIRC.toFixed(2) + '" stroke-dashoffset="' + (-a).toFixed(2) + '"/>';
    }).join('');
    var ang = ((Math.min(info.day, L) - 0.5) / L) * 2 * Math.PI - Math.PI / 2;
    var mx = 100 + R * Math.cos(ang), my = 100 + R * Math.sin(ang);
    var center = cur.late
      ? '<text x="100" y="94" class="cw-big">' + cur.late + '</text><text x="100" y="118" class="cw-small">' + (cur.late === 1 ? 'dia de atraso' : 'dias de atraso') + '</text>'
      : '<text x="100" y="92" class="cw-small">dia</text><text x="100" y="124" class="cw-big">' + info.day + '</text><text x="100" y="144" class="cw-small">de ' + info.cycleLen + '</text>';
    return '<svg class="cycle-wheel" viewBox="0 0 200 200" role="img" aria-label="Dia ' + info.day + ' de ' + info.cycleLen + ' do ciclo, fase ' + esc(cur.phase.name.toLowerCase()) + '">' +
      '<circle class="cw-track" cx="100" cy="100" r="' + R + '"/><g transform="rotate(-90 100 100)">' + arcs + '</g>' +
      '<circle class="cw-mark ph-' + info.phase + '" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="9"/>' + center + '</svg>';
  }

  function hero(s, cur, t) {
    var ph = cur.phase, f = cur.fertile;
    var lines = [];
    if (cur.late) lines.push('<li>' + ui.icon('alert', 16) + '<span>Menstruação atrasada há <strong>' + plural(cur.late, 'dia', 'dias') + '</strong> (era esperada em ' + C.formatDayMonth(cur.expected) + ').</span></li>');
    else if (cur.inPeriod) lines.push('<li><span class="li-ic">🌸</span><span>Menstruação: <strong>dia ' + cur.info.day + '</strong>' + (cur.openPeriod ? ' — avise quando terminar.' : '.') + '</span></li>');
    else lines.push('<li><span class="li-ic">🌸</span><span>Próxima menstruação <strong>' + when(cur.daysToNext) + '</strong> (' + esc(C.formatDayLabel(cur.nextStart, t)) + ').</span></li>');
    if (f) lines.push('<li><span class="li-ic">✨</span><span>Período fértil estimado: <strong>' + C.formatDayMonth(f.from) + ' a ' + C.formatDayMonth(f.to) + '</strong>' + (t >= f.from && t <= f.to ? ' (agora)' : '') + '.</span></li>');
    var btn = cur.openPeriod
      ? '<button type="button" class="btn primary" data-action="cycle-end">' + ui.icon('check', 18) + 'Minha menstruação terminou</button>'
      : '<button type="button" class="btn primary" data-action="cycle-start">' + ui.icon('plus', 18) + 'Minha menstruação começou</button>';
    return '<section class="card cycle-hero full ph-' + ph.key + '"><div class="cy-wheel">' + wheel(cur) + '</div><div class="cy-info">' +
      '<p class="cy-phase"><span aria-hidden="true">' + ph.emoji + '</span> Fase ' + esc(ph.name.toLowerCase()) + '</p><p class="cy-about">' + esc(ph.about) + '</p>' +
      '<ul class="cy-next">' + lines.join('') + '</ul>' +
      (cur.late ? '<p class="hint">Atrasos de alguns dias são comuns (estresse, sono, treino puxado). Se ficar em dúvida, faça um teste ou converse com sua ginecologista.</p>' : '') +
      '<div class="btn-row tight">' + btn + '</div></div></section>';
  }

  /* ---------------- Registro do dia ---------------- */

  function emoRow(kind, list, val) {
    return '<div class="emo-row">' + list.map(function (e) {
      return '<button type="button" class="emo' + (val === e[0] ? ' on' : '') + '" data-action="cycle-set" data-k="' + kind + '" data-v="' + e[0] + '" aria-pressed="' + (val === e[0]) + '" title="' + esc(e[2]) + '"><span aria-hidden="true">' + e[1] + '</span><small>' + esc(e[2]) + '</small></button>';
    }).join('') + '</div>';
  }
  function dayCard(s, t) {
    var d = curDate(), log = Cy.dayLog(s, d) || {}, info = Cy.dayInfo(s, d, t);
    var label = C.formatDayLabel(d, t) + (C.formatDayLabel(d, t).length < 8 ? ' • ' + C.formatDayMonth(d) : '');
    var flows = [[0, 'Nenhum']].concat(Cy.FLOW).map(function (fl) {
      var on = (log.flow || 0) === fl[0];
      return '<button type="button" class="chip flow-chip f' + fl[0] + (on ? ' on' : '') + '" data-action="cycle-set" data-k="flow" data-v="' + fl[0] + '" aria-pressed="' + on + '">' +
        (fl[0] ? '<span class="drops" aria-hidden="true">' + new Array(fl[0] + 1).join('💧') + '</span>' : '') + esc(fl[1]) + '</button>';
    }).join('');
    var syms = Cy.SYMPTOMS.map(function (x) {
      var on = (log.symptoms || []).indexOf(x[0]) >= 0;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-action="cycle-sym" data-id="' + x[0] + '" aria-pressed="' + on + '">' + esc(x[1]) + '</button>';
    }).join('');
    return '<section class="card cycle-day"><div class="card-head"><h2>' + ui.icon('edit', 18) + 'Como você está</h2>' +
      '<div class="day-mini"><button type="button" class="icon-btn" data-action="cycle-day" data-delta="-1" aria-label="Dia anterior">' + ui.icon('left', 18) + '</button><strong>' + esc(label) + '</strong>' +
      '<button type="button" class="icon-btn" data-action="cycle-day" data-delta="1" aria-label="Próximo dia"' + (d >= t ? ' disabled' : '') + '>' + ui.icon('right', 18) + '</button></div></div>' +
      (info ? '<p class="muted small">Dia ' + info.day + ' do ciclo • fase ' + esc(Cy.PHASES[info.phase].name.toLowerCase()) + '</p>' : '') +
      '<p class="cd-label">Fluxo</p><div class="quick-chips">' + flows + '</div>' +
      '<p class="cd-label">Energia</p>' + emoRow('energy', Cy.ENERGY, log.energy) +
      '<p class="cd-label">Humor</p>' + emoRow('mood', Cy.MOOD, log.mood) +
      '<p class="cd-label">Sintomas</p><div class="quick-chips sym-chips">' + syms + '</div>' +
      '<button type="button" class="link" data-action="cycle-note">' + ui.icon('edit', 16) + (log.note ? 'Anotação: ' + esc(log.note.slice(0, 40)) + (log.note.length > 40 ? '…' : '') : 'Escrever uma anotação') + '</button></section>';
  }

  /* ---------------- Fase, treino e energia ---------------- */

  function phaseCard(cur) {
    var ph = cur.phase;
    return '<section class="card cycle-tips ph-' + ph.key + '"><div class="card-head"><h2>' + ui.icon('dumbbell', 18) + 'Sua fase e o treino</h2></div>' +
      '<p class="tip-line"><strong>Treino:</strong> ' + esc(ph.treino) + '</p><p class="tip-line"><strong>Cuidado:</strong> ' + esc(ph.cuidado) + '</p>' +
      '<button type="button" class="link" data-action="go" data-route="treino">Ver o treino de hoje' + ui.icon('right', 16) + '</button></section>';
  }
  function statsCard(s, t) {
    var ps = Cy.phaseStats(s, t);
    if (!ps) return '';
    var any = ps.some(function (p) { return p.energyCount || p.workouts; });
    var body = any
      ? '<div class="phase-table" role="table" aria-label="Energia e treinos em cada fase"><div class="pt-row pt-head" role="row"><span role="columnheader">Fase</span><span role="columnheader">Energia</span><span role="columnheader">Treinos/sem.</span><span role="columnheader">Volume médio</span></div>' +
        ps.map(function (p) {
          return '<div class="pt-row ph-' + p.phase + '" role="row"><span role="cell"><i class="ph-dot" aria-hidden="true"></i>' + esc(p.name) + '</span>' +
            '<span role="cell">' + (p.energy != null ? Cy.ENERGY[Math.round(p.energy) - 1][1] + ' ' + JS.graf.fmtNum(p.energy, 1) : '—') + '</span>' +
            '<span role="cell">' + (p.perWeek != null && p.days >= 3 ? JS.graf.fmtNum(p.perWeek, 1) : '—') + '</span>' +
            '<span role="cell">' + (p.avgVolume != null ? JS.graf.fmtNum(p.avgVolume, 0) + ' kg' : '—') + '</span></div>' +
            (p.symptoms.length ? '<p class="pt-sym">Mais comuns: ' + esc(p.symptoms.join(', ').toLowerCase()) + '</p>' : '');
        }).join('') + '</div><p class="hint">Energia de 1 (muito baixa) a 5 (ótima), pelos seus registros. Volume = carga × repetições por treino.</p>'
      : '<p class="muted small">Registre sua energia nos próximos dias (aqui ou em Treino → Hoje). Com o tempo, este quadro mostra como sua energia, seus sintomas e seus treinos mudam em cada fase.</p>';
    return '<section class="card cycle-stats"><div class="card-head"><h2>' + ui.icon('chart', 18) + 'Energia e treino por fase</h2></div>' + body + '</section>';
  }

  /* ---------------- Calendário ---------------- */

  function calendar(s, t) {
    var mk = view.month || C.monthOf(t), days = Cy.monthDays(s, mk, t), r = C.monthRange(mk);
    var pad = C.weekday(r.from), cells = '';
    for (var i = 0; i < pad; i++) cells += '<span class="cy-cell empty"></span>';
    for (var d = r.from; d <= r.to; d = C.addDays(d, 1)) {
      var x = days[d], cls = 'cy-cell';
      if (x) cls += x.periodReal ? ' men-real' : x.periodPredicted ? ' men-pred' : x.fertile ? ' fertile' : '';
      if (x && x.ovulation) cls += ' ovu-day';
      if (d === t) cls += ' today';
      if (d > t) cls += ' future';
      var lg = x && x.log, dot = lg && (lg.energy || lg.mood || lg.symptoms || lg.note) ? '<i class="cy-dot"></i>' : '';
      cells += '<button type="button" class="' + cls + '" data-action="cycle-cal" data-date="' + d + '" aria-label="' + esc(C.formatDateLong(d) + (x ? ', fase ' + Cy.PHASES[x.phase].name.toLowerCase() : '')) + '"><span>' + Number(d.slice(8)) + '</span>' + dot + '</button>';
    }
    return '<section class="card cycle-cal-card"><div class="month-nav inline"><button type="button" class="icon-btn" data-action="cycle-month" data-delta="-1" aria-label="Mês anterior">' + ui.icon('left') + '</button>' +
      '<strong>' + esc(C.formatMonthLabel(mk)) + '</strong><button type="button" class="icon-btn" data-action="cycle-month" data-delta="1" aria-label="Próximo mês">' + ui.icon('right') + '</button></div>' +
      '<div class="cy-cal"><div class="cy-head">' + C.WEEKDAY_LETTERS.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div><div class="cy-grid">' + cells + '</div></div>' +
      '<div class="cy-legend"><span><i class="lg men-real"></i>Menstruação</span><span><i class="lg men-pred"></i>Prevista</span><span><i class="lg fertile"></i>Período fértil</span><span><i class="lg ovu-day"></i>Ovulação</span><span><i class="lg dot"></i>Registro</span></div></section>';
  }

  /* ---------------- Histórico e ajustes ---------------- */

  function historyCard(s) {
    var S = Cy.stats(s), h = Cy.history(s);
    var head = '<div class="mini-stats"><div><strong>' + S.cycleLen + ' dias</strong><span>' + (S.measured ? 'ciclo médio (' + plural(S.measured, 'ciclo', 'ciclos') + ')' : 'ciclo (média informada)') + '</span></div>' +
      '<div><strong>' + S.periodLen + ' dias</strong><span>menstruação, em média</span></div>' +
      (S.regular != null ? '<div><strong>' + (S.regular ? 'Regular' : 'Variando') + '</strong><span>' + S.min + ' a ' + S.max + ' dias</span></div>' : '') + '</div>';
    var rows = h.slice(0, 12).map(function (c) {
      return '<div class="item"><button type="button" class="item-main" data-action="cycle-period" data-id="' + esc(c.period.id) + '"><span class="item-title">' + esc(C.formatDateBR(c.start)) + '</span>' +
        '<span class="item-meta">' + plural(c.days, 'dia', 'dias') + ' de menstruação' + (c.endMarked ? '' : ' (estimado)') + ' • ' + (c.cycleLen ? 'ciclo de ' + c.cycleLen + ' dias' : 'ciclo atual') + '</span></button></div>';
    }).join('');
    return '<section class="card cycle-hist"><div class="card-head"><h2>' + ui.icon('repeat', 18) + 'Seus ciclos</h2><button type="button" class="link small-link" data-action="cycle-add-past">Registrar antiga</button></div>' + head + rows + '</section>';
  }
  function settingsCard(s) {
    var st = Cy.settings(s);
    return '<section class="card cycle-set"><div class="card-head"><h2>' + ui.icon('settings', 18) + 'Ajustes do ciclo</h2></div>' +
      '<button type="button" class="week-row plain" data-action="cycle-avg"><span class="wd-name">Médias para a previsão</span><span class="week-plan">' + st.cycleLen + ' / ' + st.periodLen + ' dias</span>' + ui.icon('right', 16) + '</button>' +
      sw('remind', 'Aviso antes da menstruação', st.remind, '2 dias antes, às 9h (Configurações → Notificações → Ciclo).') +
      sw('showInTreino', 'Mostrar a fase no Treino e no Início', st.showInTreino, 'Com a dica de treino do dia e a pergunta sobre sua energia.') + '</section>';
  }
  function sw(name, label, checked, hint) {
    return '<label class="switch-row"><span class="switch-text"><strong>' + esc(label) + '</strong><small>' + esc(hint) + '</small></span>' +
      '<input type="checkbox" class="switch" data-change="cycle-opt" name="' + name + '"' + (checked ? ' checked' : '') + '></label>';
  }

  function render(now) {
    var s = JS.store.state, t = C.toDateKey(now);
    var html = '<h1 class="page-title">Ciclo</h1><p class="page-sub">Menstruação, fases, sintomas e energia.</p>';
    if (!Cy.enabled(s)) {
      return html + '<section class="card cycle-intro full"><div class="cy-intro-art" aria-hidden="true">🌸</div><h2>Acompanhe seu ciclo</h2>' +
        '<p>Registre quando a menstruação vem e o J.S. calcula a fase de cada dia, prevê a próxima menstruação e o período fértil, e mostra como sua energia e seus treinos mudam ao longo do ciclo.</p>' +
        '<button type="button" class="btn primary" data-action="cycle-first">' + ui.icon('plus', 18) + 'Registrar minha última menstruação</button>' +
        '<p class="hint">Tudo fica só neste aparelho. Previsões são estimativas: não servem como método anticoncepcional.</p></section>';
    }
    var cur = Cy.current(s, t);
    html += hero(s, cur, t) + dayCard(s, t) + phaseCard(cur) + statsCard(s, t) + calendar(s, t) + historyCard(s) + settingsCard(s);
    html += '<p class="note">' + ui.icon('info', 14) + ' Previsões pela média dos seus ciclos (fase lútea de cerca de 14 dias). São estimativas: não servem como método anticoncepcional nem substituem a orientação da sua ginecologista.</p>';
    return html;
  }

  /* ---------------- Formulários ---------------- */

  function firstForm() {
    var t = today(), st = Cy.settings(JS.store.state);
    var body = ui.input({ label: 'Primeiro dia da última menstruação', name: 'start', type: 'date', value: t, attrs: 'max="' + t + '"' }) +
      '<div class="row2">' + ui.input({ label: 'Quantos dias costuma durar', name: 'periodLen', type: 'number', value: st.periodLen, attrs: 'inputmode="numeric" min="2" max="10"' }) +
      ui.input({ label: 'Ciclo costuma ter (dias)', name: 'cycleLen', type: 'number', value: st.cycleLen, attrs: 'inputmode="numeric" min="20" max="45"', hint: 'Do 1º dia de uma menstruação ao 1º da seguinte. Se não souber, deixe 28.' }) + '</div>' +
      '<p class="hint">Depois de 2 ou 3 ciclos registrados, o J.S. passa a usar as suas médias reais.</p>';
    ui.openSheet({
      title: 'Seu ciclo', body: body, submitLabel: 'Começar',
      onSubmit: function (v) {
        var e = {}, pl = Math.round(Number(v.periodLen)), cl = Math.round(Number(v.cycleLen));
        if (!C.isDateKey(v.start) || v.start > t) e.start = 'Escolha um dia até hoje.';
        if (!(pl >= 2 && pl <= 10)) e.periodLen = 'De 2 a 10 dias.';
        if (!(cl >= 20 && cl <= 45)) e.cycleLen = 'De 20 a 45 dias.';
        if (Object.keys(e).length) return { errors: e };
        var end = C.addDays(v.start, pl - 1);
        JS.store.update(function (s, n) {
          s.settings.cycle = Object.assign({}, s.settings.cycle, { cycleLen: cl, periodLen: pl });
          Cy.savePeriod(s, null, { start: v.start, end: end < t ? end : null }, n);
        });
        ui.toast('Pronto! Seu ciclo está sendo acompanhado 🌸');
        return { ok: true };
      },
      afterClose: function () { if (JS.notify) JS.notify.askIfNeeded(); }
    });
  }

  function startForm() {
    var t = today();
    var body = ui.input({ label: 'Primeiro dia', name: 'start', type: 'date', value: t, attrs: 'max="' + t + '"' }) +
      '<p class="hint">Marcamos o fluxo como médio nesse dia; dá para mudar em "Como você está".</p>';
    ui.openSheet({
      title: 'Menstruação começou', body: body, submitLabel: 'Registrar',
      onSubmit: function (v) {
        if (!C.isDateKey(v.start) || v.start > t) return { errors: { start: 'Escolha um dia até hoje.' } };
        JS.store.update(function (s, n) {
          Cy.startPeriod(s, v.start, n);
          if (!(Cy.dayLog(s, v.start) || {}).flow) Cy.setDay(s, v.start, { flow: 2 }, n);
        });
        view.date = null;
        ui.toast('Anotado 🌸 Cuide-se com carinho nestes dias.');
      }
    });
  }

  function periodForm(p) {
    var t = today();
    var body = '<div class="row2">' + ui.input({ label: 'Primeiro dia', name: 'start', type: 'date', value: p ? p.start : t, attrs: 'max="' + t + '"' }) +
      ui.input({ label: 'Último dia', name: 'end', type: 'date', value: p && p.end ? p.end : '', attrs: 'max="' + t + '"', hint: 'Em branco = ainda não terminou / não lembro.' }) + '</div>' +
      (p ? '<button type="button" class="btn ghost danger-text full" data-del>' + ui.icon('trash', 18) + 'Excluir este registro</button>' : '');
    ui.openSheet({
      title: p ? 'Editar menstruação' : 'Registrar menstruação antiga', body: body, submitLabel: 'Salvar',
      onOpen: function (form) {
        var del = form.querySelector('[data-del]');
        if (del) del.addEventListener('click', function () {
          ui.confirm({ title: 'Excluir este registro?', message: 'A menstruação de ' + C.formatDateBR(p.start) + ' sai do histórico e as previsões são refeitas.', confirmLabel: 'Excluir', danger: true })
            .then(function (ok) { if (ok) { JS.store.update(function (s) { Cy.deletePeriod(s, p.id); }); ui.closeSheet(); ui.toast('Registro excluído.'); } });
        });
      },
      onSubmit: function (input) {
        var r = Cy.validatePeriod(input);
        if (!r.ok) return { errors: r.errors };
        if (r.value.start > t) return { errors: { start: 'Escolha um dia até hoje.' } };
        var res = null;
        JS.store.update(function (s, n) { res = Cy.savePeriod(s, p ? p.id : null, r.value, n); });
        if (res && res.error) return { errors: { start: res.error } };
        ui.toast(p ? 'Registro atualizado.' : 'Menstruação registrada.');
      }
    });
  }

  function avgForm() {
    var st = Cy.settings(JS.store.state), S = Cy.stats(JS.store.state);
    var body = '<div class="row2">' + ui.input({ label: 'Ciclo (dias)', name: 'cycleLen', type: 'number', value: st.cycleLen, attrs: 'inputmode="numeric" min="20" max="45"' }) +
      ui.input({ label: 'Menstruação (dias)', name: 'periodLen', type: 'number', value: st.periodLen, attrs: 'inputmode="numeric" min="2" max="10"' }) + '</div>' +
      '<p class="hint">' + (S.measured ? 'Com ' + plural(S.measured, 'ciclo registrado', 'ciclos registrados') + ', a previsão já usa a sua média real (' + S.cycleLen + ' dias); estes valores ficam de reserva.' : 'Usados até você ter 2 ciclos registrados; depois, a previsão usa a sua média real.') + '</p>';
    ui.openSheet({
      title: 'Médias do ciclo', body: body, submitLabel: 'Salvar',
      onSubmit: function (v) {
        var e = {}, cl = Math.round(Number(v.cycleLen)), pl = Math.round(Number(v.periodLen));
        if (!(cl >= 20 && cl <= 45)) e.cycleLen = 'De 20 a 45 dias.';
        if (!(pl >= 2 && pl <= 10)) e.periodLen = 'De 2 a 10 dias.';
        if (Object.keys(e).length) return { errors: e };
        JS.store.update(function (s) { s.settings.cycle = Object.assign({}, s.settings.cycle, { cycleLen: cl, periodLen: pl }); });
        ui.toast('Médias salvas.');
      }
    });
  }

  function noteForm() {
    var d = curDate(), log = Cy.dayLog(JS.store.state, d) || {};
    ui.openSheet({
      title: 'Anotação', subtitle: C.formatDateLong(d),
      body: ui.textarea({ label: 'Como foi o dia', name: 'note', value: log.note || '', rows: 4, attrs: 'maxlength="300"', placeholder: 'Ex.: cólica de manhã, treinei leve e melhorou' }),
      submitLabel: 'Salvar',
      onSubmit: function (v) { JS.store.update(function (s, n) { Cy.setDay(s, d, { note: v.note }, n); }); ui.toast('Anotação salva.'); }
    });
  }

  function calMenu(date) {
    var s = JS.store.state, t = today(), info = Cy.dayInfo(s, date, t), real = Cy.realPeriodOn(s, date);
    var detail = info ? '<p>Dia ' + info.day + ' do ciclo • fase <strong>' + esc(Cy.PHASES[info.phase].name.toLowerCase()) + '</strong>' +
      (info.periodPredicted ? ' • menstruação prevista' : '') + (info.fertile ? ' • período fértil estimado' : '') + (info.ovulation ? ' • ovulação estimada' : '') + '</p>' : '';
    var lg = info && info.log;
    if (lg) {
      var parts = [];
      if (lg.flow) parts.push('fluxo ' + Cy.FLOW[lg.flow - 1][1].toLowerCase());
      if (lg.energy) parts.push('energia ' + Cy.ENERGY[lg.energy - 1][2].toLowerCase());
      if (lg.mood) parts.push('humor ' + Cy.MOOD[lg.mood - 1][2].toLowerCase());
      if (lg.symptoms) parts.push(lg.symptoms.length + ' sintoma(s)');
      if (parts.length) detail += '<p class="muted small">Registrado: ' + esc(parts.join(' • ')) + '</p>';
      if (lg.note) detail += '<p>' + esc(lg.note) + '</p>';
    }
    ui.actionSheet({
      title: C.formatDateLong(date), detail: detail,
      actions: [
        date <= t ? { label: 'Registrar como eu estava', icon: 'edit', run: function () { view.date = date === t ? null : date; JS.app.render(); scrollToDay(); } } : null,
        date <= t && !real ? { label: 'A menstruação começou neste dia', icon: 'plus', run: function () {
          JS.store.update(function (st, n) { Cy.startPeriod(st, date, n); if (!(Cy.dayLog(st, date) || {}).flow) Cy.setDay(st, date, { flow: 2 }, n); });
          ui.toast('Menstruação registrada em ' + C.formatDateBR(date) + '.');
        } } : null,
        real ? { label: 'Editar esta menstruação', icon: 'edit', run: function () { periodForm(real); } } : null,
        real && date <= t && date > real.start ? { label: 'Terminou neste dia', icon: 'check', run: function () { JS.store.update(function (st, n) { Cy.endPeriod(st, real.id, date, n); }); ui.toast('Anotado.'); } } : null
      ]
    });
  }
  function scrollToDay() {
    setTimeout(function () { var el = document.querySelector('.cycle-day'); if (el) el.scrollIntoView({ block: 'start', behavior: JS.anim.reduced() ? 'auto' : 'smooth' }); }, 80);
  }

  /* ---------------- Ações ---------------- */

  JS.actions['cycle-first'] = firstForm;
  JS.actions['cycle-start'] = startForm;
  JS.actions['cycle-end'] = function () {
    var s = JS.store.state, cur = Cy.current(s, today());
    if (!cur || !cur.openPeriod) return;
    JS.store.update(function (st, n) { Cy.endPeriod(st, cur.openPeriod.id, today(), n); });
    ui.toast('Anotado: terminou hoje. 🌷');
  };
  JS.actions['cycle-set'] = function (d) {
    var date = curDate(), k = d.k, v = Number(d.v), cur = (Cy.dayLog(JS.store.state, date) || {})[k] || 0, patch = {};
    patch[k] = cur === v ? null : v;
    JS.anim.mark('[data-action="cycle-set"][data-k="' + k + '"][data-v="' + v + '"]', 'pop', { ms: 600 });
    JS.store.update(function (st, n) { Cy.setDay(st, date, patch, n); });
  };
  JS.actions['cycle-sym'] = function (d) {
    var date = curDate();
    JS.anim.mark('[data-action="cycle-sym"][data-id="' + d.id + '"]', 'pop', { ms: 600 });
    JS.store.update(function (st, n) { Cy.toggleSymptom(st, date, d.id, n); });
  };
  JS.actions['cycle-note'] = noteForm;
  JS.actions['cycle-day'] = function (d) {
    var t = today(), next = C.addDays(curDate(), Number(d.delta));
    if (next > t) return;
    view.date = next === t ? null : next;
    JS.app.render({ enter: 'view:' + (Number(d.delta) > 0 ? 'r' : 'l') });
    scrollToDay();
  };
  JS.actions['cycle-month'] = function (d) {
    view.month = C.addMonthKey(view.month || C.monthOf(today()), Number(d.delta));
    JS.app.render({ enter: 'view:' + (Number(d.delta) > 0 ? 'r' : 'l') });
    setTimeout(function () { var el = document.querySelector('.cycle-cal-card'); if (el) el.scrollIntoView({ block: 'nearest' }); }, 60);
  };
  JS.actions['cycle-cal'] = function (d) { calMenu(d.date); };
  JS.actions['cycle-period'] = function (d) { var p = JS.store.state.cyclePeriods.filter(function (x) { return x.id === d.id; })[0]; if (p) periodForm(p); };
  JS.actions['cycle-add-past'] = function () { periodForm(null); };
  JS.actions['cycle-avg'] = avgForm;
  JS.changes['cycle-opt'] = function (el) {
    var k = el.name, on = el.checked;
    JS.store.update(function (s) { var c = Object.assign({}, s.settings.cycle); c[k] = on; s.settings.cycle = c; });
    ui.toast(k === 'remind' ? (on ? 'Vou avisar 2 dias antes. 🌸' : 'Aviso desligado.') : (on ? 'A fase aparece no Treino e no Início.' : 'A fase não aparece mais no Treino.'));
    if (k === 'remind' && on && JS.notify) JS.notify.askIfNeeded();
  };

  JS.cicloView = view;
  JS.telas.ciclo = { title: 'Ciclo', render: render };
})();
