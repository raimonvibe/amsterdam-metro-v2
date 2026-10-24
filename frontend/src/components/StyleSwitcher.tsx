import { Map as MapIcon, Moon, Mountain, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { MapStyle } from "../theme";
import { useT } from "../i18n";

/**
 * Icon colour hints at each basemap (Liberty's parks, Fiord's blue-grey).
 * Light-mode shades are the -600 end so the strokes keep >=3:1 against the
 * gray-100 track; dark mode uses lighter shades for the same reason.
 */
const OPTIONS: { id: MapStyle; label: string; Icon: LucideIcon; color: string }[] = [
  { id: "liberty", label: "Liberty", Icon: MapIcon, color: "text-emerald-600 dark:text-emerald-400" },
  { id: "bright", label: "Bright", Icon: Sparkles, color: "text-pink-600 dark:text-pink-400" },
  { id: "light", label: "styleLight", Icon: Sun, color: "text-amber-600 dark:text-amber-300" },
  { id: "dark", label: "styleDark", Icon: Moon, color: "text-indigo-600 dark:text-indigo-300" },
  { id: "fiord", label: "Fiord", Icon: Mountain, color: "text-[#45516e] dark:text-[#9fb0d0]" },
];

interface StyleSwitcherProps {
  value: MapStyle;
  onChange: (style: MapStyle) => void;
}

/**
 * Five one-tap style switches in a row. No menu to open or close, so styles
 * can be flicked through to compare. Radio-group semantics: arrow keys move
 * the selection (and so apply it), as with native radios.
 */
export function StyleSwitcher({ value, onChange }: StyleSwitcherProps) {
  const txt = useT();
  // Liberty, Bright and Fiord are names; Light and Dark are words.
  const labelOf = (label: string) => (label === "styleLight" || label === "styleDark" ? txt[label] : label);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = OPTIONS.findIndex((o) => o.id === value);
    const next = OPTIONS[(i + step + OPTIONS.length) % OPTIONS.length];
    onChange(next.id);
    (e.currentTarget.querySelector(`[data-style="${next.id}"]`) as HTMLElement | null)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={txt.mapStyle}
      onKeyDown={onKeyDown}
      className="grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900"
    >
      {OPTIONS.map(({ id, label, Icon, color }) => {
        const on = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            data-style={id}
            tabIndex={on ? 0 : -1}
            title={labelOf(label)}
            onClick={() => onChange(id)}
            // Selected = raised card with a blue ring rather than a solid blue
            // fill, so the icon keeps its colour when chosen.
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 transition ${
              on
                ? "bg-white text-[#4363D8] shadow-sm ring-2 ring-[#4363D8] dark:bg-gray-800 dark:text-blue-200 dark:ring-[#6b8cff]"
                : "text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            <Icon
              size={18}
              strokeWidth={2.25}
              fill="currentColor"
              fillOpacity={0.22}
              className={color}
              aria-hidden
            />
            <span className="max-w-full truncate text-[10px] font-semibold leading-tight">{labelOf(label)}</span>
          </button>
        );
      })}
    </div>
  );
}
