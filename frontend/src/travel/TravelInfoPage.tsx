import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Keyboard, Moon, Sun } from "lucide-react";
import { fetchNetwork } from "../api";
import { formatPlaceName, fullPlaceName } from "../format";
import { Theme } from "../theme";
import { AnimatedTrain, Line, Station, Status } from "../types";
import { JourneyPlanner } from "./JourneyPlanner";
import { LineDiagram } from "./LineDiagram";
import { NetworkStatus } from "./NetworkStatus";
import { SearchBox } from "./SearchBox";
import { StationBoard } from "./StationBoard";
import { StationClock } from "./StationClock";
import { StationIndex } from "./StationIndex";
import { nearestStations } from "./search";
import { clearRecent, loadFavourites, loadPrefs, loadRecent, pushRecent, savePrefs, toggleFavourite, TravelPrefs } from "./storage";
import { clockWithSeconds } from "./time";
import { NetworkLine } from "./types";
import { Crest, Section } from "./ui";
import { readParams, resolveStation, writeParams } from "./url";

export interface TravelInfoPageProps {
  stations: Station[];
  lines: Line[];
  trains: AnimatedTrain[];
  status: Status | null;
  theme: Theme;
  onToggleTheme: () => void;
  /** Back to the map, handing over the station being viewed (if any) so the
   *  map can show it. */
  onClose: (station: Station | null) => void;
  onShowOnMap: (station: Station) => void;
}

type Tab = "vertrekken" | "plannen" | "lijnen" | "stations" | "status";
const TABS: { id: Tab; label: string }[] = [
  { id: "vertrekken", label: "Vertrekken" },
  { id: "plannen", label: "Plannen" },
  { id: "lijnen", label: "Lijnen" },
  { id: "stations", label: "Stations" },
  { id: "status", label: "Status" },
];
const DEFAULT_STATION = "Amsterdam, Centraal Station";

export default function TravelInfoPage({ stations, lines, trains, status, theme, onToggleTheme, onClose, onShowOnMap }: TravelInfoPageProps) {
  const initial = useMemo(() => readParams(window.location.search), []);
  const [stationName, setStationName] = useState<string | null>(null);
  const [fromName, setFromName] = useState<string | null>(null);
  const [toName, setToName] = useState<string | null>(null);
  const [lineId, setLineId] = useState<string>(initial.line ?? "52");
  const [tab, setTab] = useState<Tab>(initial.from && initial.to ? "plannen" : "vertrekken");
  const [prefs, setPrefsState] = useState<TravelPrefs>(loadPrefs);
  const [favourites, setFavourites] = useState<string[]>(loadFavourites);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [network, setNetwork] = useState<NetworkLine[] | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  // State, not a ref: the address bar may only be rewritten once the values
  // from the link have been applied, or it would briefly drop them.
  const [ready, setReady] = useState(false);

  const byName = useMemo(() => new Map(stations.map((s) => [s.name, s])), [stations]);
  const station = stationName ? byName.get(stationName) ?? null : null;
  const from = fromName ? byName.get(fromName) ?? null : null;
  const to = toName ? byName.get(toName) ?? null : null;
  const lineIds = useMemo(() => lines.map((l) => l.id), [lines]);
  const colorOf = useCallback((id: string) => lines.find((l) => l.id === id)?.color ?? "#999999", [lines]);

  // Resolve the link once stations have loaded; never leave the board empty.
  useEffect(() => {
    if (ready || stations.length === 0) return;
    const s =
      resolveStation(initial.station, stations) ??
      [...loadFavourites(), ...loadRecent()].map((n) => byName.get(n)).find(Boolean) ??
      byName.get(DEFAULT_STATION) ??
      stations[0];
    setStationName(s?.name ?? null);
    setFromName(resolveStation(initial.from, stations)?.name ?? null);
    setToName(resolveStation(initial.to, stations)?.name ?? null);
    if (!initial.line && s?.lines[0]) setLineId(s.lines.includes("52") ? "52" : s.lines[0]);
    setReady(true);
  }, [stations, initial, byName, ready]);

  // Keep the address bar shareable without adding history entries.
  useEffect(() => {
    if (!ready) return;
    const qs = writeParams({ station, from, to, line: lineId });
    window.history.replaceState(window.history.state, "", `/reisinfo${qs}`);
  }, [ready, station, from, to, lineId]);

  useEffect(() => {
    document.title = station
      ? `${fullPlaceName(station.name)} — vertrektijden | Metro Amsterdam Live`
      : "Reisinformatie — Metro Amsterdam Live";
  }, [station]);

  // Tick just after each whole second, not every 1000 ms from mount: a free
  // interval drifts against the second boundary and the clocks then skip or
  // repeat a second. Background tabs throttle timers (to once a minute in
  // Chrome), so catch up as soon as the page is visible again.
  useEffect(() => {
    let id: number;
    const tick = () => {
      setNowMs(Date.now());
      id = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 20);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(id);
      tick();
    };
    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // The link that opened the page is now behind it (inert), so focus would be
  // lost; put it on the page, which also lets arrows and space scroll it.
  useEffect(() => {
    pageRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let stop = false;
    let delay = 2000;
    let timer: number | undefined;
    const load = () =>
      fetchNetwork()
        .then((n) => !stop && setNetwork(n))
        .catch(() => {
          if (stop) return;
          timer = window.setTimeout(load, delay);
          delay = Math.min(delay * 2, 30000);
        });
    load();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const selectStation = useCallback(
    (name: string) => {
      const s = byName.get(name);
      if (!s) return;
      setStationName(name);
      setRecent(pushRecent(name));
      setTab("vertrekken");
      if (!s.lines.includes(lineId)) setLineId(s.lines[0]);
    },
    [byName, lineId],
  );

  const setPrefs = (p: TravelPrefs) => {
    setPrefsState(p);
    savePrefs(p);
  };

  const locate = (apply: (s: Station) => void) => {
    if (!("geolocation" in navigator)) {
      setToast("Uw browser kan geen locatie bepalen.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const [near] = nearestStations(pos.coords.latitude, pos.coords.longitude, stations, 1);
        if (!near) return;
        apply(near.station);
        const km = near.meters >= 1000 ? `${(near.meters / 1000).toFixed(1)} km` : `${Math.round(near.meters / 10) * 10} m`;
        setToast(`Dichtstbijzijnde station: ${formatPlaceName(near.station.name)} (${km})`);
      },
      (err) => {
        setLocating(false);
        // Denied also covers a non-HTTPS page and a blocking Permissions-Policy.
        setToast(
          err.code === err.PERMISSION_DENIED
            ? "Geen toestemming voor uw locatie — sta die toe in de browser of kies zelf een station."
            : err.code === err.TIMEOUT
              ? "Uw locatie bepalen duurde te lang — probeer het opnieuw of kies zelf een station."
              : "Uw locatie is nu niet te bepalen — kies zelf een station.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // dismissed by the user
      }
    }
    // navigator.clipboard is missing outside HTTPS and may be refused; say so
    // instead of failing silently.
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link gekopieerd.");
    } catch {
      setToast("Kopiëren lukte niet — kopieer de link uit de adresbalk.");
    }
  };

  // Keyboard: "/" search, "f" favourite, "p" planner, "?" help, Esc back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA");
      if (e.key === "Escape" && !typing) {
        if (help) setHelp(false);
        else onClose(station);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || e.repeat || !prefs.shortcuts) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "f" && station) {
        setFavourites(toggleFavourite(station.name));
      } else if (e.key === "p") {
        setTab("plannen");
        document.getElementById("reisplanner")?.querySelector("input")?.focus();
      } else if (e.key === "?") {
        setHelp((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [help, onClose, station, prefs.shortcuts]);

  const showTab = (t: Tab) => (tab === t ? "" : "hidden lg:block");

  return (
    <div ref={pageRef} tabIndex={-1} className="travel-page fixed inset-0 z-50 overflow-y-auto overscroll-contain outline-none bg-[#f3eee3] text-[#1d2433] dark:bg-[#0a0e18] dark:text-[#e3ddcf]">
      {/* Masthead */}
      <header className="sticky top-0 z-20 border-b border-[#d8cfbd] bg-[#f3eee3]/95 backdrop-blur dark:border-[#232b3e] dark:bg-[#0a0e18]/95">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-2 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:flex-nowrap">
          <div className="flex min-w-0 items-center gap-2.5">
            <Crest colors={lines.map((l) => l.color)} className="h-11 w-9 shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="smallcaps truncate text-[11px] font-semibold text-[#7b2132] dark:text-[#c8a951]">Metro Amsterdam Live</p>
              <h1 className="font-academic truncate text-xl font-semibold sm:text-2xl">Reisinformatie</h1>
            </div>
          </div>
          <div className="order-last w-full lg:order-none lg:max-w-xl lg:flex-1">
            <SearchBox
              label="Zoek een station, lijn of reis"
              placeholder="Zoek station, lijn of ‘noord naar gein’…"
              stations={stations}
              lineIds={lineIds}
              colorOf={colorOf}
              inputRef={searchRef}
              onStation={(s) => selectStation(s.name)}
              onLine={(l) => {
                setLineId(l);
                setTab("lijnen");
                document.getElementById("lijnoverzicht")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onRoute={(f, t) => {
                setFromName(f.name);
                setToName(t.name);
                setTab("plannen");
                document.getElementById("reisplanner")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onNearby={() => locate((s) => selectStation(s.name))}
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <StationClock nowMs={nowMs} className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
            <div className="hidden text-right leading-tight sm:block">
              <div className="font-academic text-lg font-semibold tabular-nums">{clockWithSeconds(nowMs)}</div>
              <div className="flex items-center justify-end gap-1 text-[10px] text-[#7a7262] dark:text-[#8b93a7]">
                <span className={`h-1.5 w-1.5 rounded-full ${status?.is_live ? "animate-pulse bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
                {status?.is_live ? "live gegevens" : "dienstregeling"} · Amsterdamse tijd
              </div>
            </div>
            {/* Visible on phones too, unlike the shortcuts button: the map's
                style picker is out of reach from this page. */}
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === "dark" ? "Lichte weergave" : "Donkere weergave"}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d8cfbd] text-[#1f3a68] hover:bg-[#ebe4d4] dark:border-[#2a3245] dark:text-[#c8a951] dark:hover:bg-[#151c2e]"
            >
              {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
              <span className="sr-only">{theme === "dark" ? "Lichte weergave" : "Donkere weergave"}</span>
            </button>
            <button
              type="button"
              onClick={() => setHelp((h) => !h)}
              aria-expanded={help}
              title="Sneltoetsen en uitleg (?)"
              className="hidden h-9 w-9 items-center justify-center rounded-md border border-[#d8cfbd] text-[#1f3a68] hover:bg-[#ebe4d4] sm:flex dark:border-[#2a3245] dark:text-[#c8a951] dark:hover:bg-[#151c2e]"
            >
              <Keyboard size={16} />
              <span className="sr-only">Sneltoetsen</span>
            </button>
            <button
              type="button"
              onClick={() => onClose(station)}
              className="flex h-9 items-center gap-1.5 rounded-md bg-[#4363D8] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#3651b8]"
            >
              <ArrowLeft size={16} aria-hidden /> Kaart
            </button>
          </div>
        </div>
        {/* Mobile section tabs */}
        <nav className="mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Onderdelen">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                tab === t.id ? "bg-[#1f3a68] text-white dark:bg-[#c8a951] dark:text-[#111727]" : "bg-[#e9e2d2] text-[#3b4457] dark:bg-[#151c2e] dark:text-[#c9c3b4]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {help && (
        <HelpPanel
          shortcuts={prefs.shortcuts}
          onShortcuts={(on) => setPrefs({ ...prefs, shortcuts: on })}
          onClose={() => setHelp(false)}
        />
      )}

      <main className="mx-auto grid max-w-[1680px] gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:grid-cols-[16.5rem_minmax(0,1fr)_21rem] xl:grid-cols-[17.5rem_minmax(0,1fr)_23rem]">
        <div className={`${showTab("stations")} lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto`}>
          <StationIndex
            stations={stations}
            lineIds={lineIds}
            colorOf={colorOf}
            current={station}
            favourites={favourites}
            recent={recent}
            locating={locating}
            onStation={selectStation}
            onNearby={() => locate((s) => selectStation(s.name))}
            onClearRecent={() => setRecent(clearRecent())}
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div className={showTab("vertrekken")}>
            {station ? (
              <StationBoard
                station={station}
                colorOf={colorOf}
                trains={trains}
                prefs={prefs}
                onPrefs={setPrefs}
                nowMs={nowMs}
                favourite={favourites.includes(station.name)}
                onToggleFavourite={() => setFavourites(toggleFavourite(station.name))}
                onShare={share}
                onShowOnMap={() => onShowOnMap(station)}
                onPlanFrom={() => {
                  setFromName(station.name);
                  setTab("plannen");
                  document.getElementById("reisplanner")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onStation={selectStation}
              />
            ) : (
              <Section n={2} title="Vertrekstaat">
                <p className="text-sm">Stations laden…</p>
              </Section>
            )}
          </div>
          <div className={showTab("lijnen")}>
            <LineDiagram
              network={network}
              lineId={lineId}
              onLine={setLineId}
              trains={trains}
              stations={stations}
              colorOf={colorOf}
              current={station}
              onStation={selectStation}
              nowMs={nowMs}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-3 lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto">
          <div className={showTab("plannen")}>
            <JourneyPlanner
              stations={stations}
              lineIds={lineIds}
              colorOf={colorOf}
              from={from}
              to={to}
              current={station}
              onFrom={(s) => setFromName(s?.name ?? null)}
              onTo={(s) => setToName(s?.name ?? null)}
              onStation={selectStation}
              onNearby={() => locate((s) => setFromName(s.name))}
              nowMs={nowMs}
            />
          </div>
          <div className={showTab("status")}>
            <NetworkStatus
              lines={lines}
              trains={trains}
              status={status}
              onLine={(l) => {
                setLineId(l);
                setTab("lijnen");
              }}
            />
          </div>
          <div className="hidden lg:block">
            <Legend />
          </div>
        </div>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 rounded-md bg-[#1d2433] px-4 py-2 text-sm text-white shadow-lg dark:bg-[#ece6d6] dark:text-[#111727]">
          {toast}
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <Section n={6} title="Verklaring">
      <ul className="space-y-1 text-[11px] leading-snug text-[#4a4436] dark:text-[#b9bfcc]">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> live gevolgd via GTFS-realtime
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#b8ae99]" /> volgens dienstregeling (geen live signaal)
        </li>
        <li>
          <span className="font-semibold text-amber-700 dark:text-amber-400">+2 min</span> vertraging ·{" "}
          <span className="text-[#9a9384] line-through">12:03</span> geplande tijd
        </li>
        <li>
          <span className="font-semibold text-[#b42335] dark:text-[#f08a9b]">Vervallen</span> rit rijdt niet
        </li>
        <li>Alle tijden in Amsterdamse tijd. Gegevens: GVB via OVapi, elke 30 s ververst.</li>
      </ul>
    </Section>
  );
}

function HelpPanel(props: { shortcuts: boolean; onShortcuts: (on: boolean) => void; onClose: () => void }) {
  const keys: [string, string][] = [
    ["/", "zoeken"],
    ["F", "station als favoriet"],
    ["P", "naar de reisplanner"],
    ["?", "deze uitleg"],
    ["Esc", "terug naar de kaart"],
  ];
  return (
    <div className="mx-auto max-w-[1680px] px-3 pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-[#d8cfbd] bg-[#fffdf8] px-3 py-2 text-xs dark:border-[#2a3245] dark:bg-[#111727]">
        <span className="smallcaps font-semibold text-[#7b2132] dark:text-[#c8a951]">Sneltoetsen</span>
        {keys.map(([k, v]) => (
          <span key={k}>
            <kbd className="rounded border border-[#cfc4ad] bg-white px-1 font-sans dark:border-[#33405c] dark:bg-[#0d1322]">{k}</kbd> {v}
          </span>
        ))}
        <span className="text-[#7a7262] dark:text-[#8b93a7]">Zoeken begrijpt ook “arena”, “52”, “cs naar zuid” en “dichtbij”.</span>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={props.shortcuts}
            onChange={(e) => props.onShortcuts(e.target.checked)}
            className="accent-[#1f3a68] dark:accent-[#c8a951]"
          />
          Lettertoetsen gebruiken
        </label>
        <button type="button" onClick={props.onClose} className="ml-auto font-semibold text-[#1f3a68] hover:underline dark:text-[#c8a951]">
          Sluiten
        </button>
      </div>
    </div>
  );
}
