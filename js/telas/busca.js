/* J.S. — Busca geral: um campo só para achar telas, tarefas, contas, tratamentos, refeições, fichas, exercícios e alimentos */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, T = window.JSTreino, N = window.JSNutri, ui = JS.ui, esc = ui.esc;
  var LIMIT = 6;

  function fold(s) { return N.fold(s); }
  // Todas as palavras digitadas precisam aparecer; começar com a busca vale mais.
  function score(text, words, q) {
    var t = fold(text);
    for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) < 0) return 0;
    return t.indexOf(q) === 0 ? 3 : (' ' + t).indexOf(' ' + q) >= 0 ? 2 : 1;
  }

  // Telas e atalhos (com palavras que a usuária pode digitar).
  var SHORTCUTS = [
    ['Início', 'inicio painel hoje resumo', 'home', { route: 'inicio' }],
    ['Rotina', 'rotina tarefas afazeres lista', 'list', { route: 'rotina' }],
    ['Treino de hoje', 'treino academia exercicio ficha', 'dumbbell', { route: 'treino' }],
    ['Treinos prontos', 'treinos prontos programa abc gluteos casa', 'dumbbell', { route: 'treino', action: 'ready-open' }],
    ['Séries por grupo muscular', 'volume series grupo muscular semana', 'chart', { route: 'treino' }],
    ['Alimentação — diário', 'alimentacao comida diario calorias kcal refeicao dieta', 'utensils', { route: 'alimentacao', food: 'hoje' }],
    ['Água', 'agua beber hidratacao copo garrafa', 'drop', { route: 'alimentacao', food: 'hoje', scroll: '.water-card' }],
    ['Meta e lembretes de água', 'agua meta lembrete beber', 'drop', { action: 'water-settings' }],
    ['Cardápio sugerido', 'cardapio sugestao menu', 'leaf', { route: 'alimentacao', food: 'cardapio' }],
    ['Tabela nutricional', 'tabela taco nutrientes alimento', 'search', { route: 'alimentacao', food: 'tabela' }],
    ['Ciclo menstrual', 'ciclo menstruacao periodo fase tpm fertil ovulacao colica', 'moon', { route: 'ciclo' }],
    ['Cronograma capilar', 'capilar cabelo hidratacao nutricao reconstrucao', 'flower', { route: 'autocuidado' }],
    ['Financeiro', 'financeiro contas pagar boleto dinheiro', 'wallet', { route: 'financeiro' }],
    ['Corpo e medições', 'corpo peso bioimpedancia gordura musculo medidas', 'body', { route: 'corpo' }],
    ['Fotos de evolução', 'fotos foto antes depois evolucao corpo', 'camera', { route: 'corpo', scroll: '.photos-card' }],
    ['Gráficos', 'graficos painel evolucao', 'chart', { route: 'graficos' }],
    ['Agenda', 'agenda calendario mes', 'calendar', { route: 'agenda' }],
    ['Configurações', 'configuracoes ajustes', 'settings', { route: 'config' }],
    ['Aparência: tema, modo escuro e paleta', 'tema modo escuro claro noite cores paleta aparencia rosa lavanda', 'sparkle', { route: 'config', scroll: '#cfg-look' }],
    ['Notificações e lembretes', 'notificacoes avisos lembretes push', 'bell', { route: 'config' }],
    ['Backup dos dados', 'backup copia restaurar salvar dados', 'shield', { route: 'config', scroll: '[data-action="backup-export"]' }],
    ['Toque atrás do celular', 'toque atras batida sensor', 'phone', { route: 'config', scroll: '#cfg-backtap' }],
    ['Tamanho da tela', 'tamanho tela letra zoom fonte', 'phone', { route: 'config', scroll: '#cfg-scale' }]
  ];

  function search(q) {
    var s = JS.store.state, t = C.toDateKey(new Date());
    var fq = fold(q), words = fq.split(' ').filter(Boolean), out = [];
    if (!words.length) return out;
    function group(title, items) { if (items.length) out.push({ title: title, items: items.sort(function (a, b) { return b.sc - a.sc; }).slice(0, LIMIT) }); }

    group('Telas e atalhos', SHORTCUTS.map(function (x) {
      var sc = Math.max(score(x[0], words, fq) * 2, score(x[1], words, fq));
      return sc ? { sc: sc, icon: x[2], title: x[0], meta: '', go: x[3] } : null;
    }).filter(Boolean));

    // Tarefas: uma por tarefa, com a próxima data (ou a de hoje).
    group('Tarefas', s.tasks.filter(function (k) { return k.status !== 'cancelled'; }).map(function (k) {
      var sc = Math.max(score(k.title, words, fq) * 2, score((k.description || '') + ' ' + (k.category || ''), words, fq));
      if (!sc) return null;
      var occ = k.dueDate ? R.taskOccurrences(s, t, C.addDays(t, 60)).filter(function (o) { return o.task.id === k.id; })[0] : null;
      var date = occ ? occ.date : k.dueDate;
      return { sc: sc, icon: 'list', title: k.title, meta: (date ? C.formatDayLabel(date, t) + (k.dueTime ? ' às ' + k.dueTime : '') + ' • ' : '') + (k.category || ''),
        go: { route: 'rotina', action: 'task-menu', data: { id: k.id, date: date || '' } } };
    }).filter(Boolean));

    // Contas: a próxima pendente de cada título (ou a mais recente).
    var bills = {};
    s.bills.forEach(function (b) {
      if (b.status === 'cancelled') return;
      var key = b.seriesId || b.id, cur = bills[key];
      var better = !cur || (b.status === 'pending' && (cur.status !== 'pending' || b.dueDate < cur.dueDate)) || (cur.status !== 'pending' && b.status !== 'pending' && b.dueDate > cur.dueDate);
      if (better) bills[key] = b;
    });
    group('Contas', Object.keys(bills).map(function (k) {
      var b = bills[k], sc = Math.max(score(b.title, words, fq) * 2, score(b.category || '', words, fq));
      return sc ? { sc: sc, icon: 'wallet', title: b.title, meta: C.formatCents(b.amountCents) + ' • ' + C.dueLabel(b.dueDate, t) + (b.status === 'paid' ? ' (paga)' : ''),
        go: { route: 'financeiro', action: 'bill-menu', data: { id: b.id } } } : null;
    }).filter(Boolean));

    group('Cronograma capilar', s.hairEvents.filter(R.hairPending).map(function (e) {
      var sc = score(R.hairName(e) + ' ' + (e.notes || ''), words, fq);
      return sc ? { sc: sc + (e.date >= t ? 1 : 0), icon: 'flower', title: R.hairName(e), meta: C.formatDayLabel(e.date, t) + (e.time ? ' às ' + e.time : ''),
        go: { route: 'autocuidado', action: 'hair-menu', data: { id: e.id } } } : null;
    }).filter(Boolean));

    group('Horários de refeição', s.meals.map(function (m) {
      var sc = score(m.name + ' ' + (m.description || '') + ' ' + (C.MEAL_TYPES[m.type] || ''), words, fq);
      return sc ? { sc: sc, icon: 'clock', title: m.name, meta: m.time + (m.enabled ? '' : ' • pausada'), go: { route: 'alimentacao', food: 'horarios', action: 'meal-menu', data: { id: m.id } } } : null;
    }).filter(Boolean));

    group('Fichas de treino', s.workoutPlans.map(function (p) {
      var names = p.items.map(function (it) { return T.exerciseName(s, it.exerciseId); }).join(' ');
      var sc = Math.max(score(p.name, words, fq) * 2, score(names, words, fq));
      return sc ? { sc: sc, icon: 'dumbbell', title: T.planLetter(s, p) + ' • ' + p.name, meta: p.items.length + ' exercícios', go: { route: 'treino', treino: 'fichas', action: 'plan-menu', data: { id: p.id } } } : null;
    }).filter(Boolean));

    group('Exercícios', T.exercises(s).map(function (x) {
      var sc = Math.max(score(x.name, words, fq) * 2, score((T.GRUPOS[x.group] || '') + ' ' + (x.equipment || ''), words, fq));
      return sc ? { sc: sc, icon: 'dumbbell', title: x.name, meta: (T.GRUPOS[x.group] || '') + (x.equipment ? ' • ' + x.equipment : ''), exercise: x.id } : null;
    }).filter(Boolean));

    var foods = N.search(s, q, LIMIT).map(function (f, i) {
      return { sc: LIMIT - i + (N.isFavorite(s, f.id) ? 3 : 0), icon: 'utensils', title: f.name.split(',')[0], meta: f.name.indexOf(',') > 0 ? f.name.slice(f.name.indexOf(',') + 1).trim() + ' • ' + JS.graf.fmtNum(f.per100.kcal, 0) + ' kcal/100 g' : JS.graf.fmtNum(f.per100.kcal, 0) + ' kcal/100 g', food: f.id };
    });
    group('Alimentos', foods);
    return out;
  }

  function resultsHtml(q) {
    if (!q.trim()) {
      return '<p class="stat-label">Atalhos</p><div class="quick-chips">' + ['Água', 'Ciclo menstrual', 'Fotos de evolução', 'Treinos prontos', 'Backup dos dados', 'Aparência: tema, modo escuro e paleta'].map(function (n) {
        var i = SHORTCUTS.map(function (x) { return x[0]; }).indexOf(n);
        return '<button type="button" class="chip" data-g="s' + i + '">' + esc(n.split(':')[0]) + '</button>';
      }).join('') + '</div><p class="hint">Busque tarefas, contas, tratamentos, refeições, fichas, exercícios, alimentos ou qualquer tela do app.</p>';
    }
    var res = search(q);
    if (!res.length) return '<p class="muted small">Nada encontrado para "' + esc(q) + '". Tente outra palavra.</p>';
    var idx = 0;
    current = [];
    return res.map(function (g) {
      return '<p class="stat-label">' + esc(g.title) + '</p>' + g.items.map(function (it) {
        current.push(it);
        return '<button type="button" class="srch-row" data-g="r' + (idx++) + '"><span class="srch-ic">' + ui.icon(it.icon, 18) + '</span><span class="srch-txt"><strong>' + esc(it.title) + '</strong>' +
          (it.meta ? '<small>' + esc(it.meta) + '</small>' : '') + '</span>' + ui.icon('right', 16) + '</button>';
      }).join('');
    }).join('');
  }
  var current = [];

  function go(it) {
    ui.closeSheet();
    setTimeout(function () {
      if (it.food) { JS.foodInfo(it.food, { date: C.toDateKey(new Date()) }); return; }
      if (it.exercise) { exerciseSheet(it.exercise); return; }
      var g = it.go || {};
      if (g.food && JS.alimView) JS.alimView.mode = g.food;
      if (g.treino && JS.treinoView) JS.treinoView.mode = g.treino;
      if (g.route) { if (JS.app.route() !== g.route) JS.app.go(g.route); else JS.app.render(); }
      setTimeout(function () {
        if (g.action && JS.actions[g.action]) JS.actions[g.action](g.data || {}, null, null);
        if (g.scroll) { var el = document.querySelector(g.scroll); if (el) el.scrollIntoView({ block: 'center', behavior: JS.anim.reduced() ? 'auto' : 'smooth' }); }
      }, g.route ? 120 : 0);
    }, 60);
  }

  // Exercício: desenho, dica e o que já foi feito.
  function exerciseSheet(id) {
    var s = JS.store.state, x = T.exerciseById(s, id);
    if (!x) return;
    var tr = T.trainedExercises(s).filter(function (e) { return e.id === id; })[0];
    var body = (JS.exPlayer ? JS.exPlayer(x) : '') + (x.tips ? '<p>' + esc(x.tips) + '</p>' : '') +
      '<p class="muted small">' + esc(T.GRUPOS[x.group] || '') + (x.equipment ? ' • ' + esc(x.equipment) : '') + '</p>' +
      (tr ? '<p class="ok-line">' + ui.icon('check', 16) + ' Última carga: ' + JS.kg(tr.trend.last.maxLoad) + ' (' + esc(C.formatDateBR(tr.trend.last.date)) + ')</p>' : '') +
      (tr ? '<button type="button" class="btn soft full" data-evo>' + ui.icon('chart', 18) + 'Ver a evolução</button>' : '');
    ui.openSheet({
      title: x.name, body: body,
      onOpen: function (form) {
        if (JS.startDrawings) JS.startDrawings(form);
        var b = form.querySelector('[data-evo]');
        if (b) b.addEventListener('click', function () {
          ui.closeSheet();
          if (JS.treinoView) { JS.treinoView.mode = 'evolucao'; JS.treinoView.evoEx = id; }
          if (JS.app.route() !== 'treino') JS.app.go('treino'); else JS.app.render();
        });
      }
    });
  }

  function open() {
    var body = '<div class="field search-field">' + ui.icon('search', 18) + '<input type="search" name="q" placeholder="O que você procura?" autocomplete="off" aria-label="Buscar no J.S." enterkeyhint="search"></div>' +
      '<div class="srch-results" data-results>' + resultsHtml('') + '</div>';
    ui.openSheet({
      title: 'Buscar', body: body,
      onOpen: function (form) {
        form.classList.add('srch-form');
        var q = form.elements.q, box = form.querySelector('[data-results]'), t = null;
        q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { box.innerHTML = resultsHtml(q.value); }, 110); });
        form.addEventListener('submit', function (e) { e.preventDefault(); var first = box.querySelector('[data-g^="r"]'); if (first) first.click(); });
        box.addEventListener('click', function (e) {
          var b = e.target.closest('[data-g]');
          if (!b) return;
          e.preventDefault();
          var k = b.dataset.g;
          if (k.charAt(0) === 's') { var x = SHORTCUTS[Number(k.slice(1))]; go({ go: x[3] }); }
          else go(current[Number(k.slice(1))]);
        });
        setTimeout(function () { q.focus(); }, 200);
      }
    });
  }

  JS.actions['search'] = open;
  JS.search = { open: open, run: search };
})();
