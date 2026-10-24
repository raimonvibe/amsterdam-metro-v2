import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { locale, pick, useLang, useT } from "../i18n";
import { ServiceAlert } from "../types";
import { Place } from "./Place";
import { onColor } from "../contrast";

/** Messages that concern a station: about the station itself, or about a
 *  whole line that calls there. */
export function alertsFor(alerts: ServiceAlert[], station: { name: string; lines: string[] }): ServiceAlert[] {
  return alerts.filter((a) =>
    a.stations.length
      ? a.stations.includes(station.name)
      : a.lines.some((l) => station.lines.includes(l)),
  );
}

/** Line-wide messages: the ones that change what a rider can expect anywhere. */
export function lineWide(alerts: ServiceAlert[]): ServiceAlert[] {
  return alerts.filter((a) => !a.stations.length || a.whole_line);
}

/**
 * Reads each new line-wide message to screen readers once (WCAG 4.1.3), in
 * a polite live region: it waits for the reader to finish, and a refresh
 * that brings nothing new says nothing.
 */
export function AlertAnnouncer({ alerts }: { alerts: ServiceAlert[] }) {
  const txt = useT();
  const lang = useLang();
  const announced = useRef(new Set<string>());
  const [text, setText] = useState("");
  useEffect(() => {
    const fresh = lineWide(alerts).filter((a) => !announced.current.has(a.id));
    if (!fresh.length) return;
    fresh.forEach((a) => announced.current.add(a.id));
    setText(
      fresh
        .map((a) => txt.alertAnnounce(a.lines.map((l) => `${txt.line.toLowerCase()} ${l}`).join(", "), pick(a.header, lang)))
        .join(". "),
    );
  }, [alerts, txt, lang]);
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {text}
    </div>
  );
}

export interface AlertListProps {
  alerts: ServiceAlert[];
  colorOf: (line: string) => string;
  /** Header only, no details or station names: for small cards. */
  compact?: boolean;
  className?: string;
}

/** Amber notices that read on the map's grey cards and the travel page's
 *  paper alike. Renders nothing without alerts. */
export function AlertList({ alerts, colorOf, compact = false, className = "" }: AlertListProps) {
  const txt = useT();
  const lang = useLang();
  if (!alerts.length) return null;
  const hm = new Intl.DateTimeFormat(locale(lang), { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
  return (
    <ul className={`space-y-1.5 ${className}`} aria-label={txt.alertsTitle}>
      {alerts.map((a) => {
        const header = pick(a.header, lang);
        const description = a.description ? pick(a.description, lang) : null;
        if (compact) {
          // One quiet row: the message itself, cut to two lines.
          return (
            <li
              key={a.id}
              className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <TriangleAlert size={12} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="line-clamp-2 min-w-0 break-words" translate="no" title={header}>
                {header}
                {a.end_ts && <span className="text-amber-700 dark:text-amber-300"> · {txt.alertUntil(hm.format(new Date(a.end_ts * 1000)))}</span>}
              </p>
            </li>
          );
        }
        return (
          <li
            key={a.id}
            className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs leading-snug text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center gap-1">
                {a.lines.map((l) => (
                  <span
                    key={l}
                    className="inline-flex h-4 min-w-6 items-center justify-center rounded px-1 text-[11px] font-bold"
                    style={{ backgroundColor: colorOf(l), color: onColor(colorOf(l)) }}
                    translate="no"
                  >
                    {l}
                  </span>
                ))}
                {a.lines.length > 0 && (!a.stations.length || a.whole_line) && (
                  // A whole-line message lists its stations on wide screens;
                  // on a phone that list is long, so the label stands in for it.
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 ${
                      a.stations.length ? "sm:hidden" : ""
                    }`}
                  >
                    {txt.alertLineWide}
                  </span>
                )}
                {a.end_ts && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-300">
                    {txt.alertUntil(hm.format(new Date(a.end_ts * 1000)))}
                  </span>
                )}
              </div>
              {/* GVB's own words, already in the chosen language: no browser translation. */}
              <p className="break-words" translate="no">{header}</p>
              {a.stations.length > 0 && (
                <p className={`mt-0.5 text-[11px] text-amber-800 dark:text-amber-200 ${a.whole_line ? "hidden sm:block" : ""}`}>
                  {a.stations.map((s, i) => (
                    <span key={s}>
                      {i > 0 && ", "}
                      <Place name={s} />
                    </span>
                  ))}
                </p>
              )}
              {description && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] font-medium text-amber-800 dark:text-amber-200">
                    {txt.alertMore}
                  </summary>
                  <p className="mt-1 whitespace-pre-line break-words" translate="no">{description}</p>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
