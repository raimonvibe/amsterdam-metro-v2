import { useCallback, useEffect, useState } from "react";
import { SEO, setPageMeta } from "../seo/site";

export const TRAVEL_PATH = "/reisinfo";

const onTravelPath = () => window.location.pathname.replace(/\/$/, "") === TRAVEL_PATH;

/** /reisinfo as an in-app page, same pattern as /privacy: a real URL that
 *  can be shared, bookmarked and reached with the back button. */
export function useTravelRoute() {
  const [showTravel, setShowTravel] = useState(onTravelPath);

  useEffect(() => {
    if (showTravel) setPageMeta(SEO.travelTitle, SEO.travelDescription, TRAVEL_PATH);
    else if (!window.location.pathname.startsWith("/privacy")) setPageMeta(SEO.homeTitle, SEO.homeDescription, "/");
  }, [showTravel]);

  const openTravel = useCallback((query = "") => {
    window.history.pushState({ travel: true }, "", `${TRAVEL_PATH}${query}`);
    setShowTravel(true);
  }, []);

  const closeTravel = useCallback(() => {
    window.history.pushState({}, "", "/");
    setShowTravel(false);
  }, []);

  useEffect(() => {
    const onPop = () => setShowTravel(onTravelPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { showTravel, openTravel, closeTravel };
}
