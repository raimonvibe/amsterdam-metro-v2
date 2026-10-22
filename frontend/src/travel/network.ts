import { Train } from "../types";

export interface LineHealth {
  line: string;
  trains: number;
  live: number;
  /** Share of live-tracked trains within a minute of schedule, 0-1; null if none live. */
  punctuality: number | null;
  avgDelayS: number | null;
  maxDelayS: number;
}

const ON_TIME_S = 60;

/** Per-line service health from the trains currently on the network. */
export function lineHealth(lineIds: string[], trains: Train[]): LineHealth[] {
  return lineIds.map((line) => {
    const on = trains.filter((t) => t.line === line);
    const live = on.filter((t) => t.realtime);
    const delays = live.map((t) => t.delay_s);
    return {
      line,
      trains: on.length,
      live: live.length,
      punctuality: live.length ? live.filter((t) => Math.abs(t.delay_s) < ON_TIME_S).length / live.length : null,
      avgDelayS: delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null,
      maxDelayS: delays.length ? Math.max(0, ...delays) : 0,
    };
  });
}

/** One plain-Dutch sentence about the network as a whole. */
export function networkSummary(health: LineHealth[]): string {
  const running = health.filter((h) => h.trains > 0);
  if (running.length === 0) return "Er rijden nu geen metro's (nachtrust of storing).";
  if (running.every((h) => h.live === 0)) {
    return "Er zijn nu geen live gegevens; posities en tijden volgen de dienstregeling.";
  }
  const quiet = health.filter((h) => h.trains === 0).map((h) => `M${h.line}`);
  const late = running.filter((h) => (h.avgDelayS ?? 0) >= 180).map((h) => `M${h.line}`);
  const slight = running.filter((h) => (h.avgDelayS ?? 0) >= 60 && (h.avgDelayS ?? 0) < 180).map((h) => `M${h.line}`);
  const parts: string[] = [];
  if (late.length) parts.push(`Vertraging op ${list(late)}`);
  if (slight.length) parts.push(`lichte vertraging op ${list(slight)}`);
  if (!parts.length) parts.push("Het metronet rijdt vrijwel op tijd");
  if (quiet.length) parts.push(`geen metro's gezien op ${list(quiet)}`);
  const s = parts.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

function list(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}
