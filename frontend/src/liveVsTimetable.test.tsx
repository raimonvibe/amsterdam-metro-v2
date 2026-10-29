import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DepartureBoard } from "./components/DepartureBoard";
import { Station } from "./types";

const station: Station = { id: "1", name: "Amsterdam, De Pijp", latitude: 0, longitude: 0, lines: ["52"] };

function serve(rows: { trip_id: string; realtime: boolean; inMin: number }[]) {
  const now = Date.now() / 1000;
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(rows.map((r) => ({
      trip_id: r.trip_id, line: "52", headsign: "Amsterdam, Noord",
      departure_ts: now + r.inMin * 60, delay_s: 0, realtime: r.realtime,
    })))),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("live vs timetable on the station card", () => {
  it("marks only the timetable rows, and says once that the rest is live", async () => {
    serve([{ trip_id: "a", realtime: true, inMin: 2 }, { trip_id: "b", realtime: false, inMin: 2 }]);
    render(<DepartureBoard station={station} lines={[]} onClose={() => {}} />);
    expect(await screen.findByText("Tijden zijn live, tenzij ‘gepland’.")).toBeInTheDocument();
    // One "gepland", for the timetable row only, with the full words for screen readers.
    expect(screen.getAllByText("gepland")).toHaveLength(1);
    expect(screen.getByText("volgens dienstregeling, geen live signaal")).toHaveClass("sr-only");
  });

  it("says nothing extra when every time is live", async () => {
    serve([{ trip_id: "a", realtime: true, inMin: 2 }]);
    render(<DepartureBoard station={station} lines={[]} onClose={() => {}} />);
    await screen.findByText("2 min");
    expect(screen.queryByText(/Tijden zijn live/)).toBeNull();
    expect(screen.queryByText("gepland")).toBeNull();
  });

  it("warns when the live feed is down", async () => {
    serve([{ trip_id: "b", realtime: false, inMin: 2 }]);
    render(<DepartureBoard station={station} lines={[]} onClose={() => {}} live={false} />);
    // The card has more than one status region (the lift link's "Gekopieerd" too).
    const warning = await screen.findByText(/Live gegevens tijdelijk niet beschikbaar/);
    expect(warning.closest('[role="status"]')).not.toBeNull();
  });

  it("tells screen readers a followable timetable row is planned", async () => {
    serve([{ trip_id: "b", realtime: false, inMin: 2 }]);
    render(<DepartureBoard station={station} lines={[]} onClose={() => {}} followable={new Set(["b"])} onFollow={() => {}} />);
    expect(await screen.findByRole("button", { name: /2 min, volgens dienstregeling/ })).toBeInTheDocument();
  });
});
