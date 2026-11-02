import { onColor } from "../contrast";
import { NO_TRANSLATE } from "./Num";

/** The line number on its line colour, as on the map's sidebar, station card
 *  and train popup. Kept out of browser translation, and fixed in size so a
 *  translator that ignores that (Edge and Safari don't document support)
 *  still can't stretch "51" into a sentence outside the colour block. See
 *  docs/browser-translation.md. */
export function LineBadge({ id, color, label }: { id: string; color: string; label?: string }) {
  return (
    <span
      {...NO_TRANSLATE}
      aria-label={label}
      className={`${NO_TRANSLATE.className} flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded text-[11px] font-bold`}
      style={{ backgroundColor: color, color: onColor(color) }}
    >
      {id}
    </span>
  );
}
