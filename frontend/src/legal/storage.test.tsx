import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyPolicy } from "../components/PrivacyPolicy";
import { BROWSER_STORAGE } from "./storage";

// Vitest runs from frontend/ (jsdom, so no file: import.meta.url).
const SRC = join(process.cwd(), "src");
const ENGLISH_POLICY = readFileSync(join(process.cwd(), "..", "docs", "privacy-policy.md"), "utf8");

/** Every "metro-…" storage key written in the app's code (comments and
 *  tests skipped). */
function keysInCode(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return keysInCode(path);
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .flatMap((line) => [...line.matchAll(/"(metro-[a-z:-]+)"/g)].map((m) => m[1]));
  });
}

describe("browser storage in the privacy policy", () => {
  it("lists every key the code stores, and no key it doesn't", () => {
    const inCode = [...new Set(keysInCode())].sort();
    const listed = BROWSER_STORAGE.map((e) => e.key).sort();
    expect(listed).toEqual(inCode);
  });

  it("names every entry, and each kind of storage, in the Dutch policy", () => {
    const { container } = render(<PrivacyPolicy onClose={() => {}} />);
    const text = container.textContent ?? "";
    for (const entry of BROWSER_STORAGE) {
      expect(text, entry.key).toContain(`${entry.nl} (${entry.store})`);
    }
  });

  it("names every entry, and each kind of storage, in the English policy", () => {
    for (const entry of BROWSER_STORAGE) {
      expect(ENGLISH_POLICY, entry.key).toContain(`${entry.en} (${entry.store})`);
    }
  });

  it("gives the hosting region the servers really run in", () => {
    const { container } = render(<PrivacyPolicy onClose={() => {}} />);
    // Render US West (Oregon): see `dig api.amsterdammetro.nl` → gcp-us-west1.
    // Change both policies, and this test, if the services move region.
    expect(container.textContent).toContain("US West (Oregon, Verenigde Staten)");
    expect(container.textContent).not.toContain("Frankfurt");
    expect(ENGLISH_POLICY).toContain("US West region (Oregon, United States)");
  });
});
