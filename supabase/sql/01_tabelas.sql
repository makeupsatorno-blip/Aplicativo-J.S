-- J.S. — tabelas dos avisos com o app fechado (Web Push).
-- Rode uma vez no SQL Editor do Supabase (ou via CLI). Pode rodar de novo sem problema.
-- Ficam separadas de qualquer outro app do mesmo projeto pelo prefixo js_.

create table if not exists public.js_vapid_keys (
  id integer primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);

-- Um registro por aparelho (celular/navegador) com os avisos ligados.
create table if not exists public.js_devices (
  id uuid primary key,
  token_hash text not null,            -- hash do segredo gerado no aparelho
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  tz text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Lembretes dos próximos dias de cada aparelho (título, texto, horário).
create table if not exists public.js_reminders (
  device_id uuid not null references public.js_devices(id) on delete cascade,
  key text not null,                   -- tipo:entidade:AAAA-MM-DDTHH:MM (evita duplicar)
  at timestamptz not null,
  title text not null,
  body text,
  route text,
  sent_at timestamptz,
  primary key (device_id, key)
);

create index if not exists idx_js_reminders_due on public.js_reminders (at) where sent_at is null;

-- Ninguém de fora acessa as tabelas: só a Edge Function, com a chave de serviço.
alter table public.js_vapid_keys enable row level security;
alter table public.js_devices enable row level security;
alter table public.js_reminders enable row level security;
revoke all on public.js_vapid_keys, public.js_devices, public.js_reminders from anon, authenticated;
grant select, insert, update, delete on public.js_vapid_keys, public.js_devices, public.js_reminders to service_role;
