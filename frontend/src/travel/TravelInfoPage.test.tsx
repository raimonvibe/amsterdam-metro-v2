import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK, STATIONS } from "../test/fixtures";
import { Line } from "../types";
import TravelInfoPage from "./TravelInfoPage";

vi.mock("../api", () => ({
  fetchBoard: vi.fn().mockResolvedValue([]),
  fetchStationInfo: vi.fn().mockResolvedValue({ station: "", lines: [], service_day: "", directions: [] }),
  fetchJourneys: vi.fn().mockResolvedValue([]),
  fetchNetwork: vi.fn(),
}));
import * as api from "../api";

const LINES: Line[] = NETWORK.map((l) => ({ id: l.id, name: l.name, color: l.color, shape: [] }));

function renderPage(url = "/reisinfo") {
  window.history.replaceState({}, "", url);
  const onClose = vi.fn();
  const onShowOnMap = vi.fn();
  const onToggleTheme = vi.fn();
  render(<TravelInfoPage stations={STATIONS} lines={LINES} trains={[]} status={null} theme="light" onToggleTheme={onToggleTheme} onClose={onClose} onShowOnMap={onShowOnMap} />);
  return { onClose, onShowOnMap, onToggleTheme };
}

const boardHeading = () => within(document.getElementById("vertrekstaat")!).getByRole("heading", { level: 3 });

beforeEach(() => {
  vi.mocked(api.fetchNetwork).mockResolvedValue(NETWORK);
});

describe("TravelInfoPage", () => {
  it("opens on Centraal Station when the link names no station", async () => {
    renderPage();
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Centraal Station"));
    await waitFor(() => expect(window.location.search).toContain("station=CS"));
  });

  it("opens the station and trip a link names, in any spelling", async () => {
    renderPage("/reisinfo?station=waterlooplein&van=noord&naar=gein&lijn=53");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Waterlooplein"));
    await waitFor(() => expect(api.fetchJourneys).toHaveBeenCalledWith("Amsterdam, Noord", "Amsterdam, Gein", 6));
    expect(window.location.search).toBe("?station=Waterlooplein&van=Noord&naar=Gein&lijn=53");
  });

  it("switches station from the index and remembers it as recent", async () => {
    renderPage();
    const index = await screen.findByRole("list", { name: "Alle stations" });
    await userEvent.click(within(index).getByRole("button", { name: /Rokin/ }));
    expect(boardHeading()).toHaveTextContent("Rokin");
    expect(JSON.parse(localStorage.getItem("metro-live:recent")!)).toEqual(["Amsterdam, Rokin"]);
    expect(window.location.search).toContain("station=Rokin");
  });

  it("puts the planner's departure station on the board too", async () => {
    renderPage();
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Centraal Station"));
    await userEvent.type(screen.getByRole("combobox", { name: "Van station" }), "gein");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Gein"));
    expect(window.location.search).toContain("van=Gein");
    expect(window.location.search).toContain("station=Gein");
  });

  it("toggles a favourite with the button and with F", async () => {
    renderPage("/reisinfo?station=Noord");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Noord"));
    await userEvent.click(screen.getByRole("button", { name: /Favoriet/ }));
    expect(JSON.parse(localStorage.getItem("metro-live:favourites")!)).toEqual(["Amsterdam, Noord"]);
    await userEvent.keyboard("f");
    expect(JSON.parse(localStorage.getItem("metro-live:favourites")!)).toEqual([]);
  });

  it("lets letter shortcuts be switched off (WCAG 2.1.4)", async () => {
    renderPage("/reisinfo?station=Noord");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Noord"));
    await userEvent.click(screen.getByRole("button", { name: "Sneltoetsen" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Lettertoetsen gebruiken" }));
    (document.activeElement as HTMLElement).blur();
    await userEvent.keyboard("f");
    expect(localStorage.getItem("metro-live:favourites")).toBeNull();
    expect(JSON.parse(localStorage.getItem("metro-live:travel-prefs")!).shortcuts).toBe(false);
  });

  it("switches between light and dark", async () => {
    const { onToggleTheme } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Donkere weergave" }));
    expect(onToggleTheme).toHaveBeenCalledOnce();
  });

  it("focuses search on / and returns to the map on Escape", async () => {
    const { onClose } = renderPage();
    await screen.findByRole("list", { name: "Alle stations" });
    await userEvent.keyboard("/");
    expect(screen.getByRole("combobox", { name: "Zoek een station, lijn of reis" })).toHaveFocus();
    await userEvent.keyboard("{Escape}"); // closes the (empty) search first
    (document.activeElement as HTMLElement).blur();
    await userEvent.keyboard("{Escape}");
    // Only looked around (CS was the fallback): the map should stay as it was.
    expect(onClose).toHaveBeenCalledWith(null);
  });

  it("hands the map the station the visitor chose, or arrived with", async () => {
    const first = renderPage();
    const index = await screen.findByRole("list", { name: "Alle stations" });
    await userEvent.click(within(index).getByRole("button", { name: /Rokin/ }));
    await userEvent.click(screen.getByRole("button", { name: /Kaart/ }));
    expect(first.onClose).toHaveBeenCalledWith(expect.objectContaining({ name: "Amsterdam, Rokin" }));
    cleanup();

    const linked = renderPage("/reisinfo?station=Zuid");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Station Zuid"));
    await userEvent.click(screen.getByRole("button", { name: /Kaart/ }));
    expect(linked.onClose).toHaveBeenCalledWith(expect.objectContaining({ name: "Amsterdam, Station Zuid" }));
  });

  it("shows the station on the map", async () => {
    const { onShowOnMap } = renderPage("/reisinfo?station=Zuid");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Station Zuid"));
    await userEvent.click(screen.getByRole("button", { name: /Op kaart/ }));
    expect(onShowOnMap).toHaveBeenCalledWith(expect.objectContaining({ name: "Amsterdam, Station Zuid" }));
  });

  it("draws the line overview from the network", async () => {
    renderPage("/reisinfo?lijn=52");
    expect(await screen.findByText(/Metro 52 ·/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Lijn 53" }));
    expect(screen.getByText(/Metro 53 ·/)).toBeInTheDocument();
  });
});
