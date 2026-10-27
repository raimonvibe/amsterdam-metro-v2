import { AttributionControl } from "maplibre-gl";

/** MapLibre control buttons by class, and the locale key of their label. */
const CONTROL_LABELS: [selector: string, key: string][] = [
  [".maplibregl-ctrl-zoom-in", "NavigationControl.ZoomIn"],
  [".maplibregl-ctrl-zoom-out", "NavigationControl.ZoomOut"],
  [".maplibregl-ctrl-compass", "NavigationControl.ResetBearing"],
  [".maplibregl-ctrl-attrib-button", "AttributionControl.ToggleAttribution"],
];

/**
 * Give MapLibre's own buttons the labels of the current language. MapLibre
 * reads its `locale` only when the map is created, so after a switch the
 * buttons kept the old words for screen readers and tooltips. Writes only
 * what changed, so calling it on every `idle` costs nothing.
 */
export function relabelControls(container: ParentNode, labels: Record<string, string>): void {
  for (const [selector, key] of CONTROL_LABELS) {
    const label = labels[key];
    if (!label) continue;
    container.querySelectorAll(selector).forEach((el) => {
      if (el.getAttribute("aria-label") !== label) el.setAttribute("aria-label", label);
      if (el.getAttribute("title") !== label) el.setAttribute("title", label);
    });
  }
}

/**
 * MapLibre's compact attribution opens itself on load and stays open until
 * the map is dragged. This one starts folded on every screen size: the ⓘ
 * button opens it.
 */
export function foldedAttribution(): AttributionControl {
  const control = new AttributionControl({ compact: true });
  const update = control._updateCompact;
  // Replaced before `onAdd`, which subscribes this function to map events.
  control._updateCompact = () => {
    const container = control._container;
    const wasCompact = container.classList.contains("maplibregl-compact");
    update();
    if (!wasCompact && container.classList.contains("maplibregl-compact")) {
      container.classList.remove("maplibregl-compact-show");
      container.removeAttribute("open");
    }
  };
  return control;
}
