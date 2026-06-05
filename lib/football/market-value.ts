// Ortak piyasa degeri ve coklu para birimi yardimcilari.
// Hem server (player-master) hem client (UI) tarafindan kullanildigi icin
// node'a ozel import icermez, saf TypeScript'tir.

export type MultiCurrencyValue = {
  eur: string;
  usd: string;
  try: string;
};

// Yaklasik kur sabitleri (EUR baz). UI gosterimi icindir, finansal islem degildir.
const EUR_TO_USD = 1.08;
const EUR_TO_TRY = 38;

export type MarketValueInput = {
  seed: string;
  position: "G" | "D" | "M" | "F" | string;
  age: number | null;
  heightCm?: number | null;
  countryCode?: string | null;
};

// Ulke futbol gucu kademesi -> piyasa degeri carpani.
const TIER_ONE = new Set([
  "BR", "AR", "FR", "ES", "DE", "EN", "GB", "PT", "NL", "IT", "BE", "HR", "UY", "CO"
]);
const TIER_TWO = new Set([
  "TR", "RS", "DK", "CH", "AT", "SE", "NO", "PL", "MX", "US", "JP", "KR", "MA", "SN", "CI", "GH", "NG", "EC", "CL"
]);

function tierMultiplier(countryCode?: string | null) {
  const code = (countryCode || "").toUpperCase();
  if (TIER_ONE.has(code)) return 1.35;
  if (TIER_TWO.has(code)) return 1.1;
  return 0.85;
}

function positionBase(position: string) {
  // Forvet ve ofansif orta saha piyasada daha yuksek deger gorur.
  switch (position) {
    case "F":
      return 14_000_000;
    case "M":
      return 11_000_000;
    case "D":
      return 8_500_000;
    case "G":
      return 6_000_000;
    default:
      return 7_000_000;
  }
}

// Yas egrisi: 23-26 zirve, genc oyuncularda potansiyel primi, 30+ dususu.
function ageCurve(age: number | null) {
  if (age === null) return 0.7;
  if (age <= 18) return 0.85;
  if (age <= 21) return 1.15;
  if (age <= 24) return 1.3;
  if (age <= 27) return 1.2;
  if (age <= 30) return 0.85;
  if (age <= 33) return 0.55;
  return 0.3;
}

function stableUnit(seed: string) {
  // 0..1 araliginda deterministik varyans uretir.
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

// Master/free veri icin gercekci, deterministik tahmini piyasa degeri (EUR).
export function estimateMarketValue(input: MarketValueInput): number {
  const base = positionBase(input.position);
  const tier = tierMultiplier(input.countryCode);
  const curve = ageCurve(input.age);
  const variance = 0.6 + stableUnit(input.seed) * 0.8; // 0.6x - 1.4x

  const raw = base * tier * curve * variance;
  // 50binlik adimlara yuvarla.
  const rounded = Math.max(50_000, Math.round(raw / 50_000) * 50_000);
  return rounded;
}

export function formatEur(value: number | null): string {
  if (!value) return "Belirsiz";
  if (value >= 1_000_000) {
    return `€${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value / 1_000_000)}M`;
  }
  return `€${new Intl.NumberFormat("tr-TR").format(value)}`;
}

function formatCurrency(value: number, symbol: string, suffix = ""): string {
  if (value >= 1_000_000) {
    return `${symbol}${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value / 1_000_000)}M${suffix}`;
  }
  if (value >= 1_000) {
    return `${symbol}${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value / 1_000)}K${suffix}`;
  }
  return `${symbol}${new Intl.NumberFormat("tr-TR").format(value)}${suffix}`;
}

// EUR degeri -> TL / USD / EUR gosterim etiketleri.
export function formatMarketValueAll(eurValue: number | null): MultiCurrencyValue {
  if (!eurValue) {
    return { eur: "Belirsiz", usd: "Belirsiz", try: "Belirsiz" };
  }

  return {
    eur: formatEur(eurValue),
    usd: formatCurrency(eurValue * EUR_TO_USD, "$"),
    try: formatCurrency(eurValue * EUR_TO_TRY, "₺")
  };
}
