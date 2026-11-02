import { afterEach, describe, expect, it, vi } from "vitest";
import { FRAMES_TO_JUDGE, getQualityPref, setQualityPref, softwareRenderer, startQuality, tooSlow } from "./quality";

const probe = (software: boolean, saveData = false) => ({ software: () => software, saveData: () => saveData });

describe("start quality", () => {
  it("gives every capable device the full 3D map", () => {
    expect(startQuality("auto", probe(false))).toBe("full");
  });

  it("starts light when the browser draws in software or asks to save data", () => {
    expect(startQuality("auto", probe(true))).toBe("lite");
    expect(startQuality("auto", probe(false, true))).toBe("lite");
  });

  it("follows the visitor's own choice over the device check", () => {
    expect(startQuality("full", probe(true))).toBe("full");
    expect(startQuality("lite", probe(false))).toBe("lite");
  });
});

describe("software renderer", () => {
  afterEach(() => vi.restoreAllMocks());

  const renderer = (name: string) => {
    const gl = {
      RENDERER: 7937,
      getExtension: (n: string) => (n === "WEBGL_debug_renderer_info" ? { UNMASKED_RENDERER_WEBGL: 37446 } : null),
      getParameter: () => name,
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(gl as never);
  };

  it("recognises GPU-less renderers", () => {
    for (const name of ["ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))", "llvmpipe (LLVM 17.0.6, 256 bits)", "Microsoft Basic Render Driver"]) {
      renderer(name);
      expect(softwareRenderer(), name).toBe(true);
    }
  });

  it("leaves real GPUs, and browsers without WebGL, to the frame-rate watch", () => {
    renderer("ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)");
    expect(softwareRenderer()).toBe(false);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(softwareRenderer()).toBe(false);
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
