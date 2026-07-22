import { Clock, Moon, PanelLeftClose, Sun, TrainFront } from "lucide-react";
import { AnimatedTrain, Line, Station, Status } from "../types";
import { Theme } from "../theme";
import { SocialIcons } from "./SocialIcons";
import { Credits } from "./Credits";

interface SidebarProps {
  lines: Line[];
  visibleLines: string[];
  onToggleLine: (id: string) => void;
  trains: AnimatedTrain[];
  status: Status | null;
  hoveredTrain: AnimatedTrain | null;
  hoveredStation: Station | null;
  lastUpdated: Date | null;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenPrivacy: () => void;
  onClose: () => void;
}

function delayLabel(s: number): string {
  if (Math.abs(s) < 30) return "on time";
  const m = Math.round(Math.abs(s) / 60);
  return s > 0 ? `+${m || 1} min` : `-${m || 1} min`;
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
  hoveredTrain,
  hoveredStation,
  lastUpdated,
  theme,
  onToggleTheme,
  onOpenPrivacy,
  onClose,
}: SidebarProps) {
  const colorOf = (id: string) => lines.find((l) => l.id === id)?.color ?? "#999";

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto overscroll-contain border-r border-gray-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-4 pt-[max(1rem,env(safe-area-inset-top))] text-gray-900 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90 dark:text-gray-100 md:w-72">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h1 className="min-w-0 text-base font-bold tracking-tight sm:text-lg">
          Amsterdam Metro Live
        </h1>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onClose}
            title="Hide sidebar"
            aria-label="Hide sidebar"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <PanelLeftClose size={16} />
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Real trains, real tracks, real time
      </p>

      <div className="mb-5 space-y-1.5">
        {lines.map((line) => {
          const count = trains.filter((t) => t.line === line.id).length;
          const on = visibleLines.includes(line.id);
          return (
            <button
              key={line.id}
              onClick={() => onToggleLine(line.id)}
              className={`flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition sm:min-h-0 sm:py-1.5 ${
                on
                  ? "bg-gray-100 dark:bg-gray-800/80"
                  : "bg-transparent opacity-45 hover:opacity-75"
              }`}
            >
              <span className="flex items-center gap-2">
                <LineBadge id={line.id} color={line.color} />
                <span className="truncate text-gray-800 dark:text-gray-200">{line.name}</span>
              </span>
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 rounded-lg bg-gray-100 p-3 text-sm dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <TrainFront size={15} className="text-gray-500 dark:text-gray-400" />
          <span>
            <span className="font-semibold tabular-nums">{trains.length}</span>{" "}
            trains in service
          </span>
        </div>
        {status && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {status.rt_trip_count} live trip updates
          </div>
        )}
        {lastUpdated && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <Clock size={11} />
            {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {hoveredTrain && (
        <div className="mb-3 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-1 flex items-center gap-2">
            <LineBadge id={hoveredTrain.line} color={colorOf(hoveredTrain.line)} />
            <span className="min-w-0 truncate font-semibold">→ {hoveredTrain.headsign}</span>
          </div>
          <div className="space-y-0.5 text-xs text-gray-600 dark:text-gray-300">
            {hoveredTrain.status === "dwelling" ? (
              <div>At {hoveredTrain.prev_station?.replace(/^Amsterdam, /, "")}</div>
            ) : (
              <div>
                {hoveredTrain.prev_station?.replace(/^Amsterdam, /, "")} →{" "}
                {hoveredTrain.next_station?.replace(/^Amsterdam, /, "")}
              </div>
            )}
            <div>
              {Math.round(hoveredTrain.speed_m_s * 3.6)} km/h ·{" "}
              <span
                className={
                  hoveredTrain.delay_s > 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }
              >
                {delayLabel(hoveredTrain.delay_s)}
              </span>
            </div>
            {!hoveredTrain.realtime && (
              <div className="text-gray-400 dark:text-gray-500">
                scheduled (no live signal)
              </div>
            )}
          </div>
        </div>
      )}

      {hoveredStation && !hoveredTrain && (
        <div className="mb-3 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="font-semibold">
            {hoveredStation.name.replace(/^Amsterdam, /, "")}
          </div>
          <div className="mt-1 flex gap-1">
            {hoveredStation.lines.map((l) => (
              <LineBadge key={l} id={l} color={colorOf(l)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <p className="text-[10px] leading-relaxed text-gray-400 dark:text-gray-600 md:hidden">
          Pinch & drag to explore · tap stations for departures.
        </p>
        <p className="hidden text-[10px] leading-relaxed text-gray-400 dark:text-gray-600 md:block">
          Right-drag to orbit · zoom in for buildings.
        </p>
        <Credits onOpenPrivacy={onOpenPrivacy} />
        <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
          <SocialIcons />
        </div>
      </div>
    </aside>
  );
}
