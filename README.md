# Transfer Zamanı

Next.js football portal for transfer news, live squads, player profiles, league browsing, lineup building, and scouting views.

## Vercel Environment Variables

Production deployment needs these project environment variables:

```txt
RAPIDAPI_KEY=<your RapidAPI app key>
RAPIDAPI_HOST=<optional legacy RapidAPI host>
SOFASCORE_RAPIDAPI_HOST=sofascore.p.rapidapi.com
FREE_LIVE_FOOTBALL_RAPIDAPI_HOST=free-api-live-football-data-cheaper-version.p.rapidapi.com
FOTMOB_RAPIDAPI_HOST=fotmob-api.p.rapidapi.com
FOOTBALLSERVICE_RAPIDAPI_HOST=footballservice1.p.rapidapi.com
TWITTER_API_RAPIDAPI_HOST=twitter-api45.p.rapidapi.com
SOFASCORE_RATE_LIMIT_MS=350
FREE_LIVE_FOOTBALL_RATE_LIMIT_MS=900
FOOTBALLSERVICE_RATE_LIMIT_MS=500
TWITTER_API_RATE_LIMIT_MS=900
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable key>
SUPABASE_SECRET_KEY=<your Supabase secret key>
CRON_SECRET=<optional cron bearer secret>
```

Use the raw RapidAPI key only. Do not include quotes, `Bearer`, spaces, `https://`, or trailing slashes. If another RapidAPI integration already uses `RAPIDAPI_HOST`, keep it as-is and add provider-specific host variables.

Run `supabase/schema.sql` in Supabase SQL Editor before enabling database cache writes.

Team squads are saved to Supabase after the first user request. Vercel Cron refreshes saved squads every day at 03:00 Turkey time via `/api/cron/update-squads`.
Twitter/X football news is saved by tweet ID in Supabase and refreshed through `/api/cron/update-twitter-news`.

If the site shows `Fallback veri modu` with `429 Too many requests`, the key is being read but the RapidAPI quota/rate limit is exhausted. Wait for the quota window to reset or upgrade/change the RapidAPI app key.

After changing Vercel environment variables, redeploy the latest production deployment.
