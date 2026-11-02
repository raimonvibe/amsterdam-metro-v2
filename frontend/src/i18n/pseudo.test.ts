import { describe, expect, it } from "vitest";
import { nl } from "./nl";
import { pseudoDict, pseudoText } from "./pseudo";

describe("pseudo-language", () => {
  it("makes text ~40% longer and marks its ends", () => {
    const out = pseudoText("Vertrektijden");
    expect(out).toMatch(/^⟦Vërtrëktïjdëñ[· ]+⟧$/);
    expect(out.length).toBeGreaterThanOrEqual(Math.ceil("Vertrektijden".length * 1.4));
    expect(pseudoText("")).toBe("");
    // The padding wraps like words do.
    expect(pseudoText("x".repeat(40))).toMatch(/····· ····· /);
  });

  it("keeps every key, and runs strings that functions return through it", () => {
    const dict = pseudoDict(nl);
    expect(Object.keys(dict)).toEqual(Object.keys(nl));
    expect(dict.appName).toMatch(/^⟦.+⟧$/);
    expect(dict.alertsCount(2)).toMatch(/^⟦2 mëldïñgëñ[· ]+⟧$/);
    // Nested groups too, like the travel page's tab labels.
    expect(pseudoDict({ tabs: { plannen: "Plannen" } }).tabs.plannen).toMatch(/^⟦Pláññëñ[· ]+⟧$/);
  });
});
