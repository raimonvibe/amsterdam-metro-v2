import { Clock, TrainFront } from "lucide-react";
import { AnimatedTrain, Line, Station, Status } from "../types";

interface SidebarProps {
  lines: Line[];
  visibleLines: string[];
  onToggleLine: (id: string) => void;
  trains: AnimatedTrain[];
  status: Status | null;
  hoveredTrain: AnimatedTrain | null;
  hoveredStation: Station | null;
  lastUpdated: Date | null;
}

function delayLabel(s: number): string {
  if (Math.abs(s) < 30) return "on time";
  const m = Math.round(Math.abs(s) / 60);
  return s > 0 ? `+${m || 1} min` : `-${m || 1} min`;
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
}: SidebarProps) {
  return (
    <aside className="w-72 shrink-0 overflow-y-auto bg-gray-950/90 p-4 text-gray-100 backdrop-blur">
      <h1 className="text-lg font-bold tracking-tight">Amsterdam Metro Live</h1>
      <p className="mb-4 text-xs text-gray-400">
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
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                on ? "bg-gray-800/80" : "bg-transparent opacity-45 hover:opacity-75"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="flex h-5 w-7 items-center justify-center rounded text-[11px] font-bold text-gray-950"
                  style={{ backgroundColor: line.color }}
                >
                  {line.id}
                </span>
                <span className="text-gray-200">{line.name}</span>
              </span>
              <span className="text-xs tabular-nums text-gray-400">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 rounded-lg bg-gray-900 p-3 text-sm">
        <div className="flex items-center gap-2">
          <TrainFront size={15} className="text-gray-400" />
          <span>
            <span className="font-semibold tabular-nums">{trains.length}</span>{" "}
            trains in service
          </span>
        </div>
        {status && (
          <div className="mt-1 text-xs text-gray-400">
            {status.rt_trip_count} live trip updates
          </div>
        )}
        {lastUpdated && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Clock size={11} />
            {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {hoveredTrain && (
        <div className="mb-3 rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="flex h-5 w-7 items-center justify-center rounded text-[11px] font-bold text-gray-950"
              style={{
                backgroundColor:
                  lines.find((l) => l.id === hoveredTrain.line)?.color ?? "#fff",
              }}
            >
              {hoveredTrain.line}
            </span>
            <span className="font-semibold">→ {hoveredTrain.headsign}</span>
          </div>
          <div className="space-y-0.5 text-xs text-gray-300">
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
                  hoveredTrain.delay_s > 60 ? "text-amber-400" : "text-emerald-400"
                }
              >
                {delayLabel(hoveredTrain.delay_s)}
              </span>
            </div>
            {!hoveredTrain.realtime && (
              <div className="text-gray-500">scheduled (no live signal)</div>
            )}
          </div>
        </div>
      )}

      {hoveredStation && !hoveredTrain && (
        <div className="mb-3 rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm">
          <div className="font-semibold">
            {hoveredStation.name.replace(/^Amsterdam, /, "")}
          </div>
          <div className="mt-1 flex gap-1">
            {hoveredStation.lines.map((l) => (
              <span
                key={l}
                className="flex h-5 w-7 items-center justify-center rounded text-[11px] font-bold text-gray-950"
                style={{
                  backgroundColor: lines.find((x) => x.id === l)?.color ?? "#fff",
                }}
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-[10px] leading-relaxed text-gray-600">
        Right-drag to orbit · zoom in for buildings.
        <br />
        Data: OVapi / GVB · Tiles: OpenFreeMap
      </p>
    </aside>
  );
}
