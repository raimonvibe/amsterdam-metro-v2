import { useState } from "react";
import { ChevronRight, Clock, Landmark, PanelLeftClose, TrainFront, TriangleAlert } from "lucide-react";
import { AnimatedTrain, Line, ServiceAlert, Station, Status } from "../types";
import { AlertList } from "./AlertList";
import { MapStyle } from "../theme";
import { StyleSwitcher } from "./StyleSwitcher";
import { locale, useLang, useT } from "../i18n";
import { LanguageToggle } from "./LanguageToggle";
import { Place } from "./Place";
import { SocialIcons } from "./SocialIcons";
import { Credits } from "./Credits";

interface SidebarProps {
  lines: Line[];
  visibleLines: string[];
  onToggleLine: (id: string) => void;
  trains: AnimatedTrain[];
  status: Status | null;
  hoveredStation: Station | null;
  lastUpdated: Date | null;
  mapStyle: MapStyle;
  onMapStyleChange: (style: MapStyle) => void;
  onOpenPrivacy: () => void;
  onOpenTravel: () => void;
  onClose: () => void;
  alerts?: ServiceAlert[];
}

function LineBadge({ id, color }: { id: string; color: string }) {
  return (
    <span
      className="flex h-5 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold text-gray-950"
      style={{ backgroundColor: color }}
    >
      {id}
    </span>
  );
}

export function Sidebar({
  lines,
  visibleLines,
  onToggleLine,
  trains,
  status,
  hoveredStation,
  lastUpdated,
  mapStyle,
  onMapStyleChange,
  onOpenPrivacy,
  onOpenTravel,
  onClose,
  alerts = [],
}: SidebarProps) {
  const txt = useT();
  const lang = useLang();
  // The line whose messages are open under its row, if any.
  const [openAlerts, setOpenAlerts] = useState<string | null>(null);
  const colorOf = (id: string) => lines.find((l) => l.id === id)?.color ?? "#999";

  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden border-r border-gray-200 bg-white/95 text-gray-900 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90 dark:text-gray-100 md:w-72">
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 pl-[max(1rem,env(safe-area-inset-left))] pr-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h1 className="min-w-0 text-base font-bold tracking-tight sm:text-lg">{txt.appName}</h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <LanguageToggle className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800" />
          <button
            type="button"
            onClick={onClose}
            title={txt.sidebarHide}
            aria-label={txt.sidebarHide}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-[#4363D8] text-white shadow-sm transition hover:bg-[#3651b8] dark:border-gray-700 dark:bg-[#4363D8]/35 dark:text-blue-200 dark:hover:bg-[#4363D8]/50"
          >
            <PanelLeftClose size={22} strokeWidth={2.35} />
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{txt.tagline}</p>

      {/* A real link (crawlable, opens in a new tab on middle-click); a plain
          click stays in the app. */}
      <a
        href="/reisinfo"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onOpenTravel();
        }}
        className="mb-4 flex min-h-11 items-center gap-2.5 rounded-lg border border-[#c8a951]/60 bg-[#1f3a68] px-3 py-2 text-white shadow-sm transition hover:bg-[#182e54] dark:border-[#c8a951]/40 dark:bg-[#1f3a68]/70 dark:hover:bg-[#1f3a68]"
      >
        <Landmark size={18} className="shrink-0 text-[#e2c977]" aria-hidden />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="font-academic block text-sm font-semibold">{txt.travelInfo}</span>
          {/* Wraps rather than truncates: the sidebar is only 18rem wide. */}
          <span className="mt-0.5 block text-[11px] leading-snug text-blue-100/90">{txt.travelInfoHint}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 opacity-80" aria-hidden />
      </a>

      <div className="mb-4">
        <StyleSwitcher value={mapStyle} onChange={onMapStyleChange} />
      </div>

      <div className="mb-5 min-w-0 space-y-1.5">
        {lines.map((line) => {
          const count = trains.filter((t) => t.line === line.id).length;
          const on = visibleLines.includes(line.id);
          const lineAlerts = alerts.filter((a) => a.lines.includes(line.id));
          const open = openAlerts === line.id && lineAlerts.length > 0;
          return (
            <div key={line.id}>
              {/* Two buttons side by side, not nested: the row toggles the
                  line, the ⚠ opens its messages. */}
              <div
                className={`flex min-w-0 items-center rounded-lg transition ${
                  on ? "bg-gray-100 dark:bg-gray-800/80" : "bg-transparent"
                }`}
              >
                <button
                  onClick={() => onToggleLine(line.id)}
                  className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pl-2.5 text-left text-sm transition sm:min-h-0 sm:py-1.5 ${
                    on ? "" : "opacity-45 hover:opacity-75"
                  } ${lineAlerts.length ? "" : "pr-2.5"}`}
                >
                  <LineBadge id={line.id} color={line.color} />
                  <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">
                    <Place name={line.name} />
                  </span>
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {count}
                  </span>
                </button>
                {lineAlerts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpenAlerts(open ? null : line.id)}
                    aria-expanded={open}
                    aria-label={`${txt.alertsCount(lineAlerts.length)} · ${txt.line} ${line.id}`}
                    title={txt.alertsCount(lineAlerts.length)}
                    className="flex min-h-11 min-w-9 shrink-0 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/60 sm:min-h-8"
                  >
                    <TriangleAlert size={15} aria-hidden />
                  </button>
                )}
              </div>
              {open && <AlertList alerts={lineAlerts} colorOf={colorOf} compact className="mt-1" />}
            </div>
          );
        })}
      </div>

      <div className="mb-5 space-y-2.5 rounded-lg bg-gray-100 p-3 dark:bg-gray-900">
        <div className="flex items-start gap-2.5">
          <TrainFront
            size={18}
            className="mt-0.5 shrink-0 text-[#4363D8] dark:text-[#6b8cff]"
          />
          <div className="min-w-0 leading-snug">
            <div className="text-base font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">
              {trains.length}
            </div>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {txt.trainsInService}
            </div>
          </div>
        </div>
        {status && (
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center"
              aria-hidden
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
            </span>
            <div className="min-w-0 leading-snug">
              <div className="text-base font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">
                {status.rt_trip_count}
              </div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {txt.liveTripUpdates}
              </div>
            </div>
          </div>
        )}
        {lastUpdated && (
          <div className="flex items-start gap-2.5 border-t border-gray-200/80 pt-2.5 dark:border-gray-700/80">
            <Clock
              size={15}
              className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <div className="min-w-0 leading-snug">
              <div className="text-base font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">
                {lastUpdated.toLocaleTimeString(locale(lang))}
              </div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {txt.updatedAt}
              </div>
            </div>
          </div>
        )}
      </div>

      {hoveredStation && (
        <div className="mb-3 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="font-semibold">
            <Place name={hoveredStation.name} />
          </div>
          <div className="mt-1 flex gap-1">
            {hoveredStation.lines.map((l) => (
              <LineBadge key={l} id={l} color={colorOf(l)} />
            ))}
          </div>
        </div>
      )}

      <section
        aria-labelledby="about-title"
        className="mt-4 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-800"
      >
        <h2 id="about-title" className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {txt.aboutTitle}
        </h2>
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-300">{txt.aboutIntro}</p>
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-300">{txt.aboutData}</p>
      </section>

      <div className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-800">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{txt.infoToggle}</p>
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-300 md:hidden">
          {txt.helpMobile}
        </p>
        <p className="hidden text-xs leading-relaxed text-gray-500 dark:text-gray-300 md:block">
          {txt.helpDesktop}
        </p>
        <Credits onOpenPrivacy={onOpenPrivacy} />
      </div>
      </div>
      <div className="shrink-0 border-t border-gray-200 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-4 pt-3 dark:border-gray-800">
        <SocialIcons />
      </div>
    </aside>
  );
}
