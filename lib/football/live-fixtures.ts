import { freeLiveFootballGet } from "@/lib/providers/free-live-football";

export type LiveFixture = {
  id: string;
  league: string;
  status: string;
  minute: string | null;
  startTime: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string | number | null;
  awayScore: string | number | null;
  homeLogo: string | null;
  awayLogo: string | null;
};

export async function getLiveFixtures() {
  const today = new Date().toISOString().slice(0, 10);
  const [live, todayMatches] = await Promise.allSettled([
    freeLiveFootballGet<unknown>("current-live", {}, { force: true }),
    freeLiveFootballGet<unknown>("matches-by-date", { date: today })
  ]);

  const fixtures = [
    ...extractFixtures(live.status === "fulfilled" ? live.value.data : null),
    ...extractFixtures(todayMatches.status === "fulfilled" ? todayMatches.value.data : null)
  ];

  return dedupeFixtures(fixtures)
    .sort((a, b) => statusWeight(a.status) - statusWeight(b.status) || a.startTime.localeCompare(b.startTime))
    .slice(0, 80);
}

function extractFixtures(payload: unknown): LiveFixture[] {
  const items = collectMatchObjects(payload);
  return items.map(normalizeFixture).filter(Boolean) as LiveFixture[];
}

function collectMatchObjects(value: unknown, depth = 0): Record<string, any>[] {
  if (!value || depth > 5) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectMatchObjects(item, depth + 1));
  if (typeof value !== "object") return [];

  const obj = value as Record<string, any>;
  if (looksLikeMatch(obj)) return [obj];

  return Object.values(obj).flatMap((item) => collectMatchObjects(item, depth + 1));
}

function looksLikeMatch(obj: Record<string, any>) {
  return Boolean(
    obj.homeTeam ||
      obj.home_team ||
      obj.home ||
      obj.homeName ||
      obj.home_name ||
      obj.team_home ||
      obj.awayTeam ||
      obj.away_team ||
      obj.away ||
      obj.awayName ||
      obj.away_name ||
      obj.team_away
  );
}

function normalizeFixture(raw: Record<string, any>): LiveFixture | null {
  const home = teamName(raw.homeTeam ?? raw.home_team ?? raw.home ?? raw.homeName ?? raw.home_name ?? raw.team_home);
  const away = teamName(raw.awayTeam ?? raw.away_team ?? raw.away ?? raw.awayName ?? raw.away_name ?? raw.team_away);
  if (!home || !away) return null;

  const id = String(raw.id ?? raw.matchId ?? raw.match_id ?? raw.eventId ?? `${home}:${away}:${raw.date ?? raw.time ?? ""}`);
  const status = String(raw.status?.description ?? raw.status?.type ?? raw.status ?? raw.matchStatus ?? raw.state ?? "Planlandi");
  const startTime = formatFixtureTime(raw.startTime ?? raw.start_time ?? raw.dateTime ?? raw.datetime ?? raw.date ?? raw.time);

  return {
    id,
    league: String(raw.league?.name ?? raw.leagueName ?? raw.league_name ?? raw.tournament?.name ?? raw.competition ?? "Futbol"),
    status,
    minute: raw.minute || raw.currentMinute || raw.matchTime || raw.elapsed ? String(raw.minute || raw.currentMinute || raw.matchTime || raw.elapsed) : null,
    startTime,
    homeTeam: home,
    awayTeam: away,
    homeScore: score(raw.homeScore ?? raw.home_score ?? raw.score?.home ?? raw.homeGoals ?? raw.goalsHome),
    awayScore: score(raw.awayScore ?? raw.away_score ?? raw.score?.away ?? raw.awayGoals ?? raw.goalsAway),
    homeLogo: logo(raw.homeTeam ?? raw.home_team ?? raw.home),
    awayLogo: logo(raw.awayTeam ?? raw.away_team ?? raw.away)
  };
}

function teamName(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value.name ?? value.shortName ?? value.short_name ?? value.teamName ?? value.title ?? "");
}

function logo(value: any) {
  if (!value || typeof value === "string") return null;
  const raw = value.logo ?? value.image ?? value.imageUrl ?? value.logoUrl ?? value.crest;
  return typeof raw === "string" && raw.startsWith("http") ? raw : null;
}

function score(value: any) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return value.display ?? value.current ?? value.value ?? null;
  return value;
}

function formatFixtureTime(value: any) {
  if (!value) return "-";
  if (typeof value === "number") {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    return Number.isNaN(date.getTime()) ? "-" : formatTime(date);
  }
  const raw = String(value);
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return formatTime(date);
  const time = raw.match(/\b\d{1,2}:\d{2}\b/)?.[0];
  return time || raw.slice(0, 16);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function dedupeFixtures(fixtures: LiveFixture[]) {
  const map = new Map<string, LiveFixture>();
  for (const fixture of fixtures) {
    const key = `${fixture.homeTeam}:${fixture.awayTeam}:${fixture.startTime}`;
    const existing = map.get(key);
    if (!existing || statusWeight(fixture.status) < statusWeight(existing.status)) map.set(key, fixture);
  }
  return Array.from(map.values());
}

function statusWeight(status: string) {
  const normalized = status.toLocaleLowerCase("tr");
  if (/live|inprogress|1st|2nd|devre|canli|playing/.test(normalized)) return 0;
  if (/notstarted|scheduled|plan|fixture/.test(normalized)) return 1;
  return 2;
}
