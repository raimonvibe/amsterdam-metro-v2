import { formatPlaceName, fullPlaceName } from "../format";
import { NO_TRANSLATE } from "./Num";

/** A station or line name, marked translate="no" so browser translation
 *  (Chrome, Safari, Edge) leaves it Dutch: names are proper nouns that match
 *  the signs in the stations, and translated they become words ("Gein" turned
 *  into "Joke"). `full` keeps "Centraal Station" unabbreviated. */
export function Place({ name, full = false }: { name: string; full?: boolean }) {
  return <span {...NO_TRANSLATE}>{full ? fullPlaceName(name) : formatPlaceName(name)}</span>;
}
