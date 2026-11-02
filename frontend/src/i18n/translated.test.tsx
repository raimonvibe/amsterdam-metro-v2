import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlertList } from "../components/AlertList";
import { Num } from "../components/Num";
import { ServiceAlert } from "../types";
import { getLang, setLang } from "./index";
import { guardTranslatorDom, pageTranslated, switchLang } from "./translated";

/**
 * Browser translation rewrites text under React. These tests act out what
 * Chrome, Firefox and Edge do to the DOM (docs/browser-translation.md).
 */

/** What Chrome does to a text node: a <font> with the translation in its place. */
function translateNode(node: Text, to: string) {
  const font = document.createElement("font");
  font.style.verticalAlign = "inherit";
  font.textContent = to;
  node.parentNode!.replaceChild(font, node);
}

const html = document.documentElement;

beforeEach(() => setLang("nl", { persist: false }));
afterEach(() => {
  html.classList.remove("translated-ltr", "translated-rtl");
  document.body.innerHTML = "";
});

describe("pageTranslated", () => {
  it("is false on the page as we render it", () => {
    expect(pageTranslated()).toBe(false);
  });

  it("sees Chrome's class on <html>", () => {
    html.classList.add("translated-ltr");
    expect(pageTranslated()).toBe(true);
  });

  it("sees Firefox writing the target language into <html lang>", () => {
    html.lang = "uk";
    expect(pageTranslated()).toBe(true);
    html.lang = getLang();
  });

  it("sees Edge's <font> wrappers", () => {
    document.body.appendChild(document.createElement("font"));
    expect(pageTranslated()).toBe(true);
  });
});

describe("switchLang", () => {
  it("switches in place on an untranslated page", () => {
    const reload = vi.fn();
    switchLang("en", reload);
    expect(getLang()).toBe("en");
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads a translated page on the new language's URL", () => {
    html.classList.add("translated-rtl");
    const reload = vi.fn();
    switchLang("en", reload);
    expect(getLang()).toBe("en");
    expect(window.location.pathname.startsWith("/en")).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe("guardTranslatorDom", () => {
  it("lets React remove text a translator has replaced, instead of crashing", () => {
    guardTranslatorDom();
    function Toggle() {
      const [on, setOn] = useState(true);
      return (
        <div>
          <button onClick={() => setOn(false)}>hide</button>
          {on && "vervallen"}
        </div>
      );
    }
    render(<Toggle />);
    const word = [...screen.getByRole("button").parentElement!.childNodes].find((n) => n.nodeType === Node.TEXT_NODE) as Text;
    translateNode(word, "скасовано");
    expect(() => act(() => screen.getByRole("button").click())).not.toThrow();
  });
});

describe("Num", () => {
  // React writes an element's only text through textContent, which clears
  // the translator's <font>; text beside other nodes has no such luck, so
  // live words get an element of their own.
  it("shows the new word after a translator replaced the old one", () => {
    const { container, rerender } = render(<Num>op tijd</Num>);
    translateNode(container.querySelector("span")!.firstChild as Text, "вчасно");
    rerender(<Num>vertrokken</Num>);
    expect(container.textContent).toBe("vertrokken");
  });
});

describe("AlertList under translation", () => {
  const alert: ServiceAlert = {
    id: "a",
    header: { nl: "Rituitval M52 door technisch defect." },
    lines: ["52"],
    stations: ["Amsterdam, Centraal Station", "De Pijp"],
    effect: "REDUCED_SERVICE",
  };
  const colorOf = () => "#4363D8";

  it("leaves GVB's message to the translator, marked as Dutch", () => {
    render(<AlertList alerts={[alert]} colorOf={colorOf} />);
    const text = screen.getByText("Rituitval M52 door technisch defect.");
    expect(text.closest('[translate="no"]')).toBeNull();
    expect(text).toHaveAttribute("lang", "nl");
  });

  it("marks the Dutch fallback as Dutch on the English page", () => {
    setLang("en", { persist: false });
    render(<AlertList alerts={[alert]} colorOf={colorOf} />);
    expect(screen.getByText("Rituitval M52 door technisch defect.")).toHaveAttribute("lang", "nl");
  });

  it("keeps station names and their commas in one untranslated run", () => {
    render(<AlertList alerts={[alert]} colorOf={colorOf} />);
    const names = screen.getByText(/De Pijp/);
    expect(names.closest('[translate="no"]')).not.toBeNull();
    expect(names.textContent).toMatch(/, De Pijp$/);
  });
});

describe("a language switch on a translated page, across its reload", () => {
  /** The module as a reloaded page loads it: fresh, reading sessionStorage. */
  async function afterReload() {
    vi.resetModules();
    return import("./translated");
  }

  afterEach(() => {
    sessionStorage.clear();
    html.removeAttribute("translate");
    html.classList.remove("notranslate");
    document.querySelectorAll('meta[name="google"]').forEach((m) => m.remove());
  });

  it("keeps the open panel and the map view, and asks not to be translated again", async () => {
    const before = await afterReload();
    before.carryOver("sidebarOpen", () => true);
    before.carryOver("mapView", () => ({ longitude: 4.9, latitude: 52.37, zoom: 13, pitch: 60, bearing: 0 }));
    html.classList.add("translated-ltr");
    const reload = vi.fn();
    before.switchLang("nl", reload);
    expect(reload).toHaveBeenCalledOnce();

    html.classList.remove("translated-ltr"); // the reloaded page starts clean
    const after = await afterReload();
    expect(after.carried("sidebarOpen")).toBe(true);
    expect(after.carried("mapView")).toMatchObject({ zoom: 13, pitch: 60 });
    after.keepSiteLanguage();
    expect(html).toHaveAttribute("translate", "no");
    expect(html).toHaveClass("notranslate");
    expect(document.querySelector('meta[name="google"][content="notranslate"]')).not.toBeNull();
  });

  it("is only for that one page view", async () => {
    const before = await afterReload();
    html.classList.add("translated-ltr");
    before.switchLang("en", vi.fn());
    html.classList.remove("translated-ltr");
    await afterReload(); // the reload reads and clears it
    const later = await afterReload(); // the next load: translatable again
    expect(later.carried("siteLanguage")).toBeUndefined();
    later.keepSiteLanguage();
    expect(html).not.toHaveAttribute("translate");
  });

  it("carries nothing when the page wasn't translated", async () => {
    const before = await afterReload();
    before.carryOver("sidebarOpen", () => true);
    before.switchLang("en", vi.fn());
    expect(sessionStorage.length).toBe(0);
  });
});
