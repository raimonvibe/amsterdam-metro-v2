/**
 * Security headers for the static site (audit M1). One source: Vite's preview
 * server sends them, so a local production build behaves like the live site,
 * and the same values go in the Render dashboard (which does not read
 * render.yaml). The CSP starts as Report-Only: violations show in the console
 * without blocking anything, until a clean run allows enforcing it.
 */
export const TILE_ORIGIN = "https://tiles.openfreemap.org";

export function contentSecurityPolicy(apiOrigin: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // React style attributes and MapLibre's inline styles.
    "style-src 'self' 'unsafe-inline'",
    // The train glow is a data: URL; MapLibre decodes images to blob:.
    `img-src 'self' data: blob: ${TILE_ORIGIN}`,
    "font-src 'self'",
    // data: because deck.gl fetches the train-glow sprite, a data: URL.
    `connect-src 'self' ${apiOrigin} ${TILE_ORIGIN} data:`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(apiOrigin: string): Record<string, string> {
  return {
    "Content-Security-Policy-Report-Only": contentSecurityPolicy(apiOrigin),
    // No includeSubDomains: other subdomains may not all be on HTTPS.
    "Strict-Transport-Security": "max-age=31536000",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // The travel page asks for location ("dichtbij"); nothing else is used.
    "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}
