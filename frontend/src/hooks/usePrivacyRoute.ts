import { useCallback, useEffect, useState } from "react";
import { getLang } from "../i18n";
import { pageOfPath, pagePath } from "../i18n/paths";

const onPrivacyPath = () => pageOfPath(window.location.pathname) === "/privacy";

export function usePrivacyRoute() {
  const [showPrivacy, setShowPrivacy] = useState(onPrivacyPath);

  const openPrivacy = useCallback(() => {
    window.history.pushState({ privacy: true }, "", pagePath("/privacy", getLang()));
    setShowPrivacy(true);
  }, []);

  const closePrivacy = useCallback(() => {
    window.history.pushState({}, "", pagePath("/", getLang()));
    setShowPrivacy(false);
  }, []);

  useEffect(() => {
    const onPop = () => setShowPrivacy(onPrivacyPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { showPrivacy, openPrivacy, closePrivacy };
}
