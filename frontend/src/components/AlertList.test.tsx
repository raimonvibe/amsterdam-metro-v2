import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../i18n";
import { ServiceAlert } from "../types";
import { AlertList, alertEnd, alertStations, alertsFor, lineWide } from "./AlertList";

const lineAlert: ServiceAlert = {
  id: "a1",
  header: { nl: "Metro 52 rijdt niet.", en: "Metro 52 is not running." },
  lines: ["52"],
  stations: [],
  effect: "NO_SERVICE",
};
const stationAlert: ServiceAlert = {
  id: "a2",
  header: { nl: "Lift buiten gebruik.", en: null },
  description: { nl: "De lift naar perron 2 is buiten gebruik." },
  lines: ["53", "54"],
  stations: ["Amsterdam, Wibautstraat"],
  end_ts: Date.UTC(2026, 9, 22, 16, 0) / 1000,
  effect: "ACCESSIBILITY_ISSUE",
};
const colorOf = () => "#999";

describe("alertsFor", () => {
  it("keeps a station's own messages and those for whole lines calling there", () => {
    const all = [lineAlert, stationAlert];
    expect(alertsFor(all, { name: "Amsterdam, Wibautstraat", lines: ["53", "54"] })).toEqual([stationAlert]);
    expect(alertsFor(all, { name: "Amsterdam, De Pijp", lines: ["52"] })).toEqual([lineAlert]);
    expect(alertsFor(all, { name: "Amsterdam, Gein", lines: ["50", "54"] })).toEqual([]);
    expect(lineWide(all)).toEqual([lineAlert]);
  });
});

describe("AlertList", () => {
  // The fixtures end on 22 Oct 2026: "today" for these tests.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 10, 0)));
  });
  afterEach(() => vi.useRealTimers());

  it("renders nothing without alerts", () => {
    const { container } = render(<AlertList alerts={[]} colorOf={colorOf} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows GVB's text, the stations, the end time and details", () => {
    render(<AlertList alerts={[lineAlert, stationAlert]} colorOf={colorOf} />);
    expect(screen.getByText("Metro 52 rijdt niet.")).toBeInTheDocument();
    expect(screen.getByText("Hele lijn")).toBeInTheDocument();
    expect(screen.getByText("tot 18:00")).toBeInTheDocument();
    expect(screen.getByText("Wibautstraat")).toBeInTheDocument();
    expect(screen.getByText("Meer details")).toBeInTheDocument();
  });

  it("follows the language, falling back to Dutch where GVB gave no English", () => {
    render(<AlertList alerts={[lineAlert, stationAlert]} colorOf={colorOf} />);
    act(() => setLang("en", { persist: false }));
    expect(screen.getByText("Metro 52 is not running.")).toBeInTheDocument();
    expect(screen.getByText("Lift buiten gebruik.")).toBeInTheDocument();
    expect(screen.getByText("until 18:00")).toBeInTheDocument();
  });

  it("says 'whole line' instead of listing every station, on every screen", () => {
    render(<AlertList alerts={[{ ...stationAlert, whole_line: true }]} colorOf={colorOf} />);
    expect(screen.getByText("Hele lijnen")).not.toHaveClass("sm:hidden");
    expect(screen.queryByText("Wibautstraat")).toBeNull();
  });

  it("says 'whole line' for a single line", () => {
    render(<AlertList alerts={[{ ...stationAlert, lines: ["53"], whole_line: true }]} colorOf={colorOf} />);
    expect(screen.getByText("Hele lijn")).toBeInTheDocument();
  });

  it("leaves out stations and details when compact", () => {
    render(<AlertList alerts={[stationAlert]} colorOf={colorOf} compact />);
    expect(screen.queryByText("Wibautstraat")).toBeNull();
    expect(screen.queryByText("Meer details")).toBeNull();
  });
});

describe("alertEnd", () => {
  const now = Date.UTC(2026, 10, 9, 12, 0); // Mon 9 Nov 2026, 13:00 in Amsterdam
  it("gives the time alone when the message ends today", () => {
    expect(alertEnd(Date.UTC(2026, 10, 9, 17, 0) / 1000, "nl", now)).toBe("18:00");
  });
  it("names the day when it ends on another day (GVB's notice for 14-15 Nov)", () => {
    const end = Date.UTC(2026, 10, 14, 0, 0) / 1000; // 14 Nov, 01:00 in Amsterdam
    expect(alertEnd(end, "nl", now)).toMatch(/^za 14 nov\.?, 01:00$/);
    expect(alertEnd(end, "en", now)).toMatch(/Sat.*14 Nov.*01:00/);
  });
  it("counts the day in Amsterdam, not in UTC", () => {
    // 23:30 UTC on 9 Nov is already 00:30 on 10 Nov in Amsterdam.
    expect(alertEnd(Date.UTC(2026, 10, 9, 23, 30) / 1000, "nl", now)).toMatch(/^di 10 nov/);
  });
});

describe("alertStations", () => {
  it("drops every town, so a comma list reads as stations, and sorts by name", () => {
    expect(
      alertStations([
        "Amsterdam, Wibautstraat",
        "Diemen, Station Diemen Zuid",
        "Diemen, Verrijn Stuartweg",
        "Amsterdam, Centraal Station",
        "Duivendrecht, Station Duivendrecht",
      ]),
    ).toBe("CS, Station Diemen Zuid, Station Duivendrecht, Verrijn Stuartweg, Wibautstraat");
  });
});
