import { useCallback, useState } from "react";

export function useSidebarOpen(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);
  // Stable, so effects can depend on them without re-running every render.
  const openSidebar = useCallback(() => setOpen(true), []);
  const closeSidebar = useCallback(() => setOpen(false), []);
  return [open, openSidebar, closeSidebar];
}
