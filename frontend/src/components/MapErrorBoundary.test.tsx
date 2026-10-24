import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapErrorBoundary } from "./MapErrorBoundary";

function Crashing(): never {
  // What deck.gl threw when it read the map mid-restore of a lost context.
  throw new TypeError("Cannot read properties of null (reading 'getProjection')");
}

describe("MapErrorBoundary", () => {
  it("keeps a map crash inside the map and offers a fresh one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onReset = vi.fn();
    render(
      <div>
        <button type="button">Menu</button>
        <MapErrorBoundary onReset={onReset}>
          <Crashing />
        </MapErrorBoundary>
      </div>,
    );
    // The rest of the page survives: before, the whole app went blank.
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("De kaart liep vast.");
    await userEvent.click(screen.getByRole("button", { name: "Kaart opnieuw laden" }));
    expect(onReset).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it("renders the map untouched when nothing goes wrong", () => {
    render(
      <MapErrorBoundary onReset={() => {}}>
        <p>map</p>
      </MapErrorBoundary>,
    );
    expect(screen.getByText("map")).toBeInTheDocument();
  });
});
