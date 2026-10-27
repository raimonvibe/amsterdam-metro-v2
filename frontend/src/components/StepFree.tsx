import { Accessibility } from "lucide-react";
import { useT } from "../i18n";
import { GVB_LIFT_FAULTS, StepFree as State, stepFree } from "../data/accessibility";

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
 * One line on a station card: whether the station is step-free (OpenStreetMap,
 * curated), and a link to GVB's live lift faults, since a step-free station
 * is only step-free while its lifts work. Reads on the map's grey cards and
 * the travel page's paper alike.
 */
export function StepFree({ station, className = "" }: { station: string; className?: string }) {
  const txt = useT();
  const state = stepFree(station);
  const label: Record<State, string> = {
    yes: txt.stepFreeYes,
    limited: txt.stepFreeLimited,
    no: txt.stepFreeNo,
    unknown: txt.stepFreeUnknown,
  };
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug text-gray-600 dark:text-gray-400 ${className}`}>
      <Accessibility size={12} className="shrink-0" aria-hidden />
      <span data-step-free={state}>{label[state]}</span>
      <span aria-hidden>·</span>
      <a
        href={GVB_LIFT_FAULTS}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-gray-400 underline-offset-2 hover:text-gray-900 dark:hover:text-gray-100"
      >
        {txt.liftFaults}
      </a>
    </p>
  );
}
