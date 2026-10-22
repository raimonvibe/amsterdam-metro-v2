import { useMemo } from "react";
import { formatPlaceName } from "../format";
import { AnimatedTrain, Station } from "../types";
import { cumulativeMinutes, placeTrains } from "./diagram";
import { NetworkLine } from "./types";
import { LineBadge, Section, SkeletonRows } from "./ui";

const ROW_H = 26;

export interface LineDiagramProps {
  network: NetworkLine[] | null;
  lineId: string;
  onLine: (id: string) => void;
  trains: AnimatedTrain[];
  stations: Station[];
  colorOf: (line: string) => string;
  current: Station | null;
  onStation: (name: string) => void;
  nowMs: number;
}

export function LineDiagram({ network, lineId, onLine, trains, stations, colorOf, current, onStation, nowMs }: LineDiagramProps) {
  const line = network?.find((l) => l.id === lineId) ?? network?.[0] ?? null;
  const placed = useMemo(() => (line ? placeTrains(line, trains, nowMs) : []), [line, trains, nowMs]);
  const linesAt = useMemo(() => new Map(stations.map((s) => [s.name, s.lines])), [stations]);

  const dirA = line?.directions[0];
  const dirB = line?.directions[1];
  const order = dirA?.stations ?? [];
  const minutes = cumulativeMinutes(dirA?.runtimes_s ?? []);
  const height = Math.max(order.length, 1) * ROW_H;

  return (
    <Section
      n={4}
      id="lijnoverzicht"
      title="Lijnoverzicht"
      aside={
        <div className="flex gap-1" role="tablist" aria-label="Kies een lijn">
          {(network ?? []).map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === line?.id}
              onClick={() => onLine(l.id)}
              className={`rounded transition ${l.id === line?.id ? "ring-2 ring-[#1f3a68] ring-offset-1 dark:ring-[#c8a951] dark:ring-offset-[#111727]" : "opacity-60 hover:opacity-100"}`}
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
              Metro {line.id} · {formatPlaceName(line.name)}
            </span>{" "}
            · {placed.length} {placed.length === 1 ? "metro" : "metro's"} onderweg · ritduur ~{minutes[minutes.length - 1]} min
          </p>
          <div className="mb-1 grid grid-cols-[1.25rem_minmax(0,1fr)_2.5rem_2.5rem] sm:grid-cols-[1.25rem_minmax(0,1fr)_4.75rem_4.75rem] gap-x-1.5 text-[10px] text-[#7a7262] dark:text-[#8b93a7]">
            <span />
            <span className="smallcaps">station · reistijd</span>
            {/* Phones: just the arrows; the chips below carry the direction too. */}
            <span className="smallcaps truncate text-center" title={formatPlaceName(dirA.headsign)}>
              ↓<span className="sr-only sm:not-sr-only"> {formatPlaceName(dirA.headsign)}</span>
            </span>
            <span className="smallcaps truncate text-center" title={dirB ? formatPlaceName(dirB.headsign) : ""}>
              ↑<span className="sr-only sm:not-sr-only"> {dirB ? formatPlaceName(dirB.headsign) : ""}</span>
            </span>
          </div>
          <div className="relative grid grid-cols-[1.25rem_minmax(0,1fr)_2.5rem_2.5rem] sm:grid-cols-[1.25rem_minmax(0,1fr)_4.75rem_4.75rem] gap-x-1.5" style={{ height }}>
            {/* the track */}
            <span
              className="absolute left-[calc(0.625rem-2px)] w-1 rounded"
              style={{ top: ROW_H / 2, height: height - ROW_H, backgroundColor: line.color }}
              aria-hidden
            />
            <ol className="contents">
              {order.map((name, i) => {
                const others = (linesAt.get(name) ?? []).filter((l) => l !== line.id);
                const here = current?.name === name;
                return (
                  <li key={name} className="contents">
                    <span className="relative flex items-center justify-center" style={{ height: ROW_H }}>
                      <span
                        className={`relative z-[1] rounded-full border-2 bg-white dark:bg-[#111727] ${here ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}`}
                        style={{ borderColor: line.color }}
                      />
                    </span>
                    <span className="flex min-w-0 items-center gap-1" style={{ height: ROW_H }}>
                      <button
                        type="button"
                        onClick={() => onStation(name)}
                        className={`min-w-0 truncate text-left text-xs hover:underline ${here ? "font-bold text-[#7b2132] dark:text-[#c8a951]" : ""}`}
                      >
                        {formatPlaceName(name)}
                      </button>
                      {others.map((l) => (
                        <LineBadge key={l} id={l} color={colorOf(l)} small />
                      ))}
                      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-[#9a9384]">{minutes[i] ? `+${minutes[i]}′` : ""}</span>
                    </span>
                    <span style={{ height: ROW_H }} />
                    <span style={{ height: ROW_H }} />
                  </li>
                );
              })}
            </ol>
            {placed.map(({ train, pos, forward }) => (
              <span
                key={train.id}
                // Phones: narrower chip columns, so station names keep their room.
                className={`absolute z-[2] flex h-4 w-[2.25rem] -translate-y-1/2 items-center justify-center gap-0.5 rounded-full text-[9px] font-bold text-gray-950 shadow-sm transition-[top] duration-1000 ease-linear sm:w-[4.5rem] ${
                  forward ? "right-[calc(2.5rem+0.375rem+0.125rem)] sm:right-[calc(4.75rem+0.375rem+0.125rem)]" : "right-0.5"
                }`}
                style={{ top: pos * ROW_H + ROW_H / 2, backgroundColor: line.color }}
                title={`${train.status === "dwelling" ? "Staat op" : "Rijdt na"} ${formatPlaceName(train.prev_station ?? "")}`}
              >
                {forward ? "↓" : "↑"}{" "}
                {train.delay_s >= 60 ? `+${Math.round(train.delay_s / 60)}′` : <span className="sr-only sm:not-sr-only">op tijd</span>}
              </span>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
