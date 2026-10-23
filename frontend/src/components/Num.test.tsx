import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Num } from "./Num";

describe("Num", () => {
  it("keeps times and minutes out of browser translation", () => {
    render(<><Num>14:05:09</Num><Num>+3 min</Num></>);
    expect(screen.getByText("14:05:09")).toHaveAttribute("translate", "no");
    expect(screen.getByText("+3 min")).toHaveAttribute("translate", "no");
  });

  it("leaves words without a digit translatable", () => {
    render(<Num>vertrokken</Num>);
    expect(screen.getByText("vertrokken")).not.toHaveAttribute("translate");
  });
});
