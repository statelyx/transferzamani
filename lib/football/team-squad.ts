import { sofaScoreGet } from "@/lib/sofascore/client";
import type { SofaScorePlayer, SofaScoreSquadResponse } from "@/lib/sofascore/types";
import { compareRosterPlayers, normalizePlayer, type PlayerProfile } from "@/lib/sofasport";
import { readSupabaseCache, writeSupabaseCache } from "@/lib/supabase/rest";

const TEAM_SQUAD_TABLE = "team_squad_cache";

type SearchResponse = {
  results?: Array<{
    entity?: {
      id?: number;
      name?: string;
      shortName?: string;
      slug?: string;
      type?: number;
      sport?: {
        slug?: string;
      };
    };
  }>;
};

export type SquadChangeSummary = {
  added: number;
  removed: number;
  marketValueChanged: number;
  playerCountChanged: boolean;
};

export type TeamSquadPayload = {
  source: "supabase" | "sofascore";
  team: {
    id: number;
    name: string;
    slug?: string;
  };
  players: PlayerProfile[];
  generatedAt: string;
  changeSummary?: SquadChangeSummary;
};

export function teamSquadCacheKey(team: string, league = "global") {
  return `${league}:${team}`.toLocaleLowerCase("tr");
}

export async function getTeamSquad(team: string, league = "global") {
  const cacheKey = teamSquadCacheKey(team, league);
  const cached = await readSupabaseCache<TeamSquadPayload>(TEAM_SQUAD_TABLE, cacheKey);

  if (cached) {
    return { ...cached, source: "supabase" as const };
  }

  return refreshTeamSquad(team, league);
}

export async function refreshTeamSquad(team: string, league = "global", previous?: TeamSquadPayload | null) {
  const resolved = await resolveTeam(team);
  const squad = await sofaScoreGet<SofaScoreSquadResponse>(
    "teams/get-squad",
    { teamId: resolved.id },
    { force: true }
  );

  const players = (squad.data.players || [])
    .map(({ player }) => normalizePlayer(player as SofaScorePlayer))
    .sort(compareRosterPlayers);

  const changeSummary = buildSquadChangeSummary(previous?.players || [], players);
  const payload: TeamSquadPayload = {
    source: "sofascore",
    team: resolved,
    players,
    generatedAt: new Date().toISOString(),
    changeSummary
  };

  await writeSupabaseCache(TEAM_SQUAD_TABLE, {
    cache_key: teamSquadCacheKey(team, league),
    team_name: resolved.name,
    country_name: leagueCountryName(league),
    league_name: leagueDisplayName(league),
    league_id: league,
    team_id: resolved.id,
    payload,
    player_count: players.length,
    last_change_summary: changeSummary,
    last_refreshed_at: payload.generatedAt,
    source: "sofascore"
  });

  return payload;
}

function leagueDisplayName(league: string) {
  const labels: Record<string, string> = {
    "premier-league": "Premier League",
    laliga: "LaLiga",
    "serie-a": "Serie A",
    bundesliga: "Bundesliga",
    "ligue-1": "Ligue 1",
    "super-lig": "Super Lig"
  };
  return labels[league] || league;
}

function leagueCountryName(league: string) {
  const labels: Record<string, string> = {
    "premier-league": "Ingiltere",
    laliga: "Ispanya",
    "serie-a": "Italya",
    bundesliga: "Almanya",
    "ligue-1": "Fransa",
    "super-lig": "Turkiye"
  };
  return labels[league] || "Global";
}

export async function resolveTeam(team: string) {
  const search = await sofaScoreGet<SearchResponse>("search", { q: team });
  const normalized = team.toLocaleLowerCase("tr");
  const candidates = (search.data.results || [])
    .map((item) => item.entity)
    .filter((entity) => entity?.id && entity.sport?.slug === "football");

  const exact =
    candidates.find((entity) => entity?.name?.toLocaleLowerCase("tr") === normalized) ||
    candidates.find((entity) => entity?.shortName?.toLocaleLowerCase("tr") === normalized) ||
    candidates[0];

  if (!exact?.id || !exact.name) {
    throw new Error(`${team} icin SofaScore takim ID bulunamadi.`);
  }

  return {
    id: exact.id,
    name: exact.name,
    slug: exact.slug
  };
}

function buildSquadChangeSummary(previous: PlayerProfile[], current: PlayerProfile[]): SquadChangeSummary {
  const previousById = new Map(previous.map((player) => [player.id, player]));
  const currentById = new Map(current.map((player) => [player.id, player]));
  let marketValueChanged = 0;

  for (const player of current) {
    const oldPlayer = previousById.get(player.id);
    if (oldPlayer && oldPlayer.marketValue !== player.marketValue) {
      marketValueChanged += 1;
    }
  }

  return {
    added: current.filter((player) => !previousById.has(player.id)).length,
    removed: previous.filter((player) => !currentById.has(player.id)).length,
    marketValueChanged,
    playerCountChanged: previous.length > 0 && previous.length !== current.length
  };
}
