import { NextRequest, NextResponse } from "next/server";
import { getFotMobLeagueTeams } from "@/lib/fotmob/league-teams";
import { refreshTeamSquadWithProviders } from "@/lib/football/team-squad";
import { writePlayersToPoolCache } from "@/lib/football/player-pool-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_LEAGUES = ["premier-league", "laliga", "serie-a", "bundesliga", "ligue-1", "super-lig"];

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const requestSecret = request.nextUrl.searchParams.get("secret");
  const auth = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}` && requestSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized seed request." }, { status: 401 });
  }

  const leagues = (request.nextUrl.searchParams.get("league") || DEFAULT_LEAGUES.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const teamLimit = Number(request.nextUrl.searchParams.get("teamLimit") || 0);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") || 0), 0);

  const leagueTeams = await Promise.all(
    leagues.map(async (league) => ({
      league,
      teams: await getFotMobLeagueTeams(league)
    }))
  );
  const targets = leagueTeams
    .flatMap(({ league, teams }) => teams.map((team) => ({ league, team })))
    .slice(offset, teamLimit > 0 ? offset + teamLimit : undefined);

  const results: Array<{
    league: string;
    team: string;
    status: "updated" | "failed";
    players?: number;
    error?: string;
  }> = [];
  let importedPlayers = 0;

  for (const target of targets) {
    try {
      const payload = await refreshTeamSquadWithProviders(target.team.name, target.league);
      await writePlayersToPoolCache(payload.players, "seed-player-pool");
      importedPlayers += payload.players.length;
      results.push({
        league: target.league,
        team: payload.team.name,
        status: "updated",
        players: payload.players.length
      });
    } catch (error) {
      results.push({
        league: target.league,
        team: target.team.name,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown seed error."
      });
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    leagues,
    totalDiscoveredTeams: leagueTeams.reduce((sum, item) => sum + item.teams.length, 0),
    selectedTeams: targets.length,
    updated: results.filter((item) => item.status === "updated").length,
    failed: results.filter((item) => item.status === "failed").length,
    importedPlayers,
    nextOffset: offset + targets.length < leagueTeams.reduce((sum, item) => sum + item.teams.length, 0)
      ? offset + targets.length
      : null,
    results
  });
}
