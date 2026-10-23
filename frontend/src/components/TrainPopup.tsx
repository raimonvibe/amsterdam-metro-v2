import { useRef } from "react";
import { X } from "lucide-react";
import { delayLabel } from "../format";
import { Place } from "./Place";
import { nl } from "../i18n/nl";
import { AnimatedTrain } from "../types";
import { Num } from "./Num";

interface TrainPopupProps {
  train: AnimatedTrain;
  lineName?: string;
  color: string;
  /** Train position in map-container pixels; the card sits above it. */
  x: number;
  y: number;
  containerWidth: number;
  nowMs: number;
  /** Touch screens: the popup belongs to a followed train and gets a close
   *  button, since there is no hover to end it. */
  onClose?: () => void;
}

// Dutch decimal comma, always one decimal: "47,3".
const PCT = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const CARD_W = 264;
const EDGE_PAD = 8;
/** Clear of the glow sprite so the card never covers the train it describes. */
const ANCHOR_GAP = 26;
/**
 * Slack before the card flips back above the train. Without it a train running
 * along the flip line toggles the card above/below on alternate frames.
 */
const FLIP_HYSTERESIS = 40;
/** Card height before the first measurement — the usual size of the card. */
const CARD_H_GUESS = 230;

// The timetable is Amsterdam time; a visitor abroad still reads the platform clock.
const HM = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function clockParts(ms: number): { h: number; m: number; s: number } {
  const p = HM.formatToParts(ms);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { h: get("hour"), m: get("minute"), s: get("second") };
}

const hhmm = (ms: number) => {
  const { h, m } = clockParts(ms);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Point on a circle, 0° = 12 o'clock, clockwise. */
const polar = (r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [32 + r * Math.cos(a), 32 + r * Math.sin(a)];
};

/**
 * Analog face for the arrival at the terminus. A wedge fills the dial from where
 * the minute hand is now to where it will be on arrival. Aimed at the
 * terminus, not the next stop: a hop between stations is 1-2 minutes, which is
 * a 6-12° sliver on this dial; the rest of the run is long enough to read.
 */
function ArrivalClock({ nowMs, arrivalMs, color }: { nowMs: number; arrivalMs: number; color: string }) {
  const { h, m, s } = clockParts(nowMs);
  const minuteDeg = (m + s / 60) * 6;
  const hourDeg = ((h % 12) + m / 60) * 30;
  // A full hour or more would close the circle; stop just short so it still reads as a wedge.
  const sweep = Math.min(Math.max(((arrivalMs - nowMs) / 3_600_000) * 360, 0), 359);
  // Out to the inner edge of the dial's border, so the slice meets the rim
  // with no gap and needs no outline of its own.
  const R = 29.25;
  const [ax, ay] = polar(R, minuteDeg);
  const [bx, by] = polar(R, minuteDeg + sweep);
  // Pie slice from the hub: the whole time span is filled, not just traced on the rim.
  const wedge = `M 32 32 L ${ax} ${ay} A ${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${bx} ${by} Z`;
  const [mx, my] = polar(21, minuteDeg);
  const [hx, hy] = polar(14, hourDeg);

  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-hidden>
      <circle cx="32" cy="32" r="30" className="fill-white stroke-gray-300 dark:fill-gray-900 dark:stroke-gray-700" strokeWidth="1.5" />
      {sweep > 0.5 && <path d={wedge} fill={color} fillOpacity="0.45" />}
      {Array.from({ length: 12 }, (_, i) => {
        const [x0, y0] = polar(i % 3 === 0 ? 25 : 27, i * 30);
        const [x1, y1] = polar(29, i * 30);
        return (
          <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={i % 3 === 0 ? 1.6 : 1}
            className="stroke-gray-400 dark:stroke-gray-500" />
        );
      })}
      <line x1="32" y1="32" x2={hx} y2={hy} strokeWidth="2.6" strokeLinecap="round" className="stroke-gray-800 dark:stroke-gray-100" />
      <line x1="32" y1="32" x2={mx} y2={my} strokeWidth="1.8" strokeLinecap="round" className="stroke-gray-800 dark:stroke-gray-100" />
      <circle cx="32" cy="32" r="2" className="fill-gray-800 dark:fill-gray-100" />
    </svg>
  );
}

/** Progress through the current segment, by clock — the same lerp the server solves with. */
function segmentProgress(train: AnimatedTrain, nowMs: number): number {
  if (train.status === "dwelling") return 0;
  const { prev_departure_ts: start, next_arrival_ts: end } = train;
  if (!start || !end || end <= start) return 0;
  return Math.min(Math.max((nowMs / 1000 - start) / (end - start), 0), 1);
}

export function TrainPopup({ train, lineName, color, x, y, containerWidth, nowMs, onClose }: TrainPopupProps) {
  const progress = segmentProgress(train, nowMs) * 100;
  const pct = Math.round(progress);
  const nextMs = train.next_arrival_ts ? train.next_arrival_ts * 1000 : null;
  // An older backend sends no terminus time; the next stop is the best it has.
  const finalMs = train.final_arrival_ts ? train.final_arrival_ts * 1000 : nextMs;
  const minsUntil = (ms: number) => {
    const m = Math.max(0, Math.round((ms - nowMs) / 60000));
    return m === 0 ? nl.now : `${m} ${nl.min}`;
  };
  const left = Math.min(Math.max(x - CARD_W / 2, EDGE_PAD), containerWidth - CARD_W - EDGE_PAD);

  // Flip below the train when the card no longer fits above it, and only flip
  // back once it fits with room to spare. Height comes from the last frame.
  const cardRef = useRef<HTMLDivElement>(null);
  const belowRef = useRef(false);
  const needed = (cardRef.current?.offsetHeight ?? CARD_H_GUESS) + ANCHOR_GAP + EDGE_PAD;
  if (!belowRef.current && y < needed) belowRef.current = true;
  else if (belowRef.current && y > needed + FLIP_HYSTERESIS) belowRef.current = false;
  const below = belowRef.current;

  return (
    <div
      ref={cardRef}
      role="tooltip"
      // Opaque, no backdrop blur: the map under it redraws ~30x a second, and
      // re-blurring that every frame is real GPU work on low-end devices.
      className="pointer-events-none absolute z-30 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
      style={{
        width: CARD_W,
        left,
        top: below ? y + ANCHOR_GAP : y - ANCHOR_GAP,
        transform: below ? undefined : "translateY(-100%)",
      }}
    >
      {onClose && (
        // The card itself lets taps through to the map; only this button takes them.
        <button
          type="button"
          onClick={onClose}
          aria-label={nl.stopFollow}
          className="pointer-events-auto absolute -right-1 -top-1 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:bg-gray-200 dark:text-gray-400 dark:active:bg-gray-800"
        >
          <X size={18} />
        </button>
      )}
      <div className={`mb-2 flex items-center gap-2 ${onClose ? "pr-8" : ""}`}>
        <span
          className="flex h-5 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold text-gray-950"
          style={{ backgroundColor: color }}
        >
          {train.line}
        </span>
        <div className="min-w-0">
          <div className="break-words text-sm font-semibold leading-snug">→ <Place name={train.headsign ?? ""} /></div>
          {lineName && (
            <div className="break-words text-[11px] leading-snug text-gray-500 dark:text-gray-400">
              {nl.line} {train.line} · {lineName}
            </div>
          )}
        </div>
      </div>

      <div className="mb-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span className="text-gray-500 dark:text-gray-400">{train.status === "dwelling" ? nl.atStation : nl.from}</span>
        <span className="min-w-0 break-words font-medium">
          <Place name={train.prev_station ?? "–"} />
          {train.status === "dwelling" && <PlatformTag platform={train.platform} />}
        </span>
        <span className="text-gray-500 dark:text-gray-400">{nl.to}</span>
        <span className="min-w-0 break-words font-medium">
          {train.next_station ? <Place name={train.next_station} /> : nl.terminus}
          {train.status === "moving" && train.next_station && <PlatformTag platform={train.platform} />}
        </span>
      </div>
      {/* Carried over from the sidebar card this popup replaced. */}
      <div className="mb-2 text-[11px]">
        <span
          className={
            train.delay_s > 60
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          }
        >
          <Num>{delayLabel(train.delay_s)}</Num>
        </span>
        {!train.realtime && (
          <span className="text-gray-400 dark:text-gray-500"> · {nl.scheduledNoRt}</span>
        )}
      </div>

      <div className="mb-2.5">
        <div className="mb-1 flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
          <span className="tabular-nums">{PCT.format(progress)}%</span>
          {train.stops_remaining != null && <span>{nl.stopsLeft(train.stops_remaining)}</span>}
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              // Faint where the segment began, full line colour at the train;
              // translucent rather than whitened so it reads on both themes.
              backgroundImage: `linear-gradient(90deg, ${color}40, ${color})`,
            }}
          />
        </div>
      </div>

      {finalMs && (
        <div className="flex items-center gap-3">
          <ArrivalClock nowMs={nowMs} arrivalMs={finalMs} color={color} />
          <div className="min-w-0">
            <div className="break-words text-[11px] leading-snug text-gray-500 dark:text-gray-400">
              {nl.arrivesAt} <Place name={train.headsign ?? train.next_station ?? ""} />
            </div>
            <div className="text-lg font-bold tabular-nums leading-tight">
              <Num>{hhmm(finalMs)}</Num>{" "}
              <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400"><Num>{minsUntil(finalMs)}</Num></span>
            </div>
            {nextMs && train.next_station && nextMs !== finalMs && (
              <div className="break-words text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                <Place name={train.next_station} /> <Num>{hhmm(nextMs)}</Num> · <Num>{minsUntil(nextMs)}</Num>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** "· perron 2" after a station; nothing where the timetable has no platform. */
function PlatformTag({ platform }: { platform?: string | null }) {
  if (!platform) return null;
  return (
    <span className="whitespace-nowrap font-normal text-gray-500 dark:text-gray-400">
      {" "}
      · {nl.platform} {platform}
    </span>
  );
}
