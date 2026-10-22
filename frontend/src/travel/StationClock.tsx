import { amsterdamTime, clock } from "./time";

const TICKS = Array.from({ length: 60 }, (_, i) => i);

/** Hand angles in degrees, clockwise from 12. The hour hand creeps with the
 *  minutes and the minute hand with the seconds, as on a real clock. */
export function handAngles(ms: number): { hour: number; minute: number; second: number } {
  const { h, m, s } = amsterdamTime(ms);
  return { hour: (h % 12) * 30 + m * 0.5, minute: m * 6 + s * 0.1, second: s * 6 };
}

/** A classic Dutch station clock showing Amsterdam time. It draws `nowMs`
 *  from the page, which already re-renders every second, so it keeps no timer
 *  of its own. Hands turn with the SVG rotate(angle cx cy) attribute rather
 *  than CSS transforms (whose origin on SVG elements varies), and they jump
 *  without a transition, which would otherwise spin backwards at 59 -> 0. */
export function StationClock({ nowMs, className = "" }: { nowMs: number; className?: string }) {
  const a = handAngles(nowMs);
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={`Klok, ${clock(nowMs / 1000)} Amsterdamse tijd`} className={className}>
      <circle cx="50" cy="50" r="48" className="fill-white stroke-[#1d2433] dark:fill-[#f3eee2] dark:stroke-[#c8a951]" strokeWidth="3" />
      {TICKS.map((i) => (
        <line
          key={i}
          x1="50"
          y1={i % 5 === 0 ? 6 : 7}
          x2="50"
          y2={i % 5 === 0 ? 17 : 10}
          transform={`rotate(${i * 6} 50 50)`}
          strokeWidth={i % 5 === 0 ? 4 : 1.5}
          className="stroke-[#1d2433]"
        />
      ))}
      <g className="fill-[#1d2433]">
        <rect x="46.5" y="24" width="7" height="34" rx="1" transform={`rotate(${a.hour} 50 50)`} />
        <rect x="47.5" y="9" width="5" height="49" rx="1" transform={`rotate(${a.minute} 50 50)`} />
      </g>
      {/* The red seconds hand with its disc, as on NS platform clocks. Hidden for
          visitors who ask for less motion; the hour and minute hands still tell the time. */}
      <g transform={`rotate(${a.second} 50 50)`} className="fill-[#b42335] stroke-[#b42335] motion-reduce:hidden">
        <line x1="50" y1="66" x2="50" y2="24" strokeWidth="1.5" />
        <circle cx="50" cy="22" r="5" stroke="none" />
      </g>
      <circle cx="50" cy="50" r="2" className="fill-[#1d2433]" />
    </svg>
  );
}
