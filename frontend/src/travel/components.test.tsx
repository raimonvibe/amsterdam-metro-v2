import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATIONS } from "../test/fixtures";
import { AnimatedTrain } from "../types";
import { JourneyPlanner, fastestIndex } from "./JourneyPlanner";
import { SearchBox } from "./SearchBox";
import { StationBoard, groupByDirection } from "./StationBoard";
import { StationClock, handAngles } from "./StationClock";
import { DEFAULT_PREFS } from "./storage";
import { BoardDeparture, Journey } from "./types";

vi.mock("../api", () => ({
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

  it("in station mode offers stations only", async () => {
    const { input, onRoute } = setup("station");
    await userEvent.type(input, "noord naar gein{Enter}");
    expect(onRoute).not.toHaveBeenCalled();
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
    expect(within(card).getByText("12:06")).toHaveClass("line-through");
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
    const row = (await screen.findByText(/nu na Rokin/)).closest("li")!;
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

  function renderPlanner(js: Journey[]) {
    vi.mocked(api.fetchJourneys).mockResolvedValue(js);
    const props = {
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
    };
    render(<JourneyPlanner {...props} />);
    return props;
  }

  it("shows options with transfers and labels the next and fastest", async () => {
    renderPlanner([journey(3, 30, 1), journey(8, 25, 1)]);
    const items = await screen.findAllByRole("listitem");
    const first = items.find((li) => li.textContent?.startsWith("12:03"))!;
    expect(within(first).getByText("eerstvolgende")).toBeInTheDocument();
    expect(within(first).queryByText("snelste")).not.toBeInTheDocument();
    expect(screen.getByText("snelste")).toBeInTheDocument();
    expect(screen.getAllByText(/Overstappen op CS/)).toHaveLength(2);
    expect(screen.getAllByText("1 overstap")).toHaveLength(2);
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
