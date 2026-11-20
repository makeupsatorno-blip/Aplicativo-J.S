/*
 * J.S. — Jardim da Julia.
 * Cada DIA vira uma flor, conforme os hábitos que a usuária de fato usa: treino feito, água e proteína
 * na meta, tarefas do dia, skincare e sono. Sem pressão: dia sem hábito ativo não conta nem quebra a
 * sequência, e o dia de hoje (ainda aberto) nunca quebra nada.
 *
 * Nível da flor (feitos ÷ hábitos ativos do dia): 0 semente, 1 broto (< 50%), 2 botão (< 75%),
 * 3 aberta (< 100%), 4 florada completa (100%). Nível ≥ 2 conta como "dia florido" para a sequência.
 *
 * Módulo puro (roda no navegador e no Node para testes). A parte de tela só monta quando há window.JS.
 * Dados: state.extras.jardim = { hide?: boolean, vistos: { idDaConquista: 'AAAA-MM-DD' } }.
 * Lê (sem escrever) state.extras.sono e state.extras.skincare, no formato combinado com a frente de bem-estar.
 */
(function (root, factory) {
  var req = typeof require === 'function';
  function safe(p) { try { return require(p); } catch (e) { return null; } }
  var C = root && root.JSCore ? root.JSCore : (req ? require('./core.js') : null);
  var R = root && root.JSRegras ? root.JSRegras : (req ? require('./regras.js') : null);
  var T = root && root.JSTreino ? root.JSTreino : (req ? require('./regras-treino.js') : null);
  var N = root && root.JSNutri ? root.JSNutri : (req ? require('./regras-nutricao.js') : null);
  var Cy = root && root.JSCiclo ? root.JSCiclo : (req ? safe('./regras-ciclo.js') : null);
  function bem() { return (root && root.JSBemestar) || (req ? safe('./regras-bemestar.js') : null); }
  var api = factory(C, R, T, N, Cy, bem);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSJardim = api;
  if (root && root.JS && root.JS.slots && root.document && api.montarUI) api.montarUI(root.JS);
})(typeof self !== 'undefined' ? self : this, function (C, R, T, N, Cy, bem) {
  'use strict';

  var WINDOW = 14;        // um hábito "está ativo" se a usuária o usou nos últimos 14 dias
  var LOOKBACK = 182;     // 26 semanas para conquistas e semanas floridas
  var CHUNK = 30;

  /* ================= Leitura de sono e skincare (contrato com a frente de bem-estar) ================= */

  function ext(state) { var e = state && state.extras; return e && typeof e === 'object' ? e : {}; }
  function sonoExt(state) { var e = ext(state).sono; return e && typeof e === 'object' ? e : null; }
  function skinExt(state) { var e = ext(state).skincare; return e && typeof e === 'object' ? e : null; }

  function sleepGoal(state) {
    var e = sonoExt(state), g = Number(e && e.goalHours);
    return g >= 4 && g <= 12 ? g : 8;
  }
  function sleepOn(state, date) {
    var b = bem();
    if (b && typeof b.sleepOn === 'function') {
      try { var r = b.sleepOn(state, date); if (r !== undefined) return r || null; } catch (e) { /* usa a leitura direta */ }
    }
    var e = sonoExt(state);
    if (!e || !Array.isArray(e.logs)) return null;
    var found = null;
    e.logs.forEach(function (l) { if (l && l.date === date && Number(l.hours) > 0) found = l; });
    return found;
  }
  function sleepAvg(state, from, to) {
    var b = bem();
    if (b && typeof b.sleepAvg === 'function') {
      try { var r = b.sleepAvg(state, from, to); if (typeof r === 'number' && isFinite(r)) return r; } catch (e) { /* usa a leitura direta */ }
    }
    var e = sonoExt(state);
    if (!e || !Array.isArray(e.logs)) return null;
    var list = e.logs.filter(function (l) { return l && l.date >= from && l.date <= to && Number(l.hours) > 0; });
    if (!list.length) return null;
    return list.reduce(function (a, l) { return a + Number(l.hours); }, 0) / list.length;
  }
  function stepIds(list) { return (Array.isArray(list) ? list : []).map(function (x) { return x && x.id; }).filter(Boolean); }
  function skincareDay(state, date) {
    var b = bem();
    if (b && typeof b.skincareDay === 'function') {
      try { var r = b.skincareDay(state, date); if (r && typeof r === 'object' && 'complete' in r) return r; } catch (e) { /* usa a leitura direta */ }
    }
    var e = skinExt(state), none = { manha: { done: 0, total: 0 }, noite: { done: 0, total: 0 }, complete: false, active: false };
    if (!e || !e.steps) return none;
    var lg = (e.logs && e.logs[date]) || {};
    function part(k) {
      var ids = stepIds(e.steps[k]);
      var done = (Array.isArray(lg[k]) ? lg[k] : []).filter(function (x, i, a) { return ids.indexOf(x) >= 0 && a.indexOf(x) === i; }).length;
      return { done: done, total: ids.length };
    }
    var m = part('manha'), n = part('noite'), total = m.total + n.total;
    return { manha: m, noite: n, active: total > 0, complete: total > 0 && m.done >= m.total && n.done >= n.total };
  }
  function usouSkincare(state, date) {
    var e = skinExt(state), lg = e && e.logs;
    if (!lg || typeof lg !== 'object') return false;
    var l = lg[date];
    return !!(l && ((Array.isArray(l.manha) && l.manha.length) || (Array.isArray(l.noite) && l.noite.length)));
  }
  function usouSono(state, date) { return !!sleepOn(state, date); }

  /* ================= Hábitos, nível e sequência ================= */

  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(list, key) { return list[hash(key) % list.length]; }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function fmtHoras(h) {
    var m = Math.round(Number(h) * 60), hh = Math.floor(m / 60), mm = m % 60;
    return hh + 'h' + (mm ? C.pad(mm) : '');
  }
  function inicioSemana(date) { return C.addDays(date, -C.weekday(date)); }

  function usedWithin(has, d) {
    for (var k = 0; k < WINDOW; k++) if (has(C.addDays(d, -k))) return true;
    return false;
  }

  // Dias de "from" a "to" (inclusive), cada um com { date, habitos, feitos, total, nivel, hoje, futuro }.
  function calc(state, from, to, today) {
    var last = to > today ? today : to;
    var wFrom = C.addDays(from, -(WINDOW - 1));
    var doneW = {}, water = {}, food = {}, occ = {};
    (state.workoutSessions || []).forEach(function (s) { if (s && s.status === 'done' && s.date) doneW[s.date] = true; });
    (state.waterLogs || []).forEach(function (l) { if (l && l.date >= wFrom && l.date <= last) water[l.date] = (water[l.date] || 0) + (Number(l.ml) || 0); });
    var protTarget = N.proteinTarget(state), goal = R.waterGoal(state).ml;
    if (protTarget) (state.foodLogs || []).forEach(function (l) {
      if (!l || l.date < wFrom || l.date > last) return;
      var f = food[l.date] || (food[l.date] = { prot: 0 });
      f.prot += Number(N.logNutrients(state, l).prot) || 0;
    });
    if (from <= last) R.taskOccurrences(state, from, last).forEach(function (o) { if (o.date) (occ[o.date] = occ[o.date] || []).push(o); });
    var hasTreino = function (d) { return !!doneW[d]; }, hasWater = function (d) { return water[d] != null; }, hasFood = function (d) { return food[d] != null; };
    var sGoal = sleepGoal(state);
    var out = [];
    for (var d = from; d <= to; d = C.addDays(d, 1)) {
      var h = [];
      if (d <= today) {
        var plan = T.planForDate(state, d), did = !!doneW[d];
        // A ficha da semana vale para sempre, então só cobra o treino planejado de quem treinou nos últimos 14 dias.
        if (did || (plan.plan && !plan.rest && usedWithin(hasTreino, d))) h.push({ id: 'treino', nome: 'Treino', feito: did, detalhe: did ? 'Treino feito' : 'Treino de ' + plan.plan.name });
        if (usedWithin(hasWater, d)) {
          var ml = water[d] || 0;
          h.push({ id: 'agua', nome: 'Água', feito: ml >= goal, detalhe: R.formatMl(ml) + ' de ' + R.formatMl(goal) });
        }
        if (protTarget && usedWithin(hasFood, d)) {
          var prot = food[d] ? food[d].prot : 0;
          h.push({ id: 'proteina', nome: 'Proteína', feito: prot >= 0.9 * protTarget.value, detalhe: Math.round(prot) + ' g de ' + protTarget.value + ' g' });
        }
        var oc = occ[d];
        if (oc && oc.length) {
          var dn = oc.filter(function (o) { return o.done; }).length;
          h.push({ id: 'tarefas', nome: 'Tarefas', feito: dn / oc.length >= 0.8, detalhe: dn + ' de ' + oc.length + (oc.length === 1 ? ' tarefa' : ' tarefas') });
        }
        if (usedWithin(function (x) { return usouSkincare(state, x); }, d)) {
          var sk = skincareDay(state, d);
          if (sk && sk.active) h.push({ id: 'skincare', nome: 'Skincare', feito: !!sk.complete, detalhe: 'Manhã ' + sk.manha.done + '/' + sk.manha.total + ' • Noite ' + sk.noite.done + '/' + sk.noite.total });
        }
        if (usedWithin(function (x) { return usouSono(state, x); }, d)) {
          var sl = sleepOn(state, d), hrs = sl ? Number(sl.hours) : 0;
          h.push({ id: 'sono', nome: 'Sono', feito: hrs >= sGoal, detalhe: sl ? fmtHoras(hrs) + ' de sono (meta ' + fmtHoras(sGoal) + ')' : 'Sem registro de sono' });
        }
      }
      out.push({ date: d, habitos: h, feitos: h.filter(function (x) { return x.feito; }).length, total: h.length, nivel: nivelDeLista(h), hoje: d === today, futuro: d > today });
    }
    return out;
  }

  function nivelDeLista(h) {
    if (!h.length) return null;
    var f = h.filter(function (x) { return x.feito; }).length / h.length;
    return f === 0 ? 0 : f < 0.5 ? 1 : f < 0.75 ? 2 : f < 1 ? 3 : 4;
  }
  // nivelDoDia(state, date, today) ou nivelDoDia(listaDeHabitos). null = nenhum hábito ativo (o dia não conta).
  function nivelDoDia(a, date, today) {
    if (Array.isArray(a)) return nivelDeLista(a);
    return nivelDeLista(habitosDoDia(a, date, today));
  }
  function habitosDoDia(state, date, today) { return calc(state, date, date, today || date)[0].habitos; }
  // Os últimos n dias, do mais antigo ao de hoje.
  function dias(state, today, n) { return calc(state, C.addDays(today, -(n - 1)), today, today); }
  function intervalo(state, from, to, today) { return calc(state, from, to, today); }

  // Dias seguidos com nível ≥ 2 (hoje ainda aberto só soma, nunca quebra). Procura aos poucos para ser leve.
  function sequencia(state, today) {
    var cur = 0, end = today, first = true;
    for (var chunk = 0; chunk < Math.ceil(LOOKBACK / CHUNK); chunk++) {
      var from = C.addDays(end, -(CHUNK - 1)), arr = calc(state, from, end, today);
      for (var i = arr.length - 1; i >= 0; i--) {
        var d = arr[i];
        if (d.nivel == null) continue;
        if (d.nivel >= 2) cur++;
        else if (!(first && d.hoje)) return cur;
        first = false;
      }
      first = false;
      end = C.addDays(from, -1);
    }
    return cur;
  }
  function melhorDe(arr) {
    var best = 0, run = 0;
    arr.forEach(function (d) {
      if (d.nivel == null) return;
      if (d.nivel >= 2) { run++; if (run > best) best = run; }
      else if (!d.hoje) run = 0;
    });
    return best;
  }
  function melhorSequencia(state, today) { return melhorDe(dias(state, today, LOOKBACK)); }

  // Semanas (domingo a sábado) das últimas n, da mais antiga à atual.
  function semanas(state, today, n) {
    var ini = C.addDays(inicioSemana(today), -(n - 1) * 7), all = calc(state, ini, C.addDays(inicioSemana(today), 6), today), out = [];
    for (var w = 0; w < n; w++) {
      var days = all.slice(w * 7, w * 7 + 7);
      out.push({ inicio: days[0].date, dias: days, floresceu: days.filter(function (d) { return d.nivel != null && d.nivel >= 2; }).length >= 5 });
    }
    return out;
  }
  function semanasFloridas(state, today) {
    return semanas(state, today, LOOKBACK / 7).filter(function (w) { return w.floresceu; }).length;
  }

  /* ================= Conquistas (calculadas do histórico) ================= */

  function maxRun(arr, pred) {
    var best = 0, run = 0;
    arr.forEach(function (d) { if (pred(d)) { run++; if (run > best) best = run; } else run = 0; });
    return best;
  }
  function habito(d, id) { for (var i = 0; i < d.habitos.length; i++) if (d.habitos[i].id === id) return d.habitos[i]; return null; }

  function conquistas(state, today) {
    var arr = dias(state, today, LOOKBACK);
    var done = (state.workoutSessions || []).filter(function (s) { return s.status === 'done'; }).length;
    var prs = 0;
    var ids = {};
    (state.workoutSessions || []).forEach(function (s) { (s.items || []).forEach(function (it) { if (it.sets && it.sets.length) ids[it.exerciseId] = 1; }); });
    Object.keys(ids).forEach(function (id) { prs += T.exerciseRecords(state, id).events.length; });
    var wk = semanasFloridas(state, today);
    var cic = (state.cyclePeriods || []).length;
    var seq = melhorDe(arr);
    function run(id) { return maxRun(arr, function (d) { var h = habito(d, id); return !!(h && h.feito); }); }
    var defs = [
      { id: 'primeiro-treino', titulo: 'Primeiro treino', texto: 'Você fez seu primeiro treino aqui. O começo é a parte mais bonita.', icone: 'dumbbell', atual: done, meta: 1 },
      { id: 'treinos-10', titulo: '10 treinos', texto: 'Dez treinos feitos: a constância está nascendo.', icone: 'dumbbell', atual: done, meta: 10 },
      { id: 'treinos-30', titulo: '30 treinos', texto: 'Trinta treinos! Seu corpo e seu jardim agradecem.', icone: 'dumbbell', atual: done, meta: 30 },
      { id: 'primeiro-recorde', titulo: 'Primeiro recorde', texto: 'Você bateu um recorde pessoal. Força de verdade.', icone: 'trophy', atual: prs, meta: 1 },
      { id: 'recordes-10', titulo: '10 recordes', texto: 'Dez recordes pessoais: você não para de evoluir.', icone: 'trophy', atual: prs, meta: 10 },
      { id: 'agua-7', titulo: 'Semana hidratada', texto: 'Sete dias seguidos com a meta de água batida.', icone: 'drop', atual: run('agua'), meta: 7 },
      { id: 'proteina-7', titulo: 'Proteína em dia', texto: 'Sete dias seguidos com a meta de proteína.', icone: 'flame', atual: run('proteina'), meta: 7 },
      { id: 'skincare-7', titulo: 'Pele cuidada', texto: 'Sete dias seguidos de skincare completo.', icone: 'sparkle', atual: run('skincare'), meta: 7 },
      { id: 'sono-7', titulo: 'Noites de descanso', texto: 'Sete noites seguidas dormindo o que você precisa.', icone: 'moon', atual: run('sono'), meta: 7 },
      { id: 'sequencia-7', titulo: 'Sequência de 7 dias', texto: 'Uma semana inteira de dias floridos.', icone: 'flower', atual: seq, meta: 7 },
      { id: 'sequencia-30', titulo: '30 dias de sequência', texto: 'Um mês inteiro de dias floridos. Que jardim lindo!', icone: 'flower', atual: seq, meta: 30 },
      { id: 'semanas-4', titulo: '4 semanas floridas', texto: 'Quatro semanas com pelo menos 5 dias floridos.', icone: 'flower', atual: wk, meta: 4 },
      { id: 'ciclos-3', titulo: 'Ciclos acompanhados', texto: 'Três ciclos registrados: você está se conhecendo melhor.', icone: 'moon', atual: cic, meta: 3 }
    ];
    var vistos = readExt(state).vistos || {};
    return defs.map(function (d) {
      var feito = d.atual >= d.meta;
      return { id: d.id, titulo: d.titulo, texto: d.texto, icone: d.icone, feito: feito, atual: Math.min(d.atual, d.meta), meta: d.meta,
        progresso: Math.min(d.atual, d.meta) + ' de ' + d.meta, novo: feito && !vistos[d.id] };
    });
  }

  function readExt(state) { var j = ext(state).jardim; return j && typeof j === 'object' ? j : {}; }

  /* ================= Frases gentis ================= */

  function fraseDoDia(hoje, semanaFraca, key) {
    if (semanaFraca) {
      return pick(['Semana mais quietinha? Tudo bem: jardim também descansa. Recomeçar é bonito 🌷',
        'Sem pressa. Um passinho de cada vez já faz o jardim sorrir 🌱',
        'Cada dia é um recomeço, e seu jardim espera com carinho 🌷'], key);
    }
    if (!hoje || !hoje.total) return 'Seu jardim está esperando o primeiro hábito de hoje 🌱';
    if (hoje.feitos === hoje.total) return pick(['Seu jardim está em flor hoje 🌸', 'Tudo florido por aqui. Que dia lindo! 🌺', 'Dia completo: seu jardim agradece 🌸'], key);
    if (hoje.feitos === 0) return pick(['Um passinho de cada vez: a primeira florzinha do dia espera por você 🌱', 'Hoje ainda dá tempo de regar o jardim 💧', 'Sem pressa: comece pelo hábito mais leve 🌿'], key);
    return pick(['Cada hábito é uma gotinha de carinho no seu jardim 💧', 'Está florescendo, continue no seu ritmo 🌷', 'Mais um pouquinho e a flor de hoje abre 🌼'], key);
  }
  function semanaFraca(arr) {
    var ativos = arr.filter(function (d) { return d.nivel != null && !d.hoje; });
    if (ativos.length < 3) return false;
    var s = ativos.reduce(function (a, d) { return a + d.nivel; }, 0) / ativos.length;
    return s < 1.5;
  }

  /* ================= Desenho da flor (compartilhado entre SVG da tela e canvas dos cartões) ================= */

  function petalas(n, cx, cy, rx, ry, dist, rot0, back) {
    var out = [];
    for (var i = 0; i < n; i++) out.push({ k: back ? 'petalaFundo' : 'petala', cx: cx, cy: cy - dist, rx: rx, ry: ry, rot: [rot0 + i * 360 / n, cx, cy] });
    return out;
  }
  // Formas (viewBox 40×40) de cada nível: [{ k, d | cx cy rx ry rot | r }]. null = ponto discreto (sem hábito / futuro).
  function formas(nivel) {
    var folhas = function (y, s) {
      return [{ k: 'folha', d: 'M20 ' + y + 'c-' + (6 * s) + ' 0-' + (9 * s) + '-3-' + (9 * s) + '-' + (8 * s) + ' ' + (6 * s) + ' 0 ' + (9 * s) + ' 3 ' + (9 * s) + ' ' + (8 * s) + 'Z' },
        { k: 'folha', d: 'M20 ' + (y - 2) + 'c' + (5 * s) + ' 0 ' + (8 * s) + '-3 ' + (8 * s) + '-' + (7 * s) + '-' + (5 * s) + ' 0-' + (8 * s) + ' 3-' + (8 * s) + ' ' + (7 * s) + 'Z' }];
    };
    if (nivel == null) return [{ k: 'ponto', cx: 20, cy: 30, r: 1.7 }];
    if (nivel === 0) return [{ k: 'terra', d: 'M12 35.5h16' }, { k: 'semente', cx: 20, cy: 31.5, rx: 4.2, ry: 3 }];
    if (nivel === 1) return [{ k: 'caule', d: 'M20 35V25' }].concat(folhas(30, 1));
    if (nivel === 2) return [{ k: 'caule', d: 'M20 35V21' }].concat(folhas(32, 0.8), [
      { k: 'botao', d: 'M20 23c-5-4-5-10 0-14 5 4 5 10 0 14Z' }, { k: 'sepala', d: 'M15.6 22c2 2 6.800 2 8.800 0' }]);
    if (nivel === 3) return [{ k: 'caule', d: 'M20 35V21' }].concat(folhas(32, 0.85), petalas(5, 20, 15, 3.4, 5, 6, 0, false), [{ k: 'miolo', cx: 20, cy: 15, r: 3.2 }]);
    return [{ k: 'caule', d: 'M20 36V22' }].concat(folhas(33, 0.9), petalas(8, 20, 15, 3, 5.6, 7, 22.5, true), petalas(8, 20, 15, 3.2, 5.4, 6.4, 0, false), [
      { k: 'miolo', cx: 20, cy: 15, r: 3.4 }, { k: 'brilho', d: 'M33.500 3l1 3.500 3.500 1-3.500 1-1 3.500-1-3.500-3.500-1 3.500-1Z' }]);
  }
  var NOMES = ['semente', 'broto', 'botão', 'flor aberta', 'florada completa'];

  /* ================= Interface ================= */

  function montarUI(JS) {
    var ui = JS.ui, esc = ui.esc, animou = false, mostrado = null;
    var cacheC = { t: 0, key: '', val: null };

    function svgForma(f) {
      switch (f.k) {
        case 'caule': return '<path class="jd-caule" d="' + f.d + '"/>';
        case 'folha': return '<path class="jd-folha" d="' + f.d + '"/>';
        case 'terra': return '<path class="jd-terra" d="' + f.d + '"/>';
        case 'sepala': return '<path class="jd-sepala" d="' + f.d + '"/>';
        case 'botao': return '<path class="jd-botao" d="' + f.d + '"/>';
        case 'brilho': return '<path class="jd-brilho" d="' + f.d + '"/>';
        case 'semente': return '<ellipse class="jd-semente" cx="' + f.cx + '" cy="' + f.cy + '" rx="' + f.rx + '" ry="' + f.ry + '"/>';
        case 'ponto': return '<circle class="jd-ponto" cx="' + f.cx + '" cy="' + f.cy + '" r="' + f.r + '"/>';
        case 'miolo': return '<circle class="jd-miolo" cx="' + f.cx + '" cy="' + f.cy + '" r="' + f.r + '"/>';
        default: return '<ellipse class="jd-' + (f.k === 'petalaFundo' ? 'petala fundo' : 'petala') + '" cx="' + f.cx + '" cy="' + f.cy + '" rx="' + f.rx + '" ry="' + f.ry +
          '" transform="rotate(' + f.rot[0].toFixed(1) + ' ' + f.rot[1] + ' ' + f.rot[2] + ')"/>';
      }
    }
    // SVG de uma flor. variante muda a cor das pétalas (rosa, lavanda ou pêssego).
    function flor(nivel, variante) {
      return '<svg class="jd-f jd-n' + (nivel == null ? 'x' : nivel) + ' jd-v' + ((variante || 0) % 3) + '" viewBox="0 0 40 40" focusable="false" aria-hidden="true">' +
        formas(nivel).map(svgForma).join('') + '</svg>';
    }
    function vari(date) { return Math.abs(C.diffDays('2000-01-01', date)) % 3; }

    function cel(d, i) {
      var cls = 'jd-cel' + (d.hoje ? ' hoje' : '') + (d.futuro ? ' futuro' : '');
      return '<span class="' + cls + '" style="--i:' + i + '">' + flor(d.futuro ? null : d.nivel, vari(d.date)) + '</span>';
    }

    /* ---- cartão do Início ---- */

    function resumoAria(arr) {
      return 'Seu jardim das últimas duas semanas: ' + arr.filter(function (d) { return !d.futuro && d.nivel != null; }).map(function (d) {
        return C.formatDayMonth(d.date) + ' ' + NOMES[d.nivel];
      }).join(', ') + '.';
    }

    function cartaoInicio(state, now) {
      if (readExt(state).hide) return '';
      var today = C.toDateKey(now), ini = C.addDays(inicioSemana(today), -7), arr = calc(state, ini, C.addDays(ini, 13), today);
      var hoje = arr.filter(function (d) { return d.date === today; })[0];
      var temAlgo = arr.some(function (d) { return d.nivel != null; });
      var head = function (extra) { return '<div class="card-head"><h2>' + ui.icon('flower', 18) + 'Jardim da Julia</h2>' + (extra || '') + '</div>'; };
      if (!temAlgo) {
        return '<section class="card jd-card jd-vazio" data-jardim>' + head() + '<div class="jd-vazio-in"><span class="jd-semente-g" aria-hidden="true">' + flor(1, 0) + '</span>' +
          '<p>Seu jardim começa com um passinho: registre um treino, um copo d\'água ou conclua uma tarefa, e a primeira florzinha nasce 🌱</p></div></section>';
      }
      var seq = sequencia(state, today), fraca = semanaFraca(calc(state, C.addDays(today, -6), today, today));
      var rotulos = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
      var grade = '<div class="jd-cab" aria-hidden="true">' + rotulos.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>' +
        '<div class="jd-grade jd-mini">' + arr.map(function (d, i) { return cel(d, i); }).join('') + '</div>';
      var chips = hoje && hoje.habitos.length
        ? '<ul class="jd-chips" aria-label="Hábitos de hoje">' + hoje.habitos.map(function (h) {
          return '<li><span class="jd-chip' + (h.feito ? ' on' : '') + '">' + (h.feito ? ui.icon('check', 14) : '<i class="jd-bola" aria-hidden="true"></i>') + esc(h.nome) + '</span></li>';
        }).join('') + '</ul>' : '';
      var novas = conquistasRapido(state, today).filter(function (c) { return c.novo; });
      var cls = animou ? '' : ' jd-entra';
      animou = true;
      return '<section class="card jd-card' + cls + '" data-jardim>' +
        head(seq > 0 ? '<span class="count jd-seq" title="Dias seguidos com a flor aberta">' + plural(seq, 'dia', 'dias') + ' seguidos</span>' : '') +
        '<button type="button" class="jd-abrir" data-action="jardim-abrir" aria-label="Abrir meu jardim. ' + esc(resumoAria(arr)) + '">' + grade + '</button>' +
        '<p class="jd-hoje"><strong>' + (hoje && hoje.total ? 'Hoje: ' + hoje.feitos + ' de ' + hoje.total + (hoje.total === 1 ? ' hábito' : ' hábitos') : 'Hoje ainda sem hábitos') + '</strong></p>' + chips +
        '<p class="jd-frase">' + esc(fraseDoDia(hoje, fraca, today)) + '</p>' +
        (novas.length ? '<button type="button" class="jd-nova" data-action="jardim-abrir">' + ui.icon('trophy', 16) + 'Nova conquista: <strong>' + esc(novas[0].titulo) + '</strong>' + (novas.length > 1 ? ' e mais ' + (novas.length - 1) : '') + '</button>' : '') +
        '<button type="button" class="btn soft small jd-btn" data-action="jardim-abrir">' + ui.icon('flower', 16) + 'Abrir meu jardim</button></section>';
    }
    // As conquistas varrem 26 semanas: no Início, reaproveita o cálculo por alguns segundos.
    function conquistasRapido(state, today) {
      var now = Date.now(), key = today + '|' + (state.workoutSessions || []).length + '|' + (state.waterLogs || []).length + '|' + (state.foodLogs || []).length;
      if (cacheC.key === key && now - cacheC.t < 8000) return cacheC.val;
      cacheC = { t: now, key: key, val: conquistas(state, today) };
      return cacheC.val;
    }

    /* ---- jardim completo (folha) ---- */

    function detalheDia(d, today) {
      if (d.futuro) return '<p class="muted small">Esse dia ainda não chegou 🌱</p>';
      var titulo = '<p class="jd-det-t"><strong>' + esc(C.formatDayLabel(d.date, today)) + ' • ' + esc(C.formatDayMonth(d.date)) + '</strong>' + (d.nivel != null ? ' <span class="muted small">' + esc(NOMES[d.nivel]) + '</span>' : '') + '</p>';
      if (!d.habitos.length) return titulo + '<p class="muted small">Sem hábitos acompanhados neste dia. Tudo bem, jardim também descansa.</p>';
      return titulo + '<ul class="jd-det">' + d.habitos.map(function (h) {
        return '<li class="' + (h.feito ? 'ok' : '') + '"><span class="jd-det-ic" aria-hidden="true">' + (h.feito ? ui.icon('check', 14) : '') + '</span><span><strong>' + esc(h.nome) + '</strong><small>' + esc(h.detalhe) + (d.hoje && !h.feito ? ' • dá tempo!' : '') + '</small></span></li>';
      }).join('') + '</ul>';
    }

    function abrir(dataSel) {
      var state = JS.store.state, today = C.toDateKey(new Date());
      var wk = semanas(state, today, 12), flat = [];
      wk.forEach(function (w) { w.dias.forEach(function (d) { flat.push(d); }); });
      var seq = sequencia(state, today), melhor = melhorSequencia(state, today), floridas = wk.filter(function (w) { return w.floresceu; }).length;
      var cons = conquistas(state, today), ganhas = cons.filter(function (c) { return c.feito; });
      var rotulos = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
      var linhas = wk.map(function (w, wi) {
        return '<div class="jd-linha"><span class="jd-sem' + (w.floresceu ? ' flor' : '') + '" title="' + (w.floresceu ? 'Semana florida' : '') + '">' + esc(C.formatDayMonth(w.inicio)) + '</span>' +
          w.dias.map(function (d, i) {
            var cls = 'jd-cel' + (d.hoje ? ' hoje' : '') + (d.futuro ? ' futuro' : '');
            return '<button type="button" class="' + cls + '" style="--i:' + (wi + i) + '" data-date="' + d.date + '" aria-label="' + esc(C.formatDateLong(d.date) + ': ' + (d.futuro ? 'ainda não chegou' : d.nivel == null ? 'sem hábitos' : NOMES[d.nivel])) + '">' + flor(d.futuro ? null : d.nivel, vari(d.date)) + '</button>';
          }).join('') + '</div>';
      }).join('');
      var legenda = '<ul class="jd-leg" aria-label="Legenda">' + [0, 1, 2, 3, 4].map(function (n) { return '<li>' + flor(n, 0) + '<span>' + NOMES[n] + '</span></li>'; }).join('') + '</ul>';
      var selDia = flat.filter(function (d) { return d.date === (dataSel || today); })[0] || flat.filter(function (d) { return d.hoje; })[0];
      var badges = cons.map(function (c) {
        return '<li class="jd-badge ' + (c.feito ? 'on' : '') + '"><span class="jd-bic" aria-hidden="true">' + ui.icon(c.icone, 20) + '</span><span class="jd-btx"><strong>' + esc(c.titulo) + (c.novo ? ' <em class="jd-novo">novo</em>' : '') + '</strong>' +
          '<small>' + (c.feito ? esc(c.texto) : 'Falta pouco: ' + esc(c.progresso)) + '</small></span>' +
          (c.feito ? '<button type="button" class="icon-btn sm" data-share-badge="' + esc(c.id) + '" aria-label="Compartilhar a conquista ' + esc(c.titulo) + '">' + ui.icon('share', 16) + '</button>' : '') + '</li>';
      }).join('');
      var body = '<div class="jd-sum"><div><strong>' + seq + '</strong><span>' + (seq === 1 ? 'dia' : 'dias') + ' seguidos</span></div><div><strong>' + melhor + '</strong><span>melhor sequência</span></div><div><strong>' + floridas + '</strong><span>' + (floridas === 1 ? 'semana florida' : 'semanas floridas') + '</span></div></div>' +
        '<p class="hint">Cada dia vira uma flor conforme os hábitos que você acompanha (treino, água, proteína, tarefas, skincare e sono). Dia sem hábito não conta e não quebra a sequência. Toque numa flor para ver o dia.</p>' +
        legenda +
        '<div class="jd-cab jd-cab-g" aria-hidden="true"><span></span>' + rotulos.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>' +
        '<div class="jd-grade jd-grande">' + linhas + '</div>' +
        '<div class="jd-detalhe" data-det aria-live="polite">' + detalheDia(selDia, today) + '</div>' +
        '<h3 class="form-sub jd-h3">Conquistas <span class="count">' + ganhas.length + ' de ' + cons.length + '</span></h3><ul class="jd-badges">' + badges + '</ul>' +
        '<button type="button" class="btn soft full" data-share-jardim>' + ui.icon('share', 18) + 'Compartilhar meu jardim</button>';
      ui.openSheet({
        title: 'Meu jardim', subtitle: seq > 0 ? plural(seq, 'dia', 'dias') + ' de sequência' : 'Um passinho de cada vez', body: body,
        onOpen: function (form) {
          form.querySelector('.jd-grande').classList.add('jd-aparece');
          form.addEventListener('click', function (e) {
            var c = e.target.closest('.jd-grande .jd-cel[data-date]');
            if (c) {
              form.querySelectorAll('.jd-cel.sel').forEach(function (x) { x.classList.remove('sel'); });
              c.classList.add('sel');
              form.querySelector('[data-det]').innerHTML = detalheDia(flat.filter(function (d) { return d.date === c.dataset.date; })[0], today);
              return;
            }
            var sb = e.target.closest('[data-share-badge]');
            if (sb) {
              var cq = cons.filter(function (x) { return x.id === sb.dataset.shareBadge; })[0];
              if (cq && JS.cartoes) JS.cartoes.share('conquista', { titulo: cq.titulo, texto: cq.texto });
              return;
            }
            if (e.target.closest('[data-share-jardim]') && JS.cartoes) {
              JS.cartoes.share('jardim', { sequencia: seq, melhor: melhor, semanasFloridas: floridas, niveis: flat.slice(-14).map(function (d) { return d.futuro ? null : d.nivel; }) });
            }
          });
          // Marca as conquistas como vistas (sem redesenhar a tela por baixo).
          var novas = cons.filter(function (c) { return c.novo; });
          if (novas.length) JS.store.silentUpdate(function (st) { var j = extGravar(st); novas.forEach(function (c) { j.vistos[c.id] = today; }); });
          cacheC = { t: 0, key: '', val: null };
        }
      });
    }
    function extGravar(state) {
      var e = state.extras = state.extras && typeof state.extras === 'object' ? state.extras : {};
      var j = e.jardim = e.jardim && typeof e.jardim === 'object' ? e.jardim : {};
      if (!j.vistos || typeof j.vistos !== 'object') j.vistos = {};
      return j;
    }

    /* ---- registros ---- */

    JS.slots.add('inicio.meio', cartaoInicio, 40);
    JS.slots.add('config.secoes', function (state) {
      var oculto = !!readExt(state).hide;
      return '<section class="card" id="cfg-jardim"><div class="card-head"><h2>' + ui.icon('flower', 18) + 'Jardim da Julia</h2></div>' +
        '<label class="switch-row"><span class="switch-text"><strong>Mostrar o Jardim no Início</strong><small>Um cantinho gentil com os hábitos do dia, sem cobranças.</small></span>' +
        '<input type="checkbox" class="switch" data-change="jardim-mostrar" name="jardimMostrar"' + (oculto ? '' : ' checked') + '></label>' +
        '<button type="button" class="btn soft full" data-action="jardim-abrir">' + ui.icon('flower', 18) + 'Ver meu jardim</button></section>';
    }, 50);
    JS.actions['jardim-abrir'] = function () { abrir(); };
    JS.changes['jardim-mostrar'] = function (el) {
      JS.store.update(function (s) { extGravar(s).hide = !el.checked; });
      ui.toast(el.checked ? 'O Jardim voltou para o Início 🌷' : 'Jardim escondido do Início.');
    };
    if (JS.search && JS.search.shortcuts) {
      JS.search.shortcuts.push(['Jardim da Julia', 'jardim sequencia habitos conquistas selos', 'flower', { action: 'jardim-abrir' }]);
    }
    JS.jardim = { abrir: abrir, flor: flor, formas: formas, cartaoInicio: cartaoInicio };
  }

  return {
    habitosDoDia: habitosDoDia, nivelDoDia: nivelDoDia, dias: dias, intervalo: intervalo, sequencia: sequencia, melhorSequencia: melhorSequencia,
    semanas: semanas, semanasFloridas: semanasFloridas, conquistas: conquistas, formas: formas, nivelDeLista: nivelDeLista, inicioSemana: inicioSemana,
    fraseDoDia: fraseDoDia, semanaFraca: semanaFraca, hash: hash, pick: pick, fmtHoras: fmtHoras,
    leitura: { sleepOn: sleepOn, sleepAvg: sleepAvg, sleepGoal: sleepGoal, skincareDay: skincareDay },
    NOMES: NOMES, montarUI: montarUI
  };
});
