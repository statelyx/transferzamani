import type { SofaScoreEndpoint } from "./endpoints";

export type SofaScoreParams = Record<string, string | number | boolean | null | undefined>;

export type CacheSource = "memory" | "file" | "network";

export type SofaScoreMeta = {
  endpoint: SofaScoreEndpoint;
  url: string;
  cache: CacheSource;
  cachedAt: string;
  ttl: number;
};

export type SofaScoreResult<T> = {
  data: T;
  meta: SofaScoreMeta;
};

export type SofaScoreTeam = {
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

export type SofaScorePlayer = {
  id: number;
  name: string;
  shortName?: string;
  slug?: string;
  team?: SofaScoreTeam;
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
  contractUntilTimestamp?: number;
  proposedMarketValue?: number;
  proposedMarketValueRaw?: {
    value?: number;
    currency?: string;
  };
};

export type SofaScoreSquadResponse = {
  players?: Array<{ player: SofaScorePlayer }>;
  foreignPlayers?: Array<{ player: SofaScorePlayer }>;
  nationalPlayers?: Array<{ player: SofaScorePlayer }>;
};

export type SofaScoreEvent = {
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
  homeTeam?: SofaScoreTeam;
  awayTeam?: SofaScoreTeam;
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

export type SofaScoreNearEventsResponse = {
  previousEvent?: SofaScoreEvent | null;
  nextEvent?: SofaScoreEvent | null;
};

export type SofaScoreLineupPlayer = {
  player: SofaScorePlayer;
  teamId?: number;
  shirtNumber?: number;
  jerseyNumber?: string;
  position?: string;
  substitute?: boolean;
};

export type SofaScoreLineupsResponse = {
  confirmed?: boolean;
  home?: {
    players?: SofaScoreLineupPlayer[];
  };
  away?: {
    players?: SofaScoreLineupPlayer[];
  };
};
