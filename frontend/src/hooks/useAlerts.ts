import { useEffect, useState } from "react";
import { fetchAlerts } from "../api";
import { pollWhileVisible } from "../poll";
import { ServiceAlert } from "../types";

/** The backend re-reads alerts.pb every 2 minutes; polling faster finds nothing new. */
const ALERTS_POLL_MS = 120_000;
/** After a failed request (e.g. the backend restarting mid-deploy), retry on
 *  this schedule instead of waiting a full poll: 5, 10, 20, 40, 60, 60… s. */
export const ALERTS_RETRY_MIN_MS = 5_000;
export const ALERTS_RETRY_MAX_MS = 60_000;

/** Metro service messages in force now, refreshed while the page is visible.
 *  Empty until the first answer, and kept as it was through a failed poll. */
export function useAlerts(): ServiceAlert[] {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  useEffect(() => {
    let stop = false;
    let retry: number | undefined;
    let delay = ALERTS_RETRY_MIN_MS;
    const load = async () => {
      window.clearTimeout(retry);
      retry = undefined;
      try {
        const a = await fetchAlerts();
        if (stop) return;
        setAlerts(a);
        delay = ALERTS_RETRY_MIN_MS;
      } catch {
        // Transient, or a backend without /api/alerts. A hidden tab keeps
        // retrying too, but only on this slow, capped schedule.
        if (stop) return;
        retry = window.setTimeout(load, delay);
        delay = Math.min(delay * 2, ALERTS_RETRY_MAX_MS);
      }
    };
    const cleanup = pollWhileVisible(load, ALERTS_POLL_MS);
    return () => {
      stop = true;
      window.clearTimeout(retry);
      cleanup();
    };
  }, []);
  return alerts;
}
