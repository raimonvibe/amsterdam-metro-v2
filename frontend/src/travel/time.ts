/** Time formatting for the travel-info page. Clock times are always shown in
 *  Amsterdam time, so a visitor abroad reads the same times as the station. */

const CLOCK = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam",
});
const CLOCK_S = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Amsterdam",
});

/** "14:05" for an epoch in seconds. */
export function clock(tsSeconds: number): string {
  return CLOCK.format(new Date(tsSeconds * 1000));
}

/** "14:05:09" for an epoch in milliseconds. */
export function clockWithSeconds(ms: number): string {
  return CLOCK_S.format(new Date(ms));
}

const PARTS = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
  timeZone: "Europe/Amsterdam",
});

/** Hours (0-23), minutes and seconds in Amsterdam for an epoch in ms. Not
 *  Date#getHours, which would give the visitor's own time zone. */
export function amsterdamTime(ms: number): { h: number; m: number; s: number } {
  const parts = PARTS.formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { h: get("hour"), m: get("minute"), s: get("second") };
}

/** "8 min", "1 u 5 min", "2 u". */
export function duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} u ${m} min` : `${h} u`;
}

/** Countdown to a departure: "nu", "1 min", "12 min", "1 u 5 min", or
 *  "vertrokken" once it is clearly gone. */
export function countdown(tsSeconds: number, nowMs: number): string {
  const s = tsSeconds - nowMs / 1000;
  if (s < -30) return "vertrokken";
  if (s < 30) return "nu";
  if (s < 90) return "1 min";
  return duration(s);
}

export type Urgency = "gone" | "now" | "soon" | "later";

/** How pressing a departure is, for colour and emphasis. */
export function urgency(tsSeconds: number, nowMs: number): Urgency {
  const s = tsSeconds - nowMs / 1000;
  if (s < -30) return "gone";
  if (s < 60) return "now";
  if (s < 4 * 60) return "soon";
  return "later";
}

/** "elke ~4 min" / "elke ~12 min" / null when unknown. */
export function headwayLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  return `elke ~${Math.max(1, Math.round(minutes))} min`;
}

/** Can you still make it if it takes `walkMin` minutes to the platform? */
export function catchable(tsSeconds: number, nowMs: number, walkMin: number): boolean {
  return tsSeconds - nowMs / 1000 >= walkMin * 60;
}
