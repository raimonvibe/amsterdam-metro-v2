import { describe, expect, it } from "vitest";
import { belowLabels, POI_MIN_ZOOM, PoiMap, showPois } from "./mapPois";
import { MAP_STYLES, type MapStyle } from "./theme";
import STYLES from "./test/mapStyles.json";

/**
 * Against the layer lists of the five real OpenFreeMap styles (ids, types
 * and source layers as served in Nov 2026; src/test/mapStyles.json).
 * Liberty and Bright ship POI layers; Light, Dark and Fiord don't.
 */

type Layer = { id: string; type: string; "source-layer"?: string; minzoom?: number; paint?: Record<string, unknown> };

/** A map holding one style's layers, in order, as MapLibre would. */
function mapWith(style: MapStyle) {
  const layers: Layer[] = structuredClone(STYLES[style].layers);
  const map = {
    layers,
    getStyle: () => ({ version: 8, layers, sources: STYLES[style].sources }),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addLayer(layer: Layer, beforeId?: string) {
      const at = beforeId ? layers.findIndex((l) => l.id === beforeId) : -1;
      if (at < 0) layers.push(layer);
      else layers.splice(at, 0, layer);
    },
    setLayerZoomRange(id: string, minzoom: number) {
      layers.find((l) => l.id === id)!.minzoom = minzoom;
    },
  };
  return map;
}

const STYLE_NAMES = Object.keys(MAP_STYLES) as MapStyle[];
const pois = (layers: Layer[]) => layers.filter((l) => l["source-layer"] === "poi" && l.id.startsWith("poi_r"));

describe.each(STYLE_NAMES)("points of interest in the %s style", (style) => {
  it("are there, all three rank tiers, from the zoom the church crosses start at", () => {
    const map = mapWith(style);
    showPois(map as unknown as PoiMap, MAP_STYLES[style].palette);
    const tiers = pois(map.layers);
    expect(tiers.map((l) => l.id).sort()).toEqual(["poi_r1", "poi_r20", "poi_r7"]);
    for (const l of tiers) expect(l.minzoom).toBe(POI_MIN_ZOOM);
  });

  it("aren't added twice when the style loads again", () => {
    const map = mapWith(style);
    showPois(map as unknown as PoiMap, MAP_STYLES[style].palette);
    showPois(map as unknown as PoiMap, MAP_STYLES[style].palette);
    expect(pois(map.layers)).toHaveLength(3);
  });

  it("draw in front of the 3D buildings", () => {
    const map = mapWith(style);
    showPois(map as unknown as PoiMap, MAP_STYLES[style].palette);
    map.addLayer({ id: "3d-buildings", type: "fill-extrusion", "source-layer": "building" }, belowLabels(map as unknown as PoiMap));
    const buildings = map.layers.findIndex((l) => l.id === "3d-buildings");
    for (const l of pois(map.layers)) expect(map.layers.indexOf(l)).toBeGreaterThan(buildings);
    // Street and place names too: every label is in front.
    expect(map.layers.slice(0, buildings).some((l) => l.type === "symbol")).toBe(false);
  });
});

describe("points of interest added to a style without them", () => {
  it("read on a dark basemap: light text on a dark halo", () => {
    const map = mapWith("dark");
    showPois(map as unknown as PoiMap, "dark");
    const r1 = map.layers.find((l) => l.id === "poi_r1")!;
    expect(r1.paint).toMatchObject({ "text-color": "#b8bdc9", "text-halo-color": "#141821" });
  });

  it("leave Liberty's own layers as Liberty draws them", () => {
    const map = mapWith("liberty");
    const before = map.layers.length;
    showPois(map as unknown as PoiMap, "light");
    expect(map.layers).toHaveLength(before);
  });
});
