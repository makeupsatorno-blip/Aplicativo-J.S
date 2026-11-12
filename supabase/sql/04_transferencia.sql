-- J.S. — Passar os dados para outro aparelho (Configurações → Passar para outro aparelho).
-- O aparelho que envia cifra tudo (AES-GCM) com uma chave tirada do código mostrado na tela; o código
-- nunca vem para o servidor. Aqui fica só o conteúdo cifrado, em pedaços, por no máximo 30 minutos:
-- é apagado quando o outro aparelho confirma que recebeu, ou quando vence. Pode rodar de novo sem problema.

create table if not exists public.js_transfers (
  id text not null,                    -- derivado do código no próprio aparelho (64 hex)
  part integer not null,               -- pedaço (0, 1, 2...)
  parts integer not null,              -- total de pedaços
  data text not null,                  -- pedaço cifrado, em base64
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  primary key (id, part)
);

create index if not exists idx_js_transfers_expires on public.js_transfers (expires_at);

-- Ninguém de fora acessa: só a Edge Function, com a chave de serviço.
alter table public.js_transfers enable row level security;
revoke all on public.js_transfers from anon, authenticated;
grant select, insert, update, delete on public.js_transfers to service_role;
