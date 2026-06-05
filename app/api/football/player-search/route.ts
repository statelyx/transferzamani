import { NextRequest, NextResponse } from "next/server";
import { masterPlayerToProfile, searchPlayersMaster, type MasterPlayer } from "@/lib/football/player-master";
import { freeLiveFootballSearchPlayers, type FreeLiveFootballSuggestion } from "@/lib/providers/free-live-football";
import { footballServiceGet } from "@/lib/providers/footballservice";
import { normalizePlayer, type PlayerProfile } from "@/lib/sofasport";
import { sofaScoreGet, SofaScoreApiError } from "@/lib/sofascore/client";
import { estimateMarketValue, formatEur, formatMarketValueAll } from "@/lib/football/market-value";
import type { SofaScorePlayer } from "@/lib/sofascore/types";
import { querySupabaseRows, writeSupabaseCache } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";

type SearchResponse = {
  results?: SearchResult[];
};

type SearchEntity = SofaScorePlayer & {
  sport?: {
    slug?: string;
  };
  type?: string | number;
};

type SearchResult = {
  type?: string;
  entity?: SearchEntity;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 25), 40);
  const position = request.nextUrl.searchParams.get("position")?.trim();

  if (query.length < 2) {
    return NextResponse.json({ players: [] });
  }

  const masterPlayers = await loadMasterCandidates(query, limit, position);
  const freeLivePlayers = await searchFreeLiveFootball(query);

  if (freeLivePlayers.players.length > 0) {
    const players = sortByQueryRelevance(mergePlayerProfiles([
      ...freeLivePlayers.players,
      ...masterPlayers.map(masterPlayerToProfile)
    ]), query).slice(0, limit);

    await Promise.allSettled(
      freeLivePlayers.players.map((player) =>
        writeSupabaseCache("player_pool_cache", {
          cache_key: `free-live-football:${player.id}`,
          player_id: player.id,
          player_name: player.name,
          team_id: player.team.id,
          team_name: player.team.name,
          country_name: player.country,
          league_name: player.team.tournament,
          position: player.position,
          market_value: player.marketValue,
          payload: player,
          source: "free-live-football"
        })
      )
    );

    return NextResponse.json(
      {
        players,
        source: "free-live-football",
        providerFallbacks: {
          freeLiveFootball: {
            ok: true,
            count: freeLivePlayers.players.length,
            source: freeLivePlayers.source
          }
        },
        masterCount: masterPlayers.length
      },
      { headers: { "Cache-Control": "s-maxage=180, stale-while-revalidate=3600" } }
    );
  }

  try {
    const search = await sofaScoreGet<SearchResponse>("search", { q: query }, { ttl: 300 });
    const livePlayers = normalizeSearchPlayers(search.data);
    const players = sortByQueryRelevance(
      mergePlayerProfiles([...livePlayers, ...masterPlayers.map(masterPlayerToProfile)]),
      query
    ).slice(0, limit);

    await Promise.allSettled(
      livePlayers.map((player) =>
        writeSupabaseCache("player_pool_cache", {
          cache_key: `sofascore:${player.id}`,
          player_id: player.id,
          player_name: player.name,
          team_id: player.team.id,
          team_name: player.team.name,
          country_name: player.country,
          league_name: player.team.tournament,
          position: player.position,
          market_value: player.marketValue,
          payload: player,
          source: "sofascore"
        })
      )
    );

    return NextResponse.json(
      { players, source: search.meta.cache, masterCount: masterPlayers.length },
      { headers: { "Cache-Control": "s-maxage=180, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oyuncu aramasi alinamadi.";
    const status = error instanceof SofaScoreApiError && error.status ? error.status : 500;
    const footballServiceResults = await searchFootballService(query);

    if (masterPlayers.length > 0) {
      return NextResponse.json(
        {
          warning: message,
          liveStatus: status,
          providerFallbacks: {
            freeLiveFootball: {
              ok: false,
              count: 0,
              source: freeLivePlayers.source,
              error: freeLivePlayers.error
            },
            footballservice: footballServiceResults
          },
          players: masterPlayers.map(masterPlayerToProfile).slice(0, limit),
          source: "players-master",
          masterCount: masterPlayers.length
        },
        { headers: { "Cache-Control": "s-maxage=180, stale-while-revalidate=3600" } }
      );
    }

    return NextResponse.json({ error: message, players: [] }, { status });
  }
}

async function searchFreeLiveFootball(query: string) {
  try {
    const result = await freeLiveFootballSearchPlayers(query);
    const players = result.suggestions
      .filter((item) => item.type === "player" && !item.isCoach && item.id && item.name)
      .map(freeLiveSuggestionToProfile);

    return {
      ok: true,
      players,
      source: result.source
    };
  } catch (error) {
    return {
      ok: false,
      players: [],
      source: "free-live-football",
      error: error instanceof Error ? error.message : "Free Live Football fallback basarisiz."
    };
  }
}

function freeLiveSuggestionToProfile(item: FreeLiveFootballSuggestion): PlayerProfile {
  const id = Number(item.id);
  const teamId = Number(item.teamId || 0);
  const marketValue = estimateMarketValue({
    seed: `free-live:${id}:${item.name || ""}`,
    position: "M",
    age: null,
    countryCode: item.ccode
  });

  return {
    id,
    name: item.name || String(item.id),
    shortName: shortName(item.name || String(item.id)),
    slug: String(item.id),
    initials: initials(item.name || String(item.id)),
    position: "NA",
    positionLabel: "Oyuncu",
    detailedPosition: "Free Live Football arama sonucu",
    squadRole: "bench",
    squadRoleLabel: "Arama",
    jerseyNumber: "-",
    height: null,
    age: null,
    dateOfBirth: null,
    preferredFoot: "Bilinmiyor",
    country: item.ccode ? item.ccode.toUpperCase() : "Bilinmiyor",
    countryCode: item.ccode || "",
    userCount: Number(item.score || 0),
    marketValue,
    marketValueLabel: formatEur(marketValue),
    marketValues: formatMarketValueAll(marketValue),
    contractUntil: null,
    contractMonthsRemaining: null,
    contractRisk: "Orta",
    imageUrl: `https://images.fotmob.com/image_resources/playerimages/${id}.png`,
    team: {
      id: teamId,
      name: item.teamName || "Serbest oyuncu havuzu",
      tournament: item.leagueName || ""
    },
    metrics: {
      market: clamp(Math.round(Math.log10(marketValue) * 14 - 45), 18, 92),
      attention: Math.min(Math.round((Number(item.score || 0) / 300_000) * 90), 90),
      future: 55,
      contract: 50,
      physical: 55
    },
    attributes: {
      attack: 55,
      defense: 52,
      passing: 58,
      physical: 55,
      form: 55
    }
  };
}

async function searchFootballService(query: string) {
  try {
    const result = await footballServiceGet<unknown[]>("search", { q: query });
    return {
      ok: true,
      count: Array.isArray(result.data) ? result.data.length : 0,
      source: result.source
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "FootballService fallback basarisiz."
    };
  }
}

async function loadMasterCandidates(query: string, limit: number, position?: string | null) {
  const normalized = normalize(query);
  const rows = await querySupabaseRows<{ payload: MasterPlayer }>(
    "player_master_index",
    {
      select: "payload",
      normalized_name: `ilike.*${escapePostgrestLike(normalized)}*`,
      order: "date_of_birth.desc.nullslast"
    },
    limit
  );

  if (rows.length > 0) {
    return rows
      .map((row) => row.payload)
      .filter((player) => !position || position === "ALL" || player.position === position);
  }

  return searchPlayersMaster(query, limit, position || undefined);
}

function normalizeSearchPlayers(response: SearchResponse) {
  const seen = new Set<number>();
  const players: PlayerProfile[] = [];

  for (const result of response.results || []) {
    const entity = result.entity;
    if (!entity?.id || !isFootballPlayer(result.type, entity)) continue;
    if (seen.has(entity.id)) continue;

    seen.add(entity.id);
    players.push(normalizePlayer(entity));
  }

  return players.sort((a, b) => {
    const valueOrder = (b.marketValue || 0) - (a.marketValue || 0);
    if (valueOrder) return valueOrder;
    return b.metrics.future - a.metrics.future;
  });
}

function mergePlayerProfiles(players: PlayerProfile[]) {
  const map = new Map<string, PlayerProfile>();
  for (const player of players) {
    const key = `${normalize(player.name)}:${normalize(player.country)}`;
    const existing = map.get(key);
    if (!existing || (player.marketValue || 0) > (existing.marketValue || 0)) {
      map.set(key, player);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const valueOrder = (b.marketValue || 0) - (a.marketValue || 0);
    if (valueOrder) return valueOrder;
    return b.metrics.future - a.metrics.future;
  });
}

function sortByQueryRelevance(players: PlayerProfile[], query: string) {
  const normalizedQuery = normalize(query);

  return [...players].sort((a, b) => {
    const relevance = queryRelevance(b.name, normalizedQuery) - queryRelevance(a.name, normalizedQuery);
    if (relevance) return relevance;

    const marketOrder = (b.marketValue || 0) - (a.marketValue || 0);
    if (marketOrder) return marketOrder;

    return b.metrics.future - a.metrics.future;
  });
}

function queryRelevance(name: string, normalizedQuery: string) {
  const normalizedName = normalize(name);
  const tokens = normalizedName.split(/\s+/);

  if (normalizedName === normalizedQuery) return 500;
  if (tokens.includes(normalizedQuery)) return 400;
  if (tokens.some((token) => token.startsWith(normalizedQuery))) return 300;
  if (normalizedName.startsWith(normalizedQuery)) return 200;
  if (normalizedName.includes(normalizedQuery)) return 100;
  return 0;
}

function isFootballPlayer(type: string | undefined, entity: SearchEntity | undefined) {
  const resultType = String(type || entity?.type || "").toLocaleLowerCase("tr");
  const hasPlayerShape = Boolean(entity?.position || entity?.dateOfBirthTimestamp || entity?.proposedMarketValueRaw);
  return entity?.sport?.slug === "football" && (resultType.includes("player") || hasPlayerShape);
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function shortName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return value;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr"))
    .join("");
}

function escapePostgrestLike(value: string) {
  return value.replace(/[%*_]/g, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
