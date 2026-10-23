import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnimatedTrain } from "../types";
import { TrainPopup } from "./TrainPopup";

const NOW = Date.UTC(2026, 9, 22, 10, 0, 0); // 12:00 Amsterdam

function train(over: Partial<AnimatedTrain>): AnimatedTrain {
  return {
    id: "t1",
    line: "53",
    latitude: 52.35,
    longitude: 4.92,
    bearing: 0,
    distance_m: 0,
    speed_m_s: 15,
    shape_id: "s",
    headsign: "Amsterdam, Gaasperplas",
    delay_s: 0,
    status: "moving",
    prev_station: "Amsterdam, Wibautstraat",
    next_station: "Amsterdam, Spaklerweg",
    next_arrival_ts: NOW / 1000 + 60,
    prev_departure_ts: NOW / 1000 - 60,
    stops_remaining: 6,
    final_arrival_ts: NOW / 1000 + 900,
    realtime: true,
    fetchedAt: NOW,
    ...over,
  };
}

const show = (t: AnimatedTrain) =>
  render(<TrainPopup train={t} color="#E6194B" x={300} y={300} containerWidth={800} nowMs={NOW} />);

describe("TrainPopup platform", () => {
  it("shows the platform it is heading to while moving", () => {
    show(train({ platform: "1" }));
    // The "To" row comes first; the arrival line further down names the stop again.
    expect(screen.getAllByText(/Spaklerweg/)[0].parentElement!.textContent).toContain("perron 1");
    expect(screen.getByText(/Wibautstraat/).parentElement!.textContent).not.toContain("perron");
  });

  it("shows the platform it stands at while dwelling", () => {
    show(train({ status: "dwelling", prev_station: "Amsterdam, Spaklerweg", next_station: "Amsterdam, Van der Madeweg", platform: "2" }));
    expect(screen.getByText(/^Spaklerweg/).parentElement!.textContent).toContain("perron 2");
  });

  it("says nothing where the timetable has no platform", () => {
    show(train({ next_station: "Amsterdam, Centraal Station", platform: null }));
    expect(screen.queryByText(/perron/)).toBeNull();
  });
});

describe("TrainPopup close button", () => {
  it("is only there for a followed train on touch screens, and stops following", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<TrainPopup train={train({})} color="#E6194B" x={300} y={300} containerWidth={800} nowMs={NOW} />);
    expect(screen.queryByRole("button", { name: "Stop met volgen" })).toBeNull();
    rerender(<TrainPopup train={train({})} color="#E6194B" x={300} y={300} containerWidth={800} nowMs={NOW} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Stop met volgen" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("TrainPopup progress", () => {
  it("shows the segment progress with one decimal and a Dutch comma", () => {
    // Left 60 s ago, arrives in 60 s: exactly halfway.
    show(train({}));
    expect(screen.getByText("50,0%")).toBeInTheDocument();
  });

  it("keeps one decimal between whole numbers", () => {
    // 63.96 s of a 120 s run = 53.3%.
    render(<TrainPopup train={train({})} color="#E6194B" x={300} y={300} containerWidth={800} nowMs={NOW + 3_960} />);
    expect(screen.getByText("53,3%")).toBeInTheDocument();
  });
});
