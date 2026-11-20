// Testes da versão 2.8 — frente "Dados": backup automático cifrado (cliente + servidor) e versões/lixeira.
// O servidor é testado de verdade: o trecho de supabase/functions/js-push/index.ts entre
// "<backup-auto:inicio>" e "<backup-auto:fim>" é lido, tem os tipos removidos e roda contra um banco de imitação.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripTypeScriptTypes } = require('node:module');
const B = require('../js/backup-auto.js');
const V = require('../js/versoes.js');

const NOW = '2026-11-20T15:00:00.000Z';
const MIN = 60000, H = 3600000, DAY = 86400000;

/* ---------------- Banco de imitação (só o que a função usa) ---------------- */

function fakeDb() {
  const T = { js_backup_parts: [], js_backup_heads: [], js_backup_usage: [] };
  const PK = { js_backup_parts: ['id', 'ver', 'part'], js_backup_heads: ['id', 'slot'], js_backup_usage: ['id'] };
  const calls = [];
  function from(table) {
    const filters = [];
    let op = 'select', payload = null, wantCount = false, headOnly = false, cols = null, lim = null, single = false;
    const q = {
      select(c, o) { cols = c && c !== '*' ? c.split(',').map((x) => x.trim()) : null; if (o && o.count) wantCount = true; if (o && o.head) headOnly = true; return q; },
      eq(c, v) { filters.push((r) => r[c] === v); return q; },
      lt(c, v) { filters.push((r) => r[c] < v); return q; },
      in(c, arr) { filters.push((r) => arr.includes(r[c])); return q; },
      not(c, o, v) { assert.equal(o, 'in'); const list = v.replace(/^\(|\)$/g, '').split(','); filters.push((r) => !list.includes(String(r[c]))); return q; },
      limit(n) { lim = n; return q; },
      maybeSingle() { single = true; return q; },
      delete() { op = 'delete'; return q; },
      upsert(rows, o) { op = 'upsert'; payload = Array.isArray(rows) ? rows : [rows]; assert.ok(o && o.onConflict, 'upsert precisa de onConflict'); return q; },
      then(res, rej) { try { res(run()); } catch (e) { (rej || ((x) => { throw x; }))(e); } }
    };
    function run() {
      calls.push(table + ':' + op);
      if (op === 'delete') { T[table] = T[table].filter((r) => !filters.every((f) => f(r))); return { error: null }; }
      if (op === 'upsert') {
        payload.forEach((p) => {
          const ex = T[table].find((r) => PK[table].every((k) => r[k] === p[k]));
          if (ex) Object.assign(ex, p);
          else T[table].push(Object.assign(table === 'js_backup_parts' ? { created_at: new Date().toISOString() } : {}, p));
        });
        return { error: null };
      }
      let out = T[table].filter((r) => filters.every((f) => f(r)));
      const count = out.length;
      if (lim != null) out = out.slice(0, lim);
      if (cols) out = out.map((r) => { const o = {}; cols.forEach((c) => { o[c] = r[c]; }); return o; });
      if (single) return { data: out[0] || null, error: null };
      return { data: headOnly ? null : out, count: wantCount ? count : null, error: null };
    }
    return q;
  }
  return { from, T, calls };
}

function loadServer(db) {
  const src = fs.readFileSync(path.join(__dirname, '../supabase/functions/js-push/index.ts'), 'utf8');
  const a = src.indexOf('// <backup-auto:inicio>'), b = src.indexOf('// <backup-auto:fim>');
  assert.ok(a > 0 && b > a, 'marcadores do backup automático no index.ts');
  const js = stripTypeScriptTypes(src.slice(a, b));
  const json = (body, status = 200) => ({ status, body });
  return new Function('db', 'json', js + '\nreturn { put: handleBackupPut, list: handleBackupList, get: handleBackupGet, del: handleBackupDelete, PARTS_MAX: BACKUP_PARTS_MAX, PUTS: BACKUP_PUTS_PER_DAY, DAYS: BACKUP_DAYS_KEPT };')(db, json);
}

const ID = 'a'.repeat(64), ID2 = 'b'.repeat(64);
const up = (n) => n.toString(16).padStart(16, '0');
// Envia um backup completo de "parts" pedaços (conteúdo falso em base64).
async function sendBackup(S, id, ver, parts, extra) {
  let last = null;
  for (let i = 0; i < parts; i++) last = await S.put(Object.assign({ id, up: ver, part: i, parts, data: Buffer.from('p' + i + ver).toString('base64') }, extra || {}));
  return last;
}

/* ---------------- Código, cifra e decisões (cliente) ---------------- */

test('código de recuperação: 16 caracteres, normaliza e valida', () => {
  const c = B.newCode();
  assert.equal(c.length, 16);
  assert.ok([...c].every((ch) => B.ALPHA.includes(ch)));
  assert.ok(B.valid(c));
  assert.match(B.pretty(c), /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.equal(B.normalize('k7p2 9qxm-4tzb.3hna'), 'K7P29QXM4TZB3HNA');
  assert.equal(B.normalize('OIL U'), '011V'); // letras parecidas
  assert.equal(B.valid('K7P2-9QXM-4TZB'), false);   // curto (12, que é o da transferência)
  assert.equal(B.valid('K7P2-9QXM-4TZB-3HN!'), false);
  assert.notEqual(B.newCode(), B.newCode());
});

test('cifra: ida e volta, código errado e dados adulterados falham, servidor só vê base64', async () => {
  const code = B.newCode();
  const obj = { app: 'J.S.', dados: { tasks: [{ id: 't1', title: 'Ligar para a mãe — ação ✓' }], n: 'x'.repeat(5000) } };
  const enc = await B.encrypt(obj, code);
  assert.match(enc.b64, /^[A-Za-z0-9+/=]+$/);
  assert.ok(!Buffer.from(enc.b64, 'base64').toString('latin1').includes('Ligar'), 'nada legível no que vai para o servidor');
  assert.ok(enc.bytes < 5000, 'comprimiu antes de cifrar');
  assert.deepEqual(await B.decrypt(enc.b64, code), obj);
  assert.deepEqual(await B.decrypt(enc.b64, B.pretty(code).toLowerCase()), obj); // minúsculas e traços valem
  await assert.rejects(() => B.decrypt(enc.b64, B.newCode()), (e) => e.code === 'codigo');
  const bad = Buffer.from(enc.b64, 'base64'); bad[bad.length - 3] ^= 1;
  await assert.rejects(() => B.decrypt(bad.toString('base64'), code), (e) => e.code === 'codigo');
  // duas cifras do mesmo conteúdo são diferentes (iv aleatório)
  assert.notEqual((await B.encrypt(obj, code)).b64, enc.b64);
});

test('id do servidor vem do código, é estável e não revela o código', async () => {
  const code = 'K7P29QXM4TZB3HNA';
  const a = await B.derive(code), b = await B.derive(B.pretty(code).toLowerCase());
  assert.equal(a.id, b.id);
  assert.match(a.id, /^[0-9a-f]{64}$/);
  assert.notEqual((await B.derive('K7P29QXM4TZB3HNB')).id, a.id);
  assert.ok(!a.id.includes(code.toLowerCase()));
});

test('pedaços: divide e junta sem perder nada', () => {
  const s = 'abcdefghij'.repeat(7);
  const parts = B.split(s, 25);
  assert.equal(parts.length, 3);
  assert.equal(parts.join(''), s);
  assert.deepEqual(B.split('', 10), ['']);
});

test('mudança: ignora a data do último backup (para não fazer backup em loop)', async () => {
  const d = { tasks: [{ id: 'a' }], settings: { name: 'Julia', lastBackupAt: '2026-11-19T10:00:00.000Z' } };
  const h1 = await B.sha256(B.hashText(d));
  const h2 = await B.sha256(B.hashText(Object.assign({}, d, { settings: { name: 'Julia', lastBackupAt: '2026-11-20T10:00:00.000Z' } })));
  const h3 = await B.sha256(B.hashText(Object.assign({}, d, { tasks: [{ id: 'a' }, { id: 'b' }] })));
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.notEqual(await B.sha256(B.hashText(d, 'f1:100')), h1); // fotos entram na conta quando incluídas
  assert.equal(d.settings.lastBackupAt, '2026-11-19T10:00:00.000Z', 'não altera o original');
});

test('resumo do backup: contagens e texto em português', () => {
  const sm = B.summarize({ workoutSessions: [{ status: 'done' }, { status: 'done' }, { status: 'active' }], workoutPlans: [{}], tasks: [{}, {}, {}], foodLogs: [{}], bills: [], savedMeals: [{}] }, [1, 2]);
  assert.deepEqual([sm.treinos, sm.fichas, sm.tarefas, sm.alimentos, sm.refeicoesSalvas, sm.fotos], [2, 1, 3, 1, 1, 2]);
  const t = B.summaryText(sm);
  assert.ok(t.includes('2 treinos feitos') && t.includes('1 ficha') && t.includes('3 tarefas') && t.includes('2 fotos do corpo'), t);
  assert.equal(B.summaryText(B.summarize({})), 'nenhum dado');
});

test('quando fazer backup: abrir (20 h), mudança (10 min + 3 h), erro (15 min) e manual', () => {
  const t0 = Date.parse(NOW);
  const ok = (ago) => ({ on: true, lastOkAt: t0 - ago });
  assert.equal(B.decide({ on: false }, t0, 'abrir').run, false);
  assert.equal(B.decide({ on: true }, t0, 'abrir').run, true, 'nunca fez: faz');
  assert.equal(B.decide(ok(21 * H), t0, 'abrir').run, true);
  assert.equal(B.decide(ok(21 * H), t0, 'voltar').run, true);
  const cedo = B.decide(ok(5 * H), t0, 'abrir');
  assert.equal(cedo.run, false);
  assert.ok(cedo.wait > 0, 'agenda para depois');
  // depois de mudanças: no mínimo 3 h desde o último e 10 min desde a última mudança
  assert.equal(B.decide(ok(2 * H), t0, 'mudanca', t0 - 20 * MIN).run, false);
  assert.equal(B.decide(ok(4 * H), t0, 'mudanca', t0 - 5 * MIN).run, false);
  assert.equal(B.decide(ok(4 * H), t0, 'mudanca', t0 - 11 * MIN).run, true);
  const w = B.decide(ok(1 * H), t0, 'mudanca', t0 - 20 * MIN);
  assert.ok(w.wait >= 2 * H - 1000 && w.wait <= 2 * H + 1000, 'espera o que falta dos 3 h: ' + w.wait);
  // erro recente: espera 15 min (menos no botão manual)
  assert.equal(B.decide({ on: true, lastOkAt: t0 - 30 * H, lastErrorAt: t0 - 5 * MIN }, t0, 'abrir').run, false);
  assert.equal(B.decide({ on: true, lastOkAt: t0 - 30 * H, lastErrorAt: t0 - 16 * MIN }, t0, 'abrir').run, true);
  assert.equal(B.decide({ on: true, lastOkAt: t0 - 30 * H, lastErrorAt: t0 - 5 * MIN }, t0, 'manual').run, true);
  // aviso de atraso
  assert.equal(B.stale(ok(8 * DAY), t0), true);
  assert.equal(B.stale(ok(6 * DAY), t0), false);
  assert.equal(B.stale({ on: true }, t0), false);
});

test('textos: tamanho e data', () => {
  assert.equal(B.kb(38 * 1024), '38 KB');
  assert.equal(B.kb(100), '1 KB');
  assert.equal(B.kb(2.5 * 1048576), '2,5 MB');
  const n = new Date(2026, 10, 20, 15, 0);
  assert.equal(B.when(new Date(2026, 10, 20, 14, 32).toISOString(), n), 'hoje 14:32');
  assert.equal(B.when(new Date(2026, 10, 19, 9, 5).toISOString(), n), 'ontem 09:05');
  assert.equal(B.when(new Date(2026, 10, 3, 18, 0).toISOString(), n), '03/11 18:00');
});

/* ---------------- Servidor (index.ts de verdade, banco de imitação) ---------------- */

test('servidor: envio completo vira "ultimo" e "dia", sem copiar partes', async () => {
  const db = fakeDb(), S = loadServer(db);
  const r1 = await S.put({ id: ID, up: up(1), part: 0, parts: 2, data: 'QUJD', dia: '2026-11-20', meta: 'v=2.8.0;f=0' });
  assert.deepEqual(r1.body, { ok: true, done: false });
  assert.equal(db.T.js_backup_heads.length, 0, 'ainda incompleto: nenhum ponteiro mudou');
  const r2 = await S.put({ id: ID, up: up(1), part: 1, parts: 2, data: 'REVG', dia: '2026-11-20', meta: 'v=2.8.0;f=0' });
  assert.equal(r2.body.done, true);
  assert.deepEqual(db.T.js_backup_heads.map((h) => h.slot).sort(), ['dia-2026-11-20', 'ultimo']);
  assert.ok(db.T.js_backup_heads.every((h) => h.ver === up(1) && h.parts === 2 && h.meta === 'v=2.8.0;f=0'));
  assert.equal(db.T.js_backup_parts.length, 2, 'as duas partes servem aos dois ponteiros');
  const list = await S.list({ id: ID });
  assert.equal(list.body.backups.length, 2);
  assert.equal(list.body.backups[0].slot, 'ultimo');
  assert.equal(list.body.backups[1].slot, 'dia-2026-11-20');
  assert.equal(list.body.backups[0].size, Math.floor(8 * 3 / 4));
  assert.deepEqual(Object.keys(list.body.backups[0]).sort(), ['created_at', 'meta', 'parts', 'size', 'slot']);
  const g0 = await S.get({ id: ID, slot: 'ultimo', part: 0 }), g1 = await S.get({ id: ID, slot: 'dia-2026-11-20', part: 1 });
  assert.equal(g0.body.data, 'QUJD');
  assert.equal(g1.body.data, 'REVG');
  assert.equal(g0.body.parts, 2);
});

test('servidor: envio interrompido nunca estraga o backup anterior', async () => {
  const db = fakeDb(), S = loadServer(db);
  await sendBackup(S, ID, up(1), 3, { dia: '2026-11-19' });
  // novo envio: só 2 dos 3 pedaços chegam
  await S.put({ id: ID, up: up(2), part: 0, parts: 3, data: 'WFhY', dia: '2026-11-20' });
  await S.put({ id: ID, up: up(2), part: 1, parts: 3, data: 'WVla', dia: '2026-11-20' });
  const list = await S.list({ id: ID });
  assert.deepEqual(list.body.backups.map((b) => b.slot).sort(), ['dia-2026-11-19', 'ultimo']);
  for (let p = 0; p < 3; p++) {
    const g = await S.get({ id: ID, slot: 'ultimo', part: p });
    assert.equal(Buffer.from(g.body.data, 'base64').toString(), 'p' + p + up(1), 'o último continua inteiro e da versão antiga');
  }
  // o envio é retomado e completa
  const done = await S.put({ id: ID, up: up(2), part: 2, parts: 3, data: 'WlpB', dia: '2026-11-20' });
  assert.equal(done.body.done, true);
  assert.equal((await S.get({ id: ID, slot: 'ultimo', part: 0 })).body.data, 'WFhY');
  assert.equal((await S.get({ id: ID, slot: 'dia-2026-11-19', part: 0 })).body.data !== 'WFhY', true, 'o dia anterior segue com a versão dele');
});

test('servidor: ficam o último e 7 dias; partes sem uso são apagadas depois de 1 hora', async () => {
  const db = fakeDb(), S = loadServer(db);
  for (let d = 1; d <= 10; d++) await sendBackup(S, ID, up(d), 1, { dia: '2026-11-' + String(d).padStart(2, '0') });
  const slots = db.T.js_backup_heads.map((h) => h.slot).sort();
  assert.deepEqual(slots, ['dia-2026-11-04', 'dia-2026-11-05', 'dia-2026-11-06', 'dia-2026-11-07', 'dia-2026-11-08', 'dia-2026-11-09', 'dia-2026-11-10', 'ultimo']);
  // as partes das versões velhas ainda são "recentes": só somem depois de 1 h (pode haver envio em andamento)
  assert.ok(db.T.js_backup_parts.length > 8);
  db.T.js_backup_parts.forEach((p) => { p.created_at = new Date(Date.now() - 2 * H).toISOString(); });
  await sendBackup(S, ID, up(11), 1, { dia: '2026-11-11' });
  const vers = new Set(db.T.js_backup_heads.map((h) => h.ver));
  assert.ok(db.T.js_backup_parts.every((p) => vers.has(p.ver)), 'só sobraram partes usadas por algum ponteiro');
  assert.equal(db.T.js_backup_parts.length, vers.size);
  // sem "dia": só atualiza o último
  const before = db.T.js_backup_heads.length;
  await sendBackup(S, ID, up(12), 1);
  assert.equal(db.T.js_backup_heads.length, before);
});

test('servidor: cada código tem os seus backups (não mistura)', async () => {
  const db = fakeDb(), S = loadServer(db);
  await sendBackup(S, ID, up(1), 1, { dia: '2026-11-20' });
  await sendBackup(S, ID2, up(2), 1, { dia: '2026-11-20' });
  assert.equal((await S.list({ id: ID })).body.backups.length, 2);
  assert.equal((await S.get({ id: ID2, slot: 'ultimo', part: 0 })).body.data, Buffer.from('p0' + up(2)).toString('base64'));
  assert.equal((await S.get({ id: 'c'.repeat(64), slot: 'ultimo', part: 0 })).status, 404);
  assert.deepEqual((await S.list({ id: 'c'.repeat(64) })).body.backups, []);
  const del = await S.del({ id: ID });
  assert.equal(del.body.ok, true);
  assert.deepEqual((await S.list({ id: ID })).body.backups, []);
  assert.equal(db.T.js_backup_parts.filter((p) => p.id === ID).length, 0);
  assert.equal(db.T.js_backup_usage.filter((u) => u.id === ID).length, 0);
  assert.equal((await S.list({ id: ID2 })).body.backups.length, 2, 'o outro código não foi tocado');
});

test('servidor: recusa entradas inválidas', async () => {
  const S = loadServer(fakeDb());
  const base = { id: ID, up: up(1), part: 0, parts: 1, data: 'QUJD' };
  const bad = async (patch, code) => { const r = await S.put(Object.assign({}, base, patch)); assert.equal(r.status, 400, JSON.stringify(patch)); assert.equal(r.body.error, code); };
  await bad({ id: 'xyz' }, 'invalid-id');
  await bad({ id: 'A'.repeat(64) }, 'invalid-id');          // maiúsculas
  await bad({ up: 'nope' }, 'invalid-up');
  await bad({ parts: 0 }, 'invalid-part');
  await bad({ parts: S.PARTS_MAX + 1 }, 'invalid-part');
  await bad({ part: 1, parts: 1 }, 'invalid-part');
  await bad({ part: -1 }, 'invalid-part');
  await bad({ part: 1.5, parts: 3 }, 'invalid-part');
  await bad({ data: '' }, 'invalid-data');
  await bad({ data: 'não é base64!' }, 'invalid-data');
  await bad({ data: 'A'.repeat(1_100_001) }, 'invalid-data');
  await bad({ data: 123 }, 'invalid-data');
  assert.equal((await S.list({ id: 'x' })).status, 400);
  assert.equal((await S.get({ id: ID, slot: 'x', part: 0 })).status, 400);
  assert.equal((await S.get({ id: ID, slot: 'ultimo', part: 99 })).status, 400);
  assert.equal((await S.del({ id: '' })).status, 400);
  // "dia" inválido é ignorado (só grava o último); meta com caracteres estranhos some
  const db = fakeDb(), S2 = loadServer(db);
  await S2.put(Object.assign({}, base, { dia: '20-11-2026', meta: '<script>alert(1)</script>' }));
  assert.deepEqual(db.T.js_backup_heads.map((h) => h.slot), ['ultimo']);
  assert.equal(db.T.js_backup_heads[0].meta, '');
});

test('servidor: no máximo 40 envios por dia por código', async () => {
  const db = fakeDb(), S = loadServer(db);
  for (let i = 0; i < S.PUTS; i++) assert.equal((await S.put({ id: ID, up: up(i + 1), part: 0, parts: 1, data: 'QUJD' })).body.ok, true);
  const r = await S.put({ id: ID, up: up(999), part: 0, parts: 1, data: 'QUJD' });
  assert.equal(r.status, 429);
  assert.equal(r.body.error, 'limite-diario');
  // outro código não é afetado; outro dia zera
  assert.equal((await S.put({ id: ID2, up: up(1), part: 0, parts: 1, data: 'QUJD' })).body.ok, true);
  db.T.js_backup_usage.find((u) => u.id === ID).day = '2020-01-01';
  assert.equal((await S.put({ id: ID, up: up(1000), part: 0, parts: 1, data: 'QUJD' })).body.ok, true);
  // pedaços seguintes do mesmo envio não contam como envio novo
  const db2 = fakeDb(), S2 = loadServer(db2);
  await S2.put({ id: ID, up: up(1), part: 0, parts: 3, data: 'QUJD' });
  await S2.put({ id: ID, up: up(1), part: 1, parts: 3, data: 'QUJD' });
  await S2.put({ id: ID, up: up(1), part: 2, parts: 3, data: 'QUJD' });
  assert.equal(db2.T.js_backup_usage[0].puts, 1);
});

test('servidor: códigos sem atividade há 180 dias são apagados; os ativos ficam', async () => {
  const db = fakeDb(), S = loadServer(db);
  await sendBackup(S, ID2, up(7), 1, { dia: '2026-05-01' });
  db.T.js_backup_usage.find((u) => u.id === ID2).last_seen = new Date(Date.now() - 181 * DAY).toISOString();
  await sendBackup(S, ID, up(1), 1, { dia: '2026-11-20' }); // a limpeza roda no início de um envio novo
  assert.equal(db.T.js_backup_heads.filter((h) => h.id === ID2).length, 0);
  assert.equal(db.T.js_backup_parts.filter((p) => p.id === ID2).length, 0);
  assert.equal(db.T.js_backup_usage.filter((u) => u.id === ID2).length, 0);
  assert.equal(db.T.js_backup_heads.filter((h) => h.id === ID).length, 2);
  // listar também conta como atividade
  db.T.js_backup_usage.find((u) => u.id === ID).last_seen = new Date(Date.now() - 170 * DAY).toISOString();
  await S.list({ id: ID });
  assert.ok(Date.now() - Date.parse(db.T.js_backup_usage.find((u) => u.id === ID).last_seen) < 5000);
});

test('servidor: trava geral da tabela', async () => {
  const db = fakeDb(), S = loadServer(db);
  for (let i = 0; i < 1500; i++) db.T.js_backup_parts.push({ id: 'd'.repeat(64), ver: up(i), part: 0, data: 'x', size: 1, created_at: new Date().toISOString() });
  const r = await S.put({ id: ID, up: up(1), part: 0, parts: 1, data: 'QUJD' });
  assert.equal(r.status, 429);
  assert.equal(r.body.error, 'ocupado');
});

test('servidor: fluxo completo com os dados cifrados de verdade (cliente + servidor)', async () => {
  const db = fakeDb(), S = loadServer(db);
  const code = B.newCode(), d = await B.derive(code);
  const obj = { app: 'J.S.', dados: { tasks: [{ id: 't', title: 'Minha tarefa' }], blob: Array.from({ length: 4000 }, (_, i) => 'item-' + i * 7919).join(',') } };
  const enc = await B.encrypt(obj, code);
  const parts = B.split(enc.b64, Math.ceil(enc.b64.length / 5)); // 5 pedaços
  assert.equal(parts.length, 5);
  const ver = B.randomHex(16);
  for (let i = 0; i < parts.length; i++) await S.put({ id: d.id, up: ver, part: i, parts: parts.length, data: parts[i], dia: '2026-11-20', meta: 'v=2.8.0;f=0' });
  const list = (await S.list({ id: d.id })).body.backups;
  assert.equal(list.length, 2);
  const got = [];
  for (let i = 0; i < list[0].parts; i++) got.push((await S.get({ id: d.id, slot: 'ultimo', part: i })).body.data);
  assert.deepEqual(await B.decrypt(got.join(''), code), obj);
  // um código errado nem acha o backup
  const other = await B.derive(B.newCode());
  assert.deepEqual((await S.list({ id: other.id })).body.backups, []);
});

test('SQL: tabelas fechadas para o público e idempotentes', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/sql/05_backup_auto.sql'), 'utf8');
  ['js_backup_parts', 'js_backup_heads', 'js_backup_usage'].forEach((t) => {
    assert.ok(new RegExp('create table if not exists public\\.' + t).test(sql), t);
    assert.ok(new RegExp('alter table public\\.' + t + ' enable row level security').test(sql), 'RLS em ' + t);
    assert.ok(sql.includes(t) && /revoke all on[^;]*anon, authenticated/.test(sql));
  });
  assert.ok(/grant select, insert, update, delete on[^;]*to service_role/.test(sql));
  assert.ok(!/drop table/i.test(sql));
  // as colunas que a função usa existem
  ['ver text', 'part integer', 'data text', 'size integer', 'created_at timestamptz', 'slot text', 'parts integer', 'meta text', 'last_seen timestamptz', 'day date', 'puts integer'].forEach((c) => assert.ok(sql.includes(c), c));
});

/* ---------------- Versões e lixeira ---------------- */

function baseState() {
  return {
    tasks: [{ id: 't1', title: 'Ligar para a mãe', dueDate: '2026-11-20', dueTime: '15:00', recurrence: 'none' }, { id: 't2', title: 'Comprar flores' }],
    taskOcc: { 't1|2026-11-20': { status: 'done' }, 't2|2026-11-21': { status: 'done' } },
    workoutSessions: [
      { id: 's1', status: 'done', date: '2026-11-18', planName: 'Inferior', items: [{ sets: [{}, {}, {}] }] },
      { id: 's2', status: 'active', date: '2026-11-20', planName: 'Superior', items: [] }
    ],
    workoutPlans: [{ id: 'p1', name: 'Treino A', items: [{}, {}] }],
    savedMeals: [{ id: 'm1', name: 'Meu café', items: [{ foodId: 'x', grams: 50 }] }],
    foodLogs: [{ id: 'f1', name: 'Ovo, de galinha', grams: 100, date: '2026-11-20', meal: 'breakfast' }],
    bills: [{ id: 'b1', title: 'Luz', amountCents: 15000, dueDate: '2026-11-25' }],
    payments: [{ id: 'pay1', billId: 'b1', amountCents: 15000 }],
    bodyRecords: [{ id: 'r1', date: '2026-11-19', weightKg: 62.4 }],
    hairEvents: [{ id: 'h1', type: 'hydration', date: '2026-11-22', time: '10:00' }],
    meals: [{ id: 'ml1', name: 'Almoço', time: '12:00' }],
    mealExceptions: { 'ml1|2026-11-21': { skip: true } },
    cyclePeriods: [{ id: 'c1', start: '2026-11-01', end: '2026-11-05' }]
  };
}
const clone = (o) => JSON.parse(JSON.stringify(o));

test('lixeira: mostra só o que existia e sumiu (com texto legível)', () => {
  const old = baseState(), cur = clone(old);
  assert.deepEqual(V.diff(old, cur), []);
  cur.tasks = cur.tasks.filter((t) => t.id !== 't1');
  cur.foodLogs = [];
  cur.workoutSessions = cur.workoutSessions.filter((s) => s.id !== 's1');
  cur.bills = [];
  cur.cyclePeriods = [];
  const g = V.diff(old, cur), by = (k) => g.find((x) => x.key === k);
  assert.deepEqual(g.map((x) => x.key), ['tasks', 'workoutSessions', 'foodLogs', 'bills', 'cyclePeriods']);
  assert.equal(by('tasks').items[0].title, 'Ligar para a mãe');
  assert.equal(by('tasks').items[0].sub, 'para 20/11/2026 às 15:00');
  assert.equal(by('workoutSessions').items[0].title, 'Inferior — 18/11/2026');
  assert.equal(by('workoutSessions').items[0].sub, '3 séries');
  assert.equal(by('foodLogs').items[0].title, 'Ovo');
  assert.ok(by('foodLogs').items[0].sub.includes('100 g') && by('foodLogs').items[0].sub.includes('Café da manhã'));
  assert.ok(by('bills').items[0].sub.includes('vence 25/11/2026'));
  assert.equal(by('cyclePeriods').items[0].title, 'Menstruação de 01/11/2026');
  assert.equal(V.total(g), 5);
  // item novo (que não existia na versão) não aparece; treino em andamento da versão não conta
  cur.tasks.push({ id: 'novo', title: 'Nova' });
  cur.workoutSessions = [];
  const g2 = V.diff(old, cur);
  assert.ok(!g2.find((x) => x.key === 'tasks').items.some((i) => i.id === 'novo'));
  assert.deepEqual(g2.find((x) => x.key === 'workoutSessions').items.map((i) => i.id), ['s1'], 's2 (em andamento) não conta');
});

test('lixeira: recuperar traz o item com o mesmo id, junto do que é dele, sem duplicar', () => {
  const old = baseState(), cur = clone(old);
  cur.tasks = cur.tasks.filter((t) => t.id !== 't1'); delete cur.taskOcc['t1|2026-11-20'];
  cur.bills = []; cur.payments = [];
  cur.meals = []; delete cur.mealExceptions['ml1|2026-11-21'];
  const g = V.diff(old, cur);
  const task = g.find((x) => x.key === 'tasks').items[0], bill = g.find((x) => x.key === 'bills').items[0], meal = g.find((x) => x.key === 'meals').items[0];
  assert.equal(V.recover(cur, 'tasks', task.raw, old), true);
  assert.ok(cur.tasks.some((t) => t.id === 't1' && t.title === 'Ligar para a mãe'));
  assert.deepEqual(cur.taskOcc['t1|2026-11-20'], { status: 'done' }, 'a tarefa concluída volta concluída');
  assert.equal(V.recover(cur, 'tasks', task.raw, old), false, 'não duplica');
  assert.equal(cur.tasks.filter((t) => t.id === 't1').length, 1);
  assert.equal(V.recover(cur, 'bills', bill.raw, old), true);
  assert.deepEqual(cur.payments.map((p) => p.id), ['pay1'], 'os pagamentos da conta voltam');
  assert.equal(V.recover(cur, 'meals', meal.raw, old), true);
  assert.ok(cur.mealExceptions['ml1|2026-11-21']);
  assert.equal(V.recover(cur, 'inexistente', task.raw, old), false);
  // o que voltou não é mais "apagado"
  assert.equal(V.diff(old, cur).length, 0);
  // não mexe no original da versão
  old.tasks[0].title = 'mudou depois';
  assert.equal(cur.tasks.find((t) => t.id === 't1').title, 'Ligar para a mãe');
});

test('retenção: 14 dias, segurança por 30 dias (até 10) e limite de espaço', () => {
  const m = (id, kind, date, size) => ({ id, kind, date, at: date + 'T10:00:00.000Z', size: size || 100 });
  const today = '2026-11-20';
  const metas = [m('dia-2026-11-20', 'dia', '2026-11-20'), m('dia-2026-11-06', 'dia', '2026-11-06'), m('dia-2026-11-05', 'dia', '2026-11-05'),
    m('seg-1', 'seguranca', '2026-10-25'), m('seg-2', 'seguranca', '2026-10-15'), m('seg-3', 'seguranca', '2026-11-10')];
  assert.deepEqual(V.pruneIds(metas, today).sort(), ['dia-2026-11-05', 'seg-2']);  // 15 dias e 36 dias
  const muitas = Array.from({ length: 13 }, (_, i) => m('seg-' + i, 'seguranca', '2026-11-' + String(10 + (i % 10)).padStart(2, '0')));
  muitas.forEach((x, i) => { x.at = '2026-11-15T10:' + String(i).padStart(2, '0') + ':00.000Z'; });
  assert.equal(V.pruneIds(muitas, today).length, 3, 'só as 10 mais novas');
  // espaço: apaga as mais antigas primeiro, nunca a foto do dia mais nova
  const grandes = [m('dia-2026-11-20', 'dia', '2026-11-20', 15), m('dia-2026-11-19', 'dia', '2026-11-19', 15), m('dia-2026-11-18', 'dia', '2026-11-18', 15)];
  assert.deepEqual(V.pruneIds(grandes, today, { maxBytes: 30 }), ['dia-2026-11-18']);
  assert.deepEqual(V.pruneIds(grandes, today, { maxBytes: 1 }).sort(), ['dia-2026-11-18', 'dia-2026-11-19']);
});

test('compressão local: ida e volta', async () => {
  const o = { a: 'ç ã é ✓', n: Array.from({ length: 500 }, (_, i) => i) };
  const bytes = await V.pack(o);
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual(await V.unpack(bytes), o);
});

test('repositório: foto do dia (1 por dia), proteção do que foi apagado e atualização segura', async () => {
  const repo = V.createRepo(V.memoryBackend());
  const d0 = baseState();
  assert.equal(await repo.ensureDaily(d0, '2026-11-20', '2026-11-20T08:00:00.000Z'), 'nova');
  assert.equal(await repo.ensureDaily(d0, '2026-11-20', '2026-11-20T08:10:00.000Z'), 'recente');         // menos de 30 min
  // criou algo e nada foi apagado: atualiza a foto, que passa a ter o item novo
  const d1 = clone(d0); d1.tasks.push({ id: 't3', title: 'Nova' });
  assert.equal(await repo.ensureDaily(d1, '2026-11-20', '2026-11-20T09:00:00.000Z'), 'atualizada');
  assert.ok((await repo.load('dia-2026-11-20')).tasks.some((t) => t.id === 't3'));
  assert.equal(await repo.ensureDaily(d1, '2026-11-20', '2026-11-20T10:00:00.000Z'), 'igual');
  // apagou uma tarefa: a foto fica como está (ela protege o que foi apagado) mesmo se criou outra coisa
  const d2 = clone(d1); d2.tasks = d2.tasks.filter((t) => t.id !== 't1'); d2.tasks.push({ id: 't4', title: 'Outra' });
  assert.equal(await repo.ensureDaily(d2, '2026-11-20', '2026-11-20T11:00:00.000Z'), 'protegendo');
  const r = await repo.recoverable(d2, '2026-11-20T11:30:00.000Z', 7);
  assert.equal(r.total, 1);
  assert.equal(r.groups[0].items[0].title, 'Ligar para a mãe');
  assert.equal(r.groups[0].items[0].snapId, 'dia-2026-11-20');
  // uma foto por dia
  assert.equal(await repo.ensureDaily(d2, '2026-11-21', '2026-11-21T08:00:00.000Z'), 'nova');
  const list = await repo.list();
  assert.deepEqual(list.map((m) => m.id), ['dia-2026-11-21', 'dia-2026-11-20']);
  assert.equal(list[1].counts.treinos, 1);
  assert.ok(V.countsText(list[1].counts).includes('1 treino'));
});

test('repositório: cópia de segurança, união dos últimos 7 dias e limpeza', async () => {
  const repo = V.createRepo(V.memoryBackend());
  const old = baseState();
  await repo.ensureDaily(old, '2026-11-10', '2026-11-10T08:00:00.000Z');          // 10 dias atrás: fora dos 7 dias
  const dia15 = clone(old); dia15.tasks.push({ id: 'só-no-15', title: 'Do dia 15' });
  await repo.ensureDaily(dia15, '2026-11-15', '2026-11-15T08:00:00.000Z');
  await repo.security(clone(old), 'antes de apagar tudo', '2026-11-18', '2026-11-18T09:00:00.000Z');
  const cur = { tasks: [], workoutSessions: [], foodLogs: [] };                    // "apagou tudo"
  const r = await repo.recoverable(cur, '2026-11-20T10:00:00.000Z', 7);
  const tasks = r.groups.find((g) => g.key === 'tasks').items.map((i) => i.id).sort();
  assert.deepEqual(tasks, ['só-no-15', 't1', 't2'], 'une as versões dos 7 dias, sem a de 10 dias atrás');
  assert.equal(r.groups.find((g) => g.key === 'tasks').items.find((i) => i.id === 't1').snapId.indexOf('seg-'), 0, 'vale a foto mais nova que ainda tem o item');
  assert.equal((await repo.recoverable(cur, '2026-11-20T10:00:00.000Z', 30, 'dia-2026-11-10')).groups.find((g) => g.key === 'tasks').items.length, 2, 'só uma versão');
  // limpeza ao passar o tempo
  await repo.ensureDaily(cur, '2026-12-05', '2026-12-05T08:00:00.000Z');
  const ids = (await repo.list()).map((m) => m.id);
  assert.ok(!ids.includes('dia-2026-11-10') && !ids.includes('dia-2026-11-15'), 'fotos do dia com mais de 14 dias saíram: ' + ids);
  assert.ok(ids.some((i) => i.indexOf('seg-') === 0), 'a de segurança (30 dias) ainda está');
});
