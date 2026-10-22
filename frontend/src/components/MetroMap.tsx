import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, useControl, AttributionControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import { MapboxOverlay, MapboxOverlayProps } from "@deck.gl/mapbox";
import { IconLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { AnimatedTrain, Line, ShapeGeom, Station } from "../types";
import {
  currentDistance,
  offsetLonLatMeters,
  offsetPathLikeReference,
  offsetPathMeters,
  pathBetween,
  pointAt,
  samplePathBetween,
} from "../animate";
import { formatPlaceName } from "../format";
import { angleForBearing, GLOW_ICON_MAPPING, glowSpriteUrl } from "../glow";
import { MAP_THEME, Theme } from "../theme";
import { ChurchMarkers } from "./ChurchMarkers";
import { TrainPopup } from "./TrainPopup";
import { getWebGLStatus } from "../webgl";
import { nl } from "../i18n/nl";
import "maplibre-gl/dist/maplibre-gl.css";

// deck.gl attached as a maplibre overlay control: shares the map camera, so
// pitch/rotate (right-drag) works on every layer including 3D buildings.
function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface MetroMapProps {
  lines: Line[];
  stations: Station[];
  trains: AnimatedTrain[];
  shapes: Record<string, ShapeGeom>;
  visibleLines: string[];
  /** Overlay palette — matches the basemap's brightness, not necessarily the page theme. */
  theme: Theme;
  styleUrl: string;
  /** Basemap background of the incoming style: the colour a style switch fades through. */
  backdropColor: string;
  followedTrainId: string | null;
  onStationHover: (station: Station | null) => void;
  onTrainClick: (train: AnimatedTrain) => void;
  onStationClick: (station: Station) => void;
  /** Fly to this station whenever the object changes (nonce makes repeats count). */
  focusStation?: { station: Station; nonce: number } | null;
  onStopFollow: () => void;
  onMapBackgroundClick?: () => void;
  /** Covered by a full-screen page: stop the animation clock, which would
   *  otherwise re-render the map ~30 times a second for nobody. */
  paused?: boolean;
}

/** Style-switch veil: quick cover, gentler reveal; reveal anyway if tiles stall. */
const VEIL_IN_MS = 150;
const VEIL_OUT_MS = 350;
const VEIL_MAX_WAIT_MS = 1500;

/**
 * The train popup closes once its train is this far from a still pointer.
 * deck.gl only re-picks on pointer moves, so without this a train that drives
 * out from under a resting cursor keeps its popup open indefinitely.
 */
const POPUP_LEAVE_PX = 40;

/** Phones and tablets: no hover, so the followed train gets the popup instead. */
const NO_HOVER =
  typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

/** Distance in px from (px, py) to the polyline `pts`. */
function distToPolyline(px: number, py: number, pts: { x: number; y: number }[]): number {
  if (pts.length === 1) return Math.hypot(px - pts[0].x, py - pts[0].y);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.min(Math.max(((px - a.x) * dx + (py - a.y) * dy) / len2, 0), 1) : 0;
    best = Math.min(best, Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t)));
  }
  return best;
}

/** Amsterdam metro trainsets are ~90-116m; 100m reads well at city zoom. */
const TRAIN_LENGTH_M = 100;
/**
 * Soft dissolve past both ends of the trainset, on the rails. TripsLayer cannot
 * fade both ends (timestamps must rise along the path), so the body is short
 * PathLayer segments with an alpha envelope — bright at mid, 0 at rear tip and
 * nose tip. Long fade zones + fine steps keep the dissolve smooth.
 */
const TRAIN_TAIL_FADE_M = 120;
const TRAIN_NOSE_FADE_M = 120;
/** Bright plateau around mid-train; outside this the cosine dissolve runs. */
const TRAIN_CORE_HALF_M = 22;
const TRAIN_BODY_STEP_M = 4;
/** Soft bloom only — no hard core sprite. */
const TRAIN_GLOW_M = 120;
const DELAY_THRESHOLD_S = 120;
/**
 * Late trains breathe; they do not change colour.
 *
 * Recolouring them amber cost more than it bought. Line 54 is #FFE119 and 51
 * is #F58231, both within a hair of the amber that meant "late" — so a late 54
 * and an on-time 54 were the same pixel, and the cue was ambiguous in both
 * directions. It also threw away the line identity of exactly the trains you
 * most want to identify, and the extra alpha it carried made a two-minute
 * delay the brightest thing on the map.
 *
 * A slow pulse is orthogonal to hue, so it reads the same on all four lines
 * and collides with nothing. Kept deliberately slow and shallow — this is a
 * breathe, not a blink; at DELAY_THRESHOLD_S it should catch the eye without
 * pulling it off the map.
 */
const DELAY_PULSE_MS = 1800;
const DELAY_PULSE_DEPTH = 0.3;
const TRAIL_SECONDS = 40;
const TRAIL_SAMPLE_MS = 200;
/**
 * Trails are sampled by distance travelled, not by the clock. On a fixed timer
 * a train at line speed lays down segments a few metres long — sub-pixel at
 * city zoom — and dozens of their round joints overlap; summed by additive
 * blending that moirés into speckle instead of a smooth tail. A slow or
 * dwelling train is worse still, stacking near-identical points on one spot.
 * Spacing samples out in metres keeps the geometry clean at any speed.
 */
const TRAIL_MIN_STEP_M = 25;
/**
 * A trail joins its samples with straight segments, so it is only honest while
 * consecutive samples are close along the track. A background tab stops the
 * animation clock and the train stream; on return the trains jump to where they are
 * now and the next sample would be a straight chord kilometres long, cutting
 * across the city. Past either limit the trail starts over instead.
 */
const TRAIL_MAX_STEP_M = 400;
const TRAIL_MAX_GAP_MS = 2000;
/**
 * Trail times are seconds since page load, never Unix epoch seconds.
 *
 * TripsLayer uploads timestamps as float32, which holds integers exactly only
 * up to 2^24. Around 1.79e9 — where Unix seconds now sit — consecutive
 * representable floats are 128 seconds apart, so every timestamp in a 40s trail
 * quantises onto the same one or two values and the shader's fade/discard test
 * turns to noise. It renders as random stipple along the tail, which is easy to
 * mistake for a blending or geometry bug. Small numbers keep the mantissa.
 */
const TRAIL_EPOCH_MS = Date.now();

/**
 * Lateral draw offset (metres, west-positive — see offsetPathMeters) so lines
 * that share physical rails still show their own colour. 50/51 and 53/54 run
 * the same corridors; without a lane shift the later PathLayers bury the
 * earlier ones (green 50 under orange 51 and yellow 54). Tracks and trains both
 * transfer onto the line's canonical offset (longest shape) so a yellow train
 * cannot sit a lane away from the painted yellow rail.
 *
 * Keep this modest (~half a metro corridor). At 36m Gein sat in a gap between
 * green and yellow with both ribbons cutting through buildings; ~14m still
 * separates colour at street zoom without orphaning the station.
 */
const LINE_TRACK_OFFSET_M: Record<string, number> = {
  "50": 14,
  "51": -14,
  "52": 0,
  "53": 10,
  "54": -10,
};

/** Paint order for track layers — green last so shared corridors keep a 50 edge. */
const LINE_DRAW_ORDER = ["52", "53", "54", "51", "50"];

/**
 * Every layer here is a flat decal on the ground plane, drawn in a deliberate
 * back-to-front order. Many are exactly coplanar — the three line tiers and the
 * trail all sit on the same rails — so leaving the depth buffer in charge lets
 * the GPU pick a winner per fragment where they meet. Array order is the only
 * ordering we want.
 */
const FLAT = {
  depthCompare: "always",
  depthWriteEnabled: false,
} as const;

/**
 * Additive blending, so overlapping glows sum instead of occluding each other —
 * what makes the shared Centraal-Waterlooplein corridor read as hot when
 * several trains stack up on it. Only ever applied on the dark theme; see the
 * note in MAP_THEME.
 *
 * Reserved for the train halo, which is one quad per train. Additive is only
 * safe on geometry that never overlaps itself: a polyline's segment quads share
 * edges and its joints pile on extra coverage, and additive double-counts every
 * one of them — on a GTFS shape, whose vertices are metres apart, that reads as
 * stipple running the length of the track.
 */
const ADDITIVE = {
  ...FLAT,
  blend: true,
  blendColorOperation: "add",
  blendColorSrcFactor: "src-alpha",
  blendColorDstFactor: "one",
  blendAlphaOperation: "add",
  blendAlphaSrcFactor: "one",
  blendAlphaDstFactor: "one",
} as const;

const INTRO_START = {
  longitude: 4.9004,
  latitude: 52.3778,
  zoom: 10.8,
  pitch: 0,
  bearing: 0,
};
// Centraal Station: hub of lines 52/53/54 (and 51's terminus), ringed by the
// dense old-city building fabric — the busiest, most 3D-building-dense spot
// in the network to open on.
const INTRO_END = {
  center: [4.9035, 52.373] as [number, number],
  zoom: 15.1,
  pitch: 58,
  bearing: 20,
};

/** Wash a line colour toward white — the centre of a light source is hotter
 *  and less saturated than its halo, and the darker line colours (52's navy)
 *  otherwise have no headroom left to read as bright over a dark basemap. Over
 *  a pale one the opposite holds, so the amount comes from the theme: whitening
 *  a blob that already sits on near-white just dissolves it. */
const hotten = (
  [r, g, b]: [number, number, number],
  amount: number,
): [number, number, number] => [
  Math.round(r + (255 - r) * amount),
  Math.round(g + (255 - g) * amount),
  Math.round(b + (255 - b) * amount),
];

const srgbToLinear = (c: number): number => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

const relLuminance = ([r, g, b]: [number, number, number]): number =>
  0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);

const hslLightness = (rgb: [number, number, number]): number =>
  (Math.max(...rgb) + Math.min(...rgb)) / 2;

const hslChroma = (rgb: [number, number, number]): number =>
  Math.max(...rgb) - Math.min(...rgb);

/** Chroma available at a given HSL lightness — the denominator of HSL S. */
const chromaSpan = (l: number): number => 255 - Math.abs(2 * l - 255);

/**
 * Darken toward black, holding both hue and saturation.
 *
 * A plain channel multiply keeps hue but quietly bleeds saturation: it drags
 * every channel toward zero, so the gap between the brightest and darkest
 * channel closes faster than the midpoint falls. Line 51's orange loses a
 * quarter of its saturation that way (91% -> 67%) and turns muddy. So the
 * multiply only decides *how far down* to go; the chroma is then re-expanded
 * around the new lightness to the saturation the line started with.
 *
 * Lines paler than `skipAboveLum` are returned untouched. Holding saturation
 * keeps a darkened yellow gold rather than brown, but only up to a point — past
 * it any yellow reads as olive, and the line stops being recognisably itself.
 * For those, identity is worth more than the contrast darkening would buy.
 */
const shade = (
  rgb: [number, number, number],
  amount: number,
  skipAboveLum: number,
): [number, number, number] => {
  if (amount === 0 || relLuminance(rgb) > skipAboveLum) return rgb;
  const dark = rgb.map((c) => c * (1 - amount)) as [number, number, number];

  const span = chromaSpan(hslLightness(rgb));
  const chroma = hslChroma(dark);
  // Greys have no hue to preserve, and pure black/white no room to hold chroma.
  if (chroma === 0 || span === 0) return dark.map(Math.round) as [number, number, number];

  const l = hslLightness(dark);
  const saturation = hslChroma(rgb) / span;
  const scale = (saturation * chromaSpan(l)) / chroma;
  return dark.map((c) =>
    Math.round(Math.min(255, Math.max(0, l + (c - l) * scale))),
  ) as [number, number, number];
};

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [255, 255, 255];
};

interface PositionedTrain extends AnimatedTrain {
  path: [number, number][];
  /** Dead-reckoned distance along the shape of the train's leading end. */
  head: number;
  /** Middle of the pill — where the glow sprite is anchored. */
  center: [number, number];
  /** Sprite rotation, derived from the track bearing at `center`. */
  angle: number;
  color: [number, number, number];
}

/** One drawn stretch of rail. A line contributes several — see Line.tracks. */
interface Track {
  line: string;
  path: [number, number][];
  color: [number, number, number];
}

interface Trail {
  line: string;
  shapeId: string;
  path: [number, number][];
  timestamps: number[];
  /** Distance along the shape at the last recorded sample. */
  lastDist: number;
}

/** One short rail segment of the faded train body. */
interface TrainBodySeg {
  path: [number, number][];
  color: [number, number, number, number];
  train: PositionedTrain;
}

export function MetroMap({
  lines,
  stations,
  trains,
  shapes,
  visibleLines,
  theme: targetTheme,
  styleUrl: targetStyleUrl,
  backdropColor,
  followedTrainId,
  onStationHover,
  onTrainClick,
  onStationClick,
  focusStation,
  onStopFollow,
  onMapBackgroundClick,
  paused = false,
}: MetroMapProps) {
  const mapRef = useRef<MapRef>(null);
  const deckPickRef = useRef(false);
  /** Per-line canonical lane (longest shape → offset). Shared by tracks + trains. */
  const laneRefs = useMemo(() => {
    const refs: Record<
      string,
      { raw: [number, number][]; offset: [number, number][]; offsetM: number }
    > = {};
    for (const l of lines) {
      const offsetM = LINE_TRACK_OFFSET_M[l.id] ?? 0;
      if (!offsetM) continue;
      const raw = l.shape as [number, number][];
      refs[l.id] = { raw, offset: offsetPathMeters(raw, offsetM), offsetM };
    }
    return refs;
  }, [lines]);
  /** Shape coords transferred onto the line's canonical lane. */
  const laneShapeCache = useRef<Record<string, ShapeGeom>>({});
  const laneShapesKey = useRef(laneRefs);
  if (laneShapesKey.current !== laneRefs) {
    laneShapesKey.current = laneRefs;
    laneShapeCache.current = {};
  }
  const laneShape = (
    lineId: string,
    shapeId: string,
    shape: ShapeGeom,
  ): ShapeGeom => {
    const ref = laneRefs[lineId];
    if (!ref) return shape;
    const key = `${lineId}:${shapeId}`;
    let cached = laneShapeCache.current[key];
    if (!cached) {
      cached = {
        coords: offsetPathLikeReference(
          shape.coords as [number, number][],
          ref.raw,
          ref.offset,
        ),
        cum: shape.cum,
      };
      laneShapeCache.current[key] = cached;
    }
    return cached;
  };
  const [zoom, setZoom] = useState(INTRO_START.zoom);
  const [tick, setTick] = useState(0);
  const [webglError, setWebglError] = useState<string | null>(() => {
    const status = getWebGLStatus();
    return status.ok ? null : status.reason;
  });
  const introDone = useRef(false);
  const trailsRef = useRef<Record<string, Trail>>({});
  const lastSampleRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  // Held by id, not object: every 5s snapshot replaces the train objects, and the
  // popup has to keep tracking the live one under the pointer. `source` says
  // which layer set it, so a leave event from one layer cannot clear a hover
  // another layer just set; x/y is the pointer, for the leave check.
  const [hover, setHover] = useState<{
    id: string;
    source: "train" | "station";
    x: number;
    y: number;
  } | null>(null);

  // Style switches fade through a veil in the incoming basemap's colour: veil
  // up, swap style + overlay palette together underneath, veil down once the
  // new style has drawn. Hides the blank frame and tile pop-in of setStyle.
  const [applied, setApplied] = useState({ styleUrl: targetStyleUrl, theme: targetTheme });
  const { styleUrl, theme } = applied;
  const [veil, setVeil] = useState({ on: false, color: backdropColor });

  useEffect(() => {
    if (targetStyleUrl === applied.styleUrl && targetTheme === applied.theme) return;
    const next = { styleUrl: targetStyleUrl, theme: targetTheme };
    if (!mapReady || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setApplied(next);
      return;
    }
    setVeil({ on: true, color: backdropColor });
    const id = setTimeout(() => setApplied(next), VEIL_IN_MS);
    return () => clearTimeout(id);
  }, [targetStyleUrl, targetTheme]);

  useEffect(() => {
    if (!veil.on) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const reveal = () => setVeil((v) => ({ ...v, on: false }));
    map.once("idle", reveal);
    const id = setTimeout(reveal, VEIL_MAX_WAIT_MS);
    return () => {
      map.off("idle", reveal);
      clearTimeout(id);
    };
    // Re-armed per applied style only; veil.on is read, not tracked.
  }, [styleUrl]);

  const t = MAP_THEME[theme];
  // Read by addBuildings, which runs from a style.load listener bound once.
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // ~30fps animation clock for dead-reckoned train movement
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last > 33) {
        last = now;
        setTick(now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused]);
  void tick;

  // 3D buildings on top of the vector tiles the style already loads
  // (OpenMapTiles schema `building` layer). Re-added on every style load.
  const addBuildings = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || map.getLayer("3d-buildings")) return;
    // Liberty ships its own extrusion; two coincident ones z-fight, so ours wins.
    if (map.getLayer("building-3d")) map.setLayoutProperty("building-3d", "visibility", "none");
    const style = map.getStyle();
    const sourceId = Object.keys(style.sources).find(
      (k) => (style.sources[k] as { type?: string }).type === "vector",
    );
    if (!sourceId) return;
    const th = MAP_THEME[themeRef.current];
    map.addLayer({
      id: "3d-buildings",
      source: sourceId,
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 13.5,
      paint: {
        "fill-extrusion-color": th.buildingColor,
        "fill-extrusion-height": [
          "coalesce",
          ["get", "render_height"],
          ["get", "height"],
          8,
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["get", "render_min_height"],
          ["get", "min_height"],
          0,
        ],
        "fill-extrusion-opacity": th.buildingOpacity,
      },
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapReady || !focusStation) return;
    const { longitude, latitude } = focusStation.station;
    map.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15.2), pitch: 50, duration: 1800, essential: true });
  }, [focusStation, mapReady]);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    setMapReady(true);
    map.on("style.load", addBuildings);
    addBuildings();
    if (!introDone.current) {
      introDone.current = true;
      map.flyTo({ ...INTRO_END, duration: 3200, essential: true });
      map.once("moveend", () => setZoom(map.getZoom()));
    }
  }, [addBuildings]);

  const lineColor = useMemo(() => {
    const m: Record<string, [number, number, number]> = {};
    lines.forEach((l) => (m[l.id] = hexToRgb(l.color)));
    return m;
  }, [lines]);

  // Trains ride a shaded copy of the palette; the painted rails keep `lineColor`
  // untouched. Darkening both would move them together and cost the train the
  // contrast this is buying — the rails staying pale is what it reads against.
  const trainColor = useMemo(() => {
    const m: Record<string, [number, number, number]> = {};
    Object.entries(lineColor).forEach(([id, rgb]) => {
      m[id] = shade(rgb, t.trainShade, t.trainShadeSkipLuminance);
    });
    return m;
  }, [lineColor, t.trainShade, t.trainShadeSkipLuminance]);

  // Flattened so the four line tiers each draw one quad per stretch of rail.
  // Within one line the backend has already merged shared stretches; across
  // lines we offset onto each line's canonical lane (see laneRefs) so trains
  // and painted rails share the same side of the corridor.
  const tracks = useMemo<Track[]>(
    () => {
      const rank = (id: string) => {
        const i = LINE_DRAW_ORDER.indexOf(id);
        return i === -1 ? LINE_DRAW_ORDER.length : i;
      };
      return [...lines]
        .sort((a, b) => rank(a.id) - rank(b.id))
        .flatMap((l) => {
          const color = lineColor[l.id] ?? hexToRgb(l.color);
          const paths = l.tracks?.length ? l.tracks : [l.shape];
          const ref = laneRefs[l.id];
          return paths.map((path) => ({
            line: l.id,
            path: ref
              ? offsetPathLikeReference(path as [number, number][], ref.raw, ref.offset)
              : (path as [number, number][]),
            color,
          }));
        });
    },
    [lines, lineColor, laneRefs],
  );

  const nowMs = Date.now();
  const positioned: PositionedTrain[] = trains
    .filter((tr) => visibleLines.includes(tr.line))
    .map((tr) => {
      const shape = shapes[tr.shape_id];
      const head = currentDistance(tr, nowMs);
      const offsetM = laneRefs[tr.line]?.offsetM ?? 0;
      // Same canonical lane as painted tracks (not an independent shape offset).
      const drawn = shape ? laneShape(tr.line, tr.shape_id, shape) : null;
      const path = drawn
        ? pathBetween(drawn, head - TRAIN_LENGTH_M, head)
        : offsetM
          ? [offsetLonLatMeters(tr.longitude, tr.latitude, tr.bearing, offsetM)]
          : ([[tr.longitude, tr.latitude]] as [number, number][]);
      const mid = head - TRAIN_LENGTH_M / 2;
      const [lon, lat, bearing] = drawn
        ? pointAt(drawn, mid)
        : offsetM
          ? [...offsetLonLatMeters(tr.longitude, tr.latitude, tr.bearing, offsetM), tr.bearing]
          : [tr.longitude, tr.latitude, tr.bearing];
      return {
        ...tr,
        path,
        head,
        center: [lon, lat] as [number, number],
        angle: angleForBearing(bearing),
        color: trainColor[tr.line] ?? [255, 255, 255],
      };
    });

  // Fading motion trails: record each train's head position every
  // TRAIL_MIN_STEP_M of track it covers (see the constant for why not by clock)
  const trailNow = (nowMs - TRAIL_EPOCH_MS) / 1000;
  if (nowMs - lastSampleRef.current > TRAIL_SAMPLE_MS) {
    // Frames stopped (background tab): every trail's last sample is stale.
    if (lastSampleRef.current && nowMs - lastSampleRef.current > TRAIL_MAX_GAP_MS) {
      trailsRef.current = {};
    }
    lastSampleRef.current = nowMs;
    const nowS = trailNow;
    const alive = new Set<string>();
    for (const tr of positioned) {
      alive.add(tr.id);
      let trail = trailsRef.current[tr.id];
      const jumped =
        trail &&
        trail.path.length > 0 &&
        Math.abs(tr.head - trail.lastDist) > TRAIL_MAX_STEP_M;
      if (!trail || trail.shapeId !== tr.shape_id || jumped) {
        trail = trailsRef.current[tr.id] = {
          line: tr.line,
          shapeId: tr.shape_id,
          path: [],
          timestamps: [],
          lastDist: -Infinity,
        };
      }
      if (tr.head - trail.lastDist >= TRAIL_MIN_STEP_M) {
        trail.lastDist = tr.head;
        trail.path.push(tr.path[tr.path.length - 1]);
        trail.timestamps.push(nowS);
      }
      while (trail.timestamps.length && trail.timestamps[0] < nowS - TRAIL_SECONDS) {
        trail.path.shift();
        trail.timestamps.shift();
      }
    }
    for (const id of Object.keys(trailsRef.current)) {
      if (!alive.has(id)) delete trailsRef.current[id];
    }
  }

  // Follow-cam: glide toward the followed train; any manual drag exits
  useEffect(() => {
    if (!followedTrainId) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const stop = () => onStopFollow();
    map.on("dragstart", stop);
    const id = setInterval(() => {
      const tr = trains.find((x) => x.id === followedTrainId);
      if (!tr) {
        onStopFollow();
        return;
      }
      const shape = shapes[tr.shape_id];
      const d = currentDistance(tr, Date.now());
      const offsetM = laneRefs[tr.line]?.offsetM ?? 0;
      const drawn = shape ? laneShape(tr.line, tr.shape_id, shape) : null;
      const [lon, lat] = drawn
        ? pointAt(drawn, d)
        : offsetM
          ? offsetLonLatMeters(tr.longitude, tr.latitude, tr.bearing, offsetM)
          : [tr.longitude, tr.latitude];
      map.easeTo({
        center: [lon, lat],
        zoom: Math.max(map.getZoom(), 14.2),
        duration: 750,
        easing: (x) => x,
      });
    }, 700);
    return () => {
      clearInterval(id);
      map.off("dragstart", stop);
    };
  }, [followedTrainId, trains, shapes, onStopFollow, laneRefs]);

  const visibleTracks = tracks.filter((tk) => visibleLines.includes(tk.line));
  // Stations stay on raw GTFS coords; lane-offset rails would leave them in the
  // gap (Gein). Snap each marker to the average of the nearest point on every
  // visible line it serves so multi-line stops sit on the corridor again.
  const visibleStations = useMemo(() => {
    const byLine: Record<string, Track[]> = {};
    for (const tk of visibleTracks) {
      (byLine[tk.line] ??= []).push(tk);
    }
    return stations
      .filter((s) => s.lines.some((l) => visibleLines.includes(l)))
      .map((s) => {
        const pts: [number, number][] = [];
        for (const lid of s.lines) {
          if (!visibleLines.includes(lid)) continue;
          let best: [number, number] | null = null;
          let bestD = Infinity;
          for (const tk of byLine[lid] ?? []) {
            for (const p of tk.path) {
              const d =
                (p[0] - s.longitude) * (p[0] - s.longitude) +
                (p[1] - s.latitude) * (p[1] - s.latitude);
              if (d < bestD) {
                bestD = d;
                best = p as [number, number];
              }
            }
          }
          if (best) pts.push(best);
        }
        if (!pts.length) return s;
        return {
          ...s,
          longitude: pts.reduce((a, p) => a + p[0], 0) / pts.length,
          latitude: pts.reduce((a, p) => a + p[1], 0) / pts.length,
        };
      });
  }, [stations, visibleTracks, visibleLines]);
  const showLabels = zoom >= 12.8;

  const trailData = Object.values(trailsRef.current).filter(
    (tr) => tr.path.length > 1 && visibleLines.includes(tr.line),
  );

  // Faded train body: fine samples, long cosine dissolve at both tips so the
  // alpha steps are small and the ends do not read as hard caps.
  const bodySegs: TrainBodySeg[] = positioned.flatMap((tr) => {
    const shape = shapes[tr.shape_id];
    const drawn = shape ? laneShape(tr.line, tr.shape_id, shape) : null;
    if (!drawn?.cum.length) return [];
    const end = drawn.cum[drawn.cum.length - 1];
    const peak = tr.head - TRAIN_LENGTH_M / 2;
    const coreLo = peak - TRAIN_CORE_HALF_M;
    const coreHi = peak + TRAIN_CORE_HALF_M;
    const rear = Math.max(0, peak - TRAIN_LENGTH_M / 2 - TRAIN_TAIL_FADE_M);
    const tip = Math.min(end, peak + TRAIN_LENGTH_M / 2 + TRAIN_NOSE_FADE_M);
    if (tip - rear < 20) return [];
    const path = samplePathBetween(drawn, rear, tip, TRAIN_BODY_STEP_M);
    if (path.length < 2) return [];
    const rgb = hotten(tr.color, t.coreWhiten);
    const segs: TrainBodySeg[] = [];
    const weightAt = (d: number): number => {
      if (d >= coreLo && d <= coreHi) return 1;
      let t: number;
      if (d < coreLo) t = (d - rear) / (coreLo - rear || 1);
      else t = (tip - d) / (tip - coreHi || 1);
      t = Math.min(Math.max(t, 0), 1);
      // Cosine ease: flat at the tip, gentle rise — smoother than smoothstep².
      const cosine = 0.5 - 0.5 * Math.cos(Math.PI * t);
      // Extra soft toe so the last metres dissolve almost linearly to 0.
      return cosine * cosine * Math.sqrt(cosine);
    };
    for (let i = 0; i < path.length - 1; i++) {
      const d0 = rear + ((tip - rear) * i) / (path.length - 1);
      const d1 = rear + ((tip - rear) * (i + 1)) / (path.length - 1);
      // Average endpoints so neighbouring segments share a continuous ramp.
      const w = (weightAt(d0) + weightAt(d1)) / 2;
      const alpha = Math.round(255 * w);
      if (alpha < 2) continue;
      segs.push({
        path: [path[i], path[i + 1]],
        color: [...rgb, alpha],
        train: tr,
      });
    }
    return segs;
  });

  const haloParams = t.additiveGlow ? ADDITIVE : FLAT;
  const map = mapRef.current?.getMap();

  // A train at a platform sits under the station's hit target, which wins the
  // pick. Hovering the station brings up that train's popup; a click still
  // opens the departure board. Both directions can be in at once, so take the
  // one nearest the pointer.
  const hoverStation = (info: { object?: unknown; x: number; y: number }) => {
    const station = (info.object as Station | undefined) ?? null;
    onStationHover(station);
    const here = station && map
      ? positioned.filter((tr) => tr.status === "dwelling" && tr.prev_station === station.name)
      : [];
    let best: PositionedTrain | null = null;
    let bestD = Infinity;
    for (const tr of here) {
      const p = map!.project(tr.center);
      const d = Math.hypot(p.x - info.x, p.y - info.y);
      if (d < bestD) {
        bestD = d;
        best = tr;
      }
    }
    if (best) setHover({ id: best.id, source: "station", x: info.x, y: info.y });
    else setHover((h) => (h?.source === "station" ? null : h));
  };

  // Rides the same ~30fps clock as the dead-reckoned movement: `positioned` is
  // a fresh array every frame, so deck.gl re-runs the colour accessor anyway
  // and the pulse costs nothing beyond this one sine.
  const delayedAlpha = Math.min(
    255,
    Math.round(
      t.trainGlowAlpha *
        (1 + DELAY_PULSE_DEPTH * Math.sin((nowMs / DELAY_PULSE_MS) * 2 * Math.PI)),
    ),
  );

  const layers = [
    // Three widening tiers under the line. A PathLayer edge is hard, so a
    // single wide band reads as a translucent ribbon with a visible border;
    // stepping the width up while stepping alpha down turns that border into a
    // gradient and gives the corridor a glow that tints the blocks beside it.
    new PathLayer({
      id: "line-wash",
      data: visibleTracks,
      getPath: (d: Track) => d.path,
      getColor: (d: Track) =>
        [...d.color, t.lineWashAlpha] as [number, number, number, number],
      getWidth: 64,
      widthMinPixels: 15,
      widthMaxPixels: 56,
      capRounded: true,
      jointRounded: true,
      parameters: FLAT,
      updateTriggers: { data: [visibleLines], getColor: [theme] },
    }),

    new PathLayer({
      id: "line-mid",
      data: visibleTracks,
      getPath: (d: Track) => d.path,
      getColor: (d: Track) =>
        [...d.color, t.lineMidAlpha] as [number, number, number, number],
      getWidth: 42,
      widthMinPixels: 11,
      widthMaxPixels: 38,
      capRounded: true,
      jointRounded: true,
      parameters: FLAT,
      updateTriggers: { data: [visibleLines], getColor: [theme] },
    }),

    // soft halo under every line — the classic dark transit-map glow
    new PathLayer({
      id: "line-glow",
      data: visibleTracks,
      getPath: (d: Track) => d.path,
      getColor: (d: Track) =>
        [...d.color, t.glowAlpha] as [number, number, number, number],
      getWidth: 26,
      widthMinPixels: 7,
      widthMaxPixels: 26,
      capRounded: true,
      jointRounded: true,
      parameters: FLAT,
      updateTriggers: { data: [visibleLines], getColor: [theme] },
    }),

    // crisp core line
    new PathLayer({
      id: "line-core",
      data: visibleTracks,
      getPath: (d: Track) => d.path,
      getColor: (d: Track) =>
        [...d.color, t.lineAlpha] as [number, number, number, number],
      getWidth: 5,
      widthMinPixels: 1.5,
      widthMaxPixels: 5,
      capRounded: true,
      jointRounded: true,
      parameters: FLAT,
      updateTriggers: { data: [visibleLines], getColor: [theme] },
    }),

    // One fading trail, not two. A second wide low-alpha pass was meant to read
    // as light spilling off the train; in practice it just fogged the corridor
    // and doubled the overdraw. The tail's shape comes from fadeTrail alone.
    //
    // Deliberately never additive, even on dark. A trail is one long polyline
    // whose segment quads share edges, and additive blending double-counts
    // every shared edge — which shows up as a bright seam at each vertex, a
    // ladder running the length of the tail. The halo below is a single quad
    // per train and has no such self-overlap, so it can still be additive.
    new TripsLayer({
      id: "train-trail",
      data: trailData,
      getPath: (d: Trail) => d.path,
      getTimestamps: (d: Trail) => d.timestamps,
      getColor: (d: Trail) =>
        [...(trainColor[d.line] ?? [255, 255, 255]), t.trailCoreAlpha] as [number, number, number, number],
      currentTime: trailNow,
      trailLength: TRAIL_SECONDS,
      fadeTrail: true,
      getWidth: 14,
      widthMinPixels: 3,
      widthMaxPixels: 11,
      capRounded: true,
      // Mitred, not rounded: a round joint is a disc drawn at every vertex, so
      // rounded joints pile extra coverage on top of the segments they join.
      jointRounded: false,
      parameters: FLAT,
      updateTriggers: { getColor: [theme] },
    }),

    // stations: interchange-style ring + fill (visual only — hit target is later)
    new ScatterplotLayer({
      id: "stations",
      data: visibleStations,
      getPosition: (d: Station) => [d.longitude, d.latitude],
      getRadius: 28,
      radiusMinPixels: 3.5,
      radiusMaxPixels: 9,
      getFillColor: t.stationFill,
      getLineColor: t.stationRing,
      lineWidthMinPixels: 1.5,
      stroked: true,
      parameters: FLAT,
      pickable: false,
      updateTriggers: {
        data: [stations, visibleLines],
        getFillColor: [theme],
        getLineColor: [theme],
      },
    }),

    ...(showLabels
      ? [
          new TextLayer({
            id: "station-labels",
            data: visibleStations,
            getPosition: (d: Station) => [d.longitude, d.latitude],
            getText: (d: Station) => formatPlaceName(d.name),
            getSize: 11.5,
            getColor: t.labelColor,
            getPixelOffset: [0, -16],
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            outlineWidth: 2,
            outlineColor: t.labelHalo,
            fontSettings: { sdf: true },
            parameters: FLAT,
            // Labels are an easy tap target at street zoom.
            pickable: true,
            onHover: hoverStation,
            onClick: (info) => {
              if (info.object) {
                deckPickRef.current = true;
                onStationClick(info.object as Station);
              }
            },
            updateTriggers: {
              data: [stations, visibleLines],
              getColor: [theme],
              outlineColor: [theme],
            },
          }),
        ]
      : []),

    // Train body — bright mid, alpha→0 at rear and nose (both ends fade).
    new PathLayer({
      id: "train-body",
      data: bodySegs,
      getPath: (d: TrainBodySeg) => d.path,
      getColor: (d: TrainBodySeg) => d.color,
      getWidth: 15,
      widthMinPixels: 3.5,
      widthMaxPixels: 11,
      // Flat caps: round caps on near-zero-alpha tips still read as hard pills.
      capRounded: false,
      jointRounded: false,
      parameters: FLAT,
      pickable: true,
      onHover: (info) => {
        const train = (info.object as TrainBodySeg | null)?.train;
        if (train) setHover({ id: train.id, source: "train", x: info.x, y: info.y });
        else setHover((h) => (h?.source === "train" ? null : h));
      },
      onClick: (info) => {
        const seg = info.object as TrainBodySeg | null;
        if (seg?.train) {
          deckPickRef.current = true;
          onTrainClick(seg.train);
        }
      },
      updateTriggers: { getColor: [theme, trailNow] },
    }),

    // Soft bloom only (no opaque core sprite — that was the hard pill).
    new IconLayer({
      id: "train-glow",
      data: positioned,
      iconAtlas: glowSpriteUrl(),
      iconMapping: GLOW_ICON_MAPPING,
      getIcon: () => "glow",
      getPosition: (d: PositionedTrain) => d.center,
      getAngle: (d: PositionedTrain) => d.angle,
      getSize: TRAIN_GLOW_M,
      sizeUnits: "meters",
      sizeMinPixels: 22,
      sizeMaxPixels: 120,
      billboard: false,
      alphaCutoff: 0,
      getColor: (d: PositionedTrain) =>
        [...d.color, d.delay_s > DELAY_THRESHOLD_S ? delayedAlpha : t.trainGlowAlpha] as
          [number, number, number, number],
      parameters: haloParams,
      updateTriggers: { getColor: [theme] },
    }),

    // Invisible station hit targets on top of trains — ~touch-sized so markers
    // stay small but taps/clicks still register (trains no longer steal the hit).
    new ScatterplotLayer({
      id: "stations-hit",
      data: visibleStations,
      getPosition: (d: Station) => [d.longitude, d.latitude],
      getRadius: 55,
      radiusMinPixels: 16,
      radiusMaxPixels: 28,
      getFillColor: [0, 0, 0, 0],
      stroked: false,
      parameters: FLAT,
      pickable: true,
      onHover: hoverStation,
      onClick: (info) => {
        if (info.object) {
          deckPickRef.current = true;
          onStationClick(info.object as Station);
        }
      },
      updateTriggers: { data: [stations, visibleLines] },
    }),
  ];

  // Pinned to the train, not the pointer: it keeps moving under a still cursor,
  // until it has moved POPUP_LEAVE_PX clear of it.
  const hoveredTrain = hover ? positioned.find((tr) => tr.id === hover.id) : undefined;
  const hoverLeft =
    !!hover &&
    (!hoveredTrain ||
      !map ||
      distToPolyline(hover.x, hover.y, hoveredTrain.path.map((p) => map.project(p))) >
        POPUP_LEAVE_PX);
  useEffect(() => {
    if (hoverLeft) setHover(null);
  }, [hoverLeft]);
  const popupTrain =
    (!hoverLeft && hoveredTrain) ||
    (NO_HOVER && followedTrainId ? positioned.find((tr) => tr.id === followedTrainId) : undefined);
  const popupScreen = popupTrain && map ? map.project(popupTrain.center) : null;

  if (webglError) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-gray-950 p-4 text-gray-100 sm:p-8">
        <div className="max-w-lg space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-white">{nl.webglTitle}</h2>
          <p>{webglError}</p>
          <p className="text-gray-400">{nl.webglHint}</p>
          <ol className="list-decimal space-y-2 pl-5 text-gray-300">
            <li>{nl.webglStep1}</li>
            <li>{nl.webglStep2}</li>
            <li>{nl.webglStep3}</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full">
      <Map
        ref={mapRef}
        initialViewState={INTRO_START}
        mapStyle={styleUrl}
        styleDiffing={false}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
        maxPitch={72}
        onLoad={handleLoad}
        onMove={(e) => setZoom(e.viewState.zoom)}
        onMoveEnd={(e) => setZoom(e.viewState.zoom)}
        onClick={() => {
          if (!onMapBackgroundClick) return;
          setTimeout(() => {
            if (!deckPickRef.current) onMapBackgroundClick();
            deckPickRef.current = false;
          }, 0);
        }}
        onError={(e) => setWebglError(e.error?.message ?? "WebGL2 map failed to start")}
      >
        <AttributionControl compact />
        <DeckGLOverlay
          layers={layers}
          pickingRadius={12}
          getCursor={({ isHovering, isDragging }) =>
            isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
          }
        />
      </Map>
      <ChurchMarkers mapRef={mapRef} mapReady={mapReady} theme={theme} />
      {popupTrain && popupScreen && (
        <TrainPopup
          key={popupTrain.id}
          train={popupTrain}
          lineName={lines.find((l) => l.id === popupTrain.line)?.name}
          color={lines.find((l) => l.id === popupTrain.line)?.color ?? "#999999"}
          x={popupScreen.x}
          y={popupScreen.y}
          containerWidth={map?.getContainer().clientWidth ?? 0}
          nowMs={nowMs}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity ease-out"
        style={{
          backgroundColor: veil.color,
          opacity: veil.on ? 1 : 0,
          transitionDuration: `${veil.on ? VEIL_IN_MS : VEIL_OUT_MS}ms`,
        }}
      />
    </div>
  );
}
