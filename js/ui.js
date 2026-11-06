/*
 * J.S. — componentes de interface: ícones, campos de formulário, folhas (modais),
 * confirmações e avisos rápidos. Todo texto vindo dos dados passa por esc().
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  var C = window.JSCore;

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    list: '<path d="m3 6 2 2 4-4"/><path d="m3 14 2 2 4-4"/><path d="M13 6h8"/><path d="M13 14h8"/><path d="M13 20h8"/>',
    flower: '<circle cx="12" cy="7" r="3"/><circle cx="17" cy="12" r="3"/><circle cx="12" cy="17" r="3"/><circle cx="7" cy="12" r="3"/><circle cx="12" cy="12" r="1.5"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5" pathLength="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/>',
    edit: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    belloff: '<path d="M8.7 3A6 6 0 0 1 18 8a21 21 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    skip: '<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6 6 2 2M16 16l2 2M6 18l2-2M16 8l2-2"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>'
  };

  function icon(name, size) {
    size = size || 20;
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

  function entries(obj) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }); }
  function plain(arr) { return arr.map(function (x) { return [x, x]; }); }

  /* ---------------- Campos ---------------- */

  function wrap(o, inner) {
    var label = o.label ? (o.group ? '<span class="label">' + esc(o.label) + '</span>' : '<label for="f-' + esc(o.name) + '">' + esc(o.label) + '</label>') : '';
    return '<div class="field ' + (o.cls || '') + '" data-field="' + esc(o.name) + '">' + label + inner +
      (o.hint ? '<p class="hint">' + esc(o.hint) + '</p>' : '') + '<p class="err" role="alert"></p></div>';
  }
  function input(o) {
    return wrap(o, '<input id="f-' + esc(o.name) + '" name="' + esc(o.name) + '" type="' + (o.type || 'text') + '" value="' +
      esc(o.value == null ? '' : o.value) + '"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') +
      (o.required ? ' required' : '') + ' ' + (o.attrs || '') + '>');
  }
  function select(o) {
    var cur = o.value == null ? '' : String(o.value);
    var opts = o.options.map(function (p) {
      var val = p[0] == null ? '' : String(p[0]);
      return '<option value="' + esc(val) + '"' + (val === cur ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
    }).join('');
    return wrap(o, '<select id="f-' + esc(o.name) + '" name="' + esc(o.name) + '" ' + (o.attrs || '') + '>' + opts + '</select>');
  }
  function textarea(o) {
    return wrap(o, '<textarea id="f-' + esc(o.name) + '" name="' + esc(o.name) + '" rows="' + (o.rows || 2) + '"' +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + ' ' + (o.attrs || '') + '>' + esc(o.value || '') + '</textarea>');
  }
  function weekdays(o) {
    var sel = (o.value || []).map(Number);
    var inner = '<div class="weekdays">' + [0, 1, 2, 3, 4, 5, 6].map(function (d) {
      return '<label class="wd"><input type="checkbox" name="' + esc(o.name) + '" value="' + d + '"' + (sel.indexOf(d) >= 0 ? ' checked' : '') +
        '><span aria-label="' + C.WEEKDAY_SHORT[d] + '">' + C.WEEKDAY_LETTERS[d] + '</span></label>';
    }).join('') + '</div>';
    return wrap(Object.assign({ group: true }, o), inner);
  }
  function checkbox(o) {
    return '<div class="field" data-field="' + esc(o.name) + '"><label class="switch-row"><span class="switch-text"><strong>' + esc(o.label) + '</strong>' +
      (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</span><input type="checkbox" class="switch" name="' + esc(o.name) + '"' +
      (o.checked ? ' checked' : '') + ' ' + (o.attrs || '') + '></label><p class="err" role="alert"></p></div>';
  }
  function chips(list) {
    return '<div class="quick-chips">' + list.map(function (c) {
      return '<button type="button" class="chip" ' + c.attrs + '>' + esc(c.label) + '</button>';
    }).join('') + '</div>';
  }

  function formValues(form) {
    var fd = new FormData(form);
    var out = {};
    fd.forEach(function (v, k) {
      if (out[k] === undefined) out[k] = v;
      else if (Array.isArray(out[k])) out[k].push(v);
      else out[k] = [out[k], v];
    });
    form.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      var all = fd.getAll(cb.name);
      if (form.querySelectorAll('input[type=checkbox][name="' + cb.name + '"]').length > 1) out[cb.name] = all;
      else out[cb.name] = cb.checked;
    });
    return out;
  }

  function showErrors(form, errors) {
    var shown = false;
    Object.keys(errors).forEach(function (k) {
      var f = form.querySelector('[data-field="' + k + '"]');
      if (!f) return;
      f.classList.add('invalid');
      f.querySelector('.err').textContent = errors[k];
      shown = true;
    });
    var first = form.querySelector('.field.invalid');
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (!shown) toast(errors[Object.keys(errors)[0]], { error: true });
  }
  function clearErrors(form) {
    form.querySelectorAll('.field.invalid').forEach(function (f) { f.classList.remove('invalid'); f.querySelector('.err').textContent = ''; });
  }

  /* ---------------- Folha (modal de baixo para cima) ---------------- */

  function sheetEl() { return document.getElementById('sheet'); }

  function openSheet(o) {
    var sheet = sheetEl();
    var foot = o.onSubmit
      ? '<footer class="sheet-foot"><button type="button" class="btn ghost" data-close>' + esc(o.cancelLabel || 'Cancelar') +
        '</button><button type="submit" class="btn primary">' + esc(o.submitLabel || 'Salvar') + '</button></footer>'
      : '';
    sheet.innerHTML = '<form class="sheet-form" novalidate autocomplete="off">' +
      '<header class="sheet-head"><div class="sheet-titles"><h2>' + esc(o.title) + '</h2>' +
      (o.subtitle ? '<p class="sheet-sub">' + esc(o.subtitle) + '</p>' : '') +
      '</div><button type="button" class="icon-btn" data-close aria-label="Fechar">' + icon('x') + '</button></header>' +
      '<div class="sheet-body">' + o.body + '</div>' + foot + '</form>';
    var form = sheet.querySelector('form');
    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || !o.onSubmit) return;
      clearErrors(form);
      busy = true;
      Promise.resolve().then(function () { return o.onSubmit(formValues(form), form); }).then(function (res) {
        busy = false;
        if (res === false) return;
        if (res && res.errors) { showErrors(form, res.errors); return; }
        closeSheet();
        if (o.afterClose) setTimeout(function () { o.afterClose(res); }, 50);
      }).catch(function (err) {
        busy = false;
        console.error(err);
        toast('Algo deu errado: ' + err.message, { error: true });
      });
    });
    sheet.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeSheet); });
    // Se a folha anterior ainda estava saindo, aproveita a mesma e troca o conteúdo.
    clearTimeout(sheet._closeTimer);
    sheet.classList.remove('closing');
    if (!sheet.open) sheet.showModal();
    restart(sheet, 'in');
    var body = sheet.querySelector('.sheet-body');
    if (body) body.scrollTop = 0;
    if (o.onOpen) o.onOpen(form);
    return form;
  }

  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function reducedMotion() { return document.documentElement.classList.contains('reduce-motion'); }

  // Fecha com animação de saída (no modo "menos animação", fecha na hora).
  function animatedClose(dlg, ms) {
    if (!dlg || !dlg.open || dlg.classList.contains('closing')) return;
    if (reducedMotion()) { dlg.classList.remove('in'); dlg.close(); return; }
    dlg.classList.add('closing');
    dlg._closeTimer = setTimeout(function () {
      if (!dlg.classList.contains('closing')) return;
      dlg.classList.remove('closing', 'in');
      dlg.close();
    }, ms);
  }

  function closeSheet() { animatedClose(sheetEl(), 210); }

  // Lista de ações de um item (editar, excluir...).
  function actionSheet(o) {
    var acts = o.actions.filter(Boolean);
    var body = (o.detail ? '<div class="sheet-detail">' + o.detail + '</div>' : '') + '<div class="actions">' +
      acts.map(function (a, i) {
        return '<button type="button" class="action' + (a.danger ? ' danger' : '') + '" data-i="' + i + '">' +
          icon(a.icon || 'arrow') + '<span>' + esc(a.label) + '</span></button>';
      }).join('') + '</div>';
    var form = openSheet({ title: o.title, subtitle: o.subtitle, body: body });
    form.querySelectorAll('.action').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = acts[Number(btn.dataset.i)];
        closeSheet();
        setTimeout(a.run, 30);
      });
    });
  }

  /* ---------------- Confirmação e escolha ---------------- */

  var confirmFinish = null;
  function cancelConfirm() { if (confirmFinish) confirmFinish(null); }

  function choose(o) {
    var dlg = document.getElementById('confirm');
    clearTimeout(dlg._closeTimer);
    dlg.classList.remove('closing');
    return new Promise(function (resolve) {
      dlg.innerHTML = '<div class="confirm-box"><h2>' + esc(o.title) + '</h2>' + (o.message ? '<p>' + esc(o.message) + '</p>' : '') +
        '<div class="confirm-actions">' + o.options.map(function (op, i) {
          return '<button type="button" class="btn ' + (op.danger ? 'danger-solid' : op.primary ? 'primary' : 'soft') + '" data-i="' + i + '">' + esc(op.label) + '</button>';
        }).join('') + '<button type="button" class="btn ghost" data-cancel>' + esc(o.cancelLabel || 'Cancelar') + '</button></div></div>';
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        if (confirmFinish === finish) confirmFinish = null;
        animatedClose(dlg, 170);
        resolve(v);
      }
      confirmFinish = finish;
      dlg.querySelectorAll('[data-i]').forEach(function (b) {
        b.addEventListener('click', function () { finish(o.options[Number(b.dataset.i)].value); });
      });
      dlg.querySelector('[data-cancel]').addEventListener('click', function () { finish(null); });
      dlg.onclose = function () { finish(null); };
      if (!dlg.open) dlg.showModal();
      restart(dlg, 'in');
    });
  }

  function confirm(o) {
    return choose({
      title: o.title, message: o.message, cancelLabel: o.cancelLabel,
      options: [{ label: o.confirmLabel || 'Confirmar', value: true, danger: !!o.danger, primary: !o.danger }]
    }).then(function (v) { return v === true; });
  }

  /* ---------------- Aviso rápido ---------------- */

  var toastTimer = null, toastOutTimer = null;
  function toast(msg, o) {
    o = o || {};
    var el = document.getElementById('toast');
    if (!el) return;
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (o.actionLabel ? '<button type="button">' + esc(o.actionLabel) + '</button>' : '');
    el.classList.toggle('error', !!o.error);
    clearTimeout(toastOutTimer);
    el.classList.remove('out');
    restart(el, 'show');
    // Popover coloca o aviso acima das folhas abertas, quando o navegador suporta.
    try { if (el.showPopover && !el.matches(':popover-open')) el.showPopover(); } catch (e) { /* sem suporte */ }
    if (o.actionLabel) el.querySelector('button').onclick = function () { hideToast(); o.onAction(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, o.timeout || 3500);
  }
  function hideToast() {
    var el = document.getElementById('toast');
    if (!el || !el.classList.contains('show')) return;
    el.classList.add('out');
    clearTimeout(toastOutTimer);
    toastOutTimer = setTimeout(function () {
      el.classList.remove('show', 'out');
      try { if (el.hidePopover && el.matches(':popover-open')) el.hidePopover(); } catch (e) { /* sem suporte */ }
    }, reducedMotion() ? 0 : 180);
  }

  /* ---------------- Pedaços de tela reutilizáveis ---------------- */

  function empty(iconName, text, btn) {
    return '<div class="empty"><div class="empty-ic">' + icon(iconName, 26) + '</div><p>' + esc(text) + '</p>' +
      (btn ? '<button type="button" class="btn soft" ' + btn.attrs + '>' + icon('plus', 18) + esc(btn.label) + '</button>' : '') + '</div>';
  }
  function section(title, inner, extra) {
    return '<section class="block"><div class="block-head"><h2>' + esc(title) + '</h2>' + (extra || '') + '</div>' + inner + '</section>';
  }
  function tag(text, kind) { return '<span class="tag ' + (kind || '') + '">' + esc(text) + '</span>'; }

  // Abas internas de uma tela (ex.: Hoje | Semana | Mês).
  function segmented(options, current, action) {
    return '<div class="segmented" role="tablist">' + options.map(function (o) {
      var on = o[0] === current;
      return '<button type="button" role="tab" aria-selected="' + on + '" class="' + (on ? 'on' : '') + '" data-action="' + action + '" data-mode="' + esc(o[0]) + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function monthNav(mk, action) {
    return '<div class="month-nav"><button type="button" class="icon-btn" data-action="' + action + '" data-delta="-1" aria-label="Mês anterior">' + icon('left') +
      '</button><strong>' + esc(C.formatMonthLabel(mk)) + '</strong><button type="button" class="icon-btn" data-action="' + action + '" data-delta="1" aria-label="Próximo mês">' + icon('right') + '</button></div>';
  }

  // Registros preenchidos por cada tela.
  JS.actions = JS.actions || {};  // cliques em [data-action]
  JS.changes = JS.changes || {};  // alterações em [data-change]
  JS.forms = JS.forms || {};      // formulários de criação usados pelo painel
  JS.render = JS.render || {};    // itens de lista reutilizados entre telas
  JS.telas = JS.telas || {};

  JS.ui = {
    segmented: segmented, monthNav: monthNav,
    icon: icon, esc: esc, entries: entries, plain: plain,
    input: input, select: select, textarea: textarea, weekdays: weekdays, checkbox: checkbox, chips: chips,
    formValues: formValues, showErrors: showErrors, clearErrors: clearErrors,
    openSheet: openSheet, closeSheet: closeSheet, actionSheet: actionSheet, choose: choose, confirm: confirm, cancelConfirm: cancelConfirm,
    toast: toast, hideToast: hideToast, empty: empty, section: section, tag: tag
  };
})();
