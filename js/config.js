/* J.S. — configuração do servidor de avisos com o app fechado (Supabase Edge Function js-push).
   Deixe pushApi vazio para desligar o recurso.
   transfer: "Passar para outro aparelho". Ligado (true) desde a 2.8.1: a tabela
   supabase/sql/04_transferencia.sql e a função js-push com as rotas transfer-* já foram publicadas.
   backup: "Backup automático" cifrado (Configurações). Ligado (true) desde a 2.8.1: as tabelas de
   supabase/sql/05_backup_auto.sql e as rotas backup-* da função js-push já foram publicadas. */
window.JS_CONFIG = {
  pushApi: 'https://jmjenkgmicqbftzndvrl.supabase.co/functions/v1/js-push',
  transfer: true,
  backup: true
};
