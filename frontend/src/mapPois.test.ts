import { describe, expect, it } from "vitest";
import { belowLabels, BUSINESS_LAYERS, hideBusinesses, PoiMap } from "./mapPois";
import { MAP_STYLES, type MapStyle } from "./theme";
import STYLES from "./test/mapStyles.json";

/**
 * Against the layer lists of the five real OpenFreeMap styles (ids, types
 * and source layers as served in Nov 2026; src/test/mapStyles.json).
 * Liberty and Bright ship business icons; Light, Dark and Fiord don't.
 */

type Layer = { id: string; type: string; "source-layer"?: string; layout?: { visibility?: string } };

/** A map holding one style's layers, in order, as MapLibre would. */
function mapWith(style: MapStyle) {
  const layers: Layer[] = structuredClone(STYLES[style].layers);
  return {
    layers,
    getStyle: () => ({ version: 8, layers, sources: STYLES[style].sources }),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addLayer(layer: Layer, beforeId?: string) {
      const at = beforeId ? layers.findIndex((l) => l.id === beforeId) : -1;
      if (at < 0) layers.push(layer);
      else layers.splice(at, 0, layer);
    },
    setLayoutProperty(id: string, key: string, value: string) {
      const layer = layers.find((l) => l.id === id)!;
      layer.layout = { ...layer.layout, [key]: value };
    },
  };
}

const STYLE_NAMES = Object.keys(MAP_STYLES) as MapStyle[];
const shown = (layers: Layer[]) =>
  layers.filter((l) => l["source-layer"] === "poi" && l.layout?.visibility !== "none").map((l) => l.id);

describe.each(STYLE_NAMES)("the %s style", (style) => {
  it("shows no business icons", () => {
    const map = mapWith(style);
    hideBusinesses(map as unknown as PoiMap);
    // Only transit (bus, train, airport) may remain; it isn't a business.
    expect(shown(map.layers).filter((id) => id !== "poi_transit")).toEqual([]);
  });

  it("keeps every label in front of the 3D buildings", () => {
    const map = mapWith(style);
    map.addLayer({ id: "3d-buildings", type: "fill-extrusion", "source-layer": "building" }, belowLabels(map as unknown as Parameters<typeof belowLabels>[0]));
    const buildings = map.layers.findIndex((l) => l.id === "3d-buildings");
    expect(map.layers.slice(0, buildings).some((l) => l.type === "symbol")).toBe(false);
  });
});

describe("business layers", () => {
  it("are the ones Liberty and Bright ship", () => {
    for (const style of ["liberty", "bright"] as const) {
      const ids = STYLES[style].layers.map((l) => l.id);
      for (const id of BUSINESS_LAYERS) expect(ids, `${style} ${id}`).toContain(id);
    }
  });
});
