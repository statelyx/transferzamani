import { rapidProviderRequest } from "./rapidapi-provider";

export const FREE_LIVE_FOOTBALL_ENDPOINTS = {
  "popular-leagues": { path: "/football-popular-leagues", ttl: 86_400 },
  "players-search": { path: "/football-players-search", ttl: 3_600 },
  "teams-search": { path: "/football-teams-search", ttl: 3_600 },
  "leagues-search": { path: "/football-leagues-search", ttl: 86_400 },
  "matches-search": { path: "/football-matches-search", ttl: 300 },
  "all-search": { path: "/football-all-search", ttl: 300 },
  "all-countries": { path: "/football-get-all-countries", ttl: 86_400 },
  "all-leagues": { path: "/football-get-all-leagues", ttl: 86_400 },
  "all-leagues-with-countries": { path: "/football-get-all-leagues-with-countries", ttl: 86_400 },
  "league-detail": { path: "/football-get-league-detail", ttl: 86_400 },
  "league-logo": { path: "/football-get-league-logo", ttl: 86_400 },
  "league-teams": { path: "/football-league-team", ttl: 3_600 },
  "teams-all-by-league": { path: "/football-get-list-all-team", ttl: 3_600 },
  "teams-home-by-league": { path: "/football-get-list-home-team", ttl: 3_600 },
  "teams-away-by-league": { path: "/football-get-list-away-team", ttl: 3_600 },
  "team-logo": { path: "/football-team-logo", ttl: 86_400 },
  "players-by-team": { path: "/football-get-list-player", ttl: 3_600 },
  "player-detail": { path: "/football-get-player-detail", ttl: 3_600 },
  "player-logo": { path: "/football-get-player-logo", ttl: 86_400 },
  "matches-by-date": { path: "/football-get-matches-by-date", ttl: 300 },
  "matches-by-date-and-league": { path: "/football-get-matches-by-date-and-league", ttl: 300 },
  "all-matches-by-league": { path: "/football-get-all-matches-by-league", ttl: 300 },
  "current-live": { path: "/football-current-live", ttl: 30 },
  "match-detail": { path: "/football-get-match-detail", ttl: 300 },
  "match-score": { path: "/football-get-match-score", ttl: 120 },
  "match-status": { path: "/football-get-match-status", ttl: 120 },
  "match-highlights": { path: "/football-get-match-highlights", ttl: 3_600 },
  "match-location": { path: "/football-get-match-location", ttl: 3_600 },
  "match-all-stats": { path: "/football-get-match-all-stats", ttl: 300 },
  "match-event-all-stats": { path: "/football-get-match-event-all-stats", ttl: 300 },
  "match-first-half-stats": { path: "/football-get-match-firstHalf-stats", ttl: 300 },
  "match-second-half-stats": { path: "/football-get-match-secondhalf-stats", ttl: 300 },
  "match-referee": { path: "/football-get-match-referee", ttl: 3_600 },
  "home-lineup": { path: "/football-get-hometeam-lineup", ttl: 300 },
  "away-lineup": { path: "/football-get-awayteam-lineup", ttl: 300 },
  "head-to-head": { path: "/football-get-head-to-head", ttl: 3_600 },
  standings: { path: "/football-get-standing-all", ttl: 3_600 },
  "standings-home": { path: "/football-get-standing-home", ttl: 3_600 },
  "standings-away": { path: "/football-get-standing-away", ttl: 3_600 },
  "top-players-goals": { path: "/football-get-top-players-by-goals", ttl: 3_600 },
  "top-players-assists": { path: "/football-get-top-players-by-assists", ttl: 3_600 },
  "top-players-rating": { path: "/football-get-top-players-by-rating", ttl: 3_600 },
  "trending-news": { path: "/football-get-trendingnews", ttl: 900 },
  "league-news": { path: "/football-get-league-news", ttl: 900 },
  "team-news": { path: "/football-get-team-news", ttl: 900 },
  "player-news": { path: "/football-get-player-news", ttl: 900 },
  "all-transfers": { path: "/football-get-all-transfers", ttl: 3_600 },
  "top-transfers": { path: "/football-get-top-transfers", ttl: 3_600 },
  "market-value-transfers": { path: "/football-get-market-value-transfers", ttl: 3_600 },
  "league-transfers": { path: "/football-get-league-transfers", ttl: 3_600 },
  "team-contract-extension-transfers": { path: "/football-get-team-contract-extension-transfers", ttl: 3_600 },
  "team-players-in-transfers": { path: "/football-get-team-players-in-transfers", ttl: 3_600 },
  "team-players-out-transfers": { path: "/football-get-team-players-out-transfers", ttl: 3_600 }
} as const;

export type FreeLiveFootballEndpoint = keyof typeof FREE_LIVE_FOOTBALL_ENDPOINTS;

const freeLiveFootballProvider = {
  id: "free-live-football",
  hostEnv: "FREE_LIVE_FOOTBALL_RAPIDAPI_HOST",
  defaultHost: "free-api-live-football-data-cheaper-version.p.rapidapi.com",
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
