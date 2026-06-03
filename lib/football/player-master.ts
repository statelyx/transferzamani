import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PlayerProfile } from "@/lib/sofasport";

export type MasterPlayer = {
  masterId: string;
  name: string;
  normalizedName: string;
  continent: string;
  countrySlug: string;
  countryName: string;
  countryCode: string;
  position: "G" | "D" | "M" | "F";
  heightCm: number | null;
  dateOfBirth: string | null;
  birthPlace: string | null;
  sourceFile: string;
};

let memoryIndex: MasterPlayer[] | null = null;

export async function loadPlayersMasterIndex() {
  if (memoryIndex) return memoryIndex;

  const root = path.join(process.cwd(), "players-master", "players-master");
  const files = await findPlayerFiles(root);
  const players: MasterPlayer[] = [];

  for (const file of files) {
    const relative = path.relative(root, file);
    const [continent, countrySlug] = relative.split(path.sep);
    const countryCode = path.basename(file).split(".")[0].toUpperCase();
    const text = await readFile(file, "utf8");
    const countryName = readCountryName(text) || titleCase(countrySlug);

    for (const line of text.split(/\r?\n/)) {
      const parsed = parsePlayerLine(line);
      if (!parsed) continue;

      const seed = `${countryCode}:${parsed.name}:${parsed.dateOfBirth || ""}:${parsed.birthPlace || ""}`;
      players.push({
        masterId: stableId(seed),
        name: parsed.name,
        normalizedName: normalize(parsed.name),
        continent,
        countrySlug,
        countryName,
        countryCode,
        position: parsed.position,
        heightCm: parsed.heightCm,
        dateOfBirth: parsed.dateOfBirth,
        birthPlace: parsed.birthPlace,
        sourceFile: relative.replaceAll("\\", "/")
      });
    }
  }

  memoryIndex = players;
  return players;
}

export async function searchPlayersMaster(query: string, limit = 30, position?: string) {
  const normalized = normalize(query);
  if (normalized.length < 2) return [];

  const players = await loadPlayersMasterIndex();
  return players
    .filter((player) => {
      if (position && position !== "ALL" && player.position !== position) return false;
      return player.normalizedName.includes(normalized);
    })
    .sort((a, b) => {
      const aStarts = a.normalizedName.startsWith(normalized) ? 1 : 0;
      const bStarts = b.normalizedName.startsWith(normalized) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      const ageOrder = (birthYear(b.dateOfBirth) || 0) - (birthYear(a.dateOfBirth) || 0);
      if (ageOrder) return ageOrder;

      return a.name.localeCompare(b.name, "tr");
    })
    .slice(0, limit);
}

export function masterPlayerToProfile(player: MasterPlayer): PlayerProfile {
  const numericId = numericMasterId(player.masterId);
  const age = player.dateOfBirth ? calculateAge(player.dateOfBirth) : null;

  return {
    id: numericId,
    name: player.name,
    shortName: shortName(player.name),
    slug: player.masterId,
    initials: initials(player.name),
    position: player.position,
    positionLabel: positionLabel(player.position),
    detailedPosition: positionLabel(player.position),
    squadRole: "bench",
    squadRoleLabel: "Master Index",
    jerseyNumber: "-",
    height: player.heightCm,
    age,
    dateOfBirth: player.dateOfBirth,
    preferredFoot: "Bilinmiyor",
    country: player.countryName,
    countryCode: player.countryCode,
    userCount: 0,
    marketValue: null,
    marketValueLabel: "API bekliyor",
    contractUntil: null,
    contractMonthsRemaining: null,
    contractRisk: "Orta",
    imageUrl: `/api/image/player/${numericId}`,
    team: {
      id: 0,
      name: "Takim API ile eslestirilecek",
      tournament: "Oyuncu Master Index"
    },
    metrics: {
      market: 0,
      attention: 0,
      future: age ? Math.max(35, Math.min(88, 90 - Math.max(age - 18, 0) * 3)) : 50,
      contract: 0,
      physical: player.heightCm ? Math.max(35, Math.min(85, player.heightCm - 120)) : 50
    },
    attributes: buildAttributes(player.position)
  };
}

function parsePlayerLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("=") || trimmed.startsWith("#")) return null;

  const match = trimmed.match(/^(.+?),\s*([GDMF])(?:\/[A-Z]+)?\s*,\s*([^,]+),\s*b\.\s*(.+)$/);
  if (!match) return null;

  const [, name, position, heightRaw, birthRaw] = match;
  const [dateRaw, placeRaw] = birthRaw.split("@").map((value) => value.trim());

  return {
    name: name.trim(),
    position: position as MasterPlayer["position"],
    heightCm: parseHeight(heightRaw),
    dateOfBirth: parseDate(dateRaw),
    birthPlace: placeRaw || null
  };
}

async function findPlayerFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return findPlayerFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith(".players.txt")) return [fullPath];
      return [];
    })
  );

  return files.flat();
}

function readCountryName(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("= ") && !line.startsWith("=="))
    ?.replace(/^=\s*/, "")
    .trim();
}

function parseHeight(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*m/i);
  if (!match) return null;
  return Math.round(Number(match[1]) * 100);
}

function parseDate(value: string) {
  const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12"
  };
  const [, day, month, year] = match;
  const monthNumber = months[month];
  if (!monthNumber) return null;
  return `${year}-${monthNumber}-${day.padStart(2, "0")}`;
}

function stableId(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function numericMasterId(masterId: string) {
  return -Number.parseInt(masterId.slice(0, 7), 16);
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function birthYear(value: string | null) {
  return value ? Number(value.slice(0, 4)) : null;
}

function calculateAge(date: string) {
  const birth = new Date(date);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
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

function positionLabel(position: string) {
  return { G: "Kaleci", D: "Defans", M: "Orta saha", F: "Forvet" }[position] || "Oyuncu";
}

function buildAttributes(position: string) {
  if (position === "G") return { attack: 12, defense: 74, passing: 45, physical: 58, form: 50 };
  if (position === "D") return { attack: 34, defense: 72, passing: 54, physical: 65, form: 50 };
  if (position === "M") return { attack: 58, defense: 56, passing: 72, physical: 58, form: 50 };
  return { attack: 74, defense: 28, passing: 55, physical: 62, form: 50 };
}
