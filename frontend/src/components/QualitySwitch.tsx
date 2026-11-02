import { useId } from "react";
import { useT } from "../i18n";
import { type Quality, type QualityPref, setQualityPref, useQualityPref } from "../quality";

const OPTIONS: QualityPref[] = ["auto", "full", "lite"];

/**
 * Auto / Full / Light for the 3D map, under the map styles and in the same
 * style: a radio group, arrow keys move the choice. Auto is the default and
 * isn't stored; when it picked Light on a slow device, a line says so, so the
 * plainer map doesn't look like a fault.
 */
export function QualitySwitch({ quality }: { quality: Quality }) {
  const txt = useT();
  const pref = useQualityPref();
  const helpId = useId();
  const label = (p: QualityPref) => (p === "auto" ? txt.qualityAuto : p === "full" ? txt.qualityFull : txt.qualityLite);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = OPTIONS[(OPTIONS.indexOf(pref) + step + OPTIONS.length) % OPTIONS.length];
    setQualityPref(next);
    (e.currentTarget.querySelector(`[data-quality="${next}"]`) as HTMLElement | null)?.focus();
  };

  return (
    <div className="mt-2.5">
      <div className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-300" aria-hidden>
        {txt.quality3d}
      </div>
      <div>
        <div
          role="radiogroup"
          aria-label={txt.quality3d}
          aria-describedby={helpId}
          onKeyDown={onKeyDown}
          className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900"
        >
          {OPTIONS.map((p) => {
            const on = p === pref;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                data-quality={p}
                tabIndex={on ? 0 : -1}
                onClick={() => setQualityPref(p)}
                className={`min-h-9 min-w-0 rounded-lg px-2 text-[11px] font-semibold leading-tight transition ${
                  on
                    ? "bg-white text-[#4363D8] shadow-sm ring-2 ring-[#4363D8] dark:bg-gray-800 dark:text-blue-200 dark:ring-[#6b8cff]"
                    : "text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {label(p)}
              </button>
            );
          })}
        </div>
      </div>
      <p id={helpId} className="sr-only">{txt.qualityHelp}</p>
      {pref === "auto" && quality === "lite" && (
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">{txt.qualityAutoLite}</p>
      )}
    </div>
  );
}
