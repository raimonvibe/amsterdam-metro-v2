/** Third-party services and data sources used by Amsterdam Metro Live. */

export const CREDITS = [
  {
    label: "Transit data",
    items: [
      { name: "OVapi", href: "https://gtfs.ovapi.nl/" },
      { name: "openOV", href: "https://openov.nl/" },
      { name: "NDOV", href: "https://ndov.nl/" },
    ],
    note: "CC0 open data via Stichting OpenGeo / OVapi. Unofficial — not affiliated with or endorsed by GVB.",
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
    items: [
      {
        name: "Font Awesome Free",
        href: "https://fontawesome.com/license/free",
      },
    ],
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

export function Credits({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
  return (
    <div className="text-[10px] leading-relaxed text-gray-400 dark:text-gray-600">
      <p className="mb-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-600">
        Unofficial fan project — not affiliated with GVB or the City of Amsterdam.
      </p>
      <p className="mb-2 font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">
        Credits
      </p>
      <ul className="space-y-2">
        {CREDITS.map((section) => (
          <li key={section.label}>
            <span className="text-gray-500 dark:text-gray-500">{section.label}: </span>
            {section.items.map((item, i) => (
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
            {"note" in section && section.note && (
              <span className="block text-gray-400 dark:text-gray-600">{section.note}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-gray-400 dark:text-gray-600">
        Theme preference stored locally only.{" "}
        <button
          type="button"
          onClick={onOpenPrivacy}
          className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Privacy Policy
        </button>
      </p>
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
