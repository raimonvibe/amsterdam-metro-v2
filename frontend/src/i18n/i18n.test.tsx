import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnglishHint } from "../components/EnglishHint";
import { LanguageToggle } from "../components/LanguageToggle";
import { StationIndex } from "../travel/StationIndex";
import { countdown, duration } from "../travel/time";
import { getLang, pick, setLang } from "./index";

const index = (
  <StationIndex
    stations={[]}
    lineIds={["52"]}
    colorOf={() => "#999"}
    current={null}
    favourites={[]}
    recent={[]}
    locating={false}
    onStation={() => {}}
    onNearby={() => {}}
    onClearRecent={() => {}}
  />
);

describe("language", () => {
  it("toggles, remembers the choice and marks the document", async () => {
    render(<LanguageToggle />);
    await userEvent.click(screen.getByRole("link", { name: "Switch to English" }));
    expect(getLang()).toBe("en");
    expect(localStorage.getItem("metro-lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("link", { name: "Wissel naar Nederlands" })).toHaveTextContent("NL");
  });

  it("is a link to this page in the other language, and moves the address bar there", async () => {
    window.history.replaceState(null, "", "/reisinfo?station=Noord#x");
    render(<LanguageToggle />);
    const toggle = screen.getByRole("link", { name: "Switch to English" });
    expect(toggle).toHaveAttribute("href", "/en/reisinfo");
    expect(toggle).toHaveAttribute("hreflang", "en");
    await userEvent.click(toggle);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/en/reisinfo?station=Noord#x");
    expect(screen.getByRole("link", { name: "Wissel naar Nederlands" })).toHaveAttribute("href", "/reisinfo");
    setLang("nl", { persist: false });
    expect(window.location.pathname).toBe("/reisinfo");
  });

  it("re-renders the travel page's strings", async () => {
    render(<><LanguageToggle />{index}</>);
    expect(screen.getByText("Dichtstbijzijnde station")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Switch to English" }));
    expect(screen.getByText("Nearest station")).toBeInTheDocument();
    expect(screen.getByText("All stations A–Z")).toBeInTheDocument();
  });

  it("switches formatters too", () => {
    const now = 1_800_000_000_000;
    expect(duration(65 * 60)).toBe("1 u 5 min");
    expect(countdown(now / 1000 - 120, now)).toBe("vertrokken");
    setLang("en", { persist: false });
    expect(duration(65 * 60)).toBe("1 h 5 min");
    expect(countdown(now / 1000 - 120, now)).toBe("departed");
  });

  it("picks the feed's English, falling back to Dutch", () => {
    expect(pick({ nl: "Hallo", en: "Hello" }, "en")).toBe("Hello");
    expect(pick({ nl: "Hallo", en: null }, "en")).toBe("Hallo");
    expect(pick({ nl: "Hallo", en: "Hello" }, "nl")).toBe("Hallo");
  });
});

/** The i18n module as a fresh page load would run it: at `path`, with this
 *  browser language and (optionally) a saved choice. */
async function load(path: string, languages: string[], saved?: "nl" | "en") {
  window.history.replaceState(null, "", path);
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
  if (saved) localStorage.setItem("metro-lang", saved);
  vi.resetModules();
  return import("./index");
}

describe("language on page load", () => {
  afterEach(() => vi.restoreAllMocks());

  // The bug behind docs/english-urls.md: Googlebot browses as en-US, got the
  // English UI at / and indexed the Dutch site as English.
  it("serves Dutch at / to an English-only browser such as Googlebot", async () => {
    const i18n = await load("/", ["en-US"]);
    expect(i18n.getLang()).toBe("nl");
    expect(document.documentElement.lang).toBe("nl");
    expect(window.location.pathname).toBe("/");
  });

  it("serves English under /en, whatever the browser says", async () => {
    expect((await load("/en/reisinfo", ["nl-NL"])).getLang()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect((await load("/en/", ["en-US"])).getLang()).toBe("en");
  });

  it("moves a saved English choice to the English URL, keeping page and query", async () => {
    const i18n = await load("/reisinfo?van=Noord&naar=Zuid", ["nl-NL"], "en");
    expect(i18n.getLang()).toBe("en");
    expect(window.location.pathname + window.location.search).toBe("/en/reisinfo?van=Noord&naar=Zuid");
  });

  it("moves a saved Dutch choice off /en", async () => {
    const i18n = await load("/en/", ["en-US"], "nl");
    expect(i18n.getLang()).toBe("nl");
    expect(window.location.pathname).toBe("/");
  });
});

describe("English hint", () => {
  afterEach(() => vi.restoreAllMocks());
  const english = () => vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US", "en"]);

  it("offers English to a browser that doesn't list Dutch", async () => {
    english();
    window.history.replaceState(null, "", "/reisinfo?station=Noord");
    render(<EnglishHint sidebarOpen={false} />);
    const link = screen.getByRole("link", { name: "View this site in English" });
    expect(link).toHaveAttribute("href", "/en/reisinfo");
    await userEvent.click(link);
    expect(getLang()).toBe("en");
    expect(window.location.pathname).toBe("/en/reisinfo");
    expect(screen.queryByRole("link", { name: "View this site in English" })).not.toBeInTheDocument();
  });

  it("is not shown to a browser that reads Dutch", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US", "nl"]);
    render(<EnglishHint sidebarOpen={false} />);
    expect(screen.queryByRole("link", { name: "View this site in English" })).not.toBeInTheDocument();
  });

  it("stays away once closed", async () => {
    english();
    const { unmount } = render(<EnglishHint sidebarOpen={false} />);
    await userEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(screen.queryByRole("link", { name: "View this site in English" })).not.toBeInTheDocument();
    expect(getLang()).toBe("nl");
    unmount();
    render(<EnglishHint sidebarOpen={false} />);
    expect(screen.queryByRole("link", { name: "View this site in English" })).not.toBeInTheDocument();
  });

  it("is not shown once a language was picked, or on English pages", () => {
    english();
    localStorage.setItem("metro-lang", "nl");
    const { unmount } = render(<EnglishHint sidebarOpen={false} />);
    expect(screen.queryByRole("link", { name: "View this site in English" })).not.toBeInTheDocument();
    unmount();
    localStorage.clear();
    setLang("en", { persist: false });
    render(<EnglishHint sidebarOpen={false} />);
    expect(screen.queryByRole("link", { name: "View this site in English" })).not.toBeInTheDocument();
  });
});
