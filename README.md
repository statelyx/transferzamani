# STAT11

Next.js football analytics interface for live squad data, player profiles, lineup building, and scouting views.

## Vercel Environment Variables

Production deployment needs these project environment variables:

```txt
RAPIDAPI_KEY=<your RapidAPI app key>
RAPIDAPI_HOST=sofasport.p.rapidapi.com
```

Use the raw RapidAPI key only. Do not include quotes, `Bearer`, spaces, `https://`, or trailing slashes.

If the site shows `Fallback veri modu` with `429 Too many requests`, the key is being read but the RapidAPI quota/rate limit is exhausted. Wait for the quota window to reset or upgrade/change the RapidAPI app key.

After changing Vercel environment variables, redeploy the latest production deployment.
