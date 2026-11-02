import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnglishHint } from "./components/EnglishHint";
import { Sidebar } from "./components/Sidebar";
import { getLang, setLang } from "./i18n";
import { page } from "./i18n/translated";
import { NETWORK, STATIONS } from "./test/fixtures";
import { PAGE_TEST_TIMEOUT } from "./test/timeouts";
import TravelInfoPage from "./travel/TravelInfoPage";
import { Line, Status } from "./types";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  fetchBoard: vi.fn().mockResolvedValue([]),
  fetchStationInfo: vi.fn().mockResolvedValue(null),
  fetchJourneys: vi.fn().mockResolvedValue([]),
  fetchNetwork: vi.fn().mockResolvedValue([]),
  fetchDepartures: vi.fn().mockResolvedValue([]),
}));

/**
 * Every language button on the site: the map's side panel, the travel page's
 * header and the English offer on the map. Each must switch in place on a
 * plain page, and on a page a browser translated (Ukrainian, or any of the
 * 70+ languages) reload into the site's own language, keeping the panel open
 * and asking not to be translated again. See docs/browser-translation.md.
 */

const LINES: Line[] = NETWORK.map((l) => ({ id: l.id, name: l.name, color: l.color, shape: [] }));
const STATUS: Status = { static_loaded: true, rt_trip_count: 120, active_trains: 35, is_live: true };
const html = document.documentElement;
const CARRY_KEY = "metro-live:lang-switch";

/** What Chrome does when it translates: a class on <html>, <font> over the text. */
function translatePage() {
  html.classList.add("translated-ltr");
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent?.trim() && !n.parentElement?.closest('[translate="no"]')) nodes.push(n as Text);
  }
  for (const node of nodes) {
    const font = document.createElement("font");
    font.textContent = `[uk] ${node.textContent}`;
    node.replaceWith(font);
  }
}

const carry = () => JSON.parse(sessionStorage.getItem(CARRY_KEY) ?? "null");

const SIDEBAR = (
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
  />
);

const TRAVEL = (
  <TravelInfoPage stations={STATIONS} lines={LINES} trains={[]} status={STATUS} theme="light" onToggleTheme={() => {}} onClose={() => {}} onShowOnMap={() => {}} />
);

let reload: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  reload = vi.spyOn(page, "reload").mockImplementation(() => {});
  sessionStorage.clear();
});
afterEach(() => {
  reload.mockRestore();
  html.classList.remove("translated-ltr");
  sessionStorage.clear();
  localStorage.clear();
});

describe.each([
  ["side panel", "/", () => SIDEBAR],
  ["travel page", "/reisinfo", () => TRAVEL],
] as const)("the language button in the %s", { timeout: PAGE_TEST_TIMEOUT }, (_where, path, ui) => {
  describe.each([
    ["nl", "en"],
    ["en", "nl"],
  ] as const)("from %s to %s", (from, to) => {
    beforeEach(() => {
      window.history.replaceState({}, "", path);
      setLang(from, { persist: false });
    });

    const button = () => screen.getByRole("link", { name: /English|Nederlands|Switch|Wissel/i });

    it("switches in place on a page nobody translated", async () => {
      render(ui());
      await waitFor(() => expect(button()).toHaveAttribute("hreflang", to));
      act(() => button().click());
      expect(getLang()).toBe(to);
      expect(reload).not.toHaveBeenCalled();
      expect(carry()).toBeNull();
    });

    it("on a translated page, reloads into the site's own language", async () => {
      render(ui());
      await waitFor(() => expect(button()).toHaveAttribute("hreflang", to));
      translatePage();
      act(() => button().click());
      expect(reload).toHaveBeenCalledOnce();
      expect(getLang()).toBe(to);
      expect(window.location.pathname.startsWith("/en")).toBe(to === "en");
      expect(carry()).toMatchObject({ siteLanguage: true });
    });
  });
});

describe("the English offer on the map", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    setLang("nl", { persist: false });
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["uk-UA", "uk"]);
  });

  it("on a translated page, reloads into English", () => {
    render(<EnglishHint sidebarOpen={false} />);
    translatePage();
    act(() => screen.getByRole("link", { name: "View this site in English" }).click());
    expect(reload).toHaveBeenCalledOnce();
    expect(getLang()).toBe("en");
    expect(carry()).toMatchObject({ siteLanguage: true });
  });
});
