-- J.S. — agenda o envio dos avisos a cada minuto (pg_cron + pg_net).
-- Antes de rodar, troque:
--   SEU-PROJETO  -> o "Reference ID" do projeto (Project Settings > General)
--   SEU-SEGREDO  -> o mesmo valor de JS_CRON_SECRET configurado na Edge Function
-- Rode no SQL Editor do Supabase. Para mudar algo, rode de novo (ele substitui o agendamento).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('js-push-envio') where exists (select 1 from cron.job where jobname = 'js-push-envio');

select cron.schedule(
  'js-push-envio',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/js-push/cron',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "SEU-SEGREDO"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
