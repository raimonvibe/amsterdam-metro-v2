import { useMemo } from "react";
import { formatPlaceName } from "../format";
import { AlertList } from "../components/AlertList";
import { AnimatedTrain, Line, ServiceAlert, Status } from "../types";
import { lineHealth, networkSummary } from "./network";
import { LineBadge, Section } from "./ui";
import { useTravelT } from "./strings";

export interface NetworkStatusProps {
  lines: Line[];
  trains: AnimatedTrain[];
  status: Status | null;
  onLine: (id: string) => void;
  alerts?: ServiceAlert[];
}

export function NetworkStatus({ lines, trains, status, onLine, alerts = [] }: NetworkStatusProps) {
  const colorOf = (id: string) => lines.find((l) => l.id === id)?.color ?? "#999";
  const txt = useTravelT();
  const health = useMemo(() => lineHealth(lines.map((l) => l.id), trains), [lines, trains]);
  const total = trains.length;
  const live = trains.filter((t) => t.realtime).length;

  return (
    <Section n={5} id="netwerkstatus" title={txt.networkStatus}>
      <p className="font-academic text-sm italic leading-snug text-[#1d2433] dark:text-[#ece6d6]">{networkSummary(health)}</p>
      <AlertList alerts={alerts} colorOf={colorOf} className="mt-2" />
      <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Stat label={txt.inService} value={total} />
        <Stat label={txt.liveFollowed} value={live} />
        <Stat label={txt.tripUpdates} value={status?.rt_trip_count ?? "—"} />
      </dl>
      <table className="mt-2.5 w-full text-xs">
        <thead>
          <tr className="smallcaps text-left text-[11px] text-[#6b6455] dark:text-[#8b93a7]">
            <th className="pb-1 font-semibold">{txt.lineCol}</th>
            <th className="pb-1 text-right font-semibold">{txt.trainsCol}</th>
            <th className="pb-1 pl-2 font-semibold">{txt.punctuality}</th>
            <th className="pb-1 text-right font-semibold">{txt.avgCol}</th>
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
                    <span className="text-[#6b6455] dark:text-[#8b93a7]">{txt.noLiveData}</span>
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
      <p className="mt-2 text-[11px] leading-snug text-[#6b6455] dark:text-[#8b93a7]">
        {txt.punctualityNote}
      </p>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded bg-[#f6f1e4] py-1.5 dark:bg-[#151c2e]">
      <dd className="font-academic text-lg font-semibold tabular-nums leading-none">{value}</dd>
      <dt className="smallcaps mt-0.5 text-[11px] text-[#6b6455] dark:text-[#8b93a7]">{label}</dt>
    </div>
  );
}
