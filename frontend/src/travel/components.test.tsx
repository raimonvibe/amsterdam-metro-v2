import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATIONS } from "../test/fixtures";
import { AnimatedTrain } from "../types";
import { JourneyPlanner, JourneyPlannerProps, fastestIndex, routeKeyOf, stairsOn } from "./JourneyPlanner";
import { routeStretches } from "./LineDiagram";
import { SearchBox } from "./SearchBox";
import { StationBoard, groupByDirection } from "./StationBoard";
import { StationClock, handAngles } from "./StationClock";
import { DEFAULT_PREFS } from "./storage";
import { BoardDeparture, Journey } from "./types";

vi.mock("../api", async (importOriginal) => ({
  // The real SlowDown class: components test `instanceof` against it.
  ...(await importOriginal<typeof import("../api")>()),
  fetchBoard: vi.fn(),
  fetchStationInfo: vi.fn(),
  fetchJourneys: vi.fn(),
  fetchNetwork: vi.fn(),
}));
import * as api from "../api";

const NOW = Date.UTC(2026, 9, 22, 10, 0, 0); // 12:00 Amsterdam
const s = (offsetMin: number) => NOW / 1000 + offsetMin * 60;
const colorOf = () => "#4363D8";
const LINES = ["50", "51", "52", "53", "54"];
const byName = (n: string) => STATIONS.find((x) => x.name === n)!;
const CS = byName("Amsterdam, Centraal Station");

function dep(over: Partial<BoardDeparture>): BoardDeparture {
  return {
    trip_id: Math.random().toString(36).slice(2),
    line: "52",
    headsign: "Zuid",
    departure_ts: s(5),
    delay_s: 0,
    realtime: true,
    scheduled_ts: s(5),
    stop_id: "x",
    stops_remaining: 5,
    terminus_ts: s(15),
    cancelled: false,
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(api.fetchBoard).mockReset();
  vi.mocked(api.fetchStationInfo).mockReset().mockResolvedValue({
    station: CS.name,
    lines: CS.lines,
    service_day: "20261022",
    directions: [
      { line: "52", headsign: "Zuid", first_ts: s(-400), last_ts: s(700), headway_min: 6, departures_next_hour: 10, next_stops: ["Amsterdam, Rokin"] },
    ],
  });
  vi.mocked(api.fetchJourneys).mockReset();
});

describe("SearchBox", () => {
  function setup(mode: "all" | "station" = "all") {
    const handlers = { onStation: vi.fn(), onLine: vi.fn(), onRoute: vi.fn(), onNearby: vi.fn() };
    render(
      <SearchBox label="Zoek" placeholder="Zoek…" stations={STATIONS} lineIds={LINES} colorOf={colorOf} mode={mode} {...handlers} />,
    );
    return { input: screen.getByRole("combobox"), ...handlers };
  }

  it("finds a station by landmark and picks it with the keyboard", async () => {
    const { input, onStation } = setup();
    await userEvent.type(input, "arena");
    expect(screen.getByRole("option", { name: /Bijlmer ArenA/ })).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(onStation).toHaveBeenCalledWith(byName("Amsterdam, Station Bijlmer ArenA"));
    expect(input).toHaveValue("");
  });

  it("moves the highlight with the arrow keys", async () => {
    const { input, onStation } = setup();
    await userEvent.type(input, "station");
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(2);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onStation).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("turns 'noord naar gein' into a trip", async () => {
    const { input, onRoute } = setup();
    await userEvent.type(input, "noord naar gein{Enter}");
    expect(onRoute).toHaveBeenCalledWith(byName("Amsterdam, Noord"), byName("Amsterdam, Gein"));
  });

  it("offers a line overview for '52' and the location for 'dichtbij'", async () => {
    const { input, onLine, onNearby } = setup();
    await userEvent.type(input, "52{Enter}");
    expect(onLine).toHaveBeenCalledWith("52");
    await userEvent.type(input, "dichtbij{Enter}");
    expect(onNearby).toHaveBeenCalled();
  });

  it("explains when nothing matches, and Escape clears", async () => {
    const { input } = setup();
    await userEvent.type(input, "xqzw");
    expect(screen.getByText(/Geen station gevonden/)).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveValue("");
  });

  it("keeps station names out of browser translation", async () => {
    // Translated to English, "Gein" showed up as "Joke".
    const { input } = setup("station");
    await userEvent.type(input, "gein");
    const name = within(screen.getByRole("option", { name: /Gein/ })).getByText("Gein");
    expect(name.closest("[translate='no']")).not.toBeNull();
  });

  it("lists every station A–Z before anything is typed", async () => {
    // A keyboard in another script cannot type the Dutch names.
    const { input, onStation } = setup("station");
    await userEvent.click(input);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(STATIONS.length);
    expect(screen.getByText("Alle stations")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: /Gein/ }));
    expect(onStation).toHaveBeenCalledWith(byName("Amsterdam, Gein"));
  });

  it("opens the full list from the arrow button", async () => {
    setup("station");
    await userEvent.click(screen.getByRole("button", { name: "Alle stations tonen" }));
    expect(screen.getAllByRole("option")).toHaveLength(STATIONS.length);
  });

  it("falls back to the full list for text in another script, but Enter picks nothing", async () => {
    const { input, onStation } = setup("station");
    await userEvent.type(input, "আমস্টেল");
    expect(screen.getByText(/Geen station gevonden/)).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(STATIONS.length);
    await userEvent.keyboard("{Enter}");
    expect(onStation).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onStation).toHaveBeenCalledTimes(1);
  });

  it("reads digits in other scripts: Bengali ৫২ is line 52", async () => {
    const { input, onLine } = setup();
    await userEvent.type(input, "৫২{Enter}");
    expect(onLine).toHaveBeenCalledWith("52");
  });

  it("in station mode offers stations only", async () => {
    const { input, onRoute } = setup("station");
    await userEvent.type(input, "noord naar gein{Enter}");
    expect(onRoute).not.toHaveBeenCalled();
  });
});

describe("SearchBox placeholder", () => {
  it("uses the short placeholder on phone-width screens", () => {
    const mm = vi.fn((q: string) => ({ matches: q.includes("max-width"), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("matchMedia", mm);
    render(<SearchBox label="Zoek" placeholder="Zoek station, lijn of reis" shortPlaceholder="Station of reis" stations={STATIONS} lineIds={LINES} colorOf={colorOf} onStation={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Zoek" })).toHaveAttribute("placeholder", "Station of reis");
    vi.unstubAllGlobals();
  });

  it("keeps the full placeholder on wider screens", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<SearchBox label="Zoek" placeholder="Zoek station, lijn of reis" shortPlaceholder="Station of reis" stations={STATIONS} lineIds={LINES} colorOf={colorOf} onStation={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Zoek" })).toHaveAttribute("placeholder", "Zoek station, lijn of reis");
    vi.unstubAllGlobals();
  });
});

describe("SearchBox on touch screens", () => {
  // The dropdown sat behind the phone keyboard and ran off the screen.
  it("opens a full-screen list to tap, without a keyboard", async () => {
    vi.stubGlobal("matchMedia", vi.fn((q: string) => ({ matches: q.includes("coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const onStation = vi.fn();
    render(<SearchBox label="Van station" placeholder="Vertrekstation" stations={STATIONS} lineIds={LINES} colorOf={colorOf} mode="station" onStation={onStation} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Van station" }));
    const sheet = screen.getByRole("dialog", { name: "Van station" });
    expect(within(sheet).getAllByRole("option")).toHaveLength(STATIONS.length);
    expect(within(sheet).getByRole("combobox")).not.toHaveFocus();
    await userEvent.click(within(sheet).getByRole("option", { name: /Gein/ }));
    expect(onStation).toHaveBeenCalledWith(byName("Amsterdam, Gein"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("closes with the close button", async () => {
    vi.stubGlobal("matchMedia", vi.fn((q: string) => ({ matches: q.includes("coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<SearchBox label="Naar station" placeholder="Aankomststation" stations={STATIONS} lineIds={LINES} colorOf={colorOf} mode="station" onStation={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Naar station" }));
    await userEvent.click(screen.getByRole("button", { name: "Sluiten" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe("StationBoard", () => {
  function renderBoard(over: Partial<React.ComponentProps<typeof StationBoard>> = {}) {
    const props: React.ComponentProps<typeof StationBoard> = {
      station: CS,
      colorOf,
      trains: [],
      prefs: DEFAULT_PREFS,
      onPrefs: vi.fn(),
      nowMs: NOW,
      favourite: false,
      onToggleFavourite: vi.fn(),
      onShare: vi.fn(),
      onShowOnMap: vi.fn(),
      onPlanFrom: vi.fn(),
      onStation: vi.fn(),
      ...over,
    };
    return { props, ...render(<StationBoard {...props} />) };
  }

  it("shows one platform on the card, several per row, and none when unknown", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([
      dep({ headsign: "Zuid", platform: "2", departure_ts: s(2) }),
      dep({ headsign: "Zuid", platform: "2", departure_ts: s(6) }),
      dep({ line: "53", headsign: "Gaasperplas", platform: "3", departure_ts: s(3) }),
      dep({ line: "53", headsign: "Gaasperplas", platform: "4", departure_ts: s(7) }),
      dep({ line: "54", headsign: "Gein", platform: null, departure_ts: s(4) }),
    ]);
    renderBoard();
    const zuid = (await screen.findByRole("heading", { name: "Richting Zuid" })).closest("article")!;
    expect(within(zuid).getByText("Perron 2")).toBeInTheDocument();
    expect(within(zuid).queryByText("perron 2")).toBeNull();
    const gaasperplas = screen.getByRole("heading", { name: "Richting Gaasperplas" }).closest("article")!;
    expect(within(gaasperplas).getByText("perron 3")).toBeInTheDocument();
    expect(within(gaasperplas).getByText("perron 4")).toBeInTheDocument();
    const gein = screen.getByRole("heading", { name: "Richting Gein" }).closest("article")!;
    expect(within(gein).queryByText(/perron/i)).toBeNull();
  });

  it("treats 'slow down' as quiet: no connection warning, retries when told", async () => {
    // Many people behind one address (a mobile network) can hit the API's
    // per-address limit. That is not the visitor's connection failing.
    vi.mocked(api.fetchBoard)
      .mockRejectedValueOnce(new api.SlowDown(1))
      .mockResolvedValue([dep({ headsign: "Zuid", departure_ts: s(4) })]);
    renderBoard();
    expect(await screen.findByRole("heading", { name: "Richting Zuid" }, { timeout: 3000 })).toBeInTheDocument();
    expect(api.fetchBoard).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/verbinding hapert/)).toBeNull();
    expect(screen.queryByText(/niet bereikbaar/)).toBeNull();
  });

  it("still warns when the connection really fails", async () => {
    vi.mocked(api.fetchBoard).mockRejectedValue(new Error("network down"));
    renderBoard();
    expect(await screen.findByText(/niet bereikbaar/)).toBeInTheDocument();
  });

  it("says when a direction leaves from changing, unnamed tracks", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([
      dep({ line: "54", headsign: "Gein", stop_id: "east-1", departure_ts: s(2) }),
      dep({ line: "54", headsign: "Gein", stop_id: "east-2", departure_ts: s(12) }),
      dep({ headsign: "Zuid", stop_id: "ns-zuid", departure_ts: s(3) }),
      dep({ headsign: "Zuid", stop_id: "ns-zuid", departure_ts: s(9) }),
      dep({ line: "53", headsign: "Gaasperplas", platform: "3", stop_id: "a", departure_ts: s(4) }),
      dep({ line: "53", headsign: "Gaasperplas", platform: "4", stop_id: "b", departure_ts: s(8) }),
    ]);
    renderBoard();
    const gein = (await screen.findByRole("heading", { name: "Richting Gein" })).closest("article")!;
    expect(within(gein).getByText(/wisselend spoor/)).toBeInTheDocument();
    // One track, or named platforms: nothing to warn about.
    const zuid = screen.getByRole("heading", { name: "Richting Zuid" }).closest("article")!;
    expect(within(zuid).queryByText(/wisselend spoor/)).toBeNull();
    const gaasperplas = screen.getByRole("heading", { name: "Richting Gaasperplas" }).closest("article")!;
    expect(within(gaasperplas).queryByText(/wisselend spoor/)).toBeNull();
  });

  it("marks the direction of the planned journey", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([
      dep({ headsign: "Zuid", departure_ts: s(2) }),
      dep({ line: "54", headsign: "Gein", departure_ts: s(4) }),
    ]);
    renderBoard({
      routeLeg: { trip_id: "t", line: "54", headsign: "Gein", from: CS.name, to: "Amsterdam, Gein", departure_ts: s(4), arrival_ts: s(30), stops: 14, delay_s: 0, realtime: true },
    });
    const gein = (await screen.findByRole("heading", { name: "Richting Gein" })).closest("article")!;
    expect(within(gein).getByText("jouw reis")).toBeInTheDocument();
    const zuid = screen.getByRole("heading", { name: "Richting Zuid" }).closest("article")!;
    expect(within(zuid).queryByText("jouw reis")).toBeNull();
  });

  it("groups departures per direction with times, delays and cancellations", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([
      dep({ headsign: "Zuid", departure_ts: s(2), scheduled_ts: s(2) }),
      dep({ headsign: "Zuid", departure_ts: s(9), scheduled_ts: s(6), delay_s: 180 }),
      dep({ line: "54", headsign: "Gein", departure_ts: s(4), scheduled_ts: s(4), cancelled: true, realtime: false }),
    ]);
    renderBoard();
    const zuid = await screen.findByRole("heading", { name: "Richting Zuid" });
    const card = zuid.closest("article")!;
    expect(within(card).getByText("12:02")).toBeInTheDocument();
    expect(within(card).getByText("+3 min")).toBeInTheDocument();
    expect(within(card).getByText("12:06").parentElement).toHaveClass("line-through");
    const gein = screen.getByRole("heading", { name: "Richting Gein" }).closest("article")!;
    expect(within(gein).getByText("Vervallen")).toBeInTheDocument();
    expect(api.fetchBoard).toHaveBeenCalledWith(CS.name, 30, true);
  });

  it("shows the service summary per direction", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([dep({})]);
    renderBoard();
    expect(await screen.findByText(/elke ~6 min/)).toBeInTheDocument();
  });

  it("filters on a line", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([dep({ line: "52", headsign: "Zuid" }), dep({ line: "54", headsign: "Gein" })]);
    renderBoard();
    await screen.findByRole("heading", { name: "Richting Gein" });
    await userEvent.click(screen.getByTitle("Alleen lijn 52"));
    expect(screen.queryByRole("heading", { name: "Richting Gein" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Richting Zuid" })).toBeInTheDocument();
  });

  it("marks trains you can no longer reach given a walking time", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([dep({ departure_ts: s(2) }), dep({ departure_ts: s(12) })]);
    renderBoard({ prefs: { ...DEFAULT_PREFS, walkMin: 5 } });
    expect(await screen.findByText("niet haalbaar")).toBeInTheDocument();
    expect(screen.getByText("12 min")).toBeInTheDocument();
  });

  it("offers a wider window when nothing leaves soon", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([]);
    const { props } = renderBoard();
    await userEvent.click(await screen.findByRole("button", { name: "Toon 2 uur vooruit" }));
    expect(props.onPrefs).toHaveBeenCalledWith({ ...DEFAULT_PREFS, windowMin: 120 });
  });

  it("says so when the backend is unreachable", async () => {
    vi.mocked(api.fetchBoard).mockRejectedValue(new Error("down"));
    renderBoard();
    expect(await screen.findByText(/even niet bereikbaar/)).toBeInTheDocument();
  });

  it("lists trains on their way to the station", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([]);
    const t = {
      id: "x",
      line: "52",
      headsign: "Noord",
      next_station: CS.name,
      prev_station: "Amsterdam, Rokin",
      next_arrival_ts: s(3),
      status: "moving",
      delay_s: 120,
      realtime: true,
    } as AnimatedTrain;
    renderBoard({ trains: [t] });
    const row = (await screen.findByText(/nu na/)).closest("li")!;
    expect(row.textContent).toContain("nu na Rokin");
    expect(within(row).getByText("3 min")).toBeInTheDocument();
    expect(within(row).getByText("+2 min")).toBeInTheDocument();
  });

  it("wires the action buttons", async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue([]);
    const { props } = renderBoard();
    await userEvent.click(screen.getByRole("button", { name: /Favoriet/ }));
    await userEvent.click(screen.getByRole("button", { name: /Op kaart/ }));
    await userEvent.click(screen.getByRole("button", { name: /Plan vanaf hier/ }));
    expect(props.onToggleFavourite).toHaveBeenCalled();
    expect(props.onShowOnMap).toHaveBeenCalled();
    expect(props.onPlanFrom).toHaveBeenCalled();
  });
});

describe("groupByDirection", () => {
  it("keeps a stable order: line, then direction", () => {
    const groups = groupByDirection([
      dep({ line: "54", headsign: "Gein", departure_ts: s(1) }),
      dep({ line: "52", headsign: "Zuid", departure_ts: s(9) }),
      dep({ line: "52", headsign: "Noord", departure_ts: s(5) }),
    ]);
    expect(groups.map((g) => g.headsign)).toEqual(["Noord", "Zuid", "Gein"]);
  });
});

describe("JourneyPlanner", () => {
  const journey = (depMin: number, durMin: number, transfers: number): Journey => ({
    departure_ts: s(depMin),
    arrival_ts: s(depMin + durMin),
    duration_s: durMin * 60,
    transfers,
    legs: [
      { trip_id: `a${depMin}`, line: "52", headsign: "Zuid", from: "Amsterdam, Noord", to: CS.name, departure_ts: s(depMin), arrival_ts: s(depMin + 4), stops: 2, delay_s: 0, realtime: true },
      ...(transfers
        ? [{ trip_id: `b${depMin}`, line: "54", headsign: "Gein", from: CS.name, to: "Amsterdam, Gein", departure_ts: s(depMin + 7), arrival_ts: s(depMin + durMin), stops: 14, delay_s: 120, realtime: true }]
        : []),
    ],
  });

  function renderPlanner(js: Journey[], onRoute = vi.fn(), extra: Partial<JourneyPlannerProps> = {}) {
    vi.mocked(api.fetchJourneys).mockResolvedValue(js);
    const props = {
      onRoute,
      stations: STATIONS,
      lineIds: LINES,
      colorOf,
      from: byName("Amsterdam, Noord"),
      to: byName("Amsterdam, Gein"),
      current: CS,
      onFrom: vi.fn(),
      onTo: vi.fn(),
      onStation: vi.fn(),
      onNearby: vi.fn(),
      nowMs: NOW,
      ...extra,
    };
    render(<JourneyPlanner {...props} />);
    return props;
  }

  // A journey between stations checked step-free on GVB's site.
  const via = (a: string, b: string, c: string): Journey => ({
    ...journey(3, 30, 1),
    legs: [
      { ...journey(3, 30, 1).legs[0], from: a, to: b },
      { ...journey(3, 30, 1).legs[1], from: b, to: c },
    ],
  });
  const stepFreeTrip = via("Amsterdam, De Pijp", "Amsterdam, Waterlooplein", "Amsterdam, Nieuwmarkt");

  it("counts only the stations a rider uses as possible stairs", () => {
    expect(stairsOn(via("Amsterdam, Strandvliet", "Nowhere, Atlantis", "Amsterdam, De Pijp"))).toEqual([
      { name: "Amsterdam, Strandvliet", state: "no" },
      { name: "Nowhere, Atlantis", state: "unknown" },
    ]);
    expect(stairsOn(stepFreeTrip)).toEqual([]);
  });

  it("with avoid stairs on, marks a step-free journey; the box reports the switch", async () => {
    const onAvoidStairs = vi.fn();
    renderPlanner([stepFreeTrip], vi.fn(), { avoidStairs: true, onAvoidStairs });
    expect(await screen.findByText("zonder trappen")).toBeInTheDocument();
    expect(screen.queryByText(/Niet zeker zonder trappen/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Zonder trappen/ }));
    expect(onAvoidStairs).toHaveBeenCalledWith(false);
  });

  it("with avoid stairs on, names the stations that may need stairs and links the lift faults", async () => {
    const j = journey(3, 30, 0);
    j.legs[0] = { ...j.legs[0], to: "Amsterdam, Strandvliet" };
    renderPlanner([j], vi.fn(), { avoidStairs: true, onAvoidStairs: vi.fn() });
    const warning = (await screen.findByText(/Niet zeker zonder trappen/)).closest("p")!;
    expect(warning).toHaveTextContent("Strandvliet (niet toegankelijk)");
    expect(within(warning).getByRole("link", { name: "Liftstoringen bij GVB" })).toBeInTheDocument();
    expect(screen.queryByText("zonder trappen")).not.toBeInTheDocument();
  });

  it("with only a departure station, confirms it and offers its departures", async () => {
    const onShowDepartures = vi.fn();
    const gein = byName("Amsterdam, Gein");
    render(
      <JourneyPlanner
        stations={STATIONS}
        lineIds={LINES}
        colorOf={colorOf}
        from={gein}
        to={null}
        current={gein}
        onFrom={vi.fn()}
        onTo={vi.fn()}
        onStation={vi.fn()}
        onNearby={vi.fn()}
        onShowDepartures={onShowDepartures}
        nowMs={NOW}
      />,
    );
    expect(screen.getByText(/Kies nu waar je heen wilt/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Vertrektijden vanaf Gein/ }));
    expect(onShowDepartures).toHaveBeenCalledWith(gein);
  });

  it("shows options with transfers and labels the next and fastest", async () => {
    renderPlanner([journey(3, 30, 1), journey(8, 25, 1)]);
    const items = await screen.findAllByRole("listitem");
    const first = items.find((li) => li.textContent?.startsWith("12:03"))!;
    expect(within(first).getByText("eerstvolgende")).toBeInTheDocument();
    expect(within(first).queryByText("snelste")).not.toBeInTheDocument();
    expect(screen.getByText("snelste")).toBeInTheDocument();
    const transfers = screen.getAllByText(/Overstappen op/);
    expect(transfers).toHaveLength(2);
    for (const t of transfers) expect(t.textContent).toContain("Overstappen op CS");
    expect(screen.getAllByText("1 overstap")).toHaveLength(2);
  });

  it("reports the next journey's legs once per route, not per trip", async () => {
    const onRoute = vi.fn();
    renderPlanner([journey(3, 30, 1), journey(8, 25, 1)], onRoute);
    await screen.findAllByText(/Overstappen op/);
    const reported = onRoute.mock.calls.map(([legs]) => legs).filter(Boolean);
    expect(reported).toHaveLength(1);
    expect(reported[0].map((l: { line: string }) => l.line)).toEqual(["52", "54"]);
    // The next departure on the same lines keeps the same key.
    expect(routeKeyOf(journey(3, 30, 1).legs)).toBe(routeKeyOf(journey(8, 25, 1).legs));
    expect(routeKeyOf(journey(3, 30, 0).legs)).not.toBe(routeKeyOf(journey(3, 30, 1).legs));
  });

  it("follows the option the visitor picks", async () => {
    const onRoute = vi.fn();
    renderPlanner([journey(3, 30, 1), journey(8, 25, 0)], onRoute);
    await screen.findAllByText(/Overstappen op/);
    expect(onRoute).toHaveBeenLastCalledWith([expect.objectContaining({ trip_id: "a3" }), expect.objectContaining({ trip_id: "b3" })]);
    const second = screen.getByRole("button", { name: "12:08 → 12:33" });
    await userEvent.click(second);
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(onRoute).toHaveBeenLastCalledWith([expect.objectContaining({ trip_id: "a8" })]);
    // Picking it again re-applies it, for a line opened in between.
    const calls = onRoute.mock.calls.length;
    await userEvent.click(second);
    expect(onRoute.mock.calls.length).toBe(calls + 1);
  });

  it("swaps origin and destination", async () => {
    const props = renderPlanner([]);
    await userEvent.click(screen.getByRole("button", { name: "Van en naar omwisselen" }));
    expect(props.onFrom).toHaveBeenCalledWith(props.to);
    expect(props.onTo).toHaveBeenCalledWith(props.from);
  });

  it("explains an empty result", async () => {
    renderPlanner([]);
    expect(await screen.findByText(/Geen metroverbinding/)).toBeInTheDocument();
  });

  it("offers the board's station as origin", async () => {
    const props = renderPlanner([]);
    await userEvent.click(screen.getByRole("button", { name: "Vertrek vanaf CS" }));
    expect(props.onFrom).toHaveBeenCalledWith(CS);
  });
});

describe("fastestIndex", () => {
  it("prefers the shortest, then the earliest", () => {
    const j = (d: number) => ({ duration_s: d }) as Journey;
    expect(fastestIndex([j(30), j(25), j(25)])).toBe(1);
    expect(fastestIndex([])).toBe(-1);
  });
});

// act() is used implicitly by Testing Library; keep the import referenced for
// environments that need the global flag.
void act;

describe("StationClock", () => {
  it("points the hands at Amsterdam time, the hour hand creeping with the minutes", () => {
    // 12:30:15 in Amsterdam.
    const t = NOW + 30 * 60_000 + 15_000;
    expect(handAngles(t)).toEqual({ hour: 15, minute: 181.5, second: 90 });
    expect(handAngles(Date.UTC(2026, 9, 22, 13, 45))).toEqual({ hour: 112.5, minute: 270, second: 0 });
  });

  it("is announced as an image with the time", () => {
    render(<StationClock nowMs={NOW} />);
    expect(screen.getByRole("img", { name: "Klok, 12:00 Amsterdamse tijd" })).toBeInTheDocument();
  });
});

describe("routeStretches", () => {
  const order = ["A", "B", "C", "D", "E"];
  const leg = (line: string, from: string, to: string) => ({
    trip_id: "t", line, headsign: "x", from, to, departure_ts: 0, arrival_ts: 0, stops: 1, delay_s: 0, realtime: false,
  });

  it("takes only the legs on the shown line, in either direction", () => {
    expect(routeStretches(order, [leg("52", "B", "D"), leg("54", "D", "E")], "52")).toEqual([[1, 3]]);
    expect(routeStretches(order, [leg("52", "D", "A")], "52")).toEqual([[3, 0]]);
    expect(routeStretches(order, [leg("52", "B", "D")], "54")).toEqual([]);
  });

  it("skips a leg whose stations are not on the drawn line", () => {
    expect(routeStretches(order, [leg("52", "B", "Z")], "52")).toEqual([]);
  });
});
