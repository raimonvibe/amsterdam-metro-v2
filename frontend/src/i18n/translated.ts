import { getLang, Lang, setLang } from "./index";

/**
 * Browser translation (Chrome, Edge, Firefox, Safari) rewrites the page's
 * text under React: it swaps each text node for its own translated nodes
 * and drops the original. React keeps writing to the dropped nodes, so a
 * change it makes in place never reaches the screen, and removing one
 * throws. See docs/browser-translation.md.
 */

/** Whether a browser translator is rewriting this page now. */
export function pageTranslated(doc: Document = document): boolean {
  const html = doc.documentElement;
  // Chrome marks the root with the direction of the target language.
  if (html.classList.contains("translated-ltr") || html.classList.contains("translated-rtl")) return true;
  // Firefox writes the target language into <html lang>; we only ever write ours.
  if (html.lang && html.lang !== getLang()) return true;
  // Edge and the Google Translate extension leave <html> alone but wrap the
  // translated text in <font>, an element this site never renders.
  return doc.querySelector("font") !== null;
}

/**
 * The language button. Untranslated, it switches in place. Translated, the
 * new words would land in text nodes the translator already removed and the
 * page would keep showing the old language. So it switches (which saves the
 * choice and moves the address bar to that language's URL) and reloads: a
 * clean page, built in the new language.
 */
export function switchLang(lang: Lang, reload: () => void = () => window.location.reload()) {
  // Before setLang: it rewrites <html lang>, which the Firefox check reads.
  const translated = pageTranslated();
  setLang(lang);
  if (translated) reload();
}

/**
 * Keep the app alive when React removes or inserts beside a node a
 * translator has already taken out (React issue #11538): the stock DOM
 * throws NotFoundError and React then tears the whole tree down. Only the
 * call that would throw is changed; it becomes a no-op, or an append.
 */
export function guardTranslatorDom() {
  if (typeof Node === "undefined") return;
  const proto = Node.prototype;
  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };
  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null) as T;
    return insertBefore.call(this, node, ref) as T;
  };
}
