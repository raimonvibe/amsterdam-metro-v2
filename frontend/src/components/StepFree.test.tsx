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

  it("calls a station step-free only once it is checked on GVB's site; the rest are not", () => {
    for (const [name, e] of Object.entries(accessibility.stations)) {
      if (e.source !== "checked") expect(e.step_free, name).toBe("no");
      expect(["yes", "no"], name).toContain(e.step_free);
    }
  });
});

describe("stepFree", () => {
  it("reads a station's state and calls a station it does not know not step-free", () => {
    expect(stepFree("Amsterdam, Strandvliet")).toBe("no");
    expect(stepFree("Amsterdam, De Pijp")).toBe("yes");
    expect(stepFree("Nowhere, Atlantis")).toBe("no");
  });
});

describe("StepFree", () => {
  it("says the state in Dutch and English and links GVB's lift faults", () => {
    render(<StepFree station="Amsterdam, De Pijp" />);
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
        <StepFreeMark station="Amsterdam, De Pijp" />
        <StepFreeMark station="Amsterdam, Strandvliet" />
        <StepFreeMark station="Nowhere, Atlantis" />
      </>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.getByText("Rolstoeltoegankelijk")).toHaveClass("sr-only");
  });

  it("says not step-free for a station it does not know", () => {
    render(<StepFree station="Nowhere, Atlantis" />);
    expect(screen.getByText("Niet rolstoeltoegankelijk")).toBeInTheDocument();
  });
});
