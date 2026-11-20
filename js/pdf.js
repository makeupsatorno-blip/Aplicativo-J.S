/*
 * J.S. — gerador de PDF sem bibliotecas (PDF 1.4), feito para o relatório do app.
 * Roda no navegador e no Node (testes). Páginas A4, fontes Helvetica/Helvetica-Bold padrão do PDF
 * com codificação WinAnsi (acentos do português), texto com quebra automática, tabelas com
 * cabeçalho repetido, gráficos simples de barras e linha, cartões de números, imagens JPEG
 * (DCTDecode) e rodapé com paginação. Devolve um Uint8Array.
 *
 *   var doc = JSPdf.criar({ titulo: 'Relatório', autor: 'J.S.', rodape: 'Gerado pelo J.S.' });
 *   doc.titulo('Relatório de novembro');             // título grande
 *   doc.secao('Treino');                              // título de seção
 *   doc.texto('Parágrafo…', { tamanho: 10 });
 *   doc.kpis([{ valor: '12', rotulo: 'treinos' }, …]);
 *   doc.tabela({ colunas: [{ t: 'Data', w: 1 }, { t: 'Ficha', w: 3, a: 'left' }], linhas: [['01/11', 'A']] });
 *   doc.barras({ titulo: '…', rotulos: [], valores: [] });  doc.linha({ … });
 *   doc.imagens([{ bytes: jpegBytes, legenda: '…' }]);
 *   var bytes = doc.gerar();
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSPdf = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PAGE = { w: 595.28, h: 841.89 };

  /* ---------------- Larguras da Helvetica (1000 unidades), caracteres 32..126 ---------------- */
  var W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  var W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
  var SPECIAL = { '•': 350, '–': 556, '—': 1000, '…': 1000, '“': 333, '”': 333, '‘': 222, '’': 222, '×': 584, '°': 400, 'ª': 370, 'º': 365, '€': 556, '·': 278, '©': 737, '§': 556, '½': 834, '¼': 834, '¾': 834 };

  function glyphWidth(ch, bold) {
    var code = ch.charCodeAt(0), t = bold ? W_BOLD : W_REG;
    if (code >= 32 && code <= 126) return t[code - 32];
    if (SPECIAL[ch] != null) return bold && (ch === '“' || ch === '”') ? 500 : SPECIAL[ch];
    var base = ch.normalize ? ch.normalize('NFD').charAt(0) : ch;
    if (/[ìíîïÌÍÎÏ]/.test(ch)) return 278;
    if (base && base !== ch) { var bc = base.charCodeAt(0); if (bc >= 32 && bc <= 126) return t[bc - 32]; }
    if (ch === 'ç') return t[99 - 32];
    if (ch === 'Ç') return t[67 - 32];
    return 556;
  }
  function textWidth(str, size, bold) {
    var w = 0;
    for (var i = 0; i < str.length; i++) w += glyphWidth(str.charAt(i), bold);
    return w * size / 1000;
  }

  /* ---------------- Codificação WinAnsi ---------------- */
  var WIN = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E,
    0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
  // Troca o que a Helvetica não tem por algo equivalente e tira emojis.
  function limpar(str) {
    return String(str == null ? '' : str)
      .replace(/→/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/[   ]/g, ' ')
      .replace(/[\uD800-\uDFFF️‍←-⇿☀-➿]/g, '').replace(/[\t\r\n]+/g, ' ');
  }
  function bytesWin(str) {
    var out = [];
    str = limpar(str);
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 128 || (c >= 0xA0 && c <= 0xFF)) out.push(c);
      else out.push(WIN[c] || 0x3F);
    }
    return out;
  }
  function hexWin(str) {
    var b = bytesWin(str), s = '<';
    for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16).toUpperCase();
    return s + '>';
  }
  // Texto da área "Info": UTF-16BE com marca de ordem (aceita qualquer acento).
  function hexUtf16(str) {
    var s = '<FEFF';
    str = String(str == null ? '' : str);
    for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); s += ('0000' + c.toString(16).toUpperCase()).slice(-4); }
    return s + '>';
  }

  function num(n) { return (Math.round(n * 100) / 100).toString(); }
  function rgb(c) { c = c || [0, 0, 0]; return num(c[0] / 255) + ' ' + num(c[1] / 255) + ' ' + num(c[2] / 255); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // Largura/altura/componentes de um JPEG (procura o marcador SOF).
  function infoJpeg(b) {
    if (!b || b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
    var i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      var m = b[i + 1];
      if (m === 0xFF) { i++; continue; }
      if ((m >= 0xC0 && m <= 0xCF) && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: b[i + 5] * 256 + b[i + 6], w: b[i + 7] * 256 + b[i + 8], n: b[i + 9] };
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      i += 2 + b[i + 2] * 256 + b[i + 3];
    }
    return null;
  }

  function criar(opts) {
    opts = opts || {};
    var M = opts.margem != null ? opts.margem : 42.5, FOOT = 30;
    var CW = PAGE.w - 2 * M, LIMIT = PAGE.h - M - FOOT;
    var C = { rosa: [160, 82, 109], rosaClaro: [252, 235, 241], texto: [48, 38, 43], cinza: [117, 103, 111], linha: [225, 205, 214], branco: [255, 255, 255], verde: [57, 134, 90], barra: [185, 103, 136], barra2: [217, 142, 170] };
    var pages = [], images = [], y = M;

    function page() { return pages[pages.length - 1]; }
    function novaPagina() { pages.push({ ops: [], imgs: {} }); y = M; }
    function precisa(h) { if (!pages.length) novaPagina(); if (y + h > LIMIT) { novaPagina(); return true; } return false; }
    function op(s) { page().ops.push(s); }

    function rect(x, top, w, h, cor) { op(rgb(cor) + ' rg ' + num(x) + ' ' + num(PAGE.h - top - h) + ' ' + num(w) + ' ' + num(h) + ' re f'); }
    function linhaH(x1, x2, top, cor, lw) { op(rgb(cor) + ' RG ' + num(lw || 0.6) + ' w ' + num(x1) + ' ' + num(PAGE.h - top) + ' m ' + num(x2) + ' ' + num(PAGE.h - top) + ' l S'); }
    function escreve(str, x, top, size, bold, cor) {
      if (!str) return;
      op('BT /' + (bold ? 'F2' : 'F1') + ' ' + num(size) + ' Tf ' + rgb(cor) + ' rg ' + num(x) + ' ' + num(PAGE.h - top - size * 0.92) + ' Td ' + hexWin(str) + ' Tj ET');
    }

    // Quebra o texto em linhas que cabem em "largura" pontos.
    function quebrar(str, largura, size, bold) {
      var paras = limpar(str).split(/\s*\n\s*/), out = [];
      limparParas(String(str == null ? '' : str)).forEach(function (par) {
        var words = par.split(' ').filter(Boolean), cur = '';
        if (!words.length) { out.push(''); return; }
        words.forEach(function (w) {
          var test = cur ? cur + ' ' + w : w;
          if (textWidth(test, size, bold) <= largura) { cur = test; return; }
          if (cur) { out.push(cur); cur = ''; }
          // palavra maior que a linha: corta por letras
          while (textWidth(w, size, bold) > largura && w.length > 1) {
            var k = w.length;
            while (k > 1 && textWidth(w.slice(0, k), size, bold) > largura) k--;
            out.push(w.slice(0, k)); w = w.slice(k);
          }
          cur = w;
        });
        if (cur) out.push(cur);
      });
      void paras;
      return out.length ? out : [''];
    }
    function limparParas(s) { return s.split(/\n/).map(function (p) { return limpar(p).replace(/\s+/g, ' ').trim(); }); }

    var api = {
      PAGE: PAGE, margem: M, largura: CW,
      get y() { return y; },

      espaco: function (h) { if (!pages.length) novaPagina(); y += h; if (y > LIMIT) novaPagina(); return api; },
      pagina: function () { novaPagina(); return api; },

      // Parágrafo (quebra de linha e de página automáticas).
      texto: function (str, o) {
        o = o || {};
        var size = o.tamanho || 10, bold = !!o.negrito, cor = o.cor || C.texto, lh = size * (o.entrelinha || 1.32);
        var x0 = M + (o.recuo || 0), larg = (o.largura || CW) - (o.recuo || 0);
        quebrar(str, larg, size, bold).forEach(function (ln) {
          precisa(lh);
          var w = textWidth(ln, size, bold), x = o.alinhar === 'center' ? x0 + (larg - w) / 2 : o.alinhar === 'right' ? x0 + larg - w : x0;
          escreve(ln, x, y, size, bold, cor);
          y += lh;
        });
        y += o.depois != null ? o.depois : 4;
        return api;
      },
      titulo: function (str, sub) {
        precisa(60);
        escreve(limpar(str), M, y, 22, true, C.rosa); y += 28;
        if (sub) { api.texto(sub, { tamanho: 10.5, cor: C.cinza, depois: 2 }); }
        linhaH(M, M + CW, y + 2, C.rosa, 1.2); y += 12;
        return api;
      },
      secao: function (str) {
        precisa(46);
        y += 8;
        rect(M, y, 3.2, 16, C.rosa);
        escreve(limpar(str), M + 9, y + 1, 13, true, C.rosa); y += 24;
        return api;
      },
      subsecao: function (str) { precisa(24); escreve(limpar(str), M, y, 10.5, true, C.texto); y += 17; return api; },
      linhaHorizontal: function () { precisa(8); linhaH(M, M + CW, y + 3, C.linha, 0.6); y += 8; return api; },

      // Cartões de números: [{ valor, rotulo, sub }]
      kpis: function (lista, o) {
        o = o || {};
        var cols = o.colunas || Math.min(4, lista.length || 1), gap = 8, bw = (CW - gap * (cols - 1)) / cols, bh = 46;
        for (var i = 0; i < lista.length; i += cols) {
          precisa(bh + 8);
          lista.slice(i, i + cols).forEach(function (k, j) {
            var x = M + j * (bw + gap);
            rect(x, y, bw, bh, C.rosaClaro);
            escreve(limpar(k.valor), x + 8, y + 7, 15, true, C.rosa);
            var rot = limpar(k.rotulo + (k.sub ? ' • ' + k.sub : ''));
            while (rot.length > 3 && textWidth(rot, 8, false) > bw - 14) rot = rot.slice(0, -2);
            escreve(rot, x + 8, y + 29, 8, false, C.cinza);
          });
          y += bh + 8;
        }
        return api;
      },

      // { colunas: [{ t, w, a }], linhas: [[...]], tamanho, zebra }
      tabela: function (o) {
        var cols = o.colunas, size = o.tamanho || 9, lh = size * 1.28, padX = 4, padY = 3.2;
        var soma = cols.reduce(function (a, c) { return a + (c.w || 1); }, 0);
        var ws = cols.map(function (c) { return CW * (c.w || 1) / soma; });
        function celulas(row, bold) { return row.map(function (v, i) { return quebrar(v == null ? '' : String(v), ws[i] - 2 * padX, size, bold); }); }
        function altura(cel) { return Math.max.apply(null, cel.map(function (l) { return l.length; })) * lh + 2 * padY; }
        function desenha(cel, top, h, bold, cor, fundo) {
          if (fundo) rect(M, top, CW, h, fundo);
          var x = M;
          cel.forEach(function (ls, i) {
            var al = cols[i].a || 'left';
            ls.forEach(function (ln, k) {
              var w = textWidth(ln, size, bold), tx = al === 'right' ? x + ws[i] - padX - w : al === 'center' ? x + (ws[i] - w) / 2 : x + padX;
              escreve(ln, tx, top + padY + k * lh, size, bold, cor);
            });
            x += ws[i];
          });
        }
        var head = celulas(cols.map(function (c) { return c.t; }), true), hh = altura(head);
        var rows = (o.linhas || []).map(function (r) { var c = celulas(r, false); return { cel: c, h: altura(c) }; });
        function cabecalho() { desenha(head, y, hh, true, C.branco, C.rosa); y += hh; }
        precisa(hh + (rows[0] ? rows[0].h : 0) + 2);
        cabecalho();
        rows.forEach(function (r, i) {
          if (y + r.h > LIMIT) { novaPagina(); cabecalho(); }
          desenha(r.cel, y, r.h, false, C.texto, o.zebra !== false && i % 2 === 1 ? C.rosaClaro : null);
          linhaH(M, M + CW, y + r.h, C.linha, 0.4);
          y += r.h;
        });
        if (!rows.length) { precisa(lh + 6); escreve('Sem registros no período.', M + padX, y + padY, size, false, C.cinza); y += lh + 2 * padY; }
        y += 8;
        return api;
      },

      // Gráfico de barras: { titulo, rotulos, valores, altura, cor, formato(v), meta }
      barras: function (o) {
        var h = o.altura || 110, n = o.valores.length;
        precisa(h + 36);
        if (o.titulo) { escreve(limpar(o.titulo), M, y, 9.5, true, C.texto); y += 15; }
        var top = y, base = top + h - 14, plotH = h - 28, left = M + 4, plotW = CW - 8;
        var max = Math.max.apply(null, o.valores.concat([o.meta || 0, 1e-9]));
        linhaH(M, M + CW, base, C.linha, 0.8);
        if (o.meta) { var ym = base - plotH * (o.meta / max); op(rgb(C.verde) + ' RG 0.8 w [3 2] 0 d ' + num(M) + ' ' + num(PAGE.h - ym) + ' m ' + num(M + CW) + ' ' + num(PAGE.h - ym) + ' l S [] 0 d'); escreve('meta ' + (o.formato ? o.formato(o.meta) : num(o.meta)), M + CW - 54, ym - 10, 7, false, C.verde); }
        var slot = plotW / Math.max(n, 1), bw = Math.min(slot * 0.62, 26), step = n > 16 ? Math.ceil(n / 16) : 1;
        o.valores.forEach(function (v, i) {
          var bh = Math.max(v > 0 ? 1 : 0, plotH * v / max), x = left + slot * i + (slot - bw) / 2;
          if (bh > 0) rect(x, base - bh, bw, bh, o.cor || C.barra);
          if (n <= 16 && v > 0) { var t = o.formato ? o.formato(v) : num(v); escreve(t, x + bw / 2 - textWidth(t, 6.5, false) / 2, base - bh - 8.5, 6.5, false, C.cinza); }
          if (i % step === 0 && o.rotulos && o.rotulos[i] != null) { var r = limpar(o.rotulos[i]); escreve(r, x + bw / 2 - textWidth(r, 6.5, false) / 2, base + 3, 6.5, false, C.cinza); }
        });
        y = top + h + 4;
        return api;
      },

      // Gráfico de linha: { titulo, rotulos, valores (null = sem dado), altura, cor, unidade }
      linha: function (o) {
        var h = o.altura || 100, pts = o.valores.map(function (v, i) { return v == null ? null : { v: v, i: i }; }).filter(Boolean);
        precisa(h + 36);
        if (o.titulo) { escreve(limpar(o.titulo), M, y, 9.5, true, C.texto); y += 15; }
        var top = y, base = top + h - 14, plotH = h - 30, left = M + 34, plotW = CW - 40;
        linhaH(left, M + CW, base, C.linha, 0.8);
        if (pts.length) {
          var min = Math.min.apply(null, pts.map(function (p) { return p.v; })), max = Math.max.apply(null, pts.map(function (p) { return p.v; }));
          if (max === min) { max += 1; min -= 1; } else { var pd = (max - min) * 0.12; max += pd; min -= pd; }
          var n = Math.max(o.valores.length - 1, 1);
          [0, 0.5, 1].forEach(function (f) {
            var yy = base - plotH * f, t = num(Math.round((min + (max - min) * f) * 10) / 10);
            linhaH(left, M + CW, yy, [240, 228, 234], 0.4);
            escreve(t, left - 4 - textWidth(t, 6.5, false), yy - 4, 6.5, false, C.cinza);
          });
          var xy = function (p) { return [left + plotW * p.i / n, base - plotH * (p.v - min) / (max - min)]; };
          var d = pts.map(function (p, k) { var q = xy(p); return num(q[0]) + ' ' + num(PAGE.h - q[1]) + (k ? ' l' : ' m'); }).join(' ');
          op(rgb(o.cor || C.rosa) + ' RG 1.5 w 1 j 1 J ' + d + ' S');
          pts.forEach(function (p) { var q = xy(p); rect(q[0] - 1.8, q[1] - 1.8, 3.6, 3.6, o.cor || C.rosa); });
          var last = pts[pts.length - 1], q2 = xy(last), lt = num(last.v) + (o.unidade ? ' ' + o.unidade : '');
          escreve(lt, Math.min(q2[0] - textWidth(lt, 7, true) / 2, M + CW - textWidth(lt, 7, true)), q2[1] - 11, 7, true, C.rosa);
          if (o.rotulos) {
            var a = limpar(o.rotulos[0] || ''), b = limpar(o.rotulos[o.rotulos.length - 1] || '');
            escreve(a, left, base + 3, 6.5, false, C.cinza);
            if (o.rotulos.length > 1) escreve(b, M + CW - textWidth(b, 6.5, false), base + 3, 6.5, false, C.cinza);
          }
        }
        y = top + h + 4;
        return api;
      },

      // [{ bytes (JPEG), largura, altura, legenda }] — até 2 por linha.
      imagens: function (lista, o) {
        o = o || {};
        var porLinha = lista.length > 1 ? 2 : 1, gap = 12, cellW = Math.min(o.largura || 230, (CW - gap * (porLinha - 1)) / porLinha);
        var itens = lista.map(function (im) {
          var inf = infoJpeg(im.bytes) || {}, w = im.largura || inf.w, h = im.altura || inf.h, n = inf.n || 3;
          var rw = cellW, rh = rw * h / w, maxH = o.alturaMax || 300;
          if (rh > maxH) { rh = maxH; rw = rh * w / h; }
          return { im: im, w: w, h: h, n: n, rw: rw, rh: rh };
        });
        var rowH = Math.max.apply(null, itens.map(function (i) { return i.rh; })) + 18;
        precisa(rowH + 6);
        itens.forEach(function (it, k) {
          var id = images.length + 1, name = 'Im' + id, x = M + k * (cellW + gap) + (cellW - it.rw) / 2;
          images.push({ id: id, bytes: it.im.bytes, w: it.w, h: it.h, n: it.n });
          page().imgs[name] = id;
          op('q ' + num(it.rw) + ' 0 0 ' + num(it.rh) + ' ' + num(x) + ' ' + num(PAGE.h - y - it.rh) + ' cm /' + name + ' Do Q');
          if (it.im.legenda) { var lg = limpar(it.im.legenda); escreve(lg, M + k * (cellW + gap) + (cellW - textWidth(lg, 8, false)) / 2, y + it.rh + 4, 8, false, C.cinza); }
        });
        y += rowH + 4;
        return api;
      },

      paginas: function () { return pages.length || 1; },

      /* ---------------- Montagem do arquivo ---------------- */
      gerar: function () {
        if (!pages.length) novaPagina();
        var total = pages.length, now = opts.data || new Date();
        // rodapé em todas as páginas
        pages.forEach(function (pg, i) {
          var top = PAGE.h - M + 4 - 6, right = 'Página ' + (i + 1) + ' de ' + total, rw = textWidth(right, 7.5, false), left = limpar(opts.rodape || '');
          pg.ops.push(rgb(C.linha) + ' RG 0.5 w ' + num(M) + ' ' + num(M + 10) + ' m ' + num(M + CW) + ' ' + num(M + 10) + ' l S');
          while (left.length > 3 && textWidth(left, 7, false) > CW - rw - 14) left = left.slice(0, -2);
          pg.ops.push('BT /F1 7 Tf ' + rgb(C.cinza) + ' rg ' + num(M) + ' ' + num(M - 2) + ' Td ' + hexWin(left) + ' Tj ET');
          pg.ops.push('BT /F1 7.5 Tf ' + rgb(C.cinza) + ' rg ' + num(M + CW - rw) + ' ' + num(M - 2) + ' Td ' + hexWin(right) + ' Tj ET');
          void top;
        });

        var chunks = [], offset = 0, offs = [];
        function push(x) { var u = typeof x === 'string' ? ascii(x) : x; chunks.push(u); offset += u.length; }
        function ascii(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }
        function obj(n, body) { offs[n] = offset; push(n + ' 0 obj\n' + body + '\nendobj\n'); }
        function stream(n, dict, data) { offs[n] = offset; push(n + ' 0 obj\n<< ' + dict + ' /Length ' + data.length + ' >>\nstream\n'); push(data); push('\nendstream\nendobj\n'); }

        var nImg = images.length, first = 6 + nImg; // 1 catálogo, 2 páginas, 3-4 fontes, 5 info, 6.. imagens, depois conteúdo+página
        var pageIds = pages.map(function (p, i) { return first + i * 2 + 1; });
        push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
        obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
        obj(2, '<< /Type /Pages /Kids [' + pageIds.map(function (id) { return id + ' 0 R'; }).join(' ') + '] /Count ' + total + ' >>');
        obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        var d = 'D:' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + pad2(now.getHours()) + pad2(now.getMinutes()) + pad2(now.getSeconds());
        obj(5, '<< /Title ' + hexUtf16(opts.titulo || 'Relatório') + ' /Author ' + hexUtf16(opts.autor || 'J.S.') + ' /Subject ' + hexUtf16(opts.assunto || '') +
          ' /Creator ' + hexUtf16('J.S.') + ' /Producer ' + hexUtf16('J.S. (gerador de PDF próprio)') + ' /CreationDate (' + d + ') >>');
        images.forEach(function (im, i) {
          stream(6 + i, '/Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /' + (im.n === 1 ? 'DeviceGray' : im.n === 4 ? 'DeviceCMYK' : 'DeviceRGB') +
            ' /BitsPerComponent 8 /Filter /DCTDecode' + (im.n === 4 ? ' /Decode [1 0 1 0 1 0 1 0]' : ''), im.bytes);
        });
        pages.forEach(function (pg, i) {
          var cid = first + i * 2, pid = cid + 1, xo = Object.keys(pg.imgs).map(function (k) { return '/' + k + ' ' + (5 + pg.imgs[k]) + ' 0 R'; }).join(' ');
          stream(cid, '', ascii(pg.ops.join('\n')));
          obj(pid, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(PAGE.w) + ' ' + num(PAGE.h) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' + (xo ? ' /XObject << ' + xo + ' >>' : '') + ' >> /Contents ' + cid + ' 0 R >>');
        });
        var count = first + total * 2, xrefAt = offset;
        push('xref\n0 ' + count + '\n0000000000 65535 f \n');
        for (var n = 1; n < count; n++) push(('0000000000' + offs[n]).slice(-10) + ' 00000 n \n');
        var idHex = ('00000000' + (xrefAt * 2654435761 >>> 0).toString(16)).slice(-8) + ('00000000' + (now.getTime() >>> 0).toString(16)).slice(-8);
        idHex = idHex + idHex;
        push('trailer\n<< /Size ' + count + ' /Root 1 0 R /Info 5 0 R /ID [<' + idHex + '> <' + idHex + '>] >>\nstartxref\n' + xrefAt + '\n%%EOF\n');
        var out = new Uint8Array(offset), p = 0;
        chunks.forEach(function (c) { out.set(c, p); p += c.length; });
        return out;
      }
    };
    return api;
  }

  return { criar: criar, PAGE: PAGE, medirTexto: textWidth, hexWin: hexWin, bytesWin: bytesWin, infoJpeg: infoJpeg, limpar: limpar };
});
