import { describe, expect, it } from "vitest";
import { travelStrings } from "./strings";
import { setLang } from "../i18n";

/**
 * Hints inside input fields can't wrap: a long one is cut off on a phone.
 * Translated it runs longer still (Bengali took 1.35 times the width of the
 * Dutch). Measured on a 320 px phone, the picker's field has room for ~30
 * Latin characters at 16 px; 22 leaves room for a translation. See
 * docs/browser-translation.md.
 */
const MAX = 22;

describe.each(["nl", "en"] as const)("hints in input fields on a phone (%s)", (lang) => {
  it(`stay within ${MAX} characters`, () => {
    setLang(lang, { persist: false });
    const s = travelStrings();
    for (const [key, hint] of Object.entries({
      searchShort: s.searchShort,
      fromStation: s.fromStation,
      toStation: s.toStation,
      typeOrPick: s.typeOrPick,
    })) {
      expect(hint.length, `${key}: "${hint}"`).toBeLessThanOrEqual(MAX);
    }
  });
});
