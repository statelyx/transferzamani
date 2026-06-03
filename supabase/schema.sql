create table if not exists public.team_squad_cache (
  cache_key text primary key,
  team_name text,
  country_name text,
  league_name text,
  league_id text,
  team_id bigint,
  payload jsonb not null,
  player_count integer,
  last_change_summary jsonb,
  last_refreshed_at timestamptz,
  source text,
  updated_at timestamptz not null default now()
);

alter table public.team_squad_cache add column if not exists player_count integer;
alter table public.team_squad_cache add column if not exists country_name text;
alter table public.team_squad_cache add column if not exists league_name text;
alter table public.team_squad_cache add column if not exists last_change_summary jsonb;
alter table public.team_squad_cache add column if not exists last_refreshed_at timestamptz;
alter table public.team_squad_cache add column if not exists source text;

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

create table if not exists public.transfers_cache (
  cache_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.transfers_cache enable row level security;

drop policy if exists "Public read transfers cache" on public.transfers_cache;
create policy "Public read transfers cache"
on public.transfers_cache
for select
to anon, authenticated
using (true);

drop policy if exists "Service role writes transfers cache" on public.transfers_cache;
create policy "Service role writes transfers cache"
on public.transfers_cache
for all
to service_role
using (true)
with check (true);

create table if not exists public.provider_cache (
  cache_key text primary key,
  payload jsonb not null,
  source text,
  last_refreshed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.provider_cache add column if not exists source text;
alter table public.provider_cache add column if not exists last_refreshed_at timestamptz;
alter table public.provider_cache enable row level security;

drop policy if exists "Public read provider cache" on public.provider_cache;
create policy "Public read provider cache"
on public.provider_cache
for select
to anon, authenticated
using (true);

drop policy if exists "Service role writes provider cache" on public.provider_cache;
create policy "Service role writes provider cache"
on public.provider_cache
for all
to service_role
using (true)
with check (true);
