/** Phones and tablets: no hover, so the followed train gets the popup instead.
 *  Its own module so App can read it without loading the map's code. */
export const NO_HOVER =
  typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
