import { useCallback, useEffect, useState } from "react";

export function usePrivacyRoute() {
  const [showPrivacy, setShowPrivacy] = useState(
    () => window.location.pathname.replace(/\/$/, "") === "/privacy",
  );

  const openPrivacy = useCallback(() => {
    window.history.pushState({ privacy: true }, "", "/privacy");
    setShowPrivacy(true);
  }, []);

  const closePrivacy = useCallback(() => {
    window.history.pushState({}, "", "/");
    setShowPrivacy(false);
  }, []);

  useEffect(() => {
    const onPop = () => {
      setShowPrivacy(window.location.pathname.replace(/\/$/, "") === "/privacy");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { showPrivacy, openPrivacy, closePrivacy };
}
