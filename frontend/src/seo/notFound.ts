import { stationPath } from "../i18n/paths";
import { METRO_LINES, STATION_NAMES, displayName, linesAt, stationSlug } from "../data/network";
import { DARK_STYLES } from "../notfound/suggest";

/** The app's line colours (the same as the API's). */
const LINE_COLORS: Record<string, string> = { "50": "#3CB44B", "51": "#F58231", "52": "#4363D8", "53": "#E6194B", "54": "#FFE119" };

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Nicknames for the 404 page's "did you mean". Pages for these would be
 * duplicates, so they get none; the 404 page points to the real one. An
 * ambiguous nickname ("amstel": three stations) lists all of them.
 */
export const NICKNAMES: Record<string, string[]> = {
  cs: ["Amsterdam, Centraal Station"],
  centraal: ["Amsterdam, Centraal Station"],
  "amsterdam-centraal": ["Amsterdam, Centraal Station"],
  bijlmer: ["Amsterdam, Station Bijlmer ArenA"],
  arena: ["Amsterdam, Station Bijlmer ArenA"],
  wtc: ["Amsterdam, Station Zuid"],
  "zuid-wtc": ["Amsterdam, Station Zuid"],
  amstel: ["Amsterdam, Amstelstation", "Amsterdam, Overamstel", "Amsterdam, Amstelveenseweg"],
  vlugtlaan: ["Amsterdam, Burg. De Vlugtlaan"],
};

/** The 3D model on the 404 page, and where its credit points. */
export const MODEL = {
  url: "/models/s12-metro.glb",
  poster: "/models/s12-metro-poster.webp",
  title: "S1/2 Metro for Cities Skylines",
  source: "https://sketchfab.com/3d-models/s12-metro-for-cities-skylines-e5eef97cc78340d49fb6d4b7f6e77c52",
  author: "accessviolation",
  authorUrl: "https://sketchfab.com/accessviolation",
  license: "CC BY-NC-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
} as const;

/**
 * The 404 page's head script, run before the first paint: the language of
 * the address and the visitor's theme, so the page never shows both
 * languages or the wrong theme for a frame (page.ts does the rest later).
 * Must agree with langOfPath and themeFor (tested).
 */
export const NOT_FOUND_BOOT = `(function () {
  var d = document.documentElement, p = location.pathname;
  var l = p === "/en" || p.indexOf("/en/") === 0 ? "en" : "nl";
  d.lang = l;
  d.className += " js lang-" + l;
  try {
    if (${JSON.stringify(DARK_STYLES)}.indexOf(localStorage.getItem("metro-live:map-style")) >= 0) {
      d.setAttribute("data-theme", "dark");
      var m = document.querySelector('meta[name="color-scheme"]');
      if (m) m.setAttribute("content", "dark");
    }
  } catch (e) {}
})();
`;

export interface NotFoundAssets {
  /** The built page script (src/notfound/page.ts), e.g. "/assets/notfound-abc.js". */
  script: string;
  /** The built head script (NOT_FOUND_BOOT), e.g. "/assets/notfound-boot-abc.js". */
  boot?: string;
  /** Whether the still image of the train exists (public/models/…-poster.webp). */
  hasPoster: boolean;
}

/** The 3D view's buttons, one set per language (shown with the 3D only). */
const VIEW_TOOLS = {
  nl: { group: "Weergave", zoomIn: "Inzoomen", zoomOut: "Uitzoomen", reset: "Beeld herstellen", full: "Volledig scherm", exit: "Volledig scherm sluiten" },
  en: { group: "View", zoomIn: "Zoom in", zoomOut: "Zoom out", reset: "Reset view", full: "Full screen", exit: "Exit full screen" },
} as const;

const icon = (d: string) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function viewTools(lang: "nl" | "en"): string {
  const t = VIEW_TOOLS[lang];
  const attrs = lang === "en" ? ` data-lang="en" lang="en"` : ` data-lang="nl"`;
  const button = (data: string, label: string, body: string) =>
    `<button type="button" ${data} aria-label="${label}" title="${label}">${body}</button>`;
  return `<div class="view-tools" role="group" aria-label="${t.group}"${attrs}>
            ${button('data-zoom="in"', t.zoomIn, icon(ICON.plus))}
            ${button('data-zoom="out"', t.zoomOut, icon(ICON.minus))}
            ${button('data-zoom="reset"', t.reset, icon(ICON.reset))}
            ${button(`data-fullscreen aria-pressed="false" data-label="${t.full}" data-exit-label="${t.exit}"`, t.full, `<span class="fs-enter">${icon(ICON.full)}</span><span class="fs-exit">${icon("M6 6l12 12M18 6L6 18")}</span>`)}
          </div>`;
}

/** Icons shared by the toolbar and its help. */
const ICON = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  reset: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5",
  full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
} as const;

/** A small copy of a toolbar button, for the help. */
const btn = (d: string) => `<span class="mini-btn" aria-hidden="true">${icon(d)}</span>`;

/**
 * The 3D view's controls, as a short list in a dropdown under the train.
 * .fine shows only with a mouse (keys, wheel), .coarse only on a touch screen.
 */
const CONTROLS = {
  nl: {
    summary: "Zo bedien je de 3D-metro",
    sub: "Draaien, zoomen, volledig scherm",
    rows: [
      ["Draaien", `<span class="chip">Slepen</span><span class="fine">of</span><span class="fine keys-row"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd></span>`],
      ["Zoomen", `<span class="chip coarse">Twee vingers</span><span class="chip fine">Ctrl + scroll</span>${btn(ICON.plus)}${btn(ICON.minus)}<span class="sr">knoppen + en −</span>`],
      ["Inzoomen op een plek", `<span class="chip fine">Dubbelklik</span><span class="chip coarse">Dubbeltik</span>`],
      ["Beginbeeld", `${btn(ICON.reset)}<span class="sr">knop Beeld herstellen</span><span class="fine">of</span><kbd class="fine">0</kbd>`],
      ["Volledig scherm", `${btn(ICON.full)}<span class="sr">knop Volledig scherm</span><span class="fine">of</span><kbd class="fine">F</kbd><span class="fine">· sluiten:</span><kbd class="fine">Esc</kbd>`],
    ],
    keys: "Toetsen werken als de metro geselecteerd is: klik erop of ga er met Tab naartoe.",
  },
  en: {
    summary: "How to control the 3D metro",
    sub: "Turn, zoom, full screen",
    rows: [
      ["Turn", `<span class="chip">Drag</span><span class="fine">or</span><span class="fine keys-row"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd></span>`],
      ["Zoom", `<span class="chip coarse">Two fingers</span><span class="chip fine">Ctrl + scroll</span>${btn(ICON.plus)}${btn(ICON.minus)}<span class="sr">buttons + and −</span>`],
      ["Zoom in on a spot", `<span class="chip fine">Double-click</span><span class="chip coarse">Double-tap</span>`],
      ["First view", `${btn(ICON.reset)}<span class="sr">Reset view button</span><span class="fine">or</span><kbd class="fine">0</kbd>`],
      ["Full screen", `${btn(ICON.full)}<span class="sr">Full screen button</span><span class="fine">or</span><kbd class="fine">F</kbd><span class="fine">· close:</span><kbd class="fine">Esc</kbd>`],
    ],
    keys: "Keys work once the metro is selected: click it or Tab to it.",
  },
} as const;

const chevron = `<svg class="chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function controlsHelp(lang: "nl" | "en"): string {
  const c = CONTROLS[lang];
  const attrs = lang === "en" ? ` data-lang="en" lang="en"` : ` data-lang="nl"`;
  return `<details class="disclosure help"${attrs}>
            <summary><span class="sum-icon" aria-hidden="true">${icon("M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6")}</span><span class="sum-text">${c.summary}<span class="sub">${c.sub}</span></span>${chevron}</summary>
            <dl class="controls">
              ${c.rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("\n              ")}
            </dl>
            <p class="keys fine">${c.keys}</p>
          </details>`;
}

const badge = (l: string) => `<span class="badge l${l}">${l}</span>`;

/**
 * The page every unknown address gets, with a real 404 status (Render serves
 * dist/404.html when no file or rule matches). Standalone: not the app, so an
 * unknown address never shows the map as if it were a page. Complete without
 * JavaScript (both languages, every station, a still image); the script adds
 * the language switch, suggestions, search and, last, the 3D train.
 */
export function notFoundHtml(assets: NotFoundAssets): string {
  const stations = STATION_NAMES.map((name) => ({ slug: stationSlug(name), name: displayName(name), lines: linesAt(name) }));
  const nick = Object.fromEntries(Object.entries(NICKNAMES).map(([k, v]) => [k, v.map(stationSlug)]));
  const data = JSON.stringify({ stations, nicknames: nick }).replace(/</g, "\\u003c");
  const list = (lang: "nl" | "en") =>
    STATION_NAMES.map(
      (name) => `<li><a href="${stationPath(stationSlug(name), lang)}">${escape(displayName(name))}</a> <span class="lines">${linesAt(name).map(badge).join(" ")}</span></li>`,
    ).join("\n            ");
  const track = METRO_LINES.map(
    ({ line }, i) => `<line x1="10" y1="${150 + i * 9}" x2="${560 - i * 26}" y2="${150 + i * 9}" stroke="${LINE_COLORS[line]}" stroke-width="5" stroke-linecap="round"/>`,
  ).join("");
  const still = assets.hasPoster
    ? `<img class="stage-still" src="${MODEL.poster}" alt="" width="1280" height="800" decoding="async">`
    : `<svg class="stage-still" viewBox="0 0 640 260" aria-hidden="true">${track}</svg>`;
  const credit = (lang: "nl" | "en") =>
    lang === "nl"
      ? `3D-model: <a href="${MODEL.source}">${MODEL.title}</a> door <a href="${MODEL.authorUrl}">${MODEL.author}</a>, <a href="${MODEL.licenseUrl}">${MODEL.license}</a>. Aangepast: gecomprimeerd voor het web.`
      : `3D model: <a href="${MODEL.source}">${MODEL.title}</a> by <a href="${MODEL.authorUrl}">${MODEL.author}</a>, <a href="${MODEL.licenseUrl}">${MODEL.license}</a>. Changed: compressed for the web.`;

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <meta name="color-scheme" content="light" />
    <title>Pagina niet gevonden — Metro Amsterdam Live</title>
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48 96x96" />${assets.boot ? `\n    <script src="${assets.boot}"></script>` : ""}
    <style>
      :root { --bg: #faf6ec; --ink: #1d2433; --muted: #6b6455; --accent: #7b2132; --card: #f1ebdd; --line: #e2d8c4; --link: #1f3a68; --stage: linear-gradient(180deg, #fbf8f1 0%, #efe6d3 100%); --board: #14181f; --amber: #ffb000; }
      /* Light unless the visitor chose a dark map style (page.ts), as in the app. */
      :root[data-theme="dark"] { --bg: #111727; --ink: #ece6d6; --muted: #9aa2b5; --accent: #d9b95f; --card: #1a2134; --line: #263049; --link: #9db1ff; --stage: linear-gradient(180deg, #172036 0%, #0d1220 100%); }
      * { box-sizing: border-box; }
      html { -webkit-text-size-adjust: 100%; }
      body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      a { color: var(--link); text-underline-offset: 2px; }
      a:focus-visible, button:focus-visible, input:focus-visible, summary:focus-visible, .stage:focus-visible { outline: 3px solid var(--link); outline-offset: 2px; border-radius: 4px; }
      h1, h2 { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; }
      .wrap { max-width: 72rem; margin: 0 auto; padding-left: 1rem; padding-right: 1rem; }
      header.bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: 1rem; padding-bottom: 0.5rem; }
      .brand { display: inline-flex; align-items: center; gap: 0.55rem; min-height: 44px; color: var(--ink); text-decoration: none; font-weight: 700; }
      .brand-mark { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 0.4rem; background: #1f3a68; color: #fff; font: 700 1rem/1 Georgia, serif; }
      .lang-toggle { margin-left: auto; min-width: 2.75rem; min-height: 2.75rem; padding: 0 0.75rem; border: 1px solid var(--muted); border-radius: 0.5rem; background: var(--card); color: var(--ink); font: 600 0.9rem/1 system-ui, sans-serif; letter-spacing: 0.05em; cursor: pointer; }
      .lang-toggle:hover { border-color: var(--ink); }
      main.hero { display: grid; gap: 1.25rem 2.5rem; grid-template-columns: minmax(0, 1fr); grid-template-areas: "head" "stage" "tools"; padding-top: 0.5rem; padding-bottom: 2.5rem; }
      @media (min-width: 60rem) { main.hero { grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.25fr); grid-template-areas: "head stage" "tools stage"; align-items: start; padding-top: 2rem; } }
      .head { grid-area: head; }
      .tools { grid-area: tools; }
      /* One language at a time once the head script ran (html.lang-nl or
         .lang-en); without JavaScript both, one under the other. */
      html.lang-nl [data-lang="en"], html.lang-en [data-lang="nl"] { display: none !important; }
      html:not(.js) .head > [lang="en"], html:not(.js) .tools > [lang="en"] { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--line); }
      .stage-wrap { grid-area: stage; margin: 0; }
      @media (min-width: 60rem) { .stage-wrap { position: sticky; top: 1.5rem; } }
      .board { display: inline-flex; align-items: center; gap: 0.75rem; margin: 0 0 1rem; padding: 0.45rem 0.8rem; border-radius: 0.35rem; background: var(--board); color: var(--amber); font: 600 0.85rem/1.2 ui-monospace, "Cascadia Mono", Consolas, monospace; letter-spacing: 0.12em; text-transform: uppercase; box-shadow: inset 0 0 0 1px #2a313d; }
      .board { flex-wrap: wrap; row-gap: 0.35rem; }
      .board .track, .board .flap { white-space: nowrap; }
      .board .track { padding: 0.1rem 0.45rem; border-radius: 0.2rem; background: var(--amber); color: var(--board); }
      .board .flap { display: inline-block; animation: flap 0.9s steps(6) 0.2s both; }
      @keyframes flap { 0% { transform: rotateX(90deg); opacity: 0; } 40% { opacity: 1; } 100% { transform: none; } }
      .code { margin: 0; color: var(--accent); font-weight: 600; font-variant-caps: all-small-caps; letter-spacing: 0.08em; }
      h1 { margin: 0.25rem 0 0.75rem; font-size: clamp(2rem, 1.3rem + 3vw, 3.4rem); line-height: 1.08; letter-spacing: -0.01em; }
      h1 .then { display: block; color: var(--accent); }
      .lead { margin: 0; max-width: 34rem; font-size: 1.1rem; }
      .fact { margin: 0.75rem 0 0; max-width: 34rem; color: var(--muted); font-size: 0.95rem; }
      .suggest { margin: 0 0 1.25rem; padding: 0.85rem 1rem; border-left: 4px solid var(--accent); border-radius: 0.5rem; background: var(--card); font-size: 1.05rem; }
      .suggest a { font-weight: 600; }
      form.search { margin: 0 0 1.25rem; }
      form.search label { display: block; margin-bottom: 0.35rem; font-weight: 600; }
      .search-row { display: flex; gap: 0.5rem; }
      .search-row input { flex: 1; min-width: 0; min-height: 2.75rem; padding: 0 0.85rem; border: 1px solid var(--muted); border-radius: 0.5rem; background: var(--bg); color: var(--ink); font: inherit; }
      .search-row button { min-height: 2.75rem; padding: 0 1rem; border: 0; border-radius: 0.5rem; background: #1f3a68; color: #fff; font: 600 1rem/1 system-ui, sans-serif; cursor: pointer; }
      .results, .mine ul, ul.stations { list-style: none; margin: 0; padding: 0; }
      .results li, .mine li { padding: 0.15rem 0; }
      .status { min-height: 1.4em; margin: 0.35rem 0 0; color: var(--muted); font-size: 0.9rem; }
      .mine { margin: 0 0 1.25rem; }
      .mine h2 { margin: 0 0 0.35rem; font-size: 1.05rem; color: var(--accent); }
      .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 1rem; }
      .actions a { display: inline-flex; align-items: center; min-height: 2.75rem; padding: 0 1rem; border-radius: 0.5rem; border: 1px solid var(--line); background: var(--card); color: var(--ink); font-weight: 600; text-decoration: none; }
      @media (max-width: 40rem) { .actions a { flex: 1 1 100%; justify-content: center; } }
      .actions a.primary { background: #1f3a68; border-color: #1f3a68; color: #fff; }
      .report { margin: 0; color: var(--muted); font-size: 0.92rem; }
      .stage { position: relative; overflow: hidden; aspect-ratio: 4 / 3; border-radius: 1rem; background: var(--stage); box-shadow: inset 0 0 0 1px var(--line); touch-action: pan-y; }
      /* Full screen: the Fullscreen API, or where that's missing (iPhone
         Safari) a fixed layer over the page (.is-fake-fs, page.ts). One
         finger turns the train there; the page can't scroll anyway. */
      .stage.is-fs { aspect-ratio: auto; width: 100%; height: 100%; max-height: none; border-radius: 0; box-shadow: none; touch-action: none; }
      .stage.is-fake-fs { position: fixed; inset: 0; z-index: 100; width: auto; height: auto; }
      .stage:fullscreen { background: var(--stage); }
      html.fs-lock, html.fs-lock body { overflow: hidden; }
      @media (min-width: 40rem) { .stage { aspect-ratio: 16 / 10; } }
      /* A phone on its side: never taller than the screen, so the buttons on
         top and the train fit in one view (the scene fits any shape). */
      .stage { width: 100%; max-height: calc(100vh - 2rem); max-height: calc(100svh - 2rem); }
      .stage-still { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; transition: opacity 0.6s ease; }
      .progress, .replay, .view-tools, .wheel-hint { z-index: 1; }
      /* The 3D fades in over the still image, which goes only after: the
         first 3D frame shows the train where the still has it, so the swap
         is seamless (no dip, no empty track). */
      .stage-canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; opacity: 0; transition: opacity 0.6s ease; cursor: grab; }
      .stage-canvas:active { cursor: grabbing; }
      .stage.is-live .stage-canvas { opacity: 1; }
      .stage.is-live .stage-still { opacity: 0; transition-delay: 0.6s; }
      .progress { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: linear-gradient(90deg, #3CB44B, #F58231, #4363D8, #E6194B, #FFE119); transform-origin: left; transform: scaleX(var(--p, 0.08)); opacity: 0; transition: transform 0.3s ease, opacity 0.3s ease; }
      .stage.is-loading .progress { opacity: 1; }
      /* Only once the 3D runs (page.ts adds .is-ready): faded in, and their
         space kept from the start so nothing below moves. No replay button
         with reduced motion; no help where the 3D can't run (.no-3d). */
      .replay, .view-tools, .help { transition: opacity 0.4s ease, visibility 0.4s; }
      .stage-wrap:not(.is-ready) .replay, .stage-wrap:not(.is-ready) .view-tools, .stage-wrap:not(.is-ready) .help { opacity: 0; visibility: hidden; }
      .stage-wrap.no-replay .replay, .stage-wrap.no-3d .help, html:not(.js) .help { display: none; }
      .replay { position: absolute; right: 0.75rem; bottom: 0.75rem; min-height: 2.75rem; padding: 0 0.9rem; border: 1px solid var(--line); border-radius: 999px; background: var(--card); color: var(--ink); font: 600 0.9rem/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 2px 8px rgb(0 0 0 / 0.12); }
      .stage.is-fs .replay { right: max(0.75rem, env(safe-area-inset-right)); bottom: max(0.75rem, env(safe-area-inset-bottom)); }
      /* The zoom and full screen buttons: only the buttons take clicks, so
         dragging the train works right up to them. */
      .view-tools { position: absolute; top: 0.6rem; right: 0.6rem; display: flex; gap: 0.4rem; pointer-events: none; }
      .stage.is-fs .view-tools { top: max(0.75rem, env(safe-area-inset-top)); right: max(0.75rem, env(safe-area-inset-right)); }
      .view-tools button { pointer-events: auto; display: grid; place-items: center; width: 2.75rem; height: 2.75rem; padding: 0; border: 1px solid var(--line); border-radius: 0.6rem; background: var(--card); color: var(--ink); cursor: pointer; box-shadow: 0 2px 8px rgb(0 0 0 / 0.12); touch-action: manipulation; }
      .view-tools button:hover { border-color: var(--muted); }
      .view-tools button:disabled { opacity: 0.45; cursor: default; }
      .view-tools button[data-fullscreen] { margin-left: 0.35rem; }
      .view-tools .fs-exit, .stage.is-fs .view-tools .fs-enter { display: none; }
      .stage.is-fs .view-tools .fs-exit { display: inline; }
      @media (max-width: 22rem) { .view-tools { gap: 0.25rem; } .view-tools button { width: 2.5rem; height: 2.5rem; } }
      .wheel-hint { position: absolute; left: 50%; top: 50%; margin: 0; padding: 0.5rem 0.9rem; border-radius: 0.5rem; background: rgb(20 24 31 / 0.82); color: #fff; font-size: 0.95rem; transform: translate(-50%, -50%); opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
      .stage.show-wheel-hint .wheel-hint { opacity: 1; }
      figcaption { margin-top: 0.75rem; }
      /* Dropdowns: a calm card, one line closed, opening smoothly where the
         browser can animate to auto height. */
      :root { interpolate-size: allow-keywords; }
      details.disclosure { border: 1px solid var(--line); border-radius: 0.75rem; background: var(--bg); }
      details.disclosure[open] { background: var(--card); }
      details.disclosure > summary { display: flex; align-items: center; gap: 0.75rem; min-height: 3rem; padding: 0.4rem 0.75rem 0.4rem 1rem; list-style: none; cursor: pointer; border-radius: 0.75rem; font-weight: 600; -webkit-tap-highlight-color: transparent; }
      details.disclosure > summary::-webkit-details-marker { display: none; }
      details.disclosure > summary:hover { background: var(--card); }
      details.disclosure > summary:focus-visible { outline: 3px solid var(--link); outline-offset: 2px; }
      details.disclosure::details-content { block-size: 0; overflow: clip; transition: block-size 0.25s ease, content-visibility 0.25s allow-discrete; }
      details.disclosure[open]::details-content { block-size: auto; }
      .sum-icon { display: grid; flex: none; place-items: center; width: 2rem; height: 2rem; border-radius: 0.5rem; background: var(--card); color: var(--accent); }
      details[open] > summary .sum-icon { background: var(--bg); }
      .sum-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
      .sum-text .sub { color: var(--muted); font-size: 0.85rem; font-weight: 400; }
      .chev { flex: none; margin-left: auto; color: var(--muted); transition: transform 0.25s ease; }
      details[open] > summary .chev { transform: rotate(180deg); }
      .controls { display: grid; gap: 0.1rem; margin: 0; padding: 0.25rem 1rem 0.5rem; }
      .controls > div { display: grid; grid-template-columns: 10rem minmax(0, 1fr); gap: 0.25rem 0.75rem; align-items: center; min-height: 2.6rem; padding: 0.35rem 0; border-top: 1px solid var(--line); }
      .controls > div:first-child { border-top: 0; }
      .controls dt { color: var(--muted); font-size: 0.9rem; }
      .controls dd { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; margin: 0; color: var(--muted); font-size: 0.9rem; }
      @media (max-width: 30rem) { .controls > div { grid-template-columns: 7.5rem minmax(0, 1fr); } }
      .keys-row { display: inline-flex; gap: 0.2rem; }
      .mini-btn { display: inline-grid; place-items: center; width: 1.9rem; height: 1.9rem; border: 1px solid var(--line); border-radius: 0.45rem; background: var(--bg); color: var(--ink); box-shadow: 0 1px 3px rgb(0 0 0 / 0.1); }
      .mini-btn svg { width: 15px; height: 15px; }
      .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .chip { display: inline-flex; align-items: center; min-height: 1.9rem; padding: 0 0.65rem; border-radius: 999px; background: var(--bg); box-shadow: inset 0 0 0 1px var(--line); color: var(--ink); white-space: nowrap; }
      kbd { display: inline-grid; place-items: center; min-width: 1.9rem; min-height: 1.9rem; color: var(--ink); padding: 0 0.35rem; border-radius: 0.35rem; background: var(--bg); box-shadow: inset 0 0 0 1px var(--line), 0 2px 0 var(--line); font: 600 0.8rem/1 ui-monospace, "Cascadia Mono", Consolas, monospace; }
      .keys { margin: 0; padding: 0 1rem 0.85rem; color: var(--muted); font-size: 0.85rem; }
      /* A phone: no keyboard and no mouse wheel to explain. */
      @media (pointer: coarse) { .fine { display: none !important; } }
      @media not (pointer: coarse) { .coarse { display: none !important; } }
      details.all { margin: 0 0 2rem; }
      details.all > ul.stations { padding: 0.5rem 1rem 1rem; }
      ul.stations { columns: 3 13rem; column-gap: 1.5rem; padding-bottom: 0.75rem; font-size: 0.95rem; }
      ul.stations li { break-inside: avoid; }
      ul.stations a, .results a, .mine a, .suggest a, figcaption a, footer a, .report a { display: inline-block; min-height: 24px; line-height: 24px; }
      .lines { white-space: nowrap; }
      .badge { display: inline-block; min-width: 1.7em; padding: 0 0.25em; border-radius: 0.2rem; color: #111; font-size: 0.72rem; font-weight: 700; line-height: 1.5; text-align: center; vertical-align: 0.1em; }
      .l50 { background: #3CB44B; } .l51 { background: #F58231; } .l52 { background: #4363D8; color: #fff; } .l53 { background: #E6194B; color: #fff; } .l54 { background: #FFE119; }
      footer { padding-bottom: 2rem; color: var(--muted); font-size: 0.85rem; border-top: 1px solid var(--line); }
      footer p { margin: 0.75rem 0 0; }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
      [hidden] { display: none !important; }
    </style>
  </head>
  <body>
    <header class="bar wrap">
      <a class="brand" href="/" data-lang="nl"><span class="brand-mark" aria-hidden="true">M</span>Metro Amsterdam Live</a>
      <a class="brand" href="/en/" data-lang="en" lang="en"><span class="brand-mark" aria-hidden="true">M</span>Amsterdam Metro Live</a>
      <!-- Shown by the page script, which switches the language in place:
           without JavaScript both languages are on the page already. -->
      <button type="button" class="lang-toggle" data-switch translate="no" hidden>EN</button>
    </header>

    <main class="hero wrap">
      <div class="head">
      <div data-lang="nl">
        <p class="board" aria-label="Spoor 404: geen dienst"><span class="track">Spoor 404</span><span class="flap">Geen dienst</span></p>
        <p class="code">Fout 404 · pagina niet gevonden</p>
        <h1>Deze metro rijdt niet meer. <span class="then">Deze pagina bestaat niet.</span></h1>
        <p class="lead">Dit adres bestaat niet (meer): misschien een tikfout, of een oude link. Zoek je station hieronder, of ga terug naar de kaart.</p>
        <p class="fact">De S1/S2 in beeld reed van 1990 tot april 2024 in Amsterdam. Hij komt hier niet meer langs.</p>
      </div>
      <div data-lang="en" lang="en">
        <p class="board" aria-label="Track 404: not in service"><span class="track">Track 404</span><span class="flap">Not in service</span></p>
        <p class="code">Error 404 · page not found</p>
        <h1>This metro no longer runs. <span class="then">This page doesn't exist.</span></h1>
        <p class="lead">This address doesn't exist (any more): maybe a typo, or an old link. Find your station below, or go back to the map.</p>
        <p class="fact">The S1/S2 shown here ran in Amsterdam from 1990 until April 2024. It won't stop here again.</p>
      </div>
      </div>

      <figure class="stage-wrap">
        <div class="stage" data-stage data-model="${MODEL.url}" role="group" aria-label="Een S1/S2-metro aan het eind van het spoor / An S1/S2 metro at the end of the track">
          ${still}
          <span class="progress" data-progress aria-hidden="true"></span>
          <button type="button" class="replay" data-replay data-lang="nl">↻ Laat binnenrijden</button>
          <button type="button" class="replay" data-replay data-lang="en" lang="en">↻ Roll it in</button>
          ${viewTools("nl")}
          ${viewTools("en")}
          <p class="wheel-hint" aria-hidden="true"><span data-lang="nl">Ctrl + scroll om te zoomen</span><span data-lang="en" lang="en">Ctrl + scroll to zoom</span></p>
        </div>
        <figcaption>
          ${controlsHelp("nl")}
          ${controlsHelp("en")}
        </figcaption>
      </figure>

      <div class="tools">
      <div data-lang="nl" data-copy>
        <p class="suggest" data-suggest hidden></p>
        <form class="search" data-search role="search" hidden>
          <label for="zoek-nl">Zoek een station</label>
          <div class="search-row">
            <input id="zoek-nl" type="search" autocomplete="off" enterkeyhint="go" placeholder="bijv. Zuid, Noord, Gein">
            <button type="submit">Ga</button>
          </div>
          <p class="status" data-status role="status" aria-live="polite"></p>
          <ul class="results" data-results></ul>
        </form>
        <section class="mine" data-mine hidden>
          <h2>Jouw stations</h2>
          <ul></ul>
        </section>
        <p class="actions"><a class="primary" href="/">Live 3D-metrokaart</a><a href="/reisinfo">Reisinformatie en reisplanner</a></p>
        <p class="report">Link stuk? <a data-report href="https://github.com/raimonvibe/amsterdam-metro-v2/issues/new">Meld het (GitHub)</a>, dan repareren we hem.</p>
      </div>
      <div data-lang="en" lang="en" data-copy>
        <p class="suggest" data-suggest hidden></p>
        <form class="search" data-search role="search" hidden>
          <label for="zoek-en">Find a station</label>
          <div class="search-row">
            <input id="zoek-en" type="search" autocomplete="off" enterkeyhint="go" placeholder="e.g. Zuid, Noord, Gein">
            <button type="submit">Go</button>
          </div>
          <p class="status" data-status role="status" aria-live="polite"></p>
          <ul class="results" data-results></ul>
        </form>
        <section class="mine" data-mine hidden>
          <h2>Your stations</h2>
          <ul></ul>
        </section>
        <p class="actions"><a class="primary" href="/en/">Live 3D metro map</a><a href="/en/reisinfo">Travel info and journey planner</a></p>
        <p class="report">Broken link? <a data-report href="https://github.com/raimonvibe/amsterdam-metro-v2/issues/new">Report it (GitHub)</a> and we'll fix it.</p>
      </div>
      </div>
    </main>

    <section class="wrap">
      <details class="disclosure all" data-lang="nl">
        <summary><span class="sum-icon" aria-hidden="true">${icon("M4 6h16M4 12h16M4 18h10")}</span><span class="sum-text">Alle ${STATION_NAMES.length} metrostations<span class="sub">Op naam, met hun lijnen</span></span>${chevron}</summary>
        <ul class="stations">
            ${list("nl")}
        </ul>
      </details>
      <details class="disclosure all" data-lang="en" lang="en">
        <summary><span class="sum-icon" aria-hidden="true">${icon("M4 6h16M4 12h16M4 18h10")}</span><span class="sum-text">All ${STATION_NAMES.length} metro stations<span class="sub">By name, with their lines</span></span>${chevron}</summary>
        <ul class="stations">
            ${list("en")}
        </ul>
      </details>
    </section>

    <footer class="wrap">
      <p data-lang="nl">Metro Amsterdam Live is niet verbonden aan GVB. ${credit("nl")}</p>
      <p data-lang="en" lang="en">Amsterdam Metro Live is not affiliated with GVB. ${credit("en")}</p>
    </footer>

    <script type="application/json" id="station-data">${data}</script>
    <script type="module" src="${assets.script}"></script>
  </body>
</html>
`;
}
