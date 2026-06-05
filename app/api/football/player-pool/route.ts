import { NextRequest, NextResponse } from "next/server";
import type { PlayerProfile } from "@/lib/sofasport";
import { loadPlayersMasterIndex, masterPlayerToProfile } from "@/lib/football/player-master";
import { listSupabaseRows } from "@/lib/supabase/rest";

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
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 120), 300);

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
    });

  return NextResponse.json(
    { players: players.slice(0, limit), source: "players-master", totalMaster: masterPlayers.length },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=3600" } }
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
