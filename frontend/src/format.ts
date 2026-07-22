/** Shorter line labels for narrow mobile screens. */
export function compactLineName(name: string): string {
  return name.replace(/\bCentraal Station\b/g, "CS");
}
