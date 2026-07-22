/** Strip city prefix and shorten common station names for display. */
export function formatPlaceName(name: string): string {
  const stripped = name.replace(/^Amsterdam, /, "");
  return stripped.replace(/\bCentraal Station\b/g, "CS").replace(/^Centraal$/, "CS");
}
