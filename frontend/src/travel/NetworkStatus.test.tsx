import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimatedTrain, Line, ServiceAlert } from "../types";
import { NetworkStatus } from "./NetworkStatus";

const line = (id: string): Line => ({ id, name: `${id} - Eind`, color: "#999", shape: [] }) as unknown as Line;
const train = (id: string, lineId: string, delay_s: number): AnimatedTrain =>
  ({ id, line: lineId, delay_s, realtime: true, fetchedAt: 0 }) as unknown as AnimatedTrain;

function barOf(lineId: string): HTMLElement {
  const row = document.querySelector(`button[title="${lineId} - Eind"]`)!.closest("tr")!;
  return row.querySelector("[aria-hidden] > span") as HTMLElement;
}

describe("NetworkStatus", () => {
  const lines = [line("52"), line("53")];
  // Both lines run at 50%: two of four trains a minute or more late.
  const trains = ["52", "53"].flatMap((l) => [0, 0, 90, 90].map((d, i) => train(`${l}-${i}`, l, d)));
  const fault: ServiceAlert = {
    id: "a", header: { nl: "Rituitval M52", en: "M52 trips cancelled" }, lines: ["52"], stations: [], effect: "REDUCED_SERVICE",
  };

  it("keeps red for a line with a GVB fault, not for late trains", () => {
    render(<NetworkStatus lines={lines} trains={trains} status={null} onLine={() => {}} alerts={[fault]} />);
    expect(barOf("52").className).toContain("bg-[#b42335]");
    expect(barOf("53").className).toContain("bg-amber-500");
    expect(barOf("53").className).not.toContain("bg-[#b42335]");
    expect(screen.getAllByLabelText("Storingsmelding van GVB")).toHaveLength(1);
  });

  it("shows no red at all without a fault", () => {
    render(<NetworkStatus lines={lines} trains={trains} status={null} onLine={() => {}} />);
    expect(barOf("52").className).not.toContain("bg-[#b42335]");
    expect(screen.queryByLabelText("Storingsmelding van GVB")).toBeNull();
  });
});
