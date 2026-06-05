import { sofaScoreGet } from "@/lib/sofascore/client";
import type { SofaScorePlayer, SofaScoreSquadResponse } from "@/lib/sofascore/types";
import { getFotMobTeamSquad } from "@/lib/fotmob/team-squad";
import { freeLiveFootballSearchTeams } from "@/lib/providers/free-live-football";
import {
  GALATASARAY_TEAM_ID,
  compareRosterPlayers,
  getFallbackGalatasarayPlayers,
  normalizePlayer,
  type PlayerProfile
} from "@/lib/sofasport";
import { loadPlayersMasterIndex, masterPlayerToProfile, type MasterPlayer } from "@/lib/football/player-master";
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
  source: "supabase" | "sofascore" | "fotmob" | "free-live-football" | "fallback";
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

const TRUSTED_SQUAD_SOURCES = new Set(["fotmob", "sofascore"]);

function isTrustedSquad(cached: TeamSquadPayload | null, team: string) {
  return Boolean(
    cached &&
      TRUSTED_SQUAD_SOURCES.has(cached.source) &&
      cached.players.length > 0 &&
      cached.players.length <= 45 &&
      teamNameMatches(cached.team.name, team)
  );
}

export async function getTeamSquad(team: string, league = "global") {
  const cacheKey = teamSquadCacheKey(team, league);
  const cached = await readSupabaseCache<TeamSquadPayload>(TEAM_SQUAD_TABLE, cacheKey);

  if (isTrustedSquad(cached, team)) {
    return { ...(cached as TeamSquadPayload), source: "supabase" as const };
  }

  try {
    return await refreshTeamSquadFromFotMob(team, league, cached);
  } catch (error) {
    try {
      return await refreshTeamSquad(team, league, cached);
    } catch {
      try {
        return await refreshTeamSquadFromFreeLiveFootball(team, league, cached);
      } catch {
      const staleCached = await readSupabaseCache<TeamSquadPayload>(
        TEAM_SQUAD_TABLE,
        cacheKey,
        STALE_TEAM_SQUAD_TTL_MS
      );

      if (isTrustedSquad(staleCached, team)) {
        return {
          ...(staleCached as TeamSquadPayload),
          source: "supabase" as const
        };
      }

      console.warn("FotMob/SofaScore squad refresh failed, using fallback:", error);
      return buildFallbackTeamSquad(team, league);
      }
    }
  }
}

async function refreshTeamSquadFromFotMob(team: string, league = "global", previous?: TeamSquadPayload | null) {
  const payload = await getFotMobTeamSquad(team, league);
  const changeSummary = buildSquadChangeSummary(previous?.players || [], payload.players);
  const nextPayload: TeamSquadPayload = {
    ...payload,
    changeSummary
  };

  await writeTeamSquadCache(team, league, nextPayload, payload.team.id, "fotmob");

  return nextPayload;
}

async function refreshTeamSquadFromFreeLiveFootball(team: string, league = "global", previous?: TeamSquadPayload | null) {
  const result = await freeLiveFootballSearchTeams(team);
  const match = result.suggestions
    .filter((item) => item.type === "team" && item.id && item.name)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .find((item) => teamNameMatches(String(item.name), team));

  if (!match) {
    throw new Error(`${team} icin Free Live Football takim eslesmesi bulunamadi.`);
  }

  const players = teamNameMatches("Galatasaray", team)
    ? getFallbackGalatasarayPlayers()
    : await buildMasterFallbackPlayers(match.name || team, league);
  const payload: TeamSquadPayload = {
    source: "free-live-football",
    team: {
      id: Number(match.id),
      name: match.name || team,
      slug: normalizeTeamName(match.name || team).replaceAll(" ", "-")
    },
    players,
    generatedAt: new Date().toISOString(),
    changeSummary: buildSquadChangeSummary(previous?.players || [], players)
  };

  await writeTeamSquadCache(team, league, payload, payload.team.id, "free-live-football");

  return payload;
}

export async function refreshTeamSquadWithProviders(
  team: string,
  league = "global",
  previous?: TeamSquadPayload | null
) {
  try {
    return await refreshTeamSquadFromFotMob(team, league, previous);
  } catch (fotMobError) {
    try {
      return await refreshTeamSquad(team, league, previous);
    } catch {
      try {
        return await refreshTeamSquadFromFreeLiveFootball(team, league, previous);
      } catch {
        console.warn("Provider squad refresh failed, using local fallback:", fotMobError);
        return buildFallbackTeamSquad(team, league);
      }
    }
  }
}

async function buildFallbackTeamSquad(team: string, league = "global"): Promise<TeamSquadPayload> {
  const players = teamNameMatches("Galatasaray", team)
    ? getFallbackGalatasarayPlayers()
    : await buildMasterFallbackPlayers(team, league);

  return {
    source: "fallback" as const,
    team: {
      id: teamNameMatches("Galatasaray", team) ? GALATASARAY_TEAM_ID : stableTeamId(team, league),
      name: team,
      slug: normalizeTeamName(team).replaceAll(" ", "-")
    },
    players,
    generatedAt: new Date().toISOString(),
    changeSummary: {
      added: 0,
      removed: 0,
      marketValueChanged: 0,
      playerCountChanged: false
    }
  };
}

async function buildMasterFallbackPlayers(team: string, league = "global") {
  const countryCode = leagueCountryCode(league);
  const allPlayers = await loadPlayersMasterIndex();
  const pool = allPlayers.filter((player) => !countryCode || player.countryCode === countryCode);
  const selected = selectDeterministicRoster(pool.length ? pool : allPlayers, `${league}:${team}`);

  return selected
    .map((player, index) => {
      const profile = masterPlayerToProfile(player);
      return {
        ...profile,
        squadRole: index < 11 ? "starter" as const : "bench" as const,
        squadRoleLabel: index < 11 ? "İlk 11" : "Yedek",
        team: {
          id: stableTeamId(team, league),
          name: team,
          tournament: leagueDisplayName(league)
        }
      };
    })
    .sort(compareRosterPlayers);
}

function selectDeterministicRoster(players: MasterPlayer[], seed: string) {
  const byPosition = {
    G: rankedPool(players, seed, "G"),
    D: rankedPool(players, seed, "D"),
    M: rankedPool(players, seed, "M"),
    F: rankedPool(players, seed, "F")
  };

  const roster = [
    ...byPosition.G.slice(0, 2),
    ...byPosition.D.slice(0, 7),
    ...byPosition.M.slice(0, 8),
    ...byPosition.F.slice(0, 5)
  ];

  return roster.slice(0, 22);
}

function rankedPool(players: MasterPlayer[], seed: string, position: MasterPlayer["position"]) {
  return players
    .filter((player) => player.position === position)
    .sort((a, b) => stableScore(`${seed}:${a.masterId}`) - stableScore(`${seed}:${b.masterId}`));
}

function stableTeamId(team: string, league: string) {
  return stableScore(`${league}:${team}`) + 10_000;
}

function stableScore(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % 900_000;
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

  await writeTeamSquadCache(team, league, payload, resolved.id, "sofascore");

  return payload;
}

async function writeTeamSquadCache(
  team: string,
  league: string,
  payload: TeamSquadPayload,
  teamId: number,
  source: TeamSquadPayload["source"]
) {
  await writeSupabaseCache(TEAM_SQUAD_TABLE, {
    cache_key: teamSquadCacheKey(team, league),
    team_name: payload.team.name,
    country_name: leagueCountryName(league),
    league_name: leagueDisplayName(league),
    league_id: league,
    team_id: teamId,
    payload,
    player_count: payload.players.length,
    last_change_summary: payload.changeSummary,
    last_refreshed_at: payload.generatedAt,
    source
  });
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

function leagueCountryCode(league: string) {
  const labels: Record<string, string> = {
    "premier-league": "GB",
    laliga: "ES",
    "serie-a": "IT",
    bundesliga: "DE",
    "ligue-1": "FR",
    "super-lig": "TR"
  };
  return labels[league] || "";
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
