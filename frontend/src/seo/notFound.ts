import { stationPath } from "../i18n/paths";
import { METRO_LINES, STATION_NAMES, displayName, linesAt, stationSlug } from "../data/network";

/** The app's line colours (the same as the API's), for the dead-end track. */
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

/**
 * The page every unknown address gets, with a real 404 status (Render serves
 * dist/404.html when no file or rule matches). Standalone: no app bundle, so
 * an unknown address never shows the map as if it were a page. Both
 * languages are in the HTML; /404.js shows the one the address asks for and
 * suggests the station the visitor probably meant.
 */
export function notFoundHtml(): string {
  const stations = STATION_NAMES.map((name) => ({ slug: stationSlug(name), name: displayName(name), lines: linesAt(name) }));
  const nick = Object.fromEntries(Object.entries(NICKNAMES).map(([k, v]) => [k, v.map(stationSlug)]));
  const data = JSON.stringify({ stations, nicknames: nick }).replace(/</g, "\\u003c");
  const list = (lang: "nl" | "en") =>
    STATION_NAMES.map(
      (name) =>
        `<li><a href="${stationPath(stationSlug(name), lang)}">${escape(displayName(name))}</a> <span class="lines">${linesAt(name)
          .map((l) => `<span class="badge" style="--c:${LINE_COLORS[l]}">${l}</span>`)
          .join(" ")}</span></li>`,
    ).join("\n          ");
  const track = METRO_LINES.map(
    ({ line }, i) => `<line x1="0" y1="${12 + i * 7}" x2="${250 - i * 22}" y2="${12 + i * 7}" stroke="${LINE_COLORS[line]}" stroke-width="4" stroke-linecap="round"/>`,
  ).join("");

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Station niet gevonden — Metro Amsterdam Live</title>
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48 96x96" />
    <style>
      :root { color-scheme: light dark; --bg: #faf6ec; --ink: #1d2433; --muted: #6b6455; --accent: #7b2132; --card: #f1ebdd; --link: #1f3a68; }
      @media (prefers-color-scheme: dark) { :root { --bg: #111727; --ink: #ece6d6; --muted: #8b93a7; --accent: #c8a951; --card: #1a2134; --link: #8aa2ff; } }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
      main { max-width: 44rem; margin: 0 auto; padding: 2rem 1rem 3rem; }
      h1, h2 { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; line-height: 1.2; }
      h1 { font-size: 2rem; margin: 0.5rem 0; }
      h2 { font-size: 1.15rem; color: var(--accent); margin: 2rem 0 0.5rem; }
      a { color: var(--link); }
      .code { font-variant-caps: all-small-caps; letter-spacing: 0.08em; color: var(--accent); font-weight: 600; }
      svg { display: block; width: 100%; max-width: 18rem; height: auto; margin: 1rem 0; }
      .buffer { fill: var(--accent); }
      .suggest { background: var(--card); border-radius: 0.5rem; padding: 0.75rem 1rem; margin: 1rem 0; }
      .suggest:empty { display: none; }
      .actions { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }
      ul.stations { list-style: none; padding: 0; columns: 2 14rem; column-gap: 1.5rem; font-size: 0.9rem; }
      ul.stations li { break-inside: avoid; }
      /* Tap targets of at least 24 px (WCAG 2.5.8), on phones too. */
      ul.stations a, .actions a, .suggest a { display: inline-block; min-height: 24px; line-height: 24px; }
      .lines { white-space: nowrap; }
      .badge { display: inline-block; min-width: 1.6em; margin-left: 0.15rem; padding: 0 0.25em; border-radius: 0.2rem; background: var(--c); color: #111; font-size: 0.7rem; font-weight: 700; text-align: center; }
      [hidden] { display: none !important; }
    </style>
  </head>
  <body>
    <main>
      <svg viewBox="0 0 280 50" role="img" aria-label="Doodlopend spoor / Dead-end track">
        ${track}
        <rect class="buffer" x="262" y="4" width="8" height="42" rx="2"/>
      </svg>
      <div lang="nl" data-lang="nl">
        <p class="code">Fout 404</p>
        <h1>Dit station staat niet op de kaart</h1>
        <p>Dit adres bestaat niet (meer). Misschien is het een tikfout, of een oude link.</p>
        <div class="suggest" data-suggest></div>
        <p class="actions"><a href="/">Live 3D-metrokaart</a> <a href="/reisinfo">Reisinformatie en reisplanner</a> <a href="/en/" hreflang="en" lang="en">English</a></p>
        <h2>Alle metrostations</h2>
        <ul class="stations">
          ${list("nl")}
        </ul>
      </div>
      <div lang="en" data-lang="en">
        <p class="code">Error 404</p>
        <h1>This stop isn't on the map</h1>
        <p>This address doesn't exist (any more). It may be a typo, or an old link.</p>
        <div class="suggest" data-suggest></div>
        <p class="actions"><a href="/en/">Live 3D metro map</a> <a href="/en/reisinfo">Travel info and journey planner</a> <a href="/" hreflang="nl" lang="nl">Nederlands</a></p>
        <h2>All metro stations</h2>
        <ul class="stations">
          ${list("en")}
        </ul>
      </div>
    </main>
    <script type="application/json" id="station-data">${data}</script>
    <script src="/404.js"></script>
  </body>
</html>
`;
}
