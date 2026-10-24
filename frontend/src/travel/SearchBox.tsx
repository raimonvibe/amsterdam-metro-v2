import { KeyboardEvent, ReactNode, Ref, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown, LocateFixed, Search, TrainTrack, X } from "lucide-react";
import { formatPlaceName } from "../format";
import { Place } from "../components/Place";
import { Station } from "../types";
import { SearchResult, allStations, search, searchStations } from "./search";
import { LineBadge, useNarrowScreen, useTouchScreen } from "./ui";
import { useTravelT } from "./strings";

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
  const txt = useTravelT();
  const narrow = useNarrowScreen();
  const touch = useTouchScreen();
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
      return onNearby && /^(dichtbij|hier|locatie|nearby|near me|here)$/i.test(query.trim()) ? [{ kind: "nearby", score: 300 }, ...found] : found;
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
    if (!open || touch) return;
    const away = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, touch]);

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
  const closeSheet = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const options = (big: boolean) => (
    <>
      {typed && browsing && (
        <li role="presentation" className="px-3 py-2 text-sm text-[#6b6455] dark:text-[#9aa2b5]">
          {txt.notFound(query)}
        </li>
      )}
      {!typed && mode === "all" && (
        <li role="presentation" className="border-b border-[#efe8d8] px-3 pb-2 pt-1 text-xs leading-relaxed text-[#5b5446] dark:border-[#1c2436] dark:text-[#a9b0c2]">
          <span className="smallcaps font-semibold text-[#7b2132] dark:text-[#c8a951]">{txt.try}</span>{" "}
          <kbd className="font-sans">arena</kbd> · <kbd className="font-sans">52</kbd> ·{" "}
          <kbd className="font-sans">{txt.tryRoute}</kbd> · <kbd className="font-sans">{txt.tryNearby}</kbd> ·{" "}
          <kbd className="font-sans">waterlopolein</kbd>
        </li>
      )}
      {browsing && (
        <li role="presentation" className="smallcaps px-3 pb-0.5 pt-1.5 text-[11px] font-semibold text-[#7b2132] dark:text-[#c8a951]">
          {txt.allStations}
        </li>
      )}
      {results.map((r, i) => (
        <li
          key={resultKey(r)}
          id={`${id}-opt-${i}`}
          role="option"
          aria-selected={i === current}
          // A finger scrolls the list before it taps, so the sheet picks on
          // click; the dropdown picks on mousedown, before the input blurs.
          onMouseDown={(e) => {
            if (big) return;
            e.preventDefault();
            choose(r);
          }}
          onClick={() => big && choose(r)}
          onMouseEnter={() => !big && setActive(i)}
          className={`flex cursor-pointer items-center gap-2 px-3 ${
            big
              ? "min-h-12 border-b border-[#efe8d8] py-2.5 text-base active:bg-[#f1ebdd] dark:border-[#1c2436] dark:active:bg-[#1a2134]"
              : "py-1.5 text-sm"
          } ${i === current ? "bg-[#f1ebdd] dark:bg-[#1a2134]" : ""}`}
        >
          <ResultRow result={r} colorOf={colorOf} />
        </li>
      ))}
    </>
  );

  // Phones and tablets: a dropdown under a focused input sits behind the
  // on-screen keyboard and runs off the screen. The field is a button there
  // instead, opening a full-screen list to tap; typing stays possible.
  if (touch) {
    return (
      <div className="relative w-full">
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          onClick={() => {
            setActive(-1);
            setOpen(true);
          }}
          className={`flex w-full items-center gap-2 rounded-md border border-[#cfc4ad] bg-white pl-2.5 pr-1.5 text-left shadow-inner dark:border-[#33405c] dark:bg-[#0d1322] ${
            compact ? "h-9 text-sm" : "h-10 text-[15px]"
          }`}
        >
          <Search size={compact ? 14 : 16} className="shrink-0 text-[#8a8170] dark:text-[#8b93a7]" aria-hidden />
          {value ? (
            <span className="min-w-0 flex-1 truncate font-semibold text-[#1d2433] dark:text-[#ece6d6]">
              <Place name={value} />
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[#8a8170] dark:text-[#8b93a7]">{shownPlaceholder}</span>
          )}
          <ChevronDown size={16} className="shrink-0 text-[#6b6455] dark:text-[#9aa2b5]" aria-hidden />
        </button>
        {open && (
          <PickerSheet label={label} onClose={closeSheet}>
            <div className="relative px-3 pb-2">
              <Search size={16} className="pointer-events-none absolute left-6 top-5 -translate-y-1/2 text-[#8a8170] dark:text-[#8b93a7]" aria-hidden />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-label={`${label}: ${txt.typeToSearch}`}
                aria-expanded
                aria-controls={listId}
                autoComplete="off"
                spellCheck={false}
                placeholder={txt.typeOrPick}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(-1);
                }}
                onKeyDown={onKeyDown}
                // 16px or more, so iOS does not zoom in on focus.
                className="h-10 w-full rounded-md border border-[#cfc4ad] bg-white pl-9 pr-2 text-base text-[#1d2433] outline-none placeholder:text-[#8a8170] focus:border-[#1f3a68] focus:ring-2 focus:ring-[#1f3a68]/25 dark:border-[#33405c] dark:bg-[#0d1322] dark:text-[#ece6d6] dark:placeholder:text-[#8b93a7]"
              />
            </div>
            <ul id={listId} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              {options(true)}
            </ul>
          </PickerSheet>
        )}
      </div>
    );
  }

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
          aria-label={txt.showAllStations}
          title={txt.showAllStations}
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
          {options(false)}
        </ul>
      )}
    </div>
  );
}

/** Full-screen list for touch screens. It fills the visual viewport, so with
 *  the keyboard up the list ends above it instead of behind it. */
function PickerSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const txt = useTravelT();
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const fit = () => setHeight(vv ? vv.height : null);
    fit();
    vv?.addEventListener("resize", fit);
    // The page behind must not scroll along with the list.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => {
      vv?.removeEventListener("resize", fit);
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={height ? { height } : undefined}
      className="fixed inset-x-0 top-0 z-[60] flex h-[100dvh] flex-col bg-[#fffdf8] pt-[env(safe-area-inset-top)] text-[#1d2433] dark:bg-[#111727] dark:text-[#ece6d6]"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <h2 className="font-academic text-lg font-semibold">{label}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={txt.close}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#1f3a68] hover:bg-[#f1ebdd] dark:text-[#c8a951] dark:hover:bg-[#1a2134]"
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </div>,
    document.body,
  );
}

function resultKey(r: SearchResult): string {
  if (r.kind === "station") return `s:${r.station.name}`;
  if (r.kind === "line") return `l:${r.line}`;
  if (r.kind === "route") return `r:${r.from.name}>${r.to.name}`;
  return "nearby";
}

function ResultRow({ result: r, colorOf }: { result: SearchResult; colorOf: (l: string) => string }) {
  const txt = useTravelT();
  if (r.kind === "nearby") {
    return (
      <>
        <LocateFixed size={15} className="shrink-0 text-[#1f3a68] dark:text-[#c8a951]" aria-hidden />
        <span className="font-medium">{txt.nearestStation}</span>
        <span className="ml-auto text-[11px] text-[#8a8170]">{txt.viaLocation}</span>
      </>
    );
  }
  if (r.kind === "route") {
    return (
      <>
        <ArrowRight size={15} className="shrink-0 text-[#1f3a68] dark:text-[#c8a951]" aria-hidden />
        <span className="min-w-0 truncate">
          {txt.tripFrom} <strong><Place name={r.from.name} /></strong> {txt.tripTo} <strong><Place name={r.to.name} /></strong>
        </span>
      </>
    );
  }
  if (r.kind === "line") {
    return (
      <>
        <TrainTrack size={15} className="shrink-0 text-[#1f3a68] dark:text-[#c8a951]" aria-hidden />
        <LineBadge id={r.line} color={colorOf(r.line)} small />
        <span>{txt.lineOverviewOf(r.line)}</span>
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
