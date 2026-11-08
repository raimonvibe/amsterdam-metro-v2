import { stationPath } from "../i18n/paths";
import { METRO_LINES, STATION_NAMES, displayName, linesAt, stationSlug } from "../data/network";

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

export interface NotFoundAssets {
  /** The built page script (src/notfound/page.ts), e.g. "/assets/notfound-abc.js". */
  script: string;
  /** Whether the still image of the train exists (public/models/…-poster.webp). */
  hasPoster: boolean;
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
    <meta name="color-scheme" content="light dark" />
    <title>Pagina niet gevonden — Metro Amsterdam Live</title>
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48 96x96" />
    <style>
      :root { --bg: #faf6ec; --ink: #1d2433; --muted: #6b6455; --accent: #7b2132; --card: #f1ebdd; --line: #e2d8c4; --link: #1f3a68; --stage: linear-gradient(180deg, #fbf8f1 0%, #efe6d3 100%); --board: #14181f; --amber: #ffb000; }
      @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #111727; --ink: #ece6d6; --muted: #9aa2b5; --accent: #d9b95f; --card: #1a2134; --line: #263049; --link: #9db1ff; --stage: linear-gradient(180deg, #172036 0%, #0d1220 100%); } }
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
      .actions a.primary { background: #1f3a68; border-color: #1f3a68; color: #fff; }
      .report { margin: 0; color: var(--muted); font-size: 0.92rem; }
      .stage { position: relative; overflow: hidden; aspect-ratio: 4 / 3; border-radius: 1rem; background: var(--stage); box-shadow: inset 0 0 0 1px var(--line); touch-action: pan-y; }
      @media (min-width: 40rem) { .stage { aspect-ratio: 16 / 10; } }
      .stage-still { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; transition: opacity 0.6s ease; }
      .progress, .loading, .replay { z-index: 1; }
      .stage-canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; opacity: 0; transition: opacity 0.8s ease; cursor: grab; }
      .stage-canvas:active { cursor: grabbing; }
      .stage.is-live .stage-canvas { opacity: 1; }
      .stage.is-live .stage-still { opacity: 0; }
      .progress { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: linear-gradient(90deg, #3CB44B, #F58231, #4363D8, #E6194B, #FFE119); transform-origin: left; transform: scaleX(var(--p, 0.08)); opacity: 0; transition: transform 0.3s ease, opacity 0.3s ease; }
      .stage.is-loading .progress { opacity: 1; }
      .loading { position: absolute; left: 0.85rem; bottom: 0.85rem; margin: 0; padding: 0.25rem 0.6rem; border-radius: 999px; background: var(--card); color: var(--muted); font-size: 0.85rem; opacity: 0; transition: opacity 0.3s ease; }
      .stage.is-loading .loading { opacity: 1; }
      /* Only once the 3D runs (page.ts adds .is-ready), and no replay
         button with reduced motion. */
      .stage-wrap:not(.is-ready) .replay, .stage-wrap:not(.is-ready) .hint, .stage-wrap.no-replay .replay { display: none; }
      .replay { position: absolute; right: 0.75rem; bottom: 0.75rem; min-height: 2.75rem; padding: 0 0.9rem; border: 1px solid var(--line); border-radius: 999px; background: var(--card); color: var(--ink); font: 600 0.9rem/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 2px 8px rgb(0 0 0 / 0.12); }
      figcaption { margin-top: 0.6rem; color: var(--muted); font-size: 0.9rem; }
      figcaption p { margin: 0 0 0.25rem; }
      details.all { margin: 0 0 2rem; padding: 0.25rem 1rem; border: 1px solid var(--line); border-radius: 0.75rem; }
      details.all summary { min-height: 2.75rem; display: flex; align-items: center; cursor: pointer; font-weight: 700; }
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
      <div class="head" data-lang="nl">
        <p class="board" aria-label="Spoor 404: geen dienst"><span class="track">Spoor 404</span><span class="flap">Geen dienst</span></p>
        <p class="code">Fout 404 · pagina niet gevonden</p>
        <h1>Deze metro rijdt niet meer. <span class="then">Deze pagina bestaat niet.</span></h1>
        <p class="lead">Dit adres bestaat niet (meer): misschien een tikfout, of een oude link. Zoek je station hieronder, of ga terug naar de kaart.</p>
        <p class="fact">De S1/S2 in beeld reed van 1990 tot april 2024 in Amsterdam. Hij komt hier niet meer langs.</p>
      </div>
      <div class="head" data-lang="en" lang="en">
        <p class="board" aria-label="Track 404: not in service"><span class="track">Track 404</span><span class="flap">Not in service</span></p>
        <p class="code">Error 404 · page not found</p>
        <h1>This metro no longer runs. <span class="then">This page doesn't exist.</span></h1>
        <p class="lead">This address doesn't exist (any more): maybe a typo, or an old link. Find your station below, or go back to the map.</p>
        <p class="fact">The S1/S2 shown here ran in Amsterdam from 1990 until April 2024. It won't stop here again.</p>
      </div>

      <figure class="stage-wrap">
        <div class="stage" data-stage data-model="${MODEL.url}" role="group" aria-label="Een S1/S2-metro aan het eind van het spoor / An S1/S2 metro at the end of the track">
          ${still}
          <span class="progress" data-progress aria-hidden="true"></span>
          <p class="loading" aria-hidden="true"><span data-lang="nl">De metro komt eraan…</span><span data-lang="en" lang="en">The metro is on its way…</span></p>
          <button type="button" class="replay" data-replay data-lang="nl">↻ Nog een keer</button>
          <button type="button" class="replay" data-replay data-lang="en" lang="en">↻ Once more</button>
        </div>
        <figcaption>
          <p class="hint" data-lang="nl">Sleep, of klik en gebruik de pijltjestoetsen, om de metro te draaien.</p>
          <p class="hint" data-lang="en" lang="en">Drag, or click and use the arrow keys, to turn the metro.</p>
          <p data-lang="nl">${credit("nl")}</p>
          <p data-lang="en" lang="en">${credit("en")}</p>
        </figcaption>
      </figure>

      <div class="tools" data-lang="nl" data-copy>
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
      <div class="tools" data-lang="en" lang="en" data-copy>
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
    </main>

    <section class="wrap">
      <details class="all" data-lang="nl">
        <summary>Alle ${STATION_NAMES.length} metrostations</summary>
        <ul class="stations">
            ${list("nl")}
        </ul>
      </details>
      <details class="all" data-lang="en" lang="en">
        <summary>All ${STATION_NAMES.length} metro stations</summary>
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
