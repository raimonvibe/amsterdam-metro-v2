import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../i18n";
import accessibility from "../data/accessibility.json";
import {
  GVB_LIFT_FAULTS,
  LIFT_CHECK,
  LIFT_CHECK_MAX_DAYS,
  gvbSearch,
  liftOutSince,
  shortDate,
  stepFree,
} from "../data/accessibility";
import { StepFree, StepFreeMark } from "./StepFree";

afterEach(() => {
  act(() => setLang("nl", { persist: false }));
  vi.useRealTimers();
});

const DAY = 86_400_000;
const checkedAt = Date.parse(`${LIFT_CHECK}T00:00:00Z`);

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

describe("accessibility.json lift data", () => {
  it("dates the last lift check", () => {
    expect(LIFT_CHECK).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(LIFT_CHECK))).toBe(false);
  });

  it("gives every station a GVB search term without the city", () => {
    for (const [name, e] of Object.entries(accessibility.stations)) {
      expect(e.gvb_search, name).toBeTruthy();
      expect(e.gvb_search, name).not.toMatch(/^(Amsterdam|Diemen|Duivendrecht),/);
    }
  });

  it("marks a lift out only on a station that is not step-free for it", () => {
    for (const [name, e] of Object.entries(accessibility.stations) as [string, { step_free: string; lift_out?: boolean }][]) {
      if (e.lift_out) expect(e.step_free, name).toBe("no");
    }
  });
});

describe("gvbSearch", () => {
  it("uses GVB's spelling, and guesses for a station it does not know", () => {
    expect(gvbSearch("Diemen, Station Diemen Zuid")).toBe("Diemen Zuid");
    expect(gvbSearch("Amsterdam, Weesperplein")).toBe("Weesperplein");
    expect(gvbSearch("Nowhere, Station Atlantis")).toBe("Atlantis");
  });
});

describe("liftOutSince", () => {
  it("dates a known lift fault while the check is fresh, and drops it once stale", () => {
    expect(liftOutSince("Amsterdam, Weesperplein", checkedAt + 3 * DAY)).toBe(LIFT_CHECK);
    expect(liftOutSince("Amsterdam, Weesperplein", checkedAt + (LIFT_CHECK_MAX_DAYS + 1) * DAY)).toBeNull();
    expect(liftOutSince("Amsterdam, De Pijp", checkedAt)).toBeNull();
  });

  it("writes the date short in both languages", () => {
    expect(shortDate("2026-10-29", "nl")).toBe("29 okt");
    expect(shortDate("2026-10-29", "en")).toBe("29 Oct");
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
    const link = screen.getByRole("link", { name: 'Liftstoringen bij GVB: zoek "De Pijp" (kopieert zoekterm)' });
    expect(link).toHaveAttribute("href", GVB_LIFT_FAULTS);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    act(() => setLang("en", { persist: false }));
    expect(screen.getByText("Step-free access")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: 'Lift faults at GVB: search "De Pijp" (copies the search term)' })).toBeInTheDocument();
  });

  it("says a lift is out, with the date of the check, and GVB's search term", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: checkedAt + DAY });
    render(<StepFree station="Diemen, Station Diemen Zuid" />);
    expect(screen.getByText(`Lift buiten gebruik (GVB, ${shortDate(LIFT_CHECK, "nl")})`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Liftstoringen bij GVB: zoek "Diemen Zuid"/ })).toBeInTheDocument();
  });

  it("copies the bare search term when the link is clicked, and survives a refused clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      render(<StepFree station="Diemen, Station Diemen Zuid" />);
      const link = screen.getByRole("link", { name: /Diemen Zuid/ });
      expect(link).toHaveAttribute("title", "kopieert zoekterm");
      await act(async () => fireEvent.click(link));
      expect(writeText).toHaveBeenCalledWith("Diemen Zuid");
      // Hover text never shows on a phone: the card says it copied.
      expect(screen.getByText("Gekopieerd")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent('"Diemen Zuid" gekopieerd');

      writeText.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
      expect(() => fireEvent.click(link)).not.toThrow();
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      expect(() => fireEvent.click(link)).not.toThrow();
    } finally {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    }
  });

  it("falls back to not step-free once the lift check is stale", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: checkedAt + (LIFT_CHECK_MAX_DAYS + 1) * DAY });
    render(<StepFree station="Diemen, Station Diemen Zuid" />);
    expect(screen.getByText("Niet rolstoeltoegankelijk")).toBeInTheDocument();
    expect(screen.queryByText(/Lift buiten gebruik/)).not.toBeInTheDocument();
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
