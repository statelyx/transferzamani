import { NextRequest, NextResponse } from "next/server";
import { loadPlayersMasterIndex } from "@/lib/football/player-master";
import { upsertSupabaseRows } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 500;
const DEFAULT_IMPORT_LIMIT = 1000;

export async function POST(request: NextRequest) {
  return importPlayersMaster(request);
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("run") === "1") {
    return importPlayersMaster(request);
  }

  const players = await loadPlayersMasterIndex();
  const byContinent = players.reduce<Record<string, number>>((acc, player) => {
    acc[player.continent] = (acc[player.continent] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    total: players.length,
    byContinent,
    table: "player_master_index",
    importHint: "/api/admin/import-players-master?run=1&offset=0&limit=1000&secret=CRON_SECRET"
  });
}

async function importPlayersMaster(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz import istegi." }, { status: 401 });
  }

  const allPlayers = await loadPlayersMasterIndex();
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") || 0), 0);
  const importAll = request.nextUrl.searchParams.get("all") === "1";
  const limit = importAll ? 0 : Number(request.nextUrl.searchParams.get("limit") || DEFAULT_IMPORT_LIMIT);
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
    ok: failedBatches === 0,
    total: allPlayers.length,
    selected: players.length,
    offset,
    nextOffset: offset + imported < allPlayers.length ? offset + imported : null,
    remaining: Math.max(allPlayers.length - offset - imported, 0),
    imported,
    failedBatches,
    table: "player_master_index",
    nextHint:
      offset + imported < allPlayers.length
        ? `/api/admin/import-players-master?run=1&offset=${offset + imported}&limit=${limit || DEFAULT_IMPORT_LIMIT}&secret=CRON_SECRET`
        : null
  });
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;

  const header = request.headers.get("x-cron-secret");
  const query = request.nextUrl.searchParams.get("secret");
  return Boolean(secret && (header === secret || query === secret));
}
