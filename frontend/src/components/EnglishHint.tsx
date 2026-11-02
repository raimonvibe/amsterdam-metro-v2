import { useState } from "react";
import { Globe, X } from "lucide-react";
import { browserReadsDutch, savedLang, setLang, useLang } from "../i18n";
import { pageOfPath, pagePath } from "../i18n/paths";

const DISMISSED_KEY = "metro-lang-hint";

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** A small "English" pill under the menu button, for a browser that doesn't
 *  list Dutch. An offer, not a redirect: Google advises against redirecting
 *  by language, and crawlers (which browse as en-US) must keep reading the
 *  Dutch page at /. Gone for good once tapped, closed or once a language was
 *  picked with the language button. Always in English: that's who it's for. */
export function EnglishHint({ sidebarOpen }: { sidebarOpen: boolean }) {
  const lang = useLang();
  const [offered, setOffered] = useState(() => !browserReadsDutch() && !dismissed());
  if (!offered || lang !== "nl" || savedLang()) return null;

  const hide = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* storage unavailable: hidden until reload */
    }
    setOffered(false);
  };

  return (
    <div
      lang="en"
      // Under the menu button; with the sidebar open (desktop) that button is
      // hidden, so take its place. Clear of the LIVE badge, which widens to
      // "Dienstregeling" when the feed is down.
      className={`absolute left-[max(0.75rem,env(safe-area-inset-left))] z-20 flex items-center rounded-full bg-white/90 text-sm font-semibold text-gray-900 shadow-md backdrop-blur dark:bg-gray-950/85 dark:text-gray-100 ${
        sidebarOpen ? "top-[max(0.75rem,env(safe-area-inset-top))]" : "top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)]"
      }`}
    >
      <a
        href={pagePath(pageOfPath(window.location.pathname), "en")}
        hrefLang="en"
        aria-label="View this site in English"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          setLang("en");
        }}
        className="flex min-h-11 items-center gap-1.5 rounded-l-full pl-3.5 pr-1 hover:text-[#4363D8] dark:hover:text-blue-300"
      >
        <Globe size={16} aria-hidden />
        English
      </a>
      <button
        type="button"
        onClick={hide}
        aria-label="No thanks"
        title="No thanks"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-r-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
