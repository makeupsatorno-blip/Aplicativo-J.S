/*
 * J.S. — armazenamento local (localStorage), com migração e backup.
 * Os dados ficam só neste aparelho/navegador. Nenhum dado é enviado para servidor.
 */
(function () {
  'use strict';
  var JS = window.JS = window.JS || {};
  var R = window.JSRegras;
  var KEY = 'js-app-dados';
  var listeners = [];
  var state = null;
  var loadError = null;
  var persistAsked = false;

  function nowISO() { return new Date().toISOString(); }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); }
    catch (e) { loadError = 'Este navegador bloqueou o armazenamento local. O que você cadastrar não ficará salvo.'; }
    if (!raw) { state = R.emptyState(); return state; }
    try { state = R.migrate(JSON.parse(raw)); }
    catch (e) {
      // Nunca descarta o conteúdo original: guarda uma cópia para recuperação.
      try { localStorage.setItem(KEY + '-recuperacao-' + Date.now(), raw); } catch (x) { /* sem espaço */ }
      loadError = 'Não foi possível ler os dados salvos. Uma cópia foi guardada e o app abriu vazio. Restaure um backup em Configurações.';
      state = R.emptyState();
    }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) {
      if (JS.ui) JS.ui.toast('Não foi possível salvar: o armazenamento do navegador está cheio ou bloqueado.', { error: true, timeout: 6000 });
      return false;
    }
  }

  function emit() { listeners.forEach(function (l) { l(); }); }

  // Altera os dados, salva e redesenha a tela.
  function update(fn) {
    var r = fn(state, nowISO());
    save();
    requestPersistence();
    emit();
    return r;
  }
  // Altera e salva sem redesenhar (usado pelos lembretes).
  function silentUpdate(fn) { fn(state, nowISO()); save(); }

  function subscribe(l) { listeners.push(l); }

  // Pede ao navegador para não apagar os dados quando faltar espaço.
  function requestPersistence() {
    if (persistAsked || !navigator.storage || !navigator.storage.persist) return;
    persistAsked = true;
    navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); }).catch(function () {});
  }

  // A inscrição de push e o segredo são deste aparelho: não vão no backup.
  function exportData() {
    var copy = JSON.parse(JSON.stringify(state));
    delete copy.settings.push;
    delete copy.settings.quick; // atalho do iPhone: é deste aparelho
    delete copy.firedReminders;
    return { app: 'J.S.', tipo: 'backup', versao: R.SCHEMA_VERSION, exportadoEm: nowISO(), dados: copy };
  }

  function importData(obj) {
    if (!obj || obj.app !== 'J.S.' || !obj.dados) throw new Error('Este arquivo não é um backup do J.S.');
    var push = state && state.settings.push, quick = state && state.settings.quick;
    state = R.migrate(obj.dados);
    if (push) state.settings.push = push; else delete state.settings.push;
    if (quick) state.settings.quick = quick; else delete state.settings.quick;
    save();
    emit();
  }

  function reset() {
    var push = state && state.settings.push, quick = state && state.settings.quick;
    state = R.emptyState();
    if (push && push.enabled) state.settings.push = push; // continua inscrito; os lembretes somem na próxima sincronização
    if (quick && quick.enabled) state.settings.quick = quick;
    save();
    emit();
  }

  // Mantém duas abas abertas em sincronia.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue) return;
    try { state = R.migrate(JSON.parse(e.newValue)); emit(); } catch (x) { /* ignora */ }
  });

  JS.store = {
    KEY: KEY, load: load, save: save, update: update, silentUpdate: silentUpdate, subscribe: subscribe,
    exportData: exportData, importData: importData, reset: reset, requestPersistence: requestPersistence,
    get state() { return state; },
    get loadError() { return loadError; }
  };
})();
