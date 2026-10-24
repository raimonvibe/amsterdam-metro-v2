import { useEffect, useMemo, useState } from "react";
import { Clock, Footprints, Link2, MapPin, Radio, Route, Star } from "lucide-react";
import { fetchBoard, fetchStationInfo, SlowDown } from "../api";
import { delayLabel } from "../format";
import { Place } from "../components/Place";
import { pollWhileVisible } from "../poll";
import { AlertList, alertsFor } from "../components/AlertList";
import { AnimatedTrain, ServiceAlert, Station } from "../types";
import { TravelPrefs } from "./storage";
import { catchable, clock, countdown, headwayLabel, urgency } from "./time";
import { BoardDeparture, JourneyLeg, StationInfo } from "./types";
import { LineBadge, Section, Segmented, SkeletonRows } from "./ui";
import { Num } from "../components/Num";
import { useTravelT } from "./strings";

const ROWS_PER_DIRECTION = 5;
const BOARD_REFRESH_MS = 20000;
const INFO_REFRESH_MS = 60000;

export interface StationBoardProps {
  station: Station;
  colorOf: (line: string) => string;
  trains: AnimatedTrain[];
  prefs: TravelPrefs;
  onPrefs: (p: TravelPrefs) => void;
  nowMs: number;
  favourite: boolean;
  onToggleFavourite: () => void;
  onShare: () => void;
  onShowOnMap: () => void;
  onPlanFrom: () => void;
  onStation: (name: string) => void;
  /** The planned journey's leg from this station: its direction is marked. */
  routeLeg?: JourneyLeg | null;
  /** Every metro service message; the board shows the ones for this station. */
  alerts?: ServiceAlert[];
  /** False while the live feed is down or stale: every time is the timetable. */
  live?: boolean;
}

interface Group {
  headsign: string;
  lines: string[];
  deps: BoardDeparture[];
  /** Distinct known platforms, sorted. One → shown on the card, several → per row. */
  platforms: string[];
  /** No platform names, yet trains leave from more than one track (a
   *  terminus such as CS): which one is only known from the station's signs. */
  alternates: boolean;
}

/** Departures grouped per direction (end station), in a fixed order (line,
 *  then direction) so cards never swap places when the board refreshes. */
export function groupByDirection(deps: BoardDeparture[]): Group[] {
  const groups = new Map<string, Group>();
  const tracks = new Map<string, Set<string>>();
  for (const d of deps) {
    const g = groups.get(d.headsign) ?? { headsign: d.headsign, lines: [], deps: [], platforms: [], alternates: false };
    tracks.set(d.headsign, (tracks.get(d.headsign) ?? new Set()).add(d.stop_id));
    if (!g.lines.includes(d.line)) g.lines.push(d.line);
    if (d.platform && !g.platforms.includes(d.platform)) g.platforms.push(d.platform);
    g.deps.push(d);
    groups.set(d.headsign, g);
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      lines: g.lines.sort(),
      platforms: g.platforms.sort((a, b) => a.localeCompare(b, "nl", { numeric: true })),
      alternates: g.platforms.length === 0 && tracks.get(g.headsign)!.size > 1,
    }))
    .sort((a, b) => a.lines[0].localeCompare(b.lines[0]) || a.headsign.localeCompare(b.headsign, "nl"));
}

export function StationBoard(props: StationBoardProps) {
  const { station, colorOf, trains, prefs, onPrefs, nowMs } = props;
  const txt = useTravelT();
  const [deps, setDeps] = useState<BoardDeparture[] | null>(null);
  const [info, setInfo] = useState<StationInfo | null>(null);
  const [error, setError] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);
  const [lineFilter, setLineFilter] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDeps(null);
    setInfo(null);
    setError(false);
    setUpdated(null);
    setLineFilter([]);
    setExpanded({});
  }, [station.name]);

  useEffect(() => {
    let stop = false;
    // Polls can overlap on a slow connection; only the newest may land, or
    // an older answer would overwrite fresher departures.
    let seq = 0;
    let retry: number | undefined;
    const load = async () => {
      window.clearTimeout(retry);
      const mine = ++seq;
      try {
        const d = await fetchBoard(station.name, prefs.windowMin, prefs.showCancelled);
        if (stop || mine !== seq) return;
        setDeps(d);
        setError(false);
        setUpdated(Date.now());
      } catch (e) {
        if (stop || mine !== seq) return;
        // Asked to slow down (a shared address): not a connection problem.
        // Keep the board as it is and try once more when the server says.
        if (e instanceof SlowDown) retry = window.setTimeout(load, e.retryAfterS * 1000);
        else setError(true);
      }
    };
    const cleanup = pollWhileVisible(load, BOARD_REFRESH_MS);
    return () => {
      stop = true;
      window.clearTimeout(retry);
      cleanup();
    };
  }, [station.name, prefs.windowMin, prefs.showCancelled]);

  useEffect(() => {
    let stop = false;
    const cleanup = pollWhileVisible(async () => {
      try {
        const i = await fetchStationInfo(station.name);
        if (!stop) setInfo(i);
      } catch {
        /* the board works without it */
      }
    }, INFO_REFRESH_MS);
    return () => {
      stop = true;
      cleanup();
    };
  }, [station.name]);

  const visible = useMemo(
    () => (deps ?? []).filter((d) => lineFilter.length === 0 || lineFilter.includes(d.line)),
    [deps, lineFilter],
  );
  const groups = useMemo(() => groupByDirection(visible), [visible]);

  const incoming = useMemo(
    () =>
      trains
        .filter((t) => t.next_station === station.name && t.next_arrival_ts)
        .sort((a, b) => (a.next_arrival_ts ?? 0) - (b.next_arrival_ts ?? 0))
        .slice(0, 6),
    [trains, station.name],
  );

  const stationAlerts = useMemo(() => alertsFor(props.alerts ?? [], station), [props.alerts, station]);

  const toggleLine = (l: string) =>
    setLineFilter((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  return (
    <Section
      n={2}
      id="vertrekstaat"
      title={txt.board}
      aside={
        updated && (
          <span className="text-[11px] tabular-nums text-[#6b6455] dark:text-[#8b93a7]" aria-live="off">
            {error ? txt.connectionTrouble : ""}{txt.updated} <Num>{clock(updated / 1000)}</Num>
          </span>
        )
      }
    >
      <AlertList alerts={stationAlerts} colorOf={colorOf} className="mb-2.5" />
      {/* Station heading and actions */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-academic text-2xl font-semibold leading-tight text-[#1d2433] dark:text-[#f3eee2]">
            <Place name={station.name} full />
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {station.lines.map((l) => (
              <LineBadge key={l} id={l} color={colorOf(l)} />
            ))}
            {station.name.includes(",") && !station.name.startsWith("Amsterdam,") && (
              <span className="ml-1 text-xs text-[#6b6455] dark:text-[#8b93a7]">{station.name.split(",")[0]}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ActionButton onClick={props.onToggleFavourite} label={props.favourite ? txt.unfavourite : txt.favourite} pressed={props.favourite}>
            <Star size={14} className={props.favourite ? "fill-[#c8a951] text-[#c8a951]" : ""} />
          </ActionButton>
          <ActionButton onClick={props.onPlanFrom} label={txt.planFromHere}>
            <Route size={14} />
          </ActionButton>
          <ActionButton onClick={props.onShowOnMap} label={txt.onMap}>
            <MapPin size={14} />
          </ActionButton>
          <ActionButton onClick={props.onShare} label={txt.share}>
            <Link2 size={14} />
          </ActionButton>
        </div>
      </div>

      {/* Service summary per direction */}
      {info && info.directions.length > 0 && (
        <ul className="mt-2.5 grid gap-1 text-xs text-[#4a4436] sm:grid-cols-2 dark:text-[#b9bfcc]">
          {info.directions.map((d) => (
            <li key={`${d.line}-${d.headsign}`} className="flex min-w-0 items-center gap-1.5 rounded bg-[#f6f1e4] px-2 py-1 dark:bg-[#151c2e]">
              <LineBadge id={d.line} color={colorOf(d.line)} small />
              <span className="min-w-0 truncate">
                <span className="font-semibold">→ <Place name={d.headsign} /></span>
                {headwayLabel(d.headway_min) && <> · {headwayLabel(d.headway_min)}</>}
                {d.first_ts && d.last_ts && (
                  <span className="text-[#6b6455] dark:text-[#8b93a7]">
                    {" "}
                    · <Num>{clock(d.first_ts)}</Num>–<Num>{clock(d.last_ts)}</Num>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#ebe3d2] pt-2.5 dark:border-[#232b3e]">
        <Segmented
          label={txt.timeWindow}
          value={prefs.windowMin}
          options={[15, 30, 60, 120].map((m) => ({ value: m, label: `${m} min` }))}
          onChange={(windowMin) => onPrefs({ ...prefs, windowMin })}
        />
        {station.lines.length > 1 && (
          <div className="flex items-center gap-1" role="group" aria-label={txt.filterByLine}>
            {station.lines.map((l) => {
              const on = lineFilter.length === 0 || lineFilter.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lineFilter.includes(l)}
                  onClick={() => toggleLine(l)}
                  className={`flex min-h-6 items-center rounded transition ${on ? "" : "opacity-35 grayscale"}`}
                  title={txt.onlyLine(l)}
                >
                  <LineBadge id={l} color={colorOf(l)} />
                </button>
              );
            })}
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#3b4457] dark:text-[#c9c3b4]">
          <input
            type="checkbox"
            checked={prefs.showCancelled}
            onChange={(e) => onPrefs({ ...prefs, showCancelled: e.target.checked })}
            className="accent-[#1f3a68] dark:accent-[#c8a951]"
          />
          {txt.showCancelled}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[#3b4457] dark:text-[#c9c3b4]">
          <Footprints size={13} aria-hidden />
          {txt.walkTime}
          <select
            value={prefs.walkMin}
            onChange={(e) => onPrefs({ ...prefs, walkMin: Number(e.target.value) })}
            className="rounded border border-[#d8cfbd] bg-white px-1 py-0.5 text-xs tabular-nums dark:border-[#2a3245] dark:bg-[#0d1322]"
          >
            {[0, 1, 2, 3, 5, 8, 10, 15].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? txt.none : `${m} min`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Live is the rule, so only exceptions are marked ("gepland"); say so
          once here instead of tagging every row "live". */}
      {deps !== null && groups.length > 0 && (props.live === false ? (
        <p role="status" className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs leading-snug text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {txt.liveDown}
        </p>
      ) : visible.some((d) => !d.realtime && !d.cancelled) ? (
        <p className="mt-3 text-xs leading-snug text-[#6b6455] dark:text-[#8b93a7]">{txt.timesLiveNote}</p>
      ) : null)}

      {/* The board */}
      {/* A container: whether directions sit side by side depends on this
          panel's width, not the viewport's (the panel is narrow in the 3-column layout). */}
      <div className="@container mt-3">
        {deps === null && !error && <SkeletonRows rows={6} />}
        {deps === null && error && (
          <p className="py-3 text-sm text-[#7b2132] dark:text-[#e59aa6]">
            {txt.boardUnavailable}
          </p>
        )}
        {deps !== null && groups.length === 0 && (
          <div className="rounded border border-dashed border-[#d8cfbd] px-3 py-4 text-center text-sm text-[#5b5446] dark:border-[#2a3245] dark:text-[#a9b0c2]">
            {txt.noDeparturesIn(prefs.windowMin)}
            {lineFilter.length > 0 && txt.onChosenLines}.
            {prefs.windowMin < 120 && (
              <button
                type="button"
                onClick={() => onPrefs({ ...prefs, windowMin: 120 })}
                className="ml-2 font-semibold text-[#1f3a68] underline underline-offset-2 dark:text-[#c8a951]"
              >
                {txt.show2h}
              </button>
            )}
          </div>
        )}
        <div className="grid gap-2.5 @xl:grid-cols-2">
          {groups.map((g) => {
            const open = expanded[g.headsign];
            const mine = props.routeLeg != null && g.headsign === props.routeLeg.headsign && g.lines.includes(props.routeLeg.line);
            const rows = open ? g.deps : g.deps.slice(0, ROWS_PER_DIRECTION);
            return (
              <article
                key={g.headsign}
                className={`rounded-md border ${mine ? "border-[#c8a951] ring-2 ring-[#c8a951]" : "border-[#e3dac7] dark:border-[#232b3e]"}`}
              >
                {/* A strip of its own, not a tag in the header: on a phone the
                    header has no room left for it beside the direction. */}
                {mine && (
                  <p className="smallcaps rounded-t-[5px] bg-[#c8a951] px-2.5 text-[11px] font-semibold leading-[18px] text-[#1d2433]">
                    {txt.yourTrip}
                  </p>
                )}
                <header className={`flex items-center justify-between gap-2 bg-[#1f3a68] px-2.5 py-1.5 text-white dark:bg-[#0d1322] ${mine ? "" : "rounded-t-md"}`}>
                  <h4 className="font-academic min-w-0 truncate text-sm font-semibold">
                    {txt.direction} <Place name={g.headsign} />
                  </h4>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {g.platforms.length === 1 && (
                      <span className="rounded bg-[#c8a951] px-1.5 text-[11px] font-semibold leading-[18px] text-[#1d2433]">
                        {txt.platformCap} {g.platforms[0]}
                      </span>
                    )}
                    <span className="flex gap-0.5">
                      {g.lines.map((l) => (
                        <LineBadge key={l} id={l} color={colorOf(l)} small />
                      ))}
                    </span>
                  </span>
                </header>
                {g.alternates && (
                  <p className="border-b border-[#efe8d8] px-2.5 py-1 text-[11px] text-[#5b5446] dark:border-[#1c2436] dark:text-[#a9b0c2]">
                    {txt.alternatingTrack}
                  </p>
                )}
                <ol className="divide-y divide-[#efe8d8] dark:divide-[#1c2436]">
                  {rows.map((d) => (
                    <DepartureRow key={`${d.trip_id}-${d.departure_ts}`} d={d} nowMs={nowMs} walkMin={prefs.walkMin} colorOf={colorOf} showLine={g.lines.length > 1} showPlatform={g.platforms.length > 1} />
                  ))}
                </ol>
                {g.deps.length > ROWS_PER_DIRECTION && (
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [g.headsign]: !open }))}
                    className="w-full border-t border-[#efe8d8] py-1 text-xs font-semibold text-[#1f3a68] hover:bg-[#f6f1e4] dark:border-[#1c2436] dark:text-[#c8a951] dark:hover:bg-[#151c2e]"
                  >
                    {open ? txt.showLess : txt.moreDepartures(g.deps.length - ROWS_PER_DIRECTION)}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* Trains on their way here, from the live stream */}
      <div className="mt-3 border-t border-[#ebe3d2] pt-2.5 dark:border-[#232b3e]">
        <h4 className="smallcaps mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#7b2132] dark:text-[#c8a951]">
          <Radio size={13} aria-hidden /> {txt.incoming}
        </h4>
        {incoming.length === 0 ? (
          <p className="text-xs text-[#6b6455] dark:text-[#8b93a7]">{txt.noIncoming}</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {incoming.map((t) => (
              <li key={t.id} className="flex min-w-0 items-center gap-1.5 text-xs">
                <LineBadge id={t.line} color={colorOf(t.line)} small />
                <span className="min-w-0 flex-1 truncate">
                  → <Place name={t.headsign ?? ""} />
                  {t.prev_station && (
                    <button type="button" onClick={() => props.onStation(t.prev_station!)} className="text-[#6b6455] hover:underline dark:text-[#8b93a7]">
                      {" "}
                      · {t.status === "dwelling" ? txt.standingAt : txt.justPast} <Place name={t.prev_station} />
                    </button>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular-nums"><Num>{countdown(t.next_arrival_ts!, nowMs)}</Num></span>
                {Math.abs(t.delay_s) >= 60 && (
                  <span className="shrink-0 text-[11px] text-amber-700 dark:text-amber-400"><Num>{delayLabel(t.delay_s)}</Num></span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function ActionButton({
  onClick,
  label,
  pressed,
  children,
}: {
  onClick: () => void;
  label: string;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="flex min-h-8 items-center gap-1 rounded-md border border-[#d8cfbd] bg-white px-2 text-xs font-medium text-[#1d2433] transition hover:border-[#1f3a68] hover:text-[#1f3a68] dark:border-[#2a3245] dark:bg-[#0d1322] dark:text-[#ece6d6] dark:hover:border-[#c8a951] dark:hover:text-[#c8a951]"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

const URGENCY_CLASS = {
  gone: "text-[#6b6455] dark:text-[#8b93a7] line-through",
  now: "text-[#7b2132] dark:text-[#f08a9b]",
  soon: "text-amber-700 dark:text-amber-400",
  later: "text-[#1d2433] dark:text-[#ece6d6]",
} as const;

function DepartureRow({
  d,
  nowMs,
  walkMin,
  colorOf,
  showLine,
  showPlatform,
}: {
  d: BoardDeparture;
  nowMs: number;
  walkMin: number;
  colorOf: (l: string) => string;
  showLine: boolean;
  /** Only when a direction leaves from more than one platform; otherwise the card header says it. */
  showPlatform: boolean;
}) {
  const txt = useTravelT();
  const u = urgency(d.departure_ts, nowMs);
  const reachable = walkMin === 0 || catchable(d.departure_ts, nowMs, walkMin);
  const late = d.departure_ts - d.scheduled_ts >= 60;
  return (
    <li
      className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1.5 text-sm ${
        d.cancelled || !reachable ? "opacity-55" : ""
      }`}
    >
      <span className="flex flex-col leading-tight tabular-nums">
        <span className={`font-semibold ${d.cancelled ? "line-through" : ""}`}><Num>{clock(d.departure_ts)}</Num></span>
        {late && !d.cancelled && <span className="text-[11px] text-[#6b6455] dark:text-[#8b93a7] line-through"><Num>{clock(d.scheduled_ts)}</Num></span>}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-[#4a4436] dark:text-[#b9bfcc]">
        {showLine && <LineBadge id={d.line} color={colorOf(d.line)} small />}
        {showPlatform && d.platform && (
          <span className="shrink-0 rounded bg-[#efe8d8] px-1 text-[11px] font-semibold text-[#1d2433] dark:bg-[#1c2436] dark:text-[#e3ddcf]">
            {txt.platform} {d.platform}
          </span>
        )}
        {d.cancelled ? (
          <span className="font-semibold text-[#b42335] dark:text-[#f08a9b]">{txt.cancelled}</span>
        ) : (
          <>
            {d.realtime ? (
              <>
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500"
                  title={txt.liveTracked}
                  role="img"
                  aria-label={txt.liveShort}
                />
                <span className={`min-w-0 truncate ${late ? "font-semibold text-amber-700 dark:text-amber-400" : ""}`}><Num>{delayLabel(d.delay_s)}</Num></span>
              </>
            ) : (
              // Timetable only: a clock and a word, not just a colour.
              <span className="flex shrink-0 items-center gap-0.5 text-[#6b6455] dark:text-[#8b93a7]" title={txt.bySchedule}>
                <Clock size={11} aria-hidden />
                <span aria-hidden>{txt.planned}</span>
                <span className="sr-only">{txt.plannedSr}</span>
              </span>
            )}
            {/* Shrinks long before the status label does, so narrow cards drop the detail first. */}
            <span className="hidden min-w-0 shrink-[100] truncate text-[#6b6455] sm:inline dark:text-[#8b93a7]">
              · {txt.stops(d.stops_remaining)} · {txt.arrShort} <Num>{clock(d.terminus_ts)}</Num>
            </span>
          </>
        )}
      </span>
      <span
        className={`text-right tabular-nums ${
          d.cancelled
            ? "font-semibold text-[#6b6455] dark:text-[#8b93a7]"
            : d.realtime
              ? `font-semibold ${URGENCY_CLASS[u]}`
              : // A planned countdown is a guess: grey and light, never the urgent red.
                "font-normal text-[#6b6455] dark:text-[#8b93a7]"
        }`}
      >
        <Num>{d.cancelled ? "—" : reachable ? countdown(d.departure_ts, nowMs) : txt.notReachable}</Num>
      </span>
    </li>
  );
}
