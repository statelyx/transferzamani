import type { PlayerProfile } from "@/lib/sofasport";
import { listSupabaseCacheRows, upsertSupabaseRows } from "@/lib/supabase/rest";
import type { TeamSquadPayload } from "@/lib/football/team-squad";

export type PlayerPoolRow = {
  payload: PlayerProfile;
  position?: string;
  market_value?: number | null;
  updated_at?: string;
};

export async function listCachedSquadPlayers(limit = 1200) {
  const rows = await listSupabaseCacheRows<TeamSquadPayload>("team_squad_cache", limit);
  const players: PlayerProfile[] = [];

  for (const row of rows) {
    if (!row.payload?.players?.length) continue;
    players.push(...row.payload.players);
  }

  return mergePlayers(players);
}

export async function listCachedPoolPlayers(limit = 1200) {
  const rows = await listSupabaseCacheRows<PlayerProfile>("player_pool_cache", limit);
  return mergePlayers(rows.map((row) => row.payload).filter(Boolean));
}

export async function writePlayersToPoolCache(players: PlayerProfile[], source = "team-squad") {
  const uniquePlayers = mergePlayers(players);

  return upsertSupabaseRows(
    "player_pool_cache",
    uniquePlayers.map((player) => ({
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
      source
    }))
  );
}

function mergePlayers(players: PlayerProfile[]) {
  const map = new Map<number, PlayerProfile>();

  for (const player of players) {
    if (!player?.id) continue;
    const normalizedPlayer = normalizeImageUrl(player);
    const existing = map.get(player.id);
    if (!existing || (normalizedPlayer.marketValue || 0) > (existing.marketValue || 0)) {
      map.set(player.id, normalizedPlayer);
    }
  }

  return Array.from(map.values());
}

function normalizeImageUrl(player: PlayerProfile) {
  const match = player.imageUrl?.match(/images\.fotmob\.com\/image_resources\/playerimages\/(\d+)\.png/i);
  if (!match) return player;

  return {
    ...player,
    imageUrl: `/api/image/fotmob-player/${match[1]}`
  };
}
