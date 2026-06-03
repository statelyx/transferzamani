import { NextRequest, NextResponse } from "next/server";
import { masterPlayerToProfile, searchPlayersMaster, type MasterPlayer } from "@/lib/football/player-master";
import { footballServiceGet } from "@/lib/providers/footballservice";
import { normalizePlayer, type PlayerProfile } from "@/lib/sofasport";
import { sofaScoreGet, SofaScoreApiError } from "@/lib/sofascore/client";
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

  try {
    const search = await sofaScoreGet<SearchResponse>("search", { q: query }, { ttl: 300 });
    const livePlayers = normalizeSearchPlayers(search.data);
    const players = mergePlayerProfiles([...livePlayers, ...masterPlayers.map(masterPlayerToProfile)]).slice(0, limit);

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

function isFootballPlayer(type: string | undefined, entity: SearchEntity | undefined) {
  const resultType = String(type || entity?.type || "").toLocaleLowerCase("tr");
  const hasPlayerShape = Boolean(entity?.position || entity?.dateOfBirthTimestamp || entity?.proposedMarketValueRaw);
  return entity?.sport?.slug === "football" && (resultType.includes("player") || hasPlayerShape);
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function escapePostgrestLike(value: string) {
  return value.replace(/[%*_]/g, "");
}
