import { NextRequest, NextResponse } from "next/server";
import type { PlayerProfile } from "@/lib/sofasport";
import { loadPlayersMasterIndex, masterPlayerToProfile } from "@/lib/football/player-master";
import { listSupabaseRows, upsertSupabaseRows } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";

type PlayerPoolRow = {
  payload: PlayerProfile;
  position?: string;
  market_value?: number | null;
  updated_at?: string;
};

export async function GET(request: NextRequest) {
  const position = request.nextUrl.searchParams.get("position")?.trim();
  const query = normalize(request.nextUrl.searchParams.get("q")?.trim() || "");
  const league = request.nextUrl.searchParams.get("league")?.trim() || "premier-league";
  const country = request.nextUrl.searchParams.get("country")?.trim() || "ALL";
  const team = request.nextUrl.searchParams.get("team")?.trim() || "ALL";
  const ageMin = Number(request.nextUrl.searchParams.get("ageMin") || 0);
  const ageMax = Number(request.nextUrl.searchParams.get("ageMax") || 0);
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 120), 300);
  const leagueCountry = leagueCountryName(league);

  const [masterPlayers, rows] = await Promise.all([
    loadPlayersMasterIndex(),
    listSupabaseRows<PlayerPoolRow>(
    "player_pool_cache",
    "payload,position,market_value,updated_at",
    "market_value.desc.nullslast",
    limit
    )
  ]);

  const cachedPlayers = rows.map((row) => row.payload).filter(Boolean);
  const masterProfiles = masterPlayers
    .filter((player) => !position || position === "ALL" || player.position === position)
    .filter((player) => country === "ALL" || normalize(player.countryName) === normalize(country))
    .filter((player) => country !== "ALL" || !leagueCountry || normalize(player.countryName) === normalize(leagueCountry))
    .filter((player) => {
      if (!query) return true;
      return (
        player.normalizedName.includes(query) ||
        normalize(player.countryName).includes(query) ||
        normalize(player.position).includes(query)
      );
    })
    .slice(0, limit)
    .map(masterPlayerToProfile);

  const players = mergePlayers([...cachedPlayers, ...masterProfiles])
    .filter((player) => !position || position === "ALL" || player.position === position)
    .filter((player) => country === "ALL" || normalize(player.country).includes(normalize(country)))
    .filter((player) => team === "ALL" || normalize(player.team.name).includes(normalize(team)))
    .filter((player) => {
      if (!league || league === "ALL") return true;
      const tournament = normalize(player.team.tournament || "");
      const playerCountry = normalize(player.country || "");
      return tournament.includes(normalize(leagueDisplayName(league))) || playerCountry.includes(normalize(leagueCountry));
    })
    .filter((player) => !ageMin || (player.age || 0) >= ageMin)
    .filter((player) => !ageMax || (player.age || 999) <= ageMax)
    .filter((player) => {
      if (!query) return true;
      return (
        normalize(player.name).includes(query) ||
        normalize(player.team.name).includes(query) ||
        normalize(player.country).includes(query) ||
        normalize(player.positionLabel).includes(query)
      );
    })
    .sort((a, b) => {
      const valueOrder = (b.marketValue || 0) - (a.marketValue || 0);
      if (valueOrder) return valueOrder;
      return b.metrics.future - a.metrics.future;
    })
    .slice(0, limit);

  await writeVisiblePlayers(players);

  return NextResponse.json(
    {
      players,
      source: "players-master+supabase-cache",
      totalMaster: masterPlayers.length,
      filters: { league, country, team, position, ageMin, ageMax }
    },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=3600" } }
  );
}

async function writeVisiblePlayers(players: PlayerProfile[]) {
  await upsertSupabaseRows(
    "player_pool_cache",
    players.map((player) => ({
      cache_key: `pool:${player.id}`,
      player_id: player.id,
      player_name: player.name,
      team_id: player.team.id,
      team_name: player.team.name,
      country_name: player.country,
      league_name: player.team.tournament,
      position: player.position,
      market_value: player.marketValue,
      payload: player,
      source: "player-pool"
    }))
  );
}

function mergePlayers(players: PlayerProfile[]) {
  const map = new Map<string, PlayerProfile>();

  for (const player of players) {
    const key = `${normalize(player.name)}:${player.position}:${normalize(player.country)}`;
    const existing = map.get(key);
    if (!existing || (player.marketValue || 0) > (existing.marketValue || 0)) {
      map.set(key, player);
    }
  }

  return Array.from(map.values());
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
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
    "premier-league": "England",
    laliga: "Spain",
    "serie-a": "Italy",
    bundesliga: "Germany",
    "ligue-1": "France",
    "super-lig": "Turkey"
  };
  return labels[league] || "";
}
