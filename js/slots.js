/*
 * J.S. — pontos de encaixe ("slots") e eventos.
 * Cada recurso novo mora no próprio arquivo e se registra aqui, sem mexer nas telas dos outros:
 *
 *   JS.slots.add('inicio.meio', function (state, now) { return '<section>…</section>'; }, 50);
 *   JS.slots.html('inicio.meio', state, now)   // chamado pela tela: junta o HTML de todos, por ordem
 *
 * Slots existentes (quem chama, argumentos):
 *   inicio.topo     Início, logo depois da saudação          (state, now, dashboard)
 *   inicio.meio     Início, depois dos cartões pequenos       (state, now, dashboard)
 *   inicio.fim      Início, antes de "Adicionar"              (state, now, dashboard)
 *   treino.hoje     Treino → Hoje, no fim                     (state, now)
 *   corpo.secoes    Corpo, antes das fotos                    (state, now)
 *   autocuidado.topo  Cronograma capilar, depois dos botões   (state, now)
 *   config.secoes   Configurações, antes do Backup            (state)
 *   mais.tiles      Mais, antes de Configurações (use JS.maisTile)  (state, today)
 *
 * Eventos: JS.on('nome', fn) / JS.emit('nome', dados). Falhas num ouvinte não derrubam os outros.
 *   store:changed   depois de qualquer alteração salva (o store já tem JS.store.subscribe; este evento
 *                   existe para quem carrega depois). Não é emitido a cada toque: veja JS.store.subscribe.
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  var lists = {}, handlers = {};

  JS.slots = {
    add: function (name, fn, order) { (lists[name] = lists[name] || []).push({ fn: fn, order: order == null ? 50 : order }); },
    html: function (name) {
      var args = Array.prototype.slice.call(arguments, 1);
      return (lists[name] || []).slice().sort(function (a, b) { return a.order - b.order; }).map(function (x) {
        try { var h = x.fn.apply(null, args); return h == null || h === false ? '' : String(h); }
        catch (e) { console.error('slot ' + name, e); return ''; }
      }).join('');
    },
    has: function (name) { return !!(lists[name] && lists[name].length); }
  };

  JS.on = function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); };
  JS.emit = function (name, data) {
    (handlers[name] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error('evento ' + name, e); } });
  };
})();
