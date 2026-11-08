import { describe, expect, it } from "vitest";
import { FRAMES_TO_JUDGE, getQualityPref, setQualityPref, startQuality, tooSlow } from "./quality";

describe("start quality", () => {
  it("gives every visitor the full 3D map", () => {
    expect(startQuality("auto")).toBe("full");
  });

  it("follows the visitor's own choice", () => {
    expect(startQuality("full")).toBe("full");
    expect(startQuality("lite")).toBe("lite");
  });
});

describe("frame-rate watch", () => {
  const frames = (ms: number, n = FRAMES_TO_JUDGE) => Array.from({ length: n }, () => ms);

  it("waits for enough frames before judging", () => {
    // 39 slow frames, but under 3 s in all: not enough to call it yet.
    expect(tooSlow(frames(60, FRAMES_TO_JUDGE - 1))).toBe(false);
    expect(tooSlow(frames(60, FRAMES_TO_JUDGE))).toBe(true);
  });

  it("calls a device slow when most frames take over 50 ms", () => {
    expect(tooSlow(frames(80))).toBe(true);
    expect(tooSlow(frames(16))).toBe(false);
  });

  it("judges a very slow device on time instead of frame count", () => {
    // 2 frames a second: 6 frames in 3 s is enough to call it.
    expect(tooSlow(frames(500, 6))).toBe(true);
    expect(tooSlow(frames(500, 5))).toBe(false);
  });

  it("isn't fooled by a few long frames while tiles load", () => {
    expect(tooSlow([...frames(16, 30), ...frames(400, 10)])).toBe(false);
  });
});

describe("the visitor's choice", () => {
  it("is kept only when it isn't auto", () => {
    setQualityPref("lite");
    expect(localStorage.getItem("metro-live:3d")).toBe("lite");
    expect(getQualityPref()).toBe("lite");
    setQualityPref("auto");
    expect(localStorage.getItem("metro-live:3d")).toBeNull();
    expect(getQualityPref()).toBe("auto");
  });
});
