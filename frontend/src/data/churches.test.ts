import { describe, expect, it } from "vitest";
import { CHURCHES, churchesNear } from "./churches";

const CS = { latitude: 52.3789, longitude: 4.9003 };
const OUDE_KERK = { latitude: 52.3744, longitude: 4.8981 }; // ~0.5 km from CS
const HAARLEMMERMEER = { latitude: 52.3, longitude: 4.75 }; // well outside

describe("churchesNear", () => {
  it("keeps churches near a station and drops those far from all", () => {
    expect(churchesNear([CS], 1.5, [OUDE_KERK, HAARLEMMERMEER])).toEqual([OUDE_KERK]);
  });

  it("draws nothing before the stations have loaded", () => {
    expect(churchesNear([])).toEqual([]);
  });

  it("thins the bundled list to the metro area", () => {
    const near = churchesNear([CS]);
    expect(near.length).toBeGreaterThan(0);
    expect(near.length).toBeLessThan(CHURCHES.length);
  });
});
