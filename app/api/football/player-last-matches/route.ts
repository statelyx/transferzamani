import { NextRequest, NextResponse } from "next/server";
import { sofaScoreGet } from "@/lib/sofascore/client";

export const dynamic = "force-dynamic";

type ApiMatch = {
  id?: number;
  startTimestamp?: number;
  tournament?: { name?: string };
  homeTeam?: { name?: string; shortName?: string };
  awayTeam?: { name?: string; shortName?: string };
  homeScore?: { current?: number; display?: number | string };
  awayScore?: { current?: number; display?: number | string };
  status?: { description?: string; type?: string };
};

type LastMatchesResponse = {
  events?: ApiMatch[];
  matches?: ApiMatch[];
};

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId")?.trim();

  if (!playerId || !/^\d+$/.test(playerId)) {
    return NextResponse.json({ matches: [], source: "none" });
  }

  try {
    const payload = await sofaScoreGet<LastMatchesResponse>("players/get-last-matches", { playerId });
    const matches = (payload.data.events || payload.data.matches || [])
      .map((match) => normalizeMatch(match))
      .filter(Boolean)
      .slice(0, 8);

    return NextResponse.json(
      { matches, source: "sofascore" },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=1800" } }
    );
  } catch (error) {
    console.warn("Player last matches fetch failed:", error);
    return NextResponse.json(
      { matches: [], source: "sofascore" },
      { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } }
    );
  }
}

function normalizeMatch(match: ApiMatch) {
  const home = match.homeTeam?.shortName || match.homeTeam?.name;
  const away = match.awayTeam?.shortName || match.awayTeam?.name;
  if (!home || !away) return null;

  return {
    id: String(match.id || `${home}:${away}:${match.startTimestamp || ""}`),
    date: match.startTimestamp ? formatDate(match.startTimestamp) : "-",
    competition: match.tournament?.name || "Futbol",
    homeTeam: home,
    awayTeam: away,
    score: score(match.homeScore) !== null && score(match.awayScore) !== null
      ? `${score(match.homeScore)} - ${score(match.awayScore)}`
      : "-",
    status: match.status?.description || match.status?.type || "-"
  };
}

function score(value?: { current?: number; display?: number | string }) {
  if (!value) return null;
  return value.display ?? value.current ?? null;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(timestamp * 1000));
}
