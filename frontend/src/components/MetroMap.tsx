import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, useControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import { MapboxOverlay, MapboxOverlayProps } from "@deck.gl/mapbox";
import { PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { AnimatedTrain, Line, ShapeGeom, Station } from "../types";
import { currentPosition } from "../animate";
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
  onTrainHover: (train: AnimatedTrain | null) => void;
  onStationHover: (station: Station | null) => void;
}

const INITIAL_VIEW_STATE = {
  longitude: 4.9041,
  latitude: 52.35,
  zoom: 12.2,
  pitch: 52,
  bearing: -12,
};

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [255, 255, 255];
};

export function MetroMap({
  lines,
  stations,
  trains,
  shapes,
  visibleLines,
  onTrainHover,
  onStationHover,
}: MetroMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [zoom, setZoom] = useState(INITIAL_VIEW_STATE.zoom);
  const [tick, setTick] = useState(0);

  // ~30fps animation clock for dead-reckoned train movement
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 33) {
        last = t;
        setTick(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  void tick;

  // 3D buildings: add a fill-extrusion layer on top of the vector tiles that
  // the dark style already loads (OpenMapTiles schema `building` layer).
  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || map.getLayer("3d-buildings")) return;
    const style = map.getStyle();
    const sourceId = Object.keys(style.sources).find(
      (k) => (style.sources[k] as { type?: string }).type === "vector",
    );
    if (!sourceId) return;
    map.addLayer({
      id: "3d-buildings",
      source: sourceId,
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 13.5,
      paint: {
        "fill-extrusion-color": "#2a2f3a",
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
        "fill-extrusion-opacity": 0.75,
      },
    });
  }, []);

  const nowMs = Date.now();
  const visibleTrains = trains.filter((t) => visibleLines.includes(t.line));
  const positioned = visibleTrains.map((t) => {
    const [lon, lat, bearing] = currentPosition(t, shapes, nowMs);
    return { ...t, lon, lat, bearing };
  });

  const lineColor = useMemo(() => {
    const m: Record<string, [number, number, number]> = {};
    lines.forEach((l) => (m[l.id] = hexToRgb(l.color)));
    return m;
  }, [lines]);

  const showLabels = zoom >= 12.8;

  const layers = [
    new PathLayer({
      id: "metro-lines",
      data: lines.filter((l) => visibleLines.includes(l.id)),
      getPath: (d: Line) => d.shape,
      getColor: (d: Line) => [...hexToRgb(d.color), 165] as [number, number, number, number],
      getWidth: 5,
      widthMinPixels: 2,
      widthMaxPixels: 7,
      capRounded: true,
      jointRounded: true,
      updateTriggers: { data: [visibleLines] },
    }),

    new ScatterplotLayer({
      id: "stations",
      data: stations.filter((s) => s.lines.some((l) => visibleLines.includes(l))),
      getPosition: (d: Station) => [d.longitude, d.latitude],
      getRadius: 22,
      radiusMinPixels: 2.5,
      radiusMaxPixels: 6,
      getFillColor: [235, 235, 245, 230],
      getLineColor: [20, 22, 28, 255],
      lineWidthMinPixels: 1,
      stroked: true,
      pickable: true,
      onHover: (info) => onStationHover((info.object as Station) || null),
      updateTriggers: { data: [stations, visibleLines] },
    }),

    ...(showLabels
      ? [
          new TextLayer({
            id: "station-labels",
            data: stations.filter((s) => s.lines.some((l) => visibleLines.includes(l))),
            getPosition: (d: Station) => [d.longitude, d.latitude],
            getText: (d: Station) => d.name.replace(/^Amsterdam, /, ""),
            getSize: 11,
            getColor: [200, 205, 215, 220],
            getPixelOffset: [0, -14],
            fontFamily: "system-ui, sans-serif",
            outlineWidth: 2,
            outlineColor: [10, 12, 16, 255],
            fontSettings: { sdf: true },
            updateTriggers: { data: [stations, visibleLines] },
          }),
        ]
      : []),

    new ScatterplotLayer({
      id: "trains",
      data: positioned,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: 42,
      radiusMinPixels: 5,
      radiusMaxPixels: 12,
      getFillColor: (d) => [...(lineColor[d.line] ?? [255, 255, 255]), 255] as [number, number, number, number],
      getLineColor: [10, 12, 16, 255],
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      onHover: (info) => onTrainHover((info.object as AnimatedTrain) || null),
    }),
  ];

  return (
    <div className="h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://tiles.openfreemap.org/styles/dark"
        style={{ width: "100%", height: "100%" }}
        maxPitch={72}
        onLoad={handleLoad}
        onMove={(e) => setZoom(e.viewState.zoom)}
      >
        <DeckGLOverlay layers={layers} />
      </Map>
    </div>
  );
}
