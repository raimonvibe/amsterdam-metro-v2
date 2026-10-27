import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../i18n";
import accessibility from "../data/accessibility.json";
import { GVB_LIFT_FAULTS, stepFree } from "../data/accessibility";
import { StepFree, StepFreeMark } from "./StepFree";

afterEach(() => act(() => setLang("nl", { persist: false })));

describe("accessibility.json", () => {
  it("gives every station a known state and source", () => {
    const entries = Object.entries(accessibility.stations);
    expect(entries.length).toBeGreaterThanOrEqual(39);
    for (const [name, e] of entries) {
      expect(["yes", "limited", "no", "unknown"], name).toContain(e.step_free);
      expect(["osm", "checked"], name).toContain(e.source);
    }
  });
});

describe("stepFree", () => {
  it("reads a station's state and calls a station it does not know unknown", () => {
    expect(stepFree("Amsterdam, Strandvliet")).toBe("no");
    expect(stepFree("Amsterdam, Rokin")).toBe("yes");
    expect(stepFree("Nowhere, Atlantis")).toBe("unknown");
  });
});

describe("StepFree", () => {
  it("says the state in Dutch and English and links GVB's lift faults", () => {
    render(<StepFree station="Amsterdam, Rokin" />);
    expect(screen.getByText("Rolstoeltoegankelijk")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Liftstoringen bij GVB" });
    expect(link).toHaveAttribute("href", GVB_LIFT_FAULTS);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    act(() => setLang("en", { persist: false }));
    expect(screen.getByText("Step-free access")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lift faults at GVB" })).toBeInTheDocument();
  });

  it("marks only step-free stations in lists", () => {
    const { container } = render(
      <>
        <StepFreeMark station="Amsterdam, Rokin" />
        <StepFreeMark station="Amsterdam, Strandvliet" />
        <StepFreeMark station="Nowhere, Atlantis" />
      </>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.getByText("Rolstoeltoegankelijk")).toHaveClass("sr-only");
  });

  it("says when it does not know", () => {
    render(<StepFree station="Nowhere, Atlantis" />);
    expect(screen.getByText("Toegankelijkheid onbekend")).toBeInTheDocument();
  });
});
