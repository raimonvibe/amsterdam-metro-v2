import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { MetroMap } from "./components/MetroMap";
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
import { nl } from "./i18n/nl";

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
  const [error, setError] = useState<string | null>(null);
  const { showPrivacy, openPrivacy, closePrivacy } = usePrivacyRoute();
  const { showTravel, openTravel, closeTravel } = useTravelRoute();
  // Bumped to ask the map to fly to a station (from "Op kaart").
  const [focusStation, setFocusStation] = useState<{ station: Station; nonce: number } | null>(null);
  const [sidebarOpen, openSidebar, closeSidebar] = useSidebarOpen();
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
  }, [showPrivacy, closePrivacy]);

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
        setError(nl.backendError);
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
      <div
        aria-hidden={!sidebarOpen}
        className={`pointer-events-none fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ease-in-out md:hidden ${
          sidebarOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Behind a full-screen page the map and sidebar stay mounted (the page
          uses their live trains) but must not be reachable by Tab or a screen reader. */}
      <div
        inert={showTravel}
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
        />
      </div>
      <main inert={showTravel} className="relative min-h-0 min-w-0 flex-1">
        <button
          type="button"
          onClick={openSidebar}
          title={nl.menu}
          aria-label={nl.menu}
          aria-hidden={sidebarOpen}
          tabIndex={sidebarOpen ? -1 : 0}
          className={`absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-[#4363D8] px-3.5 py-2 text-sm font-semibold text-white shadow-md transition-[opacity,transform,background-color,box-shadow] duration-300 ease-in-out hover:bg-[#3651b8] hover:shadow-lg dark:border-gray-700 dark:bg-[#4363D8]/40 dark:text-blue-100 dark:hover:bg-[#4363D8]/55 ${
            sidebarOpen
              ? "pointer-events-none translate-x-2 opacity-0"
              : "translate-x-0 opacity-100"
          }`}
        >
          <PanelLeftOpen size={18} strokeWidth={2.25} />
          <span className="hidden sm:inline">{nl.menu}</span>
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
          onTrainClick={(t) => setFollowedTrainId(t.id)}
          onStationClick={(s) =>
            setSelectedStation((cur) => (cur?.name === s.name ? null : s))
          }
          onStopFollow={() => setFollowedTrainId(null)}
          focusStation={focusStation}
          // A tap on empty map closes the drawer first, else stops following a
          // train: on a phone there is no hover to end its popup.
          onMapBackgroundClick={sidebarOpen ? closeSidebar : followedTrainId ? () => setFollowedTrainId(null) : undefined}
          paused={showTravel}
        />
        <LiveBadge status={status} />
        {selectedStation && (
          <DepartureBoard
            station={selectedStation}
            lines={lines}
            onClose={() => setSelectedStation(null)}
            onMore={openTravelForSelection}
          />
        )}
        {followedTrainId &&
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
                <span className="font-academic animate-pulse text-lg">{nl.travelInfo} laden…</span>
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
              onClose={(station) => {
                closeTravel();
                // Land on the station the visitor was looking at, without
                // opening its departures card ("Op kaart" does that).
                if (station) setFocusStation({ station, nonce: Date.now() });
              }}
              onShowOnMap={(station) => {
                closeTravel();
                setSelectedStation(station);
                setFocusStation({ station, nonce: Date.now() });
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
