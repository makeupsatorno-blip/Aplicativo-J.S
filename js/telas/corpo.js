/* J.S. — Corpo: bioimpedância, massa muscular, IMC, medidas e evolução */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, B = window.JSCorpo, ui = JS.ui, esc = ui.esc;
  var view = { metric: 'weightKg' };
  var SHOW = ['weightKg', 'fatPct', 'muscleKg', 'waterPct', 'visceral', 'bmrKcal', 'leanKg', 'boneKg', 'proteinPct', 'metabolicAge'];

  function n(v, f) { return JS.graf.fmtNum(v, f.step < 1 ? 1 : 0); }
  function deltaTag(f, d) {
    if (!d || d.delta == null) return '';
    if (d.delta === 0) return '<span class="delta">= igual</span>';
    var up = d.delta > 0, cls = d.tone === 'good' ? 'good' : d.tone === 'bad' ? 'bad' : '';
    return '<span class="delta ' + cls + '">' + ui.icon(up ? 'up' : 'down', 12) + (up ? '+' : '') + n(d.delta, f) + ' ' + esc(f.unit) + '</span>';
  }

  function render(now) {
    var s = JS.store.state, today = C.toDateKey(now), body = s.settings.body || {};
    var html = '<h1 class="page-title">Corpo</h1><p class="page-sub">Bioimpedância, massa muscular e medidas.</p>';
    if (!s.bodyRecords.length) {
      return html + ui.empty('body', 'Registre os dados da sua balança de bioimpedância (peso, % de gordura, massa muscular...) e acompanhe a evolução.', { label: 'Registrar medição', attrs: 'data-action="body-new"' }) + profileCard(body);
    }
    var L = B.latest(s);
    var lastDate = Object.keys(L).reduce(function (m, k) { return L[k].date > m ? L[k].date : m; }, '');
    var tiles = SHOW.filter(function (k) { return L[k]; }).map(function (k) {
      var f = B.field(k), d = L[k];
      return '<div class="stat"><span class="stat-label">' + esc(f.label) + '</span><strong>' + n(d.value, f) + ' <small>' + esc(f.unit) + '</small></strong>' + deltaTag(f, d) + '</div>';
    }).join('');
    html += '<section class="card full"><div class="card-head"><h2>' + ui.icon('body', 18) + 'Última medição</h2><span class="muted small">' + esc(C.formatDayLabel(lastDate, today)) + ' • ' + esc(C.formatDateBR(lastDate)) + '</span></div>' +
      '<div class="tiles">' + tiles + '</div><p class="hint">Setas comparam com a medição anterior. Verde = no sentido que costuma ser desejado.</p></section>';

    // Indicação de massa muscular
    var mi = B.muscleIndicator(s, today);
    if (mi) {
      var st = { gaining: ['Ganhando massa muscular', 'good', 'up'], losing: ['Perdendo massa muscular', 'bad', 'down'], stable: ['Massa muscular estável', '', 'arrow'], first: ['Primeira medição de massa muscular', '', 'info'] }[mi.status];
      html += '<section class="card"><div class="card-head"><h2>' + ui.icon('dumbbell', 18) + 'Massa muscular</h2></div>' +
        '<p class="hero-num">' + JS.graf.fmtNum(mi.kg, 1) + ' <small>kg</small></p>' +
        '<p class="status-line ' + st[1] + '">' + ui.icon(st[2], 16) + esc(st[0]) + (mi.change != null ? ' (' + (mi.change > 0 ? '+' : '') + JS.graf.fmtNum(mi.change, 1) + ' kg em ' + mi.days + ' dias)' : '') + '</p>' +
        '<div class="mini-stats">' + (mi.pctOfWeight != null ? '<div><strong>' + JS.graf.fmtNum(mi.pctOfWeight, 1) + '%</strong><span>do peso corporal</span></div>' : '') +
        (mi.perHeight != null ? '<div><strong>' + JS.graf.fmtNum(mi.perHeight, 1) + ' kg/m²</strong><span>massa muscular por altura</span></div>' : '<div><strong>—</strong><span>informe a altura abaixo para ver o índice</span></div>') + '</div></section>';
    }

    // IMC e % de gordura
    var w = L.weightKg && L.weightKg.value, imc = B.bmi(w, body.heightCm), ic = B.bmiClass(imc);
    var fat = L.fatPct && L.fatPct.value, fc = B.fatClass(fat, body.sex);
    if (imc || fc) {
      html += '<section class="card"><div class="card-head"><h2>' + ui.icon('info', 18) + 'Referências</h2></div>';
      if (imc) html += '<div class="ref-row"><span>IMC</span><strong>' + JS.graf.fmtNum(imc, 1) + '</strong><span class="tag ' + (ic.tone === 'good' ? 'success' : ic.tone === 'bad' ? 'danger' : 'high') + '">' + esc(ic.label) + '</span></div>';
      if (fc) html += '<div class="ref-row"><span>Gordura</span><strong>' + JS.graf.fmtNum(fat, 1) + '%</strong><span class="tag soft">' + esc(fc.label) + '</span></div>' + fatScale(fat, fc);
      html += '<p class="hint">IMC pela OMS; faixas de gordura gerais (ACE) para ' + (body.sex === 'm' ? 'homens' : 'mulheres') + '. São referências amplas — a avaliação de uma profissional é o que vale.</p></section>';
    }

    // Gráfico
    var avail = B.ALL.filter(function (f) { return B.series(s, f.key).length; });
    if (!avail.some(function (f) { return f.key === view.metric; })) view.metric = avail[0].key;
    var fm = B.field(view.metric), ser = B.series(s, view.metric);
    html += '<section class="card full"><div class="card-head"><h2>' + ui.icon('chart', 18) + 'Evolução</h2></div>' +
      ui.select({ label: 'Mostrar', name: 'metric', options: avail.map(function (f) { return [f.key, f.label + ' (' + f.unit + ')']; }), value: view.metric, attrs: 'data-change="body-metric"' }) +
      JS.graf.chart({ type: 'line', title: fm.label + ' ao longo do tempo', unit: fm.unit, dec: fm.step < 1 ? 1 : 0, yLabel: fm.label, xLabel: 'Data',
        points: ser.map(function (p) { return { label: C.formatDayMonth(p.date), v: p.value, tip: C.formatDateBR(p.date) }; }) }) + '</section>';

    // Histórico
    html += ui.section('Medições', B.sorted(s).reverse().map(function (r) {
      var parts = ['weightKg', 'fatPct', 'muscleKg'].filter(function (k) { return r[k] != null; }).map(function (k) { var f = B.field(k); return n(r[k], f) + ' ' + f.unit + ' ' + f.label.split(' ')[0].toLowerCase(); });
      var extra = B.ALL.filter(function (f) { return r[f.key] != null; }).length - parts.length;
      return '<div class="item"><button type="button" class="item-main" data-action="body-menu" data-id="' + esc(r.id) + '"><span class="item-title">' + esc(C.formatDateBR(r.date)) + '</span>' +
        '<span class="item-meta">' + esc(parts.join(' • ') || 'Medidas') + (extra > 0 ? ' • +' + extra + ' valores' : '') + '</span></button></div>';
    }).join(''), '<span class="count">' + s.bodyRecords.length + '</span>');
    html += profileCard(body);
    return html;
  }

  // Régua das faixas de gordura com um marcador no valor atual.
  function fatScale(pct, fc) {
    var ref = fc.ref, lo = ref[0][0], hi = ref[ref.length - 1][0] + 10;
    var pos = Math.min(100, Math.max(0, (pct - lo) / (hi - lo) * 100));
    return '<div class="fat-scale" aria-hidden="true">' + ref.map(function (r, i) {
      var w = ((i === ref.length - 1 ? hi : ref[i + 1][0]) - r[0]) / (hi - lo) * 100;
      return '<span class="fs-' + i + (i === fc.index ? ' on' : '') + '" style="width:' + w.toFixed(1) + '%"><em>' + esc(r[2]) + '</em></span>';
    }).join('') + '<i style="left:' + pos.toFixed(1) + '%"></i></div>';
  }

  function profileCard(body) {
    return '<section class="card"><div class="card-head"><h2>' + ui.icon('settings', 18) + 'Seus dados</h2><button type="button" class="link small-link" data-action="body-profile">Editar</button></div>' +
      '<p class="muted small">Altura: <strong>' + (body.heightCm ? body.heightCm + ' cm' : '—') + '</strong> • Sexo: <strong>' + (body.sex === 'm' ? 'masculino' : 'feminino') + '</strong> • Nascimento: <strong>' + (body.birthYear || '—') + '</strong></p>' +
      '<p class="hint">Usados no IMC, nas faixas de referência e na estimativa de calorias da Alimentação.</p></section>';
  }

  function openRecordForm(rec) {
    var today = C.toDateKey(new Date());
    var v = rec || { date: today };
    function numIn(f) {
      return ui.input({ label: f.label + ' (' + f.unit + ')', name: f.key, type: 'text', value: v[f.key] == null ? '' : String(v[f.key]).replace('.', ','), attrs: 'inputmode="decimal" autocomplete="off" placeholder="—"' });
    }
    function pairs(list) {
      var out = '';
      for (var i = 0; i < list.length; i += 2) out += '<div class="row2">' + numIn(list[i]) + (list[i + 1] ? numIn(list[i + 1]) : '<div></div>') + '</div>';
      return out;
    }
    var body = ui.input({ label: 'Data da medição', name: 'date', type: 'date', value: v.date }) +
      '<p class="hint top">Preencha só o que a balança mostrar. Nada é obrigatório além de um valor.</p>' +
      '<h3 class="form-sub">Bioimpedância</h3>' + pairs(B.FIELDS) +
      '<details class="form-more"' + (rec && B.MEASURES.some(function (m) { return rec[m.key] != null; }) ? ' open' : '') + '><summary>Medidas com fita (cm)</summary>' + pairs(B.MEASURES) + '</details>' +
      ui.textarea({ label: 'Observações (opcional)', name: 'notes', value: v.notes || '', attrs: 'maxlength="300"' });
    ui.openSheet({
      title: rec ? 'Editar medição' : 'Nova medição', body: body, submitLabel: rec ? 'Salvar' : 'Registrar',
      onSubmit: function (input) {
        var r = B.validateRecord(input);
        if (!r.ok) return { errors: r.errors };
        var saved = null;
        JS.anim.mark(function () { return saved && '[data-action="body-menu"][data-id="' + saved.id + '"]'; }, rec ? 'flash' : 'is-new', { closest: '.item', delay: 180 });
        JS.store.update(function (s, now) { saved = rec ? B.updateRecord(s, rec.id, r.value, now) : B.createRecord(s, r.value, now); });
        ui.toast(rec ? 'Medição atualizada.' : 'Medição registrada.');
      }
    });
  }

  function recordMenu(id) {
    var s = JS.store.state, r = JS.store.state.bodyRecords.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var detail = B.ALL.filter(function (f) { return r[f.key] != null; }).map(function (f) { return '<p><span class="muted">' + esc(f.label) + ':</span> <strong>' + n(r[f.key], f) + ' ' + esc(f.unit) + '</strong></p>'; }).join('') +
      (r.notes ? '<p>' + esc(r.notes) + '</p>' : '');
    ui.actionSheet({
      title: 'Medição de ' + C.formatDateBR(r.date), detail: detail,
      actions: [
        { label: 'Editar', icon: 'edit', run: function () { openRecordForm(r); } },
        { label: 'Excluir', icon: 'trash', danger: true, run: function () {
          ui.confirm({ title: 'Excluir medição?', message: 'A medição de ' + C.formatDateBR(r.date) + ' será apagada.', confirmLabel: 'Excluir', danger: true })
            .then(function (ok) { if (ok) JS.anim.removeThen('[data-action="body-menu"][data-id="' + id + '"]', '.item', function () { JS.store.update(function (st) { B.deleteRecord(st, id); }); ui.toast('Medição excluída.'); }); });
        } }
      ]
    });
    void s;
  }

  function profileForm() {
    var b = JS.store.state.settings.body || {};
    var body = '<div class="row2">' + ui.input({ label: 'Altura (cm)', name: 'heightCm', type: 'number', value: b.heightCm || '', attrs: 'inputmode="numeric" min="100" max="230"' }) +
      ui.input({ label: 'Ano de nascimento', name: 'birthYear', type: 'number', value: b.birthYear || '', attrs: 'inputmode="numeric" min="1920" max="2020"' }) + '</div>' +
      ui.select({ label: 'Sexo (para as faixas de referência)', name: 'sex', options: [['f', 'Feminino'], ['m', 'Masculino']], value: b.sex || 'f' });
    ui.openSheet({
      title: 'Seus dados', body: body, submitLabel: 'Salvar',
      onSubmit: function (v) {
        var e = {}, h = v.heightCm ? Number(v.heightCm) : null, y = v.birthYear ? Number(v.birthYear) : null;
        if (h != null && !(h >= 100 && h <= 230)) e.heightCm = 'Altura entre 100 e 230 cm.';
        if (y != null && !(y >= 1920 && y <= new Date().getFullYear() - 5)) e.birthYear = 'Ano inválido.';
        if (Object.keys(e).length) return { errors: e };
        JS.store.update(function (s) { s.settings.body = { heightCm: h, birthYear: y, sex: v.sex === 'm' ? 'm' : 'f' }; });
        ui.toast('Dados salvos.');
      }
    });
  }

  JS.actions['body-new'] = function () { openRecordForm(null); };
  JS.actions['body-menu'] = function (d) { recordMenu(d.id); };
  JS.actions['body-profile'] = profileForm;
  JS.changes['body-metric'] = function (el) { view.metric = el.value; JS.app.render(); };
  JS.forms.body = function () { openRecordForm(null); };
  JS.telas.corpo = { title: 'Corpo', render: render, fab: { label: 'Nova medição', action: 'body-new' } };
})();
