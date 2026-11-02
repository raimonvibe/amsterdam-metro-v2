import { useSyncExternalStore } from "react";

/** How much of the 3D map to draw.
 *  - "full": 3D buildings, motion trails, the opening flight.
 *  - "lite": still the tilted 3D map with the trains and their glow, without
 *    the heavy extras, for devices that can't draw them smoothly.
 *  Every device starts on "full" unless it draws in software or asks to save
 *  data; MetroMap watches the frame rate and steps down if it struggles.
 *  Visitors can override it in the menu. See docs/adaptive-3d.md. */
export type Quality = "full" | "lite";
export type QualityPref = "auto" | "full" | "lite";

const STORAGE_KEY = "metro-live:3d";

/** A GPU-less browser draws WebGL on the CPU (SwiftShader in headless Chrome
 *  and Lighthouse, llvmpipe on Linux, Microsoft Basic Render Driver). It works,
 *  but a 3D city at ~2 frames a second blocks the page. Firefox and Safari can
 *  hide the renderer's name; then this returns false and the frame-rate watch
 *  is what catches a slow device. */
export function softwareRenderer(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

let softwareGLCache: boolean | undefined;
/** softwareRenderer(), checked once per page: it creates a WebGL context. */
export function softwareGL(): boolean {
  softwareGLCache ??= typeof document !== "undefined" && softwareRenderer();
  return softwareGLCache;
}

/** The visitor's browser asks sites to use less data (Chrome "Lite mode",
 *  Android data saver). */
function saveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}

/** Where a visit starts. "auto" is lite only when the device can't do better
 *  from the start; otherwise full, and the frame-rate watch decides. */
export function startQuality(pref: QualityPref, probe = { software: softwareGL, saveData }): Quality {
  if (pref !== "auto") return pref;
  return probe.software() || probe.saveData() ? "lite" : "full";
}

/** Milliseconds between frames the map may take before it's called slow: at
 *  20 frames a second the camera judders and taps feel late. */
export const SLOW_FRAME_MS = 50;
/** Frames to judge on, so one hitch (a tile batch, a garbage collection)
 *  doesn't count. */
export const FRAMES_TO_JUDGE = 40;
/** A device at 2 frames a second would need 20 s for 40 frames: judge after
 *  this much time instead, as long as there are a few frames to go on. */
export const JUDGE_AFTER_MS = 3000;
const MIN_FRAMES = 6;

/** Too slow when the median frame interval is over SLOW_FRAME_MS. The median,
 *  not the mean, so a few long frames while tiles load don't decide it. */
export function tooSlow(frameIntervalsMs: number[]): boolean {
  const total = frameIntervalsMs.reduce((sum, ms) => sum + ms, 0);
  const enough = frameIntervalsMs.length >= FRAMES_TO_JUDGE || (total >= JUDGE_AFTER_MS && frameIntervalsMs.length >= MIN_FRAMES);
  if (!enough) return false;
  const sorted = [...frameIntervalsMs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] > SLOW_FRAME_MS;
}

// The visitor's choice, shared by the menu switch and the map.
function readPref(): QualityPref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "full" || v === "lite") return v;
  } catch {
    /* storage unavailable */
  }
  return "auto";
}

let pref: QualityPref = typeof window === "undefined" ? "auto" : readPref();
const listeners = new Set<() => void>();

export function getQualityPref(): QualityPref {
  return pref;
}

/** "auto" removes the stored choice: nothing is kept unless the visitor
 *  picked something else. */
export function setQualityPref(next: QualityPref) {
  try {
    if (next === "auto") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
  if (next === pref) return;
  pref = next;
  listeners.forEach((l) => l());
}

export function useQualityPref(): QualityPref {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getQualityPref,
    getQualityPref,
  );
}
