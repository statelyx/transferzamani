import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_HOST = "fotmob-api.p.rapidapi.com";
const DEFAULT_RETRIES = 2;
const DEFAULT_RATE_LIMIT_MS = 350;
const STALE_TTL_SECONDS = 7 * 24 * 60 * 60;
const CACHE_VERSION = 1;

type CacheSource = "memory" | "file" | "network";

export interface FotMobResult<T> {
  data: T;
  meta: {
    endpoint: string;
    url: string;
    cache: CacheSource;
    cachedAt: string;
    ttl: number;
  };
}

const memoryCache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
const inFlight = new Map<string, Promise<FotMobResult<unknown>>>();
let lastRequestAt = 0;

export class FotMobApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
    public readonly body?: string
  ) {
    super(message);
    this.name = "FotMobApiError";
  }
}

export async function fotMobGet<T>(
  endpoint: string,
  params: Record<string, any> = {},
  options: { ttl?: number; retries?: number; force?: boolean } = {}
): Promise<FotMobResult<T>> {
  // trending news is set to 1800s (30m) TTL, other endpoints default to 86400 (24h)
  const ttl = options.ttl ?? (endpoint.includes("news") ? 1800 : 86400);
  const url = buildFotMobUrl(endpoint, params);
  const key = cacheKey(endpoint, params);

  if (!options.force) {
    const memory = readMemoryCache<T>(key, ttl);
    if (memory) return withMeta(memory.data, endpoint, url, "memory", memory.timestamp, ttl);

    const file = await readFileCache<T>(key, ttl);
    if (file) {
      memoryCache.set(key, { data: file.data, timestamp: file.timestamp, ttl });
      return withMeta(file.data, endpoint, url, "file", file.timestamp, ttl);
    }

    const active = inFlight.get(key);
    if (active) return active as Promise<FotMobResult<T>>;
  }

  const request = fetchJsonWithRetry<T>(endpoint, url, options.retries ?? DEFAULT_RETRIES)
    .then(async (data) => {
      const timestamp = Date.now();
      memoryCache.set(key, { data, timestamp, ttl });
      await writeFileCache(key, data, timestamp, ttl);
      return withMeta(data, endpoint, url, "network", timestamp, ttl);
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request as Promise<FotMobResult<unknown>>);
  return request;
}

export function buildFotMobUrl(endpointPath: string, params: Record<string, any> = {}) {
  const host = process.env.FOTMOB_RAPIDAPI_HOST || DEFAULT_HOST;
  const url = new URL(`https://${host}/${endpointPath.replace(/^\/+/, "")}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function fetchJsonWithRetry<T>(endpoint: string, url: string, retries: number): Promise<T> {
  await waitForRateLimit();
  const response = await fetchWithRetry(endpoint, url, retries);

  if (response.status === 204) return {} as T;

  if (!response.ok) {
    const body = await safeText(response);
    throw new FotMobApiError(`FotMob API hatası: ${response.status}`, response.status, endpoint, body);
  }

  return response.json() as Promise<T>;
}

async function fetchWithRetry(endpoint: string, url: string, retries: number) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: rapidApiHeaders(),
        cache: "no-store"
      });

      if (!shouldRetry(response.status) || attempt === retries) {
        return response;
      }

      await sleep(backoffMs(attempt, response));
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(backoffMs(attempt));
    }
  }

  throw new FotMobApiError(
    lastError instanceof Error ? lastError.message : "FotMob API isteği başarısız.",
    0,
    endpoint
  );
}

function rapidApiHeaders() {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.FOTMOB_RAPIDAPI_HOST || DEFAULT_HOST;

  if (!key) {
    throw new Error("RAPIDAPI_KEY environment variable tanımlı değil.");
  }

  return {
    "x-rapidapi-host": host,
    "x-rapidapi-key": key
  };
}

function shouldRetry(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function backoffMs(attempt: number, response?: Response) {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter) * 1000;
  return Math.min(800 * 2 ** attempt, 5_000);
}

async function waitForRateLimit() {
  const minInterval = DEFAULT_RATE_LIMIT_MS;
  const elapsed = Date.now() - lastRequestAt;

  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed);
  }

  lastRequestAt = Date.now();
}

function readMemoryCache<T>(key: string, ttl: number) {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > ttl * 1000) return null;
  return { data: cached.data as T, timestamp: cached.timestamp };
}

async function readFileCache<T>(key: string, ttl: number) {
  try {
    const raw = await readFile(cachePath(key), "utf-8");
    const parsed = JSON.parse(raw) as {
      version?: number;
      data: T;
      timestamp: number;
      ttl: number;
    };

    if (parsed.version !== CACHE_VERSION) return null;
    if (Date.now() - parsed.timestamp > Math.max(ttl, STALE_TTL_SECONDS) * 1000) return null;
    if (Date.now() - parsed.timestamp > ttl * 1000) return null;
    return { data: parsed.data, timestamp: parsed.timestamp };
  } catch {
    return null;
  }
}

async function writeFileCache(key: string, data: unknown, timestamp: number, ttl: number) {
  try {
    const file = cachePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ version: CACHE_VERSION, data, timestamp, ttl }), "utf-8");
  } catch {
    // Cache yazımı API yanıtını etkilememeli
  }
}

function cachePath(key: string) {
  return path.join(process.cwd(), ".runtime-cache", "fotmob", `${key}.json`);
}

function cacheKey(endpoint: string, params: Record<string, any>) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify({ endpoint, params: sortParams(params) }))
    .digest("hex");
}

function sortParams(params: Record<string, any>) {
  return Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
}

function withMeta<T>(
  data: T,
  endpoint: string,
  url: string,
  cache: CacheSource,
  timestamp: number,
  ttl: number
): FotMobResult<T> {
  const safeUrl = new URL(url);
  return {
    data,
    meta: {
      endpoint,
      url: `${safeUrl.origin}${safeUrl.pathname}${safeUrl.search}`,
      cache,
      cachedAt: new Date(timestamp).toISOString(),
      ttl
    }
  };
}

async function safeText(response: Response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
