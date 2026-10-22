import { Train } from "../types";
import { NetworkLine } from "./types";

export interface PlacedTrain {
  train: Train;
  /** Position in station-index units along the diagram's order: 2 is at the
   *  third station, 2.5 halfway to the fourth. */
  pos: number;
  /** True when it runs in the diagram's listed order (top to bottom). */
  forward: boolean;
}

/** Where each train of a line sits on its schematic, which is drawn in the
 *  order of the line's first direction. Trains whose stations are not on the
 *  diagram (diversions, stale data) are left out rather than guessed. */
export function placeTrains(line: NetworkLine, trains: Train[], nowMs: number): PlacedTrain[] {
  const order = line.directions[0]?.stations ?? [];
  const index = new Map(order.map((s, i) => [s, i]));
  const out: PlacedTrain[] = [];
  for (const t of trains) {
    if (t.line !== line.id || !t.prev_station) continue;
    const a = index.get(t.prev_station);
    if (a === undefined) continue;
    if (t.status === "dwelling" || !t.next_station) {
      const b = t.next_station ? index.get(t.next_station) : undefined;
      out.push({ train: t, pos: a, forward: b === undefined ? t.headsign === line.directions[0]?.headsign : b > a });
      continue;
    }
    const b = index.get(t.next_station);
    if (b === undefined || Math.abs(b - a) !== 1) continue;
    const start = t.prev_departure_ts ?? 0;
    const end = t.next_arrival_ts ?? 0;
    const p = end > start ? Math.min(1, Math.max(0, (nowMs / 1000 - start) / (end - start))) : 0;
    out.push({ train: t, pos: a + (b - a) * p, forward: b > a });
  }
  return out;
}

/** Typical minutes from the first station to each station of a direction. */
export function cumulativeMinutes(runtimes: number[]): number[] {
  const out = [0];
  for (const r of runtimes) out.push(out[out.length - 1] + r / 60);
  return out.map((m) => Math.round(m));
}
