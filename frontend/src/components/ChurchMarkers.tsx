import { useEffect, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { CHURCHES } from "../data/churches";
import type { Theme } from "../theme";

/** Street-level zoom — same band as follow-cam and 3D buildings. */
const MIN_ZOOM = 14;

interface ChurchMarkersProps {
  mapRef: React.RefObject<MapRef | null>;
  mapReady: boolean;
  theme: Theme;
}

/** HTML overlay above deck.gl — positions sync on map `render` to avoid zoom jitter. */
export function ChurchMarkers({ mapRef, mapReady, theme }: ChurchMarkersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerElsRef = useRef<HTMLDivElement[]>([]);
  const mapRenderedRef = useRef(false);

  // Build marker DOM once; update theme class when it changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!mapReady || !container) return;

    if (markerElsRef.current.length !== CHURCHES.length) {
      for (const el of markerElsRef.current) el.remove();
      markerElsRef.current = CHURCHES.map(() => {
        const el = document.createElement("div");
        el.className = "church-marker";
        el.textContent = "†";
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        el.style.willChange = "transform";
        container.appendChild(el);
        return el;
      });
    }

    const tone = theme === "dark" ? "church-marker-dark" : "church-marker-light";
    for (const el of markerElsRef.current) {
      el.className = `church-marker ${tone}`;
    }
  }, [mapReady, theme]);

  useEffect(() => {
    if (!mapReady) {
      mapRenderedRef.current = false;
      if (containerRef.current) containerRef.current.style.display = "none";
      return;
    }

    const map = mapRef.current?.getMap();
    if (!map) return;

    const sync = () => {
      const container = containerRef.current;
      if (!container || markerElsRef.current.length === 0) return;

      const show = map.getZoom() >= MIN_ZOOM && mapRenderedRef.current;
      container.style.display = show ? "block" : "none";
      if (!show) return;

      for (let i = 0; i < CHURCHES.length; i++) {
        const church = CHURCHES[i];
        const { x, y } = map.project([church.longitude, church.latitude]);
        markerElsRef.current[i].style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      }
    };

    const onIdle = () => {
      mapRenderedRef.current = true;
      sync();
    };
    const onStyleLoad = () => {
      mapRenderedRef.current = false;
      sync();
    };

    map.on("render", sync);
    map.on("idle", onIdle);
    map.on("style.load", onStyleLoad);
    sync();

    return () => {
      map.off("render", sync);
      map.off("idle", onIdle);
      map.off("style.load", onStyleLoad);
    };
  }, [mapReady, mapRef]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ display: "none" }}
      aria-hidden
    />
  );
}
