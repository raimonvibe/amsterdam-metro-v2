/**
 * Run `fn` now and every `ms` while the page is visible; pause in background
 * tabs and catch up immediately on return. A tab left open in the background
 * otherwise keeps hitting the API every few seconds for nobody — on a small
 * server those requests are pure waste. Returns a cleanup function.
 */
export function pollWhileVisible(fn: () => void, ms: number): () => void {
  let id: number | undefined;
  const start = () => {
    if (id !== undefined) return;
    fn();
    id = window.setInterval(fn, ms);
  };
  const pause = () => {
    if (id === undefined) return;
    window.clearInterval(id);
    id = undefined;
  };
  const onVisibility = () => (document.hidden ? pause() : start());
  document.addEventListener("visibilitychange", onVisibility);
  if (!document.hidden) start();
  return () => {
    pause();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
