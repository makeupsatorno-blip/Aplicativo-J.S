/*
 * J.S. — utilitários puros: datas (sempre no fuso local), dinheiro em centavos,
 * identificadores e rótulos. Funciona no navegador (window.JSCore) e no Node (testes).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- Datas ----------------
   * Datas do calendário são guardadas como "AAAA-MM-DD" e horários como "HH:MM",
   * sempre interpretados no fuso do aparelho. Carimbos de tempo (criado em, pago em)
   * usam ISO 8601 completo.
   */
  function pad(n) { return String(n).padStart(2, '0'); }
  function toDateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function toTimeKey(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function isDateKey(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2], 12);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }
  function isTimeKey(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }

  // Meio-dia evita problemas em dias com mudança de horário de verão.
  function parseDateKey(key) { var p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function combine(dateKey, timeKey) {
    var d = parseDateKey(dateKey);
    if (timeKey) { var t = timeKey.split(':').map(Number); d.setHours(t[0], t[1], 0, 0); }
    else d.setHours(0, 0, 0, 0);
    return d;
  }
  function addDays(key, n) { var d = parseDateKey(key); d.setDate(d.getDate() + n); return toDateKey(d); }
  function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
  // anchorDay preserva o dia original (31/01 -> 28/02 -> 31/03).
  function addMonths(key, n, anchorDay) {
    var p = key.split('-').map(Number);
    var total = (p[1] - 1) + n;
    var y = p[0] + Math.floor(total / 12);
    var m0 = ((total % 12) + 12) % 12;
    var day = Math.min(anchorDay || p[2], daysInMonth(y, m0));
    return y + '-' + pad(m0 + 1) + '-' + pad(day);
  }
  function addYears(key, n) {
    var p = key.split('-').map(Number);
    var y = p[0] + n;
    return y + '-' + pad(p[1]) + '-' + pad(Math.min(p[2], daysInMonth(y, p[1] - 1)));
  }
  function weekday(key) { return parseDateKey(key).getDay(); }
  // Quantos dias de a até b (b - a).
  function diffDays(a, b) {
    var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }
  function monthOf(key) { return key.slice(0, 7); }
  function addMonthKey(mk, n) { return addMonths(mk + '-01', n).slice(0, 7); }
  function monthRange(mk) {
    var p = mk.split('-').map(Number);
    return { from: mk + '-01', to: mk + '-' + pad(daysInMonth(p[0], p[1] - 1)) };
  }

  /* ---------------- Dinheiro ----------------
   * Valores são sempre inteiros em centavos. Nunca usar ponto flutuante para guardar.
   */
  function parseMoneyToCents(input) {
    if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
    var s = String(input == null ? '' : input).replace(/R\$/gi, '').replace(/[\s ]/g, '');
    if (!s || !/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
    var lastC = s.lastIndexOf(','), lastD = s.lastIndexOf('.');
    var decSep = null;
    if (lastC >= 0 && lastD >= 0) decSep = lastC > lastD ? ',' : '.';
    else if (lastC >= 0) decSep = ','; // padrão brasileiro: vírgula decimal
    else if (lastD >= 0) {
      var parts = s.split('.');
      // "12.5" ou "12.50" = decimal; "1.234" = milhar
      decSep = (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) ? '.' : null;
    }
    var intPart = s, decPart = '';
    if (decSep) {
      var idx = s.lastIndexOf(decSep);
      intPart = s.slice(0, idx);
      decPart = s.slice(idx + 1);
      if (/[.,]/.test(decPart) || decPart.length > 2) return null;
    }
    var thouSep = decSep === ',' ? '.' : decSep === '.' ? ',' : (lastD >= 0 ? '.' : null);
    if (thouSep && intPart.indexOf(thouSep) >= 0) {
      var groups = intPart.split(thouSep);
      if (!groups[0] || groups[0].length > 3) return null;
      for (var i = 1; i < groups.length; i++) if (groups[i].length !== 3) return null;
      intPart = groups.join('');
    }
    if (/[.,]/.test(intPart)) return null;
    if (intPart === '') intPart = '0';
    var cents = Number(intPart) * 100 + Number((decPart + '00').slice(0, 2));
    return Number.isSafeInteger(cents) ? cents : null;
  }

  var moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function formatCents(c) { return moneyFmt.format((c || 0) / 100); }
  function centsToInput(c) { c = Math.abs(c || 0); return Math.floor(c / 100) + ',' + pad(c % 100); }

  /* ---------------- Identificadores ---------------- */
  function uuid() {
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && typeof c.randomUUID === 'function') { try { return c.randomUUID(); } catch (e) { /* contexto não seguro */ } }
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ---------------- Formatação de datas ---------------- */
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  var fmtLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  var fmtShortWd = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  var fmtMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  var fmtDateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function formatDateLong(key) { return capitalize(fmtLong.format(parseDateKey(key))); }
  function formatDateBR(key) { var p = key.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function formatDayMonth(key) { var p = key.split('-'); return p[2] + '/' + p[1]; }
  function formatDayLabel(key, today) {
    var d = diffDays(today, key);
    if (d === 0) return 'Hoje';
    if (d === 1) return 'Amanhã';
    if (d === -1) return 'Ontem';
    return capitalize(fmtShortWd.format(parseDateKey(key)).replace(/\./g, ''));
  }
  function formatMonthLabel(mk) { return capitalize(fmtMonth.format(parseDateKey(mk + '-01'))); }
  function formatTimestamp(iso) { try { return fmtDateTime.format(new Date(iso)).replace(',', ' às'); } catch (e) { return ''; } }
  function dueLabel(dueKey, today) {
    var d = diffDays(today, dueKey);
    if (d === 0) return 'vence hoje';
    if (d === 1) return 'vence amanhã';
    if (d > 1) return 'vence em ' + d + ' dias';
    if (d === -1) return 'venceu ontem';
    return 'venceu há ' + (-d) + ' dias';
  }
  function minutesLabel(min) {
    if (min == null) return 'Sem lembrete';
    if (min === 0) return 'Na hora';
    if (min % 1440 === 0) return (min / 1440) + (min === 1440 ? ' dia antes' : ' dias antes');
    if (min % 60 === 0) return (min / 60) + (min === 60 ? ' hora antes' : ' horas antes');
    return min + ' min antes';
  }

  /* ---------------- Rótulos e listas da especificação ---------------- */
  var TASK_CATEGORIES = ['Pessoal', 'Casa', 'Trabalho', 'Saúde/compromissos', 'Compras', 'Outros'];
  var PRIORITIES = { low: 'Baixa', normal: 'Normal', high: 'Alta' };
  var TASK_RECURRENCES = { none: 'Não repete', daily: 'Todo dia', weekdays: 'Dias úteis (seg. a sex.)', weekly: 'Toda semana', monthly: 'Todo mês' };
  var REMINDER_OPTIONS = [[null, 'Sem lembrete'], [0, 'Na hora'], [5, '5 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes'], [120, '2 horas antes'], [1440, '1 dia antes']];
  var HAIR_TYPES = { hydration: 'Hidratação', nutrition: 'Nutrição', reconstruction: 'Reconstrução', custom: 'Personalizado' };
  var HAIR_STATUS = { planned: 'Planejado', completed: 'Realizado', postponed: 'Adiado' };
  var MEAL_TYPES = { breakfast: 'Café da manhã', morning_snack: 'Lanche da manhã', lunch: 'Almoço', afternoon_snack: 'Lanche da tarde', dinner: 'Jantar', supper: 'Ceia', other: 'Outro' };
  var BILL_CATEGORIES = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Beleza', 'Cartão', 'Assinaturas', 'Outros'];
  var BILL_RECURRENCES = { once: 'Única', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' };
  var BILL_STATUS = { pending: 'Pendente', paid: 'Paga', overdue: 'Atrasada', cancelled: 'Cancelada' };
  var PAYMENT_METHODS = ['Pix', 'Boleto', 'Cartão de crédito', 'Cartão de débito', 'Débito automático', 'Dinheiro', 'Outro'];
  var BILL_REMINDER_DAYS = [[null, 'Sem aviso'], [0, 'Só no dia'], [1, '1 dia antes'], [2, '2 dias antes'], [3, '3 dias antes'], [5, '5 dias antes'], [7, '7 dias antes']];
  var WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  var WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return {
    pad: pad, toDateKey: toDateKey, toTimeKey: toTimeKey, isDateKey: isDateKey, isTimeKey: isTimeKey,
    parseDateKey: parseDateKey, combine: combine, addDays: addDays, addMonths: addMonths, addYears: addYears,
    daysInMonth: daysInMonth, weekday: weekday, diffDays: diffDays, monthOf: monthOf, addMonthKey: addMonthKey,
    monthRange: monthRange,
    parseMoneyToCents: parseMoneyToCents, formatCents: formatCents, centsToInput: centsToInput,
    uuid: uuid, capitalize: capitalize,
    formatDateLong: formatDateLong, formatDateBR: formatDateBR, formatDayMonth: formatDayMonth,
    formatDayLabel: formatDayLabel, formatMonthLabel: formatMonthLabel, formatTimestamp: formatTimestamp,
    dueLabel: dueLabel, minutesLabel: minutesLabel,
    TASK_CATEGORIES: TASK_CATEGORIES, PRIORITIES: PRIORITIES, TASK_RECURRENCES: TASK_RECURRENCES,
    REMINDER_OPTIONS: REMINDER_OPTIONS, HAIR_TYPES: HAIR_TYPES, HAIR_STATUS: HAIR_STATUS, MEAL_TYPES: MEAL_TYPES,
    BILL_CATEGORIES: BILL_CATEGORIES, BILL_RECURRENCES: BILL_RECURRENCES, BILL_STATUS: BILL_STATUS,
    PAYMENT_METHODS: PAYMENT_METHODS, BILL_REMINDER_DAYS: BILL_REMINDER_DAYS,
    WEEKDAY_LETTERS: WEEKDAY_LETTERS, WEEKDAY_SHORT: WEEKDAY_SHORT
  };
});
