import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DepartureBoard } from "./components/DepartureBoard";
import { Sidebar } from "./components/Sidebar";
import { TrainPopup } from "./components/TrainPopup";
import { setLang } from "./i18n";
import { NETWORK, STATIONS } from "./test/fixtures";
import { PAGE_TEST_TIMEOUT } from "./test/timeouts";
import TravelInfoPage from "./travel/TravelInfoPage";
import { AnimatedTrain, Line, Status } from "./types";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  fetchBoard: vi.fn(),
  fetchStationInfo: vi.fn(),
  fetchJourneys: vi.fn().mockResolvedValue([]),
  fetchNetwork: vi.fn(),
  fetchDepartures: vi.fn(),
}));
import * as api from "./api";

/**
 * Browser translation (Chrome, Edge, Safari, Firefox) runs every text node
 * through a translator. Words should be translated; numbers, line numbers and
 * times must not: a lone "51" came back from Google Translate's Aymara as a
 * whole sentence and blew the badges and tiles apart. The rule: text with a
 * digit and no letters must sit inside translate="no" (Num, Place, LineBadge
 * do that). Sentences with a number in them ("1 more departure") may be
 * translated; they are words. See docs/browser-translation.md.
 */
export function untranslatedNumbers(root: Element): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const leaks: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? "";
    if (!/\d/.test(text) || /\p{L}/u.test(text)) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style, [translate="no"]')) continue;
    leaks.push(text);
  }
  return leaks;
}

/**
 * Text a browser would translate, inside an element that cuts its text off
 * ("truncate"): translated, it runs longer and loses its end ("Інформація
 * про подор…"). Translatable words should wrap; only names and numbers,
 * which aren't translated, may be cut, or text marked `data-may-cut` (an
 * optional detail, a placeholder). See docs/browser-translation.md.
 */
export function cutTranslatableText(root: Element): string[] {
  const cut: string[] = [];
  root.querySelectorAll(".truncate").forEach((el) => {
    if (el.closest("[data-may-cut]")) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (/\p{L}/u.test(node.textContent ?? "") && !node.parentElement?.closest('[translate="no"]')) {
        cut.push(el.textContent?.trim() ?? "");
        return;
      }
    }
  });
  return cut;
}

const NOW = Math.floor(Date.now() / 1000);
const LINES: Line[] = NETWORK.map((l) => ({ id: l.id, name: l.name, color: l.color, shape: [] }));
const STATUS: Status = { static_loaded: true, rt_trip_count: 120, active_trains: 35, is_live: true };
const CS = STATIONS.find((s) => s.name === "Amsterdam, Centraal Station")!;

const TRAIN: AnimatedTrain = {
  id: "t1", line: "51", latitude: 52.34, longitude: 4.92, bearing: 0, distance_m: 0, speed_m_s: 15, shape_id: "s",
  headsign: "Amsterdam, Centraal Station", delay_s: 180, status: "moving", prev_station: "Amsterdam, Overamstel",
  next_station: "Amsterdam, Spaklerweg", platform: "4", next_arrival_ts: NOW + 60, prev_departure_ts: NOW - 60,
  stops_remaining: 7, final_arrival_ts: NOW + 660, realtime: true, fetchedAt: Date.now() - 84_000,
};

beforeEach(() => {
  vi.mocked(api.fetchNetwork).mockResolvedValue(NETWORK);
  vi.mocked(api.fetchDepartures).mockResolvedValue([
    { trip_id: "t1", line: "51", headsign: "Amsterdam, Centraal Station", departure_ts: NOW + 60, delay_s: 0, realtime: true },
    { trip_id: "t2", line: "54", headsign: "Amsterdam, Gein", departure_ts: NOW + 660, delay_s: 120, realtime: true },
  ]);
  vi.mocked(api.fetchBoard).mockResolvedValue([
    {
      trip_id: "t1", line: "52", headsign: "Zuid", departure_ts: NOW + 300, delay_s: 120, realtime: true,
      scheduled_ts: NOW + 180, stop_id: "x", stops_remaining: 5, terminus_ts: NOW + 900, cancelled: false,
    },
  ]);
  vi.mocked(api.fetchStationInfo).mockResolvedValue({
    station: CS.name,
    lines: CS.lines,
    service_day: "20261102",
    directions: [
      { line: "52", headsign: "Noord", first_ts: NOW - 20000, last_ts: NOW + 40000, headway_min: 6, departures_next_hour: 10, next_stops: ["Amsterdam, Noorderpark"] },
    ],
  });
});

describe.each(["nl", "en"] as const)("browser translation (%s)", { timeout: PAGE_TEST_TIMEOUT }, (lang) => {
  beforeEach(() => setLang(lang, { persist: false }));

  it("leaves every number on the travel page untranslated, and cuts off no words", async () => {
    window.history.replaceState({}, "", "/reisinfo?station=CS");
    const { container } = render(
      <TravelInfoPage stations={STATIONS} lines={LINES} trains={[]} status={STATUS} theme="light" onToggleTheme={() => {}} onClose={() => {}} onShowOnMap={() => {}} />,
    );
    await waitFor(() => expect(api.fetchBoard).toHaveBeenCalled());
    await screen.findAllByText("Zuid");
    expect(untranslatedNumbers(container)).toEqual([]);
    expect(cutTranslatableText(container)).toEqual([]);
  });

  it("leaves every number in the map sidebar untranslated, and cuts off no words", () => {
    const { container } = render(
      <Sidebar
        lines={LINES}
        visibleLines={LINES.map((l) => l.id)}
        onToggleLine={() => {}}
        trains={[]}
        status={STATUS}
        hoveredStation={null}
        lastUpdated={new Date()}
        mapStyle="liberty"
        onMapStyleChange={() => {}}
        onOpenPrivacy={() => {}}
        onOpenTravel={() => {}}
        onClose={() => {}}
        stations={STATIONS}
      />,
    );
    expect(untranslatedNumbers(container)).toEqual([]);
    expect(cutTranslatableText(container)).toEqual([]);
  });

  it("leaves every number on a station's card untranslated, and cuts off no words", async () => {
    const { container } = render(
      <DepartureBoard station={CS} lines={LINES} onClose={() => {}} followable={new Set(["t1"])} onFollow={() => {}} />,
    );
    await screen.findAllByText("Gein");
    expect(untranslatedNumbers(container)).toEqual([]);
    expect(cutTranslatableText(container)).toEqual([]);
  });

  it("leaves every number in a train's popup untranslated, and cuts off no words", () => {
    const { container } = render(
      <TrainPopup train={TRAIN} color="#FA8C1B" lineName="CS - Isolatorweg" x={300} y={300} containerWidth={800} nowMs={Date.now()} />,
    );
    expect(untranslatedNumbers(container)).toEqual([]);
    expect(cutTranslatableText(container)).toEqual([]);
  });
});
