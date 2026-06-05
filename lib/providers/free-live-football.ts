import { rapidProviderRequest } from "./rapidapi-provider";

export const FREE_LIVE_FOOTBALL_ENDPOINTS = {
  "popular-leagues": { path: "/football-popular-leagues", ttl: 86_400 },
  "players-search": { path: "/football-players-search", ttl: 3_600 },
  "teams-search": { path: "/football-teams-search", ttl: 3_600 },
  "leagues-search": { path: "/football-leagues-search", ttl: 86_400 }
} as const;

export type FreeLiveFootballEndpoint = keyof typeof FREE_LIVE_FOOTBALL_ENDPOINTS;

const freeLiveFootballProvider = {
  id: "free-live-football",
  hostEnv: "FREE_LIVE_FOOTBALL_RAPIDAPI_HOST",
  defaultHost: "free-api-live-football-data.p.rapidapi.com",
  rateLimitEnv: "FREE_LIVE_FOOTBALL_RATE_LIMIT_MS",
  defaultRateLimitMs: 900,
  endpoints: FREE_LIVE_FOOTBALL_ENDPOINTS
};

export type FreeLiveFootballSuggestion = {
  type?: "player" | "team" | "league" | string;
  id?: string | number;
  score?: number;
  name?: string;
  isCoach?: boolean;
  teamId?: string | number;
  teamName?: string;
  leagueId?: string | number;
  leagueName?: string;
  ccode?: string;
};

type SuggestionsResponse = {
  status?: string;
  response?: {
    suggestions?: FreeLiveFootballSuggestion[];
  };
};

export async function freeLiveFootballSearchPlayers(query: string) {
  const result = await freeLiveFootballGet<SuggestionsResponse>("players-search", { search: query });
  return {
    suggestions: result.data.response?.suggestions || [],
    source: result.source
  };
}

export async function freeLiveFootballSearchTeams(query: string) {
  const result = await freeLiveFootballGet<SuggestionsResponse>("teams-search", { search: query });
  return {
    suggestions: result.data.response?.suggestions || [],
    source: result.source
  };
}

export async function freeLiveFootballGet<T>(
  endpoint: FreeLiveFootballEndpoint,
  params: Record<string, string | number | boolean | null | undefined> = {},
  options: { force?: boolean } = {}
) {
  return rapidProviderRequest<T>(freeLiveFootballProvider, endpoint, params, options);
}
