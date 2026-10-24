import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Clock3, Repeat } from "lucide-react";
import { fetchJourneys } from "../api";
import { delayLabel } from "../format";
import { Place } from "../components/Place";
import { pollWhileVisible } from "../poll";
import { Station } from "../types";
import { SearchBox } from "./SearchBox";
import { clock, countdown, duration } from "./time";
import { Journey, JourneyLeg } from "./types";
import { LineBadge, Section, SkeletonRows } from "./ui";
import { Num } from "../components/Num";
import { useTravelT, travelStrings } from "./strings";

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
  /** The legs of the next journey, for the board and the line diagram to
   *  follow; null when there is none. Called only when that route changes. */
  onRoute?: (legs: JourneyLeg[] | null) => void;
  /** Phones: open the line overview for the picked option (another tab there). */
  onShowLine?: () => void;
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

/** Same key for the same lines between the same stations, whichever trips. */
export function routeKeyOf(legs: JourneyLeg[] | null): string {
  return legs ? legs.map((l) => `${l.line}|${l.headsign}|${l.from}|${l.to}`).join(">") : "";
}

/** Which option a pick means; stays the same across refreshes of the list. */
export function journeyId(j: Journey): string {
  return `${j.legs[0]?.trip_id}@${j.departure_ts}`;
}

export function JourneyPlanner(props: JourneyPlannerProps) {
  const { colorOf, from, to, nowMs } = props;
  const txt = useTravelT();
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  // Counts picks, so picking again re-applies the route even if its shape
  // did not change (the visitor may have opened another line since).
  const [picks, setPicks] = useState(0);

  useEffect(() => {
    setJourneys(null);
    setPicked(null);
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
        if (!stop && mine === seq) setError(travelStrings().plannerUnavailable);
      }
    }, REFRESH_MS);
    return () => {
      stop = true;
      cleanup();
    };
  }, [from, to]);

  const upcoming = useMemo(() => (journeys ?? []).filter((j) => j.departure_ts > nowMs / 1000 - 30), [journeys, nowMs]);
  const fastest = fastestIndex(upcoming);

  // The picked option, or the next one; a picked train that has left falls
  // back to the next.
  const chosen = upcoming.find((j) => journeyId(j) === picked) ?? upcoming[0] ?? null;
  const pick = (j: Journey) => {
    setPicked(journeyId(j));
    setPicks((n) => n + 1);
  };

  // Report the route by its shape (lines and stations), not its trips: the
  // next train leaving must not count as a new route, or it would undo a line
  // the visitor picked since.
  const next = chosen?.legs ?? null;
  const routeKey = routeKeyOf(next);
  const { onRoute } = props;
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    onRoute?.(nextRef.current);
  }, [routeKey, picks, onRoute]);

  return (
    <Section n={3} id="reisplanner" title={txt.planner}>
      <div className="flex items-stretch gap-1.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Picker which="from" value={from} {...props} onPick={props.onFrom} />
          <Picker which="to" value={to} {...props} onPick={props.onTo} />
        </div>
        <button
          type="button"
          onClick={() => {
            props.onFrom(to);
            props.onTo(from);
          }}
          disabled={!from && !to}
          title={txt.swap}
          aria-label={txt.swap}
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
          {txt.departFrom} <Place name={props.current.name} />
        </button>
      )}

      <div className="mt-2.5">
        {!from && (
          <p className="text-xs leading-relaxed text-[#5b5446] dark:text-[#a9b0c2]">
            {txt.plannerIntroA}{" "}
            <em>{txt.plannerIntroExample}</em>{txt.plannerIntroB}
          </p>
        )}
        {from && !to && (
          <div className="space-y-1.5 text-xs leading-relaxed text-[#5b5446] dark:text-[#a9b0c2]">
            <p>
              {txt.departFrom} <strong className="text-[#1d2433] dark:text-[#ece6d6]"><Place name={from.name} /></strong>.{" "}
              {txt.chooseDestination}
            </p>
            {/* On a desktop the board beside the planner already switched to this
                station; on a phone it is in another tab, so offer the way there. */}
            {props.onShowDepartures && (
              <button
                type="button"
                onClick={() => props.onShowDepartures?.(from)}
                className="flex min-h-9 items-center gap-1 font-semibold text-[#1f3a68] underline-offset-2 hover:underline lg:hidden dark:text-[#c8a951]"
              >
                {txt.departuresFrom} <Place name={from.name} /> →
              </button>
            )}
          </div>
        )}
        {from && to && from.name === to.name && (
          <p className="text-xs text-[#7b2132] dark:text-[#f08a9b]">{txt.sameStation}</p>
        )}
        {from && to && from.name !== to.name && journeys === null && !error && <SkeletonRows rows={3} />}
        {error && <p className="text-xs text-[#7b2132] dark:text-[#f08a9b]">{error}</p>}
        {journeys !== null && upcoming.length === 0 && (
          <p className="text-xs text-[#5b5446] dark:text-[#a9b0c2]">
            {txt.noConnection}
          </p>
        )}
        <ol className="space-y-2">
          {upcoming.map((j, i) => {
            const isChosen = upcoming.length > 1 && j === chosen;
            return (
            <li
              key={`${j.departure_ts}-${j.arrival_ts}-${j.transfers}`}
              // The whole card picks the option; the station names inside keep
              // their own action. The time below is the keyboard way in.
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("button")) pick(j);
              }}
              className={`cursor-pointer rounded-md border p-2 transition ${
                isChosen ? "border-[#c8a951] ring-2 ring-[#c8a951]" : "border-[#e3dac7] hover:border-[#c8a951] dark:border-[#232b3e]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <button
                  type="button"
                  onClick={() => pick(j)}
                  aria-pressed={isChosen}
                  className="font-academic text-left text-lg font-semibold tabular-nums"
                >
                  <Num>{clock(j.departure_ts)}</Num> → <Num>{clock(j.arrival_ts)}</Num>
                </button>
                <span className="text-xs font-semibold tabular-nums text-[#7b2132] dark:text-[#f08a9b]">
                  <Num>{countdown(j.departure_ts, nowMs)}</Num>
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#5b5446] dark:text-[#a9b0c2]">
                <span className="flex items-center gap-1">
                  <Clock3 size={11} aria-hidden /> <Num>{duration(j.duration_s)}</Num>
                </span>
                <span className="flex items-center gap-1">
                  <Repeat size={11} aria-hidden /> {j.transfers === 0 ? txt.direct : txt.transfers(j.transfers)}
                </span>
                {i === 0 && <Tag>{txt.next}</Tag>}
                {i === fastest && upcoming.length > 1 && <Tag>{txt.fastest}</Tag>}
              </div>
              <ol className="mt-1.5 space-y-1 border-l-2 border-[#d8cfbd] pl-2 dark:border-[#2a3245]">
                {j.legs.map((leg, k) => (
                  <li key={leg.trip_id + k} className="text-xs">
                    {k > 0 && (
                      <div className="mb-1 italic text-[#6b6455] dark:text-[#8b93a7]">
                        {txt.changeAt} <Place name={leg.from} /> · <Num>{duration(leg.departure_ts - j.legs[k - 1].arrival_ts)}</Num> {txt.wait}
                      </div>
                    )}
                    {/* Wraps rather than truncates: on a phone "Diemen, Station
                        Diemen Zuid" would otherwise lose the part that matters. */}
                    <div className="flex min-w-0 items-start gap-1.5">
                      <LineBadge id={leg.line} color={colorOf(leg.line)} small />
                      <span className="min-w-0">
                        <button type="button" onClick={() => props.onStation(leg.from)} className="font-semibold hover:underline">
                          <Place name={leg.from} />
                        </button>{" "}
                        <Num>{clock(leg.departure_ts)}</Num> → <Place name={leg.to} /> <Num>{clock(leg.arrival_ts)}</Num>
                      </span>
                    </div>
                    <div className="pl-8 text-[11px] text-[#6b6455] dark:text-[#8b93a7]">
                      {txt.towards} <Place name={leg.headsign} /> · {txt.stops(leg.stops)}
                      {leg.realtime ? <> · <Num>{delayLabel(leg.delay_s)}</Num></> : <> · <span aria-hidden>{txt.planned}</span><span className="sr-only">{txt.plannedSr}</span></>}
                    </div>
                  </li>
                ))}
              </ol>
              {j === chosen && props.onShowLine && (
                <button
                  type="button"
                  onClick={props.onShowLine}
                  className="mt-1.5 flex min-h-9 items-center text-xs font-semibold text-[#1f3a68] underline-offset-2 hover:underline lg:hidden dark:text-[#c8a951]"
                >
                  {txt.viewOnLine}
                </button>
              )}
            </li>
            );
          })}
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
  p: JourneyPlannerProps & { which: "from" | "to"; value: Station | null; onPick: (s: Station | null) => void },
) {
  const txt = useTravelT();
  const label = p.which === "from" ? txt.from : txt.to;
  return (
    <div className="flex items-center gap-1.5">
      <span className="smallcaps w-9 shrink-0 text-xs font-semibold text-[#7b2132] dark:text-[#c8a951]">{label}</span>
      <SearchBox
        label={`${label} ${txt.station}`}
        placeholder={p.which === "from" ? txt.fromStation : txt.toStation}
        stations={p.stations}
        lineIds={p.lineIds}
        colorOf={p.colorOf}
        mode="station"
        compact
        value={p.value?.name}
        onStation={p.onPick}
        onNearby={p.which === "from" ? p.onNearby : undefined}
      />
    </div>
  );
}
