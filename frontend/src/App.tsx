import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { MetroMap } from "./components/MetroMap";
import { Sidebar } from "./components/Sidebar";
import { LiveBadge } from "./components/LiveBadge";
import { DepartureBoard } from "./components/DepartureBoard";
import { FollowChip } from "./components/FollowChip";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import {
  fetchLines,
  fetchShapes,
  fetchStations,
  fetchStatus,
  fetchTrains,
} from "./api";
import { AnimatedTrain, Line, ShapeGeom, Station, Status } from "./types";
import { useTheme } from "./theme";
import { usePrivacyRoute } from "./hooks/usePrivacyRoute";
import { useSidebarOpen } from "./hooks/useSidebarOpen";
import { nl } from "./i18n/nl";

const TRAINS_POLL_MS = 5000;
const STATUS_POLL_MS = 30000;

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [shapes, setShapes] = useState<Record<string, ShapeGeom>>({});
  const [trains, setTrains] = useState<AnimatedTrain[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hoveredTrain, setHoveredTrain] = useState<AnimatedTrain | null>(null);
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [followedTrainId, setFollowedTrainId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showPrivacy, openPrivacy, closePrivacy } = usePrivacyRoute();
  const [sidebarOpen, openSidebar, closeSidebar] = useSidebarOpen();

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

  useEffect(() => {
    (async () => {
      try {
        const [l, s, sh] = await Promise.all([
          fetchLines(),
          fetchStations(),
          fetchShapes(),
        ]);
        setLines(l);
        setStations(s);
        setShapes(sh);
        setVisibleLines(l.map((x) => x.id));
        setError(null);
      } catch {
        setError(nl.backendError);
      }
    })();
  }, []);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const t = await fetchTrains();
        if (stop) return;
        const fetchedAt = Date.now();
        setTrains(t.map((x) => ({ ...x, fetchedAt })));
        setLastUpdated(new Date());
        setError(null);
      } catch {
        /* transient; keep last state */
      }
    };
    poll();
    const id = setInterval(poll, TRAINS_POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const s = await fetchStatus();
        if (!stop) setStatus(s);
      } catch {
        /* transient */
      }
    };
    poll();
    const id = setInterval(poll, STATUS_POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
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
      <button
        type="button"
        aria-label={nl.menuClose}
        aria-hidden={!sidebarOpen}
        tabIndex={sidebarOpen ? 0 : -1}
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ease-in-out md:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeSidebar}
      />
      <div
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
          hoveredTrain={hoveredTrain}
          hoveredStation={hoveredStation}
          lastUpdated={lastUpdated}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenPrivacy={openPrivacy}
          onClose={closeSidebar}
        />
      </div>
      <main className="relative min-h-0 min-w-0 flex-1">
        <button
          type="button"
          aria-label={nl.menuClose}
          aria-hidden={!sidebarOpen}
          tabIndex={sidebarOpen ? 0 : -1}
          className={`absolute inset-0 z-10 hidden bg-transparent transition-opacity duration-300 ease-in-out md:block ${
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={closeSidebar}
        />
        <button
          type="button"
          onClick={openSidebar}
          title={nl.menu}
          aria-label={nl.menu}
          aria-hidden={sidebarOpen}
          tabIndex={sidebarOpen ? -1 : 0}
          className={`absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-sm font-medium text-gray-800 shadow-md backdrop-blur transition-[opacity,transform,background-color] duration-300 ease-in-out hover:bg-white dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100 dark:hover:bg-gray-900 ${
            sidebarOpen
              ? "pointer-events-none translate-x-2 opacity-0"
              : "translate-x-0 opacity-100"
          }`}
        >
          <PanelLeftOpen size={16} />
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
          theme={theme}
          followedTrainId={followedTrainId}
          onTrainHover={setHoveredTrain}
          onStationHover={setHoveredStation}
          onTrainClick={(t) => setFollowedTrainId(t.id)}
          onStationClick={setSelectedStation}
          onStopFollow={() => setFollowedTrainId(null)}
        />
        <LiveBadge status={status} />
        {selectedStation && (
          <DepartureBoard
            station={selectedStation}
            lines={lines}
            onClose={() => setSelectedStation(null)}
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
      {showPrivacy && <PrivacyPolicy onClose={closePrivacy} />}
    </div>
  );
}
