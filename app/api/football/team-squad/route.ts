import { NextRequest, NextResponse } from "next/server";
import { SofaScoreApiError } from "@/lib/sofascore/client";
import { getTeamSquad } from "@/lib/football/team-squad";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const team = request.nextUrl.searchParams.get("team")?.trim();
  const league = request.nextUrl.searchParams.get("league")?.trim() || "global";

  if (!team) {
    return NextResponse.json({ error: "team parametresi zorunlu." }, { status: 400 });
  }

  try {
    const payload = await getTeamSquad(team, league);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=86400" }
    });
  } catch (error) {
    const status = error instanceof SofaScoreApiError && error.status ? error.status : 500;
    const message = error instanceof Error ? error.message : "Takim kadrosu alinamadi.";
    return NextResponse.json({ error: message, team }, { status });
  }
}
