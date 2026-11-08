import { useCallback, useEffect, useState } from "react";
import { getLang } from "../i18n";
import { pageOfPath, pagePath, stationPath } from "../i18n/paths";

const onTravelPath = () => pageOfPath(window.location.pathname) === "/reisinfo";

/** /reisinfo (or /en/reisinfo) as an in-app page, same pattern as /privacy:
 *  a real URL that can be shared, bookmarked and reached with the back button. */
export function useTravelRoute() {
  const [showTravel, setShowTravel] = useState(onTravelPath);

  /** Opens the travel page, on a station's page when given its slug. */
  const openTravel = useCallback((slug?: string) => {
    window.history.pushState({ travel: true }, "", slug ? stationPath(slug, getLang()) : pagePath("/reisinfo", getLang()));
    setShowTravel(true);
  }, []);

  const closeTravel = useCallback(() => {
    window.history.pushState({}, "", pagePath("/", getLang()));
    setShowTravel(false);
  }, []);

  useEffect(() => {
    const onPop = () => setShowTravel(onTravelPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { showTravel, openTravel, closeTravel };
}
