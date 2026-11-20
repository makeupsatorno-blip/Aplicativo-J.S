/*
 * J.S. — exportação para calendário (.ics, RFC 5545) para abrir no Google Agenda, no Calendário da Apple etc.
 * Módulo puro: roda no navegador e no Node (testes).
 *
 *   JSIcs.montar(state, opcoes, agora) -> { texto, total, porTipo: { tarefas, capilar, contas, refeicoes, treinos } }
 *   JSIcs.build(state, opcoes, agora)  -> texto do arquivo (linhas separadas por CRLF)
 *
 * Opções: { tarefas, capilar, contas, refeicoes, treinos } (verdadeiro por padrão) e { meses: 12 }.
 *
 * O que entra (e o que não entra):
 *  - Janela: de hoje até 12 meses à frente. Horários "flutuantes" (sem fuso): ficam na hora local de quem importa.
 *  - Tarefas únicas ainda não feitas viram um evento. Tarefas que se repetem viram UM evento com repetição
 *    (RRULE) começando na próxima ocorrência. Ocorrências já concluídas ou puladas de tarefas repetidas NÃO são
 *    removidas do calendário (o app guarda isso por data; o calendário não tem como saber).
 *  - Tratamentos capilares pendentes, contas pendentes (o valor só vai no título se "mostrar valor das contas"
 *    nas notificações estiver ligado), horários de refeição (repetidos, sem as exceções de um dia) e a semana
 *    fixa de treino (a troca de ficha só num dia não é exportada).
 *  - Lembretes do app viram alarmes (VALARM) do calendário.
 */
(function (root, factory) {
  var req = typeof require === 'function';
  var C = root && root.JSCore ? root.JSCore : (req ? require('./core.js') : null);
  var R = root && root.JSRegras ? root.JSRegras : (req ? require('./regras.js') : null);
  var api = factory(C, R);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSIcs = api;
})(typeof self !== 'undefined' ? self : this, function (C, R) {
  'use strict';

  var BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  var CRLF = '\r\n';

  /* ---------------- Texto ---------------- */

  function esc(t) {
    return String(t == null ? '' : t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
  }
  // Dobra a linha em 75 octetos (UTF-8), sem cortar um caractere ao meio. As seguintes começam com um espaço.
  function dobrar(line) {
    var out = [], cur = '', bytes = 0, limit = 75;
    for (var i = 0; i < line.length; i++) {
      var cp = line.codePointAt(i), ch = String.fromCodePoint(cp), n = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (cp > 0xFFFF) i++;
      if (bytes + n > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
      cur += ch; bytes += n;
    }
    out.push(cur);
    return out.join(CRLF);
  }

  /* ---------------- Datas ---------------- */

  function d8(key) { return key.replace(/-/g, ''); }
  function dt(key, time) { return d8(key) + 'T' + time.replace(':', '') + '00'; }
  function stamp(now) {
    function p(n) { return C.pad(n); }
    return now.getUTCFullYear() + p(now.getUTCMonth() + 1) + p(now.getUTCDate()) + 'T' + p(now.getUTCHours()) + p(now.getUTCMinutes()) + p(now.getUTCSeconds()) + 'Z';
  }
  function plusMin(key, time, min) {
    var d = C.combine(key, time); d.setMinutes(d.getMinutes() + min);
    return { date: C.toDateKey(d), time: C.toTimeKey(d) };
  }

  /* ---------------- Eventos ---------------- */

  // props: { uid, resumo, descricao, categoria, data, hora, duracao (min), rrule, alarmes: [trigger...], prioridade }
  function evento(p, carimbo) {
    var L = ['BEGIN:VEVENT', 'UID:' + p.uid, 'DTSTAMP:' + carimbo];
    if (p.hora) {
      var fim = plusMin(p.data, p.hora, p.duracao || 30);
      L.push('DTSTART:' + dt(p.data, p.hora), 'DTEND:' + dt(fim.date, fim.time));
    } else {
      L.push('DTSTART;VALUE=DATE:' + d8(p.data), 'DTEND;VALUE=DATE:' + d8(C.addDays(p.data, 1)));
    }
    if (p.rrule) L.push('RRULE:' + p.rrule);
    L.push('SUMMARY:' + esc(p.resumo));
    if (p.descricao) L.push('DESCRIPTION:' + esc(p.descricao));
    if (p.categoria) L.push('CATEGORIES:' + esc(p.categoria));
    if (p.prioridade) L.push('PRIORITY:' + p.prioridade);
    L.push('TRANSP:' + (p.hora ? 'OPAQUE' : 'TRANSPARENT'));
    (p.alarmes || []).forEach(function (trigger) {
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(p.resumo), 'TRIGGER:' + trigger, 'END:VALARM');
    });
    L.push('END:VEVENT');
    return L;
  }
  // "-PT15M" (antes) ou "PT0S" (na hora)
  function antes(min) { return min > 0 ? '-PT' + min + 'M' : 'PT0S'; }
  // Alarme de evento de dia inteiro: dias antes às HH:MM (relativo à meia-noite do dia do evento).
  function alarmeDia(diasAntes, hhmm) {
    var p = hhmm.split(':').map(Number), x = diasAntes * 1440 - (p[0] * 60 + p[1]);
    return x > 0 ? '-PT' + x + 'M' : x === 0 ? 'PT0S' : 'PT' + (-x) + 'M';
  }

  function janela(agora, meses) {
    var hoje = C.toDateKey(agora);
    return { hoje: hoje, fim: C.addMonths(hoje, meses || 12) };
  }
  // UNTIL no mesmo tipo do DTSTART (data ou data-hora flutuante)
  function until(fimKey, comHora) { return 'UNTIL=' + d8(fimKey) + (comHora ? 'T235959' : ''); }
  function primeiraOcorrencia(from, to, ok) {
    for (var d = from; d <= to; d = C.addDays(d, 1)) if (ok(d)) return d;
    return null;
  }
  function minKey(a, b) { return !a ? b : !b ? a : (a < b ? a : b); }

  /* ---------------- Montagem ---------------- */

  function montar(state, opcoes, agora) {
    opcoes = Object.assign({ tarefas: true, capilar: true, contas: true, refeicoes: true, treinos: true, meses: 12 }, opcoes || {});
    agora = agora || new Date();
    var w = janela(agora, opcoes.meses), carimbo = stamp(agora), s = state.settings || {};
    var eventos = [], por = { tarefas: 0, capilar: 0, contas: 0, refeicoes: 0, treinos: 0 };

    function add(tipo, p) { eventos.push(evento(p, carimbo)); por[tipo]++; }

    // Rotina
    if (opcoes.tarefas) {
      (state.tasks || []).forEach(function (t) {
        if (t.status === 'cancelled' || !t.dueDate || !C.isDateKey(t.dueDate)) return;
        var rec = t.recurrence || 'none', alarmes = t.reminderMinutes != null && t.dueTime ? [antes(t.reminderMinutes)] : [];
        var base = { uid: 'js-tarefa-' + t.id + '@julia.js', resumo: t.title, descricao: t.description || '', categoria: t.category || '', hora: t.dueTime || null, duracao: 30, alarmes: alarmes,
          prioridade: t.priority === 'high' ? 1 : t.priority === 'low' ? 9 : 5 };
        if (rec === 'none') {
          var oc = state.taskOcc && state.taskOcc[R.occKey(t.id, t.dueDate)];
          if (t.dueDate < w.hoje || t.dueDate > w.fim || (oc && (oc.status === 'done' || oc.status === 'skipped'))) return;
          add('tarefas', Object.assign(base, { data: t.dueDate }));
          return;
        }
        var from = t.dueDate > w.hoje ? t.dueDate : w.hoje;
        var first = primeiraOcorrencia(from, w.fim, function (d) { return R.taskOccursOn(t, d); });
        if (!first) return;
        var rr;
        if (rec === 'daily') rr = 'FREQ=DAILY';
        else if (rec === 'weekdays') rr = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
        else if (rec === 'weekly') {
          var dias = Array.isArray(t.weekdays) && t.weekdays.length ? t.weekdays.slice().sort() : [C.weekday(t.dueDate)];
          rr = 'FREQ=WEEKLY;BYDAY=' + dias.map(function (d) { return BYDAY[d]; }).join(',');
        } else rr = 'FREQ=MONTHLY;BYMONTHDAY=' + Number(t.dueDate.slice(8));
        var ate = minKey(t.endDate && C.isDateKey(t.endDate) ? t.endDate : null, w.fim);
        add('tarefas', Object.assign(base, { data: first, rrule: rr + ';' + until(ate, !!t.dueTime) }));
      });
    }

    // Cronograma capilar
    if (opcoes.capilar) {
      (state.hairEvents || []).forEach(function (e) {
        if (!R.hairPending(e) || !e.date || e.date < w.hoje || e.date > w.fim) return;
        add('capilar', { uid: 'js-capilar-' + e.id + '@julia.js', resumo: R.hairName(e), descricao: [e.products ? 'Produtos: ' + e.products : '', e.notes || ''].filter(Boolean).join('\n'), categoria: 'Cronograma capilar',
          data: e.date, hora: e.time || null, duracao: 60, alarmes: e.reminderMinutes != null && e.time ? [antes(e.reminderMinutes)] : [] });
      });
    }

    // Contas (valor só aparece se a usuária deixou ligado nas notificações)
    if (opcoes.contas) {
      (state.bills || []).forEach(function (b) {
        if (b.status !== 'pending' || !b.dueDate || b.dueDate < w.hoje || b.dueDate > w.fim) return;
        var hhmm = b.reminderTime || '09:00', al = [];
        if (b.reminderDaysBefore != null) {
          if (b.reminderDaysBefore > 0) al.push(alarmeDia(b.reminderDaysBefore, hhmm));
          al.push(alarmeDia(0, hhmm));
        }
        add('contas', { uid: 'js-conta-' + b.id + '@julia.js', resumo: 'Conta: ' + b.title + (s.showAmountsInNotifications ? ' (' + C.formatCents(b.amountCents) + ')' : ''),
          descricao: [b.category || '', b.paymentMethod ? 'Pagamento: ' + b.paymentMethod : '', b.notes || ''].filter(Boolean).join('\n'), categoria: 'Financeiro', data: b.dueDate, alarmes: al });
      });
    }

    // Horários de refeição (repetem; as exceções de um dia não vão)
    if (opcoes.refeicoes) {
      (state.meals || []).forEach(function (m) {
        if (!m.enabled || !m.time || !C.isTimeKey(m.time)) return;
        var dias = Array.isArray(m.weekdays) && m.weekdays.length ? m.weekdays : [0, 1, 2, 3, 4, 5, 6];
        var first = primeiraOcorrencia(w.hoje, C.addDays(w.hoje, 7), function (d) { return dias.indexOf(C.weekday(d)) >= 0; });
        if (!first) return;
        var rr = dias.length === 7 ? 'FREQ=DAILY' : 'FREQ=WEEKLY;BYDAY=' + dias.slice().sort().map(function (d) { return BYDAY[d]; }).join(',');
        add('refeicoes', { uid: 'js-refeicao-' + m.id + '@julia.js', resumo: m.name, descricao: m.description || '', categoria: 'Alimentação', data: first, hora: m.time, duracao: 30,
          rrule: rr + ';' + until(w.fim, true), alarmes: m.reminderEnabled ? ['PT0S'] : [] });
      });
    }

    // Treinos planejados (semana fixa); fichas iguais em dias diferentes viram um só evento
    if (opcoes.treinos) {
      var wk = state.workout || {}, week = wk.week || {}, porFicha = {};
      Object.keys(week).forEach(function (d) {
        var plan = week[d] && R.byId(state.workoutPlans || [], week[d]);
        if (plan) (porFicha[plan.id] = porFicha[plan.id] || { plan: plan, dias: [] }).dias.push(Number(d));
      });
      Object.keys(porFicha).forEach(function (id) {
        var g = porFicha[id], hhmm = wk.reminderTime && C.isTimeKey(wk.reminderTime) ? wk.reminderTime : null;
        var first = primeiraOcorrencia(w.hoje, C.addDays(w.hoje, 7), function (d) { return g.dias.indexOf(C.weekday(d)) >= 0; });
        if (!first) return;
        var n = (g.plan.items || []).length;
        add('treinos', { uid: 'js-treino-' + g.plan.id + '@julia.js', resumo: 'Treino: ' + g.plan.name, descricao: n + (n === 1 ? ' exercício' : ' exercícios'), categoria: 'Treino', data: first, hora: hhmm, duracao: 60,
          rrule: 'FREQ=WEEKLY;BYDAY=' + g.dias.slice().sort().map(function (d) { return BYDAY[d]; }).join(',') + ';' + until(w.fim, !!hhmm), alarmes: hhmm ? ['PT0S'] : [] });
      });
    }

    var nome = (s.name || '').trim();
    var linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//J.S.//Julia Satorno//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc('J.S.' + (nome ? ' — ' + nome : ''))];
    eventos.forEach(function (ev) { ev.forEach(function (l) { linhas.push(l); }); });
    linhas.push('END:VCALENDAR');
    var texto = linhas.map(dobrar).join(CRLF) + CRLF;
    return { texto: texto, total: eventos.length, porTipo: por };
  }

  function build(state, opcoes, agora) { return montar(state, opcoes, agora).texto; }

  return { montar: montar, build: build, esc: esc, dobrar: dobrar, stamp: stamp };
});
