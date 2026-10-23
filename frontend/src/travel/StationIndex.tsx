import { useMemo, useState } from "react";
import { History, LocateFixed, Star, X } from "lucide-react";
import { formatPlaceName } from "../format";
import { Place } from "../components/Place";
import { Station } from "../types";
import { LineBadge, Section } from "./ui";

export interface StationIndexProps {
  stations: Station[];
  lineIds: string[];
  colorOf: (line: string) => string;
  current: Station | null;
  favourites: string[];
  recent: string[];
  locating: boolean;
  onStation: (name: string) => void;
  onNearby: () => void;
  onClearRecent: () => void;
}

/** Stations A-Z by display name, optionally only those on one line. */
export function sortedStations(stations: Station[], line: string | null): Station[] {
  return stations
    .filter((s) => !line || s.lines.includes(line))
    .sort((a, b) => formatPlaceName(a.name).localeCompare(formatPlaceName(b.name), "nl"));
}

export function StationIndex(p: StationIndexProps) {
  const [line, setLine] = useState<string | null>(null);
  const all = useMemo(() => sortedStations(p.stations, line), [p.stations, line]);
  const byName = useMemo(() => new Map(p.stations.map((s) => [s.name, s])), [p.stations]);

  const chip = (name: string, icon?: React.ReactNode) => {
    const s = byName.get(name);
    if (!s) return null;
    const here = p.current?.name === name;
    return (
      <li key={name}>
        <button
          type="button"
          onClick={() => p.onStation(name)}
          aria-current={here ? "true" : undefined}
          className={`flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition hover:bg-[#f1ebdd] dark:hover:bg-[#1a2134] ${
            here ? "bg-[#f1ebdd] font-semibold dark:bg-[#1a2134]" : ""
          }`}
        >
          {icon}
          <span className="min-w-0 flex-1 truncate"><Place name={name} /></span>
          <span className="flex shrink-0 gap-0.5">
            {s.lines.map((l) => (
              <LineBadge key={l} id={l} color={p.colorOf(l)} small />
            ))}
          </span>
        </button>
      </li>
    );
  };

  return (
    <Section n={1} id="stations" title="Stations">
      <button
        type="button"
        onClick={p.onNearby}
        disabled={p.locating}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#1f3a68] px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-[#182e54] disabled:opacity-60 dark:bg-[#c8a951] dark:text-[#111727] dark:hover:bg-[#d6ba67]"
      >
        <LocateFixed size={14} aria-hidden />
        {p.locating ? "Locatie bepalen…" : "Dichtstbijzijnde station"}
      </button>

      <h3 className="smallcaps mt-3 flex items-center gap-1 text-xs font-semibold text-[#7b2132] dark:text-[#c8a951]">
        <Star size={12} aria-hidden /> Favorieten
      </h3>
      {p.favourites.length === 0 ? (
        <p className="mt-1 text-[11px] leading-snug text-[#7a7262] dark:text-[#8b93a7]">
          Markeer een station met ★ Favoriet om het hier snel terug te vinden.
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">{p.favourites.map((n) => chip(n))}</ul>
      )}

      {p.recent.length > 0 && (
        <>
          <h3 className="smallcaps mt-3 flex items-center gap-1 text-xs font-semibold text-[#7b2132] dark:text-[#c8a951]">
            <History size={12} aria-hidden /> Recent
            <button
              type="button"
              onClick={p.onClearRecent}
              className="ml-auto rounded p-0.5 text-[#9a9384] hover:text-[#1d2433] dark:hover:text-[#ece6d6]"
              aria-label="Recente stations wissen"
              title="Wissen"
            >
              <X size={12} />
            </button>
          </h3>
          <ul className="mt-1 space-y-0.5">{p.recent.map((n) => chip(n))}</ul>
        </>
      )}

      <h3 className="smallcaps mt-3 text-xs font-semibold text-[#7b2132] dark:text-[#c8a951]">Alle stations A–Z</h3>
      <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Toon stations van lijn">
        <button
          type="button"
          onClick={() => setLine(null)}
          aria-pressed={line === null}
          className={`h-5 rounded px-1.5 text-[10px] font-semibold ${line === null ? "bg-[#1f3a68] text-white dark:bg-[#c8a951] dark:text-[#111727]" : "bg-[#f1ebdd] dark:bg-[#1a2134]"}`}
        >
          alle
        </button>
        {p.lineIds.map((l) => (
          <button key={l} type="button" onClick={() => setLine(line === l ? null : l)} aria-pressed={line === l} className={line && line !== l ? "opacity-40" : ""}>
            <LineBadge id={l} color={p.colorOf(l)} />
          </button>
        ))}
      </div>
      <ul className="mt-1.5 space-y-0.5" aria-label="Alle stations">
        {all.map((s) => chip(s.name))}
      </ul>
    </Section>
  );
}
