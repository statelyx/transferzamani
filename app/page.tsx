"use client";

import {
  buildFormationSlots,
  EAFC_FORMATIONS,
  PLAYER_ROLE_PRESETS,
  POSITION_LABELS,
  tacticalRoleKey,
  type TacticalSlot
} from "@/lib/football/eafc-reference";
import { buildPlayerStats, type RecentMatch } from "@/lib/football/player-stats";
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
  Globe2,
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

type ViewKey = "home" | "profile" | "lineup" | "scout" | "news";

type NewsCard = {
  id: string;
  tweetId: string;
  category: "transfer" | "istatistik" | "haber";
  league: string;
  title: string;
  summary: string;
  sourceAccount: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  imageUrl: string | null;
};

type PlayerSearchPayload = {
  players: PlayerProfile[];
  error?: string;
};

const positions = [
  { key: "ALL", label: "TUMU" },
  { key: "G", label: "GK" },
  { key: "D", label: "DEF" },
  { key: "M", label: "MID" },
  { key: "F", label: "FWD" }
];

const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "home", label: "Ana Sayfa", icon: <HomeIcon size={18} /> },
  { key: "profile", label: "Oyuncu Havuzu", icon: <UserRound size={18} /> },
  { key: "lineup", label: "Ilk 11 Olustur", icon: <Shield size={18} /> },
  { key: "scout", label: "Scout Merkezi", icon: <Target size={18} /> },
  { key: "news", label: "Blog Forum", icon: <Newspaper size={18} /> }
];

const lineupSlots = buildFormationSlots("4-3-3");

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

  // Lifted team squad states
  const [selectedLeague, setSelectedLeague] = useState(leagueCatalog[0]);
  const [selectedTeam, setSelectedTeam] = useState(fullLeagueTeams[leagueCatalog[0].id]?.[0] || "AFC Bournemouth");
  const [remoteSquad, setRemoteSquad] = useState<PlayerProfile[]>([]);
  const [squadLoading, setSquadLoading] = useState(false);
  const [squadError, setSquadError] = useState<string | null>(null);
  const [news, setNews] = useState<NewsCard[]>([]);

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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Bilinmeyen hata.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    fetch("/api/news")
      .then((response) => response.json())
      .then((payload) => setNews(payload.news || []))
      .catch(() => setNews([]));
  }, []);

  const gsPlayers = data?.players || [];
  const firstGsPlayerId = gsPlayers[0]?.id || null;
  const hasConnectedSquad = selectedTeam === "Galatasaray" || (data?.team?.name && selectedTeam === data.team.name);
  const selectedTeamSquad = hasConnectedSquad ? gsPlayers : remoteSquad;

  useEffect(() => {
    if (hasConnectedSquad || !selectedTeam) {
      setRemoteSquad([]);
      setSquadError(null);
      setSquadLoading(false);
      if (hasConnectedSquad && gsPlayers[0]) {
        setSelectedId(gsPlayers[0].id);
      }
      return;
    }

    const controller = new AbortController();
    setRemoteSquad([]);
    setSelectedId(null);
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
        const nextPlayers = payload.players || [];
        setRemoteSquad(nextPlayers);
        setSelectedId(nextPlayers[0]?.id || null);
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
  }, [hasConnectedSquad, selectedLeague.id, selectedTeam, firstGsPlayerId]);

  const players = useMemo(() => {
    return selectedTeamSquad;
  }, [selectedTeamSquad]);

  useEffect(() => {
    if (!selectedId && players.length > 0) {
      setSelectedId(players[0].id);
    }
  }, [players, selectedId]);

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
    <div className="transfer-shell">
      <SideNav view={view} setView={setView} />
      <main className="transfer-main">
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
            selectedLeague={selectedLeague}
            setSelectedLeague={setSelectedLeague}
            selectedTeam={selectedTeam}
            setSelectedTeam={setSelectedTeam}
            remoteSquad={remoteSquad}
            squadLoading={squadLoading}
            squadError={squadError}
            selectedTeamSquad={selectedTeamSquad}
            news={news}
          />
        ) : null}

        {view === "profile" ? (
          <PlayerPoolWorkspace
            seedPlayers={players}
            compareA={compareA}
            compareB={compareB}
            setCompareA={setCompareA}
            setCompareB={setCompareB}
            news={news}
            rumors={data?.rumors || []}
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

        {view === "news" ? <NewsHub news={news} loading={loading} /> : null}
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
          TZ
        </div>
        <div>
          <strong>Transfer Zamanı</strong>
          <span>transferzamani.com</span>
        </div>
      </div>
      <nav>
        {navItems.map((item) => (
          <button
            aria-label={item.label}
            className={view === item.key ? "active" : ""}
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="side-footer">
        <button type="button" aria-label="Ayarlar">
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

// Static variables moved to the top of the file to prevent temporal dead zone issues.

function HomeDashboard({
  data,
  players,
  filteredPlayers,
  loading,
  selectedPlayer,
  rumors,
  setView,
  onSelectPlayer,
  selectedLeague,
  setSelectedLeague,
  selectedTeam,
  setSelectedTeam,
  remoteSquad,
  squadLoading,
  squadError,
  selectedTeamSquad,
  news
}: {
  data: GalatasarayPayload | null;
  players: PlayerProfile[];
  filteredPlayers: PlayerProfile[];
  loading: boolean;
  selectedPlayer: PlayerProfile | null;
  rumors: Rumor[];
  setView: (view: ViewKey) => void;
  onSelectPlayer: (id: number) => void;
  selectedLeague: typeof leagueCatalog[number];
  setSelectedLeague: (league: typeof leagueCatalog[number]) => void;
  selectedTeam: string;
  setSelectedTeam: (team: string) => void;
  remoteSquad: PlayerProfile[];
  squadLoading: boolean;
  squadError: string | null;
  selectedTeamSquad: PlayerProfile[];
  news: NewsCard[];
}) {
  const topPlayers = [...players].sort((a, b) => b.metrics.future - a.metrics.future).slice(0, 4);
  const [countriesOpen, setCountriesOpen] = useState(false);
  const selectedTeams = fullLeagueTeams[selectedLeague.id] || leagueTeams[selectedLeague.id] || [];
  const portalPills = [
    { label: "Canli futbol verisi", value: liveStatusText(data), tone: data ? "green" : "amber" },
    { label: "Transfer duyumu", value: rumors[0]?.headline || "Yeni sinyal bekleniyor", tone: "green" },
    {
      label: "Haber",
      value: data?.events.previous
        ? `${data.events.previous.homeTeam} ${data.events.previous.score} ${data.events.previous.awayTeam}`
        : "Mac baglami hazir",
      tone: "neutral"
    },
    { label: "Haber havuzu", value: `${news.length} kaynakli haber`, tone: "neutral" }
  ];

  return (
    <div className="page-flow portal-flow">
      <section className="pulse-board pitch-card">
        <div className="pulse-head">
          <div>
            <span className="kicker">TRANSFER ZAMANI AKISI</span>
            <h1>Transfer gündemi, ligler ve ilk 11 merkezi</h1>
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
              <LeagueLogo league={league.id} />
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
              selectedTeamSquad.map((player) => (
                <button type="button" key={player.id} onClick={() => onSelectPlayer(player.id)}>
                  <PlayerAvatar player={player} size="sm" />
                  <span>
                    <strong>#{player.jerseyNumber} {player.shortName}</strong>
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
          <span className="kicker">TURKCE FUTBOL GUNDEMI</span>
          <h2>Kaynakli Haber Akisi</h2>
        </div>
        <button className="ghost-link" type="button" onClick={() => setView("news")}>
          Haber havuzu <ChevronRight size={16} />
        </button>
      </section>
      <div className="news-grid">
        {(news.length ? news : []).slice(0, 6).map((item) => (
          <a className={`news-card ${item.category}`} href={item.sourceUrl} key={item.id} rel="noreferrer" target="_blank">
            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="news-fallback">{item.category}</span>}
            <span className="news-meta">
              <b>{item.league}</b>
              <em>@{item.sourceAccount}</em>
            </span>
            <strong>{item.title}</strong>
            <p>{item.summary}</p>
          </a>
        ))}
      </div>

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
        {(rumors.length ? rumors : []).slice(0, 10).map((rumor) => (
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
  const liveLogo = `/api/image/team/${encodeURIComponent(team)}?league=${encodeURIComponent(folder)}`;
  const localLogo = `/football/leagues/${folder}/${encodeURIComponent(team)}.png`;
  const [src, setSrc] = useState(liveLogo);

  useEffect(() => {
    setSrc(liveLogo);
  }, [liveLogo]);

  return (
    <span className="team-logo">
      <img
        src={src}
        alt=""
        onError={() => {
          if (src !== localLogo) setSrc(localLogo);
        }}
      />
    </span>
  );
}

function LeagueLogo({ league }: { league: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [league]);

  return (
    <span className="league-logo">
      {!failed ? (
        <img src={`/api/image/league/${encodeURIComponent(league)}`} alt="" onError={() => setFailed(true)} />
      ) : (
        <Globe2 size={18} />
      )}
    </span>
  );
}

function liveStatusText(data: GalatasarayPayload | null) {
  if (!data) return "Baglanti bekleniyor";
  if (data.status.mode === "live") return "Canli API aktif";
  if (data.status.mode === "stale") return "Cache verisi";
  return "Fallback mod";
}

function ageBandToRange(value: string): [number, number] {
  if (value === "U21") return [0, 21];
  if (value === "22-25") return [22, 25];
  if (value === "26-30") return [26, 30];
  if (value === "31+") return [31, 0];
  return [0, 0];
}

function NewsHub({ news, loading }: { news: NewsCard[]; loading: boolean }) {
  const [category, setCategory] = useState<"all" | NewsCard["category"]>("all");
  const [source, setSource] = useState("all");
  const sources = useMemo(() => {
    return Array.from(new Set(news.map((item) => item.sourceAccount || item.sourceName).filter(Boolean))).sort();
  }, [news]);
  const filtered = useMemo(() => {
    return news.filter((item) => {
      const categoryHit = category === "all" || item.category === category;
      const sourceHit = source === "all" || item.sourceAccount === source || item.sourceName === source;
      return categoryHit && sourceHit;
    });
  }, [category, news, source]);

  return (
    <div className="news-hub page-flow">
      <section className="pitch-card news-hub-hero">
        <div>
          <span className="kicker">TRANSFER ZAMANI HABER HAVUZU</span>
          <h1>Twitter/X, transfer kaynaklari ve futbol haberleri</h1>
          <p>
            Fabrizio Romano, yerli transfer kaynaklari, OptaCan, FotMob ve RSS akislari tek yerde
            toplanir; tekrar eden haberler cache uzerinden ayrilir.
          </p>
        </div>
        <div className="news-hub-stats">
          <MiniStat label="TOPLAM" value={String(news.length)} sub="Haber" />
          <MiniStat label="TRANSFER" value={String(news.filter((item) => item.category === "transfer").length)} sub="Duyum" />
          <MiniStat label="KAYNAK" value={String(sources.length)} sub="Hesap" />
        </div>
      </section>

      <section className="news-toolbar pitch-card">
        <label>
          <span>Kategori</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
            <option value="all">Tum haberler</option>
            <option value="transfer">Transfer</option>
            <option value="istatistik">Istatistik</option>
            <option value="haber">Genel haber</option>
          </select>
        </label>
        <label>
          <span>Kaynak</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">Tum kaynaklar</option>
            {sources.map((item) => (
              <option key={item} value={item}>
                @{item}
              </option>
            ))}
          </select>
        </label>
        <span className="muted-count">{filtered.length} kayit</span>
      </section>

      {loading && !news.length ? (
        <section className="pitch-card empty-panel">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </section>
      ) : filtered.length ? (
        <div className="news-feed-grid">
          {filtered.map((item) => (
            <a className={`news-card ${item.category}`} href={item.sourceUrl} key={item.id} rel="noreferrer" target="_blank">
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="news-fallback">{item.category}</span>}
              <span className="news-meta">
                <b>{item.league}</b>
                <em>@{item.sourceAccount}</em>
              </span>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
            </a>
          ))}
        </div>
      ) : (
        <EmptyPanel title="Haber bulunamadi" body="Secili filtreler icin cache veya canli kaynakta haber yok." />
      )}
    </div>
  );
}

function PlayerPoolWorkspace({
  seedPlayers,
  compareA,
  compareB,
  setCompareA,
  setCompareB,
  news,
  rumors
}: {
  seedPlayers: PlayerProfile[];
  compareA: number | null;
  compareB: number | null;
  setCompareA: (id: number) => void;
  setCompareB: (id: number) => void;
  news: NewsCard[];
  rumors: Rumor[];
}) {
  const [poolQuery, setPoolQuery] = useState("");
  const [poolLeague, setPoolLeague] = useState(leagueCatalog[0].id);
  const [poolCountry, setPoolCountry] = useState("ALL");
  const [poolTeam, setPoolTeam] = useState("ALL");
  const [poolPosition, setPoolPosition] = useState("ALL");
  const [ageBand, setAgeBand] = useState("ALL");
  const [poolPlayers, setPoolPlayers] = useState<PlayerProfile[]>(seedPlayers);
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(seedPlayers[0]?.id || null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);

  const league = leagueCatalog.find((item) => item.id === poolLeague) || leagueCatalog[0];
  const teams = fullLeagueTeams[league.id] || leagueTeams[league.id] || [];
  const [ageMin, ageMax] = ageBandToRange(ageBand);

  useEffect(() => {
    setPoolTeam("ALL");
  }, [poolLeague]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadPool() {
      setPoolLoading(true);
      setPoolError(null);

      const params = new URLSearchParams({
        limit: "120",
        league: poolLeague,
        country: poolCountry,
        team: poolTeam,
        position: poolPosition
      });

      if (poolQuery.trim()) params.set("q", poolQuery.trim());
      if (ageMin) params.set("ageMin", String(ageMin));
      if (ageMax) params.set("ageMax", String(ageMax));

      try {
        const response = await fetch(`/api/football/player-pool?${params.toString()}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as PlayerSearchPayload & { error?: string };
        if (!active) return;

        if (!response.ok) {
          setPoolError(payload.error || "Oyuncu havuzu okunamadi.");
          setPoolPlayers(seedPlayers);
          return;
        }

        const nextPlayers = payload.players || [];
        setPoolPlayers(nextPlayers);
        setSelectedPoolId((current) => {
          if (current && nextPlayers.some((player) => player.id === current)) return current;
          return nextPlayers[0]?.id || null;
        });
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setPoolError(error instanceof Error ? error.message : "Oyuncu havuzu okunamadi.");
          setPoolPlayers(seedPlayers);
        }
      } finally {
        if (active) setPoolLoading(false);
      }
    }

    const timer = window.setTimeout(loadPool, poolQuery.trim() ? 260 : 0);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [ageMax, ageMin, poolCountry, poolLeague, poolPosition, poolQuery, poolTeam, seedPlayers]);

  const selectedPlayer = poolPlayers.find((player) => player.id === selectedPoolId) || poolPlayers[0] || null;
  const comparePlayerA = poolPlayers.find((player) => player.id === compareA) || null;
  const comparePlayerB = poolPlayers.find((player) => player.id === compareB) || null;

  return (
    <div className="player-pool-workspace page-flow">
      <section className="player-pool-hero pitch-card">
        <div>
          <span className="kicker">OYUNCU HAVUZU</span>
          <h1>Dunya futbolcu arama merkezi</h1>
          <p>Lig, ulke, takim, mevki ve yas filtresiyle FIFA transfer ekranı gibi oyuncu tarayın.</p>
        </div>
        <div className="pool-hero-stats">
          <MiniStat label="LISTE" value={String(poolPlayers.length)} sub="Oyuncu" />
          <MiniStat label="LIG" value={league.name} sub={league.country} />
          <MiniStat label="KAYNAK" value="API + DB" sub="Cache" />
        </div>
      </section>

      <section className="player-pool-filters pitch-card">
        <label className="pool-search">
          <Search size={17} />
          <input
            value={poolQuery}
            onChange={(event) => setPoolQuery(event.target.value)}
            placeholder="Oyuncu, takim veya ulke ara..."
            type="search"
          />
        </label>
        <label>
          <span>Lig</span>
          <select value={poolLeague} onChange={(event) => setPoolLeague(event.target.value)}>
            {leagueCatalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ulke</span>
          <select value={poolCountry} onChange={(event) => setPoolCountry(event.target.value)}>
            <option value="ALL">Tum ulkeler</option>
            {countryOptions.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Takim</span>
          <select value={poolTeam} onChange={(event) => setPoolTeam(event.target.value)}>
            <option value="ALL">Tum takimlar</option>
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Mevki</span>
          <select value={poolPosition} onChange={(event) => setPoolPosition(event.target.value)}>
            <option value="ALL">Tum mevkiler</option>
            <option value="G">Kaleci</option>
            <option value="D">Defans</option>
            <option value="M">Orta saha</option>
            <option value="F">Forvet</option>
          </select>
        </label>
        <label>
          <span>Yas</span>
          <select value={ageBand} onChange={(event) => setAgeBand(event.target.value)}>
            <option value="ALL">Tum yaslar</option>
            <option value="U21">21 alti</option>
            <option value="22-25">22-25</option>
            <option value="26-30">26-30</option>
            <option value="31+">31+</option>
          </select>
        </label>
      </section>

      {poolError ? (
        <section className="error-state pool-error">
          <AlertCircle size={20} />
          <div>
            <strong>Oyuncu havuzu gecici olarak cache verisiyle calisiyor</strong>
            <p>{poolError}</p>
          </div>
        </section>
      ) : null}

      <div className="player-pool-layout">
        <section className="pool-results pitch-card">
          <div className="section-head compact">
            <div>
              <span className="kicker">FIFA TARZI ARAMA</span>
              <h2>{poolLoading ? "Oyuncular yukleniyor" : `${poolPlayers.length} oyuncu`}</h2>
            </div>
            <span className="muted-count">{league.name}</span>
          </div>
          <div className="pool-card-grid">
            {poolLoading
              ? Array.from({ length: 12 }, (_, index) => <SkeletonRow key={index} />)
              : poolPlayers.map((player) => (
                  <button
                    className={selectedPlayer?.id === player.id ? "pool-player-card active" : "pool-player-card"}
                    key={`${player.id}:${player.name}`}
                    type="button"
                    onClick={() => setSelectedPoolId(player.id)}
                  >
                    <PlayerAvatar player={player} size="md" />
                    <span>
                      <strong>{player.name}</strong>
                      <em>{player.team.name} / {player.country}</em>
                    </span>
                    <b>{player.marketValueLabel}</b>
                    <i>{player.positionLabel}</i>
                    <small>{player.age ? `${player.age} yas` : "Yas yok"}</small>
                  </button>
                ))}
          </div>
          {!poolLoading && poolPlayers.length === 0 ? (
            <EmptyPanel title="Oyuncu bulunamadi" body="Filtreleri genislet veya arama metnini degistir." />
          ) : null}
        </section>

        <aside className="pool-detail">
          {selectedPlayer ? (
            <>
              <PlayerHero player={selectedPlayer} setCompareA={setCompareA} setCompareB={setCompareB} />
              <PlayerAnalytics player={selectedPlayer} />
              <ComparisonPanel
                players={poolPlayers}
                playerA={comparePlayerA}
                playerB={comparePlayerB}
                compareA={compareA}
                compareB={compareB}
                setCompareA={setCompareA}
                setCompareB={setCompareB}
              />
              <PlayerNews player={selectedPlayer} news={news} />
              <RelatedRumors rumors={rumors} selectedPlayer={selectedPlayer} />
            </>
          ) : (
            <EmptyPanel title="Oyuncu sec" body="Detay analizi icin havuzdan bir futbolcu sec." />
          )}
        </aside>
      </div>
    </div>
  );
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
  loading,
  news
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
  news: NewsCard[];
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
            <PlayerNews player={selectedPlayer} news={news} />
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
        <span className="kicker">
          <CountryFlag country={player.country} code={player.countryCode} />
          {player.country}
        </span>
        <h1>{player.name}</h1>
        <div className="hero-tags">
          <span>#{player.jerseyNumber}</span>
          <span>{player.positionLabel}</span>
          <span>{player.team.name}</span>
          <span>{player.preferredFoot} ayak</span>
          {player.age ? <span>{player.age} yaş</span> : null}
          {player.height ? <span>{player.height} cm</span> : null}
        </div>
        <div className="market-currency-row">
          <div className="currency-chip eur">
            <span>EURO</span>
            <strong>{player.marketValues.eur}</strong>
          </div>
          <div className="currency-chip usd">
            <span>DOLAR</span>
            <strong>{player.marketValues.usd}</strong>
          </div>
          <div className="currency-chip try">
            <span>TL</span>
            <strong>{player.marketValues.try}</strong>
          </div>
        </div>
      </div>
      <div className="market-block">
        <span>PIYASA DEGERI</span>
        <strong>{player.marketValues.eur}</strong>
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

const COUNTRY_FLAG_FILES: Record<string, string> = {
  ingiltere: "england",
  england: "england",
  inglitere: "england",
  ispanya: "spain",
  spain: "spain",
  italya: "italy",
  italy: "italy",
  almanya: "germany",
  germany: "germany",
  fransa: "france",
  france: "france",
  turkiye: "turkey",
  turkey: "turkey",
  brezilya: "brazil",
  brazil: "brazil",
  arjantin: "argentina",
  argentina: "argentina",
  portekiz: "portugal",
  portugal: "portugal",
  hollanda: "netherlands",
  netherlands: "netherlands"
};

function CountryFlag({ country, code }: { country: string; code?: string }) {
  const key = normalize(country);
  const file = COUNTRY_FLAG_FILES[key];

  if (file) {
    return <img className="country-flag" src={`/football/countries/${file}-1200x630.png`} alt={country} />;
  }

  if (code && code.length === 2) {
    return (
      <img
        className="country-flag"
        src={`https://flagcdn.com/32x24/${code.toLowerCase()}.png`}
        alt={country}
        onError={(event) => {
          (event.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return null;
}

function PlayerAnalytics({ player }: { player: PlayerProfile }) {
  const stats = useMemo(
    () =>
      buildPlayerStats({
        seed: `${player.id}:${player.slug}`,
        position: player.position,
        age: player.age,
        baseRating: player.attributes.form ? player.attributes.form / 10 : null,
        marketValue: player.marketValue,
        teamName: player.team.name,
        competition: player.team.tournament || "Lig"
      }),
    [player]
  );

  const [selectedSeason, setSelectedSeason] = useState(stats.seasons[0]?.season || "2025/26");

  useEffect(() => {
    setSelectedSeason(stats.seasons[0]?.season || "2025/26");
  }, [stats]);

  const activeSeason = stats.seasons.find((season) => season.season === selectedSeason) || stats.seasons[0];

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
        <MiniStat label="TERCIH AYAK" value={player.preferredFoot} sub="Ayak tercihi" />
        <MiniStat label="SEZON RATING" value={`${stats.seasonRating.toFixed(1)}/10`} sub="Son sezon ort." />
      </div>

      <div className="pitch-position-card pitch-card">
        <div className="table-head">
          <h3>Saha Üzerinde Mevki</h3>
          <span>{player.detailedPosition}</span>
        </div>
        <PitchPosition position={player.position} detailed={player.detailedPosition} />
      </div>

      <div className="radar-card pitch-card">
        <h3>Taktiksel Profil</h3>
        <Radar metrics={metrics.map((metric) => metric.value)} />
      </div>

      <div className="metric-card pitch-card">
        <h3>Detayli Metrikler</h3>
        {stats.detailedMetrics.map((metric) => (
          <DetailedMetricBar key={metric.label} label={metric.label} value={metric.value} raw={metric.raw} />
        ))}
      </div>

      <div className="season-table pitch-card">
        <div className="table-head">
          <h3>Sezon Istatistikleri</h3>
          <select
            className="season-select"
            value={selectedSeason}
            onChange={(event) => setSelectedSeason(event.target.value)}
          >
            {stats.seasons.map((season) => (
              <option key={season.season} value={season.season}>
                {season.season}
              </option>
            ))}
          </select>
        </div>
        {activeSeason ? (
          <div className="season-summary">
            <SeasonStatTile label="Maç" value={String(activeSeason.appearances)} />
            <SeasonStatTile label="Gol" value={String(activeSeason.goals)} />
            <SeasonStatTile label="Asist" value={String(activeSeason.assists)} />
            <SeasonStatTile label="Dakika" value={activeSeason.minutes.toLocaleString("tr-TR")} />
            <SeasonStatTile label="Rating" value={`${activeSeason.rating.toFixed(1)}/10`} highlight />
          </div>
        ) : null}
      </div>

      <div className="recent-matches pitch-card">
        <div className="table-head">
          <h3>Son Oynadığı Maçlar</h3>
          <span>Ortalama {stats.seasonRating.toFixed(1)}/10</span>
        </div>
        <div className="match-list">
          {stats.recentMatches.map((match) => (
            <RecentMatchRow key={match.id} match={match} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PitchPosition({ position, detailed }: { position: string; detailed: string }) {
  // Pozisyona gore sahada vurgulanacak alanlar (top %, left %).
  const zones: Record<string, Array<{ top: number; left: number }>> = {
    G: [{ top: 88, left: 50 }],
    D: [
      { top: 70, left: 22 },
      { top: 72, left: 50 },
      { top: 70, left: 78 }
    ],
    M: [
      { top: 48, left: 30 },
      { top: 45, left: 50 },
      { top: 48, left: 70 }
    ],
    F: [
      { top: 22, left: 32 },
      { top: 18, left: 50 },
      { top: 22, left: 68 }
    ]
  };
  const spots = zones[position] || zones.M;

  return (
    <div className="mini-pitch" aria-label={`${detailed} mevki gorseli`}>
      <div className="mini-pitch-lines" />
      <div className="mini-pitch-circle" />
      <div className="mini-pitch-box top" />
      <div className="mini-pitch-box bottom" />
      {spots.map((spot, index) => (
        <span
          className="mini-pitch-dot"
          key={index}
          style={{ top: `${spot.top}%`, left: `${spot.left}%` }}
        />
      ))}
    </div>
  );
}

function SeasonStatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "season-stat-tile highlight" : "season-stat-tile"}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function RecentMatchRow({ match }: { match: RecentMatch }) {
  return (
    <div className="match-row">
      <span className={`match-result ${match.result === "G" ? "win" : match.result === "M" ? "loss" : "draw"}`}>
        {match.result}
      </span>
      <div className="match-info">
        <strong>
          {match.homeAway === "H" ? "vs" : "@"} {match.opponent}
        </strong>
        <em>
          {match.competition} / {match.date} / {match.score}
        </em>
      </div>
      <div className="match-contrib">
        {match.goals ? <span>{match.goals}G</span> : null}
        {match.assists ? <span>{match.assists}A</span> : null}
        <span>{match.minutes}'</span>
      </div>
      <span className={`match-rating ${match.rating >= 7 ? "good" : match.rating >= 6 ? "mid" : "low"}`}>
        {match.rating.toFixed(1)}
      </span>
    </div>
  );
}

function DetailedMetricBar({ label, value, raw }: { label: string; value: number; raw: string }) {
  return (
    <div className="metric-row detailed">
      <div>
        <span>{label}</span>
        <strong>{raw}</strong>
      </div>
      <div className="metric-track">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PlayerNews({ player, news }: { player: PlayerProfile; news: NewsCard[] }) {
  const tokens = useMemo(() => {
    const parts = normalize(player.name)
      .split(/\s+/)
      .filter((part) => part.length > 2);
    return [...parts, normalize(player.shortName)];
  }, [player]);

  const related = useMemo(() => {
    const matched = news.filter((item) => {
      const haystack = normalize(`${item.title} ${item.summary}`);
      return tokens.some((token) => haystack.includes(token));
    });
    // Oyuncuya ozel haber yoksa genel akistan goster.
    return (matched.length ? matched : news).slice(0, 6);
  }, [news, tokens]);

  return (
    <section className="player-news pitch-card">
      <div className="table-head">
        <h3>{player.name} ile İlgili Haberler</h3>
        <span>{related.length} haber</span>
      </div>
      {related.length ? (
        <div className="player-news-list">
          {related.map((item) => (
            <a
              className={`player-news-item ${item.category}`}
              href={item.sourceUrl}
              key={item.id}
              rel="noreferrer"
              target="_blank"
            >
              {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="news-fallback">{item.category}</span>}
              <div>
                <span className="news-meta">
                  <b>{item.league}</b>
                  <em>@{item.sourceAccount}</em>
                </span>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="player-news-empty">Bu oyuncu için güncel haber akışı bekleniyor.</p>
      )}
    </section>
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
  const [formationName, setFormationName] = useState("4-3-3");
  const slots = useMemo(() => buildFormationSlots(formationName), [formationName]);
  const [selectedSlot, setSelectedSlot] = useState<string>(slots[0].id);
  const [lineupQuery, setLineupQuery] = useState("");
  const [poolPlayers, setPoolPlayers] = useState<PlayerProfile[]>([]);
  const [remoteSearchPlayers, setRemoteSearchPlayers] = useState<PlayerProfile[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const usedIds = Object.values(lineup).filter(Boolean) as number[];
  const selectedSlotMeta = slots.find((slot) => slot.id === selectedSlot) || slots[0];
  const selectedRoleKey = tacticalRoleKey(selectedSlotMeta.label);
  const selectedRolePresets = PLAYER_ROLE_PRESETS[selectedRoleKey] || [];
  const allPoolPlayers = useMemo(
    () => mergePlayers([...poolPlayers, ...remoteSearchPlayers]),
    [poolPlayers, remoteSearchPlayers]
  );
  const selectedSlotPlayer = allPoolPlayers.find((player) => player.id === lineup[selectedSlot]);
  const normalizedLineupQuery = normalize(lineupQuery);
  const activeLineupPlayers = useMemo(
    () =>
      Object.values(lineup)
        .map((id) => allPoolPlayers.find((player) => player.id === id))
        .filter(Boolean) as PlayerProfile[],
    [allPoolPlayers, lineup]
  );
  const activeSquadValue = activeLineupPlayers.reduce((sum, player) => sum + (player.marketValue || 0), 0);
  const activeBudgetDelta = budget - activeSquadValue;
  const activeAvgAge = activeLineupPlayers.length
    ? activeLineupPlayers.reduce((sum, player) => sum + (player.age || 0), 0) / activeLineupPlayers.length
    : 0;
  const activeAvgRating = activeLineupPlayers.length
    ? activeLineupPlayers.reduce((sum, player) => sum + player.metrics.future, 0) / activeLineupPlayers.length
    : 0;

  useEffect(() => {
    let active = true;

    async function loadPool() {
      setPoolLoading(true);
      setPoolError(null);

      try {
        const response = await fetch(`/api/football/player-pool?position=${selectedSlotMeta.role}&limit=90`);
        const data = (await response.json()) as PlayerSearchPayload;
        if (!active) return;

        if (!response.ok) {
          setPoolError(data.error || "Oyuncu havuzu okunamadi.");
          return;
        }

        setPoolPlayers(data.players || []);
      } catch (error) {
        if (active) setPoolError(error instanceof Error ? error.message : "Oyuncu havuzu okunamadi.");
      } finally {
        if (active) setPoolLoading(false);
      }
    }

    loadPool();
    return () => {
      active = false;
    };
  }, [selectedSlotMeta.role]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function searchRemotePlayers() {
      if (lineupQuery.trim().length < 2) {
        setRemoteSearchPlayers([]);
        return;
      }

      setPoolLoading(true);
      setPoolError(null);

      try {
        const response = await fetch(
          `/api/football/player-search?q=${encodeURIComponent(lineupQuery.trim())}&position=${selectedSlotMeta.role}&limit=35`,
          { signal: controller.signal }
        );
        const data = (await response.json()) as PlayerSearchPayload;
        if (!active) return;

        if (!response.ok) {
          setPoolError(data.error || "Canli oyuncu aramasi basarisiz.");
          return;
        }

        setRemoteSearchPlayers(data.players || []);
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setPoolError(error instanceof Error ? error.message : "Canli oyuncu aramasi basarisiz.");
        }
      } finally {
        if (active) setPoolLoading(false);
      }
    }

    const timer = window.setTimeout(searchRemotePlayers, 280);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lineupQuery, selectedSlotMeta.role]);

  useEffect(() => {
    if (!slots.some((slot) => slot.id === selectedSlot)) {
      setSelectedSlot(slots[0].id);
    }
  }, [selectedSlot, slots]);

  const changeFormation = (nextFormation: string) => {
    const nextSlots = buildFormationSlots(nextFormation);
    setFormationName(nextFormation);
    setSelectedSlot(nextSlots[0].id);
    setLineup((current) => {
      const next: Record<string, number | null> = {};
      for (const slot of nextSlots) {
        next[slot.id] = current[slot.id] || null;
      }
      return next;
    });
  };

  const searchablePlayers = allPoolPlayers
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
      if (normalizedLineupQuery) {
        const aStarts = normalize(a.name).startsWith(normalizedLineupQuery) ? 1 : 0;
        const bStarts = normalize(b.name).startsWith(normalizedLineupQuery) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
      }

      const roleScore = roleFitScore(b, selectedSlotMeta.role) - roleFitScore(a, selectedSlotMeta.role);
      if (roleScore) return roleScore;

      const marketOrder = (b.marketValue || 0) - (a.marketValue || 0);
      if (marketOrder) return marketOrder;

      return b.metrics.future - a.metrics.future;
    });

  const assignPlayerToSlot = (slotId: string, playerId: number | null) => {
    setLineup((current) => {
      const next = { ...current };
      const slotMeta = slots.find((slot) => slot.id === slotId) || selectedSlotMeta;
      const targetPlayer = allPoolPlayers.find((player) => player.id === playerId);

      if (playerId && slotMeta.role === "G" && targetPlayer?.position !== "G") {
        return current;
      }

      if (playerId) {
        for (const slotId of Object.keys(next)) {
          if (slotId !== slotMeta.id && next[slotId] === playerId) {
            next[slotId] = null;
          }
        }
      }

      next[slotMeta.id] = playerId;
      return next;
    });
  };
  const assignPlayerToSelectedSlot = (playerId: number | null) => assignPlayerToSlot(selectedSlot, playerId);
  const clearLineup = () => {
    setLineup(
      slots.reduce<Record<string, number | null>>((acc, slot) => {
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
          <select value={formationName} onChange={(event) => changeFormation(event.target.value)}>
            {EAFC_FORMATIONS.map((formation) => (
              <option key={formation.name} value={formation.name}>
                {formation.name}
              </option>
            ))}
          </select>
        </div>
        <div className="lineup-board-head">
          <div>
            <span>TRANSFER ZAMANI BUILDER</span>
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
          {slots.map((slot) => {
            const player = allPoolPlayers.find((item) => item.id === lineup[slot.id]);
            return (
              <LineupSlot
                key={slot.id}
                slot={slot}
                player={player || null}
                selected={selectedSlot === slot.id}
                onSelectSlot={() => setSelectedSlot(slot.id)}
                onDropPlayer={(playerId) => {
                  setSelectedSlot(slot.id);
                  assignPlayerToSlot(slot.id, playerId);
                }}
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
              <p>{POSITION_LABELS[selectedSlotMeta.label] || "Mevki"} / {selectedRolePresets[0] || "Serbest rol"}</p>
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
            <span>{poolLoading ? "Araniyor" : `${searchablePlayers.length} oyuncu`}</span>
          </div>
          {poolError ? <div className="lineup-pool-error">{poolError}</div> : null}
          <div className="lineup-search-results">
            {searchablePlayers.slice(0, 18).map((player) => (
              <button
                className={lineup[selectedSlot] === player.id ? "active" : ""}
                draggable
                key={player.id}
                type="button"
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", String(player.id));
                  event.dataTransfer.effectAllowed = "move";
                }}
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
            {!poolLoading && searchablePlayers.length === 0 ? (
              <div className="lineup-empty-state">
                Oyuncu bulunamadi. En az 2 harf yazarak canli global aramayi deneyin.
              </div>
            ) : null}
          </div>
        </div>
        <div className="glass-panel">
          <div className="panel-title">
            <div>
              <span className="kicker">KADRO DEGERI</span>
              <h2>{formatMoney(activeSquadValue)}</h2>
            </div>
            <CircleDollarSign size={20} />
          </div>
          <div className="budget-track">
            <span style={{ width: `${Math.min((activeSquadValue / budget) * 100, 100)}%` }} />
          </div>
          <p className={activeBudgetDelta >= 0 ? "budget-ok" : "budget-warn"}>
            {activeBudgetDelta >= 0 ? `${formatMoney(activeBudgetDelta)} bosluk var` : `${formatMoney(Math.abs(activeBudgetDelta))} butce asimi`}
          </p>
          {activeBudgetDelta < 0 ? (
            <div className="budget-alert">
              Limit asildi. Kadroyu kaydetmeden once daha dusuk piyasa degerli bir alternatif secin veya butceyi yukselterek devam edin.
            </div>
          ) : null}
        </div>
        <div className="squad-stats">
          <MiniStat label="ORT. YAS" value={activeAvgAge ? activeAvgAge.toFixed(1) : "-"} sub="Ilk 11" />
          <MiniStat label="ORT. SKOR" value={activeAvgRating ? activeAvgRating.toFixed(1) : "-"} sub="Potansiyel" />
          <MiniStat label="POTANSIYEL" value={`${Math.round(activeAvgRating || 0)}/100`} sub="Takim tavan" wide />
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
  onSelectSlot,
  onDropPlayer
}: {
  slot: TacticalSlot;
  player: PlayerProfile | null;
  selected: boolean;
  onSelectSlot: () => void;
  onDropPlayer: (playerId: number) => void;
}) {
  return (
    <div
      className={`lineup-slot slot-${slot.id} ${selected ? "selected" : ""}`}
      style={{ top: `${slot.top}%`, left: `${slot.left}%` }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const playerId = Number(event.dataTransfer.getData("text/plain"));
        if (playerId) onDropPlayer(playerId);
      }}
    >
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
  player: Pick<PlayerProfile, "id" | "name" | "initials" | "imageUrl">;
  size: "sm" | "md" | "xl" | "hero" | "feature" | "lineup";
}) {
  const searchFallback = `/api/image/player-search/${encodeURIComponent(player.name)}`;
  const fotMobFallback = player.id > 0 ? `https://images.fotmob.com/image_resources/playerimages/${player.id}.png` : "";
  const [src, setSrc] = useState(player.imageUrl);
  const [fallbackStep, setFallbackStep] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(player.imageUrl);
    setFallbackStep(0);
    setFailed(false);
  }, [player.imageUrl]);

  return (
    <span className={`avatar avatar-${size}`} aria-label={player.name}>
      <span>{player.initials}</span>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (fallbackStep === 0 && fotMobFallback && src !== fotMobFallback) {
              setFallbackStep(1);
              setSrc(fotMobFallback);
              return;
            }
            if (fallbackStep <= 1 && src !== searchFallback) {
              setFallbackStep(2);
              setSrc(searchFallback);
              return;
            }
            setFailed(true);
          }}
        />
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

  const pools = {
    F: players.filter((player) => player.position === "F").sort(sortRosterPlayers),
    M: players.filter((player) => player.position === "M").sort(sortRosterPlayers),
    D: players.filter((player) => player.position === "D").sort(sortRosterPlayers),
    G: players.filter((player) => player.position === "G").sort(sortRosterPlayers)
  };
  const usedByRole = { F: 0, M: 0, D: 0, G: 0 };

  return lineupSlots.reduce<Record<string, number | null>>((acc, slot) => {
    const role = slot.role;
    const index = usedByRole[role];
    acc[slot.id] = pools[role][index]?.id || null;
    usedByRole[role] += 1;
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

function mergePlayers(players: PlayerProfile[]) {
  const map = new Map<number, PlayerProfile>();
  for (const player of players) {
    map.set(player.id, player);
  }
  return Array.from(map.values());
}

function sortRosterPlayers(a: PlayerProfile, b: PlayerProfile) {
  const positionOrder = positionWeight(a.position) - positionWeight(b.position);
  if (positionOrder) return positionOrder;

  const roleOrder = (a.squadRole === "starter" ? 0 : 1) - (b.squadRole === "starter" ? 0 : 1);
  if (roleOrder) return roleOrder;

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
