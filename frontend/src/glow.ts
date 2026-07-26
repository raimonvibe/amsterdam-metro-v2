/**
 * Soft glow sprite for trains.
 *
 * A ScatterplotLayer disc has a hard edge, and stacking ever-wider PathLayers
 * to fake a falloff bands visibly. Instead we generate one radial-gradient
 * texture whose alpha falls off as (1-r)^2 and let deck.gl's IconLayer tint it
 * per line (`mask: true`), which gives a genuinely smooth halo for the cost of
 * a single instanced quad per train.
 *
 * The sprite is 2:1, so the icon renders elongated along the track once it is
 * rotated to the train's bearing.
 */

const W = 256;
const H = 128;
const STOPS = 16;

let cached: string | null = null;

/** Data-URL for the sprite; built once on first use, then reused. */
export function glowSpriteUrl(): string {
  if (cached !== null) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return (cached = "");

  // Draw a circular gradient into a 2x-stretched space → an ellipse whose long
  // axis is the sprite's local +x, which is what getAngle rotates.
  ctx.translate(W / 2, H / 2);
  ctx.scale(2, 1);
  const r = H / 2;
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  for (let i = 0; i <= STOPS; i++) {
    const t = i / STOPS;
    gradient.addColorStop(t, `rgba(255,255,255,${(1 - t) ** 2})`);
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

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
    mask: true, // tint from getColor instead of the texture's own rgb
  },
} as const;

/**
 * IconLayer rotates the sprite clockwise from its local +x axis, so a compass
 * bearing (0 = north, clockwise) maps to `90 - bearing` degrees.
 */
export const angleForBearing = (bearing: number): number => 90 - bearing;
