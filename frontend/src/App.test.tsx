import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATIONS } from "./test/fixtures";
import type { Station } from "./types";

// The camera rules live in App; the map, sidebar, data and travel page are
// stand-ins that expose just the props and callbacks those rules run through.
let mapProps: Record<string, any> = {};
vi.mock("./components/MetroMap", () => ({
  NO_HOVER: false,
  MetroMap: (props: Record<string, any>) => {
    mapProps = props;
    return <div data-testid="map" />;
  },
}));
vi.mock("./components/Sidebar", () => ({
  Sidebar: (props: { onOpenTravel: () => void }) => (
    <button type="button" onClick={props.onOpenTravel}>
      Reisinformatie openen
    </button>
  ),
}));
vi.mock("./components/LiveBadge", () => ({ LiveBadge: () => null }));
vi.mock("./components/DepartureBoard", () => ({ DepartureBoard: () => null }));
vi.mock("./components/FollowChip", () => ({ FollowChip: () => null }));
vi.mock("./stream", () => ({ streamWhileVisible: () => () => {} }));
vi.mock("./api", () => ({
  fetchLines: vi.fn().mockResolvedValue([]),
  fetchStations: vi.fn(async () => STATIONS),
  fetchShapes: vi.fn().mockResolvedValue({}),
}));
vi.mock("./travel/TravelInfoPage", () => ({
  default: (props: { onClose: (s: Station | null) => void }) => {
    const gein = STATIONS.find((s) => s.name === "Amsterdam, Gein")!;
    return (
      <div>
        <button type="button" onClick={() => props.onClose(gein)}>
          Kaart na Gein kiezen
        </button>
        <button type="button" onClick={() => props.onClose(null)}>
          Kaart zonder keuze
        </button>
      </div>
    );
  },
}));

import App from "./App";

const noord = () => STATIONS.find((s) => s.name === "Amsterdam, Noord")!;

async function followTrainThenOpenTravel() {
  render(<App />);
  await waitFor(() => expect(mapProps.stations?.length).toBeGreaterThan(0));
  act(() => mapProps.onTrainClick({ id: "52-zuid" }));
  expect(mapProps.followedTrainId).toBe("52-zuid");
  await userEvent.click(screen.getByRole("button", { name: "Reisinformatie openen" }));
  await screen.findByRole("button", { name: "Kaart na Gein kiezen" });
}

beforeEach(() => {
  mapProps = {};
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
});

describe("camera: the latest explicit choice wins", () => {
  it("going back with a chosen station flies there and stops following the train", async () => {
    await followTrainThenOpenTravel();
    await userEvent.click(screen.getByRole("button", { name: "Kaart na Gein kiezen" }));
    expect(mapProps.focusStation?.station.name).toBe("Amsterdam, Gein");
    expect(mapProps.followedTrainId).toBeNull();
  });

  it("going back without a choice leaves the map as it was, still following", async () => {
    await followTrainThenOpenTravel();
    await userEvent.click(screen.getByRole("button", { name: "Kaart zonder keuze" }));
    expect(mapProps.focusStation ?? null).toBeNull();
    expect(mapProps.followedTrainId).toBe("52-zuid");
  });

  it("follow-cam is paused while the travel page covers the map", async () => {
    await followTrainThenOpenTravel();
    expect(mapProps.paused).toBe(true);
  });

  it("Escape on the travel page does not drop the map's followed train", async () => {
    await followTrainThenOpenTravel();
    await userEvent.keyboard("{Escape}");
    expect(mapProps.followedTrainId).toBe("52-zuid");
  });

  it("opening a station on the map stops following a train", async () => {
    render(<App />);
    await waitFor(() => expect(mapProps.stations?.length).toBeGreaterThan(0));
    act(() => mapProps.onTrainClick({ id: "52-zuid" }));
    act(() => mapProps.onStationClick(noord()));
    expect(mapProps.followedTrainId).toBeNull();
  });
});
