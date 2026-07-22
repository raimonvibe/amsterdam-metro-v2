import { useState } from "react";

export function useSidebarOpen(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);

  return [open, () => setOpen(true), () => setOpen(false)];
}
