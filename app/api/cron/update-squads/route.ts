import { NextRequest, NextResponse } from "next/server";
import { refreshTeamSquad, type TeamSquadPayload } from "@/lib/football/team-squad";
import { listSupabaseCacheRows } from "@/lib/supabase/rest";
import { refreshLiveTransferRumors } from "@/lib/football/transfers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const rows = await listSupabaseCacheRows<TeamSquadPayload>("team_squad_cache", 500);
  const results: Array<{
    cacheKey: string;
    team: string;
    league: string;
    status: "updated" | "failed";
    players?: number;
    changes?: TeamSquadPayload["changeSummary"];
    error?: string;
  }> = [];

  for (const row of rows) {
    const team = row.team_name || row.payload?.team?.name;
    const league = row.league_id || "global";

    if (!team) {
      results.push({
        cacheKey: row.cache_key,
        team: "-",
        league,
        status: "failed",
        error: "Team name missing."
      });
      continue;
    }

    try {
      const payload = await refreshTeamSquad(team, league, row.payload);
      results.push({
        cacheKey: row.cache_key,
        team: payload.team.name,
        league,
        status: "updated",
        players: payload.players.length,
        changes: payload.changeSummary
      });
    } catch (error) {
      results.push({
        cacheKey: row.cache_key,
        team,
        league,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown cron update error."
      });
    }
  }

  let newsUpdated = false;
  let newsError: string | null = null;
  try {
    await refreshLiveTransferRumors();
    newsUpdated = true;
  } catch (error) {
    newsError = error instanceof Error ? error.message : "Bilinmeyen haber yenileme hatası.";
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    scanned: rows.length,
    updated: results.filter((item) => item.status === "updated").length,
    failed: results.filter((item) => item.status === "failed").length,
    newsCache: {
      status: newsUpdated ? "updated" : "failed",
      error: newsError
    },
    results
  });
}
