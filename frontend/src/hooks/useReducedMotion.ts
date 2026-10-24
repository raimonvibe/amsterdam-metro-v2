import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function matches(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

/** The visitor asked their system for less motion; follows changes live. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(QUERY);
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduce;
}
