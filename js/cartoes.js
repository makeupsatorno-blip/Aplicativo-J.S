/*
 * J.S. — cartões para compartilhar (imagens PNG desenhadas no próprio aparelho).
 *
 *   JS.cartoes.share(tipo, dados) → Promise<'compartilhado' | 'salvo' | 'fechado'>
 *
 * Tipos e dados:
 *   'recorde'   { name, kind: 'carga' | 'reps', load, reps, prevLoad, prevReps }
 *   'semana'    { periodo, frase, itens: [{ valor, rotulo }], niveis?: [nível|null × 7] }
 *   'jardim'    { sequencia, melhor?, semanasFloridas, niveis?: [nível|null × 14] }
 *   'conquista' { titulo, texto }
 *
 * Privacidade: o cartão só mostra o que o tipo pede. Nunca leva peso corporal, medidas, fotos nem datas
 * de nascimento. O primeiro nome só entra se a usuária marcar "incluir meu primeiro nome" (desligado).
 * Funciona sem internet; a prévia aparece numa folha com "Compartilhar" e "Salvar imagem".
 *
 * Módulo puro (descrever, quebrar) para testes no Node; o desenho só roda no navegador.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSCartoes = api;
  if (root && root.JS && root.document && api.montarUI) api.montarUI(root.JS, root);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function fmtNum(n, dec) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec == null ? 1 : dec }); }
  function fmtKg(n) { return fmtNum(n, 1) + ' kg'; }
  function plural(n, um, varios) { return fmtNum(n, 0) + ' ' + (Number(n) === 1 ? um : varios); }
  // Sem emojis: o desenho em canvas usa as fontes do app, e um emoji pode sair como quadradinho.
  function txt(v, max) { return String(v == null ? '' : v).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max || 200); }

  // Conteúdo do cartão (sem desenho): { tipo, icone, kicker, titulo, grande, sub, frase, itens, niveis, alt }.
  function descrever(tipo, d) {
    d = d || {};
    var out = { tipo: tipo, icone: 'flor', kicker: '', titulo: '', grande: '', sub: '', frase: '', itens: [], niveis: null, alt: '' };
    if (tipo === 'recorde') {
      var reps = d.kind === 'reps';
      out.icone = 'trofeu';
      out.kicker = 'Novo recorde!';
      out.titulo = txt(d.name || 'Exercício', 60);
      out.grande = reps ? plural(d.reps, 'repetição', 'repetições') : fmtKg(d.load) + ' × ' + fmtNum(d.reps, 0);
      out.sub = reps
        ? 'com ' + fmtKg(d.load) + (d.prevReps != null && isFinite(d.prevReps) ? ' • antes: ' + fmtNum(d.prevReps, 0) : '')
        : (d.prevLoad ? 'antes: ' + fmtKg(d.prevLoad) : 'a maior carga até agora');
      out.alt = 'Novo recorde! ' + out.titulo + ': ' + out.grande + (out.sub ? ', ' + out.sub : '') + '.';
    } else if (tipo === 'semana') {
      out.kicker = 'Minha semana';
      out.titulo = txt(d.periodo || 'Minha semana', 40);
      out.frase = txt(d.frase, 260);
      out.itens = (Array.isArray(d.itens) ? d.itens : []).slice(0, 6).map(function (i) { return { valor: txt(i && i.valor, 12), rotulo: txt(i && i.rotulo, 28) }; });
      out.niveis = Array.isArray(d.niveis) ? d.niveis.slice(0, 7) : null;
      out.alt = 'Minha semana (' + out.titulo + '): ' + out.itens.map(function (i) { return i.valor + ' ' + i.rotulo; }).join(', ') + '.';
    } else if (tipo === 'jardim') {
      var seq = Math.max(0, Math.round(Number(d.sequencia) || 0)), fl = Math.max(0, Math.round(Number(d.semanasFloridas) || 0));
      out.kicker = 'Meu jardim';
      out.titulo = seq > 0 ? plural(seq, 'dia', 'dias') + ' de sequência' : 'Meu jardim está florescendo';
      out.itens = [{ valor: fmtNum(fl, 0), rotulo: fl === 1 ? 'semana florida' : 'semanas floridas' }];
      if (d.melhor > seq) out.itens.push({ valor: fmtNum(d.melhor, 0), rotulo: 'melhor sequência' });
      out.niveis = Array.isArray(d.niveis) ? d.niveis.slice(0, 14) : null;
      out.frase = seq > 0 ? 'Um passinho de cada vez, todo dia.' : 'Cada hábito é uma gotinha de carinho.';
      out.alt = 'Meu jardim: ' + out.titulo + ', ' + out.itens.map(function (i) { return i.valor + ' ' + i.rotulo; }).join(', ') + '.';
    } else {
      out.kicker = 'Nova conquista';
      out.titulo = txt(d.titulo || 'Conquista', 60);
      out.frase = txt(d.texto, 200);
      out.alt = 'Nova conquista: ' + out.titulo + (out.frase ? '. ' + out.frase : '');
    }
    return out;
  }

  // Quebra o texto em linhas que cabem em "max" (medir(texto) → largura). Palavras maiores que a linha são partidas.
  function quebrar(medir, texto, max) {
    var words = String(texto || '').split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) {
      while (medir(w) > max && w.length > 1) {
        var k = w.length - 1;
        while (k > 1 && medir(w.slice(0, k)) > max) k--;
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(w.slice(0, k)); w = w.slice(k);
      }
      var t = cur ? cur + ' ' + w : w;
      if (cur && medir(t) > max) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  /* ================= Desenho e prévia (só no navegador) ================= */

  function montarUI(JS, win) {
    var ui = JS.ui, esc = ui.esc, doc = win.document;
    var TROFEU = ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22',
      'M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8', 'M18 2H6v7a6 6 0 0 0 12 0V2Z'];

    function tema() {
      var cs = win.getComputedStyle(doc.documentElement);
      function v(n, d) { var x = cs.getPropertyValue(n).trim(); return x || d; }
      return {
        rose50: v('--rose50', '#FFF7FA'), rose100: v('--rose100', '#FCEBF1'), rose200: v('--rose200', '#F5D5E1'), rose300: v('--rose300', '#E9AFC4'), rose400: v('--rose400', '#D98EAA'),
        rose700: v('--rose700', '#A0526D'), rose800: v('--rose800', '#78465A'), text: v('--text', '#30262B'), muted: v('--muted', '#75676F'), surface: v('--surface', '#FFFFFF'),
        accent: v('--accent', '#A0526D'), lav: v('--lav-soft', '#C9B3DE'), peach: v('--m-kcal-soft', '#E3A383'), centro: v('--flower-center', '#FFF1A8'),
        fol: v('--ph-fol', '#3D7254'), ovu: v('--ph-ovu', '#8C5820'), pr: v('--pr', '#8C5820')
      };
    }
    function fontes() {
      if (!doc.fonts || !doc.fonts.load) return Promise.resolve();
      var all = Promise.all([doc.fonts.load('italic 600 64px "Cormorant Garamond"'), doc.fonts.load('600 32px Nunito'), doc.fonts.load('800 32px Nunito')]).catch(function () {});
      return Promise.race([all, new Promise(function (r) { setTimeout(r, 1500); })]);
    }

    function desenharForma(ctx, lista, x, y, s, t, variante) {
      var cores = [t.rose400, t.lav, t.peach];
      ctx.save(); ctx.translate(x, y); ctx.scale(s / 40, s / 40);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      lista.forEach(function (f) {
        ctx.save();
        switch (f.k) {
          case 'caule': ctx.strokeStyle = t.fol; ctx.lineWidth = 2; ctx.stroke(new Path2D(f.d)); break;
          case 'sepala': ctx.strokeStyle = t.fol; ctx.lineWidth = 1.6; ctx.stroke(new Path2D(f.d)); break;
          case 'terra': ctx.strokeStyle = t.muted; ctx.globalAlpha = .5; ctx.lineWidth = 1.6; ctx.stroke(new Path2D(f.d)); break;
          case 'folha': ctx.fillStyle = t.fol; ctx.globalAlpha = .8; ctx.fill(new Path2D(f.d)); break;
          case 'botao': ctx.fillStyle = t.rose400; ctx.fill(new Path2D(f.d)); break;
          case 'brilho': ctx.fillStyle = t.ovu; ctx.fill(new Path2D(f.d)); break;
          case 'semente': ctx.fillStyle = t.muted; ctx.globalAlpha = .6; ctx.beginPath(); ctx.ellipse(f.cx, f.cy, f.rx, f.ry, 0, 0, Math.PI * 2); ctx.fill(); break;
          case 'ponto': ctx.fillStyle = t.muted; ctx.globalAlpha = .35; ctx.beginPath(); ctx.arc(f.cx, f.cy, f.r, 0, Math.PI * 2); ctx.fill(); break;
          case 'miolo': ctx.fillStyle = t.centro; ctx.strokeStyle = t.ovu; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(f.cx, f.cy, f.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
          default:
            ctx.fillStyle = cores[variante % 3]; if (f.k === 'petalaFundo') ctx.globalAlpha = .55;
            ctx.translate(f.rot[1], f.rot[2]); ctx.rotate(f.rot[0] * Math.PI / 180);
            ctx.beginPath(); ctx.ellipse(f.cx - f.rot[1], f.cy - f.rot[2], f.rx, f.ry, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });
      ctx.restore();
    }
    function formasDe(n) { return win.JSJardim && win.JSJardim.formas ? win.JSJardim.formas(n) : []; }

    function brilho(ctx, x, y, r, cor, alfa) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, cor); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); ctx.globalAlpha = alfa; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
    }
    function florDeco(ctx, x, y, r, cor, t, alfa, rot) {
      ctx.save(); ctx.globalAlpha = alfa; ctx.translate(x, y); ctx.rotate(rot || 0);
      for (var i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.fillStyle = cor; ctx.beginPath(); ctx.ellipse(0, -r * .62, r * .34, r * .62, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = t.centro; ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function caixa(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    // Bloco de texto que encolhe a fonte até caber em "linhas" linhas.
    function blocoTexto(ctx, str, fonte, cor, maxW, tamMax, tamMin, maxLinhas, entre, align) {
      var tam = tamMax, lines;
      for (;;) {
        ctx.font = fonte(tam);
        lines = quebrar(function (s) { return ctx.measureText(s).width; }, str, maxW);
        if (lines.length <= maxLinhas || tam <= tamMin) break;
        tam -= 4;
      }
      if (lines.length > maxLinhas) { lines = lines.slice(0, maxLinhas); lines[maxLinhas - 1] = lines[maxLinhas - 1].replace(/\s*\S{0,3}$/, '') + '…'; }
      var lh = Math.round(tam * entre);
      return { h: lines.length * lh, draw: function (x, y) {
        ctx.save(); ctx.font = fonte(tam); ctx.fillStyle = cor; ctx.textAlign = align || 'center'; ctx.textBaseline = 'alphabetic';
        lines.forEach(function (l, i) { ctx.fillText(l, x, y + tam + i * lh - Math.round(tam * 0.18)); });
        ctx.restore();
      } };
    }

    function desenhar(spec, fmt, t, nome) {
      var W = 1080, H = fmt === 'stories' ? 1920 : 1350;
      var cv = doc.createElement('canvas'); cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');
      var g = ctx.createLinearGradient(0, 0, W * .45, H);
      g.addColorStop(0, t.rose50); g.addColorStop(.55, t.rose100); g.addColorStop(1, t.rose200);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      brilho(ctx, W * .12, H * .1, 560, t.rose300, .4); brilho(ctx, W * .92, H * .88, 640, t.lav, .35);
      florDeco(ctx, 96, 120, 74, t.rose300, t, .55, .3); florDeco(ctx, W - 80, 210, 52, t.lav, t, .55, 0); florDeco(ctx, W - 120, H - 280, 86, t.rose300, t, .5, .6);
      florDeco(ctx, 70, H - 330, 48, t.peach, t, .5, 0); florDeco(ctx, 150, 330, 34, t.peach, t, .45, 0);
      var px = 70, py = 170, pw = W - 140, ph = H - 170 - 300;
      ctx.save(); ctx.globalAlpha = .8; ctx.fillStyle = t.surface; caixa(ctx, px, py, pw, ph, 56); ctx.fill(); ctx.restore();
      ctx.save(); ctx.strokeStyle = t.rose200; ctx.lineWidth = 3; caixa(ctx, px, py, pw, ph, 56); ctx.stroke(); ctx.restore();

      var inner = pw - 140, cx = W / 2, blocos = [];
      var disp = function (n) { return 'italic 600 ' + n + 'px "Cormorant Garamond", Georgia, serif'; };
      var nun = function (w) { return function (n) { return w + ' ' + n + 'px Nunito, system-ui, sans-serif'; }; };
      var gap = function (h) { blocos.push({ h: h, draw: function () {} }); };

      // ícone
      var tam = spec.tipo === 'recorde' ? 150 : 170;
      blocos.push({ h: tam, draw: function (x, y) {
        if (spec.icone === 'trofeu') {
          ctx.save(); ctx.translate(x - tam / 2, y); ctx.scale(tam / 24, tam / 24); ctx.strokeStyle = t.pr; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          TROFEU.forEach(function (d) { ctx.stroke(new Path2D(d)); }); ctx.restore();
        } else desenharForma(ctx, formasDe(4), x - tam / 2, y, tam, t, 0);
      } });
      gap(34);
      // legenda superior (com espaçamento entre letras quando o navegador deixa)
      var kick = blocoTexto(ctx, spec.kicker.toUpperCase(), nun('800'), spec.tipo === 'recorde' ? t.pr : t.accent, inner, 40, 28, 1, 1.2);
      blocos.push({ h: kick.h, draw: function (x, y) { if ('letterSpacing' in ctx) ctx.letterSpacing = '8px'; kick.draw(x, y); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; } });
      gap(30);
      var tit = blocoTexto(ctx, spec.titulo, disp, t.rose800, inner, spec.tipo === 'recorde' ? 96 : 92, 52, 3, 1.08);
      blocos.push(tit);
      if (spec.grande) {
        gap(30);
        var gr = blocoTexto(ctx, spec.grande, nun('800'), t.text, inner, 168, 70, 2, 1.04);
        blocos.push(gr);
      }
      if (spec.sub) { gap(22); blocos.push(blocoTexto(ctx, spec.sub, nun('600'), t.muted, inner, 48, 30, 2, 1.25)); }
      if (spec.niveis && spec.niveis.length) {
        gap(36);
        var n = spec.niveis.length, porLinha = n > 7 ? 7 : n, linhas = Math.ceil(n / porLinha), cel = Math.min(120, Math.floor(inner / porLinha));
        blocos.push({ h: linhas * cel, draw: function (x, y) {
          var x0 = x - (porLinha * cel) / 2;
          spec.niveis.forEach(function (nv, i) { desenharForma(ctx, formasDe(nv == null ? null : nv), x0 + (i % porLinha) * cel, y + Math.floor(i / porLinha) * cel, cel, t, i % 3); });
        } });
      }
      if (spec.itens && spec.itens.length) {
        gap(40);
        var cols = spec.itens.length === 1 ? 1 : 2, cw = inner / cols, rows = Math.ceil(spec.itens.length / cols), rh = 150;
        blocos.push({ h: rows * rh, draw: function (x, y) {
          var x0 = x - inner / 2;
          spec.itens.forEach(function (it, i) {
            var cxx = x0 + (i % cols) * cw + cw / 2, yy = y + Math.floor(i / cols) * rh;
            ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.font = nun('800')(84); ctx.fillStyle = t.accent; ctx.fillText(it.valor, cxx, yy + 80);
            ctx.font = nun('600')(34); ctx.fillStyle = t.muted; ctx.fillText(it.rotulo, cxx, yy + 124);
            ctx.restore();
          });
        } });
      }
      if (spec.frase) { gap(36); blocos.push(blocoTexto(ctx, spec.frase, disp, t.text, inner, 52, 34, spec.tipo === 'semana' ? 5 : 3, 1.22)); }

      var total = blocos.reduce(function (a, b) { return a + b.h; }, 0), y = py + Math.max(40, (ph - total) / 2);
      blocos.forEach(function (b) { b.draw(cx, y); y += b.h; });

      // rodapé
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = disp(92); ctx.fillStyle = t.rose700; ctx.fillText('J.S.', cx, H - 170);
      ctx.font = nun('600')(32); ctx.fillStyle = t.muted;
      ctx.fillText(nome ? 'feito por ' + nome + ' • seu dia, organizado com carinho' : 'seu dia, organizado com carinho', cx, H - 110);
      ctx.restore();
      return cv;
    }

    function primeiroNome(s) { return String((s && s.name) || '').trim().split(/\s+/)[0] || ''; }
    function hoje() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

    function share(tipo, dados) {
      return new Promise(function (resolve) {
        var spec = descrever(tipo, dados), nome = primeiroNome(JS.store && JS.store.state && JS.store.state.settings);
        var est = { fmt: 'retrato', nome: false, blob: null, url: null, fim: false, gen: 0 };
        var podeCompartilhar = !!(win.navigator.canShare && win.File);
        function acabar(r) { if (!est.fim) { est.fim = true; resolve(r); } }
        var corpo = '<div class="cd-prev"><img class="cd-img" alt="' + esc(spec.alt) + '" hidden><p class="cd-carrega muted small" role="status">Preparando a imagem…</p></div>' +
          '<div class="quick-chips cd-fmt" role="group" aria-label="Formato da imagem"><button type="button" class="chip on" data-fmt="retrato" aria-pressed="true">Retrato</button><button type="button" class="chip" data-fmt="stories" aria-pressed="false">Stories</button></div>' +
          (nome ? '<label class="switch-row"><span class="switch-text"><strong>Incluir meu primeiro nome</strong><small>Aparece só no rodapé do cartão.</small></span><input type="checkbox" class="switch" name="nome"></label>' : '') +
          '<div class="btn-col cd-acoes">' + (podeCompartilhar ? '<button type="button" class="btn primary" data-share>' + ui.icon('share', 18) + 'Compartilhar</button>' : '') +
          '<button type="button" class="btn ' + (podeCompartilhar ? 'soft' : 'primary') + '" data-save>' + ui.icon('download', 18) + 'Salvar imagem</button></div>' +
          '<p class="hint">A imagem é criada aqui, no seu aparelho, e só tem o que aparece nela: nada de peso, medidas ou fotos.</p>';
        var sheet = doc.getElementById('sheet');
        sheet.addEventListener('close', function limpar() {
          sheet.removeEventListener('close', limpar);
          if (est.url) { URL.revokeObjectURL(est.url); est.url = null; }
          acabar('fechado');
        });
        ui.openSheet({
          title: 'Cartão para compartilhar', subtitle: spec.kicker, body: corpo,
          onOpen: function (form) {
            var img = form.querySelector('.cd-img'), msg = form.querySelector('.cd-carrega');
            function gerar() {
              var minha = ++est.gen;
              img.hidden = true; msg.hidden = false; msg.textContent = 'Preparando a imagem…';
              fontes().then(function () {
                if (minha !== est.gen) return;
                var cv = desenhar(spec, est.fmt, tema(), est.nome ? nome : '');
                cv.toBlob(function (b) {
                  if (minha !== est.gen) return;
                  if (!b) { msg.textContent = 'Não consegui criar a imagem neste aparelho.'; return; }
                  if (est.url) URL.revokeObjectURL(est.url);
                  est.blob = b; est.url = URL.createObjectURL(b);
                  img.src = est.url; img.hidden = false; msg.hidden = true;
                }, 'image/png');
              }).catch(function () { msg.textContent = 'Não consegui criar a imagem neste aparelho.'; });
            }
            form.querySelectorAll('[data-fmt]').forEach(function (b) {
              b.addEventListener('click', function () {
                est.fmt = b.dataset.fmt;
                form.querySelectorAll('[data-fmt]').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
                gerar();
              });
            });
            var cb = form.querySelector('[name=nome]');
            if (cb) cb.addEventListener('change', function () { est.nome = cb.checked; gerar(); });
            function arquivo() { return new win.File([est.blob], 'js-cartao-' + tipo + '-' + hoje() + '.png', { type: 'image/png' }); }
            function salvar() {
              if (!est.blob) return;
              var a = doc.createElement('a'), u = URL.createObjectURL(est.blob);
              a.href = u; a.download = arquivo().name; doc.body.appendChild(a); a.click(); a.remove();
              setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
              ui.toast('Imagem salva. Agora é só compartilhar 🌷');
              acabar('salvo');
            }
            var bs = form.querySelector('[data-share]');
            if (bs) bs.addEventListener('click', function () {
              if (!est.blob) return;
              var f = arquivo();
              if (!win.navigator.canShare({ files: [f] })) { salvar(); return; }
              win.navigator.share({ files: [f], title: 'J.S.', text: spec.alt }).then(function () { acabar('compartilhado'); }, function (e) {
                if (e && e.name !== 'AbortError') ui.toast('Não consegui abrir o compartilhamento. Use "Salvar imagem".', { error: true });
              });
            });
            form.querySelector('[data-save]').addEventListener('click', salvar);
            gerar();
          }
        });
      });
    }

    JS.cartoes = { share: share, descrever: descrever };
  }

  return { descrever: descrever, quebrar: quebrar, montarUI: montarUI };
});
