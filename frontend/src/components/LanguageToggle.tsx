import { setLang, useLang, useT } from "../i18n";

/** One button that flips between Dutch and English. It shows the language
 *  it switches *to*, in that language's own code, as language pickers do. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const lang = useLang();
  const txt = useT();
  const other = lang === "nl" ? "en" : "nl";
  return (
    <button
      type="button"
      onClick={() => setLang(other)}
      title={txt.languageSwitch}
      aria-label={txt.languageSwitch}
      lang={other}
      className={className}
    >
      {other.toUpperCase()}
    </button>
  );
}
