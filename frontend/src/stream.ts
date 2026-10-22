import { API_BASE } from "./api";
import { Status, Train } from "./types";

export interface TrainSnapshot {
  trains: Train[];
  status: Status;
  /** Client-clock ms epoch the positions describe (see onSnapshot). */
  asOf: number;
}

const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 30000;
// Snapshots are pushed every 5s. A connection that goes this long without
// one is treated as dead and reopened: a half-open TCP connection (laptop
// sleep, a proxy that lost the upstream without closing our side) otherwise
// looks open forever. The server's heartbeats are SSE comments, which
// EventSource never surfaces to JS, so they cannot reset this.
const STALE_MS = 30000;

/**
 * Subscribe to /api/trains/stream while the page is visible. The stream is
 * closed in background tabs (an open connection there would be server work
 * for nobody) and reopened on return, which also delivers the current
 * snapshot straight away. Returns a cleanup function.
 *
 * EventSource reconnects by itself after a network error or when the server
 * ends the stream, but gives up for good on any non-200 reply (e.g. a proxy
 * 502 while the backend redeploys). Only that case is retried here, with
 * backoff, so the browser's own reconnect is never doubled up.
 *
 * The browser's own reconnects send the last event id (Last-Event-ID); the
 * app's reconnects (backoff, watchdog, tab shown again) open a new
 * EventSource, which would not, so they pass it as ?lastEventId= instead.
 * Either way the server answers with the current full snapshot at once.
 */
export function streamWhileVisible(
  onSnapshot: (s: TrainSnapshot) => void,
): () => void {
  let source: EventSource | undefined;
  let timer: number | undefined;
  let watchdog: number | undefined;
  let delay = RETRY_MIN_MS;
  let lastEventId = "";

  const close = () => {
    source?.close();
    source = undefined;
    window.clearTimeout(timer);
    timer = undefined;
    window.clearTimeout(watchdog);
  };

  const resetWatchdog = () => {
    window.clearTimeout(watchdog);
    watchdog = window.setTimeout(() => {
      close();
      open();
    }, STALE_MS);
  };

  const open = () => {
    if (source || timer !== undefined) return;
    const resume = lastEventId ? `?lastEventId=${encodeURIComponent(lastEventId)}` : "";
    const es = new EventSource(`${API_BASE}/api/trains/stream${resume}`);
    source = es;
    resetWatchdog();
    es.addEventListener("snapshot", (e) => {
      delay = RETRY_MIN_MS;
      resetWatchdog();
      const msg = e as MessageEvent<string>;
      lastEventId = msg.lastEventId;
      let parsed: { ageMs: number; trains: Train[]; status: Status };
      try {
        parsed = JSON.parse(msg.data);
      } catch {
        return; // malformed event: keep the last good state
      }
      const { ageMs, trains, status } = parsed;
      // The server says how old the snapshot is rather than when it was
      // made, so rewinding by that age is immune to client/server clock skew.
      onSnapshot({ trains, status, asOf: Date.now() - ageMs });
    });
    es.onerror = () => {
      if (es.readyState !== EventSource.CLOSED) return; // browser retrying
      close();
      timer = window.setTimeout(() => {
        timer = undefined;
        open();
      }, delay);
      delay = Math.min(delay * 2, RETRY_MAX_MS);
    };
  };

  const onVisibility = () => (document.hidden ? close() : open());
  document.addEventListener("visibilitychange", onVisibility);
  if (!document.hidden) open();
  return () => {
    close();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
