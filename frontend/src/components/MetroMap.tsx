import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, useControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import { MapboxOverlay, MapboxOverlayProps } from "@deck.gl/mapbox";
import { PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { AnimatedTrain, Line, ShapeGeom, Station } from "../types";
import { currentDistance, pathBetween, pointAt } from "../animate";
import { MAP_THEME, Theme } from "../theme";
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
  theme: Theme;
  followedTrainId: string | null;
  onTrainHover: (train: AnimatedTrain | null) => void;
  onStationHover: (station: Station | null) => void;
  onTrainClick: (train: AnimatedTrain) => void;
  onStationClick: (station: Station) => void;
  onStopFollow: () => void;
}

/** Amsterdam metro trainsets are ~90-116m; 100m reads well at city zoom. */
const TRAIN_LENGTH_M = 100;
const DELAY_THRESHOLD_S = 120;
const TRAIL_SECONDS = 25;
const TRAIL_SAMPLE_MS = 700;

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

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [255, 255, 255];
};

interface PositionedTrain extends AnimatedTrain {
  path: [number, number][];
  color: [number, number, number];
}

interface Trail {
  line: string;
  path: [number, number][];
  timestamps: number[];
}

export function MetroMap({
  lines,
  stations,
  trains,
  shapes,
  visibleLines,
  theme,
  followedTrainId,
  onTrainHover,
  onStationHover,
  onTrainClick,
  onStationClick,
  onStopFollow,
}: MetroMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [zoom, setZoom] = useState(INTRO_START.zoom);
  const [tick, setTick] = useState(0);
  const introDone = useRef(false);
  const trailsRef = useRef<Record<string, Trail>>({});
  const lastSampleRef = useRef(0);
  const t = MAP_THEME[theme];

  // ~30fps animation clock for dead-reckoned train movement
  useEffect(() => {
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
  }, []);
  void tick;

  // 3D buildings on top of the vector tiles the style already loads
  // (OpenMapTiles schema `building` layer). Re-added on every style load.
  const addBuildings = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || map.getLayer("3d-buildings")) return;
    const style = map.getStyle();
    const sourceId = Object.keys(style.sources).find(
      (k) => (style.sources[k] as { type?: string }).type === "vector",
    );
    if (!sourceId) return;
    const th = MAP_THEME[document.documentElement.classList.contains("dark") ? "dark" : "light"];
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

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.on("style.load", addBuildings);
    addBuildings();
    if (!introDone.current) {
      introDone.current = true;
      map.flyTo({ ...INTRO_END, duration: 3200, essential: true });
    }
  }, [addBuildings]);

  const lineColor = useMemo(() => {
    const m: Record<string, [number, number, number]> = {};
    lines.forEach((l) => (m[l.id] = hexToRgb(l.color)));
    return m;
  }, [lines]);

  const nowMs = Date.now();
  const positioned: PositionedTrain[] = trains
    .filter((tr) => visibleLines.includes(tr.line))
    .map((tr) => {
      const shape = shapes[tr.shape_id];
      const head = currentDistance(tr, nowMs);
      const path = shape
        ? pathBetween(shape, head - TRAIN_LENGTH_M, head)
        : ([[tr.longitude, tr.latitude]] as [number, number][]);
      return { ...tr, path, color: lineColor[tr.line] ?? [255, 255, 255] };
    });

  // Fading motion trails: sample each train's head position on a slow clock
  if (nowMs - lastSampleRef.current > TRAIL_SAMPLE_MS) {
    lastSampleRef.current = nowMs;
    const nowS = nowMs / 1000;
    const alive = new Set<string>();
    for (const tr of positioned) {
      alive.add(tr.id);
      const head = tr.path[tr.path.length - 1];
      const trail = (trailsRef.current[tr.id] ??= {
        line: tr.line,
        path: [],
        timestamps: [],
      });
      trail.path.push(head);
      trail.timestamps.push(nowS);
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
      const [lon, lat] = shape ? pointAt(shape, d) : [tr.longitude, tr.latitude];
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
  }, [followedTrainId, trains, shapes, onStopFollow]);

  const visibleLineData = lines.filter((l) => visibleLines.includes(l.id));
  const visibleStations = stations.filter((s) =>
    s.lines.some((l) => visibleLines.includes(l)),
  );
  const showLabels = zoom >= 12.8;

  const trailData = Object.values(trailsRef.current).filter(
    (tr) => tr.path.length > 1 && visibleLines.includes(tr.line),
  );

  const layers = [
    // soft halo under every line — the classic dark transit-map glow
    new PathLayer({
      id: "line-glow",
      data: visibleLineData,
      getPath: (d: Line) => d.shape,
      getColor: (d: Line) =>
        [...hexToRgb(d.color), t.glowAlpha] as [number, number, number, number],
      getWidth: 26,
      widthMinPixels: 7,
      widthMaxPixels: 26,
      capRounded: true,
      jointRounded: true,
      updateTriggers: { data: [visibleLines], getColor: [theme] },
    }),

    // crisp core line
    new PathLayer({
      id: "line-core",
      data: visibleLineData,
      getPath: (d: Line) => d.shape,
      getColor: (d: Line) =>
        [...hexToRgb(d.color), t.lineAlpha] as [number, number, number, number],
      getWidth: 5,
      widthMinPixels: 1.5,
      widthMaxPixels: 5,
      capRounded: true,
      jointRounded: true,
      updateTriggers: { data: [visibleLines], getColor: [theme] },
    }),

    // fading movement trails behind trains
    new TripsLayer({
      id: "train-trails",
      data: trailData,
      getPath: (d: Trail) => d.path,
      getTimestamps: (d: Trail) => d.timestamps,
      getColor: (d: Trail) =>
        [...(lineColor[d.line] ?? [255, 255, 255]), 160] as [number, number, number, number],
      currentTime: nowMs / 1000,
      trailLength: TRAIL_SECONDS,
      fadeTrail: true,
      getWidth: 14,
      widthMinPixels: 3,
      widthMaxPixels: 12,
      capRounded: true,
      jointRounded: true,
      updateTriggers: { getColor: [theme] },
    }),

    // stations: interchange-style ring + fill
    new ScatterplotLayer({
      id: "stations",
      data: visibleStations,
      getPosition: (d: Station) => [d.longitude, d.latitude],
      getRadius: 26,
      radiusMinPixels: 2.5,
      radiusMaxPixels: 7,
      getFillColor: t.stationFill,
      getLineColor: t.stationRing,
      lineWidthMinPixels: 1.5,
      stroked: true,
      pickable: true,
      onHover: (info) => onStationHover((info.object as Station) || null),
      onClick: (info) => {
        if (info.object) onStationClick(info.object as Station);
      },
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
            getText: (d: Station) => d.name.replace(/^Amsterdam, /, ""),
            getSize: 11.5,
            getColor: t.labelColor,
            getPixelOffset: [0, -16],
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            outlineWidth: 2,
            outlineColor: t.labelHalo,
            fontSettings: { sdf: true },
            updateTriggers: {
              data: [stations, visibleLines],
              getColor: [theme],
              outlineColor: [theme],
            },
          }),
        ]
      : []),

    // train halo — amber when running late, line-colored otherwise
    new PathLayer({
      id: "train-glow",
      data: positioned,
      getPath: (d: PositionedTrain) => d.path,
      getColor: (d: PositionedTrain) =>
        d.delay_s > DELAY_THRESHOLD_S
          ? ([251, 191, 36, t.trainGlowAlpha + 40] as [number, number, number, number])
          : ([...d.color, t.trainGlowAlpha] as [number, number, number, number]),
      getWidth: 38,
      widthMinPixels: 10,
      widthMaxPixels: 34,
      capRounded: true,
      jointRounded: true,
      updateTriggers: { getColor: [theme] },
    }),

    // train body: a pill riding the track, slightly wider than the line
    new PathLayer({
      id: "train-outline",
      data: positioned,
      getPath: (d: PositionedTrain) => d.path,
      getColor: t.trainOutline,
      getWidth: 15,
      widthMinPixels: 5.5,
      widthMaxPixels: 14,
      capRounded: true,
      jointRounded: true,
      updateTriggers: { getColor: [theme] },
    }),
    new PathLayer({
      id: "train-body",
      data: positioned,
      getPath: (d: PositionedTrain) => d.path,
      getColor: (d: PositionedTrain) =>
        [...d.color, 255] as [number, number, number, number],
      getWidth: 10,
      widthMinPixels: 3.5,
      widthMaxPixels: 10,
      capRounded: true,
      jointRounded: true,
      pickable: true,
      onHover: (info) => onTrainHover((info.object as AnimatedTrain) || null),
      onClick: (info) => {
        if (info.object) onTrainClick(info.object as AnimatedTrain);
      },
    }),
  ];

  return (
    <div className="h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={INTRO_START}
        mapStyle={t.styleUrl}
        styleDiffing={false}
        style={{ width: "100%", height: "100%" }}
        maxPitch={72}
        onLoad={handleLoad}
        onMove={(e) => setZoom(e.viewState.zoom)}
      >
        <DeckGLOverlay
          layers={layers}
          getCursor={({ isHovering, isDragging }) =>
            isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
          }
        />
      </Map>
    </div>
  );
}
