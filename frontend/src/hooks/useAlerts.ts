import { useEffect, useState } from "react";
import { fetchAlerts } from "../api";
import { pollWhileVisible } from "../poll";
import { ServiceAlert } from "../types";

/** The backend re-reads alerts.pb every 2 minutes; polling faster finds nothing new. */
const ALERTS_POLL_MS = 120_000;

/** Metro service messages in force now, refreshed while the page is visible.
 *  Empty until the first answer, and kept as it was through a failed poll. */
export function useAlerts(): ServiceAlert[] {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  useEffect(() => {
    let stop = false;
    const cleanup = pollWhileVisible(async () => {
      try {
        const a = await fetchAlerts();
        if (!stop) setAlerts(a);
      } catch {
        /* transient, or a backend without /api/alerts */
      }
    }, ALERTS_POLL_MS);
    return () => {
      stop = true;
      cleanup();
    };
  }, []);
  return alerts;
}
