/** Gedeelde SEO-teksten voor paginatitels en meta-updates. */
export const SEO = {
  siteName: "Metro Amsterdam Live",
  homeTitle: "Metro Amsterdam Live — 3D metrokaart & metro map | GVB M50–M54",
  homeDescription:
    "Check live waar elke metro in Amsterdam nu rijdt. Live 3D-metrokaart van GVB-lijnen M50, M51, M52, M53 en M54 met vertragingen en vertrektijden per station.",
  privacyTitle: "Privacybeleid — Metro Amsterdam Live",
  privacyDescription:
    "Privacybeleid van Metro Amsterdam Live: welke gegevens worden verwerkt, cookies, externe diensten en uw rechten.",
  travelTitle: "Reisinformatie — vertrektijden, reisplanner & lijnen | Metro Amsterdam Live",
  travelDescription:
    "Live vertrektijden per metrostation in Amsterdam, een reisplanner met overstappen, lijnoverzichten met rijdende metro's en de stiptheid van M50–M54.",
  canonicalBase: "https://amsterdammetro.nl",
} as const;

export function setPageMeta(title: string, description: string, path = "/") {
  document.title = title;

  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", description);

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute("href", `${SEO.canonicalBase}${path === "/" ? "/" : path}`);
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", description);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) {
    ogUrl.setAttribute("content", `${SEO.canonicalBase}${path === "/" ? "/" : path}`);
  }
}
