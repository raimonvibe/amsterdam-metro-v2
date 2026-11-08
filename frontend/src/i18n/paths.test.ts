import { describe, expect, it } from "vitest";
import { langOfPath, localizedPath, PAGES, pageOfPath, pagePath, stationSlugOfPath } from "./paths";

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

describe("station paths", () => {
  it("reads the station slug from a station page's path", () => {
    expect(stationSlugOfPath("/reisinfo/zuid")).toBe("zuid");
    expect(stationSlugOfPath("/en/reisinfo/bijlmer-arena/")).toBe("bijlmer-arena");
    expect(pageOfPath("/en/reisinfo/zuid")).toBe("/reisinfo");
    expect(localizedPath("/reisinfo/zuid", "en")).toBe("/en/reisinfo/zuid");
  });

  // A decoded "../" or "//host" must never come back out into a link or the
  // address bar (client-side path traversal, open redirect).
  it("rejects anything but letters, digits and dashes", () => {
    for (const p of ["/reisinfo/..%2F..%2Fprivacy", "/reisinfo/%2F%2Fevil.example", "/reisinfo/a%5Cb", "/reisinfo/%E0%A4%A", "/reisinfo/x%3Fy", "/reisinfo/.."]) {
      expect(stationSlugOfPath(p), p).toBeNull();
    }
    expect(localizedPath("/reisinfo/..%2F..%2Fprivacy", "en")).toBe("/en/reisinfo");
    expect(localizedPath("/reisinfo/%2F%2Fevil.example", "nl")).toBe("/reisinfo");
  });
});
