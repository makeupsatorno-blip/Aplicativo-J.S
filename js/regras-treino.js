/*
 * J.S. — regras do Treino: fichas, semana fixa, troca do dia, execução (séries) e evolução de carga.
 * Sem tela e sem armazenamento: recebe o "state" e pode ser testado no Node.
 */
(function (root, factory) {
  var req = typeof require === 'function';
  var C = root && root.JSCore ? root.JSCore : (req ? require('./core.js') : null);
  var R = root && root.JSRegras ? root.JSRegras : (req ? require('./regras.js') : null);
  var X = root && root.JSExercicios ? root.JSExercicios : (req ? require('./dados/exercicios.js') : null);
  var api = factory(C, R, X);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSTreino = api;
})(typeof self !== 'undefined' ? self : this, function (C, R, X) {
  'use strict';

  // Cores das fichas em tons delicados (rosé, azul-acinzentado, terracota, lavanda, sálvia, ameixa),
  // todas com contraste AA para a letra branca; a letra da ficha aparece junto, então a
  // identidade nunca depende só da cor. As cores antigas são trocadas na migração (js/regras.js).
  var PLAN_COLORS = ['#A0526D', '#4F6F9A', '#A85E3C', '#7A5BA6', '#4E7D62', '#8E4C7E'];
  var MAX_ITEMS = 30, MAX_SETS = 10;

  function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); }
  function num(v) {
    if (v === '' || v == null) return null;
    var n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  /* ---------------- Exercícios ---------------- */

  function exercises(state) { return X.ITENS.concat(state.exercises || []); }
  function exerciseById(state, id) {
    var all = exercises(state);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function exerciseName(state, id, fallback) { var e = exerciseById(state, id); return e ? e.name : (fallback || 'Exercício'); }

  function validateExercise(input) {
    var e = {};
    var v = {
      name: str(input.name, 60),
      group: X.GRUPOS[input.group] ? input.group : 'outro',
      equipment: str(input.equipment, 60) || null,
      tips: str(input.tips, 500) || null,
      videoUrl: str(input.videoUrl, 300) || null
    };
    if (!v.name) e.name = 'Informe o nome do exercício.';
    if (v.videoUrl && !/^https:\/\//i.test(v.videoUrl)) e.videoUrl = 'Use um link que comece com https://';
    return { ok: !Object.keys(e).length, errors: e, value: v };
  }
  function createExercise(state, v, nowISO) {
    var ex = Object.assign({ id: 'cx:' + C.uuid(), builtIn: false, createdAt: nowISO, updatedAt: nowISO }, v);
    state.exercises.push(ex);
    return ex;
  }
  function updateExercise(state, id, v, nowISO) {
    var ex = R.byId(state.exercises, id);
    if (!ex) return null;
    Object.assign(ex, v, { updatedAt: nowISO });
    return ex;
  }

  /* ---------------- Fichas ---------------- */

  function validatePlan(input) {
    var e = {};
    var items = (Array.isArray(input.items) ? input.items : []).slice(0, MAX_ITEMS).map(function (it) {
      var sets = Math.min(Math.max(Math.round(num(it.sets) || 0), 1), MAX_SETS), load = num(it.load), rest = Math.round(num(it.restSec) || 0);
      var loads = planLoads(it.loads, sets, load);
      return {
        id: it.id || C.uuid(), exerciseId: String(it.exerciseId || ''),
        sets: sets,
        reps: str(it.reps, 12) || '10',
        load: loads[0],
        loads: loads,
        restSec: Math.min(Math.max(rest, 0), 900),
        notes: str(it.notes, 200) || null
      };
    }).filter(function (it) { return it.exerciseId; });
    var v = {
      name: str(input.name, 40),
      color: PLAN_COLORS.indexOf(input.color) >= 0 ? input.color : PLAN_COLORS[0],
      items: items
    };
    if (!v.name) e.name = 'Dê um nome à ficha (ex.: Treino A — Pernas).';
    if (!v.items.length) e.items = 'Adicione pelo menos um exercício.';
    return { ok: !Object.keys(e).length, errors: e, value: v };
  }

  // Carga de cada série (ex.: pirâmide 20 / 22,5 / 25 kg). Série sem valor repete a anterior.
  function clampLoad(v) { return Math.min(Math.max(round1(v), 0), 999); }
  function planLoads(list, sets, base) {
    var vals = Array.isArray(list) ? list.map(num) : [];
    var first = null;
    for (var k = 0; k < vals.length; k++) if (vals[k] != null) { first = vals[k]; break; }
    var prev = clampLoad(first != null ? first : base != null ? base : 0), out = [];
    for (var i = 0; i < sets; i++) {
      if (vals[i] != null) prev = clampLoad(vals[i]);
      out.push(prev);
    }
    return out;
  }
  function itemLoads(it) { return Array.isArray(it.loads) && it.loads.length ? planLoads(it.loads, it.sets, it.load) : planLoads(null, it.sets, it.load); }
  function samePerSet(loads) { return !loads || loads.every(function (x) { return x === loads[0]; }); }

  function createPlan(state, v, nowISO) {
    var p = Object.assign({ id: C.uuid(), createdAt: nowISO, updatedAt: nowISO }, v);
    state.workoutPlans.push(p);
    return p;
  }
  function updatePlan(state, id, v, nowISO) {
    var p = R.byId(state.workoutPlans, id);
    if (!p) return null;
    p.name = v.name; p.color = v.color; p.items = v.items; p.updatedAt = nowISO;
    return p;
  }
  // Apaga a ficha e tira ela da semana e das trocas de dia. O histórico de treinos feitos fica.
  function deletePlan(state, id) {
    R.removeById(state.workoutPlans, id);
    var w = state.workout;
    Object.keys(w.week).forEach(function (d) { if (w.week[d] === id) w.week[d] = null; });
    Object.keys(w.overrides).forEach(function (d) { if (w.overrides[d] === id) delete w.overrides[d]; });
  }
  function duplicatePlan(state, id, nowISO) {
    var p = R.byId(state.workoutPlans, id);
    if (!p) return null;
    var copy = JSON.parse(JSON.stringify(p));
    copy.id = C.uuid(); copy.name = (p.name + ' (cópia)').slice(0, 40); copy.createdAt = copy.updatedAt = nowISO;
    copy.items.forEach(function (it) { it.id = C.uuid(); });
    state.workoutPlans.push(copy);
    return copy;
  }
  function planLetter(state, plan) {
    var i = state.workoutPlans.indexOf(plan);
    return i < 0 ? '?' : String.fromCharCode(65 + (i % 26));
  }

  /* ---------------- Semana fixa e troca do dia ---------------- */

  function setWeekPlan(state, weekday, planId) {
    state.workout.week[weekday] = planId && R.byId(state.workoutPlans, planId) ? planId : null;
  }
  // value: id da ficha, 'rest' (descanso) ou null (volta ao padrão da semana).
  function setDayPlan(state, date, value) {
    if (!value) delete state.workout.overrides[date];
    else if (value === 'rest' || R.byId(state.workoutPlans, value)) state.workout.overrides[date] = value;
  }

  function planForDate(state, date) {
    var ov = state.workout.overrides[date];
    var id = R.workoutPlanIdForDate(state, date);
    var plan = id && id !== 'rest' ? R.byId(state.workoutPlans, id) : null;
    return { plan: plan, rest: id === 'rest', changed: !!ov, weekPlan: R.byId(state.workoutPlans, state.workout.week[C.weekday(date)] || '') };
  }

  /* ---------------- Execução ---------------- */

  function activeSession(state) {
    for (var i = 0; i < state.workoutSessions.length; i++) if (state.workoutSessions[i].status === 'active') return state.workoutSessions[i];
    return null;
  }
  function doneSessions(state) {
    return state.workoutSessions.filter(function (s) { return s.status === 'done'; })
      .sort(function (a, b) { return cmp(a.date, b.date) || cmp(a.startedAt || '', b.startedAt || ''); });
  }
  function sessionOn(state, date) {
    var list = state.workoutSessions.filter(function (s) { return s.date === date; });
    return list.filter(function (s) { return s.status === 'active'; })[0] || list[list.length - 1] || null;
  }

  // Última carga usada no exercício (em qualquer treino concluído); se nunca fez, null.
  function lastLoad(state, exerciseId) {
    var list = doneSessions(state);
    for (var i = list.length - 1; i >= 0; i--) {
      var it = list[i].items.filter(function (x) { return x.exerciseId === exerciseId && x.sets.length; })[0];
      if (it) return it.sets[it.sets.length - 1].load;
    }
    return null;
  }

  // Começa um treino a partir da ficha (ou livre, sem ficha). Só um treino em andamento por vez.
  function startSession(state, date, planId, nowISO) {
    if (activeSession(state)) return null;
    var plan = planId ? R.byId(state.workoutPlans, planId) : null;
    var s = {
      id: C.uuid(), date: date, planId: plan ? plan.id : null, planName: plan ? plan.name : 'Treino livre',
      status: 'active', startedAt: nowISO, finishedAt: null, current: 0,
      items: plan ? plan.items.map(function (it) {
        var loads = itemLoads(it);
        return {
          id: C.uuid(), exerciseId: it.exerciseId, name: exerciseName(state, it.exerciseId),
          targetSets: it.sets, targetReps: it.reps, plannedLoad: loads[0], plannedLoads: loads, restSec: it.restSec,
          load: loads[0], reps: firstReps(it.reps), sets: []
        };
      }) : []
    };
    state.workoutSessions.push(s);
    return s;
  }
  function firstReps(reps) { var m = String(reps || '').match(/\d+/); return m ? Number(m[0]) : 10; }

  function addSessionExercise(state, sessionId, exerciseId) {
    var s = R.byId(state.workoutSessions, sessionId);
    if (!s || s.status !== 'active') return null;
    var last = lastLoad(state, exerciseId);
    var it = { id: C.uuid(), exerciseId: exerciseId, name: exerciseName(state, exerciseId), targetSets: 3, targetReps: '10',
      plannedLoad: last || 0, restSec: 60, load: last || 0, reps: 10, sets: [] };
    s.items.push(it);
    s.current = s.items.length - 1;
    return it;
  }

  // Ajusta carga/repetições que serão usadas na próxima série do exercício.
  function setItemValues(state, sessionId, itemId, values) {
    var s = R.byId(state.workoutSessions, sessionId);
    var it = s && R.byId(s.items, itemId);
    if (!it) return null;
    if (values.load != null) it.load = Math.min(Math.max(round1(Number(values.load)), 0), 999);
    if (values.reps != null) it.reps = Math.min(Math.max(Math.round(Number(values.reps)), 0), 999);
    return it;
  }

  // Registra uma série com a carga/repetições atuais do exercício.
  // via: 'toque' (botão), 'toque-atras' (duas batidas atrás do celular) ou 'atalho' (iPhone com o app fechado).
  function logSet(state, sessionId, itemId, nowISO, via) {
    var s = R.byId(state.workoutSessions, sessionId);
    var it = s && R.byId(s.items, itemId);
    if (!it || s.status !== 'active') return null;
    var set = { load: it.load, reps: it.reps, at: nowISO, via: via || 'toque' };
    it.sets.push(set);
    // Carga por série planejada (pirâmide): a próxima série já começa com o peso dela.
    if (it.plannedLoads && !samePerSet(it.plannedLoads) && it.sets.length < it.plannedLoads.length) it.load = it.plannedLoads[it.sets.length];
    // Terminou as séries planejadas: o próximo exercício pendente vira o atual.
    if (it.sets.length >= it.targetSets) {
      var idx = s.items.indexOf(it);
      for (var k = 1; k <= s.items.length; k++) {
        var nx = s.items[(idx + k) % s.items.length];
        if (nx.sets.length < nx.targetSets) { s.current = s.items.indexOf(nx); break; }
      }
    } else s.current = s.items.indexOf(it);
    return set;
  }
  function undoLastSet(state, sessionId, itemId) {
    var s = R.byId(state.workoutSessions, sessionId);
    var it = s && R.byId(s.items, itemId);
    if (!it || !it.sets.length) return null;
    var set = it.sets.pop();
    s.current = s.items.indexOf(it);
    return set;
  }
  function setCurrent(state, sessionId, index) {
    var s = R.byId(state.workoutSessions, sessionId);
    if (s && index >= 0 && index < s.items.length) s.current = index;
  }
  function currentItem(s) { return s && s.items.length ? s.items[Math.min(s.current || 0, s.items.length - 1)] : null; }

  // Termina o treino. A ficha passa a sugerir a última carga usada em cada exercício
  // (é assim que a carga "vai atualizando" de um treino para o outro).
  function finishSession(state, sessionId, nowISO) {
    var s = R.byId(state.workoutSessions, sessionId);
    if (!s || s.status !== 'active') return null;
    var summary = sessionSummary(state, s, nowISO);
    s.status = 'done'; s.finishedAt = nowISO;
    var plan = s.planId ? R.byId(state.workoutPlans, s.planId) : null;
    if (plan) {
      s.items.forEach(function (it) {
        if (!it.sets.length) return;
        plan.items.forEach(function (p) {
          if (p.exerciseId !== it.exerciseId) return;
          // Cada série da ficha passa a sugerir a carga usada naquela série.
          var loads = itemLoads(p);
          for (var i = 0; i < loads.length; i++) if (it.sets[i]) loads[i] = it.sets[i].load;
          if (it.sets.length < loads.length && samePerSet(itemLoads(p))) for (var j = it.sets.length; j < loads.length; j++) loads[j] = it.sets[it.sets.length - 1].load;
          p.loads = loads; p.load = loads[0];
        });
      });
      plan.updatedAt = nowISO;
    }
    return summary;
  }
  // Descarta o treino em andamento (nada fica no histórico).
  function discardSession(state, sessionId) { R.removeById(state.workoutSessions, sessionId); }
  function deleteSession(state, sessionId) { R.removeById(state.workoutSessions, sessionId); }

  // Números do treino (sem recordes: barato, usado nas estatísticas da semana).
  function sessionNumbers(s, nowISO) {
    var end = new Date(s.finishedAt || nowISO || new Date().toISOString()).getTime();
    var minutes = Math.max(0, Math.round((end - new Date(s.startedAt).getTime()) / 60000));
    var sets = 0, volume = 0, done = 0;
    s.items.forEach(function (it) {
      if (!it.sets.length) return;
      done++;
      sets += it.sets.length;
      it.sets.forEach(function (st) { volume += (st.load || 0) * (st.reps || 0); });
    });
    return { minutes: minutes, sets: sets, volume: Math.round(volume), exercises: done, total: s.items.length };
  }

  // Resumo: duração, séries, volume (carga × repetições) e os recordes batidos neste treino.
  function sessionSummary(state, s, nowISO) {
    var out = sessionNumbers(s, nowISO);
    out.prs = sessionRecords(state, s.id);
    return out;
  }

  /* ---------------- Recordes pessoais ---------------- */

  // Percorre todas as séries do exercício, em ordem (data, início do treino, ordem das séries), e marca
  // as que bateram recorde:
  //  - "carga": mais pesada do que qualquer série anterior do exercício;
  //  - "reps": mais repetições do que qualquer série anterior com a MESMA carga.
  // A primeira vez que o exercício é feito não conta (não havia o que superar). Treinos em andamento
  // entram na conta, então bater o recorde na 1ª série faz a 2ª ter que superar o novo.
  function exerciseRecords(state, exerciseId) {
    var sessions = state.workoutSessions.filter(function (x) { return x.status === 'done' || x.status === 'active'; })
      .sort(function (a, b) { return cmp(a.date, b.date) || cmp(a.startedAt || '', b.startedAt || ''); });
    var prior = [], events = [], maxLoad = 0, best = null;
    sessions.forEach(function (sess) {
      sess.items.forEach(function (it) {
        if (it.exerciseId !== exerciseId) return;
        it.sets.forEach(function (st, k) {
          var load = Number(st.load) || 0, reps = Number(st.reps) || 0;
          if (reps <= 0) return; // série sem repetição não vale
          var kind = null, prevLoad = null, prevReps = null;
          if (prior.length) {
            if (load > maxLoad) { kind = 'carga'; prevLoad = maxLoad; }
            else {
              var same = null;
              prior.forEach(function (p) { if (p.load === load && (same == null || p.reps > same)) same = p.reps; });
              if (same != null && reps > same) { kind = 'reps'; prevLoad = load; prevReps = same; }
            }
          }
          if (kind) events.push({ key: sess.id + '|' + it.id + '|' + k, sessionId: sess.id, itemId: it.id, setIndex: k, date: sess.date, at: st.at || sess.startedAt || '',
            name: it.name || exerciseName(state, exerciseId), exerciseId: exerciseId, kind: kind, load: load, reps: reps, prevLoad: prevLoad, prevReps: prevReps });
          prior.push({ load: load, reps: reps });
          if (load > maxLoad) maxLoad = load;
          if (!best || load > best.load || (load === best.load && reps > best.reps)) best = { load: load, reps: reps, date: sess.date };
        });
      });
    });
    return { events: events, best: best };
  }

  // O que bater: a maior carga já feita no exercício (com as repetições e o dia).
  function exerciseBest(state, exerciseId) { return exerciseRecords(state, exerciseId).best; }

  // A série (número k, a partir de 0) bateu recorde? Devolve o recorde ou null.
  function recordOf(state, sessionId, itemId, setIndex) {
    var s = R.byId(state.workoutSessions, sessionId), it = s && R.byId(s.items, itemId);
    if (!it) return null;
    var key = sessionId + '|' + itemId + '|' + setIndex, ev = exerciseRecords(state, it.exerciseId).events;
    for (var i = 0; i < ev.length; i++) if (ev[i].key === key) return ev[i];
    return null;
  }

  // Recordes de um treino, um por exercício: o de carga vale mais que o de repetições.
  function sessionRecords(state, sessionId) {
    var s = R.byId(state.workoutSessions, sessionId);
    if (!s) return [];
    var seen = {}, out = [];
    s.items.forEach(function (it) {
      if (seen[it.exerciseId] || !it.sets.length) return;
      seen[it.exerciseId] = true;
      var mine = exerciseRecords(state, it.exerciseId).events.filter(function (e) { return e.sessionId === sessionId; });
      if (!mine.length) return;
      var top = mine.filter(function (e) { return e.kind === 'carga'; }).sort(function (a, b) { return b.load - a.load; })[0] ||
        mine.sort(function (a, b) { return b.reps - a.reps; })[0];
      out.push({ name: top.name, exerciseId: top.exerciseId, kind: top.kind, load: top.load, reps: top.reps, prevLoad: top.prevLoad, prevReps: top.prevReps,
        prev: top.prevLoad, count: mine.length });
    });
    return out;
  }

  // Todos os exercícios que já tiveram algum recorde, do mais recente para o mais antigo.
  function recentRecords(state, today, days, limit) {
    var from = C.addDays(today, -(days || 30)), ids = {}, all = [];
    state.workoutSessions.forEach(function (x) { if (x.status === 'done' || x.status === 'active') x.items.forEach(function (it) { if (it.sets.length) ids[it.exerciseId] = 1; }); });
    Object.keys(ids).forEach(function (id) {
      exerciseRecords(state, id).events.forEach(function (e) { if (e.date >= from && e.date <= today) all.push(e); });
    });
    // um por exercício (o mais recente), para a lista não repetir o mesmo aparelho
    all.sort(function (a, b) { return cmp(b.date, a.date) || cmp(b.at, a.at) || (b.kind === 'carga' ? 1 : 0) - (a.kind === 'carga' ? 1 : 0); });
    var seen = {}, out = [], total = all.length;
    all.forEach(function (e) { if (!seen[e.exerciseId]) { seen[e.exerciseId] = true; out.push(e); } });
    return { list: out.slice(0, limit || 5), exercises: out.length, total: total };
  }

  /* ---------------- Registro rápido ---------------- */

  // Última série feita no exercício (no treino em andamento ou nos concluídos).
  function lastSet(state, exerciseId) {
    var list = state.workoutSessions.slice().sort(function (a, b) { return cmp(a.startedAt || '', b.startedAt || ''); });
    for (var i = list.length - 1; i >= 0; i--) {
      var its = list[i].items.filter(function (x) { return x.exerciseId === exerciseId && x.sets.length; });
      if (its.length) { var it = its[its.length - 1], st = it.sets[it.sets.length - 1]; return { load: st.load, reps: st.reps, date: list[i].date, at: st.at }; }
    }
    return null;
  }

  // Salva uma série vinda do registro rápido (no app, pelo toque atrás, ou pelo atalho do iPhone).
  //  q: { exerciseId, load, reps, serie?, at?, via?, planId?, date? }
  //  - sem treino em andamento: começa um (a ficha indicada ou "treino livre");
  //  - exercício que não está no treino: entra no treino;
  //  - série com número que já existe: corrige aquela série; senão, registra a próxima.
  function quickSet(state, q, nowISO) {
    var at = q.at || nowISO;
    var s = activeSession(state), started = false;
    if (!s) {
      s = startSession(state, q.date || C.toDateKey(new Date(at)), q.planId || null, at);
      started = true;
    }
    var it = q.exerciseId ? s.items.filter(function (x) { return x.exerciseId === q.exerciseId; })[0] : currentItem(s);
    if (!it && q.exerciseId) it = addSessionExercise(state, s.id, q.exerciseId);
    if (!it) return null;
    s.current = s.items.indexOf(it);
    var load = Math.min(Math.max(round1(Number(q.load) || 0), 0), 999), reps = Math.min(Math.max(Math.round(Number(q.reps) || 0), 0), 999);
    var n = q.serie != null && q.serie !== '' && Number(q.serie) >= 1 ? Math.round(Number(q.serie)) : it.sets.length + 1;
    if (n <= it.sets.length) {
      var old = it.sets[n - 1];
      it.sets[n - 1] = Object.assign({}, old, { load: load, reps: reps, editedAt: at, via: q.via || old.via });
      return { session: s, item: it, serie: n, corrected: true, started: started };
    }
    it.load = load; it.reps = reps;
    logSet(state, s.id, it.id, at, q.via || 'registro');
    return { session: s, item: it, serie: it.sets.length, corrected: false, started: started };
  }

  // O que o atalho do iPhone mostra ao abrir: exercício atual, próxima série, carga e repetições,
  // e a lista de exercícios para trocar. Sem treino em andamento: a ficha do dia (ou o último exercício feito).
  function quickContext(state, today, loadStep) {
    var s = activeSession(state), it = currentItem(s);
    var opcoes = [], seen = {};
    function opt(id) { if (id && !seen[id]) { seen[id] = 1; opcoes.push({ id: id, nome: exerciseName(state, id) }); } }
    if (s) s.items.forEach(function (x) { opt(x.exerciseId); });
    var p = planForDate(state, today);
    if (p.plan) p.plan.items.forEach(function (x) { opt(x.exerciseId); });
    doneSessions(state).slice(-6).reverse().forEach(function (x) { x.items.forEach(function (y) { if (y.sets.length) opt(y.exerciseId); }); });
    var ex = it ? it.exerciseId : (opcoes[0] && opcoes[0].id) || null;
    var ls = ex ? lastSet(state, ex) : null;
    return {
      ativo: !!s, treino: s ? s.planName : (p.plan ? p.plan.name : 'Treino livre'),
      exercicio: ex ? exerciseName(state, ex) : '', exercicioId: ex || '',
      serie: it ? it.sets.length + 1 : 1, series: it ? it.targetSets : null,
      peso: it ? it.load : (ls ? ls.load : null), reps: it ? it.reps : (ls ? ls.reps : null),
      passo: loadStep || 1, opcoes: opcoes.slice(0, 40)
    };
  }

  // Histórico de séries de um exercício, do treino mais recente para o mais antigo.
  function exerciseSets(state, exerciseId, limit) {
    var out = [];
    state.workoutSessions.slice().sort(function (a, b) { return cmp(b.startedAt || '', a.startedAt || ''); }).forEach(function (s) {
      var sets = [];
      s.items.forEach(function (it) { if (it.exerciseId === exerciseId) sets = sets.concat(it.sets); });
      if (sets.length) out.push({ sessionId: s.id, date: s.date, planName: s.planName, active: s.status === 'active', sets: sets });
    });
    return out.slice(0, limit || 30);
  }

  /* ---------------- Evolução ---------------- */

  // Por treino concluído: maior carga, volume e repetições da melhor série.
  function exerciseHistory(state, exerciseId) {
    var out = [];
    doneSessions(state).forEach(function (s) {
      var sets = [];
      s.items.forEach(function (it) { if (it.exerciseId === exerciseId) sets = sets.concat(it.sets); });
      if (!sets.length) return;
      var max = 0, vol = 0, reps = 0;
      sets.forEach(function (st) { vol += (st.load || 0) * (st.reps || 0); if ((st.load || 0) >= max) { max = st.load || 0; reps = st.reps || 0; } });
      out.push({ date: s.date, maxLoad: max, volume: Math.round(vol), reps: reps, sets: sets.length });
    });
    return out;
  }

  // Tendência de carga: compara o último treino com o anterior e com o primeiro.
  function exerciseTrend(state, exerciseId) {
    var h = exerciseHistory(state, exerciseId);
    if (!h.length) return null;
    var last = h[h.length - 1], prev = h.length > 1 ? h[h.length - 2] : null;
    var best = h.reduce(function (m, x) { return x.maxLoad > m ? x.maxLoad : m; }, 0);
    var delta = prev ? round1(last.maxLoad - prev.maxLoad) : null;
    return {
      last: last, prev: prev, first: h[0], best: best, count: h.length,
      delta: delta, sinceFirst: round1(last.maxLoad - h[0].maxLoad),
      direction: delta == null ? 'new' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'
    };
  }

  // Exercícios que já foram feitos pelo menos uma vez, com a tendência de cada um.
  function trainedExercises(state) {
    var ids = {};
    doneSessions(state).forEach(function (s) { s.items.forEach(function (it) { if (it.sets.length) ids[it.exerciseId] = it.name; }); });
    return Object.keys(ids).map(function (id) {
      return { id: id, name: exerciseName(state, id, ids[id]), group: (exerciseById(state, id) || {}).group || 'outro', trend: exerciseTrend(state, id) };
    }).sort(function (a, b) { return cmp(a.name.toLowerCase(), b.name.toLowerCase()); });
  }

  // Treinos por semana (semana começa no domingo), das mais antigas para a atual.
  function weeklyStats(state, today, weeks) {
    var start = C.addDays(today, -C.weekday(today) - (weeks - 1) * 7);
    var out = [];
    for (var i = 0; i < weeks; i++) out.push({ from: C.addDays(start, i * 7), count: 0, volume: 0, minutes: 0 });
    doneSessions(state).forEach(function (s) {
      var idx = Math.floor(C.diffDays(start, s.date) / 7);
      if (idx < 0 || idx >= weeks) return;
      var sum = sessionNumbers(s);
      out[idx].count++; out[idx].volume += sum.volume; out[idx].minutes += sum.minutes;
    });
    return out;
  }

  // Calendário do mês: ficha planejada, descanso e treino feito em cada dia.
  function monthCalendar(state, mk) {
    var r = C.monthRange(mk), out = {};
    for (var d = r.from; d <= r.to; d = C.addDays(d, 1)) {
      var p = planForDate(state, d);
      var s = state.workoutSessions.filter(function (x) { return x.date === d && x.status === 'done'; });
      out[d] = { plan: p.plan, rest: p.rest, changed: p.changed, done: s };
    }
    return out;
  }

  /* ---------------- Séries por grupo muscular ---------------- */

  // Séries feitas na semana (domingo a sábado) por grupo muscular, com a semana anterior para comparar.
  // Conta os treinos concluídos e o que está em andamento.
  function weeklyMuscleSets(state, today) {
    var start = C.addDays(today, -C.weekday(today)), prevStart = C.addDays(start, -7), end = C.addDays(start, 6);
    var cur = {}, prev = {};
    state.workoutSessions.forEach(function (s) {
      if (s.status !== 'done' && s.status !== 'active') return;
      var bucket = s.date >= start && s.date <= end ? cur : s.date >= prevStart && s.date < start ? prev : null;
      if (!bucket) return;
      s.items.forEach(function (it) {
        if (!it.sets.length) return;
        var g = (exerciseById(state, it.exerciseId) || {}).group || 'outro';
        bucket[g] = (bucket[g] || 0) + it.sets.length;
      });
    });
    var keys = Object.keys(cur).concat(Object.keys(prev)).filter(function (k, i, a) { return a.indexOf(k) === i; });
    return {
      from: start, to: end,
      total: Object.keys(cur).reduce(function (a, k) { return a + cur[k]; }, 0),
      groups: keys.map(function (k) { return { group: k, label: X.GRUPOS[k] || 'Outro', sets: cur[k] || 0, last: prev[k] || 0 }; })
        .sort(function (a, b) { return b.sets - a.sets || b.last - a.last || cmp(a.label, b.label); })
    };
  }

  /* ---------------- Sugestão de carga (progressão dupla) ---------------- */

  function fmt(n) { return String(round1(n)).replace('.', ','); }

  // Faixa de repetições: "8-10", "8 a 10", "12–15" → 8..10 etc. Um número só ("10") vale como "8 a 10"
  // (o piso é 2 repetições abaixo do alvo). Sem número, assume 8 a 10.
  function parseRepRange(text) {
    var nums = (String(text == null ? '' : text).match(/\d+/g) || []).map(Number).filter(function (n) { return n > 0 && n <= 200; });
    if (!nums.length) return { min: 8, max: 10 };
    var max = Math.max.apply(null, nums);
    return { min: nums.length > 1 ? Math.min.apply(null, nums) : Math.max(1, max - 2), max: max };
  }
  // Passo do aumento: o passo da usuária (Treino → Semana → Passo da carga). Com o passo padrão (1 kg) e
  // carga a partir de 20 kg, o salto é de 2,5 kg (anilha comum); quem escolheu outro passo mantém o dele.
  function loadIncrement(load, step) {
    step = Number(step) > 0 ? Number(step) : 1;
    return load >= 20 && step === 1 ? 2.5 : step;
  }

  // Treinos concluídos em que o exercício teve séries com repetição (do mais antigo ao mais novo).
  // Treino em andamento não conta.
  function doneEntries(state, exerciseId) {
    var out = [];
    doneSessions(state).forEach(function (s) {
      var sets = [], item = null;
      s.items.forEach(function (it) {
        if (it.exerciseId !== exerciseId || !it.sets.length) return;
        item = item || it;
        sets = sets.concat(it.sets);
      });
      sets = sets.filter(function (st) { return (Number(st.reps) || 0) > 0; });
      if (sets.length) out.push({ date: s.date, item: item, sets: sets });
    });
    return out;
  }
  // Resumo de um treino do exercício: carga de trabalho (a mais pesada), repetições, se completou as séries.
  function workOf(entry, range, plannedOpt) {
    var planned = Math.max(1, Math.round(Number(plannedOpt) || Number(entry.item && entry.item.targetSets) || entry.sets.length));
    var counted = entry.sets.slice(0, planned);
    var loads = entry.sets.map(function (st) { return Number(st.load) || 0; });
    var top = Math.max.apply(null, loads);
    var reps = counted.map(function (st) { return Number(st.reps) || 0; });
    return {
      date: entry.date, top: top, loads: loads, mixed: loads.some(function (l) { return l !== top; }),
      planned: planned, done: entry.sets.length, complete: counted.length >= planned,
      reps: reps, minReps: Math.min.apply(null, reps), avg: reps.reduce(function (a, b) { return a + b; }, 0) / reps.length,
      allMax: counted.length >= planned && reps.every(function (r) { return r >= range.max; })
    };
  }

  // Sugestão para o próximo treino do exercício, pela última vez que ele foi feito.
  //   opts: { targetReps (faixa da ficha, ex.: "8-10"), targetSets, step (kg) }
  //   → null (sem histórico) ou { action: 'subir' | 'manter' | 'reduzir', load, from, reps?, headline, reason, warn, basis }
  //  - subir: todas as séries planejadas feitas e todas com repetições ≥ máximo da faixa → carga + passo
  //    (peso do corpo, carga 0: sugere uma repetição a mais em cada série, em "reps");
  //  - manter: ainda não bateu o máximo (ou faltaram séries) → mesma carga, mais uma repetição em cada série;
  //  - reduzir: duas vezes seguidas, na mesma carga, com média de repetições abaixo do mínimo → cerca de 7,5% a menos.
  // Nunca altera a ficha: quem decide é a usuária. Se o aumento passar de 10% do recorde de carga, "warn" avisa.
  // (O valor 'estreia' não é usado: sem histórico, não há o que sugerir.)
  function suggestLoad(state, exerciseId, opts) {
    opts = opts || {};
    var h = doneEntries(state, exerciseId);
    if (!h.length) return null;
    var last = h[h.length - 1], prev = h.length > 1 ? h[h.length - 2] : null;
    var range = parseRepRange(opts.targetReps != null && opts.targetReps !== '' ? opts.targetReps : (last.item && last.item.targetReps));
    var step = Number(opts.step) > 0 ? Number(opts.step) : (Number((state.workout || {}).loadStep) > 0 ? Number(state.workout.loadStep) : 1);
    var w = workOf(last, range, opts.targetSets), L = w.top, body = L === 0;
    var inc = loadIncrement(L, step);
    var basis = { date: w.date, load: L, repsList: w.reps, minReps: w.minReps, avgReps: round1(w.avg), targetMin: range.min, targetMax: range.max,
      sets: w.done, planned: w.planned, mixed: w.mixed };
    var out = { from: L, warn: false, basis: basis };

    // reduzir: só com carga (peso do corpo vira "manter"), duas vezes seguidas na mesma carga
    if (!body && prev) {
      var wp = workOf(prev, range, opts.targetSets);
      if (Math.abs(wp.top - L) < 0.001 && w.avg < range.min && wp.avg < range.min) {
        var down = roundTo(L * 0.925, inc);
        if (down >= L) down = round1(L - inc);
        down = Math.max(0, down);
        return Object.assign(out, { action: 'reduzir', load: down, headline: 'Hoje vá com ' + fmt(down) + ' kg',
          reason: 'Nas duas últimas vezes com ' + fmt(L) + ' kg as repetições ficaram abaixo de ' + range.min + '. Reduzir um pouco ajuda a fazer todas as séries com boa técnica e voltar a subir depois.' });
      }
    }

    if (w.complete && w.allMax) {
      if (body) {
        var more = range.max + 1;
        return Object.assign(out, { action: 'subir', load: 0, reps: more, headline: 'Hoje tente ' + more + ' repetições',
          reason: 'Você fez ' + range.max + ' ou mais repetições em todas as séries na última vez. Tente ' + more + ' em cada série (ou adicione carga).' });
      }
      var up = round1(L + inc);
      var best = exerciseBest(state, exerciseId);
      var warn = !!(best && best.load > 0 && up > best.load * 1.10 + 1e-9);
      var reason = w.mixed
        ? 'Você bateu a meta em todas as séries (de ' + fmt(Math.min.apply(null, w.loads)) + ' a ' + fmt(L) + ' kg). Suba a série mais pesada para ' + fmt(up) + ' kg.'
        : 'Você fez ' + Math.min(w.minReps, range.max) + '/' + range.max + ' repetições em todas as séries com ' + fmt(L) + ' kg na última vez.';
      if (warn) reason += ' Atenção: esse aumento passa de 10% do seu recorde (' + fmt(best.load) + ' kg); suba só se estiver se sentindo bem.';
      return Object.assign(out, { action: 'subir', load: up, headline: 'Hoje tente ' + fmt(up) + ' kg', reason: reason, warn: warn });
    }

    var reason2 = !w.complete
      ? 'Faltaram séries na última vez (' + w.done + ' de ' + w.planned + '). Repita ' + (body ? 'o mesmo esforço' : fmt(L) + ' kg') + ' e complete todas antes de subir.'
      : 'Você fez ' + w.reps.join('/') + ' repetições' + (body ? '' : ' com ' + fmt(L) + ' kg') + '. Tente mais 1 repetição em cada série; ao chegar em ' + range.max + ' em todas, é hora de subir.';
    return Object.assign(out, { action: 'manter', load: L, headline: body ? 'Mais 1 repetição em cada série' : 'Mantenha ' + fmt(L) + ' kg', reason: reason2 });
  }
  function roundTo(v, step) { return round1(Math.round(v / step) * step); }

  // A usuária pode desligar as sugestões em Configurações (state.extras.treino.hideSuggestions).
  function suggestionsEnabled(state) { return !(state.extras && state.extras.treino && state.extras.treino.hideSuggestions); }

  /* ---------------- Treinos prontos (js/dados/treinos.js) ---------------- */

  // Ficha pronta -> valores de uma ficha da usuária. A carga começa na última usada em cada exercício.
  function planFromTemplate(state, tpl, color) {
    return validatePlan({
      name: tpl.name, color: color || PLAN_COLORS[state.workoutPlans.length % PLAN_COLORS.length],
      items: tpl.items.map(function (r) {
        var id = 'ex:' + r[0], last = lastLoad(state, id);
        return { exerciseId: id, sets: r[1], reps: r[2], restSec: r[3], load: last || 0, loads: [] };
      })
    });
  }
  function planByName(state, name) {
    var k = String(name || '').trim().toLowerCase();
    return state.workoutPlans.filter(function (p) { return p.name.trim().toLowerCase() === k; })[0] || null;
  }
  // Adiciona a ficha pronta; se já existe uma ficha com o mesmo nome, usa a que existe (não duplica).
  function addTemplate(state, tpl, nowISO) {
    var have = planByName(state, tpl.name);
    if (have) return { plan: have, created: false };
    var r = planFromTemplate(state, tpl);
    if (!r.ok) return { plan: null, created: false, errors: r.errors };
    return { plan: createPlan(state, r.value, nowISO), created: true };
  }
  // Semana pronta: cria (ou reaproveita) as fichas e, se setWeek, monta a semana fixa
  // (dias do programa com a ficha; os outros, descanso).
  function applyProgram(state, prog, fichas, nowISO, setWeek) {
    var byKey = {}, created = 0;
    prog.dias.forEach(function (d) {
      if (byKey[d[1]] || !fichas[d[1]]) return;
      var r = addTemplate(state, fichas[d[1]], nowISO);
      if (r.plan) { byKey[d[1]] = r.plan; if (r.created) created++; }
    });
    if (setWeek) {
      for (var w = 0; w < 7; w++) setWeekPlan(state, w, null);
      prog.dias.forEach(function (d) { if (byKey[d[1]]) setWeekPlan(state, d[0], byKey[d[1]].id); });
    }
    return { plans: Object.keys(byKey).map(function (k) { return byKey[k]; }), created: created };
  }

  return {
    PLAN_COLORS: PLAN_COLORS, GRUPOS: X.GRUPOS,
    planFromTemplate: planFromTemplate, planByName: planByName, addTemplate: addTemplate, applyProgram: applyProgram,
    exercises: exercises, exerciseById: exerciseById, exerciseName: exerciseName,
    validateExercise: validateExercise, createExercise: createExercise, updateExercise: updateExercise,
    validatePlan: validatePlan, createPlan: createPlan, itemLoads: itemLoads, samePerSet: samePerSet, updatePlan: updatePlan, deletePlan: deletePlan,
    duplicatePlan: duplicatePlan, planLetter: planLetter,
    setWeekPlan: setWeekPlan, setDayPlan: setDayPlan, planForDate: planForDate,
    activeSession: activeSession, doneSessions: doneSessions, sessionOn: sessionOn, lastLoad: lastLoad,
    startSession: startSession, addSessionExercise: addSessionExercise, setItemValues: setItemValues,
    logSet: logSet, undoLastSet: undoLastSet, setCurrent: setCurrent, currentItem: currentItem,
    finishSession: finishSession, discardSession: discardSession, deleteSession: deleteSession, sessionSummary: sessionSummary,
    lastSet: lastSet, quickSet: quickSet, quickContext: quickContext, exerciseSets: exerciseSets,
    exerciseHistory: exerciseHistory, exerciseTrend: exerciseTrend, trainedExercises: trainedExercises,
    weeklyStats: weeklyStats, monthCalendar: monthCalendar, weeklyMuscleSets: weeklyMuscleSets,
    exerciseRecords: exerciseRecords, exerciseBest: exerciseBest, recordOf: recordOf, sessionRecords: sessionRecords, recentRecords: recentRecords,
    suggestLoad: suggestLoad, suggestionsEnabled: suggestionsEnabled, parseRepRange: parseRepRange, loadIncrement: loadIncrement
  };
});
