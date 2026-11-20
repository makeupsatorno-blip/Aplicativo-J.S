/*
 * J.S. — relatório em PDF (treino, alimentação, medidas, água, ciclo e fotos de um período).
 * Tudo é montado NO APARELHO (js/pdf.js); nada vai para servidor. A usuária escolhe com quem compartilhar.
 *
 *   JSRelatorio.periodo(tipo, agora, de, ate) -> { de, ate }      tipo: 'mes' | 'passado' | '30' | 'custom'
 *   JSRelatorio.coletar(state, { de, ate, secoes }, agora)        -> dados de cada seção (null = sem dados)
 *   JSRelatorio.montarPdf(state, { de, ate, secoes, fotos }, agora) -> Uint8Array
 *   JS.relatorio.abrir()                                           folha "Relatório do período"
 */
(function (root, factory) {
  var req = typeof require === 'function';
  var C = root && root.JSCore ? root.JSCore : (req ? require('./core.js') : null);
  var R = root && root.JSRegras ? root.JSRegras : (req ? require('./regras.js') : null);
  var T = root && root.JSTreino ? root.JSTreino : (req ? require('./regras-treino.js') : null);
  var N = root && root.JSNutri ? root.JSNutri : (req ? require('./regras-nutricao.js') : null);
  var B = root && root.JSCorpo ? root.JSCorpo : (req ? require('./regras-corpo.js') : null);
  var Y = root && root.JSCiclo ? root.JSCiclo : (req ? require('./regras-ciclo.js') : null);
  var P = root && root.JSPdf ? root.JSPdf : (req ? require('./pdf.js') : null);
  var api = factory(C, R, T, N, B, Y, P);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.JSRelatorio = api;
    if (root.JS && root.document) api.registrar(root.JS);
  }
})(typeof self !== 'undefined' ? self : this, function (C, R, T, N, B, Y, P) {
  'use strict';

  var SECOES = ['treino', 'alimentacao', 'medidas', 'agua', 'ciclo', 'fotos'];
  var PADRAO = { treino: true, alimentacao: true, medidas: true, agua: true, ciclo: false, fotos: false };

  /* ---------------- Utilidades ---------------- */

  function fmt(n, dec) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec == null ? 0 : dec }); }
  function media(list) { return list.length ? list.reduce(function (a, b) { return a + b; }, 0) / list.length : null; }
  function dur(min) { min = Math.round(min || 0); return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + C.pad(min % 60) + ' min'; }
  function dias(de, ate) { return C.diffDays(de, ate) + 1; }
  function dm(key) { return C.formatDayMonth(key); }
  function noPeriodo(key, de, ate) { return key >= de && key <= ate; }

  function periodo(tipo, agora, de, ate) {
    var hoje = C.toDateKey(agora || new Date()), mk = C.monthOf(hoje);
    if (tipo === 'passado') { var pm = C.addMonthKey(mk, -1), r = C.monthRange(pm); return { de: r.from, ate: r.to }; }
    if (tipo === '30') return { de: C.addDays(hoje, -29), ate: hoje };
    if (tipo === 'custom') return { de: de, ate: ate };
    var m = C.monthRange(mk);
    return { de: m.from, ate: hoje < m.to ? hoje : m.to };
  }
  function validarPeriodo(p) {
    if (!C.isDateKey(p.de) || !C.isDateKey(p.ate)) return 'Escolha as duas datas.';
    if (p.ate < p.de) return 'O fim precisa ser depois do início.';
    if (dias(p.de, p.ate) > 400) return 'Escolha um período de até 13 meses.';
    return null;
  }

  /* ---------------- Dados de cada seção ---------------- */

  function coletarTreino(s, de, ate) {
    var sessoes = T.doneSessions(s).filter(function (x) { return noPeriodo(x.date, de, ate); });
    if (!sessoes.length) return null;
    var linhas = [], tot = { treinos: 0, series: 0, volume: 0, minutos: 0 }, grupos = {}, ids = {};
    sessoes.forEach(function (x) {
      var n = T.sessionSummary(s, x);
      linhas.push({ data: x.date, ficha: x.planName, series: n.sets, volume: n.volume, minutos: n.minutes });
      tot.treinos++; tot.series += n.sets; tot.volume += n.volume; tot.minutos += n.minutes;
      x.items.forEach(function (it) {
        if (!it.sets.length) return;
        var ex = T.exerciseById(s, it.exerciseId), g = (ex && T.GRUPOS[ex.group]) || 'Outro';
        grupos[g] = (grupos[g] || 0) + it.sets.length;
        var e = ids[it.exerciseId] = ids[it.exerciseId] || { id: it.exerciseId, nome: it.name, n: 0 };
        e.n++;
      });
    });
    var recordes = [];
    Object.keys(ids).forEach(function (id) {
      T.exerciseRecords(s, id).events.forEach(function (e) { if (noPeriodo(e.date, de, ate)) recordes.push(e); });
    });
    recordes.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var evolucao = Object.keys(ids).map(function (id) { return ids[id]; }).sort(function (a, b) { return b.n - a.n || a.nome.localeCompare(b.nome); }).slice(0, 4).map(function (e) {
      var pts = T.exerciseHistory(s, e.id).filter(function (h) { return noPeriodo(h.date, de, ate); });
      return { nome: T.exerciseName(s, e.id, e.nome), pontos: pts.map(function (h) { return { data: h.date, carga: h.maxLoad }; }) };
    }).filter(function (e) { return e.pontos.length >= 2; });
    var gr = Object.keys(grupos).map(function (k) { return { label: k, series: grupos[k] }; }).sort(function (a, b) { return b.series - a.series; });
    return { sessoes: linhas, totais: tot, recordes: recordes, evolucao: evolucao, grupos: gr };
  }

  function coletarAlimentacao(s, de, ate) {
    var dias_ = N.dailyTotals(s, de, ate).filter(function (d) { return d.count > 0; });
    if (!dias_.length) return null;
    function col(k) { return dias_.map(function (d) { return d.total[k] || 0; }); }
    var kcal = N.kcalTarget(s, ate), prot = N.proteinTarget(s);
    return {
      dias: dias_.map(function (d) { return { data: d.date, kcal: d.total.kcal || 0, prot: d.total.prot || 0, carb: d.total.carb || 0, lip: d.total.lip || 0, itens: d.count }; }),
      media: { kcal: media(col('kcal')), prot: media(col('prot')), carb: media(col('carb')), lip: media(col('lip')) },
      metaKcal: kcal ? kcal.value : null, metaProt: prot ? prot.value : null,
      semRegistro: dias(de, ate) - dias_.length, totalDias: dias(de, ate)
    };
  }

  function coletarMedidas(s, de, ate) {
    var regs = B.sorted(s).filter(function (r) { return noPeriodo(r.date, de, ate); });
    if (!regs.length) return null;
    var campos = [['weightKg', 'Peso (kg)', 1], ['fatPct', 'Gordura (%)', 1], ['muscleKg', 'Músculo (kg)', 1], ['waistCm', 'Cintura (cm)', 1], ['hipCm', 'Quadril (cm)', 1]].filter(function (c) { return regs.some(function (r) { return r[c[0]] != null; }); });
    var primeiro = regs[0], ultimo = regs[regs.length - 1], mudancas = [];
    campos.forEach(function (c) {
      var vals = regs.filter(function (r) { return r[c[0]] != null; });
      if (vals.length >= 2) mudancas.push({ rotulo: c[1].replace(/ \(.*\)/, ''), de: vals[0][c[0]], ate: vals[vals.length - 1][c[0]], delta: Math.round((vals[vals.length - 1][c[0]] - vals[0][c[0]]) * 10) / 10, unid: (c[1].match(/\((.*)\)/) || [])[1] || '' });
    });
    var altura = s.settings && s.settings.body && s.settings.body.heightCm, imc = altura && ultimo.weightKg ? B.bmi(ultimo.weightKg, altura) : null;
    return { campos: campos, registros: regs, mudancas: mudancas, imc: imc, imcClasse: imc ? (B.bmiClass(imc) || {}).label : null, primeiro: primeiro, ultimo: ultimo };
  }

  function coletarAgua(s, de, ate) {
    var lista = R.waterDays(s, de, ate), com = lista.filter(function (d) { return d.ml > 0; });
    if (!com.length) return null;
    var meta = R.waterGoal(s).ml;
    return { dias: lista, mediaMl: media(com.map(function (d) { return d.ml; })), metaMl: meta, diasMeta: com.filter(function (d) { return d.ml >= meta; }).length, diasComRegistro: com.length, totalDias: lista.length };
  }

  function coletarCiclo(s, de, ate) {
    if (!Y || !Y.enabled(s)) return null;
    var hist = Y.history(s).filter(function (h) { return h.end >= de && h.start <= ate; });
    if (!hist.length) return null;
    var st = Y.stats(s), ph = null;
    try { ph = Y.phaseStats(s, ate); } catch (e) { ph = null; }
    return { ciclos: hist.slice().reverse(), cicloMedio: st.cycleLen, menstruacaoMedia: st.periodLen, medidos: st.measured, fases: ph };
  }

  function coletar(state, opcoes, agora) {
    var de = opcoes.de, ate = opcoes.ate, sec = Object.assign({}, PADRAO, opcoes.secoes || {}), out = { de: de, ate: ate, nome: ((state.settings && state.settings.name) || '').trim(), secoes: sec };
    if (sec.treino) out.treino = coletarTreino(state, de, ate);
    if (sec.alimentacao) out.alimentacao = coletarAlimentacao(state, de, ate);
    if (sec.medidas) out.medidas = coletarMedidas(state, de, ate);
    if (sec.agua) out.agua = coletarAgua(state, de, ate);
    if (sec.ciclo) out.ciclo = coletarCiclo(state, de, ate);
    return out;
  }

  /* ---------------- PDF ---------------- */

  function montarPdf(state, opcoes, agora) {
    agora = agora || new Date();
    var d = coletar(state, opcoes, agora), hoje = C.formatDateBR(C.toDateKey(agora));
    var doc = P.criar({ titulo: 'Relatório J.S.', autor: d.nome || 'J.S.', assunto: 'Relatório de ' + C.formatDateBR(d.de) + ' a ' + C.formatDateBR(d.ate), data: agora,
      rodape: 'Gerado pelo J.S. em ' + hoje + '. Valores da Tabela TACO. Referência geral, não substitui orientação profissional.' });
    doc.titulo('Relatório J.S.', (d.nome ? d.nome + '  •  ' : '') + C.formatDateBR(d.de) + ' a ' + C.formatDateBR(d.ate) + '  (' + dias(d.de, d.ate) + (dias(d.de, d.ate) === 1 ? ' dia)' : ' dias)'));
    var algum = false;

    if (d.treino) {
      algum = true;
      var t = d.treino;
      doc.secao('Treino');
      doc.kpis([{ valor: String(t.totais.treinos), rotulo: t.totais.treinos === 1 ? 'treino' : 'treinos' }, { valor: fmt(t.totais.series), rotulo: 'séries' }, { valor: fmt(t.totais.volume) + ' kg', rotulo: 'volume (carga × repetições)' },
        { valor: dur(t.totais.minutos), rotulo: 'tempo de treino' }, { valor: String(t.recordes.length), rotulo: t.recordes.length === 1 ? 'recorde pessoal' : 'recordes pessoais' }]);
      doc.subsecao('Treinos feitos');
      doc.tabela({ colunas: [{ t: 'Data', w: 1 }, { t: 'Ficha', w: 4 }, { t: 'Séries', w: 1, a: 'right' }, { t: 'Volume', w: 1.5, a: 'right' }, { t: 'Duração', w: 1.5, a: 'right' }],
        linhas: t.sessoes.map(function (x) { return [dm(x.data), x.ficha, String(x.series), fmt(x.volume) + ' kg', dur(x.minutos)]; }) });
      if (t.recordes.length) {
        doc.subsecao('Recordes pessoais do período');
        doc.tabela({ colunas: [{ t: 'Data', w: 1 }, { t: 'Exercício', w: 4 }, { t: 'Recorde', w: 4 }],
          linhas: t.recordes.map(function (e) {
            return [dm(e.date), e.name, e.kind === 'reps' ? e.reps + ' rep. com ' + fmt(e.load, 1) + ' kg (antes ' + e.prevReps + ')' : fmt(e.load, 1) + ' kg × ' + e.reps + (e.prevLoad ? ' (antes ' + fmt(e.prevLoad, 1) + ' kg)' : '')];
          }) });
      }
      if (t.evolucao.length) {
        doc.subsecao('Evolução da carga máxima');
        t.evolucao.forEach(function (e) { doc.linha({ titulo: e.nome, rotulos: e.pontos.map(function (p) { return dm(p.data); }), valores: e.pontos.map(function (p) { return p.carga; }), unidade: 'kg', altura: 96 }); });
      }
      if (t.grupos.length) {
        doc.subsecao('Séries por grupo muscular');
        doc.barras({ rotulos: t.grupos.map(function (g) { return g.label.length > 11 ? g.label.slice(0, 10) + '.' : g.label; }), valores: t.grupos.map(function (g) { return g.series; }), altura: 100, formato: function (v) { return String(v); } });
      }
    }

    if (d.alimentacao) {
      algum = true;
      var a = d.alimentacao;
      doc.secao('Alimentação');
      doc.kpis([{ valor: fmt(a.media.kcal) + ' kcal', rotulo: 'média por dia' + (a.metaKcal ? ' (meta ' + fmt(a.metaKcal) + ')' : '') }, { valor: fmt(a.media.prot, 1) + ' g', rotulo: 'proteína' + (a.metaProt ? ' (meta ' + fmt(a.metaProt) + ' g)' : '') },
        { valor: fmt(a.media.carb, 1) + ' g', rotulo: 'carboidratos' }, { valor: fmt(a.media.lip, 1) + ' g', rotulo: 'gorduras' }]);
      doc.texto('Médias calculadas só nos ' + a.dias.length + ' dias com registro (' + a.semRegistro + (a.semRegistro === 1 ? ' dia' : ' dias') + ' de ' + a.totalDias + ' sem nenhum alimento registrado).', { tamanho: 9, cor: [117, 103, 111] });
      doc.barras({ titulo: 'Calorias por dia (kcal)', rotulos: a.dias.map(function (x) { return x.data.slice(8); }), valores: a.dias.map(function (x) { return Math.round(x.kcal); }), meta: a.metaKcal || undefined, altura: 110, formato: function (v) { return fmt(v); } });
      doc.tabela({ colunas: [{ t: 'Dia', w: 1 }, { t: 'Calorias', w: 1.4, a: 'right' }, { t: 'Proteína', w: 1.3, a: 'right' }, { t: 'Carboidratos', w: 1.5, a: 'right' }, { t: 'Gorduras', w: 1.3, a: 'right' }, { t: 'Alimentos', w: 1.2, a: 'right' }],
        linhas: a.dias.map(function (x) { return [dm(x.data), fmt(x.kcal) + ' kcal', fmt(x.prot, 1) + ' g', fmt(x.carb, 1) + ' g', fmt(x.lip, 1) + ' g', String(x.itens)]; }) });
    }

    if (d.medidas) {
      algum = true;
      var m = d.medidas;
      doc.secao('Medidas do corpo');
      var kp = m.mudancas.map(function (c) { return { valor: (c.delta > 0 ? '+' : '') + fmt(c.delta, 1) + ' ' + c.unid, rotulo: c.rotulo + ' (' + fmt(c.de, 1) + ' → ' + fmt(c.ate, 1) + ')' }; });
      if (m.imc) kp.push({ valor: fmt(m.imc, 1), rotulo: 'IMC' + (m.imcClasse ? ' • ' + m.imcClasse : '') });
      if (kp.length) doc.kpis(kp.slice(0, 4));
      doc.tabela({ colunas: [{ t: 'Data', w: 1.2 }].concat(m.campos.map(function (c) { return { t: c[1], w: 1.4, a: 'right' }; })),
        linhas: m.registros.map(function (r) { return [dm(r.date)].concat(m.campos.map(function (c) { return r[c[0]] != null ? fmt(r[c[0]], 1) : '—'; })); }) });
      var pesos = m.registros.filter(function (r) { return r.weightKg != null; });
      if (pesos.length >= 2) doc.linha({ titulo: 'Peso (kg)', rotulos: pesos.map(function (r) { return dm(r.date); }), valores: pesos.map(function (r) { return r.weightKg; }), unidade: 'kg', altura: 96 });
      doc.texto('IMC pela OMS; referência geral. A avaliação de uma profissional é o que vale.', { tamanho: 8, cor: [117, 103, 111] });
    }

    if (d.agua) {
      algum = true;
      var w = d.agua;
      doc.secao('Água');
      doc.kpis([{ valor: R.formatMl(w.mediaMl), rotulo: 'média por dia com registro' }, { valor: R.formatMl(w.metaMl), rotulo: 'meta diária' }, { valor: w.diasMeta + ' de ' + w.diasComRegistro, rotulo: 'dias com meta batida' }]);
      doc.barras({ titulo: 'Água por dia (ml)', rotulos: w.dias.map(function (x) { return x.date.slice(8); }), valores: w.dias.map(function (x) { return x.ml; }), meta: w.metaMl, altura: 105, formato: function (v) { return fmt(v); } });
    }

    if (d.ciclo) {
      algum = true;
      var c = d.ciclo;
      doc.secao('Ciclo menstrual');
      doc.kpis([{ valor: c.cicloMedio + ' dias', rotulo: 'ciclo médio' + (c.medidos ? ' (' + c.medidos + (c.medidos === 1 ? ' ciclo medido)' : ' ciclos medidos)') : ' (informado)') }, { valor: c.menstruacaoMedia + ' dias', rotulo: 'menstruação, em média' }]);
      doc.tabela({ colunas: [{ t: 'Início', w: 1.3 }, { t: 'Fim', w: 1.3 }, { t: 'Menstruação', w: 1.3, a: 'right' }, { t: 'Ciclo', w: 1.3, a: 'right' }],
        linhas: c.ciclos.map(function (h) { return [C.formatDateBR(h.start), C.formatDateBR(h.end) + (h.endMarked ? '' : ' (est.)'), h.days + ' dias', h.cycleLen ? h.cycleLen + ' dias' : 'em andamento']; }) });
      doc.texto('Previsões e fases são estimativas pela média dos ciclos registrados. Não servem como método anticoncepcional nem substituem a orientação médica.', { tamanho: 8, cor: [117, 103, 111] });
    }

    var fotos = (opcoes.fotos || []).filter(function (f) { return f && f.bytes; });
    if (fotos.length) {
      algum = true;
      doc.secao('Fotos de evolução');
      doc.imagens(fotos.map(function (f) { return { bytes: f.bytes, legenda: C.formatDateBR(f.date) + (f.pose ? ' • ' + f.pose : '') }; }), { alturaMax: 320 });
    }

    if (!algum) doc.texto('Não há registros neste período para as seções escolhidas.', { tamanho: 11, cor: [117, 103, 111] });
    return doc.gerar();
  }

  /* ---------------- Tela ---------------- */

  function registrar(JS) {
    var ui = JS.ui, esc = ui.esc;
    var LABELS = { treino: ['Treino', 'Treinos feitos, recordes, evolução de carga e séries por grupo'], alimentacao: ['Alimentação', 'Calorias, proteína e macros por dia, com as metas'],
      medidas: ['Medidas do corpo', 'Peso, gordura, músculo e medidas, com a tendência'], agua: ['Água', 'Média por dia e dias com meta batida'],
      ciclo: ['Ciclo menstrual', 'Sensível: fica desligado até você ligar'], fotos: ['Fotos de evolução', 'A primeira e a última foto do período (antes e depois)'] };

    function nomeArquivo(p) { return /^\d{4}-\d{2}/.test(p.ate) ? 'js-relatorio-' + p.ate.slice(0, 7) + '.pdf' : 'js-relatorio.pdf'; }

    // Lê até 2 fotos do período (a mais antiga e a mais nova) como bytes JPEG.
    function lerFotos(de, ate) {
      if (!JS.fotos || !JS.fotos.supported()) return Promise.resolve([]);
      return JS.fotos.list().then(function (lista) {
        var lst = lista.filter(function (f) { return noPeriodo(f.date, de, ate); }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
        if (!lst.length) return [];
        var escolhidas = lst.length > 1 ? [lst[0], lst[lst.length - 1]] : [lst[0]];
        return Promise.all(escolhidas.map(function (f) {
          return f.full.arrayBuffer().then(function (buf) { return { date: f.date, pose: (JS.fotos.POSES || {})[f.pose] || '', bytes: new Uint8Array(buf) }; });
        })).then(function (l) { return l.filter(function (f) { return P.infoJpeg(f.bytes); }); });
      }).catch(function () { return []; });
    }

    function gerar(opcoes) {
      var s = JS.store.state, agora = new Date();
      var base = opcoes.secoes && opcoes.secoes.fotos ? lerFotos(opcoes.de, opcoes.ate) : Promise.resolve([]);
      return base.then(function (fotos) {
        var bytes = montarPdf(s, { de: opcoes.de, ate: opcoes.ate, secoes: opcoes.secoes, fotos: fotos }, agora);
        return { bytes: bytes, nome: nomeArquivo({ ate: opcoes.ate }), fotos: fotos.length };
      });
    }

    function entregar(res) {
      var file = new File([res.bytes], res.nome, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        return navigator.share({ files: [file], title: 'Relatório J.S.' }).then(function () { return 'compartilhado'; }, function (e) { if (e && e.name === 'AbortError') return 'cancelado'; return baixar(file); });
      }
      return Promise.resolve(baixar(file));
    }
    function baixar(file) {
      var url = URL.createObjectURL(file), a = document.createElement('a');
      a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 6000);
      return 'baixado';
    }

    function ler(form) {
      var v = ui.formValues(form), p = periodo(v.periodo, new Date(), v.de, v.ate);
      var sec = {};
      SECOES.forEach(function (k) { sec[k] = v['s_' + k] === true; });
      return { periodo: p, secoes: sec, tipo: v.periodo };
    }

    function previa(form) {
      var box = form.querySelector('[data-previa]'), o = ler(form), err = validarPeriodo(o.periodo);
      form.querySelector('[data-custom]').hidden = o.tipo !== 'custom';
      if (err) { box.textContent = o.tipo === 'custom' ? err : ''; return; }
      var d = coletar(JS.store.state, { de: o.periodo.de, ate: o.periodo.ate, secoes: o.secoes }, new Date()), linhas = [];
      if (o.secoes.treino) linhas.push(d.treino ? d.treino.totais.treinos + (d.treino.totais.treinos === 1 ? ' treino' : ' treinos') + ', ' + d.treino.recordes.length + (d.treino.recordes.length === 1 ? ' recorde' : ' recordes') : 'Treino: sem registros');
      if (o.secoes.alimentacao) linhas.push(d.alimentacao ? d.alimentacao.dias.length + ' dias de alimentação' : 'Alimentação: sem registros');
      if (o.secoes.medidas) linhas.push(d.medidas ? d.medidas.registros.length + (d.medidas.registros.length === 1 ? ' medição' : ' medições') : 'Medidas: sem registros');
      if (o.secoes.agua) linhas.push(d.agua ? d.agua.diasComRegistro + ' dias de água' : 'Água: sem registros');
      if (o.secoes.ciclo) linhas.push(d.ciclo ? d.ciclo.ciclos.length + (d.ciclo.ciclos.length === 1 ? ' ciclo' : ' ciclos') : 'Ciclo: sem registros');
      box.textContent = C.formatDateBR(o.periodo.de) + ' a ' + C.formatDateBR(o.periodo.ate) + ' • ' + (linhas.join(' • ') || 'nenhuma seção escolhida');
    }

    function abrir() {
      var hoje = C.toDateKey(new Date()), mk = C.monthOf(hoje);
      var body = '<p class="hint top">Um PDF com o resumo do período, para guardar ou mostrar à nutricionista ou à personal. Seções sem registros ficam de fora.</p>' +
        ui.select({ label: 'Período', name: 'periodo', options: [['mes', 'Este mês'], ['passado', 'Mês passado'], ['30', 'Últimos 30 dias'], ['custom', 'Personalizado…']], value: 'mes' }) +
        '<div class="row2" data-custom hidden>' + ui.input({ label: 'De', name: 'de', type: 'date', value: C.monthRange(mk).from, attrs: 'max="' + hoje + '"' }) + ui.input({ label: 'Até', name: 'ate', type: 'date', value: hoje, attrs: 'max="' + hoje + '"' }) + '</div>' +
        '<div class="rel-secoes">' + SECOES.map(function (k) { return ui.checkbox({ label: LABELS[k][0], hint: LABELS[k][1], name: 's_' + k, checked: PADRAO[k] }); }).join('') + '</div>' +
        '<p class="rel-previa muted small" data-previa aria-live="polite"></p>' +
        '<p class="rel-status small" data-status role="status"></p>' +
        '<p class="hint">' + ui.icon('shield', 14) + ' O arquivo é criado aqui no seu aparelho, sem enviar nada para servidor. Quem recebe é você que escolhe, na hora de compartilhar.</p>';
      ui.openSheet({
        title: 'Relatório do período', body: body, submitLabel: 'Gerar PDF',
        onOpen: function (form) { form.addEventListener('input', function () { previa(form); }); form.addEventListener('change', function () { previa(form); }); previa(form); },
        onSubmit: function (v, form) {
          var o = ler(form), err = validarPeriodo(o.periodo);
          if (err) return { errors: { de: err, periodo: err } };
          if (!SECOES.some(function (k) { return o.secoes[k]; })) return { errors: { s_treino: 'Escolha pelo menos uma seção.' } };
          var st = form.querySelector('[data-status]'); st.textContent = 'Gerando o PDF…';
          form.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
          return gerar({ de: o.periodo.de, ate: o.periodo.ate, secoes: o.secoes }).then(function (res) {
            JS.relatorio._ultimo = res;
            return entregar(res).then(function (como) { return { como: como, nome: res.nome }; });
          }).catch(function (e) {
            form.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
            st.textContent = '';
            return { errors: { periodo: 'Não consegui gerar o PDF: ' + (e && e.message || 'erro') } };
          });
        },
        afterClose: function (r) { if (r && r.como) ui.toast(r.como === 'baixado' ? 'PDF salvo: ' + r.nome + ' (pasta Downloads).' : r.como === 'compartilhado' ? 'Relatório enviado.' : 'Tudo bem, o relatório não foi enviado.', { timeout: 5000 }); }
      });
    }

    JS.relatorio = { abrir: abrir, gerar: gerar, coletar: coletar, montarPdf: montarPdf, periodo: periodo };
    JS.actions['relatorio-abrir'] = abrir;
    JS.slots.add('config.secoes', function () {
      return '<section class="card" id="cfg-relatorio"><div class="card-head"><h2>' + ui.icon('receipt', 18) + 'Relatório em PDF</h2></div>' +
        '<p class="hint top">Treino, alimentação, medidas, água e (se você quiser) ciclo e fotos de um período, num PDF para guardar ou mostrar à nutricionista ou à personal. Criado no seu aparelho.</p>' +
        '<button type="button" class="btn soft full" data-action="relatorio-abrir">' + ui.icon('download', 18) + 'Gerar relatório em PDF</button></section>';
    }, 30);
    if (JS.search && JS.search.shortcuts) JS.search.shortcuts.push(['Relatório em PDF', 'relatorio pdf mes treino alimentacao nutricionista personal imprimir compartilhar exportar', 'receipt', { action: 'relatorio-abrir' }]);
    void esc;
  }

  return { periodo: periodo, validarPeriodo: validarPeriodo, coletar: coletar, montarPdf: montarPdf, registrar: registrar, SECOES: SECOES };
});
