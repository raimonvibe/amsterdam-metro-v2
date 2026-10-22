import { describe, expect, it } from "vitest";
import { amsterdamTime, catchable, clock, countdown, duration, headwayLabel, urgency } from "./time";

// 2026-10-22 12:00:00 in Amsterdam (CEST, UTC+2).
const NOON = Date.UTC(2026, 9, 22, 10, 0, 0);
const ts = (offsetS: number) => NOON / 1000 + offsetS;

describe("clock", () => {
  it("shows Amsterdam time regardless of the visitor's time zone", () => {
    expect(clock(ts(0))).toBe("12:00");
    expect(clock(ts(5 * 60 + 59))).toBe("12:05");
  });
});

describe("amsterdamTime", () => {
  it("gives Amsterdam hours, minutes and seconds, across the DST change", () => {
    expect(amsterdamTime(NOON + 5 * 60_000 + 9_000)).toEqual({ h: 12, m: 5, s: 9 });
    // Clocks go back at 03:00 CEST on 25 October 2026: 00:59 UTC is still 02:59, 01:00 UTC is 02:00 again.
    expect(amsterdamTime(Date.UTC(2026, 9, 25, 0, 59))).toEqual({ h: 2, m: 59, s: 0 });
    expect(amsterdamTime(Date.UTC(2026, 9, 25, 1, 0))).toEqual({ h: 2, m: 0, s: 0 });
    expect(amsterdamTime(Date.UTC(2026, 11, 31, 23, 0))).toEqual({ h: 0, m: 0, s: 0 });
  });
});

describe("duration", () => {
  it("uses minutes, then hours and minutes", () => {
    expect(duration(8 * 60)).toBe("8 min");
    expect(duration(65 * 60)).toBe("1 u 5 min");
    expect(duration(120 * 60)).toBe("2 u");
    expect(duration(-5)).toBe("0 min");
  });
});

describe("countdown", () => {
  it("counts down in Dutch and says when a train has gone", () => {
    expect(countdown(ts(10), NOON)).toBe("nu");
    expect(countdown(ts(60), NOON)).toBe("1 min");
    expect(countdown(ts(12 * 60), NOON)).toBe("12 min");
    expect(countdown(ts(75 * 60), NOON)).toBe("1 u 15 min");
    expect(countdown(ts(-60), NOON)).toBe("vertrokken");
  });
});

describe("urgency", () => {
  it("grades how soon a train leaves", () => {
    expect(urgency(ts(-60), NOON)).toBe("gone");
    expect(urgency(ts(30), NOON)).toBe("now");
    expect(urgency(ts(3 * 60), NOON)).toBe("soon");
    expect(urgency(ts(10 * 60), NOON)).toBe("later");
  });
});

describe("headwayLabel / catchable", () => {
  it("formats the frequency or nothing", () => {
    expect(headwayLabel(4.4)).toBe("elke ~4 min");
    expect(headwayLabel(0.2)).toBe("elke ~1 min");
    expect(headwayLabel(null)).toBeNull();
  });

  it("tells whether a walk to the platform still makes the train", () => {
    expect(catchable(ts(5 * 60), NOON, 4)).toBe(true);
    expect(catchable(ts(3 * 60), NOON, 4)).toBe(false);
  });
});
