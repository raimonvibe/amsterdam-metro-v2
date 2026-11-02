/** Why the 3D map can't start, as a key MetroMap turns into text in the
 *  visitor's language. */
export function getWebGLStatus(): { ok: true } | { ok: false; reason: "unavailable" | "blocked" } {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!gl) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "blocked" };
  }
}
