import {
  type Lang,
  type PageData,
  type StationData,
  forwardTarget,
  themeFor,
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

function savedStyle(): string | null {
  try {
    return localStorage.getItem("metro-live:map-style");
  } catch {
    return null; // site data blocked
  }
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
  const dark = themeFor(savedStyle()) === "dark";
  if (dark) {
    document.documentElement.dataset.theme = "dark";
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", "dark");
  }

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
    // The head script set these first (no frame with both languages).
    const root = document.documentElement;
    root.classList.add("js");
    root.classList.toggle("lang-nl", l === "nl");
    root.classList.toggle("lang-en", l === "en");
    root.lang = l;
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
  if (!stage) return;
  const wrap = stage.closest(".stage-wrap");
  const modelUrl = stage.dataset.model;
  // The head script guessed whether the 3D comes (html.will-3d) and if so
  // showed the empty track for the train to roll in on. Not after all:
  // back to the still image of the train, without the controls' help.
  const noThreeD = () => {
    document.documentElement.classList.remove("will-3d");
    wrap?.classList.add("no-3d");
  };
  if (!canRun3d() || !modelUrl) return noThreeD();
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
          railsUrl: stage.dataset.rails,
          reducedMotion,
          // Over the empty track the train rolls in (once in view); over the
          // still image of the train it starts where that has it. Either
          // way the swap from still image to 3D doesn't show.
          parked: reducedMotion || !document.documentElement.classList.contains("will-3d"),
          dark,
          onProgress: (f) => bar?.style.setProperty("--p", String(f)),
          wheelZooms: () => stage.classList.contains("is-fs"),
          onWheelScroll: wheelHint,
        }),
      )
      .then((scene) => {
        stage.classList.remove("is-loading");
        stage.tabIndex = 0;
        stage.setAttribute("aria-roledescription", "3D");
        for (const b of $$<HTMLButtonElement>("[data-replay]", stage)) b.addEventListener("click", () => scene.replay());
        // Shows the buttons and the help (CSS), in the page's language.
        wrap?.classList.add("is-ready");
        if (reducedMotion) wrap?.classList.add("no-replay");
        const ZOOM_STEP = 1.35;
        for (const b of $$<HTMLButtonElement>("[data-zoom]", stage)) {
          b.addEventListener("click", () => {
            if (b.dataset.zoom === "in") scene.zoom(ZOOM_STEP);
            else if (b.dataset.zoom === "out") scene.zoom(1 / ZOOM_STEP);
            else scene.reset();
          });
        }
        const fullscreen = fullscreenToggle(stage);
        const STEP = Math.PI / 12;
        stage.addEventListener("keydown", (e) => {
          if (e.target !== stage || e.altKey || e.ctrlKey || e.metaKey) return;
          const turns: Record<string, [number, number]> = {
            ArrowLeft: [-STEP, 0],
            ArrowRight: [STEP, 0],
            ArrowUp: [0, -STEP / 2],
            ArrowDown: [0, STEP / 2],
          };
          const t = turns[e.key];
          if (t) scene.turn(t[0], t[1]);
          else if (e.key === "+" || e.key === "=") scene.zoom(ZOOM_STEP);
          else if (e.key === "-" || e.key === "_") scene.zoom(1 / ZOOM_STEP);
          else if (e.key === "0") scene.reset();
          else if (e.key === "f" || e.key === "F") fullscreen.toggle();
          else return;
          e.preventDefault();
        });
      })
      .catch(() => {
        // The still image stays; nothing else to do.
        stage.classList.remove("is-loading");
        noThreeD();
      });
  };
  // A plain wheel over the train scrolls the page; say once in a while how
  // to zoom instead (as maps do).
  let hintTimer = 0;
  let hintShownAt = -Infinity;
  function wheelHint() {
    const now = performance.now();
    if (now - hintShownAt < 4000) return;
    hintShownAt = now;
    stage!.classList.add("show-wheel-hint");
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => stage!.classList.remove("show-wheel-hint"), 1400);
  }

  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const later = () => (idle ? idle(go, { timeout: 2500 }) : window.setTimeout(go, 400));
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later, { once: true });
}

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenEnabled?: boolean };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/**
 * The stage's full screen button (and F): the Fullscreen API where there is
 * one, else (iPhone Safari) a fixed layer over the page, closed with the
 * same button or Esc. Adds .is-fs to the stage either way.
 */
function fullscreenToggle(stage: HTMLElement): { toggle(): void } {
  const doc = document as FsDocument;
  const el = stage as FsElement;
  const native = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled) && !!(el.requestFullscreen || el.webkitRequestFullscreen);
  const buttons = $$<HTMLButtonElement>("[data-fullscreen]", stage);
  let fake = false;
  let lastFocus: HTMLElement | null = null;

  const nativeOn = () => (doc.fullscreenElement ?? doc.webkitFullscreenElement) === stage;
  const isOn = () => fake || nativeOn();

  const sync = () => {
    const on = isOn();
    stage.classList.toggle("is-fs", on);
    stage.classList.toggle("is-fake-fs", fake);
    document.documentElement.classList.toggle("fs-lock", fake);
    // The name stays ("Volledig scherm"); aria-pressed says whether it's
    // on. The tooltip says what a click does.
    for (const b of buttons) {
      b.setAttribute("aria-pressed", String(on));
      b.title = (on ? b.dataset.exitLabel : b.dataset.label) ?? "";
    }
  };

  // The fixed layer covers the page: Esc closes it, and Tab stays on the
  // stage and its buttons (the page's links under it are out of sight).
  const onKey = (e: KeyboardEvent) => {
    if (!fake) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setFake(false);
    } else if (e.key === "Tab") {
      const stops = [stage, ...$$<HTMLElement>("button", stage).filter((b) => b.offsetParent && getComputedStyle(b).visibility !== "hidden")];
      const i = stops.indexOf(document.activeElement as HTMLElement);
      const next = stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length];
      e.preventDefault();
      next.focus();
    }
  };
  function setFake(on: boolean) {
    fake = on;
    if (on) {
      lastFocus = document.activeElement as HTMLElement | null;
      document.addEventListener("keydown", onKey);
    } else {
      document.removeEventListener("keydown", onKey);
    }
    sync();
    if (on) stage.focus({ preventScroll: true });
    else lastFocus?.focus({ preventScroll: true });
  }

  async function enter() {
    if (native) {
      try {
        await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen?.());
        return;
      } catch {
        // Refused (an iframe without permission, say): the fixed layer instead.
      }
    }
    setFake(true);
  }

  function exit() {
    if (fake) return setFake(false);
    if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {});
    else doc.webkitExitFullscreen?.();
  }

  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  const toggle = () => (isOn() ? exit() : void enter());
  for (const b of buttons) b.addEventListener("click", toggle);
  return { toggle };
}
