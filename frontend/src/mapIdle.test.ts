import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onIdleOrAfter } from "./mapIdle";

/** Enough of a map to fire "idle" by hand. */
function fakeMap() {
  const listeners = new Set<() => void>();
  return {
    once: (_: "idle", l: () => void) => listeners.add(l),
    off: (_: "idle", l: () => void) => listeners.delete(l),
    idle: () => [...listeners].forEach((l) => l()),
    listening: () => listeners.size,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("onIdleOrAfter", () => {
  it("runs on idle, once, and drops its timer", () => {
    const map = fakeMap();
    const fn = vi.fn();
    onIdleOrAfter(map, 2500, fn);
    map.idle();
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledOnce();
  });

  // The 3D buildings waited for "idle" alone; following a train glides the
  // camera every 0.7 s, "idle" never came, and the city stayed flat.
  it("runs after the timeout when idle never comes, and stops listening", () => {
    const map = fakeMap();
    const fn = vi.fn();
    onIdleOrAfter(map, 2500, fn);
    vi.advanceTimersByTime(2499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
    expect(map.listening()).toBe(0);
    map.idle();
    expect(fn).toHaveBeenCalledOnce();
  });
});
