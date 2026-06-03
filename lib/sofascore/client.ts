import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SOFASCORE_ENDPOINTS, type SofaScoreEndpoint } from "./endpoints";
import type { CacheSource, SofaScoreParams, SofaScoreResult } from "./types";

const DEFAULT_HOST = "sofascore.p.rapidapi.com";
const DEFAULT_RETRIES = 2;
const DEFAULT_RATE_LIMIT_MS = 350;
const STALE_TTL_SECONDS = 7 * 24 * 60 * 60;
const CACHE_VERSION = 1;

const memoryCache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
const inFlight = new Map<string, Promise<SofaScoreResult<unknown>>>();
let lastRequestAt = 0;

export class SofaScoreApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: SofaScoreEndpoint,
    public readonly body?: string
  ) {
    super(message);
    this.name = "SofaScoreApiError";
  }
}

export async function sofaScoreGet<T>(
  endpoint: SofaScoreEndpoint,
  params: SofaScoreParams = {},
  options: { ttl?: number; retries?: number; force?: boolean } = {}
): Promise<SofaScoreResult<T>> {
  const config = SOFASCORE_ENDPOINTS[endpoint];
  if ("binary" in config && config.binary) {
    throw new Error(`${endpoint} binary response donuyor. sofaScoreBinary kullanilmali.`);
  }

  const ttl = options.ttl ?? config.ttl;
  const url = buildSofaScoreUrl(config.path, params);
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
    if (active) return active as Promise<SofaScoreResult<T>>;
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

  inFlight.set(key, request as Promise<SofaScoreResult<unknown>>);
  return request;
}

export async function sofaScoreBinary(
  endpoint: SofaScoreEndpoint,
  params: SofaScoreParams = {},
  options: { retries?: number } = {}
) {
  const config = SOFASCORE_ENDPOINTS[endpoint];
  const url = buildSofaScoreUrl(config.path, params);
  await waitForRateLimit();

  const response = await fetchWithRetry(endpoint, url, options.retries ?? DEFAULT_RETRIES);
  if (!response.ok) {
    const body = await safeText(response);
    throw new SofaScoreApiError(`SofaScore API hatasi: ${response.status}`, response.status, endpoint, body);
  }

  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "application/octet-stream",
    url
  };
}

export function buildSofaScoreUrl(endpointPath: string, params: SofaScoreParams = {}) {
  const host = process.env.RAPIDAPI_HOST || DEFAULT_HOST;
  const url = new URL(`https://${host}/${endpointPath.replace(/^\/+/, "")}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function fetchJsonWithRetry<T>(endpoint: SofaScoreEndpoint, url: string, retries: number): Promise<T> {
  await waitForRateLimit();
  const response = await fetchWithRetry(endpoint, url, retries);

  if (response.status === 204) return {} as T;

  if (!response.ok) {
    const body = await safeText(response);
    throw new SofaScoreApiError(`SofaScore API hatasi: ${response.status}`, response.status, endpoint, body);
  }

  return response.json() as Promise<T>;
}

async function fetchWithRetry(endpoint: SofaScoreEndpoint, url: string, retries: number) {
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

  throw new SofaScoreApiError(
    lastError instanceof Error ? lastError.message : "SofaScore API istegi basarisiz.",
    0,
    endpoint
  );
}

function rapidApiHeaders() {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST || DEFAULT_HOST;

  if (!key) {
    throw new Error("RAPIDAPI_KEY environment variable tanimli degil.");
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
  const minInterval = Number(process.env.SOFASCORE_RATE_LIMIT_MS || DEFAULT_RATE_LIMIT_MS);
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
    // Cache yazimi API yanitini bozmamali.
  }
}

function cachePath(key: string) {
  return path.join(process.cwd(), ".runtime-cache", "sofascore", `${key}.json`);
}

function cacheKey(endpoint: SofaScoreEndpoint, params: SofaScoreParams) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify({ endpoint, params: sortParams(params) }))
    .digest("hex");
}

function sortParams(params: SofaScoreParams) {
  return Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
}

function withMeta<T>(
  data: T,
  endpoint: SofaScoreEndpoint,
  url: string,
  cache: CacheSource,
  timestamp: number,
  ttl: number
): SofaScoreResult<T> {
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
