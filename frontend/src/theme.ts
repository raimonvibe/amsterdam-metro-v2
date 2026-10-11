import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

/**
 * One choice drives the whole look: the OpenFreeMap basemap and, through its
 * palette, both the page chrome (`.dark`) and the map overlay colours below.
 * A style rides on the palette whose basemap brightness it matches, so trains
 * keep the contrast tuned there.
 */
export type MapStyle = "light" | "dark" | "liberty" | "bright" | "fiord";

export const MAP_STYLES: Record<
  MapStyle,
  { styleUrl: string; palette: Theme; swatch: [string, string, string] }
> = {
  // Swatch = background, water, park — taken from each style's JSON.
  light: {
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    palette: "light",
    swatch: ["#f2f3f0", "#c2c8ca", "#e6e9e5"],
  },
  dark: {
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
    palette: "dark",
    swatch: ["#0c0c0c", "#1b1b1d", "#202020"],
  },
  liberty: {
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    palette: "light",
    swatch: ["#f8f4f0", "#9ebdff", "#d8e8c8"],
  },
  bright: {
    styleUrl: "https://tiles.openfreemap.org/styles/bright",
    palette: "light",
    swatch: ["#f8f4f0", "#aecfe2", "#d8e8c8"],
  },
  fiord: {
    styleUrl: "https://tiles.openfreemap.org/styles/fiord",
    palette: "dark",
    swatch: ["#45516e", "#38435c", "#4a5d6b"],
  },
};

// The old light/dark toggle saved under "metro-live:theme" on every visit, chosen
// or not, so it is deliberately not migrated: everyone starts on Liberty.
const STORAGE_KEY = "metro-live:map-style";

export function useMapStyle(): [MapStyle, (s: MapStyle) => void] {
  const [style, setStyle] = useState<MapStyle>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && saved in MAP_STYLES ? (saved as MapStyle) : "liberty";
  });

  useEffect(() => {
    const dark = MAP_STYLES[style].palette === "dark";
    document.documentElement.classList.toggle("dark", dark);
    // Mobile browser chrome: match the page background (white / gray-950).
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#030712" : "#ffffff");
    localStorage.setItem(STORAGE_KEY, style);
  }, [style]);

  return [style, setStyle];
}

/**
 * Per-theme colors for everything rendered on the map itself.
 *
 * Two ideas drive the numbers below.
 *
 * First, the track is deliberately dimmer than the trains on it. Drawn at full
 * strength the line is the brightest thing on screen and a train riding it has
 * nothing to stand out against — worse, its trail is the same hue as the track,
 * so it disappears into it. Pulling the line back lets the train and its trail
 * carry the colour, which is what makes movement read.
 *
 * Second, the glow treatment is asymmetric between themes. Additive blending
 * stacks light on light, exactly right over a dark basemap — overlapping trains
 * brighten the shared corridor — but on the light basemap it only pushes colours
 * toward white and washes the map out. Light therefore keeps normal alpha
 * blending and lower alphas: restrained in intensity, identical in shape.
 * Neither theme rings the train with a hard outline; on light it is the train's
 * saturation against the paler track that separates it.
 */
export const MAP_THEME = {
  dark: {
    buildingColor: "#2a2f3a",
    buildingOpacity: 0.75,
    stationFill: [238, 240, 248, 235] as [number, number, number, number],
    stationRing: [15, 17, 23, 255] as [number, number, number, number],
    labelColor: [205, 210, 222, 225] as [number, number, number, number],
    labelHalo: [10, 12, 16, 255] as [number, number, number, number],
    additiveGlow: true,
    lineAlpha: 150,
    lineWashAlpha: 9,
    lineMidAlpha: 14,
    glowAlpha: 24,
    trailCoreAlpha: 175,
    trainGlowAlpha: 190,
    coreWhiten: 0.45,
    // Nothing to darken: the palette is already carrying light on a dark map.
    trainShade: 0,
    trainShadeSkipLuminance: 0,
  },
  light: {
    buildingColor: "#d8d8e0",
    buildingOpacity: 0.85,
    stationFill: [255, 255, 255, 255] as [number, number, number, number],
    stationRing: [70, 75, 90, 255] as [number, number, number, number],
    labelColor: [55, 60, 75, 235] as [number, number, number, number],
    labelHalo: [248, 248, 250, 255] as [number, number, number, number],
    additiveGlow: false,
    // Rails a notch quieter so coloured train shimmer is not fighting them.
    lineAlpha: 150,
    lineWashAlpha: 7,
    lineMidAlpha: 11,
    glowAlpha: 18,
    trailCoreAlpha: 210,
    // Normal blending on a pale basemap needs more alpha than additive-on-dark;
    // kept below full so the glow stays a shimmer, not a neon blot.
    trainGlowAlpha: 235,
    // Keep saturation — whitening on light dissolves the line colour into the map.
    coreWhiten: 0.02,
    // Trains only, never the rails — the rails staying pale is what the train
    // reads against, so darkening both would move them together and spend the
    // contrast this is buying.
    trainShade: 0.16,
    // Line 54's yellow sits at 0.75 luminance, roughly 1.2:1 against this
    // basemap, and is the one line no amount of darkening rescues: it turns
    // olive long before it turns legible. Anything above this is left at its
    // published colour and leans on the glow and trail to read instead.
    trainShadeSkipLuminance: 0.5,
  },
} as const;
