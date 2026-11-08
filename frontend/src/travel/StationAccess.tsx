import { ChevronRight } from "lucide-react";
import { accessState, gvbChecked, gvbSaysStepFree, stationSlug, stepFreeAlternatives, stepFreeReachable } from "../data/network";
import { getLang } from "../i18n";
import { stationPath } from "../i18n/paths";
import { Place } from "../components/Place";
import { LineBadge } from "./ui";
import { useTravelT } from "./strings";

interface Props {
  station: string;
  colorOf: (line: string) => string;
  onStation: (name: string) => void;
  nowMs?: number;
}

/** A station name that opens its board here, and is a real link to its page
 *  (new tab, copy link, crawlers). */
function StationLink({ name, onStation }: { name: string; onStation: (name: string) => void }) {
  return (
    <a
      href={stationPath(stationSlug(name), getLang())}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onStation(name);
      }}
      className="underline decoration-[#c4b8a0] underline-offset-2 hover:text-[#1d2433] dark:decoration-[#4e483a] dark:hover:text-[#f3eee2]"
    >
      <Place name={name} />
    </a>
  );
}

/**
 * What the step-free line on the board doesn't say by itself (see
 * docs/seo-tidy-plan.md, research of 8 Nov):
 * - why a station is "not step-free": GVB says so, or it isn't confirmed;
 * - with a lift out, where to get on or off step-free instead, per direction;
 * - which stations are step-free without changing trains.
 */
export function StationAccess({ station, colorOf, onStation, nowMs = Date.now() }: Props) {
  const txt = useTravelT();
  const state = accessState(station, nowMs);
  const alternatives = state === "lift-out" ? stepFreeAlternatives(station, nowMs) : [];
  const reach = stepFreeReachable(station, nowMs);

  return (
    <div className="mt-1 space-y-1 text-[11px] leading-snug text-[#6b6455] dark:text-[#8b93a7]">
      {/* A stale lift fault (GVB's page says step-free, but the last lift
          check is too old to show) gets no reason: we don't know one. */}
      {state === "not-step-free" && !gvbSaysStepFree(station) && (
        <p>{gvbChecked(station) ? txt.notStepFreeGvb : txt.notStepFreeUnchecked}</p>
      )}
      {alternatives.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[#4a4436] dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-[#d8d2c2]">
          <p className="font-semibold">{txt.liftOutInstead}</p>
          <ul className="mt-0.5 space-y-0.5">
            {alternatives.map((a) => (
              <li key={`${a.line}-${a.terminus}`} className="flex flex-wrap items-center gap-1">
                <LineBadge id={a.line} color={colorOf(a.line)} small />
                <span>
                  {txt.towards} <Place name={a.terminus} />:
                </span>
                <ChevronRight size={11} aria-hidden className="shrink-0" />
                <StationLink name={a.station} onStation={onStation} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="group">
        <summary className="cursor-pointer select-none leading-6 underline decoration-dotted underline-offset-2">{txt.reachTitle}</summary>
        <ul className="mt-1 space-y-1">
          {reach.map((r) => (
            <li key={r.line} className="flex flex-wrap items-baseline gap-x-1">
              <LineBadge id={r.line} color={colorOf(r.line)} small />
              {r.stations.length === 0
                ? txt.reachNone
                : r.stations.map((s, i) => (
                    <span key={s}>
                      <StationLink name={s} onStation={onStation} />
                      {i < r.stations.length - 1 ? "," : ""}
                    </span>
                  ))}
            </li>
          ))}
        </ul>
        <p className="mt-1">{txt.reachNote}</p>
      </details>
    </div>
  );
}
