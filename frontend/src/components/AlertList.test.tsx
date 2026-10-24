import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setLang } from "../i18n";
import { ServiceAlert } from "../types";
import { AlertList, alertsFor, lineWide } from "./AlertList";

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

  it("says 'whole line' on phones instead of listing every station", () => {
    render(<AlertList alerts={[{ ...stationAlert, whole_line: true }]} colorOf={colorOf} />);
    expect(screen.getByText("Hele lijn")).toHaveClass("sm:hidden");
    expect(screen.getByText("Wibautstraat").closest("p")).toHaveClass("hidden", "sm:block");
  });

  it("leaves out stations and details when compact", () => {
    render(<AlertList alerts={[stationAlert]} colorOf={colorOf} compact />);
    expect(screen.queryByText("Wibautstraat")).toBeNull();
    expect(screen.queryByText("Meer details")).toBeNull();
  });
});
