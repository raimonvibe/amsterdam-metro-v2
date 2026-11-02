/** The two map methods `onIdleOrAfter` needs; a MapLibre map has them. */
interface IdleEvents {
  once(type: "idle", listener: () => void): unknown;
  off(type: "idle", listener: () => void): unknown;
}

/** Run `fn` once: on the map's next "idle", or after `ms` if that comes
 *  first. "idle" needs the camera still and every tile loaded, which a
 *  moving camera (a followed train) can put off indefinitely. */
export function onIdleOrAfter(map: IdleEvents, ms: number, fn: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    map.off("idle", run);
    fn();
  };
  const timer = setTimeout(run, ms);
  map.once("idle", run);
}
