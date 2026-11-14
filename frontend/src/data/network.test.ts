import { describe, expect, it, vi } from "vitest";
import { LIFT_CHECK } from "./accessibility";
import {
  METRO_LINES,
  STATION_NAMES,
  accessState,
  checkedOn,
  directionsFrom,
  gvbStopUrls,
  linesAt,
  stepFreeAlternatives,
  stepFreeReachable,
} from "./network";

// The lift-fault tests use Overamstel with its lift out. The real data changes
// with every weekly lift check, so pin that one station here.
vi.mock("./accessibility.json", async (importOriginal) => {
  const real = (await importOriginal<{ default: typeof import("./accessibility.json") }>()).default;
  const name = "Amsterdam, Overamstel";
  const stations = { ...real.stations, [name]: { ...real.stations[name], step_free: "no", lift_out: true } };
  return { default: { ...real, stations } };
});

// A day after the last lift check, and long after it (a missed weekly check).
const SOON = Date.parse(`${LIFT_CHECK}T12:00:00Z`) + 86_400_000;
const LATE = SOON + 30 * 86_400_000;

describe("network", () => {
  it("has the same stations on its lines as accessibility.json lists", () => {
    const onLines = new Set(METRO_LINES.flatMap((l) => l.stations));
    expect([...onLines].sort()).toEqual([...STATION_NAMES].sort());
  });

  it("knows each station's GVB page and last check", () => {
    for (const n of STATION_NAMES) {
      expect(gvbStopUrls(n).length, n).toBeGreaterThan(0);
      expect(checkedOn(n), n).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(gvbStopUrls("Amsterdam, Centraal Station")).toHaveLength(2);
  });

  it("gives a terminus one direction and a through station two per line", () => {
    expect(directionsFrom("Amsterdam, Noord")).toEqual([{ line: "52", terminus: "Amsterdam, Station Zuid", next: "Amsterdam, Noorderpark" }]);
    expect(linesAt("Amsterdam, Amstelstation")).toEqual(["51", "53", "54"]);
    expect(directionsFrom("Amsterdam, Amstelstation")).toHaveLength(6);
  });
});

describe("step-free states", () => {
  it("has three states, and a lift fault fades after a missed check", () => {
    expect(accessState("Amsterdam, Rokin", SOON)).toBe("step-free");
    expect(accessState("Amsterdam, Gein", SOON)).toBe("not-step-free");
    // Overamstel's lift is out in the mocked data above.
    expect(accessState("Amsterdam, Overamstel", SOON)).toBe("lift-out");
    expect(accessState("Amsterdam, Overamstel", LATE)).toBe("not-step-free");
  });

  it("names the nearest step-free station each way when a lift is out", () => {
    const alt = stepFreeAlternatives("Amsterdam, Overamstel", SOON).map((a) => `${a.line} ${a.terminus} → ${a.station}`);
    expect(alt).toEqual([
      "50 Amsterdam, Isolatorweg → Amsterdam, Station RAI",
      "50 Amsterdam, Gein → Amsterdam, Van der Madeweg",
      // Spaklerweg is not step-free, so the next one: Amstelstation.
      "51 Amsterdam, Centraal Station → Amsterdam, Amstelstation",
      "51 Amsterdam, Isolatorweg → Amsterdam, Station RAI",
    ]);
  });

  it("lists step-free stations reachable without changing, never the station itself", () => {
    const reach = stepFreeReachable("Amsterdam, Noord", SOON);
    expect(reach).toHaveLength(1);
    expect(reach[0].stations).toContain("Amsterdam, Rokin");
    expect(reach[0].stations).not.toContain("Amsterdam, Noord");
    expect(reach[0].stations).not.toContain("Amsterdam, Europaplein");
  });
});
