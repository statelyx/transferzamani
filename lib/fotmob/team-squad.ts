import { fotMobGet } from "@/lib/fotmob/client";
import { compareRosterPlayers, type PlayerProfile } from "@/lib/sofasport";

type FotMobSquadGroup = {
  title?: string;
  members?: FotMobSquadMember[];
};

type FotMobSquadMember = {
  id: number;
  name: string;
  shirtNumber?: number;
  ccode?: string;
  cname?: string;
  role?: {
    key?: string;
    fallback?: string;
  };
  positionIdsDesc?: string;
  height?: number | null;
  age?: number | null;
  dateOfBirth?: string | null;
  rating?: number | null;
  goals?: number;
  assists?: number;
  ycards?: number;
  rcards?: number;
  transferValue?: number | null;
  excludeFromRanking?: boolean;
};

type FotMobSquadResponse = {
  teamId: number;
  teamName: string;
  squad?: FotMobSquadGroup[];
};

const FOTMOB_LEAGUE_LABELS: Record<string, string> = {
  "super-lig": "Super Lig"
};

const FOTMOB_TEAM_IDS: Record<string, number> = {
  alanyaspor: 4678,
  antalyaspor: 1931,
  "basaksehir fk": 1933,
  basaksehir: 1933,
  "besiktas jk": 10188,
  besiktas: 10188,
  "caykur rizespor": 2166,
  rizespor: 2166,
  eyupspor: 4681,
  "fatih karagumruk": 2088,
  fenerbahce: 8695,
  galatasaray: 8637,
  "gaziantep fk": 4081,
  gaziantep: 4081,
  "genclerbirligi ankara": 7800,
  genclerbirligi: 7800,
  goztepe: 1925,
  kasimpasa: 4685,
  kayserispor: 10182,
  kocaelispor: 1569,
  konyaspor: 8622,
  samsunspor: 9750,
  trabzonspor: 9752
};

export async function getFotMobTeamSquad(team: string, league = "super-lig") {
  const teamId = resolveFotMobTeamId(team);
  if (!teamId) throw new Error(`${team} icin FotMob takim ID bulunamadi.`);

  const result = await fotMobGet<FotMobSquadResponse>(`api/v1/teams/${teamId}/squad`, {}, { ttl: 86_400 });
  const players = normalizeFotMobSquad(result.data, league);

  if (players.length === 0) {
    throw new Error(`${team} icin FotMob kadrosu bos dondu.`);
  }

  return {
    source: "fotmob" as const,
    team: {
      id: result.data.teamId || teamId,
      name: result.data.teamName || team,
      slug: normalizeKey(result.data.teamName || team).replaceAll(" ", "-")
    },
    players,
    generatedAt: new Date().toISOString(),
    changeSummary: {
      added: 0,
      removed: 0,
      marketValueChanged: 0,
      playerCountChanged: false
    }
  };
}

export function resolveFotMobTeamId(team: string) {
  return FOTMOB_TEAM_IDS[normalizeKey(team)] || null;
}

function normalizeFotMobSquad(data: FotMobSquadResponse, league: string) {
  const players: PlayerProfile[] = [];

  for (const group of data.squad || []) {
    const position = positionFromGroup(group.title || "");
    if (!position) continue;

    for (const member of group.members || []) {
      if (!member.id || !member.name) continue;
      players.push(fotMobMemberToProfile(member, data, league, position, players.length < 11));
    }
  }

  return players.sort(compareRosterPlayers);
}

function fotMobMemberToProfile(
  member: FotMobSquadMember,
  data: FotMobSquadResponse,
  league: string,
  position: "G" | "D" | "M" | "F",
  starter: boolean
): PlayerProfile {
  const marketValue = member.transferValue ?? null;
  const age = member.age ?? calculateAge(member.dateOfBirth || null);
  const ratingScore = member.rating ? Math.round(member.rating * 10) : 50;

  return {
    id: member.id,
    name: member.name,
    shortName: shortName(member.name),
    slug: `${member.id}`,
    initials: initials(member.name),
    position,
    positionLabel: positionLabel(position),
    detailedPosition: member.positionIdsDesc || member.role?.fallback || positionLabel(position),
    squadRole: starter ? "starter" : "bench",
    squadRoleLabel: starter ? "İlk 11" : "Yedek",
    jerseyNumber: String(member.shirtNumber || "-"),
    height: member.height || null,
    age,
    dateOfBirth: member.dateOfBirth || null,
    preferredFoot: "FotMob",
    country: member.cname || "Bilinmiyor",
    countryCode: member.ccode || "",
    userCount: Math.round((member.rating || 0) * 10_000),
    marketValue,
    marketValueLabel: formatMarketValue(marketValue),
    contractUntil: null,
    contractMonthsRemaining: null,
    contractRisk: "Orta",
    imageUrl: `https://images.fotmob.com/image_resources/playerimages/${member.id}.png`,
    team: {
      id: data.teamId,
      name: data.teamName,
      tournament: FOTMOB_LEAGUE_LABELS[league] || league
    },
    metrics: {
      market: marketValue ? clamp(Math.round(marketValue / 1_000_000) + 35, 35, 96) : 42,
      attention: clamp(ratingScore, 35, 95),
      future: age ? clamp(92 - Math.max(age - 20, 0) * 3, 32, 92) : 52,
      contract: 50,
      physical: member.height ? clamp(member.height - 115, 35, 90) : 50
    },
    attributes: attributesForPosition(position, ratingScore)
  };
}

function positionFromGroup(title: string) {
  const normalized = normalizeKey(title);
  if (normalized.includes("keeper")) return "G";
  if (normalized.includes("defender")) return "D";
  if (normalized.includes("midfielder")) return "M";
  if (normalized.includes("attacker")) return "F";
  return null;
}

function normalizeKey(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function shortName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return value;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr"))
    .join("");
}

function calculateAge(date: string | null) {
  if (!date) return null;
  const birth = new Date(date);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function positionLabel(position: string) {
  return { G: "Kaleci", D: "Defans", M: "Orta saha", F: "Forvet" }[position] || "Oyuncu";
}

function formatMarketValue(value: number | null) {
  if (!value) return "Piyasa bekliyor";
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  return `€${Math.round(value / 1_000)}K`;
}

function attributesForPosition(position: "G" | "D" | "M" | "F", rating: number) {
  const form = clamp(rating, 35, 95);
  if (position === "G") return { attack: 16, defense: form, passing: 48, physical: 62, form };
  if (position === "D") return { attack: 38, defense: form, passing: 56, physical: 68, form };
  if (position === "M") return { attack: 62, defense: 58, passing: form, physical: 60, form };
  return { attack: form, defense: 30, passing: 58, physical: 66, form };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
