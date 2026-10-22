import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PREFS,
  RECENT_MAX,
  clearRecent,
  loadFavourites,
  loadPrefs,
  loadRecent,
  pushRecent,
  savePrefs,
  toggleFavourite,
} from "./storage";

describe("favourites", () => {
  it("toggles a station on and off and persists it", () => {
    expect(toggleFavourite("Noord")).toEqual(["Noord"]);
    expect(loadFavourites()).toEqual(["Noord"]);
    expect(toggleFavourite("Noord")).toEqual([]);
  });

  it("survives garbage in storage", () => {
    localStorage.setItem("metro-live:favourites", '{"not":"a list"}');
    expect(loadFavourites()).toEqual([]);
    localStorage.setItem("metro-live:favourites", "not json");
    expect(loadFavourites()).toEqual([]);
  });
});

describe("recent", () => {
  it("keeps the newest first, without duplicates, capped", () => {
    for (let i = 0; i < RECENT_MAX + 2; i++) pushRecent(`S${i}`);
    pushRecent("S3");
    const list = loadRecent();
    expect(list[0]).toBe("S3");
    expect(list).toHaveLength(RECENT_MAX);
    expect(new Set(list).size).toBe(list.length);
    expect(clearRecent()).toEqual([]);
  });
});

describe("prefs", () => {
  it("round-trips valid preferences and rejects invalid ones", () => {
    savePrefs({ windowMin: 60, showCancelled: false, walkMin: 5, shortcuts: false });
    expect(loadPrefs()).toEqual({ windowMin: 60, showCancelled: false, walkMin: 5, shortcuts: false });
    localStorage.setItem("metro-live:travel-prefs", JSON.stringify({ windowMin: 7, walkMin: 99 }));
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });
});

describe("unavailable storage", () => {
  it("degrades to defaults instead of throwing", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadFavourites()).toEqual([]);
    expect(() => toggleFavourite("X")).not.toThrow();
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    spy.mockRestore();
    set.mockRestore();
  });
});
