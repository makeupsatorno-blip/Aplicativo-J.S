/* J.S. — configuração do servidor de avisos com o app fechado (Supabase Edge Function js-push).
   Deixe pushApi vazio para desligar o recurso.
   transfer: "Passar para outro aparelho". Ligue (true) só depois de publicar a tabela
   supabase/sql/04_transferencia.sql e a função js-push com as rotas transfer-*. */
window.JS_CONFIG = {
  pushApi: 'https://jmjenkgmicqbftzndvrl.supabase.co/functions/v1/js-push',
  transfer: false
};
