import { X } from "lucide-react";
import { AnimatedTrain, Line } from "../types";

interface FollowChipProps {
  train: AnimatedTrain;
  lines: Line[];
  onStop: () => void;
}

export function FollowChip({ train, lines, onStop }: FollowChipProps) {
  const color = lines.find((l) => l.id === train.line)?.color ?? "#999";
  return (
    <div className="absolute left-1/2 top-[max(3.5rem,calc(env(safe-area-inset-top)+3rem))] z-20 flex max-w-[calc(100vw-1.5rem-env(safe-area-inset-left)-env(safe-area-inset-right))] -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-gray-900 shadow-lg backdrop-blur dark:bg-gray-950/85 dark:text-gray-100 sm:top-4 sm:max-w-[min(24rem,calc(100vw-2rem))]">
      <span
        className="flex h-5 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold text-gray-950"
        style={{ backgroundColor: color }}
      >
        {train.line}
      </span>
      <span className="truncate">Following → {train.headsign}</span>
      <button
        type="button"
        onClick={onStop}
        title="Stop following (Esc)"
        aria-label="Stop following train"
        className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      >
        <X size={13} />
      </button>
    </div>
  );
}
