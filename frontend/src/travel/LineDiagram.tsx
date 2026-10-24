import { useMemo } from "react";
import { formatPlaceName } from "../format";
import { Place } from "../components/Place";
import { AnimatedTrain, Station } from "../types";
import { cumulativeMinutes, placeTrains } from "./diagram";
import { JourneyLeg, NetworkLine } from "./types";
import { LineBadge, Section, SkeletonRows, useNarrowScreen } from "./ui";
import { useTravelT } from "./strings";
import { onColor } from "../contrast";

/** Row height in px. Phones get two lines per station (name, then badges and
 *  travel time) so even "Station Bijlmer ArenA" fits; trains and the track are
 *  placed in these same units. */
const ROW_H = 26;
const ROW_H_NARROW = 40;

export interface LineDiagramProps {
  network: NetworkLine[] | null;
  lineId: string;
  onLine: (id: string) => void;
  trains: AnimatedTrain[];
  stations: Station[];
  colorOf: (line: string) => string;
  current: Station | null;
  /** The planned journey; its legs on the shown line are marked on it. */
  route?: JourneyLeg[] | null;
  onStation: (name: string) => void;
  nowMs: number;
}

export function LineDiagram({ network, lineId, onLine, trains, stations, colorOf, current, route, onStation, nowMs }: LineDiagramProps) {
  const rowH = useNarrowScreen() ? ROW_H_NARROW : ROW_H;
  const txt = useTravelT();
  const line = network?.find((l) => l.id === lineId) ?? network?.[0] ?? null;
  const placed = useMemo(() => (line ? placeTrains(line, trains, nowMs) : []), [line, trains, nowMs]);
  const linesAt = useMemo(() => new Map(stations.map((s) => [s.name, s.lines])), [stations]);

  const dirA = line?.directions[0];
  const dirB = line?.directions[1];
  const order = dirA?.stations ?? [];
  const minutes = cumulativeMinutes(dirA?.runtimes_s ?? []);
  const height = Math.max(order.length, 1) * rowH;
  const stretches = useMemo(() => routeStretches(order, route ?? [], line?.id), [order, route, line?.id]);
  const onRoute = (i: number) => stretches.some(([a, b]) => i >= Math.min(a, b) && i <= Math.max(a, b));
  const ends = new Set(stretches.flat());

  return (
    <Section
      n={4}
      id="lijnoverzicht"
      title={txt.lineOverview}
      aside={
        <div className="flex gap-1" role="group" aria-label={txt.chooseLine}>
          {(network ?? []).map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={l.id === line?.id}
              onClick={() => onLine(l.id)}
              className={`flex min-h-6 items-center rounded transition ${l.id === line?.id ? "ring-2 ring-[#1f3a68] ring-offset-1 dark:ring-[#c8a951] dark:ring-offset-[#111727]" : "opacity-60 hover:opacity-100"}`}
            >
              <LineBadge id={l.id} color={l.color} />
            </button>
          ))}
        </div>
      }
    >
      {!line || !dirA ? (
        <SkeletonRows rows={8} />
      ) : (
        <>
          <p className="mb-2 text-xs text-[#4a4436] dark:text-[#b9bfcc]">
            <span className="font-academic text-sm font-semibold text-[#1d2433] dark:text-[#ece6d6]">
              Metro {line.id} · <Place name={line.name} />
            </span>{" "}
            · {txt.trainsUnderway(placed.length)} · {txt.runTime(minutes[minutes.length - 1])}
          </p>
          {stretches.length > 0 && (
            <p className="mb-2 text-xs font-semibold text-[#7b2132] dark:text-[#c8a951]">
              {txt.yourJourney}{" "}
              {stretches.map(([a, b], k) => (
                <span key={k}>
                  {k > 0 && ", "}
                  <Place name={order[a]} /> – <Place name={order[b]} />
                </span>
              ))}
            </p>
          )}
          <div className="mb-1 grid grid-cols-[1.25rem_minmax(0,1fr)_2.5rem_2.5rem] sm:grid-cols-[1.25rem_minmax(0,1fr)_4.75rem_4.75rem] gap-x-1.5 text-[11px] text-[#6b6455] dark:text-[#8b93a7]">
            <span />
            <span className="smallcaps">{txt.stationTravelTime}</span>
            {/* Phones: just the arrows; the chips below carry the direction too. */}
            <span translate="no" className="smallcaps truncate text-center" title={formatPlaceName(dirA.headsign)}>
              ↓<span className="sr-only sm:not-sr-only"> <Place name={dirA.headsign} /></span>
            </span>
            <span translate="no" className="smallcaps truncate text-center" title={dirB ? formatPlaceName(dirB.headsign) : ""}>
              ↑<span className="sr-only sm:not-sr-only"> {dirB ? formatPlaceName(dirB.headsign) : ""}</span>
            </span>
          </div>
          <div className="relative grid grid-cols-[1.25rem_minmax(0,1fr)_2.5rem_2.5rem] sm:grid-cols-[1.25rem_minmax(0,1fr)_4.75rem_4.75rem] gap-x-1.5" style={{ height }}>
            {/* the track */}
            <span
              className="absolute left-[calc(0.625rem-2px)] w-1 rounded"
              style={{ top: rowH / 2, height: height - rowH, backgroundColor: line.color }}
              aria-hidden
            />
            {/* the planned stretch, drawn wider over the track */}
            {stretches.map(([a, b]) => (
              <span
                key={`${a}-${b}`}
                className="absolute left-[calc(0.625rem-5px)] w-2.5 rounded-full ring-2 ring-[#1d2433]/25 dark:ring-white/30"
                style={{ top: Math.min(a, b) * rowH + rowH / 2, height: Math.abs(b - a) * rowH, backgroundColor: line.color }}
                aria-hidden
              />
            ))}
            <ol className="contents">
              {order.map((name, i) => {
                const others = (linesAt.get(name) ?? []).filter((l) => l !== line.id);
                const here = current?.name === name;
                const end = ends.has(i);
                return (
                  <li key={name} className="contents">
                    <span className="relative flex items-center justify-center" style={{ height: rowH }}>
                      <span
                        className={`relative z-[1] rounded-full border-2 ${end ? "border-white dark:border-[#111727]" : "bg-white dark:bg-[#111727]"} ${here || end ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}`}
                        style={end ? { backgroundColor: line.color } : { borderColor: line.color }}
                      />
                    </span>
                    {/* Phones: name on its own line, badges and travel time below it.
                        From sm up the inner wrapper dissolves (contents) into one row. */}
                    <span className="flex min-w-0 flex-col justify-center gap-0.5 sm:flex-row sm:items-center sm:justify-start sm:gap-1" style={{ height: rowH }}>
                      <button
                        type="button"
                        onClick={() => onStation(name)}
                        className={`min-w-0 truncate text-left text-xs hover:underline ${here ? "font-bold text-[#7b2132] dark:text-[#c8a951]" : onRoute(i) ? "font-semibold" : ""}`}
                      >
                        {/* Phones drop the town ("Diemen, …") that outer stations carry;
                            on a line it adds nothing and it costs the room the name needs. */}
                        <span translate="no" className="sm:hidden" aria-hidden>
                          {formatPlaceName(name).replace(/^[^,]+, /, "")}
                        </span>
                        <span className="sr-only sm:not-sr-only"><Place name={name} /></span>
                      </button>
                      <span className="flex min-w-0 items-center gap-1 sm:contents">
                        {others.map((l) => (
                          <LineBadge key={l} id={l} color={colorOf(l)} small />
                        ))}
                        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[#6b6455] dark:text-[#8b93a7]">{minutes[i] ? `+${minutes[i]}′` : ""}</span>
                      </span>
                    </span>
                    <span style={{ height: rowH }} />
                    <span style={{ height: rowH }} />
                  </li>
                );
              })}
            </ol>
            {placed.map(({ train, pos, forward }) => (
              <span
                key={train.id}
                // Phones: narrower chip columns, so station names keep their room.
                className={`absolute z-[2] flex h-4 w-[2.25rem] -translate-y-1/2 items-center justify-center gap-0.5 rounded-full text-[11px] font-bold shadow-sm transition-[top] duration-1000 ease-linear sm:w-[4.5rem] ${
                  forward ? "right-[calc(2.5rem+0.375rem+0.125rem)] sm:right-[calc(4.75rem+0.375rem+0.125rem)]" : "right-0.5"
                }`}
                style={{ top: pos * rowH + rowH / 2, backgroundColor: line.color, color: onColor(line.color) }}
                title={`${train.status === "dwelling" ? txt.standsAt : txt.runsPast} ${formatPlaceName(train.prev_station ?? "")}`}
              >
                {forward ? "↓" : "↑"}{" "}
                {train.delay_s >= 60 ? `+${Math.round(train.delay_s / 60)}′` : <span className="sr-only sm:not-sr-only">{txt.onTime}</span>}
              </span>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

/** Rows [boarding, alighting] of the route's legs on this line, in travel order. */
export function routeStretches(order: string[], legs: JourneyLeg[], lineId: string | undefined): [number, number][] {
  const out: [number, number][] = [];
  for (const leg of legs) {
    if (leg.line !== lineId) continue;
    const a = order.indexOf(leg.from);
    const b = order.indexOf(leg.to);
    if (a >= 0 && b >= 0 && a !== b) out.push([a, b]);
  }
  return out;
}
