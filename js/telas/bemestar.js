/*
 * J.S. — Bem-estar: registro de sono (cartão em Corpo), rotina de skincare (cartão no Cronograma capilar)
 * e um cartão compacto no Início. Regras e dados: js/regras-bemestar.js (state.extras.sono / extras.skincare).
 */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, Bm = window.JSBemestar, ui = JS.ui, esc = ui.esc;
  if (!Bm) return;

  ui.addIcons({
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'
  });

  var view = { period: null };
  var PER_LOW = { manha: 'manhã', noite: 'noite' };
  var LETTERS = C.WEEKDAY_LETTERS;

  function today() { return C.toDateKey(new Date()); }
  function num1(n) { return JS.graf.fmtNum(n, 1); }
  // 7,5 -> "7 h 30 min" ; 8 -> "8 h"
  function dur(h) { var m = Math.round(Number(h) * 60), H = Math.floor(m / 60), M = m % 60; return H + ' h' + (M ? ' ' + M + ' min' : ''); }
  function durBig(h) {
    var m = Math.round(Number(h) * 60), H = Math.floor(m / 60), M = m % 60;
    return H + ' <small>h</small>' + (M ? ' ' + M + ' <small>min</small>' : '');
  }
  function comma(n) { return String(n).replace('.', ','); }
  function qualityOf(q) { return Bm.QUALITY.filter(function (x) { return x[0] === Number(q); })[0] || null; }
  function dayWord(date, t) {
    var d = C.diffDays(date, t);
    return d === 0 ? 'hoje' : d === 1 ? 'ontem' : C.formatDayLabel(date, t).toLowerCase();
  }

  /* ======================= Sono ======================= */

  function sleepCard(s, now) {
    var t = C.toDateKey(now), st = Bm.sleepStats(s, t, 7), last = Bm.latestSleep(s, t);
    var html = '<section class="card sleep-card" id="cartao-sono"><div class="card-head"><h2>' + ui.icon('moon', 18) + 'Sono</h2>' +
      '<button type="button" class="link small-link" data-action="sono-meta" aria-label="Mudar a meta de sono: ' + comma(st.goal) + ' horas">Meta: ' + comma(st.goal) + ' h</button></div>';
    if (!last) {
      html += '<p class="muted">Registre quanto você dormiu para ver a média da semana, a meta e como o sono se relaciona com a sua energia.</p>';
    } else {
      var q = qualityOf(last.quality), pct = Math.min(100, Math.round(Number(last.hours) / st.goal * 100)), diff = Number(last.hours) - st.goal;
      html += '<div class="sl-hero"><div><span class="stat-label">' + (last.date === t ? 'Noite passada' : 'Último registro • ' + esc(dayWord(last.date, t))) + '</span>' +
        '<p class="hero-num">' + durBig(last.hours) + '</p></div>' +
        (q ? '<div class="sl-qb" title="Qualidade: ' + esc(q[2]) + '"><span aria-hidden="true">' + q[1] + '</span><small>' + esc(q[2]) + '</small></div>' : '') + '</div>' +
        '<div class="progress sl-prog" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Sono em relação à meta"><span style="width:' + pct + '%"></span></div>' +
        '<p class="muted small">' + (diff >= -1e-9 ? 'Meta de ' + dur(st.goal) + ' batida 💜' : 'Faltaram ' + dur(-diff) + ' para a meta de ' + dur(st.goal)) + '</p>';
    }
    // 7 dias em barras
    var maxH = Math.max(st.goal * 1.25, 10);
    st.days.forEach(function (d) { if (d.hours != null && d.hours > maxH) maxH = d.hours; });
    html += '<div class="sl-week" style="--gp:' + (st.goal / maxH * 100).toFixed(1) + '%" aria-label="Sono nos últimos 7 dias">' + st.days.map(function (d) {
      var cls = d.hours == null ? 'none' : d.met ? 'met' : 'low', h = d.hours == null ? 0 : Math.max(4, d.hours / maxH * 100);
      return '<button type="button" class="sl-day ' + cls + (d.date === t ? ' today' : '') + '" data-action="sono-registrar" data-date="' + d.date + '" aria-label="' +
        esc(C.formatDateLong(d.date) + ': ' + (d.hours == null ? 'sem registro' : dur(d.hours)) + '. Toque para ' + (d.hours == null ? 'registrar' : 'editar')) + '">' +
        '<span class="sl-val">' + (d.hours == null ? '' : num1(d.hours)) + '</span><span class="sl-bar"><i style="height:' + h.toFixed(1) + '%"></i></span><em>' + LETTERS[C.weekday(d.date)] + '</em></button>';
    }).join('') + '</div>';
    if (st.count) {
      html += '<p class="muted small">Média dos últimos 7 dias: <strong>' + esc(dur(st.avg)) + '</strong> (' + st.count + (st.count === 1 ? ' noite' : ' noites') + ' registrada' + (st.count === 1 ? '' : 's') + ')' +
        (st.avgQuality ? ' • qualidade média ' + num1(st.avgQuality) + ' de 5' : '') + '.</p>';
      if (st.count >= 2 && st.debt > 0.4) html += '<p class="sl-debt">Faltaram ' + esc(dur(st.debt)) + ' para a meta nesta semana. Sem pressa: uma noite boa já ajuda 💜</p>';
      else if (st.count >= 3 && st.balance <= 0) html += '<p class="sl-debt ok">Você está em dia com o sono esta semana 🌙</p>';
    }
    var ins = Bm.sleepVsEnergy(s, t);
    if (ins) {
      html += '<p class="sl-insight">💡 Nas noites em que bateu a meta (' + esc(dur(ins.threshold)) + '), sua energia média foi <strong>' + num1(ins.comMeta.mediaEnergia) + '</strong> contra <strong>' +
        num1(ins.abaixo.mediaEnergia) + '</strong> nas outras (' + ins.comMeta.n + ' e ' + ins.abaixo.n + ' dias).</p>' +
        '<p class="hint">Referência geral: são os seus registros e uma relação não prova causa e efeito.</p>';
    } else if (st.count >= 3) {
      html += '<p class="hint">Registre também a sua energia (em Ciclo ou Treino) por mais alguns dias e o J.S. mostra se noites mais longas combinam com dias de mais disposição.</p>';
    }
    var rec = Bm.sleepVsRecords(s);
    if (rec) {
      html += '<p class="hint">Dias de treino com recorde: ' + rec.comMeta.comRecorde + ' de ' + rec.comMeta.dias + ' após noites na meta e ' + rec.abaixo.comRecorde + ' de ' + rec.abaixo.dias + ' após noites abaixo dela.</p>';
    }
    html += '<div class="btn-row tight"><button type="button" class="btn small primary" data-action="sono-registrar" data-date="' + t + '">' + ui.icon('plus', 16) + (Bm.sleepOn(s, t) ? 'Editar o de hoje' : 'Registrar sono') + '</button>' +
      '<button type="button" class="btn small soft" data-action="sono-registrar" data-date="' + C.addDays(t, -1) + '">Ontem</button></div></section>';
    return html;
  }

  // Folha de registro (também edita): horas direto ou "dormi às / acordei às".
  function openSleepSheet(date) {
    var s = JS.store.state, t = today();
    var cur = { date: C.isDateKey(date) && date <= t ? date : t, mode: 'horas' };
    var qs = Bm.QUALITY.map(function (q) {
      return '<button type="button" class="sl-q" data-q="' + q[0] + '" aria-pressed="false" aria-label="' + q[0] + ' de 5: ' + esc(q[2]) + '"><span aria-hidden="true">' + q[1] + '</span><small>' + esc(q[2]) + '</small></button>';
    }).join('');
    var body = ui.input({ label: 'Dia em que você acordou', name: 'date', type: 'date', value: cur.date, attrs: 'max="' + t + '"' }) +
      '<div class="field"><span class="label">Como quer informar?</span><div class="quick-chips sl-mode" role="group" aria-label="Como informar o sono">' +
      '<button type="button" class="chip" data-mode="horas" aria-pressed="true">Em horas</button><button type="button" class="chip" data-mode="horarios" aria-pressed="false">Dormi às / acordei às</button></div></div>' +
      '<div data-pane="horas"><div class="field" data-field="hours"><label for="sl-hours">Quantas horas você dormiu?</label>' +
      '<div class="sl-stepper"><button type="button" class="icon-btn" data-step="-0.5" aria-label="Menos meia hora">−</button>' +
      '<input id="sl-hours" name="hours" type="text" inputmode="decimal" autocomplete="off" aria-label="Horas dormidas"><span aria-hidden="true">h</span>' +
      '<button type="button" class="icon-btn" data-step="0.5" aria-label="Mais meia hora">+</button></div><p class="err" role="alert"></p></div></div>' +
      '<div data-pane="horarios" hidden><div class="row2">' + ui.input({ label: 'Dormi às', name: 'bed', type: 'time', value: '23:00' }) + ui.input({ label: 'Acordei às', name: 'wake', type: 'time', value: '07:00' }) + '</div>' +
      '<p class="hint" data-calc aria-live="polite"></p></div>' +
      '<div class="field" data-field="quality"><span class="label">Como foi a noite? <small>(opcional)</small></span><div class="sl-qs">' + qs + '</div><input type="hidden" name="quality" value=""><p class="err" role="alert"></p></div>' +
      '<button type="button" class="btn ghost danger-text full" data-del hidden>' + ui.icon('trash', 18) + 'Excluir este registro</button>';
    ui.openSheet({
      title: 'Registrar sono', subtitle: 'Referência geral para adultos: 7 a 9 horas', body: body, submitLabel: 'Salvar',
      onOpen: function (form) {
        var hoursIn = form.elements.hours, qIn = form.elements.quality;
        function setMode(m) {
          cur.mode = m;
          form.querySelector('[data-pane="horas"]').hidden = m !== 'horas';
          form.querySelector('[data-pane="horarios"]').hidden = m !== 'horarios';
          form.querySelectorAll('[data-mode]').forEach(function (b) { var on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
          calc();
        }
        function setQuality(q) {
          qIn.value = q ? String(q) : '';
          form.querySelectorAll('[data-q]').forEach(function (b) { var on = Number(b.dataset.q) === Number(q); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
        }
        function calc() {
          var el = form.querySelector('[data-calc]'), r = Bm.validateSleep({ date: form.elements.date.value, bed: form.elements.bed.value, wake: form.elements.wake.value });
          el.textContent = r.value.hours != null && !r.errors.bed && !r.errors.wake ? '≈ ' + dur(r.value.hours) + ' de sono' : '';
        }
        function fill() {
          var ex = Bm.sleepOn(JS.store.state, form.elements.date.value);
          hoursIn.value = ex ? comma(ex.hours) : '7,5';
          form.elements.bed.value = ex && ex.bed ? ex.bed : '23:00';
          form.elements.wake.value = ex && ex.wake ? ex.wake : '07:00';
          setQuality(ex ? ex.quality : null);
          setMode(ex && ex.bed && ex.wake ? 'horarios' : 'horas');
          var del = form.querySelector('[data-del]');
          del.hidden = !ex; del.dataset.id = ex ? ex.id : '';
          form.querySelector('.sheet-sub') && (form.querySelector('.sheet-sub').textContent = ex ? 'Já existe um registro neste dia: salvar substitui' : 'Referência geral para adultos: 7 a 9 horas');
        }
        form.elements.date.addEventListener('change', function () { if (C.isDateKey(form.elements.date.value)) fill(); });
        form.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
        form.querySelectorAll('[data-q]').forEach(function (b) { b.addEventListener('click', function () { setQuality(qIn.value === b.dataset.q ? null : Number(b.dataset.q)); }); });
        form.querySelectorAll('[data-step]').forEach(function (b) {
          b.addEventListener('click', function () {
            var n = Number(String(hoursIn.value).replace(',', '.'));
            if (isNaN(n)) n = 7.5;
            n = Math.min(16, Math.max(0, Math.round((n + Number(b.dataset.step)) * 2) / 2));
            hoursIn.value = comma(n);
          });
        });
        ['bed', 'wake'].forEach(function (n) { form.elements[n].addEventListener('input', calc); });
        form.querySelector('[data-del]').addEventListener('click', function (e) {
          var id = e.currentTarget.dataset.id, removed = null;
          if (!id) return;
          JS.store.update(function (st) { removed = Bm.deleteSleep(st, id); });
          ui.closeSheet();
          if (removed) ui.toast('Registro de sono excluído.', { actionLabel: 'Desfazer', onAction: function () { JS.store.update(function (st) { Bm.putSleep(st, removed); }); } });
        });
        fill();
      },
      onSubmit: function (v) {
        var input = { date: v.date, today: t, quality: v.quality, hours: cur.mode === 'horas' ? v.hours : null, bed: cur.mode === 'horarios' ? v.bed : null, wake: cur.mode === 'horarios' ? v.wake : null };
        var r = Bm.validateSleep(input);
        if (!r.ok) return { errors: r.errors };
        var res = null;
        JS.store.update(function (st, n) { res = Bm.saveSleep(st, input, n); });
        if (!res || !res.ok) return { errors: res ? res.errors : { hours: 'Não foi possível salvar.' } };
        ui.toast('Sono de ' + dayWord(res.log.date, t) + ' salvo: ' + dur(res.log.hours) + '.', {
          actionLabel: 'Desfazer', timeout: 5000,
          onAction: function () { JS.store.update(function (st) { Bm.restoreSleep(st, res.log.id, res.previous); }); }
        });
      }
    });
  }

  function openGoalSheet() {
    var goal = Bm.goalHours(JS.store.state);
    ui.openSheet({
      title: 'Meta de sono',
      body: ui.input({ label: 'Horas por noite', name: 'goal', type: 'number', value: goal, attrs: 'inputmode="decimal" min="' + Bm.MIN_GOAL + '" max="' + Bm.MAX_GOAL + '" step="0.5"',
        hint: 'De ' + Bm.MIN_GOAL + ' a ' + Bm.MAX_GOAL + ' horas. Referência geral para adultos: 7 a 9 horas; se um profissional de saúde indicou outra meta, use a dele.' }),
      submitLabel: 'Salvar',
      onSubmit: function (v) {
        var n = Number(String(v.goal).replace(',', '.'));
        if (isNaN(n) || n < Bm.MIN_GOAL || n > Bm.MAX_GOAL) return { errors: { goal: 'Entre ' + Bm.MIN_GOAL + ' e ' + Bm.MAX_GOAL + ' horas.' } };
        JS.store.update(function (st) { Bm.setSleepGoal(st, n); });
        ui.toast('Meta de sono: ' + dur(Bm.goalHours(JS.store.state)) + ' por noite.');
      }
    });
  }

  /* ======================= Skincare ======================= */

  function defaultPeriod(cfg, t, s) {
    var want = new Date().getHours() < 15 ? 'manha' : 'noite', other = want === 'manha' ? 'noite' : 'manha';
    if (!cfg.steps[want].length) return other;
    // depois das 15h, se a noite não tem passos ou a manhã ainda está aberta e a noite vazia, segue a que existe
    void t; void s;
    return want;
  }
  function currentPeriod(s, t) {
    var cfg = Bm.skincareConfig(s);
    if (view.period && cfg.steps[view.period] && cfg.steps[view.period].length) return view.period;
    return defaultPeriod(cfg, t, s);
  }

  function ringSvg(done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<span class="sk-ring" role="img" aria-label="' + done + ' de ' + total + ' passos feitos"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="sk-ring-bg" cx="18" cy="18" r="15.9155"/>' +
      '<circle class="sk-ring-fg" cx="18" cy="18" r="15.9155" stroke-dasharray="' + pct + ' 100"/></svg><strong>' + done + '/' + total + '</strong></span>';
  }

  function skincareCard(s, now) {
    var t = C.toDateKey(now), cfg = Bm.skincareConfig(s), head = '<div class="card-head"><h2>' + ui.icon('sparkle', 18) + 'Skincare</h2>';
    if (!Bm.skincareActive(s)) {
      return '<section class="card skin-card skin-invite" id="cartao-skincare">' + head + '</div>' +
        '<p>Monte a sua rotina de manhã e à noite, marque cada passo e acompanhe a sequência de dias. Sem cobrança: é só um jeitinho de cuidar de você 🌿</p>' +
        '<div class="btn-col"><button type="button" class="btn primary" data-action="sk-start">' + ui.icon('sparkle', 18) + 'Começar com os passos sugeridos</button>' +
        '<button type="button" class="btn soft" data-action="sk-edit">Montar do zero</button></div></section>';
    }
    var per = currentPeriod(s, t), day = Bm.skincareDay(s, t), cur = day[per], streak = Bm.skincareStreak(s, t), week = Bm.skincareWeek(s, t);
    var html = '<section class="card skin-card" id="cartao-skincare">' + head +
      '<div class="sk-head-right">' + (streak ? '<span class="sk-streak" title="Dias seguidos com a rotina completa">🌿 ' + streak + (streak === 1 ? ' dia' : ' dias') + '</span>' : '') +
      '<button type="button" class="link small-link" data-action="sk-edit">Editar</button></div></div>';
    // abas manhã / noite
    html += '<div class="sk-tabs" role="tablist" aria-label="Período da rotina">' + Bm.PERIODS.filter(function (p) { return cfg.steps[p].length; }).map(function (p) {
      var d = day[p], full = d.total > 0 && d.done === d.total;
      return '<button type="button" role="tab" class="sk-tab' + (p === per ? ' on' : '') + (full ? ' full' : '') + '" aria-selected="' + (p === per) + '" data-action="sk-tab" data-p="' + p + '">' +
        ui.icon(p === 'manha' ? 'sun' : 'moon', 16) + Bm.PERIOD_NAME[p] + '<small>' + (full ? '✓' : d.done + '/' + d.total) + '</small></button>';
    }).join('') + '</div>';
    html += '<div class="sk-body">' + ringSvg(cur.done, cur.total) + '<div class="sk-steps" role="group" aria-label="Passos da ' + PER_LOW[per] + '">' + cfg.steps[per].map(function (st) {
      var on = cur.ids.indexOf(st.id) >= 0;
      return '<button type="button" class="sk-step' + (on ? ' on' : '') + '" data-action="sk-step" data-p="' + per + '" data-id="' + esc(st.id) + '" aria-pressed="' + on + '">' +
        '<span class="sk-check" aria-hidden="true">' + ui.icon('check', 14) + '</span><span class="sk-name">' + esc(st.name) + '</span></button>';
    }).join('') + '</div></div>';
    if (cur.total && cur.done === cur.total) html += '<p class="sk-done">Rotina da ' + PER_LOW[per] + ' completa. Sua pele agradece 🌿</p>';
    // mini-semana
    html += '<div class="sk-week" aria-label="Rotina nos últimos 7 dias">' + week.map(function (d) {
      var cls = d.complete ? 'full' : d.partial ? 'part' : 'none';
      return '<span class="sk-dot ' + cls + (d.isToday ? ' today' : '') + '" title="' + esc(C.formatDateLong(d.date)) + '"><i></i><em>' + LETTERS[C.weekday(d.date)] + '</em></span>';
    }).join('') + '</div>';
    var rem = Bm.PERIODS.filter(function (p) { return cfg.reminders[p] && cfg.steps[p].length; }).map(function (p) { return PER_LOW[p] + ' ' + cfg.reminders[p]; });
    html += '<p class="muted small sk-foot">' + (rem.length ? ui.icon('bell', 14) + ' Lembretes: ' + esc(rem.join(' • ')) : 'Sem lembretes. Dá para escolher horários em "Editar".') + '</p></section>';
    return html;
  }

  function openSkincareEditor(draft) {
    var s = JS.store.state;
    if (!draft) {
      var cfg = Bm.skincareConfig(s);
      draft = { steps: JSON.parse(JSON.stringify(cfg.steps)), reminders: { manha: cfg.reminders.manha, noite: cfg.reminders.noite } };
    }
    function section(per) {
      var rows = draft.steps[per].map(function (st, i) {
        return '<div class="sk-edit-row"><input name="n_' + per + '_' + i + '" type="text" maxlength="' + Bm.NAME_MAX + '" value="' + esc(st.name) + '" aria-label="Nome do passo ' + (i + 1) + ' da ' + PER_LOW[per] + '" autocomplete="off">' +
          '<button type="button" class="icon-btn sm" data-move="' + per + '|' + i + '|-1" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>' + ui.icon('upchev', 16) + '</button>' +
          '<button type="button" class="icon-btn sm" data-move="' + per + '|' + i + '|1" aria-label="Descer"' + (i === draft.steps[per].length - 1 ? ' disabled' : '') + '>' + ui.icon('downchev', 16) + '</button>' +
          '<button type="button" class="icon-btn sm danger" data-rm="' + per + '|' + i + '" aria-label="Remover o passo ' + esc(st.name) + '">' + ui.icon('x', 16) + '</button></div>';
      }).join('');
      return '<div class="sk-edit-block"><p class="stat-label">' + ui.icon(per === 'manha' ? 'sun' : 'moon', 14) + ' ' + Bm.PERIOD_NAME[per] + '</p>' +
        '<div class="sk-edit-list">' + (rows || '<p class="muted small">Nenhum passo na ' + PER_LOW[per] + '.</p>') + '</div>' +
        '<div class="sk-add"><input name="add_' + per + '" type="text" maxlength="' + Bm.NAME_MAX + '" placeholder="Novo passo (ex.: Sérum de vitamina C)" aria-label="Novo passo da ' + PER_LOW[per] + '" autocomplete="off">' +
        '<button type="button" class="btn small soft" data-add="' + per + '">' + ui.icon('plus', 16) + 'Adicionar</button></div>' +
        ui.input({ label: 'Lembrete da ' + PER_LOW[per], name: 'rem_' + per, type: 'time', value: draft.reminders[per] || '', hint: 'Deixe em branco para não receber lembrete.' }) + '</div>';
    }
    var body = '<div class="field" data-field="steps"><p class="err" role="alert"></p></div>' + section('manha') + section('noite') +
      '<button type="button" class="btn ghost full" data-reset>' + ui.icon('repeat', 18) + 'Restaurar os passos sugeridos</button>';
    function sync(form) {
      Bm.PERIODS.forEach(function (per) {
        draft.steps[per].forEach(function (st, i) { var el = form.elements['n_' + per + '_' + i]; if (el) st.name = el.value; });
        var r = form.elements['rem_' + per]; if (r) draft.reminders[per] = r.value || null;
      });
    }
    ui.openSheet({
      title: 'Passos e lembretes', subtitle: 'Skincare', body: body, submitLabel: 'Salvar',
      onOpen: function (form) {
        form.querySelectorAll('[data-move]').forEach(function (b) {
          b.addEventListener('click', function () {
            sync(form);
            var p = b.dataset.move.split('|'), l = draft.steps[p[0]], i = Number(p[1]), j = i + Number(p[2]);
            if (j >= 0 && j < l.length) { var tmp = l[i]; l[i] = l[j]; l[j] = tmp; }
            openSkincareEditor(draft);
          });
        });
        form.querySelectorAll('[data-rm]').forEach(function (b) {
          b.addEventListener('click', function () { sync(form); var p = b.dataset.rm.split('|'); draft.steps[p[0]].splice(Number(p[1]), 1); openSkincareEditor(draft); });
        });
        form.querySelectorAll('[data-add]').forEach(function (b) {
          b.addEventListener('click', function () {
            sync(form);
            var per = b.dataset.add, el = form.elements['add_' + per], name = el.value.trim();
            if (!name) { el.focus(); return; }
            if (draft.steps[per].length >= Bm.MAX_STEPS) { ui.toast('Use até ' + Bm.MAX_STEPS + ' passos em cada período.', { error: true }); return; }
            draft.steps[per].push({ id: null, name: name.slice(0, Bm.NAME_MAX) });
            openSkincareEditor(draft);
          });
        });
        form.querySelectorAll('input[name^="add_"]').forEach(function (inp) {
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); form.querySelector('[data-add="' + inp.name.slice(4) + '"]').click(); } });
        });
        form.querySelector('[data-reset]').addEventListener('click', function () {
          ui.confirm({ title: 'Restaurar os passos sugeridos?', message: 'Os passos de manhã e de noite voltam ao padrão. Os seus lembretes e o histórico continuam.', confirmLabel: 'Restaurar' }).then(function (ok) {
            if (!ok) return;
            sync(form);
            var d = Bm.defaultSteps();
            draft.steps = d;
            openSkincareEditor(draft);
          });
        });
      },
      onSubmit: function (v, form) {
        sync(form);
        // o que foi digitado em "novo passo" mas não adicionado também entra (evita perder o texto)
        Bm.PERIODS.forEach(function (per) {
          var el = form.elements['add_' + per], name = el && el.value.trim();
          if (name && draft.steps[per].length < Bm.MAX_STEPS) draft.steps[per].push({ id: null, name: name.slice(0, Bm.NAME_MAX) });
        });
        var r = Bm.validateSkincareConfig(draft);
        if (!r.ok) return { errors: r.errors };
        JS.store.update(function (st) { Bm.setSkincareConfig(st, draft); });
        view.period = null;
        ui.toast('Rotina de skincare atualizada.');
        return { remind: !!(r.value.reminders.manha || r.value.reminders.noite) };
      },
      afterClose: function (res) { if (res && res.remind && JS.notify) JS.notify.askIfNeeded(); }
    });
  }

  /* ======================= Início: cartão compacto ======================= */

  function inicioCard(s, now) {
    var t = C.toDateKey(now), act = Bm.wellbeingActive(s, t);
    if (!act.any) return '';
    var cur = Bm.sleepOn(s, t), q = cur ? qualityOf(cur.quality) : null;
    var html = '<section class="card wb-card"><div class="card-head"><h2>' + ui.icon('sparkle', 18) + 'Bem-estar</h2></div><div class="wb-rows">' +
      '<div class="wb-row"><span class="wb-ic">' + ui.icon('moon', 18) + '</span><span class="wb-txt"><strong>' + (cur ? 'Sono: ' + esc(dur(cur.hours)) + (q ? ' ' + q[1] : '') : 'Sono de hoje') + '</strong>' +
      '<small>' + (cur ? 'Registrado hoje' : 'Ainda não registrado') + '</small></span>' +
      '<button type="button" class="btn small ' + (cur ? 'soft' : 'primary') + '" data-action="sono-registrar" data-date="' + t + '">' + (cur ? 'Editar' : 'Registrar sono') + '</button></div>';
    if (act.skincare) {
      var day = Bm.skincareDay(s, t), cfg = Bm.skincareConfig(s);
      html += '<div class="wb-row"><span class="wb-ic">' + ui.icon('sparkle', 18) + '</span><span class="wb-txt"><strong>Skincare de hoje</strong><small>Toque para marcar o período todo</small></span><span class="wb-chips">' +
        Bm.PERIODS.filter(function (p) { return cfg.steps[p].length; }).map(function (p) {
          var d = day[p], full = d.done === d.total, cls = full ? 'done' : d.done ? 'part' : 'open';
          return '<button type="button" class="wb-chip ' + cls + '" data-action="sk-mark" data-p="' + p + '" aria-label="Skincare da ' + PER_LOW[p] + ': ' + (full ? 'feito. Toque para ver os passos' : d.done + ' de ' + d.total + ' passos. Toque para marcar todos') + '">' +
            ui.icon(p === 'manha' ? 'sun' : 'moon', 14) + Bm.PERIOD_NAME[p] + '<small>' + (full ? '✓' : d.done + '/' + d.total) + '</small></button>';
        }).join('') + '</span></div>';
    }
    return html + '</div></section>';
  }

  /* ======================= Ações ======================= */

  JS.actions['sono-registrar'] = function (d) { openSleepSheet(d && d.date); };
  JS.actions['sono-meta'] = function () { openGoalSheet(); };
  JS.actions['sk-start'] = function () {
    JS.store.update(function (st) { Bm.startSkincare(st); });
    view.period = null;
    ui.toast('Pronto! Marque cada passo conforme for fazendo 🌿', { actionLabel: 'Editar passos', onAction: function () { openSkincareEditor(); }, timeout: 5000 });
  };
  JS.actions['sk-edit'] = function () { openSkincareEditor(); };
  JS.actions['sk-tab'] = function (d) { view.period = d.p; JS.app.render(); };
  JS.actions['sk-step'] = function (d) {
    var t = today(), res = null, before = Bm.skincareDay(JS.store.state, t)[d.p];
    JS.anim.mark('.sk-step[data-id="' + d.id + '"]', 'just', { ms: 700 });
    JS.store.update(function (st, n) { res = Bm.toggleStep(st, t, d.p, d.id, n); });
    if (!res) return;
    var after = Bm.skincareDay(JS.store.state, t)[d.p];
    if (res.done && after.total && after.done === after.total && before.done < before.total) {
      ui.toast('Rotina da ' + PER_LOW[d.p] + ' completa 🌿');
      setTimeout(function () { var el = document.querySelector('.sk-ring'); if (el && JS.anim.sparks) JS.anim.sparks(el); }, 80);
    }
  };
  // Atalho do Início: marca o período inteiro (com desfazer); se já está completo, abre a rotina.
  JS.actions['sk-mark'] = function (d) {
    var t = today(), prev = null;
    view.period = d.p;
    if (Bm.periodComplete(JS.store.state, t, d.p)) { JS.app.go('autocuidado'); return; }
    JS.store.update(function (st, n) { prev = Bm.markPeriod(st, t, d.p, n); });
    ui.toast('Skincare da ' + PER_LOW[d.p] + ' feito 🌿', {
      actionLabel: 'Desfazer', timeout: 5000,
      onAction: function () { JS.store.update(function (st) { Bm.setPeriodDone(st, t, d.p, prev); }); }
    });
  };

  /* ======================= Encaixes ======================= */

  JS.slots.add('corpo.secoes', sleepCard, 30);
  JS.slots.add('autocuidado.topo', skincareCard, 30);
  JS.slots.add('inicio.meio', inicioCard, 60);

  if (JS.search && JS.search.shortcuts) {
    JS.search.shortcuts.push(['Registrar sono', 'sono dormi dormir noite horas acordei descanso insonia', 'moon', { route: 'corpo', action: 'sono-registrar', scroll: '#cartao-sono' }]);
    JS.search.shortcuts.push(['Sono: média da semana e meta', 'sono media semana meta horas dormir', 'moon', { route: 'corpo', scroll: '#cartao-sono' }]);
    JS.search.shortcuts.push(['Skincare: rotina de manhã e à noite', 'skincare pele rosto rotina manha noite hidratante protetor limpeza cuidado', 'sparkle', { route: 'autocuidado', scroll: '#cartao-skincare' }]);
    JS.search.shortcuts.push(['Passos e lembretes do skincare', 'skincare passos lembrete horario editar rotina', 'bell', { route: 'autocuidado', action: 'sk-edit' }]);
  }

  JS.bemestar = { openSleepSheet: openSleepSheet, openSkincareEditor: openSkincareEditor };
})();
