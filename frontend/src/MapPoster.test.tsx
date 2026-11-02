import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STATIONS } from "./test/fixtures";
import { MAP_STYLES } from "./theme";

// A browser that draws WebGL without a graphics chip (SwiftShader, llvmpipe).
vi.mock("./quality", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./quality")>()),
  softwareGL: () => true,
}));
const mapRendered = vi.fn();
vi.mock("./components/hover", () => ({ NO_HOVER: false }));
vi.mock("./components/MetroMap", () => ({
  MetroMap: () => {
    mapRendered();
    return <div data-testid="live-map" />;
  },
}));
vi.mock("./components/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("./components/LiveBadge", () => ({ LiveBadge: () => null }));
vi.mock("./stream", () => ({ streamWhileVisible: () => () => {} }));
vi.mock("./api", () => ({
  fetchLines: vi.fn().mockResolvedValue([]),
  fetchStations: vi.fn(async () => STATIONS),
  fetchShapes: vi.fn().mockResolvedValue({}),
}));

afterEach(async () => {
  (await import("./quality")).setQualityPref("auto");
  mapRendered.mockClear();
  localStorage.clear();
  vi.resetModules();
});

describe("without a graphics chip", () => {
  it("opens on a still of the 3D map, and starts the live map on request", async () => {
    const { default: App } = await import("./App");
    render(<App />);
    const still = screen.getByRole("img", { name: /3D-kaart van Amsterdam/ });
    expect(still).toHaveAttribute("src", "/poster/liberty-landscape.webp");
    expect(still.closest("picture")?.querySelector("source")).toHaveAttribute("srcset", "/poster/liberty-portrait.webp");
    expect(mapRendered).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Live 3D-kaart starten" }));
    expect(await screen.findByTestId("live-map")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /3D-kaart van Amsterdam/ })).not.toBeInTheDocument();
  });

  it("shows the live map straight away to a visitor who chose Full or Light", async () => {
    (await import("./quality")).setQualityPref("lite");
    const { default: App } = await import("./App");
    render(<App />);
    await waitFor(() => expect(screen.getByTestId("live-map")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Live 3D-kaart starten" })).not.toBeInTheDocument();
  });
});

describe("preview stills", () => {
  it("exist for every map style, landscape and portrait, and stay small", () => {
    for (const style of Object.keys(MAP_STYLES)) {
      for (const shape of ["landscape", "portrait"]) {
        const path = join(process.cwd(), "public", "poster", `${style}-${shape}.webp`);
        expect(existsSync(path), `${style}-${shape}`).toBe(true);
        // It's the first thing a slow device paints: keep each under 400 KB.
        expect(statSync(path).size, `${style}-${shape}`).toBeLessThan(400_000);
      }
    }
  });
});
