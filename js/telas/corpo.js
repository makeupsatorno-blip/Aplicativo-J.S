/* J.S. — Corpo: bioimpedância, massa muscular, IMC, medidas e evolução */
(function () {
  'use strict';
  var JS = window.JS, C = window.JSCore, B = window.JSCorpo, ui = JS.ui, esc = ui.esc;
  var view = { metric: 'weightKg', showPhotos: false };
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
      return html + ui.empty('body', 'Registre os dados da sua balança de bioimpedância (peso, % de gordura, massa muscular...) e acompanhe a evolução.', { label: 'Registrar medição', attrs: 'data-action="body-new"' }) + photosCard() + profileCard(body);
    }
    var L = B.latest(s);
    var lastDate = Object.keys(L).reduce(function (m, k) { return L[k].date > m ? L[k].date : m; }, '');
    var tiles = SHOW.filter(function (k) { return L[k]; }).map(function (k) {
      var f = B.field(k), d = L[k];
      return '<div class="stat"><span class="stat-label">' + esc(f.label) + '</span><strong>' + n(d.value, f) + ' <small>' + esc(f.unit) + '</small></strong>' + deltaTag(f, d) + '</div>';
    }).join('');
    html += '<section class="card full"><div class="card-head"><h2>' + ui.icon('body', 18) + 'Última medição</h2><span class="muted small">' + esc(C.formatDayLabel(lastDate, today)) + ' • ' + esc(C.formatDateBR(lastDate)) + '</span></div>' +
      '<div class="tiles">' + tiles + '</div><p class="hint">Setas comparam com a medição anterior. Verde = no sentido que costuma ser desejado.</p></section>';
    html += photosCard();

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

  /* ---------------- Fotos de evolução ---------------- */

  var F = JS.fotos;
  function photosCard() {
    if (!F || !F.supported()) return '';
    return '<section class="card photos-card full" data-photos><div class="card-head"><h2>' + ui.icon('camera', 18) + 'Fotos de evolução</h2>' +
      '<button type="button" class="link small-link" data-action="photo-privacy" aria-pressed="' + view.showPhotos + '">' + ui.icon(view.showPhotos ? 'eyeoff' : 'eye', 16) + (view.showPhotos ? 'Esconder' : 'Mostrar') + '</button></div>' +
      '<div data-photos-body><p class="muted small">Carregando fotos…</p></div>' +
      '<div class="btn-row tight"><button type="button" class="btn small primary" data-action="photo-add">' + ui.icon('camera', 16) + 'Adicionar foto</button>' +
      '<button type="button" class="btn small soft" data-action="photo-compare" data-photo-cmp hidden>' + ui.icon('compare', 16) + 'Comparar antes e depois</button></div>' +
      '<input type="file" accept="image/*" hidden data-change="photo-file" data-photo-input>' +
      '<p class="hint">As fotos ficam só neste aparelho (não vão para nenhum servidor) e entram no backup em arquivo. Ficam desfocadas até você tocar em Mostrar.</p></section>';
  }
  function thumb(r, big) {
    return '<button type="button" class="ph-thumb' + (big ? ' big' : '') + '" data-action="photo-view" data-id="' + esc(r.id) + '"><img src="' + F.url(r, 'thumb') + '" alt="Foto de ' + esc(C.formatDateBR(r.date)) + ', ' + esc(F.POSES[r.pose] || '') + '" loading="lazy">' +
      '<span>' + esc(C.formatDayMonth(r.date)) + ' • ' + esc(F.POSES[r.pose] || '') + '</span></button>';
  }
  function fillPhotos(main) {
    var box = main.querySelector('[data-photos-body]');
    if (!box) return;
    F.list().then(function (list) {
      if (!box.isConnected) return;
      var cmp = main.querySelector('[data-photo-cmp]');
      if (cmp) cmp.hidden = list.length < 2;
      if (!list.length) {
        box.innerHTML = '<div class="ph-empty"><span aria-hidden="true">📸</span><p>Tire fotos de frente, de lado e de costas, no mesmo lugar e com a mesma luz, a cada 2 ou 4 semanas. Comparar as fotos mostra mudanças que a balança não mostra.</p></div>';
        return;
      }
      box.innerHTML = '<div class="ph-grid' + (view.showPhotos ? '' : ' blurred') + '">' + list.slice(0, 8).map(function (r) { return thumb(r); }).join('') + '</div>' +
        (list.length > 8 ? '<button type="button" class="link" data-action="photo-all">Ver todas as ' + list.length + ' fotos' + ui.icon('right', 16) + '</button>' : '');
    }).catch(function (e) { box.innerHTML = '<p class="muted small">' + esc(e.message) + '</p>'; });
  }

  // Peso registrado mais perto da data (até 10 dias de distância).
  function weightNear(date) {
    var best = null;
    B.series(JS.store.state, 'weightKg').forEach(function (p) {
      var d = Math.abs(C.diffDays(p.date, date));
      if (d <= 10 && (!best || d < best.d)) best = { d: d, v: p.value };
    });
    return best ? best.v : null;
  }

  function newPhotoForm(prep, file) {
    var t = C.toDateKey(new Date());
    var fd = file && file.lastModified ? C.toDateKey(new Date(file.lastModified)) : t;
    if (fd > t || C.diffDays(fd, t) > 730) fd = t;
    var prevUrl = URL.createObjectURL(prep.thumb);
    var body = '<div class="ph-preview"><img src="' + prevUrl + '" alt="Prévia da foto"></div>' +
      '<div class="row2">' + ui.input({ label: 'Data', name: 'date', type: 'date', value: fd, attrs: 'max="' + t + '"' }) +
      ui.select({ label: 'Pose', name: 'pose', options: ui.entries(F.POSES), value: 'frente' }) + '</div>' +
      ui.input({ label: 'Anotação (opcional)', name: 'note', attrs: 'maxlength="200"', placeholder: 'Ex.: em jejum, depois do treino' });
    ui.openSheet({
      title: 'Nova foto', body: body, submitLabel: 'Salvar foto',
      onSubmit: function (v) {
        if (!C.isDateKey(v.date) || v.date > t) return { errors: { date: 'Escolha um dia até hoje.' } };
        return F.add(prep, v).then(function () { return { ok: true }; }, function (e) { return { errors: { date: e.message || 'Sem espaço para guardar a foto.' } }; });
      },
      afterClose: function (r) {
        URL.revokeObjectURL(prevUrl);
        if (r && r.ok) { view.showPhotos = true; JS.app.render(); ui.toast('Foto guardada neste aparelho 📸'); }
      }
    });
  }

  function viewPhoto(id) {
    F.get(id).then(function (r) {
      if (!r) return;
      var w = weightNear(r.date);
      var body = '<div class="ph-full"><img src="' + F.url(r, 'full') + '" alt="Foto de ' + esc(C.formatDateBR(r.date)) + '"></div>' +
        (r.note ? '<p>' + esc(r.note) + '</p>' : '') + (w ? '<p class="muted small">Peso registrado perto desse dia: <strong>' + JS.graf.fmtNum(w, 1) + ' kg</strong></p>' : '') +
        '<div class="btn-col"><button type="button" class="btn soft" data-cmp>' + ui.icon('compare', 18) + 'Comparar com outra foto</button>' +
        '<button type="button" class="btn soft" data-edit>' + ui.icon('edit', 18) + 'Mudar data, pose ou anotação</button>' +
        '<button type="button" class="btn ghost danger-text" data-del>' + ui.icon('trash', 18) + 'Excluir foto</button></div>';
      ui.openSheet({
        title: 'Foto de ' + C.formatDateBR(r.date), subtitle: F.POSES[r.pose], body: body,
        onOpen: function (form) {
          form.querySelector('[data-cmp]').addEventListener('click', function () { compare(r.id); });
          form.querySelector('[data-edit]').addEventListener('click', function () { editPhoto(r); });
          form.querySelector('[data-del]').addEventListener('click', function () {
            ui.confirm({ title: 'Excluir esta foto?', message: 'A foto de ' + C.formatDateBR(r.date) + ' será apagada deste aparelho.', confirmLabel: 'Excluir', danger: true }).then(function (ok) {
              if (!ok) return;
              F.remove(r.id).then(function () { ui.closeSheet(); JS.app.render(); ui.toast('Foto excluída.'); });
            });
          });
        }
      });
    });
  }

  function editPhoto(r) {
    var t = C.toDateKey(new Date());
    var body = '<div class="row2">' + ui.input({ label: 'Data', name: 'date', type: 'date', value: r.date, attrs: 'max="' + t + '"' }) +
      ui.select({ label: 'Pose', name: 'pose', options: ui.entries(F.POSES), value: r.pose }) + '</div>' +
      ui.input({ label: 'Anotação (opcional)', name: 'note', value: r.note || '', attrs: 'maxlength="200"' });
    ui.openSheet({
      title: 'Editar foto', body: body, submitLabel: 'Salvar',
      onSubmit: function (v) {
        if (!C.isDateKey(v.date) || v.date > t) return { errors: { date: 'Escolha um dia até hoje.' } };
        return F.update(r.id, { date: v.date, pose: F.POSES[v.pose] ? v.pose : r.pose, note: String(v.note || '').trim().slice(0, 200) || null }).then(function () { return { ok: true }; });
      },
      afterClose: function (res) { if (res && res.ok) { JS.app.render(); ui.toast('Foto atualizada.'); } }
    });
  }

  function allPhotos() {
    F.list().then(function (list) {
      var groups = {};
      list.forEach(function (r) { (groups[C.monthOf(r.date)] = groups[C.monthOf(r.date)] || []).push(r); });
      var body = Object.keys(groups).sort().reverse().map(function (mk) {
        return '<p class="stat-label">' + esc(C.formatMonthLabel(mk)) + '</p><div class="ph-grid' + (view.showPhotos ? '' : ' blurred') + '">' + groups[mk].map(function (r) { return thumb(r); }).join('') + '</div>';
      }).join('');
      ui.openSheet({
        title: 'Fotos de evolução', subtitle: list.length + ' fotos', body: body,
        onOpen: function (form) {
          form.addEventListener('click', function (e) { var b = e.target.closest('[data-action="photo-view"]'); if (b) { e.preventDefault(); viewPhoto(b.dataset.id); } });
        }
      });
    });
  }

  // Antes e depois: deslize para revelar (ou lado a lado).
  function compare(afterId) {
    F.list().then(function (list) {
      if (list.length < 2) { ui.toast('Adicione pelo menos 2 fotos para comparar.'); return; }
      var b = afterId ? list.filter(function (r) { return r.id === afterId; })[0] : list[0];
      var same = list.filter(function (r) { return r.pose === b.pose && r.id !== b.id; });
      var a = (same.length ? same : list.filter(function (r) { return r.id !== b.id; })).slice(-1)[0];
      if (a.date > b.date) { var x = a; a = b; b = x; }
      var opts = list.map(function (r) { return [r.id, C.formatDayMonth(r.date) + '/' + r.date.slice(2, 4) + ' • ' + F.POSES[r.pose]]; });
      var body = '<div class="row2">' + ui.select({ label: 'Antes', name: 'a', options: opts, value: a.id }) + ui.select({ label: 'Depois', name: 'b', options: opts, value: b.id }) + '</div>' +
        '<div class="cmp-box" style="--pos:50%"><img class="cmp-a" alt="Antes"><div class="cmp-b"><img alt="Depois"></div><span class="cmp-line" aria-hidden="true"></span>' +
        '<span class="cmp-tag l">Antes</span><span class="cmp-tag r">Depois</span></div>' +
        '<input type="range" class="cmp-range" min="0" max="100" value="50" aria-label="Deslize para comparar antes e depois">' +
        '<div class="quick-chips"><button type="button" class="chip" data-side>' + ui.icon('compare', 14) + ' Lado a lado</button></div>' +
        '<p class="cmp-info" data-info></p>';
      ui.openSheet({
        title: 'Antes e depois', body: body,
        onOpen: function (form) {
          var box = form.querySelector('.cmp-box'), range = form.querySelector('.cmp-range'), info = form.querySelector('[data-info]');
          function byId(id) { return list.filter(function (r) { return r.id === id; })[0]; }
          function draw() {
            var ra = byId(form.elements.a.value), rb = byId(form.elements.b.value);
            box.querySelector('.cmp-a').src = F.url(ra, 'full');
            box.querySelector('.cmp-b img').src = F.url(rb, 'full');
            if (ra.w && ra.h) box.style.aspectRatio = ra.w + ' / ' + ra.h;
            var days = Math.abs(C.diffDays(ra.date, rb.date)), wa = weightNear(ra.date), wb = weightNear(rb.date);
            info.textContent = days + (days === 1 ? ' dia' : ' dias') + ' entre as fotos' +
              (wa && wb ? ' • peso ' + JS.graf.fmtNum(wa, 1) + ' → ' + JS.graf.fmtNum(wb, 1) + ' kg (' + (wb - wa > 0 ? '+' : '') + JS.graf.fmtNum(wb - wa, 1) + ' kg)' : '');
          }
          function setPos(p) { p = Math.max(0, Math.min(100, p)); box.style.setProperty('--pos', p + '%'); range.value = Math.round(p); }
          range.addEventListener('input', function () { setPos(Number(range.value)); });
          var drag = false;
          box.addEventListener('pointerdown', function (e) { drag = true; box.setPointerCapture(e.pointerId); move(e); });
          box.addEventListener('pointermove', function (e) { if (drag) move(e); });
          box.addEventListener('pointerup', function () { drag = false; });
          box.addEventListener('pointercancel', function () { drag = false; });
          function move(e) { var r = box.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width * 100); }
          form.elements.a.addEventListener('change', draw);
          form.elements.b.addEventListener('change', draw);
          form.querySelector('[data-side]').addEventListener('click', function (e) {
            var on = !box.classList.contains('side');
            box.classList.toggle('side', on); range.hidden = on; e.currentTarget.classList.toggle('on', on);
          });
          draw();
        }
      });
    });
  }

  JS.actions['photo-add'] = function () { var inp = document.querySelector('[data-photo-input]'); if (inp) inp.click(); };
  JS.changes['photo-file'] = function (el) {
    var file = el.files && el.files[0];
    el.value = '';
    if (!file) return;
    ui.toast('Preparando a foto…', { timeout: 1500 });
    F.prepare(file).then(function (prep) { newPhotoForm(prep, file); }, function (e) { ui.toast(e.message, { error: true }); });
  };
  JS.actions['photo-view'] = function (d) { viewPhoto(d.id); };
  JS.actions['photo-all'] = allPhotos;
  JS.actions['photo-compare'] = function () { compare(null); };
  JS.actions['photo-privacy'] = function () { view.showPhotos = !view.showPhotos; JS.app.render(); };

  JS.actions['body-new'] = function () { openRecordForm(null); };
  JS.actions['body-menu'] = function (d) { recordMenu(d.id); };
  JS.actions['body-profile'] = profileForm;
  JS.changes['body-metric'] = function (el) { view.metric = el.value; JS.app.render(); };
  JS.forms.body = function () { openRecordForm(null); };
  JS.telas.corpo = { title: 'Corpo', render: render, after: function (main) { if (F && F.supported()) fillPhotos(main); }, fab: { label: 'Nova medição', action: 'body-new' } };
})();
