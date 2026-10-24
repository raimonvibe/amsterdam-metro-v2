import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { useAlerts } from "./hooks/useAlerts";
import { AlertAnnouncer } from "./components/AlertList";
import { strings, useT } from "./i18n";
import { MetroMap, NO_HOVER } from "./components/MetroMap";
import { Sidebar } from "./components/Sidebar";
import { LiveBadge } from "./components/LiveBadge";
import { DepartureBoard } from "./components/DepartureBoard";
import { FollowChip } from "./components/FollowChip";
import { fetchLines, fetchShapes, fetchStations } from "./api";
import { AnimatedTrain, Line, ShapeGeom, Station, Status } from "./types";
import { MAP_STYLES, useMapStyle, useThemeToggle } from "./theme";
import { streamWhileVisible } from "./stream";
import { usePrivacyRoute } from "./hooks/usePrivacyRoute";
import { useTravelRoute } from "./hooks/useTravelRoute";
import { formatPlaceName } from "./format";
import { useSidebarOpen } from "./hooks/useSidebarOpen";
import { ChunkErrorBoundary } from "./components/ChunkErrorBoundary";

// Rarely opened; kept out of the initial bundle.
const PrivacyPolicy = lazy(() =>
  import("./components/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })),
);
// The travel-info page is a separate chunk: map visitors never download it.
const TravelInfoPage = lazy(() => import("./travel/TravelInfoPage"));

// Require a few consecutive empty snapshots before actually clearing the
// map: metro service does legitimately stop overnight, but a single empty
// one is more likely a transient backend hiccup (e.g. mid-refresh) than
// every train vanishing at once.
const EMPTY_SNAPSHOTS_BEFORE_CLEAR = 3;
const STATIC_RETRY_MIN_MS = 2000;
const STATIC_RETRY_MAX_MS = 30000;

export default function App() {
  const [mapStyle, setMapStyle] = useMapStyle();
  const { palette, styleUrl, swatch } = MAP_STYLES[mapStyle];
  const toggleTheme = useThemeToggle(mapStyle, setMapStyle);
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [shapes, setShapes] = useState<Record<string, ShapeGeom>>({});
  const [trains, setTrains] = useState<AnimatedTrain[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [followedTrainId, setFollowedTrainId] = useState<string | null>(null);
  // Followed from a list (the station card) rather than the map itself.
  const [followedFromList, setFollowedFromList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showPrivacy, openPrivacy, closePrivacy } = usePrivacyRoute();
  const { showTravel, openTravel, closeTravel } = useTravelRoute();
  // Bumped to ask the map to fly to a station (from "Op kaart").
  const [focusStation, setFocusStation] = useState<{ station: Station; nonce: number } | null>(null);
  // The camera follows the visitor's latest explicit choice: following a train
  // and flying to a station are exclusive, or the follow-cam (which re-centres
  // on its train every 0.7 s) pulls the map straight back from the station.
  const flyToStation = (station: Station) => {
    setFollowedTrainId(null);
    setFocusStation({ station, nonce: Date.now() });
  };
  const [sidebarOpen, openSidebar, closeSidebar] = useSidebarOpen();
  const alerts = useAlerts();
  const txt = useT();
  // Phones: the sidebar is a drawer over the map. Left open from before the
  // travel page, it would be all one sees on the way back, so close it on
  // every return (page buttons and the browser's back button alike).
  const wasTravel = useRef(showTravel);
  useEffect(() => {
    if (wasTravel.current && !showTravel && window.matchMedia("(max-width: 47.99rem)").matches) closeSidebar();
    wasTravel.current = showTravel;
  }, [showTravel, closeSidebar]);
  // Open /reisinfo on the station selected on the map, if any; otherwise the
  // page falls back to a favourite, a recent station or CS.
  const openTravelForSelection = () =>
    openTravel(selectedStation ? `?station=${encodeURIComponent(formatPlaceName(selectedStation.name))}` : "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The travel page handles its own Escape (help panel, back to the map);
      // it must not also drop the map's selection and followed train.
      if (showTravel) return;
      if (e.key === "Escape") {
        if (showPrivacy) {
          closePrivacy();
          return;
        }
        setFollowedTrainId(null);
        setSelectedStation(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPrivacy, closePrivacy, showTravel]);

  // Tracks, stations and shapes: everything else is drawn on top of them, so
  // keep retrying (backoff) until they arrive — the backend may still be
  // loading GTFS after a deploy, or briefly unreachable.
  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    let delay = STATIC_RETRY_MIN_MS;
    const load = async () => {
      try {
        const [l, s, sh] = await Promise.all([
          fetchLines(),
          fetchStations(),
          fetchShapes(),
        ]);
        if (stop) return;
        setLines(l);
        setStations(s);
        setShapes(sh);
        setVisibleLines(l.map((x) => x.id));
        setError(null);
      } catch {
        if (stop) return;
        setError(strings().backendError);
        timer = window.setTimeout(load, delay);
        delay = Math.min(delay * 2, STATIC_RETRY_MAX_MS);
      }
    };
    load();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Trains and status arrive together on one server-sent event stream
  // (pushed every 5s). On a dropped connection the last state stays drawn.
  useEffect(() => {
    let emptyStreak = 0;
    return streamWhileVisible(({ trains: t, status: s, asOf }) => {
      if (t.length === 0) {
        emptyStreak += 1;
        if (emptyStreak >= EMPTY_SNAPSHOTS_BEFORE_CLEAR) setTrains([]);
      } else {
        emptyStreak = 0;
        setTrains(t.map((x) => ({ ...x, fetchedAt: asOf })));
      }
      setStatus(s);
      setLastUpdated(new Date());
    });
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      document.body.style.overflow = "";
      mq.removeEventListener("change", sync);
    };
  }, [sidebarOpen]);

  const toggleLine = (id: string) =>
    setVisibleLines((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* First Tab stop: the text version of what the map shows. Hidden until
          focused, so the map looks the same for everyone else. */}
      <nav aria-label={txt.textVersion} className="contents">
      <a
        href="/reisinfo"
        inert={showTravel}
        onClick={(e) => {
          e.preventDefault();
          openTravelForSelection();
        }}
        // not-sr-only resets padding to 0, so the focused padding is set after it.
        className="sr-only z-[70] rounded-lg bg-[#1f3a68] text-sm font-semibold text-white shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:px-4 focus:py-2.5"
      >
        {txt.textVersion}
      </a>
      </nav>
      <div
        aria-hidden={!sidebarOpen}
        className={`pointer-events-none fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ease-in-out md:hidden ${
          sidebarOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Behind a full-screen page the map and sidebar stay mounted (the page
          uses their live trains) but must not be reachable by Tab or a screen reader.
          Neither may a closed sidebar: it is off-screen, and focus would vanish into it. */}
      <div
        inert={showTravel || !sidebarOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)))] max-w-[min(18rem,100vw)] overflow-hidden transition-transform duration-300 ease-in-out md:static md:z-auto md:max-w-none md:shrink-0 md:overflow-hidden md:transition-[width] md:duration-300 md:ease-in-out ${
          sidebarOpen
            ? "translate-x-0 md:w-72"
            : "-translate-x-full md:translate-x-0 md:w-0"
        }`}
      >
        <Sidebar
          lines={lines}
          visibleLines={visibleLines}
          onToggleLine={toggleLine}
          trains={trains}
          status={status}
          hoveredStation={hoveredStation}
          lastUpdated={lastUpdated}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
          onOpenPrivacy={openPrivacy}
          onOpenTravel={openTravelForSelection}
          onClose={closeSidebar}
          alerts={alerts}
          stations={stations}
          onPickStation={(s) => {
            setSelectedStation(s);
            flyToStation(s);
            // Phones: the drawer covers the map and the departure card.
            if (window.matchMedia("(max-width: 47.99rem)").matches) closeSidebar();
          }}
        />
      </div>
      <main inert={showTravel} className="relative min-h-0 min-w-0 flex-1">
        <button
          type="button"
          onClick={openSidebar}
          title={txt.menu}
          aria-label={txt.menu}
          aria-hidden={sidebarOpen}
          tabIndex={sidebarOpen ? -1 : 0}
          className={`absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-[#4363D8] px-3.5 py-2 text-sm font-semibold text-white shadow-md transition-[opacity,transform,background-color,box-shadow] duration-300 ease-in-out hover:bg-[#3651b8] hover:shadow-lg dark:border-gray-700 dark:bg-[#4363D8]/40 dark:text-blue-100 dark:hover:bg-[#4363D8]/55 ${
            sidebarOpen
              ? "pointer-events-none translate-x-2 opacity-0"
              : "translate-x-0 opacity-100"
          }`}
        >
          <PanelLeftOpen size={18} strokeWidth={2.25} />
          <span className="hidden sm:inline">{txt.menu}</span>
        </button>
        {error && (
          <div className="absolute inset-x-0 top-0 z-10 bg-red-900/90 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sm">
            {error}
          </div>
        )}
        <MetroMap
          lines={lines}
          stations={stations}
          trains={trains}
          shapes={shapes}
          visibleLines={visibleLines}
          theme={palette}
          styleUrl={styleUrl}
          backdropColor={swatch[0]}
          followedTrainId={followedTrainId}
          onStationHover={setHoveredStation}
          onTrainClick={(t) => {
            setFollowedFromList(false);
            setFollowedTrainId(t.id);
          }}
          showFollowedCard={followedFromList}
          onStationClick={(s) => {
            // Picking a station is a new choice: stop following, or the
            // follow-cam carries the map away from the station just opened.
            if (selectedStation?.name !== s.name) setFollowedTrainId(null);
            setSelectedStation((cur) => (cur?.name === s.name ? null : s));
          }}
          onStopFollow={() => setFollowedTrainId(null)}
          focusStation={focusStation}
          // A tap on empty map closes the drawer first, else stops following a
          // train: on a phone there is no hover to end its popup.
          onMapBackgroundClick={sidebarOpen ? closeSidebar : followedTrainId ? () => setFollowedTrainId(null) : undefined}
          paused={showTravel}
        />
        <LiveBadge status={status} />
        <AlertAnnouncer alerts={alerts} />
        {selectedStation && (
          <DepartureBoard
            station={selectedStation}
            lines={lines}
            alerts={alerts}
            followable={new Set(trains.map((t) => t.id))}
            live={status?.is_live !== false}
            onFollow={(id) => {
              setFollowedFromList(true);
              setFollowedTrainId(id);
              setSelectedStation(null);
            }}
            onClose={() => setSelectedStation(null)}
            onMore={openTravelForSelection}
          />
        )}
        {/* Touch screens: the followed train's popup has its own close button
            and sits where this chip is, so the chip would only peek out
            behind it. Desktop keeps it: there the popup ends with the hover. */}
        {followedTrainId &&
          !NO_HOVER &&
          (() => {
            const train = trains.find((t) => t.id === followedTrainId);
            return train ? (
              <FollowChip
                train={train}
                lines={lines}
                onStop={() => setFollowedTrainId(null)}
              />
            ) : null;
          })()}
      </main>
      {showTravel && (
        <ChunkErrorBoundary onClose={closeTravel}>
          <Suspense
            fallback={
              // Same backdrop as the page, so the map never flashes through
              // while the page's chunk loads.
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f3eee3] text-sm text-[#5b5446] dark:bg-[#0a0e18] dark:text-[#a9b0c2]">
                <span className="font-academic animate-pulse text-lg">{txt.travelInfoLoading}</span>
              </div>
            }
          >
            <TravelInfoPage
              stations={stations}
              lines={lines}
              trains={trains}
              status={status}
              theme={palette}
              onToggleTheme={toggleTheme}
              alerts={alerts}
              onClose={(station) => {
                closeTravel();
                // Land on the station the visitor chose on the page, without
                // opening its departures card ("Op kaart" does that). No
                // station chosen: the map stays as it was, following included.
                if (station) flyToStation(station);
              }}
              onShowOnMap={(station) => {
                closeTravel();
                setSelectedStation(station);
                flyToStation(station);
              }}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}
      {showPrivacy && (
        <Suspense fallback={null}>
          <PrivacyPolicy onClose={closePrivacy} />
        </Suspense>
      )}
    </div>
  );
}
