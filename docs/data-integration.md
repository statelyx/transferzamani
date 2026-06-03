# STAT11 veri entegrasyonu

Tam takim, kadro, oyuncu fotografi, lig fiksturu ve transfer/haber akisi icin canli API verisini Supabase'e cacheleyerek ilerlemeliyiz. Frontend dogrudan ucuncu parti API'ye gitmemeli; Next.js API route veya scheduled sync Supabase'i doldurmali.

## Gerekli Vercel environment variables

- `RAPIDAPI_KEY`: RapidAPI uzerindeki futbol/SofaSport anahtari.
- `RAPIDAPI_KEY`: RapidAPI hesabindaki ortak anahtar. RapidAPI'de farkli API'ler icin genelde ayni kalir.
- `RAPIDAPI_HOST`: Baska RapidAPI entegrasyonlari icin kullanilan eski/genel host. SofaScore icin zorunlu degil.
- `SOFASCORE_RAPIDAPI_HOST`: SofaScore RapidAPI host degeri. Bu proje icin: `sofascore.p.rapidapi.com`.
- `SOFASCORE_RATE_LIMIT_MS`: Server-side istekler arasindaki minimum bekleme. Varsayilan: `350`.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase proje URL'i.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key. Browser tarafinda kullanilabilir.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Eski anon public JWT. Geriye donuk destek icin opsiyonel.
- `SUPABASE_SECRET_KEY`: Supabase secret key. Sadece server-side.
- `SUPABASE_SERVICE_ROLE_KEY`: Eski service_role JWT. Sadece server-side; client'a acilmayacak.
- `CRON_SECRET`: Vercel Cron route'unu korumak icin opsiyonel bearer secret.

## Supabase tablo omurgasi

- `countries`: `id`, `name`, `code`, `logo_url`
- `leagues`: `id`, `external_id`, `name`, `country_id`, `season`, `logo_url`, `market_value`
- `teams`: `id`, `external_id`, `league_id`, `name`, `short_name`, `logo_url`, `venue`, `country`
- `players`: `id`, `external_id`, `team_id`, `name`, `short_name`, `position`, `shirt_number`, `country`, `birth_date`, `height`, `market_value`, `photo_url`
- `player_metrics`: `player_id`, `attack`, `defense`, `passing`, `physical`, `form`, `rating`, `updated_at`
- `fixtures`: `id`, `external_id`, `league_id`, `home_team_id`, `away_team_id`, `score`, `start_at`, `status`
- `transfer_rumors`: `id`, `player_id`, `headline`, `linked_club`, `confidence`, `status`, `source_count`, `updated_at`

## Veri akisi

1. API'den ulke, lig, takim ve kadrolar server-side cekilir.
2. Supabase tablolarina upsert edilir.
3. Frontend lig/takim/kadro ekranlari Supabase'den okur.
4. RapidAPI rate limit olursa son temiz Supabase kaydi gosterilir.

## Mevcut servis katmani

- Endpoint registry: `lib/sofascore/endpoints.ts`
- Cache, retry ve rate-limit client: `lib/sofascore/client.ts`
- Ortak TypeScript tipleri: `lib/sofascore/types.ts`
- Server-side proxy: `app/api/sofascore/[...endpoint]/route.ts`
- Takim kadro API route'u: `app/api/football/team-squad/route.ts`
- Gece kadro guncelleme cron route'u: `app/api/cron/update-squads/route.ts`
- Supabase REST cache helper: `lib/supabase/rest.ts`
- Supabase tablo SQL'i: `supabase/schema.sql`

Vercel Cron `vercel.json` icinde `0 0 * * *` olarak tanimli. Bu Turkiye saatiyle 03:00'e denk gelir.

Ornek kullanim:

```ts
await sofaScoreGet("teams/get-squad", { teamId: 3061 });
await sofaScoreGet("tournaments/get-standings", { tournamentId: 52, seasonId: 63814 });
await sofaScoreGet("players/detail", { playerId: 822471 });
```

## Once baglanacak veri

1. Avrupa'nin buyuk ligleri ve Super Lig takimlari.
2. Takim kadrolari ve oyuncu fotografi.
3. Oyuncu metrikleri.
4. Fikstur, mac sonucu, haber ve transfer duyumlari.
