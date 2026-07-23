import churches from "./churches.json";

export interface Church {
  latitude: number;
  longitude: number;
}

/** Christian churches in greater Amsterdam (OSM, bundled). */
export const CHURCHES: Church[] = churches;
