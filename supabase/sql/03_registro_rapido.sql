-- J.S. — Registro rápido de treino pelo atalho do iPhone (Tocar Atrás → Atalhos → página de registro).
-- A página de registro abre no Safari, que no iPhone não enxerga os dados do app instalado; por isso
-- as séries ficam aqui até o app abrir e importá-las (depois são apagadas). Pode rodar de novo sem problema.

-- Um registro por aparelho que ligou o atalho. O app manda o "contexto" (exercício atual, série,
-- última carga) para a página já abrir preenchida.
create table if not exists public.js_quick_devices (
  id uuid primary key,
  token_hash text not null,            -- hash do segredo do app (para mandar contexto e importar séries)
  key_hash text not null,              -- hash da chave do link do atalho (só registra séries)
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Séries registradas pelo atalho, esperando o app importar.
create table if not exists public.js_quick_sets (
  id bigserial primary key,
  device_id uuid not null references public.js_quick_devices(id) on delete cascade,
  created_at timestamptz not null default now(),
  exercise_id text,
  exercise_name text,
  load numeric(6, 1) not null,
  reps integer not null,
  serie integer
);

create index if not exists idx_js_quick_sets_device on public.js_quick_sets (device_id, id);

-- Ninguém de fora acessa: só a Edge Function, com a chave de serviço.
alter table public.js_quick_devices enable row level security;
alter table public.js_quick_sets enable row level security;
revoke all on public.js_quick_devices, public.js_quick_sets from anon, authenticated;
grant select, insert, update, delete on public.js_quick_devices, public.js_quick_sets to service_role;
grant usage, select on sequence public.js_quick_sets_id_seq to service_role;
