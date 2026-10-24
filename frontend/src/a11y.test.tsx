import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlertAnnouncer } from "./components/AlertList";
import { DepartureBoard } from "./components/DepartureBoard";
import { Sidebar } from "./components/Sidebar";
import { contrastRatio, onColor } from "./contrast";
import { ServiceAlert, Station } from "./types";

const LINE_COLORS = ["#3CB44B", "#F58231", "#4363D8", "#E6194B", "#FFE119"];

describe("line badge text", () => {
  it("meets 4.5:1 on every line colour", () => {
    for (const c of LINE_COLORS) expect(contrastRatio(c, onColor(c))).toBeGreaterThanOrEqual(4.5);
  });

  it("is white on line 52's blue, black on the yellow", () => {
    expect(onColor("#4363D8")).toBe("#ffffff");
    expect(onColor("#FFE119")).toBe("#000000");
  });
});

const stations: Station[] = [
  { id: "1", name: "Amsterdam, Waterlooplein", latitude: 0, longitude: 0, lines: ["51", "53", "54"] },
  { id: "2", name: "Amsterdam, De Pijp", latitude: 0, longitude: 0, lines: ["52"] },
];

describe("station picker", () => {
  it("opens a station without pointing at the map", async () => {
    const onPick = vi.fn();
    render(
      <Sidebar
        lines={[]} visibleLines={[]} onToggleLine={() => {}} trains={[]} status={null}
        hoveredStation={null} lastUpdated={null} mapStyle="liberty" onMapStyleChange={() => {}}
        onOpenPrivacy={() => {}} onOpenTravel={() => {}} onClose={() => {}}
        stations={stations} onPickStation={onPick}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Station kiezen" }), "Amsterdam, De Pijp");
    expect(onPick).toHaveBeenCalledWith(stations[1]);
  });
});

describe("departure card", () => {
  it("lets a train on the map be followed from its row", async () => {
    const now = Date.now() / 1000;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([
        { trip_id: "t1", line: "52", headsign: "Amsterdam, Noord", departure_ts: now + 300, delay_s: 0, realtime: true },
        { trip_id: "t2", line: "52", headsign: "Amsterdam, Noord", departure_ts: now + 900, delay_s: 0, realtime: true },
      ])),
    );
    const onFollow = vi.fn();
    render(
      <DepartureBoard station={stations[1]} lines={[]} onClose={() => {}} followable={new Set(["t1"])} onFollow={onFollow} />,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Volg metro 52 naar Noord/ }));
    expect(onFollow).toHaveBeenCalledWith("t1");
    // A trip not yet on the map is not offered.
    expect(screen.getAllByRole("button", { name: /Volg metro/ })).toHaveLength(1);
    vi.restoreAllMocks();
  });
});

describe("alert announcer", () => {
  const alert: ServiceAlert = {
    id: "a1", header: { nl: "Rituitval M52.", en: "Gap in M52 service." },
    lines: ["52"], stations: [], effect: "UNKNOWN_EFFECT",
  };

  it("reads a new line-wide message once", () => {
    const { rerender } = render(<AlertAnnouncer alerts={[]} />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("");
    rerender(<AlertAnnouncer alerts={[alert]} />);
    expect(region).toHaveTextContent("Melding lijn 52: Rituitval M52.");
    // The same message on a later refresh is not read again.
    act(() => rerender(<AlertAnnouncer alerts={[{ ...alert }]} />));
    expect(region).toHaveTextContent("Melding lijn 52: Rituitval M52.");
  });
});
