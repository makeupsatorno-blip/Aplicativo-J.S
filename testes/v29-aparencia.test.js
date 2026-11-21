/* J.S. 2.9 — aparência: paletas novas, contraste, estações do ano, letras e arquivos do modo offline.
   Rodar: node --test testes/v29-aparencia.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ler = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const css = ler('css/style.css') + '\n' + ler('css/delicado.css');
const html = ler('index.html');
const cfg = ler('js/telas/config.js');
const sw = ler('sw.js');

/* ---- helpers de CSS e de contraste (WCAG) ---- */
function vars(bloco) { const o = {}; bloco.replace(/(--[a-z0-9-]+):\s*([^;]+);/g, (m, k, v) => { o[k] = v.trim(); return m; }); return o; }
function blocos(seletor) {
  const re = new RegExp(seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  const out = []; let m; while ((m = re.exec(css))) out.push(m[1]);
  return out;
}
const hex = (c) => { const m = /^#([0-9a-f]{6})$/i.exec((c || '').trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
const lum = (rgb) => { const f = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const paradas = (g) => (g.match(/#[0-9a-f]{6}/gi) || []).map(hex);

const PALETAS = ['lavanda', 'pessego', 'nude', 'salvia', 'nevoa', 'cereja'];
const base = vars(blocos(':root')[0]);
function mapa(nome) { const b = blocos(':root[data-palette="' + nome + '"]'); return Object.assign({}, base, b.length ? vars(b.join('\n')) : {}); }

/* ---- lista de paletas: config.js, <head> e CSS têm que concordar ---- */
test('toda paleta da tela de Configurações existe no <head> e no CSS (e tem bolinha de cor)', () => {
  const lista = [...cfg.match(/var PALETTES = \[([\s\S]*?)\];/)[1].matchAll(/\['([a-z]+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(lista, ['rose', 'lavanda', 'pessego', 'nude', 'salvia', 'nevoa', 'cereja', 'estacoes']);
  const cores = [...html.match(/var THEME_COLORS = \{([\s\S]*?)\};/)[1].matchAll(/([a-z]+):\s*\[/g)].map((m) => m[1]);
  lista.filter((p) => p !== 'estacoes').forEach((p) => assert.ok(cores.includes(p), p + ' falta em THEME_COLORS'));
  PALETAS.forEach((p) => assert.ok(blocos(':root[data-palette="' + p + '"]').length === 1, p + ' sem bloco de cores no CSS'));
  lista.forEach((p) => {
    assert.ok(css.includes('.pal-' + p + ' .pal-dot'), p + ' sem .pal-dot');
    assert.ok(new RegExp('--pal-' + p + ':').test(css), p + ' sem --pal-' + p);
  });
});

test('cada paleta define todas as variáveis de cor, no claro e no escuro', () => {
  const chaves = ['rose50', 'rose100', 'rose200', 'rose300', 'rose400', 'rose600', 'rose700', 'rose800', 'bg', 'text', 'muted', 'border', 'topbar', 'accent', 'grad', 'glow', 'ring', 'bg-a', 'bg-b'];
  const so_claro = ['glow1', 'glow2'];
  const so_escuro = ['surface', 'on-accent'];
  ['salvia', 'nevoa', 'cereja'].forEach((p) => {
    const v = vars(blocos(':root[data-palette="' + p + '"]')[0]);
    chaves.concat(so_claro).forEach((k) => assert.ok(v['--l-' + k], p + ' sem --l-' + k));
    chaves.concat(so_escuro).forEach((k) => assert.ok(v['--d-' + k], p + ' sem --d-' + k));
  });
});

/* ---- contraste: texto >= 4,5:1 (AA); ícones >= 3:1 ---- */
test('contraste AA em todas as paletas, no claro e no escuro', () => {
  const falhas = [];
  ['rose'].concat(PALETAS).forEach((nome) => {
    const v = nome === 'rose' ? base : mapa(nome);
    const L = (k) => hex(v['--l-' + k]), D = (k) => hex(v['--d-' + k]), branco = [255, 255, 255];
    const pares = [
      ['claro texto/superfície', L('text'), branco, 4.5], ['claro texto/fundo', L('text'), L('bg'), 4.5],
      ['claro apoio/superfície', L('muted'), branco, 4.5], ['claro apoio/fundo', L('muted'), L('bg'), 4.5],
      ['claro destaque/superfície', L('accent'), branco, 4.5], ['claro branco/destaque', branco, L('accent'), 4.5],
      ['claro rose700/rose100', L('rose700'), L('rose100'), 4.5], ['claro rose800/rose50', L('rose800'), L('rose50'), 4.5],
      ['claro rose800/superfície', L('rose800'), branco, 4.5], ['claro rose700/superfície', L('rose700'), branco, 4.5], ['claro rose600/superfície (ícone)', L('rose600'), branco, 3],
      ['escuro texto/superfície', D('text'), D('surface'), 4.5], ['escuro texto/fundo', D('text'), D('bg'), 4.5],
      ['escuro apoio/superfície', D('muted'), D('surface'), 4.5], ['escuro apoio/fundo', D('muted'), D('bg'), 4.5],
      ['escuro destaque/superfície', D('accent'), D('surface'), 4.5], ['escuro botão/destaque', D('on-accent'), D('accent'), 4.5],
      ['escuro rose700/rose100', D('rose700'), D('rose100'), 4.5], ['escuro rose800/rose50', D('rose800'), D('rose50'), 4.5],
      ['escuro rose800/superfície', D('rose800'), D('surface'), 4.5], ['escuro rose700/superfície', D('rose700'), D('surface'), 4.5], ['escuro rose600/superfície (ícone)', D('rose600'), D('surface'), 3]
    ];
    paradas(v['--l-grad']).forEach((s, i) => pares.push(['claro branco/degradê ' + (i + 1), branco, s, 4.5]));
    paradas(v['--d-grad']).forEach((s, i) => pares.push(['escuro botão/degradê ' + (i + 1), D('on-accent'), s, 4.5]));
    pares.forEach(([desc, a, b, min]) => {
      if (!a || !b) return falhas.push(nome + ' ' + desc + ': cor ausente');
      const r = razao(a, b);
      if (r < min) falhas.push(nome + ' ' + desc + ': ' + r.toFixed(2) + ' < ' + min);
    });
  });
  assert.deepStrictEqual(falhas, []);
});

/* ---- <head>: estações, tema e letra ---- */
function rodarHead(settings, hoje) {
  const ini = html.indexOf('var THEME_COLORS');
  const fim = html.indexOf('window.JS_STYLE(s.fontPreset, s.deco);') + 'window.JS_STYLE(s.fontPreset, s.deco);'.length;
  assert.ok(ini > 0 && fim > ini, 'trecho do <head> não encontrado');
  const attrs = {}, metas = [{ a: { media: '(prefers-color-scheme: light)' }, c: '' }, { a: { media: '(prefers-color-scheme: dark)' }, c: '' }];
  metas.forEach((m) => { m.getAttribute = (k) => m.a[k] || null; m.setAttribute = (k, v) => { if (k === 'content') m.c = v; }; });
  const html_el = {
    classList: { add() {}, remove() {} },
    setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; }
  };
  const win = { requestAnimationFrame: () => 1, matchMedia: () => ({ matches: false }) };
  const doc = { documentElement: html_el, querySelectorAll: () => metas, querySelector: () => null };
  const RealDate = Date;
  const ctx = { window: win, document: doc, matchMedia: win.matchMedia, s: settings, setTimeout() {}, clearTimeout() {}, Date: class extends RealDate { constructor(...a) { super(...(a.length ? a : [hoje])); } } };
  vm.createContext(ctx);
  vm.runInContext(html.slice(ini, fim), ctx);
  return { attrs, metas, win };
}

test('Estações: troca de paleta conforme a data (hemisfério sul)', () => {
  const dia = (m, d) => new Date(2026, m - 1, d, 12);
  const quem = (m, d) => rodarHead({ palette: 'estacoes' }, dia(m, d)).attrs['data-palette'];
  assert.strictEqual(quem(1, 15), 'pessego');   // verão
  assert.strictEqual(quem(3, 19), 'pessego');
  assert.strictEqual(quem(3, 20), 'nude');      // outono
  assert.strictEqual(quem(6, 20), 'nude');
  assert.strictEqual(quem(6, 21), 'nevoa');     // inverno
  assert.strictEqual(quem(9, 21), 'nevoa');
  assert.strictEqual(quem(9, 22), 'salvia');    // primavera
  assert.strictEqual(quem(11, 21), 'salvia');
  assert.strictEqual(quem(12, 20), 'salvia');
  assert.strictEqual(quem(12, 21), 'pessego');
});

test('Estações guarda a escolha ("chosen") e a cor da barra do sistema acompanha a estação', () => {
  const r = rodarHead({ palette: 'estacoes', theme: 'dark' }, new Date(2026, 6, 10, 12)); // julho = inverno
  assert.strictEqual(r.win.JS_THEME_STATE.chosen, 'estacoes');
  assert.strictEqual(r.win.JS_THEME_STATE.palette, 'nevoa');
  assert.strictEqual(r.attrs['data-theme'], 'dark');
  assert.strictEqual(r.metas[0].c, '#171E26');
  // trocar de tema depois não perde a escolha
  const st = r.win.JS_THEME('light', r.win.JS_THEME_STATE.chosen);
  assert.strictEqual(st.chosen, 'estacoes');
  assert.strictEqual(r.attrs['data-theme'], 'light');
});

test('paletas fixas, valor inválido e rosé (sem atributo)', () => {
  assert.strictEqual(rodarHead({ palette: 'cereja' }, new Date(2026, 0, 1)).attrs['data-palette'], 'cereja');
  assert.strictEqual(rodarHead({ palette: 'rose' }, new Date(2026, 0, 1)).attrs['data-palette'], undefined);
  assert.strictEqual(rodarHead({ palette: 'xyz' }, new Date(2026, 0, 1)).attrs['data-palette'], undefined);
  assert.strictEqual(rodarHead({}, new Date(2026, 0, 1)).attrs['data-palette'], undefined);
});

test('letra dos títulos e detalhes florais: atributos no <html>', () => {
  let a = rodarHead({}, new Date(2026, 0, 1)).attrs;
  assert.strictEqual(a['data-font'], undefined);   // Delicada = padrão, sem atributo
  assert.strictEqual(a['data-deco'], undefined);   // florais ligados = sem atributo
  a = rodarHead({ fontPreset: 'manuscrita', deco: 'off' }, new Date(2026, 0, 1)).attrs;
  assert.strictEqual(a['data-font'], 'manuscrita');
  assert.strictEqual(a['data-deco'], 'off');
  a = rodarHead({ fontPreset: 'qualquer', deco: 'talvez' }, new Date(2026, 0, 1)).attrs;
  assert.strictEqual(a['data-font'], undefined);
  assert.strictEqual(a['data-deco'], undefined);
  ['elegante', 'suave'].forEach((f) => assert.strictEqual(rodarHead({ fontPreset: f }, new Date(2026, 0, 1)).attrs['data-font'], f));
});

test('as letras da tela de Configurações têm regra no CSS', () => {
  const lista = [...cfg.match(/var FONTS = \[([\s\S]*?)\];/)[1].matchAll(/\['([a-z]+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(lista, ['delicada', 'elegante', 'manuscrita', 'suave']);
  lista.forEach((f) => assert.ok(css.includes('.fo-' + f + ' .fopt-sample'), f + ' sem amostra no CSS'));
  ['elegante', 'manuscrita', 'suave'].forEach((f) => assert.ok(css.includes('html[data-font="' + f + '"]'), f + ' sem preset'));
});

/* ---- títulos usam variáveis, não itálico fixo ---- */
test('toda regra que usa a letra dos títulos lê --display-style e --display-k', () => {
  const ruins = [];
  ['css/style.css', 'css/v2.css', 'css/v26.css', 'css/jardim.css'].forEach((f) => {
    ler(f).split('\n').forEach((linha, i) => {
      if (!/font-family:\s*var\(--font-display/.test(linha)) return;
      if (!/font-style:\s*var\(--display-style/.test(linha)) ruins.push(f + ':' + (i + 1) + ' estilo fixo');
      if (/font-size:\s*[0-9.]+rem/.test(linha)) ruins.push(f + ':' + (i + 1) + ' tamanho fixo');
      if (!/--display-k/.test(linha)) ruins.push(f + ':' + (i + 1) + ' sem --display-k');
    });
  });
  assert.deepStrictEqual(ruins, []);
});

/* ---- arquivos ---- */
test('fontes novas existem (woff2), estão no @font-face e no cache offline do service worker', () => {
  const fam = { 'Playfair Display': 'playfair-display-latin.woff2', 'Dancing Script': 'dancing-script-latin.woff2', 'Quicksand': 'quicksand-latin.woff2' };
  const dc = ler('css/delicado.css');
  Object.keys(fam).forEach((nome) => {
    const arq = path.join(ROOT, 'fonts', fam[nome]);
    assert.ok(fs.existsSync(arq), fam[nome] + ' não existe');
    const buf = fs.readFileSync(arq);
    assert.strictEqual(buf.slice(0, 4).toString('latin1'), 'wOF2', fam[nome] + ' não é woff2');
    assert.ok(buf.length > 10000 && buf.length < 120000, fam[nome] + ' com tamanho estranho: ' + buf.length);
    assert.ok(dc.includes("font-family: '" + nome + "'") && dc.includes('fonts/' + fam[nome]), nome + ' sem @font-face');
    assert.ok(sw.includes("'./fonts/" + fam[nome] + "'"), fam[nome] + ' fora do cache offline');
  });
  assert.ok(sw.includes("'./css/delicado.css'"), 'delicado.css fora do cache offline');
  assert.ok(/<link rel="stylesheet" href="css\/delicado\.css">/.test(html), 'index.html não carrega o delicado.css');
  const links = [...html.matchAll(/<link rel="stylesheet" href="(css\/[a-z0-9]+\.css)">/g)].map((m) => m[1]);
  assert.strictEqual(links[links.length - 1], 'css/delicado.css', 'delicado.css precisa vir por último');
});

test('desligar os detalhes florais volta ao visual de antes (regras só valem sem data-deco="off")', () => {
  const dc = ler('css/delicado.css');
  const trecho = dc.slice(dc.indexOf('4. Detalhes florais'), dc.indexOf('5. Configurações'));
  // toda regra desse trecho que usa seletor de página precisa estar protegida; as exceções são só variáveis em :root
  const regras = trecho.split('}').map((r) => r.trim()).filter((r) => r && /\{/.test(r));
  const soltas = regras.filter((r) => {
    const sel = r.split('{')[0];
    if (/^@/.test(sel.trim()) || /^:root\b/.test(sel.trim()) || /^\/\*/.test(sel.trim())) return false;
    return !/data-deco="off"/.test(sel);
  }).map((r) => r.split('{')[0].trim().slice(0, 80));
  assert.deepStrictEqual(soltas.filter((s) => !/^\/\*/.test(s)), []);
});
