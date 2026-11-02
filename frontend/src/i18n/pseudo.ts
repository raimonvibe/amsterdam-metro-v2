/** A test language for checking layouts against browser translation, which
 *  makes text longer (Finnish or German labels, or a translator's sentence
 *  for a short word). Open any page with ?pseudo on the dev server: every UI
 *  string gets accents and ~40% extra length, in ⟦brackets⟧ so cut-off text
 *  is easy to spot. Never active in production builds. Numbers, line numbers
 *  and station names aren't UI strings, so they stay as they are, just as
 *  translate="no" keeps them in a real translation. See
 *  docs/browser-translation.md. */
export const PSEUDO =
  import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("pseudo");

const ACCENTS: Record<string, string> = {
  a: "á", e: "ë", i: "ï", o: "ø", u: "ü", c: "ç", n: "ñ", y: "ÿ",
  A: "Å", E: "É", I: "Î", O: "Ö", U: "Û", C: "Ç", N: "Ñ",
};

export function pseudoText(s: string): string {
  if (!s.trim()) return s;
  // Dots in groups of five with spaces, like the words a translation adds:
  // one unbroken run can't wrap and would flag layouts no real language breaks.
  const padding = "·".repeat(Math.max(2, Math.ceil(s.length * 0.4))).replace(/(·{5})(?=·)/g, "$1 ");
  return `⟦${s.replace(/[aeiouycnAEIOUCN]/g, (ch) => ACCENTS[ch])}${padding}⟧`;
}

function pseudoValue(value: unknown): unknown {
  if (typeof value === "string") return pseudoText(value);
  if (typeof value === "function") {
    return (...args: unknown[]) => {
      const out = (value as (...a: unknown[]) => unknown)(...args);
      return typeof out === "string" ? pseudoText(out) : out;
    };
  }
  if (Array.isArray(value)) return value.map(pseudoValue);
  if (value && typeof value === "object") return pseudoDict(value);
  return value;
}

/** The same dictionary with every string (nested groups such as `tabs`
 *  included), and every string a function returns, run through pseudoText. */
export function pseudoDict<T extends object>(dict: T): T {
  return Object.fromEntries(Object.entries(dict).map(([key, value]) => [key, pseudoValue(value)])) as T;
}
