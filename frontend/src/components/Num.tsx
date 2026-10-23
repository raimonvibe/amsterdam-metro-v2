/** A time, countdown or delay, marked translate="no" when it holds a digit.
 *  Browser translation redoes text every time it changes, so a clock ticking
 *  each second blinks between "14:05:09" and the translated digits (Bengali
 *  "১৪:০৫:০৯"); times and minutes read the same in every language anyway.
 *  Words without a digit ("nu", "vertrokken", "op tijd") stay translatable. */
export function Num({ children }: { children: string }) {
  return <span translate={/\d/.test(children) ? "no" : undefined}>{children}</span>;
}
