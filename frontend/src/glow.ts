/**
 * Soft bloom sprite for trains (halo only).
 *
 * The hard train body is no longer this icon — MetroMap draws a rail-following
 * TripsLayer that fades at both ends so the nose dissolves ahead without a
 * detached look-ahead path. This sprite is only the soft glow around mid-body.
 */

const W = 256;
const H = 128;

let cached: string | null = null;

function smooth(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

/** Data-URL for the sprite; built once on first use, then reused. */
export function glowSpriteUrl(): string {
  if (cached !== null) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return (cached = "");

  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x / (W - 1)) * 2 - 1;
      const v = (y / (H - 1)) * 2 - 1;
      const lat = Math.max(0, 1 - Math.abs(v));
      const axial = smooth(1 - Math.abs(u));
      const a = Math.round(255 * lat * lat * axial * axial);
      const i = (y * W + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);

  cached = canvas.toDataURL("image/png");
  return cached;
}

export const GLOW_ICON_MAPPING = {
  glow: {
    x: 0,
    y: 0,
    width: W,
    height: H,
    anchorX: W / 2,
    anchorY: H / 2,
    mask: true,
  },
} as const;

/**
 * IconLayer rotates the sprite clockwise from its local +x axis, so a compass
 * bearing (0 = north, clockwise) maps to `90 - bearing` degrees.
 */
export const angleForBearing = (bearing: number): number => 90 - bearing;
