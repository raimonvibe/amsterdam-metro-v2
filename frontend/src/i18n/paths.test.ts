import { describe, expect, it } from "vitest";
import { langOfPath, PAGES, pageOfPath, pagePath } from "./paths";

describe("language paths", () => {
  it("reads the language from the /en prefix only", () => {
    expect(langOfPath("/")).toBe("nl");
    expect(langOfPath("/reisinfo")).toBe("nl");
    expect(langOfPath("/en")).toBe("en");
    expect(langOfPath("/en/")).toBe("en");
    expect(langOfPath("/en/reisinfo")).toBe("en");
    // Paths that only start with the letters are Dutch pages.
    expect(langOfPath("/english")).toBe("nl");
    expect(langOfPath("/enx/reisinfo")).toBe("nl");
  });

  it("finds the page behind a path, ignoring the prefix and a trailing slash", () => {
    expect(pageOfPath("/en/reisinfo/")).toBe("/reisinfo");
    expect(pageOfPath("/privacy/")).toBe("/privacy");
    expect(pageOfPath("/en")).toBe("/");
    // Unknown paths show the map.
    expect(pageOfPath("/nope")).toBe("/");
    expect(pageOfPath("/en/nope")).toBe("/");
  });

  it("round-trips every page through both languages", () => {
    for (const page of PAGES) {
      for (const lang of ["nl", "en"] as const) {
        const path = pagePath(page, lang);
        expect(langOfPath(path)).toBe(lang);
        expect(pageOfPath(path)).toBe(page);
      }
    }
    expect(pagePath("/", "en")).toBe("/en/");
    expect(pagePath("/reisinfo", "en")).toBe("/en/reisinfo");
  });
});
