import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setQualityPref } from "../quality";

// jsdom has no matchMedia; the map module reads it when it loads.
vi.hoisted(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
import { MetroMap } from "./MetroMap";
import { QualitySwitch } from "./QualitySwitch";

afterEach(() => setQualityPref("auto"));

describe("3D switch", () => {
  it("starts on Auto, stores Full or Light, and forgets the choice on Auto", async () => {
    render(<QualitySwitch quality="full" />);
    const group = screen.getByRole("radiogroup", { name: "3D-weergave" });
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
    expect(group).toHaveAccessibleDescription(/Volledig: 3D-gebouwen/);

    await userEvent.click(screen.getByRole("radio", { name: "Licht" }));
    expect(screen.getByRole("radio", { name: "Licht" })).toBeChecked();
    expect(localStorage.getItem("metro-live:3d")).toBe("lite");

    await userEvent.click(screen.getByRole("radio", { name: "Auto" }));
    expect(localStorage.getItem("metro-live:3d")).toBeNull();
  });

  it("moves with the arrow keys, like the map styles", async () => {
    render(<QualitySwitch quality="full" />);
    screen.getByRole("radio", { name: "Auto" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Volledig" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Volledig" })).toHaveFocus();
  });

  it("says why when Auto picked Light, so the plainer map isn't taken for a fault", () => {
    const { rerender } = render(<QualitySwitch quality="full" />);
    expect(screen.queryByText(/Licht gekozen/)).not.toBeInTheDocument();
    rerender(<QualitySwitch quality="lite" />);
    expect(screen.getByText(/Licht gekozen/)).toBeInTheDocument();
  });
});

describe("map without WebGL", () => {
  it("leads to the travel page, with how to turn WebGL on folded away", async () => {
    // jsdom has no WebGL, like a browser or crawler without it.
    const onOpenTravel = vi.fn();
    render(
      <MetroMap
        lines={[]}
        stations={[]}
        trains={[]}
        shapes={{}}
        visibleLines={[]}
        theme="dark"
        styleUrl=""
        backdropColor="#000"
        followedTrainId={null}
        onStationHover={() => {}}
        onTrainClick={() => {}}
        onStationClick={() => {}}
        onStopFollow={() => {}}
        onOpenTravel={onOpenTravel}
      />,
    );
    expect(screen.getByText(/werken ook zonder 3D-kaart/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Reisinformatie/ }));
    expect(onOpenTravel).toHaveBeenCalled();
    expect(screen.getByText("Zo zet u WebGL2 aan").closest("details")).not.toHaveAttribute("open");
  });
});
