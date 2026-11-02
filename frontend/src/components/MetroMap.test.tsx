import { act, render } from "@testing-library/react";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAP_STYLES } from "../theme";
import { BUILDINGS_FALLBACK_MS, MetroMap } from "./MetroMap";

/**
 * The 3D buildings must come on every full-quality map. Since #187 they wait
 * for the map's first "idle", which a moving camera can put off forever;
 * these tests run MetroMap against a fake MapLibre map whose "idle" fires
 * only when a test says so. jsdom has no WebGL, so react-map-gl and deck.gl
 * are stand-ins and the WebGL check says yes.
 */

type Listener = (...args: unknown[]) => void;

/** The MapLibre calls MetroMap makes, keeping the layers it adds. */
function fakeMap() {
  const layers = new Map<string, { layout?: { visibility?: string } }>();
  const listeners = new Map<string, Set<Listener>>();
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const map = {
    layers,
    on: (type: string, l: Listener) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(l),
    once(type: string, l: Listener) {
      const wrapped: Listener = (...a) => {
        map.off(type, wrapped);
        l(...a);
      };
      map.on(type, wrapped);
      // MetroMap removes a once-listener by the function it passed.
      (l as Listener & { wrapped?: Listener }).wrapped = wrapped;
    },
    off: (type: string, l: Listener) => {
      listeners.get(type)?.delete(l);
      const w = (l as Listener & { wrapped?: Listener }).wrapped;
      if (w) listeners.get(type)?.delete(w);
    },
    fire: (type: string) => [...(listeners.get(type) ?? [])].forEach((l) => l()),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string; layout?: { visibility?: string } }) => void layers.set(layer.id, layer),
    setLayoutProperty: (id: string, key: string, value: string) => {
      const layer = layers.get(id);
      if (layer && key === "visibility") layer.layout = { ...layer.layout, visibility: value };
    },
    getStyle: () => ({ sources: { openmaptiles: { type: "vector" } } }),
    setSky: () => {},
    jumpTo: () => {},
    flyTo: () => {},
    easeTo: () => {},
    getZoom: () => 12,
    getPixelRatio: () => 1,
    setPixelRatio: () => {},
    getContainer: () => container,
    getCanvas: () => canvas,
    project: () => ({ x: 0, y: 0 }),
  };
  return map;
}

let map: ReturnType<typeof fakeMap>;

vi.mock("../webgl", () => ({ getWebGLStatus: () => ({ ok: true }) }));
vi.mock("@deck.gl/mapbox", () => ({ MapboxOverlay: class { setProps() {} } }));
vi.mock("react-map-gl/maplibre", () => ({
  // Hands MetroMap the fake map, then reports it loaded, as react-map-gl does.
  Map: forwardRef(function FakeMap(props: { onLoad?: () => void; children?: React.ReactNode }, ref) {
    useImperativeHandle(ref, () => ({ getMap: () => map }));
    useEffect(() => props.onLoad?.(), []);
    return <div>{props.children}</div>;
  }),
  useControl: () => ({ setProps() {} }),
  NavigationControl: () => null,
}));

function renderMap(quality: "full" | "lite") {
  return render(
    <MetroMap
      lines={[]}
      stations={[]}
      trains={[]}
      shapes={{}}
      visibleLines={[]}
      theme="dark"
      styleUrl={MAP_STYLES.dark.styleUrl}
      backdropColor="#000"
      followedTrainId={null}
      onStationHover={() => {}}
      onTrainClick={() => {}}
      onStationClick={() => {}}
      onStopFollow={() => {}}
      // No animation clock: nothing here moves, and it would spin the fake timers.
      paused
      quality={quality}
    />,
  );
}

const buildings = () => map.layers.get("3d-buildings");

beforeEach(() => {
  vi.useFakeTimers();
  map = fakeMap();
});
afterEach(() => vi.useRealTimers());

describe("MetroMap 3D buildings", () => {
  it("come in full quality when the map never goes idle", () => {
    renderMap("full");
    expect(buildings()).toBeUndefined(); // first view first
    act(() => vi.advanceTimersByTime(BUILDINGS_FALLBACK_MS));
    expect(buildings()).toBeDefined();
    expect(buildings()!.layout?.visibility).toBe("visible");
  });

  it("come on the first idle, without waiting for the timeout", () => {
    renderMap("full");
    act(() => map.fire("idle"));
    expect(buildings()?.layout?.visibility).toBe("visible");
  });

  it("are added once, whichever comes first", () => {
    const addLayer = vi.spyOn(map, "addLayer");
    renderMap("full");
    act(() => map.fire("idle"));
    act(() => vi.advanceTimersByTime(BUILDINGS_FALLBACK_MS));
    expect(addLayer.mock.calls.filter(([l]) => l.id === "3d-buildings")).toHaveLength(1);
  });

  it("come back after a style switch", () => {
    renderMap("full");
    act(() => vi.advanceTimersByTime(BUILDINGS_FALLBACK_MS));
    map.layers.clear(); // a new style starts without our layers
    act(() => map.fire("style.load"));
    expect(buildings()?.layout?.visibility).toBe("visible");
  });

  it("are there but hidden in lite", () => {
    renderMap("lite");
    expect(buildings()?.layout?.visibility).toBe("none");
  });
});
