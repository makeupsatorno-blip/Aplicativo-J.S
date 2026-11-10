/* J.S. — Alimentação: diário com nutrientes (Tabela TACO), sugestões de cardápio, horários e lembretes */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, N = window.JSNutri, ui = JS.ui, esc = ui.esc;
  var view = { mode: 'hoje', date: null, variants: {}, query: '' };
  var MODES = [['hoje', 'Diário'], ['cardapio', 'Cardápio'], ['horarios', 'Horários'], ['tabela', 'Tabela']];
  var MACROS = [['prot', 'Proteínas', 'var(--mac-prot, #A0526D)'], ['carb', 'Carboidratos', 'var(--mac-carb, #4F6F9A)'], ['lip', 'Gorduras', 'var(--mac-lip, #A85E3C)']];
  var GRAM_CHIPS = [30, 50, 100, 150, 200];

  function f0(v) { return v == null ? '—' : JS.graf.fmtNum(v, 0); }
  function f1(v) { return v == null ? '—' : JS.graf.fmtNum(v, 1); }
  // "Ovo, de galinha, inteiro, cozido" -> <strong>Ovo</strong> de galinha, inteiro, cozido
  function foodName(name) {
    var i = name.indexOf(',');
    return i < 0 ? '<strong>' + esc(name) + '</strong>' : '<strong>' + esc(name.slice(0, i)) + '</strong>' + esc(name.slice(i + 1));
  }
  JS.foodName = foodName;
  function curDate() { return view.date || C.toDateKey(new Date()); }

  /* ---------------- Imagem de cada alimento (ícone) ---------------- */
  // Palavra do nome (sem acento) -> ícone. A primeira que aparecer no nome vale; sem nenhuma, usa o grupo da TACO.
  var FOOD_ICONS = [
    ['batata doce', '🍠'], ['pao de queijo', '🧀'], ['couve flor', '🥦'], ['creme de leite', '🥛'], ['agua de coco', '🥥'],
    ['batata', '🥔'], ['mandioca', '🍠'], ['inhame', '🍠'], ['ovo', '🥚'], ['ovos', '🥚'], ['arroz', '🍚'],
    ['feijao', '🍲'], ['feijoada', '🍲'], ['lentilha', '🍲'], ['grao', '🍲'], ['tofu', '🍲'], ['soja', '🍲'],
    ['pao', '🍞'], ['torrada', '🍞'], ['biscoito', '🍪'], ['bolo', '🍰'], ['macarrao', '🍝'], ['lasanha', '🍝'], ['pizza', '🍕'],
    ['tapioca', '🫓'], ['cuscuz', '🌽'], ['milho', '🌽'], ['pipoca', '🍿'], ['aveia', '🥣'], ['granola', '🥣'], ['farinha', '🌾'],
    ['queijo', '🧀'], ['requeijao', '🧀'], ['iogurte', '🥣'], ['leite', '🥛'], ['manteiga', '🧈'], ['margarina', '🧈'],
    ['cafe', '☕'], ['cha', '🍵'], ['suco', '🧃'], ['refrigerante', '🥤'], ['cerveja', '🍺'], ['vinho', '🍷'],
    ['frango', '🍗'], ['peru', '🍗'], ['carne', '🥩'], ['porco', '🥓'], ['bacon', '🥓'], ['presunto', '🥓'], ['mortadela', '🥓'],
    ['linguica', '🌭'], ['salsicha', '🌭'], ['hamburguer', '🍔'],
    ['merluza', '🐟'], ['pescada', '🐟'], ['salmao', '🐟'], ['tilapia', '🐟'], ['atum', '🐟'], ['sardinha', '🐟'], ['bacalhau', '🐟'],
    ['corvina', '🐟'], ['pintado', '🐟'], ['cacao', '🐟'], ['peixe', '🐟'], ['camarao', '🦐'], ['caranguejo', '🦀'], ['lula', '🦑'], ['polvo', '🐙'],
    ['banana', '🍌'], ['maca', '🍎'], ['mamao', '🥭'], ['manga', '🥭'], ['melao', '🍈'], ['melancia', '🍉'], ['abacaxi', '🍍'],
    ['morango', '🍓'], ['kiwi', '🥝'], ['uva', '🍇'], ['laranja', '🍊'], ['tangerina', '🍊'], ['mexerica', '🍊'], ['limao', '🍋'],
    ['pera', '🍐'], ['abacate', '🥑'], ['pessego', '🍑'], ['ameixa', '🍑'], ['cereja', '🍒'], ['acerola', '🍒'], ['coco', '🥥'],
    ['goiaba', '🍏'], ['maracuja', '🥭'], ['caju', '🍎'],
    ['tomate', '🍅'], ['cenoura', '🥕'], ['brocolis', '🥦'], ['alface', '🥬'], ['rucula', '🥬'], ['agriao', '🥬'], ['couve', '🥬'],
    ['espinafre', '🥬'], ['repolho', '🥬'], ['acelga', '🥬'], ['pepino', '🥒'], ['abobrinha', '🥒'], ['chuchu', '🥒'], ['quiabo', '🥒'],
    ['vagem', '🥒'], ['abobora', '🎃'], ['cebola', '🧅'], ['alho', '🧄'], ['pimentao', '🫑'], ['pimenta', '🌶️'], ['berinjela', '🍆'],
    ['cogumelo', '🍄'], ['amendoim', '🥜'], ['castanha', '🌰'], ['nozes', '🌰'], ['amendoa', '🌰'], ['gergelim', '🌰'], ['linhaca', '🌰'],
    ['chocolate', '🍫'], ['achocolatado', '🍫'], ['mel', '🍯'], ['geleia', '🍯'], ['acucar', '🍬'], ['doce', '🍬'], ['sorvete', '🍨'],
    ['pudim', '🍮'], ['gelatina', '🍮'], ['azeite', '🫒'], ['oleo', '🫒'], ['azeitona', '🫒'], ['sal', '🧂'], ['sopa', '🍲'], ['salada', '🥗']
  ];
  var GROUP_ICONS = [
    ['Frutas', '🍎', 'fruta'], ['Verduras', '🥗', 'veg'], ['Carnes', '🥩', 'prot'], ['Pescados', '🐟', 'prot'], ['Ovos', '🥚', 'prot'],
    ['Leite', '🥛', 'leite'], ['Cereais', '🌾', 'graos'], ['Leguminosas', '🍲', 'graos'], ['Nozes', '🌰', 'graos'], ['Bebidas', '🥤', 'leite'],
    ['Açúcares', '🍬', 'fruta'], ['Gorduras', '🫒', 'graos'], ['preparados', '🍲', 'prot'], ['Produtos', '🍽️', 'graos']
  ];
  function foodIcon(f) {
    var words = ' ' + N.fold(f && f.name) + ' ', icon = null, tint = '';
    for (var i = 0; i < FOOD_ICONS.length && !icon; i++) if (words.indexOf(' ' + FOOD_ICONS[i][0] + ' ') >= 0) icon = FOOD_ICONS[i][1];
    var g = (f && f.group) || '';
    for (var k = 0; k < GROUP_ICONS.length; k++) {
      if (g.indexOf(GROUP_ICONS[k][0]) >= 0) { tint = GROUP_ICONS[k][2]; if (!icon) icon = GROUP_ICONS[k][1]; break; }
    }
    return '<span class="food-ic fi-' + (tint || 'outro') + '" aria-hidden="true">' + (icon || '🍽️') + '</span>';
  }
  JS.foodIcon = foodIcon;

  /* ---------------- Horários (lembretes de refeição) ---------------- */

  function weekdayLetters(days) {
    return '<span class="wd-mini">' + [0, 1, 2, 3, 4, 5, 6].map(function (d) {
      return '<span class="' + (days.indexOf(d) >= 0 ? 'on' : '') + '" aria-hidden="true">' + C.WEEKDAY_LETTERS[d] + '</span>';
    }).join('') + '</span>';
  }

  function todayItem(o, now, showCheck) {
    var m = o.meal, nowT = C.toTimeKey(now), isToday = o.date === C.toDateKey(now);
    var state = o.done ? ui.tag('Feita', 'success') : o.skipped ? ui.tag('Pulada hoje', 'soft')
      : o.changed ? ui.tag('Só hoje: ' + o.time + ' (normal ' + o.originalTime + ')', 'soft')
        : (isToday && o.time < nowT ? ui.tag('Horário passou', 'muted') : '');
    var ids = ' data-id="' + esc(m.id) + '" data-date="' + esc(o.date) + '"';
    return '<div class="item meal' + (o.done ? ' done' : '') + (o.skipped ? ' skipped' : '') + '">' +
      '<span class="time-badge">' + esc(o.time) + '</span>' +
      '<button type="button" class="item-main" data-action="meal-today"' + ids + '>' +
      '<span class="item-title">' + esc(m.name) + '</span>' +
      '<span class="item-meta">' + esc(C.MEAL_TYPES[m.type] || '') + (m.description ? ' • ' + esc(m.description) : '') + '</span>' +
      (state ? '<span class="item-flags">' + state + '</span>' : '') + '</button>' +
      (showCheck && !o.skipped ? '<button type="button" class="check' + (o.done ? ' on' : '') + '" data-action="meal-done"' + ids +
        ' aria-label="' + (o.done ? 'Desmarcar' : 'Marcar como feita') + ': ' + esc(m.name) + '">' + ui.icon('check', 16) + '</button>' : '') +
      '</div>';
  }

  function scheduleItem(m) {
    return '<div class="item meal' + (m.enabled ? '' : ' paused') + '">' +
      '<span class="time-badge">' + esc(m.time) + '</span>' +
      '<button type="button" class="item-main" data-action="meal-menu" data-id="' + esc(m.id) + '">' +
      '<span class="item-title">' + esc(m.name) + '</span>' +
      '<span class="item-meta">' + weekdayLetters(m.weekdays) + (m.reminderEnabled ? '' : ' <span class="item-icons" title="Sem lembrete">' + ui.icon('belloff', 14) + '</span>') + '</span>' +
      (m.enabled ? '' : '<span class="item-flags">' + ui.tag('Pausada', 'soft') + '</span>') +
      '</button></div>';
  }

  function renderHorarios(s, now) {
    var today = C.toDateKey(now);
    var history = s.settings.mealHistory !== false;
    var todayList = R.mealOccurrencesOn(s, today);
    var all = s.meals.slice().sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
    var html = ui.section('Hoje',
      todayList.length ? todayList.map(function (o) { return todayItem(o, now, history); }).join('')
        : (all.length ? '<p class="muted small">Nenhuma refeição marcada para hoje.</p>'
          : ui.empty('utensils', 'Cadastre seus horários de refeição para receber lembretes.', { label: 'Novo horário', attrs: 'data-action="meal-new"' })));
    if (all.length) html += ui.section('Meus horários', all.map(scheduleItem).join(''), '<span class="count">' + all.length + '</span>');
    if (history) {
      var logs = s.mealLogs.slice().sort(function (a, b) { return a.completedAt < b.completedAt ? 1 : -1; }).slice(0, 15);
      if (logs.length) {
        html += ui.section('Histórico', logs.map(function (l) {
          return '<div class="item log"><span class="item-main static"><span class="item-title">' + esc(l.mealName) + '</span>' +
            '<span class="item-meta">' + esc(C.formatDayLabel(l.date, today)) + ' • feita às ' + esc(C.toTimeKey(new Date(l.completedAt))) + '</span></span></div>';
        }).join(''));
      }
    }
    return html + '<button type="button" class="btn soft full" data-action="meal-new">' + ui.icon('plus', 18) + 'Novo horário de refeição</button>';
  }

  /* ---------------- Diário ---------------- */

  // Refeições do dia: as dos horários cadastrados + as que já têm alimento; sem nada, as 4 principais.
  function mealsOfDay(s, date, dl) {
    var out = [], seen = {};
    R.mealOccurrencesOn(s, date).forEach(function (o) {
      if (o.skipped || seen[o.meal.type]) return;
      seen[o.meal.type] = true;
      out.push({ type: o.meal.type, name: o.meal.name, time: o.time });
    });
    dl.meals.forEach(function (m) { if (!seen[m.meal]) { seen[m.meal] = true; out.push({ type: m.meal, name: C.MEAL_TYPES[m.meal], time: null }); } });
    // As 4 principais sempre aparecem (com o botão de repetir quando estão vazias).
    ['breakfast', 'lunch', 'afternoon_snack', 'dinner'].forEach(function (t) { if (!seen[t]) { seen[t] = true; out.push({ type: t, name: C.MEAL_TYPES[t], time: null }); } });
    return out.sort(function (a, b) { return N.MEAL_ORDER.indexOf(a.type) - N.MEAL_ORDER.indexOf(b.type); });
  }

  function macroBar(t) {
    var sp = N.macroSplit(t);
    if (!sp) return '';
    return '<div class="macro-bar" role="img" aria-label="Calorias vindas de proteínas ' + sp.prot + '%, carboidratos ' + sp.carb + '%, gorduras ' + sp.lip + '%">' +
      MACROS.map(function (m) { return sp[m[0]] ? '<span style="width:' + sp[m[0]] + '%;background:' + m[2] + '"></span>' : ''; }).join('') + '</div>' +
      '<div class="chart-legend">' + MACROS.map(function (m) { return '<span><i style="background:' + m[2] + '"></i>' + m[1] + ' ' + sp[m[0]] + '%</span>'; }).join('') + '</div>';
  }

  function renderDiario(s, now) {
    var today = C.toDateKey(now), date = curDate();
    var dl = N.dayLog(s, date), t = dl.total, target = N.kcalTarget(s, date);
    var kcal = t.kcal || 0, pct = target ? Math.min(100, Math.round(kcal / target.value * 100)) : 0;
    var html = '<div class="day-nav"><button type="button" class="icon-btn" data-action="food-day" data-delta="-1" aria-label="Dia anterior">' + ui.icon('left') + '</button>' +
      '<strong>' + esc(C.formatDayLabel(date, today)) + (C.formatDayLabel(date, today).length < 8 ? ' • ' + esc(C.formatDayMonth(date)) : '') + '</strong>' +
      '<button type="button" class="icon-btn" data-action="food-day" data-delta="1" aria-label="Próximo dia">' + ui.icon('right') + '</button></div>';
    html += '<section class="card kcal-card"><div class="kcal-head"><div><span class="stat-label">Consumido</span><p class="hero-num">' + f0(kcal) + ' <small>kcal</small></p></div>' +
      (target ? '<div class="kcal-goal"><span class="stat-label">Meta</span><strong>' + f0(target.value) + ' kcal</strong><small>' + (kcal <= target.value ? 'faltam ' + f0(target.value - kcal) : 'passou ' + f0(kcal - target.value)) + '</small></div>'
        : '<button type="button" class="btn small soft" data-action="nutri-settings">Definir meta</button>') + '</div>' +
      (target ? '<div class="progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Calorias da meta"><span style="width:0%" data-progress-to="' + pct + '"></span></div>' : '') +
      '<div class="macro-grid">' +
      '<div><strong>' + f1(t.prot) + ' g</strong><span>Proteínas</span></div><div><strong>' + f1(t.carb) + ' g</strong><span>Carboidratos</span></div>' +
      '<div><strong>' + f1(t.lip) + ' g</strong><span>Gorduras</span></div><div><strong>' + f1(t.fibra) + ' g</strong><span>Fibras</span></div></div>' +
      macroBar(t) +
      (dl.count ? '<button type="button" class="link" data-action="food-day-table">Tabela nutricional completa do dia' + ui.icon('right', 16) + '</button>' : '') + '</section>';

    html += waterCard(s, date, today);
    // Dia ainda vazio: oferece repetir o último dia com alimentos (até 14 dias atrás).
    var prevDay = !dl.count ? N.lastMealDay(s, date, null) : null;
    if (prevDay) {
      var pd = N.dayLog(s, prevDay);
      html += '<div class="banner soft copy-day"><span class="banner-ic">' + ui.icon('copy', 20) + '</span><div><strong>Repetir o dia de ' + esc(dayName(prevDay, today)) + '?</strong>' +
        '<p>' + pd.count + (pd.count === 1 ? ' alimento' : ' alimentos') + ' • ' + f0(pd.total.kcal) + ' kcal — dá para ajustar depois.</p></div>' +
        '<button type="button" class="btn primary small" data-action="food-copy" data-from="' + prevDay + '">Repetir</button></div>';
    }

    var groups = {};
    dl.meals.forEach(function (m) { groups[m.meal] = m; });
    mealsOfDay(s, date, dl).forEach(function (m) {
      var g = groups[m.type];
      var rows = g ? g.items.map(function (x) {
        return '<button type="button" class="food-row" data-action="food-log" data-id="' + esc(x.log.id) + '">' + foodIcon(x.food || { name: x.log.name }) + '<span class="fr-main"><span class="fr-name">' + foodName(x.log.name) + '</span>' +
          '<span class="fr-meta">' + f1(x.log.grams) + ' g • P ' + f1(x.nutr.prot) + ' • C ' + f1(x.nutr.carb) + ' • G ' + f1(x.nutr.lip) + '</span></span><strong>' + f0(x.nutr.kcal) + '<small> kcal</small></strong></button>';
      }).join('') : '';
      // Refeição vazia: "Repetir de ontem" (ou do último dia em que ela teve alimentos).
      var lastD = !g && !prevDay ? N.lastMealDay(s, date, m.type) : null, copy = '';
      if (lastD) {
        var src = N.dayLog(s, lastD).meals.filter(function (x) { return x.meal === m.type; })[0];
        copy = '<button type="button" class="copy-meal" data-action="food-copy" data-from="' + lastD + '" data-meal="' + m.type + '">' + ui.icon('repeat', 16) +
          '<span>Repetir de ' + esc(dayName(lastD, today)) + '<small>' + src.items.map(function (x) { return esc(String(x.log.name).split(',')[0]); }).slice(0, 3).join(', ') +
          (src.items.length > 3 ? '…' : '') + ' • ' + f0(src.total.kcal) + ' kcal</small></span></button>';
      }
      html += '<section class="card meal-card"><div class="card-head"><h2>' + esc(m.name) + (m.time ? ' <span class="muted small">' + esc(m.time) + '</span>' : '') + '</h2>' +
        (g ? '<span class="count">' + f0(g.total.kcal) + ' kcal</span>' : '') + '</div>' + rows + copy +
        '<button type="button" class="add-food" data-action="food-add" data-meal="' + m.type + '">' + ui.icon('plus', 18) + 'Adicionar alimento</button></section>';
    });
    html += '<p class="note">Valores da Tabela Brasileira de Composição de Alimentos (TACO — NEPA/UNICAMP), por quantidade registrada.</p>';
    return html;
  }

  // "ontem", "seg, 9 de nov"...
  function dayName(d, today) { return C.formatDayLabel(d, today).toLowerCase(); }

  /* ---------------- Água ---------------- */

  function waterCard(s, date, today) {
    var goal = R.waterGoal(s), ml = R.waterTotal(s, date), cup = R.waterCup(s);
    var pct = Math.min(100, Math.round(ml / goal.ml * 100)), left = goal.ml - ml;
    var cups = Math.min(12, Math.max(1, Math.round(goal.ml / cup))), full = Math.min(cups, Math.floor(ml / cup + 0.001));
    var week = R.waterDays(s, C.addDays(date, -6), date);
    var w = s.settings.water || {};
    return '<section class="card water-card" data-water-card><div class="card-head"><h2>' + ui.icon('drop', 18) + 'Água</h2>' +
      '<button type="button" class="link small-link" data-action="water-settings">' + (w.remind ? ui.icon('bell', 14) : '') + 'Meta e lembretes</button></div>' +
      '<div class="water-main"><div class="water-glass" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Água: ' + pct + '% da meta">' +
      '<span class="water-fill" style="height:' + pct + '%"></span></div>' +
      '<div class="water-nums"><p class="hero-num">' + JS.graf.fmtNum(ml, 0) + ' <small>ml de ' + esc(R.formatMl(goal.ml)) + '</small></p>' +
      '<p class="muted small">' + (left > 0 ? 'Faltam ' + esc(R.formatMl(left)) + ' • ' + Math.ceil(left / cup) + (Math.ceil(left / cup) === 1 ? ' copo' : ' copos') : 'Meta do dia batida! 💧') + '</p>' +
      '<div class="water-cups" aria-hidden="true">' + Array.apply(null, Array(cups)).map(function (x, i) { return '<i class="' + (i < full ? 'on' : '') + '">' + ui.icon('drop', 16) + '</i>'; }).join('') + '</div></div>' +
      (ml ? '<button type="button" class="icon-btn water-undo" data-action="water-undo" aria-label="Desfazer o último registro de água" title="Desfazer o último">' + ui.icon('undo', 18) + '</button>' : '') + '</div>' +
      '<div class="btn-row tight water-btns"><button type="button" class="btn small primary" data-action="water-add" data-ml="' + cup + '">' + ui.icon('plus', 16) + '1 copo (' + cup + ' ml)</button>' +
      (cup !== 500 ? '<button type="button" class="btn small soft" data-action="water-add" data-ml="500">+ 500 ml</button>' : '<button type="button" class="btn small soft" data-action="water-add" data-ml="1000">+ 1 L</button>') +
      '<button type="button" class="btn small soft" data-action="water-other">Outra</button></div>' +
      '<div class="water-week" aria-label="Água nos últimos 7 dias">' + week.map(function (d) {
        var p = Math.min(100, Math.round(d.ml / goal.ml * 100));
        return '<span class="ww' + (d.date === date ? ' on' : '') + (d.ml >= goal.ml ? ' full' : '') + '" title="' + esc(C.formatDateBR(d.date) + ': ' + R.formatMl(d.ml)) + '"><b><i style="height:' + p + '%"></i></b><em>' + C.WEEKDAY_LETTERS[C.weekday(d.date)] + '</em></span>';
      }).join('') + '</div></section>';
  }
  JS.waterCard = waterCard;

  function addWater(ml, date) {
    date = date || curDate();
    var added = null, s = JS.store.state, before = R.waterTotal(s, date), goal = R.waterGoal(s).ml;
    JS.anim.mark('[data-water-card] .water-glass', 'pop', { ms: 700 });
    JS.store.update(function (st, n) { added = R.addWater(st, date, ml, n); });
    if (!added) return;
    var now = before + added.ml;
    ui.toast((before < goal && now >= goal ? 'Meta de água batida! 💧 ' : '+' + added.ml + ' ml de água. ') + R.formatMl(now) + ' de ' + R.formatMl(goal) + '.',
      { actionLabel: 'Desfazer', onAction: function () { JS.store.update(function (st) { R.removeById(st.waterLogs, added.id); }); } });
  }
  JS.addWater = addWater;

  function waterOther() {
    var body = ui.input({ label: 'Quantidade (ml)', name: 'ml', type: 'number', value: '', attrs: 'inputmode="numeric" min="10" max="3000" step="10"', placeholder: 'Ex.: 350' }) +
      ui.chips([100, 150, 200, 300, 350, 600, 750, 1000].map(function (v) { return { label: v + ' ml', attrs: 'data-ml="' + v + '"' }; }));
    ui.openSheet({
      title: 'Registrar água', subtitle: C.formatDayLabel(curDate(), C.toDateKey(new Date())), body: body, submitLabel: 'Adicionar',
      onOpen: function (form) {
        form.querySelectorAll('[data-ml]').forEach(function (b) { b.addEventListener('click', function () { form.elements.ml.value = b.dataset.ml; }); });
        setTimeout(function () { form.elements.ml.focus(); }, 250);
      },
      onSubmit: function (v) {
        var ml = Math.round(Number(v.ml));
        if (!(ml >= 10 && ml <= 3000)) return { errors: { ml: 'De 10 a 3000 ml.' } };
        return { ml: ml };
      },
      afterClose: function (r) { if (r && r.ml) addWater(r.ml); }
    });
  }

  function waterSettings() {
    var s = JS.store.state, w = Object.assign({ cupMl: 250, every: 120, from: '09:00', to: '21:00' }, s.settings.water || {});
    var auto = R.waterGoal(Object.assign({}, s, { settings: Object.assign({}, s.settings, { water: Object.assign({}, w, { goalMl: null }) }) }));
    var body = ui.input({ label: 'Meta de água por dia (ml)', name: 'goalMl', type: 'number', value: w.goalMl || '', attrs: 'inputmode="numeric" min="500" max="6000" step="50"',
      placeholder: 'Automática: ' + auto.ml + ' ml',
      hint: 'Em branco = automática: ' + (auto.source === 'peso' ? '35 ml por kg do seu último peso (' + JS.graf.fmtNum(auto.kg, 1) + ' kg) = ' + R.formatMl(auto.ml) + '.' : '2 L (registre seu peso em Corpo para calcular pelo peso).') }) +
      ui.input({ label: 'Tamanho do seu copo/garrafinha (ml)', name: 'cupMl', type: 'number', value: R.waterCup(s), attrs: 'inputmode="numeric" min="' + R.CUP_MIN + '" max="' + R.CUP_MAX + '" step="1"',
        placeholder: 'Ex.: 330', hint: 'Digite o tamanho que você usa; é o que o botão "+1 copo" soma.' }) +
      ui.chips(R.WATER_CUPS.map(function (c) { return { label: R.formatMl(c), attrs: 'data-cup="' + c + '"' }; })) +
      ui.checkbox({ label: 'Lembretes para beber água', hint: 'Param quando você bate a meta do dia; se acabou de beber, o aviso daquele horário pula.', name: 'remind', checked: !!w.remind }) +
      '<div data-water-remind>' + ui.select({ label: 'Lembrar a cada', name: 'every', options: [[60, '1 hora'], [90, '1 hora e meia'], [120, '2 horas'], [150, '2 horas e meia'], [180, '3 horas'], [240, '4 horas']], value: w.every }) +
      '<div class="row2">' + ui.input({ label: 'Das', name: 'from', type: 'time', value: w.from }) + ui.input({ label: 'Até', name: 'to', type: 'time', value: w.to }) + '</div></div>' +
      '<p class="hint">Referência geral; em dias quentes ou de treino, beba um pouco mais. Se você tem orientação médica sobre líquidos, siga a orientação.</p>';
    ui.openSheet({
      title: 'Água', body: body, submitLabel: 'Salvar',
      onOpen: function (form) {
        form.querySelectorAll('[data-cup]').forEach(function (b) { b.addEventListener('click', function () { form.elements.cupMl.value = b.dataset.cup; }); });
        var box = form.querySelector('[data-water-remind]'), cb = form.elements.remind;
        function sync() { box.hidden = !cb.checked; }
        cb.addEventListener('change', sync); sync();
      },
      onSubmit: function (input) {
        var r = R.validateWaterSettings(input);
        if (!r.ok) return { errors: r.errors };
        JS.store.update(function (st) { st.settings.water = r.value; });
        ui.toast(r.value.remind ? 'Pronto! Vou lembrar de beber água.' : 'Meta de água salva.');
        return { remind: r.value.remind };
      },
      afterClose: function (res) { if (res && res.remind) JS.notify.askIfNeeded(); }
    });
  }
  JS.waterSettings = waterSettings;

  /* ---------------- Cardápio sugerido ---------------- */

  function targetText(target) {
    if (!target) return 'Sem meta: as porções são as de base. Informe sua meta ou registre o metabolismo basal em Corpo para ajustar.';
    if (target.source === 'manual') return 'Meta definida por você.';
    var act = N.ACTIVITY[JS.store.state.settings.nutrition.activity] || N.ACTIVITY.moderada;
    return 'Estimada: metabolismo basal ' + f0(target.bmr) + ' kcal (' + (target.source === 'formula' ? 'fórmula, pelos seus dados' : 'da sua bioimpedância') + ') × atividade ' + act[0].toLowerCase() + '.';
  }

  function renderCardapio(s, now) {
    var today = C.toDateKey(now), date = curDate();
    var menu = N.suggestMenu(s, date, view.variants);
    var html = '<section class="card"><div class="card-head"><h2>' + ui.icon('leaf', 18) + 'Cardápio de ' + esc(C.formatDayLabel(date, today).toLowerCase()) + '</h2>' +
      '<button type="button" class="link small-link" data-action="nutri-settings">Meta</button></div>' +
      (menu.target ? '<p class="hero-num">' + f0(menu.target.value) + ' <small>kcal no dia</small></p>' : '') +
      '<p class="muted small">' + esc(targetText(menu.target)) + '</p></section>';
    var all = [];
    menu.meals.forEach(function (m) {
      all = all.concat(m.items.map(function (i) { return i.nutr; }));
      html += '<section class="card sug-card"><div class="card-head"><h2>' + esc(m.mealName) + (m.time ? ' <span class="muted small">' + esc(m.time) + '</span>' : '') + '</h2>' +
        '<span class="count">≈ ' + f0(m.total.kcal) + ' kcal</span></div>' +
        '<div class="sug-plate" aria-hidden="true">' + m.items.map(function (i) { return foodIcon(N.foodById(s, i.foodId)); }).join('') + '</div>' +
        '<p class="sug-name">' + esc(m.option) + ' <span class="muted small">(opção ' + (m.optionIndex + 1) + ' de ' + m.options + ')</span></p>' +
        '<ul class="sug-list">' + m.items.map(function (i) {
          return '<li><button type="button" data-action="food-info" data-id="' + esc(i.foodId) + '" data-grams="' + i.grams + '">' + foodIcon(N.foodById(s, i.foodId)) + '<span>' + f0(i.grams) + ' g</span><span class="fr-name">' + foodName(i.name) + '</span><em>' + f0(i.nutr.kcal) + ' kcal</em></button></li>';
        }).join('') + '</ul>' +
        '<p class="fr-meta">Proteínas ' + f1(m.total.prot) + ' g • Carboidratos ' + f1(m.total.carb) + ' g • Gorduras ' + f1(m.total.lip) + ' g • Fibras ' + f1(m.total.fibra) + ' g</p>' +
        '<div class="btn-row tight"><button type="button" class="btn small primary" data-action="sug-use" data-meal="' + m.type + '">' + ui.icon('plus', 16) + 'Usar no diário</button>' +
        '<button type="button" class="btn small soft" data-action="sug-next" data-meal="' + m.type + '">' + ui.icon('repeat', 16) + 'Outra opção</button></div></section>';
    });
    var tot = N.sum(all);
    html += '<div class="summary"><div class="stat"><span class="stat-label">Total sugerido</span><strong>' + f0(tot.kcal) + ' kcal</strong><span class="stat-sub">P ' + f1(tot.prot) + ' g • C ' + f1(tot.carb) + ' g • G ' + f1(tot.lip) + ' g</span></div>' +
      '<div class="stat"><span class="stat-label">Fibras</span><strong>' + f1(tot.fibra) + ' g</strong><span class="stat-sub">no dia sugerido</span></div></div>';
    html += '<p class="note">' + ui.icon('info', 14) + ' Sugestões gerais e equilibradas montadas com a Tabela TACO, ajustadas à sua meta. Não substituem a orientação de uma nutricionista — se você tem um plano dela, siga o plano.</p>';
    return html;
  }

  /* ---------------- Tabela (busca) ---------------- */

  function renderTabela() {
    return '<div class="field search-field">' + ui.icon('search', 18) + '<input type="search" name="foodq" value="' + esc(view.query) + '" placeholder="Buscar alimento (ex.: ovo, banana, arroz)" autocomplete="off" aria-label="Buscar alimento" data-food-search></div>' +
      '<div class="quick-chips">' + ['ovo', 'banana', 'arroz', 'feijão', 'frango', 'pão', 'iogurte', 'aveia'].map(function (q) { return '<button type="button" class="chip" data-action="food-q" data-q="' + q + '">' + q + '</button>'; }).join('') + '</div>' +
      '<div class="food-results" data-food-results>' + resultsHtml(view.query) + '</div>' +
      '<button type="button" class="btn soft full" data-action="food-custom">' + ui.icon('plus', 18) + 'Cadastrar alimento que não está na tabela</button>' +
      '<p class="note">' + N.count + ' alimentos da ' + esc(N.source) + '. Valores por 100 g.</p>';
  }
  function resultsHtml(q) {
    if (!q) {
      var fav = N.favorites(JS.store.state);
      return fav.length ? '<p class="stat-label">' + ui.icon('star', 14) + ' Favoritos</p>' + fav.map(function (x) { return foodRow(x.food, x.grams, 'favorito'); }).join('')
        : '<p class="muted small">Digite o nome de um alimento para ver a tabela nutricional. Toque na estrela ☆ de um alimento para deixá-lo nos favoritos.</p>';
    }
    var list = N.search(JS.store.state, q, 40);
    if (!list.length) return '<p class="muted small">Nada encontrado para "' + esc(q) + '". Tente outra palavra ou cadastre o alimento.</p>';
    return list.map(function (f) {
      return '<button type="button" class="food-row" data-action="food-info" data-id="' + esc(f.id) + '">' + foodIcon(f) + '<span class="fr-main"><span class="fr-name">' + foodName(f.name) + '</span>' +
        '<span class="fr-meta">' + esc(f.group) + ' • P ' + f1(f.per100.prot) + ' • C ' + f1(f.per100.carb) + ' • G ' + f1(f.per100.lip) + '</span></span><strong>' + f0(f.per100.kcal) + '<small> kcal</small></strong></button>';
    }).join('');
  }

  function render(now) {
    var s = JS.store.state;
    var html = '<h1 class="page-title">Alimentação</h1>' + ui.segmented(MODES, view.mode, 'food-mode');
    if (view.mode === 'hoje') html += renderDiario(s, now);
    else if (view.mode === 'cardapio') html += renderCardapio(s, now);
    else if (view.mode === 'horarios') html += renderHorarios(s, now);
    else html += renderTabela();
    return html;
  }

  function after(main) {
    var inp = main.querySelector('[data-food-search]');
    if (!inp) return;
    var box = main.querySelector('[data-food-results]'), t = null;
    inp.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { view.query = inp.value; box.innerHTML = resultsHtml(view.query); }, 120);
    });
  }

  /* ---------------- Tabela nutricional (folha) ---------------- */

  function nutriTable(per100, grams) {
    var p = N.scale(per100, grams);
    return '<table class="nutri-table"><thead><tr><th>Nutriente</th><th>' + f1(grams) + ' g</th><th>100 g</th></tr></thead><tbody>' +
      N.NUTRIENTS.map(function (n) {
        return '<tr' + (N.MAIN.indexOf(n.key) >= 0 ? ' class="main"' : '') + '><td>' + esc(n.label) + '</td><td>' + (p[n.key] == null ? '—' : N.fmt(p[n.key], n.key) + ' ' + n.unit) + '</td>' +
          '<td>' + (per100[n.key] == null ? '—' : N.fmt(per100[n.key], n.key) + ' ' + n.unit) + '</td></tr>';
      }).join('') + '</tbody></table><p class="hint">— = não analisado na TACO. Fonte: ' + esc(N.source) + '.</p>';
  }
  function dayTable(rows) {
    var t = N.sum(rows);
    return '<table class="nutri-table"><thead><tr><th>Nutriente</th><th>Total</th></tr></thead><tbody>' +
      N.NUTRIENTS.map(function (n) {
        return '<tr' + (N.MAIN.indexOf(n.key) >= 0 ? ' class="main"' : '') + '><td>' + esc(n.label) + '</td><td>' + (t[n.key] == null ? '—' : N.fmt(t[n.key], n.key) + ' ' + n.unit + (t.partial[n.key] ? '*' : '')) + '</td></tr>';
      }).join('') + '</tbody></table><p class="hint">* soma parcial: algum alimento não tem esse valor analisado na TACO.</p>';
  }

  // opts: { grams, meal, date, logId } — sem logId, oferece "Adicionar ao diário".
  function foodInfo(foodId, opts) {
    opts = opts || {};
    var s = JS.store.state, f = N.foodById(s, foodId);
    if (!f) { ui.toast('Alimento não encontrado.', { error: true }); return; }
    var grams = Number(opts.grams) || 100;
    var editing = !!opts.logId;
    var portions = N.portions(s, foodId);
    var chips = GRAM_CHIPS.map(function (g) { return { label: g + ' g', attrs: 'data-g="' + g + '"' }; })
      .concat(portions.map(function (p) { return { label: p.label + ' (' + JS.graf.fmtNum(p.grams, 1) + ' g)', attrs: 'data-g="' + p.grams + '"' }; }));
    var fav = N.isFavorite(s, foodId);
    var body = '<div class="food-head">' + foodIcon(f) + '<div><p class="food-title">' + foodName(f.name) + '</p><p class="muted small">' + esc(f.group) + '</p></div>' +
      '<button type="button" class="fav-btn' + (fav ? ' on' : '') + '" data-fav aria-pressed="' + fav + '" aria-label="' + (fav ? 'Tirar dos favoritos' : 'Colocar nos favoritos') + '" title="Favorito">' + ui.icon('star', 22) + '</button></div>' +
      '<div class="row2">' + ui.input({ label: 'Quantidade (g)', name: 'grams', type: 'text', value: String(grams).replace('.', ','), attrs: 'inputmode="decimal" min="1" max="3000" step="1"' }) +
      ui.select({ label: 'Refeição', name: 'meal', options: ui.entries(C.MEAL_TYPES), value: opts.meal || guessMeal() }) + '</div>' +
      ui.chips(chips) +
      '<button type="button" class="link" data-save-portion>' + ui.icon('plus', 16) + 'Salvar esta quantidade como porção (ex.: 1 unidade)</button>' +
      '<div data-table>' + nutriTable(f.per100, grams) + '</div>';
    ui.openSheet({
      title: 'Tabela nutricional', body: body, submitLabel: editing ? 'Salvar' : 'Adicionar ao diário',
      subtitle: editing ? 'Registrado no diário' : (opts.date && opts.date !== C.toDateKey(new Date()) ? C.formatDateBR(opts.date) : null),
      onOpen: function (form) {
        var gi = form.elements.grams, tb = form.querySelector('[data-table]');
        function redraw() { var g = Number(String(gi.value).replace(',', '.')); if (g > 0) tb.innerHTML = nutriTable(f.per100, g); }
        gi.addEventListener('input', redraw);
        var fb = form.querySelector('[data-fav]');
        fb.addEventListener('click', function () {
          var on = false;
          JS.store.silentUpdate(function (st) { on = N.toggleFavorite(st, foodId); });
          fb.classList.toggle('on', on); fb.setAttribute('aria-pressed', String(on));
          fb.setAttribute('aria-label', on ? 'Tirar dos favoritos' : 'Colocar nos favoritos');
          JS.anim.restartClass(fb, 'pop');
          ui.toast(on ? 'Nos favoritos ⭐ — aparece primeiro quando você for adicionar.' : 'Tirado dos favoritos.');
        });
        form.querySelectorAll('[data-g]').forEach(function (b) { b.addEventListener('click', function () { gi.value = b.dataset.g; redraw(); }); });
        form.querySelector('[data-save-portion]').addEventListener('click', function () {
          var g = Number(String(gi.value).replace(',', '.'));
          var label = window.prompt('Nome da porção (ex.: 1 unidade, 1 colher, 1 fatia) para ' + JS.graf.fmtNum(g, 1) + ' g:', '1 unidade');
          if (!label) return;
          JS.store.silentUpdate(function (st) { N.addPortion(st, foodId, label, g); });
          ui.toast('Porção "' + label.trim().slice(0, 30) + '" salva para este alimento.');
        });
      },
      onSubmit: function (v) {
        var g = Number(String(v.grams).replace(',', '.'));
        if (!(g > 0 && g <= 3000)) return { errors: { grams: 'Informe de 1 a 3000 g.' } };
        if (editing) {
          JS.anim.mark('[data-action="food-log"][data-id="' + opts.logId + '"]', 'flash', { delay: 160 });
          JS.store.update(function (st) { N.updateFoodLog(st, opts.logId, g, v.meal); });
          ui.toast('Quantidade atualizada.');
          return;
        }
        var r = N.validateFoodLog({ date: opts.date || curDate(), meal: v.meal, foodId: foodId, grams: g });
        if (!r.ok) return { errors: r.errors };
        var added = null;
        JS.anim.mark(function () { return added && '[data-action="food-log"][data-id="' + added.id + '"]'; }, 'is-new', { delay: 180 });
        JS.store.update(function (st, n) { added = N.addFoodLog(st, r.value, n); });
        if (view.mode !== 'hoje' && opts.fromSearch) { /* fica na tabela */ }
        ui.toast('Adicionado em ' + C.MEAL_TYPES[r.value.meal].toLowerCase() + ': ' + f0(N.scale(f.per100, g).kcal) + ' kcal.');
      }
    });
  }
  JS.foodInfo = foodInfo;

  function guessMeal() {
    var h = new Date().getHours();
    return h < 10 ? 'breakfast' : h < 12 ? 'morning_snack' : h < 15 ? 'lunch' : h < 18 ? 'afternoon_snack' : h < 21 ? 'dinner' : 'supper';
  }

  // Busca para adicionar a uma refeição.
  function addFood(meal) {
    var date = curDate();
    var body = '<div class="field search-field">' + ui.icon('search', 18) + '<input type="search" name="q" placeholder="Buscar alimento" autocomplete="off" aria-label="Buscar alimento"></div>' +
      '<div class="food-results" data-results>' + recentHtml() + '</div>' +
      '<button type="button" class="btn soft full" data-custom>' + ui.icon('plus', 18) + 'Cadastrar alimento</button>';
    ui.openSheet({
      title: 'Adicionar em ' + C.MEAL_TYPES[meal].toLowerCase(), subtitle: C.formatDayLabel(date, C.toDateKey(new Date())), body: body,
      onOpen: function (form) {
        var q = form.elements.q, box = form.querySelector('[data-results]'), t = null;
        q.addEventListener('input', function () {
          clearTimeout(t);
          t = setTimeout(function () { box.innerHTML = q.value.trim() ? resultsHtml(q.value) : recentHtml(); }, 120);
        });
        box.addEventListener('click', function (e) {
          var b = e.target.closest('[data-id]');
          if (!b) return;
          e.preventDefault(); e.stopPropagation();
          foodInfo(b.dataset.id, { meal: meal, date: date, grams: b.dataset.grams });
        });
        form.querySelector('[data-custom]').addEventListener('click', function () { customFoodForm(meal); });
        setTimeout(function () { q.focus(); }, 250);
      }
    });
  }
  // Linha de alimento com a quantidade sugerida (favoritos, recentes).
  function foodRow(f, grams, kind) {
    var fav = N.isFavorite(JS.store.state, f.id);
    return '<button type="button" class="food-row" data-action="food-info" data-id="' + esc(f.id) + '" data-grams="' + grams + '">' + foodIcon(f) + '<span class="fr-main"><span class="fr-name">' + foodName(f.name) +
      (fav && kind !== 'favorito' ? ' <span class="fav-mini" aria-label="favorito">★</span>' : '') + '</span><span class="fr-meta">' + (kind === 'recente' ? 'última vez ' : '') + f1(grams) + ' g</span></span><strong>' +
      f0(N.scale(f.per100, grams).kcal) + '<small> kcal</small></strong></button>';
  }
  // Atalhos antes de digitar: favoritos e usados recentemente.
  function recentHtml() {
    var s = JS.store.state, fav = N.favorites(s), favIds = fav.map(function (x) { return x.food.id; });
    var rec = N.recentFoods(s, 10).filter(function (x) { return favIds.indexOf(x.food.id) < 0; }).slice(0, 8);
    if (!fav.length && !rec.length) return '<p class="muted small">Digite para buscar na tabela TACO (' + N.count + ' alimentos).</p>';
    return (fav.length ? '<p class="stat-label">' + ui.icon('star', 14) + ' Favoritos</p>' + fav.map(function (x) { return foodRow(x.food, x.grams, 'favorito'); }).join('') : '') +
      (rec.length ? '<p class="stat-label">Usados recentemente</p>' + rec.map(function (x) { return foodRow(x.food, x.grams, 'recente'); }).join('') : '') +
      (!fav.length ? '<p class="hint">Dica: toque na estrela ☆ de um alimento para ele ficar sempre aqui em cima.</p>' : '');
  }

  function customFoodForm(meal) {
    var main = ['kcal', 'carb', 'prot', 'lip', 'fibra', 'sodio'];
    var body = ui.input({ label: 'Nome', name: 'name', attrs: 'maxlength="80"', placeholder: 'Ex.: Pão de queijo da padaria' }) +
      '<p class="hint top">Valores por 100 g (veja no rótulo: divida pelo tamanho da porção e multiplique por 100).</p>' +
      '<div class="row2">' + main.map(function (k) {
        var n = N.NUTRIENTS.filter(function (x) { return x.key === k; })[0];
        return ui.input({ label: n.label + ' (' + n.unit + ')', name: k, type: 'text', attrs: 'inputmode="decimal" autocomplete="off"' });
      }).join('') + '</div>';
    ui.openSheet({
      title: 'Cadastrar alimento', body: body, submitLabel: 'Salvar alimento',
      onSubmit: function (input) {
        var r = N.validateCustomFood(input);
        if (!r.ok) return { errors: r.errors };
        var f = null;
        JS.store.silentUpdate(function (st, n) { f = N.createCustomFood(st, r.value, n); });
        return { f: f };
      },
      afterClose: function (res) { if (res && res.f) foodInfo(res.f.id, { meal: meal || guessMeal(), date: curDate() }); }
    });
  }

  function logMenu(id) {
    var s = JS.store.state, l = R.byId(s.foodLogs, id);
    if (!l) return;
    var nutr = N.logNutrients(s, l);
    ui.actionSheet({
      title: l.name, subtitle: f1(l.grams) + ' g • ' + f0(nutr.kcal) + ' kcal • ' + C.MEAL_TYPES[l.meal],
      actions: [
        { label: 'Tabela nutricional / mudar quantidade', icon: 'list', run: function () { foodInfo(l.foodId, { grams: l.grams, meal: l.meal, logId: l.id, date: l.date }); } },
        { label: 'Repetir este alimento', icon: 'repeat', run: function () {
          JS.store.update(function (st, n) { N.addFoodLog(st, { date: l.date, meal: l.meal, foodId: l.foodId, grams: l.grams }, n); });
          ui.toast('Adicionado de novo.');
        } },
        { label: 'Excluir', icon: 'trash', danger: true, run: function () {
          JS.anim.removeThen('[data-action="food-log"][data-id="' + id + '"]', null, function () { JS.store.update(function (st) { N.deleteFoodLog(st, id); }); ui.toast('Alimento removido.'); });
        } }
      ]
    });
  }

  function nutriSettings() {
    var n = JS.store.state.settings.nutrition || {};
    var auto = N.kcalTarget(Object.assign({}, JS.store.state, { settings: Object.assign({}, JS.store.state.settings, { nutrition: Object.assign({}, n, { kcalTarget: null }) }) }));
    var body = ui.input({ label: 'Meta de calorias por dia (kcal)', name: 'kcal', type: 'number', value: n.kcalTarget || '', attrs: 'inputmode="numeric" min="800" max="6000" step="10"',
      placeholder: auto ? 'Automática: ' + auto.value : 'Ex.: 1800', hint: 'Deixe em branco para usar a estimativa automática' + (auto ? ' (' + f0(auto.value) + ' kcal).' : ' (precisa do metabolismo basal em Corpo, ou de peso + altura + ano de nascimento).') }) +
      ui.select({ label: 'Nível de atividade (para a estimativa)', name: 'activity', options: Object.keys(N.ACTIVITY).map(function (k) { return [k, N.ACTIVITY[k][0]]; }), value: n.activity || 'moderada' }) +
      '<p class="hint">Se uma nutricionista passou uma meta, use a dela.</p>';
    ui.openSheet({
      title: 'Meta de calorias', body: body, submitLabel: 'Salvar',
      onSubmit: function (v) {
        var k = v.kcal ? Number(v.kcal) : null;
        if (k != null && !(k >= 800 && k <= 6000)) return { errors: { kcal: 'Entre 800 e 6000 kcal.' } };
        JS.store.update(function (s) { s.settings.nutrition = { kcalTarget: k, activity: N.ACTIVITY[v.activity] ? v.activity : 'moderada' }; });
        ui.toast('Meta salva.');
      }
    });
  }
  JS.nutriSettings = nutriSettings;

  /* ---------------- Formulários de horário (lembretes) ---------------- */

  function openMealForm(m) {
    var v = m || { name: '', type: 'breakfast', time: '', weekdays: [0, 1, 2, 3, 4, 5, 6], description: '', reminderEnabled: true };
    var body =
      ui.select({ label: 'Tipo', name: 'type', options: ui.entries(C.MEAL_TYPES), value: v.type }) +
      ui.input({ label: 'Nome', name: 'name', value: v.name, placeholder: C.MEAL_TYPES[v.type], attrs: 'maxlength="60"', hint: 'Se deixar em branco, usamos o tipo.' }) +
      ui.input({ label: 'Horário', name: 'time', type: 'time', value: v.time, required: true }) +
      ui.weekdays({ label: 'Dias da semana', name: 'weekdays', value: v.weekdays }) +
      ui.chips([{ label: 'Todos os dias', attrs: 'data-wd="all"' }, { label: 'Seg. a sex.', attrs: 'data-wd="week"' }, { label: 'Fim de semana', attrs: 'data-wd="weekend"' }]) +
      ui.textarea({ label: 'Descrição (opcional)', name: 'description', value: v.description, attrs: 'maxlength="500"' }) +
      ui.checkbox({ label: 'Lembrete', hint: 'Avisar no horário da refeição', name: 'reminderEnabled', checked: v.reminderEnabled });
    ui.openSheet({
      title: m ? 'Editar horário' : 'Novo horário de refeição', body: body, submitLabel: m ? 'Salvar' : 'Adicionar',
      onOpen: function (form) {
        var typeSel = form.elements.type, nameIn = form.elements.name;
        typeSel.addEventListener('change', function () { nameIn.placeholder = C.MEAL_TYPES[typeSel.value]; });
        var sets = { all: [0, 1, 2, 3, 4, 5, 6], week: [1, 2, 3, 4, 5], weekend: [0, 6] };
        form.querySelectorAll('[data-wd]').forEach(function (b) {
          b.addEventListener('click', function () {
            var set = sets[b.dataset.wd];
            form.querySelectorAll('input[name="weekdays"]').forEach(function (cb) { cb.checked = set.indexOf(Number(cb.value)) >= 0; });
          });
        });
      },
      onSubmit: function (input) {
        var r = R.validateMeal(input);
        if (!r.ok) return { errors: r.errors };
        var saved = null;
        JS.anim.mark(function () { return saved && itemSel(saved.id); }, m ? 'flash' : 'is-new', { closest: '.item', delay: 180 });
        JS.store.update(function (s, n) { saved = m ? R.updateMeal(s, m.id, r.value, n) : R.createMeal(s, r.value, n); });
        ui.toast(m ? 'Horário atualizado.' : 'Horário adicionado.');
        return { reminder: r.value.reminderEnabled };
      },
      afterClose: function (res) { if (res && res.reminder) JS.notify.askIfNeeded(); }
    });
  }

  function exceptionForm(m, date) {
    var tomorrow = C.addDays(C.toDateKey(new Date()), 1);
    var body = ui.input({ label: 'Dia', name: 'date', type: 'date', value: date || tomorrow }) +
      '<div class="field" data-field="kind"><span class="label">Neste dia</span><div class="radio-list">' +
      '<label class="radio"><input type="radio" name="kind" value="skip" checked><span>Pular esta refeição</span></label>' +
      '<label class="radio"><input type="radio" name="kind" value="time"><span>Usar outro horário</span></label></div><p class="err"></p></div>' +
      ui.input({ label: 'Outro horário', name: 'time', type: 'time', value: m.time }) +
      '<p class="hint">Só esse dia muda; o horário fixo continua igual.</p>';
    ui.openSheet({
      title: 'Exceção para um dia', subtitle: m.name + ' • ' + m.time, body: body, submitLabel: 'Salvar exceção',
      onSubmit: function (v) {
        var e = {};
        if (!C.isDateKey(v.date)) e.date = 'Escolha o dia.';
        if (v.kind === 'time' && !C.isTimeKey(v.time)) e.time = 'Escolha o horário.';
        if (Object.keys(e).length) return { errors: e };
        JS.anim.mark(itemSel(m.id), 'flash', { closest: '.item', delay: 180 });
        JS.store.update(function (s) { R.setMealException(s, m.id, v.date, v.kind === 'skip' ? { skip: true } : { time: v.time }); });
        ui.toast('Exceção salva para ' + C.formatDateBR(v.date) + '.');
      }
    });
  }

  function timeTodayForm(m, date) {
    var body = ui.input({ label: 'Horário só hoje', name: 'time', type: 'time', value: m.time });
    ui.openSheet({
      title: 'Mudar horário de hoje', subtitle: m.name, body: body, submitLabel: 'Salvar',
      onSubmit: function (v) {
        if (!C.isTimeKey(v.time)) return { errors: { time: 'Escolha o horário.' } };
        JS.anim.mark(itemSel(m.id), 'flash', { closest: '.item', delay: 180 });
        JS.store.update(function (s) { R.setMealException(s, m.id, date, { time: v.time }); });
        ui.toast('Horário de hoje alterado.');
      }
    });
  }

  function todayMenu(id, date) {
    var s = JS.store.state, m = R.byId(s.meals, id);
    if (!m) return;
    var o = R.mealOccurrencesOn(s, date).filter(function (x) { return x.meal.id === id; })[0];
    if (!o) return mealMenu(id);
    var history = s.settings.mealHistory !== false;
    var hasEx = o.skipped || o.changed;
    ui.actionSheet({
      title: m.name, subtitle: C.formatDayLabel(date, C.toDateKey(new Date())) + ' • ' + o.time,
      actions: [
        history && !o.skipped ? { label: o.done ? 'Desmarcar como feita' : 'Marcar como feita', icon: o.done ? 'undo' : 'check', run: function () { toggleDone(id, date); } } : null,
        { label: 'Registrar alimentos desta refeição', icon: 'plus', run: function () { view.date = date; addFood(m.type === 'other' ? 'other' : m.type); } },
        !o.skipped ? { label: 'Pular hoje', icon: 'skip', run: function () { JS.anim.mark(itemSel(id), 'flash', { closest: '.item' }); JS.store.update(function (st) { R.setMealException(st, id, date, { skip: true }); }); ui.toast('Refeição pulada hoje.'); } } : null,
        !o.skipped ? { label: 'Mudar o horário só hoje', icon: 'clock', run: function () { timeTodayForm(m, date); } } : null,
        hasEx ? { label: 'Voltar ao normal hoje', icon: 'undo', run: function () { JS.anim.mark(itemSel(id), 'flash', { closest: '.item' }); JS.store.update(function (st) { R.clearMealException(st, id, date); }); ui.toast('Horário normal restaurado.'); } } : null,
        { label: 'Editar horário fixo', icon: 'edit', run: function () { openMealForm(m); } }
      ]
    });
  }

  function mealMenu(id) {
    var s = JS.store.state, m = R.byId(s.meals, id);
    if (!m) return;
    var days = m.weekdays.length === 7 ? 'Todos os dias' : m.weekdays.map(function (d) { return C.WEEKDAY_SHORT[d]; }).join(', ');
    ui.actionSheet({
      title: m.name, subtitle: m.time + ' • ' + days + (m.enabled ? '' : ' • Pausada'),
      detail: m.description ? '<p>' + esc(m.description) + '</p>' : '',
      actions: [
        { label: 'Editar', icon: 'edit', run: function () { openMealForm(m); } },
        { label: m.enabled ? 'Pausar' : 'Reativar', icon: m.enabled ? 'pause' : 'play', run: function () {
          JS.anim.mark(itemSel(id), 'flash', { closest: '.item' });
          JS.store.update(function (st, n) { R.setMealEnabled(st, id, !m.enabled, n); });
          ui.toast(m.enabled ? 'Horário pausado.' : 'Horário reativado.');
        } },
        { label: 'Exceção para um dia', icon: 'calendar', run: function () { exceptionForm(m); } },
        { label: 'Excluir', icon: 'trash', danger: true, run: function () {
          ui.confirm({ title: 'Excluir horário?', message: '"' + m.name + '" será excluído. O histórico de refeições feitas continua guardado.', confirmLabel: 'Excluir', danger: true })
            .then(function (ok) {
              if (ok) JS.anim.removeThen(itemSel(id), '.item', function () { JS.store.update(function (st) { R.deleteMeal(st, id); }); ui.toast('Horário excluído.'); });
            });
        } }
      ]
    });
  }

  function toggleDone(id, date) {
    var s = JS.store.state;
    var done = s.mealLogs.some(function (l) { return l.mealId === id && l.date === date; });
    JS.anim.mark('[data-action="meal-done"][data-id="' + id + '"][data-date="' + date + '"]', 'pop', { ms: 700 });
    JS.store.update(function (st, n) { if (done) R.unlogMeal(st, id, date); else R.logMeal(st, id, date, n); });
    if (!done) ui.toast('Refeição registrada.');
  }

  function itemSel(id) { return '[data-action="meal-today"][data-id="' + id + '"], [data-action="meal-menu"][data-id="' + id + '"]'; }

  /* ---------------- Registros ---------------- */

  JS.actions['food-mode'] = function (d) {
    if (d.mode === view.mode) return;
    var order = MODES.map(function (m) { return m[0]; });
    var dir = order.indexOf(d.mode) > order.indexOf(view.mode) ? 'r' : 'l';
    view.mode = d.mode;
    JS.app.render({ enter: 'view:' + dir });
  };
  JS.actions['food-day'] = function (d) {
    view.date = C.addDays(curDate(), Number(d.delta));
    if (view.date === C.toDateKey(new Date())) view.date = null;
    JS.app.render({ enter: 'view:' + (Number(d.delta) > 0 ? 'r' : 'l') });
  };
  JS.actions['food-add'] = function (d) { addFood(d.meal); };
  JS.actions['food-copy'] = function (d) {
    var date = curDate(), added = [];
    JS.store.update(function (st, n) { added = N.copyMeal(st, d.from, date, d.meal || null, n); });
    if (!added.length) return;
    var kcal = added.reduce(function (a, l) { return a + (N.logNutrients(JS.store.state, l).kcal || 0); }, 0);
    ui.toast(added.length + (added.length === 1 ? ' alimento repetido' : ' alimentos repetidos') + ' (' + f0(kcal) + ' kcal).', {
      actionLabel: 'Desfazer', timeout: 6000,
      onAction: function () { JS.store.update(function (st) { added.forEach(function (l) { N.deleteFoodLog(st, l.id); }); }); }
    });
  };
  JS.actions['water-add'] = function (d) { addWater(Number(d.ml)); };
  JS.actions['water-other'] = function () { waterOther(); };
  JS.actions['water-undo'] = function () {
    var date = curDate(), last = null;
    JS.store.update(function (st) { last = R.undoWater(st, date); });
    if (last) ui.toast('Tirado: ' + last.ml + ' ml de água.');
  };
  JS.actions['water-settings'] = function () { waterSettings(); };
  JS.actions['food-log'] = function (d) { logMenu(d.id); };
  JS.actions['food-info'] = function (d) { foodInfo(d.id, { grams: d.grams, date: curDate(), fromSearch: true }); };
  JS.actions['food-q'] = function (d) { view.query = d.q; JS.app.render(); };
  JS.actions['food-custom'] = function () { customFoodForm(null); };
  JS.actions['food-day-table'] = function () {
    var s = JS.store.state, dl = N.dayLog(s, curDate()), rows = [];
    dl.meals.forEach(function (m) { m.items.forEach(function (x) { rows.push(x.nutr); }); });
    ui.openSheet({ title: 'Tabela nutricional do dia', subtitle: C.formatDateLong(curDate()), body: dayTable(rows) });
  };
  JS.actions['nutri-settings'] = nutriSettings;
  JS.actions['sug-next'] = function (d) {
    view.variants[d.meal] = (view.variants[d.meal] || 0) + 1;
    JS.anim.mark('[data-action="sug-next"][data-meal="' + d.meal + '"]', 'flash', { closest: '.card', ms: 900 });
    JS.app.render();
  };
  JS.actions['sug-use'] = function (d) {
    var s = JS.store.state, date = curDate();
    var m = N.suggestMenu(s, date, view.variants).meals.filter(function (x) { return x.type === d.meal; })[0];
    if (!m) return;
    var meal = C.MEAL_TYPES[m.type] ? m.type : 'other';
    JS.store.update(function (st, n) { m.items.forEach(function (i) { N.addFoodLog(st, { date: date, meal: meal, foodId: i.foodId, grams: i.grams }, n); }); });
    ui.toast(m.items.length + ' alimentos adicionados em ' + m.mealName.toLowerCase() + '.', { actionLabel: 'Ver diário', onAction: function () { view.mode = 'hoje'; JS.app.render({ enter: 'view:l' }); } });
  };
  JS.actions['meal-new'] = function () { openMealForm(null); };
  JS.actions['meal-menu'] = function (d) { mealMenu(d.id); };
  JS.actions['meal-today'] = function (d) { todayMenu(d.id, d.date); };
  JS.actions['meal-done'] = function (d) { toggleDone(d.id, d.date); };

  JS.forms.meal = function () { openMealForm(null); };
  JS.forms.food = function () { addFood(guessMeal()); };
  JS.render.mealItem = function (o, now) { return todayItem(o, now, false); };
  JS.alimView = view;
  JS.telas.alimentacao = {
    title: 'Alimentação', render: render, after: after,
    get fab() { return view.mode === 'horarios' ? { label: 'Novo horário de refeição', action: 'meal-new' } : { label: 'Adicionar alimento', action: 'food-fab' }; }
  };
  JS.actions['food-fab'] = function () { addFood(guessMeal()); };
})();
