// Oyuncu detay ekrani icin deterministik, gercekci istatistik uretimi.
// Canli rating (FotMob) varsa baz alinir; yoksa pozisyon + yas + piyasa degeri
// uzerinden tutarli (her render ayni) degerler turetilir.
// Tum cikti saf TypeScript'tir; node import icermez.

export type SeasonStat = {
  season: string;
  competition: string;
  appearances: number;
  goals: number;
  assists: number;
  minutes: number;
  rating: number; // 10 uzerinden
};

export type RecentMatch = {
  id: string;
  date: string;
  opponent: string;
  competition: string;
  homeAway: "H" | "A";
  score: string;
  result: "G" | "B" | "M"; // Galibiyet / Beraberlik / Maglubiyet
  rating: number; // 10 uzerinden
  minutes: number;
  goals: number;
  assists: number;
};

export type DetailedMetric = {
  label: string;
  value: number; // 0-100
  raw: string; // gercek olcu (or. "2.3 / mac")
};

export type PlayerStats = {
  seasons: SeasonStat[];
  recentMatches: RecentMatch[];
  seasonRating: number; // son sezon ortalamasi, 10 uzerinden
  detailedMetrics: DetailedMetric[];
};

export type PlayerStatsInput = {
  seed: string;
  position: "G" | "D" | "M" | "F" | string;
  age: number | null;
  baseRating?: number | null; // FotMob/SofaScore 10 uzerinden rating
  marketValue?: number | null;
  teamName?: string;
  competition?: string;
};

const SEASONS = ["2025/26", "2024/25", "2023/24", "2022/23", "2021/22"];

const OPPONENT_POOL = [
  "Real Madrid", "Barcelona", "Bayern Münih", "Manchester City", "Liverpool", "Arsenal",
  "PSG", "Inter", "Juventus", "Napoli", "Atletico Madrid", "Dortmund", "Milan", "Chelsea",
  "Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor", "Benfica", "Porto", "Ajax", "Sporting"
];

// Deterministik 0..1 uretici (seed + tuz).
function unit(seed: string, salt: string | number) {
  const value = `${seed}:${salt}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

// Baz sezon rating'i (10 uzerinden). Canli rating varsa onu kullan.
function baseSeasonRating(input: PlayerStatsInput) {
  if (input.baseRating && input.baseRating > 0) {
    return clamp(input.baseRating, 5.5, 9.2);
  }
  const ageFactor = input.age === null ? 0 : input.age >= 23 && input.age <= 30 ? 0.4 : 0;
  const valueFactor = input.marketValue ? clamp(Math.log10(input.marketValue) - 6, 0, 1.4) : 0;
  const variance = unit(input.seed, "rating") * 1.4;
  return clamp(6.2 + ageFactor + valueFactor + variance, 5.8, 9.0);
}

function goalsPerSeasonBase(position: string) {
  switch (position) {
    case "F":
      return 16;
    case "M":
      return 7;
    case "D":
      return 2;
    case "G":
      return 0;
    default:
      return 6;
  }
}

function assistsPerSeasonBase(position: string) {
  switch (position) {
    case "F":
      return 7;
    case "M":
      return 9;
    case "D":
      return 3;
    case "G":
      return 0;
    default:
      return 5;
  }
}

function buildSeasons(input: PlayerStatsInput, rating: number): SeasonStat[] {
  const competition = input.competition || "Lig";
  const goalBase = goalsPerSeasonBase(input.position);
  const assistBase = assistsPerSeasonBase(input.position);

  return SEASONS.map((season, index) => {
    const decline = index * 0.12; // gecmis sezonlarda hafif dusus
    const apps = Math.round(20 + unit(input.seed, `apps-${index}`) * 18);
    const minutes = Math.round(apps * (60 + unit(input.seed, `min-${index}`) * 30));
    const goals = Math.max(0, Math.round(goalBase * (0.6 + unit(input.seed, `g-${index}`) * 0.8) - index));
    const assists = Math.max(0, Math.round(assistBase * (0.6 + unit(input.seed, `a-${index}`) * 0.8) - index));
    const seasonRating = clamp(round1(rating - decline + (unit(input.seed, `sr-${index}`) - 0.5) * 0.4), 5.5, 9.3);

    return {
      season,
      competition,
      appearances: apps,
      goals,
      assists,
      minutes,
      rating: seasonRating
    };
  });
}

function buildRecentMatches(input: PlayerStatsInput, rating: number): RecentMatch[] {
  const competition = input.competition || "Lig";
  const count = 6;

  return Array.from({ length: count }, (_, index) => {
    const oppIndex = Math.floor(unit(input.seed, `opp-${index}`) * OPPONENT_POOL.length);
    const opponent = OPPONENT_POOL[oppIndex] === input.teamName
      ? OPPONENT_POOL[(oppIndex + 1) % OPPONENT_POOL.length]
      : OPPONENT_POOL[oppIndex];
    const homeAway: "H" | "A" = unit(input.seed, `ha-${index}`) > 0.5 ? "H" : "A";
    const gf = Math.round(unit(input.seed, `gf-${index}`) * 3);
    const ga = Math.round(unit(input.seed, `ga-${index}`) * 3);
    const result: RecentMatch["result"] = gf > ga ? "G" : gf < ga ? "M" : "B";
    const matchRating = clamp(round1(rating + (unit(input.seed, `mr-${index}`) - 0.45) * 1.8), 5.0, 9.6);
    const minutes = unit(input.seed, `mm-${index}`) > 0.2 ? 90 : Math.round(45 + unit(input.seed, `mm2-${index}`) * 40);
    const goals = input.position === "F" || input.position === "M"
      ? Math.round(unit(input.seed, `mg-${index}`) * (input.position === "F" ? 1.6 : 0.8))
      : Math.round(unit(input.seed, `mg-${index}`) * 0.3);
    const assists = Math.round(unit(input.seed, `ma-${index}`) * 0.7);

    const day = 2 + index * 5;
    const date = `${String(day).padStart(2, "0")}.${String(((index % 6) + 3)).padStart(2, "0")}.2026`;

    return {
      id: `${input.seed}-m${index}`,
      date,
      opponent,
      competition,
      homeAway,
      score: homeAway === "H" ? `${gf} - ${ga}` : `${ga} - ${gf}`,
      result,
      rating: matchRating,
      minutes,
      goals,
      assists
    };
  });
}

// Pozisyona gore gercek ciddi detayli metrikler (0-100 + ham olcu).
function buildDetailedMetrics(input: PlayerStatsInput, rating: number): DetailedMetric[] {
  const q = clamp((rating - 5.5) / 3.5, 0, 1); // 0..1 kalite
  const v = (salt: string, min: number, max: number) => {
    const base = min + (max - min) * (q * 0.6 + unit(input.seed, salt) * 0.4);
    return clamp(Math.round(base), 0, 100);
  };
  const num = (salt: string, min: number, max: number, digits = 1) => {
    const val = min + (max - min) * (q * 0.6 + unit(input.seed, salt) * 0.4);
    return round1Digits(val, digits);
  };

  if (input.position === "G") {
    return [
      { label: "Kurtarış %", value: v("save", 60, 84), raw: `%${v("save", 60, 84)}` },
      { label: "Mağlup olunmayan maç", value: v("clean", 25, 70), raw: `${Math.round(num("cleanc", 6, 18, 0))} maç` },
      { label: "Penaltı kurtarma", value: v("pen", 10, 45), raw: `%${v("pen", 10, 45)}` },
      { label: "Hava topu hakimiyeti", value: v("aerg", 45, 85), raw: `${num("aer", 1.2, 3.4)} / maç` },
      { label: "Ayakla oyun kurma", value: v("dist", 50, 88), raw: `%${v("distp", 70, 92)} isabet` },
      { label: "Çıkış / müdahale", value: v("sweep", 40, 80), raw: `${num("sw", 0.8, 2.6)} / maç` }
    ];
  }

  if (input.position === "D") {
    return [
      { label: "Top kapma", value: v("tkl", 55, 88), raw: `${num("tklr", 1.8, 3.6)} / maç` },
      { label: "Müdahale (interception)", value: v("int", 50, 86), raw: `${num("intr", 1.4, 3.2)} / maç` },
      { label: "Hava topu kazanma %", value: v("aer", 55, 90), raw: `%${v("aerw", 60, 88)}` },
      { label: "Pas isabeti", value: v("pass", 60, 92), raw: `%${v("passp", 82, 94)}` },
      { label: "Bloklanan şut", value: v("blk", 40, 80), raw: `${num("blkr", 0.5, 1.8)} / maç` },
      { label: "İkili mücadele kazanma", value: v("duel", 55, 88), raw: `%${v("duelp", 58, 78)}` }
    ];
  }

  if (input.position === "M") {
    return [
      { label: "Pas isabeti", value: v("pass", 70, 94), raw: `%${v("passp", 84, 95)}` },
      { label: "Şans yaratma", value: v("chance", 45, 88), raw: `${num("chancer", 1.2, 3.0)} / maç` },
      { label: "Top kapma", value: v("tkl", 45, 82), raw: `${num("tklr", 1.4, 2.8)} / maç` },
      { label: "İlerletici pas", value: v("prog", 50, 90), raw: `${Math.round(num("progr", 4, 9, 0))} / maç` },
      { label: "Dribling başarısı", value: v("drb", 40, 85), raw: `%${v("drbp", 50, 74)}` },
      { label: "Top kaybı (düşük=iyi)", value: v("loss", 40, 80), raw: `${num("lossr", 0.8, 2.2)} / maç` }
    ];
  }

  // Forvet
  return [
    { label: "Gol katkısı", value: v("ga", 55, 92), raw: `${num("gar", 0.5, 1.1)} / maç` },
    { label: "İsabetli şut %", value: v("sot", 45, 80), raw: `%${v("sotp", 38, 58)}` },
    { label: "xG performansı", value: v("xg", 50, 90), raw: `${num("xgr", 0.4, 0.9)} xG/maç` },
    { label: "Dribling başarısı", value: v("drb", 45, 88), raw: `%${v("drbp", 52, 76)}` },
    { label: "Ceza sahası dokunuşu", value: v("box", 50, 90), raw: `${num("boxr", 4, 9)} / maç` },
    { label: "Pres / geri kazanım", value: v("press", 35, 78), raw: `${num("pressr", 2.0, 4.5)} / maç` }
  ];
}

function round1Digits(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildPlayerStats(input: PlayerStatsInput): PlayerStats {
  const rating = baseSeasonRating(input);
  const seasons = buildSeasons(input, rating);
  const recentMatches = buildRecentMatches(input, rating);
  const seasonRating = seasons[0]?.rating ?? round1(rating);
  const detailedMetrics = buildDetailedMetrics(input, rating);

  return {
    seasons,
    recentMatches,
    seasonRating,
    detailedMetrics
  };
}
