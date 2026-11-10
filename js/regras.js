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

  var SCHEMA_VERSION = 2;
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
        notifications: { task: true, hair: true, meal: true, bill: true, water: true, cycle: true },
        showAmountsInNotifications: false,
        mealHistory: true,
        lastBackupAt: null,
        body: { heightCm: null, sex: 'f', birthYear: null },
        nutrition: { kcalTarget: null, activity: 'moderada' },
        backTap: { enabled: true, sensitivity: 3, threshold: null },
        // Água: meta (null = automática pelo peso), copo padrão e lembretes de tanto em tanto tempo
        water: { goalMl: null, cupMl: 250, remind: false, every: 120, from: '09:00', to: '21:00' },
        // Ciclo menstrual: médias usadas até existirem ciclos registrados; aviso antes da menstruação
        cycle: { cycleLen: 28, periodLen: 5, remind: true, showInTreino: true }
      },
      tasks: [],
      taskOcc: {},          // "idTarefa|AAAA-MM-DD" -> { status: 'done'|'skipped', completedAt }
      hairEvents: [],
      meals: [],
      mealExceptions: {},   // "idRefeicao|AAAA-MM-DD" -> { skip: true } | { time: 'HH:MM' }
      mealLogs: [],
      bills: [],
      payments: [],
      // Treino (versão 2 dos dados)
      workoutPlans: [],     // fichas: { id, name, color, items: [{ id, exerciseId, sets, reps, load, restSec, notes }] }
      exercises: [],        // exercícios criados pela usuária (a biblioteca padrão fica no código)
      workoutSessions: [],  // treinos feitos/em andamento, com cada série registrada
      workout: { week: emptyWeek(), overrides: {}, reminderTime: null, loadStep: 1 },
      // Corpo (bioimpedância e medidas)
      bodyRecords: [],
      // Diário alimentar
      foodLogs: [],         // { id, date, meal, foodId, name, grams, createdAt }
      customFoods: [],      // alimentos cadastrados pela usuária, valores por 100 g
      foodPortions: {},     // idAlimento -> [{ label, grams }]
      foodFavorites: [],    // ids de alimentos marcados com estrela
      // Água (versão 2.6)
      waterLogs: [],        // { id, date, ml, at }
      // Ciclo menstrual (versão 2.6)
      cyclePeriods: [],     // { id, start, end|null }
      cycleDays: {},        // "AAAA-MM-DD" -> { flow 1-3, energy 1-5, mood 1-5, symptoms: [], note }
      firedReminders: {}    // chave do lembrete -> ISO de quando foi exibido
    };
  }
  // 2.6: cores das fichas mais delicadas (as antigas eram fortes demais).
  var OLD_PLAN_COLORS = { '#2A78D6': '#4F6F9A', '#C98500': '#A85E3C', '#6250D6': '#7A5BA6', '#1B8F66': '#4E7D62', '#E34948': '#8E4C7E' };
  function emptyWeek() { return { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }; }

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function hasId(x) { return isObj(x) && typeof x.id === 'string' && x.id.length > 0; }

  function migrate(data) {
    if (!isObj(data)) throw new Error('Arquivo sem dados do J.S.');
    var v = Number(data.schemaVersion) || 0;
    if (v > SCHEMA_VERSION) throw new Error('Este backup foi criado por uma versão mais nova do J.S.');
    var base = emptyState();
    var out = Object.assign({}, base, data);
    out.settings = Object.assign({}, base.settings, isObj(data.settings) ? data.settings : {});
    var ds = isObj(data.settings) ? data.settings : {};
    ['notifications', 'body', 'nutrition', 'backTap', 'water', 'cycle'].forEach(function (k) {
      out.settings[k] = Object.assign({}, base.settings[k], isObj(ds[k]) ? ds[k] : {});
    });
    ['tasks', 'hairEvents', 'meals', 'mealLogs', 'bills', 'payments',
      'workoutPlans', 'exercises', 'workoutSessions', 'bodyRecords', 'foodLogs', 'customFoods', 'waterLogs', 'cyclePeriods'].forEach(function (k) {
      out[k] = Array.isArray(out[k]) ? out[k].filter(hasId) : [];
    });
    ['taskOcc', 'mealExceptions', 'firedReminders', 'foodPortions', 'cycleDays'].forEach(function (k) { if (!isObj(out[k])) out[k] = {}; });
    out.foodFavorites = Array.isArray(out.foodFavorites) ? out.foodFavorites.filter(function (x, i, a) { return typeof x === 'string' && x && a.indexOf(x) === i; }) : [];
    out.waterLogs = out.waterLogs.filter(function (l) { return C.isDateKey(l.date) && Number(l.ml) > 0; });
    out.cyclePeriods = out.cyclePeriods.filter(function (p) { return C.isDateKey(p.start) && (p.end == null || (C.isDateKey(p.end) && p.end >= p.start)); });
    // v1 -> v2: estruturas de treino, corpo e diário alimentar (os dados antigos ficam iguais).
    var w = isObj(data.workout) ? data.workout : {};
    out.workout = Object.assign({}, base.workout, w);
    out.workout.week = Object.assign(emptyWeek(), isObj(w.week) ? w.week : {});
    if (!isObj(out.workout.overrides)) out.workout.overrides = {};
    out.workoutPlans.forEach(function (p) { if (!Array.isArray(p.items)) p.items = []; if (OLD_PLAN_COLORS[p.color]) p.color = OLD_PLAN_COLORS[p.color]; });
    out.workoutSessions.forEach(function (s) { if (!Array.isArray(s.items)) s.items = []; s.items.forEach(function (i) { if (!Array.isArray(i.sets)) i.sets = []; }); });
    out.foodLogs = out.foodLogs.filter(function (l) { return C.isDateKey(l.date) && Number(l.grams) > 0; });
    out.tasks = out.tasks.filter(function (t) { return typeof t.title === 'string'; });
    out.bills = out.bills.filter(function (b) { return Number.isInteger(b.amountCents) && b.amountCents >= 0 && C.isDateKey(b.dueDate); });
    out.payments = out.payments.filter(function (p) { return Number.isInteger(p.amountCents) && p.amountCents >= 0; });
    out.meals.forEach(function (m) { if (!Array.isArray(m.weekdays)) m.weekdays = [0, 1, 2, 3, 4, 5, 6]; });
    // Próximas versões do esquema entram aqui: if (v < 2) { ... }
    out.schemaVersion = SCHEMA_VERSION;
    return out;
  }

  function hasAnyData(state) {
    return state.tasks.length + state.hairEvents.length + state.meals.length + state.bills.length +
      (state.workoutPlans || []).length + (state.bodyRecords || []).length + (state.foodLogs || []).length +
      (state.waterLogs || []).length + (state.cyclePeriods || []).length > 0;
  }

  // Ficha de treino de um dia: troca feita só naquele dia > ficha fixa do dia da semana.
  // Retorna o id da ficha, 'rest' (descanso marcado) ou null.
  function workoutPlanIdForDate(state, date) {
    var w = state.workout || {};
    var ov = w.overrides && w.overrides[date];
    if (ov) return ov;
    var id = w.week ? w.week[C.weekday(date)] : null;
    return id && byId(state.workoutPlans || [], id) ? id : null;
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
      reminderMinutes: intOrNull(input.reminderMinutes),
      weekdays: null
    };
    // Dias da semana marcados (Seg, Ter...): a tarefa repete toda semana nesses dias.
    var wds = (Array.isArray(input.weekdays) ? input.weekdays : input.weekdays != null && input.weekdays !== '' && typeof input.weekdays !== 'boolean' ? [input.weekdays] : [])
      .map(Number).filter(function (n, i, a) { return n >= 0 && n <= 6 && Number.isInteger(n) && a.indexOf(n) === i; }).sort();
    if (wds.length && v.recurrence === 'none') v.recurrence = 'weekly';
    if (v.recurrence === 'weekly') v.weekdays = wds.length ? wds : (v.dueDate && C.isDateKey(v.dueDate) ? [C.weekday(v.dueDate)] : null);
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
      case 'weekly': return Array.isArray(t.weekdays) && t.weekdays.length
        ? t.weekdays.indexOf(C.weekday(d)) >= 0
        : C.weekday(d) === C.weekday(t.dueDate);
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
      done: !!(o && o.status === 'done'), completedAt: o && o.completedAt || null,
      doing: !!(o && o.status === 'doing'), startedAt: o && o.startedAt || null
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
      weekdays: v.recurrence === 'weekly' && Array.isArray(v.weekdays) ? v.weekdays.slice() : null,
      endDate: null, seriesId: v.recurrence !== 'none' ? C.uuid() : null, status: 'active',
      createdAt: nowISO, updatedAt: nowISO
    }, extra || {});
  }

  function createTask(state, v, nowISO) {
    var t = newTaskFrom(v, nowISO);
    state.tasks.push(t);
    return t;
  }

  // Concluir guarda quando a tarefa foi começada (se foi), para mostrar quanto tempo levou.
  function setTaskDone(state, taskId, date, done, nowISO) {
    var key = occKey(taskId, date), cur = state.taskOcc[key];
    if (done) {
      state.taskOcc[key] = { status: 'done', completedAt: nowISO };
      if (cur && cur.startedAt) state.taskOcc[key].startedAt = cur.startedAt;
    } else if (cur && cur.status === 'done') {
      if (cur.startedAt) state.taskOcc[key] = { status: 'doing', startedAt: cur.startedAt };
      else delete state.taskOcc[key];
    }
  }

  // "Começar agora": a tarefa fica em andamento (com cronômetro) até ser concluída.
  function startTask(state, taskId, date, nowISO) {
    var key = occKey(taskId, date), cur = state.taskOcc[key];
    if (cur && (cur.status === 'done' || cur.status === 'skipped')) return false;
    state.taskOcc[key] = { status: 'doing', startedAt: nowISO };
    return true;
  }
  function stopTask(state, taskId, date) {
    var key = occKey(taskId, date), cur = state.taskOcc[key];
    if (cur && cur.status === 'doing') delete state.taskOcc[key];
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
    t.weekdays = t.recurrence === 'weekly' && Array.isArray(v.weekdays) ? v.weekdays.slice() : null;
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

  /* ================= Água ================= */

  // Atalhos de tamanho do copo; a usuária pode digitar qualquer valor entre CUP_MIN e CUP_MAX ml.
  var WATER_CUPS = [150, 200, 250, 300, 350, 400, 500, 750, 1000];
  var CUP_MIN = 30, CUP_MAX = 2000;
  function formatMl(ml) {
    ml = Math.round(ml || 0);
    if (ml >= 1000) return (Math.round(ml / 100) / 10).toString().replace('.', ',') + ' L';
    return ml + ' ml';
  }
  function latestWeight(state) {
    var recs = (state.bodyRecords || []).filter(function (r) { return Number(r.weightKg) > 0 && C.isDateKey(r.date); })
      .sort(function (a, b) { return cmp(a.date, b.date); });
    return recs.length ? Number(recs[recs.length - 1].weightKg) : null;
  }
  // Meta do dia: a escolhida; sem ela, 35 ml por kg do último peso (entre 1,5 e 4 L); sem peso, 2 L.
  function waterGoal(state) {
    var w = (state.settings && state.settings.water) || {};
    if (Number(w.goalMl) >= 500) return { ml: Math.round(Number(w.goalMl)), source: 'manual' };
    var kg = latestWeight(state);
    if (kg) return { ml: Math.min(4000, Math.max(1500, Math.round(kg * 35 / 50) * 50)), source: 'peso', kg: kg };
    return { ml: 2000, source: 'padrao' };
  }
  function waterCup(state) {
    var c = Math.round(Number(((state.settings || {}).water || {}).cupMl));
    return c >= CUP_MIN && c <= CUP_MAX ? c : 250;
  }
  function waterLogsOn(state, date) {
    return (state.waterLogs || []).filter(function (l) { return l.date === date; }).sort(function (a, b) { return cmp(a.at || '', b.at || ''); });
  }
  function waterTotal(state, date) { return waterLogsOn(state, date).reduce(function (a, l) { return a + Number(l.ml || 0); }, 0); }
  function addWater(state, date, ml, nowISO) {
    ml = Math.round(Number(ml));
    if (!C.isDateKey(date) || !(ml >= 10 && ml <= 3000)) return null;
    var l = { id: C.uuid(), date: date, ml: ml, at: nowISO };
    state.waterLogs.push(l);
    return l;
  }
  // Desfaz o último registro do dia.
  function undoWater(state, date) {
    var list = waterLogsOn(state, date);
    var last = list[list.length - 1];
    if (last) removeById(state.waterLogs, last.id);
    return last || null;
  }
  function waterDays(state, from, to) {
    var out = [];
    for (var d = from; d <= to; d = C.addDays(d, 1)) out.push({ date: d, ml: waterTotal(state, d) });
    return out;
  }
  function validateWaterSettings(input) {
    var e = {};
    var raw = input.goalMl == null ? '' : String(input.goalMl).trim();
    var goal = raw === '' ? null : Math.round(Number(raw.replace(',', '.')));
    var v = {
      goalMl: goal,
      cupMl: Math.round(Number(String(input.cupMl == null ? '' : input.cupMl).replace(',', '.'))),
      remind: input.remind === true || input.remind === 'on' || input.remind === 'true',
      every: [60, 90, 120, 150, 180, 240].indexOf(Number(input.every)) >= 0 ? Number(input.every) : 120,
      from: String(input.from || ''), to: String(input.to || '')
    };
    if (goal != null && !(goal >= 500 && goal <= 6000)) e.goalMl = 'Entre 500 e 6000 ml (ou deixe em branco para a automática).';
    if (!(v.cupMl >= CUP_MIN && v.cupMl <= CUP_MAX)) e.cupMl = 'Digite de ' + CUP_MIN + ' a ' + CUP_MAX + ' ml.';
    if (!C.isTimeKey(v.from)) e.from = 'Escolha o horário.';
    if (!C.isTimeKey(v.to)) e.to = 'Escolha o horário.';
    if (!e.from && !e.to && v.to <= v.from) e.to = 'O fim precisa ser depois do início.';
    return result(e, v);
  }

  // Ciclo menstrual (js/regras-ciclo.js), carregado depois deste arquivo no navegador.
  function cycleApi() {
    if (typeof self !== 'undefined' && self.JSCiclo) return self.JSCiclo;
    if (typeof require === 'function') { try { return require('./regras-ciclo.js'); } catch (e) { return null; } }
    return null;
  }

  /* ================= Lembretes ================= */

  // Lista os lembretes de ontem até depois de amanhã, já com texto e chave
  // de idempotência no formato tipo:entidade:AAAA-MM-DDTHH:MM.
  function computeReminders(state, now) {
    var today = C.toDateKey(now);
    return remindersInRange(state, C.addDays(today, -1), C.addDays(today, 2), { today: today });
  }

  // Lembretes que ainda vão acontecer nos próximos "days" dias (enviados ao servidor
  // para chegarem mesmo com o app fechado). Não inclui os que já passaram.
  function upcomingReminders(state, now, days) {
    var today = C.toDateKey(now);
    var limit = now.getTime() + days * 86400000;
    return remindersInRange(state, today, C.addDays(today, days), { today: today })
      .filter(function (r) { var t = r.at.getTime(); return t > now.getTime() - 60000 && t <= limit; });
  }

  // Todos os lembretes futuros para o servidor de avisos:
  //  - com data marcada (tarefa única, tratamento, conta): em qualquer data, até singleDays à frente;
  //  - que se repetem (tarefa recorrente, refeição): só recurringDays à frente (não têm fim),
  //    renovados toda vez que o app abre.
  var SERVER_RECURRING_DAYS = 90, SERVER_SINGLE_DAYS = 730;
  function futureReminders(state, now, opts) {
    opts = opts || {};
    var recurringDays = opts.recurringDays || SERVER_RECURRING_DAYS;
    var singleDays = opts.singleDays || SERVER_SINGLE_DAYS;
    var today = C.toDateKey(now);
    // Água: só 14 dias à frente (são vários por dia; renovados quando o app abre).
    var near = remindersInRange(state, today, C.addDays(today, recurringDays), { today: today, waterUntil: C.addDays(today, 14) });
    var far = remindersInRange(state, C.addDays(today, recurringDays), C.addDays(today, singleDays), { singleOnly: true, today: today });
    var seen = {}, out = [];
    var min = now.getTime() - 60000, max = now.getTime() + singleDays * 86400000;
    near.concat(far).forEach(function (r) {
      var t = r.at.getTime();
      if (seen[r.key] || t <= min || t > max) return;
      seen[r.key] = true;
      out.push(r);
    });
    return out.sort(function (a, b) { return a.at - b.at; });
  }

  // opts.singleOnly: só lembretes de data marcada (sem tarefas recorrentes e refeições).
  function remindersInRange(state, from, to, opts) {
    var singleOnly = !!(opts && opts.singleOnly);
    if (singleOnly) state = Object.assign({}, state, { tasks: state.tasks.filter(function (t) { return (t.recurrence || 'none') === 'none'; }) });
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
        push('hair', e.id, at, title, 'Cronograma capilar • ' + e.time, 'autocuidado');
      });
    }
    // Treino: aviso no horário escolhido, nos dias que têm ficha (fixa ou trocada no dia).
    var wk = state.workout || {};
    if (mods.workout !== false && !singleOnly && wk.reminderTime && C.isTimeKey(wk.reminderTime)) {
      for (var wd = from; wd <= to; wd = C.addDays(wd, 1)) {
        var pid = workoutPlanIdForDate(state, wd);
        var plan = pid && pid !== 'rest' ? byId(state.workoutPlans || [], pid) : null;
        if (!plan) continue;
        var doneThatDay = (state.workoutSessions || []).some(function (x) { return x.date === wd && x.status === 'done'; });
        if (doneThatDay) continue;
        push('workout', 'dia', C.combine(wd, wk.reminderTime), 'Hora do treino: ' + plan.name, (plan.items || []).length + ' exercícios • toque para começar', 'treino');
      }
    }
    if (mods.meal !== false && !singleOnly) {
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
    // Água: de tanto em tanto tempo, no horário escolhido, até bater a meta do dia.
    // Se bebeu há pouco (menos da metade do intervalo), o aviso daquele horário não vem.
    var wa = s.water || {};
    if (mods.water !== false && !singleOnly && wa.remind && C.isTimeKey(wa.from) && C.isTimeKey(wa.to) && wa.to > wa.from) {
      var every = Math.min(Math.max(Number(wa.every) || 120, 30), 480) * 60000;
      var goal = waterGoal(state).ml;
      var wEnd = opts && opts.waterUntil && opts.waterUntil < to ? opts.waterUntil : to;
      for (var wday = from; wday <= wEnd; wday = C.addDays(wday, 1)) {
        var logs = waterLogsOn(state, wday), drank = 0, lastAt = 0;
        logs.forEach(function (l) { drank += Number(l.ml || 0); var t = new Date(l.at).getTime(); if (t > lastAt) lastAt = t; });
        if (drank >= goal) continue;
        var t1 = C.combine(wday, wa.to).getTime();
        for (var wt = C.combine(wday, wa.from).getTime(); wt <= t1; wt += every) {
          if (lastAt && wt >= lastAt && wt - lastAt < every / 2) continue;
          push('water', 'dia', new Date(wt), 'Hora de beber água 💧',
            drank > 0 ? 'Faltam ' + formatMl(goal - drank) + ' para a meta de hoje.' : 'Meta do dia: ' + formatMl(goal) + '.', 'alimentacao');
        }
      }
    }
    // Ciclo: aviso 2 dias antes da menstruação prevista, às 9h.
    var cyc = s.cycle || {}, Cy = cycleApi();
    if (mods.cycle !== false && !singleOnly && cyc.remind !== false && Cy) {
      Cy.predictedStarts(state, (opts && opts.today) || from, 6).forEach(function (d) {
        var at = C.combine(C.addDays(d, -2), '09:00'), k = C.toDateKey(at);
        if (k < from || k > to) return;
        push('cycle', 'menstruacao', at, 'Sua menstruação deve vir em 2 dias 🌸', 'Previsão pela média dos seus ciclos • ' + C.formatDayMonth(d), 'ciclo');
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
    emptyState: emptyState, migrate: migrate, hasAnyData: hasAnyData, byId: byId, removeById: removeById,
    workoutPlanIdForDate: workoutPlanIdForDate,
    // tarefas
    validateTask: validateTask, occKey: occKey, taskOccursOn: taskOccursOn, taskOccurrences: taskOccurrences,
    undatedTasks: undatedTasks, overdueTasks: overdueTasks, isPast: isPast, createTask: createTask,
    setTaskDone: setTaskDone, startTask: startTask, stopTask: stopTask, skipTaskOccurrence: skipTaskOccurrence, postponeTask: postponeTask,
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
    // água
    WATER_CUPS: WATER_CUPS, CUP_MIN: CUP_MIN, CUP_MAX: CUP_MAX, formatMl: formatMl, latestWeight: latestWeight, waterGoal: waterGoal, waterCup: waterCup,
    waterLogsOn: waterLogsOn, waterTotal: waterTotal, addWater: addWater, undoWater: undoWater, waterDays: waterDays,
    validateWaterSettings: validateWaterSettings,
    // lembretes, painel e agenda
    computeReminders: computeReminders, upcomingReminders: upcomingReminders, futureReminders: futureReminders,
    SERVER_RECURRING_DAYS: SERVER_RECURRING_DAYS, SERVER_SINGLE_DAYS: SERVER_SINGLE_DAYS,
    dueReminders: dueReminders, pruneFired: pruneFired,
    dashboard: dashboard, agendaForDate: agendaForDate, agendaMarkers: agendaMarkers
  };
});
