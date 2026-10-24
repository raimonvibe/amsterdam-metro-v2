import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { fetchDepartures } from "../api";
import { pollWhileVisible } from "../poll";
import { strings, useT } from "../i18n";
import { Place } from "./Place";
import { formatPlaceName } from "../format";
import { Departure, Line, ServiceAlert, Station } from "../types";
import { AlertList, alertsFor } from "./AlertList";
import { Num } from "./Num";
import { onColor } from "../contrast";

interface DepartureBoardProps {
  station: Station;
  lines: Line[];
  /** Every metro service message; the card shows the ones for this station. */
  alerts?: ServiceAlert[];
  onClose: () => void;
  onMore?: () => void;
  /** Trips on the map right now: those rows can be picked to follow the train. */
  followable?: Set<string>;
  onFollow?: (tripId: string) => void;
}

function countdown(ts: number, nowMs: number): string {
  const s = ts - nowMs / 1000;
  if (s < 45) return strings().now;
  return `${Math.round(s / 60)} ${strings().min}`;
}

export function DepartureBoard({ station, lines, alerts = [], onClose, onMore, followable, onFollow }: DepartureBoardProps) {
  const txt = useT();
  const [departures, setDepartures] = useState<Departure[] | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    setDepartures(null);
    let stop = false;
    const cleanup = pollWhileVisible(async () => {
      try {
        const d = await fetchDepartures(station.name);
        if (!stop) setDepartures(d);
      } catch {
        /* transient */
      }
    }, 15000);
    return () => {
      stop = true;
      cleanup();
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
          <Place name={station.name} />
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={txt.closeDepartures}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100 sm:min-h-0 sm:min-w-0 sm:p-1"
        >
          <X size={14} />
        </button>
      </div>

      <AlertList alerts={alertsFor(alerts, station)} colorOf={colorOf} compact className="mb-2" />
      {departures === null && (
        <div className="py-3 text-center text-xs text-gray-500 dark:text-gray-400">
          {txt.loadingDepartures}
        </div>
      )}
      {departures?.length === 0 && (
        <div className="py-3 text-center text-xs text-gray-500 dark:text-gray-400">
          {txt.noDepartures}
        </div>
      )}
      {departures && departures.length > 0 && (
        <ul className="space-y-1">
          {departures.map((d, i) => {
            // A train already on the map can be followed from here: the way
            // to it for keyboards and screen readers, which cannot point at it.
            const canFollow = Boolean(onFollow && followable?.has(d.trip_id));
            const Row = canFollow ? "button" : "div";
            return (
            <li key={`${d.trip_id}-${d.departure_ts}-${i}`} className="rounded-lg odd:bg-gray-100 dark:odd:bg-gray-900">
              <Row
                {...(canFollow
                  ? {
                      type: "button" as const,
                      onClick: () => onFollow?.(d.trip_id),
                      "aria-label": `${txt.followTrain(d.line, formatPlaceName(d.headsign))}, ${countdown(d.departure_ts, nowMs)}`,
                    }
                  : {})}
                className={`flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1 text-left text-sm ${
                  canFollow ? "hover:bg-gray-200 dark:hover:bg-gray-800" : ""
                }`}
              >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-5 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold"
                  style={{ backgroundColor: colorOf(d.line), color: onColor(colorOf(d.line)) }}
                >
                  {d.line}
                </span>
                <span className="truncate text-gray-800 dark:text-gray-200">
                  <Place name={d.headsign} />
                </span>
              </span>
              <span className="ml-2 shrink-0 text-right">
                <span className="font-semibold tabular-nums">
                  <Num>{countdown(d.departure_ts, nowMs)}</Num>
                </span>
                {d.delay_s > 60 && (
                  <span className="ml-1 text-[11px] text-amber-600 dark:text-amber-400">
                    +{Math.round(d.delay_s / 60)}m
                  </span>
                )}
              </span>
              </Row>
            </li>
            );
          })}
        </ul>
      )}
      {onMore && (
        <button
          type="button"
          onClick={onMore}
          className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-[#4363D8] hover:bg-gray-100 dark:text-[#8aa2ff] dark:hover:bg-gray-900"
        >
          {txt.allDepartures} →
        </button>
      )}
    </div>
  );
}
