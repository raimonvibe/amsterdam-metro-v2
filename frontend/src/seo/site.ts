import type { Lang } from "../i18n";
import { en } from "../i18n/en";
import { nl } from "../i18n/nl";
import { type Page, PAGES, pagePath } from "../i18n/paths";

/** Gedeelde SEO-teksten voor paginatitels en meta-updates, per pagina en taal. */
export const SEO = {
  canonicalBase: "https://amsterdammetro.nl",
} as const;

export const PAGE_META: Record<Page, Record<Lang, { title: string; description: string }>> = {
  "/": {
    nl: {
      title: "Metro Amsterdam Live — 3D metrokaart & metro map | GVB M50–M54",
      description:
        "Check live waar elke metro in Amsterdam nu rijdt. Live 3D-metrokaart van GVB-lijnen M50, M51, M52, M53 en M54 met vertragingen en vertrektijden per station.",
    },
    en: {
      title: "Amsterdam Metro Live — live 3D metro map | GVB M50–M54",
      description:
        "See where every metro in Amsterdam is right now. Live 3D map of GVB lines M50, M51, M52, M53 and M54 with delays and departures for every station.",
    },
  },
  "/reisinfo": {
    nl: {
      title: "Reisinformatie — vertrektijden, reisplanner & lijnen | Metro Amsterdam Live",
      description:
        "Live vertrektijden per metrostation in Amsterdam, een reisplanner met overstappen, lijnoverzichten met rijdende metro's en de stiptheid van M50–M54.",
    },
    en: {
      title: "Travel info — departures, journey planner & lines | Amsterdam Metro Live",
      description:
        "Live departures for every metro station in Amsterdam, a journey planner with transfers, line overviews with running trains and how punctual M50–M54 are.",
    },
  },
  "/privacy": {
    nl: {
      title: "Privacybeleid — Metro Amsterdam Live",
      description:
        "Privacybeleid van Metro Amsterdam Live: welke gegevens worden verwerkt, cookies, externe diensten en uw rechten.",
    },
    en: {
      title: "Privacy policy — Amsterdam Metro Live",
      description:
        "Privacy policy of Amsterdam Metro Live: what data is processed, cookies, third-party services and your rights.",
    },
  },
};

export const OG_LOCALE: Record<Lang, string> = { nl: "nl_NL", en: "en_GB" };

/** The site's name per language, as the UI shows it (nl.ts/en.ts appName). */
export const SITE_NAME: Record<Lang, string> = { nl: nl.appName, en: en.appName };

/** Alt text of the social-share image. */
export const IMAGE_ALT: Record<Lang, string> = {
  nl: `${nl.appName} — live GVB-metrokaart van Amsterdam`,
  en: `${en.appName} — live GVB metro map of Amsterdam`,
};

export const pageUrl = (page: Page, lang: Lang) => `${SEO.canonicalBase}${pagePath(page, lang)}`;

/** hreflang alternates of a page: the same set on both language versions,
 *  each listing itself, as Google requires. Dutch is the default. */
export function alternates(page: Page): { hreflang: string; href: string }[] {
  return [
    { hreflang: "nl", href: pageUrl(page, "nl") },
    { hreflang: "en", href: pageUrl(page, "en") },
    { hreflang: "x-default", href: pageUrl(page, "nl") },
  ];
}

/** Pages search engines may index (in both languages); /privacy is noindex. */
export const INDEXED_PAGES: Page[] = PAGES.filter((p) => p !== "/privacy");

function setAttr(selector: string, attr: string, value: string) {
  document.querySelector(selector)?.setAttribute(attr, value);
}

/** Head tags for the page on screen, the same values the build writes into
 *  that page's HTML (routeHtml.ts). */
export function setPageMeta(page: Page, lang: Lang) {
  const { title, description } = PAGE_META[page][lang];
  const url = pageUrl(page, lang);
  document.title = title;
  setAttr('meta[name="description"]', "content", description);
  setAttr('link[rel="canonical"]', "href", url);
  setAttr('meta[property="og:title"]', "content", title);
  setAttr('meta[property="og:description"]', "content", description);
  setAttr('meta[property="og:url"]', "content", url);
  setAttr('meta[property="og:site_name"]', "content", SITE_NAME[lang]);
  setAttr('meta[property="og:image:alt"]', "content", IMAGE_ALT[lang]);
  setAttr('meta[name="twitter:image:alt"]', "content", IMAGE_ALT[lang]);
  setAttr('meta[property="og:locale"]', "content", OG_LOCALE[lang]);
  setAttr('meta[property="og:locale:alternate"]', "content", OG_LOCALE[lang === "nl" ? "en" : "nl"]);
  setAttr('meta[name="twitter:title"]', "content", title);
  setAttr('meta[name="twitter:description"]', "content", description);
  for (const { hreflang, href } of alternates(page)) {
    setAttr(`link[rel="alternate"][hreflang="${hreflang}"]`, "href", href);
  }
}
