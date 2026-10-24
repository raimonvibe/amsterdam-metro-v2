/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return 0;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text colour for a label on a line colour: black or white, whichever reads
 * better. Fixed near-black text failed WCAG 1.4.3 on line 52's blue (3.8:1)
 * and line 53's red (4.4:1); this gives 5.2:1 and 4.6:1.
 */
export function onColor(bg: string): string {
  return contrastRatio(bg, "#ffffff") > contrastRatio(bg, "#000000") ? "#ffffff" : "#000000";
}
