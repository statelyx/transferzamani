import { NextRequest, NextResponse } from "next/server";
import { loadPlayersMasterIndex } from "@/lib/football/player-master";
import { upsertSupabaseRows } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz import istegi." }, { status: 401 });
  }

  const allPlayers = await loadPlayersMasterIndex();
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") || 0), 0);
  const limit = Number(request.nextUrl.searchParams.get("limit") || 0);
  const players = limit > 0 ? allPlayers.slice(offset, offset + limit) : allPlayers.slice(offset);
  let imported = 0;
  let failedBatches = 0;

  for (let index = 0; index < players.length; index += BATCH_SIZE) {
    const batch = players.slice(index, index + BATCH_SIZE);
    const ok = await upsertSupabaseRows(
      "player_master_index",
      batch.map((player) => ({
        cache_key: player.masterId,
        master_id: player.masterId,
        player_name: player.name,
        normalized_name: player.normalizedName,
        continent: player.continent,
        country_slug: player.countrySlug,
        country_name: player.countryName,
        country_code: player.countryCode,
        position: player.position,
        height_cm: player.heightCm,
        date_of_birth: player.dateOfBirth,
        birth_place: player.birthPlace,
        payload: player,
        source: "players-master"
      })),
      "master_id"
    );

    if (ok) {
      imported += batch.length;
    } else {
      failedBatches += 1;
    }
  }

  return NextResponse.json({
    total: allPlayers.length,
    selected: players.length,
    offset,
    imported,
    failedBatches,
    table: "player_master_index"
  });
}

export async function GET() {
  const players = await loadPlayersMasterIndex();
  const byContinent = players.reduce<Record<string, number>>((acc, player) => {
    acc[player.continent] = (acc[player.continent] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    total: players.length,
    byContinent,
    table: "player_master_index"
  });
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;

  const header = request.headers.get("x-cron-secret");
  const query = request.nextUrl.searchParams.get("secret");
  return Boolean(secret && (header === secret || query === secret));
}
