/*
 * J.S. — regras de negócio e operações sobre os dados.
 * Nenhuma função aqui toca na tela ou no armazenamento: recebem o "state",
 * consultam ou alteram, e podem ser testadas no Node (pasta testes/).
 */
(function (root, factory) {
  var core = root && root.JSCore ? root.JSCore : (typeof require === 'function' ? require('./core.js') : null);
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSRegras = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var SCHEMA_VERSION = 1;
  // Tarefas recorrentes não concluídas contam como atrasadas só nos últimos N dias,
  // para uma tarefa diária esquecida não gerar centenas de pendências.
  var RECURRING_OVERDUE_LOOKBACK = 7;
  // Lembretes perdidos há mais tempo que isso não disparam notificação ao abrir o app.
  var REMINDER_CATCHUP_MS = 2 * 60 * 60 * 1000;

  /* ================= Estado e migrações ================= */

  function emptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      settings: {
        name: 'Julia',
        notifications: { task: true, hair: true, meal: true, bill: true },
        showAmountsInNotifications: false,
        mealHistory: true,
        lastBackupAt: null
      },
      tasks: [],
      taskOcc: {},          // "idTarefa|AAAA-MM-DD" -> { status: 'done'|'skipped', completedAt }
      hairEvents: [],
      meals: [],
      mealExceptions: {},   // "idRefeicao|AAAA-MM-DD" -> { skip: true } | { time: 'HH:MM' }
      mealLogs: [],
      bills: [],
      payments: [],
      firedReminders: {}    // chave do lembrete -> ISO de quando foi exibido
    };
  }

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function hasId(x) { return isObj(x) && typeof x.id === 'string' && x.id.length > 0; }

  function migrate(data) {
    if (!isObj(data)) throw new Error('Arquivo sem dados do J.S.');
    var v = Number(data.schemaVersion) || 0;
    if (v > SCHEMA_VERSION) throw new Error('Este backup foi criado por uma versão mais nova do J.S.');
    var base = emptyState();
    var out = Object.assign({}, base, data);
    out.settings = Object.assign({}, base.settings, isObj(data.settings) ? data.settings : {});
    out.settings.notifications = Object.assign({}, base.settings.notifications,
      isObj(data.settings) && isObj(data.settings.notifications) ? data.settings.notifications : {});
    ['tasks', 'hairEvents', 'meals', 'mealLogs', 'bills', 'payments'].forEach(function (k) {
      out[k] = Array.isArray(out[k]) ? out[k].filter(hasId) : [];
    });
    ['taskOcc', 'mealExceptions', 'firedReminders'].forEach(function (k) { if (!isObj(out[k])) out[k] = {}; });
    out.tasks = out.tasks.filter(function (t) { return typeof t.title === 'string'; });
    out.bills = out.bills.filter(function (b) { return Number.isInteger(b.amountCents) && b.amountCents >= 0 && C.isDateKey(b.dueDate); });
    out.payments = out.payments.filter(function (p) { return Number.isInteger(p.amountCents) && p.amountCents >= 0; });
    out.meals.forEach(function (m) { if (!Array.isArray(m.weekdays)) m.weekdays = [0, 1, 2, 3, 4, 5, 6]; });
    // Próximas versões do esquema entram aqui: if (v < 2) { ... }
    out.schemaVersion = SCHEMA_VERSION;
    return out;
  }

  function hasAnyData(state) {
    return state.tasks.length + state.hairEvents.length + state.meals.length + state.bills.length > 0;
  }

  /* ================= Utilitários de validação ================= */

  function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 500); }
  function optStr(v, max) { var s = str(v, max); return s || null; }
  function intOrNull(v) {
    if (v === '' || v == null || v === 'null') return null;
    var n = Number(v);
    return Number.isInteger(n) ? n : null;
  }
  function result(errors, value) { return { ok: Object.keys(errors).length === 0, errors: errors, value: value }; }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function removeById(list, id) { var i = list.findIndex(function (x) { return x.id === id; }); if (i >= 0) list.splice(i, 1); }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  /* ================= Rotina / tarefas ================= */

  function validateTask(input) {
    var e = {};
    var v = {
      title: str(input.title, 120),
      description: optStr(input.description, 1000),
      category: C.TASK_CATEGORIES.indexOf(input.category) >= 0 ? input.category : 'Outros',
      priority: C.PRIORITIES[input.priority] ? input.priority : 'normal',
      dueDate: optStr(input.dueDate, 10),
      dueTime: optStr(input.dueTime, 5),
      recurrence: C.TASK_RECURRENCES[input.recurrence] ? input.recurrence : 'none',
      reminderMinutes: intOrNull(input.reminderMinutes)
    };
    if (!v.title) e.title = 'Informe o título.';
    if (v.dueDate && !C.isDateKey(v.dueDate)) e.dueDate = 'Data inválida.';
    if (v.dueTime && !C.isTimeKey(v.dueTime)) e.dueTime = 'Horário inválido.';
    if (v.dueTime && !v.dueDate) e.dueDate = 'Escolha a data para usar um horário.';
    if (v.recurrence !== 'none' && !v.dueDate) e.recurrence = 'Escolha a data de início para repetir.';
    if (v.reminderMinutes != null && (v.reminderMinutes < 0 || v.reminderMinutes > 10080)) e.reminderMinutes = 'Lembrete inválido.';
    else if (v.reminderMinutes != null && !v.dueTime) e.reminderMinutes = 'Defina um horário para receber o lembrete.';
    return result(e, v);
  }

  function occKey(taskId, date) { return taskId + '|' + (date || 'sem-data'); }

  function taskOccursOn(t, d) {
    if (!t.dueDate || t.status === 'cancelled') return false;
    if (d < t.dueDate) return false;
    if (t.endDate && d > t.endDate) return false;
    switch (t.recurrence || 'none') {
      case 'none': return d === t.dueDate;
      case 'daily': return true;
      case 'weekdays': { var w = C.weekday(d); return w >= 1 && w <= 5; }
      case 'weekly': return C.weekday(d) === C.weekday(t.dueDate);
      case 'monthly': {
        var anchor = Number(t.dueDate.slice(8));
        var p = d.split('-').map(Number);
        return p[2] === Math.min(anchor, C.daysInMonth(p[0], p[1] - 1));
      }
    }
    return false;
  }

  function occOf(state, t, date) {
    var key = occKey(t.id, date);
    var o = state.taskOcc[key];
    return {
      task: t, date: date, time: date ? (t.dueTime || null) : null, key: key,
      done: !!(o && o.status === 'done'), completedAt: o && o.completedAt || null
    };
  }

  function sortOccurrences(list) {
    var prio = { high: 0, normal: 1, low: 2 };
    return list.sort(function (a, b) {
      return cmp(a.date || '', b.date || '') ||
        cmp(a.time ? 1 : 0, b.time ? 1 : 0) || // sem horário primeiro (dia todo)
        cmp(a.time || '', b.time || '') ||
        cmp(prio[a.task.priority] || 1, prio[b.task.priority] || 1) ||
        cmp(a.task.title.toLowerCase(), b.task.title.toLowerCase());
    });
  }

  // Ocorrências (datadas) entre from e to, inclusive. Ocorrências puladas não aparecem.
  function taskOccurrences(state, from, to) {
    var out = [];
    state.tasks.forEach(function (t) {
      if (!t.dueDate || t.status === 'cancelled' || t.dueDate > to) return;
      if (t.endDate && t.endDate < from) return;
      if ((t.recurrence || 'none') === 'none') {
        if (t.dueDate >= from && !isSkipped(state, t.id, t.dueDate)) out.push(occOf(state, t, t.dueDate));
        return;
      }
      var d = t.dueDate > from ? t.dueDate : from;
      var end = t.endDate && t.endDate < to ? t.endDate : to;
      for (; d <= end; d = C.addDays(d, 1)) {
        if (taskOccursOn(t, d) && !isSkipped(state, t.id, d)) out.push(occOf(state, t, d));
      }
    });
    return sortOccurrences(out);
  }

  function undatedTasks(state) {
    return sortOccurrences(state.tasks
      .filter(function (t) { return !t.dueDate && t.status !== 'cancelled'; })
      .map(function (t) { return occOf(state, t, null); }));
  }

  function isSkipped(state, taskId, date) {
    var o = state.taskOcc[occKey(taskId, date)];
    return !!(o && o.status === 'skipped');
  }

  function isPast(date, time, now) {
    var today = C.toDateKey(now);
    if (date < today) return true;
    if (date > today) return false;
    return !!time && time < C.toTimeKey(now);
  }

  function overdueTasks(state, now) {
    var today = C.toDateKey(now);
    var out = [];
    state.tasks.forEach(function (t) {
      if (!t.dueDate || t.status === 'cancelled' || t.dueDate > today) return;
      if ((t.recurrence || 'none') === 'none') {
        if (isSkipped(state, t.id, t.dueDate)) return;
        var o = occOf(state, t, t.dueDate);
        if (!o.done && isPast(o.date, o.time, now)) out.push(o);
        return;
      }
      var from = C.addDays(today, -RECURRING_OVERDUE_LOOKBACK);
      var d = t.dueDate > from ? t.dueDate : from;
      for (; d <= today; d = C.addDays(d, 1)) {
        if (!taskOccursOn(t, d) || isSkipped(state, t.id, d)) continue;
        var oc = occOf(state, t, d);
        if (!oc.done && isPast(oc.date, oc.time, now)) out.push(oc);
      }
    });
    return sortOccurrences(out);
  }

  function newTaskFrom(v, nowISO, extra) {
    return Object.assign({
      id: C.uuid(), title: v.title, description: v.description, category: v.category, priority: v.priority,
      dueDate: v.dueDate, dueTime: v.dueTime, recurrence: v.recurrence, reminderMinutes: v.reminderMinutes,
      endDate: null, seriesId: v.recurrence !== 'none' ? C.uuid() : null, status: 'active',
      createdAt: nowISO, updatedAt: nowISO
    }, extra || {});
  }

  function createTask(state, v, nowISO) {
    var t = newTaskFrom(v, nowISO);
    state.tasks.push(t);
    return t;
  }

  function setTaskDone(state, taskId, date, done, nowISO) {
    var key = occKey(taskId, date);
    if (done) state.taskOcc[key] = { status: 'done', completedAt: nowISO };
    else if (state.taskOcc[key] && state.taskOcc[key].status === 'done') delete state.taskOcc[key];
  }

  function skipTaskOccurrence(state, taskId, date) {
    state.taskOcc[occKey(taskId, date)] = { status: 'skipped' };
  }

  function moveOccState(state, fromKey, toKey) {
    if (fromKey === toKey) return;
    if (state.taskOcc[fromKey]) { state.taskOcc[toKey] = state.taskOcc[fromKey]; delete state.taskOcc[fromKey]; }
  }

  // Adiar: em tarefa única muda a data; em recorrente, pula só esta ocorrência
  // e cria uma tarefa avulsa na nova data (as próximas ocorrências não mudam).
  function postponeTask(state, taskId, occDate, newDate, newTime, nowISO) {
    var t = byId(state.tasks, taskId);
    if (!t) return null;
    if ((t.recurrence || 'none') === 'none') {
      moveOccState(state, occKey(t.id, t.dueDate), occKey(t.id, newDate));
      t.dueDate = newDate; t.dueTime = newTime || null;
      if (!t.dueTime) t.reminderMinutes = null;
      t.updatedAt = nowISO;
      return t;
    }
    skipTaskOccurrence(state, t.id, occDate);
    var copy = newTaskFrom({
      title: t.title, description: t.description, category: t.category, priority: t.priority,
      dueDate: newDate, dueTime: newTime || null, recurrence: 'none',
      reminderMinutes: newTime ? t.reminderMinutes : null
    }, nowISO, { postponedFrom: { taskId: t.id, date: occDate } });
    state.tasks.push(copy);
    return copy;
  }

  // scope: 'all' (tarefa inteira), 'this' (só esta ocorrência), 'future' (esta e as próximas).
  function updateTask(state, taskId, v, scope, occDate, nowISO) {
    var t = byId(state.tasks, taskId);
    if (!t) return null;
    var recurring = (t.recurrence || 'none') !== 'none';
    if (recurring && scope === 'this' && occDate) {
      skipTaskOccurrence(state, t.id, occDate);
      var single = newTaskFrom(Object.assign({}, v, { recurrence: 'none' }), nowISO);
      state.tasks.push(single);
      return single;
    }
    if (recurring && scope === 'future' && occDate && occDate > t.dueDate) {
      t.endDate = C.addDays(occDate, -1);
      t.updatedAt = nowISO;
      var cont = newTaskFrom(v, nowISO, { seriesId: v.recurrence !== 'none' ? (t.seriesId || C.uuid()) : null });
      state.tasks.push(cont);
      return cont;
    }
    if (!recurring) moveOccState(state, occKey(t.id, t.dueDate), occKey(t.id, v.dueDate));
    ['title', 'description', 'category', 'priority', 'dueDate', 'dueTime', 'recurrence', 'reminderMinutes'].forEach(function (k) { t[k] = v[k]; });
    if (t.recurrence === 'none') t.endDate = null;
    else if (!t.seriesId) t.seriesId = C.uuid();
    t.updatedAt = nowISO;
    return t;
  }

  function deleteTask(state, taskId) {
    removeById(state.tasks, taskId);
    Object.keys(state.taskOcc).forEach(function (k) { if (k.indexOf(taskId + '|') === 0) delete state.taskOcc[k]; });
  }

  function deleteTaskSeries(state, taskId) {
    var t = byId(state.tasks, taskId);
    if (!t) return;
    var ids = t.seriesId
      ? state.tasks.filter(function (x) { return x.seriesId === t.seriesId; }).map(function (x) { return x.id; })
      : [t.id];
    ids.forEach(function (id) { deleteTask(state, id); });
  }

  /* ================= Autocuidado / cronograma capilar ================= */

  function validateHair(input) {
    var e = {};
    var v = {
      type: C.HAIR_TYPES[input.type] ? input.type : null,
      customName: optStr(input.customName, 60),
      date: optStr(input.date, 10),
      time: optStr(input.time, 5),
      products: optStr(input.products, 500),
      notes: optStr(input.notes, 1000),
      reminderMinutes: intOrNull(input.reminderMinutes)
    };
    if (!v.type) e.type = 'Escolha o tipo de tratamento.';
    if (v.type === 'custom' && !v.customName) e.customName = 'Dê um nome ao tratamento personalizado.';
    if (v.type !== 'custom') v.customName = null;
    if (!v.date || !C.isDateKey(v.date)) e.date = 'Escolha a data.';
    if (v.time && !C.isTimeKey(v.time)) e.time = 'Horário inválido.';
    if (v.reminderMinutes != null && !v.time) e.reminderMinutes = 'Defina um horário para receber o lembrete.';
    return result(e, v);
  }

  function hairPending(e) { return e.status === 'planned' || e.status === 'postponed'; }
  function hairName(e) { return e.type === 'custom' ? (e.customName || 'Personalizado') : C.HAIR_TYPES[e.type] || 'Tratamento'; }

  function createHairEvent(state, v, nowISO) {
    var ev = {
      id: C.uuid(), type: v.type, customName: v.customName, date: v.date, time: v.time,
      products: v.products, notes: v.notes, reminderMinutes: v.reminderMinutes,
      status: 'planned', completedAt: null, originalDate: null, originalTime: null,
      createdAt: nowISO, updatedAt: nowISO
    };
    state.hairEvents.push(ev);
    return ev;
  }

  function updateHairEvent(state, id, v, nowISO) {
    var ev = byId(state.hairEvents, id);
    if (!ev) return null;
    ev.type = v.type; ev.customName = v.customName; ev.products = v.products; ev.notes = v.notes;
    // Tratamento já realizado mantém a data planejada original no histórico.
    if (ev.status !== 'completed') { ev.date = v.date; ev.time = v.time; ev.reminderMinutes = v.reminderMinutes; }
    ev.updatedAt = nowISO;
    return ev;
  }

  function completeHairEvent(state, id, data, nowISO) {
    var ev = byId(state.hairEvents, id);
    if (!ev) return null;
    ev.status = 'completed';
    ev.completedAt = data.completedAt || nowISO;
    if (data.products !== undefined) ev.products = data.products;
    if (data.notes !== undefined) ev.notes = data.notes;
    ev.updatedAt = nowISO;
    return ev;
  }

  function undoHairCompletion(state, id, nowISO) {
    var ev = byId(state.hairEvents, id);
    if (!ev) return null;
    ev.status = ev.originalDate ? 'postponed' : 'planned';
    ev.completedAt = null;
    ev.updatedAt = nowISO;
    return ev;
  }

  function rescheduleHairEvent(state, id, date, time, nowISO) {
    var ev = byId(state.hairEvents, id);
    if (!ev) return null;
    if (!ev.originalDate) { ev.originalDate = ev.date; ev.originalTime = ev.time; }
    ev.date = date; ev.time = time || null;
    if (!ev.time) ev.reminderMinutes = null;
    ev.status = 'postponed';
    ev.updatedAt = nowISO;
    return ev;
  }

  function deleteHairEvent(state, id) { removeById(state.hairEvents, id); }

  // Gera eventos a partir do que a usuária escolheu: dias da semana, horário,
  // quantidade de semanas e a sequência que se repete. Nenhuma frequência é imposta.
  function planHairSchedule(input) {
    var e = {};
    var weekdays = (input.weekdays || []).map(Number).filter(function (n) { return n >= 0 && n <= 6; });
    var sequence = (input.sequence || []).filter(function (s) { return C.HAIR_TYPES[s]; });
    var weeks = Number(input.weeks);
    var time = optStr(input.time, 5);
    var reminder = intOrNull(input.reminderMinutes);
    var customName = optStr(input.customName, 60);
    if (!C.isDateKey(input.startDate)) e.startDate = 'Escolha a data de início.';
    if (!weekdays.length) e.weekdays = 'Escolha pelo menos um dia da semana.';
    if (!sequence.length) e.sequence = 'Escolha pelo menos um tratamento.';
    if (!(weeks >= 1 && weeks <= 12)) e.weeks = 'Escolha de 1 a 12 semanas.';
    if (time && !C.isTimeKey(time)) e.time = 'Horário inválido.';
    if (reminder != null && !time) e.reminderMinutes = 'Defina um horário para receber o lembrete.';
    if (sequence.indexOf('custom') >= 0 && !customName) e.customName = 'Dê um nome ao tratamento personalizado.';
    if (Object.keys(e).length) return result(e, []);
    var out = [];
    var end = C.addDays(input.startDate, weeks * 7 - 1);
    var i = 0;
    for (var d = input.startDate; d <= end; d = C.addDays(d, 1)) {
      if (weekdays.indexOf(C.weekday(d)) < 0) continue;
      var type = sequence[i % sequence.length];
      out.push({ type: type, customName: type === 'custom' ? customName : null, date: d, time: time,
        products: null, notes: null, reminderMinutes: reminder });
      i++;
    }
    return result(e, out);
  }

  function hairUpcoming(state) {
    return state.hairEvents.filter(hairPending).sort(function (a, b) {
      return cmp(a.date, b.date) || cmp(a.time || '', b.time || '');
    });
  }
  function hairHistory(state) {
    return state.hairEvents.filter(function (e) { return e.status === 'completed'; })
      .sort(function (a, b) { return cmp(b.completedAt || '', a.completedAt || ''); });
  }

  /* ================= Alimentação ================= */

  function validateMeal(input) {
    var e = {};
    var type = C.MEAL_TYPES[input.type] ? input.type : 'other';
    var weekdays = (Array.isArray(input.weekdays) ? input.weekdays : [])
      .map(Number).filter(function (n, i, a) { return n >= 0 && n <= 6 && a.indexOf(n) === i; }).sort();
    var v = {
      name: str(input.name, 60) || C.MEAL_TYPES[type],
      type: type,
      time: optStr(input.time, 5),
      weekdays: weekdays,
      description: optStr(input.description, 500),
      reminderEnabled: input.reminderEnabled === true || input.reminderEnabled === 'on' || input.reminderEnabled === 'true'
    };
    if (!v.time || !C.isTimeKey(v.time)) e.time = 'Escolha o horário.';
    if (!v.weekdays.length) e.weekdays = 'Escolha pelo menos um dia da semana.';
    return result(e, v);
  }

  function createMeal(state, v, nowISO) {
    var m = Object.assign({ id: C.uuid(), enabled: true, createdAt: nowISO, updatedAt: nowISO }, v);
    state.meals.push(m);
    return m;
  }
  function updateMeal(state, id, v, nowISO) {
    var m = byId(state.meals, id);
    if (!m) return null;
    Object.assign(m, v, { updatedAt: nowISO });
    return m;
  }
  function setMealEnabled(state, id, enabled, nowISO) {
    var m = byId(state.meals, id);
    if (m) { m.enabled = !!enabled; m.updatedAt = nowISO; }
    return m;
  }
  function deleteMeal(state, id) {
    removeById(state.meals, id);
    Object.keys(state.mealExceptions).forEach(function (k) { if (k.indexOf(id + '|') === 0) delete state.mealExceptions[k]; });
    state.mealLogs.forEach(function (l) { if (l.mealId === id) l.mealId = null; }); // histórico fica
  }
  function setMealException(state, mealId, date, ex) { state.mealExceptions[mealId + '|' + date] = ex; }
  function clearMealException(state, mealId, date) { delete state.mealExceptions[mealId + '|' + date]; }

  function findMealLog(state, mealId, date) {
    for (var i = 0; i < state.mealLogs.length; i++) {
      var l = state.mealLogs[i];
      if (l.mealId === mealId && l.date === date) return l;
    }
    return null;
  }
  function logMeal(state, mealId, date, nowISO) {
    var m = byId(state.meals, mealId);
    if (!m || findMealLog(state, mealId, date)) return null;
    var l = { id: C.uuid(), mealId: mealId, mealName: m.name, date: date, completedAt: nowISO };
    state.mealLogs.push(l);
    return l;
  }
  function unlogMeal(state, mealId, date) {
    var l = findMealLog(state, mealId, date);
    if (l) removeById(state.mealLogs, l.id);
  }

  function mealOccurrencesOn(state, date) {
    var w = C.weekday(date);
    return state.meals.filter(function (m) { return m.enabled && m.weekdays.indexOf(w) >= 0; })
      .map(function (m) {
        var ex = state.mealExceptions[m.id + '|' + date] || null;
        return {
          meal: m, date: date, time: (ex && ex.time) || m.time, originalTime: m.time,
          skipped: !!(ex && ex.skip), changed: !!(ex && ex.time), done: !!findMealLog(state, m.id, date)
        };
      })
      .sort(function (a, b) { return cmp(a.time, b.time) || cmp(a.meal.name, b.meal.name); });
  }

  function nextMeal(state, now) {
    var today = C.toDateKey(now), nowT = C.toTimeKey(now);
    for (var i = 0; i < 8; i++) {
      var d = C.addDays(today, i);
      var list = mealOccurrencesOn(state, d).filter(function (o) { return !o.skipped && !o.done && (i > 0 || o.time >= nowT); });
      if (list.length) return list[0];
    }
    return null;
  }

  /* ================= Financeiro ================= */

  function validateBill(input) {
    var e = {};
    var cents = C.parseMoneyToCents(input.amount);
    var v = {
      title: str(input.title, 80),
      amountCents: cents,
      category: C.BILL_CATEGORIES.indexOf(input.category) >= 0 ? input.category : 'Outros',
      dueDate: optStr(input.dueDate, 10),
      recurrence: C.BILL_RECURRENCES[input.recurrence] ? input.recurrence : 'once',
      paymentMethod: C.PAYMENT_METHODS.indexOf(input.paymentMethod) >= 0 ? input.paymentMethod : null,
      notes: optStr(input.notes, 500),
      reminderDaysBefore: intOrNull(input.reminderDaysBefore),
      reminderTime: optStr(input.reminderTime, 5) || '09:00'
    };
    if (!v.title) e.title = 'Informe o nome da conta.';
    if (cents == null) e.amount = 'Valor inválido. Exemplo: 150,90';
    else if (cents > 100000000000) e.amount = 'Valor muito alto.';
    if (!v.dueDate || !C.isDateKey(v.dueDate)) e.dueDate = 'Escolha o vencimento.';
    if (!C.isTimeKey(v.reminderTime)) e.reminderTime = 'Horário inválido.';
    if (v.reminderDaysBefore != null && (v.reminderDaysBefore < 0 || v.reminderDaysBefore > 30)) e.reminderDaysBefore = 'Antecedência inválida.';
    return result(e, v);
  }

  function validatePayment(input, today) {
    var e = {};
    var cents = C.parseMoneyToCents(input.amount);
    var v = { amountCents: cents, paidAt: optStr(input.paidAt, 10) || today, notes: optStr(input.notes, 300) };
    if (cents == null) e.amount = 'Valor inválido. Exemplo: 150,90';
    if (!C.isDateKey(v.paidAt)) e.paidAt = 'Data inválida.';
    return result(e, v);
  }

  function billStatus(b, today) { return b.status === 'pending' && b.dueDate < today ? 'overdue' : b.status; }

  function nextDueDate(b) {
    switch (b.recurrence) {
      case 'weekly': return C.addDays(b.dueDate, 7);
      case 'monthly': return C.addMonths(b.dueDate, 1, b.anchorDay || Number(b.dueDate.slice(8)));
      case 'yearly': return C.addYears(b.dueDate, 1);
    }
    return null;
  }

  function createBill(state, v, nowISO) {
    var b = Object.assign({}, v, {
      id: C.uuid(), status: 'pending', paidAt: null,
      seriesId: v.recurrence !== 'once' ? C.uuid() : null,
      anchorDay: Number(v.dueDate.slice(8)), recurrenceEnded: false,
      createdAt: nowISO, updatedAt: nowISO
    });
    state.bills.push(b);
    return b;
  }

  function seriesBills(state, seriesId) {
    return seriesId ? state.bills.filter(function (b) { return b.seriesId === seriesId; }) : [];
  }

  var PROPAGATED_FIELDS = ['title', 'amountCents', 'category', 'paymentMethod', 'reminderDaysBefore', 'reminderTime'];

  // applyToFuture: copia nome, valor, categoria e avisos para as próximas contas
  // pendentes da mesma série. Pagamentos já registrados nunca são alterados.
  function updateBill(state, id, v, applyToFuture, nowISO) {
    var b = byId(state.bills, id);
    if (!b) return null;
    var wasRecurring = b.recurrence !== 'once';
    var dateChanged = b.dueDate !== v.dueDate;
    Object.assign(b, v, { updatedAt: nowISO });
    if (dateChanged) b.anchorDay = Number(v.dueDate.slice(8));
    if (!wasRecurring && v.recurrence !== 'once') {
      b.seriesId = C.uuid(); b.recurrenceEnded = false; b.anchorDay = Number(v.dueDate.slice(8));
    }
    if (wasRecurring && v.recurrence === 'once') {
      endSeries(state, b, nowISO);
      return b;
    }
    if (applyToFuture && b.seriesId) {
      seriesBills(state, b.seriesId).forEach(function (o) {
        if (o.id === b.id || o.status !== 'pending' || o.dueDate <= b.dueDate) return;
        PROPAGATED_FIELDS.forEach(function (k) { o[k] = v[k]; });
        o.recurrence = v.recurrence;
        o.updatedAt = nowISO;
      });
    }
    return b;
  }

  // Encerra a recorrência: contas futuras pendentes da série são canceladas (não apagadas).
  function endSeries(state, b, nowISO) {
    seriesBills(state, b.seriesId).forEach(function (o) {
      o.recurrenceEnded = true;
      if (o.id !== b.id && o.status === 'pending' && o.dueDate > b.dueDate) { o.status = 'cancelled'; o.updatedAt = nowISO; }
    });
  }

  function billPayments(state, billId) {
    return state.payments.filter(function (p) { return p.billId === billId; })
      .sort(function (a, b) { return cmp(b.createdAt || '', a.createdAt || ''); });
  }
  function billPaidCents(state, billId) {
    return state.payments.reduce(function (s, p) { return p.billId === billId && !p.voided ? s + p.amountCents : s; }, 0);
  }

  function payBill(state, id, pay, today, nowISO) {
    var b = byId(state.bills, id);
    if (!b || b.status !== 'pending') return null;
    var p = { id: C.uuid(), billId: b.id, billTitle: b.title, amountCents: pay.amountCents, paidAt: pay.paidAt,
      notes: pay.notes || null, voided: false, createdAt: nowISO };
    state.payments.push(p);
    b.status = 'paid'; b.paidAt = pay.paidAt; b.updatedAt = nowISO;
    ensureRecurringBills(state, today, nowISO);
    return p;
  }

  // Correção explícita: o pagamento continua no histórico, marcado como estornado.
  function reopenBill(state, id, nowISO) {
    var b = byId(state.bills, id);
    if (!b || b.status !== 'paid') return null;
    state.payments.forEach(function (p) { if (p.billId === id && !p.voided) { p.voided = true; p.voidedAt = nowISO; } });
    b.status = 'pending'; b.paidAt = null; b.updatedAt = nowISO;
    return b;
  }

  function cancelBill(state, id, scope, nowISO) {
    var b = byId(state.bills, id);
    if (!b) return null;
    if (b.status === 'pending') b.status = 'cancelled';
    b.updatedAt = nowISO;
    if (scope === 'future' && b.seriesId) endSeries(state, b, nowISO);
    return b;
  }

  function restoreBill(state, id, nowISO) {
    var b = byId(state.bills, id);
    if (!b || b.status !== 'cancelled') return null;
    b.status = 'pending'; b.updatedAt = nowISO;
    return b;
  }

  // Só exclui contas sem pagamentos; com histórico, o caminho é cancelar.
  function deleteBill(state, id) {
    if (state.payments.some(function (p) { return p.billId === id; })) return false;
    removeById(state.bills, id);
    return true;
  }

  // Gera a próxima conta de cada série recorrente, sem duplicar: quando a última
  // foi paga/cancelada, ou quando já venceu (para o mês seguinte não sumir).
  function ensureRecurringBills(state, today, nowISO) {
    var series = {};
    state.bills.forEach(function (b) { if (b.seriesId) (series[b.seriesId] = series[b.seriesId] || []).push(b); });
    var created = 0;
    Object.keys(series).forEach(function (sid) {
      var list = series[sid];
      if (list.some(function (b) { return b.recurrenceEnded; })) return;
      var latest = list.reduce(function (a, b) { return b.dueDate > a.dueDate ? b : a; });
      if (latest.recurrence === 'once') return;
      var guard = 0;
      while ((latest.status !== 'pending' || latest.dueDate < today) && guard < 60) {
        var nd = nextDueDate(latest);
        if (!nd || list.some(function (b) { return b.dueDate === nd; })) break;
        var nb = {
          id: C.uuid(), title: latest.title, amountCents: latest.amountCents, category: latest.category,
          dueDate: nd, recurrence: latest.recurrence, paymentMethod: latest.paymentMethod, notes: null,
          reminderDaysBefore: latest.reminderDaysBefore, reminderTime: latest.reminderTime,
          status: 'pending', paidAt: null, seriesId: sid, anchorDay: latest.anchorDay,
          recurrenceEnded: false, generated: true, createdAt: nowISO, updatedAt: nowISO
        };
        state.bills.push(nb); list.push(nb); latest = nb; created++; guard++;
      }
    });
    return created;
  }

  function billsInMonth(state, mk, category) {
    return state.bills.filter(function (b) { return C.monthOf(b.dueDate) === mk && (!category || b.category === category); })
      .sort(function (a, b) { return cmp(a.dueDate, b.dueDate) || cmp(a.title, b.title); });
  }

  function monthSummary(state, mk, category, today) {
    var s = { expected: 0, paid: 0, pending: 0, overdue: 0, count: 0, countPaid: 0, countPending: 0, countOverdue: 0 };
    billsInMonth(state, mk, category).forEach(function (b) {
      if (b.status === 'cancelled') return;
      s.count++;
      s.expected += b.amountCents;
      var st = billStatus(b, today);
      if (st === 'paid') { s.paid += billPaidCents(state, b.id); s.countPaid++; }
      else if (st === 'overdue') { s.overdue += b.amountCents; s.countOverdue++; }
      else { s.pending += b.amountCents; s.countPending++; }
    });
    return s;
  }

  function overdueBills(state, today) {
    return state.bills.filter(function (b) { return billStatus(b, today) === 'overdue'; })
      .sort(function (a, b) { return cmp(a.dueDate, b.dueDate); });
  }
  function upcomingBills(state, today, days) {
    var end = C.addDays(today, days);
    return state.bills.filter(function (b) { return b.status === 'pending' && b.dueDate >= today && b.dueDate <= end; })
      .sort(function (a, b) { return cmp(a.dueDate, b.dueDate); });
  }

  /* ================= Lembretes ================= */

  // Lista os lembretes de ontem até depois de amanhã, já com texto e chave
  // de idempotência no formato tipo:entidade:AAAA-MM-DDTHH:MM.
  function computeReminders(state, now) {
    var today = C.toDateKey(now);
    return remindersInRange(state, C.addDays(today, -1), C.addDays(today, 2));
  }

  // Lembretes que ainda vão acontecer nos próximos "days" dias (enviados ao servidor
  // para chegarem mesmo com o app fechado). Não inclui os que já passaram.
  function upcomingReminders(state, now, days) {
    var today = C.toDateKey(now);
    var limit = now.getTime() + days * 86400000;
    return remindersInRange(state, today, C.addDays(today, days))
      .filter(function (r) { var t = r.at.getTime(); return t > now.getTime() - 60000 && t <= limit; });
  }

  function remindersInRange(state, from, to) {
    var s = state.settings || {};
    var mods = s.notifications || {};
    var list = [];
    function push(type, id, at, title, body, route) {
      list.push({ key: type + ':' + id + ':' + C.toDateKey(at) + 'T' + C.toTimeKey(at), type: type, at: at, title: title, body: body, route: route });
    }
    function relDay(date, at) {
      var d = C.diffDays(C.toDateKey(at), date);
      return d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : C.formatDayMonth(date);
    }

    if (mods.task !== false) {
      taskOccurrences(state, from, C.addDays(to, 7)).forEach(function (o) {
        if (o.done || !o.time || o.task.reminderMinutes == null) return;
        var at = new Date(C.combine(o.date, o.time).getTime() - o.task.reminderMinutes * 60000);
        if (o.task.reminderMinutes === 0) push('task', o.task.id, at, 'Está na hora: ' + o.task.title, 'Rotina • ' + o.time, 'rotina');
        else push('task', o.task.id, at, 'Lembrete: ' + o.task.title, relDay(o.date, at) + ' às ' + o.time + ' (' + C.minutesLabel(o.task.reminderMinutes) + ')', 'rotina');
      });
    }
    if (mods.hair !== false) {
      state.hairEvents.forEach(function (e) {
        if (!hairPending(e) || !e.time || e.reminderMinutes == null) return;
        var at = new Date(C.combine(e.date, e.time).getTime() - e.reminderMinutes * 60000);
        var dia = relDay(e.date, at);
        var nome = hairName(e);
        var title = e.type === 'custom'
          ? (dia === 'Hoje' ? 'Hoje é dia de ' : dia === 'Amanhã' ? 'Amanhã é dia de ' : dia + ' é dia de ') + nome + '.'
          : (dia === 'Hoje' ? 'Hoje é dia de ' : dia === 'Amanhã' ? 'Amanhã é dia de ' : dia + ' é dia de ') + nome.toLowerCase() + ' capilar.';
        push('hair', e.id, at, title, 'Autocuidado • ' + e.time, 'autocuidado');
      });
    }
    if (mods.meal !== false) {
      var mealDays = [];
      for (var md = from; md <= to; md = C.addDays(md, 1)) mealDays.push(md);
      mealDays.forEach(function (d) {
        mealOccurrencesOn(state, d).forEach(function (o) {
          if (o.skipped || o.done || !o.meal.reminderEnabled) return;
          push('meal', o.meal.id, C.combine(d, o.time), 'Está na hora de ' + o.meal.name + '.', o.meal.description || 'Alimentação • ' + o.time, 'alimentacao');
        });
      });
    }
    if (mods.bill !== false) {
      state.bills.forEach(function (b) {
        if (b.status !== 'pending' || b.reminderDaysBefore == null) return;
        if (b.dueDate < from || b.dueDate > C.addDays(to, 31)) return;
        var body = s.showAmountsInNotifications ? C.formatCents(b.amountCents) : 'Financeiro';
        if (b.reminderDaysBefore > 0) {
          var n = b.reminderDaysBefore;
          push('bill', b.id, C.combine(C.addDays(b.dueDate, -n), b.reminderTime), b.title + ' vence em ' + n + (n === 1 ? ' dia.' : ' dias.'), body, 'financeiro');
        }
        push('bill', b.id, C.combine(b.dueDate, b.reminderTime), 'Hoje vence: ' + b.title, body, 'financeiro');
      });
    }
    return list.sort(function (a, b) { return a.at - b.at; });
  }

  // Lembretes que devem aparecer agora: já chegaram, não estão velhos demais e ainda não foram mostrados.
  function dueReminders(reminders, now, fired, catchupMs) {
    var limit = now.getTime() - (catchupMs == null ? REMINDER_CATCHUP_MS : catchupMs);
    return reminders.filter(function (r) { var t = r.at.getTime(); return t <= now.getTime() && t > limit && !fired[r.key]; });
  }

  function pruneFired(fired, now, days) {
    var limit = now.getTime() - (days || 14) * 86400000;
    Object.keys(fired).forEach(function (k) { if (new Date(fired[k]).getTime() < limit) delete fired[k]; });
  }

  /* ================= Painel e agenda ================= */

  function dashboard(state, now) {
    var today = C.toDateKey(now);
    var todayTasks = taskOccurrences(state, today, today);
    var hairToday = state.hairEvents.filter(function (e) { return hairPending(e) && e.date === today; });
    var nextHair = hairUpcoming(state).filter(function (e) { return e.date >= today; })[0] || null;
    return {
      today: today,
      todayTasks: todayTasks,
      doneCount: todayTasks.filter(function (o) { return o.done; }).length,
      upcomingTasks: taskOccurrences(state, C.addDays(today, 1), C.addDays(today, 7)).filter(function (o) { return !o.done; }).slice(0, 5),
      overdueTasks: overdueTasks(state, now).filter(function (o) { return o.date < today; }),
      hairToday: hairToday,
      nextHair: nextHair,
      overdueHair: state.hairEvents.filter(function (e) { return hairPending(e) && e.date < today; }),
      nextMeal: nextMeal(state, now),
      billsSoon: upcomingBills(state, today, 7),
      overdueBills: overdueBills(state, today)
    };
  }

  function agendaForDate(state, date) {
    return {
      tasks: taskOccurrences(state, date, date),
      hair: state.hairEvents.filter(function (e) { return e.date === date; })
        .sort(function (a, b) { return cmp(a.time || '', b.time || ''); }),
      meals: mealOccurrencesOn(state, date).filter(function (o) { return !o.skipped; }),
      bills: state.bills.filter(function (b) { return b.dueDate === date && b.status !== 'cancelled'; })
    };
  }

  function agendaMarkers(state, mk) {
    var r = C.monthRange(mk);
    var marks = {};
    function mark(d, k) { (marks[d] = marks[d] || { task: 0, hair: 0, meal: 0, bill: 0 })[k]++; }
    taskOccurrences(state, r.from, r.to).forEach(function (o) { mark(o.date, 'task'); });
    state.hairEvents.forEach(function (e) { if (C.monthOf(e.date) === mk) mark(e.date, 'hair'); });
    state.bills.forEach(function (b) { if (b.status !== 'cancelled' && C.monthOf(b.dueDate) === mk) mark(b.dueDate, 'bill'); });
    for (var d = r.from; d <= r.to; d = C.addDays(d, 1)) {
      var n = mealOccurrencesOn(state, d).filter(function (o) { return !o.skipped; }).length;
      for (var i = 0; i < n; i++) mark(d, 'meal');
    }
    return marks;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION, RECURRING_OVERDUE_LOOKBACK: RECURRING_OVERDUE_LOOKBACK,
    emptyState: emptyState, migrate: migrate, hasAnyData: hasAnyData, byId: byId,
    // tarefas
    validateTask: validateTask, occKey: occKey, taskOccursOn: taskOccursOn, taskOccurrences: taskOccurrences,
    undatedTasks: undatedTasks, overdueTasks: overdueTasks, isPast: isPast, createTask: createTask,
    setTaskDone: setTaskDone, skipTaskOccurrence: skipTaskOccurrence, postponeTask: postponeTask,
    updateTask: updateTask, deleteTask: deleteTask, deleteTaskSeries: deleteTaskSeries,
    // autocuidado
    validateHair: validateHair, hairPending: hairPending, hairName: hairName, createHairEvent: createHairEvent,
    updateHairEvent: updateHairEvent, completeHairEvent: completeHairEvent, undoHairCompletion: undoHairCompletion,
    rescheduleHairEvent: rescheduleHairEvent, deleteHairEvent: deleteHairEvent, planHairSchedule: planHairSchedule,
    hairUpcoming: hairUpcoming, hairHistory: hairHistory,
    // alimentação
    validateMeal: validateMeal, createMeal: createMeal, updateMeal: updateMeal, setMealEnabled: setMealEnabled,
    deleteMeal: deleteMeal, setMealException: setMealException, clearMealException: clearMealException,
    logMeal: logMeal, unlogMeal: unlogMeal, mealOccurrencesOn: mealOccurrencesOn, nextMeal: nextMeal,
    // financeiro
    validateBill: validateBill, validatePayment: validatePayment, billStatus: billStatus, nextDueDate: nextDueDate,
    createBill: createBill, updateBill: updateBill, payBill: payBill, reopenBill: reopenBill, cancelBill: cancelBill,
    restoreBill: restoreBill, deleteBill: deleteBill, ensureRecurringBills: ensureRecurringBills,
    billPayments: billPayments, billPaidCents: billPaidCents, billsInMonth: billsInMonth,
    monthSummary: monthSummary, overdueBills: overdueBills, upcomingBills: upcomingBills, seriesBills: seriesBills,
    // lembretes, painel e agenda
    computeReminders: computeReminders, upcomingReminders: upcomingReminders, dueReminders: dueReminders, pruneFired: pruneFired,
    dashboard: dashboard, agendaForDate: agendaForDate, agendaMarkers: agendaMarkers
  };
});
