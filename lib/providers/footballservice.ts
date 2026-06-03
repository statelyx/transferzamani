import { rapidProviderRequest } from "./rapidapi-provider";

export const FOOTBALLSERVICE_ENDPOINTS = {
  root: { path: "/", ttl: 86_400 },
  leagues: { path: "/leagues", ttl: 86_400 },
  "league-detail": { path: "/leagues/{id}", ttl: 86_400 },
  standings: { path: "/standings/{id}", ttl: 3_600 },
  teams: { path: "/teams", ttl: 86_400 },
  "team-detail": { path: "/teams/{id}", ttl: 86_400 },
  "team-form": { path: "/teams/{id}/form", ttl: 3_600 },
  matches: { path: "/matches", ttl: 300 },
  "match-detail": { path: "/matches/{id}", ttl: 300 },
  "matches-upcoming": { path: "/matches/upcoming", ttl: 300 },
  "matches-live": { path: "/matches/live", ttl: 30 },
  "top-scorers": { path: "/top-scorers/{id}", ttl: 3_600 },
  "head-to-head": { path: "/head-to-head/{team1}/{team2}", ttl: 3_600 },
  search: { path: "/search", ttl: 300 },
  "sync-sportsdb": { path: "/sync-sportsdb", ttl: 300, method: "POST" as const }
} as const;

export type FootballServiceEndpoint = keyof typeof FOOTBALLSERVICE_ENDPOINTS;

const footballServiceProvider = {
  id: "footballservice",
  hostEnv: "FOOTBALLSERVICE_RAPIDAPI_HOST",
  defaultHost: "footballservice1.p.rapidapi.com",
  rateLimitEnv: "FOOTBALLSERVICE_RATE_LIMIT_MS",
  defaultRateLimitMs: 500,
  endpoints: FOOTBALLSERVICE_ENDPOINTS
};

export function isFootballServiceEndpoint(value: string): value is FootballServiceEndpoint {
  return value in FOOTBALLSERVICE_ENDPOINTS;
}

export async function footballServiceGet<T>(
  endpoint: FootballServiceEndpoint,
  params: Record<string, string | number | boolean | null | undefined> = {},
  options: { force?: boolean } = {}
) {
  const config = FOOTBALLSERVICE_ENDPOINTS[endpoint];
  const { path, restParams } = interpolatePath(config.path, params);

  return rapidProviderRequest<T>(
    {
      ...footballServiceProvider,
      endpoints: {
        [endpoint]: {
          ...config,
          path
        }
      }
    },
    endpoint,
    restParams,
    options
  );
}

function interpolatePath(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const restParams = { ...params };
  const nextPath = path.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = restParams[key];
    delete restParams[key];
    return encodeURIComponent(String(value ?? ""));
  });

  return { path: nextPath, restParams };
}
