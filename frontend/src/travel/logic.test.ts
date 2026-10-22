import { describe, expect, it } from "vitest";
import { NETWORK, STATIONS } from "../test/fixtures";
import { Train } from "../types";
import { cumulativeMinutes, placeTrains } from "./diagram";
import { lineHealth, networkSummary } from "./network";
import { readParams, resolveStation, writeParams } from "./url";

const NOW = 1_800_000_000_000;
const line52 = NETWORK.find((l) => l.id === "52")!;
const order = line52.directions[0].stations;

function train(over: Partial<Train>): Train {
  return {
    id: "t",
    line: "52",
    latitude: 0,
    longitude: 0,
    bearing: 0,
    distance_m: 0,
    speed_m_s: 0,
    shape_id: "s",
    delay_s: 0,
    status: "moving",
    realtime: true,
    ...over,
  };
}

describe("placeTrains", () => {
  it("puts a moving train between its stations by elapsed time", () => {
    const t = train({
      headsign: line52.directions[0].headsign,
      prev_station: order[1],
      next_station: order[2],
      prev_departure_ts: NOW / 1000 - 60,
      next_arrival_ts: NOW / 1000 + 60,
    });
    const [p] = placeTrains(line52, [t], NOW);
    expect(p.pos).toBeCloseTo(1.5);
    expect(p.forward).toBe(true);
  });

  it("runs the other direction upwards", () => {
    const t = train({ prev_station: order[3], next_station: order[2], prev_departure_ts: NOW / 1000, next_arrival_ts: NOW / 1000 + 100 });
    const [p] = placeTrains(line52, [t], NOW + 25_000);
    expect(p.pos).toBeCloseTo(2.75);
    expect(p.forward).toBe(false);
  });

  it("parks a dwelling train at its station", () => {
    const t = train({ status: "dwelling", prev_station: order[4], next_station: order[5] });
    expect(placeTrains(line52, [t], NOW)[0]).toMatchObject({ pos: 4, forward: true });
  });

  it("skips other lines and stations not on the diagram", () => {
    expect(placeTrains(line52, [train({ line: "50", prev_station: order[0] })], NOW)).toEqual([]);
    expect(placeTrains(line52, [train({ prev_station: "Nergens", next_station: order[0] })], NOW)).toEqual([]);
    expect(placeTrains(line52, [train({ prev_station: order[0], next_station: order[3] })], NOW)).toEqual([]);
  });

  it("clamps progress outside the segment's time span", () => {
    const t = train({ prev_station: order[0], next_station: order[1], prev_departure_ts: NOW / 1000 + 50, next_arrival_ts: NOW / 1000 + 100 });
    expect(placeTrains(line52, [t], NOW)[0].pos).toBe(0);
  });
});

describe("cumulativeMinutes", () => {
  it("adds up run times into minutes from the first station", () => {
    expect(cumulativeMinutes([90, 90, 120])).toEqual([0, 2, 3, 5]);
  });
});

describe("lineHealth / networkSummary", () => {
  it("computes punctuality from live trains only", () => {
    const [h] = lineHealth(["52"], [
      train({ delay_s: 0 }),
      train({ delay_s: 240 }),
      train({ delay_s: 30 }),
      train({ delay_s: 600, realtime: false }),
    ]);
    expect(h.trains).toBe(4);
    expect(h.live).toBe(3);
    expect(h.punctuality).toBeCloseTo(2 / 3);
    expect(h.maxDelayS).toBe(240);
  });

  it("summarises the network in plain Dutch", () => {
    expect(networkSummary(lineHealth(["50", "52"], []))).toMatch(/geen metro's/);
    expect(networkSummary(lineHealth(["52"], [train({ delay_s: 0 })]))).toBe("Het metronet rijdt vrijwel op tijd.");
    expect(networkSummary(lineHealth(["52", "53"], [train({ delay_s: 400 }), train({ line: "53", delay_s: 90 })]))).toBe(
      "Vertraging op M52; lichte vertraging op M53.",
    );
    expect(networkSummary(lineHealth(["52"], [train({ realtime: false })]))).toMatch(/geen live gegevens/);
  });
});

describe("links", () => {
  it("resolves stations from links in several spellings", () => {
    expect(resolveStation("CS", STATIONS)?.name).toBe("Amsterdam, Centraal Station");
    expect(resolveStation("Amsterdam, Noord", STATIONS)?.name).toBe("Amsterdam, Noord");
    expect(resolveStation("waterlooplein", STATIONS)?.name).toBe("Amsterdam, Waterlooplein");
    expect(resolveStation("arena", STATIONS)?.name).toBe("Amsterdam, Station Bijlmer ArenA");
    expect(resolveStation("qqq", STATIONS)).toBeNull();
    expect(resolveStation(null, STATIONS)).toBeNull();
  });

  it("writes short readable links that read back the same", () => {
    const cs = STATIONS.find((s) => s.name === "Amsterdam, Centraal Station")!;
    const zuid = STATIONS.find((s) => s.name === "Amsterdam, Station Zuid")!;
    const qs = writeParams({ station: cs, from: cs, to: zuid, line: "52" });
    expect(qs).toBe("?station=CS&van=CS&naar=Station+Zuid&lijn=52");
    const p = readParams(qs);
    expect(resolveStation(p.to, STATIONS)?.name).toBe(zuid.name);
    expect(writeParams({ station: null, from: null, to: null, line: null })).toBe("");
  });
});
