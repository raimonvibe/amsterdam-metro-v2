/** Third-party services and data sources used by Amsterdam Metro Live. */

export const CREDITS = [
  {
    label: "Transit data",
    items: [
      { name: "OVapi", href: "https://gtfs.ovapi.nl/" },
      { name: "openOV", href: "https://openov.nl/" },
      { name: "NDOV", href: "https://ndov.nl/" },
    ],
    note: "GVB metro GTFS static & realtime feeds (lines 50–54). Not affiliated with GVB.",
  },
  {
    label: "Map tiles",
    items: [
      { name: "OpenFreeMap", href: "https://openfreemap.org/" },
      { name: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
      { name: "OpenMapTiles", href: "https://openmaptiles.org/" },
    ],
  },
  {
    label: "Map & 3D",
    items: [
      { name: "MapLibre GL JS", href: "https://maplibre.org/" },
      { name: "deck.gl", href: "https://deck.gl/" },
    ],
  },
  {
    label: "Icons",
    items: [{ name: "Font Awesome", href: "https://fontawesome.com/" }],
    note: "Icons by Fonticons, Inc.",
  },
  {
    label: "Inspiration",
    items: [
      {
        name: "londonunderground.live",
        href: "https://www.londonunderground.live/",
      },
    ],
    note: "By Ben James.",
  },
] as const;

export function Credits() {
  return (
    <div className="text-[10px] leading-relaxed text-gray-400 dark:text-gray-600">
      <p className="mb-2 font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">
        Credits
      </p>
      <ul className="space-y-2">
        {CREDITS.map(({ label, items, note }) => (
          <li key={label}>
            <span className="text-gray-500 dark:text-gray-500">{label}: </span>
            {items.map((item, i) => (
              <span key={item.href}>
                {i > 0 && ", "}
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-gray-800 dark:text-gray-400 dark:decoration-gray-700 dark:hover:text-gray-200"
                >
                  {item.name}
                </a>
              </span>
            ))}
            {note && (
              <span className="block text-gray-400 dark:text-gray-600">{note}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-gray-400 dark:text-gray-600">
        © {new Date().getFullYear()}{" "}
        <a
          href="https://amsterdammetro.nl"
          className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
        >
          amsterdammetro.nl
        </a>
        {" · "}
        <a
          href="https://github.com/raimonvibe/amsterdam-metro-v2"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
        >
          MIT
        </a>
      </p>
    </div>
  );
}
