/* J.S. — Cardápio da semana (refeições salvas em cada dia) e lista de compras */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, R = window.JSRegras, N = window.JSNutri, P = window.JSPlanejador;
  if (!JS || !JS.ui || !JS.slots || !P || !N) return;
  var ui = JS.ui, esc = ui.esc;
  if (ui.addIcons) ui.addIcons({
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'
  });

  var MODES = [['semana', 'Semana'], ['compras', 'Lista de compras']];
  // start: segunda da semana mostrada (null = a semana de hoje, acompanha a virada do dia); days: dias incluídos na lista.
  var view = { mode: 'semana', start: null, days: null };

  function f0(v) { return JS.graf.fmtNum(v || 0, 0); }
  function f1(v) { return JS.graf.fmtNum(v || 0, 1); }
  function today() { return C.toDateKey(new Date()); }
  function curStart() { return view.start || P.mondayOf(today()); }
  function dayShort(d) { return C.WEEKDAY_SHORT[C.weekday(d)]; }

  /* ---------------- Peças ---------------- */

  function mealMeta(s, m) {
    var t = N.savedMealTotals(s, m);
    return f0(t.kcal) + ' kcal • P ' + f1(t.prot) + ' g • ' + m.items.length + (m.items.length === 1 ? ' alimento' : ' alimentos');
  }
  function plate(s, m) {
    return '<span class="saved-plate" aria-hidden="true">' + m.items.slice(0, 3).map(function (i) { return JS.foodIcon(N.foodById(s, i.foodId) || { name: '' }); }).join('') + '</span>';
  }
  function bar(pct, kind, label) {
    return '<span class="plan-bar ' + (kind || '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, pct) + '" aria-label="' + esc(label) + '"><i style="width:' + Math.min(100, pct) + '%"></i></span>';
  }

  function weekNav(start, t) {
    var cur = start === P.mondayOf(t);
    return '<div class="month-nav plan-nav full"><button type="button" class="icon-btn" data-action="plan-week" data-delta="-1" aria-label="Semana anterior">' + ui.icon('left') + '</button>' +
      '<strong>' + esc(P.weekLabel(start)) + (cur ? ' <span class="muted small">• esta semana</span>' : '') + '</strong>' +
      '<button type="button" class="icon-btn" data-action="plan-week" data-delta="1" aria-label="Próxima semana">' + ui.icon('right') + '</button></div>' +
      (cur ? '' : '<button type="button" class="link plan-today full" data-action="plan-today">' + ui.icon('calendar', 14) + 'Voltar para esta semana</button>');
  }

  /* ---------------- Semana ---------------- */

  function slotRow(s, date, sl, id) {
    var m = id ? R.byId(s.savedMeals || [], id) : null, ids = ' data-action="plan-slot" data-date="' + date + '" data-slot="' + sl.type + '"';
    var name = '<span class="ps-name">' + esc(sl.name) + (sl.time ? '<small>' + esc(sl.time) + '</small>' : '') + '</span>';
    if (m) return '<button type="button" class="plan-slot filled"' + ids + ' aria-label="' + esc(sl.name + ': ' + m.name + '. Toque para trocar') + '">' + name +
      '<span class="ps-meal"><strong>' + esc(m.name) + '</strong><small>' + esc(mealMeta(s, m)) + '</small></span>' + ui.icon('right', 16) + '</button>';
    if (id) return '<button type="button" class="plan-slot gone"' + ids + '>' + name + '<span class="ps-meal"><strong>Refeição removida</strong><small>Toque para trocar por outra</small></span>' + ui.icon('right', 16) + '</button>';
    return '<button type="button" class="plan-slot empty"' + ids + '>' + name + '<span class="ps-meal"><em>' + ui.icon('plus', 14) + 'Escolher refeição</em></span></button>';
  }

  function dayCard(s, d, t, ex) {
    var plan = ex.plans[d] || {}, tot = P.dayTotals(s, d, ex), kt = N.kcalTarget(s, d), pt = N.proteinTarget(s);
    var rows = P.slotsOfDay(s, d, ex).map(function (sl) { return slotRow(s, d, sl, plan[sl.type]); }).join('');
    var totals = '';
    if (tot.planned) {
      var kp = kt ? Math.round(tot.kcal / kt.value * 100) : 0, pp = pt ? Math.round(tot.prot / pt.value * 100) : 0;
      totals = '<div class="plan-tot"><div class="pt-line"><span>Planejado</span><strong>' + f0(tot.kcal) + ' kcal' + (kt ? ' <small>de ' + f0(kt.value) + (kp > 105 ? ' • acima da meta' : '') + '</small>' : '') + '</strong></div>' +
        (kt ? bar(kp, kp > 105 ? 'over' : '', 'Calorias planejadas em relação à meta') : '') +
        '<div class="pt-line"><span>Proteína</span><strong>' + f0(tot.prot) + ' g' + (pt ? ' <small>de ' + pt.value + (pp >= 100 ? ' • meta batida' : '') + '</small>' : '') + '</strong></div>' +
        (pt ? bar(pp, 'prot', 'Proteína planejada em relação à meta') : '') + '</div>';
    }
    var tools = tot.planned || tot.gone ? '<div class="btn-row tight plan-day-tools"><button type="button" class="btn small soft" data-action="plan-day-copy" data-date="' + d + '">' + ui.icon('copy', 16) + 'Copiar dia</button>' +
      '<button type="button" class="btn small soft" data-action="plan-day-apply" data-date="' + d + '">' + ui.icon('plus', 16) + 'Colocar no Diário</button></div>' : '';
    return '<section class="card plan-day' + (d === t ? ' is-today' : '') + '"><div class="card-head"><h2>' + esc(P.dayName(d)) + ' <span class="muted small">' + esc(C.formatDayMonth(d)) + '</span></h2>' +
      (d === t ? ui.tag('Hoje', 'soft') : '') + '</div><div class="plan-slots">' + rows + '</div>' + totals + tools + '</section>';
  }

  function emptyState() {
    return '<div class="full plan-empty">' + ui.empty('calendar', 'Para montar a semana, primeiro salve as refeições que você repete (ex.: "Meu café da manhã", "Meu almoço de sempre"). Depois é só escolher uma para cada dia e gerar a lista de compras.', { label: 'Criar refeições salvas', attrs: 'data-action="plan-goto-salvas"' }) + '</div>';
  }

  function renderSemana(s, start, t) {
    var ex = P.read(s), days = P.weekDays(start), planned = 0, total = 0;
    days.forEach(function (d) {
      var slots = P.slotsOfDay(s, d, ex), plan = ex.plans[d] || {};
      total += slots.length;
      slots.forEach(function (sl) { if (plan[sl.type]) planned++; });
    });
    var html = '<div class="full plan-sum"><p class="muted small"><strong>' + planned + ' de ' + total + '</strong> refeições planejadas</p>' + bar(total ? Math.round(planned / total * 100) : 0, '', 'Refeições planejadas na semana') + '</div>' +
      '<div class="btn-row plan-actions full"><button type="button" class="btn small primary" data-action="plan-suggest">' + ui.icon('sparkle', 16) + 'Sugerir</button>' +
      '<button type="button" class="btn small soft" data-action="plan-mode" data-mode="compras">' + ui.icon('cart', 16) + 'Lista de compras</button>' +
      '<button type="button" class="btn small soft" data-action="plan-more" aria-label="Mais ações da semana">Mais ações</button></div>';
    days.forEach(function (d) { html += dayCard(s, d, t, ex); });
    return html + '<p class="note full">' + ui.icon('info', 14) + ' O cardápio usa as suas refeições salvas. Os valores vêm da Tabela TACO e as metas são as de Alimentação. "Sugerir" só preenche o que está vazio.</p>';
  }

  /* ---------------- Lista de compras ---------------- */

  function shopDays(start) {
    var all = P.weekDays(start);
    return view.days && view.days.length ? all.filter(function (d) { return view.days.indexOf(d) >= 0; }) : all;
  }

  function itemRow(e) {
    var name = JS.foodName ? JS.foodName(e.name) : esc(e.name);
    var qty = P.fmtGrams(e.grams) + (e.units && e.units.n >= 1 ? '<small>≈ ' + esc(String(e.units.n).replace('.', ',')) + ' × ' + esc(e.units.label) + '</small>' : '');
    return '<button type="button" class="shop-item' + (e.checked ? ' done' : '') + '" role="checkbox" aria-checked="' + e.checked + '" data-action="plan-check" data-id="' + esc(e.foodId) + '">' +
      '<span class="shop-box" aria-hidden="true">' + (e.checked ? ui.icon('check', 14) : '') + '</span><span class="shop-name">' + name + '</span><span class="shop-qty">' + qty + '</span></button>';
  }

  function renderCompras(s, start, t) {
    var all = P.weekDays(start), days = shopDays(start), list = P.shoppingList(s, start, { days: days });
    var chips = '<div class="quick-chips plan-days full" role="group" aria-label="Dias incluídos na lista">' + all.map(function (d) {
      var on = days.indexOf(d) >= 0;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-action="plan-shop-day" data-date="' + d + '" aria-pressed="' + on + '">' + esc(dayShort(d)) + ' ' + Number(d.slice(8)) + '</button>';
    }).join('') + '</div>';
    var pct = list.count ? Math.round(list.checked / list.count * 100) : 0;
    var html = chips + '<div class="full shop-sum"><p class="muted small"><strong>' + list.checked + ' de ' + list.count + '</strong> itens marcados' + (list.plannedMeals ? ' • ' + list.plannedMeals + (list.plannedMeals === 1 ? ' refeição' : ' refeições') : '') + '</p>' + bar(pct, '', 'Itens da lista marcados') + '</div>';
    if (list.missingMeals || list.missingFoods) {
      html += '<p class="hint full warn-text">' + ui.icon('alert', 14) + ' ' + (list.missingMeals ? list.missingMeals + (list.missingMeals === 1 ? ' refeição planejada foi removida' : ' refeições planejadas foram removidas') : '') +
        (list.missingMeals && list.missingFoods ? ' e ' : '') + (list.missingFoods ? list.missingFoods + (list.missingFoods === 1 ? ' alimento não existe mais' : ' alimentos não existem mais') : '') + ': ficaram fora da lista.</p>';
    }
    if (!list.foods) {
      html += '<div class="full plan-empty">' + ui.empty('cart', 'Nenhuma refeição planejada nesses dias. Escolha as refeições na aba Semana e a lista aparece aqui, já somada.', { label: 'Planejar a semana', attrs: 'data-action="plan-mode" data-mode="semana"' }) + '</div>';
    }
    list.groups.forEach(function (g) {
      html += '<section class="card shop-group"><div class="card-head"><h2>' + esc(g.group) + '</h2><span class="count">' + g.items.length + '</span></div>' + g.items.map(itemRow).join('') + '</section>';
    });
    // itens manuais
    html += '<section class="card shop-extra-card"><div class="card-head"><h2>' + ui.icon('plus', 18) + 'Outros itens</h2></div>' +
      list.extras.map(function (x) {
        return '<div class="shop-item-row"><button type="button" class="shop-item' + (x.done ? ' done' : '') + '" role="checkbox" aria-checked="' + x.done + '" data-action="plan-extra-toggle" data-id="' + esc(x.id) + '">' +
          '<span class="shop-box" aria-hidden="true">' + (x.done ? ui.icon('check', 14) : '') + '</span><span class="shop-name">' + esc(x.name) + '</span></button>' +
          '<button type="button" class="icon-btn sm danger" data-action="plan-extra-del" data-id="' + esc(x.id) + '" aria-label="Tirar ' + esc(x.name) + ' da lista">' + ui.icon('x', 16) + '</button></div>';
      }).join('') +
      '<form class="shop-extra" data-extra-form autocomplete="off"><input name="item" type="text" maxlength="60" placeholder="Ex.: papel toalha, café" aria-label="Novo item da lista"><button type="submit" class="btn small primary">Adicionar</button></form></section>';
    html += '<div class="btn-row shop-actions full"><button type="button" class="btn small primary" data-action="plan-share"' + (list.count ? '' : ' disabled') + '>' + ui.icon('share', 16) + 'Compartilhar lista</button>' +
      '<button type="button" class="btn small soft" data-action="plan-clear-checked"' + (list.checked ? '' : ' disabled') + '>Limpar marcados</button></div>';
    return html + '<p class="note full">' + ui.icon('info', 14) + ' As quantidades são a soma do que está nas refeições planejadas (alimento cru ou como está na Tabela TACO). Toque num item para marcar como comprado.</p>';
  }

  /* ---------------- Tela ---------------- */

  function render(now) {
    var s = JS.store.state, t = C.toDateKey(now), start = view.start || P.mondayOf(t);
    var html = '<h1 class="page-title">Cardápio da semana</h1><p class="page-sub">Escolha as refeições de cada dia e gere a lista de compras.</p>' +
      ui.segmented(MODES, view.mode, 'plan-mode') + weekNav(start, t);
    if (view.mode === 'compras') return html + renderCompras(s, start, t);
    if (!(s.savedMeals || []).length) return html + emptyState();
    return html + renderSemana(s, start, t);
  }

  function after(main) {
    var f = main.querySelector('[data-extra-form]');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = f.elements.item.value;
      if (!String(v).trim()) { f.elements.item.focus(); return; }
      var added = null, start = curStart();
      JS.store.update(function (st) { added = P.addExtra(st, start, v); });
      if (!added) ui.toast('A lista aceita até ' + P.EXTRA_MAX + ' itens extras.', { error: true });
      else setTimeout(function () { var i = document.querySelector('[data-extra-form] input'); if (i) i.focus(); }, 60);
    });
  }

  function enter() {
    JS.store.silentUpdate(function (st) { if (st.extras && st.extras.planejador) P.prune(st, today()); });
  }

  /* ---------------- Escolher a refeição de um horário ---------------- */

  function pickRow(s, m, slot, cur) {
    var on = m.id === cur;
    return '<button type="button" class="saved-row plan-pick' + (on ? ' on' : '') + '" data-pick="' + esc(m.id) + '" aria-pressed="' + on + '">' + plate(s, m) +
      '<span class="sr-main"><strong>' + esc(m.name) + '</strong><small>' + esc(mealMeta(s, m) + (m.meal !== slot ? ' • ' + (C.MEAL_TYPES[m.meal] || '').toLowerCase() : '')) + '</small></span>' +
      '<em>' + (on ? '✓' : '+') + '</em></button>';
  }

  function openSlotPicker(date, slot) {
    var s = JS.store.state, cur = P.planOf(s, date)[slot], list = N.savedMealsFor(s, slot);
    var body = (cur ? '<button type="button" class="btn ghost danger-text full" data-clear>' + ui.icon('trash', 18) + 'Limpar esta refeição</button>' : '') +
      (list.length ? list.map(function (m) { return pickRow(s, m, slot, cur); }).join('') : '<p class="muted small">Você ainda não salvou nenhuma refeição.</p>') +
      '<button type="button" class="btn soft full" data-new>' + ui.icon('plus', 18) + 'Montar uma refeição nova</button>';
    ui.openSheet({
      title: C.MEAL_TYPES[slot], subtitle: P.dayName(date) + ' • ' + C.formatDayMonth(date), body: body,
      onOpen: function (form) {
        form.addEventListener('click', function (e) {
          var b = e.target.closest('[data-pick]');
          if (b) { e.preventDefault(); JS.store.update(function (st) { P.setSlot(st, date, slot, b.dataset.pick); }); ui.closeSheet(); return; }
          if (e.target.closest('[data-clear]')) { e.preventDefault(); JS.store.update(function (st) { P.setSlot(st, date, slot, null); }); ui.closeSheet(); return; }
          if (e.target.closest('[data-new]')) {
            e.preventDefault(); ui.closeSheet();
            if (JS.alimView) JS.alimView.mode = 'salvas';
            JS.app.go('alimentacao');
            setTimeout(function () { if (JS.actions['saved-new']) JS.actions['saved-new'](); }, 250);
          }
        });
      }
    });
  }

  /* ---------------- Copiar dia ---------------- */

  function copyDayForm(date) {
    var start = curStart(), days = P.weekDays(start);
    var body = '<p class="muted small">Copiar o que está planejado em <strong>' + esc(P.dayName(date)) + '</strong> para:</p>' +
      ui.weekdays({ label: 'Dias da semana', name: 'wd', value: [] }) +
      ui.chips([{ label: 'Seg. a sex.', attrs: 'data-wd="week"' }, { label: 'Fim de semana', attrs: 'data-wd="weekend"' }, { label: 'Todos os outros', attrs: 'data-wd="all"' }]) +
      ui.checkbox({ label: 'Substituir o que já está planejado', hint: 'Desligado: só preenche os horários vazios dos outros dias.', name: 'overwrite', checked: false });
    ui.openSheet({
      title: 'Copiar dia', subtitle: P.dayName(date) + ' • ' + C.formatDayMonth(date), body: body, submitLabel: 'Copiar',
      onOpen: function (form) {
        var sets = { all: [0, 1, 2, 3, 4, 5, 6], week: [1, 2, 3, 4, 5], weekend: [0, 6] };
        form.querySelectorAll('[data-wd]').forEach(function (b) {
          b.addEventListener('click', function () {
            var set = sets[b.dataset.wd];
            form.querySelectorAll('input[name="wd"]').forEach(function (cb) { cb.checked = set.indexOf(Number(cb.value)) >= 0 && Number(cb.value) !== C.weekday(date); });
          });
        });
      },
      onSubmit: function (v) {
        var picked = (Array.isArray(v.wd) ? v.wd : (v.wd ? [v.wd] : [])).map(Number);
        var targets = days.filter(function (d) { return picked.indexOf(C.weekday(d)) >= 0 && d !== date; });
        if (!targets.length) return { errors: { wd: 'Escolha pelo menos um dia (que não seja o mesmo).' } };
        var n = 0, snap = null;
        JS.store.update(function (st) { snap = P.snapshot(st); n = P.copyDayTo(st, date, targets, v.overwrite === true); });
        return { n: n, snap: snap, count: targets.length };
      },
      afterClose: function (res) {
        if (!res) return;
        if (!res.n) { ui.toast('Nada foi copiado: os outros dias já tinham esses horários planejados.'); return; }
        undoToast('Copiei ' + res.n + (res.n === 1 ? ' refeição' : ' refeições') + ' para ' + res.count + (res.count === 1 ? ' dia.' : ' dias.'), res.snap);
      }
    });
  }

  function undoToast(msg, snap) {
    ui.toast(msg, { actionLabel: 'Desfazer', timeout: 6000, onAction: function () { JS.store.update(function (st) { P.restore(st, snap); }); } });
  }

  /* ---------------- Colocar no Diário ---------------- */

  function applyDays(days, label) {
    var s = JS.store.state, planned = 0, conflicts = 0;
    days.forEach(function (d) { planned += Object.keys(P.planOf(s, d)).length; conflicts += P.diaryConflicts(s, d).length; });
    if (!planned) { ui.toast('Não há refeições planejadas para colocar no Diário.'); return; }
    var ask = conflicts
      ? ui.choose({ title: 'Já há alimentos no Diário', message: conflicts + (conflicts === 1 ? ' refeição planejada já tem alimentos' : ' refeições planejadas já têm alimentos') + ' registrados. O que fazer?',
        options: [{ label: 'Pular o que já tem alimentos', value: 'skip', primary: true }, { label: 'Colocar tudo mesmo assim', value: 'all' }] })
      : ui.confirm({ title: 'Colocar no Diário?', message: planned + (planned === 1 ? ' refeição de ' : ' refeições de ') + label + ' será adicionada ao Diário, nos dias planejados.', confirmLabel: 'Colocar' }).then(function (ok) { return ok ? 'all' : null; });
    ask.then(function (choice) {
      if (!choice) return;
      var res = null;
      JS.store.update(function (st, n) {
        res = { applied: 0, skipped: 0, gone: 0, logs: [], used: [], kcal: 0 };
        days.forEach(function (d) {
          var r = P.applyDay(st, d, n, { skipConflicts: choice === 'skip' });
          res.applied += r.applied; res.skipped += r.skipped; res.gone += r.gone; res.kcal += r.kcal; res.logs = res.logs.concat(r.logs); res.used = res.used.concat(r.used);
        });
      });
      if (!res.applied) { ui.toast(res.skipped ? 'Nada foi adicionado: todas as refeições já tinham alimentos.' : 'Nada foi adicionado.'); return; }
      ui.toast('Coloquei ' + res.applied + (res.applied === 1 ? ' refeição' : ' refeições') + ' no Diário (' + f0(res.kcal) + ' kcal).' + (res.skipped ? ' ' + res.skipped + ' puladas.' : '') + (res.gone ? ' ' + res.gone + ' removidas ficaram de fora.' : ''), {
        actionLabel: 'Desfazer', timeout: 6500,
        onAction: function () { JS.store.update(function (st) { P.undoApply(st, res); }); }
      });
    });
  }

  /* ---------------- Ações ---------------- */

  JS.actions['plan-mode'] = function (d) {
    if (d.mode === view.mode) return;
    var dir = MODES.map(function (m) { return m[0]; }).indexOf(d.mode) > MODES.map(function (m) { return m[0]; }).indexOf(view.mode) ? 'r' : 'l';
    view.mode = d.mode;
    JS.app.render({ enter: 'view:' + dir });
  };
  JS.actions['plan-week'] = function (d) {
    view.start = C.addDays(curStart(), 7 * Number(d.delta));
    if (view.start === P.mondayOf(today())) view.start = null;
    view.days = null;
    JS.app.render({ enter: 'view:' + (Number(d.delta) > 0 ? 'r' : 'l') });
  };
  JS.actions['plan-today'] = function () { view.start = null; view.days = null; JS.app.render({ enter: 'view:l' }); };
  JS.actions['plan-slot'] = function (d) { openSlotPicker(d.date, d.slot); };
  JS.actions['plan-day-copy'] = function (d) { copyDayForm(d.date); };
  JS.actions['plan-day-apply'] = function (d) { applyDays([d.date], P.dayName(d.date).toLowerCase() + ' (' + C.formatDayMonth(d.date) + ')'); };
  JS.actions['plan-goto-salvas'] = function () { if (JS.alimView) JS.alimView.mode = 'salvas'; JS.app.go('alimentacao'); };
  JS.actions['plan-open-shop'] = function () { view.mode = 'compras'; JS.app.render(); };

  JS.actions['plan-suggest'] = function () {
    var start = curStart(), t = today(), n = 0, snap = null, from = start <= t && t <= C.addDays(start, 6) ? t : null;
    JS.store.update(function (st) { snap = P.snapshot(st); n = P.suggest(st, start, { from: from }); });
    if (n) undoToast('Preenchi ' + n + (n === 1 ? ' refeição' : ' refeições') + ' com as suas refeições salvas.', snap);
    else ui.toast('Nada para sugerir: salve refeições dos tipos que estão vazios (ex.: almoço) na aba Salvas, ou a semana já está completa.');
  };

  JS.actions['plan-more'] = function () {
    var s = JS.store.state, start = curStart(), prev = C.addDays(start, -7), hasThis = P.weekHasPlan(s, start), hasPrev = P.weekHasPlan(s, prev);
    ui.actionSheet({
      title: 'Mais ações', subtitle: P.weekLabel(start),
      actions: [
        hasPrev ? { label: 'Repetir a semana passada', icon: 'repeat', run: function () { repeatLast(start, prev, hasThis); } } : null,
        hasThis ? { label: 'Colocar a semana no Diário', icon: 'plus', run: function () { applyDays(P.weekDays(start), 'esta semana'); } } : null,
        hasThis ? { label: 'Limpar a semana', icon: 'trash', danger: true, run: function () {
          var snap = null, n = 0;
          ui.confirm({ title: 'Limpar a semana?', message: 'Os planos desta semana saem (o Diário e as refeições salvas não mudam).', confirmLabel: 'Limpar', danger: true }).then(function (ok) {
            if (!ok) return;
            JS.store.update(function (st) { snap = P.snapshot(st); n = P.clearWeek(st, start); });
            undoToast('Semana limpa (' + n + (n === 1 ? ' refeição' : ' refeições') + ').', snap);
          });
        } } : null,
        !hasPrev && !hasThis ? { label: 'Sugerir refeições', icon: 'sparkle', run: function () { JS.actions['plan-suggest'](); } } : null
      ]
    });
  };

  function repeatLast(start, prev, hasThis) {
    var run = function (overwrite) {
      var snap = null, n = 0;
      JS.store.update(function (st) { snap = P.snapshot(st); n = P.repeatWeek(st, prev, start, overwrite); });
      if (n) undoToast('Repeti ' + n + (n === 1 ? ' refeição' : ' refeições') + ' da semana passada.', snap);
      else ui.toast('Nada mudou: esta semana já tinha os mesmos horários planejados.');
    };
    if (!hasThis) { run(false); return; }
    ui.choose({ title: 'Repetir a semana passada', message: 'Esta semana já tem refeições planejadas. O que fazer?',
      options: [{ label: 'Só preencher os vazios', value: 'fill', primary: true }, { label: 'Substituir tudo', value: 'all' }] }).then(function (v) { if (v) run(v === 'all'); });
  }

  JS.actions['plan-shop-day'] = function (d) {
    var all = P.weekDays(curStart()), cur = shopDays(curStart()), i = cur.indexOf(d.date);
    if (i >= 0) { if (cur.length === 1) { ui.toast('A lista precisa de pelo menos um dia.'); return; } cur.splice(i, 1); } else cur.push(d.date);
    view.days = all.filter(function (x) { return cur.indexOf(x) >= 0; });
    if (view.days.length === 7) view.days = null;
    JS.app.render();
  };
  JS.actions['plan-check'] = function (d) { var start = curStart(); JS.store.update(function (st) { P.toggleChecked(st, start, d.id); }); };
  JS.actions['plan-extra-toggle'] = function (d) { var start = curStart(); JS.store.update(function (st) { P.toggleExtra(st, start, d.id); }); };
  JS.actions['plan-extra-del'] = function (d) { var start = curStart(); JS.store.update(function (st) { P.removeExtra(st, start, d.id); }); };
  JS.actions['plan-clear-checked'] = function () {
    var start = curStart(), snap = null, n = 0;
    JS.store.update(function (st) { snap = P.snapshot(st); n = P.clearMarked(st, start); });
    if (n) undoToast('Marcações limpas (' + n + (n === 1 ? ' item' : ' itens') + ').', snap);
  };

  JS.actions['plan-share'] = function () {
    var s = JS.store.state, start = curStart(), text = P.listText(P.shoppingList(s, start, { days: shopDays(start) }));
    if (navigator.share) {
      navigator.share({ title: 'Lista de compras', text: text }).catch(function (e) { if (e && e.name !== 'AbortError') copyText(text); });
      return;
    }
    copyText(text);
  };
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { ui.toast('Lista copiada. É só colar numa conversa ou nota.'); }, function () { showText(text); });
    } else showText(text);
  }
  function showText(text) {
    ui.openSheet({ title: 'Lista de compras', body: ui.textarea({ label: 'Copie o texto abaixo', name: 'lista', value: text, rows: 12, attrs: 'readonly' }), onOpen: function (form) { var t = form.elements.lista; setTimeout(function () { t.focus(); t.select(); }, 200); } });
  }

  /* ---------------- Encaixes: Mais e busca ---------------- */

  JS.slots.add('mais.tiles', function (s, t) {
    var ex = P.read(s), n = 0;
    P.weekDays(P.mondayOf(t)).forEach(function (d) { n += Object.keys(ex.plans[d] || {}).length; });
    return JS.maisTile('planejador', 'calendar', 'm-meal', 'Cardápio da semana',
      n ? n + (n === 1 ? ' refeição planejada' : ' refeições planejadas') + ' esta semana' : 'Planeje a semana e gere a lista de compras');
  }, 40);

  if (JS.search && JS.search.shortcuts) {
    JS.search.shortcuts.push(['Cardápio da semana', 'cardapio semana semanal planejar planejamento refeicoes montar', 'calendar', { route: 'planejador' }]);
    JS.search.shortcuts.push(['Lista de compras', 'lista compras mercado supermercado comprar feira', 'cart', { route: 'planejador', action: 'plan-open-shop' }]);
  }

  JS.planejadorView = view;
  JS.telas.planejador = { title: 'Cardápio da semana', render: render, after: after, enter: enter };
})();
