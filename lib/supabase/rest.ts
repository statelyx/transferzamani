type SupabaseCacheRecord<T> = {
  cache_key: string;
  team_name?: string;
  country_name?: string;
  league_name?: string;
  league_id?: string;
  team_id?: number;
  payload: T;
  updated_at?: string;
  player_count?: number;
  last_change_summary?: unknown;
  last_refreshed_at?: string;
  source?: string;
  tweet_id?: string;
  category?: string;
  source_account?: string;
  source_url?: string;
  published_at?: string;
};

const SUPABASE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function readSupabaseCache<T>(table: string, cacheKey: string) {
  const config = supabaseConfig();
  if (!config) return null;

  try {
    const url = new URL(`${config.url}/rest/v1/${table}`);
    url.searchParams.set("cache_key", `eq.${cacheKey}`);
    url.searchParams.set("select", "cache_key,payload,updated_at");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: supabaseHeaders(config.key),
      cache: "no-store"
    });

    if (!response.ok) return null;

    const rows = (await response.json()) as Array<SupabaseCacheRecord<T>>;
    const row = rows[0];
    if (!row?.payload || !row.updated_at) return null;

    const age = Date.now() - new Date(row.updated_at).getTime();
    if (age > SUPABASE_CACHE_TTL_MS) return null;

    return row.payload;
  } catch {
    return null;
  }
}

export async function writeSupabaseCache<T>(
  table: string,
  row: Omit<SupabaseCacheRecord<T>, "updated_at"> & { updated_at?: string }
) {
  const config = supabaseConfig();
  if (!config) return;

  try {
    const url = new URL(`${config.url}/rest/v1/${table}`);
    url.searchParams.set("on_conflict", "cache_key");

    await fetch(url, {
      method: "POST",
      headers: {
        ...supabaseHeaders(config.key),
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        ...row,
        updated_at: row.updated_at || new Date().toISOString()
      })
    });
  } catch {
    // Supabase cache failure should not block live API responses.
  }
}

export async function listSupabaseCacheRows<T>(table: string, limit = 500) {
  const config = supabaseConfig();
  if (!config) return [];

  try {
    const url = new URL(`${config.url}/rest/v1/${table}`);
    url.searchParams.set("select", "cache_key,team_name,league_id,team_id,payload,updated_at");
    url.searchParams.set("order", "updated_at.asc");
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url, {
      headers: supabaseHeaders(config.key),
      cache: "no-store"
    });

    if (!response.ok) return [];
    return (await response.json()) as Array<SupabaseCacheRecord<T>>;
  } catch {
    return [];
  }
}

export async function listSupabaseRows<T>(
  table: string,
  select = "*",
  order = "updated_at.desc",
  limit = 50
) {
  const config = supabaseConfig();
  if (!config) return [];

  try {
    const url = new URL(`${config.url}/rest/v1/${table}`);
    url.searchParams.set("select", select);
    url.searchParams.set("order", order);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url, {
      headers: supabaseHeaders(config.key),
      cache: "no-store"
    });

    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function supabaseHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}
