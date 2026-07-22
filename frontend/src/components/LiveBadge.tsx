import { Status } from "../types";
import { nl } from "../i18n/nl";

export function LiveBadge({ status }: { status: Status | null }) {
  const live = status?.is_live ?? false;
  return (
    <div className="pointer-events-none absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow backdrop-blur dark:bg-gray-950/80 dark:text-gray-100">
      <span
        className={`h-2.5 w-2.5 animate-pulse rounded-full ${
          live ? "bg-emerald-500 dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"
        }`}
      />
      {live ? nl.live : nl.schedule}
    </div>
  );
}
