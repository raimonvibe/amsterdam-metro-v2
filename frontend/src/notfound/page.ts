import {
  type Lang,
  type PageData,
  type StationData,
  forwardTarget,
  issueUrl,
  knownStations,
  langOfPath,
  readPath,
  searchStations,
  stationHref,
  suggest,
  toSlug,
} from "./suggest";

/**
 * The 404 page's script (dist/404.html, built by src/seo/notFound.ts).
 * The page is complete without it: both languages, every station and the
 * still image are in the HTML. This adds the language switch, "did you
 * mean", the search box, the visitor's own stations, the report link and,
 * last and only where it can run well, the 3D train.
 */

const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

const path = window.location.pathname;
const data: PageData = JSON.parse($("#station-data")?.textContent || '{"stations":[],"nicknames":{}}');

// A station address that clearly means one station: go there straight away.
const forward = forwardTarget(path, window.location.search, data);
if (forward) {
  window.location.replace(forward);
} else {
  init();
}

/** Light or dark: the map style chosen on this site, else the system's. */
function theme(): "dark" | "light" {
  try {
    const style = localStorage.getItem("metro-live:map-style");
    if (style === "dark" || style === "fiord") return "dark";
    if (style) return "light";
  } catch {
    /* site data blocked */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readList(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function link(st: StationData, lang: Lang): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = stationHref(st, lang);
  a.textContent = st.name;
  return a;
}

function badges(st: StationData): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "lines";
  for (const l of st.lines) {
    const b = document.createElement("span");
    b.className = `badge l${l}`;
    b.textContent = l;
    span.append(b, " ");
  }
  return span;
}

function init() {
  const dark = theme() === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";

  const blocks = $$<HTMLElement>("[data-lang]");
  const toggle = $<HTMLButtonElement>("[data-switch]");
  const TITLE: Record<Lang, string> = {
    nl: "Pagina niet gevonden — Metro Amsterdam Live",
    en: "Page not found — Amsterdam Metro Live",
  };
  const SWITCH: Record<Lang, { code: string; label: string }> = {
    nl: { code: "EN", label: "Switch to English" },
    en: { code: "NL", label: "Wissel naar Nederlands" },
  };
  let lang = langOfPath(path);

  // Shows the page in one language, in place; the address stays and
  // nothing is stored.
  const show = (l: Lang) => {
    lang = l;
    for (const b of blocks) b.hidden = b.dataset.lang !== l;
    document.documentElement.lang = l;
    document.title = TITLE[l];
    if (toggle) {
      toggle.textContent = SWITCH[l].code;
      toggle.setAttribute("aria-label", SWITCH[l].label);
      toggle.title = SWITCH[l].label;
      toggle.lang = l === "nl" ? "en" : "nl";
    }
  };
  show(lang);
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      show(lang === "en" ? "nl" : "en");
      toggle.focus();
    });
  }

  for (const l of ["nl", "en"] as const) {
    const root = $<HTMLElement>(`[data-lang="${l}"][data-copy]`);
    if (!root) continue;

    // "Did you mean …?"
    const found = suggest(readPath(path).wanted, data);
    const box = $<HTMLElement>("[data-suggest]", root);
    if (box && found.length) {
      box.append(l === "en" ? "Did you mean " : "Bedoelde je ");
      found.forEach((st, i) => {
        if (i > 0) box.append(i === found.length - 1 ? (l === "en" ? " or " : " of ") : ", ");
        box.append(link(st, l));
      });
      box.append("?");
      box.hidden = false;
    }

    // The search box: results as links, the first one on Enter.
    const form = $<HTMLFormElement>("form[data-search]", root);
    const input = form && $<HTMLInputElement>("input", form);
    const results = form && $<HTMLUListElement>("[data-results]", form);
    const status = form && $<HTMLElement>("[data-status]", form);
    if (form && input && results && status) {
      form.hidden = false;
      let hits: StationData[] = [];
      input.addEventListener("input", () => {
        hits = searchStations(input.value, data);
        results.replaceChildren(
          ...hits.map((st) => {
            const li = document.createElement("li");
            li.append(link(st, l), " ", badges(st));
            return li;
          }),
        );
        const n = hits.length;
        status.textContent = !input.value.trim()
          ? ""
          : l === "en"
            ? n ? `${n} station${n > 1 ? "s" : ""} found` : "No station found"
            : n ? `${n} station${n > 1 ? "s" : ""} gevonden` : "Geen station gevonden";
      });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (hits[0]) window.location.assign(stationHref(hits[0], l));
      });
    }

    // Stations the visitor saved or opened here before.
    const mine = knownStations(readList("metro-live:favourites"), readList("metro-live:recent"), data, (n) =>
      toSlug(n.replace(/^[^,]+, /, "")),
    );
    const mineBox = $<HTMLElement>("[data-mine]", root);
    const mineList = mineBox && $<HTMLUListElement>("ul", mineBox);
    if (mineBox && mineList && mine.length) {
      mineList.replaceChildren(
        ...mine.map((st) => {
          const li = document.createElement("li");
          li.append(link(st, l), " ", badges(st));
          return li;
        }),
      );
      mineBox.hidden = false;
    }

    // "Report this broken link": a prefilled GitHub issue.
    const report = $<HTMLAnchorElement>("[data-report]", root);
    if (report) report.href = issueUrl(path, l);
  }

  start3d(dark);
}

/** Whether this device and connection should get the 3D train. */
function canRun3d(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if (/(^|-)2g$/.test(nav.connection?.effectiveType ?? "")) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 2) return false;
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

function start3d(dark: boolean) {
  const stage = $<HTMLElement>("[data-stage]");
  if (!stage || !canRun3d()) return;
  const modelUrl = stage.dataset.model;
  if (!modelUrl) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bar = $<HTMLElement>("[data-progress]", stage);

  // After the page has loaded and the browser is idle: the text and the
  // still image always come first.
  const go = () => {
    stage.classList.add("is-loading");
    import("./scene")
      .then(({ mount }) =>
        mount(stage, {
          modelUrl,
          reducedMotion,
          dark,
          onProgress: (f) => bar?.style.setProperty("--p", String(f)),
        }),
      )
      .then((scene) => {
        stage.classList.remove("is-loading");
        stage.tabIndex = 0;
        stage.setAttribute("aria-roledescription", "3D");
        for (const b of $$<HTMLButtonElement>("[data-replay]", stage)) b.addEventListener("click", () => scene.replay());
        // Shows the replay button and the hint (CSS), in the page's language.
        const wrap = stage.closest(".stage-wrap");
        wrap?.classList.add("is-ready");
        if (reducedMotion) wrap?.classList.add("no-replay");
        const STEP = Math.PI / 12;
        stage.addEventListener("keydown", (e) => {
          const turns: Record<string, [number, number]> = {
            ArrowLeft: [-STEP, 0],
            ArrowRight: [STEP, 0],
            ArrowUp: [0, -STEP / 2],
            ArrowDown: [0, STEP / 2],
          };
          const t = turns[e.key];
          if (t && e.target === stage) {
            e.preventDefault();
            scene.turn(t[0], t[1]);
          }
        });
      })
      .catch(() => {
        // The still image stays; nothing else to do.
        stage.classList.remove("is-loading");
      });
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const later = () => (idle ? idle(go, { timeout: 2500 }) : window.setTimeout(go, 400));
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later, { once: true });
}
