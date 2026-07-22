import { useEffect, useState } from "react";

const STORAGE_KEY = "metro-live:sidebar-open";

export function useSidebarOpen(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== "false";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, open ? "true" : "false");
  }, [open]);

  return [open, () => setOpen(true), () => setOpen(false)];
}
