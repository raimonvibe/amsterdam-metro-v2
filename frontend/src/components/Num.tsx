/** Keep an element out of browser translation. `translate="no"` is the HTML
 *  standard (Chrome, Firefox); `notranslate` is the class Microsoft's and
 *  Google's translators document, for Edge and older engines. Safari doesn't
 *  document either, which is why badges and tiles also can't grow (see
 *  docs/browser-translation.md). */
export const NO_TRANSLATE = { translate: "no", className: "notranslate" } as const;

/** A time, countdown or delay, marked translate="no" when it holds a digit.
 *  Browser translation redoes text every time it changes, so a clock ticking
 *  each second blinks between "14:05:09" and the translated digits (Bengali
 *  "১৪:০৫:০৯"); times and minutes read the same in every language anyway.
 *  Words without a digit ("nu", "vertrokken", "op tijd") stay translatable. */
export function Num({ children }: { children: string }) {
  return /\d/.test(children) ? <span {...NO_TRANSLATE}>{children}</span> : <span>{children}</span>;
}
