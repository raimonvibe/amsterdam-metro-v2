import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFoundHtml } from "../seo/notFound";

/**
 * The 404 page's own script (page.ts), run on the real page: it runs on
 * import, so each test loads the page, sets the saved map style and the
 * address, then imports it fresh. jsdom has no WebGL, so no 3D: the page's
 * own fallback.
 */
async function openPage(savedStyle: string | null, path = "/nope") {
  const html = notFoundHtml({ script: "/x.js", hasPoster: true });
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, "").replace(/<\/html>\s*$/i, "");
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  if (savedStyle) localStorage.setItem("metro-live:map-style", savedStyle);
  window.history.replaceState(null, "", path);
  vi.resetModules();
  await import("./page");
  const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;
  return {
    button,
    theme: () => document.documentElement.dataset.theme ?? "light",
    saved: () => localStorage.getItem("metro-live:map-style"),
  };
}

describe("404 page: light/dark switch", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.resetModules());

  it("opens in the theme of the saved map style", async () => {
    expect((await openPage("fiord")).theme()).toBe("dark");
    expect((await openPage("dark")).theme()).toBe("dark");
    expect((await openPage("bright")).theme()).toBe("light");
    expect((await openPage(null)).theme()).toBe("light");
  });

  it("is shown, and named after what a click does, in the page's language", async () => {
    const { button } = await openPage(null);
    expect(button.hidden).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("Donkere weergave");
    const en = await openPage("dark", "/en/nope");
    expect(en.button.getAttribute("aria-label")).toBe("Light view");
  });

  it("stores a map style, and going back lands on the style from before", async () => {
    const page = await openPage("fiord");
    page.button.click();
    expect(page.theme()).toBe("light");
    expect(page.saved()).toBe("liberty");
    page.button.click();
    expect(page.theme()).toBe("dark");
    expect(page.saved()).toBe("fiord");
  });

  it("goes to the app's defaults without a style from before", async () => {
    const page = await openPage(null);
    page.button.click();
    expect(page.saved()).toBe("dark");
    page.button.click();
    expect(page.saved()).toBe("liberty");
  });
});
