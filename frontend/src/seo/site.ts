/** Gedeelde SEO-teksten voor paginatitels en meta-updates. */
export const SEO = {
  siteName: "Metro Amsterdam Live",
  homeTitle: "Metro Amsterdam Live — Live GVB-metrokaart Amsterdam",
  homeDescription:
    "Volg live alle GVB-metrolijnen (M50, M51, M52, M53, M54) op een interactieve 3D-kaart van Amsterdam. Echte sporen, live ritupdates en vertrektijden per station.",
  privacyTitle: "Privacybeleid — Metro Amsterdam Live",
  privacyDescription:
    "Privacybeleid van Metro Amsterdam Live: welke gegevens worden verwerkt, cookies, externe diensten en uw rechten.",
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
