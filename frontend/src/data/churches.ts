import churches from "./churches.json";

export interface Church {
  latitude: number;
  longitude: number;
}

/** Christian churches in greater Amsterdam (OSM, bundled). */
export const CHURCHES: Church[] = churches;

/** How far from a metro station a church still counts as in the metro area. */
export const METRO_AREA_KM = 1.5;

/** Distance in km; flat-earth is plenty at city scale. */
function km(a: Church, b: Church): number {
  const x = (b.longitude - a.longitude) * Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180)) * 111.32;
  const y = (b.latitude - a.latitude) * 110.57;
  return Math.hypot(x, y);
}

/** The churches within `radiusKm` of any of the given stations. */
export function churchesNear(stations: Church[], radiusKm = METRO_AREA_KM, all = CHURCHES): Church[] {
  return all.filter((c) => stations.some((s) => km(c, s) <= radiusKm));
}
