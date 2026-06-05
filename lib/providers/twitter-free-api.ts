import { rapidProviderRequest } from "./rapidapi-provider";

// Ucretsiz (free) Twitter/X arama API'si. Failover zincirinde 1. siradadir.
// Host: twittr-x-api-free-tweets-user-twitter-lookup.p.rapidapi.com
export const TWITTER_FREE_API_ENDPOINTS = {
  search: { path: "/search", ttl: 300 },
  "user-lookup": { path: "/user", ttl: 3_600 },
  timeline: { path: "/timeline", ttl: 300 }
} as const;

export type TwitterFreeApiEndpoint = keyof typeof TWITTER_FREE_API_ENDPOINTS;

const twitterFreeProvider = {
  id: "twittr-x-free",
  hostEnv: "TWITTER_FREE_API_RAPIDAPI_HOST",
  defaultHost: "twittr-x-api-free-tweets-user-twitter-lookup.p.rapidapi.com",
  rateLimitEnv: "TWITTER_FREE_API_RATE_LIMIT_MS",
  defaultRateLimitMs: 1_200,
  endpoints: TWITTER_FREE_API_ENDPOINTS
};

export function isTwitterFreeApiEndpoint(value: string): value is TwitterFreeApiEndpoint {
  return value in TWITTER_FREE_API_ENDPOINTS;
}

export async function twitterFreeApiGet<T>(
  endpoint: TwitterFreeApiEndpoint,
  params: Record<string, string | number | boolean | null | undefined> = {},
  options: { force?: boolean } = {}
) {
  return rapidProviderRequest<T>(twitterFreeProvider, endpoint, params, options);
}
