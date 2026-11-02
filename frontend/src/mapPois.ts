import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * The basemap's business icons (shops, cafés, restaurants, fuel, parking),
 * kept off the map: in every style, with and without 3D buildings. Shown
 * for a while (#195), they crowded the metro lines and stations; the church
 * crosses (ChurchMarkers) are this map's only places of interest.
 *
 * - Liberty and Bright have them, as layers `poi_r1`, `poi_r7` and
 *   `poi_r20` (by rank). Light (Positron), Dark and Fiord have none.
 * - The 3D buildings go under the first label layer (`belowLabels`), so
 *   street and place names stay in front of them.
 */

/** Liberty's and Bright's business layers, one per rank tier. Their transit
 *  layer (`poi_transit`: bus, train, airport) is not a business and stays. */
export const BUSINESS_LAYERS = ["poi_r1", "poi_r7", "poi_r20"];

/** The MapLibre calls this file makes. */
export type PoiMap = Pick<MapLibreMap, "getLayer" | "setLayoutProperty">;

/** Business icons off, in whatever style is loaded. Run on every style load. */
export function hideBusinesses(map: PoiMap) {
  for (const id of BUSINESS_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
}

/** The first label layer: what the 3D buildings go under, so names stay in
 *  front of them. Undefined (on top) for a style without labels. */
export function belowLabels(map: Pick<MapLibreMap, "getStyle">): string | undefined {
  return (map.getStyle().layers ?? []).find((l) => l.type === "symbol")?.id;
}
