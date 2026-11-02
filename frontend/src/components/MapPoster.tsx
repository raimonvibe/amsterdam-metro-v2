import { Play } from "lucide-react";
import { useT } from "../i18n";
import type { MapStyle } from "../theme";

/**
 * A still of the live 3D map, for a browser that draws 3D without a graphics
 * chip (see softwareGL in src/quality.ts). There the live map spends 10–17 s
 * compiling its shaders before the page responds again; the still shows the
 * same 3D city at once, and the visitor starts the live map when they want.
 * Rendered from the real map at its opening view, per style and orientation
 * (frontend/public/poster/, made by scripts/render-posters.mjs).
 */
export function MapPoster({ mapStyle, backdrop, onStart }: { mapStyle: MapStyle; backdrop: string; onStart: () => void }) {
  const txt = useT();
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: backdrop }}>
      <picture>
        <source media="(orientation: portrait)" srcSet={`/poster/${mapStyle}-portrait.webp`} type="image/webp" />
        <img
          src={`/poster/${mapStyle}-landscape.webp`}
          alt={txt.posterAlt}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </picture>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/65 via-black/30 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-20 text-center">
        <button
          type="button"
          onClick={onStart}
          className="flex min-h-11 items-center gap-2 rounded-full bg-[#4363D8] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#3651b8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Play size={16} fill="currentColor" aria-hidden />
          {txt.posterStart}
        </button>
        <p className="max-w-sm text-xs leading-snug text-white/90">{txt.posterNote}</p>
      </div>
    </div>
  );
}
