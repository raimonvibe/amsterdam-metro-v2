import { ReactNode, useEffect, useState } from "react";

/** Shared building blocks of the travel-info page. */

export function LineBadge({ id, color, small = false }: { id: string; color: string; small?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded font-bold tabular-nums text-gray-950 ${
        small ? "h-4 min-w-6 px-1 text-[10px]" : "h-5 min-w-7 px-1 text-[11px]"
      }`}
      style={{ backgroundColor: color }}
      aria-label={`Lijn ${id}`}
    >
      {id}
    </span>
  );
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/** A ruled section with a Roman-numeral, small-caps heading. */
export function Section({
  n,
  title,
  aside,
  children,
  id,
  className = "",
}: {
  n: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`rounded-lg border border-[#d8cfbd] bg-[#fffdf8] shadow-[0_1px_0_rgba(60,45,20,0.06)] dark:border-[#2a3245] dark:bg-[#111727] ${className}`}
    >
      <header className="rule-double flex items-center justify-between gap-2 px-3 pb-1.5 pt-2">
        <h2 id={headingId} className="font-academic flex min-w-0 items-baseline gap-2 text-[15px] font-semibold text-[#1d2433] dark:text-[#ece6d6]">
          <span className="smallcaps text-[#7b2132] dark:text-[#c8a951]" aria-hidden>
            {ROMAN[n]}.
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {aside}
      </header>
      <div className="px-3 py-2.5">{children}</div>
    </section>
  );
}

/** Segmented control: one choice from a few. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-[#d8cfbd] dark:border-[#2a3245]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-8 px-2.5 text-xs tabular-nums transition ${
              on
                ? "bg-[#1f3a68] font-semibold text-white dark:bg-[#c8a951] dark:text-[#111727]"
                : "bg-transparent text-[#3b4457] hover:bg-[#f1ebdd] dark:text-[#c9c3b4] dark:hover:bg-[#1a2134]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The page crest: a shield quartered in the five line colours, an M. */
export function Crest({ colors, className = "" }: { colors: string[]; className?: string }) {
  const stripes = colors.length ? colors : ["#3CB44B", "#F58231", "#4363D8", "#E6194B", "#FFE119"];
  const w = 40 / stripes.length;
  return (
    <svg viewBox="0 0 48 56" className={className} role="img" aria-label="Wapen van Metro Amsterdam Live">
      <defs>
        <clipPath id="crest-shield">
          <path d="M4 4h40v22c0 14-9 23-20 27C13 49 4 40 4 26z" />
        </clipPath>
      </defs>
      <g clipPath="url(#crest-shield)">
        <rect x="0" y="0" width="48" height="56" fill="#1f3a68" />
        {stripes.map((c, i) => (
          <rect key={i} x={4 + i * w} y="34" width={w} height="22" fill={c} />
        ))}
        {/* Three St Andrew's crosses, as in the Amsterdam arms, quietly. */}
        {[14, 24, 34].map((x) => (
          <g key={x} stroke="#f6f2e9" strokeWidth="1.6" opacity="0.35">
            <line x1={x - 2.5} y1="27" x2={x + 2.5} y2="32" />
            <line x1={x + 2.5} y1="27" x2={x - 2.5} y2="32" />
          </g>
        ))}
      </g>
      <path d="M4 4h40v22c0 14-9 23-20 27C13 49 4 40 4 26z" fill="none" stroke="#c8a951" strokeWidth="2" />
      <text x="24" y="24" textAnchor="middle" fontFamily="Georgia, serif" fontSize="18" fontWeight="700" fill="#f6f2e9">
        M
      </text>
    </svg>
  );
}

/** Placeholder rows while data loads, so the layout never jumps or gapes. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-1.5" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-[#efe8d8] dark:bg-[#1a2134]" />
      ))}
    </div>
  );
}

/** Below Tailwind's sm breakpoint (40rem); follows rotation and resizing. */
export function useNarrowScreen(): boolean {
  const query = "(max-width: 39.99rem)";
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [narrow, setNarrow] = useState(() => supported && window.matchMedia(query).matches);
  useEffect(() => {
    if (!supported) return;
    const mq = window.matchMedia(query);
    const update = () => setNarrow(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [supported]);
  return narrow;
}
