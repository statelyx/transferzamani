import { fotMobGet } from "@/lib/fotmob/client";

// Site lig slug -> FotMob lig ID eslemesi.
export const FOTMOB_LEAGUE_IDS: Record<string, number> = {
  "premier-league": 47,
  laliga: 87,
  "serie-a": 55,
  bundesliga: 54,
  "ligue-1": 53,
  "super-lig": 71
};

export const FOTMOB_LEAGUE_LABELS: Record<string, string> = {
  "premier-league": "Premier League",
  laliga: "LaLiga",
  "serie-a": "Serie A",
  bundesliga: "Bundesliga",
  "ligue-1": "Ligue 1",
  "super-lig": "Super Lig"
};

export type FotMobLeagueTeam = {
  id: number;
  name: string;
  shortName?: string;
};

type LeagueTableEntry = {
  id?: number;
  name?: string;
  shortName?: string;
};

type LeagueResponse = {
  table?: Array<{
    data?: {
      table?: {
        all?: LeagueTableEntry[];
      };
      tables?: Array<{
        table?: {
          all?: LeagueTableEntry[];
        };
      }>;
    };
  }>;
};

// Lig bazinda takim listesi memory cache'i (ID cozumleme tekrarini onler).
const leagueTeamCache = new Map<string, { teams: FotMobLeagueTeam[]; timestamp: number }>();
const LEAGUE_TEAM_TTL_MS = 12 * 60 * 60 * 1000;

export async function getFotMobLeagueTeams(league: string): Promise<FotMobLeagueTeam[]> {
  const leagueId = FOTMOB_LEAGUE_IDS[league];
  if (!leagueId) return [];

  const cached = leagueTeamCache.get(league);
  if (cached && Date.now() - cached.timestamp < LEAGUE_TEAM_TTL_MS) {
    return cached.teams;
  }

  const result = await fotMobGet<LeagueResponse>(`api/v1/leagues/${leagueId}`, {}, { ttl: 43_200 });
  const teams = extractLeagueTeams(result.data);

  if (teams.length) {
    leagueTeamCache.set(league, { teams, timestamp: Date.now() });
  }

  return teams;
}

function extractLeagueTeams(data: LeagueResponse): FotMobLeagueTeam[] {
  const entries: LeagueTableEntry[] = [];

  for (const section of data.table || []) {
    const all = section.data?.table?.all;
    if (Array.isArray(all)) entries.push(...all);

    // Bazi liglerde gruplu tablo (tables[]) dondurulur.
    for (const sub of section.data?.tables || []) {
      const subAll = sub.table?.all;
      if (Array.isArray(subAll)) entries.push(...subAll);
    }
  }

  const seen = new Set<number>();
  const teams: FotMobLeagueTeam[] = [];

  for (const entry of entries) {
    if (!entry.id || !entry.name || seen.has(entry.id)) continue;
    seen.add(entry.id);
    teams.push({ id: entry.id, name: entry.name, shortName: entry.shortName });
  }

  return teams;
}

// Takim adini lig tablosundaki FotMob takimina eslestirir.
export async function resolveFotMobTeamFromLeague(team: string, league: string): Promise<FotMobLeagueTeam | null> {
  const teams = await getFotMobLeagueTeams(league);
  if (!teams.length) return null;

  const normalizedTarget = normalizeTeamName(team);
  if (!normalizedTarget) return null;

  // 1) Tam eslesme.
  const exact = teams.find((item) => normalizeTeamName(item.name) === normalizedTarget);
  if (exact) return exact;

  // 2) Substring eslesme (iki yonlu).
  const loose = teams.find((item) => {
    const candidate = normalizeTeamName(item.name);
    return candidate && (candidate.includes(normalizedTarget) || normalizedTarget.includes(candidate));
  });
  if (loose) return loose;

  // 3) Token-overlap skorlama: en cok ortak ayirt edici token'a sahip takim.
  const targetTokens = tokenize(normalizedTarget);
  let best: { team: FotMobLeagueTeam; score: number } | null = null;

  for (const item of teams) {
    const candidateTokens = tokenize(normalizeTeamName(item.name));
    let score = 0;
    for (const token of targetTokens) {
      if (candidateTokens.includes(token)) {
        // Uzun/ayirt edici token daha cok puan getirir.
        score += token.length >= 5 ? 3 : 1;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { team: item, score };
    }
  }

  // En az bir guclu (ayirt edici) token eslesmesi sart.
  return best && best.score >= 3 ? best.team : null;
}

function tokenize(value: string) {
  const stop = new Set(["the", "de", "of", "1", "04", "05", "1899", "1909", "1913", "1846", "1907"]);
  return value.split(/\s+/).filter((token) => token.length > 1 && !stop.has(token));
}

function normalizeTeamName(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(fc|cf|sk|fk|as|bc|sc|afc|spor|kulubu|club|football|team|calcio|cd|rc|ac|ssc|us|ud|sd)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
