/* J.S. — Mais: atalhos para os outros módulos (no celular a barra de baixo tem só 5 abas) */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, B = window.JSCorpo, ui = JS.ui, esc = ui.esc;

  function tile(route, icon, cls, title, line) {
    return '<button type="button" class="mod-tile ' + cls + '" data-action="go" data-route="' + route + '">' +
      '<span class="mod-ic">' + ui.icon(icon, 24) + '</span><span class="mod-txt"><strong>' + esc(title) + '</strong><small>' + esc(line) + '</small></span>' + ui.icon('right', 18) + '</button>';
  }

  function cycleLine(s, today) {
    var Cy = window.JSCiclo, cur = Cy && Cy.enabled(s) ? Cy.current(s, today) : null;
    if (!cur) return 'Menstruação, fases e energia';
    return 'Dia ' + cur.info.day + ' • fase ' + cur.phase.name.toLowerCase() + (cur.late ? ' • atrasada' : cur.inPeriod ? '' : ' • menstruação ' + (cur.daysToNext <= 1 ? (cur.daysToNext ? 'amanhã' : 'hoje') : 'em ' + cur.daysToNext + ' dias'));
  }

  function render(now) {
    var s = JS.store.state, today = C.toDateKey(now);
    var nextHair = R.hairUpcoming(s).filter(function (e) { return e.date >= today; })[0];
    var bills = R.upcomingBills(s, today, 7).length, over = R.overdueBills(s, today).length;
    var L = B.latest(s);
    return '<h1 class="page-title">Mais</h1>' +
      '<div class="mod-grid">' +
      tile('autocuidado', 'flower', 'm-hair', 'Cronograma capilar', nextHair ? 'Próximo: ' + R.hairName(nextHair) + ' • ' + C.formatDayLabel(nextHair.date, today) : 'Monte seu cronograma') +
      tile('financeiro', 'wallet', 'm-bill', 'Financeiro', over ? over + (over === 1 ? ' conta atrasada' : ' contas atrasadas') : bills ? bills + ' conta(s) nos próximos 7 dias' : 'Contas e pagamentos') +
      tile('ciclo', 'moon', 'm-cycle', 'Ciclo menstrual', cycleLine(s, today)) +
      tile('corpo', 'body', 'm-body', 'Corpo', L.weightKg ? 'Peso ' + JS.graf.fmtNum(L.weightKg.value, 1) + ' kg' + (L.muscleKg ? ' • músculo ' + JS.graf.fmtNum(L.muscleKg.value, 1) + ' kg' : '') : 'Bioimpedância e medidas') +
      tile('graficos', 'chart', 'm-chart', 'Gráficos', 'Painel com tudo do J.S.') +
      tile('agenda', 'calendar', 'm-task', 'Agenda', 'Tudo do mês num calendário') +
      tile('config', 'settings', 'm-set', 'Configurações', 'Aparência, avisos, toque atrás, backup') +
      '</div>';
  }

  JS.telas.mais = { title: 'Mais', render: render };
})();
