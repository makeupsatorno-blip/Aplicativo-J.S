/* J.S. — Painel de gráficos: treino, corpo, alimentação, rotina, financeiro e cronograma capilar */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, T = window.JSTreino, B = window.JSCorpo, N = window.JSNutri, ui = JS.ui, esc = ui.esc;
  var view = { period: '30' };
  var PERIODS = [['30', '30 dias'], ['90', '90 dias'], ['365', '12 meses']];
  var MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  // Faixas do período: por dia (30), por semana (90) ou por mês (12 meses).
  function buckets(period, today) {
    var out = [];
    if (period === '30') {
      for (var i = 29; i >= 0; i--) { var d = C.addDays(today, -i); out.push({ from: d, to: d, label: C.formatDayMonth(d), tip: C.formatDateBR(d) }); }
    } else if (period === '90') {
      var start = C.addDays(today, -C.weekday(today) - 12 * 7);
      for (var w = 0; w < 13; w++) { var a = C.addDays(start, w * 7), b = C.addDays(a, 6); out.push({ from: a, to: b > today ? today : b, label: C.formatDayMonth(a), tip: 'Semana de ' + C.formatDayMonth(a) }); }
    } else {
      var mk = C.monthOf(today);
      for (var m = 11; m >= 0; m--) {
        var k = C.addMonthKey(mk, -m), r = C.monthRange(k);
        out.push({ from: r.from, to: r.to > today ? today : r.to, label: MONTHS[Number(k.slice(5)) - 1], tip: C.formatMonthLabel(k) });
      }
    }
    return out;
  }
  function idx(bs, date) { for (var i = 0; i < bs.length; i++) if (date >= bs[i].from && date <= bs[i].to) return i; return -1; }
  function f0(v) { return JS.graf.fmtNum(v, 0); }

  function card(title, sub, inner, icon) {
    return '<section class="card chart-card"><div class="card-head"><h2>' + ui.icon(icon || 'chart', 18) + esc(title) + '</h2></div>' +
      (sub ? '<p class="muted small chart-sub">' + sub + '</p>' : '') + inner + '</section>';
  }
  function none(text) { return '<p class="chart-empty">' + esc(text) + '</p>'; }

  function render(now) {
    var s = JS.store.state, today = C.toDateKey(now), bs = buckets(view.period, today);
    var from = bs[0].from, unit = view.period === '30' ? 'por dia' : view.period === '90' ? 'por semana' : 'por mês';
    var html = '<h1 class="page-title">Gráficos</h1><p class="page-sub">Tudo do J.S. num lugar só.</p>' + ui.segmented(PERIODS, view.period, 'graf-period');

    // ----- números do período
    var sessions = T.doneSessions(s).filter(function (x) { return x.date >= from && x.date <= today; });
    var occ = R.taskOccurrences(s, from, today), doneT = occ.filter(function (o) { return o.done; }).length;
    var days = N.dailyTotals(s, from, today).filter(function (d) { return d.count; });
    var avgKcal = days.length ? days.reduce(function (a, d) { return a + (d.total.kcal || 0); }, 0) / days.length : null;
    var paid = s.payments.filter(function (p) { return !p.voided && p.paidAt >= from && p.paidAt <= today; });
    var paidSum = paid.reduce(function (a, p) { return a + p.amountCents; }, 0);
    html += '<div class="tiles stat-tiles">' +
      '<div class="stat"><span class="stat-label">Treinos</span><strong>' + sessions.length + '</strong><span class="stat-sub">no período</span></div>' +
      '<div class="stat"><span class="stat-label">Tarefas feitas</span><strong>' + (occ.length ? Math.round(doneT / occ.length * 100) + '%' : '—') + '</strong><span class="stat-sub">' + doneT + ' de ' + occ.length + '</span></div>' +
      '<div class="stat"><span class="stat-label">Média kcal/dia</span><strong>' + (avgKcal == null ? '—' : f0(avgKcal)) + '</strong><span class="stat-sub">' + days.length + ' dias registrados</span></div>' +
      '<div class="stat"><span class="stat-label">Contas pagas</span><strong data-count-cents="' + paidSum + '">' + C.formatCents(paidSum) + '</strong><span class="stat-sub">' + paid.length + ' pagamentos</span></div></div>';

    // ----- Treino
    var wCount = bs.map(function () { return 0; }), wVol = bs.map(function () { return 0; });
    sessions.forEach(function (x) {
      var i = idx(bs, x.date);
      if (i < 0) return;
      wCount[i]++;
      x.items.forEach(function (it) { it.sets.forEach(function (st) { wVol[i] += (st.load || 0) * (st.reps || 0); }); });
    });
    html += card('Treinos ' + unit, sessions.length ? sessions.length + ' treinos no período' : '',
      sessions.length ? JS.graf.chart({ type: 'bars', title: 'Treinos ' + unit, unit: '', dec: 0, yLabel: 'Treinos', xLabel: 'Período', height: 160,
        points: bs.map(function (b, i) { return { label: b.label, v: wCount[i], tip: b.tip }; }) }) : none('Nenhum treino concluído no período.'), 'dumbbell');
    if (sessions.length) {
      html += card('Volume de treino ' + unit, 'carga × repetições somadas', JS.graf.chart({ type: 'bars', title: 'Volume de treino ' + unit, unit: 'kg', dec: 0, yLabel: 'Volume', height: 150,
        points: bs.map(function (b, i) { return { label: b.label, v: Math.round(wVol[i]), tip: b.tip }; }) }), 'dumbbell');
      var top = T.trainedExercises(s).sort(function (a, b) { return b.trend.count - a.trend.count; })[0];
      if (top) {
        var h = T.exerciseHistory(s, top.id).filter(function (x) { return x.date >= from; });
        if (h.length) html += card('Carga: ' + top.name, 'exercício mais feito • ' + JS.trendTag(top.trend) + ' <button type="button" class="link small-link" data-action="graf-evo">ver todos</button>',
          JS.graf.chart({ type: 'line', title: 'Carga máxima em ' + top.name, unit: 'kg', dec: 1, yLabel: 'Carga máxima',
            points: h.map(function (x) { return { label: C.formatDayMonth(x.date), v: x.maxLoad, tip: C.formatDateBR(x.date) }; }) }), 'chart');
      }
    }

    // ----- Corpo (um gráfico por medida: nunca dois eixos)
    [['weightKg', 'Peso'], ['fatPct', 'Gordura corporal'], ['muscleKg', 'Massa muscular']].forEach(function (m) {
      var f = B.field(m[0]), ser = B.series(s, m[0]).filter(function (p) { return p.date >= from; });
      if (!ser.length) return;
      var d = ser.length > 1 ? Math.round((ser[ser.length - 1].value - ser[0].value) * 10) / 10 : null;
      html += card(m[1], d == null ? '1 medição no período' : 'no período: ' + (d > 0 ? '+' : '') + JS.graf.fmtNum(d, 1) + ' ' + f.unit,
        JS.graf.chart({ type: 'line', title: m[1], unit: f.unit, dec: 1, yLabel: m[1], height: 150,
          points: ser.map(function (p) { return { label: C.formatDayMonth(p.date), v: p.value, tip: C.formatDateBR(p.date) }; }) }), 'body');
    });

    // ----- Alimentação
    var kc = bs.map(function () { return { sum: 0, n: 0, p: 0, c: 0, g: 0 }; });
    days.forEach(function (d) { var i = idx(bs, d.date); if (i < 0) return; var k = kc[i]; k.sum += d.total.kcal || 0; k.n++; k.p += d.total.prot || 0; k.c += d.total.carb || 0; k.g += d.total.lip || 0; });
    var target = N.kcalTarget(s, today);
    if (days.length) {
      html += card('Calorias ' + (view.period === '30' ? 'por dia' : '(média por dia registrado)'), target ? 'linha = meta de ' + f0(target.value) + ' kcal' : '',
        JS.graf.chart({ type: 'bars', title: 'Calorias', unit: 'kcal', dec: 0, yLabel: 'Calorias', height: 170, goal: target ? target.value : null,
          points: bs.map(function (b, i) { return { label: b.label, v: kc[i].n ? Math.round(kc[i].sum / kc[i].n) : 0, tip: b.tip + (kc[i].n > 1 ? ' • média de ' + kc[i].n + ' dias' : '') }; }) }), 'flame');
      html += card('Macronutrientes', 'gramas por dia registrado',
        JS.graf.chart({ type: 'stack', title: 'Macronutrientes', unit: 'g', dec: 0, height: 170,
          series: [{ name: 'Proteínas', color: '#A0526D' }, { name: 'Carboidratos', color: '#2A78D6' }, { name: 'Gorduras', color: '#C98500' }],
          points: bs.map(function (b, i) { var k = kc[i], n = k.n || 1; return { label: b.label, parts: [Math.round(k.p / n), Math.round(k.c / n), Math.round(k.g / n)], tip: b.tip }; }) }), 'leaf');
    } else html += card('Alimentação', '', none('Registre alimentos no Diário para ver calorias e macronutrientes.'), 'flame');

    // ----- Rotina
    var tDone = bs.map(function () { return 0; });
    occ.forEach(function (o) { if (o.done) { var i = idx(bs, o.date); if (i >= 0) tDone[i]++; } });
    html += card('Tarefas concluídas ' + unit, occ.length ? doneT + ' de ' + occ.length + ' feitas no período' : '',
      occ.length ? JS.graf.chart({ type: 'bars', title: 'Tarefas concluídas', unit: '', dec: 0, yLabel: 'Concluídas', height: 150,
        points: bs.map(function (b, i) { return { label: b.label, v: tDone[i], tip: b.tip }; }) }) : none('Nenhuma tarefa com data no período.'), 'list');

    // ----- Financeiro
    if (paid.length) {
      var pb = bs.map(function () { return 0; }), cat = {};
      paid.forEach(function (p) {
        var i = idx(bs, p.paidAt); if (i >= 0) pb[i] += p.amountCents;
        var bill = R.byId(s.bills, p.billId), c = bill ? bill.category : 'Outros';
        cat[c] = (cat[c] || 0) + p.amountCents;
      });
      html += card('Pago ' + unit, C.formatCents(paidSum) + ' no período', JS.graf.chart({ type: 'bars', title: 'Pago', unit: '', dec: 2, yLabel: 'R$', height: 150, prefix: 'R$',
        points: bs.map(function (b, i) { return { label: b.label, v: pb[i] / 100, tip: b.tip }; }) }), 'wallet');
      var cats = Object.keys(cat).sort(function (a, b) { return cat[b] - cat[a]; });
      html += card('Gastos por categoria', 'contas pagas no período', JS.graf.chart({ type: 'hbars', title: 'Gastos por categoria', unit: '', dec: 2, height: Math.max(80, cats.length * 34 + 8),
        prefix: 'R$', points: cats.map(function (c) { return { label: c, v: cat[c] / 100, tip: c }; }) }), 'wallet');
    } else html += card('Financeiro', '', none('Nenhuma conta paga no período.'), 'wallet');

    // ----- Cronograma capilar
    var hair = s.hairEvents.filter(function (e) { return e.status === 'completed' && e.completedAt && C.toDateKey(new Date(e.completedAt)) >= from; });
    if (hair.length) {
      var ht = {};
      hair.forEach(function (e) { var n = R.hairName(e); ht[n] = (ht[n] || 0) + 1; });
      var hk = Object.keys(ht).sort(function (a, b) { return ht[b] - ht[a]; });
      html += card('Cronograma capilar', hair.length + ' tratamentos feitos no período', JS.graf.chart({ type: 'hbars', title: 'Tratamentos feitos', unit: '', dec: 0, height: Math.max(80, hk.length * 34 + 8),
        points: hk.map(function (k) { return { label: k, v: ht[k], tip: k }; }) }), 'flower');
    } else html += card('Cronograma capilar', '', none('Nenhum tratamento realizado no período.'), 'flower');
    return html;
  }

  JS.actions['graf-period'] = function (d) {
    if (d.mode === view.period) return;
    var order = PERIODS.map(function (p) { return p[0]; });
    var dir = order.indexOf(d.mode) > order.indexOf(view.period) ? 'r' : 'l';
    view.period = d.mode;
    JS.app.render({ enter: 'view:' + dir });
  };
  JS.actions['graf-evo'] = function () { JS.treinoView.mode = 'evolucao'; JS.app.go('treino'); };
  JS.telas.graficos = { title: 'Gráficos', render: render };
})();
