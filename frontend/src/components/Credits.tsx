import { useT, type Dict } from "../i18n";

/** Bronvermelding en gebruikte diensten. Labels and notes are string keys. */

type Key = keyof Dict;

export const CREDITS: readonly { label: Key; items: readonly { name: string; href: string }[]; note?: Key }[] = [
  {
    label: "creditTravel",
    items: [
      { name: "OVapi", href: "https://gtfs.ovapi.nl/" },
      { name: "openOV", href: "https://openov.nl/" },
      { name: "NDOV", href: "https://ndov.nl/" },
    ],
    note: "creditTravelNote",
  },
  {
    label: "creditTiles",
    items: [
      { name: "OpenFreeMap", href: "https://openfreemap.org/" },
      { name: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
      { name: "OpenMapTiles", href: "https://openmaptiles.org/" },
    ],
  },
  {
    label: "creditMap",
    items: [
      { name: "MapLibre GL JS", href: "https://maplibre.org/" },
      { name: "deck.gl", href: "https://deck.gl/" },
    ],
  },
  {
    label: "creditIcons",
    items: [
      {
        name: "Font Awesome Free",
        href: "https://fontawesome.com/license/free",
      },
      { name: "Lucide", href: "https://lucide.dev/license" },
    ],
    note: "creditIconsNote",
  },
  {
    label: "creditInspiration",
    items: [
      {
        name: "londonunderground.live",
        href: "https://www.londonunderground.live/",
      },
    ],
    note: "creditInspirationNote",
  },
];

const creditLink =
  "underline decoration-gray-300 underline-offset-2 hover:text-gray-800 dark:text-gray-200 dark:decoration-gray-600 dark:hover:text-white";

export function Credits({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
  const txt = useT();
  const say = (k: Key) => txt[k] as string;
  return (
    <div className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 sm:text-[13px]">
      <p className="mb-2 text-gray-600 dark:text-gray-300">
        {txt.notOfficial}
      </p>
      <p className="mb-2 font-medium uppercase tracking-wide text-gray-700 dark:text-gray-200">
        {txt.credits}
      </p>
      <ul className="space-y-2.5">
        {CREDITS.map((section) => (
          <li key={section.label}>
            <span className="text-gray-700 dark:text-gray-200">{say(section.label)}: </span>
            {section.items.map((item, i) => (
              <span key={item.href}>
                {i > 0 && ", "}
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={creditLink}
                >
                  {item.name}
                </a>
              </span>
            ))}
            {section.note && (
              <span className="mt-0.5 block text-gray-500 dark:text-gray-400">{say(section.note)}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-gray-600 dark:text-gray-300">
        {txt.storedLocally}{" "}
        <button type="button" onClick={onOpenPrivacy} className={creditLink}>
          {txt.privacyPolicy}
        </button>
      </p>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        © {new Date().getFullYear()}{" "}
        <a href="https://amsterdammetro.nl" className={creditLink}>
          amsterdammetro.nl
        </a>
        {" · "}
        <a
          href="https://github.com/raimonvibe/amsterdam-metro-v2"
          target="_blank"
          rel="noopener noreferrer"
          className={creditLink}
        >
          MIT
        </a>
      </p>
    </div>
  );
}
