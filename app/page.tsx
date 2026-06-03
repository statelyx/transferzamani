"use client";

import type { GalatasarayPayload, PlayerProfile, Rumor, TeamEvent } from "@/lib/sofasport";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Heart,
  Home as HomeIcon,
  Newspaper,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Search,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ViewKey = "home" | "profile" | "lineup" | "scout";

const positions = [
  { key: "ALL", label: "TUMU" },
  { key: "G", label: "GK" },
  { key: "D", label: "DEF" },
  { key: "M", label: "MID" },
  { key: "F", label: "FWD" }
];

const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "home", label: "Ana Sayfa", icon: <HomeIcon size={18} /> },
  { key: "profile", label: "Futbolcular", icon: <UserRound size={18} /> },
  { key: "lineup", label: "Hayalimdeki Ilk 11", icon: <Shield size={18} /> },
  { key: "scout", label: "Scout Merkezi", icon: <Target size={18} /> }
];

const lineupSlots = [
  { id: "lw", label: "LW", role: "F" },
  { id: "st", label: "ST", role: "F" },
  { id: "rw", label: "RW", role: "F" },
  { id: "cm1", label: "LCM", role: "M" },
  { id: "cm2", label: "CM", role: "M" },
  { id: "cm3", label: "RCM", role: "M" },
  { id: "lb", label: "LB", role: "D" },
  { id: "cb1", label: "LCB", role: "D" },
  { id: "cb2", label: "RCB", role: "D" },
  { id: "rb", label: "RB", role: "D" },
  { id: "gk", label: "GK", role: "G" }
] as const;

export default function Home() {
  const [data, setData] = useState<GalatasarayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewKey>("home");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [budget, setBudget] = useState(250_000_000);
  const [lineup, setLineup] = useState<Record<string, number | null>>({});

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/galatasaray");
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error || "Veri alinamadi.");

      setData(payload);
      setSelectedId((current) => current || payload.players[0]?.id || null);
      setCompareA((current) => current || payload.players[0]?.id || null);
      setCompareB((current) => current || payload.players[1]?.id || null);
      setLineup((current) => seedLineup(current, payload.players));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Bilinmeyen hata.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const players = data?.players || [];
  const selectedPlayer = players.find((player) => player.id === selectedId) || players[0] || null;
  const comparePlayerA = players.find((player) => player.id === compareA) || null;
  const comparePlayerB = players.find((player) => player.id === compareB) || null;

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = normalize(query);

    return [...players]
      .filter((player) => {
        const matchesQuery =
          !normalizedQuery ||
          normalize(player.name).includes(normalizedQuery) ||
          normalize(player.country).includes(normalizedQuery) ||
          normalize(player.team.name).includes(normalizedQuery) ||
          String(player.jerseyNumber).includes(normalizedQuery);
        const matchesPosition = position === "ALL" || player.position === position;

        return matchesQuery && matchesPosition;
      })
      .sort(sortRosterPlayers);
  }, [players, query, position]);

  const lineupPlayers = useMemo(
    () =>
      Object.values(lineup)
        .map((id) => players.find((player) => player.id === id))
        .filter(Boolean) as PlayerProfile[],
    [lineup, players]
  );

  const squadValue = lineupPlayers.reduce((sum, player) => sum + (player.marketValue || 0), 0);
  const avgAge = lineupPlayers.length
    ? lineupPlayers.reduce((sum, player) => sum + (player.age || 0), 0) / lineupPlayers.length
    : 0;
  const avgRating = lineupPlayers.length
    ? lineupPlayers.reduce((sum, player) => sum + player.metrics.future, 0) / lineupPlayers.length
    : 0;
  const budgetDelta = budget - squadValue;

  return (
    <div className="stat11-shell">
      <SideNav view={view} setView={setView} />
      <main className="stat11-main">
        <TopNav
          query={query}
          setQuery={setQuery}
          loading={loading}
          data={data}
          onRefresh={loadData}
        />

        {error ? <ErrorState message={error} onRetry={loadData} /> : null}
        {data && data.status.mode !== "live" ? <DataNotice status={data.status} /> : null}

        {view === "home" ? (
          <HomeDashboard
            data={data}
            players={players}
            filteredPlayers={filteredPlayers}
            loading={loading}
            selectedPlayer={selectedPlayer}
            rumors={data?.rumors || []}
            setView={setView}
            onSelectPlayer={(id) => {
              setSelectedId(id);
              setView("profile");
            }}
          />
        ) : null}

        {view === "profile" ? (
          <ProfileWorkspace
            players={filteredPlayers}
            allPlayers={players}
            selectedPlayer={selectedPlayer}
            position={position}
            setPosition={setPosition}
            setSelectedId={setSelectedId}
            comparePlayerA={comparePlayerA}
            comparePlayerB={comparePlayerB}
            compareA={compareA}
            compareB={compareB}
            setCompareA={setCompareA}
            setCompareB={setCompareB}
            rumors={data?.rumors || []}
            loading={loading}
          />
        ) : null}

        {view === "lineup" ? (
          <LineupBuilder
            players={players}
            lineup={lineup}
            setLineup={setLineup}
            budget={budget}
            setBudget={setBudget}
            squadValue={squadValue}
            budgetDelta={budgetDelta}
            avgAge={avgAge}
            avgRating={avgRating}
          />
        ) : null}

        {view === "scout" ? (
          <ScoutCenter
            players={filteredPlayers}
            allPlayers={players}
            position={position}
            setPosition={setPosition}
            setSelectedId={setSelectedId}
            setView={setView}
          />
        ) : null}
      </main>
      <MobileNav view={view} setView={setView} />
    </div>
  );
}

function SideNav({ view, setView }: { view: ViewKey; setView: (view: ViewKey) => void }) {
  return (
    <aside className="side-nav">
      <div className="brand-lockup">
        <div className="brand-icon">
          S11
        </div>
        <div>
          <strong>STAT11</strong>
          <span>PRO ANALYTICS</span>
        </div>
      </div>
      <nav>
        {navItems.map((item) => (
          <button className={view === item.key ? "active" : ""} key={item.key} type="button" onClick={() => setView(item.key)}>
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="side-footer">
        <button type="button">
          <Settings size={18} />
          <span>Ayarlar</span>
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ view, setView }: { view: ViewKey; setView: (view: ViewKey) => void }) {
  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        <button className={view === item.key ? "active" : ""} key={item.key} type="button" onClick={() => setView(item.key)}>
          {item.icon}
          <span>{item.label.split(" ")[0]}</span>
        </button>
      ))}
    </nav>
  );
}

function TopNav({
  query,
  setQuery,
  loading,
  data,
  onRefresh
}: {
  query: string;
  setQuery: (value: string) => void;
  loading: boolean;
  data: GalatasarayPayload | null;
  onRefresh: () => void;
}) {
  return (
    <header className="top-nav">
      <label className="global-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Futbolcu, takim veya ulke ara..."
          type="search"
        />
      </label>
      <div className="top-actions">
        <span className="live-pill">
          <span />
          {data?.status.mode === "live" ? "CANLI VERI" : data?.status.mode === "stale" ? "STALE CACHE" : "FALLBACK"}
        </span>
        <button className="icon-btn" type="button" onClick={onRefresh} aria-label="Veriyi yenile">
          <RefreshCw className={loading ? "spin" : ""} size={18} />
        </button>
        <button className="icon-btn" type="button" aria-label="Bildirimler">
          <Bell size={18} />
        </button>
        <button className="icon-btn" type="button" aria-label="Favoriler">
          <Heart size={18} />
        </button>
      </div>
    </header>
  );
}

const countryOptions = [
  { name: "Ingiltere", image: "/football/countries/england-1200x630.png", region: "Avrupa" },
  { name: "Ispanya", image: "/football/countries/spain-1200x630.png", region: "Avrupa" },
  { name: "Italya", image: "/football/countries/italy-1200x630.png", region: "Avrupa" },
  { name: "Almanya", image: "/football/countries/germany-1200x630.png", region: "Avrupa" },
  { name: "Fransa", image: "/football/countries/france-1200x630.png", region: "Avrupa" },
  { name: "Turkiye", image: "/football/countries/turkey-1200x630.png", region: "Avrupa" },
  { name: "Brezilya", image: "/football/countries/brazil-1200x630.png", region: "G. Amerika" },
  { name: "Arjantin", image: "/football/countries/argentina-1200x630.png", region: "G. Amerika" },
  { name: "Portekiz", image: "/football/countries/portugal-1200x630.png", region: "Avrupa" },
  { name: "Hollanda", image: "/football/countries/netherlands-1200x630.png", region: "Avrupa" }
];

const leagueCatalog = [
  { id: "premier-league", name: "Premier League", country: "Ingiltere", value: "EUR11.8B", folder: "premier-league" },
  { id: "laliga", name: "LaLiga", country: "Ispanya", value: "EUR5.7B", folder: "laliga" },
  { id: "serie-a", name: "Serie A", country: "Italya", value: "EUR5.5B", folder: "serie-a" },
  { id: "bundesliga", name: "Bundesliga", country: "Almanya", value: "EUR4.4B", folder: "bundesliga" },
  { id: "ligue-1", name: "Ligue 1", country: "Fransa", value: "EUR3.4B", folder: "ligue-1" },
  { id: "super-lig", name: "Super Lig", country: "Turkiye", value: "EUR1.2B", folder: "super-lig" }
];

const leagueTeams: Record<string, string[]> = {
  "premier-league": ["AFC Bournemouth", "Arsenal FC", "Aston Villa", "Chelsea FC", "Liverpool FC", "Manchester City", "Manchester United", "Newcastle United", "Tottenham Hotspur", "West Ham United"],
  laliga: ["Atlético de Madrid", "FC Barcelona", "Real Madrid", "Real Sociedad", "Sevilla FC", "Villarreal CF"],
  "serie-a": ["AC Milan", "AS Roma", "Atalanta BC", "Inter Milan", "Juventus FC", "SSC Napoli"],
  bundesliga: ["Bayern Munich", "Borussia Dortmund", "Bayer 04 Leverkusen", "RB Leipzig", "Eintracht Frankfurt", "VfB Stuttgart"],
  "ligue-1": ["Olympique Marseille", "Olympique Lyon", "AS Monaco", "Paris Saint-Germain", "LOSC Lille", "RC Lens"],
  "super-lig": ["Galatasaray", "Fenerbahce", "Besiktas JK", "Trabzonspor", "Basaksehir FK", "Samsunspor", "Göztepe", "Kocaelispor", "Konyaspor", "Kasimpasa"]
};

const fullLeagueTeams: Record<string, string[]> = {
  "premier-league": [
    "AFC Bournemouth", "Arsenal FC", "Aston Villa", "Brentford FC", "Brighton & Hove Albion",
    "Burnley FC", "Chelsea FC", "Crystal Palace", "Everton FC", "Fulham FC", "Leeds United",
    "Liverpool FC", "Manchester City", "Manchester United", "Newcastle United", "Nottingham Forest",
    "Sunderland AFC", "Tottenham Hotspur", "West Ham United", "Wolverhampton Wanderers"
  ],
  laliga: [
    "Athletic Bilbao", "Atlético de Madrid", "CA Osasuna", "Celta de Vigo", "Deportivo Alavés",
    "Elche CF", "FC Barcelona", "Getafe CF", "Girona FC", "Levante UD", "Rayo Vallecano",
    "RCD Espanyol Barcelona", "RCD Mallorca", "Real Betis Balompié", "Real Madrid", "Real Oviedo",
    "Real Sociedad", "Sevilla FC", "Valencia CF", "Villarreal CF"
  ],
  "serie-a": [
    "AC Milan", "ACF Fiorentina", "AS Roma", "Atalanta BC", "Bologna FC 1909", "Cagliari Calcio",
    "Como 1907", "Genoa CFC", "Hellas Verona", "Inter Milan", "Juventus FC", "Parma Calcio 1913",
    "Pisa Sporting Club", "SS Lazio", "SSC Napoli", "Torino FC", "Udinese Calcio", "US Cremonese",
    "US Lecce", "US Sassuolo"
  ],
  bundesliga: [
    "1.FC Heidenheim 1846", "1.FC Köln", "1.FC Union Berlin", "1.FSV Mainz 05", "Bayer 04 Leverkusen",
    "Bayern Munich", "Borussia Dortmund", "Borussia Mönchengladbach", "Eintracht Frankfurt", "FC Augsburg",
    "FC St. Pauli", "Hamburger SV", "RB Leipzig", "SC Freiburg", "SV Werder Bremen", "TSG 1899 Hoffenheim",
    "VfB Stuttgart", "VfL Wolfsburg"
  ],
  "ligue-1": [
    "AJ Auxerre", "Angers SCO", "AS Monaco", "FC Lorient", "FC Metz", "FC Nantes", "FC Toulouse",
    "Le Havre AC", "LOSC Lille", "OGC Nice", "Olympique Lyon", "Olympique Marseille", "Paris FC",
    "Paris Saint-Germain", "RC Lens", "RC Strasbourg Alsace", "Stade Brestois 29", "Stade Rennais FC"
  ],
  "super-lig": [
    "Alanyaspor", "Antalyaspor", "Basaksehir FK", "Besiktas JK", "Caykur Rizespor", "Eyüpspor",
    "Fatih Karagümrük", "Fenerbahce", "Galatasaray", "Gaziantep FK", "Genclerbirligi Ankara",
    "Göztepe", "Kasimpasa", "Kayserispor", "Kocaelispor", "Konyaspor", "Samsunspor", "Trabzonspor"
  ]
};

function HomeDashboard({
  data,
  players,
  filteredPlayers,
  loading,
  selectedPlayer,
  rumors,
  setView,
  onSelectPlayer
}: {
  data: GalatasarayPayload | null;
  players: PlayerProfile[];
  filteredPlayers: PlayerProfile[];
  loading: boolean;
  selectedPlayer: PlayerProfile | null;
  rumors: Rumor[];
  setView: (view: ViewKey) => void;
  onSelectPlayer: (id: number) => void;
}) {
  const topPlayers = [...players].sort((a, b) => b.metrics.future - a.metrics.future).slice(0, 4);
  const [countriesOpen, setCountriesOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(leagueCatalog[5]);
  const [selectedTeam, setSelectedTeam] = useState("Galatasaray");
  const [remoteSquad, setRemoteSquad] = useState<PlayerProfile[]>([]);
  const [squadLoading, setSquadLoading] = useState(false);
  const [squadError, setSquadError] = useState<string | null>(null);
  const selectedTeams = fullLeagueTeams[selectedLeague.id] || leagueTeams[selectedLeague.id] || [];
  const hasConnectedSquad = selectedTeam === "Galatasaray" || selectedTeam === data?.team.name;
  const selectedTeamSquad = hasConnectedSquad ? players : remoteSquad;
  const portalPills = [
    { label: "Canli veri", value: liveStatusText(data), tone: data ? "green" : "amber" },
    { label: "Transfer duyumu", value: rumors[0]?.headline || "Yeni sinyal bekleniyor", tone: "green" },
    {
      label: "Haber",
      value: data?.events.previous
        ? `${data.events.previous.homeTeam} ${data.events.previous.score} ${data.events.previous.awayTeam}`
        : "Mac baglami hazir",
      tone: "neutral"
    },
    { label: "Kadro havuzu", value: `${players.length || filteredPlayers.length} profil`, tone: "neutral" }
  ];

  useEffect(() => {
    if (hasConnectedSquad || !selectedTeam) {
      setRemoteSquad([]);
      setSquadError(null);
      setSquadLoading(false);
      return;
    }

    const controller = new AbortController();
    setSquadLoading(true);
    setSquadError(null);

    fetch(`/api/football/team-squad?team=${encodeURIComponent(selectedTeam)}&league=${encodeURIComponent(selectedLeague.id)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Kadro alinamadi.");
        return body as { players: PlayerProfile[] };
      })
      .then((payload) => {
        setRemoteSquad(payload.players || []);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setRemoteSquad([]);
        setSquadError(error instanceof Error ? error.message : "Kadro alinamadi.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSquadLoading(false);
      });

    return () => controller.abort();
  }, [hasConnectedSquad, selectedLeague.id, selectedTeam]);

  return (
    <div className="page-flow portal-flow">
      <section className="pulse-board pitch-card">
        <div className="pulse-head">
          <div>
            <span className="kicker">STAT11 AKIS</span>
            <h1>Haberler, duyumlar ve lig kapisi</h1>
          </div>
          <div className="pulse-actions">
            <button type="button" onClick={() => setView("scout")}>
              <Target size={17} />
              Scout
            </button>
            <button type="button" onClick={() => setView("lineup")}>
              <Plus size={17} />
              Ilk 11
            </button>
          </div>
        </div>
        <div className="pulse-strip">
          {portalPills.map((pill) => (
            <span className={`pulse-pill ${pill.tone}`} key={pill.label}>
              <b>{pill.label}</b>
              <em>{pill.value}</em>
            </span>
          ))}
        </div>
      </section>

      <section className="portal-nav-row">
        <div className="country-picker">
          <button type="button" onClick={() => setCountriesOpen((open) => !open)}>
            Ulkeler
            <ChevronRight size={16} />
          </button>
          {countriesOpen ? (
            <div className="country-menu pitch-card">
              {countryOptions.map((country) => (
                <button type="button" key={country.name}>
                  <img src={country.image} alt="" />
                  <span>{country.name}</span>
                  <em>{country.region}</em>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button className="world-cup-chip" type="button">
          <Trophy size={17} />
          Dunya Kupasi Ozel
        </button>
        <div className="league-rail" aria-label="Avrupanin en degerli ligleri">
          {leagueCatalog.map((league) => (
            <button
              className={selectedLeague.id === league.id ? "league-card active" : "league-card"}
              type="button"
              key={league.id}
              onClick={() => {
                setSelectedLeague(league);
                setSelectedTeam(fullLeagueTeams[league.id]?.[0] || leagueTeams[league.id]?.[0] || "");
              }}
            >
              <span>{league.name}</span>
              <em>{league.country}</em>
              <b>{league.value}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="league-browser">
        <div className="teams-panel pitch-card">
          <div className="section-head compact">
            <div>
              <span className="kicker">{selectedLeague.country}</span>
              <h2>{selectedLeague.name} takimlari</h2>
            </div>
            <span className="muted-count">{selectedTeams.length} takim</span>
          </div>
          <div className="team-grid">
            {selectedTeams.map((team) => (
              <button className={selectedTeam === team ? "team-card active" : "team-card"} type="button" key={team} onClick={() => setSelectedTeam(team)}>
                <TeamLogo folder={selectedLeague.folder} team={team} />
                <strong>{team}</strong>
                <em>Kadroya gir</em>
              </button>
            ))}
          </div>
        </div>
        <aside className="squad-panel pitch-card">
          <div className="panel-title">
            <div>
              <span className="kicker">KADRO</span>
              <h2>{selectedTeam}</h2>
            </div>
            <Shield size={18} />
          </div>
          <div className="squad-list">
            {squadLoading ? (
              Array.from({ length: 6 }, (_, index) => <SkeletonRow key={index} />)
            ) : squadError ? (
              <div className="squad-empty error">
                <strong>Kadro alinamadi</strong>
                <p>{squadError}</p>
              </div>
            ) : selectedTeamSquad.length ? (
              selectedTeamSquad.slice(0, 8).map((player) => (
                <button type="button" key={player.id} onClick={() => onSelectPlayer(player.id)}>
                  <PlayerAvatar player={player} size="sm" />
                  <span>
                    <strong>{player.shortName}</strong>
                    <em>{player.positionLabel} / {player.marketValueLabel}</em>
                  </span>
                  <b>{player.metrics.future}</b>
                </button>
              ))
            ) : (
              <div className="squad-empty">
                <strong>Kadro verisi bekleniyor</strong>
                <p>Bu takim icin SofaScore kadrosu henuz eslesmedi.</p>
              </div>
            )}
          </div>
          <button className="squad-open" type="button" onClick={() => setView("profile")}>
            Tam kadro ve analiz <ArrowRight size={16} />
          </button>
        </aside>
      </section>

      <section className="section-head">
        <div>
          <span className="kicker">TREND TRANSFERLER</span>
          <h2>Guven Skoru</h2>
        </div>
        <button className="ghost-link" type="button" onClick={() => setView("profile")}>
          Tumunu gor <ChevronRight size={16} />
        </button>
      </section>
      <div className="transfer-grid compact-transfer-grid">
        {(rumors.length ? rumors : []).slice(0, 4).map((rumor) => (
          <RumorFeatureCard key={rumor.id} rumor={rumor} players={players} />
        ))}
      </div>

      <section className="section-head">
        <div>
          <span className="kicker">OYUNCU HAVUZU</span>
          <h2>One Cikan Profiller</h2>
        </div>
        <span className="muted-count">{filteredPlayers.length} eslesen kayit</span>
      </section>
      <div className="player-card-grid">
        {(topPlayers.length ? topPlayers : filteredPlayers.slice(0, 4)).map((player) => (
          <PlayerFeatureCard key={player.id} player={player} onClick={() => onSelectPlayer(player.id)} />
        ))}
      </div>

      {selectedPlayer ? (
        <section className="compact-profile pitch-card">
          <PlayerAvatar player={selectedPlayer} size="xl" />
          <div>
            <span className="kicker">SECILI PROFIL</span>
            <h2>{selectedPlayer.name}</h2>
            <p>
              {selectedPlayer.positionLabel} / {selectedPlayer.country} / {selectedPlayer.marketValueLabel}
            </p>
          </div>
          <button type="button" onClick={() => setView("profile")}>
            Analize git <ArrowRight size={16} />
          </button>
        </section>
      ) : null}
    </div>
  );
}

function TeamLogo({ folder, team }: { folder: string; team: string }) {
  return (
    <span className="team-logo">
      <img src={`/football/leagues/${folder}/${encodeURIComponent(team)}.png`} alt="" />
    </span>
  );
}

function liveStatusText(data: GalatasarayPayload | null) {
  if (!data) return "Baglanti bekleniyor";
  if (data.status.mode === "live") return "Canli API aktif";
  if (data.status.mode === "stale") return "Cache verisi";
  return "Fallback mod";
}

function ProfileWorkspace({
  players,
  allPlayers,
  selectedPlayer,
  position,
  setPosition,
  setSelectedId,
  comparePlayerA,
  comparePlayerB,
  compareA,
  compareB,
  setCompareA,
  setCompareB,
  rumors,
  loading
}: {
  players: PlayerProfile[];
  allPlayers: PlayerProfile[];
  selectedPlayer: PlayerProfile | null;
  position: string;
  setPosition: (position: string) => void;
  setSelectedId: (id: number) => void;
  comparePlayerA: PlayerProfile | null;
  comparePlayerB: PlayerProfile | null;
  compareA: number | null;
  compareB: number | null;
  setCompareA: (id: number) => void;
  setCompareB: (id: number) => void;
  rumors: Rumor[];
  loading: boolean;
}) {
  return (
    <div className="profile-layout">
      <aside className="roster-dock pitch-card">
        <div className="panel-title">
          <div>
            <span className="kicker">OYUNCU HAVUZU</span>
            <h2>{players.length} kayit</h2>
          </div>
          <Filter size={18} />
        </div>
        <Segmented value={position} onChange={setPosition} />
        <div className="roster-list">
          {loading
            ? Array.from({ length: 7 }, (_, index) => <SkeletonRow key={index} />)
            : players.map((player) => (
                <button className={selectedPlayer?.id === player.id ? "active" : ""} key={player.id} type="button" onClick={() => setSelectedId(player.id)}>
                  <PlayerAvatar player={player} size="sm" />
                  <span>
                    <strong>{player.name}</strong>
                    <em>#{player.jerseyNumber} / {player.positionLabel}</em>
                  </span>
                  <b>{player.marketValueLabel}</b>
                </button>
              ))}
        </div>
      </aside>

      <section className="profile-content">
        {selectedPlayer ? (
          <>
            <PlayerHero player={selectedPlayer} setCompareA={setCompareA} setCompareB={setCompareB} />
            <PlayerAnalytics player={selectedPlayer} />
            <ComparisonPanel
              players={allPlayers}
              playerA={comparePlayerA}
              playerB={comparePlayerB}
              compareA={compareA}
              compareB={compareB}
              setCompareA={setCompareA}
              setCompareB={setCompareB}
            />
          </>
        ) : (
          <EmptyPanel title="Oyuncu sec" body="Profil detaylarini gormek icin kadrodan bir oyuncu sec." />
        )}
      </section>

      <aside className="insight-dock">
        <TransferHistory player={selectedPlayer} />
        <RelatedRumors rumors={rumors} selectedPlayer={selectedPlayer} />
      </aside>
    </div>
  );
}

function PlayerHero({
  player,
  setCompareA,
  setCompareB
}: {
  player: PlayerProfile;
  setCompareA: (id: number) => void;
  setCompareB: (id: number) => void;
}) {
  return (
    <section className="player-hero pitch-card">
      <PlayerAvatar player={player} size="hero" />
      <div className="player-hero-main">
        <span className="kicker">{player.country}</span>
        <h1>{player.name}</h1>
        <div className="hero-tags">
          <span>#{player.jerseyNumber}</span>
          <span>{player.positionLabel}</span>
          <span>{player.team.name}</span>
          <span>{player.preferredFoot} ayak</span>
        </div>
      </div>
      <div className="market-block">
        <span>PIYASA DEGERI</span>
        <strong>{player.marketValueLabel}</strong>
        <em>{player.metrics.future >= 70 ? "+12.5% Son 6 Ay" : "Stabil profil"}</em>
        <button type="button" onClick={() => setCompareA(player.id)}>
          <Scale size={17} />
          A'ya ekle
        </button>
        <button type="button" onClick={() => setCompareB(player.id)}>
          <Scale size={17} />
          B'ye ekle
        </button>
      </div>
    </section>
  );
}

function PlayerAnalytics({ player }: { player: PlayerProfile }) {
  const metrics = [
    { label: "Hucum", value: player.attributes.attack },
    { label: "Defans", value: player.attributes.defense },
    { label: "Pas", value: player.attributes.passing },
    { label: "Fizik", value: player.attributes.physical },
    { label: "Form", value: player.attributes.form }
  ];

  return (
    <div className="analytics-grid">
      <div className="stat-bento">
        <MiniStat label="YAS" value={player.age ? String(player.age) : "-"} sub="Sezon profili" />
        <MiniStat label="BOY" value={player.height ? `${player.height} cm` : "-"} sub={player.detailedPosition} />
        <MiniStat label="SOFASCORE TAKIP" value={formatCompact(player.userCount)} sub="Kitle ilgisi" />
      </div>
      <div className="radar-card pitch-card">
        <h3>Taktiksel Profil</h3>
        <Radar metrics={metrics.map((metric) => metric.value)} />
      </div>
      <div className="metric-card pitch-card">
        <h3>Detayli Metrikler</h3>
        {metrics.map((metric) => (
          <MetricBar key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>
      <div className="season-table pitch-card">
        <div className="table-head">
          <h3>Sezon Istatistikleri</h3>
          <span>Pozisyon bazli oyuncu attribute'lari</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Alan</th>
              <th>Skor</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.label}>
                <td>{metric.label}</td>
                <td>{metric.value}</td>
                <td>{metric.value > 70 ? "Elite" : metric.value > 45 ? "Guclu" : "Takip"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineupBuilder({
  players,
  lineup,
  setLineup,
  budget,
  setBudget,
  squadValue,
  budgetDelta,
  avgAge,
  avgRating
}: {
  players: PlayerProfile[];
  lineup: Record<string, number | null>;
  setLineup: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
  budget: number;
  setBudget: (budget: number) => void;
  squadValue: number;
  budgetDelta: number;
  avgAge: number;
  avgRating: number;
}) {
  const [selectedSlot, setSelectedSlot] = useState<string>(lineupSlots[0].id);
  const [lineupQuery, setLineupQuery] = useState("");
  const usedIds = Object.values(lineup).filter(Boolean) as number[];
  const selectedSlotMeta = lineupSlots.find((slot) => slot.id === selectedSlot) || lineupSlots[0];
  const selectedSlotPlayer = players.find((player) => player.id === lineup[selectedSlot]);
  const normalizedLineupQuery = normalize(lineupQuery);
  const searchablePlayers = players
    .filter((player) => {
      if (selectedSlotMeta.role === "G" && player.position !== "G") return false;
      if (!normalizedLineupQuery) return true;

      return (
        normalize(player.name).includes(normalizedLineupQuery) ||
        normalize(player.team.name).includes(normalizedLineupQuery) ||
        normalize(player.country).includes(normalizedLineupQuery) ||
        normalize(player.positionLabel).includes(normalizedLineupQuery)
      );
    })
    .sort((a, b) => {
      const roleScore = roleFitScore(b, selectedSlotMeta.role) - roleFitScore(a, selectedSlotMeta.role);
      if (roleScore) return roleScore;

      return b.metrics.future - a.metrics.future;
    });

  const assignPlayerToSelectedSlot = (playerId: number | null) => {
    setLineup((current) => {
      const next = { ...current };
      const targetPlayer = players.find((player) => player.id === playerId);

      if (playerId && selectedSlotMeta.role === "G" && targetPlayer?.position !== "G") {
        return current;
      }

      if (playerId) {
        for (const slotId of Object.keys(next)) {
          if (slotId !== selectedSlot && next[slotId] === playerId) {
            next[slotId] = null;
          }
        }
      }

      next[selectedSlot] = playerId;
      return next;
    });
  };
  const clearLineup = () => {
    setLineup(
      lineupSlots.reduce<Record<string, number | null>>((acc, slot) => {
        acc[slot.id] = null;
        return acc;
      }, {})
    );
  };

  return (
    <div className="lineup-workspace">
      <section className="pitch-board">
        <div className="pitch-lines" />
        <div className="penalty-box top" />
        <div className="penalty-box bottom" />
        <div className="formation-menu">
          <span>Dizilis</span>
          <select>
            <option>4-3-3 Attack</option>
            <option>4-4-2 Classic</option>
            <option>3-5-2 Fluid</option>
            <option>4-2-3-1 Deep</option>
          </select>
        </div>
        <div className="lineup-board-head">
          <div>
            <span>STAT11 BUILDER</span>
            <strong>Hayalimdeki Ilk 11</strong>
          </div>
          <button type="button" onClick={clearLineup}>
            Temizle
          </button>
        </div>
        <div className="budget-menu">
          {[50, 100, 250, 500].map((value) => (
            <button className={budget === value * 1_000_000 ? "active" : ""} key={value} type="button" onClick={() => setBudget(value * 1_000_000)}>
              {value}M
            </button>
          ))}
          <button className={budget > 900_000_000 ? "active" : ""} type="button" onClick={() => setBudget(999_000_000)}>
            Limitsiz
          </button>
        </div>
        <div className="slots-grid">
          {lineupSlots.map((slot) => {
            const player = players.find((item) => item.id === lineup[slot.id]);
            return (
              <LineupSlot
                key={slot.id}
                slot={slot}
                player={player || null}
                selected={selectedSlot === slot.id}
                onSelectSlot={() => setSelectedSlot(slot.id)}
              />
            );
          })}
        </div>
      </section>
      <aside className="lineup-panel">
        <div className="lineup-search-panel glass-panel">
          <div className="panel-title">
            <div>
              <span className="kicker">OYUNCU HAVUZU</span>
              <h2>{selectedSlotMeta.label}</h2>
            </div>
            <Search size={20} />
          </div>
          <label className="lineup-search">
            <Search size={16} />
            <input
              value={lineupQuery}
              onChange={(event) => setLineupQuery(event.target.value)}
              placeholder="Oyuncu, takim, ulke veya mevki ara..."
              type="search"
            />
          </label>
          {selectedSlotPlayer ? (
            <button className="clear-slot" type="button" onClick={() => assignPlayerToSelectedSlot(null)}>
              {selectedSlotPlayer.name} kaldir
            </button>
          ) : null}
          <div className="lineup-scout-tabs">
            <span className="active">Uygun</span>
            <span>{players.length} oyuncu</span>
          </div>
          <div className="lineup-search-results">
            {searchablePlayers.slice(0, 10).map((player) => (
              <button
                className={lineup[selectedSlot] === player.id ? "active" : ""}
                key={player.id}
                type="button"
                onClick={() => assignPlayerToSelectedSlot(player.id)}
              >
                <PlayerAvatar player={player} size="sm" />
                <span>
                  <strong>{player.name}</strong>
                  <em>{player.team.name} / {player.positionLabel} / {player.country}</em>
                </span>
                <b>
                  <span>{roleFitScore(player, selectedSlotMeta.role) ? "ONERILEN" : "SERBEST"}</span>
                  {usedIds.includes(player.id) && lineup[selectedSlot] !== player.id ? "TASI" : player.marketValueLabel}
                </b>
              </button>
            ))}
          </div>
        </div>
        <div className="glass-panel">
          <div className="panel-title">
            <div>
              <span className="kicker">KADRO DEGERI</span>
              <h2>{formatMoney(squadValue)}</h2>
            </div>
            <CircleDollarSign size={20} />
          </div>
          <div className="budget-track">
            <span style={{ width: `${Math.min((squadValue / budget) * 100, 100)}%` }} />
          </div>
          <p className={budgetDelta >= 0 ? "budget-ok" : "budget-warn"}>
            {budgetDelta >= 0 ? `${formatMoney(budgetDelta)} bosluk var` : `${formatMoney(Math.abs(budgetDelta))} butce asimi`}
          </p>
        </div>
        <div className="squad-stats">
          <MiniStat label="ORT. YAS" value={avgAge ? avgAge.toFixed(1) : "-"} sub="Ilk 11" />
          <MiniStat label="ORT. SKOR" value={avgRating ? avgRating.toFixed(1) : "-"} sub="Potansiyel" />
          <MiniStat label="POTANSIYEL" value={`${Math.round(avgRating || 0)}/100`} sub="Takim tavan" wide />
        </div>
        <div className="glass-panel">
          <div className="ai-head">
            <Sparkles size={18} />
            <h3>AI Onerileri</h3>
          </div>
          <p>
            Yuksek piyasa degerli oyuncular yerine gelecegi guclu ve kontrat riski dusuk profilleri
            tercih ederek butce dengesini koruyabilirsiniz.
          </p>
        </div>
        <div className="action-stack">
          <button type="button">
            <Share2 size={17} />
            Kadroyu Paylas
          </button>
          <button type="button">
            <Save size={17} />
            Taslak Olarak Kaydet
          </button>
        </div>
      </aside>
    </div>
  );
}

function ScoutCenter({
  players,
  allPlayers,
  position,
  setPosition,
  setSelectedId,
  setView
}: {
  players: PlayerProfile[];
  allPlayers: PlayerProfile[];
  position: string;
  setPosition: (position: string) => void;
  setSelectedId: (id: number) => void;
  setView: (view: ViewKey) => void;
}) {
  const sorted = [...players].sort((a, b) => b.metrics.future - a.metrics.future);
  const topRegion = mostCommon(allPlayers.map((player) => player.country));
  const avgGem =
    allPlayers.reduce((sum, player) => sum + player.metrics.future, 0) / Math.max(allPlayers.length, 1);

  return (
    <div className="scout-workspace">
      <section className="scout-filter pitch-card">
        <div>
          <span className="kicker">SCOUT MERKEZI</span>
          <h1>Gelecegin yildizlarini veriyle kesfet</h1>
          <p>Mevki, piyasa sinyali, takip ilgisi ve potansiyel metriklerine gore canli kadro icinde hizli tarama.</p>
        </div>
        <Segmented value={position} onChange={setPosition} />
      </section>
      <div className="scout-grid">
        <section className="scout-results">
          <div className="results-head">
            <h2>Eslesen <span>{sorted.length} Oyuncu</span></h2>
            <select>
              <option>Potansiyel yuksek-dusuk</option>
              <option>Piyasa degeri</option>
              <option>Takip ilgisi</option>
            </select>
          </div>
          {sorted.map((player, index) => (
            <button
              className="scout-card"
              key={player.id}
              type="button"
              onClick={() => {
                setSelectedId(player.id);
                setView("profile");
              }}
            >
              <PlayerAvatar player={player} size="md" />
              <div>
                <h3>{player.name}</h3>
                <p>{player.team.name} / {player.positionLabel} / {player.age || "-"} yas</p>
                <div className="tag-row">
                  <span>{index < 3 ? "Hidden Gem" : "Scouted"}</span>
                  <span>{player.country}</span>
                  <span>{player.contractRisk} risk</span>
                </div>
              </div>
              <div className="potential-block">
                <span>Potential</span>
                <strong>{player.metrics.future}</strong>
              </div>
            </button>
          ))}
        </section>
        <aside className="scout-aside">
          <div className="analytics-orb pitch-card">
            <h3>Discovery Analytics</h3>
            <Radar metrics={[82, 76, 69, Math.round(avgGem), 73]} />
            <dl>
              <div>
                <dt>Top Region</dt>
                <dd>{topRegion}</dd>
              </div>
              <div>
                <dt>Avg. Gem Score</dt>
                <dd>{avgGem.toFixed(1)}</dd>
              </div>
              <div>
                <dt>Market Trend</dt>
                <dd>+12.4%</dd>
              </div>
            </dl>
          </div>
          <div className="reports-card pitch-card">
            <h3>Son Raporlar</h3>
            {sorted.slice(0, 3).map((player) => (
              <div key={player.id}>
                <Activity size={16} />
                <span>
                  <strong>{player.name} guncellemesi</strong>
                  <em>{player.positionLabel} / {player.marketValueLabel}</em>
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function LineupSlot({
  slot,
  player,
  selected,
  onSelectSlot
}: {
  slot: (typeof lineupSlots)[number];
  player: PlayerProfile | null;
  selected: boolean;
  onSelectSlot: () => void;
}) {
  return (
    <div className={`lineup-slot slot-${slot.id} ${selected ? "selected" : ""}`}>
      <button type="button" onClick={onSelectSlot} aria-label={`${slot.label} slotu`}>
        <span className="shirt-frame">
          {player ? <PlayerAvatar player={player} size="lineup" /> : <Plus size={22} />}
        </span>
        <span className="slot-copy">
          <strong>{player?.shortName || slot.label}</strong>
          <em>{player?.marketValueLabel || "Bos slot"}</em>
        </span>
        <span className="slot-rating">{player?.metrics.future || slot.label}</span>
      </button>
    </div>
  );
}

function ComparisonPanel({
  players,
  playerA,
  playerB,
  compareA,
  compareB,
  setCompareA,
  setCompareB
}: {
  players: PlayerProfile[];
  playerA: PlayerProfile | null;
  playerB: PlayerProfile | null;
  compareA: number | null;
  compareB: number | null;
  setCompareA: (id: number) => void;
  setCompareB: (id: number) => void;
}) {
  return (
    <section className="comparison-panel pitch-card">
      <div className="panel-title">
        <div>
          <span className="kicker">KARSILASTIRMA</span>
          <h2>Iki oyuncuyu yan yana oku</h2>
        </div>
        <Scale size={20} />
      </div>
      <div className="compare-selectors">
        <PlayerSelect label="Oyuncu A" players={players} value={compareA} onChange={setCompareA} />
        <PlayerSelect label="Oyuncu B" players={players} value={compareB} onChange={setCompareB} />
      </div>
      {playerA && playerB ? (
        <div className="compare-table">
          {[
            ["Yas", playerA.age || "-", playerB.age || "-"],
            ["Mevki", playerA.positionLabel, playerB.positionLabel],
            ["Piyasa", playerA.marketValueLabel, playerB.marketValueLabel],
            ["Kontrat", playerA.contractRisk, playerB.contractRisk],
            ["Takip", formatCompact(playerA.userCount), formatCompact(playerB.userCount)]
          ].map(([label, a, b]) => (
            <div key={label}>
              <span>{a}</span>
              <strong>{label}</strong>
              <span>{b}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TransferHistory({ player }: { player: PlayerProfile | null }) {
  return (
    <section className="pitch-card timeline-card">
      <h3>Transfer Gecmisi</h3>
      <div>
        <span />
        <strong>{player?.team.name || "Galatasaray"}</strong>
        <em>{player?.marketValueLabel || "-"} / Guncel</em>
      </div>
      <div>
        <span />
        <strong>Scout izleme</strong>
        <em>Canli profil sinyalleri</em>
      </div>
    </section>
  );
}

function RelatedRumors({ rumors, selectedPlayer }: { rumors: Rumor[]; selectedPlayer: PlayerProfile | null }) {
  const selected = selectedPlayer
    ? [...rumors.filter((rumor) => rumor.playerId === selectedPlayer.id), ...rumors.filter((rumor) => rumor.playerId !== selectedPlayer.id)]
    : rumors;

  return (
    <section className="pitch-card related-card">
      <h3>One Cikan Haberler</h3>
      {selected.slice(0, 3).map((rumor) => (
        <article key={rumor.id}>
          <span>{rumor.type}</span>
          <strong>{rumor.headline}</strong>
          <p>{rumor.playerName} / {rumor.confidence}% guven</p>
        </article>
      ))}
    </section>
  );
}

function RumorFeatureCard({ rumor, players }: { rumor: Rumor; players: PlayerProfile[] }) {
  const player = players.find((item) => item.id === rumor.playerId);

  return (
    <article className="rumor-feature pitch-card">
      <div className="rumor-image">
        {player ? <PlayerAvatar player={player} size="feature" /> : <Newspaper size={42} />}
        <span>{rumor.type}</span>
      </div>
      <h3>{rumor.playerName}</h3>
      <p>{rumor.headline}</p>
      <div className="rumor-route">
        <span>{player?.team.name || "Kulup"}</span>
        <ArrowRight size={14} />
        <strong>{rumor.linkedClub}</strong>
      </div>
      <MetricBar label="Guvenilirlik" value={rumor.confidence} />
    </article>
  );
}

function PlayerFeatureCard({ player, onClick }: { player: PlayerProfile; onClick: () => void }) {
  return (
    <button className="player-feature pitch-card" type="button" onClick={onClick}>
      <PlayerAvatar player={player} size="feature" />
      <div>
        <span className="kicker">{player.positionLabel}</span>
        <h3>{player.name}</h3>
        <p>{player.country} / {player.team.name}</p>
      </div>
      <div className="feature-stats">
        <strong>{player.metrics.future}</strong>
        <span>Potential</span>
      </div>
    </button>
  );
}

function PlayerSelect({
  label,
  players,
  value,
  onChange
}: {
  label: string;
  players: PlayerProfile[];
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <label className="player-select">
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(Number(event.target.value))}>
        {players.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Segmented({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="segmented-control" aria-label="Pozisyon filtresi">
      {positions.map((item) => (
        <button className={value === item.key ? "active" : ""} key={item.key} type="button" onClick={() => onChange(item.key)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function PlayerAvatar({
  player,
  size
}: {
  player: Pick<PlayerProfile, "name" | "initials" | "imageUrl">;
  size: "sm" | "md" | "xl" | "hero" | "feature" | "lineup";
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`avatar avatar-${size}`} aria-label={player.name}>
      <span>{player.initials}</span>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.imageUrl} alt="" decoding="async" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : null}
    </span>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-tile">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniStat({ label, value, sub, wide }: { label: string; value: string; sub: string; wide?: boolean }) {
  return (
    <div className={wide ? "mini-stat wide" : "mini-stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{sub}</em>
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-row">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="metric-track">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Radar({ metrics }: { metrics: number[] }) {
  const points = metrics.map((value, index) => {
    const angle = -90 + index * (360 / metrics.length);
    const radius = 8 + (value / 100) * 37;
    const x = 50 + radius * Math.cos((angle * Math.PI) / 180);
    const y = 50 + radius * Math.sin((angle * Math.PI) / 180);
    return `${x},${y}`;
  });

  return (
    <div className="radar-wrap">
      <svg viewBox="0 0 100 100" role="img" aria-label="Oyuncu radar grafigi">
        <circle cx="50" cy="50" r="45" />
        <circle cx="50" cy="50" r="30" />
        <circle cx="50" cy="50" r="15" />
        <path d="M50 5 L50 95 M5 50 L95 50 M18 18 L82 82 M82 18 L18 82" />
        <polygon points={points.join(" ")} />
      </svg>
      <span>HUCUM</span>
      <span>PAS</span>
      <span>FIZIK</span>
      <span>DEFANS</span>
      <span>FORM</span>
    </div>
  );
}

function EventStrip({ title, event }: { title: string; event: TeamEvent | null }) {
  return (
    <article className="event-strip">
      <div>
        <Activity size={16} />
        <span>{title}</span>
      </div>
      {event ? (
        <>
          <strong>
            {event.homeTeam} <em>{event.score}</em> {event.awayTeam}
          </strong>
          <p>{event.tournament} / {event.round} / {event.startDate}</p>
          <div className="event-tags">
            {event.hasPlayerStats ? <span>Oyuncu istatistigi var</span> : <span>Oyuncu istatistigi yok</span>}
            {event.hasXg ? <span>xG var</span> : null}
          </div>
        </>
      ) : (
        <p>API bu alan icin kayit dondurmedi.</p>
      )}
    </article>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="error-state">
      <AlertCircle size={20} />
      <div>
        <strong>API verisi alinamadi</strong>
        <p>{message}</p>
      </div>
      <button type="button" onClick={onRetry}>
        <RefreshCw size={16} />
        Yeniden dene
      </button>
    </section>
  );
}

function DataNotice({ status }: { status: GalatasarayPayload["status"] }) {
  return (
    <section className="data-notice">
      <BadgeCheck size={18} />
      <div>
        <strong>{status.mode === "stale" ? "Stale cache gosteriliyor" : "Fallback veri modu"}</strong>
        <p>{status.message}</p>
      </div>
    </section>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-panel">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="skeleton-row">
      <span />
      <i />
      <i />
    </div>
  );
}

function seedLineup(current: Record<string, number | null>, players: PlayerProfile[]) {
  if (Object.keys(current).length) return current;

  const byRole = (role: string) => players.filter((player) => player.position === role).sort(sortRosterPlayers);
  const picks = [...byRole("F").slice(0, 3), ...byRole("M").slice(0, 3), ...byRole("D").slice(0, 4), ...byRole("G").slice(0, 1)];

  return lineupSlots.reduce<Record<string, number | null>>((acc, slot, index) => {
    acc[slot.id] = picks[index]?.id || null;
    return acc;
  }, {});
}

function roleFitScore(player: PlayerProfile, role: string) {
  if (role === "G") return player.position === "G" ? 2 : 0;
  if (player.position === role) return 2;
  if (role === "D" && player.position === "M") return 1;
  if (role === "M" && (player.position === "D" || player.position === "F")) return 1;
  if (role === "F" && player.position === "M") return 1;
  return 0;
}

function sortRosterPlayers(a: PlayerProfile, b: PlayerProfile) {
  const roleOrder = (a.squadRole === "starter" ? 0 : 1) - (b.squadRole === "starter" ? 0 : 1);
  if (roleOrder) return roleOrder;

  const positionOrder = positionWeight(a.position) - positionWeight(b.position);
  if (positionOrder) return positionOrder;

  return Number(a.jerseyNumber || 999) - Number(b.jerseyNumber || 999);
}

function positionWeight(position: string) {
  return { G: 0, D: 1, M: 2, F: 3 }[position as "G" | "D" | "M" | "F"] ?? 9;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatMoney(value: number) {
  if (value >= 1_000_000) {
    return `EUR${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value / 1_000_000)}M`;
  }

  return `EUR${new Intl.NumberFormat("tr-TR").format(value)}`;
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}
