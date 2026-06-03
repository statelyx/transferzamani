import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSupabaseCache, writeSupabaseCache } from "@/lib/supabase/rest";
import type { SofaScoreParams } from "@/lib/sofascore/types";

type EndpointConfig = {
  path: string;
  ttl: number;
  method?: "GET" | "POST";
};

export type RapidApiProviderConfig<TEndpoints extends Record<string, EndpointConfig>> = {
  id: string;
  hostEnv: string;
  defaultHost: string;
  rateLimitEnv: string;
  defaultRateLimitMs: number;
  endpoints: TEndpoints;
};

const providerLastRequest = new Map<string, number>();
const providerMemoryCache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

export async function rapidProviderRequest<T>(
  provider: RapidApiProviderConfig<Record<string, EndpointConfig>>,
  endpoint: string,
  params: SofaScoreParams = {},
  options: { force?: boolean } = {}
) {
  const config = provider.endpoints[endpoint];
  if (!config) throw new Error(`${provider.id}:${endpoint} endpoint tanimli degil.`);

  const ttl = config.ttl;
  const cacheKey = providerCacheKey(provider.id, endpoint, params);

  if (!options.force) {
    const memory = providerMemoryCache.get(cacheKey);
    if (memory && Date.now() - memory.timestamp <= ttl * 1000) {
      return { data: memory.data as T, source: "memory" as const };
    }

    const supabase = await readSupabaseCache<T>("provider_cache", cacheKey);
    if (supabase) return { data: supabase, source: "supabase" as const };

    const file = await readProviderFileCache<T>(cacheKey, ttl);
    if (file) return { data: file, source: "file" as const };
  }

  await waitProviderRateLimit(provider);

  const response = await fetch(buildProviderUrl(provider, config.path, params), {
    method: config.method || "GET",
    headers: {
      "x-rapidapi-key": requiredRapidApiKey(),
      "x-rapidapi-host": process.env[provider.hostEnv] || provider.defaultHost
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${provider.id} API hatasi: ${response.status} ${body.slice(0, 240)}`);
  }

  const data = (await response.json()) as T;
  const timestamp = Date.now();
  providerMemoryCache.set(cacheKey, { data, timestamp, ttl });
  await writeProviderFileCache(cacheKey, data, timestamp, ttl);
  await writeSupabaseCache("provider_cache", {
    cache_key: cacheKey,
    payload: minimizeProviderPayload(data),
    source: provider.id,
    last_refreshed_at: new Date(timestamp).toISOString()
  });

  return { data, source: provider.id as "memory" | "supabase" | "file" };
}

function buildProviderUrl<TEndpoints extends Record<string, EndpointConfig>>(
  provider: RapidApiProviderConfig<TEndpoints>,
  endpointPath: string,
  params: SofaScoreParams
) {
  const host = process.env[provider.hostEnv] || provider.defaultHost;
  const url = new URL(`https://${host}${endpointPath}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url;
}

function requiredRapidApiKey() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY environment variable tanimli degil.");
  return key;
}

async function waitProviderRateLimit<TEndpoints extends Record<string, EndpointConfig>>(
  provider: RapidApiProviderConfig<TEndpoints>
) {
  const minInterval = Number(process.env[provider.rateLimitEnv] || provider.defaultRateLimitMs);
  const last = providerLastRequest.get(provider.id) || 0;
  const elapsed = Date.now() - last;

  if (elapsed < minInterval) {
    await new Promise((resolve) => setTimeout(resolve, minInterval - elapsed));
  }

  providerLastRequest.set(provider.id, Date.now());
}

function providerCacheKey(provider: string, endpoint: string, params: SofaScoreParams) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify({ provider, endpoint, params: Object.fromEntries(Object.entries(params).sort()) }))
    .digest("hex");
}

async function readProviderFileCache<T>(cacheKey: string, ttl: number) {
  try {
    const raw = await readFile(providerCachePath(cacheKey), "utf-8");
    const parsed = JSON.parse(raw) as { data: T; timestamp: number };
    if (Date.now() - parsed.timestamp > ttl * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function writeProviderFileCache(cacheKey: string, data: unknown, timestamp: number, ttl: number) {
  try {
    const file = providerCachePath(cacheKey);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ data: minimizeProviderPayload(data), timestamp, ttl }), "utf-8");
  } catch {
    // File cache write failure must not block provider response.
  }
}

function providerCachePath(cacheKey: string) {
  return path.join(process.cwd(), ".runtime-cache", "providers", `${cacheKey}.json`);
}

function minimizeProviderPayload<T>(data: T) {
  return JSON.parse(JSON.stringify(data)) as T;
}
