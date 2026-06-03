create table if not exists public.team_squad_cache (
  cache_key text primary key,
  team_name text,
  league_id text,
  team_id bigint,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists team_squad_cache_team_id_idx on public.team_squad_cache (team_id);
create index if not exists team_squad_cache_league_id_idx on public.team_squad_cache (league_id);

alter table public.team_squad_cache enable row level security;

drop policy if exists "Public read team squad cache" on public.team_squad_cache;
create policy "Public read team squad cache"
on public.team_squad_cache
for select
to anon, authenticated
using (true);

drop policy if exists "Service role writes team squad cache" on public.team_squad_cache;
create policy "Service role writes team squad cache"
on public.team_squad_cache
for all
to service_role
using (true)
with check (true);
