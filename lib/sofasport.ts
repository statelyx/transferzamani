import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const GALATASARAY_TEAM_ID = 3061;

type RawPlayer = {
  name: string;
  shortName?: string;
  slug?: string;
  team?: RawTeam;
  position?: string;
  positionsDetailed?: string[];
  jerseyNumber?: string;
  shirtNumber?: number;
  height?: number;
  dateOfBirth?: string;
  dateOfBirthTimestamp?: number;
  preferredFoot?: string;
  userCount?: number;
  sofascoreId?: string;
  country?: {
    name?: string;
    alpha2?: string;
    alpha3?: string;
    slug?: string;
  };
  id: number;
  contractUntilTimestamp?: number;
  proposedMarketValue?: number;
  proposedMarketValueRaw?: {
    value?: number;
    currency?: string;
  };
};

type RawTeam = {
  id: number;
  name: string;
  shortName?: string;
  slug?: string;
  country?: {
    name?: string;
    alpha2?: string;
  };
  tournament?: {
    name?: string;
    uniqueTournament?: {
      id?: number;
      name?: string;
    };
  };
  primaryUniqueTournament?: {
    id?: number;
    name?: string;
  };
  teamColors?: {
    primary?: string;
    secondary?: string;
    text?: string;
  };
};

type RawEvent = {
  id: number;
  slug?: string;
  tournament?: {
    name?: string;
  };
  season?: {
    name?: string;
    year?: string;
    id?: number;
  };
  roundInfo?: {
    round?: number;
  };
  status?: {
    description?: string;
    type?: string;
  };
  homeTeam?: RawTeam;
  awayTeam?: RawTeam;
  homeScore?: {
    current?: number;
    display?: number;
  };
  awayScore?: {
    current?: number;
    display?: number;
  };
  startTimestamp?: number;
  hasXg?: boolean;
  hasEventPlayerStatistics?: boolean;
};

type RawLineupPlayer = {
  player: RawPlayer;
  teamId?: number;
  shirtNumber?: number;
  jerseyNumber?: string;
  position?: string;
  substitute?: boolean;
};

type RawLineups = {
  confirmed?: boolean;
  home?: {
    players?: RawLineupPlayer[];
  };
  away?: {
    players?: RawLineupPlayer[];
  };
};

export type PlayerProfile = {
  id: number;
  name: string;
  shortName: string;
  slug: string;
  initials: string;
  position: string;
  positionLabel: string;
  detailedPosition: string;
  squadRole: "starter" | "bench";
  squadRoleLabel: string;
  jerseyNumber: string;
  height: number | null;
  age: number | null;
  dateOfBirth: string | null;
  preferredFoot: string;
  country: string;
  countryCode: string;
  userCount: number;
  marketValue: number | null;
  marketValueLabel: string;
  contractUntil: string | null;
  contractMonthsRemaining: number | null;
  contractRisk: "Düşük" | "Orta" | "Yüksek";
  imageUrl: string;
  team: {
    id: number;
    name: string;
    tournament: string;
  };
  metrics: {
    market: number;
    attention: number;
    future: number;
    contract: number;
    physical: number;
  };
};

export type TeamEvent = {
  id: number;
  tournament: string;
  season: string;
  round: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  startDate: string;
  hasXg: boolean;
  hasPlayerStats: boolean;
};

export type Rumor = {
  id: string;
  playerId: number;
  playerName: string;
  headline: string;
  linkedClub: string;
  type: "İlgi" | "Görüşme" | "Teklif" | "Kontrat" | "Yalanlandı";
  confidence: number;
  sourceCount: number;
  sourceQuality: number;
  detailLevel: number;
  timeline: string;
  reasons: string[];
  label: "Demo kayıt";
};

export type GalatasarayPayload = {
  generatedAt: string;
  status: {
    mode: "live" | "stale" | "fallback";
    message: string;
  };
  team: {
    id: number;
    name: string;
    tournament: string;
    uniqueTournamentId: number | null;
    colors: {
      primary: string;
      secondary: string;
      text: string;
    };
    playerCount: number;
    foreignCount: number;
    nationalCount: number;
  };
  players: PlayerProfile[];
  events: {
    previous: TeamEvent | null;
    next: TeamEvent | null;
  };
  rumors: Rumor[];
  endpoints: {
    players: string;
    nearEvents: string;
  };
};

const API_BASE = "https://sofasport.p.rapidapi.com";
const CACHE_TTL_MS = 30 * 60 * 1000;
const STALE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_VERSION = 4;
let memoryCache: { payload: GalatasarayPayload; timestamp: number } | null = null;

async function sofaFetch<T>(path: string): Promise<T> {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST || "sofasport.p.rapidapi.com";

  if (!key) {
    throw new Error("RAPIDAPI_KEY ortam değişkeni tanımlı değil.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": host,
      "x-rapidapi-key": key
    },
    next: {
      revalidate: 1800
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SofaSport API hatası: ${response.status} ${body.slice(0, 240)}`);
  }

  return response.json() as Promise<T>;
}

export async function getGalatasarayPayload(): Promise<GalatasarayPayload> {
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.payload;
  }

  const freshFileCache = await readCacheFile(CACHE_TTL_MS);
  if (freshFileCache) {
    memoryCache = freshFileCache;
    return freshFileCache.payload;
  }

  try {
    const payload = await loadLiveGalatasarayPayload();
    memoryCache = { payload, timestamp: Date.now() };
    await writeCacheFile(memoryCache);
    return payload;
  } catch (error) {
    if (memoryCache) {
      return {
        ...memoryCache.payload,
        status: {
          mode: "stale",
          message:
            "Canlı API isteği başarısız oldu; son başarılı yanıt geçici olarak gösteriliyor."
        }
      };
    }

    const staleFileCache = await readCacheFile(STALE_CACHE_TTL_MS);
    if (staleFileCache) {
      const payload = {
        ...staleFileCache.payload,
        status: {
          mode: "stale" as const,
          message:
            "Canlı API isteği başarısız oldu; disk cache üzerindeki son başarılı yanıt gösteriliyor."
        }
      };
      memoryCache = { payload, timestamp: Date.now() };
      return payload;
    }

    return buildFallbackPayload(error instanceof Error ? error.message : "API isteği başarısız.");
  }
}

async function readCacheFile(maxAgeMs: number) {
  try {
    const raw = await readFile(cacheFilePath(), "utf-8");
    const parsed = JSON.parse(raw) as {
      payload: GalatasarayPayload;
      timestamp: number;
      version?: number;
    };

    if (parsed.version !== CACHE_VERSION) return null;
    if (!parsed.payload || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > maxAgeMs) return null;

    return parsed;
  } catch {
    return null;
  }
}

async function writeCacheFile(cache: { payload: GalatasarayPayload; timestamp: number }) {
  try {
    const file = cacheFilePath();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ ...cache, version: CACHE_VERSION }), "utf-8");
  } catch {
    // Cache write failure should not break the live response.
  }
}

function cacheFilePath() {
  return path.join(process.cwd(), ".runtime-cache", "galatasaray-payload.json");
}

async function loadLiveGalatasarayPayload(): Promise<GalatasarayPayload> {
  const [playersResponse, nearEventsResponse] = await Promise.all([
    sofaFetch<{
      data: {
        players: Array<{ player: RawPlayer }>;
        foreignPlayers?: Array<{ player: RawPlayer }>;
        nationalPlayers?: Array<{ player: RawPlayer }>;
      };
    }>(`/v1/teams/players?team_id=${GALATASARAY_TEAM_ID}`),
    sofaFetch<{
      data: {
        previousEvent?: RawEvent | null;
        nextEvent?: RawEvent | null;
      };
    }>(`/v1/teams/near-events?team_id=${GALATASARAY_TEAM_ID}`)
  ]);

  const previousEvent = nearEventsResponse.data.previousEvent || null;
  const lineups = previousEvent?.id ? await getEventLineups(previousEvent.id) : null;
  const lineupRoles = buildLineupRoleMap(lineups);

  const players = playersResponse.data.players
    .map(({ player }) => normalizePlayer(player, lineupRoles.get(player.id)))
    .sort(compareRosterPlayers);

  const teamFromPlayer = playersResponse.data.players[0]?.player.team;

  return {
    generatedAt: new Date().toISOString(),
    status: {
      mode: "live",
      message: "Canlı SofaSport verisi gösteriliyor."
    },
    team: {
      id: GALATASARAY_TEAM_ID,
      name: teamFromPlayer?.name || "Galatasaray",
      tournament:
        teamFromPlayer?.primaryUniqueTournament?.name ||
        teamFromPlayer?.tournament?.uniqueTournament?.name ||
        teamFromPlayer?.tournament?.name ||
        "Trendyol Süper Lig",
      uniqueTournamentId:
        teamFromPlayer?.primaryUniqueTournament?.id ||
        teamFromPlayer?.tournament?.uniqueTournament?.id ||
        null,
      colors: {
        primary: teamFromPlayer?.teamColors?.primary || "#ff9900",
        secondary: teamFromPlayer?.teamColors?.secondary || "#ff0000",
        text: teamFromPlayer?.teamColors?.text || "#111111"
      },
      playerCount: players.length,
      foreignCount: playersResponse.data.foreignPlayers?.length || 0,
      nationalCount: playersResponse.data.nationalPlayers?.length || 0
    },
    players,
    events: {
      previous: normalizeEvent(previousEvent),
      next: normalizeEvent(nearEventsResponse.data.nextEvent || null)
    },
    rumors: buildDemoRumors(players),
    endpoints: {
      players: `/v1/teams/players?team_id=${GALATASARAY_TEAM_ID}`,
      nearEvents: `/v1/teams/near-events?team_id=${GALATASARAY_TEAM_ID}`
    }
  };
}

async function getEventLineups(eventId: number) {
  try {
    const response = await sofaFetch<{ data: RawLineups }>(
      `/v1/events/lineups?event_id=${eventId}`
    );

    return response.data;
  } catch {
    return null;
  }
}

function buildLineupRoleMap(lineups: RawLineups | null) {
  const map = new Map<number, PlayerProfile["squadRole"]>();
  const lineupPlayers = [
    ...(lineups?.home?.players || []),
    ...(lineups?.away?.players || [])
  ].filter((item) => item.teamId === GALATASARAY_TEAM_ID);

  for (const item of lineupPlayers) {
    map.set(item.player.id, item.substitute ? "bench" : "starter");
  }

  return map;
}

function buildFallbackPayload(reason: string): GalatasarayPayload {
  const players = fallbackPlayers()
    .map((player, index) => normalizePlayer(player, index < 11 ? "starter" : "bench"))
    .sort(compareRosterPlayers);

  return {
    generatedAt: new Date().toISOString(),
    status: {
      mode: "fallback",
      message: `Canlı API şu anda kullanılamıyor; prototip açıkça etiketlenmiş fallback veriyle gösteriliyor. Sebep: ${reason}`
    },
    team: {
      id: GALATASARAY_TEAM_ID,
      name: "Galatasaray",
      tournament: "Trendyol Süper Lig",
      uniqueTournamentId: 52,
      colors: {
        primary: "#ff9900",
        secondary: "#ff0000",
        text: "#ff0000"
      },
      playerCount: players.length,
      foreignCount: players.filter((player) => player.country !== "Türkiye").length,
      nationalCount: players.filter((player) => player.country === "Türkiye").length
    },
    players,
    events: {
      previous: {
        id: 14109924,
        tournament: "Trendyol Süper Lig",
        season: "Super Lig 25/26",
        round: "34. Hafta",
        status: "Ended",
        homeTeam: "Kasımpaşa",
        awayTeam: "Galatasaray",
        score: "1 - 0",
        startDate: "17 May 2026",
        hasXg: true,
        hasPlayerStats: true
      },
      next: null
    },
    rumors: buildDemoRumors(players),
    endpoints: {
      players: `/v1/teams/players?team_id=${GALATASARAY_TEAM_ID}`,
      nearEvents: `/v1/teams/near-events?team_id=${GALATASARAY_TEAM_ID}`
    }
  };
}

function normalizePlayer(
  player: RawPlayer,
  squadRole: PlayerProfile["squadRole"] = "bench"
): PlayerProfile {
  const age = calculateAge(player.dateOfBirthTimestamp, player.dateOfBirth);
  const contractMonthsRemaining = calculateMonthsRemaining(player.contractUntilTimestamp);
  const marketValue = player.proposedMarketValueRaw?.value ?? player.proposedMarketValue ?? null;

  return {
    id: player.id,
    name: player.name,
    shortName: player.shortName || player.name,
    slug: player.slug || String(player.id),
    initials: initials(player.name),
    position: player.position || "NA",
    positionLabel: positionLabel(player.position || "NA"),
    detailedPosition: Array.isArray(player.positionsDetailed)
      ? player.positionsDetailed.join(", ")
      : positionLabel(player.position || "NA"),
    squadRole,
    squadRoleLabel: squadRole === "starter" ? "İlk 11" : "Yedek",
    jerseyNumber: String(player.shirtNumber || player.jerseyNumber || "-"),
    height: player.height || null,
    age,
    dateOfBirth: player.dateOfBirth ? formatDate(player.dateOfBirth) : null,
    preferredFoot: translateFoot(player.preferredFoot),
    country: player.country?.name || "Bilinmiyor",
    countryCode: player.country?.alpha2 || "",
    userCount: player.userCount || 0,
    marketValue,
    marketValueLabel: formatMarketValue(marketValue),
    contractUntil: player.contractUntilTimestamp
      ? formatDateFromTimestamp(player.contractUntilTimestamp)
      : null,
    contractMonthsRemaining,
    contractRisk: contractRisk(contractMonthsRemaining),
    imageUrl: `/api/image/player/${player.id}`,
    team: {
      id: player.team?.id || GALATASARAY_TEAM_ID,
      name: player.team?.name || "Galatasaray",
      tournament:
        player.team?.primaryUniqueTournament?.name ||
        player.team?.tournament?.uniqueTournament?.name ||
        player.team?.tournament?.name ||
        "Trendyol Süper Lig"
    },
    metrics: {
      market: metricFromMarketValue(marketValue),
      attention: clamp(Math.round(Math.log10((player.userCount || 1) + 1) * 17), 8, 100),
      future: futureMetric(age, marketValue),
      contract: contractMetric(contractMonthsRemaining),
      physical: physicalMetric(player.height, player.position)
    }
  };
}

function normalizeEvent(event: RawEvent | null): TeamEvent | null {
  if (!event) return null;

  const home = event.homeTeam?.shortName || event.homeTeam?.name || "-";
  const away = event.awayTeam?.shortName || event.awayTeam?.name || "-";
  const homeScore = event.homeScore?.display ?? event.homeScore?.current;
  const awayScore = event.awayScore?.display ?? event.awayScore?.current;

  return {
    id: event.id,
    tournament: event.tournament?.name || "Turnuva",
    season: event.season?.name || event.season?.year || "-",
    round: event.roundInfo?.round ? `${event.roundInfo.round}. Hafta` : "-",
    status: event.status?.description || event.status?.type || "-",
    homeTeam: home,
    awayTeam: away,
    score:
      typeof homeScore === "number" && typeof awayScore === "number"
        ? `${homeScore} - ${awayScore}`
        : "-",
    startDate: event.startTimestamp ? formatDateFromTimestamp(event.startTimestamp) : "-",
    hasXg: Boolean(event.hasXg),
    hasPlayerStats: Boolean(event.hasEventPlayerStatistics)
  };
}

function buildDemoRumors(players: PlayerProfile[]): Rumor[] {
  const byName = (needle: string) =>
    players.find((player) => player.name.toLocaleLowerCase("tr").includes(needle));

  const candidates = [
    {
      player: byName("osimhen") || players[0],
      headline: "Avrupa'dan santrfor takibi",
      linkedClub: "Premier League kulüpleri",
      type: "İlgi" as const,
      sourceCount: 3,
      sourceQuality: 82,
      detailLevel: 68,
      timeline: "Son 24 saat",
      reasons: [
        "Oyuncu profili yüksek takip ve piyasa değeri üretiyor.",
        "Birden fazla bağımsız kaynak aynı pazar yönünü işaret ediyor.",
        "Resmi teklif sinyali olmadığı için skor kontrollü tutuldu."
      ]
    },
    {
      player: byName("barış") || byName("yılmaz") || players[1],
      headline: "Yerli kanat için dış pazar ilgisi",
      linkedClub: "İngiltere ve Almanya pazarı",
      type: "Görüşme" as const,
      sourceCount: 2,
      sourceQuality: 74,
      detailLevel: 72,
      timeline: "Bu hafta",
      reasons: [
        "Yaş ve pozisyon profili transfer piyasasında güçlü.",
        "Kaynaklar kulüp adından çok lig yönünü öne çıkarıyor.",
        "Detay seviyesi orta, doğrulama bekliyor."
      ]
    },
    {
      player: byName("torreira") || players[2],
      headline: "Kontrat dengesi takip ediliyor",
      linkedClub: "Galatasaray",
      type: "Kontrat" as const,
      sourceCount: 2,
      sourceQuality: 69,
      detailLevel: 78,
      timeline: "Son 7 gün",
      reasons: [
        "Kontrat durumu ve oyuncu rolü karar değerini artırıyor.",
        "Kulüp içi devam senaryosu transferden daha güçlü görünüyor.",
        "Skor haberden çok sözleşme bağlamına dayanıyor."
      ]
    },
    {
      player: byName("icardi") || players[3],
      headline: "Ayrılık iddiaları zayıf sinyalde",
      linkedClub: "Güney Amerika pazarı",
      type: "Yalanlandı" as const,
      sourceCount: 1,
      sourceQuality: 48,
      detailLevel: 42,
      timeline: "Eski iddia",
      reasons: [
        "Tek kaynaklı ve düşük detaylı iddia.",
        "Oyuncunun kulüp bağlamı ve sözleşmesi iddiayı zayıflatıyor.",
        "Yalanlama tipi nedeniyle güven skoru bilinçli düşük."
      ]
    }
  ];

  return candidates
    .filter((candidate) => candidate.player)
    .map((candidate, index) => ({
      id: `demo-${index + 1}`,
      playerId: candidate.player.id,
      playerName: candidate.player.name,
      headline: candidate.headline,
      linkedClub: candidate.linkedClub,
      type: candidate.type,
      confidence: calculateRumorConfidence({
        sourceCount: candidate.sourceCount,
        sourceQuality: candidate.sourceQuality,
        detailLevel: candidate.detailLevel,
        type: candidate.type
      }),
      sourceCount: candidate.sourceCount,
      sourceQuality: candidate.sourceQuality,
      detailLevel: candidate.detailLevel,
      timeline: candidate.timeline,
      reasons: candidate.reasons,
      label: "Demo kayıt" as const
    }));
}

function fallbackPlayers(): RawPlayer[] {
  const team: RawTeam = {
    id: GALATASARAY_TEAM_ID,
    name: "Galatasaray",
    shortName: "Galatasaray",
    slug: "galatasaray",
    country: {
      name: "Türkiye",
      alpha2: "TR"
    },
    primaryUniqueTournament: {
      id: 52,
      name: "Trendyol Süper Lig"
    },
    teamColors: {
      primary: "#ff9900",
      secondary: "#ff0000",
      text: "#ff0000"
    }
  };

  const player = (input: {
    id: number;
    name: string;
    position: string;
    shirtNumber: number;
    country: string;
    countryCode: string;
    height: number;
    birth: string;
    foot: string;
    userCount: number;
    market: number;
    contract: string;
  }): RawPlayer => ({
    id: input.id,
    name: input.name,
    shortName: input.name,
    slug: input.name.toLocaleLowerCase("tr").replaceAll(" ", "-"),
    team,
    position: input.position,
    shirtNumber: input.shirtNumber,
    jerseyNumber: String(input.shirtNumber),
    country: {
      name: input.country,
      alpha2: input.countryCode
    },
    height: input.height,
    dateOfBirth: input.birth,
    dateOfBirthTimestamp: Math.floor(new Date(input.birth).getTime() / 1000),
    preferredFoot: input.foot,
    userCount: input.userCount,
    contractUntilTimestamp: Math.floor(new Date(input.contract).getTime() / 1000),
    proposedMarketValue: input.market,
    proposedMarketValueRaw: {
      value: input.market,
      currency: "EUR"
    }
  });

  return [
    player({
      id: 754330,
      name: "Uğurcan Çakır",
      position: "G",
      shirtNumber: 1,
      country: "Türkiye",
      countryCode: "TR",
      height: 192,
      birth: "1996-04-05T00:00:00.000Z",
      foot: "Right",
      userCount: 7906,
      market: 14_500_000,
      contract: "2030-06-30T00:00:00.000Z"
    }),
    player({
      id: 867595,
      name: "Batuhan Şen",
      position: "G",
      shirtNumber: 12,
      country: "Türkiye",
      countryCode: "TR",
      height: 192,
      birth: "1999-02-03T00:00:00.000Z",
      foot: "Right",
      userCount: 1531,
      market: 210_000,
      contract: "2027-06-30T00:00:00.000Z"
    }),
    player({
      id: 913593,
      name: "Wilfried Singo",
      position: "D",
      shirtNumber: 90,
      country: "Côte d'Ivoire",
      countryCode: "CI",
      height: 190,
      birth: "2000-12-25T00:00:00.000Z",
      foot: "Right",
      userCount: 28242,
      market: 21_000_000,
      contract: "2029-06-30T00:00:00.000Z"
    }),
    player({
      id: 1092769,
      name: "Davinson Sánchez",
      position: "D",
      shirtNumber: 6,
      country: "Colombia",
      countryCode: "CO",
      height: 187,
      birth: "1996-06-12T00:00:00.000Z",
      foot: "Right",
      userCount: 50435,
      market: 16_500_000,
      contract: "2028-06-30T00:00:00.000Z"
    }),
    player({
      id: 904096,
      name: "Barış Alper Yılmaz",
      position: "M",
      shirtNumber: 53,
      country: "Türkiye",
      countryCode: "TR",
      height: 186,
      birth: "2000-05-23T00:00:00.000Z",
      foot: "Right",
      userCount: 129608,
      market: 32_000_000,
      contract: "2028-06-30T00:00:00.000Z"
    }),
    player({
      id: 978285,
      name: "Leroy Sané",
      position: "M",
      shirtNumber: 10,
      country: "Germany",
      countryCode: "DE",
      height: 183,
      birth: "1996-01-11T00:00:00.000Z",
      foot: "Left",
      userCount: 221842,
      market: 24_000_000,
      contract: "2028-06-30T00:00:00.000Z"
    }),
    player({
      id: 875136,
      name: "Gabriel Sara",
      position: "M",
      shirtNumber: 8,
      country: "Brazil",
      countryCode: "BR",
      height: 177,
      birth: "1999-06-26T00:00:00.000Z",
      foot: "Left",
      userCount: 34781,
      market: 21_000_000,
      contract: "2029-06-30T00:00:00.000Z"
    }),
    player({
      id: 857738,
      name: "Yunus Akgün",
      position: "M",
      shirtNumber: 11,
      country: "Türkiye",
      countryCode: "TR",
      height: 173,
      birth: "2000-07-07T00:00:00.000Z",
      foot: "Left",
      userCount: 42139,
      market: 16_700_000,
      contract: "2028-06-30T00:00:00.000Z"
    }),
    player({
      id: 822471,
      name: "Victor Osimhen",
      position: "F",
      shirtNumber: 45,
      country: "Nigeria",
      countryCode: "NG",
      height: 186,
      birth: "1998-12-29T00:00:00.000Z",
      foot: "Right",
      userCount: 328501,
      market: 73_000_000,
      contract: "2028-06-30T00:00:00.000Z"
    }),
    player({
      id: 293519,
      name: "Noa Lang",
      position: "F",
      shirtNumber: 77,
      country: "Netherlands",
      countryCode: "NL",
      height: 179,
      birth: "1999-06-17T00:00:00.000Z",
      foot: "Right",
      userCount: 86063,
      market: 24_000_000,
      contract: "2029-06-30T00:00:00.000Z"
    }),
    player({
      id: 45853,
      name: "Mauro Icardi",
      position: "F",
      shirtNumber: 9,
      country: "Argentina",
      countryCode: "AR",
      height: 181,
      birth: "1993-02-19T00:00:00.000Z",
      foot: "Right",
      userCount: 225117,
      market: 8_000_000,
      contract: "2026-06-30T00:00:00.000Z"
    }),
    player({
      id: 307284,
      name: "Lucas Torreira",
      position: "M",
      shirtNumber: 34,
      country: "Uruguay",
      countryCode: "UY",
      height: 168,
      birth: "1996-02-11T00:00:00.000Z",
      foot: "Right",
      userCount: 128404,
      market: 15_000_000,
      contract: "2028-06-30T00:00:00.000Z"
    })
  ];
}

function calculateRumorConfidence(input: {
  sourceCount: number;
  sourceQuality: number;
  detailLevel: number;
  type: Rumor["type"];
}) {
  const sourceBreadth = Math.min(input.sourceCount * 12, 34);
  const base = input.sourceQuality * 0.42 + input.detailLevel * 0.34 + sourceBreadth;
  const typeModifier = input.type === "Teklif" ? 8 : input.type === "Yalanlandı" ? -18 : 0;
  return clamp(Math.round(base + typeModifier), 12, 94);
}

function positionOrder(position: string) {
  return { G: 0, D: 1, M: 2, F: 3 }[position as "G" | "D" | "M" | "F"] ?? 9;
}

function compareRosterPlayers(a: PlayerProfile, b: PlayerProfile) {
  const roleOrder = (a.squadRole === "starter" ? 0 : 1) - (b.squadRole === "starter" ? 0 : 1);
  if (roleOrder) return roleOrder;

  const position = positionOrder(a.position) - positionOrder(b.position);
  if (position) return position;

  return Number(a.jerseyNumber || 999) - Number(b.jerseyNumber || 999);
}

function positionLabel(position: string) {
  const labels: Record<string, string> = {
    G: "Kaleci",
    D: "Stoper/Defans",
    M: "Orta saha",
    F: "Forvet",
    NA: "Bilinmiyor"
  };

  return labels[position] || position;
}

function translateFoot(foot?: string) {
  const labels: Record<string, string> = {
    Left: "Sol",
    Right: "Sağ",
    Both: "Çift ayak"
  };

  return foot ? labels[foot] || foot : "-";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("tr");
}

function calculateAge(timestamp?: number, isoDate?: string) {
  const birthDate = timestamp
    ? new Date(timestamp * 1000)
    : isoDate
      ? new Date(isoDate)
      : null;

  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function calculateMonthsRemaining(timestamp?: number) {
  if (!timestamp) return null;

  const end = new Date(timestamp * 1000);
  const now = new Date();
  const months =
    (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());

  return Math.max(months, 0);
}

function contractRisk(months: number | null): PlayerProfile["contractRisk"] {
  if (months === null) return "Orta";
  if (months <= 12) return "Yüksek";
  if (months <= 24) return "Orta";
  return "Düşük";
}

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(isoDate));
}

function formatDateFromTimestamp(timestamp: number) {
  return formatDate(new Date(timestamp * 1000).toISOString());
}

function formatMarketValue(value: number | null) {
  if (!value) return "-";

  if (value >= 1_000_000) {
    return `€${new Intl.NumberFormat("tr-TR", {
      maximumFractionDigits: 1
    }).format(value / 1_000_000)}M`;
  }

  return `€${new Intl.NumberFormat("tr-TR").format(value)}`;
}

function metricFromMarketValue(value: number | null) {
  if (!value) return 12;
  return clamp(Math.round(Math.log10(value) * 14 - 45), 10, 100);
}

function futureMetric(age: number | null, marketValue: number | null) {
  const ageScore = age === null ? 48 : age <= 21 ? 92 : age <= 24 ? 84 : age <= 28 ? 66 : 42;
  const marketScore = metricFromMarketValue(marketValue);
  return clamp(Math.round(ageScore * 0.58 + marketScore * 0.42), 10, 100);
}

function contractMetric(months: number | null) {
  if (months === null) return 45;
  if (months <= 6) return 18;
  if (months <= 12) return 34;
  if (months <= 24) return 58;
  return 82;
}

function physicalMetric(height?: number, position?: string) {
  if (!height) return 45;
  const target = position === "G" ? 190 : position === "D" ? 186 : position === "F" ? 182 : 178;
  return clamp(100 - Math.abs(height - target) * 3, 18, 96);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
