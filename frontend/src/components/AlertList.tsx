import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { type Lang, locale, pick, pickWithLang, useLang, useT } from "../i18n";
import { ServiceAlert } from "../types";
import { formatPlaceName } from "../format";
import { NO_TRANSLATE } from "./Num";
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

/** When a message ends: "18:00" today, otherwise with its day ("za 14 nov.,
 *  01:00"). A bare time five days ahead reads as "tonight". */
export function alertEnd(endTs: number, lang: Lang, now: number = Date.now()): string {
  const tz = { timeZone: "Europe/Amsterdam" } as const;
  const loc = locale(lang);
  const time = new Intl.DateTimeFormat(loc, { ...tz, hour: "2-digit", minute: "2-digit" }).format(new Date(endTs * 1000));
  const day = (t: number) => new Intl.DateTimeFormat("en-CA", tz).format(new Date(t));
  if (day(endTs * 1000) === day(now)) return time;
  const date = new Intl.DateTimeFormat(loc, { ...tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(endTs * 1000));
  return `${date}, ${time}`;
}

/** A message's stations as one list: without any town ("Diemen, Verrijn
 *  Stuartweg" in a comma list reads as two places), A–Z by that name. */
export function alertStations(stations: string[]): string {
  return stations
    .map((s) => formatPlaceName(s).replace(/^[^,]+, /, ""))
    .sort((a, b) => a.localeCompare(b, "nl"))
    .join(", ");
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
  return (
    <ul className={`space-y-1.5 ${className}`} aria-label={txt.alertsTitle}>
      {alerts.map((a) => {
        // GVB's words: translatable like the rest of the page (a visitor
        // reading it in Ukrainian needs the message most), marked with the
        // language they are in, since English falls back to GVB's Dutch.
        const header = pickWithLang(a.header, lang);
        const description = a.description ? pickWithLang(a.description, lang) : null;
        if (compact) {
          // One quiet row: the message itself, cut to two lines.
          return (
            <li
              key={a.id}
              className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <TriangleAlert size={12} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="line-clamp-2 min-w-0 break-words" title={header.text}>
                <span lang={header.lang}>{header.text}</span>
                {a.end_ts && <span className="text-amber-700 dark:text-amber-300"> · {txt.alertUntil(alertEnd(a.end_ts, lang))}</span>}
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
                  // A whole-line message names every station of its lines:
                  // the badges and this label say that in two words.
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    {a.lines.length > 1 ? txt.alertLinesWide : txt.alertLineWide}
                  </span>
                )}
                {a.end_ts && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-300">
                    {txt.alertUntil(alertEnd(a.end_ts, lang))}
                  </span>
                )}
              </div>
              <p className="break-words" lang={header.lang}>{header.text}</p>
              {a.stations.length > 0 && !a.whole_line && (
                // Names and their commas in one untranslated run: a translator
                // drops the spaces in a lone ", " between two names.
                <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-200">
                  <span {...NO_TRANSLATE}>{alertStations(a.stations)}</span>
                </p>
              )}
              {description && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] font-medium text-amber-800 dark:text-amber-200">
                    {txt.alertMore}
                  </summary>
                  <p className="mt-1 whitespace-pre-line break-words" lang={description.lang}>{description.text}</p>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
