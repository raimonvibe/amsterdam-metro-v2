import type { ExpressionSpecification, Map as MapLibreMap, SymbolLayerSpecification } from "maplibre-gl";
import type { Theme } from "./theme";

/**
 * Shops, cafés, restaurants, fuel, parking: the basemap's points of
 * interest, in all five styles, with and without 3D buildings.
 *
 * - Liberty and Bright have them (layers `poi_r1`, `poi_r7`, `poi_r20` by
 *   rank, from zoom 15, 16 and 17). Light (Positron), Dark and Fiord have
 *   none, though they load the same icon sprite and fonts. They get
 *   Liberty's layers, coloured for their palette.
 * - Every style shows them from POI_MIN_ZOOM, where the church crosses
 *   start (ChurchMarkers), not from 15–17.
 * - The 3D buildings go under the first label layer (`belowLabels`): added
 *   on top, they hid every icon and name behind them.
 */

/** Street level: the zoom the church crosses appear at. OpenMapTiles carries
 *  every POI from zoom 14, so nothing is missing from the tiles there. */
export const POI_MIN_ZOOM = 14;

/** Liberty's three rank tiers: the ids its own layers use. */
const TIERS: [id: string, minRank: number, maxRank: number | null][] = [
  ["poi_r1", 1, 7],
  ["poi_r7", 7, 20],
  ["poi_r20", 20, null],
];

/** Label colours that read on each palette's basemap. */
const TEXT: Record<Theme, { color: string; halo: string }> = {
  light: { color: "#666", halo: "#ffffff" },
  dark: { color: "#b8bdc9", halo: "#141821" },
};

/** The MapLibre calls this file makes. */
export type PoiMap = Pick<MapLibreMap, "getStyle" | "getLayer" | "addLayer" | "setLayerZoomRange">;

/** Liberty's POI layers (OpenFreeMap, Nov 2026), coloured for `palette`. */
export function poiLayers(source: string, palette: Theme): SymbolLayerSpecification[] {
  const { color, halo } = TEXT[palette];
  return TIERS.map(([id, min, max]) => {
    const only: ExpressionSpecification[] = [
      ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
      [">=", ["get", "rank"], min],
    ];
    if (max !== null) only.push(["<", ["get", "rank"], max]);
    return {
      id,
      type: "symbol",
      source,
      "source-layer": "poi",
      minzoom: POI_MIN_ZOOM,
      filter: ["all", ...only],
      layout: {
        "icon-image": ["match", ["get", "subclass"], ["florist", "furniture"], ["get", "subclass"], ["get", "class"]],
        "text-anchor": "top",
        "text-field": [
          "case",
          ["has", "name:nonlatin"],
          ["concat", ["get", "name:latin"], "\n", ["get", "name:nonlatin"]],
          ["coalesce", ["get", "name_en"], ["get", "name"]],
        ],
        "text-font": ["Noto Sans Italic"],
        "text-max-width": 9,
        "text-offset": [0, 0.6],
        "text-size": 12,
      },
      paint: { "text-color": color, "text-halo-blur": 0.5, "text-halo-color": halo, "text-halo-width": 1 },
    };
  });
}

/** POIs on the current style, from POI_MIN_ZOOM. Run on every style load. */
export function showPois(map: PoiMap, palette: Theme) {
  const style = map.getStyle();
  const own = (style.layers ?? []).filter((l) => "source-layer" in l && l["source-layer"] === "poi" && TIERS.some(([id]) => id === l.id));
  if (own.length) {
    own.forEach((l) => map.setLayerZoomRange(l.id, POI_MIN_ZOOM, 24));
    return;
  }
  const source = Object.keys(style.sources).find((k) => style.sources[k].type === "vector");
  if (!source) return;
  // On top of the style: above its roads and fills, next to its other labels.
  for (const layer of poiLayers(source, palette)) if (!map.getLayer(layer.id)) map.addLayer(layer);
}

/** The first label layer: what the 3D buildings go under, so icons and names
 *  stay in front of them. Undefined (on top) for a style without labels. */
export function belowLabels(map: PoiMap): string | undefined {
  return (map.getStyle().layers ?? []).find((l) => l.type === "symbol")?.id;
}
