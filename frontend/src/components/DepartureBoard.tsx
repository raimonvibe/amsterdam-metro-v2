import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { fetchDepartures } from "../api";
import { Departure, Line, Station } from "../types";

interface DepartureBoardProps {
  station: Station;
  lines: Line[];
  onClose: () => void;
}

function countdown(ts: number, nowMs: number): string {
  const s = ts - nowMs / 1000;
  if (s < 45) return "now";
  return `${Math.round(s / 60)} min`;
}

export function DepartureBoard({ station, lines, onClose }: DepartureBoardProps) {
  const [departures, setDepartures] = useState<Departure[] | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    setDepartures(null);
    let stop = false;
    const poll = async () => {
      try {
        const d = await fetchDepartures(station.name);
        if (!stop) setDepartures(d);
      } catch {
        /* transient */
      }
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [station.name]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const colorOf = (id: string) => lines.find((l) => l.id === id)?.color ?? "#999";

  return (
    <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 max-h-[min(50vh,24rem)] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white/95 p-3 text-gray-900 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-950/90 dark:text-gray-100 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:max-h-[min(70vh,28rem)] sm:w-72">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-sm font-bold leading-snug">
          {station.name.replace(/^Amsterdam, /, "")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close departures"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100 sm:min-h-0 sm:min-w-0 sm:p-1"
        >
          <X size={14} />
        </button>
      </div>

      {departures === null && (
        <div className="py-3 text-center text-xs text-gray-500 dark:text-gray-400">
          Loading departures…
        </div>
      )}
      {departures?.length === 0 && (
        <div className="py-3 text-center text-xs text-gray-500 dark:text-gray-400">
          No departures in the next 45 minutes
        </div>
      )}
      {departures && departures.length > 0 && (
        <ul className="space-y-1">
          {departures.map((d, i) => (
            <li
              key={`${d.trip_id}-${d.departure_ts}-${i}`}
              className="flex items-center justify-between rounded-lg px-2 py-1 text-sm odd:bg-gray-100 dark:odd:bg-gray-900"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-5 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold text-gray-950"
                  style={{ backgroundColor: colorOf(d.line) }}
                >
                  {d.line}
                </span>
                <span className="truncate text-gray-800 dark:text-gray-200">
                  {d.headsign}
                </span>
              </span>
              <span className="ml-2 shrink-0 text-right">
                <span className="font-semibold tabular-nums">
                  {countdown(d.departure_ts, nowMs)}
                </span>
                {d.delay_s > 60 && (
                  <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">
                    +{Math.round(d.delay_s / 60)}m
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
