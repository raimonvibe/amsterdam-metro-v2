import { Map as MapIcon, Moon, Mountain, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { MapStyle } from "../theme";
import { nl } from "../i18n/nl";

const OPTIONS: { id: MapStyle; label: string; Icon: LucideIcon }[] = [
  { id: "liberty", label: "Liberty", Icon: MapIcon },
  { id: "bright", label: "Bright", Icon: Sparkles },
  { id: "light", label: nl.styleLight, Icon: Sun },
  { id: "dark", label: nl.styleDark, Icon: Moon },
  { id: "fiord", label: "Fiord", Icon: Mountain },
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
      aria-label={nl.mapStyle}
      onKeyDown={onKeyDown}
      className="grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900"
    >
      {OPTIONS.map(({ id, label, Icon }) => {
        const on = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            data-style={id}
            tabIndex={on ? 0 : -1}
            title={label}
            onClick={() => onChange(id)}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 transition ${
              on
                ? "bg-[#4363D8] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            <Icon size={18} strokeWidth={2.25} aria-hidden />
            <span className="max-w-full truncate text-[10px] font-semibold leading-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
