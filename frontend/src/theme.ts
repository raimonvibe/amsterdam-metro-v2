import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "metro-live:theme";

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return [theme, toggle];
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
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
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
  },
  light: {
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    buildingColor: "#d8d8e0",
    buildingOpacity: 0.85,
    stationFill: [255, 255, 255, 255] as [number, number, number, number],
    stationRing: [70, 75, 90, 255] as [number, number, number, number],
    labelColor: [55, 60, 75, 235] as [number, number, number, number],
    labelHalo: [248, 248, 250, 255] as [number, number, number, number],
    additiveGlow: false,
    lineAlpha: 175,
    lineWashAlpha: 8,
    lineMidAlpha: 13,
    glowAlpha: 22,
    trailCoreAlpha: 180,
    // Normal blending over a pale basemap needs far more alpha than additive
    // over a dark one to reach the same visual weight — at 110 the halo was
    // effectively invisible and only the hot centre showed.
    trainGlowAlpha: 200,
    coreWhiten: 0.08,
  },
} as const;
