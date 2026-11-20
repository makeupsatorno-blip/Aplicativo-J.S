-- J.S. — Backup automático cifrado (Configurações → Backup automático).
-- O aparelho cifra tudo (AES-GCM) com uma chave tirada do "código de recuperação" (que nunca vem para
-- cá) e manda em pedaços. O servidor só guarda conteúdo cifrado, o tamanho e a data. Pode rodar de novo.
--
-- Como funciona sem perder o backup anterior se um envio for interrompido:
--  * cada envio grava os pedaços com uma "versão" (ver) nova e aleatória;
--  * só quando TODOS os pedaços chegaram, a função troca os "ponteiros" (js_backup_heads) para essa versão
--    ('ultimo' e 'dia-AAAA-MM-DD', os dois apontando para as mesmas partes: nada é copiado);
--  * partes que nenhum ponteiro usa mais (e têm mais de 1 h) são apagadas;
--  * ficam o 'ultimo' e os 7 dias mais recentes; sem nenhuma atividade por 180 dias, tudo é apagado.

create table if not exists public.js_backup_parts (
  id text not null,                    -- derivado do código no próprio aparelho (64 hex)
  ver text not null,                   -- um envio (aleatório, gerado no aparelho)
  part integer not null,               -- pedaço (0, 1, 2...)
  data text not null,                  -- pedaço cifrado, em base64
  size integer not null default 0,     -- caracteres do pedaço (o servidor não lê o conteúdo)
  created_at timestamptz not null default now(),
  primary key (id, ver, part)
);
create index if not exists idx_js_backup_parts_created on public.js_backup_parts (created_at);

create table if not exists public.js_backup_heads (
  id text not null,
  slot text not null,                  -- 'ultimo' | 'dia-AAAA-MM-DD'
  ver text not null,                   -- qual envio é este backup
  parts integer not null,
  size integer not null default 0,     -- bytes cifrados (aproximado)
  meta text not null default '',       -- só versão do app e se tem fotos (sem dados pessoais)
  created_at timestamptz not null default now(),
  primary key (id, slot)
);

create table if not exists public.js_backup_usage (
  id text primary key,
  last_seen timestamptz not null default now(),
  day date not null default current_date,
  puts integer not null default 0      -- envios no dia (limite diário)
);
create index if not exists idx_js_backup_usage_seen on public.js_backup_usage (last_seen);

-- Ninguém de fora acessa: só a Edge Function, com a chave de serviço.
alter table public.js_backup_parts enable row level security;
alter table public.js_backup_heads enable row level security;
alter table public.js_backup_usage enable row level security;
revoke all on public.js_backup_parts, public.js_backup_heads, public.js_backup_usage from anon, authenticated;
grant select, insert, update, delete on public.js_backup_parts, public.js_backup_heads, public.js_backup_usage to service_role;
