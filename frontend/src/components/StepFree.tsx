import { Accessibility, Check, Copy } from "lucide-react";
import { CopyStatus, useCopy } from "./CopyTerm";
import { useLang, useT } from "../i18n";
import { GVB_LIFT_FAULTS, StepFree as State, gvbSearch, liftOutSince, shortDate, stepFree } from "../data/accessibility";

/** A small ♿ after a station name in lists and search, for step-free
 *  stations only; limited and unknown get no mark. */
export function StepFreeMark({ station, className = "" }: { station: string; className?: string }) {
  const txt = useT();
  if (stepFree(station) !== "yes") return null;
  return (
    <span title={txt.stepFreeYes} className={`inline-flex shrink-0 text-[#1f3a68] dark:text-[#8aa2ff] ${className}`}>
      <Accessibility size={12} aria-hidden />
      <span className="sr-only">{txt.stepFreeYes}</span>
    </span>
  );
}

/**
 * One line on a station card: whether the station is step-free (checked on
 * GVB's site), or that its lift was out at our last lift check, with the date
 * of that check; and a link to GVB's live lift faults with what to search
 * for there, since a step-free station is only step-free while its lifts
 * work. Reads on the map's grey cards and the travel page's paper alike.
 */
export function StepFree({ station, className = "" }: { station: string; className?: string }) {
  const txt = useT();
  const lang = useLang();
  const state = stepFree(station);
  const liftOut = liftOutSince(station);
  const term = gvbSearch(station);
  const { state: copy, copy: copyTerm } = useCopy(term);
  const label: Record<State, string> = {
    yes: txt.stepFreeYes,
    limited: txt.stepFreeLimited,
    no: txt.stepFreeNo,
    unknown: txt.stepFreeUnknown,
  };
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug text-gray-600 dark:text-gray-400 ${className}`}>
      <Accessibility size={12} className="shrink-0" aria-hidden />
      <span data-step-free={state} data-lift-out={liftOut ? "" : undefined}>
        {liftOut ? txt.liftOut(shortDate(liftOut, lang)) : label[state]}
      </span>
      <span aria-hidden>·</span>
      <a
        href={GVB_LIFT_FAULTS}
        target="_blank"
        rel="noopener noreferrer"
        title={txt.copiesTerm}
        aria-label={`${txt.liftFaultsSearch(term)} (${txt.copiesTerm})`}
        // Puts the search term on the clipboard, to paste into GVB's search
        // box (a link cannot fill it in). The link opens GVB either way; if
        // the clipboard is missing (no HTTPS) or refused, the term is still
        // in the link text, so only a success is shown. The hover text never
        // shows on a phone, hence the visible "Gekopieerd".
        onClick={copyTerm}
        className="inline-flex items-center gap-1 underline decoration-gray-400 underline-offset-2 hover:text-gray-900 dark:hover:text-gray-100"
      >
        {txt.liftFaultsSearch(term)}
        <Copy size={10} className="shrink-0" aria-hidden />
      </a>
      {copy === "copied" && (
        <span aria-hidden className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
          <Check size={10} className="shrink-0" />
          {txt.copied}
        </span>
      )}
      <CopyStatus state={copy === "copied" ? "copied" : "idle"} term={term} />
    </p>
  );
}
