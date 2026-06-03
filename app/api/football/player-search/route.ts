import { NextRequest, NextResponse } from "next/server";
import { normalizePlayer, type PlayerProfile } from "@/lib/sofasport";
import { sofaScoreGet, SofaScoreApiError } from "@/lib/sofascore/client";
import type { SofaScorePlayer } from "@/lib/sofascore/types";
import { writeSupabaseCache } from "@/lib/supabase/rest";

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

  if (query.length < 2) {
    return NextResponse.json({ players: [] });
  }

  try {
    const search = await sofaScoreGet<SearchResponse>("search", { q: query }, { ttl: 300 });
    const players = normalizeSearchPlayers(search.data).slice(0, limit);

    await Promise.allSettled(
      players.map((player) =>
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
      { players, source: search.meta.cache },
      { headers: { "Cache-Control": "s-maxage=180, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    const status = error instanceof SofaScoreApiError && error.status ? error.status : 500;
    const message = error instanceof Error ? error.message : "Oyuncu aramasi alinamadi.";
    return NextResponse.json({ error: message, players: [] }, { status });
  }
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

function isFootballPlayer(type: string | undefined, entity: SearchEntity | undefined) {
  const resultType = String(type || entity?.type || "").toLocaleLowerCase("tr");
  const hasPlayerShape = Boolean(entity?.position || entity?.dateOfBirthTimestamp || entity?.proposedMarketValueRaw);
  return entity?.sport?.slug === "football" && (resultType.includes("player") || hasPlayerShape);
}
