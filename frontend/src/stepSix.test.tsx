import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALERTS_RETRY_MAX_MS, ALERTS_RETRY_MIN_MS, useAlerts } from "./hooks/useAlerts";
import { relabelControls } from "./mapControls";

describe("relabelControls", () => {
  it("rewrites MapLibre's button labels for the current language", () => {
    const box = document.createElement("div");
    box.innerHTML = `
      <button class="maplibregl-ctrl-zoom-in" aria-label="Inzoomen" title="Inzoomen"></button>
      <button class="maplibregl-ctrl-zoom-out" aria-label="Uitzoomen" title="Uitzoomen"></button>
      <button class="maplibregl-ctrl-compass" aria-label="Kaart recht zetten" title="Kaart recht zetten"></button>`;
    relabelControls(box, {
      "NavigationControl.ZoomIn": "Zoom in",
      "NavigationControl.ZoomOut": "Zoom out",
      "NavigationControl.ResetBearing": "Reset map to north",
    });
    const zoomIn = box.querySelector(".maplibregl-ctrl-zoom-in")!;
    expect(zoomIn.getAttribute("aria-label")).toBe("Zoom in");
    expect(zoomIn.getAttribute("title")).toBe("Zoom in");
    expect(box.querySelector(".maplibregl-ctrl-compass")!.getAttribute("aria-label")).toBe("Reset map to north");
  });

  it("leaves buttons alone when a label is missing", () => {
    const box = document.createElement("div");
    box.innerHTML = `<button class="maplibregl-ctrl-zoom-in" aria-label="Inzoomen"></button>`;
    relabelControls(box, {});
    expect(box.querySelector("button")!.getAttribute("aria-label")).toBe("Inzoomen");
  });
});

describe("useAlerts", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const ok = () => new Response(JSON.stringify([{ id: "a", header: { nl: "x" }, lines: [], stations: [], effect: "" }]));

  it("retries a failed first load in seconds, not after the 2-minute poll", async () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("backend restarting"))
      .mockResolvedValueOnce(ok());
    const { result } = renderHook(() => useAlerts());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ALERTS_RETRY_MIN_MS);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current).toHaveLength(1);
  });

  it("backs off between failures, up to a cap", async () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    renderHook(() => useAlerts());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // 5 + 10 + 20 + 40 s: four more tries, each waiting longer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000 + 10_000 + 20_000 + 40_000);
    });
    expect(fetch).toHaveBeenCalledTimes(5);
    // Capped at a minute: no try in the next 44 s (until the regular 2-minute
    // poll at 120 s, which runs on its own schedule).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(44_000);
    });
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(ALERTS_RETRY_MAX_MS).toBe(60_000);
  });
});
