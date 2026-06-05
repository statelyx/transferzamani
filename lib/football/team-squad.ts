import { sofaScoreGet } from "@/lib/sofascore/client";
import type { SofaScorePlayer, SofaScoreSquadResponse } from "@/lib/sofascore/types";
import {
  GALATASARAY_TEAM_ID,
  compareRosterPlayers,
  getFallbackGalatasarayPlayers,
  normalizePlayer,
  type PlayerProfile
} from "@/lib/sofasport";
import { readSupabaseCache, writeSupabaseCache } from "@/lib/supabase/rest";

const TEAM_SQUAD_TABLE = "team_squad_cache";
const STALE_TEAM_SQUAD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
      country?: {
        name?: string;
        alpha2?: string;
      };
      primaryUniqueTournament?: {
        name?: string;
      };
      tournament?: {
        name?: string;
        uniqueTournament?: {
          name?: string;
        };
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
  source: "supabase" | "sofascore" | "fallback";
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

  if (cached && teamNameMatches(cached.team.name, team)) {
    return { ...cached, source: "supabase" as const };
  }

  try {
    return await refreshTeamSquad(team, league, cached);
  } catch (error) {
    const staleCached = await readSupabaseCache<TeamSquadPayload>(
      TEAM_SQUAD_TABLE,
      cacheKey,
      STALE_TEAM_SQUAD_TTL_MS
    );

    if (staleCached && teamNameMatches(staleCached.team.name, team)) {
      return {
        ...staleCached,
        source: "supabase" as const,
        generatedAt: staleCached.generatedAt,
        changeSummary: staleCached.changeSummary
      };
    }

    if (teamNameMatches("Galatasaray", team)) {
      return {
        source: "fallback" as const,
        team: {
          id: GALATASARAY_TEAM_ID,
          name: "Galatasaray",
          slug: "galatasaray"
        },
        players: getFallbackGalatasarayPlayers(),
        generatedAt: new Date().toISOString(),
        changeSummary: {
          added: 0,
          removed: 0,
          marketValueChanged: 0,
          playerCountChanged: false
        }
      };
    }

    throw error;
  }
}

export async function refreshTeamSquad(team: string, league = "global", previous?: TeamSquadPayload | null) {
  const resolved = await resolveTeam(team, league);
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

export async function resolveTeam(team: string, league = "global") {
  const search = await sofaScoreGet<SearchResponse>("search", { q: team });
  const normalized = normalizeTeamName(team);
  const country = leagueCountryName(league);
  const tournament = leagueDisplayName(league);
  const candidates = (search.data.results || [])
    .map((item) => item.entity)
    .filter((entity) => entity?.id && entity.sport?.slug === "football");

  const ranked = candidates
    .map((entity) => {
      const names = [entity?.name, entity?.shortName, entity?.slug].filter(Boolean).map((value) => normalizeTeamName(String(value)));
      const exactName = names.some((value) => value === normalized);
      const looseName = names.some((value) => value.includes(normalized) || normalized.includes(value));
      const countryHit = normalizeTeamName(entity?.country?.name || "") === normalizeTeamName(country);
      const tournamentNames = [
        entity?.primaryUniqueTournament?.name,
        entity?.tournament?.uniqueTournament?.name,
        entity?.tournament?.name
      ].filter(Boolean);
      const tournamentHit = tournamentNames.some((value) => normalizeTeamName(String(value)) === normalizeTeamName(tournament));

      return {
        entity,
        score: (exactName ? 100 : 0) + (looseName ? 30 : 0) + (countryHit ? 20 : 0) + (tournamentHit ? 20 : 0)
      };
    })
    .sort((a, b) => b.score - a.score);

  const exact = ranked[0]?.entity;

  if (!exact?.id || !exact.name || !teamNameMatches(exact.name, team)) {
    throw new Error(`${team} icin SofaScore takim ID bulunamadi.`);
  }

  return {
    id: exact.id,
    name: exact.name,
    slug: exact.slug
  };
}

function teamNameMatches(actual: string, expected: string) {
  const a = normalizeTeamName(actual);
  const e = normalizeTeamName(expected);
  return a === e || a.includes(e) || e.includes(a);
}

function normalizeTeamName(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(fc|cf|sk|fk|as|bc|sc|spor|kulubu|club|football|team)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
