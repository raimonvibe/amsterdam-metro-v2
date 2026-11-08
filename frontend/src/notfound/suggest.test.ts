import { describe, expect, it } from "vitest";
import { STATION_NAMES, displayName, linesAt, stationSlug } from "../data/network";
import { NICKNAMES } from "../seo/notFound";
import { forwardTarget, issueUrl, knownStations, readPath, searchStations, suggest, toSlug } from "./suggest";

// The same data notFound.ts embeds in the 404 page.
const DATA = {
  stations: STATION_NAMES.map((name) => ({ slug: stationSlug(name), name: displayName(name), lines: linesAt(name) })),
  nicknames: Object.fromEntries(Object.entries(NICKNAMES).map(([k, v]) => [k, v.map(stationSlug)])),
};
const names = (list: { name: string }[]) => list.map((s) => s.name);

describe("404 page logic", () => {
  it("turns a GTFS station name into the same slug as the station pages", () => {
    for (const n of STATION_NAMES) expect(toSlug(n.replace(/^[^,]+, /, ""))).toBe(stationSlug(n));
  });

  it("reads the language and the wanted word from the address", () => {
    expect(readPath("/en/reisinfo/Waterlooplien")).toEqual({ lang: "en", wanted: "waterlooplien", stationShaped: true });
    expect(readPath("/reisinfo/Station%20Zuid")).toEqual({ lang: "nl", wanted: "zuid", stationShaped: true });
    expect(readPath("/foo/bar")).toEqual({ lang: "nl", wanted: "bar", stationShaped: false });
    expect(readPath("/reisinfo/%E0%A4%A")).toMatchObject({ stationShaped: true });
  });

  it("suggests stations for typos and nicknames, closest first", () => {
    expect(names(suggest("waterlooplien", DATA))).toEqual(["Waterlooplein"]);
    expect(names(suggest("arena", DATA))).toEqual(["Station Bijlmer ArenA"]);
    expect(names(suggest("amstel", DATA))).toEqual(["Amstelstation", "Overamstel", "Amstelveenseweg"]);
    expect(names(suggest("arena-x", DATA))).toEqual(["Station Bijlmer ArenA"]);
    expect(names(suggest("old-rokin-page", DATA))).toEqual(["Rokin"]);
    expect(suggest("xyzqq", DATA)).toEqual([]);
    expect(suggest("constructor", DATA)).toEqual([]);
  });

  it("forwards an address that clearly means one station, keeping the query", () => {
    expect(forwardTarget("/reisinfo/zuid", "", DATA)).toBe("/reisinfo/zuid/");
    expect(forwardTarget("/reisinfo/Zuid", "?lijn=52", DATA)).toBe("/reisinfo/zuid/?lijn=52");
    expect(forwardTarget("/en/reisinfo/cs", "", DATA)).toBe("/en/reisinfo/centraal-station/");
    // Only van/naar/lijn come along, re-encoded.
    expect(forwardTarget("/reisinfo/zuid", "?van=Noord&naar=Gein&x=%2F%2Fevil.example&lijn=52", DATA)).toBe(
      "/reisinfo/zuid/?van=Noord&naar=Gein&lijn=52",
    );
    expect(forwardTarget("/reisinfo/zuid", "?redirect=https://evil.example", DATA)).toBe("/reisinfo/zuid/");
    // Ambiguous, unknown or not a station address: no forwarding.
    expect(forwardTarget("/reisinfo/amstel", "", DATA)).toBeNull();
    expect(forwardTarget("/reisinfo/xyz", "", DATA)).toBeNull();
    expect(forwardTarget("/zuid", "", DATA)).toBeNull();
    expect(forwardTarget("/reisinfo/constructor", "", DATA)).toBeNull();
  });

  it("searches by part of a name first, then by typo", () => {
    expect(names(searchStations("zuid", DATA))).toEqual(expect.arrayContaining(["Station Zuid", "Station Diemen Zuid"]));
    expect(names(searchStations("noorderp", DATA))[0]).toBe("Noorderpark");
    expect(names(searchStations("nieuwmrkt", DATA))).toContain("Nieuwmarkt");
    expect(searchStations("   ", DATA)).toEqual([]);
  });

  it("builds every link from the station list, never from the typed address", () => {
    for (const st of [...suggest("amstel", DATA), ...searchStations("<script>", DATA)]) {
      expect(DATA.stations).toContain(st);
    }
  });

  it("reports a broken link with the path only, in the page's language", () => {
    const url = new URL(issueUrl("/reisinfo/xyz", "nl"));
    expect(url.origin + url.pathname).toBe("https://github.com/raimonvibe/amsterdam-metro-v2/issues/new");
    expect(url.searchParams.get("title")).toBe("Kapotte link: /reisinfo/xyz");
    expect(url.searchParams.get("labels")).toBe("404");
    expect(new URL(issueUrl("/x", "en")).searchParams.get("title")).toBe("Broken link: /x");
    expect(new URL(issueUrl(`/${"a".repeat(500)}`, "en")).searchParams.get("title")!.length).toBeLessThan(230);
  });

  it("lists the visitor's own stations, favourites first, ignoring junk", () => {
    const slugOf = (n: string) => toSlug(n.replace(/^[^,]+, /, ""));
    const mine = knownStations(["Amsterdam, Rokin"], ["Amsterdam, Gein", "Amsterdam, Rokin", 42, "Nowhere, Atlantis"], DATA, slugOf);
    expect(names(mine)).toEqual(["Rokin", "Gein"]);
    expect(knownStations(null, "junk", DATA, slugOf)).toEqual([]);
  });
});
