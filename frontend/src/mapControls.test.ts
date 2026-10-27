import { describe, expect, it } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import { foldedAttribution } from "./mapControls";

const CREDITS = "OpenFreeMap © OpenMapTiles Data from OpenStreetMap";

/** Just enough of a MapLibre map for the attribution control. */
function fakeMap(width: number, credits: string | null) {
  const handlers: Record<string, ((e?: unknown) => void)[]> = {};
  const canvasContainer = document.createElement("div");
  Object.defineProperty(canvasContainer, "offsetWidth", { get: () => width });
  const tileManagers: Record<string, unknown> = {};
  const setCredits = (text: string) => {
    tileManagers.openmaptiles = { used: true, getSource: () => ({ attribution: text }) };
  };
  if (credits) setCredits(credits);
  const map = {
    style: { stylesheet: {}, tileManagers },
    on: (type: string, fn: (e?: unknown) => void) => {
      (handlers[type] ??= []).push(fn);
    },
    off: () => {},
    getCanvasContainer: () => canvasContainer,
    _getUIString: (key: string) => key,
  };
  return {
    map: map as unknown as MapLibreMap,
    setCredits,
    fire: (type: string, e?: unknown) => handlers[type]?.forEach((fn) => fn(e)),
    resize: (w: number) => {
      width = w;
    },
  };
}

const isOpen = (el: HTMLElement) =>
  el.classList.contains("maplibregl-compact-show") || el.hasAttribute("open");

describe("map credits (attribution)", () => {
  for (const [device, width] of [["desktop", 1280], ["phone", 375]] as const) {
    it(`start folded behind the ⓘ button on ${device}`, () => {
      const { map } = fakeMap(width, CREDITS);
      const el = foldedAttribution().onAdd(map);
      expect(el.classList.contains("maplibregl-compact")).toBe(true);
      expect(isOpen(el)).toBe(false);
      expect(el.textContent).toContain("OpenStreetMap");
    });

    it(`stay folded on ${device} when the credits arrive after load`, () => {
      const fake = fakeMap(width, null);
      const el = foldedAttribution().onAdd(fake.map);
      fake.setCredits(CREDITS);
      fake.fire("sourcedata", { type: "sourcedata", dataType: "source", sourceDataType: "metadata" });
      fake.fire("styledata", { type: "styledata", dataType: "style" });
      fake.fire("resize");
      expect(el.classList.contains("maplibregl-compact")).toBe(true);
      expect(isOpen(el)).toBe(false);
    });
  }

  it("stay folded when a phone turns into a wide screen and back", () => {
    const fake = fakeMap(375, CREDITS);
    const el = foldedAttribution().onAdd(fake.map);
    fake.resize(1280);
    fake.fire("resize");
    fake.resize(375);
    fake.fire("resize");
    expect(isOpen(el)).toBe(false);
  });

  it("open on a click of ⓘ, stay open while the map loads, and fold again", () => {
    const fake = fakeMap(1280, CREDITS);
    const el = foldedAttribution().onAdd(fake.map);
    const button = el.querySelector<HTMLElement>(".maplibregl-ctrl-attrib-button")!;

    button.click();
    expect(el.classList.contains("maplibregl-compact-show")).toBe(true);
    fake.fire("sourcedata", { type: "sourcedata", dataType: "source", sourceDataType: "metadata" });
    fake.fire("resize");
    expect(el.classList.contains("maplibregl-compact-show")).toBe(true);

    button.click();
    expect(isOpen(el)).toBe(false);
  });
});
