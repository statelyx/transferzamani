import { NextRequest, NextResponse } from "next/server";
import { sofaScoreGet, SofaScoreApiError } from "@/lib/sofascore/client";
import type { SofaScorePlayer, SofaScoreSquadResponse } from "@/lib/sofascore/types";
import { compareRosterPlayers, normalizePlayer, type PlayerProfile } from "@/lib/sofasport";
import { readSupabaseCache, writeSupabaseCache } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";

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

type TeamSquadPayload = {
  source: "supabase" | "sofascore";
  team: {
    id: number;
    name: string;
    slug?: string;
  };
  players: PlayerProfile[];
  generatedAt: string;
};

export async function GET(request: NextRequest) {
  const team = request.nextUrl.searchParams.get("team")?.trim();
  const league = request.nextUrl.searchParams.get("league")?.trim() || "global";

  if (!team) {
    return NextResponse.json({ error: "team parametresi zorunlu." }, { status: 400 });
  }

  const cacheKey = `${league}:${team}`.toLocaleLowerCase("tr");
  const cached = await readSupabaseCache<TeamSquadPayload>("team_squad_cache", cacheKey);

  if (cached) {
    return NextResponse.json(
      { ...cached, source: "supabase" },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=86400" } }
    );
  }

  try {
    const resolved = await resolveTeam(team);
    const squad = await sofaScoreGet<SofaScoreSquadResponse>("teams/get-squad", {
      teamId: resolved.id
    });

    const players = (squad.data.players || [])
      .map(({ player }) => normalizePlayer(player as SofaScorePlayer))
      .sort(compareRosterPlayers);

    const payload: TeamSquadPayload = {
      source: "sofascore",
      team: resolved,
      players,
      generatedAt: new Date().toISOString()
    };

    await writeSupabaseCache("team_squad_cache", {
      cache_key: cacheKey,
      team_name: resolved.name,
      league_id: league,
      team_id: resolved.id,
      payload
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=86400" }
    });
  } catch (error) {
    const status = error instanceof SofaScoreApiError && error.status ? error.status : 500;
    const message = error instanceof Error ? error.message : "Takim kadrosu alinamadi.";
    return NextResponse.json({ error: message, team }, { status });
  }
}

async function resolveTeam(team: string) {
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
