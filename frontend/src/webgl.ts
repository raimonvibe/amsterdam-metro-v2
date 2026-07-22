export function getWebGLStatus(): { ok: true } | { ok: false; reason: string } {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    if (!gl) {
      return {
        ok: false,
        reason: "WebGL is disabled or unavailable in this browser.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "WebGL is blocked in this browser." };
  }
}
