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
    ['Minhas refeições salvas', 'refeicoes salvas minhas meu cafe da manha almoco lanche jantar montar salvar', 'bookmark', { route: 'alimentacao', food: 'salvas' }],
    ['Meta de proteína e calorias', 'meta proteina calorias macros kcal', 'flame', { action: 'nutri-settings' }],
    ['Recordes pessoais', 'recordes recorde pr carga maxima troféu trofeu', 'trophy', { route: 'treino', treino: 'evolucao' }],
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
    ['Aparência: tema, modo escuro e paleta','tema modo escuro claro noite cores paleta aparencia rosa lavanda salvia nevoa cereja estacoes estação letra fonte tipografia titulos detalhes florais delicado elegante manuscrita', 'sparkle', { route: 'config', scroll: '#cfg-look' }],
    ['Notificações e lembretes', 'notificacoes avisos lembretes push', 'bell', { route: 'config' }],
    ['Passar para outro aparelho', 'passar transferir outro aparelho celular iphone tablet novo trocar dados receber enviar codigo', 'phone', { route: 'config', scroll: '#cfg-transfer' }],
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

    group('Minhas refeições', (s.savedMeals || []).map(function (m) {
      var names = m.items.map(function (i) { var f = N.foodById(s, i.foodId); return f ? f.name : ''; }).join(' ');
      var sc = Math.max(score(m.name, words, fq) * 2, score(names, words, fq));
      return sc ? { sc: sc, icon: 'bookmark', title: m.name, meta: m.items.length + (m.items.length === 1 ? ' alimento' : ' alimentos') + ' • ' + C.MEAL_TYPES[m.meal],
        go: { route: 'alimentacao', food: 'salvas', action: 'saved-edit', data: { id: m.id } } } : null;
    }).filter(Boolean));

    var foods = N.search(s, q, LIMIT).map(function (f, i) {
      return { sc: LIMIT - i + (N.isFavorite(s, f.id) ? 3 : 0), icon: 'utensils', title: f.name.split(',')[0], meta: f.name.indexOf(',') > 0 ? f.name.slice(f.name.indexOf(',') + 1).trim() + ' • ' + JS.graf.fmtNum(f.per100.kcal, 0) + ' kcal/100 g' : JS.graf.fmtNum(f.per100.kcal, 0) + ' kcal/100 g', food: f.id };
    });
    group('Alimentos', foods);
    return out;
  }

  function resultsHtml(q) {
    if (!q.trim()) {
      return '<p class="stat-label">' + ui.icon('sparkle', 14) + ' Escreva ou fale o que fez</p><div class="quick-chips nl-exemplos">' + EXEMPLOS.map(function (e, i) {
        return '<button type="button" class="chip" data-ex="' + i + '">' + esc(e) + '</button>';
      }).join('') + '</div><p class="hint">Eu entendo e mostro o que vou criar; só vale quando você toca em Criar.</p>' +
        '<p class="stat-label">Atalhos</p><div class="quick-chips">' + ['Água', 'Ciclo menstrual', 'Fotos de evolução', 'Treinos prontos', 'Backup dos dados', 'Aparência: tema, modo escuro e paleta'].map(function (n) {
          var i = SHORTCUTS.map(function (x) { return x[0]; }).indexOf(n);
          return i < 0 ? '' : '<button type="button" class="chip" data-g="s' + i + '">' + esc(n.split(':')[0]) + '</button>';
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

  /* ---------------- Escrever ou falar (js/falar.js) ---------------- */

  var EXEMPLOS = ['bebi 300 ml', 'tarefa ligar para a mãe amanhã às 15h', 'comi 2 ovos no café da manhã', 'peso 62,4', 'conta de luz 150 reais dia 10'];
  var nlAtual = [];
  ui.addIcons({ mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>' });

  function entendidos(q) {
    if (!window.JSFalar || String(q).trim().length < 3) return [];
    var lista = [];
    try { lista = JSFalar.interpretar(q, new Date(), JS.store.state).filter(function (c) { return c.confianca >= 0.5; }); } catch (e) { lista = []; }
    return lista;
  }
  function podeEditar(it) { return it.tipo === 'tarefa' || it.tipo === 'conta' || (it.tipo === 'alimento' && it.dados.itens.length === 1); }
  function sem(res) { return res.replace(/^Entendi:\s*/, ''); }
  function nomeAlt(a) { return a.nome.split(',')[0] + (a.nome.indexOf(',') > 0 ? ' (' + a.nome.slice(a.nome.indexOf(',') + 1).trim() + ')' : ''); }

  // Cartão "Entendi: …" com a primeira intenção de nlAtual.
  function nlHtmlDe() {
    if (!nlAtual.length) return '';
    var it = nlAtual[0], d = it.dados, alt = '';
    if (it.tipo === 'alimento' && d.itens.length === 1 && d.itens[0].alternativas.length) {
      alt = '<p class="nl-alt">Outro alimento? ' + d.itens[0].alternativas.map(function (a, k) { return '<button type="button" class="chip" data-nl-food="' + k + '">' + esc(nomeAlt(a)) + '</button>'; }).join('') + '</p>';
    }
    return '<div class="nl-card" role="group" aria-label="O que entendi"><p class="nl-eyebrow">' + ui.icon('sparkle', 14) + ' Entendi</p>' +
      '<p class="nl-sum">' + esc(sem(it.resumo)) + '</p>' + (it.aviso ? '<p class="nl-aviso">' + ui.icon('info', 14) + ' ' + esc(it.aviso) + '</p>' : '') + alt +
      '<div class="nl-acoes"><button type="button" class="btn small primary" data-nl="criar">' + ui.icon(it.tipo === 'treino' ? 'play' : 'plus', 16) + (it.tipo === 'treino' ? 'Começar treino' : 'Criar') + '</button>' +
      (podeEditar(it) ? '<button type="button" class="btn small soft" data-nl="editar">' + ui.icon('edit', 16) + 'Editar</button>' : '') + '</div>' +
      (nlAtual[1] ? '<p class="nl-outra">Ou: <button type="button" class="link" data-nl-i="1">' + esc(sem(nlAtual[1].resumo)) + '</button></p>' : '') + '</div>';
  }
  function nlHtml(q) { nlAtual = entendidos(q); return nlHtmlDe(); }

  function criarEntendido(it) {
    var res = null;
    if (it.tipo === 'treino') { ui.closeSheet(); setTimeout(function () { JS.actions['quick-add']({ kind: 'workout' }); }, 120); return; }
    JS.store.update(function (st, n) { res = JSFalar.aplicar(st, it, n); });
    if (!res || !res.ok) { ui.toast((res && res.erro) || 'Não consegui criar.', { error: true }); return; }
    ui.closeSheet();
    ui.toast(res.mensagem, { actionLabel: 'Desfazer', timeout: 6500, onAction: function () { JS.store.update(function (st) { JSFalar.desfazer(st, res.desfazer); }); ui.toast('Desfeito.'); } });
    if (res.lembrete && JS.notify) setTimeout(function () { JS.notify.askIfNeeded(); }, 700);
  }
  function editarEntendido(it) {
    var d = it.dados;
    ui.closeSheet();
    setTimeout(function () {
      if (it.tipo === 'tarefa' && JS.forms.task) JS.forms.task({ title: d.titulo, dueDate: d.data || '', dueTime: d.hora || '', recurrence: d.recorrencia, weekdays: d.diasSemana || [], reminderMinutes: d.lembrete });
      else if (it.tipo === 'conta' && JS.forms.bill) JS.forms.bill({ title: d.titulo, amountCents: d.cents, dueDate: d.data, category: d.categoria, recurrence: d.recorrencia });
      else if (it.tipo === 'alimento' && JS.foodInfo) JS.foodInfo(d.itens[0].foodId, { meal: d.refeicao, date: d.data, grams: d.itens[0].gramas });
    }, 140);
  }

  // Microfone (Chrome/Android e Safari recentes). Sem suporte, o botão nem aparece.
  function vozDisponivel() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  var voz = null;
  function ouvir(form, q, atualizar) {
    var btn = form.querySelector('[data-mic]'), info = form.querySelector('[data-listening]');
    if (voz) { try { voz.stop(); } catch (e) { /* já parou */ } return; }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = new SR(), ouviu = false, erro = false;
    voz = rec;
    function fim(msg) {
      voz = null; btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Falar');
      info.textContent = msg || ''; info.hidden = !msg;
    }
    rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onstart = function () { btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'Parar de ouvir'); info.hidden = false; info.textContent = 'Ouvindo… fale agora'; };
    rec.onresult = function (e) {
      var txt = '';
      for (var i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (txt.trim()) { ouviu = true; q.value = txt.trim(); info.textContent = 'Ouvi: “' + txt.trim() + '”'; atualizar(true); }
    };
    rec.onerror = function (e) {
      erro = true;
      var m = { 'not-allowed': 'O navegador não liberou o microfone. Libere nas permissões do site e tente de novo (ou use o microfone do teclado).', 'service-not-allowed': 'O navegador não liberou o reconhecimento de voz. Use o microfone do teclado.',
        'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.', 'network': 'Sem conexão: o reconhecimento de voz precisa de internet neste aparelho.', 'audio-capture': 'Não achei um microfone neste aparelho.', 'aborted': '' };
      fim(m[e.error] != null ? m[e.error] : 'Não consegui ouvir (' + e.error + '). Tente de novo ou use o teclado.');
    };
    rec.onend = function () { if (voz === rec) fim(ouviu ? info.textContent : erro ? '' : 'Não ouvi nada. Toque no microfone e fale de novo.'); };
    try { rec.start(); } catch (e) { fim('Não consegui iniciar o microfone.'); }
  }

  function open() {
    var mic = vozDisponivel();
    var body = '<div class="field search-field srch-field">' + ui.icon('search', 18) + '<input type="search" name="q" placeholder="Buscar ou escrever o que fez…" autocomplete="off" aria-label="Buscar no J.S. ou escrever o que fez" enterkeyhint="search">' +
      (mic ? '<button type="button" class="mic-btn" data-mic aria-label="Falar" aria-pressed="false" title="Falar">' + ui.icon('mic', 20) + '</button>' : '') + '</div>' +
      '<p class="nl-ouvindo small" data-listening role="status" aria-live="polite" hidden></p>' +
      '<div class="nl-slot" data-nl aria-live="polite"></div>' +
      '<div class="srch-results" data-results>' + resultsHtml('') + '</div>' +
      '<p class="hint nl-dica">' + ui.icon('info', 14) + ' Dá para escrever (ou ditar pelo microfone do teclado, no iPhone) coisas como “bebi 300 ml”, “comi 2 ovos” ou “tarefa pagar aluguel dia 5”.</p>';
    ui.openSheet({
      title: 'Buscar', body: body,
      onOpen: function (form) {
        form.classList.add('srch-form');
        var q = form.elements.q, box = form.querySelector('[data-results]'), nl = form.querySelector('[data-nl]'), t = null;
        function atualizar(agora) {
          clearTimeout(t);
          var run = function () { nl.innerHTML = nlHtml(q.value); var rh = resultsHtml(q.value); if (nlAtual.length && rh.indexOf('Nada encontrado') >= 0) rh = ''; box.innerHTML = rh; };
          if (agora) run(); else t = setTimeout(run, 110);
        }
        q.addEventListener('input', function () { atualizar(false); });
        form.addEventListener('submit', function (e) { e.preventDefault(); var first = box.querySelector('[data-g^="r"]'); if (first) first.click(); });
        var mb = form.querySelector('[data-mic]');
        if (mb) mb.addEventListener('click', function () { ouvir(form, q, atualizar); });
        nl.addEventListener('click', function (e) {
          var b = e.target.closest('[data-nl], [data-nl-food], [data-nl-i]');
          if (!b || !nlAtual.length) return;
          e.preventDefault();
          if (b.dataset.nl === 'criar') criarEntendido(nlAtual[0]);
          else if (b.dataset.nl === 'editar') editarEntendido(nlAtual[0]);
          else if (b.dataset.nlFood != null) {
            var it = nlAtual[0], alt = it.dados.itens[0].alternativas[Number(b.dataset.nlFood)];
            if (alt) { JSFalar.trocarAlimento(it, 0, alt.foodId, JS.store.state); nl.innerHTML = nlHtmlDe(); }
          } else if (b.dataset.nlI != null) {
            var outra = nlAtual[Number(b.dataset.nlI)];
            nlAtual = [outra].concat(nlAtual.filter(function (x) { return x !== outra; }));
            nl.innerHTML = nlHtmlDe();
          }
        });
        box.addEventListener('click', function (e) {
          var ex = e.target.closest('[data-ex]');
          if (ex) { e.preventDefault(); q.value = EXEMPLOS[Number(ex.dataset.ex)]; atualizar(true); q.focus(); return; }
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
  // shortcuts: lista [título, palavras, ícone, destino]; outros recursos fazem JS.search.shortcuts.push([...]).
  JS.search = { open: open, run: search, shortcuts: SHORTCUTS };
})();
