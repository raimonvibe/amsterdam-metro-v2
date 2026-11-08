import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK, STATIONS } from "../test/fixtures";
import { Line } from "../types";
import { setLang } from "../i18n";
import { PAGE_TEST_TIMEOUT } from "../test/timeouts";
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

describe("TravelInfoPage", { timeout: PAGE_TEST_TIMEOUT }, () => {
  it("opens on Centraal Station when the link names no station", async () => {
    const canonical = document.head.appendChild(Object.assign(document.createElement("link"), { rel: "canonical" }));
    renderPage();
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Centraal Station"));
    // CS is only the fallback: the address and head tags stay the overview's,
    // or a search engine would read /reisinfo as Centraal Station's page.
    expect(window.location.pathname).toBe("/reisinfo");
    expect(canonical.getAttribute("href")).toBe("https://amsterdammetro.nl/reisinfo");
    expect(document.title).toMatch(/^Reisinformatie/);
    canonical.remove();
  });

  it("shares the board's station, also when it is only the fallback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage();
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Centraal Station"));
    await userEvent.click(screen.getByRole("button", { name: /Deel/ }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/reisinfo/centraal-station/`);
  });

  it("gives a station the visitor picks its own address and head tags", async () => {
    renderPage();
    const index = await screen.findByRole("list", { name: "Alle stations" });
    await userEvent.click(within(index).getByRole("link", { name: /Rokin/ }));
    expect(window.location.pathname).toBe("/reisinfo/rokin/");
    expect(document.title).toMatch(/^Rokin — metro 52/);
  });

  it("names the site in the page's language", async () => {
    renderPage();
    expect(await screen.findByText("Metro Amsterdam Live")).toBeInTheDocument();
    cleanup();
    setLang("en", { persist: false });
    renderPage("/en/reisinfo");
    expect(await screen.findByText("Amsterdam Metro Live")).toBeInTheDocument();
  });

  it("opens the station and trip a link names, in any spelling", async () => {
    renderPage("/reisinfo?station=waterlooplein&van=noord&naar=gein&lijn=53");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Waterlooplein"));
    await waitFor(() => expect(api.fetchJourneys).toHaveBeenCalledWith("Amsterdam, Noord", "Amsterdam, Gein", 6));
    // The station moves into the path; the query keeps the trip and line.
    expect(window.location.pathname).toBe("/reisinfo/waterlooplein/");
    expect(window.location.search).toBe("?van=Noord&naar=Gein&lijn=53");
  });

  it("switches station from the index and remembers it as recent", async () => {
    renderPage();
    const index = await screen.findByRole("list", { name: "Alle stations" });
    await userEvent.click(within(index).getByRole("link", { name: /Rokin/ }));
    expect(boardHeading()).toHaveTextContent("Rokin");
    expect(JSON.parse(localStorage.getItem("metro-live:recent")!)).toEqual(["Amsterdam, Rokin"]);
    expect(window.location.pathname).toBe("/reisinfo/rokin/");
  });

  it("puts the planner's departure station on the board too", async () => {
    renderPage();
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Centraal Station"));
    await userEvent.type(screen.getByRole("combobox", { name: "Van station" }), "gein");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Gein"));
    expect(window.location.search).toContain("van=Gein");
    expect(window.location.pathname).toBe("/reisinfo/gein/");
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
    await userEvent.click(within(index).getByRole("link", { name: /Rokin/ }));
    await userEvent.click(screen.getByRole("button", { name: /Kaart/ }));
    expect(first.onClose).toHaveBeenCalledWith(expect.objectContaining({ name: "Amsterdam, Rokin" }));
    cleanup();

    const linked = renderPage("/reisinfo?station=Zuid");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Station Zuid"));
    await userEvent.click(screen.getByRole("button", { name: /Kaart/ }));
    expect(linked.onClose).toHaveBeenCalledWith(expect.objectContaining({ name: "Amsterdam, Station Zuid" }));
  });

  it("keeps the planned trip across a visit to the map", async () => {
    renderPage("/reisinfo?van=CS&naar=Gein");
    await waitFor(() => expect(api.fetchJourneys).toHaveBeenCalledWith("Amsterdam, Centraal Station", "Amsterdam, Gein", 6));
    cleanup();
    vi.mocked(api.fetchJourneys).mockClear();

    // Back from the map, the link names only the station picked there.
    renderPage("/reisinfo?station=Zuid");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Station Zuid"));
    await waitFor(() => expect(api.fetchJourneys).toHaveBeenCalledWith("Amsterdam, Centraal Station", "Amsterdam, Gein", 6));
    expect(window.location.search).toContain("van=CS&naar=Gein");
    cleanup();

    // A link with a trip of its own wins over the kept one.
    renderPage("/reisinfo?van=Noord&naar=Zuid");
    await waitFor(() => expect(window.location.search).toContain("van=Noord&naar=Station+Zuid"));
  });

  it("shows the station on the map", async () => {
    const { onShowOnMap } = renderPage("/reisinfo?station=Zuid");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Station Zuid"));
    await userEvent.click(screen.getByRole("button", { name: /Op kaart/ }));
    expect(onShowOnMap).toHaveBeenCalledWith(expect.objectContaining({ name: "Amsterdam, Station Zuid" }));
  });

  it("draws the line overview from the network", async () => {
    // "Metro <52> · Noord - Zuid": the number sits in its own untranslated span.
    const lineTitle = (id: string) => (_: string, el: Element | null) =>
      !!el?.textContent?.startsWith(`Metro ${id} ·`) && ![...el.children].some((c) => c.textContent?.startsWith("Metro"));
    renderPage("/reisinfo?lijn=52");
    expect(await screen.findByText(lineTitle("52"))).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("group", { name: "Kies een lijn" })).getByRole("button", { name: "Lijn 53" }));
    expect(screen.getByText(lineTitle("53"))).toBeInTheDocument();
  });
  it("opens the station a station page's path names, and keeps that address", async () => {
    const canonical = document.head.appendChild(Object.assign(document.createElement("link"), { rel: "canonical" }));
    renderPage("/reisinfo/bijlmer-arena/");
    expect(await screen.findByRole("heading", { level: 3, name: /Bijlmer ArenA/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/reisinfo/bijlmer-arena/");
    expect(canonical.getAttribute("href")).toBe("https://amsterdammetro.nl/reisinfo/bijlmer-arena/");
    expect(document.title).toMatch(/^Station Bijlmer ArenA — metro 50, 54/);
    canonical.remove();
  });
  it("keeps a station page's own head tags while the stations are still loading", () => {
    const canonical = document.head.appendChild(Object.assign(document.createElement("link"), { rel: "canonical", href: "https://amsterdammetro.nl/reisinfo/zuid/" }));
    document.title = "Station Zuid — built page";
    window.history.replaceState({}, "", "/reisinfo/zuid/");
    render(<TravelInfoPage stations={[]} lines={LINES} trains={[]} status={null} theme="light" onToggleTheme={vi.fn()} onClose={vi.fn()} onShowOnMap={vi.fn()} />);
    expect(document.title).toBe("Station Zuid — built page");
    expect(canonical.getAttribute("href")).toBe("https://amsterdammetro.nl/reisinfo/zuid/");
    canonical.remove();
  });
  it("puts the line in the address only when the visitor chose one", async () => {
    renderPage("/reisinfo/rokin/");
    await waitFor(() => expect(boardHeading()).toHaveTextContent("Rokin"));
    // The default line stays out of the address.
    expect(window.location.search).toBe("");
    renderPage("/reisinfo/rokin/?lijn=53");
    await waitFor(() => expect(window.location.search).toBe("?lijn=53"));
  });
});
