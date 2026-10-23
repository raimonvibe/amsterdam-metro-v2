import { KeyboardEvent, Ref, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, LocateFixed, Search, TrainTrack } from "lucide-react";
import { formatPlaceName } from "../format";
import { Place } from "../components/Place";
import { Station } from "../types";
import { SearchResult, allStations, search, searchStations } from "./search";
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
  // -1: nothing picked with the arrows yet (see `current` below).
  const [active, setActive] = useState(-1);

  const boxRef = useRef<HTMLDivElement>(null);

  const typed = query.trim().length > 0;
  const hits: SearchResult[] = useMemo(() => {
    if (mode === "station") {
      const found: SearchResult[] = searchStations(query, stations, 8);
      return onNearby && /^(dichtbij|hier|locatie)$/i.test(query.trim()) ? [{ kind: "nearby", score: 300 }, ...found] : found;
    }
    return search(query, stations, lineIds, 9);
  }, [query, stations, lineIds, mode, onNearby]);
  // With nothing typed, or nothing found, the list holds every station, so a
  // name can be picked without a keyboard that types Dutch.
  const browsing = !typed || hits.length === 0;
  const results: SearchResult[] = useMemo(() => (browsing ? allStations(stations) : hits), [browsing, hits, stations]);
  // Enter takes the best hit, but never a station from the full list that
  // nobody pointed at.
  const current = active >= 0 ? active : browsing ? -1 : 0;

  // Opened with the arrow button the input never gets focus, so a tap
  // anywhere else has to close the list.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const choose = (r: SearchResult) => {
    if (r.kind === "station") onStation(r.station);
    else if (r.kind === "line") onLine?.(r.line);
    else if (r.kind === "route") onRoute?.(r.from, r.to);
    else onNearby?.();
    setQuery("");
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive(Math.min(current + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === "Enter") {
      if (results[current]) {
        e.preventDefault();
        choose(results[current]);
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
  const showList = open && results.length > 0;

  return (
    <div ref={boxRef} className="relative w-full">
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
          aria-activedescendant={showList && results[current] ? `${id}-opt-${current}` : undefined}
          autoComplete="off"
          spellCheck={false}
          translate={value ? "no" : undefined}
          placeholder={value ? formatPlaceName(value) : shownPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={(e) => {
            if (!boxRef.current?.contains(e.relatedTarget as Node | null)) setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          className={`w-full rounded-md border border-[#cfc4ad] bg-white pl-8 pr-9 text-[#1d2433] shadow-inner outline-none transition placeholder:text-[#8a8170] focus:border-[#1f3a68] focus:ring-2 focus:ring-[#1f3a68]/25 dark:border-[#33405c] dark:bg-[#0d1322] dark:text-[#ece6d6] dark:placeholder:text-[#8b93a7] dark:focus:border-[#c8a951] dark:focus:ring-[#c8a951]/25 ${
            compact ? "h-9 text-sm" : "h-10 text-[15px]"
          } ${value ? "placeholder:font-semibold placeholder:text-[#1d2433] dark:placeholder:text-[#ece6d6]" : ""}`}
        />
        {/* Opens the full list without focusing the input, so a phone shows
            no keyboard: tap a name instead of typing it. */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Alle stations tonen"
          title="Alle stations tonen"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setActive(-1);
            setOpen((o) => !o);
          }}
          className={`absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded text-[#6b6455] transition hover:bg-[#f1ebdd] dark:text-[#9aa2b5] dark:hover:bg-[#1a2134] ${
            compact ? "h-8 w-8" : "h-9 w-9"
          }`}
        >
          <ChevronDown size={16} className={`transition-transform ${showList ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 max-h-80 w-full min-w-64 overflow-y-auto rounded-md border border-[#d8cfbd] bg-[#fffdf8] py-1 shadow-lg dark:border-[#2a3245] dark:bg-[#111727]"
        >
          {typed && browsing && (
            <li role="presentation" className="px-3 py-2 text-sm text-[#6b6455] dark:text-[#9aa2b5]">
              Geen station gevonden voor “{query}”. Kies hieronder:
            </li>
          )}
          {!typed && mode === "all" && (
            <li role="presentation" className="border-b border-[#efe8d8] px-3 pb-2 pt-1 text-xs leading-relaxed text-[#5b5446] dark:border-[#1c2436] dark:text-[#a9b0c2]">
              <span className="smallcaps font-semibold text-[#7b2132] dark:text-[#c8a951]">Probeer</span>{" "}
              <kbd className="font-sans">arena</kbd> · <kbd className="font-sans">52</kbd> ·{" "}
              <kbd className="font-sans">noord naar gein</kbd> · <kbd className="font-sans">dichtbij</kbd> ·{" "}
              <kbd className="font-sans">waterlopolein</kbd>
            </li>
          )}
          {browsing && (
            <li role="presentation" className="smallcaps px-3 pb-0.5 pt-1.5 text-[11px] font-semibold text-[#7b2132] dark:text-[#c8a951]">
              Alle stations
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={resultKey(r)}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === current}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                i === current ? "bg-[#f1ebdd] dark:bg-[#1a2134]" : ""
              }`}
            >
              <ResultRow result={r} colorOf={colorOf} />
            </li>
          ))}
        </ul>
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
