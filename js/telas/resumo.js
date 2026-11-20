/*
 * J.S. — Resumo semanal (rota "resumo").
 * Semana de domingo a sábado, com um texto carinhoso gerado por regras (as frases são escolhidas de forma
 * determinística pela semana: abrir de novo mostra o mesmo texto), blocos só do que tem dados, mini-jardim da
 * semana e botão de compartilhar (cartão). Tudo calculado no aparelho.
 *
 * Módulo puro (semana, texto) para testes no Node; a tela só monta quando há window.JS.
 */
(function (root, factory) {
  var req = typeof require === 'function';
  function safe(p) { try { return require(p); } catch (e) { return null; } }
  var C = root && root.JSCore ? root.JSCore : (req ? require('../core.js') : null);
  var R = root && root.JSRegras ? root.JSRegras : (req ? require('../regras.js') : null);
  var T = root && root.JSTreino ? root.JSTreino : (req ? require('../regras-treino.js') : null);
  var N = root && root.JSNutri ? root.JSNutri : (req ? require('../regras-nutricao.js') : null);
  var Cy = root && root.JSCiclo ? root.JSCiclo : (req ? safe('../regras-ciclo.js') : null);
  var Jd = root && root.JSJardim ? root.JSJardim : (req ? require('../jardim.js') : null);
  var api = factory(C, R, T, N, Cy, Jd);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSResumo = api;
  if (root && root.JS && root.JS.slots && root.document && api.montarUI) api.montarUI(root.JS);
})(typeof self !== 'undefined' ? self : this, function (C, R, T, N, Cy, Jd) {
  'use strict';

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function fmt(n, dec) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec == null ? 1 : dec }); }
  function plural(n, um, varios) { return fmt(n, 0) + ' ' + (Number(n) === 1 ? um : varios); }
  function duracao(min) { return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + C.pad(min % 60) + ' min'; }
  function periodo(ini) {
    var fim = C.addDays(ini, 6), a = ini.split('-').map(Number), b = fim.split('-').map(Number);
    if (a[1] === b[1]) return a[2] + ' a ' + b[2] + ' de ' + MESES[b[1] - 1];
    return a[2] + ' ' + MES3[a[1] - 1] + ' a ' + b[2] + ' ' + MES3[b[1] - 1];
  }
  function inicioDaSemana(date) { return Jd.inicioSemana(date); }

  /* ================= Dados da semana ================= */

  function semana(state, inicio, today) {
    var fim = C.addDays(inicio, 6), ate = fim > today ? today : fim;
    var sem = { inicio: inicio, fim: fim, ate: ate, decorridos: inicio > today ? 0 : C.diffDays(inicio, ate) + 1, atual: inicio <= today && today <= fim, futura: inicio > today,
      treino: null, alimentacao: null, agua: null, peso: null, tarefas: null, sono: null, ciclo: null, skincare: null, jardim: null, vazia: true };
    if (sem.futura) return sem;
    var d;

    // Treino
    var feitas = (state.workoutSessions || []).filter(function (s) { return s.status === 'done' && s.date >= inicio && s.date <= fim; });
    var planejados = 0;
    for (d = inicio; d <= fim; d = C.addDays(d, 1)) { var p = T.planForDate(state, d); if (p.plan && !p.rest) planejados++; }
    if (feitas.length || planejados) {
      var series = 0, volume = 0, minutos = 0, dd = {}, ids = {};
      feitas.forEach(function (s) {
        var sm = T.sessionSummary(state, s);
        series += sm.sets; volume += sm.volume; minutos += sm.minutes; dd[s.date] = 1;
        s.items.forEach(function (it) { if (it.sets.length) ids[it.exerciseId] = 1; });
      });
      var porEx = {};
      Object.keys(ids).forEach(function (id) {
        T.exerciseRecords(state, id).events.forEach(function (e) {
          if (e.date < inicio || e.date > fim) return;
          var cur = porEx[id];
          if (!cur || (e.kind === 'carga' && (cur.kind !== 'carga' || e.load > cur.load)) || (e.kind === cur.kind && e.kind === 'reps' && e.reps > cur.reps)) porEx[id] = e;
        });
      });
      var recordes = Object.keys(porEx).map(function (id) { return porEx[id]; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      sem.treino = { feitos: feitas.length, dias: Object.keys(dd).length, planejados: planejados, series: series, volume: Math.round(volume), minutos: minutos, recordes: recordes };
      if (feitas.length) sem.vazia = false;
    }

    // Alimentação
    var diasA = 0, kcal = 0, prot = 0, kt = N.kcalTarget(state, today), pt = N.proteinTarget(state);
    for (d = inicio; d <= ate; d = C.addDays(d, 1)) {
      var dl = N.dayLog(state, d);
      if (dl.count > 0) { diasA++; kcal += dl.total.kcal || 0; prot += dl.total.prot || 0; }
    }
    if (diasA) {
      var pm = prot / diasA;
      sem.alimentacao = { dias: diasA, kcalMedia: Math.round(kcal / diasA), protMedia: Math.round(pm), kcalMeta: kt ? kt.value : null, protMeta: pt ? pt.value : null, protPct: pt ? Math.round(pm / pt.value * 100) : null };
      sem.vazia = false;
    }

    // Água
    var diasW = 0, ml = 0, diasMeta = 0, goal = R.waterGoal(state).ml;
    for (d = inicio; d <= ate; d = C.addDays(d, 1)) {
      var t = R.waterTotal(state, d);
      if (t > 0) { diasW++; ml += t; }
      if (t >= goal) diasMeta++;
    }
    if (diasW) { sem.agua = { dias: diasW, mediaMl: Math.round(ml / diasW), meta: goal, diasMeta: diasMeta }; sem.vazia = false; }

    // Peso (variação na semana, comparando com a última pesagem antes dela)
    var recs = (state.bodyRecords || []).filter(function (r) { return Number(r.weightKg) > 0 && r.date; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var nasem = recs.filter(function (r) { return r.date >= inicio && r.date <= fim; }), antes = recs.filter(function (r) { return r.date < inicio; }).pop();
    if (nasem.length) {
      var atual = Number(nasem[nasem.length - 1].weightKg), base = antes ? Number(antes.weightKg) : (nasem.length > 1 ? Number(nasem[0].weightKg) : null);
      sem.peso = { atual: atual, variacao: base == null ? null : Math.round((atual - base) * 10) / 10 };
      sem.vazia = false;
    }

    // Tarefas
    var oc = R.taskOccurrences(state, inicio, ate).filter(function (o) { return o.date; });
    if (oc.length) {
      var f = oc.filter(function (o) { return o.done; }).length;
      sem.tarefas = { total: oc.length, feitas: f, pct: Math.round(f / oc.length * 100) };
      if (f) sem.vazia = false;
    }

    // Sono e skincare (frente de bem-estar; só aparece se houver dados)
    var L = Jd.leitura, ma = L.sleepAvg(state, inicio, fim);
    if (ma != null) {
      var noites = 0;
      for (d = inicio; d <= ate; d = C.addDays(d, 1)) if (L.sleepOn(state, d)) noites++;
      sem.sono = { media: ma, noites: noites, meta: L.sleepGoal(state) };
      sem.vazia = false;
    }
    var sk = 0, skOk = 0;
    for (d = inicio; d <= ate; d = C.addDays(d, 1)) {
      var s1 = L.skincareDay(state, d), usou = s1 && s1.active && ((s1.manha && s1.manha.done > 0) || (s1.noite && s1.noite.done > 0));
      if (usou) { sk++; if (s1.complete) skOk++; }
    }
    if (sk) { sem.skincare = { dias: sk, completos: skOk }; sem.vazia = false; }

    // Ciclo: fases da semana e energia média
    if (Cy && Cy.enabled && Cy.enabled(state)) {
      var fases = [], en = [];
      for (d = inicio; d <= ate; d = C.addDays(d, 1)) {
        var info = Cy.dayInfo(state, d, today), lg = Cy.dayLog(state, d);
        if (info && Cy.PHASES[info.phase] && fases.indexOf(Cy.PHASES[info.phase].name) < 0) fases.push(Cy.PHASES[info.phase].name);
        if (lg && lg.energy) en.push(lg.energy);
      }
      if (fases.length) sem.ciclo = { fases: fases, energia: en.length ? Math.round(en.reduce(function (a, b) { return a + b; }, 0) / en.length * 10) / 10 : null, registros: en.length };
    }

    // Jardim da semana
    var dias = Jd.intervalo(state, inicio, fim, today);
    sem.jardim = { niveis: dias.map(function (x) { return x.futuro ? null : x.nivel; }), floresceu: dias.filter(function (x) { return x.nivel != null && x.nivel >= 2; }).length >= 5 };
    return sem;
  }

  /* ================= Texto carinhoso (determinístico) ================= */

  function texto(sem) {
    var k = sem.inicio, P = Jd.pick, partes = [], dest = [];
    if (sem.futura) return { paragrafo: 'Essa semana ainda não chegou 🌱', destaques: [] };
    if (sem.vazia && !(sem.treino && sem.treino.planejados)) {
      return { paragrafo: P(['Esta semana ainda não tem registros por aqui. Quando você usar o app, o resumo aparece com todo o carinho 🌱',
        'Semana tranquila por aqui: nada registrado ainda. Sem pressa, o jardim espera 🌷'], k + 'v'), destaques: [] };
    }
    var tr = sem.treino, al = sem.alimentacao, ag = sem.agua;
    if (tr && tr.feitos > 0) {
      var n = tr.feitos, rec = tr.recordes.length;
      var f = P(['Você treinou ' + (n === 1 ? 'uma vez' : n + ' vezes'), 'Foram ' + plural(n, 'treino', 'treinos') + ' nesta semana', n === 1 ? 'Você fez 1 treino' : 'Você fez ' + n + ' treinos'], k + 't');
      if (rec) f += P([' e bateu ' + plural(rec, 'recorde pessoal', 'recordes pessoais') + ' 🏆', ', com ' + plural(rec, 'recorde', 'recordes') + ' no caminho 🏆'], k + 'r');
      else if (tr.planejados && n >= tr.planejados) f += ', cumprindo o que planejou 💪';
      partes.push(f + '.');
      dest.push({ icone: 'dumbbell', texto: plural(n, 'treino', 'treinos') });
      if (rec) dest.push({ icone: 'trophy', texto: plural(rec, 'recorde', 'recordes') });
    } else if (tr && tr.planejados > 0) {
      partes.push(sem.atual && sem.ate < sem.fim ? 'A semana está só começando: ainda dá tempo de treinar 💫.' : 'O treino ficou para outra hora desta vez. Sem pressão: a próxima semana é uma folha em branco 🌷.');
    }
    if (al && al.protMeta) {
      var pc = al.protPct;
      if (pc >= 90) partes.push(P(['Sua proteína ficou em dia (' + al.protMedia + ' g por dia, em média).', 'A proteína esteve na meta: ' + al.protMedia + ' g por dia, em média.'], k + 'p'));
      else if (pc >= 60) partes.push(P(['A proteína ficou perto da meta (' + pc + '%).', 'Você chegou a ' + pc + '% da meta de proteína, quase lá.'], k + 'p'));
      else partes.push('Dá para caprichar um pouquinho mais na proteína na próxima semana.');
      dest.push({ icone: 'dumbbell', texto: 'proteína ' + pc + '% da meta' });
    } else if (al) {
      partes.push('Você registrou a alimentação em ' + plural(al.dias, 'dia', 'dias') + '.');
    }
    if (ag) {
      if (ag.diasMeta > 0) partes.push(P(['A água bateu a meta em ' + ag.diasMeta + ' de ' + sem.decorridos + ' dias 💧.', 'Você se hidratou direitinho: meta de água em ' + ag.diasMeta + ' de ' + sem.decorridos + ' dias 💧.'], k + 'a'));
      else partes.push('A água ainda está pedindo um carinho: um copinho de cada vez 💧.');
      if (ag.diasMeta > 0) dest.push({ icone: 'drop', texto: 'água na meta em ' + ag.diasMeta + (ag.diasMeta === 1 ? ' dia' : ' dias') });
    }
    if (sem.sono) partes.push('Você dormiu, em média, ' + Jd.fmtHoras(sem.sono.media) + ' por noite' + (sem.sono.media >= sem.sono.meta ? ' 🌙.' : '. Descanso também é cuidado 🌙.'));
    if (sem.ciclo && sem.ciclo.energia != null) partes.push('Sua energia média foi ' + fmt(sem.ciclo.energia) + ' de 5.');
    if (sem.tarefas && sem.tarefas.total >= 3) dest.push({ icone: 'check', texto: sem.tarefas.pct + '% das tarefas' });
    partes.push(sem.jardim && sem.jardim.floresceu
      ? P(['Seu jardim floresceu esta semana 🌸', 'Mais uma semana florida no seu jardim 🌺'], k + 'j') + '.'
      : P(['Cada semana é um recomeço, e seu jardim continua aqui, com carinho 🌷.', 'Um passinho de cada vez já faz o jardim sorrir 🌱.'], k + 'j'));
    return { paragrafo: partes.join(' '), destaques: dest.slice(0, 5) };
  }

  // Dados do cartão de compartilhar (sem peso, medidas, ciclo nem sono).
  function paraCartao(sem, tx) {
    var itens = [], tr = sem.treino, al = sem.alimentacao, ag = sem.agua;
    if (tr && tr.feitos) itens.push({ valor: String(tr.feitos), rotulo: tr.feitos === 1 ? 'treino' : 'treinos' });
    if (tr && tr.recordes.length) itens.push({ valor: String(tr.recordes.length), rotulo: tr.recordes.length === 1 ? 'recorde' : 'recordes' });
    if (tr && tr.series) itens.push({ valor: String(tr.series), rotulo: 'séries' });
    if (al && al.protPct != null) itens.push({ valor: al.protPct + '%', rotulo: 'da meta de proteína' });
    if (ag && ag.diasMeta) itens.push({ valor: ag.diasMeta + '/' + sem.decorridos, rotulo: 'dias de água' });
    if (sem.tarefas && sem.tarefas.total >= 3) itens.push({ valor: sem.tarefas.pct + '%', rotulo: 'das tarefas' });
    var frase = sem.jardim && sem.jardim.floresceu ? 'Meu jardim floresceu esta semana.' : 'Um passinho de cada vez.';
    return { periodo: periodo(sem.inicio), frase: frase, itens: itens.slice(0, 6), niveis: sem.jardim ? sem.jardim.niveis : null };
  }

  /* ================= Tela ================= */

  function montarUI(JS) {
    var ui = JS.ui, esc = ui.esc, view = { week: null };

    function tile(rotulo, valor, sub) { return '<div class="stat"><span class="stat-label">' + esc(rotulo) + '</span><strong>' + valor + '</strong>' + (sub ? '<span class="stat-sub">' + sub + '</span>' : '') + '</div>'; }
    function bloco(titulo, icone, inner) { return '<section class="card rs-bloco"><div class="card-head"><h2>' + ui.icon(icone, 18) + esc(titulo) + '</h2></div>' + inner + '</section>'; }
    function chips(list) {
      return list.length ? '<ul class="jd-chips rs-dest" aria-label="Destaques">' + list.map(function (d) { return '<li><span class="jd-chip on">' + ui.icon(d.icone, 14) + esc(d.texto) + '</span></li>'; }).join('') + '</ul>' : '';
    }

    function render(now) {
      var s = JS.store.state, today = C.toDateKey(now), cur = inicioDaSemana(today), ini = view.week || cur;
      var sem = semana(s, ini, today), tx = texto(sem);
      var html = '<h1 class="page-title">Resumo da semana</h1><p class="page-sub">Seu balanço, com carinho.</p>' +
        '<div class="month-nav rs-nav"><button type="button" class="icon-btn" data-action="resumo-sem" data-delta="-1" aria-label="Semana anterior">' + ui.icon('left') + '</button>' +
        '<strong>' + esc(periodo(ini)) + '</strong>' +
        '<button type="button" class="icon-btn" data-action="resumo-sem" data-delta="1" aria-label="Próxima semana"' + (ini >= cur ? ' disabled' : '') + '>' + ui.icon('right') + '</button></div>';
      html += '<section class="card rs-hero"><p class="eyebrow">' + (sem.atual ? 'ESTA SEMANA, ATÉ HOJE' : ini === C.addDays(cur, -7) ? 'SEMANA QUE PASSOU' : 'RESUMO') + '</p>' +
        '<p class="rs-texto">' + esc(tx.paragrafo) + '</p>' + chips(tx.destaques) +
        (sem.vazia ? '' : '<div class="btn-row tight"><button type="button" class="btn primary small" data-action="resumo-share">' + ui.icon('share', 16) + 'Compartilhar</button></div>') + '</section>';

      var tr = sem.treino;
      if (tr) {
        var inner = '<div class="summary rs-tiles">' + tile('Treinos', tr.feitos, 'de ' + tr.planejados + (tr.planejados === 1 ? ' planejado' : ' planejados')) +
          tile('Séries', tr.series) + tile('Volume', fmt(tr.volume, 0) + ' kg', 'carga × repetições') + tile('Tempo', tr.minutos ? duracao(tr.minutos) : '—') + '</div>';
        if (tr.recordes.length) {
          inner += '<p class="stat-label rs-sub">' + ui.icon('trophy', 14) + ' Recordes</p>' + tr.recordes.map(function (e) {
            var txt = e.kind === 'reps' ? e.reps + ' rep. com ' + fmt(e.load) + ' kg' + (e.prevReps != null ? ' (antes ' + e.prevReps + ')' : '') : fmt(e.load) + ' kg × ' + e.reps + (e.prevLoad ? ' (antes ' + fmt(e.prevLoad) + ' kg)' : '');
            return '<div class="pr-row"><span class="pr-ic">' + ui.icon('trophy', 16) + '</span><span class="pr-main"><strong>' + esc(e.name) + '</strong><small>' + esc(txt) + '</small></span><span class="pr-date">' + esc(C.formatDayLabel(e.date, today)) + '</span></div>';
          }).join('');
        }
        html += bloco('Treino', 'dumbbell', inner);
      }
      var al = sem.alimentacao;
      if (al) {
        html += bloco('Alimentação', 'utensils', '<div class="summary rs-tiles">' +
          tile('Calorias (média)', fmt(al.kcalMedia, 0) + ' kcal', al.kcalMeta ? 'meta ' + fmt(al.kcalMeta, 0) + ' kcal' : 'por dia registrado') +
          tile('Proteína (média)', al.protMedia + ' g', al.protPct != null ? al.protPct + '% da meta de ' + al.protMeta + ' g' : 'por dia registrado') +
          tile('Dias com registro', al.dias, 'de ' + sem.decorridos) + '</div>');
      }
      var ag = sem.agua;
      if (ag) html += bloco('Água', 'drop', '<div class="summary rs-tiles">' + tile('Média', esc(R.formatMl(ag.mediaMl)), 'por dia registrado') + tile('Meta batida', ag.diasMeta + ' de ' + sem.decorridos, 'meta de ' + esc(R.formatMl(ag.meta))) + '</div>');
      if (sem.peso) html += bloco('Corpo', 'body', '<div class="summary rs-tiles">' + tile('Peso', fmt(sem.peso.atual) + ' kg', sem.peso.variacao == null ? 'primeira pesagem' : (sem.peso.variacao > 0 ? '+' : '') + fmt(sem.peso.variacao) + ' kg na semana') + '</div>');
      if (sem.tarefas) html += bloco('Rotina', 'list', '<div class="summary rs-tiles">' + tile('Tarefas concluídas', sem.tarefas.feitas + ' de ' + sem.tarefas.total, sem.tarefas.pct + '%') + '</div>');
      var bem = '';
      if (sem.sono) bem += tile('Sono (média)', Jd.fmtHoras(sem.sono.media), plural(sem.sono.noites, 'noite registrada', 'noites registradas') + ' • meta ' + Jd.fmtHoras(sem.sono.meta));
      if (sem.skincare) bem += tile('Skincare completo', sem.skincare.completos + ' de ' + sem.skincare.dias, sem.skincare.dias === 1 ? 'dia' : 'dias');
      if (bem) html += bloco('Bem-estar', 'sparkle', '<div class="summary rs-tiles">' + bem + '</div>');
      if (sem.ciclo) html += bloco('Ciclo', 'moon', '<div class="summary rs-tiles">' + tile(sem.ciclo.fases.length === 1 ? 'Fase' : 'Fases', esc(sem.ciclo.fases.join(' → ')).toLowerCase()) +
        (sem.ciclo.energia != null ? tile('Energia (média)', fmt(sem.ciclo.energia) + ' de 5', plural(sem.ciclo.registros, 'registro', 'registros')) : '') + '</div>');
      if (sem.jardim && JS.jardim) {
        var rot = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
        html += bloco('Jardim da semana', 'flower', '<div class="jd-cab" aria-hidden="true">' + rot.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>' +
          '<div class="jd-grade jd-mini rs-jardim jd-aparece">' + sem.jardim.niveis.map(function (n, i) { return '<span class="jd-cel' + (n == null ? ' futuro' : '') + '" style="--i:' + i + '">' + JS.jardim.flor(n, i) + '</span>'; }).join('') + '</div>' +
          '<p class="muted small rs-nota">' + (sem.jardim.floresceu ? 'Semana florida: pelo menos 5 dias com a flor aberta 🌸' : 'Uma semana é florida com pelo menos 5 dias de flor aberta. Sem pressa 🌷') + '</p>');
      }
      if (sem.vazia) html += '<p class="note">' + ui.icon('info', 14) + ' O resumo mostra só o que você registrou. Treinos, alimentação, água, tarefas e hábitos entram aqui sozinhos.</p>';
      return html;
    }

    function compartilhar() {
      var s = JS.store.state, today = C.toDateKey(new Date()), ini = view.week || inicioDaSemana(today);
      var sem = semana(s, ini, today);
      if (JS.cartoes) JS.cartoes.share('semana', paraCartao(sem, texto(sem)));
    }

    // Cartão no Início: domingo e segunda, com o resumo da semana que acabou de passar.
    function cartaoInicio(state, now) {
      var wd = now.getDay();
      if (wd !== 0 && wd !== 1) return '';
      var today = C.toDateKey(now), ant = C.addDays(inicioDaSemana(today), -7);
      var e = state.extras && state.extras.resumo;
      if (e && e.dispensado === ant) return '';
      var sem = semana(state, ant, today);
      if (sem.vazia) return '';
      var tx = texto(sem);
      return '<section class="card rs-card"><div class="card-head"><h2>' + ui.icon('chart', 18) + 'Seu resumo da semana está pronto</h2></div>' +
        '<p class="muted small">' + esc(periodo(ant)) + '</p>' + chips(tx.destaques.slice(0, 3)) +
        '<div class="btn-row tight"><button type="button" class="btn primary small" data-action="resumo-abrir" data-week="' + ant + '">Abrir resumo</button>' +
        '<button type="button" class="btn ghost small" data-action="resumo-dispensar" data-week="' + ant + '">Agora não</button></div></section>';
    }

    JS.telas.resumo = { title: 'Resumo da semana', render: render, leave: function () { view.week = null; } };
    JS.actions['resumo-sem'] = function (d) {
      var today = C.toDateKey(new Date()), cur = inicioDaSemana(today), delta = Number(d.delta);
      var next = C.addDays(view.week || cur, delta * 7);
      if (next > cur) return;
      view.week = next === cur ? null : next;
      JS.app.render({ enter: 'view:' + (delta > 0 ? 'r' : 'l') });
    };
    JS.actions['resumo-share'] = compartilhar;
    JS.actions['resumo-abrir'] = function (d) { view.week = d.week || null; JS.app.go('resumo'); };
    JS.actions['resumo-dispensar'] = function (d) {
      JS.store.update(function (s) { var e = s.extras = s.extras && typeof s.extras === 'object' ? s.extras : {}; var r = e.resumo = e.resumo && typeof e.resumo === 'object' ? e.resumo : {}; r.dispensado = d.week; });
    };
    JS.slots.add('inicio.meio', cartaoInicio, 30);
    JS.slots.add('mais.tiles', function (state, today) {
      var sem = semana(state, inicioDaSemana(today), today), tr = sem.treino, partes = [];
      if (tr && tr.feitos) partes.push(plural(tr.feitos, 'treino', 'treinos'));
      if (tr && tr.recordes.length) partes.push(plural(tr.recordes.length, 'recorde', 'recordes'));
      return JS.maisTile('resumo', 'chart', 'm-chart', 'Resumo da semana', partes.length ? 'Esta semana: ' + partes.join(' • ') : 'Seu balanço da semana, com carinho');
    }, 30);
    if (JS.search && JS.search.shortcuts) JS.search.shortcuts.push(['Resumo da semana', 'resumo semana semanal balanco recordes habitos', 'chart', { route: 'resumo' }]);
    JS.resumoView = view;
  }

  return { semana: semana, texto: texto, paraCartao: paraCartao, periodo: periodo, montarUI: montarUI };
});
