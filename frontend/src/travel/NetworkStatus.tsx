import { useMemo } from "react";
import { formatPlaceName } from "../format";
import { AnimatedTrain, Line, Status } from "../types";
import { lineHealth, networkSummary } from "./network";
import { LineBadge, Section } from "./ui";

export interface NetworkStatusProps {
  lines: Line[];
  trains: AnimatedTrain[];
  status: Status | null;
  onLine: (id: string) => void;
}

export function NetworkStatus({ lines, trains, status, onLine }: NetworkStatusProps) {
  const health = useMemo(() => lineHealth(lines.map((l) => l.id), trains), [lines, trains]);
  const total = trains.length;
  const live = trains.filter((t) => t.realtime).length;

  return (
    <Section n={5} id="netwerkstatus" title="Netwerkstatus">
      <p className="font-academic text-sm italic leading-snug text-[#1d2433] dark:text-[#ece6d6]">{networkSummary(health)}</p>
      <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Stat label="in dienst" value={total} />
        <Stat label="live gevolgd" value={live} />
        <Stat label="ritupdates" value={status?.rt_trip_count ?? "—"} />
      </dl>
      <table className="mt-2.5 w-full text-xs">
        <thead>
          <tr className="smallcaps text-left text-[10px] text-[#7a7262] dark:text-[#8b93a7]">
            <th className="pb-1 font-semibold">Lijn</th>
            <th className="pb-1 text-right font-semibold">Metro's</th>
            <th className="pb-1 pl-2 font-semibold">Stiptheid</th>
            <th className="pb-1 text-right font-semibold">Gem.</th>
          </tr>
        </thead>
        <tbody>
          {health.map((h) => {
            const line = lines.find((l) => l.id === h.line);
            const pct = h.punctuality == null ? null : Math.round(h.punctuality * 100);
            return (
              <tr key={h.line} className="border-t border-[#efe8d8] dark:border-[#1c2436]">
                <td className="py-1">
                  <button type="button" onClick={() => onLine(h.line)} className="flex min-w-0 items-center gap-1.5 hover:underline" translate="no" title={line ? formatPlaceName(line.name) : undefined}>
                    <LineBadge id={h.line} color={line?.color ?? "#999"} small />
                    <span translate="no" className="hidden truncate xl:inline">{line ? formatPlaceName(line.name).split(" - ")[1] ?? "" : ""}</span>
                  </button>
                </td>
                <td className="py-1 text-right tabular-nums">{h.trains}</td>
                <td className="py-1 pl-2">
                  {pct == null ? (
                    <span className="text-[#9a9384]">geen live data</span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 flex-1 overflow-hidden rounded bg-[#efe8d8] dark:bg-[#1c2436]" aria-hidden>
                        <span
                          className={`block h-full ${pct >= 85 ? "bg-emerald-600" : pct >= 60 ? "bg-amber-500" : "bg-[#b42335]"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="w-8 text-right tabular-nums">{pct}%</span>
                    </span>
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {h.avgDelayS == null ? "—" : h.avgDelayS < 30 ? "0′" : `+${Math.round(h.avgDelayS / 60)}′`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] leading-snug text-[#7a7262] dark:text-[#8b93a7]">
        Stiptheid: aandeel live gevolgde metro's binnen een minuut van de dienstregeling.
      </p>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded bg-[#f6f1e4] py-1.5 dark:bg-[#151c2e]">
      <dd className="font-academic text-lg font-semibold tabular-nums leading-none">{value}</dd>
      <dt className="smallcaps mt-0.5 text-[10px] text-[#7a7262] dark:text-[#8b93a7]">{label}</dt>
    </div>
  );
}
