import { useCallback, useEffect, useState } from "react";
import { getLang } from "../i18n";
import { pageOfPath, pagePath } from "../i18n/paths";

const onTravelPath = () => pageOfPath(window.location.pathname) === "/reisinfo";

/** /reisinfo (or /en/reisinfo) as an in-app page, same pattern as /privacy:
 *  a real URL that can be shared, bookmarked and reached with the back button. */
export function useTravelRoute() {
  const [showTravel, setShowTravel] = useState(onTravelPath);

  const openTravel = useCallback((query = "") => {
    window.history.pushState({ travel: true }, "", `${pagePath("/reisinfo", getLang())}${query}`);
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
