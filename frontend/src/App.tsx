import { useEffect, useState } from "react";
import { MetroMap } from "./components/MetroMap";
import { Sidebar } from "./components/Sidebar";
import { LiveBadge } from "./components/LiveBadge";
import { DepartureBoard } from "./components/DepartureBoard";
import { FollowChip } from "./components/FollowChip";
import {
  fetchLines,
  fetchShapes,
  fetchStations,
  fetchStatus,
  fetchTrains,
} from "./api";
import { AnimatedTrain, Line, ShapeGeom, Station, Status } from "./types";
import { useTheme } from "./theme";

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFollowedTrainId(null);
        setSelectedStation(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        setError("Backend not reachable — is it running on :8020?");
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

  const toggleLine = (id: string) =>
    setVisibleLines((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <div className="flex h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
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
      />
      <main className="relative flex-1">
        {error && (
          <div className="absolute inset-x-0 top-0 z-10 bg-red-900/90 px-4 py-2 text-sm">
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
    </div>
  );
}
