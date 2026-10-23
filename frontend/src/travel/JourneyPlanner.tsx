import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Clock3, Repeat } from "lucide-react";
import { fetchJourneys } from "../api";
import { delayLabel } from "../format";
import { Place } from "../components/Place";
import { pollWhileVisible } from "../poll";
import { Station } from "../types";
import { SearchBox } from "./SearchBox";
import { clock, countdown, duration } from "./time";
import { Journey } from "./types";
import { LineBadge, Section, SkeletonRows } from "./ui";
import { Num } from "../components/Num";

const REFRESH_MS = 30000;

export interface JourneyPlannerProps {
  stations: Station[];
  lineIds: string[];
  colorOf: (line: string) => string;
  from: Station | null;
  to: Station | null;
  current: Station | null;
  onFrom: (s: Station | null) => void;
  onTo: (s: Station | null) => void;
  onStation: (name: string) => void;
  onNearby: () => void;
  /** Phones: open the departure board for this station (it sits in another tab there). */
  onShowDepartures?: (s: Station) => void;
  nowMs: number;
}

/** Index of the fastest option, ties to the earliest departure. */
export function fastestIndex(js: Journey[]): number {
  let best = -1;
  js.forEach((j, i) => {
    if (best < 0 || j.duration_s < js[best].duration_s) best = i;
  });
  return best;
}

export function JourneyPlanner(props: JourneyPlannerProps) {
  const { colorOf, from, to, nowMs } = props;
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJourneys(null);
    setError(null);
    if (!from || !to || from.name === to.name) return;
    let stop = false;
    let seq = 0; // only the newest of overlapping polls may land
    const cleanup = pollWhileVisible(async () => {
      const mine = ++seq;
      try {
        const js = await fetchJourneys(from.name, to.name, 6);
        if (!stop && mine === seq) {
          setJourneys(js);
          setError(null);
        }
      } catch {
        if (!stop && mine === seq) setError("Reisadvies is even niet beschikbaar — we proberen het opnieuw.");
      }
    }, REFRESH_MS);
    return () => {
      stop = true;
      cleanup();
    };
  }, [from, to]);

  const upcoming = useMemo(() => (journeys ?? []).filter((j) => j.departure_ts > nowMs / 1000 - 30), [journeys, nowMs]);
  const fastest = fastestIndex(upcoming);

  return (
    <Section n={3} id="reisplanner" title="Reisplanner">
      <div className="flex items-stretch gap-1.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Picker label="Van" value={from} {...props} onPick={props.onFrom} />
          <Picker label="Naar" value={to} {...props} onPick={props.onTo} />
        </div>
        <button
          type="button"
          onClick={() => {
            props.onFrom(to);
            props.onTo(from);
          }}
          disabled={!from && !to}
          title="Van en naar omwisselen"
          aria-label="Van en naar omwisselen"
          className="flex w-9 shrink-0 items-center justify-center rounded-md border border-[#d8cfbd] text-[#1f3a68] transition hover:bg-[#f1ebdd] disabled:opacity-40 dark:border-[#2a3245] dark:text-[#c8a951] dark:hover:bg-[#1a2134]"
        >
          <ArrowDownUp size={16} />
        </button>
      </div>
      {props.current && props.current.name !== from?.name && (
        <button
          type="button"
          onClick={() => props.onFrom(props.current)}
          className="mt-1.5 text-xs font-semibold text-[#1f3a68] underline-offset-2 hover:underline dark:text-[#c8a951]"
        >
          Vertrek vanaf <Place name={props.current.name} />
        </button>
      )}

      <div className="mt-2.5">
        {!from && (
          <p className="text-xs leading-relaxed text-[#5b5446] dark:text-[#a9b0c2]">
            Kies een vertrek- en aankomststation. Tip: typ in de zoekbalk bovenaan direct{" "}
            <em>“noord naar gein”</em>. Ook reizen met één overstap worden gevonden.
          </p>
        )}
        {from && !to && (
          <div className="space-y-1.5 text-xs leading-relaxed text-[#5b5446] dark:text-[#a9b0c2]">
            <p>
              Vertrek vanaf <strong className="text-[#1d2433] dark:text-[#ece6d6]"><Place name={from.name} /></strong>.
              Kies nu waar je heen wilt.
            </p>
            {/* On a desktop the board beside the planner already switched to this
                station; on a phone it is in another tab, so offer the way there. */}
            {props.onShowDepartures && (
              <button
                type="button"
                onClick={() => props.onShowDepartures?.(from)}
                className="flex min-h-9 items-center gap-1 font-semibold text-[#1f3a68] underline-offset-2 hover:underline lg:hidden dark:text-[#c8a951]"
              >
                Vertrektijden vanaf <Place name={from.name} /> →
              </button>
            )}
          </div>
        )}
        {from && to && from.name === to.name && (
          <p className="text-xs text-[#7b2132] dark:text-[#f08a9b]">Vertrek- en aankomststation zijn hetzelfde.</p>
        )}
        {from && to && from.name !== to.name && journeys === null && !error && <SkeletonRows rows={3} />}
        {error && <p className="text-xs text-[#7b2132] dark:text-[#f08a9b]">{error}</p>}
        {journeys !== null && upcoming.length === 0 && (
          <p className="text-xs text-[#5b5446] dark:text-[#a9b0c2]">
            Geen metroverbinding in de komende anderhalf uur. Mogelijk rijdt de metro nu niet (nacht) of is een overstap
            nodig die meer dan één keer wisselen vraagt.
          </p>
        )}
        <ol className="space-y-2">
          {upcoming.map((j, i) => (
            <li key={`${j.departure_ts}-${j.arrival_ts}-${j.transfers}`} className="rounded-md border border-[#e3dac7] p-2 dark:border-[#232b3e]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-academic text-lg font-semibold tabular-nums">
                  <Num>{clock(j.departure_ts)}</Num> → <Num>{clock(j.arrival_ts)}</Num>
                </span>
                <span className="text-xs font-semibold tabular-nums text-[#7b2132] dark:text-[#f08a9b]">
                  <Num>{countdown(j.departure_ts, nowMs)}</Num>
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#5b5446] dark:text-[#a9b0c2]">
                <span className="flex items-center gap-1">
                  <Clock3 size={11} aria-hidden /> <Num>{duration(j.duration_s)}</Num>
                </span>
                <span className="flex items-center gap-1">
                  <Repeat size={11} aria-hidden /> {j.transfers === 0 ? "direct" : `${j.transfers} overstap`}
                </span>
                {i === 0 && <Tag>eerstvolgende</Tag>}
                {i === fastest && upcoming.length > 1 && <Tag>snelste</Tag>}
              </div>
              <ol className="mt-1.5 space-y-1 border-l-2 border-[#d8cfbd] pl-2 dark:border-[#2a3245]">
                {j.legs.map((leg, k) => (
                  <li key={leg.trip_id + k} className="text-xs">
                    {k > 0 && (
                      <div className="mb-1 italic text-[#7a7262] dark:text-[#8b93a7]">
                        Overstappen op <Place name={leg.from} /> · <Num>{duration(leg.departure_ts - j.legs[k - 1].arrival_ts)}</Num> wachten
                      </div>
                    )}
                    <div className="flex min-w-0 items-center gap-1.5">
                      <LineBadge id={leg.line} color={colorOf(leg.line)} small />
                      <span className="min-w-0 truncate">
                        <button type="button" onClick={() => props.onStation(leg.from)} className="font-semibold hover:underline">
                          <Place name={leg.from} />
                        </button>{" "}
                        <Num>{clock(leg.departure_ts)}</Num> → <Place name={leg.to} /> <Num>{clock(leg.arrival_ts)}</Num>
                      </span>
                    </div>
                    <div className="pl-8 text-[10px] text-[#7a7262] dark:text-[#8b93a7]">
                      richting <Place name={leg.headsign} /> · {leg.stops} {leg.stops === 1 ? "halte" : "haltes"}
                      {leg.realtime ? <> · <Num>{delayLabel(leg.delay_s)}</Num></> : " · dienstregeling"}
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="smallcaps rounded bg-[#f1ebdd] px-1.5 font-semibold text-[#7b2132] dark:bg-[#1a2134] dark:text-[#c8a951]">
      {children}
    </span>
  );
}

function Picker(
  p: JourneyPlannerProps & { label: string; value: Station | null; onPick: (s: Station | null) => void },
) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="smallcaps w-9 shrink-0 text-xs font-semibold text-[#7b2132] dark:text-[#c8a951]">{p.label}</span>
      <SearchBox
        label={`${p.label} station`}
        placeholder={p.label === "Van" ? "Vertrekstation" : "Aankomststation"}
        stations={p.stations}
        lineIds={p.lineIds}
        colorOf={p.colorOf}
        mode="station"
        compact
        value={p.value?.name}
        onStation={p.onPick}
        onNearby={p.label === "Van" ? p.onNearby : undefined}
      />
    </div>
  );
}
