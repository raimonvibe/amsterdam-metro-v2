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

/** Per-theme colors for everything rendered on the map itself. */
export const MAP_THEME = {
  dark: {
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
    buildingColor: "#2a2f3a",
    buildingOpacity: 0.75,
    stationFill: [238, 240, 248, 235] as [number, number, number, number],
    stationRing: [15, 17, 23, 255] as [number, number, number, number],
    labelColor: [205, 210, 222, 225] as [number, number, number, number],
    labelHalo: [10, 12, 16, 255] as [number, number, number, number],
    trainOutline: [10, 12, 16, 255] as [number, number, number, number],
    lineAlpha: 200,
    glowAlpha: 45,
    trainGlowAlpha: 90,
  },
  light: {
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    buildingColor: "#d8d8e0",
    buildingOpacity: 0.85,
    stationFill: [255, 255, 255, 255] as [number, number, number, number],
    stationRing: [70, 75, 90, 255] as [number, number, number, number],
    labelColor: [55, 60, 75, 235] as [number, number, number, number],
    labelHalo: [248, 248, 250, 255] as [number, number, number, number],
    trainOutline: [255, 255, 255, 255] as [number, number, number, number],
    lineAlpha: 220,
    glowAlpha: 28,
    trainGlowAlpha: 60,
  },
} as const;
