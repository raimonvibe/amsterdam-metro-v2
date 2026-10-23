import { KeyboardEvent, Ref, useId, useMemo, useState } from "react";
import { ArrowRight, LocateFixed, Search, TrainTrack } from "lucide-react";
import { formatPlaceName } from "../format";
import { Place } from "../components/Place";
import { Station } from "../types";
import { SearchResult, search, searchStations } from "./search";
import { LineBadge, useNarrowScreen } from "./ui";

export interface SearchBoxProps {
  label: string;
  placeholder: string;
  /** Used on phone-width screens, where the full placeholder gets cut off. */
  shortPlaceholder?: string;
  stations: Station[];
  lineIds: string[];
  colorOf: (line: string) => string;
  /** "all": stations, lines, trips and "dichtbij"; "station": stations only. */
  mode?: "all" | "station";
  /** Shown in the field when not typing (e.g. the chosen station). */
  value?: string;
  inputRef?: Ref<HTMLInputElement>;
  compact?: boolean;
  onStation: (station: Station) => void;
  onLine?: (line: string) => void;
  onRoute?: (from: Station, to: Station) => void;
  onNearby?: () => void;
}

export function SearchBox({
  label,
  placeholder,
  shortPlaceholder,
  stations,
  lineIds,
  colorOf,
  mode = "all",
  value,
  inputRef,
  compact = false,
  onStation,
  onLine,
  onRoute,
  onNearby,
}: SearchBoxProps) {
  const id = useId();
  const narrow = useNarrowScreen();
  const shownPlaceholder = narrow && shortPlaceholder ? shortPlaceholder : placeholder;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results: SearchResult[] = useMemo(() => {
    if (mode === "station") {
      const hits: SearchResult[] = searchStations(query, stations, 8);
      return onNearby && /^(dichtbij|hier|locatie)$/i.test(query.trim()) ? [{ kind: "nearby", score: 300 }, ...hits] : hits;
    }
    return search(query, stations, lineIds, 9);
  }, [query, stations, lineIds, mode, onNearby]);

  const choose = (r: SearchResult) => {
    if (r.kind === "station") onStation(r.station);
    else if (r.kind === "line") onLine?.(r.line);
    else if (r.kind === "route") onRoute?.(r.from, r.to);
    else onNearby?.();
    setQuery("");
    setOpen(false);
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === "Escape") {
      if (query || open) {
        e.stopPropagation();
        setQuery("");
        setOpen(false);
      }
    }
  };

  const listId = `${id}-list`;
  const showList = open && query.trim().length > 0;
  const showHint = open && !query.trim() && mode === "all";

  return (
    <div className="relative w-full">
      <label htmlFor={`${id}-input`} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search size={compact ? 14 : 16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8170] dark:text-[#8b93a7]" aria-hidden />
        <input
          id={`${id}-input`}
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={label}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          translate={value ? "no" : undefined}
          placeholder={value ? formatPlaceName(value) : shownPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className={`w-full rounded-md border border-[#cfc4ad] bg-white pl-8 pr-2 text-[#1d2433] shadow-inner outline-none transition placeholder:text-[#8a8170] focus:border-[#1f3a68] focus:ring-2 focus:ring-[#1f3a68]/25 dark:border-[#33405c] dark:bg-[#0d1322] dark:text-[#ece6d6] dark:placeholder:text-[#8b93a7] dark:focus:border-[#c8a951] dark:focus:ring-[#c8a951]/25 ${
            compact ? "h-9 text-sm" : "h-10 text-[15px]"
          } ${value ? "placeholder:font-semibold placeholder:text-[#1d2433] dark:placeholder:text-[#ece6d6]" : ""}`}
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 max-h-80 w-full min-w-64 overflow-y-auto rounded-md border border-[#d8cfbd] bg-[#fffdf8] py-1 shadow-lg dark:border-[#2a3245] dark:bg-[#111727]"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-[#6b6455] dark:text-[#9aa2b5]">Geen station gevonden voor “{query}”.</li>
          )}
          {results.map((r, i) => (
            <li
              key={resultKey(r)}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                i === active ? "bg-[#f1ebdd] dark:bg-[#1a2134]" : ""
              }`}
            >
              <ResultRow result={r} colorOf={colorOf} />
            </li>
          ))}
        </ul>
      )}

      {showHint && (
        <div className="absolute z-30 mt-1 w-full min-w-64 rounded-md border border-[#d8cfbd] bg-[#fffdf8] px-3 py-2 text-xs leading-relaxed text-[#5b5446] shadow-lg dark:border-[#2a3245] dark:bg-[#111727] dark:text-[#a9b0c2]">
          <span className="smallcaps font-semibold text-[#7b2132] dark:text-[#c8a951]">Probeer</span>{" "}
          <kbd className="font-sans">arena</kbd> · <kbd className="font-sans">52</kbd> ·{" "}
          <kbd className="font-sans">noord naar gein</kbd> · <kbd className="font-sans">dichtbij</kbd> ·{" "}
          <kbd className="font-sans">waterlopolein</kbd>
        </div>
      )}
    </div>
  );
}

function resultKey(r: SearchResult): string {
  if (r.kind === "station") return `s:${r.station.name}`;
  if (r.kind === "line") return `l:${r.line}`;
  if (r.kind === "route") return `r:${r.from.name}>${r.to.name}`;
  return "nearby";
}

function ResultRow({ result: r, colorOf }: { result: SearchResult; colorOf: (l: string) => string }) {
  if (r.kind === "nearby") {
    return (
      <>
        <LocateFixed size={15} className="shrink-0 text-[#1f3a68] dark:text-[#c8a951]" aria-hidden />
        <span className="font-medium">Dichtstbijzijnde station</span>
        <span className="ml-auto text-[11px] text-[#8a8170]">via uw locatie</span>
      </>
    );
  }
  if (r.kind === "route") {
    return (
      <>
        <ArrowRight size={15} className="shrink-0 text-[#1f3a68] dark:text-[#c8a951]" aria-hidden />
        <span className="min-w-0 truncate">
          Reis van <strong><Place name={r.from.name} /></strong> naar <strong><Place name={r.to.name} /></strong>
        </span>
      </>
    );
  }
  if (r.kind === "line") {
    return (
      <>
        <TrainTrack size={15} className="shrink-0 text-[#1f3a68] dark:text-[#c8a951]" aria-hidden />
        <LineBadge id={r.line} color={colorOf(r.line)} small />
        <span>Lijnoverzicht metro {r.line}</span>
      </>
    );
  }
  return (
    <>
      <span className="min-w-0 flex-1 truncate">
        <Place name={r.station.name} />
        {r.via && <span className="ml-1.5 text-[11px] italic text-[#8a8170] dark:text-[#8b93a7]">({r.via})</span>}
      </span>
      <span className="flex shrink-0 gap-0.5">
        {r.station.lines.map((l) => (
          <LineBadge key={l} id={l} color={colorOf(l)} small />
        ))}
      </span>
    </>
  );
}
