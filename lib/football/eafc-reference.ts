export type SlotRole = "G" | "D" | "M" | "F";

export type TacticalSlot = {
  id: string;
  label: string;
  role: SlotRole;
  top: number;
  left: number;
};

export const POSITION_LABELS: Record<string, string> = {
  GK: "Kaleci",
  CB: "Stoper",
  LCB: "Sol stoper",
  RCB: "Sag stoper",
  LB: "Sol bek",
  RB: "Sag bek",
  LWB: "Sol kanat bek",
  RWB: "Sag kanat bek",
  CDM: "On libero",
  LDM: "Sol on libero",
  RDM: "Sag on libero",
  CM: "Merkez orta saha",
  LCM: "Sol merkez",
  RCM: "Sag merkez",
  LM: "Sol orta",
  RM: "Sag orta",
  CAM: "Ofansif orta saha",
  LAM: "Sol ofansif orta saha",
  RAM: "Sag ofansif orta saha",
  LW: "Sol kanat",
  RW: "Sag kanat",
  ST: "Santrfor",
  CF: "Ikinci forvet",
  LF: "Sol forvet",
  RF: "Sag forvet"
};

export const PLAYER_ROLE_PRESETS: Record<string, string[]> = {
  ST: ["Advanced Forward", "Poacher", "Target Man", "False 9", "Complete Forward"],
  CAM: ["Advanced Playmaker", "Shadow Striker", "Trequartista", "Enganche"],
  CM: ["Box to Box", "Deep Lying Playmaker", "Ball Winning Midfielder", "Advanced Playmaker", "Mezzala"],
  CDM: ["Holding", "Ball Winning Midfielder", "Anchor", "Regista"],
  WB: ["Wing Back Attack", "Wing Back Defend", "Inverted Wing Back"],
  FB: ["Full Back Attack", "Full Back Defend", "Inverted Full Back"],
  CB: ["Ball Playing Defender", "No Nonsense Centreback", "Stopper", "Cover"],
  W: ["Winger", "Inverted Winger", "Inside Forward"],
  GK: ["Sweeper Keeper", "Goalkeeper"]
};

export const EAFC_FORMATIONS = [
  { name: "3-1-4-2", positions: ["GK", "CB", "CB", "CB", "CDM", "RM", "RCM", "LCM", "LM", "ST", "ST"] },
  { name: "3-4-1-2", positions: ["GK", "CB", "CB", "CB", "RM", "RCM", "LCM", "LM", "CAM", "ST", "ST"] },
  { name: "3-4-2-1", positions: ["GK", "CB", "CB", "CB", "RM", "RCM", "LCM", "LM", "RAM", "LAM", "ST"] },
  { name: "3-5-2", positions: ["GK", "CB", "CB", "CB", "RWB", "RCM", "CM", "LCM", "LWB", "ST", "ST"] },
  { name: "3-4-3", positions: ["GK", "CB", "CB", "CB", "RM", "RCM", "LCM", "LM", "RW", "ST", "LW"] },
  { name: "4-1-2-1-2", positions: ["GK", "RB", "CB", "CB", "LB", "CDM", "RCM", "LCM", "CAM", "ST", "ST"] },
  { name: "4-1-3-2", positions: ["GK", "RB", "CB", "CB", "LB", "CDM", "RCM", "CM", "LCM", "ST", "ST"] },
  { name: "4-1-4-1", positions: ["GK", "RB", "CB", "CB", "LB", "CDM", "RM", "RCM", "LCM", "LM", "ST"] },
  { name: "4-2-1-3", positions: ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "CAM", "RW", "ST", "LW"] },
  { name: "4-2-2-2", positions: ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "RAM", "LAM", "ST", "ST"] },
  { name: "4-2-3-1", positions: ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "RM", "CAM", "LM", "ST"] },
  { name: "4-3-1-2", positions: ["GK", "RB", "CB", "CB", "LB", "RCM", "CM", "LCM", "CAM", "ST", "ST"] },
  { name: "4-3-2-1", positions: ["GK", "RB", "CB", "CB", "LB", "RCM", "CM", "LCM", "RAM", "LAM", "ST"] },
  { name: "4-3-3", positions: ["GK", "RB", "CB", "CB", "LB", "RCM", "CM", "LCM", "RW", "ST", "LW"] },
  { name: "4-4-1-1", positions: ["GK", "RB", "CB", "CB", "LB", "RM", "RCM", "LCM", "LM", "CAM", "ST"] },
  { name: "4-4-2", positions: ["GK", "RB", "CB", "CB", "LB", "RM", "RCM", "LCM", "LM", "ST", "ST"] },
  { name: "4-5-1", positions: ["GK", "RB", "CB", "CB", "LB", "RM", "RCM", "CM", "LCM", "LM", "ST"] },
  { name: "5-2-1-2", positions: ["GK", "RWB", "CB", "CB", "CB", "LWB", "CDM", "CDM", "CAM", "ST", "ST"] },
  { name: "5-2-2-1", positions: ["GK", "RWB", "CB", "CB", "CB", "LWB", "CDM", "CDM", "RAM", "LAM", "ST"] },
  { name: "5-2-3", positions: ["GK", "RWB", "CB", "CB", "CB", "LWB", "CDM", "CDM", "RW", "ST", "LW"] },
  { name: "5-3-2", positions: ["GK", "RWB", "CB", "CB", "CB", "LWB", "RCM", "CM", "LCM", "ST", "ST"] },
  { name: "5-4-1", positions: ["GK", "RWB", "CB", "CB", "CB", "LWB", "RM", "RCM", "LCM", "LM", "ST"] }
] as const;

export function buildFormationSlots(name: string): TacticalSlot[] {
  const formation = EAFC_FORMATIONS.find((item) => item.name === name) || EAFC_FORMATIONS.find((item) => item.name === "4-3-3") || EAFC_FORMATIONS[0];
  const rows = groupPositionsByLine([...formation.positions]);
  const seen = new Map<string, number>();

  return rows.flatMap((row) => {
    const xs = spreadX(row.positions.length);
    return row.positions.map((position, index) => {
      const count = (seen.get(position) || 0) + 1;
      seen.set(position, count);

      return {
        id: `${position.toLocaleLowerCase("tr")}${count > 1 ? count : ""}`,
        label: position,
        role: positionToRole(position),
        top: row.top,
        left: xs[index]
      };
    });
  });
}

export function positionToRole(position: string): SlotRole {
  if (position === "GK") return "G";
  if (["CB", "LCB", "RCB", "LB", "RB", "LWB", "RWB"].includes(position)) return "D";
  if (["ST", "CF", "LF", "RF", "LW", "RW"].includes(position)) return "F";
  return "M";
}

export function tacticalRoleKey(position: string) {
  if (position === "GK") return "GK";
  if (["CB", "LCB", "RCB"].includes(position)) return "CB";
  if (["LB", "RB"].includes(position)) return "FB";
  if (["LWB", "RWB"].includes(position)) return "WB";
  if (["LW", "RW", "LM", "RM"].includes(position)) return "W";
  if (["CDM", "LDM", "RDM"].includes(position)) return "CDM";
  if (["CAM", "LAM", "RAM"].includes(position)) return "CAM";
  if (["ST", "CF", "LF", "RF"].includes(position)) return "ST";
  return "CM";
}

function groupPositionsByLine(positions: string[]) {
  const lines = [
    { top: 87, positions: positions.filter((position) => position === "GK") },
    { top: 68, positions: positions.filter((position) => ["RB", "CB", "LCB", "RCB", "LB", "RWB", "LWB"].includes(position)) },
    { top: 53, positions: positions.filter((position) => ["CDM", "LDM", "RDM"].includes(position)) },
    { top: 41, positions: positions.filter((position) => ["RM", "RCM", "CM", "LCM", "LM"].includes(position)) },
    { top: 27, positions: positions.filter((position) => ["RW", "RAM", "CAM", "LAM", "LW", "CF", "LF", "RF"].includes(position)) },
    { top: 14, positions: positions.filter((position) => position === "ST") }
  ];

  return lines.filter((line) => line.positions.length > 0);
}

function spreadX(count: number) {
  if (count === 1) return [50];
  const start = 82;
  const end = 18;
  const step = (start - end) / (count - 1);
  return Array.from({ length: count }, (_, index) => Math.round((start - step * index) * 10) / 10);
}
