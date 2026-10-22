import { describe, expect, it } from "vitest";
import { STATIONS } from "../test/fixtures";
import {
  bestStation,
  editDistance,
  nearestStations,
  normalize,
  parseLines,
  parseRoute,
  search,
  searchStations,
} from "./search";

const LINES = ["50", "51", "52", "53", "54"];
const top = (q: string) => searchStations(q, STATIONS, 1)[0]?.station.name;

describe("normalize", () => {
  it("lowercases, strips accents and punctuation, spells out Burg.", () => {
    expect(normalize("Burg. De Vlugtlaan")).toBe("burgemeester de vlugtlaan");
    expect(normalize("  Carré!  ")).toBe("carre");
    expect(normalize("Station Bijlmer ArenA")).toBe("station bijlmer arena");
  });
});

describe("editDistance", () => {
  it("counts a swap of two neighbouring letters as one edit", () => {
    expect(editDistance("rokin", "rokni")).toBe(1);
    expect(editDistance("noord", "nord")).toBe(1);
    expect(editDistance("abc", "abc")).toBe(0);
  });
});

describe("searchStations", () => {
  it("finds stations by their short name, without the city prefix", () => {
    expect(top("Waterlooplein")).toBe("Amsterdam, Waterlooplein");
    expect(top("zuid")).toBe("Amsterdam, Station Zuid");
  });

  it("knows everyday names and landmarks", () => {
    expect(top("cs")).toBe("Amsterdam, Centraal Station");
    expect(top("arena")).toBe("Amsterdam, Station Bijlmer ArenA");
    expect(top("amc")).toBe("Amsterdam, Station Holendrecht");
    expect(top("albert cuyp")).toBe("Amsterdam, De Pijp");
    expect(top("dam")).toBe("Amsterdam, Rokin");
    expect(top("ziggo dome")).toBe("Amsterdam, Station Bijlmer ArenA");
  });

  it("forgives typos, including swapped letters", () => {
    expect(top("Waterlopolein")).toBe("Amsterdam, Waterlooplein");
    expect(top("weesperpelin")).toBe("Amsterdam, Weesperplein");
    expect(top("sloterdjik")).toBe("Amsterdam, Station Sloterdijk");
  });

  it("matches initials and prefixes of every word", () => {
    expect(top("hs")).toBe("Amsterdam, Henk Sneevlietweg");
    expect(top("jan van")).toBe("Amsterdam, Jan van Galenstraat");
    expect(top("vlugt")).toBe("Amsterdam, Burg. De Vlugtlaan");
  });

  it("ignores accents and the 'Burg.' abbreviation", () => {
    expect(top("burgemeester de vlugtlaan")).toBe("Amsterdam, Burg. De Vlugtlaan");
  });

  it("ranks the real name above a landmark on another station", () => {
    // "noord" is a station name; "noord zuidlijn" is not a station alias.
    expect(top("noord")).toBe("Amsterdam, Noord");
  });

  it("returns nothing for empty or nonsense queries", () => {
    expect(searchStations("", STATIONS)).toEqual([]);
    expect(searchStations("xqzw", STATIONS)).toEqual([]);
  });

  it("reports which landmark matched", () => {
    const [hit] = searchStations("stopera", STATIONS, 1);
    expect(hit.station.name).toBe("Amsterdam, Waterlooplein");
    expect(hit.via).toBe("stopera");
  });
});

describe("parseRoute", () => {
  it("understands 'van … naar …', arrows and 'tot'", () => {
    for (const q of ["noord naar gein", "van Noord naar Gein", "noord -> gein", "noord → gein", "noord tot gein"]) {
      const r = parseRoute(q, STATIONS);
      expect(r?.from.name, q).toBe("Amsterdam, Noord");
      expect(r?.to.name, q).toBe("Amsterdam, Gein");
    }
  });

  it("does not invent a route from one station name with a dash in it", () => {
    expect(parseRoute("Burg. De Vlugtlaan", STATIONS)).toBeNull();
    expect(parseRoute("zuid naar zuid", STATIONS)).toBeNull();
  });
});

describe("parseLines", () => {
  it("recognises numbers, prefixes and line nicknames", () => {
    expect(parseLines("52", LINES)).toEqual(["52"]);
    expect(parseLines("M53", LINES)).toEqual(["53"]);
    expect(parseLines("lijn 50", LINES)).toEqual(["50"]);
    expect(parseLines("noord-zuidlijn", LINES)).toEqual(["52"]);
    expect(parseLines("oostlijn", LINES)).toEqual(["53", "54"]);
    expect(parseLines("59", LINES)).toEqual([]);
  });
});

describe("search", () => {
  it("puts a recognised trip first, then stations", () => {
    const results = search("rokin naar zuid", STATIONS, LINES);
    expect(results[0].kind).toBe("route");
  });

  it("offers the nearest-station action for 'dichtbij'", () => {
    expect(search("dichtbij", STATIONS, LINES)[0].kind).toBe("nearby");
  });

  it("offers a line result for line queries", () => {
    const [first] = search("52", STATIONS, LINES);
    expect(first).toMatchObject({ kind: "line", line: "52" });
  });
});

describe("bestStation / nearestStations", () => {
  it("only accepts confident matches", () => {
    expect(bestStation("zuid", STATIONS)?.name).toBe("Amsterdam, Station Zuid");
    expect(bestStation("q", STATIONS)).toBeNull();
  });

  it("orders stations by distance", () => {
    const cs = STATIONS.find((s) => s.name === "Amsterdam, Centraal Station")!;
    const [first, second] = nearestStations(cs.latitude + 0.0005, cs.longitude, STATIONS, 2);
    expect(first.station.name).toBe(cs.name);
    expect(first.meters).toBeLessThan(100);
    expect(second.meters).toBeGreaterThan(first.meters);
  });
});
