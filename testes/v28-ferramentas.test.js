// Testes da versão 2.8 (frente D): adicionar escrevendo/falando, gerador de PDF, relatório e exportação .ics.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const R = require('../js/regras.js');
const T = require('../js/regras-treino.js');
const N = require('../js/regras-nutricao.js');
const Y = require('../js/regras-ciclo.js');
const F = require('../js/falar.js');
const P = require('../js/pdf.js');
const I = require('../js/ics.js');
const Rel = require('../js/relatorio.js');

const SEXTA = new Date(2026, 10, 20, 10, 30); // sexta, 20/11/2026, 10h30
const NOW = SEXTA.toISOString();
const lista = (txt, s, d) => F.interpretar(txt, d || SEXTA, s || R.emptyState());
const topo = (txt, s, d) => lista(txt, s, d)[0];
const todos = (txt, s, d) => lista(txt, s, d);

/* ======================= Falar: água, peso, energia, treino ======================= */

test('falar: água em ml, litros, copos e meio litro', () => {
  assert.deepEqual([topo('bebi 300 ml').tipo, topo('bebi 300 ml').dados.ml], ['agua', 300]);
  assert.equal(topo('1 copo de água').dados.ml, 250);
  assert.equal(topo('tomei 2 copos').dados.ml, 500);
  assert.equal(topo('meio litro de agua').dados.ml, 500);
  assert.equal(topo('1,5 l de água').dados.ml, 1500);
  assert.equal(topo('bebi dois litros de água').dados.ml, 2000);
  assert.equal(topo('BEBI 300 ML DE ÁGUA').dados.ml, 300);
  assert.equal(topo('bebi um copo e meio de água').tipo === 'agua' ? 1 : 0, 1);
  const s = R.emptyState(); s.settings.water.cupMl = 330;
  assert.equal(topo('bebi 1 copo de água', s).dados.ml, 330, 'o copo é o escolhido nas configurações');
  assert.equal(topo('bebi 2 copos', s).dados.ml, 660);
  assert.equal(topo('bebi 300 ml').dados.data, '2026-11-20');
  assert.equal(topo('bebi 300 ml de água ontem').dados.data, '2026-11-19');
  assert.ok(topo('bebi 300 ml').confianca >= 0.5);
});

test('falar: suco e leite não viram água', () => {
  const t = topo('bebi suco de laranja 300 ml');
  assert.equal(t.tipo, 'alimento');
  assert.equal(t.dados.itens[0].gramas, 300);
  assert.match(t.dados.itens[0].nome, /Laranja/);
  assert.equal(topo('tomei leite 200 ml').tipo, 'alimento');
  assert.ok(!todos('tomei leite 200 ml').some((x) => x.tipo === 'agua'));
});

test('falar: peso', () => {
  assert.equal(topo('peso 62,4').dados.kg, 62.4);
  assert.equal(topo('pesei 62,4 kg').tipo, 'peso');
  assert.equal(topo('hoje o peso deu 70 kg').dados.kg, 70);
  assert.ok(!todos('peso 15').some((x) => x.tipo === 'peso'), 'valor fora de 20 a 400 kg não vale');
  assert.equal(topo('pesei 61,8 ontem').dados.data, '2026-11-19');
});

test('falar: energia só com o ciclo ligado', () => {
  const s = R.emptyState();
  assert.ok(!todos('energia 4', s).some((x) => x.tipo === 'energia'));
  assert.ok(!todos('estou cansada', s).some((x) => x.tipo === 'energia'));
  Y.savePeriod(s, null, { start: '2026-11-10', end: '2026-11-14' }, NOW);
  assert.equal(topo('energia 4', s).dados.energia, 4);
  assert.equal(topo('estou cansada hoje', s).dados.energia, 2);
  assert.equal(topo('estou exausta', s).dados.energia, 1);
  assert.equal(topo('me sinto super disposta', s).dados.energia, 5);
});

test('falar: começar treino', () => {
  assert.equal(topo('começar treino').tipo, 'treino');
  assert.equal(topo('bora treinar agora').tipo, 'treino');
  assert.equal(topo('vou iniciar o treino').tipo, 'treino');
});

/* ======================= Falar: tarefas, datas e horas ======================= */

test('falar: tarefa com data e hora', () => {
  const t = topo('tarefa ligar para a mãe amanhã às 15h');
  assert.equal(t.tipo, 'tarefa');
  assert.deepEqual([t.dados.titulo, t.dados.data, t.dados.hora, t.dados.lembrete, t.dados.recorrencia], ['Ligar para a mãe', '2026-11-21', '15:00', 15, 'none']);
  assert.match(t.resumo, /^Entendi: tarefa “Ligar para a mãe” • amanhã/);
  assert.ok(t.confianca >= 0.85);
});

test('falar: dia do mês, dia da semana e datas relativas', () => {
  assert.equal(topo('me lembra de pagar o aluguel dia 5').dados.data, '2026-12-05');          // o dia 5 deste mês já passou
  assert.equal(topo('me lembre de pagar o iptu dia 25').dados.data, '2026-11-25');
  assert.equal(topo('preciso comprar flores sexta').dados.data, '2026-11-27');                  // hoje é sexta: a próxima
  assert.equal(topo('preciso comprar flores sábado').dados.data, '2026-11-21');
  assert.equal(topo('tarefa estudar na terça-feira').dados.data, '2026-11-24');
  assert.equal(topo('tarefa dentista segunda que vem').dados.data, '2026-11-23');
  assert.equal(topo('tarefa revisar depois de amanhã').dados.data, '2026-11-22');
  assert.equal(topo('tarefa revisar daqui a 3 dias').dados.data, '2026-11-23');
  assert.equal(topo('tarefa fechar relatório semana que vem').dados.data, '2026-11-27');
  assert.equal(topo('tarefa viajar 25 de dezembro').dados.data, '2026-12-25');
  assert.equal(topo('tarefa viajar dia 25 de dezembro').dados.data, '2026-12-25');
  assert.equal(topo('tarefa viajar 25/12').dados.data, '2026-12-25');
  assert.equal(topo('tarefa aniversário 02/03').dados.data, '2027-03-02');                      // já passou em 2026: ano que vem
  assert.equal(topo('tarefa hoje arrumar a gaveta').dados.data, '2026-11-20');
});

test('falar: horas escritas de vários jeitos', () => {
  assert.equal(topo('tarefa reunião amanhã às 9h30').dados.hora, '09:30');
  assert.equal(topo('tarefa reunião amanhã 15:45').dados.hora, '15:45');
  assert.equal(topo('tarefa yoga amanhã às 7 da manhã').dados.hora, '07:00');
  assert.equal(topo('tarefa jantar às 8 da noite').dados.hora, '20:00');
  assert.equal(topo('tarefa dentista 3 da tarde').dados.hora, '15:00');
  assert.equal(topo('tarefa almoço ao meio-dia').dados.hora, '12:00');
  assert.equal(topo('tarefa dormir meia noite').dados.hora, '00:00');
  assert.equal(topo('tarefa ligar às 14').dados.hora, '14:00');
  assert.equal(topo('tarefa ligar para a vó sem hora').dados.hora, null);
  assert.equal(topo('tarefa x amanhã').dados.lembrete, null, 'sem hora, sem lembrete');
});

test('falar: tarefas que se repetem', () => {
  const d = topo('todo dia tomar vitamina às 8').dados;
  assert.deepEqual([d.titulo, d.recorrencia, d.hora, d.data], ['Tomar vitamina', 'daily', '08:00', '2026-11-20']);
  const w = topo('toda segunda e quarta treinar às 7h').dados;
  assert.deepEqual([w.titulo, w.recorrencia, w.diasSemana, w.data, w.hora], ['Treinar', 'weekly', [1, 3], '2026-11-23', '07:00']);
  assert.deepEqual(topo('todas as sextas pagar a faxineira').dados.diasSemana, [5]);
  assert.equal(topo('toda sexta pagar a faxineira').dados.data, '2026-11-20', 'a recorrência semanal vale a partir de hoje');
  assert.equal(topo('tarefa regar as plantas dias úteis às 18h').dados.recorrencia, 'weekdays');
  const m = topo('tarefa pagar condomínio todo dia 5').dados;
  assert.deepEqual([m.recorrencia, m.data], ['monthly', '2026-12-05']);
  assert.equal(topo('tarefa limpar a casa toda semana').dados.recorrencia, 'weekly');
  assert.equal(topo('tarefa fatura todo mês').dados.recorrencia, 'monthly');
});

test('falar: sem acento, maiúsculas e frase sem comando', () => {
  const t = topo('TAREFA LIGAR PARA A MAE AMANHA AS 15H');
  assert.deepEqual([t.tipo, t.dados.data, t.dados.hora], ['tarefa', '2026-11-21', '15:00']);
  assert.equal(t.dados.titulo, 'LIGAR PARA A MAE');
  assert.deepEqual(F.interpretar('', SEXTA, R.emptyState()), []);
  assert.deepEqual(F.interpretar('   ', SEXTA, R.emptyState()), []);
  const sem = topo('bom dia');
  assert.equal(sem.tipo, 'tarefa');
  assert.ok(sem.confianca < 0.5, 'o último recurso é de baixa confiança');
  assert.equal(sem.dados.titulo, 'Bom dia');
  assert.ok(sem.aviso);
  assert.ok(topo('comprar flores amanhã').confianca >= 0.5 && topo('comprar flores amanhã').confianca < 0.9);
  assert.ok(topo('tomei vitamina às 8').confianca < 0.5, 'verbo no passado: não é compromisso');
});

/* ======================= Falar: contas ======================= */

test('falar: conta com valor e vencimento', () => {
  const c = topo('conta de luz 150 reais dia 10');
  assert.equal(c.tipo, 'conta');
  assert.deepEqual([c.dados.titulo, c.dados.cents, c.dados.data, c.dados.categoria, c.dados.recorrencia], ['Conta de luz', 15000, '2026-12-10', 'Moradia', 'once']);
  const a = topo('pagar aluguel 1200 dia 5').dados;
  assert.deepEqual([a.titulo, a.cents, a.data, a.categoria], ['Aluguel', 120000, '2026-12-05', 'Moradia']);
  const k = topo('conta do cartão 2.350,80 vence dia 20').dados;
  assert.deepEqual([k.cents, k.data, k.categoria], [235080, '2026-11-20', 'Cartão']);
  assert.equal(topo('boleto da academia R$ 89,90 todo mês dia 12').dados.recorrencia, 'monthly');
  assert.equal(topo('conta de internet 120 reais').dados.categoria, 'Moradia');
  const sem = topo('conta de água 80 reais');
  assert.ok(sem.aviso && sem.confianca < 0.9, 'sem vencimento: avisa e usa hoje');
  assert.equal(sem.dados.data, '2026-11-20');
  assert.ok(!todos('me lembra de pagar a academia dia 5').some((x) => x.tipo === 'conta'), 'sem valor é tarefa');
});

/* ======================= Falar: alimentos ======================= */

test('falar: alimento com quantidade em gramas, unidades e refeição', () => {
  let t = topo('comi 2 ovos no café da manhã');
  assert.equal(t.tipo, 'alimento');
  assert.deepEqual([t.dados.itens[0].gramas, t.dados.refeicao, t.dados.data], [100, 'breakfast', '2026-11-20']);
  assert.match(t.dados.itens[0].nome, /^Ovo, de galinha, inteiro, cozido/);
  assert.ok(t.aviso && /50 g cada/.test(t.aviso), 'estimativa avisa');
  t = topo('almocei 150 g de arroz');
  assert.deepEqual([t.dados.itens[0].nome, t.dados.itens[0].gramas, t.dados.refeicao, t.aviso], ['Arroz, tipo 1, cozido', 150, 'lunch', null]);
  assert.equal(topo('comi 0,2 kg de frango grelhado').dados.itens[0].gramas, 200);
  assert.match(topo('almocei 120g de frango grelhado').dados.itens[0].nome, /peito, sem pele, grelhado/i);
  t = topo('tomei um iogurte de lanche');
  assert.deepEqual([t.dados.itens[0].gramas, t.dados.refeicao], [170, 'afternoon_snack']);
  assert.equal(topo('comi meia banana').dados.itens[0].gramas, 45);
  assert.equal(topo('comi 3 colheres de sopa de arroz').dados.itens[0].gramas, 75);
  assert.equal(topo('comi 1 fatia de pão de forma').dados.itens[0].gramas, 25);
  assert.equal(topo('comi um e meio ovos').dados.itens[0].gramas, 75);
  assert.equal(topo('jantei salmão').dados.refeicao, 'dinner');
  assert.equal(topo('ceei iogurte').dados.refeicao, 'supper');
  assert.equal(topo('comi ontem 2 ovos').dados.data, '2026-11-19');
  assert.equal(topo('comi 2 ovos', R.emptyState(), new Date(2026, 10, 20, 19, 0)).dados.refeicao, 'dinner', 'sem refeição dita, pela hora');
  assert.equal(topo('comi 2 ovos', R.emptyState(), new Date(2026, 10, 20, 7, 30)).dados.refeicao, 'breakfast');
});

test('falar: vários alimentos, plural e alternativas', () => {
  const t = topo('comi arroz e feijão');
  assert.equal(t.dados.itens.length, 2);
  assert.deepEqual(t.dados.itens.map((i) => i.nome), ['Arroz, tipo 1, cozido', 'Feijão, carioca, cozido']);
  const u = topo('comi uma banana e dois ovos no café');
  assert.deepEqual(u.dados.itens.map((i) => i.gramas), [90, 100]);
  assert.equal(u.dados.refeicao, 'breakfast');
  const p = topo('comi 2 pães de queijo');
  assert.match(p.dados.itens[0].nome, /^Pão, de queijo, assado/);
  assert.equal(p.dados.itens[0].gramas, 100, '2 pães de queijo, 50 g cada');
  const um = topo('comi um ovo');
  assert.ok(um.dados.itens[0].alternativas.length >= 1, 'oferece outras opções');
  assert.ok(!todos('tomei vitamina').some((x) => x.tipo === 'alimento'), 'vitamina não é alimento');
  assert.ok(!todos('comi xyzabc').some((x) => x.tipo === 'alimento'), 'alimento desconhecido não vira registro');
});

test('falar: trocar o alimento por uma alternativa', () => {
  const s = R.emptyState();
  const it = topo('comi um ovo', s);
  const alt = it.dados.itens[0].alternativas[0];
  const antigo = it.dados.itens[0].foodId;
  F.trocarAlimento(it, 0, alt.foodId, s, SEXTA);
  assert.equal(it.dados.itens[0].foodId, alt.foodId);
  assert.equal(it.dados.foodId, alt.foodId);
  assert.ok(it.dados.itens[0].alternativas.some((a) => a.foodId === antigo), 'o antigo vira alternativa');
  assert.ok(it.resumo.includes(alt.nome.split(',')[0].toLowerCase()));
});

/* ======================= Falar: aplicar e desfazer ======================= */

test('falar: aplicar cria e desfazer remove, para cada tipo', () => {
  const s = R.emptyState();
  Y.savePeriod(s, null, { start: '2026-11-10', end: '2026-11-14' }, NOW);
  // tarefa
  let r = F.aplicar(s, topo('tarefa ligar para a mãe amanhã às 15h', s), NOW);
  assert.ok(r.ok && r.lembrete);
  assert.deepEqual([s.tasks.length, s.tasks[0].title, s.tasks[0].dueDate, s.tasks[0].dueTime, s.tasks[0].reminderMinutes], [1, 'Ligar para a mãe', '2026-11-21', '15:00', 15]);
  F.desfazer(s, r.desfazer); assert.equal(s.tasks.length, 0);
  r = F.aplicar(s, topo('toda segunda e quarta treinar às 7h', s), NOW);
  assert.deepEqual([s.tasks[0].recurrence, s.tasks[0].weekdays], ['weekly', [1, 3]]);
  F.desfazer(s, r.desfazer);
  // água
  r = F.aplicar(s, topo('bebi 300 ml', s), NOW);
  assert.equal(R.waterTotal(s, '2026-11-20'), 300);
  F.desfazer(s, r.desfazer); assert.equal(R.waterTotal(s, '2026-11-20'), 0);
  // peso
  r = F.aplicar(s, topo('peso 62,4', s), NOW);
  assert.equal(s.bodyRecords[0].weightKg, 62.4);
  F.desfazer(s, r.desfazer); assert.equal(s.bodyRecords.length, 0);
  // alimento
  r = F.aplicar(s, topo('comi arroz e feijão no almoço', s), NOW);
  assert.equal(N.dayLog(s, '2026-11-20').count, 2);
  assert.equal(N.dayLog(s, '2026-11-20').meals[0].meal, 'lunch');
  F.desfazer(s, r.desfazer); assert.equal(N.dayLog(s, '2026-11-20').count, 0);
  // conta
  r = F.aplicar(s, topo('conta de luz 150 reais dia 10', s), NOW);
  assert.deepEqual([s.bills[0].title, s.bills[0].amountCents, s.bills[0].dueDate, s.bills[0].category], ['Conta de luz', 15000, '2026-12-10', 'Moradia']);
  F.desfazer(s, r.desfazer); assert.equal(s.bills.length, 0);
  // energia (volta ao valor de antes)
  Y.setDay(s, '2026-11-20', { energy: 5 }, NOW);
  r = F.aplicar(s, topo('energia 2', s), NOW);
  assert.equal(Y.dayLog(s, '2026-11-20').energy, 2);
  F.desfazer(s, r.desfazer); assert.equal(Y.dayLog(s, '2026-11-20').energy, 5);
  // treino: só pede à tela para começar
  assert.equal(F.aplicar(s, topo('começar treino', s), NOW).acao, 'treino');
  // inválido não cria nada
  assert.equal(F.aplicar(s, { tipo: 'agua', dados: { ml: 5, data: '2026-11-20' } }, NOW).ok, false);
  assert.equal(s.waterLogs.length, 0);
});

/* ======================= PDF ======================= */

function pdfTexto(bytes) { return Buffer.from(bytes).toString('latin1'); }

test('pdf: acentos em WinAnsi e medida de texto', () => {
  assert.equal(P.hexWin('ação'), '<61E7E36F>');
  assert.equal(P.hexWin('• “x” — €'), '<952093789420972080>', 'pontuação tipográfica e euro em WinAnsi');
  assert.deepEqual(P.bytesWin('é→😀'), [0xE9, 0x2D, 0x3E]);
  assert.ok(Math.abs(P.medirTexto('Hello', 10, false) - 22.78) < 0.001);
  assert.ok(P.medirTexto('Hello', 10, true) > P.medirTexto('Hello', 10, false), 'negrito é mais largo');
  assert.equal(P.medirTexto('', 10), 0);
});

test('pdf: estrutura válida (cabeçalho, xref com deslocamentos certos, trailer)', () => {
  const doc = P.criar({ titulo: 'Relatório', autor: 'Julia', rodape: 'Gerado pelo J.S.', data: new Date(2026, 10, 20, 10, 30, 0) });
  doc.titulo('Relatório do mês', 'Julia Satorno • 01/11 a 20/11');
  doc.secao('Treino');
  doc.kpis([{ valor: '12', rotulo: 'treinos' }, { valor: '148', rotulo: 'séries' }]);
  doc.texto('Ação, atenção, coração, pão, é à ã õ ü ç — “aspas”. ' + 'palavra '.repeat(60));
  const linhas = []; for (let i = 0; i < 90; i++) linhas.push([String(i), 'Treino A — Quadríceps e glúteos', '12']);
  doc.tabela({ colunas: [{ t: 'Data', w: 1 }, { t: 'Ficha', w: 4 }, { t: 'Séries', w: 1, a: 'right' }], linhas });
  doc.barras({ titulo: 'Proteína', rotulos: ['1', '2', '3'], valores: [80, 95, 60], meta: 90 });
  doc.linha({ titulo: 'Peso', rotulos: ['a', 'b'], valores: [63, null, 62.4], unidade: 'kg' });
  const bytes = doc.gerar(), s = pdfTexto(bytes);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(s.slice(0, 8), '%PDF-1.4');
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  assert.ok(doc.paginas() >= 2, 'a tabela grande quebra em páginas');
  assert.equal((s.match(/\/Type \/Page /g) || []).length, doc.paginas());
  assert.match(s, new RegExp('/Count ' + doc.paginas()));
  // xref: cada entrada aponta para "<n> 0 obj"
  const sx = /startxref\n(\d+)\n%%EOF/.exec(s), at = Number(sx[1]);
  assert.equal(s.slice(at, at + 4), 'xref');
  const tabela = s.slice(at).split('\n'), [ini, qtd] = tabela[1].split(' ').map(Number);
  assert.equal(ini, 0);
  for (let n = 1; n < qtd; n++) {
    const off = Number(tabela[2 + n].slice(0, 10));
    assert.equal(s.slice(off, off + (n + ' 0 obj').length), n + ' 0 obj', 'objeto ' + n);
    assert.equal(tabela[2 + n].length, 19, 'entrada da xref com 20 bytes (com \\n)');
  }
  assert.match(s, new RegExp('/Size ' + qtd));
  assert.match(s, /\/Root 1 0 R/);
  // texto e rodapé em todas as páginas, cabeçalho da tabela repetido
  const hexData = P.hexWin('Data'), hexRodape = P.hexWin('Página ');
  assert.ok(s.split(hexData).length - 1 >= doc.paginas() - 1, 'cabeçalho da tabela repetido nas páginas seguintes');
  assert.ok(s.includes(P.hexWin('Relatório do mês')));
  assert.ok(s.includes(P.hexWin('Gerado pelo J.S.')));
  assert.ok(s.includes(P.hexWin('Página 1 de ' + doc.paginas())));
  void hexRodape;
  assert.ok(s.includes('/Title <FEFF'), 'título nos metadados (UTF-16)');
  assert.ok(s.includes('/BaseFont /Helvetica-Bold'));
  // o texto longo foi quebrado em várias linhas (cada linha é um Tj), todas dentro da margem
  assert.ok((s.match(/ Tj\n/g) || s.match(/ Tj/g) || []).length > 20);
});

test('pdf: imagem JPEG embutida', () => {
  const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x03, 0x00, 0x02, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xFF, 0xD9]);
  assert.deepEqual(P.infoJpeg(jpeg), { w: 2, h: 3, n: 3 });
  assert.equal(P.infoJpeg(new Uint8Array([1, 2, 3, 4])), null);
  const doc = P.criar({ rodape: 'x' });
  doc.secao('Fotos');
  doc.imagens([{ bytes: jpeg, legenda: '01/11/2026 • Frente' }, { bytes: jpeg, legenda: '20/11/2026 • Frente' }]);
  const bytes = doc.gerar(), s = pdfTexto(bytes);
  assert.equal((s.match(/\/Subtype \/Image/g) || []).length, 2);
  assert.match(s, /\/Width 2 \/Height 3 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode \/Length 23/);
  assert.ok(s.includes(' Do Q'), 'a página desenha as imagens');
  assert.ok(s.includes(P.hexWin('01/11/2026 • Frente')));
  assert.match(s, /\/XObject << \/Im1 6 0 R \/Im2 7 0 R >>/);
  // os bytes do JPEG estão inteiros no arquivo
  assert.ok(Buffer.from(bytes).includes(Buffer.from(jpeg)));
  // imagem em tons de cinza
  const cinza = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x04, 0x00, 0x04, 0x01, 1, 0x11, 0, 0xFF, 0xD9]);
  const d2 = P.criar({}); d2.imagens([{ bytes: cinza }]);
  assert.match(pdfTexto(d2.gerar()), /\/DeviceGray/);
});

test('pdf: documento vazio e texto sem quebra de página tem 1 página', () => {
  const d = P.criar({}); const s = pdfTexto(d.gerar());
  assert.equal(d.paginas(), 1);
  assert.match(s, /\/Count 1/);
  const d2 = P.criar({}); d2.texto('curto'); d2.tabela({ colunas: [{ t: 'A' }], linhas: [] });
  assert.ok(pdfTexto(d2.gerar()).includes(P.hexWin('Sem registros no período.')));
});

/* ======================= Relatório ======================= */

function estadoRelatorio() {
  const s = R.emptyState();
  s.settings.name = 'Julia Satorno'; s.settings.body.heightCm = 165;
  const mk = (d, ex, sets) => { const x = T.startSession(s, d, null, NOW); const it = T.addSessionExercise(s, x.id, ex); sets.forEach(([l, r]) => { T.setItemValues(s, x.id, it.id, { load: l, reps: r }); T.logSet(s, x.id, it.id, NOW); }); T.finishSession(s, x.id, NOW); };
  for (let i = 0; i < 6; i++) mk(C.addDays('2026-11-01', i * 3), 'ex:agachamento-livre', [[40 + i, 10], [40 + i, 10]]);
  mk('2026-10-10', 'ex:agachamento-livre', [[30, 10]]);
  s.bodyRecords.push({ id: 'b1', date: '2026-11-02', weightKg: 64.2, fatPct: 27.5, createdAt: NOW }, { id: 'b2', date: '2026-11-18', weightKg: 62.8, fatPct: 26.1, createdAt: NOW });
  const ovo = N.search(s, 'ovo', 1)[0], arroz = N.search(s, 'arroz', 1)[0];
  for (let i = 0; i < 10; i++) { N.addFoodLog(s, { date: C.addDays('2026-11-01', i), meal: 'lunch', foodId: arroz.id, grams: 150 }, NOW); N.addFoodLog(s, { date: C.addDays('2026-11-01', i), meal: 'breakfast', foodId: ovo.id, grams: 100 }, NOW); R.addWater(s, C.addDays('2026-11-01', i), 1500 + i * 100, NOW); }
  Y.savePeriod(s, null, { start: '2026-10-25', end: '2026-10-29' }, NOW);
  return s;
}

test('relatório: períodos', () => {
  assert.deepEqual(Rel.periodo('mes', SEXTA), { de: '2026-11-01', ate: '2026-11-20' });
  assert.deepEqual(Rel.periodo('passado', SEXTA), { de: '2026-10-01', ate: '2026-10-31' });
  assert.deepEqual(Rel.periodo('30', SEXTA), { de: '2026-10-22', ate: '2026-11-20' });
  assert.deepEqual(Rel.periodo('custom', SEXTA, '2026-09-01', '2026-09-30'), { de: '2026-09-01', ate: '2026-09-30' });
  assert.deepEqual(Rel.periodo('passado', new Date(2027, 0, 15)), { de: '2026-12-01', ate: '2026-12-31' });
  assert.equal(Rel.validarPeriodo({ de: '2026-11-01', ate: '2026-11-20' }), null);
  assert.ok(Rel.validarPeriodo({ de: '2026-11-20', ate: '2026-11-01' }));
  assert.ok(Rel.validarPeriodo({ de: '', ate: '2026-11-01' }));
  assert.ok(Rel.validarPeriodo({ de: '2024-01-01', ate: '2026-11-01' }), 'mais de 13 meses não');
});

test('relatório: dados de cada seção, só do período', () => {
  const s = estadoRelatorio();
  const d = Rel.coletar(s, { de: '2026-11-01', ate: '2026-11-20', secoes: { ciclo: false } }, SEXTA);
  assert.equal(d.nome, 'Julia Satorno');
  assert.equal(d.treino.totais.treinos, 6, 'o treino de outubro fica de fora');
  assert.equal(d.treino.totais.series, 12);
  assert.equal(d.treino.sessoes[0].data, '2026-11-01');
  assert.equal(d.treino.recordes.length, 6, 'cada treino maior que o anterior bate recorde, inclusive o primeiro do período (supera o de outubro)');
  assert.equal(d.treino.evolucao.length, 1);
  assert.equal(d.treino.evolucao[0].pontos.length, 6);
  assert.equal(d.treino.grupos[0].series, 12);
  assert.equal(d.alimentacao.dias.length, 10);
  assert.equal(d.alimentacao.semRegistro, 10);
  assert.ok(d.alimentacao.media.kcal > 100);
  assert.equal(d.medidas.registros.length, 2);
  assert.deepEqual(d.medidas.mudancas.map((m) => [m.rotulo, m.delta]), [['Peso', -1.4], ['Gordura', -1.4]]);
  assert.ok(d.medidas.imc > 20 && d.medidas.imc < 25);
  assert.equal(d.agua.diasComRegistro, 10);
  assert.equal(d.agua.metaMl, 2200);
  assert.equal(d.ciclo, undefined, 'o ciclo é opt-in');
  const so = Rel.coletar(s, { de: '2026-10-01', ate: '2026-10-31', secoes: { ciclo: true } }, SEXTA);
  assert.equal(so.treino.totais.treinos, 1);
  assert.equal(so.alimentacao, null);
  assert.equal(so.agua, null);
  assert.equal(so.ciclo.ciclos.length, 1);
});

test('relatório: PDF com acentos, seções com dados e sem dados omitidas', () => {
  const s = estadoRelatorio();
  const bytes = Rel.montarPdf(s, { de: '2026-11-01', ate: '2026-11-20', secoes: { treino: true, alimentacao: true, medidas: true, agua: true } }, SEXTA), txt = pdfTexto(bytes);
  assert.equal(txt.slice(0, 8), '%PDF-1.4');
  ['Relatório J.S.', 'Treino', 'Alimentação', 'Medidas do corpo', 'Água', 'Recordes pessoais do período', 'Evolução da carga máxima'].forEach((t) => assert.ok(txt.includes(P.hexWin(t)), t));
  assert.ok(!txt.includes(P.hexWin('Ciclo menstrual')), 'ciclo não foi pedido');
  assert.ok(txt.includes(P.hexWin('Julia Satorno • 01/11/2026 a 20/11/2026 (20 dias)')), 'nome e período no cabeçalho');
  // período sem nada: só o aviso
  const vazio = pdfTexto(Rel.montarPdf(R.emptyState(), { de: '2026-11-01', ate: '2026-11-20' }, SEXTA));
  assert.ok(vazio.includes(P.hexWin('Não há registros neste período para as seções escolhidas.')));
  assert.ok(!vazio.includes(P.hexWin('Treino')));
  // ciclo escolhido
  const comCiclo = pdfTexto(Rel.montarPdf(s, { de: '2026-10-01', ate: '2026-10-31', secoes: { treino: false, alimentacao: false, medidas: false, agua: false, ciclo: true } }, SEXTA));
  assert.ok(comCiclo.includes(P.hexWin('Ciclo menstrual')));
  // com foto
  const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x03, 0x00, 0x02, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xFF, 0xD9]);
  const comFoto = pdfTexto(Rel.montarPdf(s, { de: '2026-11-01', ate: '2026-11-20', secoes: {}, fotos: [{ date: '2026-11-02', pose: 'Frente', bytes: jpeg }] }, SEXTA));
  assert.ok(comFoto.includes('/DCTDecode') && comFoto.includes(P.hexWin('Fotos de evolução')));
});

/* ======================= ICS ======================= */

function desdobrar(txt) { return txt.replace(/\r\n /g, ''); }
function estadoIcs() {
  const s = R.emptyState(); s.settings.name = 'Julia Satorno';
  const task = (o) => R.createTask(s, R.validateTask(o).value, NOW);
  task({ title: 'Ligar para a mãe, é urgente; ok', dueDate: '2026-11-21', dueTime: '15:00', reminderMinutes: 15, category: 'Pessoal', priority: 'high', description: 'Linha 1\nLinha 2 com acentos: ação, coração, pão e muitas outras palavras para dobrar a linha com mais de setenta e cinco octetos' });
  task({ title: 'Tomar vitamina', dueDate: '2026-11-20', dueTime: '08:00', recurrence: 'daily', reminderMinutes: 0, category: 'Pessoal' });
  task({ title: 'Treinar pernas', dueDate: '2026-11-23', recurrence: 'weekly', weekdays: [1, 3], category: 'Pessoal' });
  task({ title: 'Pagar condomínio', dueDate: '2026-11-05', recurrence: 'monthly', category: 'Casa' });
  task({ title: 'Dias úteis', dueDate: '2026-11-20', recurrence: 'weekdays', category: 'Pessoal' });
  task({ title: 'Acabou', dueDate: '2026-11-01', dueTime: '09:00', recurrence: 'daily', category: 'Pessoal' });
  s.tasks[s.tasks.length - 1].endDate = '2026-11-10'; // terminou antes de hoje
  task({ title: 'Já foi', dueDate: '2026-11-10', category: 'Pessoal' });
  const feita = task({ title: 'Feita', dueDate: '2026-11-22', category: 'Pessoal' });
  s.taskOcc[R.occKey(feita.id, '2026-11-22')] = { status: 'done', completedAt: NOW };
  const cancel = task({ title: 'Cancelada', dueDate: '2026-11-22', category: 'Pessoal' }); cancel.status = 'cancelled';
  const fim = task({ title: 'Termina logo', dueDate: '2026-11-20', dueTime: '18:00', recurrence: 'daily', category: 'Pessoal' }); fim.endDate = '2026-12-31';
  R.createBill(s, R.validateBill({ title: 'Luz', amount: '150,00', dueDate: '2026-11-25', category: 'Moradia', reminderDaysBefore: 2, reminderTime: '09:00' }).value, NOW);
  const paga = R.createBill(s, R.validateBill({ title: 'Paga', amount: '10,00', dueDate: '2026-11-26', category: 'Moradia' }).value, NOW); paga.status = 'paid';
  R.createMeal(s, R.validateMeal({ name: 'Almoço', type: 'lunch', time: '12:30', weekdays: [1, 2, 3, 4, 5], reminderEnabled: true }).value, NOW);
  R.createMeal(s, R.validateMeal({ name: 'Lanche', type: 'afternoon_snack', time: '16:00', weekdays: [0, 1, 2, 3, 4, 5, 6], reminderEnabled: false }).value, NOW);
  const pausada = R.createMeal(s, R.validateMeal({ name: 'Ceia', type: 'supper', time: '22:00', weekdays: [0, 1, 2, 3, 4, 5, 6], reminderEnabled: true }).value, NOW); pausada.enabled = false;
  R.createHairEvent(s, R.validateHair({ type: 'hydration', date: '2026-11-24', time: '19:00', reminderMinutes: 0 }).value, NOW);
  const pA = T.createPlan(s, T.validatePlan({ name: 'Treino A', items: [{ exerciseId: 'ex:agachamento-livre', sets: 3, reps: '10', load: 20, restSec: 60 }] }).value, NOW);
  const pB = T.createPlan(s, T.validatePlan({ name: 'Treino B', items: [] }).value, NOW);
  T.setWeekPlan(s, 1, pA.id); T.setWeekPlan(s, 3, pA.id); T.setWeekPlan(s, 5, pB.id);
  s.workout.reminderTime = '07:00';
  return s;
}
const eventos = (txt) => desdobrar(txt).split('\r\n').reduce((acc, l) => { if (l === 'BEGIN:VEVENT') acc.push([]); else if (acc.length && l !== 'END:VEVENT') acc[acc.length - 1].push(l); return acc; }, []);
const achar = (txt, resumo) => eventos(txt).find((e) => e.some((l) => l === 'SUMMARY:' + resumo));
const campo = (ev, nome) => (ev.find((l) => l.startsWith(nome + ':') || l.startsWith(nome + ';')) || '').replace(/^[^:]*:/, '');

test('ics: estrutura do arquivo, CRLF, dobra em 75 octetos e UIDs', () => {
  const s = estadoIcs(), out = I.montar(s, {}, SEXTA), txt = out.texto;
  assert.ok(txt.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:'));
  assert.ok(txt.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(txt), 'toda quebra de linha é CRLF');
  txt.split('\r\n').forEach((l) => assert.ok(Buffer.byteLength(l) <= 75, 'linha com mais de 75 octetos: ' + l));
  txt.split('\r\n').filter((l) => l.startsWith(' ')).forEach((l) => assert.ok(l.length > 1));
  assert.equal((txt.match(/^BEGIN:VEVENT/gm) || []).length, out.total);
  assert.equal((txt.match(/^END:VEVENT/gm) || []).length, out.total);
  assert.equal((txt.match(/^BEGIN:VALARM/gm) || []).length, (txt.match(/^END:VALARM/gm) || []).length);
  const uids = (txt.match(/^UID:.*$/gm) || []);
  assert.equal(new Set(uids).size, uids.length, 'UIDs únicos');
  uids.forEach((u) => assert.match(u, /^UID:js-(tarefa|capilar|conta|refeicao|treino)-[0-9a-f-]+@julia\.js$/));
  assert.match(txt, /\r\nDTSTAMP:20261120T133000Z\r\n|\r\nDTSTAMP:\d{8}T\d{6}Z\r\n/);
  assert.match(I.stamp(new Date(Date.UTC(2026, 10, 20, 13, 30, 5))), /^20261120T133005Z$/);
  assert.ok(txt.includes('X-WR-CALNAME:J.S. — Julia Satorno'));
  // o texto dobrado volta inteiro ao desdobrar (sem cortar acentos ao meio)
  const longa = achar(txt, 'Ligar para a mãe\\, é urgente\\; ok');
  assert.ok(longa, 'resumo com vírgula e ponto e vírgula escapados');
  assert.equal(campo(longa, 'DESCRIPTION'), 'Linha 1\\nLinha 2 com acentos: ação\\, coração\\, pão e muitas outras palavras para dobrar a linha com mais de setenta e cinco octetos');
  assert.ok(txt.includes('\r\n '), 'a descrição comprida foi dobrada');
  assert.ok(!txt.includes('�'));
});

test('ics: escape e dobra', () => {
  assert.equal(I.esc('a, b; c\\ d\ne'), 'a\\, b\\; c\\\\ d\\ne');
  const dobrado = I.dobrar('X:' + 'ação'.repeat(30));
  dobrado.split('\r\n').forEach((l) => assert.ok(Buffer.byteLength(l) <= 75));
  assert.equal(dobrado.replace(/\r\n /g, ''), 'X:' + 'ação'.repeat(30));
  assert.equal(I.dobrar('curta'), 'curta');
  assert.equal(I.dobrar('A'.repeat(75)), 'A'.repeat(75), '75 octetos cabem numa linha');
  assert.equal(I.dobrar('A'.repeat(76)).split('\r\n').length, 2);
  const emoji = I.dobrar('Y:' + '🌸'.repeat(25));
  assert.equal(emoji.replace(/\r\n /g, ''), 'Y:' + '🌸'.repeat(25));
  emoji.split('\r\n').forEach((l) => assert.ok(Buffer.byteLength(l) <= 75));
});

test('ics: tarefas únicas, repetidas, concluídas e fora da janela', () => {
  const txt = I.build(estadoIcs(), {}, SEXTA);
  // única, com hora e lembrete de 15 min
  const mae = achar(txt, 'Ligar para a mãe\\, é urgente\\; ok');
  assert.equal(campo(mae, 'DTSTART'), '20261121T150000');
  assert.equal(campo(mae, 'DTEND'), '20261121T153000');
  assert.ok(mae.includes('TRIGGER:-PT15M') && mae.includes('PRIORITY:1') && mae.includes('TRANSP:OPAQUE'));
  assert.ok(!mae.some((l) => l.startsWith('RRULE')));
  // diária com horário: um evento com RRULE e alarme na hora
  const vit = achar(txt, 'Tomar vitamina');
  assert.equal(campo(vit, 'DTSTART'), '20261120T080000');
  assert.equal(campo(vit, 'RRULE'), 'FREQ=DAILY;UNTIL=20271120T235959');
  assert.ok(vit.includes('TRIGGER:PT0S'));
  // semanal nos dias marcados, dia inteiro: UNTIL só com a data
  const pernas = achar(txt, 'Treinar pernas');
  assert.equal(campo(pernas, 'DTSTART'), '20261123');
  assert.ok(pernas.includes('DTSTART;VALUE=DATE:20261123') && pernas.includes('DTEND;VALUE=DATE:20261124'));
  assert.equal(campo(pernas, 'RRULE'), 'FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20271120');
  assert.ok(pernas.includes('TRANSP:TRANSPARENT'));
  assert.ok(!pernas.some((l) => l.startsWith('BEGIN:VALARM')));
  // mensal
  assert.equal(campo(achar(txt, 'Pagar condomínio'), 'RRULE'), 'FREQ=MONTHLY;BYMONTHDAY=5;UNTIL=20271120');
  assert.equal(campo(achar(txt, 'Pagar condomínio'), 'DTSTART'), '20261205');
  // dias úteis
  assert.equal(campo(achar(txt, 'Dias úteis'), 'RRULE'), 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20271120');
  // termina antes do fim da janela: UNTIL = fim da série
  assert.equal(campo(achar(txt, 'Termina logo'), 'RRULE'), 'FREQ=DAILY;UNTIL=20261231T235959');
  // fora: série que já terminou, tarefa no passado, concluída e cancelada
  ['Acabou', 'Já foi', 'Feita', 'Cancelada'].forEach((t) => assert.equal(achar(txt, t), undefined, t));
});

test('ics: contas, tratamentos, refeições e treinos', () => {
  const s = estadoIcs();
  const txt = I.build(s, {}, SEXTA);
  const luz = achar(txt, 'Conta: Luz');
  assert.ok(luz, 'o valor não aparece por padrão');
  assert.equal(campo(luz, 'DTSTART'), '20261125');
  assert.deepEqual(luz.filter((l) => l.startsWith('TRIGGER')), ['TRIGGER:-PT2340M', 'TRIGGER:PT540M'], '2 dias antes às 9h e no dia às 9h');
  assert.equal(achar(txt, 'Conta: Paga'), undefined, 'paga não vai');
  s.settings.showAmountsInNotifications = true;
  assert.ok(achar(I.build(s, {}, SEXTA), I.esc('Conta: Luz (' + C.formatCents(15000) + ')')));
  // tratamento capilar
  const capilar = eventos(txt).find((e) => e.includes('CATEGORIES:Cronograma capilar'));
  assert.equal(campo(capilar, 'DTSTART'), '20261124T190000');
  assert.ok(capilar.includes('TRIGGER:PT0S'));
  // refeições: dias úteis e todo dia; a pausada não vai; o lembrete vira alarme
  const alm = achar(txt, 'Almoço');
  assert.equal(campo(alm, 'RRULE'), 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20271120T235959');
  assert.equal(campo(alm, 'DTSTART'), '20261120T123000');
  assert.ok(alm.includes('TRIGGER:PT0S'));
  const lan = achar(txt, 'Lanche');
  assert.equal(campo(lan, 'RRULE'), 'FREQ=DAILY;UNTIL=20271120T235959');
  assert.ok(!lan.some((l) => l.startsWith('BEGIN:VALARM')), 'lembrete desligado: sem alarme');
  assert.equal(achar(txt, 'Ceia'), undefined);
  // treinos: dias com a mesma ficha viram um evento
  const a = achar(txt, 'Treino: Treino A'), b = achar(txt, 'Treino: Treino B');
  assert.equal(campo(a, 'RRULE'), 'FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20271120T235959');
  assert.equal(campo(a, 'DTSTART'), '20261123T070000');
  assert.equal(campo(b, 'RRULE'), 'FREQ=WEEKLY;BYDAY=FR;UNTIL=20271120T235959');
  assert.equal(campo(b, 'DTSTART'), '20261120T070000');
  assert.ok(a.includes('DESCRIPTION:1 exercício') && b.includes('DESCRIPTION:0 exercícios'));
  assert.ok(a.includes('TRIGGER:PT0S'));
  s.workout.reminderTime = null;
  const semHora = achar(I.build(s, {}, SEXTA), 'Treino: Treino A');
  assert.ok(semHora.includes('DTSTART;VALUE=DATE:20261123') && !semHora.some((l) => l.startsWith('BEGIN:VALARM')));
});

test('ics: escolher o que exportar e estado vazio', () => {
  const s = estadoIcs();
  const so = I.montar(s, { tarefas: false, capilar: false, contas: true, refeicoes: false, treinos: false }, SEXTA);
  assert.deepEqual(so.porTipo, { tarefas: 0, capilar: 0, contas: 1, refeicoes: 0, treinos: 0 });
  assert.equal(so.total, 1);
  const todos_ = I.montar(s, {}, SEXTA);
  assert.deepEqual(todos_.porTipo, { tarefas: 6, capilar: 1, contas: 1, refeicoes: 2, treinos: 2 });
  assert.equal(todos_.total, 12);
  const vazio = I.montar(R.emptyState(), {}, SEXTA);
  assert.equal(vazio.total, 0);
  assert.ok(vazio.texto.startsWith('BEGIN:VCALENDAR') && vazio.texto.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!vazio.texto.includes('BEGIN:VEVENT'));
  // janela de meses menor deixa de fora o que vem depois
  const curta = I.montar(s, { meses: 1 }, SEXTA);
  assert.match(achar(curta.texto, 'Treinar pernas').find((l) => l.startsWith('RRULE')), /UNTIL=20261220$/);
});
