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

create table if not exists public.news_cache (
  cache_key text primary key,
  tweet_id text unique,
  category text,
  league_name text,
  source_account text,
  source_url text,
  published_at timestamptz,
  payload jsonb not null,
  source text,
  updated_at timestamptz not null default now()
);

alter table public.news_cache add column if not exists tweet_id text;
alter table public.news_cache add column if not exists category text;
alter table public.news_cache add column if not exists league_name text;
alter table public.news_cache add column if not exists source_account text;
alter table public.news_cache add column if not exists source_url text;
alter table public.news_cache add column if not exists published_at timestamptz;
alter table public.news_cache add column if not exists source text;

create unique index if not exists news_cache_tweet_id_idx on public.news_cache (tweet_id);
create index if not exists news_cache_category_idx on public.news_cache (category);
create index if not exists news_cache_published_at_idx on public.news_cache (published_at desc);

alter table public.news_cache enable row level security;

drop policy if exists "Public read news cache" on public.news_cache;
create policy "Public read news cache"
on public.news_cache
for select
to anon, authenticated
using (true);

drop policy if exists "Service role writes news cache" on public.news_cache;
create policy "Service role writes news cache"
on public.news_cache
for all
to service_role
using (true)
with check (true);

create table if not exists public.player_pool_cache (
  cache_key text primary key,
  player_id bigint unique,
  player_name text,
  team_id bigint,
  team_name text,
  country_name text,
  league_name text,
  position text,
  market_value bigint,
  payload jsonb not null,
  source text,
  updated_at timestamptz not null default now()
);

alter table public.player_pool_cache add column if not exists player_id bigint;
alter table public.player_pool_cache add column if not exists player_name text;
alter table public.player_pool_cache add column if not exists team_id bigint;
alter table public.player_pool_cache add column if not exists team_name text;
alter table public.player_pool_cache add column if not exists country_name text;
alter table public.player_pool_cache add column if not exists league_name text;
alter table public.player_pool_cache add column if not exists position text;
alter table public.player_pool_cache add column if not exists market_value bigint;
alter table public.player_pool_cache add column if not exists source text;

create unique index if not exists player_pool_cache_player_id_idx on public.player_pool_cache (player_id);
create index if not exists player_pool_cache_position_idx on public.player_pool_cache (position);
create index if not exists player_pool_cache_market_value_idx on public.player_pool_cache (market_value desc);
create index if not exists player_pool_cache_team_id_idx on public.player_pool_cache (team_id);

alter table public.player_pool_cache enable row level security;

drop policy if exists "Public read player pool cache" on public.player_pool_cache;
create policy "Public read player pool cache"
on public.player_pool_cache
for select
to anon, authenticated
using (true);

drop policy if exists "Service role writes player pool cache" on public.player_pool_cache;
create policy "Service role writes player pool cache"
on public.player_pool_cache
for all
to service_role
using (true)
with check (true);
