import { describe, expect, it } from "vitest";
import { belowLabels, BUSINESS_LAYERS, drawsRoadNumber, hideBusinesses, hideRoadNumbers, PoiMap } from "./mapPois";
import { MAP_STYLES, type MapStyle } from "./theme";
import STYLES from "./test/mapStyles.json";

/**
 * Against the layer lists of the five real OpenFreeMap styles (ids, types
 * and source layers as served in Nov 2026; src/test/mapStyles.json).
 * Liberty and Bright ship business icons; Light, Dark and Fiord don't.
 */

type Layer = { id: string; type: string; "source-layer"?: string; layout?: { visibility?: string; "text-field"?: unknown } };

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

describe.each([
  // What each style uses for road numbers, as served in Nov 2026.
  ["light", ["highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us"]],
  ["dark", ["highway_name_motorway"]],
  ["liberty", ["highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us"]],
  ["bright", ["highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us"]],
  ["fiord", ["highway_ref"]],
] as const)("road numbers in the %s style", (style, numberLayers) => {
  const hide = () => {
    const map = mapWith(style);
    hideRoadNumbers(map as unknown as Parameters<typeof hideRoadNumbers>[0]);
    return map.layers;
  };
  const hidden = (layers: Layer[]) => layers.filter((l) => l.layout?.visibility === "none").map((l) => l.id);

  it("are hidden (A10, S111), and nothing else is", () => {
    expect(hidden(hide()).sort()).toEqual([...numberLayers].sort());
  });

  it("leave every street, place and water name visible", () => {
    const names = hide().filter((l) => l.type === "symbol" && /name/.test(JSON.stringify(l.layout?.["text-field"] ?? "")));
    expect(names.length).toBeGreaterThan(0);
    for (const l of names) expect(l.layout?.visibility, l.id).not.toBe("none");
  });
});

describe("drawsRoadNumber", () => {
  const road = (textField: unknown) => ({ type: "symbol", "source-layer": "transportation_name", layout: { "text-field": textField } });
  it("knows a number from a name, in both ways a style writes them", () => {
    expect(drawsRoadNumber(road(["to-string", ["get", "ref"]]))).toBe(true);
    expect(drawsRoadNumber(road("{ref}"))).toBe(true);
    expect(drawsRoadNumber(road(["coalesce", ["get", "name:nl"], ["get", "name"]]))).toBe(false);
    expect(drawsRoadNumber(road("{name}"))).toBe(false);
  });
  it("leaves anything that isn't a road label alone", () => {
    expect(drawsRoadNumber({ type: "symbol", "source-layer": "place", layout: { "text-field": "{ref}" } })).toBe(false);
    expect(drawsRoadNumber({ type: "line", "source-layer": "transportation_name" })).toBe(false);
  });
});
