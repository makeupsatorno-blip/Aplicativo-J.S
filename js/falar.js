/*
 * J.S. — adicionar escrevendo ou falando (linguagem natural em português do Brasil).
 * Interpretador LOCAL: sem IA, sem rede. Recebe uma frase ("bebi 300 ml", "tarefa ligar para a mãe
 * amanhã às 15h", "comi 2 ovos no café da manhã") e devolve intenções ordenadas por confiança.
 * Nada é criado aqui: a tela mostra "Entendi: …" e só aplica (aplicar) quando a usuária toca em Criar.
 * Módulo puro: roda no navegador e no Node (testes).
 *
 *   JSFalar.interpretar(texto, agora, state) -> [{ tipo, resumo, dados, confianca, aviso? }]
 *     tipo: 'tarefa' | 'agua' | 'peso' | 'alimento' | 'energia' | 'conta' | 'treino'
 *   JSFalar.aplicar(state, intencao, nowISO) -> { ok, mensagem, desfazer, erro, acao? }
 *   JSFalar.desfazer(state, desfazer)
 */
(function (root, factory) {
  var req = typeof require === 'function';
  var C = root && root.JSCore ? root.JSCore : (req ? require('./core.js') : null);
  var R = root && root.JSRegras ? root.JSRegras : (req ? require('./regras.js') : null);
  var N = root && root.JSNutri ? root.JSNutri : (req ? require('./regras-nutricao.js') : null);
  var B = root && root.JSCorpo ? root.JSCorpo : (req ? require('./regras-corpo.js') : null);
  var Y = root && root.JSCiclo ? root.JSCiclo : (req ? require('./regras-ciclo.js') : null);
  var api = factory(C, R, N, B, Y);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSFalar = api;
})(typeof self !== 'undefined' ? self : this, function (C, R, N, B, Y) {
  'use strict';

  var DEFAULT_REMINDER = 15; // minutos antes (igual ao da Rotina)
  var NUM_WORDS = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, meio: 0.5, meia: 0.5 };
  var QTY = '(\\d+(?:[.,]\\d+)?|(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\\s+e\\s+(?:meio|meia)|meio|meia|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)';
  var WD_NAMES = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  var WD_RE = '(?:domingo|segunda|terca|quarta|quinta|sexta|sabado)';
  var MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  var MES_RE = '(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)';
  var BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  /* ---------------- Texto ---------------- */

  // Minúsculo e sem acento, com o MESMO tamanho do original (assim dá para apagar o trecho nos dois).
  function foldSame(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i), f = c.normalize ? c.normalize('NFD').replace(/[̀-ͯ]/g, '') : c;
      out += f.length === 1 ? f.toLowerCase() : ' ';
    }
    return out;
  }
  function fold(s) { return foldSame(String(s == null ? '' : s).normalize ? String(s).normalize('NFC') : String(s)); }
  function cap(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function num(v) { return Number(String(v).replace(',', '.')); }

  function parseQty(str) {
    str = String(str || '').trim();
    if (!str) return null;
    if (/^\d/.test(str)) { var n = num(str); return Number.isFinite(n) ? n : null; }
    var m = /^(\w+)\s+e\s+(meio|meia)$/.exec(str);
    if (m) return (NUM_WORDS[m[1]] || 0) + 0.5;
    return NUM_WORDS[str] != null ? NUM_WORDS[str] : null;
  }

  // Contexto: texto original (w) e normalizado (n) lado a lado; "comer" um trecho troca por espaços nos dois.
  function ctxDe(texto, agora) {
    var w = String(texto == null ? '' : texto);
    if (w.normalize) w = w.normalize('NFC');
    var n = foldSame(w).replace(/-feira/g, '      ').replace(/\bàs\b/g, 'as');
    return { w: w, n: n, hoje: C.toDateKey(agora), agora: agora };
  }
  function comer(ctx, re) {
    var m = re.exec(ctx.n);
    if (!m) return null;
    var blank = new Array(m[0].length + 1).join(' ');
    ctx.n = ctx.n.slice(0, m.index) + blank + ctx.n.slice(m.index + m[0].length);
    ctx.w = ctx.w.slice(0, m.index) + blank + ctx.w.slice(m.index + m[0].length);
    return m;
  }

  /* ---------------- Datas e horas ---------------- */

  function diaDoMes(dia, hoje) {
    var p = hoje.split('-').map(Number);
    for (var k = 0; k < 14; k++) {
      var yy = p[0] + Math.floor((p[1] - 1 + k) / 12), mm = (p[1] - 1 + k) % 12 + 1;
      if (dia > C.daysInMonth(yy, mm - 1)) continue;
      var key = yy + '-' + C.pad(mm) + '-' + C.pad(dia);
      if (key >= hoje) return key;
    }
    return null;
  }
  function diaMes(dia, mes, ano, hoje) {
    var y = ano || Number(hoje.slice(0, 4));
    if (ano && ano < 100) y = 2000 + ano;
    if (mes < 1 || mes > 12 || dia < 1 || dia > C.daysInMonth(y, mes - 1)) return null;
    var key = y + '-' + C.pad(mes) + '-' + C.pad(dia);
    if (!ano && key < hoje) { y++; if (dia > C.daysInMonth(y, mes - 1)) return null; key = y + '-' + C.pad(mes) + '-' + C.pad(dia); }
    return key;
  }
  // Próximo dia da semana (depois de hoje, ou a partir de hoje com "inclusivo").
  function proximoDiaSemana(wd, hoje, inclusivo) {
    var cur = C.weekday(hoje), add = (wd - cur + 7) % 7;
    if (add === 0 && !inclusivo) add = 7;
    return C.addDays(hoje, add);
  }
  function wdIndex(word) { return WD_NAMES.indexOf(word.replace(/s$/, '')); }

  function hora(h, m) { h = Number(h); m = Number(m || 0); return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? C.pad(h) + ':' + C.pad(m) : null; }
  function periodo(h, p) {
    h = Number(h);
    if (p === 'tarde' || p === 'noite') { if (h < 12) h += 12; if (h === 24) h = 12; if (p === 'noite' && h === 12) h = 0; }
    else if (p === 'manha' && h === 12) h = 12;
    return h;
  }

  // Tira da frase o "quando": recorrência, data e hora. Devolve o que achou.
  function extrairQuando(ctx) {
    var q = { data: null, hora: null, rec: null, achou: false }, m, hoje = ctx.hoje;
    // recorrência
    if ((m = comer(ctx, /\btodo\s+dia\s+(\d{1,2})\b/))) { q.rec = { tipo: 'monthly', dia: Number(m[1]) }; q.data = diaDoMes(Number(m[1]), hoje); }
    else if (comer(ctx, /\b(?:todos\s+os\s+dias|todo\s+dia|diariamente)\b/)) q.rec = { tipo: 'daily' };
    else if (comer(ctx, /\b(?:dias\s+uteis|de\s+segunda\s+a\s+sexta|segunda\s+a\s+sexta)\b/)) q.rec = { tipo: 'weekdays' };
    else if ((m = comer(ctx, new RegExp('\\b(?:toda|todas\\s+as|todo|todos\\s+os)\\s+(' + WD_RE + 's?(?:\\s*(?:,|e)\\s*' + WD_RE + 's?)*)\\b')))) {
      var dias = [];
      m[1].split(/\s*(?:,|\be\b)\s*/).forEach(function (p) { var i = wdIndex(p.trim()); if (i >= 0 && dias.indexOf(i) < 0) dias.push(i); });
      q.rec = { tipo: 'weekly', dias: dias.sort() };
    }
    else if (comer(ctx, /\b(?:toda\s+semana|semanalmente)\b/)) q.rec = { tipo: 'weekly', dias: null };
    else if (comer(ctx, /\b(?:todo\s+mes|mensalmente|mensal)\b/)) q.rec = { tipo: 'monthly', dia: null };

    // datas relativas
    if (comer(ctx, /\bdepois\s+de\s+amanha\b/)) q.data = C.addDays(hoje, 2);
    else if (comer(ctx, /\bamanha\b/)) q.data = C.addDays(hoje, 1);
    else if (comer(ctx, /\bhoje\b/)) q.data = hoje;
    else if ((m = comer(ctx, new RegExp('\\bdaqui\\s+a\\s+' + QTY + '\\s+(dias?|semanas?|mes(?:es)?)\\b')))) {
      var n = parseQty(m[1]) || 1;
      q.data = /^dia/.test(m[2]) ? C.addDays(hoje, n) : /^sem/.test(m[2]) ? C.addDays(hoje, 7 * n) : C.addMonths(hoje, n);
    }
    else if (comer(ctx, /\b(?:semana\s+que\s+vem|proxima\s+semana|semana\s+proxima)\b/)) q.data = C.addDays(hoje, 7);
    else if (comer(ctx, /\b(?:mes\s+que\s+vem|proximo\s+mes)\b/)) q.data = C.addMonths(hoje, 1);
    else if ((m = comer(ctx, new RegExp('\\b(?:dia\\s+)?(\\d{1,2})\\s*(?:de\\s+)?' + MES_RE + '(?:\\s+de\\s+(\\d{4}))?\\b')))) q.data = diaMes(Number(m[1]), MESES[m[2]], m[3] ? Number(m[3]) : null, hoje);
    else if ((m = comer(ctx, /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) q.data = diaMes(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null, hoje);
    else if ((m = comer(ctx, /\b(?:vence\s+|vencimento\s+|no\s+)?dia\s+(\d{1,2})\b/))) q.data = diaDoMes(Number(m[1]), hoje);
    else if ((m = comer(ctx, new RegExp('\\b(?:(?:no|na|nesta|neste|esta|este|ate|para|pra|proxima|proximo)\\s+)?(' + WD_RE + ')s?(?:\\s+(?:que\\s+vem|proxima|proximo))?\\b')))) {
      var wd = wdIndex(m[1]);
      q.data = proximoDiaSemana(wd, hoje, !!(q.rec && q.rec.tipo === 'weekly'));
    }
    // recorrência semanal sem data: a próxima ocorrência (hoje vale)
    if (q.rec && q.rec.tipo === 'weekly' && q.rec.dias && q.rec.dias.length && !q.data) {
      var best = null;
      q.rec.dias.forEach(function (d) { var k = proximoDiaSemana(d, hoje, true); if (!best || k < best) best = k; });
      q.data = best;
    }

    // hora
    if ((m = comer(ctx, /\b(\d{1,2}):(\d{2})\b/))) q.hora = hora(m[1], m[2]);
    else if ((m = comer(ctx, /\b(\d{1,2})\s*(?:hs?|horas?)(?:(?=\d{2}\b)|\b)(?:\s*(\d{2})\b)?(?:\s*da\s*(manha|tarde|noite|madrugada))?/))) q.hora = hora(periodo(m[1], m[3]), m[2]);
    else if ((m = comer(ctx, /\b(\d{1,2})(?:\s+horas?)?\s+da\s+(manha|tarde|noite|madrugada)\b/))) q.hora = hora(periodo(m[1], m[2]), 0);
    else if (comer(ctx, /\bmeio[\s-]?dia\b/)) q.hora = '12:00';
    else if (comer(ctx, /\bmeia[\s-]?noite\b/)) q.hora = '00:00';
    else if ((m = comer(ctx, /\bas\s+(\d{1,2})\b(?!\s*(?:ml|l\b|g\b|kg|reais|real|%|copo|ovo|unid|fatia|dias?|de\s+(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)))/))) q.hora = hora(m[1], 0);
    // "de manhã / à tarde / à noite" sem hora: não muda nada (só limpa a frase)
    comer(ctx, /\b(?:de\s+manha|a\s+tarde|de\s+tarde|a\s+noite|de\s+noite)\b/);

    q.achou = !!(q.data || q.hora || q.rec);
    return q;
  }

  function rotuloData(date, hoje) {
    if (!date) return '';
    var d = C.diffDays(hoje, date), l = C.formatDayLabel(date, hoje);
    return d >= -1 && d <= 1 ? l.toLowerCase() + ' (' + C.formatDayMonth(date) + ')' : l;
  }

  /* ---------------- Tarefa ---------------- */

  function limparTitulo(t) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    var ant;
    do { ant = t; t = t.replace(/^(?:de|do|da|que|para|pra|a|o|as|os|:|-|,|\.|e|então)\s+/i, '').replace(/\s+(?:de|do|da|as|às|a|no|na|em|para|pra|e|dia|que|nos|nas|às)\s*$/i, '').replace(/^[:,.\-–\s]+|[,.\-–\s]+$/g, ''); } while (t !== ant);
    return cap(t);
  }
  var RE_GATILHO = /\b(?:nova\s+tarefa|criar\s+tarefa|adicionar\s+tarefa|tarefa|lembrete|me\s+lembr(?:a|e|ar)(?:\s+de)?|lembrar\s+de|lembrar|me\s+avis(?:a|e)(?:\s+de)?|nao\s+esquecer\s+de|nao\s+esqueca\s+de|preciso|tenho\s+que|agendar|marcar)\b/;

  function detectarTarefa(texto, agora, ctxBase) {
    var ctx = ctxDe(texto, agora);
    var gat = comer(ctx, RE_GATILHO);
    var q = extrairQuando(ctx);
    var evento = /\b(?:consulta|reuniao|compromisso|aniversario|prova|aula|exame)\b/.test(ctxBase.n);
    var conf = gat ? 0.9 : q.rec && (q.data || q.hora) ? 0.78 : (q.data || q.hora || q.rec) ? 0.62 : evento ? 0.5 : 0.25;
    // "tomei vitamina às 8", "treinei hoje": é o que ela fez, não um compromisso
    if (!gat && /\b(?:tomei|bebi|comi|fiz|fui|cheguei|treinei|dormi|acordei|almocei|jantei|lanchei|ceei|estive|estava)\b/.test(ctxBase.n)) conf = Math.min(conf, 0.4);
    // Sem comando nem data: usa a frase como foi escrita (só como último recurso).
    var titulo = conf < 0.5 ? cap(String(texto).replace(/\s+/g, ' ').trim()) : limparTitulo(ctx.w);
    if (!titulo) return null;
    var data = q.data || (q.hora || q.rec ? ctx.hoje : null);
    var rec = 'none', dias = null;
    if (q.rec) {
      if (q.rec.tipo === 'daily') rec = 'daily';
      else if (q.rec.tipo === 'weekdays') rec = 'weekdays';
      else if (q.rec.tipo === 'monthly') { rec = 'monthly'; if (q.rec.dia) data = diaDoMes(q.rec.dia, ctx.hoje); }
      else { rec = 'weekly'; dias = q.rec.dias && q.rec.dias.length ? q.rec.dias : (data ? [C.weekday(data)] : null); }
    }
    var partes = ['tarefa “' + titulo + '”'];
    if (data) partes.push(rotuloData(data, ctx.hoje));
    if (q.hora) partes.push('às ' + q.hora);
    if (rec !== 'none') partes.push(rec === 'weekly' ? (dias ? 'toda ' + dias.map(function (d) { return C.WEEKDAY_SHORT[d]; }).join(', ') : 'toda semana') : rec === 'monthly' ? 'todo mês' : rec === 'daily' ? 'todo dia' : 'dias úteis');
    if (q.hora) partes.push('lembrete ' + DEFAULT_REMINDER + ' min antes');
    return {
      tipo: 'tarefa', confianca: conf, resumo: 'Entendi: ' + partes.join(' • '),
      aviso: conf < 0.5 ? 'Não reconheci um comando: posso criar o que você escreveu como tarefa.' : null,
      dados: { titulo: titulo, data: data, hora: q.hora || null, recorrencia: rec, diasSemana: dias, lembrete: q.hora ? DEFAULT_REMINDER : null }
    };
  }

  /* ---------------- Água ---------------- */

  var RE_UNIDADE_AGUA = new RegExp('\\b' + QTY + '\\s*(ml|mililitros?|l|litros?|copos?|copinhos?|garrafas?|garrafinhas?|canecas?)\\b');
  function mlDe(qtd, un, state) {
    var cup = state && R && R.waterCup ? R.waterCup(state) : 250;
    if (/^m/.test(un)) return Math.round(qtd);
    if (/^l/.test(un)) return Math.round(qtd * 1000);
    if (/^copinho/.test(un)) return Math.round(qtd * 200);
    if (/^copo/.test(un)) return Math.round(qtd * cup);
    if (/^garrafinha/.test(un)) return Math.round(qtd * 500);
    if (/^garrafa/.test(un)) return Math.round(qtd * 500);
    if (/^caneca/.test(un)) return Math.round(qtd * 300);
    return null;
  }
  var COMIDAS_LIQUIDAS = /\b(?:suco|leite|cafe|cha|refrigerante|coca|vitamina|iogurte|cerveja|vinho|cappuccino|achocolatado|energetico|isotonico|shake|whey|caldo|sopa|agua\s+de\s+coco|agua\s+com\s+gas|agua\s+saborizada)\b/;

  function detectarAgua(texto, agora, state, base) {
    var n = base.n;
    if (COMIDAS_LIQUIDAS.test(n) && !/\bagua\b/.test(n.replace(/agua\s+de\s+coco|agua\s+com\s+gas|agua\s+saborizada/g, ''))) return null;
    var temAgua = /\bagua\b/.test(n.replace(/agua\s+de\s+coco/g, '')), verbo = /\b(?:bebi|tomei|beber|tomar|tomo|bebendo|tomando)\b/.test(n);
    var m = RE_UNIDADE_AGUA.exec(n), ml = null, conf = 0;
    if (m) {
      var qtd = parseQty(m[1]);
      ml = qtd != null ? mlDe(qtd, m[2], state) : null;
      var resto = n.replace(RE_UNIDADE_AGUA, ' ').replace(/\b(?:bebi|tomei|beber|tomar|tomo|bebendo|tomando|de|agua|um|uma|hoje|ja|mais|e|mim|o|a)\b/g, ' ').replace(/[^a-z0-9]/g, ' ').trim();
      if (temAgua) conf = 0.95;
      else if (verbo && !resto) conf = 0.8;
      else if (!verbo && !resto && n.trim().split(/\s+/).length <= 3) conf = 0.55;
    } else if (temAgua && verbo) {
      ml = state && R.waterCup ? R.waterCup(state) : 250; conf = 0.7; // "bebi água": 1 copo
    }
    if (!conf || ml == null || !(ml >= 10 && ml <= 3000)) return null;
    var data = /\bontem\b/.test(n) ? C.addDays(C.toDateKey(agora), -1) : C.toDateKey(agora);
    return { tipo: 'agua', confianca: conf, resumo: 'Entendi: ' + (R.formatMl ? R.formatMl(ml) : ml + ' ml') + ' de água' + (/\bontem\b/.test(n) ? ' (ontem)' : ''), dados: { ml: ml, data: data } };
  }

  /* ---------------- Peso ---------------- */

  function detectarPeso(texto, agora, state, base) {
    var m = /\b(?:peso|pesei|pesando|pesa|pesou|balanca\s+(?:marcou|deu))\b[^\d]{0,16}(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|quilos?|k)?\b/.exec(base.n);
    if (!m) return null;
    var kg = num(m[1]);
    if (!(kg >= 20 && kg <= 400)) return null;
    var kgt = Math.round(kg * 10) / 10, data = /\bontem\b/.test(base.n) ? C.addDays(C.toDateKey(agora), -1) : C.toDateKey(agora);
    return { tipo: 'peso', confianca: 0.95, resumo: 'Entendi: peso ' + String(kgt).replace('.', ',') + ' kg' + (/\bontem\b/.test(base.n) ? ' (ontem)' : ''), dados: { kg: kgt, data: data } };
  }

  /* ---------------- Energia ---------------- */

  function cicloAtivo(state) { return !!(state && state.cyclePeriods && state.cyclePeriods.length); }
  function detectarEnergia(texto, agora, state, base) {
    if (!cicloAtivo(state)) return null;
    var n = base.n, v = null, conf = 0.9, m = /\benergia\s*(?:de\s*|nivel\s*|e\s*)?([1-5])\b/.exec(n);
    if (m) v = Number(m[1]);
    else if (/\b(?:exausta|esgotada|destruida|morta\s+de\s+cansaco)\b/.test(n)) { v = 1; conf = 0.75; }
    else if (/\b(?:cansada|sem\s+energia|sonolenta|moida|cansaco)\b/.test(n)) { v = 2; conf = 0.7; }
    else if (/\b(?:super\s+disposta|cheia\s+de\s+energia|a\s+mil|energia\s+total)\b/.test(n)) { v = 5; conf = 0.7; }
    else if (/\b(?:disposta|animada|com\s+energia|bem\s+disposta)\b/.test(n) && /\b(?:estou|to|me\s+sinto|hoje)\b/.test(n)) { v = 4; conf = 0.65; }
    if (v == null) return null;
    var rot = Y && Y.ENERGY ? Y.ENERGY[v - 1][2].toLowerCase() : String(v);
    return { tipo: 'energia', confianca: conf, resumo: 'Entendi: energia de hoje ' + v + ' de 5 (' + rot + ')', dados: { energia: v, data: C.toDateKey(agora) } };
  }

  /* ---------------- Treino ---------------- */

  function detectarTreino(texto, agora, state, base) {
    if (/\b(?:comecar|iniciar|inicio\s+d[oe]|bora|vamos|vou)\s+(?:o\s+|meu\s+|a\s+|pro\s+)?(?:treino|academia|treinar)\b|\btreinar\s+agora\b|\bhora\s+do\s+treino\b/.test(base.n)) {
      return { tipo: 'treino', confianca: 0.9, resumo: 'Entendi: começar o treino de hoje', dados: {} };
    }
    return null;
  }

  /* ---------------- Conta ---------------- */

  var CATEGORIAS = [
    [/\b(?:luz|energia|agua|esgoto|gas|aluguel|condominio|iptu|internet|wifi|telefone|celular)\b/, 'Moradia'],
    [/\b(?:mercado|supermercado|ifood|restaurante|feira)\b/, 'Alimentação'],
    [/\b(?:uber|onibus|gasolina|combustivel|estacionamento|ipva|seguro\s+do\s+carro|transporte)\b/, 'Transporte'],
    [/\b(?:farmacia|medico|dentista|plano\s+de\s+saude|consulta|exame|remedio)\b/, 'Saúde'],
    [/\b(?:salao|cabelo|unha|estetica|maquiagem|manicure|depilacao)\b/, 'Beleza'],
    [/\b(?:cartao|fatura)\b/, 'Cartão'],
    [/\b(?:netflix|spotify|assinatura|prime|disney|youtube|icloud|globoplay)\b/, 'Assinaturas']
  ];
  function detectarConta(texto, agora, state, base) {
    var n = base.n;
    var temConta = /\bconta\b/.test(n), temPagar = /\b(?:pagar|vence|vencimento|boleto|fatura|parcela|mensalidade)\b/.test(n);
    if (!(temConta || temPagar)) return null;
    var RE_RS = /\br\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/, RE_REAIS = /\b(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|conto|contos|pila|pilas)\b/;
    var dinheiro = RE_RS.exec(n) || RE_REAIS.exec(n), valor = dinheiro && dinheiro[1], trecho = null;
    if (!valor) {
      // sem "R$" nem "reais": número com milhar/vírgula, ou com 2+ dígitos que não seja dia nem hora
      var t = n.replace(/\b(?:dia|as|ate)\s+\d{1,2}\b/g, function (x) { return new Array(x.length + 1).join(' '); })
        .replace(/\b\d{1,2}\s*(?:h|hs|horas?)\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, function (x) { return new Array(x.length + 1).join(' '); });
      var mm = /\b(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d{2,})\b/.exec(t);
      if (mm) { valor = mm[1]; trecho = mm[0]; }
    }
    if (!valor) return null;
    var cents = C.parseMoneyToCents(valor);
    if (cents == null || cents <= 0) return null;
    var ctx = ctxDe(texto, agora);
    if (!comer(ctx, new RegExp(RE_RS.source)) && !comer(ctx, new RegExp(RE_REAIS.source)) && trecho) {
      var pos = ctx.n.indexOf(trecho);
      if (pos >= 0) { var bl = new Array(trecho.length + 1).join(' '); ctx.n = ctx.n.slice(0, pos) + bl + ctx.n.slice(pos + trecho.length); ctx.w = ctx.w.slice(0, pos) + bl + ctx.w.slice(pos + trecho.length); }
    }
    comer(ctx, RE_GATILHO);
    var q = extrairQuando(ctx), rec = q.rec && q.rec.tipo === 'monthly' ? 'monthly' : 'once';
    var temDe = /\bconta\s+(?:de|da|do|dos|das)\s+/.test(base.n);
    comer(ctx, /\b(?:vence|vencimento|pagar|paguei|boleto|fatura|parcela|mensalidade|valor|de\s+valor|no\s+valor|custa|custou)\b/);
    var resto = ctx.w.replace(/\s+/g, ' ').trim();
    var titulo;
    if (temDe) { titulo = limparTitulo(resto.replace(/^\s*conta\b/i, '').trim()); titulo = titulo ? 'Conta de ' + titulo.replace(/^(?:de|da|do|dos|das)\s+/i, '').toLowerCase() : 'Conta'; }
    else titulo = limparTitulo(resto.replace(/\bconta\b/i, '')) || 'Conta';
    var categoria = 'Outros';
    for (var i = 0; i < CATEGORIAS.length; i++) if (CATEGORIAS[i][0].test(n)) { categoria = CATEGORIAS[i][1]; break; }
    var data = q.data, aviso = null;
    if (!data) { data = C.toDateKey(agora); aviso = 'Não ouvi o dia do vencimento: usei hoje. Toque em Editar para mudar.'; }
    return {
      tipo: 'conta', confianca: aviso ? 0.7 : 0.9, aviso: aviso,
      resumo: 'Entendi: conta “' + titulo + '” de ' + C.formatCents(cents) + ' • vence ' + rotuloData(data, ctx.hoje) + (rec === 'monthly' ? ' • todo mês' : '') + ' • ' + categoria,
      dados: { titulo: titulo, cents: cents, data: data, recorrencia: rec, categoria: categoria }
    };
  }

  /* ---------------- Alimento ---------------- */

  // peso aproximado de uma porção, por alimento e unidade (g)
  var PESOS = [
    [/\bovos?\b/, { un: 50 }], [/\bbananas?\b/, { un: 90 }], [/\bmacas?\b/, { un: 130 }], [/\blaranjas?\b/, { un: 140 }], [/\b(?:tangerinas?|mexericas?)\b/, { un: 100 }],
    [/\b(?:mamao|papaia)\b/, { fatia: 150, un: 300 }], [/\bpao\s+de\s+queijo\b/, { un: 25 }], [/\bpao\s+de\s+forma\b/, { un: 25, fatia: 25 }], [/\b(?:torradas?)\b/, { un: 10, fatia: 10 }],
    [/\b(?:pao\s+frances|paozinho|pao)\b|\bpaes\b/, { un: 50, fatia: 25 }], [/\biogurtes?\b/, { un: 170, pote: 170, copo: 170 }], [/\bqueijo\b/, { fatia: 20, un: 20 }],
    [/\b(?:presunto|peito\s+de\s+peru|mortadela)\b/, { fatia: 15, un: 15 }], [/\bleite\b/, { copo: 200, xicara: 200, un: 200 }], [/\bsuco\b/, { copo: 200, un: 200 }],
    [/\bcafe\b/, { xicara: 50, copo: 100, un: 50 }], [/\barroz\b/, { colher: 25, un: 100, prato: 150, concha: 60 }], [/\bfeijao\b/, { concha: 80, colher: 20, un: 80 }],
    [/\btomates?\b/, { un: 100 }], [/\bbatatas?\b/, { un: 130 }], [/\bcenouras?\b/, { un: 70 }], [/\bbolo\b/, { fatia: 60, un: 60 }], [/\b(?:biscoitos?|bolachas?)\b/, { un: 6 }],
    [/\bbarras?\s+de\s+cereal\b/, { un: 25 }], [/\bpizza\b/, { fatia: 110, un: 110 }], [/\baveia\b/, { colher: 15 }], [/\bmel\b/, { colher: 20 }]
  ];
  var GENERICO = { fatia: 25, colher: 15, colher_cha: 5, xicara: 150, copo: 200, pote: 170, prato: 300, concha: 80, un: 100 };
  var UNIDADES = '(g|gr|grs|gramas?|kg|quilos?|ml|l|litros?|unidades?|un|fatias?|pedacos?|colher(?:es)?(?:\\s+de\\s+(?:sopa|cha|sobremesa|cafe))?|xicaras?|copos?|potes?|pratos?|conchas?|porcoes?|porcao)';
  var RE_ITEM = new RegExp('^\\s*(?:' + QTY + '\\s*' + UNIDADES + '?\\b\\s*(?:de\\s+)?)?(.+)$');
  var RE_VERBO_COMER = /\b(?:comi|comendo|almocei|jantei|lanchei|ceei|tomei|bebi|devorei|mandei|belisquei)\b/;

  function singular(w) {
    if (w.length <= 3) return w;
    if (/oes$/.test(w)) return w.slice(0, -3) + 'ao';
    if (/aes$/.test(w)) return w.slice(0, -3) + 'ao';
    if (/res$/.test(w) || /zes$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function chaveUnidade(u) {
    if (!u) return 'un';
    if (/^(unid|un$|pedaco)/.test(u)) return 'un';
    if (/^fatia/.test(u)) return 'fatia';
    if (/^colher/.test(u)) return /cha|cafe/.test(u) ? 'colher_cha' : 'colher';
    if (/^xicara/.test(u)) return 'xicara';
    if (/^copo/.test(u)) return 'copo';
    if (/^pote/.test(u)) return 'pote';
    if (/^prato/.test(u)) return 'prato';
    if (/^concha/.test(u)) return 'concha';
    if (/^porc/.test(u)) return 'un';
    return 'un';
  }
  var ROT_UN = { un: ['unidade', 'unidades'], fatia: ['fatia', 'fatias'], colher: ['colher de sopa', 'colheres de sopa'], colher_cha: ['colher de chá', 'colheres de chá'], xicara: ['xícara', 'xícaras'], copo: ['copo', 'copos'], pote: ['pote', 'potes'], prato: ['prato', 'pratos'], concha: ['concha', 'conchas'] };
  function rotuloUnidade(ch, qtd) { var r = ROT_UN[ch] || ROT_UN.un; return qtd > 1 ? r[1] : r[0]; }
  function gramas(qtd, un, nome) {
    if (/^(g|gr|grs|grama)/.test(un || '')) return { g: Math.round(qtd * 10) / 10, estimado: false };
    if (/^(kg|quilo)/.test(un || '')) return { g: Math.round(qtd * 1000), estimado: false };
    if (/^ml$/.test(un || '')) return { g: Math.round(qtd), estimado: false };
    if (/^(l|litro)/.test(un || '')) return { g: Math.round(qtd * 1000), estimado: false };
    var ch = chaveUnidade(un), tab = null;
    for (var i = 0; i < PESOS.length; i++) if (PESOS[i][0].test(nome)) { tab = PESOS[i][1]; break; }
    if (tab && tab[ch] != null) return { g: Math.round(qtd * tab[ch]), estimado: true, cada: tab[ch], conhecido: true };
    if (tab && ch === 'un' && tab.un != null) return { g: Math.round(qtd * tab.un), estimado: true, cada: tab.un, conhecido: true };
    return { g: Math.round(qtd * GENERICO[ch]), estimado: true, cada: GENERICO[ch], conhecido: false };
  }

  function preferirPreparado(f) {
    var k = f.key || '', g = (f.group || '').toLowerCase();
    var cozinha = /carne|cerea|leguminos|pescado|ovo|tuberc/.test(fold(g));
    if (!cozinha) return 0;
    if (/\bcozid/.test(k)) return -4;
    if (/\bassad|grelhad|refogad/.test(k)) return -3;
    if (/\bfrit|prepar/.test(k)) return -1;
    if (/\bcru\b|\bcrua\b|\bcrus\b/.test(k)) return 6;
    return 0;
  }
  // O que a maioria das pessoas quer dizer com a palavra solta (a TACO tem dezenas de variações).
  var PREFERIDOS = [
    [/^arroz$/, /^arroz tipo 1 cozido$/], [/^feijao$/, /^feijao carioca cozido$/], [/^frango$/, /^frango peito sem pele cozido$/], [/^ovos?$/, /^ovo de galinha inteiro cozido/],
    [/^leite$/, /^leite de vaca integral$/], [/^(?:pao|paes)$/, /^pao trigo frances$/], [/^bananas?$/, /^banana prata crua$/], [/^macas?$/, /^maca fuji com casca crua$/],
    [/^batatas?$/, /^batata inglesa cozida$/], [/^cafe$/, /^cafe infusao/], [/^iogurtes?$/, /^iogurte natural$/], [/^queijo$/, /^queijo minas frescal$/], [/^tomates?$/, /^tomate com semente cru$/],
    [/^carne$/, /^carne bovina patinho sem gordura grelhado$/], [/^macarrao$/, /^macarrao trigo cru$/], [/^salmao$/, /^salmao sem pele fresco grelhado$/], [/^batatas? doces?$/, /^batata doce cozida$/],
    [/^aveia$/, /^aveia flocos crua$/], [/^pao forma$/, /^pao trigo forma integral$/], [/^pao queijo$/, /^pao de queijo assado$/],
    [/^(?:peito frango|frango peito)$/, /^frango peito sem pele cozido$/],
    [/^frango(?: (?:grelhado|cozido|assado|frito|refogado))?$/, function (q) { return new RegExp('^frango peito sem pele ' + (/grelhad/.test(q) ? 'grelhado' : /assad/.test(q) ? 'assado' : 'cozido') + '$'); }]
  ];
  var STOP = /^(?:de|da|do|das|dos|com|em|e|um|uma)$/;
  function acharAlimentos(state, nome) {
    if (!N || !nome) return [];
    var q = nome.split(/\s+/).filter(function (w) { return w && !STOP.test(w); }).join(' ');
    if (!q) return [];
    var sing = q.split(/\s+/).map(singular).join(' '), res = [];
    [sing, q].forEach(function (v) { if (!res.length && v) res = N.search(state, v, 16); });
    if (!res.length && q.indexOf(' ') > 0) res = N.search(state, singular(q.split(/\s+/)[0]), 16);
    return res.map(function (f, i) {
      var bonus = 0;
      PREFERIDOS.forEach(function (p) {
        if (!(p[0].test(q) || p[0].test(sing))) return;
        var re = typeof p[1] === 'function' ? p[1](q) : p[1];
        if (re.test(f.key)) bonus = -20;
      });
      return { f: f, s: i + preferirPreparado(f) + bonus };
    }).sort(function (a, b) { return a.s - b.s; }).map(function (x) { return x.f; });
  }

  var REFEICOES = [
    [/\b(?:cafe\s+da\s+manha|cafe)\b/, 'breakfast'], [/\blanche\s+da\s+manha\b/, 'morning_snack'], [/\blanche\s+da\s+tarde\b/, 'afternoon_snack'], [/\blanche\b/, 'afternoon_snack'],
    [/\balmoco\b/, 'lunch'], [/\b(?:jantar|janta)\b/, 'dinner'], [/\bceia\b/, 'supper']
  ];
  function chutarRefeicao(agora) {
    var h = agora.getHours();
    return h < 10 ? 'breakfast' : h < 12 ? 'morning_snack' : h < 15 ? 'lunch' : h < 18 ? 'afternoon_snack' : h < 21 ? 'dinner' : 'supper';
  }

  function detectarAlimento(texto, agora, state, base) {
    var v = RE_VERBO_COMER.exec(base.n);
    if (!v) return null;
    var ctx = ctxDe(texto, agora), data = ctx.hoje;
    if (comer(ctx, /\banteontem\b/)) data = C.addDays(ctx.hoje, -2);
    else if (comer(ctx, /\bontem\b/)) data = C.addDays(ctx.hoje, -1);
    comer(ctx, /\bhoje\b/);
    comer(ctx, RE_VERBO_COMER);
    var refeicao = null;
    var mm = /\b(?:no|na|de|para|pro|pra|do|da|como|como\s+meu|durante\s+o)\s+(cafe\s+da\s+manha|cafe|lanche\s+da\s+manha|lanche\s+da\s+tarde|lanche|almoco|jantar|janta|ceia)\b/.exec(ctx.n);
    if (mm) { for (var i = 0; i < REFEICOES.length; i++) if (REFEICOES[i][0].test(mm[1])) { refeicao = REFEICOES[i][1]; break; } comer(ctx, /\b(?:no|na|de|para|pro|pra|do|da|como|como\s+meu|durante\s+o)\s+(?:cafe\s+da\s+manha|cafe|lanche\s+da\s+manha|lanche\s+da\s+tarde|lanche|almoco|jantar|janta|ceia)\b/); }
    if (!refeicao) {
      var vb = v[0];
      refeicao = /almocei/.test(vb) ? 'lunch' : /jantei/.test(vb) ? 'dinner' : /lanchei/.test(vb) ? 'afternoon_snack' : /ceei/.test(vb) ? 'supper' : null;
    }
    if (!refeicao) refeicao = chutarRefeicao(agora);
    // tira "hoje de manhã", "agora" etc. e separa os alimentos ("arroz e feijão", "ovo, pão")
    comer(ctx, /\b(?:agora|agorinha|a\s+pouco|ha\s+pouco|hoje|ja)\b/);
    var corpo = ctx.n.replace(/\bum\s+e\s+(meio|meia)\b/g, 'umemeio$1').replace(/\b(dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+e\s+(meio|meia)\b/g, '$1emeio$2');
    var corpoW = ctx.w, partes = [], pos = 0, re = /\s*(?:,(?!\d)|\be\b|\bcom\b|\bmais\b)\s*/g, mt;
    while ((mt = re.exec(corpo))) { partes.push([pos, mt.index]); pos = mt.index + mt[0].length; }
    partes.push([pos, corpo.length]);
    var itens = [], avisos = [];
    partes.forEach(function (p) {
      var raw = corpo.slice(p[0], p[1]).replace(/umemeio(meio|meia)/g, 'um e $1').replace(/(dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)emeio(meio|meia)/g, '$1 e $2').trim();
      void corpoW;
      raw = raw.replace(/^(?:um\s+pouco\s+de|pouco|bastante|muito|uns|umas|algumas?|alguns|mais)\s+/, '').trim();
      if (!raw || raw.length < 2) return;
      // quantidade no fim ("suco de laranja 300 ml") ou no começo ("2 ovos", "150 g de arroz")
      var fim = new RegExp('^(.*?)\\s+' + QTY + '\\s*' + UNIDADES + '\\s*$').exec(raw), m, qtd, un, nome;
      if (fim && fim[1] && !/^\d/.test(raw)) { qtd = parseQty(fim[2]); un = fim[3] || ''; nome = fim[1]; }
      else {
        m = RE_ITEM.exec(raw);
        if (!m) return;
        qtd = m[1] != null ? parseQty(m[1]) : null; un = m[2] || ''; nome = m[3] || '';
      }
      nome = nome.trim().replace(/^de\s+/, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!nome) return;
      if (qtd == null) qtd = 1;
      if (/^agua\b/.test(nome) && !/^agua\s+de\s+coco/.test(nome)) return;
      if (/\b(?:vitamina|remedio|comprimido|suplemento|medicamento|capsula|creatina|whey|colageno)\b/.test(nome)) return;
      var achados = acharAlimentos(state, nome);
      if (!achados.length) return;
      var g = gramas(qtd, un, nome), f = achados[0];
      var aviso = null;
      var rotUn = rotuloUnidade(chaveUnidade(un), qtd), alim = f.name.split(',')[0].toLowerCase();
      if (g.estimado && qtd === 1 && !un && !/\b(?:ovo|banana|maca|laranja|iogurte|tomate|batata|cenoura|pao)/.test(nome)) aviso = 'Estimei uma porção de ' + alim + ' ≈ ' + g.g + ' g. Confira a quantidade.';
      else if (g.estimado && g.conhecido) aviso = 'Estimei ' + String(qtd).replace('.', ',') + ' ' + rotUn + ' de ' + alim + ' ≈ ' + g.g + ' g (' + g.cada + ' g cada). Confira a quantidade.';
      else if (g.estimado) aviso = 'Não sei o peso de ' + (qtd === 1 ? '1 ' + rotUn : String(qtd).replace('.', ',') + ' ' + rotUn) + ' de ' + alim + ': estimei ' + g.g + ' g. Quantos gramas foram?';
      if (aviso) avisos.push(aviso);
      itens.push({ foodId: f.id, nome: f.name, gramas: g.g, estimado: g.estimado, conhecido: g.conhecido !== false, alternativas: achados.slice(1, 3).map(function (a) { return { foodId: a.id, nome: a.name }; }) });
    });
    if (!itens.length) return null;
    var algumGenerico = itens.some(function (i) { return i.estimado && !i.conhecido; }), algumEstim = itens.some(function (i) { return i.estimado; });
    var conf = algumGenerico ? 0.62 : algumEstim ? 0.8 : 0.9;
    var dados = { itens: itens, refeicao: refeicao, data: data, foodId: itens[0].foodId, nome: itens[0].nome, gramas: itens[0].gramas };
    return { tipo: 'alimento', confianca: conf, aviso: avisos.length ? avisos[0] : null, resumo: resumoAlimento(dados, ctx.hoje), dados: dados };
  }
  function resumoAlimento(d, hoje) {
    var rot = d.itens.map(function (i) { return String(i.gramas).replace('.', ',') + ' g de ' + i.nome.split(',')[0].toLowerCase() + (i.nome.indexOf(',') > 0 ? ' (' + i.nome.slice(i.nome.indexOf(',') + 1).trim() + ')' : ''); }).join(' + ');
    return 'Entendi: ' + rot + ' • ' + C.MEAL_TYPES[d.refeicao].toLowerCase() + (d.data !== hoje ? ' • ' + rotuloData(d.data, hoje) : '');
  }
  // Troca o alimento escolhido de um item (a usuária toca numa alternativa). Devolve a intenção atualizada.
  function trocarAlimento(it, indice, foodId, state, agora) {
    var item = it && it.dados && it.dados.itens && it.dados.itens[indice], f = N && N.foodById(state, foodId);
    if (!item || !f) return it;
    var antigo = { foodId: item.foodId, nome: item.nome };
    item.alternativas = [antigo].concat((item.alternativas || []).filter(function (a) { return a.foodId !== foodId; })).slice(0, 3);
    item.foodId = f.id; item.nome = f.name;
    if (indice === 0) { it.dados.foodId = f.id; it.dados.nome = f.name; }
    it.resumo = resumoAlimento(it.dados, C.toDateKey(agora || new Date()));
    return it;
  }

  /* ---------------- Interpretar ---------------- */

  function interpretar(texto, agora, state) {
    agora = agora || new Date();
    texto = String(texto == null ? '' : texto).trim();
    if (!texto) return [];
    var ctx = ctxDe(texto, agora), base = { n: ctx.n, w: ctx.w };
    var out = [];
    [detectarConta, detectarAgua, detectarPeso, detectarEnergia, detectarTreino, detectarAlimento].forEach(function (fn) {
      var r = null;
      try { r = fn(texto, agora, state, base); } catch (e) { r = null; }
      if (r) out.push(r);
    });
    var t = null;
    try { t = detectarTarefa(texto, agora, base); } catch (e) { t = null; }
    if (t) out.push(t);
    return out.map(function (x, i) { x._o = i; return x; }).sort(function (a, b) { return b.confianca - a.confianca || a._o - b._o; }).map(function (x) { delete x._o; return x; });
  }

  /* ---------------- Aplicar / desfazer ---------------- */

  function aplicar(state, it, nowISO) {
    var d = it.dados || {}, r;
    switch (it.tipo) {
      case 'tarefa': {
        r = R.validateTask({ title: d.titulo, dueDate: d.data || '', dueTime: d.hora || '', recurrence: d.recorrencia || 'none', weekdays: d.diasSemana || [], reminderMinutes: d.lembrete, category: 'Pessoal', priority: 'normal' });
        if (!r.ok) return { ok: false, erro: Object.keys(r.errors).map(function (k) { return r.errors[k]; })[0] };
        var t = R.createTask(state, r.value, nowISO);
        return { ok: true, mensagem: 'Tarefa adicionada.', desfazer: { tipo: 'tarefa', id: t.id }, lembrete: r.value.reminderMinutes != null };
      }
      case 'agua': {
        var l = R.addWater(state, d.data, d.ml, nowISO);
        return l ? { ok: true, mensagem: R.formatMl(d.ml) + ' de água registrados.', desfazer: { tipo: 'agua', id: l.id } } : { ok: false, erro: 'Quantidade de água inválida.' };
      }
      case 'peso': {
        r = B.validateRecord({ date: d.data, weightKg: d.kg });
        if (!r.ok) return { ok: false, erro: Object.keys(r.errors).map(function (k) { return r.errors[k]; })[0] };
        var rec = B.createRecord(state, r.value, nowISO);
        return { ok: true, mensagem: 'Peso de ' + String(d.kg).replace('.', ',') + ' kg registrado.', desfazer: { tipo: 'peso', id: rec.id } };
      }
      case 'alimento': {
        var ids = [];
        (d.itens || []).forEach(function (i) {
          var v = N.validateFoodLog({ date: d.data, meal: d.refeicao, foodId: i.foodId, grams: i.gramas });
          if (!v.ok) return;
          var log = N.addFoodLog(state, v.value, nowISO);
          if (log) ids.push(log.id);
        });
        return ids.length ? { ok: true, mensagem: ids.length + (ids.length === 1 ? ' alimento adicionado' : ' alimentos adicionados') + ' em ' + C.MEAL_TYPES[d.refeicao].toLowerCase() + '.', desfazer: { tipo: 'alimento', ids: ids } } : { ok: false, erro: 'Não consegui registrar este alimento.' };
      }
      case 'energia': {
        var antes = Y.dayLog(state, d.data); var prev = antes && antes.energy != null ? antes.energy : null;
        Y.setDay(state, d.data, { energy: d.energia }, nowISO);
        return { ok: true, mensagem: 'Energia de hoje: ' + d.energia + ' de 5.', desfazer: { tipo: 'energia', data: d.data, antes: prev } };
      }
      case 'conta': {
        r = R.validateBill({ title: d.titulo, amount: C.centsToInput(d.cents), category: d.categoria, dueDate: d.data, recurrence: d.recorrencia === 'monthly' ? 'monthly' : 'once', reminderDaysBefore: 1, reminderTime: '09:00' });
        if (!r.ok) return { ok: false, erro: Object.keys(r.errors).map(function (k) { return r.errors[k]; })[0] };
        var b = R.createBill(state, r.value, nowISO);
        return { ok: true, mensagem: 'Conta adicionada.', desfazer: { tipo: 'conta', id: b.id } };
      }
      case 'treino':
        return { ok: true, acao: 'treino', mensagem: 'Vamos treinar!' };
    }
    return { ok: false, erro: 'Não sei criar isto ainda.' };
  }

  function desfazer(state, d) {
    if (!d) return false;
    switch (d.tipo) {
      case 'tarefa': R.deleteTask(state, d.id); return true;
      case 'agua': R.removeById(state.waterLogs, d.id); return true;
      case 'peso': B.deleteRecord(state, d.id); return true;
      case 'alimento': (d.ids || []).forEach(function (id) { N.deleteFoodLog(state, id); }); return true;
      case 'energia': Y.setDay(state, d.data, { energy: d.antes }, new Date().toISOString()); return true;
      case 'conta': R.deleteBill(state, d.id); return true;
    }
    return false;
  }

  return { interpretar: interpretar, aplicar: aplicar, desfazer: desfazer, trocarAlimento: trocarAlimento, fold: fold };
});
