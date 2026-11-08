import { useLang, useT } from "../i18n";
import { switchLang } from "../i18n/translated";
import { localizedPath } from "../i18n/paths";

/** Flips between Dutch and English. A real link to this page's other-language
 *  URL (/reisinfo ↔ /en/reisinfo), so crawlers find both versions and a
 *  middle-click opens it in a new tab; a plain click switches in place. It
 *  shows the language it switches *to*, in that language's own code, as
 *  language pickers do. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const lang = useLang();
  const txt = useT();
  const other = lang === "nl" ? "en" : "nl";
  return (
    <a
      href={localizedPath(window.location.pathname, other)}
      hrefLang={other}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        switchLang(other);
      }}
      title={txt.languageSwitch}
      aria-label={txt.languageSwitch}
      lang={other}
      // A language code, not a word: a translator must leave "EN" alone.
      translate="no"
      className={`notranslate ${className}`}
    >
      {other.toUpperCase()}
    </a>
  );
}
