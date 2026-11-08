/* J.S. — Painel de gráficos: resumo com comparação, destaques, constância e um bloco por módulo */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, T = window.JSTreino, B = window.JSCorpo, N = window.JSNutri, ui = JS.ui, esc = ui.esc;
  var view = { period: '30', mod: 'tudo' };
  var PERIODS = [['30', '30 dias'], ['90', '90 dias'], ['365', '12 meses']];
  var MODS = [['tudo', 'Tudo'], ['treino', 'Treino'], ['corpo', 'Corpo'], ['alim', 'Alimentação'], ['rotina', 'Rotina'], ['fin', 'Finanças'], ['cap', 'Capilar']];
  var MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var MACRO_COLORS = ['#A0526D', '#2A78D6', '#C98500'];

  function f0(v) { return JS.graf.fmtNum(v, 0); }
  function f1(v) { return JS.graf.fmtNum(v, 1); }
  function days() { return Number(view.period); }

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

  /* ---------------- Números de um intervalo ---------------- */

  function metrics(s, from, to) {
    var sessions = T.doneSessions(s).filter(function (x) { return x.date >= from && x.date <= to; });
    var occ = R.taskOccurrences(s, from, to), done = occ.filter(function (o) { return o.done; }).length;
    var logged = N.dailyTotals(s, from, to).filter(function (d) { return d.count; });
    var kcal = logged.length ? logged.reduce(function (a, d) { return a + (d.total.kcal || 0); }, 0) / logged.length : null;
    var prot = logged.length ? logged.reduce(function (a, d) { return a + (d.total.prot || 0); }, 0) / logged.length : null;
    var paid = s.payments.filter(function (p) { return !p.voided && p.paidAt >= from && p.paidAt <= to; });
    var hair = s.hairEvents.filter(function (e) { if (e.status !== 'completed' || !e.completedAt) return false; var d = C.toDateKey(new Date(e.completedAt)); return d >= from && d <= to; });
    return {
      sessions: sessions, workouts: sessions.length, occ: occ, tasksDone: done, tasksPct: occ.length ? Math.round(done / occ.length * 100) : null,
      logged: logged, kcal: kcal, prot: prot, paid: paid, paidSum: paid.reduce(function (a, p) { return a + p.amountCents; }, 0), hair: hair
    };
  }

  // Selo de comparação com o período anterior. good: 'up' | 'down' | 'neutral'.
  function delta(cur, prev, unit, good, dec) {
    if (cur == null || prev == null) return '<span class="delta">sem comparação</span>';
    var d = Math.round((cur - prev) * Math.pow(10, dec || 0)) / Math.pow(10, dec || 0);
    if (d === 0) return '<span class="delta">= igual ao anterior</span>';
    var up = d > 0, tone = good === 'neutral' ? '' : (up === (good === 'up') ? 'good' : 'bad');
    return '<span class="delta ' + tone + '">' + ui.icon(up ? 'up' : 'down', 12) + (up ? '+' : '') + JS.graf.fmtNum(d, dec || 0) + (unit || '') + ' vs. antes</span>';
  }

  function chunk(vals, mode) {
    if (!vals || vals.length <= 13) return vals;
    var out = [], size = Math.ceil(vals.length / 10);
    for (var i = 0; i < vals.length; i += size) {
      var part = vals.slice(i, i + size).filter(function (v) { return v != null; });
      out.push(!part.length ? null : mode === 'avg' ? part.reduce(function (a, b) { return a + b; }, 0) / part.length : part.reduce(function (a, b) { return a + b; }, 0));
    }
    return out;
  }

  function tile(label, value, sub, deltaHtml, sparkVals, color) {
    return '<div class="stat stat-pro"><span class="stat-label">' + esc(label) + '</span><div class="stat-row"><strong>' + value + '</strong>' + JS.graf.spark(sparkVals, color) + '</div>' +
      (deltaHtml || '') + (sub ? '<span class="stat-sub">' + sub + '</span>' : '') + '</div>';
  }

  function card(title, sub, inner, icon, cls) {
    return '<section class="card chart-card ' + (cls || '') + '"><div class="card-head"><h2>' + ui.icon(icon || 'chart', 18) + esc(title) + '</h2></div>' +
      (sub ? '<p class="muted small chart-sub">' + sub + '</p>' : '') + inner + '</section>';
  }
  function emptyCard(title, text, icon, route, btn) {
    return card(title, '', '<div class="chart-empty-cta"><p>' + esc(text) + '</p><button type="button" class="btn soft small" data-action="go" data-route="' + route + '">' + esc(btn) + '</button></div>', icon);
  }
  function head(mod, icon, title) {
    return '<h2 class="mod-head mh-' + mod + '"><span class="mod-ic sm">' + ui.icon(icon, 18) + '</span>' + esc(title) + '</h2>';
  }
  function on(mod) { return view.mod === 'tudo' || view.mod === mod; }

  // Semanas seguidas (até a atual ou a anterior) com pelo menos um treino.
  function streakWeeks(s, today) {
    var weekOf = function (d) { return C.addDays(d, -C.weekday(d)); };
    var set = {};
    T.doneSessions(s).forEach(function (x) { set[weekOf(x.date)] = 1; });
    var w = weekOf(today), n = 0;
    if (!set[w]) w = C.addDays(w, -7); // a semana atual ainda pode estar começando
    while (set[w]) { n++; w = C.addDays(w, -7); }
    return n;
  }

  function heatWeeks(s, today, nWeeks) {
    var count = {};
    T.doneSessions(s).forEach(function (x) { count[x.date] = (count[x.date] || 0) + 1; });
    var start = C.addDays(today, -C.weekday(today) - (nWeeks - 1) * 7), weeks = [], points = [], lastMonth = null;
    for (var w = 0; w < nWeeks; w++) {
      var col = { days: [] }, ws = C.addDays(start, w * 7);
      var mo = Number(ws.slice(5, 7));
      if (mo !== lastMonth) { col.label = MONTHS[mo - 1]; lastMonth = mo; }
      for (var d = 0; d < 7; d++) {
        var day = C.addDays(ws, d), v = count[day] || 0;
        col.days.push({ v: v, tip: C.formatDayLabel(day, today) + ' • ' + C.formatDateBR(day), future: day > today, today: day === today });
        if (v && day <= today) points.push({ label: C.formatDateBR(day), v: v });
      }
      weeks.push(col);
    }
    return { weeks: weeks, points: points };
  }

  /* ---------------- Tela ---------------- */

  function render(now) {
    var s = JS.store.state, today = C.toDateKey(now), bs = buckets(view.period, today);
    var from = C.addDays(today, -(days() - 1)), pTo = C.addDays(from, -1), pFrom = C.addDays(pTo, -(days() - 1));
    var cur = metrics(s, from, today), prev = metrics(s, pFrom, pTo);
    var unit = view.period === '30' ? 'por dia' : view.period === '90' ? 'por semana' : 'por mês';
    var target = N.kcalTarget(s, today);

    var html = '<h1 class="page-title">Gráficos</h1><p class="page-sub">Tudo do J.S. num lugar só. Toque nos gráficos para ver os valores.</p>' +
      '<div class="graf-filters">' + ui.segmented(PERIODS, view.period, 'graf-period') +
      '<div class="quick-chips scroll-chips">' + MODS.map(function (m) { return '<button type="button" class="chip' + (view.mod === m[0] ? ' on' : '') + '" data-action="graf-mod" data-mod="' + m[0] + '">' + esc(m[1]) + '</button>'; }).join('') + '</div></div>';

    // ----- séries por faixa (usadas nas minilinhas e nos gráficos)
    var wCount = bs.map(function () { return 0; }), wVol = bs.map(function () { return 0; });
    cur.sessions.forEach(function (x) {
      var i = idx(bs, x.date); if (i < 0) return;
      wCount[i]++;
      x.items.forEach(function (it) { it.sets.forEach(function (st) { wVol[i] += (st.load || 0) * (st.reps || 0); }); });
    });
    var tDone = bs.map(function () { return 0; }), tAll = bs.map(function () { return 0; });
    cur.occ.forEach(function (o) { var i = idx(bs, o.date); if (i < 0) return; tAll[i]++; if (o.done) tDone[i]++; });
    var kc = bs.map(function () { return { sum: 0, n: 0, p: 0, c: 0, g: 0 }; });
    cur.logged.forEach(function (d) { var i = idx(bs, d.date); if (i < 0) return; var k = kc[i]; k.sum += d.total.kcal || 0; k.n++; k.p += d.total.prot || 0; k.c += d.total.carb || 0; k.g += d.total.lip || 0; });
    var pb = bs.map(function () { return 0; });
    cur.paid.forEach(function (p) { var i = idx(bs, p.paidAt); if (i >= 0) pb[i] += p.amountCents; });

    // ----- resumo com comparação
    var periodTxt = view.period === '365' ? '12 meses' : view.period + ' dias';
    var tiles = [];
    if (on('treino')) tiles.push(tile('Treinos', String(cur.workouts), 'nos últimos ' + periodTxt, delta(cur.workouts, prev.workouts, '', 'up'), chunk(wCount), '#A0526D'));
    if (on('rotina')) tiles.push(tile('Tarefas feitas', cur.tasksPct == null ? '—' : cur.tasksPct + '%', cur.tasksDone + ' de ' + cur.occ.length, delta(cur.tasksPct, prev.tasksPct, ' p.p.', 'up'),
      chunk(tAll.map(function (a, i) { return a ? tDone[i] / a * 100 : null; }), 'avg'), '#A0526D'));
    if (on('alim')) tiles.push(tile('Média kcal/dia', cur.kcal == null ? '—' : f0(cur.kcal), target ? Math.round((cur.kcal || 0) / target.value * 100) + '% da meta de ' + f0(target.value) : cur.logged.length + ' dias registrados',
      delta(cur.kcal, prev.kcal, ' kcal', 'neutral'), chunk(kc.map(function (k) { return k.n ? k.sum / k.n : null; }), 'avg'), '#C98500'));
    if (on('fin')) tiles.push(tile('Contas pagas', '<span data-count-cents="' + cur.paidSum + '">' + C.formatCents(cur.paidSum) + '</span>', cur.paid.length + ' pagamentos',
      delta(cur.paidSum / 100, prev.paidSum / 100, '', 'neutral', 0).replace(/(\+?-?)([\d.]+) vs/, '$1R$ $2 vs'), chunk(pb), '#2A78D6'));
    if (on('corpo')) {
      var wS = B.series(s, 'weightKg').filter(function (p) { return p.date >= from; });
      var wAll = B.series(s, 'weightKg');
      tiles.push(tile('Peso', wAll.length ? f1(wAll[wAll.length - 1].value) + ' kg' : '—', wS.length ? wS.length + ' medições no período' : 'sem medição no período',
        wS.length > 1 ? delta(wS[wS.length - 1].value, wS[0].value, ' kg', 'neutral', 1).replace('vs. antes', 'no período') : '', wS.map(function (p) { return p.value; }), '#A0526D'));
    }
    if (on('cap')) tiles.push(tile('Tratamentos capilares', String(cur.hair.length), 'nos últimos ' + periodTxt, delta(cur.hair.length, prev.hair.length, '', 'up'), null, '#8F6BB3'));
    if (tiles.length) html += '<div class="tiles stat-tiles">' + tiles.join('') + '</div>';

    // ----- destaques
    var ins = [];
    if (on('treino') && (cur.workouts || prev.workouts)) {
      var dW = cur.workouts - prev.workouts;
      ins.push(['dumbbell', '<strong>' + cur.workouts + (cur.workouts === 1 ? ' treino' : ' treinos') + '</strong> no período' + (dW ? ' — ' + Math.abs(dW) + (dW > 0 ? ' a mais' : ' a menos') + ' que no período anterior.' : ', igual ao anterior.')]);
      var st = streakWeeks(s, today);
      if (st >= 2) ins.push(['flame', 'Sequência de <strong>' + st + ' semanas</strong> seguidas treinando. Continue assim!']);
      var best = null;
      T.trainedExercises(s).forEach(function (x) {
        var h = T.exerciseHistory(s, x.id).filter(function (p) { return p.date >= from; });
        if (h.length < 2) return;
        var g = h[h.length - 1].maxLoad - h[0].maxLoad;
        if (!best || g > best.g) best = { name: x.name, g: g, last: h[h.length - 1].maxLoad };
      });
      if (best && best.g > 0) ins.push(['up', 'Maior evolução: <strong>' + esc(best.name) + '</strong> subiu ' + f1(best.g) + ' kg (agora ' + f1(best.last) + ' kg).']);
    }
    if (on('corpo')) {
      ['muscleKg', 'fatPct', 'weightKg'].forEach(function (k) {
        var ser = B.series(s, k).filter(function (p) { return p.date >= from; });
        if (ser.length < 2) return;
        var f = B.field(k), d = Math.round((ser[ser.length - 1].value - ser[0].value) * 10) / 10;
        if (!d) return;
        var good = f.good === 'neutral' ? '' : ((d > 0) === (f.good === 'up') ? ' 👏' : '');
        ins.push(['body', '<strong>' + esc(f.label) + '</strong>: ' + (d > 0 ? '+' : '') + f1(d) + ' ' + f.unit + ' no período.' + good]);
      });
    }
    if (on('alim') && cur.kcal != null) {
      ins.push(['flame', 'Média de <strong>' + f0(cur.kcal) + ' kcal</strong> por dia registrado' + (target ? ' (' + Math.round(cur.kcal / target.value * 100) + '% da meta)' : '') + '.']);
      if (cur.prot != null) ins.push(['leaf', 'Proteína média de <strong>' + f0(cur.prot) + ' g</strong> por dia.']);
    }
    if (on('rotina') && cur.occ.length) {
      var byWd = [0, 0, 0, 0, 0, 0, 0];
      cur.occ.forEach(function (o) { if (o.done) byWd[C.weekday(o.date)]++; });
      var bw = byWd.indexOf(Math.max.apply(null, byWd));
      ins.push(['list', 'Você concluiu <strong>' + cur.tasksPct + '%</strong> das tarefas' + (byWd[bw] > 1 ? '; o dia mais produtivo é <strong>' + ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][bw] + '</strong>.' : '.')]);
    }
    if (on('fin') && cur.paid.length) {
      var cat = {};
      cur.paid.forEach(function (p) { var b = R.byId(s.bills, p.billId), c = b ? b.category : 'Outros'; cat[c] = (cat[c] || 0) + p.amountCents; });
      var top = Object.keys(cat).sort(function (a, b) { return cat[b] - cat[a]; })[0];
      ins.push(['wallet', 'Maior gasto: <strong>' + esc(top) + '</strong> (' + C.formatCents(cat[top]) + ').']);
    }
    if (ins.length) {
      html += '<section class="card insights full"><div class="card-head"><h2>' + ui.icon('sparkle', 18) + 'Destaques</h2></div><ul>' +
        ins.slice(0, 6).map(function (x) { return '<li><span class="ins-ic">' + ui.icon(x[0], 16) + '</span><span>' + x[1] + '</span></li>'; }).join('') + '</ul></section>';
    }

    // ----- Treino
    if (on('treino')) {
      html += head('treino', 'dumbbell', 'Treino');
      if (!s.workoutSessions.some(function (x) { return x.status === 'done'; })) {
        html += emptyCard('Treinos', 'Conclua um treino para ver a constância, o volume e a evolução das cargas.', 'dumbbell', 'treino', 'Ir para Treino');
      } else {
        var nWeeks = view.period === '30' ? 9 : view.period === '90' ? 13 : 53;
        var hw = heatWeeks(s, today, nWeeks), st2 = streakWeeks(s, today);
        var trainedDays = hw.points.length;
        html += card('Constância', trainedDays + (trainedDays === 1 ? ' dia treinado' : ' dias treinados') + ' • sequência de ' + st2 + (st2 === 1 ? ' semana' : ' semanas'),
          JS.graf.chart({ type: 'heat', title: 'Dias com treino', weeks: hw.weeks, points: hw.points, height: 16 + 7 * 21, xLabel: 'Dia', yLabel: 'Treinos' }), 'calendar', 'full');
        html += card('Treinos ' + unit, cur.workouts + ' no período', JS.graf.chart({ type: 'bars', title: 'Treinos ' + unit, dec: 0, yLabel: 'Treinos', height: 160,
          points: bs.map(function (b, i) { return { label: b.label, v: wCount[i], tip: b.tip }; }) }), 'dumbbell');
        html += card('Volume ' + unit, 'carga × repetições somadas', JS.graf.chart({ type: 'bars', title: 'Volume de treino ' + unit, unit: 'kg', dec: 0, yLabel: 'Volume', height: 160, color: '#2A78D6',
          points: bs.map(function (b, i) { return { label: b.label, v: Math.round(wVol[i]), tip: b.tip }; }) }), 'chart');
        // Evolução das cargas: os exercícios mais feitos, com tendência.
        var top = T.trainedExercises(s).map(function (x) { x.h = T.exerciseHistory(s, x.id); return x; })
          .sort(function (a, b) { return b.h.length - a.h.length; }).slice(0, 5);
        html += card('Evolução das cargas', 'exercícios mais feitos • toque para ver todos', '<div class="evo-list">' + top.map(function (x) {
          return '<button type="button" class="evo-row" data-action="graf-evo" data-id="' + esc(x.id) + '"><span class="evo-name"><strong>' + esc(x.name) + '</strong><small>' + x.h.length + (x.h.length === 1 ? ' treino' : ' treinos') + (x.h.length > 1 ? ' • desde o 1º: ' + (x.trend.sinceFirst > 0 ? '+' : '') + f1(x.trend.sinceFirst) + ' kg' : '') + '</small></span>' +
            JS.graf.spark(x.h.slice(-12).map(function (p) { return p.maxLoad; }), '#A0526D') + '<span class="evo-val"><strong>' + f1(x.trend.last.maxLoad) + ' kg</strong>' + JS.trendTag(x.trend) + '</span></button>';
        }).join('') + '</div>', 'up');
      }
    }

    // ----- Corpo (um gráfico por medida: nunca dois eixos)
    if (on('corpo')) {
      html += head('corpo', 'body', 'Corpo');
      var any = false;
      [['weightKg', 'Peso', '#A0526D'], ['muscleKg', 'Massa muscular', '#2A78D6'], ['fatPct', 'Gordura corporal', '#C98500']].forEach(function (m) {
        var f = B.field(m[0]), ser = B.series(s, m[0]).filter(function (p) { return p.date >= from; });
        if (!ser.length) return;
        any = true;
        var d = ser.length > 1 ? Math.round((ser[ser.length - 1].value - ser[0].value) * 10) / 10 : null;
        html += card(m[1], d == null ? '1 medição no período' : 'no período: ' + (d > 0 ? '+' : '') + f1(d) + ' ' + f.unit,
          JS.graf.chart({ type: 'line', title: m[1], unit: f.unit, dec: 1, yLabel: m[1], height: 150, color: m[2],
            points: ser.map(function (p) { return { label: C.formatDayMonth(p.date), v: p.value, tip: C.formatDateBR(p.date) }; }) }), 'body');
      });
      if (!any) html += emptyCard('Corpo', 'Registre as medições da bioimpedância para ver peso, massa muscular e gordura ao longo do tempo.', 'body', 'corpo', 'Registrar medição');
    }

    // ----- Alimentação
    if (on('alim')) {
      html += head('alim', 'utensils', 'Alimentação');
      if (cur.logged.length) {
        html += card('Calorias ' + (view.period === '30' ? 'por dia' : '(média por dia registrado)'), target ? 'linha = meta de ' + f0(target.value) + ' kcal' : '',
          JS.graf.chart({ type: 'bars', title: 'Calorias', unit: 'kcal', dec: 0, yLabel: 'Calorias', height: 170, goal: target ? target.value : null, color: '#C98500',
            points: bs.map(function (b, i) { return { label: b.label, v: kc[i].n ? Math.round(kc[i].sum / kc[i].n) : 0, tip: b.tip + (kc[i].n > 1 ? ' • média de ' + kc[i].n + ' dias' : '') }; }) }), 'flame');
        var tp = 0, tc = 0, tg = 0;
        cur.logged.forEach(function (d) { tp += d.total.prot || 0; tc += d.total.carb || 0; tg += d.total.lip || 0; });
        var sp = N.macroSplit({ prot: tp, carb: tc, lip: tg }) || { prot: 0, carb: 0, lip: 0 };
        html += card('Macronutrientes', 'gramas por dia registrado e divisão das calorias no período',
          '<div class="split-bar" role="img" aria-label="Proteínas ' + sp.prot + '%, carboidratos ' + sp.carb + '%, gorduras ' + sp.lip + '%">' +
          [['prot', 'Proteínas'], ['carb', 'Carboidratos'], ['lip', 'Gorduras']].map(function (m, i) {
            return sp[m[0]] ? '<span style="flex:' + sp[m[0]] + ';background:' + MACRO_COLORS[i] + '">' + (sp[m[0]] >= 12 ? sp[m[0]] + '%' : '') + '</span>' : '';
          }).join('') + '</div>' +
          JS.graf.chart({ type: 'stack', title: 'Macronutrientes', unit: 'g', dec: 0, height: 170,
            series: [{ name: 'Proteínas', color: MACRO_COLORS[0] }, { name: 'Carboidratos', color: MACRO_COLORS[1] }, { name: 'Gorduras', color: MACRO_COLORS[2] }],
            points: bs.map(function (b, i) { var k = kc[i], n = k.n || 1; return { label: b.label, parts: [Math.round(k.p / n), Math.round(k.c / n), Math.round(k.g / n)], tip: b.tip }; }) }), 'leaf');
      } else html += emptyCard('Alimentação', 'Registre o que comeu no Diário para ver calorias e macronutrientes.', 'flame', 'alimentacao', 'Abrir o Diário');
    }

    // ----- Rotina
    if (on('rotina')) {
      html += head('rotina', 'list', 'Rotina');
      if (cur.occ.length) {
        html += card('Tarefas concluídas ' + unit, cur.tasksDone + ' de ' + cur.occ.length + ' feitas no período', JS.graf.chart({ type: 'bars', title: 'Tarefas concluídas', dec: 0, yLabel: 'Concluídas', height: 150,
          points: bs.map(function (b, i) { return { label: b.label, v: tDone[i], tip: b.tip + ' • ' + tDone[i] + ' de ' + tAll[i] }; }) }), 'list');
        var pctPts = [];
        bs.forEach(function (b, i) { if (tAll[i]) pctPts.push({ label: b.label, v: Math.round(tDone[i] / tAll[i] * 100), tip: b.tip + ' • ' + tDone[i] + ' de ' + tAll[i] }); });
        if (pctPts.length > 1) html += card('Taxa de conclusão', 'porcentagem das tarefas planejadas que foram feitas', JS.graf.chart({ type: 'line', title: 'Taxa de conclusão', unit: '%', dec: 0, yLabel: 'Concluídas', height: 150, zero: true, points: pctPts }), 'check');
      } else html += emptyCard('Rotina', 'Nenhuma tarefa com data no período.', 'list', 'rotina', 'Abrir a Rotina');
    }

    // ----- Financeiro
    if (on('fin')) {
      html += head('fin', 'wallet', 'Finanças');
      if (cur.paid.length) {
        var catSum = {};
        cur.paid.forEach(function (p) { var bill = R.byId(s.bills, p.billId), c = bill ? bill.category : 'Outros'; catSum[c] = (catSum[c] || 0) + p.amountCents; });
        html += card('Pago ' + unit, C.formatCents(cur.paidSum) + ' no período', JS.graf.chart({ type: 'bars', title: 'Pago', dec: 2, yLabel: 'Pago', height: 150, prefix: 'R$', color: '#2A78D6',
          points: bs.map(function (b, i) { return { label: b.label, v: pb[i] / 100, tip: b.tip }; }) }), 'wallet');
        var cats = Object.keys(catSum).sort(function (a, b) { return catSum[b] - catSum[a]; });
        html += card('Gastos por categoria', 'contas pagas no período', JS.graf.chart({ type: 'hbars', title: 'Gastos por categoria', dec: 2, height: Math.max(80, cats.length * 34 + 8), color: '#2A78D6',
          prefix: 'R$', points: cats.map(function (c) { return { label: c, v: catSum[c] / 100, tip: c }; }) }), 'wallet');
      } else html += emptyCard('Finanças', 'Nenhuma conta paga no período.', 'wallet', 'financeiro', 'Abrir o Financeiro');
    }

    // ----- Cronograma capilar
    if (on('cap')) {
      html += head('cap', 'flower', 'Cronograma capilar');
      if (cur.hair.length) {
        var ht = {};
        cur.hair.forEach(function (e) { var n = R.hairName(e); ht[n] = (ht[n] || 0) + 1; });
        var hk = Object.keys(ht).sort(function (a, b) { return ht[b] - ht[a]; });
        html += card('Tratamentos feitos', cur.hair.length + ' no período', JS.graf.chart({ type: 'hbars', title: 'Tratamentos feitos', dec: 0, height: Math.max(80, hk.length * 34 + 8), color: '#8F6BB3',
          points: hk.map(function (k) { return { label: k, v: ht[k], tip: k }; }) }), 'flower');
      } else html += emptyCard('Cronograma capilar', 'Nenhum tratamento realizado no período.', 'flower', 'autocuidado', 'Abrir o cronograma');
    }
    return html;
  }

  JS.actions['graf-period'] = function (d) {
    if (d.mode === view.period) return;
    var order = PERIODS.map(function (p) { return p[0]; });
    var dir = order.indexOf(d.mode) > order.indexOf(view.period) ? 'r' : 'l';
    view.period = d.mode;
    JS.app.render({ enter: 'view:' + dir });
  };
  JS.actions['graf-mod'] = function (d) {
    if (d.mod === view.mod) return;
    view.mod = d.mod;
    JS.app.render({ enter: 'view' });
  };
  JS.actions['graf-evo'] = function (d) { JS.treinoView.mode = 'evolucao'; if (d && d.id) JS.treinoView.evoEx = d.id; JS.app.go('treino'); };
  JS.telas.graficos = { title: 'Gráficos', render: render };
})();
